import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const localValues = new Map()
globalThis.localStorage = {
  get length() { return localValues.size },
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null },
  setItem(key, value) { localValues.set(key, String(value)) },
  removeItem(key) { localValues.delete(key) },
  key(index) { return [...localValues.keys()][index] ?? null },
}

const engineSource = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const engineUrl = dataUrl(transpile(engineSource))
const flowSource = await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts', import.meta.url), 'utf8')
const flowUrl = dataUrl(transpile(flowSource))
const controlSource = await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts', import.meta.url), 'utf8')
const controlUrl = dataUrl(transpile(controlSource))
const control = await import(controlUrl)
const productSource = await readFile(new URL('../src/features/projects/productOperatingSchedule.ts', import.meta.url), 'utf8')
const productLinked = transpile(productSource)
  .replace("'../steel/periodicFinancialEngine'", JSON.stringify(engineUrl))
  .replace("'./inventoryProductionFlow'", JSON.stringify(flowUrl))
  .replace("'./inventoryControlLedgers'", JSON.stringify(controlUrl))
const product = await import(dataUrl(productLinked))
const integrationSource = await readFile(new URL('../src/features/projects/cppCpsScheduleIntegration.ts', import.meta.url), 'utf8')
const integration = await import(dataUrl(transpile(integrationSource)))
const storeSource = await readFile(new URL('../src/features/projects/stageInventoryAccountingStore.ts', import.meta.url), 'utf8')
const localStoreSource = await readFile(new URL('../src/core/storage/localStore.ts', import.meta.url), 'utf8')
const storeLinked = transpile(storeSource).replace(
  '"../../core/storage/localStore"',
  JSON.stringify(dataUrl(transpile(localStoreSource))),
)
const store = await import(dataUrl(storeLinked))
const engine = await import(engineUrl)

const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365 },
  { index: 2, startDate: '2026-01-01', endDate: '2026-12-31', days: 365 },
  { index: 3, startDate: '2027-01-01', endDate: '2027-12-31', days: 365 },
]
const flowRows = [
  { period: '1', salesQuantity: 80, netUnitPrice: 20, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 0, openingFinishedGoodsValue: 0, finishedGoodsClosingQuantity: 20,
    rawMaterialPurchasesQuantity: 102, rawMaterialPurchasesValue: 1020, rawMaterialConsumptionQuantity: 100,
    normalRawMaterialWasteQuantity: 0, abnormalRawMaterialWasteQuantity: 2,
    abnormalWasteSourceReference: 'INCIDENT-AW-P1', abnormalWasteSourceVerified: true,
    unitsStarted: 100, unitsCompleted: 100, closingWipQuantity: 0, materialCompletionPercent: 0,
    conversionCompletionPercent: 0, conversionCost: 0,
    openingRawMaterialQuantity: 0, openingRawMaterialValue: 0, openingWipQuantity: 0,
    openingWipMaterialValue: 0, openingWipConversionValue: 0 },
  { period: '2', salesQuantity: 80, netUnitPrice: 20, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 20, openingFinishedGoodsValue: 200, finishedGoodsClosingQuantity: 20,
    rawMaterialPurchasesQuantity: 81, rawMaterialPurchasesValue: 810, rawMaterialConsumptionQuantity: 80,
    normalRawMaterialWasteQuantity: 0, abnormalRawMaterialWasteQuantity: 1,
    abnormalWasteSourceReference: 'INCIDENT-AW-P2', abnormalWasteSourceVerified: true,
    unitsStarted: 80, unitsCompleted: 80, closingWipQuantity: 0, materialCompletionPercent: 0,
    conversionCompletionPercent: 0, conversionCost: 0,
    openingRawMaterialQuantity: 0, openingRawMaterialValue: 0, openingWipQuantity: 0,
    openingWipMaterialValue: 0, openingWipConversionValue: 0 },
  { period: '3', salesQuantity: 80, netUnitPrice: 20, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 20, openingFinishedGoodsValue: 200, finishedGoodsClosingQuantity: 20,
    rawMaterialPurchasesQuantity: 80, rawMaterialPurchasesValue: 800, rawMaterialConsumptionQuantity: 80,
    normalRawMaterialWasteQuantity: 0, abnormalRawMaterialWasteQuantity: 0,
    abnormalWasteSourceReference: '', abnormalWasteSourceVerified: false,
    unitsStarted: 80, unitsCompleted: 80, closingWipQuantity: 0, materialCompletionPercent: 0,
    conversionCompletionPercent: 0, conversionCost: 0,
    openingRawMaterialQuantity: 0, openingRawMaterialValue: 0, openingWipQuantity: 0,
    openingWipMaterialValue: 0, openingWipConversionValue: 0 },
]
const sourceSchedule = product.buildProductOperatingSchedule({
  sales: [{ productId: 'P1', unitOfMeasure: 'kg', inventoryPolicy: 'manual',
    finishedGoodsDaysCoverage: null, productionStartPeriod: null, productionEndPeriod: null, periods: flowRows }],
  productionCosts: [],
}, periods, 1, 'IRR')
assert.equal(sourceSchedule.valid, true, sourceSchedule.issues.join('; '))
assert.deepEqual(sourceSchedule.periodAbnormalWasteExpense, [20, 10, 0],
  'The original abnormal-waste expense must come from the verified production-flow cost valuation.')
assert.deepEqual(sourceSchedule.periodRawMaterialInventoryValue, [0, 0, 0])
assert.deepEqual(sourceSchedule.periodCostOfSales, [800, 800, 800])
assert.deepEqual(sourceSchedule.rows.map(row => row.productionCost), [1000, 800, 800])
assert.deepEqual(sourceSchedule.rows.map(row => row.abnormalWasteValue), [20, 10, 0])

// Build original journal documents from the real, verified production-flow rows.
const built = control.buildAbnormalWasteAccountingPostings([], 3, sourceSchedule.rows)
assert.equal(built.valid, true, built.issues.join('; '))
assert.equal(built.postings.length, 2)
assert.deepEqual(built.postings.map(row => row.amount), [20, 10])
assert.ok(built.postings.every(row => row.debitAccount === 'Abnormal Waste Expense' &&
  row.creditAccount === 'Inventory:raw-materials'))

const projectId = 'FS00-E2E-ABNORMAL-WASTE-3P'
const savedOriginals = await store.persistStageInventoryAccountingPostings(projectId, built.postings)
assert.equal(savedOriginals.insertedCount, 2)
const replayedOriginals = await store.persistStageInventoryAccountingPostings(projectId, built.postings)
assert.equal(replayedOriginals.insertedCount, 0, 'Replaying originals must not double-post the source waste.')
assert.equal(replayedOriginals.existingCount, 2)
assert.equal(replayedOriginals.entries.length, 2)

const reversal = await store.appendStageInventoryAccountingReversal(
  projectId, built.postings[0].id, 'REV-AW-P1-IN-P2', 2,
)
assert.equal(reversal.insertedCount, 1)
const adjustment = await store.appendStageInventoryAccountingAdjustment(
  projectId, built.postings[1].id, {
    ...built.postings[1], id: 'ADJ-AW-P2-IN-P3', period: 3,
    sourceReference: 'ADJUSTMENT-AW-P2-5', amount: 5,
  },
)
assert.equal(adjustment.insertedCount, 1)

const reloadedStore = await store.loadStageInventoryAccountingPostings(projectId)
assert.equal(reloadedStore.entries.length, 4, 'Reload must return two originals, one reversal and one adjustment.')
assert.deepEqual(reloadedStore.entries.map(row => row.documentType), ['original', 'original', 'reversal', 'adjustment'])
const corrected = integration.applyStageJournalCorrectionsToProductSchedule(
  sourceSchedule, reloadedStore.entries, [0, 1, 2],
)
assert.equal(corrected.valid, true, corrected.issues.join('; '))
assert.deepEqual(corrected.appliedDocumentIds, ['REV-AW-P1-IN-P2', 'ADJ-AW-P2-IN-P3'])
assert.deepEqual(corrected.schedule.periodAbnormalWasteExpense, [20, -10, 5],
  'The original source expense is already in the operating schedule; only the reversal and incremental adjustment may change it.')
assert.deepEqual(corrected.schedule.periodRawMaterialInventoryValue, [0, 20, 15],
  'Reversal restores raw inventory from P2; the P3 adjustment reduces only P3 and later inventory.')
assert.deepEqual(corrected.schedule.periodCostOfSales, [800, 800, 800],
  'Abnormal-waste corrections must not be misclassified as COGS.')
assert.deepEqual(corrected.schedule.rows.map(row => row.productionCost), [1000, 800, 800],
  'Abnormal-waste corrections must not be capitalized into CPP.')
assert.deepEqual(corrected.schedule.periodWipInventoryValue, [0, 0, 0])
assert.deepEqual(corrected.schedule.rows.map(row => row.rawMaterialInventoryValue), [0, 20, 15])
assert.deepEqual(corrected.schedule.rows.map(row => row.abnormalWasteValue), [20, -10, 5])

// A second reload/replay is idempotent and a fresh source schedule produces the same
// corrected result; the append-only journal is never added as a second source expense.
const secondReload = await store.loadStageInventoryAccountingPostings(projectId)
const correctedAgain = integration.applyStageJournalCorrectionsToProductSchedule(
  sourceSchedule, secondReload.entries, [0, 1, 2],
)
assert.deepEqual(correctedAgain.schedule, corrected.schedule)
assert.equal(secondReload.entries.filter(row => row.documentType === 'original').length, 2)
assert.equal(secondReload.entries.filter(row => row.documentType === 'reversal').length, 1)
assert.equal(secondReload.entries.filter(row => row.documentType === 'adjustment').length, 1)

const makeFinanceInput = schedule => {
  const raw = schedule.periodRawMaterialInventoryValue
  const finishedGoods = schedule.rows.map(row => row.closingInventoryValue)
  const workingCapital = raw.map((value, index) => value + finishedGoods[index])
  return {
    periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
    annualRevenue: [...schedule.periodRevenue], periodRevenue: [...schedule.periodRevenue],
    annualVariableCost: [...schedule.periodCostOfSales], periodVariableCost: [...schedule.periodCostOfSales],
    annualFixedCost: [0, 0, 0], annualDepreciation: [0, 0, 0], annualFixedInvestment: [0, 0, 0],
    annualPreOperatingCost: [0, 0, 0], annualMaintenanceCapex: [0, 0, 0], annualTaxRates: [0, 0, 0],
    annualEquityContributions: [0, 0, 0], periodAbnormalWasteExpense: [...schedule.periodAbnormalWasteExpense],
    workingCapitalByPeriod: workingCapital, rawMaterialsInventoryByPeriod: raw,
    workInProgressInventoryByPeriod: [...schedule.periodWipInventoryValue],
    finishedGoodsInventoryByPeriod: finishedGoods, openingWorkingCapital: 200, openingCash: 0,
    loans: [], discountRatePercent: 10,
  }
}
const baselineFinance = engine.calculateIntegratedPeriodicFinance(makeFinanceInput(sourceSchedule))
const correctedFinance = engine.calculateIntegratedPeriodicFinance(makeFinanceInput(corrected.schedule))
assert.equal(baselineFinance.valid, true, baselineFinance.warnings.join('; '))
assert.equal(correctedFinance.valid, true, correctedFinance.warnings.join('; '))
assert.deepEqual(baselineFinance.rows.map(row => row.ebit), [780, 790, 800])
assert.deepEqual(correctedFinance.rows.map(row => row.ebit), [780, 810, 795])
assert.deepEqual(correctedFinance.rows.map(row => row.projectFreeCashFlow), baselineFinance.rows.map(row => row.projectFreeCashFlow),
  'The non-cash inventory write-off, reversal and adjustment must be offset by their same-period working-capital movements.')
assert.deepEqual(correctedFinance.rows.map(row => row.closingCash), baselineFinance.rows.map(row => row.closingCash))
assert.deepEqual(correctedFinance.rows.map(row => row.cfads), baselineFinance.rows.map(row => row.cfads))

const opening = {
  cash: 0, debt: 0, netFixedAssets: 0, netWorkingCapital: 200,
  rawMaterialsInventory: 0, workInProgressInventory: 0, finishedGoodsInventory: 200,
  paidInCapital: 200, retainedEarnings: 0, grants: 0,
}
const statements = engine.buildPeriodicThreeFinancialStatements(correctedFinance, opening)
assert.equal(statements.length, 3)
assert.deepEqual(statements.map(row => row.incomeStatement.abnormalWasteExpense), [20, -10, 5])
assert.deepEqual(statements.map(row => row.incomeStatement.costOfSales), [800, 800, 800])
assert.deepEqual(statements.map(row => row.cashFlowStatement.operatingCashFlow),
  baselineFinance.rows.map(row => row.operatingCashFlow))
assert.deepEqual(statements.map(row => row.balanceSheet.rawMaterialsInventory), [0, 20, 15])
assert.ok(statements.every(row => row.balanceSheet.reconciled),
  'The three statements must reconcile in all periods after persisted reversal and adjustment.')
assert.deepEqual(statements.map(row => row.balanceSheet.netWorkingCapital), [200, 220, 215])

console.log('PASS: FS-00 end-to-end abnormal-waste source → append-only journal → reload → P2 reversal/P3 adjustment → CPP/CPS/COGS/WC → three statements, with no duplicate posting and period-scoped effects.')
