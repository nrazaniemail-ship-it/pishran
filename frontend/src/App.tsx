import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen, Zap, Wrench, Boxes, Target, BriefcaseBusiness, Pencil, Trash2, Check, X } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, purgeRemovedCaseProjects, seedComfarReferenceProjects, listProjects, updateProject, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import FeasibilityWizard from './features/projects/FeasibilityWizard'
import Guide from './features/guide/Guide'
import BackupScheduler from './features/settings/BackupScheduler'
import ModuleIntelligencePanel from './features/modules/ModuleIntelligencePanel'
import OeeProductionPanel from './features/modules/OeeProductionPanel'
import ModuleKpiPanel from './features/modules/ModuleKpiPanel'
import ModuleEnergyPanel from './features/modules/ModuleEnergyPanel'
import MaintenancePanel from './features/modules/MaintenancePanel'
import ExecutiveDashboardPanel from './features/modules/ExecutiveDashboardPanel'
import ModuleExportActions from './features/modules/ModuleExportActions'
import RankingMethodsPanel from './features/ranking/RankingMethodsPanel'

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'project-wizard' | 'guide' | 'module'

type ModuleWorkspace = { id: string; moduleId: string; name: string; createdAt: string }

const modules = [
  { id: 'MOD-01', icon: LayoutDashboard, title: 'داشبورد هوشمند مدیرعامل', enTitle: 'Executive Intelligence Dashboard', sub: 'نمای یکپارچه وضعیت و استثناهای مدیریتی', enSub: 'Unified business status and management exceptions', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-02', icon: TrendingUp, title: 'مدیریت اقتصادی و بهای تمام‌شده', enTitle: 'Steel Cost & Profitability Intelligence', sub: 'هزینه، حاشیه سود و انحراف بهای تمام‌شده', enSub: 'Cost, margin and cost variance analysis', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-03', icon: Gauge, title: 'هوشمندی تولید و بهره‌وری', enTitle: 'Production & OEE Intelligence', sub: 'تولید، ظرفیت، توقفات و راندمان', enSub: 'Output, capacity, downtime and OEE', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-04', icon: Target, title: 'مدیریت عملکرد و شاخص‌ها', enTitle: 'Enterprise Performance Management', sub: 'اهداف، KPI و تحلیل انحراف عملکرد', enSub: 'Goals, KPIs and performance variance', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-05', icon: Zap, title: 'مدیریت انرژی', enTitle: 'Energy Intelligence & Optimization', sub: 'مصرف ویژه، هزینه و فرصت‌های بهینه‌سازی', enSub: 'Specific consumption, cost and optimization', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-06', icon: Wrench, title: 'تعمیرات و قابلیت اطمینان', enTitle: 'Maintenance & Asset Reliability', sub: 'خرابی، توقف و قابلیت اطمینان تجهیزات', enSub: 'Failures, downtime and asset reliability', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-07', icon: Factory, title: 'مهندسی فرآیند و تعالی عملیاتی', enTitle: 'Process Engineering & Operational Excellence', sub: 'توازن مواد و انرژی، گلوگاه و بهبود', enSub: 'Material and energy balance, bottlenecks and improvement', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-08', icon: Boxes, title: 'زنجیره تأمین و موجودی', enTitle: 'Supply Chain & Inventory Intelligence', sub: 'تأمین، گردش موجودی و سرمایه در گردش', enSub: 'Procurement, inventory turnover and working capital', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-09', icon: Globe2, title: 'هوشمندی بازار و سودآوری محصول', enTitle: 'Steel Market & Product Profitability', sub: 'بازار، قیمت، رقبا و ترکیب سودآور محصول', enSub: 'Markets, pricing, competitors and product mix', group: 'بازار و رشد سودآور', enGroup: 'Market & Profitable Growth' },
  { id: 'MOD-10', icon: ShieldCheck, title: 'رتبه‌بندی و هوشمندی تصمیم', enTitle: 'Ranking & Decision Intelligence', sub: 'مقایسه گزینه‌ها با معیار و شواهد شفاف', enSub: 'Evidence-based comparison and ranking', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
  { id: 'MOD-11', icon: FolderKanban, title: 'مدیریت پروژه و سرمایه‌گذاری', enTitle: 'Capital Project & Portfolio Management', sub: 'بودجه، پیشرفت، زمان و منافع پروژه', enSub: 'Project budget, progress, schedule and benefits', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
  { id: 'MOD-12', icon: Activity, title: 'مدیریت ریسک و تاب‌آوری', enTitle: 'Enterprise Risk & Resilience', sub: 'ریسک‌های عملیاتی، مالی و استمرار کسب‌وکار', enSub: 'Operational, financial and continuity risks', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
]

const moduleIconFiles = ['01-dashboard.svg','02-economics.svg','03-production.svg','04-kpi.svg','05-energy.svg','06-maintenance.svg','07-process.svg','08-supply-chain.svg','09-market.svg','10-decision.svg','11-project-investment.svg','12-risk.svg']

const moduleCapabilityProfiles: Record<string, { assessment: string[]; benchmarks: string[]; learning: string[]; assessmentEn: string[]; benchmarksEn: string[]; learningEn: string[] }> = {
  'MOD-01': {
    assessment: ['پوشش شاخص‌های کلیدی مالی، تولید، فروش، انرژی و ریسک در یک نمای واحد','تشخیص انحراف از هدف، روندهای غیرعادی و استثناهای نیازمند اقدام','ردیابی هر هشدار تا شاخص، منبع داده، مسئول و اقدام اصلاحی'],
    benchmarks: ['Microsoft Power BI و Fabric؛ SAP Analytics Cloud؛ Oracle Analytics Cloud — نمونه‌های بازار برای هوش تجاری و داشبورد مدیریتی'],
    learning: ['نمای چندسطحی مدیرعامل، مدیر واحد و کارشناس با drill-down','کارت استثنا به‌جای انباشت نمودار؛ نمایش شدت، اثر مالی و فوریت','اتصال هر KPI به منشأ داده و امکان ردیابی تا جزئیات عملیاتی'],
    assessmentEn: ['Unified coverage of finance, production, sales, energy and risk KPIs','Detection of target variance, abnormal trends and actionable exceptions','Traceability from each alert to its metric, source, owner and corrective action'],
    benchmarksEn: ['Microsoft Power BI and Fabric; SAP Analytics Cloud; Oracle Analytics Cloud — market examples for BI and executive dashboards'],
    learningEn: ['Role-based executive, business-unit and analyst views with drill-down','Prioritize actionable exceptions over chart volume','Link every KPI to its data lineage and operational detail']
  },
  'MOD-02': {
    assessment: ['تطبیق بهای تمام‌شده با مصرف واقعی مواد، انرژی، نیروی انسانی، تعمیرات و سربار','تحلیل انحراف نرخ، مقدار و ترکیب؛ حاشیه سود محصول و مرکز هزینه','کنترل منشأ داده، دوره مالی، واحد سنجش و جلوگیری از دوباره‌شماری هزینه‌ها'],
    benchmarks: ['SAP S/4HANA Product Costing و CO-PA؛ Oracle Cost Management؛ Infor CloudSuite Industrial — نمونه‌های مرجع هزینه‌یابی و سودآوری'],
    learning: ['تفکیک هزینه استاندارد، واقعی و جذب‌شده و پل تطبیق بین آن‌ها','ردیابی هزینه تا قبض، کنتور، حواله مواد و مرکز هزینه','تحلیل سودآوری در سطح محصول، گرید، سفارش و مشتری'],
    assessmentEn: ['Reconcile product cost to actual materials, energy, labor, maintenance and overhead','Analyze rate, usage and mix variances, product margin and cost centers','Control data provenance, fiscal periods and units to prevent double counting'],
    benchmarksEn: ['SAP S/4HANA Product Costing and CO-PA; Oracle Cost Management; Infor CloudSuite Industrial'],
    learningEn: ['Separate standard, actual and absorbed cost with a reconciliation bridge','Trace cost to bills, meters, material issues and cost centers','Analyze profitability by product, grade, order and customer']
  },
  'MOD-03': {
    assessment: ['اندازه‌گیری تولید واقعی در برابر برنامه و ظرفیت قابل‌دسترس','تحلیل OEE از دسترس‌پذیری، عملکرد و کیفیت با تعریف روشن زمان برنامه‌ریزی‌شده','تفکیک توقف برنامه‌ریزی‌شده، خرابی، کمبود مواد، افت سرعت و ضایعات'],
    benchmarks: ['Siemens Opcenter؛ AVEVA Manufacturing Execution System؛ Rockwell FactoryTalk — نمونه‌های بازار در MES و هوشمندی تولید'],
    learning: ['ساختار خط تا تجهیز و کدبندی علل توقف','اتصال تولید، کیفیت و توقف برای تحلیل علت ریشه‌ای','نمای روزانه شیفت و روند چنددوره‌ای با تعریف یکسان مخرج OEE'],
    assessmentEn: ['Measure actual output against plan and available capacity','Calculate OEE from availability, performance and quality with explicit planned-time rules','Separate planned stops, breakdowns, material shortages, speed loss and scrap'],
    benchmarksEn: ['Siemens Opcenter; AVEVA MES; Rockwell FactoryTalk — market examples in MES and manufacturing intelligence'],
    learningEn: ['Model line-to-asset hierarchy and standardized downtime codes','Connect output, quality and downtime for root-cause analysis','Provide shift-level and multi-period views with consistent OEE denominators']
  },
  'MOD-04': {
    assessment: ['هم‌راستایی KPIها با اهداف راهبردی و مالک مشخص شاخص','کنترل تعریف، فرمول، واحد، تناوب، منبع و جهت مطلوب هر شاخص','تحلیل فاصله هدف تا عملکرد، روند و اقدامات اصلاحی'],
    benchmarks: ['SAP Analytics Cloud Planning؛ Oracle Fusion Cloud EPM؛ IBM Planning Analytics — نمونه‌های مرجع مدیریت عملکرد و برنامه‌ریزی'],
    learning: ['فرهنگ‌نامه KPI و مالکیت شاخص','کارت امتیازی متوازن و آبشاری‌سازی اهداف','ثبت نسخه هدف و توضیح تغییرات برای حفظ قابلیت حسابرسی'],
    assessmentEn: ['Align KPIs with strategic objectives and named metric owners','Control definition, formula, unit, cadence, source and preferred direction','Analyze target gaps, trends and corrective actions'],
    benchmarksEn: ['SAP Analytics Cloud Planning; Oracle Fusion Cloud EPM; IBM Planning Analytics'],
    learningEn: ['KPI dictionary and metric ownership','Balanced scorecard and cascading objectives','Version targets and explain changes for auditability']
  },
  'MOD-05': {
    assessment: ['روند چنددوره‌ای برق، گاز و آب؛ شدت مصرف و هزینه به‌ازای تن محصول','خط مبنای تعدیل‌شده، تحلیل انحراف، هشدار ناهنجاری و صحه‌گذاری صرفه‌جویی','کنترل کیفیت قبض و کنتور؛ تخصیص هزینه انرژی به مرکز هزینه و حفظ ردپای منبع','مقایسه حرارتی گاز فقط با مبنای ارزش حرارتی و شرایط مرجع یکسان؛ تفکیک آب تازه، بازچرخانی و بازاستفاده'],
    benchmarks: ['Siemens SIMATIC Energy Manager؛ ABB Ability Energy Management؛ Schneider EcoStruxure Resource Advisor؛ EnergyCAP؛ Spacewell Energy؛ IBM Envizi؛ Honeywell Forge؛ AVEVA PI؛ Johnson Controls OpenBlue؛ GridPoint'],
    learning: ['سلسله‌مراتب سازمان ← سایت ← واحد ← خط ← تجهیز ← کنتور','داشبورد چندسطحی مدیر، مدیر انرژی و اپراتور؛ قبض و کنتور همراه کنترل کیفیت','خط مبنای تعدیل‌شده، هشدار دارای مسئول و مهلت، اندازه‌گیری و صحه‌گذاری (M&V)','مقایسه چندسایتی و اتصال مصرف و هزینه به تولید و بهای تمام‌شده'],
    assessmentEn: ['Multi-period electricity, gas and water trends; energy intensity and cost per tonne','Adjusted baselines, deviation analysis, anomaly alerts and savings verification','Utility-bill and meter quality controls; cost-center allocation with source lineage','Compare gas thermal energy only on matching calorific basis and reference conditions; separate freshwater, recirculation and reuse'],
    benchmarksEn: ['Siemens SIMATIC Energy Manager; ABB Ability EMS; Schneider EcoStruxure Resource Advisor; EnergyCAP; Spacewell Energy; IBM Envizi; Honeywell Forge; AVEVA PI; Johnson Controls OpenBlue; GridPoint'],
    learningEn: ['Organization → site → area → line → asset → meter hierarchy','Role-based executive, energy-manager and operator dashboards; bill and meter validation','Adjusted baselines, owned and time-bound alerts, measurement and verification (M&V)','Multi-site benchmarking and linkage of energy consumption and cost to production and product cost']
  },
  'MOD-06': {
    assessment: ['تحلیل MTBF، MTTR، دسترس‌پذیری و هزینه چرخه عمر تجهیز','تفکیک خرابی تکراری، توقف اضطراری، تعمیر برنامه‌ریزی‌شده و backlog','ارزیابی اثربخشی PM و پیش‌بینی ریسک خرابی بر پایه تاریخچه معتبر'],
    benchmarks: ['IBM Maximo؛ SAP Asset Performance Management؛ Siemens Senseye؛ Infor EAM — نمونه‌های بازار مدیریت دارایی و قابلیت اطمینان'],
    learning: ['شناسنامه تجهیز و سلسله‌مراتب دارایی','اتصال دستورکار، قطعه یدکی، توقف تولید و هزینه تعمیر','اولویت‌بندی ریسک‌محور بر اساس بحرانی‌بودن تجهیز و پیامد توقف'],
    assessmentEn: ['Analyze MTBF, MTTR, availability and asset lifecycle cost','Separate repeat failures, emergency downtime, planned maintenance and backlog','Assess PM effectiveness and failure risk using validated history'],
    benchmarksEn: ['IBM Maximo; SAP Asset Performance Management; Siemens Senseye; Infor EAM'],
    learningEn: ['Asset register and equipment hierarchy','Link work orders, spares, production downtime and maintenance cost','Risk-based prioritization by asset criticality and downtime consequence']
  },
  'MOD-07': {
    assessment: ['تطبیق موازنه جرم و انرژی و شناسایی نقاط اتلاف','تحلیل ظرفیت طراحی، ظرفیت عملی و گلوگاه‌های فرآیندی','ارزیابی پایداری پارامترهای فرآیند، کیفیت محصول و فرصت بهبود'],
    benchmarks: ['AVEVA Process Simulation و PI System؛ AspenTech Aspen Plus و IP.21؛ Siemens COMOS — نمونه‌های مرجع مهندسی فرآیند و داده عملیاتی'],
    learning: ['مدل‌سازی جریان مواد و انرژی از ورودی تا محصول و پسماند','اتصال پارامتر فرآیند به کیفیت، مصرف و هزینه','ثبت فرضیات مهندسی، نسخه مدل و شواهد آزمون'],
    assessmentEn: ['Reconcile mass and energy balances and identify losses','Analyze design capacity, operating capacity and process bottlenecks','Assess process stability, product quality and improvement opportunities'],
    benchmarksEn: ['AVEVA Process Simulation and PI System; AspenTech Aspen Plus and IP.21; Siemens COMOS'],
    learningEn: ['Model material and energy flows from input through product and waste','Link process parameters to quality, consumption and cost','Version engineering assumptions, models and test evidence']
  },
  'MOD-08': {
    assessment: ['تحلیل موجودی مواد اولیه، نیمه‌ساخته، محصول و قطعات یدکی','پایش گردش موجودی، روزهای پوشش، نقطه سفارش و ریسک کمبود یا مازاد','ارزیابی عملکرد تأمین‌کننده، زمان تحویل و سرمایه در گردش درگیر'],
    benchmarks: ['SAP Integrated Business Planning و EWM؛ Oracle Supply Chain Planning؛ Blue Yonder — نمونه‌های مرجع برنامه‌ریزی و زنجیره تأمین'],
    learning: ['اتصال برنامه تولید، سفارش خرید، انبار و مصرف واقعی','طبقه‌بندی ABC/XYZ و سیاست موجودی متناسب با بحرانی‌بودن','نمای ریسک تأمین و اثر توقف مواد بر تولید و نقدینگی'],
    assessmentEn: ['Analyze raw, work-in-process, finished-goods and spare-parts inventory','Monitor turns, days of cover, reorder points and shortage or excess risk','Assess supplier performance, lead time and working capital tied up'],
    benchmarksEn: ['SAP Integrated Business Planning and EWM; Oracle Supply Chain Planning; Blue Yonder'],
    learningEn: ['Connect production plans, purchase orders, warehouse and actual consumption','Apply ABC/XYZ segmentation and criticality-based inventory policies','Show supply risk and its impact on production and cash']
  },
  'MOD-09': {
    assessment: ['تحلیل عرضه، تقاضا، قیمت، پریمیوم، هزینه حمل و روند بازار محصولات فولادی','مقایسه قیمت فروش و حاشیه سود بر اساس گرید، بازار، مقصد و مشتری','ارزیابی رقبا، ظرفیت‌های جدید، واردات و صادرات با تاریخ و منبع داده مشخص'],
    benchmarks: ['CRU؛ S&P Global Commodity Insights؛ Fastmarkets؛ Argus — منابع شناخته‌شده داده و تحلیل بازار کالا و فولاد'],
    learning: ['تفکیک داده واقعی معامله از قیمت شاخص و برآورد','مقایسه هم‌تراز محصول، کیفیت، شرایط تحویل، ارز و تاریخ قیمت','اتصال سناریوی بازار به ترکیب محصول و سودآوری'],
    assessmentEn: ['Analyze steel supply, demand, prices, premiums, freight and market trends','Compare selling price and margin by grade, market, destination and customer','Assess competitors, new capacity, imports and exports with dated, sourced evidence'],
    benchmarksEn: ['CRU; S&P Global Commodity Insights; Fastmarkets; Argus — established commodity and steel-market intelligence sources'],
    learningEn: ['Separate transaction data from price assessments and estimates','Normalize product quality, delivery terms, currency and pricing date','Connect market scenarios to product mix and profitability']
  },
  'MOD-10': {
    assessment: [
      'تعریف ساختاریافته مسئله تصمیم، گزینه‌ها، معیارها، واحد سنجش، جهت مطلوب و شروط احراز یا وتو',
      'تفکیک روش تعیین وزن معیارها از روش رتبه‌بندی گزینه‌ها؛ پشتیبانی مرحله‌ای از وزن‌دهی مستقیم، رتبه‌ای، AHP و BWM',
      'ارزیابی معیارهای کمی و کیفی با نرمال‌سازی مستند و انتخاب روش متناسب از میان WSM، TOPSIS، VIKOR و PROMETHEE',
      'کنترل کیفیت داده، منشأ امتیاز، تاریخ، واحد، سطح اطمینان و ثبت شواهد برای هر ارزیابی',
      'تحلیل حساسیت وزن‌ها و مفروضات، پایداری رتبه، اختلاف نتایج روش‌ها و اثر داده ناقص یا گزینه حذف‌شده',
      'شبیه‌سازی مقاوم مونت‌کارلو با بذر ثابت، احتمال رتبه اول، توزیع پذیرش رتبه و بازه صدکی امتیاز تحت عدم‌قطعیت هم‌زمان وزن و عملکرد',
      'اتصال نتایج به داده‌های مالی، تولید، انرژی، بازار، تأمین، پروژه و ریسک و بررسی محدودیت واقعی بودجه و منابع'
    ],
    benchmarks: [
      'Expert Choice Comparion — AHP، مقایسه زوجی، تجمیع دیدگاه گروهی و تحلیل حساسیت',
      'Decision Lens — اولویت‌بندی سبد، هم‌راستایی استراتژیک و محدودیت منابع',
      '1000minds — روش PAPRIKA و استخراج ترجیحات از انتخاب‌های زوجی',
      'D-Sight — تصمیم‌گیری چندمعیاره، سناریو و تحلیل حساسیت',
      'Super Decisions — AHP/ANP و مدل‌سازی وابستگی معیارها',
      'Visual PROMETHEE — روش‌های PROMETHEE و تحلیل بصری GAIA',
      'Logical Decisions — مدل ارزش چندمعیاره MAUT و AHP',
      'Analytica — مدل‌سازی عدم‌قطعیت و شبیه‌سازی تصمیم',
      'TransparentChoice — اولویت‌بندی گروهی و سبد پروژه',
      'AHP-OS (BPMSG) — ابزار وب و گروهی AHP',
      'MCDM App — ابزار محاسباتی روش‌های تصمیم‌گیری چندمعیاره',
      'Planview ProjectAdvantage — اولویت‌بندی تقاضا، سبد، بودجه و منابع'
    ],
    learning: [
      'الگوبرداری از جریان ساده onboarding و قالب‌های آماده برای تصمیم سرمایه‌گذاری، انتخاب تأمین‌کننده و انتخاب فناوری',
      'ثبت مستقل نظر خبرگان و نمایش اختلاف دیدگاه‌ها پیش از تجمیع؛ جلوگیری از پنهان‌شدن اختلاف نظر زیر یک وزن میانگین',
      'سنجش توافق خبرگان با همبستگی رتبه‌ای اسپیرمن و پراکندگی وزن هر معیار؛ ثبت جداگانه CR فردی AHP و شاخص انحراف BWM',
      'تفکیک سه لایه احراز و وتو، وزن‌دهی معیارها و رتبه‌بندی گزینه‌ها؛ امتیاز بالا نباید نقض شرط حیاتی را جبران کند',
      'نمایش وزن، امتیاز خام، امتیاز نرمال‌شده، سهم هر معیار در نتیجه و دلیل تغییر رتبه',
      'نسخه‌بندی داده، وزن، پارامتر و الگوریتم برای بازتولید هر اجرای رتبه‌بندی و ممیزی تصمیم',
      'تبدیل رتبه گزینه‌ها به سبد قابل اجرا با لحاظ سقف بودجه، ظرفیت منابع، زمان و وابستگی پروژه‌ها',
      'استفاده از هوش مصنوعی برای پیشنهاد معیار، کشف هم‌پوشانی و توضیح نتایج؛ نه تولید وزن یا رتبه رسمی بدون محاسبه و شواهد'
    ],
    assessmentEn: [
      'Structure the decision problem, alternatives, criteria, units, preferred direction and eligibility or veto rules',
      'Separate criterion weighting from alternative ranking; phase in direct, rank-based, AHP and BWM weighting',
      'Evaluate quantitative and qualitative criteria with documented normalization and fit-for-purpose WSM, TOPSIS, VIKOR or PROMETHEE methods',
      'Control data quality, score provenance, date, unit, confidence and evidence for every evaluation',
      'Analyze weight and assumption sensitivity, rank stability, method disagreement and the effects of missing data or removed alternatives',
      'Seeded Monte Carlo robustness with top-rank probabilities, rank-acceptability distributions and score percentiles under joint weight and performance uncertainty',
      'Connect finance, production, energy, market, supply, project and risk data; assess actual budget and resource constraints'
    ],
    benchmarksEn: [
      'Expert Choice Comparion — AHP, pairwise comparisons, group aggregation and sensitivity analysis',
      'Decision Lens — portfolio prioritization, strategic alignment and resource constraints',
      '1000minds — PAPRIKA and preference elicitation through pairwise choices',
      'D-Sight — multi-criteria decision analysis, scenarios and sensitivity',
      'Super Decisions — AHP/ANP and interdependent criteria',
      'Visual PROMETHEE — PROMETHEE methods and GAIA visual analysis',
      'Logical Decisions — multi-attribute value analysis and AHP',
      'Analytica — decision modeling under uncertainty and simulation',
      'TransparentChoice — collaborative prioritization and project portfolios',
      'AHP-OS (BPMSG) — web-based collaborative AHP',
      'MCDM App — multi-criteria decision calculation tools',
      'Planview ProjectAdvantage — demand, portfolio, budget and resource prioritization'
    ],
    learningEn: [
      'Adopt guided onboarding and reusable templates for investment, supplier and technology decisions',
      'Capture expert judgments independently and expose disagreement before aggregation',
      'Quantify expert consensus with pairwise Spearman rank correlation and criterion-weight dispersion; retain individual AHP consistency and BWM deviation diagnostics',
      'Separate eligibility and veto rules, criterion weighting and alternative ranking; a high score must not offset a critical failure',
      'Show weights, raw and normalized scores, each criterion contribution and reasons for rank changes',
      'Version data, weights, parameters and algorithms so every ranking run is reproducible and auditable',
      'Translate rankings into an executable portfolio under budget, resource, schedule and dependency constraints',
      'Use AI to suggest criteria, detect overlap and explain results, not to fabricate official weights or ranks'
    ]
  },
  'MOD-11': {
    assessment: ['کنترل CAPEX، تعهدات، پرداخت‌ها، پیشرفت فیزیکی و زمان‌بندی','تحلیل انحراف هزینه و زمان و پیش‌بینی هزینه نهایی','ارزیابی تحقق منافع، تغییرات دامنه و ریسک سبد پروژه‌ها'],
    benchmarks: ['Oracle Primavera P6؛ Microsoft Project و Project Online؛ SAP Portfolio and Project Management — نمونه‌های بازار کنترل پروژه و سبد سرمایه‌گذاری'],
    learning: ['ساختار شکست کار، خط مبنای مصوب و مدیریت تغییر','شاخص‌های ارزش کسب‌شده (EVM) و پیش‌بینی زمان/هزینه تکمیل','اتصال برنامه زمان‌بندی، قرارداد، پرداخت و منافع اقتصادی'],
    assessmentEn: ['Control CAPEX, commitments, payments, physical progress and schedule','Analyze cost and schedule variance and estimate final cost','Assess benefit realization, scope changes and portfolio risk'],
    benchmarksEn: ['Oracle Primavera P6; Microsoft Project and Project Online; SAP Portfolio and Project Management'],
    learningEn: ['Work breakdown structure, approved baseline and change control','Earned value management and estimate-at-completion forecasting','Link schedule, contracts, payments and economic benefits']
  },
  'MOD-12': {
    assessment: ['شناسایی ریسک عملیاتی، مالی، بازار، تأمین و استمرار کسب‌وکار','ارزیابی احتمال، پیامد، کنترل موجود و ریسک باقیمانده','پایش شاخص هشدار، مالک ریسک، برنامه پاسخ و آزمون اثربخشی کنترل'],
    benchmarks: ['SAI360؛ Diligent; Archer؛ ServiceNow Integrated Risk Management — نمونه‌های بازار GRC و مدیریت ریسک سازمانی'],
    learning: ['ثبت ریسک با علت، رویداد، پیامد و شواهد','ماتریس ریسک پویا و سناریوهای تنش','اتصال ریسک به اقدام، مسئول، مهلت و ریسک باقیمانده'],
    assessmentEn: ['Identify operational, financial, market, supply and business-continuity risks','Assess likelihood, impact, existing controls and residual risk','Monitor leading indicators, risk owners, response plans and control effectiveness'],
    benchmarksEn: ['SAI360; Diligent; Archer; ServiceNow Integrated Risk Management — market examples in GRC and enterprise risk'],
    learningEn: ['Capture cause, event, consequence and evidence for each risk','Dynamic risk matrix and stress scenarios','Link risks to actions, owners, due dates and residual exposure']
  }
}


type RankingCriterion = { id: string; name: string; weight: number; direction: 'benefit' | 'cost'; minimum?: number | null }
type RankingOption = { id: string; name: string; scores: Record<string, number | null> }
type RankingDraft = { criteria: RankingCriterion[]; options: RankingOption[] }

function RankingPanel({ language, projectId, projectName }: { language: 'fa' | 'en'; projectId: string; projectName: string }) {
  const isEn = language === 'en'
  const [draft, setDraft] = useState<RankingDraft>({ criteria: [], options: [] })
  const [loaded, setLoaded] = useState(false)
  const [criterionName, setCriterionName] = useState('')
  const [optionName, setOptionName] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let alive = true
    localStore.get<RankingDraft>('mod10-ranking-draft:' + projectId).then(value => {
      if (alive && value && Array.isArray(value.criteria) && Array.isArray(value.options)) setDraft(value)
    }).catch(() => undefined).finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [projectId])
  useEffect(() => {
    if (!loaded) return
    void localStore.set('mod10-ranking-draft:' + projectId, draft).then(() => setNotice(isEn ? 'Saved on this device' : 'روی این دستگاه ذخیره شد')).catch(() => setNotice(isEn ? 'Local save failed' : 'ذخیره محلی ناموفق بود'))
  }, [draft, loaded, isEn])
  const addCriterion = () => {
    const name = criterionName.trim()
    if (!name) return
    const id = `criterion-${Date.now()}`
    setDraft(current => ({ ...current, criteria: [...current.criteria, { id, name, weight: 1, direction: 'benefit', minimum: null }], options: current.options.map(option => ({ ...option, scores: { ...option.scores, [id]: null } })) }))
    setCriterionName('')
  }
  const addOption = () => {
    const name = optionName.trim()
    if (!name) return
    const id = `option-${Date.now()}`
    setDraft(current => ({ ...current, options: [...current.options, { id, name, scores: Object.fromEntries(current.criteria.map(item => [item.id, null])) }] }))
    setOptionName('')
  }
  const updateCriterion = (id: string, patch: Partial<RankingCriterion>) => setDraft(current => ({ ...current, criteria: current.criteria.map(item => item.id === id ? { ...item, ...patch } : item) }))
  const removeCriterion = (id: string) => setDraft(current => ({
    ...current,
    criteria: current.criteria.filter(item => item.id !== id),
    options: current.options.map(option => { const scores = { ...option.scores }; delete scores[id]; return { ...option, scores } }),
  }))
  const removeOption = (id: string) => setDraft(current => ({ ...current, options: current.options.filter(option => option.id !== id) }))
  const updateScore = (optionId: string, criterionId: string, value: string) => setDraft(current => ({ ...current, options: current.options.map(option => option.id === optionId ? { ...option, scores: { ...option.scores, [criterionId]: value === '' ? null : Number(value) } } : option) }))
  const complete = draft.criteria.length > 0 && draft.options.length > 1 && draft.criteria.every(item => item.weight > 0) && draft.criteria.reduce((sum, item) => sum + item.weight, 0) > 0 && draft.options.every(option => draft.criteria.every(item => Number.isFinite(option.scores[item.id]) && option.scores[item.id] !== null && Number(option.scores[item.id]) >= 0))
  const totalWeight = draft.criteria.reduce((sum, item) => sum + item.weight, 0)
  const results = complete ? draft.options.map(option => {
    let score = 0
    let eligible = true
    for (const criterion of draft.criteria) {
      const values = draft.options.map(item => Number(item.scores[criterion.id]))
      const value = Number(option.scores[criterion.id])
      const min = Math.min(...values)
      const max = Math.max(...values)
      const normalized = criterion.direction === 'benefit' ? (max === 0 ? 0 : value / max) : (value === 0 ? (min === 0 ? 1 : 0) : min / value)
      score += normalized * criterion.weight / totalWeight
      if (criterion.minimum !== null && criterion.minimum !== undefined && value < criterion.minimum) eligible = false
    }
    return { id: option.id, name: option.name, score: score * 100, eligible }
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score) : []
  const fieldStyle: React.CSSProperties = { minWidth: 0, width: '100%', boxSizing: 'border-box' }
  return <section className="module-workspace-card" aria-labelledby="mod10-ranking-title">
    <div className="section-head"><div><h2 id="mod10-ranking-title">{projectName ? projectName + (isEn ? ' · ranking workspace' : ' · محیط رتبه‌بندی') : (isEn ? 'Decision ranking workspace · MVP' : 'محیط رتبه‌بندی تصمیم · نسخه اولیه')}</h2><p>{isEn ? 'Define criteria and alternatives, enter evidence-based scores and calculate a transparent weighted-sum ranking.' : 'معیارها و گزینه‌ها را تعریف کنید، امتیازهای مبتنی بر شواهد را وارد کنید و رتبه‌بندی وزنی شفاف بگیرید.'}</p></div><span className="muted">{notice || (loaded ? (isEn ? 'Ready' : 'آماده') : (isEn ? 'Loading' : 'در حال بارگذاری'))}</span></div>
    <div className="module-create-form"><label>{isEn ? 'Add a criterion' : 'افزودن معیار'}</label><div><input style={fieldStyle} value={criterionName} onChange={event => setCriterionName(event.target.value)} placeholder={isEn ? 'e.g. NPV, implementation risk, delivery time' : 'مثلاً NPV، ریسک اجرا، زمان تحویل'} maxLength={100}/><button className="primary" type="button" onClick={addCriterion} disabled={!criterionName.trim()}><Plus size={16}/>{isEn ? 'Add criterion' : 'افزودن معیار'}</button></div></div>
    {draft.criteria.length > 0 && <div style={{overflowX:'auto', marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:620}}><thead><tr><th style={{textAlign:'start',padding:8}}>{isEn?'Criterion':'معیار'}</th><th style={{padding:8}}>{isEn?'Weight':'وزن'}</th><th style={{padding:8}}>{isEn?'Direction':'جهت'}</th><th style={{padding:8}}>{isEn?'Minimum threshold':'حداقل احراز'}</th><th style={{padding:8}}>{isEn?'Actions':'عملیات'}</th></tr></thead><tbody>{draft.criteria.map(item=><tr key={item.id}><td style={{padding:8}}>{item.name}</td><td style={{padding:8}}><input aria-label={isEn?`Weight ${item.name}`:`وزن ${item.name}`} style={{width:84}} type="number" min="0.001" step="0.1" value={item.weight} onChange={event=>updateCriterion(item.id,{weight:Math.max(0,Number(event.target.value)||0)})}/></td><td style={{padding:8}}><select aria-label={isEn?`Direction ${item.name}`:`جهت ${item.name}`} value={item.direction} onChange={event=>updateCriterion(item.id,{direction:event.target.value as RankingCriterion['direction']})}><option value="benefit">{isEn?'Higher is better':'بیشتر بهتر است'}</option><option value="cost">{isEn?'Lower is better':'کمتر بهتر است'}</option></select></td><td style={{padding:8}}><input aria-label={isEn?`Minimum threshold ${item.name}`:`حداقل احراز ${item.name}`} style={{width:100}} type="number" min="0" placeholder={isEn?'None':'بدون شرط'} value={item.minimum ?? ''} onChange={event=>updateCriterion(item.id,{minimum:event.target.value===''?null:Number(event.target.value)})}/></td><td style={{padding:8}}><button className="secondary" type="button" aria-label={isEn?`Remove criterion ${item.name}`:`حذف معیار ${item.name}`} onClick={()=>removeCriterion(item.id)}><Trash2 size={15}/>{isEn?'Remove':'حذف'}</button></td></tr>)}</tbody></table></div>}
    <div className="module-create-form" style={{marginTop:18}}><label>{isEn ? 'Add an alternative' : 'افزودن گزینه قابل مقایسه'}</label><div><input style={fieldStyle} value={optionName} onChange={event => setOptionName(event.target.value)} placeholder={isEn ? 'Enter an option or project name' : 'نام گزینه یا پروژه را وارد کنید'} maxLength={100}/><button className="primary" type="button" onClick={addOption} disabled={!optionName.trim() || draft.criteria.length===0}><Plus size={16}/>{isEn ? 'Add option' : 'افزودن گزینه'}</button></div></div>
    {draft.options.length > 0 && draft.criteria.length > 0 && <div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:Math.max(560,180+draft.criteria.length*130)}}><thead><tr><th style={{textAlign:'start',padding:8}}>{isEn?'Alternative':'گزینه'}</th>{draft.criteria.map(item=><th key={item.id} style={{padding:8}}>{item.name}</th>)}<th style={{padding:8}}>{isEn?'Actions':'عملیات'}</th></tr></thead><tbody>{draft.options.map(option=><tr key={option.id}><td style={{padding:8,fontWeight:600}}>{option.name}</td>{draft.criteria.map(item=><td key={item.id} style={{padding:8}}><input aria-label={isEn?`${option.name}, ${item.name} score`:`امتیاز ${item.name} برای ${option.name}`} style={{width:100}} type="number" min="0" step="any" value={option.scores[item.id] ?? ''} onChange={event=>updateScore(option.id,item.id,event.target.value)} placeholder={isEn?'Score':'امتیاز'}/></td>)}<td style={{padding:8}}><button className="secondary" type="button" aria-label={isEn?`Remove option ${option.name}`:`حذف گزینه ${option.name}`} onClick={()=>removeOption(option.id)}><Trash2 size={15}/>{isEn?'Remove':'حذف'}</button></td></tr>)}</tbody></table></div>}
    {results.length > 0 ? <div style={{marginTop:20}}><h3>{isEn?'Weighted-sum ranking':'رتبه‌بندی با روش مجموع وزنی (WSM)'}</h3><ol>{results.map((item,index)=><li key={item.id} style={{padding:'7px 0'}}><b>{item.name}</b> — {item.eligible ? `${item.score.toFixed(2)}%` : (isEn?'Ineligible':'فاقد شرط احراز')} {item.eligible ? (index===0 || !results.slice(0,index).some(previous=>previous.eligible) ? (isEn?' · Highest eligible score':' · بالاترین امتیاز واجد شرایط') : '') : ''}</li>)}</ol><p className="muted">{isEn?'Weights are normalized to sum to 100%. This MVP uses min/max ratio normalization and is a decision aid, not an investment recommendation.':'وزن‌ها برای محاسبه به مجموع ۱۰۰٪ نرمال می‌شوند. این نسخه اولیه از نرمال‌سازی نسبتی حداقل/حداکثر استفاده می‌کند و ابزار پشتیبان تصمیم است، نه توصیه قطعی سرمایه‌گذاری.'}</p></div> : <p className="muted" style={{marginTop:14}}>{isEn?'Enter at least one criterion, at least two alternatives and a non-negative score for every criterion to calculate the ranking.':'برای محاسبه رتبه، دست‌کم یک معیار، دو گزینه و امتیاز غیرمنفی برای تمام خانه‌ها وارد کنید.'}</p>}
    <div style={{display:'flex',justifyContent:'flex-end',marginTop:14}}><button className="secondary" type="button" onClick={()=>{setDraft({criteria:[],options:[]});setNotice(isEn?'Draft cleared':'پیش‌نویس پاک شد')}}>{isEn?'Clear draft':'پاک‌کردن پیش‌نویس'}</button></div>
  </section>
}

type RankingAdvisorMethod = 'WSM' | 'AHP' | 'BWM' | 'TOPSIS' | 'AHP+TOPSIS' | 'BWM+TOPSIS' | 'TOPSIS+(AHP+BWM)'
type RankingAdvisorStep = 'purpose' | 'alternatives' | 'evidence' | 'weights' | 'decisionMakers' | 'time' | 'dependencies' | 'uncertainty' | 'result'
type RankingAdvisorAnswers = {
  purpose: 'investment' | 'supplier' | 'project' | 'strategy' | 'general'
  alternatives: string[]
  evidence: 'numeric' | 'mixed' | 'qualitative'
  weights: 'known' | 'experts' | 'unknown'
  decisionMakers: 'solo' | 'group'
  time: 'short' | 'enough'
  dependencies: 'independent' | 'dependent'
  uncertainty: 'low' | 'high'
}
type RankingAdvisorMessage = { role: 'assistant' | 'user'; text: string }
function RankingAdvisor({ language, onChoose }: { language: 'fa' | 'en'; onChoose: (method: RankingAdvisorMethod, criteria: string[], alternatives: string[], directions: Array<'benefit' | 'cost'>) => void }) {
  const isEn = language === 'en'
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState<RankingAdvisorStep>('purpose')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<RankingAdvisorMessage[]>([])
  const [answers, setAnswers] = useState<Partial<RankingAdvisorAnswers>>({})
  const [criteriaText, setCriteriaText] = useState('')
  const [alternativesText, setAlternativesText] = useState('')
  const [clarificationCount, setClarificationCount] = useState(0)
  const addAssistant = (text: string) => setMessages(current => [...current, { role: 'assistant', text }])
  const start = () => {
    setStarted(true)
    setStep('purpose')
    setAnswers({})
    setCriteriaText('')
    setAlternativesText('')
    setClarificationCount(0)
    setMessages([{ role: 'assistant', text: isEn ? 'Hello! I will help you choose a ranking method and prepare your manual data-entry plan. I will ask one question at a time, and you can answer naturally.' : 'سلام! کمک می‌کنم روش رتبه‌بندی مناسب را انتخاب و اطلاعات لازم برای ورود دستی را آماده کنید. هر بار فقط یک سؤال می‌پرسم؛ می‌توانید کاملاً محاوره‌ای پاسخ بدهید.' }, { role: 'assistant', text: isEn ? 'First, what decision are you trying to make? For example: selecting an investment, supplier, project, or strategy.' : 'اول بفرمایید دقیقاً چه تصمیمی می‌خواهید بگیرید؟ مثلاً انتخاب یک سرمایه‌گذاری، تأمین‌کننده، اولویت‌بندی پروژه‌ها یا انتخاب راهبرد.' }])
  }
  const questionFor = (next: RankingAdvisorStep, a: Partial<RankingAdvisorAnswers>) => {
    if (next === 'alternatives') return isEn ? 'What options do you want to compare? Write their names, separated by commas or on separate lines. At least two options are needed.' : 'چه گزینه‌هایی را می‌خواهید با هم مقایسه کنید؟ نام آن‌ها را با ویرگول یا در چند خط بنویسید. دست‌کم دو گزینه لازم است.'
    if (next === 'evidence') return isEn ? 'What kind of information do you have for comparing them: mostly measurable numbers, a mix of numbers and expert judgment, or mostly qualitative descriptions?' : 'اطلاعات مقایسه این گزینه‌ها از چه نوعی است؟ بیشتر عددی و قابل‌اندازه‌گیری، ترکیبی از عدد و نظر کارشناسی، یا عمدتاً توصیفی و کیفی؟'
    if (next === 'weights') return isEn ? 'Do you already know how important each criterion is, or should we determine criterion weights from your judgments or experts?' : 'اهمیت نسبی معیارها را از قبل می‌دانید، یا باید وزن معیارها را با نظر شما یا خبرگان تعیین کنیم؟'
    if (next === 'decisionMakers') return isEn ? 'Will one person make this decision, or should several experts/stakeholders contribute?' : 'تصمیم را یک نفر می‌گیرد یا لازم است چند خبره و ذی‌نفع در آن مشارکت کنند؟'
    if (next === 'time') return isEn ? 'How much time can the experts spend on comparisons: limited time and fewer questions, or enough time for detailed pairwise judgments?' : 'خبرگان چقدر برای مقایسه‌ها وقت دارند؟ زمان محدود است و پرسش‌های کمتر ترجیح دارد، یا برای قضاوت‌های دقیق‌تر فرصت کافی دارند؟'
    if (next === 'dependencies') return isEn ? 'Are the criteria largely independent, or does one criterion directly affect another? For example, quality may affect operating cost.' : 'معیارها عمدتاً مستقل‌اند یا بعضی معیارها مستقیماً بر هم اثر می‌گذارند؟ مثلاً کیفیت ممکن است بر هزینه بهره‌برداری اثر بگذارد.'
    if (next === 'uncertainty') return isEn ? 'How reliable are the available figures and judgments: relatively stable, or substantially uncertain?' : 'اطمینان شما به اعداد و قضاوت‌های موجود چقدر است؟ نسبتاً پایدار و قابل‌اتکا هستند یا عدم‌قطعیت قابل‌توجهی دارند؟'
    return ''
  }
  const clarify = (text: string) => {
    setClarificationCount(count => count + 1)
    addAssistant(text)
  }
  const parsePurpose = (v: string): RankingAdvisorAnswers['purpose'] | null => {
    if (/سرمایه|investment|طرح توجیه|اقتصادی/i.test(v)) return 'investment'
    if (/تأمین.?کننده|تامين.?كننده|supplier|فروشنده/i.test(v)) return 'supplier'
    if (/پروژه|طرح.?ها|project/i.test(v)) return 'project'
    if (/راهبرد|استراتژ|strategy/i.test(v)) return 'strategy'
    if (/سایر|عمومی|other|general/i.test(v)) return 'general'
    return null
  }
  const parseAlternatives = (v: string) => v.split(/[\n,،;؛]+/).map(item => item.trim()).filter(Boolean).slice(0, 12)
  const submit = (raw: string) => {
    const value = raw.trim()
    if (!value || step === 'result') return
    setMessages(current => [...current, { role: 'user', text: value }])
    setInput('')
    let next: RankingAdvisorStep | null = null
    const a = { ...answers }
    if (step === 'purpose') {
      const purpose = parsePurpose(value)
      if (!purpose) { clarify(isEn ? 'I could not identify the decision type. Could you clarify: investment, supplier, project prioritization, strategy, or another decision?' : 'نوع تصمیم برایم روشن نشد. لطفاً مشخص کنید موضوع سرمایه‌گذاری، انتخاب تأمین‌کننده، اولویت‌بندی پروژه، راهبرد یا تصمیم دیگری است؟'); return }
      a.purpose = purpose; next = 'alternatives'
    } else if (step === 'alternatives') {
      const names = parseAlternatives(value)
      if (names.length < 2) { clarify(isEn ? 'I need at least two distinct option names. Please write their names, not just the number of options.' : 'برای مقایسه حداقل دو نام متمایز لازم دارم. لطفاً نام گزینه‌ها را بنویسید، نه فقط تعداد آن‌ها را.'); return }
      a.alternatives = names; setAlternativesText(names.join('\n')); next = 'evidence'
    } else if (step === 'evidence') {
      if (/عددی|عدد|quantit|numeric|measur/i.test(value) && !/ترکیب|مختلط|mixed/i.test(value)) a.evidence = 'numeric'
      else if (/ترکیب|مختلط|کیفی.*عددی|mixed|both/i.test(value)) a.evidence = 'mixed'
      else if (/کیفی|توصیف|قضاوتی|qualit/i.test(value)) a.evidence = 'qualitative'
      else { clarify(isEn ? 'Do you mainly have numeric data, a mix of numeric and qualitative data, or qualitative judgments?' : 'منظورتان کدام است: داده عمدتاً عددی، ترکیبی از عددی و کیفی، یا قضاوت‌های عمدتاً کیفی؟'); return }
      next = 'weights'
    } else if (step === 'weights') {
      if (/مشخص|دارم|known|given|already|تعیین شده/i.test(value)) a.weights = 'known'
      else if (/خبره|کارشناس|نظر|استخراج|experts?|elicit/i.test(value)) a.weights = 'experts'
      else if (/نمی.?دانم|مطمئن نیستم|نامشخص|نامعلوم|unknown|not sure/i.test(value)) a.weights = 'unknown'
      else { clarify(isEn ? 'Are the weights already known, should experts determine them, or are you not sure yet?' : 'وزن‌ها از قبل مشخص‌اند، باید از خبرگان استخراج شوند یا هنوز مطمئن نیستید؟'); return }
      next = 'decisionMakers'
    } else if (step === 'decisionMakers') {
      if (/یک نفر|یک تصمیم|تنها|خودم|فردی|solo|one person|single/i.test(value)) { a.decisionMakers = 'solo'; next = 'dependencies' }
      else if (/چند|گروه|خبره|ذی.?نفع|group|multiple|several/i.test(value)) { a.decisionMakers = 'group'; next = 'time' }
      else { clarify(isEn ? 'Is this a single-person decision or a group decision involving several experts?' : 'تصمیم فردی است یا گروهی و با مشارکت چند خبره انجام می‌شود؟'); return }
    } else if (step === 'time') {
      if (/محدود|کم|کوتاه|short|limited|کمتر/i.test(value)) a.time = 'short'
      else if (/کافی|زیاد|فرصت|enough|ample|detailed/i.test(value)) a.time = 'enough'
      else { clarify(isEn ? 'Would you describe expert time as limited or sufficient for detailed comparisons?' : 'زمان خبرگان را محدود می‌دانید یا برای مقایسه‌های دقیق کافی است؟'); return }
      next = 'dependencies'
    } else if (step === 'dependencies') {
      if (/مستقل|جدا|independent|no relation/i.test(value)) a.dependencies = 'independent'
      else if (/وابسته|اثر.*هم|تأثیر|ارتباط|dependent|influence|interact/i.test(value)) a.dependencies = 'dependent'
      else { clarify(isEn ? 'Are criteria independent, or do some criteria influence one another?' : 'معیارها مستقل‌اند یا بعضی بر یکدیگر اثر می‌گذارند؟'); return }
      next = 'uncertainty'
    } else if (step === 'uncertainty') {
      if (/کم|پایین|قابل.?اتکا|مطمئن|stable|reliable|low/i.test(value)) a.uncertainty = 'low'
      else if (/زیاد|بالا|نامطمئن|متغیر|uncertain|high|volatile/i.test(value)) a.uncertainty = 'high'
      else { clarify(isEn ? 'Is uncertainty low and data relatively reliable, or high and data uncertain?' : 'عدم‌قطعیت کم و داده‌ها قابل‌اتکا هستند یا زیاد و داده‌ها نامطمئن‌اند؟'); return }
      next = 'result'
    }
    if (!next) return
    setAnswers(a)
    setClarificationCount(0)
    if (next !== 'result') {
      setStep(next)
      addAssistant(questionFor(next, a))
      return
    }
    const method: RankingAdvisorMethod =
      a.weights === 'known' && a.evidence === 'numeric'
        ? ((a.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM')
        : a.decisionMakers === 'group' && a.time === 'short'
          ? 'BWM'
          : a.weights === 'experts' || a.decisionMakers === 'group' || a.evidence !== 'numeric'
            ? 'AHP+TOPSIS'
            : ((a.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM')
    const criteriaByPurpose: Record<RankingAdvisorAnswers['purpose'], string[]> = {
      investment: ['ارزش فعلی خالص (NPV)', 'سرمایه‌گذاری ثابت (CAPEX)', 'هزینه بهره‌برداری (OPEX)', 'ریسک اجرا', 'زمان اجرا', 'ظرفیت یا خروجی'],
      supplier: ['قیمت کل مالکیت', 'کیفیت محصول', 'تحویل به‌موقع', 'انطباق فنی', 'خدمات و ضمانت', 'ریسک تأمین'],
      project: ['هم‌راستایی راهبردی', 'ارزش اقتصادی', 'امکان‌پذیری فنی', 'ریسک اجرا', 'نیاز منابع', 'زمان تحقق'],
      strategy: ['هم‌راستایی با اهداف', 'ارزش‌آفرینی', 'امکان‌پذیری', 'ریسک راهبردی', 'نیاز منابع', 'زمان اثرگذاری'],
      general: ['هزینه کل', 'کیفیت و عملکرد', 'ریسک', 'زمان اجرا', 'قابلیت توسعه', 'اثر بلندمدت'],
    }
    const criteria = criteriaByPurpose[a.purpose!]
    setCriteriaText(criteria.join('\n'))
    const rationale = method === 'WSM'
      ? (isEn ? 'WSM is transparent and easy to audit for a small set of options with known weights and numeric scores.' : 'WSM برای تعداد محدود گزینه، وزن‌های مشخص و امتیازهای عددی، ساده و شفاف است و به‌راحتی قابل بازبینی است.')
      : method === 'TOPSIS'
        ? (isEn ? 'TOPSIS compares each option with an ideal best and worst profile; it is useful for several numeric alternatives.' : 'TOPSIS هر گزینه را با وضعیت ایده‌آل و ضدایده‌آل مقایسه می‌کند و برای چندین گزینه با داده عددی مناسب است.')
        : method === 'BWM'
          ? (isEn ? 'BWM reduces expert workload: each expert identifies the best and worst criterion and makes focused comparisons.' : 'BWM بار کاری خبرگان را کم می‌کند؛ هر خبره بهترین و بدترین معیار را تعیین و مقایسه‌های محدودتری ثبت می‌کند.')
          : (isEn ? 'AHP elicits criterion weights from pairwise expert judgments, then TOPSIS ranks options using the performance matrix.' : 'در AHP وزن معیارها از مقایسه‌های زوجی خبرگان به‌دست می‌آید و سپس TOPSIS با ماتریس عملکرد، گزینه‌ها را رتبه‌بندی می‌کند.')
    const caution = a.dependencies === 'dependent'
      ? (isEn ? 'Some criteria influence one another. ANP models dependencies but is not currently available here; interpret the suggested method cautiously and avoid double-counting.' : 'برخی معیارها بر هم اثر دارند. ANP برای مدل‌سازی وابستگی‌ها مناسب‌تر است اما فعلاً در این ابزار پیاده‌سازی نشده؛ از دوباره‌شماری اثرها پرهیز کنید و نتیجه را با احتیاط تفسیر کنید.')
      : (isEn ? 'Keep criteria distinct and measurable; specify a unit, period, source and benefit/cost direction for each.' : 'معیارها را مستقل و بدون هم‌پوشانی تعریف کنید و برای هرکدام واحد، دوره سنجش، منبع و جهت سود/هزینه تعیین کنید.')
    setStep('result')
    addAssistant((isEn ? 'Thank you. Based on your answers, my recommendation is ' : 'ممنون. بر اساس پاسخ‌هایتان، پیشنهاد من روش ') + method + '. ' + rationale)
    addAssistant(caution)
    addAssistant(isEn ? 'Next, review the suggested criteria below. You can edit or remove any criterion before opening the manual entry form.' : 'حالا معیارهای پیشنهادی را در ادامه بازبینی کنید. پیش از ورود به فرم دستی می‌توانید هر معیار را ویرایش یا حذف کنید.')
  }
  const send = () => submit(input)
  const quickReplies = step === 'purpose'
    ? (isEn ? ['Investment', 'Supplier selection', 'Project prioritization', 'Strategy', 'Other'] : ['انتخاب سرمایه‌گذاری', 'انتخاب تأمین‌کننده', 'اولویت‌بندی پروژه', 'انتخاب راهبرد', 'سایر'])
    : step === 'evidence'
      ? (isEn ? ['Numeric data', 'Mixed data', 'Qualitative judgments'] : ['داده عددی', 'داده ترکیبی', 'اطلاعات کیفی'])
      : step === 'weights'
        ? (isEn ? ['Weights are known', 'Experts should set weights', 'Not sure yet'] : ['وزن‌ها مشخص است', 'استخراج وزن از خبرگان', 'هنوز مطمئن نیستم'])
        : step === 'decisionMakers'
          ? (isEn ? ['One decision maker', 'Several experts'] : ['یک تصمیم‌گیرنده', 'چند خبره'])
          : step === 'time'
            ? (isEn ? ['Limited time', 'Enough time'] : ['زمان محدود', 'زمان کافی'])
            : step === 'dependencies'
              ? (isEn ? ['Independent criteria', 'Some criteria are dependent'] : ['معیارها مستقل‌اند', 'برخی معیارها وابسته‌اند'])
              : step === 'uncertainty'
                ? (isEn ? ['Low uncertainty', 'High uncertainty'] : ['عدم‌قطعیت کم', 'عدم‌قطعیت زیاد'])
                : []
  const parsedCriteria = criteriaText.split(/\r?\n|[,،;؛]/).map(item => item.trim()).filter(Boolean).slice(0, 8)
  const parsedOptions = alternativesText.split(/\r?\n|[,،;؛]/).map(item => item.trim()).filter(Boolean).slice(0, 12)
  const directions = parsedCriteria.map(name => /هزینه|سرمایه|ریسک|زمان|مصرف|قیمت|نیاز منابع/i.test(name) ? 'cost' as const : 'benefit' as const)
  return <section className="module-workspace-card" aria-label={isEn ? 'Conversational ranking advisor' : 'دستیار محاوره‌ای رتبه‌بندی'} data-testid="ranking-conversation">
    <div className="section-head"><div><h2>{isEn ? 'Conversational decision advisor' : 'دستیار گفت‌وگومحور انتخاب روش رتبه‌بندی'}</h2><p>{isEn ? 'A step-by-step conversation that adapts to your answers. No other module data is accessed.' : 'گفت‌وگویی مرحله‌ای که با پاسخ شما پیش می‌رود؛ هیچ داده‌ای از ماژول‌های دیگر دریافت نمی‌شود.'}</p></div><button type="button" className="secondary-button" onClick={start}>{started ? (isEn ? 'Start over' : 'شروع گفت‌وگوی جدید') : (isEn ? 'Talk to the advisor' : 'گفت‌وگو با دستیار')}</button></div>
    {started && <div style={{ marginTop: 14 }}>
      <div role="log" aria-live="polite" aria-label={isEn ? 'Conversation' : 'گفت‌وگو'} style={{ display: 'grid', gap: 9, maxHeight: 360, overflowY: 'auto', padding: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
        {messages.map((message, index) => <div key={index} style={{ justifySelf: message.role === 'user' ? 'end' : 'start', maxWidth: '92%', padding: '9px 12px', borderRadius: 12, background: message.role === 'user' ? 'var(--surface-2, #eef3f7)' : 'var(--surface, #fff)', border: '1px solid var(--line)' }}><b>{message.role === 'user' ? (isEn ? 'You' : 'شما') : (isEn ? 'Advisor' : 'دستیار')}</b><div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{message.text}</div></div>)}
      </div>
      {step !== 'result' && <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {quickReplies.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{quickReplies.map(reply => <button key={reply} type="button" className="secondary-button" onClick={() => submit(reply)}>{reply}</button>)}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}><input aria-label={isEn ? 'Your answer' : 'پاسخ شما'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); send() } }} placeholder={isEn ? 'Type your answer in your own words…' : 'پاسخ خود را به زبان خودتان بنویسید…'}/><button type="button" className="primary" onClick={send} disabled={!input.trim()}>{isEn ? 'Send' : 'ارسال'}</button></div>
      </div>}
      {step === 'result' && <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
        <div><h3>{isEn ? 'Recommended method' : 'روش پیشنهادی'}: {answers.weights === 'known' && answers.evidence === 'numeric' ? ((answers.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM') : answers.decisionMakers === 'group' && answers.time === 'short' ? 'BWM' : answers.weights === 'experts' || answers.decisionMakers === 'group' || answers.evidence !== 'numeric' ? 'AHP+TOPSIS' : ((answers.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM')}</h3>
          <p className="muted">{isEn ? 'Method selection is advisory. Review the assumptions and use sensitivity analysis before a consequential decision.' : 'این پیشنهاد راهنماست؛ پیش از تصمیم مهم، مفروضات را بازبینی و تحلیل حساسیت را اجرا کنید.'}</p></div>
        <label style={{ display: 'grid', gap: 5 }}><b>{isEn ? 'Suggested criteria (one per line; edit freely)' : 'معیارهای پیشنهادی (هر معیار در یک خط؛ قابل ویرایش)'}</b><textarea rows={5} value={criteriaText} onChange={event => setCriteriaText(event.target.value)} /></label>
        <label style={{ display: 'grid', gap: 5 }}><b>{isEn ? 'Options to compare (one per line)' : 'گزینه‌های مقایسه (هر گزینه در یک خط)'}</b><textarea rows={3} value={alternativesText} onChange={event => setAlternativesText(event.target.value)} /></label>
        <div><b>{isEn ? 'How to define each criterion' : 'چگونه هر معیار را تعریف کنید'}</b><ul><li>{isEn ? 'Give it a unique, unambiguous name and a measurable operational definition.' : 'نام یکتا و بدون ابهام و تعریف عملیاتی قابل‌اندازه‌گیری برای آن بنویسید.'}</li><li>{isEn ? 'Specify the unit, time period, data source and whether higher or lower is better.' : 'واحد، دوره سنجش، منبع داده و بهتر بودن مقدار بیشتر یا کمتر را مشخص کنید.'}</li><li>{isEn ? 'For qualitative factors, use a shared anchored scale (for example 1–5) and describe what each score means.' : 'برای عوامل کیفی از مقیاس مشترک دارای تعریف (مثلاً ۱ تا ۵) استفاده کنید و معنای هر امتیاز را بنویسید.'}</li><li>{isEn ? 'Avoid overlapping criteria; record eligibility thresholds separately from weighted criteria.' : 'از معیارهای هم‌پوشان پرهیز کنید و شروط احراز را جدا از معیارهای وزن‌دار ثبت کنید.'}</li></ul></div>
        <div><b>{isEn ? 'Manual data-entry guide' : 'راهنمای ورود دستی اطلاعات'}</b><ol><li>{isEn ? 'Add or edit criteria and choose benefit/cost direction.' : 'معیارها را اضافه یا ویرایش و جهت سود/هزینه را تعیین کنید.'}</li><li>{isEn ? 'Add the alternatives and enter one comparable value per criterion and alternative.' : 'گزینه‌ها را اضافه کنید و برای هر گزینه در برابر هر معیار یک مقدار قابل‌مقایسه وارد کنید.'}</li><li>{isEn ? 'Use the same unit, reference period and scoring scale across all alternatives.' : 'برای تمام گزینه‌ها واحد، دوره مرجع و مقیاس امتیازدهی یکسان به‌کار ببرید.'}</li><li>{isEn ? 'Leave unknown values blank; do not replace missing evidence with zero.' : 'مقادیر نامعلوم را خالی بگذارید و داده مفقود را با صفر جایگزین نکنید.'}</li></ol></div>
        {answers.dependencies === 'dependent' && <p className="muted">{isEn ? 'Because some criteria are dependent, note that ANP is designed for interdependent criteria but is not currently implemented in this module.' : 'با توجه به وابستگی بعضی معیارها، توجه کنید ANP برای معیارهای وابسته مناسب است اما فعلاً در این ماژول پیاده‌سازی نشده است.'}</p>}
        {answers.uncertainty === 'high' && <p className="muted">{isEn ? 'Your data is uncertain: use optimistic/pessimistic scenarios and rank sensitivity; do not treat a single ranking as definitive.' : 'با توجه به عدم‌قطعیت بالا، سناریوهای خوش‌بینانه/بدبینانه و تحلیل حساسیت رتبه را اجرا کنید و یک رتبه منفرد را قطعی تلقی نکنید.'}</p>}
        <button type="button" className="primary" disabled={parsedCriteria.length < 1 || parsedOptions.length < 2} onClick={() => onChoose(
          answers.weights === 'known' && answers.evidence === 'numeric' ? ((answers.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM') : answers.decisionMakers === 'group' && answers.time === 'short' ? 'BWM' : answers.weights === 'experts' || answers.decisionMakers === 'group' || answers.evidence !== 'numeric' ? 'AHP+TOPSIS' : ((answers.alternatives?.length ?? 0) >= 5 ? 'TOPSIS' : 'WSM'),
          parsedCriteria, parsedOptions, directions
        )}>{isEn ? 'Open manual ranking form' : 'تأیید و ورود به فرم دستی رتبه‌بندی'}</button>
      </div>}
    </div>}
  </section>
}

type RankingWorkspaceProject = { id: string; name: string; createdAt: string; updatedAt: string; method: RankingAdvisorMethod }

function RankingMethodChooser({ language, registerBackHandler }: { language: 'fa' | 'en'; registerBackHandler: (handler: (() => boolean) | null) => void }) {
  const isEn = language === 'en'
  const [category, setCategory] = useState<'INITIAL' | 'ADVANCED'>('INITIAL')
  const [rankingProjects, setRankingProjects] = useState<RankingWorkspaceProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [newRankingProjectName, setNewRankingProjectName] = useState('')
  const [editingRankingProjectName, setEditingRankingProjectName] = useState('')
  const [rankingProjectsLoaded, setRankingProjectsLoaded] = useState(false)
  const selectedProject = rankingProjects.find(project => project.id === selectedProjectId) ?? null
  useEffect(() => {
    let alive = true
    localStore.get<RankingWorkspaceProject[]>('mod10-ranking-projects:v1').then(items => {
      if (!alive) return
      const safe = Array.isArray(items) ? items : []
      setRankingProjects(safe)
      setRankingProjectsLoaded(true)
    }).catch(() => { if (alive) setRankingProjectsLoaded(true) })
    return () => { alive = false }
  }, [])
  const persistRankingProjects = async (items: RankingWorkspaceProject[]) => {
    setRankingProjects(items)
    await localStore.set('mod10-ranking-projects:v1', items)
  }
  const createRankingProject = async () => {
    if (!rankingProjectsLoaded) return
    const name = newRankingProjectName.trim()
    if (!name) return
    const now = new Date().toISOString()
    const item: RankingWorkspaceProject = { id: 'ranking-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), name, createdAt: now, updatedAt: now, method: 'WSM' }
    const key = 'mod10-ranking-projects:v1'
    // Merge against the authoritative persisted index so creating a second project
    // cannot overwrite a renamed project when React state is one render behind.
    const next = await localStore.update<RankingWorkspaceProject[]>(key, current => {
      const source = Array.isArray(current) ? current : rankingProjects
      return [item, ...source.filter(project => project.id !== item.id)]
    })
    setRankingProjects(next)
    try { localStorage.setItem('pishran_' + key, JSON.stringify(next)) } catch { /* IndexedDB remains authoritative. */ }
    setNewRankingProjectName('')
    setSelectedProjectId(item.id)
    setEditingRankingProjectName(item.name)
    setCategory('INITIAL')
  }
  const saveRankingProjectName = async () => {
    if (!selectedProject) return
    const name = editingRankingProjectName.trim()
    if (!name) return
    const key = 'mod10-ranking-projects:v1'
    const next = await localStore.update<RankingWorkspaceProject[]>(key, current => {
      const source = Array.isArray(current) ? current : rankingProjects
      return source.map(project => project.id === selectedProject.id
        ? { ...project, name, updatedAt: new Date().toISOString() }
        : project)
    })
    setRankingProjects(next)
    try { localStorage.setItem('pishran_' + key, JSON.stringify(next)) } catch { /* IndexedDB remains authoritative. */ }
  }
  const returnToRankingProjects = () => {
    // Creation and rename already commit the latest list and update React state.
    // Do not re-read storage here: a stale read can replace the current list and hide a saved project card.
    setSelectedProjectId(null)
  }
  useEffect(() => {
    registerBackHandler(() => {
      if (!selectedProjectId) return false
      void returnToRankingProjects()
      return true
    })
    return () => registerBackHandler(null)
  }, [selectedProjectId, registerBackHandler])
  const deleteRankingProject = async (projectId: string) => {
    const next = rankingProjects.filter(project => project.id !== projectId)
    await persistRankingProjects(next)
    if (selectedProjectId === projectId) setSelectedProjectId(null)
    await localStore.set('mod10-ranking-draft:' + projectId, null)
    await localStore.set('mod10-ranking-method-draft:' + projectId, null)
    await localStore.set('mod10-ranking-method-history:' + projectId, null)
    await localStore.set('mod10-ranking-sensitivity-history:' + projectId, null)
  }
  const [initialPanelKey, setInitialPanelKey] = useState(0)
  const [advancedPanelKey, setAdvancedPanelKey] = useState(0)
  const [recommendedMethod, setRecommendedMethod] = useState<RankingAdvisorMethod>('AHP')
  const [suggestedCriteria, setSuggestedCriteria] = useState<string[]>([])
  const [suggestedAlternatives, setSuggestedAlternatives] = useState<string[]>([])
  const [suggestedScores, setSuggestedScores] = useState<Array<Array<number | null>>>([])
  const [suggestedDirections, setSuggestedDirections] = useState<Array<'benefit' | 'cost'>>([])
  const applyAdvisor = async (method: RankingAdvisorMethod, criteria: string[], alternatives: string[], directions: Array<'benefit' | 'cost'>) => {
    const cleanCriteria = criteria.map(value => value.trim()).filter(Boolean).slice(0, 8)
    const cleanAlternatives = alternatives.map(value => value.trim()).filter(Boolean).slice(0, 12)
    if (!cleanCriteria.length || cleanAlternatives.length < 2) return
    setRecommendedMethod(method)
    if (selectedProject) await persistRankingProjects(rankingProjects.map(project => project.id === selectedProject.id ? { ...project, method, updatedAt: new Date().toISOString() } : project))
    const selectedDirections: Array<'benefit' | 'cost'> = cleanCriteria.map((name, index) => directions[index] ?? (/هزینه|سرمایه|ریسک|زمان|مصرف|قیمت|نیاز منابع/.test(name) ? 'cost' : 'benefit'))
    const blankMatrix = cleanAlternatives.map(() => cleanCriteria.map(() => null))
    if (method === 'WSM') {
      const id = (prefix: string) => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)
      const draft: RankingDraft = {
        criteria: cleanCriteria.map((name, index) => ({ id: id('criterion'), name, weight: 1, direction: selectedDirections[index], minimum: null })),
        options: cleanAlternatives.map(name => ({ id: id('option'), name, scores: {} })),
      }
      await localStore.set('mod10-ranking-draft:' + (selectedProject?.id ?? 'unsaved'), draft)
      setInitialPanelKey(value => value + 1)
      setSuggestedCriteria([])
      setSuggestedDirections([])
      setSuggestedAlternatives([])
      setSuggestedScores([])
      setCategory('INITIAL')
    } else {
      setAdvancedPanelKey(value => value + 1)
      setSuggestedCriteria(cleanCriteria)
      setSuggestedDirections(selectedDirections)
      setSuggestedAlternatives(cleanAlternatives)
      setSuggestedScores(blankMatrix)
      setCategory('ADVANCED')
    }
    setTimeout(() => document.getElementById('ranking-methods-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }
  return <div className="ranking-methods-workspace">
    {!selectedProject ? <section className="module-workspace-card" aria-labelledby="ranking-projects-title">
      <div className="section-head"><div><h2 id="ranking-projects-title">{isEn ? 'Ranking projects' : 'پروژه‌های رتبه‌بندی'}</h2><p>{isEn ? 'Each project keeps its own criteria, alternatives and ranking inputs. Open a project card to continue editing.' : 'هر پروژه معیارها، گزینه‌ها و اطلاعات رتبه‌بندی مستقل خود را دارد. برای ادامه و ویرایش، روی کارت پروژه کلیک کنید.'}</p></div><span className="muted">{rankingProjects.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</span></div>
      <form className="module-create-form" onSubmit={event => { event.preventDefault(); void createRankingProject() }}>
        <label htmlFor="ranking-project-new-name">{isEn ? 'New ranking project name' : 'نام پروژه رتبه‌بندی جدید'}</label>
        <div><input id="ranking-project-new-name" value={newRankingProjectName} onChange={event => setNewRankingProjectName(event.target.value)} placeholder={isEn ? 'Enter a project name' : 'نام پروژه را وارد کنید'} maxLength={100} disabled={!rankingProjectsLoaded}/><button className="primary" type="submit" disabled={!rankingProjectsLoaded || !newRankingProjectName.trim()}><Plus size={17}/>{isEn ? 'Create project' : 'ایجاد پروژه'}</button></div>
      </form>
      {rankingProjectsLoaded && rankingProjects.length > 0 ? <div className="module-workspace-list">{rankingProjects.map(project => <article className="module-workspace-item" key={project.id}>
        <button type="button" className="ranking-project-open" style={{flex:1,display:"flex",flexDirection:"column",alignItems:"flex-start",gap:5,textAlign:"start",padding:12,border:0,background:"transparent",cursor:"pointer",minWidth:0}} onClick={() => { setSelectedProjectId(project.id); setEditingRankingProjectName(project.name); setRecommendedMethod(project.method ?? 'WSM'); setCategory(project.method === 'WSM' ? 'INITIAL' : 'ADVANCED'); setInitialPanelKey(value => value + 1); setAdvancedPanelKey(value => value + 1) }}>
          <b>{project.name}</b><small>{isEn ? 'Last updated ' : 'آخرین ویرایش '} {new Date(project.updatedAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}</small><span>{isEn ? 'Open and edit →' : 'ورود و ویرایش ←'}</span>
        </button>
        <div className="module-workspace-item-actions"><button type="button" className="icon-button" aria-label={isEn ? 'Delete ' + project.name : 'حذف ' + project.name} title={isEn ? 'Delete project' : 'حذف پروژه'} onClick={() => void deleteRankingProject(project.id)}><Trash2 size={16}/></button></div>
      </article>)}</div> : <div className="empty-state"><b>{isEn ? 'No ranking projects yet' : 'هنوز پروژه رتبه‌بندی ایجاد نشده است'}</b><p>{isEn ? 'Create a project to start a separate ranking process.' : 'برای آغاز یک فرآیند رتبه‌بندی مستقل، اولین پروژه را ایجاد کنید.'}</p></div>}
    </section> : <div data-module-export-root="true" data-project-export-id={selectedProject.id} className="ranking-project-export-root">
      <section className="module-workspace-card" aria-label={isEn ? 'Current ranking project' : 'پروژه رتبه‌بندی جاری'}>
        <div className="section-head"><div><button type="button" className="secondary" onClick={() => void returnToRankingProjects()}>{isEn ? '← All ranking projects' : '→ بازگشت به پروژه‌های رتبه‌بندی'}</button><h2 style={{marginTop:12}}>{isEn ? 'Edit ranking project' : 'ویرایش پروژه رتبه‌بندی'}</h2></div></div>
        <form className="module-create-form" onSubmit={event => { event.preventDefault(); void saveRankingProjectName() }}>
          <label htmlFor="ranking-project-edit-name">{isEn ? 'Project name' : 'نام پروژه'}</label>
          <div><input id="ranking-project-edit-name" value={editingRankingProjectName} onChange={event => setEditingRankingProjectName(event.target.value)} maxLength={100}/><button type="submit" className="primary" disabled={!editingRankingProjectName.trim()}><Check size={16}/>{isEn ? 'Save name' : 'ذخیره نام'}</button></div>
        </form>
        <ModuleExportActions moduleId={`ranking-${selectedProject.id}`} moduleTitle={selectedProject.name} language={language}/>
      </section>
      <RankingAdvisor language={language} onChoose={applyAdvisor}/>
    <section className="module-workspace-card">
      <div role="group" aria-label={isEn ? 'Method categories' : 'دسته‌بندی روش‌ها'} className="ranking-category-tabs">
        <button type="button" data-testid="ranking-category-initial" data-category="initial" className={`ranking-category-tab ranking-category-tab--initial ${category === 'INITIAL' ? 'is-active' : ''}`} aria-pressed={category === 'INITIAL'} onClick={() => setCategory('INITIAL')}>
          <span className="ranking-category-tab__index">01</span><span>{isEn ? 'Initial methods' : 'روش‌های اولیه'}</span><span className="ranking-category-tab__hint">{isEn ? 'Core' : 'پایه'}</span>
        </button>
        <button type="button" data-testid="ranking-category-advanced" data-category="advanced" className={`ranking-category-tab ranking-category-tab--advanced ${category === 'ADVANCED' ? 'is-active' : ''}`} aria-pressed={category === 'ADVANCED'} onClick={() => setCategory('ADVANCED')}>
          <span className="ranking-category-tab__index">02</span><span>{isEn ? 'Advanced methods' : 'روش‌های پیشرفته'}</span><span className="ranking-category-tab__hint">{isEn ? 'Pro' : 'تخصصی'}</span>
        </button>
      </div>
      {category === 'INITIAL'
        ? <div data-testid="ranking-initial-method" className="ranking-method-intro ranking-method-intro--initial">
            <h3>{isEn ? 'WSM · Weighted Sum Model' : 'WSM · مجموع وزنی (روش اولیه)'}</h3>
            <p className="muted">{isEn ? 'A straightforward starting point for scoring and comparing alternatives.' : 'روش پایه برای تعریف معیارها، وزن‌دهی و مقایسه امتیازی گزینه‌ها.'}</p>
          </div>
        : <div data-testid="ranking-advanced-methods" className="ranking-method-intro ranking-method-intro--advanced"></div>}
    {category === 'INITIAL' ? <RankingPanel key={(selectedProject?.id ?? 'unsaved') + '-' + initialPanelKey} language={language} projectId={selectedProject?.id ?? 'unsaved'} projectName={selectedProject?.name ?? ''}/> : <RankingMethodsPanel key={(selectedProject?.id ?? 'unsaved') + '-' + advancedPanelKey} language={language} projectId={selectedProject?.id ?? 'unsaved'} initialMethod={recommendedMethod === 'WSM' || recommendedMethod === 'AHP' ? 'AHP+TOPSIS' : recommendedMethod === 'BWM' ? 'BWM+TOPSIS' : recommendedMethod} suggestedCriteria={suggestedCriteria} suggestedAlternatives={suggestedAlternatives} suggestedScores={suggestedScores} suggestedDirections={suggestedDirections}/>}
    </section>
    </div>}
  </div>
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState('MOD-01')
  const [capabilitiesTab, setCapabilitiesTab] = useState<'assessment' | 'market'>('assessment')
  const [moduleWorkspaces, setModuleWorkspaces] = useState<ModuleWorkspace[]>([])
  const [moduleWorkspaceName, setModuleWorkspaceName] = useState('')
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null)
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('')
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))
  type NavigationEntry = { page: Page; project: FeasibilityProject | null; moduleId: string }
  const navigationStackRef = useRef<NavigationEntry[]>([{ page: 'dashboard', project: null, moduleId: 'MOD-01' }])
  const rankingBackHandlerRef = useRef<(() => boolean) | null>(null)
  const registerRankingBackHandler = useCallback((handler: (() => boolean) | null) => { rankingBackHandlerRef.current = handler }, [])
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false)

  useEffect(() => {
    const closeModuleDropdownOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.nav-dropdown')) return
      setModuleDropdownOpen(false)
    }
    const closeModuleDropdownOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModuleDropdownOpen(false)
    }
    document.addEventListener('pointerdown', closeModuleDropdownOnOutsidePointer)
    document.addEventListener('keydown', closeModuleDropdownOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeModuleDropdownOnOutsidePointer)
      document.removeEventListener('keydown', closeModuleDropdownOnEscape)
    }
  }, [])

  function navigateTo(nextPage: Page, nextProject: FeasibilityProject | null = activeProject, nextModuleId = activeModuleId) {
    const current = navigationStackRef.current[navigationStackRef.current.length - 1]
    if (current.page === nextPage && current.project?.id === nextProject?.id && current.moduleId === nextModuleId) return
    navigationStackRef.current.push({ page: nextPage, project: nextProject, moduleId: nextModuleId })
    window.history.pushState({ pishranNavigation: true }, '', window.location.href)
    setActiveProject(nextProject)
    setActiveModuleId(nextModuleId)
    setPage(nextPage)
  }

  function navigateBack(fallbackPage: Page) {
    if (navigationStackRef.current.length > 1) window.history.back()
    else navigateTo(fallbackPage)
  }

  useEffect(() => {
    // Each in-app navigation adds one history entry. Android's Back key
    // therefore unwinds nested screens first; at the dashboard, native
    // back is left untouched so the user can exit normally.
    const handlePopState = () => {
      if (rankingBackHandlerRef.current?.()) {
        window.history.pushState({ pishranNavigation: true }, '', window.location.href)
        return
      }
      if (navigationStackRef.current.length > 1) {
        navigationStackRef.current.pop()
        const previous = navigationStackRef.current[navigationStackRef.current.length - 1]
        setPage(previous.page)
        setActiveProject(previous.project)
        setActiveModuleId(previous.moduleId)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])


  useEffect(() => {
    let alive = true
    Promise.all([loadSettings(), purgeRemovedCaseProjects()])
      .then(async ([nextSettings]) => {
        const nextProjects = await seedComfarReferenceProjects()
        const info = await localStore.info()
        if (!alive) return
        setSettings(nextSettings)
        applySettings(nextSettings)
        setProjects(nextProjects)
        setStorageInfo(info)
        setReady(true)
      }).catch(() => setReady(true))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    localStore.get<ModuleWorkspace[]>('module-workspaces:v1').then(items => {
      if (alive) setModuleWorkspaces(Array.isArray(items) ? items : [])
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  useEffect(() => {
    document.documentElement.lang = settings.language
    document.documentElement.dir = settings.language === 'en' ? 'ltr' : 'rtl'
  }, [settings.language])

  useEffect(() => {
    if (!ready) return
    applySettings(settings)
    void saveSettings(settings)
  }, [settings, ready])

  const chart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 24, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: isEn ? ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'] : ['سال ۱', 'سال ۲', 'سال ۳', 'سال ۴', 'سال ۵'], axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf0f4' } } },
    series: [{ name: isEn ? 'Illustrative return' : 'بازده نمونه', type: 'line', smooth: true, data: [8, 12, 16, 19, 23], areaStyle: { opacity: .08 }, lineStyle: { width: 3 }, symbolSize: 8 }]
  }), [isEn])

  async function refreshStorage() {
    setStorageInfo(await localStore.info())
  }

  async function handleCreateProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'steelStage' | 'capacity' | 'location' | 'templateId'>) {
    const created = await createProject(input)
    setProjects(current => [created, ...current])
    await refreshStorage()
  }

  async function handleUpdateProject(id: string, patch: Partial<Pick<FeasibilityProject, 'name' | 'location'>>) {
    const updated = await updateProject(id, patch)
    setProjects(await listProjects())
    setActiveProject(current => current?.id === id ? updated : current)
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id)
    setProjects(await listProjects())
    await refreshStorage()
  }

  async function refreshAfterRestore() {
    await purgeRemovedCaseProjects()
    setSettings(await loadSettings())
    setProjects(await listProjects())
    setModuleWorkspaces(await localStore.get<ModuleWorkspace[]>('module-workspaces:v1') ?? [])
    await refreshStorage()
  }

  function openModule(moduleId: string) {
    setModuleDropdownOpen(false)
    navigateTo('module', activeProject, moduleId)
  }

  async function createModuleWorkspace() {
    const name = moduleWorkspaceName.trim()
    if (!name) return
    const record: ModuleWorkspace = { id: `${activeModuleId}-${Date.now()}`, moduleId: activeModuleId, name, createdAt: new Date().toISOString() }
    const next = [record, ...moduleWorkspaces]
    await localStore.set('module-workspaces:v1', next)
    setModuleWorkspaces(next)
    setModuleWorkspaceName('')
    await refreshStorage()
  }

  function beginEditModuleWorkspace(item: ModuleWorkspace) {
    setEditingWorkspaceId(item.id)
    setEditingWorkspaceName(item.name)
  }

  async function saveModuleWorkspaceEdit(id: string) {
    const name = editingWorkspaceName.trim()
    if (!name) return
    const next = moduleWorkspaces.map(item => item.id === id ? { ...item, name } : item)
    await localStore.set('module-workspaces:v1', next)
    setModuleWorkspaces(next)
    setEditingWorkspaceId(null)
    setEditingWorkspaceName('')
    await refreshStorage()
  }

  async function deleteModuleWorkspace(id: string) {
    const item = moduleWorkspaces.find(workspace => workspace.id === id)
    if (!item) return
    if (settings.confirmBeforeDelete && !window.confirm(isEn ? `Delete module project “${item.name}”?` : `پروژه «${item.name}» از این ماژول حذف شود؟`)) return
    const next = moduleWorkspaces.filter(workspace => workspace.id !== id)
    await localStore.set('module-workspaces:v1', next)
    setModuleWorkspaces(next)
    if (editingWorkspaceId === id) {
      setEditingWorkspaceId(null)
      setEditingWorkspaceName('')
    }
    await refreshStorage()
  }

  const activeModule = modules.find(item => item.id === activeModuleId) ?? modules[0]
  const ActiveModuleIcon = activeModule.icon
  const activeModuleWorkspaces = moduleWorkspaces.filter(item => item.moduleId === activeModule.id)

  return <main className={`app-shell app-page-${page}`} dir={isEn?"ltr":"rtl"}>
    <BackupScheduler/>
    <header className="topbar">
      <button className="language-switch page-language-switch" type="button" onClick={toggleLanguage} aria-label={isEn ? "Switch to Persian" : "Switch to English"}>{isEn ? "FA" : "EN"}</button>
      <div className="brand"><button className="brand-title" type="button" onClick={() => navigateTo('dashboard')}><span className="brandmark" aria-hidden="true"><Factory size={22} strokeWidth={2}/></span><span className="brand-name-wrap"><b>{isEn ? "Pishran" : "پیشران"}</b><sup className="brand-version" aria-label={isEn ? "Version 1.0.1" : "نسخه ۱.۰.۱"}>1.0.1</sup></span></button></div>
      <nav className="main-nav" aria-label={isEn?"Primary navigation":"ناوبری اصلی"}>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('dashboard')}>{isEn ? "Home" : "پیشخوان"}</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('projects')}>{isEn ? "Projects" : "پروژه‌ها"}</button>
        <button className={page === 'steel-group' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('steel-group')}>{isEn ? "Steel Group" : "گروه فولاد"}</button>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('guide')}>{isEn ? "Guide" : "راهنما"}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('settings')}>{isEn ? "Settings" : "تنظیمات"}</button>
      </nav>
      <div className="top-actions"></div>
    </header>

    {page === 'dashboard' && <>
      <section className="feasibility-launcher-card" aria-labelledby="feasibility-launcher-title" role="link" tabIndex={0} onClick={() => navigateTo('projects')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigateTo('projects') } }}>
        <div className="feasibility-launcher-icon"><BriefcaseBusiness size={24}/></div>
        <div className="feasibility-launcher-copy">
          <h1 id="feasibility-launcher-title">{isEn ? 'Technical & Economic Assessment – Feasibility Study' : 'ارزیابی فنی و اقتصادی-امکان سنجی'}</h1>
          <p>{isEn ? 'Integrated technical, engineering, market and financial assessment, with project risk analysis.' : 'محیط یکپارچه برای ارزیابی فنی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و بررسی ریسک پروژه‌ها.'}</p>
        </div>
      </section>

      <section className="module-launcher" aria-labelledby="module-launcher-title">
        <div className="module-launcher-heading">
          <div>
            <h2 id="module-launcher-title">{isEn ? 'Pishran Intelligent Modules' : 'ماژولهای هوشمند پیشران'}</h2>
            <p>{isEn ? 'Choose a workspace to review performance, investigate exceptions and take action.' : 'برای مشاهده عملکرد، بررسی انحراف‌ها و پیگیری اقدامات، ماژول موردنظر را انتخاب کنید.'}</p>
          </div>
          <span className="module-launcher-count"><b>12</b><small>{isEn ? 'MODULES' : 'ماژول'}</small></span>
        </div>
        <div className="module-launcher-groups">
          {Array.from(new Set(modules.map(item => item.group))).map(group => {
            const groupModules = modules.filter(item => item.group === group)
            return <section className="module-launcher-group" key={group}>
              <div className="module-launcher-group-heading">
                <h3>{isEn ? groupModules[0].enGroup : group}</h3>
              </div>
              <div className="module-launcher-grid">
                {groupModules.map(item => {
                  const Icon = item.icon
                  return <button type="button" key={item.id} className="module-launcher-card" onClick={() => openModule(item.id)}
                    aria-label={`${item.id}: ${isEn ? item.enTitle : item.title}`}>
                    <span className="module-launcher-icon" data-module={item.id}><Icon size={23} strokeWidth={2}/></span>
                    <span className="module-launcher-code">{item.id}</span>
                    <span className="module-launcher-copy">
                      <strong>{isEn ? item.enTitle : item.title}</strong>
                      <span>{isEn ? item.enSub : item.sub}</span>
                    </span>
                    <span className="module-launcher-open">{isEn ? 'Open' : 'ورود'} <span aria-hidden="true">↗</span></span>
                  </button>
                })}
              </div>
            </section>
          })}
        </div>
      </section>



      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} storageInfo={storageInfo} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => navigateTo('project-wizard', project)}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language}/>}
    {page === 'project-wizard' && activeProject && <div data-module-export-root="true" data-project-export-id={activeProject.id} className="feasibility-project-export-root">
      <ModuleExportActions moduleId={`feasibility-${activeProject.id}`} moduleTitle={activeProject.name} language={settings.language}/>
      <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => navigateBack('projects')}/>
    </div>}
    {page === 'module' && <section className="module-workspace-page" data-module-export-root="true">
      <div className="module-workspace-heading"><button type="button" className="secondary" onClick={() => navigateBack('projects')}>{isEn ? 'Back to previous layer' : 'بازگشت به لایه قبل'}</button><span className="module-id">{activeModule.id}</span></div>
      <ModuleExportActions moduleId={activeModule.id} moduleTitle={isEn ? activeModule.enTitle : activeModule.title} language={settings.language}/>
      {activeModule.id === 'MOD-01' && <ExecutiveDashboardPanel language={settings.language} onOpenModule={openModule}/>}
      {activeModule.id === 'MOD-02' && <ModuleIntelligencePanel moduleId={activeModule.id} language={settings.language}/>}
      {activeModule.id === 'MOD-03' && <OeeProductionPanel language={settings.language}/>}
      {activeModule.id === 'MOD-04' && <ModuleKpiPanel language={settings.language}/>}
      {activeModule.id === 'MOD-05' && <ModuleEnergyPanel language={settings.language}/>}
      {activeModule.id === 'MOD-06' && <MaintenancePanel language={settings.language}/>}
      {activeModule.id === 'MOD-10' && <RankingMethodChooser language={settings.language} registerBackHandler={registerRankingBackHandler}/>}
      {activeModule.id !== 'MOD-10' && <section className="module-workspace-card mod03-projects-card"><div className="section-head"><div><h2>{isEn ? 'Module workspaces' : 'پروژه‌های این ماژول'}</h2><p>{isEn ? 'Create and manage workspaces dedicated to this module.' : 'برای ثبت پروژه‌ها، تحلیل‌ها و اطلاعات اختصاصی این ماژول پروژه ایجاد کنید.'}</p></div><span className="muted">{activeModuleWorkspaces.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</span></div>
        <form className="module-create-form" onSubmit={event => { event.preventDefault(); void createModuleWorkspace() }}><label htmlFor="module-workspace-name">{isEn ? 'New module workspace name' : 'نام پروژه جدید ماژول'}</label><div><input id="module-workspace-name" value={moduleWorkspaceName} onChange={event => setModuleWorkspaceName(event.target.value)} placeholder={isEn ? 'Enter a name' : 'نام پروژه را وارد کنید'} maxLength={100}/><button className="primary" type="submit" disabled={!moduleWorkspaceName.trim()}><Plus size={17}/>{isEn ? 'Create' : 'ایجاد پروژه'}</button></div></form>
        {activeModuleWorkspaces.length ? <div className="module-workspace-list">{activeModuleWorkspaces.map(item => <article className="module-workspace-item mod03-project-card" key={item.id}><div className="module-workspace-item-main">{editingWorkspaceId === item.id ? <form className="module-workspace-edit-form" onSubmit={event => { event.preventDefault(); void saveModuleWorkspaceEdit(item.id) }}><input aria-label={isEn ? 'Project name' : 'نام پروژه'} value={editingWorkspaceName} onChange={event => setEditingWorkspaceName(event.target.value)} maxLength={100} autoFocus/><button type="submit" className="icon-button" title={isEn ? 'Save changes' : 'ذخیره ویرایش'} aria-label={isEn ? 'Save changes' : 'ذخیره ویرایش'} disabled={!editingWorkspaceName.trim()}><Check size={17}/></button><button type="button" className="icon-button" title={isEn ? 'Cancel editing' : 'لغو ویرایش'} aria-label={isEn ? 'Cancel editing' : 'لغو ویرایش'} onClick={() => { setEditingWorkspaceId(null); setEditingWorkspaceName('') }}><X size={17}/></button></form> : <><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}</small></>}</div><div className="module-workspace-item-actions">{editingWorkspaceId !== item.id && <button type="button" className="icon-button" title={isEn ? 'Edit project' : 'ویرایش پروژه'} aria-label={isEn ? `Edit ${item.name}` : `ویرایش ${item.name}`} onClick={() => beginEditModuleWorkspace(item)}><Pencil size={16}/></button>}<button type="button" className="icon-button" title={isEn ? 'Delete project' : 'حذف پروژه'} aria-label={isEn ? `Delete ${item.name}` : `حذف ${item.name}`} onClick={() => void deleteModuleWorkspace(item.id)}><Trash2 size={16}/></button><span>{isEn ? 'Saved locally' : 'ذخیره‌شده روی دستگاه'}</span></div></article>)}</div> : <div className="empty-state"><b>{isEn ? 'No workspaces yet' : 'هنوز پروژه‌ای برای این ماژول ایجاد نشده است'}</b><p>{isEn ? 'Create the first workspace to start collecting module-specific information.' : 'با ایجاد اولین پروژه، اطلاعات و تحلیل‌های اختصاصی این ماژول را ثبت کنید.'}</p></div>}
      </section>}

      <details className="module-capabilities-card module-capabilities-disclosure">
        <summary className="module-capabilities-summary">{isEn ? 'Comparative assessment & market position — Ranking module' : 'ارزیابی تطبیقی و جایگاه بازار ماژول رتبه بندی'}</summary>
        <div className="module-capabilities-body">
        <div className="module-capabilities-heading">
          <span className="module-capabilities-eyebrow">{activeModule.id} · {isEn ? 'MARKET POSITION & BENCHMARKING' : 'ارزیابی تطبیقی و جایگاه بازار'}</span>
          <h2 id="module-capabilities-title">{isEn ? 'Comparative assessment & market position — Ranking module' : 'ارزیابی تطبیقی و جایگاه بازار ماژول رتبه بندی'}</h2>
        </div>
        {(() => { const profile = moduleCapabilityProfiles[activeModule.id]; const assessment = isEn ? profile.assessmentEn : profile.assessment; const benchmarks = isEn ? profile.benchmarksEn : profile.benchmarks; const learning = isEn ? profile.learningEn : profile.learning; return <>
          <div className="module-capabilities-tabs" role="tablist" aria-label={isEn ? 'Module evaluation sections' : 'بخش‌های ارزیابی ماژول'}>
            <button type="button" role="tab" id="module-tab-assessment" aria-selected={capabilitiesTab === 'assessment'} aria-controls="module-panel-assessment" className={capabilitiesTab === 'assessment' ? 'active' : ''} onClick={() => setCapabilitiesTab('assessment')}>{isEn ? 'Comparative assessment' : 'ارزیابی تطبیقی'}</button>
            <button type="button" role="tab" id="module-tab-market" aria-selected={capabilitiesTab === 'market'} aria-controls="module-panel-market" className={capabilitiesTab === 'market' ? 'active' : ''} onClick={() => setCapabilitiesTab('market')}>{isEn ? 'Market position' : 'جایگاه بازار'}</button>
          </div>
          {capabilitiesTab === 'assessment' ? <div className="module-capabilities-grid" role="tabpanel" id="module-panel-assessment" aria-labelledby="module-tab-assessment">
            <article className="module-capability-column"><h3>{isEn ? 'Evaluation dimensions' : 'محورهای ارزیابی'}</h3><ul>{assessment.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
          </div> : <div className="module-capabilities-grid" role="tabpanel" id="module-panel-market" aria-labelledby="module-tab-market">
            <article className="module-capability-column"><h3>{isEn ? 'Competitors & market references' : 'رقبا و نمونه‌های مرجع بازار'}</h3><ul>{benchmarks.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
            <article className="module-capability-column"><h3>{isEn ? 'Benchmarking & adopted practices' : 'الگوبرداری و رویه‌های منتخب'}</h3><ul>{learning.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
          </div>}
        </> })()}
        </div>
      </details>
    </section>}


    <footer>{isEn ? "Pishran · Intelligent Feasibility & Investment Assessment Platform" : "پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری"} <span>{isEn ? "No sign-in required" : "بدون نیاز به ورود یا حساب کاربری"}</span></footer>
  </main>
}
