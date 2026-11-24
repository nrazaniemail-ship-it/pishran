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
  periodSubsidyIncome: [0, 0], periodAbnormalWasteExpense: [110, 0],
  annualRevenue: [3580], annualCostOfSales: [1700],
  totalProductionQuantity: 180, totalSalesQuantity: 170, totalClosingInventoryValue: 500,
  rows: [
    { productId: 'P1', period: 1, openingInventoryQuantity: 10, openingInventoryValue: 100,
      salesQuantity: 80, productionQuantity: 100, closingInventoryQuantity: 30,
      closingInventoryValue: 300, unitProductionCost: 10, productionCost: 1000,
      weightedAverageUnitCost: 10, costOfSales: 800, netSalesRevenue: 1600,
      subsidyIncome: 0, grossProfit: 800, abnormalWasteValue: 110, hasInventoryFlow: false, wipQuantity: 0, materialEquivalentUnits: 0, conversionEquivalentUnits: 0, materialCompletionPercent: 0, conversionCompletionPercent: 0 },
    { productId: 'P1', period: 2, openingInventoryQuantity: 30, openingInventoryValue: 300,
      salesQuantity: 90, productionQuantity: 80, closingInventoryQuantity: 20,
      closingInventoryValue: 200, unitProductionCost: 10, productionCost: 800,
      weightedAverageUnitCost: 10, costOfSales: 900, netSalesRevenue: 1980,
      subsidyIncome: 0, grossProfit: 1080, abnormalWasteValue: 0, hasInventoryFlow: false, wipQuantity: 0, materialEquivalentUnits: 0, conversionEquivalentUnits: 0, materialCompletionPercent: 0, conversionCompletionPercent: 0 },
  ],
}
const abnormalWasteBaseSchedule = {
  ...schedule,
  periodRawMaterialInventoryValue: [100, 100],
  periodWipInventoryValue: [0, 0],
  rows: schedule.rows.map(row => ({ ...row, rawMaterialInventoryValue: 100, wipInventoryValue: 0 })),
}
const abnormalWasteAdjustment = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  abnormalWasteBaseSchedule,
  [
    { id: 'AW-ORIGINAL', period: 1, kind: 'abnormal-waste', productId: 'P1',
      debitAccount: 'Abnormal Waste Expense', creditAccount: 'Inventory:raw-materials', amount: 110 },
    { id: 'AW-ADJ', period: 1, kind: 'abnormal-waste', productId: 'P1',
      debitAccount: 'Abnormal Waste Expense', creditAccount: 'Inventory:raw-materials', amount: 30,
      documentType: 'adjustment', adjustmentOfDocumentId: 'AW-ORIGINAL' },
  ],
  [0, 0],
)
assert.equal(abnormalWasteAdjustment.valid, true, abnormalWasteAdjustment.issues.join('; '))
assert.deepEqual(abnormalWasteAdjustment.appliedDocumentIds, ['AW-ADJ'])
assert.deepEqual(abnormalWasteAdjustment.schedule.periodRawMaterialInventoryValue, [70, 70],
  'An abnormal-waste adjustment must reduce raw inventory once and carry the corrected balance forward')
assert.equal(abnormalWasteAdjustment.schedule.rows[0].rawMaterialInventoryValue, 70)
assert.equal(abnormalWasteAdjustment.schedule.rows[1].rawMaterialInventoryValue, 70)
assert.deepEqual(abnormalWasteAdjustment.schedule.periodCostOfSales, schedule.periodCostOfSales,
  'Abnormal waste must not be reclassified as COGS')
assert.deepEqual(abnormalWasteAdjustment.schedule.periodAbnormalWasteExpense,[140,0],
  'An incremental abnormal-waste adjustment must affect only its registered period.')

const abnormalWasteReversal = integrationModule.applyStageJournalCorrectionsToProductSchedule(
  abnormalWasteBaseSchedule,
  [
    { id: 'AW-ORIGINAL-REV', period: 1, kind: 'abnormal-waste', productId: 'P1',
      debitAccount: 'Abnormal Waste Expense', creditAccount: 'Inventory:raw-materials', amount: 110 },
    { id: 'AW-REV', period: 1, kind: 'abnormal-waste', productId: 'P1',
      debitAccount: 'Inventory:raw-materials', creditAccount: 'Abnormal Waste Expense', amount: 110,
      documentType: 'reversal', originalDocumentId: 'AW-ORIGINAL-REV' },
  ],
  [0, 0],
)
assert.equal(abnormalWasteReversal.valid, true, abnormalWasteReversal.issues.join('; '))
assert.deepEqual(abnormalWasteReversal.schedule.periodRawMaterialInventoryValue, [210, 210],
  'Reversing an abnormal-waste write-off must restore raw inventory without touching COGS')
assert.deepEqual(abnormalWasteReversal.schedule.periodCostOfSales, schedule.periodCostOfSales)
assert.deepEqual(abnormalWasteReversal.schedule.periodAbnormalWasteExpense,[0,0],
  'A same-period reversal must cancel the original abnormal-waste expense without changing COGS.')

const verifiedItem = {
  id: 'energy-01', label: 'Incremental energy', category: 'energy',
  basis: 'period-total', behaviour: 'variable', fixedPercent: 0, variablePercent: 100,
  productId: 'P1', costCentreId: 'CC-UTIL', allocationMethod: 'direct-product', baseCostCoverage: 'excluded',
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

// Incremental material and conversion CPP are split between completed output and WIP by equivalent units.
const wipSchedule = {
  ...schedule,
  periodRevenue: [1600], periodCostOfSales: [800], periodSubsidyIncome: [0],
  annualRevenue: [1600], annualCostOfSales: [800],
  periodRawMaterialInventoryValue: [500], periodWipInventoryValue: [200],
  rows: [{
    ...schedule.rows[0], period: 1, productionQuantity: 100, completedUnits: 100,
    hasInventoryFlow: true, wipQuantity: 20, materialEquivalentUnits: 110,
    conversionEquivalentUnits: 105, wipInventoryValue: 200,
  }],
};
const wipLedger = ledgerModule.buildCppCpsTraceLedger([
  { ...verifiedItem, id: 'materials-01', category: 'materials',
    periodAmounts: [200], baseCoveredAmounts: [0] },
  { ...verifiedItem, id: 'energy-01', category: 'energy',
    periodAmounts: [100], baseCoveredAmounts: [0] },
], 1);
const wipBound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(wipSchedule, wipLedger, [0]);
assert.equal(wipBound.valid, true, wipBound.issues.join('; '));
const wipRow = wipBound.schedule.rows[0];
assert.equal(wipBound.tracePathRows.length, 2);
const materialWipPath = wipBound.tracePathRows.find(row => row.itemId === 'materials-01');
const energyWipPath = wipBound.tracePathRows.find(row => row.itemId === 'energy-01');
assert.ok(materialWipPath && energyWipPath);
const completedMaterialCpp = 200 * 100 / 110;
const completedConversionCpp = 100 * 100 / 105;
close(materialWipPath.completedProductionCpp, completedMaterialCpp);
close(materialWipPath.closingWipCpp, 200 - completedMaterialCpp);
close(energyWipPath.completedProductionCpp, completedConversionCpp);
close(energyWipPath.closingWipCpp, 100 - completedConversionCpp);
const closingWipCpp = 200 * 10 / 110 + 100 * 5 / 105;
close(wipRow.productionCost, 1000 + completedMaterialCpp + completedConversionCpp);
close(wipRow.wipInventoryValue, 200 + closingWipCpp);
close(wipBound.schedule.periodWipInventoryValue[0], 200 + closingWipCpp);
close(wipBound.schedule.periodRawMaterialInventoryValue[0], 500,
  'CPP/CPS material consumption must not post raw-material purchases or alter the raw-material stock ledger');
close((wipRow.productionCost - 1000) + (wipRow.wipInventoryValue - 200), 300,
  'Incremental CPP must reconcile between completed production and closing WIP');

// Two-period material CPP must roll through WIP and finished goods without posting raw-material stock twice.
const twoPeriodMaterialSchedule = {
  ...schedule,
  periodRawMaterialInventoryValue: [500, 400],
  periodWipInventoryValue: [200, 250],
  rows: [
    { ...schedule.rows[0], period: 1, openingInventoryQuantity: 10, openingInventoryValue: 100,
      salesQuantity: 80, productionQuantity: 100, closingInventoryQuantity: 30,
      productionCost: 1000, unitProductionCost: 10, weightedAverageUnitCost: 10,
      costOfSales: 800, netSalesRevenue: 1600, completedUnits: 100,
      hasInventoryFlow: true, wipQuantity: 10, materialEquivalentUnits: 110,
      conversionEquivalentUnits: 0, wipInventoryValue: 200 },
    { ...schedule.rows[1], period: 2, openingInventoryQuantity: 30, openingInventoryValue: 300,
      salesQuantity: 90, productionQuantity: 80, closingInventoryQuantity: 20,
      productionCost: 800, unitProductionCost: 10, weightedAverageUnitCost: 10,
      costOfSales: 900, netSalesRevenue: 1980, completedUnits: 80,
      hasInventoryFlow: true, wipQuantity: 5, materialEquivalentUnits: 85,
      conversionEquivalentUnits: 0, wipInventoryValue: 250 },
  ],
};
const twoPeriodMaterialLedger = ledgerModule.buildCppCpsTraceLedger([{
  ...verifiedItem, id: 'materials-two-period', category: 'materials',
  costCentreId: 'CC-MAT', periodAmounts: [200, 100], baseCoveredAmounts: [0, 0],
}], 2);
const twoPeriodMaterialBound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(
  twoPeriodMaterialSchedule, twoPeriodMaterialLedger, [0, 1]);
assert.equal(twoPeriodMaterialBound.valid, true, twoPeriodMaterialBound.issues.join('; '));
const [materialP1, materialP2] = twoPeriodMaterialBound.schedule.rows;
close(materialP1.productionCost, 1000 + 200 * 100 / 110);
close(materialP1.wipInventoryValue, 200 + 200 * 10 / 110);
close(materialP2.openingInventoryValue, materialP1.closingInventoryValue,
  'Finished-goods opening value must carry forward from the prior period after CPP allocation');
const materialP2Pool = materialP1.closingWipCpp + 100;
close(materialP2.productionCost, 800 + materialP2Pool * 80 / 85);
close(materialP2.wipInventoryValue, 250 + materialP2Pool * 5 / 85);
close(twoPeriodMaterialBound.schedule.periodRawMaterialInventoryValue[0], 500);
close(twoPeriodMaterialBound.schedule.periodRawMaterialInventoryValue[1], 400);
const materialPathP1 = twoPeriodMaterialBound.tracePathRows.find(row => row.period === 1);
const materialPathP2 = twoPeriodMaterialBound.tracePathRows.find(row => row.period === 2);
assert.ok(materialPathP1 && materialPathP2);
close(materialPathP1.openingWipCarry, 0);
close(materialPathP1.completedProductionCpp + materialPathP1.closingWipCpp, 200);
close(materialPathP2.openingWipCarry, materialPathP1.closingWipCpp,
  'Prior-period material CPP held in WIP must carry into the next production period');
close(materialPathP2.openingWipCarry + materialPathP2.incrementalCpp,
  materialPathP2.completedProductionCpp + materialPathP2.closingWipCpp,
  'Opening WIP plus current material CPP must reconcile to completed output and closing WIP');
close(materialPathP2.workingCapitalImpact,
  materialPathP2.closingWipCpp + materialPathP2.closingFinishedGoodsCpp);
close(twoPeriodMaterialBound.schedule.periodWipInventoryValue[0], materialP1.wipInventoryValue);
close(twoPeriodMaterialBound.schedule.periodWipInventoryValue[1], materialP2.wipInventoryValue);
close(twoPeriodMaterialBound.schedule.periodCostOfSales[0], materialP1.costOfSales);
close(twoPeriodMaterialBound.schedule.periodCostOfSales[1], materialP2.costOfSales);
close(twoPeriodMaterialBound.schedule.annualCostOfSales[0], materialP1.costOfSales);
close(twoPeriodMaterialBound.schedule.annualCostOfSales[1], materialP2.costOfSales);
const twoPeriodMaterialWc = integrationModule.bindFinishedGoodsInventoryToWorkingCapital(
  [0, 0], twoPeriodMaterialBound.schedule, false);
assert.equal(twoPeriodMaterialWc.valid, true, twoPeriodMaterialWc.issues.join('; '));
close(twoPeriodMaterialWc.closingWorkingCapitalByPeriod[0], materialP1.closingInventoryValue);
close(twoPeriodMaterialWc.closingWorkingCapitalByPeriod[1], materialP2.closingInventoryValue);


// Shared service-centre cost is allocated using explicit product-period driver quantities.
const twoProductSchedule = {
  ...schedule,
  periodRevenue: [2400], periodCostOfSales: [1050], periodSubsidyIncome: [0],
  annualRevenue: [2400], annualCostOfSales: [1050],
  rows: [
    { ...schedule.rows[0], period: 1, productId: 'P1' },
    { ...schedule.rows[0], period: 1, productId: 'P2', openingInventoryQuantity: 0,
      openingInventoryValue: 0, salesQuantity: 50, productionQuantity: 100,
      closingInventoryQuantity: 50, closingInventoryValue: 250, unitProductionCost: 5,
      productionCost: 500, weightedAverageUnitCost: 5, costOfSales: 250,
      netSalesRevenue: 800, grossProfit: 550 },
  ],
};
const sharedCentreLedger = ledgerModule.buildCppCpsTraceLedger([{
  ...verifiedItem, id: 'shared-maintenance', category: 'maintenance',
  productId: null, costCentreId: 'CC-SVC', allocationMethod: 'cost-centre-driver',
  periodAmounts: [200], baseCoveredAmounts: [0],
}], 1);
const sharedCentre = {
  id: 'CC-SVC', name: 'Shared services', type: 'service', description: '',
  allocationBasis: 'manual', manualDriverName: 'Machine hours', manualDriverUnit: 'h',
  driverRows: [
    { period: 1, productId: 'P1', amount: 1 },
    { period: 1, productId: 'P2', amount: 3 },
  ],
};
const sharedBound = integrationModule.bindCppCpsTraceLedgerToProductSchedule(
  twoProductSchedule, sharedCentreLedger, [0], [sharedCentre]);
assert.equal(sharedBound.valid, true, sharedBound.issues.join('; '));
close(sharedBound.schedule.rows.find(row => row.productId === 'P1').productionCost, 1050);
close(sharedBound.schedule.rows.find(row => row.productId === 'P2').productionCost, 650);
close(sharedBound.incrementalCppByPeriod[0], 200);
const missingSharedDriver = integrationModule.bindCppCpsTraceLedgerToProductSchedule(
  twoProductSchedule, sharedCentreLedger, [0],
  [{ ...sharedCentre, driverRows: sharedCentre.driverRows.slice(0, 1) }]);
assert.equal(missingSharedDriver.valid, false);
assert.ok(missingSharedDriver.issues.some(issue => issue.includes('manual driver amount for every product')));

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
  ...verifiedItem, id: 'crc200-overhead', category: 'overhead', costCentreId: null,
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
const automaticFinishedGoodsEstimate = [120, 80]
const otherAutomaticWorkingCapital = [30, 20]
const wcWithAutomaticFg = integrationModule.bindFinishedGoodsInventoryToWorkingCapital(
  otherAutomaticWorkingCapital.map((amount,index)=>amount+automaticFinishedGoodsEstimate[index]),
  bound.schedule,false,automaticFinishedGoodsEstimate
)
assert.equal(wcWithAutomaticFg.valid,true,wcWithAutomaticFg.issues.join('; '))
close(wcWithAutomaticFg.closingWorkingCapitalByPeriod[0],otherAutomaticWorkingCapital[0]+p1.closingInventoryValue,
  'Product-led finished goods must replace, not stack on top of, automatic days-coverage inventory')
close(wcWithAutomaticFg.closingWorkingCapitalByPeriod[1],otherAutomaticWorkingCapital[1]+p2.closingInventoryValue)
assert.deepEqual(wcWithAutomaticFg.inventoryAddedByPeriod,
  [p1.closingInventoryValue-120,p2.closingInventoryValue-80],
  'The inventory adjustment must be the net replacement of the estimated finished-goods allowance')

// Guard the actual UI-to-engine wiring, not just the standalone calculation helpers.
const advancedPanel = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const financialForms = await readFile(new URL('../src/features/projects/ProjectModelFinancialFormsPanel.tsx', import.meta.url), 'utf8')
const wizard = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(advancedPanel.includes('buildCppCpsTraceLedger(props.cppCpsTraceItems'))
assert.ok(advancedPanel.includes('onCppCpsTraceLedger?.(cppCpsTraceLedger)'))
assert.ok(advancedPanel.includes('props.productFinancialDrafts?.costCentres??[]'))
assert.ok(advancedPanel.includes('knownIncrementalByCostCentreAndCategory'))
assert.ok(advancedPanel.includes('manualDriverName'))
assert.ok(advancedPanel.includes('Driver and unit'))
assert.ok(advancedPanel.includes('Complete total'))
assert.ok(advancedPanel.includes('bindCppCpsTraceLedgerToProductSchedule'))
assert.ok(advancedPanel.includes('bindFinishedGoodsInventoryToWorkingCapital'))
assert.ok(advancedPanel.includes('...cppCpsTraceLedger.completeIncrementalByCostCentre'),
  'Cost centres containing only unverified items must remain visible in the traceability report')
assert.ok(advancedPanel.includes('categoryRows.length===0||categoryRows.some(row=>row.sourceStatus!==\'verified\')'),
  'A category with missing or unverified evidence must display as unknown, never as zero')
assert.ok(advancedPanel.includes('annualVariableCost:productOperatingSchedule?.valid?productOperatingSchedule.annualCostOfSales'))
assert.ok(financialForms.includes('Centre allocation basis'))
assert.ok(financialForms.includes('Cost-centre driver'))
assert.ok(financialForms.includes('Cost centre ID'))
assert.ok(financialForms.includes('Source reference'))
assert.ok(financialForms.includes('baseCoveredAmounts'))
assert.ok(wizard.includes('cppCpsTraceItems={m.financialForms.cppCpsTraceItems??[]}'))
assert.ok(wizard.includes('wasteLedgerEntries:m.financialForms.wasteLedgerEntries??[]'))
assert.ok(wizard.includes('productionTransfers:m.financialForms.productionTransfers??[]'))
assert.ok(wizard.includes('inventoryReferenceBenchmarks:m.financialForms.inventoryReferenceBenchmarks??[]'))
assert.ok(wizard.includes('costCentres:m.financialForms.costCentres??[]'))
assert.ok(wizard.includes('onCppCpsTraceLedger={setReportCppCpsTraceLedger}'))
assert.ok(wizard.includes("reportCppCpsTraceLedger?.readyForCppPosting!==true"))
assert.ok(wizard.includes("reportPeriodicFinance?.valid!==true"))
assert.ok(wizard.includes("cost-allocation-not-ready"))
assert.ok(!wizard.includes("financialForms.economic:cost-allocation-not-integrated"))
assert.ok(wizard.includes('reportCppCpsTraceLedger.completeIncrementalByCostCentreByPeriod'))
assert.ok(wizard.includes("onClick={()=>setStep('profile')}"))
console.log('CPP/CPS finance integration, working-capital reconciliation, source gating and report actions passed.')
