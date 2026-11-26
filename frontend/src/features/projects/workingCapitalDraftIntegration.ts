import type { ProjectCalendarPeriod } from './projectFoundation'
import type { PeriodicProjectFinanceInput } from '../steel/periodicFinancialEngine'
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
  /** Signed net working-capital balance released or settled in the terminal project period. */
  terminalRecoveryAmount: number
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
  recoverTerminalWorkingCapital = true,
): WorkingCapitalDraftSchedule {
  const issues: string[] = []
  const count = periods.length
  if (!count) issues.push('At least one financial period is required.')
  if (!Number.isFinite(openingWorkingCapital))
    issues.push('Opening net working capital must be an explicit finite amount; negative balances are permitted when current liabilities exceed current assets.')

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
      if (balance.amount === null || !Number.isFinite(balance.amount) || balance.amount < 0) {
        issues.push(prefix + 'missing-or-invalid-balance:' + (periodIndex + 1))
        continue
      }
      resolved.set(periodIndex, balance.amount)
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
    terminalRecoveryAmount: 0,
  }
  const closingWorkingCapital = [...totals]
  const terminalRecoveryAmount = recoverTerminalWorkingCapital && count ? closingWorkingCapital[count - 1] : 0
  if (recoverTerminalWorkingCapital && count) closingWorkingCapital[count - 1] = 0
  const changeInWorkingCapital = closingWorkingCapital.map((closing, index) =>
    closing - (index === 0 ? openingWorkingCapital : closingWorkingCapital[index - 1]))
  return {
    valid: true,
    issues: [],
    componentRows: rows,
    closingWorkingCapital,
    changeInWorkingCapital,
    openingWorkingCapital,
    terminalRecoveryAmount,
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
  recoverTerminalWorkingCapital = true,
): PeriodicFinanceWorkingCapitalBinding {
  const schedule = buildWorkingCapitalScheduleFromDrafts(drafts, input.periods, openingWorkingCapital, recoverTerminalWorkingCapital)
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
