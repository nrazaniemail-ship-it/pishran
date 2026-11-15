import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { calculateIncrementalEnterpriseAnalysis, calculateExistingLoanSchedule, type ExistingLoanRepaymentType, type EnterpriseScenarioPeriodInput } from '../steel/financialModel'

type Asset = { id:string; name:string; grossCost:number; accumulatedDepreciation:number; remainingLife:number; opportunityValue:number; residualValue?:number; commissioningDate?:string; depreciationMethod?:'straight-line'|'declining-balance'|'none'; costCentre?:string; foreignSharePercent?:number; status:'active'|'replace'|'idle'|'sell' }
type ProductBalance = {id:string;productName:string;localValue:number;foreignValue:number}
type EquityCapitalBalance = {id:string;partnerName:string;capitalClass:'ordinary'|'preference';origin:'local'|'foreign';paidIn:number;paidOut:number;preferredDividendPercent:number;profitExportPercent:number}
type FinishedProductBalance = {id:string;productName:string;quantity:number;unitPrice:number;foreignSharePercent:number}
type LegacyLoan = { id:string; name:string; openingBalance:number; annualRate:number; annualDebtService:number; maturityYears?:number; graceYears?:number; repaymentFrequency?:'annual'|'semiannual'|'quarterly'|'monthly'; repaymentMethod?:'equal-principal'|'annuity'|'bullet'; repaymentType?:ExistingLoanRepaymentType; numberOfRepayments?:number; capitalizeGraceInterest?:boolean; profileRepayments?:{id:string;date:string;principal:number}[]; interestPaymentMonth?:number; nextPaymentDate?:string; accruedInterest?:number; fees?:number }
type Opening = {
  rawMaterialsLocal:number; rawMaterialsForeign:number; suppliesLocal:number; suppliesForeign:number; wipLocal:number; wipForeign:number; finishedQuantity:number; finishedUnitPrice:number; finishedForeignShare:number
  receivablesLocal:number; receivablesForeign:number; receivableDaysLocal:number; receivableDaysForeign:number
  cashLocal:number; cashForeign:number; shortTermDepositsLocal:number; cashSurplusLocal:number; cashSurplusForeign:number
  payablesLocal:number; payablesForeign:number; payableDaysLocal:number; payableDaysForeign:number
  otherAssetsLocal:number; otherLiabilitiesLocal:number; paidInCapital:number; retainedEarnings:number; accumulatedLosses:number; grants:number
}
type State = { baseDate:string; mode:'expansion'|'rehabilitation'|'combined'; opening:Opening; workInProgress:ProductBalance[]; finishedProducts:FinishedProductBalance[]; equityCapital:EquityCapitalBalance[]; assets:Asset[]; loans:LegacyLoan[]; without:EnterpriseScenarioPeriodInput[]; with:EnterpriseScenarioPeriodInput[]; discountRate:number }
const blankOpening:Opening={rawMaterialsLocal:0,rawMaterialsForeign:0,suppliesLocal:0,suppliesForeign:0,wipLocal:0,wipForeign:0,finishedQuantity:0,finishedUnitPrice:0,finishedForeignShare:0,receivablesLocal:0,receivablesForeign:0,receivableDaysLocal:0,receivableDaysForeign:0,cashLocal:0,cashForeign:0,shortTermDepositsLocal:0,cashSurplusLocal:0,cashSurplusForeign:0,payablesLocal:0,payablesForeign:0,payableDaysLocal:0,payableDaysForeign:0,otherAssetsLocal:0,otherLiabilitiesLocal:0,paidInCapital:0,retainedEarnings:0,accumulatedLosses:0,grants:0}
const emptyPeriod=():EnterpriseScenarioPeriodInput=>({revenue:0,cashOperatingCosts:0,tax:0,capex:0,opportunityCost:0,changeInWorkingCapital:0,assetSaleProceeds:0,terminalValue:0})
const initialState=(horizon:number):State=>({baseDate:'',mode:'expansion',opening:{...blankOpening},workInProgress:[],finishedProducts:[],equityCapital:[],assets:[],loans:[],without:Array.from({length:horizon},emptyPeriod),with:Array.from({length:horizon},emptyPeriod),discountRate:25})
const fmt=(v:number)=>Number.isFinite(v)?v.toLocaleString('fa-IR',{maximumFractionDigits:2}):'—'
const comfarTermsEn:Record<string,string>={
 'موجودی مواد اولیه ـ ارز محلی':'Raw materials — local currency',
 'موجودی مواد اولیه ـ جزء ارز خارجی':'Raw materials — foreign currency component',
 'مواد و ملزومات ـ ارز محلی':'Supplies — local currency',
 'مواد و ملزومات ـ جزء ارز خارجی':'Supplies — foreign currency component',
 'کالای در جریان ساخت ـ ارز محلی':'Work in progress — local currency',
 'کالای در جریان ساخت ـ جزء ارز خارجی':'Work in progress — foreign currency component',
 'حساب‌های دریافتنی ـ ارز محلی':'Accounts receivable — local currency',
 'حساب‌های دریافتنی ـ جزء ارز خارجی':'Accounts receivable — foreign currency component',
 'وجه نقد ـ ارز محلی':'Cash-in-hand — local currency',
 'وجه نقد ـ جزء ارز خارجی':'Cash-in-hand — foreign currency component',
 'سپرده کوتاه‌مدت محلی':'Short-term deposits — local currency only',
 'مازاد نقدی محلی':'Cash surplus — local currency',
 'مازاد نقدی خارجی':'Cash surplus — foreign currency component',
 'حساب‌های پرداختنی ـ ارز محلی':'Accounts payable — local currency',
 'حساب‌های پرداختنی ـ جزء ارز خارجی':'Accounts payable — foreign currency component',
 'سایر دارایی‌های جاری محلی':'Other assets — local currency',
 'سایر بدهی‌های جاری محلی':'Other liabilities — local currency',
 'سرمایه پرداخت‌شده':'Equity capital — paid-in capital',
 'اندوخته و سود انباشته':'Reserves and retained earnings',
 'زیان انباشته':'Accumulated losses',
 'یارانه‌ها و کمک‌های بلاعوض':'Subsidies and grants',
 'شرح دارایی':'Fixed investment item',
 'ارزش اسقاط':'Residual / salvage value',
 'تاریخ بهره‌برداری':'Date put into operation',
 'روش استهلاک':'Depreciation method',
 'مرکز هزینه':'Cost Centre',
 'سهم جزء ارزی (%)':'Foreign Currency Component (%)',
 'مدت سررسید (سال)':'Maturity (years)',
 'دوره تنفس (سال)':'Grace Period (years)',
 'تناوب بازپرداخت':'Repayment Frequency',
 'روش بازپرداخت':'Repayment Type',
 'تعداد اقساط':'Number of Repayments',
 'سرمایه‌ای‌کردن بهره دوره تنفس':'Capitalize Interest During Grace Period',
 'اقساط پروفایل':'Profile Repayments',
 'تاریخ قسط بعدی':'Next Instalment Date',
 'بهره معوق/پرداختنی':'Accrued / Payable Interest',
 'کارمزد و هزینه‌ها':'Fees and Charges',
 'بهای تمام‌شده':'Gross cost',
 'استهلاک انباشته':'Accumulated depreciation',
 'عمر مفید باقیمانده':'Remaining useful life',
 'ارزش فرصت / بازار':'Opportunity value / market value',
 'عنوان تسهیلات':'Long-term debt description',
 'مانده اصل بدهی':'Outstanding principal balance',
 'نرخ بهره سالانه (%)':'Annual interest rate (%)',
 'خدمت بدهی سالانه':'Annual debt service',
 'فعال':'In operation',
 'جایگزین‌شونده':'To be replaced',
 'بلااستفاده':'Idle',
 'قابل فروش':'For sale'
}
const moneyKeys:[keyof Opening,string][]=[
 ['rawMaterialsLocal','موجودی مواد اولیه ـ ارز محلی'],['rawMaterialsForeign','موجودی مواد اولیه ـ جزء ارز خارجی'],['suppliesLocal','مواد و ملزومات ـ ارز محلی'],['suppliesForeign','مواد و ملزومات ـ جزء ارز خارجی'],['wipLocal','کالای در جریان ساخت ـ ارز محلی'],['wipForeign','کالای در جریان ساخت ـ جزء ارز خارجی'],['receivablesLocal','حساب‌های دریافتنی ـ ارز محلی'],['receivablesForeign','حساب‌های دریافتنی ـ جزء ارز خارجی'],['cashLocal','وجه نقد ـ ارز محلی'],['cashForeign','وجه نقد ـ جزء ارز خارجی'],['shortTermDepositsLocal','سپرده کوتاه‌مدت محلی'],['cashSurplusLocal','مازاد نقدی محلی'],['cashSurplusForeign','مازاد نقدی ارزی'],['payablesLocal','حساب‌های پرداختنی ـ ارز محلی'],['payablesForeign','حساب‌های پرداختنی ـ جزء ارز خارجی'],['otherAssetsLocal','سایر دارایی‌های جاری محلی'],['otherLiabilitiesLocal','سایر بدهی‌های جاری محلی'],['retainedEarnings','اندوخته و سود انباشته'],['accumulatedLosses','زیان انباشته'],['grants','یارانه‌ها و کمک‌های بلاعوض']
]
type Props={projectId:string;currency:string;constructionYears:number;operatingYears:number;language?:'fa'|'en'}
export default function ExpansionRehabilitationPanel({projectId,currency,constructionYears,operatingYears,language='fa'}:Props){
 const en=language==='en', t=(fa:string,english:string)=>en?english:fa
 const horizon=Math.max(2,Math.min(30,Math.ceil(constructionYears)+Math.ceil(operatingYears)))
 const key='feasibility:expansion-rehabilitation:'+projectId
 const [state,setState]=useState<State>(()=>initialState(horizon))
 const [loaded,setLoaded]=useState(false)
 useEffect(()=>{let active=true;localStore.get<State>(key).then(saved=>{if(active){if(saved){const defaults=initialState(horizon);setState({...defaults,...saved,opening:{...blankOpening,...saved.opening},workInProgress:saved.workInProgress??((saved.opening?.wipLocal||saved.opening?.wipForeign)?[{id:'legacy-wip',productName:'محصول/کالای در جریان ساخت ـ طبقه‌بندی‌نشده',localValue:saved.opening?.wipLocal??0,foreignValue:saved.opening?.wipForeign??0}]:[]),finishedProducts:saved.finishedProducts??((saved.opening?.finishedQuantity||saved.opening?.finishedUnitPrice)?[{id:'legacy-finished',productName:'محصول نهایی ـ طبقه‌بندی‌نشده',quantity:saved.opening?.finishedQuantity??0,unitPrice:saved.opening?.finishedUnitPrice??0,foreignSharePercent:saved.opening?.finishedForeignShare??0}]:[]),equityCapital:saved.equityCapital??((saved.opening?.paidInCapital??0)>0?[{id:'legacy-equity',partnerName:'سرمایه‌گذار موجود',capitalClass:'ordinary',origin:'local',paidIn:saved.opening?.paidInCapital??0,paidOut:0,preferredDividendPercent:0,profitExportPercent:0}]:[]),without:Array.from({length:horizon},(_,i)=>saved.without?.[i]??emptyPeriod()),with:Array.from({length:horizon},(_,i)=>saved.with?.[i]??emptyPeriod())})}setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{active=false}},[key,horizon])
 useEffect(()=>{if(loaded)void localStore.set(key,state)},[loaded,key,state])
 const updateOpening=(field:keyof Opening,value:number)=>setState(s=>({...s,opening:{...s.opening,[field]:field==='finishedForeignShare'?Math.max(0,Math.min(100,value)):Math.max(0,value)}}))
 const updatePeriod=(scenario:'without'|'with',index:number,field:keyof EnterpriseScenarioPeriodInput,value:number)=>setState(s=>({...s,[scenario]:s[scenario].map((row,i)=>i===index?{...row,[field]:value}:row)}))
 const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی موجود',grossCost:0,accumulatedDepreciation:0,remainingLife:10,opportunityValue:0,residualValue:0,commissioningDate:'',depreciationMethod:'straight-line',costCentre:'',foreignSharePercent:0,status:'active'}]}))
 const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),name:'تسهیلات موجود',openingBalance:0,annualRate:0,annualDebtService:0,maturityYears:0,graceYears:0,repaymentFrequency:'quarterly',repaymentMethod:'annuity',repaymentType:'annuity',numberOfRepayments:20,capitalizeGraceInterest:true,profileRepayments:[],interestPaymentMonth:12,nextPaymentDate:'',accruedInterest:0,fees:0}]}))
 const fixedGross=state.assets.reduce((sum,a)=>sum+a.grossCost,0)
 const fixedAccum=state.assets.reduce((sum,a)=>sum+a.accumulatedDepreciation,0)
 const fixedNet=fixedGross-fixedAccum
 const finished=state.finishedProducts.reduce((sum,item)=>sum+item.quantity*item.unitPrice,0)+((state.finishedProducts.length===0)?state.opening.finishedQuantity*state.opening.finishedUnitPrice:0)
 const wipTotal=state.workInProgress.reduce((sum,item)=>sum+item.localValue+item.foreignValue,0)+((state.workInProgress.length===0)?state.opening.wipLocal+state.opening.wipForeign:0)
 const currentAssets=state.opening.rawMaterialsLocal+state.opening.rawMaterialsForeign+state.opening.suppliesLocal+state.opening.suppliesForeign+wipTotal+finished+state.opening.receivablesLocal+state.opening.receivablesForeign+state.opening.cashLocal+state.opening.cashForeign+state.opening.shortTermDepositsLocal+state.opening.cashSurplusLocal+state.opening.cashSurplusForeign+state.opening.otherAssetsLocal
 const debt=state.loans.reduce((sum,l)=>sum+l.openingBalance,0)
 const accruedLoanInterest=state.loans.reduce((sum,l)=>sum+(l.accruedInterest??0),0)
 const liabilities=state.opening.payablesLocal+state.opening.payablesForeign+state.opening.otherLiabilitiesLocal+debt+accruedLoanInterest
 const equity=(state.equityCapital.length?state.equityCapital.reduce((sum,item)=>sum+item.paidIn-item.paidOut,0):state.opening.paidInCapital)+state.opening.retainedEarnings-state.opening.accumulatedLosses+state.opening.grants
 const totalAssets=currentAssets+fixedNet
 const balanceDifference=totalAssets-liabilities-equity
 const result=useMemo(()=>calculateIncrementalEnterpriseAnalysis(state.without,state.with,state.discountRate/100),[state.without,state.with,state.discountRate])
 const inputFields=(scenario:'without'|'with',rows:EnterpriseScenarioPeriodInput[])=> <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('درآمد','Revenue')}</th><th>{t('هزینه نقدی','Cash OPEX')}</th><th>{t('مالیات','Tax')}</th><th>{t('CAPEX','CAPEX')}</th><th>{t('هزینه فرصت دارایی موجود','Existing Asset Opportunity Cost')}</th><th>{t('تغییر سرمایه در گردش','Δ Working Capital')}</th><th>{t('فروش دارایی','Asset Sale')}</th><th>{t('ارزش نهایی','Terminal Value')}</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><th>{i+1}</th>{(['revenue','cashOperatingCosts','tax','capex','opportunityCost','changeInWorkingCapital','assetSaleProceeds','terminalValue'] as (keyof EnterpriseScenarioPeriodInput)[]).map(field=><td key={field}><input aria-label={String(field)+' '+(i+1)} style={{width:105,minWidth:85}} type="number" value={r[field]??0} onChange={e=>updatePeriod(scenario,i,field,Number(e.target.value))}/></td>)}</tr>)}</tbody></table></div>
 return <section className="fw-card" style={{marginTop:18}}>
  <h3>{t('تحلیل توسعه/بازسازی بنگاه موجود','Expansion/Rehabilitation Project Analysis')}</h3>
  <p className="fw-lead">{t('این ماژول، بنگاه موجود را جدا از سرمایه‌گذاری جدید مدل می‌کند و سه خروجی مستقل «بدون طرح»، «با طرح» و «اثر افزایشی طرح» می‌سازد. ارقام این بخش در ذخیره محلی همین پروژه نگهداری می‌شوند.','This module models the existing enterprise separately from the new investment and produces distinct Without Project, With Project and Incremental views. Data is saved locally with this project.')}</p>
  <div className="fw-grid">
   <label className="fw-field"><span>{t('نوع پروژه','Project Type')}</span><select value={state.mode} onChange={e=>setState(s=>({...s,mode:e.target.value as State['mode']}))}><option value="expansion">{t('توسعه / Expansion','Expansion')}</option><option value="rehabilitation">{t('بازسازی / Rehabilitation','Rehabilitation')}</option><option value="combined">{t('توسعه همراه با بازسازی','Expansion / Rehabilitation')}</option></select></label>
   <label className="fw-field"><span>{t('تاریخ مبنای مانده افتتاحیه','Opening Balance Effective Date')}</span><input type="date" value={state.baseDate} onChange={e=>setState(s=>({...s,baseDate:e.target.value}))}/></label>
   <label className="fw-field"><span>{t('نرخ تنزیل (تحلیل افزایشی) (%)','Discount Rate (Incremental Analysis) (%)')}</span><input type="number" min="-99" value={state.discountRate} onChange={e=>setState(s=>({...s,discountRate:Number(e.target.value)}))}/></label>
  </div>
  <h4>{t('۱. مانده‌های افتتاحیه (دارایی‌ها و بدهی‌های جاری)','1. Starting Balances — Current Assets and Liabilities')}</h4>
  <p className="fw-hint">{t('تاریخ اثر مانده‌ها باید روز قبل از شروع نخستین دوره برنامه‌ریزی باشد. طبق ساختار COMFAR مبالغ مانده‌ها با واحد پول محلی تعریف می‌شوند و جزء ارز خارجی برای محاسبات اقتصادی جداگانه نگهداری می‌شود؛ اتصال این جزء به ارز مشخص و نرخ تبدیل آن در ماژول Currencies هنوز باید تکمیل شود. سپرده کوتاه‌مدت فقط جزء محلی دارد.','Starting balance amounts are defined in local currency. The foreign currency component is retained separately for economic calculations; linking each component to a defined foreign currency and its exchange rate in the Currencies module remains to be completed. Short-term deposits have only a local-currency field.')}</p>
  <div className="fw-grid">
   {moneyKeys.map(([field,label])=><label className="fw-field" key={field}><span>{t(label,comfarTermsEn[label]??label)}</span><input type="number" min="0" value={state.opening[field]} onChange={e=>updateOpening(field,Number(e.target.value))}/></label>)}
  </div>
  <h5>{t('کالای در جریان ساخت ـ به تفکیک محصول','Work in Progress — by Product')}</h5>
  <p className="fw-hint">{t('برای هر محصول، جزء محلی و خارجی جداگانه ثبت می‌شود؛ این تفکیک مطابق پنجره Starting Balance در Reference Manual است.','Enter local and foreign Work in Progress separately for each product, following the Starting Balance structure in the Reference Manual.')}</p>
  {state.workInProgress.map(item=><div className="fw-grid" key={item.id}>
   <label className="fw-field"><span>{t('محصول','Product')}</span><input value={item.productName} onChange={e=>setState(s=>({...s,workInProgress:s.workInProgress.map(x=>x.id===item.id?{...x,productName:e.target.value}:x)}))}/></label>
   <label className="fw-field"><span>{t('ارزش محلی','Local Value')}</span><input type="number" min="0" value={item.localValue} onChange={e=>setState(s=>({...s,workInProgress:s.workInProgress.map(x=>x.id===item.id?{...x,localValue:Number(e.target.value)}:x)}))}/></label>
   <label className="fw-field"><span>{t('ارزش جزء خارجی','Foreign Currency Component')}</span><input type="number" min="0" value={item.foreignValue} onChange={e=>setState(s=>({...s,workInProgress:s.workInProgress.map(x=>x.id===item.id?{...x,foreignValue:Number(e.target.value)}:x)}))}/></label>
   <button className="secondary-button" onClick={()=>setState(s=>({...s,workInProgress:s.workInProgress.filter(x=>x.id!==item.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={()=>setState(s=>({...s,workInProgress:[...s.workInProgress,{id:'wip-'+Date.now(),productName:'',localValue:0,foreignValue:0}]}))}><Plus size={14}/>{t('افزودن ردیف کالای در جریان ساخت','Add Work in Progress Item')}</button>
  <h5>{t('محصول نهایی موجود در انبار ـ به تفکیک محصول','Finished Product Inventory — by Product')}</h5>
  <p className="fw-hint">{t('برای هر محصول، مقدار، قیمت واحد و سهم جزء ارز خارجی ثبت می‌شود. ارزش موجودی از حاصل‌ضرب مقدار در قیمت واحد محاسبه می‌شود.','For each product, enter quantity, unit price and foreign currency component percentage. Inventory value is calculated as quantity multiplied by unit price.')}</p>
  {state.finishedProducts.map(item=><div className="fw-grid" key={item.id}>
   <label className="fw-field"><span>{t('محصول','Product')}</span><input value={item.productName} onChange={e=>setState(s=>({...s,finishedProducts:s.finishedProducts.map(x=>x.id===item.id?{...x,productName:e.target.value}:x)}))}/></label>
   <label className="fw-field"><span>{t('مقدار','Quantity')}</span><input type="number" min="0" value={item.quantity} onChange={e=>setState(s=>({...s,finishedProducts:s.finishedProducts.map(x=>x.id===item.id?{...x,quantity:Number(e.target.value)}:x)}))}/></label>
   <label className="fw-field"><span>{t('قیمت واحد','Unit Price')}</span><input type="number" min="0" value={item.unitPrice} onChange={e=>setState(s=>({...s,finishedProducts:s.finishedProducts.map(x=>x.id===item.id?{...x,unitPrice:Number(e.target.value)}:x)}))}/></label>
   <label className="fw-field"><span>{t('سهم جزء ارز خارجی (%)','Foreign Currency Component (%)')}</span><input type="number" min="0" max="100" value={item.foreignSharePercent} onChange={e=>setState(s=>({...s,finishedProducts:s.finishedProducts.map(x=>x.id===item.id?{...x,foreignSharePercent:Math.max(0,Math.min(100,Number(e.target.value)))}:x)}))}/></label>
   <button className="secondary-button" onClick={()=>setState(s=>({...s,finishedProducts:s.finishedProducts.filter(x=>x.id!==item.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
   <div className="fw-result">{t('ارزش کل موجودی','Total Inventory Value')}: <b>{fmt(item.quantity*item.unitPrice)} {currency}</b></div>
  </div>)}
  <button className="secondary-button" onClick={()=>setState(s=>({...s,finishedProducts:[...s.finishedProducts,{id:'finished-'+Date.now(),productName:'',quantity:0,unitPrice:0,foreignSharePercent:0}]}))}><Plus size={14}/>{t('افزودن محصول نهایی','Add Finished Product')}</button>
  <div className="fw-result">{t('ارزش موجودی محصول نهایی','Finished Product Inventory Value')}: <b>{fmt(finished)} {currency}</b> · {t('ارزش کالای در جریان ساخت','Work in Progress Value')}: <b>{fmt(wipTotal)} {currency}</b></div>
  <div className="fw-grid">
   <label className="fw-field"><span>{t('دوره تسویه حساب‌های دریافتنی محلی (روز)','Local Accounts Receivable Liquidation Period (Days)')}</span><input type="number" min="0" value={state.opening.receivableDaysLocal} onChange={e=>updateOpening('receivableDaysLocal',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره تسویه حساب‌های دریافتنی ارزی (روز)','Foreign Accounts Receivable Liquidation Period (Days)')}</span><input type="number" min="0" value={state.opening.receivableDaysForeign} onChange={e=>updateOpening('receivableDaysForeign',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره پرداخت حساب‌های پرداختنی محلی (روز)','Local Accounts Payable Payout Period (Days)')}</span><input type="number" min="0" value={state.opening.payableDaysLocal} onChange={e=>updateOpening('payableDaysLocal',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره پرداخت حساب‌های پرداختنی ارزی (روز)','Foreign Accounts Payable Payout Period (Days)')}</span><input type="number" min="0" value={state.opening.payableDaysForeign} onChange={e=>updateOpening('payableDaysForeign',Number(e.target.value))}/></label>
  </div>
  <div className="fw-result">{t('ارزش موجودی محصول نهایی','Finished Product Inventory Value')}: <b>{fmt(finished)} {currency}</b> · {t('جمع دارایی‌های جاری در مانده‌های افتتاحیه','Total Current Assets in Starting Balances')}: <b>{fmt(currentAssets)} {currency}</b></div>
  <h4>{t('۲. مانده‌های افتتاحیه دارایی‌های ثابت','2. Starting Balances — Fixed Investment Items')}</h4>
  {state.assets.map(asset=><div className="fw-grid" key={asset.id}>
   <label className="fw-field"><span>{t('شرح دارایی','Asset Description')}</span><input value={asset.name} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,name:e.target.value}:a)}))}/></label>
   {([['grossCost','بهای تمام‌شده'],['accumulatedDepreciation','استهلاک انباشته'],['remainingLife','عمر مفید باقیمانده'],['opportunityValue','ارزش فرصت / بازار'],['residualValue','ارزش اسقاط'],['foreignSharePercent','سهم جزء ارزی (%)']] as [keyof Asset,string][]).map(([field,label])=><label className="fw-field" key={field}><span>{t(label,comfarTermsEn[label]??label)}</span><input type="number" min="0" value={Number(asset[field]??0)} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,[field]:Number(e.target.value)}:a)}))}/></label>)}
   <label className="fw-field"><span>{t('تاریخ بهره‌برداری',comfarTermsEn['تاریخ بهره‌برداری'])}</span><input type="date" value={asset.commissioningDate??''} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,commissioningDate:e.target.value}:a)}))}/></label>
   <label className="fw-field"><span>{t('روش استهلاک',comfarTermsEn['روش استهلاک'])}</span><select value={asset.depreciationMethod??'straight-line'} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,depreciationMethod:e.target.value as Asset['depreciationMethod']}:a)}))}><option value="straight-line">{t('خط مستقیم','Straight-line')}</option><option value="declining-balance">{t('مانده نزولی','Declining Balance')}</option><option value="none">{t('بدون استهلاک','No Depreciation')}</option></select></label>
   <label className="fw-field"><span>{t('مرکز هزینه',comfarTermsEn['مرکز هزینه'])}</span><input value={asset.costCentre??''} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,costCentre:e.target.value}:a)}))}/></label>
   <label className="fw-field"><span>{t('وضعیت دارایی','Asset Status')}</span><select value={asset.status} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,status:e.target.value as Asset['status']}:a)}))}><option value="active">{t('فعال','Active')}</option><option value="replace">{t('جایگزین‌شونده','To Be Replaced')}</option><option value="idle">{t('بلااستفاده','Idle')}</option><option value="sell">{t('قابل فروش','For Sale')}</option></select></label>
   <button className="secondary-button" onClick={()=>setState(s=>({...s,assets:s.assets.filter(a=>a.id!==asset.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={addAsset}><Plus size={14}/>{t('افزودن دارایی موجود','Add Existing Asset')}</button>
  <div className="fw-result">{t('بهای تمام‌شده ناخالص','Gross Cost')}: <b>{fmt(fixedGross)}</b> · {t('استهلاک انباشته','Accumulated Depreciation')}: <b>{fmt(fixedAccum)}</b> · {t('ارزش دفتری خالص','Net Book Value')}: <b>{fmt(fixedNet)}</b> · {t('ارزش فرصت مجموع','Total Opportunity Value')}: <b>{fmt(state.assets.reduce((sum,a)=>sum+a.opportunityValue,0))}</b></div>
  <h4>{t('۳. مانده‌های افتتاحیه تأمین مالی بلندمدت','3. Starting Balances — Long-Term Debt and Equity Capital')}</h4>
  {state.loans.map(loan=><div className="fw-grid" key={loan.id}>
   <label className="fw-field"><span>{t('عنوان تسهیلات','Loan Name')}</span><input value={loan.name} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,name:e.target.value}:l)}))}/></label>
   {([['openingBalance','مانده اصل بدهی'],['annualRate','نرخ بهره سالانه (%)'],['accruedInterest','بهره معوق/پرداختنی']] as [keyof LegacyLoan,string][]).map(([field,label])=><label className="fw-field" key={field}><span>{t(label,comfarTermsEn[label]??label)}</span><input type="number" min="0" value={Number(loan[field]??0)} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,[field]:Number(e.target.value)}:l)}))}/></label>)}
   {(loan.repaymentType??'annuity')!=='profile'&&<label className="fw-field"><span>{t('تناوب بازپرداخت',comfarTermsEn['تناوب بازپرداخت'])}</span><select value={loan.repaymentFrequency??'quarterly'} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,repaymentFrequency:e.target.value as LegacyLoan['repaymentFrequency']}:l)}))}><option value="annual">{t('سالانه','Annual')}</option><option value="semiannual">{t('شش‌ماهه','Semi-annual')}</option><option value="quarterly">{t('فصلی','Quarterly')}</option><option value="monthly">{t('ماهانه','Monthly')}</option></select></label>}
   <label className="fw-field"><span>{t('نوع وام','Loan Type')}</span><select value={loan.repaymentType??(loan.repaymentMethod==='equal-principal'?'constant-principal':loan.repaymentMethod==='bullet'?'profile':'annuity')} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,repaymentType:e.target.value as ExistingLoanRepaymentType}:l)}))}><option value="annuity">{t('اقساط مستمری','Annuity')}</option><option value="constant-principal">{t('اصل ثابت','Constant Principal')}</option><option value="profile">{t('پروفایل / برنامه دستی','Profile')}</option></select></label>
   {(loan.repaymentType??'annuity')!=='profile'&&<label className="fw-field"><span>{t('تاریخ اولین بازپرداخت','First Repayment Date')}</span><input type="date" value={loan.nextPaymentDate??''} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,nextPaymentDate:e.target.value}:l)}))}/></label>}
   {(loan.repaymentType??'annuity')!=='profile'&&<label className="fw-field"><span>{t('تعداد اقساط',comfarTermsEn['تعداد اقساط'])}</span><input type="number" min="1" max="1200" step="1" value={loan.numberOfRepayments??20} disabled={(loan.repaymentType??'annuity')==='profile'} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,numberOfRepayments:Math.max(1,Math.floor(Number(e.target.value)))}:l)}))}/></label>}
   {(loan.repaymentType??'annuity')!=='profile'&&<label className="fw-field"><span>{t('سرمایه‌ای‌کردن بهره دوره تنفس',comfarTermsEn['سرمایه‌ای‌کردن بهره دوره تنفس'])}</span><input type="checkbox" checked={loan.capitalizeGraceInterest??true} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,capitalizeGraceInterest:e.target.checked}:l)}))}/></label>}
   {(loan.repaymentType??'annuity')==='profile'&&<div className="fw-card"><h5>{t('اقساط پروفایل','Profile Repayments')}</h5><label className="fw-field"><span>{t('ماه پرداخت بهره','Month Interest Paid')}</span><select value={loan.interestPaymentMonth??12} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,interestPaymentMonth:Number(e.target.value)}:l)}))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Date(Date.UTC(2020,i+1,0)).toLocaleString(en?'en-US':'fa-IR',{month:'long',timeZone:'UTC'})}</option>)}</select></label>{(loan.profileRepayments??[]).map(item=><div className="fw-grid" key={item.id}><label className="fw-field"><span>{t('تاریخ بازپرداخت','Repayment Date')}</span><input type="date" value={item.date} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,profileRepayments:(l.profileRepayments??[]).map(x=>x.id===item.id?{...x,date:e.target.value}:x)}:l)}))}/></label><label className="fw-field"><span>{t('مبلغ اصل بازپرداخت','Principal Repayment')}</span><input type="number" min="0" value={item.principal} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,profileRepayments:(l.profileRepayments??[]).map(x=>x.id===item.id?{...x,principal:Number(e.target.value)}:x)}:l)}))}/></label><button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,profileRepayments:(l.profileRepayments??[]).filter(x=>x.id!==item.id)}:l)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button></div>)}<button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,profileRepayments:[...(l.profileRepayments??[]),{id:'profile-'+Date.now(),date:'',principal:0}]}:l)}))}><Plus size={14}/>{t('افزودن بازپرداخت','Add Repayment')}</button></div>}
   {state.baseDate&&((loan.repaymentType??'annuity')==='profile'?(loan.profileRepayments?.length??0)>0:!!loan.nextPaymentDate)&&(()=>{const schedule=calculateExistingLoanSchedule({openingBalance:loan.openingBalance,openingAccruedInterest:loan.accruedInterest??0,annualInterestRatePercent:loan.annualRate,startDate:state.baseDate,firstRepaymentDate:loan.nextPaymentDate??'',interestPaymentMonth:loan.interestPaymentMonth??12,repaymentFrequency:loan.repaymentFrequency??'quarterly',repaymentType:loan.repaymentType??(loan.repaymentMethod==='equal-principal'?'constant-principal':'annuity'),numberOfRepayments:loan.numberOfRepayments??20,capitalizeGraceInterest:loan.capitalizeGraceInterest??true,profileRepayments:loan.profileRepayments?.map(x=>({date:x.date,principal:x.principal}))});return <div className="fw-card"><h5>{t('برنامه بازپرداخت و خدمت بدهی','Repayment Schedule and Debt Service')}</h5>{schedule.valid?<><div className="fw-grid">{(loan.repaymentType??'annuity')!=='profile'&&<div className="fw-result">{t('نرخ هر دوره','Periodic Interest Rate')}: <b>{fmt(schedule.periodicRate*100)}%</b></div>}<div className="fw-result">{t('مجموع بهره','Total Interest')}: <b>{fmt(schedule.totalInterest)} {currency}</b></div><div className="fw-result">{t('مجموع اصل بازپرداخت','Total Principal Repayment')}: <b>{fmt(schedule.totalPrincipal)} {currency}</b></div><div className="fw-result">{t('مانده نهایی','Closing Balance')}: <b>{fmt(schedule.closingBalance)} {currency}</b></div></div><div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('تاریخ','Date')}</th><th>{t('مانده اول دوره','Opening Balance')}</th><th>{t('بهره سرمایه‌ای‌شده','Capitalized Interest')}</th><th>{t('بهره پرداختنی','Interest Payable')}</th><th>{t('بازپرداخت اصل','Principal Repayment')}</th><th>{t('خدمت بدهی','Debt Service')}</th><th>{t('مانده پایان دوره','Closing Balance')}</th><th>{t('بهره تعهدشده پرداخت‌نشده','Accrued Interest Balance')}</th></tr></thead><tbody>{schedule.rows.map((row,index)=><tr key={row.date+'-'+index}><td>{row.date}</td><td>{fmt(row.openingBalance)}</td><td>{fmt(row.capitalizedInterest)}</td><td>{fmt(row.interestPayable)}</td><td>{fmt(row.principalRepayment)}</td><td>{fmt(row.totalDebtService)}</td><td>{fmt(row.closingBalance)}</td><td>{fmt(row.accruedInterestBalance??0)}</td></tr>)}</tbody></table></div></>:<p className="fw-hint">{t(schedule.error??'برنامه بازپرداخت قابل محاسبه نیست.','Repayment schedule cannot be calculated.')}</p>}</div>})()}
   <button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={addLoan}><Plus size={14}/>{t('افزودن تسهیلات موجود','Add Existing Loan')}</button>
  <h4>{t('۴. مانده‌های افتتاحیه سرمایه و شرکای سرمایه‌گذار','4. Starting Balances — Equity Capital and Partners')}</h4>
  <p className="fw-hint">{t('سرمایه عادی و ممتاز هر شریک به‌صورت مستقل ثبت می‌شود. آورده، برداشت سرمایه، سود ممتاز و درصد انتقال سود به خارج از کشور جدا هستند. یارانه‌ها و کمک‌های بلاعوض در ردیف مستقل Starting Balances باقی می‌مانند.','Record Ordinary and Preference Capital separately for each partner. Paid-in capital, capital refunds, preferred dividends and profit export percentage are distinct. Subsidies and Grants remain a separate Starting Balances item.')}</p>
  {state.equityCapital.map(item=><div className="fw-grid" key={item.id}>
   <label className="fw-field"><span>{t('نام شریک','Partner Name')}</span><input value={item.partnerName} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,partnerName:e.target.value}:x)}))}/></label>
   <label className="fw-field"><span>{t('طبقه سرمایه','Capital Class')}</span><select value={item.capitalClass} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,capitalClass:e.target.value as EquityCapitalBalance['capitalClass']}:x)}))}><option value="ordinary">{t('سرمایه عادی','Ordinary Capital')}</option><option value="preference">{t('سرمایه ممتاز','Preference Capital')}</option></select></label>
   <label className="fw-field"><span>{t('منشأ سرمایه','Origin of Capital')}</span><select value={item.origin} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,origin:e.target.value as EquityCapitalBalance['origin']}:x)}))}><option value="local">{t('محلی','Local')}</option><option value="foreign">{t('خارجی','Foreign')}</option></select></label>
   <label className="fw-field"><span>{t('سرمایه پرداخت‌شده','Paid-in Capital')}</span><input type="number" min="0" value={item.paidIn} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,paidIn:Number(e.target.value)}:x)}))}/></label>
   <label className="fw-field"><span>{t('بازپرداخت / استرداد سرمایه','Capital Refund')}</span><input type="number" min="0" value={item.paidOut} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,paidOut:Number(e.target.value)}:x)}))}/></label>
   <label className="fw-field"><span>{t('سود ممتاز (%)','Preferred Dividends (%)')}</span><input type="number" min="0" max="100" value={item.preferredDividendPercent} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,preferredDividendPercent:Math.max(0,Math.min(100,Number(e.target.value)))}:x)}))}/></label>
   <label className="fw-field"><span>{t('انتقال سود به خارج (%)','Export of Profit (%)')}</span><input type="number" min="0" max="100" value={item.profitExportPercent} onChange={e=>setState(s=>({...s,equityCapital:s.equityCapital.map(x=>x.id===item.id?{...x,profitExportPercent:Math.max(0,Math.min(100,Number(e.target.value)))}:x)}))}/></label>
   <button className="secondary-button" onClick={()=>setState(s=>({...s,equityCapital:s.equityCapital.filter(x=>x.id!==item.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={()=>setState(s=>({...s,equityCapital:[...s.equityCapital,{id:'equity-'+Date.now(),partnerName:'',capitalClass:'ordinary',origin:'local',paidIn:0,paidOut:0,preferredDividendPercent:0,profitExportPercent:0}]}))}><Plus size={14}/>{t('افزودن طبقه سرمایه / شریک','Add Capital Class / Partner')}</button>
  <div className="fw-result">{t('خالص سرمایه پرداخت‌شده','Net Paid-in Equity Capital')}: <b>{fmt(state.equityCapital.reduce((sum,item)=>sum+item.paidIn-item.paidOut,0))} {currency}</b></div>
  <div className="fw-result">{t('اصل بدهی افتتاحیه','Opening Debt Principal')}: <b>{fmt(debt)}</b> · {t('بهره معوق پرداختنی','Accrued Interest Payable')}: <b>{fmt(accruedLoanInterest)}</b> · {t('جمع بدهی و حقوق مالکانه','Liabilities & Equity')}: <b>{fmt(liabilities+equity)}</b> · {t('اختلاف تراز افتتاحیه','Opening Balance Difference')}: <b>{fmt(balanceDifference)} {currency}</b> {Math.abs(balanceDifference)<0.01?'✓':'⚠'}</div>
  <p className="fw-hint">{t('کنترل تراز صرفاً اختلاف را نشان می‌دهد و هیچ رقم ترازکننده‌ای به سود انباشته یا حقوق مالکانه اضافه نمی‌کند. جزء ارز خارجی هنوز به ماژول Currencies و نرخ تبدیل/درمان اقتصادی آن متصل نشده است؛ بنابراین کنترل تراز تا تکمیل این اتصال و نگاشت حسابداری، مقدماتی است.','The balance check reports the difference and never inserts a balancing plug into retained earnings or equity. The foreign currency component is not yet linked to the Currencies module and its exchange-rate/economic treatment; treat this balance check as provisional until that link and the accounting mapping are completed.')}</p>
  <h4>{t('۴. تحلیل افزایشی ـ بدون طرح','4. Incremental Analysis — Without Project')}</h4>
  {inputFields('without',state.without)}
  <h4>{t('۵. تحلیل افزایشی ـ با طرح','5. Incremental Analysis — With Project')}</h4>
  {inputFields('with',state.with)}
  <h4>{t('۶. نتایج تحلیل افزایشی','6. Incremental Analysis Results')}</h4>
  <div className="fw-grid">
   <article className="fw-result"><small>{t('NPV بدون طرح','Without-Project NPV')}</small><b>{fmt(result.withoutProjectNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('NPV با طرح','With-Project NPV')}</small><b>{fmt(result.withProjectNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('NPV افزایشی','Incremental NPV')}</small><b>{fmt(result.incrementalNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('IRR افزایشی','Incremental IRR')}</small><b>{result.incrementalIrr===null?'—':fmt(result.incrementalIrr*100)+'٪'}</b></article>
  </div>
  <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('بدون طرح','Without Project')}</th><th>{t('با طرح','With Project')}</th><th>{t('اثر افزایشی','Incremental')}</th></tr></thead><tbody>{result.periods.map(row=><tr key={row.period}><th>{row.period}</th><td>{fmt(row.withoutProjectCashFlow)}</td><td>{fmt(row.withProjectCashFlow)}</td><td>{fmt(row.incrementalCashFlow)}</td></tr>)}</tbody></table></div>
  <p className="fw-hint">{t('جریان نقدی هر سناریو = درآمد − هزینه نقدی عملیاتی − مالیات − CAPEX − تغییر سرمایه در گردش + عواید فروش دارایی + ارزش نهایی. تحلیل افزایشی از تفاضل جریان‌های نقدی هم‌دوره ساخته می‌شود. برای جلوگیری از دو بار شماری، جریان‌های هزینه فرصت دارایی‌های موجود نیز باید فقط در سناریوی «با طرح» و در دوره‌ای که دارایی به طرح تخصیص می‌یابد ثبت شود؛ هر دو سناریو باید اقلام بنگاه و طرح را با طبقه‌بندی یکسان پوشش دهند.','Each scenario cash flow = revenue − cash operating costs − tax − CAPEX − change in working capital + asset sale proceeds + terminal value. Incremental analysis is the period-by-period difference. Existing-asset opportunity cost should be entered only in the With Project scenario in the period the asset is committed. Both scenarios must use consistent enterprise/project classifications to avoid double counting.')}</p>
 </section>
}
