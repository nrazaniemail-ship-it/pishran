import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const site = 'https://nrazaniemail-ship-it.github.io/pishran/'
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
  const context = await browser.newContext()
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
  await page.waitForFunction(async expectedName => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('pishran_store')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const record = await new Promise((resolve, reject) => {
        const request = db.transaction('kv', 'readonly').objectStore('kv').get('mod10-ranking-projects:v1')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return Array.isArray(record?.value) && record.value.some(project => project.name === expectedName)
    } finally {
      db.close()
    }
  }, 'پروژه آزمایش رتبه‌بندی ویرایش‌شده', { timeout: 10000 })
  await page.getByRole('button', { name: 'بازگشت به پروژه‌های رتبه‌بندی' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
  await page.getByRole('heading', { name: 'وزن‌دهی و رتبه‌بندی چندمعیاره' }).waitFor()
  await page.getByRole('heading', { name: 'روش‌های انجام' }).waitFor()
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
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
  assert.equal(await page.getByLabel('امتیاز هزینه آزمون زنده برای گزینه زنده الف').inputValue(), '90',
    'public WSM data must persist after reload')

  await page.getByRole('button', { name: 'Switch to English' }).click()
  await page.getByRole('heading', { name: 'Multi-criteria weighting & ranking' }).waitFor()
  await page.getByTestId('ranking-category-advanced').click()
  assert.ok((await page.getByTestId('ranking-category-advanced').getAttribute('class'))?.includes('is-active'),
    'advanced category tab must expose its modern active style')
  await page.getByRole('heading', { name: 'Advanced multi-criteria methods' }).waitFor()
  for (const method of ['AHP', 'BWM', 'TOPSIS', 'AHP + TOPSIS']) {
    const methodKey = method === 'AHP + TOPSIS' ? 'AHP+TOPSIS' : method
    await page.getByRole('button', { name: method, exact: true }).click()
    assert.equal(await page.locator(`.ranking-method-tab[data-method="${methodKey}"]`).getAttribute('aria-pressed'), 'true',
      `${method} tab must expose the selected state`)
    assert.ok((await page.locator(`.ranking-method-tab[data-method="${methodKey}"]`).getAttribute('class'))?.includes('is-active'),
      `${method} tab must expose its modern active style`)
    if (method === 'AHP') {
      await page.getByText('Saaty 1–9 scale; reciprocal entries are automatic.').waitFor()
      await page.getByLabel(/هزینه سرمایه‌گذاری vs ریسک اجرا$/).selectOption('2')
      await page.getByLabel(/هزینه سرمایه‌گذاری vs زمان اجرا$/).selectOption('4')
      await page.getByLabel(/ریسک اجرا vs زمان اجرا$/).selectOption('2')
      await page.waitForTimeout(350)
      await page.getByRole('button', { name: 'Calculate and save version' }).click()
      await page.getByText('Calculation version saved').waitFor()
    }
    if (method === 'BWM') {
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
      await page.getByText('Calculation history (2)').waitFor()
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
      await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
      await page.getByTestId('ranking-category-advanced').click()
      await page.getByRole('button', { name: 'BWM', exact: true }).click()
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
    if (method === 'AHP + TOPSIS') {
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
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
  await page.getByTestId('ranking-category-advanced').click()
  await page.getByText('Calculation history (4)').waitFor()
  await page.getByRole('button', { name: 'AHP', exact: true }).click()
  assert.equal(await page.getByLabel(/هزینه سرمایه‌گذاری vs ریسک اجرا$/).inputValue(), '2',
    'AHP first pairwise judgment must persist after reload')
  assert.equal(await page.getByLabel(/هزینه سرمایه‌گذاری vs زمان اجرا$/).inputValue(), '4',
    'AHP second pairwise judgment must persist after reload')
  assert.equal(await page.getByLabel(/ریسک اجرا vs زمان اجرا$/).inputValue(), '2',
    'AHP third pairwise judgment must persist after reload')
  await page.getByRole('button', { name: 'BWM', exact: true }).click()
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
  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
  assert.equal(await page.getByText('معیار اختصاصی پروژه دوم').count(), 0,
    'second-project criteria must not leak into the first project')
  assert.equal(await page.getByLabel('گزینه زنده الف, هزینه آزمون زنده score').inputValue(), '90',
    'first-project WSM scores must remain unchanged after editing a second project')

  await page.getByRole('button', { name: '← All ranking projects' }).click()
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه دوم مستقل' }).click()
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
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه دوم مستقل' }).click()
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
  await page.locator('.ranking-project-open').filter({ hasText: 'پروژه آزمایش رتبه‌بندی ویرایش‌شده' }).click()
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
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  const capabilities = page.locator('.module-capabilities-card')
  await capabilities.waitFor({ state: 'visible' })
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

  const modulePage = page.locator('.module-workspace-page')
  const obsoleteContinue = modulePage.getByRole('button', { name: /^(ادامه بده|ادامه|Continue|Continue now)$/i })
  assert.equal(await obsoleteContinue.count(), 0,
    'module workspace must not show the removed bottom continue button')
  await page.getByLabel('نام پروژه جدید ماژول').fill('پروژه آزمون ذخیره ماژول')
  await page.getByRole('button', { name: 'ایجاد پروژه' }).click()
  await modulePage.getByText('پروژه آزمون ذخیره ماژول', { exact: true }).waitFor()
  await page.waitForFunction(async expectedName => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('pishran_store')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const record = await new Promise((resolve, reject) => {
        const request = db.transaction('kv', 'readonly').objectStore('kv').get('module-workspaces:v1')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return Array.isArray(record?.value) && record.value.some(item => item.moduleId === 'MOD-02' && item.name === expectedName)
    } finally {
      db.close()
    }
  }, 'پروژه آزمون ذخیره ماژول', { timeout: 10000 })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ذخیره ماژول', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'ویرایش پروژه آزمون ذخیره ماژول' }).click()
  await page.getByRole('textbox', { name: 'نام پروژه' }).fill('پروژه آزمون ویرایش و بازیابی')
  await page.getByRole('button', { name: 'ذخیره ویرایش' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ویرایش و بازیابی', { exact: true }).waitFor()
  await page.waitForFunction(async expectedName => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('pishran_store')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const record = await new Promise((resolve, reject) => {
        const request = db.transaction('kv', 'readonly').objectStore('kv').get('module-workspaces:v1')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return Array.isArray(record?.value) && record.value.some(item => item.moduleId === 'MOD-02' && item.name === expectedName)
    } finally {
      db.close()
    }
  }, 'پروژه آزمون ویرایش و بازیابی', { timeout: 10000 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.module-launcher-card').filter({ hasText: 'MOD-02' }).click()
  await page.locator('.module-workspace-page').getByText('پروژه آزمون ویرایش و بازیابی', { exact: true }).waitFor()
  assert.equal(await page.locator('.module-workspace-page').getByText('پروژه آزمون ذخیره ماژول', { exact: true }).count(), 0,
    'edited module workspace name must replace the old name after recovery')
  assert.equal(await page.locator('.module-workspace-page').getByRole('button', { name: /^(ادامه بده|ادامه|Continue|Continue now)$/i }).count(), 0,
    'obsolete bottom continue action must remain absent after recovery')
  console.log('PASS: live public PWA module tabs and workspace persistence, no bottom continue action, MOD-10, WSM persistence, AHP/BWM/TOPSIS/AHP+TOPSIS, independent expert BWM, rank sensitivity scenarios and bilingual switching')
} finally {
  await browser.close()
}
