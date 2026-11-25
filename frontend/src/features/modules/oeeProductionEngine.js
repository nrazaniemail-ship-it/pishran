export const OEE_STORAGE_KEY = 'pishran:mod03:oee:v2'
export const OEE_LOSS_CATEGORIES = [
  { id:'breakdown', fa:'خرابی تجهیز', en:'Equipment failure', group:'availability' },
  { id:'setup', fa:'تنظیم و تعویض محصول', en:'Setup and changeover', group:'availability' },
  { id:'material', fa:'کمبود مواد یا انتظار', en:'Material shortage / waiting', group:'availability' },
  { id:'minorStop', fa:'توقفات کوتاه', en:'Minor stops', group:'performance' },
  { id:'speed', fa:'کاهش سرعت و سیکل کند', en:'Reduced speed / slow cycles', group:'performance' },
  { id:'startup', fa:'ضایعات و افت راه‌اندازی', en:'Startup rejects and losses', group:'quality' },
  { id:'defect', fa:'محصول معیوب و دوباره‌کاری', en:'Defects and rework', group:'quality' },
]
const num = value => value === '' || value === null || value === undefined ? NaN : Number(value)
const positive = (v, label) => { const x=num(v); if(!Number.isFinite(x)||x<0) throw new Error(label+' باید عدد معتبر و غیرمنفی باشد.'); return x }
export function calculateOee(input) {
  // Preferred Vorne method: planned time excludes off-schedule breaks; all stops during
  // scheduled production (planned + unplanned) reduce Availability. Minor stops and
  // slow cycles remain in Run Time and reduce Performance. Quality is first-pass yield.
  const shiftRaw=input.shiftMinutes
  const legacy=shiftRaw===undefined||shiftRaw===null||shiftRaw===''
  const shift=legacy?NaN:positive(shiftRaw,'طول شیفت')
  const breaks=legacy?0:positive(input.breakMinutes??0,'زمان استراحت و خارج از برنامه')
  const planned=legacy?positive(input.plannedMinutes,'زمان تولید برنامه‌ریزی‌شده'):shift-breaks
  const hasSplitStops=input.plannedStopMinutes!==undefined||input.unplannedStopMinutes!==undefined
  const plannedStops=hasSplitStops?positive(input.plannedStopMinutes??0,'توقفات برنامه‌ریزی‌شده'):0
  const unplannedStops=hasSplitStops?positive(input.unplannedStopMinutes??0,'توقفات برنامه‌ریزی‌نشده'):positive(input.downtimeMinutes,'توقفات')
  const downtime=plannedStops+unplannedStops
  const cycle=positive(input.idealCycleSeconds,'زمان سیکل ایده‌آل')
  const total=positive(input.totalCount,'تولید کل')
  const firstPassRaw=input.firstPassGoodCount
  const rejectRaw=input.rejectCount
  const good=firstPassRaw!==undefined&&firstPassRaw!==null&&firstPassRaw!==''?positive(firstPassRaw,'تولید سالم در بار اول'):rejectRaw!==undefined&&rejectRaw!==null&&rejectRaw!==''?total-positive(rejectRaw,'تعداد مردود و دوباره‌کاری'):positive(input.goodCount,'تولید سالم')
  const rejects=total-good
  if(!legacy&&shift<=0) throw new Error('طول شیفت باید بزرگ‌تر از صفر باشد.')
  if(!legacy&&breaks>shift) throw new Error('زمان استراحت و خارج از برنامه نمی‌تواند از طول شیفت بیشتر باشد.')
  if(planned<=0||cycle<=0||total<=0) throw new Error('زمان تولید برنامه‌ریزی‌شده، سیکل ایده‌آل و تولید کل باید بزرگ‌تر از صفر باشند.')
  if(downtime>planned) throw new Error('مجموع توقفات برنامه‌ریزی‌شده و برنامه‌ریزی‌نشده نمی‌تواند از زمان تولید برنامه‌ریزی‌شده بیشتر باشد.')
  if(good>total) throw new Error('تعداد محصول سالم در بار اول نمی‌تواند از تولید کل بیشتر باشد.')
  if(good<0) throw new Error('تعداد محصول سالم در بار اول نمی‌تواند منفی باشد.')
  const run=planned-downtime
  if(run<=0) throw new Error('زمان کارکرد باید بزرگ‌تر از صفر باشد.')
  const availability=run/planned*100
  const performance=total*cycle/(run*60)*100
  const quality=good/total*100
  const oee=availability/100*performance/100*quality/100*100
  const direct=good*cycle/(planned*60)*100
  const variance=Math.abs(oee-direct)
  return { shiftMinutes:legacy?null:shift,breakMinutes:breaks,plannedMinutes:planned,plannedStopMinutes:plannedStops,unplannedStopMinutes:unplannedStops,downtimeMinutes:downtime,runMinutes:run,availability,performance,quality,oee,directOee:direct,variance,idealProduction:run*60/cycle,goodProductionRate:good/(planned*60),totalCount:total,goodCount:good,firstPassGoodCount:good,rejectCount:rejects,warnings:[...(performance>100?['عملکرد بیش از ۱۰۰٪ است؛ زمان سیکل ایده‌آل، واحد زمان و شمارش تولید بررسی شود.']:[]),...(variance>0.000001?['اختلاف روش تفصیلی و کنترل مستقیم از حد تلورانس بیشتر است؛ سازگاری ورودی‌ها بررسی شود.']:[])] }
}
export function aggregateLineOee(input) { return calculateOee(input) }
export function calculateStationOees(stations) { return stations.map(station=>({...station,result:calculateOee(station)})) }
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
