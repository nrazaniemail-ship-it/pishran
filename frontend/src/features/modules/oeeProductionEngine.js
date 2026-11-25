export const OEE_STORAGE_KEY = 'pishran:mod03:oee:v2'
export const OEE_LOSS_CATEGORIES = [
  { id:'breakdown', fa:'خرابی تجهیز', en:'Equipment failure', group:'availability' },
  { id:'setup', fa:'تنظیم و تعویض محصول', en:'Setup and changeover', group:'availability' },
  { id:'material', fa:'کمبود مواد یا انتظار', en:'Material shortage / waiting', group:'availability' },
  { id:'minorStop', fa:'توقفات کوتاه', en:'Minor stops', group:'performance' },
  { id:'speed', fa:'کاهش سرعت', en:'Reduced speed', group:'performance' },
  { id:'startup', fa:'افت راه‌اندازی', en:'Startup loss', group:'quality' },
  { id:'defect', fa:'محصول معیوب و ضایعات', en:'Defects and scrap', group:'quality' },
]
const num = value => value === '' || value === null || value === undefined ? NaN : Number(value)
const positive = (v, label) => { const x=num(v); if(!Number.isFinite(x)||x<0) throw new Error(label+' باید عدد معتبر و غیرمنفی باشد.'); return x }
export function calculateOee(input) {
  const planned=positive(input.plannedMinutes,'زمان برنامه‌ریزی‌شده')
  const downtime=positive(input.downtimeMinutes,'توقفات')
  const cycle=positive(input.idealCycleSeconds,'زمان سیکل ایده‌آل')
  const total=positive(input.totalCount,'تولید کل')
  const good=positive(input.goodCount,'تولید سالم')
  if(planned<=0||cycle<=0||total<=0) throw new Error('زمان برنامه‌ریزی‌شده، سیکل ایده‌آل و تولید کل باید بزرگ‌تر از صفر باشند.')
  if(downtime>planned) throw new Error('توقفات نمی‌تواند از زمان برنامه‌ریزی‌شده بیشتر باشد.')
  if(good>total) throw new Error('تولید سالم نمی‌تواند از تولید کل بیشتر باشد.')
  const run=planned-downtime
  if(run<=0) throw new Error('زمان کارکرد باید بزرگ‌تر از صفر باشد.')
  const availability=run/planned*100
  const performance=total*cycle/(run*60)*100
  const quality=good/total*100
  const detailed=availability/100*performance/100*quality/100*100
  const direct=good*cycle/(planned*60)*100
  const variance=Math.abs(detailed-direct)
  return { plannedMinutes:planned,downtimeMinutes:downtime,runMinutes:run,availability,performance,quality,oee:detailed,directOee:direct,variance,idealProduction:run*60/cycle,goodProductionRate:good/(planned*60),totalCount:total,goodCount:good,rejectCount:total-good, warnings:[...(performance>100?['عملکرد بیش از ۱۰۰٪ است؛ زمان سیکل ایده‌آل و شمارش تولید بررسی شود.']:[]),...(variance>0.000001?['اختلاف دو روش از حد تلورانس بیشتر است؛ سازگاری ورودی‌ها بررسی شود.']:[])] }
}
export function aggregateLineOee(input) {
  // The line OEE must be calculated from line-level throughput and bottleneck cycle,
  // not from an arithmetic mean of station OEE values.
  return calculateOee(input)
}
export function calculateStationOees(stations) {
  return stations.map(station=>({...station,result:calculateOee(station)}))
}
export function summarizeLosses(events) {
  const totals={}
  for(const category of OEE_LOSS_CATEGORIES) totals[category.id]=0
  for(const event of events||[]) { const minutes=Number(event.minutes)||0; if(Object.hasOwn(totals,event.category)) totals[event.category]+=minutes }
  return OEE_LOSS_CATEGORIES.map(item=>({...item,minutes:totals[item.id]})).sort((a,b)=>b.minutes-a.minutes)
}
export async function saveOeeAnalysis(store, record) {
  const previous=await store.get(OEE_STORAGE_KEY)
  const rows=Array.isArray(previous)?previous:[]
  const saved={...record,id:record.id||'OEE-'+Date.now(),createdAt:record.createdAt||new Date().toISOString()}
  await store.set(OEE_STORAGE_KEY,[saved,...rows].slice(0,100))
  return saved
}
