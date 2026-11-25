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
 return {resource:i.resource,period:required(i.period,'دوره'),site:required(i.site,'سایت/واحد'),seu:required(i.seu,'مصرف‌کننده عمده'),meterId:String(i.meterId??''),consumption,production,cost,unit:RESOURCE_CONFIG[i.resource].unit,intensity:consumption/production,costPerOutput:cost/production,operatingHours,startReading:start,endReading:end,calorificValue:(()=>{const supplied=i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined;if(i.resource!=='gas'||!supplied)return null;const value=number(i.calorificValue,'ارزش حرارتی گاز',0);if(value<=0)throw new Error('ارزش حرارتی گاز باید بزرگ‌تر از صفر باشد.');return value})(),calorificBasis:i.resource==='gas'&&['gross','net'].includes(i.calorificBasis)?i.calorificBasis:null,gasReferenceConditions:i.resource==='gas'?String(i.gasReferenceConditions??'').trim():null,gasEnergyKwh:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined?consumption*number(i.calorificValue,'ارزش حرارتی گاز',0):null,gasEnergyIntensityKwhPerTon:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined?consumption*number(i.calorificValue,'ارزش حرارتی گاز',0)/production:null,gasCostPerGJ:i.resource==='gas'&&i.calorificValue!==''&&i.calorificValue!==null&&i.calorificValue!==undefined&&consumption>0?cost/(consumption*number(i.calorificValue,'ارزش حرارتی گاز',0)*0.0036):null,productMixIndex:optionalDriver(i.productMixIndex,'شاخص ترکیب محصول',{min:0,max:100}),ambientTemperatureC:optionalDriver(i.ambientTemperatureC,'دمای محیط'),feedQualityIndex:optionalDriver(i.feedQualityIndex,'شاخص کیفیت خوراک',{min:0,max:100}),shutdownHours:optionalDriver(i.shutdownHours,'ساعات توقف',{min:0}),sourceBillId:String(i.sourceBillId??''),sourceBillNumber:String(i.sourceBillNumber??''),note:String(i.note??''),dataQuality:i.dataQuality==='measured'?'measured':'estimated'}
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
 const y=rows.map(r=>Number(r.analysisConsumption)),size=predictorKeys.length+1
 const statistics=predictorKeys.map(key=>{
  const values=rows.map(r=>Number(r[key])),mean=values.reduce((sum,value)=>sum+value,0)/values.length
  const variance=values.reduce((sum,value)=>sum+(value-mean)**2,0)/values.length
  const scale=Math.sqrt(variance)
  return {mean,scale:Number.isFinite(scale)&&scale>1e-12?scale:1}
 })
 const x=rows.map(r=>[1,...predictorKeys.map((key,index)=>(Number(r[key])-statistics[index].mean)/statistics[index].scale)])
 const matrix=Array.from({length:size},()=>Array(size).fill(0)),vector=Array(size).fill(0)
 for(let i=0;i<x.length;i++)for(let j=0;j<size;j++){vector[j]+=x[i][j]*y[i];for(let k=0;k<size;k++)matrix[j][k]+=x[i][j]*x[i][k]}
 const standardized=solveEnergyLinearSystem(matrix,vector)
 if(!standardized)return null
 const predicted=x.map(row=>row.reduce((sum,value,index)=>sum+value*standardized[index],0))
 const coefficients=[standardized[0]-statistics.reduce((sum,item,index)=>sum+standardized[index+1]*item.mean/item.scale,0),...statistics.map((item,index)=>standardized[index+1]/item.scale)]
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
   const variable=complete&&training.some(r=>Number(r[driver])!==Number(training[0][driver]))
   if(!complete){omittedDrivers.push(driverLabels[driver]+' (داده ناقص)');continue}
   if(!variable){omittedDrivers.push(driverLabels[driver]+' (بدون تغییر)');continue}
   if(training.length<predictorKeys.length+4){omittedDrivers.push(driverLabels[driver]+' (دوره کافی برای برازش مستقل وجود ندارد)');continue}
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




export const ENERGY_TARIFF_CONTRACTS_KEY = 'module-intelligence:MOD-05:tariff-contracts:v1'
export const ENERGY_TARIFF_CALCULATIONS_KEY = 'module-intelligence:MOD-05:tariff-calculations:v1'
export const ENERGY_TARIFF_RECONCILIATIONS_KEY = 'module-intelligence:MOD-05:tariff-reconciliations:v1'
export function parseEnergyTariffTiers(text){
 const raw=String(text??'').trim();if(!raw)return []
 const tiers=raw.split(';').map((entry,index)=>{const parts=entry.trim().split(':');if(parts.length!==2)throw new Error('تعرفه پلکانی را به صورت حدنصاب:نرخ و با ; جدا کنید؛ برای پله آخر از * استفاده کنید.');const upperLimit=parts[0].trim()==='*'?null:Number(parts[0].trim()),rate=Number(parts[1].trim());if((upperLimit!==null&&(!Number.isFinite(upperLimit)||upperLimit<=0))||!Number.isFinite(rate)||rate<0)throw new Error('حدنصاب و نرخ هر پله باید معتبر و غیرمنفی باشند.');return {upperLimit,rate,order:index+1}})
 if(tiers.at(-1)?.upperLimit!==null)throw new Error('آخرین پله تعرفه باید با * و نرخ نهایی نامحدود تعریف شود.')
 for(let i=1;i<tiers.length;i++)if(tiers[i-1].upperLimit===null||(tiers[i].upperLimit!==null&&tiers[i].upperLimit<=tiers[i-1].upperLimit))throw new Error('حدنصاب پله‌های تعرفه باید صعودی و بدون تکرار باشد.')
 return tiers
}
export function parseEnergyTimeOfUseRates(text){
 const raw=String(text??'').trim();if(!raw)return []
 const rows=raw.split(';').map(entry=>{const parts=entry.trim().split(':');if(parts.length!==2)throw new Error('تعرفه زمان‌مند را به صورت بازه:نرخ و با ; جدا کنید.');return {band:required(parts[0],'نام بازه زمانی'),rate:number(parts[1],'نرخ بازه زمانی',0)}})
 if(new Set(rows.map(x=>x.band)).size!==rows.length)throw new Error('نام بازه‌های زمانی تعرفه نباید تکراری باشد.')
 return rows
}
export function parseEnergyTariffLevies(text){
 const raw=String(text??'').trim();if(!raw)return []
 return raw.split(';').map((entry,index)=>{const parts=entry.trim().split('|');if(parts.length!==3)throw new Error('عوارض را به صورت عنوان|fixed یا unit یا percent|مقدار ثبت کنید.');const [label,kind,valueText]=parts,value=number(valueText,'مقدار عوارض',0);if(!['fixed','unit','percent'].includes(kind)||(kind==='percent'&&value>100))throw new Error('نوع یا مقدار عوارض معتبر نیست.');return {key:'levy-'+(index+1),label:required(label,'عنوان عوارض'),kind,value}})
}
export function validateEnergyTariffContract(input,asOf=input.effectiveFrom){
 const resource=input.resource;if(!Object.hasOwn(RESOURCE_CONFIG,resource))throw new Error('نوع منبع قرارداد تعرفه معتبر نیست.')
 const site=required(input.site,'سایت قرارداد'),supplier=required(input.supplier,'تأمین‌کننده / شرکت خدمات‌رسان'),contractNumber=required(input.contractNumber,'شماره قرارداد'),currency=required(input.currency,'واحد پول قرارداد')
 const effectiveFrom=isoDate(input.effectiveFrom,'شروع اعتبار قرارداد'),effectiveTo=String(input.effectiveTo??'').trim()?isoDate(input.effectiveTo,'پایان اعتبار قرارداد'):null
 if(effectiveTo&&effectiveTo<effectiveFrom)throw new Error('پایان اعتبار قرارداد نمی‌تواند پیش از شروع آن باشد.')
 const tiers=Array.isArray(input.tiers)?input.tiers:parseEnergyTariffTiers(input.tiersText),timeOfUseRates=Array.isArray(input.timeOfUseRates)?input.timeOfUseRates:parseEnergyTimeOfUseRates(input.timeOfUseRatesText)
 if(tiers.length&&timeOfUseRates.length)throw new Error('تعرفه پلکانی و زمان‌مند را هم‌زمان فعال نکنید؛ یکی را انتخاب کنید.')
 const energyRate=input.energyRate===''||input.energyRate===null||input.energyRate===undefined?null:number(input.energyRate,'نرخ پایه انرژی',0)
 if(!tiers.length&&!timeOfUseRates.length&&energyRate===null)throw new Error('نرخ پایه، پلکانی یا زمان‌مند الزامی است.')
 const fixedCharge=number(input.fixedCharge??0,'هزینه ثابت',0),demandRate=number(input.demandRate??0,'نرخ دیماند',0),reactiveRate=number(input.reactiveRate??0,'نرخ انرژی راکتیو',0),taxPercent=number(input.taxPercent??0,'درصد مالیات',0)
 if(taxPercent>100)throw new Error('درصد مالیات نمی‌تواند بیش از ۱۰۰ باشد.')
 const optionalRate=(value,label)=>value===''||value===null||value===undefined?null:number(value,label,0)
 const gasTransmissionRate=optionalRate(input.gasTransmissionRate,'نرخ انتقال گاز'),gasDistributionRate=optionalRate(input.gasDistributionRate,'نرخ توزیع گاز'),sewerRate=optionalRate(input.sewerRate,'نرخ فاضلاب'),meterMultiplier=number(input.meterMultiplier??1,'ضریب کنتور',0)
 if(meterMultiplier<=0)throw new Error('ضریب کنتور باید بزرگ‌تر از صفر باشد.')
 if(resource!=='gas'&&(gasTransmissionRate!==null||gasDistributionRate!==null))throw new Error('هزینه انتقال و توزیع گاز فقط برای قرارداد گاز مجاز است.')
 if(resource!=='water'&&sewerRate!==null)throw new Error('هزینه فاضلاب فقط برای قرارداد آب مجاز است.')
 const levies=Array.isArray(input.levies)?input.levies:parseEnergyTariffLevies(input.leviesText)
 return {resource,site,supplier,contractNumber,currency,effectiveFrom,effectiveTo,unit:required(input.unit||RESOURCE_CONFIG[resource].unit,'واحد تعرفه'),energyRate,fixedCharge,demandRate,reactiveRate,taxPercent,tiers,timeOfUseRates,gasTransmissionRate,gasDistributionRate,sewerRate,meterMultiplier,levies,notes:String(input.notes??'').trim()}
}
export async function saveEnergyTariffContract(input,store,createdAt=new Date().toISOString()){
 const checked=validateEnergyTariffContract(input);let saved
 await store.update(ENERGY_TARIFF_CONTRACTS_KEY,old=>{const records=Array.isArray(old)?old:[],existing=records.find(x=>x.id===input.id)||records.find(x=>x.resource===checked.resource&&x.site===checked.site&&x.contractNumber===checked.contractNumber),id=existing?.id??('MOD05-TARIFF-'+Date.parse(createdAt)+'-'+checked.resource+'-'+checked.contractNumber.replace(/[^a-zA-Z0-9_-]/g,'-'));saved={...checked,id,createdAt:existing?.createdAt??createdAt,updatedAt:createdAt,history:[...(existing?.history??[]),...(existing?[{...existing,archivedAt:createdAt}]:[])]};return [saved,...records.filter(x=>x.id!==id)].slice(0,500)})
 return saved
}
export function calculateConfiguredEnergyTariff(input,{contracts=[]}={},calculatedAt=new Date().toISOString()){
 const contract=contracts.find(x=>x.id===input.contractId);if(!contract)throw new Error('قرارداد تعرفه انتخاب‌شده یافت نشد.')
 const resource=input.resource;if(contract.resource!==resource)throw new Error('نوع منبع قرارداد با منبع محاسبه یکسان نیست.')
 const site=required(input.site,'سایت محاسبه');if(contract.site!==site)throw new Error('قرارداد تعرفه متعلق به سایت انتخاب‌شده نیست.')
 const period=isoDate(input.period,'تاریخ دوره قبض');if(period<contract.effectiveFrom||(contract.effectiveTo&&period>contract.effectiveTo))throw new Error('قرارداد در تاریخ دوره قبض معتبر نیست.')
 const rawQuantity=number(input.quantity,'مصرف دوره',0),meterMultiplier=number(input.meterMultiplier??contract.meterMultiplier??1,'ضریب کنتور',0)
 if(meterMultiplier<=0)throw new Error('ضریب کنتور باید بزرگ‌تر از صفر باشد.')
 const quantity=rawQuantity*meterMultiplier,demand=number(input.demand??0,'دیماند',0),reactive=number(input.reactive??0,'انرژی راکتیو',0),tiers=Array.isArray(contract.tiers)?contract.tiers:[],timeRates=Array.isArray(contract.timeOfUseRates)?contract.timeOfUseRates:[]
 let energyCharge=0;const timeOfUseBreakdown=[]
 const timeQuantities=input.timeOfUseQuantities&&typeof input.timeOfUseQuantities==='object'?input.timeOfUseQuantities:{},hasTimeQuantities=Object.keys(timeQuantities).length>0
 if(timeRates.length&&!hasTimeQuantities)throw new Error('برای تعرفه زمان‌مند، مقدار مصرف هر بازه را جداگانه وارد کنید.')
 if(hasTimeQuantities){
  const supplied=Object.values(timeQuantities).reduce((sum,value)=>sum+number(value,'مصرف بازه زمانی',0),0)
  if(Math.abs(supplied-rawQuantity)>Math.max(.01,rawQuantity*.001))throw new Error('جمع مصرف بازه‌های زمانی باید با مصرف کل قبض تطبیق داشته باشد.')
  for(const [band,value] of Object.entries(timeQuantities)){const rate=timeRates.find(x=>x.band===band);if(!rate)throw new Error('برای بازه زمانی '+band+' در قرارداد نرخ تعریف نشده است.');const bandQuantity=number(value,'مصرف بازه '+band,0)*meterMultiplier,charge=bandQuantity*Number(rate.rate);energyCharge+=charge;timeOfUseBreakdown.push({band,quantity:bandQuantity,rate:Number(rate.rate),charge})}
 }else if(tiers.length){
  let lower=0,remaining=quantity
  for(const tier of tiers){const capacity=tier.upperLimit===null?remaining:Math.max(0,Math.min(remaining,tier.upperLimit-lower));energyCharge+=capacity*Number(tier.rate);remaining-=capacity;if(tier.upperLimit===null||remaining<=0)break;lower=tier.upperLimit}
  if(remaining>0)throw new Error('جدول پلکانی قرارداد تمام مقدار مصرف را پوشش نمی‌دهد.')
 }else if(contract.energyRate!==null&&contract.energyRate!==undefined)energyCharge=quantity*Number(contract.energyRate)
 else throw new Error('نرخ انرژی قابل اعمال در قرارداد تعریف نشده است.')
 const demandCharge=demand*Number(contract.demandRate??0),reactiveCharge=reactive*Number(contract.reactiveRate??0),fixedCharge=Number(contract.fixedCharge??0)
 const gasTransmissionCharge=resource==='gas'&&contract.gasTransmissionRate!==null&&contract.gasTransmissionRate!==undefined?quantity*Number(contract.gasTransmissionRate):null
 const gasDistributionCharge=resource==='gas'&&contract.gasDistributionRate!==null&&contract.gasDistributionRate!==undefined?quantity*Number(contract.gasDistributionRate):null
 const sewerCharge=resource==='water'&&contract.sewerRate!==null&&contract.sewerRate!==undefined?quantity*Number(contract.sewerRate):null
 const preLevySubtotal=energyCharge+demandCharge+reactiveCharge+fixedCharge+Number(gasTransmissionCharge??0)+Number(gasDistributionCharge??0)+Number(sewerCharge??0)
 const levies=(contract.levies??[]).map(levy=>({key:levy.key,label:levy.label,kind:levy.kind,value:Number(levy.value),amount:levy.kind==='fixed'?Number(levy.value):levy.kind==='unit'?quantity*Number(levy.value):preLevySubtotal*Number(levy.value)/100}))
 const levyTotal=levies.reduce((sum,x)=>sum+x.amount,0),subtotal=preLevySubtotal+levyTotal,tax=subtotal*Number(contract.taxPercent??0)/100,total=subtotal+tax
 const unconfiguredComponents=[]
 if(resource==='gas'&&contract.gasTransmissionRate==null)unconfiguredComponents.push('gas-transmission')
 if(resource==='gas'&&contract.gasDistributionRate==null)unconfiguredComponents.push('gas-distribution')
 if(resource==='water'&&contract.sewerRate==null)unconfiguredComponents.push('sewer')
 return {id:'MOD05-TARIFF-CALC-'+Date.parse(calculatedAt)+'-'+String(contract.id),contractId:contract.id,resource,site,period,supplier:contract.supplier,contractNumber:contract.contractNumber,currency:contract.currency,unit:contract.unit,quantity:rawQuantity,billedQuantity:quantity,meterMultiplier,demand,reactive,energyCharge,demandCharge,reactiveCharge,fixedCharge,gasTransmissionCharge,gasDistributionCharge,sewerCharge,timeOfUseBreakdown,levies,levyTotal,unconfiguredComponents,subtotal,taxPercent:Number(contract.taxPercent??0),tax,total,calculatedAt,source:'Configured user-entered tariff contract',warnings:['نرخ‌ها و عوارض فقط از قرارداد ثبت‌شده کاربر خوانده می‌شوند؛ اجزای تعریف‌نشده در مبلغ منظور نمی‌شوند و باید با قبض تطبیق داده شوند.']}
}
export async function saveEnergyTariffCalculation(input,context,store,calculatedAt=new Date().toISOString()){
 const result=calculateConfiguredEnergyTariff(input,context,calculatedAt);await store.update(ENERGY_TARIFF_CALCULATIONS_KEY,old=>[result,...(Array.isArray(old)?old:[])].slice(0,1000));return result
}

export function reconcileEnergyTariffWithBill({calculation,bill,resource,tolerancePercent=1}){
 if(!calculation||!bill)throw new Error('محاسبه تعرفه و قبض واقعی برای تطبیق الزامی هستند.')
 if(!['electricity','gas','water'].includes(resource)||calculation.resource!==resource)throw new Error('منبع محاسبه تعرفه با قبض یکسان نیست.')
 if(bill.consumption===null||bill.consumption===undefined||!Number.isFinite(Number(bill.consumption)))throw new Error('مصرف ثبت‌شده قبض برای تطبیق معتبر نیست.')
 const tolerance=number(tolerancePercent,'دامنه اغماض درصدی',0)
 if(tolerance>20)throw new Error('دامنه اغماض نمی‌تواند بیش از ۲۰ درصد باشد.')
 const components=[]
 const compare=(key,label,expected,actual,modeled=true)=>{
  if(!modeled){components.push({key,label,expected:null,actual:actual===null||actual===undefined?null:Number(actual),difference:null,differencePercent:null,status:'not-modeled',note:'این جزء در ساختار فعلی قرارداد تعرفه مدل نشده است.'});return}
  if(actual===null||actual===undefined||actual===''){components.push({key,label,expected:Number(expected),actual:null,difference:null,differencePercent:null,status:'not-provided',note:'مقدار جزء قبض ارائه نشده است.'});return}
  const observed=number(actual,label,0),target=Number(expected),difference=observed-target,denominator=Math.max(Math.abs(target),Math.abs(observed),1)
  const differencePercent=Math.abs(difference)/denominator*100
  const limit=Math.max(1,Math.abs(target)*tolerance/100)
  components.push({key,label,expected:target,actual:observed,difference,differencePercent,status:Math.abs(difference)<=limit?'within-tolerance':'mismatch',toleranceAmount:limit})
 }
 const billPeriod=String(bill.period??'').trim()
 const billConsumption=Number(bill.consumption)
 const expectedConsumption=Number(calculation.billedQuantity??calculation.quantity)
 const consumptionDifference=billConsumption-expectedConsumption
 const consumptionPct=Math.abs(consumptionDifference)/Math.max(Math.abs(billConsumption),Math.abs(expectedConsumption),1)*100
 components.push({key:'consumption',label:'مصرف قبض',expected:expectedConsumption,actual:billConsumption,difference:consumptionDifference,differencePercent:consumptionPct,status:consumptionPct<=tolerance?'within-tolerance':'mismatch'})
 if(resource==='electricity'){
  compare('energyCharge','بهای انرژی',calculation.energyCharge,bill.energyCharge)
  compare('demandCharge','بهای دیماند',calculation.demandCharge,bill.demandCharge)
  compare('reactiveCharge','بهای انرژی راکتیو',calculation.reactiveCharge,bill.reactiveCharge)
  compare('taxCharge','مالیات و عوارض',calculation.tax,bill.taxCharge)
  for(const band of calculation.timeOfUseBreakdown??[])compare('time-of-use-'+band.band,'بهای بازه '+band.band,band.charge,bill.timeOfUseCharges?.[band.band],true)
 }else if(resource==='gas'){
  compare('gasCharge','بهای گاز',calculation.energyCharge,bill.gasCharge)
  compare('gasTransmissionCharge','هزینه انتقال گاز',calculation.gasTransmissionCharge,bill.gasTransmissionCharge,calculation.gasTransmissionCharge!==null&&calculation.gasTransmissionCharge!==undefined)
  compare('gasDistributionCharge','هزینه توزیع گاز',calculation.gasDistributionCharge,bill.gasDistributionCharge,calculation.gasDistributionCharge!==null&&calculation.gasDistributionCharge!==undefined)
  if((calculation.levies??[]).length)compare('levyCharge','عوارض قراردادی',calculation.levyTotal,bill.levyCharge)
  else compare('levyCharge','عوارض قراردادی',null,bill.levyCharge,false)
  compare('taxCharge','مالیات و عوارض',calculation.tax,bill.taxCharge)
  compare('otherCharges','سایر هزینه‌ها',null,bill.otherCharges,false)
 }else{
  compare('waterCharge','بهای آب',calculation.energyCharge,bill.waterCharge)
  compare('sewerCharge','بهای دفع فاضلاب',calculation.sewerCharge,bill.sewerCharge,calculation.sewerCharge!==null&&calculation.sewerCharge!==undefined)
  compare('fixedCharge','هزینه ثابت قبض',calculation.fixedCharge,bill.fixedCharge)
  if((calculation.levies??[]).length)compare('levyCharge','عوارض قراردادی',calculation.levyCharge,bill.levyCharge)
  else compare('levyCharge','عوارض قراردادی',null,bill.levyCharge,false)
  compare('taxCharge','مالیات و عوارض',calculation.tax,bill.taxCharge)
  compare('otherCharges','سایر هزینه‌ها',null,bill.otherCharges,false)
 }
 for(const levy of calculation.levies??[])compare(levy.key,'عوارض '+levy.label,levy.amount,bill.levies?.[levy.key]??bill.levyAmounts?.[levy.key],true)
 compare('amount','مبلغ قابل پرداخت',calculation.total,bill.amount)
 const mismatches=components.filter(x=>x.status==='mismatch')
 const incomplete=components.filter(x=>x.status==='not-provided'||x.status==='not-modeled')
 const status=mismatches.length?'discrepancy':incomplete.length?'incomplete':'reconciled'
 const warnings=[]
 if(billPeriod&&billPeriod!==calculation.period)warnings.push('دوره قبض با تاریخ محاسبه تعرفه عیناً یکسان نیست؛ بازه صورتحساب را دستی کنترل کنید.')
 if(components.some(x=>x.status==='not-modeled'))warnings.push('برخی ردیف‌های قبض مانند انتقال، فاضلاب یا سایر عوارض در قرارداد فعلی مدل نشده‌اند؛ نتیجه تطبیق کامل نیست.')
 if(status==='discrepancy')warnings.push('حداقل یک جزء یا مبلغ کل قبض خارج از دامنه اغماض تعیین‌شده است.')
 if(status==='incomplete')warnings.push('برای تطبیق کامل، تمام اجزای قابل مقایسه باید در قبض و قرارداد ثبت شوند.')
 return {id:'MOD05-RECON-'+Date.now()+'-'+String(bill.id??bill.billNumber??'bill').replace(/[^a-zA-Z0-9_-]/g,'-'),resource,site:calculation.site,contractId:calculation.contractId,contractNumber:calculation.contractNumber,billId:String(bill.id??''),billNumber:String(bill.billNumber??''),accountNumber:String(bill.accountNumber??''),billPeriod,calculationPeriod:calculation.period,currency:calculation.currency,calculatedAt:calculation.calculatedAt,reconciledAt:new Date().toISOString(),tolerancePercent:tolerance,components,mismatchCount:mismatches.length,incompleteCount:incomplete.length,status,warnings,calculatedTotal:calculation.total,billedTotal:bill.amount===null||bill.amount===undefined?null:Number(bill.amount),totalDifference:bill.amount===null||bill.amount===undefined?null:Number(bill.amount)-calculation.total}
}
export async function saveEnergyTariffReconciliation(input,store){
 const result=reconcileEnergyTariffWithBill(input)
 await store.update(ENERGY_TARIFF_RECONCILIATIONS_KEY,old=>[result,...(Array.isArray(old)?old:[])].slice(0,1000))
 return result
}


export const METER_CALIBRATIONS_KEY = 'module-intelligence:MOD-05:meter-calibrations:v1'
export const ENERGY_MV_EVIDENCE_KEY = 'module-intelligence:MOD-05:mv-evidence:v1'

const isoDate=(value,label)=>{
 const text=required(value,label)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||Number.isNaN(Date.parse(text+'T00:00:00Z'))||new Date(text+'T00:00:00Z').toISOString().slice(0,10)!==text)throw new Error('تاریخ '+label+' باید به قالب YYYY-MM-DD و معتبر باشد.')
 return text
}
const addUtcDays=(date,days)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function getMeterCalibrationStatus(record,asOf=new Date().toISOString().slice(0,10),dueSoonDays=30){
 const today=isoDate(asOf,'تاریخ مبنا')
 const next=isoDate(record?.nextCalibrationDate,'موعد کالیبراسیون')
 const delta=Math.round((Date.parse(next+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)
 return {status:delta<0?'overdue':delta<=dueSoonDays?'due-soon':'valid',daysUntilDue:delta,nextCalibrationDate:next}
}
export function listMeterCalibrationAlerts(records,asOf=new Date().toISOString().slice(0,10),dueSoonDays=30){
 return (Array.isArray(records)?records:[]).map(record=>({...record,...getMeterCalibrationStatus(record,asOf,dueSoonDays)})).filter(record=>record.status!=='valid').sort((a,b)=>a.daysUntilDue-b.daysUntilDue)
}
export function validateMeterCalibration(input,asOf=new Date().toISOString().slice(0,10)){
 const meterId=required(input.meterId,'شناسه تجهیز اندازه‌گیری')
 const site=required(input.site,'سایت')
 const parameter=required(input.parameter,'کمیت اندازه‌گیری')
 const unit=required(input.unit,'واحد اندازه‌گیری')
 const intervalDays=number(input.intervalDays,'فاصله کالیبراسیون',1)
 if(!Number.isInteger(intervalDays)||intervalDays>3650)throw new Error('فاصله کالیبراسیون باید عدد صحیح بین ۱ تا ۳۶۵۰ روز باشد.')
 const lastCalibrationDate=isoDate(input.lastCalibrationDate,'آخرین کالیبراسیون')
 const today=isoDate(asOf,'تاریخ مبنا')
 if(lastCalibrationDate>today)throw new Error('تاریخ آخرین کالیبراسیون نمی‌تواند در آینده باشد.')
 const certificateRef=required(input.certificateRef,'شماره گواهی / مرجع ردیابی')
 const provider=required(input.provider,'آزمایشگاه / مرجع کالیبراسیون')
 const accuracy=input.accuracy===''||input.accuracy===null||input.accuracy===undefined?null:number(input.accuracy,'دقت اعلام‌شده',0)
 const range=String(input.measurementRange??'').trim()
 const nextCalibrationDate=addUtcDays(lastCalibrationDate,intervalDays)
 return {meterId,site,parameter,unit,intervalDays,lastCalibrationDate,nextCalibrationDate,certificateRef,provider,owner:String(input.owner??'').trim(),accuracy,measurementRange:range,notes:String(input.notes??'').trim(),...getMeterCalibrationStatus({nextCalibrationDate},today)}
}
export async function saveMeterCalibration(input,store,createdAt=new Date().toISOString()){
 const checked=validateMeterCalibration(input,createdAt.slice(0,10))
 let saved
 await store.update(METER_CALIBRATIONS_KEY,old=>{
  const records=Array.isArray(old)?old:[]
  const existing=records.find(x=>x.id===input.id)||records.find(x=>x.meterId===checked.meterId&&x.site===checked.site)
  const id=existing?.id??('MOD05-CAL-'+Date.parse(createdAt)+'-'+checked.meterId.replace(/[^a-zA-Z0-9_-]/g,'-'))
  const history=[...(existing?.history??[]),...(existing?[{...existing,archivedAt:createdAt}]:[])]
  saved={...checked,id,createdAt,updatedAt:createdAt,history}
  return [saved,...records.filter(x=>x.id!==id)].slice(0,1000)
 })
 return saved
}
export function buildEnergyMvEvidencePack(input,{rows=[],baselines=[],calibrations=[]}={},generatedAt=new Date().toISOString()){
 const resource=input.resource
 if(!Object.hasOwn(RESOURCE_CONFIG,resource))throw new Error('نوع منبع برای بسته M&V معتبر نیست.')
 if(input.boundaryConfirmed!==true)throw new Error('تأیید صریح مرز اندازه‌گیری برای بسته M&V الزامی است.')
 const baseline=baselines.find(x=>x.id===input.baselineId)
 if(!baseline)throw new Error('خط مبنای انتخاب‌شده در دسترس نیست.')
 if(baseline.resource!==resource)throw new Error('منبع خط مبنا با منبع بسته M&V یکسان نیست.')
 const actualIds=[...new Set(Array.isArray(input.actualRecordIds)?input.actualRecordIds:[])]
 if(!actualIds.length)throw new Error('حداقل یک رکورد واقعی برای دوره گزارش انتخاب کنید.')
 const actuals=actualIds.map(id=>rows.find(x=>x.id===id))
 if(actuals.some(x=>!x))throw new Error('یکی از رکوردهای واقعی انتخاب‌شده یافت نشد.')
 for(const actual of actuals){
  if(actual.resource!==resource||actual.site!==baseline.site||actual.seu!==baseline.seu)throw new Error('تمام رکوردهای واقعی باید از همان منبع، سایت و مصرف‌کننده عمده خط مبنا باشند.')
  if(actual.dataQuality==='estimated')throw new Error('رکوردهای برآوردی برای بسته شواهد صرفه‌جویی پذیرفته نیستند.')
  if(!(Number(actual.production)>0))throw new Error('تولید/فعالیت رکورد واقعی باید معتبر باشد.')
 }
 const calculations=actuals.map(actual=>({recordId:actual.id,period:actual.period,meterId:actual.meterId??'',...calculateEnergyPerformance({resource,baseline,actual})}))
 const comparisonBases=[...new Set(calculations.map(x=>x.comparisonBasis))]
 if(comparisonBases.length!==1)throw new Error('مبنای محاسبه رکوردهای انتخاب‌شده یکسان نیست؛ دوره‌های گاز با مبنای حرارتی و حجمی را در یک بسته ادغام نکنید.')
 const comparisonUnit=calculations[0].comparisonUnit
 const normalizedBaseline=calculations.reduce((sum,x)=>sum+x.normalizedBaseline,0)
 const actualConsumption=calculations.reduce((sum,x)=>sum+x.actualConsumption,0)
 const calculatedVariance=normalizedBaseline-actualConsumption
 const baselineUncertaintyPct=number(input.baselineUncertaintyPct,'عدم‌قطعیت نسبی خط مبنا',0)
 const actualUncertaintyPct=number(input.actualUncertaintyPct,'عدم‌قطعیت نسبی اندازه‌گیری واقعی',0)
 const modelUncertaintyPct=number(input.modelUncertaintyPct??0,'عدم‌قطعیت مدل / تعدیل',0)
 const samplingUncertaintyPct=number(input.samplingUncertaintyPct??0,'عدم‌قطعیت نمونه‌گیری',0)
 const resolutionUncertaintyPct=number(input.resolutionUncertaintyPct??0,'عدم‌قطعیت تفکیک‌پذیری ابزار',0)
 const systematicBiasPct=number(input.systematicBiasPct??0,'حد باقیمانده خطای سیستماتیک',0)
 const rhoBaselineActual=number(input.rhoBaselineActual??0,'هم‌بستگی خط مبنا و اندازه‌گیری',-1)
 const rhoBaselineModel=number(input.rhoBaselineModel??0,'هم‌بستگی خط مبنا و مدل',-1)
 const rhoActualModel=number(input.rhoActualModel??0,'هم‌بستگی اندازه‌گیری و مدل',-1)
 const coverageFactor=number(input.coverageFactor??2,'ضریب پوشش عدم‌قطعیت',1)
 const sensitivityBaseline=number(input.sensitivityBaseline??1,'ضریب حساسیت خط مبنا',-10)
 const sensitivityActual=number(input.sensitivityActual??-1,'ضریب حساسیت اندازه‌گیری واقعی',-10)
 const sensitivityModel=number(input.sensitivityModel??1,'ضریب حساسیت مدل',-10)
 const samplingSensitivity=number(input.samplingSensitivity??1,'ضریب حساسیت نمونه‌گیری',-10)
 const resolutionSensitivity=number(input.resolutionSensitivity??1,'ضریب حساسیت تفکیک‌پذیری',-10)
 const rhoLag1=number(input.rhoLag1??0,'خودهم‌بستگی وقفه اول',-0.95)
 const observationCount=optionalDriver(input.observationCount,'تعداد مشاهدات',{min:2,max:1000000})
 const parseDf=(value,label)=>optionalDriver(value,label,{min:0.5,max:1000000000})
 const baselineDf=parseDf(input.baselineDegreesFreedom,'درجات آزادی خط مبنا')
 const actualDf=parseDf(input.actualDegreesFreedom,'درجات آزادی اندازه‌گیری واقعی')
 const modelDf=parseDf(input.modelDegreesFreedom,'درجات آزادی مدل')
 const samplingDf=parseDf(input.samplingDegreesFreedom,'درجات آزادی نمونه‌گیری')
 if([baselineUncertaintyPct,actualUncertaintyPct,modelUncertaintyPct,samplingUncertaintyPct,resolutionUncertaintyPct,systematicBiasPct].some(x=>x>100)||coverageFactor>3||[rhoBaselineActual,rhoBaselineModel,rhoActualModel].some(x=>x>1)||[sensitivityBaseline,sensitivityActual,sensitivityModel,samplingSensitivity,resolutionSensitivity].some(x=>Math.abs(x)>10)||rhoLag1>0.95)throw new Error('درصدها باید حداکثر ۱۰۰، هم‌بستگی بین ۱- و ۱، خودهم‌بستگی بین ۰٫۹۵- و ۰٫۹۵ و ضرایب حساسیت بین ۱۰- و ۱۰ باشند.')
 const correlationDeterminant=1+2*rhoBaselineActual*rhoBaselineModel*rhoActualModel-rhoBaselineActual**2-rhoBaselineModel**2-rhoActualModel**2
 if(correlationDeterminant< -1e-9)throw new Error('ماتریس هم‌بستگی عدم‌قطعیت معتبر و نیمه‌مثبت معین نیست.')
 const rawBaselineUncertainty=normalizedBaseline*baselineUncertaintyPct/100
 const rawActualUncertainty=actualConsumption*actualUncertaintyPct/100
 const rawModelUncertainty=normalizedBaseline*modelUncertaintyPct/100
 const baselineUncertainty=rawBaselineUncertainty*Math.abs(sensitivityBaseline)
 const actualUncertainty=rawActualUncertainty*Math.abs(sensitivityActual)
 const modelUncertainty=rawModelUncertainty*Math.abs(sensitivityModel)
 let effectiveObservationCount=observationCount,autocorrelationInflation=1
 if(observationCount!==null){
  effectiveObservationCount=observationCount*(1-rhoLag1)/(1+rhoLag1)
  effectiveObservationCount=Math.max(1,Math.min(observationCount*100,effectiveObservationCount))
  autocorrelationInflation=Math.sqrt(observationCount/effectiveObservationCount)
 }
 const samplingUncertainty=actualConsumption*samplingUncertaintyPct/100*Math.abs(samplingSensitivity)*autocorrelationInflation
 const resolutionUncertainty=actualConsumption*resolutionUncertaintyPct/100*Math.abs(resolutionSensitivity)
 const systematicBiasBound=normalizedBaseline*systematicBiasPct/100
 const signedBaseline=rawBaselineUncertainty*sensitivityBaseline,signedActual=rawActualUncertainty*sensitivityActual,signedModel=rawModelUncertainty*sensitivityModel
 const covarianceTerm=2*(rhoBaselineActual*signedBaseline*signedActual+rhoBaselineModel*signedBaseline*signedModel+rhoActualModel*signedActual*signedModel)
 const combinedVariance=baselineUncertainty**2+actualUncertainty**2+modelUncertainty**2+samplingUncertainty**2+resolutionUncertainty**2+covarianceTerm
 if(combinedVariance< -1e-8)throw new Error('واریانس ترکیبی عدم‌قطعیت منفی شده است؛ ورودی‌های هم‌بستگی و ضرایب حساسیت را بازبینی کنید.')
 const combinedStandardUncertainty=Math.sqrt(Math.max(0,combinedVariance))
 const dfTerms=[]
 const addDf=(u,df)=>{if(u>0&&df!==null&&Number.isFinite(df))dfTerms.push(u**4/df)}
 addDf(baselineUncertainty,baselineDf);addDf(actualUncertainty,actualDf);addDf(modelUncertainty,modelDf)
 addDf(samplingUncertainty,samplingDf??(effectiveObservationCount!==null&&effectiveObservationCount>1?effectiveObservationCount-1:null))
 const welchSatterthwaiteDenominator=dfTerms.reduce((sum,x)=>sum+x,0)
 const effectiveDegreesFreedom=welchSatterthwaiteDenominator>0?combinedVariance**2/welchSatterthwaiteDenominator:null
 const z95=1.959963984540054
 const studentT95=effectiveDegreesFreedom&&Number.isFinite(effectiveDegreesFreedom)?z95+(z95**3+z95)/(4*effectiveDegreesFreedom)+(5*z95**5+16*z95**3+3*z95)/(96*effectiveDegreesFreedom**2)+(3*z95**7+19*z95**5+17*z95**3-15*z95)/(384*effectiveDegreesFreedom**3):null
 const coverageFactorApplied=studentT95??coverageFactor
 const expandedRandomUncertainty=coverageFactorApplied*combinedStandardUncertainty
 const expandedUncertainty=expandedRandomUncertainty+systematicBiasBound
 const uncertaintyLowerBound=calculatedVariance-expandedUncertainty
 const uncertaintyUpperBound=calculatedVariance+expandedUncertainty
 const uncertaintyConclusion=uncertaintyLowerBound>0?'positive-savings-distinguishable':uncertaintyUpperBound<0?'negative-variance-distinguishable':'not-distinguishable'
 const evidenceAttachments=Array.isArray(input.evidenceAttachments)?input.evidenceAttachments:[]
 if(evidenceAttachments.length>10)throw new Error('حداکثر ۱۰ سند را می‌توان به هر بسته M&V پیوست کرد.')
 const attachmentTotal=evidenceAttachments.reduce((sum,file)=>{
  const size=Number(file.size)
  if(!String(file.name??'').trim()||!Number.isFinite(size)||size<0||size>5*1024*1024)throw new Error('هر پیوست باید نام معتبر و حداکثر ۵ مگابایت حجم داشته باشد.')
  if(!/^data:[^;]+;base64,/.test(String(file.dataUrl??'')))throw new Error('محتوای پیوست باید به‌صورت فایل Base64 معتبر ذخیره شود.')
  return sum+size
 },0)
 if(attachmentTotal>20*1024*1024)throw new Error('حجم مجموع پیوست‌های بسته M&V نمی‌تواند بیش از ۲۰ مگابایت باشد.')
 const calibrationIndex=new Map(calibrations.map(x=>[String(x.meterId)+'::'+String(x.site),x]))
 const calibrationCoverage=actuals.map(actual=>{
  const calibration=calibrationIndex.get(String(actual.meterId??'')+'::'+String(actual.site))
  const status=calibration?getMeterCalibrationStatus(calibration,generatedAt.slice(0,10)):{status:'missing',daysUntilDue:null}
  return {recordId:actual.id,period:actual.period,meterId:actual.meterId??'',site:actual.site,calibrationId:calibration?.id??null,status:status.status,nextCalibrationDate:calibration?.nextCalibrationDate??null}
 })
 const warnings=[...new Set([...calculations.flatMap(x=>x.warnings??[]),...calibrationCoverage.filter(x=>x.status!=='valid').map(x=>'وضعیت کالیبراسیون کنتور '+(x.meterId||'نامشخص')+': '+x.status),...(effectiveDegreesFreedom===null?['درجات آزادی مؤثر کافی ارائه نشده است؛ ضریب پوشش ورودی برای غربالگری استفاده شد.']:['درجه آزادی مؤثر با تقریب Welch–Satterthwaite محاسبه شد؛ برای مؤلفه‌های هم‌بسته، نتیجه تقریبی است.']),...(observationCount===null?['تعداد مشاهدات ثبت نشده است؛ اصلاح خودهم‌بستگی اعمال نشد.']:[])])]
 return {id:'MOD05-MV-'+Date.parse(generatedAt),generatedAt,resource,site:baseline.site,seu:baseline.seu,baseline:{...baseline},actualRecordIds:actualIds,periods:calculations.map(x=>x.period),method:required(input.method,'روش M&V'),verifier:required(input.verifier,'تهیه‌کننده / بازبین'),measurementBoundary:required(input.measurementBoundary,'مرز اندازه‌گیری'),boundaryConfirmed:Boolean(input.boundaryConfirmed),adjustmentNotes:required(input.adjustmentNotes,'توضیح تعدیلات و عوامل مؤثر'),evidenceReferences:required(input.evidenceReferences,'مراجع شواهد'),calculations,normalizedBaseline,actualConsumption,comparisonUnit,calculatedVariance,calculatedVariancePercent:normalizedBaseline?calculatedVariance/normalizedBaseline*100:0,uncertaintyBudget:{baselineUncertaintyPct,actualUncertaintyPct,modelUncertaintyPct,samplingUncertaintyPct,resolutionUncertaintyPct,systematicBiasPct,rhoBaselineActual,rhoBaselineModel,rhoActualModel,correlationDeterminant,sensitivityBaseline,sensitivityActual,sensitivityModel,samplingSensitivity,resolutionSensitivity,baselineDegreesFreedom:baselineDf,actualDegreesFreedom:actualDf,modelDegreesFreedom:modelDf,samplingDegreesFreedom:samplingDf,observationCount,effectiveObservationCount,rhoLag1,autocorrelationInflation,baselineUncertainty,actualUncertainty,modelUncertainty,samplingUncertainty,resolutionUncertainty,systematicBiasBound,covarianceTerm,combinedVariance,combinedStandardUncertainty,welchSatterthwaiteDenominator,effectiveDegreesFreedom,studentT95,coverageFactor,coverageFactorApplied,expandedRandomUncertainty,expandedUncertainty,lowerBound:uncertaintyLowerBound,upperBound:uncertaintyUpperBound,conclusion:uncertaintyConclusion,interpretation:'ضرایب حساسیت با علامت در کوواریانس و با قدرمطلق در مؤلفه‌های استاندارد اعمال شده‌اند. درجات آزادی مؤلفه‌های دارای df با تقریب Welch–Satterthwaite ترکیب شده‌اند؛ خودهم‌بستگی وقفه اول، اندازه نمونه مؤثر و تورم عدم‌قطعیت نمونه‌گیری را برآورد می‌کند. اگر df محدود باشد، ضریب پوشش تقریبی t با احتمال دوطرفه ۹۵٪ جایگزین k ورودی می‌شود. برای مؤلفه‌های هم‌بسته، df مؤثر تقریبی است و باید با داده‌های سری زمانی و طرح نمونه‌گیری اعتبارسنجی شود.'},evidenceAttachments:evidenceAttachments.map(({name,mimeType,size,lastModified,dataUrl})=>({name,mimeType,size,lastModified,dataUrl})),calibrationCoverage,warnings:[...warnings,...(uncertaintyConclusion==='not-distinguishable'?['اختلاف محاسبه‌شده در بازه عدم‌قطعیت قرار دارد و از صفر قابل تفکیک نیست؛ ادعای صرفه‌جویی مثبت از این محاسبه پشتیبانی نمی‌شود.']:[])],reviewStatus:'prepared-not-independent-review',limitations:['این بسته، مستندات عملیاتی مبتنی بر داده‌های انتخاب‌شده است و به‌تنهایی تأیید مستقل یا انطباق رسمی ISO 50015 محسوب نمی‌شود.','تعدیلات، عوامل متغیر، عدم‌قطعیت اندازه‌گیری و مناسب‌بودن روش باید توسط بازبین صلاحیت‌دار بررسی شوند.','تقریب Welch–Satterthwaite با درجات آزادی مؤلفه‌ها محاسبه می‌شود؛ اثر کوواریانس‌ها در درجات آزادی مؤثر تقریب زده نشده است.','تصحیح خودهم‌بستگی به مدل AR(1) با ضریب مرتبه اول متکی است و برای ساختارهای پیچیده‌تر سری زمانی کافی نیست.']}
}

const EVIDENCE_KDF_ITERATIONS=310000
const bytesToBase64=bytes=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary)}
const base64ToBytes=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0))
async function deriveEvidenceVaultKey(passphrase,salt){
 if(!String(passphrase??'').trim())throw new Error('برای رمزگذاری مستندات، گذرواژه مخزن اسناد الزامی است.')
 if(!globalThis.crypto?.subtle)throw new Error('رمزگذاری امن در این مرورگر در دسترس نیست؛ از مرورگر به‌روز و اتصال HTTPS استفاده کنید.')
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey'])
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:EVIDENCE_KDF_ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])
}
export async function encryptEnergyEvidenceAttachments(attachments,passphrase){
 const files=Array.isArray(attachments)?attachments:[]
 if(!files.length)return []
 const salt=crypto.getRandomValues(new Uint8Array(16)),key=await deriveEvidenceVaultKey(passphrase,salt)
 return Promise.all(files.map(async file=>{
  const match=String(file.dataUrl??'').match(/^data:([^;]+);base64,(.+)$/)
  if(!match)throw new Error('ساختار فایل برای رمزگذاری معتبر نیست.')
  const iv=crypto.getRandomValues(new Uint8Array(12)),plain=base64ToBytes(match[2])
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain)
  return {name:file.name,mimeType:file.mimeType||match[1],size:Number(file.size),lastModified:Number(file.lastModified??0),encrypted:true,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:EVIDENCE_KDF_ITERATIONS,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(cipher))}
 }))
}
export async function decryptEnergyEvidenceAttachment(file,passphrase){
 if(!file?.encrypted||file.algorithm!=='AES-256-GCM'||file.kdf!=='PBKDF2-SHA256')throw new Error('این پیوست در قالب رمزگذاری‌شده پشتیبانی‌شده نیست.')
 const key=await deriveEvidenceVaultKey(passphrase,base64ToBytes(file.salt))
 try{
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(file.iv)},key,base64ToBytes(file.ciphertext))
  return 'data:'+(file.mimeType||'application/octet-stream')+';base64,'+bytesToBase64(new Uint8Array(plain))
 }catch{throw new Error('گذرواژه نادرست است یا محتوای رمزگذاری‌شده آسیب دیده است.')}
}
export async function saveEnergyMvEvidencePack(input,context,store,generatedAt=new Date().toISOString(),options={}){
 const pack=buildEnergyMvEvidencePack(input,context,generatedAt)
 if(pack.evidenceAttachments.length){
  pack.evidenceAttachments=await encryptEnergyEvidenceAttachments(pack.evidenceAttachments,options.passphrase)
  pack.documentSecurity={encryptedAtRest:true,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:EVIDENCE_KDF_ITERATIONS,passphraseStored:false,warning:'گذرواژه در مرورگر ذخیره نمی‌شود؛ گم‌شدن آن به معنی عدم امکان بازیابی فایل‌هاست.'}
 }else pack.documentSecurity={encryptedAtRest:true,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',passphraseStored:false,warning:'این بسته پیوست فایل ندارد.'}
 await store.update(ENERGY_MV_EVIDENCE_KEY,old=>[pack,...(Array.isArray(old)?old:[])].slice(0,300))
 return pack
}


export const ENERGY_VAULT_BACKUP_SCHEMA='pishran-mod05-vault-backup-v1'
export const ENERGY_VAULT_BACKUP_KEYS=[
 ENERGY_DATA_KEY,ENERGY_BASELINES_KEY,ENERGY_ACTIONS_KEY,WATER_BALANCE_KEY,ENERGY_COST_ALLOCATIONS_KEY,
 'module-intelligence:MOD-05:electricity-bills:v1','module-intelligence:MOD-05:gas-bills:v1','module-intelligence:MOD-05:water-bills:v1',
 'module-intelligence:MOD-05:resource-cost-allocations:v1',METER_CALIBRATIONS_KEY,ENERGY_MV_EVIDENCE_KEY,
 ENERGY_TARIFF_CONTRACTS_KEY,ENERGY_TARIFF_CALCULATIONS_KEY,ENERGY_TARIFF_RECONCILIATIONS_KEY
]
const sha256Hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('')
export async function exportEnergyManagementBackup(store,passphrase,createdAt=new Date().toISOString()){
 if(!store?.get)throw new Error('مخزن داده برای تهیه نسخه پشتیبان در دسترس نیست.')
 const payload={}
 for(const key of ENERGY_VAULT_BACKUP_KEYS)payload[key]=(await store.get(key))??null
 const plainBytes=new TextEncoder().encode(JSON.stringify(payload))
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12))
 const manifest={schema:ENERGY_VAULT_BACKUP_SCHEMA,createdAt,keyCount:ENERGY_VAULT_BACKUP_KEYS.length,checksum:await sha256Hex(plainBytes),algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:EVIDENCE_KDF_ITERATIONS}
 const aad=new TextEncoder().encode(JSON.stringify(manifest))
 const key=await deriveEvidenceVaultKey(passphrase,salt)
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,plainBytes)
 return {manifest,salt:bytesToBase64(salt),iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(cipher))}
}
export async function restoreEnergyManagementBackup(backupText,passphrase,store,restoredAt=new Date().toISOString()){
 let backup
 try{backup=typeof backupText==='string'?JSON.parse(backupText):backupText}catch{throw new Error('ساختار فایل پشتیبان JSON معتبر نیست.')}
 const manifest=backup?.manifest
 if(manifest?.schema!==ENERGY_VAULT_BACKUP_SCHEMA||manifest?.algorithm!=='AES-256-GCM'||manifest?.kdf!=='PBKDF2-SHA256'||!backup.salt||!backup.iv||!backup.ciphertext)throw new Error('نسخه یا ساختار فایل پشتیبان پشتیبانی نمی‌شود.')
 const key=await deriveEvidenceVaultKey(passphrase,base64ToBytes(backup.salt))
 let plain
 try{plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(backup.iv),additionalData:new TextEncoder().encode(JSON.stringify(manifest))},key,base64ToBytes(backup.ciphertext))}catch{throw new Error('گذرواژه نادرست است یا فایل پشتیبان دستکاری/آسیب‌دیده است.')}
 if(await sha256Hex(new Uint8Array(plain))!==manifest.checksum)throw new Error('کنترل صحت نسخه پشتیبان ناموفق بود؛ هیچ داده‌ای بازیابی نشد.')
 let payload
 try{payload=JSON.parse(new TextDecoder().decode(plain))}catch{throw new Error('محتوای رمزگشایی‌شده نسخه پشتیبان قابل خواندن نیست.')}
 const allowed=new Set(ENERGY_VAULT_BACKUP_KEYS)
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!allowed.has(k))||manifest.keyCount!==ENERGY_VAULT_BACKUP_KEYS.length)throw new Error('فهرست داده‌های نسخه پشتیبان با طرح مجاز MOD-05 سازگار نیست.')
 const previous={}
 for(const keyName of ENERGY_VAULT_BACKUP_KEYS)previous[keyName]=await store.get(keyName)
 const written=[]
 try{
  for(const keyName of ENERGY_VAULT_BACKUP_KEYS){await store.set(keyName,Object.hasOwn(payload,keyName)?payload[keyName]:null);written.push(keyName)}
 }catch(error){
  for(const keyName of written.reverse()){try{await store.set(keyName,previous[keyName]??null)}catch{}}
  throw new Error('بازیابی کامل نشد؛ تلاش برای بازگردانی داده‌های قبلی انجام شد. '+(error instanceof Error?error.message:'خطای ذخیره‌سازی'))
 }
 return {schema:manifest.schema,backupCreatedAt:manifest.createdAt,restoredAt,keyCount:written.length,checksumVerified:true,encrypted:true}
}
