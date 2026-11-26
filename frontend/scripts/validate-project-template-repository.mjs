import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const storeStub = `
const __store = new Map()
export { __store }
export const localStore = {
  get: async key => __store.get(key),
  set: async (key, value) => { __store.set(key, value) },
  list: async prefix => Array.from(__store.entries()).filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value })),
  remove: async key => { __store.delete(key) },
}
`
const storeUrl = 'data:text/javascript;base64,' + Buffer.from(storeStub).toString('base64')
const source = await readFile(new URL('../src/core/projects/projectRepository.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText.replace("from '../storage/localStore'", `from '${storeUrl}'`)
const repository = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const modelSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.doesNotMatch(modelSource, /leaveProjectBlank/)
assert.doesNotMatch(modelSource, /project\.id==='comfar-hr-plate-250k'\?undefined/)
assert.match(modelSource, /const projectComfarSourceInputs=project\.templateId==='comfar-import'\?COMFAR_PROJECT_INPUTS\[project\.id\]:undefined/)
assert.match(modelSource, /const legacyBlankComfarPlate=project\.id==='comfar-hr-plate-250k'/)
assert.match(modelSource, /project:legacyBlankComfarPlate\?\{\.\.\.defaults\.project/)
const legacyLabel = (...codeUnits) => String.fromCharCode(...codeUnits)
for (const retiredModelMarker of [
  legacyLabel(83,116,101,101,108,32,83,108,97,98),
  legacyLabel(69,120,116,114,97,32,68,82,73),
  legacyLabel(72,82,67,82,50,48,48),
  legacyLabel(99,111,108,100,82,111,108,108,105,110,103,80,114,111,106,101,99,116),
  legacyLabel(1606,1608,1585,1583,32,1608,32,1604,1608,1604,1607,32,1711,1575,1604,1608,1575,1606,1740,1586,1607,32,1601,1580,1585,32,1705,1608,1740,1585,32,1705,1575,1588,1575,1606),
  legacyLabel(1711,1586,1575,1585,1588,32,1601,1606,1740,45,1575,1602,1578,1589,1575,1583,1740,32,1606,1608,1585,1583,32,1587,1585,1583),
  legacyLabel(1778,1776,1776,32,1607,1586,1575,1585,32,1578,1606,32,1576,1585,1575,1740,32,1578,1608,1604,1740,1583,32,1778,1776,1776,32,1607,1586,1575,1585,32,1578,1606,32,1705,1604,1575,1601,32,1587,1585,1583),
]) {
  assert.equal(modelSource.includes(retiredModelMarker), false,
    `Retired sample-project data must not be embedded in the feasibility model: ${retiredModelMarker}`)
}

assert.match(modelSource, /const blankTemplate=project\.templateId==='raw'/)
assert.match(modelSource, /const blankCustomProject=leaveProjectBlank\|\|project\.industry!==['"]فولاد و صنایع معدنی['"]\|\|project\.steelStage===['"]سایر['"]/)
assert.match(modelSource, /productCapacityTotal=m\.products\.reduce/)
assert.match(modelSource, /productCapacityMatchesNameplate=!isSteelProject\|\|Math\.abs\(productCapacityTotal-m\.capacity\.nameplate\)/)
assert.match(modelSource, /&&productCapacityMatchesNameplate,/) 
assert.match(modelSource, /products:blankCustomProject\?\[\]:\[makeRow\(imported\?report!\.product:'محصول اصلی'/)
assert.match(modelSource, /technical:blankCustomProject\?\[\]:selectedStage\.fields\.map/)
assert.match(modelSource, /balance:blankCustomProject\?\[\]:stageRows/)
assert.match(modelSource, /utilities:blankCustomProject\?\[\]:stageRows/)
assert.match(modelSource, /const capexRows=sourceInputs&&report\?\[/)
assert.match(modelSource, /const opexRows=sourceInputs&&report\?sourceInputs\.operatingCostRows\.map/)
assert.match(modelSource, /equity:imported\?equityShare:\(\(blankTemplate\|\|leaveProjectBlank\)\?0:40\),debt:imported\?debtShare:\(\(blankTemplate\|\|leaveProjectBlank\)\?0:60\)/)
assert.match(modelSource, /startYear:imported\?reportYear:\(\(blankTemplate\|\|leaveProjectBlank\)\?0:1403\),constructionYears:imported\?report!\.constructionYears:\(\(blankTemplate\|\|leaveProjectBlank\)\?0:2\)/)
const store = await import(storeUrl)

const project = (id, name, steelStage, templateId) => ({
  id, name, industry:'فولاد و صنایع معدنی', steelStage, templateId, capacity:'100000', location:'', status:'draft',
  createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z'
})
const key = 'projects:list:v1'
await store.__store.set(key, [
  project('retired-a',legacyLabel(83,116,101,101,108,32,83,108,97,98),legacyLabel(115,116,101,101,108,45,115,108,97,98),legacyLabel(115,116,101,101,108,45,115,108,97,98)),
  project('retired-b',legacyLabel(69,120,116,114,97,32,68,82,73),legacyLabel(101,120,116,114,97,45,100,114,105),legacyLabel(101,120,116,114,97,45,100,114,105)),
  project('retired-c',legacyLabel(72,82,67,82,50,48,48),legacyLabel(104,111,116,45,114,111,108,108,105,110,103),legacyLabel(114,97,119)),
  project('kept-legacy','User-defined raw model','hot-rolling','legacy-template'),
])
const normalized = await repository.listProjects()
assert.ok(normalized.every(row => row.templateId === 'raw'))
assert.equal(normalized.find(row => row.id === 'kept-legacy').steelStage,'hot-rolling')

await store.__store.set(key, [
  project('retired-a',legacyLabel(83,116,101,101,108,32,83,108,97,98),legacyLabel(115,116,101,101,108,45,115,108,97,98),legacyLabel(115,116,101,101,108,45,115,108,97,98)),
  project('retired-b',legacyLabel(69,120,116,114,97,32,68,82,73),legacyLabel(101,120,116,114,97,45,100,114,105),legacyLabel(101,120,116,114,97,45,100,114,105)),
  project('retired-c',legacyLabel(72,82,67,82,50,48,48),legacyLabel(104,111,116,45,114,111,108,108,105,110,103),legacyLabel(114,97,119)),
  project('kept','Raw model','user-defined','legacy-template'),
])
await store.__store.set('pishran:rolling:sample',{value:1})
await store.__store.set('process-plant:sample',{value:1})
await store.__store.set('rolling:sample:v2',{value:1})
await store.__store.set('projects:workbook-seed:v1',{value:1})
for (const id of ['retired-a','retired-b','retired-c']) {
  await store.__store.set('feasibility:project:' + id + ':v1',{sample:true})
  await store.__store.set('feasibility:advanced-finance:' + id,{sample:true})
  await store.__store.set('feasibility:advanced-finance:' + id + ':v2',{sample:true})
}
const remaining = await repository.purgeRemovedCaseProjects()
assert.deepEqual(remaining.map(row=>row.id),['kept'])
assert.equal(remaining[0].templateId,'raw')
assert.equal(remaining[0].steelStage,'user-defined')
assert.equal(store.__store.has('pishran:rolling:sample'),false)
assert.equal(store.__store.has('process-plant:sample'),false)
assert.equal(store.__store.has('rolling:sample:v2'),false)
assert.equal(store.__store.has('projects:workbook-seed:v1'),false)
for (const id of ['retired-a','retired-b','retired-c']) {
  assert.equal(store.__store.has('feasibility:project:' + id + ':v1'),false)
  assert.equal(store.__store.has('feasibility:advanced-finance:' + id),false)
  assert.equal(store.__store.has('feasibility:advanced-finance:' + id + ':v2'),false)
}

const created = await repository.createProject({name:'New raw model',industry:'other',capacity:'',location:''})
assert.equal(created.templateId,'raw')
assert.equal((await repository.listProjects()).every(row=>row.templateId==='raw'),true)

const imported = await repository.seedComfarReferenceProjects()
const comfar = imported.filter(row => row.id.startsWith('comfar-'))
assert.equal(comfar.length,4)
assert.ok(comfar.every(row => row.templateId === 'comfar-import' && row.sourceReport))
assert.equal(comfar.find(row => row.id === 'comfar-hr-coil-200k')?.sourceReport?.primaryCapacity,200000)
assert.equal(comfar.find(row => row.id === 'comfar-hr-plate-250k')?.sourceReport?.primaryCapacity,250000)
assert.equal(comfar.find(row => row.id === 'comfar-cold-coil-200k')?.sourceReport?.primaryCapacity,200000)
assert.equal(comfar.find(row => row.id === 'comfar-integrated-steel-dri')?.sourceReport?.primaryCapacity,1200000)
assert.equal(comfar.find(row => row.id === 'comfar-integrated-steel-dri')?.sourceReport?.secondaryCapacity,1760000)
assert.equal((await repository.listProjects()).filter(row => row.id.startsWith('comfar-')).every(row => row.templateId === 'comfar-import'),true)

const inputSource = await readFile(new URL('../src/features/projects/comfarProjectInputData.ts', import.meta.url), 'utf8')
const inputOutput = ts.transpileModule(inputSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const { COMFAR_PROJECT_INPUTS } = await import('data:text/javascript;base64,' + Buffer.from(inputOutput).toString('base64'))
const expectedSourceTotals = {
  'comfar-hr-coil-200k': { fixed:18463009, preproduction:3538460.06, operating:42661975.08, workingCapital:4595370.36, years:15 },
  'comfar-hr-plate-250k': { fixed:13327319.84, preproduction:9420983.31, operating:40237584.18, workingCapital:1953898.01, years:15 },
  'comfar-cold-coil-200k': { fixed:14387972, preproduction:652400, operating:66206503.66, workingCapital:2960412.61, years:15 },
  'comfar-integrated-steel-dri': { fixed:453858298, preproduction:117124027, operating:643963499, workingCapital:68155775.89, years:15 },
}
for (const [id, expected] of Object.entries(expectedSourceTotals)) {
  const input = COMFAR_PROJECT_INPUTS[id]
  assert.ok(input, `Detailed source input schedule must exist for ${id}`)
  const fixed = input.fixedInvestment.reduce((total, asset) => total + asset.periods.reduce((sum, period) => sum + period.amount, 0), 0)
  const preproduction = input.preproduction.reduce((total, period) => total + period.net + period.capitalizedInterest, 0)
  const operating = input.operatingCostRows.filter(row => !row.name.includes('بازاریابی')).reduce((total, row) => total + row.amount, 0)
  const lastWorkingCapital = input.workingCapital.at(-1)
  assert.ok(Math.abs(fixed - expected.fixed) < 0.02, `${id} fixed asset schedule must reconcile to the report`)
  assert.ok(Math.abs(preproduction - expected.preproduction) < 0.02, `${id} pre-production and capitalized interest must reconcile to the report`)
  assert.ok(Math.abs(operating - expected.operating) < 0.02, `${id} reference-year factory cost breakdown must reconcile to its detailed table`)
  assert.ok(Math.abs(lastWorkingCapital.inventory + lastWorkingCapital.cash - (lastWorkingCapital.payables ?? 0) - expected.workingCapital) < 0.02, `${id} terminal working capital must reconcile to the report`)
  assert.ok(input.workingCapital.length >= expected.years, `${id} must include a multi-year working-capital schedule`)
  if (id === 'comfar-cold-coil-200k') assert.deepEqual(input.capacityUtilization, [81.11, 90.14, 100.14, 100])
  if (id === 'comfar-cold-coil-200k') {
    assert.equal(input.productionSalesSchedule.length, 15, 'Cold-coil sales schedule must cover all 15 operating years')
    assert.equal(input.productionSalesSchedule[0].salesRevenue, 63200000)
    assert.equal(input.productionSalesSchedule[1].salesRevenue, 71100000)
    assert.equal(input.productionSalesSchedule[2].salesRevenue, 79000000)
    assert.equal(input.financingSchedule.length, 4, 'Cold-coil loan schedule must cover drawdown through final repayment')
    assert.equal(input.financingSchedule[0].loanDisbursement, 5000000)
    assert.equal(input.financingSchedule[0].capitalizedInterest, 350000)
    assert.ok(Math.abs(input.financingSchedule.reduce((sum, row) => sum + row.principalRepayment, 0) - 5350000) < 0.02)
    assert.ok(Math.abs(input.financingSchedule.reduce((sum, row) => sum + row.interestExpense, 0) - 2732907.68) < 0.02)
    assert.equal(input.financingSchedule.at(-1).closingDebt, 0)
  }
  if (id === 'comfar-integrated-steel-dri') {
    assert.equal(input.productionSalesSchedule.length, 15, 'Integrated steel slab schedule must cover all 15 operating years')
    assert.equal(input.byproductSalesSchedule.length, 15, 'Extra DRI schedule must cover all 15 operating years')
    assert.equal(input.productionSalesSchedule[0].salesRevenue, 532560000)
    assert.equal(input.byproductSalesSchedule[0].salesRevenue, 101200000)
    assert.equal(input.productionSalesSchedule[4].salesRevenue + input.byproductSalesSchedule[4].salesRevenue, 887300000)
    assert.equal(input.financingSchedule.filter(row => row.loanType === 'long-term').length, 8)
    assert.equal(input.financingSchedule.filter(row => row.loanType === 'short-term').length, 5)
    assert.ok(Math.abs(input.financingSchedule.filter(row => row.loanType === 'long-term').reduce((sum, row) => sum + row.loanDisbursement, 0) - 431000000) < 0.02)
    assert.ok(Math.abs(input.financingSchedule.filter(row => row.loanType === 'long-term').reduce((sum, row) => sum + row.capitalizedInterest, 0) - 110500000) < 0.02)
    assert.ok(Math.abs(input.financingSchedule.filter(row => row.loanType === 'short-term').reduce((sum, row) => sum + row.loanDisbursement, 0) - 49523442.75) < 0.02)
    assert.equal(input.financingSchedule.filter(row => row.loanType === 'short-term').at(-1).closingDebt, 0)
  }
  if (id === 'comfar-hr-plate-250k') {
    assert.equal(input.productionSalesSchedule.length, 15, 'Plate sales schedule must cover all 15 operating years')
    assert.equal(input.byproductSalesSchedule.length, 15, 'Scrape# sales schedule must cover all 15 operating years')
    assert.equal(input.productionSalesSchedule[0].salesRevenue, 33876500)
    assert.equal(input.productionSalesSchedule[3].salesRevenue + input.byproductSalesSchedule[3].salesRevenue, 52485625)
    assert.equal(input.financingSchedule.length, 8, 'Plate loan schedule must cover drawdown through final repayment')
    assert.ok(Math.abs(input.financingSchedule.reduce((sum, row) => sum + row.loanDisbursement, 0) - 12194032.61) < 0.02)
    assert.ok(Math.abs(input.financingSchedule.reduce((sum, row) => sum + row.principalRepayment, 0) - 21346939.92) < 0.02)
    assert.ok(Math.abs(input.financingSchedule.reduce((sum, row) => sum + row.interestExpense, 0) - 17369293.32) < 0.02)
    assert.equal(input.financingSchedule.at(-1).closingDebt, 0)
  }
  assert.ok(input.missingSourceDetails.length >= 4, `${id} must explicitly disclose report details that were not supplied`)
}
assert.match(modelSource, /COMFAR_PROJECT_INPUTS/)
assert.match(modelSource, /fixedInvestmentItems:importedFixedItems/)
assert.match(modelSource, /workingCapital:imported\?report!\.workingCapital:0/)
assert.match(modelSource, /مخارج پیش از تولید/)
assert.match(modelSource, /بهره سرمایه‌ای‌شده/)
console.log('Raw project templates, COMFAR reference seeding and retired dataset purge validation passed.')
