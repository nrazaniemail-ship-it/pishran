import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const mod=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7, 'Expected '+b+', got '+a)
const input={
 openingRawMaterialQuantity:100,openingRawMaterialValue:1000,
 rawMaterialPurchasesQuantity:[100,50],rawMaterialPurchasesValue:[1200,650],
 rawMaterialConsumptionQuantity:[120,80],normalRawMaterialWasteQuantity:[0,0],abnormalRawMaterialWasteQuantity:[0,0],
 openingWipQuantity:0,openingWipMaterialValue:0,openingWipConversionValue:0,
 unitsStarted:[120,80],unitsCompleted:[100,100],closingWipQuantity:[20,0],
 materialCompletionPercent:[100,100],conversionCompletionPercent:[50,100],
 conversionCost:[500,600],
}
const result=mod.buildInventoryFlowSchedule(input)
const bridgeEvidence=[1,2].map(period=>({
 period,sourceReference:'PRODUCTION-ORDER-'+period,sourceVerified:true,
 rawMaterialsToWip:{sourceProductId:'ORE',destinationProductId:'DRI',sourceCostCentreId:'RM-01',destinationCostCentreId:'DRI-01',sourceUnit:'tonne',destinationUnit:'tonne',conversionFactor:1},
 wipToFinishedGoods:{sourceProductId:'DRI',destinationProductId:'SLAB',sourceCostCentreId:'DRI-01',destinationCostCentreId:'CAST-01',sourceUnit:'tonne',destinationUnit:'tonne',conversionFactor:1},
}))
const bridge=mod.buildProductionStageTransferDrafts(result,bridgeEvidence)
assert.equal(bridge.length,4,'Each period must produce at most one raw-to-WIP and one WIP-to-finished-goods transfer.')
assert.deepEqual(bridge.map(row=>row.id),mod.buildProductionStageTransferDrafts(result,bridgeEvidence).map(row=>row.id),
 'Generated transfer identifiers must be deterministic for safe replay.')
for(let index=0;index<result.rows.length;index++){
 const flow=result.rows[index]
 const rawToWip=bridge.find(row=>row.period===flow.period&&row.sourceStage==='raw-materials')
 const wipToFinished=bridge.find(row=>row.period===flow.period&&row.destinationStage==='finished-goods')
 assert.ok(rawToWip&&wipToFinished)
 close(rawToWip.quantity,flow.consumptionQuantity+flow.normalWasteQuantity)
 close(rawToWip.transferValue,flow.consumptionValue+flow.normalWasteValue)
 close(wipToFinished.quantity,flow.unitsCompleted)
 close(wipToFinished.transferValue,flow.completedProductionCost)
 assert.equal(rawToWip.sourceReference,'PRODUCTION-ORDER-'+flow.period)
 assert.equal(wipToFinished.sourceVerified,true)
}
assert.throws(()=>mod.buildProductionStageTransferDrafts(result,[]),/required for every production period/)
assert.throws(()=>mod.buildProductionStageTransferDrafts(result,bridgeEvidence.map(row=>({...row,sourceVerified:false}))),/verified source reference/)
assert.throws(()=>mod.buildProductionStageTransferDrafts(result,bridgeEvidence.map(row=>({...row,rawMaterialsToWip:{...row.rawMaterialsToWip,conversionFactor:0}}))),/positive conversion-factor/)
assert.throws(()=>mod.buildProductionStageTransferDrafts(result,[bridgeEvidence[0],bridgeEvidence[0]]),/duplicate period/)
const abnormalBridgeSchedule=mod.buildInventoryFlowSchedule({...input,normalRawMaterialWasteQuantity:[2,0],abnormalRawMaterialWasteQuantity:[3,0]})
assert.equal(abnormalBridgeSchedule.valid,true,abnormalBridgeSchedule.issues.join('; '))
const abnormalBridge=mod.buildProductionStageTransferDrafts(abnormalBridgeSchedule,bridgeEvidence)
const abnormalRawTransfer=abnormalBridge.find(row=>row.period===1&&row.sourceStage==='raw-materials')
close(abnormalRawTransfer.quantity,abnormalBridgeSchedule.rows[0].consumptionQuantity+2,
 'Abnormal waste quantity must not be transferred into WIP.')
close(abnormalRawTransfer.transferValue,abnormalBridgeSchedule.rows[0].consumptionValue+abnormalBridgeSchedule.rows[0].normalWasteValue,
 'Abnormal waste value must be excluded from the WIP transfer.')
assert.ok(abnormalBridgeSchedule.rows[0].abnormalWasteValue>0)
assert.equal(result.valid,true,result.issues.join('; '))
const [p1,p2]=result.rows
close(p1.weightedAverageRawMaterialUnitCost,11)
close(p1.consumptionValue,1320)
close(p1.closingRawMaterialQuantity,80)
close(p1.closingRawMaterialValue,880)
close(p1.wipQuantityVariance,0)
close(p1.materialCostPerEquivalentUnit,11)
close(p1.conversionCostPerEquivalentUnit,500/110)
close(p1.closingWipMaterialValue,220)
close(p1.closingWipConversionValue,500/110*10)
close(p1.completedProductionCost,1320+500-(220+500/110*10))
close(p2.openingRawMaterialQuantity,80)
close(p2.openingRawMaterialValue,880)
close(p2.openingWipQuantity,20)
close(p2.openingWipMaterialValue,220)
close(p2.openingWipConversionValue,500/110*10)
close(p2.closingRawMaterialQuantity,50)
close(p2.closingRawMaterialValue,50*(1530/130))
close(p2.closingWipQuantity,0)
close(p2.closingWipValue,0)
close(p2.wipQuantityVariance,0)
close(p2.materialValueVariance,0)
close(p2.wipValueVariance,0)
close(result.totalPurchasesValue,1850)
close(result.totalMaterialConsumptionValue,p1.consumptionValue+p2.consumptionValue)
assert.equal(mod.buildInventoryFlowSchedule({...input,rawMaterialConsumptionQuantity:[201,80]}).valid,false)
const abnormalWaste=mod.buildInventoryFlowSchedule({...input,normalRawMaterialWasteQuantity:[0,0],abnormalRawMaterialWasteQuantity:[10,0]})
assert.equal(abnormalWaste.valid,true,abnormalWaste.issues.join('; '))
close(abnormalWaste.rows[0].abnormalWasteValue,110)
close(abnormalWaste.rows[0].normalWasteValue,0)
close(abnormalWaste.rows[0].completedProductionMaterialCost,1320-220)
close(abnormalWaste.rows[0].closingRawMaterialQuantity,70)
close(abnormalWaste.rows[0].closingRawMaterialValue,770)
assert.equal(mod.buildInventoryFlowSchedule({...input,normalRawMaterialWasteQuantity:[0,0],abnormalRawMaterialWasteQuantity:[201,0]}).valid,false,
 'Abnormal waste must not exceed available raw-material stock')
assert.equal(mod.buildInventoryFlowSchedule({...input,normalRawMaterialWasteQuantity:undefined}).valid,false,
 'Missing normal-waste quantities must block inventory valuation rather than default to zero')
assert.equal(mod.buildInventoryFlowSchedule({...input,normalRawMaterialWasteQuantity:[0]}).valid,false,
 'Normal-waste quantities must cover every project period')
assert.equal(mod.buildInventoryFlowSchedule({...input,abnormalRawMaterialWasteQuantity:undefined}).valid,false,
 'Abnormal-waste quantities must be explicit for every period')
assert.equal(mod.buildInventoryFlowSchedule({...input,abnormalRawMaterialWasteQuantity:[0]}).valid,false,
 'Abnormal-waste quantities must cover every project period')
assert.equal(mod.buildInventoryFlowSchedule({...input,closingWipQuantity:[21,0]}).valid,false)
assert.equal(mod.buildInventoryFlowSchedule({...input,conversionCompletionPercent:[101,100]}).valid,false)
assert.equal(mod.buildInventoryFlowSchedule({...input,rawMaterialPurchasesValue:[null,650]}).valid,false)
// Orphaned inventory value must not be silently carried at zero quantity / zero unit cost.
assert.equal(mod.buildInventoryFlowSchedule({...input,openingRawMaterialQuantity:0,openingRawMaterialValue:1}).valid,false,
 'Positive opening raw-material value without physical quantity must block valuation')
assert.equal(mod.buildInventoryFlowSchedule({...input,openingWipQuantity:0,openingWipMaterialValue:1}).valid,false,
 'Positive opening WIP value without WIP quantity must block process costing')
assert.equal(mod.buildInventoryFlowSchedule({...input,openingWipQuantity:0,openingWipConversionValue:1}).valid,false,
 'Positive opening WIP conversion value without WIP quantity must block process costing')
assert.equal(mod.buildInventoryFlowSchedule({...input,openingRawMaterialQuantity:0,openingRawMaterialValue:0,
 rawMaterialPurchasesQuantity:[0,50],rawMaterialPurchasesValue:[1,650]}).valid,false,
 'Purchase value without available raw-material quantity must not be valued at zero unit cost')
console.log('Raw-material purchases/issues, WIP equivalent-unit valuation and transfer-to-finished-production reconciliations passed.')
