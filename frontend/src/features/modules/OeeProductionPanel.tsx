import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Plus, Save, Trash2, Factory, Gauge, Clock3, CheckCircle2 } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { OEE_LOSS_CATEGORIES, OEE_STORAGE_KEY, aggregateLineOee, calculateOee, calculateStationOees, saveOeeAnalysis, summarizeLosses } from './oeeProductionEngine'
import './OeeProductionPanel.css'

type Language='fa'|'en'
type OeeInput={plannedMinutes:string;downtimeMinutes:string;idealCycleSeconds:string;totalCount:string;goodCount:string}
type Station={id:string;name:string;code:string;plannedMinutes:string;downtimeMinutes:string;idealCycleSeconds:string;totalCount:string;goodCount:string}
type LossEvent={id:string;category:string;minutes:string;note:string}
const emptyInput:OeeInput={plannedMinutes:'',downtimeMinutes:'',idealCycleSeconds:'',totalCount:'',goodCount:''}
const initialStations:Station[]=[
 {id:'st-1',name:'ایستگاه ورودی / برش',code:'CUT',...emptyInput},
 {id:'st-2',name:'کوره',code:'FUR',...emptyInput},
 {id:'st-3',name:'نورد خشن',code:'RM',...emptyInput},
 {id:'st-4',name:'نورد نهایی',code:'FM',...emptyInput},
 {id:'st-5',name:'خنک‌کاری و بسته‌بندی',code:'FIN',...emptyInput},
]
const fmt=(v:number,d=2)=>Number.isFinite(v)?v.toLocaleString('fa-IR',{maximumFractionDigits:d}):'—'
const toInput=(x:Station):OeeInput=>({plannedMinutes:x.plannedMinutes,downtimeMinutes:x.downtimeMinutes,idealCycleSeconds:x.idealCycleSeconds,totalCount:x.totalCount,goodCount:x.goodCount})
const metrics=(result:ReturnType<typeof calculateOee>,en:boolean)=>[
 [en?'Availability':'دسترس‌پذیری',result.availability],
 [en?'Performance':'عملکرد',result.performance],
 [en?'Quality':'کیفیت',result.quality],
 [en?'OEE · detailed':'OEE · روش تفصیلی',result.oee],
 [en?'OEE · direct':'OEE · روش مستقیم',result.directOee],
]
export default function OeeProductionPanel({language='fa'}:{language?:Language}) {
 const en=language==='en'
 const [level,setLevel]=useState<'line'|'stations'>('line')
 const [period,setPeriod]=useState('')
 const [shift,setShift]=useState('صبح')
 const [product,setProduct]=useState('')
 const [lineName,setLineName]=useState('خط تولید اصلی')
 const [line,setLine]=useState<OeeInput>(emptyInput)
 const [stations,setStations]=useState<Station[]>(initialStations)
 const [events,setEvents]=useState<LossEvent[]>([])
 const [history,setHistory]=useState<any[]>([])
 const [report,setReport]=useState<any>(null)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [activeTab,setActiveTab]=useState<'overview'|'losses'|'history'>('overview')
 useEffect(()=>{let alive=true;Promise.all([localStore.get<any[]>(OEE_STORAGE_KEY),localStore.get<any[]>('module-intelligence:MOD-03:v1')]).then(async([rows,legacy])=>{if(!alive)return;let current=Array.isArray(rows)?rows:[];if(current.length===0&&Array.isArray(legacy)&&legacy.length){current=legacy.map((item:any)=>({id:item.id,createdAt:item.createdAt,moduleId:'MOD-03',level:'line',lineName:'خط تولید اصلی',period:'',shift:'',product:'',lineInputs:item.inputs||emptyInput,lineMetrics:item.metrics||{},stations:[],lossEvents:[],lossSummary:[],calculationMethods:['legacy-three-factor']}));await localStore.set(OEE_STORAGE_KEY,current)}if(alive)setHistory(current)});return()=>{alive=false}},[])
 const lineResult=useMemo(()=>{try{return aggregateLineOee(line)}catch{return null}},[line])
 const stationResults=useMemo(()=>{const valid=stations.filter(s=>Object.values(toInput(s)).every(v=>v.trim()!==''));return valid.map(s=>{try{return {...s,result:calculateOee(toInput(s))}}catch{return {...s,result:null}}})},[stations])
 const lossSummary=useMemo(()=>summarizeLosses(events.map(e=>({...e,minutes:Number(e.minutes)||0}))),[events])
 const updateStation=(id:string,key:keyof Station,value:string)=>setStations(rows=>rows.map(s=>s.id===id?{...s,[key]:value}:s))
 const addStation=()=>setStations(rows=>[...rows,{id:'station-'+Date.now(),name:en?'New workstation':'ایستگاه جدید',code:'NEW',...emptyInput}])
 const addLoss=()=>setEvents(rows=>[...rows,{id:'loss-'+Date.now(),category:'breakdown',minutes:'',note:''}])
 const run=async()=>{
  setError('');setBusy(true)
  try{
   const lineMetrics=aggregateLineOee(line)
   const detail=calculateStationOees(stations.filter(s=>Object.values(toInput(s)).every(v=>v.trim()!=='')))
   if(level==='stations'&&!detail.length)throw new Error('برای محاسبه جزئی، حداقل اطلاعات یک ایستگاه را کامل کنید.')
   const record=await saveOeeAnalysis(localStore,{moduleId:'MOD-03',level,period,shift,product,lineName,lineInputs:{...line},lineMetrics,stations:detail.map(s=>({id:s.id,name:s.name,code:s.code,inputs:toInput(s),metrics:s.result})),lossEvents:events.map(e=>({...e,minutes:Number(e.minutes)||0})),lossSummary,calculationMethods:['three-factor','direct']})
   const rows=await localStore.get<any[]>(OEE_STORAGE_KEY);setHistory(Array.isArray(rows)?rows:[]);setReport(record);setActiveTab('overview')
  }catch(e){setError(e instanceof Error?e.message:'محاسبه یا ذخیره‌سازی انجام نشد.')}finally{setBusy(false)}
 }
 const load=(item:any)=>{setReport(item);setLevel(item.level||'line');setPeriod(item.period||'');setShift(item.shift||'صبح');setProduct(item.product||'');setLineName(item.lineName||'خط تولید اصلی');setLine(item.lineInputs||emptyInput);if(item.stations?.length)setStations(item.stations.map((s:any)=>({...s,...s.inputs})));setEvents(item.lossEvents||[]);setActiveTab('overview')}
 const fieldLabels:Record<keyof OeeInput,string>=en?{plannedMinutes:'Planned production time (min)',downtimeMinutes:'Downtime (min)',idealCycleSeconds:'Ideal cycle (sec/unit)',totalCount:'Total output',goodCount:'Good output'}:{plannedMinutes:'زمان تولید برنامه‌ریزی‌شده (دقیقه)',downtimeMinutes:'توقفات داخل زمان برنامه (دقیقه)',idealCycleSeconds:'زمان سیکل ایده‌آل (ثانیه/واحد)',totalCount:'تعداد کل تولید',goodCount:'تعداد محصول سالم'}
 const inputFields=(values:OeeInput,onChange:(key:keyof OeeInput,value:string)=>void)=><div className="oee-input-grid">{(Object.keys(fieldLabels) as (keyof OeeInput)[]).map(key=><label key={key}>{fieldLabels[key]}<input type="number" min="0" step="any" value={values[key]} onChange={e=>onChange(key,e.target.value)}/></label>)}</div>
 const resultCard=(result:ReturnType<typeof calculateOee>|null,title:string)=> <section className="oee-result-card"><div className="oee-result-head"><b>{title}</b>{result&&<strong>{fmt(result.oee)}٪</strong>}</div>{result?<><div className="oee-metric-grid">{metrics(result,en).map(([label,value])=><article key={String(label)}><small>{label}</small><b>{fmt(Number(value))}٪</b></article>)}</div><div className="oee-method-note"><span>{en?'Method variance':'اختلاف دو روش'}: <b>{fmt(result.variance,6)}</b> {en?'percentage points':'واحد درصد'}</span><span>{en?'Run time':'زمان کارکرد'}: <b>{fmt(result.runMinutes)}</b> {en?'min':'دقیقه'}</span></div>{result.warnings.map((w,i)=><p className="oee-warning" key={i}><AlertTriangle size={15}/>{w}</p>)}</>:<p className="oee-muted">{en?'Complete all five fields to calculate.':'برای محاسبه، هر پنج ورودی را تکمیل کنید.'}</p>}</section>
 return <section className="oee-production">
  <header className="oee-intro"><div className="oee-icon"><Factory size={25}/></div><div><h2>{en?'Production Intelligence & Productivity':'هوشمندی تولید و بهره‌وری'}</h2><p>{en?'Line and workstation OEE, loss analysis, and continuous improvement.':'محاسبه OEE کل خط و ماشین‌آلات، تحلیل اتلاف و پشتیبانی از بهبود مستمر.'}</p></div></header>
  <div className="oee-context-grid">
   <label>{en?'Production line':'خط تولید'}<input value={lineName} onChange={e=>setLineName(e.target.value)}/></label>
   <label>{en?'Product / grade':'محصول / گرید'}<input value={product} onChange={e=>setProduct(e.target.value)} placeholder={en?'e.g. hot rolled coil':'مثلاً کلاف گرم'}/></label>
   <label>{en?'Period':'دوره'}<input value={period} onChange={e=>setPeriod(e.target.value)} placeholder={en?'Date or month':'تاریخ یا ماه'}/></label>
   <label>{en?'Shift':'شیفت'}<select value={shift} onChange={e=>setShift(e.target.value)}>{(en?['Morning','Evening','Night']:['صبح','عصر','شب']).map(x=><option key={x}>{x}</option>)}</select></label>
  </div>
  <nav className="oee-tabs" role="tablist"><button className={activeTab==='overview'?'active':''} onClick={()=>setActiveTab('overview')}>{en?'OEE analysis':'تحلیل OEE'}</button><button className={activeTab==='losses'?'active':''} onClick={()=>setActiveTab('losses')}>{en?'Losses':'اتلاف‌ها'}</button><button className={activeTab==='history'?'active':''} onClick={()=>setActiveTab('history')}>{en?'History':'سوابق'}</button></nav>
  {activeTab==='overview'&&<>
   <div className="oee-level-switch"><button className={level==='line'?'active':''} onClick={()=>setLevel('line')}>{en?'Whole production line':'کل خط تولید'}</button><button className={level==='stations'?'active':''} onClick={()=>setLevel('stations')}>{en?'Workstations & machines':'ایستگاه‌ها و ماشین‌آلات'}</button></div>
   <section className="oee-panel"><div className="oee-panel-heading"><div><h3>{en?'Line-level calculation':'محاسبه در سطح کل خط'}</h3><p>{en?'Use actual line throughput and the line/bottleneck ideal cycle.':'از تولید واقعی خط و سیکل ایده‌آل خط یا گلوگاه استفاده کنید؛ میانگین OEE ماشین‌ها مبنای OEE خط نیست.'}</p></div><Gauge size={22}/></div>{inputFields(line,(key,value)=>setLine(x=>({...x,[key]:value})))}</section>
   {level==='stations'&&<section className="oee-panel"><div className="oee-panel-heading"><div><h3>{en?'Station and machine detail':'جزئیات ایستگاه‌ها و ماشین‌آلات'}</h3><p>{en?'Each station is calculated independently; only complete records are included.':'هر ایستگاه مستقل محاسبه می‌شود؛ فقط رکوردهای کامل در گزارش وارد می‌شوند.'}</p></div><button type="button" onClick={addStation}><Plus size={16}/>{en?'Add station':'افزودن ایستگاه'}</button></div>{stations.map((s,index)=><article className="oee-station" key={s.id}><div className="oee-station-heading"><label>{en?'Station name':'نام ایستگاه'}<input value={s.name} onChange={e=>updateStation(s.id,'name',e.target.value)}/></label><label>{en?'Code':'کد'}<input value={s.code} onChange={e=>updateStation(s.id,'code',e.target.value)}/></label><button className="oee-delete" type="button" onClick={()=>setStations(rows=>rows.filter(x=>x.id!==s.id))} aria-label={en?'Remove station':'حذف ایستگاه'}><Trash2 size={17}/></button></div>{inputFields(toInput(s),(key,value)=>updateStation(s.id,key,value))}{stationResults.find(x=>x.id===s.id)?.result&&<div className="oee-station-score"><b>{fmt(stationResults.find(x=>x.id===s.id)!.result!.oee)}٪</b><span>{en?'Station OEE':'OEE ایستگاه'}</span></div>}</article>)}</section>}
   {resultCard(lineResult,en?'Line OEE — both methods':'OEE کل خط — هر دو روش')}
   {level==='stations'&&stationResults.map(s=><div key={s.id}>{resultCard(s.result,s.name)}</div>)}
   <div className="oee-action-row"><button className="primary" disabled={busy} onClick={()=>void run()}><Save size={17}/>{busy?(en?'Saving…':'در حال ذخیره…'):(en?'Calculate & save report':'محاسبه و ذخیره گزارش')}</button><small>{en?'Stored locally on this device.':'گزارش به‌صورت محلی روی همین دستگاه ذخیره می‌شود.'}</small></div>
  </>}
  {activeTab==='losses'&&<section className="oee-panel"><div className="oee-panel-heading"><div><h3>{en?'Production loss events':'ثبت رخدادهای اتلاف تولید'}</h3><p>{en?'Classify downtime, speed loss and quality loss for Pareto analysis.':'توقف، افت سرعت و افت کیفیت را برای تحلیل پارتو دسته‌بندی کنید.'}</p></div><button onClick={addLoss}><Plus size={16}/>{en?'Add loss':'ثبت اتلاف'}</button></div>{events.map((event,index)=><article className="oee-loss-row" key={event.id}><select value={event.category} onChange={e=>setEvents(rows=>rows.map(x=>x.id===event.id?{...x,category:e.target.value}:x))}>{OEE_LOSS_CATEGORIES.map(x=><option key={x.id} value={x.id}>{en?x.en:x.fa}</option>)}</select><input type="number" min="0" step="any" placeholder={en?'Minutes / quantity':'دقیقه / تعداد'} value={event.minutes} onChange={e=>setEvents(rows=>rows.map(x=>x.id===event.id?{...x,minutes:e.target.value}:x))}/><input placeholder={en?'Cause / note':'علت / توضیح'} value={event.note} onChange={e=>setEvents(rows=>rows.map(x=>x.id===event.id?{...x,note:e.target.value}:x))}/><button className="oee-delete" onClick={()=>setEvents(rows=>rows.filter(x=>x.id!==event.id))}><Trash2 size={16}/></button></article>)}<div className="oee-loss-summary"><h4>{en?'Loss Pareto summary':'خلاصه پارتوی اتلاف‌ها'}</h4>{lossSummary.map(item=><div className="oee-loss-bar" key={item.id}><span>{en?item.en:item.fa}</span><b>{fmt(item.minutes)} {en?'min':'دقیقه'}</b><div><i style={{width:(Math.max(...lossSummary.map(x=>x.minutes),1)?item.minutes/Math.max(...lossSummary.map(x=>x.minutes),1)*100:0)+'%'}}/></div></div>)}</div><button className="primary" onClick={()=>void run()} disabled={busy}><Save size={16}/>{en?'Save loss log with OEE report':'ذخیره رخدادها همراه گزارش OEE'}</button></section>}
  {activeTab==='history'&&<section className="oee-panel"><h3>{en?'Saved OEE reports':'گزارش‌های ذخیره‌شده OEE'}</h3>{history.length?history.map(item=><button className="oee-history-item" key={item.id} onClick={()=>load(item)}><span><b>{item.lineName}</b><small>{item.period||'—'} · {item.shift||'—'} · {new Date(item.createdAt).toLocaleString(en?'en-US':'fa-IR')}</small></span><strong>{fmt(item.lineMetrics?.oee)}٪</strong></button>):<p className="oee-muted">{en?'No reports saved yet.':'هنوز گزارشی ذخیره نشده است.'}</p>}</section>}
  {error&&<p className="oee-error" role="alert">{error}</p>}
  {report&&<section className="oee-saved-report"><CheckCircle2 size={18}/><div><b>{en?'Report saved':'گزارش ذخیره شد'}</b><small>{report.lineName} · {fmt(report.lineMetrics?.oee)}٪ · {report.period||'—'}</small></div></section>}
 </section>
}
