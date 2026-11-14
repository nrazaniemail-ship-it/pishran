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

console.log('PASS: raw materials, energy, process consumables, spares, maintenance and payroll')
console.log('PASS: 360-day working capital = ' + workingCapital.toFixed(4) + ' million Rial')
console.log('PASS: WACC = ' + (wacc.value * 100).toFixed(6) + '%')
console.log('PASS: NPV / IRR / MIRR match the Excel COMFAR reference cash flows')
console.log('NOTE: Excel rounds WACC 21.284299% to 21% for its NPV cell.')
