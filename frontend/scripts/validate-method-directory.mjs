import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/financialMethodDirectory.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const directory = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

assert.deepEqual(directory.validateFinancialMethodDirectory(), [], 'Every method must have unique IDs and complete metadata')
assert.ok(directory.listFinancialMethods().length >= 15, 'Directory must cover the core feasibility domains')
for (const domain of ['depreciation','financing','taxation','investment','working-capital','revenue','costs','inflation-fx','valuation','risk']) {
  assert.ok(directory.listFinancialMethods(domain).length > 0, 'Method directory must cover domain: ' + domain)
}
assert.equal(directory.getFinancialMethod('depreciation.straight-line-scrap').calculationStatus, 'implemented')
assert.equal(directory.getFinancialMethod('depreciation.sum-of-years-digits').benchmarkStatus, 'unverified')
assert.equal(directory.getFinancialMethod('risk.sensitivity').calculationStatus, 'catalog-only')
assert.equal(directory.validateFinancialMethodParameters('depreciation.straight-line-scrap', {
  usefulLifeYears: 10, scrapPercent: 10, firstPeriodMonths: 6
}).length, 0, 'Valid depreciation parameters must pass')
assert.ok(directory.validateFinancialMethodParameters('depreciation.straight-line-scrap', {
  usefulLifeYears: 0, scrapPercent: 120, firstPeriodMonths: 6.5
}).length >= 3, 'Invalid depreciation parameters must fail closed')
assert.equal(directory.getFinancialMethod('taxation.period-rate-schedule').calculationStatus, 'implemented')
assert.equal(directory.getFinancialMethod('taxation.loss-carry-forward').benchmarkStatus, 'partial')
assert.ok(directory.validateFinancialMethodParameters('taxation.period-rate-schedule', { taxRates: 25 }).length === 0)
assert.ok(directory.validateFinancialMethodParameters('taxation.loss-carry-forward', { openingLoss: -1, taxRatePercent: 25 }).length >= 1)
assert.ok(directory.validateFinancialMethodParameters('valuation.mirr', { financeRate: 25 }).some(issue => issue.parameter === 'reinvestmentRate'))
assert.ok(directory.validateFinancialMethodParameters('missing.method', {}).some(issue => issue.code === 'unknown-method'))


console.log('PASS: extensible financial method directory metadata, domain coverage and parameter validation')
