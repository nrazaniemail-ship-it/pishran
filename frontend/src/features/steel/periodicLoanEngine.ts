export type LoanRepaymentMethod = 'equal-principal' | 'annuity' | 'bullet'
export type LoanDayCountBasis = 360 | 365
export type LoanInterestConvention = 'comfar-months-plus-360' | 'actual-360' | 'actual-365'

export type DatedLoanDrawdown = {
  date: string
  amount: number
}

export type PeriodicLoanInput = {
  drawdowns: DatedLoanDrawdown[]
  annualInterestRatePercent: number
  dayCountBasis: LoanDayCountBasis
  interestConvention?: LoanInterestConvention
  capitalizationDate: string
  capitalizeConstructionInterest: boolean
  firstRepaymentDate: string
  repaymentCount: number
  repaymentIntervalMonths: number
  repaymentMethod: LoanRepaymentMethod
  /** Nominal annual rate converted to a regular contractual period rate for annuity calculation. */
  annuityRateBasis?: 'nominal-monthly'
}

export type PeriodicLoanRow = {
  period: number
  startDate: string
  endDate: string
  days: number
  openingPrincipal: number
  drawdowns: number
  interestAccrued: number
  capitalizedInterest: number
  interestPaid: number
  principalPaid: number
  debtService: number
  closingPrincipal: number
  closingAccruedInterest: number
}

export type PeriodicLoanResult = {
  valid: boolean
  errors: string[]
  rows: PeriodicLoanRow[]
  totalDrawdowns: number
  totalInterestAccrued: number
  totalCapitalizedInterest: number
  totalInterestPaid: number
  totalPrincipalPaid: number
  closingDebt: number
  repaymentMethod: LoanRepaymentMethod
}

const dateMs = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number.NaN
  const time = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : Number.NaN
}
const iso = (time: number) => new Date(time).toISOString().slice(0, 10)
const DAY = 86400000

function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const targetMonth = month - 1 + months
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return iso(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)))
}

function yearFraction(startDate: string, endDate: string, convention: LoanInterestConvention, basis: LoanDayCountBasis): number {
  const start = dateMs(startDate)
  const end = dateMs(endDate)
  if (end <= start) return 0
  if (convention === 'actual-360' || convention === 'actual-365') {
    const divisor = convention === 'actual-360' ? 360 : 365
    return (end - start) / DAY / divisor
  }
  let months = 0
  while (months < 1200 && dateMs(addMonths(startDate, months + 1)) <= end) months++
  const remainderDays = (end - dateMs(addMonths(startDate, months))) / DAY
  return months / 12 + remainderDays / 360
}

function annuityPayment(principal: number, periodicRate: number, count: number): number {
  if (count <= 0) return 0
  if (periodicRate === 0) return principal / count
  const factor = Math.pow(1 + periodicRate, count)
  return principal * periodicRate * factor / (factor - 1)
}

/**
 * Dated debt schedule. Interest accrues Actual/360 or Actual/365 between events.
 * Construction interest is accumulated and capitalized once at capitalizationDate.
 * Repayment dates follow the contractual interval; the annuity instalment uses a
 * nominal annual rate converted by interval months / 12 (COMFAR-compatible convention).
 */
export function calculatePeriodicLoan(input: PeriodicLoanInput): PeriodicLoanResult {
  const errors: string[] = []
  const dates = [input.capitalizationDate, input.firstRepaymentDate, ...input.drawdowns.map(item => item.date)]
  if (!dates.every(value => Number.isFinite(dateMs(value)))) errors.push('تاریخ نامعتبر است؛ قالب YYYY-MM-DD لازم است.')
  if (!Number.isFinite(input.annualInterestRatePercent) || input.annualInterestRatePercent < 0 || input.annualInterestRatePercent > 1000) errors.push('نرخ بهره نامعتبر است.')
  if (![360, 365].includes(input.dayCountBasis)) errors.push('مبنای روزشمار باید 360 یا 365 باشد.')
  if (!Number.isInteger(input.repaymentCount) || input.repaymentCount < 1 || input.repaymentCount > 1000) errors.push('تعداد اقساط باید عدد صحیح مثبت باشد.')
  if (!Number.isInteger(input.repaymentIntervalMonths) || input.repaymentIntervalMonths < 1 || input.repaymentIntervalMonths > 120) errors.push('فاصله اقساط نامعتبر است.')
  if (!['equal-principal', 'annuity', 'bullet'].includes(input.repaymentMethod)) errors.push('روش بازپرداخت نامعتبر است.')
  if (!input.drawdowns.length || input.drawdowns.some(item => !Number.isFinite(item.amount) || item.amount <= 0)) errors.push('برداشت‌های وام باید مبلغ مثبت داشته باشند.')
  if (input.drawdowns.some(item => dateMs(item.date) > dateMs(input.capitalizationDate))) errors.push('تاریخ برداشت نمی‌تواند بعد از تاریخ پایان سرمایه‌ای‌کردن بهره باشد.')
  if (dateMs(input.firstRepaymentDate) <= dateMs(input.capitalizationDate)) errors.push('اولین قسط باید پس از تاریخ سرمایه‌ای‌کردن بهره باشد.')
  if (errors.length) return { valid: false, errors, rows: [], totalDrawdowns: 0, totalInterestAccrued: 0, totalCapitalizedInterest: 0, totalInterestPaid: 0, totalPrincipalPaid: 0, closingDebt: 0, repaymentMethod: input.repaymentMethod }

  const drawdowns = [...input.drawdowns].sort((a, b) => dateMs(a.date) - dateMs(b.date))
  const repaymentDates = Array.from({ length: input.repaymentCount }, (_, index) => addMonths(input.firstRepaymentDate, index * input.repaymentIntervalMonths))
  const cutoff = dateMs(input.capitalizationDate)
  const rate = input.annualInterestRatePercent / 100
  const periodicRate = rate * input.repaymentIntervalMonths / 12
  const totalDrawdowns = drawdowns.reduce((sum, item) => sum + item.amount, 0)
  let principal = 0
  let accrued = 0
  let cumulativeAccrued = 0
  let cumulativeCapitalized = 0
  let cumulativeInterestPaid = 0
  let cumulativePrincipalPaid = 0
  let previousDate = dateMs(drawdowns[0].date)
  let drawIndex = 0
  const rows: PeriodicLoanRow[] = []

  // Accrue interest from each cash event date to the next, applying dated drawdowns.
  const events = [...new Set([...drawdowns.map(item => item.date), input.capitalizationDate, ...repaymentDates])].sort((a, b) => dateMs(a) - dateMs(b))
  let capitalizedAtCutoff = false
  let repaymentBase: number | null = null
  let repaymentNumber = 0
  let rowStart = iso(previousDate)
  let rowDrawdowns = 0
  let rowInterestAccrued = 0

  for (const eventDate of events) {
    const eventTime = dateMs(eventDate)
    const days = Math.max(0, (eventTime - previousDate) / DAY)
    const convention = input.interestConvention ?? 'comfar-months-plus-360'
    const intervalInterest = principal * rate * yearFraction(iso(previousDate), eventDate, convention, input.dayCountBasis)
    accrued += intervalInterest
    rowInterestAccrued += intervalInterest
    cumulativeAccrued += intervalInterest

    let periodDrawdown = 0
    while (drawIndex < drawdowns.length && drawdowns[drawIndex].date === eventDate) {
      periodDrawdown += drawdowns[drawIndex].amount
      drawIndex++
    }
    principal += periodDrawdown
    rowDrawdowns += periodDrawdown

    let capitalizedInterest = 0
    let interestPaid = 0
    let principalPaid = 0
    if (eventTime === cutoff) {
      if (input.capitalizeConstructionInterest) {
        capitalizedInterest = accrued
        principal += capitalizedInterest
        cumulativeCapitalized += capitalizedInterest
        accrued = 0
      }
      capitalizedAtCutoff = true
      repaymentBase = principal
    }

    if (repaymentDates.includes(eventDate)) {
      if (!capitalizedAtCutoff || repaymentBase === null) errors.push('سررسید قسط قبل از تکمیل دوره سرمایه‌ای‌کردن بهره قرار گرفته است.')
      repaymentNumber++
      const remaining = input.repaymentCount - repaymentNumber + 1
      const installment = input.repaymentMethod === 'annuity'
        ? annuityPayment(repaymentBase ?? principal, periodicRate, input.repaymentCount)
        : 0
      if (input.repaymentMethod === 'equal-principal') principalPaid = (repaymentBase ?? principal) / input.repaymentCount
      else if (input.repaymentMethod === 'annuity') principalPaid = Math.max(0, installment - accrued)
      else if (input.repaymentMethod === 'bullet' && remaining === 1) principalPaid = principal
      if (remaining === 1) principalPaid = principal
      principalPaid = Math.min(principal, Math.max(0, principalPaid))
      interestPaid = accrued
      accrued = 0
      principal -= principalPaid
      cumulativeInterestPaid += interestPaid
      cumulativePrincipalPaid += principalPaid
    }

    const isRepayment = repaymentDates.includes(eventDate)
    const isCutoff = eventTime === cutoff
    if (isRepayment || isCutoff) {
      rows.push({
        period: rows.length + 1,
        startDate: rowStart,
        endDate: eventDate,
        days: Math.max(0, (eventTime - dateMs(rowStart)) / DAY),
        openingPrincipal: Math.max(0, principal + principalPaid - rowDrawdowns - capitalizedInterest),
        drawdowns: rowDrawdowns,
        interestAccrued: rowInterestAccrued,
        capitalizedInterest,
        interestPaid,
        principalPaid,
        debtService: interestPaid + principalPaid,
        closingPrincipal: principal,
        closingAccruedInterest: accrued,
      })
      rowStart = eventDate
      rowDrawdowns = 0
      rowInterestAccrued = 0
    }
    previousDate = eventTime
  }

  return {
    valid: errors.length === 0,
    errors,
    rows,
    totalDrawdowns,
    totalInterestAccrued: cumulativeAccrued,
    totalCapitalizedInterest: cumulativeCapitalized,
    totalInterestPaid: cumulativeInterestPaid,
    totalPrincipalPaid: cumulativePrincipalPaid,
    closingDebt: principal + accrued,
    repaymentMethod: input.repaymentMethod,
  }
}
