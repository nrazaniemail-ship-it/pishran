import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { listFinancialMethods } from './financialMethodDirectory'
import {
  calculateIntegratedFinance, calculateAssetDepreciationSchedule, calculateSensitivityMatrix,
  calculateFinancialScenarios, buildThreeFinancialStatements, calculateComfarAssetLifecycle,
  type IntegratedFinanceInput, type IntegratedFinanceResult, type IntegratedLoanInput, type DepreciationAssetInput,
  type ComfarDepreciationAssetInput, type ComfarAssetSaleInput,
} from '../steel/financialModel'

type CapexRow = { id: string; name: string; amount: number }
type Asset = DepreciationAssetInput
type Loan = IntegratedLoanInput
type Props = {
  projectId: string
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
  equityPercent: number
  costOfEquity: number
  costOfDebt: number
  taxRate: number
  capexRows: CapexRow[]
  ramp: number[]
  language?: 'fa'|'en'
}
type SavedState = {
  loans: Loan[]
  assets: Asset[]
  equityContributions: number[]
  workingCapitalDays: { raw: number; energy:number; spareParts:number; wip: number; finished: number; receivable: number; cash: number; payable: number }
  workingCapitalBases: { rawMaterials: number; energy:number; spareParts:number; conversion: number; finishedGoods: number; cash: number; payables: number }
  wipCompletion: { material: number; conversion: number }
  taxRates: number[]
  discountMode: 'wacc' | 'manual'
  manualRate: number
  maintenancePercent: number
  salesEscalationPercent: number
  opexEscalationPercent: number
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
  const t=(fa:string,english:string)=>en?english:fa
 const labelEn:Record<string,string>={"عنوان تسهیلات":"Loan Name","نرخ سالانه":"Annual Interest Rate","دوره تنفس اصل (سال)":"Principal Grace Period (Years)","مدت بازپرداخت (سال)":"Repayment Term (Years)","شروع بازپرداخت اصل (سال مدل)":"Principal Repayment Start (Model Year)","روش اقساط":"Repayment Method","سرمایه‌ای شدن بهره تا شروع بازپرداخت":"Capitalise interest until repayment starts","برداشت سالانه (واحد پول پایه)":"Annual Drawdown (Base Currency)","برنامه بازپرداخت همین تسهیلات":"Repayment Schedule for This Loan","حذف تسهیلات":"Remove Loan","افزودن وام":"Add Loan","آورده نقدی سهامدار به تفکیک سال":"Annual Shareholder Equity Contributions","روز موجودی مواد اولیه":"Raw Material Inventory Days","روز موجودی/پوشش هزینه انرژی":"Energy Inventory / Coverage Days","روز موجودی قطعات یدکی":"Spare Parts Inventory Days","مبنای سالانه هزینه انرژی":"Annual Energy Cost Basis","مبنای سالانه قطعات یدکی":"Annual Spare Parts Cost Basis","روز کالای در جریان ساخت":"Work-in-Progress Days","روز محصول نهایی":"Finished Goods Days","روز وصول مطالبات":"Receivable Days","روز حداقل نقد عملیاتی":"Minimum Operating Cash Days","روز پرداخت بدهی تجاری":"Trade Payables Days","مبنای سالانه مواد اولیه":"Annual Raw Material Cost Basis","مبنای سالانه هزینه تبدیل":"Annual Conversion Cost Basis","بهای سالانه محصول ساخته‌شده":"Annual Cost of Finished Goods","هزینه نقدی سالانه برای حداقل نقد":"Annual Cash Cost for Minimum Cash","مبنای سالانه بدهی تجاری":"Annual Trade Payables Cost Basis","تکمیل مواد در جریان ساخت (%)":"WIP Material Completion (%)","تکمیل تبدیل در جریان ساخت (%)":"WIP Conversion Completion (%)","دارایی":"Asset","بهای تمام‌شده":"Asset Cost","ارزش اسقاط":"Residual Value","عمر مفید (سال)":"Useful Life (Years)","شروع استهلاک (سال مدل)":"Depreciation Start (Model Year)","روش":"Method","خط مستقیم":"Straight Line","مانده نزولی":"Declining Balance","نرخ نزولی (%)":"Declining-Balance Rate (%)","نرخ تنزیل":"Discount Rate","نرخ تنزیل دستی (%)":"Manual Discount Rate (%)","CAPEX نگهداری سالانه (% هزینه نقدی)":"Annual Maintenance CAPEX (% of Cash Cost)","سال":"Year","بهره":"Interest","اصل":"Principal","مانده بدهی":"Debt Balance","فروش":"Revenue","زیان انتقالی پایان سال":"Closing Tax Loss Carryforward","سود خالص":"Net Income","جریان نقد پایان سال":"Closing Cash","جمع دارایی‌ها":"Total Assets","بدهی + حقوق مالکانه":"Liabilities + Equity","اختلاف تراز":"Balance Difference","تسهیلات اصلی":"Primary Loan","تسهیلات جدید":"New Loan","دارایی جدید":"New Asset","زمین":"Land","اصل مساوی":"Equal Principal","اقساط مساوی":"Equal Instalments","یکجا در سررسید":"Bullet at Maturity","ساخت":"Construction","بهره‌برداری":"Operation","افزودن دارایی":"Add Asset","حذف دارایی":"Remove Asset","دارایی‌ها و استهلاک":"Assets & Depreciation","برنامه تسهیلات و بدهی":"Loans & Debt Schedule","سرمایه در گردش عملیاتی":"Operating Working Capital","مفروضات مالیاتی سالانه":"Annual Tax Assumptions","تحلیل حساسیت":"Sensitivity Analysis","سناریوهای مالی":"Financial Scenarios","صورت‌های مالی سه‌گانه":"Three Financial Statements","برنامه سالانه جریان نقدی":"Annual Cash Flow Schedule","جریان نقدی در دسترس برای خدمت بدهی":"Cash Flow Available for Debt Service","نسبت پوشش خدمت بدهی":"Debt Service Coverage Ratio","روش استهلاک":"Depreciation Method","موجودی مواد اولیه":"Raw Material Inventory","کالای در جریان ساخت":"Work in Progress","محصول نهایی":"Finished Goods","مطالبات":"Receivables","نقد عملیاتی":"Operating Cash","بدهی تجاری":"Trade Payables","جمع بدهی‌ها و حقوق مالکانه":"Total Liabilities & Equity","درآمد":"Revenue","سود عملیاتی":"Operating Profit","مالیات":"Tax","مانده نقد":"Cash Balance","موجودی نقد":"Cash Balance","بهره نقدی":"Cash Interest","بهره سرمایه‌ای":"Capitalised Interest","اصل بدهی":"Principal","مانده پایان":"Closing Balance","مانده اول":"Opening Balance","برداشت":"Drawdown","سرمایه‌گذاری مجدد":"Reinvestment","سال مدل":"Model Year","هزینه سرمایه‌گذاری ثابت":"Fixed Investment Cost","هزینه نقدی عملیاتی":"Cash Operating Cost","درصد":"Percent","روز":"Days","آورده سال ساخت":"Construction-Year Equity","آورده سهامدار را جدا از برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.":"Enter shareholder equity separately from loan drawdowns. Any funding gap is flagged in the results.","مبنای روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را از چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.":"The day-count basis is 360 days. Enter inventory, collection and payment days from the actual operating cycle. A zero value means no working capital is assigned to that item.","اوج نیاز سرمایه در گردش":"Peak Working Capital Requirement","کسری منابع":"Funding Gap","مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.":"Working-capital cost bases are intentionally not auto-allocated from total OPEX. Enter actual raw-material, conversion, finished-goods, cash and credit-purchase bases to avoid arbitrary assumptions.","اوج نیاز سرمایه در گردش: ":"Peak Working Capital Requirement: ","همگام‌سازی دارایی‌ها از CAPEX":"Sync Assets from CAPEX","جمع استهلاک سالانه (به ترتیب سال مدل)":"Total Annual Depreciation (by Model Year)","دستی":"Manual","نرخ مالیات سال":"Tax Rate — Year","NPV پروژه":"Project NPV","IRR پروژه":"Project IRR","NPV سهامدار":"Equity NPV","IRR سهامدار":"Equity IRR","اوج سرمایه در گردش":"Peak Working Capital","کل برداشت وام":"Total Loan Drawdown","کل آورده":"Total Equity Contribution","جدول سالانه خدمت بدهی":"Annual Debt Service Schedule","CFADS":"CFADS","ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت فروش را نشان می‌دهند. مقادیر NPV پروژه با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.":"Rows represent volume/capacity changes and columns represent selling-price changes. Project NPV is recalculated using the same loan, tax and working-capital schedules.","حجم \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ قیمت":"Volume \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ Price","بدبینانه":"Downside","مبنا":"Base Case","خوش‌بینانه":"Upside","ترازهای منطبق: ":"Balanced Statements: ","از":"of","دوره":"Period","صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.":"The statements are built from one cash-flow set and the asset/debt schedules; no artificial balancing plug is added to equity. Any balance difference is flagged for review of CAPEX, equity, debt or working-capital classification. This version does not yet cover detailed accounting items such as VAT, dividends, tax receivables/payables, revaluation or multi-currency postings.","دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.":"Sync assets from CAPEX. Land is not depreciated by default. Depreciation method (straight-line or declining-balance), useful life, residual value and start year are set independently for each asset. Tax-loss carry-forward is applied by the calculation engine.","جدول دوره‌ای سرمایه در گردش":"Periodic Working Capital Schedule","سرمایه در گردش خالص":"Net Working Capital","چرخه تبدیل وجه نقد":"Cash Conversion Cycle","سال اول":"Year 1","سال آخر":"Final Year","سناریوهای خوش‌بینانه و بدبینانه":"Upside & Downside Scenarios","سناریوی پایه":"Base Case","سناریوی بدبینانه":"Downside Case","سناریوی خوش‌بینانه":"Upside Case","سه صورت مالی":"Three Financial Statements","ترازنامه":"Balance Sheet","صورت سود و زیان":"Income Statement","صورت جریان وجوه نقد":"Cash Flow Statement","ترازهای منطبق":"Balanced Periods","مالیات و انتقال زیان":"Tax & Loss Carryforward","زیان انتقالی":"Tax Loss Carryforward","جمع دارایی‌های ثابت":"Total Fixed Assets","سرمایه‌گذاری در دارایی":"Asset Investment","سرمایه در گردش اوج":"Peak Working Capital","سال اوج نیاز":"Peak Requirement Year","برداشت سالانه":"Annual Drawdown","آورده نقدی سهامدار":"Shareholder Cash Contribution","واحد پول پایه":"Base Currency","هزینه‌های سرمایه‌ای":"Capital Expenditure","هزینه‌های عملیاتی":"Operating Expenditure","هزینه خدمت بدهی":"Debt Service Cost","عمر مفید":"Useful Life","سرمایه در گردش":"Working Capital","مواد اولیه":"Raw Materials","هزینه تبدیل":"Conversion Cost","محصول ساخته‌شده":"Finished Goods","حداقل نقد عملیاتی":"Minimum Operating Cash","نرخ مالیات":"Tax Rate","مواد":"Materials","محصول":"Finished Goods","پرداختنی":"Payables","نیاز":"Requirement","تکمیل اولیه":"Initially Complete","نیازمند تکمیل":"Completion Required","نامعتبر":"Invalid","کسری نقدینگی":"Funding Shortfall","جمع‌بندی سه صورت مالی":"Three-Statement Reconciliation"}
  const tr=(v:string, english?:string)=>en?(english??labelEn[v]??v):v
  const loanMethodEn:Record<string,string>={'equal-principal':'Equal Principal','annuity':'Equal Instalments','bullet':'Bullet at Maturity'}
  const years = Math.max(1, Math.min(60, Math.ceil(props.constructionYears) + Math.ceil(props.operatingYears)))
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
    loans:[{id:'loan-1',label:'تسهیلات اصلی و سرمایه در گردش',drawdowns:initialCapexSchedule.map((v,i)=>v*initialDebtShare+(i===construction?Math.max(0,props.initialWorkingCapital??0)*initialDebtShare:0)),annualRate:props.costOfDebt,graceYears:0,termYears:Math.max(1,Math.min(opYears,props.loanTermYears??opYears)),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}],
    assets:props.depreciationAssets??props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20})), equityContributions:initialCapexSchedule.map((v,i)=>v*Math.max(0,Math.min(100,props.equityPercent))/100+(i===construction?Math.max(0,props.initialWorkingCapital??0)*Math.max(0,Math.min(100,props.equityPercent))/100:0)),
    workingCapitalDays:props.workingCapitalDefaults?.days??{raw:0,energy:0,spareParts:0,wip:0,finished:0,receivable:0,cash:0,payable:0},
    workingCapitalBases:props.workingCapitalDefaults?.bases??{rawMaterials:0,energy:0,spareParts:0,conversion:0,finishedGoods:0,cash:0,payables:0},
    wipCompletion:props.workingCapitalDefaults?.wipCompletion??{material:0,conversion:0},taxRates:Array(years).fill(props.taxRate),
    discountMode:props.initialDiscountMode??'wacc',manualRate:props.initialManualRate??props.costOfEquity,maintenancePercent:0,salesEscalationPercent:0,opexEscalationPercent:0
  }))
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{let alive=true;localStore.get<SavedState>(storageKey).then(saved=>{if(alive){if(saved)setState({...state,...saved});setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{alive=false}},[storageKey])
  useEffect(()=>{if(loaded)void localStore.set(storageKey,state)},[loaded,storageKey,state])

  const capexSchedule = activeFixedInvestmentSchedule
  const updateLoan=(id:string,patch:Partial<Loan>)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,...patch}:l)}))
  const updateDraw=(id:string,index:number,value:number)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,drawdowns:l.drawdowns.map((v,i)=>i===index?Math.max(0,value):v)}:l)}))
  const syncAssets=()=>setState(s=>({...s,assets:props.depreciationAssets??props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20}))}))
  const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),label:'تسهیلات جدید',drawdowns:Array(years).fill(0),annualRate:20,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}]}))
  const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی جدید',cost:0,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line',decliningRate:20}]}))

  const depreciation = useMemo(()=>calculateAssetDepreciationSchedule(state.assets.filter(a=>a.cost>0&&!a.name.includes('زمین')),years),[state.assets,years])
  const comfarLifecycle = useMemo(()=>props.comfarDepreciationAssets?.length
    ? calculateComfarAssetLifecycle(props.comfarDepreciationAssets,props.comfarAssetSales??[],years)
    : null,[JSON.stringify(props.comfarDepreciationAssets??[]),JSON.stringify(props.comfarAssetSales??[]),years])
  const depreciationValues = comfarLifecycle
    ? comfarLifecycle.depreciation.periods.map(row=>row.depreciation)
    : props.useFixedInvestmentRegister ? Array(years).fill(0) : depreciation.map(row=>row.depreciation)
  const assetSaleSchedule = comfarLifecycle
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
    dayBasis:360 as const,rawMaterialDays:state.workingCapitalDays.raw,energyDays:state.workingCapitalDays.energy,sparePartsDays:state.workingCapitalDays.spareParts,workInProgressDays:state.workingCapitalDays.wip,
    workInProgressMaterialCompletionPercent:state.wipCompletion.material,workInProgressConversionCompletionPercent:state.wipCompletion.conversion,
    finishedGoodsDays:state.workingCapitalDays.finished,receivableDays:state.workingCapitalDays.receivable,
    cashDays:state.workingCapitalDays.cash,payableDays:state.workingCapitalDays.payable,
    annualRawMaterialCost:state.workingCapitalBases.rawMaterials,annualEnergyCost:state.workingCapitalBases.energy,annualSparePartsCost:state.workingCapitalBases.spareParts,
    annualPayablesCost:state.workingCapitalBases.payables,
    annualConversionCost:state.workingCapitalBases.conversion,
    annualFinishedGoodsCost:state.workingCapitalBases.finishedGoods,
    annualRevenue:props.fullCapacityRevenue,annualCashOperatingCost:state.workingCapitalBases.cash
  }),[state.workingCapitalDays,state.workingCapitalBases,state.wipCompletion,props.fullCapacityRevenue])
  const equityContributions = state.equityContributions.length===years ? state.equityContributions : Array(years).fill(0)
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
  useEffect(()=>{props.onResult?.(result)},[result,props.onResult])
  const statements=useMemo(()=>buildThreeFinancialStatements(result.years),[result.years])
  const sensitivity=useMemo(()=>calculateSensitivityMatrix(input,[-20,-10,0,10,20],[-20,-10,0,10,20]),[JSON.stringify(input)])
  const scenarios=useMemo(()=>calculateFinancialScenarios(input),[JSON.stringify(input)])
  const updateAsset=(id:string,patch:Partial<Asset>)=>setState(s=>({...s,assets:s.assets.map(a=>a.id===id?{...a,...patch}:a)}))
  const updateDay=(key:keyof SavedState['workingCapitalDays'],value:number)=>setState(s=>({...s,workingCapitalDays:{...s.workingCapitalDays,[key]:Math.max(0,value)}}))
  const setEquity=(index:number,value:number)=>setState(s=>({...s,equityContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityContributions[i]??0))}))
  const totalBalanceChecks=statements.filter(r=>r.balanceSheet.reconciled).length

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
      <div className="fw-card"><b>{tr('برنامه بازپرداخت همین تسهیلات')}</b>{(result.loanSchedules[loan.id]??[]).map((r,i)=><div className="fw-validation" key={i}><span>{tr('سال')} {i+1} · برداشت {money(r.drawdown)} · {tr('مانده اول')} {money(r.openingBalance)}</span><b>{tr('بهره نقدی')} {money(r.interestExpense)} · {tr('بهره سرمایه‌ای')} {money(r.capitalizedInterest)} · {tr('اصل')} {money(r.principal)} · {tr('مانده پایان')} {money(r.closingBalance)}</b></div>)}</div><button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/> {tr('حذف تسهیلات')}</button>
    </div>)}
    <button className="secondary-button" onClick={addLoan}><Plus size={14}/> {tr('افزودن وام')}</button>
    <div className="fw-card">
      <h4>{t('آورده نقدی سهامدار به تفکیک سال','Annual Shareholder Equity Contributions')}</h4>
      <div className="fw-grid">{Array.from({length:construction},(_,i)=><label className="fw-field" key={i}><span>{tr('آورده سال ساخت')} {i+1}</span><input type="number" min="0" value={equityContributions[i]??0} onChange={e=>setEquity(i,Number(e.target.value))}/></label>)}</div>
      <p className="fw-hint">{tr('آورده سهامدار را جدا از برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.')}</p>
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
    {!props.useFixedInvestmentRegister&&<>
          <button className="secondary-button" onClick={syncAssets}><RefreshCw size={14}/> {tr('همگام‌سازی دارایی‌ها از CAPEX')}</button>
          {comfarLifecycle&&<div className="fw-validation">
            <span>{tr('وضعیت دفتر دارایی و فروش','Fixed Asset Register & Disposal Status')}</span>
            <b>{comfarLifecycle.valid&&!(props.comfarDepreciationWarnings?.length)?tr('معتبر','Valid'):tr('نیازمند اصلاح','Requires review')}</b>
            {comfarLifecycle.warnings.concat(props.comfarDepreciationWarnings??[]).map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
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
    {props.useFixedInvestmentRegister&&comfarLifecycle&&<div className="fw-validation"><span>{tr('جمع استهلاک سالانه از دفتر دارایی','Annual Depreciation from Fixed Investment Register')}</span><b>{depreciationValues.map(value=>money(value)).join(' · ')}</b></div>}
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
    <div className="fw-result">{tr('ترازهای منطبق: ')}<b>{totalBalanceChecks} {tr('از')} {statements.length}</b> {tr('دوره')}</div>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{tr('سال')}</th><th>{tr('فروش')}</th><th>EBIT</th><th>{tr('زیان انتقالی پایان سال')}</th><th>{tr('سود خالص')}</th><th>{tr('جریان نقد پایان سال')}</th><th>{tr('جمع دارایی‌ها')}</th><th>{tr('بدهی + حقوق مالکانه')}</th><th>{tr('اختلاف تراز')}</th></tr></thead><tbody>{statements.map(r=><tr key={r.year}><td>{r.year}</td><td>{money(r.incomeStatement.revenue)}</td><td>{money(r.incomeStatement.ebit)}</td><td>{money(r.incomeStatement.taxLossCarryForward)}</td><td>{money(r.incomeStatement.netIncome)}</td><td>{money(r.cashFlowStatement.closingCash)}</td><td>{money(r.balanceSheet.totalAssets)}</td><td>{money(r.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(r.balanceSheet.balanceDifference)} {r.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody></table></div>
    <p className="fw-hint">{tr('صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.')}</p>
  </div>
}
