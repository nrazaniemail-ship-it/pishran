import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { jalaliAnnualPeriods, jalaliPeriod, jalaliToIso, jalaliYearEndDay, assertJalaliPeriodSequence, calculateComfarPeriodCountIrr } from './comfar-jalali-calendar.mjs'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

// COMFAR III Expert, SARZAMIN cold-rolling project:
// Discounted cash flow for total invested capital, pp. 57-61.
// Amounts are million IRR. The first half-year construction bucket is
// discounted as one period before the 12/1402 valuation date; the second
// bucket is 1402 at the valuation date. The 1418 residual value is combined
// with the final operating-period flow, as in COMFAR's discounted table.
const cashFlows = [
  -6_660_810.70, // 7/1401-12/1401
  -8_029_561.30, // 1402
  6_912_999.97,  // 1403
  10_453_127.90, // 1404
  11_876_468.51, // 1405
  12_139_399.36, // 1406
  12_138_471.95, // 1407
  9_826_583.34,  // 1408
  9_826_583.34,  // 1409
  9_826_583.34,  // 1410
  9_826_583.34,  // 1411
  9_596_722.91,  // 1412
  9_589_162.91,  // 1413
  9_589_162.91,  // 1414
  9_581_649.90,  // 1415
  9_536_571.83,  // 1416
  9_536_571.83 + 6_562_709.81, // 1417 + residual value shown in 1418
]

// COMFAR horizon: 7/1401-12/1401, then 1402 construction, then 1403-1417 production.
// The initial half-year is one displayed COMFAR project period; keep period-count weighting.
const periods = [
  jalaliPeriod(1, 1401, 7, 1, 1401, 12, jalaliYearEndDay(1401), false),
  ...jalaliAnnualPeriods(1402, 1417, 2),
]
assertJalaliPeriodSequence(periods, jalaliToIso(1401, 7, 1), jalaliToIso(1417, 12, jalaliYearEndDay(1417)))
const valuationDate = jalaliToIso(1402, 12, jalaliYearEndDay(1402))
const npv = engine.calculatePeriodicNpv(
  cashFlows, periods, 20, 365, 'period-end', valuationDate, 'period-count', 1,
)
const irr = calculateComfarPeriodCountIrr(cashFlows)
const close = (actual, expected, label, tolerance) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  label + ': expected ' + expected + ', received ' + actual,
)

close(npv, 31_425_182.71, 'SARZAMIN COMFAR NPV at 20% as of 12/1402', 0.02)
close(irr, 52.83, 'SARZAMIN COMFAR total-investment IRR (%)', 0.01)
close(cashFlows.reduce((sum, value) => sum + value, 0), 142_128_981.13,
  'SARZAMIN cumulative net cash flow including residual value', 0.05)

console.log('SARZAMIN cold-rolling COMFAR valuation baseline passed: NPV, IRR and cumulative cash flow.')
