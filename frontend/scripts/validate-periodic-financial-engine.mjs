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
console.log('PASS: generic periodic loan schedule validates drawdowns, amortization and maturity balance')

const comfarTaxBrackets = [
  { lowerLimit: 0, upperLimit: 1200, ratePercent: 15 },
  { lowerLimit: 1200, upperLimit: 2000, ratePercent: 25 },
  { lowerLimit: 2000, upperLimit: 5000, ratePercent: 40 },
  { lowerLimit: 5000, upperLimit: 10000, ratePercent: 60 },
  { lowerLimit: 10000, upperLimit: null, ratePercent: 75 },
]
const graduatedTax = engine.calculateGraduatedPeriodTax(7500, 0, comfarTaxBrackets)
assert.equal(graduatedTax.taxableProfitAfterLoss, 7500)
assert.equal(graduatedTax.tax, 3080, 'COMFAR Reference Manual Table 22 must calculate tax of 3,080 on taxable income of 7,500')
const lossOffsetTax = engine.calculateGraduatedPeriodTax(7500, 1000, comfarTaxBrackets)
assert.equal(lossOffsetTax.taxableProfitAfterLoss, 6500)
assert.equal(lossOffsetTax.tax, 2480, 'Loss carry-forward must reduce taxable income before applying progressive brackets')
const invalidBrackets = engine.calculateGraduatedPeriodTax(7500, 0, [
  { lowerLimit: 0, upperLimit: 1000, ratePercent: 15 },
  { lowerLimit: 1200, upperLimit: null, ratePercent: 25 },
])
assert.equal(Number.isNaN(invalidBrackets.tax), true, 'Gaps in graduated tax brackets must be rejected')
console.log('PASS: COMFAR graduated corporate-tax brackets reproduce Reference Manual Table 22 and validate bracket continuity')

const taxHolidayPeriods = foundation.buildProjectCalendarPeriods('2025-01-01','2026-12-31','annual',1)
const taxHolidayModel = engine.calculateIntegratedPeriodicFinance({
  periods:taxHolidayPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[1000,1000],annualVariableCost:[0,0],annualFixedCost:[0,0],annualDepreciation:[0,0],
  annualFixedInvestment:[0,0],annualPreOperatingCost:[0,0],annualMaintenanceCapex:[0,0],
  annualTaxRates:[25,25],annualEquityContributions:[0,0],workingCapitalByPeriod:[0,0],loans:[],
  taxHolidayYears:1,productionStartFiscalYear:0,
})
assert.equal(taxHolidayModel.valid,true,taxHolidayModel.warnings.join('; '))
assert.equal(taxHolidayModel.rows[0].tax,0,'The first production fiscal year must be tax-exempt during a one-year holiday')
assert.equal(taxHolidayModel.rows[1].tax,250,'Normal corporate tax must resume after the tax holiday')
console.log('PASS: COMFAR production tax holiday suspends tax in the specified first production years')
