import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [app,projects,style] = await Promise.all([
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/projects/ProjectsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
])

test('dashboard renders all twelve module launcher cards with real module navigation', () => {
  assert.ok(app.includes('className="module-launcher"'))
  assert.ok(app.includes('modules.map(item => item.group)'))
  assert.ok(app.includes('groupModules.map(item =>'))
  assert.ok(app.includes('onClick={() => openModule(item.id)}'))
  assert.ok(app.includes('className="module-launcher-code"'))
  assert.ok(!app.includes('module-launcher-heading'))
  assert.ok(!app.includes('module-launcher-count'))
  assert.ok(!app.includes('dashboard-diagram-hotspot'))
})

test('investment control center is rendered on the feasibility projects page, not the dashboard', () => {
  assert.ok(!app.includes('Investment Control Center'))
  assert.ok(!app.includes('مرکز کنترل سرمایه‌گذاری'))
  assert.ok(projects.includes('Investment Control Center'))
  assert.ok(projects.includes('مرکز کنترل سرمایه‌گذاری'))
  assert.ok(projects.includes('storageInfo.backend'))
})

test('empty feasibility projects page does not render an empty-state card, text or create-first-project button', () => {
  assert.ok(!projects.includes('empty-state'))
  assert.ok(!projects.includes('هنوز پروژه‌ای ثبت نشده است'))
  assert.ok(!projects.includes('اولین پروژه امکان‌سنجی خود را ایجاد کنید'))
  assert.ok(!projects.includes('ایجاد اولین پروژه'))
  assert.ok(projects.includes('projects.length > 0'))
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
