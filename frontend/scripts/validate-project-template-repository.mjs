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
assert.match(modelSource, /const blankCustomProject=project\.industry!==['"]فولاد و صنایع معدنی['"]\|\|project\.steelStage===['"]سایر['"]/)
assert.match(modelSource, /technical:blankCustomProject\?\[\]:selectedStage\.fields\.map/)
assert.match(modelSource, /balance:blankCustomProject\?\[\]:stageRows/)
assert.match(modelSource, /utilities:blankCustomProject\?\[\]:stageRows/)
assert.match(modelSource, /capex:blankCustomProject\?\[\]:stageCapexRows/)
assert.match(modelSource, /opex:blankCustomProject\?\[\]:stageRows/)
assert.match(modelSource, /equity:blankTemplate\?0:40,debt:blankTemplate\?0:60/)
assert.match(modelSource, /startYear:blankTemplate\?0:1403,constructionYears:blankTemplate\?0:2/)
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
const remaining = await repository.purgeRemovedCaseProjects()
assert.deepEqual(remaining.map(row=>row.id),['kept'])
assert.equal(remaining[0].templateId,'raw')
assert.equal(remaining[0].steelStage,'user-defined')
assert.equal(store.__store.has('pishran:rolling:sample'),false)
assert.equal(store.__store.has('process-plant:sample'),false)
assert.equal(store.__store.has('rolling:sample:v2'),false)
assert.equal(store.__store.has('projects:workbook-seed:v1'),false)

const created = await repository.createProject({name:'New raw model',industry:'other',capacity:'',location:''})
assert.equal(created.templateId,'raw')
assert.equal((await repository.listProjects()).every(row=>row.templateId==='raw'),true)
console.log('Raw-only project template migration and retired dataset purge validation passed.')
