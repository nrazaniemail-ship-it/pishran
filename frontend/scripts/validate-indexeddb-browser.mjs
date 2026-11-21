import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import ts from 'typescript'
import { chromium } from 'playwright'

const source = await readFile(new URL('../src/core/storage/localStore.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(compiled).toString('base64')

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
  const result = await page.evaluate(async (url) => {
    const { localStore } = await import(url)
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
    return { initial, read, listed, exported, replaced, afterReplace, removed, final: await localStore.info() }
  }, moduleUrl)

  assert.equal(result.initial.backend, 'IndexedDB', 'test must exercise native browser IndexedDB, not localStorage fallback')
  assert.deepEqual(result.read, { value: 1 })
  assert.equal(result.listed.length, 1)
  assert.ok(result.exported.records.some(record => record.key === 'browser-test:one'))
  assert.equal(result.replaced, 1)
  assert.deepEqual(result.afterReplace, [{ key: 'browser-test:restored', value: { value: 3 } }])
  assert.equal(result.removed, null)
  assert.equal(result.final.backend, 'IndexedDB')
  console.log('PASS: native browser IndexedDB open, CRUD, list, export and atomic replaceAll')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
