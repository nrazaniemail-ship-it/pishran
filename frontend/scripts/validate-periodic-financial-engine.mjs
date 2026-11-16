import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

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
  mirrFinanceRatePercent: 10,
  mirrReinvestmentRatePercent: 12,
  salvageValue: 1500,
})
assert.equal(integratedPeriodic.valid, true, 'Integrated period model must accept valid quarterly inputs')
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
assert.ok(integratedPeriodic.rows[0].capitalizedInterest > 0, 'Grace-period interest must be capitalized')
assert.ok(integratedPeriodic.rows[2].principal > 0 && integratedPeriodic.rows[3].closingWorkingCapital === 15)
assert.ok(integratedPeriodic.rows[2].dscr !== null && Number.isFinite(integratedPeriodic.rows[2].dscr))
assert.ok(Math.abs(integratedPeriodic.totalDebtDrawdown - 1800) < 1e-9)
assert.ok(Math.abs(integratedPeriodic.totalEquityContribution - 1200) < 1e-9)
assert.ok(Number.isFinite(integratedPeriodic.npvProject))
assert.ok(Number.isFinite(integratedPeriodic.irrProject), 'Periodic project IRR must use actual period dates')
assert.ok(Number.isFinite(integratedPeriodic.mirrProject), 'Periodic project MIRR must use actual period dates')
assert.ok(Number.isFinite(integratedPeriodic.npvEquity))
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

const advancedFinanceSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const feasibilityWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
const projectReportSource = await readFile(new URL('../src/features/projects/ProjectReportVisuals.tsx', import.meta.url), 'utf8')
const projectFoundationPanelSource = await readFile(new URL('../src/features/projects/ProjectFoundationPanel.tsx', import.meta.url), 'utf8')
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
console.log('PASS: integrated periodic project finance, loan schedules, fiscal-year allocation, leap-year handling, tax-loss roll-forward and dated NPV')
