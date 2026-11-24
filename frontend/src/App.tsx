import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen, Zap, Wrench, Boxes, Target, BriefcaseBusiness } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, purgeRemovedCaseProjects, listProjects, updateProject, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import FeasibilityWizard from './features/projects/FeasibilityWizard'
import Guide from './features/guide/Guide'
import BackupScheduler from './features/settings/BackupScheduler'
import ModuleIntelligencePanel from './features/modules/ModuleIntelligencePanel'
import ModuleKpiPanel from './features/modules/ModuleKpiPanel'
import ModuleEnergyPanel from './features/modules/ModuleEnergyPanel'
import MaintenancePanel from './features/modules/MaintenancePanel'
import ExecutiveDashboardPanel from './features/modules/ExecutiveDashboardPanel'
import ModuleExportActions from './features/modules/ModuleExportActions'

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
    assessment: ['تعریف معیارها، وزن‌ها، محدودیت‌ها و آستانه‌های حذف گزینه','تحلیل حساسیت رتبه به تغییر وزن و کیفیت داده','قابلیت توضیح رتبه نهایی، منشأ امتیاز و عدم‌قطعیت'],
    benchmarks: ['Decision Lens؛ Analytica؛ Hiview3 و روش‌های MCDA مانند AHP، TOPSIS و PROMETHEE — نمونه ابزار و روش تصمیم‌گیری چندمعیاره'],
    learning: ['تفکیک معیارهای کمی و کیفی و نرمال‌سازی شفاف','نمایش وزن، امتیاز خام، امتیاز نهایی و تحلیل حساسیت','ثبت نظر خبرگان و جلوگیری از رتبه‌بندی با داده ناقص بدون هشدار'],
    assessmentEn: ['Define criteria, weights, constraints and exclusion thresholds','Test ranking sensitivity to weight changes and data quality','Explain final ranks, score provenance and uncertainty'],
    benchmarksEn: ['Decision Lens; Analytica; Hiview3; MCDA methods including AHP, TOPSIS and PROMETHEE'],
    learningEn: ['Transparent normalization of quantitative and qualitative criteria','Show weights, raw scores, final scores and sensitivity','Capture expert judgment and flag incomplete evidence']
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


export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState('MOD-01')
  const [moduleWorkspaces, setModuleWorkspaces] = useState<ModuleWorkspace[]>([])
  const [moduleWorkspaceName, setModuleWorkspaceName] = useState('')
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))
  type NavigationEntry = { page: Page; project: FeasibilityProject | null; moduleId: string }
  const navigationStackRef = useRef<NavigationEntry[]>([{ page: 'dashboard', project: null, moduleId: 'MOD-01' }])
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
      .then(async ([nextSettings, nextProjects]) => {
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

  function continueToNextModule() {
    const currentIndex = modules.findIndex(item => item.id === activeModuleId)
    const nextModule = modules[currentIndex + 1]
    if (nextModule) openModule(nextModule.id)
    else navigateTo('dashboard')
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

  const activeModule = modules.find(item => item.id === activeModuleId) ?? modules[0]
  const ActiveModuleIcon = activeModule.icon
  const activeModuleWorkspaces = moduleWorkspaces.filter(item => item.moduleId === activeModule.id)

  return <main className={`app-shell app-page-${page}`} dir={isEn?"ltr":"rtl"}>
    <BackupScheduler/>
    <header className="topbar">
      <button className="language-switch page-language-switch" type="button" onClick={toggleLanguage} aria-label={isEn ? "Switch to Persian" : "Switch to English"}>{isEn ? "FA" : "EN"}</button>
      <div className="brand"><button className="brand-title" type="button" onClick={() => navigateTo('dashboard')}><b>{isEn ? "Pishran" : "پیشران"}</b></button></div>
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
                    <span className="module-launcher-copy">
                      <small>{item.id}</small>
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

      <section className="section-head"><div><h2>{isEn ? "Investment Control Center" : "مرکز کنترل سرمایه‌گذاری"}</h2></div><span className="muted">{isEn ? 'Version 1.0.1' : 'نسخه ۱.۰.۱'}</span></section>
      <section className="kpis">
        <article className="kpi"><span>{isEn ? 'Registered projects' : 'پروژه‌های ثبت‌شده'}</span><b>{projects.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</b><small>{isEn ? 'Stored on this device' : 'ذخیره‌شده روی این دستگاه'}</small></article>
        <article className="kpi"><span>{isEn ? 'Financial models' : 'مدل‌های مالی'}</span><b>{isEn ? '0' : '۰'}</b><small>{isEn ? 'Traceable and versioned calculations' : 'محاسبات قابل ثبت و نسخه‌بندی'}</small></article>
        <article className="kpi"><span>{isEn ? 'Compared scenarios' : 'سناریوهای مقایسه‌شده'}</span><b>{isEn?'0':'۰'}</b><small>{isEn ? 'A foundation for uncertainty analysis' : 'پایه‌ای برای تحلیل عدم‌قطعیت'}</small></article>
        <article className="kpi"><span>{isEn ? 'Storage status' : 'وضعیت ذخیره‌سازی'}</span><b className="live">{isEn&&storageInfo.backend==='در حال بررسی'?'Checking...':storageInfo.backend}</b><small>{isEn ? 'Data is kept on this device' : 'اطلاعات روی دستگاه نگهداری می‌شود'}</small></article>
      </section>

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => navigateTo('project-wizard', project)}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language}/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => navigateBack('projects')}/>}
    {page === 'module' && <section className="module-workspace-page" data-module-export-root="true">
      <div className="module-workspace-heading"><button type="button" className="secondary" onClick={() => navigateBack('dashboard')}>{isEn ? 'Back to home' : 'بازگشت به پیشخوان'}</button><span className="module-id">{activeModule.id}</span></div>
      <ModuleExportActions moduleId={activeModule.id} moduleTitle={isEn ? activeModule.enTitle : activeModule.title} language={settings.language}/>
      {activeModule.id === 'MOD-01' && <ExecutiveDashboardPanel language={settings.language} onOpenModule={openModule}/>}
      {(activeModule.id === 'MOD-02' || activeModule.id === 'MOD-03') && <ModuleIntelligencePanel moduleId={activeModule.id} language={settings.language}/>}
      {activeModule.id === 'MOD-04' && <ModuleKpiPanel language={settings.language}/>}
      {activeModule.id === 'MOD-05' && <ModuleEnergyPanel language={settings.language}/>}
      {activeModule.id === 'MOD-06' && <MaintenancePanel language={settings.language}/>}
      <section className="module-workspace-card"><div className="section-head"><div><h2>{isEn ? 'Module workspaces' : 'پروژه‌های این ماژول'}</h2><p>{isEn ? 'Create and manage workspaces dedicated to this module.' : 'برای ثبت پروژه‌ها، تحلیل‌ها و اطلاعات اختصاصی این ماژول پروژه ایجاد کنید.'}</p></div><span className="muted">{activeModuleWorkspaces.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</span></div>
        <form className="module-create-form" onSubmit={event => { event.preventDefault(); void createModuleWorkspace() }}><label htmlFor="module-workspace-name">{isEn ? 'New module workspace name' : 'نام پروژه جدید ماژول'}</label><div><input id="module-workspace-name" value={moduleWorkspaceName} onChange={event => setModuleWorkspaceName(event.target.value)} placeholder={isEn ? 'Enter a name' : 'نام پروژه را وارد کنید'} maxLength={100}/><button className="primary" type="submit" disabled={!moduleWorkspaceName.trim()}><Plus size={17}/>{isEn ? 'Create' : 'ایجاد پروژه'}</button></div></form>
        {activeModuleWorkspaces.length ? <div className="module-workspace-list">{activeModuleWorkspaces.map(item => <article className="module-workspace-item" key={item.id}><div><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}</small></div><span>{isEn ? 'Saved locally' : 'ذخیره‌شده روی دستگاه'}</span></article>)}</div> : <div className="empty-state"><b>{isEn ? 'No workspaces yet' : 'هنوز پروژه‌ای برای این ماژول ایجاد نشده است'}</b><p>{isEn ? 'Create the first workspace to start collecting module-specific information.' : 'با ایجاد اولین پروژه، اطلاعات و تحلیل‌های اختصاصی این ماژول را ثبت کنید.'}</p></div>}
      </section>
      <section className="module-capabilities-card" aria-labelledby="module-capabilities-title">
        <div className="module-capabilities-heading">
          <span className="module-capabilities-eyebrow">{activeModule.id} · {isEn ? 'MARKET POSITION & BENCHMARKING' : 'ارزیابی تطبیقی و جایگاه بازار'}</span>
          <h2 id="module-capabilities-title">{isEn ? <>Capabilities & Differentiators of “{activeModule.enTitle}”</> : <>قابلیت‌ها و وجه تمایز ماژول «{activeModule.title}»</>}</h2>
          <p>{isEn ? 'Evaluation dimensions, market reference solutions and the practices selected for Pishran. Listed products are reference examples, not a claim of identical scope.' : 'معیارهای ارزیابی، نمونه‌های بازار برای مقایسه و الگوهایی که در طراحی پیشران قابل اقتباس‌اند. نام محصولات، نمونه مرجع بازار است و به‌معنای یکسان‌بودن دامنه آن‌ها نیست.'}</p>
        </div>
        {(() => { const profile = moduleCapabilityProfiles[activeModule.id]; const assessment = isEn ? profile.assessmentEn : profile.assessment; const benchmarks = isEn ? profile.benchmarksEn : profile.benchmarks; const learning = isEn ? profile.learningEn : profile.learning; return <div className="module-capabilities-grid">
          <article className="module-capability-column"><h3>{isEn ? 'Evaluation dimensions' : 'محورهای ارزیابی'}</h3><ul>{assessment.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
          <article className="module-capability-column"><h3>{isEn ? 'Competitors & market references' : 'رقبا و نمونه‌های مرجع بازار'}</h3><ul>{benchmarks.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
          <article className="module-capability-column"><h3>{isEn ? 'Benchmarking & adopted practices' : 'الگوبرداری و رویه‌های منتخب'}</h3><ul>{learning.map((item,index)=><li key={index}>{item}</li>)}</ul></article>
        </div> })()}
      </section>
      <div className="module-continue-actions"><button className="primary" type="button" onClick={continueToNextModule}>{isEn ? (activeModule.id === 'MOD-12' ? 'Finish modules' : 'Continue') : (activeModule.id === 'MOD-12' ? 'پایان مرور ماژول‌ها' : 'ادامه بده')}</button></div>
    </section>}


    <footer>{isEn ? "Pishran · Intelligent Feasibility & Investment Assessment Platform" : "پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری"} <span>{isEn ? "Version 1.0.1 · No sign-in required" : "نسخه ۱.۰.۱ · بدون نیاز به ورود یا حساب کاربری"}</span></footer>
  </main>
}
