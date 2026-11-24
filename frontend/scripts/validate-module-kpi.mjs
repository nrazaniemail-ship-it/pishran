import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateModuleKpi, executeModuleKpi, KPI_HISTORY_KEY } from '../src/features/modules/moduleKpiWorkflow.js'

test('higher-is-better KPI marks positive variance favorable', () => {
  const result = calculateModuleKpi({name:'Availability',unit:'%',period:'1405-08',target:'95',actual:'97',direction:'higher'})
  assert.equal(result.status,'favorable')
  assert.equal(result.variance,2)
  assert.equal(result.variancePercent,2/95*100)
})

test('lower-is-better KPI marks negative variance favorable', () => {
  const result = calculateModuleKpi({name:'Energy intensity',unit:'kWh/t',period:'1405-08',target:'520',actual:'500',direction:'lower'})
  assert.equal(result.status,'favorable')
  assert.equal(result.variance,-20)
})

test('rejects missing, invalid and zero target data', () => {
  assert.throws(()=>calculateModuleKpi({name:'',unit:'%',period:'P1',target:'10',actual:'9',direction:'higher'}))
  assert.throws(()=>calculateModuleKpi({name:'KPI',unit:'%',period:'P1',target:'0',actual:'9',direction:'higher'}))
  assert.throws(()=>calculateModuleKpi({name:'KPI',unit:'%',period:'P1',target:'10',actual:'-1',direction:'higher'}))
})

test('stores KPI report history without losing previous records', async () => {
  const values = new Map()
  const store = {get:key=>values.get(key)??null,set:(key,value)=>values.set(key,value)}
  const first = await executeModuleKpi({name:'Yield',unit:'%',period:'P1',target:'90',actual:'92',direction:'higher'},store,'2026-11-23T10:00:00.000Z')
  const second = await executeModuleKpi({name:'Yield',unit:'%',period:'P2',target:'90',actual:'88',direction:'higher'},store,'2026-11-23T11:00:00.000Z')
  assert.equal(first.status,'favorable')
  assert.equal(second.status,'unfavorable')
  assert.equal(values.get(KPI_HISTORY_KEY).length,2)
})
