import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { jalaliAnnualPeriods, jalaliPeriod, jalaliYearEndDay } from './comfar-jalali-calendar.mjs'

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const root=new URL('../src/',import.meta.url)
const engineSource=await readFile(new URL('features/steel/periodicFinancialEngine.ts',root),'utf8')
const engineUrl='data:text/javascript;base64,'+Buffer.from(transpile(engineSource)).toString('base64')
const flowSource=await readFile(new URL('features/projects/inventoryProductionFlow.ts',root),'utf8')
const flowUrl='data:text/javascript;base64,'+Buffer.from(transpile(flowSource)).toString('base64')
const controlSource=transpile(await readFile(new URL('features/projects/inventoryControlLedgers.ts',root),'utf8'))
const controlUrl='data:text/javascript;base64,'+Buffer.from(controlSource).toString('base64')
const productSource=transpile(await readFile(new URL('features/projects/productOperatingSchedule.ts',root),'utf8'))
const productModule=await import('data:text/javascript;base64,'+Buffer.from(productSource
 .replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
 .replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl))
 .replace("'./inventoryControlLedgers'",JSON.stringify(controlUrl))).toString('base64'))
const inputSource=transpile(await readFile(new URL('features/projects/comfarProjectInputData.ts',root),'utf8'))
const inputsModule=await import('data:text/javascript;base64,'+Buffer.from(inputSource).toString('base64'))
const engine=await import(engineUrl)
const source=inputsModule.COMFAR_PROJECT_INPUTS['comfar-cold-coil-200k']
assert.ok(source?.operatingCostSchedule,'Cold-rolling COMFAR annual factory OPEX schedule must be connected to project inputs')
assert.equal(source.operatingCostSchedule.length,15,'COMFAR operating-cost detail must cover 1403-1417 exactly')
assert.deepEqual(source.operatingCostSchedule.map(row=>row.period),Array.from({length:15},(_,i)=>String(1403+i)))

const reference=JSON.parse(await readFile(new URL('../src/features/steel/comfar-three-project-periodic-reference.json',import.meta.url),'utf8'))
const referenceOpex=new Map(reference.rows
 .filter(row=>row.projectId==='comfar-cold-coil-200k'&&row.statement==='incomeStatement'&&row.lineItem==='operatingCost')
 .map(row=>[row.period,row.value]))
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,
 label+': expected '+expected+', received '+actual)

const periods=[
 jalaliPeriod(1,1401,7,1,1401,12,jalaliYearEndDay(1401),false),
 ...jalaliAnnualPeriods(1402,1417,2),
]
assert.equal(periods.length,17)
const productId='comfar-cold-coil-200k-main-product'
const preOperating=Array.from({length:2},(_,index)=>({
 period:String(index+1),salesQuantity:0,netUnitPrice:0,salesTaxPercent:0,
 subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:0,
 openingFinishedGoodsValue:0,finishedGoodsClosingQuantity:0,
}))
const salesPeriods=[
 ...preOperating,
 ...source.productionSalesSchedule.map(row=>({
  period:String(Number(row.period)-1401+1),salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,
  salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
  openingFinishedGoodsQuantity:row.openingInventory,
  openingFinishedGoodsValue:row.openingInventory===0?0:null,
  finishedGoodsClosingQuantity:row.closingInventory,
 })),
]
const productionCosts=source.operatingCostSchedule[0].rows.map((row,rowIndex)=>({
 id:'cold-rolling-source-opex-'+rowIndex,
 metadata:{description:row.name,currencyCode:'IRR',escalationPercent:0},
 classification:'direct',productId,basis:'period-adjustments',
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,
 fixedPercent:null,variablePercent:null,
 adjustments:source.operatingCostSchedule.map(period=>({
  period:String(Number(period.period)-1401+1),quantity:null,unitPrice:null,
  total:period.rows[rowIndex]?.amount??null,fixedPercent:null,variablePercent:null,
 })),
}))
const productSchedule=productModule.buildProductOperatingSchedule({
 sales:[{productId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,
  productionStartPeriod:3,productionEndPeriod:17,periods:salesPeriods}],
 productionCosts,
},periods,3,'IRR')
assert.equal(productSchedule.valid,true,productSchedule.issues.join('; '))
assert.equal(productSchedule.rows.length,17)
assert.equal(productSchedule.periodRevenue.length,17)
assert.equal(productSchedule.periodCostOfSales.length,17)

const page24Depreciation=[
 1195263.55,1195263.55,1195263.55,1194168.55,1176286.05,
 1160046.05,1160046.05,1160046.05,1160046.05,1160046.05,
 240604.35,210364.35,210364.35,180312.30,0,0,
]
const page24Interest=[
 1366423.77,953724.34,412759.57,0,0,0,0,0,0,0,0,0,0,0,0,
]
const page24FinishedProductsCost=[
 56107661.15,62061461.94,67893526.79,67478739.45,67460856.95,
 67444616.95,67444616.95,67444616.95,67444616.95,67444616.95,
 66525175.25,66494935.25,66494935.25,66464883.20,66284570.90,
]
const page55DomesticProductionCost=[
 55374018.97,61334349.16,67166414.02,66752559.45,66734676.95,
 66718436.95,66718436.95,66718436.95,66718436.95,66525175.25,
 66494935.25,66494935.25,66464883.20,66284570.90,66284570.90,
]
const page55ForeignProductionCost=[...Array(9).fill(726180),...Array(6).fill(0)]
assert.equal(page24Depreciation.length,15)
assert.equal(page24Interest.length,15)
assert.equal(page24FinishedProductsCost.length,15)
assert.equal(page55DomesticProductionCost.length,15)
assert.equal(page55ForeignProductionCost.length,15)

const periodFactoryOpex=Array(periods.length).fill(0)
const periodInventoryChange=Array(periods.length).fill(0)
const periodDepreciation=Array(periods.length).fill(0)
const periodMarketing=Array(periods.length).fill(0)
const annualFactoryOpex=Array(periods.length).fill(0)
const annualDepreciation=Array(periods.length).fill(0)
const annualMarketing=Array(periods.length).fill(0)
for(let i=0;i<periods.length;i++){
 const productRow=productSchedule.rows.find(row=>row.period===i+1)
 if(productRow){
  periodFactoryOpex[i]=productRow.productionCost
  periodInventoryChange[i]=productRow.closingInventoryValue-productRow.openingInventoryValue
 }
 const fiscalIndex=engine.fiscalYearIndexForPeriod(periods[i],periods,3)
 if(fiscalIndex>=0)annualFactoryOpex[fiscalIndex]+=periodFactoryOpex[i]
}
for(let i=0;i<15;i++){
 const periodIndex=i+2
 periodDepreciation[periodIndex]=page24Depreciation[i]
 periodMarketing[periodIndex]=79000
 const fiscalIndex=engine.fiscalYearIndexForPeriod(periods[periodIndex],periods,3)
 annualDepreciation[fiscalIndex]+=page24Depreciation[i]
 annualMarketing[fiscalIndex]+=79000
 const sourcePeriod=source.operatingCostSchedule[i]
 const detailedTotal=sourcePeriod.rows.reduce((sum,row)=>sum+row.amount,0)
 close(detailedTotal,referenceOpex.get(sourcePeriod.period),'Detailed factory OPEX vs COMFAR page 24-27 operating-cost total '+sourcePeriod.period,0.02)
 close(periodFactoryOpex[periodIndex],detailedTotal,'Product production cost must preserve factory OPEX '+sourcePeriod.period,0.02)
 const allInCost=detailedTotal+page24Depreciation[i]+page24Interest[i]+79000
 close(allInCost,page24FinishedProductsCost[i],'COMFAR page-24 all-in finished-product cost bridge '+sourcePeriod.period,0.02)
}

const loanRows=Array.from({length:17},(_,index)=>({
 period:index+1,drawdown:0,openingBalance:0,periodRatePercent:0,interestExpense:0,
 capitalizedInterest:0,financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,
 principal:0,closingBalance:0,debtService:0,
}))
const sourceDebt=[
 {period:2,drawdown:5000000,openingBalance:0,capitalizedInterest:350000,closingBalance:5350000},
 {period:3,drawdown:0,openingBalance:5350000,interestExpense:1366423.77,principal:1327878.79,closingBalance:4022121.21},
 {period:4,drawdown:0,openingBalance:4022121.21,interestExpense:953724.34,principal:1740578.22,closingBalance:2281542.99},
 {period:5,drawdown:0,openingBalance:2281542.99,interestExpense:412759.57,principal:2281542.99,closingBalance:0},
]
for(const debt of sourceDebt){
 const row=loanRows[debt.period-1]
 Object.assign(row,debt)
 row.debtService=row.interestExpense+row.principal
}
const engineResult=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:3,constructionPeriodCount:2,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
 annualVariableCost:annualFactoryOpex,periodVariableCost:periodFactoryOpex,
 periodInventoryChange,periodCostOfGoodsSold:productSchedule.periodCostOfSales,
 annualFixedCost:annualMarketing,annualDepreciation,periodDepreciationSchedule:periodDepreciation,
 annualFixedInvestment:Array(17).fill(0),annualPreOperatingCost:Array(17).fill(0),
 annualMaintenanceCapex:Array(17).fill(0),annualTaxRates:Array(17).fill(0),
 annualEquityContributions:Array(17).fill(0),workingCapitalByPeriod:Array(17).fill(0),
 loans:[{id:'comfar-cold-rolling-debt',input:{annualRatePercent:0,drawdowns:Array(17).fill(0),
  repaymentMethod:'bullet',repaymentStartPeriod:1,gracePeriods:0,termPeriods:17,capitalizeInterest:false}}],
 loanScheduleOverrides:{'comfar-cold-rolling-debt':loanRows},
})
assert.equal(engineResult.valid,true,engineResult.warnings.join('; '))
assert.equal(engineResult.rows.length,17)
for(let i=0;i<17;i++){
 close(engineResult.rows[i].productionCost,periodFactoryOpex[i]+periodMarketing[i],
  'Engine production-cost line (factory OPEX + direct marketing), period '+(i+1),0.02)
 close(engineResult.rows[i].costOfGoodsSold,productSchedule.periodCostOfSales[i]+periodMarketing[i]-periodInventoryChange[i],
  'Engine COGS roll-forward, period '+(i+1),0.02)
 close(engineResult.rows[i].depreciation,periodDepreciation[i],
  'Engine depreciation, period '+(i+1),0.02)
}
for(let i=0;i<15;i++){
 const periodIndex=i+2
 const year=String(1403+i)
 const engineRow=engineResult.rows[periodIndex]
 const comfarPage55=page55DomesticProductionCost[i]+page55ForeignProductionCost[i]
 const page24VsPage55=comfarPage55-page24FinishedProductsCost[i]
 console.log([
  year,
  'factoryOPEX='+periodFactoryOpex[periodIndex].toFixed(2),
  'productionCost='+engineRow.productionCost.toFixed(2),
  'finishedGoodsCOGS='+engineRow.costOfGoodsSold.toFixed(2),
  'COMFAR24AllIn='+page24FinishedProductsCost[i].toFixed(2),
  'COMFAR55DomesticPlusForeign='+comfarPage55.toFixed(2),
  'p55MinusP24='+page24VsPage55.toFixed(2),
 ].join(' | '))
}
const expectedPage55Variance=[-7462.18,-932.78,-932.77,0,0,0,0,0,0,0,0,0,0,0,0]
for(let i=0;i<15;i++){
 close(page55DomesticProductionCost[i]+page55ForeignProductionCost[i]-page24FinishedProductsCost[i],
  expectedPage55Variance[i],'Independent COMFAR page 55 vs page 24 source difference '+(1403+i),0.02)
}
console.log('COMFAR cold-rolling OPEX source schedule, weighted-average COGS and calculateIntegratedPeriodicFinance path passed. Page-55/page-24 source variances are reported explicitly; engine parity with COMFAR all-in product cost is not asserted.')
