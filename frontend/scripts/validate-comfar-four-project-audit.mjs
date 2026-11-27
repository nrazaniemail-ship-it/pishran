import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const checks = [
  ['HRCR200 hot-rolled coil', 'scripts/validate-comfar-hrcr200-valuation-baseline.mjs'],
  ['SARZAMIN hot-rolled plate', 'scripts/validate-comfar-hr-plate-valuation-baseline.mjs'],
  ['SARZAMIN cold-rolled coil', 'scripts/validate-comfar-sarzamin-cold-rolling-baseline.mjs'],
  ['Integrated DRI/slab steel', 'scripts/validate-comfar-integrated-steel-valuation-baseline.mjs'],
  ['Integrated DRI/slab linked statements', 'scripts/validate-comfar-integrated-steel-end-to-end.mjs'],
]
for (const [label, script] of checks) {
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' })
  assert.equal(run.status, 0, label + ' audit failed:\n' + run.stdout + '\n' + run.stderr)
  process.stdout.write(run.stdout)
}
const input = await readFile(new URL('../src/features/projects/comfarProjectInputData.ts', import.meta.url), 'utf8')
for (const key of [
  'comfar-hr-coil-200k',
  'comfar-hr-plate-250k',
  'comfar-cold-coil-200k',
  'comfar-integrated-steel-dri',
]) assert.ok(input.includes("'" + key + "'"), 'Missing COMFAR source project: ' + key)

const endToEnd = await readFile(new URL('validate-comfar-integrated-steel-end-to-end.mjs', import.meta.url), 'utf8')
assert.match(endToEnd, /buildPeriodicThreeFinancialStatements/,
  'Integrated steel audit must build linked income statement, cash flow and balance sheet')
assert.match(endToEnd, /balanceSheet\.reconciled, true/,
  'Integrated steel audit must assert balance-sheet reconciliation')
const coil = await readFile(new URL('validate-comfar-hr-coil-schedule.mjs', import.meta.url), 'utf8')
assert.match(coil, /عمر مفید و روش استهلاک تفکیکی هر دارایی/,
  'HRCR200 audit must retain explicit disclosure of missing asset-level depreciation evidence')
console.log('Four-project COMFAR audit gate passed: 4 independent valuation baselines, integrated linked statements, source project registry and evidence-gap guard.')
