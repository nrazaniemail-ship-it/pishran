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
const inventoryDrafts={...drafts,productionCosts:[],sales:[{...drafts.sales[0],openingFinishedGoodsValue:200,inventoryValuationMethod:'weighted-average'}]}
const result=adapter.buildProductionSalesInventorySchedule(inventoryDrafts,periods,1,{slab:2})
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.periodSalesQuantity,[10,12])
assert.deepEqual(result.periodProductionQuantity,[9,13])
assert.deepEqual(result.closingFinishedGoodsQuantityByProduct.slab,[1,2])
assert.equal(result.periodRevenue[0],1020)
assert.equal(result.periodRevenue[1],1350)
assert.equal(result.annualRevenue[0],2370)
assert.equal(result.rows[0].salesTax,90)

const invalidGross=adapter.buildProductionSalesInventorySchedule({
 ...inventoryDrafts,sales:[{...inventoryDrafts.sales[0],periods:[{...inventoryDrafts.sales[0].periods[0],grossUnitPrice:111},inventoryDrafts.sales[0].periods[1]]}]
},periods,1,{slab:2})
assert.equal(invalidGross.valid,false)
assert.ok(invalidGross.issues.some(issue=>issue.includes('Gross unit price must reconcile')))
const inactiveProduction=adapter.buildProductionSalesInventorySchedule({
 ...inventoryDrafts,sales:[{...inventoryDrafts.sales[0],periods:[{...inventoryDrafts.sales[0].periods[0],productionActive:false},inventoryDrafts.sales[0].periods[1]]}]
},periods,1,{slab:2})
assert.equal(inactiveProduction.valid,false)
assert.ok(inactiveProduction.issues.some(issue=>issue.includes('Production is marked inactive')))

const unvaluedInventory=adapter.buildProductionSalesInventorySchedule(drafts,periods,1,{slab:2})
assert.equal(unvaluedInventory.valid,false)
assert.ok(unvaluedInventory.issues.some(issue=>issue.includes('Explicit opening finished-goods carrying value is required')))

const indirectCostDrafts={
 ...inventoryDrafts,
 productionCosts:[{...drafts.productionCosts[0],classification:'indirect',allocationKeyId:null}],
}
const unallocatedIndirectCost=adapter.buildProductionSalesInventorySchedule(indirectCostDrafts,periods,1,{slab:2})
assert.equal(unallocatedIndirectCost.valid,false)
assert.ok(unallocatedIndirectCost.issues.some(issue=>issue.includes('expanded by a validated user-defined allocation key')))

const zeroInventoryCostDrafts={
 ...drafts,
 sales:[{...drafts.sales[0],openingFinishedGoodsQuantity:0,openingFinishedGoodsValue:0,inventoryValuationMethod:null,periods:drafts.sales[0].periods.map(row=>({...row,finishedGoodsClosingQuantity:0}))}],
}
const costSchedule=adapter.buildProductionSalesInventorySchedule(zeroInventoryCostDrafts,periods,1,{slab:0})
assert.equal(costSchedule.valid,true,costSchedule.issues.join('; '))
assert.equal(costSchedule.annualFixedCost[0],0)
assert.equal(costSchedule.annualVariableCost[0],0)
assert.ok(costSchedule.annualCostOfGoodsSold[0]>0)
assert.ok(costSchedule.periodCostOfGoodsSold.every(value=>value>0))
assert.deepEqual(costSchedule.periodClosingFinishedGoodsValue,[0,0])

const bound=adapter.bindProductionSalesToPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:360,cashFlowTiming:'period-end',
 annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[25],
 annualEquityContributions:[0],workingCapitalByPeriod:[0,0],loans:[],
},zeroInventoryCostDrafts,{slab:0})
assert.equal(bound.valid,true,bound.issues.join('; '))
assert.deepEqual(bound.financeInput.annualRevenue,[2370])
assert.deepEqual(bound.financeInput.annualCostOfGoodsSold,costSchedule.annualCostOfGoodsSold)
assert.deepEqual(bound.financeInput.finishedGoodsInventoryValueByPeriod,[0,0])

const missingOpening=adapter.buildProductionSalesInventorySchedule(inventoryDrafts,periods,1,{})
assert.equal(missingOpening.valid,false)
assert.ok(missingOpening.issues.some(x=>x.includes('Explicit opening finished-goods')))

const missingPeriod=adapter.buildProductionSalesInventorySchedule({
 ...inventoryDrafts,sales:[{...inventoryDrafts.sales[0],periods:[inventoryDrafts.sales[0].periods[0]]}]
},periods,1,{slab:2})
assert.equal(missingPeriod.valid,false)
assert.ok(missingPeriod.issues.some(x=>x.includes('every period')))

const negativeStock=adapter.buildProductionSalesInventorySchedule({
 ...inventoryDrafts,sales:[{...inventoryDrafts.sales[0],periods:[
  {...inventoryDrafts.sales[0].periods[0],salesQuantity:0,finishedGoodsClosingQuantity:0},
  inventoryDrafts.sales[0].periods[1],
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


const weightedAverage=adapter.calculateFinishedGoodsWeightedAverage({
 method:'weighted-average',openingQuantity:10,openingValue:1000,
 productionQuantity:10,productionCost:1400,salesQuantity:12,closingQuantity:8,
})
assert.equal(weightedAverage.valid,true,weightedAverage.issues.join('; '))
assert.equal(weightedAverage.availableQuantity,20)
assert.equal(weightedAverage.availableValue,2400)
assert.equal(weightedAverage.weightedAverageUnitCost,120)
assert.equal(weightedAverage.costOfGoodsSold,1440)
assert.equal(weightedAverage.closingInventoryValue,960)
assert.ok(Math.abs(weightedAverage.reconciliationDifference)<1e-8)

const zeroCostFlow=adapter.calculateFinishedGoodsWeightedAverage({
 method:'weighted-average',openingQuantity:0,openingValue:0,
 productionQuantity:0,productionCost:0,salesQuantity:0,closingQuantity:0,
})
assert.equal(zeroCostFlow.valid,true,zeroCostFlow.issues.join('; '))
assert.equal(zeroCostFlow.weightedAverageUnitCost,0)

const mismatchedCostFlow=adapter.calculateFinishedGoodsWeightedAverage({
 method:'weighted-average',openingQuantity:10,openingValue:1000,
 productionQuantity:10,productionCost:1400,salesQuantity:11,closingQuantity:8,
})
assert.equal(mismatchedCostFlow.valid,false)
assert.ok(mismatchedCostFlow.issues.some(x=>x.includes('quantities do not reconcile')))

const missingValueCostFlow=adapter.calculateFinishedGoodsWeightedAverage({
 method:'weighted-average',openingQuantity:10,openingValue:-1,
 productionQuantity:10,productionCost:1400,salesQuantity:12,closingQuantity:8,
})
assert.equal(missingValueCostFlow.valid,false)
assert.ok(missingValueCostFlow.issues.some(x=>x.includes('finite and non-negative')))

const valueWithoutQuantity=adapter.calculateFinishedGoodsWeightedAverage({
 method:'weighted-average',openingQuantity:0,openingValue:500,
 productionQuantity:0,productionCost:0,salesQuantity:0,closingQuantity:0,
})
assert.equal(valueWithoutQuantity.valid,false)
assert.ok(valueWithoutQuantity.issues.some(x=>x.includes('without available quantity')))
console.log('Finished-goods weighted-average cost-flow tests passed.')


const weightedAverageSchedule=adapter.calculateFinishedGoodsWeightedAverageSchedule({
 openingQuantity:10,openingValue:1000,
 periods:[
  {period:'P1',productionQuantity:10,productionCost:1400,salesQuantity:12,closingQuantity:8},
  {period:'P2',productionQuantity:12,productionCost:1800,salesQuantity:15,closingQuantity:5},
 ]
})
assert.equal(weightedAverageSchedule.valid,true,weightedAverageSchedule.issues.join('; '))
assert.equal(weightedAverageSchedule.periods.length,2)
assert.equal(weightedAverageSchedule.periods[0].weightedAverageUnitCost,120)
assert.equal(weightedAverageSchedule.periods[0].costOfGoodsSold,1440)
assert.equal(weightedAverageSchedule.periods[0].closingInventoryValue,960)
assert.equal(weightedAverageSchedule.periods[1].openingQuantity,8)
assert.equal(weightedAverageSchedule.periods[1].openingValue,960)
assert.equal(weightedAverageSchedule.periods[1].availableQuantity,20)
assert.equal(weightedAverageSchedule.periods[1].availableValue,2760)
assert.equal(weightedAverageSchedule.periods[1].weightedAverageUnitCost,138)
assert.equal(weightedAverageSchedule.periods[1].costOfGoodsSold,2070)
assert.equal(weightedAverageSchedule.periods[1].closingInventoryValue,690)
assert.equal(weightedAverageSchedule.closingQuantity,5)
assert.equal(weightedAverageSchedule.closingValue,690)

const brokenCarryForward=adapter.calculateFinishedGoodsWeightedAverageSchedule({
 openingQuantity:10,openingValue:1000,
 periods:[
  {period:'P1',productionQuantity:10,productionCost:1400,salesQuantity:12,closingQuantity:8},
  {period:'P1',productionQuantity:12,productionCost:1800,salesQuantity:15,closingQuantity:5},
 ]
})
assert.equal(brokenCarryForward.valid,false)
assert.ok(brokenCarryForward.issues.some(issue=>issue.includes('non-empty and unique')))
console.log('Finished-goods multi-period weighted-average roll-forward tests passed.')


const fifoSchedule=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:10,openingValue:1000,
 periods:[
  {period:'P1',productionQuantity:10,productionCost:1400,salesQuantity:12,closingQuantity:8},
  {period:'P2',productionQuantity:12,productionCost:1800,salesQuantity:15,closingQuantity:5},
 ]
})
assert.equal(fifoSchedule.valid,true,fifoSchedule.issues.join('; '))
assert.equal(fifoSchedule.periods.length,2)
assert.equal(fifoSchedule.periods[0].costOfGoodsSold,1280)
assert.equal(fifoSchedule.periods[0].closingInventoryValue,1120)
assert.equal(fifoSchedule.periods[1].openingQuantity,8)
assert.equal(fifoSchedule.periods[1].openingValue,1120)
assert.equal(fifoSchedule.periods[1].costOfGoodsSold,2170)
assert.equal(fifoSchedule.periods[1].closingInventoryValue,750)
assert.equal(fifoSchedule.closingQuantity,5)
assert.equal(fifoSchedule.closingValue,750)

const fifoDuplicatePeriods=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:1,openingValue:100,
 periods:[
  {period:'P1',productionQuantity:0,productionCost:0,salesQuantity:0,closingQuantity:1},
  {period:'P1',productionQuantity:0,productionCost:0,salesQuantity:0,closingQuantity:1},
 ]
})
assert.equal(fifoDuplicatePeriods.valid,false)
assert.ok(fifoDuplicatePeriods.issues.some(issue=>issue.includes('non-empty and unique')))

const fifoInsufficientLayers=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:1,openingValue:100,
 periods:[{period:'P1',productionQuantity:0,productionCost:0,salesQuantity:2,closingQuantity:0}]
})
assert.equal(fifoInsufficientLayers.valid,false)
assert.ok(fifoInsufficientLayers.issues.some(issue=>issue.includes('quantities do not reconcile')))

const fifoValueWithoutQuantity=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:0,openingValue:0,
 periods:[{period:'P1',productionQuantity:0,productionCost:500,salesQuantity:0,closingQuantity:0}]
})
assert.equal(fifoValueWithoutQuantity.valid,false)
assert.ok(fifoValueWithoutQuantity.issues.some(issue=>issue.includes('without production quantity')))
console.log('Finished-goods multi-period FIFO layer valuation tests passed.')


const fifoOpeningValueWithoutQuantity=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:0,openingValue:250,
 periods:[{period:'P1',productionQuantity:0,productionCost:0,salesQuantity:0,closingQuantity:0}]
})
assert.equal(fifoOpeningValueWithoutQuantity.valid,false)
assert.ok(fifoOpeningValueWithoutQuantity.issues.some(issue=>issue.includes('Opening finished-goods value exists without opening quantity')))

const fifoMissingPeriodArray=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:0,openingValue:0,periods:null
})
assert.equal(fifoMissingPeriodArray.valid,false)
assert.ok(fifoMissingPeriodArray.issues.some(issue=>issue.includes('At least one finished-goods FIFO period')))

const fifoMalformedPeriod=adapter.calculateFinishedGoodsFifoSchedule({
 openingQuantity:0,openingValue:0,periods:[null]
})
assert.equal(fifoMalformedPeriod.valid,false)
assert.ok(fifoMalformedPeriod.issues.some(issue=>issue.includes('period keys must be non-empty and unique')))

const weightedMissingPeriodArray=adapter.calculateFinishedGoodsWeightedAverageSchedule({
 openingQuantity:0,openingValue:0,periods:null
})
assert.equal(weightedMissingPeriodArray.valid,false)
assert.ok(weightedMissingPeriodArray.issues.some(issue=>issue.includes('At least one finished-goods valuation period')))

const weightedMalformedPeriod=adapter.calculateFinishedGoodsWeightedAverageSchedule({
 openingQuantity:0,openingValue:0,periods:[null]
})
assert.equal(weightedMalformedPeriod.valid,false)
assert.ok(weightedMalformedPeriod.issues.some(issue=>issue.includes('period keys must be non-empty and unique')))
console.log('Finished-goods malformed-input and opening-value guard tests passed.')
