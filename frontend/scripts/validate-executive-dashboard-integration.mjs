import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadExecutiveDashboardReports } from '../src/features/modules/executiveDashboardData.js'

const costKey = 'module-intelligence:MOD-02:v1'
const productionKey = 'module-intelligence:MOD-03:v1'

function report(moduleId, id, createdAt, metrics) {
  return { id, moduleId, createdAt, inputs: {}, metrics }
}

function memoryStore(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get: async key => values.get(key),
    set: (key, value) => values.set(key, value),
  }
}

test('MOD-01 shows empty states when MOD-02 and MOD-03 have no saved reports', async () => {
  const reports = await loadExecutiveDashboardReports(memoryStore())
  assert.deepEqual(reports, { cost: [], production: [] })
})

test('MOD-01 selects the newest valid report by timestamp, independent of array order', async () => {
  const store = memoryStore({
    [costKey]: [
      report('MOD-02', 'cost-old', '2026-01-01T00:00:00.000Z', { unitCost: 100 }),
      report('MOD-02', 'cost-new', '2026-03-01T00:00:00.000Z', { unitCost: 250 }),
      report('MOD-02', 'cost-middle', '2026-02-01T00:00:00.000Z', { unitCost: 175 }),
      report('MOD-03', 'wrong-module', '2026-04-01T00:00:00.000Z', { unitCost: 999 }),
      report('MOD-02', 'invalid-date', 'not-a-date', { unitCost: 999 }),
      { id: 'missing-metrics', moduleId: 'MOD-02', createdAt: '2026-04-02T00:00:00.000Z' },
    ],
    [productionKey]: [
      report('MOD-03', 'oee-new', '2026-05-01T00:00:00.000Z', { oee: 92 }),
      report('MOD-03', 'oee-old', '2026-02-01T00:00:00.000Z', { oee: 70 }),
    ],
  })

  const reports = await loadExecutiveDashboardReports(store)
  assert.equal(reports.cost[0].id, 'cost-new')
  assert.equal(reports.cost[0].metrics.unitCost, 250)
  assert.equal(reports.cost.length, 3)
  assert.equal(reports.production[0].id, 'oee-new')
  assert.equal(reports.production[0].metrics.oee, 92)
  assert.equal(reports.production.length, 2)
})

test('MOD-01 refresh reads newly saved MOD-02 and MOD-03 reports', async () => {
  const store = memoryStore({
    [costKey]: [report('MOD-02', 'cost-v1', '2026-01-01T00:00:00.000Z', { unitCost: 100 })],
    [productionKey]: [report('MOD-03', 'oee-v1', '2026-01-01T00:00:00.000Z', { oee: 75 })],
  })

  const beforeRefresh = await loadExecutiveDashboardReports(store)
  assert.equal(beforeRefresh.cost[0].id, 'cost-v1')
  assert.equal(beforeRefresh.production[0].id, 'oee-v1')

  await store.set(costKey, [
    report('MOD-02', 'cost-v2', '2026-06-01T00:00:00.000Z', { unitCost: 80 }),
    ...beforeRefresh.cost,
  ])
  await store.set(productionKey, [
    report('MOD-03', 'oee-v2', '2026-06-01T00:00:00.000Z', { oee: 96 }),
    ...beforeRefresh.production,
  ])

  const afterRefresh = await loadExecutiveDashboardReports(store)
  assert.equal(afterRefresh.cost[0].id, 'cost-v2')
  assert.equal(afterRefresh.cost[0].metrics.unitCost, 80)
  assert.equal(afterRefresh.production[0].id, 'oee-v2')
  assert.equal(afterRefresh.production[0].metrics.oee, 96)
  assert.equal(afterRefresh.cost.length, 2)
  assert.equal(afterRefresh.production.length, 2)
})

test('MOD-01 component refresh delegates to the tested MOD-02/MOD-03 storage loader', async () => {
  const source = await readFile(new URL('../src/features/modules/ExecutiveDashboardPanel.tsx', import.meta.url), 'utf8')
  assert.match(source, /loadExecutiveDashboardReports\(localStore\)/)
  assert.match(source, /setCost\(reports\.cost\)/)
  assert.match(source, /setProduction\(reports\.production\)/)
  assert.match(source, /onClick=\{\(\)=>void refresh\(\)\}/)
})
