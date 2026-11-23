import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app,style] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
])

test('dashboard renders all twelve module launcher cards with real module navigation', () => {
  assert.ok(app.includes('className="module-launcher"'))
  assert.ok(app.includes('modules.map(item => item.group)'))
  assert.ok(app.includes('groupModules.map(item =>'))
  assert.ok(app.includes('onClick={() => openModule(item.id)}'))
  assert.ok(app.includes('module-launcher-count'))
  assert.ok(!app.includes('dashboard-diagram-hotspot'))
})

test('launcher has responsive desktop, tablet and phone layouts with keyboard focus styling', () => {
  assert.ok(style.includes('.module-launcher-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))'))
  assert.ok(style.includes('@media(max-width:1050px){.module-launcher-grid{grid-template-columns:repeat(3'))
  assert.ok(style.includes('@media(max-width:760px){.module-launcher'))
  assert.ok(style.includes('@media(max-width:430px){.module-launcher-heading'))
  assert.ok(style.includes('.module-launcher-card:focus-visible'))
})

test('launcher preserves the twelve-module catalogue and four operational groupings', () => {
  const ids = [...app.matchAll(/id: 'MOD-\\d{2}'/g)].map(match => match[0])
  const groups = [...app.matchAll(/group: '([^']+)'/g)].map(match => match[1])
  assert.equal(ids.length, 12)
  assert.equal(new Set(groups).size, 4)
})
