import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/projectFoundation.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const foundation = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

function assertContinuous(periods, startDate, endDate) {
  assert.ok(periods.length > 0)
  assert.equal(periods[0].startDate, startDate)
  assert.equal(periods.at(-1).endDate, endDate)
  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index]
    assert.equal(period.index, index + 1)
    assert.ok(period.days > 0)
    assert.equal(period.days, (Date.parse(period.endDate + 'T00:00:00Z') - Date.parse(period.startDate + 'T00:00:00Z')) / 86400000 + 1)
    if (index > 0) {
      const previous = periods[index - 1]
      const nextDate = new Date(Date.parse(previous.endDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10)
      assert.equal(period.startDate, nextDate, 'Financial periods must be contiguous with no gaps or overlaps')
    }
  }
  const inclusiveDays = (Date.parse(endDate + 'T00:00:00Z') - Date.parse(startDate + 'T00:00:00Z')) / 86400000 + 1
  assert.equal(periods.reduce((total, period) => total + period.days, 0), inclusiveDays,
    'The period schedule must cover every project day exactly once')
}

const annualFiscal = foundation.buildProjectCalendarPeriods('2025-01-15', '2026-05-10', 'annual', 4)
assert.deepEqual(annualFiscal.map(period => [period.startDate, period.endDate, period.partial]), [
  ['2025-01-15', '2025-03-31', true],
  ['2025-04-01', '2026-03-31', false],
  ['2026-04-01', '2026-05-10', true],
])
assertContinuous(annualFiscal, '2025-01-15', '2026-05-10')

const semiannualFiscal = foundation.buildProjectCalendarPeriods('2026-01-01', '2026-12-31', 'semiannual', 4)
assert.deepEqual(semiannualFiscal.map(period => [period.startDate, period.endDate]), [
  ['2026-01-01', '2026-03-31'],
  ['2026-04-01', '2026-09-30'],
  ['2026-10-01', '2026-12-31'],
])
assertContinuous(semiannualFiscal, '2026-01-01', '2026-12-31')

const quarterlyFiscal = foundation.buildProjectCalendarPeriods('2025-01-15', '2025-10-10', 'quarterly', 4)
assert.deepEqual(quarterlyFiscal.map(period => [period.startDate, period.endDate, period.partial]), [
  ['2025-01-15', '2025-03-31', true],
  ['2025-04-01', '2025-06-30', false],
  ['2025-07-01', '2025-09-30', false],
  ['2025-10-01', '2025-10-10', true],
])
assertContinuous(quarterlyFiscal, '2025-01-15', '2025-10-10')

const monthlyLeapYear = foundation.buildProjectCalendarPeriods('2024-02-28', '2024-03-01', 'monthly', 7)
assert.deepEqual(monthlyLeapYear.map(period => [period.startDate, period.endDate, period.days, period.partial]), [
  ['2024-02-28', '2024-02-29', 2, true],
  ['2024-03-01', '2024-03-01', 1, true],
])
assertContinuous(monthlyLeapYear, '2024-02-28', '2024-03-01')

assert.deepEqual(foundation.buildProjectCalendarPeriods('2025-02-29', '2025-12-31', 'annual', 1), [],
  'Invalid non-leap calendar dates must be rejected')
assert.deepEqual(foundation.buildProjectCalendarPeriods('2025-12-31', '2025-01-01', 'annual', 1), [],
  'End dates before start dates must be rejected')
assert.deepEqual(foundation.buildProjectCalendarPeriods('2025-01-01', '2025-12-31', 'annual', 0), [],
  'Fiscal-year start month must be between 1 and 12')

const maximumMonthly = foundation.buildProjectCalendarPeriods('2000-01-01', '2099-12-31', 'monthly')
assert.equal(maximumMonthly.length, 1200, 'The supported 1,200-period limit must be inclusive')
assertContinuous(maximumMonthly, '2000-01-01', '2099-12-31')
assert.deepEqual(foundation.buildProjectCalendarPeriods('2000-01-01', '2100-12-31', 'monthly'), [],
  'Schedules exceeding the supported 1,200-period limit must fail closed')

console.log('Project calendar generation and period-continuity tests passed.')
