import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateEnergyPerformance,validateEnergyRecord,saveEnergyBaseline,saveEnergyRecord,saveEnergyAction,updateEnergyActionStatus,analyzeEnergyTrends,analyzeMultivariableEnergyNormalization,ENERGY_DATA_KEY,ENERGY_BASELINES_KEY,ENERGY_ACTIONS_KEY} from '../src/features/modules/energyManagementWorkflow.js'
test('electricity gas and water retain distinct units',()=>{for(const [resource,unit] of [['electricity','kWh'],['gas','Nm³'],['water','m³']])assert.equal(validateEnergyRecord({resource,period:'P1',site:'Plant',seu:'Main',consumption:'100',production:'10',cost:'5'}).unit,unit)})
test('meter readings must reconcile to recorded consumption',()=>assert.throws(()=>validateEnergyRecord({resource:'electricity',period:'P1',site:'Plant',seu:'Mill',consumption:'20',production:'1',cost:'1',startReading:'100',endReading:'119'})))
test('visible energy trends compare only within the same site and significant-use boundary',()=>{
 const data=[
  {resource:'electricity',id:'a1',period:'1405/01',site:'Plant A',seu:'Rolling',consumption:1000,production:10,cost:100},
  {resource:'electricity',id:'b1',period:'1405/01',site:'Plant B',seu:'Furnace',consumption:5000,production:10,cost:500},
  {resource:'electricity',id:'a2',period:'1405/02',site:'Plant A',seu:'Rolling',consumption:900,production:10,cost:90}
 ]
 const result=analyzeEnergyTrends(data,{resource:'electricity'})
 assert.equal(result.series.length,2)
 const rolling=result.series.find(x=>x.site==='Plant A')
 assert.ok(Math.abs(rolling.points[1].periodChangePercent+10)<1e-9)
 assert.ok(Math.abs(rolling.points[1].intensityChangePercent+10)<1e-9)
 assert.equal(rolling.points[0].periodChangePercent,null)
 assert.equal(result.points.length,3)
})

test('baseline is normalized to actual production',()=>{const x=calculateEnergyPerformance({resource:'electricity',baseline:{consumption:1000,production:10},actual:{consumption:900,production:10}});assert.equal(x.baselineIntensity,100);assert.equal(x.normalizedBaseline,1000);assert.equal(x.savings,100);assert.equal(x.status,'improved')})
test('baseline comparison rejects different sites, significant uses and resources',()=>{
 assert.throws(()=>calculateEnergyPerformance({resource:'electricity',baseline:{resource:'electricity',site:'Plant A',seu:'Rolling',consumption:1000,production:10},actual:{resource:'electricity',site:'Plant B',seu:'Rolling',consumption:900,production:10}}),/سایت و مصرف‌کننده/)
 assert.throws(()=>calculateEnergyPerformance({resource:'electricity',baseline:{resource:'electricity',site:'Plant A',seu:'Rolling',consumption:1000,production:10},actual:{resource:'electricity',site:'Plant A',seu:'Furnace',consumption:900,production:10}}),/سایت و مصرف‌کننده/)
 assert.throws(()=>calculateEnergyPerformance({resource:'electricity',baseline:{resource:'gas',consumption:1000,production:10},actual:{resource:'electricity',consumption:900,production:10}}),/منبع/)
})

test('higher use than normalized baseline is worsened',()=>assert.equal(calculateEnergyPerformance({resource:'gas',baseline:{consumption:100,production:10},actual:{consumption:120,production:10}}).status,'worsened'))
test('stores utility records baselines and improvement actions separately',async()=>{const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v),update:async(k,f)=>{const v=f(m.get(k));m.set(k,v);return v}};const r=await saveEnergyRecord({resource:'water',period:'P1',site:'Plant',seu:'Cooling',consumption:'25',production:'5',cost:'12'},s,'2026-11-23T10:00:00Z');const b=await saveEnergyBaseline({resource:'water',period:'BASE',site:'Plant',seu:'Cooling',consumption:'30',production:'5'},s,'2026-11-23T11:00:00Z');const a=await saveEnergyAction({resource:'water',title:'Leak reduction',owner:'Utilities',dueDate:'2026-12-01',expectedSavings:'5'},s,'2026-11-23T12:00:00Z');assert.equal(r.unit,'m³');assert.equal(b.intensity,6);assert.equal(a.expectedSavings,5);assert.equal(m.get(ENERGY_DATA_KEY).length,1);assert.equal(m.get(ENERGY_BASELINES_KEY).length,1);assert.equal(m.get(ENERGY_ACTIONS_KEY).length,1)})

test('gas volume is converted only with a positive supplied calorific value',()=>{const x=validateEnergyRecord({resource:'gas',period:'P1',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200'});assert.equal(x.calorificValue,null);assert.equal(x.gasEnergyKwh,null);const y=validateEnergyRecord({resource:'gas',period:'P2',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200',calorificValue:'10.5'});assert.equal(y.gasEnergyKwh,10500);assert.throws(()=>validateEnergyRecord({resource:'gas',period:'P3',site:'Plant',seu:'Furnace',consumption:'1000',production:'10',cost:'200',calorificValue:'0'}))})
test('advanced gas indicators report GJ and energy intensity without assuming calorific value',async()=>{const {analyzeGasUtility}=await import('../src/features/modules/energyManagementWorkflow.js');const x=analyzeGasUtility({consumptionNm3:1000,calorificValueKwhPerNm3:10,productionTon:20,cost:500});assert.equal(x.energyKwh,10000);assert.equal(x.energyGJ,36);assert.equal(x.specificEnergyKwhPerTon,500);assert.equal(x.costPerGJ,500/36)})
test('water balance excludes internal recirculation from external boundary inputs',async()=>{const {analyzeWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js');const x=analyzeWaterBalance({freshwaterM3:80,externalReuseM3:20,internalRecirculationM3:200,dischargeM3:30,evaporationM3:40,productIncorporationM3:20,inventoryIncreaseM3:10,productionTon:10});assert.equal(x.boundaryInput,100);assert.equal(x.accountedOutput,100);assert.equal(x.balanceGap,0);assert.equal(x.withdrawalIntensity,8);assert.equal(x.internalRecirculationIntensity,20);assert.equal(x.externalReuseSharePercent,20)})
test('water balance flags an unclosed boundary and rejects negative flows',async()=>{const {analyzeWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js');assert.ok(analyzeWaterBalance({freshwaterM3:100,dischargeM3:20,productionTon:10}).warnings.length);assert.throws(()=>analyzeWaterBalance({freshwaterM3:-1,productionTon:10}))})

test('MOD-02 stores the selected electricity bill as an auditable energy-cost source',async()=>{const {executeModuleAnalysis}=await import('../src/features/modules/moduleAnalysisWorkflow.js');const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v)};const saved=await executeModuleAnalysis('MOD-02',{outputTon:'10',material:'100',labor:'20',energy:'50',maintenance:'10',overhead:'20',sellingPrice:'30'},s,'2026-11-23T13:00:00Z',{energyBillId:'EB-1',billingPeriod:'1405/07',billNumber:'B-10'});assert.equal(saved.metrics.totalCost,200);assert.deepEqual(saved.sourceReferences,{energyBillId:'EB-1',billingPeriod:'1405/07',billNumber:'B-10'});assert.equal(m.get('module-intelligence:MOD-02:v1')[0].sourceReferences.energyBillId,'EB-1')})
test('water balance history is persisted separately from energy totals',async()=>{const {saveWaterBalance,WATER_BALANCE_KEY}=await import('../src/features/modules/energyManagementWorkflow.js');const m=new Map(),s={get:async k=>m.get(k),set:async(k,v)=>m.set(k,v),update:async(k,f)=>{const v=f(m.get(k));m.set(k,v);return v}};const saved=await saveWaterBalance({period:'1405/07',site:'Plant',seu:'Cooling',freshwaterM3:'90',externalReuseM3:'10',internalRecirculationM3:'150',dischargeM3:'40',evaporationM3:'30',productIncorporationM3:'20',inventoryIncreaseM3:'10',productionTon:'10'},s,'2026-11-23T14:00:00Z');assert.equal(saved.boundaryInput,100);assert.equal(saved.period,'1405/07');assert.equal(saved.site,'Plant');assert.equal(saved.seu,'Cooling');assert.equal(m.get(WATER_BALANCE_KEY).length,1);assert.equal(m.has(ENERGY_DATA_KEY),false)})

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
 assert.ok(Math.abs(result.points[1].intensityChangePercent+10)<1e-9)
 assert.ok(Math.abs(result.points[1].costPerOutputChangePercent-8)<1e-9)
})
test('gas trend uses thermal basis only when the complete series shares HHV/LHV and reference conditions',async()=>{
 const {analyzeEnergyTrends}=await import('../src/features/modules/energyManagementWorkflow.js')
 const records=[
  {id:'g1',resource:'gas',period:'1405/01',site:'Plant',seu:'Furnace',consumption:100,production:10,cost:30,gasEnergyKwh:1000,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'},
  {id:'g2',resource:'gas',period:'1405/02',site:'Plant',seu:'Furnace',consumption:110,production:10,cost:33,gasEnergyKwh:990,calorificBasis:'net',gasReferenceConditions:'15C/101.325kPa'},
  {id:'g3',resource:'gas',period:'1405/03',site:'Plant',seu:'Furnace',consumption:105,production:10,cost:32,gasEnergyKwh:1050,calorificBasis:'gross',gasReferenceConditions:'15C/101.325kPa'}
 ]
 const comparable=analyzeEnergyTrends(records.slice(0,2),{resource:'gas'})
 assert.equal(comparable.points[1].comparisonBasis,'thermal-energy')
 assert.equal(comparable.points[1].intensity,99)
 const mixed=analyzeEnergyTrends(records,{resource:'gas'})
 assert.ok(mixed.series.every(x=>x.comparisonBasis==='volume-or-resource'))
 assert.equal(mixed.points[1].intensity,11)
 assert.equal(mixed.points[2].intensity,10.5)
 assert.ok(mixed.warnings.some(x=>x.includes('HHV/LHV')))
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
 assert.ok(Math.abs(result.allocations[0].costPerTon-8.78125)<1e-9)
 assert.equal(result.sourceReference.billId,'EB-1')
})
test('electricity bill allocation rejects missing cost drivers and non-reconciled invoice components',async()=>{
 const {allocateElectricityBillCost}=await import('../src/features/modules/energyManagementWorkflow.js')
 assert.throws(()=>allocateElectricityBillCost({bill:{amount:100,energyCharge:100,demandCharge:10},consumers:[{id:'A',consumptionKwh:10}]}),/جمع اجزای قبض/)
 assert.throws(()=>allocateElectricityBillCost({bill:{amount:100,demandCharge:50},consumers:[{id:'A',consumptionKwh:10}]}),/peakDemandKw/)
})

test('MOD-02 handoff uses only the selected cost-center allocation and preserves bill provenance',async()=>{
 const {allocateElectricityBillCost,prepareModule02EnergyCostPosting}=await import('../src/features/modules/energyManagementWorkflow.js')
 const allocation=allocateElectricityBillCost({bill:{id:'EB-22',billNumber:'INV-22',period:'1405/08',amount:300,energyCharge:200},consumers:[
  {id:'CC-1',name:'Rolling',consumptionKwh:75,productionTon:10},
  {id:'CC-2',name:'Casting',consumptionKwh:25,productionTon:5}
 ]})
 const prepared=prepareModule02EnergyCostPosting({baseInput:{outputTon:'10',material:'100',labor:'20',energy:'0',maintenance:'10',overhead:'20',sellingPrice:'30'},allocation,costCenterId:'CC-1'})
 assert.equal(prepared.input.energy,'225')
 assert.equal(prepared.sourceReferences.energyBillId,'EB-22')
 assert.equal(prepared.sourceReferences.energyAllocationCenter,'CC-1')
 assert.match(prepared.duplicatePostingGuard,/full bill total separately/)
})


test('MOD-05 presents an industrial dashboard hierarchy with record-backed resource KPIs', async()=>{const {readFile}=await import('node:fs/promises');const app=await readFile(new URL('../src/features/modules/ModuleEnergyPanel.tsx',import.meta.url),'utf8');const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');assert.ok(app.includes('energy-dashboard-hero'));assert.ok(app.includes('energy-resource-tabs'));assert.ok(app.includes('totals[resource].consumption'));assert.ok(app.includes('energy-resource-summary'));assert.ok(app.includes('EnergyIntelligenceInsights'));assert.ok(app.includes('ResourceBillAnalysis'));assert.ok(app.includes('ResourceBillCostAllocationPanel'));assert.ok(css.includes('.energy-dashboard-hero'));assert.ok(css.includes('@media(max-width:460px)'));assert.ok(css.includes('energy-resource-tab-icon'))})

test('improvement actions support controlled lifecycle status updates',async()=>{
 const m=new Map(),store={get:async k=>m.get(k),update:async(k,fn)=>{const next=fn(m.get(k));m.set(k,next);return next}}
 const action=await saveEnergyAction({resource:'electricity',title:'Reduce idle load',owner:'Energy team',dueDate:'2026-12-01',expectedSavings:'100'},store,'2026-11-24T10:00:00Z')
 await updateEnergyActionStatus(action.id,'in-progress',store)
 assert.equal(m.get(ENERGY_ACTIONS_KEY)[0].status,'in-progress')
 await assert.rejects(()=>updateEnergyActionStatus(action.id,'verified',store),/دوره صحه‌گذاری/)
 await updateEnergyActionStatus(action.id,'verified',store,{period:'1405/09',measuredSavings:'85',verifier:'Energy Manager',evidenceNote:'Post-implementation meter readings normalized to production.'})
 assert.equal(m.get(ENERGY_ACTIONS_KEY)[0].status,'verified')
 assert.equal(m.get(ENERGY_ACTIONS_KEY)[0].verification.measuredSavings,85)
 assert.equal(m.get(ENERGY_ACTIONS_KEY)[0].verification.period,'1405/09')
 assert.equal(m.get(ENERGY_ACTIONS_KEY)[0].statusHistory.length,3)
 await updateEnergyActionStatus(action.id,'in-progress',store)
 const reopened=m.get(ENERGY_ACTIONS_KEY)[0]
 assert.equal(reopened.status,'in-progress')
 assert.equal(reopened.verification,null)
 assert.equal(reopened.verificationHistory.length,1)
 assert.equal(reopened.verificationHistory[0].period,'1405/09')
 await assert.rejects(()=>saveEnergyAction({resource:'electricity',title:'Invalid verified action',owner:'Team',dueDate:'2026-12-01',expectedSavings:10,status:'verified'},store),/بدون شواهد صحه‌گذاری/)
 await assert.rejects(()=>updateEnergyActionStatus(action.id,'unknown',store),/وضعیت اقدام/)
})

test('MOD-05 provides a complete Excel workbook and print-to-PDF report path',async()=>{
 const {readFile}=await import('node:fs/promises')
 const app=await readFile(new URL('../src/features/modules/ModuleEnergyPanel.tsx',import.meta.url),'utf8')
 const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8')
 assert.ok(app.includes("import * as XLSX from 'xlsx'"))
 assert.ok(app.includes('XLSX.writeFile'))
 for(const sheet of ['پایش منابع','خطوط مبنا','قبوض برق','قبوض گاز','قبوض آب','تراز آب','تخصیص برق','تخصیص گاز و آب','اقدامات بهبود'])assert.ok(app.includes(sheet))
 assert.ok(app.includes('window.print()'))
 assert.ok(app.includes('energy-print-report'))
 assert.ok(app.includes('تراز آب'))
 assert.ok(app.includes("value={waterForm.period}"))
 assert.ok(app.includes("value={waterForm.site}"))
 assert.ok(app.includes("value={waterForm.seu}"))
 assert.match(app,/<th>دوره<\/th><th>سایت<\/th><th>مصرف‌کننده عمده \/ مرز<\/th>/)
 assert.ok(app.includes("!waterForm.period.trim()"))
 assert.ok(app.includes('تخصیص هزینه به مراکز'))
 assert.ok(css.includes('@media print'))
 assert.ok(css.includes('body.energy-report-printing'))
 assert.ok(app.includes("document.body.classList.add('energy-report-printing')"))
 assert.ok(app.includes('updateEnergyActionStatus'))
 assert.ok(app.includes('ثبت صحه‌گذاری صرفه‌جویی'))
 assert.ok(app.includes('شواهد اندازه‌گیری / روش صحه‌گذاری'))
 assert.ok(app.includes('verificationEvidence:verification?.evidenceNote'))
 assert.ok(app.includes('<th>صرفه‌جویی اندازه‌گیری‌شده</th>'))
 assert.ok(app.includes('analyzeMultivariableEnergyNormalization'))
 assert.ok(app.includes("['نرمال‌سازی چندمتغیره',multivariableNormalization.results]"))
 assert.ok(app.includes('<th>ساعات کارکرد</th>'))
 assert.ok(app.includes('statusHistory:JSON.stringify(action.statusHistory??[])'))
 assert.ok(app.includes('<th>تاریخچه وضعیت</th>'))
 assert.ok(app.includes('<th>سوابق صحه‌گذاری قبلی</th>'))
})


test('water balance save requires a reporting period and measurement boundary',async()=>{const {saveWaterBalance}=await import('../src/features/modules/energyManagementWorkflow.js');const store={update:async()=>{}};await assert.rejects(()=>saveWaterBalance({freshwaterM3:10,productionTon:1},store),/دوره تراز آب/);await assert.rejects(()=>saveWaterBalance({period:'1405/07',freshwaterM3:10,productionTon:1},store),/سایت\/فرآیند/)})


test('multivariable energy normalization holds out the latest period and adjusts for production and operating hours',()=>{
 const records=Array.from({length:7},(_,i)=>({id:'mv'+i,resource:'electricity',period:'1405/0'+(i+1),site:'Plant',seu:'Rolling',production:100+i*10,operatingHours:[80,91,87,104,96,112,103][i],consumption:20+2*(100+i*10)+.5*[80,91,87,104,96,112,103][i]+(i===6?30:0),dataQuality:'measured'}))
 const result=analyzeMultivariableEnergyNormalization(records,{resource:'electricity'})
 assert.equal(result.results.length,1)
 const model=result.results[0]
 assert.deepEqual(model.trainingPeriods,records.slice(0,6).map(x=>x.period))
 assert.equal(model.actualPeriod,'1405/07')
 assert.ok(model.adjustedSavings<0)
 assert.ok(model.rSquared>0.99)
 assert.equal(analyzeMultivariableEnergyNormalization(records.slice(0,5),{resource:'electricity'}).results.length,0)
})
test('multivariable normalization excludes estimated periods and reports insufficient measured history',()=>{
 const records=Array.from({length:7},(_,i)=>({id:'mve'+i,resource:'water',period:'P'+i,site:'Plant',seu:'Cooling',production:100+i*4,operatingHours:[80,91,86,102,94,111,99][i],consumption:30+1.5*(100+i*4)+.75*[80,91,86,102,94,111,99][i],dataQuality:i===0?'estimated':'measured'}))
 const result=analyzeMultivariableEnergyNormalization(records,{resource:'water'})
 assert.equal(result.results.length,1)
 assert.equal(result.results[0].trainingPeriods.length,5)
})

test('multivariable normalization uses complete measured operational drivers and holds out the latest period',async()=>{
 const {analyzeMultivariableEnergyNormalization,validateEnergyRecord}=await import('../src/features/modules/energyManagementWorkflow.js')
 const production=[100,118,109,135,121,151,132,164,143,177],hours=[20,25,19,31,23,35,28,39,30,44],mix=[20,45,25,60,35,70,40,80,55,65],temperature=[-5,10,0,15,3,20,8,25,12,30],feed=[65,80,72,90,60,85,75,95,68,88],shutdown=[0,1,0,2,3,0,1,4,2,1];
  const records=Array.from({length:10},(_,i)=>validateEnergyRecord({resource:'electricity',period:'1405/'+String(i+1).padStart(2,'0'),site:'Plant',seu:'Furnace',consumption:100+0.7*production[i]+1.3*hours[i]+0.2*mix[i]-0.4*temperature[i]+0.8*feed[i]+2*shutdown[i],cost:50,production:production[i],operatingHours:hours[i],productMixIndex:mix[i],ambientTemperatureC:temperature[i],feedQualityIndex:feed[i],shutdownHours:shutdown[i],dataQuality:'measured'}))
 const result=analyzeMultivariableEnergyNormalization(records,{resource:'electricity'})
 assert.equal(result.results.length,1)
 assert.deepEqual(result.results[0].predictors,['production','operatingHours','productMixIndex','ambientTemperatureC','feedQualityIndex','shutdownHours'])
 assert.deepEqual(result.results[0].trainingPeriods,records.slice(0,-1).map(x=>x.period))
 assert.ok(Number.isFinite(result.results[0].normalizedConsumption))
})
test('multivariable normalization excludes incomplete optional drivers and warns instead of imputing',async()=>{
 const {analyzeMultivariableEnergyNormalization,validateEnergyRecord}=await import('../src/features/modules/energyManagementWorkflow.js')
 const operatingHours=[8,11,9,14,10,16];\n  const records=Array.from({length:6},(_,i)=>validateEnergyRecord({resource:'electricity',period:'P'+(i+1),site:'Plant',seu:'Mill',consumption:100+i*4+operatingHours[i],cost:10,production:10+i,operatingHours:operatingHours[i],productMixIndex:i===2?'':20+i,dataQuality:'measured'}))
 const result=analyzeMultivariableEnergyNormalization(records,{resource:'electricity'})
 assert.equal(result.results.length,1)
 assert.ok(!result.results[0].predictors.includes('productMixIndex'))
 assert.ok(result.warnings.some(x=>x.includes('داده ناقص')))
})
test('energy driver validation enforces bounded indices and permits below-zero ambient temperatures',async()=>{
 const {validateEnergyRecord}=await import('../src/features/modules/energyManagementWorkflow.js')
 const base={resource:'electricity',period:'P1',site:'Plant',seu:'Mill',consumption:100,production:10,cost:20,operatingHours:8}
 assert.equal(validateEnergyRecord({...base,ambientTemperatureC:-5}).ambientTemperatureC,-5)
 assert.throws(()=>validateEnergyRecord({...base,productMixIndex:101}),/شاخص ترکیب محصول/)
 assert.throws(()=>validateEnergyRecord({...base,feedQualityIndex:-1}),/شاخص کیفیت خوراک/)
 assert.throws(()=>validateEnergyRecord({...base,shutdownHours:-1}),/ساعات توقف/)
})
