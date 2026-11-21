import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const root = new URL('../src/features/', import.meta.url)
async function transpile(path) {
 const source = await readFile(new URL(path, root), 'utf8')
 return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
}
const analysisOutput = await transpile('production/productionAnalysis.ts')
const analysisUrl = 'data:text/javascript;base64,' + Buffer.from(analysisOutput).toString('base64')
const integrationOutput = (await transpile('projects/productionFinanceIntegration.ts')).replace("'../production/productionAnalysis'", JSON.stringify(analysisUrl))
const integrationUrl = 'data:text/javascript;base64,' + Buffer.from(integrationOutput).toString('base64')
const { analyzeProductionRecord } = await import(analysisUrl)
const { buildProductionFinanceBridge } = await import(integrationUrl)
const record = (overrides={}) => ({id:'r1',projectId:'p1',lineId:'l1',product:'coil',periodStart:'2026-01-01',periodEnd:'2026-01-31',plannedOutput:100,totalOutput:100,goodOutput:100,scrapOutput:0,matchedMaterialInput:100,matchedMaterialUnit:'t',materials:[{id:'m1',name:'billet',consumedQuantity:100,unit:'t',unitCost:2,currency:'USD'}],directLaborCost:10,energyCost:10,maintenanceCost:0,allocatedOverhead:0,currency:'USD',createdAt:'2026-01-31',updatedAt:'2026-01-31',salesQuantity:80,...overrides})
const periods=[{index:1,startDate:'2026-01-01',endDate:'2026-01-31',days:31,partial:false},{index:2,startDate:'2026-02-01',endDate:'2026-02-28',days:28,partial:false}]
let result=buildProductionFinanceBridge([record()], 'p1', periods, 'USD')
assert.equal(result.valid,true)
assert.equal(result.periods[0].cpp,220)
assert.equal(result.periods[0].cps,176)
assert.equal(result.periods[0].closingFinishedGoodsQuantity,20)
assert.equal(result.periods[0].closingFinishedGoodsValue,44)
assert.equal(result.periods[1].closingFinishedGoodsValue,44)
assert.equal(result.periods[1].products[0].openingInventoryValue,44)
assert.equal(buildProductionFinanceBridge([record({projectId:'p2'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({currency:'EUR',materials:[{id:'m1',name:'billet',consumedQuantity:100,unit:'t',unitCost:2,currency:'EUR'}]})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record(),record({id:'r2',periodStart:'2026-01-20',periodEnd:'2026-01-31'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({salesQuantity:101})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({periodStart:'2025-12-01',periodEnd:'2026-01-31'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({finishedGoodsOpeningQuantity:1,finishedGoodsOpeningValue:999})],'p1',periods,'USD').valid,true)
const twoPeriod=[record(),record({id:'r2',periodStart:'2026-02-01',periodEnd:'2026-02-28',salesQuantity:10,finishedGoodsOpeningQuantity:20,finishedGoodsOpeningValue:44})]
result=buildProductionFinanceBridge(twoPeriod,'p1',periods,'USD')
assert.equal(result.valid,true)
assert.equal(result.periods[1].products[0].closingFinishedGoodsValue,242)
assert.equal(analyzeProductionRecord(record()).totalProductionCost,220)
console.log('Production-finance bridge tests passed: project scope, exact period mapping, overlap, currency, product inventory roll-forward, sales, CPP/CPS and carry-forward.')
