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
  const ids = [...app.matchAll(/id: 'MOD-[0-9]{2}'/g)].map(match => match[0])
  const groups = [...app.matchAll(/group: '([^']+)'/g)].map(match => match[1])
  assert.equal(ids.length, 12)
  assert.equal(new Set(groups).size, 4)
})


test('dashboard has a distinct feasibility core with project count and direct navigation', () => {
  assert.ok(app.includes('className="feasibility-core-card"'))
  assert.ok(app.includes("onClick={() => navigateTo('projects')}"))
  assert.ok(app.includes('projects.length.toLocaleString'))
  assert.ok(app.includes('مدل‌سازی مالی و جریان نقدی'))
})

test('module entry cards show capability highlights and saved-project counts', () => {
  assert.ok(app.includes('module-launcher-capabilities'))
  assert.ok(app.includes('module-launcher-saved-count'))
  assert.ok(app.includes('moduleWorkspaces.filter(workspace => workspace.moduleId === item.id).length'))
  assert.ok(app.includes('capabilityHighlights.map'))
})

test('module project creation and saved projects appear immediately after entering a module', () => {
  const hero = app.indexOf('className="module-workspace-hero"')
  const workspace = app.indexOf('className="module-workspace-card"')
  const modulePanel = app.indexOf("activeModule.id === 'MOD-01'")
  assert.ok(hero >= 0 && workspace > hero && workspace < modulePanel)
  assert.ok(app.includes("isEn ? 'New project' : 'پروژه جدید'"))
  assert.ok(app.includes('module-workspace-list'))
})
