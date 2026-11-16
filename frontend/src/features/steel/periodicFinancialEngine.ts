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

type TaxLossVintage={fiscalYear:number;amount:number}
function calculatePeriodTaxWithVintages(
  taxableProfit:number,
  taxRatePercent:number,
  openingVintages:TaxLossVintage[],
  fiscalYear:number,
  enabled:boolean,
  carryForwardYears:number|null,
):{tax:number;closingLossCarryForward:number;vintages:TaxLossVintage[]}|null {
  if(![taxableProfit,taxRatePercent,fiscalYear].every(validFinite)||taxRatePercent<0||taxRatePercent>100||
    (carryForwardYears!==null&&(!Number.isInteger(carryForwardYears)||carryForwardYears<1)))return null
  let vintages=enabled?openingVintages.filter(vintage=>fiscalYear-vintage.fiscalYear<= (carryForwardYears??Infinity))
    .map(vintage=>({...vintage})): []
  let remainingProfit=taxableProfit
  if(enabled&&remainingProfit>0) {
    vintages.sort((a,b)=>a.fiscalYear-b.fiscalYear)
    for(const vintage of vintages) {
      const used=Math.min(vintage.amount,remainingProfit)
      vintage.amount-=used
      remainingProfit-=used
      if(remainingProfit<=1e-9)break
    }
    vintages=vintages.filter(vintage=>vintage.amount>1e-9)
  }
  if(enabled&&remainingProfit<0)vintages.push({fiscalYear,amount:-remainingProfit})
  return {tax:Math.max(0,remainingProfit)*taxRatePercent/100,
    closingLossCarryForward:vintages.reduce((sum,vintage)=>sum+vintage.amount,0),vintages}
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
  /** Optional partial capitalization rate; overrides the legacy boolean when supplied. */
  capitalizedInterestPercent?: number
  /** Inclusive final date eligible for interest capitalization. */
  capitalizeUntilDate?: string
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
  /** Non-cash local-currency liability remeasurement; may be negative for an FX gain. */
  foreignExchangeLoss?: number
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
  if (input.capitalizedInterestPercent != null &&
      (!validFinite(input.capitalizedInterestPercent) || input.capitalizedInterestPercent < 0 || input.capitalizedInterestPercent > 100))
    issues.push('Capitalized-interest percentage must be between 0 and 100.')
  if (input.capitalizeUntilDate != null && !parseIsoDateUtc(input.capitalizeUntilDate))
    issues.push('Interest capitalization end date must be a valid ISO calendar date.')
  if (input.capitalizeUntilDate != null && periods.length &&
      (input.capitalizeUntilDate < periods[0].startDate || input.capitalizeUntilDate > periods[periods.length-1].endDate))
    issues.push('Interest capitalization end date must fall inside the project calendar.')
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
    const requestedCapitalizationPercent = input.capitalizedInterestPercent ?? (input.capitalizeInterest ? 100 : 0)
    let capitalizationPeriodFraction = 0
    if (beforePrincipal && requestedCapitalizationPercent > 0) {
      const capitalizationEnd = input.capitalizeUntilDate ?? periods[index].endDate
      if (periods[index].startDate <= capitalizationEnd) {
        const endDate = parseIsoDateUtc(capitalizationEnd)!
        const startDate = parseIsoDateUtc(periods[index].startDate)!
        const eligibleDays = Math.max(0, Math.min(periods[index].days,
          Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1))
        capitalizationPeriodFraction = eligibleDays / periods[index].days
      }
    }
    const capitalizedInterest = interestAccrued * requestedCapitalizationPercent / 100 * capitalizationPeriodFraction
    const interestExpense = interestAccrued - capitalizedInterest
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
  /** Explicit deductible tax allowances by project period, applied before loss carry-forward. */
  taxAllowancesByPeriod?: number[]
  annualEquityContributions: number[]
  /** Shareholder funding for working capital; any amount above the period increase remains as cash funding buffer. */
  annualEquityWorkingCapitalContributions?: number[]
  workingCapitalByPeriod: number[]
  openingWorkingCapital?: number
  openingTaxLoss?: number
  openingUnleveredTaxLoss?: number
  taxLossCarryForwardEnabled?: boolean
  taxLossCarryForwardYears?: number | null
  loans: PeriodicProjectLoan[]
  /** Validated local-currency schedules prepared by adapters (e.g. foreign-currency translation). */
  precomputedLoanSchedules?: Record<string, PeriodicLoanRow[]>
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
  variableCost: number
  fixedCost: number
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
  principal: number
  debtDrawdown: number
  debtService: number
  taxRatePercent: number
  taxAllowances: number
  tax: number
  unleveredTax: number
  taxLossCarryForward: number
  fixedInvestment: number
  preOperatingCost: number
  maintenanceCapex: number
  closingWorkingCapital: number
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

export type PeriodicFiscalYearSummary = {
  fiscalYearIndex: number
  rows: PeriodicProjectFinanceRow[]
  projectFreeCashFlow: number
  /** Total shareholder funding, including separately identified shareholder-funded working capital. */
  equityContribution: number
  /** Net financing cash flow: drawdowns plus capitalized interest less principal repayments. */
  netDebtFinancingFlow: number
  taxRatePercent: number | null
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
    const taxRates=[...new Set(yearRows.map(row=>Number(row.taxRatePercent.toFixed(4))))]
    const debtService=sum('debtService'),cfads=sum('cfads')
    return {
      fiscalYearIndex,rows:yearRows,projectFreeCashFlow:sum('projectFreeCashFlow'),
      equityContribution,netDebtFinancingFlow,
      taxRatePercent:taxRates.length===1?taxRates[0]:null,depreciation:sum('depreciation'),
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
    valid: false, rows: [], loanSchedules: {}, npvProject: null, irrProject: null, mirrProject: null,
    npvEquity: null, irrEquity: null, mirrEquity: null, totalDebtDrawdown: 0,
    totalEquityContribution: 0, totalCapitalizedInterest: 0, peakWorkingCapital: 0, warnings
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
    ...(input.annualEquityWorkingCapitalContributions ? [input.annualEquityWorkingCapitalContributions] : []),
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
  const assetSaleSchedule = input.annualAssetSaleSchedule ?? []
  const validateSaleRow = (row: {saleProceeds:number;returnOfCapital:number;otherIncomeLoss:number;bookValueDisposed:number}) =>
    [row.saleProceeds,row.returnOfCapital,row.otherIncomeLoss,row.bookValueDisposed].every(validFinite) &&
    row.saleProceeds >= 0 && row.returnOfCapital >= 0 && row.bookValueDisposed >= 0 &&
    row.returnOfCapital <= row.saleProceeds + 0.01 && row.returnOfCapital <= row.bookValueDisposed + 0.01 &&
    Math.abs(row.returnOfCapital-Math.min(row.saleProceeds,row.bookValueDisposed)) <= 0.01 &&
    Math.abs(row.otherIncomeLoss-(row.saleProceeds-row.bookValueDisposed)) <= 0.01
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
  const [revenue, variableCost, fixedCost, allocatedDepreciation, fixedInvestment, preOperatingCost, maintenanceCapex, , equityContribution, allocatedEquityWorkingCapitalContribution] = allocated
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
  if(input.taxAllowancesByPeriod&&(input.taxAllowancesByPeriod.length!==periods.length||
    input.taxAllowancesByPeriod.some(amount=>!validFinite(amount)||amount<0))) {
    warnings.push('Tax allowances must contain one finite non-negative amount for every project period.')
    return empty()
  }
  const loanSchedules: Record<string, PeriodicLoanRow[]> = {}
  const suppliedSchedules = input.precomputedLoanSchedules ?? {}
  const loanIds = new Set(input.loans.map(loan => loan.id))
  if (Object.keys(suppliedSchedules).some(id => !loanIds.has(id))) {
    warnings.push('Precomputed loan schedules must reference an existing loan identifier.')
    return empty()
  }
  for (const loan of input.loans) {
    const supplied = suppliedSchedules[loan.id]
    if (supplied) {
      const scheduleIssues: string[] = []
      if (!Array.isArray(supplied) || supplied.length !== periods.length) {
        scheduleIssues.push('Precomputed schedule must contain one row per project period.')
      } else supplied.forEach((row,index) => {
        const values = [row?.drawdown,row?.openingBalance,row?.periodRatePercent,row?.interestExpense,
          row?.capitalizedInterest,row?.financingFeeExpense,row?.commitmentFeeExpense,
          row?.capitalizedFinancingFees,row?.principal,row?.closingBalance,row?.debtService]
        if (row?.period !== index+1 || values.some(value=>!validFinite(value)) ||
            values.some(value=>value<0) ||
            Math.abs(row.closingBalance-(row.openingBalance+row.drawdown+row.capitalizedInterest+
              row.capitalizedFinancingFees-row.principal+(row.foreignExchangeLoss??0)))>0.01 ||
            Math.abs(row.debtService-(row.interestExpense+row.financingFeeExpense+row.principal))>0.01) {
          scheduleIssues.push('Precomputed schedule row does not reconcile in period '+(index+1)+'.')
        }
      })
      if (scheduleIssues.length) {
        warnings.push(...scheduleIssues.map(issue=>loan.id+': '+issue))
        return empty()
      }
      loanSchedules[loan.id] = supplied.map(row=>({...row}))
    } else {
      const schedule = calculatePeriodicLoanSchedule(loan.input, periods, dayCountBasis)
      if (!schedule.valid) {
        warnings.push(...schedule.issues.map(issue => loan.id + ': ' + issue))
        return empty()
      }
      loanSchedules[loan.id] = schedule.rows
    }
  }
  if (input.annualEquityContributions.some(value => value < 0) ||
      !validFinite(input.openingWorkingCapital ?? 0) || (input.openingWorkingCapital ?? 0) < 0 ||
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
  const carryForwardEnabled=input.taxLossCarryForwardEnabled??true
  const carryForwardYears=input.taxLossCarryForwardYears??null
  if (!validFinite(openingLoss) || openingLoss < 0 || !validFinite(openingUnleveredLoss) || openingUnleveredLoss < 0||
    (carryForwardYears!==null&&(!Number.isInteger(carryForwardYears)||carryForwardYears<1))) {
    warnings.push('Opening tax-loss balances or carry-forward duration are invalid.')
    return empty()
  }
  const rows: PeriodicProjectFinanceRow[] = []
  let taxLoss = openingLoss
  let unleveredTaxLoss = openingUnleveredLoss
  let taxLossVintages:TaxLossVintage[]=openingLoss>0?[{fiscalYear:-1,amount:openingLoss}]:[]
  let unleveredTaxLossVintages:TaxLossVintage[]=openingUnleveredLoss>0?[{fiscalYear:-1,amount:openingUnleveredLoss}]:[]
  let priorWorkingCapital = Math.max(0, input.openingWorkingCapital ?? 0)
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
    const capitalizedInterest = loanRows.reduce((sum,row)=>sum+row.capitalizedInterest,0)
    const capitalizedFinancingFees = loanRows.reduce((sum,row)=>sum+row.capitalizedFinancingFees,0)
    const principal = loanRows.reduce((sum,row)=>sum+row.principal,0)
    const debtDrawdown = loanRows.reduce((sum,row)=>sum+row.drawdown,0)
    const assetSale = assetSalesByPeriod[index]
    const terminalSalvage = index === periods.length - 1 ? Math.max(0,input.salvageValue ?? 0) : 0
    const salvageBookValueDisposed = index === periods.length - 1 ? Math.max(0,input.salvageBookValue ?? 0) : 0
    const salvageGainLoss = terminalSalvage - salvageBookValueDisposed
    const ebit = revenue[index] - variableCost[index] - fixedCost[index] - depreciation[index] +
      assetSale.otherIncomeLoss + salvageGainLoss
    const taxAllowances=input.taxAllowancesByPeriod?.[index]??0
    const fiscalYear=fiscalYearIndexForPeriod(periods[index],periods,fiscalYearStartMonth)
    const periodTax=calculatePeriodTaxWithVintages(ebit-interestExpense-taxAllowances,taxRates[index],
      taxLossVintages,fiscalYear,carryForwardEnabled,carryForwardYears)
    const unleveredPeriodTax=calculatePeriodTaxWithVintages(ebit-taxAllowances,taxRates[index],
      unleveredTaxLossVintages,fiscalYear,carryForwardEnabled,carryForwardYears)
    if(!periodTax||!unleveredPeriodTax) {
      warnings.push('Tax calculation failed in project period '+(index+1)+'.')
      return empty()
    }
    taxLossVintages=periodTax.vintages
    unleveredTaxLossVintages=unleveredPeriodTax.vintages
    taxLoss=periodTax.closingLossCarryForward
    unleveredTaxLoss=unleveredPeriodTax.closingLossCarryForward
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
    const cfads = revenue[index] - variableCost[index] - fixedCost[index] - periodTax.tax
      - maintenanceCapex[index] - changeInWorkingCapital + assetSale.saleProceeds
    const debtService = interestExpense + principal
    const dscr = debtService > 0 ? cfads / debtService : null
    const dscrCovenantStatus: 'not-tested' | 'pass' | 'breach' = input.minimumDscr == null || dscr == null
      ? 'not-tested' : dscr + 1e-9 >= input.minimumDscr ? 'pass' : 'breach'
    if (dscrCovenantStatus === 'breach') warnings.push('Minimum DSCR covenant breached in period ' + (index + 1) + ': actual ' + dscr!.toFixed(4) + ', minimum ' + input.minimumDscr!.toFixed(4) + '.')
    const projectFreeCashFlow = ebit - assetSale.otherIncomeLoss - salvageGainLoss - unleveredPeriodTax.tax + depreciation[index]
      - fixedInvestment[index] - preOperatingCost[index] - maintenanceCapex[index]
      - changeInWorkingCapital + assetSale.saleProceeds + terminalSalvage
    const equityFreeCashFlow = -equityContribution[index] + revenue[index] - variableCost[index] - fixedCost[index]
      - periodTax.tax - interestExpense - principal - maintenanceCapex[index]
      - equityWorkingCapitalCashFlow + assetSale.saleProceeds + terminalSalvage
    rows.push({
      period:index+1,startDate:periods[index].startDate,endDate:periods[index].endDate,days:periods[index].days,
      revenue:revenue[index],variableCost:variableCost[index],fixedCost:fixedCost[index],depreciation:depreciation[index],ebit,
      assetSaleProceeds:assetSale.saleProceeds,assetReturnOfCapital:assetSale.returnOfCapital,
      assetSaleOtherIncomeLoss:assetSale.otherIncomeLoss,assetBookValueDisposed:assetSale.bookValueDisposed,
      interestExpense,cashInterestExpense,financingFeeExpense,commitmentFeeExpense,
      capitalizedInterest,capitalizedFinancingFees,principal,debtDrawdown,debtService,taxRatePercent:taxRates[index],
      taxAllowances,tax:periodTax.tax,unleveredTax:unleveredPeriodTax.tax,taxLossCarryForward:taxLoss,
      fixedInvestment:fixedInvestment[index],preOperatingCost:preOperatingCost[index],maintenanceCapex:maintenanceCapex[index],
      closingWorkingCapital,changeInWorkingCapital,equityContribution:equityContribution[index],
      equityWorkingCapitalContribution:equityWorkingCapitalContributionAmount,
      salvageValue:terminalSalvage,salvageBookValueDisposed,salvageGainLoss,cfads,dscr,dscrCovenantStatus,projectFreeCashFlow,equityFreeCashFlow
    })
    priorWorkingCapital = closingWorkingCapital
  }
  const projectFlows = rows.map(row=>row.projectFreeCashFlow)
  const equityFlows = rows.map(row=>row.equityFreeCashFlow)
  const discountRate = input.discountRatePercent
  const npvProject = discountRate == null ? null : calculatePeriodicNpv(projectFlows,periods,discountRate,dayCountBasis,cashFlowTiming,input.valuationDate,input.discountConvention??'actual-days',input.discountPeriodsPerYear??1)
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
type HelpDepreciationSegment={startDate:Date;endDate:Date;months:number;amount:number}

/**
 * Applies the reference annual depreciation formula using the explicitly entered
 * number of months in the first depreciation year. Depreciation is posted at the
 * end of each depreciation-year segment, not spread evenly over every month.
 */
function buildHelpDepreciationSegments(
  asset:PeriodicDepreciationAssetInput,
  startDate:Date|null,
  lifeMonths:number,
  salvageValue:number,
):HelpDepreciationSegment[] {
  if(asset.method==='none'||!startDate||lifeMonths<=0)return []
  if(asset.method==='sum-of-years-digits'&&(lifeMonths%12!==0||asset.firstDepreciationMonths!==12))return []
  const base=Math.max(0,asset.initialBookValue-salvageValue)
  const segments:HelpDepreciationSegment[]=[]
  let elapsedMonths=0
  let bookValue=asset.initialBookValue
  let segmentIndex=0
  while(elapsedMonths<lifeMonths&&bookValue>salvageValue+1e-9) {
    const months=Math.min(segmentIndex===0?asset.firstDepreciationMonths:12,lifeMonths-elapsedMonths)
    const segmentStart=addUtcMonthsClamped(startDate,elapsedMonths)
    const segmentEndExclusive=addUtcMonthsClamped(startDate,elapsedMonths+months)
    const segmentEnd=new Date(segmentEndExclusive.getTime()-86400000)
    let amount=0
    if(asset.method==='linear-to-zero'||asset.method==='linear-to-scrap') {
      amount=base*months/lifeMonths
    } else if(asset.method==='accelerated') {
      if(segmentIndex===0) {
        amount=asset.initialBookValue*(asset.ratePercent??0)/100*months/12
      } else {
        const remainingYears=(lifeMonths-elapsedMonths)/12
        const straightLineAnnual=remainingYears>0?(bookValue-salvageValue)/remainingYears:bookValue-salvageValue
        const acceleratedAnnual=bookValue*(asset.ratePercent??0)/100
        amount=(acceleratedAnnual>straightLineAnnual?acceleratedAnnual:straightLineAnnual)*months/12
      }
    } else if(asset.method==='sum-of-years-digits') {
      const years=lifeMonths/12
      const divisor=years*(years+1)/2
      amount=base*(years-segmentIndex)/divisor
    }
    amount=Math.min(Math.max(0,bookValue-salvageValue),Math.max(0,amount))
    segments.push({startDate:segmentStart,endDate:segmentEnd,months,amount})
    bookValue=Math.max(salvageValue,bookValue-amount)
    elapsedMonths+=months
    segmentIndex++
  }
  if(segments.length&&bookValue>salvageValue+1e-7) {
    const last=segments[segments.length-1]
    last.amount+=bookValue-salvageValue
  }
  return segments
}

function monthsElapsedToBalanceDate(start:Date,end:Date):number {
  const months=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1
  return Math.max(0,Math.min(12,months))
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
  if(assets.some(asset=>!asset.id.trim())||sales.some(sale=>!sale.id.trim())) {
    warnings.push('Periodic depreciation asset and sale identifiers cannot be blank.')
    return empty()
  }
  const assetIds=new Set(assets.map(asset=>asset.id))
  if (sales.some(sale=>!assetIds.has(sale.assetId))) {
    warnings.push('Every periodic asset sale must reference an existing asset vintage.')
    return empty()
  }
  if(new Set(sales.map(sale=>sale.assetId)).size!==sales.length) {
    warnings.push('An asset vintage can be disposed only once; multiple disposal rows for one asset are not permitted.')
    return empty()
  }
  if(periods.some((period,index)=>!Number.isInteger(period.index)||period.index!==periods[0].index+index)) {
    warnings.push('Project period indexes must be consecutive and ordered.')
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
    const salvageValue=asset.method==='linear-to-zero'?0:asset.initialBookValue*asset.scrapPercent/100
    const sale=sales.find(row=>row.assetId===asset.id)
    const saleDate=sale?parseIsoDateUtc(sale.saleDate):null
    if(sale&&(!saleDate||saleDate.getTime()<acquisitionDate.getTime()||
      !['book-value','self-defined'].includes(sale.priceMode)||
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
    if(sale&&saleDate&&periods[saleIndex].endDate!==sale.saleDate){
      warnings.push(asset.name+': disposal must be recorded on a project balance date (period end).')
      continue
    }
    const depreciationSegments=buildHelpDepreciationSegments(asset,depreciationStartDate,lifeMonths,salvageValue)
    let bookValue=0
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
      if(asset.method!=='none'&&bookValue>salvageValue&&index>=acquisitionIndex){
        // A project period can contain more than one depreciation-year boundary
        // (for example, a partial first year followed by a full year inside an
        // annual reporting period). Accumulate every segment due in this period.
        for(const segment of depreciationSegments){
          const dueAtPeriodEnd=segment.endDate.getTime()>=periodStart.getTime()&&segment.endDate.getTime()<=periodEnd.getTime()
          const disposedInsideSegment=!!(saleInThisPeriod&&saleDate&&
            saleDate.getTime()>=segment.startDate.getTime()&&saleDate.getTime()<=segment.endDate.getTime())
          if(!dueAtPeriodEnd&&!disposedInsideSegment)continue
          if(saleDate&&segment.startDate.getTime()>saleDate.getTime())continue
          let segmentCharge=segment.amount
          if(disposedInsideSegment&&saleDate&&saleDate.getTime()<segment.endDate.getTime()){
            const elapsedMonths=monthsElapsedToBalanceDate(segment.startDate,saleDate)
            segmentCharge=segment.amount*elapsedMonths/segment.months
          }
          depreciation+=Math.min(Math.max(0,bookValue-salvageValue),Math.max(0,segmentCharge))
          bookValue=Math.max(salvageValue,bookValue-Math.max(0,segmentCharge))
          if(bookValue<=salvageValue+1e-9)break
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
  deferredPreOperatingAssets?: number
  paidInCapital?: number
  retainedEarnings?: number
}
export type PeriodicFinancialStatement = {
  period: number
  startDate: string
  endDate: string
  openingBalances: Required<PeriodicStatementOpeningBalances>
  incomeStatement: {
    revenue: number; cashOperatingCosts: number; ebitda: number; depreciation: number
    assetDisposalGainLoss: number; ebit: number; interest: number
    cashInterestExpense: number; financingFeeExpense: number; commitmentFeeExpense: number
    profitBeforeTax: number; tax: number; netIncome: number
  }
  cashFlowStatement: {
    operatingCashFlow: number; investingCashFlow: number; financingCashFlow: number
    netChangeInCash: number; closingCash: number
  }
  balanceSheet: {
    cash: number; netWorkingCapital: number; netFixedAssets: number; deferredPreOperatingAssets: number
    totalAssets: number; debt: number; totalLiabilities: number; paidInCapital: number
    retainedEarnings: number; totalEquity: number; totalLiabilitiesAndEquity: number
    balanceDifference: number; reconciled: boolean
  }
  movementChecks: {
    cash: number; debt: number; netWorkingCapital: number; netFixedAssets: number
    deferredPreOperatingAssets: number; paidInCapital: number; retainedEarnings: number
  }
}

/**
 * Builds period-level linked statements. Working capital is represented as net working
 * capital (current assets less operating payables); no unsupported gross split is inferred.
 * Capitalized interest is a non-cash addition to both deferred pre-operating assets and debt.
 */
export function buildPeriodicThreeFinancialStatements(
  result: PeriodicProjectFinanceResult,
  opening: PeriodicStatementOpeningBalances = {},
  tolerance = 0.01,
): PeriodicFinancialStatement[] {
  if (!result.valid || !Number.isFinite(tolerance) || tolerance < 0) return []
  const balances: Required<PeriodicStatementOpeningBalances> = {
    cash: opening.cash ?? 0, debt: opening.debt ?? 0, netFixedAssets: opening.netFixedAssets ?? 0,
    netWorkingCapital: opening.netWorkingCapital ?? 0, deferredPreOperatingAssets: opening.deferredPreOperatingAssets ?? 0,
    paidInCapital: opening.paidInCapital ?? 0, retainedEarnings: opening.retainedEarnings ?? 0,
  }
  if (Object.values(balances).some(value => !validFinite(value))) return []
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
  let netWorkingCapital = balances.netWorkingCapital, deferredPreOperatingAssets = balances.deferredPreOperatingAssets
  let paidInCapital = balances.paidInCapital, retainedEarnings = balances.retainedEarnings
  const statements: PeriodicFinancialStatement[] = []
  for (let index = 0; index < result.rows.length; index++) {
    const row = result.rows[index]
    const scheduledPeriod = loanSchedules.reduce((sum, schedule) => ({
      drawdown: sum.drawdown + schedule[index].drawdown,
      capitalizedInterest: sum.capitalizedInterest + schedule[index].capitalizedInterest,
      capitalizedFinancingFees: sum.capitalizedFinancingFees + schedule[index].capitalizedFinancingFees,
      principal: sum.principal + schedule[index].principal,
      foreignExchangeLoss: sum.foreignExchangeLoss + (schedule[index].foreignExchangeLoss??0),
      closingBalance: sum.closingBalance + schedule[index].closingBalance,
    }), { drawdown: 0, capitalizedInterest: 0, capitalizedFinancingFees: 0, principal: 0, foreignExchangeLoss:0, closingBalance: 0 })
    if (Math.abs(scheduledPeriod.drawdown - row.debtDrawdown) > tolerance ||
        Math.abs(scheduledPeriod.capitalizedInterest - row.capitalizedInterest) > tolerance ||
        Math.abs(scheduledPeriod.capitalizedFinancingFees - row.capitalizedFinancingFees) > tolerance ||
        Math.abs(scheduledPeriod.principal - row.principal) > tolerance) return []
    const closingDebt = debt + row.debtDrawdown + row.capitalizedInterest + row.capitalizedFinancingFees - row.principal + scheduledPeriod.foreignExchangeLoss
    if (Math.abs(closingDebt - (unmodelledOpeningDebt + scheduledPeriod.closingBalance)) > tolerance) return []
    const openingBalances = { cash, debt, netFixedAssets, netWorkingCapital, deferredPreOperatingAssets, paidInCapital, retainedEarnings }
    const cashOperatingCosts = row.variableCost + row.fixedCost
    const assetDisposalGainLoss = row.assetSaleOtherIncomeLoss + row.salvageGainLoss
    const ebitda = row.revenue - cashOperatingCosts
    const ebit = ebitda - row.depreciation + assetDisposalGainLoss
    const profitBeforeTax = ebit - row.interestExpense
    const netIncome = profitBeforeTax - row.tax
    const operatingCashFlow = netIncome + row.depreciation - assetDisposalGainLoss - row.changeInWorkingCapital
    const investingCashFlow = -row.fixedInvestment - row.preOperatingCost - row.maintenanceCapex +
      row.assetSaleProceeds + row.salvageValue
    const financingCashFlow = row.debtDrawdown + row.equityContribution + row.equityWorkingCapitalContribution - row.principal
    const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow
    const closingCash = cash + netChangeInCash
    const closingWorkingCapital = row.closingWorkingCapital
    const closingNetFixedAssets = netFixedAssets + row.fixedInvestment + row.maintenanceCapex -
      row.depreciation - row.assetBookValueDisposed - row.salvageBookValueDisposed
    const closingPreOperatingAssets = deferredPreOperatingAssets + row.preOperatingCost + row.capitalizedInterest + row.capitalizedFinancingFees
    const closingPaidInCapital = paidInCapital + row.equityContribution + row.equityWorkingCapitalContribution
    const closingRetainedEarnings = retainedEarnings + netIncome
    const totalAssets = closingCash + closingWorkingCapital + closingNetFixedAssets + closingPreOperatingAssets
    const totalLiabilities = closingDebt
    const totalEquity = closingPaidInCapital + closingRetainedEarnings
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceDifference = totalAssets - totalLiabilitiesAndEquity
    const movementChecks = {
      cash: closingCash - cash - netChangeInCash,
      debt: closingDebt - debt - (row.debtDrawdown + row.capitalizedInterest + row.capitalizedFinancingFees - row.principal + scheduledPeriod.foreignExchangeLoss),
      netWorkingCapital: closingWorkingCapital - netWorkingCapital - row.changeInWorkingCapital,
      netFixedAssets: closingNetFixedAssets - netFixedAssets -
        (row.fixedInvestment + row.maintenanceCapex - row.depreciation - row.assetBookValueDisposed - row.salvageBookValueDisposed),
      deferredPreOperatingAssets: closingPreOperatingAssets - deferredPreOperatingAssets - row.preOperatingCost - row.capitalizedInterest - row.capitalizedFinancingFees,
      paidInCapital: closingPaidInCapital - paidInCapital - row.equityContribution - row.equityWorkingCapitalContribution,
      retainedEarnings: closingRetainedEarnings - retainedEarnings - netIncome,
    }
    statements.push({
      period: row.period, startDate: row.startDate, endDate: row.endDate, openingBalances,
      incomeStatement: { revenue: row.revenue, cashOperatingCosts, ebitda, depreciation: row.depreciation,
        assetDisposalGainLoss, ebit, interest: row.interestExpense,
        cashInterestExpense: row.cashInterestExpense, financingFeeExpense: row.financingFeeExpense,
        commitmentFeeExpense: row.commitmentFeeExpense,
        profitBeforeTax, tax: row.tax, netIncome },
      cashFlowStatement: { operatingCashFlow, investingCashFlow, financingCashFlow, netChangeInCash, closingCash },
      balanceSheet: { cash: closingCash, netWorkingCapital: closingWorkingCapital, netFixedAssets: closingNetFixedAssets,
        deferredPreOperatingAssets: closingPreOperatingAssets, totalAssets, debt: closingDebt, totalLiabilities,
        paidInCapital: closingPaidInCapital, retainedEarnings: closingRetainedEarnings, totalEquity,
        totalLiabilitiesAndEquity, balanceDifference,
        reconciled: Math.abs(balanceDifference) <= tolerance && Object.values(movementChecks).every(value => Math.abs(value) <= tolerance) },
      movementChecks,
    })
    cash = closingCash; debt = closingDebt; netFixedAssets = closingNetFixedAssets
    netWorkingCapital = closingWorkingCapital; deferredPreOperatingAssets = closingPreOperatingAssets
    paidInCapital = closingPaidInCapital; retainedEarnings = closingRetainedEarnings
  }
  return statements
}
