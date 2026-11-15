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
near(driAudit.annualOpex.depreciationDetailed - driAudit.reference.referenceDepreciation,
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
assert.equal(rollingAudit.financingAlternativesInWorkbook.workingCapitalFundingSourceConflict, true,
  'HRCR200 working-capital source must remain flagged as unconfirmed')
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
  'HRCR200 reference financing schedule equity contributions')
near(rollingAudit.financingCashflowSchedule.longTermLoanGrossDrawdowns,
  rollingAudit.financingCashflowSchedule.longTermLoanPrincipalRepayments, 0.01,
  'HRCR200 long-term loan gross drawdowns and principal repayments')
near(rollingAudit.alternativeMetricsInWorkbook.generalSummaryTotalInvestment
  - rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetTotalInvestment,
  10009707.09412, 0.1, 'HRCR200 investment base discrepancy')
assert.ok(workbookAudit.WORKBOOK_RECONCILIATION_FLAGS.some(flag => flag.toLowerCase().includes('rows 7–9') && flag.includes('discounted cash flows')), 'HRCR200 discounted-row methodology conflict must remain explicit')
assert.ok(workbookAudit.WORKBOOK_RECONCILIATION_FLAGS.length >= 5,
  'Source conflicts must remain explicit audit flags')
const referenceCashFlow = workbookAudit.HOT_ROLLING_reference_CASHFLOW_AUDIT
assert.equal(referenceCashFlow.periodCount, 18, 'HRCR200 raw reference planning cash flow periods')
assert.equal(referenceCashFlow.rawPlanningNetHasNegativePeriod, false,
  'HRCR200 raw financial-planning net flow has no initial negative investment period')
near(referenceCashFlow.rawPlanningNetC6T6.reduce((sum,value)=>sum+value,0),
  referenceCashFlow.rawPlanningNetTotal, 0.01, 'HRCR200 raw planning net cash flow total')
assert.equal(engine.calculateIrr(referenceCashFlow.rawPlanningNetC6T6), null,
  'HRCR200 raw planning net flow cannot produce project IRR without negative investment cash flow')
assert.equal(referenceCashFlow.netDiscountedC9S9.length, 17, 'HRCR200 discounted net row periods')
near(referenceCashFlow.netDiscountedC9S9.reduce((sum,value)=>sum+value,0),
  referenceCashFlow.netDiscountedSumC9S9, 0.01, 'HRCR200 net discounted row sum')
near(referenceCashFlow.secondDiscountedNpvRow11Sum, 18509558.820966564, 0.01,
  'HRCR200 NPV after second discount in source sheet')
assert.ok(referenceCashFlow.reportedNpvFormula.includes('NPV(')
  && referenceCashFlow.reportedNpvFormula.includes('D9:S9'),
  'HRCR200 source NPV formula must remain visible')
near(referenceCashFlow.equityCashFlowC51T51[0] + referenceCashFlow.equityCashFlowC51T51[1],
  -2761971, 0.01, 'HRCR200 equity cash-flow initial outflows')

console.log('PASS: source-workbook DRI and HRCR200 CAPEX/OPEX bridges and unresolved financing/depreciation flags')

const model = reference.EXCEL_HOT_ROLLING_200KT
const expected = reference.EXCEL_REFERENCE_EXPECTED
const pishranExpected = reference.PISHRAN_REFERENCE_MODEL_OUTPUT
const workspaceSource = await readFile(new URL('../src/features/steel/ProcessPlantWorkspace.tsx', import.meta.url), 'utf8')
const [projectsViewSource,projectRepositorySource,rollingWorkspaceSource,wizardSource,appSource] = await Promise.all([
  readFile(new URL('../src/features/projects/ProjectsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/projects/projectRepository.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/steel/RollingWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
])
assert.ok(projectsViewSource.includes('قالب پروژه جدید را انتخاب کنید')
  && projectsViewSource.includes('قالب خام')
  && projectsViewSource.includes('قالب پروژه نورد ورق گرم'),
  'New project must ask the user to choose one of the two named templates')
assert.ok(projectRepositorySource.includes("ProjectTemplateId = 'raw' | 'hot-rolling-200kt'")
  && projectRepositorySource.includes('templateId?: ProjectTemplateId'),
  'Project template identity must be persisted with each project')
assert.ok(rollingWorkspaceSource.includes("project.templateId==='hot-rolling-200kt'")
  && rollingWorkspaceSource.includes("!project.templateId&&project.steelStage?.includes('نورد گرم')"),
  'Only explicit hot-rolling template or legacy hot-rolling projects may load benchmark defaults')
assert.ok(wizardSource.includes("project.templateId==='raw'"),
  'Raw template must initialize an empty feasibility model')
assert.ok(wizardSource.includes("value=\"industrial\"")
  && wizardSource.includes("value=\"maritime\"")
  && wizardSource.includes("value=\"agricultural\"")
  && wizardSource.includes("value=\"infrastructure\"")
  && wizardSource.includes("value=\"tourism\"")
  && wizardSource.includes("value=\"mining\""),
  'Project Type must cover COMFAR industrial, maritime, agricultural, infrastructure, tourism and mining categories')
assert.ok(wizardSource.includes("Joint-venture Partners")
  && wizardSource.includes("m.partners.length>=20")
  && wizardSource.includes("profitSharePercent"),
  'Joint-venture project must support up to 20 partner records and separate capital/profit shares')
assert.ok(wizardSource.includes("Opportunity Study")
  && wizardSource.includes("Feasibility Study")
  && wizardSource.includes("Joint-venture Project")
  && wizardSource.includes("Economic Analysis")
  && wizardSource.includes("Cost Centre Analysis")
  && wizardSource.includes("Cost Allocation")
  && wizardSource.includes("Value-added Analysis")
  && wizardSource.includes("Foreign Exchange Effect")
  && wizardSource.includes("Employment Effects"),
  'Project identification must expose COMFAR study levels and analysis scope features')
assert.ok(wizardSource.includes("costCentreAnalysis:e.target.checked||m.scope.costAllocation")
  && wizardSource.includes("costAllocation:e.target.checked,costCentreAnalysis:e.target.checked?true:m.scope.costCentreAnalysis"),
  'Cost Allocation must activate Cost Centre Analysis as in the COMFAR Tutorial workflow')
assert.ok(appSource.includes("if(project.templateId==='raw') setPage('project-wizard')"),
  'Raw template must not be routed into the seeded hot-rolling workspace')
assert.ok(rollingWorkspaceSource.includes('ممیزی جریان نقدی خام و اصلاح‌شده مرجع مالی')
  && rollingWorkspaceSource.includes('HOT_ROLLING_reference_CASHFLOW_AUDIT'),
  'Active rolling workspace must expose the reference cash-flow audit')
assert.equal(model.discountMode, 'wacc', 'Hot-rolling template must use the sponsor-confirmed WACC by default')

const output = expected.capacity
const currency = model.currency
assert.equal(model.equity, 70, 'HRCR200 Excel reference benchmark must preserve the COMFAR 70/30 construction funding split')
assert.equal(model.debt, 30, 'HRCR200 Excel reference benchmark must preserve the COMFAR 70/30 construction funding split')
assert.equal(model.loans.length, 1, 'HRCR200 COMFAR reference benchmark must not assume an unconfirmed working-capital loan')
near(model.loans[0].amount, 5610850.8, 0.01, 'HRCR200 COMFAR-reference fixed loan amount under 70/30 construction financing')

const integratedreference19 = [...integratedReference.INTEGRATED_reference_PROJECT_CASH_FLOWS]
const integratedControls = integratedReference.INTEGRATED_reference_REFERENCE
near(engine.calculateNpv(integratedreference19, 0.25), integratedControls.projectNpvAt25, 0.01, 'Integrated reference 19-period NPV at 25%')
near(engine.calculateIrr(integratedreference19), integratedControls.projectIrr / 100, 0.0002, 'Integrated reference 19-period IRR')
const funding = integratedReference.calculatereferenceFundingGap()
near(funding.uses, integratedControls.totalInvestment, 0.01, 'reference total uses')
near(funding.sources, integratedControls.totalSources, 0.01, 'reference total sources')
near(funding.gap, integratedControls.fundingGap, 0.01, 'reference funding gap')
assert.ok(workspaceSource.includes('INTEGRATED_reference_PROJECT_CASH_FLOWS'), 'Plant reconciliation must use the centralized reference cash-flow reference')
assert.ok(workspaceSource.includes('calculateNpv(referenceActualFlows,referenceDiscountRate)'), 'reference NPV must discount year 1 at period zero like the reference')

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
near(wacc.value, 0.2685, 1e-12, 'Historical COMFAR-reference 70/30 WACC')
near(expected.wacc, 0.21284299025331596, 1e-12, 'Historical workbook WACC remains a source-only benchmark')

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

const cashFlows = [...expected.referenceIrrNpvNetDiscountedCashFlows]
near(engine.calculateNpv(cashFlows, expected.roundedDiscountRate), expected.irrNpvSheetReportedNpvAt21, 0.01, 'Reproduce reported IRR-NPV sheet NPV at 21% from its row 9 basis')
near(engine.calculateNpv(cashFlows, expected.wacc), expected.npvAtExactWacc, 0.01, 'Reproduce IRR-NPV sheet NPV on reported discounted-row basis at exact WACC')
near(engine.calculateIrr(cashFlows), expected.irrNpvSheetReportedIrr, 1e-8, 'Reproduce IRR-NPV sheet reported IRR from its row 9 basis')
near(engine.calculateMirr(cashFlows, expected.financeRate, expected.reinvestmentRate), expected.irrNpvSheetReportedMirr, 1e-8, 'Reproduce IRR-NPV sheet reported MIRR from its row 9 basis')


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
const generatedreferenceComparison = engine.reconcileCashFlowSeries(generatedProjectCashFlows, expected.referenceIrrNpvNetDiscountedCashFlows, 0.01)
assert.equal(generatedreferenceComparison.matched, false, 'Raw Pishran project cash flows must not be represented as matching the IRR-NPV sheet discounted-row vector')
console.log('Basis comparison: raw Pishran project flows vs IRR-NPV sheet row 9 (reported net discounted flows; not like-for-like):', {
  matched: generatedreferenceComparison.matched,
  periodCountMatch: generatedreferenceComparison.periodCountMatch,
  modelTotal: generatedreferenceComparison.modelTotal,
  referenceTotal: generatedreferenceComparison.referenceTotal,
  totalDifference: generatedreferenceComparison.totalDifference,
  maxAbsoluteDifference: generatedreferenceComparison.maxAbsoluteDifference
})
assert.equal(generatedProjectCashFlows.length, pishranExpected.projectCashFlows.length, 'Pishran project flow period count')
for (let index = 0; index < generatedProjectCashFlows.length; index++) near(generatedProjectCashFlows[index], pishranExpected.projectCashFlows[index], 0.01, 'Pishran raw project cash flow period ' + (index + 1))
assert.ok(generatedProjectCashFlows.every(Number.isFinite), 'Pishran generated cash flows must all be finite')
assert.ok(generatedProjectCashFlows.some(value => value < 0) && generatedProjectCashFlows.some(value => value > 0),
  'Pishran generated cash flows must contain investment outflow and operating inflow')
const generatedNpv = engine.calculateNpv(generatedProjectCashFlows, expected.roundedDiscountRate)
const generatedIrr = engine.calculateIrr(generatedProjectCashFlows)
const generatedMirr = engine.calculateMirr(generatedProjectCashFlows, expected.financeRate, expected.reinvestmentRate)
assert.ok(Number.isFinite(generatedNpv) && Number.isFinite(generatedIrr) && Number.isFinite(generatedMirr),
  'Pishran-generated NPV, IRR and MIRR must be finite')
near(generatedNpv, pishranExpected.npvAt21Percent, 0.01, 'Pishran-generated NPV at 21%')
near(engine.calculateNpv(generatedProjectCashFlows, 0.25), pishranExpected.npvAt25Percent, 0.01, 'Pishran-generated NPV at 25% for like-rate comparison with General Summary')
near(pishranExpected.npvAt25Percent - workbookAudit.HOT_ROLLING_200KT_AUDIT.alternativeMetricsInWorkbook.generalSummaryNpvAt25, -37940.98962954, 0.02, 'Pishran and reference General Summary same-rate NPV difference')
near(generatedIrr, pishranExpected.irr, 1e-8, 'Pishran-generated IRR')
near(generatedMirr, pishranExpected.mirr, 1e-8, 'Pishran-generated MIRR')
console.log('Pishran independent project metrics; source reference outputs remain unreconciled pending corrected raw cash-flow export:', {
  NPV21: generatedNpv, NPV25: engine.calculateNpv(generatedProjectCashFlows, 0.25), IRR: generatedIrr, MIRR: generatedMirr
})

console.log('PASS: raw materials, energy, process consumables, spares, maintenance and payroll')
console.log('PASS: 360-day working capital = ' + workingCapital.toFixed(4) + ' million Rial')
console.log('PASS: WACC = ' + (wacc.value * 100).toFixed(6) + '%')
console.log('PASS: Pishran independently reproduces its own raw project cash-flow benchmark; reference row 9 is kept as a separate reported discounted-row control.')
console.log('PASS: Pishran-generated project cash flows are finite and return valid NPV / IRR / MIRR')
console.log('REVIEW REQUIRED: reference IRR-NPV row 9 is not a verified raw project cash-flow vector; source investment base and financing schedules conflict with the CAPEX workbook.')
console.log('NOTE: Excel rounds WACC 21.284299% to 21% for its IRR-NPV sheet cell; its row 9 basis is not validated as raw project cash flow.')


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
assert.equal(matchingCashFlows.matched, true, 'Identical reference cash-flow vectors must reconcile')
const differingCashFlows = engine.reconcileCashFlowSeries([-100, 55, 60], [-100, 60, 60], 0.01)
assert.equal(differingCashFlows.matched, false, 'Cash-flow differences above tolerance must be flagged')
near(differingCashFlows.maxAbsoluteDifference, 5, 1e-12, 'Maximum annual cash-flow variance')
const missingPeriodCashFlows = engine.reconcileCashFlowSeries([-100, 60], [-100, 60, 0], 0.01)
assert.equal(missingPeriodCashFlows.periodCountMatch, false, 'Missing reference periods must not be silently aligned')
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
assert.ok(workspaceSource.includes("'Modified IRRE on equity':financeResult.mirrEquity===null?0:financeResult.mirrEquity*100"), 'reference modified equity IRR must use the integrated equity cash flow')
assert.equal(integrated.years.length, 6, 'Integrated model period count')
near(integrated.years[5].salvageProceeds, 50, 1e-9, 'Terminal salvage proceeds')
near(integrated.years[5].terminalValue, 50, 1e-9, 'Terminal value includes salvage only; working capital is recovered through the final-period NWC release')
near(integrated.years[5].workingCapital, 108.243216, 1e-9, 'Terminal-year operating working-capital requirement remains visible before recovery')
near(integrated.years[5].closingWorkingCapital, 0, 1e-9, 'Terminal working capital is released at project end')
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
near(netWorkingCapitalChange, cycle.netWorkingCapital, 1e-9, 'reference working capital bridge: gross assets less supplier credit')
const priorNwc = 500, currentNwc = 780, priorPayables = 100, currentPayables = 180
const referenceGrossAssetIncrease = (currentNwc - priorNwc) + (currentPayables - priorPayables)
near(referenceGrossAssetIncrease - (currentPayables - priorPayables), currentNwc - priorNwc, 1e-9, 'reference gross working capital and payable source reconciliation')
console.log('PASS: operating-cycle working capital, WIP completion, fixed/variable costs, supplier credit and cash conversion cycle')
console.log('PASS: non-linear category CAPEX scaling and invalid-input handling')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'reference must report the net working-capital movement after supplier credit')
assert.ok(workspaceSource.includes("'Accounts payable':0,'TOTAL SOURCES OF FINANCE':year.equityContribution+year.debtDrawdown+financeSumAt(financeLoans,i,'capitalizedInterest')"), 'reference must not double count payables already deducted in net working capital')
assert.ok(workspaceSource.includes("'TOTAL INVESTMENT COSTS':year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+capitalizedInterest"), 'reference total investment costs must reconcile CAPEX, pre-production, capitalized interest and net working capital')
assert.ok(workspaceSource.includes("'TOTAL CASH INFLOW':year.revenue+year.equityContribution+year.debtDrawdown+year.terminalValue"), 'Cash flow statement must include terminal recoveries')
assert.ok(workspaceSource.includes("'TOTAL CASH OUTFLOW':uses"), 'reference cash outflow subtotal must use the same cash-use bridge as the balance')
assert.ok(workspaceSource.includes("uses=year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+cashOpex+year.tax+year.interest+year.principal"), 'Cash outflow must include fixed assets, pre-production, net working capital, operating costs, tax, interest and principal')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'Other income must reconcile to terminal value')
assert.ok(workspaceSource.includes("'Total short-term loans':shortTerm"), 'Cash-flow statement must use reference short-term-loan row naming')
assert.ok(workspaceSource.includes("'SURPLUS (DEFICIT)':year.cashBalance-opening,'CUMULATIVE CASH BALANCE':year.cashBalance"), 'Annual and cumulative cash balances must reconcile to the cash-flow statement')
assert.ok(workspaceSource.includes("'TAXABLE PROFIT':year.taxableProfit"), 'reference taxable profit must use loss carry-forward')
assert.ok(workspaceSource.includes("'Interest':capitalizedInterest"), 'reference investment cost must include only capitalized interest, not cash interest twice')
assert.ok(workspaceSource.includes("'Total pre-production expenditures':year.preOperatingCost+capitalizedInterest,'Pre-production expenditures (net of interest)':year.preOperatingCost"), 'reference pre-production subtotal must reconcile net expenditures plus capitalized interest')
assert.ok(workspaceSource.includes("taxRateSchedule:Array.from({length:19},(_,i)=>Math.max(0,Math.min(100,Number(financeRow('نرخ مالیات عملکرد سالانه (%)')?.values['y'+(i+1)]??financeValue('نرخ مالیات عملکرد پایه (%)',25)))))"), 'Annual tax schedule must feed all 19 project years')
assert.ok(workspaceSource.includes("for(let year=1;year<=19;year++)values['y'+year]=year===5?5:25"), 'Default year-five tax assumption must match reference reference and remain editable')
assert.ok(workspaceSource.includes("waccTaxRate:financeValue('نرخ مالیات برای سپر مالیاتی WACC (%)',25)"), 'WACC tax shield must be separately configurable from operating tax')
assert.ok(workspaceSource.includes("annualFixedConversionCost:fixedConversionCost"), 'WIP fixed conversion must exclude fixed raw-material inventory cost')
assert.ok(workspaceSource.includes("annualPayablesCost:materialCost+energyCost+maintenanceCostTotal+otherOpexTotal"), 'Supplier credit must use eligible material, energy, maintenance and supplier purchases')
assert.ok(workspaceSource.includes("annualFixedPayablesCost:financeValue('هزینه ثابت سالانه مشمول بدهی تجاری (یورو)',0)"), 'Fixed supplier-credit purchases must be separately configurable')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'reference Other income must include terminal working-capital recovery and salvage')
assert.ok(workspaceSource.includes('years:19,constructionYears,') && workspaceSource.includes("financeValue('تعداد سال دوره ساخت',4)") && workspaceSource.includes("financeValue('تعداد سال دوره بهره‌برداری',15)"), 'Project model horizon must default to four construction plus fifteen operating years and remain configurable')
assert.ok(workspaceSource.includes("referenceYear:isScalar?0:annual[8]??0,lastYear:isScalar?0:annual[18]??0"), 'reference reference year 9 and last year 19 must map to the correct periods')
assert.ok(workspaceSource.includes("const utilizationSchedule=Array.from({length:19},(_,i)=>i<constructionYears?0:Math.min(1,[.7,.8,.9,1][i-constructionYears]??1))"), 'The terminal year must be the final operating year, not an extra non-operating year')
assert.ok(workspaceSource.includes("'Increase in fixed assets':year.fixedInvestment"), 'reference cash flow must map annual fixed-asset investment')
assert.ok(workspaceSource.includes("'Marketing costs':0"), 'reference marketing cost line must remain explicit when no separate marketing input exists')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'reference cash flow must use the annual net working-capital movement')
console.log('PASS: reference net working capital, no double-counting of supplier credit, capitalized interest and taxable profit mapping')

const assetSchedule = engine.calculateAssetDepreciationSchedule([
  { id:'plant', name:'Plant', cost:1000, residualValue:100, usefulLife:3, startYear:2, method:'straight-line' },
  { id:'land', name:'Land', cost:500, residualValue:500, usefulLife:30, startYear:2, method:'straight-line' }
], 5)
near(assetSchedule[0].depreciation, 0, 1e-9, 'Asset depreciation before in-service year')
near(assetSchedule[1].depreciation, 300, 1e-9, 'Asset-by-asset straight-line depreciation')
near(assetSchedule[4].depreciation, 0, 1e-9, 'Depreciation ends after useful life')
near(assetSchedule[3].closingBookValue, 600, 1e-9, 'Asset book value at residual value')
const statements = engine.buildThreeFinancialStatements(integrated.years)
assert.equal(statements.length, integrated.years.length, 'Three statements must cover the full model horizon')
assert.ok(statements.every(row => row.balanceSheet.reconciled), 'Balance sheet must reconcile without a plug for the integrated reference case')
for (const row of statements) {
  near(row.cashFlowStatement.closingCash, row.balanceSheet.cash, 1e-9, 'Cash flow statement and balance sheet cash tie')
  near(row.balanceSheet.totalAssets, row.balanceSheet.totalLiabilitiesAndEquity, 1e-6, 'Balance sheet reconciliation year ' + row.year)
}
const sensitivity = engine.calculateSensitivityMatrix({
  years:6,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:100,fixedInvestment:1000,preOperatingCost:100,
  fixedInvestmentSchedule:[1000,0,0,0,0,0],preOperatingSchedule:[100,0,0,0,0,0],
  utilization:[0,1,1,1,1,1],equityContributions:[600,0,0,0,0,0],
  loans:[{id:'sensitivity-loan',label:'Loan',drawdowns:[400,0,0,0,0,0],annualRate:10,graceYears:0,termYears:2,repaymentStartYear:2,repaymentMethod:'equal-principal',capitalizeInterest:false}],
  taxRate:25,costOfEquity:20,workingCapitalPercent:10,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
assert.equal(sensitivity.length,5,'Sensitivity matrix must contain five volume cases')
assert.equal(sensitivity[0].length,5,'Sensitivity matrix must contain five price cases')
assert.ok(sensitivity[0][0].npv < sensitivity[4][4].npv,'Higher price and volume should improve project NPV')
const scenarioResults = engine.calculateFinancialScenarios({
  years:6,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:100,fixedInvestment:1000,preOperatingCost:100,
  fixedInvestmentSchedule:[1000,0,0,0,0,0],preOperatingSchedule:[100,0,0,0,0,0],
  utilization:[0,1,1,1,1,1],equityContributions:[600,0,0,0,0,0],
  loans:[],taxRate:25,costOfEquity:20,workingCapitalPercent:10,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
assert.ok(scenarioResults.optimistic.npvProject > scenarioResults.base.npvProject,'Optimistic scenario must exceed base NPV')
assert.ok(scenarioResults.pessimistic.npvProject < scenarioResults.base.npvProject,'Pessimistic scenario must be below base NPV')

console.log('PASS: integrated WACC, staged loan amortization, working capital, terminal value, cash flow reconciliation, NPV and project/equity IRR')
console.log('PASS: asset-level depreciation, tax loss carry-forward, multi-variable sensitivity, scenarios and three-statement balance-sheet reconciliation')
const taxLossModel = engine.calculateIntegratedFinance({
  years:4,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:0,depreciationSchedule:[0,1500,0,0],
  fixedInvestment:1000,preOperatingCost:0,fixedInvestmentSchedule:[1000,0,0,0],
  preOperatingSchedule:[0,0,0,0],utilization:[0,1,1,1],equityContributions:[1000,0,0,0],
  loans:[],taxRate:25,costOfEquity:20,workingCapitalPercent:0,salesEscalationPercent:0,
  opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:15
})
near(taxLossModel.years[1].taxLossCarryForward,500,1e-9,'Tax loss carried forward after first operating year')
near(taxLossModel.years[2].taxLossCarryForward,0,1e-9,'Tax loss fully utilized in the following year')
near(taxLossModel.years[2].tax,125,1e-9,'Tax calculated only after loss carry-forward utilization')
const capitalizedLoanModel = engine.calculateIntegratedFinance({
  years:4,constructionYears:2,capacity:100,fullCapacityRevenue:1000,fullCapacityVariableCashCost:200,
  fullCapacityFixedCashCost:100,annualDepreciation:0,fixedInvestment:1000,preOperatingCost:0,
  fixedInvestmentSchedule:[500,500,0,0],preOperatingSchedule:[0,0,0,0],utilization:[0,0,1,1],
  equityContributions:[0,0,0,0],loans:[{id:'capitalized',label:'Capitalized interest loan',drawdowns:[100,0,0,0],
    annualRate:10,graceYears:0,termYears:2,repaymentStartYear:3,repaymentMethod:'equal-principal',capitalizeInterest:true}],
  taxRate:20,costOfEquity:20,workingCapitalPercent:0,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
near(capitalizedLoanModel.loanSchedules.capitalized[0].capitalizedInterest,5,1e-9,'Half-year interest capitalized in drawdown year')
near(capitalizedLoanModel.loanSchedules.capitalized[1].capitalizedInterest,10.5,1e-9,'Interest capitalized on opening balance in grace year')
near(capitalizedLoanModel.loanSchedules.capitalized[2].principal,57.75,1e-9,'Equal principal repayment includes capitalized interest')
assert.ok(engine.buildThreeFinancialStatements(capitalizedLoanModel.years).every(r=>r.balanceSheet.reconciled),'Capitalized interest must be recognized as an asset and balance sheet liability')


const withoutEnterprise = [
  { revenue:0, cashOperatingCosts:0, tax:0, capex:0, changeInWorkingCapital:0 },
  { revenue:500, cashOperatingCosts:400, tax:0, capex:0, changeInWorkingCapital:0 }
]
const withEnterprise = [
  { revenue:0, cashOperatingCosts:0, tax:0, capex:1000, changeInWorkingCapital:0 },
  { revenue:2000, cashOperatingCosts:500, tax:0, capex:0, changeInWorkingCapital:100 }
]
const incremental = engine.calculateIncrementalEnterpriseAnalysis(withoutEnterprise, withEnterprise, 0.1)
near(incremental.periods[0].incrementalCashFlow, -1000, 1e-9, 'Expansion incremental construction outflow')
near(incremental.periods[1].incrementalCashFlow, 1300, 1e-9, 'Expansion incremental operating cash flow after incremental working capital')
near(incremental.incrementalNpv, 181.81818181818176, 1e-8, 'Expansion incremental NPV')
near(incremental.incrementalIrr, 0.3, 1e-8, 'Expansion incremental IRR')
assert.equal(incremental.periods.length, 2, 'Incremental analysis must preserve aligned period count')
const invalidIncremental = engine.calculateIncrementalEnterpriseAnalysis(
  [{ revenue: Number.NaN, cashOperatingCosts: 0, tax: 0, capex: 0, changeInWorkingCapital: 0 }],
  [{ revenue: 100, cashOperatingCosts: 0, tax: 0, capex: 0, changeInWorkingCapital: 0 }],
  0.1
)
assert.equal(invalidIncremental.periods.length, 0, 'Incremental analysis must reject non-finite source data rather than coerce it')
const mismatchedIncremental = engine.calculateIncrementalEnterpriseAnalysis(
  withoutEnterprise, withEnterprise.slice(0, 1), 0.1
)
assert.equal(mismatchedIncremental.periods.length, 0, 'Incremental analysis must reject non-aligned planning horizons')
const expansionPanelSource = await readFile(new URL('../src/features/projects/ExpansionRehabilitationPanel.tsx', import.meta.url), 'utf8')
const expansionWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(expansionWizardSource.includes("analysisMode: 'new'|'expansion'|'rehabilitation'|'combined'")
  && expansionWizardSource.includes("m.analysisMode!=='new'&&<ExpansionRehabilitationPanel"),
  'Project wizard must activate the existing-enterprise module only for expansion/rehabilitation classifications')
assert.ok(expansionPanelSource.includes('Starting Balances')
  && expansionPanelSource.includes('Incremental Analysis')
  && expansionPanelSource.includes('Work in progress')
  && expansionPanelSource.includes('Finished Product Inventory'),
  'Expansion/rehabilitation English UI must use COMFAR Reference Manual terminology')
assert.ok(expansionPanelSource.includes('Residual / salvage value')
  && expansionPanelSource.includes('Depreciation method')
  && expansionPanelSource.includes('Cost Centre')
  && expansionPanelSource.includes('Repayment Frequency')
  && expansionPanelSource.includes('Grace Period (years)')
  && expansionPanelSource.includes('Next Instalment Date'),
  'Existing fixed assets and long-term debt starting balances must expose COMFAR depreciation and repayment attributes')
assert.ok(expansionPanelSource.includes('Long-Term Debt and Equity Capital')
  && expansionPanelSource.includes('Opportunity Value'),
  'Existing fixed assets and long-term finance must use consistent COMFAR vocabulary')
assert.ok(expansionPanelSource.includes('calculateIncrementalEnterpriseAnalysis')
  && expansionPanelSource.includes('Opening Balance Difference')
  && expansionPanelSource.includes('opportunityValue')
  && expansionPanelSource.includes('withoutProjectCashFlow')
  && expansionPanelSource.includes('withProjectCashFlow'),
  'Expansion form must expose opening balances, opportunity values and with/without/incremental scenarios')
console.log('PASS: COMFAR-style existing-enterprise opening balances and incremental with/without-project analysis')

const opportunityCostCase = engine.calculateIncrementalEnterpriseAnalysis(
  withoutEnterprise,
  withEnterprise.map((period,index)=>index===0?{...period,opportunityCost:200}:period),
  0.1
)
near(opportunityCostCase.periods[0].incrementalCashFlow, -1200, 1e-9,
  'Existing asset opportunity cost must be charged to the with-project incremental case')
