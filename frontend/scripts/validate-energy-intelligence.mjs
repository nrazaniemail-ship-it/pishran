import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEnergySeries,detectEnergyAnomalies,forecastEnergyIntensity,allocateGasBillCost,prepareModule02GasCostPosting} from '../src/features/modules/energyIntelligenceEngine.js'
const row=(id,period,consumption,production=100,cost=consumption*.5,extra={})=>({id,resource:'electricity',period,site:'Plant',seu:'Rolling',consumption,production,cost,...extra})

test('multi-period series never compares different sites or significant energy uses',()=>{
 const data=[row('a','1405/01',100),row('b','1405/02',90),{...row('c','1405/02',200),site:'Other'}, {...row('d','1405/03',300),seu:'Furnace'}]
 const result=buildEnergySeries(data,{resource:'electricity'})
 assert.equal(result.series.length,3)
 const rolling=result.series.find(x=>x.site==='Plant'&&x.seu==='Rolling')
 assert.equal(rolling.points[1].intensityChangePercent,-10)
 assert.equal(rolling.points[1].periodChangePercent,-10)
})

test('gas trend uses one consistent thermal basis across the whole series or falls back entirely to volume',()=>{
 const common={resource:'gas',site:'Plant',seu:'Furnace',production:10,cost:20}
 const matching=[{...common,id:'g1',period:'1405/01',consumption:100,gasEnergyKwh:1000,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'},{...common,id:'g2',period:'1405/02',consumption:110,gasEnergyKwh:990,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'}]
 assert.equal(buildEnergySeries(matching).series[0].points[1].intensity,99)
 const mismatch=[...matching,{...common,id:'g3',period:'1405/03',consumption:105,gasEnergyKwh:1050,calorificBasis:'gross',gasReferenceConditions:'15C/101.325kPa'}]
 const fallback=buildEnergySeries(mismatch).series[0]
 assert.equal(fallback.comparisonBasis,'volume-or-resource')
 assert.equal(fallback.points[1].intensity,11)
})

test('forecast requires three periods and predicts production-normalized consumption transparently',()=>{
 const data=[row('a','1405/01',1000,100),row('b','1405/02',900,100),row('c','1405/03',800,100)]
 const result=forecastEnergyIntensity(data,{resource:'electricity',horizon:2,futureProduction:[120,100]})
 assert.equal(result.forecasts[0].forecast[0].predictedIntensity,7)
 assert.equal(result.forecasts[0].forecast[0].predictedConsumption,840)
 assert.ok(result.warnings.some(x=>x.includes('RMSE')))
 assert.equal(forecastEnergyIntensity(data.slice(0,2),{resource:'electricity'}).forecasts.length,0)
})

test('robust anomaly screen identifies a material last-period intensity jump',()=>{
 const data=[row('a','1405/01',1000),row('b','1405/02',1010),row('c','1405/03',990),row('d','1405/04',1005),row('e','1405/05',1400)]
 const result=detectEnergyAnomalies(data,{resource:'electricity'})
 assert.ok(result.anomalies.some(x=>x.metric==='intensity'&&x.direction==='above'))
})

test('gas invoice allocation reconciles volume, thermal, transport, fixed and tax charges',()=>{
 const allocation=allocateGasBillCost({bill:{id:'GB-1',billNumber:'G-1',period:'1405/07',amount:1000,volumeCharge:400,thermalCharge:200,transportCharge:100,fixedCharge:100,taxCharge:100},consumers:[{id:'A',gasNm3:60,gasGJ:30,fixedCapacityShare:3,productionTon:60},{id:'B',gasNm3:40,gasGJ:10,fixedCapacityShare:1,productionTon:40}]})
 assert.equal(allocation.allocatedTotal,1000)
 assert.equal(allocation.allocations.reduce((s,x)=>s+x.volumeCharge,0),400)
 assert.equal(allocation.allocations.reduce((s,x)=>s+x.thermalCharge,0),200)
 assert.equal(allocation.allocations.reduce((s,x)=>s+x.fixedCharge,0),100)
 assert.ok(Math.abs(allocation.allocations[0].costPerTon-10.84375)<1e-9)
 const prepared=prepareModule02GasCostPosting({baseInput:{energy:'10',material:'100'},allocation,costCenterId:'A'})
 assert.ok(Math.abs(Number(prepared.input.energy)-660.625)<1e-9)
 assert.equal(prepared.sourceReferences.gasBillId,'GB-1')
})

test('gas allocation rejects missing volume and thermal drivers rather than inventing shares',()=>{
 assert.throws(()=>allocateGasBillCost({bill:{amount:100,volumeCharge:100},consumers:[{id:'A',gasNm3:0}]}),/حجم گاز/)
 assert.throws(()=>allocateGasBillCost({bill:{amount:100,thermalCharge:100},consumers:[{id:'A',gasNm3:10}]}),/انرژی حرارتی/)
})
