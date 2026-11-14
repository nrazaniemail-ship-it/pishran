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
const money = (v: number) => Number.isFinite(v) ? v.toLocaleString('fa-IR',{maximumFractionDigits:1}) : '—'
const loanMethods: {value: Loan['repaymentMethod']; label:string}[] = [
  {value:'equal-principal',label:'اصل مساوی'}, {value:'annuity',label:'اقساط مساوی'}, {value:'bullet',label:'یکجا در سررسید'}
]
export default function AdvancedFinancePanel(props: Props) {
  const years = Math.max(1, Math.min(40, Math.ceil(props.constructionYears) + Math.ceil(props.operatingYears)))
  const construction = Math.max(1, Math.ceil(props.constructionYears))
  const opYears = Math.max(1, years - construction)
  const storageKey = 'feasibility:advanced-finance:' + props.projectId
  const initialCapexSchedule = Array.from({length:years},(_,i)=>i<construction?props.fixedInvestment/construction:0)
  const initialDebtShare = Math.max(0,100-Math.max(0,Math.min(100,props.equityPercent)))/100
  const [state,setState] = useState<SavedState>(() => ({
    loans:[{id:'loan-1',label:'تسهیلات اصلی',drawdowns:initialCapexSchedule.map(v=>v*initialDebtShare),annualRate:props.costOfDebt,graceYears:0,termYears:Math.max(1,opYears),repaymentStartYear:construction+1,repaymentMethod:'equal-principal',capitalizeInterest:true}],
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
  const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی جدید',cost:0,residualValue:0,usefulLife:10,startYear:construction+1,method:'straight-line',decliningRate:20}]}))

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
  const maintenanceCapexSchedule = utilization.map(u=>(props.fullCapacityFixedCashCost+props.fullCapacityVariableCashCost)*u*state.maintenancePercent/100)
  const input: IntegratedFinanceInput = {
    years,constructionYears:construction,capacity:props.capacity,fullCapacityRevenue:props.fullCapacityRevenue,
    fullCapacityVariableCashCost:props.fullCapacityVariableCashCost,fullCapacityFixedCashCost:props.fullCapacityFixedCashCost,
    annualDepreciation:0,depreciationSchedule:depreciation.map(r=>r.depreciation),
    maintenanceCapexSchedule,fixedInvestment:props.fixedInvestment,preOperatingCost:0,
    fixedInvestmentSchedule,preOperatingSchedule:Array(years).fill(0),utilization,equityContributions,
    loans:state.loans.map(l=>({...l,drawdowns:Array.from({length:years},(_,i)=>Math.max(0,l.drawdowns[i]??0))})),
    taxRate:props.taxRate,taxRateSchedule:state.taxRates.length===years?state.taxRates:Array(years).fill(props.taxRate),waccTaxRate:props.taxRate,costOfEquity:props.costOfEquity,
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
    <h3>موتور مالی یکپارچه و کنترل COMFAR</h3>
    <p className="fw-lead">برنامه وام، CFADS، سرمایه در گردش دوره‌ای، مالیات با انتقال زیان، استهلاک دارایی‌به‌دارایی، سناریوها و سه صورت مالی در یک مدل مشترک محاسبه می‌شوند. ارقام این بخش از مفروضات همین پروژه استفاده می‌کنند.</p>

    <h4>۱. برنامه برداشت و بازپرداخت وام</h4>
    {state.loans.map(loan=><div className="fw-card" key={loan.id}>
      <div className="fw-grid">
        <label className="fw-field"><span>عنوان تسهیلات</span><input value={loan.label} onChange={e=>updateLoan(loan.id,{label:e.target.value})}/></label>
        <label className="fw-field"><span>نرخ سالانه</span><input type="number" value={loan.annualRate} onChange={e=>updateLoan(loan.id,{annualRate:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>دوره تنفس اصل (سال)</span><input type="number" min="0" value={loan.graceYears} onChange={e=>updateLoan(loan.id,{graceYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>مدت بازپرداخت (سال)</span><input type="number" min="1" value={loan.termYears} onChange={e=>updateLoan(loan.id,{termYears:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>شروع بازپرداخت اصل (سال مدل)</span><input type="number" min="1" value={loan.repaymentStartYear} onChange={e=>updateLoan(loan.id,{repaymentStartYear:Number(e.target.value)})}/></label>
        <label className="fw-field"><span>روش اقساط</span><select value={loan.repaymentMethod} onChange={e=>updateLoan(loan.id,{repaymentMethod:e.target.value as Loan['repaymentMethod']})}>{loanMethods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></label>
      </div>
      <label className="fw-field"><span><input type="checkbox" checked={loan.capitalizeInterest} onChange={e=>updateLoan(loan.id,{capitalizeInterest:e.target.checked})}/> سرمایه‌ای شدن بهره تا شروع بازپرداخت</span></label>
      <b>برداشت سالانه (واحد پول پایه)</b>
      <div className="fw-grid">{Array.from({length:years},(_,i)=><label className="fw-field" key={i}><span>سال {i+1} {i<construction?'· ساخت':'· بهره‌برداری'}</span><input type="number" min="0" value={loan.drawdowns[i]??0} onChange={e=>updateDraw(loan.id,i,Number(e.target.value))}/></label>)}</div>
      <div className="fw-card"><b>برنامه بازپرداخت همین تسهیلات</b>{(result.loanSchedules[loan.id]??[]).map((r,i)=><div className="fw-validation" key={i}><span>سال {i+1} · برداشت {money(r.drawdown)} · مانده اول {money(r.openingBalance)}</span><b>بهره نقدی {money(r.interestExpense)} · بهره سرمایه‌ای {money(r.capitalizedInterest)} · اصل {money(r.principal)} · مانده پایان {money(r.closingBalance)}</b></div>)}</div><button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/> حذف تسهیلات</button>
    </div>)}
    <button className="secondary-button" onClick={addLoan}><Plus size={14}/> افزودن وام</button>
    <div className="fw-card">
      <h4>آورده نقدی سهامدار به تفکیک سال</h4>
      <div className="fw-grid">{Array.from({length:construction},(_,i)=><label className="fw-field" key={i}><span>آورده سال ساخت {i+1}</span><input type="number" min="0" value={equityContributions[i]??0} onChange={e=>setEquity(i,Number(e.target.value))}/></label>)}</div>
      <p className="fw-hint">آورده سهامدار را جدا از برداشت وام وارد کنید. کسری منابع، در خروجی هشدار داده می‌شود.</p>
    </div>

    <h4>۲. سرمایه در گردش دوره‌ای</h4>
    <p className="fw-hint">مبنای روز ۳۶۰ روز است. روزهای نگهداری/وصول/پرداخت را از چرخه واقعی پروژه وارد کنید؛ مقدار صفر یعنی برای آن قلم سرمایه در گردش منظور نمی‌شود.</p>
    <div className="fw-grid">
      {([['raw','روز موجودی مواد اولیه'],['wip','روز کالای در جریان ساخت'],['finished','روز محصول نهایی'],['receivable','روز وصول مطالبات'],['cash','روز حداقل نقد عملیاتی'],['payable','روز پرداخت بدهی تجاری']] as [keyof SavedState['workingCapitalDays'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{label}</span><input type="number" min="0" value={state.workingCapitalDays[key]} onChange={e=>updateDay(key,Number(e.target.value))}/></label>)}
    </div>
    <div className="fw-grid">
      {([['rawMaterials','مبنای سالانه مواد اولیه'],['conversion','مبنای سالانه هزینه تبدیل'],['finishedGoods','بهای سالانه محصول ساخته‌شده'],['cash','هزینه نقدی سالانه برای حداقل نقد'],['payables','مبنای سالانه بدهی تجاری']] as [keyof SavedState['workingCapitalBases'],string][]).map(([key,label])=><label className="fw-field" key={key}><span>{label} ({props.currency})</span><input type="number" min="0" value={state.workingCapitalBases[key]} onChange={e=>setState(s=>({...s,workingCapitalBases:{...s.workingCapitalBases,[key]:Math.max(0,Number(e.target.value))}}))}/></label>)}
      <label className="fw-field"><span>تکمیل مواد در جریان ساخت (%)</span><input type="number" min="0" max="100" value={state.wipCompletion.material} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,material:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
      <label className="fw-field"><span>تکمیل تبدیل در جریان ساخت (%)</span><input type="number" min="0" max="100" value={state.wipCompletion.conversion} onChange={e=>setState(s=>({...s,wipCompletion:{...s.wipCompletion,conversion:Math.max(0,Math.min(100,Number(e.target.value)))}}))}/></label>
    </div>
    <p className="fw-hint">مبنای هزینه‌های سرمایه در گردش عمداً از OPEX کل به‌صورت خودکار تفکیک نمی‌شود؛ ارقام واقعی مواد، تبدیل، محصول، نقد و خرید اعتباری را وارد کنید تا تقسیم‌بندی فرضی در مدل ایجاد نشود.</p>
    <div className="fw-result">اوج نیاز سرمایه در گردش: <b>{money(result.peakWorkingCapital)} {props.currency}</b> · کسری منابع: <b>{money(result.fundingGap)} {props.currency}</b></div>

    <h4>۳. استهلاک دارایی‌به‌دارایی و مالیات</h4>
    <p className="fw-hint">دارایی‌ها را از CAPEX همگام کنید؛ زمین به‌طور پیش‌فرض مستهلک نمی‌شود. روش خط مستقیم یا نزولی، عمر مفید، ارزش اسقاط و سال شروع هر دارایی مستقل است. انتقال زیان مالیاتی در موتور محاسباتی اعمال می‌شود.</p>
    <div className="fw-grid">{state.taxRates.map((v,i)=><label className="fw-field" key={i}><span>نرخ مالیات سال {i+1} (%)</span><input type="number" min="0" max="100" value={v} onChange={e=>setState(s=>({...s,taxRates:s.taxRates.map((rate,j)=>j===i?Number(e.target.value):rate)}))}/></label>)}</div>
    <button className="secondary-button" onClick={syncAssets}><RefreshCw size={14}/> همگام‌سازی دارایی‌ها از CAPEX</button>
    {state.assets.map(asset=><div className="fw-grid" key={asset.id}>
      <label className="fw-field"><span>دارایی</span><input value={asset.name} onChange={e=>updateAsset(asset.id,{name:e.target.value})}/></label>
      <label className="fw-field"><span>بهای تمام‌شده</span><input type="number" value={asset.cost} onChange={e=>updateAsset(asset.id,{cost:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>ارزش اسقاط</span><input type="number" value={asset.residualValue} onChange={e=>updateAsset(asset.id,{residualValue:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>عمر مفید (سال)</span><input type="number" min="1" value={asset.usefulLife} onChange={e=>updateAsset(asset.id,{usefulLife:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>شروع استهلاک (سال مدل)</span><input type="number" min="1" value={asset.startYear} onChange={e=>updateAsset(asset.id,{startYear:Number(e.target.value)})}/></label>
      <label className="fw-field"><span>روش</span><select value={asset.method} onChange={e=>updateAsset(asset.id,{method:e.target.value as Asset['method']})}><option value="straight-line">خط مستقیم</option><option value="declining-balance">مانده نزولی</option></select></label>
      {asset.method==='declining-balance'&&<label className="fw-field"><span>نرخ نزولی (%)</span><input type="number" value={asset.decliningRate??20} onChange={e=>updateAsset(asset.id,{decliningRate:Number(e.target.value)})}/></label>}
      <button className="secondary-button" onClick={()=>setState(s=>({...s,assets:s.assets.filter(a=>a.id!==asset.id)}))}><Trash2 size={14}/> حذف دارایی</button>
    </div>)}
    <button className="secondary-button" onClick={addAsset}><Plus size={14}/> افزودن دارایی</button>
    <div className="fw-validation"><span>جمع استهلاک سالانه (به ترتیب سال مدل)</span><b>{depreciation.map(r=>money(r.depreciation)).join(' · ')}</b></div>
    <div className="fw-grid">
      <label className="fw-field"><span>نرخ تنزیل</span><select value={state.discountMode} onChange={e=>setState(s=>({...s,discountMode:e.target.value as SavedState['discountMode']}))}><option value="wacc">WACC</option><option value="manual">دستی</option></select></label>
      {state.discountMode==='manual'&&<label className="fw-field"><span>نرخ تنزیل دستی (%)</span><input type="number" value={state.manualRate} onChange={e=>setState(s=>({...s,manualRate:Number(e.target.value)}))}/></label>}
      <label className="fw-field"><span>CAPEX نگهداری سالانه (% هزینه نقدی)</span><input type="number" min="0" value={state.maintenancePercent} onChange={e=>setState(s=>({...s,maintenancePercent:Number(e.target.value)}))}/></label>
    </div>

    <h4>۴. شاخص‌های مالی، CFADS و DSCR</h4>
    <div className="fw-kpis">
      <article><small>NPV پروژه</small><b>{money(result.npvProject??NaN)}</b></article>
      <article><small>IRR پروژه</small><b>{result.irrProject==null?'—':money(result.irrProject*100)+'٪'}</b></article>
      <article><small>NPV سهامدار</small><b>{money(result.npvEquity??NaN)}</b></article>
      <article><small>IRR سهامدار</small><b>{result.irrEquity==null?'—':money(result.irrEquity*100)+'٪'}</b></article>
      <article><small>WACC</small><b>{result.wacc==null?'—':money(result.wacc*100)+'٪'}</b></article>
      <article><small>اوج سرمایه در گردش</small><b>{money(result.peakWorkingCapital)}</b></article>
      <article><small>کل برداشت وام</small><b>{money(result.totalDebtDrawdown)}</b></article>
      <article><small>کل آورده</small><b>{money(result.totalEquityContribution)}</b></article>
    </div>
    <div className="fw-card"><h4>جدول سالانه خدمت بدهی</h4>
      <div className="fw-validation"><b>سال</b><b>CFADS</b><b>بهره</b><b>اصل</b><b>DSCR</b><b>مانده بدهی</b></div>
      {result.years.map(r=><div className="fw-validation" key={r.year}><span>{r.year}</span><span>{money(r.cfads)}</span><span>{money(r.interest)}</span><span>{money(r.principal)}</span><b>{r.dscr==null?'—':money(r.dscr)+'x'}</b><span>{money(r.debtBalance)}</span></div>)}
    </div>
    {result.warnings.length>0&&<ul className="fw-checklist">{result.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}

    <h4>۵. تحلیل حساسیت چندمتغیره</h4>
    <p className="fw-hint">ردیف‌ها تغییر حجم/ظرفیت و ستون‌ها تغییر قیمت فروش را نشان می‌دهند. مقادیر NPV پروژه با همان برنامه وام، مالیات و سرمایه در گردش دوباره محاسبه می‌شوند.</p>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>حجم \ قیمت</th>{[-20,-10,0,10,20].map(v=><th key={v}>{v}%</th>)}</tr></thead><tbody>{sensitivity.map((row,i)=><tr key={i}><th>{[-20,-10,0,10,20][i]}%</th>{row.map((cell,j)=><td key={j}>{cell.npv==null?'—':money(cell.npv)}</td>)}</tr>)}</tbody></table></div>
    <h4>۶. سناریوهای خوش‌بینانه و بدبینانه</h4>
    <div className="fw-grid">
      <div className="fw-result">بدبینانه · NPV {money(scenarios.pessimistic.npvProject??NaN)} · IRR {scenarios.pessimistic.irrProject==null?'—':money(scenarios.pessimistic.irrProject*100)+'٪'}</div>
      <div className="fw-result">مبنا · NPV {money(scenarios.base.npvProject??NaN)} · IRR {scenarios.base.irrProject==null?'—':money(scenarios.base.irrProject*100)+'٪'}</div>
      <div className="fw-result">خوش‌بینانه · NPV {money(scenarios.optimistic.npvProject??NaN)} · IRR {scenarios.optimistic.irrProject==null?'—':money(scenarios.optimistic.irrProject*100)+'٪'}</div>
    </div>

    <h4>۷. تطبیق سه صورت مالی و کنترل ترازنامه</h4>
    <div className="fw-result">ترازهای منطبق: <b>{totalBalanceChecks} از {statements.length}</b> دوره</div>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>سال</th><th>فروش</th><th>EBIT</th><th>زیان انتقالی پایان سال</th><th>سود خالص</th><th>جریان نقد پایان سال</th><th>جمع دارایی‌ها</th><th>بدهی + حقوق مالکانه</th><th>اختلاف تراز</th></tr></thead><tbody>{statements.map(r=><tr key={r.year}><td>{r.year}</td><td>{money(r.incomeStatement.revenue)}</td><td>{money(r.incomeStatement.ebit)}</td><td>{money(r.incomeStatement.taxLossCarryForward)}</td><td>{money(r.incomeStatement.netIncome)}</td><td>{money(r.cashFlowStatement.closingCash)}</td><td>{money(r.balanceSheet.totalAssets)}</td><td>{money(r.balanceSheet.totalLiabilitiesAndEquity)}</td><td>{money(r.balanceSheet.balanceDifference)} {r.balanceSheet.reconciled?'✓':'⚠'}</td></tr>)}</tbody></table></div>
    <p className="fw-hint">صورت‌ها از یک مجموعه جریان نقدی و برنامه دارایی/بدهی ساخته می‌شوند؛ هیچ رقم ترازکنندهٔ مصنوعی به حقوق مالکانه اضافه نمی‌شود. اگر اختلاف تراز صفر نباشد، خروجی به‌عنوان عدم تطبیق علامت می‌خورد و باید طبقه‌بندی CAPEX، آورده، بدهی یا سرمایه در گردش بررسی شود. این نسخه هنوز اقلام حسابداری تفصیلی مانند مالیات بر ارزش افزوده، سود تقسیمی، مطالبات/بدهی مالیاتی، تجدید ارزیابی و ثبت‌های چندارزی را پوشش نمی‌دهد.</p>
  </div>
}
