import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const benchmarkSource = await readFile(new URL('../src/features/steel/hotRollingExcelBenchmark.ts', import.meta.url), 'utf8')
const benchmarkOutput = ts.transpileModule(benchmarkSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const benchmark = await import('data:text/javascript;base64,' + Buffer.from(benchmarkOutput).toString('base64'))
const comfarReference = benchmark.HOT_ROLLING_COMFAR_OUTPUT_AUDIT

const year = [{ index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365, partial: false }]
const quarter = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-03-31', days: 90, partial: false },
  { index: 2, startDate: '2025-04-01', endDate: '2025-06-30', days: 91, partial: false },
  { index: 3, startDate: '2025-07-01', endDate: '2025-09-30', days: 92, partial: false },
  { index: 4, startDate: '2025-10-01', endDate: '2025-12-31', days: 92, partial: false },
]

assert.equal(engine.annualEffectiveRateToPeriodRate(25, 365, 365), 25)
assert.ok(Math.abs(engine.prorateAnnualFlowByDays(365000, 91, 365) - 91000) < 1e-9)
assert.ok(Math.abs(quarter.reduce((sum, period) => sum + engine.prorateAnnualFlowByDays(365000, period.days, 365), 0) - 365000) < 1e-9)
const firstTax = engine.calculatePeriodTax(60, 25, 100)
assert.deepEqual(firstTax, { taxableProfitAfterLoss: -40, tax: 0, closingLossCarryForward: 40 })
const secondTax = engine.calculatePeriodTax(100, 25, firstTax.closingLossCarryForward)
assert.deepEqual(secondTax, { taxableProfitAfterLoss: 60, tax: 15, closingLossCarryForward: 0 })
assert.equal(engine.calculatePeriodTax(10, 101, 0).tax, Number.NaN)
assert.ok(Math.abs(engine.calculatePeriodicNpv([ -100, 125 ], [
  { index: 1, startDate: '2025-01-01', endDate: '2025-06-30', days: 181, partial: false },
  { index: 2, startDate: '2025-07-01', endDate: '2025-12-31', days: 184, partial: false },
], 25, 365, 'period-end') - (-100 / Math.pow(1.25, 181 / 365) + 125 / 1.25)) < 1e-9)
assert.ok(Number.isNaN(engine.calculatePeriodicNpv([100], [], 25, 365)))

const leapQuarter = [
  { index: 1, startDate: '2024-01-01', endDate: '2024-03-31', days: 91, partial: false },
  { index: 2, startDate: '2024-04-01', endDate: '2024-06-30', days: 91, partial: false },
  { index: 3, startDate: '2024-07-01', endDate: '2024-09-30', days: 92, partial: false },
  { index: 4, startDate: '2024-10-01', endDate: '2024-12-31', days: 92, partial: false },
]
const quarterlyAllocation = engine.allocateAnnualFlowsToPeriods([366000], leapQuarter, 1)
assert.ok(Math.abs(quarterlyAllocation.reduce((sum, amount) => sum + amount, 0) - 366000) < 1e-9)
const partialYear = [
  { index: 1, startDate: '2024-02-01', endDate: '2024-02-29', days: 29, partial: true },
  { index: 2, startDate: '2024-03-01', endDate: '2024-03-31', days: 31, partial: true },
]
const partialAllocation = engine.allocateAnnualFlowsToPeriods([366000], partialYear, 1)
assert.ok(Math.abs(partialAllocation.reduce((sum, amount) => sum + amount, 0) - 60000) < 1e-9)
const nonJanuaryFiscalYear = [
  { index: 1, startDate: '2024-01-01', endDate: '2024-03-31', days: 91, partial: false },
  { index: 2, startDate: '2024-04-01', endDate: '2024-06-30', days: 91, partial: false },
]
const splitFiscalYears = engine.allocateAnnualFlowsToPeriods([366000, 365000], nonJanuaryFiscalYear, 4)
assert.ok(Math.abs(splitFiscalYears[0] - 91000) < 1e-9)
assert.ok(Math.abs(splitFiscalYears[1] - 91000) < 1e-9)
assert.deepEqual(engine.allocateAnnualFlowsToPeriods([100], [{ index: 1, startDate: '2025-01-01', endDate: '2025-01-31', days: 30, partial: true }], 1), [])

const equalPrincipalLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'equal-principal',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(equalPrincipalLoan.valid, true)
assert.ok(equalPrincipalLoan.rows[0].capitalizedInterest > 0)
assert.equal(equalPrincipalLoan.rows[0].interestExpense, 0)
assert.ok(equalPrincipalLoan.rows[2].principal > 0)
assert.ok(equalPrincipalLoan.rows[3].principal > 0)
assert.ok(Math.abs(equalPrincipalLoan.rows[3].closingBalance) < 1e-8)
const annuityLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: false,
}, quarter, 365)
assert.equal(annuityLoan.valid, true)
assert.ok(annuityLoan.rows[0].interestExpense > 0)
assert.ok(annuityLoan.rows[2].principal > 0)
assert.ok(Math.abs(annuityLoan.rows[3].closingBalance) < 1e-8)
const bulletLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 100000, 0, 0],
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 3,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(bulletLoan.valid, true)
assert.equal(bulletLoan.rows[2].principal, 0)
assert.ok(bulletLoan.rows[3].principal > 0)
assert.ok(Math.abs(bulletLoan.rows[3].closingBalance) < 1e-8)
const comfarRepaymentPeriods = Array.from({ length: 20 }, (_, index) => {
  const start = new Date(Date.UTC(2026, index * 3, 1))
  const next = new Date(Date.UTC(2026, (index + 1) * 3, 1))
  const end = new Date(next.getTime() - 86400000)
  return {
    index: index + 1,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    partial: false,
  }
})
const comfarOpeningBalance = 8909484.06
const comfarAnnuityLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 28,
  drawdowns: Array(20).fill(0),
  openingBalance: comfarOpeningBalance,
  rateConversion: 'effective-annual-divided-by-frequency',
  periodsPerYear: 4,
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 1,
  gracePeriods: 0,
  termPeriods: 20,
  capitalizeInterest: false,
}, comfarRepaymentPeriods, 360)
assert.equal(comfarAnnuityLoan.valid, true, comfarAnnuityLoan.issues.join('; '))
const comfarFirstYearInterest = comfarAnnuityLoan.rows.slice(0, 4).reduce((sum, row) => sum + row.interestExpense, 0)
const comfarFirstYearPrincipal = comfarAnnuityLoan.rows.slice(0, 4).reduce((sum, row) => sum + row.principal, 0)
const comfarFirstYearDebtService = comfarAnnuityLoan.rows.slice(0, 4).reduce((sum, row) => sum + row.debtService, 0)
assert.ok(Math.abs(comfarFirstYearInterest - 2399043.44) < 0.05, 'HRCR200 first-year COMFAR interest must reconcile to the reported value')
assert.ok(Math.abs(comfarFirstYearPrincipal - 964925.63) < 0.05, 'HRCR200 first-year COMFAR principal must reconcile to the reported value')
assert.ok(Math.abs(comfarFirstYearDebtService - 3363969.07) < 0.05, 'HRCR200 first-year COMFAR debt service must reconcile to the reported value')
assert.ok(Math.abs(comfarAnnuityLoan.rows[0].debtService - 840992.27) < 0.01, 'HRCR200 quarterly annuity payment must reconcile to the reconstructed instalment')
assert.ok(Math.abs(comfarAnnuityLoan.rows[19].closingBalance) < 0.01, 'HRCR200 annuity must fully amortize after 20 quarterly instalments')
const invalidOpeningBalanceLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 28,
  drawdowns: Array(20).fill(0),
  openingBalance: -1,
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 1,
  gracePeriods: 0,
  termPeriods: 20,
  capitalizeInterest: false,
}, comfarRepaymentPeriods, 360)
assert.equal(invalidOpeningBalanceLoan.valid, false)

const exactDatedLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100, 0, 0, 0],
  datedDrawdowns: [{ date: '2025-02-01', amount: 100 }],
  interestConvention: 'comfar-months-plus-360',
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 4,
  gracePeriods: 0,
  termPeriods: 1,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(exactDatedLoan.valid, true, exactDatedLoan.issues.join('; '))
assert.ok(Math.abs(exactDatedLoan.rows[0].capitalizedInterest - 2) < 1e-8, 'dated drawdown should accrue only from 1 February to 31 March using COMFAR month/12 plus days/360')
assert.ok(Math.abs(exactDatedLoan.rows[0].drawdown - 100) < 1e-8)
const monthEndPeriods = [
  { index: 1, startDate: '2025-01-31', endDate: '2025-02-28', days: 29, partial: true },
  { index: 2, startDate: '2025-03-01', endDate: '2025-03-31', days: 31, partial: true },
]
const monthEndLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100, 0],
  datedDrawdowns: [{ date: '2025-01-31', amount: 100 }],
  interestConvention: 'comfar-months-plus-360',
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 2,
  gracePeriods: 0,
  termPeriods: 1,
  capitalizeInterest: true,
}, monthEndPeriods, 360)
assert.equal(monthEndLoan.valid, true, monthEndLoan.issues.join('; '))
assert.ok(Math.abs(monthEndLoan.rows[0].capitalizedInterest - (100 * 0.12 * 28 / 360)) < 1e-8, '31 January to 28 February is 28 residual days when the ending day is earlier than the starting day')
const comfarMonthDayPeriod = [
  { index: 1, startDate: '2025-01-15', endDate: '2025-04-20', days: 96, partial: true },
  { index: 2, startDate: '2025-04-21', endDate: '2025-04-21', days: 1, partial: true },
]
const comfarMonthDayLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100, 0],
  datedDrawdowns: [{ date: '2025-01-15', amount: 100 }],
  interestConvention: 'comfar-months-plus-360',
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 2,
  gracePeriods: 0,
  termPeriods: 1,
  capitalizeInterest: true,
}, comfarMonthDayPeriod, 360)
assert.equal(comfarMonthDayLoan.valid, true, comfarMonthDayLoan.issues.join('; '))
assert.ok(Math.abs(comfarMonthDayLoan.rows[0].capitalizedInterest - (100 * 0.12 * (3 / 12 + 5 / 360))) < 1e-8, 'COMFAR interval 15 January to 20 April is 3 months and 5 days')

const mismatchedDatedLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100, 0, 0, 0],
  datedDrawdowns: [{ date: '2025-02-01', amount: 90 }],
  interestConvention: 'comfar-months-plus-360',
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 4,
  gracePeriods: 0,
  termPeriods: 1,
  capitalizeInterest: true,
}, quarter, 365)
assert.equal(mismatchedDatedLoan.valid, false)
function buildQuarterPeriods(startYear, count) {
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(Date.UTC(startYear, index * 3, 1))
    const next = new Date(Date.UTC(startYear, (index + 1) * 3, 1))
    const end = new Date(next.getTime() - 86400000)
    return {
      index: index + 1,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      days: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
      partial: false,
    }
  })
}
const hrcr200Quarters = buildQuarterPeriods(1403, 21)
const hrcr200Principal = 3816495.99
const hrcr200AnnualEffectiveRate = 29.333398475149375
const hrcr200Loan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: hrcr200AnnualEffectiveRate,
  drawdowns: [hrcr200Principal, ...Array(20).fill(0)],
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 2,
  gracePeriods: 0,
  termPeriods: 20,
  capitalizeInterest: false,
  rateConversion: 'effective-annual-divided-by-frequency',
  periodsPerYear: 4,
}, hrcr200Quarters, 365)
assert.equal(hrcr200Loan.valid, true)
assert.ok(Math.abs(hrcr200Loan.rows[1].periodRatePercent - 7.333349618787344) < 1e-10)
assert.ok(Math.abs(hrcr200Loan.rows[1].principal - 89759.7075467898) < 1e-6)
assert.ok(Math.abs(hrcr200Loan.rows[1].interestExpense - 279876.9941336993) < 1e-6)
assert.ok(Math.abs(hrcr200Loan.rows[1].debtService - 369636.70168048906) < 1e-6)
assert.ok(Math.abs(hrcr200Loan.rows[20].closingBalance) < 1e-7)
assert.ok(Math.abs(hrcr200Loan.rows.slice(1).reduce((sum, row) => sum + row.principal, 0) - hrcr200Principal) < 1e-6)

// Reverse-engineered COMFAR HRCR200 long-term loan: gross opening balance includes
// the reported construction-capitalized interest; it is not a new-period cash drawdown.
const hrcr200ComfarLoanPeriods = buildQuarterPeriods(2026, 20)
const hrcr200ComfarLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: comfarReference.loanRepaymentAudit.statedAnnualRatePercent,
  openingBalance: comfarReference.loanRepaymentAudit.openingRepaymentBalance,
  drawdowns: Array(20).fill(0),
  repaymentMethod: 'annuity',
  repaymentStartPeriod: 1,
  gracePeriods: 0,
  termPeriods: 20,
  capitalizeInterest: false,
  rateConversion: 'effective-annual-divided-by-frequency',
  periodsPerYear: 4,
}, hrcr200ComfarLoanPeriods, 360)
assert.equal(hrcr200ComfarLoan.valid, true, hrcr200ComfarLoan.issues.join('; '))
const hrcr200ComfarFirstYear = hrcr200ComfarLoan.rows.slice(0, 4)
const sumHrcr200Comfar = field => hrcr200ComfarFirstYear.reduce((sum, row) => sum + row[field], 0)
assert.ok(Math.abs(hrcr200ComfarLoan.rows[0].debtService - comfarReference.loanRepaymentAudit.quarterlyPayment) < 0.1,
  'HRCR200 COMFAR quarterly annuity payment must match the reconstructed source')
assert.ok(Math.abs(sumHrcr200Comfar('interestExpense') - comfarReference.loanRepaymentAudit.firstOperatingYearInterest) < 0.1,
  'HRCR200 first-year interest must match COMFAR')
assert.ok(Math.abs(sumHrcr200Comfar('principal') - comfarReference.loanRepaymentAudit.firstOperatingYearPrincipal) < 0.1,
  'HRCR200 first-year principal must match COMFAR')
assert.ok(Math.abs(sumHrcr200Comfar('debtService') - comfarReference.loanRepaymentAudit.firstOperatingYearDebtService) < 0.1,
  'HRCR200 first-year total debt service must match COMFAR')
assert.ok(Math.abs(hrcr200ComfarLoan.rows.at(-1).closingBalance) < 1e-7,
  'HRCR200 COMFAR annuity must fully amortize the gross opening loan balance after 20 quarters')
assert.equal(hrcr200ComfarLoan.rows.reduce((sum, row) => sum + row.drawdown, 0), 0,
  'Opening debt balance must not be double-counted as a new cash drawdown')

const invalidDrawdownLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent: 12,
  drawdowns: [100000, 0, 10000, 0],
  repaymentMethod: 'bullet',
  repaymentStartPeriod: 2,
  gracePeriods: 0,
  termPeriods: 2,
  capitalizeInterest: false,
}, quarter, 365)
assert.equal(invalidDrawdownLoan.valid, false)
assert.ok(invalidDrawdownLoan.issues.some(issue => issue.includes('after principal repayment')))



const integratedPeriodic = engine.calculateIntegratedPeriodicFinance({
  periods: quarter,
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [4800],
  annualVariableCost: [1600],
  annualFixedCost: [400],
  annualDepreciation: [400],
  annualFixedInvestment: [3000],
  annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0],
  annualTaxRates: [25],
  annualEquityContributions: [1200],
  workingCapitalByPeriod: [0, 10, 20, 15],
  openingWorkingCapital: 0,
  loans: [{
    id: 'integrated-periodic-loan',
    input: {
      annualRatePercent: 12,
      drawdowns: [1800, 0, 0, 0],
      repaymentMethod: 'equal-principal',
      repaymentStartPeriod: 3,
      gracePeriods: 0,
      termPeriods: 2,
      capitalizeInterest: true,
    }
  }],
  discountRatePercent: 25,
  equityDiscountRatePercent: 30,
  mirrFinanceRatePercent: 10,
  mirrReinvestmentRatePercent: 12,
  salvageValue: 1500,
  salvageBookValue: 1000,
})
assert.equal(integratedPeriodic.valid, true, 'Integrated period model must accept valid quarterly inputs')

const periodicStatements = engine.buildPeriodicThreeFinancialStatements(integratedPeriodic)
assert.equal(periodicStatements.length,4,'Periodic three-statement builder must produce one linked statement per project period')
for (const statement of periodicStatements) {
  assert.ok(Math.abs(statement.balanceSheet.balanceDifference)<=0.01,
    'Quarterly balance sheet must reconcile without a plug in period '+statement.period)
  assert.ok(statement.balanceSheet.reconciled,'Quarterly balance sheet and movement checks must pass in period '+statement.period)
  for (const [movement,value] of Object.entries(statement.movementChecks))
    assert.ok(Math.abs(value)<=0.01,'Quarterly roll-forward '+movement+' must reconcile in period '+statement.period)
  assert.ok(Math.abs(statement.cashFlowStatement.closingCash-statement.openingBalances.cash-
    statement.cashFlowStatement.netChangeInCash)<=0.01,'Opening and closing cash must reconcile in period '+statement.period)
}
assert.equal(periodicStatements[3].balanceSheet.debt,
  Object.values(integratedPeriodic.loanSchedules).reduce((sum,schedule)=>sum+schedule[3].closingBalance,0),
  'Periodic balance sheet debt must tie to the actual loan schedule')
assert.equal(periodicStatements[3].incomeStatement.assetDisposalGainLoss,
  integratedPeriodic.rows[3].assetSaleOtherIncomeLoss+integratedPeriodic.rows[3].salvageGainLoss,
  'Asset and terminal salvage gains must enter the periodic income statement')
const openingBalanceStatements=engine.buildPeriodicThreeFinancialStatements(integratedPeriodic,{
  cash:100,netFixedAssets:250,netWorkingCapital:20,deferredPreOperatingAssets:30,paidInCapital:400,retainedEarnings:0
})
assert.equal(openingBalanceStatements.length,4,'Existing-enterprise opening balances must be supported')
const zeroFlowPeriodic = engine.calculateIntegratedPeriodicFinance({
  periods:quarter,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
  annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
  annualTaxRates:[25],annualEquityContributions:[0],workingCapitalByPeriod:[0,0,0,0],loans:[]
})
const existingEnterpriseStatements = engine.buildPeriodicThreeFinancialStatements(zeroFlowPeriodic,{cash:100,debt:100})
assert.ok(existingEnterpriseStatements.every(row=>row.balanceSheet.reconciled),
  'Opening cash and debt balances must roll forward for an existing enterprise')
assert.ok(existingEnterpriseStatements.every(row=>Math.abs(row.movementChecks.debt)<1e-9),
  'Opening debt must not be discarded when no new loan schedule exists')
assert.equal(engine.buildPeriodicThreeFinancialStatements({...integratedPeriodic,valid:false}).length,0,
  'Invalid periodic finance results must not produce statements')
assert.equal(integratedPeriodic.rows[3].salvageGainLoss,500,
  'Terminal salvage gain must equal proceeds less the disposed book value')
assert.ok(Math.abs(integratedPeriodic.rows[3].ebit-
  (integratedPeriodic.rows[3].revenue-integratedPeriodic.rows[3].variableCost-
    integratedPeriodic.rows[3].fixedCost-integratedPeriodic.rows[3].depreciation+
    integratedPeriodic.rows[3].assetSaleOtherIncomeLoss+500))<1e-8,
  'Terminal salvage gain must enter taxable EBIT')
assert.ok(Math.abs(integratedPeriodic.rows[3].tax-
  (integratedPeriodic.rows[3].ebit-integratedPeriodic.rows[3].interestExpense)*0.25)<1e-8,
  'Terminal salvage gain must be included in period tax')
assert.equal(integratedPeriodic.rows.length, 4)
assert.ok(Math.abs(integratedPeriodic.rows.reduce((sum,row)=>sum+row.revenue,0)-4800)<1e-7,
  'Quarterly revenue must reconcile to the source annual total')
assert.ok(Math.abs(integratedPeriodic.rows.reduce((sum,row)=>sum+row.variableCost,0)-1600)<1e-7,
  'Quarterly variable costs must reconcile to the source annual total')
assert.ok(Math.abs(integratedPeriodic.rows.reduce((sum,row)=>sum+row.fixedInvestment,0)-3000)<1e-7,
  'Quarterly CAPEX must reconcile to the source annual total')
assert.equal(integratedPeriodic.rows[1].changeInWorkingCapital, 10)
assert.equal(integratedPeriodic.rows[2].changeInWorkingCapital, 10)
assert.equal(integratedPeriodic.rows[3].changeInWorkingCapital, -5)
assert.ok(Math.abs(integratedPeriodic.rows[3].equityFreeCashFlow - (
  -integratedPeriodic.rows[3].equityContribution + integratedPeriodic.rows[3].revenue -
  integratedPeriodic.rows[3].variableCost - integratedPeriodic.rows[3].fixedCost -
  integratedPeriodic.rows[3].tax - integratedPeriodic.rows[3].interestExpense -
  integratedPeriodic.rows[3].principal - integratedPeriodic.rows[3].maintenanceCapex +
  integratedPeriodic.rows[3].assetSaleProceeds + integratedPeriodic.rows[3].salvageValue + 5
)) < 1e-8, 'A working-capital release must increase equity cash flow when no explicit shareholder funding schedule is supplied')
assert.ok(integratedPeriodic.rows[0].capitalizedInterest > 0, 'Grace-period interest must be capitalized')
assert.ok(integratedPeriodic.rows[2].principal > 0 && integratedPeriodic.rows[3].closingWorkingCapital === 15)
assert.ok(integratedPeriodic.rows[2].dscr !== null && Number.isFinite(integratedPeriodic.rows[2].dscr))
assert.ok(Math.abs(integratedPeriodic.totalDebtDrawdown - 1800) < 1e-9)
assert.ok(Math.abs(integratedPeriodic.totalEquityContribution - 1200) < 1e-9)
assert.ok(Number.isFinite(integratedPeriodic.npvProject))
assert.ok(Number.isFinite(integratedPeriodic.irrProject), 'Periodic project IRR must use actual period dates')
assert.ok(Number.isFinite(integratedPeriodic.mirrProject), 'Periodic project MIRR must use actual period dates')
assert.ok(Number.isFinite(integratedPeriodic.npvEquity))
assert.ok(Math.abs(integratedPeriodic.npvProject-engine.calculatePeriodicNpv(
  integratedPeriodic.rows.map(row=>row.projectFreeCashFlow),quarter,25,365,'period-end'))<1e-7,
  'Project NPV must retain the project discount rate independently')
assert.ok(Math.abs(integratedPeriodic.npvEquity-engine.calculatePeriodicNpv(
  integratedPeriodic.rows.map(row=>row.equityFreeCashFlow),quarter,30,365,'period-end'))<1e-7,
  'Equity NPV must use the separate 30% cost-of-equity discount rate')
assert.ok(Math.abs(integratedPeriodic.npvEquity-engine.calculatePeriodicNpv(
  integratedPeriodic.rows.map(row=>row.equityFreeCashFlow),quarter,25,365,'period-end'))>1e-4,
  'Equity NPV must not silently reuse the project discount rate when a shareholder rate is supplied')

const periodicAssetDisposal = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400],
  annualDepreciation: [400], annualFixedInvestment: [0], annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0], annualTaxRates: [25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: [],
  annualAssetSaleSchedule: [{
    saleProceeds: 500, returnOfCapital: 400, otherIncomeLoss: 100, bookValueDisposed: 400
  }]
})
assert.equal(periodicAssetDisposal.valid, true, 'Periodic finance must accept a reconciled asset disposal schedule')
assert.equal(periodicAssetDisposal.rows[2].assetSaleProceeds, 0, 'Annual asset disposals must not be spread across quarters')
assert.equal(periodicAssetDisposal.rows[3].assetSaleProceeds, 500, 'Annual asset disposal proceeds must be assigned to the fiscal-year closing period')
assert.equal(periodicAssetDisposal.rows[3].assetReturnOfCapital, 400)
assert.equal(periodicAssetDisposal.rows[3].assetBookValueDisposed, 400)
assert.equal(periodicAssetDisposal.rows[3].assetSaleOtherIncomeLoss, 100)
const disposalClosingRow = periodicAssetDisposal.rows[3]
assert.ok(Math.abs(disposalClosingRow.ebit - (disposalClosingRow.revenue - disposalClosingRow.variableCost - disposalClosingRow.fixedCost - disposalClosingRow.depreciation + 100)) < 1e-8,
  'Asset disposal gain must enter taxable EBIT')
assert.ok(Math.abs(disposalClosingRow.tax - disposalClosingRow.ebit * 0.25) < 1e-8,
  'Asset disposal gain must be included in period tax')
assert.ok(Math.abs(disposalClosingRow.cfads - (disposalClosingRow.revenue - disposalClosingRow.variableCost - disposalClosingRow.fixedCost - disposalClosingRow.tax + 500)) < 1e-8,
  'Disposal proceeds must be included in cash flow available for debt service')
assert.ok(Math.abs(disposalClosingRow.projectFreeCashFlow - (disposalClosingRow.ebit - 100 - disposalClosingRow.unleveredTax + disposalClosingRow.depreciation + 500)) < 1e-8,
  'Project cash flow must include disposal proceeds once, excluding double-counted accounting gain')
assert.ok(Math.abs(disposalClosingRow.equityFreeCashFlow - (disposalClosingRow.revenue - disposalClosingRow.variableCost - disposalClosingRow.fixedCost - disposalClosingRow.tax + 500)) < 1e-8,
  'Equity cash flow must include disposal proceeds')

const calendarAssetLifecycleFinance = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400],
  annualDepreciation: [100], periodDepreciationSchedule: [10,20,30,40],
  annualFixedInvestment: [0], annualPreOperatingCost: [0], annualMaintenanceCapex: [0],
  annualTaxRates: [25], annualEquityContributions: [0], workingCapitalByPeriod: [0,0,0,0], loans: [],
  periodAssetSaleSchedule: [
    {saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0},
    {saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0},
    {saleProceeds:500,returnOfCapital:300,otherIncomeLoss:200,bookValueDisposed:300},
    {saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}
  ]
})
assert.equal(calendarAssetLifecycleFinance.valid,true,'Period-specific depreciation and disposals must be accepted together')
assert.deepEqual(calendarAssetLifecycleFinance.rows.map(row=>row.depreciation),[10,20,30,40],
  'Actual calendar depreciation must override annual day-prorated depreciation in every project period')
const inconsistentCalendarDepreciation=engine.calculateIntegratedPeriodicFinance({
  periods:quarter,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[4800],annualVariableCost:[1600],annualFixedCost:[400],annualDepreciation:[999],
  periodDepreciationSchedule:[10,20,30,40],annualFixedInvestment:[0],annualPreOperatingCost:[0],
  annualMaintenanceCapex:[0],annualTaxRates:[25],annualEquityContributions:[0],
  workingCapitalByPeriod:[0,0,0,0],loans:[]
})
assert.equal(inconsistentCalendarDepreciation.valid,false,
  'Annual and period depreciation totals must reconcile before the period tax model can run')

const calendarSaleRow=calendarAssetLifecycleFinance.rows[2]
assert.ok(Math.abs(calendarSaleRow.ebit-(calendarSaleRow.revenue-calendarSaleRow.variableCost-calendarSaleRow.fixedCost-30+200))<1e-8,
  'Actual-period disposal gain must enter taxable EBIT alongside the period depreciation charge')
assert.ok(Math.abs(calendarSaleRow.tax-calendarSaleRow.ebit*0.25)<1e-8,
  'Tax must use the period-specific depreciation and disposal gain')
assert.ok(Math.abs(calendarSaleRow.cfads-(calendarSaleRow.revenue-calendarSaleRow.variableCost-calendarSaleRow.fixedCost-calendarSaleRow.tax+500))<1e-8,
  'Actual-period disposal proceeds must flow into CFADS exactly once')
assert.ok(Math.abs(calendarSaleRow.projectFreeCashFlow-(calendarSaleRow.ebit-200-calendarSaleRow.unleveredTax+30+500))<1e-8,
  'Actual-period project FCF must remove accounting gain and add cash proceeds once')
const invalidPeriodicAssetDisposal = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400],
  annualDepreciation: [400], annualFixedInvestment: [0], annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0], annualTaxRates: [25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: [],
  annualAssetSaleSchedule: [{
    saleProceeds: 500, returnOfCapital: 300, otherIncomeLoss: 100, bookValueDisposed: 400
  }]
})
assert.equal(invalidPeriodicAssetDisposal.valid, false, 'Unreconciled asset disposal schedules must fail closed')
const invalidAssetReturnOfCapital = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400],
  annualDepreciation: [400], annualFixedInvestment: [0], annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0], annualTaxRates: [25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: [],
  annualAssetSaleSchedule: [{
    saleProceeds: 500, returnOfCapital: 450, otherIncomeLoss: 50, bookValueDisposed: 400
  }]
})
assert.equal(invalidAssetReturnOfCapital.valid, false, 'Return of capital cannot exceed proceeds or the disposed asset book value')
const expectedEquityFlow = -integratedPeriodic.rows[0].equityContribution
  + integratedPeriodic.rows[0].revenue - integratedPeriodic.rows[0].variableCost
  - integratedPeriodic.rows[0].fixedCost - integratedPeriodic.rows[0].tax
  - integratedPeriodic.rows[0].interestExpense - integratedPeriodic.rows[0].principal
  - integratedPeriodic.rows[0].maintenanceCapex - integratedPeriodic.rows[0].changeInWorkingCapital
  + integratedPeriodic.rows[0].salvageValue
assert.ok(Math.abs(integratedPeriodic.rows[0].equityFreeCashFlow - expectedEquityFlow) < 1e-8,
  'Equity cash flow must treat shareholder contributions as investor outflows and exclude project CAPEX/debt drawdown double counting')
assert.ok(Number.isFinite(integratedPeriodic.peakWorkingCapital))
const periodTaxSchedule = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400], annualDepreciation: [400],
  annualFixedInvestment: [0], annualPreOperatingCost: [0], annualMaintenanceCapex: [0],
  annualTaxRates: [25], taxRatesByPeriod: [0, 5, 10, 25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: [], discountRatePercent: 25
})
assert.deepEqual(periodTaxSchedule.rows.map(row => row.taxRatePercent), [0, 5, 10, 25],
  'Explicit tax rates must override the annual rate by project period')
const invalidPeriodTaxSchedule = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [100], annualVariableCost: [10], annualFixedCost: [10], annualDepreciation: [10],
  annualFixedInvestment: [10], annualPreOperatingCost: [0], annualMaintenanceCapex: [0],
  annualTaxRates: [25], taxRatesByPeriod: [25, 25, 101, 25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: []
})
assert.equal(invalidPeriodTaxSchedule.valid, false, 'Out-of-range period tax rates must fail closed')
const invalidIntegratedPeriodic = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [100], annualVariableCost: [10], annualFixedCost: [10], annualDepreciation: [10],
  annualFixedInvestment: [10], annualPreOperatingCost: [0], annualMaintenanceCapex: [0],
  annualTaxRates: [101], annualEquityContributions: [0], workingCapitalByPeriod: [0, 0, 0, 0], loans: []
})
assert.equal(invalidIntegratedPeriodic.valid, false, 'Invalid period tax-rate mapping must fail closed')


function buildMonthlyPeriods(startYear,startMonth,endYear,endMonth) {
  const periods=[]
  let cursor=new Date(Date.UTC(startYear,startMonth-1,1))
  const final=new Date(Date.UTC(endYear,endMonth-1,1))
  while(cursor<=final){
    const next=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1))
    const end=new Date(next.getTime()-86400000)
    periods.push({index:periods.length+1,startDate:cursor.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),days:Math.round((end-cursor)/86400000)+1,partial:false})
    cursor=next
  }
  return periods
}
const monthlyDepreciationPeriods=buildMonthlyPeriods(2024,1,2026,1)
const straightLineAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-sl-01',name:'Monthly straight-line asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:1,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(straightLineAsset.valid,true)
assert.equal(straightLineAsset.fixedInvestmentByPeriod[0],1200)
assert.equal(straightLineAsset.depreciationByPeriod[0],0,'New asset depreciation must begin in the period after acquisition')
assert.ok(Math.abs(straightLineAsset.depreciationByPeriod.reduce((sum,value)=>sum+value,0)-1200)<1e-7,
  'Monthly straight-line depreciation must exhaust the depreciable base over the exact useful-life dates')
assert.ok(Math.abs(straightLineAsset.periods.at(-1).closingBookValue)<1e-7)
const sydAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-syd-01',name:'Two-year SYD asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'sum-of-years-digits',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(sydAsset.valid,true)
assert.ok(Math.abs(sydAsset.depreciationByPeriod.slice(1,13).reduce((sum,value)=>sum+value,0)-800)<1e-7,
  'Sum-of-years-digits first depreciation year must equal two-thirds of the depreciable base')
assert.ok(Math.abs(sydAsset.depreciationByPeriod.slice(13,25).reduce((sum,value)=>sum+value,0)-400)<1e-7,
  'Sum-of-years-digits second depreciation year must equal one-third of the depreciable base')
const acceleratedAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-acc-01',name:'Accelerated asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:60,method:'accelerated',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(acceleratedAsset.valid,true)
assert.ok(Math.abs(acceleratedAsset.depreciationByPeriod.slice(1,13).reduce((sum,value)=>sum+value,0)-720)<1e-7,
  'Accelerated depreciation must apply the higher declining-balance amount in year one')
assert.ok(Math.abs(acceleratedAsset.depreciationByPeriod.slice(13,25).reduce((sum,value)=>sum+value,0)-480)<1e-7,
  'Accelerated depreciation must switch to straight-line when it exceeds declining balance in the final year')
const soldAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-sale-01',name:'Disposed asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[{id:'sale-01',assetId:'asset-sale-01',saleDate:'2024-10-15',priceMode:'self-defined',selfDefinedPrice:1500,exchangeRateToLocal:1}],monthlyDepreciationPeriods)
assert.equal(soldAsset.valid,true)
assert.equal(soldAsset.sales.length,1)
assert.equal(soldAsset.sales[0].saleProceeds,1500)
assert.ok(soldAsset.sales[0].gainLoss>0)
assert.equal(soldAsset.periods[9].closingBookValue,0)
assert.ok(soldAsset.periods.slice(10).every(period=>period.closingBookValue===0))
const invalidPeriodicAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-invalid-date',name:'Invalid date asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'1403/01/01',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(invalidPeriodicAsset.valid,false,'Non-ISO acquisition dates must fail closed until explicitly converted')

const advancedFinanceSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const feasibilityWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
const projectReportSource = await readFile(new URL('../src/features/projects/ProjectReportVisuals.tsx', import.meta.url), 'utf8')
assert.ok(projectReportSource.includes('equityIrrPercent')
  && projectReportSource.includes('20-quarter repayment schedule'),
  'COMFAR equity IRR must be disclosed with an explicit quarterly repayment comparability gate')
const projectFoundationPanelSource = await readFile(new URL('../src/features/projects/ProjectFoundationPanel.tsx', import.meta.url), 'utf8')
assert.ok(advancedFinanceSource.includes('equityDiscountRatePercent:props.costOfEquity'),
  'Advanced finance panel must discount shareholder NPV at the cost of equity, independently of project WACC')
assert.ok(advancedFinanceSource.includes('calculateIntegratedPeriodicFinance')
  && advancedFinanceSource.includes('periodicFinanceResult')
  && advancedFinanceSource.includes('periodDrawdowns')
  && advancedFinanceSource.includes('periodRateConversion')
  && advancedFinanceSource.includes('calculateOperatingCycleWorkingCapital')
  && advancedFinanceSource.includes('taxRatesByPeriod')
  && advancedFinanceSource.includes('updatePeriodTaxRate')
  && advancedFinanceSource.includes('periodDrawdownDates')
  && advancedFinanceSource.includes('periodTaxRateDates'),
  'Advanced finance panel must connect period schedules, rate conventions, working capital and the integrated periodic engine')
assert.ok(feasibilityWizardSource.includes('buildProjectCalendarPeriods')
  && feasibilityWizardSource.includes('projectPeriods={projectCalendarPeriods}')
  && feasibilityWizardSource.includes('cashFlowTiming={m.foundation.planning.cashFlowTiming}'),
  'Project calendar dates and discount timing must flow from the project foundation into the periodic finance engine')
assert.ok(projectReportSource.includes('Periodic Financial Model Outputs')
  && projectReportSource.includes('periodicResult.rows.map'),
  'Project report must include the period-level financial schedule and key output metrics')
assert.ok(projectFoundationPanelSource.includes('Day-count Basis')
  && projectFoundationPanelSource.includes('Cash Flow Timing for Discounting'),
  'Project foundation must require a day-count basis and cash-flow timing before periodic valuation')
assert.ok(advancedFinanceSource.includes('Values in the period tax schedule override the annual rate.')
  && !advancedFinanceSource.includes('Monthly/quarterly calculation will be enabled after the period engine is complete'),
  'Tax UI must explain period-specific overrides rather than claim monthly/quarterly support is unavailable')
const advancedFinanceUi = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
assert.ok(advancedFinanceUi.includes('Annual-to-Period Rate Convention')
  && advancedFinanceUi.includes('effective-annual-by-actual-days')
  && advancedFinanceUi.includes('effective-annual-divided-by-frequency')
  && advancedFinanceUi.includes('periodRateConversion'),
  'Periodic loan UI must expose both rate-conversion conventions and persist the explicit selection')
assert.ok(advancedFinanceUi.includes('financing.effective-annual-frequency-rate')
  && advancedFinanceUi.includes('periodicRateMethod.formula')
  && advancedFinanceUi.includes('periodicRateMethod.limitations'),
  'Frequency-based loan convention must display its source formula and limitations')
const comfarAnnualPeriods = Array.from({ length: 17 }, (_, index) => {
  // Iranian project year 1403 begins on 2024-03-20 and includes 366 days;
  // year 1404 begins on 2025-03-21. 12/1404 therefore ends on 2026-03-20.
  const start = new Date(Date.UTC(2024, 2, 20))
  const startOffsetDays = index === 0 ? 0 : 366 + (index - 1) * 365
  const periodStart = new Date(start.getTime() + startOffsetDays * 86400000)
  const periodDays = index === 0 ? 366 : 365
  const end = new Date(periodStart.getTime() + (periodDays - 1) * 86400000)
  return {
    index: index + 1,
    startDate: periodStart.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days: periodDays,
    partial: false,
  }
})
const comfarCashFlows = [...comfarReference.projectCashFlowsForIrr]
const comfarValuationDate = comfarAnnualPeriods[1].endDate
const comfarNpv = engine.calculatePeriodicNpv(
  comfarCashFlows, comfarAnnualPeriods, 25, 365, 'period-end',
  comfarValuationDate, 'period-count', 1,
)
assert.equal(comfarValuationDate, comfarReference.valuationDate, '12/1404 must map to the COMFAR valuation date')
assert.equal(comfarReference.projectCashFlowsByYear.length, 17, 'COMFAR source schedule must cover construction years 1403–1404 and operating years 1405–1419')
assert.deepEqual(comfarReference.taxScheduleByOperatingYear.map(row=>row.ratePercent), [...Array(5).fill(5),...Array(10).fill(25)], 'COMFAR tax schedule must preserve five years at 5% followed by ten years at 25%')
assert.equal(comfarReference.depreciationByOperatingYear.length, 15, 'COMFAR depreciation audit must cover all operating years')
assert.equal(comfarReference.depreciationByOperatingYear.find(([year])=>year===1414)?.[1], 98840.49, 'COMFAR depreciation must preserve the sharp 1414 reduction')
assert.equal(comfarReference.changeInWorkingCapitalByOperatingYear.find(([year])=>year===1405)?.[1], 3309144.53, 'COMFAR working-capital build must start in 1405')
assert.equal(comfarCashFlows.at(-1), comfarReference.projectCashFlowsByYear.at(-1)+comfarReference.terminalSalvage.amount, 'Terminal salvage shown in 1420 must be reconciled to the final operating-period cash-flow timing')
assert.ok(Math.abs(comfarNpv - comfarReference.projectNpvAt25) < 0.05,
  'COMFAR HRCR200 NPV at 25% and valuation date 12/1404 must reconcile within rounding')
const comfarIrr = engine.calculatePeriodicIrr(comfarCashFlows, comfarAnnualPeriods, 365, 'period-end')
assert.ok(comfarIrr !== null && Math.abs(comfarIrr - comfarReference.projectIrrPercent) < 0.01,
  'COMFAR HRCR200 project IRR must reconcile to 48.31% within displayed precision')
assert.ok(Math.abs(engine.calculatePeriodicNpv([100,100],comfarAnnualPeriods.slice(0,2),25,365,'period-end',comfarAnnualPeriods[1].endDate,'period-count',1)-225) < 1e-8,
  'A cash flow before the valuation date must be compounded forward to the valuation date')
assert.ok(advancedFinanceUi.includes("periodicFinanceResult?.valid ? periodicFinanceResult.loanSchedules[loan.id]")
  && advancedFinanceUi.includes("periodicFinanceResult.rows[i]?.startDate"),
  'Loan repayment detail must display the actual monthly/quarterly schedule and its period dates when the periodic engine is valid')
const financingAuditDoc = await readFile(new URL('../../docs/references/HRCR200-COMFAR-financing-reconstruction.md', import.meta.url), 'utf8')
assert.ok(financingAuditDoc.includes('840,992.27')
  && financingAuditDoc.includes('2,399,043.44')
  && financingAuditDoc.includes('964,925.63')
  && financingAuditDoc.includes('3,363,969.07'),
  'HRCR200 financing audit must preserve the reconstructed 20-quarter annuity and first-year debt-service reconciliation')
assert.ok(financingAuditDoc.includes('one-off or recurring')
  && financingAuditDoc.includes('must not be charged twice')
  && financingAuditDoc.includes('3,309,144.53'),
  'HRCR200 financing audit must keep issuance-fee ambiguity and shareholder working-capital funding explicit')
console.log('PASS: asset-level monthly/quarterly depreciation, disposals and integrated periodic project finance, loan schedules, fiscal-year allocation, leap-year handling, tax-loss roll-forward and dated NPV')

// Shareholder-funded working capital is recorded once as an equity injection;
// the equity cash flow must not also deduct the full project WC movement.
const equityWorkingCapitalPeriods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365, partial: false },
  { index: 2, startDate: '2026-01-01', endDate: '2026-12-31', days: 365, partial: false },
]
const equityWorkingCapitalResult = engine.calculateIntegratedPeriodicFinance({
  periods: equityWorkingCapitalPeriods,
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [0, 100],
  annualVariableCost: [0, 0],
  annualFixedCost: [0, 0],
  annualDepreciation: [0, 0],
  annualFixedInvestment: [0, 0],
  annualPreOperatingCost: [0, 0],
  annualMaintenanceCapex: [0, 0],
  annualTaxRates: [0, 0],
  annualEquityContributions: [0, 0],
  annualEquityWorkingCapitalContributions: [0, 30],
  workingCapitalByPeriod: [0, 100],
  loans: [],
})
assert.equal(equityWorkingCapitalResult.valid, true, equityWorkingCapitalResult.warnings.join('; '))
assert.equal(equityWorkingCapitalResult.rows[1].changeInWorkingCapital, 100)
assert.equal(equityWorkingCapitalResult.rows[1].equityWorkingCapitalContribution, 30)
assert.equal(equityWorkingCapitalResult.rows[1].projectFreeCashFlow, 0)
assert.equal(equityWorkingCapitalResult.rows[1].equityFreeCashFlow, 70)
assert.equal(equityWorkingCapitalResult.totalEquityContribution, 30)

// HRCR200 reference: the first production-year shareholder WC cash contribution
// is distinct from the full net working-capital requirement.
const hrcr200WorkingCapitalResult = engine.calculateIntegratedPeriodicFinance({
  periods: [{ index: 1, startDate: '2026-01-01', endDate: '2026-12-31', days: 365, partial: false }],
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [0],
  annualVariableCost: [0],
  annualFixedCost: [0],
  annualDepreciation: [0],
  annualFixedInvestment: [0],
  annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0],
  annualTaxRates: [0],
  annualEquityContributions: [0],
  annualEquityWorkingCapitalContributions: [3309144.53],
  workingCapitalByPeriod: [4595370.46],
  loans: [],
})
assert.equal(hrcr200WorkingCapitalResult.valid, true, hrcr200WorkingCapitalResult.warnings.join('; '))
assert.ok(Math.abs(hrcr200WorkingCapitalResult.rows[0].equityFreeCashFlow + 3309144.53) < 0.01,
  'HRCR200 equity cash flow must deduct the shareholder-funded WC contribution once, not the full 4,595,370.46 requirement')
assert.ok(Math.abs(hrcr200WorkingCapitalResult.totalEquityContribution - 3309144.53) < 0.01)
const excessiveEquityWorkingCapitalResult = engine.calculateIntegratedPeriodicFinance({
  periods: equityWorkingCapitalPeriods,
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [0, 100],
  annualVariableCost: [0, 0],
  annualFixedCost: [0, 0],
  annualDepreciation: [0, 0],
  annualFixedInvestment: [0, 0],
  annualPreOperatingCost: [0, 0],
  annualMaintenanceCapex: [0, 0],
  annualTaxRates: [0, 0],
  annualEquityContributions: [0, 0],
  annualEquityWorkingCapitalContributions: [0, 101],
  workingCapitalByPeriod: [0, 100],
  loans: [],
})
assert.equal(excessiveEquityWorkingCapitalResult.valid, false)

