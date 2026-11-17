import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const compile = async (relativePath, replacements = []) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  let output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const [search, replacement] of replacements) output = output.replace(search, replacement)
  return 'data:text/javascript;base64,' + Buffer.from(output).toString('base64')
}
const load = async relativePath => import(await compile(relativePath))
const formulaRulesUrl = await compile('../src/features/projects/projectModelFormulaRules.ts')
const engineUrl = await compile('../src/features/steel/financialModel.ts', [
  ["from '../projects/projectModelFormulaRules'", `from '${formulaRulesUrl}'`]
])
const [engine, foundation] = await Promise.all([
  import(engineUrl),
  load('../src/features/projects/projectFoundation.ts')
])
const near = (actual, expected, tolerance, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<=tolerance, label+': '+actual+' vs '+expected)

near(engine.calculateNpv([-100,60,60],0.1),4.13223140495867,1e-8,'NPV calculation')
near(engine.calculateIrr([-100,60,60]),0.1306623862918075,1e-8,'IRR calculation')
assert.ok(engine.calculateMirr([-100,60,60],0.1,0.1)!==null,'MIRR must be calculable for a conventional investment cash flow')
const wacc=engine.calculateWacc({equityWeight:60,debtWeight:40,costOfEquity:20,costOfDebt:10,taxRate:25})
assert.equal(wacc.valid,true,'WACC inputs must validate')
near(wacc.value,0.15,1e-12,'WACC calculation')
const reconciliation=engine.reconcileCashFlowSeries([-100,60,60],[-100,60,60])
assert.equal(reconciliation.matched,true,'Identical cash-flow series must reconcile')
const scaled=engine.calculateCapacityScaledCapex(1000,100,200,0.8)
near(scaled.amount,1741.1011265922482,1e-8,'Capacity-scaled CAPEX')

const depositPolicy={
  dayBasis:360,rawMaterialDays:0,workInProgressDays:0,
  workInProgressMaterialCompletionPercent:0,workInProgressConversionCompletionPercent:0,
  finishedGoodsDays:0,receivableDays:0,cashDays:30,payableDays:0,
  annualRawMaterialCost:0,annualConversionCost:0,annualFinishedGoodsCost:0,
  annualRevenue:0,annualCashOperatingCost:1200,
  shortTermDepositSharePercent:50,shortTermDepositRatePercent:12,
}
const depositWorkingCapital=engine.calculateOperatingCycleWorkingCapital(depositPolicy,1)
near(depositWorkingCapital.minimumCash,100,1e-9,'COMFAR cash-in-hand requirement')
near(depositWorkingCapital.shortTermDeposits??0,50,1e-9,'Short-term deposits are a portion of cash-in-hand')
near(depositWorkingCapital.netWorkingCapital,100,1e-9,'Short-term deposits must not be double-counted in net working capital')
near(engine.calculateShortTermDepositInterest(100,50,12,12),6,1e-9,'COMFAR XI.O annual deposit interest')
near(engine.calculateShortTermDepositInterest(100,50,12,6),3,1e-9,'COMFAR XI.O partial-period deposit interest')
near(engine.calculateWorkingCapitalTurnoverCoefficient(30),12,1e-9,'COMFAR VII.Q turnover coefficient')
near(engine.calculateWorkingCapitalTurnoverCoefficient(90),4,1e-9,'COMFAR VII.Q 90-day turnover coefficient')
assert.equal(engine.calculateWorkingCapitalTurnoverCoefficient(0),null,'Zero days coverage has no finite turnover coefficient')
near(engine.calculateWorkingCapitalDaysCoverageFromTurnover(12),30,1e-9,'COMFAR VII.Q inverse Coto conversion')
near(engine.calculateWorkingCapitalDaysCoverageFromTurnover(4),90,1e-9,'COMFAR VII.Q inverse 90-day conversion')

const breakEven=engine.calculateBreakEvenAnalysis({salesRevenue:1000,salesVolume:100,variableCosts:600,fixedCosts:200,financialCosts:50})
near(breakEven.variableMargin,400,1e-9,'COMFAR break-even variable margin')
near(breakEven.variableMarginRatioPercent,40,1e-9,'COMFAR break-even variable margin ratio')
near(breakEven.breakEvenSalesValueIncludingFinance,625,1e-9,'COMFAR break-even sales value including finance')
near(breakEven.breakEvenSalesValueExcludingFinance,500,1e-9,'COMFAR break-even sales value excluding finance')
near(breakEven.breakEvenRatioIncludingFinancePercent,62.5,1e-9,'COMFAR break-even ratio including finance')
near(breakEven.breakEvenRatioExcludingFinancePercent,50,1e-9,'COMFAR break-even ratio excluding finance')
near(breakEven.breakEvenSalesVolumeIncludingFinance,62.5,1e-9,'COMFAR break-even volume at constant price')
near(breakEven.breakEvenSalesPriceAtConstantVolume,8.5,1e-9,'COMFAR break-even price at constant volume')
near(breakEven.fixedCostCoverageIncludingFinance,1.6,1e-9,'COMFAR fixed-cost coverage including finance')
near(breakEven.fixedCostCoverageExcludingFinance,2,1e-9,'COMFAR fixed-cost coverage excluding finance')
const noContributionBreakEven=engine.calculateBreakEvenAnalysis({salesRevenue:100,salesVolume:10,variableCosts:120,fixedCosts:20,financialCosts:5})
assert.equal(noContributionBreakEven.breakEvenSalesValueIncludingFinance,null,'No positive variable margin has no finite break-even sales value')
assert.equal(engine.calculateWorkingCapitalDaysCoverageFromTurnover(0),null,'Zero turnover coefficient has no finite days coverage')

const suppliesUtilitiesPolicy={
  dayBasis:360,rawMaterialDays:0,factorySuppliesDays:30,utilitiesDays:15,
  workInProgressDays:0,workInProgressMaterialCompletionPercent:0,
  workInProgressConversionCompletionPercent:0,finishedGoodsDays:0,receivableDays:0,
  cashDays:0,payableDays:0,annualRawMaterialCost:0,annualFactorySuppliesCost:360,
  annualUtilitiesCost:720,annualConversionCost:0,annualFinishedGoodsCost:0,
  annualRevenue:0,annualCashOperatingCost:0,
}
const suppliesUtilities=engine.calculateOperatingCycleWorkingCapital(suppliesUtilitiesPolicy,1)
near(suppliesUtilities.factorySupplies??0,30,1e-9,'COMFAR factory supplies inventory')
near(suppliesUtilities.utilities??0,30,1e-9,'COMFAR utilities inventory')
near(suppliesUtilities.netWorkingCapital,60,1e-9,'Factory supplies and utilities included in net working capital')
const longCoveragePolicy={...depositPolicy,rawMaterialDays:540,annualRawMaterialCost:360,cashDays:0,annualCashOperatingCost:0}
near(engine.calculateOperatingCycleWorkingCapital(longCoveragePolicy,1).rawMaterials,540,1e-9,'Working-capital days coverage may exceed one year')

const annualDepositModel=engine.calculateIntegratedFinance({
  years:3,constructionYears:1,capacity:1,fullCapacityRevenue:100,
  fullCapacityVariableCashCost:30,fullCapacityFixedCashCost:10,annualDepreciation:0,
  fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0,0],preOperatingSchedule:[0,0,0],
  utilization:[0,1,1],equityContributions:[0,0,0],loans:[],taxRate:0,costOfEquity:10,
  workingCapitalPercent:0,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:10,
  workingCapitalPolicy:depositPolicy,
})
near(annualDepositModel.years[1].shortTermDepositInterest,6,1e-9,'Annual integrated model deposit interest')
near(annualDepositModel.years[1].taxableProfit,66,1e-9,'Deposit interest included in taxable profit')
near(annualDepositModel.years[1].cfads,-34,1e-9,'Deposit interest included in CFADS')
near(annualDepositModel.presentValueInvestment,100/1.1,1e-9,'COMFAR PVI discounts fixed investment and positive NWC increments')
near(annualDepositModel.npvrProject,annualDepositModel.npvProject/(100/1.1),1e-9,'COMFAR NPVR = NPV / PVI')
const annualDepositStatements=engine.buildThreeFinancialStatements(annualDepositModel.years)
near(annualDepositStatements[1].incomeStatement.profitBeforeTax,66,1e-9,'Deposit interest included in annual income statement')
near(annualDepositStatements[1].balanceSheet.cashInHand,50,1e-9,'Cash-in-hand net of short-term deposits')
near(annualDepositStatements[1].balanceSheet.shortTermDeposits,50,1e-9,'Short-term deposits shown separately on balance sheet')
near(annualDepositStatements[1].balanceSheet.workingCapitalAssets,100,1e-9,'Cash-in-hand plus deposits included once in current assets')
near(annualDepositModel.years[2].closingWorkingCapital,0,1e-9,'Terminal-period working capital recovery')
near(annualDepositStatements[2].balanceSheet.workingCapitalAssets,0,1e-9,'Terminal-period current asset liquidation')
near(annualDepositStatements[2].balanceSheet.shortTermDeposits,0,1e-9,'Terminal-period short-term deposit liquidation')
near(engine.calculateWorkingCapitalTurnoverCoefficient(540),2/3,1e-9,'COMFAR Coto for coverage above one year')


const sydAssetSchedule = (lengthYears, lengthMonths, firstDepreciationMonths) => engine.calculateComfarAssetDepreciationSchedule([{
  id:'syd-asset',name:'SYD asset',originalValue:1200,initialBookValue:1200,scrapPercent:10,
  lengthYears,lengthMonths,method:'sum-of-years-digits',acquisitionPeriod:0,startingAtPeriod:1,
  firstDepreciationMonths
}],8)
for (const [years,months,firstMonths] of [[2,0,8],[2,6,4],[2,6,8]]) {
  const sydSchedule=sydAssetSchedule(years,months,firstMonths)
  assert.equal(sydSchedule.valid,true,sydSchedule.warnings.join('; '))
  near(sydSchedule.periods.reduce((sum,row)=>sum+row.depreciation,0),1080,1e-7,'COMFAR SYD total depreciation')
  near(sydSchedule.periods.at(-1).closingBookValue,120,1e-7,'COMFAR SYD salvage book value')
}

const blank=foundation.createBlankProjectFoundation()
assert.equal(blank.planning.projectStartDate,'')
assert.equal(blank.planning.projectEndDate,'')
const periods=foundation.buildProjectCalendarPeriods('2026-10-15','2027-02-10','monthly',4)
assert.deepEqual(periods.map(p=>[p.startDate,p.endDate,p.days,p.partial]),[
 ['2026-10-15','2026-10-31',17,true],['2026-11-01','2026-11-30',30,false],
 ['2026-12-01','2026-12-31',31,false],['2027-01-01','2027-01-31',31,false],
 ['2027-02-01','2027-02-10',10,true]
])
const validAsset={id:'asset-1',name:'Test asset',grossCost:1000,accumulatedDepreciation:0,remainingLife:5,opportunityValue:1000,commissioningDate:'2024-02-29',depreciationStartDate:'2024-03-01',depreciationMethod:'linear-scrap',depreciationLengthYears:5,depreciationLengthMonths:0,firstDepreciationMonths:12,status:'active'}
assert.equal(foundation.validateStartingFixedAssetBalances([validAsset],blank).length,0)
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,commissioningDate:'2023-02-29'}],blank).some(x=>x.code==='invalid-starting-asset-date'))
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,accumulatedDepreciation:950,salvagePercent:10}],blank)
  .some(x=>x.code==='starting-asset-salvage-exceeds-net-book-value'),
  'Opening asset salvage value must not exceed its net book value')
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,salvagePercent:101}],blank)
  .some(x=>x.code==='invalid-starting-asset-salvage-percent'),
  'Opening asset scrap percentage must be within 0–100 percent')
const acceleratedWithoutRate={...validAsset,depreciationMethod:'accelerated',depreciationRatePercent:undefined}
assert.ok(foundation.validateStartingFixedAssetBalances([acceleratedWithoutRate],blank)
  .some(x=>x.code==='invalid-starting-asset-depreciation-rate'),
  'Accelerated depreciation must have an explicit rate below 100 percent')
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,depreciationMethod:'accelerated',depreciationRatePercent:100}],blank)
  .some(x=>x.code==='invalid-starting-asset-depreciation-rate'),
  'Accelerated depreciation must reject a 100 percent rate')
const disposalFoundation={...blank,planning:{...blank.planning,projectStartDate:'2025-01-01',projectEndDate:'2027-12-31'}}
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,status:'sell'}],disposalFoundation)
  .some(x=>x.code==='missing-starting-asset-disposal-date'),
  'Assets marked for sale must have an explicit disposal date')
assert.equal(foundation.validateStartingFixedAssetBalances([{
  ...validAsset,status:'sell',disposalDate:'2026-06-30',disposalPriceMode:'self-defined',
  disposalProceeds:500,disposalExchangeRateToLocal:1
}],disposalFoundation).length,0)
assert.ok(foundation.validateStartingFixedAssetBalances([{
  ...validAsset,status:'replace',disposalDate:'2028-01-01'
}],disposalFoundation).some(x=>x.code==='starting-asset-disposal-after-project'),
  'Replacement disposal date must fall inside the project calendar')
const openingAssetDisposal=engine.calculateComfarCalendarAssetLifecycle([{
  id:'opening-sale-test',name:'Opening asset for sale',originalValue:1000,initialBookValue:700,
  scrapPercent:10,lengthYears:7,lengthMonths:0,ratePercent:100/7,
  method:'linear-to-scrap',acquisitionPeriod:0,startingAtPeriod:1,
  acquisitionDate:'2020-01-01',startingAtDate:'2026-10-15',firstDepreciationMonths:12
}],[{
  id:'opening-sale-test-disposal',assetId:'opening-sale-test',period:1,
  saleDate:'2026-11-15',priceMode:'self-defined',selfDefinedPrice:500,exchangeRateToLocal:1
}],periods,1)
assert.equal(openingAssetDisposal.valid,true,openingAssetDisposal.warnings.join('; '))
assert.equal(openingAssetDisposal.sales.length,1)
assert.equal(openingAssetDisposal.sales[0].period,2)
assert.equal(openingAssetDisposal.sales[0].saleProceeds,500)
assert.ok(openingAssetDisposal.sales[0].bookValueAtSale<700&&openingAssetDisposal.sales[0].bookValueAtSale>100)
assert.ok(openingAssetDisposal.depreciation.periods[2].assets[0].closingBookValue===0,
  'An opening asset must be removed from net fixed assets after its dated disposal')
console.log('PASS: generic financial calculations, project calendar and opening-asset validation')
