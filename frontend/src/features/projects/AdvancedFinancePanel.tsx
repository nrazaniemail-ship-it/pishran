import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { allocateJointVentureCashFlows, type JointVenturePartner, type PartnerFinanceResult } from './partnerFinance'
import { listFinancialMethods } from './financialMethodDirectory'
import type { ProjectCalendarPeriod, ProjectPeriodFrequency, ProjectDiscountConvention } from './projectFoundation'
import { calculateOperatingCycleWorkingCapital } from '../steel/financialModel'
import { allocateAnnualFlowsToPeriods, calculateIntegratedPeriodicFinance, buildPeriodicThreeFinancialStatements, fiscalYearIndexForPeriod, type PeriodicProjectFinanceResult, type PeriodicLoanInput, type PeriodTaxBracket } from '../steel/periodicFinancialEngine'
import {
  calculateIntegratedFinance, calculateAssetDepreciationSchedule, calculateSensitivityMatrix,
  calculateFinancialScenarios, calculateOneWaySensitivity, buildThreeFinancialStatements, type SensitivityCell, calculateComfarAssetLifecycle,
  calculateComfarCalendarAssetLifecycle,
  type IntegratedFinanceInput, type IntegratedFinanceResult, type IntegratedLoanInput, type DepreciationAssetInput,
  type ComfarDepreciationAssetInput, type ComfarAssetSaleInput, type OneWaySensitivityAnalysis,
} from '../steel/financialModel'

type CapexRow = { id: string; name: string; amount: number }
type Asset = DepreciationAssetInput
type Loan = IntegratedLoanInput & {
  periodDrawdowns?: number[]
  periodDrawdownDates?: string[]
  drawdownMode?: 'annual-day-weighted'|'period-manual'
  periodRepaymentStart?: number
  periodGracePeriods?: number
  periodTerm?: number
  periodRateConversion?: 'effective-annual-by-actual-days'|'effective-annual-divided-by-frequency'
  periodInterestConvention?: 'comfar-months-plus-360'|'actual-360'|'actual-365'
  exactDrawdownDates?: string[]
  rateChanges?: {effectiveDate:string;annualRatePercent:number}[]
  financingFees?: {date:string;amount:number;treatment:'expense'|'capitalize';label?:string}[]
  facilityLimit?: number
  commitmentFeeAnnualRatePercent?: number
  periodRepaymentMethod?: 'equal-principal'|'annuity'|'bullet'|'custom'
  customPrincipalRepayments?: {period:number;amount:number}[]
  balloonAtMaturity?: boolean
}
type Props = {
  projectId: string
  jointVenture?: boolean
  partners?: JointVenturePartner[]
  partnerDistributionPercent?: number
  currency: string
  constructionYears: number
  operatingYears: number
  capacity: number
  fullCapacityRevenue: number
  fullCapacityVariableCashCost: number
  fullCapacityFixedCashCost: number
  fixedInvestment: number
  preOperatingCost: number
  fixedInvestmentSchedule?: number[]
  preOperatingSchedule?: number[]
  initialWorkingCapital?: number
  initialWorkingCapitalEquityContribution?: number
  initialLoanRatePercent?: number
  initialRepaymentMethod?: Loan['repaymentMethod']
  loanTermYears?: number
  depreciationAssets?: Asset[]
  comfarDepreciationAssets?: ComfarDepreciationAssetInput[]
  comfarAssetSales?: ComfarAssetSaleInput[]
  comfarDepreciationWarnings?: string[]
  useFixedInvestmentRegister?: boolean
  workingCapitalDefaults?: { days: { raw:number; energy:number; spareParts:number; wip:number; finished:number; receivable:number; cash:number; payable:number }; bases: { rawMaterials:number; energy:number; spareParts:number; conversion:number; finishedGoods:number; cash:number; payables:number }; wipCompletion?: { material:number; conversion:number } }
  referenceVersion?: string
  initialDiscountMode?: 'wacc'|'manual'
  initialManualRate?: number
  mirrFinanceRate?: number
  mirrReinvestmentRate?: number
  onResult?: (result:IntegratedFinanceResult)=>void
  onSensitivity?: (analysis:OneWaySensitivityAnalysis)=>void
  onScenarioAnalysis?: (matrix:SensitivityCell[][], scenarios:ReturnType<typeof calculateFinancialScenarios>)=>void
  onPeriodicResult?: (result:PeriodicProjectFinanceResult|null)=>void
  onPartnerFinanceResult?: (result:PartnerFinanceResult|null)=>void
  equityPercent: number
  costOfEquity: number
  costOfDebt: number
  taxRate: number
  capexRows: CapexRow[]
  ramp: number[]
  language?: 'fa'|'en'
  projectPeriods?: ProjectCalendarPeriod[]
  periodFrequency?: ProjectPeriodFrequency
  fiscalYearStartMonth?: number | null
  dayCountBasis?: 360 | 365 | null
  cashFlowTiming?: 'unspecified'|'period-end'|'mid-period'
  valuationDate?: string
  discountConvention?: ProjectDiscountConvention
}
type SavedState = {
  loans: Loan[]
  assets: Asset[]
  equityContributions: number[]
  equityWorkingCapitalContributions: number[]
  workingCapitalDays: { raw: number; energy:number; spareParts:number; wip: number; finished: number; receivable: number; cash: number; payable: number }
  workingCapitalBases: { rawMaterials: number; energy:number; spareParts:number; conversion: number; finishedGoods: number; cash: number; payables: number }
  wipCompletion: { material: number; conversion: number }
  taxRates: number[]
  discountMode: 'wacc' | 'manual'
  manualRate: number
  maintenancePercent: number
  salesEscalationPercent: number
  opexEscalationPercent: number
  periodTaxRates?: number[]
  periodTaxRateDates?: string[]
  taxBrackets?: PeriodTaxBracket[]
  taxHolidayYears?: number
  fundingStructureVersion?: number
  minimumDscr?: number
}
const money = (v: number) => Number.isFinite(v) ? v.toLocaleString(typeof document!=='undefined'&&document.documentElement.lang==='en'?'en-US':'fa-IR',{maximumFractionDigits:1}) : '—'
const directoryRepaymentMethod: Record<string, Loan['repaymentMethod']> = {
  'financing.equal-principal': 'equal-principal',
  'financing.annuity': 'annuity',
  'financing.bullet': 'bullet',
}
const loanMethods = listFinancialMethods('financing')
  .filter(definition => directoryRepaymentMethod[definition.id] !== undefined)
  .map(definition => ({ value: directoryRepaymentMethod[definition.id], definition }))
export default function AdvancedFinancePanel(props: Props) {
  const en=props.language==='en'
  const projectPeriods=props.projectPeriods??[]
  const t=(fa:string,english:string)=>en?english:fa
 const labelEn:Record<string,string>={"عنوان تسهیلات":"Loan Name","نرخ سالانه":"Annual Interest Rate","دوره تنفس اصل (سال)":"Principal Grace Period (Years)","مدت بازپرداخت (سال)":"Repayment Term (Years)","شروع بازپرداخت اصل (سال مدل)":"Principal Repayment Start (Model Year)","روش اقساط":"Repayment Method","سرمایه‌ای شدن بهره تا شروع بازپرداخت":"Capitalise interest until repayment starts","برداشت سالانه (واحد پول پایه)":"Annual Drawdown (Base Currency)","برنامه بازپرداخت همین تسهیلات":"Repayment Schedule for This Loan","حذف تسهیلات":"Remove Loan","افزودن وام":"Add Loan","آورده نقدی سهامدار به تفکیک سال":"Annual Shareholder Equity Contributions","روز موجودی مواد اولیه":"Raw Material Inventory Days","روز موجودی/پوشش هزینه انرژی":"Energy Inventory / Coverage Days","روز موجودی قطعات یدکی":"Spare Parts Inventory Days","مبنای سالانه هزینه انرژی":"Annual Energy Cost Basis","مبنای سالانه قطعات یدکی":"Annual Spare Parts Cost Basis","روز کالای در جریان ساخت":"Work-in-Progress Days","روز محصول نهایی":"Finished Goods Days","روز وصول مطالبات":"Receivable Days","روز حداقل نقد عملیاتی":"Minimum Operating Cash Days","روز پرداخت بدهی تجاری":"Trade Payables Days","مبنای سالانه مواد اولیه":"Annual Raw Material Cost Basis","مبنای سالانه هزینه تبدیل":"Annual Conversion Cost Basis","بهای سالانه محصول ساخته‌شده":"Annual Cost of Finished Goods","هزینه نقدی سالانه برای حداقل نقد":"Annual Cash Cost for Minimum Cash","مبنای سالانه بدهی تجاری":"Annual Trade Payables Cost Basis","تکمیل مواد در جریان ساخت (%)":"WIP Material Completion (%)","تکمیل تبدیل در جریان ساخت (%)":"WIP Conversion Completion (%)","دارایی":"Asset","بهای تمام‌شده":"Asset Cost","ارزش اسقاط":"Residual Value","عمر مفید (سال)":"Useful Life (Years)","شروع استهلاک (سال مدل)":"Depreciation Start (Model Year)","روش":"Method","خط مستقیم":"Straight Line","مانده نزولی":"Declining Balance","نرخ نزولی (%)":"Declining-Balance Rate (%)","نرخ تنزیل":"Discount Rate","نرخ تنزیل دستی (%)":"Manual Discount Rate (%)","CAPEX نگهداری سالانه (% هزینه نقدی)":"Annual Maintenance CAPEX (% of Cash Cost)","سال":"Year","بهره":"Interest","اصل":"Principal","مانده بدهی":"Debt Balance","فروش":"Revenue","زیان انتقالی پایان سال":"Closing Tax Loss Carryforward","سود خالص":"Net Income","جریان نقد پایان سال":"Closing Cash","جمع دارایی‌ها":"Total Assets","بدهی + حقوق مالکانه":"Liabilities + Equity","اختلاف تراز":"Balance Difference","تسهیلات اصلی":"Primary Loan","تسهیلات جدید":"New Loan","دارایی جدید":"New Asset","زمین":"Land","اصل مساوی":"Equal Principal","اقساط مساوی":"Equal Instalments","یکجا در سررسید":"Bullet at Maturity","ساخت":"Construction","بهره‌برداری":"Operation","افزودن دارایی":"Add Asset","حذف دارایی":"Remove Asset","دارایی‌ها و استهلاک":"Assets & Depreciation","برنامه تسهیلات و بدهی":"Loans & Debt Schedule","سرمایه در گردش عملیاتی":"Operating Working Capital","مفروضات مالیاتی سالانه":"Annual Tax Assumptions","تحلیل حساسیت":"Sensitivity Analysis","سناریوهای مالی":"Financial Scenarios","صورت‌های مالی سه‌گانه":"Three Financial Statements","برنامه سالانه جریان نقدی":"Annual Cash Flow Schedule","جریان نقدی در دسترس برای خدمت بدهی":"Cash Flow Available for Debt Service","نسبت پوشش خدمت بدهی":"Debt Service Coverage Ratio","روش استهلاک":"Depreciation Method","موجودی مواد اولیه":"Raw Material Inventory","کالای در جریان ساخت":"Work in Progress","محصول نهایی":"Finished Goods","مطالبات":"Receivables","نقد عملیاتی":"Operating Cash","بدهی تجاری":"Trade Payables","جمع بدهی‌ها و حقوق مالکانه":"Total Liabilities & Equity","درآمد":"Revenue","سود عملیاتی":"Operating Profit","مالیات":"Tax","مانده نقد":"Cash Balance","موجودی نقد":"Cash Balance","بهره نقدی":"Cash Interest","بهره سرمایه‌ای":"Capitalised Interest","اصل بدهی":"Principal","مانده پایان":"Closing Balance","مانده اول":"Opening Balance","برداشت":"Drawdown","سرمایه‌گذاری مجدد":"Reinvestment","سال مدل":"Model Year","هزینه سرمایه‌گذاری ثابت":"Fixed Investment Cost","هزینه نقدی عملیاتی":"Cash Operating Cost","درصد":"Percent","روز":"Days","آورده سال ساخت":"Construction-Year Equity","آورده سرمایه در گردش سال بهره‌برداری":"Operating-Year Shareholder Working-Capital Contribution","آورده سهامدار را جدا از برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.":"Enter shareholder equity separately from loan drawdowns. Any funding gap is flagged in the results.","مبنای روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را از چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.":"The day-count basis is 360 days. Enter inventory, collection and payment days from the actual operating cycle. A zero value means no working capital is assigned to that item.","اوج نیاز سرمایه در گردش":"Peak Working Capital Requirement","کسری منابع":"Funding Gap","مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.":"Working-capital cost bases are intentionally not auto-allocated from total OPEX. Enter actual raw-material, conversion, finished-goods, cash and credit-purchase bases to avoid arbitrary assumptions.","اوج نیاز سرمایه در گردش: ":"Peak Working Capital Requirement: ","همگام‌سازی دارایی‌ها از CAPEX":"Sync Assets from CAPEX","جمع استهلاک سالانه (به ترتیب سال مدل)":"Total Annual Depreciation (by Model Year)","دستی":"Manual","نرخ مالیات سال":"Tax Rate — Year","NPV پروژه":"Project NPV","IRR پروژه":"Project IRR","NPV سهامدار":"Equity NPV","IRR سهامدار":"Equity IRR","اوج سرمایه در گردش":"Peak Working Capital","کل برداشت وام":"Total Loan Drawdown","کل آورده":"Total Equity Contribution","جدول سالانه خدمت بدهی":"Annual Debt Service Schedule","CFADS":"CFADS","ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت فروش را نشان می‌دهند. مقادیر NPV پروژه با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.":"Rows represent volume/capacity changes and columns represent selling-price changes. Project NPV is recalculated using the same loan, tax and working-capital schedules.","حجم \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ قیمت":"Volume \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ Price","بدبینانه":"Downside","مبنا":"Base Case","خوش‌بینانه":"Upside","ترازهای منطبق: ":"Balanced Statements: ","از":"of","دوره":"Period","صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.":"The statements are built from one cash-flow set and the asset/debt schedules; no artificial balancing plug is added to equity. Any balance difference is flagged for review of CAPEX, equity, debt or working-capital classification. This version does not yet cover detailed accounting items such as VAT, dividends, tax receivables/payables, revaluation or multi-currency postings.","دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.":"Sync assets from CAPEX. Land is not depreciated by default. Depreciation method (straight-line or declining-balance), useful life, residual value and start year are set independently for each asset. Tax-loss carry-forward is applied by the calculation engine.","جدول دوره‌ای سرمایه در گردش":"Periodic Working Capital Schedule","سرمایه در گردش خالص":"Net Working Capital","چرخه تبدیل وجه نقد":"Cash Conversion Cycle","سال اول":"Year 1","سال آخر":"Final Year","سناریوهای خوش‌بینانه و بدبینانه":"Upside & Downside Scenarios","سناریوی پایه":"Base Case","سناریوی بدبینانه":"Downside Case","سناریوی خوش‌بینانه":"Upside Case","سه صورت مالی":"Three Financial Statements","ترازنامه":"Balance Sheet","صورت سود و زیان":"Income Statement","صورت جریان وجوه نقد":"Cash Flow Statement","ترازهای منطبق":"Balanced Periods","مالیات و انتقال زیان":"Tax & Loss Carryforward","زیان انتقالی":"Tax Loss Carryforward","جمع دارایی‌های ثابت":"Total Fixed Assets","سرمایه‌گذاری در دارایی":"Asset Investment","سرمایه در گردش اوج":"Peak Working Capital","سال اوج نیاز":"Peak Requirement Year","برداشت سالانه":"Annual Drawdown","آورده نقدی سهامدار":"Shareholder Cash Contribution","واحد پول پایه":"Base Currency","هزینه‌های سرمایه‌ای":"Capital Expenditure","هزینه‌های عملیاتی":"Operating Expenditure","هزینه خدمت بدهی":"Debt Service Cost","عمر مفید":"Useful Life","سرمایه در گردش":"Working Capital","مواد اولیه":"Raw Materials","هزینه تبدیل":"Conversion Cost","محصول ساخته‌شده":"Finished Goods","حداقل نقد عملیاتی":"Minimum Operating Cash","نرخ مالیات":"Tax Rate","مواد":"Materials","محصول":"Finished Goods","پرداختنی":"Payables","نیاز":"Requirement","تکمیل اولیه":"Initially Complete","نیازمند تکمیل":"Completion Required","نامعتبر":"Invalid","کسری نقدینگی":"Funding Shortfall","جمع‌بندی سه صورت مالی":"Three-Statement Reconciliation"}
  const tr=(v:string, english?:string)=>en?(english??labelEn[v]??v):v
  const loanMethodEn:Record<string,string>={'equal-principal':'Equal Principal','annuity':'Equal Instalments','bullet':'Bullet at Maturity'}
  const years = Math.max(1, Math.min(60, Math.ceil(props.constructionYears) + Math.ceil(props.operatingYears)))
  const periodsPerYear: 1|2|4|12 = props.periodFrequency==='monthly'?12:props.periodFrequency==='quarterly'?4:props.periodFrequency==='semiannual'?2:1
  const construction = Math.max(1, Math.ceil(props.constructionYears))
  const opYears = Math.max(1, years - construction)
  const storageKey = 'feasibility:advanced-finance:' + props.projectId + (props.referenceVersion ? ':' + props.referenceVersion : '')
  const fallbackFixedInvestmentSchedule = Array.from({length:years},(_,i)=>i<construction?props.fixedInvestment/construction:0)
  const fallbackPreOperatingSchedule = Array.from({length:years},(_,i)=>i<construction?props.preOperatingCost/construction:0)
  const activeFixedInvestmentSchedule = props.fixedInvestmentSchedule?.length===years ? props.fixedInvestmentSchedule : fallbackFixedInvestmentSchedule
  const activePreOperatingSchedule = props.preOperatingSchedule?.length===years ? props.preOperatingSchedule : fallbackPreOperatingSchedule
  const initialCapexSchedule = activeFixedInvestmentSchedule.map((amount,i)=>amount+activePreOperatingSchedule[i])
  const initialDebtShare = Math.max(0,100-Math.max(0,Math.min(100,props.equityPercent)))/100
  const [state,setState] = useState<SavedState>(() => ({
    loans:[{id:'loan-1',label:'تسهیلات بلندمدت سرمایه ثابت',drawdowns:initialCapexSchedule.map(v=>v*initialDebtShare),drawdownMode:'annual-day-weighted',annualRate:props.initialLoanRatePercent??props.costOfDebt,graceYears:0,termYears:Math.max(1,Math.min(opYears,props.loanTermYears??opYears)),repaymentStartYear:construction+1,repaymentMethod:props.initialRepaymentMethod??'equal-principal',capitalizeInterest:true}],
    assets:props.depreciationAssets??props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20})), equityContributions:initialCapexSchedule.map(v=>v*Math.max(0,Math.min(100,props.equityPercent))/100), equityWorkingCapitalContributions:Array.from({length:years},(_,i)=>i===construction?Math.max(0,props.initialWorkingCapitalEquityContribution??0):0),fundingStructureVersion:2,
    workingCapitalDays:props.workingCapitalDefaults?.days??{raw:0,energy:0,spareParts:0,wip:0,finished:0,receivable:0,cash:0,payable:0},
    workingCapitalBases:props.workingCapitalDefaults?.bases??{rawMaterials:0,energy:0,spareParts:0,conversion:0,finishedGoods:0,cash:0,payables:0},
    wipCompletion:props.workingCapitalDefaults?.wipCompletion??{material:0,conversion:0},taxRates:Array(years).fill(props.taxRate),taxHolidayYears:0,
    discountMode:props.initialDiscountMode??'wacc',manualRate:props.initialManualRate??props.costOfEquity,maintenancePercent:0,salesEscalationPercent:0,opexEscalationPercent:0
  }))
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{let alive=true;localStore.get<SavedState>(storageKey).then(saved=>{if(alive){if(saved){const restored={...state,...saved};if(!saved.equityWorkingCapitalContributions){const legacyWorkingCapitalEquity=Math.max(0,props.initialWorkingCapital??0)*Math.max(0,Math.min(100,props.equityPercent))/100;const legacyContribution=restored.equityContributions[construction]??0;const matchesLegacyDefault=Math.abs(legacyContribution-legacyWorkingCapitalEquity)<0.01;restored.equityWorkingCapitalContributions=Array(years).fill(0);if(matchesLegacyDefault){restored.equityContributions=restored.equityContributions.map((value,index)=>index===construction?Math.max(0,value-legacyWorkingCapitalEquity):value);restored.equityWorkingCapitalContributions=Array.from({length:years},(_,index)=>index===construction?Math.max(0,props.initialWorkingCapitalEquityContribution??legacyWorkingCapitalEquity):0)}}if((saved.fundingStructureVersion??0)<2){const legacyDrawdowns=initialCapexSchedule.map((value,index)=>value*initialDebtShare+(index===construction?Math.max(0,props.initialWorkingCapital??0)*initialDebtShare:0));restored.loans=restored.loans.map(loan=>{const untouchedLegacyDefault=loan.label==='تسهیلات اصلی و سرمایه در گردش'&&loan.drawdowns.length===years&&loan.drawdowns.every((value,index)=>Math.abs(value-legacyDrawdowns[index])<0.01)&&Math.abs(loan.annualRate-props.costOfDebt)<0.0001&&loan.repaymentMethod==='equal-principal';return untouchedLegacyDefault?{...loan,label:'تسهیلات بلندمدت سرمایه ثابت',drawdowns:initialCapexSchedule.map(value=>value*initialDebtShare),annualRate:props.initialLoanRatePercent??props.costOfDebt,repaymentMethod:props.initialRepaymentMethod??'equal-principal'}:loan});if(props.initialWorkingCapitalEquityContribution&&restored.equityWorkingCapitalContributions.every(value=>value===0)){restored.equityWorkingCapitalContributions=Array.from({length:years},(_,index)=>index===construction?props.initialWorkingCapitalEquityContribution!:0)}restored.fundingStructureVersion=2}setState(restored)}setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{alive=false}},[storageKey])
  useEffect(()=>{if(loaded)void localStore.set(storageKey,state)},[loaded,storageKey,state])

  const capexSchedule = activeFixedInvestmentSchedule
  const updateLoan=(id:string,patch:Partial<Loan>)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,...patch}:l)}))
  const updateDraw=(id:string,index:number,value:number)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,drawdowns:l.drawdowns.map((v,i)=>i===index?Math.max(0,value):v),drawdownMode:'annual-day-weighted',periodDrawdowns:undefined}:l)}))
  const updatePeriodDraw=(id:string,index:number,value:number)=>setState(s=>({...s,loans:s.loans.map(l=>{
    if(l.id!==id)return l
    const periods=props.projectPeriods??[]
    const datesMatch=l.periodDrawdowns?.length===periods.length&&l.periodDrawdownDates?.length===periods.length&&l.periodDrawdownDates.every((date,i)=>date===periods[i].startDate+'|'+periods[i].endDate)
    return {...l,periodDrawdowns:Array.from({length:periods.length},(_,i)=>i===index?Math.max(0,value):Math.max(0,l.periodDrawdowns?.[i]??0)),exactDrawdownDates:periods.map((period,i)=>datesMatch?(l.exactDrawdownDates?.[i]??period.startDate):period.startDate),periodDrawdownDates:periods.map(period=>period.startDate+'|'+period.endDate)}
  })}))
  const updatePeriodDrawDate=(id:string,index:number,date:string)=>setState(s=>({...s,loans:s.loans.map(l=>{
    if(l.id!==id)return l
    const periods=props.projectPeriods??[]
    const datesMatch=l.periodDrawdowns?.length===periods.length&&l.periodDrawdownDates?.length===periods.length&&l.periodDrawdownDates.every((value,i)=>value===periods[i].startDate+'|'+periods[i].endDate)
    return {...l,exactDrawdownDates:periods.map((period,i)=>i===index?date:(datesMatch?(l.exactDrawdownDates?.[i]??period.startDate):period.startDate))}
  })}))
  const periodTaxRateDatesMatch=()=>{const periods=props.projectPeriods??[];return state.periodTaxRates?.length===periods.length&&state.periodTaxRateDates?.length===periods.length&&state.periodTaxRateDates.every((date,index)=>date===periods[index].startDate+'|'+periods[index].endDate)}
  const periodDrawdownDatesMatch=(loan:Loan)=>{const periods=props.projectPeriods??[];return loan.periodDrawdowns?.length===periods.length&&loan.periodDrawdownDates?.length===periods.length&&loan.periodDrawdownDates.every((date,index)=>date===periods[index].startDate+'|'+periods[index].endDate)}
  const updateTaxBracket=(index:number,patch:Partial<PeriodTaxBracket>)=>setState(s=>({...s,taxBrackets:(s.taxBrackets??[]).map((row,i)=>i===index?{...row,...patch}:row)}))
  const addTaxBracket=()=>setState(s=>({...s,taxBrackets:[...(s.taxBrackets??[]),{lowerLimit:(s.taxBrackets??[]).length?((s.taxBrackets??[]).at(-1)?.upperLimit??0):0,upperLimit:null,ratePercent:0}]}))
  const removeTaxBracket=(index:number)=>setState(s=>({...s,taxBrackets:(s.taxBrackets??[]).filter((_,i)=>i!==index)}))
  const updatePeriodTaxRate=(index:number,value:number)=>setState(s=>{
    const periods=props.projectPeriods??[]
    const matches=s.periodTaxRates?.length===periods.length&&s.periodTaxRateDates?.length===periods.length&&s.periodTaxRateDates.every((date,i)=>date===periods[i].startDate+'|'+periods[i].endDate)
    const base=matches?s.periodTaxRates!:periods.map(period=>{
      const fiscalIndex=props.fiscalYearStartMonth==null?0:fiscalYearIndexForPeriod(period,periods,props.fiscalYearStartMonth)
      return s.taxRates[fiscalIndex]??props.taxRate
    })
    return {...s,periodTaxRates:base.map((rate,i)=>i===index?Math.max(0,Math.min(100,value)):rate),periodTaxRateDates:periods.map(period=>period.startDate+'|'+period.endDate)}
  })
  const defaultPeriodRepaymentStart=(loan:Loan)=>{
    const periods=props.projectPeriods??[]
    if(!periods.length||props.fiscalYearStartMonth==null) return 1
    const target=Math.max(0,loan.repaymentStartYear-1)
    const index=periods.findIndex(period=>fiscalYearIndexForPeriod(period,periods,props.fiscalYearStartMonth!)>=target)
    return index>=0?index+1:periods.length+1
  }
  const periodicRateMethod=listFinancialMethods('financing').find(method=>method.id==='financing.effective-annual-frequency-rate')
  const syncAssets=()=>setState(s=>({...s,assets:props.depreciationAssets??props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20}))}))
  const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),label:'تسهیلات جدید',drawdowns:Array(years).fill(0),drawdownMode:'annual-day-weighted',annualRate:20,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}]}))
  const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی جدید',cost:0,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line',decliningRate:20}]}))

  const depreciation = useMemo(()=>calculateAssetDepreciationSchedule(state.assets.filter(a=>a.cost>0&&!a.name.includes('زمین')),years),[state.assets,years])
  const comfarCalendarLifecycle = useMemo(()=>props.comfarDepreciationAssets?.length && projectPeriods.length && props.fiscalYearStartMonth!=null
    ? calculateComfarCalendarAssetLifecycle(props.comfarDepreciationAssets,props.comfarAssetSales??[],projectPeriods,props.fiscalYearStartMonth)
    : null,[JSON.stringify(props.comfarDepreciationAssets??[]),JSON.stringify(props.comfarAssetSales??[]),JSON.stringify(projectPeriods),props.fiscalYearStartMonth])
  const comfarLifecycle = comfarCalendarLifecycle ?? (props.comfarDepreciationAssets?.length
    ? calculateComfarAssetLifecycle(props.comfarDepreciationAssets,props.comfarAssetSales??[],years)
    : null)
  const periodDepreciationSchedule = comfarCalendarLifecycle
    ? comfarCalendarLifecycle.depreciation.periods.map(row=>row.depreciation)
    : undefined
  const periodAssetSaleSchedule = comfarCalendarLifecycle
    ? projectPeriods.map((period,index)=>{
        const rows=comfarCalendarLifecycle.sales.filter(sale=>sale.period===index+1)
        return {
          saleProceeds:rows.reduce((sum,row)=>sum+row.saleProceeds,0),
          returnOfCapital:rows.reduce((sum,row)=>sum+row.returnOfCapital,0),
          otherIncomeLoss:rows.reduce((sum,row)=>sum+row.otherIncomeLoss,0),
          bookValueDisposed:rows.reduce((sum,row)=>sum+row.bookValueAtSale,0),
        }
      })
    : undefined
  const depreciationValues = comfarCalendarLifecycle
    ? Array.from({length:years},(_,year)=>comfarCalendarLifecycle.depreciation.periods.reduce((sum,row,index)=>
        fiscalYearIndexForPeriod(projectPeriods[index],projectPeriods,props.fiscalYearStartMonth!)===year?sum+row.depreciation:sum,0))
    : comfarLifecycle
      ? comfarLifecycle.depreciation.periods.map(row=>row.depreciation)
      : props.useFixedInvestmentRegister ? Array(years).fill(0) : depreciation.map(row=>row.depreciation)
  const assetSaleSchedule = comfarCalendarLifecycle
    ? Array.from({length:years},(_,year)=>{
        const rows=comfarCalendarLifecycle.sales.filter(sale=>
          fiscalYearIndexForPeriod(projectPeriods[sale.period-1],projectPeriods,props.fiscalYearStartMonth!)===year)
        return {
          saleProceeds:rows.reduce((sum,row)=>sum+row.saleProceeds,0),
          returnOfCapital:rows.reduce((sum,row)=>sum+row.returnOfCapital,0),
          otherIncomeLoss:rows.reduce((sum,row)=>sum+row.otherIncomeLoss,0),
          bookValueDisposed:rows.reduce((sum,row)=>sum+row.bookValueAtSale,0),
        }
      })
    : comfarLifecycle
      ? Array.from({length:years},(_,index)=>{
          const rows=comfarLifecycle.sales.filter(sale=>sale.period===index+1)
          return {
            saleProceeds:rows.reduce((sum,row)=>sum+row.saleProceeds,0),
            returnOfCapital:rows.reduce((sum,row)=>sum+row.returnOfCapital,0),
            otherIncomeLoss:rows.reduce((sum,row)=>sum+row.otherIncomeLoss,0),
            bookValueDisposed:rows.reduce((sum,row)=>sum+row.bookValueAtSale,0),
          }
        })
      : undefined
  const utilization = Array.from({length:years},(_,i)=>i<construction?0:Math.max(0,Math.min(100,props.ramp[i-construction]??100))/100)
  const fixedInvestmentSchedule = capexSchedule
  const workingCapitalPolicy = useMemo(()=>({
    dayBasis:(props.dayCountBasis??360) as 360|365,rawMaterialDays:state.workingCapitalDays.raw,energyDays:state.workingCapitalDays.energy,sparePartsDays:state.workingCapitalDays.spareParts,workInProgressDays:state.workingCapitalDays.wip,
    workInProgressMaterialCompletionPercent:state.wipCompletion.material,workInProgressConversionCompletionPercent:state.wipCompletion.conversion,
    finishedGoodsDays:state.workingCapitalDays.finished,receivableDays:state.workingCapitalDays.receivable,
    cashDays:state.workingCapitalDays.cash,payableDays:state.workingCapitalDays.payable,
    annualRawMaterialCost:state.workingCapitalBases.rawMaterials,annualEnergyCost:state.workingCapitalBases.energy,annualSparePartsCost:state.workingCapitalBases.spareParts,
    annualPayablesCost:state.workingCapitalBases.payables,
    annualConversionCost:state.workingCapitalBases.conversion,
    annualFinishedGoodsCost:state.workingCapitalBases.finishedGoods,
    annualRevenue:props.fullCapacityRevenue,annualCashOperatingCost:state.workingCapitalBases.cash
  }),[state.workingCapitalDays,state.workingCapitalBases,state.wipCompletion,props.fullCapacityRevenue,props.dayCountBasis])
  const equityContributions = state.equityContributions.length===years ? state.equityContributions : Array(years).fill(0)
  const equityWorkingCapitalContributions = Array.isArray(state.equityWorkingCapitalContributions)&&state.equityWorkingCapitalContributions.length===years ? state.equityWorkingCapitalContributions : Array(years).fill(0)
  const taxRates = state.taxRates?.length===years ? state.taxRates : Array(years).fill(props.taxRate)
  const maintenanceCapexSchedule = utilization.map(u=>(props.fullCapacityFixedCashCost+props.fullCapacityVariableCashCost)*u*state.maintenancePercent/100)
  const input: IntegratedFinanceInput = {
    years,constructionYears:construction,capacity:props.capacity,fullCapacityRevenue:props.fullCapacityRevenue,
    fullCapacityVariableCashCost:props.fullCapacityVariableCashCost,fullCapacityFixedCashCost:props.fullCapacityFixedCashCost,
    annualDepreciation:0,depreciationSchedule:depreciationValues,assetSaleSchedule,
    maintenanceCapexSchedule,fixedInvestment:props.fixedInvestment,preOperatingCost:props.preOperatingCost,
    fixedInvestmentSchedule,preOperatingSchedule:activePreOperatingSchedule,utilization,equityContributions,
    loans:state.loans.map(l=>({...l,drawdowns:Array.from({length:years},(_,i)=>Math.max(0,l.drawdowns[i]??0))})),
    taxRate:props.taxRate,taxRateSchedule:taxRates,waccTaxRate:props.taxRate,costOfEquity:props.costOfEquity,
    workingCapitalPercent:0,workingCapitalPolicy,salesEscalationPercent:state.salesEscalationPercent,opexEscalationPercent:state.opexEscalationPercent,
    discountMode:state.discountMode,manualDiscountRate:state.manualRate,mirrFinanceRate:props.mirrFinanceRate,mirrReinvestmentRate:props.mirrReinvestmentRate,equityMirrFinanceRate:props.mirrFinanceRate??props.costOfEquity,equityMirrReinvestmentRate:props.mirrReinvestmentRate??props.costOfEquity
  }
  const result=useMemo(()=>calculateIntegratedFinance(input),[JSON.stringify(input)])
  const periodicFinanceResult=useMemo<PeriodicProjectFinanceResult|null>(()=>{
    const periods=props.projectPeriods??[]
    if(!periods.length||props.fiscalYearStartMonth==null||props.dayCountBasis==null||!props.cashFlowTiming||props.cashFlowTiming==='unspecified') return null
    const fiscalMonth=props.fiscalYearStartMonth
    const periodLoans=state.loans.map(loan=>{
      const annualDrawdowns=loan.drawdowns.length===years?loan.drawdowns:Array(years).fill(0)
      const drawdowns=loan.drawdownMode==='period-manual'
        ? (periodDrawdownDatesMatch(loan)?loan.periodDrawdowns!:Array(periods.length).fill(Number.NaN))
        : allocateAnnualFlowsToPeriods(annualDrawdowns,periods,fiscalMonth)
      const firstFiscalIndex=Math.max(0,loan.repaymentStartYear-1)
      const derivedStart=periods.findIndex(period=>fiscalYearIndexForPeriod(period,periods,fiscalMonth)>=firstFiscalIndex)
      return {id:loan.id,input:{
        annualRatePercent:loan.annualRate,drawdowns,repaymentMethod:loan.periodRepaymentMethod??loan.repaymentMethod,
        repaymentStartPeriod:loan.periodRepaymentStart??(derivedStart>=0?derivedStart+1:periods.length+1),
        gracePeriods:loan.periodGracePeriods??loan.graceYears*periodsPerYear,
        termPeriods:loan.periodTerm??loan.termYears*periodsPerYear,
        capitalizeInterest:loan.capitalizeInterest,
        rateConversion:loan.periodRateConversion??'effective-annual-by-actual-days',periodsPerYear,
        datedDrawdowns:loan.drawdownMode==='period-manual'?periods.map((period,index)=>({date:loan.exactDrawdownDates?.[index]??period.startDate,amount:Math.max(0,drawdowns[index]??0)})).filter(item=>item.amount>0):undefined,
        rateChanges:loan.rateChanges??[],
        facilityLimit:loan.facilityLimit,
        commitmentFeeAnnualRatePercent:loan.commitmentFeeAnnualRatePercent,
        customPrincipalRepayments:(loan.customPrincipalRepayments??[]).filter(item=>item.amount>0),
        balloonAtMaturity:loan.balloonAtMaturity,
        fees:(loan.financingFees??[]).filter(fee=>fee.amount>0).map(({date,amount,treatment,label})=>({date,amount,treatment,label})),
        interestConvention:loan.periodInterestConvention??(loan.drawdownMode==='period-manual'?'comfar-months-plus-360':undefined)
      } as PeriodicLoanInput}
    })
    const workingCapitalByPeriod=periods.map(period=>{
      const fiscalIndex=fiscalYearIndexForPeriod(period,periods,fiscalMonth)
      const annualRow=result.years[fiscalIndex]
      if(!annualRow) return 0
      const operatingYear=Math.max(0,fiscalIndex-construction)
      const salesFactor=Math.pow(1+state.salesEscalationPercent/100,operatingYear)
      const opexFactor=Math.pow(1+state.opexEscalationPercent/100,operatingYear)
      return calculateOperatingCycleWorkingCapital(workingCapitalPolicy,annualRow.utilization,salesFactor,opexFactor).netWorkingCapital
    })
    return calculateIntegratedPeriodicFinance({
      periods,fiscalYearStartMonth:fiscalMonth,dayCountBasis:props.dayCountBasis,cashFlowTiming:props.cashFlowTiming,
      minimumDscr:state.minimumDscr,
      annualRevenue:result.years.map(row=>row.revenue),annualVariableCost:result.years.map(row=>row.variableCashCost),
      annualFixedCost:result.years.map(row=>row.fixedCashCost),annualDepreciation:depreciationValues,
      annualFixedInvestment:fixedInvestmentSchedule,annualPreOperatingCost:activePreOperatingSchedule,
      annualMaintenanceCapex:maintenanceCapexSchedule,annualTaxRates:taxRates,annualEquityContributions:equityContributions,
      annualEquityWorkingCapitalContributions:equityWorkingCapitalContributions,
      annualAssetSaleSchedule:assetSaleSchedule,
      periodDepreciationSchedule,periodAssetSaleSchedule,
      workingCapitalByPeriod,openingWorkingCapital:0,loans:periodLoans,
      taxRatesByPeriod:periodTaxRateDatesMatch()?state.periodTaxRates:undefined,
      taxBrackets:state.taxBrackets?.length?state.taxBrackets:undefined,
      taxHolidayYears:state.taxHolidayYears??0,productionStartFiscalYear:construction,
      discountRatePercent:result.discountRate==null?null:result.discountRate*100,
      equityDiscountRatePercent:props.costOfEquity,
      valuationDate:props.valuationDate||undefined,
      discountConvention:props.discountConvention??'actual-days',
      discountPeriodsPerYear:periodsPerYear,
      mirrFinanceRatePercent:props.mirrFinanceRate??null,mirrReinvestmentRatePercent:props.mirrReinvestmentRate??null
    })
  },[JSON.stringify(input),JSON.stringify(props.projectPeriods??[]),props.fiscalYearStartMonth,props.dayCountBasis,props.cashFlowTiming,props.periodFrequency,props.valuationDate,props.discountConvention,JSON.stringify(state.loans),JSON.stringify(state.periodTaxRates),JSON.stringify(state.periodTaxRateDates),JSON.stringify(state.taxBrackets??[]),state.taxHolidayYears??0,JSON.stringify(workingCapitalPolicy),JSON.stringify(equityContributions),JSON.stringify(equityWorkingCapitalContributions),JSON.stringify(taxRates),JSON.stringify(maintenanceCapexSchedule),JSON.stringify(fixedInvestmentSchedule),JSON.stringify(activePreOperatingSchedule),JSON.stringify(assetSaleSchedule),JSON.stringify(periodDepreciationSchedule),JSON.stringify(periodAssetSaleSchedule)])
  const partnerFinanceResult=useMemo(()=>props.jointVenture&&periodicFinanceResult?.valid
    ?allocateJointVentureCashFlows(periodicFinanceResult,props.partners??[],props.partnerDistributionPercent??100)
    :null,[props.jointVenture,props.partnerDistributionPercent,JSON.stringify(props.partners??[]),periodicFinanceResult])
  useEffect(()=>{props.onPeriodicResult?.(periodicFinanceResult)},[periodicFinanceResult,props.onPeriodicResult])
  useEffect(()=>{props.onPartnerFinanceResult?.(partnerFinanceResult)},[partnerFinanceResult,props.onPartnerFinanceResult])
  useEffect(()=>{props.onResult?.(result)},[result,props.onResult])
  const oneWaySensitivity=useMemo(()=>calculateOneWaySensitivity(input,20),[JSON.stringify(input)])
  useEffect(()=>{props.onSensitivity?.(oneWaySensitivity)},[oneWaySensitivity,props.onSensitivity])
  const statements=useMemo(()=>buildThreeFinancialStatements(result.years),[result.years])
  const periodicStatements=useMemo(()=>periodicFinanceResult?.valid?buildPeriodicThreeFinancialStatements(periodicFinanceResult):[],[periodicFinanceResult])
  const sensitivity=useMemo(()=>calculateSensitivityMatrix(input,[-20,-10,0,10,20],[-20,-10,0,10,20]),[JSON.stringify(input)])
  const scenarios=useMemo(()=>calculateFinancialScenarios(input),[JSON.stringify(input)])
  useEffect(()=>{props.onScenarioAnalysis?.(sensitivity,scenarios)},[sensitivity,scenarios,props.onScenarioAnalysis])
  const updateAsset=(id:string,patch:Partial<Asset>)=>setState(s=>({...s,assets:s.assets.map(a=>a.id===id?{...a,...patch}:a)}))
  const updateDay=(key:keyof SavedState['workingCapitalDays'],value:number)=>setState(s=>({...s,workingCapitalDays:{...s.workingCapitalDays,[key]:Math.max(0,value)}}))
  const setEquity=(index:number,value:number)=>setState(s=>({...s,equityContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityContributions[i]??0))}))
  const setWorkingCapitalEquity=(index:number,value:number)=>setState(s=>({...s,equityWorkingCapitalContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityWorkingCapitalContributions[i]??0))}))
  const totalBalanceChecks=statements.filter(r=>r.balanceSheet.reconciled).length
  const totalMovementChecks=statements.filter(r=>Object.values(r.movementChecks).every(value=>Math.abs(value)<=0.01)).length

  return <div className="fw-card" style={{marginTop:18}}>
    <h3>{t('موتور مالی یکپارچه و کنترل‌های مالی','Integrated Financial Engine & Financial Controls')}</h3>
    {props.fixedInvestmentSchedule?.length===years && props.preOperatingSchedule?.length===years
      ? <p className="fw-hint">{t('زمان‌بندی CAPEX دارایی‌های ثابت و هزینه‌های قبل از بهره‌برداری از نوبت‌های تحصیل مستند یا تأییدشده استخراج شده است.','Fixed-asset CAPEX and pre-production timing both use source-supported or user-confirmed acquisition vintages.')}</p>
      : props.fixedInvestmentSchedule?.length===years
        ? <p className="fw-hint">{t('زمان‌بندی دارایی‌های ثابت از دفتر تأیید شده است؛ هزینه‌های قبل از بهره‌برداری هنوز به‌طور موقت بین سال‌های ساخت تقسیم می‌شوند.','Fixed-asset CAPEX timing is verified; pre-production expenditures are still temporarily spread across construction years.')}</p>
        : props.preOperatingSchedule?.length===years
          ? <p className="fw-hint">{t('زمان‌بندی هزینه‌های قبل از بهره‌برداری تأیید شده است؛ CAPEX دارایی‌های ثابت هنوز به‌طور موقت بین سال‌های ساخت تقسیم می‌شود.','Pre-production timing is verified; fixed-asset CAPEX is still temporarily spread across construction years.')}</p>
          : <p className="fw-hint">{t('زمان‌بندی دفتر دارایی هنوز تأیید نشده است؛ CAPEX و هزینه‌های قبل از بهره‌برداری به‌طور موقت بین سال‌های ساخت تقسیم می‌شوند. این تخصیص تا تأیید تاریخ تحصیل اقلام، مبنای نهایی جریان نقدی نیست.','Asset acquisition timing is not yet verified; aggregate CAPEX and pre-production expenditures are temporarily spread across construction years. This is not a final cash-flow basis until acquisition dates are confirmed.')}</p>}

    {!props.useFixedInvestmentRegister&&props.depreciationAssets?.length ? <p className="fw-hint">{t('دفتر دارایی هنوز ثبت نشده است؛ برای جلوگیری از صفر شدن استهلاک، فعلاً از مفروضات تجمیعی مرجع پروژه استفاده می‌شود. این حالت فقط مبنای مقایسه اولیه است و تا تکمیل دفتر دارایی و تطبیق برنامه سالانه با خروجی مرجع، نتیجه نهایی تأییدشده نیست.','The Fixed Investment Register is empty. Aggregate project-reference depreciation assumptions are temporarily used to avoid zero depreciation. This is a preliminary comparison basis only; results are not validated until the asset register and annual depreciation schedule are reconciled to the reference output.')}</p> : null}

    <p className="fw-lead">{t('برنامه وام، CFADS، سرمایه در گردش دوره‌ای، مالیات با انتقال زیان، استهلاک دارایی‌به‌دارایی، سناریوها و سه صورت مالی در یک مدل مشترک محاسبه می‌شوند. ارقام این بخش از مفروضات همین پروژه استفاده می‌کنند.','Loan schedules, CFADS, periodic working capital, tax-loss carry-forward, asset-level depreciation, scenarios and three financial statements are calculated in one shared model using this project’s assumptions.')}</p>

    <h4>{t('۱. برنامه برداشت و بازپرداخت وام','1. Loan Drawdown & Repayment Schedule')}</h4>
    {state.loans.map(loan=><div className="fw-card" key={loan.id}>
      <div className="fw-grid">
        <label className="fw-field"><span>{tr('عنوان تسهیلات')}</span><input value={tr(loan.label)} onChange={e=>updateLoan(loan.id,{label:e.target.value})}/></label>
        <label className="fw-field"><span>{tr('نرخ سالانه')}</span><input type="number" value={loan.annualRate} onChange={e=>updateLoan(loan.id,{annualRate:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{tr('دوره تنفس اصل (سال)')}</span><input type="number" min="0" value={loan.graceYears} onChange={e=>updateLoan(loan.id,{graceYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{tr('مدت بازپرداخت (سال)')}</span><input type="number" min="1" value={loan.termYears} onChange={e=>updateLoan(loan.id,{termYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{tr('شروع بازپرداخت اصل (سال مدل)')}</span><input type="number" min="1" value={loan.repaymentStartYear} onChange={e=>updateLoan(loan.id,{repaymentStartYear:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{tr('روش اقساط')}</span><select value={loan.repaymentMethod} onChange={e=>updateLoan(loan.id,{repaymentMethod:e.target.value as Loan['repaymentMethod']})}>{loanMethods.map(m=><option key={m.value} value={m.value}>{en?m.definition.nameEn:m.definition.nameFa}</option>)}</select></label>
      </div>
      {loanMethods.find(method => method.value === loan.repaymentMethod)?.definition && <p className="fw-hint">{t('روش انتخاب‌شده از دایرکتوری روش‌های مالی خوانده می‌شود. فرمول:','Selected method from the financial method directory. Formula:')} {loanMethods.find(method => method.value === loan.repaymentMethod)!.definition.formula} · {t('اعتبار:','Validity:')} {loanMethods.find(method => method.value === loan.repaymentMethod)!.definition.validity} · {t('منبع:','Source:')} {loanMethods.find(method => method.value === loan.repaymentMethod)!.definition.source} · {t('وضعیت تطبیق:','Benchmark status:')} {loanMethods.find(method => method.value === loan.repaymentMethod)!.definition.benchmarkStatus === 'partial' ? t('تطبیق جزئی','Partially benchmarked') : loanMethods.find(method => method.value === loan.repaymentMethod)!.definition.benchmarkStatus === 'verified' ? t('تطبیق‌شده','Benchmarked') : t('تطبیق عددی نشده','Not numerically benchmarked')}</p>}
      <label className="fw-field"><span><input type="checkbox" checked={loan.capitalizeInterest} onChange={e=>updateLoan(loan.id,{capitalizeInterest:e.target.checked})}/> {tr('سرمایه‌ای شدن بهره تا شروع بازپرداخت')}</span></label>
      <b>{t('برداشت سالانه (واحد پول پایه)','Annual Drawdown (Base Currency)')}</b>
      <div className="fw-grid">{Array.from({length:years},(_,i)=><label className="fw-field" key={i}><span>{tr('سال')} {i+1} {i<construction?'· '+t('ساخت','Construction'):'· '+t('بهره‌برداری','Operation')}</span><input type="number" min="0" value={loan.drawdowns[i]??0} onChange={e=>updateDraw(loan.id,i,Number(e.target.value))}/></label>)}</div>
      {props.projectPeriods?.length&&props.fiscalYearStartMonth!=null&&props.dayCountBasis!=null&&props.cashFlowTiming!=='unspecified'&&<div className="fw-card">
        <h4>{t('زمان‌بندی دوره‌ای تسهیلات','Periodic Loan Schedule Settings')}</h4>
        <div className="fw-grid">
          <label className="fw-field"><span>{t('مبنای برداشت در دوره‌ها','Period Drawdown Allocation')}</span><select value={loan.drawdownMode??'annual-day-weighted'} onChange={e=>{const mode=e.target.value as Loan['drawdownMode'];updateLoan(loan.id,mode==='period-manual'?{drawdownMode:mode,periodDrawdowns:allocateAnnualFlowsToPeriods(loan.drawdowns,props.projectPeriods??[],props.fiscalYearStartMonth??1),periodDrawdownDates:(props.projectPeriods??[]).map(period=>period.startDate+'|'+period.endDate)}:{drawdownMode:mode,periodDrawdowns:undefined,periodDrawdownDates:undefined})}}><option value="annual-day-weighted">{t('توزیع روزشمار برداشت سالانه','Allocate annual drawdowns by actual days')}</option><option value="period-manual">{t('ورود مستقیم برداشت هر دوره','Enter each period drawdown')}</option></select></label>
          <label className="fw-field"><span>{t('روش تبدیل نرخ سالانه','Annual-to-Period Rate Convention')}</span><select value={loan.periodRateConversion??'effective-annual-by-actual-days'} onChange={e=>updateLoan(loan.id,{periodRateConversion:e.target.value as Loan['periodRateConversion']})}><option value="effective-annual-by-actual-days">{t('نرخ مؤثر سالانه بر مبنای روزهای واقعی','Effective annual rate by actual days')}</option><option value="effective-annual-divided-by-frequency">{t('نرخ مؤثر سالانه تقسیم بر تعداد دوره‌ها','Effective annual rate divided by frequency')}</option></select></label>
          <label className="fw-field"><span>{t('شروع بازپرداخت اصل (شماره دوره)','Principal Repayment Start (Period)')}</span><input type="number" min="1" max={props.projectPeriods.length} value={loan.periodRepaymentStart??defaultPeriodRepaymentStart(loan)} onChange={e=>updateLoan(loan.id,{periodRepaymentStart:Number(e.target.value)})}/></label>
          <label className="fw-field"><span>{t('دوره تنفس اصل (تعداد دوره)','Principal Grace (Periods)')}</span><input type="number" min="0" value={loan.periodGracePeriods??loan.graceYears*periodsPerYear} onChange={e=>updateLoan(loan.id,{periodGracePeriods:Number(e.target.value)})}/></label>
          <label className="fw-field"><span>{t('مدت بازپرداخت (تعداد دوره)','Repayment Term (Periods)')}</span><input type="number" min="1" value={loan.periodTerm??loan.termYears*periodsPerYear} onChange={e=>updateLoan(loan.id,{periodTerm:Number(e.target.value)})}/></label>
          <label className="fw-field"><span>{t('روش بازپرداخت دوره‌ای','Periodic Repayment Method')}</span><select value={loan.periodRepaymentMethod??loan.repaymentMethod} onChange={e=>updateLoan(loan.id,{periodRepaymentMethod:e.target.value as Loan['periodRepaymentMethod']})}><option value="equal-principal">{t('اصل مساوی','Equal Principal')}</option><option value="annuity">{t('اقساط مساوی','Annuity')}</option><option value="bullet">{t('یکجا در سررسید','Bullet at Maturity')}</option><option value="custom">{t('برنامه سفارشی / بالونی','Custom / Balloon Schedule')}</option></select></label>
          <label className="fw-field"><span>{t('سقف تعهد تسهیلات','Committed Facility Limit')}</span><input type="number" min="0" value={loan.facilityLimit??''} onChange={e=>updateLoan(loan.id,{facilityLimit:e.target.value===''?undefined:Number(e.target.value)})}/></label>
          <label className="fw-field"><span>{t('کارمزد سالانه مانده استفاده‌نشده (%)','Annual Undrawn Commitment Fee (%)')}</span><input type="number" min="0" step="0.01" value={loan.commitmentFeeAnnualRatePercent??0} onChange={e=>updateLoan(loan.id,{commitmentFeeAnnualRatePercent:Number(e.target.value)})}/></label>
        </div>
        {(loan.periodRepaymentMethod??loan.repaymentMethod)==='custom'&&<div className="fw-card"><b>{t('برنامه اصل سفارشی به تفکیک دوره','Custom Principal Repayment by Period')}</b>
          {projectPeriods.map(period=>{const current=(loan.customPrincipalRepayments??[]).find(item=>item.period===period.index)?.amount??0;return <label className="fw-field" key={period.index}><span>{t('دوره','Period')} {period.index} · {period.startDate} – {period.endDate}</span><input type="number" min="0" value={current} onChange={e=>updateLoan(loan.id,{customPrincipalRepayments:[...(loan.customPrincipalRepayments??[]).filter(item=>item.period!==period.index),...(Number(e.target.value)>0?[{period:period.index,amount:Number(e.target.value)}]:[])]})}/></label>})}
          <label className="fw-field"><span><input type="checkbox" checked={loan.balloonAtMaturity??false} onChange={e=>updateLoan(loan.id,{balloonAtMaturity:e.target.checked})}/> {t('تسویه مانده باقی‌مانده به‌صورت قسط بالونی در سررسید','Settle remaining principal as a balloon at maturity')}</span></label>
        </div>}
        {loan.periodRateConversion==='effective-annual-divided-by-frequency'&&periodicRateMethod&&<p className="fw-hint">{t('فرمول روش:','Method formula:')} {periodicRateMethod.formula} · {t('منبع:','Source:')} {periodicRateMethod.source} · {t('محدودیت:','Limitation:')} {periodicRateMethod.limitations}</p>}
        <div className="fw-grid">
          <label className="fw-field"><span>{t('مبنای روزشمار بهره و هزینه تأمین مالی','Interest & Financing Fee Day-Count')}</span><select value={loan.periodInterestConvention??(loan.drawdownMode==='period-manual'?'comfar-months-plus-360':'')} onChange={e=>updateLoan(loan.id,{periodInterestConvention:e.target.value?(e.target.value as Loan['periodInterestConvention']):undefined})}>
            <option value="">{t('استفاده از روش تبدیل نرخ انتخاب‌شده','Use selected rate-conversion method')}</option>
            <option value="comfar-months-plus-360">{t('ماه‌های کامل + روزهای با مبنای ۳۶۰ (کامفار)','Completed months + residual days / 360 (COMFAR)')}</option>
            <option value="actual-360">Actual / 360</option><option value="actual-365">Actual / 365</option>
          </select></label>
        </div>
        <h5>{t('تغییرات نرخ بهره در طول تسهیلات','Effective-Dated Interest Rate Resets')}</h5>
        {(loan.rateChanges??[]).map((change,index)=><div className="fw-grid" key={'rate-'+index}>
          <label className="fw-field"><span>{t('تاریخ اثر نرخ','Rate Effective Date')}</span><input type="date" min={props.projectPeriods?.[0]?.startDate} max={props.projectPeriods?.at(-1)?.endDate} value={change.effectiveDate} onChange={e=>updateLoan(loan.id,{rateChanges:(loan.rateChanges??[]).map((item,i)=>i===index?{...item,effectiveDate:e.target.value}:item)})}/></label>
          <label className="fw-field"><span>{t('نرخ سالانه جدید (%)','New Annual Rate (%)')}</span><input type="number" min="0" step="0.01" value={change.annualRatePercent} onChange={e=>updateLoan(loan.id,{rateChanges:(loan.rateChanges??[]).map((item,i)=>i===index?{...item,annualRatePercent:Number(e.target.value)}:item)})}/></label>
          <button className="secondary-button" onClick={()=>updateLoan(loan.id,{rateChanges:(loan.rateChanges??[]).filter((_,i)=>i!==index)})}>{t('حذف تغییر نرخ','Remove Rate Reset')}</button>
        </div>)}
        <button className="secondary-button" onClick={()=>updateLoan(loan.id,{rateChanges:[...(loan.rateChanges??[]),{effectiveDate:props.projectPeriods?.[0]?.startDate??'',annualRatePercent:loan.annualRate}]})}>{t('افزودن تغییر نرخ','Add Rate Reset')}</button>
        <h5>{t('کارمزدها و هزینه‌های تأمین مالی','Financing Fees & Issuance Costs')}</h5>
        {(loan.financingFees??[]).map((fee,index)=><div className="fw-grid" key={'fee-'+index}>
          <label className="fw-field"><span>{t('شرح هزینه','Fee Description')}</span><input value={fee.label??''} onChange={e=>updateLoan(loan.id,{financingFees:(loan.financingFees??[]).map((item,i)=>i===index?{...item,label:e.target.value}:item)})}/></label>
          <label className="fw-field"><span>{t('تاریخ پرداخت','Payment Date')}</span><input type="date" min={props.projectPeriods?.[0]?.startDate} max={props.projectPeriods?.at(-1)?.endDate} value={fee.date} onChange={e=>updateLoan(loan.id,{financingFees:(loan.financingFees??[]).map((item,i)=>i===index?{...item,date:e.target.value}:item)})}/></label>
          <label className="fw-field"><span>{t('مبلغ','Amount')}</span><input type="number" min="0" step="0.01" value={fee.amount} onChange={e=>updateLoan(loan.id,{financingFees:(loan.financingFees??[]).map((item,i)=>i===index?{...item,amount:Number(e.target.value)}:item)})}/></label>
          <label className="fw-field"><span>{t('نحوه شناسایی','Accounting Treatment')}</span><select value={fee.treatment} onChange={e=>updateLoan(loan.id,{financingFees:(loan.financingFees??[]).map((item,i)=>i===index?{...item,treatment:e.target.value as 'expense'|'capitalize'}:item)})}><option value="expense">{t('هزینه نقدی دوره','Period Expense')}</option><option value="capitalize">{t('سرمایه‌ای و افزوده به بدهی','Capitalize into Debt')}</option></select></label>
          <button className="secondary-button" onClick={()=>updateLoan(loan.id,{financingFees:(loan.financingFees??[]).filter((_,i)=>i!==index)})}>{t('حذف هزینه','Remove Fee')}</button>
        </div>)}
        <button className="secondary-button" onClick={()=>updateLoan(loan.id,{financingFees:[...(loan.financingFees??[]),{date:props.projectPeriods?.[0]?.startDate??'',amount:0,treatment:'expense'}]})}>{t('افزودن کارمزد / هزینه انتشار','Add Financing / Issuance Fee')}</button>
        <p className="fw-hint">{t('تغییر نرخ از تاریخ مؤثر اعمال می‌شود. کارمزد هزینه‌ای در جریان نقد و خدمت بدهی دوره ثبت می‌شود؛ هزینه سرمایه‌ای به مانده بدهی و دارایی‌های قبل از بهره‌برداری افزوده می‌شود.','Rate resets apply from their effective dates. Expense fees are recorded in period financing costs and debt service; capitalized fees increase debt and deferred pre-operating assets.')}</p>
        <p className="fw-hint">{t('تغییرات برداشت دوره‌ای در موتور ماهانه/فصلی اعمال می‌شوند؛ جدول سالانه برای کنترل و گزارش سالانه مستقل باقی می‌ماند.','Period drawdown edits affect the monthly/quarterly engine; the annual schedule remains separately available for annual reporting.')}</p>
        {loan.drawdownMode==='period-manual'&&!periodDrawdownDatesMatch(loan)&&<div className="fw-hint">{t('تقویم پروژه تغییر کرده است؛ برنامه برداشت قبلی به تاریخ‌های جدید متصل نیست. برای بازسازی از برنامه سالانه استفاده کنید.','The project calendar changed; the prior drawdown schedule is not mapped to the new dates. Rebuild it from the annual schedule.')} <button className="secondary-button" onClick={()=>updateLoan(loan.id,{periodDrawdowns:allocateAnnualFlowsToPeriods(loan.drawdowns,props.projectPeriods??[],props.fiscalYearStartMonth??1),periodDrawdownDates:(props.projectPeriods??[]).map(period=>period.startDate)})}>{t('بازسازی برنامه دوره‌ای','Rebuild period schedule')}</button></div>}
        {loan.drawdownMode==='period-manual'?<div className="fw-grid">{props.projectPeriods.map((period,index)=><div className="fw-field" key={period.index}><span>{t('دوره','Period')} {period.index} · {period.startDate} تا {period.endDate}</span><input type="number" min="0" value={periodDrawdownDatesMatch(loan)?loan.periodDrawdowns?.[index]??0:0} onChange={e=>updatePeriodDraw(loan.id,index,Number(e.target.value))}/><span>{t('تاریخ دقیق برداشت','Exact drawdown date')}</span><input type="date" min={period.startDate} max={period.endDate} value={periodDrawdownDatesMatch(loan)?loan.exactDrawdownDates?.[index]??period.startDate:period.startDate} onChange={e=>updatePeriodDrawDate(loan.id,index,e.target.value)}/></div>)}</div>:<p className="fw-hint">{t('برداشت‌های سالانه برای موتور دوره‌ای بر اساس تعداد روز واقعی هر دوره توزیع می‌شوند. برای برداشت‌های یک‌باره یا مرحله‌ای دقیق، ورود مستقیم برداشت هر دوره را انتخاب کنید.','Annual drawdowns are distributed by actual period days in the periodic engine. Select direct period entry for exact one-off or staged drawdowns.')}</p>}
      </div>}
      <div className="fw-card"><b>{tr('برنامه بازپرداخت دوره‌ای همین تسهیلات')}</b>{(periodicFinanceResult?.valid ? periodicFinanceResult.loanSchedules[loan.id]??[] : result.loanSchedules[loan.id]??[]).map((r,i)=><div className="fw-validation" key={i}><span>{periodicFinanceResult?.valid ? `${tr('دوره')} ${i+1} · ${periodicFinanceResult.rows[i]?.startDate} تا ${periodicFinanceResult.rows[i]?.endDate}` : `${tr('سال')} ${i+1}`} · {tr('برداشت')} {money(r.drawdown)} · {tr('مانده اول')} {money(r.openingBalance)}</span><b>{tr('بهره نقدی')} {money(r.interestExpense)} · {tr('بهره سرمایه‌ای')} {money(r.capitalizedInterest)} · {t('کارمزد تعهد','Commitment Fee')} {money('commitmentFeeExpense' in r ? r.commitmentFeeExpense : 0)} · {t('سایر کارمزدهای نقدی','Other Cash Fees')} {money('financingFeeExpense' in r ? Math.max(0,r.financingFeeExpense-('commitmentFeeExpense' in r ? r.commitmentFeeExpense : 0)) : 0)} · {t('کارمزد سرمایه‌ای','Capitalized Fees')} {money('capitalizedFinancingFees' in r ? r.capitalizedFinancingFees : 0)} · {tr('اصل')} {money(r.principal)} · {tr('مانده پایان')} {money(r.closingBalance)}</b></div>)}</div><button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/> {tr('حذف تسهیلات')}</button>
    </div>)}
    <button className="secondary-button" onClick={addLoan}><Plus size={14}/> {tr('افزودن وام')}</button>
    <div className="fw-card">
      <h4>{t('کنترل تعهدات قراردادی تسهیلات','Loan Covenant Controls')}</h4>
      <label className="fw-field"><span>{t('حداقل نسبت پوشش خدمت بدهی (DSCR)','Minimum Debt Service Coverage Ratio (DSCR)')}</span><input type="number" min="0.01" step="0.01" placeholder={t('بدون محدودیت','No covenant')} value={state.minimumDscr??''} onChange={e=>setState(s=>({...s,minimumDscr:e.target.value===''?undefined:Number(e.target.value)}))}/></label>
      <p className="fw-hint">{t('نقض حداقل DSCR در هر دوره به‌صورت هشدار قراردادی گزارش می‌شود و به‌طور خودکار جریان نقد یا اقساط را تغییر نمی‌دهد.','A minimum DSCR breach is reported as a covenant warning for the affected period; cash flows and repayments are not automatically altered.')}</p>
    </div>
    <div className="fw-card">
      <h4>{t('آورده نقدی سهامدار به تفکیک سال','Annual Shareholder Equity Contributions')}</h4>
      <div className="fw-grid">{Array.from({length:construction},(_,i)=><label className="fw-field" key={i}><span>{tr('آورده سال ساخت')} {i+1}</span><input type="number" min="0" value={equityContributions[i]??0} onChange={e=>setEquity(i,Number(e.target.value))}/></label>)}</div>
      <p className="fw-hint">{tr('آورده سهامدار برای CAPEX را جدا از برداشت وام وارد کنید. سرمایه در گردش در بخش مستقل زیر ثبت می‌شود.')}</p>
      <h4>{t('آورده سهامدار برای سرمایه در گردش','Shareholder Equity for Working Capital')}</h4>
      <div className="fw-grid">{Array.from({length:opYears},(_,i)=>{const yearIndex=construction+i;return <label className="fw-field" key={yearIndex}><span>{tr('آورده سرمایه در گردش سال بهره‌برداری')} {i+1}</span><input type="number" min="0" value={equityWorkingCapitalContributions[yearIndex]??0} onChange={e=>setWorkingCapitalEquity(yearIndex,Number(e.target.value))}/></label>})}</div>
      <p className="fw-hint">{tr('این مبلغ، آورده نقدی سهامدار برای تأمین سرمایه در گردش است و فقط یک‌بار ثبت می‌شود. اگر از افزایش خالص سرمایه در گردش بیشتر باشد، مازاد در مانده نقد ترازنامه دیده می‌شود؛ اگر کمتر باشد، کسری نقدینگی باقی می‌ماند. سهم تأمین‌شده از محل وام در این قسمت وارد نمی‌شود.','This is the shareholder cash contribution to working capital; enter it only once. Any amount above the net working-capital increase remains as cash on the balance sheet; any shortfall remains visible as a cash deficit. Do not enter debt-funded amounts here.')}</p>
    </div>

    <h4>{t('۲. سرمایه در گردش دوره‌ای','2. Periodic Working Capital')}</h4>
    <p className="fw-hint">{tr('مبنای روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را از چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.')}</p>
    <div className="fw-grid">
      {([['raw','روز موجودی مواد اولیه'],['energy','روز موجودی/پوشش هزینه انرژی'],['spareParts','روز موجودی قطعات یدکی'],['wip','روز کالای در جریان ساخت'],['finished','روز محصول نهایی'],['receivable','روز وصول مطالبات'],['cash','روز حداقل نقد عملیاتی'],['payable','روز پرداخت بدهی تجاری']] as [keyof SavedState['workingCapitalDays'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{tr(label)}</span><input type="number" min="0" value={state.workingCapitalDays[key]} onChange={e=>updateDay(key,Number(e.target.value))}/></label>)}
    </div>
    <div className="fw-grid">
      {([['rawMaterials','مبنای سالانه مواد اولیه'],['energy','مبنای سالانه هزینه انرژی'],['spareParts','مبنای سالانه قطعات یدکی'],['conversion','مبنای سالانه هزینه تبدیل'],['finishedGoods','بهای سالانه محصول ساخته‌شده'],['cash','هزینه نقدی سالانه برای حداقل نقد'],['payables','مبنای سالانه بدهی تجاری']] as [keyof SavedState['workingCapitalBases'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{tr(label)} ({props.currency})</span><input type="number" min="0" value={state.workingCapitalBases[key]} onChange={e=>setState(s=>({...s,workingCapitalBases:{...s.workingCapitalBases,[key]:Math.max(0,Number(e.target.value))}}))}/></label>)}
      <label className="fw-field"><span>{tr('تکمیل مواد در جریان ساخت (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.material} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,material:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
      <label className="fw-field"><span>{tr('تکمیل تبدیل در جریان ساخت (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.conversion} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,conversion:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
    </div>
    <p className="fw-hint">{tr('مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.')}</p>
    <div className="fw-result">{tr('اوج نیاز سرمایه در گردش')}: <b>{money(result.peakWorkingCapital)} {props.currency}</b> · {tr('کسری منابع')}: <b>{money(result.fundingGap)} {props.currency}</b></div>
    <div className="fw-card"><b>{t('جدول دوره‌ای سرمایه در گردش','Periodic Working Capital Schedule')}</b>{result.years.map(r=><div className="fw-validation" key={r.year}><span>{tr('سال')} {r.year} · {tr('مواد')} {money(r.workingCapitalBreakdown.rawMaterials)} · {tr('انرژی')} {money(r.workingCapitalBreakdown.energy??0)} · {tr('قطعات یدکی')} {money(r.workingCapitalBreakdown.spareParts??0)} · WIP {money(r.workingCapitalBreakdown.workInProgress)} · {tr('محصول')} {money(r.workingCapitalBreakdown.finishedGoods)} · {tr('مطالبات')} {money(r.workingCapitalBreakdown.receivables)} · {tr('پرداختنی')} {money(r.workingCapitalBreakdown.payables)}</span><b>نیاز طی سال {money(r.workingCapital)} · مانده پایان {money(r.closingWorkingCapital)} · تغییر خالص {money(r.changeInWorkingCapital)}</b></div>)}</div>

    <h4>{t('۳. استهلاک دارایی‌به‌دارایی و مالیات','3. Asset-Level Depreciation & Tax')}</h4>
    <p className="fw-hint">{tr('دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.')}</p>
    <div className="fw-grid">{taxRates.map((v,i)=><label className="fw-field" key={i}><span>{tr('نرخ مالیات سال')} {i+1} (%)</span><input type="number" min="0" max="100" value={v} onChange={e=>setState(s=>({...s,taxRates:taxRates.map((rate,j)=>j===i?Number(e.target.value):rate)}))}/></label>)}</div>
    {projectPeriods.length>0&&<div className="fw-card"><h4>{t('نرخ مالیات به تفکیک دوره','Tax Rate by Project Period')}</h4><p className="fw-hint">{t('در صورت عدم ورود نرخ دوره‌ای، نرخ سال مالی متناظر اعمال می‌شود. با ویرایش هر خانه، برنامه مالیاتی مستقل دوره‌ای فعال می‌شود.','If no period-specific rate is entered, the corresponding fiscal-year rate is applied. Editing any cell activates the independent period tax schedule.')}</p><div className="fw-grid">{projectPeriods.map((period,index)=>{const fiscalIndex=props.fiscalYearStartMonth==null?0:fiscalYearIndexForPeriod(period,projectPeriods,props.fiscalYearStartMonth);const defaultRate=taxRates[fiscalIndex]??props.taxRate;return <label className="fw-field" key={period.index}><span>{t('دوره','Period')} {period.index} · {period.startDate} (%)</span><input type="number" min="0" max="100" value={periodTaxRateDatesMatch()?state.periodTaxRates![index]:defaultRate} onChange={e=>updatePeriodTaxRate(index,Number(e.target.value))}/></label>})}</div></div>}
    <div className="fw-card">
      <label className="fw-field"><span>{t('مدت معافیت مالیاتی از شروع تولید (سال)','Tax holiday from start of production (years)')}</span><input type="number" min="0" step="1" value={state.taxHolidayYears??0} onChange={e=>setState(s=>({...s,taxHolidayYears:Math.max(0,Math.floor(Number(e.target.value)||0))}))}/></label>
      <p className="fw-hint">{t('معافیت فقط برای سال‌های تولید پس از پایان دوره ساخت اعمال می‌شود. پس از پایان مدت معافیت، محاسبه مالیات عادی از سر گرفته می‌شود.','The holiday applies only to production fiscal years after construction. Normal tax calculation resumes when the holiday expires.')}</p>
    </div>
    <div className="fw-card">
      <h4>{t('نرخ‌های پلکانی مالیات بر درآمد','Progressive Corporate Income Tax Brackets')}</h4>
      <p className="fw-hint">{t('مطابق جدول ۲۲ مرجع کامفار، هر نرخ فقط بر بخش درآمد واقع در همان بازه اعمال می‌شود. بازه‌ها باید پیوسته و از صفر شروع شوند؛ سقف خالی فقط برای آخرین پله است.','Following COMFAR Reference Manual Table 22, each marginal rate applies only to income within its bracket. Brackets must be contiguous and start at zero; a blank upper limit is reserved for the final bracket.')}</p>
      {(state.taxBrackets??[]).map((bracket,index)=><div className="fw-grid" key={index}>
        <label className="fw-field"><span>{t('حد پایین','Lower limit')}</span><input type="number" min="0" value={bracket.lowerLimit} onChange={e=>updateTaxBracket(index,{lowerLimit:Math.max(0,Number(e.target.value))})}/></label>
        <label className="fw-field"><span>{t('حد بالا (خالی = بدون سقف)','Upper limit (blank = unlimited)')}</span><input type="number" min="0" value={bracket.upperLimit??''} onChange={e=>updateTaxBracket(index,{upperLimit:e.target.value===''?null:Math.max(0,Number(e.target.value))})}/></label>
        <label className="fw-field"><span>{t('نرخ این پله (%)','Marginal rate (%)')}</span><input type="number" min="0" max="100" value={bracket.ratePercent} onChange={e=>updateTaxBracket(index,{ratePercent:Math.max(0,Math.min(100,Number(e.target.value)))})}/></label>
        <button type="button" className="secondary-button" onClick={()=>removeTaxBracket(index)}><Trash2 size={14}/>{t('حذف پله','Remove bracket')}</button>
      </div>)}
      <button type="button" className="secondary-button" disabled={(state.taxBrackets??[]).length>0&&(state.taxBrackets??[]).at(-1)?.upperLimit===null} onClick={addTaxBracket}><Plus size={14}/>{t('افزودن پله مالیاتی','Add tax bracket')}</button>
      {(state.taxBrackets??[]).length>0&&<p className="fw-hint">{t('با فعال بودن جدول پلکانی، نرخ‌های ثابت سالانه و دوره‌ای برای محاسبه مالیات نادیده گرفته می‌شوند.','When progressive brackets are active, flat annual and period tax rates are ignored.')}</p>}
    </div>
    {listFinancialMethods('taxation').map(method=><div className="fw-validation" key={method.id}>
      <b>{tr(method.nameFa,method.nameEn)} · {method.calculationStatus==='implemented'?tr('محاسبه پیاده‌سازی‌شده','Calculation implemented'):method.calculationStatus}</b>
      <p className="fw-hint">{tr('فرمول:','Formula:')} {method.formula}</p>
      <p className="fw-hint">{tr('شرایط اعتبار:','Validity:')} {method.validity}</p>
      <p className="fw-hint">{tr('منبع:','Source:')} {method.source}</p>
      <p className="fw-hint">{tr('وضعیت تطبیق:','Benchmark status:')} {method.benchmarkStatus==='partial'?tr('تطبیق جزئی','Partially benchmarked'):method.benchmarkStatus==='verified'?tr('تطبیق‌شده','Benchmarked'):tr('تطبیق عددی نشده','Not numerically benchmarked')}</p>
      {method.limitations&&<p className="fw-hint">{tr('محدودیت‌ها:','Limitations:')} {method.limitations}</p>}
    </div>)}
    <p className="fw-hint">{tr('نرخ سالانه در صورت نبود نرخ اختصاصی برای هر دوره، به دوره‌های همان سال مالی اعمال می‌شود. نرخ‌های واردشده در بخش «نرخ مالیات به تفکیک دوره» بر نرخ سالانه اولویت دارند.','Annual rates apply to periods in the corresponding fiscal year unless explicit period-specific rates are entered. Values in the period tax schedule override the annual rate.')}</p>
    {!props.useFixedInvestmentRegister&&<>
          <button className="secondary-button" onClick={syncAssets}><RefreshCw size={14}/> {tr('همگام‌سازی دارایی‌ها از CAPEX')}</button>
          {comfarLifecycle&&<div className="fw-validation">
            <span>{tr('وضعیت دفتر دارایی و فروش','Fixed Asset Register & Disposal Status')}</span>
            <b>{comfarLifecycle.valid&&!(props.comfarDepreciationWarnings?.length)?tr('معتبر','Valid'):tr('نیازمند اصلاح','Requires review')}</b>
            {comfarLifecycle.warnings.concat(props.comfarDepreciationWarnings??[]).map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
            {comfarCalendarLifecycle?.depreciation.methodControls.map(control=><p className="fw-hint" key={control.method}>
              {control.method}: {tr('فرمول اجرایی فعال؛ تطبیق عددی مستقل با خروجی مرجع در انتظار است.','Calculation implemented; independent numerical benchmark reconciliation is pending.')}
            </p>)}
            {comfarLifecycle.sales.map(sale=><p className="fw-hint" key={sale.id}>{tr('فروش دوره','Sale period')} {sale.period}: {tr('ارزش دفتری','Book value')} {money(sale.bookValueAtSale)} · {tr('عواید فروش','Sale proceeds')} {money(sale.saleProceeds)} · {tr('سود/زیان واگذاری','Other income / loss')} {money(sale.otherIncomeLoss)}</p>)}
          </div>}
          {state.assets.map(asset=><div className="fw-grid" key={asset.id}>
            <label className="fw-field"><span>{tr('دارایی')}</span><input value={tr(asset.name)} onChange={e=>updateAsset(asset.id,{name:e.target.value})}/></label>
            <label className="fw-field"><span>{tr('بهای تمام‌شده')}</span><input type="number" value={asset.cost} onChange={e=>updateAsset(asset.id,{cost:Number(e.target.value)})}/></label>
            <label className="fw-field"><span>{tr('ارزش اسقاط')}</span><input type="number" value={asset.residualValue} onChange={e=>updateAsset(asset.id,{residualValue:Number(e.target.value)})}/></label>
            <label className="fw-field"><span>{tr('عمر مفید (سال)')}</span><input type="number" min="1" value={asset.usefulLife} onChange={e=>updateAsset(asset.id,{usefulLife:Number(e.target.value)})}/></label>
            <label className="fw-field"><span>{tr('شروع استهلاک (سال مدل)')}</span><input type="number" min="1" value={asset.startYear} onChange={e=>updateAsset(asset.id,{startYear:Number(e.target.value)})}/></label>
            <label className="fw-field"><span>{tr('روش')}</span><select value={asset.method} onChange={e=>updateAsset(asset.id,{method:e.target.value as Asset['method']})}><option value="straight-line">{tr('خط مستقیم')}</option><option value="declining-balance">{tr('مانده نزولی')}</option></select></label>
            {asset.method==='declining-balance'&&<label className="fw-field"><span>{tr('نرخ نزولی (%)')}</span><input type="number" value={asset.decliningRate??20} onChange={e=>updateAsset(asset.id,{decliningRate:Number(e.target.value)})}/></label>}
            <button className="secondary-button" onClick={()=>setState(s=>({...s,assets:s.assets.filter(a=>a.id!==asset.id)}))}><Trash2 size={14}/> {tr('حذف دارایی')}</button>
          </div>)}
          <button className="secondary-button" onClick={addAsset}><Plus size={14}/> {tr('افزودن دارایی')}</button>
          <div className="fw-validation"><span>{tr('جمع استهلاک سالانه (به ترتیب سال مدل)')}</span><b>{depreciationValues.map(value=>money(value)).join(' · ')}</b></div>
    </>}
    {props.useFixedInvestmentRegister&&!comfarLifecycle&&<p className="fw-hint">{tr('برنامه استهلاک فقط از دفتر عمومی Fixed Investment خوانده می‌شود. هنوز نوبت تحصیل مستهلک‌شونده‌ای در دفتر ثبت نشده است؛ هیچ عمر مفید یا نرخ استهلاک فرضی اعمال نمی‌شود.','Depreciation is sourced only from the shared Fixed Investment Register. No depreciable acquisition is registered yet; no assumed useful life or depreciation rate is applied.')}</p>}
    {props.useFixedInvestmentRegister&&comfarLifecycle&&<div className="fw-validation">
      <span>{tr('جمع استهلاک سالانه از دفتر دارایی','Annual Depreciation from Fixed Investment Register')}</span>
      <b>{depreciationValues.map(value=>money(value)).join(' · ')}</b>
      {comfarLifecycle.warnings.concat(props.comfarDepreciationWarnings??[]).map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
      {comfarCalendarLifecycle?.depreciation.methodControls.map(control=><p className="fw-hint" key={control.method}>
        {control.method}: {tr('فرمول اجرایی فعال؛ تطبیق عددی مستقل با خروجی مرجع در انتظار است.','Calculation implemented; independent numerical benchmark reconciliation is pending.')}
      </p>)}
      {comfarLifecycle.sales.map(sale=><p className="fw-hint" key={sale.id}>{tr('فروش دوره','Sale period')} {sale.period}: {tr('ارزش دفتری','Book value')} {money(sale.bookValueAtSale)} / {tr('عواید فروش','Sale proceeds')} {money(sale.saleProceeds)} / {tr('سود یا زیان','Gain / loss')} {money(sale.otherIncomeLoss)}</p>)}
    </div>}
    <div className="fw-grid">
      <label className="fw-field"><span>{tr('نرخ تنزیل')}</span><select value={state.discountMode} onChange={e=>setState(s=>({...s,discountMode:e.target.value as SavedState['discountMode']}))}><option value="wacc">WACC</option><option value="manual">{tr('دستی')}</option></select></label>
      {state.discountMode==='manual'&&<label className="fw-field"><span>{tr('نرخ تنزیل دستی (%)')}</span><input type="number" value={state.manualRate} onChange={e=>setState(s=>({...s,manualRate:Number(e.target.value)}))}/></label>}
      <label className="fw-field"><span>{tr('CAPEX نگهداری سالانه (% هزینه نقدی)')}</span><input type="number" min="0" value={state.maintenancePercent} onChange={e=>setState(s=>({...s,maintenancePercent:Number(e.target.value)}))}/></label>
      <label className="fw-field"><span>{t('رشد سالانه قیمت فروش (%)','Annual Selling Price Escalation (%)')}</span><input type="number" min="-99" value={state.salesEscalationPercent} onChange={e=>setState(s=>({...s,salesEscalationPercent:Number(e.target.value)}))}/></label>
      <label className="fw-field"><span>{t('رشد سالانه هزینه‌های عملیاتی (%)','Annual OPEX Escalation (%)')}</span><input type="number" min="-99" value={state.opexEscalationPercent} onChange={e=>setState(s=>({...s,opexEscalationPercent:Number(e.target.value)}))}/></label>
    </div>

    <h4>{t('۴. شاخص‌های مالی، CFADS و DSCR','4. Financial Metrics, CFADS & DSCR')}</h4>
    <div className="fw-kpis">
      <article><small>{tr('NPV پروژه')}</small><b>{money(result.npvProject??NaN)}</b></article>
      <article><small>{tr('IRR پروژه')}</small><b>{result.irrProject==null?'—':money(result.irrProject*100)+'٪'}</b></article>
      <article><small>{tr('NPV سهامدار')}</small><b>{money(result.npvEquity??NaN)}</b></article>
      <article><small>{tr('IRR سهامدار')}</small><b>{result.irrEquity==null?'—':money(result.irrEquity*100)+'٪'}</b></article>
      <article><small>WACC</small><b>{result.wacc==null?'—':money(result.wacc*100)+'٪'}</b></article>
      <article><small>{tr('اوج سرمایه در گردش')}</small><b>{money(result.peakWorkingCapital)}</b></article>
      <article><small>{tr('کل برداشت وام')}</small><b>{money(result.totalDebtDrawdown)}</b></article>
      <article><small>{tr('کل آورده')}</small><b>{money(result.totalEquityContribution)}</b></article>
    </div>
    <div className="fw-card"><h4>{tr('جدول سالانه خدمت بدهی')}</h4>
      <div className="fw-validation"><b>{tr('سال')}</b><b>CFADS</b><b>{tr('بهره')}</b><b>{tr('اصل')}</b><b>DSCR</b><b>{tr('مانده بدهی')}</b></div>
      {result.years.map(r=><div className="fw-validation" key={r.year}><span>{r.year}</span><span>{money(r.cfads)}</span><span>{money(r.interest)}</span><span>{money(r.principal)}</span><b>{r.dscr==null?'—':money(r.dscr)+'x'}</b><span>{money(r.debtBalance)}</span></div>)}
    </div>
    {result.warnings.length>0&&<ul className="fw-checklist">{result.warnings.map((w,i)=><li key={i}>{tr(w)}</li>)}</ul>}

    <h4>{t('۵. تحلیل حساسیت چندمتغیره','5. Multivariable Sensitivity Analysis')}</h4>
    <p className="fw-hint">{tr('ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت فروش را نشان می‌دهند. مقادیر NPV پروژه با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.')}</p>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{tr('حجم \\ قیمت')}</th>{[-20,-10,0,10,20].map(v=><th key={v}>{v}%</th>)}</tr></thead><tbody>{sensitivity.map((row,i)=><tr key={i}><th>{[-20,-10,0,10,20][i]}%</th>{row.map((cell,j)=><td key={j}>{cell.npv==null?'—':money(cell.npv)}</td>)}</tr>)}</tbody></table></div>
    <h4>{t('۶. سناریوهای خوش‌بینانه و بدبینانه','6. Optimistic & Pessimistic Scenarios')}</h4>
    <div className="fw-grid">
      <div className="fw-result">{tr('بدبینانه')} · NPV {money(scenarios.pessimistic.npvProject??NaN)} · IRR {scenarios.pessimistic.irrProject==null?'—':money(scenarios.pessimistic.irrProject*100)+'٪'}</div>
      <div className="fw-result">{tr('مبنا')} · NPV {money(scenarios.base.npvProject??NaN)} · IRR {scenarios.base.irrProject==null?'—':money(scenarios.base.irrProject*100)+'٪'}</div>
      <div className="fw-result">{tr('خوش‌بینانه')} · NPV {money(scenarios.optimistic.npvProject??NaN)} · IRR {scenarios.optimistic.irrProject==null?'—':money(scenarios.optimistic.irrProject*100)+'٪'}</div>
    </div>

    <h4>{t('۷. تطبیق سه صورت مالی و کنترل ترازنامه','7. Three-Statement Reconciliation & Balance Sheet Check')}</h4>
    <div className="fw-result">{tr('ترازهای منطبق: ')}<b>{totalBalanceChecks} {tr('از')} {statements.length}</b> {tr('دوره')} · {tr('کنترل گردش مانده‌ها: ')}<b>{totalMovementChecks} {tr('از')} {statements.length}</b></div>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{tr('سال')}</th><th>{tr('فروش')}</th><th>EBIT</th><th>{tr('سود خالص')}</th><th>{tr('وجه نقد ابتدای دوره')}</th><th>{tr('جریان عملیاتی')}</th><th>{tr('جریان سرمایه‌گذاری')}</th><th>{tr('جریان تأمین مالی')}</th><th>{tr('وجه نقد پایان دوره')}</th><th>{tr('جمع دارایی‌ها')}</th><th>{tr('بدهی + حقوق مالکانه')}</th><th>{tr('اختلاف تراز')}</th></tr></thead><tbody>{statements.map(r=><tr key={r.year}><td>{r.year}</td><td>{money(r.incomeStatement.revenue)}</td><td>{money(r.incomeStatement.ebit)}</td><td>{money(r.incomeStatement.netIncome)}</td><td>{money(r.openingBalances.cash)}</td><td>{money(r.cashFlowStatement.operatingCashFlow)}</td><td>{money(r.cashFlowStatement.investingCashFlow)}</td><td>{money(r.cashFlowStatement.financingCashFlow)}</td><td>{money(r.cashFlowStatement.closingCash)}</td><td>{money(r.balanceSheet.totalAssets)}</td><td>{money(r.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(r.balanceSheet.balanceDifference)} {r.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody></table></div>
    <p className="fw-hint">{tr('صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.')}</p>
    <h4>{t('۸. موتور یکپارچه جریان نقدی ماهانه/فصلی','8. Integrated Monthly / Quarterly Cash-Flow Engine')}</h4>
    {periodicFinanceResult?.valid?<div className="fw-card">
      <p className="fw-hint">{t('جریان‌های عملیاتی سالانه با تعداد روز واقعی به دوره‌های پروژه تخصیص یافته‌اند. برداشت وام می‌تواند روزشمار از مبالغ سالانه توزیع شود یا برای هر دوره مستقلاً ثبت شود. نرخ مالیات قابل تنظیم در هر دوره است و زیان انتقالی، بهره، اصل بدهی و سرمایه در گردش در سطح هر دوره محاسبه می‌شوند. در صورت وجود تاریخ‌های مستند دفتر دارایی، استهلاک و واگذاری دارایی‌به‌دارایی در سطح ماه/فصل اعمال می‌شود. صورت‌های مالی دوره‌ای نیز مانده وام، سرمایه در گردش خالص و گردش دارایی‌ها را کنترل می‌کنند؛ مانده‌های افتتاحیه برای پروژه جدید صفر فرض شده‌اند.','Annual operating flows are allocated to project periods by actual day counts. Loan drawdowns can be day-weighted from annual amounts or entered directly by period. Tax rates can be set for each period, and loss carry-forward, interest, principal and working capital are calculated period by period. Current limitation: Annual operating flows are allocated by actual days; asset-level depreciation and disposals use the dated monthly/quarterly asset lifecycle when verified. The periodic statements expose net working capital, loan closing balances and disposal accounting; opening balances default to zero for greenfield projects.')}</p>
      <div className="fw-kpis">
        <article><small>NPV {t('پروژه','Project')}</small><b>{money(periodicFinanceResult.npvProject??NaN)}</b></article>
        <article><small>IRR {t('پروژه','Project')}</small><b>{periodicFinanceResult.irrProject==null?'—':money(periodicFinanceResult.irrProject)+'%'}</b></article>
        <article><small>MIRR {t('پروژه','Project')}</small><b>{periodicFinanceResult.mirrProject==null?'—':money(periodicFinanceResult.mirrProject)+'%'}</b></article>
        <article><small>NPV {t('سهامدار','Equity')}</small><b>{money(periodicFinanceResult.npvEquity??NaN)}</b></article>
        <article><small>IRR {t('سهامدار','Equity')}</small><b>{periodicFinanceResult.irrEquity==null?'—':money(periodicFinanceResult.irrEquity)+'%'}</b></article>
        <article><small>{t('اوج سرمایه در گردش','Peak working capital')}</small><b>{money(periodicFinanceResult.peakWorkingCapital)}</b></article>
      </div>
      <h4>{t('صورت‌های مالی یکپارچه در سطح هر دوره','Linked Three Financial Statements by Period')}</h4>
      <div className="fw-result">{t('ترازهای منطبق','Reconciled periods')}: <b>{periodicStatements.filter(row=>row.balanceSheet.reconciled).length} / {periodicStatements.length}</b></div>
      <div style={{overflowX:'auto',maxHeight:420}}>
        <table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('تاریخ پایان','Period end')}</th><th>EBIT</th><th>{t('سود خالص','Net income')}</th><th>{t('جریان عملیاتی','Operating CF')}</th><th>{t('جریان سرمایه‌گذاری','Investing CF')}</th><th>{t('جریان تأمین مالی','Financing CF')}</th><th>{t('وجه نقد پایان','Closing cash')}</th><th>{t('بدهی پایان','Closing debt')}</th><th>{t('دارایی خالص ثابت','Net fixed assets')}</th><th>{t('اختلاف تراز','Balance difference')}</th></tr></thead>
          <tbody>{periodicStatements.map(row=><tr key={row.period}><td>{row.period}</td><td>{row.endDate}</td><td>{money(row.incomeStatement.ebit)}</td><td>{money(row.incomeStatement.netIncome)}</td><td>{money(row.cashFlowStatement.operatingCashFlow)}</td><td>{money(row.cashFlowStatement.investingCashFlow)}</td><td>{money(row.cashFlowStatement.financingCashFlow)}</td><td>{money(row.cashFlowStatement.closingCash)}</td><td>{money(row.balanceSheet.debt)}</td><td>{money(row.balanceSheet.netFixedAssets)}</td><td>{money(row.balanceSheet.balanceDifference)} {row.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="fw-hint">{t('سرمایه در گردش به‌صورت خالص (دارایی‌های جاری منهای بدهی‌های عملیاتی) نمایش داده می‌شود؛ تفکیک ناخالص اقلام جاری بدون داده تفصیلی ساخته نمی‌شود. بهره سرمایه‌ای‌شده هم‌زمان به دارایی‌های قبل از بهره‌برداری و بدهی افزوده می‌شود.','Working capital is shown net of operating payables; gross current-asset splits are not inferred without detailed data. Capitalized interest increases both deferred pre-operating assets and debt.')}</p>
      <div style={{overflowX:'auto',maxHeight:480}}>
        <table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('تاریخ','Dates')}</th><th>{t('روز','Days')}</th><th>{t('فروش','Revenue')}</th><th>{t('هزینه متغیر','Variable cost')}</th><th>{t('هزینه ثابت','Fixed cost')}</th><th>{t('استهلاک','Depreciation')}</th><th>{t('بهره','Interest')}</th><th>{t('اصل','Principal')}</th><th>{t('مالیات','Tax')}</th><th>{t('تغییر سرمایه در گردش','Change in WC')}</th><th>{t('آورده سهامدار برای سرمایه در گردش','Shareholder WC Equity')}</th><th>CFADS</th><th>DSCR</th><th>{t('جریان نقدی پروژه','Project FCF')}</th></tr></thead>
          <tbody>{periodicFinanceResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{row.startDate} – {row.endDate}</td><td>{row.days}</td><td>{money(row.revenue)}</td><td>{money(row.variableCost)}</td><td>{money(row.fixedCost)}</td><td>{money(row.depreciation)}</td><td>{money(row.interestExpense)}</td><td>{money(row.principal)}</td><td>{money(row.tax)}</td><td>{money(row.changeInWorkingCapital)}</td><td>{money(row.equityWorkingCapitalContribution)}</td><td>{money(row.cfads)}</td><td>{row.dscr==null?'—':money(row.dscr)+'x'}</td><td>{money(row.projectFreeCashFlow)}</td></tr>)}</tbody>
        </table>
      </div>
      {periodicFinanceResult.warnings.length>0&&<ul className="fw-checklist">{periodicFinanceResult.warnings.map((warning,i)=><li key={i}>{tr(warning)}</li>)}</ul>}
    </div>:<p className="fw-hint">{periodicFinanceResult?.warnings.length?periodicFinanceResult.warnings.join(' · '):t('برای فعال‌سازی محاسبه دوره‌ای، تاریخ شروع و پایان پروژه، تناوب مالی، ماه آغاز سال مالی، مبنای روزشمار و زمان‌بندی جریان نقدی را در فونداسیون پروژه تعیین کنید.','To activate periodic calculations, define project start/end dates, financial frequency, fiscal-year start month, day-count basis and cash-flow timing in the project foundation.')}</p>}
    {props.jointVenture&&<div className="fw-card">
      <h4>{t('۹. جریان نقدی و تخصیص منافع شرکای مشارکت','9. Joint-Venture Partner Cash Flows & Allocation')}</h4>
      <p className="fw-hint">{t('جریان نقدی منفی حقوق صاحبان سهام بر اساس سهم سرمایه و جریان نقدی مثبت قابل تقسیم بر اساس سهم سود تخصیص داده می‌شود. آورده قراردادی اعلام‌شده فقط برای کنترل نمایش داده می‌شود و دوباره به جریان نقدی اضافه یا از آن کسر نمی‌شود. این جدول، توزیع وجه نقد را نشان می‌دهد و جایگزین صورت سود تقسیمی مصوب یا قرارداد حقوقی شرکا نیست.','Negative equity cash flows are allocated by capital shares; distributable positive cash flow is allocated by profit shares. Declared capital contributions are shown for control only and are not added to or deducted from cash flows again. This table represents cash distributions, not an approved dividend statement or legal JV agreement.')}</p>
      {partnerFinanceResult?.valid?<>
        <div className="fw-kpis">
          <article><small>{t('جریان نقدی کل سهامداران','Total equity cash flow')}</small><b>{money(partnerFinanceResult.totalProjectEquityCashFlow)}</b></article>
          <article><small>{t('وجه نقد تخصیص‌یافته','Cash distributed')}</small><b>{money(partnerFinanceResult.distributedPositiveCashFlow)}</b></article>
          <article><small>{t('وجه نقد نگه‌داشته‌شده در پروژه','Cash retained in project')}</small><b>{money(partnerFinanceResult.retainedPositiveCashFlow)}</b></article>
          <article><small>{t('آورده اعلامی شرکا','Declared partner capital')}</small><b>{money(partnerFinanceResult.totalDeclaredCapitalContribution)}</b></article>
          <article><small>{t('آورده ثبت‌شده در موتور مالی','Scheduled engine equity')}</small><b>{money(partnerFinanceResult.totalScheduledEquityContribution)}</b></article>
          <article><small>{t('درصد جریان مثبت قابل تقسیم','Positive cash flow distributed')}</small><b>{money(partnerFinanceResult.positiveCashFlowDistributionPercent)}%</b></article>
        </div>
        <p className="fw-hint">{t('اختلاف آورده اعلامی شرکا با برنامه آورده ثبت‌شده در موتور مالی: ','Variance between declared partner capital and scheduled engine equity: ')}<b>{money(partnerFinanceResult.declaredCapitalContributionVariance)}</b>. {t('این اختلاف باید پیش از نهایی‌کردن قرارداد مشارکت و گزارش مالی تطبیق داده شود.','Reconcile this difference before finalizing the JV agreement and financial report.')}</p>
        <p className="fw-hint">{t('کنترل تخصیص جریان نقدی؛ اختلاف مانده تخصیص‌یافته و وجه نقد نگه‌داشته‌شده با جریان نقدی کل سهامداران: ','Allocation control; difference between partner allocations plus retained cash and total equity cash flow: ')}<b>{money(partnerFinanceResult.allocationReconciliationVariance)}</b>. {t('این مقدار باید صفر باشد.','This amount must be zero.')}</p>
        <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('شریک','Partner')}</th><th>{t('آورده قراردادی','Declared capital')}</th><th>{t('آورده مورد انتظار بر اساس سهم','Expected capital by share')}</th><th>{t('اختلاف آورده شریک','Partner capital variance')}</th><th>{t('جریان نقدی منفی تخصیص‌یافته','Allocated negative CF')}</th><th>{t('توزیع جریان نقدی مثبت','Positive CF distribution')}</th><th>{t('خالص جریان نقدی شریک','Partner net CF')}</th></tr></thead>
          <tbody>{partnerFinanceResult.rows.map(row=><tr key={row.partnerId}><td>{row.partnerName}</td><td>{money(row.declaredCapitalContribution)}</td><td>{money(row.expectedCapitalContribution)}</td><td>{money(row.capitalContributionVariance)}</td><td>{money(row.negativeCashFlowAllocation)}</td><td>{money(row.positiveCashFlowDistribution)}</td><td>{money(row.netCashFlow)}</td></tr>)}</tbody>
        </table></div>
        <div style={{overflowX:'auto',maxHeight:360}}><table className="fw-table"><thead><tr>
          <th>{t('دوره','Period')}</th><th>{t('تاریخ','Date')}</th><th>{t('جریان نقد سهامداران','Total equity CF')}</th>
          <th>{t('خالص تخصیص به شرکا','Partner net CF')}</th><th>{t('توزیع مثبت به شرکا','Positive distributions')}</th><th>{t('وجه نقد نگه‌داشته‌شده','Retained cash')}</th>
          <th>{t('اختلاف کنترل','Reconciliation variance')}</th>{partnerFinanceResult.rows.map(row=><th key={row.partnerId}>{row.partnerName}</th>)}
        </tr></thead>
          <tbody>{partnerFinanceResult.periods.map((period,index)=><tr key={period.period}>
            <td>{period.period}</td><td>{period.startDate} – {period.endDate}</td><td>{money(period.totalEquityCashFlow)}</td>
            <td>{money(period.partnerNetCashFlow)}</td><td>{money(period.distributedPositiveCashFlow)}</td><td>{money(period.retainedPositiveCashFlow)}</td><td>{money(period.reconciliationVariance)}</td>
            {partnerFinanceResult.rows.map(row=><td key={row.partnerId}>{money(row.periods[index]?.allocatedCashFlow??0)}</td>)}
          </tr>)}</tbody>
        </table></div>
      </>:<ul className="fw-checklist">{(partnerFinanceResult?.warnings??[t('برای تخصیص جریان نقدی شرکا، ابتدا موتور دوره‌ای معتبر را فعال کنید.','Activate a valid periodic finance schedule before allocating partner cash flows.')]).map((warning,index)=><li key={index}>{tr(warning)}</li>)}</ul>}
    </div>}

  </div>
}
