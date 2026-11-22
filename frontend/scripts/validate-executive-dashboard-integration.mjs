import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { executeModuleAnalysis } from '../src/features/modules/moduleAnalysisWorkflow.js'
import { loadExecutiveDashboardReports } from '../src/features/modules/executiveDashboardData.js'

const costKey='module-intelligence:MOD-02:v1'
const productionKey='module-intelligence:MOD-03:v1'
function memoryStore(initial={}) {
  const values=new Map(Object.entries(initial))
  return {
    get:async key=>values.get(key),
    set:async(key,value)=>values.set(key,value),
    values,
  }
}
const costInput={outputTon:'100',material:'4000',labor:'1000',energy:'500',maintenance:'300',overhead:'200',sellingPrice:'80'}
const productionInput={plannedMinutes:'480',downtimeMinutes:'60',idealCycleSeconds:'30',totalCount:'700',goodCount:'665'}
const at=day=>`2026-06-${String(day).padStart(2,'0')}T10:00:00.000Z`

test('empty MOD-02/MOD-03 store produces explicit empty dashboard datasets',async()=>{
 const dashboard=await loadExecutiveDashboardReports(memoryStore())
 assert.deepEqual(dashboard,{cost:[],production:[]})
})

test('actual MOD-02 and MOD-03 analysis workflow persists reports consumed by MOD-01',async()=>{
 const store=memoryStore()
 const cost=await executeModuleAnalysis('MOD-02',costInput,store,at(1))
 const production=await executeModuleAnalysis('MOD-03',productionInput,store,at(1))
 const dashboard=await loadExecutiveDashboardReports(store)
 assert.equal(cost.metrics.totalCost,6000)
 assert.equal(cost.metrics.unitCost,60)
 assert.equal(production.metrics.availability,87.5)
 assert.equal(dashboard.cost[0].id,cost.id)
 assert.equal(dashboard.cost[0].metrics.grossMarginPerTon,20)
 assert.equal(dashboard.production[0].id,production.id)
 assert.ok(Math.abs(dashboard.production[0].metrics.oee-69.27083333333333)<1e-9)
})

test('several real executions preserve history and MOD-01 selects latest valid report',async()=>{
 const store=memoryStore()
 await executeModuleAnalysis('MOD-02',costInput,store,at(1))
 await executeModuleAnalysis('MOD-02',{...costInput,material:'5000'},store,at(2))
 await executeModuleAnalysis('MOD-03',productionInput,store,at(1))
 await executeModuleAnalysis('MOD-03',{...productionInput,goodCount:'690'},store,at(3))
 const dashboard=await loadExecutiveDashboardReports(store)
 assert.equal(dashboard.cost.length,2)
 assert.equal(dashboard.cost[0].createdAt,at(2))
 assert.equal(dashboard.cost[0].metrics.unitCost,70)
 assert.equal(dashboard.production.length,2)
 assert.equal(dashboard.production[0].createdAt,at(3))
 assert.equal(dashboard.production[0].metrics.quality,690/700*100)
})

test('dashboard refresh reads reports created after the previous read',async()=>{
 const store=memoryStore()
 assert.equal((await loadExecutiveDashboardReports(store)).cost.length,0)
 await executeModuleAnalysis('MOD-02',costInput,store,at(4))
 await executeModuleAnalysis('MOD-03',productionInput,store,at(4))
 const refreshed=await loadExecutiveDashboardReports(store)
 assert.equal(refreshed.cost.length,1)
 assert.equal(refreshed.production.length,1)
})

test('incomplete or invalid source input is rejected without writing a report',async()=>{
 const store=memoryStore()
 await assert.rejects(executeModuleAnalysis('MOD-02',{...costInput,energy:''},store,at(1)),/تکمیل/)
 await assert.rejects(executeModuleAnalysis('MOD-03',{...productionInput,goodCount:'800'},store,at(1)),/کنترل/)
 assert.equal(store.values.has(costKey),false)
 assert.equal(store.values.has(productionKey),false)
})

test('failed localStore write propagates and no dashboard report is fabricated',async()=>{
 const store=memoryStore()
 store.set=async()=>{throw new Error('quota exceeded')}
 await assert.rejects(executeModuleAnalysis('MOD-02',costInput,store,at(1)),/quota exceeded/)
 await assert.rejects(executeModuleAnalysis('MOD-03',productionInput,store,at(1)),/quota exceeded/)
 assert.deepEqual(await loadExecutiveDashboardReports(store),{cost:[],production:[]})
})

test('MOD-01 ignores incomplete metric payloads and invalid dates',async()=>{
 const store=memoryStore({
  [costKey]:[
   {id:'bad-metrics',moduleId:'MOD-02',createdAt:at(6),metrics:{unitCost:10}},
   {id:'bad-date',moduleId:'MOD-02',createdAt:'not-a-date',metrics:{unitCost:10,grossMarginPerTon:2,grossMarginPercent:20}},
  ],
  [productionKey]:[{id:'partial',moduleId:'MOD-03',createdAt:at(6),metrics:{oee:90}}],
 })
 assert.deepEqual(await loadExecutiveDashboardReports(store),{cost:[],production:[]})
})

test('the real module form delegates calculations and persistence to the tested workflow',async()=>{
 const source=await readFile(new URL('../src/features/modules/ModuleIntelligencePanel.tsx',import.meta.url),'utf8')
 assert.match(source,/executeModuleAnalysis\(moduleId/)
 assert.match(source,/localStore\)/)
 const dashboard=await readFile(new URL('../src/features/modules/ExecutiveDashboardPanel.tsx',import.meta.url),'utf8')
 assert.match(dashboard,/loadExecutiveDashboardReports\(localStore\)/)
 assert.match(dashboard,/onClick=\{\(\)=>void refresh\(\)\}/)
})
