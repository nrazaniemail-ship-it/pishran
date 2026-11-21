import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/features/production/productionAnalysis.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { analyzeProductionRecord, validateProductionRecord } = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

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
assert.ok(analyzeProductionRecord({...base,totalOutput:1150,goodOutput:1100}).warnings.some(w=>w.includes('۱۰۰٪')))
console.log('Production material, yield, plan achievement and unit-cost tests passed')

const extended = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { calculateFinishedGoodsPeriod } = await import('data:text/javascript;base64,' + Buffer.from(extended).toString('base64'))
const fg = calculateFinishedGoodsPeriod({openingQuantity:100,openingValue:20000,currentGoodOutput:900,currentProductionCost:340000,salesQuantity:800})
assert.equal(fg.cpp,340000); assert.equal(fg.availableQuantity,1000); assert.equal(fg.availableValue,360000)
assert.equal(fg.weightedAverageUnitCost,360); assert.equal(fg.cps,288000); assert.equal(fg.closingQuantity,200); assert.equal(fg.closingInventoryValue,72000)
assert.ok(calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:0,currentGoodOutput:10,currentProductionCost:100,salesQuantity:11}).warnings.length)
assert.throws(()=>calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:1,currentGoodOutput:0,currentProductionCost:0,salesQuantity:0}))
assert.throws(()=>calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:0,currentGoodOutput:0,currentProductionCost:1,salesQuantity:0}))
console.log('Finished goods roll-forward, CPP, CPS and closing inventory tests passed')

const portfolio = calculateFinishedGoodsPortfolio([
 {productId:'coil-a',currency:'IRR',openingQuantity:100,openingValue:20000,currentGoodOutput:900,currentProductionCost:340000,salesQuantity:800},
 {productId:'coil-b',currency:'IRR',openingQuantity:50,openingValue:15000,currentGoodOutput:450,currentProductionCost:225000,salesQuantity:400},
])
assert.equal(portfolio[0].cps,288000)
assert.equal(portfolio[0].closingInventoryValue,72000)
assert.equal(portfolio[1].cps,192000)
assert.equal(portfolio[1].closingInventoryValue,48000)
assert.deepEqual(summarizeFinishedGoodsPortfolio(portfolio,'IRR'),{cpp:565000,cps:480000,closingQuantity:300,closingInventoryValue:120000})
assert.throws(()=>calculateFinishedGoodsPortfolio([{...portfolio[0],productId:''}]))
assert.throws(()=>summarizeFinishedGoodsPortfolio(portfolio,'USD'))
console.log('Finished goods multi-product independent valuation tests passed')

const crc200Schedule = [
 {openingStock:0,salesQuantity:160000,closingStockRequirement:2222.22,expectedProduction:162222.22},
 {openingStock:2222.22,salesQuantity:180000,closingStockRequirement:2500,expectedProduction:180277.78},
 {openingStock:2500,salesQuantity:200000,closingStockRequirement:2777.78,expectedProduction:200277.78},
 {openingStock:2777.78,salesQuantity:200000,closingStockRequirement:2777.78,expectedProduction:200000},
]
for (const row of crc200Schedule) assert.ok(Math.abs(calculateComfarProductionRequirement(row).productionQuantity-row.expectedProduction)<0.011)
assert.deepEqual(calculateProductIncomeStatementLine({productId:'coil-a',currency:'IRR',salesRevenue:500000,cpp:340000,openingInventoryValue:20000,closingInventoryValue:72000}),{productId:'coil-a',currency:'IRR',salesRevenue:500000,cpp:340000,cps:288000,grossProfit:212000,closingInventoryAsset:72000})
assert.throws(()=>calculateComfarProductionRequirement({openingStock:10,salesQuantity:0,closingStockRequirement:0}))
console.log('COMFAR production stock equation and product P&L bridge tests passed')
