import { useEffect, useMemo, useState } from 'react'
import { localStore } from '../../core/storage/localStore'
import { executeModuleAnalysis } from './moduleAnalysisWorkflow'
import { ELECTRICITY_BILLS_KEY } from './ElectricityBillAnalysis'

type Language = 'fa' | 'en'
type CostInput = { outputTon: string; material: string; labor: string; energy: string; maintenance: string; overhead: string; sellingPrice: string }
type ProductionInput = { plannedMinutes: string; downtimeMinutes: string; idealCycleSeconds: string; totalCount: string; goodCount: string }
type SavedRun = { id: string; moduleId: 'MOD-02'|'MOD-03'; createdAt: string; inputs: CostInput|ProductionInput; metrics: Record<string, number>; warnings?: string[]; sourceReferences?:Record<string,string|number> }
type SavedEnergyAllocation={id:string;billId:string;billNumber:string;period:string;allocations:Array<{costCenterId:string;name:string;totalCost:number;costPerTon:number|null}>}
type ElectricityBillSource={id:string;period:string;billNumber:string;accountNumber:string;meterNumber:string;amount:number|null;consumption:number|null;energyCharge:number|null;demandCharge:number|null;reactiveCharge:number|null}
const COST_KEY = 'module-intelligence:MOD-02:v1'
const ENERGY_COST_ALLOCATIONS_KEY='module-intelligence:MOD-05:cost-allocations:v1'
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
  const [electricityBills,setElectricityBills] = useState<ElectricityBillSource[]>([])
  const [energyAllocations,setEnergyAllocations]=useState<SavedEnergyAllocation[]>([])
  const [selectedAllocationId,setSelectedAllocationId]=useState('')
  const [selectedAllocationCenterId,setSelectedAllocationCenterId]=useState('')
  const [appliedAllocation,setAppliedAllocation]=useState<{id:string;billId:string;billNumber:string;period:string;costCenterId:string;totalCost:number}|null>(null)
  const [selectedBillId,setSelectedBillId] = useState('')
  const [appliedBillId,setAppliedBillId] = useState('')
  const [billCostBasis,setBillCostBasis] = useState<'payable'|'operational'|'energy'>('payable')
  const selectedAllocation=energyAllocations.find(item=>item.id===selectedAllocationId)
  const selectedAllocationCenter=selectedAllocation?.allocations.find(item=>item.costCenterId===selectedAllocationCenterId)
  const selectedBill=electricityBills.find(item=>item.id===selectedBillId)
  const selectedBillCost=selectedBill?(billCostBasis==='payable'?selectedBill.amount:billCostBasis==='energy'?selectedBill.energyCharge:selectedBill.energyCharge!==null&&selectedBill.demandCharge!==null&&selectedBill.reactiveCharge!==null?selectedBill.energyCharge+selectedBill.demandCharge+selectedBill.reactiveCharge:null):null
  const appliedBill=appliedBillId?electricityBills.find(item=>item.id===appliedBillId):undefined
  const appliedBillCost=appliedBill?(billCostBasis==='payable'?appliedBill.amount:billCostBasis==='energy'?appliedBill.energyCharge:appliedBill.energyCharge!==null&&appliedBill.demandCharge!==null&&appliedBill.reactiveCharge!==null?appliedBill.energyCharge+appliedBill.demandCharge+appliedBill.reactiveCharge:null):null
  const [report,setReport] = useState<SavedRun|null>(null)
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  const isCost = moduleId === 'MOD-02'
  useEffect(() => {
    let alive=true
    Promise.all([localStore.get<SavedRun[]>(isCost?COST_KEY:OEE_KEY),localStore.get<ElectricityBillSource[]>(ELECTRICITY_BILLS_KEY),localStore.get<SavedEnergyAllocation[]>(ENERGY_COST_ALLOCATIONS_KEY)]).then(([rows,bills,allocations])=>{if(alive){setHistory(Array.isArray(rows)?rows:[]);setElectricityBills(Array.isArray(bills)?bills:[]);setEnergyAllocations(Array.isArray(allocations)?allocations:[])}})
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
      const saved = await executeModuleAnalysis(moduleId as 'MOD-02'|'MOD-03', isCost ? cost : production, localStore, undefined, appliedAllocation&&Number(cost.energy)===appliedAllocation.totalCost?{energyAllocationId:appliedAllocation.id,energyBillId:appliedAllocation.billId,billingPeriod:appliedAllocation.period,billNumber:appliedAllocation.billNumber,energyAllocationCenter:appliedAllocation.costCenterId,energyAllocationCost:appliedAllocation.totalCost,energyAllocationBasis:'MOD-05 component allocation'}:appliedBill&&appliedBillCost!==null&&Number(cost.energy)===appliedBillCost?{energyBillId:appliedBill.id,billingPeriod:appliedBill.period,billNumber:appliedBill.billNumber||'',accountNumber:appliedBill.accountNumber||'',meterNumber:appliedBill.meterNumber||'',energyBillAmountBasis:billCostBasis,energyBillAmount:appliedBillCost}: {})
      const rows = await localStore.get<SavedRun[]>(isCost ? COST_KEY : OEE_KEY)
      setHistory(Array.isArray(rows) ? rows : [])
      setReport(saved as SavedRun)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ''
      setError(message || (en?'Could not save this report on this device.':'ذخیره گزارش روی این دستگاه ناموفق بود.'))
    } finally { setBusy(false) }
  }
  const metricLabels = isCost ? (en?{totalCost:'Total production cost',unitCost:'Cost per ton',sellingPrice:'Selling price / ton',grossMarginPerTon:'Price less production cost / ton',grossMarginPercent:'Unit price-cost spread (%)'}:{totalCost:'کل هزینه تولید',unitCost:'بهای تمام‌شده هر تن',sellingPrice:'قیمت فروش هر تن',grossMarginPerTon:'فاصله قیمت فروش و بهای تولید هر تن',grossMarginPercent:'نسبت فاصله قیمت و بهای تولید (%)'}) : (en?{availability:'Availability (%)',performance:'Performance (%)',quality:'Quality (%)',oee:'OEE (%)'}:{availability:'دسترس‌پذیری (%)',performance:'عملکرد (%)',quality:'کیفیت (%)',oee:'اثربخشی کلی تجهیزات OEE (%)'})
  return <section className="module-intelligence">
    <div className="module-intelligence-intro"><b>{isCost?(en?'Cost and gross margin analysis':'تحلیل بهای تمام‌شده و حاشیه سود'):(en?'Production effectiveness analysis':'تحلیل اثربخشی تولید و OEE')}</b><p>{isCost?(en?'Enter actual or approved period data. No missing cost is assumed to be zero.':'اطلاعات واقعی یا تأییدشده یک دوره را وارد کنید؛ داده ناقص به‌صورت صفر فرض نمی‌شود.'):(en?'Enter one consistent production shift or period. OEE is calculated from availability, performance and quality.':'اطلاعات یک شیفت یا دوره همگن را وارد کنید؛ OEE از دسترس‌پذیری، عملکرد و کیفیت محاسبه می‌شود.')}</p></div>
    {isCost&&<section className="module-energy-bill-link"><b>{en?'Import saved electricity bill cost':'انتقال هزینه قبض برق به بهای انرژی'}</b><p>{en?'Choose a saved bill. Its payable amount replaces the Energy cost field; it is not added to the existing value. Review taxes, credits and accounting treatment before approval.':'یک قبض ذخیره‌شده را انتخاب کنید. مبلغ قابل پرداخت جایگزین فیلد انرژی می‌شود و به مبلغ قبلی اضافه نمی‌شود؛ مالیات، عوارض، تخفیف‌ها و نحوه ثبت حسابداری را پیش از تأیید بررسی کنید.'}</p><label>{en?'Saved electricity bill':'قبض برق ثبت‌شده'}<select value={selectedBillId} onChange={event=>{setSelectedBillId(event.target.value);setAppliedBillId('')}}><option value="">{en?'Select bill':'انتخاب قبض'}</option>{electricityBills.map(item=><option key={item.id} value={item.id}>{item.period} · {item.billNumber||item.accountNumber||item.meterNumber||item.id} · {item.amount??'—'}</option>)}</select></label><label>{en?'Cost basis':'مبنای انتقال هزینه'}<select value={billCostBasis} onChange={event=>{setBillCostBasis(event.target.value as 'payable'|'operational'|'energy');setAppliedBillId('')}}><option value="payable">{en?'Total payable (tax included)':'مبلغ قابل پرداخت (شامل مالیات)'}</option><option value="operational">{en?'Energy + demand + reactive charges':'انرژی + قدرت + راکتیو (بدون مالیات)'}</option><option value="energy">{en?'Energy charge only':'فقط بهای انرژی'}</option></select></label><button type="button" disabled={!selectedBill||selectedBillCost===null} onClick={()=>{if(selectedBill&&selectedBillCost!==null){setCost(current=>({...current,energy:String(selectedBillCost)}));setAppliedBillId(selectedBill.id)}}}>{en?'Apply selected cost basis':'اعمال مبلغ انتخاب‌شده به هزینه انرژی'}</button>{selectedBill&&<small>{en?'Consumption: ':'مصرف قبض: '}{selectedBill.consumption??'—'} kWh · {en?'Selected cost: ':'هزینه انتخاب‌شده: '}{selectedBillCost??'—'} · {en?'Payable: ':'قابل پرداخت: '}{selectedBill.amount??'—'}{appliedBillId===selectedBill.id?' · '+(en?'Applied':'اعمال‌شده'):''}</small>}</section>}
    <section className="module-energy-bill-link"><b>{en?'Import MOD-05 cost-center allocation':'انتقال هزینه تخصیص‌یافته از MOD-05'}</b><p>{en?'Use the allocated share for one cost center; this replaces the Energy field and keeps the invoice reference.':'سهم تخصیص‌یافته یک مرکز هزینه را به‌عنوان هزینه انرژی اعمال کنید؛ مبلغ جایگزین فیلد انرژی می‌شود و مرجع قبض حفظ خواهد شد.'}</p><label>{en?'Saved allocation':'تخصیص ذخیره‌شده'}<select value={selectedAllocationId} onChange={e=>{setSelectedAllocationId(e.target.value);setSelectedAllocationCenterId('');setAppliedAllocation(null)}}><option value="">{en?'Select allocation':'انتخاب تخصیص'}</option>{energyAllocations.map(x=><option key={x.id} value={x.id}>{x.period} · {x.billNumber||x.billId}</option>)}</select></label><label>{en?'Cost center':'مرکز هزینه'}<select value={selectedAllocationCenterId} onChange={e=>{setSelectedAllocationCenterId(e.target.value);setAppliedAllocation(null)}}><option value="">{en?'Select center':'انتخاب مرکز'}</option>{selectedAllocation?.allocations.map(x=><option key={x.costCenterId} value={x.costCenterId}>{x.name} · {fmt(x.totalCost)}</option>)}</select></label><button type="button" disabled={!selectedAllocationCenter} onClick={()=>{if(selectedAllocation&&selectedAllocationCenter){setCost(x=>({...x,energy:String(selectedAllocationCenter.totalCost)}));setAppliedBillId('');setAppliedAllocation({id:selectedAllocation.id,billId:selectedAllocation.billId,billNumber:selectedAllocation.billNumber,period:selectedAllocation.period,costCenterId:selectedAllocationCenter.costCenterId,totalCost:selectedAllocationCenter.totalCost})}}}>{en?'Apply allocated cost':'اعمال هزینه تخصیص‌یافته'}</button>{appliedAllocation&&<small>{en?'Applied center: ':'مرکز اعمال‌شده: '}{appliedAllocation.costCenterId} · {fmt(appliedAllocation.totalCost)}</small>}</section><div className="module-intelligence-fields">{fields.map(([key,faLabel,enLabel])=><label key={key}>{en?enLabel:faLabel}<input type="number" min="0" step="any" value={isCost?(cost as unknown as Record<string,string>)[key]:(production as unknown as Record<string,string>)[key]} onChange={event=>{const value=event.target.value;if(isCost){setCost(current=>({...current,[key]:value}));if(key==='energy'){setAppliedBillId('');setAppliedAllocation(null)}}else setProduction(current=>({...current,[key]:value}))}} /></label>)}</div>
    {error&&<p className="module-intelligence-error" role="alert">{error}</p>}
    <div className="module-intelligence-actions"><button className="primary" type="button" onClick={()=>void runAnalysis()} disabled={busy}>{busy?(en?'Saving…':'در حال ذخیره…'):(en?'انجام بده':'انجام بده')}</button><small>{en?'The calculation and report are saved locally.':'محاسبه و گزارش روی همین دستگاه ذخیره می‌شود.'}</small></div>
    {report&&<section className="module-analysis-report"><h3>{en?'Analysis report':'گزارش تحلیل'}</h3>{report.warnings?.map((warning,index)=><p className="module-intelligence-warning" role="status" key={`${report.id}-warning-${index}`}>{en?'Warning: ':'هشدار: '}{warning}</p>)}<div className="module-analysis-metrics">{Object.entries(report.metrics).map(([key,value])=><article key={key}><small>{metricLabels[key as keyof typeof metricLabels]}</small><b>{fmt(value)}{key==='grossMarginPercent'||['availability','performance','quality','oee'].includes(key)?'٪':''}</b></article>)}</div><small>{en?'Saved at ':'زمان ثبت: '}{new Date(report.createdAt).toLocaleString(en?'en-US':'fa-IR')}</small>{report.sourceReferences?.energyBillId&&<p className="module-intelligence-warning">{en?'Source electricity bill: ':'قبض برق مرجع: '}{report.sourceReferences.billNumber||report.sourceReferences.energyBillId} · {report.sourceReferences.billingPeriod} · {report.sourceReferences.energyAllocationCenter?('مرکز: '+report.sourceReferences.energyAllocationCenter+' · سهم تخصیص: '+fmt(Number(report.sourceReferences.energyAllocationCost))):(en?'cost basis: ':'مبنای هزینه: ')+report.sourceReferences.energyBillAmountBasis+' · '+fmt(Number(report.sourceReferences.energyBillAmount))}</p>}</section>}
    <section className="module-analysis-history"><h3>{en?'Recent reports':'گزارش‌های اخیر'}</h3>{history.length?history.slice(0,5).map(item=><button type="button" key={item.id} onClick={()=>setReport(item)}><span>{new Date(item.createdAt).toLocaleString(en?'en-US':'fa-IR')}</span><b>{isCost?fmt(item.metrics.unitCost):`${fmt(item.metrics.oee)}٪ OEE`}</b></button>):<p>{en?'No saved report yet.':'هنوز گزارشی ثبت نشده است.'}</p>}</section>
  </section>
}
