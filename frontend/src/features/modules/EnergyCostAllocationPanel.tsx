import {useMemo,useState} from 'react'
import {localStore} from '../../core/storage/localStore'
import {allocateElectricityBillCost,ENERGY_COST_ALLOCATIONS_KEY} from './energyManagementWorkflow'
import './EnergyCostAllocationPanel.css'
type Consumer={id:string;name:string;consumptionKwh:string;peakDemandKw:string;reactiveKvarh:string;productionTon:string}
type Bill={id:string;billNumber:string;period:string;amount:string;energyCharge:string;demandCharge:string;reactiveCharge:string;taxCharge:string}
const emptyBill:Bill={id:'',billNumber:'',period:'',amount:'',energyCharge:'',demandCharge:'',reactiveCharge:'',taxCharge:''}
const emptyConsumer=():Consumer=>({id:'CC-'+Math.random().toString(36).slice(2,7),name:'',consumptionKwh:'',peakDemandKw:'',reactiveKvarh:'',productionTon:''})
export default function EnergyCostAllocationPanel({language='fa'}:{language?:'fa'|'en'}){
 const en=language==='en'
 const [bill,setBill]=useState<Bill>(emptyBill)
 const [consumers,setConsumers]=useState<Consumer[]>([emptyConsumer(),emptyConsumer()])
 const [notice,setNotice]=useState(''),[error,setError]=useState('')
 const allocation=useMemo(()=>{try{if(!bill.amount||!bill.id||!bill.period||consumers.some(x=>!x.name||!x.consumptionKwh))return null;return allocateElectricityBillCost({bill,consumers})}catch{return null}},[bill,consumers])
 const updateBill=(key:keyof Bill,value:string)=>setBill(old=>({...old,[key]:value}))
 const updateConsumer=(id:string,key:keyof Consumer,value:string)=>setConsumers(old=>old.map(x=>x.id===id?{...x,[key]:value}:x))
 async function save(){
  setError('');setNotice('')
  if(!allocation){setError(en?'Complete invoice details and valid allocation drivers.':'اطلاعات قبض و مبانی تخصیص را کامل و معتبر کنید.');return}
  try{
   const history=await localStore.get<any[]>(ENERGY_COST_ALLOCATIONS_KEY)
   if((history??[]).some(x=>x.billId===bill.id)){setError(en?'This invoice has already been allocated.':'برای این قبض قبلاً تخصیص ثبت شده است؛ از ثبت دوباره جلوگیری شد.');return}
   const row={id:'ECA-'+Date.now(),createdAt:new Date().toISOString(),resource:'electricity',...allocation}
   await localStore.update<any[]>(ENERGY_COST_ALLOCATIONS_KEY,old=>[row,...(Array.isArray(old)?old:[])].slice(0,200))
   setNotice(en?'Auditable cost allocation saved for MOD-02 handoff.':'تخصیص قابل ردیابی ذخیره شد و برای انتقال به MOD-02 آماده است.')
  }catch{setError(en?'Could not save allocation.':'ذخیره تخصیص ناموفق بود.')}
 }
 const fields:[keyof Bill,string,string][]=[['id','شناسه قبض','Bill ID'],['billNumber','شماره قبض','Bill number'],['period','دوره قبض','Billing period'],['amount','مبلغ نهایی','Invoice total'],['energyCharge','بهای انرژی','Energy charge'],['demandCharge','بهای دیماند','Demand charge'],['reactiveCharge','هزینه راکتیو','Reactive charge'],['taxCharge','مالیات و عوارض','Tax']]
 const fmt=(n:number)=>Number(n).toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})
 return <section className="energy-cost-allocation">
  <header><div><b>{en?'Electricity bill cost allocation':'تخصیص قبض برق به مراکز هزینه'}</b><p>{en?'Allocate invoice components by physical cost drivers and reconcile to the payable total.':'اجزای قبض بر اساس محرک‌های فیزیکی به مراکز هزینه تخصیص می‌یابد و با مبلغ نهایی تطبیق می‌شود.'}</p></div></header>
  <div className="eca-fields">{fields.map(([key,fa,eng])=><label key={key}>{en?eng:fa}<input type={['amount','energyCharge','demandCharge','reactiveCharge','taxCharge'].includes(key)?'number':'text'} min="0" value={bill[key]} onChange={e=>updateBill(key,e.target.value)}/></label>)}</div>
  <div className="eca-consumers"><div className="eca-subhead"><b>{en?'Cost centers / significant uses':'مراکز هزینه / مصرف‌کنندگان عمده'}</b><button type="button" onClick={()=>setConsumers(old=>[...old,emptyConsumer()])}>{en?'Add cost center':'افزودن مرکز هزینه'}</button></div>
   {consumers.map((x,i)=><article key={x.id}><b>{en?'Center':'مرکز'} {i+1}</b><div className="eca-fields"><label>{en?'Cost center name':'نام مرکز هزینه'}<input value={x.name} onChange={e=>updateConsumer(x.id,'name',e.target.value)}/></label><label>{en?'Consumption (kWh)':'مصرف (kWh)'}<input type="number" min="0" value={x.consumptionKwh} onChange={e=>updateConsumer(x.id,'consumptionKwh',e.target.value)}/></label><label>{en?'Peak demand (kW)':'دیماند اوج (kW)'}<input type="number" min="0" value={x.peakDemandKw} onChange={e=>updateConsumer(x.id,'peakDemandKw',e.target.value)}/></label><label>{en?'Reactive energy (kVArh)':'انرژی راکتیو (kVArh)'}<input type="number" min="0" value={x.reactiveKvarh} onChange={e=>updateConsumer(x.id,'reactiveKvarh',e.target.value)}/></label><label>{en?'Production (ton)':'تولید (تن)'}<input type="number" min="0" value={x.productionTon} onChange={e=>updateConsumer(x.id,'productionTon',e.target.value)}/></label></div>{consumers.length>1&&<button type="button" className="eca-remove" onClick={()=>setConsumers(rows=>rows.filter(row=>row.id!==x.id))}>{en?'Remove':'حذف مرکز'}</button>}</article>)}
  </div>
  {allocation?<div className="eca-result"><div><span>{en?'Invoice total':'مبلغ قبض'}</span><b>{fmt(allocation.billAmount)}</b></div><div><span>{en?'Allocated total':'جمع تخصیص'}</span><b>{fmt(allocation.allocatedTotal)}</b></div>{allocation.allocations.map((x:any)=><article key={x.costCenterId}><b>{x.name}</b><span>{en?'Allocated cost':'هزینه تخصیص‌یافته'}: {fmt(x.totalCost)} · {en?'Cost / ton':'بهای هر تن'}: {x.costPerTon===null?'—':fmt(x.costPerTon)}</span></article>)}{allocation.warnings.map((w:string)=><small>{w}</small>)}</div>:<p className="eca-hint">{en?'Enter all required invoice and center data. Demand and reactive charges require their respective drivers when nonzero.':'اطلاعات قبض و مراکز هزینه را وارد کنید. هزینه دیماند و راکتیو در صورت غیرصفر بودن به محرک متناظر نیاز دارند.'}</p>}
  {error&&<p className="eca-error" role="alert">{error}</p>}{notice&&<p className="eca-notice" role="status">{notice}</p>}
  <button type="button" className="primary" disabled={!allocation} onClick={()=>void save()}>{en?'Save allocation':'ذخیره تخصیص برای بهای تمام‌شده'}</button>
 </section>
}
