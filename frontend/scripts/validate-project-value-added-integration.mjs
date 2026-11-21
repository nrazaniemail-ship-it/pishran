import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const valueAddedSource=await readFile(new URL('../src/features/projects/projectValueAddedAnalysis.ts',import.meta.url),'utf8')
const valueAddedUrl='data:text/javascript;base64,'+Buffer.from(transpile(valueAddedSource)).toString('base64')
const financeSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const financeUrl='data:text/javascript;base64,'+Buffer.from(transpile(financeSource)).toString('base64')
const source=await readFile(new URL('../src/features/projects/projectValueAddedIntegration.ts',import.meta.url),'utf8')
const output=transpile(source)
 .replace("'./projectValueAddedAnalysis'",JSON.stringify(valueAddedUrl))
 .replace("'../steel/periodicFinancialEngine'",JSON.stringify(financeUrl))
const integration=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
 {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
]
const intermediate={
 id:'MAT-1',description:'Domestic raw material',amount:300,marketOrigin:'local',
 taxesDutiesIncludedPercent:10,valueAddedIncludedPercentages:[20,10,0],
 sourceReference:'invoice-register-page-2',sourceVerified:true,
}
const investment={
 id:'CAPEX-1',description:'Plant equipment',amount:50,marketOrigin:'foreign',
 taxesDutiesIncludedPercent:10,valueAddedIncludedPercentages:[0,0,0],
 sourceReference:'capex-invoice-4',sourceVerified:true,kind:'fixed-investment',
}
const drafts=[
 {period:1,otherIncome:20,subsidiesOnInput:0,subsidiesOnInvestment:0,
  repatriatedWages:30,repatriatedProfitDividends:5,repatriatedInterest:10,repatriatedOther:2,
  domesticWages:100,domesticDividendsAndInterest:20,skilledDomesticLabour:40,totalDomesticLabour:50,
  foreignExchangeOutflow:100,sourceReference:'period-1-payroll-and-tax-records',sourceVerified:true,
  intermediateInputs:[intermediate],investmentInputs:[investment]},
 {period:2,otherIncome:0,subsidiesOnInput:0,subsidiesOnInvestment:0,
  repatriatedWages:0,repatriatedProfitDividends:0,repatriatedInterest:0,repatriatedOther:0,
  domesticWages:50,domesticDividendsAndInterest:10,skilledDomesticLabour:20,totalDomesticLabour:25,
  foreignExchangeOutflow:0,sourceReference:'period-2-payroll-and-tax-records',sourceVerified:true,
  intermediateInputs:[],investmentInputs:[]},
]
const productSchedule={
 valid:true,issues:[],rows:[],periodRevenue:[1100,550],periodCostOfSales:[500,300],
 periodSubsidyIncome:[100,50],periodOutputSalesTax:[100,50],annualRevenue:[1650],annualCostOfSales:[800],
 totalProductionQuantity:0,totalSalesQuantity:0,totalClosingInventoryValue:0,
 periodRawMaterialInventoryValue:[0,0],periodWipInventoryValue:[0,0],periodAbnormalWasteExpense:[0,0],
 periodNormalWasteAbsorbed:[0,0],hasInventoryFlow:false,
}
const finance={
 valid:true,rows:[
  {tax:40},{tax:20},
 ],
}
const tax={
 valid:true,issues:[],rows:[
  {period:1,openingBalance:0,outputTax:100,recoverableInputTax:10,netTaxAccrued:90,settlement:40,closingBalance:50},
  {period:2,openingBalance:50,outputTax:50,recoverableInputTax:5,netTaxAccrued:45,settlement:50,closingBalance:45},
 ],totalOutputTax:150,totalRecoverableInputTax:15,totalSettlements:90,closingBalance:45,
}
const input={
 periods,drafts,productSchedule,finance,salesTaxLedger:tax,salesTaxLedgerActive:true,
 discountRatePercent:10,dayCountBasis:365,timing:'period-end',
 discountConvention:'actual-days',periodsPerYear:4,
}
const result=integration.buildIntegratedProjectValueAddedAnalysis(input)
assert.equal(result.valid,true,result.issues.join('; '))
assert.equal(result.rows[0].grossOutput,1120,'Sales subsidy must be excluded from sales revenue and added only as a transfer where appropriate; output tax is separately included')
assert.equal(result.rows[0].intermediateInput.amountDeducted,194.4)
assert.equal(result.rows[0].investment.amountDeducted,45)
assert.equal(result.rows[0].repatriatedPayments,47)
assert.equal(result.rows[0].governmentShare,40+100+30+5-100)
assert.equal(result.rows[1].grossOutput,600)
assert.equal(result.rows[1].governmentShare,20+50)
assert.ok(result.rows[1].presentValueFactor<result.rows[0].presentValueFactor)

const missingPeriod=integration.buildIntegratedProjectValueAddedAnalysis({...input,drafts:[drafts[0]]})
assert.equal(missingPeriod.valid,false)
assert.ok(missingPeriod.issues.some(issue=>issue.includes('Period 2')))

const invalidVat=integration.buildIntegratedProjectValueAddedAnalysis({...input,salesTaxLedger:{...tax,valid:false}})
assert.equal(invalidVat.valid,false)
assert.ok(invalidVat.issues.some(issue=>issue.includes('sales-tax ledger')))

const missingEconomicRate=integration.buildIntegratedProjectValueAddedAnalysis({...input,discountRatePercent:null})
assert.equal(missingEconomicRate.valid,false)
assert.ok(missingEconomicRate.issues.some(issue=>issue.includes('economic discount rate')))

console.log('Integrated COMFAR value-added schedule regression tests passed.')
