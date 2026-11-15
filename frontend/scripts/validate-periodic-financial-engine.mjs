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
console.log('PASS: periodic financial primitives, day-count allocation, tax-loss roll-forward and dated NPV')
