import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function transpile(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8')
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
}
const url=output=>'data:text/javascript;base64,'+Buffer.from(output).toString('base64')
const engineUrl=url(await transpile('../src/features/steel/periodicFinancialEngine.ts'))
let formsOutput=await transpile('../src/features/projects/projectModelHelpForms.ts')
const formsUrl=url(formsOutput)
let integrationOutput=await transpile('../src/features/projects/shareholderDistributionIntegration.ts')
integrationOutput=integrationOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const integration=await import(url(integrationOutput))
const forms=await import(formsUrl)
const financeInput={periods:[{index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false}],fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[20],annualEquityContributions:[20],workingCapitalByPeriod:[0],loans:[],discountRatePercent:10,equityDiscountRatePercent:10}

let help=forms.createBlankHelpDrivenProjectForms()
help=forms.addHelpFormRow(help,'profit-distribution','distribution-period-1')
for(const [key,value] of Object.entries({
 period:'1',retainedPercent:40,distributedPercent:60,repatriatedPercent:25,
}))help=forms.updateHelpFormRow(help,'profit-distribution','distribution-period-1',key,value)
help=forms.addHelpFormRow(help,'joint-venture','ordinary-class')
help=forms.updateHelpFormRow(help,'joint-venture','ordinary-class','name','Ordinary')
help=forms.updateHelpFormRow(help,'joint-venture','ordinary-class','type','ordinary-shareholder')
help=forms.updateHelpFormRow(help,'joint-venture','ordinary-class','paidOut',10)
help=forms.updateHelpFormRow(help,'joint-venture','ordinary-class','period','1')

const row={
 period:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,revenue:200,variableCost:40,fixedCost:20,
 depreciation:10,ebit:130,assetSaleProceeds:0,assetReturnOfCapital:0,assetSaleOtherIncomeLoss:0,assetBookValueDisposed:0,
 interestExpense:10,cashInterestExpense:10,financingFeeExpense:0,commitmentFeeExpense:0,capitalizedInterest:0,
 capitalizedFinancingFees:0,principal:0,debtDrawdown:0,debtService:10,taxRatePercent:20,taxAllowances:0,
 taxDepreciationAdjustment:0,tax:20,unleveredTax:20,taxLossCarryForward:0,fixedInvestment:0,preOperatingCost:0,
 maintenanceCapex:0,closingWorkingCapital:0,changeInWorkingCapital:0,equityContribution:20,equityWorkingCapitalContribution:0,
 salvageValue:0,salvageBookValueDisposed:0,salvageGainLoss:0,cfads:100,dscr:10,dscrCovenantStatus:'not-tested',
 projectFreeCashFlow:80,equityFreeCashFlow:80,
}
const finance={valid:true,rows:[row],loanSchedules:{},npvProject:1,irrProject:0.1,mirrProject:null,npvEquity:1,irrEquity:0.1,mirrEquity:null,totalDebtDrawdown:0,totalEquityContribution:20,totalCapitalizedInterest:0,peakWorkingCapital:0,warnings:[]}
const statement={
 period:1,startDate:row.startDate,endDate:row.endDate,
 openingBalances:{cash:100,debt:150,netFixedAssets:100,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:50,retainedEarnings:20},
 incomeStatement:{revenue:200,cashOperatingCosts:60,ebitda:140,depreciation:10,assetDisposalGainLoss:0,ebit:130,interest:10,cashInterestExpense:10,financingFeeExpense:0,commitmentFeeExpense:0,profitBeforeTax:120,tax:20,netIncome:100},
 cashFlowStatement:{operatingCashFlow:110,investingCashFlow:0,financingCashFlow:20,netChangeInCash:130,closingCash:230},
 balanceSheet:{cash:230,netWorkingCapital:0,netFixedAssets:100,deferredPreOperatingAssets:0,totalAssets:330,debt:150,totalLiabilities:150,paidInCapital:70,retainedEarnings:120,totalEquity:190,totalLiabilitiesAndEquity:340,balanceDifference:-10,reconciled:false},
 movementChecks:{cash:0,debt:0,netWorkingCapital:0,netFixedAssets:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
}
// Align the pre-distribution balance sheet to the period's actual opening balances and movements.
statement.balanceSheet.totalAssets=340
statement.balanceSheet.balanceDifference=0
statement.balanceSheet.reconciled=true
const result=integration.applyShareholderDistributions(finance,[statement],help,financeInput)
assert.equal(result.valid,true,result.issues.join('; '))
assert.equal(result.periods[0].profitAvailable,120)
assert.equal(result.periods[0].totalDividend,72)
assert.equal(result.periods[0].repatriatedDividend,18)
assert.equal(result.periods[0].capitalRefund,10)
assert.equal(result.periods[0].closingRetainedEarnings,48)
assert.equal(result.periods[0].closingPaidInCapital,60)
assert.equal(result.periods[0].closingCash,148)
assert.equal(result.finance.rows[0].equityFreeCashFlow,-2)
assert.equal(result.statements[0].cashFlowStatement.financingCashFlow,-62)
assert.equal(result.statements[0].balanceSheet.balanceDifference,0)
assert.equal(result.statements[0].balanceSheet.reconciled,true)

const terminalHelp=forms.updateHelpFormRow(help,'profit-distribution','distribution-period-1','netWorthDistribution',10)
const terminalResult=integration.applyShareholderDistributions(finance,[statement],terminalHelp,financeInput)
assert.equal(terminalResult.valid,true,terminalResult.issues.join('; '))
assert.equal(terminalResult.periods[0].terminalNetWorthDistribution,10.8)
assert.equal(terminalResult.periods[0].terminalDividend,0)
assert.equal(terminalResult.periods[0].capitalRefund,20.8)
assert.equal(terminalResult.periods[0].closingCash,137.2)
assert.equal(terminalResult.statements[0].balanceSheet.balanceDifference,0)

const invalid=forms.updateHelpFormRow(help,'profit-distribution','distribution-period-1','distributedPercent',70)
const invalidResult=integration.applyShareholderDistributions(finance,[statement],invalid,financeInput)
assert.equal(invalidResult.valid,false)
assert.ok(invalidResult.issues.some(issue=>issue.includes('sum to 100%')))

let capitalOnly=forms.createBlankHelpDrivenProjectForms()
capitalOnly=forms.addHelpFormRow(capitalOnly,'joint-venture','new-partner')
for(const [key,value] of Object.entries({name:'New investor',type:'ordinary-shareholder',period:'1',paidIn:25}))
 capitalOnly=forms.updateHelpFormRow(capitalOnly,'joint-venture','new-partner',key,value)
const capitalResult=integration.applyShareholderDistributions(finance,[statement],capitalOnly,financeInput)
assert.equal(capitalResult.valid,true,capitalResult.issues.join('; '))
assert.equal(capitalResult.finance.rows[0].equityContribution,45)
assert.equal(capitalResult.finance.rows[0].equityFreeCashFlow,105)
assert.equal(capitalResult.statements[0].cashFlowStatement.closingCash,255)
assert.equal(capitalResult.statements[0].balanceSheet.paidInCapital,95)
assert.equal(capitalResult.statements[0].balanceSheet.balanceDifference,0)

console.log('Shareholder distribution integration validation passed.')
