import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const engineModuleUrl='data:text/javascript;base64,' + Buffer.from(output).toString('base64')
const engine = await import(engineModuleUrl)
const sensitivitySource=await readFile(new URL('../src/features/steel/periodicSensitivity.ts',import.meta.url),'utf8')
const sensitivityOutput=ts.transpileModule(sensitivitySource,{
  compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText.replace("from './periodicFinancialEngine'",`from '${engineModuleUrl}'`)
const periodicSensitivity=await import('data:text/javascript;base64,'+Buffer.from(sensitivityOutput).toString('base64'))
const benchmarkSource = await readFile(new URL('../src/features/steel/hotRollingExcelBenchmark.ts', import.meta.url), 'utf8')
const benchmarkOutput = ts.transpileModule(benchmarkSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const benchmark = await import('data:text/javascript;base64,' + Buffer.from(benchmarkOutput).toString('base64'))
const comfarReference = benchmark.HOT_ROLLING_COMFAR_OUTPUT_AUDIT

const partnerFinanceSource = await readFile(new URL('../src/features/projects/partnerFinance.ts', import.meta.url), 'utf8')
const partnerFinanceOutput = ts.transpileModule(partnerFinanceSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const partnerFinance = await import('data:text/javascript;base64,' + Buffer.from(partnerFinanceOutput).toString('base64'))
const partnerAllocation = partnerFinance.allocateJointVentureCashFlows({
  valid:true,
  totalEquityContribution:100,
  rows:[
    {period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:70,equityWorkingCapitalContribution:30},
    {period:2,startDate:'2026-01-01',endDate:'2026-12-31',equityFreeCashFlow:200,equityContribution:0,equityWorkingCapitalContribution:0},
    {period:3,startDate:'2027-01-01',endDate:'2027-12-31',equityFreeCashFlow:100,equityContribution:0,equityWorkingCapitalContribution:0},
  ],
},[
  {id:'p1',name:'Partner A',sharePercent:60,capitalContribution:60,profitSharePercent:30},
  {id:'p2',name:'Partner B',sharePercent:40,capitalContribution:40,profitSharePercent:70},
],50)
assert.equal(partnerAllocation.valid,true,partnerAllocation.warnings.join('; '))
assert.equal(partnerAllocation.rows[0].expectedCapitalContribution,60)
assert.equal(partnerAllocation.rows[0].capitalContributionVariance,0)
assert.equal(partnerAllocation.rows[1].expectedCapitalContribution,40)
assert.equal(partnerAllocation.rows[1].capitalContributionVariance,0)
assert.equal(partnerAllocation.rows[0].negativeCashFlowAllocation,-60)
assert.equal(partnerAllocation.rows[1].negativeCashFlowAllocation,-40)
assert.equal(partnerAllocation.rows[0].positiveCashFlowDistribution,45)
assert.equal(partnerAllocation.rows[1].positiveCashFlowDistribution,105)
assert.equal(partnerAllocation.rows[0].netCashFlow,-15)
assert.equal(partnerAllocation.rows[1].netCashFlow,65)
assert.equal(partnerAllocation.distributedPositiveCashFlow,150)
assert.equal(partnerAllocation.retainedPositiveCashFlow,150)
assert.equal(partnerAllocation.totalProjectEquityCashFlow,200)
assert.equal(partnerAllocation.totalDeclaredCapitalContribution,100)
assert.equal(partnerAllocation.totalScheduledEquityContribution,100)
assert.equal(partnerAllocation.declaredCapitalContributionVariance,0)
assert.equal(partnerAllocation.positiveCashFlowDistributionPercent,50)
assert.equal(partnerAllocation.allocationReconciliationVariance,0)
assert.equal(partnerAllocation.periods.length,3)
assert.equal(partnerAllocation.periods[0].totalEquityCashFlow,-100)
assert.equal(partnerAllocation.periods[0].partnerNetCashFlow,-100)
assert.equal(partnerAllocation.periods[1].totalEquityCashFlow,200)
assert.equal(partnerAllocation.periods[1].partnerNetCashFlow,100)
assert.equal(partnerAllocation.periods[1].retainedPositiveCashFlow,100)
assert.equal(partnerAllocation.periods[1].reconciliationVariance,0)
assert.equal(partnerAllocation.periods[2].reconciliationVariance,0)
assert.equal(partnerAllocation.periods[1].distributedPositiveCashFlow,100)
assert.equal(partnerAllocation.periods[1].retainedPositiveCashFlow,100)
assert.equal(partnerAllocation.rows.reduce((sum,row)=>sum+row.netCashFlow,0)+partnerAllocation.retainedPositiveCashFlow,200,
  'Partner net cash flows plus retained cash must reconcile to total project equity cash flow')
const invalidPartnerAllocation=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:100,equityContribution:100,equityWorkingCapitalContribution:0}],
},[
  {id:'p1',name:'Partner A',sharePercent:60,capitalContribution:60,profitSharePercent:60},
  {id:'p2',name:'Partner B',sharePercent:30,capitalContribution:40,profitSharePercent:30},
],100)
assert.equal(invalidPartnerAllocation.valid,false,'Partner equity and profit shares must each total 100%')

const mismatchedPartnerCapital=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:100,equityWorkingCapitalContribution:0}],
},[
  {id:'p1',name:'Partner A',sharePercent:60,capitalContribution:50,profitSharePercent:60},
  {id:'p2',name:'Partner B',sharePercent:40,capitalContribution:50,profitSharePercent:40},
],100)
assert.equal(mismatchedPartnerCapital.totalDeclaredCapitalContribution,100,
  'Aggregate declared capital may match while individual partner contributions are wrong')
assert.equal(mismatchedPartnerCapital.rows[0].capitalContributionVariance,-10)
assert.equal(mismatchedPartnerCapital.rows[1].capitalContributionVariance,10)
assert.equal(mismatchedPartnerCapital.valid,false,
  'Each partner declared contribution must reconcile to the agreed capital-share allocation')
assert.ok(mismatchedPartnerCapital.warnings.some(warning=>warning.includes('Each partner declared capital contribution')),
  'Partner-level capital contribution mismatch must be disclosed')

const aggregateContributionMismatch=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:80,equityWorkingCapitalContribution:0}],
},[
  {id:'p1',name:'Partner A',sharePercent:60,capitalContribution:60,profitSharePercent:60},
  {id:'p2',name:'Partner B',sharePercent:40,capitalContribution:40,profitSharePercent:40},
],100)
assert.equal(aggregateContributionMismatch.valid,false,
  'Aggregate contribution must reconcile to periodic contribution components')
assert.ok(aggregateContributionMismatch.warnings.some(warning=>warning.includes('aggregated equity contribution')),
  'Periodic contribution mismatch must be disclosed')

const invalidPeriodDate=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-02-30',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:100,equityWorkingCapitalContribution:0}],
},[
  {id:'p1',name:'Partner A',sharePercent:100,capitalContribution:100,profitSharePercent:100},
],100)
assert.equal(invalidPeriodDate.valid,false,'Invalid calendar dates must block partner allocation')

const gapInPeriodicSchedule=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[
    {period:1,startDate:'2025-01-01',endDate:'2025-06-30',equityFreeCashFlow:-100,equityContribution:100,equityWorkingCapitalContribution:0},
    {period:2,startDate:'2025-07-02',endDate:'2025-12-31',equityFreeCashFlow:0,equityContribution:0,equityWorkingCapitalContribution:0},
  ],
},[
  {id:'p1',name:'Partner A',sharePercent:100,capitalContribution:100,profitSharePercent:100},
],100)
assert.equal(gapInPeriodicSchedule.valid,false,'Gaps in the periodic cash-flow schedule must block partner allocation')

const malformedPartnerRecord=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:100,equityWorkingCapitalContribution:0}],
},[
  null,
],100)
assert.equal(malformedPartnerRecord.valid,false,'Malformed persisted partner records must return validation errors instead of throwing')

const malformedPartnerName=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,
  rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:-100,equityContribution:100,equityWorkingCapitalContribution:0}],
},[
  {id:'p1',name:null,sharePercent:100,capitalContribution:100,profitSharePercent:100},
],100)
assert.equal(malformedPartnerName.valid,false,'Non-string persisted partner names must be rejected safely')

const malformedPeriodicRow=partnerFinance.allocateJointVentureCashFlows({
  valid:true,totalEquityContribution:100,rows:[null],
},[
  {id:'p1',name:'Partner A',sharePercent:100,capitalContribution:100,profitSharePercent:100},
],100)
assert.equal(malformedPeriodicRow.valid,false,'Malformed periodic rows must return validation errors instead of throwing')





const malformedPartnerFinance=partnerFinance.allocateJointVentureCashFlows({
  valid:true,rows:[{period:1,startDate:'2025-01-01',endDate:'2025-12-31',equityFreeCashFlow:100}],
},[
  {id:'p1',name:'Partner A',sharePercent:100,capitalContribution:0,profitSharePercent:100},
],100)
assert.equal(malformedPartnerFinance.valid,false,
  'Partner allocation must reject missing/non-finite scheduled equity contribution totals')


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
assert.ok(Math.abs(equalPrincipalLoan.rows[0].interestExpense) < 1e-8)
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
assert.equal(comfarReference.loanRepaymentAudit.quarterlySchedule.length,20)
hrcr200ComfarLoan.rows.forEach((row,index)=>{
  const reference=comfarReference.loanRepaymentAudit.quarterlySchedule[index]
  assert.ok(Math.abs(row.interestExpense-reference.interestExpense)<0.1,
    'HRCR200 quarter '+(index+1)+' interest must match the reconstructed annuity reference')
  assert.ok(Math.abs(row.principal-reference.principal)<0.1,
    'HRCR200 quarter '+(index+1)+' principal must match the reconstructed annuity reference')
  assert.ok(Math.abs(row.debtService-reference.debtService)<0.1,
    'HRCR200 quarter '+(index+1)+' debt service must match the reconstructed annuity reference')
  assert.ok(Math.abs(row.closingBalance-reference.closingBalance)<0.1,
    'HRCR200 quarter '+(index+1)+' closing debt must match the reconstructed annuity reference')
})
assert.ok(Math.abs(hrcr200ComfarLoan.rows.at(-1).closingBalance) < 1e-7,
  'HRCR200 COMFAR annuity must fully amortize the gross opening loan balance after 20 quarters')
const hrcr200AnnualPrincipalFromQuarters=Array.from({length:5},(_,yearIndex)=>
  hrcr200ComfarLoan.rows.slice(yearIndex*4,yearIndex*4+4).reduce((sum,row)=>sum+row.principal,0))
hrcr200AnnualPrincipalFromQuarters.forEach((value,index)=>assert.ok(
  Math.abs(value-comfarReference.loanRepaymentAudit.annualPrincipalRepaymentsByYear[index])<0.1,
  'HRCR200 quarterly annuity principal must reconcile to the OPEX COMFAR annual financing-flow schedule for year '+(1405+index)
))

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

const hrcrWorkingCapitalBuffer = engine.calculateIntegratedPeriodicFinance({
  periods:[year[0]],fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
  annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
  annualTaxRates:[5],annualEquityContributions:[0],
  annualEquityWorkingCapitalContributions:[3309144.53],
  workingCapitalByPeriod:[3216759.32004],openingWorkingCapital:0,loans:[],
})
assert.equal(hrcrWorkingCapitalBuffer.valid,true)
assert.ok(Math.abs(hrcrWorkingCapitalBuffer.rows[0].equityFreeCashFlow+3309144.53)<0.01,
  'COMFAR shareholder funding must preserve the full reported 1405 equity outflow')
const hrcrBufferStatements=engine.buildPeriodicThreeFinancialStatements(hrcrWorkingCapitalBuffer)
assert.ok(Math.abs(hrcrBufferStatements[0].balanceSheet.cash-92385.20996)<0.01,
  'The 92,385.21 difference between shareholder funding and OPEX working-capital use must remain as cash buffer')
assert.ok(hrcrBufferStatements[0].balanceSheet.reconciled,
  'The COMFAR equity funding buffer must reconcile as cash without a balance-sheet plug')
const quarterlyWorkingCapitalProfile=quarter.reduce((values,period,index)=>{
  const elapsedDays=quarter.slice(0,index+1).reduce((sum,item)=>sum+item.days,0)
  values.push(3216759.32004*elapsedDays/365)
  return values
},[])
const hrcrQuarterlyWorkingCapitalBuffer=engine.calculateIntegratedPeriodicFinance({
  periods:quarter,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
  annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
  annualTaxRates:[5],annualEquityContributions:[0],
  annualEquityWorkingCapitalContributions:[3309144.53],
  workingCapitalByPeriod:quarterlyWorkingCapitalProfile,openingWorkingCapital:0,loans:[],
})
assert.equal(hrcrQuarterlyWorkingCapitalBuffer.valid,true)
assert.ok(Math.abs(hrcrQuarterlyWorkingCapitalBuffer.rows.reduce((sum,row)=>sum+row.equityFreeCashFlow,0)+3309144.53)<0.01,
  'Annual COMFAR shareholder working-capital contribution must aggregate correctly across quarterly periods')
const hrcrQuarterlyBufferStatements=engine.buildPeriodicThreeFinancialStatements(hrcrQuarterlyWorkingCapitalBuffer)
assert.ok(Math.abs(hrcrQuarterlyBufferStatements[3].balanceSheet.cash-92385.20996)<0.01,
  'Quarterly working-capital phasing must preserve the annual 92,385.21 cash buffer')
assert.ok(hrcrQuarterlyBufferStatements.every(statement=>statement.balanceSheet.reconciled),
  'Each quarterly balance sheet must reconcile while phasing the shareholder working-capital contribution')
assert.ok(Math.abs(hrcrWorkingCapitalBuffer.totalEquityContribution-3309144.53)<0.01)

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

const openingDebtWithScheduledFacility = engine.calculateIntegratedPeriodicFinance({
  periods:quarter,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
  annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
  annualTaxRates:[0],annualEquityContributions:[0],workingCapitalByPeriod:[0,0,0,0],
  loans:[{id:'opening-facility',input:{
    annualRatePercent:0,drawdowns:[0,0,0,0],openingBalance:100,
    repaymentMethod:'bullet',repaymentStartPeriod:1,gracePeriods:3,
    termPeriods:1,capitalizeInterest:false,
  }}],
})
assert.equal(openingDebtWithScheduledFacility.valid,true,openingDebtWithScheduledFacility.warnings.join('; '))
const openingDebtWithFacilityStatements = engine.buildPeriodicThreeFinancialStatements(
  openingDebtWithScheduledFacility,{cash:200,debt:150,paidInCapital:50},
)
assert.equal(openingDebtWithFacilityStatements.length,4,
  'Existing opening debt must include the opening balance of every modelled loan facility')
assert.deepEqual(openingDebtWithFacilityStatements.map(row=>row.balanceSheet.debt),[150,150,150,50],
  'Opening debt must not be double-counted; unmodelled legacy debt must remain while the scheduled facility amortizes')
assert.ok(openingDebtWithFacilityStatements.every(row=>row.balanceSheet.reconciled),
  'Three statements must reconcile when opening debt contains both scheduled and legacy facilities')
assert.equal(engine.buildPeriodicThreeFinancialStatements(
  openingDebtWithScheduledFacility,{cash:200,debt:50,paidInCapital:50},
).length,0,
  'Statement generation must reject a scheduled opening loan balance that exceeds the opening debt liability')
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
const periodicAssetDisposalLoss = engine.calculateIntegratedPeriodicFinance({
  periods: quarter, fiscalYearStartMonth: 1, dayCountBasis: 365, cashFlowTiming: 'period-end',
  annualRevenue: [4800], annualVariableCost: [1600], annualFixedCost: [400],
  annualDepreciation: [400], annualFixedInvestment: [0], annualPreOperatingCost: [0],
  annualMaintenanceCapex: [0], annualTaxRates: [25], annualEquityContributions: [0],
  workingCapitalByPeriod: [0, 0, 0, 0], loans: [],
  annualAssetSaleSchedule: [{
    saleProceeds: 500, returnOfCapital: 500, otherIncomeLoss: -140, bookValueDisposed: 640
  }]
})
assert.equal(periodicAssetDisposalLoss.valid,true,'Periodic finance must accept a correctly reconciled disposal loss')
const disposalLossRow=periodicAssetDisposalLoss.rows[3]
assert.equal(disposalLossRow.assetSaleOtherIncomeLoss,-140)
assert.ok(Math.abs(disposalLossRow.ebit-(disposalLossRow.revenue-disposalLossRow.variableCost-disposalLossRow.fixedCost-disposalLossRow.depreciation-140))<1e-8,
  'Disposal loss must reduce taxable EBIT')
assert.ok(Math.abs(disposalLossRow.projectFreeCashFlow-(disposalLossRow.ebit+140-disposalLossRow.unleveredTax+disposalLossRow.depreciation+500))<1e-8,
  'Project cash flow must add back the accounting loss and include disposal proceeds once')

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
const annualDepreciationPeriods=Array.from({length:3},(_,index)=>{
  const year=2024+index
  const start=new Date(Date.UTC(year,0,1))
  const end=new Date(Date.UTC(year+1,0,1)-86400000)
  return {index:index+1,startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),days:Math.round((end-start)/86400000)+1,partial:false}
})

const periodicTaxLossRollForward=engine.calculateIntegratedPeriodicFinance({
  periods:annualDepreciationPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,150],annualVariableCost:[0,0,0],annualFixedCost:[100,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],discountRatePercent:10,
})
assert.equal(periodicTaxLossRollForward.valid,true,periodicTaxLossRollForward.warnings.join('; '))
assert.deepEqual(periodicTaxLossRollForward.rows.map(row=>row.taxLossCarryForward),[100,100,0])
assert.deepEqual(periodicTaxLossRollForward.rows.map(row=>row.tax),[0,0,12.5],
  'Periodic integrated tax must carry operating losses forward and tax only the remaining taxable profit')

const expiredPeriodicTaxLoss=engine.calculateIntegratedPeriodicFinance({
  periods:annualDepreciationPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,150],annualVariableCost:[0,0,0],annualFixedCost:[100,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],discountRatePercent:10,
  taxLossCarryForwardEnabled:true,taxLossCarryForwardYears:1,
})
assert.equal(expiredPeriodicTaxLoss.valid,true,expiredPeriodicTaxLoss.warnings.join('; '))
assert.equal(expiredPeriodicTaxLoss.rows[2].tax,37.5,
  'Losses must expire after the configured number of fiscal years rather than offsetting indefinitely')
const periodicTaxAllowance=engine.calculateIntegratedPeriodicFinance({
  periods:annualDepreciationPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0,150],annualVariableCost:[0,0,0],annualFixedCost:[0,0,0],
  annualDepreciation:[0,0,0],annualFixedInvestment:[0,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[25,25,25],annualEquityContributions:[0,0,0],
  workingCapitalByPeriod:[0,0,0],loans:[],discountRatePercent:10,taxAllowancesByPeriod:[0,0,50],
})
assert.equal(periodicTaxAllowance.valid,true,periodicTaxAllowance.warnings.join('; '))
assert.equal(periodicTaxAllowance.rows[2].taxAllowances,50)
assert.equal(periodicTaxAllowance.rows[2].tax,25,
  'Period tax allowances must reduce the taxable base before tax is calculated')
const periodicSensitivityInput={
  periods:annualDepreciationPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,1000,1200],annualVariableCost:[0,300,350],annualFixedCost:[0,100,100],
  annualDepreciation:[0,50,50],annualFixedInvestment:[500,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[25,25,25],annualEquityContributions:[500,0,0],
  workingCapitalByPeriod:[0,20,0],loans:[],discountRatePercent:15,equityDiscountRatePercent:20,
}
const periodicSensitivityResult=periodicSensitivity.calculatePeriodicSensitivity(
  periodicSensitivityInput,['revenue','variable-cost','tax-rate'],10,'npvProject'
)
assert.equal(periodicSensitivityResult.valid,true,periodicSensitivityResult.issues.join('; '))
assert.equal(periodicSensitivityResult.points.length,6)
assert.ok(periodicSensitivityResult.points.every(point=>point.valid&&point.metric!==null))
assert.ok(periodicSensitivityResult.optimistic.npvProject>periodicSensitivityResult.baseline.npvProject)
assert.ok(periodicSensitivityResult.pessimistic.npvProject<periodicSensitivityResult.baseline.npvProject)
const targetSearch=periodicSensitivity.searchPeriodicFinanceTarget({
  finance:periodicSensitivityInput,variable:'revenue',metric:'npvProject',
  target:(periodicSensitivityResult.baseline.npvProject??0)+1,direction:'increase',
  maxVariationPercent:50,tolerance:0.001,maxIterations:80,
})
assert.equal(targetSearch.achieved,true,targetSearch.issues.join('; '))
assert.ok((targetSearch.achievedValue??-Infinity)>=(targetSearch.target-0.001))
assert.throws(()=>periodicSensitivity.applyPeriodicSensitivityShock({
  ...periodicSensitivityInput,precomputedLoanSchedules:{'form-loan':[]},
},'loan-interest-rate',10),/loan-interest-rate-sensitivity-unavailable-for-precomputed-schedules/,
'A loan-rate shock must not silently leave a precomputed repayment schedule unchanged')
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
const partialFirstYearAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-partial-first-year',name:'Partial first depreciation year',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:6,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(partialFirstYearAsset.valid,true)
assert.equal(partialFirstYearAsset.depreciationByPeriod[6],300,'Six-month first depreciation year must charge half the annual straight-line amount at its balance date')
assert.equal(partialFirstYearAsset.depreciationByPeriod[18],600,'The next full depreciation year must charge the full annual amount')
assert.equal(partialFirstYearAsset.depreciationByPeriod[24],300,'The final partial year must clear the remaining depreciable base')
assert.ok(Math.abs(partialFirstYearAsset.periods.at(-1).closingBookValue)<1e-7)
const annualPartialFirstYearAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-annual-partial-first-year',name:'Annual period with two depreciation boundaries',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:6,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'2024-12-31',startingAtDate:'2025-01-01'
}],[],annualDepreciationPeriods)
assert.equal(annualPartialFirstYearAsset.valid,true)
assert.deepEqual(annualPartialFirstYearAsset.depreciationByPeriod,[0,300,900],
  'An annual reporting period must accumulate both the remaining partial-year and full-year depreciation segments due within it')
assert.ok(Math.abs(annualPartialFirstYearAsset.periods.at(-1).closingBookValue)<1e-7)
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
}],[{id:'sale-01',assetId:'asset-sale-01',saleDate:'2024-10-31',priceMode:'self-defined',selfDefinedPrice:1500,exchangeRateToLocal:1}],monthlyDepreciationPeriods)
assert.equal(soldAsset.valid,true)
assert.equal(soldAsset.sales.length,1)
assert.equal(soldAsset.sales[0].saleProceeds,1500)
assert.ok(soldAsset.sales[0].gainLoss>0)
assert.equal(soldAsset.periods[9].assets[0].depreciation,450,'Disposal at the period balance date must prorate the current depreciation year by elapsed months')
assert.equal(soldAsset.periods[9].closingBookValue,0)
assert.ok(soldAsset.periods.slice(10).every(period=>period.closingBookValue===0))
const duplicateAssetDisposal=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-duplicate-sale',name:'Duplicate disposal guard',assetClass:'fixed',
  originalValue:1000,initialBookValue:1000,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'linear-to-zero',
  acquisitionDate:'2024-01-15',startingAtDate:'2024-01-01'
}],[
  {id:'sale-duplicate-a',assetId:'asset-duplicate-sale',saleDate:'2024-10-31',priceMode:'book-value',selfDefinedPrice:null,exchangeRateToLocal:1},
  {id:'sale-duplicate-b',assetId:'asset-duplicate-sale',saleDate:'2024-12-31',priceMode:'book-value',selfDefinedPrice:null,exchangeRateToLocal:1},
],monthlyDepreciationPeriods)
assert.equal(duplicateAssetDisposal.valid,false,'An asset vintage cannot be disposed twice')
const invalidPeriodSequence=engine.calculatePeriodicComfarAssetLifecycle([],[],[
  {...annualDepreciationPeriods[0],index:1},
  {...annualDepreciationPeriods[1],index:3},
  {...annualDepreciationPeriods[2],index:4},
])
assert.equal(invalidPeriodSequence.valid,false,'Period indexes must be consecutive and ordered')
const invalidPeriodicAsset=engine.calculatePeriodicComfarAssetLifecycle([{
  id:'asset-invalid-date',name:'Invalid date asset',assetClass:'fixed',
  originalValue:1200,initialBookValue:1200,scrapPercent:0,lengthYears:2,lengthMonths:0,
  firstDepreciationMonths:12,ratePercent:null,method:'linear-to-scrap',
  acquisitionDate:'1403/01/01',startingAtDate:'2024-01-01'
}],[],monthlyDepreciationPeriods)
assert.equal(invalidPeriodicAsset.valid,false,'Non-ISO acquisition dates must fail closed until explicitly converted')

const advancedFinanceSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const feasibilityWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
const projectsViewSource = await readFile(new URL('../src/features/projects/ProjectsView.tsx', import.meta.url), 'utf8')
const projectReportSource = await readFile(new URL('../src/features/projects/ProjectReportVisuals.tsx', import.meta.url), 'utf8')
assert.ok(projectReportSource.includes('equityIrrPercent')
  && projectReportSource.includes('20-quarter repayment schedule'),
  'COMFAR equity IRR must be disclosed with an explicit quarterly repayment comparability gate')
const projectFoundationPanelSource = await readFile(new URL('../src/features/projects/ProjectFoundationPanel.tsx', import.meta.url), 'utf8')
assert.ok(advancedFinanceSource.includes('equityDiscountRatePercent:props.costOfEquity'),
  'Advanced finance panel must discount shareholder NPV at the cost of equity, independently of project WACC')
assert.ok(advancedFinanceSource.includes('calculateIntegratedPeriodicFinance')
  && advancedFinanceSource.includes('calculatePeriodicSensitivity')
  && advancedFinanceSource.includes('bindLoanFacilitiesToPeriodicFinance')
  && advancedFinanceSource.includes('sensitivityInput:sensitivityLoanBinding.valid?sensitivityLoanBinding.financeInput??undefined:undefined')
  && advancedFinanceSource.includes('periodicSensitivityResult.pessimistic')
  && advancedFinanceSource.includes('periodicSensitivityResult.optimistic')
  && advancedFinanceSource.includes('periodicFinanceResult')
  && advancedFinanceSource.includes('periodDrawdowns')
  && advancedFinanceSource.includes('periodRateConversion')
  && advancedFinanceSource.includes('calculateOperatingCycleWorkingCapital')
  && advancedFinanceSource.includes('taxRatesByPeriod')
  && advancedFinanceSource.includes('updatePeriodTaxRate')
  && advancedFinanceSource.includes('periodDrawdownDates')
  && advancedFinanceSource.includes('periodTaxRateDates'),
  'Advanced finance panel must connect period schedules, rate conventions, working capital and the integrated periodic engine')
assert.ok(feasibilityWizardSource.includes("project.templateId==='raw'")
  && feasibilityWizardSource.includes("stage:'other'")
  && feasibilityWizardSource.includes('technical:[]')
  && feasibilityWizardSource.includes('balance:[]')
  && feasibilityWizardSource.includes('utilities:[]')
  && feasibilityWizardSource.includes('capex:[]')
  && feasibilityWizardSource.includes('opex:[]')
  && feasibilityWizardSource.includes('blankZero={isRawTemplate}'),
  'The current raw project wizard must start with empty engineering and cost schedules and preserve blank numeric inputs')
assert.ok(feasibilityWizardSource.includes('function TechnicalParameterEditor')
  && feasibilityWizardSource.includes('valueText')
  && feasibilityWizardSource.includes('مقدار / مشخصه')
  && feasibilityWizardSource.includes('technicalParametersComplete'),
  'Raw technical parameters must support descriptive and numeric values and validate completed entries')
assert.ok(feasibilityWizardSource.includes('flowType')
  && feasibilityWizardSource.includes('sumMaterialInputs')
  && feasibilityWizardSource.includes('showFlowType')
  && feasibilityWizardSource.includes('Output / Product'),
  'Material balance must distinguish inputs from products and by-products before cost aggregation')
assert.ok(feasibilityWizardSource.includes('productPricingComplete')
  && feasibilityWizardSource.includes('productWeightedRevenuePrice')
  && feasibilityWizardSource.includes('sum(m.products)'),
  'Priced multi-product and by-product rows must feed weighted project revenue')
assert.ok(feasibilityWizardSource.includes("n(r.quantity)*n(r.unitPrice)")
  && feasibilityWizardSource.includes("sumMaterialInputs(m.balance)+sum(m.utilities)"),
  'Raw variable-cost aggregation must use quantity times unit price and exclude material outputs')
assert.ok(projectsViewSource.includes("t('نام پروژه','Project Name')")
  && projectsViewSource.includes('placeholder={t(\'نام دلخواه پروژه را وارد کنید\''),
  'Raw project creation must always request a manually entered project name')
assert.ok(feasibilityWizardSource.includes('buildProjectCalendarPeriods')
  && feasibilityWizardSource.includes('projectPeriods={projectCalendarPeriods}')
  && feasibilityWizardSource.includes('cashFlowTiming={m.foundation.planning.cashFlowTiming}'),
  'Project calendar dates and discount timing must flow from the project foundation into the periodic finance engine')
assert.ok(feasibilityWizardSource.includes('partners:Array.isArray(saved.partners)?saved.partners:[]')
  && feasibilityWizardSource.includes('partnerDistributionPercent:Number.isFinite(saved.partnerDistributionPercent)'),
  'Saved projects created before joint-venture partner fields must migrate to safe defaults')
assert.ok(feasibilityWizardSource.includes('partnerDistributionPercent={m.partnerDistributionPercent??Number.NaN}')
  && feasibilityWizardSource.includes('درصد جریان نقدی مثبت قابل تقسیم')
  && advancedFinanceSource.includes('allocateJointVentureCashFlows')
  && advancedFinanceSource.includes('onPartnerFinanceResult')
  && advancedFinanceSource.includes('expectedCapitalContribution')
  && advancedFinanceSource.includes('partnerFinanceResult.periods.map')
  && feasibilityWizardSource.includes('reportPartnerFinance')
  && feasibilityWizardSource.includes('partnerFinanceResult={reportPartnerFinance}')
  && advancedFinanceSource.includes('Partner net CF'),
  'Joint-venture partner shares and distribution policy must connect to period-level equity cash flows')
assert.ok(projectReportSource.includes('Project Technical & Cost Form Details')
  && projectReportSource.includes('Technical Parameters')
  && projectReportSource.includes('Material Balance & Feed')
  && projectReportSource.includes('Market Information Summary')
  && feasibilityWizardSource.includes('marketSummary={m.market}')
  && feasibilityWizardSource.includes('technicalParameters={m.technical}')
  && feasibilityWizardSource.includes('materialBalance={m.balance}')
  && feasibilityWizardSource.includes('capexItems={m.capex')
  && feasibilityWizardSource.includes('opexItems={m.opex'),
  'Project reports must include the populated raw and specialist technical, material-balance, utility, CAPEX and OPEX forms')
assert.ok(projectReportSource.includes('Periodic Financial Model Outputs')
  && projectReportSource.includes('periodicResult.rows.map')
  && projectReportSource.includes('Joint-Venture Partner Cash-Flow Allocation')
  && projectReportSource.includes('allocationReconciliationVariance')
  && projectReportSource.includes('expectedCapitalContribution')
  && projectReportSource.includes('partnerFinanceResult.periods.map'),
  'Project report must include the period-level financial schedule and key output metrics')
assert.ok(projectReportSource.includes('external period-by-period HRCR200 balance-sheet parity remains unverified')
  && projectReportSource.includes('the financial engine performs an internal assets = liabilities + equity control'),
  'The HRCR200 report must distinguish internal balance-sheet reconciliation from external period-by-period parity')
assert.ok(projectReportSource.includes('aggregatePeriodicFinanceByFiscalYear')
  && projectReportSource.includes('hasCompleteFiscalYearCoverage')
  && projectReportSource.includes('fiscalYearStartMonth')
  && projectReportSource.includes('opexWorkingCapitalByYear')
  && projectReportSource.includes('COMFAR reference working-capital movement')
  && projectReportSource.includes('derivedDscr')
  && projectReportSource.includes('annualDebtServiceByYear')
  && projectReportSource.includes('Quarter-by-quarter reconstructed debt-service reconciliation')
  && projectReportSource.includes('quarterlyDebtRows')
  && projectReportSource.includes('quarterlySchedule'),
  'HRCR200 benchmark reconciliation must expose annual and all-20-quarter debt-service comparisons')
assert.ok(projectFoundationPanelSource.includes('Day-count Basis')
  && projectFoundationPanelSource.includes('Cash Flow Timing for Discounting'),
  'Project foundation must require a day-count basis and cash-flow timing before periodic valuation')
assert.ok(advancedFinanceSource.includes('Values in the period tax schedule override the annual rate.')
  && !advancedFinanceSource.includes('Monthly/quarterly calculation will be enabled after the period engine is complete'),
  'Tax UI must explain period-specific overrides rather than claim monthly/quarterly support is unavailable')
const feasibilityWizardUi = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(feasibilityWizardUi.includes("cashflow:periodicModelValid&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true)")
  && feasibilityWizardUi.includes("results:periodicModelValid&&model.flows.length>0&&model.flows.every(Number.isFinite)&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true)")
  && feasibilityWizardUi.includes("reports:periodicModelValid&&!!String(m.project.name??'').trim()&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true)"),
  'Joint-venture cash flow, results and report steps must require a valid partner allocation')

assert.ok(feasibilityWizardUi.includes('Array.isArray(m.partners)')
  && feasibilityWizardUi.includes("typeof p.id==='string'")
  && feasibilityWizardUi.includes("typeof p.name==='string'")
  && feasibilityWizardUi.includes('Number.isFinite(m.partnerDistributionPercent)'),
  'Joint-venture setup validation must safely reject malformed persisted partner records and invalid percentages')

assert.ok(feasibilityWizardUi.includes("key==='partners'||key==='partnerDistributionPercent'")
  && feasibilityWizardUi.includes('setReportPartnerFinance(null)')
  && feasibilityWizardUi.includes("key==='scope'"),
  'Changing JV partners, distribution policy or JV activation must invalidate stale partner allocation results immediately')



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
assert.equal(comfarReference.firstOperatingYearWorkingCapitalFunding.opexWorkingCapitalByYear[0].annualIncrease,3216759.32004,
  'OPEX working-capital requirement must remain separate from COMFAR shareholder funding')
assert.equal(comfarReference.firstOperatingYearWorkingCapitalFunding.opexWorkingCapitalByYear[1].annualIncrease,459537.04572)
assert.ok(Math.abs(
  comfarReference.firstOperatingYearWorkingCapitalFunding.comfarEquityContribution-
  comfarReference.firstOperatingYearWorkingCapitalFunding.opexWorkingCapitalByYear[0].annualIncrease-
  comfarReference.firstOperatingYearWorkingCapitalFunding.fundingBufferPendingReconciliation
)<0.01,'The 1405 difference between COMFAR equity source and OPEX working-capital use must reconcile as a separately disclosed buffer')
assert.equal(comfarCashFlows.at(-1), comfarReference.projectCashFlowsByYear.at(-1)+comfarReference.terminalSalvage.amount, 'Terminal salvage shown in 1420 must be reconciled to the final operating-period cash-flow timing')
assert.ok(Math.abs(comfarNpv - comfarReference.projectNpvAt25) < 0.05,
  'COMFAR HRCR200 NPV at 25% and valuation date 12/1404 must reconcile within rounding')

const fiscalQuarterRows = [
  { period:1,startDate:'2025-04-01',endDate:'2025-06-30',days:91,taxRatePercent:5,projectFreeCashFlow:10,equityContribution:5,equityWorkingCapitalContribution:0,debtDrawdown:2,capitalizedInterest:1,depreciation:2,changeInWorkingCapital:3,interestExpense:4,principal:5,debtService:9,cfads:18 },
  { period:2,startDate:'2025-07-01',endDate:'2025-09-30',days:92,taxRatePercent:5,projectFreeCashFlow:20,equityContribution:6,equityWorkingCapitalContribution:0,debtDrawdown:3,capitalizedInterest:0,depreciation:3,changeInWorkingCapital:4,interestExpense:3,principal:6,debtService:9,cfads:18 },
  { period:3,startDate:'2026-04-01',endDate:'2026-06-30',days:91,taxRatePercent:5,projectFreeCashFlow:30,equityContribution:0,equityWorkingCapitalContribution:10,debtDrawdown:0,capitalizedInterest:0,depreciation:4,changeInWorkingCapital:5,interestExpense:2,principal:7,debtService:9,cfads:18 },
  { period:4,startDate:'2026-07-01',endDate:'2026-09-30',days:92,taxRatePercent:25,projectFreeCashFlow:40,equityContribution:0,equityWorkingCapitalContribution:0,debtDrawdown:0,capitalizedInterest:0,depreciation:5,changeInWorkingCapital:6,interestExpense:1,principal:8,debtService:9,cfads:18 },
]
const fiscalQuarterAggregation = engine.aggregatePeriodicFinanceByFiscalYear(fiscalQuarterRows,4,2)
assert.equal(fiscalQuarterAggregation.length,2)
assert.equal(fiscalQuarterAggregation[0].projectFreeCashFlow,30)
assert.equal(fiscalQuarterAggregation[0].depreciation,5)
assert.equal(fiscalQuarterAggregation[0].changeInWorkingCapital,7)
assert.equal(fiscalQuarterAggregation[0].interestExpense,7)
assert.equal(fiscalQuarterAggregation[0].principal,11)
assert.equal(fiscalQuarterAggregation[0].dscr,2)
assert.equal(fiscalQuarterAggregation[0].equityContribution,11)
assert.equal(fiscalQuarterAggregation[0].netDebtFinancingFlow,-5)
assert.equal(fiscalQuarterAggregation[1].equityContribution,10)
assert.equal(fiscalQuarterAggregation[1].projectFreeCashFlow,70)
assert.equal(fiscalQuarterAggregation[1].taxRatePercent,null,
  'Mixed intra-year tax rates must not be presented as one annual tax rate')
assert.equal(engine.hasCompleteFiscalYearCoverage(fiscalQuarterRows,4,2,4),false,
  'Partial quarterly schedules must not be certified as complete fiscal years')

const hrcrAnnualAggregation = engine.aggregatePeriodicFinanceByFiscalYear(
  comfarAnnualPeriods.map((period,index)=>({
    period:index+1,startDate:period.startDate,endDate:period.endDate,days:period.days,
    taxRatePercent:index<2?25:comfarReference.taxScheduleByOperatingYear[index-2].ratePercent,
    projectFreeCashFlow:comfarCashFlows[index],
    equityContribution:comfarReference.financingCashFlowsByYear[index].equity,
    equityWorkingCapitalContribution:0,
    debtDrawdown:Math.max(0,comfarReference.financingCashFlowsByYear[index].longTermLoanNet),
    capitalizedInterest:0,
    depreciation:index<2?0:comfarReference.depreciationByOperatingYear[index-2][1],
    changeInWorkingCapital:index<2?0:comfarReference.changeInWorkingCapitalByOperatingYear[index-2][1],
    interestExpense:0,principal:Math.max(0,-comfarReference.financingCashFlowsByYear[index].longTermLoanNet),debtService:0,cfads:0,
  })),3,17
)
assert.equal(hrcrAnnualAggregation.length,17)
assert.equal(engine.hasCompleteFiscalYearCoverage(comfarAnnualPeriods.map((period,index)=>({
  period:index+1,startDate:period.startDate,endDate:period.endDate,days:period.days,
  taxRatePercent:25,projectFreeCashFlow:0,equityContribution:0,equityWorkingCapitalContribution:0,
  debtDrawdown:0,capitalizedInterest:0,depreciation:0,changeInWorkingCapital:0,
  interestExpense:0,principal:0,debtService:0,cfads:0,
})),3,17,1),true,'Full 17-year HRCR200 schedule must pass fiscal-year coverage')
assert.equal(hrcrAnnualAggregation[0].projectFreeCashFlow,comfarCashFlows[0])
assert.equal(hrcrAnnualAggregation[2].taxRatePercent,5)
assert.equal(hrcrAnnualAggregation[0].equityContribution,8905157.3)
assert.ok(Math.abs(hrcrAnnualAggregation[2].netDebtFinancingFlow+964925.632872)<0.01)
assert.equal(hrcrAnnualAggregation[2].equityContribution,3309144.53)
assert.equal(comfarReference.loanRepaymentAudit.annualPrincipalRepaymentsByYear.length,5)
assert.equal(comfarReference.loanRepaymentAudit.annualInterestByYear.length,5)
assert.ok(Math.abs(comfarReference.loanRepaymentAudit.annualInterestByYear[0]-comfarReference.loanRepaymentAudit.firstOperatingYearInterest)<0.01)
assert.equal(comfarReference.loanRepaymentAudit.annualDebtServiceByYear.length,5)
assert.ok(comfarReference.loanRepaymentAudit.annualDebtServiceByYear.every((service,index)=>
  Math.abs(service-comfarReference.loanRepaymentAudit.annualInterestByYear[index]-comfarReference.loanRepaymentAudit.annualPrincipalRepaymentsByYear[index])<0.01),
  'Annual debt service must equal reconstructed cash interest plus the OPEX-reconciled principal in all five repayment years')
assert.ok(Math.abs(comfarReference.loanRepaymentAudit.annualPrincipalRepaymentsByYear.reduce((sum,value)=>sum+value,0)-comfarReference.loanRepaymentAudit.openingRepaymentBalance)<0.1,
  'Five annual principal repayments must amortize the reconstructed gross opening debt balance')
const capexLoanAlternative=comfarReference.firstOperatingYearWorkingCapitalFunding.capexWorkbookAlternativeLoanSchedule
assert.equal(capexLoanAlternative.installmentCount,20)
assert.ok(Math.abs(capexLoanAlternative.quarterlyPayments.reduce((sum,value)=>sum+value,0)-capexLoanAlternative.aggregateQuarterlyPayment)<0.01)
assert.ok(Math.abs(capexLoanAlternative.aggregateQuarterlyPayment-840992.2672863001)>20000,
  'The CAPEX workbook three-loan financing alternative must remain distinct from the COMFAR 28% annuity baseline')
assert.ok(Math.abs(capexLoanAlternative.workingCapitalLoanTotalDebtService-capexLoanAlternative.quarterlyPayments[2]*20)<0.01)
assert.ok(projectReportSource.includes('row.taxRatePercent-referenceTax')
  && projectReportSource.includes('row.depreciation-referenceDepreciation')
  && projectReportSource.includes('row.changeInWorkingCapital-referenceWorkingCapital')
  && projectReportSource.includes('annualInterestByYear')
  && projectReportSource.includes('annualPrincipalRepaymentsByYear'),
  'The 17-year HRCR200 reconciliation must expose tax, depreciation, working-capital, interest and principal variances')
assert.equal(hrcrAnnualAggregation[16].projectFreeCashFlow,comfarCashFlows[16])
const comfarIrr = engine.calculatePeriodicIrr(comfarCashFlows, comfarAnnualPeriods, 365, 'period-end')
assert.ok(comfarIrr !== null && Math.abs(comfarIrr - comfarReference.projectIrrPercent) < 0.01,
  'COMFAR HRCR200 project IRR must reconcile to 48.31% within displayed precision')
assert.ok(Math.abs(engine.calculatePeriodicNpv([100,100],comfarAnnualPeriods.slice(0,2),25,365,'period-end',comfarAnnualPeriods[1].endDate,'period-count',1)-225) < 1e-8,
  'A cash flow before the valuation date must be compounded forward to the valuation date')
assert.ok(advancedFinanceUi.includes("periodicFinanceResult?.valid ? periodicFinanceResult.loanSchedules[loan.id]")
  && advancedFinanceUi.includes("periodicFinanceResult.rows[i]?.startDate"),
  'Loan repayment detail must display the actual monthly/quarterly schedule and its period dates when the periodic engine is valid')
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

const workingCapitalReleaseWithEquity = engine.calculateIntegratedPeriodicFinance({
  periods: equityWorkingCapitalPeriods,
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [0, 0],
  annualVariableCost: [0, 0],
  annualFixedCost: [0, 0],
  annualDepreciation: [0, 0],
  annualFixedInvestment: [0, 0],
  annualPreOperatingCost: [0, 0],
  annualMaintenanceCapex: [0, 0],
  annualTaxRates: [0, 0],
  annualEquityContributions: [0, 0],
  annualEquityWorkingCapitalContributions: [0, 5],
  workingCapitalByPeriod: [100, 90],
  loans: [],
})
assert.equal(workingCapitalReleaseWithEquity.valid,true)
assert.equal(workingCapitalReleaseWithEquity.rows[1].changeInWorkingCapital,-10)
assert.equal(workingCapitalReleaseWithEquity.rows[1].equityFreeCashFlow,5,
  'Working-capital release must benefit equity cash flow while any new shareholder cash injection is deducted once')
const releaseStatements=engine.buildPeriodicThreeFinancialStatements(workingCapitalReleaseWithEquity)
assert.ok(releaseStatements.every(row=>row.balanceSheet.reconciled),
  'Working-capital releases and additional equity injections must reconcile in the three statements')

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
assert.equal(excessiveEquityWorkingCapitalResult.valid, true,
  'Shareholder funding may exceed the working-capital increase when the excess is retained as a cash buffer')
assert.equal(excessiveEquityWorkingCapitalResult.rows[1].equityFreeCashFlow,-1,
  'The 1-unit excess equity funding must remain in project cash, not be deducted as additional working capital')
const excessiveFundingStatements=engine.buildPeriodicThreeFinancialStatements(excessiveEquityWorkingCapitalResult)
assert.equal(excessiveFundingStatements[1].balanceSheet.cash,101)
assert.ok(excessiveFundingStatements.every(row=>row.balanceSheet.reconciled),
  'Working-capital funding above the requirement must reconcile as a cash buffer in the three statements')



// Effective-dated loan rate resets and separately classified financing fees.
const loanEventPeriods = [
  { index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false },
  { index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false },
]
const resetAndFeeLoan = engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,
  rateChanges:[{effectiveDate:'2025-07-01',annualRatePercent:20}],
  drawdowns:[100,0],
  datedDrawdowns:[{date:'2025-01-01',amount:100}],
  repaymentMethod:'bullet',
  repaymentStartPeriod:2,
  gracePeriods:0,
  termPeriods:1,
  capitalizeInterest:false,
  interestConvention:'actual-365',
  fees:[
    {date:'2025-04-01',amount:10,treatment:'expense',label:'Arrangement fee'},
    {date:'2025-10-01',amount:5,treatment:'capitalize',label:'Capitalized issuance cost'},
  ],
},loanEventPeriods,365)
assert.equal(resetAndFeeLoan.valid,true,resetAndFeeLoan.issues.join('; '))
const expectedNominalResetInterest=100*(10*181/365+20*183/365)/100+5*(20/100)*91/365

assert.ok(Math.abs(resetAndFeeLoan.rows[0].interestExpense-expectedNominalResetInterest)<1e-8,
  'Exact dated drawdowns must preserve end-exclusive Actual/365 accrual, including interest on the capitalized fee from its payment date')
assert.equal(resetAndFeeLoan.rows[0].financingFeeExpense,10,
  'Expense-classified fees must remain separate from accrued interest')
assert.equal(resetAndFeeLoan.rows[0].capitalizedFinancingFees,5,
  'Capitalized issuance costs must be separately visible')
assert.equal(resetAndFeeLoan.rows[0].closingBalance,105,
  'Capitalized financing fees must increase the outstanding loan balance')
assert.ok(Math.abs(resetAndFeeLoan.rows[0].debtService-(resetAndFeeLoan.rows[0].interestExpense+10))<0.01,
  'Cash-paid financing fees must be added once to accrued interest in debt service')
assert.equal(resetAndFeeLoan.rows[1].principal,105,
  'Bullet maturity must repay principal including capitalized financing costs')
const invalidLoanRateOrder = engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,
  rateChanges:[
    {effectiveDate:'2025-08-01',annualRatePercent:15},
    {effectiveDate:'2025-07-01',annualRatePercent:20},
  ],
  drawdowns:[100,0],repaymentMethod:'bullet',repaymentStartPeriod:2,
  gracePeriods:0,termPeriods:1,capitalizeInterest:false,
},loanEventPeriods,365)
assert.equal(invalidLoanRateOrder.valid,false,
  'Rate reset events must be strictly chronological')
const outOfCalendarFinancingFee = engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[100,0],repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  fees:[{date:'2027-01-01',amount:1,treatment:'expense'}],
},loanEventPeriods,365)
assert.equal(outOfCalendarFinancingFee.valid,false,
  'Financing fees outside the modeled calendar must be rejected')


const integratedRateResetAndFees = engine.calculateIntegratedPeriodicFinance({
  periods:loanEventPeriods,
  fiscalYearStartMonth:1,
  dayCountBasis:365,
  cashFlowTiming:'period-end',
  annualRevenue:[0,0],annualVariableCost:[0,0],annualFixedCost:[0,0],
  annualDepreciation:[0,0],annualFixedInvestment:[0,0],annualPreOperatingCost:[0,0],
  annualMaintenanceCapex:[0,0],annualTaxRates:[0,0],annualEquityContributions:[0,0],
  workingCapitalByPeriod:[0,0],
  loans:[{id:'reset-fee-loan',input:{
    annualRatePercent:10,
    rateChanges:[{effectiveDate:'2025-07-01',annualRatePercent:20}],
    drawdowns:[100,0],
    datedDrawdowns:[{date:'2025-01-01',amount:100}],
    repaymentMethod:'bullet',repaymentStartPeriod:2,gracePeriods:0,
    termPeriods:1,capitalizeInterest:false,interestConvention:'actual-365',
    fees:[
      {date:'2025-04-01',amount:10,treatment:'expense'},
      {date:'2025-10-01',amount:5,treatment:'capitalize'},
    ],
  }}],
})
assert.equal(integratedRateResetAndFees.valid,true,integratedRateResetAndFees.warnings.join('; '))
assert.ok(Math.abs(integratedRateResetAndFees.rows[0].interestExpense-integratedRateResetAndFees.loanSchedules['reset-fee-loan'][0].interestExpense-10)<1e-8,
  'Expense financing fees must flow into periodic financing costs and taxable profit')
assert.equal(integratedRateResetAndFees.rows[0].capitalizedFinancingFees,5,
  'Capitalized financing fees must remain distinct from capitalized interest in project results')
assert.equal(integratedRateResetAndFees.rows[0].debtService,integratedRateResetAndFees.loanSchedules['reset-fee-loan'][0].debtService,
  'Debt service must include expense fees exactly once')
const integratedFeeStatements=engine.buildPeriodicThreeFinancialStatements(integratedRateResetAndFees)
assert.ok(integratedFeeStatements.every(row=>row.balanceSheet.reconciled),
  'Capitalized fees must increase deferred pre-operating assets and debt by the same amount')

assert.ok(advancedFinanceUi.includes('rateChanges:loan.rateChanges??[]')
  && advancedFinanceUi.includes('financingFees:(loan.financingFees??[])')
  && advancedFinanceUi.includes('periodInterestConvention')
  && advancedFinanceUi.includes('Rate Effective Date')
  && advancedFinanceUi.includes('Capitalized Fees'),
  'Loan UI must persist, configure and display effective-dated rate resets and financing fee treatments')


// Dated events must preserve the loan's selected rate-conversion convention.
const effectiveAnnualBaseLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[0,0],openingBalance:100,repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  rateConversion:'effective-annual-by-actual-days',
},loanEventPeriods,365)
const effectiveAnnualSameRateResetLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,rateChanges:[{effectiveDate:'2025-07-01',annualRatePercent:10}],
  drawdowns:[0,0],openingBalance:100,repaymentMethod:'bullet',repaymentStartPeriod:2,
  gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  rateConversion:'effective-annual-by-actual-days',
},loanEventPeriods,365)
assert.equal(effectiveAnnualBaseLoan.valid,true,effectiveAnnualBaseLoan.issues.join('; '))
assert.equal(effectiveAnnualSameRateResetLoan.valid,true,effectiveAnnualSameRateResetLoan.issues.join('; '))
assert.ok(Math.abs(effectiveAnnualSameRateResetLoan.rows[0].interestExpense-effectiveAnnualBaseLoan.rows[0].interestExpense)<1e-8,
  'A same-rate reset must not change the effective-annual-by-actual-days result')
const effectiveAnnualChangedRateLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,rateChanges:[{effectiveDate:'2025-07-01',annualRatePercent:20}],
  drawdowns:[0,0],openingBalance:100,repaymentMethod:'bullet',repaymentStartPeriod:2,
  gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  rateConversion:'effective-annual-by-actual-days',
},loanEventPeriods,365)
const expectedEffectiveAnnualResetInterest=100*(Math.pow(1.1,181/365)*Math.pow(1.2,184/365)-1)
assert.ok(Math.abs(effectiveAnnualChangedRateLoan.rows[0].interestExpense-expectedEffectiveAnnualResetInterest)<1e-8,
  'Effective annual rates must compound by segment on the exact reset date')
const feeOnlyEffectiveAnnualLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[0,0],openingBalance:100,repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  rateConversion:'effective-annual-by-actual-days',
  fees:[{date:'2025-07-01',amount:5,treatment:'expense'}],
},loanEventPeriods,365)
assert.equal(feeOnlyEffectiveAnnualLoan.valid,true,feeOnlyEffectiveAnnualLoan.issues.join('; '))
assert.ok(Math.abs(feeOnlyEffectiveAnnualLoan.rows[0].interestExpense-10)<1e-8,
  'Adding an expense-only fee must not switch effective annual interest to simple nominal accrual')
assert.equal(feeOnlyEffectiveAnnualLoan.rows[0].financingFeeExpense,5)

const quarterlyRatePeriods=[
  {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
  {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
  {index:3,startDate:'2025-07-01',endDate:'2025-09-30',days:92,partial:false},
  {index:4,startDate:'2025-10-01',endDate:'2025-12-31',days:92,partial:false},
]
const frequencyDividedResetLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:12,rateChanges:[{effectiveDate:'2025-02-15',annualRatePercent:24}],
  drawdowns:[0,0,0,0],openingBalance:100,repaymentMethod:'bullet',
  repaymentStartPeriod:4,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  rateConversion:'effective-annual-divided-by-frequency',periodsPerYear:4,
},quarterlyRatePeriods,365)
assert.equal(frequencyDividedResetLoan.valid,true,frequencyDividedResetLoan.issues.join('; '))
assert.ok(Math.abs(frequencyDividedResetLoan.rows[0].interestExpense-4.5)<1e-8,
  'Frequency-divided annual rates must prorate the quarterly rate across the two dated reset segments')
assert.ok(Math.abs(frequencyDividedResetLoan.rows[0].periodRatePercent-4.5)<1e-8,
  'Annuity period-rate input must reflect the same intra-period rate reset calculation')

// Undrawn commitment fees, bespoke principal installments and DSCR covenants.
const commitmentFeeLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[100,0],repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  facilityLimit:200,commitmentFeeAnnualRatePercent:2,
},loanEventPeriods,365)
assert.equal(commitmentFeeLoan.valid,true,commitmentFeeLoan.issues.join('; '))
const expectedCommitmentFee=200*0.02*182/365+100*0.02*183/365
assert.ok(Math.abs(commitmentFeeLoan.rows[0].commitmentFeeExpense-expectedCommitmentFee)<1e-8,
  'Undrawn commitment fees must accrue on the time-weighted unused facility balance around staged drawdowns')
assert.equal(commitmentFeeLoan.rows[0].financingFeeExpense,commitmentFeeLoan.rows[0].commitmentFeeExpense,
  'Commitment fees must flow into financing expense exactly once')
assert.ok(Math.abs(commitmentFeeLoan.rows[0].debtService-commitmentFeeLoan.rows[0].interestExpense-commitmentFeeLoan.rows[0].commitmentFeeExpense)<1e-8,
  'Commitment fees must be included in period debt service')
// Capitalized fees consume the total-outstanding facility from their effective date.
const capitalizedFeeCommitmentLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:0,
  drawdowns:[100,0],
  datedDrawdowns:[{date:'2025-01-01',amount:100}],
  repaymentMethod:'bullet',repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,
  capitalizeInterest:false,interestConvention:'actual-365',
  facilityLimit:200,commitmentFeeAnnualRatePercent:2,
  fees:[{date:'2025-04-01',amount:20,treatment:'capitalize'}],
},loanEventPeriods,365)
assert.equal(capitalizedFeeCommitmentLoan.valid,true,capitalizedFeeCommitmentLoan.issues.join('; '))
const expectedFeeAfterCapitalization=100*0.02*90/365+80*0.02*274/365
assert.ok(Math.abs(capitalizedFeeCommitmentLoan.rows[0].commitmentFeeExpense-expectedFeeAfterCapitalization)<1e-8,
  'Capitalized fees must reduce undrawn facility utilization only from their effective date')
assert.equal(capitalizedFeeCommitmentLoan.rows[0].closingBalance,120,
  'A capitalized fee must increase total outstanding debt and facility utilization')

const capitalizedFeeOverLimit=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:0,
  drawdowns:[100,0],
  datedDrawdowns:[{date:'2025-01-01',amount:100}],
  repaymentMethod:'bullet',repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,
  capitalizeInterest:false,interestConvention:'actual-365',
  facilityLimit:110,commitmentFeeAnnualRatePercent:0,
  fees:[{date:'2025-04-01',amount:20,treatment:'capitalize'}],
},loanEventPeriods,365)
assert.equal(capitalizedFeeOverLimit.valid,false,
  'A mid-period capitalized fee that takes total outstanding debt above the facility limit must be rejected')

const capitalizedInterestOverLimit=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[100,0],repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:true,
  facilityLimit:104,
},loanEventPeriods,365)
assert.equal(capitalizedInterestOverLimit.valid,false,
  'Period-end capitalized interest must not silently exceed the total-outstanding facility limit')

// Combined independent oracle: floating rate + staged drawdowns + undrawn fee +
// mid-period capitalized fee + capitalized construction interest + custom/balloon principal.
const combinedLoanInput={
  annualRatePercent:10,
  rateChanges:[{effectiveDate:'2025-07-01',annualRatePercent:20}],
  drawdowns:[100,50,0,0],
  datedDrawdowns:[{date:'2025-01-01',amount:100},{date:'2025-04-01',amount:50}],
  repaymentMethod:'custom',repaymentStartPeriod:3,gracePeriods:0,termPeriods:2,
  capitalizeInterest:true,
  interestConvention:'actual-365',
  facilityLimit:200,commitmentFeeAnnualRatePercent:2,
  fees:[{date:'2025-05-01',amount:5,treatment:'capitalize'}],
  customPrincipalRepayments:[{period:3,amount:20}],
  balloonAtMaturity:true,
}
const combinedLoanOracle=engine.calculatePeriodicLoanSchedule(combinedLoanInput,quarterlyRatePeriods,365)
assert.equal(combinedLoanOracle.valid,true,combinedLoanOracle.issues.join('; '))
const q1Interest=100*0.10*89/365
const q1CommitmentFee=(200-100)*0.02*89/365
const q2Opening=100+q1Interest
const q2Interest=(q2Opening+50)*0.10*30/365+(q2Opening+50+5)*0.10*60/365
const q2CommitmentFee=(200-q2Opening-50)*0.02*30/365+(200-q2Opening-50-5)*0.02*60/365
const q3Opening=q2Opening+50+q2Interest+5
const q3Interest=q3Opening*0.20*91/365
const q3CommitmentFee=(200-q3Opening)*0.02*91/365
const q3Closing=q3Opening-20
const q4Interest=q3Closing*0.20*91/365
const q4CommitmentFee=(200-q3Closing)*0.02*91/365
assert.ok(Math.abs(combinedLoanOracle.rows[0].capitalizedInterest-q1Interest)<1e-8,
  'Q1 capitalized interest must match the independent Actual/365 oracle')
assert.ok(Math.abs(combinedLoanOracle.rows[0].commitmentFeeExpense-q1CommitmentFee)<1e-8,
  'Q1 commitment fee must accrue on the time-weighted undrawn facility')
assert.ok(Math.abs(combinedLoanOracle.rows[1].capitalizedInterest-q2Interest)<1e-8,
  'Q2 floating-rate interest must accrue on staged principal and the capitalized fee from its effective date')
assert.ok(Math.abs(combinedLoanOracle.rows[1].commitmentFeeExpense-q2CommitmentFee)<1e-8,
  'Q2 commitment fee must reduce undrawn facility utilization from the capitalized-fee date')
assert.ok(Math.abs(combinedLoanOracle.rows[2].interestExpense-q3Interest)<1e-8,
  'Q3 interest must apply the reset 20% rate to the opening debt balance')
assert.ok(Math.abs(combinedLoanOracle.rows[2].commitmentFeeExpense-q3CommitmentFee)<1e-8)
assert.equal(combinedLoanOracle.rows[2].principal,20,
  'The custom Q3 principal payment must be applied exactly once')
assert.ok(Math.abs(combinedLoanOracle.rows[3].interestExpense-q4Interest)<1e-8)
assert.ok(Math.abs(combinedLoanOracle.rows[3].commitmentFeeExpense-q4CommitmentFee)<1e-8)
assert.ok(Math.abs(combinedLoanOracle.rows[3].principal-q3Closing)<1e-8,
  'The final balloon must settle all remaining principal and capitalized financing costs')
assert.ok(combinedLoanOracle.rows.every(row=>Math.abs(
  row.closingBalance-(row.openingBalance+row.drawdown+row.capitalizedInterest+row.capitalizedFinancingFees-row.principal)
)<1e-8), 'Every period debt balance must reconcile from opening debt, drawdowns, capitalizations and principal')
assert.ok(Math.abs(combinedLoanOracle.rows[3].closingBalance)<1e-8,
  'The custom schedule and final balloon must leave no residual principal')

const integratedCombinedLoan=engine.calculateIntegratedPeriodicFinance({
  periods:quarterlyRatePeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0],annualVariableCost:[0],annualFixedCost:[0],annualDepreciation:[0],
  annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
  annualTaxRates:[0],annualEquityContributions:[0],workingCapitalByPeriod:[0,0,0,0],
  loans:[{id:'combined-floating-capitalized-custom',input:combinedLoanInput}],
})
assert.equal(integratedCombinedLoan.valid,true,integratedCombinedLoan.warnings.join('; '))
assert.deepEqual(integratedCombinedLoan.loanSchedules['combined-floating-capitalized-custom'],combinedLoanOracle.rows,
  'Integrated project finance must preserve the independently verified combined loan schedule')
const combinedIntegratedSchedule=integratedCombinedLoan.loanSchedules['combined-floating-capitalized-custom']
for(let i=0;i<integratedCombinedLoan.rows.length;i++){
  const projectRow=integratedCombinedLoan.rows[i]
  const loanRow=combinedIntegratedSchedule[i]
  assert.ok(Math.abs(projectRow.cashInterestExpense-loanRow.interestExpense)<1e-8,
    'Integrated reporting must retain contractual cash interest separately from fees')
  assert.ok(Math.abs(projectRow.financingFeeExpense-loanRow.financingFeeExpense)<1e-8,
    'Integrated reporting must expose all expense-classified financing fees')
  assert.ok(Math.abs(projectRow.commitmentFeeExpense-loanRow.commitmentFeeExpense)<1e-8,
    'Integrated reporting must expose the commitment-fee component separately')
  assert.ok(Math.abs(projectRow.interestExpense-projectRow.cashInterestExpense-projectRow.financingFeeExpense)<1e-8,
    'Legacy total financing expense must equal cash interest plus financing fees exactly once')
  assert.ok(Math.abs(projectRow.debtService-loanRow.debtService)<1e-8,
    'Integrated debt service must reconcile to the detailed loan schedule')
}
const integratedCombinedStatements=engine.buildPeriodicThreeFinancialStatements(integratedCombinedLoan)
for(let i=0;i<integratedCombinedStatements.length;i++){
  const statement=integratedCombinedStatements[i].incomeStatement
  const projectRow=integratedCombinedLoan.rows[i]
  assert.equal(statement.cashInterestExpense,projectRow.cashInterestExpense)
  assert.equal(statement.financingFeeExpense,projectRow.financingFeeExpense)
  assert.equal(statement.commitmentFeeExpense,projectRow.commitmentFeeExpense)
  assert.equal(statement.interest,projectRow.interestExpense)
}
assert.ok(integratedCombinedStatements.every(row=>row.balanceSheet.reconciled),
  'Combined floating-rate, capitalized-fee and custom-repayment financing must reconcile all three statements')

const invalidCommitmentFee=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:10,drawdowns:[100,0],repaymentMethod:'bullet',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  commitmentFeeAnnualRatePercent:2,
},loanEventPeriods,365)
assert.equal(invalidCommitmentFee.valid,false,
  'A commitment fee rate without a facility limit must be rejected')
const customBalloonLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:0,drawdowns:[120,0,0,0],repaymentMethod:'custom',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:3,capitalizeInterest:false,
  customPrincipalRepayments:[{period:2,amount:20},{period:3,amount:30}],
  balloonAtMaturity:true,
},quarterlyRatePeriods,365)
assert.equal(customBalloonLoan.valid,true,customBalloonLoan.issues.join('; '))
assert.deepEqual(customBalloonLoan.rows.map(row=>row.principal),[0,20,30,70],
  'Custom interim principal payments must be followed by a final balloon for the residual balance')
const incompleteCustomLoan=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:0,drawdowns:[120,0,0,0],repaymentMethod:'custom',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:3,capitalizeInterest:false,
  customPrincipalRepayments:[{period:2,amount:20},{period:3,amount:30}],
},quarterlyRatePeriods,365)
assert.equal(incompleteCustomLoan.valid,false,
  'A custom schedule that leaves unpaid principal at maturity must be rejected unless balloon repayment is enabled')
const invalidCustomRepayment=engine.calculatePeriodicLoanSchedule({
  annualRatePercent:0,drawdowns:[120,0,0,0],repaymentMethod:'custom',
  repaymentStartPeriod:2,gracePeriods:0,termPeriods:3,capitalizeInterest:false,
  customPrincipalRepayments:[{period:2,amount:200}],balloonAtMaturity:true,
},quarterlyRatePeriods,365)
assert.equal(invalidCustomRepayment.valid,false,
  'Custom principal installments may not exceed the outstanding loan balance')
const dscrCovenantResult=engine.calculateIntegratedPeriodicFinance({
  periods:loanEventPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,0],annualVariableCost:[0,0],annualFixedCost:[0,0],
  annualDepreciation:[0,0],annualFixedInvestment:[0,0],annualPreOperatingCost:[0,0],
  annualMaintenanceCapex:[0,0],annualTaxRates:[0,0],annualEquityContributions:[0,0],
  workingCapitalByPeriod:[0,0],minimumDscr:1.2,
  loans:[{id:'covenant-loan',input:{
    annualRatePercent:10,drawdowns:[100,0],repaymentMethod:'bullet',
    repaymentStartPeriod:2,gracePeriods:0,termPeriods:1,capitalizeInterest:false,
  }}],
})
assert.equal(dscrCovenantResult.valid,true,dscrCovenantResult.warnings.join('; '))
assert.equal(dscrCovenantResult.rows[0].dscrCovenantStatus,'breach')
assert.ok(dscrCovenantResult.warnings.some(message=>message.includes('Minimum DSCR covenant breached in period 1')),
  'A period below the configured minimum DSCR must produce an explicit covenant breach warning')
assert.equal(dscrCovenantResult.rows[1].dscrCovenantStatus,'breach')
assert.ok(dscrCovenantResult.rows.every(row=>row.dscrCovenantStatus==='breach'),
  'Covenant evaluation must be visible at each period with debt service')
assert.ok(advancedFinanceUi.includes('facilityLimit:loan.facilityLimit')
  && advancedFinanceUi.includes('commitmentFeeAnnualRatePercent:loan.commitmentFeeAnnualRatePercent')
  && advancedFinanceUi.includes('Custom Principal Repayment by Period')
  && advancedFinanceUi.includes('minimumDscr:state.minimumDscr')
  && advancedFinanceUi.includes('Minimum Debt Service Coverage Ratio (DSCR)'),
  'Advanced finance UI must expose facility fees, custom/balloon repayments and minimum DSCR covenant controls')

