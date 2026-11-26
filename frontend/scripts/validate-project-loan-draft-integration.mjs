import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const asUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
const engine=asUrl(transpile(await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')))
const fxSource=transpile(await readFile(new URL('../src/features/steel/foreignCurrencyTranslation.ts',import.meta.url),'utf8'))
const fxUrl=asUrl(fxSource)
let loanSource=transpile(await readFile(new URL('../src/features/projects/projectLoanDraftIntegration.ts',import.meta.url),'utf8'))
loanSource=loanSource.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engine))
loanSource=loanSource.replace("'../steel/foreignCurrencyTranslation'",JSON.stringify(fxUrl))
const adapter=await import(asUrl(loanSource))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
 {index:3,startDate:'2027-01-01',endDate:'2027-12-31',days:365,partial:false},
]
const foundation={currencies:{localCurrencyCode:'IRR',localCurrencyName:'Rial',foreignCurrencies:[
 {id:'eur',code:'EUR',name:'Euro',exchangeRates:[
  {period:'1',rateToLocal:1.2},{period:'2',rateToLocal:1.3},{period:'3',rateToLocal:1.4}
 ]}
]}}
const localLoan={id:'local-1',name:'Local facility',currencyCode:'IRR',marketOrigin:'local',
 annualRatePercent:10,openingBalance:0,openingExchangeRateToLocal:null,gracePeriods:0,
 interestConvention:'actual-365',loanType:'constant-principal',repaymentInterval:'annual',
 firstRepaymentDate:'2026-01-01',numberOfRepayments:2,
 disbursements:[{date:'2025-01-01',amount:100}],profileMovements:[],
 interestRateChanges:[],interestPaymentMonth:null,capitalizedInterestPercent:0,
 capitalizeUntilDate:'',fees:[]}
const foreignLoan={...localLoan,id:'foreign-1',name:'Foreign facility',currencyCode:'EUR',
 marketOrigin:'foreign',annualRatePercent:5,openingBalance:100,openingExchangeRateToLocal:1.1,
 disbursements:[{date:'2025-01-01',amount:50}]}
const result=adapter.buildProjectLoanDraftIntegration([localLoan,foreignLoan],periods,365,'annual',foundation)
assert.equal(result.valid,true,result.issues.join('; '))
assert.equal(result.loans.length,2)
assert.ok(result.loanScheduleOverrides['foreign-1'])
assert.equal(result.loanScheduleOverrides['foreign-1'].length,3)
assert.equal(result.foreignTranslations['foreign-1'].valid,true)
assert.equal(result.foreignExchangeLossByPeriod.length,3)
assert.ok(result.foreignExchangeLossByPeriod.some(value=>Math.abs(value)>0.001))
assert.ok(Math.abs(result.loanScheduleOverrides['foreign-1'][0].drawdown-60)<1e-9,
 'Foreign drawdowns must be translated using the explicit project-period FX rate')
assert.ok(Math.abs(result.loanScheduleOverrides['foreign-1'][0].openingBalance-110)<1e-9,
 'Opening foreign debt must be translated using the explicit opening FX rate')
const missingFx=adapter.buildProjectLoanDraftIntegration([foreignLoan],periods,365,'annual',{
 currencies:{...foundation.currencies,foreignCurrencies:[{...foundation.currencies.foreignCurrencies[0],exchangeRates:[{period:'1',rateToLocal:1.2}]}]}
})
assert.equal(missingFx.valid,false)
assert.ok(missingFx.issues.some(issue=>issue.includes('exchange rate is missing')))
const unsupportedFee=adapter.buildProjectLoanDraftIntegration([{...localLoan,fees:[{id:'fee',type:'agency',ratePercent:1,currencyCode:'IRR'}]}],periods,365,'annual',foundation)
assert.equal(unsupportedFee.valid,false)
assert.ok(unsupportedFee.issues.some(issue=>issue.includes('fee rates need explicit fee amounts')))
const unsupportedPartialCapitalization=adapter.buildProjectLoanDraftIntegration([{...localLoan,capitalizedInterestPercent:50}],periods,365,'annual',foundation)
assert.equal(unsupportedPartialCapitalization.valid,false)
const wrongFrequency=adapter.buildProjectLoanDraftIntegration([{...localLoan,repaymentInterval:'monthly'}],periods,365,'annual',foundation)
assert.equal(wrongFrequency.valid,false)
const documentedManualLoan={
 ...localLoan,id:'comfar-manual',name:'Documented COMFAR debt schedule',
 annualRatePercent:null,openingBalance:0,gracePeriods:null,interestConvention:null,
 loanType:'profile',firstRepaymentDate:'',numberOfRepayments:null,
 disbursements:[],profileMovements:[],interestRateChanges:[],interestPaymentMonth:null,
 capitalizedInterestPercent:null,capitalizeUntilDate:'',fees:[],
 manualPeriodSchedule:[
  {period:'1',drawdown:100,principal:0,interestExpense:0,capitalizedInterest:10,closingBalance:110},
  {period:'2',drawdown:0,principal:30,interestExpense:5,capitalizedInterest:0,closingBalance:80},
  {period:'3',drawdown:0,principal:80,interestExpense:4,capitalizedInterest:0,closingBalance:0},
 ],
}
const manual=adapter.buildProjectLoanDraftIntegration([documentedManualLoan],periods,365,'annual',foundation)
assert.equal(manual.valid,true,manual.issues.join('; '))
assert.equal(manual.loanScheduleOverrides['comfar-manual'].length,3)
assert.deepEqual(manual.loanScheduleOverrides['comfar-manual'].map(row=>row.interestExpense),[0,5,4],
 'Documented interest must be posted exactly without inferring an annual interest rate')
assert.deepEqual(manual.loanScheduleOverrides['comfar-manual'].map(row=>row.principal),[0,30,80])
assert.deepEqual(manual.loanScheduleOverrides['comfar-manual'].map(row=>row.closingBalance),[110,80,0])
const comfarDataSource=await readFile(new URL('../src/features/projects/comfarProjectInputData.ts',import.meta.url),'utf8')
const comfarDataJs=transpile(comfarDataSource)
const {COMFAR_PROJECT_INPUTS}=await import(asUrl(comfarDataJs))
const comfarSource=COMFAR_PROJECT_INPUTS['comfar-hr-coil-200k']
const comfarPeriods=Array.from({length:17},(_,index)=>({
 index:index+1,startDate:'2024-01-01',endDate:'2024-12-31',days:365,partial:false,
}))
const comfarManualLoan={
 ...documentedManualLoan,id:'comfar-hr-coil-source',name:'COMFAR HR Coil documented schedule',
 manualPeriodSchedule:comfarSource.financingSchedule.map(row=>({
  period:String(Number(row.period)-1403+1),drawdown:row.loanDisbursement,
  principal:row.principalRepayment,interestExpense:row.interestExpense,
  capitalizedInterest:row.capitalizedInterest,closingBalance:row.closingDebt,
 })),
}
const comfarOverride=adapter.buildProjectLoanDraftIntegration([comfarManualLoan],comfarPeriods,360,'annual',foundation)
assert.equal(comfarOverride.valid,true,comfarOverride.issues.join('; '))
const comfarRows=comfarOverride.loanScheduleOverrides['comfar-hr-coil-source']
assert.equal(comfarRows.length,17)
assert.equal(comfarRows[2].interestExpense,2399043.44,'1405 interest must be taken from the COMFAR source schedule')
assert.equal(comfarRows[2].principal,964925.63,'1405 principal must be taken from the COMFAR source schedule')
assert.equal(comfarRows[3].interestExpense,2099148.4,'1406 interest must be taken from the COMFAR source schedule')
assert.equal(comfarRows[6].closingBalance,0,'Debt must be fully repaid in 1409')
assert.equal(comfarRows[16].closingBalance,0,'No debt is invented after the documented 1409 repayment')
console.log('Local and foreign loan draft integration validation passed.')
