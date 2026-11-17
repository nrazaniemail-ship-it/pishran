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

const inventoryPeriods=[periods[0]]
const inventoryFinance=engine.calculateIntegratedPeriodicFinance({
 periods:inventoryPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[1000],annualVariableCost:[100],annualFixedCost:[100],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
 annualCostOfGoodsSold:[200],annualTaxRates:[25],annualEquityContributions:[0],
 workingCapitalByPeriod:[50],finishedGoodsInventoryValueByPeriod:[30],openingWorkingCapital:60,
 loans:[],discountRatePercent:10,
})
assert.equal(inventoryFinance.valid,true,inventoryFinance.warnings.join('; '))
assert.equal(inventoryFinance.rows[0].costOfGoodsSold,200)
assert.equal(inventoryFinance.rows[0].ebit,600)
assert.equal(inventoryFinance.rows[0].closingWorkingCapital,80)
assert.equal(inventoryFinance.rows[0].changeInWorkingCapital,20)
assert.equal(inventoryFinance.rows[0].cfads,430)
const inventoryStatements=engine.buildPeriodicThreeFinancialStatements(inventoryFinance,{
 cash:100,debt:0,netFixedAssets:0,netWorkingCapital:60,deferredPreOperatingAssets:0,paidInCapital:160,retainedEarnings:0,
})
assert.equal(inventoryStatements.length,inventoryPeriods.length)
assert.equal(inventoryStatements[0].incomeStatement.costOfGoodsSold,200)
assert.equal(inventoryStatements[0].incomeStatement.cashOperatingCosts,400)
assert.equal(inventoryStatements[0].balanceSheet.netWorkingCapital,80)
assert.equal(inventoryStatements[0].balanceSheet.reconciled,true)
const invalidInventoryCost=engine.calculateIntegratedPeriodicFinance({
 periods:inventoryPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[1000],annualVariableCost:[100],annualFixedCost:[100],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
 annualCostOfGoodsSold:[-1],annualTaxRates:[25],annualEquityContributions:[0],
 workingCapitalByPeriod:[50],loans:[],
})
assert.equal(invalidInventoryCost.valid,false,'Negative cost of goods sold must be rejected')
const invalidInventoryValue=engine.calculateIntegratedPeriodicFinance({
 periods:inventoryPeriods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[1000],annualVariableCost:[100],annualFixedCost:[100],annualDepreciation:[0],
 annualFixedInvestment:[0],annualPreOperatingCost:[0],annualMaintenanceCapex:[0],
 annualTaxRates:[25],annualEquityContributions:[0],workingCapitalByPeriod:[50],
 finishedGoodsInventoryValueByPeriod:[10,20],loans:[],
})
assert.equal(invalidInventoryValue.valid,false,'Finished-goods inventory value must cover each project period')
console.log('PASS: finished-goods COGS, closing inventory and three-statement working-capital posting reconcile')
