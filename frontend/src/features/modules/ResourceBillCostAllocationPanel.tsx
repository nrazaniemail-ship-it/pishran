import {useMemo,useState} from 'react'
import {localStore} from '../../core/storage/localStore'
type Resource='gas'|'water'
type Center={id:string;name:string;consumption:string;wastewater:string;production:string}
type Bill={id:string;billNumber:string;period:string;amount:string;volumeCharge:string;sewerCharge:string;fixedCharge:string;taxCharge:string;otherCharges:string}
const KEY='module-intelligence:MOD-05:resource-cost-allocations:v1'
const emptyBill:Bill={id:'',billNumber:'',period:'',amount:'',volumeCharge:'',sewerCharge:'',fixedCharge:'',taxCharge:'',otherCharges:''}
const center=():Center=>({id:'RC-'+Math.random().toString(36).slice(2,8),name:'',consumption:'',wastewater:'',production:''})
function allocate(amount:number,rows:Center[],key:keyof Center,equal=false){const weights=rows.map(x=>equal?1:Math.max(0,Number(x[key])||0)),total=weights.reduce((s,x)=>s+x,0);if(amount>0&&total<=0)throw new Error('برای جزء هزینه، مبنای تخصیص معتبر وارد کنید.');let used=0;return weights.map((w,i)=>{const v=i===rows.length-1?amount-used:amount*w/total;used+=v;return v})}
export default function ResourceBillCostAllocationPanel({resource,language='fa'}:{resource:Resource;language?:'fa'|'en'}){
 const en=language==='en',gas=resource==='gas',[bill,setBill]=useState<Bill>(emptyBill),[centers,setCenters]=useState<Center[]>([center(),center()]),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const allocation=useMemo(()=>{try{
  if(!bill.id||!bill.period||!bill.amount||centers.some(x=>!x.name||!x.consumption))return null
  const amount=Number(bill.amount),parts=['volumeCharge','sewerCharge','fixedCharge','taxCharge','otherCharges'] as const,values=Object.fromEntries(parts.map(k=>[k,Number(bill[k]||0)])) as Record<typeof parts[number],number>
  if(!Number.isFinite(amount)||amount<=0||parts.some(k=>!Number.isFinite(values[k])||values[k]<0))return null
  const known=parts.reduce((s,k)=>s+values[k],0);if(known>amount+Math.max(1,amount*.001))return null
  const volume=allocate(values.volumeCharge,centers,'consumption')
  const sewer=gas?centers.map(()=>0):allocate(values.sewerCharge,centers,'wastewater')
  const fixed=allocate(values.fixedCharge,centers,'consumption',true)
  const preTax=centers.map((_,i)=>volume[i]+sewer[i]+fixed[i])
  const tax=allocate(values.taxCharge,centers,'consumption') // replaced below by proportional pre-tax weights
  const taxWeights=preTax.map(x=>String(x)) as any
  const taxByCenter=values.taxCharge>0&&preTax.reduce((s,x)=>s+x,0)>0?preTax.map((x,i,arr)=>i===arr.length-1?values.taxCharge-arr.slice(0,i).reduce((s,v)=>s+values.taxCharge*v/arr.reduce((a,b)=>a+b,0),0):values.taxCharge*x/arr.reduce((a,b)=>a+b,0)):tax
  const other=allocate(values.otherCharges+Math.max(0,amount-known),centers,'consumption')
  const rows=centers.map((x,i)=>{const total=volume[i]+sewer[i]+fixed[i]+taxByCenter[i]+other[i];const production=Number(x.production)||0;return {costCenterId:x.id,name:x.name,volumeCharge:volume[i],sewerCharge:sewer[i],fixedCharge:fixed[i],taxCharge:taxByCenter[i],otherCharges:other[i],totalCost:total,productionTon:production,costPerTon:production>0?total/production:null}})
  const allocatedTotal=rows.reduce((s,x)=>s+x.totalCost,0)
  if(Math.abs(allocatedTotal-amount)>Math.max(.0001,amount*1e-10))return null
  return {billId:bill.id,billNumber:bill.billNumber,period:bill.period,resource,billAmount:amount,allocatedTotal,allocations:rows,allocationRules:{volumeCharge:'consumption',sewerCharge:'wastewater',fixedCharge:'equal-share',taxCharge:'pre-tax cost share',otherCharges:'consumption'}}
 }catch{return null}},[bill,centers,resource,gas])
 const setBillField=(k:keyof Bill,v:string)=>setBill(x=>({...x,[k]:v}))
 const setCenterField=(id:string,k:keyof Center,v:string)=>setCenters(x=>x.map(c=>c.id===id?{...c,[k]:v}:c))
 async function save(){setError('');setNotice('');if(!allocation){setError('اطلاعات قبض و محرک‌های تخصیص را کامل و معتبر کنید.');return}try{await localStore.update<any[]>(KEY,old=>[{id:'RCA-'+Date.now(),createdAt:new Date().toISOString(),...allocation},...(Array.isArray(old)?old:[])].slice(0,200));setNotice('تخصیص هزینه قبض ذخیره شد و برای اتصال به بهای تمام‌شده آماده است.')}catch{setError('ذخیره تخصیص ناموفق بود.')}}
 const fmt=(n:number)=>Number(n).toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})
 const fields:[keyof Bill,string,string][]=[['id','شناسه مرجع قبض','Bill reference'],['billNumber','شماره قبض','Bill number'],['period','دوره قبض','Billing period'],['amount','مبلغ نهایی قبض','Invoice total'],['volumeCharge',gas?'بهای گاز':'بهای آب','Gas / water charge'],...(!gas?[['sewerCharge','بهای دفع فاضلاب','Wastewater charge'] as [keyof Bill,string,string]]:[]),['fixedCharge','آبونمان / هزینه ثابت','Fixed charges'],['taxCharge','مالیات و عوارض','Tax'],['otherCharges','سایر هزینه‌ها','Other charges']]
 return <section className="resource-cost-allocation"><header><b>{gas?'تخصیص هزینه قبض گاز به مراکز هزینه':'تخصیص هزینه قبض آب به مراکز هزینه'}</b><p>{gas?'بهای گاز بر مبنای مصرف حرارتی/حجمی ثبت‌شده تخصیص می‌یابد.':'بهای آب بر مبنای حجم مصرف و هزینه فاضلاب بر مبنای حجم پساب تخصیص می‌یابد.'} جمع تخصیص باید دقیقاً با مبلغ قبض برابر باشد.</p></header>
  <div className="resource-cost-fields">{fields.map(([k,fa,eng])=><label key={k}>{en?eng:fa}<input type={['amount','volumeCharge','sewerCharge','fixedCharge','taxCharge','otherCharges'].includes(k)?'number':'text'} min="0" value={bill[k]??''} onChange={e=>setBillField(k,e.target.value)}/></label>)}</div>
  <div className="resource-cost-subhead"><b>مراکز هزینه / مصرف‌کنندگان عمده</b><button type="button" onClick={()=>setCenters(x=>[...x,center()])}>افزودن مرکز</button></div>
  {centers.map((x,i)=><article className="resource-cost-center" key={x.id}><b>مرکز {i+1}</b><div className="resource-cost-fields"><label>نام مرکز هزینه<input value={x.name} onChange={e=>setCenterField(x.id,'name',e.target.value)}/></label><label>مصرف {gas?'گاز (Nm³)':'آب (m³)'}<input type="number" min="0" value={x.consumption} onChange={e=>setCenterField(x.id,'consumption',e.target.value)}/></label>{!gas&&<label>حجم فاضلاب (m³)<input type="number" min="0" value={x.wastewater} onChange={e=>setCenterField(x.id,'wastewater',e.target.value)}/></label>}<label>تولید (تن)<input type="number" min="0" value={x.production} onChange={e=>setCenterField(x.id,'production',e.target.value)}/></label></div>{centers.length>1&&<button type="button" className="resource-cost-remove" onClick={()=>setCenters(rows=>rows.filter(r=>r.id!==x.id))}>حذف مرکز</button>}</article>)}
  {allocation?<div className="resource-cost-result"><div><span>مبلغ قبض</span><b>{fmt(allocation.billAmount)}</b></div><div><span>جمع تخصیص</span><b>{fmt(allocation.allocatedTotal)}</b></div>{allocation.allocations.map(x=><article key={x.costCenterId}><b>{x.name}</b><span>هزینه تخصیص‌یافته: {fmt(x.totalCost)} · بهای هر تن: {x.costPerTon===null?'—':fmt(x.costPerTon)}</span></article>)}</div>:<p className="resource-cost-hint">شناسه قبض، دوره، مبلغ نهایی، اجزای هزینه و محرک‌های هر مرکز را وارد کنید. در قبض آب برای تخصیص هزینه فاضلاب، حجم پساب هر مرکز لازم است.</p>}
  {error&&<p className="resource-cost-error">{error}</p>}{notice&&<p className="resource-cost-notice">{notice}</p>}<button type="button" className="primary" disabled={!allocation} onClick={()=>void save()}>ذخیره تخصیص برای بهای تمام‌شده</button>
 </section>
}
