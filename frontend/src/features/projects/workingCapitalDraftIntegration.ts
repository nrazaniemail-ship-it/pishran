import type { ProjectCalendarPeriod } from './projectFoundation'
import { fiscalYearIndexForPeriod, type PeriodicProjectFinanceInput } from '../steel/periodicFinancialEngine'
import type { ProjectModelFinancialFormDrafts, WorkingCapitalComponentFormDraft } from './projectModelFormDrafts'

export type WorkingCapitalComponentPeriodRow = {
  componentId: string
  category: NonNullable<WorkingCapitalComponentFormDraft['category']>
  period: number
  amount: number
  signedAmount: number
  preRecoveryAmount: number
  recoveredAmount: number
  signedRecoveryImpact: number
}

export type WorkingCapitalDriverBases = {
  /** Period production cost, before inventory valuation. */
  costOfProductionByPeriod?: readonly number[]
  /** Period cost of goods sold after finished-goods valuation. */
  costOfSalesByPeriod?: readonly number[]
}

export type WorkingCapitalDraftSchedule = {
  valid: boolean
  issues: string[]
  componentRows: WorkingCapitalComponentPeriodRow[]
  closingWorkingCapital: number[]
  changeInWorkingCapital: number[]
  /** Signed net-working-capital movement caused by project-end recovery; assets release cash, liabilities require settlement. */
  recoveryImpactByPeriod: number[]
  openingWorkingCapital: number
}

/**
 * Convert explicit working-capital form balances into the periodic finance
 * engine's closing-balance convention. Missing values are errors, never zero.
 * Asset categories are positive; payables and other current liabilities reduce
 * net working capital. Days/turnover fields are deliberately not reverse-
 * engineered without an explicit cost/revenue valuation base.
 */
export function buildWorkingCapitalScheduleFromDrafts(
  drafts: Pick<ProjectModelFinancialFormDrafts, 'workingCapital'>,
  periods: ProjectCalendarPeriod[],
  openingWorkingCapital: number,
  salesRevenueByPeriod?: readonly number[],
  driverBases: WorkingCapitalDriverBases = {},
): WorkingCapitalDraftSchedule {
  const issues: string[] = []
  const count = periods.length
  if (!count) issues.push('At least one financial period is required.')
  if (!Number.isFinite(openingWorkingCapital) || openingWorkingCapital < 0)
    issues.push('Opening working capital must be an explicit finite non-negative amount.')

  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(value + 'T00:00:00.000Z')
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }
  periods.forEach((period, index) => {
    if (!period || !validDate(period.startDate) || !validDate(period.endDate) ||
        !Number.isInteger(period.days) || period.days <= 0) {
      issues.push('Invalid project calendar period ' + (index + 1) + '.')
      return
    }
    const start = Date.parse(period.startDate + 'T00:00:00.000Z')
    const end = Date.parse(period.endDate + 'T00:00:00.000Z')
    if (end < start || Math.round((end - start) / 86400000) + 1 !== period.days)
      issues.push('Period dates and day count do not reconcile in period ' + (index + 1) + '.')
    if (index > 0) {
      const previousEnd = Date.parse(periods[index - 1].endDate + 'T00:00:00.000Z')
      if (start !== previousEnd + 86400000)
        issues.push('Project periods must be contiguous before period ' + (index + 1) + '.')
    }
  })

  const resolvePeriod = (key: string): number[] => {
    const matches: number[] = []
    periods.forEach((period, index) => {
      const month = period.startDate.slice(0, 7)
      if (key === String(index + 1) || key === String(period.index) ||
          key === period.startDate || key === period.endDate ||
          (key.length === 7 && key === month && period.startDate.slice(0, 7) === period.endDate.slice(0, 7))) {
        matches.push(index)
      }
    })
    return matches
  }

  const rows: WorkingCapitalComponentPeriodRow[] = []
  const totals = Array(count).fill(0) as number[]
  const recoveryImpactByPeriod = Array(count).fill(0) as number[]
  const seenIds = new Set<string>()
  for (const [componentIndex, component] of drafts.workingCapital.entries()) {
    const prefix = 'working-capital-' + componentIndex + ':'
    if (!component || !component.id || seenIds.has(component.id)) {
      issues.push(prefix + 'component-id-missing-or-duplicate')
      continue
    }
    seenIds.add(component.id)
    if (!component.category) {
      issues.push(prefix + 'category-required')
      continue
    }
    if (!component.periodBalances.length) {
      issues.push(prefix + 'explicit-period-balances-required')
      continue
    }
    const daysCoverage = component.minimumDaysCoverage
    const turnover = component.turnoverCoefficient
    const hasDays = daysCoverage !== null
    const hasTurnover = turnover !== null
    if (hasDays && (!Number.isFinite(daysCoverage) || daysCoverage! <= 0))
      issues.push(prefix + 'days-coverage-must-be-positive')
    if (hasTurnover && (!Number.isFinite(turnover) || turnover! <= 0))
      issues.push(prefix + 'turnover-must-be-positive')
    const recoveryPercent=component.recoveryPercent??0
    if(!Number.isFinite(recoveryPercent)||recoveryPercent<0||recoveryPercent>100)
      issues.push(prefix+'recovery-percent-must-be-between-0-and-100')
    if (hasDays && hasTurnover && Math.abs((360 / daysCoverage!) - turnover!) > 0.01)
      issues.push(prefix + 'days-coverage-and-turnover-do-not-reconcile')
    const driverEnabled = hasDays || hasTurnover
    if (!driverEnabled && component.activityBasis)
      issues.push(prefix + 'activity-basis-requires-days-coverage-driver')
    if (!driverEnabled && component.calculationMode === 'units')
      issues.push(prefix + 'unit-mode-requires-quantity-valuation-adapter')
    let driverBase: readonly number[] | undefined
    let driverBaseKind: 'sales-revenue' | 'period-cost' | null = null
    if (driverEnabled) {
      if (component.calculationMode !== 'value')
        issues.push(prefix + 'days-coverage-requires-value-calculation-mode')
      if (component.valuationBasis === 'sales-revenue' && component.category === 'receivables' && component.activityBasis === 'sales') {
        driverBase = salesRevenueByPeriod
        driverBaseKind = 'sales-revenue'
      } else if (component.valuationBasis === 'cost-of-production' &&
        (component.category === 'inventory' || component.category === 'work-in-progress' ||
          component.category === 'finished-goods' || component.category === 'payables') &&
        component.activityBasis === 'production') {
        driverBase = driverBases.costOfProductionByPeriod
        driverBaseKind = 'period-cost'
      } else if (component.valuationBasis === 'cost-of-sales' &&
        (component.category === 'finished-goods' || component.category === 'payables') &&
        component.activityBasis === 'sales') {
        driverBase = driverBases.costOfSalesByPeriod
        driverBaseKind = 'period-cost'
      } else {
        issues.push(prefix + 'days-coverage-driver-not-supported-for-component-and-valuation-basis')
      }
      if (!driverBase || driverBase.length !== count || driverBase.some(value => !Number.isFinite(value) || value < 0))
        issues.push(prefix + (driverBaseKind === 'sales-revenue'
          ? 'valid-period-sales-revenue-base-required'
          : driverBaseKind === 'period-cost'
            ? 'valid-period-cost-base-required'
            : 'valid-period-driver-base-required'))
    }
    const deriveDriverBalance = (periodIndex: number, coverageDays: number) => {
      const base = driverBase?.[periodIndex]
      if (base === undefined) return Number.NaN
      if (driverBaseKind === 'sales-revenue') return base * coverageDays / 360
      const period = periods[periodIndex]
      if(!period)return Number.NaN
      const start = new Date(period.startDate + 'T00:00:00.000Z')
      const end = new Date(period.endDate + 'T00:00:00.000Z')
      if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)return Number.NaN
      const periodBasisDays = period.partial
        ? period.days
        : ((end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1)*30
      return Number.isFinite(periodBasisDays) && periodBasisDays > 0 ? base * coverageDays / periodBasisDays : Number.NaN
    }
    const resolved = new Map<number, number>()
    for (const balance of component.periodBalances) {
      const matches = resolvePeriod(balance.period)
      if (matches.length !== 1) {
        issues.push(prefix + (matches.length ? 'ambiguous-period-key:' : 'unknown-period-key:') + balance.period)
        continue
      }
      const periodIndex = matches[0]
      if (resolved.has(periodIndex)) {
        issues.push(prefix + 'duplicate-period-balance:' + (periodIndex + 1))
        continue
      }
      let amount = balance.amount
      const coverageDays = hasDays ? daysCoverage! : 360 / turnover!
      if (amount === null && driverEnabled) amount = deriveDriverBalance(periodIndex, coverageDays)
      if (amount === null || !Number.isFinite(amount) || amount < 0) {
        issues.push(prefix + 'missing-or-invalid-balance:' + (periodIndex + 1))
        continue
      }
      if (driverEnabled) {
        const derived = deriveDriverBalance(periodIndex, coverageDays)
        if (balance.amount !== null && Math.abs(balance.amount - derived) > 0.01)
          issues.push(prefix + 'explicit-balance-does-not-reconcile-to-days-coverage:' + (periodIndex + 1))
      }
      resolved.set(periodIndex, amount)
    }
    for (let periodIndex = 0; periodIndex < count; periodIndex++) {
      const amount = resolved.get(periodIndex)
      if (amount === undefined) {
        issues.push(prefix + 'period-balance-required:' + (periodIndex + 1))
        continue
      }
      const isLiability = component.category === 'payables' || component.category === 'other-current-liability'
      const preRecoveryAmount=amount
      const recoveredAmount=periodIndex===count-1?preRecoveryAmount*recoveryPercent/100:0
      const closingAmount=preRecoveryAmount-recoveredAmount
      const signedAmount = isLiability ? -closingAmount : closingAmount
      const signedRecoveryImpact=isLiability?recoveredAmount:-recoveredAmount
      totals[periodIndex] += signedAmount
      recoveryImpactByPeriod[periodIndex] += signedRecoveryImpact
      rows.push({
        componentId: component.id,
        category: component.category,
        period: periodIndex + 1,
        amount:closingAmount,
        signedAmount,
        preRecoveryAmount,
        recoveredAmount,
        signedRecoveryImpact,
      })
    }
  }

  if (issues.length) return {
    valid: false,
    issues,
    componentRows: [],
    closingWorkingCapital: [],
    changeInWorkingCapital: [],
    recoveryImpactByPeriod: [],
    openingWorkingCapital,
  }
  const changeInWorkingCapital = totals.map((closing, index) =>
    closing - (index === 0 ? openingWorkingCapital : totals[index - 1]))
  return {
    valid: true,
    issues: [],
    componentRows: rows,
    closingWorkingCapital: totals,
    changeInWorkingCapital,
    recoveryImpactByPeriod,
    openingWorkingCapital,
  }
}


export type PeriodicFinanceWorkingCapitalBinding = {
  valid: boolean
  issues: string[]
  financeInput: PeriodicProjectFinanceInput | null
  schedule: WorkingCapitalDraftSchedule
}

/** Bind the validated form-derived working-capital roll-forward to the sole periodic finance engine input. */
export function bindWorkingCapitalDraftsToPeriodicFinance(
  input: PeriodicProjectFinanceInput,
  drafts: Pick<ProjectModelFinancialFormDrafts, 'workingCapital'>,
  openingWorkingCapital: number,
  driverBases: WorkingCapitalDriverBases = {},
): PeriodicFinanceWorkingCapitalBinding {
  const salesRevenueByPeriod = input.periods.map(period => {
    const fiscalYear = fiscalYearIndexForPeriod(period, input.periods, input.fiscalYearStartMonth)
    return fiscalYear >= 0 && fiscalYear < input.annualRevenue.length ? input.annualRevenue[fiscalYear] : Number.NaN
  })
  const schedule = buildWorkingCapitalScheduleFromDrafts(drafts, input.periods, openingWorkingCapital, salesRevenueByPeriod, driverBases)
  if (!schedule.valid) return { valid: false, issues: schedule.issues, financeInput: null, schedule }
  return {
    valid: true,
    issues: [],
    financeInput: {
      ...input,
      workingCapitalByPeriod: schedule.closingWorkingCapital,
      openingWorkingCapital: schedule.openingWorkingCapital,
    },
    schedule,
  }
}
