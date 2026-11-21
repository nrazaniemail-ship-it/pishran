import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const waste=module.validateWasteLedger([
 {id:'N1',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:2,unitCost:10,amount:20},
 {id:'A1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:1,unitCost:10,amount:10},
],2)
assert.equal(waste.valid,true,waste.issues.join('; '))
assert.deepEqual(waste.normalWasteAbsorbedByPeriod,[20,0])
assert.deepEqual(waste.abnormalWasteExpenseByPeriod,[10,0])
assert.equal(module.validateWasteLedger([{id:'bad',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:2,unitCost:10,amount:19}],1).valid,false)
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
const overdrawCentre=module.reconcileCostCentreInventory(centreMovements.map(row=>row.period===1&&row.productId==='P1'?{...row,closingQuantity:0,closingValue:0}:row),[
 {id:'CC-T5',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:25,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:250},
],2)
assert.equal(overdrawCentre.valid,false,'a transfer that exceeds source centre stock must fail the centre roll-forward')
const stageRow=(period,inventoryStage,productId,openingQuantity,openingValue,receiptsQuantity,receiptsValue,productionQuantity,productionValue,consumptionQuantity,consumptionValue,closingQuantity,closingValue)=>({
 period,inventoryStage,productId,costCentreId:'CC-'+inventoryStage,
 openingQuantity,openingValue,receiptsQuantity,receiptsValue,transfersInQuantity:0,transfersInValue:0,transfersOutQuantity:0,transfersOutValue:0,productionQuantity,productionValue,
 consumptionQuantity,consumptionValue,wasteQuantity:0,wasteValue:0,closingQuantity,closingValue,
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
const productEngineRows=[
 {period:1,productId:'RM-A',rawMaterials:30,workInProgress:0,finishedGoods:0},
 {period:1,productId:'RM-B',rawMaterials:70,workInProgress:0,finishedGoods:0},
 {period:2,productId:'RM-A',rawMaterials:20,workInProgress:0,finishedGoods:0},
 {period:2,productId:'RM-B',rawMaterials:60,workInProgress:0,finishedGoods:0},
]
const productStageMatched=module.reconcileStageInventoryMovements(multiCentreRaw,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:0,finishedGoods:0},
],2,0.01,[],productEngineRows)
assert.equal(productStageMatched.valid,true,productStageMatched.issues.join('; '))
const productStageSwapped=module.reconcileStageInventoryMovements(multiCentreRaw,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:0,finishedGoods:0},
],2,0.01,[],productEngineRows.map(row=>row.productId==='RM-A'?{...row,rawMaterials:row.period===1?70:60}:{...row,rawMaterials:row.period===1?30:20}))
assert.equal(productStageSwapped.valid,false,'matching aggregate totals must not hide inventory assigned to the wrong product')
assert.ok(productStageSwapped.issues.some(issue=>issue.includes('product RM-A closing inventory does not match')))
const productStageMissingProduct=module.reconcileStageInventoryMovements(multiCentreRaw.filter(row=>row.productId!=='RM-B'),[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:0,finishedGoods:0},
],2,0.01,[],productEngineRows)
assert.equal(productStageMissingProduct.valid,false,'non-zero product balances cannot be omitted from the detailed stage ledger')
const duplicateProductEngineRows=module.reconcileStageInventoryMovements(multiCentreRaw,[
 {period:1,rawMaterials:100,workInProgress:0,finishedGoods:0},
 {period:2,rawMaterials:80,workInProgress:0,finishedGoods:0},
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
const blankStageTransferDraft=module.reconcileStageInventoryMovements([],[
 {period:1,rawMaterials:0,workInProgress:0,finishedGoods:0},
],1,0.01,[{id:'',period:null,sourceStage:null,destinationStage:null,sourceProductId:'',destinationProductId:'',
 sourceCostCentreId:'',destinationCostCentreId:'',quantity:null,sourceUnit:'',destinationUnit:'',conversionFactor:null,
 transferValue:null,sourceReference:'',sourceVerified:false}])
assert.equal(blankStageTransferDraft.valid,true,'an untouched blank transfer form row must not create a false validation failure')
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
console.log('Waste classification, inter-product/cost-centre transfer and three-way inventory reconciliation validations passed.')
