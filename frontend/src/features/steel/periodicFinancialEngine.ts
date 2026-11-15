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
