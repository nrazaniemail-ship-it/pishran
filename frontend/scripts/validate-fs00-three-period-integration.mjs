import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
const load = async path => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return import(dataUrl(transpile(source)))
}
const loadProductSchedule = async () => {
  const [productSource, engineSource, flowSource, controlSource] = await Promise.all([
    readFile(new URL('../src/features/projects/productOperatingSchedule.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/projects/inventoryProductionFlow.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/projects/inventoryControlLedgers.ts', import.meta.url), 'utf8'),
  ])
  let output = transpile(productSource)
  output = output.replace("from '../steel/periodicFinancialEngine'", 'from ' + JSON.stringify(dataUrl(transpile(engineSource))))
  output = output.replace("from './inventoryProductionFlow'", 'from ' + JSON.stringify(dataUrl(transpile(flowSource))))
  output = output.replace("from './inventoryControlLedgers'", 'from ' + JSON.stringify(dataUrl(transpile(controlSource))))
  return import(dataUrl(output))
}
const [ledgerModule, integrationModule, productScheduleModule, engine, inventoryControlModule] = await Promise.all([
  load('../src/features/projects/cppCpsCostTraceability.ts'),
  load('../src/features/projects/cppCpsScheduleIntegration.ts'),
  loadProductSchedule(),
  load('../src/features/steel/periodicFinancialEngine.ts'),
  load('../src/features/projects/inventoryControlLedgers.ts'),
])
const advancedFinancePanelSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
assert.match(advancedFinancePanelSource, /Abnormal waste \(separate expense\)/,
  'Periodic finance report must display abnormal waste as a separate expense column')
assert.match(advancedFinancePanelSource, /Any break-even analysis based on fixed\/variable splits must disclose this unclassified amount separately/,
  'The report must disclose unclassified abnormal waste when fixed/variable break-even analysis is interpreted')

const close = (actual, expected, message) => assert.ok(
  Math.abs(actual - expected) < 1e-7 * Math.max(1, Math.abs(expected)),
  (message ?? 'Expected ' + expected + ', received ' + actual)
)

const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365 },
  { index: 2, startDate: '2026-01-01', endDate: '2026-12-31', days: 365 },
  { index: 3, startDate: '2027-01-01', endDate: '2027-12-31', days: 365 },
]
const baseRows = [
  { period: 1, openingInventoryQuantity: 10, openingInventoryValue: 100, salesQuantity: 80,
    productionQuantity: 100, closingInventoryQuantity: 30, productionCost: 1000,
    netSalesRevenue: 1600, completedUnits: 100, conversionEquivalentUnits: 110,
    conversionCompletionPercent: 100, materialEquivalentUnits: 0, materialCompletionPercent: 0,
    wipInventoryValue: 200, rawMaterialInventoryValue: 500 },
  { period: 2, openingInventoryQuantity: 30, openingInventoryValue: 300, salesQuantity: 90,
    productionQuantity: 80, closingInventoryQuantity: 20, productionCost: 800,
    netSalesRevenue: 1980, completedUnits: 80, conversionEquivalentUnits: 90,
    conversionCompletionPercent: 100, materialEquivalentUnits: 0, materialCompletionPercent: 0,
    wipInventoryValue: 220, rawMaterialInventoryValue: 450 },
  { period: 3, openingInventoryQuantity: 20, openingInventoryValue: 200, salesQuantity: 80,
    productionQuantity: 70, closingInventoryQuantity: 10, productionCost: 700,
    netSalesRevenue: 1760, completedUnits: 70, conversionEquivalentUnits: 75,
    conversionCompletionPercent: 100, materialEquivalentUnits: 0, materialCompletionPercent: 0,
    wipInventoryValue: 180, rawMaterialInventoryValue: 400 },
]
const schedule = {
  valid: true, issues: [], periodRevenue: [1600, 1980, 1760],
  periodCostOfSales: [800, 900, 800], periodSubsidyIncome: [0, 0, 0],
  annualRevenue: [1600, 1980, 1760], annualCostOfSales: [800, 900, 800],
  totalProductionQuantity: 250, totalSalesQuantity: 250, totalClosingInventoryValue: 600,
  periodRawMaterialInventoryValue: [500, 450, 400],
  periodWipInventoryValue: [200, 220, 180],
  hasInventoryFlow: true,
  rows: baseRows.map(row => ({
    ...row, productId: 'P1', unitProductionCost: row.productionCost / row.productionQuantity,
    weightedAverageUnitCost: 10, costOfSales: row.salesQuantity * 10,
    closingInventoryValue: row.closingInventoryQuantity * 10,
    subsidyIncome: 0, salesTaxPercent: 0, salesTaxSourceReference: '',
    salesTaxSourceVerified: false, taxableSales: row.netSalesRevenue, outputSalesTax: 0,
    grossProfit: row.netSalesRevenue - row.salesQuantity * 10,
    rawMaterialInventoryValue: row.rawMaterialInventoryValue, hasInventoryFlow: true,
    wipQuantity: 10, materialEquivalentUnits: 0,
  })),
}
const verifiedEnergy = {
  id: 'energy-three-period', label: 'Incremental conversion energy', category: 'energy',
  basis: 'period-total', behaviour: 'variable', fixedPercent: 0, variablePercent: 100,
  productId: 'P1', costCentreId: 'CC-ENERGY', allocationMethod: 'direct-product',
  baseCostCoverage: 'excluded', periodAmounts: [200, 100, 50],
  baseCoveredAmounts: [0, 0, 0],
  source: { status: 'verified', reference: 'test-energy-source', description: 'Verified source',
    reliability: 'primary-document' },
}
const ledger = ledgerModule.buildCppCpsTraceLedger([verifiedEnergy], 3)
assert.equal(ledger.readyForCppPosting, true, ledger.issues.join('; '))
const bound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(schedule, ledger, [0, 1, 2])
assert.equal(bound.valid, true, bound.issues.join('; '))
assert.deepEqual(bound.incrementalCppByPeriod, [200, 100, 50])

const rows = bound.schedule.rows
assert.equal(rows.length, 3)
for (let i = 0; i < 3; i++) {
  const original = baseRows[i]
  const completedCpp = [200, 100, 50][i] * original.completedUnits / original.conversionEquivalentUnits
  const wipCpp = [200, 100, 50][i] - completedCpp
  close(rows[i].productionCost - original.productionCost, completedCpp,
    'Only completed-output CPP must enter product production cost in period ' + (i + 1))
  close(rows[i].wipInventoryValue - original.wipInventoryValue, wipCpp,
    'Uncompleted conversion CPP must remain in WIP in period ' + (i + 1))
  close((rows[i].productionCost - original.productionCost) +
    (rows[i].wipInventoryValue - original.wipInventoryValue), [200, 100, 50][i],
    'CPP must reconcile between completed output and WIP in period ' + (i + 1))
}
close(bound.schedule.periodRawMaterialInventoryValue.reduce((a, b) => a + b, 0), 1350,
  'CPP/CPS conversion costs must not post raw-material purchases or consumption a second time')
for (let i = 1; i < 3; i++) {
  close(rows[i].openingInventoryValue, rows[i - 1].closingInventoryValue,
    'Finished-goods value must roll forward after CPP revaluation')
  close(rows[i].openingInventoryQuantity, rows[i - 1].closingInventoryQuantity,
    'Finished-goods quantity must roll forward between periods')
}
assert.deepEqual(bound.schedule.periodCostOfSales,
  rows.map(row => row.costOfSales), 'Period COGS must aggregate from the product ledger')
assert.deepEqual(bound.schedule.annualCostOfSales,
  rows.map(row => row.costOfSales), 'Annual COGS must reconcile for one fiscal year per period')

const rawMaterial = [...bound.schedule.periodRawMaterialInventoryValue]
const wip = [...bound.schedule.periodWipInventoryValue]
const finishedGoods = rows.map(row => row.closingInventoryValue)
const workingCapitalBeforeFinishedGoods = rawMaterial.map((value, i) => value + wip[i])
const wc = integrationModule.bindFinishedGoodsInventoryToWorkingCapital(
  workingCapitalBeforeFinishedGoods, bound.schedule, false)
assert.equal(wc.valid, true, wc.issues.join('; '))
for (let i = 0; i < 3; i++) {
  close(wc.closingWorkingCapitalByPeriod[i], rawMaterial[i] + wip[i] + finishedGoods[i],
    'Net WC must contain raw materials, WIP and finished goods exactly once in period ' + (i + 1))
  close(wc.inventoryAddedByPeriod[i], finishedGoods[i],
    'Product-led finished goods must be added once to WC')
}

const finance = engine.calculateIntegratedPeriodicFinance({
  periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [...bound.schedule.periodRevenue],
  periodRevenue: [...bound.schedule.periodRevenue],
  annualVariableCost: [...bound.schedule.periodCostOfSales],
  periodVariableCost: [...bound.schedule.periodCostOfSales],
  annualFixedCost: [0, 0, 0], annualDepreciation: [0, 0, 0],
  annualFixedInvestment: [0, 0, 0], annualPreOperatingCost: [0, 0, 0],
  annualMaintenanceCapex: [0, 0, 0], annualTaxRates: [0, 0, 0],
  annualEquityContributions: [0, 0, 0],
  workingCapitalByPeriod: wc.closingWorkingCapitalByPeriod,
  rawMaterialsInventoryByPeriod: rawMaterial,
  workInProgressInventoryByPeriod: wip,
  finishedGoodsInventoryByPeriod: finishedGoods,
  openingWorkingCapital: wc.closingWorkingCapitalByPeriod[0], openingCash: 0, loans: [], discountRatePercent: 10,
})
assert.equal(finance.valid, true, finance.warnings.join('; '))
assert.equal(finance.rows.length, 3)
for (let i = 0; i < 3; i++) {
  close(finance.rows[i].revenue, bound.schedule.periodRevenue[i],
    'Finance engine revenue must equal product schedule revenue')
  close(finance.rows[i].variableCost, bound.schedule.periodCostOfSales[i],
    'Finance engine variable cost must equal product COGS')
  close(finance.rows[i].closingWorkingCapital, wc.closingWorkingCapitalByPeriod[i],
    'Finance engine closing WC must equal product-led WC')
  close(finance.rows[i].rawMaterialsInventory, rawMaterial[i])
  close(finance.rows[i].workInProgressInventory, wip[i])
  close(finance.rows[i].finishedGoodsInventory, finishedGoods[i])
}
const statements = engine.buildPeriodicThreeFinancialStatements(finance, {
  cash: 0, debt: 0, netFixedAssets: 0, netWorkingCapital: wc.closingWorkingCapitalByPeriod[0],
  rawMaterialsInventory: rawMaterial[0], workInProgressInventory: wip[0], finishedGoodsInventory: finishedGoods[0],
  paidInCapital: wc.closingWorkingCapitalByPeriod[0], retainedEarnings: 0, grants: 0,
})
assert.equal(statements.length, 3)
for (let i = 0; i < 3; i++) {
  const statement = statements[i]
  close(statement.incomeStatement.revenue, bound.schedule.periodRevenue[i])
  close(statement.incomeStatement.cashOperatingCosts, bound.schedule.periodCostOfSales[i],
    'Income statement operating costs must equal COGS when fixed costs are zero')
  close(statement.balanceSheet.netWorkingCapital, wc.closingWorkingCapitalByPeriod[i])
  close(statement.balanceSheet.rawMaterialsInventory, rawMaterial[i])
  close(statement.balanceSheet.workInProgressInventory, wip[i])
  close(statement.balanceSheet.finishedGoodsInventory, finishedGoods[i])
  close(statement.balanceSheet.rawMaterialsInventory +
    statement.balanceSheet.workInProgressInventory +
    statement.balanceSheet.finishedGoodsInventory +
    statement.balanceSheet.otherNetWorkingCapital,
  statement.balanceSheet.netWorkingCapital,
  'Inventory subledgers plus residual current accounts must equal net WC')
  assert.equal(statement.balanceSheet.reconciled, true,
    'Three statements must reconcile without a balancing plug in period ' + (i + 1))
  close(statement.movementChecks.netWorkingCapital, 0,
    'Net WC movement must reconcile in period ' + (i + 1))
}


const journalDocuments = [
  { id: 'stage-transfer:RAW-WIP-001', period: 1, kind: 'stage-transfer', productId: 'P1',
    debitAccount: 'Inventory:work-in-progress', creditAccount: 'Inventory:raw-materials',
    amount: 10, documentType: 'original' },
  { id: 'stage-cogs:3:P1:CC-1:SALE-003', period: 3, kind: 'cost-of-sales', productId: 'P1',
    debitAccount: 'Cost of Sales', creditAccount: 'Inventory:finished-goods',
    amount: 30, documentType: 'original' },
  { id: 'REV-RAW-WIP-001', period: 2, kind: 'stage-transfer', productId: 'P1',
    debitAccount: 'Inventory:raw-materials', creditAccount: 'Inventory:work-in-progress',
    amount: 10, documentType: 'reversal', originalDocumentId: 'stage-transfer:RAW-WIP-001' },
  { id: 'ADJ-COGS-003', period: 3, kind: 'cost-of-sales', productId: 'P1',
    debitAccount: 'Cost of Sales', creditAccount: 'Inventory:finished-goods',
    amount: 5, documentType: 'adjustment', adjustmentOfDocumentId: 'stage-cogs:3:P1:CC-1:SALE-003' },
]
const journalBinding = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule, journalDocuments, [0, 1, 2],
)
assert.equal(journalBinding.valid, true, journalBinding.issues.join('; '))
assert.deepEqual(journalBinding.appliedDocumentIds, ['REV-RAW-WIP-001', 'ADJ-COGS-003'])

const malformedReversal = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule,
  [...journalDocuments, { ...journalDocuments[2], id: 'REV-WRONG-AMOUNT', amount: 9 }],
  [0, 1, 2],
)
assert.equal(malformedReversal.valid, false)
assert.ok(malformedReversal.issues.some(issue => issue.includes('exactly reverse')))
const crossProductAdjustment = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule,
  [...journalDocuments, { ...journalDocuments[3], id: 'ADJ-WRONG-PRODUCT', productId: 'P2' }],
  [0, 1, 2],
)
assert.equal(crossProductAdjustment.valid, false)
assert.ok(crossProductAdjustment.issues.some(issue => issue.includes('original product')))
const wrongDirectionAdjustment = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule,
  [...journalDocuments, { ...journalDocuments[3], id: 'ADJ-WRONG-ACCOUNTS',
    debitAccount: 'Inventory:finished-goods', creditAccount: 'Cost of Sales' }],
  [0, 1, 2],
)
assert.equal(wrongDirectionAdjustment.valid, false)
assert.ok(wrongDirectionAdjustment.issues.some(issue => issue.includes('original debit and credit accounts')),
  'A positive incremental adjustment must not silently reverse the original accounting direction')
const mixedCorrectionChain = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule,
  [...journalDocuments,
    { ...journalDocuments[2], id: 'REV-COGS-003', originalDocumentId: journalDocuments[1].id,
      debitAccount: journalDocuments[3].creditAccount, creditAccount: journalDocuments[3].debitAccount },
  ],
  [0, 1, 2],
)
assert.equal(mixedCorrectionChain.valid, false)
assert.ok(mixedCorrectionChain.issues.some(issue => issue.includes('both a reversal and an adjustment')),
  'An original journal cannot receive both an incremental adjustment and a reversal')

const correctedSchedule = journalBinding.schedule
assert.ok(correctedSchedule)
close(correctedSchedule.periodRawMaterialInventoryValue[0], bound.schedule.periodRawMaterialInventoryValue[0])
close(correctedSchedule.periodRawMaterialInventoryValue[1], bound.schedule.periodRawMaterialInventoryValue[1] + 10,
  'The reversal changes raw materials only in its recorded period and carries the corrected balance forward')
close(correctedSchedule.periodRawMaterialInventoryValue[2], bound.schedule.periodRawMaterialInventoryValue[2] + 10)
close(correctedSchedule.periodWipInventoryValue[1], bound.schedule.periodWipInventoryValue[1] - 10)
close(correctedSchedule.periodWipInventoryValue[2], bound.schedule.periodWipInventoryValue[2] - 10)
for (let i = 0; i < 3; i++) {
  const originalTotal = bound.schedule.periodRawMaterialInventoryValue[i] +
    bound.schedule.periodWipInventoryValue[i] +
    bound.schedule.rows.filter(row => row.period === i + 1).reduce((sum, row) => sum + row.closingInventoryValue, 0)
  const correctedTotal = correctedSchedule.periodRawMaterialInventoryValue[i] +
    correctedSchedule.periodWipInventoryValue[i] +
    correctedSchedule.rows.filter(row => row.period === i + 1).reduce((sum, row) => sum + row.closingInventoryValue, 0)
  close(correctedTotal - originalTotal, i === 2 ? -5 : 0,
    'Internal transfer reversal must preserve total inventory; only the period-3 COGS adjustment reduces it')
}
close(correctedSchedule.periodCostOfSales[0], bound.schedule.periodCostOfSales[0])
close(correctedSchedule.periodCostOfSales[1], bound.schedule.periodCostOfSales[1])
close(correctedSchedule.periodCostOfSales[2], bound.schedule.periodCostOfSales[2] + 5)
const correctedRaw = [...correctedSchedule.periodRawMaterialInventoryValue]
const correctedWip = [...correctedSchedule.periodWipInventoryValue]
const correctedFinishedGoods = correctedSchedule.rows.map(row => row.closingInventoryValue)
const correctedWc = integrationModule.bindFinishedGoodsInventoryToWorkingCapital(
  correctedRaw.map((value, index) => value + correctedWip[index]), correctedSchedule, false)
assert.equal(correctedWc.valid, true, correctedWc.issues.join('; '))
close(correctedWc.closingWorkingCapitalByPeriod[0], wc.closingWorkingCapitalByPeriod[0])
close(correctedWc.closingWorkingCapitalByPeriod[1], wc.closingWorkingCapitalByPeriod[1])
close(correctedWc.closingWorkingCapitalByPeriod[2], wc.closingWorkingCapitalByPeriod[2] - 5,
  'The COGS adjustment reduces finished-goods inventory and WC once')
const correctedFinance = engine.calculateIntegratedPeriodicFinance({
  periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [...correctedSchedule.periodRevenue],
  periodRevenue: [...correctedSchedule.periodRevenue],
  annualVariableCost: [...correctedSchedule.periodCostOfSales],
  periodVariableCost: [...correctedSchedule.periodCostOfSales],
  annualFixedCost: [0, 0, 0], annualDepreciation: [0, 0, 0],
  annualFixedInvestment: [0, 0, 0], annualPreOperatingCost: [0, 0, 0],
  annualMaintenanceCapex: [0, 0, 0], annualTaxRates: [0, 0, 0],
  annualEquityContributions: [0, 0, 0],
  workingCapitalByPeriod: correctedWc.closingWorkingCapitalByPeriod,
  rawMaterialsInventoryByPeriod: correctedRaw,
  workInProgressInventoryByPeriod: correctedWip,
  finishedGoodsInventoryByPeriod: correctedFinishedGoods,
  openingWorkingCapital: correctedWc.closingWorkingCapitalByPeriod[0], openingCash: 0, loans: [], discountRatePercent: 10,
})
assert.equal(correctedFinance.valid, true, correctedFinance.warnings.join('; '))
close(correctedFinance.rows[1].rawMaterialsInventory, finance.rows[1].rawMaterialsInventory + 10)
close(correctedFinance.rows[1].workInProgressInventory, finance.rows[1].workInProgressInventory - 10)
close(correctedFinance.rows[1].closingWorkingCapital, finance.rows[1].closingWorkingCapital,
  'A stage reclassification must not change total WC')
close(correctedFinance.rows[2].variableCost, finance.rows[2].variableCost + 5)
close(correctedFinance.rows[2].finishedGoodsInventory, finance.rows[2].finishedGoodsInventory - 5)
close(correctedFinance.rows[2].closingWorkingCapital, finance.rows[2].closingWorkingCapital - 5)
const correctedStatements = engine.buildPeriodicThreeFinancialStatements(correctedFinance, {
  cash: 0, debt: 0, netFixedAssets: 0, netWorkingCapital: correctedWc.closingWorkingCapitalByPeriod[0],
  rawMaterialsInventory: correctedRaw[0], workInProgressInventory: correctedWip[0],
  finishedGoodsInventory: correctedFinishedGoods.filter((_, index) => correctedSchedule.rows[index].period === 1).reduce((sum, value) => sum + value, 0),
  paidInCapital: correctedWc.closingWorkingCapitalByPeriod[0], retainedEarnings: 0, grants: 0,
})
assert.equal(correctedStatements.length, 3)
close(correctedStatements[2].incomeStatement.cashOperatingCosts, statements[2].incomeStatement.cashOperatingCosts + 5)
close(correctedStatements[2].balanceSheet.netWorkingCapital, statements[2].balanceSheet.netWorkingCapital - 5)
close(correctedStatements[2].balanceSheet.finishedGoodsInventory, statements[2].balanceSheet.finishedGoodsInventory - 5)
close(correctedStatements[2].cashFlowStatement.operatingCashFlow, statements[2].cashFlowStatement.operatingCashFlow,
  'The COGS expense and matching finished-goods/WC release must not create a second cash outflow')
close(correctedStatements[2].cashFlowStatement.netChangeInCash, statements[2].cashFlowStatement.netChangeInCash)
close(correctedStatements[2].cashFlowStatement.closingCash, statements[2].cashFlowStatement.closingCash)
assert.ok(correctedStatements.every(row => row.balanceSheet.reconciled),
  'Reversal and adjustment effects must reconcile through all three statements')
const priorSalesCorrection = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  bound.schedule,
  [...journalDocuments,
    { id: 'stage-cogs:1:P1:CC-1:SALE-001', period: 1, kind: 'cost-of-sales', productId: 'P1',
      debitAccount: 'Cost of Sales', creditAccount: 'Inventory:finished-goods', amount: 10,
      documentType: 'original' },
    { id: 'ADJ-COGS-PRIOR', period: 1, kind: 'cost-of-sales', productId: 'P1',
      debitAccount: 'Cost of Sales', creditAccount: 'Inventory:finished-goods', amount: 1,
      documentType: 'adjustment', adjustmentOfDocumentId: 'stage-cogs:1:P1:CC-1:SALE-001' }],
  [0, 1, 2],
)
assert.equal(priorSalesCorrection.valid, false)
assert.ok(priorSalesCorrection.issues.some(issue => issue.includes('weighted-average inventory')))

const transferPeriods = [
  { period: '1', salesQuantity: 80, netUnitPrice: 20, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 10, openingFinishedGoodsValue: 100, finishedGoodsClosingQuantity: 30,
    rawMaterialPurchasesQuantity: null, rawMaterialPurchasesValue: null, rawMaterialConsumptionQuantity: null,
    rawMaterialWasteQuantity: null, unitsStarted: null, unitsCompleted: null, closingWipQuantity: null,
    materialCompletionPercent: null, conversionCompletionPercent: null, conversionCost: null,
    openingRawMaterialQuantity: null, openingRawMaterialValue: null, openingWipQuantity: null,
    openingWipMaterialValue: null, openingWipConversionValue: null },
  { period: '2', salesQuantity: 90, netUnitPrice: 22, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 30, openingFinishedGoodsValue: 300, finishedGoodsClosingQuantity: 20,
    rawMaterialPurchasesQuantity: null, rawMaterialPurchasesValue: null, rawMaterialConsumptionQuantity: null,
    rawMaterialWasteQuantity: null, unitsStarted: null, unitsCompleted: null, closingWipQuantity: null,
    materialCompletionPercent: null, conversionCompletionPercent: null, conversionCost: null,
    openingRawMaterialQuantity: null, openingRawMaterialValue: null, openingWipQuantity: null,
    openingWipMaterialValue: null, openingWipConversionValue: null },
  { period: '3', salesQuantity: 80, netUnitPrice: 22, salesTaxPercent: 0, subsidyPercent: null, subsidyAmount: null,
    openingFinishedGoodsQuantity: 20, openingFinishedGoodsValue: 200, finishedGoodsClosingQuantity: 10,
    rawMaterialPurchasesQuantity: null, rawMaterialPurchasesValue: null, rawMaterialConsumptionQuantity: null,
    rawMaterialWasteQuantity: null, unitsStarted: null, unitsCompleted: null, closingWipQuantity: null,
    materialCompletionPercent: null, conversionCompletionPercent: null, conversionCost: null,
    openingRawMaterialQuantity: null, openingRawMaterialValue: null, openingWipQuantity: null,
    openingWipMaterialValue: null, openingWipConversionValue: null },
]
const transferSales = [{
  productId: 'P1', unitOfMeasure: 'ton', inventoryPolicy: 'manual',
  finishedGoodsDaysCoverage: null, productionStartPeriod: null, productionEndPeriod: null,
  periods: transferPeriods,
}]
const transferProductionCosts = [{
  id: 'base-cpp-P1', metadata: { description: 'Existing base CPP', currencyCode: 'USD',
    marketOrigin: null, escalationPercent: null, remarks: '', costCentreId: 'CC-A' },
  classification: 'direct', productId: 'P1', basis: 'per-unit-output',
  standardQuantity: 1, standardUnitPrice: 10, standardTotal: null, nominalCapacity: null,
  fixedPercent: 0, variablePercent: 100, adjustments: [],
}]
const transferBaseline = productScheduleModule.buildProductOperatingSchedule({
  sales: transferSales, productionCosts: transferProductionCosts, productionTransfers: [],
}, periods, 1, 'USD')
assert.equal(transferBaseline.valid, true, transferBaseline.issues.join('; '))
const transferRoundTrip = [
  { id: 'centre-A-to-B-period-1', period: 1, sourceProductId: 'P1', destinationProductId: 'P1',
    sourceCostCentreId: 'CC-A', destinationCostCentreId: 'CC-B', quantity: 10,
    sourceUnit: 'ton', destinationUnit: 'ton', conversionFactor: 1, costAmount: 100 },
  { id: 'centre-B-to-A-period-2', period: 2, sourceProductId: 'P1', destinationProductId: 'P1',
    sourceCostCentreId: 'CC-B', destinationCostCentreId: 'CC-A', quantity: 5,
    sourceUnit: 'ton', destinationUnit: 'ton', conversionFactor: 1, costAmount: 50 },
]
const transferSchedule = productScheduleModule.buildProductOperatingSchedule({
  sales: transferSales, productionCosts: transferProductionCosts, productionTransfers: transferRoundTrip,
}, periods, 1, 'USD')
assert.equal(transferSchedule.valid, true, transferSchedule.issues.join('; '))
assert.deepEqual(transferSchedule.rows.map(row => row.productionQuantity),
  transferBaseline.rows.map(row => row.productionQuantity),
  'A→B then B→A cost-centre movement must not manufacture additional product output')
assert.deepEqual(transferSchedule.rows.map(row => row.productionCost),
  transferBaseline.rows.map(row => row.productionCost),
  'Internal cost-centre transfers must not post CPP a second time')
assert.deepEqual(transferSchedule.periodCostOfSales, transferBaseline.periodCostOfSales,
  'Internal cost-centre transfers must not duplicate or suppress COGS')
assert.deepEqual(transferSchedule.rows.map(row => row.closingInventoryQuantity),
  transferBaseline.rows.map(row => row.closingInventoryQuantity),
  'Internal cost-centre transfers must not change consolidated finished-goods quantity')
assert.deepEqual(transferSchedule.rows.map(row => row.closingInventoryValue),
  transferBaseline.rows.map(row => row.closingInventoryValue),
  'Internal cost-centre transfers must not change consolidated finished-goods value')

const baselineCpp = integrationModule.bindCppCpsTraceLedgerToProductSchedule(
  transferBaseline, ledger, [0, 1, 2])
const roundTripCpp = integrationModule.bindCppCpsTraceLedgerToProductSchedule(
  transferSchedule, ledger, [0, 1, 2])
assert.equal(baselineCpp.valid, true, baselineCpp.issues.join('; '))
assert.equal(roundTripCpp.valid, true, roundTripCpp.issues.join('; '))
assert.deepEqual(roundTripCpp.incrementalCppByPeriod, baselineCpp.incrementalCppByPeriod)
for (const field of ['productionCost', 'costOfSales', 'closingInventoryQuantity', 'closingInventoryValue', 'wipInventoryValue']) {
  assert.deepEqual(roundTripCpp.schedule.rows.map(row => row[field]),
    baselineCpp.schedule.rows.map(row => row[field]),
    'Round-trip transfer must preserve product ' + field + ' after CPP/CPS posting')
}
assert.deepEqual(roundTripCpp.schedule.periodCostOfSales, baselineCpp.schedule.periodCostOfSales)
assert.deepEqual(roundTripCpp.schedule.periodWipInventoryValue, baselineCpp.schedule.periodWipInventoryValue)

const makeTransferFinance = product => {
  const raw = [...product.periodRawMaterialInventoryValue]
  const wipValues = [...product.periodWipInventoryValue]
  const fg = product.rows.map(row => row.closingInventoryValue)
  const wcBinding = integrationModule.bindFinishedGoodsInventoryToWorkingCapital(
    raw.map((value, index) => value + wipValues[index]), product, false)
  assert.equal(wcBinding.valid, true, wcBinding.issues.join('; '))
  const result = engine.calculateIntegratedPeriodicFinance({
    periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
    annualRevenue: [...product.periodRevenue], periodRevenue: [...product.periodRevenue],
    annualVariableCost: [...product.periodCostOfSales], periodVariableCost: [...product.periodCostOfSales],
    annualFixedCost: [0, 0, 0], annualDepreciation: [0, 0, 0],
    annualFixedInvestment: [0, 0, 0], annualPreOperatingCost: [0, 0, 0],
    annualMaintenanceCapex: [0, 0, 0], annualTaxRates: [0, 0, 0],
    annualEquityContributions: [0, 0, 0],
    workingCapitalByPeriod: wcBinding.closingWorkingCapitalByPeriod,
    rawMaterialsInventoryByPeriod: raw, workInProgressInventoryByPeriod: wipValues,
    finishedGoodsInventoryByPeriod: fg, openingWorkingCapital: wcBinding.closingWorkingCapitalByPeriod[0],
    openingCash: 0, loans: [], discountRatePercent: 10,
  })
  assert.equal(result.valid, true, result.warnings.join('; '))
  const statements = engine.buildPeriodicThreeFinancialStatements(result, {
    cash: 0, debt: 0, netFixedAssets: 0,
    netWorkingCapital: wcBinding.closingWorkingCapitalByPeriod[0],
    rawMaterialsInventory: raw[0], workInProgressInventory: wipValues[0],
    finishedGoodsInventory: fg[0], paidInCapital: wcBinding.closingWorkingCapitalByPeriod[0],
    retainedEarnings: 0, grants: 0,
  })
  assert.equal(statements.length, 3)
  assert.ok(statements.every(row => row.balanceSheet.reconciled),
    'Round-trip scenario must retain three-statement balance-sheet reconciliation')
  return { result, statements, wcBinding }
}
const baselineFinancial = makeTransferFinance(baselineCpp.schedule)
const roundTripFinancial = makeTransferFinance(roundTripCpp.schedule)
assert.deepEqual(roundTripFinancial.wcBinding.closingWorkingCapitalByPeriod,
  baselineFinancial.wcBinding.closingWorkingCapitalByPeriod,
  'Internal transfers must not double-count finished goods in working capital')
assert.deepEqual(roundTripFinancial.result.rows, baselineFinancial.result.rows,
  'Internal transfers must not change periodic finance rows or cash-flow movements')
assert.deepEqual(roundTripFinancial.statements, baselineFinancial.statements,
  'Internal transfers must not change income statement, cash flow or balance sheet')
for (let i = 0; i < 3; i++) {
  close(roundTripFinancial.statements[i].incomeStatement.cashOperatingCosts,
    roundTripCpp.schedule.periodCostOfSales[i],
    'Integrated income statement costs must equal single-posted COGS in period ' + (i + 1))
  close(roundTripFinancial.statements[i].balanceSheet.finishedGoodsInventory,
    roundTripCpp.schedule.rows[i].closingInventoryValue,
    'Integrated balance sheet must carry product-led finished goods once in period ' + (i + 1))
}


const centreMovement = (period, costCentreId, openingQuantity, openingValue, closingQuantity, closingValue, consumptionQuantity = 0, consumptionValue = 0) => ({
  period, productId: 'P1', costCentreId, openingQuantity, openingValue,
  receiptsQuantity: 0, receiptsValue: 0, productionQuantity: 0, productionValue: 0,
  consumptionQuantity, consumptionValue, wasteQuantity: 0, wasteValue: 0, closingQuantity, closingValue,
})
const centreMovements = [
  centreMovement(1, 'CC-A', 100, 1000, 90, 900),
  centreMovement(1, 'CC-B', 0, 0, 10, 100),
  centreMovement(2, 'CC-A', 90, 900, 95, 950),
  centreMovement(2, 'CC-B', 10, 100, 5, 50),
  centreMovement(3, 'CC-A', 95, 950, 95, 950),
  centreMovement(3, 'CC-B', 5, 50, 3, 30, 2, 20),
]
const centreTransferLedger = inventoryControlModule.reconcileCostCentreInventory(
  centreMovements, transferRoundTrip, 3)
assert.equal(centreTransferLedger.valid, true, centreTransferLedger.issues.join('; '))
const centreQuantityByPeriod = [1, 2, 3].map(period => centreTransferLedger.rows
  .filter(row => row.period === period).reduce((sum, row) => sum + row.expectedClosingQuantity, 0))
const centreValueByPeriod = [1, 2, 3].map(period => centreTransferLedger.rows
  .filter(row => row.period === period).reduce((sum, row) => sum + row.expectedClosingValue, 0))
assert.deepEqual(centreQuantityByPeriod, [100, 100, 98],
  'A→B then partial B→A must conserve centre-group quantity until the separately evidenced period-three issue')
assert.deepEqual(centreValueByPeriod, [1000, 1000, 980],
  'A→B then partial B→A must conserve centre-group value until the separately evidenced period-three issue')
assert.deepEqual([1, 2, 3].map(period => centreTransferLedger.rows
  .filter(row => row.period === period).reduce((sum, row) => sum + row.transferNetQuantity, 0)), [0, 0, 0])
assert.deepEqual([1, 2, 3].map(period => centreTransferLedger.rows
  .filter(row => row.period === period).reduce((sum, row) => sum + row.transferNetValue, 0)), [0, 0, 0])

const threeWayFromCostCentres = inventoryControlModule.reconcileInventoryThreeWay(
  centreValueByPeriod.map((finishedGoods, index) => {
    const model = { rawMaterials: 0, workInProgress: 0, finishedGoods,
      otherCurrentAssets: 0, currentLiabilities: 0, netWorkingCapital: finishedGoods }
    return { period: index + 1, model, balanceSheet: { ...model },
      cppCps: { rawMaterials: 0, workInProgress: 0, finishedGoods, totalInventory: finishedGoods } }
  }))
assert.equal(threeWayFromCostCentres.valid, true, threeWayFromCostCentres.issues.join('; '))
assert.deepEqual(threeWayFromCostCentres.rows.map(row => row.inventoryCppCps), [1000, 1000, 980])
assert.deepEqual(threeWayFromCostCentres.rows.map(row => row.netWorkingCapitalModel), [1000, 1000, 980],
  'The centre-group inventory must enter CPP/CPS and WC once, after consolidating cost-centre balances')

const incompleteReturnMovements = centreMovements.map(row =>
  row.period === 2 && row.costCentreId === 'CC-A'
    ? { ...row, closingQuantity: 90, closingValue: 900 } : row)
const incompleteReturn = inventoryControlModule.reconcileCostCentreInventory(
  incompleteReturnMovements, transferRoundTrip, 3)
assert.equal(incompleteReturn.valid, false,
  'A B→A return missing from destination closing stock must fail reconciliation')
assert.ok(incompleteReturn.issues.some(issue => issue.includes('closing quantity does not reconcile')))

const doubleCountedCentreMovements = centreMovements.map(row =>
  row.period === 1 && row.costCentreId === 'CC-B'
    ? { ...row, receiptsQuantity: 10, receiptsValue: 100 } : row)
const doubleCountedCentre = inventoryControlModule.reconcileCostCentreInventory(
  doubleCountedCentreMovements, transferRoundTrip, 3)
assert.equal(doubleCountedCentre.valid, false,
  'Posting the transfer again as a receipt must be rejected as duplicated stock')

const doubleCountedThreeWay = inventoryControlModule.reconcileInventoryThreeWay(
  centreValueByPeriod.map((finishedGoods, index) => {
    const doubled = finishedGoods + (index === 0 ? 100 : 0)
    const model = { rawMaterials: 0, workInProgress: 0, finishedGoods: doubled,
      otherCurrentAssets: 0, currentLiabilities: 0, netWorkingCapital: doubled }
    return { period: index + 1, model, balanceSheet: { ...model },
      cppCps: { rawMaterials: 0, workInProgress: 0, finishedGoods: doubled,
        totalInventory: doubled + (index === 0 ? 100 : 0) } }
  }))
assert.equal(doubleCountedThreeWay.valid, false,
  'Adding the same transfer value to consolidated CPP/CPS inventory a second time must fail three-way reconciliation')


const stageMovement = (period, inventoryStage, costCentreId, openingQuantity, openingValue,
  receiptsQuantity, receiptsValue, transfersInQuantity, transfersInValue,
  transfersOutQuantity, transfersOutValue, productionQuantity, productionValue,
  consumptionQuantity, consumptionValue, salesQuantity, salesCostValue,
  closingQuantity, closingValue) => ({
    period, inventoryStage, productId: 'P1', costCentreId,
    openingQuantity, openingValue, receiptsQuantity, receiptsValue,
    transfersInQuantity, transfersInValue, transfersOutQuantity, transfersOutValue,
    productionQuantity, productionValue, consumptionQuantity, consumptionValue,
    salesQuantity, salesCostValue, wasteQuantity: 0, wasteValue: 0,
    closingQuantity, closingValue, sourceReference: 'verified-test-fixture-period-' + period,
    sourceVerified: true,
  })

// Build the cost-centre subledger from the SAME CPP/CPS-adjusted product schedule.
// The A/B split follows the registered 10-unit/100-value and 5-unit/50-value
// internal transfers; sales and production remain posted once at centre A.
const linkedStageMovements = []
let rawOpening = 0, wipOpening = 0
let centreAQty = roundTripCpp.schedule.rows[0].openingInventoryQuantity
let centreAValue = roundTripCpp.schedule.rows[0].openingInventoryValue
let centreBQty = 0, centreBValue = 0
for (const row of roundTripCpp.schedule.rows) {
  const period = row.period
  const rawClosing = row.rawMaterialInventoryValue
  const rawDelta = rawClosing - rawOpening
  linkedStageMovements.push(stageMovement(period, 'raw-materials', 'CC-RAW',
    0, rawOpening, 0, Math.max(0, rawDelta), 0, 0, 0, 0, 0, 0,
    0, Math.max(0, -rawDelta), 0, 0, 0, rawClosing))
  rawOpening = rawClosing

  const wipClosing = row.wipInventoryValue
  const wipDelta = wipClosing - wipOpening
  linkedStageMovements.push(stageMovement(period, 'work-in-progress', 'CC-WIP',
    0, wipOpening, 0, Math.max(0, wipDelta), 0, 0, 0, 0, 0, 0,
    0, Math.max(0, -wipDelta), 0, 0, 0, wipClosing))
  wipOpening = wipClosing

  const aTransferInQty = period === 2 ? 5 : 0
  const aTransferInValue = period === 2 ? 50 : 0
  const aTransferOutQty = period === 1 ? 10 : 0
  const aTransferOutValue = period === 1 ? 100 : 0
  const bTransferInQty = period === 1 ? 10 : 0
  const bTransferInValue = period === 1 ? 100 : 0
  const bTransferOutQty = period === 2 ? 5 : 0
  const bTransferOutValue = period === 2 ? 50 : 0
  const nextBQty = centreBQty - bTransferOutQty + bTransferInQty
  const nextBValue = centreBValue - bTransferOutValue + bTransferInValue
  const nextAQty = row.closingInventoryQuantity - nextBQty
  const nextAValue = row.closingInventoryValue - nextBValue

  linkedStageMovements.push(stageMovement(period, 'finished-goods', 'CC-A',
    centreAQty, centreAValue, 0, 0, aTransferInQty, aTransferInValue,
    aTransferOutQty, aTransferOutValue, row.productionQuantity, row.productionCost,
    0, 0, row.salesQuantity, row.costOfSales, nextAQty, nextAValue))
  linkedStageMovements.push(stageMovement(period, 'finished-goods', 'CC-B',
    centreBQty, centreBValue, 0, 0, bTransferInQty, bTransferInValue,
    bTransferOutQty, bTransferOutValue, 0, 0, 0, 0, 0, 0, nextBQty, nextBValue))
  centreAQty = nextAQty
  centreAValue = nextAValue
  centreBQty = nextBQty
  centreBValue = nextBValue
}

const linkedExpectedByPeriod = roundTripCpp.schedule.rows.map(row => ({
  period: row.period,
  rawMaterials: row.rawMaterialInventoryValue,
  workInProgress: row.wipInventoryValue,
  finishedGoods: row.closingInventoryValue,
}))
const linkedExpectedByProductPeriod = roundTripCpp.schedule.rows.map(row => ({
  period: row.period, productId: row.productId,
  rawMaterials: row.rawMaterialInventoryValue,
  workInProgress: row.wipInventoryValue,
  finishedGoods: row.closingInventoryValue,
  finishedGoodsSalesQuantity: row.salesQuantity,
  finishedGoodsCostOfSales: row.costOfSales,
  productionQuantity: row.productionQuantity,
  productionCost: row.productionCost,
}))
const linkedStageCheck = inventoryControlModule.reconcileStageInventoryMovements(
  linkedStageMovements, linkedExpectedByPeriod, 3, 0.01, [], linkedExpectedByProductPeriod)
assert.equal(linkedStageCheck.valid, true, linkedStageCheck.issues.join('; '))
const linkedAccountingPostings = linkedStageCheck.accountingPostings ?? []
assert.equal(new Set(linkedAccountingPostings.map(row => row.id)).size, linkedAccountingPostings.length,
  'Accounting posting preview IDs must be deterministic and unique')
assert.ok(Math.abs((linkedStageCheck.accountingDebitTotal ?? NaN) -
  (linkedStageCheck.accountingCreditTotal ?? NaN)) < 1e-7,
  'The stage accounting posting preview must balance debits and credits')
const linkedCogsPostings = linkedAccountingPostings.filter(row => row.kind === 'cost-of-sales')
close(linkedCogsPostings.reduce((sum, row) => sum + row.amount, 0),
  roundTripCpp.schedule.rows.reduce((sum, row) => sum + row.costOfSales, 0),
  'Finished-goods COGS posting preview must reconcile to the existing product schedule exactly once')

const rawToWipPostingPreview = inventoryControlModule.reconcileStageInventoryMovements([
  { period: 1, inventoryStage: 'raw-materials', productId: 'ORE', costCentreId: 'MINE',
    openingQuantity: 100, openingValue: 100, receiptsQuantity: 0, receiptsValue: 0,
    transfersInQuantity: 0, transfersInValue: 0, transfersOutQuantity: 0, transfersOutValue: 0,
    productionQuantity: 0, productionValue: 0, consumptionQuantity: 0, consumptionValue: 0,
    salesQuantity: 0, salesCostValue: 0, wasteQuantity: 0, wasteValue: 0,
    closingQuantity: 90, closingValue: 90, sourceReference: 'SRC-RAW-1', sourceVerified: true },
  { period: 1, inventoryStage: 'work-in-progress', productId: 'ORE-WIP', costCentreId: 'DRI',
    openingQuantity: 0, openingValue: 0, receiptsQuantity: 0, receiptsValue: 0,
    transfersInQuantity: 0, transfersInValue: 0, transfersOutQuantity: 0, transfersOutValue: 0,
    productionQuantity: 0, productionValue: 0, consumptionQuantity: 0, consumptionValue: 0,
    salesQuantity: 0, salesCostValue: 0, wasteQuantity: 0, wasteValue: 0,
    closingQuantity: 10, closingValue: 10, sourceReference: 'SRC-WIP-1', sourceVerified: true },
], [{ period: 1, rawMaterials: 90, workInProgress: 10, finishedGoods: 0 }], 1, 0.01, [{
  id: 'RAW-TO-WIP-1', period: 1, sourceStage: 'raw-materials', destinationStage: 'work-in-progress',
  sourceProductId: 'ORE', destinationProductId: 'ORE-WIP', sourceCostCentreId: 'MINE',
  destinationCostCentreId: 'DRI', quantity: 10, sourceUnit: 'ton', destinationUnit: 'ton',
  conversionFactor: 1, transferValue: 10, sourceReference: 'SRC-TRANSFER-1', sourceVerified: true,
}])
assert.equal(rawToWipPostingPreview.valid, true, rawToWipPostingPreview.issues.join('; '))
assert.deepEqual(rawToWipPostingPreview.accountingPostings?.map(row => [
  row.kind, row.debitAccount, row.creditAccount, row.amount,
]), [['stage-transfer', 'Inventory:work-in-progress', 'Inventory:raw-materials', 10]],
'Raw-material-to-WIP transfer must reclassify the same value between inventory accounts')
assert.equal(rawToWipPostingPreview.accountingDebitTotal, 10)
assert.equal(rawToWipPostingPreview.accountingCreditTotal, 10)


const linkedCostCentreMovements = linkedStageMovements
  .filter(row => row.inventoryStage === 'finished-goods')
  .map(row => ({
    period: row.period, productId: row.productId, costCentreId: row.costCentreId,
    openingQuantity: row.openingQuantity, openingValue: row.openingValue,
    receiptsQuantity: row.receiptsQuantity, receiptsValue: row.receiptsValue,
    productionQuantity: row.productionQuantity, productionValue: row.productionValue,
    consumptionQuantity: row.consumptionQuantity + row.salesQuantity,
    consumptionValue: row.consumptionValue + row.salesCostValue,
    wasteQuantity: row.wasteQuantity, wasteValue: row.wasteValue,
    closingQuantity: row.closingQuantity, closingValue: row.closingValue,
  }))
const linkedCentreRegisterCheck = inventoryControlModule.reconcileCostCentreInventory(
  linkedCostCentreMovements, transferRoundTrip, 3)
assert.equal(linkedCentreRegisterCheck.valid, true, linkedCentreRegisterCheck.issues.join('; '))
for (let index = 0; index < 3; index++) {
  const periodRows = linkedCentreRegisterCheck.rows.filter(row => row.period === index + 1)
  close(periodRows.reduce((sum, row) => sum + row.expectedClosingQuantity, 0),
    roundTripCpp.schedule.rows[index].closingInventoryQuantity,
    'The exact A→B/B→A register and cost-centre subledger must reconcile to product closing quantity in period ' + (index + 1))
  close(periodRows.reduce((sum, row) => sum + row.expectedClosingValue, 0),
    roundTripCpp.schedule.rows[index].closingInventoryValue,
    'The exact A→B/B→A register and cost-centre subledger must reconcile to CPP/CPS-adjusted product closing value in period ' + (index + 1))
}

assert.deepEqual(linkedStageCheck.rows.filter(row => row.inventoryStage === 'finished-goods')
  .map(row => [row.period, row.ledgerClosingValue, row.engineClosingValue, row.variance]),
  linkedExpectedByPeriod.map(row => [row.period, row.finishedGoods, row.finishedGoods, 0]),
  'Cost-centre finished-goods closing values must equal the CPP/CPS-adjusted product schedule in every period')
assert.deepEqual(linkedStageCheck.rows.filter(row => row.inventoryStage === 'raw-materials')
  .map(row => row.variance), [0, 0, 0])
assert.deepEqual(linkedStageCheck.rows.filter(row => row.inventoryStage === 'work-in-progress')
  .map(row => row.variance), [0, 0, 0])

const incompleteLinkedReturn = linkedStageMovements.map(row =>
  row.period === 2 && row.inventoryStage === 'finished-goods' && row.costCentreId === 'CC-A'
    ? { ...row, closingQuantity: row.closingQuantity - 5, closingValue: row.closingValue - 50 } : row)
const incompleteLinkedReturnCheck = inventoryControlModule.reconcileStageInventoryMovements(
  incompleteLinkedReturn, linkedExpectedByPeriod, 3, 0.01, [], linkedExpectedByProductPeriod)
assert.equal(incompleteLinkedReturnCheck.valid, false,
  'The shared product/centre ledger must reject an incomplete B→A return at the destination centre')

const duplicatedLinkedTransfer = linkedStageMovements.map(row =>
  row.period === 1 && row.inventoryStage === 'finished-goods' && row.costCentreId === 'CC-B'
    ? { ...row, receiptsQuantity: 10, receiptsValue: 100 } : row)
const duplicatedLinkedTransferCheck = inventoryControlModule.reconcileStageInventoryMovements(
  duplicatedLinkedTransfer, linkedExpectedByPeriod, 3, 0.01, [], linkedExpectedByProductPeriod)
assert.equal(duplicatedLinkedTransferCheck.valid, false,
  'The shared product/centre ledger must reject posting A→B transfer again as an external receipt')


const abnormalWasteInput = {
  periods, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [1000, 1000, 1000], annualVariableCost: [100, 100, 100],
  annualFixedCost: [50, 50, 50], periodAbnormalWasteExpense: [10, 20, 30],
  annualDepreciation: [0, 0, 0], annualFixedInvestment: [0, 0, 0],
  annualPreOperatingCost: [0, 0, 0], annualMaintenanceCapex: [0, 0, 0],
  annualTaxRates: [0, 0, 0], annualEquityContributions: [0, 0, 0],
  workingCapitalByPeriod: [0, 0, 0], openingCash: 0, loans: [],
  discountRatePercent: 10,
}
const abnormalWasteResult = engine.calculateIntegratedPeriodicFinance(abnormalWasteInput)
assert.equal(abnormalWasteResult.valid, true, abnormalWasteResult.warnings.join('; '))
assert.deepEqual(abnormalWasteResult.rows.map(row => row.fixedCost), [50, 50, 50],
  'Abnormal waste must never be classified as fixed cost without cost-behaviour evidence')
assert.deepEqual(abnormalWasteResult.rows.map(row => row.abnormalWasteExpense), [10, 20, 30],
  'Abnormal waste must remain separately visible by period')
assert.deepEqual(abnormalWasteResult.rows.map(row => row.ebit), [840, 830, 820],
  'Abnormal waste must reduce EBIT exactly once')
assert.deepEqual(abnormalWasteResult.rows.map(row => row.cfads), [840, 830, 820],
  'Abnormal waste must reduce CFADS exactly once')
assert.deepEqual(abnormalWasteResult.rows.map(row => row.projectFreeCashFlow), [840, 830, 820],
  'Abnormal waste must reduce project free cash flow exactly once')
assert.deepEqual(abnormalWasteResult.rows.map(row => row.closingCash), [840, 1670, 2490],
  'Abnormal waste must reduce period cash balances without being capitalized into inventory')
const abnormalWasteStatements = engine.buildPeriodicThreeFinancialStatements(abnormalWasteResult, {
  cash: 0, debt: 0, netFixedAssets: 0, netWorkingCapital: 0,
  paidInCapital: 0, retainedEarnings: 0, grants: 0,
})
assert.equal(abnormalWasteStatements.length, 3)
assert.deepEqual(abnormalWasteStatements.map(row => row.incomeStatement.abnormalWasteExpense), [10, 20, 30],
  'The linked income statement must disclose abnormal waste separately in each period')
assert.deepEqual(abnormalWasteStatements.map(row => row.incomeStatement.cashOperatingCosts), [160, 170, 180],
  'Abnormal waste must be included once in total cash operating costs')
assert.deepEqual(abnormalWasteStatements.map(row => row.incomeStatement.ebit), [840, 830, 820],
  'The linked income statement EBIT must reconcile to periodic-engine EBIT after abnormal waste')
assert.deepEqual(abnormalWasteStatements.map(row => row.cashFlowStatement.operatingCashFlow), [840, 830, 820],
  'Operating cash flow must include the separately expensed abnormal waste exactly once')
assert.ok(abnormalWasteStatements.every(row => row.balanceSheet.reconciled),
  'Separately expensed abnormal waste must preserve three-statement balance-sheet reconciliation')
const abnormalWasteScenarios = engine.calculatePeriodicFinancialScenarios(abnormalWasteInput)
assert.deepEqual(abnormalWasteScenarios.pessimistic.rows.map(row => row.abnormalWasteExpense), [10, 20, 30],
  'Pessimistic scenarios must retain unclassified abnormal waste without scaling it into variable cost')
assert.deepEqual(abnormalWasteScenarios.optimistic.rows.map(row => row.abnormalWasteExpense), [10, 20, 30],
  'Optimistic scenarios must retain unclassified abnormal waste without scaling it into fixed cost')
const abnormalWasteSensitivity = engine.calculatePeriodicSensitivityMatrix(abnormalWasteInput, [0, 10], [0, 10])
assert.equal(abnormalWasteSensitivity[0][0].npv, abnormalWasteResult.npvProject,
  'The zero-change sensitivity cell must equal the validated base case including abnormal waste')
const invalidAbnormalWaste = engine.calculateIntegratedPeriodicFinance({
  ...abnormalWasteInput, periodAbnormalWasteExpense: [10, -1, 30],
})
assert.equal(invalidAbnormalWaste.valid, false,
  'Negative abnormal-waste expense must be rejected rather than silently accepted')
const missingAbnormalWastePeriod = engine.calculateIntegratedPeriodicFinance({
  ...abnormalWasteInput, periodAbnormalWasteExpense: [10, 20],
})
assert.equal(missingAbnormalWastePeriod.valid, false,
  'Abnormal-waste schedule must cover every project period')

console.log('PASS: FS-00 three-period product + A→B/B→A transfer round-trip → CPP/CPS → COGS/WIP/FG → working capital → income statement/cash flow/balance sheet integration.')
