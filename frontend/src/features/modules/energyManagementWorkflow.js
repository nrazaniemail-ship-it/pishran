export const ENERGY_DATA_KEY = 'module-intelligence:MOD-05:records:v1'
export const ENERGY_BASELINES_KEY = 'module-intelligence:MOD-05:baselines:v1'
export const ENERGY_ACTIONS_KEY = 'module-intelligence:MOD-05:actions:v1'
export const RESOURCE_CONFIG = {
 electricity:{unit:'kWh',factorUnit:'kWh/t'}, gas:{unit:'Nm³',factorUnit:'Nm³/t'}, water:{unit:'m³',factorUnit:'m³/t'}
}
const number=(v,label,min=0)=>{const n=Number(v);if(v===''||v===null||v===undefined||!Number.isFinite(n)||n<min)throw new Error('مقدار '+label+' معتبر نیست.');return n}
const required=(v,label)=>{const s=String(v??'').trim();if(!s)throw new Error('فیلد '+label+' الزامی است.');return s}
export function validateEnergyRecord(i){
 if(!Object.hasOwn(RESOURCE_CONFIG,i.resource))throw new Error('نوع منبع معتبر نیست.')
 const consumption=number(i.consumption,'مصرف',0),production=number(i.production,'تولید/فعالیت',0),cost=number(i.cost,'هزینه',0)
 if(consumption===0||production===0)throw new Error('مصرف و تولید/فعالیت باید بزرگ‌تر از صفر باشند.')
 const start=i.startReading===''||i.startReading===null||i.startReading===undefined?null:number(i.startReading,'قرائت ابتدا',0),end=i.endReading===''||i.endReading===null||i.endReading===undefined?null:number(i.endReading,'قرائت انتها',0)
 if((start===null)!==(end===null))throw new Error('هر دو قرائت کنتور باید ثبت شوند یا هر دو خالی باشند.')
 if(start!==null&&end<start)throw new Error('قرائت انتهای کنتور کمتر از قرائت ابتداست.')
 if(start!==null&&Math.abs(end-start-consumption)>Math.max(.01,consumption*.005))throw new Error('مصرف با اختلاف قرائت کنتور تطبیق ندارد.')
 return {resource:i.resource,period:required(i.period,'دوره'),site:required(i.site,'سایت/واحد'),seu:required(i.seu,'مصرف‌کننده عمده'),meterId:String(i.meterId??''),consumption,production,cost,unit:RESOURCE_CONFIG[i.resource].unit,intensity:consumption/production,costPerOutput:cost/production,startReading:start,endReading:end,calorificValue:i.resource==='gas'&&i.calorificValue!==''?number(i.calorificValue,'ارزش حرارتی گاز',0):null,note:String(i.note??''),dataQuality:i.dataQuality==='measured'?'measured':'estimated'}
}
export function calculateEnergyPerformance({resource,baseline,actual}){
 if(!Object.hasOwn(RESOURCE_CONFIG,resource))throw new Error('نوع منبع معتبر نیست.')
 const bc=number(baseline.consumption,'مصرف خط مبنا',0),bp=number(baseline.production,'تولید خط مبنا',0),ac=number(actual.consumption,'مصرف واقعی',0),ap=number(actual.production,'تولید واقعی',0)
 if(!bc||!bp||!ap)throw new Error('مصرف و تولید مرجع و تولید واقعی باید بزرگ‌تر از صفر باشند.')
 const bi=bc/bp,ai=ac/ap,normalized=bi*ap,savings=normalized-ac
 return {resource,baselineIntensity:bi,actualIntensity:ai,normalizedBaseline:normalized,actualConsumption:ac,actualProduction:ap,savings,savingsPercent:normalized?savings/normalized*100:0,improvementPercent:(bi-ai)/bi*100,status:Math.abs(savings)<1e-9?'on-baseline':savings>0?'improved':'worsened'}
}
export async function saveEnergyRecord(i,store,createdAt=new Date().toISOString()){const row={id:'MOD-05-'+Date.parse(createdAt),createdAt,...validateEnergyRecord(i)};await store.update(ENERGY_DATA_KEY,old=>[row,...(Array.isArray(old)?old:[])].slice(0,500));return row}
export async function saveEnergyBaseline(i,store,createdAt=new Date().toISOString()){
 if(!Object.hasOwn(RESOURCE_CONFIG,i.resource))throw new Error('نوع منبع معتبر نیست.')
 const consumption=number(i.consumption,'مصرف خط مبنا',0),production=number(i.production,'تولید خط مبنا',0);if(!consumption||!production)throw new Error('مصرف و تولید خط مبنا باید بزرگ‌تر از صفر باشند.')
 const b={id:'MOD-05-BASE-'+i.resource+'-'+Date.parse(createdAt),resource:i.resource,period:required(i.period,'دوره خط مبنا'),site:required(i.site,'سایت'),seu:required(i.seu,'مصرف‌کننده عمده'),consumption,production,intensity:consumption/production,method:'production-intensity',createdAt}
 await store.update(ENERGY_BASELINES_KEY,old=>[b,...(Array.isArray(old)?old.filter(x=>!(x.resource===b.resource&&x.site===b.site&&x.seu===b.seu)):[])].slice(0,100));return b
}
export async function saveEnergyAction(i,store,createdAt=new Date().toISOString()){const a={id:'MOD-05-ACT-'+Date.parse(createdAt),title:required(i.title,'عنوان اقدام'),resource:i.resource,owner:required(i.owner,'مسئول'),dueDate:required(i.dueDate,'موعد اجرا'),expectedSavings:number(i.expectedSavings,'صرفه‌جویی مورد انتظار',0),status:['planned','in-progress','verified','cancelled'].includes(i.status)?i.status:'planned',createdAt};await store.update(ENERGY_ACTIONS_KEY,old=>[a,...(Array.isArray(old)?old:[])].slice(0,200));return a}
