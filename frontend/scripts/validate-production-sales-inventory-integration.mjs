import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
let benchmark=null
try {
 const fixture=await import('./fixtures/comfar-steel-sales-output.fixture.mjs')
 benchmark=fixture.STEEL_SLAB_EXTRA_DRI_SALES_BENCHMARK
} catch(error) {
 if(error?.code!=='ERR_MODULE_NOT_FOUND')throw error
 console.warn('SKIP: independent COMFAR sales fixture is not present in this repository checkout.')
}

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
  {period:'1',salesQuantity:10,netUnitPrice:100,salesTaxPercent:9,subsidyPercent:2,subsidyAmount:null,finishedGoodsClosingQuantity:1,grossUnitPrice:109,productionActive:true},
  {period:'2025-04-01',salesQuantity:12,netUnitPrice:110,salesTaxPercent:9,subsidyPercent:null,subsidyAmount:30,finishedGoodsClosingQuantity:2,grossUnitPrice:119.9,productionActive:true},
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

const invalidGross=adapter.buildProductionSalesInventorySchedule({
 ...drafts,sales:[{...drafts.sales[0],periods:[{...drafts.sales[0].periods[0],grossUnitPrice:111},drafts.sales[0].periods[1]]}]
},periods,1,{slab:2})
assert.equal(invalidGross.valid,false)
assert.ok(invalidGross.issues.some(issue=>issue.includes('Gross unit price must reconcile')))
const inactiveProduction=adapter.buildProductionSalesInventorySchedule({
 ...drafts,sales:[{...drafts.sales[0],periods:[{...drafts.sales[0].periods[0],productionActive:false},drafts.sales[0].periods[1]]}]
},periods,1,{slab:2})
assert.equal(inactiveProduction.valid,false)
assert.ok(inactiveProduction.issues.some(issue=>issue.includes('Production is marked inactive')))

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
  {...drafts.sales[0].periods[0],salesQuantity:0,finishedGoodsClosingQuantity:0},
  drafts.sales[0].periods[1],
 ]}]
},periods,1,{slab:2})
assert.equal(negativeStock.valid,false)
assert.ok(negativeStock.issues.some(x=>x.includes('Sales exceed opening stock')))


if(benchmark){
const benchmarkPeriods=benchmark.periods.map((year,index)=>({
 index:year,startDate:(2025+index)+'-01-01',endDate:(2025+index)+'-12-31',
 days:((2025+index)%4===0?366:365),partial:false,
}))
const benchmarkSales=benchmark.products.map(product=>({
 productId:product.productId,
 periods:benchmark.periods.map((period,index)=>({
  period:benchmarkPeriods[index].startDate,salesQuantity:product.sales[index],netUnitPrice:product.unitPrice,
  salesTaxPercent:0,subsidyPercent:0,subsidyAmount:null,
  finishedGoodsClosingQuantity:product.closingFinishedGoods[index],
 })),
}))
const benchmarkResult=adapter.buildProductionSalesInventorySchedule({
 sales:benchmarkSales,productionCosts:[]
},benchmarkPeriods,1,Object.fromEntries(benchmark.products.map(product=>[
 product.productId,product.openingFinishedGoods[0]
])))
assert.equal(benchmarkResult.valid,true,benchmarkResult.issues.join('; '))
for(let i=0;i<benchmark.periods.length;i++) {
 const totalRevenue=benchmark.products.reduce((sum,product)=>sum+product.salesRevenue[i],0)
 assert.ok(Math.abs(benchmarkResult.periodRevenue[i]-totalRevenue)<0.02,
  'reference revenue mismatch in project period '+benchmark.periods[i])
 for(const product of benchmark.products) {
  const row=benchmarkResult.rows.find(x=>x.productId===product.productId&&x.period===i+1)
  assert.ok(row,'missing product period row: '+product.productId+'/'+benchmark.periods[i])
  assert.ok(Math.abs(row.productionQuantity-product.production[i])<0.02,
   'reference production mismatch: '+product.productId+'/'+benchmark.periods[i])
  assert.ok(Math.abs(row.salesQuantity-product.sales[i])<0.02,
   'reference sales mismatch: '+product.productId+'/'+benchmark.periods[i])
  assert.ok(Math.abs(row.closingFinishedGoodsQuantity-product.closingFinishedGoods[i])<0.02,
   'reference finished-goods mismatch: '+product.productId+'/'+benchmark.periods[i])
  assert.ok(Math.abs(row.recognizedRevenue-product.salesRevenue[i])<0.02,
   'reference sales revenue mismatch: '+product.productId+'/'+benchmark.periods[i])
 }
}
assert.deepEqual(benchmarkResult.periodRevenue,benchmark.totalSalesRevenue)
console.log('Independent COMFAR output benchmark: periods 5-10 production, sales, finished goods and revenue reconciled.')
}

console.log('Production, sales and finished-goods integration validation passed.')
