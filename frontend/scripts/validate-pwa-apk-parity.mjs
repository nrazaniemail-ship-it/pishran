import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'

const previewUrl = process.env.PISH_PWA_URL || 'http://127.0.0.1:4178/'
const externalTarget = Boolean(process.env.PISH_PWA_URL)
const server = externalTarget ? null : spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4178', '--strictPort'], { stdio: 'ignore', env: process.env })
let browser
try {
  let ready = false
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { const response = await fetch(previewUrl); if (response.ok) { ready = true; break } } catch {}
    await delay(500)
  }
  assert.equal(ready, true, `PWA target must respond: ${previewUrl}`)
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ acceptDownloads: true })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  const response = await page.goto(previewUrl, { waitUntil: 'domcontentloaded' })
  assert.equal(response?.ok(), true, 'PWA document must load successfully')
  await page.locator('.module-launcher-card').first().waitFor({ state: 'visible' })
  assert.equal(await page.locator('.module-launcher-card').count(), 12, 'PWA launcher must expose exactly twelve modules')

  const menuButton = page.locator('.nav-module-toggle')
  await menuButton.waitFor({ state: 'visible' })
  const menu = page.locator('.nav-dropdown-menu')
  const openModule = async (id) => {
    if ((await menuButton.getAttribute('aria-expanded')) !== 'true') await menuButton.click()
    await menu.getByRole('menuitem').filter({ hasText: id }).click()
    await page.waitForFunction(expected => document.querySelector('[data-module-export-root] .module-id')?.textContent?.trim() === expected, id)
  }

  const moduleIds = Array.from({ length: 12 }, (_, i) => `MOD-${String(i + 1).padStart(2, '0')}`)
  const panelPresence = {}
  for (const id of moduleIds) {
    await openModule(id)
    assert.equal(await page.locator('[data-module-export-root]').count(), 1, `${id} workspace must render`)
    assert.equal(await page.locator('.module-capabilities-card').count(), 1, `${id} capability/benchmark section must render`)
    panelPresence[id] = await page.locator('.module-workspace-card').count() === 1
    if (Number(id.slice(-2)) >= 6) {
      const name = `PWA parity check ${id}`
      await page.locator('#module-workspace-name').fill(name)
      await page.getByRole('button', { name: /ایجاد پرونده|Create/ }).click()
      await page.getByText(name, { exact: true }).waitFor({ state: 'visible' })
    }
    const excelDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /خروجی Excel|Export Excel/ }).click()
    const download = await excelDownloadPromise
    assert.match(download.suggestedFilename(), /\.xlsx$/i, `${id} must export an XLSX file`)
    await page.evaluate(() => { window.print = () => { document.documentElement.dataset.pishranPrintCalled = 'true' } })
    await page.getByRole('button', { name: /چاپ \/ ذخیره PDF|Print \/ Save PDF/ }).click()
    assert.equal(await page.locator('html').getAttribute('data-pishran-print-called'), 'true', `${id} PDF action must invoke browser print/save`)
    await page.locator('html').evaluate(el => { delete el.dataset.pishranPrintCalled })
  }

  assert.equal(Object.keys(panelPresence).length, 12)
  assert.equal(await page.locator('.module-continue-actions button').count(), 1)
  await page.locator('.module-continue-actions button').click()
  await page.waitForFunction(() => document.querySelector('.app-page-dashboard .hero') !== null)
  await page.setViewportSize({ width: 390, height: 844 })
  const mobileMetrics = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, launcherColumns: getComputedStyle(document.querySelector('.module-launcher-grid')).gridTemplateColumns.split(' ').length }))
  assert.equal(mobileMetrics.launcherColumns, 2, 'phone PWA launcher must remain two columns')
  assert.ok(mobileMetrics.scrollWidth <= mobileMetrics.width + 2, `mobile PWA must not overflow horizontally: ${JSON.stringify(mobileMetrics)}`)

  assert.deepEqual(pageErrors, [], 'PWA module traversal must not throw browser runtime errors')
  console.log(JSON.stringify({ target: previewUrl, status: response.status(), moduleCount: moduleIds.length, moduleWorkspacePresent: panelPresence, mobileMetrics, pageErrors, result: 'PASS' }, null, 2))
} finally {
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
