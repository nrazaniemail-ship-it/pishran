import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { jalaliAnnualPeriods, jalaliToIso, jalaliYearEndDay } from './comfar-jalali-calendar.mjs'

const compile = async relativePath => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const [sourceModule, engine] = await Promise.all([
  compile('../src/features/projects/comfarProjectInputData.ts'),
  compile('../src/features/steel/periodicFinancialEngine.ts'),
])
const source = sourceModule.COMFAR_PROJECT_INPUTS['comfar-integrated-steel-dri']
assert.ok(source, 'Integrated DRI/steel COMFAR source project must exist')

const years = Array.from({ length: 19 }, (_, index) => 1401 + index)
const byYear = (rows, year, field = 'amount') =>
  (rows ?? []).filter(row => Number(row.period) === year).reduce((sum, row) => sum + Number(row[field] ?? 0), 0)
const fixedInvestment = years.map(year =>
  source.fixedInvestment.reduce((sum, asset) => sum + byYear(asset.periods, year), 0))
const preOperatingCost = years.map(year => byYear(source.preproduction, year, 'net'))
const revenue = years.map(year =>
  byYear(source.productionSalesSchedule, year, 'salesRevenue') +
  byYear(source.byproductSalesSchedule, year, 'salesRevenue'))
const documentedOperatingCost = source.operatingCostRows.reduce((sum, row) => sum + row.amount, 0)
const variableCost = years.map(year => year >= source.operatingCostYear
  ? documentedOperatingCost * source.variableCostSharePercent / 100 : 0)
const fixedCost = years.map(year => year >= source.operatingCostYear
  ? documentedOperatingCost - documentedOperatingCost * source.variableCostSharePercent / 100 : 0)
const depreciation = years.map(year => byYear(source.depreciationSchedule, year, 'totalDepreciation'))
const taxes = years.map(year => byYear(source.taxAmountSchedule, year))
const equity = years.map(year => byYear(source.equityContributionSchedule, year))
const workingCapital = years.map(year => {
  const row = source.workingCapital.find(item => Number(item.period) === year)
  return row ? row.inventory + row.cash : 0
})

assert.deepEqual(equity.slice(0, 4), [
  13094839.16, 22531066.5, 34173260.44, 70183158.9,
], 'COMFAR shareholder contributions 1401–1404 must be read from the imported project')
assert.equal(equity.reduce((sum, value) => sum + value, 0), 139982325,
  'COMFAR shareholder contributions must total EUR 139,982,325')
assert.deepEqual(taxes.slice(0, 4), [0, 0, 0, 0],
  'Construction-period documented tax amounts must remain zero')
assert.deepEqual(depreciation.slice(0, 4), [0, 0, 0, 0],
  'No operating depreciation is documented during construction')

const periods = jalaliAnnualPeriods(1401, 1419, 1)
assert.equal(periods.length, 19, 'Project calendar must contain 19 annual periods')
const result = engine.calculateIntegratedPeriodicFinance({
  periods,
  fiscalYearStartMonth: 3,
  constructionPeriodCount: 4,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: revenue,
  annualVariableCost: variableCost,
  annualFixedCost: fixedCost,
  annualDepreciation: depreciation,
  periodDepreciationSchedule: depreciation,
  annualFixedInvestment: fixedInvestment,
  annualPreOperatingCost: preOperatingCost,
  annualMaintenanceCapex: years.map(() => 0),
  annualTaxRates: years.map(() => 25),
  taxAmountOverridesByPeriod: taxes,
  taxAmountSourceReference: 'COMFAR III Expert, integrated DRI/steel project, pages 2 and 59–61',
  annualEquityContributions: equity,
  workingCapitalByPeriod: workingCapital,
  loans: [],
  discountRatePercent: 25,
  valuationDate: jalaliToIso(1401, 12, jalaliYearEndDay(1401)),
  discountConvention: 'period-count',
  salvageValue: 224704008.39,
})
assert.equal(result.valid, true, 'Imported project schedules must produce a valid integrated financial result: ' + JSON.stringify(result.warnings))
assert.equal(result.rows.length, 19, 'Financial engine must return all 19 project periods')
assert.equal(result.totalEquityContribution, 139982325,
  'Financial engine must consume the imported shareholder funding schedule')
for (let index = 0; index < years.length; index++) {
  assert.ok(Math.abs(result.rows[index].equityContribution - equity[index]) <= 0.01,
    'Equity contribution did not reach engine row for ' + years[index])
  assert.ok(Math.abs(result.rows[index].tax - taxes[index]) <= 0.01,
    'Documented tax did not reach engine row for ' + years[index])
  assert.ok(Math.abs(result.rows[index].depreciation - depreciation[index]) <= 0.01,
    'Depreciation did not reach engine row for ' + years[index])
}

const statements = engine.buildPeriodicThreeFinancialStatements(result)
assert.equal(statements.length, 19, 'Income statement, cash flow and balance sheet must be built for every period')
for (let index = 0; index < statements.length; index++) {
  const statement = statements[index]
  assert.equal(statement.balanceSheet.reconciled, true,
    'Balance sheet must reconcile for ' + years[index] + '; difference=' + statement.balanceSheet.balanceDifference)
  assert.ok(Math.abs(statement.incomeStatement.tax - taxes[index]) <= 0.01,
    'Income statement tax must equal the imported COMFAR tax for ' + years[index])
  assert.ok(Math.abs(statement.cashFlowStatement.closingCash - statement.balanceSheet.cash) <= 0.01,
    'Cash flow closing cash must reconcile to balance sheet cash for ' + years[index])
  assert.ok(Math.abs(statement.movementChecks.cashRollForward) <= 0.01,
    'Cash flow roll-forward must reconcile for ' + years[index])
}

const referenceNpv = 19964251.38
const referenceIrr = 26.08
assert.ok(Number.isFinite(result.npvProject), 'Integrated project NPV must be finite')
assert.ok(Number.isFinite(result.irrProject), 'Integrated project IRR must be finite')
console.log(JSON.stringify({
  project: 'comfar-integrated-steel-dri',
  periods: result.rows.length,
  shareholderEquity: result.totalEquityContribution,
  npv: result.npvProject,
  irrPercent: result.irrProject,
  comfarReferenceNpv: referenceNpv,
  comfarReferenceIrrPercent: referenceIrr,
  npvVariance: result.npvProject - referenceNpv,
  irrVariancePercentagePoints: result.irrProject - referenceIrr,
  reconciledStatements: statements.filter(row => row.balanceSheet.reconciled).length,
  maximumBalanceDifference: Math.max(...statements.map(row => Math.abs(row.balanceSheet.balanceDifference))),
  taxSchedulePeriods: taxes.length,
  depreciationPeriods: depreciation.filter(value => value > 0).length,
}, null, 2))
