import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAINTENANCE_ASSETS_KEY, MAINTENANCE_ORDERS_KEY,
  saveMaintenanceAsset, saveMaintenanceOrder, validateMaintenanceAsset,
  validateMaintenanceOrder, calculateAssetReliability, saveReliabilitySnapshot,
  updateMaintenanceOrderStatus,
} from '../src/features/modules/maintenanceWorkflow.js'

function createStore(){
  const data=new Map()
  return {data,get:async key=>data.get(key),set:async(key,value)=>data.set(key,value)}
}
const assetInput={assetTag:'PMP-101',name:'Main cooling pump',area:'Utilities',criticality:'critical',commissionedAt:'2020-01-01',replacementCost:'250000'}
const orderInput={assetId:'asset-1',orderNumber:'WO-101',kind:'corrective',status:'completed',openedAt:'2026-11-02',completedAt:'2026-11-03',downtimeHours:'6',repairHours:'4',laborHours:'5',laborCost:'500',materialCost:'900',estimatedHours:'0',failureMode:'Bearing failure',description:'Replace bearing'}

test('asset master validates required identity, criticality and replacement cost',()=>{
  assert.throws(()=>validateMaintenanceAsset({...assetInput,assetTag:''}),/کد تجهیز الزامی/)
  assert.throws(()=>validateMaintenanceAsset({...assetInput,criticality:'urgent'}),/بحرانی‌بودن/)
  assert.throws(()=>validateMaintenanceAsset({...assetInput,replacementCost:'-1'}),/نامنفی/)
  assert.throws(()=>validateMaintenanceAsset({...assetInput,commissionedAt:'2026-02-30'}),/تاریخ راه‌اندازی معتبر نیست/)
})

test('asset register rejects duplicate asset tags and persists locally',async()=>{
  const store=createStore()
  const first=await saveMaintenanceAsset(assetInput,store,'2026-11-24T08:00:00Z')
  assert.equal(first.assetTag,'PMP-101')
  assert.equal((await store.get(MAINTENANCE_ASSETS_KEY)).length,1)
  await assert.rejects(()=>saveMaintenanceAsset(assetInput,store,'2026-11-24T08:01:00Z'),/تکراری/)
})

test('work orders require a registered asset, valid lifecycle and valid dates',()=>{
  assert.throws(()=>validateMaintenanceOrder(orderInput,[]),/شناسنامه دارایی/)
  const asset={id:'asset-1',assetTag:'PMP-101',name:'Pump',criticality:'high'}
  assert.throws(()=>validateMaintenanceOrder({...orderInput,completedAt:'2026-11-01'},[asset]),/قبل از تاریخ شروع/)
  assert.throws(()=>validateMaintenanceOrder({...orderInput,status:'completed',completedAt:''},[asset]),/تاریخ تکمیل الزامی/)
  assert.throws(()=>validateMaintenanceOrder({...orderInput,downtimeHours:'-2'},[asset]),/نامنفی/)
  assert.throws(()=>validateMaintenanceOrder({...orderInput,kind:'preventive',dueAt:''},[asset]),/سررسید دستورکار پیشگیرانه/)
  assert.equal(validateMaintenanceOrder(orderInput,[asset]).priority,'high')
})

test('work order creation stores asset lineage and prevents duplicate order numbers',async()=>{
  const store=createStore()
  await store.set(MAINTENANCE_ASSETS_KEY,[{id:'asset-1',assetTag:'PMP-101',name:'Pump'}])
  const saved=await saveMaintenanceOrder(orderInput,store,'2026-11-24T08:00:00Z')
  assert.equal(saved.assetTag,'PMP-101')
  assert.equal(saved.assetName,'Pump')
  assert.equal((await store.get(MAINTENANCE_ORDERS_KEY)).length,1)
  await assert.rejects(()=>saveMaintenanceOrder(orderInput,store,'2026-11-24T08:01:00Z'),/تکراری/)
})

test('reliability indicators calculate MTBF, MTTR, availability, PM compliance and backlog',()=>{
  const asset={id:'asset-1',assetTag:'PMP-101',name:'Pump'}
  const orders=[
    {id:'1',assetId:'asset-1',kind:'corrective',status:'completed',openedAt:'2026-11-02',downtimeHours:6,repairHours:4,laborCost:500,materialCost:900,estimatedHours:0},
    {id:'2',assetId:'asset-1',kind:'corrective',status:'completed',openedAt:'2026-11-12',downtimeHours:6,repairHours:6,laborCost:400,materialCost:700,estimatedHours:0},
    {id:'3',assetId:'asset-1',kind:'preventive',status:'completed',openedAt:'2026-11-05',dueAt:'2026-11-10',completedAt:'2026-11-10',downtimeHours:0,repairHours:0,laborCost:100,materialCost:0,estimatedHours:0},
    {id:'4',assetId:'asset-1',kind:'preventive',status:'planned',openedAt:'2026-11-08',dueAt:'2026-11-15',downtimeHours:0,repairHours:0,laborCost:0,materialCost:0,estimatedHours:3},
    {id:'5',assetId:'asset-1',kind:'inspection',status:'in-progress',openedAt:'2026-11-20',dueAt:null,downtimeHours:0,repairHours:0,laborCost:0,materialCost:0,estimatedHours:2},
    {id:'6',assetId:'asset-1',kind:'corrective',status:'cancelled',openedAt:'2026-11-21',downtimeHours:100,repairHours:100,laborCost:0,materialCost:0,estimatedHours:0},
    {id:'7',assetId:'other',kind:'corrective',status:'completed',openedAt:'2026-11-02',downtimeHours:99,repairHours:99,laborCost:0,materialCost:0,estimatedHours:0},
    {id:'8',assetId:'asset-1',kind:'preventive',status:'completed',openedAt:'2026-10-20',dueAt:'2026-11-12',completedAt:'2026-11-20',downtimeHours:0,repairHours:0,laborCost:0,materialCost:0,estimatedHours:0},
    {id:'9',assetId:'asset-1',kind:'preventive',status:'planned',openedAt:'2026-10-20',dueAt:'2026-10-25',downtimeHours:0,repairHours:0,laborCost:0,materialCost:0,estimatedHours:4},
  ]
  const result=calculateAssetReliability({asset,workOrders:orders,operatingHours:100,startDate:'2026-11-01',endDate:'2026-11-30'})
  assert.equal(result.failureCount,2)
  assert.equal(result.mtbfHours,50)
  assert.equal(result.mttrHours,5)
  assert.equal(result.downtimeHours,12)
  assert.ok(Math.abs(result.availabilityPercent-89.2857142857)<1e-8)
  assert.equal(result.pmDue,3)
  assert.equal(result.pmCompleted,1)
  assert.equal(result.pmCompliancePercent,50)
  assert.equal(result.backlogCount,3)
  assert.equal(result.backlogEstimatedHours,9)
  assert.equal(result.maintenanceCost,2600)
})

test('reliability analysis rejects zero operating hours and reversed periods',()=>{
  const asset={id:'asset-1',assetTag:'PMP-101',name:'Pump'}
  assert.throws(()=>calculateAssetReliability({asset,operatingHours:0,startDate:'2026-11-01',endDate:'2026-11-30'}),/بزرگ‌تر از صفر/)
  assert.throws(()=>calculateAssetReliability({asset,operatingHours:100,startDate:'2026-11-30',endDate:'2026-11-01'}),/قبل از شروع/)
})

test('reliability snapshots persist per-asset period and status updates stamp completion date',async()=>{
  const store=createStore()
  await store.set(MAINTENANCE_ASSETS_KEY,[{id:'asset-1',assetTag:'PMP-101',name:'Pump'}])
  await store.set(MAINTENANCE_ORDERS_KEY,[{id:'wo-1',assetId:'asset-1',orderNumber:'WO-1',kind:'corrective',status:'in-progress',openedAt:'2026-11-02',downtimeHours:2,repairHours:1,laborCost:0,materialCost:0,estimatedHours:2}])
  const saved=await saveReliabilitySnapshot({assetId:'asset-1',operatingHours:'50',startDate:'2026-11-01',endDate:'2026-11-30'},store,'2026-11-24T08:00:00Z')
  assert.equal(saved.mtbfHours,null)
  assert.equal((await store.get('maintenance:reliability:v1')).length,1)
  const updated=await updateMaintenanceOrderStatus('wo-1','completed',store,'2026-11-24T09:00:00Z')
  assert.equal(updated.status,'completed')
  assert.equal(updated.completedAt,'2026-11-24')
})

test('open corrective failures affect MTBF while MTTR uses completed repairs only',()=>{
  const asset={id:'asset-1',assetTag:'PMP-101',name:'Pump'}
  const result=calculateAssetReliability({asset,operatingHours:120,startDate:'2026-11-01',endDate:'2026-11-30',workOrders:[
    {id:'done',assetId:'asset-1',kind:'corrective',status:'completed',openedAt:'2026-11-05',downtimeHours:5,repairHours:3,laborCost:0,materialCost:0},
    {id:'open',assetId:'asset-1',kind:'corrective',status:'in-progress',openedAt:'2026-11-20',downtimeHours:2,repairHours:1,laborCost:0,materialCost:0},
  ]})
  assert.equal(result.failureCount,2)
  assert.equal(result.mtbfHours,60)
  assert.equal(result.mttrHours,3)
  assert.equal(result.downtimeHours,7)
})
