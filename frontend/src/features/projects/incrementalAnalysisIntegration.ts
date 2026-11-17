import type { ProjectCalendarPeriod } from './projectFoundation'
import {
  calculatePeriodicIrr,
  calculatePeriodicNpv,
  type PeriodicProjectFinanceInput,
} from '../steel/periodicFinancialEngine'
import type { HelpDrivenProjectForms } from './projectModelHelpForms'

export type IncrementalAnalysisResult = {
  alternative: string
  view: string
  cashFlows: number[]
  npv: number
  irrPercent: number | null
  financingDeltaByPeriod: number[]
  basis: 'pre-tax-unlevered'
}

/**
 * Build an explicitly pre-tax, unlevered incremental comparison.
 * Financing deltas are reported separately and never contaminate project cash flow.
 * Tax, depreciation tax shields and working-capital effects are not inferred from
 * the sparse incremental form; users must not mistake this result for after-tax NPV.
 */
export function calculateIncrementalAnalysis(
  forms: HelpDrivenProjectForms | undefined,
  finance: PeriodicProjectFinanceInput,
): { results: IncrementalAnalysisResult[]; issues: string[] } {
  const rows = forms?.sections?.['incremental-analysis'] ?? []
  if (!rows.length) return { results: [], issues: [] }
  const issues: string[] = []
  const groups = new Map<string, typeof rows>()
  const resolvePeriod = (key: string): number => {
    const matches: number[] = []
    finance.periods.forEach((period, index) => {
      if (key === String(index + 1) || key === String(period.index) ||
          key === period.startDate || key === period.endDate ||
          (key.length === 7 && key === period.startDate.slice(0, 7) &&
            key === period.endDate.slice(0, 7))) matches.push(index)
    })
    return matches.length === 1 ? matches[0] : -1
  }
  for (const row of rows) {
    const alternative = String(row.values.alternative ?? '').trim()
    const view = String(row.values.view ?? '').trim()
    const periodKey = String(row.values.period ?? '').trim()
    const periodIndex = resolvePeriod(periodKey)
    if (!alternative || !view || periodIndex < 0) {
      issues.push('Incremental analysis row "' + row.id + '" must identify an alternative, a valid view and exactly one project period.')
      continue
    }
    for (const field of ['investmentDelta', 'financingDelta', 'revenueDelta', 'costDelta', 'assetOpportunityValue'] as const) {
      const value = row.values[field]
      if (value !== null && value !== '' && (typeof value !== 'number' || !Number.isFinite(value))) {
        issues.push('Incremental analysis row "' + row.id + '" has an invalid ' + field + '.')
      }
    }
    const key = alternative + '\u0000' + view
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  if (issues.length) return { results: [], issues }
  const discountRate = finance.discountRatePercent
  if (typeof discountRate !== 'number' || !Number.isFinite(discountRate) || discountRate <= -100) {
    return { results: [], issues: ['Incremental analysis requires a valid project discount rate.'] }
  }
  const results: IncrementalAnalysisResult[] = []
  for (const [key, group] of groups) {
    const [alternative, view] = key.split('\u0000')
    const cashFlows = finance.periods.map(() => 0)
    const financingDeltaByPeriod = finance.periods.map(() => 0)
    for (const row of group) {
      const periodIndex = resolvePeriod(String(row.values.period ?? '').trim())
      const amount = (field: string) => {
        const value = row.values[field]
        return typeof value === 'number' ? value : 0
      }
      // Positive investment, operating cost and opportunity value are incremental outflows.
      cashFlows[periodIndex] += amount('revenueDelta') - amount('costDelta') -
        amount('investmentDelta') - amount('assetOpportunityValue')
      financingDeltaByPeriod[periodIndex] += amount('financingDelta')
    }
    const npv = calculatePeriodicNpv(
      cashFlows, finance.periods, discountRate, finance.dayCountBasis,
      finance.cashFlowTiming, finance.valuationDate, finance.discountConvention,
      finance.discountPeriodsPerYear,
    )
    if (!Number.isFinite(npv)) {
      issues.push('Incremental NPV could not be calculated for alternative "' + alternative + '" (' + view + ').')
      continue
    }
    results.push({
      alternative, view, cashFlows, npv,
      irrPercent: calculatePeriodicIrr(cashFlows, finance.periods, finance.dayCountBasis, finance.cashFlowTiming),
      financingDeltaByPeriod, basis: 'pre-tax-unlevered',
    })
  }
  return { results, issues }
}
