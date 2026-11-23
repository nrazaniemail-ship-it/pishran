import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/features/projects/salesTaxLedger.ts', import.meta.url), 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const ledger = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
const outputEntries = [
  { productId: 'A', period: 1, taxableSales: 1000, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true },
  { productId: 'B', period: 1, taxableSales: 500, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true },
  { productId: 'A', period: 2, taxableSales: 1200, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true },
]
const credits = [
  { id: 'INV-1', period: 1, taxAmount: 30, sourceReference: 'purchase-invoice-1', sourceVerified: true },
  { id: 'INV-2', period: 2, taxAmount: 20, sourceReference: 'purchase-invoice-2', sourceVerified: true },
]
const settlements = [
  { period: 1, amount: 50, sourceReference: 'tax-payment-receipt-1', sourceVerified: true },
  { period: 2, amount: 100, sourceReference: 'tax-payment-receipt-2', sourceVerified: true },
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
  [{ productId: 'A', period: 1, taxableSales: 100, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true }], [],
  [{ period: 1, amount: 11, sourceReference: 'receipt', sourceVerified: true }])
assert.equal(excessiveSettlement.valid, false)
assert.ok(excessiveSettlement.issues.some(issue => issue.includes('exceeds the payable balance')))

const unverifiedSettlement = ledger.buildSalesTaxLedger(1,
  [{ productId: 'A', period: 1, taxableSales: 100, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true }], [],
  [{ period: 1, amount: 0, sourceReference: 'no-payment-due', sourceVerified: false }])
assert.equal(unverifiedSettlement.valid, false)
assert.ok(unverifiedSettlement.issues.some(issue => issue.includes('verified source reference')))

const invalidRate = ledger.buildSalesTaxLedger(1,
  [{ productId: 'A', period: 1, taxableSales: 100, ratePercent: 101, sourceReference: 'invalid-rate-law', sourceVerified: true }], [],
  [{ period: 1, amount: 0, sourceReference: 'no-payment-due', sourceVerified: true }])
assert.equal(invalidRate.valid, false)

const unverifiedOutputRate = ledger.buildSalesTaxLedger(1, [
  { productId: 'A', period: 1, taxableSales: 100, ratePercent: 10, sourceReference: '', sourceVerified: false },
], [], [{ period: 1, amount: 0, sourceReference: 'no-payment-due', sourceVerified: true }])
assert.equal(unverifiedOutputRate.valid, false)
assert.ok(unverifiedOutputRate.issues.some(issue => issue.includes('verified legal / source reference')))

const duplicateProductPeriod = ledger.buildSalesTaxLedger(1, [
  { productId: 'A', period: 1, taxableSales: 100, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true },
  { productId: 'a', period: 1, taxableSales: 200, ratePercent: 10, sourceReference: 'tax-law-reference', sourceVerified: true },
], [], [{ period: 1, amount: 0, sourceReference: 'no-payment-due', sourceVerified: true }])
assert.equal(duplicateProductPeriod.valid, false)

const wcBinding = ledger.bindSalesTaxLedgerToWorkingCapital([500, 600], 100, result)
assert.equal(wcBinding.valid, true, wcBinding.issues.join('; '))
assert.equal(wcBinding.openingWorkingCapital, 100)
assert.deepEqual(wcBinding.closingWorkingCapitalByPeriod, [430, 530])
// The 70 closing payable is deducted from net working capital once; the 100 settlement
// in period two is already reflected in the closing payable movement and is not a second cash deduction.
assert.equal((wcBinding.closingWorkingCapitalByPeriod[1] - wcBinding.closingWorkingCapitalByPeriod[0]), 100)

// A recoverable opening balance is an asset and therefore increases net working capital.
const recoveryLedger = ledger.buildSalesTaxLedger(1, [], [], [
  { period: 1, amount: 0, sourceReference: 'no-settlement', sourceVerified: true },
], -25)
const recoveryBinding = ledger.bindSalesTaxLedgerToWorkingCapital([100], 40, recoveryLedger)
assert.equal(recoveryBinding.valid, true)
assert.equal(recoveryBinding.openingWorkingCapital, 65)
assert.deepEqual(recoveryBinding.closingWorkingCapitalByPeriod, [125])

const invalidBinding = ledger.bindSalesTaxLedgerToWorkingCapital([1], 0, result)
assert.equal(invalidBinding.valid, false)
assert.ok(invalidBinding.issues.some(issue => issue.includes('align with every sales-tax ledger period')))

const formsSource = await readFile(new URL('../src/features/projects/ProjectModelFinancialFormsPanel.tsx', import.meta.url), 'utf8')
const panelSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
const wizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(formsSource.includes('دفتر مالیات غیرمستقیم فروش'))
assert.ok(formsSource.includes('sourceVerified'))
assert.ok(formsSource.includes('مرجع رسید پرداخت یا سند عدم پرداخت'))
assert.ok(formsSource.includes('Settlement evidence verified'))
assert.ok(panelSource.includes('buildSalesTaxLedger'))
assert.ok(panelSource.includes('bindSalesTaxLedgerToWorkingCapital'))
assert.ok(panelSource.includes('workingCapitalByPeriod:binding.closingWorkingCapitalByPeriod'))
assert.ok(wizardSource.includes('salesTaxLedgerDraft={m.financialForms.salesTaxLedger}'))
assert.ok(wizardSource.includes('sales-tax-ledger-not-valid'))
assert.ok(wizardSource.includes('reportSalesTaxLedgerResult.rows.map(row=>'))

console.log('Sales-tax ledger regression tests passed.')
