import { useEffect, useState } from 'react'
import { localStore } from '../../core/storage/localStore'
import { executeModuleKpi, KPI_HISTORY_KEY } from './moduleKpiWorkflow'

type Language = 'fa' | 'en'
type Direction = 'higher' | 'lower'
type KpiRecord = { id:string; createdAt:string; name:string; unit:string; period:string; target:number; actual:number; direction:Direction; variance:number; variancePercent:number; status:'on-target'|'favorable'|'unfavorable' }

export default function ModuleKpiPanel({ language='fa' }: { language?:Language }) {
  const en = language === 'en'
  const [name,setName] = useState('')
  const [unit,setUnit] = useState('درصد')
  const [period,setPeriod] = useState('')
  const [target,setTarget] = useState('')
  const [actual,setActual] = useState('')
  const [direction,setDirection] = useState<Direction>('higher')
  const [history,setHistory] = useState<KpiRecord[]>([])
  const [report,setReport] = useState<KpiRecord|null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    localStore.get<KpiRecord[]>(KPI_HISTORY_KEY).then(rows => { if (alive) setHistory(Array.isArray(rows) ? rows : []) })
    return () => { alive = false }
  }, [])

  async function runAnalysis() {
    setError(''); setBusy(true)
    try {
      const saved = await executeModuleKpi({ name, unit, period, target, actual, direction }, localStore)
      const rows = await localStore.get<KpiRecord[]>(KPI_HISTORY_KEY)
      setHistory(Array.isArray(rows) ? rows : [])
      setReport(saved as KpiRecord)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not save KPI report.' : 'ذخیره گزارش شاخص ناموفق بود.'))
    } finally { setBusy(false) }
  }

  const fmt = (value:number) => value.toLocaleString(en ? 'en-US' : 'fa-IR', { maximumFractionDigits:2 })
  const statusLabel = (status:KpiRecord['status']) => status === 'on-target' ? (en?'On target':'مطابق هدف') : status === 'favorable' ? (en?'Favorable':'مطلوب') : (en?'Unfavorable':'نامطلوب')

  return <section className="module-intelligence">
    <div className="module-intelligence-intro"><b>{en?'KPI target and actual performance':'مقایسه هدف و عملکرد شاخص'}</b><p>{en?'Record one KPI for a clearly defined reporting period. The favorable direction is explicit; no missing value is treated as zero.':'هر بار یک شاخص را برای دوره گزارش مشخص ثبت کنید. جهت مطلوب شاخص صریح است و هیچ داده ناقصی صفر فرض نمی‌شود.'}</p></div>
    <div className="module-intelligence-fields">
      <label>{en?'KPI name':'نام شاخص'}<input value={name} onChange={e=>setName(e.target.value)} maxLength={100}/></label>
      <label>{en?'Unit':'واحد'}<input value={unit} onChange={e=>setUnit(e.target.value)} maxLength={30}/></label>
      <label>{en?'Reporting period':'دوره گزارش'}<input value={period} onChange={e=>setPeriod(e.target.value)} placeholder={en?'e.g. 2026-Q4':'مثلاً ۱۴۰۵/۰۹ یا آبان ۱۴۰۵'} maxLength={40}/></label>
      <label>{en?'Target':'هدف'}<input type="number" min="0.000001" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></label>
      <label>{en?'Actual':'عملکرد واقعی'}<input type="number" min="0" step="any" value={actual} onChange={e=>setActual(e.target.value)}/></label>
      <label>{en?'Preferred direction':'جهت مطلوب شاخص'}<select value={direction} onChange={e=>setDirection(e.target.value as Direction)}><option value="higher">{en?'Higher is better':'مقدار بیشتر مطلوب است'}</option><option value="lower">{en?'Lower is better':'مقدار کمتر مطلوب است'}</option></select></label>
    </div>
    {error&&<p className="module-intelligence-error" role="alert">{error}</p>}
    <div className="module-intelligence-actions"><button className="primary" type="button" onClick={()=>void runAnalysis()} disabled={busy}>{busy?(en?'Saving…':'در حال ذخیره…'):(en?'Calculate and save':'محاسبه و ذخیره')}</button><small>{en?'Saved locally on this device.':'گزارش روی همین دستگاه ذخیره می‌شود.'}</small></div>
    {report&&<section className="module-analysis-report"><h3>{en?'KPI variance report':'گزارش انحراف شاخص'}</h3><div className="module-analysis-metrics">
      <article><small>{en?'Target':'هدف'}</small><b>{fmt(report.target)} {report.unit}</b></article>
      <article><small>{en?'Actual':'عملکرد واقعی'}</small><b>{fmt(report.actual)} {report.unit}</b></article>
      <article><small>{en?'Variance':'انحراف'}</small><b>{fmt(report.variance)} {report.unit}</b></article>
      <article><small>{en?'Variance (%)':'انحراف درصدی'}</small><b>{fmt(report.variancePercent)}٪</b></article>
      <article><small>{en?'Assessment':'ارزیابی'}</small><b>{statusLabel(report.status)}</b></article>
    </div><small>{en?'Period: ':'دوره: '}{report.period} · {new Date(report.createdAt).toLocaleString(en?'en-US':'fa-IR')}</small></section>}
    <section className="module-analysis-history"><h3>{en?'Recent KPI reports':'گزارش‌های اخیر شاخص'}</h3>{history.length?history.slice(0,8).map(item=><button type="button" key={item.id} onClick={()=>setReport(item)}><span>{item.name} · {item.period}</span><b>{fmt(item.variancePercent)}٪ · {statusLabel(item.status)}</b></button>):<p>{en?'No KPI report saved yet.':'هنوز گزارشی ثبت نشده است.'}</p>}</section>
  </section>
}
