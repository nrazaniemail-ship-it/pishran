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
let centreAQty = 0, centreAValue = 0, centreBQty = 0, centreBValue = 0
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

console.log('PASS: FS-00 three-period product + A→B/B→A transfer round-trip → CPP/CPS → COGS/WIP/FG → working capital → income statement/cash flow/balance sheet integration.')
