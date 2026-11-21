import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import ts from 'typescript'
import { chromium } from 'playwright'

const toDataUrl = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText).toString('base64')
const localStoreUrl = toDataUrl(await readFile(new URL('../src/core/storage/localStore.ts', import.meta.url), 'utf8'))
const projectSource = (await readFile(new URL('../src/core/projects/projectRepository.ts', import.meta.url), 'utf8'))
  .replace("from '../storage/localStore'", `from '${localStoreUrl}'`)
const projectUrl = toDataUrl(projectSource)
const backupSource = (await readFile(new URL('../src/core/storage/backupService.ts', import.meta.url), 'utf8'))
  .replace("from './localStore'", `from '${localStoreUrl}'`)
const backupUrl = toDataUrl(backupSource)

const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
  stdio: 'ignore',
  env: { ...process.env, VITE_PREVIEW_BUILD: 'true' }
})
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:4179/')
      if (response.ok) { ready = true; break }
    } catch {}
    await delay(500)
  }
  assert.equal(ready, true, 'Vite preview server must become available')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:4179/')
  const result = await page.evaluate(async ({ storeUrl, projectsUrl, backupUrl }) => {
    const { localStore } = await import(storeUrl)
    const projects = await import(projectsUrl)
    const backup = await import(backupUrl)
    await localStore.replaceAll([])
    const initial = await localStore.info()
    await localStore.set('browser-test:one', { value: 1 })
    const read = await localStore.get('browser-test:one')
    const listed = await localStore.list('browser-test:')
    const exported = await localStore.exportAll()
    await localStore.set('browser-test:two', { value: 2 })
    const replaced = await localStore.replaceAll([{ key: 'browser-test:restored', value: { value: 3 } }])
    const afterReplace = await localStore.list('browser-test:')
    await localStore.remove('browser-test:restored')
    const removed = await localStore.get('browser-test:restored')

    const created = await projects.createProject({ name: 'IndexedDB project', industry: 'industrial', projectType: 'other', capacity: '50', location: 'test' })
    const listedProjects = await projects.listProjects()
    const updated = await projects.updateProject(created.id, { name: 'IndexedDB project updated' })
    const projectAfterUpdate = await projects.listProjects()

    const previousPreferences = { enabled: true, interval: '6h', lastAt: 'before', lastSize: 91, lastKind: 'manual', folderName: 'browser-test' }
    await backup.saveBackupPreferences(previousPreferences)
    await localStore.set('browser-test:preserve', { stable: true })
    const backupPayload = await backup.buildBackup()
    await projects.updateProject(created.id, { name: 'Project changed after backup' })
    const restoreCount = await backup.restoreBackup(backupPayload.payload)
    const undoAvailable = await backup.canUndoRestore()
    const restoredProject = (await projects.listProjects())[0]
    const undoCount = await backup.undoLastRestore()
    const projectAfterUndo = (await projects.listProjects())[0]
    const afterUndo = await localStore.get('browser-test:preserve')
    const preferencesAfterUndo = await backup.getBackupPreferences()
    await projects.deleteProject(created.id)
    const projectsAfterDelete = await projects.listProjects()

    return { initial, read, listed, exported, replaced, afterReplace, removed, final: await localStore.info(),
      created, listedProjects, updated, projectAfterUpdate, projectsAfterDelete, backupPayload,
      restoreCount, undoAvailable, restoredProject, undoCount, projectAfterUndo, afterUndo, preferencesAfterUndo }
  }, { storeUrl: localStoreUrl, projectsUrl: projectUrl, backupUrl })

  assert.equal(result.initial.backend, 'IndexedDB', 'test must exercise native browser IndexedDB, not localStorage fallback')
  assert.deepEqual(result.read, { value: 1 })
  assert.equal(result.listed.length, 1)
  assert.ok(result.exported.records.some(record => record.key === 'browser-test:one'))
  assert.equal(result.replaced, 1)
  assert.deepEqual(result.afterReplace, [{ key: 'browser-test:restored', value: { value: 3 } }])
  assert.equal(result.removed, undefined)
  assert.equal(result.final.backend, 'IndexedDB')
  assert.equal(result.created.templateId, 'raw')
  assert.equal(result.listedProjects.length, 1)
  assert.equal(result.updated.name, 'IndexedDB project updated')
  assert.equal(result.projectAfterUpdate[0].name, 'IndexedDB project updated')
  assert.deepEqual(result.projectsAfterDelete, [])
  assert.equal(result.backupPayload.payload.schema, 2)
  assert.ok(result.restoreCount > 0)
  assert.equal(result.undoAvailable, true)
  assert.equal(result.restoredProject.name, 'IndexedDB project updated')
  assert.ok(result.undoCount > 0)
  assert.equal(result.projectAfterUndo.name, 'Project changed after backup')
  assert.deepEqual(result.projectsAfterDelete, [])
  assert.deepEqual(result.afterUndo, { stable: true })
  assert.deepEqual(result.preferencesAfterUndo, { enabled: true, interval: '6h', lastAt: 'before', lastSize: 91, lastKind: 'manual', folderName: 'browser-test' })
  console.log('PASS: native IndexedDB storage, project lifecycle, backup restore and undo')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
