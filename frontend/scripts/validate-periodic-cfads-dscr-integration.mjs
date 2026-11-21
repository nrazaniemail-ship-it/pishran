import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-12-31', days: 365, partial: false },
  { index: 2, startDate: '2026-01-01', endDate: '2026-12-31', days: 365, partial: false },
  { index: 3, startDate: '2027-01-01', endDate: '2027-12-31', days: 365, partial: false },
]
const loan = {
  id: 'dscr-test-facility',
  input: {
    annualRatePercent: 10,
    drawdowns: [500, 0, 0],
    repaymentMethod: 'equal-principal',
    repaymentStartPeriod: 2,
    gracePeriods: 0,
    termPeriods: 2,
    capitalizeInterest: false,
    rateConversion: 'effective-annual-by-actual-days',
    periodsPerYear: 1,
  },
}
const input = {
  periods,
  fiscalYearStartMonth: 1,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: [0, 1000, 1000],
  annualVariableCost: [0, 200, 200],
  annualFixedCost: [0, 100, 100],
  annualDepreciation: [0, 0, 0],
  annualFixedInvestment: [1000, 0, 0],
  annualPreOperatingCost: [0, 0, 0],
  annualMaintenanceCapex: [0, 0, 0],
  annualTaxRates: [0, 0, 0],
  annualEquityContributions: [500, 0, 0],
  workingCapitalByPeriod: [0, 100, 50],
  openingCash: 0,
  loans: [loan],
  minimumDscr: 2.5,
  discountRatePercent: 10,
}
const result = engine.calculateIntegratedPeriodicFinance(input)
assert.equal(result.valid, true, result.warnings.join('; '))
assert.equal(result.rows.length, 3)

const firstOperating = result.rows[1]
const secondOperating = result.rows[2]
assert.ok(Math.abs(firstOperating.cfads - 600) < 0.01,
  'CFADS must deduct the 100 working-capital build from operating cash flow')
assert.ok(Math.abs(secondOperating.cfads - 750) < 0.01,
  'Working-capital release must increase CFADS in the next period')

for (const row of result.rows.slice(1)) {
  assert.ok(row.debtService > 0, 'Debt service must include contractual interest and principal')
  assert.ok(Math.abs(row.debtService - row.interestExpense - row.principal) < 0.01,
    'Debt service must reconcile to interest plus principal')
  assert.ok(row.dscr !== null && Math.abs(row.dscr - row.cfads / row.debtService) < 1e-9,
    'DSCR must equal CFADS divided by total debt service')
}
assert.equal(firstOperating.dscrCovenantStatus, 'breach',
  'The first operating year must breach the 2.50x covenant')
assert.equal(secondOperating.dscrCovenantStatus, 'pass',
  'The second operating year must pass the 2.50x covenant')
assert.ok(result.warnings.some(warning => warning.includes('Minimum DSCR covenant breached in period 2')))

const schedule = result.loanSchedules['dscr-test-facility']
assert.equal(schedule.length, 3)
assert.ok(Math.abs(schedule[1].principal - 250) < 0.01)
assert.ok(Math.abs(schedule[2].principal - 250) < 0.01)
assert.ok(Math.abs(schedule[2].closingBalance) < 0.01)

console.log('Periodic CFADS, debt service, DSCR covenant and working-capital release validation passed.')

// Negative net working capital is a funding source while it grows, but its
// settlement is a cash outflow. Verify the signed movement reaches CFADS.
const negativeWorkingCapitalInput = {
  ...input,
  annualRevenue: [0, 100, 100],
  annualVariableCost: [0, 20, 20],
  annualFixedCost: [0, 0, 0],
  annualFixedInvestment: [0, 0, 0],
  annualEquityContributions: [0, 0, 0],
  workingCapitalByPeriod: [-30, -40, 0],
  openingWorkingCapital: -10,
  loans: [],
}
const negativeWorkingCapitalResult = engine.calculateIntegratedPeriodicFinance(negativeWorkingCapitalInput)
assert.equal(negativeWorkingCapitalResult.valid, true, negativeWorkingCapitalResult.warnings.join('; '))
assert.ok(Math.abs(negativeWorkingCapitalResult.rows[0].cfads - 20) < 0.01,
  'Period 1 has no revenue and releases 20 through the increase in negative net working capital')
assert.ok(Math.abs(negativeWorkingCapitalResult.rows[1].cfads - 110) < 0.01,
  'Period 2 operating cash flow must include the 10 release from further negative working capital')
assert.ok(Math.abs(negativeWorkingCapitalResult.rows[2].cfads - 60) < 0.01,
  'Settling 40 of negative net working capital must reduce terminal CFADS by 40')
