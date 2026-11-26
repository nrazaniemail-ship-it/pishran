import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
// COMFAR III Expert SARZAMIN hot-rolled plate: valuation date 12/1402.
// The 1419 scrap-value column is a terminal event at the end of the final
// operating period (1418), not an additional annual discount period.
const cumulative = [-7798194.22,-13595395.84,-8124277.04,495191.38,9890066.09,20017630.96,29998267.16,39560583.36,48928277.55,58277210.97,67610087.04,76931036.49,86246338.77,95561173.54,104875642.05,114189760.01,123503542.44]
const cashFlows = cumulative.map((value, index) => index === 0 ? value : value - cumulative[index - 1])
cashFlows[cashFlows.length - 1] += 10216364.93 // COMFAR scrap value, discounted with final operating year 1418.
const addDays = (isoDate, days) => { const date = new Date(isoDate + 'T00:00:00.000Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const periods = Array.from({ length: cashFlows.length }, (_, index) => { const startDate = addDays('2023-03-21', index * 365); return { index: index + 1, startDate, endDate: addDays(startDate, 364), days: 365, partial: false } })
const valuationDate = '2024-03-19' // 12/1402, end of the first COMFAR construction period.
const npv = engine.calculatePeriodicNpv(cashFlows, periods, 30, 365, 'period-end', valuationDate, 'period-count', 1)
const irr = engine.calculatePeriodicIrr(cashFlows, periods, 365, 'period-end')
const close = (actual, expected, label, tolerance) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, label + ': expected ' + expected + ', received ' + actual)
close(npv, 9158253.74, 'SARZAMIN hot-rolled plate COMFAR NPV at 30%', 0.03)
close(irr, 46.83, 'SARZAMIN hot-rolled plate COMFAR total-investment IRR (%)', 0.02)
console.log('SARZAMIN hot-rolled plate COMFAR total-investment NPV/IRR baseline passed (terminal scrap aligned to final operating period).')
