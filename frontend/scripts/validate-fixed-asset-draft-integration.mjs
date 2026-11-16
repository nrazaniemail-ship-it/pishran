import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function compile(path) {
 const source=await readFile(new URL(path,import.meta.url),'utf8')
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
}
const engineUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/steel/periodicFinancialEngine.ts')).toString('base64')
const helpFormsUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/projects/projectModelHelpForms.ts')).toString('base64')
let draftOutput=await compile('../src/features/projects/projectModelFormDrafts.ts')
draftOutput=draftOutput.replace("'./projectModelHelpForms'",JSON.stringify(helpFormsUrl))
const draftUrl='data:text/javascript;base64,'+Buffer.from(draftOutput).toString('base64')
let adapterOutput=await compile('../src/features/projects/fixedAssetDraftIntegration.ts')
adapterOutput=adapterOutput.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
adapterOutput=adapterOutput.replace("'./projectModelFormDrafts'",JSON.stringify(draftUrl))
const adapter=await import('data:text/javascript;base64,'+Buffer.from(adapterOutput).toString('base64'))
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
const asset={
 id:'press-1',
 metadata:{description:'Press line',currencyCode:'USD',marketOrigin:'foreign',escalationPercent:null,remarks:'',costCentreId:null},
 acquisitionPeriods:[{period:'1',quantity:1,unitPrice:1000,total:1000}],
 depreciation:{method:'linear-to-scrap',startMode:'production-start',startDate:'',firstDepreciationYearMonths:12,ratePercent:null,usefulLifeMonths:24,salvagePercent:10},
 disposal:{date:'2027-12-31',proceeds:1500},
}
const finance={
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[0,300,300],annualVariableCost:[0,50,50],annualFixedCost:[0,20,20],
 annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],
 annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
 annualTaxRates:[25,25,25],annualEquityContributions:[1000,0,0],
 annualEquityWorkingCapitalContributions:[0,0,0],workingCapitalByPeriod:[0,0,0],
 openingWorkingCapital:0,loans:[],discountRatePercent:10,
}
const result=adapter.bindFixedAssetDraftsToPeriodicFinance({
 finance,assets:[asset],foundation,productionStartDate:'2026-01-01',
})
assert.equal(result.valid,true,result.issues.join('; '))
assert.equal(result.assets.length,1)
assert.equal(result.assets[0].originalValue,900)
assert.deepEqual(result.financeInput.periodDepreciationSchedule.map(x=>Math.round(x*100)/100),[0,405,405])
assert.deepEqual(result.financeInput.annualFixedInvestment,[900,0,0])
assert.deepEqual(result.financeInput.annualDepreciation.map(x=>Math.round(x*100)/100),[0,405,405])
assert.deepEqual(result.financeInput.annualDepreciation.map((amount,year)=>Math.round((amount-periods.reduce((sum,period,index)=>period.index===year+1?sum+(result.financeInput.periodDepreciationSchedule?.[index]??0):sum,0))*100)/100),[0,0,0])
assert.equal(result.financeInput.periodAssetSaleSchedule[2].saleProceeds,1500)
assert.equal(result.financeInput.periodAssetSaleSchedule[2].bookValueDisposed,90)
assert.equal(result.financeInput.periodAssetSaleSchedule[2].otherIncomeLoss,1410)
const integrated=engine.calculateIntegratedPeriodicFinance(result.financeInput)
assert.equal(integrated.valid,true,integrated.warnings.join('; '))
const statements=engine.buildPeriodicThreeFinancialStatements(integrated,{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0})
assert.equal(statements.length,periods.length)
assert.ok(statements.every(row=>row.balanceSheet.reconciled),'Annual asset depreciation and disposal must reconcile all three financial statements period by period')

const missingRate=adapter.bindFixedAssetDraftsToPeriodicFinance({
 finance,assets:[{...asset,metadata:{...asset.metadata,currencyCode:'GBP'}}],foundation,productionStartDate:'2026-01-01',
})
assert.equal(missingRate.valid,false)
assert.ok(missingRate.issues.some(x=>x.includes('exchange rate')))

const disposalLoss=adapter.bindFixedAssetDraftsToPeriodicFinance({
 finance,assets:[{...asset,disposal:{date:'2027-12-31',proceeds:10}}],foundation,productionStartDate:'2026-01-01',
})
assert.equal(disposalLoss.valid,true,disposalLoss.issues.join('; '))
assert.equal(disposalLoss.financeInput.periodAssetSaleSchedule[2].returnOfCapital,10)
assert.equal(disposalLoss.financeInput.periodAssetSaleSchedule[2].otherIncomeLoss,-80)
const lossIntegrated=engine.calculateIntegratedPeriodicFinance(disposalLoss.financeInput)
assert.equal(lossIntegrated.valid,true,lossIntegrated.warnings.join('; '))
const lossStatements=engine.buildPeriodicThreeFinancialStatements(lossIntegrated,{cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0})
assert.equal(lossStatements.length,periods.length)
assert.ok(lossStatements.every(row=>row.balanceSheet.reconciled),'Asset disposal losses must reconcile income, cash flow and balance sheet')

console.log('Fixed-asset acquisition, FX valuation, depreciation, disposal and periodic finance binding validation passed.')
