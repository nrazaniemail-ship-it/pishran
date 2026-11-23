import test from 'node:test'
import assert from 'node:assert/strict'
import { executeModuleAnalysis } from '../src/features/modules/moduleAnalysisWorkflow.js'

function memoryStore(){
 const values=new Map()
 return {get:key=>values.get(key)??null,set:(key,value)=>values.set(key,value),values}
}

test('MOD-02 calculates energy cost using the applied electricity bill amount and retains its source',async()=>{
 const store=memoryStore()
 const bill={energyBillId:'EB-123',billingPeriod:'1405/07',billNumber:'B-77',accountNumber:'A-12',meterNumber:'M-9',energyBillAmountBasis:'operational',energyBillAmount:125000}
 const result=await executeModuleAnalysis('MOD-02',{outputTon:'100',material:'500000',labor:'100000',energy:'125000',maintenance:'25000',overhead:'50000',sellingPrice:'10000'},store,'2026-11-23T10:00:00.000Z',bill)
 assert.equal(result.metrics.totalCost,800000)
 assert.equal(result.metrics.unitCost,8000)
 assert.equal(result.sourceReferences.energyBillId,'EB-123')
 assert.equal(result.sourceReferences.energyBillAmountBasis,'operational')
 assert.equal(result.sourceReferences.energyBillAmount,125000)
 assert.equal(store.values.get('module-intelligence:MOD-02:v1')[0].id,result.id)
})

test('MOD-02 records without an imported bill do not claim bill provenance',async()=>{
 const store=memoryStore()
 const result=await executeModuleAnalysis('MOD-02',{outputTon:'10',material:'100',labor:'20',energy:'30',maintenance:'10',overhead:'40',sellingPrice:'30'},store,'2026-11-23T11:00:00.000Z')
 assert.deepEqual(result.sourceReferences,{})
})
