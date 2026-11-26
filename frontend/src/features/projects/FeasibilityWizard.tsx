import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Save, CheckCircle2, AlertCircle, Printer } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import type { FeasibilityProject } from '../../core/projects/projectRepository'
import ComfarReferencePanel from './ComfarReferencePanel'
import { COMFAR_PROJECT_INPUTS } from './comfarProjectInputData'
import { calculateNpv as npv, calculateIrr as irr, calculateMirr as mirr, buildComfarDepreciationAssetsFromFixedInvestmentItems, reconcileFixedInvestmentRegister, type IntegratedFinanceResult, type ComfarDepreciationAssetInput, type ComfarAssetSaleInput } from '../steel/financialModel'
import AdvancedFinancePanel from './AdvancedFinancePanel'
import type { OneWaySensitivityAnalysis, SensitivityCell } from '../steel/financialModel'
import type { PeriodicProjectFinanceResult, PeriodicFinancialScenarioSet, PeriodicSensitivityCell } from '../steel/periodicFinancialEngine'
import type { PartnerFinanceResult } from './partnerFinance'
import { buildProjectEconomicAnalysis } from './projectEconomicAnalysis'
import type { ValueAddedAnalysisResult } from './projectValueAddedAnalysis'
import type { CppCpsTraceLedger } from './cppCpsCostTraceability'
import type { SalesTaxLedgerResult } from './salesTaxLedger'
import type { IncrementalAnalysisResult } from '../steel/financialModel'
import ExpansionRehabilitationPanel from './ExpansionRehabilitationPanel'
import ProjectFoundationPanel from './ProjectFoundationPanel'
import ProjectModelStructurePanel from './ProjectModelStructurePanel'
import type { ProjectModelFeature } from './projectModelSchema'
import ProjectModelFinancialFormsPanel from './ProjectModelFinancialFormsPanel'
import ProjectModelHelpCoveragePanel from './ProjectModelHelpCoveragePanel'
import { createBlankProjectModelFinancialFormDrafts, mergeProjectModelFinancialFormDrafts, listUnintegratedFinancialDraftInputs, describeUnintegratedFinancialDraftInput, type ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
import FixedInvestmentPanel from './FixedInvestmentPanel'
import { buildProjectCalendarPeriods, createBlankProjectFoundation, mergeProjectFoundation, type ProjectFoundation, type FixedInvestmentItem, type StartingFixedAssetBalance, type StartingFinancialBalanceSummary } from './projectFoundation'

type Row = { id:string; name:string; quantity:number; unit:string; unitPrice:number; source:string; valueText?:string; flowType?:'input'|'output' }
const blankStartingBalanceSummary:StartingFinancialBalanceSummary={cash:0,netWorkingCapital:0,debt:0,paidInCapital:0,retainedEarnings:0,grants:0,currentAccounts:undefined}
type Model = {
  projectCategory:'industrial'|'maritime'|'agricultural'|'infrastructure'|'tourism'|'mining'|'other'
  analysisMode: 'new'|'expansion'|'rehabilitation'|'combined'
  partners: {id:string;name:string;sharePercent:number;capitalContribution:number;profitSharePercent:number}[]
  partnerDistributionPercent: number
  scope: { studyLevel:'opportunity'|'feasibility'; jointVenture:boolean; economicAnalysis:boolean; costCentreAnalysis:boolean; costAllocation:boolean; valueAddedAnalysis:boolean; foreignExchangeEffect:boolean; employmentEffects:boolean }
  foundation: ProjectFoundation
  financialForms: ProjectModelFinancialFormDrafts
  fixedInvestmentItems: FixedInvestmentItem[]
  fixedInvestmentSeedVersion: number
  startingFixedAssets: StartingFixedAssetBalance[]
  project: { name:string; location:string; owner:string; startYear:number; constructionYears:number; operatingYears:number; currency:string; fxRate:number }
  stage: string
  products: Row[]
  capacity: { nameplate:number; operatingDays:number; hoursPerDay:number; availability:number; yield:number; ramp:number[] }
  process: { technology:string; route:string; equipment:string; bottleneck:number; notes:string }
  technical: Row[]
  balance: Row[]
  utilities: Row[]
  market: { demand:number; domesticProduction:number; imports:number; exports:number; targetShare:number; domesticPrice:number; exportPrice:number; domesticShare:number; growth:number }
  capex: Row[]
  opex: Row[]
  finance: { equity:number; debt:number; equityCost:number; debtCost:number; tax:number; manualRate:number; method:'unspecified'|'manual'|'wacc'; depreciationYears:number; workingCapital:number; financeRate:number; reinvestmentRate:number }
  risks: Row[]
}
const stageOptions = [
 {id:'mining',name:'استخراج سنگ‌آهن',route:'معدن روباز/زیرزمینی، حفاری، آتشباری، بارگیری و حمل',fields:['روش استخراج','ظرفیت استخراج ROM','عیار آهن خوراک','نسبت باطله‌برداری','بازیابی معدن','فاصله حمل تا کارخانه','مصرف مواد ناریه','مصرف سوخت ماشین‌آلات']},
 {id:'concentrate',name:'فرآوری و کنسانتره',route:'خردایش، آسیاکنی، جدایش مغناطیسی/فلوتاسیون، آبگیری',fields:['نوع کانسنگ','ظرفیت خوراک ورودی','عیار آهن خوراک','عیار آهن کنسانتره','بازیابی آهن','رطوبت کنسانتره','مصرف گلوله و لاینر','مصرف مواد شیمیایی']},
 {id:'pellet',name:'گندله‌سازی',route:'آماده‌سازی، اختلاط، دیسک/درام، پخت و خنک‌سازی',fields:['نوع و ظرفیت دیسک/درام','ظرفیت خوراک کنسانتره','عیار آهن گندله','قطر گندله','بنتونیت ویژه','رطوبت خوراک','دمای پخت','مصرف گاز ویژه']},
 {id:'dri',name:'احیای مستقیم',route:'شارژ گندله، احیای گازی/زغالی، خنک‌سازی و بریکت‌سازی',fields:['فناوری احیا','ظرفیت DRI','درجه فلزی‌شدن','درصد کربن محصول','مصرف گندله ویژه','مصرف گاز طبیعی','مصرف برق ویژه','دمای محصول خروجی']},
 {id:'steelmaking',name:'فولادسازی و ریخته‌گری',route:'EAF/IF/BOF، پالایش ثانویه، LF/VD و ریخته‌گری مداوم',fields:['نوع کوره ذوب','ظرفیت مذاب','سایز و تعداد ذوب','ترکیب شارژ DRI/قراضه','مصرف الکترود','مصرف فروآلیاژ','بازده مذاب به شمش','نوع ریخته‌گری و محصول']},
 {id:'hot-rolling',name:'نورد گرم',route:'کوره پیش‌گرم، پوسته‌زدایی، نورد خشن/نهایی، خنک‌کاری و برش',fields:['خانواده محصول تخت/طویل','نوع خط نورد','ابعاد خوراک','محدوده ابعاد محصول','تعداد قفسه/پاس','دمای خروجی نورد','بازده محصول قابل فروش','سرعت خط و گلوگاه']},
 {id:'hot-plate',name:'نورد گرم ورق - تولید پلیت',route:'کوره پیش‌گرم اسلب، پوسته‌زدایی، نورد خشن و نهایی، خنک‌کاری، برش و تختال‌گیری ورق',fields:['ابعاد و گرید اسلب ورودی','ظرفیت کوره پیش‌گرم','تعداد قفسه‌های نورد','ضخامت و عرض پلیت','دمای خروجی نورد','ظرفیت برش و تخت‌کردن','بازده محصول قابل فروش','مصرف ویژه گاز و برق']},
 {id:'cold-rolling',name:'نورد سرد و پوشش‌دهی',route:'تبدیل کلاف گرم به کلاف سرد؛ جزئیات خطوط و عملیات تکمیلی باید با طراحی مهندسی پروژه تطبیق داده شود',fields:['نوع و گرید کلاف گرم ورودی','ظرفیت تأمین کلاف گرم (تن/سال)','ضخامت و عرض کلاف گرم ورودی','مشخصات ضخامت و عرض کلاف سرد','نوع و ظرفیت خط اسیدشویی','نوع و ظرفیت قفسه‌های نورد سرد','ظرفیت عملیات آنیل و تکمیل سطح','بازده و ضایعات خط','مصرف ویژه اسید و مواد شیمیایی','مصرف روغن نورد و روانکار','تعداد نیروی انسانی مستقیم']},
 {id:'rebar-rolling',name:'نورد میلگرد',route:'کوره پیش‌گرم، نورد خشن و میانی، بلوک نهایی، خنک‌کاری و بستر خنک‌کن',fields:['قطرهای میلگرد','گریدهای فولادی','تعداد خطوط و استندها','ظرفیت برش و بسته‌بندی','سرعت نورد','بازده محصول قابل فروش','مصرف انرژی ویژه']},
 {id:'angle-rolling',name:'نورد نبشی',route:'کوره پیش‌گرم، نورد مقاطع، خنک‌کاری و صافکاری',fields:['سایز و ضخامت نبشی','گرید فولادی','تعداد استندها','ظرفیت برش و بسته‌بندی','سرعت نورد','بازده محصول قابل فروش','مصرف انرژی ویژه']},
 {id:'beam-rolling',name:'نورد تیرآهن',route:'کوره پیش‌گرم، نورد یونیورسال/معمولی، خنک‌کاری و صافکاری',fields:['سایز و استاندارد تیرآهن','گرید فولادی','تعداد استندها','ظرفیت صافکاری و برش','سرعت نورد','بازده محصول قابل فروش','مصرف انرژی ویژه']},
 {id:'other',name:'سایر',route:'فرآیند اختصاصی مطابق تعریف کاربر',fields:['شرح محصول','ظرفیت طراحی','فناوری و مسیر تولید','مواد اولیه اصلی','مصرف انرژی ویژه','بازده محصول قابل فروش']}
]
const stageFormDefinitions:Record<string,{materials:[string,string][];utilities:[string,string][];capex:string[];opex:[string,string][]}> = {
 mining:{
  materials:[['سنگ آهن خام ROM','تن/تن ماده معدنی'],['باطله استخراجی','تن/تن ماده معدنی'],['مواد ناریه','kg/تن استخراج'],['دیزل ماشین‌آلات','لیتر/تن استخراج'],['مته و قطعات حفاری','واحد/تن استخراج']],
  utilities:[['برق حفاری و خردایش','kWh/تن'],['گازوئیل ناوگان معدنی','لیتر/تن'],['آب معدن و آبکشی','m³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['اکتشاف تکمیلی و آماده‌سازی معدن','حفاری و آتشباری','دامپتراک و ناوگان حمل','لودر و بیل مکانیکی','سنگ‌شکن اولیه و ثانویه','نوار نقاله و دپو','سیستم آبکشی و تهویه','کارگاه تعمیرات و ماشین‌آلات جانبی'],
  opex:[['حفاری و آتشباری','میلیون ریال/تن'],['بارگیری و حمل','میلیون ریال/تن'],['سوخت و روانکار','میلیون ریال/تن'],['قطعات و تعمیرات','میلیون ریال/سال'],['نیروی انسانی معدن','میلیون ریال/سال'],['ایمنی و محیط زیست','میلیون ریال/سال']]
 },
 concentrate:{
  materials:[['سنگ آهن خوراک','تن/تن کنسانتره'],['گلوله و لاینر آسیا','kg/تن'],['مواد شیمیایی فلوتاسیون','kg/تن'],['فلوکولانت و منعقدکننده','kg/تن'],['آهک و تنظیم‌کننده pH','kg/تن'],['کنسانتره تولیدی','تن/تن خوراک'],['باطله خشک','تن/تن خوراک']],
  utilities:[['برق خردایش و آسیاکنی','kWh/تن'],['آب فرآیندی و آبگیری','m³/تن'],['گاز طبیعی','Nm³/تن'],['گازوئیل ماشین‌آلات','لیتر/تن'],['هوای فشرده','Nm³/تن']],
  capex:['سنگ‌شکن و سرند','آسیای گلوله‌ای و تجهیزات خردایش','سپراتور مغناطیسی و فلوتاسیون','تیکنر و فیلترپرس','آبگیری و بازیافت آب','نوار نقاله و دپو','آزمایشگاه و کنترل کیفیت','تأسیسات برق و پست'],
  opex:[['سنگ آهن خوراک','میلیون ریال/تن'],['گلوله، لاینر و قطعات سایشی','میلیون ریال/تن'],['مواد شیمیایی','میلیون ریال/تن'],['برق و آب','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['باطله و محیط زیست','میلیون ریال/سال']]
 },
 pellet:{
  materials:[['کنسانتره آهن','تن/تن گندله'],['بنتونیت','kg/تن'],['آهک و دولومیت','kg/تن'],['مواد افزودنی و چسباننده','kg/تن'],['گندله سالم','تن/تن خوراک'],['نرمه و برگشتی','درصد تولید']],
  utilities:[['گاز طبیعی کوره پخت','Nm³/تن'],['برق دیسک، فن و نوار','kWh/تن'],['آب صنعتی','m³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['آماده‌سازی و اختلاط مواد','دیسک یا درام گندله‌سازی','خشک‌کن و پیش‌گرم‌کن','کوره پخت و خنک‌کن','سرند و برگشت نرمه','غبارگیر و فیلتراسیون','انبار و انتقال مواد','تأسیسات آب و انرژی'],
  opex:[['کنسانتره آهن','میلیون ریال/تن'],['بنتونیت و افزودنی‌ها','میلیون ریال/تن'],['گاز طبیعی و برق','میلیون ریال/تن'],['نسوز و قطعات مصرفی','میلیون ریال/سال'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال']]
 },
 dri:{
  materials:[['گندله آهن ورودی','تن/تن DRI'],['نرمه آهک و دولومیت','kg/تن DRI'],['کاتالیست و لوله ریفرمر','kg/تن DRI'],['روغن صنعتی','kg/تن DRI'],['گریس','kg/تن DRI'],['آهن اسفنجی سرد CDRI','تن/تن محصول'],['نرمه و برگشتی احیا','درصد خوراک']],
  utilities:[['گاز طبیعی احیا و ریفرمر','Nm³/تن DRI'],['برق واحد احیا','kWh/تن DRI'],['آب صنعتی و خنک‌کاری','m³/تن DRI'],['اکسیژن','Nm³/تن DRI'],['هوای فشرده','Nm³/تن DRI'],['نیتروژن و گاز خنثی','Nm³/تن DRI']],
  capex:['دریافت، انباشت و برداشت گندله','واحد احیای مستقیم و کوره شفت','ریفرمر و سیستم گاز احیا','کمپرسورها و تجهیزات گاز','سیستم خنک‌کاری و غبارگیری','انتقال و انباشت آهن اسفنجی','تأسیسات آب و برق و گاز','ساختمان‌های صنعتی و غیرصنعتی','نصب، مهندسی و راه‌اندازی','هزینه‌های قبل از بهره‌برداری'],
  opex:[['گندله آهن','میلیون ریال/تن'],['آهک و دولومیت','میلیون ریال/تن'],['گاز طبیعی','میلیون ریال/تن'],['برق و آب','میلیون ریال/تن'],['کاتالیست، لوله و نسوز','میلیون ریال/سال'],['روغن، گریس و مواد مصرفی','میلیون ریال/سال'],['نیروی انسانی و سربار','میلیون ریال/سال'],['تعمیرات و قطعات یدکی','میلیون ریال/سال']]
 },
 steelmaking:{
  materials:[['آهن اسفنجی','تن/تن شمش'],['قراضه آهن','تن/تن شمش'],['آهک و دولومیت','kg/تن'],['فروآلیاژها و کربن','kg/تن'],['الکترود گرافیتی','kg/تن'],['مواد نسوز','kg/تن'],['اکسیژن و گازهای صنعتی','Nm³/تن'],['شمش یا بیلت تولیدی','تن/تن مذاب'],['سرباره و غبار','درصد شارژ']],
  utilities:[['برق کوره و LF','kWh/تن'],['گاز طبیعی','Nm³/تن'],['اکسیژن','Nm³/تن'],['آب خنک‌کاری','m³/تن'],['آرگون و نیتروژن','Nm³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['کوره قوس الکتریکی یا القایی','سیستم شارژ و انتقال مواد','کوره پاتیلی LF و پالایش ثانویه','غبارگیر و تصفیه گاز','ماشین ریخته‌گری مداوم','برش و خنک‌کاری محصول','آزمایشگاه و کنترل کیفیت','تأسیسات آب، برق و اکسیژن','ساختمان و نصب تجهیزات'],
  opex:[['آهن اسفنجی و قراضه','میلیون ریال/تن'],['فروآلیاژ و مواد افزودنی','میلیون ریال/تن'],['الکترود و نسوز','میلیون ریال/تن'],['برق، گاز و اکسیژن','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و قطعات یدکی','میلیون ریال/سال'],['سربار و آزمایشگاه','میلیون ریال/سال']]
 },

 'hot-plate':{
  materials:[['اسلب ورودی','تن/تن پلیت'],['گاز و مواد سوختی کوره','واحد/تن'],['آب پوسته‌زدایی و خنک‌کاری','m³/تن'],['غلتک و قطعات مصرفی','kg/تن'],['ضایعات برش و پوسته','درصد خوراک'],['پلیت قابل فروش','تن/تن اسلب']],
  utilities:[['گاز طبیعی کوره پیش‌گرم','Nm³/تن'],['برق قفسه‌های نورد و برش','kWh/تن'],['آب خنک‌کاری','m³/تن'],['اکسیژن و هوای فشرده','Nm³/تن']],
  capex:['کوره پیش‌گرم اسلب','پوسته‌زدایی پرفشار','قفسه‌های نورد خشن و نهایی','میز غلتکی و خنک‌کاری','قیچی و خط برش پلیت','صافکاری و تخت‌کردن','آزمایشگاه و کنترل کیفیت','تأسیسات آب، برق و گاز'],
  opex:[['اسلب ورودی','میلیون ریال/تن'],['گاز طبیعی و برق','میلیون ریال/تن'],['غلتک، نسوز و قطعات مصرفی','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['بسته‌بندی، حمل و سربار','میلیون ریال/سال']]
 },
 'hot-rolling':{
  materials:[['اسلب ورودی','تن/تن کلاف'],['گاز و سوخت کوره','واحد/تن'],['غلتک و قطعات مصرفی','kg/تن'],['روغن و روانکار','kg/تن'],['پوسته و ضایعات برش','درصد خوراک'],['کلاف قابل فروش','تن/تن اسلب']],
  utilities:[['گاز طبیعی کوره','Nm³/تن'],['برق خط نورد','kWh/تن'],['آب خنک‌کاری','m³/تن'],['اکسیژن و هوای فشرده','Nm³/تن']],
  capex:['کوره پیش‌گرم اسلب','پوسته‌زدایی','قفسه‌های نورد خشن','قفسه‌های نورد نهایی','کویلر و جمع‌کننده کلاف','سیستم خنک‌کاری و لوله‌کشی','تأسیسات آب و برق','انبار و بسته‌بندی کلاف'],
  opex:[['اسلب ورودی','میلیون ریال/تن'],['گاز طبیعی و برق','میلیون ریال/تن'],['غلتک و قطعات مصرفی','میلیون ریال/تن'],['روغن و روانکار','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['بسته‌بندی و حمل','میلیون ریال/سال']]
 },
 'cold-rolling':{
  materials:[['کلاف گرم ورودی','تن/تن کلاف سرد'],['اسید کلریدریک و مواد احیا','kg/تن'],['روغن نورد و روانکار','kg/تن'],['مواد شست‌وشو و پوشش‌دهی','kg/تن'],['ضایعات و افت خط','درصد خوراک'],['کلاف سرد قابل فروش','تن/تن خوراک']],
  utilities:[['برق قفسه‌های نورد سرد','kWh/تن'],['گاز طبیعی کوره آنیل','Nm³/تن'],['آب صنعتی و خنک‌کاری','m³/تن'],['هوای فشرده و نیتروژن','Nm³/تن']],
  capex:['خط اسیدشویی','قفسه‌های نورد سرد','کوره‌های آنیل و عملیات حرارتی','خط شست‌وشو و تمیزکاری','خط پوشش‌دهی و تکمیل سطح','صافکاری و برش','تصفیه اسید و پساب','تأسیسات آب، برق و گاز'],
  opex:[['کلاف گرم ورودی','میلیون ریال/تن'],['اسید و مواد شیمیایی','میلیون ریال/تن'],['روغن نورد و روانکار','میلیون ریال/تن'],['برق، گاز و آب','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و قطعات یدکی','میلیون ریال/سال'],['بسته‌بندی و سربار','میلیون ریال/سال']]
 },
 'rebar-rolling':{
  materials:[['شمش یا بیلت ورودی','تن/تن میلگرد'],['گاز کوره پیش‌گرم','Nm³/تن'],['غلتک و قیچی','kg/تن'],['مواد بسته‌بندی','kg/تن'],['پرت و ضایعات','درصد خوراک']],
  utilities:[['گاز طبیعی','Nm³/تن'],['برق نورد','kWh/تن'],['آب خنک‌کاری','m³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['کوره پیش‌گرم بیلت','قفسه‌های نورد خشن و میانی','بلوک نهایی و قیچی','بستر خنک‌کن','بسته‌بندی و باسکول','تأسیسات آب و برق'],
  opex:[['شمش یا بیلت','میلیون ریال/تن'],['گاز و برق','میلیون ریال/تن'],['غلتک و قطعات مصرفی','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['بسته‌بندی و حمل','میلیون ریال/سال']]
 },
 'angle-rolling':{
  materials:[['شمش یا بیلت ورودی','تن/تن نبشی'],['گاز کوره پیش‌گرم','Nm³/تن'],['غلتک و قطعات مصرفی','kg/تن'],['پرت و ضایعات','درصد خوراک']],
  utilities:[['گاز طبیعی','Nm³/تن'],['برق نورد','kWh/تن'],['آب خنک‌کاری','m³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['کوره پیش‌گرم','قفسه‌های نورد مقاطع','قیچی و برش','بستر خنک‌کن و صافکاری','بسته‌بندی و باسکول','تأسیسات آب و برق'],
  opex:[['شمش یا بیلت','میلیون ریال/تن'],['گاز و برق','میلیون ریال/تن'],['غلتک و قطعات مصرفی','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['بسته‌بندی و حمل','میلیون ریال/سال']]
 },
 'beam-rolling':{
  materials:[['شمش یا بلوم ورودی','تن/تن تیرآهن'],['گاز کوره پیش‌گرم','Nm³/تن'],['غلتک و قطعات مصرفی','kg/تن'],['پرت و ضایعات','درصد خوراک']],
  utilities:[['گاز طبیعی','Nm³/تن'],['برق نورد یونیورسال','kWh/تن'],['آب خنک‌کاری','m³/تن'],['هوای فشرده','Nm³/تن']],
  capex:['کوره پیش‌گرم','قفسه‌های نورد یونیورسال','قفسه‌های نورد خشن و میانی','صافکاری و برش','بستر خنک‌کن','بسته‌بندی و باسکول','تأسیسات آب و برق'],
  opex:[['شمش یا بلوم','میلیون ریال/تن'],['گاز و برق','میلیون ریال/تن'],['غلتک و قطعات مصرفی','میلیون ریال/تن'],['نیروی انسانی','میلیون ریال/سال'],['تعمیرات و نگهداری','میلیون ریال/سال'],['بسته‌بندی و حمل','میلیون ریال/سال']]
 }
}
const isOutputMaterial=(name:string)=>/(تولیدی|قابل فروش|باطله|ضایعات|نرمه و برگشتی|سرباره|پرت|برگشتی|گندله سالم|آهن اسفنجی سرد)/.test(name)
const stageRows=(items:[string,string][],source:string)=>items.map(([name,unit])=>({...makeRow(name,unit,0,0,source),flowType:isOutputMaterial(name)?'output' as const:'input' as const}))
const stageCapexRows=(items:string[],currency:string,source:string)=>items.map(name=>makeRow(name,currency,0,0,source))

/** Resolve the user's steel-chain project labels to the correct technical form. */
function resolveProjectStage(project:FeasibilityProject):typeof stageOptions[number] {
 const label=`${project.steelStage??''} ${project.name??''}`
  .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\s_-]/g,'').toLowerCase()
 const has=(value:string)=>label.includes(value)
 const id=has('نوردسرد')?'cold-rolling'
  :has('پلیت')?'hot-plate'
  :has('نوردگرم')&&has('کلاف')?'hot-rolling'
  :has('میلگرد')?'rebar-rolling'
  :has('نبشی')?'angle-rolling'
  :has('تیرآهن')||has('تیر اهن')?'beam-rolling'
  :has('فولادسازی')||has('ذوب')||has('ریخته')?'steelmaking'
  :has('احیاء')||has('احیا')||has('dri')?'dri'
  :has('گندله')?'pellet'
  :has('کنسانتره')||has('کنستانتره')?'concentrate'
  :has('معدن')||has('سنگآهن')?'mining'
  :'hot-rolling'
 return (stageOptions.find(stage=>stage.id===id)??stageOptions.find(stage=>stage.id==='hot-rolling')) as typeof stageOptions[number]
}

const steps = [
 ['profile','تعریف پروژه و بازار'],['stage','محصول و ظرفیت تولید'],['process','فرآیند تولید و موازنه مواد'],['balance','مصارف زیربنایی و فرآیندی'],['capex','هزینه‌های دوره ساخت'],['opex','هزینه‌های دوره بهره‌برداری'],['finance','تأمین مالی و نرخ تنزیل'],['cashflow','جریان نقدی و شاخص‌های مالی'],['results','جمع‌بندی و ارزیابی نهایی'],['reports','گزارش و خروجی‌ها']
] as const

const stepTitleEn:Record<string,string>={'تعریف پروژه و بازار':'Project Definition & Market','محصول و ظرفیت تولید':'Products & Production Capacity','فرآیند تولید و موازنه مواد':'Production Process & Material Balance','مصارف زیربنایی و فرآیندی':'Utilities & Process Consumables','هزینه‌های دوره ساخت':'Construction Costs','هزینه‌های دوره بهره‌برداری':'Operating Costs','تأمین مالی و نرخ تنزیل':'Financing & Discount Rate','جریان نقدی و شاخص‌های مالی':'Cash Flow & Financial Metrics','جمع‌بندی و ارزیابی نهایی':'Final Summary & Evaluation','گزارش و خروجی‌ها':'Reports & Outputs'}
type Step = typeof steps[number][0]
const makeRow=(name:string,unit='تن',quantity=0,unitPrice=0,source='فرض کاربر'):Row=>({id:crypto.randomUUID?.()??String(Date.now()+Math.random()),name,quantity,unit,unitPrice,source,flowType:'input'})
function jalaliToGregorianIso(year:number,month:number,day:number):string {
 let jy=year+1595
 let days=-355668+365*jy+Math.floor(jy/33)*8+Math.floor((jy%33+3)/4)+day+(month<7?(month-1)*31:((month-7)*30)+186)
 let gy=400*Math.floor(days/146097);days%=146097
 if(days>36524){gy+=100*Math.floor(--days/36524);days%=36524;if(days>=365)days++}
 gy+=4*Math.floor(days/1461);days%=1461
 if(days>365){gy+=Math.floor((days-1)/365);days=(days-1)%365}
 let gd=days+1
 const leap=gy%4===0&&(gy%100!==0||gy%400===0)
 const monthDays=[0,31,leap?29:28,31,30,31,30,31,31,30,31,30,31]
 let gm=1
 while(gm<=12&&gd>monthDays[gm]){gd-=monthDays[gm];gm++}
 return String(gy).padStart(4,'0')+'-'+String(gm).padStart(2,'0')+'-'+String(gd).padStart(2,'0')
}
function jalaliMonthToIso(value:string,end=false):string {
 const parts=value.split('/').map(Number)
 let year:number,month:number
 if(parts.length!==2)return ''
 if(parts[0]<=12&&parts[1]>1000){month=parts[0];year=parts[1]}
 else if(parts[0]<=12&&parts[1]<=99){month=parts[0];year=1400+parts[1]}
 else {year=parts[0];month=parts[1]}
 if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12)return ''
 return jalaliToGregorianIso(year,month,end?30:1)
}
function baseModel(project:FeasibilityProject):Model {
 const blankCustomProject=project.industry!=='فولاد و صنایع معدنی'||project.steelStage==='سایر'
 const selectedStage=blankCustomProject?(stageOptions.find(s=>s.id==='other') as typeof stageOptions[number]):resolveProjectStage(project)
 const parsedCapacity=Number(project.capacity.replace(/[^0-9.]/g,''))||0
 const blankTemplate=project.templateId==='raw'
 const imported=project.templateId==='comfar-import'&&!!project.sourceReport
 const report=project.sourceReport
 const sourceInputs=imported?COMFAR_PROJECT_INPUTS[project.id]:undefined
 const reportYear=report?Number(report.constructionStart.slice(0,4)):1403
 const reportDebt=report?(report.longTermDebt+report.shortTermDebt):0
 const reportFunding=report?(report.equity+reportDebt):0
 const equityShare=reportFunding>0?report!.equity/reportFunding*100:0
 const debtShare=reportFunding>0?100-equityShare:0
 const currencyCode=report?.currency==='یورو'?'EUR':'IRR'
 const foundation=createBlankProjectFoundation()
 const financialForms=createBlankProjectModelFinancialFormDrafts()
 const importedFixedItems:FixedInvestmentItem[]=sourceInputs&&report?[
  ...sourceInputs.fixedInvestment.map((asset,index)=>({
   id:project.id+'-asset-'+index,description:asset.name,assetClass:asset.assetClass,origin:'local' as const,currencyCode,costCentreId:'',
   depreciation:{method:'none' as const,startingAt:asset.periods[0]?.period??String(reportYear),ratePercent:null,lengthYears:null,lengthMonths:0,firstDepreciationMonths:12,scrapPercent:0},
   depreciationBasis:asset.assetClass==='land'?'source-table' as const:'unresolved' as const,
   acquisitions:asset.periods.filter(period=>period.amount>0).map((period,periodIndex)=>({id:project.id+'-asset-'+index+'-acq-'+periodIndex,period:period.period,quantity:1,unitPrice:period.amount,currencyCode,exchangeRateToLocal:null,allocationBasis:'source-period' as const})),
   sales:[]
  })),
  {id:project.id+'-preproduction',description:'مخارج پیش از تولید شامل بهره سرمایه‌ای‌شده',assetClass:'preproduction',origin:'local',currencyCode,costCentreId:'',
   depreciation:{method:'none',startingAt:String(reportYear),ratePercent:null,lengthYears:null,lengthMonths:0,firstDepreciationMonths:12,scrapPercent:0},depreciationBasis:'source-table',
   acquisitions:sourceInputs.preproduction.filter(period=>period.net+period.capitalizedInterest>0).map((period,index)=>({id:project.id+'-preproduction-'+index,period:period.period,quantity:1,unitPrice:period.net+period.capitalizedInterest,currencyCode,exchangeRateToLocal:null,allocationBasis:'source-period'})),sales:[]}
 ]:[]
 if(imported&&report&&sourceInputs){
  foundation.planning.periodFrequency='annual'
  const isHrCoilReference=project.id==='comfar-hr-coil-200k'
  foundation.planning.projectStartDate=jalaliMonthToIso(report.constructionStart)
  const operationEndParts=report.operationEnd.split('/').map(Number)
  const liquidationEnd=isHrCoilReference&&operationEndParts.length===2
    ?(operationEndParts[0]<=12&&operationEndParts[1]>1000
      ?String(operationEndParts[0])+'/'+String(operationEndParts[1]+1)
      :String(operationEndParts[0]+1)+'/'+String(operationEndParts[1]))
    :report.operationEnd
  foundation.planning.projectEndDate=jalaliMonthToIso(liquidationEnd,true)
  foundation.planning.fiscalYearStartMonth=3
  foundation.planning.balanceDateMonth=3
  foundation.planning.balanceDateDay=20
  foundation.planning.dayCountBasis=360
  foundation.planning.valuationDate=jalaliMonthToIso(report.valuationDate,false)
  foundation.planning.discountConvention='period-count'
  foundation.currencies.localCurrencyCode=currencyCode
  foundation.currencies.localCurrencyName=report.currency
  foundation.discounting.method='manual'
  foundation.discounting.financialRatePercent=report.investmentNpvRate
  foundation.taxation.system='corporate'
  const sourceTaxAmounts=isHrCoilReference?(sourceInputs.taxAmountSchedule??[]):[]
  const sourceTaxRates=isHrCoilReference
    ?[]
    :Array.from({length:report.operatingYears},(_,index)=>({period:String(report.firstOperatingYear+index),ratePercent:report.taxPercent}))
  foundation.taxation.rates=sourceTaxRates.map((rate,index)=>({id:project.id+'-tax-source-'+index,period:rate.period,ratePercent:rate.ratePercent}))
  financialForms.tax={
    ...financialForms.tax,system:'corporate',
    rates:sourceTaxRates.map(rate=>({period:rate.period,ratePercent:rate.ratePercent})),
    documentedAmounts:sourceTaxAmounts.map(row=>({
      period:String(Number(row.period)-reportYear+1),amount:row.amount,
      sourceReference:row.sourceReference,sourceVerified:true,
    })),
  }
  const sourceSalesSchedule=sourceInputs.productionSalesSchedule??[]
  const sourceByproductSchedule=sourceInputs.byproductSalesSchedule??[]
  const sourceSalesPeriods=[
   {period:'1',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0,salesRevenue:0},
   {period:'2',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0,salesRevenue:0},
   ...sourceSalesSchedule.map(row=>({...row,period:String(Number(row.period)-reportYear+1)})),
   ...(isHrCoilReference?[{period:String((operationEndParts[0]<=12&&operationEndParts[1]>1000?operationEndParts[1]:operationEndParts[0])+1-reportYear+1),openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0,salesRevenue:0}]:[]),
  ]
  if(sourceSalesSchedule.length){
   financialForms.sales=[{
    productId:project.id+'-main-product',
    unitOfMeasure:'تن',
    inventoryPolicy:'manual',
    finishedGoodsDaysCoverage:null,
    productionStartPeriod:Number(report.firstOperatingYear)-reportYear+1,
    productionEndPeriod:Number(report.firstOperatingYear)-reportYear+sourceSalesSchedule.length,
    periods:sourceSalesPeriods.map(row=>({
     period:row.period,
     salesQuantity:row.sales,
     netUnitPrice:row.netUnitPrice,
     salesTaxPercent:0,
     subsidyPercent:null,
     subsidyAmount:null,
     openingFinishedGoodsQuantity:row.openingInventory,
     openingFinishedGoodsValue:row.openingInventory===0?0:null,
     finishedGoodsClosingQuantity:row.closingInventory,
     rawMaterialPurchasesQuantity:null,
     rawMaterialPurchasesValue:null,
     rawMaterialConsumptionQuantity:null,
     normalRawMaterialWasteQuantity:null,
     abnormalRawMaterialWasteQuantity:null,
     unitsStarted:null,unitsCompleted:null,
     closingWipQuantity:null,
     materialCompletionPercent:null,
     conversionCompletionPercent:null,
     conversionCost:null,
     openingRawMaterialQuantity:null,
     openingRawMaterialValue:null,
     openingWipQuantity:null,
     openingWipMaterialValue:null,
     openingWipConversionValue:null,
    }))
   }]
  }
  if(sourceByproductSchedule.length){
   const byproductId=project.id+'-byproduct-scrape'
   const byproductPeriods=[
    {period:'1',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
    {period:'2',openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0},
    ...sourceByproductSchedule.map(row=>({...row,period:String(Number(row.period)-reportYear+1)})),
    ...(isHrCoilReference?[{period:String(Number(report.operationEnd.split('/').at(-1)??report.operationEnd)+1-reportYear+1),openingInventory:0,production:0,sales:0,closingInventory:0,netUnitPrice:0}]:[]),
   ].map(row=>({
    period:row.period,salesQuantity:row.sales,netUnitPrice:row.netUnitPrice,salesTaxPercent:0,
    subsidyPercent:null,subsidyAmount:null,openingFinishedGoodsQuantity:row.openingInventory,
    openingFinishedGoodsValue:row.openingInventory===0?0:null,finishedGoodsClosingQuantity:row.closingInventory,
    rawMaterialPurchasesQuantity:null,rawMaterialPurchasesValue:null,rawMaterialConsumptionQuantity:null,
    normalRawMaterialWasteQuantity:null,abnormalRawMaterialWasteQuantity:null,unitsStarted:null,unitsCompleted:null,closingWipQuantity:null,materialCompletionPercent:null,
    conversionCompletionPercent:null,conversionCost:null,openingRawMaterialQuantity:null,
    openingRawMaterialValue:null,openingWipQuantity:null,openingWipMaterialValue:null,openingWipConversionValue:null,
   }))
   financialForms.sales.push({
    productId:byproductId,unitOfMeasure:'تن',inventoryPolicy:'manual',finishedGoodsDaysCoverage:null,
    productionStartPeriod:3,productionEndPeriod:17,periods:byproductPeriods,
   })
  }
  const sourceLoanSchedule=sourceInputs.financingSchedule??[]
  if(sourceLoanSchedule.length){
   financialForms.loans=[{
    id:project.id+'-comfar-loan',
    name:'تسهیلات بلندمدت مطابق برنامه گزارش',
    currencyCode,
    marketOrigin:'local',
    annualRatePercent:null,
    openingBalance:0,
    openingExchangeRateToLocal:null,
    gracePeriods:null,
    interestConvention:null,
    loanType:'profile',
    repaymentInterval:'annual',
    firstRepaymentDate:'',
    numberOfRepayments:null,
    disbursements:[],
    profileMovements:[],
    interestRateChanges:[],
    interestPaymentMonth:null,
    capitalizedInterestPercent:null,
    capitalizeUntilDate:'',
    fees:[],
    manualPeriodSchedule:sourceLoanSchedule.map(row=>({
     period:String(Number(row.period)-reportYear+1),
     drawdown:row.loanDisbursement,
     principal:row.principalRepayment,
     interestExpense:row.interestExpense,
     capitalizedInterest:row.capitalizedInterest,
     closingBalance:row.closingDebt,
    })),
   }]
  }
  const sourceOperatingCosts=sourceInputs.operatingCostSchedule??[]
  if(sourceOperatingCosts.length){
   const productId=project.id+'-main-product'
   financialForms.productionCosts=sourceOperatingCosts[0].rows.map((sourceRow,rowIndex)=>({
    id:project.id+'-opex-'+rowIndex,
    metadata:{description:sourceRow.name,currencyCode,marketOrigin:'local',escalationPercent:0,remarks:report.reportFile+'؛ صفحات ۲۴ تا ۲۷؛ ردیف '+sourceRow.name,costCentreId:null},
    classification:'direct',
    productId,
    basis:'period-adjustments',
    standardQuantity:null,
    standardUnitPrice:null,
    standardTotal:null,
    nominalCapacity:null,
    fixedPercent:null,
    variablePercent:null,
    adjustments:sourceOperatingCosts.map(period=>({
     period:String(Number(period.period)-reportYear+1),
     quantity:null,
     unitPrice:null,
     total:period.rows[rowIndex]?.amount??null,
     fixedPercent:null,
     variablePercent:null,
    })),
   }))
   if(sourceByproductSchedule.length){
    const byproductId=project.id+'-byproduct-scrape'
    financialForms.productionCosts.push({
     id:project.id+'-byproduct-cost-unallocated',
     metadata:{description:'هزینه مستقل محصول جانبی در گزارش تفکیک نشده است',currencyCode,marketOrigin:'local',escalationPercent:0,remarks:report.reportFile+'؛ صفحات ۳۹ تا ۴۲؛ گزارش هزینه تولید مستقل برای Scrape# ارائه نکرده است و هزینه‌ها به محصول اصلی تخصیص داده شده‌اند.',costCentreId:null},
     classification:'direct',productId:byproductId,basis:'period-adjustments',
     standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,
     fixedPercent:null,variablePercent:null,
     adjustments:sourceByproductSchedule.map(period=>({period:String(Number(period.period)-reportYear+1),quantity:null,unitPrice:null,total:0,fixedPercent:null,variablePercent:null})),
    })
   }
  }
  financialForms.workingCapital=[
   {id:project.id+'-wc-inventory',name:'موجودی کالا',category:'inventory',minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',periodBalances:sourceInputs.workingCapital.map(period=>({period:period.period,amount:period.inventory}))},
   {id:project.id+'-wc-cash',name:'موجودی نقد',category:'cash',minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined',periodBalances:sourceInputs.workingCapital.map(period=>({period:period.period,amount:period.cash}))},
   ...(sourceInputs.workingCapital.some(period=>(period.payables??0)>0)?[{id:project.id+'-wc-payables',name:'حساب‌های پرداختنی',category:'payables' as const,minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:'user-defined' as const,periodBalances:sourceInputs.workingCapital.map(period=>({period:period.period,amount:period.payables??0}))}]:[]),
  ]
  financialForms.economic={...financialForms.economic,discountRatePercent:report.investmentNpvRate,discountRateSourceReference:report.reportFile+'؛ نرخ تنزیل گزارش، صفحه ۲',discountRateSourceVerified:true}
 }
 const capexRows=sourceInputs&&report?[
  ...sourceInputs.fixedInvestment.map(asset=>makeRow(asset.name,report.currency,1,asset.periods.reduce((total,period)=>total+period.amount,0),report.reportFile+'؛ صفحه ۳ و ۴')),
  makeRow('مخارج پیش از تولید (خالص از بهره)',report.currency,1,report.preproductionNet,report.reportFile+'؛ صفحه ۹'),
  makeRow('بهره سرمایه‌ای‌شده پیش از بهره‌برداری',report.currency,1,report.capitalizedInterest,report.reportFile+'؛ صفحه ۹'),
 ]:blankCustomProject?[]:stageCapexRows(stageFormDefinitions[selectedStage.id]?.capex??[],'میلیون ریال','فرم سرمایه‌گذاری تخصصی مرحله '+selectedStage.name+'؛ مبلغ باید از CAPEX و استعلام‌های پروژه تکمیل شود')
 const opexRows=sourceInputs&&report?sourceInputs.operatingCostRows.map(row=>makeRow(row.name,report.currency+'/سال',row.amount,1,report.reportFile+'؛ صفحه ۲۴، سال مرجع '+sourceInputs.operatingCostYear)):blankCustomProject?[]:stageRows(stageFormDefinitions[selectedStage.id]?.opex??[],'فرم OPEX تخصصی مرحله '+selectedStage.name+'؛ مقادیر نیازمند تکمیل از فایل هزینه‌ها و استعلام‌های پروژه')
 const sourceFactoryCost=sourceInputs?.operatingCostRows.filter(row=>!row.name.includes('بازاریابی')).reduce((total,row)=>total+row.amount,0)??0
 const sourceCostVariance=report?sourceFactoryCost-report.referenceFactoryCost:0
 const sourceNotes=sourceInputs&&report?[
  'اطلاعات CAPEX، مخارج پیش از تولید، بهره سرمایه‌ای‌شده و سرمایه در گردش از جداول تفصیلی گزارش مرجع وارد شده‌اند.',
  'ردیف‌های OPEX مربوط به سال مرجع '+sourceInputs.operatingCostYear+' هستند؛ اختلاف جمع ریزاقلام با خلاصه گزارش (پس از اصلاح ردیف‌های منبع): '+fmt(sourceCostVariance,2)+' '+report.currency+'.',
  'سهم هزینه متغیر گزارش: '+sourceInputs.variableCostSharePercent+'٪؛ سهم خارجی CAPEX گزارش: '+sourceInputs.foreignFixedInvestmentSharePercent+'٪. این نسبت‌ها تجمیعی‌اند و به تفکیک دارایی تخصیص داده نشده‌اند.',
  'برنامه سالانه تولید و فروش از صفحه ۳۵: '+(sourceInputs.productionSalesSchedule??[]).map(row=>row.period+' تولید '+fmt(row.production,2)+' تن، فروش '+fmt(row.sales,2)+' تن، قیمت '+fmt(row.netUnitPrice,2)+' و درآمد '+fmt(row.salesRevenue,2)).join('؛ '),
  'برنامه بدهی صفحات ۵۱ تا ۵۳: '+(sourceInputs.financingSchedule??[]).map(row=>row.period+' برداشت '+fmt(row.loanDisbursement,2)+'، بازپرداخت اصل '+fmt(row.principalRepayment,2)+'، بهره '+fmt(row.interestExpense,2)+'، مانده '+fmt(row.closingDebt,2)).join('؛ '),
  ...(project.id==='comfar-hr-coil-200k'?['نرخ مالیات فقط برای ۱۴۰۵ و ۱۴۰۸ برابر ۵٪ و برای ۱۴۱۹ برابر ۲۵٪ از صفحه ۲ مستند است؛ نرخ سال‌های دیگر و دو دوره ساخت در این گزارش خلاصه به‌طور کامل مشخص نشده و عمداً حدس زده نمی‌شود.']:[]),
  'استهلاک کل سالانه صفحات ۲۴ تا ۲۷ در داده مرجع ثبت شده؛ ریز استهلاک دارایی‌به‌دارایی از این گزارش خلاصه قابل استخراج قطعی نیست.',
  ...sourceInputs.missingSourceDetails.map(item=>'اطلاعات گزارش برای ورود قطعی ارائه نشده است: '+item)
 ].join('\n'):''
 return {
  projectCategory:selectedStage.id==='mining'?'mining':'industrial',analysisMode:'new',partners:[],partnerDistributionPercent:100,
  scope:{studyLevel:'feasibility',jointVenture:false,economicAnalysis:false,costCentreAnalysis:false,costAllocation:false,valueAddedAnalysis:false,foreignExchangeEffect:false,employmentEffects:false},
  foundation,financialForms,fixedInvestmentItems:importedFixedItems,fixedInvestmentSeedVersion:imported?2:0,startingFixedAssets:[],
  project:{name:project.name,location:project.location,owner:imported?report!.reportTitle:'',startYear:imported?reportYear:(blankTemplate?0:1403),constructionYears:imported?report!.constructionYears:(blankTemplate?0:2),operatingYears:imported?report!.operatingYears:(blankTemplate?0:10),currency:imported?report!.currency:(blankTemplate?'':'میلیون ریال'),fxRate:blankTemplate?0:1},
  stage:selectedStage.id,
  products:blankCustomProject?[]:[makeRow(imported?report!.product:'محصول اصلی','تن/سال',imported?report!.primaryCapacity:(blankTemplate?0:parsedCapacity),imported?(sourceInputs?.salesUnitPrice??0):0,imported?(sourceInputs?.salesPriceSource??'گزارش مرجع؛ قیمت فروش تأیید نشده'):'فرض کاربر'),...(imported&&report!.secondaryCapacity?[makeRow('آهن اسفنجی هات‌لینک','تن/سال',report!.secondaryCapacity,0,'گزارش مرجع؛ خلاصه صفحه اول')]:[])],
  capacity:{nameplate:imported?report!.primaryCapacity:(blankTemplate?0:parsedCapacity),operatingDays:0,hoursPerDay:0,availability:0,yield:0,ramp:blankTemplate?[]:(imported?sourceInputs?.capacityUtilization??[]:[70,80,90,100])},
  process:{technology:blankCustomProject||blankTemplate?'':selectedStage.name,route:imported?report!.description:(blankCustomProject||blankTemplate?'':selectedStage.route),equipment:'',bottleneck:0,notes:imported?sourceNotes:''},
  technical:blankCustomProject?[]:selectedStage.fields.map(field=>({...makeRow(field,field.includes('نیروی انسانی')?'نفر':'مقدار',0,0,'در خلاصه گزارش مرجع ارائه نشده؛ نیازمند تکمیل مهندسی'),valueText:''})),
  balance:blankCustomProject?[]:stageRows(stageFormDefinitions[selectedStage.id]?.materials??[],'در گزارش مرجع مقدار فیزیکی مصرف ویژه ارائه نشده؛ نیازمند موازنه مواد مهندسی'),
  utilities:blankCustomProject?[]:stageRows(stageFormDefinitions[selectedStage.id]?.utilities??[],'در گزارش مرجع مقدار فیزیکی مصرف ویژه ارائه نشده؛ نیازمند موازنه انرژی و یوتیلیتی'),
  market:{demand:0,domesticProduction:0,imports:0,exports:0,targetShare:0,domesticPrice:0,exportPrice:0,domesticShare:0,growth:0},
  capex:capexRows,
  opex:opexRows,
  finance:{equity:imported?equityShare:(blankTemplate?0:40),debt:imported?debtShare:(blankTemplate?0:60),equityCost:0,debtCost:0,tax:imported?report!.taxPercent:(blankTemplate?0:20),manualRate:imported?report!.investmentNpvRate:(blankTemplate?0:30),method:imported?'manual':(blankTemplate?'unspecified':'wacc'),depreciationYears:0,workingCapital:imported?report!.workingCapital:0,financeRate:0,reinvestmentRate:0},
  risks:blankCustomProject?[]:[makeRow('افزایش قیمت مواد اولیه','درصد',0),makeRow('کاهش قیمت فروش','درصد',0),makeRow('افت ظرفیت تولید','درصد',0),makeRow('تأخیر در راه‌اندازی','ماه',0)]
 }
}
const n=(v:number)=>Number.isFinite(v)?v:0
const fmt=(v:number,d=0)=>n(v).toLocaleString(typeof document!=='undefined'&&document.documentElement.lang==='en'?'en-US':'fa-IR',{maximumFractionDigits:d,minimumFractionDigits:d})
const sum=(rows:Row[])=>rows.reduce((a,r)=>a+n(r.quantity)*n(r.unitPrice),0)
const sumMaterialInputs=(rows:Row[])=>sum(rows.filter(row=>row.flowType==='output'?false:row.flowType==='input'?true:!isOutputMaterial(row.name)))
const fieldEnglish:Record<string,string>={"نام پروژه":"Project Name","موقعیت پروژه":"Project Location","سرمایه‌گذار / مجری":"Investor / Operator","سال شروع (شمسی)":"Start Year (Solar Hijri)","دوره ساخت":"Construction Period","دوره بهره‌برداری":"Operating Period","واحد پول پایه":"Base Currency","نرخ تبدیل ارز به واحد پایه":"FX Rate to Base Currency","تقاضای سالانه بازار":"Annual Market Demand","تولید داخلی":"Domestic Production","واردات":"Imports","صادرات":"Exports","سهم هدف پروژه از بازار":"Target Market Share","قیمت فروش داخلی":"Domestic Selling Price","قیمت فروش صادراتی":"Export Selling Price","سهم فروش داخلی":"Domestic Sales Share","رشد سالانه تقاضا":"Annual Demand Growth","ظرفیت اسمی کل":"Total Nameplate Capacity","روز کاری سالانه":"Operating Days per Year","ساعت کاری روزانه":"Operating Hours per Day","دسترس‌پذیری":"Availability","بازده محصول قابل فروش":"Saleable Product Yield","فناوری / تکنولوژی منتخب":"Selected Technology","شرح مسیر فرآیند":"Process Route Description","تجهیزات اصلی":"Main Equipment","ظرفیت گلوگاه خط":"Line Bottleneck Capacity","یادداشت مهندسی و فرضیات طراحی":"Engineering Notes & Design Assumptions","سرمایه‌گذاری ثابت":"Fixed Investment","هزینه‌های دوره ساخت":"Construction Costs","هزینه‌های دوره بهره‌برداری":"Operating Costs","سهم آورده سرمایه‌گذار":"Equity Contribution","سهم تسهیلات":"Debt Financing Share","هزینه حقوق صاحبان سهام (Ke)":"Cost of Equity (Ke)","نرخ تسهیلات (Kd)":"Cost of Debt (Kd)","نرخ مالیات":"Tax Rate","عمر استهلاک":"Depreciation Life","نرخ تأمین مالی کسری‌ها (MIRR)":"MIRR Finance Rate","نرخ سرمایه‌گذاری مجدد (MIRR)":"MIRR Reinvestment Rate","سرمایه در گردش":"Working Capital","عنوان قلم":"Item Description","جهت جریان":"Flow Direction","ورودی / مصرف":"Input / Consumption","خروجی / محصول":"Output / Product","عنوان پارامتر":"Parameter","مقدار / مشخصه":"Value / Specification","مقدار":"Quantity","واحد":"Unit","قیمت واحد":"Unit Price","منبع داده":"Data Source","قلم جدید":"New Item","افزودن ردیف":"Add Row","انتقال به بالا":"Move Up","انتقال به پایین":"Move Down","حذف ردیف":"Delete Row","عنوان · مقدار · واحد · قیمت واحد · منبع داده":"Description · Quantity · Unit · Unit Price · Data Source","تن":"tonnes","تن/سال":"tonnes/year","درصد":"%","روز":"days","ساعت":"hours","سال":"years","CAPEX ثبت‌شده":"Recorded CAPEX","ظرفیت عملی قابل فروش":"Saleable Operating Capacity","IRR کل سرمایه":"Total Investment IRR","MIRR کل سرمایه":"Total Investment MIRR","NPV حقوق صاحبان سهام":"Equity NPV","IRR حقوق صاحبان سهام":"Equity IRR","MIRR حقوق صاحبان سهام":"Equity MIRR","قیمت فروش ترکیبی":"Weighted Selling Price","مصرف ظاهری بازار":"Apparent Market Consumption","ظرفیت سربه‌سر":"Break-Even Capacity","جریان نقدی آزاد کل سرمایه (بدون معاملات تأمین مالی)":"Total Investment Free Cash Flow (Before Financing)","جریان نقدی حقوق صاحبان سهام (پس از تأمین مالی)":"Equity Cash Flow (After Financing)","برنامه سالانه بدهی و خدمت بدهی":"Annual Debt & Debt-Service Schedule","چک‌لیست کنترل تکمیل":"Completion Checklist","تکمیل اولیه":"Initial Completion","نیازمند تکمیل":"Completion Required","مقدار درصدی باید در محدوده مجاز":"Percentage must be within the permitted range","محصول اصلی":"Main Product","کلاف سرد":"Cold-Rolled Coil","کلاف گرم (ماده اولیه اصلی)":"Hot-Rolled Coil (Main Feedstock)","ضایعات، افت و برگشتی خط":"Line Scrap, Losses & Returns","برق مصرفی خط":"Line Electricity Consumption","گاز طبیعی":"Natural Gas","آب صنعتی و خنک‌کاری":"Industrial & Cooling Water","اسیدشویی و مواد شیمیایی":"Pickling & Chemicals","روغن نورد و روانکار":"Rolling Oil & Lubricants","ماده اولیه اصلی":"Main Raw Material","ضایعات و برگشتی":"Scrap & Returns","برق":"Electricity","آب صنعتی":"Industrial Water","زمین و آماده‌سازی":"Land & Site Preparation","ساختمان و ابنیه":"Buildings & Civil Works","ماشین‌آلات و تجهیزات":"Machinery & Equipment","تأسیسات و یوتیلیتی":"Utilities & Infrastructure","نصب، مهندسی و راه‌اندازی":"Installation, Engineering & Commissioning","هزینه‌های پیش از بهره‌برداری":"Pre-Operating Costs","محوطه‌سازی و آماده‌سازی سایت":"Site Preparation & Development","ساختمان‌های صنعتی":"Industrial Buildings","ساختمان‌های غیرصنعتی":"Non-Industrial Buildings","ماشین‌آلات، تجهیزات، مهندسی و نصب":"Machinery, Equipment, Engineering & Installation","وسائط نقلیه":"Vehicles","تأسیسات زیربنایی و واحدهای جنبی":"Infrastructure & Auxiliary Units","تجهیزات و وسایل اداری و خدماتی":"Office & Service Equipment","هزینه‌های احتمالی متفرقه و پیش‌بینی‌نشده":"Miscellaneous & Contingency Costs","هزینه تأمین مالی دوران ساخت (بهره وام)":"Construction-Period Financing Cost (Loan Interest)","خرید کلاف گرم":"Hot-Rolled Coil Purchase","اسید، روغن نورد و مواد مصرفی":"Acid, Rolling Oil & Consumables","برق، گاز و آب":"Electricity, Gas & Water","تعمیرات و قطعات یدکی":"Maintenance & Spare Parts","اداری، فروش، حمل و سربار":"Administration, Sales, Freight & Overheads","افزایش قیمت مواد اولیه":"Raw Material Price Increase","کاهش قیمت فروش":"Selling Price Decrease","افت ظرفیت تولید":"Production Capacity Reduction","تأخیر در راه‌اندازی":"Commissioning Delay","نیازمند موازنه تفصیلی":"Detailed Balance Required","نیازمند طراحی مهندسی":"Engineering Design Required","برآورد مهندسی":"Engineering Estimate","گزارش فنی-اقتصادی":"Technical & Economic Report","مقدار/تن محصول":"Quantity/tonne of Product","واحد/تن محصول":"Unit/tonne of Product","تن/تن محصول":"tonnes/tonne of Product","میلیون ریال/سال":"Million IRR/year","میلیون ریال/تن":"Million IRR/tonne","میلیون ریال/تن محصول":"Million IRR/tonne of Product","kWh/تن":"kWh/tonne","Nm³/تن":"Nm³/tonne","m³/تن":"m³/tonne","kg/تن":"kg/tonne","نفر":"persons","ماه":"months","سناریو":"Scenario"}
Object.assign(fieldEnglish,{
 'نوع و گرید کلاف گرم ورودی':'Hot-Rolled Coil Feed Type & Grade','ظرفیت تأمین کلاف گرم (تن/سال)':'Hot-Rolled Coil Supply Capacity (t/year)',
 'ضخامت و عرض کلاف گرم ورودی':'Hot-Rolled Coil Feed Thickness & Width','مشخصات ضخامت و عرض کلاف سرد':'Cold-Rolled Coil Thickness & Width Specifications',
 'نوع و ظرفیت خط اسیدشویی':'Pickling Line Type & Capacity','نوع و ظرفیت قفسه‌های نورد سرد':'Cold-Rolling Stand Type & Capacity',
 'ظرفیت عملیات آنیل و تکمیل سطح':'Annealing & Surface-Finishing Capacity','بازده و ضایعات خط':'Line Yield & Scrap',
 'مصرف ویژه اسید و مواد شیمیایی':'Specific Acid & Chemical Consumption','مصرف روغن نورد و روانکار':'Rolling Oil & Lubricant Consumption',
 'تعداد نیروی انسانی مستقیم':'Direct Headcount','قطرهای میلگرد':'Rebar Diameters','گریدهای فولادی':'Steel Grades',
 'تعداد خطوط و استندها':'Number of Lines & Stands','ظرفیت برش و بسته‌بندی':'Cutting & Packaging Capacity',
 'سرعت نورد':'Rolling Speed','مصرف انرژی ویژه':'Specific Energy Consumption','سایز و ضخامت نبشی':'Angle Size & Thickness',
 'تعداد استندها':'Number of Stands','سایز و استاندارد تیرآهن':'Beam Size & Standard','ظرفیت صافکاری و برش':'Straightening & Cutting Capacity',
 'بنتونیت ویژه':'Specific Bentonite Consumption','رطوبت خوراک':'Feed Moisture','فناوری و مسیر تولید':'Technology & Process Route',
 'مواد اولیه اصلی':'Main Raw Materials','نیازمند طراحی مهندسی':'Engineering Design Required','نیازمند داده بازار':'Market Data Required',
 'نیازمند موازنه تفصیلی':'Detailed Balance Required',
 'نیازمند تکمیل مهندسی؛ گزارش فقط اشتغال مستقیم را مشخص کرده':'Engineering completion required; the report only specifies direct employment'
});
const fieldLabel=(value:string)=>typeof document!=='undefined'&&document.documentElement.lang==='en'?(fieldEnglish[value]??value):value
function Field({label,value,unit,onChange,type='number',blankZero=false}:{label:string;value:number|string;unit?:string;onChange:(v:any)=>void;type?:string;blankZero?:boolean}){const displayValue=blankZero&&type==='number'&&value===0?'':value;return <label className="fw-field"><span>{fieldLabel(label)}</span><div><input type={type} value={displayValue} onChange={e=>onChange(type==='number'?Number(e.target.value):e.target.value)}/>{unit&&<small>{fieldLabel(unit)}</small>}</div></label>}
function TechnicalParameterEditor({title,rows,onChange,language}:{title:string;rows:Row[];onChange:(rows:Row[])=>void;language:'fa'|'en'}){
 const t=(fa:string,english:string)=>language==='en'?english:fa
 const update=(id:string,key:'name'|'valueText'|'unit'|'source',value:string)=>onChange(rows.map(row=>row.id===id?{...row,[key]:value}:row))
 return <div className="fw-card"><h3>{title}</h3>
  <p className="fw-hint">{t('مقدار هر پارامتر را به‌صورت عددی یا توصیفی وارد کنید؛ برای پارامترهای کمی، واحد و منبع داده را نیز مشخص کنید.','Enter each parameter as a numeric or descriptive value; provide a unit and source for quantitative parameters.')}</p>
  {rows.map(row=><div className="fw-grid" key={row.id}>
   <label className="fw-field"><span>{fieldLabel('عنوان پارامتر')}</span><input value={row.name} onChange={event=>update(row.id,'name',event.target.value)}/></label>
   <label className="fw-field"><span>{fieldLabel('مقدار / مشخصه')}</span><input type="text" value={row.valueText??(row.quantity!==0?String(row.quantity):'')} onChange={event=>update(row.id,'valueText',event.target.value)}/></label>
   <label className="fw-field"><span>{fieldLabel('واحد')}</span><input value={row.unit} onChange={event=>update(row.id,'unit',event.target.value)}/></label>
   <label className="fw-field"><span>{fieldLabel('منبع داده')}</span><input value={row.source} onChange={event=>update(row.id,'source',event.target.value)}/></label>
   <button className="secondary-button" onClick={()=>onChange(rows.filter(item=>item.id!==row.id))}>{t('حذف پارامتر','Remove parameter')}</button>
  </div>)}
  <button className="secondary-button" onClick={()=>onChange([...rows,makeRow('پارامتر جدید','',0,0,'فرض کاربر')])}>{t('افزودن پارامتر فنی','Add Technical Parameter')}</button>
 </div>
}
function RowEditor({title,rows,onChange,defaultUnit,blankZero=false,showFlowType=false}:{title:string;rows:Row[];onChange:(rows:Row[])=>void;defaultUnit:string;blankZero?:boolean;showFlowType?:boolean}){
 const update=(id:string,key:keyof Row,value:string|number)=>onChange(rows.map(r=>r.id===id?{...r,[key]:value}:r))
 const move=(index:number,direction:number)=>{const next=[...rows],target=index+direction;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];onChange(next)}
 return <div className="fw-card"><div className="fw-card-head"><h3>{fieldLabel(title)}</h3><button className="secondary-button" onClick={()=>onChange([...rows,makeRow('قلم جدید',defaultUnit)])}><Plus size={15}/> {fieldLabel('افزودن ردیف')}</button></div>
  {rows.map(r=><div className="fw-row" key={r.id} style={showFlowType?{gridTemplateColumns:'minmax(130px,2fr) repeat(4,minmax(70px,1fr)) 112px auto'}:undefined}><input aria-label={fieldLabel("عنوان قلم")} value={fieldLabel(r.name)} onChange={e=>update(r.id,'name',e.target.value)}/><input aria-label={fieldLabel("مقدار")} type="number" value={blankZero&&r.quantity===0?'':r.quantity} onChange={e=>update(r.id,'quantity',Number(e.target.value))}/><input aria-label={fieldLabel("واحد")} value={fieldLabel(r.unit)} onChange={e=>update(r.id,'unit',e.target.value)}/><input aria-label={fieldLabel("قیمت واحد")} type="number" value={blankZero&&r.unitPrice===0?'':r.unitPrice} onChange={e=>update(r.id,'unitPrice',Number(e.target.value))}/><input aria-label={fieldLabel("منبع داده")} value={fieldLabel(r.source)} onChange={e=>update(r.id,'source',e.target.value)}/>{showFlowType&&<select aria-label={fieldLabel('جهت جریان')} value={r.flowType??(isOutputMaterial(r.name)?'output':'input')} onChange={e=>update(r.id,'flowType',e.target.value)}><option value="input">{fieldLabel('ورودی / مصرف')}</option><option value="output">{fieldLabel('خروجی / محصول')}</option></select>}<span className="fw-row-actions"><button className="icon-button" aria-label={fieldLabel("انتقال به بالا")} disabled={rows.indexOf(r)===0} onClick={()=>move(rows.indexOf(r),-1)}><ArrowUp size={13}/></button><button className="icon-button" aria-label={fieldLabel("انتقال به پایین")} disabled={rows.indexOf(r)===rows.length-1} onClick={()=>move(rows.indexOf(r),1)}><ArrowDown size={13}/></button><button className="icon-button" aria-label={fieldLabel("حذف ردیف")} onClick={()=>onChange(rows.filter(x=>x.id!==r.id))}><Trash2 size={15}/></button></span></div>)}
  <small className="fw-hint">{fieldLabel('عنوان · مقدار · واحد · قیمت واحد · منبع داده')}</small>
 </div>
}
export default function FeasibilityWizard({project,onBack,language='fa'}:{project:FeasibilityProject;onBack:()=>void;language?:'fa'|'en'}){
 const en=language==='en'
 const t=(fa:string,english:string)=>en?english:fa
 const stepEn:Record<string,string>={'تعریف پروژه و بازار':'Project & Market','محصول و ظرفیت تولید':'Products & Capacity','فرآیند تولید و موازنه مواد':'Process & Material Balance','مصارف زیربنایی و فرآیندی':'Utilities & Consumables','هزینه‌های دوره ساخت':'Construction CAPEX','هزینه‌های دوره بهره‌برداری':'Operating OPEX','تأمین مالی و نرخ تنزیل':'Financing & Discount Rate','جریان نقدی و شاخص‌های مالی':'Cash Flow & Financial Metrics','جمع‌بندی و ارزیابی نهایی':'Final Evaluation','گزارش و خروجی‌ها':'Reports & Outputs'}
 const stageEn:Record<string,string>={mining:'Iron Ore Mining',concentrate:'Processing & Concentration',pellet:'Pelletizing',dri:'Direct Reduction',steelmaking:'Steelmaking & Casting','hot-rolling':'Hot Rolling','cold-rolling':'Cold Rolling & Coating','rebar-rolling':'Rebar Rolling','angle-rolling':'Angle Rolling','beam-rolling':'Beam Rolling',other:'Other'}
 const stageTitle=(id:string,fa:string)=>en?(stageEn[id]??fa):fa
 const fieldEn:Record<string,string>={"مشخصات پروژه":"Project Details","اطلاعات بازار":"Market Information","محصول اصلی":"Main Product","ظرفیت اسمی":"Nameplate Capacity","فناوری و مسیر تولید":"Technology & Process Route","موازنه مواد و یوتیلیتی":"Material Balance & Utilities","سرمایه‌گذاری دوره ساخت":"Construction Investment","هزینه‌های دوره بهره‌برداری":"Operating Costs","ساختار سرمایه و نرخ تنزیل":"Capital Structure & Discount Rate","جریان نقدی و شاخص‌ها":"Cash Flow & Metrics","ارزیابی نهایی":"Final Evaluation","گزارش آماده ارائه":"Presentation-Ready Report","روش استخراج":"Mining Method","ظرفیت استخراج ROM":"ROM Mining Capacity","عیار آهن خوراک":"Feed Iron Grade","نسبت باطله‌برداری":"Stripping Ratio","بازیابی معدن":"Mining Recovery","فاصله حمل تا کارخانه":"Haul Distance to Plant","مصرف مواد ناریه":"Explosives Consumption","مصرف سوخت ماشین‌آلات":"Mining Equipment Fuel Consumption","نوع کانسنگ":"Ore Type","ظرفیت خوراک ورودی":"Feed Input Capacity","عیار آهن کنسانتره":"Concentrate Iron Grade","بازیابی آهن":"Iron Recovery","رطوبت کنسانتره":"Concentrate Moisture","مصرف گلوله و لاینر":"Grinding Media & Liner Consumption","مصرف مواد شیمیایی":"Chemical Consumption","نوع و ظرفیت دیسک/درام":"Disc/Drum Type & Capacity","ظرفیت خوراک کنسانتره":"Concentrate Feed Capacity","عیار آهن گندله":"Pellet Iron Grade","قطر گندله":"Pellet Diameter","دمای پخت":"Firing Temperature","مصرف گاز ویژه":"Specific Gas Consumption","فناوری احیا":"Reduction Technology","ظرفیت DRI":"DRI Capacity","درجه فلزی‌شدن":"Metallization Degree","درصد کربن محصول":"Product Carbon Content","مصرف گندله ویژه":"Specific Pellet Consumption","مصرف گاز طبیعی":"Natural Gas Consumption","مصرف برق ویژه":"Specific Electricity Consumption","دمای محصول خروجی":"Product Discharge Temperature","نوع کوره ذوب":"Melting Furnace Type","ظرفیت مذاب":"Liquid Steel Capacity","سایز و تعداد ذوب":"Heat Size & Number of Heats","ترکیب شارژ DRI/قراضه":"DRI/Scrap Charge Mix","مصرف الکترود":"Electrode Consumption","مصرف فروآلیاژ":"Ferroalloy Consumption","بازده مذاب به شمش":"Liquid Steel-to-Billet Yield","نوع ریخته‌گری و محصول":"Casting Route & Product","خانواده محصول تخت/طویل":"Flat/Long Product Family","نوع خط نورد":"Rolling Mill Type","ابعاد خوراک":"Feed Dimensions","محدوده ابعاد محصول":"Product Dimension Range","تعداد قفسه/پاس":"Number of Stands/Passes","دمای خروجی نورد":"Rolling Exit Temperature","بازده محصول قابل فروش":"Saleable Product Yield","سرعت خط و گلوگاه":"Line Speed & Bottleneck","قطرهای میلگرد":"Rebar Diameters","گریدهای فولادی":"Steel Grades","تعداد خطوط و استندها":"Number of Lines & Stands","ظرفیت برش و بسته‌بندی":"Cutting & Packaging Capacity","سایز و ضخامت نبشی":"Angle Size & Thickness","سایز و استاندارد تیرآهن":"Beam Size & Standard","شرح محصول":"Product Description","ظرفیت طراحی":"Design Capacity","مواد اولیه اصلی":"Main Raw Materials","موقعیت پروژه":"Project Location","نام سرمایه‌گذار":"Investor Name","سال شروع":"Start Year","دوره ساخت":"Construction Period","دوره بهره‌برداری":"Operating Period","ارز مبنا":"Base Currency","نرخ تبدیل ارز":"Foreign Exchange Rate","قیمت فروش داخلی":"Domestic Selling Price","قیمت صادراتی":"Export Price","تقاضای بازار":"Market Demand","تولید داخلی":"Domestic Production","واردات":"Imports","صادرات":"Exports","سهم بازار هدف":"Target Market Share","هزینه سرمایه‌گذاری ثابت":"Fixed Investment Cost","هزینه مواد اولیه":"Raw Material Cost","هزینه انرژی":"Energy Cost","هزینه نیروی انسانی":"Labour Cost","هزینه تعمیر و نگهداری":"Maintenance Cost","نرخ مالیات":"Tax Rate","نرخ بازده مورد انتظار سهامدار":"Cost of Equity","هزینه بدهی":"Cost of Debt","سرمایه در گردش":"Working Capital","نرخ تأمین مالی کسری":"Financing Rate","نرخ سرمایه‌گذاری مجدد":"Reinvestment Rate","میلیون ریال":"Million IRR","میلیارد ریال":"Billion IRR","تن در سال":"tonnes/year","تن":"tonnes","میلیون ریال/تن":"Million IRR/tonne","فرض کاربر":"User Assumption","برآورد مهندسی":"Engineering Estimate","نیازمند تکمیل مهندسی؛ گزارش فقط اشتغال مستقیم را مشخص کرده":"Engineering completion required; the report only specifies direct employment","قیمت و شرایط تأمین در گزارش درج نشده":"Price and supply terms are not stated in the report","نیازمند برآورد":"Estimate required","نیازمند داده بازار":"Market data required","گزارش: ۲۵۰ نفر اشتغال مستقیم؛ مبلغ هزینه درج نشده":"Report: 250 direct employees; payroll cost not stated","گزارمند: دوره ساخت ۱۸ ماه":"Reported construction period: 18 months","گزارش: دوره ساخت ۱۸ ماه":"Reported construction period: 18 months","موقعیت ثبت نشده":"Location not set","ثبت نشده":"Not provided","واحد/تن محصول":"Unit/tonne of product","هزینه یوتیلیتی به ازای هر تن":"Utility Cost per Tonne","هزینه سالانه در ظرفیت عملی":"Annual Cost at Operating Capacity","ظرفیت عملی قابل فروش":"Saleable Operating Capacity","جمع سرمایه‌گذاری ثبت‌شده":"Recorded Total Investment","هزینه نقدی سالانه در ظرفیت عملی":"Annual Cash Operating Cost at Operating Capacity","ساختار هزینه‌های سرمایه‌ای":"Capital Cost Structure","فهرست محصولات":"Product List","مصارف زیربنایی و یوتیلیتی":"Utilities & Infrastructure","مواد، انرژی، نیروی انسانی، تعمیرات و سربار":"Materials, Energy, Labour, Maintenance & Overheads","نرخ تنزیل دستی":"Manual Discount Rate","محاسبه WACC":"Calculate WACC","WACC محاسبه‌شده":"Calculated WACC","نرخ تنزیل فعال":"Active Discount Rate","آورده ساخت ـ سال":"Construction Equity — Year","سهامدار ـ سال":"Equity Holder — Year","مانده اول دوره":"Opening Balance","بهره":"Interest","اصل":"Principal","DSCR تقریبی":"Indicative DSCR","دوره ساخت / بهره‌برداری":"Construction / Operating Period","اندازه ظاهری بازار":"Apparent Market Size","وضعیت تکمیل مراحل":"Stage Completion Status","مفروضات و شاخص‌های کلیدی":"Key Assumptions & Metrics","هزینه نقدی سالانه بهره‌برداری":"Annual Operating Cash Cost","تکمیل اولیه":"Initially Complete","نیازمند تکمیل":"Completion Required","پیش‌نمایش گزارش":"Report Preview","گزارش پیش‌نمایش مدیریتی است. اعتبار ارقام تابع کیفیت منابع، مفروضات و تکمیل مطالعات فنی و مالی است.":"This is a management report preview. The validity of figures depends on source quality, assumptions and completion of technical and financial studies."}
 Object.assign(fieldEn,{
  'نورد سرد و پوشش‌دهی':'Cold Rolling & Coating','تبدیل کلاف گرم به کلاف سرد؛ جزئیات خطوط و عملیات تکمیلی باید با طراحی مهندسی پروژه تطبیق داده شود':'Converting hot-rolled coil to cold-rolled coil; line details and finishing operations must be aligned with the project engineering design',
  'نوع و گرید کلاف گرم ورودی':'Hot-Rolled Coil Feed Type & Grade','ظرفیت تأمین کلاف گرم (تن/سال)':'Hot-Rolled Coil Supply Capacity (t/year)',
  'ضخامت و عرض کلاف گرم ورودی':'Hot-Rolled Coil Feed Thickness & Width','مشخصات ضخامت و عرض کلاف سرد':'Cold-Rolled Coil Thickness & Width Specifications',
  'نوع و ظرفیت خط اسیدشویی':'Pickling Line Type & Capacity','نوع و ظرفیت قفسه‌های نورد سرد':'Cold-Rolling Stand Type & Capacity',
  'ظرفیت عملیات آنیل و تکمیل سطح':'Annealing & Surface-Finishing Capacity','بازده و ضایعات خط':'Line Yield & Scrap',
  'مصرف ویژه اسید و مواد شیمیایی':'Specific Acid & Chemical Consumption','مصرف روغن نورد و روانکار':'Rolling Oil & Lubricant Consumption',
  'تعداد نیروی انسانی مستقیم':'Direct Headcount','قطرهای میلگرد':'Rebar Diameters','گریدهای فولادی':'Steel Grades',
  'تعداد خطوط و استندها':'Number of Lines & Stands','ظرفیت برش و بسته‌بندی':'Cutting & Packaging Capacity',
  'سرعت نورد':'Rolling Speed','مصرف انرژی ویژه':'Specific Energy Consumption','سایز و ضخامت نبشی':'Angle Size & Thickness',
  'تعداد استندها':'Number of Stands','سایز و استاندارد تیرآهن':'Beam Size & Standard','ظرفیت صافکاری و برش':'Straightening & Cutting Capacity',
  'روش استخراج':'Mining Method','ظرفیت استخراج ROM':'ROM Mining Capacity','عیار آهن خوراک':'Feed Iron Grade',
  'نسبت باطله‌برداری':'Stripping Ratio','بازیابی معدن':'Mining Recovery','فاصله حمل تا کارخانه':'Haul Distance to Plant',
  'مصرف مواد ناریه':'Explosives Consumption','مصرف سوخت ماشین‌آلات':'Mining Equipment Fuel Consumption',
  'نوع کانسنگ':'Ore Type','ظرفیت خوراک ورودی':'Feed Input Capacity','عیار آهن کنسانتره':'Concentrate Iron Grade',
  'بازیابی آهن':'Iron Recovery','رطوبت کنسانتره':'Concentrate Moisture','مصرف گلوله و لاینر':'Grinding Media & Liner Consumption',
  'مصرف مواد شیمیایی':'Chemical Consumption','نوع و ظرفیت دیسک/درام':'Disc/Drum Type & Capacity',
  'ظرفیت خوراک کنسانتره':'Concentrate Feed Capacity','عیار آهن گندله':'Pellet Iron Grade','قطر گندله':'Pellet Diameter',
  'بنتونیت ویژه':'Specific Bentonite Consumption','رطوبت خوراک':'Feed Moisture','دمای پخت':'Firing Temperature',
  'مصرف گاز ویژه':'Specific Gas Consumption','فناوری احیا':'Reduction Technology','ظرفیت DRI':'DRI Capacity',
  'درجه فلزی‌شدن':'Metallization Degree','درصد کربن محصول':'Product Carbon Content','مصرف گندله ویژه':'Specific Pellet Consumption',
  'مصرف گاز طبیعی':'Natural Gas Consumption','مصرف برق ویژه':'Specific Electricity Consumption','دمای محصول خروجی':'Product Discharge Temperature',
  'نوع کوره ذوب':'Melting Furnace Type','ظرفیت مذاب':'Liquid Steel Capacity','سایز و تعداد ذوب':'Heat Size & Number of Heats',
  'ترکیب شارژ DRI/قراضه':'DRI/Scrap Charge Mix','مصرف الکترود':'Electrode Consumption','مصرف فروآلیاژ':'Ferroalloy Consumption',
  'بازده مذاب به شمش':'Liquid Steel-to-Billet Yield','نوع ریخته‌گری و محصول':'Casting Route & Product',
  'خانواده محصول تخت/طویل':'Flat/Long Product Family','نوع خط نورد':'Rolling Mill Type','ابعاد خوراک':'Feed Dimensions',
  'محدوده ابعاد محصول':'Product Dimension Range','تعداد قفسه/پاس':'Number of Stands/Passes',
  'دمای خروجی نورد':'Rolling Exit Temperature','بازده محصول قابل فروش':'Saleable Product Yield',
  'سرعت خط و گلوگاه':'Line Speed & Bottleneck','شرح محصول':'Product Description','ظرفیت طراحی':'Design Capacity',
  'فناوری و مسیر تولید':'Technology & Process Route','مواد اولیه اصلی':'Main Raw Materials',
  'موقعیت پروژه':'Project Location','نام سرمایه‌گذار':'Investor Name','سال شروع':'Start Year',
  'دوره ساخت':'Construction Period','دوره بهره‌برداری':'Operating Period','ارز مبنا':'Base Currency',
  'نرخ تبدیل ارز':'Foreign Exchange Rate','قیمت فروش داخلی':'Domestic Selling Price','قیمت صادراتی':'Export Price',
  'تقاضای بازار':'Market Demand','تولید داخلی':'Domestic Production','واردات':'Imports','صادرات':'Exports',
  'سهم بازار هدف':'Target Market Share','هزینه سرمایه‌گذاری ثابت':'Fixed Investment Cost','هزینه مواد اولیه':'Raw Material Cost',
  'هزینه انرژی':'Energy Cost','هزینه نیروی انسانی':'Labour Cost','هزینه تعمیر و نگهداری':'Maintenance Cost',
  'فرض کاربر':'User Assumption','نیازمند طراحی مهندسی':'Engineering Design Required','نیازمند برآورد':'Estimate Required',
  'نیازمند داده بازار':'Market Data Required','نیازمند موازنه تفصیلی':'Detailed Balance Required'
 });
 const routeEnExtra:Record<string,string>={'تبدیل کلاف گرم به کلاف سرد؛ جزئیات خطوط و عملیات تکمیلی باید با طراحی مهندسی پروژه تطبیق داده شود':'Converting hot-rolled coil to cold-rolled coil; line details and finishing operations must align with the project engineering design','کوره پیش‌گرم، نورد خشن و میانی، بلوک نهایی، خنک‌کاری و بستر خنک‌کن':'Reheating furnace, roughing and intermediate stands, finishing block, cooling and cooling bed','کوره پیش‌گرم، نورد مقاطع، خنک‌کاری و صافکاری':'Reheating furnace, section rolling, cooling and straightening','کوره پیش‌گرم، نورد یونیورسال/معمولی، خنک‌کاری و صافکاری':'Reheating furnace, universal/conventional rolling, cooling and straightening','فرآیند اختصاصی مطابق تعریف کاربر':'Custom process as defined by the user'};
 Object.assign(fieldEnglish,fieldEn);
 const trField=(v:string)=>en?(fieldEn[v]??v):v
 const routeEn:Record<string,string>={'معدن روباز/زیرزمینی، حفاری، آتشباری، بارگیری و حمل':'Open-pit/underground mining, drilling, blasting, loading and haulage','خردایش، آسیاکنی، جدایش مغناطیسی/فلوتاسیون، آبگیری':'Crushing, grinding, magnetic separation/flotation and dewatering','آماده‌سازی، اختلاط، دیسک/درام، پخت و خنک‌سازی':'Preparation, mixing, disc/drum pelletizing, firing and cooling','شارژ گندله، احیای گازی/زغالی، خنک‌سازی و بریکت‌سازی':'Pellet charging, gas/coal-based reduction, cooling and briquetting','EAF/IF/BOF، پالایش ثانویه، LF/VD و ریخته‌گری مداوم':'EAF/IF/BOF, secondary refining, LF/VD and continuous casting','کوره پیش‌گرم، پوسته‌زدایی، نورد خشن/نهایی، خنک‌کاری و برش':'Reheating furnace, descaling, roughing/finishing, cooling and cutting','فرآیند اختصاصی مطابق تعریف کاربر':'Custom process defined by the user'}

 Object.assign(routeEn,routeEnExtra);

 const key='feasibility:project:'+project.id+':v1'
 const handleScenarioAnalysis=useCallback((matrix:PeriodicSensitivityCell[][],scenarios:PeriodicFinancialScenarioSet|null)=>{setReportScenarioMatrix(matrix);setReportScenarios(scenarios)},[])
 const [m,setM]=useState<Model>(()=>baseModel(project)),[step,setStep]=useState<Step>('profile'),[loaded,setLoaded]=useState(false),[saved,setSaved]=useState(''),[integratedFinanceResult,setIntegratedFinanceResult]=useState<IntegratedFinanceResult|null>(null),[reportSensitivity,setReportSensitivity]=useState<OneWaySensitivityAnalysis|null>(null),[reportScenarioMatrix,setReportScenarioMatrix]=useState<SensitivityCell[][]>([]),[reportScenarios,setReportScenarios]=useState<PeriodicFinancialScenarioSet|null>(null),[reportPeriodicFinance,setReportPeriodicFinance]=useState<PeriodicProjectFinanceResult|null>(null),[reportPartnerFinance,setReportPartnerFinance]=useState<PartnerFinanceResult|null>(null),[reportCppCpsTraceLedger,setReportCppCpsTraceLedger]=useState<CppCpsTraceLedger|null>(null),[reportValueAddedAnalysisResult,setReportValueAddedAnalysisResult]=useState<ValueAddedAnalysisResult|null>(null),[reportSalesTaxLedgerResult,setReportSalesTaxLedgerResult]=useState<SalesTaxLedgerResult|null>(null),[reportIncrementalEnterpriseAnalysis,setReportIncrementalEnterpriseAnalysis]=useState<IncrementalAnalysisResult|null>(null),[reportIncrementalEnterpriseIssues,setReportIncrementalEnterpriseIssues]=useState<string[]>([]),[startingBalances,setStartingBalances]=useState<StartingFinancialBalanceSummary>(blankStartingBalanceSummary)
 const handleIncrementalAnalysisChange=useCallback((result:IncrementalAnalysisResult|null,issues:string[])=>{setReportIncrementalEnterpriseAnalysis(result);setReportIncrementalEnterpriseIssues(issues)},[])
 const handleStartingAssetsChange=useCallback((assets:StartingFixedAssetBalance[])=>setM(current=>JSON.stringify(current.startingFixedAssets)===JSON.stringify(assets)?current:{...current,startingFixedAssets:assets}),[])
 const handleStartingBalancesChange=useCallback((balances:StartingFinancialBalanceSummary)=>setStartingBalances(current=>JSON.stringify(current)===JSON.stringify(balances)?current:balances),[])
  const isRawTemplate=project.templateId==='raw'||project.industry!=='فولاد و صنایع معدنی'||project.steelStage==='سایر'
  const projectCalendarPeriods=m.foundation.planning.projectStartDate&&m.foundation.planning.projectEndDate&&m.foundation.planning.periodFrequency!=='unspecified'&&m.foundation.planning.fiscalYearStartMonth!==null
    ?buildProjectCalendarPeriods(m.foundation.planning.projectStartDate,m.foundation.planning.projectEndDate,m.foundation.planning.periodFrequency,m.foundation.planning.fiscalYearStartMonth)
    :[]
  const terminalPeriods=project.id==='comfar-hr-coil-200k'?1:0
  const projectComfarSourceInputs=project.templateId==='comfar-import'?COMFAR_PROJECT_INPUTS[project.id]:undefined
  const periodOtherIncomeByPeriod=projectComfarSourceInputs?.otherIncomeSchedule
    ?projectCalendarPeriods.map((_,index)=>projectComfarSourceInputs.otherIncomeSchedule!.filter(row=>Number(row.period)===m.project.startYear+index).reduce((sum,row)=>sum+row.amount,0))
    :undefined
  const periodOtherIncomeSourceReference=projectComfarSourceInputs?.otherIncomeSchedule?.map(row=>row.sourceReference).filter(Boolean).join(' | ')
  const FormField=(props:Parameters<typeof Field>[0])=><Field {...props} blankZero={isRawTemplate||project.templateId==='comfar-import'}/>
 useEffect(()=>{
  let alive=true
  localStore.get<Model>(key).then(v=>{
   if(!alive)return
   if(!v){setM(baseModel(project));setLoaded(true);return}
   const defaults=baseModel(project)
   const imported=project.templateId==='comfar-import'&&!!project.sourceReport
   const hasPositiveRows=(rows:Row[]|undefined)=>Array.isArray(rows)&&rows.some(row=>Number(row.quantity)>0&&Number(row.unitPrice)>0)
   const savedFixedItems=Array.isArray(v.fixedInvestmentItems)?v.fixedInvestmentItems:[]
   const hasFixedAcquisitions=savedFixedItems.some(item=>(item.acquisitions??[]).some(acquisition=>Number(acquisition.quantity)>0&&Number(acquisition.unitPrice)>0))
   const savedForms=mergeProjectModelFinancialFormDrafts(v.financialForms)
   const defaultForms=defaults.financialForms
   const hasWorkingCapital=savedForms.workingCapital.some(component=>component.periodBalances.some(period=>period.amount!==null&&Number.isFinite(period.amount)))
   const financialForms=imported?{
    ...defaultForms,...savedForms,
    workingCapital:hasWorkingCapital?savedForms.workingCapital:defaultForms.workingCapital,
    tax:savedForms.tax.rates.length?savedForms.tax:defaultForms.tax,
    economic:{...defaultForms.economic,...savedForms.economic,
     discountRatePercent:savedForms.economic.discountRatePercent??defaultForms.economic.discountRatePercent,
     discountRateSourceReference:savedForms.economic.discountRateSourceReference||defaultForms.economic.discountRateSourceReference,
     discountRateSourceVerified:savedForms.economic.discountRateSourceVerified||defaultForms.economic.discountRateSourceVerified}
   }:savedForms
   setM({
    ...defaults,...v,
    partners:Array.isArray(v.partners)?v.partners:defaults.partners,
    partnerDistributionPercent:Number.isFinite(v.partnerDistributionPercent)?v.partnerDistributionPercent:defaults.partnerDistributionPercent,
    stage:defaults.stage,
    foundation:imported&&!v.foundation?.currencies?.localCurrencyCode?defaults.foundation:mergeProjectFoundation(v.foundation),
    financialForms,
    fixedInvestmentItems:(imported&&!hasFixedAcquisitions?defaults.fixedInvestmentItems:savedFixedItems).map(item=>({...item,depreciationBasis:item.depreciationBasis??'unresolved',acquisitions:item.acquisitions.map(acquisition=>({...acquisition,allocationBasis:acquisition.allocationBasis??'unallocated'})),depreciation:{...item.depreciation,lengthMonths:item.depreciation?.lengthMonths??0,firstDepreciationMonths:item.depreciation?.firstDepreciationMonths??12}})),
    fixedInvestmentSeedVersion:Math.max(Number(v.fixedInvestmentSeedVersion)||0,defaults.fixedInvestmentSeedVersion),
    startingFixedAssets:Array.isArray(v.startingFixedAssets)?v.startingFixedAssets:[],
    project:{...defaults.project,...v.project},
    capacity:{...defaults.capacity,...v.capacity},
    market:{...defaults.market,...v.market},
    capex:imported&&!hasPositiveRows(v.capex)?defaults.capex:(Array.isArray(v.capex)?v.capex:defaults.capex),
    opex:imported&&!hasPositiveRows(v.opex)?defaults.opex:(Array.isArray(v.opex)?v.opex:defaults.opex),
    scope:{...defaults.scope,...v.scope}
   })
   setLoaded(true)
  }).catch(()=>setLoaded(true))
  return()=>{alive=false}
 },[key]);
 useEffect(()=>{
  if(!loaded)return
  let alive=true
  const saveTimer=window.setTimeout(()=>{
   localStore.set<Model>(key,m).then(()=>{
    if(alive)setSaved(new Date().toLocaleTimeString(language==='en'?'en-US':'fa-IR',{hour:'2-digit',minute:'2-digit'}))
   }).catch(()=>{
    if(alive)setSaved(language==='en'?'Save failed':'ذخیره ناموفق')
   })
  },350)
  return()=>{alive=false;window.clearTimeout(saveTimer)}
 },[key,loaded,m,language]);
 const stage=stageOptions.find(s=>s.id===m.stage)??stageOptions[5]
 const cap=m.capacity.nameplate*Math.min(100,Math.max(0,m.capacity.availability))/100*Math.min(100,Math.max(0,m.capacity.yield))/100
 const capex=sum(m.capex),variable=m.opex.filter(r=>r.unit.includes('/تن')).reduce((a,r)=>a+n(r.quantity)*n(r.unitPrice),0)+sumMaterialInputs(m.balance)+sum(m.utilities),fixed=m.opex.filter(r=>r.unit.includes('/سال')).reduce((a,r)=>a+n(r.quantity)*n(r.unitPrice),0)
  const preOperatingCost=m.capex.filter(r=>r.name.includes('مخارج پیش از تولید')||r.name.includes('بهره سرمایه‌ای‌شده')).reduce((a,r)=>a+r.quantity*r.unitPrice,0)
  const fixedInvestmentLifecycleInputs=m.fixedInvestmentItems.length
    ?buildComfarDepreciationAssetsFromFixedInvestmentItems(
      m.fixedInvestmentItems,
      m.project.startYear,
      Math.max(1,Math.ceil(m.project.constructionYears||1)+Math.ceil(m.project.operatingYears||1)+terminalPeriods),
      m.foundation.planning.periodFrequency,
      m.foundation
    )
    :{assets:[],sales:[],investmentSchedule:Array.from({length:Math.max(1,Math.ceil(m.project.constructionYears||1)+Math.ceil(m.project.operatingYears||1))},()=>0),investmentScheduleVerified:false,preOperatingSchedule:Array.from({length:Math.max(1,Math.ceil(m.project.constructionYears||1)+Math.ceil(m.project.operatingYears||1))},()=>0),preOperatingScheduleVerified:false,warnings:[]}
  const validOpeningAssetDisposals=m.startingFixedAssets.filter(asset=>{
    if(asset.status!=='replace'&&asset.status!=='sell')return false
    if(!asset.disposalDate||!projectCalendarPeriods.some(period=>period.startDate<=asset.disposalDate!&&period.endDate>=asset.disposalDate!))return false
    return asset.disposalPriceMode!=='self-defined'||
      (Number.isFinite(asset.disposalProceeds)&&asset.disposalProceeds!>=0&&
       Number.isFinite(asset.disposalExchangeRateToLocal)&&asset.disposalExchangeRateToLocal!>0)
  })
  const openingAssetSales:ComfarAssetSaleInput[]=validOpeningAssetDisposals.map(asset=>({
    id:'opening-sale-'+asset.id,assetId:'opening-'+asset.id,period:1,
    saleDate:asset.disposalDate,priceMode:asset.disposalPriceMode??'book-value',
    ...(asset.disposalPriceMode==='self-defined'?{
      selfDefinedPrice:asset.disposalProceeds,
      exchangeRateToLocal:asset.disposalExchangeRateToLocal,
    }:{})
  }))
  const openingAssetDepreciationAssets:ComfarDepreciationAssetInput[]=m.startingFixedAssets
    .filter(asset=>asset.grossCost>0)
    .filter(asset=>asset.status==='active'||asset.status==='idle'||validOpeningAssetDisposals.some(item=>item.id===asset.id))
    .map(asset=>{
      const method=asset.depreciationMethod==='none'?'none'
        :asset.depreciationMethod==='linear-zero'?'linear-to-zero'
        :asset.depreciationMethod==='accelerated'?'accelerated'
        :asset.depreciationMethod==='sum-of-digits'?'sum-of-years-digits':'linear-to-scrap'
      const length=Math.max(0,asset.remainingLife)
      const scrapPercent=asset.salvagePercent??(asset.grossCost>0?(asset.residualValue??0)/asset.grossCost*100:0)
      const effectiveStartingAtDate=[
        m.foundation.planning.projectStartDate,asset.commissioningDate,asset.depreciationStartDate
      ].filter((date):date is string=>!!date).sort().at(-1)
      return {
        id:'opening-'+asset.id,name:asset.name,originalValue:asset.grossCost,
        initialBookValue:Math.max(0,asset.grossCost-asset.accumulatedDepreciation),
        scrapPercent,lengthYears:length,lengthMonths:0,
        ratePercent:method==='linear-to-zero'||method==='linear-to-scrap'
          ?(length>0?100/length:0):asset.depreciationRatePercent,
        method,acquisitionPeriod:0,startingAtPeriod:1,
        acquisitionDate:asset.commissioningDate||m.foundation.planning.projectStartDate||undefined,
        startingAtDate:effectiveStartingAtDate,
        firstDepreciationMonths:asset.firstDepreciationMonths??12,
      }
    })
  const openingAssetDepreciationWarnings=m.startingFixedAssets
    .filter(asset=>(asset.status==='replace'||asset.status==='sell')&&!validOpeningAssetDisposals.some(item=>item.id===asset.id))
    .map(asset=>asset.name+': برای محاسبه استهلاک تا واگذاری و حذف ارزش دفتری از ترازنامه، تاریخ و مبلغ/روش معتبر واگذاری را ثبت کنید.')
  const integratedComfarDepreciationAssets=[...openingAssetDepreciationAssets,...fixedInvestmentLifecycleInputs.assets]
  const openingFixedAssetsNetBookValue=m.startingFixedAssets.reduce((sum,asset)=>sum+(Number.isFinite(asset.grossCost)&&Number.isFinite(asset.accumulatedDepreciation)?Math.max(0,asset.grossCost-asset.accumulatedDepreciation):0),0)
  const fixedInvestmentRegisterReconciliation=reconcileFixedInvestmentRegister(m.fixedInvestmentItems,capex,preOperatingCost)
  const confirmedFixedInvestmentSchedule=fixedInvestmentLifecycleInputs.investmentScheduleVerified&&fixedInvestmentRegisterReconciliation.status==='matched'?fixedInvestmentLifecycleInputs.investmentSchedule:undefined
  const confirmedPreOperatingSchedule=fixedInvestmentLifecycleInputs.preOperatingScheduleVerified&&fixedInvestmentRegisterReconciliation.status==='matched'?fixedInvestmentLifecycleInputs.preOperatingSchedule:undefined
   const wacc=(m.finance.equity/100)*(m.finance.equityCost/100)+(m.finance.debt/100)*(m.finance.debtCost/100)*(1-m.finance.tax/100)
 const rate=m.finance.method==='wacc'?wacc:m.finance.method==='manual'?m.finance.manualRate/100:0
 const marketSize=m.market.domesticProduction+m.market.imports-m.market.exports
 const isSteelProject=project.industry==='فولاد و صنایع معدنی'
 const productCapacityTotal=m.products.reduce((total,row)=>total+Math.max(0,n(row.quantity)),0)
 const productCapacityTolerance=Math.max(0.01,Math.abs(m.capacity.nameplate)*0.000001)
 const productCapacityMatchesNameplate=!isSteelProject||Math.abs(productCapacityTotal-m.capacity.nameplate)<=productCapacityTolerance
 const productPricingComplete=m.products.length>0&&m.products.every(row=>row.quantity>0&&row.unitPrice>0)&&productCapacityMatchesNameplate
 const productWeightedRevenuePrice=productPricingComplete?sum(m.products)/Math.max(1,isSteelProject?m.capacity.nameplate:productCapacityTotal):null
 const marketWeightedRevenuePrice=m.market.domesticPrice>0&&m.market.exportPrice>0
  ?m.market.domesticPrice*(m.market.domesticShare/100)+m.market.exportPrice*(1-m.market.domesticShare/100)
  :m.market.domesticPrice>0?m.market.domesticPrice:Math.max(0,m.market.exportPrice)
 const revenuePrice=productWeightedRevenuePrice??marketWeightedRevenuePrice
 const model=useMemo(()=>{
  const constructionPeriods=Math.max(1,Math.ceil(m.project.constructionYears||1))
  const operatingPeriods=Math.max(1,Math.ceil(m.project.operatingYears||1))
  const equityWeight=Math.min(100,Math.max(0,m.finance.equity))/100
  const debtWeight=Math.min(100,Math.max(0,m.finance.debt))/100
  const totalUses=capex+Math.max(0,m.finance.workingCapital)
  const debtDraw=totalUses*debtWeight
  const annualPrincipal=debtDraw/operatingPeriods
  const projectFlows=Array.from({length:constructionPeriods},(_,i)=>-capex/constructionPeriods-(i===constructionPeriods-1?m.finance.workingCapital:0))
  const equityFlows=projectFlows.map(value=>value*equityWeight)
  const annualRows:{period:string;project:number;equity:number;debtOpening:number;interest:number;principal:number;tax:number}[]=[]
  let openingDebt=debtDraw
  for(let i=0;i<operatingPeriods;i++){
   const ramp=m.capacity.ramp[i]??100,qty=cap*ramp/100,rev=qty*revenuePrice,op=qty*variable+fixed,dep=capex/Math.max(1,m.finance.depreciationYears)
   const interest=openingDebt*Math.max(0,m.finance.debtCost)/100
   const taxProject=Math.max(0,rev-op-dep)*m.finance.tax/100
   const taxEquity=Math.max(0,rev-op-dep-interest)*m.finance.tax/100
   const terminalRecovery=i===operatingPeriods-1?Math.max(0,m.finance.workingCapital):0
   const projectCash=rev-op-taxProject+terminalRecovery
   const principal=Math.min(openingDebt,annualPrincipal)
   const equityCash=rev-op-interest-taxEquity-principal+terminalRecovery
   projectFlows.push(projectCash)
   equityFlows.push(equityCash)
   annualRows.push({period:'بهره‌برداری '+(i+1),project:projectCash,equity:equityCash,debtOpening:openingDebt,interest,principal,tax:taxEquity})
   openingDebt=Math.max(0,openingDebt-principal)
  }
  return {flows:projectFlows,equityFlows,npv:npv(projectFlows,rate),irr:irr(projectFlows),mirr:mirr(projectFlows,(m.finance.financeRate??m.finance.debtCost)/100,(m.finance.reinvestmentRate??m.finance.equityCost)/100),equityNpv:npv(equityFlows,m.finance.equityCost/100),equityIrr:irr(equityFlows),equityMirr:mirr(equityFlows,(m.finance.financeRate??m.finance.debtCost)/100,(m.finance.reinvestmentRate??m.finance.equityCost)/100),annualRows,annualCapacity:cap,revenue:cap*revenuePrice,operatingCost:cap*variable+fixed,breakEven:revenuePrice>variable?fixed/(revenuePrice-variable):Number.POSITIVE_INFINITY,marketSize,capex,wacc,rate,totalUses,debtDraw}
 },[cap,capex,fixed,marketSize,m.finance,m.project.operatingYears,m.project.constructionYears,m.capacity.ramp,revenuePrice,rate,variable])
 const update=<K extends keyof Model>(key:K,value:Model[K])=>{
  if(key==='partners'||key==='partnerDistributionPercent'||
    (key==='scope'&&(value as Model['scope']).jointVenture!==m.scope.jointVenture))setReportPartnerFinance(null)
  setM(old=>({...old,[key]:value}))
 }
 const fixedAssetTimingIssues=capex-preOperatingCost>0.01&&!confirmedFixedInvestmentSchedule
  ?[...fixedInvestmentLifecycleInputs.warnings,...fixedInvestmentRegisterReconciliation.warnings,'زمان‌بندی CAPEX دارایی‌های ثابت برای تمام اقلام به تفکیک دوره مستند یا تأیید نشده است؛ خروجی مالی تا تکمیل دفتر سرمایه‌گذاری قابل تأیید نیست.']
  :[]
 const preOperatingTimingIssues=preOperatingCost>0.01&&!confirmedPreOperatingSchedule
  ?[...fixedInvestmentLifecycleInputs.warnings,...fixedInvestmentRegisterReconciliation.warnings,'زمان‌بندی هزینه‌های قبل از بهره‌برداری برای تمام اقلام به تفکیک دوره مستند یا تأیید نشده است؛ خروجی مالی تا تکمیل دفتر مربوط قابل تأیید نیست.']
  :[]
 const unintegratedFinancialDraftInputs=[...listUnintegratedFinancialDraftInputs(m.financialForms),...new Set([...fixedAssetTimingIssues,...preOperatingTimingIssues])]
 const economicAnalysisResult=useMemo(()=>{
  if(!m.scope.economicAnalysis||!reportPeriodicFinance?.valid)return null
  const planning=m.foundation.planning
  const frequency=planning.periodFrequency==='annual'?1:planning.periodFrequency==='semiannual'?2:planning.periodFrequency==='quarterly'?4:planning.periodFrequency==='monthly'?12:null
  if(!projectCalendarPeriods.length||!planning.dayCountBasis||!planning.cashFlowTiming||planning.cashFlowTiming==='unspecified'||!frequency)return null
  return buildProjectEconomicAnalysis(reportPeriodicFinance,projectCalendarPeriods,m.financialForms.economic.adjustments,
    m.financialForms.economic.discountRatePercent,planning.dayCountBasis,planning.cashFlowTiming,
    planning.valuationDate||undefined,planning.discountConvention??'actual-days',frequency,
    reportSalesTaxLedgerResult,reportSalesTaxLedgerResult!==null,
    m.financialForms.economic.discountRateSourceReference,m.financialForms.economic.discountRateSourceVerified)
 },[m.scope.economicAnalysis,reportPeriodicFinance,JSON.stringify(projectCalendarPeriods),JSON.stringify(m.financialForms.economic),m.foundation.planning.dayCountBasis,m.foundation.planning.cashFlowTiming,m.foundation.planning.valuationDate,m.foundation.planning.discountConvention,m.foundation.planning.periodFrequency,reportSalesTaxLedgerResult,m.financialForms.economic.discountRateSourceReference,m.financialForms.economic.discountRateSourceVerified])
 const reportFinancialInputIssues=[...unintegratedFinancialDraftInputs,...((m.financialForms.workingCapital??[]).length>0&&reportPeriodicFinance?.valid!==true?['financialForms.workingCapital:periodic-working-capital-schedule-not-valid']:[]),...((m.financialForms.sales??[]).length>0&&(reportPeriodicFinance?.valid!==true)?['financialForms.sales:product-operating-schedule-not-valid']:[]),...((m.financialForms.productionCosts??[]).length>0&&(reportPeriodicFinance?.valid!==true)?['financialForms.productionCosts:product-cost-schedule-not-valid']:[]),...((m.financialForms.tax?.system!==null||m.financialForms.tax?.rates?.length>0||m.financialForms.tax?.allowances?.length>0||m.financialForms.tax?.lossCarryForward!==null||m.financialForms.tax?.openingLossVintages?.length>0)&&(reportPeriodicFinance?.valid!==true)?['financialForms.tax:tax-schedule-not-valid']:[]),...((m.financialForms.loans??[]).length>0&&(reportPeriodicFinance?.valid!==true)?['financialForms.loans:loan-schedule-not-valid']:[]),...(((m.financialForms.salesTaxLedger?.openingBalance!=null)||(m.financialForms.salesTaxLedger?.inputCredits??[]).length>0||(m.financialForms.salesTaxLedger?.settlements??[]).length>0||(m.financialForms.sales??[]).some(sale=>sale.periods.some(period=>(period.salesTaxPercent??0)>0)))&&reportSalesTaxLedgerResult?.valid!==true?['financialForms.salesTaxLedger:sales-tax-ledger-not-valid']:[]),...(m.scope.economicAnalysis&&economicAnalysisResult?.valid!==true?['financialForms.economic:economic-analysis-not-valid']:[]),...(m.scope.foreignExchangeEffect&&!(m.financialForms.economic?.adjustments??[]).some(item=>item.effectType==='foreign-exchange')?['financialForms.economic:foreign-exchange-effect-required']:[]),...(m.scope.employmentEffects&&!(m.financialForms.economic?.adjustments??[]).some(item=>item.effectType==='employment')?['financialForms.economic:employment-effect-required']:[]),...(m.scope.valueAddedAnalysis&&reportValueAddedAnalysisResult?.valid!==true?['financialForms.economic:value-added-analysis-not-valid']:[]),...(m.scope.costCentreAnalysis&&(!(m.financialForms.cppCpsTraceItems??[]).length||reportCppCpsTraceLedger?.valid!==true)?['financialForms.cppCpsTraceItems:cost-centre-ledger-not-ready']:[]),...(m.scope.costAllocation&&(!(m.financialForms.cppCpsTraceItems??[]).length||reportCppCpsTraceLedger?.readyForCppPosting!==true||reportPeriodicFinance?.valid!==true)?['financialForms.economic:cost-allocation-not-ready']:[]),...(m.analysisMode!=='new'&&reportIncrementalEnterpriseAnalysis===null?['financialForms.existingEnterprise:incremental-analysis-not-ready']:[])]
 const activeFinanceResult=integratedFinanceResult
 const displayProjectFlows=activeFinanceResult?activeFinanceResult.years.map(r=>r.projectFreeCashFlow):model.flows
 const displayEquityFlows=activeFinanceResult?activeFinanceResult.years.map(r=>r.equityFreeCashFlow):model.equityFlows
 const displayNpv=activeFinanceResult?activeFinanceResult.npvProject:model.npv
 const displayIrr=activeFinanceResult?activeFinanceResult.irrProject:model.irr
 const displayMirr=activeFinanceResult?activeFinanceResult.mirrProject:model.mirr
 const displayEquityNpv=activeFinanceResult?activeFinanceResult.npvEquity:model.equityNpv
 const displayEquityIrr=activeFinanceResult?activeFinanceResult.irrEquity:model.equityIrr
 const displayEquityMirr=activeFinanceResult?activeFinanceResult.mirrEquity:model.equityMirr
 const displayWacc=activeFinanceResult?activeFinanceResult.wacc:wacc
 const displayDebtRows=activeFinanceResult?activeFinanceResult.years.filter(r=>r.year>Math.ceil(m.project.constructionYears)).map(r=>({period:'بهره‌برداری '+(r.year-Math.ceil(m.project.constructionYears)),debtOpening:r.debtBalance+r.principal-r.debtDrawdown-r.capitalizedInterest,interest:r.interest,principal:r.principal,project:r.cfads,dscr:r.dscr})):model.annualRows.map(r=>({...r,dscr:r.interest+r.principal>0?(r.project+r.interest)/(r.interest+r.principal):null}))
 const current=steps.findIndex(s=>s[0]===step)
 const required:Record<Step,string[]>={profile:['مشخصات پروژه','اطلاعات بازار'],stage:['محصول اصلی','ظرفیت اسمی'],process:['فناوری و مسیر تولید'],balance:['موازنه مواد و یوتیلیتی'],capex:['سرمایه‌گذاری دوره ساخت'],opex:['هزینه‌های دوره بهره‌برداری'],finance:['ساختار سرمایه و نرخ تنزیل'],cashflow:['جریان نقدی و شاخص‌ها'],results:['ارزیابی نهایی'],reports:['گزارش آماده ارائه']}
 const partnerSetupValid=!m.scope.jointVenture||(Array.isArray(m.partners)&&m.partners.length>0&&m.partners.length<=20&&m.partners.every(p=>!!p&&typeof p==='object'&&typeof p.id==='string'&&!!p.id.trim()&&typeof p.name==='string'&&!!p.name.trim()&&Number.isFinite(p.capitalContribution)&&p.capitalContribution>=0&&Number.isFinite(p.sharePercent)&&p.sharePercent>=0&&p.sharePercent<=100&&Number.isFinite(p.profitSharePercent)&&p.profitSharePercent>=0&&p.profitSharePercent<=100)&&Math.abs(m.partners.reduce((sum,p)=>sum+p.sharePercent,0)-100)<=0.01&&Math.abs(m.partners.reduce((sum,p)=>sum+p.profitSharePercent,0)-100)<=0.01&&Number.isFinite(m.partnerDistributionPercent)&&m.partnerDistributionPercent>=0&&m.partnerDistributionPercent<=100)
 const validRows=(rows:Row[])=>rows.every(row=>String(row.name??'').trim()&&String(row.unit??'').trim()&&[row.quantity,row.unitPrice].every(value=>Number.isFinite(value)&&value>=0))
 const hasPricedRows=(rows:Row[])=>rows.some(row=>Number.isFinite(row.quantity)&&row.quantity>0&&Number.isFinite(row.unitPrice)&&row.unitPrice>0)
 const hasTechnicalInputs=m.technical.some(row=>(row.valueText??'').trim()!==''||row.quantity>0||row.unitPrice>0)
 const hasMaterialInput=m.balance.some(row=>row.quantity>0&&(row.flowType==='input'||(row.flowType==null&&!isOutputMaterial(row.name))))
 const technicalParametersComplete=m.technical.length>0&&m.technical.every(row=>String(row.name??'').trim()&&(row.valueText??(row.quantity!==0?String(row.quantity):'')).trim()!==''&&String(row.unit??'').trim()!==''&&String(row.source??'').trim()!=='')
 const financeRatesValid=(m.finance.equity===0||m.finance.equityCost>0)&&(m.finance.debt===0||m.finance.debtCost>0)&&m.finance.tax>=0&&m.finance.tax<=100&&m.finance.depreciationYears>0&&(m.finance.method==='manual'?m.finance.manualRate>0:m.finance.method==='wacc'?wacc>0:false)
 const periodicModelValid=reportPeriodicFinance?.valid===true&&reportPeriodicFinance.rows.length===projectCalendarPeriods.length&&projectCalendarPeriods.length>0
 const done:Record<Step,boolean>={
  profile:!!String(m.project.name??'').trim()&&!!String(m.project.location??'').trim()&&(m.market.domesticPrice>0||m.market.exportPrice>0||productPricingComplete)&&partnerSetupValid,
  stage:!!m.stage&&m.products.length>0&&validRows(m.products)&&m.products.some(r=>String(r.name??'').trim()&&r.quantity>0)&&m.capacity.nameplate>0&&productCapacityMatchesNameplate,
  process:(!!String(m.process.technology??'').trim()||!!String(m.process.route??'').trim())&&hasTechnicalInputs&&technicalParametersComplete&&validRows(m.technical)&&validRows(m.balance)&&hasMaterialInput,
  balance:validRows(m.utilities)&&hasPricedRows(m.utilities),
  capex:validRows(m.capex)&&capex>0,
  opex:validRows(m.opex)&&sum(m.opex)>0,
  finance:m.finance.equity>=0&&m.finance.debt>=0&&m.finance.equity+m.finance.debt===100&&financeRatesValid,
  cashflow:periodicModelValid&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true),
  results:periodicModelValid&&model.flows.length>0&&model.flows.every(Number.isFinite)&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true),
  reports:periodicModelValid&&!!String(m.project.name??'').trim()&&reportFinancialInputIssues.length===0&&(!m.scope.jointVenture||reportPartnerFinance?.valid===true)
 }
 const completed=Object.values(done).filter(Boolean).length
 const go=(direction:number)=>{const next=Math.max(0,Math.min(steps.length-1,current+direction));setStep(steps[next][0])}
 return <section className="fw-page" dir={en?"ltr":"rtl"}>
  <header className="fw-head"><button className="secondary-button" onClick={onBack}><ArrowRight size={16}/> {t("بازگشت به پروژه‌ها","Back to Projects")}</button><div><h1>{m.project.name}</h1><p>{m.project.location} · {stageTitle(stage.id,stage.name)}</p></div><span className="fw-save"><Save size={14}/>{loaded?(saved?t('ذخیره شد','Saved')+' · '+saved:t('ذخیره خودکار فعال','Auto-save active')):t('در حال بارگذاری','Loading')}</span></header>
  {project.sourceReport&&<ComfarReferencePanel baseline={project.sourceReport} language={language}/> }
  <div className="fw-progress"><div><b>{t('پیشرفت تکمیل','Completion Progress')}</b><strong>{fmt(completed/steps.length*100)}٪</strong></div><i><span style={{width:(completed/steps.length*100)+'%'}}/></i></div>
  <nav className="fw-steps">{steps.map(([id,label],i)=><button key={id} className={step===id?'active':''} onClick={()=>setStep(id)}><small>{fmt(i+1)}</small><span>{en?(stepTitleEn[label]??label):label}</span>{done[id]&&<CheckCircle2 size={14}/>}</button>)}</nav>
  <main className="fw-content">
   {step==='profile'&&<><h2>{t('۱. تعریف پروژه و تحلیل بازار','1. Project Definition & Market Analysis')}</h2><p className="fw-lead">{t('اطلاعات عمومی پروژه و مبنای زمانی و پولی را مشخص کنید.','Define general project information and the time and currency basis.')}</p><div className="fw-grid"><label className="fw-field"><span>{t('نوع پروژه','Project Type')}</span><select value={m.projectCategory} onChange={e=>update('projectCategory',e.target.value as Model['projectCategory'])}><option value="industrial">{t('صنعتی','Industrial')}</option><option value="maritime">{t('دریایی','Maritime')}</option><option value="agricultural">{t('کشاورزی','Agricultural')}</option><option value="infrastructure">{t('زیرساختی','Infrastructure')}</option><option value="tourism">{t('گردشگری','Tourism')}</option><option value="mining">{t('معدنی','Mining')}</option><option value="other">{t('سایر','Other')}</option></select></label><label className="fw-field"><span>{t('طبقه‌بندی پروژه','Project Classification')}</span><select value={m.analysisMode} onChange={e=>update('analysisMode',e.target.value as Model['analysisMode'])}><option value="new">{t('پروژه جدید','New Project')}</option><option value="expansion">{t('توسعه/بازسازی واحد موجود','Expansion/Rehabilitation of Existing Enterprise')}</option><option value="rehabilitation">{t('بازسازی واحد موجود','Rehabilitation Project')}</option><option value="combined">{t('توسعه همراه با بازسازی','Expansion and Rehabilitation')}</option></select></label><FormField label="نام پروژه" value={m.project.name} onChange={v=>update('project',{...m.project,name:v})} type="text"/><FormField label="موقعیت پروژه" value={m.project.location} onChange={v=>update('project',{...m.project,location:v})} type="text"/><FormField label="سرمایه‌گذار / مجری" value={m.project.owner} onChange={v=>update('project',{...m.project,owner:v})} type="text"/><FormField label="سال شروع (شمسی)" value={m.project.startYear} unit="سال" onChange={v=>update('project',{...m.project,startYear:v})}/><FormField label="دوره ساخت" value={m.project.constructionYears} unit="سال" onChange={v=>update('project',{...m.project,constructionYears:v})}/><FormField label="دوره بهره‌برداری" value={m.project.operatingYears} unit="سال" onChange={v=>update('project',{...m.project,operatingYears:v})}/><label className="fw-field"><span>واحد پول پایه</span><select value={m.project.currency} onChange={e=>update('project',{...m.project,currency:e.target.value})}><option value="">{t('انتخاب واحد پول','Select currency')}</option><option>ریال</option><option>تومان</option><option>دلار آمریکا</option><option>یورو</option><option>میلیون ریال</option><option>میلیون تومان</option></select></label><FormField label="نرخ تبدیل ارز به واحد پایه" value={m.project.fxRate} onChange={v=>update('project',{...m.project,fxRate:v})}/></div><ProjectFoundationPanel value={m.foundation} onChange={v=>update('foundation',v)} language={language}/><ProjectModelStructurePanel language={language} configuration={{projectType:m.projectCategory,analysisLevel:m.scope.studyLevel,enabledFeatures:[m.scope.costCentreAnalysis&&'cost-centres',m.scope.costAllocation&&'cost-allocation',m.foundation.inflation.active&&'inflation',m.scope.jointVenture&&'joint-venture',m.analysisMode!=='new'&&'expansion-rehabilitation',m.scope.economicAnalysis&&'economic-analysis'].filter((feature):feature is ProjectModelFeature=>Boolean(feature))}}/><ProjectModelHelpCoveragePanel value={m.financialForms.helpDriven} onChange={v=>update('financialForms',{...m.financialForms,helpDriven:v})} language={language}/><ProjectModelFinancialFormsPanel value={m.financialForms} onChange={v=>update('financialForms',v)} language={language} foundation={m.foundation} projectPeriods={projectCalendarPeriods}/><div className="fw-card"><h3>{t('سطح مطالعه و دامنه تحلیل','Level and Scope of Analysis')}</h3><div className="fw-grid"><label className="fw-field"><span>{t('سطح مطالعه','Study Level')}</span><select value={m.scope.studyLevel} onChange={e=>update('scope',{...m.scope,studyLevel:e.target.value as Model['scope']['studyLevel']})}><option value="opportunity">{t('مطالعه فرصت','Opportunity Study')}</option><option value="feasibility">{t('مطالعه امکان‌سنجی','Feasibility Study')}</option></select></label><label className="fw-field"><span>{t('پروژه مشارکت مشترک','Joint-venture Project')}</span><input type="checkbox" checked={m.scope.jointVenture} onChange={e=>update('scope',{...m.scope,jointVenture:e.target.checked})}/></label>{m.scope.jointVenture&&<div className="fw-card"><h4>{t('شرکای مشارکت مشترک','Joint-venture Partners')}</h4><p className="fw-hint">{t('حداکثر ۲۰ شریک قابل تعریف است. سهم سرمایه و سهم مشارکت در سود جداگانه ثبت می‌شود؛ جریان نقدی منفی بر اساس سهم سرمایه و جریان نقدی مثبت قابل تقسیم بر اساس سهم سود تخصیص می‌یابد. درصد قابل تقسیم را مشخص کنید؛ مبلغ آورده قراردادی شرکا جداگانه برای کنترل نمایش داده می‌شود و دوباره از جریان نقدی کسر نمی‌شود.','Up to 20 partners can be defined. Equity share and profit-sharing percentage are entered separately. Negative equity cash flows are allocated by capital shares and the selected distributable positive cash flow by profit shares. Set the distribution percentage; declared capital contributions are shown separately for control and are not deducted twice.')}</p><FormField label={en?'Positive Equity Cash Flow Distributed (%)':'درصد جریان نقدی مثبت قابل تقسیم'} value={m.partnerDistributionPercent??100} unit="%" onChange={v=>update('partnerDistributionPercent',Math.max(0,Math.min(100,v)))}/>{m.partners.map(partner=><div className="fw-grid" key={partner.id}><FormField label={en?'Partner name':'نام شریک'} value={partner.name} onChange={v=>update('partners',m.partners.map(p=>p.id===partner.id?{...p,name:v}:p))} type="text"/><FormField label={en?'Equity contribution':'آورده سرمایه‌ای'} value={partner.capitalContribution} unit={m.project.currency} onChange={v=>update('partners',m.partners.map(p=>p.id===partner.id?{...p,capitalContribution:v}:p))}/><FormField label={en?'Equity share (%)':'سهم سرمایه (%)'} value={partner.sharePercent} unit="%" onChange={v=>update('partners',m.partners.map(p=>p.id===partner.id?{...p,sharePercent:v}:p))}/><FormField label={en?'Profit-sharing percentage (%)':'سهم مشارکت در سود (%)'} value={partner.profitSharePercent} unit="%" onChange={v=>update('partners',m.partners.map(p=>p.id===partner.id?{...p,profitSharePercent:v}:p))}/><button className="secondary-button" onClick={()=>update('partners',m.partners.filter(p=>p.id!==partner.id))}>{t('حذف شریک','Remove Partner')}</button></div>)}<div className="fw-result">{t('جمع سهم سرمایه شرکا','Total Partner Equity Share')}: <b>{fmt(m.partners.reduce((sum,p)=>sum+p.sharePercent,0))}%</b> · {t('جمع سهم مشارکت در سود','Total Profit Share')}: <b>{fmt(m.partners.reduce((sum,p)=>sum+p.profitSharePercent,0))}%</b></div><button className="secondary-button" disabled={m.partners.length>=20} onClick={()=>update('partners',[...m.partners,{id:crypto.randomUUID?.()??String(Date.now()),name:'',sharePercent:0,capitalContribution:0,profitSharePercent:0}])}>{t('افزودن شریک','Add Partner')}</button></div>}<label className="fw-field"><span>{t('تحلیل اقتصادی','Economic Analysis')}</span><input type="checkbox" checked={m.scope.economicAnalysis} onChange={e=>update('scope',{...m.scope,economicAnalysis:e.target.checked||m.scope.valueAddedAnalysis,foreignExchangeEffect:e.target.checked?m.scope.foreignExchangeEffect:false,employmentEffects:e.target.checked?m.scope.employmentEffects:false})}/></label><label className="fw-field"><span>{t('تحلیل مراکز هزینه','Cost Centre Analysis')}</span><input type="checkbox" checked={m.scope.costCentreAnalysis} onChange={e=>update('scope',{...m.scope,costCentreAnalysis:e.target.checked||m.scope.costAllocation})}/></label><label className="fw-field"><span>{t('تخصیص هزینه','Cost Allocation')}</span><input type="checkbox" checked={m.scope.costAllocation} onChange={e=>update('scope',{...m.scope,costAllocation:e.target.checked,costCentreAnalysis:e.target.checked?true:m.scope.costCentreAnalysis})}/></label><label className="fw-field"><span>{t('تحلیل ارزش افزوده','Value-added Analysis')}</span><input type="checkbox" checked={m.scope.valueAddedAnalysis} onChange={e=>update('scope',{...m.scope,valueAddedAnalysis:e.target.checked,economicAnalysis:e.target.checked?true:m.scope.economicAnalysis})}/></label><label className="fw-field"><span>{t('اثر ارز خارجی','Foreign Exchange Effect')}</span><input type="checkbox" checked={m.scope.foreignExchangeEffect} onChange={e=>update('scope',{...m.scope,economicAnalysis:e.target.checked?true:m.scope.economicAnalysis,foreignExchangeEffect:e.target.checked})}/></label><label className="fw-field"><span>{t('اثر اشتغال','Employment Effects')}</span><input type="checkbox" checked={m.scope.employmentEffects} onChange={e=>update('scope',{...m.scope,economicAnalysis:e.target.checked?true:m.scope.economicAnalysis,employmentEffects:e.target.checked})}/></label></div><p className="fw-hint">{t('تحلیل مالی حداقل دامنه محاسبه است. با فعال‌کردن تخصیص هزینه، تحلیل مراکز هزینه نیز فعال می‌شود. ماژول‌های اقتصادی و آثار ارز خارجی و اشتغال باید با داده‌های اقتصادی مربوط تکمیل شوند.','Financial Analysis is the minimum calculation scope. Selecting Cost Allocation also enables Cost Centre Analysis. Economic Analysis and foreign exchange/employment effects require their corresponding economic input data.')}</p></div><div className="fw-card"><h3>{t('تحلیل بازار و برنامه فروش','Market Analysis & Sales Plan')}</h3><p className="fw-lead">{t('بازار هر محصول جداگانه ارزیابی شود؛ اعداد بدون منبع، فرض کاربر محسوب می‌شوند.','Assess each product market separately; values without sources are treated as user assumptions.')}</p><div className="fw-grid"><FormField label="تقاضای سالانه بازار" value={m.market.demand} unit="تن" onChange={v=>update('market',{...m.market,demand:v})}/><FormField label="تولید داخلی" value={m.market.domesticProduction} unit="تن" onChange={v=>update('market',{...m.market,domesticProduction:v})}/><FormField label="واردات" value={m.market.imports} unit="تن" onChange={v=>update('market',{...m.market,imports:v})}/><FormField label="صادرات" value={m.market.exports} unit="تن" onChange={v=>update('market',{...m.market,exports:v})}/><FormField label="سهم هدف پروژه از بازار" value={m.market.targetShare} unit="درصد" onChange={v=>update('market',{...m.market,targetShare:v})}/><><FormField label="قیمت فروش داخلی" value={m.market.domesticPrice} unit={m.project.currency+'/تن'} onChange={v=>update('market',{...m.market,domesticPrice:v})}/><FormField label="قیمت فروش صادراتی" value={m.market.exportPrice} unit={m.project.currency+'/تن'} onChange={v=>update('market',{...m.market,exportPrice:v})}/><FormField label="سهم فروش داخلی" value={m.market.domesticShare} unit="درصد" onChange={v=>update('market',{...m.market,domesticShare:v})}/></><FormField label="رشد سالانه تقاضا" value={m.market.growth} unit="درصد" onChange={v=>update('market',{...m.market,growth:v})}/></div>
<div className="fw-result">مصرف ظاهری بازار (تولید + واردات − صادرات): <b>{fmt(marketSize)} تن</b></div></div></>}
   {step==='stage'&&<><h2>{t('۲. محصولات و ظرفیت تولید','2. Products & Production Capacity')}</h2><p className="fw-lead">{t('هر پروژه می‌تواند یک یا چند محصول داشته باشد. نوع خط و محصول را مستقل تعریف کنید.','A project may include one or more products. Define each product and production line separately.')}</p><div className="fw-card"><h3>{t('محصولات و ظرفیت محصولی','Products & Product Capacity')}</h3><RowEditor title={fieldLabel('فهرست محصولات')} rows={m.products} onChange={v=>update('products',v)} defaultUnit="تن/سال" blankZero={isRawTemplate||project.templateId==='comfar-import'}/>{isSteelProject&&m.products.length>0&&m.capacity.nameplate>0&&!productCapacityMatchesNameplate&&<div className="fw-validation" role="alert"><b>{t('جمع ظرفیت محصولات باید با ظرفیت اسمی کل برابر باشد.','The sum of product capacities must equal total nameplate capacity.')}</b><p>{t('جمع ظرفیت محصولی: ','Product capacity total: ')}{fmt(productCapacityTotal)} · {t('ظرفیت اسمی کل: ','Total nameplate capacity: ')}{fmt(m.capacity.nameplate)}</p></div>} </div><div className="fw-grid"><FormField label="ظرفیت اسمی کل" value={m.capacity.nameplate} unit={project.industry==='انرژی و نیروگاه'?'مگاوات':project.industry==='فولاد و صنایع معدنی'?'تن/سال':'واحد/سال'} onChange={v=>update('capacity',{...m.capacity,nameplate:v})}/><FormField label="روز کاری سالانه" value={m.capacity.operatingDays} unit="روز" onChange={v=>update('capacity',{...m.capacity,operatingDays:v})}/><FormField label="ساعت کاری روزانه" value={m.capacity.hoursPerDay} unit="ساعت" onChange={v=>update('capacity',{...m.capacity,hoursPerDay:v})}/><FormField label="دسترس‌پذیری" value={m.capacity.availability} unit="درصد" onChange={v=>update('capacity',{...m.capacity,availability:v})}/><FormField label="بازده محصول قابل فروش" value={m.capacity.yield} unit="درصد" onChange={v=>update('capacity',{...m.capacity,yield:v})}/></div><div className="fw-result">{fieldLabel('ظرفیت عملی قابل فروش')}: <b>{fmt(cap)} تن در سال</b></div><div className="fw-grid">{m.capacity.ramp.map((v,i)=><FormField key={i} label={'Ramp-up سال '+(i+1)} value={v} unit="درصد" onChange={x=>update('capacity',{...m.capacity,ramp:m.capacity.ramp.map((r,j)=>j===i?x:r)})}/>)}</div></>}
   {step==='process'&&<><h2>{t('۳. فرآیند تولید و موازنه مواد','3. Production Process & Material Balance')}</h2><p className="fw-lead">{stage.id==='other'?t('فرم‌های این پروژه خام هستند؛ عنوان و ردیف‌های موردنیاز را متناسب با پروژه تعریف کنید.','This is a blank project form. Define the required headings and rows for your project.'):en?(routeEn[stage.route]??stage.route)+'. Complete the technical fields for the selected stage below.':stage.route+'. فیلدهای فنی متناسب با مرحله انتخابی در ادامه تکمیل می‌شوند.'}</p><div className="fw-grid"><FormField label="فناوری / تکنولوژی منتخب" value={m.process.technology} onChange={v=>update('process',{...m.process,technology:v})} type="text"/><FormField label="شرح مسیر فرآیند" value={m.process.route} onChange={v=>update('process',{...m.process,route:v})} type="text"/><FormField label="تجهیزات اصلی" value={m.process.equipment} onChange={v=>update('process',{...m.process,equipment:v})} type="text"/><FormField label="ظرفیت گلوگاه خط" value={m.process.bottleneck} unit="تن/سال" onChange={v=>update('process',{...m.process,bottleneck:v})}/></div><TechnicalParameterEditor title={t('پارامترهای فنی اختصاصی '+stage.name,'Stage-Specific Technical Parameters — '+stageTitle(stage.id,stage.name))} rows={m.technical} onChange={v=>update('technical',v)} language={language}/> <label className="fw-field"><span>یادداشت مهندسی و فرضیات طراحی</span><textarea value={m.process.notes} onChange={e=>update('process',{...m.process,notes:e.target.value})}/></label><RowEditor title="موازنه مواد و مواد فرآیندی" rows={m.balance} onChange={v=>update('balance',v)} defaultUnit="تن/تن محصول" blankZero={isRawTemplate} showFlowType/><p className="fw-hint">{t('جهت هر ردیف را ورودی/مصرف یا خروجی/محصول تعیین کنید. فقط ردیف‌های ورودی در هزینه مواد اولیه محاسبه می‌شوند؛ محصولات جانبی قابل فروش را در فهرست محصولات نیز ثبت کنید تا درآمد آن‌ها در مدل مالی منظور شود.','Set each row as an input/consumption or output/product. Only input rows enter raw-material operating costs; add saleable by-products to the product list as well so their revenue is included in the financial model.')}</p> </>}
   {step==='balance'&&<><h2>{t('۴. مصارف زیربنایی و فرآیندی','4. Utilities & Process Consumables')}</h2><p className="fw-lead">{t('مصارف زیرساختی و فرآیندی شامل آب، برق، گاز و سایر یوتیلیتی‌ها را بر اساس ظرفیت و ساعات کار ثبت کنید.','Record water, electricity, gas and other utility consumption based on capacity and operating hours.')}</p><RowEditor title={fieldLabel('مصارف زیربنایی و یوتیلیتی')} rows={m.utilities} onChange={v=>update('utilities',v)} defaultUnit="واحد/تن محصول" blankZero={isRawTemplate}/> <div className="fw-result">{fieldLabel('هزینه یوتیلیتی به ازای هر تن')}: <b>{fmt(sum(m.utilities),2)} {m.project.currency}/تن</b> · {fieldLabel('هزینه سالانه در ظرفیت عملی')}: <b>{fmt(sum(m.utilities)*cap)} {m.project.currency}</b></div></>}
   {step==='capex'&&<><h2>{t('۵. هزینه‌های دوره ساخت (CAPEX)','5. Construction Costs (CAPEX)')}</h2><p className="fw-lead">{t('اقلام سرمایه‌گذاری را با مبلغ، واحد پول و منبع برآورد ثبت کنید.','Enter investment items with amount, currency and estimate source.')}</p><RowEditor title={fieldLabel('ساختار هزینه‌های سرمایه‌ای')} rows={m.capex} onChange={v=>update('capex',v)} defaultUnit={m.project.currency} blankZero={isRawTemplate}/> <FixedInvestmentPanel value={m.fixedInvestmentItems} foundation={m.foundation} projectStartYear={m.project.startYear} periodCount={Math.max(1,Math.ceil(m.project.constructionYears||1)+Math.ceil(m.project.operatingYears||1))} capexTotal={capex} preOperatingCost={preOperatingCost} onChange={v=>update('fixedInvestmentItems',v)} language={language} blankTemplate={isRawTemplate}/><div className="fw-result">{fieldLabel('جمع سرمایه‌گذاری ثبت‌شده')}: <b>{fmt(capex)} {m.project.currency}</b></div></>}
   {step==='opex'&&<><h2>{t('۶. هزینه‌های دوره بهره‌برداری (OPEX)','6. Operating Costs (OPEX)')}</h2><p className="fw-lead">{t('هزینه‌های مواد اولیه و انرژی از موازنه مرحله قبل به‌صورت خودکار منتقل می‌شوند؛ در این بخش فقط سایر هزینه‌های متغیر و هزینه‌های ثابت را وارد کنید.','Raw material and energy costs are transferred automatically from the previous balance. Enter only other variable and fixed costs here.')}</p><RowEditor title={fieldLabel('مواد، انرژی، نیروی انسانی، تعمیرات و سربار')} rows={m.opex} onChange={v=>update('opex',v)} defaultUnit={m.project.currency+'/سال'} blankZero={isRawTemplate}/> <div className="fw-result">{fieldLabel('هزینه نقدی سالانه در ظرفیت عملی')}: <b>{fmt(model.operatingCost)} {m.project.currency}</b></div></>}
   {step==='finance'&&<><h2>{t('۷. تأمین مالی و نرخ تنزیل','7. Financing & Discount Rate')}</h2><p className="fw-lead">{t('سهم آورده و تسهیلات باید جمعاً ۱۰۰ درصد منابع را تشکیل دهند. در قالب خام، نسبت آورده و بدهی و نرخ‌های تأمین مالی خالی می‌مانند تا کاربر آن‌ها را تعیین کند.','Equity and debt must total 100% of funding. In the blank template, equity/debt shares and financing rates remain empty until defined by the user.')}</p><div className="fw-grid"><FormField label="سهم آورده سرمایه‌گذار" value={m.finance.equity} unit="درصد" onChange={v=>update('finance',{...m.finance,equity:v,debt:100-v})}/><FormField label="سهم تسهیلات" value={m.finance.debt} unit="درصد" onChange={v=>update('finance',{...m.finance,debt:v,equity:100-v})}/><FormField label="هزینه حقوق صاحبان سهام (Ke)" value={m.finance.equityCost} unit="درصد" onChange={v=>update('finance',{...m.finance,equityCost:v})}/><FormField label="نرخ تسهیلات (Kd)" value={m.finance.debtCost} unit="درصد" onChange={v=>update('finance',{...m.finance,debtCost:v})}/><FormField label="نرخ مالیات" value={m.finance.tax} unit="درصد" onChange={v=>update('finance',{...m.finance,tax:v})}/><FormField label="عمر استهلاک" value={m.finance.depreciationYears} unit="سال" onChange={v=>update('finance',{...m.finance,depreciationYears:v})}/><FormField label="نرخ تأمین مالی کسری‌ها (MIRR)" value={m.finance.financeRate??m.finance.debtCost} unit="درصد" onChange={v=>update('finance',{...m.finance,financeRate:v})}/><FormField label="نرخ سرمایه‌گذاری مجدد (MIRR)" value={m.finance.reinvestmentRate??m.finance.equityCost} unit="درصد" onChange={v=>update('finance',{...m.finance,reinvestmentRate:v})}/><FormField label="سرمایه در گردش" value={m.finance.workingCapital} unit={m.project.currency} onChange={v=>update('finance',{...m.finance,workingCapital:v})}/></div>
<div className="fw-choice"><button className={m.finance.method==='unspecified'?'active':''} onClick={()=>update('finance',{...m.finance,method:'unspecified'})}>{fieldLabel('انتخاب روش نرخ تنزیل')}</button><button className={m.finance.method==='manual'?'active':''} onClick={()=>update('finance',{...m.finance,method:'manual'})}>{fieldLabel('نرخ تنزیل دستی')}</button><button className={m.finance.method==='wacc'?'active':''} onClick={()=>update('finance',{...m.finance,method:'wacc'})}>{fieldLabel('محاسبه WACC')}</button></div>{m.finance.method==='manual'&&<FormField label="نرخ تنزیل" value={m.finance.manualRate} unit="درصد" onChange={v=>update('finance',{...m.finance,manualRate:v})}/>}<div className="fw-result">{fieldLabel('WACC محاسبه‌شده')}: <b>{fmt(displayWacc===null?NaN:displayWacc*100,2)}٪</b> · {fieldLabel('نرخ تنزیل فعال')}: <b>{fmt(rate*100,2)}٪</b></div><p className="fw-hint">{t('WACC = E/(E+D) × Ke + D/(E+D) × Kd × (1−T). جریان نقدی کل سرمایه از معاملات تأمین مالی جداست. جریان نقدی سهامدار در این کارت، خلاصه‌ای مقدماتی بر پایه مفروضات ساده تأمین مالی است و نباید جایگزین برنامه تفصیلی بدهی تلقی شود. برای زمان‌بندی تاریخ‌دار برداشت وام، دوره تنفس، اقساط ماهانه یا فصلی، چند تسهیلات، بهره سرمایه‌ای، CFADS و DSCR، از موتور مالی یکپارچه در مرحله «جریان نقدی و شاخص‌های مالی» استفاده کنید. نتایج این خلاصه تا تطبیق با آن موتور و اسناد واقعی تأمین مالی، تأیید نهایی نیست.','WACC = E/(E+D) × Ke + D/(E+D) × Kd × (1−T). Total-investment cash flow is separate from financing transactions. Equity cash flow allocates debt to construction and working capital, assumes full debt drawdown at the start of operations and equal principal repayment during the operating period. Construction-period interest is not modelled in this version. This is a simplified, replaceable repayment assumption; grace periods, quarterly/monthly instalments, multiple loans and capitalised interest require detailed modelling.')}</p></>}
   {step==='results'&&<><h2>{t('۹. جمع‌بندی و ارزیابی نهایی','9. Final Summary & Evaluation')}</h2><p className="fw-lead">{t('در این مرحله کفایت فنی، بازار، هزینه‌ها، تأمین مالی و ریسک‌های کلیدی طرح را کنترل کنید.','Review technical feasibility, market assumptions, costs, financing and key project risks.')}</p><RowEditor title="دفتر ثبت ریسک و متغیرهای حساس" rows={m.risks} onChange={v=>update('risks',v)} defaultUnit="درصد" blankZero={isRawTemplate}/> <div className="fw-card"><h3>{t('سناریوهای پیشنهادی برای ارزیابی نهایی','Suggested Scenarios for Final Evaluation')}</h3><ul className="fw-checklist"><li>{t('سناریوی پایه: مفروضات فعلی','Base case: current assumptions')}</li><li>{t('سناریوی خوش‌بینانه: افزایش قیمت فروش و ظرفیت','Upside case: higher selling prices and capacity')}</li><li>{t('سناریوی بدبینانه: افزایش هزینه خوراک، افت تولید و تأخیر راه‌اندازی','Downside case: higher feed costs, lower output and commissioning delays')}</li></ul></div></>}
   {step==='cashflow'&&<><h2>{t('۸. جریان نقدی و شاخص‌های مالی','8. Cash Flow & Financial Metrics')}</h2>{unintegratedFinancialDraftInputs.length>0&&<div className="fw-validation" role="alert"><b>{t('محاسبه مالی متوقف شد: ورودی‌های فرم جامع هنوز به موتور محاسبات متصل نیستند.','Financial calculation is blocked: comprehensive-form inputs are not yet connected to the calculation engine.')}</b><p>{t('برای جلوگیری از نمایش خروجی گمراه‌کننده، تا اتصال و آزمون این ورودی‌ها، شاخص‌ها و جریان‌های مالی پنهان شده‌اند.','To prevent misleading outputs, financial metrics and cash flows are hidden until these inputs are integrated and tested.')}</p><ul>{reportFinancialInputIssues.slice(0,40).map(item=><li key={item}>{describeUnintegratedFinancialDraftInput(item,language)}</li>)}{reportIncrementalEnterpriseIssues.map((item,index)=><li key={'existing-enterprise-'+index}>{item}</li>)}</ul>{unintegratedFinancialDraftInputs.length>40&&<small>{t('و موارد بیشتر: ','And more: ')}{unintegratedFinancialDraftInputs.length-40}</small>}</div>}<div style={{display:unintegratedFinancialDraftInputs.length?'none':'block'}}><p className="fw-lead">{t('نتایج زیر از داده‌های ثبت‌شده محاسبه شده‌اند و تا تکمیل منابع و زمان‌بندی، مقدماتی‌اند.','The following results are calculated from entered data and remain preliminary until sources and timing are fully validated.')}</p><div className="fw-kpis"><article><small>{fieldLabel('CAPEX ثبت‌شده')}</small><b>{fmt(capex)}</b></article><article><small>{fieldLabel('ظرفیت عملی قابل فروش')}</small><b>{fmt(cap)} تن/سال</b></article><article><small>NPV</small><b>{fmt(displayNpv??NaN)}</b></article><article><small>{fieldLabel('IRR کل سرمایه')}</small><b>{displayIrr != null && Number.isFinite(displayIrr)?fmt(displayIrr*100,2)+'٪':t('قابل محاسبه نیست','Not calculable')}</b></article><article><small>{fieldLabel('MIRR کل سرمایه')}</small><b>{displayMirr != null && Number.isFinite(displayMirr)?fmt(displayMirr*100,2)+'٪':t('قابل محاسبه نیست','Not calculable')}</b></article><article><small>{fieldLabel('NPV حقوق صاحبان سهام')}</small><b>{fmt(displayEquityNpv??NaN)}</b></article><article><small>{fieldLabel('IRR حقوق صاحبان سهام')}</small><b>{displayEquityIrr != null && Number.isFinite(displayEquityIrr)?fmt(displayEquityIrr*100,2)+'٪':t('قابل محاسبه نیست','Not calculable')}</b></article><article><small>{fieldLabel('MIRR حقوق صاحبان سهام')}</small><b>{displayEquityMirr != null && Number.isFinite(displayEquityMirr)?fmt(displayEquityMirr*100,2)+'٪':t('قابل محاسبه نیست','Not calculable')}</b></article><article><small>{fieldLabel('قیمت فروش ترکیبی')}</small><b>{fmt(revenuePrice)}</b></article><article><small>{fieldLabel('مصرف ظاهری بازار')}</small><b>{fmt(marketSize)} تن</b></article><article><small>{fieldLabel('ظرفیت سربه‌سر')}</small><b>{Number.isFinite(model.breakEven)?fmt(model.breakEven)+' تن':t('قابل محاسبه نیست','Not calculable')}</b></article></div><div className="fw-card"><h3>{t('جریان نقدی آزاد کل سرمایه (بدون معاملات تأمین مالی)','Total Investment Free Cash Flow (Before Financing)')}</h3>{displayProjectFlows.map((value,i)=><div className="fw-validation" key={i}><span>{i<Math.max(1,Math.ceil(m.project.constructionYears||1))?t('ساخت ـ سال ','Construction — Year ')+(i+1):t('بهره‌برداری ـ سال ','Operation — Year ')+(i-Math.max(1,Math.ceil(m.project.constructionYears||1))+1)}</span><b>{fmt(value)} {m.project.currency}</b></div>)}</div><div className="fw-card"><h3>{t('جریان نقدی حقوق صاحبان سهام (پس از تأمین مالی)','Equity Cash Flow (After Financing)')}</h3>{displayEquityFlows.map((value,i)=><div className="fw-validation" key={i}><span>{i<Math.max(1,Math.ceil(m.project.constructionYears||1))?fieldLabel('آورده ساخت ـ سال')+' '+(i+1):fieldLabel('سهامدار ـ سال')+' '+(i-Math.max(1,Math.ceil(m.project.constructionYears||1))+1)}</span><b>{fmt(value)} {m.project.currency}</b></div>)}</div><div className="fw-card"><h3>{t('برنامه سالانه بدهی و خدمت بدهی','Annual Debt & Debt-Service Schedule')}</h3>{displayDebtRows.map((row,i)=><div className="fw-validation" key={i}><span>{en?`Operation ${i+1}`:row.period} · {fieldLabel('مانده اول دوره')} {fmt(row.debtOpening)}</span><b>{fieldLabel('بهره')} {fmt(row.interest)} · {fieldLabel('اصل')} {fmt(row.principal)} · DSCR {row.dscr==null?'—':fmt(row.dscr,2)+'x'}</b></div>)}</div><div className="fw-card"><h3>{t('چک‌لیست کنترل تکمیل','Completion Checklist')}</h3>{steps.map(([id,label])=><div className="fw-validation" key={id}><span>{fieldLabel(label)}</span>{done[id]?<b className="good">{fieldLabel('تکمیل اولیه')}</b>:<b className="missing">{fieldLabel('نیازمند تکمیل')}</b>}</div>)}</div><p className="fw-hint">{t('این کارت فقط خلاصهٔ سریع جریان نقدی است. برای برنامه تفصیلی وام، CFADS و DSCR، سرمایه در گردش مبتنی بر چرخه عملیاتی، استهلاک دارایی‌به‌دارایی، انتقال زیان مالیاتی، تحلیل حساسیت و تطبیق سه صورت مالی از موتور یکپارچه پایین همین صفحه استفاده کنید. بهره سرمایه‌ای نباید هم‌زمان در CAPEX و جریان نقدی دوباره‌شماری شود. ارقام نهایی همچنان باید با قراردادهای واقعی و داده‌های حسابداری پروژه کنترل شوند.','This card is a quick cash-flow summary only. Use the integrated engine below for detailed loan schedules, CFADS and DSCR, operating-cycle working capital, asset-level depreciation, tax-loss carry-forward, sensitivity analysis and three-statement reconciliation. Capitalised interest must not be double-counted in both CAPEX and cash flow. Final figures must still be checked against actual contracts and project accounting data.')}</p>{m.analysisMode!=='new'&&<ExpansionRehabilitationPanel projectId={project.id} currency={m.project.currency} constructionYears={m.project.constructionYears} operatingYears={m.project.operatingYears} foundation={m.foundation} language={language} onStartingAssetsChange={handleStartingAssetsChange} onStartingBalancesChange={handleStartingBalancesChange} onIncrementalAnalysisChange={handleIncrementalAnalysisChange}/>}</div></>}
   {step==='reports'&&<><h2>{t('۱۰. گزارش و خروجی‌ها','10. Reports & Outputs')}</h2>{reportFinancialInputIssues.length>0?<div className="fw-validation" role="alert"><b>{t('گزارش مالی قابل تولید نیست: ورودی‌های فرم جامع هنوز به موتور محاسبات متصل نشده‌اند.','Financial report is unavailable: comprehensive-form inputs are not yet integrated with the calculation engine.')}</b><p>{t('پس از اتصال و آزمون ورودی‌های زیر، گزارش مالی فعال خواهد شد.','The financial report will be enabled after the following inputs are integrated and tested.')}</p><ul>{reportFinancialInputIssues.slice(0,40).map(item=><li key={item}>{describeUnintegratedFinancialDraftInput(item,language)}</li>)}</ul></div>:<><p className="fw-lead">{t('پیش‌نمایش گزارش خلاصه طرح بر اساس اطلاعات ثبت‌شده. برای تهیه PDF از گزینه چاپ و ذخیره به‌صورت PDF مرورگر استفاده کنید.','Preview the summary report based on entered data. To create a PDF, use the browser print option and choose Save as PDF.')}</p><div className="fw-card fw-report"><div className="fw-report-head"><div><h3>{m.project.name}</h3><p>{m.project.location} · {stageTitle(stage.id,stage.name)} · {fieldLabel('سرمایه‌گذار / مجری')}: {m.project.owner||fieldLabel('ثبت نشده')}</p></div><span>{fieldLabel('پیش‌نمایش گزارش')}</span></div>{m.scope.costCentreAnalysis&&reportCppCpsTraceLedger?.valid&&<div className="fw-card"><h3>{fieldLabel('تحلیل مراکز هزینه')}</h3><p className="fw-hint">{fieldLabel('جمع‌های مستند و جمع کامل به تفکیک مرکز و دوره؛ علامت خط تیره نشان‌دهنده داده تأییدنشده یا تخصیص ناقص است.')}</p><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{fieldLabel('مرکز هزینه')}</th><th>{fieldLabel('مواد')}</th><th>{fieldLabel('نیروی انسانی')}</th><th>{fieldLabel('انرژی')}</th><th>{fieldLabel('تعمیرات')}</th><th>{fieldLabel('سربار')}</th><th>{fieldLabel('جمع مستند')}</th><th>{fieldLabel('جمع کامل به تفکیک دوره')}</th></tr></thead><tbody>{Object.entries(reportCppCpsTraceLedger.knownIncrementalByCostCentre).map(([centre,total])=><tr key={centre}><td>{m.financialForms.costCentres?.find(item=>item.id===centre)?.name||centre}</td>{(['materials','labour','energy','maintenance','overhead'] as const).map(category=><td key={category}>{fmt(reportCppCpsTraceLedger.knownIncrementalByCostCentreAndCategory[centre]?.[category]??0)}</td>)}<td>{fmt(total)}</td><td>{(reportCppCpsTraceLedger.completeIncrementalByCostCentreByPeriod[centre]??[]).map((amount,index)=><span key={index}>{fieldLabel('دوره')} {index+1}: {amount===null?'—':fmt(amount)}{index<(reportCppCpsTraceLedger.completeIncrementalByCostCentreByPeriod[centre]?.length??0)-1?' · ':''}</span>)}</td></tr>)}</tbody></table></div>{reportCppCpsTraceLedger.unverifiedItemIds.length>0&&<p className="fw-hint" role="alert">{fieldLabel('بخشی از هزینه‌ها فاقد منبع تأییدشده است؛ جمع کامل نمایش داده نمی‌شود و این مبالغ به‌عنوان صفر فرض نشده‌اند.')}</p>}</div>}{reportSalesTaxLedgerResult?.valid&&<div className="fw-card"><h3>{fieldLabel('دفتر مالیات غیرمستقیم فروش و مانده مالیاتی')}</h3><div className="fw-kpis"><article><small>{fieldLabel('مالیات خروجی فروش')}</small><b>{fmt(reportSalesTaxLedgerResult.totalOutputTax)}</b></article><article><small>{fieldLabel('اعتبار مالیات خرید مستند')}</small><b>{fmt(reportSalesTaxLedgerResult.totalRecoverableInputTax)}</b></article><article><small>{fieldLabel('پرداخت / تهاتر')}</small><b>{fmt(reportSalesTaxLedgerResult.totalSettlements)}</b></article><article><small>{fieldLabel(reportSalesTaxLedgerResult.closingBalance>=0?'مالیات پرداختنی پایان':'مالیات دریافتنی پایان')}</small><b>{fmt(Math.abs(reportSalesTaxLedgerResult.closingBalance))}</b></article></div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{fieldLabel('دوره')}</th><th>{fieldLabel('مانده اول')}</th><th>{fieldLabel('مالیات خروجی')}</th><th>{fieldLabel('اعتبار ورودی')}</th><th>{fieldLabel('خالص تعهد دوره')}</th><th>{fieldLabel('پرداخت / تهاتر')}</th><th>{fieldLabel('مانده پایان (+پرداختنی / −دریافتنی)')}</th></tr></thead><tbody>{reportSalesTaxLedgerResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{fmt(row.openingBalance)}</td><td>{fmt(row.outputTax)}</td><td>{fmt(row.recoverableInputTax)}</td><td>{fmt(row.netTaxAccrued)}</td><td>{fmt(row.settlement)}</td><td>{fmt(row.closingBalance)}</td></tr>)}</tbody></table></div><p className="fw-hint">{fieldLabel('مانده مالیات غیرمستقیم به‌صورت خالص و فقط یک‌بار در سرمایه در گردش منظور شده است؛ پرداخت نقدی مجدداً از جریان نقدی کسر نمی‌شود.')}</p></div>}{m.scope.valueAddedAnalysis&&reportValueAddedAnalysisResult?.valid&&<div className="fw-card"><h3>{fieldLabel('تحلیل ارزش افزوده و توزیع آن')}</h3><div className="fw-kpis">
<article><small>{fieldLabel('ارزش افزوده ناخالص داخلی')}</small><b>{fmt(reportValueAddedAnalysisResult.totals.grossDomesticValueAdded)}</b></article>
<article><small>{fieldLabel('ارزش افزوده خالص داخلی')}</small><b>{fmt(reportValueAddedAnalysisResult.totals.netDomesticValueAdded)}</b></article>
<article><small>{fieldLabel('ارزش افزوده خالص ملی')}</small><b>{fmt(reportValueAddedAnalysisResult.totals.netNationalValueAdded)}</b></article>
<article><small>{fieldLabel('ارزش فعلی ارزش افزوده خالص ملی')}</small><b>{fmt(reportValueAddedAnalysisResult.totals.presentValueNetNationalValueAdded)}</b></article>
<article><small>{fieldLabel('نسبت کارایی مطلق')}</small><b>{reportValueAddedAnalysisResult.totals.absoluteEfficiencyRatio===null?'—':fmt(reportValueAddedAnalysisResult.totals.absoluteEfficiencyRatio,3)}</b></article>
</div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{fieldLabel('دوره')}</th><th>{fieldLabel('خروجی ناخالص')}</th><th>{fieldLabel('نهاده واسطه‌ای تعدیل‌شده')}</th><th>{fieldLabel('سرمایه‌گذاری تعدیل‌شده')}</th><th>{fieldLabel('ارزش افزوده ناخالص داخلی')}</th><th>{fieldLabel('ارزش افزوده خالص داخلی')}</th><th>{fieldLabel('پرداخت‌های خروجی')}</th><th>{fieldLabel('ارزش افزوده خالص ملی')}</th><th>{fieldLabel('دستمزد داخلی')}</th><th>{fieldLabel('سود و بهره داخلی')}</th><th>{fieldLabel('سهم دولت')}</th><th>{fieldLabel('سایر ارزش افزوده')}</th><th>{fieldLabel('اختلاف توزیع')}</th></tr></thead><tbody>{reportValueAddedAnalysisResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{fmt(row.grossOutput)}</td><td>{fmt(row.intermediateInput.amountDeducted)}</td><td>{fmt(row.investment.amountDeducted)}</td><td>{fmt(row.grossDomesticValueAdded)}</td><td>{fmt(row.netDomesticValueAdded)}</td><td>{fmt(row.repatriatedPayments)}</td><td>{fmt(row.netNationalValueAdded)}</td><td>{fmt(row.domesticWages)}</td><td>{fmt(row.domesticDividendsAndInterest)}</td><td>{fmt(row.governmentShare)}</td><td>{fmt(row.otherValueAdded)}</td><td>{fmt(row.distributionDifference)}</td></tr>)}</tbody></table></div><p className="fw-hint">{fieldLabel('توزیع ارزش افزوده از طریق دستمزد، سود و بهره داخلی، سهم دولت و سایر ارزش افزوده در هر دوره تطبیق داده شده است. ضرایب محتوای داخلی/خارجی و سه مرحله تجزیه نهاده‌ها باید مستند به منبع اقتصادی باشند.')}</p></div>}{m.analysisMode!=='new'&&reportIncrementalEnterpriseAnalysis&&<div className="fw-card"><h3>{fieldLabel('تحلیل بنگاه موجود: بدون طرح، با طرح و اثر افزایشی')}</h3><div className="fw-kpis">
<article><small>{fieldLabel('NPV بدون طرح')}</small><b>{fmt(reportIncrementalEnterpriseAnalysis.withoutProjectNpv)} {m.project.currency}</b></article>
<article><small>{fieldLabel('NPV با طرح')}</small><b>{fmt(reportIncrementalEnterpriseAnalysis.withProjectNpv)} {m.project.currency}</b></article>
<article><small>{fieldLabel('NPV افزایشی')}</small><b>{fmt(reportIncrementalEnterpriseAnalysis.incrementalNpv)} {m.project.currency}</b></article>
<article><small>{fieldLabel('IRR افزایشی')}</small><b>{reportIncrementalEnterpriseAnalysis.incrementalIrr===null?'—':fmt(reportIncrementalEnterpriseAnalysis.incrementalIrr*100,2)+'٪'}</b></article>
</div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{fieldLabel('دوره')}</th><th>{fieldLabel('بدون طرح')}</th><th>{fieldLabel('با طرح')}</th><th>{fieldLabel('اثر افزایشی')}</th></tr></thead><tbody>{reportIncrementalEnterpriseAnalysis.periods.map(row=><tr key={row.period}><td>{row.period}</td><td>{fmt(row.withoutProjectCashFlow)}</td><td>{fmt(row.withProjectCashFlow)}</td><td>{fmt(row.incrementalCashFlow)}</td></tr>)}</tbody></table></div></div>}{m.scope.economicAnalysis&&economicAnalysisResult?.valid&&<div className="fw-card"><h3>{fieldLabel('ارزیابی اقتصادی پروژه')}</h3><div className="fw-kpis"><article><small>{fieldLabel('ارزش فعلی خالص اقتصادی')}</small><b>{fmt(economicAnalysisResult.economicNpv??NaN)} {m.project.currency}</b></article><article><small>{fieldLabel('نرخ بازده اقتصادی')}</small><b>{economicAnalysisResult.economicIrr===null?'—':fmt(economicAnalysisResult.economicIrr*100,2)+'٪'}</b></article><article><small>{fieldLabel('حذف مالیات انتقالی')}</small><b>{fmt(economicAnalysisResult.totalTaxTransferRemoved)}</b></article><article><small>{fieldLabel('حذف مالیات غیرمستقیم انتقالی')}</small><b>{fmt(economicAnalysisResult.totalIndirectTaxTransferRemoved)}</b></article><article><small>{fieldLabel('حذف یارانه انتقالی')}</small><b>{fmt(economicAnalysisResult.totalSubsidyTransferRemoved)}</b></article><article><small>{fieldLabel('تعدیل اقتصادی ارز')}</small><b>{fmt(economicAnalysisResult.totalForeignExchangeAdjustment)}</b></article><article><small>{fieldLabel('تعدیل اقتصادی اشتغال')}</small><b>{fmt(economicAnalysisResult.totalEmploymentAdjustment)}</b></article></div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{fieldLabel('دوره')}</th><th>{fieldLabel('جریان نقدی مالی پروژه')}</th><th>{fieldLabel('حذف مالیات عملکرد')}</th><th>{fieldLabel('حذف مالیات غیرمستقیم')}</th><th>{fieldLabel('حذف یارانه')}</th><th>{fieldLabel('تعدیل قیمت سایه‌ای')}</th><th>{fieldLabel('جریان نقدی اقتصادی')}</th></tr></thead><tbody>{economicAnalysisResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{fmt(row.financialProjectCashFlow)}</td><td>{fmt(row.taxTransferRemoved)}</td><td>{fmt(row.indirectTaxTransferRemoved)}</td><td>{fmt(row.subsidyTransferRemoved)}</td><td>{fmt(row.economicAdjustment)}</td><td>{fmt(row.economicCashFlow)}</td></tr>)}</tbody></table></div><p className="fw-hint">{fieldLabel('تعدیلات اقتصادی بر اساس ارزش مالی و اقتصادی ثبت‌شده توسط کاربر محاسبه شده‌اند؛ نرخ‌ها و مقادیر سایه‌ای باید مستند به مطالعه اقتصادی پروژه باشند.')}</p></div>}<div className="fw-kpis"><article><small>{fieldLabel('ظرفیت عملی قابل فروش')}</small><b>{fmt(cap)} تن/سال</b></article><article><small>{fieldLabel('سرمایه‌گذاری دوره ساخت')}</small><b>{fmt(capex)} {m.project.currency}</b></article><article><small>{fieldLabel('هزینه نقدی سالانه بهره‌برداری')}</small><b>{fmt(model.operatingCost)} {m.project.currency}</b></article><article><small>WACC</small><b>{fmt(wacc*100,2)}٪</b></article><article><small>NPV</small><b>{fmt(displayNpv??NaN)} {m.project.currency}</b></article><article><small>IRR</small><b>{displayIrr != null && Number.isFinite(displayIrr)?fmt(displayIrr*100,2)+'٪':t('قابل محاسبه نیست','Not calculable')}</b></article></div><h3>{fieldLabel('مفروضات و شاخص‌های کلیدی')}</h3><div className="fw-validation"><span>{fieldLabel('دوره ساخت / بهره‌برداری')}</span><b>{fmt(m.project.constructionYears)} / {fmt(m.project.operatingYears)} سال</b></div><div className="fw-validation"><span>{fieldLabel('اندازه ظاهری بازار')}</span><b>{fmt(marketSize)} تن</b></div><div className="fw-validation"><span>{fieldLabel('قیمت فروش ترکیبی')}</span><b>{fmt(revenuePrice)} {m.project.currency}/تن</b></div><div className="fw-validation"><span>{fieldLabel('ظرفیت سربه‌سر')}</span><b>{Number.isFinite(model.breakEven)?fmt(model.breakEven)+' تن':t('قابل محاسبه نیست','Not calculable')}</b></div><h3>{fieldLabel('وضعیت تکمیل مراحل')}</h3>{steps.slice(0,9).map(([id,label],index)=><div className="fw-validation" key={id}><span>{fmt(index+1)}. {label}</span>{done[id]?<b className="good">{fieldLabel('تکمیل اولیه')}</b>:<b className="missing">{fieldLabel('نیازمند تکمیل')}</b>}</div>)}<p className="fw-hint">{fieldLabel('گزارش پیش‌نمایش مدیریتی است. اعتبار ارقام تابع کیفیت منابع، مفروضات و تکمیل مطالعات فنی و مالی است.')}</p></div><button className="primary" onClick={()=>window.print()}><Printer size={16}/> {t('چاپ گزارش / ذخیره PDF','Print Report / Save PDF')}</button><button type="button" className="primary" style={{marginInlineStart:8}} onClick={()=>setStep('profile')}>{t('انجام بده','Do it')}</button></>}
  </>}
  <div style={{display:step==='cashflow'&&!unintegratedFinancialDraftInputs.length?'block':'none'}}><AdvancedFinancePanel language={language} projectPeriods={projectCalendarPeriods} periodFrequency={m.foundation.planning.periodFrequency} fiscalYearStartMonth={m.foundation.planning.fiscalYearStartMonth} valuationDate={m.foundation.planning.valuationDate} discountConvention={m.foundation.planning.discountConvention} dayCountBasis={m.foundation.planning.dayCountBasis} cashFlowTiming={m.foundation.planning.cashFlowTiming} projectId={project.id} jointVenture={m.scope.jointVenture} partners={m.partners} partnerDistributionPercent={m.partnerDistributionPercent??100} currency={m.project.currency} constructionYears={m.project.constructionYears} operatingYears={m.project.operatingYears} capacity={cap} fullCapacityRevenue={cap*revenuePrice} fullCapacityVariableCashCost={cap*variable} fullCapacityFixedCashCost={fixed} fixedInvestment={capex} preOperatingCost={preOperatingCost} initialWorkingCapital={m.finance.workingCapital} openingWorkingCapitalBalance={m.analysisMode==='new'?0:startingBalances.netWorkingCapital} openingCashBalance={m.analysisMode==='new'?0:startingBalances.cash} openingDebtBalance={m.analysisMode==='new'?0:startingBalances.debt} openingFixedAssetsNetBookValue={openingFixedAssetsNetBookValue} openingPaidInCapital={m.analysisMode==='new'?0:startingBalances.paidInCapital} openingRetainedEarnings={m.analysisMode==='new'?0:startingBalances.retainedEarnings} openingGrants={m.analysisMode==='new'?0:startingBalances.grants} openingCurrentAccounts={m.analysisMode==='new'?undefined:startingBalances.currentAccounts} workingCapitalDrafts={m.financialForms.workingCapital??[]} productFinancialDrafts={{sales:m.financialForms.sales??[],productionCosts:m.financialForms.productionCosts??[],wasteLedgerEntries:m.financialForms.wasteLedgerEntries??[],productionTransfers:m.financialForms.productionTransfers??[],inventoryReferenceBenchmarks:m.financialForms.inventoryReferenceBenchmarks??[],costCentres:m.financialForms.costCentres??[],costCentreInventoryMovements:m.financialForms.costCentreInventoryMovements??[],inventoryStageTransfers:m.financialForms.inventoryStageTransfers??[]}} cppCpsTraceItems={m.financialForms.cppCpsTraceItems??[]} onCppCpsTraceLedger={setReportCppCpsTraceLedger} onEditFinancialForms={()=>setStep('profile')} taxDraft={m.financialForms.tax} salesTaxLedgerDraft={m.financialForms.salesTaxLedger} onSalesTaxLedgerResult={setReportSalesTaxLedgerResult} valueAddedAnalysisEnabled={m.scope.valueAddedAnalysis} valueAddedPeriodDrafts={m.financialForms.economic.valueAddedPeriods??[]} economicDiscountRatePercent={m.financialForms.economic.discountRatePercent} economicDiscountRateSourceReference={m.financialForms.economic.discountRateSourceReference} economicDiscountRateSourceVerified={m.financialForms.economic.discountRateSourceVerified} onValueAddedAnalysisResult={setReportValueAddedAnalysisResult} loanDrafts={m.financialForms.loans??[]} projectFoundation={m.foundation} initialLoanRatePercent={m.finance.debtCost} comfarDepreciationAssets={integratedComfarDepreciationAssets} comfarAssetSales={[...fixedInvestmentLifecycleInputs.sales,...openingAssetSales]} fixedInvestmentSchedule={confirmedFixedInvestmentSchedule} preOperatingSchedule={confirmedPreOperatingSchedule} comfarDepreciationWarnings={[...fixedInvestmentLifecycleInputs.warnings,...openingAssetDepreciationWarnings]} useFixedInvestmentRegister={true} initialDiscountMode={m.finance.method==='wacc'?'wacc':'manual'} initialManualRate={m.finance.manualRate} mirrFinanceRate={m.finance.financeRate} mirrReinvestmentRate={m.finance.reinvestmentRate} onResult={setIntegratedFinanceResult} onSensitivity={setReportSensitivity} onScenarioAnalysis={handleScenarioAnalysis} onPeriodicResult={setReportPeriodicFinance} onPartnerFinanceResult={setReportPartnerFinance} equityPercent={m.finance.equity} costOfEquity={m.finance.equityCost} costOfDebt={m.finance.debtCost} taxRate={m.finance.tax} capexRows={m.capex.map(r=>({id:r.id,name:r.name,amount:r.quantity*r.unitPrice}))} ramp={m.capacity.ramp}/></div>
    </main>
  <footer className="fw-footer"><button className="secondary-button" onClick={()=>go(-1)} disabled={current===0}><ArrowRight size={15}/> {en?'Previous':'قبلی'}</button><span>{en?'Step':'مرحله'} {fmt(current+1)} {en?'of':'از'} {fmt(steps.length)} · {required[step].map(trField).join(en ? ', ' : '، ')}</span><button className="primary" onClick={()=>go(1)} disabled={current===steps.length-1}>{en?'Save & Continue':'ذخیره و ادامه'} <ArrowLeft size={15}/></button></footer>
 </section>
}
