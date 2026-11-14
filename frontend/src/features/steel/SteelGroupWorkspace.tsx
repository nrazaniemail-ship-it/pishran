import { useState } from 'react'
import { ArrowLeftRight, Boxes, CheckCircle2, ChevronLeft, CircleDot, Factory, GitBranch, Layers3, Package, Pickaxe, ShieldCheck, Truck } from 'lucide-react'

type Stage={id:string;number:string;title:string;subtitle:string;inputs:string;outputs:string;status:'sample'|'planned';icon:typeof Factory}
const stages:Stage[]=[
 {id:'mining',number:'01',title:'استخراج سنگ‌آهن',subtitle:'معدن و آماده‌سازی خوراک',inputs:'کانسنگ، آب، انرژی، مواد ناریه و قطعات',outputs:'سنگ‌آهن دانه‌بندی‌شده، باطله و سنگ کم‌عیار',status:'planned',icon:Pickaxe},
 {id:'concentrate',number:'02',title:'فرآوری و کنسانتره',subtitle:'خردایش، آسیاکنی و پرعیارسازی',inputs:'سنگ‌آهن، آب، برق و مواد شیمیایی',outputs:'کنسانتره، باطله تر/خشک و آب برگشتی',status:'planned',icon:Boxes},
 {id:'pellet',number:'03',title:'گندله‌سازی',subtitle:'آماده‌سازی و پخت گندله',inputs:'کنسانتره، بنتونیت، آب و سوخت',outputs:'گندله پخته، نرمه و غبار',status:'planned',icon:CircleDot},
 {id:'dri',number:'04',title:'احیای مستقیم',subtitle:'تولید آهن اسفنجی و محصولات فشرده',inputs:'گندله، گاز طبیعی یا زغال‌سنگ و انرژی',outputs:'DRI، HDRI/HBI و گاز خروجی',status:'planned',icon:Factory},
 {id:'steelmaking',number:'05',title:'فولادسازی و ریخته‌گری',subtitle:'ذوب، پالایش ثانویه و ریخته‌گری مداوم',inputs:'DRI/HBI، قراضه، چدن، فروآلیاژ و انرژی',outputs:'اسلب، بیلت، بلوم، سرباره و غبار',status:'planned',icon:Layers3},
 {id:'hot-rolling',number:'06',title:'نورد گرم',subtitle:'محصولات تخت و طویل',inputs:'اسلب برای تختال/ورق؛ بیلت و بلوم برای مقاطع',outputs:'کلاف و ورق گرم، میلگرد، تیرآهن، نبشی و ضایعات',status:'sample',icon:Factory},
 {id:'cold-rolling',number:'07',title:'نورد سرد و پوشش‌دهی',subtitle:'محصولات تخت با ارزش افزوده',inputs:'کلاف گرم، اسید، روغن، روی و رنگ',outputs:'ورق سرد، روغنی، گالوانیزه و رنگی',status:'planned',icon:Package},
]
const branches=[
 {title:'مسیر تخت',items:['اسلب','نورد گرم کلاف / ورق / پلیت','اسیدشویی و نورد سرد','آنیل و تمپر','گالوانیزه گرم یا رنگی']},
 {title:'مسیر طویل',items:['بیلت یا بلوم','نورد میلگرد','نورد تیرآهن و نبشی','خنک‌کاری، صافکاری و بسته‌بندی']},
 {title:'مسیرهای تأمین بیرونی',items:['خرید سنگ‌آهن یا کنسانتره','خرید گندله یا آهن اسفنجی','خرید اسلب، بیلت یا بلوم','فروش محصول میانی به مشتری بیرونی']},
]
export default function SteelGroupWorkspace({onOpenHotRolling}:{onOpenHotRolling:()=>void}){
 const [selected,setSelected]=useState('hot-rolling')
 const active=stages.find(s=>s.id===selected)??stages[5]
 const Icon=active.icon
 return <section className="steel-group-page">
  <header className="steel-group-head"><div><span className="eyebrow">PISHRAN / INDUSTRY WORKSPACES</span><h1>گروه فولاد و زنجیره تأمین</h1><p>مدل یکپارچه از معدن تا محصولات نهایی؛ با امکان تعریف واحدهای مستقل، خریدوفروش بین‌مرحله‌ای و مسیرهای جایگزین</p></div><div className="steel-group-version"><GitBranch size={17}/><span>ساختار زنجیره تأمین · نسخه محصول ۱.۰.۱</span></div></header>
  <div className="steel-principle"><ShieldCheck size={19}/><div><b>اصل طراحی: زنجیره قابل پیکربندی، نه مسیر اجباری</b><p>هر مرحله می‌تواند داخل محدوده پروژه باشد یا به‌عنوان تأمین‌کننده / مشتری بیرونی تعریف شود. جریان مواد، ظرفیت، کیفیت، حمل و قیمت انتقالی بین مراحل به‌صورت مستقل ثبت خواهد شد.</p></div></div>
  <section className="steel-chain-panel"><div className="steel-panel-heading"><div><span className="eyebrow">VALUE CHAIN</span><h2>هفت مرحله اصلی زنجیره فولاد</h2></div><small>برای مشاهده شرح هر مرحله انتخاب کنید</small></div>
   <div className="steel-stage-grid">{stages.map(stage=>{const I=stage.icon;return <button key={stage.id} className={'steel-stage-card '+(selected===stage.id?'selected':'')} onClick={()=>setSelected(stage.id)}><span className="steel-stage-no">{stage.number}</span><I size={20}/><b>{stage.title}</b><small>{stage.subtitle}</small><span className={'steel-stage-status '+(stage.status==='sample'?'sample':'')}>{stage.status==='sample'?'نمونه عملی فعال':'در نقشه توسعه'}</span></button>})}</div>
   <div className="steel-chain-note"><ArrowLeftRight size={17}/><span>جریان اصلی مواد: سنگ‌آهن ← کنسانتره ← گندله ← آهن اسفنجی ← فولاد مذاب و ریخته‌گری ← محصولات نوردی</span></div>
  </section>
  <section className="steel-detail-grid"><article className="steel-stage-detail"><div className="steel-detail-title"><span className="steel-stage-no">{active.number}</span><div><span className="eyebrow">STAGE PROFILE</span><h2>{active.title}</h2><small>{active.subtitle}</small></div></div><div className="steel-io-grid"><div><span>ورودی‌های اصلی</span><p>{active.inputs}</p></div><div><span>خروجی‌ها و محصولات جانبی</span><p>{active.outputs}</p></div></div>{active.id==='hot-rolling'?<div className="steel-active-action"><div><CheckCircle2 size={18}/><b>نمونه امکان‌سنجی نورد گرم ورق آماده مشاهده است</b></div><button onClick={onOpenHotRolling}>ورود به نمونه نورد گرم <ChevronLeft size={16}/></button></div>:<div className="steel-planned-note">فرم‌های تخصصی این مرحله در نقشه توسعه قرار دارند. در مدل نهایی، فیلدهای فنی، بازار، CAPEX، OPEX و مالی مخصوص همین مرحله فعال می‌شوند.</div>}</article>
   <article className="steel-integrations"><div className="steel-panel-heading"><div><span className="eyebrow">PROCESS ROUTES</span><h3>شاخه‌های تولید و تبدیل</h3></div></div>{branches.map(branch=><div className="steel-branch" key={branch.title}><b>{branch.title}</b><div className="steel-branch-flow">{branch.items.map((item,i)=><span key={item}>{item}{i<branch.items.length-1&&<ChevronLeft size={13}/>}</span>)}</div></div>)}</article></section>
  <section className="steel-control-grid"><article><Truck size={20}/><div><b>تدارکات و لجستیک</b><p>مبدأ و مقصد، فاصله، روش حمل، کرایه، ظرفیت انبار و موجودی اطمینان برای هر جریان ماده</p></div></article><article><ArrowLeftRight size={20}/><div><b>موازنه و قیمت انتقالی</b><p>تناژ ورودی و خروجی، راندمان، افت، ضایعات، مشخصات کیفی و قیمت فروش داخلی بین واحدها</p></div></article><article><ShieldCheck size={20}/><div><b>ردیابی منبع و مفروضات</b><p>هر داده با واحد، سال مبنا، منبع، صفحه گزارش و سطح اطمینان نگهداری می‌شود</p></div></article></section>
 </section>
}
