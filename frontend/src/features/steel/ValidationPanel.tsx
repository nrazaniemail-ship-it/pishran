import {useMemo,useState} from 'react'
import {AlertTriangle,CheckCircle2,ChevronDown,ChevronUp,Info,ShieldCheck} from 'lucide-react'

export type ValidationIssue={id:string;severity:'error'|'warning'|'info';title:string;detail:string;field?:string}
export function FieldFeedback({label,value}:{label:string;value:number}){
 const en=typeof document!=='undefined'&&document.documentElement.lang==='en'
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
 const english:Record<string,string>={'مقدار باید عدد معتبر باشد.':'Enter a valid number.','مقدار منفی برای این ورودی مجاز نیست؛ علامت و واحد را بررسی کنید.':'Negative values are not allowed for this input. Check the sign and unit.','ساعت کار روزانه نمی‌تواند بیشتر از ۲۴ ساعت باشد.':'Daily operating hours cannot exceed 24.','تعداد روز در سال نمی‌تواند از ۳۶۶ بیشتر باشد.':'Days per year cannot exceed 366.','ساعات سالانه نمی‌تواند از ۸٬۷۶۰ ساعت بیشتر باشد.':'Annual hours cannot exceed 8,760.','تعداد شیفت روزانه معمولاً حداکثر ۴ است؛ مقدار را بررسی کنید.':'Daily shifts are usually limited to four. Check the value.','مقدار درصدی باید در محدوده مجاز حداکثر ۱۰۰٪ باشد.':'Percentage values must be within the permitted range, up to 100%.'}
 return <small className="smart-field-feedback" role="alert" aria-live="polite"><AlertTriangle size={12}/>{en?(english[issue]??issue):issue}</small>
}
export function ValidationPanel({issues,title='کنترل هوشمند اطلاعات'}:{issues:ValidationIssue[];title?:string}){
 const en=typeof document!=='undefined'&&document.documentElement.lang==='en'
 const t=(fa:string,english:string)=>en?english:fa
 const [expanded,setExpanded]=useState(true)
 const errors=issues.filter(x=>x.severity==='error'),warnings=issues.filter(x=>x.severity==='warning'),infos=issues.filter(x=>x.severity==='info')
 const hasIssues=errors.length+warnings.length>0
 return <section className={'smart-validation '+(errors.length?'has-errors':warnings.length?'has-warnings':'is-valid')} dir={en?"ltr":"rtl"}>
  <button type="button" className="smart-validation-head" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
   <span className="smart-validation-icon">{errors.length?<AlertTriangle size={18}/>:hasIssues?<Info size={18}/>:<ShieldCheck size={18}/>}</span>
   <span className="smart-validation-title"><b>{title==='کنترل هوشمند اطلاعات'?t(title,'Smart Data Validation'):title}</b><small>{errors.length?errors.length+' '+t('خطای مهم','critical errors'):warnings.length?warnings.length+' '+t('هشدار قابل بررسی','warnings to review'):t('خطای بحرانی شناسایی نشد','No critical errors')} · {infos.length} {t('نکته تکمیلی','additional notes')}</small></span>
   <span className="smart-validation-counts"><em className="sv-error">{errors.length.toLocaleString(en?'en-US':'fa-IR')}</em><em className="sv-warning">{warnings.length.toLocaleString(en?'en-US':'fa-IR')}</em><em className="sv-info">{infos.length.toLocaleString(en?'en-US':'fa-IR')}</em></span>
   {expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
  </button>
  {expanded&&<div className="smart-validation-body">
   {!hasIssues&&<div className="sv-clear"><CheckCircle2 size={15}/> {t('کنترل‌های فعال این بخش بدون خطای مهم هستند.','All active checks in this section passed.')}</div>}
   {[...errors,...warnings,...infos].map(issue=><div className={'sv-issue sv-'+issue.severity} key={issue.id}><span>{issue.severity==='error'?<AlertTriangle size={15}/>:issue.severity==='warning'?<Info size={15}/>:<CheckCircle2 size={15}/>}</span><div><b>{issue.title}</b><small>{issue.detail}</small>{issue.field&&<small className="sv-field">{t('فیلد مرتبط: ','Related field: ')}{issue.field}</small>}</div></div>)}
  </div>}
 </section>
}
