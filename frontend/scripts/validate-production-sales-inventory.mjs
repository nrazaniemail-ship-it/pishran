import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/steel/productionSalesInventory.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const engine = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))

const periods = [
  { index: 1, months: 12, salesQuantity: 100 },
  { index: 2, months: 12, salesQuantity: 100 },
  { index: 3, months: 12, salesQuantity: 0 },
]
const defaultProduction = engine.calculateFinishedGoodsProductionSchedule({
  periods, finishedGoodsDaysCoverage: 30, startingStock: 0,
})
assert.equal(defaultProduction.valid, true, defaultProduction.issues.join('; '))
assert.ok(Math.abs(defaultProduction.rows[0].requiredStock - 100 / 12) < 1e-9)
assert.ok(Math.abs(defaultProduction.rows[0].productionQuantity - (100 + 100 / 12)) < 1e-9)
assert.ok(Math.abs(defaultProduction.rows[1].productionQuantity - 100) < 1e-9)
assert.equal(defaultProduction.rows[2].productionQuantity, 0)
assert.ok(Math.abs(defaultProduction.terminalStockSoldInFollowingPeriod - 100 / 12) < 1e-9)

const earlySalesEnd = engine.calculateFinishedGoodsProductionSchedule({
  periods, finishedGoodsDaysCoverage: 30, startingStock: 0,
  productionStartPeriod: 1, productionEndPeriod: 3, salesEndPeriod: 2,
})
assert.equal(earlySalesEnd.valid, true, earlySalesEnd.issues.join('; '))
assert.ok(Math.abs(earlySalesEnd.rows[1].stockCarriedOver) < 1e-9,
  'Production must be reduced before the end of the sales phase to avoid excess terminal stock')
assert.ok(Math.abs(earlySalesEnd.rows[1].productionQuantity - (100 - 100 / 12)) < 1e-9)

const userDefinedInterval = engine.calculateFinishedGoodsProductionSchedule({
  periods: [
    { index: 1, months: 12, salesQuantity: 40 },
    { index: 2, months: 12, salesQuantity: 60 },
  ],
  finishedGoodsDaysCoverage: 30, startingStock: 50,
  productionStartPeriod: 2, productionEndPeriod: 2,
})
assert.equal(userDefinedInterval.valid, true, userDefinedInterval.issues.join('; '))
assert.equal(userDefinedInterval.rows[0].productionQuantity, 0)
assert.equal(userDefinedInterval.rows[0].stockCarriedOver, 10)
assert.equal(userDefinedInterval.rows[1].productionQuantity, 55)

const stockOnly = engine.calculateFinishedGoodsProductionSchedule({
  periods: [{ index: 1, months: 12, salesQuantity: 30 }],
  finishedGoodsDaysCoverage: 30, startingStock: 50,
})
assert.equal(stockOnly.valid, true)
assert.equal(stockOnly.rows[0].productionQuantity, 0)
assert.equal(stockOnly.rows[0].stockCarriedOver, 20)

const invalidStock = engine.calculateFinishedGoodsProductionSchedule({
  periods: [{ index: 1, months: 12, salesQuantity: 30 }],
  finishedGoodsDaysCoverage: 30, startingStock: 0,
  productionStartPeriod: 1, productionEndPeriod: 0,
})
assert.equal(invalidStock.valid, false)

const nominalCost = engine.calculateProductionCostItem({
  id: 'nominal',
  basis: 'nominal-capacity',
  activityBasis: 'production',
  standardQuantity: 10,
  standardUnitPrices: [100],
  nominalCapacity: 100,
  fixedPercent: 60,
  variablePercent: 40,
  adjustments: [{ period: 1, quantity: 2, unitPrice: 50, fixedPercent: 10, variablePercent: 90 }],
}, [{ index: 1, months: 6, salesQuantity: 50, productionQuantity: 50 }])
assert.equal(nominalCost.valid, true, nominalCost.issues.join('; '))
assert.equal(nominalCost.rows[0].standardCost, 1000)
assert.equal(nominalCost.rows[0].adjustmentAmount, 100)
assert.equal(nominalCost.rows[0].fixedCost, 310)
assert.equal(nominalCost.rows[0].variableCost, 290)
assert.equal(nominalCost.rows[0].totalCost, 600)

const perUnitCost = engine.calculateProductionCostItem({
  id: 'per-unit',
  basis: 'per-unit-output',
  activityBasis: 'sales',
  standardQuantity: 2,
  standardUnitPrices: [30],
  standardFixedCost: 1200,
  adjustments: [{ period: 1, quantity: 2, unitPrice: 10, fixedPercent: 25, variablePercent: 75 }],
}, [{ index: 1, months: 6, salesQuantity: 50, productionQuantity: 60 }])
assert.equal(perUnitCost.valid, true, perUnitCost.issues.join('; '))
assert.equal(perUnitCost.rows[0].fixedCost, 605)
assert.equal(perUnitCost.rows[0].variableCost, 3015)
assert.equal(perUnitCost.rows[0].totalCost, 3620)

const adjustmentOnly = engine.calculateProductionCostItem({
  id: 'adjustment-only',
  basis: 'period-adjustments',
  activityBasis: 'production',
  adjustments: [{ period: 1, quantity: 4, unitPrice: 25, fixedPercent: 50, variablePercent: 50 }],
}, [{ index: 1, months: 3, salesQuantity: 0, productionQuantity: 10 }])
assert.equal(adjustmentOnly.valid, true, adjustmentOnly.issues.join('; '))
assert.equal(adjustmentOnly.rows[0].fixedCost, 50)
assert.equal(adjustmentOnly.rows[0].variableCost, 50)

const badCostSplit = engine.calculateProductionCostItem({
  id: 'bad-split',
  basis: 'nominal-capacity',
  activityBasis: 'sales',
  standardQuantity: 1,
  standardUnitPrices: [100],
  nominalCapacity: 100,
  fixedPercent: 80,
  variablePercent: 30,
}, [{ index: 1, months: 12, salesQuantity: 10, productionQuantity: 10 }])
assert.equal(badCostSplit.valid, false)
assert.equal(engine.calculateProductionCostItem(null, periods).valid, false,
  'Malformed persisted production-cost records must fail validation without throwing')
assert.equal(engine.calculateProductionCostItem({
  id: 'bad-periods', basis: 'nominal-capacity', activityBasis: 'sales',
  standardQuantity: 1, standardUnitPrices: [100], nominalCapacity: 100,
  fixedPercent: 50, variablePercent: 50,
}, null).valid, false,
  'Missing period arrays must fail validation without throwing')

console.log('PASS: Help-driven finished-goods production, stock roll-forward, production interval and production-cost formulas')
