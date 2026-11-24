import {useMemo,useState} from 'react'
import {localStore} from '../../core/storage/localStore'
import {allocateGasBillCost} from './energyIntelligenceEngine'
import './ResourceBillCostAllocationPanel.css'

type Resource='gas'|'water'
type Center={id:string;name:string;consumption:string;thermalEnergyGJ:string;fixedCapacityShare:string;wastewater:string;production:string}
type Bill={id:string;billNumber:string;period:string;amount:string;volumeCharge:string;thermalCharge:string;transportCharge:string;sewerCharge:string;fixedCharge:string;taxCharge:string;otherCharges:string}
const KEY='module-intelligence:MOD-05:resource-cost-allocations:v1'
const emptyBill:Bill={id:'',billNumber:'',period:'',amount:'',volumeCharge:'',thermalCharge:'',transportCharge:'',sewerCharge:'',fixedCharge:'',taxCharge:'',otherCharges:''}
const center=():Center=>({id:'RC-'+Math.random().toString(36).slice(2,8),name:'',consumption:'',thermalEnergyGJ:'',fixedCapacityShare:'',wastewater:'',production:''})
const numeric=(value:string)=>value.trim()===''?0:Number(value)
const validNonNegative=(value:string)=>Number.isFinite(numeric(value))&&numeric(value)>=0

export default function ResourceBillCostAllocationPanel({resource,language='fa'}:{resource:Resource;language?:'fa'|'en'}){
 const en=language==='en',gas=resource==='gas'
 const [bill,setBill]=useState<Bill>(emptyBill)
 const [centers,setCenters]=useState<Center[]>([center(),center()])
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 const allocation=useMemo(()=>{
  try{
   if(!bill.id.trim()||!bill.period.trim()||!bill.amount.trim()||!validNonNegative(bill.amount)||numeric(bill.amount)<=0)return null
   if(centers.length===0||centers.some(x=>!x.name.trim()||!x.consumption.trim()||!validNonNegative(x.consumption)||!validNonNegative(x.production)||!validNonNegative(x.thermalEnergyGJ)||!validNonNegative(x.fixedCapacityShare)||!validNonNegative(x.wastewater)))return null
   const amount=numeric(bill.amount)
   const parts=gas?['volumeCharge','thermalCharge','transportCharge','fixedCharge','taxCharge','otherCharges'] as const:['volumeCharge','sewerCharge','fixedCharge','taxCharge','otherCharges'] as const
   if(parts.some(k=>!validNonNegative(bill[k])))return null
   const known=parts.reduce((sum,k)=>sum+numeric(bill[k]),0)
   if(known>amount+Math.max(1,amount*.001))return null
   if(gas){
    return allocateGasBillCost({bill:{id:bill.id,billNumber:bill.billNumber,period:bill.period,amount,volumeCharge:numeric(bill.volumeCharge),thermalCharge:numeric(bill.thermalCharge),transportCharge:numeric(bill.transportCharge),fixedCharge:numeric(bill.fixedCharge),taxCharge:numeric(bill.taxCharge)},consumers:centers.map(x=>({id:x.id,name:x.name,gasNm3:numeric(x.consumption),gasGJ:numeric(x.thermalEnergyGJ),fixedCapacityShare:numeric(x.fixedCapacityShare),productionTon:numeric(x.production)}))})
   }
   const allocate=(value:number,key:'consumption'|'wastewater'|'production',equal=false)=>{
    if(value===0)return centers.map(()=>0)
    const weights=centers.map(x=>equal?1:numeric(x[key])),total=weights.reduce((sum,x)=>sum+x,0)
    if(total<=0)throw new Error('برای جزء هزینه، محرک تخصیص معتبر لازم است.')
    let used=0
    return weights.map((weight,index)=>{const share=index===centers.length-1?value-used:value*weight/total;used+=share;return share})
   }
   const volume=allocate(numeric(bill.volumeCharge),'consumption')
   const sewer=allocate(numeric(bill.sewerCharge),'wastewater')
   const fixed=allocate(numeric(bill.fixedCharge),'consumption',true)
   const other=allocate(numeric(bill.otherCharges)+Math.max(0,amount-known),'consumption')
   const preTax=centers.map((_,i)=>volume[i]+sewer[i]+fixed[i]+other[i])
   const preTaxTotal=preTax.reduce((sum,x)=>sum+x,0)
   const tax=preTaxTotal>0?preTax.map((x,i)=>i===preTax.length-1?numeric(bill.taxCharge)-preTax.slice(0,i).reduce((sum,v)=>sum+numeric(bill.taxCharge)*v/preTaxTotal,0):numeric(bill.taxCharge)*x/preTaxTotal):centers.map(()=>0)
   if(numeric(bill.taxCharge)>0&&preTaxTotal<=0)throw new Error('برای تخصیص مالیات، اجزای پیش از مالیات باید مبنای مثبت داشته باشند.')
   const rows=centers.map((x,i)=>{const totalCost=volume[i]+sewer[i]+fixed[i]+tax[i]+other[i],production=numeric(x.production);return {costCenterId:x.id,name:x.name,volumeCharge:volume[i],sewerCharge:sewer[i],fixedCharge:fixed[i],taxCharge:tax[i],otherCharges:other[i],totalCost,productionTon:production,costPerTon:production>0?totalCost/production:null}})
   const allocatedTotal=rows.reduce((sum,x)=>sum+x.totalCost,0)
   if(Math.abs(allocatedTotal-amount)>Math.max(.0001,amount*1e-10))throw new Error('جمع تخصیص قبض آب با مبلغ نهایی تطبیق ندارد.')
   const residual=Math.max(0,amount-known)
   return {billId:bill.id,billNumber:bill.billNumber,period:bill.period,resource,billAmount:amount,allocatedTotal,residual,allocations:rows,allocationRules:{volumeCharge:'consumption-m3',sewerCharge:'wastewater-m3',fixedCharge:'equal-share',taxCharge:'pre-tax-cost-share',otherCharges:'consumption-m3',residual:'consumption-m3'},warnings:residual>0?['باقیمانده تفکیک‌نشده قبض آب در سایر هزینه‌ها منظور و بر مبنای مصرف آب تخصیص یافت؛ اجزای قبض را تکمیل کنید.']:[]}
  }catch{return null}
 },[bill,centers,resource,gas])
 const setBillField=(key:keyof Bill,value:string)=>setBill(old=>({...old,[key]:value}))
 const setCenterField=(id:string,key:keyof Center,value:string)=>setCenters(old=>old.map(x=>x.id===id?{...x,[key]:value}:x))
 async function save(){
  setError('');setNotice('')
  if(!allocation){setError('اطلاعات قبض و محرک‌های تخصیص را کامل و معتبر کنید.');return}
  try{
   const history=await localStore.get<any[]>(KEY)
   if((history??[]).some(x=>x.resource===resource&&x.billId===bill.id)){setError('برای این قبض قبلاً تخصیص ثبت شده است؛ از ثبت دوباره جلوگیری شد.');return}
   await localStore.update<any[]>(KEY,old=>[{id:'RCA-'+Date.now(),createdAt:new Date().toISOString(),resource,...allocation},...(Array.isArray(old)?old:[])].slice(0,200))
   setNotice('تخصیص هزینه با ریزمبنای قابل ردیابی ذخیره شد و برای انتقال کنترل‌شده به بهای تمام‌شده آماده است.')
  }catch(e){setError(e instanceof Error?e.message:'ذخیره تخصیص ناموفق بود.')}
 }
 const fmt=(n:number)=>Number(n).toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})
 const fields:[keyof Bill,string,string][]=[['id','شناسه مرجع قبض','Bill reference'],['billNumber','شماره قبض','Bill number'],['period','دوره قبض','Billing period'],['amount','مبلغ نهایی قبض','Invoice total'],['volumeCharge',gas?'هزینه حجمی گاز':'بهای آب','Volume / water charge'],...(gas?[['thermalCharge','هزینه انرژی حرارتی','Thermal energy charge'],['transportCharge','هزینه انتقال و توزیع','Transport charge']] as [keyof Bill,string,string][]: [['sewerCharge','بهای دفع فاضلاب','Wastewater charge']] as [keyof Bill,string,string][]),['fixedCharge','آبونمان / هزینه ثابت','Fixed charges'],['taxCharge','مالیات و عوارض','Tax'],['otherCharges','سایر هزینه‌ها','Other charges']]
 return <section className="resource-cost-allocation">
  <header><b>{gas?'تخصیص هزینه قبض گاز به مراکز هزینه':'تخصیص هزینه قبض آب به مراکز هزینه'}</b><p>{gas?'هزینه حجمی بر مبنای Nm³، هزینه حرارتی بر مبنای GJ و هزینه انتقال بر مبنای حجم گاز تخصیص می‌یابد. هزینه ثابت از ظرفیت قراردادی استفاده می‌کند.':'بهای آب بر مبنای حجم مصرف و هزینه فاضلاب بر مبنای حجم پساب تخصیص می‌یابد.'} جمع تخصیص باید دقیقاً با مبلغ قبض برابر باشد.</p></header>
  <div className="resource-cost-fields">{fields.map(([key,fa,eng])=><label key={key}>{en?eng:fa}<input type={['amount','volumeCharge','thermalCharge','transportCharge','sewerCharge','fixedCharge','taxCharge','otherCharges'].includes(key)?'number':'text'} min="0" value={bill[key]??''} onChange={e=>setBillField(key,e.target.value)}/></label>)}</div>
  <div className="resource-cost-subhead"><b>مراکز هزینه / مصرف‌کنندگان عمده</b><button type="button" onClick={()=>setCenters(old=>[...old,center()])}>افزودن مرکز</button></div>
  {centers.map((x,i)=><article className="resource-cost-center" key={x.id}><b>مرکز {i+1}</b><div className="resource-cost-fields">
   <label>نام مرکز هزینه<input value={x.name} onChange={e=>setCenterField(x.id,'name',e.target.value)}/></label>
   <label>{gas?'حجم گاز (Nm³)':'مصرف آب (m³)'}<input type="number" min="0" value={x.consumption} onChange={e=>setCenterField(x.id,'consumption',e.target.value)}/></label>
   {gas&&<label>انرژی حرارتی گاز (GJ)<input type="number" min="0" value={x.thermalEnergyGJ} onChange={e=>setCenterField(x.id,'thermalEnergyGJ',e.target.value)}/></label>}
   {gas&&<label>ظرفیت قراردادی / سهم ثابت<input type="number" min="0" value={x.fixedCapacityShare} onChange={e=>setCenterField(x.id,'fixedCapacityShare',e.target.value)}/></label>}
   {!gas&&<label>حجم فاضلاب (m³)<input type="number" min="0" value={x.wastewater} onChange={e=>setCenterField(x.id,'wastewater',e.target.value)}/></label>}
   <label>تولید (تن)<input type="number" min="0" value={x.production} onChange={e=>setCenterField(x.id,'production',e.target.value)}/></label>
  </div>{centers.length>1&&<button type="button" className="resource-cost-remove" onClick={()=>setCenters(old=>old.filter(row=>row.id!==x.id))}>حذف مرکز</button>}</article>)}
  {allocation?<div className="resource-cost-result"><div><span>مبلغ قبض</span><b>{fmt(allocation.billAmount)}</b></div><div><span>جمع تخصیص</span><b>{fmt(allocation.allocatedTotal)}</b></div>{allocation.allocations.map((x:any)=><article key={x.costCenterId}><b>{x.name}</b><span>هزینه تخصیص‌یافته: {fmt(x.totalCost)} · بهای هر تن: {x.costPerTon===null?'—':fmt(x.costPerTon)}</span></article>)}{allocation.warnings?.map((warning:string)=><small>{warning}</small>)}</div>:<p className="resource-cost-hint">شناسه قبض، دوره، مبلغ نهایی، اجزای هزینه و محرک‌های هر مرکز را وارد کنید. برای گاز، در صورت وجود هزینه حرارتی GJ و ظرفیت قراردادی را ثبت کنید؛ برای آب، حجم پساب را وارد کنید.</p>}
  {error&&<p className="resource-cost-error" role="alert">{error}</p>}{notice&&<p className="resource-cost-notice" role="status">{notice}</p>}
  <button type="button" className="primary" disabled={!allocation} onClick={()=>void save()}>ذخیره تخصیص برای بهای تمام‌شده</button>
 </section>
}
