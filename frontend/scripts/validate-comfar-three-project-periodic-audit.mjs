import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/comfarProjectInputData.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { COMFAR_PROJECT_INPUTS } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

const projects = [
  ['HRCR200 نورد گرم کلاف', 'comfar-hr-coil-200k'],
  ['نورد گرم پلیت SARZAMIN', 'comfar-hr-plate-250k'],
  ['نورد سرد کلاف SARZAMIN', 'comfar-cold-coil-200k'],
]
const tolerance = 0.02
const rows = []
const close = (actual, expected, label) => {
  const variance = actual - expected
  rows.push({ label, expected, actual, variance })
  assert.ok(Number.isFinite(actual) && Math.abs(variance) <= tolerance,
    label + ': reference=' + expected + ', engine/recomputed=' + actual + ', variance=' + variance)
}
const finite = (v, label) => assert.ok(Number.isFinite(v), label + ' must be finite')

for (const [projectName, key] of projects) {
  const data = COMFAR_PROJECT_INPUTS[key]
  assert.ok(data, 'Missing source project ' + key)
  assert.ok(data.productionSalesSchedule?.length, projectName + ': missing production/sales periods')
  assert.ok(data.operatingCostSchedule?.length || data.operatingCostRows?.length,
    projectName + ': missing operating cost source schedule')
  assert.ok(data.workingCapital?.length, projectName + ': missing working-capital periods')
  assert.ok(data.financingSchedule?.length, projectName + ': missing financing source schedule')

  // Rebuild loan closing balances from opening debt, drawdowns, capitalized interest and principal.
  // Interest expense is deliberately excluded from principal unless COMFAR capitalizes it.
  const debtByType = new Map()
  for (const item of [...data.financingSchedule].sort((a,b)=>a.period.localeCompare(b.period))) {
    const type = item.loanType ?? 'long-term'
    const opening = debtByType.get(type) ?? 0
    for (const field of ['loanDisbursement','principalRepayment','interestExpense','capitalizedInterest','closingDebt'])
      finite(item[field], projectName + ' ' + item.period + ' ' + field)
    const recomputed = opening + item.loanDisbursement + item.capitalizedInterest - item.principalRepayment
    close(recomputed, item.closingDebt, projectName + ' debt/' + type + '/' + item.period)
    debtByType.set(type, item.closingDebt)
  }

  // Reconcile production inventory roll-forward and sales revenue for every reported period.
  for (const item of data.productionSalesSchedule) {
    const calculatedClosing = item.openingInventory + item.production - item.sales
    close(calculatedClosing, item.closingInventory, projectName + ' inventory/' + item.period)
    close(item.sales * item.netUnitPrice, item.salesRevenue, projectName + ' sales/' + item.period)
  }
  for (const item of data.byproductSalesSchedule ?? []) {
    const calculatedClosing = item.openingInventory + item.production - item.sales
    close(calculatedClosing, item.closingInventory, projectName + ' byproduct inventory/' + item.period + '/' + item.productName)
    close(item.sales * item.netUnitPrice, item.salesRevenue, projectName + ' byproduct sales/' + item.period + '/' + item.productName)
  }

  // Working capital source rows are retained by period; independently verify that every amount is numeric.
  for (const item of data.workingCapital) {
    finite(item.inventory, projectName + ' inventory NWC/' + item.period)
    finite(item.cash, projectName + ' cash NWC/' + item.period)
    if (item.payables !== undefined) finite(item.payables, projectName + ' payables NWC/' + item.period)
  }
  for (const item of data.preproduction) {
    finite(item.net, projectName + ' preproduction/' + item.period)
    finite(item.capitalizedInterest, projectName + ' capitalized interest/' + item.period)
  }
  for (const item of data.depreciationSchedule ?? []) finite(item.totalDepreciation, projectName + ' depreciation/' + item.period)
  for (const item of data.taxAmountSchedule ?? []) finite(item.amount, projectName + ' tax/' + item.period)

  const missing = []
  if (!data.depreciationSchedule?.length) missing.push('استهلاک دوره‌ای')
  if (!data.taxAmountSchedule?.length) missing.push('مالیات دوره‌ای')
  if (!data.financingSchedule.every(x => Number.isFinite(x.interestExpense))) missing.push('بهره پرداختنی')
  // These schedules are not represented in the current source-input schema and must not be inferred.
  missing.push('صورت سود و زیان کامل', 'جریان نقدی کامل به تفکیک سرفصل', 'ترازنامه دوره‌ای')
  console.log(projectName + ': ' + (data.financingSchedule.length + data.productionSalesSchedule.length + (data.byproductSalesSchedule?.length ?? 0)) +
    ' period rows checked; unavailable source statements: ' + missing.join('، '))
}

console.log('COMFAR three-project schedule audit passed: ' + rows.length + ' numeric variance checks; tolerance ±' + tolerance)
console.log('PERIOD_VARIANCE_REPORT')
for (const row of rows) console.log([row.label, row.expected.toFixed(2), row.actual.toFixed(2), row.variance.toFixed(2)].join(' | '))
