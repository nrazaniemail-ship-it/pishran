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

const previewUrl = 'http://127.0.0.1:4179/'
const server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], {
  stdio: 'ignore',
  env: { ...process.env, VITE_PREVIEW_BUILD: 'true' }
})
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(previewUrl)
      if (response.ok) { ready = true; break }
    } catch {}
    await delay(500)
  }
  assert.equal(ready, true, 'Vite preview server must become available')

  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const pageResponse = await page.goto(previewUrl)
  const launcherCards = page.locator('.module-launcher-card')
  await launcherCards.first().waitFor({ state: 'visible' })
  assert.equal(await launcherCards.count(), 12, 'dashboard must expose all twelve launcher cards')
  const desktopColumns = await page.locator('.module-launcher-grid').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  assert.equal(desktopColumns, 4, 'desktop launcher must use four columns')
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileColumns = await page.locator('.module-launcher-grid').first().evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)
  assert.equal(mobileColumns, 2, 'phone launcher must use two columns')
  await page.setViewportSize({ width: 1280, height: 900 })
  await delay(1200)
  console.log('Pishran UI smoke diagnostic:', JSON.stringify({ url: page.url(), status: pageResponse?.status(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0, 1200), pageErrors }))
  // Isolate file-download validation in a fresh browser page so a download or
  // browser-specific save flow cannot interrupt the long 12-module navigation test.
  const exportPage = await browser.newPage()
  await exportPage.goto(previewUrl)
  const exportModuleCard = exportPage.locator('.module-launcher-card').filter({ hasText: 'مدیریت انرژی' })
  await exportModuleCard.waitFor({ state: 'visible' })
  await exportModuleCard.click()
  await exportPage.locator('[data-module-export-root]').waitFor({ state: 'visible' })
  assert.equal(await exportPage.locator('[data-module-export-root] .module-id').innerText(), 'MOD-05', 'menu item must navigate to the selected module')
  const excelDownloadPromise = exportPage.waitForEvent('download', { timeout: 20000 })
  await exportPage.getByRole('button', { name: 'خروجی Excel' }).click()
  const excelDownload = await excelDownloadPromise
  assert.match(excelDownload.suggestedFilename(), /\.xlsx$/, 'module Excel export must download an XLSX workbook')
  await exportPage.evaluate(() => { window.print = () => { document.documentElement.dataset.pishranPrintCalled = 'true' } })
  await exportPage.getByRole('button', { name: 'چاپ / ذخیره PDF' }).click()
  assert.equal(await exportPage.locator('html').getAttribute('data-pishran-print-called'), 'true', 'PDF action must open the browser print/save flow')
  if (!exportPage.isClosed()) await exportPage.close()
  console.log('PASS: dashboard module-card navigation and XLSX/PDF export controls')

  const rankingPage = await browser.newPage()
  const rankingErrors = []
  rankingPage.on('pageerror', error => rankingErrors.push(error.message))
  await rankingPage.goto(previewUrl)
  const rankingLauncher = rankingPage.locator('.module-launcher-card').filter({ hasText: 'MOD-10' })
  await rankingLauncher.waitFor({ state: 'visible' })
  await rankingLauncher.click()
  await rankingPage.locator('[data-module-export-root] .module-id').filter({ hasText: 'MOD-10' }).waitFor()
  await rankingPage.getByLabel('نام پروژه رتبه‌بندی جدید').fill('پروژه آزمون IndexedDB')
  await rankingPage.getByRole('button', { name: 'ایجاد پروژه' }).click()
  await rankingPage.getByRole('heading', { name: 'وزن‌دهی و رتبه‌بندی چندمعیاره' }).waitFor()
  await rankingPage.getByRole('heading', { name: 'روش‌های انجام' }).waitFor()
  const initialCategory = rankingPage.getByTestId('ranking-category-initial')
  const advancedCategory = rankingPage.getByTestId('ranking-category-advanced')
  assert.equal(await initialCategory.getAttribute('aria-pressed'), 'true', 'initial methods must be selected by default')
  await rankingPage.getByRole('heading', { name: 'WSM · مجموع وزنی (روش اولیه)' }).waitFor()
  await rankingPage.getByRole('heading', { name: /پروژه آزمون IndexedDB · محیط رتبه‌بندی/ }).waitFor()
  await rankingPage.getByPlaceholder('مثلاً NPV، ریسک اجرا، زمان تحویل').fill('هزینه')
  await rankingPage.getByRole('button', { name: 'افزودن معیار' }).click()
  await rankingPage.getByPlaceholder('نام گزینه یا پروژه را وارد کنید').fill('گزینه الف')
  await rankingPage.getByRole('button', { name: 'افزودن گزینه' }).click()
  await rankingPage.getByPlaceholder('نام گزینه یا پروژه را وارد کنید').fill('گزینه ب')
  await rankingPage.getByRole('button', { name: 'افزودن گزینه' }).click()
  await rankingPage.getByLabel('امتیاز هزینه برای گزینه الف').fill('80')
  await rankingPage.getByLabel('امتیاز هزینه برای گزینه ب').fill('60')
  await rankingPage.getByText('روی این دستگاه ذخیره شد').waitFor()
  await rankingPage.getByRole('heading', { name: 'رتبه‌بندی با روش مجموع وزنی (WSM)' }).waitFor()
  await rankingPage.reload()
  const rankingLauncherAfterReload = rankingPage.locator('.module-launcher-card').filter({ hasText: 'MOD-10' })
  await rankingLauncherAfterReload.waitFor({ state: 'visible' })
  await rankingLauncherAfterReload.click()
  await rankingPage.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمون IndexedDB' }).click()
  await rankingPage.getByLabel('امتیاز هزینه برای گزینه الف').waitFor()
  assert.equal(await rankingPage.getByLabel('امتیاز هزینه برای گزینه الف').inputValue(), '80',
    'WSM draft and scores must persist after a public-app reload')
  await rankingPage.getByRole('button', { name: 'Switch to English' }).click()
  await rankingPage.getByRole('heading', { name: 'Multi-criteria weighting & ranking' }).waitFor()
  await rankingPage.getByRole('button', { name: 'Initial methods' }).waitFor()
  await rankingPage.getByRole('heading', { name: 'پروژه آزمون IndexedDB · ranking workspace' }).waitFor()
  await advancedCategory.click()
  await rankingPage.getByRole('heading', { name: 'Advanced multi-criteria methods' }).waitFor()
  for (const methodName of ['AHP', 'BWM', 'TOPSIS', 'AHP + TOPSIS']) {
    await rankingPage.getByRole('button', { name: methodName, exact: true }).click()
    if (methodName === 'AHP') await rankingPage.getByText('Saaty 1–9 scale; reciprocal entries are automatic.').waitFor()
    if (methodName === 'BWM') await rankingPage.getByText('Best criterion').waitFor()
    if (methodName === 'TOPSIS') await rankingPage.getByText('Manual criterion weights').waitFor()
    if (methodName === 'AHP + TOPSIS') await rankingPage.getByText('Alternative performance matrix').waitFor()
  }
  await rankingPage.getByRole('button', { name: 'Calculate and save version' }).click()
  await rankingPage.getByText('Calculation version saved').waitFor()
  await rankingPage.getByText('Calculation history (1)').waitFor()
  await rankingPage.reload()
  const rankingLauncherEnglish = rankingPage.locator('.module-launcher-card').filter({ hasText: 'MOD-10' })
  await rankingLauncherEnglish.waitFor({ state: 'visible' })
  await rankingLauncherEnglish.click()
  await rankingPage.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمون IndexedDB' }).click()
  await rankingPage.getByTestId('ranking-category-advanced').click()
  await rankingPage.getByText('Calculation history (1)').waitFor()
  assert.deepEqual(rankingErrors, [], 'ranking method selection and storage must not produce browser runtime errors')
  await rankingPage.close()
  console.log('PASS: MOD-10 initial/advanced categories, WSM/AHP/BWM/TOPSIS/AHP+TOPSIS interaction, Persian/English labels and persisted ranking data')

  const firstModuleCard = page.locator('.module-launcher-card').filter({ hasText: 'MOD-01' })
  await firstModuleCard.waitFor({ state: 'visible' })
  await firstModuleCard.click()
  await page.waitForFunction(() => document.querySelector('[data-module-export-root] .module-id')?.textContent?.trim() === 'MOD-01')
  assert.equal(await page.locator('[data-module-export-root] .module-id').innerText(), 'MOD-01',
    'MOD-01 workspace must open from its dashboard card')
  assert.equal(await page.locator('.module-continue-actions button').count(), 0,
    'the removed Continue button must not be rendered at the bottom of module workspaces')
  assert.equal(await page.getByRole('button', { name: 'ادامه بده' }).count(), 0,
    'no visible Continue button may remain in the module workspace')
  assert.deepEqual(pageErrors, [], 'module workspace must not produce browser runtime errors')
  console.log('PASS: MOD-01 workspace opens and the removed Continue button stays absent')

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
