import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { calculateComfarPeriodCountIrr, jalaliAnnualPeriods, jalaliPeriod, jalaliYearEndDay } from './comfar-jalali-calendar.mjs'

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

const periods=jalaliAnnualPeriods(1403,1417,1)
assert.equal(periods.length,15)
const productId='comfar-cold-coil-200k-main-product'
const salesPeriods=source.productionSalesSchedule.map(row=>({
 period:String(Number(row.period)-1403+1),salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,
 salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
 openingFinishedGoodsQuantity:row.openingInventory,
 openingFinishedGoodsValue:row.openingInventory===0?0:null,
 finishedGoodsClosingQuantity:row.closingInventory,
}))
const productionCosts=source.operatingCostSchedule[0].rows.map((row,rowIndex)=>({
 id:'cold-rolling-source-opex-'+rowIndex,
 metadata:{description:row.name,currencyCode:'IRR',escalationPercent:0},
 classification:'direct',productId,basis:'period-adjustments',
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,
 fixedPercent:null,variablePercent:null,
 adjustments:source.operatingCostSchedule.map(period=>({
  period:String(Number(period.period)-1403+1),quantity:null,unitPrice:null,
  total:period.rows[rowIndex]?.amount??null,fixedPercent:null,variablePercent:null,
 })),
}))
const productSchedule=productModule.buildProductOperatingSchedule({
 sales:[{productId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,
  productionStartPeriod:1,productionEndPeriod:15,periods:salesPeriods}],
 productionCosts,
},periods,3,'IRR')
assert.equal(productSchedule.valid,true,productSchedule.issues.join('; '))
assert.equal(productSchedule.rows.length,15)
assert.equal(productSchedule.periodRevenue.length,15)
assert.equal(productSchedule.periodCostOfSales.length,15)

const page24Depreciation=[
 1195263.55,1195263.55,1195263.55,1194168.55,1176286.05,
 1160046.05,1160046.05,1160046.05,1160046.05,
 240604.35,210364.35,210364.35,180312.30,0,0,
]
const page24Interest=[
 1366423.77,953724.34,412759.57,0,0,0,0,0,0,0,0,0,0,0,0,
]
const page24FinishedProductsCost=[
 56107661.15,62061461.94,67893526.79,67478739.45,
 67460856.95,67444616.95,67444616.95,67444616.95,67444616.95,
 66525175.25,66494935.25,66494935.25,66464883.20,66284570.90,66284570.90,
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
const annualFactoryOpex=Array(periods.length).fill(0)
const annualDepreciation=Array(periods.length).fill(0)
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
 const periodIndex=i
 periodDepreciation[periodIndex]=page24Depreciation[i]
 const fiscalIndex=engine.fiscalYearIndexForPeriod(periods[periodIndex],periods,3)
 annualDepreciation[fiscalIndex]+=page24Depreciation[i]
 const sourcePeriod=source.operatingCostSchedule[i]
 const detailedTotal=sourcePeriod.rows.reduce((sum,row)=>sum+row.amount,0)
 close(detailedTotal,referenceOpex.get(sourcePeriod.period),'Detailed factory OPEX vs COMFAR page 24-27 operating-cost total '+sourcePeriod.period,0.02)
 close(periodFactoryOpex[periodIndex],detailedTotal,'Product production cost must preserve factory OPEX '+sourcePeriod.period,0.02)
 const allInCost=detailedTotal+page24Depreciation[i]+page24Interest[i]+79000
 close(allInCost,page24FinishedProductsCost[i],'COMFAR page-24 all-in finished-product cost bridge '+sourcePeriod.period,0.02)
}

const loanRows=Array.from({length:periods.length},(_,index)=>({
 period:index+1,drawdown:0,openingBalance:0,periodRatePercent:0,interestExpense:0,
 capitalizedInterest:0,financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,
 principal:0,closingBalance:0,debtService:0,
}))
const sourceDebt=[
 {period:1,drawdown:0,openingBalance:5350000,interestExpense:1366423.77,principal:1327878.79,closingBalance:4022121.21},
 {period:2,drawdown:0,openingBalance:4022121.21,interestExpense:953724.34,principal:1740578.22,closingBalance:2281542.99},
 {period:3,drawdown:0,openingBalance:2281542.99,interestExpense:412759.57,principal:2281542.99,closingBalance:0},
]
for(const debt of sourceDebt){
 const row=loanRows[debt.period-1]
 Object.assign(row,debt)
 row.debtService=row.interestExpense+row.principal
}
const engineResult=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:3,constructionPeriodCount:0,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
 annualVariableCost:annualFactoryOpex,periodVariableCost:periodFactoryOpex,
 periodInventoryChange,periodCostOfGoodsSold:productSchedule.periodCostOfSales,
 annualFixedCost:Array(periods.length).fill(0),annualDepreciation,periodDepreciationSchedule:periodDepreciation,
 annualFixedInvestment:Array(periods.length).fill(0),annualPreOperatingCost:Array(periods.length).fill(0),
 annualMaintenanceCapex:Array(periods.length).fill(0),annualTaxRates:Array(periods.length).fill(0),
 annualEquityContributions:Array(periods.length).fill(0),workingCapitalByPeriod:Array(periods.length).fill(0),
 loans:[{id:'comfar-cold-rolling-debt',input:{annualRatePercent:0,drawdowns:Array(periods.length).fill(0),
  repaymentMethod:'bullet',repaymentStartPeriod:1,gracePeriods:0,termPeriods:periods.length,capitalizeInterest:false}}],
 loanScheduleOverrides:{'comfar-cold-rolling-debt':loanRows},
})
assert.equal(engineResult.valid,true,engineResult.warnings.join('; '))
assert.equal(engineResult.rows.length,15)
for(let i=0;i<periods.length;i++){
 close(engineResult.rows[i].productionCost,periodFactoryOpex[i],
  'Engine production-cost line (factory OPEX + direct marketing), period '+(i+1),0.02)
 close(engineResult.rows[i].costOfGoodsSold,productSchedule.periodCostOfSales[i],
  'Engine COGS roll-forward, period '+(i+1),0.02)
 close(engineResult.rows[i].depreciation,periodDepreciation[i],
  'Engine depreciation, period '+(i+1),0.02)
}
for(let i=0;i<15;i++){
 const periodIndex=i
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


/**
 * Full operating-period finance diagnostic using the actual 5% tax assumption,
 * the report's 1403-1405 loan amortization (pp. 48-49), working-capital balances,
 * and cash-flow/tax reference values (pp. 57-61). The construction periods are
 * intentionally not invented; therefore this operating-horizon NPV/IRR is not
 * asserted equal to the report's whole-project NPV/IRR.
 */
const reportTax=[354990.05,451973.54,555370.30,576063.03,576957.15,2888845.76,2888845.76,2888845.76,2888845.76,3118706.19,3126266.19,3126266.19,3133779.20,3178857.27,3178857.27]
const reportNetCashFlow=[6912999.97,10453127.90,11876468.51,12139399.36,12138471.95,9826583.34,9826583.34,9826583.34,9826583.34,9596722.91,9589162.91,9589162.91,9581649.90,9536571.83,9536571.83]
assert.equal(reportTax.length,15)
assert.equal(reportNetCashFlow.length,15)
const workingCapitalBalances=source.workingCapital.map(row=>row.inventory+row.cash)
assert.equal(workingCapitalBalances.length,15,'COMFAR working-capital schedule must cover 1403-1417')
const fullFinanceResult=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:3,constructionPeriodCount:0,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:productSchedule.annualRevenue,periodRevenue:productSchedule.periodRevenue,
 annualVariableCost:annualFactoryOpex,periodVariableCost:periodFactoryOpex,
 periodInventoryChange,periodCostOfGoodsSold:productSchedule.periodCostOfSales.map(value=>value+79000),
 annualFixedCost:Array(periods.length).fill(79000),annualDepreciation,periodDepreciationSchedule:periodDepreciation,
 annualFixedInvestment:Array(periods.length).fill(0),annualPreOperatingCost:Array(periods.length).fill(0),
 annualMaintenanceCapex:Array(periods.length).fill(0),annualTaxRates:Array(periods.length).fill(5),
 annualEquityContributions:Array(periods.length).fill(0),workingCapitalByPeriod:workingCapitalBalances,
 loans:[{id:'comfar-cold-rolling-reported-loan',input:{annualRatePercent:0,drawdowns:Array(periods.length).fill(0),
  repaymentMethod:'bullet',repaymentStartPeriod:1,gracePeriods:0,termPeriods:periods.length,capitalizeInterest:false}}],
 loanScheduleOverrides:{'comfar-cold-rolling-reported-loan':loanRows},
 discountRatePercent:20,
})
assert.equal(fullFinanceResult.valid,true,fullFinanceResult.warnings.join('; '))
assert.equal(fullFinanceResult.rows.length,15)
for(let i=0;i<15;i++){
 const row=fullFinanceResult.rows[i]
 assert.ok(Number.isFinite(row.tax)&&Number.isFinite(row.cfads)&&Number.isFinite(row.projectFreeCashFlow),
  'Integrated tax, CFADS and project cash flow must be finite in '+(1403+i))
 close(row.taxRatePercent,5,'Integrated tax rate must be 5% in '+(1403+i),0.000001)
 console.log([
  String(1403+i),
  'engineTax='+row.tax.toFixed(2),
  'reportTax='+reportTax[i].toFixed(2),
  'taxDelta='+(row.tax-reportTax[i]).toFixed(2),
  'CFADS='+row.cfads.toFixed(2),
  'engineProjectFCF='+row.projectFreeCashFlow.toFixed(2),
  'reportNetCF='+reportNetCashFlow[i].toFixed(2),
  'cashFlowDelta='+(row.projectFreeCashFlow-reportNetCashFlow[i]).toFixed(2),
  'debtService='+row.debtService.toFixed(2),
  'DSCR='+(row.dscr===null?'n/a':row.dscr.toFixed(5)),
 ].join(' | '))
}
for(let i=0;i<3;i++){
 const actual=fullFinanceResult.loanSchedules['comfar-cold-rolling-reported-loan'][i]
 close(actual.openingBalance,sourceDebt[i].openingBalance,'Reported opening debt '+(1403+i),0.02)
 close(actual.principal,sourceDebt[i].principal,'Reported principal repayment '+(1403+i),0.02)
 close(actual.interestExpense,sourceDebt[i].interestExpense,'Reported interest expense '+(1403+i),0.02)
 close(actual.closingBalance,sourceDebt[i].closingBalance,'Reported closing debt '+(1403+i),0.02)
}
assert.ok(Number.isFinite(fullFinanceResult.npvProject),'Integrated operating-horizon NPV at 20% must be calculated')
console.log('Operating-horizon NPV at 20%='+fullFinanceResult.npvProject.toFixed(2)+'; operating-horizon IRR='+String(fullFinanceResult.irrProject))
console.log('Whole-project COMFAR NPV 31,425,182.71 and IRR 52.83% (p.57) are not parity assertions: this fixture begins in 1403 and lacks the actual 7/1401-1402 construction-period cash-flow schedule. Tax/CFADS/net-cash-flow differences are diagnostics; no COMFAR values are altered.')


{
// End-to-end financial validation against the cold-rolling COMFAR report (126 pages).
// The operating cash-flow statements (pp. 49-61) consistently use the summary OPEX
// amounts, while the factory-cost detail (pp. 24-27) contains documented differences.
// Keep both source series: the engine cash-flow path uses the cash-flow statement series;
// the detailed product-cost path above continues to validate pp. 24-27 independently.
const integratedPeriods=jalaliAnnualPeriods(1401,1417,1)
assert.equal(integratedPeriods.length,17)
const integratedValuationDate=integratedPeriods[1].endDate // 12/1402
const years=Array.from({length:17},(_,i)=>1401+i)
const operatingYears=years.slice(2)
const cashFlowOpex=[
 53459511.66,59832541.28,66205570.90,66205570.90,66205570.90,
 66205570.90,66205570.90,66205570.90,66205570.90,66205570.90,
 66205570.90,66205570.90,66205570.90,66205570.90,66205570.90,
]
const marketingCost=79000
const reportedDepreciation=[
 1195263.55,1195263.55,1195263.55,1194168.55,1176286.05,
 1160046.05,1160046.05,1160046.05,1160046.05,240604.35,
 210364.35,210364.35,180312.30,0,0,
]
const reportedInterest=[
 1366423.77,953724.34,412759.57,0,0,0,0,0,0,0,0,0,0,0,0,
]
const reportedPrincipal=[
 1327878.79,1740578.22,2281542.99,0,0,0,0,0,0,0,0,0,0,0,0,
]
const reportedTax=[
 354990.05,451973.54,555370.30,576063.03,576957.15,
 2888845.76,2888845.76,2888845.76,2888845.76,3118706.19,
 3126266.19,3126266.19,3133779.20,3178857.27,3178857.27,
]
const reportedNetCashFlow=[
 6912999.97,10453127.90,11876468.51,12139399.36,12138471.95,
 9826583.34,9826583.34,9826583.34,9826583.34,9596722.91,
 9589162.91,9589162.91,9581649.90,9536571.83,9536571.83,
]
const reportedRevenue=[
 63200000,71100000,79000000,79000000,79000000,
 79000000,79000000,79000000,79000000,79000000,
 79000000,79000000,79000000,79000000,79000000,
]
const reportedWorkingCapitalChange=[
 2393498.33,283357.28,283590.29,-33.29,0,0,0,0,0,0,0,0,0,0,0,
]
const reportedTaxRates=[5,5,5,5,5,25,25,25,25,25,25,25,25,25,25]
const zeroConstruction=[0,0]
const annualRevenue=[...zeroConstruction,...reportedRevenue]
const annualVariableCost=[...zeroConstruction,...cashFlowOpex]
const annualFixedCost=[0,0,...Array(15).fill(marketingCost)]
const annualDepreciation=[0,0,...reportedDepreciation]
const annualFixedInvestment=[6660810.70,8029561.30,...Array(15).fill(0)]
const annualTaxRates=[0,0,...reportedTaxRates]
const periodRevenue=[0,0,...reportedRevenue]
const periodVariableCost=[0,0,...cashFlowOpex]
const periodCostOfGoodsSold=periodVariableCost.map((value,index)=>value+(index>=2?marketingCost:0))
const periodInventoryChange=Array(17).fill(0)
const periodDepreciationSchedule=[0,0,...reportedDepreciation]
const periodTaxRates=[0,0,...reportedTaxRates]
const periodTaxAmounts=[0,0,...reportedTax]
const workingCapitalChanges=[0,0,...reportedWorkingCapitalChange]
const workingCapitalBalances=workingCapitalChanges.map((value,index)=>
  workingCapitalChanges.slice(0,index+1).reduce((sum,amount)=>sum+amount,0))
const loanRows=integratedPeriods.map((_,index)=>({
  period:index+1,drawdown:0,openingBalance:0,periodRatePercent:0,interestExpense:0,
  capitalizedInterest:0,financingFeeExpense:0,commitmentFeeExpense:0,
  capitalizedFinancingFees:0,principal:0,closingBalance:0,debtService:0,
}))
Object.assign(loanRows[1],{drawdown:5000000,capitalizedInterest:350000,closingBalance:5350000})
Object.assign(loanRows[2],{openingBalance:5350000,interestExpense:1366423.77,
  principal:1327878.79,closingBalance:4022121.21,debtService:2694302.56})
Object.assign(loanRows[3],{openingBalance:4022121.21,interestExpense:953724.34,
  principal:1740578.22,closingBalance:2281542.99,debtService:2694302.56})
Object.assign(loanRows[4],{openingBalance:2281542.99,interestExpense:412759.57,
  principal:2281542.99,closingBalance:0,debtService:2694302.56})
const integratedLoan={id:'comfar-cold-coil-200k-reported-loan',input:{
  annualRatePercent:0,drawdowns:Array(17).fill(0),repaymentMethod:'bullet',
  repaymentStartPeriod:3,gracePeriods:0,termPeriods:17,capitalizeInterest:false,
}}
const integratedInput={
  periods:integratedPeriods,fiscalYearStartMonth:3,constructionPeriodCount:2,
  dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue,periodRevenue,annualVariableCost,periodVariableCost,
  periodInventoryChange,periodCostOfGoodsSold,
  annualFixedCost,annualDepreciation,periodDepreciationSchedule,
  annualFixedInvestment,annualPreOperatingCost:Array(17).fill(0),
  annualMaintenanceCapex:Array(17).fill(0),annualTaxRates,
  taxRatesByPeriod:periodTaxRates,
  annualEquityContributions:Array(17).fill(0),
  workingCapitalByPeriod:workingCapitalBalances,
  loans:[integratedLoan],loanScheduleOverrides:{[integratedLoan.id]:loanRows},
  taxLossCarryForwardEnabled:true,
}
const integratedResult=engine.calculateIntegratedPeriodicFinance(integratedInput)
assert.equal(integratedResult.valid,true,integratedResult.warnings.join('; '))
assert.equal(integratedResult.rows.length,17)
for(let i=0;i<15;i++){
  const row=integratedResult.rows[i+2]
  const year=1403+i
  close(row.productionCost,cashFlowOpex[i]+marketingCost,'Cash-flow OPEX plus direct marketing '+year,0.02)
  close(row.costOfGoodsSold,cashFlowOpex[i]+marketingCost,'Cash-flow COGS basis '+year,0.02)
  close(row.depreciation,reportedDepreciation[i],'COMFAR depreciation '+year,0.02)
  close(row.interestExpense,reportedInterest[i],'COMFAR cash interest '+year,0.02)
  close(row.principal,reportedPrincipal[i],'COMFAR principal repayment '+year,0.02)
  close(row.taxRatePercent,reportedTaxRates[i],'COMFAR implied tax-rate band '+year,0.0001)
  close(row.tax,reportedTax[i],'COMFAR corporate income tax '+year,0.02)
  close(row.cfads,reportedNetCashFlow[i],'COMFAR net cash flow / engine CFADS '+year,0.02)
  close(row.changeInWorkingCapital,reportedWorkingCapitalChange[i],'COMFAR net working-capital change '+year,0.02)
}
const debtSchedule=integratedResult.loanSchedules[integratedLoan.id]
close(debtSchedule[1].closingBalance,5350000,'COMFAR closing debt 1402',0.02)
close(debtSchedule[2].closingBalance,4022121.21,'COMFAR closing debt 1403',0.02)
close(debtSchedule[3].closingBalance,2281542.99,'COMFAR closing debt 1404',0.02)
close(debtSchedule[4].closingBalance,0,'COMFAR closing debt 1405',0.02)
close(debtSchedule[2].principal,1327878.79,'COMFAR principal 1403',0.02)
close(debtSchedule[3].principal,1740578.22,'COMFAR principal 1404',0.02)
close(debtSchedule[4].principal,2281542.99,'COMFAR principal 1405',0.02)
close(integratedResult.rows[2].cfads/integratedResult.rows[2].debtService,
  reportedNetCashFlow[0]/(reportedInterest[0]+reportedPrincipal[0]),
  'DSCR derived from report cash flow and debt service 1403',0.000001)

// COMFAR presents the residual value in the 1418 column, but its NPV contribution
// (425,955.77) uses the same 15-period discount factor as the 1417 cash flow.
// Keep that source timing explicit by attaching the residual return to final model
// period 1417 for valuation only; do not contaminate the operating CFADS comparison.
const reportedResidualValue=6562709.81
const zeroSale={saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}
const periodAssetSaleSchedule=integratedPeriods.map((_,index)=>index===16?{
  saleProceeds:reportedResidualValue,returnOfCapital:reportedResidualValue,
  otherIncomeLoss:0,bookValueDisposed:reportedResidualValue,
}:zeroSale)
const valuationResult=engine.calculateIntegratedPeriodicFinance({
  ...integratedInput,
  discountRatePercent:20,valuationDate:integratedValuationDate,
  discountConvention:'period-count',discountPeriodsPerYear:1,
  taxAmountOverridesByPeriod:periodTaxAmounts,
  taxAmountSourceReference:'COMFAR III cold-rolling report, financial cash-flow statements pp. 57-61',
  periodAssetSaleSchedule,
})
assert.equal(valuationResult.valid,true,valuationResult.warnings.join('; '))
close(valuationResult.npvProject,31425182.71,'COMFAR project NPV at 20%, valuation date 12/1402',0.05)
const periodCountIrr=calculateComfarPeriodCountIrr(valuationResult.rows.map(row=>row.projectFreeCashFlow))
close(periodCountIrr,52.83,'COMFAR period-count project IRR',0.01)
assert.ok(Number.isFinite(valuationResult.irrProject),'Integrated engine must return a finite actual-date project IRR')
console.log('COMFAR cold-rolling integrated end-to-end validation passed: 5% tax through 1407, 25% thereafter, exact source tax/CFADS/depreciation/debt, NPV parity at 20%, and period-count IRR parity. Engine actual-date IRR='+valuationResult.irrProject.toFixed(6)+'%; COMFAR period-count IRR='+periodCountIrr.toFixed(6)+'%.')
}
