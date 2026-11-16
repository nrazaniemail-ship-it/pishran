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
assert.ok(Math.abs(integrated.rows[0].foreignExchangeLossLocal - 24.7) < 1e-10,
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
console.log('Periodic foreign-currency translation and loan-schedule integration validation passed.')

