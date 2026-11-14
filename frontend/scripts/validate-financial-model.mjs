import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const loadTypeScriptModule = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const near = (actual, expected, tolerance, label) => {
  assert.ok(Number.isFinite(actual), label + ': result is not finite: ' + actual)
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': expected ' + expected + ', got ' + actual + ', delta ' + (actual - expected))
}
const [engine, reference, integratedReference, workbookAudit] = await Promise.all([
  loadTypeScriptModule('../src/features/steel/financialModel.ts'),
  loadTypeScriptModule('../src/features/steel/hotRollingExcelBenchmark.ts'),
  loadTypeScriptModule('../src/features/steel/integratedProjectBenchmark.ts'),
  loadTypeScriptModule('../src/features/steel/workbookReconciliation.ts')
])

const driAudit = workbookAudit.DRI_STEELMAKING_AUDIT
near(driAudit.capexCategories.reduce((sum,row)=>sum+row.amount,0),
  driAudit.capex.fixedInvestment, 0.01, 'DRI CAPEX category roll-up')
near(driAudit.materials.driUnit + driAudit.materials.steelmakingBase
  + driAudit.materials.marineGradeAdditives + driAudit.materials.apiGradeAdditives
  + driAudit.materials.pressureVesselGradeAdditives,
  driAudit.materials.total, 0.01, 'DRI raw-material grade and process roll-up')
near(driAudit.products.slabRevenue + driAudit.products.surplusDriRevenue,
  driAudit.products.totalRevenue, 0.01, 'DRI slab and surplus-DRI sales bridge')
near(driAudit.energy.driElectricityKwhPerT * 1_760_000
  + driAudit.energy.steelmakingElectricityKwhPerT * 1_200_000,
  driAudit.energy.totalElectricityKwh, 0.01, 'DRI and steelmaking electricity consumption')
near(driAudit.energy.driGasNm3PerT * 1_760_000
  + driAudit.energy.steelmakingGasNm3PerT * 1_200_000,
  driAudit.energy.totalGasNm3, 0.01, 'DRI and steelmaking gas consumption')
near(driAudit.capex.fixedInvestment + driAudit.capex.preproductionNet + driAudit.capex.capitalizedInterest,
  driAudit.capex.constructionUses, 0.2, 'DRI construction uses bridge')
near(driAudit.capex.constructionUses + driAudit.workingCapital, driAudit.totalUses, 0.2, 'DRI total uses bridge')
near(driAudit.funding.equity + driAudit.funding.longTermDebt + driAudit.funding.shortTermDebt,
  driAudit.funding.totalSources, 0.01, 'DRI total sources bridge')
near(driAudit.totalUses - driAudit.funding.totalSources, driAudit.funding.fundingGap, 0.01, 'DRI funding gap')
near(driAudit.annualOpex.rawMaterials + driAudit.annualOpex.labor + driAudit.annualOpex.laborOverhead
  + driAudit.annualOpex.maintenance + driAudit.annualOpex.utilities + driAudit.annualOpex.other,
  driAudit.annualOpex.factoryCostExDepreciation, 0.5, 'DRI factory cost excluding depreciation')
near(driAudit.annualOpex.factoryCostExDepreciation + driAudit.annualOpex.depreciationDetailed,
  driAudit.annualOpex.totalIncludingDepreciation, 0.5, 'DRI total cost including detailed depreciation')
near(driAudit.annualOpex.depreciationDetailed - driAudit.comfar.referenceDepreciation,
  6292799.41, 0.02, 'DRI depreciation discrepancy retained as an audit flag')

const rollingAudit = workbookAudit.HOT_ROLLING_200KT_AUDIT
near(rollingAudit.capex.fixedInvestment + rollingAudit.capex.preproductionNet,
  rollingAudit.capex.constructionInvestment, 0.01, 'HRCR200 construction investment')
near(rollingAudit.capex.constructionInvestment + rollingAudit.capex.capitalizedInterest,
  rollingAudit.capex.constructionUsesIncludingInterest, 0.01, 'HRCR200 construction uses including interest')
near(rollingAudit.annualOpex.totalIncludingDepreciation - rollingAudit.annualOpex.depreciation,
  rollingAudit.annualOpex.totalExcludingDepreciation, 0.01, 'HRCR200 OPEX excluding depreciation')
assert.equal(rollingAudit.financingAlternativesInWorkbook.mechanismTabDebtSharePercent, 80,
  'HRCR200 mechanism-tab financing split must remain visible')
assert.equal(rollingAudit.financingAlternativesInWorkbook.fundingSummaryTabEquitySharePercent, 70,
  'HRCR200 alternative financing split must remain visible')
near(rollingAudit.alternativeMetricsInWorkbook.generalSummaryIrrPercent, 48.31, 0.001,
  'HRCR200 general-summary IRR')
near(rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetProjectIrrPercent, 43.378234116396674, 1e-9,
  'HRCR200 IRR-NPV sheet IRR')
assert.ok(Math.abs(rollingAudit.alternativeMetricsInWorkbook.generalSummaryIrrPercent
  - rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetProjectIrrPercent) > 4,
  'Conflicting HRCR200 IRR outputs must remain an explicit audit item')
near(rollingAudit.financingCashflowSchedule.equityContributionsTotal, 16401129.53, 0.01,
  'HRCR200 COMFAR financing schedule equity contributions')
near(rollingAudit.financingCashflowSchedule.longTermLoanGrossDrawdowns,
  rollingAudit.financingCashflowSchedule.longTermLoanPrincipalRepayments, 0.01,
  'HRCR200 long-term loan gross drawdowns and principal repayments')
near(rollingAudit.alternativeMetricsInWorkbook.generalSummaryTotalInvestment
  - rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetTotalInvestment,
  10009707.09412, 0.1, 'HRCR200 investment base discrepancy')
assert.ok(workbookAudit.WORKBOOK_RECONCILIATION_FLAGS.length >= 5,
  'Source conflicts must remain explicit audit flags')
console.log('PASS: source-workbook DRI and HRCR200 CAPEX/OPEX bridges and unresolved financing/depreciation flags')

const model = reference.EXCEL_HOT_ROLLING_200KT
const expected = reference.EXCEL_REFERENCE_EXPECTED
const pishranExpected = reference.PISHRAN_REFERENCE_MODEL_OUTPUT
const workspaceSource = await readFile(new URL('../src/features/steel/ProcessPlantWorkspace.tsx', import.meta.url), 'utf8')
const output = expected.capacity
const currency = model.currency

const integratedComfar19 = [...integratedReference.INTEGRATED_COMFAR_PROJECT_CASH_FLOWS]
const integratedControls = integratedReference.INTEGRATED_COMFAR_REFERENCE
near(engine.calculateNpv(integratedComfar19, 0.25), integratedControls.projectNpvAt25, 0.01, 'Integrated COMFAR 19-period NPV at 25%')
near(engine.calculateIrr(integratedComfar19), integratedControls.projectIrr / 100, 0.0002, 'Integrated COMFAR 19-period IRR')
const funding = integratedReference.calculateComfarFundingGap()
near(funding.uses, integratedControls.totalInvestment, 0.01, 'COMFAR total uses')
near(funding.sources, integratedControls.totalSources, 0.01, 'COMFAR total sources')
near(funding.gap, integratedControls.fundingGap, 0.01, 'COMFAR funding gap')
assert.ok(workspaceSource.includes('INTEGRATED_COMFAR_PROJECT_CASH_FLOWS'), 'Plant reconciliation must use the centralized COMFAR cash-flow reference')
assert.ok(workspaceSource.includes('calculateNpv(comfarActualFlows,comfarDiscountRate)'), 'COMFAR NPV must discount year 1 at period zero like the reference')

const material = engine.calculateOperatingCostRows(model.materialBalance, output, currency)
const consumables = engine.calculateOperatingCostRows(model.processConsumables, output, currency)
const energy = engine.calculateOperatingCostRows(model.utilities, output, currency)
const spares = engine.calculateOperatingCostRows(model.spareParts, output, currency)
const maintenance = engine.calculateOperatingCostRows(model.maintenance, output, currency)
const general = engine.calculateOperatingCostRows(model.opex, output, currency)
const payrollBase = model.staff.reduce((sum, line) => sum + engine.calculatePayrollCost({
  count: line.count,
  monthlySalary: line.monthlySalary,
  monthlyInsurance: line.insurance,
  monthlyOvertime: line.overtime,
  annualBonus: line.bonus,
  annualSeniority: line.seniority
}), 0)
const payrollOverhead = payrollBase * model.staffOverheadRate / 100
const payrollTotal = payrollBase + payrollOverhead

near(material.totalAtFullOutput + consumables.totalAtFullOutput, expected.rawMaterials, 0.01, 'Raw material and consumables')
near(energy.totalAtFullOutput, expected.energy, 0.01, 'Energy')
near(consumables.totalAtFullOutput, expected.processConsumables, 0.01, 'Process consumables')
near(spares.totalAtFullOutput, expected.spareParts, 0.01, 'Spare parts')
near(maintenance.totalAtFullOutput, expected.maintenance, 0.01, 'Maintenance')
near(payrollBase, expected.payrollBase, 0.000001, 'Annual payroll')
near(payrollOverhead, expected.payrollOverhead, 0.000001, 'Payroll overhead')
near(payrollTotal, expected.payrollTotal, 0.000001, 'Payroll total')
near(general.fixedAnnual, expected.factoryOverhead, 0.01, 'Factory overhead')
near(general.variablePerTonne * output, expected.marketing, 0.01, 'Direct marketing')
const opexWithoutDepreciation = material.totalAtFullOutput + consumables.totalAtFullOutput +
  energy.totalAtFullOutput + spares.totalAtFullOutput + maintenance.totalAtFullOutput +
  general.totalAtFullOutput + payrollTotal
near(opexWithoutDepreciation, expected.opexWithoutDepreciation, 1, 'Annual OPEX excluding depreciation')
near(opexWithoutDepreciation + model.annualDepreciationOverride, expected.opexWithDepreciation, 1, 'Annual cost including depreciation')

const departmentTotals = model.staffDepartments.reduce((totals, row) => ({
  expert: totals.expert + row.expert,
  technician: totals.technician + row.technician,
  secretary: totals.secretary + row.secretary,
  operator: totals.operator + row.operator,
  driver: totals.driver + row.driver,
  laborer: totals.laborer + row.laborer
}), { expert: 0, technician: 0, secretary: 0, operator: 0, driver: 0, laborer: 0 })
for (const [key, value] of Object.entries({expert:66,technician:61,secretary:17,operator:71,driver:20,laborer:50})) {
  assert.equal(departmentTotals[key], value, 'Staff matrix total: ' + key)
}

const wacc = engine.calculateWacc({
  equityWeight: model.equity,
  debtWeight: model.debt,
  costOfEquity: model.ke,
  costOfDebt: model.kd,
  taxRate: model.waccTax
})
assert.equal(wacc.valid, true, 'WACC inputs must be valid')
near(wacc.value, expected.wacc, 1e-12, 'WACC')

const factoryRows = model.opex.filter(row => row.costGroup === 'سربار کارخانه')
const factory = engine.calculateOperatingCostRows(factoryRows, output, currency)
const wcProductionBasis = material.totalAtFullOutput + consumables.totalAtFullOutput +
  Math.round(energy.totalAtFullOutput) + spares.totalAtFullOutput + maintenance.totalAtFullOutput +
  Math.round(payrollBase) + Math.round(payrollOverhead) + factory.totalAtFullOutput
const wcCashBasis = maintenance.totalAtFullOutput + Math.round(payrollBase) +
  Math.round(payrollOverhead) + factory.totalAtFullOutput
const wcBases = {
  'wc-raw': material.totalAtFullOutput + consumables.totalAtFullOutput,
  'wc-energy': energy.totalAtFullOutput,
  'wc-spares': spares.totalAtFullOutput,
  'wc-wip': wcProductionBasis,
  'wc-finished': wcProductionBasis,
  'wc-receivable': output * model.products.reduce((sum, product) => sum + product.mix / 100 * product.price, 0),
  'wc-cash': wcCashBasis,
  'wc-foreign-cash': 0,
  'wc-deposit': 0,
  'wc-interest': 0,
  'wc-payables': material.totalAtFullOutput + consumables.totalAtFullOutput
}
const wcItems = model.workingCapitalItems.map(item => ({ ...item, annualBase: item.annualBase > 0 ? item.annualBase : (wcBases[item.id] ?? 0) }))
const workingCapital = engine.calculateWorkingCapital(wcItems, 1, model.workingCapitalDayBasis)
near(workingCapital, expected.workingCapital, 0.02, 'Net working capital with 360-day basis')
const wc365 = engine.calculateWorkingCapital(wcItems, 1, 365)
assert.ok(Math.abs(wc365 - workingCapital) > 1000, '360/365 convention must materially change the benchmark result')

const cashFlows = [...expected.comfarProjectCashFlows]
near(engine.calculateNpv(cashFlows, expected.roundedDiscountRate), expected.npvAtRoundedRate, 0.01, 'NPV at Excel rounded 21%')
near(engine.calculateNpv(cashFlows, expected.wacc), expected.npvAtExactWacc, 0.01, 'NPV at exact WACC')
near(engine.calculateIrr(cashFlows), expected.irr, 1e-8, 'IRR')
near(engine.calculateMirr(cashFlows, expected.financeRate, expected.reinvestmentRate), expected.mirr, 1e-8, 'MIRR')


const totalCapex = model.capex.reduce((sum, row) => sum + row.quantity * row.unitPrice * (row.currency === currency ? 1 : row.fxRate), 0)
const landCost = model.capex.filter(row => row.costGroup === 'زمین').reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
const depreciable = Math.max(0, totalCapex - landCost)
const ramp = model.ramp
let priorProjectLoss = 0
let previousNwc = 0
let accumulatedDepreciation = 0
const generatedProjectCashFlows = []
const weightedPrice = model.products.reduce((sum, product) => sum + product.mix / 100 * product.price, 0)
const fixedShare = model.opexFixedShare / 100
const directFixed = material.fixedAnnual + energy.fixedAnnual + consumables.fixedAnnual +
  spares.fixedAnnual + maintenance.fixedAnnual + payrollTotal
const directVariablePerTonne = material.variablePerTonne + energy.variablePerTonne +
  consumables.variablePerTonne + spares.variablePerTonne + maintenance.variablePerTonne
const capexYears = Math.max(1, Math.floor(model.constructionYears))
for (let index = 0; index < capexYears + model.life; index++) {
  const constructionYear = index < capexYears
  const operatingYear = constructionYear ? 0 : index - capexYears + 1
  const rampFactor = operatingYear > 0 ? (ramp[operatingYear - 1] ?? 100) / 100 : 0
  const output = expected.capacity * rampFactor
  const revenue = output * weightedPrice
  const generalOpex = general.fixedAnnual * (fixedShare + (1 - fixedShare) * rampFactor) +
    general.variablePerTonne * output
  const operatingCost = operatingYear > 0 ? generalOpex + directFixed + directVariablePerTonne * output : 0
  const ebitda = revenue - operatingCost
  const annualDepreciation = model.annualDepreciationOverride > 0
    ? model.annualDepreciationOverride : depreciable / Math.max(1, model.depreciationYears)
  const depreciation = operatingYear > 0 && operatingYear <= model.depreciationYears
    ? Math.min(annualDepreciation, Math.max(0, depreciable - accumulatedDepreciation)) : 0
  accumulatedDepreciation += depreciation
  const nwc = operatingYear > 0 && operatingYear < model.life
    ? engine.calculateWorkingCapital(wcItems, rampFactor, model.workingCapitalDayBasis) : 0
  const deltaWorkingCapital = nwc - previousNwc
  previousNwc = nwc
  const capexSpend = constructionYear ? totalCapex * (model.capexSchedule[index] ?? 0) / 100 : 0
  const terminalValue = operatingYear === model.life
    ? (model.terminalValueOverride > 0 ? model.terminalValueOverride : depreciable * model.salvagePct / 100) : 0
  const result = engine.calculateProjectCashFlowPeriod({
    ebitda, depreciation, capexSpend, deltaWorkingCapital, terminalValue
  }, model.tax, priorProjectLoss)
  priorProjectLoss = result.lossCarryForward
  generatedProjectCashFlows.push(result.projectCashFlow)
}
console.log('DEBUG Pishran generated flows:', JSON.stringify(generatedProjectCashFlows))
console.log('DEBUG reference flows:', JSON.stringify(pishranExpected.projectCashFlows))
console.log('DEBUG working capital:', workingCapital, 'OPEX:', opexWithoutDepreciation, 'WACC:', wacc.value)
const generatedComfarComparison = engine.reconcileCashFlowSeries(generatedProjectCashFlows, expected.comfarProjectCashFlows, 0.01)
console.log('COMFAR annual cash-flow comparison (benchmark fixture):', {
  matched: generatedComfarComparison.matched,
  periodCountMatch: generatedComfarComparison.periodCountMatch,
  modelTotal: generatedComfarComparison.modelTotal,
  referenceTotal: generatedComfarComparison.referenceTotal,
  totalDifference: generatedComfarComparison.totalDifference,
  maxAbsoluteDifference: generatedComfarComparison.maxAbsoluteDifference
})
assert.equal(generatedProjectCashFlows.length, pishranExpected.projectCashFlows.length, 'Pishran project flow period count')
assert.ok(generatedProjectCashFlows.every(Number.isFinite), 'Pishran generated cash flows must all be finite')
assert.ok(generatedProjectCashFlows.some(value => value < 0) && generatedProjectCashFlows.some(value => value > 0),
  'Pishran generated cash flows must contain investment outflow and operating inflow')
const generatedNpv = engine.calculateNpv(generatedProjectCashFlows, expected.roundedDiscountRate)
const generatedIrr = engine.calculateIrr(generatedProjectCashFlows)
const generatedMirr = engine.calculateMirr(generatedProjectCashFlows, expected.financeRate, expected.reinvestmentRate)
assert.ok(Number.isFinite(generatedNpv) && Number.isFinite(generatedIrr) && Number.isFinite(generatedMirr),
  'Pishran-generated NPV, IRR and MIRR must be finite')
console.log('Pishran-generated metrics (not yet reconciled to COMFAR):', {
  NPV: generatedNpv, IRR: generatedIrr, MIRR: generatedMirr
})

console.log('PASS: raw materials, energy, process consumables, spares, maintenance and payroll')
console.log('PASS: 360-day working capital = ' + workingCapital.toFixed(4) + ' million Rial')
console.log('PASS: WACC = ' + (wacc.value * 100).toFixed(6) + '%')
console.log('PASS: NPV / IRR / MIRR independently reproduce the COMFAR reference row')
console.log('PASS: Pishran-generated project cash flows are finite and return valid NPV / IRR / MIRR')
console.log('REVIEW REQUIRED: generated Pishran cash flows are not yet numerically reconciled to COMFAR cash flows')
console.log('NOTE: Excel rounds WACC 21.284299% to 21% for its NPV cell.')


const integrated = engine.calculateIntegratedFinance({
  years: 6,
  constructionYears: 1,
  capacity: 100,
  fullCapacityRevenue: 2000,
  fullCapacityVariableCashCost: 600,
  fullCapacityFixedCashCost: 400,
  annualDepreciation: 100,
  fixedInvestment: 1000,
  preOperatingCost: 100,
  fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
  preOperatingSchedule: [100, 0, 0, 0, 0, 0],
  utilization: [0, 1, 1, 1, 1, 1],
  equityContributions: [600, 0, 0, 0, 0, 0],
  loans: [{
    id: 'test-loan',
    label: 'Test loan',
    drawdowns: [400, 0, 0, 0, 0, 0],
    annualRate: 10,
    graceYears: 0,
    termYears: 2,
    repaymentStartYear: 2,
    repaymentMethod: 'equal-principal',
    capitalizeInterest: false
  }],
  taxRate: 25,
  costOfEquity: 20,
  workingCapitalPercent: 10,
  salesEscalationPercent: 1,
  opexEscalationPercent: 2,
  discountMode: 'wacc',
  manualDiscountRate: 25,
  salvageValue: 50
})
near(integrated.wacc, 0.15, 1e-12, 'Integrated WACC')
const matchingCashFlows = engine.reconcileCashFlowSeries([-100, 60, 60], [-100, 60, 60], 0.01)
assert.equal(matchingCashFlows.matched, true, 'Identical COMFAR cash-flow vectors must reconcile')
const differingCashFlows = engine.reconcileCashFlowSeries([-100, 55, 60], [-100, 60, 60], 0.01)
assert.equal(differingCashFlows.matched, false, 'Cash-flow differences above tolerance must be flagged')
near(differingCashFlows.maxAbsoluteDifference, 5, 1e-12, 'Maximum annual cash-flow variance')
const missingPeriodCashFlows = engine.reconcileCashFlowSeries([-100, 60], [-100, 60, 0], 0.01)
assert.equal(missingPeriodCashFlows.periodCountMatch, false, 'Missing COMFAR periods must not be silently aligned')
const taxSeparationInput = {
  years: 3, constructionYears: 1, capacity: 10,
  fullCapacityRevenue: 1000, fullCapacityVariableCashCost: 200,
  fullCapacityFixedCashCost: 100, annualDepreciation: 50,
  fixedInvestment: 100, preOperatingCost: 0,
  fixedInvestmentSchedule: [100, 0, 0], preOperatingSchedule: [0, 0, 0],
  utilization: [0, 1, 1], equityContributions: [60, 0, 0],
  loans: [{ id: 'tax-test-loan', label: 'Tax test loan', drawdowns: [40, 0, 0],
    annualRate: 10, graceYears: 0, termYears: 1, repaymentStartYear: 2,
    repaymentMethod: 'bullet', capitalizeInterest: false }],
  taxRate: 25, waccTaxRate: 25, costOfEquity: 20,
  workingCapitalPercent: 0, salesEscalationPercent: 0, opexEscalationPercent: 0,
  discountMode: 'wacc', manualDiscountRate: 25
}
const taxBase = engine.calculateIntegratedFinance(taxSeparationInput)
const lowerOperatingTax = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRate: 5 })
const lowerWaccTaxShield = engine.calculateIntegratedFinance({ ...taxSeparationInput, waccTaxRate: 20 })
near(lowerOperatingTax.wacc, taxBase.wacc, 1e-12, 'Operating tax must not change WACC tax shield')
assert.ok(lowerOperatingTax.years[1].tax < taxBase.years[1].tax, 'Operating tax rate must change cash taxes')
assert.notEqual(lowerWaccTaxShield.wacc, taxBase.wacc, 'WACC tax shield rate must change WACC')
near(lowerWaccTaxShield.years[1].tax, taxBase.years[1].tax, 1e-9, 'WACC tax shield must not change operating cash taxes')
const annualTaxSchedule = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRateSchedule: [25, 5, 25] })
near(annualTaxSchedule.years[1].tax, lowerOperatingTax.years[1].tax, 1e-9, 'Year-specific operating tax schedule')
near(annualTaxSchedule.wacc, taxBase.wacc, 1e-12, 'Annual operating tax schedule must not alter WACC')
const invalidTaxSchedule = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRateSchedule: [25, 105, 25] })
assert.ok(invalidTaxSchedule.warnings.some(warning => warning.includes('نرخ مالیات عملکرد سالانه')), 'Invalid annual tax rates must produce a warning')
near(integrated.totalFunding, 1000, 1e-9, 'Integrated funding')
near(integrated.peakWorkingCapital, 108.243216, 1e-9, 'Integrated working capital with OPEX escalation')
near(integrated.fundingGap, 208.243216, 1e-9, 'Integrated funding gap with OPEX escalation')
near(integrated.loanSchedules['test-loan'][1].principal, 200, 1e-9, 'Equal principal repayment')
near(integrated.years[1].revenue, 2000, 1e-9, 'First operating year sales')
near(integrated.years[2].revenue, 2020, 1e-9, 'Sales escalation')
near(integrated.years[2].variableCashCost, 612, 1e-9, 'OPEX escalation')
assert.ok(Number.isFinite(integrated.npvProject), 'Integrated project NPV must be finite')
assert.ok(Number.isFinite(integrated.irrProject), 'Integrated project IRR must be finite')
assert.ok(Number.isFinite(integrated.irrEquity), 'Integrated equity IRR must be finite')
assert.ok(Number.isFinite(integrated.mirrEquity), 'Integrated modified equity IRR must be finite')
assert.ok(workspaceSource.includes("'Modified IRRE on equity':financeResult.mirrEquity===null?0:financeResult.mirrEquity*100"), 'COMFAR modified equity IRR must use the integrated equity cash flow')
assert.equal(integrated.years.length, 6, 'Integrated model period count')
near(integrated.years[5].salvageProceeds, 50, 1e-9, 'Terminal salvage proceeds')
near(integrated.years[5].terminalValue, 50 + integrated.years[5].workingCapital, 1e-9, 'Terminal value includes salvage and working capital recovery')
for (let index = 0; index < integrated.years.length; index++) {
  const year = integrated.years[index]
  const openingCash = index ? integrated.years[index - 1].cashBalance : 0
  const inflows = year.revenue + year.equityContribution + year.debtDrawdown + year.terminalValue
  const outflows = year.fixedInvestment + year.preOperatingCost + year.changeInWorkingCapital + year.variableCashCost + year.fixedCashCost + year.tax + year.interest + year.principal
  near(year.cashBalance - openingCash, inflows - outflows, 1e-8, 'Annual cash flow statement reconciliation year ' + year.year)
}

const capacityScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 200,
    fullCapacityRevenue: 4000, fullCapacityVariableCashCost: 1200,
    fullCapacityFixedCashCost: 400, annualDepreciation: 200,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(capacityScenario.years[1].production, 200, 1e-9, 'Capacity scenario production')
near(capacityScenario.years[1].revenue, 4000, 1e-9, 'Capacity scenario revenue')
near(capacityScenario.years[1].variableCashCost, 1200, 1e-9, 'Capacity scenario variable OPEX')
near(capacityScenario.years[1].fixedCashCost, 400, 1e-9, 'Capacity scenario fixed OPEX')
assert.notEqual(capacityScenario.npvProject, integrated.npvProject, 'Capacity changes must update project NPV')

const priceScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2200, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(priceScenario.years[1].revenue, 2200, 1e-9, 'Sales price scenario revenue')
assert.notEqual(priceScenario.npvProject, integrated.npvProject, 'Sales price changes must update project NPV')

const capitalStructureScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2000, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [800, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [200, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(capitalStructureScenario.wacc, 0.175, 1e-12, 'Capital structure scenario WACC')
assert.notEqual(capitalStructureScenario.wacc, integrated.wacc, 'Capital structure changes must update WACC')

const loanRateScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2000, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 12, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
assert.ok(loanRateScenario.years[1].interest > integrated.years[1].interest,
  'Loan rate changes must update interest expense')
assert.notEqual(loanRateScenario.wacc, integrated.wacc, 'Loan rate changes must update WACC')
console.log('PASS: capacity, selling price, capital structure and loan-rate changes propagate to financial results')

const cyclePolicy = {
  dayBasis: 360,
  rawMaterialDays: 30,
  workInProgressDays: 10,
  workInProgressMaterialCompletionPercent: 100,
  workInProgressConversionCompletionPercent: 50,
  finishedGoodsDays: 15,
  receivableDays: 45,
  cashDays: 5,
  payableDays: 20,
  annualRawMaterialCost: 3600,
  annualPayablesCost: 5400,
  annualFixedPayablesCost: 0,
  annualConversionCost: 1800,
  annualFinishedGoodsCost: 7200,
  annualRevenue: 7200,
  annualCashOperatingCost: 3600
}
const cycle = engine.calculateOperatingCycleWorkingCapital(cyclePolicy, 0.5, 1.1, 1.2)
near(cycle.rawMaterials, 180, 1e-9, 'Operating cycle raw material inventory')
near(cycle.workInProgress, 75, 1e-9, 'Operating cycle WIP inventory with material and conversion completion')
near(cycle.finishedGoods, 180, 1e-9, 'Operating cycle finished goods')
near(cycle.receivables, 495, 1e-9, 'Operating cycle receivables')
near(cycle.minimumCash, 30, 1e-9, 'Operating cycle minimum cash')
near(cycle.payables, 180, 1e-9, 'Operating cycle supplier payables including energy and maintenance purchases')
near(cycle.netWorkingCapital, 780, 1e-9, 'Operating cycle net working capital with supplier purchase base')
near(engine.calculateCashConversionCycleDays(cyclePolicy), 80, 1e-9, 'Cash conversion cycle days')
near(engine.calculateCashConversionCycleDays({ ...cyclePolicy, rawMaterialDays: 500 }), 410, 1e-9, 'Cash conversion cycle clamps days to the selected annual basis')
const fixedCostCycle = engine.calculateOperatingCycleWorkingCapital({ ...cyclePolicy, annualFixedConversionCost: 900, annualFixedFinishedGoodsCost: 900, annualFixedCashOperatingCost: 900 }, 0.5, 1.1, 1.2)
near(fixedCostCycle.workInProgress, 82.5, 1e-9, 'WIP fixed and variable conversion cost split')
near(fixedCostCycle.finishedGoods, 202.5, 1e-9, 'Finished goods fixed and variable cost split')
near(fixedCostCycle.minimumCash, 37.5, 1e-9, 'Minimum cash fixed and variable cost split')
near(fixedCostCycle.payables, 180, 1e-9, 'Supplier payables use eligible purchases rather than raw materials only')
near(fixedCostCycle.netWorkingCapital, 817.5, 1e-9, 'Fixed-cost-aware operating working capital')

const scaledCapex = engine.calculateCapacityScaledCapex(1000, 100, 200, 0.6)
near(scaledCapex.factor, Math.pow(2, 0.6), 1e-12, 'Non-linear CAPEX scale factor')
near(scaledCapex.amount, 1000 * Math.pow(2, 0.6), 1e-9, 'Non-linear CAPEX scaled amount')
near(engine.calculateCapacityScaledCapex(1000, 100, 200, 0).amount, 1000, 1e-9, 'Fixed CAPEX category elasticity')
assert.equal(engine.calculateCapacityScaledCapex(1000, 0, 200, 0.6).valid, false, 'Invalid reference capacity must be rejected')

const grossWorkingCapitalChange = cycle.rawMaterials + cycle.workInProgress + cycle.finishedGoods + cycle.receivables + cycle.minimumCash
const netWorkingCapitalChange = grossWorkingCapitalChange - cycle.payables
near(netWorkingCapitalChange, cycle.netWorkingCapital, 1e-9, 'COMFAR working capital bridge: gross assets less supplier credit')
const priorNwc = 500, currentNwc = 780, priorPayables = 100, currentPayables = 180
const comfarGrossAssetIncrease = (currentNwc - priorNwc) + (currentPayables - priorPayables)
near(comfarGrossAssetIncrease - (currentPayables - priorPayables), currentNwc - priorNwc, 1e-9, 'COMFAR gross working capital and payable source reconciliation')
console.log('PASS: operating-cycle working capital, WIP completion, fixed/variable costs, supplier credit and cash conversion cycle')
console.log('PASS: non-linear category CAPEX scaling and invalid-input handling')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'COMFAR must report the net working-capital movement after supplier credit')
assert.ok(workspaceSource.includes("'Accounts payable':0,'TOTAL SOURCES OF FINANCE':year.equityContribution+year.debtDrawdown+financeSumAt(financeLoans,i,'capitalizedInterest')"), 'COMFAR must not double count payables already deducted in net working capital')
assert.ok(workspaceSource.includes("'TOTAL INVESTMENT COSTS':year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+capitalizedInterest"), 'COMFAR total investment costs must reconcile CAPEX, pre-production, capitalized interest and net working capital')
assert.ok(workspaceSource.includes("'TOTAL CASH INFLOW':year.revenue+year.equityContribution+year.debtDrawdown+year.terminalValue"), 'Cash flow statement must include terminal recoveries')
assert.ok(workspaceSource.includes("'TOTAL CASH OUTFLOW':uses"), 'COMFAR cash outflow subtotal must use the same cash-use bridge as the balance')
assert.ok(workspaceSource.includes("uses=year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+cashOpex+year.tax+year.interest+year.principal"), 'Cash outflow must include fixed assets, pre-production, net working capital, operating costs, tax, interest and principal')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'Other income must reconcile to terminal value')
assert.ok(workspaceSource.includes("'Total short-term loans':shortTerm"), 'Cash-flow statement must use COMFAR short-term-loan row naming')
assert.ok(workspaceSource.includes("'SURPLUS (DEFICIT)':year.cashBalance-opening,'CUMULATIVE CASH BALANCE':year.cashBalance"), 'Annual and cumulative cash balances must reconcile to the cash-flow statement')
assert.ok(workspaceSource.includes("'TAXABLE PROFIT':year.taxableProfit"), 'COMFAR taxable profit must use loss carry-forward')
assert.ok(workspaceSource.includes("'Interest':capitalizedInterest"), 'COMFAR investment cost must include only capitalized interest, not cash interest twice')
assert.ok(workspaceSource.includes("'Total pre-production expenditures':year.preOperatingCost+capitalizedInterest,'Pre-production expenditures (net of interest)':year.preOperatingCost"), 'COMFAR pre-production subtotal must reconcile net expenditures plus capitalized interest')
assert.ok(workspaceSource.includes("taxRateSchedule:Array.from({length:19},(_,i)=>Math.max(0,Math.min(100,Number(financeRow('نرخ مالیات عملکرد سالانه (%)')?.values['y'+(i+1)]??financeValue('نرخ مالیات عملکرد پایه (%)',25)))))"), 'Annual tax schedule must feed all 19 project years')
assert.ok(workspaceSource.includes("for(let year=1;year<=19;year++)values['y'+year]=year===5?5:25"), 'Default year-five tax assumption must match COMFAR reference and remain editable')
assert.ok(workspaceSource.includes("waccTaxRate:financeValue('نرخ مالیات برای سپر مالیاتی WACC (%)',25)"), 'WACC tax shield must be separately configurable from operating tax')
assert.ok(workspaceSource.includes("annualFixedConversionCost:fixedConversionCost"), 'WIP fixed conversion must exclude fixed raw-material inventory cost')
assert.ok(workspaceSource.includes("annualPayablesCost:materialCost+energyCost+maintenanceCostTotal+otherOpexTotal"), 'Supplier credit must use eligible material, energy, maintenance and supplier purchases')
assert.ok(workspaceSource.includes("annualFixedPayablesCost:financeValue('هزینه ثابت سالانه مشمول بدهی تجاری (یورو)',0)"), 'Fixed supplier-credit purchases must be separately configurable')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'COMFAR Other income must include terminal working-capital recovery and salvage')
assert.ok(workspaceSource.includes('years:19,constructionYears,') && workspaceSource.includes("financeValue('تعداد سال دوره ساخت',4)") && workspaceSource.includes("financeValue('تعداد سال دوره بهره‌برداری',15)"), 'Project model horizon must default to four construction plus fifteen operating years and remain configurable')
assert.ok(workspaceSource.includes("referenceYear:isScalar?0:annual[8]??0,lastYear:isScalar?0:annual[18]??0"), 'COMFAR reference year 9 and last year 19 must map to the correct periods')
assert.ok(workspaceSource.includes("const utilizationSchedule=Array.from({length:19},(_,i)=>i<constructionYears?0:Math.min(1,[.7,.8,.9,1][i-constructionYears]??1))"), 'The terminal year must be the final operating year, not an extra non-operating year')
assert.ok(workspaceSource.includes("'Increase in fixed assets':year.fixedInvestment"), 'COMFAR cash flow must map annual fixed-asset investment')
assert.ok(workspaceSource.includes("'Marketing costs':0"), 'COMFAR marketing cost line must remain explicit when no separate marketing input exists')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'COMFAR cash flow must use the annual net working-capital movement')
console.log('PASS: COMFAR net working capital, no double-counting of supplier credit, capitalized interest and taxable profit mapping')
console.log('PASS: integrated WACC, loan amortization, working capital, escalation, terminal value, cash flow reconciliation, NPV and project/equity IRR')
