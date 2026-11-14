import {useMemo,useState} from 'react'
import {AlertTriangle,CheckCircle2,ChevronDown,ChevronUp,Info,ShieldCheck} from 'lucide-react'

export type ValidationIssue={id:string;severity:'error'|'warning'|'info';title:string;detail:string;field?:string}
export function FieldFeedback({label,value}:{label:string;value:number}){
 const issue=useMemo(()=>{
  if(!Number.isFinite(value))return 'مقدار باید عدد معتبر باشد.'
  const signedAllowed=/رشد|تغییر|نوسان/.test(label)
  if(value<0&&!signedAllowed)return 'مقدار منفی برای این ورودی مجاز نیست؛ علامت و واحد را بررسی کنید.'
  if(/ساعت\s*\/\s*روز|ساعت در روز|ساعت روزانه/.test(label)&&value>24)return 'ساعت کار روزانه نمی‌تواند بیشتر از ۲۴ ساعت باشد.'
  if(/روز کاری|تعداد روز/.test(label)&&value>366)return 'تعداد روز در سال نمی‌تواند از ۳۶۶ بیشتر باشد.'
  if(/ساعت/.test(label)&&value>8760)return 'ساعات سالانه نمی‌تواند از ۸٬۷۶۰ ساعت بیشتر باشد.'
  if(/تعداد شیفت/.test(label)&&value>4)return 'تعداد شیفت روزانه معمولاً حداکثر ۴ است؛ مقدار را بررسی کنید.'
  const percent=/(٪|%|درصد|دسترس‌پذیری|بازده|سهم|ترکیب|نرخ مالیات|نرخ تنزیل|نرخ بهره|تحقق ظرفیت)/i.test(label)
  if(percent&&(signedAllowed?Math.abs(value)>100:value>100))return 'مقدار درصدی باید در محدوده مجاز حداکثر ۱۰۰٪ باشد.'
  return ''
 },[label,value])
 if(!issue)return null
 return <small className="smart-field-feedback" role="alert" aria-live="polite"><AlertTriangle size={12}/>{issue}</small>
}
export function ValidationPanel({issues,title='کنترل هوشمند اطلاعات'}:{issues:ValidationIssue[];title?:string}){
 const [expanded,setExpanded]=useState(true)
 const errors=issues.filter(x=>x.severity==='error'),warnings=issues.filter(x=>x.severity==='warning'),infos=issues.filter(x=>x.severity==='info')
 const hasIssues=errors.length+warnings.length>0
 return <section className={'smart-validation '+(errors.length?'has-errors':warnings.length?'has-warnings':'is-valid')} dir="rtl">
  <button type="button" className="smart-validation-head" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
   <span className="smart-validation-icon">{errors.length?<AlertTriangle size={18}/>:hasIssues?<Info size={18}/>:<ShieldCheck size={18}/>}</span>
   <span className="smart-validation-title"><b>{title}</b><small>{errors.length?errors.length+' خطای مهم':warnings.length?warnings.length+' هشدار قابل بررسی':'خطای بحرانی شناسایی نشد'} · {infos.length} نکته تکمیلی</small></span>
   <span className="smart-validation-counts"><em className="sv-error">{errors.length.toLocaleString('fa-IR')}</em><em className="sv-warning">{warnings.length.toLocaleString('fa-IR')}</em><em className="sv-info">{infos.length.toLocaleString('fa-IR')}</em></span>
   {expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {expanded&&<div className="smart-validation-body">
   {!hasIssues&&<div className="sv-clear"><CheckCircle2 size={15}/> کنترل‌های فعال این بخش بدون خطای مهم هستند.</div>}
   {[...errors,...warnings,...infos].map(issue=><div className={'sv-issue sv-'+issue.severity} key={issue.id}><span>{issue.severity==='error'?<AlertTriangle size={15}/>:issue.severity==='warning'?<Info size={15}/>:<CheckCircle2 size={15}/>}</span><div><b>{issue.title}</b><small>{issue.detail}</small>{issue.field&&<small className="sv-field">فیلد مرتبط: {issue.field}</small>}</div></div>)}
  </div>}
 </section>
}
