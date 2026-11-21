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

const extended = ts.transpileModule(source + "\n\nexport type FinishedGoodsPeriodInput = {\n  openingQuantity: number\n  openingValue: number\n  currentGoodOutput: number\n  currentProductionCost: number\n  salesQuantity: number\n}\n\nexport type FinishedGoodsPeriodResult = {\n  cpp: number\n  currentUnitProductionCost: number | null\n  availableQuantity: number\n  availableValue: number\n  weightedAverageUnitCost: number | null\n  cps: number\n  closingQuantity: number\n  closingInventoryValue: number\n  warnings: string[]\n}\n\n/** Periodic finished-goods roll-forward using an explicitly selected weighted-average policy. */\nexport function calculateFinishedGoodsPeriod(input: FinishedGoodsPeriodInput): FinishedGoodsPeriodResult {\n  const values = [input.openingQuantity, input.openingValue, input.currentGoodOutput, input.currentProductionCost, input.salesQuantity]\n  if (!values.every(finiteNonNegative)) throw new Error('مقادیر موجودی محصول، تولید، فروش و بهای تولید باید محدود و نامنفی باشند')\n  if (input.openingQuantity === 0 && input.openingValue > 1e-9) throw new Error('ارزش موجودی اول دوره بدون مقدار موجودی قابل قبول نیست')\n  if (input.currentGoodOutput === 0 && input.currentProductionCost > 1e-9) throw new Error('بهای تولید دوره بدون محصول سالم قابل تخصیص نیست')\n  const availableQuantity = input.openingQuantity + input.currentGoodOutput\n  const availableValue = input.openingValue + input.currentProductionCost\n  const weightedAverageUnitCost = availableQuantity > 0 ? availableValue / availableQuantity : null\n  const warnings: string[] = []\n  if (input.salesQuantity > availableQuantity + 1e-9) warnings.push('مقدار فروش از موجودی قابل فروش بیشتر است؛ کسری محصول نهایی وجود دارد.')\n  const cps = weightedAverageUnitCost === null ? 0 : input.salesQuantity * weightedAverageUnitCost\n  const closingQuantity = availableQuantity - input.salesQuantity\n  const closingInventoryValue = weightedAverageUnitCost === null ? 0 : closingQuantity * weightedAverageUnitCost\n  return { cpp: input.currentProductionCost, currentUnitProductionCost: input.currentGoodOutput > 0 ? input.currentProductionCost / input.currentGoodOutput : null, availableQuantity, availableValue, weightedAverageUnitCost, cps, closingQuantity, closingInventoryValue, warnings }\n}\n", { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { calculateFinishedGoodsPeriod } = await import('data:text/javascript;base64,' + Buffer.from(extended).toString('base64'))
const fg = calculateFinishedGoodsPeriod({openingQuantity:100,openingValue:20000,currentGoodOutput:900,currentProductionCost:340000,salesQuantity:800})
assert.equal(fg.cpp,340000)
assert.equal(fg.availableQuantity,1000)
assert.equal(fg.availableValue,360000)
assert.equal(fg.weightedAverageUnitCost,360)
assert.equal(fg.cps,288000)
assert.equal(fg.closingQuantity,200)
assert.equal(fg.closingInventoryValue,72000)
assert.ok(calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:0,currentGoodOutput:10,currentProductionCost:100,salesQuantity:11}).warnings.length)
assert.throws(()=>calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:1,currentGoodOutput:0,currentProductionCost:0,salesQuantity:0}))
assert.throws(()=>calculateFinishedGoodsPeriod({openingQuantity:0,openingValue:0,currentGoodOutput:0,currentProductionCost:1,salesQuantity:0}))
console.log('Finished goods roll-forward, CPP, CPS and closing inventory tests passed')

