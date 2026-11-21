import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

// Source-backed facility structure from the SARZAMIN cold-rolling report:
// 3,000,000 million IRR special deposit certificate + 2,000,000 million IRR
// rial facility; repayment begins in Q1 1403 and spans 12 quarterly periods.
// The report does not disclose the individual quarterly principal table here.
// Therefore this regression verifies facility separation, period coverage and
// full amortization only; it does NOT assert an unverified quarterly payment
// profile or claim that the modeled interest convention reproduces COMFAR.
const addMonths = (isoDate, months) => {
  const [year, month, day] = isoDate.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}
const periods = Array.from({ length: 13 }, (_, index) => {
  const startDate = addMonths('2023-12-20', index * 3)
  const nextStart = addMonths('2023-12-20', (index + 1) * 3)
  const end = new Date(nextStart + 'T00:00:00.000Z')
  end.setUTCDate(end.getUTCDate() - 1)
  const endDate = end.toISOString().slice(0, 10)
  const days = Math.round((Date.parse(endDate + 'T00:00:00.000Z') - Date.parse(startDate + 'T00:00:00.000Z')) / 86400000) + 1
  return { index: index + 1, startDate, endDate, days, partial: false }
})

const facilities = [
  { id: 'special-deposit-certificate', principal: 3_000_000 },
  { id: 'rial-loan', principal: 2_000_000 },
]
const schedules = facilities.map(facility => {
  const drawdowns = [facility.principal, ...Array(12).fill(0)]
  const result = engine.calculatePeriodicLoanSchedule({
    annualRatePercent: 23,
    drawdowns,
    repaymentMethod: 'annuity',
    repaymentStartPeriod: 2,
    gracePeriods: 0,
    termPeriods: 12,
    capitalizeInterest: false,
    rateConversion: 'effective-annual-divided-by-frequency',
    periodsPerYear: 4,
  }, periods, 365)
  assert.equal(result.valid, true, facility.id + ': ' + result.issues.join('; '))
  assert.equal(result.rows.length, 13)
  assert.equal(result.rows.filter(row => row.principal > 0).length, 12,
    facility.id + ': repayment must start in the first quarter and span all 12 quarters')
  const principalRepaid = result.rows.reduce((sum, row) => sum + row.principal, 0)
  assert.ok(Math.abs(principalRepaid - facility.principal) <= 0.01,
    facility.id + ': principal repayments must equal the facility drawdown')
  assert.ok(Math.abs(result.rows.at(-1).closingBalance) <= 0.01,
    facility.id + ': outstanding principal must be zero after the 12th installment')
  return { id: facility.id, principal: facility.principal, rows: result.rows }
})

const aggregatePrincipal = schedules.reduce((sum, schedule) => sum + schedule.principal, 0)
assert.equal(aggregatePrincipal, 5_000_000)
for (let index = 0; index < 13; index++) {
  const combinedClosing = schedules.reduce((sum, schedule) => sum + schedule.rows[index].closingBalance, 0)
  assert.ok(Number.isFinite(combinedClosing) && combinedClosing >= -0.01,
    'Combined facility balance must remain finite and non-negative in quarter ' + (index + 1))
}
assert.ok(Math.abs(schedules.reduce((sum, schedule) => sum + schedule.rows.at(-1).closingBalance, 0)) <= 0.01)

console.log('SARZAMIN quarterly loan structure passed: two separate facilities, 12 installments and full principal amortization.')
