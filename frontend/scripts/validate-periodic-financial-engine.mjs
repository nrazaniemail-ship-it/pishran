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
assert.ok(fundingCase.warnings.some(message=>message.includes('Funding shortfall')))
const statements=engine.buildPeriodicThreeFinancialStatements(fundingCase)
assert.equal(statements.length,periods.length)
assert.deepEqual(statements.map(row=>Math.round(row.cashFlowStatement.closingCash)),[-50,10,70])
const noGap=engine.calculateIntegratedPeriodicFinance({
  periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
  annualRevenue:[0,100,100],annualVariableCost:[0,30,30],annualFixedCost:[0,10,10],
  annualDepreciation:[0,0,0],annualFixedInvestment:[100,0,0],annualPreOperatingCost:[0,0,0],
  annualMaintenanceCapex:[0,0,0],annualTaxRates:[0,0,0],annualEquityContributions:[100,0,0],
  workingCapitalByPeriod:[0,0,0],openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(noGap.peakFundingGap,0)
assert.ok(!noGap.warnings.some(message=>message.includes('Funding shortfall')))
console.log('PASS: periodic cash roll-forward, funding gaps and three-statement cash reconciliation')
