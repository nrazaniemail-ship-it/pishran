import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function compile(path) {
 const source=await readFile(new URL(path,import.meta.url),'utf8')
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
}
const engineUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/steel/periodicFinancialEngine.ts')).toString('base64')
const fxUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/steel/foreignCurrencyTranslation.ts')).toString('base64')
const formsUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/projects/projectModelHelpForms.ts')).toString('base64')
const helpFormulaUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/projects/projectModelHelpFormulaRules.ts')).toString('base64')
let draftsOutput=await compile('../src/features/projects/projectModelFormDrafts.ts')
draftsOutput=draftsOutput.replace("'./projectModelHelpForms'",JSON.stringify(formsUrl))
const draftsUrl='data:text/javascript;base64,'+Buffer.from(draftsOutput).toString('base64')
let bindingOutput=await compile('../src/features/projects/foreignCurrencyLoanFinanceBinding.ts')
bindingOutput=bindingOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
bindingOutput=bindingOutput.replace("'./periodicFinancialEngine'",JSON.stringify(engineUrl))
bindingOutput=bindingOutput.replace("'../steel/foreignCurrencyTranslation'",JSON.stringify(fxUrl))
bindingOutput=bindingOutput.replace("'./projectModelHelpFormulaRules'",JSON.stringify(helpFormulaUrl))
bindingOutput=bindingOutput.replace("'../projects/projectModelFormDrafts'",JSON.stringify(draftsUrl))
bindingOutput=bindingOutput.replace("'../projects/projectFoundation'",'')
const binding=await import('data:text/javascript;base64,'+Buffer.from(bindingOutput).toString('base64'))
const engine=await import(engineUrl)

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
 {index:3,startDate:'2027-01-01',endDate:'2027-12-31',days:365,partial:false},
]
const foundation={
 schemaVersion:1,
 planning:{periodFrequency:'annual',projectStartDate:'2025-01-01',projectEndDate:'2027-12-31',fiscalYearStartMonth:1,balanceDateMonth:12,balanceDateDay:31,dayCountBasis:365,valuationDate:'2025-01-01',discountConvention:'actual-days',cashFlowTiming:'period-end'},
 currencies:{localCurrencyCode:'EUR',localCurrencyName:'Euro',foreignCurrencies:[{id:'usd',code:'USD',name:'US Dollar',exchangeRates:[
  {period:'1',rateToLocal:0.9},{period:'2',rateToLocal:0.95},{period:'3',rateToLocal:1.0}
 ]}]},
 costCentres:{active:false,items:[]},inflation:{active:false,indices:[]},
 discounting:{method:'manual',financialRatePercent:10,economicRatePercent:10},
 taxation:{system:'corporate',lossCarryForward:true,lossCarryForwardYears:5,rates:[]},
}
const loan={
 id:'foreign-facility',name:'USD Facility',currencyCode:'USD',marketOrigin:'foreign',
 loanType:'annuity',repaymentInterval:'annual',firstRepaymentDate:'2026-01-01',numberOfRepayments:2,
 disbursements:[{date:'2025-01-01',amount:1000}],profileMovements:[],
 interestRateChanges:[{effectiveDate:'2025-01-01',annualRatePercent:10}],
 interestPaymentMonth:12,capitalizedInterestPercent:50,capitalizeUntilDate:'2025-06-30',fees:[],
}
const facility=binding.buildPeriodicLoanFacilityBinding({
 loan,foundation,periods,dayCountBasis:365,openingForeignBalance:0,
})
assert.equal(facility.valid,true,facility.issues.join('; '))
assert.equal(facility.fxTranslation.valid,true)
assert.equal(facility.localSchedule.length,3)
assert.ok(facility.localSchedule[0].capitalizedInterest>0)
assert.ok(facility.localSchedule[0].interestExpense>0)
assert.ok(facility.localSchedule[0].capitalizedInterest<
  (facility.localSchedule[0].capitalizedInterest+facility.localSchedule[0].interestExpense)*0.5)

const badFrequency=binding.buildPeriodicLoanFacilityBinding({
 loan:{...loan,repaymentInterval:'quarterly'},foundation,periods,dayCountBasis:365,
})
assert.equal(badFrequency.valid,false)
assert.ok(badFrequency.issues.some(x=>x.includes('frequency')))

const baseFinance={
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[0,300,300],annualVariableCost:[0,100,100],annualFixedCost:[0,20,20],
 annualDepreciation:[0,0,0],annualFixedInvestment:[2000,0,0],
 annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
 annualTaxRates:[25,25,25],annualEquityContributions:[1000,0,0],
 annualEquityWorkingCapitalContributions:[0,0,0],workingCapitalByPeriod:[0,0,0],
 openingWorkingCapital:0,loans:[],discountRatePercent:10,
}
const bound=binding.bindLoanFacilitiesToPeriodicFinance({
 finance:baseFinance,loans:[loan],foundation,
})
assert.equal(bound.valid,true,bound.issues.join('; '))
assert.equal(bound.financeInput.loans.length,1)
assert.equal(bound.financeInput.precomputedLoanSchedules['foreign-facility'].length,3)
const integrated=engine.calculateIntegratedPeriodicFinance(bound.financeInput)
assert.equal(integrated.valid,true,integrated.warnings.join('; '))
const run=binding.calculatePeriodicFinanceWithForeignCurrencyLoans({
 finance:baseFinance,loans:[loan],foundation,
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(run.valid,true,run.issues.join('; '))
assert.equal(run.statements.length,3)
assert.ok(run.statements.every(row=>row.balanceSheet.reconciled))
assert.ok(run.fxPosting.valid)
assert.ok(run.finance.loanSchedules['foreign-facility'][2].foreignExchangeLoss>0)
assert.ok(Math.abs(run.statements[2].balanceSheet.debt-run.fxPosting.statements[2].balanceSheet.debt)<1e-8)
assert.ok(run.statements.every(row=>row.balanceSheet.reconciled))
const openingForeignFacility=binding.buildPeriodicLoanFacilityBinding({
 loan:{...loan,disbursements:[],numberOfRepayments:2},
 foundation,periods,dayCountBasis:365,openingForeignBalance:100,openingExchangeRateToLocal:0.85,
})
assert.equal(openingForeignFacility.valid,true,openingForeignFacility.issues.join('; '))
assert.equal(openingForeignFacility.openingCarryingAmountLocal,85)
const missingOpeningRate=binding.buildPeriodicLoanFacilityBinding({
 loan:{...loan,disbursements:[],numberOfRepayments:2},
 foundation,periods,dayCountBasis:365,openingForeignBalance:100,
})
assert.equal(missingOpeningRate.valid,false)
assert.ok(missingOpeningRate.issues.some(issue=>issue.includes('opening exchange rate')))

const feeBinding=binding.buildPeriodicLoanFacilityBinding({
 loan:{...loan,facilityLimit:2000,fees:[
  {id:'agency-cap',type:'agency',ratePercent:1,currencyCode:'USD',paymentDate:'2025-01-01',treatment:'capitalize'},
  {id:'guarantee-exp',type:'guarantee',ratePercent:1,currencyCode:'USD',paymentDate:'2025-12-31',treatment:'expense'},
 ]},
 foundation,periods,dayCountBasis:365,
})
assert.equal(feeBinding.valid,true,feeBinding.issues.join('; '))
assert.ok(feeBinding.fxTranslation.rows[0].capitalizedFeesLocal>0)
assert.ok(feeBinding.localSchedule[0].capitalizedFinancingFees>0)
assert.ok(feeBinding.localSchedule[0].financingFeeExpense>0)

const feeBlocked=binding.buildPeriodicLoanFacilityBinding({
 loan:{...loan,fees:[{id:'agency',type:'agency',ratePercent:1,currencyCode:'USD'}]},
 foundation,periods,dayCountBasis:365,
})
assert.equal(feeBlocked.valid,false)
assert.ok(feeBlocked.issues.some(x=>x.includes('payment-date')))

console.log('Loan-form binding, partial interest capitalization, periodic FX translation and three-statement orchestration validation passed.')
