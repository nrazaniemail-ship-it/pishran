import { useMemo, useState } from 'react'
import { Camera, FileImage, LoaderCircle, ScanLine, ShieldCheck, Trash2 } from 'lucide-react'
import { createWorker } from 'tesseract.js'
import { localStore } from '../../core/storage/localStore'
import './ElectricityBillAnalysis.css'

type Bill = { id:string; period:string; billNumber:string; accountNumber:string; meterNumber:string; previousReading:number|null; currentReading:number|null; consumption:number|null; billingDays:number|null; demand:number|null; contractDemand:number|null; reactiveEnergy:number|null; powerFactor:number|null; amount:number|null; dueDate:string; production:number|null; ocrConfidence:number; sourceText:string; createdAt:string }
const KEY='module-intelligence:MOD-05:electricity-bills:v1'
const blank:Bill={id:'',period:'',billNumber:'',accountNumber:'',meterNumber:'',previousReading:null,currentReading:null,consumption:null,billingDays:null,demand:null,contractDemand:null,reactiveEnergy:null,powerFactor:null,amount:null,dueDate:'',production:null,ocrConfidence:0,sourceText:'',createdAt:''}
const faDigits=(s:string)=>s.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٬،]/g,'').replace(/٫/g,'.')
const num=(s:string)=>{const v=faDigits(s).replace(/[^0-9.-]/g,'');const n=Number(v);return v&&Number.isFinite(n)?n:null}
function extract(text:string):Partial<Bill>{
 const t=faDigits(text).replace(/\r/g,'\n'), lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean)
 const pick=(patterns:RegExp[])=>{for(let i=0;i<lines.length;i++)for(const p of patterns){const m=lines[i].match(p);if(m?.[1])return m[1].trim();if(p.test(lines[i])&&lines[i+1])return lines[i+1].trim()}return ''}
 const value=(patterns:RegExp[])=>num(pick(patterns))
 const period=pick([/(?:دوره\s*(?:مصرف|قرائت)?|بازه\s*مصرف|از\s*تاریخ)\s*[:：-]?\s*(.{5,35})/i,/(?:billing\s*period|period)\s*[:：-]?\s*(.{5,35})/i])
 return {
  period,billNumber:pick([/(?:شناسه\s*قبض|شماره\s*قبض|شماره\s*صورتحساب|bill\s*(?:id|no|number))\s*[:：-]?\s*([\w/-]+)/i]),
  accountNumber:pick([/(?:شناسه\s*پرداخت|شماره\s*اشتراک|شناسه\s*مشترک|account\s*(?:no|number))\s*[:：-]?\s*([\w/-]+)/i]),
  meterNumber:pick([/(?:شماره\s*کنتور|شناسه\s*کنتور|meter\s*(?:no|number))\s*[:：-]?\s*([\w/-]+)/i]),
  previousReading:value([/(?:قرائت\s*قبلی|رقم\s*پیشین|previous\s*reading)\D{0,18}([\d,.]+)/i]),
  currentReading:value([/(?:قرائت\s*فعلی|رقم\s*فعلی|current\s*reading)\D{0,18}([\d,.]+)/i]),
  consumption:value([/(?:مصرف\s*(?:کل|دوره)?|انرژی\s*مصرفی|کیلووات\s*ساعت|kwh)\D{0,18}([\d,.]+)/i]),
  billingDays:value([/(?:تعداد\s*روز|مدت\s*دوره|روز\s*مصرف|billing\s*days)\D{0,12}(\d{1,3})/i]),
  demand:value([/(?:حداکثر\s*دیماند|دیماند\s*(?:مصرفی|ثبت\s*شده)?|peak\s*demand)\D{0,18}([\d,.]+)/i]),
  contractDemand:value([/(?:دیماند\s*قراردادی|قدرت\s*قراردادی|contract\s*demand)\D{0,18}([\d,.]+)/i]),
  reactiveEnergy:value([/(?:انرژی\s*راکتیو|مصرف\s*راکتیو|reactive\s*energy)\D{0,18}([\d,.]+)/i]),
  powerFactor:value([/(?:ضریب\s*قدرت|cos\s*phi|power\s*factor)\D{0,12}(0?\.\d{1,3}|\d{1,3})/i]),
  amount:value([/(?:مبلغ\s*قابل\s*پرداخت|جمع\s*کل|مبلغ\s*نهایی|قابل\s*پرداخت|total\s*amount)\D{0,18}([\d,.]+)/i]),
  dueDate:pick([/(?:مهلت\s*پرداخت|تاریخ\s*سررسید|due\s*date)\s*[:：-]?\s*([\d/.-]+)/i])
 }
}
const labels:Record<string,string>={period:'دوره قبض',billNumber:'شناسه قبض',accountNumber:'شماره اشتراک',meterNumber:'شماره کنتور',previousReading:'قرائت قبلی',currentReading:'قرائت فعلی',consumption:'انرژی مصرفی (kWh)',billingDays:'تعداد روز دوره',demand:'حداکثر دیماند (kW)',contractDemand:'دیماند قراردادی (kW)',reactiveEnergy:'انرژی راکتیو (kVArh)',powerFactor:'ضریب قدرت',amount:'مبلغ قابل پرداخت',dueDate:'مهلت پرداخت',production:'تولید دوره (تن)'}
const numeric=(k:string)=>['previousReading','currentReading','consumption','billingDays','demand','contractDemand','reactiveEnergy','powerFactor','amount','production'].includes(k)
export default function ElectricityBillAnalysis(){
 const [bill,setBill]=useState<Bill>(blank),[history,setHistory]=useState<Bill[]>([]),[image,setImage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[expanded,setExpanded]=useState(false)
 const previous=history.filter(x=>x.consumption!==null).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0]
 const days=bill.billingDays||null
 const daily=days&&bill.consumption!==null?bill.consumption/days:null
 const previousDaily=previous?.billingDays&&previous.consumption!==null?previous.consumption/previous.billingDays:null
 const delta=previousDaily&&daily!==null?(daily/previousDaily-1)*100:null
 const amountPerKwh=bill.amount&&bill.consumption?bill.amount/bill.consumption:null
 const readingDelta=bill.previousReading!==null&&bill.currentReading!==null?bill.currentReading-bill.previousReading:null
 const warnings=useMemo(()=>{const w:string[]=[];if(readingDelta!==null&&readingDelta<0)w.push('قرائت فعلی از قرائت قبلی کمتر است.');if(readingDelta!==null&&bill.consumption!==null&&Math.abs(readingDelta-bill.consumption)>Math.max(1,bill.consumption*.02))w.push('مصرف درج‌شده با اختلاف قرائت کنتور بیش از تلورانس ۲٪ اختلاف دارد.');if(bill.powerFactor!==null&&bill.powerFactor<.9)w.push('ضریب قدرت کمتر از ۰٫۹ است؛ احتمال هزینه یا جریمه راکتیو را بررسی کنید.');if(bill.demand!==null&&bill.contractDemand!==null&&bill.demand>bill.contractDemand)w.push('حداکثر دیماند از دیماند قراردادی بیشتر است.');if(delta!==null&&delta>15)w.push('مصرف روزانه نسبت به قبض قبلی بیش از ۱۵٪ افزایش یافته است.');if(bill.billingDays!==null&&(bill.billingDays<20||bill.billingDays>45))w.push('طول دوره قبض غیرمعمول است؛ مقایسه خام مصرف ممکن است گمراه‌کننده باشد.');return w},[bill,readingDelta,delta])
 async function loadHistory(){const x=await localStore.get<Bill[]>(KEY);setHistory(x??[])}
 async function scan(file:File){setError('');setNotice('');setBusy(true);setImage(URL.createObjectURL(file));try{const worker=await createWorker('fas+eng');try{const result=await worker.recognize(file);const parsed=extract(result.data.text);setBill({...blank,...parsed,ocrConfidence:Math.round(result.data.confidence),sourceText:result.data.text});setNotice('متن قبض استخراج شد. لطفاً همه فیلدها و ارقام را با تصویر اصلی تطبیق دهید.')}finally{await worker.terminate()}}catch(e){setError('پردازش تصویر انجام نشد. تصویر واضح‌تری انتخاب کنید یا اطلاعات قبض را دستی وارد کنید.')}finally{setBusy(false)}}
 function set(k:keyof Bill,v:string){setBill(x=>({...x,[k]:numeric(String(k))?(v===''?null:Number(v)):v}))}
 async function save(){setError('');setNotice('');if(!bill.consumption||bill.consumption<=0){setError('انرژی مصرفی معتبر و تأییدشده الزامی است.');return}if(!bill.period.trim()){setError('دوره قبض را وارد کنید.');return}if(readingDelta!==null&&readingDelta<0){setError('قرائت فعلی نمی‌تواند کمتر از قرائت قبلی باشد.');return}const row={...bill,id:'EB-'+Date.now(),createdAt:new Date().toISOString()};try{await localStore.update<Bill[]>(KEY,old=>[row,...(Array.isArray(old)?old:[])].slice(0,120));setHistory(x=>[row,...x]);setBill(blank);setImage('');setNotice('قبض تأییدشده ذخیره شد.')}catch{setError('ذخیره قبض با خطا مواجه شد.')}}
 return <section className="ebill-card">
  <div className="ebill-heading"><div><span className="ebill-kicker">ELECTRICITY · BILL INTELLIGENCE</span><h3>تحلیل قبض مصرفی برق</h3><p>تصویر قبض را بارگذاری کنید؛ استخراج اطلاعات، کنترل سازگاری و تحلیل روند مصرف به‌صورت مرحله‌ای انجام می‌شود.</p></div><span className="ebill-icon"><FileImage size={22}/></span></div>
  <div className="ebill-upload"><label className="ebill-drop"><input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)void scan(f)}}/><Camera size={22}/><b>بارگذاری یا تصویربرداری از قبض</b><small>JPG، PNG یا تصویر دوربین · پردازش در همین دستگاه</small></label>{image&&<img className="ebill-preview" src={image} alt="پیش‌نمایش قبض بارگذاری‌شده"/>}<button className="ebill-secondary" disabled={busy} onClick={()=>setExpanded(x=>!x)}>{expanded?'بستن متن OCR':'نمایش متن استخراج‌شده'}</button></div>
  {busy&&<p className="ebill-status"><LoaderCircle className="ebill-spin" size={17}/> در حال پردازش تصویر و استخراج متن فارسی/انگلیسی…</p>}
  {bill.ocrConfidence>0&&<div className="ebill-confidence"><ShieldCheck size={17}/> اطمینان کلی OCR: {bill.ocrConfidence}٪ — این عدد جایگزین تأیید انسانی نیست.</div>}
  {expanded&&<pre className="ebill-raw">{bill.sourceText||'هنوز متنی استخراج نشده است.'}</pre>}
  {error&&<p className="ebill-error" role="alert">{error}</p>}{notice&&<p className="ebill-notice" role="status">{notice}</p>}
  <div className="ebill-fields"><div className="ebill-fields-title"><b>فرم اطلاعات قبض</b><small>فیلدهای استخراج‌شده قابل ویرایش‌اند؛ موارد خالی را تکمیل کنید.</small></div>{Object.keys(labels).map(k=><label key={k}>{labels[k]}<input type={numeric(k)?'number':'text'} step={k==='powerFactor'?'0.001':'any'} value={(bill as any)[k]??''} onChange={e=>set(k as keyof Bill,e.target.value)}/></label>)}</div>
  <div className="ebill-actions"><button className="ebill-primary" onClick={()=>void save()}><ShieldCheck size={16}/> تأیید و ذخیره قبض</button><button className="ebill-secondary" onClick={()=>{setBill(blank);setImage('');setError('');setNotice('')}}><Trash2 size={15}/> پاک‌کردن فرم</button></div>
  <div className="ebill-analysis"><div className="ebill-analysis-title"><ScanLine size={18}/><b>ارزیابی وضعیت مصرف</b></div><div className="ebill-metrics"><article><small>مصرف روزانه</small><b>{daily===null?'—':daily.toLocaleString('fa-IR',{maximumFractionDigits:1})+' kWh/day'}</b></article><article><small>هزینه هر kWh</small><b>{amountPerKwh===null?'—':amountPerKwh.toLocaleString('fa-IR',{maximumFractionDigits:2})}</b></article><article><small>تغییر مصرف روزانه نسبت به قبض قبل</small><b className={delta!==null&&delta>0?'ebill-warn':''}>{delta===null?'نیازمند قبض قبلی':(delta>0?'+':'')+delta.toLocaleString('fa-IR',{maximumFractionDigits:1})+'٪'}</b></article><article><small>اختلاف قرائت کنتور</small><b>{readingDelta===null?'—':readingDelta.toLocaleString('fa-IR')+' kWh'}</b></article></div>
   {warnings.length>0?<ul className="ebill-warnings">{warnings.map(x=><li key={x}>{x}</li>)}</ul>:<p className="ebill-clear">در داده‌های فعلی هشدار قطعی شناسایی نشد؛ این نتیجه به معنی تأیید کامل قبض یا نبود اتلاف انرژی نیست.</p>}
   <small className="ebill-footnote">مقایسه با قبض قبلی بر مبنای مصرف روزانه است. برای تحلیل شدت انرژی، تولید دوره را وارد کنید؛ برای تحلیل تعرفه، دیماند، پله مصرف و اجزای مبلغ باید اطلاعات تعرفه و قرارداد نیز تأیید شوند.</small>
  </div>
  <div className="ebill-history"><b>قبض‌های ثبت‌شده</b><span>{history.length} قبض</span><button className="ebill-secondary" onClick={()=>void loadHistory()}>به‌روزرسانی فهرست</button>{history.slice(0,5).map(x=><article key={x.id}><span>{x.period} · {x.billNumber||'بدون شناسه'}</span><b>{x.consumption?.toLocaleString('fa-IR')??'—'} kWh</b></article>)}</div>
 </section>
}
