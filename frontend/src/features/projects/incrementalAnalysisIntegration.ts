import {
  calculateIntegratedPeriodicFinance,
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
  taxDeltaByPeriod: number[]
  workingCapitalDeltaByPeriod: number[]
  basis: 'after-tax-unlevered'
}

/**
 * Compare an alternative against the supplied base case by running both through
 * the same tax engine. Financing deltas remain separately disclosed and are never
 * included in project cash flow. Depreciation and working-capital changes must be
 * entered explicitly; no asset lives or WC movements are guessed here.
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
  const fields = [
    'investmentDelta','financingDelta','revenueDelta','costDelta','assetOpportunityValue',
    'depreciationDelta','workingCapitalDelta','maintenanceCapexDelta','preOperatingCostDelta',
  ] as const
  for (const row of rows) {
    const alternative = String(row.values.alternative ?? '').trim()
    const view = String(row.values.view ?? '').trim()
    const periodKey = String(row.values.period ?? '').trim()
    const periodIndex = resolvePeriod(periodKey)
    if (!alternative || !view || periodIndex < 0) {
      issues.push('Incremental analysis row "' + row.id + '" must identify an alternative, a valid view and exactly one project period.')
      continue
    }
    for (const field of fields) {
      const value = row.values[field]
      if (value !== null && value !== '' && (typeof value !== 'number' || !Number.isFinite(value))) {
        issues.push('Incremental analysis row "' + row.id + '" has an invalid ' + field + '.')
      }
    }
    for (const field of ['investmentDelta','assetOpportunityValue','depreciationDelta','maintenanceCapexDelta','preOperatingCostDelta'] as const) {
      const value = row.values[field]
      if (typeof value === 'number' && value < 0) issues.push('Incremental analysis row "' + row.id + '" requires non-negative ' + field + '.')
    }
    const key = alternative + '\u0000' + view
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  if (issues.length) return { results: [], issues }
  const discountRate = finance.discountRatePercent
  if (typeof discountRate !== 'number' || !Number.isFinite(discountRate) || discountRate <= -100) {
    return { results: [], issues: ['Incremental analysis requires a valid project discount rate.'] }
  }
  const baseInput: PeriodicProjectFinanceInput = {
    ...finance,
    // Project cash flow and unlevered tax are independent of debt/equity funding.
    loans: [],
    precomputedLoanSchedules: undefined,
    annualEquityContributions: finance.periods.map(() => 0),
    annualEquityWorkingCapitalContributions: undefined,
  }
  const baseRun = calculateIntegratedPeriodicFinance(baseInput)
  if (!baseRun.valid) return { results: [], issues: ['Incremental analysis base-case tax and cash-flow calculation failed: ' + baseRun.warnings.join(' ')] }
  const results: IncrementalAnalysisResult[] = []
  for (const [key, group] of groups) {
    const [alternative, view] = key.split('\u0000')
    const scenario: PeriodicProjectFinanceInput = {
      ...baseInput,
      annualRevenue: [...baseInput.annualRevenue],
      annualVariableCost: [...baseInput.annualVariableCost],
      annualFixedCost: [...baseInput.annualFixedCost],
      annualDepreciation: [...baseInput.annualDepreciation],
      annualFixedInvestment: [...baseInput.annualFixedInvestment],
      annualPreOperatingCost: [...baseInput.annualPreOperatingCost],
      annualMaintenanceCapex: [...baseInput.annualMaintenanceCapex],
      workingCapitalByPeriod: [...baseInput.workingCapitalByPeriod],
      taxAllowancesByPeriod: baseInput.taxAllowancesByPeriod ? [...baseInput.taxAllowancesByPeriod] : undefined,
      taxDepreciationAdjustmentsByPeriod: baseInput.taxDepreciationAdjustmentsByPeriod ? [...baseInput.taxDepreciationAdjustmentsByPeriod] : undefined,
    }
    const financingDeltaByPeriod = finance.periods.map(() => 0)
    const workingCapitalDeltaByPeriod = finance.periods.map(() => 0)
    for (const row of group) {
      const periodIndex = resolvePeriod(String(row.values.period ?? '').trim())
      const amount = (field: typeof fields[number]) => typeof row.values[field] === 'number' ? row.values[field] as number : 0
      scenario.annualRevenue[periodIndex] += amount('revenueDelta')
      scenario.annualFixedCost[periodIndex] += amount('costDelta')
      scenario.annualFixedInvestment[periodIndex] += amount('investmentDelta') + amount('assetOpportunityValue')
      scenario.annualDepreciation[periodIndex] += amount('depreciationDelta')
      scenario.annualMaintenanceCapex[periodIndex] += amount('maintenanceCapexDelta')
      scenario.annualPreOperatingCost[periodIndex] += amount('preOperatingCostDelta')
      workingCapitalDeltaByPeriod[periodIndex] += amount('workingCapitalDelta')
      financingDeltaByPeriod[periodIndex] += amount('financingDelta')
    }
    scenario.workingCapitalByPeriod = scenario.workingCapitalByPeriod.map((value,index)=>value+workingCapitalDeltaByPeriod[index])
    if (scenario.workingCapitalByPeriod.some(value=>!Number.isFinite(value)||value<0)) {
      issues.push('Incremental alternative "' + alternative + '" (' + view + ') produces a negative or invalid closing working-capital balance.')
      continue
    }
    const scenarioRun = calculateIntegratedPeriodicFinance(scenario)
    if (!scenarioRun.valid) {
      issues.push('Incremental alternative "' + alternative + '" (' + view + ') tax and cash-flow calculation failed: ' + scenarioRun.warnings.join(' '))
      continue
    }
    const cashFlows = scenarioRun.rows.map((row,index)=>row.projectFreeCashFlow-baseRun.rows[index].projectFreeCashFlow)
    const taxDeltaByPeriod = scenarioRun.rows.map((row,index)=>row.unleveredTax-baseRun.rows[index].unleveredTax)
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
      financingDeltaByPeriod, taxDeltaByPeriod, workingCapitalDeltaByPeriod,
      basis: 'after-tax-unlevered',
    })
  }
  return { results, issues }
}
