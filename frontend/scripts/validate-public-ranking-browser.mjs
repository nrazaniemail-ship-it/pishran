import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as XLSX from 'xlsx'
import { chromium } from 'playwright'

function activeExportRoot(page) {
  return page.locator('[data-module-export-root="true"]').filter({ has: page.locator('.module-export-actions') }).last()
}
async function verifyExcelExport(page, buttonName, expectedProject, excludedProject) {
  const root = activeExportRoot(page)
  await root.waitFor({ state: 'visible' })
  assert.equal(await root.locator('.module-export-actions').getAttribute('data-export-scope'), 'project', 'Excel export control must declare project-scoped output')
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await root.locator('.module-export-actions').getByRole('button', { name: buttonName, exact: true }).click()
  const download = await downloadPromise
  const filePath = await download.path()
  assert.ok(filePath, 'Excel export must create a downloadable file')
  const workbook = XLSX.read(await readFile(filePath))
  assert.ok(workbook.SheetNames.length > 0, 'Excel export must contain at least one worksheet')
  const content = workbook.SheetNames.map(name => XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false }).flat().map(value => String(value).normalize('NFC')).join('\\n')).join('\\n')
  const moduleId = await root.locator('.module-export-actions').getAttribute('data-export-module-id')
  const projectId = await root.getAttribute('data-project-export-id')
  assert.ok(moduleId && projectId && moduleId.endsWith(projectId), `Export controls must belong to the active project root: module=${moduleId}, project=${projectId}`)
  const workbookIdentity = value => value.normalize('NFKC').replace(/[\\s_\\-\\u200c\\u200d\\u200e\\u200f\\u0640]+/g, '').toLocaleLowerCase()
  assert.ok(workbookIdentity(content).includes(workbookIdentity(expectedProject)), `Excel workbook must identify the active project ${expectedProject}; workbook content: ${content.slice(0, 1800)}`)
  const filenameIdentity = value => value.normalize('NFKC').replace(/[\s_\-\u200c\u200d\u200e\u200f\u0640]+/g, '').toLocaleLowerCase()
  // The export slug intentionally omits the trailing edit-state suffix from long project names.
  const expectedFilenameProject = expectedProject.replace(/\s+ویرایش‌شده$/u, '')
  assert.ok(filenameIdentity(download.suggestedFilename()).includes(filenameIdentity(expectedFilenameProject)), `Excel filename must identify the active project ${expectedFilenameProject}; filename: ${download.suggestedFilename()}`)
  assert.ok(!content.includes(excludedProject.normalize('NFC')), `Excel export must not leak another project: ${excludedProject}`)
}
async function verifyPdfScope(page, buttonName) {
  const root = activeExportRoot(page)
  await root.waitFor({ state: 'visible' })
  assert.equal(await root.locator('.module-export-actions').getAttribute('data-export-scope'), 'project', 'PDF export control must declare project-scoped output')
  await page.evaluate(() => { window.__pishranPrintCalls = 0; window.print = () => { window.__pishranPrintCalls += 1 } })
  await root.locator('.module-export-actions').getByRole('button', { name: buttonName, exact: true }).click()
  assert.equal(await page.evaluate(() => window.__pishranPrintCalls), 1, 'PDF action must invoke the browser print dialog')
  assert.ok(await root.evaluate(element => element.classList.contains('module-export-print-target')), 'PDF action must scope printing to the active project root')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  assert.equal(await root.evaluate(element => element.classList.contains('module-export-print-target')), false, 'PDF print scope must be cleaned up after printing')
}

const site = new URL(`?deploy=${process.env.GITHUB_SHA ?? 'latest'}`, 'https://nrazaniemail-ship-it.github.io/pishran/').toString()
const response = await fetch(site, { redirect: 'follow' })
assert.equal(response.ok, true, 'public PWA homepage must respond successfully')
const html = await response.text()
assert.match(html, /<title>پیشران \| امکان‌سنجی هوشمند<\/title>/, 'public homepage title must be present')
const scriptPaths = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1])
assert.ok(scriptPaths.length > 0, 'public homepage must reference a versioned JavaScript bundle')
const bundles = await Promise.all(scriptPaths.map(async path => {
  const asset = await fetch(new URL(path, site))
  assert.equal(asset.ok, true, `published bundle ${path} must respond`)
  return asset.text()
}))
const bundle = bundles.join('\\n')
for (const marker of ['Initial methods', 'Advanced methods', 'روش‌های اولیه', 'روش‌های پیشرفته', 'AHP + TOPSIS']) {
  assert.ok(bundle.includes(marker), `published JavaScript must contain deployed ranking marker: ${marker}`)
}

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({ acceptDownloads: true })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const live = await page.goto(site, { waitUntil: 'domcontentloaded' })
  assert.equal(live?.status(), 200, 'public PWA must load with HTTP 200')
  const moduleCard = page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' })
  await moduleCard.waitFor({ state: 'visible' })
  await moduleCard.click()
  await page.waitForFunction(() => {
    const input = document.querySelector('#ranking-project-new-name')
    return input && !input.disabled
  })
  await page.getByLabel('نام پروژه رتبه‌بندی جدید').fill('پروژه آزمایش رتبه‌بندی')
  await page.getByRole('button', { name: 'ایجاد پروژه' }).click()
  await page.getByLabel('نام پروژه').fill('پروژه آزمایش رتبه‌بندی ویرایش‌شده')
  await page.getByRole('button', { name: 'ذخیره نام' }).click()
  await page.waitForFunction(async ({ key, expectedName, moduleId }) => {
    let indexedDbProjects = null
    try {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('pishran_store')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      })
      if (db) {
        try {
          if (db.objectStoreNames.contains('kv')) {
            const record = await new Promise((resolve, reject) => {
              const request = db.transaction('kv', 'readonly').objectStore('kv').get(key)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            indexedDbProjects = Array.isArray(record?.value) ? record.value : null
          }
        } finally {
          db.close()
        }
      }
    } catch { /* Use the supported localStorage fallback below. */ }
    let fallbackProjects = null
    try {
      const fallback = JSON.parse(localStorage.getItem('pishran_' + key) ?? 'null')
      fallbackProjects = Array.isArray(fallback) ? fallback : null
    } catch { /* Ignore unavailable fallback storage. */ }
    const matches = item => item.name === expectedName && (moduleId === undefined || item.moduleId === moduleId)
    return Boolean(indexedDbProjects?.some(matches) && fallbackProjects?.some(matches))
  }, { key: 'mod10-ranking-projects:v1', expectedName: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده', moduleId: undefined }, { timeout: 10000 })
  await activeExportRoot(page).waitFor({ state: 'visible' })
  await verifyExcelExport(page, 'خروجی Excel', 'پروژه آزمایش رتبه‌بندی ویرایش‌شده', 'پروژه دوم مستقل')
  await verifyPdfScope(page, 'چاپ / ذخیره PDF')
  await page.getByRole('button', { name: 'بازگشت به پروژه‌های رتبه‌بندی' }).click()
  await page.getByRole('heading', { name: 'پروژه‌های رتبه‌بندی' }).waitFor()
  await page.getByLabel('نام پروژه رتبه‌بندی جدید').fill('پروژه دوم مستقل')
  await page.getByRole('button', { name: 'ایجاد پروژه' }).click()
  await page.getByLabel('نام پروژه').waitFor()
  await verifyExcelExport(page, 'خروجی Excel', 'پروژه دوم مستقل', 'پروژه آزمایش رتبه‌بندی ویرایش‌شده')
  await verifyPdfScope(page, 'چاپ / ذخیره PDF')
  await page.getByRole('button', { name: 'بازگشت به پروژه‌های رتبه‌بندی' }).click()
  await page.getByRole('heading', { name: 'پروژه‌های رتبه‌بندی' }).waitFor()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  await verifyExcelExport(page, 'خروجی Excel', 'پروژه آزمایش رتبه‌بندی ویرایش‌شده', 'پروژه دوم مستقل')
  await verifyPdfScope(page, 'چاپ / ذخیره PDF')
  await page.getByRole('button', { name: 'بازگشت به پروژه‌های رتبه‌بندی' }).click()
  await page.getByRole('heading', { name: 'پروژه‌های رتبه‌بندی' }).waitFor()
  const beforeReloadStorage = await page.evaluate(async () => {
    const db = await new Promise(resolve => {
      const request = indexedDB.open('pishran_store')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    })
    let indexedDbProjects = null
    if (db) {
      try {
        indexedDbProjects = await new Promise(resolve => {
          const request = db.transaction('kv', 'readonly').objectStore('kv').get('mod10-ranking-projects:v1')
          request.onsuccess = () => resolve(request.result?.value ?? null)
          request.onerror = () => resolve(null)
        })
      } finally { db.close() }
    }
    let localStorageProjects = null
    try { localStorageProjects = JSON.parse(localStorage.getItem('pishran_mod10-ranking-projects:v1') ?? 'null') } catch {}
    return { indexedDbProjects, localStorageProjects }
  })
  console.log('Ranking project storage before full reload:', JSON.stringify(beforeReloadStorage))
  // Re-mount the app to verify the renamed project is recovered from IndexedDB or its fallback.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  await page.getByRole('heading', { name: 'پروژه‌های رتبه‌بندی' }).waitFor()
  // The list heading renders before its asynchronous IndexedDB read completes.
  // Wait for the create control to become enabled before asserting restored cards.
  await page.waitForFunction(() => {
    const input = document.querySelector('#ranking-project-new-name')
    return input && !input.disabled
  }, null, { timeout: 15000 })
  const restoredRankingProjects = await page.evaluate(async () => {
    let indexedDbProjects = null
    try {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('pishran_store')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      })
      if (db) {
        try {
          if (db.objectStoreNames.contains('kv')) {
            indexedDbProjects = await new Promise(resolve => {
              const request = db.transaction('kv', 'readonly').objectStore('kv').get('mod10-ranking-projects:v1')
              request.onsuccess = () => resolve(request.result?.value ?? null)
              request.onerror = () => resolve(null)
            })
          }
        } finally { db.close() }
      }
    } catch { /* localStorage is the supported fallback when IndexedDB is unavailable */ }
    let localStorageProjects = null
    try { localStorageProjects = JSON.parse(localStorage.getItem('pishran_mod10-ranking-projects:v1') ?? 'null') } catch { /* unavailable */ }
    return { indexedDbProjects, localStorageProjects }
  })
  const hasRestoredProject = [restoredRankingProjects.indexedDbProjects, restoredRankingProjects.localStorageProjects]
    .some(items => Array.isArray(items) && items.some(project => project.name === 'پروژه آزمایش رتبه‌بندی ویرایش‌شده'))
  console.log('Ranking project storage after full reload:', JSON.stringify(restoredRankingProjects))
  assert.ok(hasRestoredProject,
    'renamed ranking project must be recoverable from IndexedDB or the supported localStorage fallback after a full page reload; storage=' + JSON.stringify(restoredRankingProjects))
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).waitFor()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  await page.goBack()
  await page.getByRole('heading', { name: 'پروژه‌های رتبه‌بندی' }).waitFor()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  await page.getByRole('button', { name: 'گفت‌وگو با دستیار' }).click()
  const answer = page.getByLabel('پاسخ شما')
  await answer.fill('مطمئن نیستم دقیقاً چه نوع تصمیمی است')
  await page.getByRole('button', { name: 'ارسال' }).click()
  await page.getByText(/نوع تصمیم برایم روشن نشد/).waitFor()
  await page.getByRole('button', { name: 'انتخاب سرمایه‌گذاری' }).click()
  await answer.fill('طرح الف، طرح ب')
  await page.getByRole('button', { name: 'ارسال' }).click()
  await page.getByRole('button', { name: 'داده عددی' }).click()
  await page.getByRole('button', { name: 'وزن‌ها مشخص است' }).click()
  await page.getByRole('button', { name: 'یک تصمیم‌گیرنده' }).click()
  await page.getByRole('button', { name: 'معیارها مستقل‌اند' }).click()
  await page.getByRole('button', { name: 'عدم‌قطعیت کم' }).click()
  await page.getByRole('heading', { name: 'روش پیشنهادی: WSM' }).waitFor()
  await page.getByLabel('معیارهای پیشنهادی (هر معیار در یک خط؛ قابل ویرایش)').waitFor()
  await page.getByRole('button', { name: 'تأیید و ورود به فرم دستی رتبه‌بندی' }).click()
  await page.getByTestId('ranking-category-initial').waitFor()
  assert.equal(await page.getByTestId('ranking-category-initial').getAttribute('aria-pressed'), 'true',
    'conversational manual setup must open the basic ranking form')
  assert.equal(await page.getByRole('button', { name: /خودکار|automatic/i }).count(), 0,
    'ranking advisor must not expose automatic data import')
  await page.getByTestId('ranking-category-initial').click()
  const suggestedOptionDeletes = page.getByRole('button', { name: /^حذف گزینه/ })
  while (await suggestedOptionDeletes.count()) await suggestedOptionDeletes.first().click()
  for (const name of ['ارزش فعلی خالص (NPV)', 'سرمایه‌گذاری ثابت (CAPEX)', 'هزینه بهره‌برداری (OPEX)', 'ریسک اجرا', 'زمان اجرا', 'ظرفیت یا خروجی']) {
    await page.getByRole('button', { name: 'حذف معیار ' + name }).click()
  }
  assert.equal(await page.getByTestId('ranking-category-initial').getAttribute('aria-pressed'), 'true')
  assert.ok((await page.getByTestId('ranking-category-initial').getAttribute('class'))?.includes('is-active'),
    'initial category tab must expose its modern active style')
  await page.getByRole('heading', { name: /پروژه آزمایش رتبه‌بندی ویرایش‌شده · محیط رتبه‌بندی/ }).waitFor()

  await page.getByPlaceholder('مثلاً NPV، ریسک اجرا، زمان تحویل').fill('معیار حذف آزمایشی')
  await page.getByRole('button', { name: 'افزودن معیار' }).click()
  await page.getByRole('button', { name: 'حذف معیار معیار حذف آزمایشی' }).click()
  assert.equal(await page.getByText('معیار حذف آزمایشی').count(), 0, 'WSM criterion deletion must remove the criterion')
  await page.getByPlaceholder('مثلاً NPV، ریسک اجرا، زمان تحویل').fill('هزینه آزمون زنده')
  await page.getByRole('button', { name: 'افزودن معیار' }).click()
  await page.getByPlaceholder('نام گزینه یا پروژه را وارد کنید').fill('گزینه حذف آزمایشی')
  await page.getByRole('button', { name: 'افزودن گزینه' }).click()
  await page.getByRole('button', { name: 'حذف گزینه گزینه حذف آزمایشی' }).click()
  assert.equal(await page.getByText('گزینه حذف آزمایشی').count(), 0, 'WSM alternative deletion must remove the alternative')
  await page.getByPlaceholder('نام گزینه یا پروژه را وارد کنید').fill('گزینه زنده الف')
  await page.getByRole('button', { name: 'افزودن گزینه' }).click()
  await page.getByPlaceholder('نام گزینه یا پروژه را وارد کنید').fill('گزینه زنده ب')
  await page.getByRole('button', { name: 'افزودن گزینه' }).click()
  await page.getByLabel('امتیاز هزینه آزمون زنده برای گزینه زنده الف').fill('90')
  await page.getByLabel('امتیاز هزینه آزمون زنده برای گزینه زنده ب').fill('70')
  await page.getByRole('heading', { name: 'رتبه‌بندی با روش مجموع وزنی (WSM)' }).waitFor()
  await page.waitForTimeout(500)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  assert.equal(await page.getByLabel('امتیاز هزینه آزمون زنده برای گزینه زنده الف').inputValue(), '90',
    'public WSM data must persist after reload')

  await page.getByRole('button', { name: 'Switch to English' }).click()
  await page.getByTestId('ranking-category-advanced').click()
  assert.ok((await page.getByTestId('ranking-category-advanced').getAttribute('class'))?.includes('is-active'),
    'advanced category tab must expose its modern active style')
  for (const method of ['TOPSIS', 'AHP + TOPSIS', 'BWM + TOPSIS', 'TOPSIS + (AHP + BWM)']) {
    const methodKey = method === 'AHP + TOPSIS' ? 'AHP+TOPSIS' : method === 'BWM + TOPSIS' ? 'BWM+TOPSIS' : method === 'TOPSIS + (AHP + BWM)' ? 'TOPSIS+(AHP+BWM)' : method
    await page.getByRole('button', { name: method, exact: true }).click()
    assert.equal(await page.locator(`.ranking-method-tab[data-method="${methodKey}"]`).getAttribute('aria-pressed'), 'true',
      `${method} tab must expose the selected state`)
    assert.ok((await page.locator(`.ranking-method-tab[data-method="${methodKey}"]`).getAttribute('class'))?.includes('is-active'),
      `${method} tab must expose its modern active style`)
    if (method === 'AHP + TOPSIS') {
      await page.getByText('Saaty 1–9 scale; reciprocal entries are automatic.').waitFor()
      await page.getByLabel(/هزینه سرمایه‌گذاری vs ریسک اجرا$/).selectOption('2')
      await page.getByLabel(/هزینه سرمایه‌گذاری vs زمان اجرا$/).selectOption('4')
      await page.getByLabel(/ریسک اجرا vs زمان اجرا$/).selectOption('2')
      await page.waitForTimeout(350)
      await page.getByRole('button', { name: 'Calculate and save version' }).click()
      await page.getByText('Calculation version saved').waitFor()
    }
    if (method === 'BWM + TOPSIS') {
      await page.getByRole('button', { name: 'Add criterion' }).click()
      await page.getByRole('button', { name: 'Remove criterion Criterion 4' }).click()
      await page.getByRole('button', { name: 'Add alternative' }).click()
      await page.getByRole('button', { name: 'Remove alternative Alternative 4' }).click()
      const performanceInputs = page.locator('.ranking-performance-matrix input[type="number"]')
      for (let i = 0; i < await performanceInputs.count(); i++) await performanceInputs.nth(i).fill(String((i % 3) + 1))
      await page.getByText('Best criterion').waitFor()
      await page.locator('select[aria-label*="best criterion"]').selectOption('1')
      await page.getByLabel('Expert 1 worst criterion').selectOption('0')
      await page.getByLabel('Best over هزینه سرمایه‌گذاری').selectOption('5')
      await page.getByLabel('Best over زمان اجرا').selectOption('3')
      await page.getByLabel('Other over worst ریسک اجرا').selectOption('4')
      await page.getByLabel('Other over worst زمان اجرا').selectOption('2')
      await page.getByRole('button', { name: 'Calculate and save version' }).click()
      await page.getByText('Calculation version saved').waitFor()
      const methodHistoryAfterBwm = await page.evaluate(async () => {
        const db = await new Promise(resolve => {
          const request = indexedDB.open('pishran_store')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
        })
        let indexedDbHistory = null
        if (db) {
          try {
            indexedDbHistory = await new Promise(resolve => {
              const request = db.transaction('kv', 'readonly').objectStore('kv').getAll()
              request.onsuccess = () => resolve(request.result?.find(record => record.key.startsWith('mod10-ranking-method-history:'))?.value ?? null)
              request.onerror = () => resolve(null)
            })
          } finally { db.close() }
        }
        let fallbackHistory = null
        try { const key = Object.keys(localStorage).find(name => name.startsWith('pishran_mod10-ranking-method-history:')); fallbackHistory = key ? JSON.parse(localStorage.getItem(key) ?? 'null') : null } catch {}
        return { indexedDbHistory, fallbackHistory }
      })
      console.log('Method history after BWM calculation:', JSON.stringify(methodHistoryAfterBwm))
      await page.getByText('Calculation history (3)').waitFor()
      await page.getByRole('button', { name: 'Run rank sensitivity' }).click()
      await page.getByTestId('ranking-sensitivity-results').waitFor()
      await page.getByText('Sensitivity history (1)').waitFor()
      await page.getByText(/Deterministic Monte Carlo: 500 trials/).waitFor()
      await page.getByRole('columnheader', { name: 'Monte Carlo top probability' }).waitFor()
      await page.getByText('Expert agreement & disagreement').waitFor()
      await page.getByText('Scenario comparison').click()
      await page.getByText(/optimistic/).last().waitFor()
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
      await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
      await page.getByTestId('ranking-category-advanced').click()
      await page.getByRole('button', { name: 'BWM + TOPSIS', exact: true }).click()
      await page.getByText('Sensitivity history (1)').waitFor()
      await page.locator('.ranking-sensitivity-history-entry').first().locator('summary').click()
      await page.getByText('Persisted Monte Carlo robustness and rank acceptability').waitFor()
      await page.getByRole('columnheader', { name: 'Top probability' }).waitFor()
    }
    if (method === 'TOPSIS') {
      await page.getByText('Manual criterion weights').waitFor()
      await page.getByLabel('هزینه سرمایه‌گذاری manual weight').fill('7')
      await page.getByLabel('ریسک اجرا manual weight').fill('2')
      await page.getByLabel('زمان اجرا manual weight').fill('1')
      await page.getByRole('button', { name: 'Calculate and save version' }).click()
      await page.getByText('Calculation version saved').waitFor()
    }
    if (method === 'TOPSIS + (AHP + BWM)') {
      const ahpShare = page.getByLabel('AHP contribution percentage')
      await ahpShare.focus()
      await ahpShare.press('Home')
      for (let step = 0; step < 14; step++) await ahpShare.press('ArrowRight')
      assert.equal(await ahpShare.inputValue(), '70', 'hybrid AHP contribution must be adjustable through real keyboard interaction')
      assert.equal(await page.getByLabel('BWM contribution percentage').inputValue(), '30', 'hybrid BWM contribution must remain complementary')
      await page.getByLabel('BWM best criterion').selectOption('1')
      await page.getByLabel('BWM worst criterion').selectOption('0')
      await page.getByLabel('BWM best over هزینه سرمایه‌گذاری').selectOption('5')
      await page.getByLabel('BWM best over زمان اجرا').selectOption('3')
      await page.getByLabel('BWM other over worst ریسک اجرا').selectOption('4')
      await page.getByLabel('BWM other over worst زمان اجرا').selectOption('2')
    }
    if (method === 'AHP + TOPSIS' || method === 'TOPSIS + (AHP + BWM)') {
      await page.getByText('Alternative performance matrix').waitFor()
      const matrixCells = [
        ['گزینه الف', 'هزینه سرمایه‌گذاری'], ['گزینه الف', 'ریسک اجرا'], ['گزینه الف', 'زمان اجرا'],
        ['گزینه ب', 'هزینه سرمایه‌گذاری'], ['گزینه ب', 'ریسک اجرا'], ['گزینه ب', 'زمان اجرا'],
        ['گزینه ج', 'هزینه سرمایه‌گذاری'], ['گزینه ج', 'ریسک اجرا'], ['گزینه ج', 'زمان اجرا']
      ]
      for (let i = 0; i < matrixCells.length; i++) {
        const [alternative, criterion] = matrixCells[i]
        await page.getByLabel(`${alternative}, ${criterion} score`).fill(String(81 + i))
      }
    }
  }
  await page.getByRole('button', { name: 'Calculate and save version' }).click()
  await page.getByText('Calculation version saved').waitFor()
  await page.getByText('Calculation history (4)').waitFor()
  await page.waitForTimeout(600)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  await page.getByTestId('ranking-category-advanced').click()
  await page.getByText('Calculation history (4)').waitFor()
  await page.getByRole('button', { name: 'AHP + TOPSIS', exact: true }).click()
  assert.equal(await page.getByLabel(/هزینه سرمایه‌گذاری vs ریسک اجرا$/).inputValue(), '2',
    'AHP first pairwise judgment must persist after reload')
  assert.equal(await page.getByLabel(/هزینه سرمایه‌گذاری vs زمان اجرا$/).inputValue(), '4',
    'AHP second pairwise judgment must persist after reload')
  assert.equal(await page.getByLabel(/ریسک اجرا vs زمان اجرا$/).inputValue(), '2',
    'AHP third pairwise judgment must persist after reload')
  await page.getByRole('button', { name: 'BWM + TOPSIS', exact: true }).click()
  assert.equal(await page.locator('select[aria-label*="best criterion"]').inputValue(), '1',
    'BWM best-criterion anchor must persist after reload')
  assert.equal(await page.getByLabel('Best over هزینه سرمایه‌گذاری').inputValue(), '5',
    'BWM first best-to-others judgment must persist after reload')
  assert.equal(await page.getByLabel('Best over زمان اجرا').inputValue(), '3',
    'BWM second best-to-others judgment must persist after reload')
  assert.equal(await page.getByLabel('Other over worst ریسک اجرا').inputValue(), '4',
    'BWM first others-to-worst judgment must persist after reload')
  assert.equal(await page.getByLabel('Other over worst زمان اجرا').inputValue(), '2',
    'BWM second others-to-worst judgment must persist after reload')
  await page.getByRole('button', { name: 'TOPSIS', exact: true }).click()
  assert.equal(await page.getByLabel('هزینه سرمایه‌گذاری manual weight').inputValue(), '7',
    'TOPSIS cost weight must persist after reload')
  assert.equal(await page.getByLabel('ریسک اجرا manual weight').inputValue(), '2',
    'TOPSIS risk weight must persist after reload')
  assert.equal(await page.getByLabel('زمان اجرا manual weight').inputValue(), '1',
    'TOPSIS time weight must persist after reload')
  await page.getByRole('button', { name: 'AHP + TOPSIS', exact: true }).click()
  const persistedMatrix = [
    ['گزینه الف', 'هزینه سرمایه‌گذاری'], ['گزینه الف', 'ریسک اجرا'], ['گزینه الف', 'زمان اجرا'],
    ['گزینه ب', 'هزینه سرمایه‌گذاری'], ['گزینه ب', 'ریسک اجرا'], ['گزینه ب', 'زمان اجرا'],
    ['گزینه ج', 'هزینه سرمایه‌گذاری'], ['گزینه ج', 'ریسک اجرا'], ['گزینه ج', 'زمان اجرا']
  ]
  for (let i = 0; i < persistedMatrix.length; i++) {
    const [alternative, criterion] = persistedMatrix[i]
    assert.equal(await page.getByLabel(`${alternative}, ${criterion} score`).inputValue(), String(81 + i),
      `AHP + TOPSIS performance matrix cell ${i + 1} must persist after reload`)
  }

  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.getByLabel('New ranking project name').fill('پروژه دوم مستقل')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByPlaceholder('e.g. NPV, implementation risk, delivery time').fill('معیار اختصاصی پروژه دوم')
  await page.getByRole('button', { name: 'Add criterion' }).click()
  await page.getByPlaceholder('Enter an option or project name').fill('گزینه اختصاصی دوم')
  await page.getByRole('button', { name: 'Add option' }).click()
  await page.getByLabel('گزینه اختصاصی دوم, معیار اختصاصی پروژه دوم score').fill('42')
  await verifyExcelExport(page, 'Export Excel', 'پروژه دوم مستقل', 'پروژه آزمایش رتبه‌بندی ویرایش‌شده')
  await verifyPdfScope(page, 'Print / Save PDF')
  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  assert.equal(await page.getByText('معیار اختصاصی پروژه دوم').count(), 0,
    'second-project criteria must not leak into the first project')
  assert.equal(await page.getByLabel('گزینه زنده الف, هزینه آزمون زنده score').inputValue(), '90',
    'first-project WSM scores must remain unchanged after editing a second project')

  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه دوم مستقل' }).first().click()
  assert.equal(await page.getByLabel('گزینه اختصاصی دوم, معیار اختصاصی پروژه دوم score').inputValue(), '42',
    'second-project WSM scores must persist independently')
  await page.getByTestId('ranking-category-advanced').click()
  await page.getByRole('button', { name: 'TOPSIS', exact: true }).click()
  await page.getByLabel('هزینه سرمایه‌گذاری manual weight').fill('1')
  await page.getByLabel('ریسک اجرا manual weight').fill('8')
  await page.getByLabel('زمان اجرا manual weight').fill('1')
  await page.getByRole('button', { name: 'Calculate and save version' }).click()
  await page.getByText('Calculation history (1)').waitFor()
  await page.getByRole('button', { name: 'Run rank sensitivity' }).click()
  await page.getByText('Sensitivity history (1)').waitFor()
  await page.waitForTimeout(600)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه دوم مستقل' }).first().click()
  assert.equal(await page.getByLabel('گزینه اختصاصی دوم, معیار اختصاصی پروژه دوم score').inputValue(), '42',
    'second-project WSM score must survive reload before opening advanced methods')
  await page.getByTestId('ranking-category-advanced').click()
  await page.getByText('Calculation history (1)').waitFor()
  await page.getByText('Sensitivity history (1)').waitFor()
  await page.getByRole('button', { name: 'TOPSIS', exact: true }).click()
  assert.equal(await page.getByLabel('هزینه سرمایه‌گذاری manual weight').inputValue(), '1',
    'second-project TOPSIS cost weight must persist independently after reload')
  assert.equal(await page.getByLabel('ریسک اجرا manual weight').inputValue(), '8',
    'second-project TOPSIS risk weight must persist independently after reload')
  assert.equal(await page.getByLabel('زمان اجرا manual weight').inputValue(), '1',
    'second-project TOPSIS time weight must persist independently after reload')
  await page.getByText('Calculation history (1)').waitFor()
  await page.getByText('Sensitivity history (1)').waitFor()
  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).first().click()
  await page.getByTestId('ranking-category-advanced').click()
  await page.getByRole('button', { name: 'TOPSIS', exact: true }).click()
  assert.equal(await page.getByLabel('هزینه سرمایه‌گذاری manual weight').inputValue(), '7',
    'first-project advanced inputs must remain isolated from the second project')
  await page.getByText('Calculation history (4)').waitFor()
  assert.deepEqual(pageErrors, [], 'public ranking interaction must not generate browser runtime errors')
  assert.ok(bundle.includes('Monte Carlo top probability') || bundle.includes('خلاصه تحلیل حساسیت رتبه‌ها'), 'published bundle must include ranking sensitivity UI')
  // Public regression: module capability tabs, no obsolete bottom continue action,
  // and module workspace create/edit persistence across a full reload.
  await page.getByRole('button', { name: 'Switch to Persian' }).click()
  await page.locator('.brand-title').click()
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  const capabilities = page.locator('details.module-capabilities-card')
  await capabilities.waitFor({ state: 'visible' })
  const capabilitySummary = capabilities.locator('summary')
  assert.equal(await capabilities.evaluate(element => element.open), false,
    'MOD-10 comparative assessment and market position must be collapsed by default')
  await capabilitySummary.click()
  assert.equal(await capabilities.evaluate(element => element.open), true,
    'MOD-10 capability disclosure must expand when its summary is clicked')
  const assessmentTab = page.getByRole('tab', { name: 'ارزیابی تطبیقی' })
  const marketTab = page.getByRole('tab', { name: 'جایگاه بازار' })
  await assessmentTab.waitFor()
  assert.equal(await assessmentTab.getAttribute('aria-selected'), 'true',
    'comparative assessment tab must be selected by default')
  await page.getByRole('tabpanel', { name: 'ارزیابی تطبیقی' }).waitFor()
  await marketTab.click()
  assert.equal(await marketTab.getAttribute('aria-selected'), 'true',
    'market position tab must become selected when clicked')
  await page.getByRole('tabpanel', { name: 'جایگاه بازار' }).waitFor()
  await page.getByRole('heading', { name: 'رقبا و نمونه‌های مرجع بازار' }).waitFor()
  await assessmentTab.click()
  assert.equal(await assessmentTab.getAttribute('aria-selected'), 'true',
    'comparative assessment tab must be selectable again')
  await page.getByRole('tabpanel', { name: 'ارزیابی تطبیقی' }).waitFor()
  await capabilitySummary.click()
  assert.equal(await capabilities.evaluate(element => element.open), false,
    'MOD-10 capability disclosure must collapse when its summary is clicked')
  await assessmentTab.waitFor({ state: 'hidden' })

  await page.locator('.brand-title').click()
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  const modulePage = page.locator('.module-workspace-page')
  const obsoleteContinue = modulePage.getByRole('button', { name: /^(ادامه بده|ادامه|Continue|Continue now)$/i })
  assert.equal(await obsoleteContinue.count(), 0,
    'module workspace must not show the removed bottom continue button')
  await page.getByLabel('نام پروژه جدید ماژول').fill('پروژه آزمون ذخیره ماژول')
  await page.getByRole('button', { name: 'ایجاد پروژه' }).click()
  await modulePage.getByText('پروژه آزمون ذخیره ماژول', { exact: true }).waitFor()
  await page.waitForFunction(async ({ key, expectedName, moduleId }) => {
    const values = []
    try {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('pishran_store')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      })
      if (db) {
        try {
          if (db.objectStoreNames.contains('kv')) {
            const record = await new Promise((resolve, reject) => {
              const request = db.transaction('kv', 'readonly').objectStore('kv').get(key)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            if (Array.isArray(record?.value)) values.push(...record.value)
          }
        } finally {
          db.close()
        }
      }
    } catch { /* Use the supported localStorage fallback below. */ }
    try {
      const fallback = JSON.parse(localStorage.getItem('pishran_' + key) ?? 'null')
      if (Array.isArray(fallback)) values.push(...fallback)
    } catch { /* Ignore unavailable fallback storage. */ }
    return values.some(item => item.name === expectedName && (moduleId === undefined || item.moduleId === moduleId))
  }, { key: 'module-workspaces:v1', expectedName: 'پروژه آزمون ذخیره ماژول', moduleId: 'MOD-02' }, { timeout: 10000 })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ذخیره ماژول', { exact: true }).waitFor()
  const workspaceItem = modulePage.locator('.module-workspace-item').filter({ hasText: 'پروژه آزمون ذخیره ماژول' })
  await workspaceItem.getByRole('button', { name: 'ویرایش پروژه آزمون ذخیره ماژول' }).click()
  const editingWorkspaceForm = modulePage.locator('.module-workspace-edit-form')
  const editingWorkspaceInput = editingWorkspaceForm.locator('input')
  await editingWorkspaceInput.waitFor({ state: 'visible' })
  await editingWorkspaceInput.fill('پروژه آزمون ویرایش و بازیابی')
  assert.equal(await editingWorkspaceForm.evaluate(element => getComputedStyle(element.closest('.module-workspace-item')).backgroundColor), 'rgb(244, 237, 223)',
    'project workspace cards must use the pale beige background')
  await editingWorkspaceForm.getByRole('button', { name: 'ذخیره ویرایش' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ویرایش و بازیابی', { exact: true }).waitFor()
  await page.waitForFunction(async ({ key, expectedName, moduleId }) => {
    const values = []
    try {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('pishran_store')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
        request.onblocked = () => resolve(null)
      })
      if (db) {
        try {
          if (db.objectStoreNames.contains('kv')) {
            const record = await new Promise((resolve, reject) => {
              const request = db.transaction('kv', 'readonly').objectStore('kv').get(key)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            if (Array.isArray(record?.value)) values.push(...record.value)
          }
        } finally {
          db.close()
        }
      }
    } catch { /* Use the supported localStorage fallback below. */ }
    try {
      const fallback = JSON.parse(localStorage.getItem('pishran_' + key) ?? 'null')
      if (Array.isArray(fallback)) values.push(...fallback)
    } catch { /* Ignore unavailable fallback storage. */ }
    return values.some(item => item.name === expectedName && (moduleId === undefined || item.moduleId === moduleId))
  }, { key: 'module-workspaces:v1', expectedName: 'پروژه آزمون ویرایش و بازیابی', moduleId: 'MOD-02' }, { timeout: 10000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ویرایش و بازیابی', { exact: true }).waitFor()
  assert.equal(await page.locator('.module-workspace-page').getByText('پروژه آزمون ذخیره ماژول', { exact: true }).count(), 0,
    'edited module workspace name must replace the old name after recovery')
  assert.equal(await page.locator('.module-workspace-page').getByRole('button', { name: /^(ادامه بده|ادامه|Continue|Continue now)$/i }).count(), 0,
    'obsolete bottom continue action must remain absent after recovery')

  await page.getByRole('navigation').getByRole('button', { name: 'پیشخوان' }).click()
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-10' }).click()
  const rankingAssessment = page.locator('.module-capabilities-disclosure')
  await rankingAssessment.waitFor({ state: 'visible' })
  const rankingAssessmentSummary = rankingAssessment.locator('summary')
  assert.equal(await rankingAssessment.evaluate(element => element.open), false,
    'MOD-10 comparative assessment and market position must start collapsed')
  assert.equal(await rankingAssessmentSummary.innerText(), 'ارزیابی تطبیقی و جایگاه بازار ماژول رتبه بندی',
    'MOD-10 collapsible assessment must show the requested title')
  await rankingAssessmentSummary.click()
  assert.equal(await rankingAssessment.evaluate(element => element.open), true,
    'MOD-10 comparative assessment and market position must expand')
  await page.getByRole('heading', { name: 'ارزیابی تطبیقی و جایگاه بازار ماژول رتبه بندی' }).waitFor()
  await rankingAssessmentSummary.click()
  assert.equal(await rankingAssessment.evaluate(element => element.open), false,
    'MOD-10 comparative assessment and market position must collapse again')

  await page.getByRole('navigation').getByRole('button', { name: 'پروژه‌ها' }).click()
  await page.getByRole('heading', { name: 'پروژه‌های امکان‌سنجی' }).waitFor()
  const publicComfarProjects = [
    { title:'خط نورد گرم کلاف ۲۰۰ هزار تن', capexName:'خرید زمین', capexAmount:'2015000', opexName:'مواد خام', opexAmount:'40901015.18' },
    { title:'خط نورد گرم ورق تخت ۲۵۰ هزار تن', capexName:'خرید زمین', capexAmount:'1000000', opexName:'مواد خام', opexAmount:'38162283.5' },
    { title:'خط نورد سرد کلاف ۲۰۰ هزار تن', capexName:'خرید زمین', capexAmount:'2015000', opexName:'مواد خام', opexAmount:'63058700' },
    { title:'فولادسازی ۱٫۲ میلیون و احیای مستقیم هات‌لینک ۱٫۷۶ میلیون تن', capexName:'محوطه‌سازی و بهبود زمین', capexAmount:'2456550', opexName:'مواد خام', opexAmount:'537485060' },
  ]
  assert.equal(await page.locator('.project-card').count(), 4, 'public PWA must expose the four imported COMFAR feasibility projects')
  for (const item of publicComfarProjects) {
    const card = page.locator('.project-card').filter({ hasText: item.title })
    await card.waitFor({ state: 'visible' })
    await card.click()
    await page.locator('.feasibility-project-export-root').waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'هزینه‌های دوره ساخت' }).click()
    const capexTitles = await page.locator('.fw-row input[aria-label="عنوان قلم"]').evaluateAll(inputs => inputs.map(input => input.value))
    const capexIndex = capexTitles.indexOf(item.capexName)
    assert.notEqual(capexIndex, -1, `${item.title} public CAPEX form must contain its report asset category`)
    assert.equal(await page.locator('.fw-row').nth(capexIndex).getByLabel('قیمت واحد').inputValue(), item.capexAmount)
    await page.getByRole('button', { name: 'هزینه‌های دوره بهره‌برداری' }).click()
    const opexTitles = await page.locator('.fw-row input[aria-label="عنوان قلم"]').evaluateAll(inputs => inputs.map(input => input.value))
    const opexIndex = opexTitles.indexOf(item.opexName)
    assert.notEqual(opexIndex, -1, `${item.title} public OPEX form must contain the report raw-material cost`)
    assert.equal(await page.locator('.fw-row').nth(opexIndex).getByLabel('مقدار').inputValue(), item.opexAmount)
    await page.getByRole('navigation').getByRole('button', { name: 'پروژه‌ها' }).click()
    await page.getByRole('heading', { name: 'پروژه‌های امکان‌سنجی' }).waitFor()
  }
  console.log('PASS: public PWA displays source-derived CAPEX and OPEX forms for all four COMFAR projects')
  await page.getByRole('button', { name: 'پروژه جدید' }).click()
  await page.getByLabel('نوع پروژه').selectOption('نورد ورق گرم- تولید کلاف')
  await page.getByLabel('نام پروژه').fill('پروژه آزمون رنگ کارت')
  await page.getByRole('button', { name: 'ذخیره پروژه' }).click()
  const feasibilityProjectCard = page.locator('.project-card').filter({ hasText: 'پروژه آزمون رنگ کارت' })
  await feasibilityProjectCard.waitFor({ state: 'visible' })
  assert.equal(await feasibilityProjectCard.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(244, 237, 223)',
    'feasibility project cards must use the pale beige background')
  await feasibilityProjectCard.click()
  await page.locator('.feasibility-project-export-root').waitFor({ state: 'visible' })
  await verifyExcelExport(page, 'خروجی Excel', 'پروژه آزمون رنگ کارت', 'پروژه آزمایش رتبه‌بندی ویرایش‌شده')
  await verifyPdfScope(page, 'چاپ / ذخیره PDF')
  console.log('PASS: public PWA per-project Excel/PDF scope for two independent ranking projects and feasibility projects; ranking storage, methods, sensitivity, project cards, MOD-10 assessment and bilingual switching')
} finally {
  await browser.close()
}
