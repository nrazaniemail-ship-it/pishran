import type { ProjectCalendarPeriod } from './projectFoundation'
import { fiscalYearIndexForPeriod, type PeriodicProjectFinanceInput } from '../steel/periodicFinancialEngine'
import type { ProjectModelFinancialFormDrafts, WorkingCapitalComponentFormDraft } from './projectModelFormDrafts'

export type WorkingCapitalComponentPeriodRow = {
  componentId: string
  category: NonNullable<WorkingCapitalComponentFormDraft['category']>
  period: number
  amount: number
  signedAmount: number
}

export type WorkingCapitalDraftSchedule = {
  valid: boolean
  issues: string[]
  componentRows: WorkingCapitalComponentPeriodRow[]
  closingWorkingCapital: number[]
  changeInWorkingCapital: number[]
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
    if (hasDays && hasTurnover && Math.abs((360 / daysCoverage!) - turnover!) > 0.01)
      issues.push(prefix + 'days-coverage-and-turnover-do-not-reconcile')
    const driverEnabled = hasDays || hasTurnover
    if (driverEnabled) {
      if (component.calculationMode !== 'value')
        issues.push(prefix + 'days-coverage-requires-value-calculation-mode')
      if (component.activityBasis !== 'sales')
        issues.push(prefix + 'current-period-production-activity-basis-is-not-supported-for-days-coverage')
      if (component.valuationBasis !== 'sales-revenue' || component.category !== 'receivables')
        issues.push(prefix + 'days-coverage-currently-supports-sales-revenue-receivables-only')
      if (!salesRevenueByPeriod || salesRevenueByPeriod.length !== count ||
          salesRevenueByPeriod.some(value => !Number.isFinite(value) || value < 0))
        issues.push(prefix + 'valid-period-sales-revenue-base-required')
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
      if (amount === null && driverEnabled && salesRevenueByPeriod) {
        const days = hasDays ? daysCoverage! : 360 / turnover!
        amount = salesRevenueByPeriod[periodIndex] * days / 360
      }
      if (amount === null || !Number.isFinite(amount) || amount < 0) {
        issues.push(prefix + 'missing-or-invalid-balance:' + (periodIndex + 1))
        continue
      }
      if (driverEnabled && salesRevenueByPeriod) {
        const days = hasDays ? daysCoverage! : 360 / turnover!
        const derived = salesRevenueByPeriod[periodIndex] * days / 360
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
      const signedAmount = isLiability ? -amount : amount
      totals[periodIndex] += signedAmount
      rows.push({
        componentId: component.id,
        category: component.category,
        period: periodIndex + 1,
        amount,
        signedAmount,
      })
    }
  }

  if (issues.length) return {
    valid: false,
    issues,
    componentRows: [],
    closingWorkingCapital: [],
    changeInWorkingCapital: [],
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
): PeriodicFinanceWorkingCapitalBinding {
  const salesRevenueByPeriod = input.periods.map(period => {
    const fiscalYear = fiscalYearIndexForPeriod(period, input.periods, input.fiscalYearStartMonth)
    return fiscalYear >= 0 && fiscalYear < input.annualRevenue.length ? input.annualRevenue[fiscalYear] : Number.NaN
  })
  const schedule = buildWorkingCapitalScheduleFromDrafts(drafts, input.periods, openingWorkingCapital, salesRevenueByPeriod)
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
