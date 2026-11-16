import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/foreignCurrencyTranslation.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace("from '../projects/projectFoundation'", "from '../projects/projectFoundation'")
const module = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-06-30', days: 181, partial: false },
  { index: 2, startDate: '2025-07-01', endDate: '2025-12-31', days: 184, partial: false },
]
const debt = module.calculatePeriodicForeignCurrencyDebt({
  openingForeignBalance: 100,
  openingExchangeRateToLocal: 1.1,
  drawdowns: [50, 0],
  principalRepayments: [20, 0],
  capitalizedInterest: [5, 0],
  drawdownExchangeRates: [1.2, 1.2],
  repaymentExchangeRates: [1.25, 1.25],
  capitalizedInterestExchangeRates: [1.2, 1.2],
  closingExchangeRates: [1.3, 1.25],
}, periods)
assert.equal(debt.valid, true, debt.issues.join('; '))
assert.equal(debt.rows[0].closingForeignBalance, 135)
assert.ok(Math.abs(debt.rows[0].closingCarryingAmountLocal - 175.5) < 1e-10)
assert.ok(Math.abs(debt.rows[0].foreignExchangeLossLocal - 24.5) < 1e-10,
  'Foreign-currency debt remeasurement must isolate the FX loss after separately translated movements')
assert.ok(Math.abs(debt.rows[1].foreignExchangeLossLocal + 6.75) < 1e-10,
  'A decrease in the closing exchange rate must be recognized as an FX gain on a liability')
assert.ok(Math.abs(debt.totalForeignExchangeLossLocal - 17.75) < 1e-10)
assert.deepEqual(module.translateForeignCurrencyFlowsToLocal([100, -40], [1.2, 1.25]), [120, -50])
assert.deepEqual(module.translateForeignCurrencyFlowsToLocal([100], [0]), [])
assert.equal(module.calculatePeriodicForeignCurrencyDebt({
  openingForeignBalance: 100, openingExchangeRateToLocal: 1.1,
  drawdowns: [0, 0], principalRepayments: [101, 0], capitalizedInterest: [0, 0],
  drawdownExchangeRates: [1, 1], repaymentExchangeRates: [1, 1],
  capitalizedInterestExchangeRates: [1, 1], closingExchangeRates: [1, 1],
}, periods).valid, false, 'Repayments may not exceed available foreign-currency principal')
assert.equal(module.calculatePeriodicForeignCurrencyDebt({
  openingForeignBalance: 0, openingExchangeRateToLocal: 1,
  drawdowns: [0], principalRepayments: [0], capitalizedInterest: [0],
  drawdownExchangeRates: [1], repaymentExchangeRates: [1],
  capitalizedInterestExchangeRates: [1], closingExchangeRates: [1],
}, [{ index: 1, startDate: '2025-01-01', endDate: '2025-06-30', days: 180, partial: false }]).valid,
false, 'Invalid calendar day counts must be rejected')

const integrated = module.translatePeriodicForeignCurrencyLoan({
  currency: {
    id: 'eur', code: 'EUR', name: 'Euro',
    exchangeRates: [{ period: '1', rateToLocal: 1.3 }, { period: '2', rateToLocal: 1.25 }],
  },
  periods,
  openingForeignBalance: 100,
  openingExchangeRateToLocal: 1.1,
  schedule: [
    { period: 1, drawdown: 50, openingBalance: 100, periodRatePercent: 0, interestExpense: 0,
      capitalizedInterest: 5, financingFeeExpense: 0, commitmentFeeExpense: 0,
      capitalizedFinancingFees: 2, principal: 20, closingBalance: 137, debtService: 20 },
    { period: 2, drawdown: 0, openingBalance: 137, periodRatePercent: 0, interestExpense: 0,
      capitalizedInterest: 0, financingFeeExpense: 0, commitmentFeeExpense: 0,
      capitalizedFinancingFees: 0, principal: 0, closingBalance: 137, debtService: 0 },
  ],
})
assert.equal(integrated.valid, true, integrated.issues.join('; '))
assert.equal(integrated.rows[0].closingForeignBalance, 137)
assert.ok(Math.abs(integrated.rows[0].foreignExchangeLossLocal - 20.0) < 1e-10,
  'Integrated loan translation must include capitalized financing fees in foreign principal')
assert.ok(Math.abs(integrated.rows[1].foreignExchangeLossLocal + 6.85) < 1e-10)
const missingRate = module.translatePeriodicForeignCurrencyLoan({
  currency: { id: 'eur', code: 'EUR', name: 'Euro', exchangeRates: [{ period: '1', rateToLocal: 1.3 }] },
  periods, openingForeignBalance: 0, openingExchangeRateToLocal: 1.3,
  schedule: integrated.rows.map((_, index) => ({
    period: index + 1, drawdown: 0, openingBalance: 0, periodRatePercent: 0, interestExpense: 0,
    capitalizedInterest: 0, financingFeeExpense: 0, commitmentFeeExpense: 0,
    capitalizedFinancingFees: 0, principal: 0, closingBalance: 0, debtService: 0,
  })),
})
assert.equal(missingRate.valid, false, 'Every project period must have an explicit currency rate')

const baseStatement = {
  period: 1, startDate: '2025-01-01', endDate: '2025-12-31',
  openingBalances: {
    cash: 0, debt: 30, netFixedAssets: 60, netWorkingCapital: 0,
    deferredPreOperatingAssets: 0, paidInCapital: 30, retainedEarnings: 0,
  },
  incomeStatement: {
    revenue: 100, cashOperatingCosts: 20, ebitda: 80, depreciation: 10,
    assetDisposalGainLoss: 0, ebit: 70, interest: 5, cashInterestExpense: 5,
    financingFeeExpense: 0, commitmentFeeExpense: 0,
    profitBeforeTax: 65, tax: 13, netIncome: 52,
  },
  cashFlowStatement: {
    operatingCashFlow: 62, investingCashFlow: 0, financingCashFlow: 0,
    netChangeInCash: 62, closingCash: 62,
  },
  balanceSheet: {
    cash: 62, netWorkingCapital: 0, netFixedAssets: 50, deferredPreOperatingAssets: 0,
    totalAssets: 112, debt: 30, totalLiabilities: 30, paidInCapital: 30,
    retainedEarnings: 52, totalEquity: 82, totalLiabilitiesAndEquity: 112,
    balanceDifference: 0, reconciled: true,
  },
  movementChecks: {
    cash: 62, debt: 0, netWorkingCapital: 0, netFixedAssets: -10,
    deferredPreOperatingAssets: 0, paidInCapital: 0, retainedEarnings: 52,
  },
}
const posted = module.postForeignExchangeIntoThreeStatements({
  statements: [baseStatement],
  debtTranslation: {
    valid: true,
    rows: [{ period: 1, foreignExchangeLossLocal: 10 }],
    issues: [],
    totalForeignExchangeLossLocal: 10,
  },
  taxRatesPercent: [20],
  openingTaxLossCarryForward: 0,
  taxTreatment: 'deductible',
})
assert.equal(posted.valid, true, posted.issues.join('; '))
const statement = posted.statements[0]
assert.equal(statement.incomeStatement.foreignExchangeGainLoss, -10)
assert.equal(statement.incomeStatement.profitBeforeTax, 55)
assert.equal(statement.incomeStatement.tax, 11)
assert.equal(statement.incomeStatement.netIncome, 44)
assert.equal(statement.cashFlowStatement.operatingCashFlow, 64,
  'Non-cash FX loss must be added back to operating cash flow after tax')
assert.equal(statement.balanceSheet.debt, 40)
assert.equal(statement.balanceSheet.cash, 64)
assert.equal(statement.balanceSheet.retainedEarnings, 44)
assert.equal(statement.balanceSheet.totalAssets, statement.balanceSheet.totalLiabilitiesAndEquity)
assert.equal(statement.balanceSheet.reconciled, true)
assert.equal(posted.closingTaxLossCarryForward, 0)

const nondeductible = module.postForeignExchangeIntoThreeStatements({
  statements: [baseStatement],
  debtTranslation: {
    valid: true, rows: [{ period: 1, foreignExchangeLossLocal: 10 }],
    issues: [], totalForeignExchangeLossLocal: 10,
  },
  taxRatesPercent: [20],
  taxTreatment: 'non-deductible',
})
assert.equal(nondeductible.valid, true, nondeductible.issues.join('; '))
assert.equal(nondeductible.statements[0].incomeStatement.tax, 13,
  'Non-deductible FX losses must not reduce taxable profit')
assert.equal(nondeductible.statements[0].balanceSheet.totalAssets,
  nondeductible.statements[0].balanceSheet.totalLiabilitiesAndEquity)
assert.equal(module.postForeignExchangeIntoThreeStatements({
  statements: [baseStatement], debtTranslation: {
    valid: true, rows: [{ period: 2, foreignExchangeLossLocal: 10 }],
    issues: [], totalForeignExchangeLossLocal: 10,
  },
  taxRatesPercent: [20], taxTreatment: 'deductible',
}).valid, false, 'Statement and FX period numbers must match')

const foundation = {
  currencies: {
    localCurrencyCode: 'IRR',
    foreignCurrencies: [{
      id: 'eur', code: 'EUR', name: 'Euro',
      exchangeRates: [{ period: '1', rateToLocal: 1.3 }, { period: '2', rateToLocal: 1.25 }],
    }],
  },
}
assert.equal(module.resolveLoanFacilityCurrency(
  { currencyCode: 'eur', marketOrigin: 'foreign' }, foundation,
).currency.code, 'EUR')
assert.equal(module.resolveLoanFacilityCurrency(
  { currencyCode: 'USD', marketOrigin: 'foreign' }, foundation,
).valid, false, 'Foreign loan currency must exist in project foundation')
assert.equal(module.resolveLoanFacilityCurrency(
  { currencyCode: 'EUR', marketOrigin: 'local' }, foundation,
).valid, false, 'Local loans may not use a foreign currency code')
console.log('Periodic FX translation, loan-form currency binding and three-statement posting validation passed.')



