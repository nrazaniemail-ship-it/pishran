import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { jalaliAnnualPeriods, jalaliToIso, jalaliYearEndDay, assertJalaliPeriodSequence, calculateComfarPeriodCountIrr } from './comfar-jalali-calendar.mjs'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

// COMFAR III Expert, HRCR200: total-capital cash flow, pp. 67-71;
// shareholder cash flow, pp. 76-80. Each row is one COMFAR project period. Dates are exact Jalali fiscal-year boundaries; IRR uses COMFAR's annual project-period convention.
// The terminal salvage amount shown by COMFAR in the residual-value column
// is included in the final operating period for discounting to 12/1404.
const projectCashFlows = [
  -13_907_805.03,
  -8_093_664.03,
  9_602_342.59,
  14_451_793.80,
  16_364_704.85,
  18_303_107.76,
  18_712_850.68,
  15_024_064.82,
  15_024_064.82,
  15_024_064.82,
  15_024_064.82,
  14_719_546.80,
  14_719_546.80,
  14_719_546.80,
  14_718_471.78,
  14_710_023.10,
  14_708_024.54 + 13_735_466.82,
]
const equityCashFlows = [
  -8_905_157.30,
  -4_186_827.70,
  6_238_373.52,
  11_087_824.73,
  13_000_735.79,
  14_939_138.70,
  15_348_881.62,
  15_024_064.82,
  15_024_064.82,
  15_024_064.82,
  15_024_064.82,
  14_719_546.80,
  14_719_546.80,
  14_719_546.80,
  14_718_471.78,
  14_710_023.10,
  14_708_024.54 + 13_735_466.82,
]

const periods = jalaliAnnualPeriods(1403, 1419, 1)
assertJalaliPeriodSequence(periods, jalaliToIso(1403, 1, 1), jalaliToIso(1419, 12, jalaliYearEndDay(1419)))
// Report valuation date: 12/1404 (end of construction year 2).
const valuationDate = jalaliToIso(1404, 12, jalaliYearEndDay(1404))
const projectNpv = engine.calculatePeriodicNpv(
  projectCashFlows, periods, 25, 365, 'period-end', valuationDate, 'period-count', 1,
)
const projectIrr = calculateComfarPeriodCountIrr(projectCashFlows)
const equityNpv = engine.calculatePeriodicNpv(
  equityCashFlows, periods, 30, 365, 'period-end', valuationDate, 'period-count', 1,
)
const equityIrr = calculateComfarPeriodCountIrr(equityCashFlows)

const close = (actual, expected, label, tolerance) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  label + ': expected ' + expected + ', received ' + actual,
)
close(projectNpv, 31_399_764.27, 'COMFAR total-capital NPV at 25%', 0.02)
close(projectIrr, 48.31, 'COMFAR total-capital IRR (%)', 0.01)
close(equityNpv, 23_579_675.01, 'COMFAR shareholder NPV at 30%', 0.02)
close(equityIrr, 57.99, 'COMFAR shareholder IRR (%)', 0.01)
close(projectCashFlows.reduce((sum, value) => sum + value, 0), 217_560_216.57,
  'COMFAR total-capital cumulative net cash flow including salvage', 0.05)
close(equityCashFlows.reduce((sum, value) => sum + value, 0), 209_649_855.29,
  'COMFAR shareholder cumulative net cash flow including salvage', 0.05)

console.log('HRCR200 COMFAR annual valuation baseline passed: total and shareholder NPV/IRR.')
