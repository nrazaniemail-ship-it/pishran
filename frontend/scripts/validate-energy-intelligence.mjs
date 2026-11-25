import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildEnergySeries,detectEnergyAnomalies,detectForecastDeviations,forecastEnergyIntensity,allocateGasBillCost,allocateWaterBillCost,prepareModule02GasCostPosting} from '../src/features/modules/energyIntelligenceEngine.js'
const row=(id,period,consumption,production=100,cost=consumption*.5,extra={})=>({id,resource:'electricity',period,site:'Plant',seu:'Rolling',consumption,production,cost,...extra})

test('multi-period series never compares different sites or significant energy uses',()=>{
 const data=[row('a','1405/01',100),row('b','1405/02',90),{...row('c','1405/02',200),site:'Other'}, {...row('d','1405/03',300),seu:'Furnace'}]
 const result=buildEnergySeries(data,{resource:'electricity'})
 assert.equal(result.series.length,3)
 const rolling=result.series.find(x=>x.site==='Plant'&&x.seu==='Rolling')
 assert.ok(Math.abs(rolling.points[1].intensityChangePercent+10)<1e-9)
 assert.ok(Math.abs(rolling.points[1].periodChangePercent+10)<1e-9)
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

test('water bill allocation reconciles separately declared charges, residual and physical drivers',()=>{
 const result=allocateWaterBillCost({bill:{id:'W-1',billNumber:'W-10',period:'1405/07',amount:120,volumeCharge:60,sewerCharge:20,fixedCharge:10,taxCharge:10,otherCharges:5},consumers:[{id:'A',waterM3:60,wastewaterM3:20,productionTon:60},{id:'B',waterM3:40,wastewaterM3:10,productionTon:40}]})
 assert.equal(result.allocatedTotal,120)
 assert.equal(result.componentTotal,105)
 assert.equal(result.residual,15)
 assert.equal(result.allocations.reduce((s,x)=>s+x.otherCharges,0),5)
 assert.equal(result.allocations.reduce((s,x)=>s+x.unclassifiedCharges,0),15)
 assert.equal(result.allocations.reduce((s,x)=>s+x.fixedCharge,0),10)
 assert.equal(result.sourceReference.type,'MOD-05-water-bill')
 assert.ok(result.warnings.some(x=>x.includes('باقیمانده تفکیک‌نشده')))
})
test('water bill allocation rejects missing volume or wastewater drivers',()=>{
 assert.throws(()=>allocateWaterBillCost({bill:{amount:100,volumeCharge:100},consumers:[{id:'A',waterM3:0}]}),/حجم آب/)
 assert.throws(()=>allocateWaterBillCost({bill:{amount:100,sewerCharge:100},consumers:[{id:'A',waterM3:10,wastewaterM3:0}]}),/حجم فاضلاب/)
})

test('gas allocation rejects missing volume and thermal drivers rather than inventing shares',()=>{
 assert.throws(()=>allocateGasBillCost({bill:{amount:100,volumeCharge:100},consumers:[{id:'A',gasNm3:0}]}),/حجم گاز/)
 assert.throws(()=>allocateGasBillCost({bill:{amount:100,thermalCharge:100},consumers:[{id:'A',gasNm3:10}]}),/انرژی حرارتی/)
})

test('gas allocation keeps declared other charges separate from unclassified residual',()=>{
 const result=allocateGasBillCost({bill:{id:'G-3',amount:150,volumeCharge:60,otherCharges:30},consumers:[{id:'A',gasNm3:60},{id:'B',gasNm3:40}]})
 assert.equal(result.allocatedTotal,150)
 assert.equal(result.componentTotal,90)
 assert.equal(result.residual,60)
 assert.equal(result.allocations.reduce((s,x)=>s+x.otherCharges,0),30)
 assert.equal(result.allocations.reduce((s,x)=>s+x.unclassifiedCharges,0),60)
 assert.equal(result.allocationRules.otherCharges,'gasNm3')
 assert.ok(result.warnings.some(x=>x.includes('باقیمانده تفکیک‌نشده')))
})

test('gas allocation falls back to equal fixed-charge shares only with an explicit warning',()=>{
 const result=allocateGasBillCost({bill:{id:'G-2',amount:100,fixedCharge:20,volumeCharge:80},consumers:[{id:'A',gasNm3:60},{id:'B',gasNm3:40}]})
 assert.equal(result.allocatedTotal,100)
 assert.equal(result.allocations[0].fixedCharge,10)
 assert.ok(result.warnings.some(x=>x.includes('ظرفیت قراردادی')))
})

test('rolling-origin forecast deviation compares latest actual with a forecast built only from prior periods',()=>{
 const stable=[100,101,99,102,160].map((v,i)=>row('fd'+i,'1405/0'+(i+1),v*100))
 const result=detectForecastDeviations(stable,{resource:'electricity'})
 assert.equal(result.deviations.length,1)
 assert.equal(result.deviations[0].period,'1405/05')
 assert.ok(result.deviations[0].actualIntensity>result.deviations[0].predictedIntensity)
 assert.deepEqual(result.deviations[0].trainingPeriods,['1405/01','1405/02','1405/03','1405/04'])
})

test('gas cost allocation panel uses the tested thermal and contracted-capacity drivers and prevents duplicate invoice allocation',()=>{
 const source=readFileSync(new URL('../src/features/modules/ResourceBillCostAllocationPanel.tsx',import.meta.url),'utf8')
 assert.match(source,/allocateGasBillCost/)
 assert.match(source,/gasGJ:numeric\(x\.thermalEnergyGJ\)/)
 assert.match(source,/fixedCapacityShare:numeric\(x\.fixedCapacityShare\)/)
 assert.match(source,/thermalCharge/)
 assert.match(source,/allocateWaterBillCost/)
 assert.match(source,/waterM3:numeric\(x\.consumption\)/)
 assert.match(source,/otherCharges:numeric\(bill\.otherCharges\)/)
 assert.match(source,/برای این قبض قبلاً تخصیص ثبت شده است/)
 const engine=readFileSync(new URL('../src/features/modules/energyIntelligenceEngine.js',import.meta.url),'utf8')
 assert.match(engine,/هزینه ثابت آب به‌صورت مساوی بین مراکز هزینه توزیع شده است/)
 const electricity=readFileSync(new URL('../src/features/modules/EnergyCostAllocationPanel.tsx',import.meta.url),'utf8')
 assert.match(electricity,/ENERGY_COST_ALLOCATIONS_KEY/)
 assert.match(electricity,/This invoice has already been allocated|برای این قبض قبلاً تخصیص ثبت شده است/)
})


test('MOD-05 specification documents the implemented advanced scope and does not describe delivered capabilities as future work',async()=>{
 const {readFile}=await import('node:fs/promises')
 const spec=await readFile(new URL('../../docs/modules/MOD-05-ISO-50000-ENERGY-MANAGEMENT.md',import.meta.url),'utf8')
 assert.match(spec,/rolling-origin multivariable OLS screening model/i)
 assert.match(spec,/optional drivers/i)
 assert.match(spec,/water-balances:v1/)
 assert.match(spec,/resource-cost-allocations:v1/)
 assert.match(spec,/meter calibration register/)
 assert.doesNotMatch(spec,/A future model-based normalization/)
 assert.doesNotMatch(spec,/Advanced regression normalization, multi-variable adjustment.*remain follow-on work/)
})
