import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function transpile(path){const source=await readFile(new URL(path,import.meta.url),'utf8');return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}
const url=output=>'data:text/javascript;base64,'+Buffer.from(output).toString('base64')
const engineUrl=url(await transpile('../src/features/steel/periodicFinancialEngine.ts'))
let startingBalanceOutput=await transpile('../src/features/projects/startingBalanceIntegration.ts')
startingBalanceOutput=startingBalanceOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const startingBalanceUrl=url(startingBalanceOutput)
let sensitivityOutput=await transpile('../src/features/steel/periodicSensitivity.ts')
sensitivityOutput=sensitivityOutput.replace("'./periodicFinancialEngine'",JSON.stringify(engineUrl))
const sensitivityUrl=url(sensitivityOutput)
let incrementalOutput=await transpile('../src/features/projects/incrementalAnalysisIntegration.ts')
incrementalOutput=incrementalOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const incrementalUrl=url(incrementalOutput)
const fxUrl=url(await transpile('../src/features/steel/foreignCurrencyTranslation.ts'))
const helpFormulaUrl=url(await transpile('../src/features/projects/projectModelHelpFormulaRules.ts'))
const helpFormsUrl=url(await transpile('../src/features/projects/projectModelHelpForms.ts'))
let draftsOutput=(await transpile('../src/features/projects/projectModelFormDrafts.ts')).replace("'./projectModelHelpForms'",JSON.stringify(helpFormsUrl))
const draftsUrl=url(draftsOutput)
let bindingOutput=await transpile('../src/features/projects/helpDrivenFinancialDraftBinding.ts')
bindingOutput=bindingOutput.replace("'./projectModelFormDrafts'",JSON.stringify(draftsUrl))
const bindingUrl=url(bindingOutput)
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
 .replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
orchestratorOutput=orchestratorOutput.replace("'../steel/periodicSensitivity'",JSON.stringify(sensitivityUrl))
orchestratorOutput=orchestratorOutput.replace("'./incrementalAnalysisIntegration'",JSON.stringify(incrementalUrl))
orchestratorOutput=orchestratorOutput.replace("'./productionSalesInventoryIntegration'",JSON.stringify(productionUrl))
 .replace("'./workingCapitalDraftIntegration'",JSON.stringify(workingCapitalUrl))
 .replace("'./fixedAssetDraftIntegration'",JSON.stringify(fixedUrl))
 .replace("'./foreignCurrencyLoanFinanceBinding'",JSON.stringify(loanUrl))
 .replace("'./shareholderDistributionIntegration'",JSON.stringify(url(await transpile('../src/features/projects/shareholderDistributionIntegration.ts').then(output=>output.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))))))
 .replace("'./helpDrivenFinancialDraftBinding'",JSON.stringify(bindingUrl))
 .replace("'./startingBalanceIntegration'",JSON.stringify(startingBalanceUrl))
const orchestrator=await import(url(orchestratorOutput))
const helpForms=await import(helpFormsUrl)
const helpBinding=await import(bindingUrl)
const periodicEngine=await import(engineUrl)
const exactPeriodOverrideRun=periodicEngine.calculateIntegratedPeriodicFinance({
 periods:[
  {index:1,startDate:'2025-01-01',endDate:'2025-01-31',days:31,partial:false},
  {index:2,startDate:'2025-02-01',endDate:'2025-02-28',days:28,partial:false},
 ],
 fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
 annualTaxRates:[25],annualEquityContributions:[0],workingCapitalByPeriod:[0,0],
 loans:[],discountRatePercent:10,
 periodIncrementalAdjustments:{revenue:[100,0]},
})
assert.equal(exactPeriodOverrideRun.valid,true,exactPeriodOverrideRun.warnings.join('; '))
assert.deepEqual(exactPeriodOverrideRun.rows.map(row=>row.revenue),[100,0])
assert.deepEqual(exactPeriodOverrideRun.rows.map(row=>row.unleveredTax),[25,0])

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
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'cost-centres','factory-centre','level','unit')
currencyHelp=helpForms.updateHelpFormRow(currencyHelp,'cost-centres','factory-centre','productIds','finished-product,by-product')

// Raw-form bridge: independently entered asset, cost, sales and working-capital rows
// must become the exact typed drafts consumed by the calculation adapters.
let rawHelp=helpForms.createBlankHelpDrivenProjectForms()
for(const [id,key,value] of [
 ['asset-a','assetName','Generic asset'],['asset-a','currency','EUR'],['asset-a','origin','local'],
 ['asset-a','acquisitionDate','2025-02-01'],['asset-a','quantity',2],['asset-a','unitPrice',50],['asset-a','total',100],
 ['asset-a','method','linear-to-scrap'],['asset-a','startMode','production-start'],
 ['asset-a','firstDepreciationYearMonths',12],['asset-a','lengthYears',5],['asset-a','scrapPercent',10],
]){
 if(!rawHelp.sections['fixed-investment'].some(row=>row.id===id))rawHelp=helpForms.addHelpFormRow(rawHelp,'fixed-investment',id)
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'fixed-investment',id,key,value)
}
for(const [id,key,value] of [
 ['cost-a','item','Generic direct cost'],['cost-a','classification','direct'],['cost-a','productId','product-a'],
 ['cost-a','basis','nominal-capacity'],['cost-a','activityBasis','production'],['cost-a','standardQuantity',1],['cost-a','standardUnitPrice',2],
 ['cost-a','nominalCapacity',100],['cost-a','fixedPercent',20],['cost-a','variablePercent',80],
]){
 if(!rawHelp.sections['production-costs'].some(row=>row.id===id))rawHelp=helpForms.addHelpFormRow(rawHelp,'production-costs',id)
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'production-costs',id,key,value)
}
for(const [id,period] of [['sale-a1','1'],['sale-a2','2']]){
 rawHelp=helpForms.addHelpFormRow(rawHelp,'sales-programme',id)
 for(const [key,value] of Object.entries({productId:'product-a',period,salesQuantity:10,netUnitPrice:5,salesTaxPercent:0,subsidyPercent:0,openingFinishedGoods:0,closingFinishedGoods:0}))
  rawHelp=helpForms.updateHelpFormRow(rawHelp,'sales-programme',id,key,value)
}
for(const [id,period] of [['wc-a1','1'],['wc-a2','2']]){
 rawHelp=helpForms.addHelpFormRow(rawHelp,'working-capital',id)
 for(const [key,value] of Object.entries({item:'Receivables',category:'accounts-receivable',period,requiredValue:25,startingBalance:10,basis:'cost-of-products-sold-operating-cost'}))
  rawHelp=helpForms.updateHelpFormRow(rawHelp,'working-capital',id,key,value)
}
for(const [id,key,value] of [
 ['loan-a','loanName','Generic facility'],['loan-a','kind','long-term'],['loan-a','currency','EUR'],
 ['loan-a','origin','local'],['loan-a','repaymentType','annuity'],['loan-a','interval','yearly'],
 ['loan-a','firstRepaymentDate','2025-12-31'],['loan-a','numberOfRepayments',2],
 ['loan-a','graceMonths',0],['loan-a','facilityLimit',1000],['loan-a','openingDebt',250],
]){
 if(!rawHelp.sections['loan-conditions'].some(row=>row.id===id))rawHelp=helpForms.addHelpFormRow(rawHelp,'loan-conditions',id)
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'loan-conditions',id,key,value)
}
rawHelp=helpForms.addHelpFormRow(rawHelp,'loan-disbursements','loan-draw-a')
for(const [key,value] of Object.entries({loanName:'Generic facility',date:'2025-01-01',amount:1000,flowType:'drawdown'}))
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'loan-disbursements','loan-draw-a',key,value)
rawHelp=helpForms.addHelpFormRow(rawHelp,'loan-interest','loan-rate-a')
for(const [key,value] of Object.entries({loanName:'Generic facility',effectiveDate:'2025-01-01',annualRate:8,capitalizePercent:0}))
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'loan-interest','loan-rate-a',key,value)
rawHelp=helpForms.addHelpFormRow(rawHelp,'loan-fees','loan-fee-a')
for(const [key,value] of Object.entries({loanName:'Generic facility',type:'agency',rate:1,basis:'each-positive-disbursement',payment:'at-each-disbursement',paymentDate:'2025-01-01',treatment:'expense',currency:'loan-currency'}))
 rawHelp=helpForms.updateHelpFormRow(rawHelp,'loan-fees','loan-fee-a',key,value)
const rawBound=helpBinding.bindHelpDrivenFinancialDrafts(rawHelp,periods,{assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[]})
assert.deepEqual(rawBound.issues,[])
assert.deepEqual(rawBound.boundSections,['loan-conditions','loan-disbursements','loan-interest','loan-fees','fixed-investment','production-costs','sales-programme','working-capital'])
assert.equal(rawBound.drafts.assets[0].acquisitionPeriods[0].period,'1')
assert.equal(rawBound.drafts.assets[0].depreciation.usefulLifeMonths,60)
assert.equal(rawBound.drafts.productionCosts[0].productId,'product-a')
assert.equal(rawBound.drafts.sales[0].periods.length,2)
assert.equal(rawBound.drafts.workingCapital[0].periodBalances.length,2)
assert.equal(rawBound.drafts.loans[0].name,'Generic facility')
assert.equal(rawBound.drafts.loans[0].openingLocalBalance,250)
assert.equal(rawBound.drafts.loans[0].disbursements[0].amount,1000)
assert.equal(rawBound.drafts.loans[0].interestRateChanges[0].annualRatePercent,8)
assert.equal(rawBound.drafts.loans[0].fees[0].paymentDate,'2025-01-01')

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
assert.deepEqual(helpForms.validateHelpDrivenProjectForms(currencyHelp),[])
const foundationBinding=orchestrator.bindHelpDrivenFoundation(foundation,currencyHelp,periods)
assert.deepEqual(foundationBinding.issues,[])
assert.equal(foundationBinding.foundation.currencies.localCurrencyCode,'EUR')
assert.deepEqual(foundationBinding.foundation.currencies.foreignCurrencies[0].exchangeRates,[
 {period:'1',rateToLocal:1.08},{period:'2',rateToLocal:1.1},
])
assert.equal(foundationBinding.foundation.costCentres.active,true)
assert.equal(foundationBinding.foundation.costCentres.items[0].name,'Factory')
assert.equal(foundationBinding.foundation.costCentres.items[0].group,'production')
assert.equal(foundationBinding.foundation.costCentres.items[0].level,'unit')
assert.deepEqual(foundationBinding.foundation.costCentres.items[0].productIds,['finished-product','by-product'])
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
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','investmentBorrowingRate',8)
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','investmentReinvestmentRate',9)
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','equityBorrowingRate',11)
discountingHelp=helpForms.updateHelpFormRow(discountingHelp,'discounting','discounting-main','equityReinvestmentRate',12)
const discountedResult=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:discountingHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(discountedResult.valid,true,discountedResult.issues.join('; '))
assert.equal(discountedResult.financeInput.discountRatePercent,12)
assert.equal(discountedResult.financeInput.equityDiscountRatePercent,14)
assert.equal(discountedResult.financeInput.valuationDate,'2025-01-01')
assert.equal(discountedResult.financeInput.mirrFinanceRatePercent,8)
assert.equal(discountedResult.financeInput.mirrReinvestmentRatePercent,9)
assert.equal(discountedResult.financeInput.equityMirrFinanceRatePercent,11)
assert.equal(discountedResult.financeInput.equityMirrReinvestmentRatePercent,12)
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
let incomeTaxHelp=helpForms.createBlankHelpDrivenProjectForms()
incomeTaxHelp=helpForms.updateHelpFormRow(incomeTaxHelp,'income-tax','income-tax-main','taxHolidayYears',1)
incomeTaxHelp=helpForms.updateHelpFormRow(incomeTaxHelp,'income-tax','income-tax-main','lossCarryForwardYears',5)
const holidayResult=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,tax:{...drafts.tax,lossCarryForwardYears:null},helpDriven:incomeTaxHelp},
 foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(holidayResult.valid,true,holidayResult.issues.join('; '))
assert.deepEqual(holidayResult.financeInput.taxRatesByPeriod,[0,20])
assert.equal(holidayResult.financeInput.taxLossCarryForwardYears,5)
assert.equal(holidayResult.finalRun.finance.rows[0].tax,0)
assert.equal(holidayResult.finalRun.finance.rows[1].tax,380)
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
const mismatchedOpeningWorkingCapital=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,openingBalanceSheet},foundation,productionStartDate:'2025-01-01',
 openingWorkingCapital:84,
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(mismatchedOpeningWorkingCapital.valid,false)
assert.ok(mismatchedOpeningWorkingCapital.issues.some(issue=>issue.includes('Explicit opening working capital does not reconcile')))
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

// A populated raw-template section must never be silently ignored by the financial engine.
let unboundHelp=helpForms.createBlankHelpDrivenProjectForms()
unboundHelp=helpForms.addHelpFormRow(unboundHelp,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true}))
 unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'currencies','local-eur',key,value)
unboundHelp=helpForms.addHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a')
unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a','description','Pre-production study')
unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a','currency','EUR')
unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a','origin','local')
unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a','period','1')
for(const [key,value] of Object.entries({quantity:1,unitPrice:100,total:100,amortizationMethod:'linear-to-zero',amortizationLength:2,amortizationStartMode:'production-start',firstAmortizationYearMonths:12,scrapPercent:0}))
 unboundHelp=helpForms.updateHelpFormRow(unboundHelp,'preproduction-expenditure','preproduction-a',key,value)
const preproductionModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:unboundHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(preproductionModel.valid,true,preproductionModel.issues.join('; '))
assert.deepEqual(preproductionModel.financeInput.annualPreOperatingCost,[100,0])
assert.ok(preproductionModel.fixedAssets.assets.some(asset=>asset.assetClass==='preproduction'))

let equityHelp=helpForms.createBlankHelpDrivenProjectForms()
equityHelp=helpForms.addHelpFormRow(equityHelp,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true}))
 equityHelp=helpForms.updateHelpFormRow(equityHelp,'currencies','local-eur',key,value)
equityHelp=helpForms.addHelpFormRow(equityHelp,'equity-grants','equity-contribution-a')
for(const [key,value] of Object.entries({sourceName:'Ordinary equity',sourceType:'equity',period:'1',paidIn:250,paidOut:0,currency:'EUR'}))
 equityHelp=helpForms.updateHelpFormRow(equityHelp,'equity-grants','equity-contribution-a',key,value)
const equityModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:equityHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(equityModel.valid,true,equityModel.issues.join('; '))
assert.deepEqual(equityModel.financeInput.annualEquityContributions,[250,0])
assert.equal(equityModel.finalRun.finance.rows[0].equityContribution,250)

let depreciationAdjustmentHelp=helpForms.createBlankHelpDrivenProjectForms()
depreciationAdjustmentHelp=helpForms.addHelpFormRow(depreciationAdjustmentHelp,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true}))
 depreciationAdjustmentHelp=helpForms.updateHelpFormRow(depreciationAdjustmentHelp,'currencies','local-eur',key,value)
for(const [id,period,amount] of [['tax-dep-a','1',50],['tax-dep-b','2',-20]]){
 depreciationAdjustmentHelp=helpForms.addHelpFormRow(depreciationAdjustmentHelp,'depreciation-adjustments',id)
 for(const [key,value] of Object.entries({period,origin:'local',amount,currency:'EUR'}))
  depreciationAdjustmentHelp=helpForms.updateHelpFormRow(depreciationAdjustmentHelp,'depreciation-adjustments',id,key,value)
}
const depreciationAdjustmentModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:depreciationAdjustmentHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(depreciationAdjustmentModel.valid,true,depreciationAdjustmentModel.issues.join('; '))
assert.deepEqual(depreciationAdjustmentModel.financeInput.taxDepreciationAdjustmentsByPeriod,[50,-20])
assert.equal(depreciationAdjustmentModel.finalRun.finance.rows[0].taxDepreciationAdjustment,50)
assert.equal(depreciationAdjustmentModel.finalRun.finance.rows[0].tax,237.5)
assert.equal(depreciationAdjustmentModel.finalRun.finance.rows[1].tax,384)

// Target NPV search is connected to the raw-template sensitivity section.
let targetSensitivityHelp=helpForms.createBlankHelpDrivenProjectForms()
targetSensitivityHelp=helpForms.addHelpFormRow(targetSensitivityHelp,'sensitivity','target-npv-a')
for(const [key,value] of Object.entries({
 analysisType:'desired-npv',variableGroup:'sales-revenues',variableId:'total-revenue',targetNpv:result.finalRun.finance.npvProject,
 maxIncrease:10,maxDecrease:10,order:1,
})) targetSensitivityHelp=helpForms.updateHelpFormRow(targetSensitivityHelp,'sensitivity','target-npv-a',key,value)
const targetSensitivityModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:targetSensitivityHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(targetSensitivityModel.valid,true,targetSensitivityModel.issues.join('; '))
assert.equal(targetSensitivityModel.sensitivitySearches.length,1)
assert.equal(targetSensitivityModel.sensitivitySearches[0].result.achieved,true)
assert.equal(targetSensitivityModel.sensitivitySearches[0].result.iterations,0)
let unsupportedSensitivityHelp=helpForms.createBlankHelpDrivenProjectForms()
unsupportedSensitivityHelp=helpForms.addHelpFormRow(unsupportedSensitivityHelp,'sensitivity','global-sensitivity-a')
for(const [key,value] of Object.entries({
 analysisType:'global-input-variation',variableGroup:'sales-revenues',variableId:'total-revenue',
 maxIncrease:10,maxDecrease:10,order:1,
})) unsupportedSensitivityHelp=helpForms.updateHelpFormRow(unsupportedSensitivityHelp,'sensitivity','global-sensitivity-a',key,value)
const unsupportedSensitivityModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:unsupportedSensitivityHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(unsupportedSensitivityModel.valid,false)
assert.ok(unsupportedSensitivityModel.issues.some(issue=>issue.includes('Only target IRR and target NPV searches are currently supported')))

let unsupportedDiscountingHelp=helpForms.createBlankHelpDrivenProjectForms()
unsupportedDiscountingHelp=helpForms.updateHelpFormRow(unsupportedDiscountingHelp,'discounting','discounting-main','shortNpvYears',3)
const unsupportedDiscountingModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:unsupportedDiscountingHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(unsupportedDiscountingModel.valid,false)
assert.ok(unsupportedDiscountingModel.issues.some(issue=>issue.includes('discounting.shortNpvYears')&&issue.includes('not yet connected')))

for (const field of ['basis','daysCoverage','turnover']) {
 let unusedWorkingCapitalHelp=helpForms.createBlankHelpDrivenProjectForms()
 unusedWorkingCapitalHelp=helpForms.addHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field)
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,'item','Receivables')
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,'category','accounts-receivable')
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,'period','1')
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,'requiredValue',100)
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,'startingBalance',0)
 unusedWorkingCapitalHelp=helpForms.updateHelpFormRow(unusedWorkingCapitalHelp,'working-capital','unused-wc-'+field,field,field==='basis'?'cost-of-products-sold-operating-cost':30)
 const unusedWorkingCapitalModel=orchestrator.calculateProjectFinancialModelFromDrafts({
  finance,drafts:{...drafts,helpDriven:unusedWorkingCapitalHelp},foundation,productionStartDate:'2025-01-01',
  openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
  taxTreatment:'non-deductible',
 })
 assert.equal(unusedWorkingCapitalModel.valid,false,field+' must not be silently ignored')
 assert.ok(unusedWorkingCapitalModel.issues.some(issue=>issue.includes('working-capital.'+field)&&issue.includes('not yet connected')))
}


let incrementalHelp=helpForms.createBlankHelpDrivenProjectForms()
for(const [id,values] of [
 ['incremental-period-1',{alternative:'Upgrade A',view:'existing-with-project',period:'1',investmentDelta:100,depreciationDelta:0,financingDelta:50,assetOpportunityValue:20,workingCapitalDelta:5}],
 ['incremental-period-2',{alternative:'Upgrade A',view:'existing-with-project',period:'2',revenueDelta:80,costDelta:20,depreciationDelta:10,workingCapitalDelta:0}],
]){
 incrementalHelp=helpForms.addHelpFormRow(incrementalHelp,'incremental-analysis',id)
 for(const [key,value] of Object.entries(values))
  incrementalHelp=helpForms.updateHelpFormRow(incrementalHelp,'incremental-analysis',id,key,value)
}
const incrementalModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:incrementalHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(incrementalModel.valid,true,incrementalModel.issues.join('; '))
assert.equal(incrementalModel.incrementalAnalyses.length,1)
assert.equal(incrementalModel.incrementalAnalyses[0].alternative,'Upgrade A')
assert.equal(incrementalModel.incrementalAnalyses[0].view,'existing-with-project')
assert.deepEqual(incrementalModel.incrementalAnalyses[0].cashFlows,[-125,55])
assert.deepEqual(incrementalModel.incrementalAnalyses[0].financingDeltaByPeriod,[50,0])
assert.deepEqual(incrementalModel.incrementalAnalyses[0].taxDeltaByPeriod,[0,10])
assert.deepEqual(incrementalModel.incrementalAnalyses[0].workingCapitalDeltaByPeriod,[5,0])
assert.equal(incrementalModel.incrementalAnalyses[0].basis,'after-tax-unlevered')
let invalidIncrementalHelp=helpForms.createBlankHelpDrivenProjectForms()
invalidIncrementalHelp=helpForms.addHelpFormRow(invalidIncrementalHelp,'incremental-analysis','invalid-incremental-period')
for(const [key,value] of Object.entries({alternative:'Upgrade B',view:'project-in-isolation',period:'not-a-period',investmentDelta:10,depreciationDelta:0}))
 invalidIncrementalHelp=helpForms.updateHelpFormRow(invalidIncrementalHelp,'incremental-analysis','invalid-incremental-period',key,value)
const invalidIncrementalModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:invalidIncrementalHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(invalidIncrementalModel.valid,false)
assert.ok(invalidIncrementalModel.issues.some(issue=>issue.includes('incremental-analysis:0:period-outside-project-calendar:period:not-a-period')))
let missingIncrementalDepreciation=helpForms.createBlankHelpDrivenProjectForms()
missingIncrementalDepreciation=helpForms.addHelpFormRow(missingIncrementalDepreciation,'incremental-analysis','missing-incremental-depreciation')
for(const [key,value] of Object.entries({alternative:'Upgrade C',view:'project-in-isolation',period:'1',investmentDelta:100}))
 missingIncrementalDepreciation=helpForms.updateHelpFormRow(missingIncrementalDepreciation,'incremental-analysis','missing-incremental-depreciation',key,value)
assert.ok(helpForms.validateHelpDrivenProjectForms(missingIncrementalDepreciation).some(issue=>issue.includes('depreciationDelta-required-when-investment-is-entered')))

// Detailed raw-template opening balances feed the same opening balances and depreciation schedule as the summary form.
let startingBalanceHelp=helpForms.createBlankHelpDrivenProjectForms()
startingBalanceHelp=helpForms.addHelpFormRow(startingBalanceHelp,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true}))
 startingBalanceHelp=helpForms.updateHelpFormRow(startingBalanceHelp,'currencies','local-eur',key,value)
const addOpeningRow=(id,values)=>{
 startingBalanceHelp=helpForms.addHelpFormRow(startingBalanceHelp,'starting-balances',id)
 for(const [key,value] of Object.entries(values))
  startingBalanceHelp=helpForms.updateHelpFormRow(startingBalanceHelp,'starting-balances',id,key,value)
}
addOpeningRow('opening-cash',{category:'cash-in-hand',item:'Opening cash',currency:'EUR',origin:'local',amount:10})
addOpeningRow('opening-inventory',{category:'materials-supplies',item:'Opening materials',currency:'EUR',origin:'local',amount:20})
addOpeningRow('opening-payables',{category:'accounts-payable',item:'Trade payables',currency:'EUR',origin:'local',amount:3})
addOpeningRow('opening-fixed-assets',{category:'fixed-assets',item:'Existing machinery',currency:'EUR',origin:'local',amount:100,depreciationMethod:'linear-to-zero',remainingLife:5})
addOpeningRow('opening-debt',{category:'long-term-debt',item:'Legacy debt',currency:'EUR',origin:'local',amount:50})
addOpeningRow('opening-equity',{category:'equity-capital',item:'Paid-in capital',currency:'EUR',origin:'local',amount:40})
addOpeningRow('opening-retained',{category:'retained-earnings',item:'Retained earnings',currency:'EUR',origin:'local',amount:37})
assert.deepEqual(helpForms.validateHelpDrivenProjectForms(startingBalanceHelp),[])
const startingBalanceModel=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts:{...drafts,helpDriven:startingBalanceHelp},foundation,productionStartDate:'2025-01-01',
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(startingBalanceModel.valid,true,startingBalanceModel.issues.join('; '))
assert.equal(startingBalanceModel.startingBalances.valid,true)
assert.equal(startingBalanceModel.startingBalances.openingAssets,127)
assert.equal(startingBalanceModel.startingBalances.openingLiabilitiesAndEquity,127)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.cash,10)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.netWorkingCapital,17)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.netFixedAssets,100)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.debt,50)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.paidInCapital,40)
assert.equal(startingBalanceModel.finalRun.statements[0].openingBalances.retainedEarnings,37)
assert.deepEqual(startingBalanceModel.financeInput.annualDepreciation,[20,20])
assert.equal(startingBalanceModel.financeInput.openingWorkingCapital,17)
assert.equal(startingBalanceModel.finalRun.finance.rows[0].depreciation,20)
assert.equal(startingBalanceModel.finalRun.statements[0].balanceSheet.reconciled,true)

const startingBalanceAdapter=await import(startingBalanceUrl)
const fxStartingBalances=[
 {id:'fx-cash-local',values:{category:'cash-in-hand',item:'Local cash',currency:'EUR',origin:'local',amount:10}},
 {id:'fx-cash-usd',values:{category:'cash-in-hand',item:'USD cash',currency:'USD',origin:'foreign',amount:10}},
 {id:'fx-inventory',values:{category:'materials-supplies',item:'Materials',currency:'EUR',origin:'local',amount:20}},
 {id:'fx-payables',values:{category:'accounts-payable',item:'Payables',currency:'EUR',origin:'local',amount:3}},
 {id:'fx-fixed',values:{category:'fixed-assets',item:'Plant',currency:'EUR',origin:'local',amount:100,depreciationMethod:'linear-to-zero',remainingLife:5}},
 {id:'fx-debt',values:{category:'long-term-debt',item:'Debt',currency:'EUR',origin:'local',amount:50}},
 {id:'fx-equity',values:{category:'equity-capital',item:'Capital',currency:'EUR',origin:'local',amount:40}},
 {id:'fx-retained',values:{category:'retained-earnings',item:'Retained',currency:'EUR',origin:'local',amount:48}},
]
const fxOpeningCurrencies={...foundation.currencies,foreignCurrencies:[{code:'USD',name:'US Dollar',exchangeRates:[{period:'1',rateToLocal:1.1},{period:'2',rateToLocal:1.2}]}]}
const foreignOpeningResult=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:[fxStartingBalances.find(row=>row.id==='fx-cash-usd')],periods,finance,currencies:fxOpeningCurrencies,
})
assert.equal(foreignOpeningResult.valid,false)
assert.ok(foreignOpeningResult.issues.some(issue=>issue.includes('period-by-period monetary revaluation')))
const localOnlyStartingBalances=fxStartingBalances.filter(row=>row.id!=='fx-cash-usd').map(row=>row.id==='fx-retained'?{...row,values:{...row.values,amount:37}}:row)
const explicitDepreciationFinance={...finance,periodDepreciationSchedule:[10,10],annualDepreciation:[10,10]}
const explicitDepreciationResult=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:[{id:'explicit-period-asset',values:{category:'fixed-assets',item:'Existing machine',currency:'EUR',origin:'local',amount:100,depreciationMethod:'linear-to-zero',remainingLife:5}}],
 periods,finance:explicitDepreciationFinance,currencies:foundation.currencies,
})
assert.equal(explicitDepreciationResult.valid,true,explicitDepreciationResult.issues.join('; '))
assert.deepEqual(explicitDepreciationResult.financeInput.annualDepreciation,[30,30])
assert.deepEqual(explicitDepreciationResult.financeInput.periodDepreciationSchedule,[30,30])

const ambiguousOpening=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:[{id:'ambiguous',values:{category:'other-assets',item:'Unclassified asset',currency:'EUR',origin:'local',amount:10}}],
 periods,finance,currencies:foundation.currencies,
})
assert.equal(ambiguousOpening.valid,false)
assert.ok(ambiguousOpening.issues.some(issue=>issue.includes('category other-assets is ambiguous')))
const mismatchedOpening=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:localOnlyStartingBalances.slice(0,-1),periods,finance,currencies:foundation.currencies,
})
assert.equal(mismatchedOpening.valid,false)
assert.ok(mismatchedOpening.issues.some(issue=>issue.includes('do not reconcile')))
const conflictingOpening=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:localOnlyStartingBalances,periods,finance,currencies:foundation.currencies,summaryOpeningBalanceEnabled:true,
})
assert.equal(conflictingOpening.valid,false)
assert.ok(conflictingOpening.issues.some(issue=>issue.includes('cannot be combined')))
const unsupportedExistingAsset=startingBalanceAdapter.bindStartingBalancesToPeriodicFinance({
 rows:[{id:'unsupported-depreciation',values:{category:'fixed-assets',item:'Machine',currency:'EUR',origin:'local',amount:100,depreciationMethod:'accelerated-declining-balance',remainingLife:5}}],
 periods,finance,currencies:foundation.currencies,
})
assert.equal(unsupportedExistingAsset.valid,false)
assert.ok(unsupportedExistingAsset.issues.some(issue=>issue.includes('only supports linear-to-zero')))

console.log('Unified project form orchestration, shareholder model, and raw-template opening-balance integration passed.')
