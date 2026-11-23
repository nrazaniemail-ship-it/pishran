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

test('MOD-02 accepts gas and water cost-center allocations with invoice provenance',async()=>{
 const store=memoryStore()
 for(const resource of ['gas','water']){
  const source={energyAllocationId:'RCA-'+resource,energyBillId:'BILL-'+resource,billingPeriod:'1405/08',billNumber:'INV-'+resource,energyAllocationCenter:'CC-UTIL',energyAllocationCost:250,energyAllocationBasis:'MOD-05 '+resource+' resource allocation'}
  const result=await executeModuleAnalysis('MOD-02',{outputTon:'10',material:'100',labor:'20',energy:'250',maintenance:'10',overhead:'20',sellingPrice:'50'},store,'2026-11-23T15:00:00.000Z',source)
  assert.equal(result.metrics.totalCost,400)
  assert.equal(result.sourceReferences.energyBillId,'BILL-'+resource)
  assert.equal(result.sourceReferences.energyAllocationCenter,'CC-UTIL')
  assert.equal(result.sourceReferences.energyAllocationBasis,'MOD-05 '+resource+' resource allocation')
 }
})

test('MOD-02 UI reads saved gas and water allocations and replaces energy cost with selected center share',async()=>{
 const {readFile}=await import('node:fs/promises')
 const source=await readFile(new URL('../src/features/modules/ModuleIntelligencePanel.tsx',import.meta.url),'utf8')
 assert.match(source,/module-intelligence:MOD-05:resource-cost-allocations:v1/)
 assert.match(source,/localStore\.get<SavedResourceAllocation\[]>\(RESOURCE_COST_ALLOCATIONS_KEY\)/)
 assert.match(source,/setCost\(x=>\(\{\.\.\.x,energy:String\(selectedResourceCenter\.totalCost\)\}\)\)/)
 assert.match(source,/appliedResourceAllocation\?\?Number\(cost\.energy\)===appliedResourceAllocation\.totalCost/)
 assert.match(source,/energyAllocationBasis:'MOD-05 '\+appliedResourceAllocation\.resource\+' resource allocation'/)
})
