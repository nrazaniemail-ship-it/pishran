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
const loanUrl=url(loanOutput)
let orchestratorOutput=await transpile('../src/features/projects/projectFinancialModelOrchestrator.ts')
orchestratorOutput=orchestratorOutput.replace("'./productionSalesInventoryIntegration'",JSON.stringify(productionUrl))
 .replace("'./workingCapitalDraftIntegration'",JSON.stringify(workingCapitalUrl))
 .replace("'./fixedAssetDraftIntegration'",JSON.stringify(fixedUrl))
 .replace("'./foreignCurrencyLoanFinanceBinding'",JSON.stringify(loanUrl))
const orchestrator=await import(url(orchestratorOutput))

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
]
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
 sales:[{productId:'finished-product',periods:[
  {period:'1',salesQuantity:10,netUnitPrice:100,salesTaxPercent:0,subsidyPercent:0,subsidyAmount:null,finishedGoodsClosingQuantity:0},
  {period:'2',salesQuantity:20,netUnitPrice:100,salesTaxPercent:0,subsidyPercent:0,subsidyAmount:null,finishedGoodsClosingQuantity:0},
 ]}],
 productionCosts:[],
 workingCapital:[{id:'cash',name:'Operating cash',category:'cash',minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',
  periodBalances:[{period:'1',amount:0},{period:'2',amount:0}]}],
 assets:[],loans:[],
}
const result=orchestrator.calculateProjectFinancialModelFromDrafts({
 finance,drafts,foundation,productionStartDate:'2025-01-01',
 openingFinishedGoodsByProduct:{'finished-product':0},openingWorkingCapital:0,
 openingBalances:{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0},
 taxTreatment:'non-deductible',
})
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.financeInput.annualRevenue,[1000,2000])
assert.deepEqual(result.financeInput.workingCapitalByPeriod,[0,0])
assert.equal(result.finalRun.finance.valid,true)
assert.equal(result.finalRun.statements.length,2)
assert.ok(result.finalRun.statements.every(row=>row.balanceSheet.reconciled))
console.log('Unified project form orchestration validation passed.')
