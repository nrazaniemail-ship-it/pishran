import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/workingCapitalDraftIntegration.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const adapter = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const periods = [
  { index: 1, startDate: '2025-01-01', endDate: '2025-03-31', days: 90, partial: false },
  { index: 2, startDate: '2025-04-01', endDate: '2025-06-30', days: 91, partial: false },
]
const result = adapter.buildWorkingCapitalScheduleFromDrafts({
  workingCapital: [
    { id: 'raw', name: 'Raw materials', category: 'inventory', minimumDaysCoverage: 30, turnoverCoefficient: 12, valuationBasis: 'cost-of-production',
      periodBalances: [{ period: '1', amount: 100 }, { period: '2025-04-01', amount: 130 }] },
    { id: 'pay', name: 'Trade payables', category: 'payables', minimumDaysCoverage: 20, turnoverCoefficient: 18, valuationBasis: 'cost-of-production',
      periodBalances: [{ period: '2025-01-01', amount: 20 }, { period: '2', amount: 30 }] },
  ],
}, periods, 50)
assert.equal(result.valid, true, result.issues.join('; '))
assert.deepEqual(result.closingWorkingCapital, [80, 100])
assert.deepEqual(result.changeInWorkingCapital, [30, 20])
assert.equal(result.componentRows.length, 4)

const bound = adapter.bindWorkingCapitalDraftsToPeriodicFinance({
  periods, fiscalYearStartMonth: 1, dayCountBasis: 360, cashFlowTiming: 'period-end',
  annualRevenue: [], annualVariableCost: [], annualFixedCost: [], annualDepreciation: [],
  annualFixedInvestment: [], annualPreOperatingCost: [], annualMaintenanceCapex: [], annualTaxRates: [],
  annualEquityContributions: [], workingCapitalByPeriod: [], loans: [],
}, { workingCapital: [
  { id: 'raw', name: 'Raw materials', category: 'inventory', minimumDaysCoverage: null, turnoverCoefficient: null, valuationBasis: 'user-defined', periodBalances: [{ period: '1', amount: 100 }, { period: '2', amount: 130 }] },
  { id: 'pay', name: 'Payables', category: 'payables', minimumDaysCoverage: null, turnoverCoefficient: null, valuationBasis: 'user-defined', periodBalances: [{ period: '1', amount: 20 }, { period: '2', amount: 30 }] },
] }, 50)
assert.equal(bound.valid, true, bound.issues.join('; '))
assert.deepEqual(bound.financeInput.workingCapitalByPeriod, [80, 100])
assert.equal(bound.financeInput.openingWorkingCapital, 50)

const missingBalance = adapter.buildWorkingCapitalScheduleFromDrafts({
  workingCapital: [{ id: 'raw', name: 'Raw materials', category: 'inventory', minimumDaysCoverage: 30, turnoverCoefficient: 12, valuationBasis: 'cost-of-production',
    periodBalances: [{ period: '1', amount: 100 }] }],
}, periods, 0)
assert.equal(missingBalance.valid, false)
assert.ok(missingBalance.issues.some(issue => issue.includes('period-balance-required:2')))

const duplicatePeriod = adapter.buildWorkingCapitalScheduleFromDrafts({
  workingCapital: [{ id: 'raw', name: 'Raw materials', category: 'inventory', minimumDaysCoverage: null, turnoverCoefficient: null, valuationBasis: 'user-defined',
    periodBalances: [{ period: '1', amount: 100 }, { period: '2025-01-01', amount: 110 }, { period: '2', amount: 100 }] }],
}, periods, 0)
assert.equal(duplicatePeriod.valid, false)
assert.ok(duplicatePeriod.issues.some(issue => issue.includes('duplicate-period-balance:1')))

const noSilentZero = adapter.buildWorkingCapitalScheduleFromDrafts({
  workingCapital: [{ id: 'cash', name: 'Cash', category: 'cash', minimumDaysCoverage: null, turnoverCoefficient: null, valuationBasis: 'user-defined',
    periodBalances: [{ period: '1', amount: null }, { period: '2', amount: 0 }] }],
}, periods, 0)
assert.equal(noSilentZero.valid, false)
assert.ok(noSilentZero.issues.some(issue => issue.includes('missing-or-invalid-balance:1')))

const invalidCalendar = adapter.buildWorkingCapitalScheduleFromDrafts({ workingCapital: [] }, [
  { index: 1, startDate: '2025-01-01', endDate: '2025-03-31', days: 89, partial: false },
], 0)
assert.equal(invalidCalendar.valid, false)
assert.ok(invalidCalendar.issues.some(issue => issue.includes('dates and day count')))

console.log('Working-capital draft integration validation passed.')
