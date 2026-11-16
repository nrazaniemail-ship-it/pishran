import type { ProjectCalendarPeriod, ProjectCurrency } from '../projects/projectFoundation'
import type { PeriodicLoanRow, PeriodicFinancialStatement } from './periodicFinancialEngine'

export type PeriodicForeignCurrencyDebtInput = {
  /** Opening principal and capitalized charges in the foreign currency. */
  openingForeignBalance: number
  /** Exchange rate used to carry the opening balance into the first period. */
  openingExchangeRateToLocal: number
  /** Foreign-currency movements, one amount per project period. */
  drawdowns: number[]
  principalRepayments: number[]
  capitalizedInterest: number[]
  /** Capitalized financing fees added to the contractual debt balance. */
  capitalizedFees?: number[]
  /** Transaction rates for each movement; all rates are local currency per one foreign unit. */
  drawdownExchangeRates: number[]
  repaymentExchangeRates: number[]
  capitalizedInterestExchangeRates: number[]
  capitalizedFeesExchangeRates?: number[]
  /** Closing rates used to remeasure the foreign-currency debt liability. */
  closingExchangeRates: number[]
}

export type PeriodicForeignCurrencyDebtRow = {
  period: number
  openingForeignBalance: number
  drawdownForeign: number
  principalRepaymentForeign: number
  capitalizedInterestForeign: number
  capitalizedFeesForeign: number
  closingForeignBalance: number
  openingCarryingAmountLocal: number
  drawdownLocal: number
  principalRepaymentLocal: number
  capitalizedInterestLocal: number
  capitalizedFeesLocal: number
  closingCarryingAmountLocal: number
  /** Positive is an FX loss (increase in the local-currency debt liability); negative is a gain. */
  foreignExchangeLossLocal: number
}

export type PeriodicForeignCurrencyDebtResult = {
  valid: boolean
  rows: PeriodicForeignCurrencyDebtRow[]
  issues: string[]
  totalForeignExchangeLossLocal: number
}

function finite(value: number): boolean {
  return Number.isFinite(value)
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validatePeriods(periods: ProjectCalendarPeriod[]): string[] {
  const issues: string[] = []
  if (!periods.length) return ['At least one project period is required.']
  periods.forEach((period, index) => {
    if (!period || !validIsoDate(period.startDate) || !validIsoDate(period.endDate) ||
        !Number.isInteger(period.days) || period.days <= 0) {
      issues.push('Invalid project calendar period ' + (index + 1) + '.')
      return
    }
    const start = Date.parse(period.startDate + 'T00:00:00.000Z')
    const end = Date.parse(period.endDate + 'T00:00:00.000Z')
    if (end < start || Math.round((end - start) / 86400000) + 1 !== period.days)
      issues.push('Project period dates and day count do not reconcile in period ' + (index + 1) + '.')
    if (index > 0) {
      const previousEnd = Date.parse(periods[index - 1].endDate + 'T00:00:00.000Z')
      if (start !== previousEnd + 86400000)
        issues.push('Project periods must be contiguous; a gap or overlap exists before period ' + (index + 1) + '.')
    }
  })
  return issues
}

/**
 * Revalue a foreign-currency debt schedule period by period.
 *
 * Movements are translated at their own transaction exchange rates; the
 * closing foreign balance is remeasured at the period-end rate. Positive
 * foreignExchangeLossLocal is an expense/loss for a liability. This routine
 * does not choose exchange rates or infer them from inflation assumptions.
 */
export function calculatePeriodicForeignCurrencyDebt(
  input: PeriodicForeignCurrencyDebtInput,
  periods: ProjectCalendarPeriod[],
): PeriodicForeignCurrencyDebtResult {
  const issues = validatePeriods(periods)
  const count = periods.length
  const arrays: [string, number[]][] = [
    ['drawdowns', input.drawdowns],
    ['principalRepayments', input.principalRepayments],
    ['capitalizedInterest', input.capitalizedInterest],
    ['drawdownExchangeRates', input.drawdownExchangeRates],
    ['repaymentExchangeRates', input.repaymentExchangeRates],
    ['capitalizedInterestExchangeRates', input.capitalizedInterestExchangeRates],
    ['closingExchangeRates', input.closingExchangeRates],
  ]
  const capitalizedFees = input.capitalizedFees ?? Array(count).fill(0)
  const capitalizedFeesExchangeRates = input.capitalizedFeesExchangeRates ?? input.capitalizedInterestExchangeRates
  if (capitalizedFees.length !== count || capitalizedFees.some(value => !finite(value) || value < 0))
    issues.push('capitalizedFees must contain one finite non-negative value per project period.')
  if (capitalizedFeesExchangeRates.length !== count || capitalizedFeesExchangeRates.some(value => !finite(value) || value <= 0))
    issues.push('capitalizedFeesExchangeRates must contain one positive exchange rate per project period.')
  if (!finite(input.openingForeignBalance) || input.openingForeignBalance < 0)
    issues.push('Opening foreign-currency debt must be finite and non-negative.')
  if (!finite(input.openingExchangeRateToLocal) || input.openingExchangeRateToLocal <= 0)
    issues.push('Opening exchange rate must be finite and greater than zero.')
  for (const [name, values] of arrays) {
    if (!Array.isArray(values) || values.length !== count)
      issues.push(name + ' must contain exactly one value per project period.')
    else if (values.some(value => !finite(value)))
      issues.push(name + ' must contain only finite values.')
  }
  for (const [name, values] of arrays.slice(0, 3)) {
    if (Array.isArray(values) && values.some(value => value < 0))
      issues.push(name + ' cannot contain negative amounts.')
  }
  for (const [name, values] of arrays.slice(3)) {
    if (Array.isArray(values) && values.some(value => value <= 0))
      issues.push(name + ' must contain strictly positive exchange rates.')
  }
  if (issues.length) return { valid: false, rows: [], issues, totalForeignExchangeLossLocal: Number.NaN }

  let foreignBalance = input.openingForeignBalance
  let openingCarryingAmountLocal = input.openingForeignBalance * input.openingExchangeRateToLocal
  const rows: PeriodicForeignCurrencyDebtRow[] = []
  for (let index = 0; index < count; index++) {
    const drawdown = input.drawdowns[index]
    const repayment = input.principalRepayments[index]
    const capitalizedInterest = input.capitalizedInterest[index]
    const capitalizedFee = capitalizedFees[index]
    const availableForeignBalance = foreignBalance + drawdown + capitalizedInterest + capitalizedFee
    if (repayment > availableForeignBalance + 1e-8) {
      issues.push('Principal repayment exceeds available foreign-currency debt in period ' + (index + 1) + '.')
      break
    }
    const closingForeignBalance = availableForeignBalance - repayment
    const drawdownLocal = drawdown * input.drawdownExchangeRates[index]
    const repaymentLocal = repayment * input.repaymentExchangeRates[index]
    const capitalizedInterestLocal = capitalizedInterest * input.capitalizedInterestExchangeRates[index]
    const capitalizedFeesLocal = capitalizedFee * capitalizedFeesExchangeRates[index]
    const closingCarryingAmountLocal = closingForeignBalance * input.closingExchangeRates[index]
    const foreignExchangeLossLocal = closingCarryingAmountLocal
      - openingCarryingAmountLocal - drawdownLocal - capitalizedInterestLocal - capitalizedFeesLocal + repaymentLocal
    rows.push({
      period: index + 1,
      openingForeignBalance: foreignBalance,
      drawdownForeign: drawdown,
      principalRepaymentForeign: repayment,
      capitalizedInterestForeign: capitalizedInterest,
      capitalizedFeesForeign: capitalizedFee,
      closingForeignBalance,
      openingCarryingAmountLocal,
      drawdownLocal,
      principalRepaymentLocal: repaymentLocal,
      capitalizedInterestLocal,
      capitalizedFeesLocal,
      closingCarryingAmountLocal,
      foreignExchangeLossLocal,
    })
    foreignBalance = closingForeignBalance
    openingCarryingAmountLocal = closingCarryingAmountLocal
  }
  if (issues.length) return { valid: false, rows: [], issues, totalForeignExchangeLossLocal: Number.NaN }
  return {
    valid: true,
    rows,
    issues: [],
    totalForeignExchangeLossLocal: rows.reduce((sum, row) => sum + row.foreignExchangeLossLocal, 0),
  }
}

/** Translate period income-statement flows at supplied average/transaction rates. */
export function translateForeignCurrencyFlowsToLocal(
  foreignAmounts: number[],
  exchangeRatesToLocal: number[],
): number[] {
  if (!foreignAmounts.length || foreignAmounts.length !== exchangeRatesToLocal.length ||
      foreignAmounts.some(value => !finite(value)) ||
      exchangeRatesToLocal.some(rate => !finite(rate) || rate <= 0)) return []
  return foreignAmounts.map((amount, index) => amount * exchangeRatesToLocal[index])
}


export type PeriodicForeignCurrencyLoanTranslationInput = {
  currency: ProjectCurrency
  periods: ProjectCalendarPeriod[]
  schedule: PeriodicLoanRow[]
  openingForeignBalance: number
  openingExchangeRateToLocal: number
}

/**
 * Connect the project's explicit currency-rate directory to one already-calculated
 * periodic loan schedule. The directory must contain an explicit rate for each
 * period; accepted keys are period number, exact start/end date, or YYYY-MM.
 * For each period the same supplied rate is used for period movements and closing
 * remeasurement because the schedule aggregates movements at period granularity.
 * This is an explicit period-rate convention, not a substitute for dated spot rates.
 */
export function translatePeriodicForeignCurrencyLoan(
  input: PeriodicForeignCurrencyLoanTranslationInput,
): PeriodicForeignCurrencyDebtResult {
  const { currency, periods, schedule } = input
  const issues: string[] = validatePeriods(periods)
  if (!currency?.code?.trim()) issues.push('A foreign currency code is required.')
  if (!Array.isArray(currency?.exchangeRates)) issues.push('The foreign currency must have an exchange-rate directory.')
  if (!Array.isArray(schedule) || schedule.length !== periods.length)
    issues.push('The loan schedule must contain exactly one row per project period.')
  if (issues.length) return { valid: false, rows: [], issues, totalForeignExchangeLossLocal: Number.NaN }

  const rates: number[] = []
  for (let index = 0; index < periods.length; index++) {
    const period = periods[index]
    const monthKey = period.startDate.slice(0, 7)
    const candidates = [String(period.index), period.startDate, period.endDate, monthKey]
    let resolved: number | undefined
    for (const key of candidates) {
      const matches = currency.exchangeRates.filter(rate => rate.period.trim() === key)
      if (matches.length > 1) {
        issues.push('Duplicate exchange-rate entries exist for key ' + key + '.')
        break
      }
      if (matches.length === 1) {
        resolved = matches[0].rateToLocal
        break
      }
    }
    if (resolved === undefined || !finite(resolved) || resolved <= 0)
      issues.push('A positive explicit exchange rate is missing for project period ' + period.index + '.')
    else rates.push(resolved)
    if (schedule[index]?.period !== period.index)
      issues.push('Loan schedule period sequence does not match the project calendar at period ' + period.index + '.')
  }
  if (issues.length) return { valid: false, rows: [], issues, totalForeignExchangeLossLocal: Number.NaN }

  return calculatePeriodicForeignCurrencyDebt({
    openingForeignBalance: input.openingForeignBalance,
    openingExchangeRateToLocal: input.openingExchangeRateToLocal,
    drawdowns: schedule.map(row => row.drawdown),
    principalRepayments: schedule.map(row => row.principal),
    capitalizedInterest: schedule.map(row => row.capitalizedInterest),
    capitalizedFees: schedule.map(row => row.capitalizedFinancingFees),
    drawdownExchangeRates: rates,
    repaymentExchangeRates: rates,
    capitalizedInterestExchangeRates: rates,
    capitalizedFeesExchangeRates: rates,
    closingExchangeRates: rates,
  }, periods)
}


export type ForeignExchangeStatementPostingInput = {
  statements: PeriodicFinancialStatement[]
  debtTranslation: PeriodicForeignCurrencyDebtResult
  taxRatesPercent: number[]
  openingTaxLossCarryForward?: number
  taxTreatment: 'deductible' | 'non-deductible'
}

export type ForeignExchangeStatementPostingResult = {
  valid: boolean
  statements: (PeriodicFinancialStatement & {
    incomeStatement: PeriodicFinancialStatement['incomeStatement'] & { foreignExchangeGainLoss: number }
  })[]
  closingTaxLossCarryForward: number
  issues: string[]
}

/**
 * Posts debt remeasurement into an already-built local-currency statement set.
 *
 * Preconditions: the base statements' debt balances include the foreign debt at
 * transaction-date carrying values, while debtTranslation contains only the
 * remeasurement differences. FX gains/losses are non-cash; they adjust debt and
 * retained earnings. Only the cash-tax difference changes cash. Tax deductibility
 * and opening tax losses are explicit inputs, never inferred.
 */
export function postForeignExchangeIntoThreeStatements(
  input: ForeignExchangeStatementPostingInput,
): ForeignExchangeStatementPostingResult {
  const issues: string[] = []
  const { statements, debtTranslation, taxRatesPercent } = input
  if (!Array.isArray(statements) || !statements.length)
    issues.push('At least one linked financial statement is required.')
  if (!debtTranslation?.valid || debtTranslation.rows.length !== statements.length)
    issues.push('A valid foreign-currency debt translation row is required for every statement period.')
  if (taxRatesPercent.length !== statements.length ||
      taxRatesPercent.some(rate => !finite(rate) || rate < 0 || rate > 100))
    issues.push('A valid tax rate from 0 to 100 percent is required for every statement period.')
  const openingLoss = input.openingTaxLossCarryForward ?? 0
  if (!finite(openingLoss) || openingLoss < 0)
    issues.push('Opening tax loss carry-forward must be finite and non-negative.')
  if (input.taxTreatment !== 'deductible' && input.taxTreatment !== 'non-deductible')
    issues.push('FX tax treatment must be explicitly deductible or non-deductible.')
  if (issues.length) return { valid: false, statements: [], closingTaxLossCarryForward: Number.NaN, issues }

  let taxLossCarryForward = openingLoss
  let cumulativeFx = 0
  let cumulativeCashTaxAdjustment = 0
  let cumulativeRetainedEarningsAdjustment = 0
  const posted: ForeignExchangeStatementPostingResult['statements'] = []

  for (let index = 0; index < statements.length; index++) {
    const statement = statements[index]
    const fxLoss = debtTranslation.rows[index].foreignExchangeLossLocal
    const taxRate = taxRatesPercent[index]
    if (!finite(fxLoss) || statement.period !== debtTranslation.rows[index].period) {
      issues.push('FX translation and financial statement periods do not reconcile at period ' + (index + 1) + '.')
      break
    }
    const taxableProfitBeforeLoss = statement.incomeStatement.profitBeforeTax
      - (input.taxTreatment === 'deductible' ? fxLoss : 0)
    const taxableProfitAfterLoss = taxableProfitBeforeLoss - taxLossCarryForward
    const tax = Math.max(0, taxableProfitAfterLoss) * taxRate / 100
    taxLossCarryForward = taxableProfitAfterLoss < 0 ? -taxableProfitAfterLoss : 0
    const taxDelta = tax - statement.incomeStatement.tax
    const profitBeforeTax = statement.incomeStatement.profitBeforeTax - fxLoss
    const netIncome = profitBeforeTax - tax
    const netIncomeDelta = netIncome - statement.incomeStatement.netIncome
    const periodCashAdjustment = -taxDelta

    cumulativeFx += fxLoss
    cumulativeCashTaxAdjustment += periodCashAdjustment
    cumulativeRetainedEarningsAdjustment += netIncomeDelta

    const openingBalances = {
      ...statement.openingBalances,
      cash: statement.openingBalances.cash + cumulativeCashTaxAdjustment - periodCashAdjustment,
      debt: statement.openingBalances.debt + cumulativeFx - fxLoss,
      retainedEarnings: statement.openingBalances.retainedEarnings +
        cumulativeRetainedEarningsAdjustment - netIncomeDelta,
    }
    const cash = statement.balanceSheet.cash + cumulativeCashTaxAdjustment
    const debt = statement.balanceSheet.debt + cumulativeFx
    const retainedEarnings = statement.balanceSheet.retainedEarnings + cumulativeRetainedEarningsAdjustment
    const totalAssets = statement.balanceSheet.totalAssets + cumulativeCashTaxAdjustment
    const totalLiabilities = statement.balanceSheet.totalLiabilities + cumulativeFx
    const totalEquity = statement.balanceSheet.totalEquity + cumulativeRetainedEarningsAdjustment
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceDifference = totalAssets - totalLiabilitiesAndEquity
    const priorBalanceDifference = statement.balanceSheet.balanceDifference
    const reconciled = statement.balanceSheet.reconciled && Math.abs(balanceDifference) <= 0.01

    const cashFlowStatement = {
      ...statement.cashFlowStatement,
      operatingCashFlow: statement.cashFlowStatement.operatingCashFlow + netIncomeDelta + fxLoss,
      netChangeInCash: statement.cashFlowStatement.netChangeInCash + periodCashAdjustment,
      closingCash: statement.cashFlowStatement.closingCash + cumulativeCashTaxAdjustment,
    }
    const movementChecks = {
      ...statement.movementChecks,
      cash: statement.movementChecks.cash + periodCashAdjustment,
      debt: statement.movementChecks.debt + fxLoss,
      retainedEarnings: statement.movementChecks.retainedEarnings + netIncomeDelta,
    }
    posted.push({
      ...statement,
      openingBalances,
      incomeStatement: {
        ...statement.incomeStatement,
        foreignExchangeGainLoss: -fxLoss,
        profitBeforeTax,
        tax,
        netIncome,
      },
      cashFlowStatement,
      balanceSheet: {
        ...statement.balanceSheet,
        cash,
        debt,
        totalAssets,
        totalLiabilities,
        retainedEarnings,
        totalEquity,
        totalLiabilitiesAndEquity,
        balanceDifference,
        reconciled,
      },
      movementChecks,
    })
    if (!reconciled) {
      issues.push('Foreign-exchange posting did not preserve the balance sheet in period ' + (index + 1) + '.')
      break
    }
  }
  if (issues.length) return { valid: false, statements: [], closingTaxLossCarryForward: Number.NaN, issues }
  return { valid: true, statements: posted, closingTaxLossCarryForward: taxLossCarryForward, issues: [] }
}
