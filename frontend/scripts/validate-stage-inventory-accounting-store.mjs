import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dataUrl = (source, tag = '') => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64') + (tag ? '#' + tag : '')
const localValues = new Map()
globalThis.localStorage = {
  get length() { return localValues.size },
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null },
  setItem(key, value) { localValues.set(key, String(value)) },
  removeItem(key) { localValues.delete(key) },
  key(index) { return [...localValues.keys()][index] ?? null },
}
const localStoreSource = await readFile(new URL('../src/core/storage/localStore.ts', import.meta.url), 'utf8')
const loadStore = async tag => {
  const storeSource = await readFile(new URL('../src/features/projects/stageInventoryAccountingStore.ts', import.meta.url), 'utf8')
  const storageModule = dataUrl(transpile(localStoreSource), tag + '-storage')
  const linked = storeSource.replace("../../core/storage/localStore", storageModule)
  return import(dataUrl(transpile(linked), tag + '-ledger'))
}
const first = await loadStore('first')
const projectId = 'FS00-PERSIST-THREE-PERIODS'
const postings = [
  { id: 'stage-transfer:raw-wip-p1', period: 1, kind: 'stage-transfer', productId: 'DRI',
    sourceReference: 'TRANSFER-001', debitAccount: 'Inventory:work-in-progress',
    creditAccount: 'Inventory:raw-materials', amount: 40 },
  { id: 'stage-transfer:wip-fg-p2', period: 2, kind: 'stage-transfer', productId: 'SLAB',
    sourceReference: 'TRANSFER-002', debitAccount: 'Inventory:finished-goods',
    creditAccount: 'Inventory:work-in-progress', amount: 55 },
  { id: 'stage-cogs:3:SLAB:CAST:SALE-003', period: 3, kind: 'cost-of-sales', productId: 'SLAB',
    sourceReference: 'SALE-003', debitAccount: 'Cost of Sales',
    creditAccount: 'Inventory:finished-goods', amount: 30 },
]
const savedOnce = await first.persistStageInventoryAccountingPostings(projectId, postings)
assert.equal(savedOnce.insertedCount, 3)
assert.equal(savedOnce.existingCount, 0)
assert.equal(savedOnce.entries.length, 3)
assert.equal(savedOnce.debitTotal, 125)
assert.equal(savedOnce.creditTotal, 125)

const repeated = await first.persistStageInventoryAccountingPostings(projectId, postings)
assert.equal(repeated.insertedCount, 0, 'Repeating the same batch must not append duplicate documents')
assert.equal(repeated.existingCount, 3)
assert.equal(repeated.entries.length, 3)

const [concurrentA, concurrentB] = await Promise.all([
  first.persistStageInventoryAccountingPostings(projectId, postings),
  first.persistStageInventoryAccountingPostings(projectId, postings),
])
assert.equal(concurrentA.entries.length, 3)
assert.equal(concurrentB.entries.length, 3)
assert.equal(concurrentA.insertedCount + concurrentB.insertedCount, 0,
  'Concurrent replays must remain idempotent in the fallback storage queue')

await assert.rejects(
  first.persistStageInventoryAccountingPostings(projectId, [{ ...postings[0], amount: 41 }]),
  /reused with different accounting content/,
  'An existing document ID with changed accounting values must be rejected, not overwritten',
)
const restoredModule = await loadStore('reload')
const restored = await restoredModule.loadStageInventoryAccountingPostings(projectId)
assert.equal(restored.entries.length, 3, 'Persisted journal must be recoverable after module reload')
assert.deepEqual(restored.entries.map(row => row.id), postings.map(row => row.id))
assert.equal((await restoredModule.loadStageInventoryAccountingPostings('OTHER-PROJECT')).entries.length, 0,
  'Project ledgers must remain isolated')

const engineSource = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const engine = await import(dataUrl(transpile(engineSource), 'financial-engine'))
const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365 },
  { index: 2, startDate: '2026-01-01', endDate: '2026-12-31', days: 365 },
  { index: 3, startDate: '2027-01-01', endDate: '2027-12-31', days: 365 },
]
const input = {
  periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [200, 220, 240], periodRevenue: [200, 220, 240],
  annualVariableCost: [100, 110, 120], periodVariableCost: [100, 110, 120],
  annualFixedCost: [0, 0, 0], annualDepreciation: [0, 0, 0],
  annualFixedInvestment: [0, 0, 0], annualPreOperatingCost: [0, 0, 0],
  annualMaintenanceCapex: [0, 0, 0], annualTaxRates: [0, 0, 0],
  annualEquityContributions: [0, 0, 0],
  workingCapitalByPeriod: [100, 120, 130],
  rawMaterialsInventoryByPeriod: [60, 50, 40],
  workInProgressInventoryByPeriod: [20, 30, 30],
  finishedGoodsInventoryByPeriod: [20, 40, 60],
  openingWorkingCapital: 100, openingCash: 0, loans: [], discountRatePercent: 10,
}
const before = engine.calculateIntegratedPeriodicFinance(input)
assert.equal(before.valid, true, before.warnings.join('; '))
const buildStatements = result => engine.buildPeriodicThreeFinancialStatements(result, {
  cash: 0, debt: 0, netFixedAssets: 0, netWorkingCapital: 100,
  rawMaterialsInventory: 60, workInProgressInventory: 20, finishedGoodsInventory: 20,
  paidInCapital: 100, retainedEarnings: 0, grants: 0,
})
const statementsBefore = buildStatements(before)
assert.equal(statementsBefore.length, 3)
assert.ok(statementsBefore.every(row => row.balanceSheet.reconciled),
  'Three-period baseline statements must reconcile before persistence')
await restoredModule.persistStageInventoryAccountingPostings(projectId, postings)
const after = engine.calculateIntegratedPeriodicFinance(input)
const statementsAfter = buildStatements(after)
assert.deepEqual(after.rows, before.rows,
  'Persisting/replaying subledger documents must not add inventory, CPP/CPS, COGS or working capital to finance calculations')
assert.deepEqual(statementsAfter, statementsBefore,
  'Persisting/replaying subledger documents must not alter income statement, cash flow or balance sheet')
for (let i = 0; i < 3; i++) {
  assert.equal(statementsAfter[i].balanceSheet.reconciled, true)
  assert.equal(statementsAfter[i].balanceSheet.netWorkingCapital, input.workingCapitalByPeriod[i])
}
console.log('PASS: persistent stage journal recovery, duplicate replay, concurrent idempotency, conflict rejection, project isolation and three-period three-statement non-interference.')
