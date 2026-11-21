import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

class MemoryStorage {
  values = new Map()
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(key) }
  clear() { this.values.clear() }
}

globalThis.localStorage = new MemoryStorage()
globalThis.indexedDB = undefined
globalThis.window = {}

const transpile = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
}
const asDataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64')

const localStoreSource = await transpile('../src/core/storage/localStore.ts')
const localStoreUrl = asDataUrl(localStoreSource)
const { localStore } = await import(localStoreUrl)

const projectSource = (await transpile('../src/core/projects/projectRepository.ts'))
  .replace("from '../storage/localStore'", `from '${localStoreUrl}'`)
const projects = await import(asDataUrl(projectSource))

const backupSource = (await transpile('../src/core/storage/backupService.ts'))
  .replace("from './localStore'", `from '${localStoreUrl}'`)
const backup = await import(asDataUrl(backupSource))

// 1) Local storage fallback: CRUD, listing, export and strict import validation.
await localStore.set('foundation:test', { value: 42 })
assert.deepEqual(await localStore.get('foundation:test'), { value: 42 })
assert.deepEqual(await localStore.list('foundation:'), [{ key: 'foundation:test', value: { value: 42 } }])
assert.equal((await localStore.exportAll()).records.some(record => record.key === 'foundation:test'), true)
await assert.rejects(
  () => localStore.replaceAll([{ key: 'duplicate', value: 1 }, { key: 'duplicate', value: 2 }]),
  /ساختار رکوردهای فایل پشتیبان معتبر نیست/
)
await localStore.remove('foundation:test')
assert.equal(await localStore.get('foundation:test'), undefined)

// 2) Project repository: create, update, list and delete through the single store.
assert.deepEqual(await projects.listProjects(), [])
const created = await projects.createProject({
  name: 'Foundation test project', industry: 'industrial',
  projectType: 'other', capacity: '100', location: 'test'
})
assert.equal(created.templateId, 'raw')
assert.equal((await projects.listProjects())[0].id, created.id)
const updated = await projects.updateProject(created.id, { name: 'Updated foundation project' })
assert.equal(updated.name, 'Updated foundation project')
await projects.deleteProject(created.id)
assert.deepEqual(await projects.listProjects(), [])

// 3) Backup compatibility and round-trip restore/undo, including preferences.
const legacyBackup = { app: 'Pishran', schema: 1, exportedAt: '2026-01-01T00:00:00.000Z', records: [] }
const currentBackup = { app: 'Pishran', schema: 2, exportedAt: '2026-01-01T00:00:00.000Z', records: [] }
assert.equal(backup.parseBackup(JSON.stringify(legacyBackup)).schema, 1)
assert.equal(backup.parseBackup(JSON.stringify(currentBackup)).schema, 2)
assert.throws(
  () => backup.parseBackup(JSON.stringify({ ...currentBackup, records: [{ key: 'x', value: 1 }, { key: 'x', value: 2 }] })),
  /ساختار رکوردهای فایل پشتیبان معتبر نیست/
)
assert.throws(() => backup.parseBackup('{invalid json'), /JSON معتبر نیست/)

const originalProject = {
  id: 'before-restore', name: 'Before restore', industry: 'industrial',
  capacity: '10', location: 'local', status: 'draft',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  templateId: 'raw'
}
await localStore.set('projects:list:v1', [originalProject])
const previousPreferences = {
  enabled: true, interval: '6h', lastAt: 'before-restore',
  lastSize: 123, lastKind: 'manual', folderName: 'test-folder'
}
await backup.saveBackupPreferences(previousPreferences)
const built = await backup.buildBackup()
assert.equal(built.payload.schema, 2)
assert.ok(built.payload.records.some(record => record.key === 'projects:list:v1'))

const restoredProject = { ...originalProject, id: 'after-restore', name: 'After restore' }
const restorePayload = {
  app: 'Pishran', schema: 2, exportedAt: new Date().toISOString(),
  records: [{ key: 'projects:list:v1', value: [restoredProject] }],
  backupPreferences: { enabled: false, interval: '1d' }
}
assert.equal(await backup.restoreBackup(restorePayload), 1)
assert.equal(await backup.canUndoRestore(), true, 'Undo snapshot must survive replaceAll clearing app-prefixed keys')
assert.equal((await projects.listProjects())[0].id, 'after-restore')
assert.equal(await backup.undoLastRestore(), built.payload.records.length)
assert.equal((await projects.listProjects())[0].id, 'before-restore')
assert.deepEqual(await backup.getBackupPreferences(), previousPreferences)
assert.equal(await backup.canUndoRestore(), false, 'Undo snapshot must be cleared after successful undo')

const schema1Restore = { ...legacyBackup, records: [{ key: 'projects:list:v1', value: [restoredProject] }] }
await backup.restoreBackup(schema1Restore)
assert.deepEqual(await backup.getBackupPreferences(), previousPreferences, 'Schema 1 restore must preserve local backup preferences')
await backup.undoLastRestore()
assert.deepEqual(await backup.getBackupPreferences(), previousPreferences)

console.log('PASS: local storage fallback, project repository, backup schema 1/2, restore and undo')
