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
const [engine, reference] = await Promise.all([
  loadTypeScriptModule('../src/features/steel/financialModel.ts'),
  loadTypeScriptModule('../src/features/steel/hotRollingExcelBenchmark.ts')
])
const model = reference.EXCEL_HOT_ROLLING_200KT
const expected = reference.EXCEL_REFERENCE_EXPECTED
const pishranExpected = reference.PISHRAN_REFERENCE_MODEL_OUTPUT
const output = expected.capacity
const currency = model.currency

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
  manualDiscountRate: 25
})
near(integrated.wacc, 0.15, 1e-12, 'Integrated WACC')
near(integrated.totalFunding, 1000, 1e-9, 'Integrated funding')
near(integrated.peakWorkingCapital, 100, 1e-9, 'Integrated working capital')
near(integrated.fundingGap, 200, 1e-9, 'Integrated funding gap')
near(integrated.loanSchedules['test-loan'][1].principal, 200, 1e-9, 'Equal principal repayment')
near(integrated.years[1].revenue, 2000, 1e-9, 'First operating year sales')
near(integrated.years[2].revenue, 2020, 1e-9, 'Sales escalation')
near(integrated.years[2].variableCashCost, 612, 1e-9, 'OPEX escalation')
assert.ok(Number.isFinite(integrated.npvProject), 'Integrated project NPV must be finite')
assert.ok(Number.isFinite(integrated.irrProject), 'Integrated project IRR must be finite')
assert.ok(Number.isFinite(integrated.irrEquity), 'Integrated equity IRR must be finite')
assert.equal(integrated.years.length, 6, 'Integrated model period count')

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
  finishedGoodsDays: 15,
  receivableDays: 45,
  cashDays: 5,
  payableDays: 20,
  annualRawMaterialCost: 3600,
  annualConversionCost: 1800,
  annualFinishedGoodsCost: 7200,
  annualRevenue: 7200,
  annualCashOperatingCost: 3600
}
const cycle = engine.calculateOperatingCycleWorkingCapital(cyclePolicy, 0.5, 1.1, 1.2)
near(cycle.rawMaterials, 180, 1e-9, 'Operating cycle raw material inventory')
near(cycle.workInProgress, 30, 1e-9, 'Operating cycle WIP inventory')
near(cycle.finishedGoods, 180, 1e-9, 'Operating cycle finished goods')
near(cycle.receivables, 495, 1e-9, 'Operating cycle receivables')
near(cycle.minimumCash, 30, 1e-9, 'Operating cycle minimum cash')
near(cycle.payables, 120, 1e-9, 'Operating cycle supplier payables')
near(cycle.netWorkingCapital, 795, 1e-9, 'Operating cycle net working capital')

const scaledCapex = engine.calculateCapacityScaledCapex(1000, 100, 200, 0.6)
near(scaledCapex.factor, Math.pow(2, 0.6), 1e-12, 'Non-linear CAPEX scale factor')
near(scaledCapex.amount, 1000 * Math.pow(2, 0.6), 1e-9, 'Non-linear CAPEX scaled amount')
near(engine.calculateCapacityScaledCapex(1000, 100, 200, 0).amount, 1000, 1e-9, 'Fixed CAPEX category elasticity')
assert.equal(engine.calculateCapacityScaledCapex(1000, 0, 200, 0.6).valid, false, 'Invalid reference capacity must be rejected')

const grossWorkingCapitalChange = cycle.rawMaterials + cycle.workInProgress + cycle.finishedGoods + cycle.receivables + cycle.minimumCash
const netWorkingCapitalChange = grossWorkingCapitalChange - cycle.payables
near(netWorkingCapitalChange, cycle.netWorkingCapital, 1e-9, 'COMFAR working capital bridge: gross assets less supplier credit')
console.log('PASS: operating-cycle working capital, supplier credit and 360-day convention')
console.log('PASS: non-linear category CAPEX scaling and invalid-input handling')
console.log('PASS: integrated WACC, loan amortization, working capital, escalation, project NPV and project/equity IRR')
