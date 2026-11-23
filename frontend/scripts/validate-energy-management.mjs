import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateEnergyPerformance,validateEnergyRecord,saveEnergyBaseline,saveEnergyRecord,saveEnergyAction,ENERGY_DATA_KEY,ENERGY_BASELINES_KEY,ENERGY_ACTIONS_KEY} from '../src/features/modules/energyManagementWorkflow.js'
test('electricity gas and water retain distinct units',()=>{for(const [resource,unit] of [['electricity','kWh'],['gas','Nm³'],['water','m³']])assert.equal(validateEnergyRecord({resource,period:'P1',site:'Plant',seu:'Main',consumption:'100',production:'10',cost:'5'}).unit,unit)})
test('meter readings must reconcile to recorded consumption',()=>assert.throws(()=>validateEnergyRecord({resource:'electricity',period:'P1',site:'Plant',seu:'Mill',consumption:'20',production:'1',cost:'1',startReading:'100',endReading:'119'})))
test('baseline is normalized to actual production',()=>{const x=calculateEnergyPerformance({resource:'electricity',baseline:{consumption:1000,production:10},actual:{consumption:900,production:10}});assert.equal(x.baselineIntensity,100);assert.equal(x.normalizedBaseline,1000);assert.equal(x.savings,100);assert.equal(x.status,'improved')})
test('higher use than normalized baseline is worsened',()=>assert.equal(calculateEnergyPerformance({resource:'gas',baseline:{consumption:100,production:10},actual:{consumption:120,production:10}}).status,'worsened'))
test('stores utility records baselines and improvement actions separately',async()=>{const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v),update:async(k,f)=>{const v=f(m.get(k));m.set(k,v);return v}};const r=await saveEnergyRecord({resource:'water',period:'P1',site:'Plant',seu:'Cooling',consumption:'25',production:'5',cost:'12'},s,'2026-11-23T10:00:00Z');const b=await saveEnergyBaseline({resource:'water',period:'BASE',site:'Plant',seu:'Cooling',consumption:'30',production:'5'},s,'2026-11-23T11:00:00Z');const a=await saveEnergyAction({resource:'water',title:'Leak reduction',owner:'Utilities',dueDate:'2026-12-01',expectedSavings:'5'},s,'2026-11-23T12:00:00Z');assert.equal(r.unit,'m³');assert.equal(b.intensity,6);assert.equal(a.expectedSavings,5);assert.equal(m.get(ENERGY_DATA_KEY).length,1);assert.equal(m.get(ENERGY_BASELINES_KEY).length,1);assert.equal(m.get(ENERGY_ACTIONS_KEY).length,1)})

test('gas volume is converted only with a positive supplied calorific value',()=>{const x=validateEnergyRecord({resource:'gas',period:'P1',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200'});assert.equal(x.calorificValue,null);assert.equal(x.gasEnergyKwh,null);const y=validateEnergyRecord({resource:'gas',period:'P2',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200',calorificValue:'10.5'});assert.equal(y.gasEnergyKwh,10500);assert.throws(()=>validateEnergyRecord({resource:'gas',period:'P3',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200',calorificValue:'0'}))})
test('advanced gas indicators report GJ and energy intensity without assuming calorific value',async()=>{const {analyzeGasUtility}=await import('../src/features/modules/energyManagementWorkflow.js');const x=analyzeGasUtility({consumptionNm3:1000,calorificValueKwhPerNm3:10,productionTon:20,cost:500});assert.equal(x.energyKwh,10000);assert.equal(x.energyGJ,36);assert.equal(x.specificEnergyKwhPerTon,500);assert.equal(x.costPerGJ,500/36)})
test('water balance excludes internal recirculation from external boundary inputs',async()=>{const {analyzeWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js');const x=analyzeWaterBalance({freshwaterM3:80,externalReuseM3:20,internalRecirculationM3:200,dischargeM3:30,evaporationM3:40,productIncorporationM3:20,inventoryIncreaseM3:10,productionTon:10});assert.equal(x.boundaryInput,100);assert.equal(x.accountedOutput,100);assert.equal(x.balanceGap,0);assert.equal(x.withdrawalIntensity,8);assert.equal(x.internalRecirculationIntensity,20);assert.equal(x.externalReuseSharePercent,20)})
test('water balance flags an unclosed boundary and rejects negative flows',async()=>{const {analyzeWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js');assert.ok(analyzeWaterBalance({freshwaterM3:100,dischargeM3:20,productionTon:10}).warnings.length);assert.throws(()=>analyzeWaterBalance({freshwaterM3:-1,productionTon:10}))})

test('MOD-02 stores the selected electricity bill as an auditable energy-cost source',async()=>{const {executeModuleAnalysis}=await import('../src/features/modules/moduleAnalysisWorkflow.js');const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};const saved=await executeModuleAnalysis('MOD-02',{outputTon:'10',material:'100',labor:'20',energy:'50',maintenance:'10',overhead:'20',sellingPrice:'30'},s,'2026-11-23T13:00:00Z',{energyBillId:'EB-1',billingPeriod:'1405/07',billNumber:'B-10'});assert.equal(saved.metrics.totalCost,200);assert.deepEqual(saved.sourceReferences,{energyBillId:'EB-1',billingPeriod:'1405/07',billNumber:'B-10'});assert.equal(m.get('module-intelligence:MOD-02:v1')[0].sourceReferences.energyBillId,'EB-1')})
test('water balance history is persisted separately from energy totals',async()=>{const {saveWaterBalance,WATER_BALANCE_KEY}=await import('../src/features/modules/energyManagementWorkflow.js');const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v),update:async(k,f)=>{const v=f(m.get(k));m.set(k,v);return v}};const saved=await saveWaterBalance({freshwaterM3:'90',externalReuseM3:'10',internalRecirculationM3:'150',dischargeM3:'40',evaporationM3:'30',productIncorporationM3:'20',inventoryIncreaseM3:'10',productionTon:'10'},s,'2026-11-23T14:00:00Z');assert.equal(saved.boundaryInput,100);assert.equal(m.get(WATER_BALANCE_KEY).length,1);assert.equal(m.has(ENERGY_DATA_KEY),false)})

test('electricity bill provenance follows the bill into the energy performance record',()=>{const row=validateEnergyRecord({resource:'electricity',period:'1405/07',site:'Plant',seu:'Rolling mill',consumption:'12000',production:'1000',cost:'500000',sourceBillId:'EB-99',sourceBillNumber:'B-2026-07'});assert.equal(row.sourceBillId,'EB-99');assert.equal(row.sourceBillNumber,'B-2026-07');assert.equal(row.intensity,12)})

test('gas baseline EnPI compares thermal energy when both periods have calorific values',()=>{
 const base={consumption:1000,production:10,calorificValue:10,gasEnergyKwh:10000,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'}
 const actual={consumption:1100,production:10,gasEnergyKwh:9900,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'}
 const result=calculateEnergyPerformance({resource:'gas',baseline:base,actual})
 assert.equal(result.comparisonBasis,'thermal-energy')
 assert.equal(result.baselineIntensity,1000)
 assert.equal(result.actualIntensity,990)
 assert.equal(result.savings,100)
 assert.equal(result.comparisonUnit,'kWh')
})
test('gas EnPI warns and falls back to Nm3 when calorific basis or reference conditions do not match',()=>{
 const result=calculateEnergyPerformance({resource:'gas',baseline:{consumption:1000,production:10,gasEnergyKwh:10000,calorificBasis:'gross',gasReferenceConditions:'15C/101.325kPa'},actual:{consumption:900,production:10,gasEnergyKwh:9000,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'}})
 assert.equal(result.comparisonBasis,'gas-volume-fallback')
 assert.equal(result.savings,100)
 assert.equal(result.warnings.length,1)
})
test('freshwater sources are itemized and reconciled without double counting',async()=>{
 const {analyzeWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js')
 const result=analyzeWaterBalance({municipalWaterM3:40,groundwaterM3:30,surfaceWaterM3:20,otherFreshwaterM3:10,externalReuseM3:25,internalRecirculationM3:150,dischargeM3:50,evaporationM3:30,productIncorporationM3:20,inventoryIncreaseM3:15,productionTon:10})
 assert.equal(result.freshwaterM3,100)
 assert.equal(result.boundaryInput,125)
 assert.deepEqual(result.freshwaterSources,{municipalWaterM3:40,groundwaterM3:30,surfaceWaterM3:20,otherFreshwaterM3:10})
 assert.equal(result.internalRecirculationM3,150)
})

test('multi-period energy trends calculate production-normalized and cost intensity deltas',async()=>{
 const {analyzeEnergyTrends}=await import('../src/features/modules/energyManagementWorkflow.js')
 const result=analyzeEnergyTrends([
  {id:'e1',resource:'electricity',period:'1405/01',site:'Plant',seu:'Rolling',consumption:1000,production:100,cost:500},
  {id:'e2',resource:'electricity',period:'1405/02',site:'Plant',seu:'Rolling',consumption:900,production:100,cost:540}
 ],{resource:'electricity',site:'Plant',seu:'Rolling'})
 assert.equal(result.count,2)
 assert.equal(result.points[1].intensity,9)
 assert.equal(result.points[1].intensityChangePercent,-10)
 assert.equal(result.points[1].costPerOutputChangePercent,8)
})
test('gas trend uses thermal basis only for adjacent periods with matching HHV/LHV and reference conditions',async()=>{
 const {analyzeEnergyTrends}=await import('../src/features/modules/energyManagementWorkflow.js')
 const records=[
  {id:'g1',resource:'gas',period:'1405/01',site:'Plant',seu:'Furnace',consumption:100,production:10,cost:30,gasEnergyKwh:1000,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'},
  {id:'g2',resource:'gas',period:'1405/02',site:'Plant',seu:'Furnace',consumption:110,production:10,cost:33,gasEnergyKwh:990,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'},
  {id:'g3',resource:'gas',period:'1405/03',site:'Plant',seu:'Furnace',consumption:105,production:10,cost:32,gasEnergyKwh:1050,calorificBasis:'gross',gasReferenceConditions:'15C/101.325kPa'}
 ]
 const result=analyzeEnergyTrends(records,{resource:'gas'})
 assert.equal(result.points[1].comparisonBasis,'thermal-energy')
 assert.equal(result.points[1].intensity,99)
 assert.equal(result.points[2].comparisonBasis,'volume-or-resource')
 assert.equal(result.points[2].intensity,10.5)
})
test('electricity bill cost allocation reconciles every charge component to the invoice total',async()=>{
 const {allocateElectricityBillCost}=await import('../src/features/modules/energyManagementWorkflow.js')
 const result=allocateElectricityBillCost({bill:{id:'EB-1',billNumber:'B-1',period:'1405/07',amount:1000,energyCharge:600,demandCharge:150,reactiveCharge:50,taxCharge:100},consumers:[
  {id:'CC-A',name:'Rolling',consumptionKwh:600,peakDemandKw:30,reactiveKvarh:20,productionTon:60},
  {id:'CC-B',name:'Melting',consumptionKwh:400,peakDemandKw:70,reactiveKvarh:80,productionTon:40}
 ]})
 assert.equal(result.allocatedTotal,1000)
 assert.equal(result.allocations.reduce((s,x)=>s+x.energyCharge,0),600)
 assert.equal(result.allocations.reduce((s,x)=>s+x.demandCharge,0),150)
 assert.equal(result.allocations.reduce((s,x)=>s+x.reactiveCharge,0),50)
 assert.equal(result.allocations.reduce((s,x)=>s+x.taxCharge,0),100)
 assert.equal(result.allocations[0].costPerTon,8)
 assert.equal(result.sourceReference.billId,'EB-1')
})
test('electricity bill allocation rejects missing cost drivers and non-reconciled invoice components',async()=>{
 const {allocateElectricityBillCost}=await import('../src/features/modules/energyManagementWorkflow.js')
 assert.throws(()=>allocateElectricityBillCost({bill:{amount:100,energyCharge:100,demandCharge:10},consumers:[{id:'A',consumptionKwh:10}]}),/جمع اجزای قبض/)
 assert.throws(()=>allocateElectricityBillCost({bill:{amount:100,demandCharge:50},consumers:[{id:'A',consumptionKwh:10}]}),/peakDemandKw/)
})
