import {useEffect,useMemo,useState} from 'react'
import {ArrowRight,Save,Plus,Trash2,ChevronLeft,Factory,FileSpreadsheet,Calculator} from 'lucide-react'
import {localStore} from '../../core/storage/localStore'
import type {FeasibilityProject} from '../../core/projects/projectRepository'

type PlantType='dri'|'steelmaking'
type Cell=string|number
type Row={id:string;label:string;values:Record<string,Cell>}
type Column={key:string;label:string;unit?:string;numeric?:boolean}
type Sheet={id:string;title:string;book:'capex'|'opex'|'finance';columns:Column[];rows:string[];note?:string;readOnly?:boolean}
const c=(key:string,label:string,unit='',numeric=false):Column=>({key,label,unit,numeric})
const capexCols=[c('qty','مقدار','',true),c('unit','واحد'),c('unitPrice','هزینه واحد','یورو',true),c('equipment','هزینه تجهیزات','یورو',true),c('allocation','سهم تخصیص به پروژه','٪',true),c('year','سال انجام','',true)]
const costCols=[c('specific','مصرف ویژه','',true),c('unit','واحد'),c('price','قیمت واحد','یورو',true),c('annualQty','مقدار سالیانه','',true),c('annualCost','هزینه سالیانه','یورو',true)]
const financeCols=[c('rate','نرخ / درصد','٪',true),c('grace','دوره تنفس','سال',true),c('term','دوره بازپرداخت','سال',true),c('notes','توضیحات')]
const years=Array.from({length:20},(_,i)=>c('y'+(i+1),'سال '+(i+1),'یورو',true))
const hrCols=[c('expert','کارشناس','نفر',true),c('technician','تکنسین','نفر',true),c('secretary','منشی','نفر',true),c('operator','کارگر فنی','نفر',true),c('driver','راننده','نفر',true),c('laborer','کارگر ساده','نفر',true)]
const genericCols=[c('amount','مبلغ / مقدار','یورو',true),c('rate','نرخ / درصد','٪',true),c('year','سال','',true),c('notes','توضیحات')]
const baseRows=[
'زمین و محوطه اختصاصی پروژه','محوطه و آماده‌سازی سایت','ساختمان‌ها و سیویل غیرصنعتی','تأسیسات زیربنایی و واحدهای جنبی','وسائط نقلیه','وسایل اداری و خدماتی','هزینه‌های قبل از بهره‌برداری'
]
const sharedCapexRows={
 land:['خرید زمین'],
 site:['نقشه‌برداری و مطالعات ژئوتکنیک','تسطیح و خاکبرداری','خیابان‌کشی داخلی و آسفالت','ایجاد فضای سبز','جمع‌آوری آب‌های سطحی','کانال کنترل سیلاب','روشنایی','دیوارکشی','جاده دسترسی','درب ورودی و نگهبانی'],
 buildings:['تعمیرگاه مرکزی','آزمایشگاه مرکزی','ساختمان‌های اداری + تجهیزات','مجموعه غذاخوری + تجهیزات','مجموعه آشپزخانه + تجهیزات','مهمانسرا + تجهیزات','سالن اجتماعات + تجهیزات','دوش، رختکن و سرویس‌های بهداشتی','مجموعه HSE و آتش‌نشانی + تجهیزات','نگهبانی و سردر + تجهیزات','ساختمان توزین + تجهیزات','بهداری + تجهیزات','موتورخانه تأسیسات','پارکینگ','پمپ بنزین','مسجد'],
 vehicles:['لودر','لیفتراک ۳ تن','لیفتراک ۵ تن','پالفینگر','کامیون کمپرسی','ماشین آتش‌نشانی','آمبولانس','ماشین تانکر آب'],
 infrastructure:['گاز - حق انشعاب','گاز - انتقال و توزیع','آب - حق انشعاب','آب - هزینه انتقال','برق - حق انشعاب','برق - پست ۲۳۰/۳۳ کیلوولت','برق - انتقال و توزیع','اکسیژن - حق انشعاب','اکسیژن - هزینه انتقال','حق انشعاب تلفن و نرم‌افزار','باسکول'],
 office:['کامپیوتر','تلفن مرکزی','تلفن','تجهیزات اداری','مبلمان غذاخوری','تجهیزات آشپزخانه','سایر تجهیزات'],
 preop:['مطالعات اولیه تا تصمیم‌گیری','مشاور مادر و همراهی مدیریت پروژه','هزینه کارگاهی دوران ساخت','هزینه دفتر مرکزی دوران ساخت','بیمه ریسک پروژه','هزینه اخذ وام توسط بانک عامل','سایر هزینه‌های پیش‌بینی‌نشده']
}
const machineRows=['دانش فنی و مجوزات','طراحی و مهندسی','ساخت و تأمین تجهیزات','تجهیزات فرایندی','تجهیزات برقی','تجهیزات ابزاردقیق، کنترل و اتوماسیون','سیستم‌های جانبی','حمل و نقل','تأمین مواد مصرفی ۶ ماهه جهت راه‌اندازی','قطعات یدکی دو سالانه','انجام کارهای سیویل و اسکلت فلزی','نصب تجهیزات مکانیکی، برقی، ابزار دقیق و اتوماسیون','راه‌اندازی سرد و گرم','کنترل پروژه و نظارت','آموزش']
const driMaterials=['گندله','حمل داخلی گندله','آهک پخته','کاتالیست','لوله‌های ریفورمر','مواد شیمیایی','روغن و گریس']
const steelMaterials=['قراضه قابل خرید با کسر قراضه برگشتی','حمل قراضه','دولومیت پخته','فرومنگنز پرکربن','فروسیلیسوم','آلومینیوم گرانوله','کک','پودر کربن','فلورین','آهک پخته','GUNNING MIXTURE','الکترود گرافیتی','نسوز کوره‌های قوس و پاتیلی','نسوز تاندیش','نسوز تعمیرات موضعی','پودر تاندیش','رابط مجرای خروجی مذاب','پودر قالب','نازل انتقال مذاب','میله متوقف‌کننده مذاب','قالب مسی ریخته‌گری مداوم','لوله اکسیژن‌کاری','روغن هیدرولیک و گریس','ترموکوپل','نیکل - گرید دریایی','مس - گرید دریایی','فروکروم ۶۵٪ - گرید دریایی','فرومنگنز کم‌کربن - گرید API','فرومولیبدن ۶۰٪ - گرید API','فرونایوبیوم ۶۶٪ - گرید API','فرووانادیم ۶۰٪ - گرید API','فروتیتانیوم ۷۰٪ - گرید API','مواد آلیاژی گرید مخازن تحت فشار']
const driEnergy=['آب صنعتی','آب شرب','برق مصرفی','اکسیژن گازی','گاز صنعتی']
const steelEnergy=['آب صنعتی','آب شرب','برق مصرفی','اکسیژن گازی','گاز صنعتی']
const staffShared=['دفتر مدیریت','روابط عمومی']
const staffDri=['بهره‌برداری احیاء مستقیم','تعمیرات احیاء مستقیم','تعمیرگاه احیاء','تأسیسات و پشتیبانی احیاء','برنامه‌ریزی تولید احیاء']
const staffSteel=['بهره‌برداری فولادسازی','تعمیرات فولادسازی','تعمیرگاه فولادسازی','تأسیسات و پشتیبانی فولادسازی','برنامه‌ریزی تولید فولادسازی']
const staffOther=['خرید','فروش','انبارها','اداری و مالی','خدمات','سیستم‌های اطلاعاتی','کنترل فنی','مطالعات و برنامه‌ریزی استراتژیک','پشتیبانی فنی','تضمین کیفیت','کنترل کیفیت','توسعه']
const payrollRows=['مدیر و معاون','رئیس و سرپرست','کارشناس','تکنسین','کارمند دفتری و منشی','کارگر فنی و راننده','کارگر ساده']
const depreciationRows=['هزینه‌های آماده‌سازی سایت','ساختمان‌ها و سیویل غیرصنعتی','ماشین‌آلات و تجهیزات','تأسیسات زیربنایی','وسائط نقلیه','تجهیزات و وسایل اداری و خدماتی','هزینه‌های قبل از بهره‌برداری','سایر هزینه‌ها']
const annualOpexRows=['مواد اولیه','نیروی انسانی','سربار نیروی انسانی','تعمیر و نگهداری','استهلاک','آب، برق و گاز','سایر هزینه‌ها (۵٪ هزینه‌ها به غیر از مواد اولیه)']
const salesRowsDri=['آهن اسفنجی قابل فروش / مازاد تولید']
const salesRowsSteel=['تختال جهت ورق‌های دریایی','تختال جهت ورق‌های تولید لوله','تختال جهت مخازن تحت فشار','تختال جهت ورق‌های ساختمانی']
const breakEvenRows=['مواد اولیه','دستمزد','هزینه آب و برق و گاز','تعمیر و نگهداری','استهلاک','هزینه‌های متفرقه']
const sensitivityRows=['درآمد فروش','هزینه‌های سرمایه‌گذاری ثابت','هزینه‌های عملیاتی','نرخ تنزیل کل پروژه']
const resultRows=['سرمایه‌گذاری ثابت طرح','سرمایه در گردش در ظرفیت کامل','بهره وام‌های بانکی','هزینه‌های قبل از بهره‌برداری','جمع کل سرمایه‌گذاری','متوسط قیمت تمام‌شده محصول','متوسط قیمت فروش محصول','سود سالانه طرح در ظرفیت کامل','دوره بازگشت سرمایه کل','دوره بازگشت سرمایه داینامیک','نرخ تنزیل','NPV','IRR','IRRE']
const debtRows=['وام بانک ملی هامبورگ ۱','وام بانک ملی هامبورگ ۲','وام بانک ملی هامبورگ ۳','وام بانک ملی هامبورگ ۴','وام بانک تجارت ۱','وام بانک تجارت ۲','وام بانک تجارت ۳','وام بانک تجارت ۴']
const cashFlowRows=['سود عملیاتی / درآمد فروش محصول','موجودی اول دوره','درآمد فروش محصول','وام‌های بلندمدت','وام‌های کوتاه‌مدت / سرمایه در گردش','آورده نقدی سهامدار','جمع کل منابع مالی','هزینه‌های ثابت سرمایه‌گذاری','سرمایه در گردش موردنیاز','هزینه‌های تولید','مالیات','بهره وام‌ها','بازپرداخت اصل وام‌ها','جمع کل مصارف','سود / سود قابل تقسیم','آورده نقدی سهامدار قابل کسر','سود قابل تقسیم بین سهامداران','موجودی نقد پایان دوره']
function makeSheet(id:string,title:string,book:Sheet['book'],columns:Column[],rows:string[],note?:string,readOnly=false):Sheet{return{id,title,book,columns,rows,note,readOnly}}
function definitions(type:PlantType):Sheet[]{
 const dri=type==='dri',unitName=dri?'احیاء مستقیم':'فولادسازی و ریخته‌گری'
 const capex=[
 makeSheet('land','خرید زمین','capex',capexCols,sharedCapexRows.land,'شیت ۱ فایل سرمایه‌گذاری ثابت؛ هزینه‌های مشترک فقط با سهم تخصیص مصوب به این پروژه منظور شوند.'),
 makeSheet('site','محوطه‌سازی','capex',capexCols,sharedCapexRows.site,'شیت ۲؛ زمان انجام هر قلم را در ستون سال ثبت کنید.'),
 makeSheet('buildings','ساختمان‌ها','capex',[...capexCols,c('shareNote','توضیح سهم اشتراک')],sharedCapexRows.buildings,'شیت ۳؛ سهم هزینه قابل تخصیص به پروژه باید صریح ثبت شود.'),
 makeSheet('machines','ماشین‌آلات','capex',[c('foreign','بخش ارزی','یورو',true),c('local','بخش ریالی معادل یورو','یورو',true),c('year','سال پرداخت','',true),c('notes','توضیحات')],machineRows,'شیت ۴؛ در این فایل ستون‌های احیاء، ذوب، ریخته‌گری و انباشت/برداشت جدا هستند. در فرم مستقل فقط ستون مربوط به این واحد و اقلام مشترک تخصیص‌یافته ثبت می‌شود.'),
 makeSheet('vehicles','وسائط نقلیه','capex',capexCols,sharedCapexRows.vehicles,'شیت ۵؛ اقلام مشترک را با سهم تخصیص پروژه ثبت کنید.'),
 makeSheet('infrastructure','تأسیسات زیربنایی','capex',[c('type','نوع خدمت'),c('component','جزء هزینه'),c('amount','هزینه','یورو',true),c('allocation','سهم تخصیص به پروژه','٪',true)],sharedCapexRows.infrastructure,'شیت ۶؛ گاز، آب، برق، اکسیژن و خدمات مشترک.'),
 makeSheet('office','وسایل اداری','capex',[c('amount','هزینه','یورو',true),c('allocation','سهم تخصیص به پروژه','٪',true),c('notes','توضیحات')],sharedCapexRows.office,'شیت ۷؛ هزینه‌های مشترک را بین پروژه‌ها دوباره‌شماری نکنید.'),
 makeSheet('preop','قبل از بهره‌برداری','capex',[c('amount','مبلغ','یورو',true),c('phase','مرحله انجام'),c('allocation','سهم تخصیص به پروژه','٪',true),c('notes','توضیحات')],sharedCapexRows.preop,'شیت ۸؛ مطالعه، مشاور مادر، کارگاه، دفتر مرکزی، بیمه و هزینه اخذ وام.'),
 makeSheet('fixed-summary','سرمایه‌گذاری ثابت طرح','capex',[c('amount','مبلغ نهایی','یورو',true),c('share','سهم از کل','٪',true),c('source','شیت مبنا')],[...baseRows,'هزینه‌های متفرقه و پیش‌بینی‌نشده','جمع هزینه‌های ثابت','هزینه‌های قبل از بهره‌برداری','جمع کل'],'شیت ۹؛ خلاصه تجمیعی. جمع این شیت باید از شیت‌های قبلی محاسبه شود.',true)
 ]
 const opex=[
 makeSheet('materials','مواد خام','opex',costCols,dri?driMaterials:steelMaterials,'شیت ۱؛ مقادیر مصرف ویژه بر حسب واحد تولید همان پروژه ثبت شود. اقلام آلیاژی فولادسازی بر اساس گرید محصول تکمیل شوند.'),
 makeSheet('energy','انرژی','opex',costCols,dri?driEnergy:steelEnergy,'شیت ۲؛ آب شرب در فایل بر مبنای مصرف ساعتی است؛ واحد مصرف هر قلم را دقیق وارد کنید.'),
 makeSheet('maintenance','تعمیر و نگهداری','opex',[c('asset','دارایی / گروه سرمایه‌ای'),c('capitalBase','سرمایه مشمول','یورو',true),c('rate','درصد تعمیرات','٪',true),c('annualCost','هزینه سالیانه','یورو',true)],['ساختمان و سیویل غیرصنعتی','ماشین‌آلات','تأسیسات زیربنایی و واحدهای جنبی','وسائط نقلیه','تجهیزات و وسایل اداری و خدماتی'],'شیت ۳؛ نرخ‌های فایل مرجع برای هر دارایی باید به‌عنوان مفروضه پروژه بازبینی شوند.'),
 makeSheet('staff','نیروی انسانی','opex',hrCols,[...staffShared,...(dri?staffDri:staffSteel),...staffOther],'شیت ۴؛ این فرم فقط واحد منتخب را نگه می‌دارد. مدیریت و واحدهای پشتیبانی در پروژه مستقل همین پروژه منظور می‌شوند.'),
 makeSheet('payroll','حقوق و دستمزد','opex',[c('count','تعداد نفر','نفر',true),c('salary','حقوق ماهانه هر نفر','یورو',true),c('insurance','بیمه ماهانه هر نفر','یورو',true),c('overtime','اضافه‌کاری ماهانه','یورو',true),c('bonus','عیدی و پاداش سالانه','یورو',true),c('seniority','سنوات سالانه','یورو',true)],payrollRows,'زیرجدول شیت ۴؛ هزینه سربار نیروی انسانی طبق فایل مرجع ۲۰٪ است و در محاسبات قابل بازبینی خواهد بود.'),
 makeSheet('depreciation','استهلاک','opex',[c('capitalBase','سرمایه مشمول استهلاک','یورو',true),c('rate','نرخ استهلاک','٪',true),c('scrap','نرخ قراضه / ارزش اسقاط','٪',true),c('annual','استهلاک سالیانه','یورو',true)],depreciationRows,'شیت ۵؛ مبنای استهلاک از اقلام سرمایه‌گذاری ثابت مرتبط با همین پروژه گرفته شود.'),
 makeSheet('annual-opex','هزینه‌های جاری سالیانه','opex',[c('annualCost','هزینه سالیانه','یورو',true),c('share','درصد از کل هزینه','٪',true),c('source','شیت مبنا')],annualOpexRows,'شیت ۶؛ جمع هزینه‌ها از شیت‌های مواد، نیروی انسانی، تعمیرات، استهلاک و انرژی استخراج می‌شود.'),
 makeSheet('sales','قیمت فروش','opex',[c('product','محصول / گرید'),c('price','قیمت هر تن','یورو/تن',true),c('mix','سهم تولید','٪',true),c('annualQty','مقدار تولید سالانه','تن',true),c('annualRevenue','درآمد سالانه','یورو',true)],dri?salesRowsDri:salesRowsSteel,'شیت ۷؛ پروژه احیاء فقط محصول آهن اسفنجی قابل فروش را ثبت می‌کند؛ فولادسازی محصولات اسلب/تختال را.'),
 makeSheet('break-even','سر به سری','opex',[c('variable','درصد متغیر','٪',true),c('fixed','درصد ثابت','٪',true),c('annualCost','هزینه مبنا','یورو',true)],breakEvenRows,'شیت ۸؛ درصد ثابت و متغیر هر ردیف باید جمعاً ۱۰۰٪ باشد.'),
 makeSheet('results','نتایج','opex',[c('value','نتیجه','',true),c('unit','واحد'),c('source','مبنای محاسبه')],resultRows,'شیت ۹؛ نتایج از مدل پروژه مستقل محاسبه خواهند شد.',true),
 makeSheet('sensitivity','حساسیت','opex',[c('change','تغییر عامل','٪',true),c('sales','تغییر درآمد / IRR','',true),c('capex','تغییر CAPEX / IRR','',true),c('opex','تغییر OPEX / IRR','',true),c('discount','نرخ تنزیل','٪',true)],Array.from({length:11},(_,i)=>String(-20+i*4)),'شیت ۱۰؛ ماتریس حساسیت درآمد، سرمایه‌گذاری ثابت، هزینه عملیاتی و نرخ تنزیل.'),
 makeSheet('comfar','نتایج کامفار','opex',[c('section','بخش'),c('metric','شاخص'),c('value','مقدار'),c('unit','واحد')],['هزینه‌های سرمایه‌گذاری','منابع مالی','درآمد و هزینه‌های عملیاتی','نسبت‌ها و شاخص‌های بازده'],'شیت ۱۱؛ محل ثبت/مقایسه خروجی مرجع COMFAR؛ داده‌های خروجی تا زمان اتصال موتور مالی صرفاً مرجع هستند.',true),
 makeSheet('energy-sensitivity','حساسیت نرخ انرژی','opex',[c('energyChange','تغییر نرخ انرژی','٪',true),c('irr','نرخ بازده داخلی','٪',true),c('discount','نرخ تنزیل','٪',true)],Array.from({length:9},(_,i)=>String(-80+i*20)),'شیت ۱۲؛ حساسیت نرخ بازده به تغییر قیمت انرژی.')
 ]
 const finance=[
 makeSheet('title','عنوان','finance',[c('value','شرح / مقدار')],['عنوان پروژه','شرح پروژه','تاریخ مبنا','واحد پول حسابداری','واحد پول محلی'],'شیت ۱ فایل مدل مالی و جریان نقدی.'),
 makeSheet('project','پروژه','finance',[...financeCols,...years],['آورده نقدی سهامدار','وام بانک ملی هامبورگ - ارزی','وام بانک ملی هامبورگ - ریالی','وام بانک تجارت','جمع منابع مالی'],'شیت ۲؛ زمان‌بندی منابع مالی دوران ساخت.'),
 makeSheet('inflow','جریان ورودی','finance',[...financeCols,...years],['آورده نقدی سهامدار','وام بلندمدت - بانک ملی هامبورگ ارزی','وام بلندمدت - بانک ملی هامبورگ ریالی','وام بلندمدت - بانک تجارت','کل تأمین مالی بلندمدت','وام کوتاه‌مدت سرمایه در گردش','کل تأمین مالی کوتاه‌مدت','کل جریانات نقدی مالی'],'شیت ۳؛ ورود تسهیلات و بازپرداخت اصل.'),
 makeSheet('sl-flow','جریان SL','finance',[...years],['کل حقوق صاحبان سهام','کل وام‌های بلندمدت','کل تأمین مالی کوتاه‌مدت','ارزش قراضه'],'شیت ۴؛ جریانات نقدی مالی سهامدار و بدهی.'),
 makeSheet('sl-debt','بدهی SL','finance',[...years],['بدهی بلندمدت','بدهی کوتاه‌مدت','ارزش قراضه'],'شیت ۵؛ مانده بدهی‌ها به تفکیک دوره.'),
 makeSheet('loans','وام‌ها','finance',[...years],['وام بانک ملی هامبورگ - دریافت','وام بانک ملی هامبورگ - بازپرداخت اصل','وام بانک ملی هامبورگ - مانده بدهی','وام بانک ملی هامبورگ - بهره پرداختی','وام بانک تجارت - دریافت','وام بانک تجارت - بازپرداخت اصل','وام بانک تجارت - مانده بدهی','وام بانک تجارت - بهره پرداختی','وام سرمایه در گردش - دریافت','وام سرمایه در گردش - بازپرداخت اصل','کل جریانات نقدی وام‌ها'],'شیت ۶؛ اصل، فرع و مانده هر تسهیلات.'),
 makeSheet('total-cashflow','جریان نقدی کل','finance',[...years],cashFlowRows,'شیت ۷؛ جریان ورودی، مصارف، سود قابل تقسیم و موجودی نقد پایان دوره.'),
 makeSheet('debt-service','Debt Service','finance',[...years],debtRows.flatMap(x=>[x+' - Disbursement',x+' - Repayment',x+' - Debt balance',x+' - Exchange rate adjustments',x+' - Capitalized interest',x+' - Interest payable',x+' - Other financial costs']).concat(['جمع دریافت','جمع بازپرداخت','مانده کل بدهی','تعدیلات نرخ ارز','بهره سرمایه‌ای','بهره پرداختنی','سایر هزینه‌های مالی']),'شیت ۸؛ ساختار خدمات بدهی به تفکیک تسهیلات و دوره.'),
 makeSheet('br','BR','finance',[...years],['TOTAL CASH INFLOW','Inflow funds','Total equity capital','Total long-term loans','Total short-term finance','Inflow operation','Other income','TOTAL CASH OUTFLOW','Increase in fixed assets','Fixed investments','Pre-production expenditures','Increase in current assets','Operating costs','Marketing costs','Income (corporate) tax','Financial costs','Loan repayment','Dividends','Equity capital refund','SURPLUS (DEFICIT)','CUMULATIVE CASH BALANCE','Foreign surplus (deficit)','Local surplus (deficit)','Foreign cumulative cash balance','Local cumulative cash balance','Net flow of funds'],'شیت ۹؛ صورت جریان وجوه نقد با عناوین فایل مرجع.')
 ]
 return [...capex,...opex,...finance]
}
const makeRows=(sheet:Sheet):Row[]=>sheet.rows.map((label,i)=>({id:sheet.id+'-'+i,label,values:Object.fromEntries(sheet.columns.map(col=>[col.key,col.numeric?0:'']))}))
const fmt=(v:number)=>Number(v||0).toLocaleString('fa-IR',{maximumFractionDigits:2})
export default function ProcessPlantWorkspace({project,plantType,onBack}:{project:FeasibilityProject;plantType:PlantType;onBack:()=>void}){
 const sheets=useMemo(()=>definitions(plantType),[plantType]),key='process-plant:'+plantType+':'+project.id+':excel-sequence-v1'
 const [data,setData]=useState<Record<string,Row[]>>({}),[selected,setSelected]=useState(sheets[0].id),[ready,setReady]=useState(false),[saved,setSaved]=useState('')
 useEffect(()=>{let alive=true;localStore.get<Record<string,Row[]>>(key).then(v=>{if(alive){setData(v??{});setReady(true)}}).catch(()=>setReady(true));return()=>{alive=false}},[key])
 useEffect(()=>{if(ready)void localStore.set(key,data).then(()=>setSaved(new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})))},[ready,key,data])
 const current=sheets.find(x=>x.id===selected)??sheets[0],rows=data[current.id]??makeRows(current)
 const updateRows=(next:Row[])=>setData(old=>({...old,[current.id]:next}))
 const updateCell=(id:string,key:string,value:Cell)=>updateRows(rows.map(row=>row.id===id?{...row,values:{...row.values,[key]:value}}:row))
 const addRow=()=>updateRows([...rows,{id:current.id+'-custom-'+Date.now(),label:'ردیف جدید',values:Object.fromEntries(current.columns.map(col=>[col.key,col.numeric?0:'']))}])
 const capexTotal=Object.entries(data).filter(([id])=>sheets.find(x=>x.id===id)?.book==='capex').flatMap(([,list])=>list).reduce((sum,row)=>{const v=row.values;const amount=Number(v.amount??0)||Number(v.annualCost??0)||((Number(v.qty??0)*Number(v.unitPrice??0)+Number(v.equipment??0))*(Number(v.allocation??100)/100));return sum+amount},0)
 const bookGroups=[{id:'capex',title:'۱. سرمایه‌گذاری ثابت',subtitle:'سرمایه گذاری ثابت.xlsx',items:sheets.filter(x=>x.book==='capex')},{id:'opex',title:'۲. هزینه تولید و بهره‌برداری',subtitle:'هزینه تولید.xlsx',items:sheets.filter(x=>x.book==='opex')},{id:'finance',title:'۳. مدل مالی و جریان نقدی',subtitle:'مدل مالی و جریان نقدی.xlsx',items:sheets.filter(x=>x.book==='finance')}]
 return <section className="fw-page ppw-page" dir="rtl">
  <header className="fw-head"><button className="secondary-button" onClick={onBack}><ArrowRight size={16}/> پروژه‌ها</button><div><span className="eyebrow">PISHRAN / {plantType==='dri'?'DIRECT REDUCTION':'STEELMAKING & CONTINUOUS CASTING'}</span><h1>{project.name}</h1><p>{project.location||'موقعیت ثبت نشده'} · {project.capacity||'ظرفیت ثبت نشده'} · فرم مستقل {plantType==='dri'?'احیاء مستقیم':'فولادسازی و ریخته‌گری'}</p></div><span className="fw-save"><Save size={14}/>{ready?(saved?'ذخیره محلی · '+saved:'ذخیره خودکار فعال'):'در حال بارگذاری'}</span></header>
  <div className="ppw-intro"><FileSpreadsheet size={20}/><div><b>ساختار فرم‌ها بر اساس توالی شیت‌های فایل‌های Excel</b><p>ترتیب شیت‌ها حفظ شده است. اطلاعات هر پروژه در فضای ذخیره‌سازی مستقل نگهداری می‌شود؛ هیچ داده‌ای بین پروژه احیاء و فولادسازی به‌صورت خودکار مشترک نیست.</p></div></div>
  <div className="ppw-summary"><article><small>شیت‌های سرمایه‌گذاری ثابت</small><b>۹</b></article><article><small>شیت‌های هزینه تولید</small><b>۱۲</b></article><article><small>شیت‌های مدل مالی</small><b>۹</b></article><article><small>جمع ثبت‌شده در جدول‌های CAPEX</small><b>{fmt(capexTotal)} <small>یورو</small></b></article></div>
  <div className="ppw-layout"><aside className="ppw-nav">{bookGroups.map(group=><section key={group.id}><div className="ppw-nav-head"><b>{group.title}</b><small>{group.subtitle}</small></div>{group.items.map((sheet,index)=><button key={sheet.id} className={selected===sheet.id?'active':''} onClick={()=>setSelected(sheet.id)}><span>{String(index+1).padStart(2,'0')}</span>{sheet.title}{selected===sheet.id&&<ChevronLeft size={15}/>}</button>)}</section>)}</aside>
   <main className="ppw-sheet"><div className="ppw-sheet-head"><div><span className="eyebrow">{current.book==='capex'?'CAPEX':current.book==='opex'?'OPEX':'FINANCIAL MODEL'} / SHEET {String(sheets.filter(x=>x.book===current.book).findIndex(x=>x.id===current.id)+1).padStart(2,'0')}</span><h2>{current.title}</h2></div><span className="ppw-count">{fmt(rows.length)} ردیف</span></div>
    {current.note&&<div className="ppw-note"><Calculator size={16}/>{current.note}</div>}
    {current.id==='title'&&<div className="fw-grid"><label className="fw-field"><span>نام پروژه</span><input value={project.name} readOnly/></label><label className="fw-field"><span>مرحله مستقل</span><input value={plantType==='dri'?'احیاء مستقیم':'فولادسازی و ریخته‌گری'} readOnly/></label><label className="fw-field"><span>ظرفیت اسمی</span><input value={project.capacity} readOnly/></label><label className="fw-field"><span>موقعیت</span><input value={project.location} readOnly/></label></div>}
    <div className="ppw-table-wrap"><table className="ppw-table"><thead><tr><th className="ppw-label-col">شرح / شاخص</th>{current.columns.map(col=><th key={col.key}>{col.label}{col.unit&&<small>{col.unit}</small>}</th>)}<th>عملیات</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th><input value={row.label} onChange={e=>updateRows(rows.map(x=>x.id===row.id?{...x,label:e.target.value}:x))} aria-label="شرح ردیف"/></th>{current.columns.map(col=><td key={col.key}><input type={col.numeric?'number':'text'} value={row.values[col.key]??(col.numeric?0:'')} onChange={e=>updateCell(row.id,col.key,col.numeric?Number(e.target.value):e.target.value)} aria-label={col.label}/></td>)}<td><button className="icon-button" onClick={()=>updateRows(rows.filter(x=>x.id!==row.id))} title="حذف ردیف"><Trash2 size={14}/></button></td></tr>)}</tbody></table></div>
    {!current.readOnly&&<button className="secondary-button ppw-add" onClick={addRow}><Plus size={15}/> افزودن ردیف</button>}
    {current.readOnly&&<div className="ppw-note">این شیت از نوع خلاصه/نتیجه است. مقادیر نهایی باید از محاسبات شیت‌های مبنا تغذیه شوند؛ ورود دستی در این مرحله غیرفعال است.</div>}
    <div className="ppw-footer"><span>فایل مبنا: {bookGroups.find(x=>x.id===current.book)?.subtitle}</span><div><button className="secondary-button" disabled={sheets.findIndex(x=>x.id===current.id)===0} onClick={()=>setSelected(sheets[Math.max(0,sheets.findIndex(x=>x.id===current.id)-1)].id)}>شیت قبل</button><button className="primary" disabled={sheets.findIndex(x=>x.id===current.id)===sheets.length-1} onClick={()=>setSelected(sheets[Math.min(sheets.length-1,sheets.findIndex(x=>x.id===current.id)+1)].id)}>شیت بعد <ChevronLeft size={15}/></button></div></div>
   </main>
  </div>
 </section>
}
