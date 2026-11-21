import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engineSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const engineUrl='data:text/javascript;base64,'+Buffer.from(transpile(engineSource)).toString('base64')
const flowSource=await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts',import.meta.url),'utf8')
const flowUrl='data:text/javascript;base64,'+Buffer.from(transpile(flowSource)).toString('base64')
const source=await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8')
const output=transpile(source).replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl))
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
 {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
]
const base={
 sales:[{productId:'P1',inventoryPolicy:'manual',periods:[
  {period:'1',salesQuantity:80,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
   openingFinishedGoodsQuantity:10,openingFinishedGoodsValue:100,finishedGoodsClosingQuantity:30},
  {period:'2',salesQuantity:90,netUnitPrice:22,salesTaxPercent:0,subsidyPercent:5,subsidyAmount:null,
   openingFinishedGoodsQuantity:30,openingFinishedGoodsValue:300,finishedGoodsClosingQuantity:20},
 ]}],
 productionCosts:[{id:'cost-p1',metadata:{description:'Direct manufacturing cost',currencyCode:'IRR',escalationPercent:null},
  classification:'direct',productId:'P1',basis:'per-unit-output',standardQuantity:2,standardUnitPrice:5,
  standardTotal:10,nominalCapacity:null,fixedPercent:null,variablePercent:null,adjustments:[]}],
}
const result=module.buildProductOperatingSchedule(base,periods,1,'IRR')
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.rows.map(row=>row.productionQuantity),[100,80],
 'Production must equal sales plus closing stock less opening stock')
assert.deepEqual(result.rows.map(row=>row.productionCost),[1000,800])
assert.deepEqual(result.rows.map(row=>row.weightedAverageUnitCost),[10,10])
assert.deepEqual(result.rows.map(row=>row.costOfSales),[800,900])
assert.deepEqual(result.periodRevenue,[1600,2079])
assert.deepEqual(result.periodSubsidyIncome,[0,99])
assert.deepEqual(result.periodCostOfSales,[800,900])
assert.deepEqual(result.annualRevenue,[3679])
assert.deepEqual(result.annualCostOfSales,[1700])
assert.equal(result.totalProductionQuantity,180)
assert.equal(result.totalSalesQuantity,170)
assert.equal(result.totalClosingInventoryValue,500)

const badOpening=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[base.sales[0].periods[0],{...base.sales[0].periods[1],openingFinishedGoodsValue:301}]}]
},periods,1,'IRR')
assert.equal(badOpening.valid,false)
assert.ok(badOpening.issues.some(issue=>issue.includes('must reconcile to the previous period closing inventory')))
const noCost=module.buildProductOperatingSchedule({...base,productionCosts:[]},periods,1,'IRR')
assert.equal(noCost.valid,false)
assert.ok(noCost.issues.some(issue=>issue.includes('requires either a validated direct production-cost basis')))
const unsupportedIndirect=module.buildProductOperatingSchedule({
 ...base,productionCosts:[{...base.productionCosts[0],classification:'indirect',productId:null}]
},periods,1,'IRR')
assert.equal(unsupportedIndirect.valid,false)
assert.ok(unsupportedIndirect.issues.some(issue=>issue.includes('not spread by assumption')))
const vat=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[{...base.sales[0].periods[0],salesTaxPercent:9},base.sales[0].periods[1]]}]
},periods,1,'IRR')
assert.equal(vat.valid,false)
assert.ok(vat.issues.some(issue=>issue.includes('sales tax/VAT')))
const negativeProduction=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[{...base.sales[0].periods[0],salesQuantity:5,finishedGoodsClosingQuantity:0,openingFinishedGoodsQuantity:10},base.sales[0].periods[1]]}]
},periods,1,'IRR')
assert.equal(negativeProduction.valid,false)
assert.ok(negativeProduction.issues.some(issue=>issue.includes('sales exceed opening inventory plus non-negative production')))
const fxCost=module.buildProductOperatingSchedule({
 ...base,productionCosts:[{...base.productionCosts[0],metadata:{...base.productionCosts[0].metadata,currencyCode:'EUR'}}]
},periods,1,'IRR')
assert.equal(fxCost.valid,false)
assert.ok(fxCost.issues.some(issue=>issue.includes('foreign-currency schedule')))
const daysCoverageDraft={
 sales:[{productId:'P1',inventoryPolicy:'comfar-days-coverage',finishedGoodsDaysCoverage:30,
  productionStartPeriod:1,productionEndPeriod:2,periods:[
   {period:'1',salesQuantity:100,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:0,openingFinishedGoodsValue:0,finishedGoodsClosingQuantity:null},
   {period:'2',salesQuantity:100,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:null,openingFinishedGoodsValue:null,finishedGoodsClosingQuantity:null},
   {period:'3',salesQuantity:100*30/90,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:null,openingFinishedGoodsValue:null,finishedGoodsClosingQuantity:null},
  ]}],
 productionCosts:[{id:'cost-p1',metadata:{description:'Direct manufacturing cost',currencyCode:'IRR',escalationPercent:0},
  classification:'direct',productId:'P1',basis:'per-unit-output',standardQuantity:1,standardUnitPrice:10,
  standardTotal:null,nominalCapacity:null,fixedPercent:null,variablePercent:null,adjustments:[]}],
}
const coveragePeriods=[...periods,{index:3,startDate:'2025-07-01',endDate:'2025-09-30',days:92,partial:false}]
const coverageResult=module.buildProductOperatingSchedule(daysCoverageDraft,coveragePeriods,1,'IRR')
assert.equal(coverageResult.valid,true,coverageResult.issues.join('; '))
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.0001,'Expected '+b+', got '+a)
coverageResult.rows.filter(row=>row.productId==='P1').forEach((row,index)=>{
 close(row.closingInventoryQuantity,[100*30/90,100*30/90,0][index])
 // 30 days of cover = 30/90 of the quarter's sales, not 30/360.
 close(row.productionQuantity,[100+100*30/90,100,0][index])
})
const noLiquidation=module.buildProductOperatingSchedule({
 ...daysCoverageDraft,sales:[{...daysCoverageDraft.sales[0],periods:daysCoverageDraft.sales[0].periods.map((row,index)=>index===2?{...row,salesQuantity:0}:row)}]
},coveragePeriods,1,'IRR')
assert.equal(noLiquidation.valid,false)
assert.ok(noLiquidation.issues.some(issue=>issue.includes('unsold finished goods')))

console.log('Product-by-product production, weighted-average inventory, COGS and sales validation passed.')

const flowProduct={
 sales:[{productId:'FLOW-1',inventoryPolicy:'manual',periods:[{
  period:'1',salesQuantity:80,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
  openingFinishedGoodsQuantity:10,openingFinishedGoodsValue:100,finishedGoodsClosingQuantity:30,
  openingRawMaterialQuantity:100,openingRawMaterialValue:1000,openingWipQuantity:0,openingWipMaterialValue:0,openingWipConversionValue:0,
  rawMaterialPurchasesQuantity:100,rawMaterialPurchasesValue:1200,rawMaterialConsumptionQuantity:120,
  unitsStarted:120,unitsCompleted:100,closingWipQuantity:20,materialCompletionPercent:100,
  conversionCompletionPercent:50,conversionCost:500,
 }]}],
 productionCosts:[],
}
const flowSchedule=module.buildProductOperatingSchedule(flowProduct,[periods[0]],1,'IRR')
assert.equal(flowSchedule.valid,true,flowSchedule.issues.join('; '))
assert.equal(flowSchedule.hasInventoryFlow,true)
assert.equal(flowSchedule.rows[0].productionQuantity,100)
assert.equal(flowSchedule.rows[0].completedUnits,100)
assert.equal(flowSchedule.rows[0].productionCost,flowSchedule.rows[0].unitProductionCost*100)
assert.equal(flowSchedule.periodRawMaterialInventoryValue[0],880)
assert.ok(flowSchedule.periodWipInventoryValue[0]>0)
assert.equal(flowSchedule.rows[0].costOfSales,flowSchedule.rows[0].weightedAverageUnitCost*80)
assert.equal(flowSchedule.rows[0].closingInventoryValue,flowSchedule.rows[0].weightedAverageUnitCost*30)
const badFlow=module.buildProductOperatingSchedule({
 ...flowProduct,sales:[{...flowProduct.sales[0],periods:[{...flowProduct.sales[0].periods[0],unitsCompleted:99}]}]
},[periods[0]],1,'IRR')
assert.equal(badFlow.valid,false)
assert.ok(badFlow.issues.some(issue=>issue.includes('completed production quantity must equal')))

console.log('Product schedule posts completed production from raw-material/WIP ledger and recognizes cost of sales only on sales.');
