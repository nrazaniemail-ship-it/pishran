import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const sourceText = await readFile(new URL('../src/features/projects/cppCpsCostTraceability.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(sourceText, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const ledgerModule = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const makeSource = (reference, reliability = 'primary-document') => ({
  status: 'verified', reference, description: 'Documented cost evidence', reliability,
})
const base = {
  label: 'Materials cost', category: 'materials', basis: 'period-total',
  behaviour: 'mixed', fixedPercent: 20, variablePercent: 80,
  productId: null, costCentreId: 'CC-PROD', allocationMethod: 'production-quantity',
  baseCostCoverage: 'excluded', periodAmounts: [100, 120],
  baseCoveredAmounts: [0, 0], source: makeSource('invoice-register-01'),
}
const items = [
  { ...base, id: 'materials', periodAmounts: [100, 120] },
  { ...base, id: 'labour', label: 'Labour', category: 'labour',
    behaviour: 'fixed', fixedPercent: 100, variablePercent: 0,
    baseCostCoverage: 'fully-included', periodAmounts: [50, 60],
    baseCoveredAmounts: [50, 60], source: makeSource('payroll-ledger-01', 'management-record') },
  { ...base, id: 'energy', label: 'Energy', category: 'energy',
    baseCostCoverage: 'partially-included', periodAmounts: [80, 90],
    baseCoveredAmounts: [30, 40], source: makeSource('utility-bills-01') },
  { ...base, id: 'maintenance', label: 'Maintenance', category: 'maintenance',
    baseCostCoverage: 'excluded', periodAmounts: [0, 10], baseCoveredAmounts: [0, 0] },
  { ...base, id: 'overhead', label: 'Overhead', category: 'overhead',
    baseCostCoverage: 'unverified', periodAmounts: [null, null],
    baseCoveredAmounts: [null, null],
    source: { status: 'unverified', reference: '', description: 'CRC200 source not supplied',
      reliability: 'unverified' } },
]
const result = ledgerModule.buildCppCpsTraceLedger(items, 2)
assert.equal(result.valid, true, result.issues.join('; '))
assert.equal(result.complete, false, 'Unverified CRC200 items must keep the ledger incomplete')
assert.equal(result.readyForCppPosting, false, 'Incomplete evidence must block final CPP posting')
assert.deepEqual(result.unverifiedItemIds, ['overhead'])
assert.deepEqual(result.knownIncrementalByPeriod, [150, 180])
assert.deepEqual(result.completeIncrementalByPeriod, [null, null])
assert.deepEqual(result.knownIncrementalByCostCentre, { 'CC-PROD': 330 })
assert.deepEqual(result.completeIncrementalByCostCentre, { 'CC-PROD': null },
  'A centre containing unverified costs must not expose a complete total')
assert.deepEqual(result.knownIncrementalByCostCentreByPeriod, { 'CC-PROD': [150, 180] })
assert.deepEqual(result.completeIncrementalByCostCentreByPeriod, { 'CC-PROD': [null, null] },
  'Unverified costs must null the affected centre-period totals')
assert.deepEqual(result.knownFixedIncrementalByCostCentre, { 'CC-PROD': 66 })
assert.deepEqual(result.knownVariableIncrementalByCostCentre, { 'CC-PROD': 264 })
assert.deepEqual(result.knownIncrementalByCostCentreAndCategory['CC-PROD'], {
  materials: 220, labour: 0, energy: 100, maintenance: 10, overhead: 0,
})
assert.deepEqual(result.knownIncrementalByCategory, {
  materials: 220, labour: 0, energy: 100, maintenance: 10, overhead: 0,
})
assert.equal(result.rows.find(row => row.itemId === 'labour' && row.period === 1).incrementalCpp, 0,
  'Fully covered labour must not be counted twice')
assert.equal(result.rows.find(row => row.itemId === 'energy' && row.period === 1).incrementalCpp, 50,
  'Only the uncovered part of partially covered energy may enter CPP')
assert.equal(result.rows.find(row => row.itemId === 'overhead' && row.period === 1).grossCost, null,
  'Unverified CRC200 amounts must remain null')
assert.equal(result.rows.find(row => row.itemId === 'overhead' && row.period === 1).incrementalCpp, null)
assert.deepEqual(result.rows.find(row => row.itemId === 'materials').path,
  ['raw-material-inventory', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital'])

const ready = ledgerModule.buildCppCpsTraceLedger(items.slice(0, 4), 2)
assert.equal(ready.valid, true)
assert.equal(ready.complete, true)
assert.equal(ready.readyForCppPosting, true)
assert.deepEqual(ready.completeIncrementalByPeriod, [150, 180])
assert.deepEqual(ready.completeIncrementalByCostCentreByPeriod, { 'CC-PROD': [150, 180] })

const duplicate = ledgerModule.buildCppCpsTraceLedger([items[0], items[0]], 2)
assert.equal(duplicate.valid, false)
assert.ok(duplicate.issues.some(issue => issue.includes('stable-unique-id-required')))

const missingSource = ledgerModule.buildCppCpsTraceLedger([{
  ...items[0], source: { status: 'verified', reference: '', description: '', reliability: 'unverified' },
}], 2)
assert.equal(missingSource.valid, false)
assert.ok(missingSource.issues.some(issue => issue.includes('verified-source-requires-reference')))

const unknownCentreEvidence = ledgerModule.buildCppCpsTraceLedger([
  items[0], { ...items[4], costCentreId: null },
], 2)
assert.equal(unknownCentreEvidence.valid, true)
assert.equal(unknownCentreEvidence.complete, false)
assert.deepEqual(unknownCentreEvidence.unallocatedUnverifiedItemIds, ['overhead'])
assert.deepEqual(unknownCentreEvidence.completeIncrementalByCostCentre, { 'CC-PROD': null },
  'Unverified cost with no centre must prevent any centre total from being labelled complete')

const missingCostCentre = ledgerModule.buildCppCpsTraceLedger([{
  ...items[0], costCentreId: null,
}], 2)
assert.equal(missingCostCentre.valid, false)
assert.ok(missingCostCentre.issues.some(issue => issue.includes('cost-centre-id-required-for-verified-cost')))

const invalidCoverage = ledgerModule.buildCppCpsTraceLedger([{
  ...items[2], baseCoveredAmounts: [81, 40],
}], 2)
assert.equal(invalidCoverage.valid, false)
assert.ok(invalidCoverage.issues.some(issue => issue.includes('base-covered-amount-must-be-between-zero-and-gross-cost')))

const invalidSplit = ledgerModule.buildCppCpsTraceLedger([{
  ...items[0], fixedPercent: 60, variablePercent: 60,
}], 2)
assert.equal(invalidSplit.valid, false)
assert.ok(invalidSplit.issues.some(issue => issue.includes('mixed-cost-split-must-equal-100-percent')))

const missingPeriod = ledgerModule.buildCppCpsTraceLedger([{
  ...items[0], periodAmounts: [100, null],
}], 2)
assert.equal(missingPeriod.valid, false)
assert.ok(missingPeriod.issues.some(issue => issue.includes('missing-or-invalid-source-amount-period-2')))

console.log('CPP/CPS traceability, source completeness, coverage and duplicate-cost controls passed.')
