import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const year = [{ index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365, partial: false }]
const quarter = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-03-31', days: 90, partial: false },
  { index: 2, startDate: '2025-04-01', endDate: '2025-06-30', days: 91, partial: false },
  { index: 3, startDate: '2025-07-01', endDate: '2025-09-30', days: 92, partial: false },
  { index: 4, startDate: '2025-10-01', endDate: '2025-12-31', days: 92, partial: false },
]

assert.equal(engine.annualEffectiveRateToPeriodRate(25, 365, 365), 25)
assert.ok(Math.abs(engine.prorateAnnualFlowByDays(365000, 91, 365) - 91000) < 1e-9)
assert.ok(Math.abs(quarter.reduce((sum, period) => sum + engine.prorateAnnualFlowByDays(365000, period.days, 365), 0) - 365000) < 1e-9)
const firstTax = engine.calculatePeriodTax(60, 25, 100)
assert.deepEqual(firstTax, { taxableProfitAfterLoss: -40, tax: 0, closingLossCarryForward: 40 })
const secondTax = engine.calculatePeriodTax(100, 25, firstTax.closingLossCarryForward)
assert.deepEqual(secondTax, { taxableProfitAfterLoss: 60, tax: 15, closingLossCarryForward: 0 })
assert.equal(engine.calculatePeriodTax(10, 101, 0).tax, Number.NaN)
assert.ok(Math.abs(engine.calculatePeriodicNpv([ -100, 125 ], [
  { index: 1, startDate: '2025-01-01', endDate: '2025-06-30', days: 181, partial: false },
  { index: 2, startDate: '2025-07-01', endDate: '2025-12-31', days: 184, partial: false },
], 25, 365, 'period-end') - (-100 / Math.pow(1.25, 181 / 365) + 125 / 1.25)) < 1e-9)
assert.ok(Number.isNaN(engine.calculatePeriodicNpv([100], [], 25, 365)))

const leapQuarter = [
  { index: 1, startDate: '2024-01-01', endDate: '2024-03-31', days: 91, partial: false },
  { index: 2, startDate: '2024-04-01', endDate: '2024-06-30', days: 91, partial: false },
  { index: 3, startDate: '2024-07-01', endDate: '2024-09-30', days: 92, partial: false },
  { index: 4, startDate: '2024-10-01', endDate: '2024-12-31', days: 92, partial: false },
]
const quarterlyAllocation = engine.allocateAnnualFlowsToPeriods([366000], leapQuarter, 1)
assert.ok(Math.abs(quarterlyAllocation.reduce((sum, amount) => sum + amount, 0) - 366000) < 1e-9)
const partialYear = [
  { index: 1, startDate: '2024-02-01', endDate: '2024-02-29', days: 29, partial: true },
  { index: 2, startDate: '2024-03-01', endDate: '2024-03-31', days: 31, partial: true },
]
const partialAllocation = engine.allocateAnnualFlowsToPeriods([366000], partialYear, 1)
assert.ok(Math.abs(partialAllocation.reduce((sum, amount) => sum + amount, 0) - 60000) < 1e-9)
const nonJanuaryFiscalYear = [
  { index: 1, startDate: '2024-01-01', endDate: '2024-03-31', days: 91, partial: false },
  { index: 2, startDate: '2024-04-01', endDate: '2024-06-30', days: 91, partial: false },
]
const splitFiscalYears = engine.allocateAnnualFlowsToPeriods([366000, 365000], nonJanuaryFiscalYear, 4)
assert.ok(Math.abs(splitFiscalYears[0] - 91000) < 1e-9)
assert.ok(Math.abs(splitFiscalYears[1] - 91000) < 1e-9)
assert.deepEqual(engine.allocateAnnualFlowsToPeriods([100], [{ index: 1, startDate: '2025-01-01', endDate: '2025-01-31', days: 30, partial: true }], 1), [])

const equalPrincipalLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'equal-principal',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(equalPrincipalLoan.valid, true)
assert.ok(equalPrincipalLoan.rows[0].capitalizedInterest > 0)
assert.equal(equalPrincipalLoan.rows[0].interestExpense, 0)
assert.ok(equalPrincipalLoan.rows[2].principal > 0)
assert.ok(equalPrincipalLoan.rows[3].principal > 0)
assert.ok(Math.abs(equalPrincipalLoan.rows[3].closingBalance) < 1e-8)
const annuityLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: false,
}, quarter, 365)
assert.equal(annuityLoan.valid, true)
assert.ok(annuityLoan.rows[0].interestExpense > 0)
assert.ok(annuityLoan.rows[2].principal > 0)
assert.ok(Math.abs(annuityLoan.rows[3].closingBalance) < 1e-8)
const bulletLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(bulletLoan.valid, true)
assert.equal(bulletLoan.rows[2].principal, 0)
assert.ok(bulletLoan.rows[3].principal > 0)
assert.ok(Math.abs(bulletLoan.rows[3].closingBalance) < 1e-8)
const invalidDrawdownLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 0, 10000, 0],
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 2,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: false,
}, quarter, 365)
assert.equal(invalidDrawdownLoan.valid, false)
assert.ok(invalidDrawdownLoan.issues.some(issue => issue.includes('after principal repayment')))


console.log('PASS: periodic loan schedules, fiscal-year allocation, leap-year handling, tax-loss roll-forward and dated NPV')
