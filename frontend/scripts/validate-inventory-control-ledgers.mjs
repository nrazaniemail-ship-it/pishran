import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts',import.meta.url),'utf8')
const financePanel=await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx',import.meta.url),'utf8')
const financialForms=await readFile(new URL('../src/features/projects/ProjectModelFinancialFormsPanel.tsx',import.meta.url),'utf8')
assert.match(financePanel,/row\.sourceVerified===true/,'verified-only stage movement rows must enter the reconciliation gate')
assert.match(financePanel,/const hasUnpostedStageInventoryData=Boolean/,'populated stage inventory ledgers must be detected before reporting')
assert.match(financePanel,/const stageInventoryPreflight=useMemo/,'detailed stage ledgers must be reconciled before periodic finance calculation')
assert.match(financePanel,/baseIntegratedProductOperatingSchedule\?\.rows\?\?\[\]/,
  'production-flow abnormal waste must retain product-period evidence for journal generation')
assert.match(financePanel,/buildAbnormalWasteAccountingPostings/,
  'verified abnormal waste must produce an accounting journal in the finance workflow')
assert.match(financePanel,/combinedStageAccountingPostings/,
  'abnormal-waste journals must be persisted with the stage accounting ledger')
assert.match(financePanel,/abnormalWasteAccounting\.valid/,
  'invalid or unverified abnormal waste must block journal persistence')
assert.match(financePanel,/reconcileStageInventoryMovements\(movements,expectedByPeriod/,'stage ledger preflight must reconcile to product-schedule inventory totals')
assert.match(financePanel,/finishedGoodsCostOfSales:row\.costOfSales/,'stage ledger preflight must reconcile finished-goods cost of sales to the product schedule')
assert.match(financePanel,/The detailed ledger does not add a second CPP\/CPS charge/,'stage-ledger controls must not add a second CPP/CPS charge')

assert.match(financePanel,/periodicFinanceResult\?\.valid&&!hasUnpostedStageInventoryData\?buildPeriodicThreeFinancialStatements/,'periodic three-statement output must be blocked while detailed stage ledgers are unposted')
assert.match(financePanel,/periodicFinanceResult\?\.valid&&!hasUnpostedStageInventoryData\?<div className="fw-card">/,'periodic financial report tables must be hidden while detailed stage ledgers are unposted')
assert.match(financePanel,/!salesTaxLedgerActive&&!hasUnpostedStageInventoryData\?calculatePeriodicSensitivityMatrix/,'sensitivity must be disabled while detailed stage ledgers are unposted')
assert.match(financePanel,/!salesTaxLedgerActive&&!hasUnpostedStageInventoryData\?calculatePeriodicFinancialScenarios/,'scenarios must be disabled while detailed stage ledgers are unposted')

assert.match(financePanel,/stageTransfers\.some\(row=>\[\s*row\.period/,'stage-transfer data detection must inspect business fields')
assert.doesNotMatch(financePanel,/stageTransfers\.some\(row=>\[\s*row\.id/,'a generated identifier alone must not make a blank transfer draft block reports')
assert.match(financialForms,/Internal transfer-in quantity/,'stage movement form must expose internal transfer-in quantity')
assert.match(financialForms,/Internal transfer-out value/,'stage movement form must expose internal transfer-out value')
assert.match(financialForms,/Transferred value/,'inter-stage transfer form must expose the transferred inventory value')

const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const waste=module.validateWasteLedger([
 {id:'N1',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:2,unitCost:10,amount:20,sourceReference:'waste-register-p1',sourceVerified:true},
 {id:'A1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'incident-report-p1',sourceVerified:true},
],2)
assert.equal(waste.valid,true,waste.issues.join('; '))
assert.deepEqual(waste.normalWasteAbsorbedByPeriod,[20,0])
assert.deepEqual(waste.abnormalWasteExpenseByPeriod,[10,0])

const abnormalWasteJournal=module.buildAbnormalWasteAccountingPostings([
 {id:'N1',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:2,unitCost:10,amount:20,sourceReference:'waste-register-p1',sourceVerified:true},
 {id:'A1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'incident-report-p1',sourceVerified:true},
],2)
assert.equal(abnormalWasteJournal.valid,true,abnormalWasteJournal.issues.join('; '))
assert.equal(abnormalWasteJournal.postings.length,1,'Normal waste is absorbed into production cost and must not create a separate expense journal')
assert.deepEqual(abnormalWasteJournal.postings[0],{
 id:'abnormal-waste:1:P1:CC-A:A1',period:1,kind:'abnormal-waste',productId:'P1',
 sourceReference:'incident-report-p1',debitAccount:'Abnormal Waste Expense',
 creditAccount:'Inventory:raw-materials',amount:10,
})
assert.equal(abnormalWasteJournal.debitTotal,10)
assert.equal(abnormalWasteJournal.creditTotal,10)

const productionFlowWasteJournal=module.buildAbnormalWasteAccountingPostings([],2,[
 {period:2,productId:'P2',abnormalWasteValue:30,abnormalWasteSourceReference:'FLOW-INCIDENT-2',abnormalWasteSourceVerified:true},
])
assert.equal(productionFlowWasteJournal.valid,true,productionFlowWasteJournal.issues.join('; '))
assert.equal(productionFlowWasteJournal.postings.length,1)
assert.deepEqual(productionFlowWasteJournal.postings[0],{
 id:'abnormal-waste-flow:2:P2',period:2,kind:'abnormal-waste',productId:'P2',
 sourceReference:'FLOW-INCIDENT-2',debitAccount:'Abnormal Waste Expense',
 creditAccount:'Inventory:raw-materials',amount:30,
})
const duplicatedWasteSources=module.buildAbnormalWasteAccountingPostings([
 {id:'A1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'incident-report-p1',sourceVerified:true},
],2,[{period:1,productId:'P1',abnormalWasteValue:10,abnormalWasteSourceReference:'incident-report-p1',abnormalWasteSourceVerified:true}])
assert.equal(duplicatedWasteSources.valid,false,'The same product-period abnormal waste cannot post from both the waste ledger and production flow')

assert.equal(module.buildAbnormalWasteAccountingPostings([
 {id:'A2',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'incident-report-p1',sourceVerified:false},
],1).valid,false,'Unverified abnormal waste must not generate a journal')

assert.equal(module.validateWasteLedger([{id:'bad',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:2,unitCost:10,amount:19,sourceReference:'waste-doc',sourceVerified:true}],1).valid,false)
assert.equal(module.validateWasteLedger([{id:'unverified',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'incident-report',sourceVerified:false}],1).valid,false,'abnormal waste without source verification must be rejected')
assert.equal(module.validateWasteLedger([{id:'missing-source',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10,sourceReference:'',sourceVerified:true}],1).valid,false,'verification without a source reference must be rejected')
const transfers=module.validateProductionTransfers([
 {id:'T1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'MELT',destinationCostCentreId:'CAST',quantity:50,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:500},
],1)
assert.equal(transfers.valid,true,transfers.issues.join('; '))
assert.equal(transfers.netQuantityByProductCentre['1:P1@MELT'],-50)
assert.equal(transfers.netQuantityByProductCentre['1:P2@CAST'],50)
const converted=module.validateProductionTransfers([
 {id:'T2',period:1,sourceProductId:'COIL',destinationProductId:'SHEET',sourceCostCentreId:'ROLL',destinationCostCentreId:'FINISH',quantity:1000,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0.001,costAmount:250000},
],1)
assert.equal(converted.valid,true,converted.issues.join('; '))
assert.equal(converted.netQuantityByProductCentre['1:COIL@ROLL'],-1000)
assert.equal(converted.netQuantityByProductCentre['1:SHEET@FINISH'],1)
const periodSeparated=module.validateProductionTransfers([
 {id:'T3',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
 {id:'T4',period:2,sourceProductId:'P2',destinationProductId:'P1',sourceCostCentreId:'B',destinationCostCentreId:'A',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
],2)
assert.equal(periodSeparated.valid,true,periodSeparated.issues.join('; '))
assert.equal(periodSeparated.netQuantityByProductCentre['1:P1@A'],-10)
assert.equal(periodSeparated.netQuantityByProductCentre['2:P1@A'],10)
assert.equal(periodSeparated.netValueByProductCentre['1:P1@A'],-100)
assert.equal(periodSeparated.netValueByProductCentre['2:P1@A'],100)
assert.equal(Object.keys(periodSeparated.netQuantityByProductCentre).length,4,
 'opposite transfers in different periods must not net against each other')

const centreMovements=[
 {period:1,productId:'P1',costCentreId:'A',openingQuantity:20,openingValue:200,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:10,closingValue:100},
 {period:1,productId:'P2',costCentreId:'B',openingQuantity:0,openingValue:0,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:10,closingValue:100},
 {period:2,productId:'P1',costCentreId:'A',openingQuantity:10,openingValue:100,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:10,closingValue:100},
 {period:2,productId:'P2',costCentreId:'B',openingQuantity:10,openingValue:100,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:4,consumptionValue:40,wasteQuantity:0,wasteValue:0,closingQuantity:6,closingValue:60},
]
const centreReconciled=module.reconcileCostCentreInventory(centreMovements,[
 {id:'CC-T1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
],2)
assert.equal(centreReconciled.valid,true,centreReconciled.issues.join('; '))
assert.equal(centreReconciled.rows.find(row=>row.productId==='P1').transferNetValue,-100)
assert.equal(centreReconciled.rows.find(row=>row.productId==='P2').transferNetValue,100)
assert.equal(centreReconciled.rows.find(row=>row.productId==='P2'&&row.period===2).expectedClosingValue,60)
const missingTransferCentre=module.reconcileCostCentreInventory(centreMovements.filter(row=>!(row.period===1&&row.productId==='P2')),[
 {id:'CC-T2',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
],2)
assert.equal(missingTransferCentre.valid,false,'every transfer endpoint must have an explicit centre stock movement row')
assert.ok(missingTransferCentre.issues.some(issue=>issue.includes('no matching cost-centre inventory movement row')))
const wrongCentreClosing=module.reconcileCostCentreInventory(centreMovements.map(row=>row.period===1&&row.productId==='P2'?{...row,closingValue:99}:row),[
 {id:'CC-T3',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
],2)
assert.equal(wrongCentreClosing.valid,false,'destination inventory value must include the exact transfer value')
assert.ok(wrongCentreClosing.issues.some(issue=>issue.includes('closing value does not reconcile')))
const wrongOpeningCarry=module.reconcileCostCentreInventory(centreMovements.map(row=>row.period===2&&row.productId==='P2'?{...row,openingValue:99}:row),[
 {id:'CC-T4',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
],2)
assert.equal(wrongOpeningCarry.valid,false,'each centre opening balance must carry forward its prior closing value')
assert.ok(wrongOpeningCarry.issues.some(issue=>issue.includes('opening value does not equal prior-period closing value')))
const skippedCentrePeriod=module.reconcileCostCentreInventory([
 {...centreMovements[0],consumptionQuantity:10,consumptionValue:100},
 {...centreMovements[2],period:3},
],[],3)
assert.equal(skippedCentrePeriod.valid,false,
 'A cost centre with stock on hand must not skip an intervening period and silently carry inventory across the gap.')
assert.ok(skippedCentrePeriod.issues.some(issue=>issue.includes('missing one or more intervening period movement rows')))
const zeroStockGap=module.reconcileCostCentreInventory([
 {...centreMovements[0],consumptionQuantity:20,consumptionValue:200,closingQuantity:0,closingValue:0},
 {...centreMovements[2],period:3,openingQuantity:0,openingValue:0,closingQuantity:0,closingValue:0},
],[],3)
assert.equal(zeroStockGap.valid,true,zeroStockGap.issues.join('; '),
 'A sparse cost-centre ledger may omit a period only when no stock remains to carry.')
const zeroStockReintroduced=module.reconcileCostCentreInventory([
 {...centreMovements[0],consumptionQuantity:20,consumptionValue:200,closingQuantity:0,closingValue:0},
 {...centreMovements[2],period:3,openingQuantity:5,openingValue:50,closingQuantity:5,closingValue:50},
],[],3)
assert.equal(zeroStockReintroduced.valid,false,
 'A later opening balance must not appear after a zero-stock gap without an intervening movement row.')
assert.ok(zeroStockReintroduced.issues.some(issue=>issue.includes('missing one or more intervening period movement rows')))

const centreStageRow=(period,costCentreId,openingQuantity,openingValue,transfersInQuantity,transfersInValue,transfersOutQuantity,transfersOutValue,salesQuantity,salesCostValue,closingQuantity,closingValue)=>({
 period,inventoryStage:'finished-goods',productId:'P1',costCentreId,
 openingQuantity,openingValue,receiptsQuantity:0,receiptsValue:0,transfersInQuantity,transfersInValue,transfersOutQuantity,transfersOutValue,
 productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,salesQuantity,salesCostValue,wasteQuantity:0,wasteValue:0,
 closingQuantity,closingValue,sourceReference:'inventory register / '+period,sourceVerified:true,
})
const multiPeriodCentreStageRows=[
 centreStageRow(1,'CC-A',20,200,0,0,10,100,0,0,10,100),
 centreStageRow(1,'CC-B',0,0,10,100,0,0,0,0,10,100),
 centreStageRow(1,'CC-C',0,0,0,0,0,0,0,0,0,0),
 centreStageRow(2,'CC-A',10,100,0,0,0,0,0,0,10,100),
 centreStageRow(2,'CC-B',10,100,0,0,5,50,0,0,5,50),
 centreStageRow(2,'CC-C',0,0,5,50,0,0,0,0,5,50),
 centreStageRow(3,'CC-A',10,100,0,0,0,0,0,0,10,100),
 centreStageRow(3,'CC-B',5,50,0,0,0,0,0,0,5,50),
 centreStageRow(3,'CC-C',5,50,0,0,0,0,2,20,3,30),
]
const multiPeriodCentreTransfers=[
 {id:'CC-MULTI-1',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
 {id:'CC-MULTI-2',period:2,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-C',quantity:5,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:50},
]
const multiPeriodCentreCheck=module.reconcileCostCentreInventory(
 multiPeriodCentreStageRows.map(row=>({
  period:row.period,productId:row.productId,costCentreId:row.costCentreId,
  openingQuantity:row.openingQuantity,openingValue:row.openingValue,receiptsQuantity:0,receiptsValue:0,
  productionQuantity:0,productionValue:0,consumptionQuantity:row.salesQuantity,consumptionValue:row.salesCostValue,
  wasteQuantity:0,wasteValue:0,closingQuantity:row.closingQuantity,closingValue:row.closingValue,
 })),
 multiPeriodCentreTransfers,3)
assert.equal(multiPeriodCentreCheck.valid,true,multiPeriodCentreCheck.issues.join('; '))
const multiPeriodStageCheck=module.reconcileStageInventoryMovements(multiPeriodCentreStageRows,[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:200},
 {period:2,rawMaterials:0,workInProgress:0,finishedGoods:200},
 {period:3,rawMaterials:0,workInProgress:0,finishedGoods:180},
],3,0.01,[],[
 {period:1,productId:'P1',rawMaterials:0,workInProgress:0,finishedGoods:200,finishedGoodsSalesQuantity:0,finishedGoodsCostOfSales:0},
 {period:2,productId:'P1',rawMaterials:0,workInProgress:0,finishedGoods:200,finishedGoodsSalesQuantity:0,finishedGoodsCostOfSales:0},
 {period:3,productId:'P1',rawMaterials:0,workInProgress:0,finishedGoods:180,finishedGoodsSalesQuantity:2,finishedGoodsCostOfSales:20},
])
assert.equal(multiPeriodStageCheck.valid,true,multiPeriodStageCheck.issues.join('; '))
assert.equal(multiPeriodStageCheck.rows.filter(row=>row.inventoryStage==='finished-goods').length,3,
 'the stage reconciliation reports one aggregated finished-goods row per period, not one row per cost centre')
const multiPeriodInventoryTotals=[200,200,180]
const multiPeriodWorkingCapitalCheck=module.reconcileInventoryThreeWay(multiPeriodInventoryTotals.map((inventory, index)=>{
 const period=index+1
 const model={rawMaterials:0,workInProgress:0,finishedGoods:inventory,otherCurrentAssets:10,currentLiabilities:5,netWorkingCapital:inventory+5}
 return {period,model,balanceSheet:{...model},cppCps:{rawMaterials:0,workInProgress:0,finishedGoods:inventory,totalInventory:inventory}}
}))
assert.equal(multiPeriodWorkingCapitalCheck.valid,true,multiPeriodWorkingCapitalCheck.issues.join('; '))
assert.deepEqual(multiPeriodWorkingCapitalCheck.rows.map(row=>row.inventoryModel),multiPeriodInventoryTotals,
 'internal transfers must preserve aggregate inventory; the period-three 20 cost-of-sales issue must reduce it only once')
assert.deepEqual(multiPeriodWorkingCapitalCheck.rows.map(row=>row.netWorkingCapitalModel),[205,205,185])

const overdrawCentre=module.reconcileCostCentreInventory(centreMovements.map(row=>row.period===1&&row.productId==='P1'?{...row,closingQuantity:0,closingValue:0}:row),[
 {id:'CC-T5',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:25,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:250},
],2)
assert.equal(overdrawCentre.valid,false,'a transfer that exceeds source centre stock must fail the centre roll-forward')
const stageRow=(period,inventoryStage,productId,openingQuantity,openingValue,receiptsQuantity,receiptsValue,productionQuantity,productionValue,consumptionQuantity,consumptionValue,closingQuantity,closingValue)=>({
 period,inventoryStage,productId,costCentreId:'CC-'+inventoryStage,
 openingQuantity,openingValue,receiptsQuantity,receiptsValue,transfersInQuantity:0,transfersInValue:0,transfersOutQuantity:0,transfersOutValue:0,productionQuantity,productionValue,
 consumptionQuantity,consumptionValue,salesQuantity:0,salesCostValue:0,wasteQuantity:0,wasteValue:0,closingQuantity,closingValue,
 sourceReference:'inventory register / '+period,sourceVerified:true,
})
const stageMovements=[
 stageRow(1,'raw-materials','RM',0,0,10,100,0,0,0,0,10,100),
 stageRow(2,'raw-materials','RM',10,100,0,0,0,0,2,20,8,80),
 stageRow(1,'work-in-progress','WIP',0,0,0,0,4,40,0,0,4,40),
 stageRow(2,'work-in-progress','WIP',4,40,0,0,1,10,0.5,5,4.5,45),
 stageRow(1,'finished-goods','FG',0,0,0,0,6,60,0,0,6,60),
 stageRow(2,'finished-goods','FG',6,60,0,0,0,0,2,20,4,40),
]
const stageReconciled=module.reconcileStageInventoryMovements(stageMovements,[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(stageReconciled.valid,true,stageReconciled.issues.join('; '))
assert.equal(stageReconciled.rows.length,6)
assert.equal(stageReconciled.rows.find(row=>row.period===2&&row.inventoryStage==='work-in-progress').variance,0)
const duplicateStageMovement=module.reconcileStageInventoryMovements([...stageMovements,stageMovements[0]],[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(duplicateStageMovement.valid,false,'duplicate period/stage/product/cost-centre rows must not be silently overwritten or aggregated')
assert.ok(duplicateStageMovement.issues.some(issue=>issue.includes('Duplicate stage inventory movement')))
const multiCentreRaw=[
 {...stageRow(1,'raw-materials','RM-A',0,0,3,30,0,0,0,0,3,30),costCentreId:'STORE-A'},
 {...stageRow(1,'raw-materials','RM-B',0,0,7,70,0,0,0,0,7,70),costCentreId:'STORE-B'},
 {...stageRow(2,'raw-materials','RM-A',3,30,0,0,0,0,1,10,2,20),costCentreId:'STORE-A'},
 {...stageRow(2,'raw-materials','RM-B',7,70,0,0,0,0,1,10,6,60),costCentreId:'STORE-B'},
]
const multiCentreStage=module.reconcileStageInventoryMovements(multiCentreRaw,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:0,finishedGoods:0},
],2)
assert.equal(multiCentreStage.valid,true,multiCentreStage.issues.join('; '))
assert.equal(multiCentreStage.rows.find(row=>row.period===1).ledgerClosingValue,100,
 'stage totals must aggregate distinct cost centres without duplicating inventory')
assert.equal(multiCentreStage.rows.find(row=>row.period===2).ledgerClosingValue,80)
const finishedGoodsProducts=[
 stageRow(1,'finished-goods','FG-A',0,0,0,0,30,30,0,0,30,30),
 stageRow(1,'finished-goods','FG-B',0,0,0,0,70,70,0,0,70,70),
 stageRow(2,'finished-goods','FG-A',30,30,0,0,0,0,10,10,20,20),
 stageRow(2,'finished-goods','FG-B',70,70,0,0,0,0,10,10,60,60),
]
const productEngineRows=[
 {period:1,productId:'FG-A',rawMaterials:0,workInProgress:0,finishedGoods:30,productionQuantity:30,productionCost:30},
 {period:1,productId:'FG-B',rawMaterials:0,workInProgress:0,finishedGoods:70,productionQuantity:70,productionCost:70},
 {period:2,productId:'FG-A',rawMaterials:0,workInProgress:0,finishedGoods:20,productionQuantity:0,productionCost:0},
 {period:2,productId:'FG-B',rawMaterials:0,workInProgress:0,finishedGoods:60,productionQuantity:0,productionCost:0},
]
const productStageMatched=module.reconcileStageInventoryMovements(finishedGoodsProducts,[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:100},
 {period:2,rawMaterials:0,workInProgress:0,finishedGoods:80},
],2,0.01,[],productEngineRows)
assert.equal(productStageMatched.valid,true,productStageMatched.issues.join('; '))
const productStageSwapped=module.reconcileStageInventoryMovements(finishedGoodsProducts,[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:100},
 {period:2,rawMaterials:0,workInProgress:0,finishedGoods:80},
],2,0.01,[],productEngineRows.map(row=>row.productId==='FG-A'?{...row,finishedGoods:row.period===1?70:60}:{...row,finishedGoods:row.period===1?30:20}))
assert.equal(productStageSwapped.valid,false,'matching aggregate totals must not hide finished goods assigned to the wrong product')
assert.ok(productStageSwapped.issues.some(issue=>issue.includes('product FG-A closing inventory does not match')))

const rawMaterialProductRows=[
 stageRow(1,'raw-materials','RM-A',0,0,3,30,0,0,0,0,3,30),
 stageRow(1,'raw-materials','RM-B',0,0,7,70,0,0,0,0,7,70),
]
const rawMaterialProductEngine=[
 {period:1,productId:'RM-A',rawMaterials:70,workInProgress:0,finishedGoods:0},
 {period:1,productId:'RM-B',rawMaterials:30,workInProgress:0,finishedGoods:0},
]
const rawMaterialProductMismatch=module.reconcileStageInventoryMovements(rawMaterialProductRows,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
],1,0.01,[],rawMaterialProductEngine)
assert.equal(rawMaterialProductMismatch.valid,false,
 'matching raw-material aggregate totals must not hide balances assigned to the wrong product')
assert.ok(rawMaterialProductMismatch.issues.some(issue=>issue.includes('Stage raw-materials product RM-A closing inventory does not match')))
const wipProductRows=[
 stageRow(1,'work-in-progress','WIP-A',0,0,0,0,3,30,0,0,3,30),
 stageRow(1,'work-in-progress','WIP-B',0,0,0,0,7,70,0,0,7,70),
]
const wipProductEngine=[
 {period:1,productId:'WIP-A',rawMaterials:0,workInProgress:70,finishedGoods:0},
 {period:1,productId:'WIP-B',rawMaterials:0,workInProgress:30,finishedGoods:0},
]
const wipProductMismatch=module.reconcileStageInventoryMovements(wipProductRows,[
 {period:1,rawMaterials:0,workInProgress:100,finishedGoods:0},
],1,0.01,[],wipProductEngine)
assert.equal(wipProductMismatch.valid,false,
 'matching WIP aggregate totals must not hide balances assigned to the wrong product')
assert.ok(wipProductMismatch.issues.some(issue=>issue.includes('Stage work-in-progress product WIP-A closing inventory does not match')))
const productStageMissingProduct=module.reconcileStageInventoryMovements(finishedGoodsProducts.filter(row=>row.productId!=='FG-B'),[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:100},
 {period:2,rawMaterials:0,workInProgress:0,finishedGoods:80},
],2,0.01,[],productEngineRows)
assert.equal(productStageMissingProduct.valid,false,'non-zero finished-goods product balances cannot be omitted from the detailed stage ledger')
const missingIntermediateProductMovement=module.reconcileStageInventoryMovements(
 finishedGoodsProducts.filter(row=>!(row.period===2&&row.productId==='FG-B')),[
  {period:1,rawMaterials:0,workInProgress:0,finishedGoods:100},
  {period:2,rawMaterials:0,workInProgress:0,finishedGoods:20},
 ],2,0.01,[],productEngineRows.map(row=>row.period===2&&row.productId==='FG-B'?{...row,finishedGoods:0}:row))
assert.equal(missingIntermediateProductMovement.valid,false,
 'a product inventory balance must not disappear between periods merely because the engine closing balance is zero')
assert.ok(missingIntermediateProductMovement.issues.some(issue=>issue.includes('FG-B is missing its period 2 movement row')))
const duplicateProductEngineRows=module.reconcileStageInventoryMovements(finishedGoodsProducts,[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:100},
 {period:2,rawMaterials:0,workInProgress:0,finishedGoods:80},
],2,0.01,[],[...productEngineRows,{...productEngineRows[0]}])
assert.equal(duplicateProductEngineRows.valid,false,'duplicate product-period engine balances must not be silently overwritten')
assert.ok(duplicateProductEngineRows.issues.some(issue=>issue.includes('invalid or duplicate period/product key')))
const balancedStageTransfers=[
 {...stageRow(1,'raw-materials','RM',10,100,0,0,0,0,0,0,5,50),costCentreId:'STORE-A',transfersOutQuantity:5,transfersOutValue:50},
 {...stageRow(1,'raw-materials','RM',0,0,0,0,0,0,0,0,5,50),costCentreId:'STORE-B',transfersInQuantity:5,transfersInValue:50},
]
const balancedStageTransferResult=module.reconcileStageInventoryMovements(balancedStageTransfers,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
],1)
assert.equal(balancedStageTransferResult.valid,true,balancedStageTransferResult.issues.join('; '))
assert.equal(balancedStageTransferResult.rows[0].ledgerClosingValue,100,
 'internal transfers must relocate value without increasing total stage inventory')
const unbalancedStageTransfers=balancedStageTransfers.map(row=>row.costCentreId==='STORE-B'?{...row,transfersInValue:45}:row)
const unbalancedStageTransferResult=module.reconcileStageInventoryMovements(unbalancedStageTransfers,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
],1)
assert.equal(unbalancedStageTransferResult.valid,false,'internal transfer-in and transfer-out values must balance')
assert.ok(unbalancedStageTransferResult.issues.some(issue=>issue.includes('internal cost-centre transfers do not balance')))
const missingStagePeriod=module.reconcileStageInventoryMovements(stageMovements.filter(row=>!(row.period===2&&row.inventoryStage==='raw-materials')),[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(missingStagePeriod.valid,false,'a stage ledger cannot be treated as complete when a period is missing')
assert.ok(missingStagePeriod.issues.some(issue=>issue.includes('missing cost-centre inventory rows for period 2')))
const stageTransferMovementRows=[
 {...stageRow(1,'raw-materials','ORE',10,100,0,0,0,0,0,0,6,60),costCentreId:'ORE-STORE'},
 {...stageRow(1,'work-in-progress','PELLET',0,0,0,0,0,0,0,0,4000,40),costCentreId:'DRI-PLANT'},
]
const rawToWipTransfer={id:'ST-1',period:1,sourceStage:'raw-materials',destinationStage:'work-in-progress',
 sourceProductId:'ORE',destinationProductId:'PELLET',sourceCostCentreId:'ORE-STORE',destinationCostCentreId:'DRI-PLANT',
 quantity:4,sourceUnit:'tonne',destinationUnit:'kg',conversionFactor:1000,transferValue:40,
 sourceReference:'material transfer note / 17',sourceVerified:true}
const finishedGoodsProductionRow={...stageRow(1,'finished-goods','FG-PROD',0,0,0,0,6,60,0,0,6,60)}
const finishedGoodsProductionEngine=[{period:1,productId:'FG-PROD',rawMaterials:0,workInProgress:0,finishedGoods:60,productionQuantity:6,productionCost:60}]
const finishedGoodsProductionCheck=module.reconcileStageInventoryMovements([finishedGoodsProductionRow],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsProductionEngine)
assert.equal(finishedGoodsProductionCheck.valid,true,finishedGoodsProductionCheck.issues.join('; '))
const finishedGoodsProductionQtyMismatch=module.reconcileStageInventoryMovements([{...finishedGoodsProductionRow,productionQuantity:5}],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsProductionEngine)
assert.equal(finishedGoodsProductionQtyMismatch.valid,false,'finished-goods production quantity must reconcile to product operating schedule')
assert.ok(finishedGoodsProductionQtyMismatch.issues.some(issue=>issue.includes('production quantity does not match')))
const finishedGoodsProductionValueMismatch=module.reconcileStageInventoryMovements([{...finishedGoodsProductionRow,productionValue:55}],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsProductionEngine)
assert.equal(finishedGoodsProductionValueMismatch.valid,false,'finished-goods production value must reconcile to product operating schedule')
assert.ok(finishedGoodsProductionValueMismatch.issues.some(issue=>issue.includes('production value does not match')))
const finishedGoodsSalesRow={...stageRow(1,'finished-goods','FG-1',10,100,0,0,0,0,0,0,6,60),salesQuantity:4,salesCostValue:40}
const finishedGoodsSalesEngine=[{period:1,productId:'FG-1',rawMaterials:0,workInProgress:0,finishedGoods:60,finishedGoodsSalesQuantity:4,finishedGoodsCostOfSales:40}]
const finishedGoodsSalesCheck=module.reconcileStageInventoryMovements([finishedGoodsSalesRow],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsSalesEngine)
assert.equal(finishedGoodsSalesCheck.valid,true,finishedGoodsSalesCheck.issues.join('; '))
const finishedGoodsSalesQtyMismatch=module.reconcileStageInventoryMovements([{...finishedGoodsSalesRow,salesQuantity:3}],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsSalesEngine)
assert.equal(finishedGoodsSalesQtyMismatch.valid,false,'finished-goods sales quantity must reconcile product by product')
assert.ok(finishedGoodsSalesQtyMismatch.issues.some(issue=>issue.includes('sales quantity does not match')))
const finishedGoodsCogsMismatch=module.reconcileStageInventoryMovements([{...finishedGoodsSalesRow,salesCostValue:35}],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:60},
],1,0.01,[],finishedGoodsSalesEngine)
assert.equal(finishedGoodsCogsMismatch.valid,false,'finished-goods issue value must reconcile to product cost of sales, not revenue')
assert.ok(finishedGoodsCogsMismatch.issues.some(issue=>issue.includes('cost of sales does not match')))
const finishedGoodsSalesWithoutLedger=module.reconcileStageInventoryMovements([],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:0},
],1,0.01,[],finishedGoodsSalesEngine)
assert.equal(finishedGoodsSalesWithoutLedger.valid,false,'sales cannot disappear from a zero-closing-inventory stage ledger')
assert.ok(finishedGoodsSalesWithoutLedger.issues.some(issue=>issue.includes('no finished-goods movement rows')))
const rawMaterialSalesInvalid=module.reconcileStageInventoryMovements([
 {...stageRow(1,'raw-materials','RM-1',10,100,0,0,0,0,0,0,6,60),salesQuantity:4,salesCostValue:40},
],[{period:1,rawMaterials:60,workInProgress:0,finishedGoods:0}],1)
assert.equal(rawMaterialSalesInvalid.valid,false,'raw-material sales fields must not be used for finished-goods COGS')
const blankStageTransferDraft=module.reconcileStageInventoryMovements([],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:0},
],1,0.01,[{id:'generated-blank-id',period:null,sourceStage:null,destinationStage:null,sourceProductId:'',destinationProductId:'',
 sourceCostCentreId:'',destinationCostCentreId:'',quantity:null,sourceUnit:'',destinationUnit:'',conversionFactor:null,
 transferValue:null,sourceReference:'',sourceVerified:false}])
assert.equal(blankStageTransferDraft.valid,true,'an untouched blank transfer form row must not create a false validation failure: '+JSON.stringify(blankStageTransferDraft))
const idOnlyStageTransfer=module.reconcileStageInventoryMovements([],[{period:1,rawMaterials:0,workInProgress:0,finishedGoods:0}],1,0.01,[
 {id:'ST-INCOMPLETE',period:null,sourceStage:'raw-materials',destinationStage:null,sourceProductId:'',destinationProductId:'',
  sourceCostCentreId:'',destinationCostCentreId:'',quantity:null,sourceUnit:'',destinationUnit:'',conversionFactor:null,
  transferValue:null,sourceReference:'',sourceVerified:false}
])
assert.equal(idOnlyStageTransfer.valid,false,'an identified but incomplete transfer row must not be ignored')
assert.ok(idOnlyStageTransfer.issues.some(issue=>issue.includes('invalid period')))
const verifiedOnlyMovement=module.reconcileStageInventoryMovements([
 {period:null,inventoryStage:null,productId:'',costCentreId:'',openingQuantity:null,openingValue:null,receiptsQuantity:null,receiptsValue:null,
  transfersInQuantity:null,transfersInValue:null,transfersOutQuantity:null,transfersOutValue:null,productionQuantity:null,productionValue:null,
  consumptionQuantity:null,consumptionValue:null,wasteQuantity:null,wasteValue:null,closingQuantity:null,closingValue:null,sourceReference:'',sourceVerified:true}
],[{period:1,rawMaterials:0,workInProgress:0,finishedGoods:0}],1)
assert.equal(verifiedOnlyMovement.valid,false,'a source-verified but otherwise blank movement row must be rejected')

const transferWithoutMovements=module.reconcileStageInventoryMovements([],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:0},
],1,0.01,[rawToWipTransfer])
assert.equal(transferWithoutMovements.valid,false,'an entered inter-stage transfer must be checked even if no movement rows exist')
assert.ok(transferWithoutMovements.issues.some(issue=>issue.includes('no matching source-stage inventory movement row')))
assert.ok(transferWithoutMovements.issues.some(issue=>issue.includes('no matching destination-stage inventory movement row')))
const rawToWip=module.reconcileStageInventoryMovements(stageTransferMovementRows,[
 {period:1,rawMaterials:60,workInProgress:40,finishedGoods:0},
],1,0.01,[rawToWipTransfer])
assert.equal(rawToWip.valid,true,rawToWip.issues.join('; '))
assert.equal(rawToWip.rows.find(row=>row.inventoryStage==='raw-materials').ledgerClosingValue,60)
assert.equal(rawToWip.rows.find(row=>row.inventoryStage==='work-in-progress').ledgerClosingValue,40)
assert.equal(rawToWip.rows.reduce((sum,row)=>sum+row.ledgerClosingValue,0),100,
 'inter-stage transfer must move value between stages without increasing total inventory')
const threeStageMovementRows=[
 {...stageRow(1,'raw-materials','ORE',10,100,0,0,0,0,0,0,6,60),costCentreId:'ORE-STORE'},
 {...stageRow(1,'work-in-progress','PELLET',0,0,0,0,0,0,0,0,0,0),costCentreId:'DRI-PLANT'},
 {...stageRow(1,'finished-goods','SLAB',0,0,0,0,0,0,0,0,4,40),costCentreId:'CASTING'},
]
const wipToFinishedTransfer={id:'ST-2',period:1,sourceStage:'work-in-progress',destinationStage:'finished-goods',
 sourceProductId:'PELLET',destinationProductId:'SLAB',sourceCostCentreId:'DRI-PLANT',destinationCostCentreId:'CASTING',
 quantity:4000,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0.001,transferValue:40,
 sourceReference:'casting transfer note / 18',sourceVerified:true}
const completeThreeStageChain=module.reconcileStageInventoryMovements(threeStageMovementRows,[
 {period:1,rawMaterials:60,workInProgress:0,finishedGoods:40},
],1,0.01,[rawToWipTransfer,wipToFinishedTransfer],[
 {period:1,productId:'SLAB',rawMaterials:0,workInProgress:0,finishedGoods:40,productionQuantity:4,productionCost:40},
])
assert.equal(completeThreeStageChain.valid,true,completeThreeStageChain.issues.join('; '))
assert.equal(completeThreeStageChain.rows.find(row=>row.inventoryStage==='raw-materials').ledgerClosingValue,60)
assert.equal(completeThreeStageChain.rows.find(row=>row.inventoryStage==='work-in-progress').ledgerClosingValue,0)
assert.equal(completeThreeStageChain.rows.find(row=>row.inventoryStage==='finished-goods').ledgerClosingValue,40)
assert.equal(completeThreeStageChain.rows.reduce((sum,row)=>sum+row.ledgerClosingValue,0),100,
 'raw-materials -> WIP -> finished-goods chain must preserve total inventory value')
const incompleteTransferMovement=module.reconcileStageInventoryMovements([
 {...stageTransferMovementRows[0],receiptsQuantity:null,receiptsValue:null},
 stageTransferMovementRows[1],
],[
 {period:1,rawMaterials:60,workInProgress:40,finishedGoods:0},
],1,0.01,[rawToWipTransfer])
assert.equal(incompleteTransferMovement.valid,false,
 'a stage transfer must not turn missing base receipts into an implicit zero')
assert.ok(incompleteTransferMovement.issues.some(issue=>issue.includes('every quantity and value to be explicitly entered')))
const missingStageTransferEndpoint=module.reconcileStageInventoryMovements(stageTransferMovementRows.slice(1),[
 {period:1,rawMaterials:60,workInProgress:40,finishedGoods:0},
],1,0.01,[rawToWipTransfer])
assert.equal(missingStageTransferEndpoint.valid,false,'both source and destination stage movement rows are required')
assert.ok(missingStageTransferEndpoint.issues.some(issue=>issue.includes('no matching source-stage inventory movement row')))
const sameStageTransfer=module.reconcileStageInventoryMovements(stageTransferMovementRows,[
 {period:1,rawMaterials:60,workInProgress:40,finishedGoods:0},
],1,0.01,[{...rawToWipTransfer,destinationStage:'raw-materials'}])
assert.equal(sameStageTransfer.valid,false,'same-stage transfers must use the separate internal centre-transfer register')
const stageValueMismatch=module.reconcileStageInventoryMovements(stageMovements.map(row=>row.period===2&&row.inventoryStage==='finished-goods'?{...row,closingValue:39}:row),[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(stageValueMismatch.valid,false,'stage ledger totals must reconcile to the finance engine without being posted twice')
const absentNonZeroStage=module.reconcileStageInventoryMovements(stageMovements.filter(row=>row.inventoryStage!=='finished-goods'),[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(absentNonZeroStage.valid,false,'a non-zero finance-engine stage cannot be omitted from the subledger')
assert.ok(absentNonZeroStage.issues.some(issue=>issue.includes('non-zero finance-engine balance but no cost-centre inventory movement rows')))
const absentZeroStage=module.reconcileStageInventoryMovements(stageMovements.filter(row=>row.inventoryStage!=='finished-goods').map(row=>row),[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:0},
],2)
assert.equal(absentZeroStage.valid,true,absentZeroStage.issues.join('; '))
const stageUnverified=module.reconcileStageInventoryMovements(stageMovements.map(row=>row.inventoryStage==='raw-materials'?{...row,sourceVerified:false}:row),[
 {period:1,rawMaterials:100,workInProgress:40,finishedGoods:60},
 {period:2,rawMaterials:80,workInProgress:45,finishedGoods:40},
],2)
assert.equal(stageUnverified.valid,false,'stage reconciliation requires verified source evidence')

assert.equal(module.validateProductionTransfers([{id:'bad-factor',period:1,sourceProductId:'A',destinationProductId:'B',sourceCostCentreId:'X',destinationCostCentreId:'Y',quantity:1,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0,costAmount:1}],1).valid,false)

assert.equal(transfers.totalSourceValue,transfers.totalDestinationValue)
assert.equal(module.validateProductionTransfers([{id:'T1',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'A',destinationCostCentreId:'A',quantity:1,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:1},{id:'T1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:1,costAmount:1}],1).valid,false)
const p={period:1,model:{rawMaterials:100,workInProgress:50,finishedGoods:150,otherCurrentAssets:40,currentLiabilities:60,netWorkingCapital:280},balanceSheet:{rawMaterials:100,workInProgress:50,finishedGoods:150,otherCurrentAssets:40,currentLiabilities:60,netWorkingCapital:280},cppCps:{rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300}}
const reconciled=module.reconcileInventoryThreeWay([p])
assert.equal(reconciled.valid,true,reconciled.issues.join('; '))
const mismatch=module.reconcileInventoryThreeWay([{...p,balanceSheet:{...p.balanceSheet,finishedGoods:149}}])
assert.equal(mismatch.valid,false)
assert.ok(mismatch.issues.some(x=>x.includes('model vs balance sheet')))
const duplicatePeriod=module.reconcileInventoryThreeWay([p,{...p}])
assert.equal(duplicatePeriod.valid,false,'duplicate period rows must not silently double-count inventory reconciliation')
assert.ok(duplicatePeriod.issues.some(x=>x.includes('duplicate period')))
const invalidAmounts=module.reconcileInventoryThreeWay([{...p,model:{...p.model,rawMaterials:-1}}])
assert.equal(invalidAmounts.valid,false,'negative inventory balances must be rejected before reconciliation')
assert.ok(invalidAmounts.issues.some(x=>x.includes('finite non-negative amount')))

const netNegativeResidual=module.reconcileInventoryThreeWay([{
 ...p,
 model:{...p.model,otherCurrentAssets:-100,currentLiabilities:0,netWorkingCapital:200},
 balanceSheet:{...p.balanceSheet,otherCurrentAssets:-100,currentLiabilities:0,netWorkingCapital:200},
}])
assert.equal(netNegativeResidual.valid,true,
 'The signed net-current-account residual may be negative when inventories exceed net working capital because of operating payables.')
assert.equal(netNegativeResidual.rows[0].netWorkingCapitalModel,200)
assert.equal(netNegativeResidual.rows[0].netWorkingCapitalBalanceSheet,200)

const missingPeriods=module.reconcileInventoryThreeWay([])
assert.equal(missingPeriods.valid,false,'an empty reconciliation must not pass vacuously')
const invalidTolerance=module.reconcileInventoryThreeWay([p],-1)
assert.equal(invalidTolerance.valid,false,'negative tolerance must be rejected')
const reference=module.reconcileInventoryReference([
 {id:'R1',period:1,sourceDocument:'COMFAR III report.pdf',schedule:'Working capital requirements',page:'246',currency:'IRR',amountScaleToModel:1,rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450},
], [{period:1,rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450}],0.01,'IRR')
assert.equal(reference.valid,true,reference.issues.join('; '))
assert.equal(reference.rows[0].status,'matched')
const incompleteReference=module.reconcileInventoryReference([
 {id:'R2',period:1,sourceDocument:'COMFAR III report.pdf',schedule:'Working capital requirements',page:'246',currency:'IRR',amountScaleToModel:1,rawMaterials:100,workInProgress:null,finishedGoods:150,totalInventory:null,cpp:null,cps:null},
], [{period:1,rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450}],0.01,'IRR')
assert.equal(incompleteReference.valid,false)
assert.equal(incompleteReference.rows[0].status,'incomplete')
assert.equal(module.reconcileInventoryReference([{id:'R3',period:1,sourceDocument:'x',schedule:'y',page:'1',currency:'USD',amountScaleToModel:1,rawMaterials:1,workInProgress:1,finishedGoods:1,totalInventory:3,cpp:4,cps:3}], [{period:1,rawMaterials:1,workInProgress:1,finishedGoods:1,totalInventory:3,cpp:4,cps:3}],0.01,'IRR').valid,false)
// Extracted aggregate inventory values from COMFAR III SARZAMIN tank-project report, printed pp.32-35.
const comfarInventory=[
 [3,236787.88,32],[4,264340.10,32],[5,292726.11,33],[6,321112.12,33],
 [7,320973.15,33],[8,320973.15,33],[9,320973.15,33],[10,320973.15,34],
 [11,320973.15,34],[12,320973.15,34],[13,320973.15,34],[14,320973.15,34],
 [15,320973.15,35],[16,320973.15,35],[17,320973.15,35],
].map(([period,totalInventory,page])=>({id:'SARZAMIN-'+period,period,sourceDocument:'COMFAR III - 001 - جدول خلاصه عملکرد پروژه.pdf',schedule:'سرمایه در گردش خالص مورد نیاز - کل / کل موجودی کالا',page:String(page),currency:'IRR',amountScaleToModel:1,rawMaterials:null,workInProgress:null,finishedGoods:null,totalInventory,cpp:null,cps:null}))
const comfarModel=comfarInventory.map(row=>({period:row.period,rawMaterials:0,workInProgress:0,finishedGoods:0,totalInventory:row.totalInventory,cpp:0,cps:0}))
const aggregateOnly=module.reconcileInventoryReference(comfarInventory,comfarModel,0.01,'IRR')
assert.equal(aggregateOnly.valid,false,'Aggregate inventory alone must not falsely certify component inventory or CPP/CPS reconciliation')
assert.equal(aggregateOnly.rows.length,15)
const scaledReference=module.reconcileInventoryReference([
 {...comfarInventory[0],amountScaleToModel:1000000},
],[{...comfarModel[0],totalInventory:236787880000}],0.01,'IRR')
assert.equal(scaledReference.rows[0].matchedFields.includes('totalInventory'),true,'million-IRR report values must scale explicitly into model rials')

assert.ok(aggregateOnly.rows.every(row=>row.status==='incomplete'&&row.missingFields.includes('rawMaterials')&&row.missingFields.includes('cpp')))
const changedTotal=module.reconcileInventoryReference([comfarInventory[0]],[{...comfarModel[0],totalInventory:236787.89}],0.000001,'IRR')
assert.equal(changedTotal.rows[0].status,'mismatch','Aggregate inventory mismatch must remain visible even when component evidence is incomplete')

// Three-period internal cost-centre transfers must preserve group inventory and CPP;
// only the evidenced finished-goods consumption in period three reduces COGS/stock.
const rollingCentreTransfers=[
 {id:'ROLL-1-A-B',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:20,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:200},
 {id:'ROLL-2-A-B',period:2,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
 {id:'ROLL-2-B-C',period:2,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-C',quantity:5,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:50},
 {id:'ROLL-3-A-B',period:3,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:20,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:200},
 {id:'ROLL-3-B-C',period:3,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-C',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
];
const rollingCentreMovement=(period,costCentreId,openingQuantity,openingValue,closingQuantity,closingValue,consumptionQuantity=0,consumptionValue=0)=>({
 period,productId:'P1',costCentreId,openingQuantity,openingValue,
 receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,
 consumptionQuantity,consumptionValue,wasteQuantity:0,wasteValue:0,closingQuantity,closingValue,
});
const rollingCentreMovements=[
 rollingCentreMovement(1,'CC-A',100,1000,80,800),
 rollingCentreMovement(1,'CC-B',0,0,20,200),
 rollingCentreMovement(1,'CC-C',0,0,0,0),
 rollingCentreMovement(2,'CC-A',80,800,70,700),
 rollingCentreMovement(2,'CC-B',20,200,25,250),
 rollingCentreMovement(2,'CC-C',0,0,5,50),
 rollingCentreMovement(3,'CC-A',70,700,50,500),
 rollingCentreMovement(3,'CC-B',25,250,30,300,5,50),
 rollingCentreMovement(3,'CC-C',5,50,15,150),
];
const rollingTransferLedger=module.validateProductionTransfers(rollingCentreTransfers,3);
assert.equal(rollingTransferLedger.valid,true,rollingTransferLedger.issues.join('; '));
assert.equal(rollingTransferLedger.totalSourceValue,650);
assert.equal(rollingTransferLedger.totalDestinationValue,650);
const rollingCentreCheck=module.reconcileCostCentreInventory(rollingCentreMovements,rollingCentreTransfers,3);
assert.equal(rollingCentreCheck.valid,true,rollingCentreCheck.issues.join('; '));
const rollingInventoryByPeriod=[1,2,3].map(period=>rollingCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.expectedClosingValue,0));
assert.deepEqual(rollingInventoryByPeriod,[1000,1000,950],
 'centre-to-centre movements must conserve total finished-goods value in each period');
const rollingTransferNetByPeriod=[1,2,3].map(period=>rollingCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.transferNetValue,0));
assert.deepEqual(rollingTransferNetByPeriod,[0,0,0],
 'internal transfers must have zero net value at project level and must not create CPP');
const rollingCogsByPeriod=[1,2,3].map(period=>rollingCentreMovements
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.consumptionValue,0));
assert.deepEqual(rollingCogsByPeriod,[0,0,50],
 'only the separately evidenced finished-goods consumption may enter COGS');
assert.deepEqual(rollingInventoryByPeriod.slice(1).map((value,index)=>rollingInventoryByPeriod[index]-value),
 [0,50],
 'aggregate inventory reduction must equal COGS once, without a second transfer posting');
const rollingInventoryThreeWay=module.reconcileInventoryThreeWay(rollingInventoryByPeriod.map((finishedGoods,index)=>{
 const period=index+1;
 const inventory=200+100+finishedGoods;
 const workingCapital=inventory+30-80;
 const model={rawMaterials:200,workInProgress:100,finishedGoods,otherCurrentAssets:30,currentLiabilities:80,netWorkingCapital:workingCapital};
 return {period,model,balanceSheet:{...model},cppCps:{rawMaterials:200,workInProgress:100,finishedGoods,totalInventory:inventory}};
}));
assert.equal(rollingInventoryThreeWay.valid,true,rollingInventoryThreeWay.issues.join('; '));
assert.deepEqual(rollingInventoryThreeWay.rows.map(row=>row.inventoryModel),[1300,1300,1250]);
assert.deepEqual(rollingInventoryThreeWay.rows.map(row=>row.inventoryCppCps),[1300,1300,1250]);
assert.deepEqual(rollingInventoryThreeWay.rows.map(row=>row.netWorkingCapitalModel),[1250,1250,1200],
 'WC must reflect raw materials, WIP and transferred finished goods once, less current liabilities');


// Three-period mixed-unit transfers exercise conversion, partial quantities, reversal,
// and period-by-period carry-forward without netting opposite movements across periods.
const mixedUnitTransfers=[
 {id:'MIX-1-ORE-TO-CONC',period:1,sourceProductId:'ORE',destinationProductId:'CONC',sourceCostCentreId:'MINE',destinationCostCentreId:'PLANT',quantity:1000,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0.001,costAmount:250},
 {id:'MIX-2-CONC-REVERSAL',period:2,sourceProductId:'CONC',destinationProductId:'ORE',sourceCostCentreId:'PLANT',destinationCostCentreId:'MINE',quantity:0.4,sourceUnit:'tonne',destinationUnit:'kg',conversionFactor:1000,costAmount:100},
 {id:'MIX-3-PARTIAL-ORE-MOVE',period:3,sourceProductId:'ORE',destinationProductId:'ORE',sourceCostCentreId:'MINE',destinationCostCentreId:'MILL',quantity:200,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:50},
];
const mixedUnitMovements=[
 {period:1,productId:'ORE',costCentreId:'MINE',openingQuantity:2000,openingValue:500,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:1000,closingValue:250},
 {period:1,productId:'CONC',costCentreId:'PLANT',openingQuantity:0,openingValue:0,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:1,closingValue:250},
 {period:2,productId:'ORE',costCentreId:'MINE',openingQuantity:1000,openingValue:250,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:1400,closingValue:350},
 {period:2,productId:'CONC',costCentreId:'PLANT',openingQuantity:1,openingValue:250,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:0.6,closingValue:150},
 {period:3,productId:'ORE',costCentreId:'MINE',openingQuantity:1400,openingValue:350,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:1200,closingValue:300},
 {period:3,productId:'ORE',costCentreId:'MILL',openingQuantity:0,openingValue:0,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:200,closingValue:50},
 {period:3,productId:'CONC',costCentreId:'PLANT',openingQuantity:0.6,openingValue:150,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:0.6,closingValue:150},
];
const mixedUnitTransferLedger=module.validateProductionTransfers(mixedUnitTransfers,3);
assert.equal(mixedUnitTransferLedger.valid,true,mixedUnitTransferLedger.issues.join('; '));
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['1:ORE@MINE'],-1000);
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['1:CONC@PLANT'],1,
 '1000 kg converted at 0.001 must post exactly 1 tonne to the receiving product and centre');
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['2:CONC@PLANT'],-0.4);
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['2:ORE@MINE'],400,
 'the reverse transfer must convert 0.4 tonne back to 400 kg');
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['3:ORE@MINE'],-200);
assert.equal(mixedUnitTransferLedger.netQuantityByProductCentre['3:ORE@MILL'],200);
assert.equal(mixedUnitTransferLedger.totalSourceValue,400);
assert.equal(mixedUnitTransferLedger.totalDestinationValue,400);
const mixedUnitCentreCheck=module.reconcileCostCentreInventory(mixedUnitMovements,mixedUnitTransfers,3);
assert.equal(mixedUnitCentreCheck.valid,true,mixedUnitCentreCheck.issues.join('; '));
const mixedUnitValueByPeriod=[1,2,3].map(period=>mixedUnitCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.expectedClosingValue,0));
assert.deepEqual(mixedUnitValueByPeriod,[500,500,500],
 'conversion, reversal and partial transfers must conserve total inventory value in each period');
const mixedUnitTransferNetByPeriod=[1,2,3].map(period=>mixedUnitCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.transferNetValue,0));
assert.deepEqual(mixedUnitTransferNetByPeriod,[0,0,0],
 'the source and destination postings must offset in each period, not merely over the full horizon');
assert.equal(mixedUnitCentreCheck.rows.find(row=>row.period===1&&row.productId==='ORE').expectedClosingQuantity,1000);
assert.equal(mixedUnitCentreCheck.rows.find(row=>row.period===2&&row.productId==='ORE').expectedClosingQuantity,1400);
assert.equal(mixedUnitCentreCheck.rows.find(row=>row.period===2&&row.productId==='CONC').expectedClosingQuantity,0.6);
assert.equal(mixedUnitCentreCheck.rows.find(row=>row.period===3&&row.costCentreId==='MILL').expectedClosingQuantity,200);
const mixedUnitInventoryThreeWay=module.reconcileInventoryThreeWay(mixedUnitValueByPeriod.map((finishedGoods,index)=>{
 const inventory=finishedGoods+100;
 const model={rawMaterials:100,workInProgress:0,finishedGoods,otherCurrentAssets:20,currentLiabilities:30,netWorkingCapital:inventory-10};
 return {period:index+1,model,balanceSheet:{...model},cppCps:{rawMaterials:100,workInProgress:0,finishedGoods,totalInventory:inventory}};
}));
assert.equal(mixedUnitInventoryThreeWay.valid,true,mixedUnitInventoryThreeWay.issues.join('; '));
assert.deepEqual(mixedUnitInventoryThreeWay.rows.map(row=>row.inventoryModel),[600,600,600]);
assert.deepEqual(mixedUnitInventoryThreeWay.rows.map(row=>row.netWorkingCapitalModel),[590,590,590],
 'internal centre transfers must not inflate CPP/CPS inventory or working capital');
const invalidMixedUnitFactor=module.validateProductionTransfers([
 {...mixedUnitTransfers[0],id:'MIX-BAD-FACTOR',conversionFactor:0},
],3);
assert.equal(invalidMixedUnitFactor.valid,false,'zero conversion factors must fail instead of silently moving quantity');
const invalidMixedUnitCarry=module.reconcileCostCentreInventory(mixedUnitMovements.map(row=>
 row.period===2&&row.productId==='ORE'?{...row,openingQuantity:999}:row),mixedUnitTransfers,3);
assert.equal(invalidMixedUnitCarry.valid,false,'period-two opening quantity must carry forward the prior period closing quantity');
assert.ok(invalidMixedUnitCarry.issues.some(issue=>issue.includes('opening quantity does not equal prior-period closing quantity')));


// Three-period same-product centre round trip: move stock A -> B, return part B -> A,
// then issue the remaining B stock to sales. Internal transfers must conserve group FG.
const roundTripCentreMovements=[
 {period:1,productId:'P1',costCentreId:'CC-A',openingQuantity:100,openingValue:1000,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:90,closingValue:900},
 {period:1,productId:'P1',costCentreId:'CC-B',openingQuantity:0,openingValue:0,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:10,closingValue:100},
 {period:2,productId:'P1',costCentreId:'CC-A',openingQuantity:90,openingValue:900,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:95,closingValue:950},
 {period:2,productId:'P1',costCentreId:'CC-B',openingQuantity:10,openingValue:100,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:5,closingValue:50},
 {period:3,productId:'P1',costCentreId:'CC-A',openingQuantity:95,openingValue:950,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:0,consumptionValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:95,closingValue:950},
 {period:3,productId:'P1',costCentreId:'CC-B',openingQuantity:5,openingValue:50,receiptsQuantity:0,receiptsValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:2,consumptionValue:20,wasteQuantity:0,wasteValue:0,closingQuantity:3,closingValue:30},
];
const roundTripCentreTransfers=[
 {id:'RT-OUT',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
 {id:'RT-RETURN',period:2,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-A',quantity:5,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:50},
];
const roundTripCentreCheck=module.reconcileCostCentreInventory(roundTripCentreMovements,roundTripCentreTransfers,3);
assert.equal(roundTripCentreCheck.valid,true,roundTripCentreCheck.issues.join('; '));
assert.deepEqual([1,2,3].map(period=>roundTripCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.expectedClosingQuantity,0)),[100,100,98],
 'a partial return must restore only the returned quantity; the remaining stock is consumed once in period three');
assert.deepEqual([1,2,3].map(period=>roundTripCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.expectedClosingValue,0)),[1000,1000,980],
 'A -> B and B -> A transfers must not create or destroy group inventory value');
assert.deepEqual([1,2,3].map(period=>roundTripCentreCheck.rows
 .filter(row=>row.period===period).reduce((sum,row)=>sum+row.transferNetValue,0)),[0,0,0],
 'each period transfer must net to zero across centres independently');
const roundTripThreeWay=module.reconcileInventoryThreeWay([1000,1000,980].map((finishedGoods,index)=>{
 const model={rawMaterials:0,workInProgress:0,finishedGoods,otherCurrentAssets:0,currentLiabilities:0,netWorkingCapital:finishedGoods};
 return {period:index+1,model,balanceSheet:{...model},cppCps:{rawMaterials:0,workInProgress:0,finishedGoods,totalInventory:finishedGoods}};
}));
assert.equal(roundTripThreeWay.valid,true,roundTripThreeWay.issues.join('; '));
assert.deepEqual(roundTripThreeWay.rows.map(row=>row.inventoryCppCps),[1000,1000,980]);
assert.deepEqual(roundTripThreeWay.rows.map(row=>row.netWorkingCapitalModel),[1000,1000,980],
 'centre transfers must not add a second FG balance to CPP/CPS or working capital');
const missingRoundTripReturn=module.reconcileCostCentreInventory(
 roundTripCentreMovements.map(row=>row.period===2&&row.costCentreId==='CC-A'?{...row,closingQuantity:90,closingValue:900}:row),
 roundTripCentreTransfers,3);
assert.equal(missingRoundTripReturn.valid,false,'the return transfer must appear in the destination centre closing stock');

console.log('Waste classification, inter-product/cost-centre transfer and three-way inventory reconciliation validations passed.')
