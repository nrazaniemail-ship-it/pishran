import type { ProjectCalendarPeriod } from '../projects/projectFoundation'

export type PeriodCashFlowTiming = 'period-end' | 'mid-period'
export type PeriodTaxResult = {
  taxableProfitAfterLoss: number
  tax: number
  closingLossCarryForward: number
}

function validFinite(value: number): boolean {
  return Number.isFinite(value)
}

/** Convert an effective annual rate to an effective rate for an actual period length. */
export function annualEffectiveRateToPeriodRate(
  annualRatePercent: number,
  periodDays: number,
  dayCountBasis: 360 | 365,
): number {
  if (!validFinite(annualRatePercent) || annualRatePercent <= -100 ||
      !Number.isInteger(periodDays) || periodDays <= 0 ||
      (dayCountBasis !== 360 && dayCountBasis !== 365)) return Number.NaN
  return (Math.pow(1 + annualRatePercent / 100, periodDays / dayCountBasis) - 1) * 100
}

/** Allocate an annual flow to a period using the selected day-count convention. */
export function prorateAnnualFlowByDays(
  annualAmount: number,
  periodDays: number,
  dayCountBasis: 360 | 365,
): number {
  if (!validFinite(annualAmount) || !Number.isInteger(periodDays) || periodDays <= 0 ||
      (dayCountBasis !== 360 && dayCountBasis !== 365)) return Number.NaN
  return annualAmount * periodDays / dayCountBasis
}

/** Apply tax-loss carry-forward to one financial period without allowing negative tax. */
export function calculatePeriodTax(
  taxableProfitBeforeLoss: number,
  taxRatePercent: number,
  openingLossCarryForward = 0,
): PeriodTaxResult {
  if (![taxableProfitBeforeLoss, taxRatePercent, openingLossCarryForward].every(validFinite) ||
      taxRatePercent < 0 || taxRatePercent > 100 || openingLossCarryForward < 0) {
    return {
      taxableProfitAfterLoss: Number.NaN,
      tax: Number.NaN,
      closingLossCarryForward: Number.NaN,
    }
  }
  const taxableProfitAfterLoss = taxableProfitBeforeLoss - openingLossCarryForward
  const tax = Math.max(0, taxableProfitAfterLoss) * taxRatePercent / 100
  const closingLossCarryForward = taxableProfitAfterLoss < 0
    ? -taxableProfitAfterLoss
    : 0
  return { taxableProfitAfterLoss, tax, closingLossCarryForward }
}

/**
 * Discount period cash flows using an effective annual rate and actual elapsed days.
 * The first period begins at t=0; mid-period timing discounts at the period midpoint.
 */
export function calculatePeriodicNpv(
  cashFlows: number[],
  periods: ProjectCalendarPeriod[],
  annualDiscountRatePercent: number,
  dayCountBasis: 360 | 365,
  timing: PeriodCashFlowTiming = 'period-end',
): number {
  if (cashFlows.length !== periods.length || cashFlows.some(value => !validFinite(value)) ||
      !validFinite(annualDiscountRatePercent) || annualDiscountRatePercent <= -100 ||
      (dayCountBasis !== 360 && dayCountBasis !== 365) ||
      (timing !== 'period-end' && timing !== 'mid-period') ||
      periods.some(period => !Number.isInteger(period.days) || period.days <= 0)) return Number.NaN
  let elapsedDays = 0
  let npv = 0
  for (let index = 0; index < periods.length; index++) {
    const period = periods[index]
    const discountDays = elapsedDays + (timing === 'mid-period' ? period.days / 2 : period.days)
    const exponent = discountDays / dayCountBasis
    npv += cashFlows[index] / Math.pow(1 + annualDiscountRatePercent / 100, exponent)
    elapsedDays += period.days
  }
  return npv
}


function parseIsoDateUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null
}

function dateOnlyUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function fiscalYearStartFor(date: Date, fiscalYearStartMonth: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const startYear = month >= fiscalYearStartMonth ? year : year - 1
  return new Date(Date.UTC(startYear, fiscalYearStartMonth - 1, 1))
}

/**
 * Allocates full-year forecast amounts into project periods using actual overlap days
 * within each fiscal year. annualAmounts[0] belongs to the fiscal year containing
 * periods[0]. Partial first/last fiscal years are prorated; leap years use 366 days.
 */
export function allocateAnnualFlowsToPeriods(
  annualAmounts: number[],
  periods: ProjectCalendarPeriod[],
  fiscalYearStartMonth: number,
): number[] {
  if (!annualAmounts.length || annualAmounts.some(value => !validFinite(value)) ||
      !periods.length || !Number.isInteger(fiscalYearStartMonth) ||
      fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) return []
  const starts = periods.map(period => parseIsoDateUtc(period.startDate))
  const ends = periods.map(period => parseIsoDateUtc(period.endDate))
  if (starts.some(date => !date) || ends.some(date => !date) ||
      periods.some((period, index) => !Number.isInteger(period.days) || period.days <= 0 ||
        (ends[index] as Date).getTime() < (starts[index] as Date).getTime() ||
        Math.round(((ends[index] as Date).getTime() - (starts[index] as Date).getTime()) / 86400000) + 1 !== period.days)) return []
  for (let index = 1; index < periods.length; index++) {
    if ((starts[index] as Date).getTime() !== (ends[index - 1] as Date).getTime() + 86400000) return []
  }
  const firstFiscalStart = fiscalYearStartFor(starts[0] as Date, fiscalYearStartMonth)
  return periods.map((period, index) => {
    let cursor = starts[index] as Date
    const periodEnd = ends[index] as Date
    let allocated = 0
    while (cursor.getTime() <= periodEnd.getTime()) {
      const fiscalStart = fiscalYearStartFor(cursor, fiscalYearStartMonth)
      const nextFiscalStart = new Date(Date.UTC(fiscalStart.getUTCFullYear() + (fiscalYearStartMonth === 1 ? 1 : 1), fiscalYearStartMonth - 1, 1))
      const segmentEnd = new Date(Math.min(periodEnd.getTime(), nextFiscalStart.getTime() - 86400000))
      const fiscalIndex = fiscalStart.getUTCFullYear() - firstFiscalStart.getUTCFullYear()
      if (fiscalIndex < 0 || fiscalIndex >= annualAmounts.length) return Number.NaN
      const fiscalDays = Math.round((nextFiscalStart.getTime() - fiscalStart.getTime()) / 86400000)
      const segmentDays = Math.round((segmentEnd.getTime() - cursor.getTime()) / 86400000) + 1
      allocated += annualAmounts[fiscalIndex] * segmentDays / fiscalDays
      cursor = new Date(segmentEnd.getTime() + 86400000)
    }
    return allocated
  })
}

export type PeriodicLoanInput = {
  annualRatePercent: number
  drawdowns: number[]
  repaymentMethod: 'equal-principal' | 'annuity' | 'bullet'
  repaymentStartPeriod: number
  gracePeriods: number
  termPeriods: number
  capitalizeInterest: boolean
  rateConversion?: 'effective-annual-by-actual-days' | 'effective-annual-divided-by-frequency'
  periodsPerYear?: 1 | 2 | 4 | 12
}

export type PeriodicLoanRow = {
  period: number
  drawdown: number
  openingBalance: number
  periodRatePercent: number
  interestExpense: number
  capitalizedInterest: number
  principal: number
  closingBalance: number
  debtService: number
}

export type PeriodicLoanScheduleResult = {
  rows: PeriodicLoanRow[]
  valid: boolean
  issues: string[]
}

/** Build a period-by-period loan schedule from actual period lengths and staged drawdowns. */
export function calculatePeriodicLoanSchedule(
  input: PeriodicLoanInput,
  periods: ProjectCalendarPeriod[],
  dayCountBasis: 360 | 365,
): PeriodicLoanScheduleResult {
  const issues: string[] = []
  const firstPrincipalIndex = input.repaymentStartPeriod - 1 + input.gracePeriods
  if (!periods.length || input.drawdowns.length !== periods.length)
    issues.push('Drawdown schedule must contain one amount for every financial period.')
  if (!validFinite(input.annualRatePercent) || input.annualRatePercent < 0)
    issues.push('Annual loan interest rate must be a finite non-negative percentage.')
  if (dayCountBasis !== 360 && dayCountBasis !== 365)
    issues.push('Day-count basis must be 360 or 365.')
  if (!Number.isInteger(input.repaymentStartPeriod) || input.repaymentStartPeriod < 1 ||
      !Number.isInteger(input.gracePeriods) || input.gracePeriods < 0 ||
      !Number.isInteger(input.termPeriods) || input.termPeriods < 1 ||
      !Number.isInteger(firstPrincipalIndex) ||
      firstPrincipalIndex < 0 || firstPrincipalIndex + input.termPeriods > periods.length)
    issues.push('Repayment start, grace period and loan term exceed the available project periods.')
  if (!['equal-principal', 'annuity', 'bullet'].includes(input.repaymentMethod))
    issues.push('Unsupported periodic repayment method.')
  if (typeof input.capitalizeInterest !== 'boolean')
    issues.push('Capitalized-interest option must be explicitly true or false.')
  const rateConversion = input.rateConversion ?? 'effective-annual-by-actual-days'
  if (!['effective-annual-by-actual-days', 'effective-annual-divided-by-frequency'].includes(rateConversion))
    issues.push('Unsupported period interest-rate conversion convention.')
  if (rateConversion === 'effective-annual-divided-by-frequency' &&
      ![1, 2, 4, 12].includes(input.periodsPerYear ?? 0))
    issues.push('Frequency-based rate conversion requires 1, 2, 4 or 12 periods per year.')
  if (input.drawdowns.some(value => !validFinite(value) || value < 0))
    issues.push('Every period drawdown must be finite and non-negative.')
  if (input.drawdowns.slice(Math.max(0, firstPrincipalIndex)).some(value => value > 0))
    issues.push('Loan drawdowns after principal repayment begins are not supported in this schedule.')
  const dates = periods.map(period => ({
    start: parseIsoDateUtc(period.startDate),
    end: parseIsoDateUtc(period.endDate),
  }))
  if (dates.some(({ start, end }, index) => !start || !end ||
      !Number.isInteger(periods[index].days) || periods[index].days <= 0 ||
      (end as Date).getTime() < (start as Date).getTime() ||
      Math.round(((end as Date).getTime() - (start as Date).getTime()) / 86400000) + 1 !== periods[index].days))
    issues.push('Financial periods must have valid inclusive dates and matching day counts.')
  for (let index = 1; index < dates.length; index++) {
    if ((dates[index].start as Date).getTime() !== (dates[index - 1].end as Date).getTime() + 86400000)
      issues.push('Financial periods must be contiguous and non-overlapping.')
  }
  if (issues.length) return { rows: [], valid: false, issues }

  const periodRates = periods.map(period => {
    if (rateConversion === 'effective-annual-divided-by-frequency') {
      const periodsPerYear = input.periodsPerYear as 1 | 2 | 4 | 12
      const fullPeriodRate = input.annualRatePercent / periodsPerYear
      const partialFactor = period.partial ? period.days / (dayCountBasis / periodsPerYear) : 1
      return fullPeriodRate * partialFactor / 100
    }
    return annualEffectiveRateToPeriodRate(input.annualRatePercent, period.days, dayCountBasis) / 100
  })
  let balance = 0
  let annuityPayment: number | null = null
  let equalPrincipalAmount: number | null = null
  const rows: PeriodicLoanRow[] = []
  for (let index = 0; index < periods.length; index++) {
    const drawdown = input.drawdowns[index]
    const openingBalance = balance
    const interestBase = openingBalance + drawdown * 0.5
    const interestAccrued = interestBase * periodRates[index]
    const beforePrincipal = index < firstPrincipalIndex
    const capitalizedInterest = beforePrincipal && input.capitalizeInterest ? interestAccrued : 0
    const interestExpense = capitalizedInterest > 0 ? 0 : interestAccrued
    const availableBalance = openingBalance + drawdown + capitalizedInterest
    let principal = 0
    const repaymentIndex = index - firstPrincipalIndex
    if (repaymentIndex >= 0 && repaymentIndex < input.termPeriods) {
      if (input.repaymentMethod === 'bullet') {
        principal = repaymentIndex === input.termPeriods - 1 ? availableBalance : 0
      } else if (input.repaymentMethod === 'equal-principal') {
        if (equalPrincipalAmount === null) equalPrincipalAmount = availableBalance / input.termPeriods
        principal = repaymentIndex === input.termPeriods - 1
          ? availableBalance
          : Math.min(availableBalance, equalPrincipalAmount)
      } else {
        if (annuityPayment === null) {
          let discountFactor = 1
          let paymentFactor = 0
          for (let future = firstPrincipalIndex; future < firstPrincipalIndex + input.termPeriods; future++) {
            discountFactor *= 1 + periodRates[future]
            paymentFactor += 1 / discountFactor
          }
          annuityPayment = paymentFactor > 0 ? availableBalance / paymentFactor : availableBalance / input.termPeriods
        }
        principal = repaymentIndex === input.termPeriods - 1
          ? availableBalance
          : Math.min(availableBalance, Math.max(0, annuityPayment - interestAccrued))
      }
    }
    balance = Math.max(0, availableBalance - principal)
    rows.push({
      period: index + 1,
      drawdown,
      openingBalance,
      periodRatePercent: periodRates[index] * 100,
      interestExpense,
      capitalizedInterest,
      principal,
      closingBalance: balance,
      debtService: interestExpense + principal,
    })
  }
  return { rows, valid: true, issues: [] }
}


export type PeriodicProjectLoan = {
  id: string
  input: PeriodicLoanInput
}
export type PeriodicProjectFinanceInput = {
  periods: ProjectCalendarPeriod[]
  fiscalYearStartMonth: number
  dayCountBasis: 360 | 365
  cashFlowTiming: PeriodCashFlowTiming
  annualRevenue: number[]
  annualVariableCost: number[]
  annualFixedCost: number[]
  annualDepreciation: number[]
  annualFixedInvestment: number[]
  annualPreOperatingCost: number[]
  annualMaintenanceCapex: number[]
  annualTaxRates: number[]
  taxRatesByPeriod?: number[]
  annualEquityContributions: number[]
  workingCapitalByPeriod: number[]
  openingWorkingCapital?: number
  openingTaxLoss?: number
  openingUnleveredTaxLoss?: number
  loans: PeriodicProjectLoan[]
  discountRatePercent?: number | null
  mirrFinanceRatePercent?: number | null
  mirrReinvestmentRatePercent?: number | null
  salvageValue?: number
}
export type PeriodicProjectFinanceRow = {
  period: number
  startDate: string
  endDate: string
  days: number
  revenue: number
  variableCost: number
  fixedCost: number
  depreciation: number
  ebit: number
  interestExpense: number
  capitalizedInterest: number
  principal: number
  debtDrawdown: number
  debtService: number
  taxRatePercent: number
  tax: number
  unleveredTax: number
  taxLossCarryForward: number
  fixedInvestment: number
  preOperatingCost: number
  maintenanceCapex: number
  closingWorkingCapital: number
  changeInWorkingCapital: number
  equityContribution: number
  salvageValue: number
  cfads: number
  dscr: number | null
  projectFreeCashFlow: number
  equityFreeCashFlow: number
}
export type PeriodicProjectFinanceResult = {
  valid: boolean
  rows: PeriodicProjectFinanceRow[]
  loanSchedules: Record<string, PeriodicLoanRow[]>
  npvProject: number | null
  irrProject: number | null
  mirrProject: number | null
  npvEquity: number | null
  irrEquity: number | null
  mirrEquity: number | null
  totalDebtDrawdown: number
  totalEquityContribution: number
  totalCapitalizedInterest: number
  peakWorkingCapital: number
  warnings: string[]
}

export function fiscalYearIndexForPeriod(period: ProjectCalendarPeriod, periods: ProjectCalendarPeriod[], fiscalYearStartMonth: number): number {
  const first = parseIsoDateUtc(periods[0]?.startDate ?? '')
  const current = parseIsoDateUtc(period.startDate)
  if (!first || !current || !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) return -1
  return fiscalYearStartFor(current, fiscalYearStartMonth).getUTCFullYear()
    - fiscalYearStartFor(first, fiscalYearStartMonth).getUTCFullYear()
}

/** Annual effective IRR expressed as a percentage, discounted on actual period dates. */
export function calculatePeriodicIrr(
  cashFlows: number[],
  periods: ProjectCalendarPeriod[],
  dayCountBasis: 360 | 365,
  timing: PeriodCashFlowTiming = 'period-end',
): number | null {
  if (cashFlows.length !== periods.length || !cashFlows.length ||
      !cashFlows.some(value => value < 0) || !cashFlows.some(value => value > 0)) return null
  const npvAt = (rate: number) => calculatePeriodicNpv(cashFlows, periods, rate, dayCountBasis, timing)
  let low = -99.999999
  let high = 100
  let lowValue = npvAt(low)
  let highValue = npvAt(high)
  while (Number.isFinite(lowValue) && Number.isFinite(highValue) &&
      lowValue * highValue > 0 && high < 100000000) {
    high = high * 2 + 100
    highValue = npvAt(high)
  }
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return null
  for (let iteration = 0; iteration < 240; iteration++) {
    const mid = (low + high) / 2
    const value = npvAt(mid)
    if (!Number.isFinite(value)) return null
    if (Math.abs(value) < 1e-8) return mid
    if (lowValue * value <= 0) {
      high = mid
      highValue = value
    } else {
      low = mid
      lowValue = value
    }
  }
  return (low + high) / 2
}

/** Period-aware MIRR using actual elapsed days and annual effective finance/reinvestment rates. */
export function calculatePeriodicMirr(
  cashFlows: number[],
  periods: ProjectCalendarPeriod[],
  financeRatePercent: number,
  reinvestmentRatePercent: number,
  dayCountBasis: 360 | 365,
  timing: PeriodCashFlowTiming = 'period-end',
): number | null {
  if (cashFlows.length !== periods.length || !cashFlows.length ||
      !validFinite(financeRatePercent) || !validFinite(reinvestmentRatePercent) ||
      financeRatePercent <= -100 || reinvestmentRatePercent <= -100) return null
  const totalDays = periods.reduce((sum, period) => sum + period.days, 0)
  if (!Number.isFinite(totalDays) || totalDays <= 0) return null
  let elapsedDays = 0
  let presentValueNegative = 0
  let futureValuePositive = 0
  for (let index = 0; index < cashFlows.length; index++) {
    const period = periods[index]
    const timingDays = elapsedDays + (timing === 'mid-period' ? period.days / 2 : period.days)
    const value = cashFlows[index]
    if (value < 0) presentValueNegative += value / Math.pow(1 + financeRatePercent / 100, timingDays / dayCountBasis)
    if (value > 0) futureValuePositive += value * Math.pow(1 + reinvestmentRatePercent / 100, (totalDays - timingDays) / dayCountBasis)
    elapsedDays += period.days
  }
  if (presentValueNegative >= 0 || futureValuePositive <= 0) return null
  return (Math.pow(futureValuePositive / -presentValueNegative, dayCountBasis / totalDays) - 1) * 100
}

/**
 * Integrated period-by-period project, debt, tax and cash-flow calculation.
 * Annual operating assumptions are allocated to actual project periods by fiscal-year
 * overlap days; working-capital inputs are closing balance targets for each period.
 */
export function calculateIntegratedPeriodicFinance(input: PeriodicProjectFinanceInput): PeriodicProjectFinanceResult {
  const warnings: string[] = []
  const { periods, fiscalYearStartMonth, dayCountBasis, cashFlowTiming } = input
  const empty = (): PeriodicProjectFinanceResult => ({
    valid: false, rows: [], loanSchedules: {}, npvProject: null, irrProject: null, mirrProject: null,
    npvEquity: null, irrEquity: null, mirrEquity: null, totalDebtDrawdown: 0,
    totalEquityContribution: 0, totalCapitalizedInterest: 0, peakWorkingCapital: 0, warnings
  })
  if (!periods.length || (dayCountBasis !== 360 && dayCountBasis !== 365) ||
      !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 ||
      !['period-end','mid-period'].includes(cashFlowTiming)) {
    warnings.push('Project periods, fiscal-year start month, day-count basis or cash-flow timing are invalid.')
    return empty()
  }
  const annualSeries = [
    input.annualRevenue, input.annualVariableCost, input.annualFixedCost, input.annualDepreciation,
    input.annualFixedInvestment, input.annualPreOperatingCost, input.annualMaintenanceCapex,
    input.annualTaxRates, input.annualEquityContributions,
  ]
  if (annualSeries.some(series => !Array.isArray(series) || !series.length || series.some(value => !validFinite(value))) ||
      annualSeries.slice(0,7).some(series => series.some(value => value < 0)) ||
      input.annualTaxRates.some(value => value < 0 || value > 100) ||
      !Array.isArray(input.workingCapitalByPeriod) || input.workingCapitalByPeriod.length !== periods.length ||
      input.workingCapitalByPeriod.some(value => !validFinite(value) || value < 0) ||
      input.loans.some(loan => !loan.id || !loan.input)) {
    warnings.push('Annual flow arrays, tax rates, working-capital balances or loan definitions are invalid.')
    return empty()
  }
  if (input.taxRatesByPeriod && (input.taxRatesByPeriod.length !== periods.length ||
      input.taxRatesByPeriod.some(rate => !validFinite(rate) || rate < 0 || rate > 100))) {
    warnings.push('Period-specific tax-rate schedule must contain one rate from 0% to 100% for every project period.')
    return empty()
  }
  const allocated = annualSeries.map(series => allocateAnnualFlowsToPeriods(series, periods, fiscalYearStartMonth))
  if (allocated.some(series => series.length !== periods.length || series.some(value => !validFinite(value)))) {
    warnings.push('Annual model horizon does not cover every project fiscal period; annual flows cannot be allocated.')
    return empty()
  }
  const [revenue, variableCost, fixedCost, depreciation, fixedInvestment, preOperatingCost, maintenanceCapex, , equityContribution] = allocated
  const taxRates = input.taxRatesByPeriod ? [...input.taxRatesByPeriod] : periods.map(period => {
    const index = fiscalYearIndexForPeriod(period, periods, fiscalYearStartMonth)
    return index >= 0 ? input.annualTaxRates[index] : Number.NaN
  })
  if (taxRates.some(rate => !validFinite(rate))) {
    warnings.push('Annual tax-rate schedule does not cover every project fiscal period.')
    return empty()
  }
  const loanSchedules: Record<string, PeriodicLoanRow[]> = {}
  for (const loan of input.loans) {
    const schedule = calculatePeriodicLoanSchedule(loan.input, periods, dayCountBasis)
    if (!schedule.valid) {
      warnings.push(...schedule.issues.map(issue => loan.id + ': ' + issue))
      return empty()
    }
    loanSchedules[loan.id] = schedule.rows
  }
  if (input.annualEquityContributions.some(value => value < 0) ||
      !validFinite(input.openingWorkingCapital ?? 0) || (input.openingWorkingCapital ?? 0) < 0 ||
      !validFinite(input.salvageValue ?? 0) || (input.salvageValue ?? 0) < 0 ||
      (input.discountRatePercent != null && (!validFinite(input.discountRatePercent) || input.discountRatePercent <= -100)) ||
      (input.mirrFinanceRatePercent != null && (!validFinite(input.mirrFinanceRatePercent) || input.mirrFinanceRatePercent <= -100)) ||
      (input.mirrReinvestmentRatePercent != null && (!validFinite(input.mirrReinvestmentRatePercent) || input.mirrReinvestmentRatePercent <= -100)) ||
      new Set(input.loans.map(loan => loan.id)).size !== input.loans.length) {
    warnings.push('Equity, opening working capital, salvage, discount rates or loan identifiers are invalid.')
    return empty()
  }
  const openingLoss = input.openingTaxLoss ?? 0
  const openingUnleveredLoss = input.openingUnleveredTaxLoss ?? 0
  if (!validFinite(openingLoss) || openingLoss < 0 || !validFinite(openingUnleveredLoss) || openingUnleveredLoss < 0) {
    warnings.push('Opening tax-loss balances must be finite and non-negative.')
    return empty()
  }
  const rows: PeriodicProjectFinanceRow[] = []
  let taxLoss = openingLoss
  let unleveredTaxLoss = openingUnleveredLoss
  let priorWorkingCapital = Math.max(0, input.openingWorkingCapital ?? 0)
  for (let index = 0; index < periods.length; index++) {
    const loanRows = Object.values(loanSchedules).map(schedule => schedule[index])
    const interestExpense = loanRows.reduce((sum,row)=>sum+row.interestExpense,0)
    const capitalizedInterest = loanRows.reduce((sum,row)=>sum+row.capitalizedInterest,0)
    const principal = loanRows.reduce((sum,row)=>sum+row.principal,0)
    const debtDrawdown = loanRows.reduce((sum,row)=>sum+row.drawdown,0)
    const ebit = revenue[index] - variableCost[index] - fixedCost[index] - depreciation[index]
    const periodTax = calculatePeriodTax(ebit - interestExpense, taxRates[index], taxLoss)
    const unleveredPeriodTax = calculatePeriodTax(ebit, taxRates[index], unleveredTaxLoss)
    if (![periodTax.tax,unleveredPeriodTax.tax].every(validFinite)) {
      warnings.push('Tax calculation failed in project period ' + (index + 1) + '.')
      return empty()
    }
    taxLoss = periodTax.closingLossCarryForward
    unleveredTaxLoss = unleveredPeriodTax.closingLossCarryForward
    const closingWorkingCapital = input.workingCapitalByPeriod[index]
    const changeInWorkingCapital = closingWorkingCapital - priorWorkingCapital
    const terminalSalvage = index === periods.length - 1 ? Math.max(0,input.salvageValue ?? 0) : 0
    const cfads = revenue[index] - variableCost[index] - fixedCost[index] - periodTax.tax
      - maintenanceCapex[index] - changeInWorkingCapital
    const debtService = interestExpense + principal
    const dscr = debtService > 0 ? cfads / debtService : null
    const projectFreeCashFlow = ebit - unleveredPeriodTax.tax + depreciation[index]
      - fixedInvestment[index] - preOperatingCost[index] - maintenanceCapex[index]
      - changeInWorkingCapital + terminalSalvage
    const equityFreeCashFlow = -equityContribution[index] + revenue[index] - variableCost[index] - fixedCost[index]
      - periodTax.tax - interestExpense - principal - maintenanceCapex[index]
      - changeInWorkingCapital + terminalSalvage
    rows.push({
      period:index+1,startDate:periods[index].startDate,endDate:periods[index].endDate,days:periods[index].days,
      revenue:revenue[index],variableCost:variableCost[index],fixedCost:fixedCost[index],depreciation:depreciation[index],ebit,
      interestExpense,capitalizedInterest,principal,debtDrawdown,debtService,taxRatePercent:taxRates[index],
      tax:periodTax.tax,unleveredTax:unleveredPeriodTax.tax,taxLossCarryForward:taxLoss,
      fixedInvestment:fixedInvestment[index],preOperatingCost:preOperatingCost[index],maintenanceCapex:maintenanceCapex[index],
      closingWorkingCapital,changeInWorkingCapital,equityContribution:equityContribution[index],
      salvageValue:terminalSalvage,cfads,dscr,projectFreeCashFlow,equityFreeCashFlow
    })
    priorWorkingCapital = closingWorkingCapital
  }
  const projectFlows = rows.map(row=>row.projectFreeCashFlow)
  const equityFlows = rows.map(row=>row.equityFreeCashFlow)
  const discountRate = input.discountRatePercent
  const npvProject = discountRate == null ? null : calculatePeriodicNpv(projectFlows,periods,discountRate,dayCountBasis,cashFlowTiming)
  const npvEquity = discountRate == null ? null : calculatePeriodicNpv(equityFlows,periods,discountRate,dayCountBasis,cashFlowTiming)
  const mirrProject = input.mirrFinanceRatePercent == null || input.mirrReinvestmentRatePercent == null ? null
    : calculatePeriodicMirr(projectFlows,periods,input.mirrFinanceRatePercent,input.mirrReinvestmentRatePercent,dayCountBasis,cashFlowTiming)
  const mirrEquity = input.mirrFinanceRatePercent == null || input.mirrReinvestmentRatePercent == null ? null
    : calculatePeriodicMirr(equityFlows,periods,input.mirrFinanceRatePercent,input.mirrReinvestmentRatePercent,dayCountBasis,cashFlowTiming)
  const signChanges = (flows: number[]) => { const nonZero=flows.filter(value=>value!==0); let changes=0; for(let index=1;index<nonZero.length;index++) if(Math.sign(nonZero[index])!==Math.sign(nonZero[index-1])) changes++; return changes }
  if (signChanges(projectFlows) > 1 || signChanges(equityFlows) > 1)
    warnings.push('Non-conventional cash-flow signs may produce multiple IRR roots; the reported IRR is one numerical root only.')
  const totalDebtDrawdown = rows.reduce((sum,row)=>sum+row.debtDrawdown,0)
  const totalEquityContribution = rows.reduce((sum,row)=>sum+row.equityContribution,0)
  const totalCapitalizedInterest = rows.reduce((sum,row)=>sum+row.capitalizedInterest,0)
  return {
    valid:true,rows,loanSchedules,npvProject,irrProject:calculatePeriodicIrr(projectFlows,periods,dayCountBasis,cashFlowTiming),
    mirrProject,npvEquity,irrEquity:calculatePeriodicIrr(equityFlows,periods,dayCountBasis,cashFlowTiming),mirrEquity,
    totalDebtDrawdown,totalEquityContribution,totalCapitalizedInterest,
    peakWorkingCapital:Math.max(0,...input.workingCapitalByPeriod),warnings
  }
}


export type PeriodicDepreciationAssetInput = {
  id: string
  name: string
  assetClass: 'fixed' | 'preproduction'
  originalValue: number
  initialBookValue: number
  scrapPercent: number
  lengthYears: number
  lengthMonths: number
  firstDepreciationMonths: number
  ratePercent: number | null
  method: 'none' | 'linear-to-zero' | 'linear-to-scrap' | 'accelerated' | 'sum-of-years-digits'
  acquisitionDate: string
  startingAtDate?: string
}
export type PeriodicDepreciationSaleInput = {
  id: string
  assetId: string
  saleDate: string
  priceMode: 'book-value' | 'self-defined'
  selfDefinedPrice: number | null
  exchangeRateToLocal: number
}
export type PeriodicDepreciationAssetRow = {
  assetId: string
  assetName: string
  acquisitionValue: number
  openingBookValue: number
  depreciation: number
  closingBookValue: number
  methodApplied: PeriodicDepreciationAssetInput['method'] | null
}
export type PeriodicDepreciationSaleRow = {
  id: string
  assetId: string
  period: number
  saleDate: string
  saleProceeds: number
  bookValueDisposed: number
  gainLoss: number
}
export type PeriodicComfarAssetLifecycleResult = {
  valid: boolean
  warnings: string[]
  periods: Array<{
    period: number
    startDate: string
    endDate: string
    depreciation: number
    fixedInvestment: number
    preOperatingCost: number
    saleProceeds: number
    saleGainLoss: number
    bookValueDisposed: number
    closingBookValue: number
    assets: PeriodicDepreciationAssetRow[]
  }>
  depreciationByPeriod: number[]
  fixedInvestmentByPeriod: number[]
  preOperatingCostByPeriod: number[]
  saleProceedsByPeriod: number[]
  saleGainLossByPeriod: number[]
  bookValueDisposedByPeriod: number[]
  sales: PeriodicDepreciationSaleRow[]
}

function addUtcMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getUTCMonth() + months
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, 1))
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), Math.min(date.getUTCDate(), lastDay)))
}
function inclusiveDays(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
}
function firstPeriodContainingDate(date: Date, periods: ProjectCalendarPeriod[]): number {
  return periods.findIndex(period => {
    const start = parseIsoDateUtc(period.startDate)
    const end = parseIsoDateUtc(period.endDate)
    return !!start && !!end && date.getTime() >= start.getTime() && date.getTime() <= end.getTime()
  })
}
function nextPeriodStartAfter(date: Date, periods: ProjectCalendarPeriod[]): Date | null {
  const index = firstPeriodContainingDate(date, periods)
  if (index < 0 || index + 1 >= periods.length) return null
  return parseIsoDateUtc(periods[index + 1].startDate)
}
function depreciationForAnniversarySegments(
  method: 'accelerated' | 'sum-of-years-digits',
  openingBookValue: number,
  salvageValue: number,
  depreciableBase: number,
  lifeStart: Date,
  lifeEndExclusive: Date,
  segmentStart: Date,
  segmentEnd: Date,
  lifeMonths: number,
  ratePercent: number | null,
  annualOpeningBookValues: number[],
): number {
  let cursor = new Date(segmentStart.getTime())
  let bookValue = openingBookValue
  let total = 0
  const lifeYears = Math.max(1, Math.ceil(lifeMonths / 12))
  const sumYears = lifeYears * (lifeYears + 1) / 2
  while (cursor.getTime() <= segmentEnd.getTime() && bookValue > salvageValue + 1e-9) {
    const monthsFromStart = Math.max(0, (cursor.getUTCFullYear() - lifeStart.getUTCFullYear()) * 12 + cursor.getUTCMonth() - lifeStart.getUTCMonth())
    const ageYear = Math.min(lifeYears - 1, Math.floor(monthsFromStart / 12))
    const yearStart = addUtcMonthsClamped(lifeStart, ageYear * 12)
    const nextYear = addUtcMonthsClamped(lifeStart, (ageYear + 1) * 12)
    const yearEndExclusive = nextYear.getTime() > lifeEndExclusive.getTime() ? lifeEndExclusive : nextYear
    const yearDays = Math.max(1, Math.round((yearEndExclusive.getTime() - yearStart.getTime()) / 86400000))
    const segmentEndExclusive = new Date(segmentEnd.getTime() + 86400000)
    const endExclusive = segmentEndExclusive.getTime() < yearEndExclusive.getTime() ? segmentEndExclusive : yearEndExclusive
    const segmentDays = Math.max(0, Math.round((endExclusive.getTime() - cursor.getTime()) / 86400000))
    if (segmentDays <= 0) break
    const remainingMonths = Math.max(1, lifeMonths - ageYear * 12)
    if (annualOpeningBookValues[ageYear] == null) annualOpeningBookValues[ageYear] = bookValue
    const annualOpeningBookValue = annualOpeningBookValues[ageYear]
    const annualDepreciation = method === 'sum-of-years-digits'
      ? depreciableBase * (lifeYears - ageYear) / sumYears
      : Math.max(annualOpeningBookValue * ((ratePercent ?? 0) / 100), (annualOpeningBookValue - salvageValue) / (remainingMonths / 12))
    const amount = Math.min(bookValue - salvageValue, annualDepreciation * segmentDays / yearDays)
    total += amount
    bookValue -= amount
    cursor = new Date(endExclusive.getTime())
  }
  return total
}

/**
 * Asset-by-asset depreciation on actual monthly/quarterly dates.
 * New acquisitions begin depreciation in the period after acquisition unless a later
 * explicit startingAtDate is supplied; pre-project assets must be loaded as opening balances.
 */
export function calculatePeriodicComfarAssetLifecycle(
  assets: PeriodicDepreciationAssetInput[],
  sales: PeriodicDepreciationSaleInput[],
  periods: ProjectCalendarPeriod[],
): PeriodicComfarAssetLifecycleResult {
  const warnings: string[] = []
  const empty = (): PeriodicComfarAssetLifecycleResult => ({
    valid: false, warnings, periods: [], depreciationByPeriod: [], fixedInvestmentByPeriod: [],
    preOperatingCostByPeriod: [], saleProceedsByPeriod: [], saleGainLossByPeriod: [],
    bookValueDisposedByPeriod: [], sales: []
  })
  if (!periods.length || periods.some((period,index) => {
    const start=parseIsoDateUtc(period.startDate),end=parseIsoDateUtc(period.endDate)
    return !start||!end||!Number.isInteger(period.days)||period.days<=0||inclusiveDays(start,end)!==period.days||
      end.getTime()<start.getTime()||(index>0&&start.getTime()!==parseIsoDateUtc(periods[index-1].endDate)!.getTime()+86400000)
  })) {
    warnings.push('Periodic depreciation requires valid contiguous project periods with inclusive day counts.')
    return empty()
  }
  if (new Set(assets.map(asset=>asset.id)).size!==assets.length || new Set(sales.map(sale=>sale.id)).size!==sales.length) {
    warnings.push('Periodic depreciation asset and sale identifiers must be unique.')
    return empty()
  }
  const assetIds=new Set(assets.map(asset=>asset.id))
  if (sales.some(sale=>!assetIds.has(sale.assetId))) {
    warnings.push('Every periodic asset sale must reference an existing asset vintage.')
    return empty()
  }
  const periodRows=periods.map(period=>({
    period:period.index,startDate:period.startDate,endDate:period.endDate,depreciation:0,
    fixedInvestment:0,preOperatingCost:0,saleProceeds:0,saleGainLoss:0,
    bookValueDisposed:0,closingBookValue:0,assets:[] as PeriodicDepreciationAssetRow[]
  }))
  const salesResult:PeriodicDepreciationSaleRow[]=[]
  for(const asset of assets){
    const acquisitionDate=parseIsoDateUtc(asset.acquisitionDate)
    const startingAtDate=asset.startingAtDate?parseIsoDateUtc(asset.startingAtDate):null
    const lifeMonths=asset.lengthYears*12+asset.lengthMonths
    if(!acquisitionDate|| (asset.startingAtDate&&!startingAtDate) ||
      !validFinite(asset.originalValue)||asset.originalValue<0||
      !validFinite(asset.initialBookValue)||asset.initialBookValue<0||asset.initialBookValue>asset.originalValue||
      !validFinite(asset.scrapPercent)||asset.scrapPercent<0||asset.scrapPercent>100||
      !Number.isInteger(asset.lengthYears)||asset.lengthYears<0||
      !Number.isInteger(asset.lengthMonths)||asset.lengthMonths<0||asset.lengthMonths>11||
      !Number.isInteger(asset.firstDepreciationMonths)||asset.firstDepreciationMonths<1||asset.firstDepreciationMonths>12||
      !['fixed','preproduction'].includes(asset.assetClass)||
      !['none','linear-to-zero','linear-to-scrap','accelerated','sum-of-years-digits'].includes(asset.method)||
      (asset.method!=='none'&&lifeMonths<1)||
      (asset.method==='accelerated'&&(!validFinite(asset.ratePercent)||asset.ratePercent!<=0||asset.ratePercent!>100))||
      (asset.method==='sum-of-years-digits'&&(asset.lengthMonths!==0||asset.lengthYears<1||asset.firstDepreciationMonths!==12))) {
      warnings.push(asset.name+': periodic depreciation asset parameters or acquisition/start dates are invalid.')
      continue
    }
    const acquisitionIndex=firstPeriodContainingDate(acquisitionDate,periods)
    if(acquisitionIndex<0){
      warnings.push(asset.name+': acquisition date is outside the project calendar; pre-project assets must be entered as opening balances.')
      continue
    }
    let depreciationStartDate:Date|null=null
    if(startingAtDate&&startingAtDate.getTime()>acquisitionDate.getTime()){
      depreciationStartDate=startingAtDate
    } else {
      depreciationStartDate=nextPeriodStartAfter(acquisitionDate,periods)
    }
    const lifeEndExclusive=depreciationStartDate&&lifeMonths>0?addUtcMonthsClamped(depreciationStartDate,lifeMonths):null
    const salvageValue=asset.method==='linear-to-zero'?0:asset.initialBookValue*asset.scrapPercent/100
    const depreciableBase=Math.max(0,asset.initialBookValue-salvageValue)
    const sale=sales.find(row=>row.assetId===asset.id)
    const saleDate=sale?parseIsoDateUtc(sale.saleDate):null
    if(sale&&(!saleDate||saleDate.getTime()<acquisitionDate.getTime()||
      (sale.priceMode==='self-defined'&&(!validFinite(sale.selfDefinedPrice)||sale.selfDefinedPrice!<0||
       !validFinite(sale.exchangeRateToLocal)||sale.exchangeRateToLocal<=0)))) {
      warnings.push(asset.name+': periodic disposal date or proceeds are invalid.')
      continue
    }
    const saleIndex=sale&&saleDate?firstPeriodContainingDate(saleDate,periods):-1
    if(sale&&saleIndex<0){
      warnings.push(asset.name+': disposal date is outside the project calendar.')
      continue
    }
    let bookValue=0
    const annualOpeningBookValues:number[]=[]
    for(let index=0;index<periods.length;index++){
      const period=periods[index]
      const periodStart=parseIsoDateUtc(period.startDate)!
      const periodEnd=parseIsoDateUtc(period.endDate)!
      const acquisitionValue=index===acquisitionIndex?asset.originalValue:0
      if(index===acquisitionIndex){
        if(asset.assetClass==='preproduction') periodRows[index].preOperatingCost+=asset.originalValue
        else periodRows[index].fixedInvestment+=asset.originalValue
        bookValue+=asset.initialBookValue
      }
      const openingBookValue=bookValue
      const saleInThisPeriod=!!sale&&saleIndex===index
      let depreciation=0
      if(asset.method!=='none'&&depreciationStartDate&&lifeEndExclusive&&bookValue>salvageValue&&
        index>=acquisitionIndex&&(!saleDate||periodStart.getTime()<=saleDate.getTime())){
        const activeStart=new Date(Math.max(periodStart.getTime(),depreciationStartDate.getTime()))
        const lifeEndInclusive=new Date(lifeEndExclusive.getTime()-86400000)
        const effectiveEnd=new Date(Math.min(periodEnd.getTime(),lifeEndInclusive.getTime(),saleDate&&saleInThisPeriod?saleDate.getTime():periodEnd.getTime()))
        if(activeStart.getTime()<=effectiveEnd.getTime()){
          if(asset.method==='linear-to-zero'||asset.method==='linear-to-scrap'){
            const totalLifeDays=Math.max(1,Math.round((lifeEndExclusive.getTime()-depreciationStartDate.getTime())/86400000))
            depreciation=Math.min(bookValue-salvageValue,depreciableBase*inclusiveDays(activeStart,effectiveEnd)/totalLifeDays)
          } else {
            depreciation=depreciationForAnniversarySegments(asset.method,bookValue,salvageValue,depreciableBase,
              depreciationStartDate,lifeEndExclusive,activeStart,effectiveEnd,lifeMonths,asset.ratePercent,annualOpeningBookValues)
            depreciation=Math.min(bookValue-salvageValue,depreciation)
          }
          bookValue=Math.max(salvageValue,bookValue-depreciation)
        }
      }
      let saleProceeds=0,bookValueDisposed=0,gainLoss=0
      if(saleInThisPeriod&&sale&&saleDate){
        bookValueDisposed=bookValue
        saleProceeds=sale.priceMode==='book-value'?bookValueDisposed:(sale.selfDefinedPrice??0)*sale.exchangeRateToLocal
        gainLoss=saleProceeds-bookValueDisposed
        bookValue=0
        periodRows[index].saleProceeds+=saleProceeds
        periodRows[index].saleGainLoss+=gainLoss
        periodRows[index].bookValueDisposed+=bookValueDisposed
        salesResult.push({id:sale.id,assetId:asset.id,period:period.index,saleDate:sale.saleDate,saleProceeds,bookValueDisposed,gainLoss})
      }
      periodRows[index].depreciation+=depreciation
      periodRows[index].closingBookValue+=bookValue
      periodRows[index].assets.push({
        assetId:asset.id,assetName:asset.name,acquisitionValue,openingBookValue,
        depreciation,closingBookValue:bookValue,methodApplied:asset.method
      })
    }
  }
  return {
    valid:warnings.length===0,warnings,periods:periodRows,
    depreciationByPeriod:periodRows.map(row=>row.depreciation),
    fixedInvestmentByPeriod:periodRows.map(row=>row.fixedInvestment),
    preOperatingCostByPeriod:periodRows.map(row=>row.preOperatingCost),
    saleProceedsByPeriod:periodRows.map(row=>row.saleProceeds),
    saleGainLossByPeriod:periodRows.map(row=>row.saleGainLoss),
    bookValueDisposedByPeriod:periodRows.map(row=>row.bookValueDisposed),
    sales:salesResult
  }
}
