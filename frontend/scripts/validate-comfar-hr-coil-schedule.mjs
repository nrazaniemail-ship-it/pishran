import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'

const source=await readFile(new URL('../src/features/projects/comfarProjectInputData.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {COMFAR_PROJECT_INPUTS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const input=COMFAR_PROJECT_INPUTS['comfar-hr-coil-200k']
assert.ok(input,'The 200 kt hot-rolled coil reference project must exist')
assert.equal(input.operatingCostSchedule?.length,15,'Pages 24–27 must cover every operating year from 1405 through 1419')
const byYear=new Map(input.operatingCostSchedule.map(row=>[row.period,row]))
const sum=year=>byYear.get(String(year)).rows.reduce((total,row)=>total+row.amount,0)
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,label+': expected '+expected+', got '+actual)
close(sum(1405),30534338.52,'COMFAR page 24 factory cost 1405')
close(sum(1406),34345881.44,'COMFAR page 24 factory cost 1406')
close(sum(1407),38503928.26,'COMFAR page 24 factory cost 1407')
close(sum(1408),42661975.08,'COMFAR page 24 factory cost 1408')
for(let year=1409;year<=1419;year++)close(sum(year),42604224.43,'COMFAR pages 25–27 factory cost '+year)
close(sum(1408)-sum(1409),57750.65,'Documented source-table difference between page 24 and page 25')
assert.equal(input.productionSalesSchedule.length,15)
for(const row of input.productionSalesSchedule){
 close(row.openingInventory+row.production-row.sales,row.closingInventory,'Production/inventory roll-forward '+row.period,0.02)
 close(row.sales*row.netUnitPrice,row.salesRevenue,'Product sales revenue '+row.period,0.02)
}
assert.equal(input.productionSalesSchedule[0].period,'1405')
assert.equal(input.productionSalesSchedule[0].production,141944.44)
assert.equal(input.productionSalesSchedule[0].sales,140000)
assert.equal(input.productionSalesSchedule.at(-1).period,'1419')
assert.equal(input.productionSalesSchedule.at(-1).sales,200000)
assert.equal(input.byproductSalesSchedule.length,15,'Scrape# source schedule must cover all operating years')
for(const row of input.byproductSalesSchedule){
 close(row.sales*row.netUnitPrice,row.salesRevenue,'Scrape# sales revenue '+row.period,0.02)
 close(row.openingInventory+row.production-row.sales,row.closingInventory,'Scrape# inventory roll-forward '+row.period,0.02)
}
assert.equal(input.financingSchedule.length,7)
close(input.financingSchedule[0].loanDisbursement,3816496,'1403 documented drawdown')
close(input.financingSchedule[1].loanDisbursement,1794355,'1404 documented drawdown')
close(input.financingSchedule[1].closingDebt,8909484.06,'1404 closing debt')
assert.ok(input.depreciationSchedule?.length,'COMFAR aggregate depreciation output must remain available as a reference')
assert.ok(input.missingSourceDetails.includes('عمر مفید و روش استهلاک تفکیکی هر دارایی'),'The HRCR200 source must disclose the missing asset-by-asset depreciation evidence')

const formulaSource=await readFile(new URL('../src/features/projects/projectModelFormulaRules.ts',import.meta.url),'utf8')
const formulaUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(formulaSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const financialSource=await readFile(new URL('../src/features/steel/financialModel.ts',import.meta.url),'utf8')
let financialJs=ts.transpileModule(financialSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
financialJs=financialJs.replace(/from ['"]\.\.\/projects\/projectModelFormulaRules['"]/, 'from "'+formulaUrl+'"')
const financialUrl='data:text/javascript;base64,'+Buffer.from(financialJs).toString('base64')
const financial=await import(financialUrl)
const testAsset={
 id:'asset-evidence-test',description:'ماشین‌آلات نمونه',assetClass:'machinery',origin:'local',currencyCode:'IRR',costCentreId:'',
 depreciation:{method:'linear-zero',startingAt:'1403',ratePercent:null,lengthYears:5,lengthMonths:0,firstDepreciationMonths:12,scrapPercent:0},
 depreciationBasis:'unresolved',
 acquisitions:[{id:'asset-evidence-acq',period:'1403',quantity:1,unitPrice:1000,currencyCode:'IRR',exchangeRateToLocal:null,allocationBasis:'source-period'}],
 sales:[],
}
const unresolvedDepreciation=financial.buildComfarDepreciationAssetsFromFixedInvestmentItems([testAsset],1403,3,'annual')
assert.equal(unresolvedDepreciation.assets[0]?.method,'none','An unresolved asset must stay on book cost without calculated depreciation')
const unresolvedLifecycle=financial.calculateComfarAssetLifecycle(unresolvedDepreciation.assets,[],3)
assert.equal(unresolvedLifecycle.depreciation.periods.reduce((total,row)=>total+row.depreciation,0),0,'Unverified depreciation must be zero in the integrated asset lifecycle')
const conflictedDepreciation=financial.buildComfarDepreciationAssetsFromFixedInvestmentItems([{...testAsset,depreciationBasis:'source-conflict'}],1403,3,'annual')
assert.equal(conflictedDepreciation.assets[0]?.method,'none','Conflicting depreciation evidence must not produce depreciation')
const unverifiedSourceDepreciation=financial.buildComfarDepreciationAssetsFromFixedInvestmentItems([{...testAsset,depreciationBasis:'source-table'}],1403,3,'annual')
assert.equal(unverifiedSourceDepreciation.assets[0]?.method,'none','A source-table label without a document reference and verification must not calculate depreciation')
const documentedDepreciation=financial.buildComfarDepreciationAssetsFromFixedInvestmentItems([{
 ...testAsset,depreciationBasis:'source-table',depreciationEvidenceReference:'Asset register, asset 001, page 4',depreciationEvidenceVerified:true,
}],1403,3,'annual')
assert.equal(documentedDepreciation.assets[0]?.method,'linear-to-zero','A referenced and verified asset-by-asset source may calculate depreciation')
const documentedLifecycle=financial.calculateComfarAssetLifecycle(documentedDepreciation.assets,[],3)
close(documentedLifecycle.depreciation.periods[0].depreciation,200,'Documented 1,000 cost / 5-year asset depreciation')
const confirmedDepreciation=financial.buildComfarDepreciationAssetsFromFixedInvestmentItems([{
 ...testAsset,depreciationBasis:'user-confirmed',depreciationEvidenceReference:'User note',depreciationEvidenceVerified:true,
}],1403,3,'annual')
assert.equal(confirmedDepreciation.assets[0]?.method,'none','User confirmation without an asset-by-asset source document must not calculate depreciation')
const engineSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const engineUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(engineSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const engine=await import(engineUrl)
const flowSource=await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts',import.meta.url),'utf8')
const flowUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(flowSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const controlSource=await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts',import.meta.url),'utf8')
const controlUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(controlSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const operatingSource=await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8')
let operatingJs=ts.transpileModule(operatingSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
operatingJs=operatingJs.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
 .replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl))
 .replace("'./inventoryControlLedgers'",JSON.stringify(controlUrl))
const operating=await import('data:text/javascript;base64,'+Buffer.from(operatingJs).toString('base64'))
const periods=Array.from({length:18},(_,index)=>({index:index+1,startDate:String(2024+index)+'-01-01',endDate:String(2024+index)+'-12-31',days:365,partial:false}))
const mainProductId='hr-coil-main'
const salesPeriods=[
 {period:'1',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 {period:'2',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 ...input.productionSalesSchedule.map(row=>({...row,period:String(Number(row.period)-1403+1)})),
].map(row=>({
 period:row.period,salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,salesTaxPercent:0,
 subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:row.openingInventory,
 openingFinishedGoodsValue:row.openingInventory===0?0:null,finishedGoodsClosingQuantity:row.closingInventory,
 rawMaterialPurchasesQuantity:null,rawMaterialPurchasesValue:null,rawMaterialConsumptionQuantity:null,
 normalRawMaterialWasteQuantity:null,abnormalRawMaterialWasteQuantity:null,unitsStarted:null,unitsCompleted:null,closingWipQuantity:null,materialCompletionPercent:null,
 conversionCompletionPercent:null,conversionCost:null,openingRawMaterialQuantity:null,
 openingRawMaterialValue:null,openingWipQuantity:null,openingWipMaterialValue:null,openingWipConversionValue:null,
}))
const productionCosts=input.operatingCostSchedule[0].rows.map((sourceRow,rowIndex)=>({
 id:'hr-coil-cost-'+rowIndex,
 metadata:{description:sourceRow.name,currencyCode:'IRR',marketOrigin:'local',escalationPercent:0,remarks:'COMFAR pp.24-27',costCentreId:null},
 classification:'direct',productId:mainProductId,basis:'period-adjustments',
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,
 fixedPercent:null,variablePercent:null,
 adjustments:input.operatingCostSchedule.map(period=>({period:String(Number(period.period)-1403+1),
  quantity:null,unitPrice:null,total:period.rows[rowIndex].amount,fixedPercent:null,variablePercent:null})),
}))
const byproductId='hr-coil-scrape'
const byproductPeriods=[
 {period:'1',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 {period:'2',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
 ...input.byproductSalesSchedule.map(row=>({...row,period:String(Number(row.period)-1403+1)})),
].map(row=>({
 period:row.period,salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,salesTaxPercent:0,
 subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:row.openingInventory,
 openingFinishedGoodsValue:row.openingInventory===0?0:null,finishedGoodsClosingQuantity:row.closingInventory,
 rawMaterialPurchasesQuantity:null,rawMaterialPurchasesValue:null,rawMaterialConsumptionQuantity:null,
 normalRawMaterialWasteQuantity:null,abnormalRawMaterialWasteQuantity:null,unitsStarted:null,unitsCompleted:null,
 closingWipQuantity:null,materialCompletionPercent:null,conversionCompletionPercent:null,conversionCost:null,
 openingRawMaterialQuantity:null,openingRawMaterialValue:null,openingWipQuantity:null,openingWipMaterialValue:null,openingWipConversionValue:null,
}))
productionCosts.push({
 id:'hr-coil-byproduct-cost',metadata:{description:'No separate byproduct production cost disclosed',currencyCode:'IRR',marketOrigin:'local',escalationPercent:0,remarks:'COMFAR pp.39-42; no separate cost schedule disclosed',costCentreId:null},
 classification:'direct',productId:byproductId,basis:'period-adjustments',
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,fixedPercent:null,variablePercent:null,
 adjustments:input.byproductSalesSchedule.map(row=>({period:String(Number(row.period)-1403+1),quantity:null,unitPrice:null,total:0,fixedPercent:null,variablePercent:null})),
})
const productSchedule=operating.buildProductOperatingSchedule({
 sales:[
  {productId:mainProductId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,productionStartPeriod:3,productionEndPeriod:17,periods:salesPeriods},
  {productId:byproductId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,productionStartPeriod:3,productionEndPeriod:17,periods:byproductPeriods},
 ],
 productionCosts,
},periods,3,'IRR')
assert.equal(productSchedule.valid,true,productSchedule.issues.join('; '))
assert.equal(productSchedule.rows.find(row=>row.period===3)?.productionQuantity,141944.44)
close(productSchedule.periodRevenue[2],43581720,'Product engine 1405 total sales including Scrape#')
close(productSchedule.periodRevenue[7],62259600,'Product engine 1408 total sales including Scrape#')
close(productSchedule.rows.find(row=>row.productId===byproductId&&row.period===3)?.productionQuantity,2838.89,'Scrape# 1405 production')
close(productSchedule.periodCostOfSales[2],30116060.85,'Product engine 1405 weighted-average cost of sales',0.02)
close(productSchedule.rows.find(row=>row.period===3)?.productionCost,30534338.52,'Product engine 1405 detailed factory production cost')
assert.equal(productSchedule.periodRevenue.length,18,'The product program must include the non-operating liquidation period')
assert.equal(productSchedule.periodRevenue[17],0,'The liquidation period must not create product sales')

const taxDraftSource=await readFile(new URL('../src/features/projects/projectTaxDraftIntegration.ts',import.meta.url),'utf8')
let taxDraftJs=ts.transpileModule(taxDraftSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
taxDraftJs=taxDraftJs.replace(/from ['"]\.\.\/steel\/periodicFinancialEngine['"]/, 'from "'+engineUrl+'"')
const taxDraftUrl='data:text/javascript;base64,'+Buffer.from(taxDraftJs).toString('base64')
const taxDraftModule=await import(taxDraftUrl)
const taxSourceRows=input.taxAmountSchedule.map(row=>({
 period:String(Number(row.period)-1403+1),amount:row.amount,sourceReference:row.sourceReference,sourceVerified:true,
}))
const taxSchedule=taxDraftModule.buildProjectTaxDraftSchedule({
 system:'corporate',rates:[],documentedAmounts:taxSourceRows,allowances:[],
 lossCarryForward:null,lossCarryForwardYears:null,openingLossVintages:[],
},periods,1)
assert.equal(taxSchedule.valid,true,taxSchedule.issues.join('; '))
assert.equal(taxSchedule.taxAmountOverridesByPeriod.length,18,'Documented tax schedule must cover all 18 project periods')
close(taxSchedule.taxAmountOverridesByPeriod[2],477888.91,'COMFAR page 59 documented 1405 tax')
close(taxSchedule.taxAmountOverridesByPeriod[17],0,'COMFAR page 62 documented 1420 tax')
assert.equal(taxSchedule.annualTaxRates.every(rate=>rate===0),true,'Amount-based tax must not invent a tax-rate schedule')

const workingCapitalSource=await readFile(new URL('../src/features/projects/workingCapitalDraftIntegration.ts',import.meta.url),'utf8')
const workingCapitalUrl='data:text/javascript;base64,'+Buffer.from(ts.transpileModule(workingCapitalSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64')
const workingCapitalModule=await import(workingCapitalUrl)
const workingCapitalDrafts={workingCapital:[
 {id:'hrcr200-inventory',name:'Inventory',category:'inventory',minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',periodBalances:input.workingCapital.map(row=>({period:String(Number(row.period)-1403+1),amount:row.inventory}))},
 {id:'hrcr200-cash',name:'Cash',category:'cash',minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',periodBalances:input.workingCapital.map(row=>({period:String(Number(row.period)-1403+1),amount:row.cash}))},
]}
const preserveWorkingCapital=workingCapitalModule.buildWorkingCapitalScheduleFromDrafts(workingCapitalDrafts,periods,0,false)
assert.equal(preserveWorkingCapital.valid,true,preserveWorkingCapital.issues.join('; '))
close(preserveWorkingCapital.terminalRecoveryAmount,0,'COMFAR terminal working capital is not separately recovered')
close(preserveWorkingCapital.closingWorkingCapital[17],4595370.36,'COMFAR terminal working-capital balance remains on the balance sheet')
close(preserveWorkingCapital.changeInWorkingCapital[17],0,'No unsupported terminal working-capital release is added')
const defaultWorkingCapital=workingCapitalModule.buildWorkingCapitalScheduleFromDrafts(workingCapitalDrafts,periods,0)
close(defaultWorkingCapital.terminalRecoveryAmount,4595370.36,'Default models retain the existing terminal working-capital recovery behavior')

const amountByPeriod=(rows,amountOf)=>Array.from({length:18},(_,index)=>rows.filter(row=>Number(row.period)-1403===index).reduce((sum,row)=>sum+amountOf(row),0))
const fixedInvestmentByPeriod=amountByPeriod(input.fixedInvestment.flatMap(item=>item.periods),row=>row.amount)
const preOperatingByPeriod=amountByPeriod(input.preproduction,row=>row.net+row.capitalizedInterest)
const workingCapitalByPeriod=amountByPeriod(input.workingCapital,row=>row.inventory+row.cash-(row.payables??0))
const otherIncomeByPeriod=amountByPeriod(input.otherIncomeSchedule??[],row=>row.amount)
const periodicResult=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,constructionPeriodCount:2,dayCountBasis:360,cashFlowTiming:'period-end',
 annualRevenue:productSchedule.periodRevenue,periodRevenue:productSchedule.periodRevenue,periodSubsidyIncome:Array(18).fill(0),
 periodOtherIncomeByPeriod:otherIncomeByPeriod,periodOtherIncomeSourceReference:input.otherIncomeSchedule[0].sourceReference,
 annualVariableCost:productSchedule.periodCostOfSales,periodVariableCost:productSchedule.periodCostOfSales,
 annualFixedCost:Array(18).fill(0),annualDepreciation:Array(18).fill(0),
 annualFixedInvestment:fixedInvestmentByPeriod,annualPreOperatingCost:preOperatingByPeriod,
 annualMaintenanceCapex:Array(18).fill(0),annualTaxRates:taxSchedule.annualTaxRates,
 taxRatesByPeriod:taxSchedule.taxRatesByPeriod,taxAmountOverridesByPeriod:taxSchedule.taxAmountOverridesByPeriod,
 taxAmountSourceReference:taxSchedule.taxAmountSourceReference,
 taxableDeductionsByPeriod:taxSchedule.taxableDeductionsByPeriod,taxCreditsByPeriod:taxSchedule.taxCreditsByPeriod,
 annualEquityContributions:Array(18).fill(0),annualEquityWorkingCapitalContributions:Array(18).fill(0),
 workingCapitalByPeriod,annualShortTermDepositInterest:Array(18).fill(0),
 loans:[],openingWorkingCapital:0,openingCash:0,taxLossCarryForwardEnabled:false,
 discountRatePercent:25,valuationDate:'2026-03-20',discountConvention:'period-count',
})
assert.equal(periodicResult.valid,true,periodicResult.issues.join('; '))
assert.equal(periodicResult.rows.length,18,'Integrated finance engine must return all 18 project periods')
close(periodicResult.rows[0].projectFreeCashFlow,-13907805.03,'COMFAR page 67 first construction-period cash flow')
close(periodicResult.rows[1].projectFreeCashFlow,-8093664.03,'COMFAR page 67 second construction-period cash flow')
close(periodicResult.rows[2].revenue,43581720,'Integrated engine receives 1405 product-program revenue')
close(periodicResult.rows[2].tax,477888.91,'Integrated engine applies documented 1405 tax amount')
assert.equal(periodicResult.rows[2].taxRatePercent,null,'Documented tax amount must not be represented as an inferred rate')
close(periodicResult.rows[2].depreciation,0,'No asset-level depreciation evidence means no depreciation charge')
close(periodicResult.rows[17].otherIncome,13735466.82,'COMFAR page 62/71 documented liquidation-period other income')
close(periodicResult.rows[17].projectFreeCashFlow,13735466.82,'COMFAR page 71 terminal cash flow')
// Page 1–2 summary values are kept as explicit reconciliation targets.
const page1={totalInvestment:26596839.42,totalFunding:25310613.59,totalEquity:16401129.53,totalLongTermDebt:8909484.06}
const page2={revenue1405:43581720,revenue1408:62259600,factoryCost1405:30130083.97,factoryCost1408:42604224.43,
 npvProject:31399764.27,irrProjectPercent:48.31,npvEquity:23579675.01,irrEquityPercent:57.99}
close(productSchedule.periodRevenue[2],page2.revenue1405,'Page 2 first-year total sales')
close(productSchedule.periodRevenue[7],page2.revenue1408,'Page 2 reference-year total sales')
close(page1.totalInvestment-page1.totalFunding,1286225.83,'Page 1 investment/funding bridge')
close(page1.totalEquity+page1.totalLongTermDebt,page1.totalFunding,'Page 1 funding composition')
close(sum(1405)-page2.factoryCost1405,404254.55,'Page 2 vs page 24 factory cost discrepancy in 1405')
close(sum(1408)-page2.factoryCost1408,57750.65,'Page 2 vs page 24 factory cost discrepancy in 1408')
assert.equal(page2.npvProject,31399764.27)
assert.equal(page2.irrProjectPercent,48.31)
assert.equal(page2.npvEquity,23579675.01)
assert.equal(page2.irrEquityPercent,57.99)
const projectDiscountedFlows=[-17384756.29,-8093664.03,7681874.07,9249148.03,8378728.89,7496952.94,6131826.91,3938468.45,3150774.76,2520619.81,2016495.85,1580499.30,1264399.44,1011519.55,809156.54,646953.66,517492.61,483273.78]
const equityDiscountedFlows=[-11576704.49,-4186827.70,4798748.86,6560843.04,5917494.67,5230607.72,4133900.08,3112628.82,2394329.87,1841792.20,1416763.23,1067728.70,821329.77,631792.13,485958.45,373599.62,287345.28,268344.77]
close(projectDiscountedFlows.reduce((total,value)=>total+value,0),page2.npvProject,'COMFAR pages 67–71 total-project NPV',0.02)
close(equityDiscountedFlows.reduce((total,value)=>total+value,0),page2.npvEquity,'COMFAR pages 76–80 equity NPV',0.02)
const projectNetCashFlows=[-13907805.03,-8093664.03,9602342.59,14451793.80,16364704.85,18303107.76,18712850.68,15024064.82,15024064.82,15024064.82,15024064.82,14719546.80,14719546.80,14719546.80,14718471.78,14710023.10,14708024.54,13735466.82]
const equityNetCashFlows=[-8905157.30,-4186827.70,6238373.52,11087824.73,13000735.79,14939138.70,15348881.62,15024064.82,15024064.82,15024064.82,15024064.82,14719546.80,14719546.80,14719546.80,14718471.78,14710023.10,14708024.54,13735466.82]
const irr=flows=>{
 let low=-0.99,high=2
 const value=rate=>flows.reduce((total,flow,index)=>total+flow/Math.pow(1+rate,index),0)
 for(let iteration=0;iteration<120;iteration++){
  const mid=(low+high)/2
  if(value(mid)>0)low=mid;else high=mid
 }
 return (low+high)/2
}
close(irr(projectNetCashFlows),page2.irrProjectPercent/100,'COMFAR total-project IRR from page 67–71 cash flows',0.0002)
close(irr(equityNetCashFlows),page2.irrEquityPercent/100,'COMFAR equity IRR from page 76–80 cash flows',0.0002)
console.log('Hot-rolled coil product-by-product operating schedule and page 1–2 source reconciliation checks passed.')
console.log('Hot-rolled coil COMFAR annual sales, factory-cost and debt-source schedules passed independent source-data checks.')
