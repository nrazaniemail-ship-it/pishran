import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

const baseMovement = {
  period: 1, productId: 'P1', costCentreId: 'CC-1',
  openingQuantity: 0, openingValue: 0,
  receiptsQuantity: 10, receiptsValue: 100,
  productionQuantity: 0, productionValue: 0,
  consumptionQuantity: 0, consumptionValue: 0,
  wasteQuantity: 0, wasteValue: 0,
  closingQuantity: 10, closingValue: 100,
}

const validMovement = module.reconcileCostCentreInventory([baseMovement], [], 1)
assert.equal(validMovement.valid, true, validMovement.issues.join('; '))

const infiniteClosingValue = module.reconcileCostCentreInventory(
  [{ ...baseMovement, closingValue: Number.POSITIVE_INFINITY }], [], 1,
)
assert.equal(infiniteClosingValue.valid, false,
  'Cost-centre inventory must reject an infinite closing value')
assert.ok(infiniteClosingValue.issues.some(issue => issue.includes('finite non-negative')),
  'Infinite inventory values must fail the finite-amount boundary')

const notANumberMovement = module.reconcileCostCentreInventory(
  [{ ...baseMovement, receiptsQuantity: Number.NaN }], [], 1,
)
assert.equal(notANumberMovement.valid, false,
  'Cost-centre inventory must reject NaN movement quantities')

const invalidTolerance = module.reconcileCostCentreInventory([baseMovement], [], 1, Number.NaN)
assert.equal(invalidTolerance.valid, false,
  'Cost-centre inventory reconciliation must reject a NaN tolerance')
assert.ok(invalidTolerance.issues.some(issue => issue.includes('tolerance must be a finite non-negative percentage')),
  'Invalid tolerance must be reported explicitly')

const transfer = (id, period, sourceProductId, destinationProductId, sourceUnit, destinationUnit) => ({
  id, period, sourceProductId, destinationProductId,
  sourceCostCentreId: 'CC-SOURCE', destinationCostCentreId: 'CC-DEST',
  quantity: 1, sourceUnit, destinationUnit, conversionFactor: 1,
  costAmount: 10,
})

const outOfRangeTransfer = module.validateProductionTransfers(
  [transfer('OUT-OF-RANGE', 3, 'P1', 'P2', 'ton', 'ton')], 2,
)
assert.equal(outOfRangeTransfer.valid, false,
  'Production transfers must reject periods beyond the project horizon')
assert.ok(outOfRangeTransfer.issues.some(issue => issue.includes('invalid period')),
  'Out-of-range transfer periods must be identified')

const inconsistentProductUnit = module.validateProductionTransfers([
  transfer('UNIT-TON', 1, 'P1', 'P2', 'ton', 'ton'),
  transfer('UNIT-KG', 2, 'P1', 'P3', 'kg', 'ton'),
], 2)
assert.equal(inconsistentProductUnit.valid, false,
  'A product must not use different base units across transfer records')
assert.ok(inconsistentProductUnit.issues.some(issue => issue.includes('A product must have one base unit')),
  'Cross-transfer unit inconsistency must be reported')

const wasteEntry = {
  id: 'W-1', period: 1, productId: 'P1', costCentreId: 'CC-1',
  classification: 'abnormal', quantity: 2, unitCost: 5, amount: 10,
  sourceReference: 'INC-1', sourceVerified: true,
}
for (const tolerance of [Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
  const result = module.validateWasteLedger([wasteEntry], 1, tolerance)
  assert.equal(result.valid, false, 'Waste ledger must reject invalid tolerances')
  assert.ok(result.issues.some(issue => issue.includes('Waste ledger tolerance must be a finite non-negative percentage')),
    'Waste ledger must report invalid tolerance explicitly')
}
for (const tolerance of [Number.NaN, Number.POSITIVE_INFINITY, -0.01]) {
  const result = module.validateProductionTransfers([], 1, tolerance)
  assert.equal(result.valid, false, 'Production transfer ledger must reject invalid tolerances')
  assert.ok(result.issues.some(issue => issue.includes('Production transfer tolerance must be a finite non-negative percentage')),
    'Production transfer ledger must report invalid tolerance explicitly')
}

console.log('PASS: FS-00 boundary hardening — finite inventory values, invalid tolerance rejection, transfer horizon and product base-unit consistency.')
