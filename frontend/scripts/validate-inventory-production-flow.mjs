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
 rawMaterialConsumptionQuantity:[120,80],rawMaterialWasteQuantity:[0,0],
 openingWipQuantity:0,openingWipMaterialValue:0,openingWipConversionValue:0,
 unitsStarted:[120,80],unitsCompleted:[100,100],closingWipQuantity:[20,0],
 materialCompletionPercent:[100,100],conversionCompletionPercent:[50,100],
 conversionCost:[500,600],
}
const result=mod.buildInventoryFlowSchedule(input)
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
assert.equal(mod.buildInventoryFlowSchedule({...input,rawMaterialWasteQuantity:undefined}).valid,false,
 'Missing normal-waste quantities must block inventory valuation rather than default to zero')
assert.equal(mod.buildInventoryFlowSchedule({...input,rawMaterialWasteQuantity:[0]}).valid,false,
 'Normal-waste quantities must cover every project period')
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
