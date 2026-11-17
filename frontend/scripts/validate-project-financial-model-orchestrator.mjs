import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function transpile(path){const source=await readFile(new URL(path,import.meta.url),'utf8');return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}
const url=output=>'data:text/javascript;base64,'+Buffer.from(output).toString('base64')
const engineUrl=url(await transpile('../src/features/steel/periodicFinancialEngine.ts'))
const fxUrl=url(await transpile('../src/features/steel/foreignCurrencyTranslation.ts'))
const helpFormulaUrl=url(await transpile('../src/features/projects/projectModelHelpFormulaRules.ts'))
const helpFormsUrl=url(await transpile('../src/features/projects/projectModelHelpForms.ts'))
let draftsOutput=(await transpile('../src/features/projects/projectModelFormDrafts.ts')).replace("'./projectModelHelpForms'",JSON.stringify(helpFormsUrl))
const draftsUrl=url(draftsOutput)
let productionOutput=await transpile('../src/features/projects/productionSalesInventoryIntegration.ts')
productionOutput=productionOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'./projectModelHelpFormulaRules'",JSON.stringify(helpFormulaUrl))
const productionUrl=url(productionOutput)
const workingCapitalUrl=url(await transpile('../src/features/projects/workingCapitalDraftIntegration.ts'))
let fixedOutput=await transpile('../src/features/projects/fixedAssetDraftIntegration.ts')
fixedOutput=fixedOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'./projectModelFormDrafts'",JSON.stringify(draftsUrl))
const fixedUrl=url(fixedOutput)
let loanOutput=await transpile('../src/features/projects/foreignCurrencyLoanFinanceBinding.ts')
loanOutput=loanOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'../steel/foreignCurrencyTranslation'",JSON.stringify(fxUrl)).replace("'../projects/projectModelFormDrafts'",JSON.stringify(draftsUrl))
loanOutput=loanOutput.replace("'./projectModelHelpFormulaRules'",JSON.stringify(helpFormulaUrl))
const loanUrl=url(loanOutput)
let orchestratorOutput=await transpile('../src/features/projects/projectFinancialModelOrchestrator.ts')
orchestratorOutput=orchestratorOutput.replace("'./projectModelFormDrafts'",JSON.stringify(draftsUrl))
 .replace("'./projectModelHelpForms'",JSON.stringify(helpFormsUrl))
orchestratorOutput=orchestratorOutput.replace("'./productionSalesInventoryIntegration'",JSON.stringify(productionUrl))
 .replace("'./workingCapitalDraftIntegration'",JSON.stringify(workingCapitalUrl))
 .replace("'./fixedAssetDraftIntegration'",JSON.stringify(fixedUrl))
 .replace("'./foreignCurrencyLoanFinanceBinding'",JSON.stringify(loanUrl))
const orchestrator=await import(url(orchestratorOutput))
const helpForms=await import(helpFormsUrl)

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
]
let currencyHelp=helpForms.createBlankHelpDrivenProjectForms()
currencyHelp=helpForms.addHelpFormRow(currencyHelp,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true,exchangeRate:1}))
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'currencies','local-eur',key,value)
currencyHelp=helpForms.addHelpFormRow(currencyHelp,'currencies','foreign-usd')
for(const [key,value] of Object.entries({code:'USD',name:'US Dollar',type:'foreign'}))
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'currencies','foreign-usd',key,value)
for(const [id,period,rate] of [['usd-1','1',1.08],['usd-2','2',1.1]]){
 currencyHelp=helpForms.addHelpFormRow(currencyHelp,'currency-rates',id)
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'currency-rates',id,'currencyCode','USD')
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'currency-rates',id,'period',period)
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'currency-rates',id,'exchangeRate',rate)
}
for(const [id,period,inflationPercent,priceIndex] of [
 ['eur-inflation-1','1',0,100],['eur-inflation-2','2',5,105],
]){
 currencyHelp=helpForms.addHelpFormRow(currencyHelp,'inflation',id)
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'inflation',id,'currencyCode','EUR')
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'inflation',id,'period',period)
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'inflation',id,'inflationPercent',inflationPercent)
 currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'inflation',id,'priceIndex',priceIndex)
}
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'economic-global','economic-global-main','discountRate',8)
currencyHelp=helpForms.addHelpFormRow(currencyHelp,'tax-allowances','usd-investment-allowance')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'tax-allowances','usd-investment-allowance','type','investment-allowance')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'tax-allowances','usd-investment-allowance','period','1')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'tax-allowances','usd-investment-allowance','amount',100)
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'tax-allowances','usd-investment-allowance','currency','USD')
currencyHelp=helpForms.addHelpFormRow(currencyHelp,'cost-centres','factory-centre')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'cost-centres','factory-centre','name','Factory')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'cost-centres','factory-centre','group','production')
assert.deepEqual(helpForms.validateHelpDrivenProjectForms(currencyHelp),[])
const foundationBinding=orchestrator.bindHelpDrivenFoundation(foundation,currencyHelp,periods)
assert.deepEqual(foundationBinding.issues,[])
assert.equal(foundationBinding.foundation.currencies.localCurrencyCode,'EUR')
assert.deepEqual(foundationBinding.foundation.currencies.foreignCurrencies[0].exchangeRates,[
 {period:'1',rateToLocal:1.08},{period:'2',rateToLocal:1.1},
])
assert.equal(foundationBinding.foundation.costCentres.active,true)
assert.equal(foundationBinding.foundation.costCentres.items[0].name,'Factory')
assert.deepEqual(foundationBinding.foundation.inflation.indices[0].rates,[
 {period:'1',ratePercent:0},{period:'2',ratePercent:5},
])
assert.equal(foundationBinding.foundation.discounting.economicRatePercent,8)
const currencyBoundRun=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:currencyHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(currencyBoundRun.valid,true,currencyBoundRun.issues.join('; '))
assert.equal(currencyBoundRun.finalRun.finance.valid,true)
assert.equal(currencyBoundRun.finalRun.finance.rows[0].tax,223)
assert.equal(currencyBoundRun.finalRun.finance.rows[1].tax,380)
const foundation={
 schemaVersion:1,
 planning:{periodFrequency:'annual',projectStartDate:'2025-01-01',projectEndDate:'2026-12-31',fiscalYearStartMonth:1,balanceDateMonth:12,balanceDateDay:31,dayCountBasis:365,valuationDate:'2025-01-01',discountConvention:'actual-days',cashFlowTiming:'period-end'},
 currencies:{localCurrencyCode:'EUR',localCurrencyName:'Euro',foreignCurrencies:[]},
 costCentres:{active:false,items:[]},inflation:{active:false,indices:[]},
 discounting:{method:'manual',financialRatePercent:10,economicRatePercent:10},
 taxation:{system:'corporate',lossCarryForward:true,lossCarryForwardYears:5,rates:[]},
}
const finance={
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[0,0],annualVariableCost:[0,0],annualFixedCost:[0,0],
 annualDepreciation:[0,0],annualFixedInvestment:[0,0],annualPreOperatingCost:[0,0],
 annualMaintenanceCapex:[0,0],annualTaxRates:[25,25],annualEquityContributions:[0,0],
 annualEquityWorkingCapitalContributions:[0,0],workingCapitalByPeriod:[0,0],
 openingWorkingCapital:0,loans:[],discountRatePercent:10,
}
const drafts={
 sales:[{productId:'finished-product',openingFinishedGoodsQuantity:0,periods:[
  {period:'1',salesQuantity:10,netUnitPrice:100,salesTaxPercent:0,subsidyPercent:0,subsidyAmount:null,finishedGoodsClosingQuantity:0},
  {period:'2',salesQuantity:20,netUnitPrice:100,salesTaxPercent:0,subsidyPercent:0,subsidyAmount:null,finishedGoodsClosingQuantity:0},
 ]}],
 productionCosts:[],
 workingCapital:[{id:'cash',name:'Operating cash',category:'cash',openingBalance:0,minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',
  periodBalances:[{period:'1',amount:0},{period:'2',amount:0}]}],
 assets:[],loans:[],
 tax:{system:'corporate',rates:[{period:'1',ratePercent:25},{period:'2',ratePercent:20}],
  allowances:[{id:'investment-allowance',name:'Investment allowance',periodAmounts:[{period:'2',amount:100}]}],
  lossCarryForward:true,lossCarryForwardYears:2},
}
const result=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts,foundation,productionStartDate:'2025-01-01',
 
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.financeInput.annualRevenue,[1000,2000])
assert.deepEqual(result.financeInput.taxRatesByPeriod,[25,20])
assert.deepEqual(result.financeInput.taxAllowancesByPeriod,[0,100])
assert.equal(result.financeInput.taxLossCarryForwardEnabled,true)
assert.equal(result.financeInput.taxLossCarryForwardYears,2)
assert.equal(result.finalRun.finance.rows[0].tax,250)
assert.equal(result.finalRun.finance.rows[1].tax,380)
assert.deepEqual(result.financeInput.workingCapitalByPeriod,[0,0])
assert.equal(result.finalRun.finance.valid,true)
assert.equal(result.finalRun.statements.length,2)
let discountingHelp=helpForms.createBlankHelpDrivenProjectForms()
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','investmentRate',12)
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','equityRate',14)
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','referenceDate','2025-01-01')
const discountedResult=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:discountingHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(discountedResult.valid,true,discountedResult.issues.join('; '))
assert.equal(discountedResult.financeInput.discountRatePercent,12)
assert.equal(discountedResult.financeInput.equityDiscountRatePercent,14)
assert.equal(discountedResult.financeInput.valuationDate,'2025-01-01')
assert.notEqual(discountedResult.finalRun.finance.npvProject,result.finalRun.finance.npvProject)
let progressiveTaxHelp=helpForms.createBlankHelpDrivenProjectForms()
for(const period of ['1','2']){
 for(const [lowerLimit,rate] of [[0,10],[500,20]]){
  const id='tax-'+period+'-'+lowerLimit
  progressiveTaxHelp=helpForms.addHelpFormRow(progressiveTaxHelp,'tax-brackets',id)
  progressiveTaxHelp=helpForms.updateHelpFormRow(progressiveTaxHelp,'tax-brackets',id,'period',period)
  progressiveTaxHelp=helpForms.updateHelpFormRow(progressiveTaxHelp,'tax-brackets',id,'lowerLimit',lowerLimit)
  progressiveTaxHelp=helpForms.updateHelpFormRow(progressiveTaxHelp,'tax-brackets',id,'rate',rate)
 }
}
const progressiveTaxResult=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:progressiveTaxHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(progressiveTaxResult.valid,true,progressiveTaxResult.issues.join('; '))
assert.deepEqual(progressiveTaxResult.financeInput.taxBracketsByPeriod,[
 [{lowerLimit:0,ratePercent:10},{lowerLimit:500,ratePercent:20}],
 [{lowerLimit:0,ratePercent:10},{lowerLimit:500,ratePercent:20}],
])
assert.equal(progressiveTaxResult.finalRun.finance.rows[0].tax,150)
assert.equal(progressiveTaxResult.finalRun.finance.rows[1].tax,330)
assert.ok(result.finalRun.statements.every(row=>row.balanceSheet.reconciled))
const openingBalanceSheet={
 enabled:true,cash:100,inventory:20,workInProgress:10,finishedGoods:30,receivables:40,
 otherCurrentAssets:0,tradePayables:10,otherCurrentLiabilities:5,grossFixedAssets:200,
 accumulatedDepreciation:50,deferredPreOperatingAssets:0,shortTermDebt:20,longTermDebt:50,
 shareCapital:200,retainedEarnings:65,
}
const existingEnterprise=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,openingBalanceSheet},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(existingEnterprise.valid,true,existingEnterprise.issues.join('; '))
assert.equal(existingEnterprise.finalRun.statements[0].openingBalances.cash,100)
assert.equal(existingEnterprise.finalRun.statements[0].openingBalances.debt,70)
assert.equal(existingEnterprise.finalRun.statements[0].openingBalances.netFixedAssets,150)
assert.equal(existingEnterprise.finalRun.statements[0].openingBalances.netWorkingCapital,85)
assert.ok(existingEnterprise.finalRun.statements.every(row=>row.balanceSheet.reconciled))
const unbalancedOpening=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,openingBalanceSheet:{...openingBalanceSheet,retainedEarnings:66}},foundation,
 productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(unbalancedOpening.valid,false)
assert.ok(unbalancedOpening.issues.some(issue=>issue.includes('opening-balance-sheet-does-not-balance')))

const invalidHelpDriven={sections:{'cost-centres':[{id:'centre-a',values:{name:'Factory',parentId:'missing'}}]}}
const invalidHelpModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:invalidHelpDriven},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(invalidHelpModel.valid,false)
assert.ok(invalidHelpModel.issues.includes('cost-centre:unknown-parent:missing'))

console.log('Unified project form orchestration and opening-balance-sheet validation passed.')
