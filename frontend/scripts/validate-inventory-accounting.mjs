import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/production/inventoryAccounting.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const {valueInventoryLedger,validateInventoryLedger,allocateConversionCosts}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const ledger={itemId:'ore',itemName:'Iron ore',unit:'ton',currency:'USD',openingQuantity:100,openingValue:10000,receipts:[{id:'grn-1',quantity:50,unitPurchaseRate:120,currency:'USD',receivedAt:'2026-01-10'}],issuedQuantity:80,closingQuantity:70}
assert.deepEqual(validateInventoryLedger(ledger),[])
const value=valueInventoryLedger(ledger)
assert.equal(value.availableQuantity,150)
assert.equal(value.availableValue,16000)
assert.equal(value.weightedAverageRate,16000/150)
assert.equal(value.issueValue,80*(16000/150))
assert.equal(value.expectedClosingQuantity,70)
assert.equal(value.quantityVariance,0)
assert.ok(valueInventoryLedger({...ledger,closingQuantity:69}).warnings.some(x=>x.includes('تطبیق')))
assert.ok(validateInventoryLedger({...ledger,receipts:[{...ledger.receipts[0],currency:'EUR'}]}).length)
assert.ok(valueInventoryLedger({...ledger,issuedQuantity:151}).warnings.some(x=>x.includes('منفی')))
const allocations=allocateConversionCosts([{id:'labor',name:'Labor',amount:100,currency:'USD'},{id:'energy',name:'Energy',amount:200,currency:'USD'}],10)
assert.equal(allocations.reduce((s,x)=>s+x.allocatedAmount,0),300)
assert.equal(allocations[0].allocationRate,10)
assert.throws(()=>allocateConversionCosts([{id:'a',name:'A',amount:1,currency:'USD'},{id:'b',name:'B',amount:2,currency:'EUR'}],10))
console.log('Inventory roll-forward, purchase weighted-average valuation and conversion allocation tests passed')
