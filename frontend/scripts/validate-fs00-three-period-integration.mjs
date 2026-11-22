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
const [ledgerModule, integrationModule, productScheduleModule, engine] = await Promise.all([
  load('../src/features/projects/cppCpsCostTraceability.ts'),
  load('../src/features/projects/cppCpsScheduleIntegration.ts'),
  loadProductSchedule(),
  load('../src/features/steel/periodicFinancialEngine.ts'),
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

console.log('PASS: FS-00 three-period product + A→B/B→A transfer round-trip → CPP/CPS → COGS/WIP/FG → working capital → income statement/cash flow/balance sheet integration.')
