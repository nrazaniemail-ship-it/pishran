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
console.log('Waste classification, inter-product/cost-centre transfer and three-way inventory reconciliation validations passed.')
