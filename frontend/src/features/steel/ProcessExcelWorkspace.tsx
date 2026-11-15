import {useEffect,useMemo,useState} from 'react'
import {ArrowRight,ArrowLeft,Plus,Trash2,Save,Factory,FileSpreadsheet,Info} from 'lucide-react'
import {localStore} from '../../core/storage/localStore'
import type {FeasibilityProject} from '../../core/projects/projectRepository'

type Kind='dri'|'steelmaking'
type Cell=string|number
type Row=Record<string,Cell>&{id:string}
type Column={key:string;label:string;type?:'text'|'number';unit?:string}
type Sheet={id:string;title:string;note:string;columns:Column[];initial?:Record<string,Cell>[];fields?:{key:string;label:string;unit?:string;type?:'text'|'number'}[]}
type Model={name:string;location:string;capacity:number;currency:string;fxRate:number;startYear:number;constructionYears:number;operatingYears:number;discountRate:number;taxRate:number;tables:Record<string,Row[]>;fields:Record<string,Cell>}
const id=()=>crypto.randomUUID?.()??String(Date.now()+Math.random())
const num=(v:unknown)=>Number.isFinite(Number(v))?Number(v):0
const fmt=(v:number,d=0)=>num(v).toLocaleString('fa-IR',{maximumFractionDigits:d,minimumFractionDigits:d})
const years=(prefix:string,count:number)=>Array.from({length:count},(_,i)=>({key:prefix+(i+1),label:(i+1).toString(),type:'number' as const}))
const commonCapex:Sheet[]=[
 {id:'land',title:'خرید زمین',note:'مساحت زمین، بهای هر مترمربع، هزینه انتقال سند و عوارض؛ مطابق شیت اول سرمایه‌گذاری ثابت.',columns:[{key:'item',label:'شرح زمین'},{key:'area',label:'مساحت',type:'number',unit:'مترمربع'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ نهایی',type:'number'}]},
 {id:'site',title:'محوطه سازی',note:'عملیات خاکی، تسطیح، راه‌سازی، دیوارکشی، زهکشی و محوطه‌سازی.',columns:[{key:'item',label:'شرح عملیات'},{key:'quantity',label:'مقدار',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ نهایی',type:'number'}]},
 {id:'buildings',title:'ساختمان‌ها',note:'ساختمان‌های صنعتی و غیرصنعتی، زیربنا، نرخ ساخت و مبلغ کل.',columns:[{key:'item',label:'نوع ساختمان'},{key:'area',label:'زیربنا',type:'number',unit:'مترمربع'},{key:'unitPrice',label:'هزینه ساخت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ کل',type:'number'}]},
 {id:'machinery',title:'ماشین آلات',note:'فهرست تجهیزات اصلی و جانبی، تعداد، ظرفیت، سازنده، ارز خرید و هزینه نصب.',columns:[{key:'item',label:'نام تجهیز'},{key:'capacity',label:'ظرفیت/مشخصه'},{key:'quantity',label:'تعداد',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'installation',label:'نصب و حمل',type:'number'},{key:'amount',label:'مبلغ کل',type:'number'}]},
 {id:'vehicles',title:'وسائط نقلیه',note:'وسایل نقلیه عملیاتی، حمل داخلی، لیفتراک و خودروهای خدماتی.',columns:[{key:'item',label:'نوع وسیله'},{key:'quantity',label:'تعداد',type:'number'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ کل',type:'number'}]},
 {id:'utilities-capex',title:'تاسیسات زیربنایی',note:'برق، پست و ترانس، آب، گاز، اکسیژن، هوای فشرده، تصفیه‌خانه و شبکه‌های توزیع.',columns:[{key:'item',label:'تأسیسات'},{key:'capacity',label:'ظرفیت طراحی'},{key:'quantity',label:'مقدار',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ کل',type:'number'}]},
 {id:'office',title:'وسایل اداری',note:'اثاثیه، تجهیزات اداری، IT، آزمایشگاهی و خدماتی.',columns:[{key:'item',label:'شرح کالا'},{key:'quantity',label:'تعداد',type:'number'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ کل',type:'number'}]},
 {id:'preop',title:'قبل از بهره‌برداری',note:'هزینه‌های مهندسی، مدیریت طرح، آموزش، راه‌اندازی، تست عملکرد، بیمه و هزینه‌های پیش از تولید.',columns:[{key:'item',label:'شرح هزینه'},{key:'quantity',label:'مقدار',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'هزینه واحد',type:'number'},{key:'currency',label:'ارز'},{key:'fx',label:'نرخ تبدیل',type:'number'},{key:'amount',label:'مبلغ',type:'number'}]},
 {id:'fixed-investment',title:'سرمایه‌گذاری ثابت طرح',note:'خلاصه خودکار اقلام شیت‌های قبلی؛ ردیف‌های جمع‌بندی را با مبالغ نهایی کنترل کنید.',columns:[{key:'item',label:'سرفصل سرمایه‌گذاری'},{key:'amount',label:'مبلغ',type:'number'},{key:'share',label:'سهم از کل',type:'number',unit:'٪'},{key:'source',label:'مرجع'}],initial:['خرید زمین','محوطه‌سازی','ساختمان‌ها','ماشین‌آلات','وسائط نقلیه','تأسیسات زیربنایی','وسایل اداری','قبل از بهره‌برداری','هزینه‌های پیش‌بینی‌نشده'].map(item=>({item,amount:0,share:0,source:'محاسبه از شیت‌های قبل'}))}
]
const driMaterials=[
 {item:'گندله',specific:1.45,unit:'تن/تن DRI',unitPrice:115},
 {item:'حمل داخلی گندله',specific:0,unit:'یورو/تن',unitPrice:0},
 {item:'آهک پخته',specific:2,unit:'کیلوگرم/تن DRI',unitPrice:0.03},
 {item:'کاتالیست',specific:0.0345,unit:'کیلوگرم/تن DRI',unitPrice:3},
 {item:'لوله‌های ریفورمر',specific:0.08,unit:'کیلوگرم/تن DRI',unitPrice:12.4},
 {item:'مواد شیمیایی',specific:3,unit:'کیلوگرم/تن DRI',unitPrice:0.22},
 {item:'روغن و گریس',specific:0.025,unit:'کیلوگرم/تن DRI',unitPrice:23.4}
]
const steelMaterials=[
 {item:'قراضه قابل خرید پس از کسر قراضه برگشتی',specific:0.05,unit:'تن/تن محصول',unitPrice:0},
 {item:'حمل قراضه',specific:0,unit:'یورو/تن',unitPrice:0},
 {item:'دولومیت پخته',specific:26,unit:'کیلوگرم/تن اسلب',unitPrice:0.04},
 {item:'فرومنگنز پرکربن',specific:8,unit:'کیلوگرم/تن اسلب',unitPrice:1.23},
 {item:'فروسیلیس',specific:4,unit:'کیلوگرم/تن اسلب',unitPrice:1.12},
 {item:'آلومینیوم گرانوله',specific:6,unit:'کیلوگرم/تن اسلب',unitPrice:1.61},
 {item:'کک',specific:15,unit:'کیلوگرم/تن اسلب',unitPrice:0.21},
 {item:'پودر کربن',specific:1,unit:'کیلوگرم/تن اسلب',unitPrice:0.5},
 {item:'فلورین',specific:1,unit:'کیلوگرم/تن اسلب',unitPrice:0.07},
 {item:'آهک پخته',specific:64,unit:'کیلوگرم/تن اسلب',unitPrice:0.03},
 {item:'GUNNING MIXTURE',specific:1,unit:'کیلوگرم/تن اسلب',unitPrice:0.32},
 {item:'الکترود گرافیتی',specific:1.6,unit:'کیلوگرم/تن اسلب',unitPrice:3.05},
 {item:'نسوز کوره قوس و پاتیلی',specific:7.2,unit:'کیلوگرم/تن اسلب',unitPrice:1.57},
 {item:'نسوز تاندیش',specific:1.6,unit:'کیلوگرم/تن اسلب',unitPrice:0.81},
 {item:'نسوز تعمیرات موضعی',specific:1.6,unit:'کیلوگرم/تن اسلب',unitPrice:1.08},
 {item:'پودر تاندیش',specific:0.35,unit:'کیلوگرم/تن اسلب',unitPrice:0.36},
 {item:'رابط مجرای خروجی مذاب',specific:0.001,unit:'واحد/تن اسلب',unitPrice:0.43},
 {item:'پودر قالب',specific:0.55,unit:'کیلوگرم/تن اسلب',unitPrice:1.08},
 {item:'نازل انتقال مذاب',specific:0.0004,unit:'واحد/تن اسلب',unitPrice:0.12},
 {item:'میله متوقف‌کننده مذاب',specific:0.0004,unit:'واحد/تن اسلب',unitPrice:0.43},
 {item:'قالب مسی ریخته‌گری مداوم',specific:0.02,unit:'کیلوگرم/تن اسلب',unitPrice:6.09},
 {item:'لوله اکسیژن‌کاری',specific:0.055,unit:'شاخه/تن اسلب',unitPrice:4.46},
 {item:'روغن هیدرولیک و گریس',specific:0.02,unit:'کیلوگرم/تن اسلب',unitPrice:23.4},
 {item:'ترموکوپل',specific:0.08,unit:'عدد/تن اسلب',unitPrice:0.56}
]
const energy=(kind:Kind)=>kind==='dri'?[
 {item:'آب صنعتی',specific:1.4,unit:'مترمکعب/تن DRI',unitPrice:0.13},
 {item:'آب شرب',specific:6,unit:'مترمکعب/ساعت',unitPrice:0.13},
 {item:'برق مصرفی',specific:110,unit:'کیلووات‌ساعت/تن DRI',unitPrice:0.04},
 {item:'اکسیژن گازی',specific:15,unit:'Nm³/تن DRI',unitPrice:0.08},
 {item:'گاز صنعتی',specific:250,unit:'Nm³/تن DRI',unitPrice:0.06}
]:[
 {item:'آب صنعتی',specific:2.5,unit:'مترمکعب/تن اسلب',unitPrice:0.13},
 {item:'آب شرب',specific:12,unit:'مترمکعب/ساعت',unitPrice:0.13},
 {item:'برق مصرفی',specific:568,unit:'کیلووات‌ساعت/تن اسلب',unitPrice:0.04},
 {item:'اکسیژن گازی',specific:40,unit:'Nm³/تن اسلب',unitPrice:0.08},
 {item:'گاز صنعتی',specific:20,unit:'Nm³/تن اسلب',unitPrice:0.06}
]
const commonOpex=(kind:Kind):Sheet[]=>[
 {id:'materials',title:'مواد خام',note:kind==='dri'?'ردیف‌های این فرم فقط مواد مصرفی واحد احیای مستقیم از شیت مواد خام اکسل را در بر می‌گیرد.':'ردیف‌های این فرم فقط مواد مصرفی واحد ذوب و ریخته‌گری را در بر می‌گیرد؛ اقلام گریدهای ویژه در صورت نیاز قابل افزودن‌اند.',columns:[{key:'item',label:'ماده اولیه/مصرفی'},{key:'specific',label:'مصرف ویژه',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'قیمت واحد',type:'number'},{key:'annualQty',label:'مصرف سالیانه',type:'number'},{key:'annualCost',label:'هزینه سالیانه',type:'number'}],initial:(kind==='dri'?driMaterials:steelMaterials)},
 {id:'energy',title:'انرژی',note:'مصرف ویژه و سالیانه آب، برق، گاز، اکسیژن و سایر حامل‌ها. آب شرب بر مبنای ساعت/روز و اقلام تولیدی بر مبنای تن محصول محاسبه می‌شوند.',columns:[{key:'item',label:'نوع انرژی'},{key:'specific',label:'مصرف ویژه',type:'number'},{key:'unit',label:'واحد'},{key:'unitPrice',label:'قیمت هر واحد',type:'number'},{key:'annualQty',label:'مصرف سالیانه',type:'number'},{key:'annualCost',label:'هزینه سالیانه',type:'number'}],initial:energy(kind)},
 {id:'maintenance',title:'تعمیر و نگهداری',note:'هزینه تعمیرات بر مبنای سرمایه مشمول تعمیر و درصد سالیانه؛ نرخ‌ها در فایل مرجع برای ساختمان، ماشین‌آلات، تأسیسات، خودرو و اداری تفکیک شده‌اند.',columns:[{key:'asset',label:'دارایی/تجهیز'},{key:'basis',label:'سرمایه مشمول',type:'number'},{key:'rate',label:'درصد تعمیرات',type:'number',unit:'٪'},{key:'annualCost',label:'هزینه سالیانه',type:'number'}],initial:['ساختمان و سیویل غیرصنعتی','ماشین‌آلات','تأسیسات زیربنایی و واحدهای جنبی','وسائط نقلیه','تجهیزات و وسایل اداری'].map((asset,i)=>({asset,basis:0,rate:[2,4,4,10,10][i],annualCost:0}))},
 {id:'staff',title:'نیروی انسانی',note:'ساختار سازمانی و جدول حقوق سالیانه مطابق دو بخش شیت نیروی انسانی اکسل؛ مقادیر نفرات برای هر پروژه مستقل ثبت می‌شود.',columns:[{key:'department',label:'بخش/واحد'},{key:'expert',label:'کارشناس',type:'number'},{key:'technician',label:'تکنسین',type:'number'},{key:'secretary',label:'منشی',type:'number'},{key:'operator',label:'کارگر فنی',type:'number'},{key:'driver',label:'راننده',type:'number'},{key:'laborer',label:'کارگر ساده',type:'number'},{key:'total',label:'جمع',type:'number'}],initial:['مدیریت','دفتر مدیریت','بهره‌برداری','تعمیرات','تعمیرگاه','تأسیسات و پشتیبانی','برنامه‌ریزی تولید','خرید','فروش','انبارها','اداری و مالی','خدمات','سیستم‌های اطلاعاتی','کنترل فنی','پشتیبانی فنی','تضمین کیفیت','کنترل کیفیت','توسعه'].map(department=>({department,expert:0,technician:0,secretary:0,operator:0,driver:0,laborer:0,total:0}))},
 {id:'depreciation',title:'استهلاک',note:'پایه استهلاک از سرمایه‌گذاری ثابت هر طبقه دارایی؛ نرخ استهلاک و نرخ اسقاط جداگانه قابل تعریف است.',columns:[{key:'asset',label:'شرح دارایی'},{key:'base',label:'سرمایه مشمول',type:'number'},{key:'rate',label:'نرخ استهلاک',type:'number',unit:'٪'},{key:'scrap',label:'نرخ اسقاط',type:'number',unit:'٪'},{key:'annualDep',label:'استهلاک سالیانه',type:'number'}],initial:['آماده‌سازی سایت','ساختمان و سیویل','ماشین‌آلات و تجهیزات','تأسیسات زیربنایی','وسائط نقلیه','تجهیزات اداری و خدماتی','هزینه‌های قبل از بهره‌برداری','سایر هزینه‌ها'].map((asset,i)=>({asset,base:0,rate:[7,7,8,10,10,20,25,10][i],scrap:10,annualDep:0}))},
 {id:'annual-opex',title:'هزینه‌های جاری سالیانه',note:'تجمیع مواد اولیه، حقوق، سربار حقوق، تعمیرات، استهلاک، انرژی و سایر هزینه‌ها؛ این شیت باید از جداول قبلی تغذیه شود.',columns:[{key:'item',label:'شرح هزینه'},{key:'amount',label:'هزینه سالیانه',type:'number'},{key:'share',label:'درصد از کل',type:'number',unit:'٪'},{key:'source',label:'شیت مرجع'}],initial:['مواد اولیه','نیروی انسانی','سربار نیروی انسانی','تعمیر و نگهداری','استهلاک','آب، برق و گاز','سایر هزینه‌ها'].map((item,i)=>({item,amount:0,share:0,source:['مواد خام','نیروی انسانی','نیروی انسانی','تعمیر و نگهداری','استهلاک','انرژی','فرمول اکسل'][i]}))},
 {id:'sales',title:'قیمت فروش',note:'محصولات قابل فروش، ترکیب تولید، قیمت فروش و برنامه افزایش ظرفیت. برای DRI، محصول اصلی آهن اسفنجی و محصولات جانبی فقط در صورت تعریف پروژه درج شوند.',columns:[{key:'product',label:'نوع محصول'},{key:'grade',label:'گرید/مشخصات'},{key:'price',label:'قیمت هر تن',type:'number'},{key:'mix',label:'سهم تولید',type:'number',unit:'٪'},{key:'annualQty',label:'تولید سالیانه',type:'number'},{key:'revenue',label:'درآمد سالیانه',type:'number'}],initial:kind==='dri'?[{product:'آهن اسفنجی (DRI)',grade:'درجه فلزی‌شدن و کربن مطابق مشخصات محصول',price:0,mix:100,annualQty:0,revenue:0}]:[{product:'محصول ریخته‌گری',grade:'اسلب/بیلت/بلوم بر اساس انتخاب پروژه',price:0,mix:100,annualQty:0,revenue:0}]},
 {id:'break-even',title:'سر به سری',note:'تفکیک هزینه ثابت و متغیر و محاسبه نقطه سربه‌سر تولید و فروش؛ درصدها باید با ماهیت هزینه پروژه تنظیم شوند.',columns:[{key:'item',label:'شرح'},{key:'variableShare',label:'درصد متغیر',type:'number',unit:'٪'},{key:'fixedShare',label:'درصد ثابت',type:'number',unit:'٪'},{key:'totalCost',label:'هزینه تولید',type:'number'},{key:'variableCost',label:'هزینه متغیر',type:'number'},{key:'fixedCost',label:'هزینه ثابت',type:'number'}],initial:['مواد اولیه','دستمزد','آب و برق و گاز','تعمیر و نگهداری','استهلاک','هزینه‌های متفرقه'].map((item,i)=>({item,variableShare:[100,0,80,80,0,50][i],fixedShare:[0,100,20,20,100,50][i],totalCost:0,variableCost:0,fixedCost:0}))},
 {id:'results',title:'نتایج',note:'خلاصه شاخص‌های اقتصادی و تولیدی پروژه مستقل؛ این جدول از مدل همان پروژه تغذیه می‌شود.',columns:[{key:'metric',label:'شاخص'},{key:'unit',label:'واحد'},{key:'value',label:'مقدار',type:'number'},{key:'reference',label:'مرجع'}],initial:['سرمایه‌گذاری ثابت','سرمایه در گردش','هزینه‌های قبل از بهره‌برداری','جمع کل سرمایه‌گذاری','هزینه تمام‌شده هر تن','قیمت فروش هر تن','سود سالانه','دوره بازگشت سرمایه','NPV','IRR','IRRE'].map(metric=>({metric,unit:'قابل تعریف',value:0,reference:'محاسبات پروژه'}))},
 {id:'sensitivity',title:'حساسیت',note:'حساسیت IRR نسبت به تغییر درآمد فروش، CAPEX، OPEX و نرخ تنزیل؛ سناریوها به‌صورت مستقل از پروژه دیگر نگهداری می‌شوند.',columns:[{key:'change',label:'تغییر عامل',type:'number',unit:'٪'},{key:'sales',label:'درآمد فروش',type:'number'},{key:'capex',label:'سرمایه‌گذاری ثابت',type:'number'},{key:'opex',label:'هزینه عملیاتی',type:'number'},{key:'discountRate',label:'نرخ تنزیل',type:'number'}],initial:[-20,-16,-12,-8,-4,0,4,8,12,16,20].map(change=>({change,sales:0,capex:0,opex:0,discountRate:0}))},
 {id:'reference',title:'نتایج مرجع مالی',note:'جایگاه ثبت خروجی یا تطبیق نتایج Reference؛ در نسخه فعلی ورودی مرجع/مقایسه‌ای است و به‌معنای اتصال مستقیم به Reference نیست.',columns:[{key:'metric',label:'شاخص Reference'},{key:'construction',label:'دوران ساخت',type:'number'},{key:'production',label:'دوران تولید',type:'number'},{key:'total',label:'جمع کل',type:'number'}],initial:['سرمایه‌گذاری ثابت','هزینه‌های قبل از بهره‌برداری','بهره دوران ساخت','افزایش سرمایه در گردش','کل هزینه‌های سرمایه‌گذاری','فروش','هزینه کارخانه','استهلاک','هزینه مالی','سود ناخالص','مالیات','سود خالص','NPV','IRR','MIRR'].map(metric=>({metric,construction:0,production:0,total:0}))},
 {id:'energy-sensitivity',title:'حساسیت (E)',note:'حساسیت نرخ بازده به تغییر نرخ انرژی؛ ساختار مطابق شیت آخر فایل هزینه تولید.',columns:[{key:'energyChange',label:'تغییر نرخ انرژی',type:'number',unit:'٪'},{key:'irr',label:'نرخ بازده داخلی',type:'number',unit:'٪'},{key:'discountRate',label:'نرخ تنزیل',type:'number',unit:'٪'}],initial:[-80,-60,-40,-20,0,20,40,60,80].map(energyChange=>({energyChange,irr:0,discountRate:0}))}
]
const financeSheets:Sheet[]=[
 {id:'title',title:'عنوان',note:'عنوان گزارش جریان نقدی و شرح مستقل پروژه.',columns:[{key:'field',label:'مشخصه'},{key:'value',label:'مقدار'}],initial:[{field:'عنوان پروژه',value:''},{field:'شرح پروژه',value:''},{field:'تاریخ مبنا',value:''},{field:'واحد پول حسابداری',value:'یورو'},{field:'واحد مبالغ',value:'مطلق'}]},
 {id:'project-funding',title:'پروژه',note:'منابع مالی دوران ساخت به تفکیک آورده سهامدار و تسهیلات، در چهار سال ساخت؛ سال‌های ساخت قابل افزایش در ویرایش‌های بعدی.',columns:[{key:'source',label:'شرح منابع'},{key:'y1',label:'سال اول',type:'number'},{key:'y2',label:'سال دوم',type:'number'},{key:'y3',label:'سال سوم',type:'number'},{key:'y4',label:'سال چهارم',type:'number'},{key:'total',label:'کل جریان نقدی',type:'number'},{key:'rate',label:'نرخ بهره'},{key:'repaymentStart',label:'شروع بازپرداخت'}],initial:['آورده نقدی سهامدار','تسهیلات بلندمدت ارزی','تسهیلات بلندمدت ریالی','سایر تسهیلات'].map(source=>({source,y1:0,y2:0,y3:0,y4:0,total:0,rate:0,repaymentStart:''}))},
 {id:'inflows',title:'جریان ورودی',note:'برداشت و بازپرداخت تسهیلات بلندمدت و کوتاه‌مدت و جمع جریان‌های تأمین مالی در دوره‌های سالانه.',columns:[{key:'source',label:'شرح منبع'},{key:'type',label:'نوع'},...years('p',19)],initial:['آورده سهامدار','وام بلندمدت اول','وام بلندمدت دوم','وام کوتاه‌مدت سرمایه در گردش','کل تأمین مالی بلندمدت','کل تأمین مالی کوتاه‌مدت','کل جریانات مالی'].map(source=>({source,type:'ورود/بازپرداخت',...Object.fromEntries(Array.from({length:19},(_,i)=>['p'+(i+1),0]))}))},
 {id:'equity-debt-flow',title:'جریان SL',note:'جریان سالانه حقوق صاحبان سهام، وام بلندمدت و تأمین مالی کوتاه‌مدت؛ ترتیب دوره‌ها از ساخت تا بهره‌برداری.',columns:[{key:'period',label:'دوره'},{key:'equity',label:'حقوق صاحبان سهام',type:'number'},{key:'longTerm',label:'وام بلندمدت',type:'number'},{key:'shortTerm',label:'تأمین مالی کوتاه‌مدت',type:'number'}],initial:Array.from({length:19},(_,i)=>({period:'دوره '+(i+1),equity:0,longTerm:0,shortTerm:0}))},
 {id:'debt-balance',title:'بدهی SL',note:'مانده بدهی بلندمدت و کوتاه‌مدت در پایان هر دوره.',columns:[{key:'period',label:'دوره'},{key:'longTerm',label:'مانده بدهی بلندمدت',type:'number'},{key:'shortTerm',label:'مانده بدهی کوتاه‌مدت',type:'number'}],initial:Array.from({length:19},(_,i)=>({period:'دوره '+(i+1),longTerm:0,shortTerm:0}))},
 {id:'loans',title:'وامها',note:'برای هر وام، جریان ورودی، اصل بازپرداخت، مانده بدهی و بهره پرداختی در دوره‌های پروژه ثبت شود.',columns:[{key:'loan',label:'نام تسهیلات'},{key:'flow',label:'نوع جریان'},{key:'total',label:'جمع',type:'number'},...years('p',19)],initial:['وام ارزی بلندمدت','وام ریالی بلندمدت','وام سرمایه در گردش'].flatMap(loan=>['جریان ورودی','بازپرداخت اصل','مانده بدهی','بهره پرداختی'].map(flow=>({loan,flow,total:0,...Object.fromEntries(Array.from({length:19},(_,i)=>['p'+(i+1),0]))})))},
 {id:'total-cashflow',title:'جریان نقدی کل',note:'منابع و مصارف پروژه و بهره‌برداری، سود قابل تقسیم و مانده نقد پایان دوره.',columns:[{key:'section',label:'بخش'},{key:'item',label:'شرح منابع/مصارف'},...years('p',19)],initial:['درآمد عملیاتی','درآمد سایر','وام بلندمدت','وام کوتاه‌مدت','آورده سهامدار','جمع منابع','سرمایه‌گذاری ثابت','سرمایه در گردش','هزینه‌های تولید','مالیات','بهره وام','بازپرداخت اصل وام','جمع مصارف','سود قابل تقسیم','سود نقدی قابل تخصیص','موجودی نقد پایان دوره'].map((item,i)=>({section:i<6?'منابع':'مصارف و سود',item,...Object.fromEntries(Array.from({length:19},(_,j)=>['p'+(j+1),0]))}))},
 {id:'debt-service',title:'Debt Service',note:'برنامه برداشت، بازپرداخت، مانده بدهی، تعدیلات نرخ ارز، بهره سرمایه‌ای، بهره پرداختی و سایر هزینه‌های مالی؛ دوره ساخت و تولید جداست.',columns:[{key:'loan',label:'تسهیلات'},{key:'flow',label:'شرح جریان'},{key:'total',label:'جمع کل',type:'number'},...Array.from({length:4},(_,i)=>({key:'c'+(i+1),label:'ساخت '+(i+1),type:'number' as const})),...Array.from({length:15},(_,i)=>({key:'p'+(i+1),label:'تولید '+(i+5),type:'number' as const})),{key:'scrap',label:'اسقاط',type:'number'}],initial:['وام بلندمدت اول','وام بلندمدت دوم','وام بلندمدت سوم','وام کوتاه‌مدت'].flatMap(loan=>['برداشت','بازپرداخت','مانده بدهی','تعدیل نرخ ارز','بهره سرمایه‌ای','بهره پرداختی','سایر هزینه مالی'].map(flow=>({loan,flow,total:0,...Object.fromEntries([...Array.from({length:4},(_,i)=>['c'+(i+1),0]),...Array.from({length:15},(_,i)=>['p'+(i+1),0]),['scrap',0]])})))},
 {id:'br',title:'BR',note:'تجمیع نهایی منابع و مصارف، سرمایه‌گذاری، سرمایه در گردش، هزینه عملیاتی، مالیات، هزینه مالی، بازپرداخت و مانده نقد در دوره‌های ساخت و تولید.',columns:[{key:'item',label:'شرح'},...Array.from({length:4},(_,i)=>({key:'c'+(i+1),label:'ساخت '+(i+1),type:'number' as const})),...Array.from({length:15},(_,i)=>({key:'p'+(i+1),label:'تولید '+(i+5),type:'number' as const})),{key:'scrap',label:'اسقاط',type:'number'}],initial:['کل جریان ورودی','منابع مالی','آورده سهامدار','وام بلندمدت','تأمین مالی کوتاه‌مدت','درآمد عملیاتی','سایر درآمد','کل جریان خروجی','افزایش دارایی ثابت','سرمایه‌گذاری ثابت','هزینه‌های پیش از تولید','افزایش دارایی جاری','هزینه عملیاتی','هزینه بازاریابی','مالیات','هزینه مالی','بازپرداخت وام','مازاد/کسری','مانده نقد تجمعی'].map(item=>({item,...Object.fromEntries([...Array.from({length:4},(_,i)=>['c'+(i+1),0]),...Array.from({length:15},(_,i)=>['p'+(i+1),0]),['scrap',0]])}))}
]
const capexSheets:Sheet[]=commonCapex
function makeSheets(kind:Kind){return {capex:capexSheets,opex:commonOpex(kind),finance:financeSheets}}
function makeModel(project:FeasibilityProject,kind:Kind):Model{
 const sheets=makeSheets(kind)
 const tables:Record<string,Row[]>={}
 for(const sheet of [...sheets.capex,...sheets.opex,...sheets.finance])tables[sheet.id]=(sheet.initial??[]).map(row=>({...row,id:id()}))
 const fallbackCapacity=kind==='dri'?1760000:1200000
 const parsed=Number(project.capacity.replace(/[^0-9.]/g,''))||fallbackCapacity
 return {name:project.name,location:project.location,capacity:parsed,currency:'یورو',fxRate:1,startYear:1405,constructionYears:4,operatingYears:15,discountRate:25,taxRate:5,tables,fields:{technology:kind==='dri'?'احیای گازی MIDREX / ENERGIRON / سایر':'EAF / BOF / IF و مسیر پالایش ثانویه',product:kind==='dri'?'آهن اسفنجی DRI':'اسلب / بیلت / بلوم',operatingHours:kind==='dri'?8000:7200,availability:90,metallization:85,carbon:1.5,steelChargeMix:'قابل تعریف بر اساس DRI/قراضه/چدن',casting:'ریخته‌گری مداوم CCM'}}
}
function Editor({sheet,rows,onChange,onSave}:{sheet:Sheet;rows:Row[];onChange:(rows:Row[])=>void;onSave:()=>void}){
 const update=(rowId:string,key:string,value:Cell)=>onChange(rows.map(row=>row.id===rowId?{...row,[key]:value}:row))
 const add=()=>onChange([...rows,{id:id(),...Object.fromEntries(sheet.columns.map(col=>[col.key,col.type==='number'?0:'']))}])
 return <div className="fw-card">
  <div className="fw-card-save-row"><button type="button" className="secondary-button fw-save-button" onClick={onSave}><Save size={14}/> ذخیره این بخش</button></div>
  <div className="fw-card-head"><h3>{sheet.title}</h3><button className="secondary-button" onClick={add}><Plus size={14}/> افزودن ردیف</button></div>
  <div className="fw-hint">{sheet.note}</div>
  <div className="pxw-table-scroll"><table className="pxw-table"><thead><tr>{sheet.columns.map(col=><th key={col.key}>{col.label}{col.unit?' ('+col.unit+')':''}</th>)}<th>حذف</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{sheet.columns.map(col=><td key={col.key}><input aria-label={col.label} type={col.type==='number'?'number':'text'} value={row[col.key]??(col.type==='number'?0:'')} onChange={e=>update(row.id,col.key,col.type==='number'?Number(e.target.value):e.target.value)}/></td>)}<td><button className="icon-button" aria-label="حذف ردیف" onClick={()=>onChange(rows.filter(x=>x.id!==row.id))}><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>
 </div>
}
export default function ProcessExcelWorkspace({project,kind,onBack}:{project:FeasibilityProject;kind:Kind;onBack:()=>void}){
 const key='process-excel:'+kind+':'+project.id+':v1'
 const sheets=useMemo(()=>makeSheets(kind),[kind])
 const [model,setModel]=useState<Model>(()=>makeModel(project,kind))
 const [group,setGroup]=useState<'capex'|'opex'|'finance'>('capex')
 const [selected,setSelected]=useState('land')
 const [ready,setReady]=useState(false)
 const [saved,setSaved]=useState('')
 useEffect(()=>{let alive=true;localStore.get<Model>(key).then(value=>{if(alive){if(value)setModel(value);setReady(true)}}).catch(()=>setReady(true));return()=>{alive=false}},[key])
 useEffect(()=>{if(ready)void localStore.set(key,model).then(()=>setSaved(new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})))},[ready,key,model])
 const groupSheets=sheets[group]
 const active=groupSheets.find(sheet=>sheet.id===selected)??groupSheets[0]
 const setRows=(sheetId:string,rows:Row[])=>setModel(current=>({...current,tables:{...current.tables,[sheetId]:rows}}))
 const saveNow=async()=>{await localStore.set(key,model);setSaved(new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}))}
 const capexTotal=useMemo(()=>sheets.capex.filter(sheet=>sheet.id!=='fixed-investment').reduce((sum,sheet)=>sum+(model.tables[sheet.id]??[]).reduce((a,row)=>a+num(row.amount),0),0),[sheets,model.tables])
 const opexTotal=useMemo(()=>['materials','energy','maintenance','annual-opex'].reduce((sum,key)=>sum+(model.tables[key]??[]).reduce((a,row)=>a+num(row.annualCost??row.amount),0),0),[model.tables])
 const sheetIndex=groupSheets.findIndex(sheet=>sheet.id===active.id)
 const switchGroup=(next:'capex'|'opex'|'finance')=>{setGroup(next);setSelected(makeSheets(kind)[next][0].id)}
 const next=()=>{if(sheetIndex<groupSheets.length-1)setSelected(groupSheets[sheetIndex+1].id);else if(group==='capex')switchGroup('opex');else if(group==='opex')switchGroup('finance')}
 const previous=()=>{if(sheetIndex>0)setSelected(groupSheets[sheetIndex-1].id);else if(group==='finance'){setGroup('opex');setSelected(sheets.opex[sheets.opex.length-1].id)}else if(group==='opex'){setGroup('capex');setSelected(sheets.capex[sheets.capex.length-1].id)}}
 const groupLabel=group==='capex'?'سرمایه‌گذاری ثابت':group==='opex'?'هزینه تولید':'مدل مالی و جریان نقدی'
 const allIndex=[...sheets.capex,...sheets.opex,...sheets.finance].findIndex(sheet=>sheet.id===active.id)
 const totalCount=sheets.capex.length+sheets.opex.length+sheets.finance.length
 return <section className="fw-page pxw-page" dir="rtl">
  <header className="fw-head"><button className="secondary-button" onClick={onBack}><ArrowRight size={16}/> پروژه‌ها</button><div><span className="eyebrow">PISHRAN / {kind==='dri'?'DIRECT REDUCTION':'STEELMAKING & CASTING'}</span><h1>{model.name}</h1><p>{model.location} · {kind==='dri'?'پروژه مستقل احیای مستقیم':'پروژه مستقل فولادسازی، ذوب و ریخته‌گری'}</p></div><span className="fw-save"><Save size={14}/>{ready?(saved?'ذخیره محلی · '+saved:'ذخیره خودکار فعال'):'در حال بارگذاری'}</span></header>
  <div className="pxw-intro"><Info size={18}/><div><b>ساختار فرم‌ها مطابق ترتیب شیت‌های اکسل مرجع</b><p>این پروژه به‌صورت مستقل ذخیره می‌شود. هیچ داده، ظرفیت، هزینه یا جریان نقدی از پروژه احیاء به فولادسازی یا برعکس منتقل نمی‌شود. مقادیر فنی اولیه فقط ردیف‌های مرجع همان بخش از فایل «هزینه تولید» هستند؛ CAPEX و جریان نقدی خالی و مختص همین پروژه‌اند.</p></div></div>
  <div className="pxw-kpis"><article><small>ظرفیت اسمی پروژه</small><b>{fmt(model.capacity)} تن/سال</b></article><article><small>جمع CAPEX ثبت‌شده</small><b>{fmt(capexTotal)} {model.currency}</b></article><article><small>هزینه تولید ثبت‌شده</small><b>{fmt(opexTotal)} {model.currency}</b></article><article><small>ذخیره‌سازی</small><b>{ready?'محلی و مستقل':'در حال آماده‌سازی'}</b></article></div>
  <nav className="pxw-groups">{([{id:'capex',label:'۱. سرمایه‌گذاری ثابت · ۹ شیت'},{id:'opex',label:'۲. هزینه تولید · ۱۲ شیت'},{id:'finance',label:'۳. مدل مالی و جریان نقدی · ۹ شیت'}] as const).map(item=><button key={item.id} className={group===item.id?'active':''} onClick={()=>switchGroup(item.id)}>{item.label}</button>)}</nav>
  <div className="pxw-sheetbar"><span>{groupLabel}</span><div>{groupSheets.map((sheet,index)=><button key={sheet.id} className={active.id===sheet.id?'active':''} onClick={()=>setSelected(sheet.id)}><small>{fmt(index+1)}</small>{sheet.title}</button>)}</div></div>
  <main className="fw-content pxw-content">
   <div className="pxw-sheet-heading"><div><span className="eyebrow">SHEET {fmt(allIndex+1)} / {fmt(totalCount)}</span><h2>{active.title}</h2></div><span>{groupLabel}</span></div>
   {active.id==='title'||active.id==='project-funding'?<div className="fw-card"><div className="fw-grid">
    {active.id==='title'?<><label className="fw-field"><span>عنوان پروژه</span><input value={model.name} onChange={e=>setModel(x=>({...x,name:e.target.value}))}/></label><label className="fw-field"><span>محل اجرا</span><input value={model.location} onChange={e=>setModel(x=>({...x,location:e.target.value}))}/></label><label className="fw-field"><span>ظرفیت اسمی</span><input type="number" value={model.capacity} onChange={e=>setModel(x=>({...x,capacity:Number(e.target.value)}))}/></label><label className="fw-field"><span>واحد پول</span><select value={model.currency} onChange={e=>setModel(x=>({...x,currency:e.target.value}))}><option>یورو</option><option>دلار آمریکا</option><option>ریال</option><option>تومان</option><option>میلیون ریال</option></select></label><label className="fw-field"><span>نرخ تبدیل به ارز مبنا</span><input type="number" value={model.fxRate} onChange={e=>setModel(x=>({...x,fxRate:Number(e.target.value)}))}/></label><label className="fw-field"><span>سال شروع</span><input type="number" value={model.startYear} onChange={e=>setModel(x=>({...x,startYear:Number(e.target.value)}))}/></label><label className="fw-field"><span>دوره ساخت</span><input type="number" value={model.constructionYears} onChange={e=>setModel(x=>({...x,constructionYears:Number(e.target.value)}))}/></label><label className="fw-field"><span>عمر بهره‌برداری</span><input type="number" value={model.operatingYears} onChange={e=>setModel(x=>({...x,operatingYears:Number(e.target.value)}))}/></label><label className="fw-field"><span>نرخ تنزیل</span><input type="number" value={model.discountRate} onChange={e=>setModel(x=>({...x,discountRate:Number(e.target.value)}))}/></label><label className="fw-field"><span>نرخ مالیات</span><input type="number" value={model.taxRate} onChange={e=>setModel(x=>({...x,taxRate:Number(e.target.value)}))}/></label></>:<Editor sheet={active} rows={model.tables[active.id]??[]} onChange={rows=>setRows(active.id,rows)} onSave={()=>void saveNow()}/>}
   </div></div>:active.id==='project-funding'?null:<Editor sheet={active} rows={model.tables[active.id]??[]} onChange={rows=>setRows(active.id,rows)} onSave={()=>void saveNow()}/>}
   {active.id==='materials'||active.id==='energy'?<div className="fw-result">مبنای تولید سالانه: <b>{fmt(model.capacity)} تن</b>. مقدار سالیانه هر ردیف و هزینه سالیانه را مطابق موازنه و قیمت‌های پروژه تکمیل کنید.</div>:null}
   {active.id==='fixed-investment'?<div className="fw-result">جمع سرمایه‌گذاری ثبت‌شده در شیت‌های قبل: <b>{fmt(capexTotal)} {model.currency}</b></div>:null}
   {active.id==='annual-opex'?<div className="fw-result">جمع اقلام هزینه جاری ثبت‌شده: <b>{fmt(opexTotal)} {model.currency}</b></div>:null}
  </main>
  <footer className="fw-footer"><button className="secondary-button" onClick={previous} disabled={allIndex===0}><ArrowRight size={15}/> شیت قبلی</button><span>شیت {fmt(allIndex+1)} از {fmt(totalCount)} · ترتیب فایل‌های اکسل حفظ شده است</span><button className="primary" onClick={next} disabled={allIndex===totalCount-1}>شیت بعدی <ArrowLeft size={15}/></button></footer>
 </section>
}
