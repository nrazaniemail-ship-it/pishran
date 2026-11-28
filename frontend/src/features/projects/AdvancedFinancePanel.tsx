import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { allocateJointVentureCashFlows, type JointVenturePartner, type PartnerFinanceResult } from './partnerFinance'
import { listFinancialMethods } from './financialMethodDirectory'
import type { ProjectCalendarPeriod, ProjectPeriodFrequency, ProjectDiscountConvention, OpeningCurrentAccounts, ProjectFoundation } from './projectFoundation'
import type { WorkingCapitalComponentFormDraft } from './projectModelFormDrafts'
import { buildWorkingCapitalScheduleFromDrafts, bindWorkingCapitalDraftsToPeriodicFinance } from './workingCapitalDraftIntegration'
import { buildProductOperatingSchedule } from './productOperatingSchedule'
import { buildAbnormalWasteAccountingPostings, canPersistStageAccountingPostings, reconcileInventoryThreeWay, reconcileInventoryReference, reconcileStageInventoryMovements } from './inventoryControlLedgers'
import { loadStageInventoryAccountingPostings, persistStageInventoryAccountingPostings, type PersistedStageInventoryAccountingPosting } from './stageInventoryAccountingStore'
import StageInventoryCorrectionsPanel from './StageInventoryCorrectionsPanel'
import { buildCppCpsTraceLedger, type CppCpsTraceItem, type CppCpsTraceLedger } from './cppCpsCostTraceability'
import { applyStageJournalCorrectionsToProductSchedule, bindCppCpsTraceLedgerToProductSchedule, bindFinishedGoodsInventoryToWorkingCapital } from './cppCpsScheduleIntegration'
import type { ProjectModelFinancialFormDrafts, ProjectTaxFormDraft, SalesTaxLedgerFormDraft, ValueAddedPeriodFormDraft } from './projectModelFormDrafts'
import { buildComfarValueAddedAnalysis, type ValueAddedAnalysisResult, type ValueAddedInputItem, type ValueAddedInvestmentItem } from './projectValueAddedAnalysis'
import { buildSalesTaxLedger, bindSalesTaxLedgerToWorkingCapital, type SalesTaxInputCreditEntry, type SalesTaxOutputEntry, type SalesTaxSettlementEntry, type SalesTaxLedgerResult } from './salesTaxLedger'
import { buildProjectTaxDraftSchedule } from './projectTaxDraftIntegration'
import { buildProjectLoanDraftIntegration } from './projectLoanDraftIntegration'
import type { LoanFacilityFormDraft } from './projectModelFormDrafts'
import { calculateOperatingCycleWorkingCapital, calculateWorkingCapitalTurnoverCoefficient, calculateWorkingCapitalDaysCoverageFromTurnover } from '../steel/financialModel'
import { allocateAnnualFlowsToPeriods, calculateIntegratedPeriodicFinance, buildPeriodicThreeFinancialStatements, fiscalYearIndexForPeriod, calculatePeriodicNpv, calculatePeriodicSensitivityMatrix, calculatePeriodicFinancialScenarios, type PeriodicProjectFinanceResult, type PeriodicProjectFinanceInput, type PeriodicLoanInput, type PeriodicFinancialScenarioSet, type PeriodicSensitivityCell } from '../steel/periodicFinancialEngine'
import {
  calculateIntegratedFinance, calculateAssetDepreciationSchedule,
  calculateOneWaySensitivity, buildThreeFinancialStatements, type SensitivityCell, calculateComfarAssetLifecycle,
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
  /** Additional terminal / liquidation periods that are not operating years. */
  terminalPeriods?: number
  recoverTerminalWorkingCapital?: boolean
  periodOtherIncomeByPeriod?: number[]
  periodOtherIncomeSourceReference?: string
  capacity: number
  fullCapacityRevenue: number
  fullCapacityVariableCashCost: number
  fullCapacityFixedCashCost: number
  fixedInvestment: number
  preOperatingCost: number
  fixedInvestmentSchedule?: number[]
  preOperatingSchedule?: number[]
  initialWorkingCapital?: number
  openingWorkingCapitalBalance?: number
  openingCashBalance?: number
  openingDebtBalance?: number
  openingFixedAssetsNetBookValue?: number
  openingPaidInCapital?: number
  openingRetainedEarnings?: number
  openingGrants?: number
  openingCurrentAccounts?: OpeningCurrentAccounts
  workingCapitalDrafts?: WorkingCapitalComponentFormDraft[]
  /** True when the imported aggregate inventory balance already includes finished goods. */
  workingCapitalIncludesFinishedGoods?: boolean
  productFinancialDrafts?: Pick<ProjectModelFinancialFormDrafts, 'sales' | 'productionCosts'> & Partial<Pick<ProjectModelFinancialFormDrafts, 'wasteLedgerEntries' | 'productionTransfers' | 'inventoryReferenceBenchmarks' | 'costCentres' | 'costCentreInventoryMovements' | 'inventoryStageTransfers'>>
  cppCpsTraceItems?: CppCpsTraceItem[]
  onCppCpsTraceLedger?: (ledger: CppCpsTraceLedger) => void
  onEditFinancialForms?: () => void
  taxDraft?: ProjectTaxFormDraft
  salesTaxLedgerDraft?: SalesTaxLedgerFormDraft
  onSalesTaxLedgerResult?: (result:SalesTaxLedgerResult|null)=>void
  valueAddedAnalysisEnabled?: boolean
  valueAddedPeriodDrafts?: ValueAddedPeriodFormDraft[]
  economicDiscountRatePercent?: number | null
  economicDiscountRateSourceReference?: string
  economicDiscountRateSourceVerified?: boolean
  onValueAddedAnalysisResult?: (result:ValueAddedAnalysisResult|null)=>void
  loanDrafts?: LoanFacilityFormDraft[]
  projectFoundation?: ProjectFoundation
  initialWorkingCapitalEquityContribution?: number
  initialEquityContributions?: number[]
  initialLoanRatePercent?: number
  initialRepaymentMethod?: Loan['repaymentMethod']
  loanTermYears?: number
  depreciationAssets?: Asset[]
  comfarDepreciationAssets?: ComfarDepreciationAssetInput[]
  comfarDepreciationSchedule?: number[]
  comfarAssetSales?: ComfarAssetSaleInput[]
  comfarDepreciationWarnings?: string[]
  useFixedInvestmentRegister?: boolean
  workingCapitalDefaults?: { days: { raw:number; factorySupplies?:number; utilities?:number; energy:number; spareParts:number; wip:number; finished:number; receivable:number; cash:number; payable:number }; bases: { rawMaterials:number; factorySupplies?:number; utilities?:number; energy:number; spareParts:number; conversion:number; finishedGoods:number; cash:number; payables:number }; wipCompletion?: { material:number; conversion:number } }
  referenceVersion?: string
  initialDiscountMode?: 'wacc'|'manual'
  initialManualRate?: number
  mirrFinanceRate?: number
  mirrReinvestmentRate?: number
  onResult?: (result:IntegratedFinanceResult)=>void
  onSensitivity?: (analysis:OneWaySensitivityAnalysis)=>void
  onScenarioAnalysis?: (matrix:PeriodicSensitivityCell[][], scenarios:PeriodicFinancialScenarioSet|null)=>void
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
  /** Fingerprint of the report-derived opening schedule; keeps user edits while allowing one-time source migration. */
  equityContributionSourceFingerprint?: string
  equityWorkingCapitalContributions: number[]
  workingCapitalDays: { raw: number; factorySupplies:number; utilities:number; energy:number; spareParts:number; wip: number; finished: number; receivable: number; cash: number; payable: number }
  workingCapitalBases: { rawMaterials: number; factorySupplies:number; utilities:number; energy:number; spareParts:number; conversion: number; finishedGoods: number; cash: number; payables: number }
  shortTermDepositSharePercent?: number
  shortTermDepositRatePercent?: number
  wipCompletion: { material: number; conversion: number }
  taxRates: number[]
  discountMode: 'wacc' | 'manual'
  manualRate: number
  maintenancePercent: number
  salesEscalationPercent: number
  opexEscalationPercent: number
  periodTaxRates?: number[]
  periodTaxRateDates?: string[]
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
 const labelEn:Record<string,string>={"عنوان تسهیلات":"Loan Name","نرخ سالانه":"Annual Interest Rate","دوره تنفس اصل (سال)":"Principal Grace Period (Years)","مدت بازپرداخت (سال)":"Repayment Term (Years)","شروع بازپرداخت اصل (سال مدل)":"Principal Repayment Start (Model Year)","روش اقساط":"Repayment Method","سرمایه‌ای شدن بهره تا شروع بازپرداخت":"Capitalise interest until repayment starts","برداشت سالانه (واحد پول پایه)":"Annual Drawdown (Base Currency)","برنامه بازپرداخت همین تسهیلات":"Repayment Schedule for This Loan","حذف تسهیلات":"Remove Loan","افزودن وام":"Add Loan","آورده نقدی سهامدار به تفکیک سال":"Annual Shareholder Equity Contributions","روز موجودی مواد اولیه":"Raw Material Inventory Days","روز موجودی ملزومات کارخانه":"Factory Supplies Inventory Days","روز موجودی اقلام خدماتی":"Utilities Inventory Days","روز موجودی/پوشش هزینه انرژی":"Energy Inventory / Coverage Days","روز موجودی قطعات یدکی":"Spare Parts Inventory Days","مبنای سالانه هزینه انرژی":"Annual Energy Cost Basis","مبنای سالانه قطعات یدکی":"Annual Spare Parts Cost Basis","روز کالای در جریان ساخت":"Work-in-Progress Days","روز محصول نهایی":"Finished Goods Days","روز وصول مطالبات":"Receivable Days","روز حداقل نقد عملیاتی":"Minimum Operating Cash Days","سهم سپرده کوتاه‌مدت از نقدینگی (%)":"Short-term deposits as share of cash (%)","نرخ سود سپرده کوتاه‌مدت (%)":"Short-term deposit interest rate (%)","روز پرداخت بدهی تجاری":"Trade Payables Days","مبنای سالانه مواد اولیه":"Annual Raw Material Cost Basis","مبنای سالانه ملزومات کارخانه":"Annual Factory Supplies Cost Basis","مبنای سالانه اقلام خدماتی":"Annual Utilities Cost Basis","مبنای سالانه هزینه تبدیل":"Annual Conversion Cost Basis","بهای سالانه محصول ساخته‌شده":"Annual Cost of Finished Goods","هزینه نقدی سالانه برای حداقل نقد":"Annual Cash Cost for Minimum Cash","مبنای سالانه بدهی تجاری":"Annual Trade Payables Cost Basis","تکمیل مواد در جریان ساخت (%)":"WIP Material Completion (%)","تکمیل تبدیل در جریان ساخت (%)":"WIP Conversion Completion (%)","دارایی":"Asset","بهای تمام‌شده":"Asset Cost","ارزش اسقاط":"Residual Value","عمر مفید (سال)":"Useful Life (Years)","شروع استهلاک (سال مدل)":"Depreciation Start (Model Year)","روش":"Method","خط مستقیم":"Straight Line","مانده نزولی":"Declining Balance","نرخ نزولی (%)":"Declining-Balance Rate (%)","نرخ تنزیل":"Discount Rate","نرخ تنزیل دستی (%)":"Manual Discount Rate (%)","CAPEX نگهداری سالانه (% هزینه نقدی)":"Annual Maintenance CAPEX (% of Cash Cost)","سال":"Year","بهره":"Interest","اصل":"Principal","مانده بدهی":"Debt Balance","فروش":"Revenue","زیان انتقالی پایان سال":"Closing Tax Loss Carryforward","سود خالص":"Net Income","جریان نقد پایان سال":"Closing Cash","جمع دارایی‌ها":"Total Assets","بدهی + حقوق مالکانه":"Liabilities + Equity","اختلاف تراز":"Balance Difference","تسهیلات اصلی":"Primary Loan","تسهیلات جدید":"New Loan","دارایی جدید":"New Asset","زمین":"Land","اصل مساوی":"Equal Principal","اقساط مساوی":"Equal Instalments","یکجا در سررسید":"Bullet at Maturity","ساخت":"Construction","بهره‌برداری":"Operation","افزودن دارایی":"Add Asset","حذف دارایی":"Remove Asset","دارایی‌ها و استهلاک":"Assets & Depreciation","برنامه تسهیلات و بدهی":"Loans & Debt Schedule","سرمایه در گردش عملیاتی":"Operating Working Capital","مفروضات مالیاتی سالانه":"Annual Tax Assumptions","تحلیل حساسیت":"Sensitivity Analysis","سناریوهای مالی":"Financial Scenarios","صورت‌های مالی سه‌گانه":"Three Financial Statements","برنامه سالانه جریان نقدی":"Annual Cash Flow Schedule","جریان نقدی در دسترس برای خدمت بدهی":"Cash Flow Available for Debt Service","نسبت پوشش خدمت بدهی":"Debt Service Coverage Ratio","روش استهلاک":"Depreciation Method","موجودی مواد اولیه":"Raw Material Inventory","کالای در جریان ساخت":"Work in Progress","محصول نهایی":"Finished Goods","مطالبات":"Receivables","نقد عملیاتی":"Operating Cash","بدهی تجاری":"Trade Payables","جمع بدهی‌ها و حقوق مالکانه":"Total Liabilities & Equity","درآمد":"Revenue","سود عملیاتی":"Operating Profit","مالیات":"Tax","مانده نقد":"Cash Balance","موجودی نقد":"Cash Balance","بهره نقدی":"Cash Interest","بهره سرمایه‌ای":"Capitalised Interest","اصل بدهی":"Principal","مانده پایان":"Closing Balance","مانده اول":"Opening Balance","برداشت":"Drawdown","سرمایه‌گذاری مجدد":"Reinvestment","سال مدل":"Model Year","هزینه سرمایه‌گذاری ثابت":"Fixed Investment Cost","هزینه نقدی عملیاتی":"Cash Operating Cost","درصد":"Percent","روز":"Days","آورده سال ساخت":"Construction-Year Equity","آورده سرمایه در گردش سال بهره‌برداری":"Operating-Year Shareholder Working-Capital Contribution","آورده سهامدار را جدا از برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.":"Enter shareholder equity separately from loan drawdowns. Any funding gap is flagged in the results.","مبنای روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را از چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.":"The day-count basis is 360 days. Enter inventory, collection and payment days from the actual operating cycle. A zero value means no working capital is assigned to that item.","اوج نیاز سرمایه در گردش":"Peak Working Capital Requirement","کسری منابع":"Funding Gap","مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.":"Working-capital cost bases are intentionally not auto-allocated from total OPEX. Enter actual raw-material, conversion, finished-goods, cash and credit-purchase bases to avoid arbitrary assumptions.","اوج نیاز سرمایه در گردش: ":"Peak Working Capital Requirement: ","همگام‌سازی دارایی‌ها از CAPEX":"Sync Assets from CAPEX","جمع استهلاک سالانه (به ترتیب سال مدل)":"Total Annual Depreciation (by Model Year)","دستی":"Manual","نرخ مالیات سال":"Tax Rate — Year","NPV پروژه":"Project NPV","IRR پروژه":"Project IRR","NPV سهامدار":"Equity NPV","IRR سهامدار":"Equity IRR","اوج سرمایه در گردش":"Peak Working Capital","کل برداشت وام":"Total Loan Drawdown","کل آورده":"Total Equity Contribution","جدول سالانه خدمت بدهی":"Annual Debt Service Schedule","CFADS":"CFADS","ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت فروش را نشان می‌دهند. مقادیر NPV پروژه با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.":"Rows represent volume/capacity changes and columns represent selling-price changes. Project NPV is recalculated using the same loan, tax and working-capital schedules.","حجم \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ قیمت":"Volume \\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\ Price","بدبینانه":"Downside","مبنا":"Base Case","خوش‌بینانه":"Upside","ترازهای منطبق: ":"Balanced Statements: ","از":"of","دوره":"Period","صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. مانده خالص مالیات غیرمستقیم در سرمایه در گردش لحاظ و در دفتر جداگانه افشا می‌شود؛ تفکیک کامل سایر مطالبات/بدهی‌های مالیاتی، سود تقسیمی، تجدید ارزیابی و ثبت‌های چندارزی همچنان خارج از پوشش است.":"The statements are built from one cash-flow set and the asset/debt schedules; no artificial balancing plug is added to equity. The net indirect-tax balance is included in working capital and disclosed in a separate ledger. Other detailed tax receivables/payables, dividends, revaluation and multi-currency postings remain outside current coverage.","دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.":"Sync assets from CAPEX. Land is not depreciated by default. Depreciation method (straight-line or declining-balance), useful life, residual value and start year are set independently for each asset. Tax-loss carry-forward is applied by the calculation engine.","جدول دوره‌ای سرمایه در گردش":"Periodic Working Capital Schedule","سرمایه در گردش خالص":"Net Working Capital","چرخه تبدیل وجه نقد":"Cash Conversion Cycle","سال اول":"Year 1","سال آخر":"Final Year","سناریوهای خوش‌بینانه و بدبینانه":"Upside & Downside Scenarios","سناریوی پایه":"Base Case","سناریوی بدبینانه":"Downside Case","سناریوی خوش‌بینانه":"Upside Case","سه صورت مالی":"Three Financial Statements","ترازنامه":"Balance Sheet","صورت سود و زیان":"Income Statement","صورت جریان وجوه نقد":"Cash Flow Statement","ترازهای منطبق":"Balanced Periods","مالیات و انتقال زیان":"Tax & Loss Carryforward","زیان انتقالی":"Tax Loss Carryforward","جمع دارایی‌های ثابت":"Total Fixed Assets","سرمایه‌گذاری در دارایی":"Asset Investment","سرمایه در گردش اوج":"Peak Working Capital","سال اوج نیاز":"Peak Requirement Year","برداشت سالانه":"Annual Drawdown","آورده نقدی سهامدار":"Shareholder Cash Contribution","واحد پول پایه":"Base Currency","هزینه‌های سرمایه‌ای":"Capital Expenditure","هزینه‌های عملیاتی":"Operating Expenditure","هزینه خدمت بدهی":"Debt Service Cost","عمر مفید":"Useful Life","سرمایه در گردش":"Working Capital","مواد اولیه":"Raw Materials","هزینه تبدیل":"Conversion Cost","محصول ساخته‌شده":"Finished Goods","حداقل نقد عملیاتی":"Minimum Operating Cash","نرخ مالیات":"Tax Rate","مواد":"Materials","محصول":"Finished Goods","پرداختنی":"Payables","نیاز":"Requirement","تکمیل اولیه":"Initially Complete","نیازمند تکمیل":"Completion Required","نامعتبر":"Invalid","کسری نقدینگی":"Funding Shortfall","جمع‌بندی سه صورت مالی":"Three-Statement Reconciliation"}
  const tr=(v:string, english?:string)=>en?(english??labelEn[v]??v):v
  const loanMethodEn:Record<string,string>={'equal-principal':'Equal Principal','annuity':'Equal Instalments','bullet':'Bullet at Maturity'}
  const construction = Math.max(1, Math.ceil(props.constructionYears))
  const opYears = Math.max(1, Math.ceil(props.operatingYears))
  const terminalPeriods = Math.max(0, Math.floor(props.terminalPeriods??0))
  const years = Math.max(1, Math.min(60, construction + opYears + terminalPeriods))
  const periodsPerYear: 1|2|4|12 = props.periodFrequency==='monthly'?12:props.periodFrequency==='quarterly'?4:props.periodFrequency==='semiannual'?2:1
  const storageKey = 'feasibility:advanced-finance:' + props.projectId + (props.referenceVersion ? ':' + props.referenceVersion : '')
  const fallbackFixedInvestmentSchedule = Array.from({length:years},(_,i)=>i<construction?props.fixedInvestment/construction:0)
  const fallbackPreOperatingSchedule = Array.from({length:years},(_,i)=>i<construction?props.preOperatingCost/construction:0)
  const activeFixedInvestmentSchedule = props.fixedInvestmentSchedule?.length===years ? props.fixedInvestmentSchedule : fallbackFixedInvestmentSchedule
  const activePreOperatingSchedule = props.preOperatingSchedule?.length===years ? props.preOperatingSchedule : fallbackPreOperatingSchedule
  const initialCapexSchedule = activeFixedInvestmentSchedule.map((amount,i)=>amount+activePreOperatingSchedule[i])
  const initialEquityContributionFingerprint = props.initialEquityContributions?.length===years && props.initialEquityContributions.every(value=>Number.isFinite(value)&&value>=0)
    ? JSON.stringify(props.initialEquityContributions) : ''
  const initialDebtShare = Math.max(0,100-Math.max(0,Math.min(100,props.equityPercent)))/100
  const [state,setState] = useState<SavedState>(() => ({
    loans:[{id:'loan-1',label:'تسهیلات بلندمدت سرمایه ثابت',drawdowns:initialCapexSchedule.map(v=>v*initialDebtShare),drawdownMode:'annual-day-weighted',annualRate:props.initialLoanRatePercent??props.costOfDebt,graceYears:0,termYears:Math.max(1,Math.min(opYears,props.loanTermYears??opYears)),repaymentStartYear:construction+1,repaymentMethod:props.initialRepaymentMethod??'equal-principal',capitalizeInterest:true}],
    assets:props.depreciationAssets??[], equityContributions:props.initialEquityContributions?.length===years?[...props.initialEquityContributions]:initialCapexSchedule.map(v=>v*Math.max(0,Math.min(100,props.equityPercent))/100), equityContributionSourceFingerprint:initialEquityContributionFingerprint||undefined, equityWorkingCapitalContributions:Array.from({length:years},(_,i)=>i===construction?Math.max(0,props.initialWorkingCapitalEquityContribution??0):0),fundingStructureVersion:2,
    workingCapitalDays:{raw:0,factorySupplies:0,utilities:0,energy:0,spareParts:0,wip:0,finished:0,receivable:0,cash:0,payable:0,...props.workingCapitalDefaults?.days},
    workingCapitalBases:{rawMaterials:0,factorySupplies:0,utilities:0,energy:0,spareParts:0,conversion:0,finishedGoods:0,cash:0,payables:0,...props.workingCapitalDefaults?.bases},
    wipCompletion:props.workingCapitalDefaults?.wipCompletion??{material:0,conversion:0},shortTermDepositSharePercent:0,shortTermDepositRatePercent:0,taxRates:Array(years).fill(props.taxRate),
    discountMode:props.initialDiscountMode??'wacc',manualRate:props.initialManualRate??props.costOfEquity,maintenancePercent:0,salesEscalationPercent:0,opexEscalationPercent:0
  }))
  const [loaded,setLoaded]=useState(false)
  const [stagePostingPersistence,setStagePostingPersistence]=useState<{status:'idle'|'saving'|'saved'|'error';count:number;error:string}>({status:'idle',count:0,error:''})
  const [stageJournalEntries,setStageJournalEntries]=useState<PersistedStageInventoryAccountingPosting[]>([])
  const [stageJournalLoaded,setStageJournalLoaded]=useState(false)
  useEffect(()=>{
    let active=true
    setStageJournalLoaded(false)
    loadStageInventoryAccountingPostings(props.projectId)
      .then(store=>{if(active){setStageJournalEntries(store.entries);setStageJournalLoaded(true)}})
      .catch(error=>{if(active){setStagePostingPersistence({status:'error',count:0,error:error instanceof Error?error.message:String(error)})}})
    return()=>{active=false}
  },[props.projectId])

  useEffect(()=>{let alive=true;localStore.get<SavedState>(storageKey).then(saved=>{if(alive){if(saved){const restored={...state,...saved,workingCapitalDays:{...state.workingCapitalDays,...saved.workingCapitalDays},workingCapitalBases:{...state.workingCapitalBases,...saved.workingCapitalBases}};if(initialEquityContributionFingerprint && saved.equityContributionSourceFingerprint!==initialEquityContributionFingerprint){restored.equityContributions=[...(props.initialEquityContributions??[])];restored.equityContributionSourceFingerprint=initialEquityContributionFingerprint}if(!saved.equityWorkingCapitalContributions){const legacyWorkingCapitalEquity=Math.max(0,props.initialWorkingCapital??0)*Math.max(0,Math.min(100,props.equityPercent))/100;const legacyContribution=restored.equityContributions[construction]??0;const matchesLegacyDefault=Math.abs(legacyContribution-legacyWorkingCapitalEquity)<0.01;restored.equityWorkingCapitalContributions=Array(years).fill(0);if(matchesLegacyDefault){restored.equityContributions=restored.equityContributions.map((value,index)=>index===construction?Math.max(0,value-legacyWorkingCapitalEquity):value);restored.equityWorkingCapitalContributions=Array.from({length:years},(_,index)=>index===construction?Math.max(0,props.initialWorkingCapitalEquityContribution??legacyWorkingCapitalEquity):0)}}if((saved.fundingStructureVersion??0)<2){const legacyDrawdowns=initialCapexSchedule.map((value,index)=>value*initialDebtShare+(index===construction?Math.max(0,props.initialWorkingCapital??0)*initialDebtShare:0));restored.loans=restored.loans.map(loan=>{const untouchedLegacyDefault=loan.label==='تسهیلات اصلی و سرمایه در گردش'&&loan.drawdowns.length===years&&loan.drawdowns.every((value,index)=>Math.abs(value-legacyDrawdowns[index])<0.01)&&Math.abs(loan.annualRate-props.costOfDebt)<0.0001&&loan.repaymentMethod==='equal-principal';return untouchedLegacyDefault?{...loan,label:'تسهیلات بلندمدت سرمایه ثابت',drawdowns:initialCapexSchedule.map(value=>value*initialDebtShare),annualRate:props.initialLoanRatePercent??props.costOfDebt,repaymentMethod:props.initialRepaymentMethod??'equal-principal'}:loan});if(props.initialWorkingCapitalEquityContribution&&restored.equityWorkingCapitalContributions.every(value=>value===0)){restored.equityWorkingCapitalContributions=Array.from({length:years},(_,index)=>index===construction?props.initialWorkingCapitalEquityContribution!:0)}restored.fundingStructureVersion=2}setState(restored)}setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{alive=false}},[storageKey,initialEquityContributionFingerprint])
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
  const syncAssets=()=>setState(s=>({...s,assets:props.depreciationAssets?.length?props.depreciationAssets:s.assets}))
  const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),label:'تسهیلات جدید',drawdowns:Array(years).fill(0),drawdownMode:'annual-day-weighted',annualRate:20,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}]}))
  const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی جدید',cost:0,residualValue:0,usefulLife:0,startYear:construction+1,method:'straight-line',decliningRate:0}]}))

  const depreciation = useMemo(()=>calculateAssetDepreciationSchedule(state.assets.filter(a=>a.cost>0&&!a.name.includes('زمین')),years),[state.assets,years])
  const comfarCalendarLifecycle = useMemo(()=>props.comfarDepreciationAssets?.length && projectPeriods.length && props.fiscalYearStartMonth!=null
    ? calculateComfarCalendarAssetLifecycle(props.comfarDepreciationAssets,props.comfarAssetSales??[],projectPeriods,props.fiscalYearStartMonth)
    : null,[JSON.stringify(props.comfarDepreciationAssets??[]),JSON.stringify(props.comfarAssetSales??[]),JSON.stringify(projectPeriods),props.fiscalYearStartMonth])
  const comfarLifecycle = comfarCalendarLifecycle ?? (props.comfarDepreciationAssets?.length
    ? calculateComfarAssetLifecycle(props.comfarDepreciationAssets,props.comfarAssetSales??[],years)
    : null)
  const sourceDepreciationSchedule = props.comfarDepreciationSchedule?.length===years &&
    props.comfarDepreciationSchedule.every(value=>Number.isFinite(value)&&value>=0)
      ? props.comfarDepreciationSchedule : undefined
  const periodDepreciationSchedule = sourceDepreciationSchedule&&sourceDepreciationSchedule.length===projectPeriods.length
    ? sourceDepreciationSchedule
    : comfarCalendarLifecycle
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
  const calculatedDepreciationValues = comfarCalendarLifecycle
    ? Array.from({length:years},(_,year)=>comfarCalendarLifecycle.depreciation.periods.reduce((sum,row,index)=>
        fiscalYearIndexForPeriod(projectPeriods[index],projectPeriods,props.fiscalYearStartMonth!)===year?sum+row.depreciation:sum,0))
    : comfarLifecycle
      ? comfarLifecycle.depreciation.periods.map(row=>row.depreciation)
      : props.useFixedInvestmentRegister ? Array(years).fill(0) : depreciation.map(row=>row.depreciation)
  const depreciationValues = sourceDepreciationSchedule ?? calculatedDepreciationValues
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
  const utilization = Array.from({length:years},(_,i)=>i<construction?0:i<construction+opYears?Math.max(0,Math.min(100,props.ramp[i-construction]??100))/100:0)
  const fixedInvestmentSchedule = capexSchedule
  const workingCapitalPolicy = useMemo(()=>({
    dayBasis:(props.dayCountBasis??360) as 360|365,rawMaterialDays:state.workingCapitalDays.raw,factorySuppliesDays:state.workingCapitalDays.factorySupplies,utilitiesDays:state.workingCapitalDays.utilities,energyDays:state.workingCapitalDays.energy,sparePartsDays:state.workingCapitalDays.spareParts,workInProgressDays:state.workingCapitalDays.wip,
    workInProgressMaterialCompletionPercent:state.wipCompletion.material,workInProgressConversionCompletionPercent:state.wipCompletion.conversion,
    finishedGoodsDays:state.workingCapitalDays.finished,receivableDays:state.workingCapitalDays.receivable,
    cashDays:state.workingCapitalDays.cash,payableDays:state.workingCapitalDays.payable,
    annualRawMaterialCost:state.workingCapitalBases.rawMaterials,annualFactorySuppliesCost:state.workingCapitalBases.factorySupplies,annualUtilitiesCost:state.workingCapitalBases.utilities,annualEnergyCost:state.workingCapitalBases.energy,annualSparePartsCost:state.workingCapitalBases.spareParts,
    annualPayablesCost:state.workingCapitalBases.payables,
    annualConversionCost:state.workingCapitalBases.conversion,
    annualFinishedGoodsCost:state.workingCapitalBases.finishedGoods,
    annualRevenue:props.fullCapacityRevenue,annualCashOperatingCost:state.workingCapitalBases.cash,
    shortTermDepositSharePercent:state.shortTermDepositSharePercent??0,shortTermDepositRatePercent:state.shortTermDepositRatePercent??0
  }),[state.workingCapitalDays,state.workingCapitalBases,state.wipCompletion,state.shortTermDepositSharePercent,state.shortTermDepositRatePercent,props.fullCapacityRevenue,props.dayCountBasis])
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
  const workingCapitalDraftSchedule=useMemo(()=>props.workingCapitalDrafts?.length
    ?buildWorkingCapitalScheduleFromDrafts({workingCapital:props.workingCapitalDrafts},projectPeriods,props.openingWorkingCapitalBalance??0)
    :null,[JSON.stringify(props.workingCapitalDrafts??[]),JSON.stringify(projectPeriods),props.openingWorkingCapitalBalance])
  const baseProductOperatingSchedule=useMemo(()=>props.productFinancialDrafts&&(props.productFinancialDrafts.sales.length||props.productFinancialDrafts.productionCosts.length)
    ?buildProductOperatingSchedule(props.productFinancialDrafts,projectPeriods,props.fiscalYearStartMonth??1,props.currency)
    :null,[JSON.stringify(props.productFinancialDrafts??null),JSON.stringify(projectPeriods),props.fiscalYearStartMonth,props.currency])
  const cppCpsTraceLedger=useMemo(()=>buildCppCpsTraceLedger(props.cppCpsTraceItems??[],projectPeriods.length),
    [JSON.stringify(props.cppCpsTraceItems??[]),projectPeriods.length])
  useEffect(()=>{props.onCppCpsTraceLedger?.(cppCpsTraceLedger)},[props.onCppCpsTraceLedger,cppCpsTraceLedger])
  const cppCpsScheduleBinding=useMemo(()=>{
    if(!(props.cppCpsTraceItems?.length))return null
    if(!baseProductOperatingSchedule?.valid)return {valid:false,issues:baseProductOperatingSchedule?.issues??['A product-by-product sales and production schedule is required before CPP/CPS posting.'],schedule:null,incrementalCppByPeriod:[],tracePathRows:[]}
    return bindCppCpsTraceLedgerToProductSchedule(baseProductOperatingSchedule,cppCpsTraceLedger,
      projectPeriods.map(period=>fiscalYearIndexForPeriod(period,projectPeriods,props.fiscalYearStartMonth??1)),props.productFinancialDrafts?.costCentres??[])
  },[JSON.stringify(props.cppCpsTraceItems??[]),baseProductOperatingSchedule,cppCpsTraceLedger,JSON.stringify(projectPeriods),props.fiscalYearStartMonth])
  const baseIntegratedProductOperatingSchedule=useMemo(()=>{
    if(!props.cppCpsTraceItems?.length)return baseProductOperatingSchedule
    if(!baseProductOperatingSchedule?.valid||!cppCpsScheduleBinding?.valid||!cppCpsScheduleBinding.schedule){
      return {valid:false,issues:[...(baseProductOperatingSchedule?.issues??[]),...(cppCpsScheduleBinding?.issues??[])],rows:[],periodRevenue:[],periodCostOfSales:[],periodSubsidyIncome:[],periodOutputSalesTax:[],annualRevenue:[],annualCostOfSales:[],totalProductionQuantity:0,totalSalesQuantity:0,totalClosingInventoryValue:0,periodRawMaterialInventoryValue:[],periodWipInventoryValue:[],periodAbnormalWasteExpense:[],periodNormalWasteAbsorbed:[],hasInventoryFlow:false}
    }
    return cppCpsScheduleBinding.schedule
  },[JSON.stringify(props.cppCpsTraceItems??[]),baseProductOperatingSchedule,cppCpsScheduleBinding])

  const productOperatingSchedule=useMemo(()=>{
    if(!baseIntegratedProductOperatingSchedule){
      const hasCorrections=stageJournalEntries.some(entry=>entry.documentType==='reversal'||entry.documentType==='adjustment')
      if(!hasCorrections)return null
      return {valid:false,issues:['Persisted stage journal corrections require a valid product-by-product operating schedule; no correction has been silently skipped.'],rows:[],periodRevenue:Array(projectPeriods.length).fill(Number.NaN),periodCostOfSales:Array(projectPeriods.length).fill(Number.NaN),periodSubsidyIncome:[],periodOutputSalesTax:[],annualRevenue:Array(years).fill(Number.NaN),annualCostOfSales:Array(years).fill(Number.NaN),totalProductionQuantity:0,totalSalesQuantity:0,totalClosingInventoryValue:0,periodRawMaterialInventoryValue:Array(projectPeriods.length).fill(Number.NaN),periodWipInventoryValue:Array(projectPeriods.length).fill(Number.NaN),periodAbnormalWasteExpense:[],periodNormalWasteAbsorbed:[],hasInventoryFlow:false}
    }
    if(!baseIntegratedProductOperatingSchedule.valid)return baseIntegratedProductOperatingSchedule
    if(!stageJournalLoaded)return {...baseIntegratedProductOperatingSchedule,valid:false,issues:[...baseIntegratedProductOperatingSchedule.issues,'Stage accounting journal recovery is still in progress.']}
    const binding=applyStageJournalCorrectionsToProductSchedule(
      baseIntegratedProductOperatingSchedule,
      stageJournalEntries,
      projectPeriods.map(period=>fiscalYearIndexForPeriod(period,projectPeriods,props.fiscalYearStartMonth??1)),
    )
    if(!binding.valid||!binding.schedule)return {...baseIntegratedProductOperatingSchedule,valid:false,issues:[...baseIntegratedProductOperatingSchedule.issues,...binding.issues]}
    return binding.schedule
  },[baseIntegratedProductOperatingSchedule,stageJournalEntries,stageJournalLoaded,JSON.stringify(projectPeriods),props.fiscalYearStartMonth])
  const projectTaxSchedule=useMemo(()=>props.taxDraft?buildProjectTaxDraftSchedule(props.taxDraft,projectPeriods,props.fiscalYearStartMonth??1):null,[JSON.stringify(props.taxDraft??null),JSON.stringify(projectPeriods),props.fiscalYearStartMonth])
  const salesTaxLedgerActive=Boolean(
    baseProductOperatingSchedule?.rows.some(row=>row.salesTaxPercent>0)||
    (props.salesTaxLedgerDraft?.inputCredits?.length??0)>0||
    (props.salesTaxLedgerDraft?.settlements?.length??0)>0||
    props.salesTaxLedgerDraft?.openingBalance!=null
  )
  const salesTaxLedgerResult=useMemo<SalesTaxLedgerResult|null>(()=>{
    if(!salesTaxLedgerActive)return null
    if(!baseProductOperatingSchedule?.valid)return {valid:false,issues:baseProductOperatingSchedule?.issues??['A valid product sales schedule is required for sales-tax posting.'],rows:[],totalOutputTax:0,totalRecoverableInputTax:0,totalSettlements:0,closingBalance:Number.NaN}
    const draft=props.salesTaxLedgerDraft
    const separatelyEnteredVat=props.workingCapitalDrafts?.some(item=>/\bvat\b|sales\s*tax|مالیات\s*فروش|ارزش\s*افزوده/i.test(item.name))??false
    if(separatelyEnteredVat)return {valid:false,issues:['Sales-tax payable / recoverable balances must not also be entered as working-capital components; they are posted from this ledger.'],rows:[],totalOutputTax:0,totalRecoverableInputTax:0,totalSettlements:0,closingBalance:Number.NaN}
    if(draft?.openingBalance==null)return {valid:false,issues:['An explicit opening sales-tax payable / recoverable balance is required.'],rows:[],totalOutputTax:0,totalRecoverableInputTax:0,totalSettlements:0,closingBalance:Number.NaN}
    const outputEntries:SalesTaxOutputEntry[]=baseProductOperatingSchedule.rows
      .filter(row=>row.salesTaxPercent>0)
      .map(row=>({productId:row.productId,period:row.period,taxableSales:row.taxableSales,ratePercent:row.salesTaxPercent,sourceReference:row.salesTaxSourceReference,sourceVerified:row.salesTaxSourceVerified}))
    const inputCredits:SalesTaxInputCreditEntry[]=(draft.inputCredits??[]).map(row=>({
      id:row.id,period:row.period??Number.NaN,taxAmount:row.taxAmount??Number.NaN,
      sourceReference:row.sourceReference,sourceVerified:row.sourceVerified,
    }))
    const settlements:SalesTaxSettlementEntry[]=(draft.settlements??[]).map(row=>({
      period:row.period??Number.NaN,amount:row.amount??Number.NaN,sourceReference:row.sourceReference,sourceVerified:row.sourceVerified,
    }))
    return buildSalesTaxLedger(projectPeriods.length,outputEntries,inputCredits,settlements,draft.openingBalance)
  },[salesTaxLedgerActive,baseProductOperatingSchedule,JSON.stringify(props.salesTaxLedgerDraft??null),JSON.stringify(props.workingCapitalDrafts??[]),JSON.stringify(projectPeriods)])
  useEffect(()=>{props.onSalesTaxLedgerResult?.(salesTaxLedgerResult)},[props.onSalesTaxLedgerResult,salesTaxLedgerResult])

  const loanDraftIntegration=useMemo(()=>props.loanDrafts?.length&&props.projectFoundation&&props.dayCountBasis!==null&&props.dayCountBasis!==undefined
    ?buildProjectLoanDraftIntegration(props.loanDrafts,projectPeriods,props.dayCountBasis,props.periodFrequency??'unspecified',props.projectFoundation)
    :null,[JSON.stringify(props.loanDrafts??[]),JSON.stringify(projectPeriods),props.dayCountBasis,props.periodFrequency,JSON.stringify(props.projectFoundation??null)])
  const stageInventoryPreflight=useMemo(()=>{
    const movements=props.productFinancialDrafts?.costCentreInventoryMovements??[]
    const stageTransfers=props.productFinancialDrafts?.inventoryStageTransfers??[]
    const hasData=movements.some(row=>[
      row.period,row.inventoryStage,row.productId,row.costCentreId,row.openingQuantity,row.openingValue,
      row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,
      row.transfersOutQuantity,row.transfersOutValue,row.productionQuantity,row.productionValue,
      row.consumptionQuantity,row.consumptionValue,row.salesQuantity,row.salesCostValue,
      row.wasteQuantity,row.wasteValue,row.closingQuantity,row.closingValue,row.sourceReference,
      row.sourceVerified===true,
    ].some(value=>value!==null&&value!==undefined&&value!==''))||stageTransfers.some(row=>[
      row.period,row.sourceStage,row.destinationStage,row.sourceProductId,row.destinationProductId,
      row.sourceCostCentreId,row.destinationCostCentreId,row.quantity,row.sourceUnit,row.destinationUnit,
      row.conversionFactor,row.transferValue,row.sourceReference,row.sourceVerified===true,
    ].some(value=>value!==null&&value!==undefined&&value!==''))
    if(!hasData)return null
    if(!productOperatingSchedule?.valid)return {valid:false,issues:['A valid product operating schedule is required before detailed stage inventory can be reconciled.'],rows:[]}
    const expectedByPeriod=(props.projectPeriods??[]).map((_,index)=>({
      period:index+1,
      rawMaterials:productOperatingSchedule.periodRawMaterialInventoryValue[index]??0,
      workInProgress:productOperatingSchedule.periodWipInventoryValue[index]??0,
      finishedGoods:productOperatingSchedule.rows.filter(row=>row.period===index+1).reduce((sum,row)=>sum+row.closingInventoryValue,0),
    }))
    const expectedByProductPeriod=productOperatingSchedule.rows.map(row=>({
      period:row.period,productId:row.productId,rawMaterials:row.rawMaterialInventoryValue,
      workInProgress:row.wipInventoryValue,finishedGoods:row.closingInventoryValue,
      finishedGoodsSalesQuantity:row.salesQuantity,finishedGoodsCostOfSales:row.costOfSales,
      productionQuantity:row.productionQuantity,productionCost:row.productionCost,
    }))
    return reconcileStageInventoryMovements(movements,expectedByPeriod,props.projectPeriods?.length??0,0.01,stageTransfers,expectedByProductPeriod)
  },[JSON.stringify(props.productFinancialDrafts?.costCentreInventoryMovements??[]),
    JSON.stringify(props.productFinancialDrafts?.inventoryStageTransfers??[]),productOperatingSchedule,JSON.stringify(props.projectPeriods??[])])
  const hasUnpostedStageInventoryData=Boolean(
    stageInventoryPreflight&&stageInventoryPreflight.valid!==true
  )
  const periodicFinanceBundle=useMemo<{result:PeriodicProjectFinanceResult;input:PeriodicProjectFinanceInput}|null>(()=>{
    const periods=props.projectPeriods??[]
    if(!periods.length||props.fiscalYearStartMonth==null||props.dayCountBasis==null||!props.cashFlowTiming||props.cashFlowTiming==='unspecified') return null
    const fiscalMonth=props.fiscalYearStartMonth
    const periodLoans=loanDraftIntegration?.valid?loanDraftIntegration.loans:state.loans.map(loan=>{
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
    const workingCapitalBreakdownByPeriod=periods.map(period=>{
      const fiscalIndex=fiscalYearIndexForPeriod(period,periods,fiscalMonth)
      const annualRow=result.years[fiscalIndex]
      if(!annualRow) return calculateOperatingCycleWorkingCapital(workingCapitalPolicy,0,1,1)
      const operatingYear=Math.max(0,fiscalIndex-construction)
      const salesFactor=Math.pow(1+state.salesEscalationPercent/100,operatingYear)
      const opexFactor=Math.pow(1+state.opexEscalationPercent/100,operatingYear)
      return calculateOperatingCycleWorkingCapital(workingCapitalPolicy,annualRow.utilization,salesFactor,opexFactor)
    })
    const estimatedWorkingCapitalByPeriod=workingCapitalBreakdownByPeriod.map((row,index)=>index===periods.length-1?0:row.netWorkingCapital)
    const cashInHandByPeriod=workingCapitalBreakdownByPeriod.map((row,index)=>index===periods.length-1?0:Math.max(0,row.minimumCash-(row.shortTermDeposits??0)))
    const shortTermDepositsByPeriod=workingCapitalBreakdownByPeriod.map((row,index)=>index===periods.length-1?0:row.shortTermDeposits??0)
    let periodicWorkingCapitalByPeriod=workingCapitalDraftSchedule?.valid?[...workingCapitalDraftSchedule.closingWorkingCapital]:[...estimatedWorkingCapitalByPeriod]
    if(periodicWorkingCapitalByPeriod.length) periodicWorkingCapitalByPeriod[periodicWorkingCapitalByPeriod.length-1]=0
    const inventoryDetailByCategory=(category:'inventory'|'work-in-progress',fallback:number[])=>{
      if(props.workingCapitalDrafts?.length&&!workingCapitalDraftSchedule?.valid)return Array(periods.length).fill(Number.NaN)
      if(!props.workingCapitalDrafts?.length&&!productOperatingSchedule?.hasInventoryFlow&&category==='inventory'&&state.workingCapitalDays.raw>0&&state.workingCapitalBases.rawMaterials<=0)
        return Array(periods.length).fill(Number.NaN)
      if(!props.workingCapitalDrafts?.length&&!productOperatingSchedule?.hasInventoryFlow&&category==='work-in-progress'&&state.workingCapitalDays.wip>0&&
        (state.wipCompletion.material+state.wipCompletion.conversion<=0||
         (state.wipCompletion.material>0&&state.workingCapitalBases.rawMaterials<=0)||
         (state.wipCompletion.conversion>0&&state.workingCapitalBases.conversion<=0)))
        return Array(periods.length).fill(Number.NaN)
      const hasExplicit=workingCapitalDraftSchedule?.componentRows.some(row=>row.category===category)??false
      return periods.map((_,index)=>{
        if(index===periods.length-1&&!(productOperatingSchedule?.valid&&productOperatingSchedule.hasInventoryFlow))return 0
        if(hasExplicit)return workingCapitalDraftSchedule!.componentRows.filter(row=>row.category===category&&row.period===index+1).reduce((sum,row)=>sum+row.amount,0)
        if(props.workingCapitalDrafts?.length)return 0
        return fallback[index]??0
      })
    }
    const rawMaterialsInventoryByPeriod=inventoryDetailByCategory('inventory',productOperatingSchedule?.valid&&productOperatingSchedule.hasInventoryFlow?productOperatingSchedule.periodRawMaterialInventoryValue:workingCapitalBreakdownByPeriod.map(row=>row.rawMaterials))
    const workInProgressInventoryByPeriod=inventoryDetailByCategory('work-in-progress',productOperatingSchedule?.valid&&productOperatingSchedule.hasInventoryFlow?productOperatingSchedule.periodWipInventoryValue:workingCapitalBreakdownByPeriod.map(row=>row.workInProgress))
    if(productOperatingSchedule?.valid&&productOperatingSchedule.hasInventoryFlow){
      if(props.workingCapitalDrafts?.length){
        const mismatches=periods.some((_,index)=>
          Math.abs((rawMaterialsInventoryByPeriod[index]??Number.NaN)-(productOperatingSchedule.periodRawMaterialInventoryValue[index]??Number.NaN))>0.01||
          Math.abs((workInProgressInventoryByPeriod[index]??Number.NaN)-(productOperatingSchedule.periodWipInventoryValue[index]??Number.NaN))>0.01)
        if(mismatches)periodicWorkingCapitalByPeriod=Array(periods.length).fill(Number.NaN)
      }else{
        periodicWorkingCapitalByPeriod=periodicWorkingCapitalByPeriod.map((balance,index)=>{
          const actualInventory=(productOperatingSchedule.periodRawMaterialInventoryValue[index]??0)+(productOperatingSchedule.periodWipInventoryValue[index]??0)
          if(index===periods.length-1)return actualInventory
          return balance+actualInventory-(workingCapitalBreakdownByPeriod[index]?.rawMaterials??0)-(workingCapitalBreakdownByPeriod[index]?.workInProgress??0)
        })
      }
    }
    const finishedGoodsInventoryByPeriod=productOperatingSchedule?.valid?periods.map((_,index)=>productOperatingSchedule.rows.filter(row=>row.period===index+1).reduce((sum,row)=>sum+row.closingInventoryValue,0)):undefined
    const explicitFinishedGoods=workingCapitalDraftSchedule?.componentRows.some(row=>row.category==='finished-goods')??false
    if(explicitFinishedGoods&&finishedGoodsInventoryByPeriod){
      const mismatch=periods.some((_,index)=>Math.abs(workingCapitalDraftSchedule!.componentRows.filter(row=>row.category==='finished-goods'&&row.period===index+1).reduce((sum,row)=>sum+row.amount,0)-finishedGoodsInventoryByPeriod[index])>0.01)
      if(mismatch)periodicWorkingCapitalByPeriod=Array(periods.length).fill(Number.NaN)
    }
    const periodicInput:PeriodicProjectFinanceInput={
      periods,fiscalYearStartMonth:fiscalMonth,constructionPeriodCount:periods.filter(period=>fiscalYearIndexForPeriod(period,periods,fiscalMonth)<construction).length,dayCountBasis:props.dayCountBasis,cashFlowTiming:props.cashFlowTiming,
      minimumDscr:state.minimumDscr,periodOtherIncomeByPeriod:props.periodOtherIncomeByPeriod,periodOtherIncomeSourceReference:props.periodOtherIncomeSourceReference,
      annualRevenue:productOperatingSchedule?.valid?productOperatingSchedule.annualRevenue:productOperatingSchedule?Array(years).fill(Number.NaN):result.years.map(row=>row.revenue),periodRevenue:productOperatingSchedule?.valid?productOperatingSchedule.periodRevenue:undefined,periodSubsidyIncome:productOperatingSchedule?.valid?productOperatingSchedule.periodSubsidyIncome:undefined,annualVariableCost:productOperatingSchedule?.valid?productOperatingSchedule.annualCostOfSales:productOperatingSchedule?Array(years).fill(Number.NaN):result.years.map(row=>row.variableCashCost),periodVariableCost:productOperatingSchedule?.valid?productOperatingSchedule.periodCostOfSales:undefined,
      annualFixedCost:result.years.map(row=>row.fixedCashCost),periodAbnormalWasteExpense:productOperatingSchedule?.valid?productOperatingSchedule.periodAbnormalWasteExpense:undefined,annualDepreciation:depreciationValues,
      annualFixedInvestment:fixedInvestmentSchedule,annualPreOperatingCost:activePreOperatingSchedule,
      annualMaintenanceCapex:maintenanceCapexSchedule,annualTaxRates:projectTaxSchedule?.active?(projectTaxSchedule.valid?projectTaxSchedule.annualTaxRates:Array(years).fill(Number.NaN)):taxRates,annualEquityContributions:equityContributions,
      annualEquityWorkingCapitalContributions:equityWorkingCapitalContributions,
      annualShortTermDepositInterest:result.years.map(row=>row.shortTermDepositInterest),
      annualAssetSaleSchedule:assetSaleSchedule,
      periodDepreciationSchedule,periodAssetSaleSchedule,
      workingCapitalByPeriod:periodicWorkingCapitalByPeriod,rawMaterialsInventoryByPeriod,workInProgressInventoryByPeriod,finishedGoodsInventoryByPeriod,
      cashInHandByPeriod,shortTermDepositsByPeriod,
      openingWorkingCapital:props.openingWorkingCapitalBalance??0,openingCash:props.openingCashBalance??0,loans:periodLoans,loanScheduleOverrides:loanDraftIntegration?.valid?loanDraftIntegration.loanScheduleOverrides:undefined,foreignExchangeLossByPeriod:loanDraftIntegration?.valid?loanDraftIntegration.foreignExchangeLossByPeriod:undefined,
      taxRatesByPeriod:projectTaxSchedule?.active?(projectTaxSchedule.valid?projectTaxSchedule.taxRatesByPeriod:Array(periods.length).fill(Number.NaN)):(periodTaxRateDatesMatch()?state.periodTaxRates:undefined),taxAmountOverridesByPeriod:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.taxAmountOverridesByPeriod??undefined:undefined,taxAmountSourceReference:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.taxAmountSourceReference??undefined:undefined,taxableDeductionsByPeriod:projectTaxSchedule?.active?(projectTaxSchedule.valid?projectTaxSchedule.taxableDeductionsByPeriod:Array(periods.length).fill(Number.NaN)):undefined,taxCreditsByPeriod:projectTaxSchedule?.active?(projectTaxSchedule.valid?projectTaxSchedule.taxCreditsByPeriod:Array(periods.length).fill(Number.NaN)):undefined,openingTaxLoss:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.openingTaxLoss:undefined,openingTaxLossVintages:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.openingTaxLossVintages:undefined,taxLossCarryForwardEnabled:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.taxLossCarryForwardEnabled:undefined,taxLossCarryForwardYears:projectTaxSchedule?.active&&projectTaxSchedule.valid?projectTaxSchedule.taxLossCarryForwardYears:undefined,
      discountRatePercent:result.discountRate==null?null:result.discountRate*100,
      equityDiscountRatePercent:props.costOfEquity,
      valuationDate:props.valuationDate||undefined,
      discountConvention:props.discountConvention??'actual-days',
      discountPeriodsPerYear:periodsPerYear,
      mirrFinanceRatePercent:props.mirrFinanceRate??null,mirrReinvestmentRatePercent:props.mirrReinvestmentRate??null
    }
    if(loanDraftIntegration&&!loanDraftIntegration.valid){
      const invalidInput={...periodicInput,annualTaxRates:Array(years).fill(Number.NaN)}
      return {result:calculateIntegratedPeriodicFinance(invalidInput),input:invalidInput}
    }
    const bindFinishedGoods=(financeInput:PeriodicProjectFinanceInput):PeriodicProjectFinanceInput|null=>{
      let boundInput=financeInput
      if(productOperatingSchedule?.valid){
        const hasExplicitFinishedGoods=(props.workingCapitalDrafts?.some(item=>item.category==='finished-goods')??false)||props.workingCapitalIncludesFinishedGoods===true
        const estimatedFinishedGoodsByPeriod=!props.workingCapitalDrafts?.length
          ?workingCapitalBreakdownByPeriod.map((row,index)=>index===periods.length-1?0:row.finishedGoods)
          :[]
        const binding=bindFinishedGoodsInventoryToWorkingCapital(
          financeInput.workingCapitalByPeriod??[],productOperatingSchedule,hasExplicitFinishedGoods,estimatedFinishedGoodsByPeriod
        )
        if(!binding.valid)return null
        boundInput={...financeInput,workingCapitalByPeriod:binding.closingWorkingCapitalByPeriod}
      }
      if(salesTaxLedgerActive&&!salesTaxLedgerResult?.valid)return null
      if(salesTaxLedgerResult?.valid){
        const binding=bindSalesTaxLedgerToWorkingCapital(
          boundInput.workingCapitalByPeriod,boundInput.openingWorkingCapital??0,salesTaxLedgerResult)
        if(!binding.valid)return null
        // Tax settlements are reflected through the change in the net tax balance, not deducted twice.
        boundInput={...boundInput,workingCapitalByPeriod:binding.closingWorkingCapitalByPeriod,
          openingWorkingCapital:binding.openingWorkingCapital}
      }
      return boundInput
    }
    if(props.workingCapitalDrafts?.length){
      const binding=bindWorkingCapitalDraftsToPeriodicFinance(
        periodicInput,{workingCapital:props.workingCapitalDrafts??[]},props.openingWorkingCapitalBalance??0,props.recoverTerminalWorkingCapital??true
      )
      if(!binding.valid||!binding.financeInput){
        const invalidInput={...periodicInput,workingCapitalByPeriod:Array(periods.length).fill(Number.NaN)}
        return {result:calculateIntegratedPeriodicFinance(invalidInput),input:invalidInput}
      }
      const withFinishedGoods=bindFinishedGoods(binding.financeInput)
      if(!withFinishedGoods){
        const invalidInput={...binding.financeInput,workingCapitalByPeriod:Array(periods.length).fill(Number.NaN)}
        return {result:calculateIntegratedPeriodicFinance(invalidInput),input:invalidInput}
      }
      return {result:calculateIntegratedPeriodicFinance(withFinishedGoods),input:withFinishedGoods}
    }
    const withFinishedGoods=bindFinishedGoods(periodicInput)
    if(!withFinishedGoods){
      const invalidInput={...periodicInput,workingCapitalByPeriod:Array(periods.length).fill(Number.NaN)}
      return {result:calculateIntegratedPeriodicFinance(invalidInput),input:invalidInput}
    }
    return {result:calculateIntegratedPeriodicFinance(withFinishedGoods),input:withFinishedGoods}
  },[JSON.stringify(input),JSON.stringify(props.projectPeriods??[]),props.fiscalYearStartMonth,props.dayCountBasis,props.cashFlowTiming,props.periodFrequency,props.valuationDate,props.discountConvention,props.terminalPeriods,props.recoverTerminalWorkingCapital,JSON.stringify(props.periodOtherIncomeByPeriod??[]),props.periodOtherIncomeSourceReference,props.periodOtherIncomeSourceReference,JSON.stringify(state.loans),JSON.stringify(state.periodTaxRates),JSON.stringify(state.periodTaxRateDates),JSON.stringify(workingCapitalPolicy),JSON.stringify(equityContributions),JSON.stringify(equityWorkingCapitalContributions),JSON.stringify(taxRates),JSON.stringify(maintenanceCapexSchedule),JSON.stringify(fixedInvestmentSchedule),JSON.stringify(activePreOperatingSchedule),JSON.stringify(assetSaleSchedule),JSON.stringify(periodDepreciationSchedule),JSON.stringify(periodAssetSaleSchedule),JSON.stringify(props.workingCapitalDrafts??[]),JSON.stringify(props.productFinancialDrafts??null),JSON.stringify(props.cppCpsTraceItems??[]),productOperatingSchedule,projectTaxSchedule,loanDraftIntegration,salesTaxLedgerActive,salesTaxLedgerResult,props.openingWorkingCapitalBalance,props.openingCashBalance,JSON.stringify(props.salesTaxLedgerDraft??null)])
  const periodicFinanceResult=periodicFinanceBundle?.result??null
  const periodicFinanceInput=periodicFinanceBundle?.input??null
  const periodicTaxSourceReference=[...new Set((periodicFinanceResult?.rows??[]).map(row=>row.taxAmountSourceReference).filter((value):value is string=>!!value))].join(' | ')
  const periodicOtherIncomeSourceReference=[...new Set((periodicFinanceResult?.rows??[]).map(row=>row.otherIncomeSourceReference).filter((value):value is string=>!!value))].join(' | ')
  const valueAddedAnalysisResult=useMemo<ValueAddedAnalysisResult|null>(()=>{
    if(!props.valueAddedAnalysisEnabled)return null
    const invalid=(issues:string[])=>({...buildComfarValueAddedAnalysis([]),issues})
    if(!periodicFinanceResult?.valid)return invalid(['A valid periodic financial model is required for value-added analysis.'])
    if(!productOperatingSchedule?.valid)return invalid(['A valid product-by-product sales schedule is required for value-added analysis.'])
    if(!cppCpsTraceLedger.valid||!cppCpsTraceLedger.complete)return invalid(['The CPP/CPS trace ledger must be complete and source-verified before value-added inputs can be reconciled.'])
    if(props.economicDiscountRatePercent===null||props.economicDiscountRatePercent===undefined||!Number.isFinite(props.economicDiscountRatePercent)||props.economicDiscountRatePercent<=-100)
      return invalid(['An explicit economic discount rate greater than -100% is required.'])
    if(!props.economicDiscountRateSourceReference?.trim()||props.economicDiscountRateSourceVerified!==true)
      return invalid(['The economic discount rate requires an independently verified source reference.'])
    if(!props.dayCountBasis||!props.cashFlowTiming||props.cashFlowTiming==='unspecified')
      return invalid(['Economic discount timing and day-count basis must be defined.'])
    if(props.valueAddedPeriodDrafts?.length!==projectPeriods.length)
      return invalid(['Value-added inputs must be initialized for every project period.'])
    const issues:string[]=[]
    const rows=projectPeriods.map((period,index)=>{
      const periodNo=index+1
      const draft=props.valueAddedPeriodDrafts?.find(item=>item.period===periodNo)
      const financeRow=periodicFinanceResult.rows[index]
      if(!draft){issues.push('Missing value-added input for period '+periodNo+'.');return null}
      const traceRows=cppCpsTraceLedger.rows.filter(item=>item.period===periodNo)
      if(traceRows.some(item=>item.grossCost===null)){
        issues.push('CPP/CPS contains an unverified gross cost in period '+periodNo+'.')
      }
      const expectedIntermediate=traceRows.filter(item=>item.category!=='labour').reduce((sum,item)=>sum+(item.grossCost??0),0)
      const expectedLabour=traceRows.filter(item=>item.category==='labour').reduce((sum,item)=>sum+(item.grossCost??0),0)
      const enteredIntermediate=draft.intermediateInputs.reduce((sum,item)=>sum+(item.amount??Number.NaN),0)
      const enteredLabour=(draft.domesticWages??Number.NaN)+(draft.repatriatedWages??Number.NaN)
      if(!Number.isFinite(enteredIntermediate)||Math.abs(enteredIntermediate-expectedIntermediate)>0.01)
        issues.push('Intermediate-input gross amounts in period '+periodNo+' must reconcile to non-labour CPP/CPS trace costs.')
      if(!Number.isFinite(enteredLabour)||Math.abs(enteredLabour-expectedLabour)>0.01)
        issues.push('Domestic plus repatriated wages in period '+periodNo+' must reconcile to the CPP/CPS labour cost.')
      const currentInventory=financeRow.rawMaterialsInventory+financeRow.workInProgressInventory+financeRow.finishedGoodsInventory
      const previousInventory=index===0
        ?(props.openingCurrentAccounts?.rawMaterials??0)+(props.openingCurrentAccounts?.workInProgress??0)+(props.openingCurrentAccounts?.finishedGoods??0)
        :periodicFinanceResult.rows[index-1].rawMaterialsInventory+periodicFinanceResult.rows[index-1].workInProgressInventory+periodicFinanceResult.rows[index-1].finishedGoodsInventory
      const expectedInventoryIncrease=currentInventory-previousInventory
      const expectedInvestmentByKind={
        'fixed-investment':financeRow.fixedInvestment,
        'pre-production-net-of-interest':financeRow.preOperatingCost,
        'inventory-increase':expectedInventoryIncrease,
      }
      for(const [kind,expected] of Object.entries(expectedInvestmentByKind)){
        const entered=draft.investmentInputs.filter(item=>item.kind===kind).reduce((sum,item)=>sum+(item.amount??Number.NaN),0)
        if(!Number.isFinite(entered)||Math.abs(entered-expected)>0.01)
          issues.push('Value-added investment item '+kind+' in period '+periodNo+' must reconcile to the periodic financial model.')
      }
      const presentValueFactor=calculatePeriodicNpv(
        projectPeriods.map((_,periodIndex)=>periodIndex===index?1:0),projectPeriods,
        props.economicDiscountRatePercent as number,props.dayCountBasis as 360|365,
        props.cashFlowTiming as 'period-end'|'mid-period',props.valuationDate,
        props.discountConvention??'actual-days',periodsPerYear)
      const outputSalesTax=salesTaxLedgerActive?(salesTaxLedgerResult?.rows[index]?.outputTax??Number.NaN):0
      const salesRevenue=(productOperatingSchedule.periodRevenue[index]??Number.NaN)-(productOperatingSchedule.periodSubsidyIncome[index]??0)
      const intermediateInputs:ValueAddedInputItem[]=draft.intermediateInputs.map(item=>({
        id:item.id,period:periodNo,description:item.description,amount:item.amount??Number.NaN,
        marketOrigin:item.marketOrigin as 'local'|'foreign',
        taxesDutiesIncludedPercent:item.taxesDutiesIncludedPercent??Number.NaN,
        valueAddedIncludedPercentages:item.valueAddedIncludedPercentages.map(value=>value??Number.NaN) as [number,number,number],
        sourceReference:item.sourceReference,sourceVerified:item.sourceVerified,
      }))
      const investmentInputs:ValueAddedInvestmentItem[]=draft.investmentInputs.map(item=>({
        id:item.id,period:periodNo,description:item.description,amount:item.amount??Number.NaN,
        marketOrigin:item.marketOrigin as 'local'|'foreign',
        taxesDutiesIncludedPercent:item.taxesDutiesIncludedPercent??Number.NaN,
        valueAddedIncludedPercentages:item.valueAddedIncludedPercentages.map(value=>value??Number.NaN) as [number,number,number],
        sourceReference:item.sourceReference,sourceVerified:item.sourceVerified,
        kind:item.kind as 'fixed-investment'|'pre-production-net-of-interest'|'inventory-increase',
      }))
      return {
        period:periodNo,salesRevenue,outputSalesTax,otherIncome:draft.otherIncome??Number.NaN,otherValueAdded:draft.otherValueAdded??Number.NaN,
        subsidiesOnOutput:productOperatingSchedule.periodSubsidyIncome[index]??0,
        intermediateInputs,investmentInputs,
        repatriatedWages:draft.repatriatedWages??Number.NaN,
        repatriatedProfitDividends:draft.repatriatedProfitDividends??Number.NaN,
        repatriatedInterest:draft.repatriatedInterest??Number.NaN,repatriatedOther:draft.repatriatedOther??Number.NaN,
        domesticWages:draft.domesticWages??Number.NaN,
        domesticDividendsAndInterest:draft.domesticDividendsAndInterest??Number.NaN,
        corporateTax:financeRow.tax,subsidiesOnInput:draft.subsidiesOnInput??Number.NaN,
        subsidiesOnInvestment:draft.subsidiesOnInvestment??Number.NaN,
        skilledDomesticLabour:draft.skilledDomesticLabour??Number.NaN,
        totalDomesticLabour:draft.totalDomesticLabour??Number.NaN,
        foreignExchangeOutflow:draft.foreignExchangeOutflow??Number.NaN,
        presentValueFactor,sourceReference:draft.sourceReference,sourceVerified:draft.sourceVerified,
      }
    })
    if(issues.length)return invalid(issues)
    return buildComfarValueAddedAnalysis(rows.filter((row):row is NonNullable<typeof row>=>row!==null))
  },[props.valueAddedAnalysisEnabled,periodicFinanceResult,productOperatingSchedule,cppCpsTraceLedger,
    props.economicDiscountRatePercent,props.economicDiscountRateSourceReference,props.economicDiscountRateSourceVerified,props.dayCountBasis,props.cashFlowTiming,props.valuationDate,props.discountConvention,
    props.valueAddedPeriodDrafts,JSON.stringify(props.valueAddedPeriodDrafts??[]),JSON.stringify(projectPeriods),
    JSON.stringify(props.openingCurrentAccounts??null),salesTaxLedgerActive,salesTaxLedgerResult,periodsPerYear])
  useEffect(()=>{props.onValueAddedAnalysisResult?.(valueAddedAnalysisResult)},[props.onValueAddedAnalysisResult,valueAddedAnalysisResult])
  const partnerFinanceResult=useMemo(()=>props.jointVenture&&periodicFinanceResult?.valid
    ?allocateJointVentureCashFlows(periodicFinanceResult,props.partners??[],props.partnerDistributionPercent??100)
    :null,[props.jointVenture,props.partnerDistributionPercent,JSON.stringify(props.partners??[]),periodicFinanceResult])
  useEffect(()=>{props.onPeriodicResult?.(periodicFinanceResult)},[periodicFinanceResult,props.onPeriodicResult])
  useEffect(()=>{props.onPartnerFinanceResult?.(partnerFinanceResult)},[partnerFinanceResult,props.onPartnerFinanceResult])

  useEffect(()=>{props.onResult?.(result)},[result,props.onResult])
  const oneWaySensitivity=useMemo(()=>calculateOneWaySensitivity(input,20),[JSON.stringify(input)])
  useEffect(()=>{props.onSensitivity?.(oneWaySensitivity)},[oneWaySensitivity,props.onSensitivity])
  const statements=useMemo(()=>buildThreeFinancialStatements(result.years),[result.years])
  const rawMaterialInventoryStatus=props.workingCapitalDrafts?.length
    ?(props.workingCapitalDrafts.some(item=>item.category==='inventory')?'manual':'not-configured')
    :state.workingCapitalDays.raw===0?'not-configured'
    :state.workingCapitalBases.rawMaterials>0?'automatic':'missing-cost-basis'
  const workInProgressInventoryStatus=props.workingCapitalDrafts?.length
    ?(props.workingCapitalDrafts.some(item=>item.category==='work-in-progress')?'manual':'not-configured')
    :state.workingCapitalDays.wip===0?'not-configured'
    :(state.wipCompletion.material+state.wipCompletion.conversion<=0||
      (state.wipCompletion.material>0&&state.workingCapitalBases.rawMaterials<=0)||
      (state.wipCompletion.conversion>0&&state.workingCapitalBases.conversion<=0))
      ?'missing-cost-or-completion-basis':'automatic'
  const periodicStatements=useMemo(()=>periodicFinanceResult?.valid&&!hasUnpostedStageInventoryData?buildPeriodicThreeFinancialStatements(periodicFinanceResult,{
    cash:props.openingCashBalance??0,debt:props.openingDebtBalance??0,
    netFixedAssets:props.openingFixedAssetsNetBookValue??0,
    netWorkingCapital:props.openingWorkingCapitalBalance??0,
    rawMaterialsInventory:props.openingCurrentAccounts?.rawMaterials??0,
    workInProgressInventory:props.openingCurrentAccounts?.workInProgress??0,
    finishedGoodsInventory:props.openingCurrentAccounts?.finishedGoods??0,
    paidInCapital:props.openingPaidInCapital??0,
    retainedEarnings:props.openingRetainedEarnings??0,grants:props.openingGrants??0,
  }):[],[periodicFinanceResult,props.openingCashBalance,props.openingDebtBalance,props.openingFixedAssetsNetBookValue,
    props.openingWorkingCapitalBalance,props.openingCurrentAccounts?.rawMaterials,props.openingCurrentAccounts?.workInProgress,props.openingCurrentAccounts?.finishedGoods,props.openingPaidInCapital,props.openingRetainedEarnings,props.openingGrants,hasUnpostedStageInventoryData])
  const inventoryThreeWayReconciliation=useMemo(()=>{
    if(!periodicFinanceResult?.valid||!productOperatingSchedule?.valid||periodicStatements.length!==periodicFinanceResult.rows.length)return null
    return reconcileInventoryThreeWay(periodicFinanceResult.rows.map((row,index)=>{
      const statement=periodicStatements[index]
      const finishedGoods=productOperatingSchedule.rows.filter(item=>item.period===row.period).reduce((sum,item)=>sum+item.closingInventoryValue,0)
      const raw=productOperatingSchedule.periodRawMaterialInventoryValue[index]??0
      const wip=productOperatingSchedule.periodWipInventoryValue[index]??0
      const inventory=raw+wip+finishedGoods
      return {
        period:row.period,
        model:{rawMaterials:row.rawMaterialsInventory,workInProgress:row.workInProgressInventory,finishedGoods:row.finishedGoodsInventory,otherCurrentAssets:row.closingWorkingCapital-inventory,currentLiabilities:0,netWorkingCapital:row.closingWorkingCapital},
        balanceSheet:{rawMaterials:statement.balanceSheet.rawMaterialsInventory,workInProgress:statement.balanceSheet.workInProgressInventory,finishedGoods:statement.balanceSheet.finishedGoodsInventory,otherCurrentAssets:statement.balanceSheet.otherNetWorkingCapital,currentLiabilities:0,netWorkingCapital:statement.balanceSheet.netWorkingCapital},
        cppCps:{rawMaterials:raw,workInProgress:wip,finishedGoods,totalInventory:inventory},
      }
    }))
  },[periodicFinanceResult,productOperatingSchedule,periodicStatements])
  const stageInventoryReconciliation=useMemo(()=>{
    const movements=props.productFinancialDrafts?.costCentreInventoryMovements??[]
    const stageTransfers=props.productFinancialDrafts?.inventoryStageTransfers??[]
    const hasMovementData=movements.some(row=>[row.period,row.inventoryStage,row.productId,row.costCentreId,row.openingQuantity,row.openingValue,
      row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,row.transfersOutQuantity,row.transfersOutValue,
      row.productionQuantity,row.productionValue,row.consumptionQuantity,row.consumptionValue,row.wasteQuantity,row.wasteValue,
      row.closingQuantity,row.closingValue,row.sourceReference,row.sourceVerified===true].some(value=>value!==null&&value!==undefined&&value!==''))
    const hasStageTransferData=stageTransfers.some(row=>[row.period,row.sourceStage,row.destinationStage,row.sourceProductId,row.destinationProductId,
      row.sourceCostCentreId,row.destinationCostCentreId,row.quantity,row.sourceUnit,row.destinationUnit,row.conversionFactor,row.transferValue,row.sourceReference,row.sourceVerified===true]
      .some(value=>value!==null&&value!==undefined&&value!==''))
    if(!hasMovementData&&!hasStageTransferData)return null
    if(!periodicFinanceResult?.valid)return {valid:false,issues:['A valid periodic finance result is required before stage inventory reconciliation.'],rows:[]}
    // Reconcile the detailed subledger against the same corrected product schedule
    // that feeds working capital and the periodic financial statements. Using the
    // pre-correction schedule here would make reversals/adjustments disagree with
    // the corrected finance-engine balances and could persist stale journal previews.
    const expected=productOperatingSchedule?.valid
      ?Array.from({length:periodicFinanceResult.rows.length},(_,index)=>({
        period:index+1,
        rawMaterials:productOperatingSchedule.periodRawMaterialInventoryValue[index]??0,
        workInProgress:productOperatingSchedule.periodWipInventoryValue[index]??0,
        finishedGoods:productOperatingSchedule.rows.filter(item=>item.period===index+1).reduce((sum,item)=>sum+item.closingInventoryValue,0),
      }))
      :periodicFinanceResult.rows.map(row=>({period:row.period,rawMaterials:row.rawMaterialsInventory,workInProgress:row.workInProgressInventory,finishedGoods:row.finishedGoodsInventory}))
    const expectedByProductPeriod=productOperatingSchedule?.valid?productOperatingSchedule.rows.map(row=>({period:row.period,productId:row.productId,rawMaterials:row.rawMaterialInventoryValue,workInProgress:row.wipInventoryValue,finishedGoods:row.closingInventoryValue,finishedGoodsSalesQuantity:row.salesQuantity,finishedGoodsCostOfSales:row.costOfSales,productionQuantity:row.productionQuantity,productionCost:row.productionCost})):undefined
    return reconcileStageInventoryMovements(movements,expected,periodicFinanceResult.rows.length,0.01,stageTransfers,expectedByProductPeriod)
  },[JSON.stringify(props.productFinancialDrafts?.costCentreInventoryMovements??[]),JSON.stringify(props.productFinancialDrafts?.inventoryStageTransfers??[]),periodicFinanceResult,productOperatingSchedule])
  const abnormalWasteAccounting=useMemo(()=>buildAbnormalWasteAccountingPostings(
    props.productFinancialDrafts?.wasteLedgerEntries??[],props.projectPeriods?.length??0,
    baseIntegratedProductOperatingSchedule?.rows??[]
  ),[JSON.stringify(props.productFinancialDrafts?.wasteLedgerEntries??[]),baseIntegratedProductOperatingSchedule,props.projectPeriods?.length])
  const combinedStageAccountingPostings=[
    ...(stageInventoryReconciliation?.accountingPostings??[]),
    ...(abnormalWasteAccounting.valid?abnormalWasteAccounting.postings:[]),
  ]
  const stagePostingSignature=JSON.stringify(combinedStageAccountingPostings)
  useEffect(()=>{
    if(!canPersistStageAccountingPostings(stageJournalLoaded,stageInventoryReconciliation,abnormalWasteAccounting.valid,props.projectId))return
    const postings=combinedStageAccountingPostings
    if(!postings.length){setStagePostingPersistence({status:'idle',count:0,error:''});return}
    let active=true
    setStagePostingPersistence(previous=>({...previous,status:'saving',error:''}))
    persistStageInventoryAccountingPostings(props.projectId,postings)
      .then(result=>{if(active){setStageJournalEntries(result.entries);setStagePostingPersistence({status:'saved',count:result.entries.length,error:''})}})
      .catch(error=>{if(active)setStagePostingPersistence({status:'error',count:0,error:error instanceof Error?error.message:String(error)})})
    return()=>{active=false}
  },[props.projectId,stageInventoryReconciliation?.valid,abnormalWasteAccounting.valid,stagePostingSignature,stageJournalLoaded])
  const inventoryReferenceReconciliation=useMemo(()=>{
    const benchmarks=props.productFinancialDrafts?.inventoryReferenceBenchmarks??[]
    if(!benchmarks.length||!periodicFinanceResult?.valid||!productOperatingSchedule?.valid)return null
    return reconcileInventoryReference(benchmarks,periodicFinanceResult.rows.map(row=>{
      const productRows=productOperatingSchedule.rows.filter(item=>item.period===row.period)
      const raw=row.rawMaterialsInventory,wip=row.workInProgressInventory,finished=row.finishedGoodsInventory
      return {period:row.period,rawMaterials:raw,workInProgress:wip,finishedGoods:finished,totalInventory:raw+wip+finished,
        cpp:productRows.reduce((sum,item)=>sum+item.productionCost,0),cps:productOperatingSchedule.periodCostOfSales[row.period-1]??0}
    }),0.01,props.currency)
  },[props.productFinancialDrafts?.inventoryReferenceBenchmarks,props.currency,periodicFinanceResult,productOperatingSchedule])
  const scheduledOpeningDebt=useMemo(()=>periodicFinanceResult?.valid
    ?Object.values(periodicFinanceResult.loanSchedules??{}).reduce((sum,schedule)=>sum+(schedule[0]?.openingBalance??0),0)
    :0,[periodicFinanceResult])
  const unmodelledOpeningDebt=Math.max(0,(props.openingDebtBalance??0)-scheduledOpeningDebt)
  const openingCurrentAccountControl=useMemo(()=>{
    const a=props.openingCurrentAccounts
    if(!a)return null
    const values=Object.values(a)
    if(values.some(value=>!Number.isFinite(value)||value<0))return {valid:false,assetTotal:NaN,liabilityTotal:NaN,netWorkingCapital:NaN,cashTotal:NaN}
    const assetTotal=a.rawMaterials+a.factorySupplies+a.workInProgress+a.finishedGoods+a.receivables+
      a.cash+a.shortTermDeposits+a.cashSurplus+a.otherCurrentAssets
    const liabilityTotal=a.tradePayables+a.otherCurrentLiabilities
    const cashTotal=a.cash+a.shortTermDeposits+a.cashSurplus
    const netWorkingCapital=assetTotal-cashTotal-liabilityTotal
    const valid=Math.abs(netWorkingCapital-(props.openingWorkingCapitalBalance??0))<=0.01&&
      Math.abs(cashTotal-(props.openingCashBalance??0))<=0.01
    return {valid,assetTotal,liabilityTotal,netWorkingCapital,cashTotal}
  },[props.openingCurrentAccounts,props.openingWorkingCapitalBalance,props.openingCashBalance])
  const sensitivity=useMemo(()=>periodicFinanceInput&&!salesTaxLedgerActive&&!hasUnpostedStageInventoryData?calculatePeriodicSensitivityMatrix(periodicFinanceInput,[-20,-10,0,10,20],[-20,-10,0,10,20]):[],[periodicFinanceInput,salesTaxLedgerActive,hasUnpostedStageInventoryData])
  const scenarios=useMemo(()=>periodicFinanceInput&&periodicFinanceResult?.valid&&!salesTaxLedgerActive&&!hasUnpostedStageInventoryData?calculatePeriodicFinancialScenarios(periodicFinanceInput):null,[periodicFinanceInput,periodicFinanceResult?.valid,salesTaxLedgerActive,hasUnpostedStageInventoryData])
  useEffect(()=>{props.onScenarioAnalysis?.(sensitivity,scenarios)},[sensitivity,scenarios,props.onScenarioAnalysis])
  const updateAsset=(id:string,patch:Partial<Asset>)=>setState(s=>({...s,assets:s.assets.map(a=>a.id===id?{...a,...patch}:a)}))
  const updateDay=(key:keyof SavedState['workingCapitalDays'],value:number)=>setState(s=>({...s,workingCapitalDays:{...s.workingCapitalDays,[key]:Math.max(0,value)}}))
  const setEquity=(index:number,value:number)=>setState(s=>({...s,equityContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityContributions[i]??0))}))
  const setWorkingCapitalEquity=(index:number,value:number)=>setState(s=>({...s,equityWorkingCapitalContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityWorkingCapitalContributions[i]??0))}))
  const totalBalanceChecks=statements.filter(r=>r.balanceSheet.reconciled).length
  const totalMovementChecks=statements.filter(r=>Object.values(r.movementChecks).every(value=>Math.abs(value)<=0.01)).length
  const periodicUnreconciledStatements=periodicStatements.filter(row=>!row.balanceSheet.reconciled)
  const maximumPeriodicBalanceDifference=Math.max(0,...periodicStatements.map(row=>Math.abs(row.balanceSheet.balanceDifference)))

  return <div className="fw-card" style={{marginTop:18}}>
    <h3>{t('موتور مالی یکپارچه و کنترل‌های مالی','Integrated Financial Engine & Financial Controls')}</h3>
    {hasUnpostedStageInventoryData&&<div className="fw-validation" role="alert">
      <b>{t('دفتر تفصیلی موجودی با برنامه تولید/موجودی محصول‌به‌محصول تطبیق ندارد؛ گزارش‌های دوره‌ای، سه صورت مالی، حساسیت و سناریو متوقف شده‌اند.','The detailed inventory ledger does not reconcile to the product operating schedule; periodic reports, three statements, sensitivity and scenarios are blocked.')}</b>
      {(stageInventoryPreflight?.issues??[]).map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}
      <p>{t('دفتر تفصیلی مبلغ جدیدی به CPP/CPS اضافه نمی‌کند. پس از تطبیق، موتور مالی از برنامه محصول‌به‌محصول به‌عنوان مبنای یکتای ارزش موجودی و بهای فروش استفاده می‌کند و دفتر مراکز هزینه/انتقال به‌عنوان کنترل مستقل ثبت می‌ماند؛ بنابراین انتقال داخلی دوباره‌شماری نمی‌شود.','The detailed ledger does not add a second CPP/CPS charge. Once reconciled, the finance engine uses the product schedule as the single source for inventory values and cost of sales; the cost-centre / transfer ledger remains an independent control, preventing internal-transfer double counting.')}</p>
    </div>}
    {loanDraftIntegration&&!loanDraftIntegration.valid&&<div className="fw-validation" role="alert"><b>{t('برنامه تسهیلات از فرم‌های تفصیلی معتبر نیست؛ صورت‌های مالی دوره‌ای متوقف شده‌اند.','Detailed loan facilities are invalid; periodic financial statements are blocked.')}</b>{loanDraftIntegration.issues.map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {projectTaxSchedule?.active&&!projectTaxSchedule.valid&&<div className="fw-validation" role="alert"><b>{t('برنامه مالیات و انتقال زیان ناقص یا نامعتبر است؛ محاسبه دوره‌ای متوقف شده است.','The tax and loss carry-forward schedule is incomplete or invalid; periodic calculation is blocked.')}</b>{projectTaxSchedule.issues.map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {salesTaxLedgerActive&&!salesTaxLedgerResult?.valid&&<div className="fw-validation" role="alert"><b>{t('دفتر مالیات غیرمستقیم ناقص یا نامعتبر است؛ محاسبه دوره‌ای متوقف شده است.','The indirect sales-tax ledger is incomplete or invalid; periodic calculations are blocked.')}</b>{(salesTaxLedgerResult?.issues??['Complete opening balance, verified purchase-tax credits and period settlements.']).map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {props.valueAddedAnalysisEnabled&&valueAddedAnalysisResult?.valid!==true&&<div className="fw-validation" role="alert"><b>{t('دفتر ارزش افزوده COMFAR هنوز آماده تأیید نیست.','The COMFAR value-added ledger is not ready for validation.')}</b>{(valueAddedAnalysisResult?.issues??['Complete all period inputs, source references and CPP/CPS / investment reconciliations.']).map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {props.valueAddedAnalysisEnabled&&valueAddedAnalysisResult?.valid&&<div className="fw-result"><b>{t('ارزش افزوده خالص ملی (NNVA)','Net national value added (NNVA)')}: {money(valueAddedAnalysisResult.totals.netNationalValueAdded)} {props.currency}</b> · {t('نسبت کارایی مطلق','Absolute efficiency')}: {valueAddedAnalysisResult.totals.absoluteEfficiencyRatio===null?'—':money(valueAddedAnalysisResult.totals.absoluteEfficiencyRatio)}</div>}
    {productOperatingSchedule&&!productOperatingSchedule.valid&&<div className="fw-validation" role="alert"><b>{t('برنامه تولید، موجودی و فروش محصول‌به‌محصول کامل یا معتبر نیست؛ گزارش مالی دوره‌ای متوقف شده است.','Product-by-product production, inventory and sales schedules are incomplete or invalid; periodic financial reporting is blocked.')}</b>{productOperatingSchedule.issues.map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {workingCapitalDraftSchedule&&!workingCapitalDraftSchedule.valid&&<div className="fw-validation" role="alert"><b>{t('برنامه سرمایه در گردش از فرم‌های تفصیلی معتبر نیست؛ محاسبات دوره‌ای متوقف شده است.','The detailed working-capital schedule is invalid; periodic calculations are blocked.')}</b>{workingCapitalDraftSchedule.issues.map((issue,index)=><p className="fw-hint" key={index}>{issue}</p>)}</div>}
    {workingCapitalDraftSchedule?.valid&&<>
      <p className="fw-hint">{t('مانده‌های سرمایه در گردش از فرم‌های تفصیلی به موتور دوره‌ای متصل شده‌اند؛ افزایش/کاهش مانده خالص در جریان نقدی ثبت می‌شود.','Detailed working-capital closing balances are connected to the periodic engine; net balance movements are posted to cash flow.')}</p>
      <div className="fw-card"><b>{t('گردش تفصیلی دارایی‌ها و بدهی‌های جاری به تفکیک دوره','Detailed Current Asset & Liability Roll-forward by Period')}</b>
        {(props.projectPeriods??[]).map((period,index)=>{
          const rows=workingCapitalDraftSchedule.componentRows.filter(item=>item.period===index+1)
          const categoryNames:Record<string,string>={'inventory':'موجودی مواد/کالا','work-in-progress':'کالای در جریان ساخت','finished-goods':'محصول نهایی','receivables':'مطالبات','cash':'نقد عملیاتی','payables':'پرداختنی‌ها','other-current-asset':'سایر دارایی جاری','other-current-liability':'سایر بدهی جاری'}
          const categoryNamesEn:Record<string,string>={'inventory':'Inventory','work-in-progress':'Work in progress','finished-goods':'Finished goods','receivables':'Receivables','cash':'Operating cash','payables':'Payables','other-current-asset':'Other current assets','other-current-liability':'Other current liabilities'}
          return <div className="fw-validation" key={period.startDate}>
            <span><b>{t('دوره','Period')} {index+1} · {period.startDate} — {period.endDate}</b>
              {rows.map((item,rowIndex)=><span key={item.componentId+'-'+rowIndex} style={{display:'block'}}>{t(categoryNames[item.category]??item.category,categoryNamesEn[item.category]??item.category)} · {money(item.signedAmount)} {props.currency}</span>)}
            </span>
            <b>{t('مانده خالص پایان دوره','Closing net balance')}: {money(workingCapitalDraftSchedule.closingWorkingCapital[index])} {props.currency}</b>
          </div>
        })}
      </div>
      {Math.abs(workingCapitalDraftSchedule.terminalRecoveryAmount)>0.01&&<p className="fw-hint">{t('در پایان آخرین دوره، مانده خالص سرمایه در گردش به‌طور کامل آزاد یا تسویه می‌شود؛ اثر نقدی خالص این تسویه:','At the end of the final period, net working capital is fully released or settled; net cash effect of this settlement:')} <b>{money(workingCapitalDraftSchedule.terminalRecoveryAmount)} {props.currency}</b></p>}
    </>}
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
      {([['raw','روز موجودی مواد اولیه'],['factorySupplies','روز موجودی ملزومات کارخانه'],['utilities','روز موجودی اقلام خدماتی'],['energy','روز موجودی/پوشش هزینه انرژی'],['spareParts','روز موجودی قطعات یدکی'],['wip','روز کالای در جریان ساخت'],['finished','روز محصول نهایی'],['receivable','روز وصول مطالبات'],['cash','روز حداقل نقد عملیاتی'],['payable','روز پرداخت بدهی تجاری']] as [keyof SavedState['workingCapitalDays'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{tr(label)} (Mdc)</span><input type="number" min="0" value={state.workingCapitalDays[key]} onChange={e=>updateDay(key,Number(e.target.value))}/><span>Coto</span><input type="number" min="0.0001" step="0.01" value={calculateWorkingCapitalTurnoverCoefficient(state.workingCapitalDays[key])??''} onChange={e=>{const coto=Number(e.target.value);const days=calculateWorkingCapitalDaysCoverageFromTurnover(coto);if(days!==null)updateDay(key,days)}}/></label>)}
    </div>
    <div className="fw-grid">
      <label className="fw-field"><span>{tr('سهم سپرده کوتاه‌مدت از نقدینگی (%)')}</span><input type="number" min="0" max="100" value={state.shortTermDepositSharePercent??0} onChange={e=>setState(s=>({...s,shortTermDepositSharePercent:Math.max(0,Math.min(100,Number(e.target.value)||0))}))}/></label>
      <label className="fw-field"><span>{tr('نرخ سود سپرده کوتاه‌مدت (%)')}</span><input type="number" min="0" value={state.shortTermDepositRatePercent??0} onChange={e=>setState(s=>({...s,shortTermDepositRatePercent:Math.max(0,Number(e.target.value)||0)}))}/></label>
    </div>
    <div className="fw-grid">
      {([['rawMaterials','مبنای سالانه مواد اولیه'],['factorySupplies','مبنای سالانه ملزومات کارخانه'],['utilities','مبنای سالانه اقلام خدماتی'],['energy','مبنای سالانه هزینه انرژی'],['spareParts','مبنای سالانه قطعات یدکی'],['conversion','مبنای سالانه هزینه تبدیل'],['finishedGoods','بهای سالانه محصول ساخته‌شده'],['cash','هزینه نقدی سالانه برای حداقل نقد'],['payables','مبنای سالانه بدهی تجاری']] as [keyof SavedState['workingCapitalBases'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{tr(label)} ({props.currency})</span><input type="number" min="0" value={state.workingCapitalBases[key]} onChange={e=>setState(s=>({...s,workingCapitalBases:{...s.workingCapitalBases,[key]:Math.max(0,Number(e.target.value))}}))}/></label>)}
      <label className="fw-field"><span>{tr('تکمیل مواد در جریان ساخت (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.material} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,material:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
      <label className="fw-field"><span>{tr('تکمیل تبدیل در جریان ساخت (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.conversion} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,conversion:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
    </div>
    <p className="fw-hint">{tr('مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.')}</p>
    <div className="fw-result">{tr('اوج نیاز سرمایه در گردش')}: <b>{money(result.peakWorkingCapital)} {props.currency}</b> · {tr('کسری منابع')}: <b>{money(result.fundingGap)} {props.currency}</b></div>
    <div className="fw-card"><b>{t('جدول دوره‌ای سرمایه در گردش','Periodic Working Capital Schedule')}</b>{result.years.map(r=><div className="fw-validation" key={r.year}><span>{tr('سال')} {r.year} · {tr('مواد')} {money(r.workingCapitalBreakdown.rawMaterials)} · {tr('ملزومات کارخانه')} {money(r.workingCapitalBreakdown.factorySupplies??0)} · {tr('اقلام خدماتی')} {money(r.workingCapitalBreakdown.utilities??0)} · {tr('انرژی')} {money(r.workingCapitalBreakdown.energy??0)} · {tr('قطعات یدکی')} {money(r.workingCapitalBreakdown.spareParts??0)} · WIP {money(r.workingCapitalBreakdown.workInProgress)} · {tr('محصول')} {money(r.workingCapitalBreakdown.finishedGoods)} · {tr('مطالبات')} {money(r.workingCapitalBreakdown.receivables)} · {tr('سپرده کوتاه‌مدت')} {money(r.workingCapitalBreakdown.shortTermDeposits??0)} · {tr('پرداختنی')} {money(r.workingCapitalBreakdown.payables)}</span><b>نیاز طی سال {money(r.workingCapital)} · مانده پایان {money(r.closingWorkingCapital)} · تغییر خالص {money(r.changeInWorkingCapital)}</b></div>)}</div>

    <div className="fw-card"><b>{t('تحلیل نقطه سربه‌سر تجمیعی','Aggregate Break-even Analysis')}</b><p className="fw-hint">{t('طبق روابط COMFAR، هزینه ثابت شامل هزینه نقدی ثابت و استهلاک است؛ هزینه مالی جداگانه برای نقطه سربه‌سر با و بدون هزینه تأمین مالی اعمال می‌شود. این خروجی در سطح کل پروژه است؛ تحلیل محصول‌به‌محصول به تخصیص هزینه‌ها نیاز دارد.','Under COMFAR relationships, fixed cost includes fixed cash cost and depreciation; finance cost is shown separately for break-even including and excluding finance. This is project-wide; product-level analysis requires cost allocation.')}</p>{result.years.map(r=><div className="fw-validation" key={r.year}><span>{tr('سال')} {r.year} · {tr('حاشیه متغیر')} {money(r.breakEven.variableMarginRatioPercent??NaN)}% · {tr('نقطه سربه‌سر با مالی')} {money(r.breakEven.breakEvenRatioIncludingFinancePercent??NaN)}% · {tr('بدون مالی')} {money(r.breakEven.breakEvenRatioExcludingFinancePercent??NaN)}%</span><b>{tr('فروش سربه‌سر با مالی')} {money(r.breakEven.breakEvenSalesValueIncludingFinance??NaN)} · {tr('قیمت سربه‌سر در حجم ثابت')} {money(r.breakEven.breakEvenSalesPriceAtConstantVolume??NaN)}</b></div>)}</div>

    <h4>{t('۳. استهلاک دارایی‌به‌دارایی و مالیات','3. Asset-Level Depreciation & Tax')}</h4>
    <p className="fw-hint">{tr('دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.')}</p>
    <div className="fw-grid">{taxRates.map((v,i)=><label className="fw-field" key={i}><span>{tr('نرخ مالیات سال')} {i+1} (%)</span><input type="number" min="0" max="100" value={v} onChange={e=>setState(s=>({...s,taxRates:taxRates.map((rate,j)=>j===i?Number(e.target.value):rate)}))}/></label>)}</div>
    {projectPeriods.length>0&&<div className="fw-card"><h4>{t('نرخ مالیات به تفکیک دوره','Tax Rate by Project Period')}</h4><p className="fw-hint">{t('در صورت عدم ورود نرخ دوره‌ای، نرخ سال مالی متناظر اعمال می‌شود. با ویرایش هر خانه، برنامه مالیاتی مستقل دوره‌ای فعال می‌شود.','If no period-specific rate is entered, the corresponding fiscal-year rate is applied. Editing any cell activates the independent period tax schedule.')}</p><div className="fw-grid">{projectPeriods.map((period,index)=>{const fiscalIndex=props.fiscalYearStartMonth==null?0:fiscalYearIndexForPeriod(period,projectPeriods,props.fiscalYearStartMonth);const defaultRate=taxRates[fiscalIndex]??props.taxRate;return <label className="fw-field" key={period.index}><span>{t('دوره','Period')} {period.index} · {period.startDate} (%)</span><input type="number" min="0" max="100" value={periodTaxRateDatesMatch()?state.periodTaxRates![index]:defaultRate} onChange={e=>updatePeriodTaxRate(index,Number(e.target.value))}/></label>})}</div></div>}
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
    {props.useFixedInvestmentRegister&&!comfarLifecycle&&<p className="fw-hint">{tr('برنامه استهلاک فقط از دفتر عمومی Fixed Investment و دارایی‌های افتتاحیه متصل‌شده خوانده می‌شود. هنوز دارایی مستهلک‌شونده معتبری در برنامه ثبت نشده است؛ هیچ عمر مفید یا نرخ استهلاک فرضی اعمال نمی‌شود.','Depreciation is sourced only from the shared Fixed Investment Register and linked opening assets. No valid depreciable asset is registered yet; no assumed useful life or depreciation rate is applied.')}</p>}
    {props.useFixedInvestmentRegister&&!comfarLifecycle&&!!props.comfarDepreciationWarnings?.length&&<div className="fw-validation">
      <span>{tr('هشدارهای دارایی‌های افتتاحیه','Opening Asset Warnings')}</span>
      {props.comfarDepreciationWarnings.map((warning,index)=><p className="fw-hint" key={index}>{warning}</p>)}
    </div>}
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
       <article><small>NPVR {tr('پروژه')}</small><b>{result.npvrProject==null?'—':money(result.npvrProject)}</b></article>
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
    {salesTaxLedgerActive&&<p className="fw-hint" role="status">{t('تحلیل حساسیت و سناریوها موقتاً غیرفعال است؛ تغییر قیمت/حجم باید دفتر مالیات خروجی، اعتبار ورودی و پرداخت‌ها را دوباره محاسبه کند تا نتایج نادرست تولید نشود.','Sensitivity and scenarios are temporarily disabled: price/volume changes must recalculate output tax, input credits and remittances before producing valid results.')}</p>}
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{tr('حجم \\ قیمت')}</th>{[-20,-10,0,10,20].map(v=><th key={v}>{v}%</th>)}</tr></thead><tbody>{sensitivity.map((row,i)=><tr key={i}><th>{[-20,-10,0,10,20][i]}%</th>{row.map((cell,j)=><td key={j}>{cell.npv==null?'—':money(cell.npv)}</td>)}</tr>)}</tbody></table></div>
    <h4>{t('۶. سناریوهای خوش‌بینانه و بدبینانه','6. Optimistic & Pessimistic Scenarios')}</h4>
    {scenarios?<div className="fw-grid">
      <div className="fw-result">{tr('بدبینانه')} · NPV {money(scenarios.pessimistic.npvProject??NaN)} · IRR {scenarios.pessimistic.irrProject==null?'—':money(scenarios.pessimistic.irrProject*100)+'٪'}</div>
      <div className="fw-result">{tr('مبنا')} · NPV {money(scenarios.base.npvProject??NaN)} · IRR {scenarios.base.irrProject==null?'—':money(scenarios.base.irrProject*100)+'٪'}</div>
      <div className="fw-result">{tr('خوش‌بینانه')} · NPV {money(scenarios.optimistic.npvProject??NaN)} · IRR {scenarios.optimistic.irrProject==null?'—':money(scenarios.optimistic.irrProject*100)+'٪'}</div>
    </div>:<p className="fw-hint">{tr('برای محاسبه سناریوها ابتدا مدل دوره‌ای معتبر را تکمیل کنید.')}</p>}
    <h4>{t('۷. تطبیق سه صورت مالی و کنترل ترازنامه','7. Three-Statement Reconciliation & Balance Sheet Check')}</h4>
    <div className="fw-result">{tr('ترازهای منطبق: ')}<b>{totalBalanceChecks} {tr('از')} {statements.length}</b> {tr('دوره')} · {tr('کنترل گردش مانده‌ها: ')}<b>{totalMovementChecks} {tr('از')} {statements.length}</b></div>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{tr('سال')}</th><th>{tr('فروش')}</th><th>EBIT</th><th>{tr('درآمد سپرده کوتاه‌مدت')}</th><th>{tr('سود خالص')}</th><th>{tr('وجه نقد ابتدای دوره')}</th><th>{tr('جریان عملیاتی')}</th><th>{tr('جریان سرمایه‌گذاری')}</th><th>{tr('جریان تأمین مالی')}</th><th>{tr('وجه نقد پایان دوره')}</th><th>{tr('وجه نقد در دست')}</th><th>{tr('سپرده کوتاه‌مدت')}</th><th>{tr('جمع دارایی‌ها')}</th><th>{tr('بدهی + حقوق مالکانه')}</th><th>{tr('اختلاف تراز')}</th></tr></thead><tbody>{statements.map(r=><tr key={r.year}><td>{r.year}</td><td>{money(r.incomeStatement.revenue)}</td><td>{money(r.incomeStatement.ebit)}</td><td>{money(r.incomeStatement.shortTermDepositInterest)}</td><td>{money(r.incomeStatement.netIncome)}</td><td>{money(r.openingBalances.cash)}</td><td>{money(r.cashFlowStatement.operatingCashFlow)}</td><td>{money(r.cashFlowStatement.investingCashFlow)}</td><td>{money(r.cashFlowStatement.financingCashFlow)}</td><td>{money(r.cashFlowStatement.closingCash)}</td><td>{money(r.balanceSheet.cashInHand)}</td><td>{money(r.balanceSheet.shortTermDeposits)}</td><td>{money(r.balanceSheet.totalAssets)}</td><td>{money(r.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(r.balanceSheet.balanceDifference)} {r.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody></table></div>
    <p className="fw-hint">{tr('صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.')}</p>
    <h4>{t('۸. موتور یکپارچه جریان نقدی ماهانه/فصلی','8. Integrated Monthly / Quarterly Cash-Flow Engine')}</h4>
    {periodicFinanceResult?.valid&&!hasUnpostedStageInventoryData?<div className="fw-card">
      <p className="fw-hint">{t('جریان‌های عملیاتی سالانه با تعداد روز واقعی به دوره‌های پروژه تخصیص یافته‌اند. برداشت وام می‌تواند روزشمار از مبالغ سالانه توزیع شود یا برای هر دوره مستقلاً ثبت شود. نرخ مالیات قابل تنظیم در هر دوره است و زیان انتقالی، بهره، اصل بدهی و سرمایه در گردش در سطح هر دوره محاسبه می‌شوند. در صورت وجود تاریخ‌های مستند دفتر دارایی، استهلاک و واگذاری دارایی‌به‌دارایی در سطح ماه/فصل اعمال می‌شود. مانده افتتاحیه نقد، سرمایه در گردش، دارایی ثابت، بدهی، آورده، سود انباشته و کمک‌ها از دفتر مانده‌های افتتاحیه به صورت‌های مالی منتقل می‌شود؛ برای پروژه جدید این مانده‌ها صفر هستند.','Annual operating flows are allocated to project periods by actual day counts. Loan drawdowns can be day-weighted from annual amounts or entered directly by period. Tax rates can be set for each period, and loss carry-forward, interest, principal and working capital are calculated period by period. Dated asset-level depreciation and disposals feed the monthly/quarterly model. Opening cash, net working capital, fixed assets, debt, paid-in capital, retained earnings and grants are carried into the statements; these balances default to zero for greenfield projects.')}</p>
      {props.openingCurrentAccounts&&openingCurrentAccountControl&&<div className="fw-card">
        <h4>{t('تفکیک مانده‌های افتتاحیه دارایی‌ها و بدهی‌های جاری','Opening Current Assets & Liabilities Breakdown')}</h4>
        <p className="fw-hint">{t('این تفکیک از دفتر مانده‌های افتتاحیه بنگاه موجود منتقل شده است. ارقام تفصیلی در این قسمت برای کنترل و ردیابی ارائه می‌شوند؛ گردش دوره‌ای سرمایه در گردش از برنامه دوره‌ای اقلام تشکیل می‌شود و از این مانده‌ها دوباره ساخته نمی‌شود.','These details are carried from the existing-enterprise opening register for control and traceability. Periodic working-capital movements continue to come from the period-level component schedule; opening balances are not added a second time.')}</p>
        {([
          ['rawMaterials','موجودی مواد اولیه','Raw materials inventory'],
          ['factorySupplies','مواد و ملزومات','Factory supplies'],
          ['workInProgress','کالای در جریان ساخت','Work in progress'],
          ['finishedGoods','محصول نهایی','Finished goods'],
          ['receivables','حساب‌های دریافتنی','Accounts receivable'],
          ['cash','وجه نقد','Cash-in-hand'],
          ['shortTermDeposits','سپرده کوتاه‌مدت','Short-term deposits'],
          ['cashSurplus','مازاد نقد','Cash surplus'],
          ['otherCurrentAssets','سایر دارایی‌های جاری','Other current assets'],
          ['tradePayables','حساب‌های پرداختنی','Trade payables'],
          ['otherCurrentLiabilities','سایر بدهی‌های جاری','Other current liabilities'],
        ] as [keyof OpeningCurrentAccounts,string,string][]).map(([key,label,english])=><div className="fw-validation" key={key}><span>{t(label,english)}</span><b>{money(props.openingCurrentAccounts![key])} {props.currency}</b></div>)}
        <div className="fw-validation"><span>{t('جمع دارایی‌های جاری','Total current assets')}</span><b>{money(openingCurrentAccountControl.assetTotal)} {props.currency}</b></div>
        <div className="fw-validation"><span>{t('جمع بدهی‌های جاری عملیاتی','Total operating current liabilities')}</span><b>{money(openingCurrentAccountControl.liabilityTotal)} {props.currency}</b></div>
        <div className="fw-validation"><span>{t('بهره تعهدشده افتتاحیه (در بدهی افتتاحیه)','Opening accrued interest (included in opening debt)')}</span><b>{money(props.openingCurrentAccounts.accruedInterest)} {props.currency}</b></div>
        <div className="fw-validation"><span>{t('سرمایه در گردش خالص محاسبه‌شده از اقلام ناخالص','Net working capital derived from gross accounts')}</span><b>{money(openingCurrentAccountControl.netWorkingCapital)} {props.currency}</b></div>
        {openingCurrentAccountControl.valid?<p className="fw-hint">{t('تطبیق مانده‌های ناخالص با نقد و سرمایه در گردش خالص افتتاحیه برقرار است.','Gross opening balances reconcile to opening cash and net working capital.')}</p>:<div className="fw-validation" role="alert"><b>{t('عدم تطبیق دفتر مانده افتتاحیه','Opening balance register does not reconcile')}</b><p>{t('جمع اقلام جاری تفصیلی با مانده نقد یا سرمایه در گردش خالص منتقل‌شده برابر نیست. تا اصلاح ورودی‌های دفتر افتتاحیه، صورت‌های مالی دوره‌ای را تأییدشده تلقی نکنید.','Detailed current-account balances do not match the transferred opening cash or net working-capital balances. Do not treat periodic statements as validated until the opening register is corrected.')}</p></div>}
      </div>}
      {unmodelledOpeningDebt>0.01&&<div className="fw-validation" role="alert">
        <b>{t('هشدار: بخشی از بدهی افتتاحیه برنامه بازپرداخت ندارد.','Warning: part of opening debt has no repayment schedule.')}</b>
        <p>{t('مانده بدهی افتتاحیه بدون برنامه: ','Unscheduled opening debt: ')}{money(unmodelledOpeningDebt)} {props.currency}</p>
        <p>{t('این مانده در بدهی ترازنامه حفظ می‌شود، اما چون برنامه خدمت بدهی برای آن تعریف نشده، بهره و اصل آن در جریان دوره‌ای و DSCR منظور نمی‌شود. برای جلوگیری از کم‌نمایی خدمت بدهی، برنامه تسویه/بازپرداخت آن باید به‌عنوان تسهیلات دوره‌ای ثبت شود.','This balance remains in balance-sheet debt, but its interest and principal are excluded from periodic cash flow and DSCR because no debt-service schedule exists. Add a periodic facility and repayment schedule to avoid understating debt service.')}</p>
      </div>}
      <div className="fw-kpis">
        <article><small>NPV {t('پروژه','Project')}</small><b>{money(periodicFinanceResult.npvProject??NaN)}</b></article>
        <article><small>NPVR {t('پروژه','Project')}</small><b>{periodicFinanceResult.npvrProject==null?'—':money(periodicFinanceResult.npvrProject)}</b></article>
        <article><small>PVI</small><b>{money(periodicFinanceResult.presentValueInvestment??NaN)}</b></article>
        <article><small>IRR {t('پروژه','Project')}</small><b>{periodicFinanceResult.irrProject==null?'—':money(periodicFinanceResult.irrProject)+'%'}</b></article>
        <article><small>MIRR {t('پروژه','Project')}</small><b>{periodicFinanceResult.mirrProject==null?'—':money(periodicFinanceResult.mirrProject)+'%'}</b></article>
        <article><small>NPV {t('سهامدار','Equity')}</small><b>{money(periodicFinanceResult.npvEquity??NaN)}</b></article>
        <article><small>IRR {t('سهامدار','Equity')}</small><b>{periodicFinanceResult.irrEquity==null?'—':money(periodicFinanceResult.irrEquity)+'%'}</b></article>
        <article><small>{t('اوج سرمایه در گردش','Peak working capital')}</small><b>{money(periodicFinanceResult.peakWorkingCapital)}</b></article>
         <article><small>{t('اوج کسری تأمین مالی','Peak funding shortfall')}</small><b>{money(periodicFinanceResult.peakFundingGap)}</b></article>
         <article><small>{t('آورده خودکار ساخت','Automatic construction equity')}</small><b>{money(periodicFinanceResult.totalAutomaticEquity)}</b></article>
         <article><small>{t('اوج اضافه‌برداشت خودکار','Peak automatic overdraft')}</small><b>{money(periodicFinanceResult.peakAutomaticOverdraft)}</b></article>
      </div>
      {(props.cppCpsTraceItems?.length??0)>0&&<div className="fw-card">
        <h4>{t('دفتر ردیابی CPP/CPS و کنترل منبع','CPP/CPS Traceability & Source Control')}</h4>
        <div className="fw-result">{t('وضعیت دفتر','Ledger status')}: <b>{cppCpsTraceLedger.readyForCppPosting?t('آماده ثبت','Ready to post'):t('نیازمند تکمیل / تأیید','Completion / verification required')}</b></div>
        <div className="fw-result">{t('اقلام فاقد منبع معتبر','Items without verified source')}: <b>{cppCpsTraceLedger.unverifiedItemIds.length}</b> · {t('جمع افزایشی مستند (به تفکیک دوره)','Known incremental cost by period')}: <b>{cppCpsTraceLedger.knownIncrementalByPeriod.map(value=>value===null?'—':money(value)).join(' · ')}</b></div>
        {Object.keys({...cppCpsTraceLedger.knownIncrementalByCostCentre,...cppCpsTraceLedger.completeIncrementalByCostCentre}).length>0&&<div style={{overflowX:'auto',marginTop:10}}>
         <h5>{t('هزینه افزایشی مستند به تفکیک مرکز هزینه','Known incremental cost by cost centre')}</h5>
         <table className="fw-table"><thead><tr><th>{t('مرکز هزینه','Cost centre')}</th><th>{t('مبنای تخصیص','Allocation basis')}</th><th>{t('محرک و واحد','Driver and unit')}</th><th>{t('مواد','Materials')}</th><th>{t('نیروی انسانی','Labour')}</th><th>{t('انرژی','Energy')}</th><th>{t('تعمیرات','Maintenance')}</th><th>{t('سربار','Overhead')}</th><th>{t('جمع کامل','Complete total')}</th><th>{t('جمع دوره‌ای کامل','Complete by period')}</th></tr></thead><tbody>{Object.keys({...cppCpsTraceLedger.knownIncrementalByCostCentre,...cppCpsTraceLedger.completeIncrementalByCostCentre}).map(centre=>{const total=cppCpsTraceLedger.knownIncrementalByCostCentre[centre]??0;const definition=props.productFinancialDrafts?.costCentres?.find(item=>item.id===centre);const basis=definition?.allocationBasis==='production-quantity'?t('مقدار تولید','Production quantity'):definition?.allocationBasis==='sales-revenue'?t('درآمد فروش','Sales revenue'):definition?.allocationBasis==='manual'?t('محرک دستی','Manual driver'):'—';const driver=definition?.allocationBasis==='manual'?[definition.manualDriverName,definition.manualDriverUnit].filter(Boolean).join(' · '):basis;return <tr key={centre}><td>{definition?.name??centre}</td><td>{basis}</td><td>{driver}</td>{(['materials','labour','energy','maintenance','overhead'] as const).map(category=>{const categoryRows=cppCpsTraceLedger.rows.filter(row=>row.category===category&&(row.costCentreId===centre||row.costCentreId===null));const categoryIncomplete=categoryRows.length===0||categoryRows.some(row=>row.sourceStatus!=='verified');return <td key={category}>{categoryIncomplete?'—':money(cppCpsTraceLedger.knownIncrementalByCostCentreAndCategory[centre]?.[category]??0)}</td>})}<td>{cppCpsTraceLedger.completeIncrementalByCostCentre[centre]===null?'—':money(cppCpsTraceLedger.completeIncrementalByCostCentre[centre]??total)}</td><td>{(cppCpsTraceLedger.completeIncrementalByCostCentreByPeriod[centre]??[]).map((amount,index)=><span key={index}>{t('دوره','P')} {index+1}: {amount===null?'—':money(amount)}{index<(cppCpsTraceLedger.completeIncrementalByCostCentreByPeriod[centre]?.length??0)-1?' · ':''}</span>)}</td></tr>})}</tbody></table>
         <p className="fw-hint">{t('«جمع کامل» فقط وقتی نمایش عددی دارد که هیچ قلم تأییدنشده یا فاقد مرکز هزینه در آن مرکز/دفتر باقی نمانده باشد.','A numeric complete total is shown only when no unverified or unallocated cost item can affect that centre or ledger.')}</p>
        </div>}{cppCpsTraceLedger.issues.length>0&&<ul className="fw-checklist">{cppCpsTraceLedger.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul>}
        {cppCpsTraceLedger.unverifiedItemIds.length>0&&<p className="fw-hint" role="alert">{t('مبالغ اقلام تأییدنشده خالی مانده‌اند و جمع کامل هزینه قابل ثبت نیست. هیچ مقدار جایگزین یا صفر فرض نشده است.','Unverified item amounts remain blank; complete costs cannot be posted. No substitute or zero values have been assumed.')}</p>}
        {cppCpsScheduleBinding?.issues.map((issue,index)=><p className="fw-hint" key={'binding-'+index} role="alert">{issue}</p>)}
        {cppCpsScheduleBinding?.valid&&cppCpsScheduleBinding.tracePathRows.length>0&&<div style={{overflowX:'auto',marginTop:12}}>
          <h5>{t('ردیابی عددی هر قلم تا WIP، محصول نهایی، CPS و سرمایه در گردش','Per-item numeric trace through WIP, finished goods, COGS and working capital')}</h5>
          <table className="fw-table"><thead><tr>
            <th>{t('شناسه قلم','Cost item')}</th><th>{t('وضعیت ثبت','Posting status')}</th><th>{t('دوره','Period')}</th><th>{t('محصول','Product')}</th>
            <th>{t('هزینه ناخالص','Gross cost')}</th><th>{t('پوشش پایه','Base covered')}</th><th>{t('CPP افزایشی','Incremental CPP')}</th>
            <th>{t('WIP ابتدای دوره','Opening WIP')}</th><th>{t('تولید تکمیل‌شده','Completed CPP')}</th><th>{t('WIP پایان دوره','Closing WIP')}</th>
            <th>{t('محصول نهایی ابتدای دوره','Opening finished goods')}</th><th>{t('CPS','COGS')}</th>
            <th>{t('محصول نهایی پایان دوره','Closing finished goods')}</th><th>{t('اثر سود ناخالص','Gross-profit impact')}</th>
            <th>{t('اثر سرمایه در گردش','Working-capital impact')}</th>
          </tr></thead><tbody>{cppCpsScheduleBinding.tracePathRows.map((row,index)=><tr key={row.itemId+':'+row.productId+':'+row.period}>
            <td>{row.itemId}</td><td>{row.postingStatus==='base-covered'?t('پوشش‌یافته در هزینه پایه','Already in base cost'):t('افزایشی','Incremental')}</td><td>{row.period}</td><td>{row.productId}</td>
            <td>{money(row.grossCost)}</td><td>{money(row.baseCoveredCost)}</td><td>{money(row.incrementalCpp)}</td>
            <td>{money(row.openingWipCarry)}</td><td>{money(row.completedProductionCpp)}</td><td>{money(row.closingWipCpp)}</td>
            <td>{money(row.openingFinishedGoodsCarry)}</td><td>{money(row.costOfSalesCpp)}</td>
            <td>{money(row.closingFinishedGoodsCpp)}</td><td>{money(row.grossProfitImpact)}</td>
            <td>{money(row.workingCapitalImpact)}</td>
          </tr>)}</tbody></table>
          <p className="fw-hint">{t('کنترل هر قلم: WIP اول دوره به‌علاوه CPP افزایشی دوره برابر تولید تکمیل‌شده به‌علاوه WIP پایان دوره است؛ سپس محصول نهایی ابتدای دوره به‌علاوه تولید تکمیل‌شده به CPS و موجودی پایان محصول نهایی تخصیص می‌یابد. اثر سرمایه در گردش فقط مانده WIP و محصول نهایی همین قلم را نشان می‌دهد.','Per item, opening WIP plus current incremental CPP reconciles to completed production plus closing WIP. Opening finished goods plus completed production then reconciles to COGS and closing finished goods. Working-capital impact is the closing WIP and finished-goods balance attributable to this item.')}</p>
        </div>}
        {props.workingCapitalDrafts?.some(item=>item.category==='finished-goods')&&<p className="fw-hint">{t('جزء محصول نهایی در سرمایه در گردش به‌صورت دستی ثبت شده است؛ ارزش مانده آن را با موجودی پایان دوره پس از تخصیص CPP تطبیق دهید تا دوباره‌شماری رخ ندهد.','Finished-goods working capital is manually entered; reconcile it to the revalued closing inventory after CPP allocation to avoid double counting.')}</p>}
      </div>}
      {salesTaxLedgerActive&&<div className={salesTaxLedgerResult?.valid?'fw-card':'fw-validation'} role={salesTaxLedgerResult?.valid?'status':'alert'}>
        <h4>{t('دفتر مالیات غیرمستقیم فروش و مانده مالیاتی','Indirect Sales-Tax Ledger & Tax Balance')}</h4>
        {salesTaxLedgerResult?.valid?<><div className="fw-kpis">
          <article><small>{t('مالیات خروجی فروش','Output sales tax')}</small><b>{money(salesTaxLedgerResult.totalOutputTax)}</b></article>
          <article><small>{t('اعتبار مالیات خرید مستند','Verified input-tax credits')}</small><b>{money(salesTaxLedgerResult.totalRecoverableInputTax)}</b></article>
          <article><small>{t('پرداخت / تهاتر','Settlements')}</small><b>{money(salesTaxLedgerResult.totalSettlements)}</b></article>
          <article><small>{salesTaxLedgerResult.closingBalance>=0?t('مالیات پرداختنی پایان','Closing tax payable'):t('مالیات دریافتنی پایان','Closing tax recoverable')}</small><b>{money(Math.abs(salesTaxLedgerResult.closingBalance))}</b></article>
        </div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('مانده اول','Opening balance')}</th><th>{t('مالیات خروجی','Output tax')}</th><th>{t('اعتبار ورودی','Input credit')}</th><th>{t('خالص تعهد دوره','Net accrued')}</th><th>{t('پرداخت / تهاتر','Settlement')}</th><th>{t('مانده پایان (+پرداختنی / −دریافتنی)','Closing (+payable / −recoverable)')}</th></tr></thead><tbody>{salesTaxLedgerResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{money(row.openingBalance)}</td><td>{money(row.outputTax)}</td><td>{money(row.recoverableInputTax)}</td><td>{money(row.netTaxAccrued)}</td><td>{money(row.settlement)}</td><td>{money(row.closingBalance)}</td></tr>)}</tbody></table></div>
        <p className="fw-hint">{t('مانده مالیات پرداختنی/دریافتنی در سرمایه در گردش خالص منظور شده است؛ بنابراین اثر پرداخت در تغییر مانده منعکس می‌شود و پرداخت نقدی دوباره از جریان نقدی کسر نمی‌شود. سناریو و حساسیت تا زمان بازسازی دفتر مالیات در هر سناریو غیرفعال است.','The net payable / recoverable tax balance is included in net working capital. Remittances therefore flow through the change in that balance and are not deducted from cash flow a second time. Sensitivity and scenarios are disabled until the tax ledger is recalculated for each scenario.')}</p>
        </>:<><b>{t('دفتر مالیات برای ثبت در مدل آماده نیست.','Sales-tax ledger is not ready for posting.')}</b><ul>{(salesTaxLedgerResult?.issues??['Sales-tax ledger inputs are incomplete.']).map((issue,index)=><li key={index}>{issue}</li>)}</ul></>}
      </div>}
      {productOperatingSchedule?.valid&&<div className="fw-card"><h4>{t('برنامه تولید، فروش و بهای تمام‌شده به تفکیک محصول','Product-by-product production, sales and cost-of-sales schedule')}</h4><div style={{overflowX:'auto',maxHeight:320}}><table className="fw-table"><thead><tr><th>{t('محصول','Product')}</th><th>{t('دوره','Period')}</th><th>{t('مقدار فروش','Sales quantity')}</th><th>{t('مقدار تولید','Production quantity')}</th><th>{t('موجودی پایان','Closing stock')}</th><th>{t('ارزش موجودی پایان','Closing stock value')}</th><th>{t('بهای واحد میانگین','Weighted unit cost')}</th><th>{t('بهای کالای فروش‌رفته','Cost of sales')}</th><th>{t('درآمد خالص فروش','Net sales revenue')}</th><th>{t('سود ناخالص محصول','Product gross profit')}</th></tr></thead><tbody>{productOperatingSchedule.rows.map(row=><tr key={row.productId+'-'+row.period}><td>{row.productId}</td><td>{row.period}</td><td>{money(row.salesQuantity)}</td><td>{money(row.productionQuantity)}</td><td>{money(row.closingInventoryQuantity)}</td><td>{money(row.closingInventoryValue)}</td><td>{money(row.weightedAverageUnitCost)}</td><td>{money(row.costOfSales)}</td><td>{money(row.netSalesRevenue)}</td><td>{money(row.grossProfit)}</td></tr>)}</tbody></table></div><p className="fw-hint">{t('روش ارزش‌گذاری موجودی: میانگین موزون؛ تولید با روش انتخاب‌شده در فرم محصول (ورود دستی یا روز پوشش COMFAR) محاسبه می‌شود.','Inventory valuation uses weighted-average cost; production follows the selected product form policy (manual or COMFAR days coverage).')}</p></div>}
      <h4>{t('منابع خودکار پوشش کسری طبق COMFAR XI.N','COMFAR XI.N Automatic Deficit Funding')}</h4>
      <p className="fw-hint">{t('آورده خودکار در دوره ساخت و اضافه‌برداشت بدون بهره در دوره تولید محاسبه می‌شود؛ اضافه‌برداشت با مازاد نقدی در اولین فرصت بازپرداخت می‌شود. هر دو در جریان تأمین مالی، سرمایه پرداخت‌شده و بدهی ترازنامه دوره‌ای ثبت و با کنترل گردش مستقل تطبیق داده می‌شوند؛ این اضافه‌برداشت خودکار جایگزین تسهیلات قراردادی با نرخ و سررسید نیست.','Automatic equity covers construction deficits; a non-interest-bearing overdraft covers production deficits and is repaid as early as possible from surplus cash. Both are posted to financing cash flow, paid-in capital and periodic balance-sheet debt with independent roll-forward checks. This automatic overdraft does not replace contractual facilities with rates and maturities.')}</p>
      <div style={{overflowX:'auto',maxHeight:300}}>
        <table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('آورده خودکار','Automatic equity')}</th><th>{t('ایجاد اضافه‌برداشت','Overdraft drawdown')}</th><th>{t('بازپرداخت اضافه‌برداشت','Overdraft repayment')}</th><th>{t('مانده اضافه‌برداشت','Overdraft balance')}</th></tr></thead>
          <tbody>{periodicFinanceResult.automaticFundingSchedule.map(row=><tr key={row.period}><td>{row.period}</td><td>{money(row.automaticEquity)}</td><td>{money(row.automaticOverdraftDrawdown)}</td><td>{money(row.automaticOverdraftRepayment)}</td><td>{money(row.automaticOverdraftBalance)}</td></tr>)}</tbody>
        </table>
      </div>
      <h4>{t('صورت‌های مالی یکپارچه در سطح هر دوره','Linked Three Financial Statements by Period')}</h4>
      <div className="fw-result">{t('ترازهای منطبق','Reconciled periods')}: <b>{periodicStatements.filter(row=>row.balanceSheet.reconciled).length} / {periodicStatements.length}</b></div>
      <div className="fw-validation">
        <b>{t('وضعیت ارزش‌گذاری موجودی‌ها','Inventory valuation status')}</b>
        <p>{t('مواد اولیه','Raw materials')}: {rawMaterialInventoryStatus==='automatic'?t('خودکار بر مبنای بهای مصرف و روز پوشش','Automatic: annual consumption cost × coverage days'):rawMaterialInventoryStatus==='manual'?t('بر اساس مانده‌های دوره‌ای ثبت‌شده','From entered period balances'):rawMaterialInventoryStatus==='not-configured'?t('روز پوشش صفر است؛ موجودی در مدل منظور نشده','Zero coverage days; no stock modeled'):t('مبنای هزینه وارد نشده؛ ارزش قابل تأیید نیست','Cost basis missing; valuation is unverified')}</p>
        <p>{t('کالای در جریان ساخت','Work in progress')}: {workInProgressInventoryStatus==='automatic'?t('خودکار با تفکیک درصد تکمیل مواد و تبدیل','Automatic: separate material and conversion completion'):workInProgressInventoryStatus==='manual'?t('بر اساس مانده‌های دوره‌ای ثبت‌شده','From entered period balances'):workInProgressInventoryStatus==='not-configured'?t('روز پوشش صفر است؛ WIP در مدل منظور نشده','Zero coverage days; no WIP modeled'):t('مبنای هزینه یا درصد تکمیل ناقص است؛ ارزش قابل تأیید نیست','Cost or completion basis is incomplete; valuation is unverified')}</p>
      </div>
      {inventoryThreeWayReconciliation&&<div className={inventoryThreeWayReconciliation.valid?'fw-result':'fw-validation'} role={inventoryThreeWayReconciliation.valid?'status':'alert'}>
        <b>{t('تطبیق سه‌طرفه موجودی: دفتر تولید، ترازنامه و CPP/CPS','Three-way inventory reconciliation: production ledger, balance sheet and CPP/CPS')}</b>
        <p>{t('دوره‌های منطبق: ','Reconciled periods: ')}{inventoryThreeWayReconciliation.rows.filter(row=>Math.abs(row.inventoryVariance)<=0.01&&Math.abs(row.cppCpsVariance)<=0.01&&Math.abs(row.workingCapitalVariance)<=0.01).length} / {inventoryThreeWayReconciliation.rows.length}</p>
        {!inventoryThreeWayReconciliation.valid&&inventoryThreeWayReconciliation.issues.map((issue,index)=><p key={index}>{issue}</p>)}
        <p>{t('این کنترل، تطبیق داخلی داده‌های ثبت‌شده را نشان می‌دهد؛ تا زمان ورود ارقام تفکیکی مستقل از گزارش مرجع، تطبیق تاریخی با COMFAR تأییدشده محسوب نمی‌شود.','This checks internal model consistency. Historical COMFAR reconciliation remains unverified until independent detailed reference figures are entered.')}</p>
      </div>}
      {stageInventoryReconciliation&&<div className={stageInventoryReconciliation.valid?'fw-result':'fw-validation'} role={stageInventoryReconciliation.valid?'status':'alert'}>
        <b>{t('تطبیق دفتر موجودی تفکیکی با موتور مالی','Stage inventory register vs finance-engine reconciliation')}</b>
        <p>{t('تطبیق‌های مرحله/دوره: ','Matched stage-period balances: ')}{stageInventoryReconciliation.rows.length} / {new Set((props.productFinancialDrafts?.costCentreInventoryMovements??[]).map(row=>String(row.inventoryStage)+':'+String(row.period))).size}</p>
        {!stageInventoryReconciliation.valid&&stageInventoryReconciliation.issues.map((issue,index)=><p key={index}>{issue}</p>)}
        {!abnormalWasteAccounting.valid&&abnormalWasteAccounting.issues.map((issue,index)=><p key={'waste-'+index}>{issue}</p>)}
        {abnormalWasteAccounting.valid&&abnormalWasteAccounting.postings.length>0&&<p>{t('اسناد ضایعات غیرعادی: ','Abnormal-waste journals: ')}{abnormalWasteAccounting.postings.length} · {t('بدهکار هزینه','Debit expense')} {money(abnormalWasteAccounting.debitTotal)} · {t('بستانکار موجودی مواد','Credit raw-material inventory')} {money(abnormalWasteAccounting.creditTotal)}</p>}
        {stageInventoryReconciliation.valid&&<p>{t('پیش‌نمایش ثبت‌های متوازن: ','Balanced accounting posting preview: ')}{stageInventoryReconciliation.accountingPostings?.length??0} {t('سند','entries')} · {t('بدهکار','Debit')} {money(stageInventoryReconciliation.accountingDebitTotal??0)} · {t('بستانکار','Credit')} {money(stageInventoryReconciliation.accountingCreditTotal??0)}</p>}
         {stagePostingPersistence.status==='saved'&&<p>{t('اسناد یکتا در ذخیره‌ساز محلی ثبت شده: ','Unique documents persisted locally: ')}{stagePostingPersistence.count}</p>}
         {stagePostingPersistence.status==='saving'&&<p>{t('در حال ذخیره اسناد مرحله‌ای…','Persisting stage documents…')}</p>}
         {stagePostingPersistence.status==='error'&&<p role="alert">{t('ذخیره اسناد مرحله‌ای ناموفق بود: ','Stage document persistence failed: ')}{stagePostingPersistence.error}</p>}
        <p>{t('انتقال بین مراحل فقط بدهکار کردن موجودی مرحله مقصد و بستانکار کردن موجودی مرحله مبدأ است؛ جمع موجودی و CPP/CPS را افزایش نمی‌دهد. بهای تمام‌شده فروش در این پیش‌نمایش با دفتر کالای ساخته‌شده تطبیق می‌شود، اما قبلاً در هزینه متغیر و صورت سود و زیان موتور مالی منظور شده و دوباره به آن افزوده نمی‌شود. این خروجی پیش‌نمایش ثبت است و هنوز به دفتر کل پایدار/ERP ارسال نمی‌شود.','Inter-stage transfers debit the destination inventory account and credit the source inventory account only; they do not increase total inventory or CPP/CPS. COGS is tied to the finished-goods subledger in this preview but is already included in the finance engine variable cost and income statement, so it is not added again. This is a posting preview, not a persistent general-ledger or ERP write.')}</p>
        {stageJournalLoaded&&<StageInventoryCorrectionsPanel projectId={props.projectId} entries={stageJournalEntries} periodCount={projectPeriods.length} en={en} onUpdated={entries=>{setStageJournalEntries(entries);setStagePostingPersistence({status:'saved',count:entries.length,error:''})}}/>}
      </div>}
      {inventoryReferenceReconciliation&&<div className={inventoryReferenceReconciliation.valid?'fw-result':'fw-validation'} role={inventoryReferenceReconciliation.valid?'status':'alert'}>
        <b>{t('تطبیق تاریخی با خروجی مرجع','Historical reconciliation against reference output')}</b>
        <p>{t('دوره‌های کاملاً منطبق: ','Fully matched periods: ')}{inventoryReferenceReconciliation.rows.filter(row=>row.status==='matched').length} / {inventoryReferenceReconciliation.rows.length}</p>
        {inventoryReferenceReconciliation.rows.map(row=><p key={row.period}>{t('دوره ','Period ')}{row.period}: {row.status==='matched'?t('منطبق','Matched'):row.status==='mismatch'?t('دارای اختلاف','Mismatch'):t('ناقص؛ داده مرجع کافی نیست','Incomplete; insufficient reference evidence')} · {t('اقلام منطبق: ','Matched fields: ')}{row.matchedFields.join(', ')||'—'} · {t('اقلام فاقد شاهد: ','Missing evidence: ')}{row.missingFields.join(', ')||t('هیچ','None')} · {t('اختلاف‌ها: ','Variances: ')}{Object.entries(row.variances).map(([key,value])=>key+': '+money(value)).join(' | ')||'—'}</p>)}
        {inventoryReferenceReconciliation.issues.map((issue,index)=><p key={index}>{issue}</p>)}
      </div>}
      {periodicUnreconciledStatements.length>0&&<div className="fw-validation" role="alert">
        <b>{t('هشدار: صورت‌های مالی دوره‌ای هنوز کاملاً تطبیق ندارند.','Warning: periodic financial statements are not fully reconciled.')}</b>
        <p>{t('تعداد دوره‌های دارای اختلاف: ','Periods with differences: ')}{periodicUnreconciledStatements.length} / {periodicStatements.length} · {t('بیشترین قدرمطلق اختلاف تراز: ','Maximum absolute balance difference: ')}{money(maximumPeriodicBalanceDifference)} {props.currency}</p>
        <p>{t('هیچ رقم ترازکننده‌ای به حقوق مالکانه یا سود انباشته اضافه نشده است. مانده افتتاحیه، طبقه‌بندی سرمایه در گردش، آورده، بدهی و دارایی‌ها را بررسی کنید؛ تا رفع اختلاف، این صورت‌ها تأییدشده تلقی نمی‌شوند.','No balancing plug has been added to equity or retained earnings. Review opening balances, working-capital classification, contributions, debt and assets. These statements must not be treated as validated until the differences are resolved.')}</p>
      </div>}
      <div style={{overflowX:'auto',maxHeight:420}}>
        <table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('تاریخ پایان','Period end')}</th><th>EBIT</th><th>{t('درآمد سپرده کوتاه‌مدت','Short-term deposit interest')}</th><th>{t('سود قبل از مالیات','Profit before tax')}</th><th>{t('سود/زیان تسعیر ارز','FX gain/loss')}</th><th>{t('کسورات مشمول مالیات','Taxable deductions')}</th><th>{t('مالیات قبل از اعتبار','Tax before credits')}</th><th>{t('اعتبار مالیاتی','Tax credits')}</th><th>{t('مالیات پرداختنی','Tax payable')}</th><th>{t('سود خالص','Net income')}</th><th>{t('جریان عملیاتی','Operating CF')}</th><th>{t('جریان سرمایه‌گذاری','Investing CF')}</th><th>{t('جریان تأمین مالی','Financing CF')}</th><th>{t('وجه نقد پایان','Closing cash')}</th><th>{t('وجه نقد در دست','Cash-in-hand')}</th><th>{t('سپرده کوتاه‌مدت','Short-term deposits')}</th><th>{t('بدهی پایان','Closing debt')}</th><th>{t('سرمایه در گردش خالص','Net working capital')}</th><th>{t('موجودی مواد اولیه','Raw materials inventory')}</th><th>{t('کالای در جریان ساخت','Work in progress')}</th><th>{t('سایر خالص اقلام جاری','Other net current accounts')}</th><th>{t('سرمایه پرداخت‌شده','Paid-in capital')}</th><th>{t('سود انباشته','Retained earnings')}</th><th>{t('کمک‌ها و بلاعوض','Grants')}</th><th>{t('جمع دارایی‌ها','Total assets')}</th><th>{t('جمع بدهی و حقوق مالکانه','Total liabilities & equity')}</th><th>{t('دارایی خالص ثابت','Net fixed assets')}</th><th>{t('اختلاف تراز','Balance difference')}</th></tr></thead>
          <tbody>{periodicStatements.map(row=><tr key={row.period}><td>{row.period}</td><td>{row.endDate}</td><td>{money(row.incomeStatement.ebit)}</td><td>{money(row.incomeStatement.shortTermDepositInterest)}</td><td>{money(row.incomeStatement.profitBeforeTax)}</td><td>{money(row.incomeStatement.foreignExchangeGainLoss)}</td><td>{money(row.incomeStatement.taxableDeductions)}</td><td>{money(row.incomeStatement.taxBeforeCredits)}</td><td>{money(row.incomeStatement.taxCredits)}</td><td>{money(row.incomeStatement.tax)}</td><td>{money(row.incomeStatement.netIncome)}</td><td>{money(row.cashFlowStatement.operatingCashFlow)}</td><td>{money(row.cashFlowStatement.investingCashFlow)}</td><td>{money(row.cashFlowStatement.financingCashFlow)}</td><td>{money(row.cashFlowStatement.closingCash)}</td><td>{money(row.balanceSheet.cashInHand)}</td><td>{money(row.balanceSheet.shortTermDeposits)}</td><td>{money(row.balanceSheet.debt)}</td><td>{money(row.balanceSheet.netWorkingCapital)}</td><td>{money(row.balanceSheet.rawMaterialsInventory)}</td><td>{money(row.balanceSheet.workInProgressInventory)}</td><td>{money(row.balanceSheet.otherNetWorkingCapital)}</td><td>{money(row.balanceSheet.paidInCapital)}</td><td>{money(row.balanceSheet.retainedEarnings)}</td><td>{money(row.balanceSheet.grants)}</td><td>{money(row.balanceSheet.totalAssets)}</td><td>{money(row.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(row.balanceSheet.netFixedAssets)}</td><td>{money(row.balanceSheet.balanceDifference)} {row.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="fw-hint">{t('سرمایه در گردش به‌صورت خالص (دارایی‌های جاری منهای بدهی‌های عملیاتی) نمایش داده می‌شود؛ تفکیک ناخالص اقلام جاری بدون داده تفصیلی ساخته نمی‌شود. بهره سرمایه‌ای‌شده هم‌زمان به دارایی‌های قبل از بهره‌برداری و بدهی افزوده می‌شود.','Working capital remains the net total. Raw-material and WIP balances are separately disclosed from explicit component balances or the operating-cycle cost/day and completion assumptions; the residual other-net-current-accounts line offsets these sub-ledgers so inventory is never counted twice. Capitalized interest increases both deferred pre-operating assets and debt.')}</p>
      <p className="fw-hint">{t('ضایعات غیرعادی به‌صورت هزینه جداگانه در EBIT، مالیات و جریان نقدی منظور می‌شود؛ چون رفتار ثابت/متغیر آن بدون شاهد مستقل مشخص نیست، در دو سبد هزینه ثابت و متغیر یا ضرایب سناریو پخش نمی‌شود. تحلیل نقطه سربه‌سر مبتنی بر تفکیک ثابت/متغیر باید این مبلغ تفکیک‌نشده را جداگانه افشا کند.','Abnormal waste is expensed separately through EBIT, tax and cash flow. Without independent cost-behaviour evidence it is not assigned to fixed/variable buckets or scaled by scenario cost factors. Any break-even analysis based on fixed/variable splits must disclose this unclassified amount separately.')}</p>
      <div style={{overflowX:'auto',maxHeight:480}}>
        <table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('تاریخ','Dates')}</th><th>{t('روز','Days')}</th><th>{t('فروش','Revenue')}</th><th>{t('سایر درآمد','Other income')}</th><th>{t('هزینه متغیر','Variable cost')}</th><th>{t('هزینه ثابت','Fixed cost')}</th><th>{t('ضایعات غیرعادی (هزینه جداگانه)','Abnormal waste (separate expense)')}</th><th>{t('استهلاک','Depreciation')}</th><th>{t('بهره','Interest')}</th><th>{t('زیان تسعیر ارز','FX loss')}</th><th>{t('کسورات مالیاتی','Tax deductions')}</th><th>{t('اعتبار مالیاتی','Tax credits')}</th><th>{t('مالیات','Tax')}</th><th>{t('مبنای مالیات','Tax basis')}</th><th>{t('تغییر سرمایه در گردش','Change in WC')}</th><th>{t('آورده سهامدار برای سرمایه در گردش','Shareholder WC Equity')}</th><th>CFADS</th><th>{t('درآمد سپرده کوتاه‌مدت','Deposit interest')}</th><th>DSCR</th><th>{t('وجه نقد پایان دوره','Closing cash')}</th><th>{t('کسری تأمین مالی','Funding gap')}</th><th>{t('جریان نقدی پروژه','Project FCF')}</th></tr></thead>
          <tbody>{periodicFinanceResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{row.startDate} – {row.endDate}</td><td>{row.days}</td><td>{money(row.revenue)}</td><td>{money(row.otherIncome)}</td><td>{money(row.variableCost)}</td><td>{money(row.fixedCost)}</td><td>{money(row.abnormalWasteExpense)}</td><td>{money(row.depreciation)}</td><td>{money(row.interestExpense)}</td><td>{money(row.foreignExchangeLoss??0)}</td><td>{money(row.taxableDeduction??0)}</td><td>{money(row.taxCredit??0)}</td><td>{money(row.tax)}</td><td>{row.taxAmountSourceReference?t('مبلغ مستند','Documented amount'):row.taxRatePercent==null?'—':money(row.taxRatePercent)+'%'}</td><td>{money(row.changeInWorkingCapital)}</td><td>{money(row.equityWorkingCapitalContribution)}</td><td>{money(row.cfads)}</td><td>{money(row.shortTermDepositInterest)}</td><td>{row.dscr==null?'—':money(row.dscr)+'x'}</td><td>{money(row.closingCash)}</td><td>{money(row.fundingGap)}</td><td>{money(row.projectFreeCashFlow)}</td></tr>)}</tbody>
        </table>
      </div>
      {periodicTaxSourceReference&&<p className="fw-hint">{t('مبالغ مالیات مستقیماً از سند مستند اعمال شده‌اند؛ نرخ مالیاتی فرضی یا استنتاجی استفاده نشده است: ','Tax amounts are applied directly from documented source values; no assumed or inferred tax rate is used: ')}{periodicTaxSourceReference}</p>}
      {periodicOtherIncomeSourceReference&&<p className="fw-hint">{t('سایر درآمد دوره پایانی از ردیف مستند گزارش وارد شده است: ','Terminal other income is transcribed from the documented report row: ')}{periodicOtherIncomeSourceReference}</p>}
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

    {props.onEditFinancialForms&&<div className="fw-result" style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
      <button type="button" className="primary" onClick={props.onEditFinancialForms}>{t('انجام بده','Do it')}</button>
    </div>}
  </div>
}