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
const store = await import(storeUrl)

const project = (id, name, steelStage, templateId) => ({
  id, name, industry:'steel-and-mining', steelStage, templateId, capacity:'100000', location:'', status:'draft',
  createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z'
})
const key = 'projects:list:v1'
await store.__store.set(key, [
  project('retired-a','Steel Slab','steel-slab','steel-slab'),
  project('retired-b','Extra DRI','extra-dri','extra-dri'),
  project('kept-legacy','User-defined raw model','hot-rolling','legacy-template'),
])
const normalized = await repository.listProjects()
assert.ok(normalized.every(row => row.templateId === 'raw'))
assert.equal(normalized.find(row => row.id === 'kept-legacy').steelStage,'hot-rolling')

await store.__store.set(key, [
  project('retired-a','Steel Slab','steel-slab','steel-slab'),
  project('retired-b','Extra DRI','extra-dri','extra-dri'),
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
