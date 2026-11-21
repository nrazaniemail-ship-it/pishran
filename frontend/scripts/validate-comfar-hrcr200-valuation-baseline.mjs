import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

// COMFAR III Expert, HRCR200: total-capital cash flow, pp. 67-71;
// shareholder cash flow, pp. 76-80. Each row is one annual fiscal period.
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

const addDays = (isoDate, days) => {
  const date = new Date(isoDate + 'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const periods = Array.from({ length: 17 }, (_, index) => {
  const startDate = addDays('2024-01-01', index * 365)
  return {
    index: index + 1,
    startDate,
    endDate: addDays(startDate, 364),
    days: 365,
    partial: false,
  }
})
// COMFAR valuation date: end of 12/1404, i.e. the end of the second
// annual project period in this normalized annual-period regression fixture.
const valuationDate = periods[1].endDate
const projectNpv = engine.calculatePeriodicNpv(
  projectCashFlows, periods, 25, 365, 'period-end', valuationDate, 'period-count', 1,
)
const projectIrr = engine.calculatePeriodicIrr(projectCashFlows, periods, 365, 'period-end')
const equityNpv = engine.calculatePeriodicNpv(
  equityCashFlows, periods, 30, 365, 'period-end', valuationDate, 'period-count', 1,
)
const equityIrr = engine.calculatePeriodicIrr(equityCashFlows, periods, 365, 'period-end')

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
