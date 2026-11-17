import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const load = async relativePath => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const [engine, foundation] = await Promise.all([
  load('../src/features/steel/periodicFinancialEngine.ts'),
  load('../src/features/projects/projectFoundation.ts')
])
const periods=foundation.buildProjectCalendarPeriods('2025-01-01','2027-12-31','annual',1)
assert.equal(periods.length,3)
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
assert.deepEqual(statements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[-50,10,70])
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
console.log('PASS: period cash roll-forward, opening cash, funding-gap alerts and three-statement cash reconciliation')

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
assert.deepEqual(depositStatements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[-50,-85,80])
assert.equal(depositStatements[1].balanceSheet.cashInHand,50)
assert.equal(depositStatements[1].balanceSheet.shortTermDeposits,50)
assert.equal(depositStatements[1].balanceSheet.netWorkingCapital,100)
assert.equal(depositStatements[2].balanceSheet.netWorkingCapital,0)
assert.equal(depositStatements[2].balanceSheet.cashInHand,0)
assert.equal(depositStatements[2].balanceSheet.shortTermDeposits,0)
assert.ok(depositStatements.every(row=>Math.abs(row.movementChecks.cashRollForward)<=0.01))
console.log('PASS: COMFAR short-term deposit interest flows through tax, CFADS, cash and linked statements')

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
console.log('PASS: COMFAR XI.N automatic construction equity and overdraft are integrated into cash flow, balance sheet and equity')
