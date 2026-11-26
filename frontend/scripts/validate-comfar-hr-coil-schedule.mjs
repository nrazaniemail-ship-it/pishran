import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

const source=await readFile(new URL('../src/features/projects/comfarProjectInputData.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {COMFAR_PROJECT_INPUTS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const input=COMFAR_PROJECT_INPUTS['comfar-hr-coil-200k']
assert.ok(input,'The 200 kt hot-rolled coil reference project must exist')
assert.equal(input.operatingCostSchedule?.length,15,'Pages 24–27 must cover every operating year from 1405 through 1419')
const byYear=new Map(input.operatingCostSchedule.map(row=>[row.period,row]))
const sum=year=>byYear.get(String(year)).rows.reduce((total,row)=>total+row.amount,0)
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': expected '+expected+', got '+actual)
close(sum(1405),30534338.52,'COMFAR page 24 factory cost 1405')
close(sum(1406),34345881.44,'COMFAR page 24 factory cost 1406')
close(sum(1407),38503928.26,'COMFAR page 24 factory cost 1407')
close(sum(1408),42661975.08,'COMFAR page 24 factory cost 1408')
for(let year=1409;year<=1419;year++)close(sum(year),42604224.43,'COMFAR pages 25–27 factory cost '+year)
close(sum(1408)-sum(1409),57750.65,'Documented source-table difference between page 24 and page 25')
assert.equal(input.productionSalesSchedule.length,15)
for(const row of input.productionSalesSchedule){
 close(row.openingInventory+row.production-row.sales,row.closingInventory,'Production/inventory roll-forward '+row.period,0.02)
 close(row.sales*row.netUnitPrice,row.salesRevenue,'Product sales revenue '+row.period,0.02)
}
assert.equal(input.productionSalesSchedule[0].period,'1405')
assert.equal(input.productionSalesSchedule[0].production,141944.44)
assert.equal(input.productionSalesSchedule[0].sales,140000)
assert.equal(input.productionSalesSchedule.at(-1).period,'1419')
assert.equal(input.productionSalesSchedule.at(-1).sales,200000)
assert.equal(input.financingSchedule.length,7)
close(input.financingSchedule[0].loanDisbursement,3816496,'1403 documented drawdown')
close(input.financingSchedule[1].loanDisbursement,1794355,'1404 documented drawdown')
close(input.financingSchedule[1].closingDebt,8909484.06,'1404 closing debt')
const engineSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const engineUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(engineSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const flowSource=await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts',import.meta.url),'utf8')
const flowUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(flowSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const controlSource=await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts',import.meta.url),'utf8')
const controlUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(controlSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const operatingSource=await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8')
let operatingJs=ts.transpileModule(operatingSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
operatingJs=operatingJs.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
 .replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl))
 .replace("'./inventoryControlLedgers'",JSON.stringify(controlUrl))
const operating=await import('data:text/javascript;base64,'+Buffer.from(operatingJs).toString('base64'))
const periods=Array.from({length:17},(_,index)=>({index:index+1,startDate:'2024-01-01',endDate:'2024-12-31',days:365,partial:false}))
const mainProductId='hr-coil-main'
const salesPeriods=[
 {period:'1',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 {period:'2',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 ...input.productionSalesSchedule.map(row=>({...row,period:String(Number(row.period)-1403+1)})),
].map(row=>({
 period:row.period,salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,salesTaxPercent:0,
 subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:row.openingInventory,
 openingFinishedGoodsValue:row.openingInventory===0?0:null,finishedGoodsClosingQuantity:row.closingInventory,
 rawMaterialPurchasesQuantity:null,rawMaterialPurchasesValue:null,rawMaterialConsumptionQuantity:null,
 normalRawMaterialWasteQuantity:null,abnormalRawMaterialWasteQuantity:null,unitsStarted:row.production,
 unitsCompleted:row.production,closingWipQuantity:null,materialCompletionPercent:null,
 conversionCompletionPercent:null,conversionCost:null,openingRawMaterialQuantity:null,
 openingRawMaterialValue:null,openingWipQuantity:null,openingWipMaterialValue:null,openingWipConversionValue:null,
}))
const productionCosts=input.operatingCostSchedule[0].rows.map((sourceRow,rowIndex)=>({
 id:'hr-coil-cost-'+rowIndex,
 metadata:{description:sourceRow.name,currencyCode:'IRR',marketOrigin:'local',escalationPercent:0,remarks:'COMFAR pp.24-27',costCentreId:null},
 classification:'direct',productId:mainProductId,basis:'period-adjustments',
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,
 fixedPercent:null,variablePercent:null,
 adjustments:input.operatingCostSchedule.map(period=>({period:String(Number(period.period)-1403+1),
  quantity:null,unitPrice:null,total:period.rows[rowIndex].amount,fixedPercent:null,variablePercent:null})),
}))
const productSchedule=operating.buildProductOperatingSchedule({
 sales:[{productId:mainProductId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,
  productionStartPeriod:3,productionEndPeriod:17,periods:salesPeriods}],
 productionCosts,
},periods,3,'IRR')
assert.equal(productSchedule.valid,true,productSchedule.issues.join('; '))
assert.equal(productSchedule.rows.find(row=>row.period===3)?.productionQuantity,141944.44)
close(productSchedule.periodRevenue[2],42980000,'Product engine 1405 net sales')
close(productSchedule.periodRevenue[7],61400000,'Product engine 1410 net sales')
close(productSchedule.periodCostOfSales[2],30116060.85,'Product engine 1405 weighted-average cost of sales',0.02)
close(productSchedule.rows.find(row=>row.period===3)?.productionCost,30534338.52,'Product engine 1405 detailed factory production cost')
console.log('Hot-rolled coil product-by-product operating schedule validation passed.')
console.log('Hot-rolled coil COMFAR annual sales, factory-cost and debt-source schedules passed independent source-data checks.')
