import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/salesTaxLedger.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const ledger = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const outputEntries = [
  { productId: 'A', period: 1, taxableSales: 1000, ratePercent: 10 },
  { productId: 'B', period: 1, taxableSales: 500, ratePercent: 10 },
  { productId: 'A', period: 2, taxableSales: 1200, ratePercent: 10 },
]
const credits = [
  { id: 'INV-1', period: 1, taxAmount: 30, sourceReference: 'purchase-invoice-1', sourceVerified: true },
  { id: 'INV-2', period: 2, taxAmount: 20, sourceReference: 'purchase-invoice-2', sourceVerified: true },
]
const settlements = [
  { period: 1, amount: 50, sourceReference: 'tax-payment-receipt-1' },
  { period: 2, amount: 100, sourceReference: 'tax-payment-receipt-2' },
]
const result = ledger.buildSalesTaxLedger(2, outputEntries, credits, settlements)
assert.equal(result.valid, true, result.issues.join('; '))
assert.deepEqual(result.rows, [
  { period: 1, openingBalance: 0, outputTax: 150, recoverableInputTax: 30, netTaxAccrued: 120, settlement: 50, closingBalance: 70 },
  { period: 2, openingBalance: 70, outputTax: 120, recoverableInputTax: 20, netTaxAccrued: 100, settlement: 100, closingBalance: 70 },
])
assert.equal(result.totalOutputTax, 270)
assert.equal(result.totalRecoverableInputTax, 50)
assert.equal(result.totalSettlements, 150)
assert.equal(result.closingBalance, 70)

const missingSettlement = ledger.buildSalesTaxLedger(2, outputEntries, credits, settlements.slice(0, 1))
assert.equal(missingSettlement.valid, false)
assert.ok(missingSettlement.issues.some(issue => issue.includes('missing period 2')))

const unverifiedCredit = ledger.buildSalesTaxLedger(2, outputEntries, [
  { ...credits[0], sourceVerified: false },
], settlements)
assert.equal(unverifiedCredit.valid, false)
assert.ok(unverifiedCredit.issues.some(issue => issue.includes('verified source reference')))

const excessiveSettlement = ledger.buildSalesTaxLedger(1,
  [{ productId: 'A', period: 1, taxableSales: 100, ratePercent: 10 }], [],
  [{ period: 1, amount: 11, sourceReference: 'receipt' }])
assert.equal(excessiveSettlement.valid, false)
assert.ok(excessiveSettlement.issues.some(issue => issue.includes('exceeds the payable balance')))

const invalidRate = ledger.buildSalesTaxLedger(1,
  [{ productId: 'A', period: 1, taxableSales: 100, ratePercent: 101 }], [],
  [{ period: 1, amount: 0, sourceReference: 'no-payment-due' }])
assert.equal(invalidRate.valid, false)

const duplicateProductPeriod = ledger.buildSalesTaxLedger(1, [
  { productId: 'A', period: 1, taxableSales: 100, ratePercent: 10 },
  { productId: 'a', period: 1, taxableSales: 200, ratePercent: 10 },
], [], [{ period: 1, amount: 0, sourceReference: 'no-payment-due' }])
assert.equal(duplicateProductPeriod.valid, false)

console.log('Sales-tax ledger regression tests passed.')
