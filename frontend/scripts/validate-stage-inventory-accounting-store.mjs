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

const abnormalWasteProject='FS00-ABNORMAL-WASTE-JOURNAL'
const abnormalWastePosting={
 id:'abnormal-waste:1:P1:CC-A:INC-001',period:1,kind:'abnormal-waste',productId:'P1',
 sourceReference:'INC-001',debitAccount:'Abnormal Waste Expense',
 creditAccount:'Inventory:raw-materials',amount:110,
}
const wasteJournalSaved=await restoredModule.persistStageInventoryAccountingPostings(abnormalWasteProject,[abnormalWastePosting])
assert.equal(wasteJournalSaved.insertedCount,1)
assert.equal(wasteJournalSaved.debitTotal,110)
assert.equal(wasteJournalSaved.creditTotal,110)
const wasteDebitByAccount = wasteJournalSaved.entries.reduce((totals, row) => {
  totals[row.debitAccount] = (totals[row.debitAccount] ?? 0) + row.amount
  return totals
}, {})
const wasteCreditByAccount = wasteJournalSaved.entries.reduce((totals, row) => {
  totals[row.creditAccount] = (totals[row.creditAccount] ?? 0) + row.amount
  return totals
}, {})
assert.deepEqual(wasteDebitByAccount, { 'Abnormal Waste Expense': 110 })
assert.deepEqual(wasteCreditByAccount, { 'Inventory:raw-materials': 110 })
assert.equal(wasteJournalSaved.entries.filter(row => row.period === 1).reduce((sum, row) => sum + row.amount, 0), 110,
  'The incident document must debit the abnormal-waste expense and credit raw-material inventory in its own period.')
const wasteJournalReplay=await restoredModule.persistStageInventoryAccountingPostings(abnormalWasteProject,[abnormalWastePosting])
assert.equal(wasteJournalReplay.insertedCount,0,'Replaying the same abnormal-waste journal must not duplicate the expense')
assert.equal(wasteJournalReplay.existingCount,1)
assert.equal(wasteJournalReplay.entries.length,1)
assert.equal(wasteJournalReplay.entries[0].creditAccount,'Inventory:raw-materials')

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

const reversal = await restoredModule.appendStageInventoryAccountingReversal(
  projectId, postings[0].id, 'REV-TRANSFER-001', 2,
)
assert.equal(reversal.insertedCount, 1)
const reversalEntry = reversal.entries.find(row => row.id === 'REV-TRANSFER-001')
assert.equal(reversalEntry.documentType, 'reversal')
assert.equal(reversalEntry.originalDocumentId, postings[0].id)
assert.equal(reversalEntry.debitAccount, postings[0].creditAccount)
assert.equal(reversalEntry.creditAccount, postings[0].debitAccount)
assert.equal(reversalEntry.amount, postings[0].amount)
assert.equal(reversalEntry.period, 2)
const repeatedReversal = await restoredModule.appendStageInventoryAccountingReversal(
  projectId, postings[0].id, 'REV-TRANSFER-001', 2,
)
assert.equal(repeatedReversal.insertedCount, 0)
assert.equal(repeatedReversal.existingCount, 1)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingReversal(projectId, postings[0].id, 'REV-TRANSFER-002', 3),
  /already been reversed/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingReversal(projectId, postings[1].id, 'REV-EARLY', 1),
  /cannot be posted before/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingReversal(projectId, 'REV-TRANSFER-001', 'REV-REVERSAL', 3),
  /Only an existing original/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(projectId, postings[0].id, {
    id: 'ADJ-AFTER-REVERSAL', period: 2, kind: 'stage-transfer', productId: 'DRI',
    sourceReference: 'ADJUST:TRANSFER-001', debitAccount: 'Inventory:work-in-progress',
    creditAccount: 'Inventory:raw-materials', amount: 2,
  }),
  /already been reversed/,
  'A reversed original must not also accept a separate incremental adjustment',
)
const adjustmentPosting = {
  id: 'ADJ-SALE-003', period: 3, kind: 'cost-of-sales', productId: 'SLAB',
  sourceReference: 'ADJUST:SALE-003', debitAccount: 'Cost of Sales',
  creditAccount: 'Inventory:finished-goods', amount: 5,
}
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(
    projectId, postings[2].id, { ...adjustmentPosting, id: 'ADJ-WRONG-PRODUCT', productId: 'DRI' },
  ),
  /retain the original product and document kind/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(
    projectId, postings[2].id, { ...adjustmentPosting, id: 'ADJ-WRONG-KIND', kind: 'stage-transfer' },
  ),
  /retain the original product and document kind/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(
    projectId, postings[2].id, { ...adjustmentPosting, id: 'ADJ-WRONG-ACCOUNTS', debitAccount: 'Inventory:finished-goods', creditAccount: 'Cost of Sales' },
  ),
  /retain the original debit and credit accounts/,
  'An incremental adjustment must preserve the original account direction; opposite-direction corrections require a reversal',
)
const adjusted = await restoredModule.appendStageInventoryAccountingAdjustment(
  projectId, postings[2].id, adjustmentPosting,
)
assert.equal(adjusted.insertedCount, 1)
const adjustmentEntry = adjusted.entries.find(row => row.id === adjustmentPosting.id)
assert.equal(adjustmentEntry.documentType, 'adjustment')
assert.equal(adjustmentEntry.adjustmentOfDocumentId, postings[2].id)
const adjustmentReplay = await restoredModule.appendStageInventoryAccountingAdjustment(
  projectId, postings[2].id, adjustmentPosting,
)
assert.equal(adjustmentReplay.insertedCount, 0)
assert.equal(adjustmentReplay.existingCount, 1)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(
    projectId, postings[2].id, { ...adjustmentPosting, id: 'ADJ-SALE-003-SECOND', amount: 2 },
  ),
  /already has an adjustment/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingAdjustment(
    projectId, postings[2].id, { ...adjustmentPosting, id: 'ADJ-SALE-003-EARLY', period: 2 },
  ),
  /cannot be posted before/,
)
await assert.rejects(
  restoredModule.appendStageInventoryAccountingReversal(projectId, postings[2].id, 'REV-AFTER-ADJUSTMENT', 3),
  /already has an adjustment/,
  'An adjusted original must not be reversed without an explicit adjustment reversal chain',
)
assert.deepEqual(
  adjusted.entries.filter(row => row.documentType === 'original').map(row => row.id),
  postings.map(row => row.id),
  'Corrections must append new documents and never mutate original postings',
)
const periodImpact = [1, 2, 3].map(period => adjusted.entries
  .filter(row => row.period === period)
  .reduce((sum, row) => sum + (row.debitAccount.startsWith('Inventory:') ? row.amount : 0) -
    (row.creditAccount.startsWith('Inventory:') ? row.amount : 0), 0))
assert.deepEqual(periodImpact, [0, 0, -35],
  'Original transfers, their reversal and the COGS adjustment must be visible in their accounting periods')
const cogsByPeriod = [1, 2, 3].map(period => adjusted.entries
  .filter(row => row.period === period && row.debitAccount === 'Cost of Sales')
  .reduce((sum, row) => sum + row.amount, 0))
assert.deepEqual(cogsByPeriod, [0, 0, 35])

// Independent trial-balance reconstruction: derive debit and credit sides
// separately from the append-only documents, grouped by document, account and period.
const debitByAccount = new Map()
const creditByAccount = new Map()
const debitByPeriod = new Map()
const creditByPeriod = new Map()
const documentSides = new Map()
for (const row of adjusted.entries) {
  debitByAccount.set(row.debitAccount, (debitByAccount.get(row.debitAccount) ?? 0) + row.amount)
  creditByAccount.set(row.creditAccount, (creditByAccount.get(row.creditAccount) ?? 0) + row.amount)
  debitByPeriod.set(row.period, (debitByPeriod.get(row.period) ?? 0) + row.amount)
  creditByPeriod.set(row.period, (creditByPeriod.get(row.period) ?? 0) + row.amount)
  const sides = documentSides.get(row.id) ?? { debit: 0, credit: 0, debitAccount: row.debitAccount, creditAccount: row.creditAccount, period: row.period }
  sides.debit += row.amount
  sides.credit += row.amount
  documentSides.set(row.id, sides)
}
assert.equal(documentSides.size, 5, 'Original, reversal and adjustment documents must all remain separately traceable.')
for (const [documentId, sides] of documentSides) {
  assert.equal(sides.debit, sides.credit, 'Document ' + documentId + ' must balance independently.')
  assert.equal(sides.debitAccount === sides.creditAccount, false)
}
for (const period of [1, 2, 3]) {
  assert.equal(debitByPeriod.get(period), creditByPeriod.get(period),
    'Period ' + period + ' must independently balance after period-scoped reversal/adjustment posting.')
}
assert.deepEqual([1, 2, 3].map(period => debitByPeriod.get(period)), [40, 95, 35])
assert.deepEqual([1, 2, 3].map(period => creditByPeriod.get(period)), [40, 95, 35])
assert.deepEqual(Object.fromEntries(debitByAccount), {
  'Inventory:work-in-progress': 40,
  'Inventory:finished-goods': 55,
  'Cost of Sales': 35,
  'Inventory:raw-materials': 40,
})
assert.deepEqual(Object.fromEntries(creditByAccount), {
  'Inventory:raw-materials': 40,
  'Inventory:work-in-progress': 95,
  'Inventory:finished-goods': 35,
})
const accountNames = new Set([...debitByAccount.keys(), ...creditByAccount.keys()])
const accountTrialBalance = Object.fromEntries([...accountNames].map(account => [account, {
  debit: debitByAccount.get(account) ?? 0,
  credit: creditByAccount.get(account) ?? 0,
  netDebit: (debitByAccount.get(account) ?? 0) - (creditByAccount.get(account) ?? 0),
}]))
assert.deepEqual(accountTrialBalance, {
  'Inventory:work-in-progress': { debit: 40, credit: 95, netDebit: -55 },
  'Inventory:finished-goods': { debit: 55, credit: 35, netDebit: 20 },
  'Cost of Sales': { debit: 35, credit: 0, netDebit: 35 },
  'Inventory:raw-materials': { debit: 40, credit: 40, netDebit: 0 },
}, 'Each account must show independently derived debit, credit and net movement totals.')
const rawMaterialAndWipNet = adjusted.entries
  .filter(row => row.debitAccount.includes('raw-materials') || row.creditAccount.includes('raw-materials') ||
    row.debitAccount.includes('work-in-progress') || row.creditAccount.includes('work-in-progress'))
  .reduce((sum, row) => sum + (row.debitAccount.startsWith('Inventory:') ? row.amount : 0) -
    (row.creditAccount.startsWith('Inventory:') ? row.amount : 0), 0)
assert.equal(rawMaterialAndWipNet, 0,
  'The original raw-to-WIP movement and its reversal must net to zero')
const statementsAfterCorrections = buildStatements(after)
assert.deepEqual(statementsAfterCorrections, statementsBefore,
  'The local append-only control ledger must not post the same reversal or adjustment a second time into the financial engine')
assert.ok(statementsAfterCorrections.every(row => row.balanceSheet.reconciled))

// Minimal IndexedDB transaction simulator: requests execute inside a readwrite
// transaction, commit atomically, and the backing database survives module reload.
const databases = new Map()
class FakeRequest { result = undefined; error = null; onsuccess = null; onerror = null }
class FakeTransaction {
  constructor(database, mode) {
    this.database = database; this.mode = mode; this.pending = 0; this.aborted = false; this.completed = false
    this.oncomplete = null; this.onerror = null; this.onabort = null
    this.working = new Map([...database.records].map(([key, value]) => [key, structuredClone(value)]))
  }
  objectStore() {
    const tx = this
    const schedule = (operation, write = false) => {
      const request = new FakeRequest()
      tx.pending += 1
      queueMicrotask(() => {
        try {
          if (write && tx.mode !== 'readwrite') throw new Error('readonly transaction')
          request.result = operation(tx.working)
          request.onsuccess?.()
        } catch (error) {
          request.error = error; request.onerror?.()
          tx.aborted = true
        } finally {
          tx.pending -= 1
          setTimeout(() => {
            if (tx.pending !== 0 || tx.aborted || tx.completed) return
            tx.completed = true
            tx.database.records = tx.working
            tx.oncomplete?.()
          }, 0)
          if (tx.aborted) setTimeout(() => tx.onabort?.(), 0)
        }
      })
      return request
    }
    return {
      get: key => schedule(records => records.get(key)),
      put: value => schedule(records => { records.set(value.key, structuredClone(value)); return value.key }, true),
      getAll: () => schedule(records => [...records.values()]),
      delete: key => schedule(records => records.delete(key), true),
      clear: () => schedule(records => records.clear(), true),
    }
  }
  abort() { this.aborted = true; setTimeout(() => this.onabort?.(), 0) }
}
class FakeDatabase {
  constructor(name) {
    this.name = name; this.records = new Map()
    this.objectStoreNames = { contains: name => name === 'kv' }
  }
  createObjectStore() {}
  transaction(_name, mode) { return new FakeTransaction(this, mode) }
}
globalThis.indexedDB = {
  open(name) {
    const request = new FakeRequest()
    setTimeout(() => {
      let db = databases.get(name)
      const isNew = !db
      if (!db) { db = new FakeDatabase(name); databases.set(name, db) }
      request.result = db
      if (isNew) request.onupgradeneeded?.()
      request.onsuccess?.()
    }, 0)
    return request
  },
}
const idbModule = await loadStore('indexeddb-first')
const idbProject = 'FS00-IDB-RELOAD'
const idbFirst = await idbModule.persistStageInventoryAccountingPostings(idbProject, postings)
assert.equal(idbFirst.insertedCount, 3)
const idbReversal = await idbModule.appendStageInventoryAccountingReversal(
  idbProject, postings[0].id, 'IDB-REV-001', 2,
)
assert.equal(idbReversal.insertedCount, 1)
const idbAdjustment = await idbModule.appendStageInventoryAccountingAdjustment(
  idbProject, postings[2].id, { ...adjustmentPosting, id: 'IDB-ADJ-001' },
)
assert.equal(idbAdjustment.insertedCount, 1)
const idbReloaded = await loadStore('indexeddb-after-reload')
const idbRecovered = await idbReloaded.loadStageInventoryAccountingPostings(idbProject)
assert.equal(idbRecovered.entries.length, 5, 'IndexedDB journal and correction documents must survive module reload')
assert.equal(idbRecovered.entries.filter(row => row.documentType === 'reversal').length, 1)
assert.equal(idbRecovered.entries.filter(row => row.documentType === 'adjustment').length, 1)
const idbReplay = await idbReloaded.appendStageInventoryAccountingReversal(
  idbProject, postings[0].id, 'IDB-REV-001', 2,
)
assert.equal(idbReplay.insertedCount, 0)
assert.equal(idbReplay.entries.length, 5)
console.log('PASS: append-only reversal/adjustment, original-document references, period guards, duplicate prevention, three-period journal impact, and IndexedDB transaction recovery after module reload.');

console.log('PASS: persistent stage journal recovery, duplicate replay, concurrent idempotency, conflict rejection, project isolation and three-period three-statement non-interference.')
