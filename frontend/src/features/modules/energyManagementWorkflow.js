export const ENERGY_DATA_KEY = 'module-intelligence:MOD-05:records:v1'
export const ENERGY_BASELINES_KEY = 'module-intelligence:MOD-05:baselines:v1'
export const ENERGY_ACTIONS_KEY = 'module-intelligence:MOD-05:actions:v1'
export const WATER_BALANCE_KEY = 'module-intelligence:MOD-05:water-balances:v1'
export const ENERGY_COST_ALLOCATIONS_KEY = 'module-intelligence:MOD-05:cost-allocations:v1'
export const RESOURCE_CONFIG = {
 electricity:{unit:'kWh',factorUnit:'kWh/t'}, gas:{unit:'Nm³',factorUnit:'Nm³/t'}, water:{unit:'m³',factorUnit:'m³/t'}
}
const number=(v,label,min=0)=>{const n=Number(v);if(v===''||v===null||v===undefined||!Number.isFinite(n)||n<min)throw new Error('مقدار '+label+' معتبر نیست.');return n}
const required=(v,label)=>{const s=String(v??'').trim();if(!s)throw new Error('فیلد '+label+' الزامی است.');return s}
const optionalDriver=(v,label,{min=-Infinity,max=Infinity}={})=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw new Error('مقدار '+label+' معتبر نیست.');return n}
export function validateEnergyRecord(i){
 if(!Object.hasOwn(RESOURCE_CONFIG,i.resource))throw new Error('نوع منبع معتبر نیست.')
 const consumption=number(i.consumption,'مصرف',0),production=number(i.production,'تولید/فعالیت',0),cost=number(i.cost,'هزینه',0)
 const operatingHours=i.operatingHours===''||i.operatingHours===null||i.operatingHours===undefined?null:number(i.operatingHours,'ساعات کارکرد',0)
 if(consumption===0||production===0)throw new Error('مصرف و تولید/فعالیت باید بزرگ‌تر از صفر باشند.')
 const start=i.startReading===''||i.startReading===null||i.startReading===undefined?null:number(i.startReading,'قرائت ابتدا',0),end=i.endReading===''||i.endReading===null||i.endReading===undefined?null:number(i.endReading,'قرائت انتها',0)
 if((start===null)!==(end===null))throw new Error('هر دو قرائت کنتور باید ثبت شوند یا هر دو خالی باشند.')
 if(start!==null&&end<start)throw new Error('قرائت انتهای کنتور کمتر از قرائت ابتداست.')
 if(start!==null&&Math.abs(end-start-consumption)>Math.max(.01,consumption*.005))throw new Error('مصرف با اختلاف قرائت کنتور تطبیق ندارد.')
 return {resource:i.resource,period:required(i.period,'دوره'),site:required(i.site,'سایت/واحد'),seu:required(i.seu,'مصرف‌کننده عمده'),meterId:String(i.meterId??''),consumption,production,cost,unit:RESOURCE_CONFIG[i.resource].unit,intensity:consumption/production,costPerOutput:cost/production,operatingHours,startReading:start,endReading:end,calorificValue:(()=>{const supplied=i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined;if(i.resource!=='gas'||!supplied)return null;const value=number(i.calorificValue,'ارزش حرارتی گاز',0);if(value<=0)throw new Error('ارزش حرارتی گاز باید بزرگ‌تر از صفر باشد.');return value})(),calorificBasis:i.resource==='gas'&&['gross','net'].includes(i.calorificBasis)?i.calorificBasis:null,gasReferenceConditions:i.resource==='gas'?String(i.gasReferenceConditions??'').trim():null,gasEnergyKwh:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined?consumption*number(i.calorificValue,'ارزش حرارتی گاز',0):null,gasEnergyIntensityKwhPerTon:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined?consumption*number(i.calorificValue,'ارزش حرارتی گاز',0)/production:null,gasCostPerGJ:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined&&consumption>0?cost/(consumption*number(i.calorificValue,'ارزش حرارتی گاز',0)*0.0036):null,productMixIndex:optionalDriver(i.productMixIndex,'شاخص ترکیب محصول',{min:0,max:100}),ambientTemperatureC:optionalDriver(i.ambientTemperatureC,'دمای محیط'),feedQualityIndex:optionalDriver(i.feedQualityIndex,'شاخص کیفیت خوراک',{min:0,max:100}),shutdownHours:optionalDriver(i.shutdownHours,'ساعات توقف'),sourceBillId:String(i.sourceBillId??''),sourceBillNumber:String(i.sourceBillNumber??''),note:String(i.note??''),dataQuality:i.dataQuality==='measured'?'measured':'estimated'}
}

function solveEnergyLinearSystem(matrix,vector){
 const a=matrix.map((row,i)=>[...row,vector[i]])
 const n=vector.length
 for(let col=0;col<n;col++){
  let pivot=col
  for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row
  if(Math.abs(a[pivot][col])<1e-10)return null
  ;[a[col],a[pivot]]=[a[pivot],a[col]]
  const divisor=a[col][col]
  for(let j=col;j<=n;j++)a[col][j]/=divisor
  for(let row=0;row<n;row++)if(row!==col){const factor=a[row][col];for(let j=col;j<=n;j++)a[row][j]-=factor*a[col][j]}
 }
 return a.map(row=>row[n])
}
function fitEnergyOls(rows,predictorKeys){
 const x=rows.map(r=>[1,...predictorKeys.map(key=>Number(r[key]))]),y=rows.map(r=>Number(r.analysisConsumption)),size=predictorKeys.length+1
 const matrix=Array.from({length:size},()=>Array(size).fill(0)),vector=Array(size).fill(0)
 for(let i=0;i<x.length;i++)for(let j=0;j<size;j++){vector[j]+=x[i][j]*y[i];for(let k=0;k<size;k++)matrix[j][k]+=x[i][j]*x[i][k]}
 const coefficients=solveEnergyLinearSystem(matrix,vector)
 if(!coefficients)return null
 const predicted=x.map(row=>row.reduce((sum,value,index)=>sum+value*coefficients[index],0))
 const mean=y.reduce((sum,value)=>sum+value,0)/y.length
 const sse=y.reduce((sum,value,index)=>sum+(value-predicted[index])**2,0)
 const sst=y.reduce((sum,value)=>sum+(value-mean)**2,0)
 return {coefficients,rmse:Math.sqrt(sse/y.length),rSquared:sst>0?1-sse/sst:null}
}
export function analyzeMultivariableEnergyNormalization(records,{resource,site,seu}={}){
 const selected=(Array.isArray(records)?records:[]).filter(r=>r.resource===resource&&(!site||r.site===site)&&(!seu||r.seu===seu))
 const groups=new Map()
 for(const row of selected){const key=[row.site,row.seu].join('::');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
 const results=[],warnings=[]
 const optionalDrivers=['productMixIndex','ambientTemperatureC','feedQualityIndex','shutdownHours']
 const driverLabels={productMixIndex:'ترکیب محصول',ambientTemperatureC:'دمای محیط',feedQualityIndex:'کیفیت خوراک',shutdownHours:'ساعات توقف'}
 for(const [key,items] of groups){
  const sorted=items.slice().sort((a,b)=>String(a.period).localeCompare(String(b.period),'en',{numeric:true}))
  const gasThermal=resource==='gas'&&sorted.every(r=>Number(r.gasEnergyKwh)>0&&['gross','net'].includes(r.calorificBasis)&&r.calorificBasis===sorted[0]?.calorificBasis&&String(r.gasReferenceConditions??'').trim()!==''&&String(r.gasReferenceConditions??'').trim()===String(sorted[0]?.gasReferenceConditions??'').trim())
  const usable=sorted.filter(r=>r.dataQuality!=='estimated'&&Number(r.production)>0&&Number(r.operatingHours)>0&&Number(gasThermal?r.gasEnergyKwh:r.consumption)>0)
   .map(r=>({...r,analysisConsumption:Number(gasThermal?r.gasEnergyKwh:r.consumption)}))
  if(usable.length<6){if(usable.length)warnings.push(key+': برای نرمال‌سازی چندمتغیره حداقل ۶ دوره اندازه‌گیری‌شده با ساعت کارکرد معتبر لازم است.');continue}
  const training=usable.slice(0,-1),actual=usable[usable.length-1]
  const predictorKeys=['production','operatingHours']
  const omittedDrivers=[]
  for(const driver of optionalDrivers){
   const values=usable.map(r=>r[driver])
   const complete=values.every(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))
   const variable=complete&&values.some(v=>Number(v)!==Number(values[0]))
   if(!complete){omittedDrivers.push(driverLabels[driver]+' (داده ناقص)');continue}
   if(!variable){omittedDrivers.push(driverLabels[driver]+' (بدون تغییر)');continue}
   if(training.length<predictorKeys.length+3){omittedDrivers.push(driverLabels[driver]+' (دوره کافی برای برازش مستقل وجود ندارد)');continue}
   predictorKeys.push(driver)
  }
  if(omittedDrivers.length)warnings.push(key+': متغیرهای تعدیل‌گر کنار گذاشته شدند: '+omittedDrivers.join('، ')+'.')
  const model=fitEnergyOls(training,predictorKeys)
  if(!model){warnings.push(key+': مدل به‌دلیل هم‌خطی یا تنوع ناکافی متغیرهای ورودی قابل برازش نیست؛ نتیجه نرمال‌سازی تولید نشد.');continue}
  const normalized=model.coefficients[0]+predictorKeys.reduce((sum,driver,index)=>sum+model.coefficients[index+1]*Number(actual[driver]),0)
  const residual=normalized-actual.analysisConsumption
  const percent=normalized!==0?residual/normalized*100:0
  const modelWarnings=[]
  if(model.rSquared===null||model.rSquared<0.5)modelWarnings.push('قدرت توضیح‌دهندگی مدل پایین است؛ نتیجه را مبنای ادعای صرفه‌جویی قرار ندهید.')
  if(model.coefficients.some(x=>!Number.isFinite(x))||normalized<=0)modelWarnings.push('ضرایب یا مقدار نرمال‌شده از نظر فیزیکی نیازمند بازبینی است.')
  if(training.length<=predictorKeys.length+1)modelWarnings.push('درجه آزادی باقیمانده مدل کم است؛ نتیجه صرفاً اکتشافی است.')
  const coefficients=Object.fromEntries(predictorKeys.map((driver,index)=>[driver,model.coefficients[index+1]]))
  results.push({site:actual.site,seu:actual.seu,resource,comparisonBasis:gasThermal?'thermal-energy':'resource-volume',comparisonUnit:gasThermal?'kWh':RESOURCE_CONFIG[resource].unit,trainingPeriods:training.map(r=>r.period),actualPeriod:actual.period,actualConsumption:actual.analysisConsumption,normalizedConsumption:normalized,adjustedSavings:residual,adjustedSavingsPercent:percent,rSquared:model.rSquared,rmse:model.rmse,predictors:predictorKeys,coefficients:{intercept:model.coefficients[0],...coefficients},warnings:modelWarnings})
  warnings.push(...modelWarnings.map(w=>key+': '+w))
 }
 return {results,warnings}
}
export function calculateEnergyPerformance({resource,baseline,actual}){
 if(!Object.hasOwn(RESOURCE_CONFIG,resource))throw new Error('نوع منبع معتبر نیست.')
 if(baseline.resource&&baseline.resource!==resource||actual.resource&&actual.resource!==resource)throw new Error('منبع خط مبنا و رکورد واقعی باید یکسان باشد.')
 for(const key of ['site','seu'])if(String(baseline[key]??'').trim()&&String(actual[key]??'').trim()&&String(baseline[key]).trim()!==String(actual[key]).trim())throw new Error('سایت و مصرف‌کننده عمده خط مبنا و رکورد واقعی باید یکسان باشند.')
 const bc=number(baseline.consumption,'مصرف خط مبنا',0),bp=number(baseline.production,'تولید خط مبنا',0),ac=number(actual.consumption,'مصرف واقعی',0),ap=number(actual.production,'تولید واقعی',0)
 if(!bc||!bp||!ap)throw new Error('مصرف و تولید مرجع و تولید واقعی باید بزرگ‌تر از صفر باشند.')
 const useThermalGas=resource==='gas'&&Number(baseline.gasEnergyKwh)>0&&Number(actual.gasEnergyKwh)>0&&['gross','net'].includes(baseline.calorificBasis)&&baseline.calorificBasis===actual.calorificBasis&&String(baseline.gasReferenceConditions??'').trim()!==''&&String(baseline.gasReferenceConditions??'').trim()===String(actual.gasReferenceConditions??'').trim()
 const baseUse=useThermalGas?Number(baseline.gasEnergyKwh):bc,actualUse=useThermalGas?Number(actual.gasEnergyKwh):ac
 const bi=baseUse/bp,ai=actualUse/ap,normalized=bi*ap,savings=normalized-actualUse
 return {resource,comparisonBasis:useThermalGas?'thermal-energy':resource==='gas'?'gas-volume-fallback':'resource-volume',comparisonUnit:useThermalGas?'kWh':RESOURCE_CONFIG[resource].unit,baselineIntensity:bi,actualIntensity:ai,normalizedBaseline:normalized,actualConsumption:actualUse,actualProduction:ap,savings,savingsPercent:normalized?savings/normalized*100:0,improvementPercent:(bi-ai)/bi*100,status:Math.abs(savings)<1e-9?'on-baseline':savings>0?'improved':'worsened',warnings:resource==='gas'&&!useThermalGas?['ارزش حرارتی معتبر برای هر دو دوره ثبت نشده است؛ مقایسه صرفاً بر مبنای حجم Nm³ انجام شده و تغییر کیفیت گاز را لحاظ نمی‌کند.']:[]}
}
export async function saveEnergyRecord(i,store,createdAt=new Date().toISOString()){const row={id:'MOD-05-'+Date.parse(createdAt),createdAt,...validateEnergyRecord(i)};await store.update(ENERGY_DATA_KEY,old=>[row,...(Array.isArray(old)?old:[])].slice(0,500));return row}
export async function saveEnergyBaseline(i,store,createdAt=new Date().toISOString()){
 if(!Object.hasOwn(RESOURCE_CONFIG,i.resource))throw new Error('نوع منبع معتبر نیست.')
 const consumption=number(i.consumption,'مصرف خط مبنا',0),production=number(i.production,'تولید خط مبنا',0);if(!consumption||!production)throw new Error('مصرف و تولید خط مبنا باید بزرگ‌تر از صفر باشند.')
 const calorificValue=i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined?number(i.calorificValue,'ارزش حرارتی خط مبنا',0):null
 if(calorificValue!==null&&calorificValue<=0)throw new Error('ارزش حرارتی خط مبنا باید بزرگ‌تر از صفر باشد.')
 const calorificBasis=i.resource==='gas'&&['gross','net'].includes(i.calorificBasis)?i.calorificBasis:null
 const gasReferenceConditions=i.resource==='gas'?String(i.gasReferenceConditions??'').trim():''
 const b={id:'MOD-05-BASE-'+i.resource+'-'+Date.parse(createdAt),resource:i.resource,period:required(i.period,'دوره خط مبنا'),site:required(i.site,'سایت'),seu:required(i.seu,'مصرف‌کننده عمده'),consumption,production,intensity:consumption/production,calorificValue,calorificBasis,gasReferenceConditions,gasEnergyKwh:calorificValue===null?null:consumption*calorificValue,method:calorificValue===null?'production-intensity':'thermal-energy-intensity',createdAt}
 await store.update(ENERGY_BASELINES_KEY,old=>[b,...(Array.isArray(old)?old.filter(x=>!(x.resource===b.resource&&x.site===b.site&&x.seu===b.seu)):[])].slice(0,100));return b
}
export async function updateEnergyActionStatus(id,status,store,verification){
 const allowed=['planned','in-progress','verified','cancelled']
 if(!allowed.includes(status))throw new Error('وضعیت اقدام بهبود معتبر نیست.')
 const changedAt=new Date().toISOString()
 const evidence=status==='verified'?{
  period:required(verification?.period,'دوره صحه‌گذاری'),
  measuredSavings:number(verification?.measuredSavings,'صرفه‌جویی اندازه‌گیری‌شده',0),
  verifier:required(verification?.verifier,'تأییدکننده'),
  evidenceNote:required(verification?.evidenceNote,'شواهد اندازه‌گیری و روش صحه‌گذاری'),
  verifiedAt:changedAt
 }:null
 let found=false
 await store.update(ENERGY_ACTIONS_KEY,old=>(Array.isArray(old)?old:[]).map(item=>{
  if(item.id!==id)return item
  found=true
  const previousVerification=item.verification??null
  const statusHistory=[...(Array.isArray(item.statusHistory)?item.statusHistory:[]),{from:item.status??'planned',to:status,changedAt,verifier:evidence?.verifier??null}]
  const verificationHistory=[...(Array.isArray(item.verificationHistory)?item.verificationHistory:[]),...(previousVerification?[{...previousVerification,supersededAt:changedAt}]:[])]
  return {...item,status,verification:evidence,statusHistory,verificationHistory,updatedAt:changedAt}
 }))
 if(!found)throw new Error('اقدام موردنظر پیدا نشد.')
 return true
}
export async function saveEnergyAction(i,store,createdAt=new Date().toISOString()){
 if(!Object.hasOwn(RESOURCE_CONFIG,i.resource))throw new Error('نوع منبع اقدام معتبر نیست.')
 const status=['planned','in-progress','verified','cancelled'].includes(i.status)?i.status:'planned'
 if(status==='verified')throw new Error('اقدام جدید بدون شواهد صحه‌گذاری نمی‌تواند تأییدشده ثبت شود.')
 const a={id:'MOD-05-ACT-'+Date.parse(createdAt),title:required(i.title,'عنوان اقدام'),resource:i.resource,owner:required(i.owner,'مسئول'),dueDate:required(i.dueDate,'موعد اجرا'),expectedSavings:number(i.expectedSavings,'صرفه‌جویی مورد انتظار',0),status,createdAt,statusHistory:[{from:null,to:status,changedAt:createdAt,verifier:null}],verificationHistory:[]}
 await store.update(ENERGY_ACTIONS_KEY,old=>[a,...(Array.isArray(old)?old:[])].slice(0,200));return a
}

export function analyzeGasUtility({consumptionNm3,calorificValueKwhPerNm3,productionTon,cost}){
 const volume=number(consumptionNm3,'حجم گاز',0),calorific=number(calorificValueKwhPerNm3,'ارزش حرارتی گاز',0),production=number(productionTon,'تولید',0)
 if(!volume||!calorific||!production)throw new Error('حجم گاز، ارزش حرارتی و تولید باید بزرگ‌تر از صفر باشند.')
 const energyKwh=volume*calorific
 const costValue=cost===null||cost===undefined||cost===''?null:number(cost,'هزینه گاز',0)
 return {volumeNm3:volume,energyKwh,energyGJ:energyKwh*0.0036,specificVolumeNm3PerTon:volume/production,specificEnergyKwhPerTon:energyKwh/production,costPerGJ:costValue===null?null:costValue/(energyKwh*0.0036)}
}
export function analyzeWaterBalance(input){
 const value=(key)=>{const raw=input[key]??0;const n=Number(raw);if(!Number.isFinite(n)||n<0)throw new Error('مقدار '+key+' باید عددی غیرمنفی باشد.');return n}
 const sourceFields=['municipalWaterM3','groundwaterM3','surfaceWaterM3','otherFreshwaterM3']
 const hasSourceBreakdown=sourceFields.some(k=>input[k]!==undefined&&input[k]!==null&&input[k]!=='')
 const sourceBreakdown=Object.fromEntries(sourceFields.map(k=>[k,value(k)]))
 const freshwaterM3=hasSourceBreakdown?Object.values(sourceBreakdown).reduce((s,n)=>s+n,0):value('freshwaterM3')
 const externalReuseM3=value('externalReuseM3'),internalRecirculationM3=value('internalRecirculationM3'),dischargeM3=value('dischargeM3'),evaporationM3=value('evaporationM3'),productIncorporationM3=value('productIncorporationM3'),inventoryIncreaseM3=value('inventoryIncreaseM3'),productionTon=number(input.productionTon,'تولید',0)
 if(!productionTon)throw new Error('تولید باید بزرگ‌تر از صفر باشد.')
 const boundaryInput=freshwaterM3+externalReuseM3
 if(!boundaryInput)throw new Error('آب ورودی تازه یا بازیافتی بیرونی باید بزرگ‌تر از صفر باشد.')
 const accountedOutput=dischargeM3+evaporationM3+productIncorporationM3+inventoryIncreaseM3
 const gap=boundaryInput-accountedOutput
 return {freshwaterM3,boundaryInput,accountedOutput,balanceGap:gap,freshwaterSources:sourceBreakdown,balanceClosurePercent:accountedOutput/boundaryInput*100,withdrawalIntensity:freshwaterM3/productionTon,netConsumption:boundaryInput-dischargeM3,netConsumptionIntensity:(boundaryInput-dischargeM3)/productionTon,externalReuseSharePercent:externalReuseM3/boundaryInput*100,internalRecirculationM3,internalRecirculationIntensity:internalRecirculationM3/productionTon,warnings:Math.abs(gap)>Math.max(.1,boundaryInput*.05)?['تراز آب بیش از تلورانس ۵٪ اختلاف دارد؛ مرز اندازه‌گیری، تخلیه، تبخیر و تغییر موجودی را بررسی کنید.']:[]}
}
export async function saveWaterBalance(input,store,createdAt=new Date().toISOString()){
 required(input.period,'دوره تراز آب');required(input.site,'سایت/فرآیند');required(input.seu,'مصرف‌کننده عمده/مرز اندازه‌گیری')
 const analysis=analyzeWaterBalance(input)
 const row={id:'MOD-05-WATER-'+Date.parse(createdAt),createdAt,...input,...analysis}
 await store.update(WATER_BALANCE_KEY,old=>[row,...(Array.isArray(old)?old:[])].slice(0,300))
 return row
}

export function analyzeEnergyTrends(records,{resource,site,seu}={}) {
 const selected=(Array.isArray(records)?records:[]).filter(x=>
  (!resource||x.resource===resource)&&(!site||x.site===site)&&(!seu||x.seu===seu)
 )
 const groups=new Map()
 for(const row of selected){const key=[row.resource,row.site,row.seu].map(v=>String(v??'')).join('::');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row)}
 const points=[],series=[],warnings=[]
 for(const [key,items] of groups){
  const sorted=items.slice().sort((a,b)=>String(a.period).localeCompare(String(b.period),'en',{numeric:true})||String(a.id??'').localeCompare(String(b.id??'')))
  const first=sorted[0]
  const gasThermal=first?.resource==='gas'&&sorted.every(x=>Number(x.gasEnergyKwh)>0&&['gross','net'].includes(x.calorificBasis)&&x.calorificBasis===first.calorificBasis&&String(x.gasReferenceConditions??'').trim()!==''&&String(x.gasReferenceConditions??'').trim()===String(first.gasReferenceConditions??'').trim())
  if(first?.resource==='gas'&&!gasThermal)warnings.push('سری گاز '+String(first.site)+' / '+String(first.seu)+' به‌دلیل تفاوت یا فقدان مبنای HHV/LHV یا شرایط مرجع، فقط بر مبنای Nm³ تحلیل شده است.')
  const groupPoints=sorted.map((x,index)=>{
   const prior=index?sorted[index-1]:null
   const value=gasThermal?Number(x.gasEnergyKwh):Number(x.consumption)
   const priorValue=prior?(gasThermal?Number(prior.gasEnergyKwh):Number(prior.consumption)):null
   const intensity=value/Number(x.production)
   const priorIntensity=prior&&Number(prior.production)>0?priorValue/Number(prior.production):null
   const costPerOutput=Number(x.cost)/Number(x.production)
   const priorCostPerOutput=prior&&Number(prior.production)>0?Number(prior.cost)/Number(prior.production):null
   return {id:x.id,period:x.period,resource:x.resource,site:x.site,seu:x.seu,consumption:Number(x.consumption),analysisConsumption:value,production:Number(x.production),cost:Number(x.cost),intensity,costPerOutput,comparisonUnit:gasThermal?'kWh/t':x.resource==='electricity'?'kWh/t':x.resource==='gas'?'Nm³/t':'m³/t',comparisonBasis:gasThermal?'thermal-energy':'volume-or-resource',periodChangePercent:priorValue>0?(value/priorValue-1)*100:null,intensityChangePercent:priorIntensity>0?(intensity/priorIntensity-1)*100:null,costPerOutputChangePercent:priorCostPerOutput>0?(costPerOutput/priorCostPerOutput-1)*100:null}
  })
  series.push({key,resource:first.resource,site:first.site,seu:first.seu,comparisonBasis:gasThermal?'thermal-energy':'volume-or-resource',points:groupPoints})
  points.push(...groupPoints)
 }
 return {count:points.length,points,series,warnings}
}
function splitCost(amount,consumers,weightKey){
 const total=consumers.reduce((s,x)=>s+Math.max(0,Number(x[weightKey])||0),0)
 if(!Number.isFinite(amount)||amount<0)throw new Error('مبلغ جزء قبض معتبر نیست.')
 if(amount===0)return consumers.map(()=>0)
 if(total<=0)throw new Error('برای تخصیص جزء قبض، مبنای مصرف/دیماند/راکتیو معتبر ثبت نشده است: '+weightKey)
 let assigned=0
 return consumers.map((x,i)=>{const share=i===consumers.length-1?amount-assigned:amount*Math.max(0,Number(x[weightKey])||0)/total;assigned+=share;return share})
}
export function allocateElectricityBillCost({bill,consumers}){
 if(!bill||!Array.isArray(consumers)||!consumers.length)throw new Error('قبض و حداقل یک مرکز هزینه برای تخصیص لازم است.')
 const amount=Number(bill.amount)
 if(!Number.isFinite(amount)||amount<0)throw new Error('مبلغ نهایی قبض معتبر نیست.')
 const parts=['energyCharge','demandCharge','reactiveCharge','taxCharge']
 const values=Object.fromEntries(parts.map(k=>[k,bill[k]===null||bill[k]===undefined||bill[k]===''?0:Number(bill[k])]))
 if(parts.some(k=>!Number.isFinite(values[k])||values[k]<0))throw new Error('اجزای مبلغ قبض باید اعداد غیرمنفی باشند.')
 const componentTotal=parts.reduce((s,k)=>s+values[k],0)
 if(componentTotal>amount+Math.max(1,amount*.001))throw new Error('جمع اجزای قبض از مبلغ نهایی بیشتر است؛ ابتدا قبض را تطبیق دهید.')
 const residual=Math.max(0,amount-componentTotal)
 const energy=splitCost(values.energyCharge,consumers,'consumptionKwh')
 const demand=splitCost(values.demandCharge,consumers,'peakDemandKw')
 const reactive=splitCost(values.reactiveCharge,consumers,'reactiveKvarh')
 const preTax=consumers.map((_,i)=>energy[i]+demand[i]+reactive[i])
 const tax=splitCost(values.taxCharge,consumers.map((x,i)=>({...x,taxWeight:preTax[i]})),'taxWeight')
 const other=splitCost(residual,consumers,'consumptionKwh')
 const allocations=consumers.map((x,i)=>{
  const allocatedEnergy=energy[i],allocatedDemand=demand[i],allocatedReactive=reactive[i],allocatedTax=tax[i],allocatedOther=other[i]
  const total=allocatedEnergy+allocatedDemand+allocatedReactive+allocatedTax+allocatedOther
  const production=Number(x.productionTon)||0
  return {costCenterId:String(x.id??x.name??i+1),name:String(x.name??x.id??'مرکز هزینه '+(i+1)),energyCharge:allocatedEnergy,demandCharge:allocatedDemand,reactiveCharge:allocatedReactive,taxCharge:allocatedTax,otherCharges:allocatedOther,totalCost:total,productionTon:production,costPerTon:production>0?total/production:null}
 })
 const allocatedTotal=allocations.reduce((s,x)=>s+x.totalCost,0)
 if(Math.abs(allocatedTotal-amount)>Math.max(.0001,amount*1e-10))throw new Error('تخصیص اجزای قبض با مبلغ نهایی تطبیق ندارد.')
 return {billId:String(bill.id??''),billNumber:String(bill.billNumber??''),period:String(bill.period??''),currencyUnit:'واحد پول قبض',billAmount:amount,componentTotal,residual,allocatedTotal,allocations,allocationRules:{energyCharge:'consumptionKwh',demandCharge:'peakDemandKw',reactiveCharge:'reactiveKvarh',taxCharge:'pre-tax allocated cost',residual:'consumptionKwh'},warnings:residual>0?['باقیمانده قبض که در اجزای تفکیک‌شده ثبت نشده، به نسبت kWh تخصیص یافته است؛ ماهیت اقلام ثابت/سایر را از روی قبض بررسی و در صورت لزوم تفکیک کنید.']:[],sourceReference:{type:'MOD-05-electricity-bill',billId:String(bill.id??''),billNumber:String(bill.billNumber??''),period:String(bill.period??'')},duplicatePostingGuard:'MOD-02 must post this source reference once; do not add bill total again if component allocations are already posted.'}
}

export function prepareModule02EnergyCostPosting({baseInput,allocation,costCenterId}){
 if(!baseInput||typeof baseInput!=='object'||!allocation||!Array.isArray(allocation.allocations))throw new Error('ورودی بهای تمام‌شده یا تخصیص قبض معتبر نیست.')
 const selected=allocation.allocations.find(x=>x.costCenterId===String(costCenterId))
 if(!selected)throw new Error('مرکز هزینه انتخاب‌شده در تخصیص قبض وجود ندارد.')
 if(!Number.isFinite(Number(selected.totalCost))||Number(selected.totalCost)<0)throw new Error('مبلغ تخصیص‌یافته به مرکز هزینه معتبر نیست.')
 return {input:{...baseInput,energy:String(selected.totalCost)},sourceReferences:{energyBillId:String(allocation.billId??''),billNumber:String(allocation.billNumber??''),billingPeriod:String(allocation.period??''),energyAllocationCost:Number(selected.totalCost),energyAllocationCenter:selected.costCenterId,energyAllocationBasis:'kWh + demand kW + reactive kVArh + tax + residual'},duplicatePostingGuard:'Use this prepared energy value as MOD-02 energy cost; do not add the full bill total separately.'}
}
