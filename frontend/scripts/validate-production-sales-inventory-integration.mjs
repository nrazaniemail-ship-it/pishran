import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function transpile(path) {
  const source=await readFile(new URL(path,import.meta.url),'utf8')
  return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
}
const helpOutput=await transpile('../src/features/projects/projectModelHelpFormulaRules.ts')
const engineOutput=await transpile('../src/features/steel/periodicFinancialEngine.ts')
const helpUrl='data:text/javascript;base64,'+Buffer.from(helpOutput).toString('base64')
const engineUrl='data:text/javascript;base64,'+Buffer.from(engineOutput).toString('base64')
let adapterOutput=await transpile('../src/features/projects/productionSalesInventoryIntegration.ts')
adapterOutput=adapterOutput.replace("'./projectModelHelpFormulaRules'",JSON.stringify(helpUrl))
adapterOutput=adapterOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const adapter=await import('data:text/javascript;base64,'+Buffer.from(adapterOutput).toString('base64'))

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
 {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
]
const drafts={
 sales:[{productId:'slab',periods:[
  {period:'1',salesQuantity:10,netUnitPrice:100,salesTaxPercent:9,subsidyPercent:2,subsidyAmount:null,finishedGoodsClosingQuantity:1},
  {period:'2025-04-01',salesQuantity:12,netUnitPrice:110,salesTaxPercent:9,subsidyPercent:null,subsidyAmount:30,finishedGoodsClosingQuantity:2},
 ]}],
 productionCosts:[{id:'power',metadata:{},classification:'direct',productId:'slab',basis:'nominal-capacity',
  standardQuantity:2,standardUnitPrice:5,standardTotal:10,nominalCapacity:20,fixedPercent:20,variablePercent:80,adjustments:[]}]
}
const result=adapter.buildProductionSalesInventorySchedule(drafts,periods,1,{slab:2})
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.periodSalesQuantity,[10,12])
assert.deepEqual(result.periodProductionQuantity,[9,13])
assert.deepEqual(result.closingFinishedGoodsQuantityByProduct.slab,[1,2])
assert.equal(result.periodRevenue[0],1020)
assert.equal(result.periodRevenue[1],1350)
assert.equal(result.annualRevenue[0],2370)
assert.ok(Math.abs(result.annualFixedCost[0]-1.0055555555555555)<1e-8)
assert.ok(Math.abs(result.annualVariableCost[0]-8.8)<1e-8)
assert.equal(result.rows[0].salesTax,90)

const bound=adapter.bindProductionSalesToPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:360,cashFlowTiming:'period-end',
 annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[25],
 annualEquityContributions:[0],workingCapitalByPeriod:[0,0],loans:[],
},drafts,{slab:2})
assert.equal(bound.valid,true,bound.issues.join('; '))
assert.deepEqual(bound.financeInput.annualRevenue,[2370])

const missingOpening=adapter.buildProductionSalesInventorySchedule(drafts,periods,1,{})
assert.equal(missingOpening.valid,false)
assert.ok(missingOpening.issues.some(x=>x.includes('Explicit opening finished-goods')))

const missingPeriod=adapter.buildProductionSalesInventorySchedule({
 ...drafts,sales:[{...drafts.sales[0],periods:[drafts.sales[0].periods[0]]}]
},periods,1,{slab:2})
assert.equal(missingPeriod.valid,false)
assert.ok(missingPeriod.issues.some(x=>x.includes('every period')))

const negativeStock=adapter.buildProductionSalesInventorySchedule({
 ...drafts,sales:[{...drafts.sales[0],periods:[
  {...drafts.sales[0].periods[0],salesQuantity:20,finishedGoodsClosingQuantity:0},
  drafts.sales[0].periods[1],
 ]}]
},periods,1,{slab:2})
assert.equal(negativeStock.valid,false)
assert.ok(negativeStock.issues.some(x=>x.includes('Sales exceed opening stock')))

console.log('Production, sales and finished-goods integration validation passed.')
