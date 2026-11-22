import { useEffect, useMemo, useState } from 'react'
import { localStore } from '../../core/storage/localStore'
import { executeModuleAnalysis } from './moduleAnalysisWorkflow'

type Language = 'fa' | 'en'
type CostInput = { outputTon: string; material: string; labor: string; energy: string; maintenance: string; overhead: string; sellingPrice: string }
type ProductionInput = { plannedMinutes: string; downtimeMinutes: string; idealCycleSeconds: string; totalCount: string; goodCount: string }
type SavedRun = { id: string; moduleId: 'MOD-02'|'MOD-03'; createdAt: string; inputs: CostInput|ProductionInput; metrics: Record<string, number> }
const COST_KEY = 'module-intelligence:MOD-02:v1'
const OEE_KEY = 'module-intelligence:MOD-03:v1'
const initialCost: CostInput = { outputTon:'', material:'', labor:'', energy:'', maintenance:'', overhead:'', sellingPrice:'' }
const initialProduction: ProductionInput = { plannedMinutes:'', downtimeMinutes:'', idealCycleSeconds:'', totalCount:'', goodCount:'' }
const n = (value:string) => value.trim()==='' ? Number.NaN : Number(value)
const fmt = (value:number, digits=2) => Number.isFinite(value) ? value.toLocaleString('fa-IR',{maximumFractionDigits:digits}) : '—'

export default function ModuleIntelligencePanel({ moduleId, language='fa' }: { moduleId:string; language?:Language }) {
  const en = language === 'en'
  const [cost,setCost] = useState<CostInput>(initialCost)
  const [production,setProduction] = useState<ProductionInput>(initialProduction)
  const [history,setHistory] = useState<SavedRun[]>([])
  const [report,setReport] = useState<SavedRun|null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const isCost = moduleId === 'MOD-02'
  useEffect(() => {
    let alive=true
    localStore.get<SavedRun[]>(isCost?COST_KEY:OEE_KEY).then(rows=>{if(alive)setHistory(Array.isArray(rows)?rows:[])})
    return ()=>{alive=false}
  },[isCost,moduleId])
  const fields = useMemo(()=>isCost?[
    ['outputTon','مقدار تولید (تن)','Output (ton)'],['material','مواد مستقیم','Direct materials'],['labor','دستمزد مستقیم','Direct labor'],['energy','انرژی','Energy'],['maintenance','تعمیرات','Maintenance'],['overhead','سربار تولید','Production overhead'],['sellingPrice','قیمت فروش هر تن','Selling price / ton']
  ] as const:[
    ['plannedMinutes','زمان برنامه‌ریزی‌شده (دقیقه)','Planned time (min)'],['downtimeMinutes','توقفات (دقیقه)','Downtime (min)'],['idealCycleSeconds','زمان سیکل ایده‌آل (ثانیه/واحد)','Ideal cycle (sec/unit)'],['totalCount','کل تولید','Total output'],['goodCount','تولید سالم','Good output']
  ] as const,[isCost])
  async function runAnalysis() {
    setError(''); setReport(null); setBusy(true)
    try {
      const saved = await executeModuleAnalysis(moduleId as 'MOD-02'|'MOD-03', isCost ? cost : production, localStore)
      const rows = await localStore.get<SavedRun[]>(isCost ? COST_KEY : OEE_KEY)
      setHistory(Array.isArray(rows) ? rows : [])
      setReport(saved)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(message || (en?'Could not save this report on this device.':'ذخیره گزارش روی این دستگاه ناموفق بود.'))
    } finally { setBusy(false) }
  }
  const metricLabels = isCost ? (en?{totalCost:'Total production cost',unitCost:'Cost per ton',sellingPrice:'Selling price / ton',grossMarginPerTon:'Gross margin / ton',grossMarginPercent:'Gross margin (%)'}:{totalCost:'کل هزینه تولید',unitCost:'بهای تمام‌شده هر تن',sellingPrice:'قیمت فروش هر تن',grossMarginPerTon:'حاشیه سود ناخالص هر تن',grossMarginPercent:'حاشیه سود ناخالص (%)'}) : (en?{availability:'Availability (%)',performance:'Performance (%)',quality:'Quality (%)',oee:'OEE (%)'}:{availability:'دسترس‌پذیری (%)',performance:'عملکرد (%)',quality:'کیفیت (%)',oee:'اثربخشی کلی تجهیزات OEE (%)'})
  return <section className="module-intelligence">
    <div className="module-intelligence-intro"><b>{isCost?(en?'Cost and gross margin analysis':'تحلیل بهای تمام‌شده و حاشیه سود'):(en?'Production effectiveness analysis':'تحلیل اثربخشی تولید و OEE')}</b><p>{isCost?(en?'Enter actual or approved period data. No missing cost is assumed to be zero.':'اطلاعات واقعی یا تأییدشده یک دوره را وارد کنید؛ داده ناقص به‌صورت صفر فرض نمی‌شود.'):(en?'Enter one consistent production shift or period. OEE is calculated from availability, performance and quality.':'اطلاعات یک شیفت یا دوره همگن را وارد کنید؛ OEE از دسترس‌پذیری، عملکرد و کیفیت محاسبه می‌شود.')}</p></div>
    <div className="module-intelligence-fields">{fields.map(([key,faLabel,enLabel])=><label key={key}>{en?enLabel:faLabel}<input type="number" min="0" step="any" value={isCost?(cost as unknown as Record<string,string>)[key]:(production as unknown as Record<string,string>)[key]} onChange={event=>{const value=event.target.value;if(isCost)setCost(current=>({...current,[key]:value}));else setProduction(current=>({...current,[key]:value}))}} /></label>)}</div>
    {error&&<p className="module-intelligence-error" role="alert">{error}</p>}
    <div className="module-intelligence-actions"><button className="primary" type="button" onClick={()=>void runAnalysis()} disabled={busy}>{busy?(en?'Saving…':'در حال ذخیره…'):(en?'انجام بده':'انجام بده')}</button><small>{en?'The calculation and report are saved locally.':'محاسبه و گزارش روی همین دستگاه ذخیره می‌شود.'}</small></div>
    {report&&<section className="module-analysis-report"><h3>{en?'Analysis report':'گزارش تحلیل'}</h3><div className="module-analysis-metrics">{Object.entries(report.metrics).map(([key,value])=><article key={key}><small>{metricLabels[key as keyof typeof metricLabels]}</small><b>{fmt(value)}{key==='grossMarginPercent'||['availability','performance','quality','oee'].includes(key)?'٪':''}</b></article>)}</div><small>{en?'Saved at ':'زمان ثبت: '}{new Date(report.createdAt).toLocaleString(en?'en-US':'fa-IR')}</small></section>}
    <section className="module-analysis-history"><h3>{en?'Recent reports':'گزارش‌های اخیر'}</h3>{history.length?history.slice(0,5).map(item=><button type="button" key={item.id} onClick={()=>setReport(item)}><span>{new Date(item.createdAt).toLocaleString(en?'en-US':'fa-IR')}</span><b>{isCost?fmt(item.metrics.unitCost):`${fmt(item.metrics.oee)}٪ OEE`}</b></button>):<p>{en?'No saved report yet.':'هنوز گزارشی ثبت نشده است.'}</p>}</section>
  </section>
}
