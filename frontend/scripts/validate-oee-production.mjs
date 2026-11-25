import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateOee,aggregateLineOee,calculateStationOees,summarizeLosses,OEE_STORAGE_KEY,saveOeeAnalysis} from '../src/features/modules/oeeProductionEngine.js'
const example={plannedMinutes:'420',downtimeMinutes:'47',idealCycleSeconds:'1',totalCount:'19271',goodCount:'18848'}
test('two OEE methods reconcile on Vorne example',()=>{const r=calculateOee(example);assert.ok(Math.abs(r.oee-74.7937)<0.001);assert.ok(Math.abs(r.oee-r.directOee)<1e-9);assert.equal(r.variance,0)})
test('line OEE uses line throughput and is not a mean of stations',()=>{const r=aggregateLineOee(example);assert.equal(r.oee,calculateOee(example).oee)})
test('stations calculate independently',()=>{const rows=calculateStationOees([{id:'a',name:'A',...example},{id:'b',name:'B',...example,goodCount:'18000'}]);assert.equal(rows.length,2);assert.notEqual(rows[0].result.oee,rows[1].result.oee)})
test('input validation rejects downtime beyond planned time',()=>{assert.throws(()=>calculateOee({...example,downtimeMinutes:'421'}),/توقفات/)})
test('input validation rejects good count greater than total',()=>{assert.throws(()=>calculateOee({...example,goodCount:'20000'}),/تولید سالم/)})
test('loss summary groups time by loss category',()=>{const r=summarizeLosses([{category:'breakdown',minutes:12},{category:'breakdown',minutes:8},{category:'speed',minutes:5}]);assert.equal(r[0].minutes,20)})
test('reports persist in an independent MOD-03 key',async()=>{const values=new Map();const store={get:async k=>values.get(k),set:async(k,v)=>values.set(k,v)};const r=await saveOeeAnalysis(store,{moduleId:'MOD-03',lineMetrics:calculateOee(example)});assert.equal(values.has(OEE_STORAGE_KEY),true);assert.equal(r.moduleId,'MOD-03')})
