import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
// COMFAR III Expert Integrated steel DRI/slab: valuation date 12/1401.
// The year-20 scrap-value column is a terminal event at the end of operating
// year 19, not a separate twentieth annual discount period.
const cumulative = [-104334839.16,-238945905.66,-372039166.1,-460482325,-341732072.95,-153828125.21,58892418.93,285330366.44,474893063.82,663858438.45,852766785.13,1041627644.8,1230429195.82,1419229771.59,1608028060.47,1796825483.17,1985622905.87,2174420328.57,2363217751.27]
const cashFlows = cumulative.map((value, index) => index === 0 ? value : value - cumulative[index - 1])
cashFlows[cashFlows.length - 1] += 224704008.39 // COMFAR year-20 scrap value, discounted with final operating year 19.
const addDays = (isoDate, days) => { const date = new Date(isoDate + 'T00:00:00.000Z'); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
const periods = Array.from({ length: cashFlows.length }, (_, index) => { const startDate = addDays('2022-03-21', index * 365); return { index: index + 1, startDate, endDate: addDays(startDate, 364), days: 365, partial: false } })
const valuationDate = '2023-03-20' // 12/1401, end of the first COMFAR construction period.
const npv = engine.calculatePeriodicNpv(cashFlows, periods, 25, 365, 'period-end', valuationDate, 'period-count', 1)
const irr = engine.calculatePeriodicIrr(cashFlows, periods, 365, 'period-end')
const close = (actual, expected, label, tolerance) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, label + ': expected ' + expected + ', received ' + actual)
close(npv, 19964251.38, 'Integrated steel DRI/slab COMFAR NPV at 25%', 0.03)
close(irr, 26.08, 'Integrated steel DRI/slab COMFAR total-investment IRR (%)', 0.02)
console.log('Integrated steel DRI/slab COMFAR total-investment NPV/IRR baseline passed (terminal scrap aligned to final operating period).')
