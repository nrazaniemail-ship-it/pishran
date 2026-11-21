import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const ledgerSource = await readFile(new URL('../src/features/projects/cppCpsCostTraceability.ts', import.meta.url), 'utf8')
const ledgerModule = await import('data:text/javascript;base64,' + Buffer.from(transpile(ledgerSource)).toString('base64'))
const integrationSource = await readFile(new URL('../src/features/projects/cppCpsScheduleIntegration.ts', import.meta.url), 'utf8')
const integrationModule = await import('data:text/javascript;base64,' + Buffer.from(transpile(integrationSource)).toString('base64'))

const schedule = {
  valid: true, issues: [], periodRevenue: [1600, 1980], periodCostOfSales: [800, 900],
  periodSubsidyIncome: [0, 0], annualRevenue: [3580], annualCostOfSales: [1700],
  totalProductionQuantity: 180, totalSalesQuantity: 170, totalClosingInventoryValue: 500,
  rows: [
    { productId: 'P1', period: 1, openingInventoryQuantity: 10, openingInventoryValue: 100,
      salesQuantity: 80, productionQuantity: 100, closingInventoryQuantity: 30,
      closingInventoryValue: 300, unitProductionCost: 10, productionCost: 1000,
      weightedAverageUnitCost: 10, costOfSales: 800, netSalesRevenue: 1600,
      subsidyIncome: 0, grossProfit: 800, hasInventoryFlow: false, wipQuantity: 0, materialEquivalentUnits: 0, conversionEquivalentUnits: 0, materialCompletionPercent: 0, conversionCompletionPercent: 0 },
    { productId: 'P1', period: 2, openingInventoryQuantity: 30, openingInventoryValue: 300,
      salesQuantity: 90, productionQuantity: 80, closingInventoryQuantity: 20,
      closingInventoryValue: 200, unitProductionCost: 10, productionCost: 800,
      weightedAverageUnitCost: 10, costOfSales: 900, netSalesRevenue: 1980,
      subsidyIncome: 0, grossProfit: 1080, hasInventoryFlow: false, wipQuantity: 0, materialEquivalentUnits: 0, conversionEquivalentUnits: 0, materialCompletionPercent: 0, conversionCompletionPercent: 0 },
  ],
}
const verifiedItem = {
  id: 'energy-01', label: 'Incremental energy', category: 'energy',
  basis: 'period-total', behaviour: 'variable', fixedPercent: 0, variablePercent: 100,
  productId: 'P1', allocationMethod: 'direct-product', baseCostCoverage: 'excluded',
  periodAmounts: [200, 100], baseCoveredAmounts: [0, 0],
  source: { status: 'verified', reference: 'energy-invoices-2025',
    description: 'Supplier invoices', reliability: 'primary-document' },
}
const ledger = ledgerModule.buildCppCpsTraceLedger([verifiedItem], 2)
assert.equal(ledger.readyForCppPosting, true, ledger.issues.join('; '))
const bound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(schedule, ledger, [0, 0])
assert.equal(bound.valid, true, bound.issues.join('; '))
assert.deepEqual(bound.incrementalCppByPeriod, [200, 100])
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8,
  'Expected ' + expected + ', received ' + actual)
const [p1, p2] = bound.schedule.rows
close(p1.productionCost, 1200)
close(p1.unitProductionCost, 12)
close(p1.weightedAverageUnitCost, 1300 / 110)
close(p1.costOfSales, 80 * 1300 / 110)
close(p1.closingInventoryValue, 30 * 1300 / 110)
close(p1.grossProfit, 1600 - 80 * 1300 / 110)
close(p2.openingInventoryValue, p1.closingInventoryValue)
close(p2.productionCost, 900)
close(p2.weightedAverageUnitCost, (30 * 1300 / 110 + 900) / 110)
close(p2.costOfSales, 90 * (30 * 1300 / 110 + 900) / 110)
close(p2.closingInventoryValue, 20 * (30 * 1300 / 110 + 900) / 110)
close(bound.schedule.periodCostOfSales[0], p1.costOfSales)
close(bound.schedule.annualCostOfSales[0], p1.costOfSales + p2.costOfSales)
close(bound.schedule.totalClosingInventoryValue, p1.closingInventoryValue + p2.closingInventoryValue)

// The uncovered cost enters CPP once; fully covered cost produces zero incremental CPP.
const coveredLedger = ledgerModule.buildCppCpsTraceLedger([{
  ...verifiedItem, baseCostCoverage: 'fully-included',
  periodAmounts: [200, 100], baseCoveredAmounts: [200, 100],
}], 2)
const coveredBound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(schedule, coveredLedger, [0, 0])
assert.equal(coveredBound.valid, true)
assert.deepEqual(coveredBound.incrementalCppByPeriod, [0, 0])
assert.deepEqual(coveredBound.schedule.periodCostOfSales, schedule.periodCostOfSales)

// CRC200 without evidence is explicitly null and blocks final posting, not treated as zero.
const unverifiedLedger = ledgerModule.buildCppCpsTraceLedger([{
  ...verifiedItem, id: 'crc200-overhead', category: 'overhead',
  baseCostCoverage: 'unverified', periodAmounts: [null, null],
  baseCoveredAmounts: [null, null],
  source: { status: 'unverified', reference: '', description: 'No source supplied',
    reliability: 'unverified' },
}], 2)
assert.equal(unverifiedLedger.valid, true)
assert.equal(unverifiedLedger.complete, false)
assert.equal(unverifiedLedger.rows[0].grossCost, null)
const blocked = integrationModule.bindCppCpsTraceLedgerToProductSchedule(schedule, unverifiedLedger, [0, 0])
assert.equal(blocked.valid, false)
assert.equal(blocked.schedule, null)

const noDriverLedger = ledgerModule.buildCppCpsTraceLedger([{
  ...verifiedItem, allocationMethod: 'production-quantity', productId: null,
}], 2)
const noDriverSchedule = { ...schedule, rows: schedule.rows.map(row => ({ ...row, productionQuantity: 0 })) }
const noDriver = integrationModule.bindCppCpsTraceLedgerToProductSchedule(noDriverSchedule, noDriverLedger, [0, 0])
assert.equal(noDriver.valid, false)
assert.ok(noDriver.issues.some(issue => issue.includes('driver totals zero')))

// Finished-goods stock enters net working capital exactly once and terminal stock is retained.
const wcWithoutManualFg = integrationModule.bindFinishedGoodsInventoryToWorkingCapital([0, 0], bound.schedule, false)
assert.equal(wcWithoutManualFg.valid, true)
close(wcWithoutManualFg.closingWorkingCapitalByPeriod[0], p1.closingInventoryValue)
close(wcWithoutManualFg.closingWorkingCapitalByPeriod[1], p2.closingInventoryValue)
const wcWithManualFg = integrationModule.bindFinishedGoodsInventoryToWorkingCapital([25, 15], bound.schedule, true)
assert.equal(wcWithManualFg.valid, true)
assert.deepEqual(wcWithManualFg.closingWorkingCapitalByPeriod, [25, 15],
  'Explicit finished-goods working capital must not be double counted')

// Guard the actual UI-to-engine wiring, not just the standalone calculation helpers.
const advancedPanel = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const financialForms = await readFile(new URL('../src/features/projects/ProjectModelFinancialFormsPanel.tsx', import.meta.url), 'utf8')
const wizard = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(advancedPanel.includes('buildCppCpsTraceLedger(props.cppCpsTraceItems'))
assert.ok(advancedPanel.includes('bindCppCpsTraceLedgerToProductSchedule'))
assert.ok(advancedPanel.includes('bindFinishedGoodsInventoryToWorkingCapital'))
assert.ok(advancedPanel.includes('annualVariableCost:productOperatingSchedule?.valid?productOperatingSchedule.annualCostOfSales'))
assert.ok(financialForms.includes('Source reference'))
assert.ok(financialForms.includes('baseCoveredAmounts'))
assert.ok(wizard.includes('cppCpsTraceItems={m.financialForms.cppCpsTraceItems??[]}'))
assert.ok(wizard.includes("onClick={()=>setStep('profile')}"))
console.log('CPP/CPS finance integration, working-capital reconciliation, source gating and report actions passed.')
