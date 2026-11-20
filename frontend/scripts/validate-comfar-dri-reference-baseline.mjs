import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
process.on('uncaughtExceptionMonitor',error=>{console.error('COMFAR DRI reference validation diagnostic:',error?.name,error?.message);console.error((error?.stack??'').split('\\n').slice(-8).join('\\n'))})
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engineSource=transpile(await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8'))
const engineUrl='data:text/javascript;base64,'+Buffer.from(engineSource).toString('base64')
let productSource=transpile(await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8'))
productSource=productSource.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const productModule=await import('data:text/javascript;base64,'+Buffer.from(productSource).toString('base64'))
const engine=await import(engineUrl)
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
 {index:3,startDate:'2027-01-01',endDate:'2027-12-31',days:365,partial:false},
]
const reference={
 source:'Ramhormoz DRP FSv 2, COMFAR III Expert summary sheet, pp. 98-99',
 currency:'MILLION RIAL (M R)',
 years:['First production year (4)','Reference production year (6)','Last production year (23)'],
 sales:[69979000,99970000,99970000],
 factoryCosts:[52084395.28,73374619,73374619],
 administrativeOverhead:[623684.10,733746,733746],
 depreciation:[3604523.88,3604523.88,0],
 marketing:[699790,999700,999700],
 taxableProfit:[12966606.74,21257411.12,24861935],
 corporateTax:[3241651.69,5314352.78,6215483.75],
 netProfit:[9724955.06,15943058.34,18646451.25],
}
const sales=[{productId:'DRI',inventoryPolicy:'manual',periods:[700000,1000000,1000000].map((quantity,index)=>({
 period:String(index+1),salesQuantity:quantity,netUnitPrice:99.97,salesTaxPercent:0,
 subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:0,
 openingFinishedGoodsValue:0,finishedGoodsClosingQuantity:0,
}))}]
const productionCosts=[{
 id:'dri-factory-cost',metadata:{description:'Direct factory cost',currencyCode:'IRR',escalationPercent:0},
 classification:'direct',productId:'DRI',basis:'nominal-capacity',
 standardQuantity:null,standardUnitPrice:null,standardTotal:73374619,
 nominalCapacity:1000000,fixedPercent:null,variablePercent:null,
 adjustments:[{period:'1',quantity:null,unitPrice:null,total:722161.98,fixedPercent:null,variablePercent:null}],
}]
const productSchedule=productModule.buildProductOperatingSchedule({sales,productionCosts:[productionCosts]},periods,1,'IRR')
assert.equal(productSchedule.valid,true,productSchedule.issues.join('; '))
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,
  label+': expected '+expected+', received '+actual)
reference.sales.forEach((value,index)=>close(productSchedule.periodRevenue[index],value,reference.years[index]+' sales revenue'))
reference.factoryCosts.forEach((value,index)=>close(productSchedule.periodCostOfSales[index],value,reference.years[index]+' factory cost'))
const result=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
 annualVariableCost:productSchedule.annualCostOfSales,periodVariableCost:productSchedule.periodCostOfSales,
 annualFixedCost:reference.administrativeOverhead.map((value,index)=>value+reference.marketing[index]),
 annualDepreciation:reference.depreciation,annualFixedInvestment:[0,0,0],
 annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
 annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
 workingCapitalByPeriod:[0,0,0],loans:[],taxLossCarryForwardEnabled:false,discountRatePercent:25,
})
assert.equal(result.valid,true,result.warnings.join('; '))
result.rows.forEach((row,index)=>{
 close(row.revenue,reference.sales[index],reference.years[index]+' revenue')
 close(row.variableCost,reference.factoryCosts[index],reference.years[index]+' factory costs')
 close(row.fixedCost,reference.administrativeOverhead[index]+reference.marketing[index],reference.years[index]+' overhead and marketing')
 close(row.ebit,reference.taxableProfit[index],reference.years[index]+' taxable profit before tax')
 close(row.tax,reference.corporateTax[index],reference.years[index]+' corporate tax')
 close(row.netIncome,reference.netProfit[index],reference.years[index]+' net profit')
})
const sensitivity=engine.calculatePeriodicSensitivityMatrix({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
  annualVariableCost:productSchedule.annualCostOfSales,periodVariableCost:productSchedule.periodCostOfSales,
  annualFixedCost:reference.administrativeOverhead.map((value,index)=>value+reference.marketing[index]),
  annualDepreciation:reference.depreciation,annualFixedInvestment:[0,0,0],
  annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],taxLossCarryForwardEnabled:false,discountRatePercent:25,
},[0,10],[0,10])
assert.equal(sensitivity.length,2)
assert.equal(sensitivity[0].length,2)
close(sensitivity[0][0].npv??NaN,result.npvProject??NaN,'Periodic sensitivity base case')
assert.ok((sensitivity[0][1].npv??-Infinity)>(sensitivity[0][0].npv??Infinity),
  'A positive sales-price shock must improve the base project NPV')
assert.ok((sensitivity[1][0].npv??-Infinity)>(sensitivity[0][0].npv??Infinity),
  'A positive sales-volume shock must improve the positive-contribution project NPV')
const scenarios=engine.calculatePeriodicFinancialScenarios({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
  annualVariableCost:productSchedule.annualCostOfSales,periodVariableCost:productSchedule.periodCostOfSales,
  annualFixedCost:reference.administrativeOverhead.map((value,index)=>value+reference.marketing[index]),
  annualDepreciation:reference.depreciation,annualFixedInvestment:[0,0,0],
  annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],taxLossCarryForwardEnabled:false,discountRatePercent:25,
})
assert.equal(scenarios.base.valid,true)
close(scenarios.base.npvProject??NaN,result.npvProject??NaN,'Periodic base scenario')
assert.ok((scenarios.pessimistic.npvProject??Infinity)<(scenarios.base.npvProject??-Infinity))
assert.ok((scenarios.optimistic.npvProject??-Infinity)>(scenarios.base.npvProject??Infinity))

console.log('COMFAR III DRI reference spot-check passed: product revenue, factory cost, operating overhead, depreciation, taxable profit, 25% corporate tax and net profit for first/reference/last production years.')
