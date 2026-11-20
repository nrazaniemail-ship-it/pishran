import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engine=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const periods=[{index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false}]
const reference={
 source:'COMFAR III Expert, Cash Flow for Financial Planning - Total p.103, Projected Balance Sheet p.145',
 revenue:99970000,operatingCosts:74108365,marketing:999700,
 depreciation:3604523.88,interest:5658115.94,principal:6027109.06,
 workingCapitalOpening:4305202.45,workingCapitalClosing:4759926.91,
 tax:3899823.79,netIncome:11699471.38,cashSurplus:8822161.74,
 openingCash:19856857,closingCash:28679018.74,
 openingDebt:31433977.47,closingDebt:25406868.41,
 openingNetFixedAssets:41677632.53,closingNetFixedAssets:38073108.65,
 openingPaidInCapital:15743531.30,openingRetainedEarnings:18662183.21,
 closingRetainedEarnings:30361654.59,currentAssets:33438945.65,totalAssets:71512054.30,
}
const result=engine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:360,cashFlowTiming:'period-end',
 annualRevenue:[reference.revenue],annualVariableCost:[reference.operatingCosts],
 annualFixedCost:[reference.marketing],annualDepreciation:[reference.depreciation],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
 annualTaxRates:[25],annualEquityContributions:[0],
 openingWorkingCapital:reference.workingCapitalOpening,
 workingCapitalByPeriod:[reference.workingCapitalClosing],
 openingCash:reference.openingCash,openingDebtBalance:reference.openingDebt,
 loans:[{id:'reference-loan',input:{annualRatePercent:18,drawdowns:[0],repaymentMethod:'annuity',
  repaymentStartPeriod:1,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  openingBalance:reference.openingDebt}}],
 loanScheduleOverrides:{'reference-loan':[{
  period:1,drawdown:0,openingBalance:reference.openingDebt,periodRatePercent:18,
  interestExpense:reference.interest,capitalizedInterest:0,financingFeeExpense:0,
  commitmentFeeExpense:0,capitalizedFinancingFees:0,principal:reference.principal,
  closingBalance:reference.closingDebt,debtService:reference.interest+reference.principal,
 }]},
 foreignExchangeLossByPeriod:[0],taxLossCarryForwardEnabled:false,discountRatePercent:25,
})
assert.equal(result.valid,true,result.warnings.join('; '))
const row=result.rows[0]
const statements=engine.buildPeriodicThreeFinancialStatements(result,{
 debt:reference.openingDebt,netFixedAssets:reference.openingNetFixedAssets,
 paidInCapital:reference.openingPaidInCapital,retainedEarnings:reference.openingRetainedEarnings,
})
assert.equal(statements.length,1,'COMFAR year-6 linked financial statements must be generated')
const statement=statements[0]
const close=(actual,expected,label,tolerance=0.02)=>assert.ok(Math.abs(actual-expected)<=tolerance,
 label+': expected '+expected+', received '+actual)
close(row.revenue,reference.revenue,'COMFAR year-6 sales')
close(row.variableCost,reference.operatingCosts,'COMFAR year-6 operating/factory costs')
close(row.fixedCost,reference.marketing,'COMFAR year-6 marketing')
close(row.depreciation,reference.depreciation,'COMFAR year-6 depreciation')
close(row.interestExpense,reference.interest,'COMFAR year-6 financial costs')
close(row.principal,reference.principal,'COMFAR year-6 loan repayment')
close(row.changeInWorkingCapital,reference.workingCapitalClosing-reference.workingCapitalOpening,'COMFAR year-6 increase in current assets')
close(row.tax,reference.tax,'COMFAR year-6 corporate tax')
close(statement.incomeStatement.netIncome,reference.netIncome,'COMFAR year-6 net profit')
close(row.equityFreeCashFlow,reference.cashSurplus,'COMFAR year-6 cash surplus')
close(statement.cashFlowStatement.netChangeInCash,reference.cashSurplus,'COMFAR year-6 net cash change')
close(statement.balanceSheet.debt,reference.closingDebt,'COMFAR year-6 closing debt')
close(statement.balanceSheet.netFixedAssets,reference.closingNetFixedAssets,'COMFAR year-6 net fixed assets')
close(statement.balanceSheet.cash,reference.closingCash,'COMFAR year-6 closing cash')
close(statement.balanceSheet.cash+statement.balanceSheet.netWorkingCapital,reference.currentAssets,'COMFAR year-6 current assets')
close(statement.balanceSheet.totalAssets,reference.totalAssets,'COMFAR year-6 total assets')
close(statement.balanceSheet.retainedEarnings,reference.closingRetainedEarnings,'COMFAR year-6 accumulated retained earnings')
assert.equal(statement.balanceSheet.reconciled,true,'COMFAR year-6 balance sheet must reconcile: '+JSON.stringify({balanceSheet:statement.balanceSheet,movementChecks:statement.movementChecks,openingBalances:statement.openingBalances,incomeStatement:statement.incomeStatement,cashFlowStatement:statement.cashFlowStatement,row:{closingCash:row.closingCash,changeInWorkingCapital:row.changeInWorkingCapital,closingWorkingCapital:row.closingWorkingCapital,capitalizedInterest:row.capitalizedInterest,capitalizedFinancingFees:row.capitalizedFinancingFees,foreignExchangeLoss:row.foreignExchangeLoss,debtDrawdown:row.debtDrawdown,principal:row.principal,fixedInvestment:row.fixedInvestment,maintenanceCapex:row.maintenanceCapex,preOperatingCost:row.preOperatingCost,depreciation:row.depreciation,assetBookValueDisposed:row.assetBookValueDisposed,salvageBookValueDisposed:row.salvageBookValueDisposed,equityContribution:row.equityContribution,equityWorkingCapitalContribution:row.equityWorkingCapitalContribution}}))
console.log('COMFAR year-6 cash-flow, tax, debt roll-forward, working capital and balance-sheet spot-check passed.')
