import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const asDataModule = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const load = async relativePath => asDataModule(transpile(await readFile(new URL(relativePath, import.meta.url), 'utf8')))
const loadFinancialModel = async () => {
  const [source, formulaRules] = await Promise.all([
    readFile(new URL('../src/features/steel/financialModel.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/features/projects/projectModelFormulaRules.ts', import.meta.url), 'utf8')
  ])
  const formulaRulesUrl = 'data:text/javascript;base64,' + Buffer.from(transpile(formulaRules)).toString('base64')
  const output = transpile(source).replace("'../projects/projectModelFormulaRules'", JSON.stringify(formulaRulesUrl))
  return asDataModule(output)
}
const advancedFinancePanelSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
assert.match(advancedFinancePanelSource,
  /workingCapitalByPeriod:periodicWorkingCapitalByPeriod,rawMaterialsInventoryByPeriod,workInProgressInventoryByPeriod,finishedGoodsInventoryByPeriod/,
  'Product finished-goods closing values must be passed into the periodic finance engine for balance-sheet disclosure')
const [engine, foundation, financialModel] = await Promise.all([
  load('../src/features/steel/periodicFinancialEngine.ts'),
  load('../src/features/projects/projectFoundation.ts'),
  loadFinancialModel()
])
const automaticInventoryValuation=financialModel.calculateOperatingCycleWorkingCapital({
  dayBasis:360,rawMaterialDays:30,workInProgressDays:15,
  workInProgressMaterialCompletionPercent:100,workInProgressConversionCompletionPercent:50,
  finishedGoodsDays:0,receivableDays:0,cashDays:0,payableDays:0,
  annualRawMaterialCost:3600,annualConversionCost:7200,annualFinishedGoodsCost:0,
  annualRevenue:0,annualCashOperatingCost:0
},1)
assert.equal(automaticInventoryValuation.rawMaterials,300,
  'Raw-material inventory must be automatically valued from evidenced annual consumption cost and coverage days')
assert.equal(automaticInventoryValuation.workInProgress,300,
  'WIP must automatically combine material and conversion cost using separate completion percentages')
const periods=foundation.buildProjectCalendarPeriods('2025-01-01','2027-12-31','annual',1)
assert.equal(periods.length,3)
const detailedOpeningAccounts={
  rawMaterials:120,factorySupplies:15,workInProgress:40,finishedGoods:65,
  receivables:80,cash:30,shortTermDeposits:20,cashSurplus:10,
  otherCurrentAssets:5,tradePayables:55,otherCurrentLiabilities:10,accruedInterest:7
}
const detailedOpeningSummary=foundation.calculateStartingFinancialBalanceSummary({
  currentAssets:385,cashLocal:20,cashForeign:10,shortTermDepositsLocal:20,
  cashSurplusLocal:6,cashSurplusForeign:4,payablesLocal:45,payablesForeign:10,
  otherLiabilitiesLocal:10,openingDebt:200,accruedInterest:7,paidInCapital:300,
  retainedEarnings:40,accumulatedLosses:5,grants:10,currentAccounts:detailedOpeningAccounts
})
assert.equal(detailedOpeningSummary.cash,60,
  'Opening cash summary must include cash-in-hand, short-term deposits and cash surplus')
assert.equal(detailedOpeningSummary.netWorkingCapital,260,
  'Opening net working capital must exclude cash/deposits and operating current liabilities')
assert.equal(detailedOpeningSummary.debt,207,
  'Opening accrued interest must remain included in the total opening debt liability')
assert.deepEqual(detailedOpeningSummary.currentAccounts,detailedOpeningAccounts,
  'Opening current-account categories must be preserved without collapsing them into net working capital')
const openingAssetLifecycle=financialModel.calculateComfarCalendarAssetLifecycle([{
  id:'opening-asset-test',name:'Opening asset',originalValue:1000,initialBookValue:700,
  scrapPercent:10,lengthYears:7,lengthMonths:0,ratePercent:100/7,
  method:'linear-to-scrap',acquisitionPeriod:0,startingAtPeriod:1,
  acquisitionDate:'2020-01-01',startingAtDate:'2025-01-01',firstDepreciationMonths:12
}],[],periods,1)
assert.equal(openingAssetLifecycle.valid,true,openingAssetLifecycle.warnings.join('; '))
assert.equal(openingAssetLifecycle.depreciation.periods[0].assets[0].openingBookValue,700,
  'Existing assets must begin at gross cost less accumulated depreciation, not historical gross cost')
const expectedOpeningAssetDepreciation=(600/7)*(periods[0].days/365.2425)
assert.ok(Math.abs(openingAssetLifecycle.depreciation.periods[0].depreciation-expectedOpeningAssetDepreciation)<0.01,
  'Opening asset depreciation must use remaining depreciable book value, remaining useful life and actual calendar days')
assert.ok(Math.abs(openingAssetLifecycle.depreciation.periods[0].closingBookValue-(700-expectedOpeningAssetDepreciation))<0.01,
  'Opening asset closing book value must reconcile after current-period depreciation')
const openingAssetDepreciationByPeriod=openingAssetLifecycle.depreciation.periods.map(row=>row.depreciation)
const openingAssetStatementCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:openingAssetDepreciationByPeriod,periodDepreciationSchedule:openingAssetDepreciationByPeriod,
  annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[0,0,0],annualEquityContributions:[0,0,0],workingCapitalByPeriod:[0,0,0],
  openingCash:0,loans:[],discountRatePercent:10
})
assert.equal(openingAssetStatementCase.valid,true,openingAssetStatementCase.warnings.join('; '))
const openingAssetStatements=engine.buildPeriodicThreeFinancialStatements(openingAssetStatementCase,{
  netFixedAssets:700,paidInCapital:700
})
assert.equal(openingAssetStatements.length,periods.length,
  'Opening fixed asset net book value must be accepted as a balance-sheet opening balance')
assert.ok(openingAssetStatements.every((row,index)=>
  Math.abs(row.balanceSheet.netFixedAssets-openingAssetLifecycle.depreciation.periods[index].closingBookValue)<0.01),
  'Opening fixed assets must roll forward by their linked periodic depreciation')
assert.ok(openingAssetStatements.every(row=>row.balanceSheet.reconciled&&
  Math.abs(row.movementChecks.netFixedAssets)<=0.01),
  'Opening asset depreciation, retained earnings and net fixed assets must reconcile across the three statements')
const openingAssetDisposal=financialModel.calculateComfarCalendarAssetLifecycle([{
  id:'opening-sale-test',name:'Opening asset for sale',originalValue:1000,initialBookValue:700,
  scrapPercent:10,lengthYears:7,lengthMonths:0,ratePercent:100/7,
  method:'linear-to-scrap',acquisitionPeriod:0,startingAtPeriod:1,
  acquisitionDate:'2020-01-01',startingAtDate:'2025-01-01',firstDepreciationMonths:12
}],[{
  id:'opening-sale-test-disposal',assetId:'opening-sale-test',period:1,
  saleDate:'2026-06-30',priceMode:'self-defined',selfDefinedPrice:500,exchangeRateToLocal:1
}],periods,1)
assert.equal(openingAssetDisposal.valid,true,openingAssetDisposal.warnings.join('; '))
const openingAssetSaleByPeriod=periods.map((period,index)=>{
  const sales=openingAssetDisposal.sales.filter(sale=>sale.period===index+1)
  return {
    saleProceeds:sales.reduce((sum,sale)=>sum+sale.saleProceeds,0),
    returnOfCapital:sales.reduce((sum,sale)=>sum+sale.returnOfCapital,0),
    otherIncomeLoss:sales.reduce((sum,sale)=>sum+sale.otherIncomeLoss,0),
    bookValueDisposed:sales.reduce((sum,sale)=>sum+sale.bookValueAtSale,0),
  }
})
const disposalDepreciation=openingAssetDisposal.depreciation.periods.map(row=>row.depreciation)
const openingAssetDisposalCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:disposalDepreciation,periodDepreciationSchedule:disposalDepreciation,
  annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[0,0,0],annualEquityContributions:[0,0,0],workingCapitalByPeriod:[0,0,0],
  periodAssetSaleSchedule:openingAssetSaleByPeriod,openingCash:0,loans:[],discountRatePercent:10
})
assert.equal(openingAssetDisposalCase.valid,true,openingAssetDisposalCase.warnings.join('; '))
const openingAssetDisposalStatements=engine.buildPeriodicThreeFinancialStatements(openingAssetDisposalCase,{
  netFixedAssets:700,paidInCapital:700
})
assert.equal(openingAssetDisposalStatements.length,periods.length)
assert.equal(openingAssetDisposalStatements[1].balanceSheet.netFixedAssets,0,
  'Dated disposal must remove the opening asset carrying amount from net fixed assets')
assert.ok(Math.abs(openingAssetDisposalStatements[1].cashFlowStatement.investingCashFlow-500)<0.01,
  'Opening asset sale proceeds must flow into investing cash flow')
assert.ok(openingAssetDisposalStatements.every(row=>row.balanceSheet.reconciled&&
  Math.abs(row.movementChecks.netFixedAssets)<=0.01),
  'Opening asset disposal proceeds, disposal loss and fixed-asset derecognition must reconcile')
const openingBalanceSheetCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],periodDepreciationSchedule:[0,0,0],
  annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[0,0,0],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[50,40,0],openingWorkingCapital:50,openingCash:100,
  loans:[],discountRatePercent:10
})
assert.equal(openingBalanceSheetCase.valid,true,openingBalanceSheetCase.warnings.join('; '))
const openingBalanceSheetStatements=engine.buildPeriodicThreeFinancialStatements(openingBalanceSheetCase,{
  cash:100,debt:200,netFixedAssets:700,netWorkingCapital:50,
  paidInCapital:500,retainedEarnings:50,grants:100
})
assert.equal(openingBalanceSheetStatements.length,periods.length)
assert.ok(openingBalanceSheetStatements.every(row=>row.balanceSheet.reconciled),
  'Opening cash, net working capital, fixed assets, debt, paid-in capital, retained earnings and grants must balance without a plug')
assert.equal(openingBalanceSheetStatements[0].openingBalances.grants,100)
assert.equal(openingBalanceSheetStatements[0].balanceSheet.grants,100)
assert.ok(openingBalanceSheetStatements.every(row=>Math.abs(row.movementChecks.grants)<=0.01))
assert.deepEqual(openingBalanceSheetStatements.map(row=>row.balanceSheet.cash),[100,110,150],
  'Opening cash and terminal working-capital recovery must roll forward through the statements')
// Gross raw-material and WIP balances are separately disclosed inside net working capital.
const inventoryBalanceSheetCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[140,200,0],
  rawMaterialsInventoryByPeriod:[100,120,0],
  workInProgressInventoryByPeriod:[40,50,0],
  finishedGoodsInventoryByPeriod:[0,30,0],
  openingWorkingCapital:110,openingCash:0,loans:[],discountRatePercent:10
})
assert.equal(inventoryBalanceSheetCase.valid,true,inventoryBalanceSheetCase.warnings.join('; '))
const inventoryStatements=engine.buildPeriodicThreeFinancialStatements(inventoryBalanceSheetCase,{
  cash:0,debt:0,netFixedAssets:0,netWorkingCapital:110,
  rawMaterialsInventory:80,workInProgressInventory:30,finishedGoodsInventory:0,paidInCapital:110
})
assert.equal(inventoryStatements.length,periods.length)
assert.deepEqual(inventoryStatements.map(row=>row.balanceSheet.rawMaterialsInventory),[100,120,0])
assert.deepEqual(inventoryStatements.map(row=>row.balanceSheet.workInProgressInventory),[40,50,0])
assert.deepEqual(inventoryStatements.map(row=>row.balanceSheet.finishedGoodsInventory),[0,30,0])
assert.deepEqual(inventoryStatements.map(row=>row.balanceSheet.otherNetWorkingCapital),[0,0,0])
assert.ok(inventoryStatements.every(row=>
  Math.abs(row.balanceSheet.totalAssets-(row.balanceSheet.cash+row.balanceSheet.netWorkingCapital))<0.01),
  'Gross raw-material and WIP sub-ledgers must not be added a second time on top of net working capital')
assert.ok(inventoryStatements.every(row=>
  Math.abs(row.balanceSheet.rawMaterialsInventory+row.balanceSheet.workInProgressInventory+
    row.balanceSheet.finishedGoodsInventory+row.balanceSheet.otherNetWorkingCapital-row.balanceSheet.netWorkingCapital)<0.01),
  'Gross inventory accounts plus residual other net current accounts must exactly equal net working capital')
assert.ok(inventoryStatements.every(row=>row.balanceSheet.reconciled&&
  Math.abs(row.movementChecks.netWorkingCapital)<=0.01),
  'Raw-material and WIP inventory detail must preserve the net working-capital roll-forward and balance-sheet reconciliation')
const invalidInventoryDetail=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],rawMaterialsInventoryByPeriod:[0,-1,0],
  workInProgressInventoryByPeriod:[0,0,0],finishedGoodsInventoryByPeriod:[0,-1,0],loans:[]
})
assert.equal(invalidInventoryDetail.valid,false,
  'Negative raw-material or finished-goods inventory values must be rejected instead of entering the balance sheet')
console.log('PASS: raw-material and WIP inventory sub-ledgers reconcile within net working capital without double counting')

const loan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[1000,0,0],repaymentMethod:'annuity',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:2,capitalizeInterest:false,
  rateConversion:'effective-annual-by-actual-days',periodsPerYear:1
},periods,365)
assert.equal(loan.valid,true,loan.issues.join('; '))
assert.equal(loan.rows.length,3)
assert.ok(loan.rows[1].principal>0&&loan.rows[2].principal>0)
assert.ok(Math.abs(loan.rows[2].closingBalance)<0.01,'Annuity schedule must amortize the loan by maturity')
const invalid=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[1000],repaymentMethod:'annuity',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:2,capitalizeInterest:false
},periods,365)
assert.equal(invalid.valid,false,'Loan schedule with mismatched period drawdowns must be rejected')

const negativeWorkingCapital = engine.calculateIntegratedPeriodicFinance({
  periods, fiscalYearStartMonth:1, dayCountBasis:365, cashFlowTiming:'period-end',
  annualRevenue:[100,100,100], annualVariableCost:[20,20,20], annualFixedCost:[10,10,10],
  annualDepreciation:[0,0,0], annualFixedInvestment:[0,0,0], annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0], annualTaxRates:[0,0,0], annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[-10,-20,-5], openingWorkingCapital:-5, loans:[],
  discountRatePercent:10, equityDiscountRatePercent:10
})
assert.equal(negativeWorkingCapital.valid,true,negativeWorkingCapital.warnings.join('; '))
assert.equal(negativeWorkingCapital.rows[0].changeInWorkingCapital,-5)
assert.equal(negativeWorkingCapital.rows[1].changeInWorkingCapital,-10)
assert.equal(negativeWorkingCapital.rows[2].changeInWorkingCapital,15)

console.log('PASS: generic periodic loan schedule validates drawdowns, amortization and maturity balance')

const fundingCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,100,100],annualVariableCost:[0,30,30],annualFixedCost:[0,10,10],
  annualDepreciation:[0,0,0],annualFixedInvestment:[100,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[50,0,0],
  workingCapitalByPeriod:[0,0,0],openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(fundingCase.valid,true,fundingCase.warnings.join('; '))
assert.deepEqual(fundingCase.rows.map(row=>Math.round(row.closingCash)),[-50,10,70])
assert.deepEqual(fundingCase.rows.map(row=>Math.round(row.fundingGap)),[50,0,0])
assert.equal(fundingCase.peakFundingGap,50)
assert.ok(fundingCase.presentValueInvestment>0)
assert.ok(fundingCase.npvrProject!==null)
assert.ok(Math.abs(fundingCase.npvrProject-fundingCase.npvProject/fundingCase.presentValueInvestment)<1e-9)
assert.ok(fundingCase.warnings.some(message=>message.includes('Funding shortfall')))
const statements=engine.buildPeriodicThreeFinancialStatements(fundingCase)
assert.equal(statements.length,periods.length)
assert.deepEqual(statements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[0,10,70])
assert.ok(statements.every(row=>Math.abs(row.movementChecks.cashRollForward)<=0.01),'Statement cash must reconcile to the engine cash roll-forward')
const openingCashCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,100,100],annualVariableCost:[0,30,30],annualFixedCost:[0,10,10],
  annualDepreciation:[0,0,0],annualFixedInvestment:[100,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[50,0,0],
  workingCapitalByPeriod:[0,0,0],openingCash:50,loans:[],discountRatePercent:10,
})
assert.equal(openingCashCase.peakFundingGap,0)
assert.deepEqual(openingCashCase.rows.map(row=>Math.round(row.closingCash)),[0,60,120])
const openingStatements=engine.buildPeriodicThreeFinancialStatements(openingCashCase)
assert.deepEqual(openingStatements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[0,60,120])
assert.ok(openingStatements.every(row=>Math.abs(row.movementChecks.cashRollForward)<=0.01),'Opening cash must be carried consistently into linked statements')
const openingFixedAssetStatements=engine.buildPeriodicThreeFinancialStatements(openingCashCase,{
  netFixedAssets:500,paidInCapital:550
})
assert.equal(openingFixedAssetStatements[0].openingBalances.netFixedAssets,500,
  'Opening fixed asset net book value must be carried into the first statement period')
assert.deepEqual(openingFixedAssetStatements.map(row=>Math.round(row.balanceSheet.netFixedAssets)),[600,600,600],
  'Opening fixed assets must roll forward with new CAPEX without being counted twice')
assert.ok(openingFixedAssetStatements.every(row=>row.balanceSheet.reconciled),
  'Opening fixed assets and their corresponding opening equity must reconcile without a balancing plug')
console.log('PASS: period cash roll-forward, opening cash, funding-gap alerts and three-statement cash reconciliation')
console.log('PASS: opening fixed asset net book value is carried into the balance sheet and reconciled with opening equity')

const depositCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,100,100],annualShortTermDepositInterest:[0,5,5],
  annualVariableCost:[0,30,30],annualFixedCost:[0,10,10],
  annualDepreciation:[0,0,0],annualFixedInvestment:[100,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[50,0,0],
  workingCapitalByPeriod:[0,100,0],cashInHandByPeriod:[0,50,0],shortTermDepositsByPeriod:[0,50,0],openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(depositCase.valid,true,depositCase.warnings.join('; '))
assert.deepEqual(depositCase.rows.map(row=>row.shortTermDepositInterest),[0,5,5])
assert.deepEqual(depositCase.rows.map(row=>Math.round(row.closingCash)),[-50,-85,80])
assert.deepEqual(depositCase.rows.map(row=>Math.round(row.fundingGap)),[50,85,0])
assert.equal(depositCase.peakFundingGap,85)
const depositStatements=engine.buildPeriodicThreeFinancialStatements(depositCase)
assert.equal(depositStatements[1].incomeStatement.ebit,60)
assert.equal(depositStatements[1].incomeStatement.shortTermDepositInterest,5)
assert.equal(depositStatements[1].incomeStatement.profitBeforeTax,65)
assert.deepEqual(depositStatements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[0,0,80])
assert.equal(depositStatements[1].balanceSheet.cashInHand,50)
assert.equal(depositStatements[1].balanceSheet.shortTermDeposits,50)
assert.equal(depositStatements[1].balanceSheet.netWorkingCapital,100)
assert.equal(depositStatements[2].balanceSheet.netWorkingCapital,0)
assert.equal(depositStatements[2].balanceSheet.cashInHand,0)
assert.equal(depositStatements[2].balanceSheet.shortTermDeposits,0)
assert.deepEqual(depositStatements.map(row=>Math.round(row.balanceSheet.debt)),[50,85,0])
assert.ok(depositStatements.every(row=>row.balanceSheet.reconciled),'Deposit scenario balance sheet must reconcile after automatic overdraft funding')
assert.ok(depositStatements.every(row=>Math.abs(row.movementChecks.cashRollForward)<=0.01))
console.log('PASS: COMFAR short-term deposit interest flows through tax, CFADS, cash and linked statements')

const taxLossVintage=engine.calculatePeriodTaxWithLossExpiry(100,20,[{amount:50,originFiscalYearIndex:0}],1,2,true)
assert.equal(taxLossVintage.taxableProfitAfterLoss,50)
assert.equal(taxLossVintage.tax,10)
assert.equal(taxLossVintage.closingLossCarryForward,0)
const expiredTaxLoss=engine.calculatePeriodTaxWithLossExpiry(100,20,[{amount:50,originFiscalYearIndex:0}],3,2,true)
assert.equal(expiredTaxLoss.tax,20,'Expired tax losses must not shelter taxable profit')
const newTaxLoss=engine.calculatePeriodTaxWithLossExpiry(-40,20,[],1,3,true)
assert.equal(newTaxLoss.closingLossCarryForward,40)
assert.deepEqual(newTaxLoss.closingLossVintages,[{amount:40,originFiscalYearIndex:1}])
const disabledTaxLoss=engine.calculatePeriodTaxWithLossExpiry(-40,20,[],1,null,false)
assert.equal(disabledTaxLoss.closingLossCarryForward,0,'Disabled loss carry-forward must not create a reusable loss vintage')
const taxExpiryCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,50,50],annualVariableCost:[0,0,0],annualFixedCost:[100,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[20,20,20],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],taxLossCarryForwardEnabled:true,taxLossCarryForwardYears:1,
})
assert.equal(taxExpiryCase.valid,true,taxExpiryCase.warnings.join('; '))
assert.deepEqual(taxExpiryCase.rows.map(row=>row.taxLossCarryForward),[100,50,0])
assert.deepEqual(taxExpiryCase.rows.map(row=>row.tax),[0,0,10],
  'Tax losses must offset FIFO in the next fiscal year and expire after the configured carry-forward window')
const taxDeductionCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[100,100,100],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[20,20,20],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],taxableDeductionsByPeriod:[10,20,30],taxCreditsByPeriod:[10,0,50],
})
assert.equal(taxDeductionCase.valid,true,taxDeductionCase.warnings.join('; '))
assert.deepEqual(taxDeductionCase.rows.map(row=>row.taxBeforeCredits),[18,16,14])
assert.deepEqual(taxDeductionCase.rows.map(row=>row.taxCredit),[10,0,14],
  'Non-refundable credits are capped at current-period tax liability')
assert.deepEqual(taxDeductionCase.rows.map(row=>row.tax),[8,16,0])
assert.deepEqual(taxDeductionCase.rows.map(row=>row.taxableDeduction),[10,20,30])
const taxDeductionStatements=engine.buildPeriodicThreeFinancialStatements(taxDeductionCase)
assert.deepEqual(taxDeductionStatements.map(row=>row.incomeStatement.profitBeforeTax),[100,100,100],
  'Tax-only deductions must not distort accounting profit before tax')
assert.deepEqual(taxDeductionStatements.map(row=>row.incomeStatement.taxableDeductions),[10,20,30])
assert.deepEqual(taxDeductionStatements.map(row=>row.incomeStatement.taxCredits),[10,0,14])
assert.deepEqual(taxDeductionStatements.map(row=>row.incomeStatement.taxBeforeCredits),[18,16,14])
assert.ok(taxDeductionStatements.every(row=>row.balanceSheet.reconciled))
console.log('PASS: explicit period tax deductions flow through taxable profit without distorting accounting PBT')

console.log('PASS: FIFO tax-loss vintages, explicit carry-forward enablement and expiry')

const foreignCurrencyStatementCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[100,100,100],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[20,20,20],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[{id:'fx-facility',input:{
    annualRatePercent:0,drawdowns:[0,0,0],repaymentMethod:'bullet',repaymentStartPeriod:1,
    gracePeriods:0,termPeriods:1,capitalizeInterest:false,openingBalance:110,
  }}],
  loanScheduleOverrides:{'fx-facility':[
    {period:1,drawdown:0,openingBalance:110,periodRatePercent:0,interestExpense:0,capitalizedInterest:0,
      financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,principal:0,closingBalance:120,debtService:0},
    {period:2,drawdown:0,openingBalance:120,periodRatePercent:0,interestExpense:0,capitalizedInterest:0,
      financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,principal:0,closingBalance:120,debtService:0},
    {period:3,drawdown:0,openingBalance:120,periodRatePercent:0,interestExpense:0,capitalizedInterest:0,
      financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,principal:0,closingBalance:120,debtService:0},
  ]},
  foreignExchangeLossByPeriod:[10,0,0],
})
assert.equal(foreignCurrencyStatementCase.valid,true,foreignCurrencyStatementCase.warnings.join('; '))
const foreignCurrencyStatements=engine.buildPeriodicThreeFinancialStatements(foreignCurrencyStatementCase,{
  debt:110,netFixedAssets:220,paidInCapital:110,
})
assert.equal(foreignCurrencyStatements.length,3)
assert.equal(foreignCurrencyStatements[0].incomeStatement.foreignExchangeGainLoss,-10)
assert.equal(foreignCurrencyStatements[0].incomeStatement.profitBeforeTax,90)
assert.equal(foreignCurrencyStatements[0].incomeStatement.tax,18)
assert.equal(foreignCurrencyStatements[0].cashFlowStatement.operatingCashFlow,82,
  'Non-cash FX loss is added back in operating cash flow')
assert.equal(foreignCurrencyStatements[0].balanceSheet.debt,120)
assert.ok(foreignCurrencyStatements.every(row=>row.balanceSheet.reconciled),
  'FX remeasurement must reconcile income statement, cash flow and debt on the balance sheet')
const brokenForeignCurrencyCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[100,100,100],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[20,20,20],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:foreignCurrencyStatementCase.valid?[{id:'fx-facility',input:{
    annualRatePercent:0,drawdowns:[0,0,0],repaymentMethod:'bullet',repaymentStartPeriod:1,
    gracePeriods:0,termPeriods:1,capitalizeInterest:false,openingBalance:110,
  }}]:[],
  loanScheduleOverrides:foreignCurrencyStatementCase.valid?{'fx-facility':foreignCurrencyStatementCase.loanSchedules['fx-facility']}:undefined,
  foreignExchangeLossByPeriod:[9,0,0],
})
assert.equal(brokenForeignCurrencyCase.valid,false,
  'FX postings must reconcile to translated opening, movement and closing debt balances')

console.log('PASS: foreign-currency debt remeasurement flows through all three periodic financial statements')

const automaticFundingCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,constructionPeriodCount:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,100],annualShortTermDepositInterest:[0,0,0],
  annualVariableCost:[0,20,20],annualFixedCost:[0,10,10],
  annualDepreciation:[0,0,0],annualFixedInvestment:[150,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[50,0,0],
  workingCapitalByPeriod:[0,0,0],openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(automaticFundingCase.valid,true,automaticFundingCase.warnings.join('; '))
assert.deepEqual(automaticFundingCase.rows.map(row=>Math.round(row.closingCash)),[-100,-130,-60])
assert.deepEqual(automaticFundingCase.automaticFundingSchedule.map(row=>Math.round(row.automaticEquity)),[100,0,0])
assert.deepEqual(automaticFundingCase.automaticFundingSchedule.map(row=>Math.round(row.automaticOverdraftDrawdown)),[0,30,0])
assert.deepEqual(automaticFundingCase.automaticFundingSchedule.map(row=>Math.round(row.automaticOverdraftRepayment)),[0,0,30])
assert.deepEqual(automaticFundingCase.automaticFundingSchedule.map(row=>Math.round(row.automaticOverdraftBalance)),[0,30,0])
assert.equal(automaticFundingCase.totalAutomaticEquity,100)
assert.equal(automaticFundingCase.peakAutomaticOverdraft,30)
assert.equal(automaticFundingCase.closingAutomaticOverdraft,0)
const automaticFundingStatements=engine.buildPeriodicThreeFinancialStatements(automaticFundingCase)
assert.equal(automaticFundingStatements.length,periods.length,'Automatic funding must be represented in linked statements')
assert.deepEqual(automaticFundingStatements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[0,0,40],
  'Construction equity and production overdraft must prevent negative statement cash')
assert.deepEqual(automaticFundingStatements.map(row=>Math.round(row.balanceSheet.automaticOverdraft)),[0,30,0])
assert.deepEqual(automaticFundingStatements.map(row=>Math.round(row.balanceSheet.debt)),[0,30,0],
  'Automatic overdraft must be included in total liabilities')
assert.deepEqual(automaticFundingStatements.map(row=>Math.round(row.balanceSheet.paidInCapital)),[150,150,150],
  'Automatic construction equity must increase paid-in capital')
assert.deepEqual(automaticFundingStatements.map(row=>Math.round(row.cashFlowStatement.financingCashFlow)),[150,30,-30])
assert.ok(automaticFundingStatements.every(row=>row.balanceSheet.reconciled),
  'Balance sheet must reconcile after automatic equity and overdraft integration')
assert.ok(automaticFundingStatements.every(row=>Object.values(row.movementChecks).every(value=>Math.abs(value)<=0.01)),
  'All statement movement checks must reconcile after automatic funding')
const brokenAutomaticFundingSchedule={
  ...automaticFundingCase,
  automaticFundingSchedule:automaticFundingCase.automaticFundingSchedule.map((row,index)=>
    index===2?{...row,automaticOverdraftBalance:5}:row),
}
assert.deepEqual(engine.buildPeriodicThreeFinancialStatements(brokenAutomaticFundingSchedule),[],
  'Three-statement builder must reject discontinuous automatic overdraft schedules')
const missingAutomaticFundingSchedule={...automaticFundingCase,automaticFundingSchedule:automaticFundingCase.automaticFundingSchedule.slice(0,2)}
assert.deepEqual(engine.buildPeriodicThreeFinancialStatements(missingAutomaticFundingSchedule),[],
  'Three-statement builder must reject incomplete automatic funding schedules')
console.log('PASS: COMFAR XI.N automatic construction equity and overdraft are integrated into cash flow, balance sheet and equity')
console.log('PASS: malformed, discontinuous or incomplete automatic funding schedules are rejected')


const fixedInvestmentBase = {
  id:'timing-control-asset',description:'Timing control asset',assetClass:'machinery',
  origin:'local',currencyCode:'IRR',costCentreId:'',
  depreciation:{method:'linear-zero',startingAt:'2025',ratePercent:100,lengthYears:1,
    lengthMonths:0,firstDepreciationMonths:12,scrapPercent:0},
  depreciationBasis:'user-confirmed',
  acquisitions:[{id:'timing-control-acquisition',period:'2025',quantity:1,unitPrice:100,
    currencyCode:'IRR',exchangeRateToLocal:null,allocationBasis:'user-confirmed'}],
  sales:[],
}
const validAcquisitionTiming=financialModel.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  [fixedInvestmentBase],2025,2,'annual')
assert.equal(validAcquisitionTiming.investmentScheduleVerified,true)
assert.deepEqual(validAcquisitionTiming.investmentSchedule,[100,0],
  'A confirmed in-horizon acquisition must be allocated to its exact model year')
const priorYearAcquisition=financialModel.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  [{...fixedInvestmentBase,acquisitions:[{...fixedInvestmentBase.acquisitions[0],period:'2024'}]}],
  2025,2,'annual')
assert.equal(priorYearAcquisition.investmentScheduleVerified,false,
  'An acquisition before the model start must never be marked as a verified new-investment cash-flow schedule')
const beyondHorizonAcquisition=financialModel.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  [{...fixedInvestmentBase,acquisitions:[{...fixedInvestmentBase.acquisitions[0],period:'2028'}]}],
  2025,2,'annual')
assert.equal(beyondHorizonAcquisition.investmentScheduleVerified,false,
  'An acquisition beyond the model horizon must never be silently omitted from a verified schedule')
const priorYearPreproduction=financialModel.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  [{...fixedInvestmentBase,id:'timing-control-preproduction',assetClass:'preproduction',
    depreciation:{...fixedInvestmentBase.depreciation,method:'none',startingAt:''},
    acquisitions:[{...fixedInvestmentBase.acquisitions[0],period:'2024'}]}],
  2025,2,'annual')
assert.equal(priorYearPreproduction.preOperatingScheduleVerified,false,
  'Pre-production expenditure acquired before model start must not be marked as a verified in-period schedule')

const productLedPeriods = engine.calculateIntegratedPeriodicFinance({
  periods, fiscalYearStartMonth:1, dayCountBasis:365, cashFlowTiming:'period-end',
  annualRevenue:[10,20,0], periodRevenue:[10,20,0],
  annualVariableCost:[4,8,0], periodVariableCost:[4,8,0],
  annualFixedCost:[0,0,0], annualDepreciation:[0,0,0],
  annualFixedInvestment:[0,0,0], annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0], annualTaxRates:[0,0,0],
  annualEquityContributions:[0,0,0], workingCapitalByPeriod:[0,0,0], loans:[],
})
assert.equal(productLedPeriods.valid,true,productLedPeriods.warnings.join('; '))
assert.deepEqual(productLedPeriods.rows.map(row=>row.revenue),[10,20,0],
  'Product-led sales must enter the exact project periods instead of being re-spread evenly across a fiscal year')
assert.deepEqual(productLedPeriods.rows.map(row=>row.variableCost),[4,8,0],
  'Product-led cost of sales must enter the exact project periods')
const mismatchedProductPeriodTotals=engine.calculateIntegratedPeriodicFinance({
  periods, fiscalYearStartMonth:1, dayCountBasis:365, cashFlowTiming:'period-end',
  annualRevenue:[10,20,0], periodRevenue:[10,19,0],
  annualVariableCost:[4,8,0], periodVariableCost:[4,8,0],
  annualFixedCost:[0,0,0], annualDepreciation:[0,0,0],
  annualFixedInvestment:[0,0,0], annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0], annualTaxRates:[0,0,0],
  annualEquityContributions:[0,0,0], workingCapitalByPeriod:[0,0,0], loans:[],
})
assert.equal(mismatchedProductPeriodTotals.valid,false,
  'Product-led period schedules must be rejected if they do not reconcile to fiscal-year totals')
console.log('PASS: exact-period product revenue and cost-of-sales overrides reconcile to fiscal-year totals')

console.log('PASS: fixed-investment and pre-production timing cannot be verified when acquisitions fall outside the modeled horizon')



// Abnormal waste is a period expense, never inventory/COGS, and must hit tax, CFADS,
// project/equity cash flow and retained earnings exactly once.
const abnormalWasteFinanceCase=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  periodAbnormalWasteExpense:[110,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],
  annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[390,390,390],openingWorkingCapital:500,openingCash:500,
  rawMaterialsInventoryByPeriod:[390,390,390],
  loans:[],discountRatePercent:10,
});
assert.equal(abnormalWasteFinanceCase.valid,true,abnormalWasteFinanceCase.warnings.join('; '));
const abnormalWastePeriod=abnormalWasteFinanceCase.rows[0];
assert.equal(abnormalWastePeriod.abnormalWasteExpense,110);
assert.equal(abnormalWastePeriod.ebit,-110,
  'Abnormal waste must reduce EBIT once and must not be included in variable/fixed cost buckets');
assert.equal(abnormalWastePeriod.variableCost,0);
assert.equal(abnormalWastePeriod.fixedCost,0);
assert.equal(abnormalWastePeriod.tax,0,
  'A loss caused by abnormal waste must not create an unsupported immediate tax refund');
assert.equal(abnormalWastePeriod.taxLossCarryForward,110,
  'Abnormal-waste expense must reduce taxable profit and increase the tax-loss carry-forward');
assert.equal(abnormalWastePeriod.cfads,0,
  'The inventory reduction in working capital offsets the non-cash write-off in CFADS');
assert.equal(abnormalWastePeriod.projectFreeCashFlow,0,
  'The non-cash write-off must not create a second project cash outflow when inventory reduction is included in working capital');
assert.equal(abnormalWastePeriod.equityFreeCashFlow,0,
  'The non-cash write-off must not create a second equity cash outflow when inventory reduction is included in working capital');
assert.equal(abnormalWastePeriod.closingCash,500,
  'Cash remains unchanged for an inventory write-off whose purchase cash flow was already recognized');
assert.equal(abnormalWasteFinanceCase.rows[1].taxLossCarryForward,110,
  'Tax loss from abnormal waste must roll forward to the next period');
const abnormalWasteStatements=engine.buildPeriodicThreeFinancialStatements(abnormalWasteFinanceCase,{
  cash:500,debt:0,netFixedAssets:0,netWorkingCapital:500,rawMaterialsInventory:500,paidInCapital:1000,retainedEarnings:0,
});
assert.equal(abnormalWasteStatements.length,periods.length);
assert.equal(abnormalWasteStatements[0].incomeStatement.ebit,-110);
assert.equal(abnormalWasteStatements[0].incomeStatement.netIncome,-110);
assert.equal(abnormalWasteStatements[0].cashFlowStatement.closingCash,500);
assert.equal(abnormalWasteStatements[0].balanceSheet.rawMaterialsInventory,390);
assert.equal(abnormalWasteStatements[0].balanceSheet.netWorkingCapital,390);
assert.equal(abnormalWasteStatements[0].balanceSheet.retainedEarnings,-110);
assert.ok(abnormalWasteStatements.every(row=>row.balanceSheet.reconciled),
  'Abnormal-waste expense must reconcile through retained earnings and the balance sheet without a plug');
const incompleteAbnormalWasteSchedule=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,0],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  periodAbnormalWasteExpense:[110,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],
  annualPreOperatingCost:[0,0,0],annualMaintenanceCapex:[0,0,0],
  annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],
});
assert.equal(incompleteAbnormalWasteSchedule.valid,false,
  'An incomplete abnormal-waste schedule must block finance results');
console.log('PASS: abnormal waste is expensed once through EBIT, tax losses, CFADS, project/equity cash flow and reconciled three statements');
