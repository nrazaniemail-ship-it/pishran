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
assert.equal(transfers.netQuantityByProductCentre['P1@MELT'],-50)
assert.equal(transfers.netQuantityByProductCentre['P2@CAST'],50)
const converted=module.validateProductionTransfers([
 {id:'T2',period:1,sourceProductId:'COIL',destinationProductId:'SHEET',sourceCostCentreId:'ROLL',destinationCostCentreId:'FINISH',quantity:1000,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0.001,costAmount:250000},
],1)
assert.equal(converted.valid,true,converted.issues.join('; '))
assert.equal(converted.netQuantityByProductCentre['COIL@ROLL'],-1000)
assert.equal(converted.netQuantityByProductCentre['SHEET@FINISH'],1)
assert.equal(module.validateProductionTransfers([{id:'bad-factor',period:1,sourceProductId:'A',destinationProductId:'B',sourceCostCentreId:'X',destinationCostCentreId:'Y',quantity:1,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0,costAmount:1}],1).valid,false)

assert.equal(transfers.totalSourceValue,transfers.totalDestinationValue)
assert.equal(module.validateProductionTransfers([{id:'T1',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'A',destinationCostCentreId:'A',quantity:1,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:1},{id:'T1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'A',destinationCostCentreId:'B',quantity:1,costAmount:1}],1).valid,false)
const p={period:1,model:{rawMaterials:100,workInProgress:50,finishedGoods:150,otherCurrentAssets:40,currentLiabilities:60,netWorkingCapital:280},balanceSheet:{rawMaterials:100,workInProgress:50,finishedGoods:150,otherCurrentAssets:40,currentLiabilities:60,netWorkingCapital:280},cppCps:{rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300}}
const reconciled=module.reconcileInventoryThreeWay([p])
assert.equal(reconciled.valid,true,reconciled.issues.join('; '))
const mismatch=module.reconcileInventoryThreeWay([{...p,balanceSheet:{...p.balanceSheet,finishedGoods:149}}])
assert.equal(mismatch.valid,false)
assert.ok(mismatch.issues.some(x=>x.includes('model vs balance sheet')))
const reference=module.reconcileInventoryReference([
 {id:'R1',period:1,sourceDocument:'COMFAR III report.pdf',schedule:'Working capital requirements',page:'246',currency:'IRR',rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450},
], [{period:1,rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450}],0.01,'IRR')
assert.equal(reference.valid,true,reference.issues.join('; '))
assert.equal(reference.rows[0].status,'matched')
const incompleteReference=module.reconcileInventoryReference([
 {id:'R2',period:1,sourceDocument:'COMFAR III report.pdf',schedule:'Working capital requirements',page:'246',currency:'IRR',rawMaterials:100,workInProgress:null,finishedGoods:150,totalInventory:null,cpp:null,cps:null},
], [{period:1,rawMaterials:100,workInProgress:50,finishedGoods:150,totalInventory:300,cpp:500,cps:450}],0.01,'IRR')
assert.equal(incompleteReference.valid,false)
assert.equal(incompleteReference.rows[0].status,'incomplete')
assert.equal(module.reconcileInventoryReference([{id:'R3',period:1,sourceDocument:'x',schedule:'y',page:'1',currency:'USD',rawMaterials:1,workInProgress:1,finishedGoods:1,totalInventory:3,cpp:4,cps:3}], [{period:1,rawMaterials:1,workInProgress:1,finishedGoods:1,totalInventory:3,cpp:4,cps:3}],0.01,'IRR').valid,false)
// Extracted aggregate inventory values from COMFAR III SARZAMIN tank-project report, printed pp.32-35.
const comfarInventory=[
 [3,236787.88,32],[4,264340.10,32],[5,292726.11,33],[6,321112.12,33],
 [7,320973.15,33],[8,320973.15,33],[9,320973.15,33],[10,320973.15,34],
 [11,320973.15,34],[12,320973.15,34],[13,320973.15,34],[14,320973.15,34],
 [15,320973.15,35],[16,320973.15,35],[17,320973.15,35],
].map(([period,totalInventory,page])=>({id:'SARZAMIN-'+period,period,sourceDocument:'COMFAR III - 001 - جدول خلاصه عملکرد پروژه.pdf',schedule:'سرمایه در گردش خالص مورد نیاز - کل / کل موجودی کالا',page:String(page),currency:'میلیون ریال',rawMaterials:null,workInProgress:null,finishedGoods:null,totalInventory,cpp:null,cps:null}))
const comfarModel=comfarInventory.map(row=>({period:row.period,rawMaterials:0,workInProgress:0,finishedGoods:0,totalInventory:row.totalInventory,cpp:0,cps:0}))
const aggregateOnly=module.reconcileInventoryReference(comfarInventory,comfarModel,0.01,'میلیون ریال')
assert.equal(aggregateOnly.valid,false,'Aggregate inventory alone must not falsely certify component inventory or CPP/CPS reconciliation')
assert.equal(aggregateOnly.rows.length,15)
assert.ok(aggregateOnly.rows.every(row=>row.status==='incomplete'&&row.missingFields.includes('rawMaterials')&&row.missingFields.includes('cpp')))
const changedTotal=module.reconcileInventoryReference([comfarInventory[0]],[{...comfarModel[0],totalInventory:236787.89}],0.000001,'میلیون ریال')
assert.equal(changedTotal.rows[0].status,'mismatch','Aggregate inventory mismatch must remain visible even when component evidence is incomplete')
console.log('Waste classification, inter-product/cost-centre transfer and three-way inventory reconciliation validations passed.')
