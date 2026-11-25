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
  await page.getByRole('heading', { name: 'وزن‌دهی و رتبه‌بندی چندمعیاره' }).waitFor()
  await page.getByRole('heading', { name: 'روش‌های انجام' }).waitFor()
  assert.equal(await page.getByTestId('ranking-category-initial').getAttribute('aria-pressed'), 'true')
  assert.ok((await page.getByTestId('ranking-category-initial').getAttribute('class'))?.includes('is-active'),
    'initial category tab must expose its modern active style')
  await page.getByRole('heading', { name: 'محیط رتبه‌بندی تصمیم · نسخه اولیه' }).waitFor()

  await page.getByPlaceholder('مثلاً NPV، ریسک اجرا، زمان تحویل').fill('هزینه آزمون زنده')
  await page.getByRole('button', { name: 'افزودن معیار' }).click()
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
  assert.equal(await page.getByLabel('امتیاز هزینه آزمون زنده برای گزینه زنده الف').inputValue(), '90',
    'public WSM data must persist after reload')

  await page.getByRole('button', { name: 'Switch to English' }).click()
  await page.getByRole('heading', { name: 'Multi-criteria weighting & ranking' }).waitFor()
  await page.getByTestId('ranking-category-advanced').click()
  assert.ok((await page.getByTestId('ranking-category-advanced').getAttribute('class'))?.includes('is-active'),
    'advanced category tab must expose its modern active style')
  await page.getByRole('heading', { name: 'Advanced multi-criteria methods' }).waitFor()
  for (const method of ['AHP', 'BWM', 'TOPSIS', 'AHP + TOPSIS']) {
    await page.getByRole('button', { name: method, exact: true }).click()
    assert.equal(await page.locator(`.ranking-method-tab[data-method="${method}"]`).getAttribute('aria-pressed'), 'true',
      `${method} tab must expose the selected state`)
    assert.ok((await page.locator(`.ranking-method-tab[data-method="${method}"]`).getAttribute('class'))?.includes('is-active'),
      `${method} tab must expose its modern active style`)
    if (method === 'AHP') await page.getByText('Saaty 1–9 scale; reciprocal entries are automatic.').waitFor()
    if (method === 'BWM') {
      await page.getByText('Best criterion').waitFor()
      await page.getByLabel('Expert 1 best criterion').selectOption('1')
      await page.getByLabel('Expert 1 worst criterion').selectOption('0')
      await page.getByRole('button', { name: 'Calculate and save version' }).click()
      await page.getByText('Calculation version saved').waitFor()
      await page.getByText('Calculation history (1)').waitFor()
      await page.getByRole('button', { name: 'Run rank sensitivity' }).click()
      await page.getByTestId('ranking-sensitivity-results').waitFor()
      await page.getByText('Scenario comparison').click()
      await page.getByText(/optimistic/).last().waitFor()
    }
    if (method === 'TOPSIS') await page.getByText('Manual criterion weights').waitFor()
    if (method === 'AHP + TOPSIS') await page.getByText('Alternative performance matrix').waitFor()
  }
  await page.getByRole('button', { name: 'Calculate and save version' }).click()
  await page.getByText('Calculation version saved').waitFor()
  await page.getByText('Calculation history (2)').waitFor()
  assert.deepEqual(pageErrors, [], 'public ranking interaction must not generate browser runtime errors')
  assert.ok(bundle.includes('Rank sensitivity summary') || bundle.includes('خلاصه تحلیل حساسیت رتبه‌ها'), 'published bundle must include ranking sensitivity UI')
  console.log('PASS: live public PWA MOD-10, WSM persistence, AHP/BWM/TOPSIS/AHP+TOPSIS, independent expert BWM, rank sensitivity scenarios and bilingual switching')
} finally {
  await browser.close()
}
