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

export type TaxLossVintage = { amount: number; originFiscalYearIndex: number }
export type PeriodTaxWithExpiryResult = PeriodTaxResult & { closingLossVintages: TaxLossVintage[] }

/**
 * Apply loss carry-forward in FIFO order with an explicit expiry horizon.
 * Loss vintages must be supplied for opening losses whenever expiry is enabled;
 * the engine never guesses the age of an opening tax loss balance.
 */
export function calculatePeriodTaxWithLossExpiry(
  taxableProfitBeforeLoss: number,
  taxRatePercent: number,
  openingLossVintages: TaxLossVintage[],
  fiscalYearIndex: number,
  carryForwardYears: number | null,
  enabled = true,
): PeriodTaxWithExpiryResult {
  if (![taxableProfitBeforeLoss,taxRatePercent,fiscalYearIndex].every(validFinite) ||
      !Number.isInteger(fiscalYearIndex) || fiscalYearIndex < 0 ||
      taxRatePercent < 0 || taxRatePercent > 100 ||
      (carryForwardYears !== null && (!Number.isInteger(carryForwardYears) || carryForwardYears < 1)) ||
      !Array.isArray(openingLossVintages) ||
      openingLossVintages.some(item=>!item||!validFinite(item.amount)||item.amount<=0||
        !Number.isInteger(item.originFiscalYearIndex)||item.originFiscalYearIndex>fiscalYearIndex)) {
    return {taxableProfitAfterLoss:Number.NaN,tax:Number.NaN,closingLossCarryForward:Number.NaN,closingLossVintages:[]}
  }
  let vintages=enabled?openingLossVintages.map(item=>({...item})): []
  if (enabled && carryForwardYears !== null)
    vintages=vintages.filter(item=>fiscalYearIndex-item.originFiscalYearIndex<=carryForwardYears)
  let taxableProfitAfterLoss=taxableProfitBeforeLoss
  if(enabled&&taxableProfitAfterLoss>0){
    for(const vintage of vintages){
      const used=Math.min(vintage.amount,taxableProfitAfterLoss)
      vintage.amount-=used
      taxableProfitAfterLoss-=used
      if(taxableProfitAfterLoss<=1e-10)break
    }
    vintages=vintages.filter(item=>item.amount>1e-10)
  }
  if(enabled&&taxableProfitAfterLoss<0)
    vintages.push({amount:-taxableProfitAfterLoss,originFiscalYearIndex:fiscalYearIndex})
  const closingLossCarryForward=vintages.reduce((sum,item)=>sum+item.amount,0)
  return {
    taxableProfitAfterLoss,
    tax:Math.max(0,taxableProfitAfterLoss)*taxRatePercent/100,
    closingLossCarryForward,
    closingLossVintages:vintages,
  }
}

export type PeriodDiscountConvention = 'actual-days' | 'period-count'

function periodPositionAtDate(
  valuationDate: string,
  periods: ProjectCalendarPeriod[],
  dayCountBasis: 360 | 365,
  periodsPerYear: 1 | 2 | 4 | 12,
): number | null {
  const target = parseIsoDateUtc(valuationDate)
  if (!target || !periods.length) return null
  const nominalPeriodDays = dayCountBasis / periodsPerYear
  let position = 0
  for (const period of periods) {
    const start = parseIsoDateUtc(period.startDate)
    const end = parseIsoDateUtc(period.endDate)
    if (!start || !end || end < start) return null
    const fraction = period.partial ? period.days / nominalPeriodDays : 1
    if (target < start) return position + (target.getTime() - start.getTime()) / 86400000 / nominalPeriodDays
    if (target <= end) {
      const elapsedInclusiveDays = (target.getTime() - start.getTime()) / 86400000 + 1
      return position + fraction * Math.min(1, Math.max(0, elapsedInclusiveDays / period.days))
    }
    position += fraction
  }
  const lastEnd = parseIsoDateUtc(periods[periods.length - 1].endDate)
  if (!lastEnd) return null
  return position + (target.getTime() - lastEnd.getTime()) / 86400000 / nominalPeriodDays
}

/**
 * Discount period cash flows against an optional valuation date.
 * Actual-days uses elapsed calendar days; period-count treats each complete
 * fiscal period as one period and prorates only partial boundary periods.
 */
export function calculatePeriodicNpv(
  cashFlows: number[],
  periods: ProjectCalendarPeriod[],
  annualDiscountRatePercent: number,
  dayCountBasis: 360 | 365,
  timing: PeriodCashFlowTiming = 'period-end',
  valuationDate?: string,
  convention: PeriodDiscountConvention = 'actual-days',
  periodsPerYear: 1 | 2 | 4 | 12 = 1,
): number {
  if (cashFlows.length !== periods.length || cashFlows.some(value => !validFinite(value)) ||
      !validFinite(annualDiscountRatePercent) || annualDiscountRatePercent <= -100 ||
      (dayCountBasis !== 360 && dayCountBasis !== 365) ||
      (timing !== 'period-end' && timing !== 'mid-period') ||
      (convention !== 'actual-days' && convention !== 'period-count') ||
      ![1, 2, 4, 12].includes(periodsPerYear) ||
      periods.some(period => !Number.isInteger(period.days) || period.days <= 0)) return Number.NaN
  const valuationPosition = valuationDate && convention === 'period-count'
    ? periodPositionAtDate(valuationDate, periods, dayCountBasis, periodsPerYear)
    : null
  const valuationTimestamp = valuationDate && convention === 'actual-days'
    ? parseIsoDateUtc(valuationDate)?.getTime() ?? null
    : null
  if (valuationDate && convention === 'period-count' && valuationPosition == null) return Number.NaN
  if (valuationDate && convention === 'actual-days' && valuationTimestamp == null) return Number.NaN
  let elapsedDays = 0
  let elapsedPeriods = 0
  let npv = 0
  for (let index = 0; index < periods.length; index++) {
    const period = periods[index]
    let exponent: number
    if (convention === 'period-count') {
      const nominalPeriodDays = dayCountBasis / periodsPerYear
      const fraction = period.partial ? period.days / nominalPeriodDays : 1
      const periodCashFlowPosition = elapsedPeriods + (timing === 'mid-period' ? fraction / 2 : fraction)
      exponent = (periodCashFlowPosition - (valuationPosition ?? 0)) / periodsPerYear
      elapsedPeriods += fraction
    } else if (valuationTimestamp != null) {
      const start = parseIsoDateUtc(period.startDate)
      const end = parseIsoDateUtc(period.endDate)
      if (!start || !end || end < start) return Number.NaN
      const cashFlowTimestamp = timing === 'mid-period'
        ? start.getTime() + period.days * 86400000 / 2
        : end.getTime()
      exponent = (cashFlowTimestamp - valuationTimestamp) / 86400000 / dayCountBasis
    } else {
      const discountDays = elapsedDays + (timing === 'mid-period' ? period.days / 2 : period.days)
      exponent = discountDays / dayCountBasis
      elapsedDays += period.days
    }
    npv += cashFlows[index] / Math.pow(1 + annualDiscountRatePercent / 100, exponent)
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
  repaymentMethod: 'equal-principal' | 'annuity' | 'bullet' | 'custom'
  repaymentStartPeriod: number
  gracePeriods: number
  termPeriods: number
  capitalizeInterest: boolean
  rateConversion?: 'effective-annual-by-actual-days' | 'effective-annual-divided-by-frequency'
  periodsPerYear?: 1 | 2 | 4 | 12
  /** Existing principal balance at the start of the first modeled period; not a new cash drawdown. */
  openingBalance?: number
  /** Exact cash draw dates; when supplied, amounts must reconcile to drawdowns by period. */
  datedDrawdowns?: { date: string; amount: number }[]
  /** Effective-dated annual nominal rate resets; the base annualRatePercent applies before the first reset. */
  rateChanges?: { effectiveDate: string; annualRatePercent: number }[]
  /** Financing fees paid on a date; capitalized fees are added to debt, expense fees are paid in cash. */
  fees?: { date: string; amount: number; treatment: 'expense' | 'capitalize'; label?: string }[]
  /** Facility commitment limit; fees accrue on the time-weighted undrawn balance. */
  facilityLimit?: number
  commitmentFeeAnnualRatePercent?: number
  /** Period numbers are 1-based; with balloonAtMaturity, remaining principal is due at final maturity. */
  customPrincipalRepayments?: { period: number; amount: number }[]
  balloonAtMaturity?: boolean
  interestConvention?: 'comfar-months-plus-360' | 'actual-360' | 'actual-365'
}

export type PeriodicLoanRow = {
  period: number
  drawdown: number
  openingBalance: number
  periodRatePercent: number
  interestExpense: number
  capitalizedInterest: number
  financingFeeExpense: number
  commitmentFeeExpense: number
  capitalizedFinancingFees: number
  principal: number
  closingBalance: number
  debtService: number
}

export type PeriodicLoanScheduleResult = {
  rows: PeriodicLoanRow[]
  valid: boolean
  issues: string[]
}

function loanDateAddMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + months
  const targetYear = year + Math.floor(month / 12)
  const targetMonth = ((month % 12) + 12) % 12
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate())
  return new Date(Date.UTC(targetYear, targetMonth, day))
}

function loanYearFraction(startDate: string, endDate: string, convention: 'comfar-months-plus-360' | 'actual-360' | 'actual-365'): number {
  const start = parseIsoDateUtc(startDate)
  const end = parseIsoDateUtc(endDate)
  if (!start || !end || end <= start) return 0
  const days = (end.getTime() - start.getTime()) / 86400000
  if (convention === 'actual-360') return days / 360
  if (convention === 'actual-365') return days / 365
  // COMFAR splits each interval into completed calendar months and residual
  // days. A month is completed only when the ending day-of-month reaches the
  // starting day; residual days are then converted on a 30-day-month basis.
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth()
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  const wholeMonthDate = loanDateAddMonthsClamped(start, months)
  const extraDays = (end.getTime() - wholeMonthDate.getTime()) / 86400000
  return months / 12 + extraDays / 360
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
  if (!['equal-principal', 'annuity', 'bullet', 'custom'].includes(input.repaymentMethod))
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
  if (input.openingBalance != null && (!validFinite(input.openingBalance) || input.openingBalance < 0))
    issues.push('Opening loan balance must be a finite non-negative amount.')
  if (input.facilityLimit != null && (!validFinite(input.facilityLimit) || input.facilityLimit < 0 || input.facilityLimit < (input.openingBalance ?? 0)))
    issues.push('Facility limit must be finite, non-negative and at least the opening loan balance.')
  if (input.commitmentFeeAnnualRatePercent != null && (!validFinite(input.commitmentFeeAnnualRatePercent) || input.commitmentFeeAnnualRatePercent < 0 || input.facilityLimit == null))
    issues.push('A non-negative commitment fee rate requires a valid facility limit.')
  const customRepayments = input.customPrincipalRepayments ?? []
  if (input.repaymentMethod === 'custom' && !customRepayments.length)
    issues.push('Custom repayment method requires at least one scheduled principal payment.')
  if (customRepayments.some((item,index) => !item || !Number.isInteger(item.period) || item.period < firstPrincipalIndex + 1 || item.period > firstPrincipalIndex + input.termPeriods || !validFinite(item.amount) || item.amount <= 0 || (index > 0 && customRepayments[index - 1].period >= item.period)))
    issues.push('Custom principal repayments must have unique increasing periods within the repayment term and positive finite amounts.')
  const interestConvention = input.interestConvention
  const rateChanges = input.rateChanges ?? []
  const fees = input.fees ?? []
  if (interestConvention != null && !['comfar-months-plus-360','actual-360','actual-365'].includes(interestConvention))
    issues.push('Unsupported loan interest day-count convention.')
  if (input.datedDrawdowns && !interestConvention)
    issues.push('Exact dated drawdowns require an explicit interest day-count convention.')
  if (rateChanges.some((change,index) => !change || !parseIsoDateUtc(change.effectiveDate) ||
      !validFinite(change.annualRatePercent) || change.annualRatePercent < 0 ||
      (index > 0 && rateChanges[index - 1].effectiveDate >= change.effectiveDate)))
    issues.push('Rate resets must have valid dates, non-negative finite rates and strictly increasing effective dates.')
  if (fees.some(fee => !fee || !parseIsoDateUtc(fee.date) || !validFinite(fee.amount) ||
      fee.amount <= 0 || !['expense','capitalize'].includes(fee.treatment)))
    issues.push('Financing fees require valid dates, positive finite amounts and a supported treatment.')
  if (periods.length && [...rateChanges.map(item=>item.effectiveDate),...fees.map(item=>item.date)]
      .some(date => date < periods[0].startDate || date > periods[periods.length-1].endDate))
    issues.push('Rate resets and financing fees must fall within the modeled project calendar.')
  if (input.datedDrawdowns) {
    if (input.datedDrawdowns.some(item => !item || !parseIsoDateUtc(item.date) || !validFinite(item.amount) || item.amount <= 0))
      issues.push('Exact loan drawdowns require valid dates and positive finite amounts.')
    const exactTotals = periods.map((period, index) => input.datedDrawdowns!
      .filter(item => item.date >= period.startDate && item.date <= period.endDate)
      .reduce((sum, item) => sum + item.amount, 0))
    if (exactTotals.some((amount, index) => Math.abs(amount - input.drawdowns[index]) > 0.01))
      issues.push('Exact dated drawdowns must reconcile to the period drawdown totals.')
    if (input.datedDrawdowns.some(item => !periods.some(period => item.date >= period.startDate && item.date <= period.endDate)))
      issues.push('Every exact loan drawdown date must fall inside the project calendar.')
  }
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
    if (interestConvention === 'actual-360' || interestConvention === 'actual-365') {
      return input.annualRatePercent / 100 * period.days / (interestConvention === 'actual-360' ? 360 : 365)
    }
    if (interestConvention === 'comfar-months-plus-360') {
      return input.annualRatePercent / 100 * loanYearFraction(period.startDate, period.endDate, interestConvention)
    }
    if (rateConversion === 'effective-annual-divided-by-frequency') {
      const periodsPerYear = input.periodsPerYear as 1 | 2 | 4 | 12
      const fullPeriodRate = input.annualRatePercent / periodsPerYear
      const partialFactor = period.partial ? period.days / (dayCountBasis / periodsPerYear) : 1
      return fullPeriodRate * partialFactor / 100
    }
    return annualEffectiveRateToPeriodRate(input.annualRatePercent, period.days, dayCountBasis) / 100
  })
  const effectiveRateForDate = (date: string) => {
    let rate = input.annualRatePercent
    for (const change of rateChanges) {
      if (change.effectiveDate > date) break
      rate = change.annualRatePercent
    }
    return rate
  }
  const hasDatedFinancingEvents = rateChanges.length > 0 || fees.length > 0 || (input.commitmentFeeAnnualRatePercent ?? 0) > 0
  const addDays = (date: string, days: number) => {
    const parsed = parseIsoDateUtc(date)!
    return dateOnlyUtc(new Date(parsed.getTime() + days * 86400000))
  }
  const segmentDays = (startDate: string, endDateExclusive: string) => {
    const start = parseIsoDateUtc(startDate)!
    const end = parseIsoDateUtc(endDateExclusive)!
    return Math.max(0, (end.getTime() - start.getTime()) / 86400000)
  }
  const segmentInterest = (balance: number, annualRate: number, startDate: string, endDateExclusive: string, period: ProjectCalendarPeriod) => {
    if (interestConvention) {
      return balance * annualRate / 100 * loanYearFraction(startDate, endDateExclusive, interestConvention)
    }
    const days = segmentDays(startDate, endDateExclusive)
    if (rateConversion === 'effective-annual-divided-by-frequency') {
      const periodsPerYear = input.periodsPerYear as 1 | 2 | 4 | 12
      const periodFraction=days/period.days*(period.partial?period.days/(dayCountBasis/periodsPerYear):1)
      return balance * annualRate / 100 / periodsPerYear * periodFraction
    }
    return balance * (Math.pow(1 + annualRate / 100, days / dayCountBasis) - 1)
  }
  // A rate reset splits a period into effective-rate segments. The resulting
  // period rate is the combined effective rate used by the annuity calculation.
  if (rateChanges.length > 0) {
    for (let index=0; index<periods.length; index++) {
      const period=periods[index]
      const endExclusive=input.datedDrawdowns?period.endDate:addDays(period.endDate,1)
      const boundaries=[period.startDate,...rateChanges.map(item=>item.effectiveDate)
        .filter(date=>date>period.startDate&&date<=period.endDate),endExclusive]
        .sort().filter((date,i,array)=>i===0||date!==array[i-1])
      let combinedFactor=1
      let simpleFactor=0
      for(let segment=0;segment<boundaries.length-1;segment++) {
        const from=boundaries[segment],to=boundaries[segment+1]
        const rate=effectiveRateForDate(from)
        if(interestConvention) {
          simpleFactor+=rate/100*loanYearFraction(from,to,interestConvention)
        } else if(rateConversion==='effective-annual-divided-by-frequency') {
          const periodsPerYear=input.periodsPerYear as 1|2|4|12
          const periodFraction=segmentDays(from,to)/period.days*(period.partial?period.days/(dayCountBasis/periodsPerYear):1)
          simpleFactor+=rate/100/periodsPerYear*periodFraction
        } else {
          combinedFactor*=Math.pow(1+rate/100,segmentDays(from,to)/dayCountBasis)
        }
      }
      periodRates[index]=interestConvention||rateConversion==='effective-annual-divided-by-frequency'
        ? simpleFactor
        : combinedFactor-1
    }
  }
  let balance = input.openingBalance ?? 0
  let annuityPayment: number | null = null
  let equalPrincipalAmount: number | null = null
  const rows: PeriodicLoanRow[] = []
  for (let index = 0; index < periods.length; index++) {
    const drawdown = input.drawdowns[index]
    const openingBalance = balance
    if (input.facilityLimit != null && openingBalance + drawdown > input.facilityLimit + 0.01)
      issues.push('Period ' + (index + 1) + ' drawdown exceeds the committed facility limit.')
    let interestAccrued: number
    let financingFeeExpense = 0
    let commitmentFeeExpense = 0
    let capitalizedFinancingFees = 0
    if (input.datedDrawdowns || hasDatedFinancingEvents) {
      const period = periods[index]
      const events: {date:string;kind:'rate'|'drawdown'|'fee';amount:number;treatment?:'expense'|'capitalize'}[] = []
      for(const item of input.datedDrawdowns??[]) if(item.date>=period.startDate&&item.date<=period.endDate) events.push({date:item.date,kind:'drawdown',amount:item.amount})
      for(const item of rateChanges) if(item.effectiveDate>=period.startDate&&item.effectiveDate<=period.endDate) events.push({date:item.effectiveDate,kind:'rate',amount:item.annualRatePercent})
      for(const item of fees) if(item.date>=period.startDate&&item.date<=period.endDate) events.push({date:item.date,kind:'fee',amount:item.amount,treatment:item.treatment})
      if(!input.datedDrawdowns && drawdown>0) {
        const midpoint=new Date(Date.parse(period.startDate+'T00:00:00Z')+Math.floor((period.days-1)/2)*86400000).toISOString().slice(0,10)
        events.push({date:midpoint,kind:'drawdown',amount:drawdown})
      }
      events.sort((a,b)=>a.date.localeCompare(b.date)||({rate:0,drawdown:1,fee:2}[a.kind]-{rate:0,drawdown:1,fee:2}[b.kind]))
      let cursor=period.startDate
      let interestBalance=openingBalance
      let committedAmount=openingBalance
      let activeRate=effectiveRateForDate(period.startDate)
      interestAccrued=0
      // Exact dated drawdowns retain the engine's established end-exclusive accrual rule.
      const endExclusive=input.datedDrawdowns?period.endDate:addDays(period.endDate,1)
      const accrueUntil=(nextDate:string) => {
        if(nextDate<=cursor) return
        const accrued=segmentInterest(interestBalance,activeRate,cursor,nextDate,period)
        interestAccrued+=accrued
        if ((input.commitmentFeeAnnualRatePercent ?? 0) > 0 && input.facilityLimit != null) {
          const unusedCommitment = Math.max(0, input.facilityLimit - committedAmount)
          const days = segmentDays(cursor,nextDate)
          commitmentFeeExpense += unusedCommitment * (input.commitmentFeeAnnualRatePercent as number) / 100 * days / dayCountBasis
        }
        // Effective-annual conversion represents a compounded effective rate.
        // Explicit day-count conventions and frequency-divided rates remain simple.
        if(!interestConvention && rateConversion==='effective-annual-by-actual-days')
          interestBalance+=accrued
        cursor=nextDate
      }
      for(const event of events) {
        accrueUntil(event.date)
        if(event.kind==='rate') activeRate=event.amount
        else if(event.kind==='drawdown') { interestBalance+=event.amount; committedAmount+=event.amount }
        else if(event.treatment==='capitalize') {
          capitalizedFinancingFees+=event.amount
          interestBalance+=event.amount
          // The facility is measured on total outstanding debt. A capitalized
          // fee consumes facility from its effective date, not from period start.
          committedAmount+=event.amount
          if(input.facilityLimit!=null && committedAmount>input.facilityLimit+0.01)
            issues.push('Capitalized financing fee exceeds the committed facility limit in period '+(index+1)+'.')
        }
        else financingFeeExpense+=event.amount
      }
      accrueUntil(endExclusive)
    } else {
      const interestBase = openingBalance + drawdown * 0.5
      interestAccrued = interestBase * periodRates[index]
      if ((input.commitmentFeeAnnualRatePercent ?? 0) > 0 && input.facilityLimit != null) {
        const averageUndrawn = Math.max(0, input.facilityLimit - (openingBalance + drawdown / 2))
        commitmentFeeExpense = averageUndrawn * (input.commitmentFeeAnnualRatePercent as number) / 100 * periods[index].days / dayCountBasis
      }
    }
    financingFeeExpense += commitmentFeeExpense
    const beforePrincipal = index < firstPrincipalIndex
    const capitalizedInterest = beforePrincipal && input.capitalizeInterest ? interestAccrued : 0
    const interestExpense = capitalizedInterest > 0 ? 0 : interestAccrued
    const availableBalance = openingBalance + drawdown + capitalizedInterest + capitalizedFinancingFees
    // Period-end capitalized interest becomes outstanding facility utilization
    // at close; it must not silently push total debt above the commitment.
    if(input.facilityLimit!=null && availableBalance>input.facilityLimit+0.01)
      issues.push('Capitalized interest or financing fees exceed the committed facility limit in period '+(index+1)+'.')
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
      } else if (input.repaymentMethod === 'custom') {
        const scheduled = customRepayments.find(item => item.period === index + 1)?.amount ?? 0
        principal = input.balloonAtMaturity && repaymentIndex === input.termPeriods - 1
          ? availableBalance
          : Math.min(availableBalance, scheduled)
        if (scheduled > availableBalance + 0.01) issues.push('Custom principal repayment exceeds the outstanding balance in period ' + (index + 1) + '.')
        if (!input.balloonAtMaturity && repaymentIndex === input.termPeriods - 1 && Math.abs(principal - availableBalance) > 0.01)
          issues.push('Custom repayment schedule must fully repay the balance at maturity or enable the balloon payment.')
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
      financingFeeExpense,
      commitmentFeeExpense,
      capitalizedFinancingFees,
      principal,
      closingBalance: balance,
      debtService: interestExpense + financingFeeExpense + principal,
    })
  }
  return issues.length ? { rows: [], valid: false, issues } : { rows, valid: true, issues: [] }
}


export type PeriodicProjectLoan = {
  id: string
  input: PeriodicLoanInput
}
export type ComfarAutomaticFundingRow = {
  period: number
  automaticEquity: number
  automaticOverdraftDrawdown: number
  automaticOverdraftRepayment: number
  automaticOverdraftBalance: number
}

export type PeriodicProjectFinanceInput = {
  periods: ProjectCalendarPeriod[]
  fiscalYearStartMonth: number
  /** Number of initial periods belonging to construction; subsequent deficits use an automatic overdraft. */
  constructionPeriodCount?: number
  dayCountBasis: 360 | 365
  cashFlowTiming: PeriodCashFlowTiming
  annualRevenue: number[]
  /** Optional product-led revenue by exact project period; fiscal-year totals must reconcile to annualRevenue. */
  periodRevenue?: number[]
  /** Subsidy income included in product revenue but removed as a transfer in economic appraisal. */
  periodSubsidyIncome?: number[]
  /** Other operating / liquidation income documented separately from product sales. */
  periodOtherIncomeByPeriod?: number[]
  periodOtherIncomeSourceReference?: string
  /** Optional product-led cost of sales by exact project period; fiscal-year totals must reconcile to annualVariableCost. */
  periodVariableCost?: number[]
  annualShortTermDepositInterest?: number[]
  annualVariableCost: number[]
  annualFixedCost: number[]
  /** Separately expensed abnormal waste; kept outside fixed/variable cost behaviour buckets. */
  periodAbnormalWasteExpense?: number[]
  annualDepreciation: number[]
  annualFixedInvestment: number[]
  annualPreOperatingCost: number[]
  annualMaintenanceCapex: number[]
  annualTaxRates: number[]
  taxRatesByPeriod?: number[]
  /** Final income-tax amounts transcribed from a verified source, by exact project period. */
  taxAmountOverridesByPeriod?: number[]
  taxAmountSourceReference?: string
  taxableDeductionsByPeriod?: number[]
  /** Non-refundable period tax credits; excess credits are not carried forward. */
  taxCreditsByPeriod?: number[]
  annualEquityContributions: number[]
  /** Shareholder funding for working capital; any amount above the period increase remains as cash funding buffer. */
  annualEquityWorkingCapitalContributions?: number[]
  workingCapitalByPeriod: number[]
  /** Gross inventory sub-ledgers included within net working capital; disclosure only, never added twice. */
  rawMaterialsInventoryByPeriod?: number[]
  workInProgressInventoryByPeriod?: number[]
  finishedGoodsInventoryByPeriod?: number[]
  cashInHandByPeriod?: number[]
  shortTermDepositsByPeriod?: number[]
  openingWorkingCapital?: number
  /** Opening cash balance for the period cash roll-forward. */
  openingCash?: number
  openingTaxLoss?: number
  openingUnleveredTaxLoss?: number
  openingTaxLossVintages?: TaxLossVintage[]
  openingUnleveredTaxLossVintages?: TaxLossVintage[]
  taxLossCarryForwardEnabled?: boolean
  taxLossCarryForwardYears?: number | null
  loans: PeriodicProjectLoan[]
  /** Pretranslated local-currency schedules for foreign facilities; FX gains/losses are posted separately. */
  loanScheduleOverrides?: Record<string, PeriodicLoanRow[]>
  foreignExchangeLossByPeriod?: number[]
  /** Minimum covenant DSCR as a multiple (e.g. 1.20); breaches are warnings, not automatic cash-flow changes. */
  minimumDscr?: number
  discountRatePercent?: number | null
  equityDiscountRatePercent?: number | null
  valuationDate?: string
  discountConvention?: PeriodDiscountConvention
  discountPeriodsPerYear?: 1 | 2 | 4 | 12
  mirrFinanceRatePercent?: number | null
  mirrReinvestmentRatePercent?: number | null
  salvageValue?: number
  salvageBookValue?: number
  annualAssetSaleSchedule?: {
    saleProceeds: number
    returnOfCapital: number
    otherIncomeLoss: number
    bookValueDisposed: number
  }[]
  periodDepreciationSchedule?: number[]
  periodAssetSaleSchedule?: {
    saleProceeds: number
    returnOfCapital: number
    otherIncomeLoss: number
    bookValueDisposed: number
  }[]
}
export type PeriodicProjectFinanceRow = {
  period: number
  startDate: string
  endDate: string
  days: number
  revenue: number
  subsidyIncome: number
  otherIncome: number
  otherIncomeSourceReference?: string | null
  shortTermDepositInterest: number
  variableCost: number
  fixedCost: number
  /** Separately expensed abnormal waste; not presumed fixed or variable. */
  abnormalWasteExpense: number
  depreciation: number
  ebit: number
  assetSaleProceeds: number
  assetReturnOfCapital: number
  assetSaleOtherIncomeLoss: number
  assetBookValueDisposed: number
  /** Legacy total financing expense: cash interest plus expensed financing fees. */
  interestExpense: number
  /** Contractual interest before financing and commitment fees. */
  cashInterestExpense: number
  /** All expense-classified financing fees, including commitment fees. */
  financingFeeExpense: number
  /** Subset of financingFeeExpense attributable to undrawn commitment fees. */
  commitmentFeeExpense: number
  capitalizedInterest: number
  capitalizedFinancingFees: number
  foreignExchangeLoss: number
  principal: number
  debtDrawdown: number
  debtService: number
  taxRatePercent: number | null
  taxAmountSourceReference?: string | null
  taxableDeduction: number
  taxCredit: number
  taxBeforeCredits: number
  tax: number
  unleveredTax: number
  taxLossCarryForward: number
  fixedInvestment: number
  preOperatingCost: number
  maintenanceCapex: number
  closingWorkingCapital: number
  rawMaterialsInventory: number
  workInProgressInventory: number
  finishedGoodsInventory: number
  cashInHand: number
  shortTermDeposits: number
  changeInWorkingCapital: number
  equityContribution: number
  equityWorkingCapitalContribution: number
  salvageValue: number
  salvageBookValueDisposed: number
  salvageGainLoss: number
  cfads: number
  dscr: number | null
  dscrCovenantStatus: 'not-tested' | 'pass' | 'breach'
  projectFreeCashFlow: number
  equityFreeCashFlow: number
  closingCash: number
  fundingGap: number
}
export type PeriodicProjectFinanceResult = {
  valid: boolean
  rows: PeriodicProjectFinanceRow[]
  loanSchedules: Record<string, PeriodicLoanRow[]>
  npvProject: number | null
  presentValueInvestment: number | null
  npvrProject: number | null
  irrProject: number | null
  mirrProject: number | null
  npvEquity: number | null
  irrEquity: number | null
  mirrEquity: number | null
  totalDebtDrawdown: number
  totalEquityContribution: number
  totalCapitalizedInterest: number
  peakWorkingCapital: number
  peakFundingGap: number
  openingCash: number
  automaticFundingSchedule: ComfarAutomaticFundingRow[]
  totalAutomaticEquity: number
  peakAutomaticOverdraft: number
  closingAutomaticOverdraft: number
  warnings: string[]
}

export function fiscalYearIndexForPeriod(period: ProjectCalendarPeriod, periods: ProjectCalendarPeriod[], fiscalYearStartMonth: number): number {
  const first = parseIsoDateUtc(periods[0]?.startDate ?? '')
  const current = parseIsoDateUtc(period.startDate)
  if (!first || !current || !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) return -1
  return fiscalYearStartFor(current, fiscalYearStartMonth).getUTCFullYear()
    - fiscalYearStartFor(first, fiscalYearStartMonth).getUTCFullYear()
}

export type PeriodicFiscalYearSummary = {
  fiscalYearIndex: number
  rows: PeriodicProjectFinanceRow[]
  projectFreeCashFlow: number
  /** Total shareholder funding, including separately identified shareholder-funded working capital. */
  equityContribution: number
  /** Net financing cash flow: drawdowns plus capitalized interest less principal repayments. */
  netDebtFinancingFlow: number
  taxRatePercent: number | null
  taxAmountSourceReference: string | null
  otherIncome: number
  otherIncomeSourceReference: string | null
  depreciation: number
  changeInWorkingCapital: number
  interestExpense: number
  principal: number
  debtService: number
  cfads: number
  dscr: number | null
}

/**
 * True only when every requested fiscal year is covered end-to-end by a
 * contiguous schedule, with no period straddling a fiscal-year boundary.
 */
export function hasCompleteFiscalYearCoverage(
  rows: PeriodicProjectFinanceRow[],
  fiscalYearStartMonth: number,
  fiscalYearCount: number,
  periodsPerYear: 1 | 2 | 4 | 12,
): boolean {
  if (!rows.length || !Number.isInteger(fiscalYearCount) || fiscalYearCount < 1 ||
      !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 ||
      ![1,2,4,12].includes(periodsPerYear) || rows.length!==fiscalYearCount*periodsPerYear) return false
  const periods: ProjectCalendarPeriod[] = rows.map(row=>({
    index:row.period,startDate:row.startDate,endDate:row.endDate,days:row.days,partial:false
  }))
  const starts=periods.map(period=>parseIsoDateUtc(period.startDate))
  const ends=periods.map(period=>parseIsoDateUtc(period.endDate))
  if(starts.some(date=>!date)||ends.some(date=>!date))return false
  const minDays=periodsPerYear===12?27:periodsPerYear===4?89:periodsPerYear===2?180:350
  const maxDays=periodsPerYear===12?32:periodsPerYear===4?93:periodsPerYear===2?184:367
  for(let index=0;index<periods.length;index++){
    const start=starts[index] as Date,end=ends[index] as Date
    if(!Number.isInteger(periods[index].days)||periods[index].days<minDays||periods[index].days>maxDays||
      end<start||Math.round((end.getTime()-start.getTime())/86400000)+1!==periods[index].days)return false
    if(index>0&&start.getTime()!==(ends[index-1] as Date).getTime()+86400000)return false
  }
  const grouped=Array.from({length:fiscalYearCount},()=>0)
  periods.forEach(period=>{
    const index=fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)
    if(index<0||index>=fiscalYearCount)return
    grouped[index]++
  })
  return grouped.every(count=>count===periodsPerYear)
}

/** Aggregate monthly/quarterly/semiannual rows onto the project's fiscal-year basis. */
export function aggregatePeriodicFinanceByFiscalYear(
  rows: PeriodicProjectFinanceRow[],
  fiscalYearStartMonth: number,
  fiscalYearCount: number,
): PeriodicFiscalYearSummary[] {
  if (!rows.length || !Number.isInteger(fiscalYearCount) || fiscalYearCount < 1 ||
      !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) return []
  const periods: ProjectCalendarPeriod[] = rows.map(row=>({
    index:row.period,startDate:row.startDate,endDate:row.endDate,days:row.days,partial:false
  }))
  const grouped=Array.from({length:fiscalYearCount},()=>[] as PeriodicProjectFinanceRow[])
  rows.forEach((row,index)=>{
    const fiscalIndex=fiscalYearIndexForPeriod(periods[index],periods,fiscalYearStartMonth)
    if(fiscalIndex>=0&&fiscalIndex<fiscalYearCount)grouped[fiscalIndex].push(row)
  })
  return grouped.map((yearRows,fiscalYearIndex)=>{
    const sum=(key:'projectFreeCashFlow'|'depreciation'|'changeInWorkingCapital'|'interestExpense'|'principal'|'debtService'|'cfads')=>
      yearRows.reduce((total,row)=>total+row[key],0)
    const equityContribution=yearRows.reduce((total,row)=>total+row.equityContribution+row.equityWorkingCapitalContribution,0)
    const netDebtFinancingFlow=yearRows.reduce((total,row)=>total+row.debtDrawdown+row.capitalizedInterest-row.principal,0)
    const rowTaxRates=yearRows.map(row=>row.taxRatePercent)
    const taxRates=[...new Set(rowTaxRates.filter((rate):rate is number=>rate!==null).map(rate=>Number(rate.toFixed(4))))]
    const taxSourceReferences=[...new Set(yearRows.map(row=>row.taxAmountSourceReference).filter((value):value is string=>!!value))]
    const otherIncomeSourceReferences=[...new Set(yearRows.map(row=>row.otherIncomeSourceReference).filter((value):value is string=>!!value))]
    const debtService=sum('debtService'),cfads=sum('cfads')
    return {
      fiscalYearIndex,rows:yearRows,projectFreeCashFlow:sum('projectFreeCashFlow'),
      equityContribution,netDebtFinancingFlow,
      taxRatePercent:rowTaxRates.every(rate=>rate!==null)&&taxRates.length===1?taxRates[0]:null,
      taxAmountSourceReference:taxSourceReferences.join(' | ')||null,
      otherIncome:sum('otherIncome'),otherIncomeSourceReference:otherIncomeSourceReferences.join(' | ')||null,
      depreciation:sum('depreciation'),
      changeInWorkingCapital:sum('changeInWorkingCapital'),interestExpense:sum('interestExpense'),
      principal:sum('principal'),debtService,cfads,dscr:debtService>0?cfads/debtService:null
    }
  })
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
    valid: false, rows: [], loanSchedules: {}, npvProject: null, presentValueInvestment: null, npvrProject: null, irrProject: null, mirrProject: null,
    npvEquity: null, irrEquity: null, mirrEquity: null, totalDebtDrawdown: 0,
    totalEquityContribution: 0, totalCapitalizedInterest: 0, peakWorkingCapital: 0, peakFundingGap: 0, openingCash: input.openingCash ?? 0,
    automaticFundingSchedule:[],totalAutomaticEquity:0,peakAutomaticOverdraft:0,closingAutomaticOverdraft:0,warnings
  })
  if (input.minimumDscr != null && (!validFinite(input.minimumDscr) || input.minimumDscr <= 0)) warnings.push('Minimum DSCR covenant must be a positive finite multiple.')
  if (!periods.length || (input.salvageValue != null && (!validFinite(input.salvageValue) || input.salvageValue < 0)) ||
      (input.salvageBookValue != null && (!validFinite(input.salvageBookValue) || input.salvageBookValue < 0)) ||
      (dayCountBasis !== 360 && dayCountBasis !== 365) ||
      !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 ||
      (input.minimumDscr != null && (!validFinite(input.minimumDscr) || input.minimumDscr <= 0)) ||
      !['period-end','mid-period'].includes(cashFlowTiming)) {
    warnings.push('Project periods, fiscal-year start month, day-count basis or cash-flow timing are invalid.')
    return empty()
  }
  const annualSeries = [
    input.annualRevenue, input.annualVariableCost, input.annualFixedCost, input.annualDepreciation,
    input.annualFixedInvestment, input.annualPreOperatingCost, input.annualMaintenanceCapex,
    input.annualTaxRates, input.annualEquityContributions,
    input.annualEquityWorkingCapitalContributions ?? Array(input.annualRevenue.length).fill(0),
    input.annualShortTermDepositInterest ?? Array(input.annualRevenue.length).fill(0),
  ]
  if (annualSeries.some(series => !Array.isArray(series) || !series.length || series.some(value => !validFinite(value))) ||
      annualSeries.slice(0,7).some(series => series.some(value => value < 0)) ||
      input.annualTaxRates.some(value => value < 0 || value > 100) ||
      (input.annualShortTermDepositInterest?.some(value => value < 0) ?? false) ||
      !Array.isArray(input.workingCapitalByPeriod) || input.workingCapitalByPeriod.length !== periods.length ||
      input.workingCapitalByPeriod.some(value => !validFinite(value)) ||
      (input.rawMaterialsInventoryByPeriod != null && (input.rawMaterialsInventoryByPeriod.length !== periods.length || input.rawMaterialsInventoryByPeriod.some(value => !validFinite(value) || value < 0))) ||
      (input.workInProgressInventoryByPeriod != null && (input.workInProgressInventoryByPeriod.length !== periods.length || input.workInProgressInventoryByPeriod.some(value => !validFinite(value) || value < 0))) ||
      (input.finishedGoodsInventoryByPeriod != null && (input.finishedGoodsInventoryByPeriod.length !== periods.length || input.finishedGoodsInventoryByPeriod.some(value => !validFinite(value) || value < 0))) ||
      (input.cashInHandByPeriod != null && (input.cashInHandByPeriod.length !== periods.length || input.cashInHandByPeriod.some(value => !validFinite(value) || value < 0))) ||
      (input.shortTermDepositsByPeriod != null && (input.shortTermDepositsByPeriod.length !== periods.length || input.shortTermDepositsByPeriod.some(value => !validFinite(value) || value < 0))) ||
      input.loans.some(loan => !loan.id || !loan.input) ||
      (input.foreignExchangeLossByPeriod!=null&&(input.foreignExchangeLossByPeriod.length!==periods.length||input.foreignExchangeLossByPeriod.some(value=>!validFinite(value)))) ||
      Object.entries(input.loanScheduleOverrides??{}).some(([id,rows])=>!input.loans.some(loan=>loan.id===id)||!Array.isArray(rows)||rows.length!==periods.length||rows.some((row,index)=>!row||row.period!==index+1||![row.drawdown,row.openingBalance,row.periodRatePercent,row.interestExpense,row.capitalizedInterest,row.financingFeeExpense,row.commitmentFeeExpense,row.capitalizedFinancingFees,row.principal,row.closingBalance,row.debtService].every(validFinite)||[row.drawdown,row.openingBalance,row.interestExpense,row.capitalizedInterest,row.financingFeeExpense,row.commitmentFeeExpense,row.capitalizedFinancingFees,row.principal,row.closingBalance,row.debtService].some(value=>value<0)))) {
    warnings.push('Annual flow arrays, tax rates, working-capital balances must be finite (negative net working capital is valid), or loan definitions are invalid.')
    return empty()
  }
  if(input.taxCreditsByPeriod&&(input.taxCreditsByPeriod.length!==periods.length||input.taxCreditsByPeriod.some(value=>!validFinite(value)||value<0))){
    warnings.push('Tax credits must contain one finite non-negative amount for every project period.')
    return empty()
  }
  if(input.taxableDeductionsByPeriod&&(input.taxableDeductionsByPeriod.length!==periods.length||input.taxableDeductionsByPeriod.some(value=>!validFinite(value)||value<0))){
    warnings.push('Taxable-income deductions must contain one finite non-negative amount for every project period.')
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
  const assetSaleSchedule = input.annualAssetSaleSchedule ?? []
  const validateSaleRow = (row: {saleProceeds:number;returnOfCapital:number;otherIncomeLoss:number;bookValueDisposed:number}) =>
    [row.saleProceeds,row.returnOfCapital,row.otherIncomeLoss,row.bookValueDisposed].every(validFinite) &&
    row.saleProceeds >= 0 && row.returnOfCapital >= 0 && row.bookValueDisposed >= 0 &&
    row.returnOfCapital <= row.bookValueDisposed + 0.01 &&
    Math.abs(row.saleProceeds-row.returnOfCapital-row.otherIncomeLoss) <= 0.01
  if (assetSaleSchedule.some(row=>!validateSaleRow(row)) ||
      (input.periodAssetSaleSchedule && (input.periodAssetSaleSchedule.length!==periods.length ||
        input.periodAssetSaleSchedule.some(row=>!validateSaleRow(row))))) {
    warnings.push('Asset disposal schedules must reconcile proceeds, return of capital and other income/loss for every period.')
    return empty()
  }
  const assetSalesByPeriod = input.periodAssetSaleSchedule
    ? input.periodAssetSaleSchedule.map(row=>({...row}))
    : periods.map(() => ({saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}))
  if (!input.periodAssetSaleSchedule) {
    for (let year = 0; year < assetSaleSchedule.length; year++) {
      const row = assetSaleSchedule[year]
      const matchingPeriods = periods.map((period,index)=>({period,index}))
        .filter(({period})=>fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)===year)
      if (!matchingPeriods.length) {
        if (row.saleProceeds !== 0 || row.returnOfCapital !== 0 || row.otherIncomeLoss !== 0 || row.bookValueDisposed !== 0) {
          warnings.push('An annual asset disposal falls outside the project calendar.')
          return empty()
        }
        continue
      }
      const target = matchingPeriods[matchingPeriods.length-1].index
      assetSalesByPeriod[target] = {...row}
    }
  }
  const [allocatedRevenue, allocatedVariableCost, fixedCost, allocatedDepreciation, fixedInvestment, preOperatingCost, maintenanceCapex, , equityContribution, allocatedEquityWorkingCapitalContribution, shortTermDepositInterest] = allocated
  if(input.periodSubsidyIncome&&(input.periodSubsidyIncome.length!==periods.length||input.periodSubsidyIncome.some(value=>!validFinite(value)||value<0))){
    warnings.push('Period subsidy income must contain one finite non-negative amount for every project period.')
    return empty()
  }
  const periodOperatingOverrides = [input.periodRevenue, input.periodVariableCost]
  if (periodOperatingOverrides.some(series => series != null && (series.length !== periods.length || series.some(value => !validFinite(value) || value < 0)))) {
    warnings.push('Period revenue and cost-of-sales schedules must contain one finite non-negative amount for every project period.')
    return empty()
  }
  if (input.periodAbnormalWasteExpense != null &&
      (input.periodAbnormalWasteExpense.length !== periods.length ||
       input.periodAbnormalWasteExpense.some(value => !validFinite(value)))) {
    warnings.push('Period abnormal-waste expense adjustments must contain one finite signed amount for every project period.')
    return empty()
  }
  const revenue = input.periodRevenue ? [...input.periodRevenue] : allocatedRevenue
  const variableCost = input.periodVariableCost ? [...input.periodVariableCost] : allocatedVariableCost
  for (let fiscalIndex = 0; fiscalIndex < input.annualRevenue.length; fiscalIndex++) {
    const indices = periods.map((period,index)=>({period,index})).filter(item=>fiscalYearIndexForPeriod(item.period,periods,fiscalYearStartMonth)===fiscalIndex).map(item=>item.index)
    if (input.periodRevenue && Math.abs(indices.reduce((sum,index)=>sum+revenue[index],0)-(input.annualRevenue[fiscalIndex]??0))>0.01) {
      warnings.push('Product-led period revenue does not reconcile to annual revenue in fiscal year '+(fiscalIndex+1)+'.')
      return empty()
    }
    if (input.periodVariableCost && Math.abs(indices.reduce((sum,index)=>sum+variableCost[index],0)-(input.annualVariableCost[fiscalIndex]??0))>0.01) {
      warnings.push('Product-led period cost of sales does not reconcile to annual variable cost in fiscal year '+(fiscalIndex+1)+'.')
      return empty()
    }
  }
  const equityWorkingCapitalContribution = allocatedEquityWorkingCapitalContribution ?? Array(periods.length).fill(Number.NaN)
  const depreciation = input.periodDepreciationSchedule ? [...input.periodDepreciationSchedule] : allocatedDepreciation
  if (input.periodDepreciationSchedule && (input.periodDepreciationSchedule.length!==periods.length ||
      input.periodDepreciationSchedule.some(value=>!validFinite(value)||value<0))) {
    warnings.push('Period depreciation schedule must contain one finite non-negative value for every project period.')
    return empty()
  }
  if (input.periodDepreciationSchedule) {
    for (let year=0;year<input.annualDepreciation.length;year++) {
      const periodTotal=periods.reduce((sum,period,index)=>
        fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)===year?sum+depreciation[index]:sum,0)
      if (Math.abs(periodTotal-(input.annualDepreciation[year]??0))>0.01) {
        warnings.push('Annual and period depreciation schedules do not reconcile for fiscal year '+(year+1)+'.')
        return empty()
      }
    }
  }
  if (input.periodAssetSaleSchedule && assetSaleSchedule.length) {
    for (let year=0;year<assetSaleSchedule.length;year++) {
      const total={saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}
      periods.forEach((period,index)=>{
        if (fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)===year) {
          const row=input.periodAssetSaleSchedule![index]
          total.saleProceeds+=row.saleProceeds
          total.returnOfCapital+=row.returnOfCapital
          total.otherIncomeLoss+=row.otherIncomeLoss
          total.bookValueDisposed+=row.bookValueDisposed
        }
      })
      const annual=assetSaleSchedule[year]
      if (Math.abs(total.saleProceeds-annual.saleProceeds)>0.01 ||
          Math.abs(total.returnOfCapital-annual.returnOfCapital)>0.01 ||
          Math.abs(total.otherIncomeLoss-annual.otherIncomeLoss)>0.01 ||
          Math.abs(total.bookValueDisposed-annual.bookValueDisposed)>0.01) {
        warnings.push('Annual and period asset disposal schedules do not reconcile for fiscal year '+(year+1)+'.')
        return empty()
      }
    }
  }
  const taxRates = input.taxRatesByPeriod ? [...input.taxRatesByPeriod] : periods.map(period => {
    const index = fiscalYearIndexForPeriod(period, periods, fiscalYearStartMonth)
    return index >= 0 ? input.annualTaxRates[index] : Number.NaN
  })
  if (taxRates.some(rate => !validFinite(rate))) {
    warnings.push('Annual tax-rate schedule does not cover every project fiscal period.')
    return empty()
  }
  if (input.periodOtherIncomeByPeriod && (
      input.periodOtherIncomeByPeriod.length !== periods.length ||
      input.periodOtherIncomeByPeriod.some(amount => !validFinite(amount)) ||
      !input.periodOtherIncomeSourceReference?.trim()
  )) {
    warnings.push('Other-income schedule requires one finite amount per project period and a source reference.')
    return empty()
  }
  if (input.taxAmountOverridesByPeriod && (
      input.taxAmountOverridesByPeriod.length !== periods.length ||
      input.taxAmountOverridesByPeriod.some(amount => !validFinite(amount) || amount < 0) ||
      !input.taxAmountSourceReference?.trim() ||
      (input.taxableDeductionsByPeriod?.some(amount => amount !== 0) ?? false) ||
      (input.taxCreditsByPeriod?.some(amount => amount !== 0) ?? false)
  )) {
    warnings.push('Documented tax amounts require one finite non-negative amount per period, a source reference, and no additional tax deductions or credits.')
    return empty()
  }
  const loanSchedules: Record<string, PeriodicLoanRow[]> = {}
  for (const loan of input.loans) {
    const override=input.loanScheduleOverrides?.[loan.id]
    const schedule = override?{valid:true,rows:override,issues:[]}:calculatePeriodicLoanSchedule(loan.input, periods, dayCountBasis)
    if (!schedule.valid) {
      warnings.push(...schedule.issues.map(issue => loan.id + ': ' + issue))
      return empty()
    }
    loanSchedules[loan.id] = schedule.rows
  }
  if(input.foreignExchangeLossByPeriod){
    const scheduledFx=input.foreignExchangeLossByPeriod.map((_,index)=>Object.values(loanSchedules).reduce((sum,schedule)=>{
      const row=schedule[index]
      return sum+row.closingBalance-row.openingBalance-row.drawdown-row.capitalizedInterest-row.capitalizedFinancingFees+row.principal
    },0))
    if(scheduledFx.some((amount,index)=>Math.abs(amount-input.foreignExchangeLossByPeriod![index])>0.01)){
      warnings.push('Foreign-exchange debt remeasurement does not reconcile to the translated loan schedules.')
      return empty()
    }
  }
  if (input.annualEquityContributions.some(value => value < 0) ||
      !validFinite(input.openingWorkingCapital ?? 0) ||
      (input.openingCash != null && !validFinite(input.openingCash)) ||
      (input.constructionPeriodCount != null && (!validFinite(input.constructionPeriodCount) || !Number.isInteger(input.constructionPeriodCount) || input.constructionPeriodCount < 0 || input.constructionPeriodCount > periods.length)) ||
      !validFinite(input.salvageValue ?? 0) || (input.salvageValue ?? 0) < 0 ||
      (input.discountRatePercent != null && (!validFinite(input.discountRatePercent) || input.discountRatePercent <= -100)) ||
      (input.equityDiscountRatePercent != null && (!validFinite(input.equityDiscountRatePercent) || input.equityDiscountRatePercent <= -100)) ||
      (input.mirrFinanceRatePercent != null && (!validFinite(input.mirrFinanceRatePercent) || input.mirrFinanceRatePercent <= -100)) ||
      (input.mirrReinvestmentRatePercent != null && (!validFinite(input.mirrReinvestmentRatePercent) || input.mirrReinvestmentRatePercent <= -100)) ||
      new Set(input.loans.map(loan => loan.id)).size !== input.loans.length) {
    warnings.push('Equity, opening working capital, salvage, discount rates or loan identifiers are invalid.')
    return empty()
  }
  const openingLoss = input.openingTaxLoss ?? 0
  const openingUnleveredLoss = input.openingUnleveredTaxLoss ?? 0
  const lossCarryForwardEnabled=input.taxLossCarryForwardEnabled??true
  const lossCarryForwardYears=input.taxLossCarryForwardYears??null
  const openingTaxLossVintages=input.openingTaxLossVintages??(openingLoss>0&&lossCarryForwardYears!==null?[]:openingLoss>0?[{amount:openingLoss,originFiscalYearIndex:0}]:[])
  const openingUnleveredLossVintages=input.openingUnleveredTaxLossVintages??(openingUnleveredLoss>0&&lossCarryForwardYears!==null?[]:openingUnleveredLoss>0?[{amount:openingUnleveredLoss,originFiscalYearIndex:0}]:[])
  const validVintages=(items:TaxLossVintage[],total:number)=>Array.isArray(items)&&items.every(item=>item&&validFinite(item.amount)&&item.amount>0&&Number.isInteger(item.originFiscalYearIndex)&&item.originFiscalYearIndex<=0)&&Math.abs(items.reduce((sum,item)=>sum+item.amount,0)-total)<=0.01
  if(typeof lossCarryForwardEnabled!=='boolean'||
    (lossCarryForwardYears!==null&&(!Number.isInteger(lossCarryForwardYears)||lossCarryForwardYears<1))||
    (lossCarryForwardEnabled&&lossCarryForwardYears!==null&&
      (!validVintages(openingTaxLossVintages,openingLoss)||!validVintages(openingUnleveredLossVintages,openingUnleveredLoss)))){
    warnings.push('Tax-loss carry-forward settings or opening loss vintages are incomplete or invalid.')
    return empty()
  }
  if (!validFinite(openingLoss) || openingLoss < 0 || !validFinite(openingUnleveredLoss) || openingUnleveredLoss < 0) {
    warnings.push('Opening tax-loss balances must be finite and non-negative.')
    return empty()
  }
  const rows: PeriodicProjectFinanceRow[] = []
  let cashBalance = input.openingCash ?? 0
  let peakFundingGap = 0
  let taxLoss = openingLoss
  let unleveredTaxLoss = openingUnleveredLoss
  let taxLossVintages=[...openingTaxLossVintages]
  let unleveredTaxLossVintages=[...openingUnleveredLossVintages]
  let priorWorkingCapital = input.openingWorkingCapital ?? 0
  for (let index = 0; index < periods.length; index++) {
    const loanRows = Object.values(loanSchedules).map(schedule => schedule[index])
    // Financing fees paid as period expenses are deductible financing costs;
    // capitalized fees remain separately visible in each loan schedule and are
    // included in the period's capitalized financing balance.
    const cashInterestExpense = loanRows.reduce((sum,row)=>sum+row.interestExpense,0)
    const financingFeeExpense = loanRows.reduce((sum,row)=>sum+row.financingFeeExpense,0)
    const commitmentFeeExpense = loanRows.reduce((sum,row)=>sum+row.commitmentFeeExpense,0)
    // Preserve the existing total-financing-cost field for downstream consumers,
    // while exposing its components for audit trails and lender reporting.
    const interestExpense = cashInterestExpense + financingFeeExpense
    const foreignExchangeLoss=input.foreignExchangeLossByPeriod?.[index]??0
    const capitalizedInterest = loanRows.reduce((sum,row)=>sum+row.capitalizedInterest,0)
    const capitalizedFinancingFees = loanRows.reduce((sum,row)=>sum+row.capitalizedFinancingFees,0)
    const principal = loanRows.reduce((sum,row)=>sum+row.principal,0)
    const debtDrawdown = loanRows.reduce((sum,row)=>sum+row.drawdown,0)
    const assetSale = assetSalesByPeriod[index]
    const terminalSalvage = index === periods.length - 1 ? Math.max(0,input.salvageValue ?? 0) : 0
    const salvageBookValueDisposed = index === periods.length - 1 ? Math.max(0,input.salvageBookValue ?? 0) : 0
    const salvageGainLoss = terminalSalvage - salvageBookValueDisposed
    const abnormalWasteExpense=input.periodAbnormalWasteExpense?.[index]??0
    const otherIncome=input.periodOtherIncomeByPeriod?.[index]??0
    const ebit = revenue[index] + otherIncome - variableCost[index] - fixedCost[index] - abnormalWasteExpense - depreciation[index] +
      assetSale.otherIncomeLoss + salvageGainLoss
    const currentFiscalYearIndex=fiscalYearIndexForPeriod(periods[index],periods,fiscalYearStartMonth)
    const taxableDeduction=input.taxableDeductionsByPeriod?.[index]??0
    const periodTaxWithExpiry=calculatePeriodTaxWithLossExpiry(
      ebit+shortTermDepositInterest[index]-interestExpense-foreignExchangeLoss-taxableDeduction,taxRates[index],taxLossVintages,currentFiscalYearIndex,
      lossCarryForwardEnabled?lossCarryForwardYears:null,lossCarryForwardEnabled)
    const unleveredTaxWithExpiry=calculatePeriodTaxWithLossExpiry(
      ebit+shortTermDepositInterest[index]-taxableDeduction,taxRates[index],unleveredTaxLossVintages,currentFiscalYearIndex,
      lossCarryForwardEnabled?lossCarryForwardYears:null,lossCarryForwardEnabled)
    const documentedTaxAmount=input.taxAmountOverridesByPeriod?.[index]
    const hasDocumentedTaxAmount=documentedTaxAmount!==undefined
    const taxCredit=hasDocumentedTaxAmount?0:Math.min(input.taxCreditsByPeriod?.[index]??0,periodTaxWithExpiry.tax)
    const unleveredTaxCredit=hasDocumentedTaxAmount?0:Math.min(input.taxCreditsByPeriod?.[index]??0,unleveredTaxWithExpiry.tax)
    const periodTax:PeriodTaxResult={...periodTaxWithExpiry,tax:hasDocumentedTaxAmount?documentedTaxAmount:periodTaxWithExpiry.tax-taxCredit}
    const unleveredPeriodTax:PeriodTaxResult={...unleveredTaxWithExpiry,tax:hasDocumentedTaxAmount?documentedTaxAmount:unleveredTaxWithExpiry.tax-unleveredTaxCredit}
    if (![periodTax.tax,unleveredPeriodTax.tax,taxCredit,unleveredTaxCredit].every(validFinite)) {
      warnings.push('Tax calculation failed in project period ' + (index + 1) + '.')
      return empty()
    }
    taxLoss=periodTax.closingLossCarryForward
    unleveredTaxLoss=unleveredPeriodTax.closingLossCarryForward
    taxLossVintages=periodTaxWithExpiry.closingLossVintages
    unleveredTaxLossVintages=unleveredTaxWithExpiry.closingLossVintages
    const closingWorkingCapital = input.workingCapitalByPeriod[index]
    const changeInWorkingCapital = closingWorkingCapital - priorWorkingCapital
    const equityWorkingCapitalContributionAmount = input.annualEquityWorkingCapitalContributions
      ? equityWorkingCapitalContribution[index]
      : 0
    const equityWorkingCapitalCashFlow = input.annualEquityWorkingCapitalContributions
      ? (changeInWorkingCapital < 0
        ? changeInWorkingCapital + equityWorkingCapitalContributionAmount
        : equityWorkingCapitalContributionAmount)
      : changeInWorkingCapital
    if (input.annualEquityWorkingCapitalContributions &&
        (!validFinite(equityWorkingCapitalContributionAmount) || equityWorkingCapitalContributionAmount < 0)) {
      warnings.push('Shareholder working-capital funding must be finite and non-negative (period ' + (index + 1) + ').')
      return empty()
    }
    const cfads = revenue[index] + otherIncome + shortTermDepositInterest[index] - variableCost[index] - fixedCost[index] - abnormalWasteExpense - periodTax.tax
      - maintenanceCapex[index] - changeInWorkingCapital + assetSale.saleProceeds
    const debtService = interestExpense + principal
    const dscr = debtService > 0 ? cfads / debtService : null
    const dscrCovenantStatus: 'not-tested' | 'pass' | 'breach' = input.minimumDscr == null || dscr == null
      ? 'not-tested' : dscr + 1e-9 >= input.minimumDscr ? 'pass' : 'breach'
    if (dscrCovenantStatus === 'breach') warnings.push('Minimum DSCR covenant breached in period ' + (index + 1) + ': actual ' + dscr!.toFixed(4) + ', minimum ' + input.minimumDscr!.toFixed(4) + '.')
    const projectFreeCashFlow = ebit + shortTermDepositInterest[index] - assetSale.otherIncomeLoss - salvageGainLoss - unleveredPeriodTax.tax + depreciation[index]
      - fixedInvestment[index] - preOperatingCost[index] - maintenanceCapex[index]
      - changeInWorkingCapital + assetSale.saleProceeds + terminalSalvage
    const equityFreeCashFlow = -equityContribution[index] + revenue[index] + otherIncome + shortTermDepositInterest[index] - variableCost[index] - fixedCost[index] - abnormalWasteExpense
      - periodTax.tax - interestExpense - principal - maintenanceCapex[index]
      - equityWorkingCapitalCashFlow + assetSale.saleProceeds + terminalSalvage
    const periodCashChange = revenue[index] + otherIncome + shortTermDepositInterest[index] - variableCost[index] - fixedCost[index] - abnormalWasteExpense - periodTax.tax
      - interestExpense - principal - fixedInvestment[index] - preOperatingCost[index] - maintenanceCapex[index]
      - changeInWorkingCapital + assetSale.saleProceeds + terminalSalvage + debtDrawdown
      + equityContribution[index] + equityWorkingCapitalContributionAmount
    const closingCash = cashBalance + periodCashChange
    const fundingGap = Math.max(0, -closingCash)
    peakFundingGap = Math.max(peakFundingGap, fundingGap)
    if (fundingGap > 0.01) warnings.push('Funding shortfall at the end of project period ' + (index + 1) + ': ' + fundingGap.toFixed(2) + '.')
    rows.push({
      period:index+1,startDate:periods[index].startDate,endDate:periods[index].endDate,days:periods[index].days,
      revenue:revenue[index],subsidyIncome:input.periodSubsidyIncome?.[index]??0,otherIncome,otherIncomeSourceReference:otherIncome!==0?input.periodOtherIncomeSourceReference??null:null,shortTermDepositInterest:shortTermDepositInterest[index],variableCost:variableCost[index],fixedCost:fixedCost[index],abnormalWasteExpense,depreciation:depreciation[index],ebit,
      assetSaleProceeds:assetSale.saleProceeds,assetReturnOfCapital:assetSale.returnOfCapital,
      assetSaleOtherIncomeLoss:assetSale.otherIncomeLoss,assetBookValueDisposed:assetSale.bookValueDisposed,
      interestExpense,cashInterestExpense,financingFeeExpense,commitmentFeeExpense,
      capitalizedInterest,capitalizedFinancingFees,foreignExchangeLoss,principal,debtDrawdown,debtService,taxRatePercent:hasDocumentedTaxAmount?null:taxRates[index],taxAmountSourceReference:hasDocumentedTaxAmount?input.taxAmountSourceReference??null:null,taxableDeduction,taxCredit,taxBeforeCredits:hasDocumentedTaxAmount?documentedTaxAmount:periodTaxWithExpiry.tax,
      tax:periodTax.tax,unleveredTax:unleveredPeriodTax.tax,taxLossCarryForward:taxLoss,
      fixedInvestment:fixedInvestment[index],preOperatingCost:preOperatingCost[index],maintenanceCapex:maintenanceCapex[index],
      closingWorkingCapital,rawMaterialsInventory:input.rawMaterialsInventoryByPeriod?.[index]??0,workInProgressInventory:input.workInProgressInventoryByPeriod?.[index]??0,finishedGoodsInventory:input.finishedGoodsInventoryByPeriod?.[index]??0,
      cashInHand:input.cashInHandByPeriod?.[index]??0,shortTermDeposits:input.shortTermDepositsByPeriod?.[index]??0,
      changeInWorkingCapital,equityContribution:equityContribution[index],
      equityWorkingCapitalContribution:equityWorkingCapitalContributionAmount,
      salvageValue:terminalSalvage,salvageBookValueDisposed,salvageGainLoss,cfads,dscr,dscrCovenantStatus,projectFreeCashFlow,equityFreeCashFlow,
      closingCash,fundingGap
    })
    cashBalance = closingCash
    priorWorkingCapital = closingWorkingCapital
  }
  const constructionPeriodCount = Math.max(0,Math.min(periods.length,Math.floor(input.constructionPeriodCount ?? 0)))
  let rawCashBalance = input.openingCash ?? 0
  let automaticallyFundedCashBalance = input.openingCash ?? 0
  let automaticOverdraftBalance = 0
  const automaticFundingSchedule: ComfarAutomaticFundingRow[] = rows.map((row,index) => {
    const periodCashChange = row.closingCash - rawCashBalance
    rawCashBalance = row.closingCash
    automaticallyFundedCashBalance += periodCashChange
    let automaticEquity = 0
    let automaticOverdraftDrawdown = 0
    let automaticOverdraftRepayment = 0
    if (index < constructionPeriodCount) {
      if (automaticallyFundedCashBalance < 0) {
        automaticEquity = -automaticallyFundedCashBalance
        automaticallyFundedCashBalance = 0
      }
    } else if (automaticallyFundedCashBalance < 0) {
      automaticOverdraftDrawdown = -automaticallyFundedCashBalance
      automaticOverdraftBalance += automaticOverdraftDrawdown
      automaticallyFundedCashBalance = 0
    } else if (automaticallyFundedCashBalance > 0 && automaticOverdraftBalance > 0) {
      automaticOverdraftRepayment = Math.min(automaticallyFundedCashBalance,automaticOverdraftBalance)
      automaticallyFundedCashBalance -= automaticOverdraftRepayment
      automaticOverdraftBalance -= automaticOverdraftRepayment
    }
    return {period:row.period,automaticEquity,automaticOverdraftDrawdown,automaticOverdraftRepayment,automaticOverdraftBalance}
  })
  const totalAutomaticEquity = automaticFundingSchedule.reduce((sum,row)=>sum+row.automaticEquity,0)
  const peakAutomaticOverdraft = Math.max(0,...automaticFundingSchedule.map(row=>row.automaticOverdraftBalance))
  const closingAutomaticOverdraft = automaticFundingSchedule.length ? automaticFundingSchedule[automaticFundingSchedule.length-1].automaticOverdraftBalance : 0
  const projectFlows = rows.map(row=>row.projectFreeCashFlow)
  const equityFlows = rows.map(row=>row.equityFreeCashFlow)
  const investmentFlows = rows.map(row=>row.fixedInvestment + row.preOperatingCost + Math.max(0,row.changeInWorkingCapital))
  const discountRate = input.discountRatePercent
  const npvProject = discountRate == null ? null : calculatePeriodicNpv(projectFlows,periods,discountRate,dayCountBasis,cashFlowTiming,input.valuationDate,input.discountConvention??'actual-days',input.discountPeriodsPerYear??1)
  const presentValueInvestment = discountRate == null ? null : calculatePeriodicNpv(investmentFlows,periods,discountRate,dayCountBasis,cashFlowTiming,input.valuationDate,input.discountConvention??'actual-days',input.discountPeriodsPerYear??1)
  const npvrProject = npvProject !== null && presentValueInvestment !== null && presentValueInvestment > 0 ? npvProject / presentValueInvestment : null
  const equityDiscountRate = input.equityDiscountRatePercent ?? discountRate
  const npvEquity = equityDiscountRate == null ? null : calculatePeriodicNpv(equityFlows,periods,equityDiscountRate,dayCountBasis,cashFlowTiming,input.valuationDate,input.discountConvention??'actual-days',input.discountPeriodsPerYear??1)
  const mirrProject = input.mirrFinanceRatePercent == null || input.mirrReinvestmentRatePercent == null ? null
    : calculatePeriodicMirr(projectFlows,periods,input.mirrFinanceRatePercent,input.mirrReinvestmentRatePercent,dayCountBasis,cashFlowTiming)
  const mirrEquity = input.mirrFinanceRatePercent == null || input.mirrReinvestmentRatePercent == null ? null
    : calculatePeriodicMirr(equityFlows,periods,input.mirrFinanceRatePercent,input.mirrReinvestmentRatePercent,dayCountBasis,cashFlowTiming)
  const signChanges = (flows: number[]) => { const nonZero=flows.filter(value=>value!==0); let changes=0; for(let index=1;index<nonZero.length;index++) if(Math.sign(nonZero[index])!==Math.sign(nonZero[index-1])) changes++; return changes }
  if (signChanges(projectFlows) > 1 || signChanges(equityFlows) > 1)
    warnings.push('Non-conventional cash-flow signs may produce multiple IRR roots; the reported IRR is one numerical root only.')
  const totalDebtDrawdown = rows.reduce((sum,row)=>sum+row.debtDrawdown,0)
  const totalEquityContribution = rows.reduce((sum,row)=>sum+row.equityContribution+row.equityWorkingCapitalContribution,0)
  const totalCapitalizedInterest = rows.reduce((sum,row)=>sum+row.capitalizedInterest,0)
  return {
    valid:true,rows,loanSchedules,npvProject,presentValueInvestment,npvrProject,irrProject:calculatePeriodicIrr(projectFlows,periods,dayCountBasis,cashFlowTiming),
    mirrProject,npvEquity,irrEquity:calculatePeriodicIrr(equityFlows,periods,dayCountBasis,cashFlowTiming),mirrEquity,
    totalDebtDrawdown,totalEquityContribution,totalCapitalizedInterest,
    peakWorkingCapital:Math.max(0,...input.workingCapitalByPeriod),peakFundingGap,openingCash:input.openingCash??0,
    automaticFundingSchedule,totalAutomaticEquity,peakAutomaticOverdraft,closingAutomaticOverdraft,warnings
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
      (asset.method==='accelerated'&&(asset.ratePercent==null||!validFinite(asset.ratePercent)||asset.ratePercent<=0||asset.ratePercent>100))||
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
      (sale.priceMode==='self-defined'&&(sale.selfDefinedPrice==null||!validFinite(sale.selfDefinedPrice)||sale.selfDefinedPrice<0||
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


export type PeriodicStatementOpeningBalances = {
  cash?: number
  debt?: number
  netFixedAssets?: number
  netWorkingCapital?: number
  rawMaterialsInventory?: number
  workInProgressInventory?: number
  finishedGoodsInventory?: number
  deferredPreOperatingAssets?: number
  paidInCapital?: number
  retainedEarnings?: number
  grants?: number
}
export type PeriodicFinancialStatement = {
  period: number
  startDate: string
  endDate: string
  openingBalances: Required<PeriodicStatementOpeningBalances>
  incomeStatement: {
    revenue: number; shortTermDepositInterest: number; cashOperatingCosts: number; abnormalWasteExpense: number; ebitda: number; depreciation: number
    assetDisposalGainLoss: number; ebit: number; interest: number
    cashInterestExpense: number; financingFeeExpense: number; commitmentFeeExpense: number
    profitBeforeTax: number; foreignExchangeGainLoss: number; taxableDeductions: number; taxCredits: number; taxBeforeCredits: number; tax: number; netIncome: number
  }
  cashFlowStatement: {
    operatingCashFlow: number; investingCashFlow: number; financingCashFlow: number
    automaticEquityContribution: number; automaticOverdraftDrawdown: number; automaticOverdraftRepayment: number
    netChangeInCash: number; closingCash: number
  }
  balanceSheet: {
    cash: number; cashInHand: number; shortTermDeposits: number; netWorkingCapital: number; rawMaterialsInventory: number; workInProgressInventory: number; finishedGoodsInventory: number; otherNetWorkingCapital: number; netFixedAssets: number; deferredPreOperatingAssets: number
    automaticOverdraft: number
    totalAssets: number; debt: number; totalLiabilities: number; paidInCapital: number
    retainedEarnings: number; grants: number; totalEquity: number; totalLiabilitiesAndEquity: number
    balanceDifference: number; reconciled: boolean
  }
  movementChecks: {
    cash: number; cashRollForward: number; debt: number; automaticOverdraft: number; netWorkingCapital: number; netFixedAssets: number
    deferredPreOperatingAssets: number; paidInCapital: number; retainedEarnings: number; grants: number
  }
}

/**
 * Builds period-level linked statements. Working capital is represented as net working
 * capital (current assets less operating payables); no unsupported gross split is inferred.
 * Capitalized interest is a non-cash addition to both deferred pre-operating assets and debt.
 * COMFAR XI.N automatic construction equity and production overdraft are posted
 * to financing cash flow, paid-in capital and debt instead of remaining a detached schedule.
 */

export type PeriodicSensitivityCell = {
  priceChangePercent:number
  volumeChangePercent:number
  npv:number|null
  irr:number|null
}
export type PeriodicFinancialScenarioSet = {
  pessimistic:PeriodicProjectFinanceResult
  base:PeriodicProjectFinanceResult
  optimistic:PeriodicProjectFinanceResult
}
function scalePeriodicOperatingInput(
  input:PeriodicProjectFinanceInput,
  priceFactor:number,
  volumeFactor:number,
  variableCostFactor:number,
  fixedCostFactor:number,
  capexFactor:number,
):PeriodicProjectFinanceInput {
  const scale=(values:number[]|undefined,factor:number)=>values?.map(value=>value*factor)
  return {
    ...input,
    annualRevenue:input.annualRevenue.map(value=>value*priceFactor*volumeFactor),
    periodRevenue:scale(input.periodRevenue,priceFactor*volumeFactor),
    periodSubsidyIncome:scale(input.periodSubsidyIncome,priceFactor*volumeFactor),
    annualVariableCost:input.annualVariableCost.map(value=>value*variableCostFactor*volumeFactor),
    periodVariableCost:scale(input.periodVariableCost,variableCostFactor*volumeFactor),
    annualFixedCost:input.annualFixedCost.map(value=>value*fixedCostFactor),
    annualDepreciation:input.annualDepreciation.map(value=>value*capexFactor),
    periodDepreciationSchedule:scale(input.periodDepreciationSchedule,capexFactor),
    annualFixedInvestment:input.annualFixedInvestment.map(value=>value*capexFactor),
    annualPreOperatingCost:input.annualPreOperatingCost.map(value=>value*capexFactor),
    annualMaintenanceCapex:input.annualMaintenanceCapex.map(value=>value*capexFactor),
    workingCapitalByPeriod:scale(input.workingCapitalByPeriod,volumeFactor)??[],
    rawMaterialsInventoryByPeriod:scale(input.rawMaterialsInventoryByPeriod,volumeFactor),
    workInProgressInventoryByPeriod:scale(input.workInProgressInventoryByPeriod,volumeFactor),
    finishedGoodsInventoryByPeriod:scale(input.finishedGoodsInventoryByPeriod,volumeFactor),
    cashInHandByPeriod:scale(input.cashInHandByPeriod,volumeFactor),
    shortTermDepositsByPeriod:scale(input.shortTermDepositsByPeriod,volumeFactor),
    annualEquityWorkingCapitalContributions:scale(input.annualEquityWorkingCapitalContributions,volumeFactor),
  }
}

/**
 * Two-way sensitivity using the same validated periodic model as the base case.
 * Price changes affect revenue; volume changes proportionally affect sales,
 * cost of sales and operating working capital. Financing and tax assumptions
 * remain fixed unless explicitly changed in the scenario inputs.
 */
export function calculatePeriodicSensitivityMatrix(
  input:PeriodicProjectFinanceInput,
  priceChanges=[-20,-10,0,10,20],
  volumeChanges=[-20,-10,0,10,20],
):PeriodicSensitivityCell[][] {
  return volumeChanges.map(volumeChangePercent=>priceChanges.map(priceChangePercent=>{
    const scenario=scalePeriodicOperatingInput(input,1+priceChangePercent/100,
      1+volumeChangePercent/100,1,1,1)
    const result=calculateIntegratedPeriodicFinance(scenario)
    return {priceChangePercent,volumeChangePercent,
      npv:result.valid?result.npvProject:null,irr:result.valid?result.irrProject:null}
  }))
}

/** Pessimistic/base/optimistic cases on the complete periodic model, including debt, tax and FX schedules. */
export function calculatePeriodicFinancialScenarios(input:PeriodicProjectFinanceInput):PeriodicFinancialScenarioSet {
  return {
    pessimistic:calculateIntegratedPeriodicFinance(scalePeriodicOperatingInput(input,.9,.85,1.15,1.1,1.1)),
    base:calculateIntegratedPeriodicFinance(scalePeriodicOperatingInput(input,1,1,1,1,1)),
    optimistic:calculateIntegratedPeriodicFinance(scalePeriodicOperatingInput(input,1.1,1.1,.95,.98,.95)),
  }
}

export function buildPeriodicThreeFinancialStatements(
  result: PeriodicProjectFinanceResult,
  opening: PeriodicStatementOpeningBalances = {},
  tolerance = 0.01,
): PeriodicFinancialStatement[] {
  if (!result.valid || !Number.isFinite(tolerance) || tolerance < 0) return []
  const balances: Required<PeriodicStatementOpeningBalances> = {
    cash: opening.cash ?? result.openingCash ?? 0, debt: opening.debt ?? 0, netFixedAssets: opening.netFixedAssets ?? 0,
    netWorkingCapital: opening.netWorkingCapital ?? 0, rawMaterialsInventory: opening.rawMaterialsInventory ?? 0,
    workInProgressInventory: opening.workInProgressInventory ?? 0, finishedGoodsInventory: opening.finishedGoodsInventory ?? 0, deferredPreOperatingAssets: opening.deferredPreOperatingAssets ?? 0,
    paidInCapital: opening.paidInCapital ?? 0, retainedEarnings: opening.retainedEarnings ?? 0,
    grants: opening.grants ?? 0,
  }
  if (Object.values(balances).some(value => !validFinite(value))) return []
  const automaticSchedule = result.automaticFundingSchedule
  if (!Array.isArray(automaticSchedule) || automaticSchedule.length !== result.rows.length ||
      automaticSchedule.some((row, index) => !row || row.period !== result.rows[index].period ||
        ![row.automaticEquity, row.automaticOverdraftDrawdown, row.automaticOverdraftRepayment,
          row.automaticOverdraftBalance].every(validFinite) ||
        [row.automaticEquity, row.automaticOverdraftDrawdown, row.automaticOverdraftRepayment,
          row.automaticOverdraftBalance].some(value => value < 0) ||
        (index === 0 && Math.abs(row.automaticOverdraftBalance -
          row.automaticOverdraftDrawdown + row.automaticOverdraftRepayment) > tolerance) ||
        (index > 0 && Math.abs(row.automaticOverdraftBalance -
          automaticSchedule[index - 1].automaticOverdraftBalance -
          row.automaticOverdraftDrawdown + row.automaticOverdraftRepayment) > tolerance))) return []
  const automaticEquityTotal = automaticSchedule.reduce((sum, row) => sum + row.automaticEquity, 0)
  const automaticOverdraftPeak = Math.max(0, ...automaticSchedule.map(row => row.automaticOverdraftBalance))
  const automaticOverdraftClosing = automaticSchedule.length
    ? automaticSchedule[automaticSchedule.length - 1].automaticOverdraftBalance : 0
  if (!validFinite(result.totalAutomaticEquity) || !validFinite(result.peakAutomaticOverdraft) ||
      !validFinite(result.closingAutomaticOverdraft) ||
      Math.abs(automaticEquityTotal - result.totalAutomaticEquity) > tolerance ||
      Math.abs(automaticOverdraftPeak - result.peakAutomaticOverdraft) > tolerance ||
      Math.abs(automaticOverdraftClosing - result.closingAutomaticOverdraft) > tolerance) return []
  const loanSchedules = Object.values(result.loanSchedules ?? {})
  if (loanSchedules.some(schedule => !Array.isArray(schedule) || schedule.length !== result.rows.length ||
      schedule.some(row => !row || ![row.openingBalance, row.drawdown, row.capitalizedInterest,
        row.capitalizedFinancingFees, row.principal, row.closingBalance].every(validFinite)))) return []
  const scheduledOpeningDebt = loanSchedules.reduce((sum, schedule) => sum + (schedule[0]?.openingBalance ?? 0), 0)
  if (scheduledOpeningDebt > balances.debt + tolerance) return []
  // Opening statement debt is the total liability. Loan schedules account for
  // only the facilities explicitly modelled; any remaining opening debt is
  // carried forward as an unmodelled legacy liability.
  const unmodelledOpeningDebt = balances.debt - scheduledOpeningDebt
  let cash = balances.cash, debt = balances.debt, netFixedAssets = balances.netFixedAssets
  let netWorkingCapital = balances.netWorkingCapital, rawMaterialsInventory = balances.rawMaterialsInventory,
    workInProgressInventory = balances.workInProgressInventory, finishedGoodsInventory = balances.finishedGoodsInventory, deferredPreOperatingAssets = balances.deferredPreOperatingAssets
  let paidInCapital = balances.paidInCapital, retainedEarnings = balances.retainedEarnings, grants = balances.grants
  let automaticFundingCashBalance = 0
  let automaticOverdraftBalance = 0
  const statements: PeriodicFinancialStatement[] = []
  for (let index = 0; index < result.rows.length; index++) {
    const row = result.rows[index]
    const foreignExchangeLoss=row.foreignExchangeLoss??0
    const automaticFunding = result.automaticFundingSchedule?.[index] ?? {
      period: row.period, automaticEquity: 0, automaticOverdraftDrawdown: 0,
      automaticOverdraftRepayment: 0, automaticOverdraftBalance: 0,
    }
    if (automaticFunding.period !== row.period ||
        ![automaticFunding.automaticEquity, automaticFunding.automaticOverdraftDrawdown,
          automaticFunding.automaticOverdraftRepayment, automaticFunding.automaticOverdraftBalance].every(validFinite) ||
        [automaticFunding.automaticEquity, automaticFunding.automaticOverdraftDrawdown,
          automaticFunding.automaticOverdraftRepayment, automaticFunding.automaticOverdraftBalance].some(value => value < 0)) return []
    automaticFundingCashBalance += automaticFunding.automaticEquity +
      automaticFunding.automaticOverdraftDrawdown - automaticFunding.automaticOverdraftRepayment
    automaticOverdraftBalance += automaticFunding.automaticOverdraftDrawdown -
      automaticFunding.automaticOverdraftRepayment
    if (Math.abs(automaticOverdraftBalance - automaticFunding.automaticOverdraftBalance) > tolerance) return []
    const scheduledPeriod = loanSchedules.reduce((sum, schedule) => ({
      drawdown: sum.drawdown + schedule[index].drawdown,
      capitalizedInterest: sum.capitalizedInterest + schedule[index].capitalizedInterest,
      capitalizedFinancingFees: sum.capitalizedFinancingFees + schedule[index].capitalizedFinancingFees,
      principal: sum.principal + schedule[index].principal,
      closingBalance: sum.closingBalance + schedule[index].closingBalance,
    }), { drawdown: 0, capitalizedInterest: 0, capitalizedFinancingFees: 0, principal: 0, closingBalance: 0 })
    if (Math.abs(scheduledPeriod.drawdown - row.debtDrawdown) > tolerance ||
        Math.abs(scheduledPeriod.capitalizedInterest - row.capitalizedInterest) > tolerance ||
        Math.abs(scheduledPeriod.capitalizedFinancingFees - row.capitalizedFinancingFees) > tolerance ||
        Math.abs(scheduledPeriod.principal - row.principal) > tolerance) return []
    const closingDebt = debt + row.debtDrawdown + row.capitalizedInterest + row.capitalizedFinancingFees -
      row.principal + foreignExchangeLoss + automaticFunding.automaticOverdraftDrawdown - automaticFunding.automaticOverdraftRepayment
    if (Math.abs(closingDebt - (unmodelledOpeningDebt + scheduledPeriod.closingBalance +
        automaticFunding.automaticOverdraftBalance)) > tolerance) return []
    const openingBalances = { cash, debt, netFixedAssets, netWorkingCapital, rawMaterialsInventory, workInProgressInventory, finishedGoodsInventory, deferredPreOperatingAssets, paidInCapital, retainedEarnings, grants }
    const cashOperatingCosts = row.variableCost + row.fixedCost + row.abnormalWasteExpense
    const assetDisposalGainLoss = row.assetSaleOtherIncomeLoss + row.salvageGainLoss
    const ebitda = row.revenue - cashOperatingCosts
    const ebit = ebitda - row.depreciation + assetDisposalGainLoss
    const profitBeforeTax = ebit + row.shortTermDepositInterest - row.interestExpense - foreignExchangeLoss
    const netIncome = profitBeforeTax - row.tax
    const operatingCashFlow = netIncome + row.depreciation - assetDisposalGainLoss - row.changeInWorkingCapital + foreignExchangeLoss
    const investingCashFlow = -row.fixedInvestment - row.preOperatingCost - row.maintenanceCapex +
      row.assetSaleProceeds + row.salvageValue
    const automaticFinancingCashFlow = automaticFunding.automaticEquity +
      automaticFunding.automaticOverdraftDrawdown - automaticFunding.automaticOverdraftRepayment
    const financingCashFlow = row.debtDrawdown + row.equityContribution +
      row.equityWorkingCapitalContribution - row.principal + automaticFinancingCashFlow
    const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow
    const closingCash = cash + netChangeInCash
    const closingWorkingCapital = row.closingWorkingCapital
    const closingRawMaterialsInventory = row.rawMaterialsInventory
    const closingWorkInProgressInventory = row.workInProgressInventory
    const closingFinishedGoodsInventory = row.finishedGoodsInventory
    const closingOtherNetWorkingCapital = closingWorkingCapital - closingRawMaterialsInventory - closingWorkInProgressInventory - closingFinishedGoodsInventory
    const closingNetFixedAssets = netFixedAssets + row.fixedInvestment + row.maintenanceCapex -
      row.depreciation - row.assetBookValueDisposed - row.salvageBookValueDisposed
    const closingPreOperatingAssets = deferredPreOperatingAssets + row.preOperatingCost + row.capitalizedInterest + row.capitalizedFinancingFees
    const closingPaidInCapital = paidInCapital + row.equityContribution +
      row.equityWorkingCapitalContribution + automaticFunding.automaticEquity
    const closingRetainedEarnings = retainedEarnings + netIncome
    const closingGrants = grants
    // Gross inventory accounts are split out of net working capital; the residual keeps totals unchanged.
    const totalAssets = closingCash + closingRawMaterialsInventory + closingWorkInProgressInventory + closingFinishedGoodsInventory + closingOtherNetWorkingCapital + closingNetFixedAssets + closingPreOperatingAssets
    const totalLiabilities = closingDebt
    const totalEquity = closingPaidInCapital + closingRetainedEarnings + closingGrants
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceDifference = totalAssets - totalLiabilitiesAndEquity
    const movementChecks = {
      cash: closingCash - cash - netChangeInCash,
      cashRollForward: closingCash - (row.closingCash + automaticFundingCashBalance),
      debt: closingDebt - debt - (row.debtDrawdown + row.capitalizedInterest +
        row.capitalizedFinancingFees - row.principal + foreignExchangeLoss + automaticFunding.automaticOverdraftDrawdown -
        automaticFunding.automaticOverdraftRepayment),
      automaticOverdraft: automaticOverdraftBalance - automaticFunding.automaticOverdraftBalance,
      netWorkingCapital: closingWorkingCapital - netWorkingCapital - row.changeInWorkingCapital,
      netFixedAssets: closingNetFixedAssets - netFixedAssets -
        (row.fixedInvestment + row.maintenanceCapex - row.depreciation - row.assetBookValueDisposed - row.salvageBookValueDisposed),
      deferredPreOperatingAssets: closingPreOperatingAssets - deferredPreOperatingAssets - row.preOperatingCost - row.capitalizedInterest - row.capitalizedFinancingFees,
      paidInCapital: closingPaidInCapital - paidInCapital - row.equityContribution -
        row.equityWorkingCapitalContribution - automaticFunding.automaticEquity,
      retainedEarnings: closingRetainedEarnings - retainedEarnings - netIncome,
      grants: closingGrants - grants,
    }
    statements.push({
      period: row.period, startDate: row.startDate, endDate: row.endDate, openingBalances,
      incomeStatement: { revenue: row.revenue, shortTermDepositInterest: row.shortTermDepositInterest, cashOperatingCosts, abnormalWasteExpense: row.abnormalWasteExpense, ebitda, depreciation: row.depreciation,
        assetDisposalGainLoss, ebit, interest: row.interestExpense,
        cashInterestExpense: row.cashInterestExpense, financingFeeExpense: row.financingFeeExpense,
        commitmentFeeExpense: row.commitmentFeeExpense,
        profitBeforeTax, foreignExchangeGainLoss:-foreignExchangeLoss, taxableDeductions:row.taxableDeduction??0, taxCredits:row.taxCredit??0, taxBeforeCredits:row.taxBeforeCredits??row.tax, tax: row.tax, netIncome },
      cashFlowStatement: { operatingCashFlow, investingCashFlow, financingCashFlow,
        automaticEquityContribution: automaticFunding.automaticEquity,
        automaticOverdraftDrawdown: automaticFunding.automaticOverdraftDrawdown,
        automaticOverdraftRepayment: automaticFunding.automaticOverdraftRepayment,
        netChangeInCash, closingCash },
      balanceSheet: { cash: closingCash, cashInHand: row.cashInHand, shortTermDeposits: row.shortTermDeposits, netWorkingCapital: closingWorkingCapital,
        rawMaterialsInventory: closingRawMaterialsInventory, workInProgressInventory: closingWorkInProgressInventory, finishedGoodsInventory: closingFinishedGoodsInventory, otherNetWorkingCapital: closingOtherNetWorkingCapital, netFixedAssets: closingNetFixedAssets,
        deferredPreOperatingAssets: closingPreOperatingAssets, automaticOverdraft: automaticFunding.automaticOverdraftBalance,
        totalAssets, debt: closingDebt, totalLiabilities,
        paidInCapital: closingPaidInCapital, retainedEarnings: closingRetainedEarnings, grants: closingGrants, totalEquity,
        totalLiabilitiesAndEquity, balanceDifference,
        reconciled: Math.abs(balanceDifference) <= tolerance && Object.values(movementChecks).every(value => Math.abs(value) <= tolerance) },
      movementChecks,
    })
    cash = closingCash; debt = closingDebt; netFixedAssets = closingNetFixedAssets
    netWorkingCapital = closingWorkingCapital; rawMaterialsInventory = closingRawMaterialsInventory;
    workInProgressInventory = closingWorkInProgressInventory; finishedGoodsInventory = closingFinishedGoodsInventory; deferredPreOperatingAssets = closingPreOperatingAssets
    paidInCapital = closingPaidInCapital; retainedEarnings = closingRetainedEarnings
  }
  return statements
}
