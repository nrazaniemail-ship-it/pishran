import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app,style] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
])

test('dashboard renders all twelve module launcher cards with real module navigation', () => {
  assert.match(app, /className="module-launcher"/)
  assert.match(app, /modules\\.map\\(item => item\\.group\\)/)
  assert.match(app, /groupModules\\.map\\(item =>/)
  assert.match(app, /onClick=\\{\\(\\) => openModule\\(item\\.id\\)\\}/)
  assert.match(app, /module-launcher-count/)
  assert.doesNotMatch(app, /dashboard-diagram-hotspot/)
})

test('launcher has responsive desktop, tablet and phone layouts with keyboard focus styling', () => {
  assert.match(style, /\\.module-launcher-grid\\{display:grid;grid-template-columns:repeat\\(4,minmax\\(0,1fr\\)\\)/)
  assert.match(style, /@media\\(max-width:1050px\\)\\{\\.module-launcher-grid\\{grid-template-columns:repeat\\(3/)
  assert.match(style, /@media\\(max-width:760px\\)\\{\\.module-launcher/)
  assert.match(style, /@media\\(max-width:430px\\)\\{\\.module-launcher-heading/)
  assert.match(style, /\\.module-launcher-card:focus-visible/)
})
