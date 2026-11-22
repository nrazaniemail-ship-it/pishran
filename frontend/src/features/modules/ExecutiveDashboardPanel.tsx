import { useCallback, useEffect, useState } from 'react'
import { localStore } from '../../core/storage/localStore'
import { loadExecutiveDashboardReports } from './executiveDashboardData'

type CostReport = { id:string; moduleId:'MOD-02'; createdAt:string; inputs:Record<string,string>; metrics:Record<string,number> }
type ProductionReport = { id:string; moduleId:'MOD-03'; createdAt:string; inputs:Record<string,string>; metrics:Record<string,number> }
type Props = { language?:'fa'|'en'; onOpenModule:(moduleId:string)=>void }
const costKey='module-intelligence:MOD-02:v1'
const productionKey='module-intelligence:MOD-03:v1'
const format=(value:number,language:'fa'|'en'='fa',digits=2)=>Number.isFinite(value)?value.toLocaleString(language==='fa'?'fa-IR':'en-US',{maximumFractionDigits:digits}):'—'
const dateLabel=(value:string|undefined,language:'fa'|'en')=>value?new Date(value).toLocaleString(language==='fa'?'fa-IR':'en-US'):'—'

export default function ExecutiveDashboardPanel({language='fa',onOpenModule}:Props){
 const en=language==='en'
 const [cost,setCost]=useState<CostReport[]>([])
 const [production,setProduction]=useState<ProductionReport[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const refresh=useCallback(async()=>{
  setLoading(true);setError('')
  try{
   const reports=await loadExecutiveDashboardReports(localStore)
   setCost(reports.cost)
   setProduction(reports.production)
  }catch{setError(en?'Could not read the local module reports.':'خواندن گزارش‌های محلی ماژول‌ها ناموفق بود.')}
  finally{setLoading(false)}
 },[en])
 useEffect(()=>{void refresh()},[refresh])
 const latestCost=cost[0]
 const latestProduction=production[0]
 const sourceState=(count:number)=>count? (en?'Available':'داده موجود'):(en?'No report':'بدون گزارش')
 return <section className="executive-intelligence">
  <div className="executive-intelligence-heading">
   <div><span className="executive-eyebrow">MOD-01</span><h2>{en?'Executive operating snapshot':'نمای یکپارچه مدیریتی مدیرعامل'}</h2><p>{en?'Live local readout from the latest saved MOD-02 and MOD-03 reports.':'نمایش مستقیم آخرین گزارش‌های ذخیره‌شده در MOD-02 و MOD-03؛ بدون ساخت داده یا تخمین مقادیر.'}</p></div>
   <button type="button" className="secondary" onClick={()=>void refresh()} disabled={loading}>{loading?(en?'Refreshing…':'در حال به‌روزرسانی…'):(en?'Refresh data':'به‌روزرسانی داده‌ها')}</button>
  </div>
  {error&&<p className="module-intelligence-error" role="alert">{error}</p>}
  <div className="executive-source-grid">
   <article className="executive-source-card"><div className="executive-source-top"><b>{en?'Cost & profitability':'بهای تمام‌شده و سودآوری'}</b><span>{sourceState(cost.length)}</span></div><strong>{latestCost?format(latestCost.metrics.unitCost,language):'—'}</strong><small>{en?'Latest cost per ton':'آخرین بهای تمام‌شده هر تن'}</small><div className="executive-source-metrics"><span>{en?'Gross margin / ton':'حاشیه سود هر تن'} <b>{latestCost?format(latestCost.metrics.grossMarginPerTon,language):'—'}</b></span><span>{en?'Gross margin':'درصد حاشیه سود'} <b>{latestCost?format(latestCost.metrics.grossMarginPercent,language)+'%':'—'}</b></span></div><footer>{en?'Latest report: ':'آخرین گزارش: '}{dateLabel(latestCost?.createdAt,language)} · {cost.length.toLocaleString(en?'en-US':'fa-IR')} {en?'reports':'گزارش'}</footer><button type="button" onClick={()=>onOpenModule('MOD-02')}>{en?'Open MOD-02':'ورود به MOD-02'}</button></article>
   <article className="executive-source-card"><div className="executive-source-top"><b>{en?'Production effectiveness':'اثربخشی تولید'}</b><span>{sourceState(production.length)}</span></div><strong>{latestProduction?format(latestProduction.metrics.oee,language)+'%':'—'}</strong><small>{en?'Latest overall equipment effectiveness (OEE)':'آخرین اثربخشی کلی تجهیزات (OEE)'}</small><div className="executive-source-metrics"><span>{en?'Availability':'دسترس‌پذیری'} <b>{latestProduction?format(latestProduction.metrics.availability,language)+'%':'—'}</b></span><span>{en?'Quality':'کیفیت'} <b>{latestProduction?format(latestProduction.metrics.quality,language)+'%':'—'}</b></span></div><footer>{en?'Latest report: ':'آخرین گزارش: '}{dateLabel(latestProduction?.createdAt,language)} · {production.length.toLocaleString(en?'en-US':'fa-IR')} {en?'reports':'گزارش'}</footer><button type="button" onClick={()=>onOpenModule('MOD-03')}>{en?'Open MOD-03':'ورود به MOD-03'}</button></article>
  </div>
  <div className="executive-data-integrity"><b>{en?'Data provenance':'منشأ و اعتبار داده'}</b><p>{en?'Values above are copied from the latest saved analysis records on this device. Missing source records remain blank; figures are not forecasts, consolidated financial statements or audited KPIs.':'مقادیر بالا از آخرین رکوردهای تحلیل ذخیره‌شده روی همین دستگاه خوانده شده‌اند. در نبود گزارش، مقدار خالی می‌ماند؛ این ارقام پیش‌بینی، صورت مالی تلفیقی یا KPI حسابرسی‌شده نیستند.'}</p><small>{en?'MOD-02 records: ':'تعداد رکورد MOD-02: '}{cost.length.toLocaleString(en?'en-US':'fa-IR')} · {en?'MOD-03 records: ':'تعداد رکورد MOD-03: '}{production.length.toLocaleString(en?'en-US':'fa-IR')}</small></div>
 </section>
}
