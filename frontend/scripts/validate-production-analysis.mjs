import assert from 'node:assert/strict'
import { analyzeProductionRecord, validateProductionRecord } from '../src/features/production/productionAnalysis.ts'

const base = {
 id:'rec-1', projectId:'project-1', lineId:'line-1', product:'Hot rolled coil',
 periodStart:'2026-01-01', periodEnd:'2026-01-31',
 plannedOutput:1000, totalOutput:950, goodOutput:900, scrapOutput:50,
 matchedMaterialInput:1000, matchedMaterialUnit:'ton',
 materials:[{id:'ore-1',name:'Billet',consumedQuantity:1000,unit:'ton',unitCost:300,currency:'USD'}],
 directLaborCost:10000, energyCost:15000, maintenanceCost:5000, allocatedOverhead:10000,
 currency:'USD', createdAt:'2026-01-31T00:00:00.000Z', updatedAt:'2026-01-31T00:00:00.000Z'
}
assert.deepEqual(validateProductionRecord(base), [])
const result=analyzeProductionRecord(base)
assert.equal(result.materialCost,300000)
assert.equal(result.conversionCost,40000)
assert.equal(result.totalProductionCost,340000)
assert.equal(result.unitCostPerGoodOutput,340000/900)
assert.equal(result.yield,0.9)
assert.equal(result.planAchievement,0.95)
assert.equal(result.qualityRate,900/950)
assert.equal(result.productionVariance,-50)
assert.equal(analyzeProductionRecord({...base,plannedOutput:0}).planAchievement,null)
assert.equal(analyzeProductionRecord({...base,matchedMaterialInput:0}).yield,null)
assert.equal(analyzeProductionRecord({...base,goodOutput:0}).unitCostPerGoodOutput,null)
assert.ok(validateProductionRecord({...base,goodOutput:1000,scrapOutput:50}).length)
assert.ok(validateProductionRecord({...base,materials:[{...base.materials[0],currency:'EUR'}]}).length)
assert.ok(analyzeProductionRecord({...base,goodOutput:1100}).warnings.some(w=>w.includes('۱۰۰٪')))
console.log('Production material, yield, plan achievement and unit-cost tests passed')
