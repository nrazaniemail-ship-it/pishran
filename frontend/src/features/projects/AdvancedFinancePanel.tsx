import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import {
  calculateIntegratedFinance, calculateAssetDepreciationSchedule, calculateSensitivityMatrix,
  calculateFinancialScenarios, buildThreeFinancialStatements,
  type IntegratedFinanceInput, type IntegratedLoanInput, type DepreciationAssetInput,
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
  workingCapitalDays: { raw: number; wip: number; finished: number; receivable: number; cash: number; payable: number }
  workingCapitalBases: { rawMaterials: number; conversion: number; finishedGoods: number; cash: number; payables: number }
  wipCompletion: { material: number; conversion: number }
  taxRates: number[]
  discountMode: 'wacc' | 'manual'
  manualRate: number
  maintenancePercent: number
}
const money = (v: number) => Number.isFinite(v) ? v.toLocaleString(typeof document!=='undefined'&&document.documentElement.lang==='en'?'en-US':'fa-IR',{maximumFractionDigits:1}) : '—'
const loanMethods: {value: Loan['repaymentMethod']; label:string}[] = [
  {value:'equal-principal',label:'{t('اصل','Principal')} مساوی'}, {value:'annuity',label:'اقساط مساوی'}, {value:'bullet',label:'یکجا در سررسید'}
]
export default function AdvancedFinancePanel(props: Props) {
  const en=props.language==='en'
  const t=(fa:string,english:string)=>en?english:fa
  const loanMethodEn:Record<string,string>={'equal-principal':'Equal Principal','annuity':'Equal Instalments','bullet':'Bullet at Maturity'}
  const years = Math.max(1, Math.min(40, Math.ceil(props.constructionYears) + Math.ceil(props.operatingYears)))
  const construction = Math.max(1, Math.ceil(props.constructionYears))
  const opYears = Math.max(1, years - construction)
  const storageKey = 'feasibility:advanced-finance:' + props.projectId
  const initialCapexSchedule = Array.from({length:years},(_,i)=>i<construction?props.fixedInvestment/construction:0)
  const initialDebtShare = Math.max(0,100-Math.max(0,Math.min(100,props.equityPercent)))/100
  const [state,setState] = useState<SavedState>(() => ({
    loans:[{id:'loan-1',label:'تسهیلات {t('اصل','Principal')}ی',drawdowns:initialCapexSchedule.map(v=>v*initialDebtShare),annualRate:props.costOfDebt,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}],
    assets:props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20})), equityContributions:initialCapexSchedule.map(v=>v*Math.max(0,Math.min(100,props.equityPercent))/100),
    workingCapitalDays:{raw:0,wip:0,finished:0,receivable:0,cash:0,payable:0},
    workingCapitalBases:{rawMaterials:0,conversion:0,finishedGoods:0,cash:0,payables:0},
    wipCompletion:{material:0,conversion:0},taxRates:Array(years).fill(props.taxRate),
    discountMode:'wacc',manualRate:props.costOfEquity,maintenancePercent:0
  }))
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{let alive=true;localStore.get<SavedState>(storageKey).then(saved=>{if(alive){if(saved)setState({...state,...saved});setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{alive=false}},[storageKey])
  useEffect(()=>{if(loaded)void localStore.set(storageKey,state)},[loaded,storageKey,state])

  const capexSchedule = useMemo(()=>Array.from({length:years},(_,i)=>i<construction?props.fixedInvestment/construction:0),[years,construction,props.fixedInvestment])
  const updateLoan=(id:string,patch:Partial<Loan>)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,...patch}:l)}))
  const updateDraw=(id:string,index:number,value:number)=>setState(s=>({...s,loans:s.loans.map(l=>l.id===id?{...l,drawdowns:l.drawdowns.map((v,i)=>i===index?Math.max(0,value):v)}:l)}))
  const syncAssets=()=>setState(s=>({...s,assets:props.capexRows.filter(r=>r.amount>0&&!r.name.includes('زمین')).map((r,i)=>({id:r.id||'asset-'+i,name:r.name,cost:r.amount,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line' as const,decliningRate:20}))}))
  const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),label:'تسهیلات جدید',drawdowns:Array(years).fill(0),annualRate:20,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}]}))
  const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'{t('دارایی','Asset')} جدید',cost:0,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line',decliningRate:20}]}))

  const depreciation = useMemo(()=>calculateAssetDepreciationSchedule(state.assets.filter(a=>a.cost>0&&!a.name.includes('زمین')),years),[state.assets,years])
  const utilization = Array.from({length:years},(_,i)=>i<construction?0:Math.max(0,Math.min(100,props.ramp[i-construction]??100))/100)
  const fixedInvestmentSchedule = capexSchedule
  const workingCapitalPolicy = useMemo(()=>({
    dayBasis:360 as const,rawMaterialDays:state.workingCapitalDays.raw,workInProgressDays:state.workingCapitalDays.wip,
    workInProgressMaterialCompletionPercent:state.wipCompletion.material,workInProgressConversionCompletionPercent:state.wipCompletion.conversion,
    finishedGoodsDays:state.workingCapitalDays.finished,receivableDays:state.workingCapitalDays.receivable,
    cashDays:state.workingCapitalDays.cash,payableDays:state.workingCapitalDays.payable,
    annualRawMaterialCost:state.workingCapitalBases.rawMaterials,
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
    annualDepreciation:0,depreciationSchedule:depreciation.map(r=>r.depreciation),
    maintenanceCapexSchedule,fixedInvestment:props.fixedInvestment,preOperatingCost:0,
    fixedInvestmentSchedule,preOperatingSchedule:Array(years).fill(0),utilization,equityContributions,
    loans:state.loans.map(l=>({...l,drawdowns:Array.from({length:years},(_,i)=>Math.max(0,l.drawdowns[i]??0))})),
    taxRate:props.taxRate,taxRateSchedule:taxRates,waccTaxRate:props.taxRate,costOfEquity:props.costOfEquity,
    workingCapitalPercent:0,workingCapitalPolicy,salesEscalationPercent:0,opexEscalationPercent:0,
    discountMode:state.discountMode,manualDiscountRate:state.manualRate
  }
  const result=useMemo(()=>calculateIntegratedFinance(input),[JSON.stringify(input)])
  const statements=useMemo(()=>buildThreeFinancialStatements(result.years),[result.years])
  const sensitivity=useMemo(()=>calculateSensitivityMatrix(input,[-20,-10,0,10,20],[-20,-10,0,10,20]),[JSON.stringify(input)])
  const scenarios=useMemo(()=>calculateFinancialScenarios(input),[JSON.stringify(input)])
  const updateAsset=(id:string,patch:Partial<Asset>)=>setState(s=>({...s,assets:s.assets.map(a=>a.id===id?{...a,...patch}:a)}))
  const updateDay=(key:keyof SavedState['workingCapitalDays'],value:number)=>setState(s=>({...s,workingCapitalDays:{...s.workingCapitalDays,[key]:Math.max(0,value)}}))
  const setEquity=(index:number,value:number)=>setState(s=>({...s,equityContributions:Array.from({length:years},(_,i)=>i===index?Math.max(0,value):(s.equityContributions[i]??0))}))
  const totalBalanceChecks=statements.filter(r=>r.balanceSheet.reconciled).length

  return <div className="fw-card" style={{marginTop:18}}>
    <h3>{t('موتور مالی یکپارچه و کنترل COMFAR','Integrated Financial Engine & COMFAR Controls')}</h3>
    <p className="fw-lead">{t('برنامه وام، CFADS، سرمایه در گردش دوره‌ای، مالیات با انتقال زیان، استهلاک {t('دارایی','Asset')}‌به‌{t('دارایی','Asset')}، سناریوها و سه صورت مالی در یک مدل مشترک محاسبه می‌شوند. ارقام این بخش {t('از','of')} مفروضات همین پروژه استفاده می‌کنند.','Loan schedules, CFADS, periodic working capital, tax-loss carry-forward, asset-level depreciation, scenarios and three financial statements are calculated in one shared model using this project’s assumptions.')}</p>

    <h4>{t('۱. برنامه برداشت و ب{t('از','of')}پرداخت وام','1. Loan Drawdown & Repayment Schedule')}</h4>
    {state.loans.map(loan=><div className="fw-card" key={loan.id}>
      <div className="fw-grid">
        <label className="fw-field"><span>{t('عنوان تسهیلات','Loan Name')}</span><input value={loan.label} onChange={e=>updateLoan(loan.id,{label:e.target.value})}/></label>
        <label className="fw-field"><span>{t('نرخ {t('سال','Year')}انه','Annual Interest Rate')}</span><input type="number" value={loan.annualRate} onChange={e=>updateLoan(loan.id,{annualRate:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{t('دوره تنفس {t('اصل','Principal')} ({t('سال','Year')})','Principal Grace Period (Years)')}</span><input type="number" min="0" value={loan.graceYears} onChange={e=>updateLoan(loan.id,{graceYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{t('مدت ب{t('از','of')}پرداخت ({t('سال','Year')})','Repayment Term (Years)')}</span><input type="number" min="1" value={loan.termYears} onChange={e=>updateLoan(loan.id,{termYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{t('شروع ب{t('از','of')}پرداخت {t('اصل','Principal')} ({t('سال','Year')} مدل)','Principal Repayment Start (Model Year)')}</span><input type="number" min="1" value={loan.repaymentStartYear} onChange={e=>updateLoan(loan.id,{repaymentStartYear:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>{t('{t('روش','Method')} اقساط','Repayment Method')}</span><select value={loan.repaymentMethod} onChange={e=>updateLoan(loan.id,{repaymentMethod:e.target.value as Loan['repaymentMethod']})}>{loanMethods.map(m=><option key={m.value} value={m.value}>{en?(loanMethodEn[m.value]??m.label):m.label}</option>)}</select></label>
      </div>
      <label className="fw-field"><span><input type="checkbox" checked={loan.capitalizeInterest} onChange={e=>updateLoan(loan.id,{capitalizeInterest:e.target.checked})}/> {t('سرمایه‌ای شدن {t('بهره','Interest')} تا شروع ب{t('از','of')}پرداخت','Capitalise Interest Until Repayment Starts')}</span></label>
      <b>{t('برداشت {t('سال','Year')}انه (واحد پول پایه)','Annual Drawdown (Base Currency)')}</b>
      <div className="fw-grid">{Array.from({length:years},(_,i)=><label className="fw-field" key={i}><span>{t('سال','Year')} {i+1} {i<construction?'· ساخت':'· {t('بهره','Interest')}‌برداری'}</span><input type="number" min="0" value={loan.drawdowns[i]??0} onChange={e=>updateDraw(loan.id,i,Number(e.target.value))}/></label>)}</div>
      <div className="fw-card"><b>{t('برنامه ب{t('از','of')}پرداخت همین تسهیلات','Repayment Schedule for This Loan')}</b>{(result.loanSchedules[loan.id]??[]).map((r,i)=><div className="fw-validation" key={i}><span>{t('سال','Year')} {i+1} · برداشت {money(r.drawdown)} · مانده اول {money(r.openingBalance)}</span><b>{t('بهره','Interest')} نقدی {money(r.interestExpense)} · {t('بهره','Interest')} سرمایه‌ای {money(r.capitalizedInterest)} · {t('اصل','Principal')} {money(r.principal)} · مانده پایان {money(r.closingBalance)}</b></div>)}</div><button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/> {t('حذف تسهیلات','Remove Loan')}</button>
    </div>)}
    <button className="secondary-button" onClick={addLoan}><Plus size={14}/> {t('افزودن وام','Add Loan')}</button>
    <div className="fw-card">
      <h4>{t('آورده نقدی سهامدار به تفکیک {t('سال','Year')}','Annual Shareholder Equity Contributions')}</h4>
      <div className="fw-grid">{Array.from({length:construction},(_,i)=><label className="fw-field" key={i}><span>آورده {t('سال','Year')} ساخت {i+1}</span><input type="number" min="0" value={equityContributions[i]??0} onChange={e=>setEquity(i,Number(e.target.value))}/></label>)}</div>
      <p className="fw-hint">{t('آورده سهامدار را جدا {t('از','of')} برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.','Enter shareholder contributions separately from loan drawdowns. Any funding shortfall will be flagged in the results.')}</p>
    </div>

    <h4>{t('۲. سرمایه در گردش دوره‌ای','2. Periodic Working Capital')}</h4>
    <p className="fw-hint">{t('{t('مبنا','Base Case')}ی روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را {t('از','of')} چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.','The default basis is 360 days. Enter inventory, collection and payment days from the actual operating cycle. Zero means no working capital is allocated to that item.')}</p>
    <div className="fw-grid">
      {([['raw','{t('روز موجودی مواد اولیه','Raw Material Inventory Days')}'],['wip','{t('روز کالای در جریان ساخت','Work-in-Progress Days')}'],['finished','{t('روز محصول نهایی','Finished Goods Days')}'],['receivable','{t('روز وصول مطالبات','Receivable Days')}'],['cash','{t('روز حداقل نقد عملیاتی','Minimum Operating Cash Days')}'],['payable','{t('روز پرداخت بدهی تجاری','Trade Payables Days')}']] as [keyof SavedState['workingCapitalDays'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{label}</span><input type="number" min="0" value={state.workingCapitalDays[key]} onChange={e=>updateDay(key,Number(e.target.value))}/></label>)}
    </div>
    <div className="fw-grid">
      {([['rawMaterials','{t('{t('مبنا','Base Case')}ی {t('سال','Year')}انه مواد اولیه','Annual Raw Material Cost Basis')}'],['conversion','{t('{t('مبنا','Base Case')}ی {t('سال','Year')}انه هزینه تبدیل','Annual Conversion Cost Basis')}'],['finishedGoods','{t('بهای {t('سال','Year')}انه محصول ساخته‌شده','Annual Cost of Finished Goods')}'],['cash','{t('هزینه نقدی {t('سال','Year')}انه برای حداقل نقد','Annual Cash Cost for Minimum Cash')}'],['payables','{t('{t('مبنا','Base Case')}ی {t('سال','Year')}انه بدهی تجاری','Annual Trade Payables Cost Basis')}']] as [keyof SavedState['workingCapitalBases'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{label} ({props.currency})</span><input type="number" min="0" value={state.workingCapitalBases[key]} onChange={e=>setState(s=>({...s,workingCapitalBases:{...s.workingCapitalBases,[key]:Math.max(0,Number(e.target.value))}}))}/></label>)}
      <label className="fw-field"><span>{t('تکمیل مواد در جریان ساخت (%)','WIP Material Completion (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.material} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,material:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
      <label className="fw-field"><span>{t('تکمیل تبدیل در جریان ساخت (%)','WIP Conversion Completion (%)')}</span><input type="number" min="0" max="100" value={state.wipCompletion.conversion} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,conversion:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
    </div>
    <p className="fw-hint">{t('{t('مبنا','Base Case')}ی هزینه‌های سرمایه در گردش عمداً {t('از','of')} OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.','Working-capital cost bases are not automatically split from total OPEX. Enter actual material, conversion, finished-goods, cash and credit-purchase amounts to avoid arbitrary allocations.')}</p>
    <div className="fw-result">{t('اوج نی{t('از','of')} سرمایه در گردش:','Peak Working Capital Requirement:')} <b>{money(result.peakWorkingCapital)} {props.currency}</b> · {t('کسری منابع:','Funding Gap:')} <b>{money(result.fundingGap)} {props.currency}</b></div>
    <div className="fw-card"><b>{t('جدول دوره‌ای سرمایه در گردش','Periodic Working Capital Schedule')}</b>{result.years.map(r=><div className="fw-validation" key={r.year}><span>{t('سال','Year')} {r.year} · مواد {money(r.workingCapitalBreakdown.rawMaterials)} · WIP {money(r.workingCapitalBreakdown.workInProgress)} · محصول {money(r.workingCapitalBreakdown.finishedGoods)} · مطالبات {money(r.workingCapitalBreakdown.receivables)} · پرداختنی {money(r.workingCapitalBreakdown.payables)}</span><b>نی{t('از','of')} طی {t('سال','Year')} {money(r.workingCapital)} · مانده پایان {money(r.closingWorkingCapital)} · تغییر خالص {money(r.changeInWorkingCapital)}</b></div>)}</div>

    <h4>{t('۳. استهلاک {t('دارایی','Asset')}‌به‌{t('دارایی','Asset')} و مالیات','3. Asset-Level Depreciation & Tax')}</h4>
    <p className="fw-hint">{t('{t('دارایی','Asset')}‌ها را {t('از','of')} CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. {t('روش','Method')} {t('خط مستقیم','Straight Line')} یا نزولی، عمر مفید، {t('ارزش اسقاط','Residual Value')} و {t('سال','Year')} شروع هر {t('دارایی','Asset')} مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.','Synchronise assets from CAPEX. Land is non-depreciable by default. Straight-line or declining-balance method, useful life, residual value and depreciation start year are set per asset. Tax-loss carry-forward is applied by the calculation engine.')}</p>
    <div className="fw-grid">{taxRates.map((v,i)=><label className="fw-field" key={i}><span>نرخ مالیات {t('سال','Year')} {i+1} (%)</span><input type="number" min="0" max="100" value={v} onChange={e=>setState(s=>({...s,taxRates:taxRates.map((rate,j)=>j===i?Number(e.target.value):rate)}))}/></label>)}</div>
    <button className="secondary-button" onClick={syncAssets}><RefreshCw size={14}/> {t('همگام‌س{t('از','of')}ی {t('دارایی','Asset')}‌ها {t('از','of')} CAPEX','Sync Assets from CAPEX')}</button>
    {state.assets.map(asset=><div className="fw-grid" key={asset.id}>
      <label className="fw-field"><span>{t('دارایی','Asset')}</span><input value={asset.name} onChange={e=>updateAsset(asset.id,{name:e.target.value})}/></label>
      <label className="fw-field"><span>{t('بهای تمام‌شده','Asset Cost')}</span><input type="number" value={asset.cost} onChange={e=>updateAsset(asset.id,{cost:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>{t('ارزش اسقاط','Residual Value')}</span><input type="number" value={asset.residualValue} onChange={e=>updateAsset(asset.id,{residualValue:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>{t('عمر مفید ({t('سال','Year')})','Useful Life (Years)')}</span><input type="number" min="1" value={asset.usefulLife} onChange={e=>updateAsset(asset.id,{usefulLife:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>{t('شروع استهلاک ({t('سال','Year')} مدل)','Depreciation Start (Model Year)')}</span><input type="number" min="1" value={asset.startYear} onChange={e=>updateAsset(asset.id,{startYear:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>{t('روش','Method')}</span><select value={asset.method} onChange={e=>updateAsset(asset.id,{method:e.target.value as Asset['method']})}><option value="straight-line">{t('خط مستقیم','Straight Line')}</option><option value="declining-balance">{t('مانده نزولی','Declining Balance')}</option></select></label>
      {asset.method==='declining-balance'&&<label className="fw-field"><span>{t('نرخ نزولی (%)','Declining-Balance Rate (%)')}</span><input type="number" value={asset.decliningRate??20} onChange={e=>updateAsset(asset.id,{decliningRate:Number(e.target.value)})}/></label>}
      <button className="secondary-button" onClick={()=>setState(s=>({...s,assets:s.assets.filter(a=>a.id!==asset.id)}))}><Trash2 size={14}/> حذف {t('دارایی','Asset')}</button>
    </div>)}
    <button className="secondary-button" onClick={addAsset}><Plus size={14}/> افزودن {t('دارایی','Asset')}</button>
    <div className="fw-validation"><span>{t('جمع استهلاک {t('سال','Year')}انه (به ترتیب {t('سال','Year')} مدل)','Annual Depreciation by Model Year')}</span><b>{depreciation.map(r=>money(r.depreciation)).join(' · ')}</b></div>
    <div className="fw-grid">
      <label className="fw-field"><span>{t('نرخ تنزیل','Discount Rate')}</span><select value={state.discountMode} onChange={e=>setState(s=>({...s,discountMode:e.target.value as SavedState['discountMode']}))}><option value="wacc">WACC</option><option value="manual">{t('دستی','Manual')}</option></select></label>
      {state.discountMode==='manual'&&<label className="fw-field"><span>{t('نرخ تنزیل','Discount Rate')} {t('دستی','Manual')} (%)</span><input type="number" value={state.manualRate} onChange={e=>setState(s=>({...s,manualRate:Number(e.target.value)}))}/></label>}
      <label className="fw-field"><span>{t('CAPEX نگهداری {t('سال','Year')}انه (% هزینه نقدی)','Annual Maintenance CAPEX (% of Cash Cost)')}</span><input type="number" min="0" value={state.maintenancePercent} onChange={e=>setState(s=>({...s,maintenancePercent:Number(e.target.value)}))}/></label>
    </div>

    <h4>{t('۴. شاخص‌های مالی، CFADS و DSCR','4. Financial Metrics, CFADS & DSCR')}</h4>
    <div className="fw-kpis">
      <article><small>{t('NPV پروژه','Project NPV')}</small><b>{money(result.npvProject??NaN)}</b></article>
      <article><small>{t('IRR پروژه','Project IRR')}</small><b>{result.irrProject==null?'—':money(result.irrProject*100)+'٪'}</b></article>
      <article><small>{t('NPV سهامدار','Equity NPV')}</small><b>{money(result.npvEquity??NaN)}</b></article>
      <article><small>{t('IRR سهامدار','Equity IRR')}</small><b>{result.irrEquity==null?'—':money(result.irrEquity*100)+'٪'}</b></article>
      <article><small>WACC</small><b>{result.wacc==null?'—':money(result.wacc*100)+'٪'}</b></article>
      <article><small>{t('اوج سرمایه در گردش','Peak Working Capital')}</small><b>{money(result.peakWorkingCapital)}</b></article>
      <article><small>{t('کل برداشت وام','Total Debt Drawdown')}</small><b>{money(result.totalDebtDrawdown)}</b></article>
      <article><small>{t('کل آورده','Total Equity Contribution')}</small><b>{money(result.totalEquityContribution)}</b></article>
    </div>
    <div className="fw-card"><h4>{t('جدول {t('سال','Year')}انه خدمت بدهی','Annual Debt Service Schedule')}</h4>
      <div className="fw-validation"><b>{t('سال','Year')}</b><b>CFADS</b><b>{t('بهره','Interest')}</b><b>{t('اصل','Principal')}</b><b>DSCR</b><b>{t('مانده بدهی','Debt Balance')}</b></div>
      {result.years.map(r=><div className="fw-validation" key={r.year}><span>{r.year}</span><span>{money(r.cfads)}</span><span>{money(r.interest)}</span><span>{money(r.principal)}</span><b>{r.dscr==null?'—':money(r.dscr)+'x'}</b><span>{money(r.debtBalance)}</span></div>)}
    </div>
    {result.warnings.length>0&&<ul className="fw-checklist">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}

    <h4>{t('۵. تحلیل حساسیت چندمتغیره','5. Multivariable Sensitivity Analysis')}</h4>
    <p className="fw-hint">ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت ف{t('روش','Method')} را نشان می‌دهند. مقادیر {t('NPV پروژه','Project NPV')} با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.</p>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('حجم \ قیمت','Volume \ Price')}</th>{[-20,-10,0,10,20].map(v=><th key={v}>{v}%</th>)}</tr></thead><tbody>{sensitivity.map((row,i)=><tr key={i}><th>{[-20,-10,0,10,20][i]}%</th>{row.map((cell,j)=><td key={j}>{cell.npv==null?'—':money(cell.npv)}</td>)}</tr>)}</tbody></table></div>
    <h4>{t('۶. سناریوهای {t('خوش‌بینانه','Optimistic')} و {t('بدبینانه','Pessimistic')}','6. Optimistic & Pessimistic Scenarios')}</h4>
    <div className="fw-grid">
      <div className="fw-result">{t('بدبینانه','Pessimistic')} · NPV {money(scenarios.pessimistic.npvProject??NaN)} · IRR {scenarios.pessimistic.irrProject==null?'—':money(scenarios.pessimistic.irrProject*100)+'٪'}</div>
      <div className="fw-result">{t('مبنا','Base Case')} · NPV {money(scenarios.base.npvProject??NaN)} · IRR {scenarios.base.irrProject==null?'—':money(scenarios.base.irrProject*100)+'٪'}</div>
      <div className="fw-result">{t('خوش‌بینانه','Optimistic')} · NPV {money(scenarios.optimistic.npvProject??NaN)} · IRR {scenarios.optimistic.irrProject==null?'—':money(scenarios.optimistic.irrProject*100)+'٪'}</div>
    </div>

    <h4>{t('۷. تطبیق سه صورت مالی و کنترل تر{t('از','of')}نامه','7. Three-Statement Reconciliation & Balance Sheet Check')}</h4>
    <div className="fw-result">{t('تر{t('از','of')}های منطبق:','Reconciled Balances:')} <b>{totalBalanceChecks} {t('از','of')} {statements.length}</b> دوره</div>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('سال','Year')}</th><th>ف{t('روش','Method')}</th><th>EBIT</th><th>زیان انتقالی پایان {t('سال','Year')}</th><th>سود خالص</th><th>جریان نقد پایان {t('سال','Year')}</th><th>جمع {t('دارایی','Asset')}‌ها</th><th>بدهی + حقوق مالکانه</th><th>اختلاف تر{t('از','of')}</th></tr></thead><tbody>{statements.map(r=><tr key={r.year}><td>{r.year}</td><td>{money(r.incomeStatement.revenue)}</td><td>{money(r.incomeStatement.ebit)}</td><td>{money(r.incomeStatement.taxLossCarryForward)}</td><td>{money(r.incomeStatement.netIncome)}</td><td>{money(r.cashFlowStatement.closingCash)}</td><td>{money(r.balanceSheet.totalAssets)}</td><td>{money(r.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(r.balanceSheet.balanceDifference)} {r.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody></table></div>
    <p className="fw-hint">صورت‌ها {t('از','of')} یک مجموعه جریان نقدی و برنامه {t('دارایی','Asset')}/بدهی ساخته می‌شوند؛ هیچ رقم تر{t('از','of')}کنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تر{t('از','of')} صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.</p>
  </div>
}
