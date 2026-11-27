import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { calculateComfarPeriodCountIrr, jalaliAnnualPeriods, jalaliToIso, jalaliYearEndDay } from './comfar-jalali-calendar.mjs'

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
const operatingCostByYear = new Map((source.operatingCostSchedule ?? []).map(item => [
  Number(item.period), Math.round(item.rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) * 100) / 100,
]))
const variableShareByYear = new Map((source.variableCostSharePercentByPeriod ?? []).map(item => [
  Number(item.period), Number(item.percent),
]))
const variableCost = years.map(year => {
  const amount = operatingCostByYear.get(year) ?? 0
  const share = variableShareByYear.get(year) ?? source.variableCostSharePercent
  return amount * share / 100
})
const fixedCost = years.map(year => {
  const amount = operatingCostByYear.get(year) ?? 0
  const share = variableShareByYear.get(year) ?? source.variableCostSharePercent
  return amount - amount * share / 100
})
assert.ok(source.operatingCostSchedule?.length, 'COMFAR year-by-year operating-cost schedule is required')
assert.deepEqual([...operatingCostByYear.keys()], years.filter(year => year >= source.operatingCostYear),
  'Every operating year must have an explicit COMFAR operating-cost schedule')
const cents = value => Math.round(Number(value) * 100)
const isWithinOneCent = (actual, expected) => Math.abs(cents(actual) - cents(expected)) <= 1
// Reproducible precision regression: binary floating-point may represent a one-cent
// difference as 0.0100001; compare integer cents, while rejecting a two-cent variance.
assert.equal(isWithinOneCent(644811850.31, 644811850.32), true,
  'A one-cent COMFAR schedule variance must be accepted after cent normalization')
assert.equal(isWithinOneCent(644811850.30, 644811850.32), false,
  'A two-cent COMFAR schedule variance must remain a regression failure')
const expectedOperatingCosts = [
  466658073.29, 522649260.36, 583730555.34, 644811850.32,
  ...Array.from({ length: 11 }, () => 643963499),
]
const productionYears = years.filter(year => year >= source.operatingCostYear)
const actualOperatingCosts = productionYears.map(year => operatingCostByYear.get(year))
assert.equal(actualOperatingCosts.length, expectedOperatingCosts.length,
  'COMFAR annual operating-cost schedule must contain every reference production year')
for (let index = 0; index < expectedOperatingCosts.length; index++) {
  const differenceInCents = cents(actualOperatingCosts[index]) - cents(expectedOperatingCosts[index])
  assert.ok(Math.abs(differenceInCents) <= 1,
    'Annual operating costs must match COMFAR annual cost-of-products schedules, pages 24–26; ' +
    productionYears[index] +
    ': actual=' + actualOperatingCosts[index] +
    ', expected=' + expectedOperatingCosts[index] +
    ', differenceInCents=' + differenceInCents)
}
const depreciation = years.map(year => byYear(source.depreciationSchedule, year, 'totalDepreciation'))
const taxes = years.map(year => byYear(source.taxAmountSchedule, year))
const equity = years.map(year => byYear(source.equityContributionSchedule, year))
const workingCapital = years.map(year => {
  const row = source.workingCapital.find(item => Number(item.period) === year)
  return row ? row.inventory + row.cash : 0
})
const financingByType = new Map()
for (const item of source.financingSchedule ?? []) {
  const type = item.loanType ?? 'long-term'
  if (!financingByType.has(type)) financingByType.set(type, [])
  financingByType.get(type).push(item)
}
assert.ok(financingByType.size > 0, 'COMFAR financing schedule is required')
const loans = [...financingByType.entries()].map(([type, entries]) => {
  const byPeriod = new Map(entries.map(item => [Number(item.period), item]))
  let priorClosing = 0
  const rows = years.map((year, index) => {
    const item = byPeriod.get(year)
    const openingBalance = priorClosing
    const drawdown = item?.loanDisbursement ?? 0
    const principal = item?.principalRepayment ?? 0
    const interestExpense = item?.interestExpense ?? 0
    const capitalizedInterest = item?.capitalizedInterest ?? 0
    // COMFAR reports interest payable separately from outstanding loan principal.
    const closingBalance = item?.closingDebt ?? priorClosing + drawdown - principal
    const debtService = principal + interestExpense
    const periodRatePercent = openingBalance > 0
      ? interestExpense / openingBalance * 100
      : 0
    priorClosing = closingBalance
    return {
      period: index + 1, drawdown, openingBalance, periodRatePercent,
      interestExpense, capitalizedInterest, financingFeeExpense: 0,
      commitmentFeeExpense: 0, capitalizedFinancingFees: 0,
      principal, closingBalance, debtService,
    }
  })
  for (let index = 0; index < rows.length; index++) {
    assert.ok(Math.abs(rows[index].closingBalance -
      (rows[index].openingBalance + rows[index].drawdown - rows[index].principal)) <= 0.02,
    type + ' debt roll-forward must reconcile in ' + years[index])
  }
  return {
    id: 'comfar-' + type,
    input: {
      annualRatePercent: 0, drawdowns: years.map(() => 0),
      repaymentMethod: 'custom', repaymentStartPeriod: 1, gracePeriods: 0,
      termPeriods: years.length, capitalizeInterest: false,
    },
    rows,
  }
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
const inventoryChangeByPeriod = years.map(year => {
  const schedule = source.productionSalesSchedule.find(item => Number(item.period) === year)
  return schedule ? opexSourceModel.variableCost * (Number(schedule.production) - Number(schedule.sales)) / opexSourceModel.capacity : 0
})
const result = engine.calculateIntegratedPeriodicFinance({
  periods,
  fiscalYearStartMonth: 3,
  constructionPeriodCount: 4,
  dayCountBasis: 365,
  cashFlowTiming: 'period-end',
  annualRevenue: revenue,
  annualVariableCost: variableCost,
  annualFixedCost: fixedCost,
  periodInventoryChange: inventoryChangeByPeriod,
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
  loans: loans.map(({ id, input }) => ({ id, input })),
  loanScheduleOverrides: Object.fromEntries(loans.map(({ id, rows }) => [id, rows])),
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
  const expectedLoans = loans.reduce((sum, loan) => {
    const row = loan.rows[index]
    return {
      drawdown: sum.drawdown + row.drawdown,
      principal: sum.principal + row.principal,
      interest: sum.interest + row.interestExpense,
      capitalizedInterest: sum.capitalizedInterest + row.capitalizedInterest,
      closing: sum.closing + row.closingBalance,
    }
  }, { drawdown: 0, principal: 0, interest: 0, capitalizedInterest: 0, closing: 0 })
  assert.ok(Math.abs(result.rows[index].debtDrawdown - expectedLoans.drawdown) <= 0.01,
    'Loan drawdown did not reach engine row for ' + years[index])
  assert.ok(Math.abs(result.rows[index].principal - expectedLoans.principal) <= 0.01,
    'Loan principal repayment did not reach engine row for ' + years[index])
  assert.ok(Math.abs(result.rows[index].cashInterestExpense - expectedLoans.interest) <= 0.01,
    'Loan interest did not reach engine row for ' + years[index])
  assert.ok(Math.abs(result.rows[index].capitalizedInterest - expectedLoans.capitalizedInterest) <= 0.01,
    'Capitalized loan interest did not reach engine row for ' + years[index])
}

// Production cost, inventory movement and cost of goods sold are distinct ledger measures.
for (const year of [1405, 1406, 1407, 1408]) {
  const index = years.indexOf(year), row = result.rows[index]
  const productionCost = operatingCostByYear.get(year)
  const expectedCogs = summaryOperatingCostsByYear.get(year)
  assert.ok(Math.abs(row.productionCost - productionCost) <= 0.02, 'Production cost must match detailed COMFAR schedule for ' + year)
  assert.ok(Math.abs(row.inventoryChange - inventoryChangeByPeriod[index]) <= 0.01, 'Inventory change must be explicit for ' + year)
  assert.ok(Math.abs(row.costOfGoodsSold - expectedCogs) <= 1, 'COGS must match COMFAR financial-planning OPEX for ' + year)
  assert.ok(Math.abs(row.productionCost - row.inventoryChange - row.costOfGoodsSold) <= 0.01, 'Production cost less inventory build must equal COGS for ' + year)
}
const fourYearProductionCost = [1405,1406,1407,1408].reduce((sum,year)=>sum+result.rows[years.indexOf(year)].productionCost,0)
const fourYearInventoryBuild = [1405,1406,1407,1408].reduce((sum,year)=>sum+result.rows[years.indexOf(year)].inventoryChange,0)
const fourYearCogs = [1405,1406,1407,1408].reduce((sum,year)=>sum+result.rows[years.indexOf(year)].costOfGoodsSold,0)
assert.ok(Math.abs(fourYearProductionCost-fourYearInventoryBuild-fourYearCogs)<=0.02,'Four-year cumulative OPEX bridge must reconcile')
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

// COMFAR's total-capital-invested cash-flow schedule uses the documented corporate tax
// actually paid in the financial plan. When a source tax override is supplied, project
// cash flow must use that same tax rather than recomputing an unlevered tax shield.
for (let index = 0; index < result.rows.length; index++) {
  const row = result.rows[index]
  const expectedProjectCashFlow = row.ebit + row.shortTermDepositInterest -
    row.assetSaleOtherIncomeLoss - row.salvageGainLoss - row.tax + row.depreciation -
    row.fixedInvestment - row.preOperatingCost - row.maintenanceCapex -
    row.changeInWorkingCapital + row.assetSaleProceeds + row.salvageValue
  assert.ok(Math.abs(row.projectFreeCashFlow - expectedProjectCashFlow) <= 0.01,
    'COMFAR project cash flow must use documented tax for ' + years[index])
}
const firstYearDetailedOperatingCost = operatingCostByYear.get(1405)
const firstYearFinancialPlanningOperatingCost = 460719614.06
const firstYearOperatingCostSourceDifference = cents(firstYearDetailedOperatingCost) -
  cents(firstYearFinancialPlanningOperatingCost)
assert.equal(firstYearDetailedOperatingCost, 466658073.29,
  'Detailed product-cost schedule page 24 must retain its reported 1405 total')
assert.equal(firstYearFinancialPlanningOperatingCost, 460719614.06,
  'Financial-planning and summary schedules pages 1–2 and 58 must retain their reported 1405 total')
assert.equal(firstYearOperatingCostSourceDifference, 593845923,
  'The 1405 COMFAR source discrepancy must remain explicit and must not be silently reconciled')
const referenceNpv = 19964251.38
const referenceIrr = 26.08

// Keep the detailed product-cost schedule and the financial-planning/cash-flow
// summary as separate source series. The report itself contains a source conflict;
// do not overwrite either series to force a match.
const summaryOperatingCostsByYear = new Map([
  [1405, 460719614.06],
  [1406, 521800909.04],
  [1407, 582882204.02],
  [1408, 643963499.00],
])
// Source OPEX workbook: "OPEX.xlsx", sheets "سر به سری" and "هزینه‌های جاری سالیانه".
// Variable/fixed classification excludes depreciation because this reconciliation is
// strictly for operating expenditure (cash OPEX), not total product cost.
const opexSourceModel = {
  capacity: 1200000,
  variableCost: 610812950.12,
  fixedCost: 33150549.28,
  items: [
    { name: 'مواد خام', annualCost: 537485060, variableShare: 1 },
    { name: 'انرژی', annualCost: 69530818.4, variableShare: 0.8 },
    { name: 'تعمیرات و نگهداری', annualCost: 17977288, variableShare: 0.8 },
    { name: 'دستمزد', annualCost: 10272936, variableShare: 0 },
    { name: 'هزینه‌های بالاسری دستمزد', annualCost: 2054587, variableShare: 0 },
    { name: 'سربار کارخانه', annualCost: 6642810, variableShare: 0.5 },
  ],
}
assert.ok(Math.abs(opexSourceModel.items.reduce((sum, item) =>
  sum + item.annualCost * item.variableShare, 0) - opexSourceModel.variableCost) <= 0.5,
  'OPEX workbook variable-cost split must reconcile to the source model')
assert.ok(Math.abs(opexSourceModel.items.reduce((sum, item) =>
  sum + item.annualCost * (1 - item.variableShare), 0) - opexSourceModel.fixedCost) <= 0.5,
  'OPEX workbook fixed-cost split must reconcile to the source model')

const opexProductionVsSalesReconciliation = [1405, 1406, 1407, 1408].map(year => {
  const detail = source.operatingCostSchedule.find(item => Number(item.period) === year)
  const detailedTotal = operatingCostByYear.get(year)
  const summaryTotal = summaryOperatingCostsByYear.get(year)
  const sales = source.productionSalesSchedule.find(item => Number(item.period) === year)
  assert.ok(detail && sales, 'COMFAR detailed OPEX and steel-slab production/sales rows must exist for ' + year)
  const salesUtilization = Number(sales.sales) / opexSourceModel.capacity
  const productionUtilization = Number(sales.production) / opexSourceModel.capacity
  const expectedSummaryFromSales = opexSourceModel.fixedCost +
    opexSourceModel.variableCost * salesUtilization
  const expectedDetailFromProduction = opexSourceModel.items.reduce((sum, item) =>
    sum + item.annualCost * (1 - item.variableShare + item.variableShare * productionUtilization), 0)
  const expectedInventoryBuildCost = opexSourceModel.variableCost *
    (Number(sales.production) - Number(sales.sales)) / opexSourceModel.capacity
  const itemReconciliation = opexSourceModel.items.map(item => {
    const actual = detail.rows.find(row => row.name === item.name)
    assert.ok(actual, 'Detailed COMFAR OPEX row must exist for ' + item.name + ' in ' + year)
    const expected = item.annualCost *
      (1 - item.variableShare + item.variableShare * productionUtilization)
    assert.ok(Math.abs(Number(actual.amount) - expected) <= 2,
      'Detailed OPEX row must follow production-volume variable/fixed scaling for ' + item.name + ' in ' + year)
    return {
      item: item.name,
      actualDetailed: Number(actual.amount),
      expectedFromProductionVolume: expected,
      difference: Number(actual.amount) - expected,
    }
  })
  assert.ok(Math.abs(summaryTotal - expectedSummaryFromSales) <= 1,
    'Summary/cash-flow OPEX must follow sales utilization and the OPEX workbook fixed/variable split in ' + year)
  assert.ok(Math.abs(detailedTotal - expectedDetailFromProduction) <= 3,
    'Detailed OPEX must follow production utilization and the OPEX workbook fixed/variable split in ' + year)
  assert.ok(Math.abs((detailedTotal - summaryTotal) - expectedInventoryBuildCost) <= 3,
    'Detailed-vs-summary OPEX difference must be explained by variable cost of production retained in closing inventory in ' + year)
  return {
    year,
    steelSlabProduction: Number(sales.production),
    steelSlabSales: Number(sales.sales),
    closingInventory: Number(sales.closingInventory),
    salesUtilization,
    productionUtilization,
    detailedTotal,
    summaryTotal,
    expectedSummaryFromSales,
    expectedDetailFromProduction,
    expectedInventoryBuildCost,
    observedDetailedMinusSummary: detailedTotal - summaryTotal,
    itemReconciliation,
  }
})
const operatingCostReconciliationByYear = [1405, 1406, 1407, 1408].map(year => {
  const detail = source.operatingCostSchedule.find(item => Number(item.period) === year)
  const detailedTotal = operatingCostByYear.get(year)
  const summaryTotal = summaryOperatingCostsByYear.get(year)
  const itemTotal = detail.rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  assert.ok(Math.abs(itemTotal - detailedTotal) <= 0.01,
    'Detailed OPEX item rows must reconcile to the imported detail total for ' + year)
  return {
    year,
    detailedItems: detail.rows.map(row => ({ name: row.name, amount: row.amount })),
    detailedTotal,
    financialPlanningAndCashFlowSummaryTotal: summaryTotal,
    detailedMinusSummary: detailedTotal - summaryTotal,
  }
})
const summaryAdjustedProjectCashFlows = result.rows.map((row, index) => {
  const year = years[index]
  const summaryTotal = summaryOperatingCostsByYear.get(year)
  return summaryTotal == null
    ? row.projectFreeCashFlow
    : row.projectFreeCashFlow + operatingCostByYear.get(year) - summaryTotal
})
const discountedOpexSourceDifference = operatingCostReconciliationByYear.reduce((sum, row) =>
  sum + row.detailedMinusSummary / Math.pow(1.25, row.year - 1401), 0)
const npvGapExplainedByOpexSourceConflict = referenceNpv - result.npvProject
assert.ok(Math.abs(discountedOpexSourceDifference - npvGapExplainedByOpexSourceConflict) <= 0.02,
  'Discounted detailed-vs-summary OPEX differences must reproduce the reported COMFAR NPV gap without changing source values')
const summaryAdjustedIrrPercent = engine.calculatePeriodicIrr(
  summaryAdjustedProjectCashFlows, periods, 365, 'period-end')
const summaryAdjustedComfarPeriodCountIrrPercent =
  calculateComfarPeriodCountIrr(summaryAdjustedProjectCashFlows)
assert.ok(Number.isFinite(summaryAdjustedIrrPercent),
  'The summary-adjusted Pishran actual-day IRR must remain finite')
assert.equal(summaryAdjustedComfarPeriodCountIrrPercent.toFixed(2), referenceIrr.toFixed(2),
  'COMFAR period-count IRR on the cash-flow-summary OPEX series must reproduce the published 26.08% IRR to two decimals')
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
  operatingCostPeriods: operatingCostByYear.size,
  operatingCostFirstYearDetailedSchedule: operatingCostByYear.get(1405),
  operatingCostFirstYearSummaryReference: 460719614.06,
  operatingCostFirstYearSourceDifference: operatingCostByYear.get(1405) - 460719614.06,
  operatingCostReconciliationByYear,
  opexSourceModel,
  opexProductionVsSalesReconciliation,
  discountedOpexSourceDifference,
  npvGapExplainedByOpexSourceConflict,
  summaryAdjustedIrrPercent,
  summaryAdjustedComfarPeriodCountIrrPercent,
  operatingCostSourceDiscrepancyStatus: 'explained-volume-basis-difference; detailed OPEX scales variable cost with production including closing inventory, summary/cash-flow OPEX scales with sales utilization; source amounts retained unchanged',
  annualCashFlowTrace: result.rows.map((row, index) => ({
    year: years[index],
    periodStart: row.startDate,
    periodEnd: row.endDate,
    revenue: row.revenue,
    variableCost: row.variableCost,
    fixedCost: row.fixedCost,
    productionCost: row.productionCost,
    inventoryChange: row.inventoryChange,
    costOfGoodsSold: row.costOfGoodsSold,
    ebit: row.ebit,
    depreciation: row.depreciation,
    documentedTax: row.tax,
    unleveredTax: row.unleveredTax,
    workingCapitalChange: row.changeInWorkingCapital,
    fixedInvestment: row.fixedInvestment,
    preOperatingCost: row.preOperatingCost,
    maintenanceCapex: row.maintenanceCapex,
    assetSaleProceeds: row.assetSaleProceeds,
    salvageValue: row.salvageValue,
    projectFreeCashFlow: row.projectFreeCashFlow,
    discountExponent: index,
    discountedProjectCashFlow: row.projectFreeCashFlow / Math.pow(1.25, index),
    loanInterest: row.cashInterestExpense,
    principal: row.principal,
    debtDrawdown: row.debtDrawdown,
    equityContribution: row.equityContribution,
  })),
  variableCostShareByYear: [...variableShareByYear.entries()],
  loanFacilities: loans.map(loan => ({ id: loan.id, drawdown: loan.rows.reduce((sum, row) => sum + row.drawdown, 0), principal: loan.rows.reduce((sum, row) => sum + row.principal, 0), interest: loan.rows.reduce((sum, row) => sum + row.interestExpense, 0), capitalizedInterest: loan.rows.reduce((sum, row) => sum + row.capitalizedInterest, 0), closingDebt: loan.rows.at(-1).closingBalance })),
}, null, 2))
