import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { localStore } from '../../core/storage/localStore'
import { calculateIncrementalEnterpriseAnalysis, type EnterpriseScenarioPeriodInput } from '../steel/financialModel'

type Asset = { id:string; name:string; grossCost:number; accumulatedDepreciation:number; remainingLife:number; opportunityValue:number; status:'active'|'replace'|'idle'|'sell' }
type LegacyLoan = { id:string; name:string; openingBalance:number; annualRate:number; annualDebtService:number }
type Opening = {
  wipLocal:number; wipForeign:number; finishedQuantity:number; finishedUnitPrice:number; finishedForeignShare:number
  receivablesLocal:number; receivablesForeign:number; receivableDaysLocal:number; receivableDaysForeign:number
  cashLocal:number; cashForeign:number; shortTermDepositsLocal:number; cashSurplusLocal:number; cashSurplusForeign:number
  payablesLocal:number; payablesForeign:number; payableDaysLocal:number; payableDaysForeign:number
  otherAssetsLocal:number; otherLiabilitiesLocal:number; paidInCapital:number; retainedEarnings:number; accumulatedLosses:number; grants:number
}
type State = { baseDate:string; mode:'expansion'|'rehabilitation'|'combined'; opening:Opening; assets:Asset[]; loans:LegacyLoan[]; without:EnterpriseScenarioPeriodInput[]; with:EnterpriseScenarioPeriodInput[]; discountRate:number }
const blankOpening:Opening={wipLocal:0,wipForeign:0,finishedQuantity:0,finishedUnitPrice:0,finishedForeignShare:0,receivablesLocal:0,receivablesForeign:0,receivableDaysLocal:0,receivableDaysForeign:0,cashLocal:0,cashForeign:0,shortTermDepositsLocal:0,cashSurplusLocal:0,cashSurplusForeign:0,payablesLocal:0,payablesForeign:0,payableDaysLocal:0,payableDaysForeign:0,otherAssetsLocal:0,otherLiabilitiesLocal:0,paidInCapital:0,retainedEarnings:0,accumulatedLosses:0,grants:0}
const emptyPeriod=():EnterpriseScenarioPeriodInput=>({revenue:0,cashOperatingCosts:0,tax:0,capex:0,changeInWorkingCapital:0,assetSaleProceeds:0,terminalValue:0})
const initialState=(horizon:number):State=>({baseDate:'',mode:'expansion',opening:{...blankOpening},assets:[],loans:[],without:Array.from({length:horizon},emptyPeriod),with:Array.from({length:horizon},emptyPeriod),discountRate:25})
const fmt=(v:number)=>Number.isFinite(v)?v.toLocaleString('fa-IR',{maximumFractionDigits:2}):'—'
const moneyKeys:[keyof Opening,string][]=[
 ['wipLocal','کالای در جریان ساخت ـ محلی'],['wipForeign','کالای در جریان ساخت ـ معادل ارزی'],['receivablesLocal','حساب‌های دریافتنی محلی'],['receivablesForeign','حساب‌های دریافتنی ارزی'],['cashLocal','وجه نقد محلی'],['cashForeign','وجه نقد ارزی'],['shortTermDepositsLocal','سپرده کوتاه‌مدت محلی'],['cashSurplusLocal','مازاد نقدی محلی'],['cashSurplusForeign','مازاد نقدی ارزی'],['payablesLocal','حساب‌های پرداختنی محلی'],['payablesForeign','حساب‌های پرداختنی ارزی'],['otherAssetsLocal','سایر دارایی‌های جاری محلی'],['otherLiabilitiesLocal','سایر بدهی‌های جاری محلی'],['paidInCapital','سرمایه پرداخت‌شده'],['retainedEarnings','اندوخته و سود انباشته'],['accumulatedLosses','زیان انباشته'],['grants','کمک‌ها و یارانه‌های سرمایه‌ای']
]
type Props={projectId:string;currency:string;constructionYears:number;operatingYears:number;language?:'fa'|'en'}
export default function ExpansionRehabilitationPanel({projectId,currency,constructionYears,operatingYears,language='fa'}:Props){
 const en=language==='en', t=(fa:string,english:string)=>en?english:fa
 const horizon=Math.max(2,Math.min(30,Math.ceil(constructionYears)+Math.ceil(operatingYears)))
 const key='feasibility:expansion-rehabilitation:'+projectId
 const [state,setState]=useState<State>(()=>initialState(horizon))
 const [loaded,setLoaded]=useState(false)
 useEffect(()=>{let active=true;localStore.get<State>(key).then(saved=>{if(active){if(saved){const defaults=initialState(horizon);setState({...defaults,...saved,opening:{...blankOpening,...saved.opening},without:Array.from({length:horizon},(_,i)=>saved.without?.[i]??emptyPeriod()),with:Array.from({length:horizon},(_,i)=>saved.with?.[i]??emptyPeriod())})}setLoaded(true)}}).catch(()=>setLoaded(true));return()=>{active=false}},[key,horizon])
 useEffect(()=>{if(loaded)void localStore.set(key,state)},[loaded,key,state])
 const updateOpening=(field:keyof Opening,value:number)=>setState(s=>({...s,opening:{...s.opening,[field]:Math.max(0,value)}}))
 const updatePeriod=(scenario:'without'|'with',index:number,field:keyof EnterpriseScenarioPeriodInput,value:number)=>setState(s=>({...s,[scenario]:s[scenario].map((row,i)=>i===index?{...row,[field]:value}:row)}))
 const addAsset=()=>setState(s=>({...s,assets:[...s.assets,{id:'asset-'+Date.now(),name:'دارایی موجود',grossCost:0,accumulatedDepreciation:0,remainingLife:10,opportunityValue:0,status:'active'}]}))
 const addLoan=()=>setState(s=>({...s,loans:[...s.loans,{id:'loan-'+Date.now(),name:'تسهیلات موجود',openingBalance:0,annualRate:0,annualDebtService:0}]}))
 const fixedGross=state.assets.reduce((sum,a)=>sum+a.grossCost,0)
 const fixedAccum=state.assets.reduce((sum,a)=>sum+a.accumulatedDepreciation,0)
 const fixedNet=Math.max(0,fixedGross-fixedAccum)
 const finished=state.opening.finishedQuantity*state.opening.finishedUnitPrice
 const currentAssets=state.opening.wipLocal+state.opening.wipForeign+finished+state.opening.receivablesLocal+state.opening.receivablesForeign+state.opening.cashLocal+state.opening.cashForeign+state.opening.shortTermDepositsLocal+state.opening.cashSurplusLocal+state.opening.cashSurplusForeign+state.opening.otherAssetsLocal
 const debt=state.loans.reduce((sum,l)=>sum+l.openingBalance,0)
 const liabilities=state.opening.payablesLocal+state.opening.payablesForeign+state.opening.otherLiabilitiesLocal+debt
 const equity=state.opening.paidInCapital+state.opening.retainedEarnings-state.opening.accumulatedLosses+state.opening.grants
 const totalAssets=currentAssets+fixedNet
 const balanceDifference=totalAssets-liabilities-equity
 const result=useMemo(()=>calculateIncrementalEnterpriseAnalysis(state.without,state.with,state.discountRate/100),[state.without,state.with,state.discountRate])
 const inputFields=(scenario:'without'|'with',rows:EnterpriseScenarioPeriodInput[])=> <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('درآمد','Revenue')}</th><th>{t('هزینه نقدی','Cash OPEX')}</th><th>{t('مالیات','Tax')}</th><th>{t('CAPEX','CAPEX')}</th><th>{t('تغییر سرمایه در گردش','Δ Working Capital')}</th><th>{t('فروش دارایی','Asset Sale')}</th><th>{t('ارزش نهایی','Terminal Value')}</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><th>{i+1}</th>{(['revenue','cashOperatingCosts','tax','capex','changeInWorkingCapital','assetSaleProceeds','terminalValue'] as (keyof EnterpriseScenarioPeriodInput)[]).map(field=><td key={field}><input aria-label={String(field)+' '+(i+1)} style={{width:105,minWidth:85}} type="number" value={r[field]??0} onChange={e=>updatePeriod(scenario,i,field,Number(e.target.value))}/></td>)}</tr>)}</tbody></table></div>
 return <section className="fw-card" style={{marginTop:18}}>
  <h3>{t('مدل توسعه، نوسازی و بازسازی واحد موجود','Existing Enterprise Expansion & Rehabilitation Model')}</h3>
  <p className="fw-lead">{t('این ماژول، بنگاه موجود را جدا از سرمایه‌گذاری جدید مدل می‌کند و سه خروجی مستقل «بدون طرح»، «با طرح» و «اثر افزایشی طرح» می‌سازد. ارقام این بخش در ذخیره محلی همین پروژه نگهداری می‌شوند.','This module models the existing enterprise separately from the new investment and produces distinct Without Project, With Project and Incremental views. Data is saved locally with this project.')}</p>
  <div className="fw-grid">
   <label className="fw-field"><span>{t('طبقه‌بندی تحلیل','Analysis Classification')}</span><select value={state.mode} onChange={e=>setState(s=>({...s,mode:e.target.value as State['mode']}))}><option value="expansion">{t('توسعه ظرفیت','Capacity Expansion')}</option><option value="rehabilitation">{t('نوسازی / بازسازی','Modernisation / Rehabilitation')}</option><option value="combined">{t('توسعه همراه با نوسازی','Expansion with Modernisation')}</option></select></label>
   <label className="fw-field"><span>{t('تاریخ مبنای مانده افتتاحیه','Opening Balance Effective Date')}</span><input type="date" value={state.baseDate} onChange={e=>setState(s=>({...s,baseDate:e.target.value}))}/></label>
   <label className="fw-field"><span>{t('نرخ تنزیل تحلیل افزایشی (%)','Incremental Analysis Discount Rate (%)')}</span><input type="number" min="-99" value={state.discountRate} onChange={e=>setState(s=>({...s,discountRate:Number(e.target.value)}))}/></label>
  </div>
  <h4>{t('۱. مانده‌های افتتاحیه دارایی‌ها و بدهی‌های جاری','1. Opening Current Asset & Liability Balances')}</h4>
  <p className="fw-hint">{t('تاریخ اثر مانده‌ها باید روز قبل از شروع نخستین دوره برنامه‌ریزی باشد. مبالغ ارزی در این نسخه به‌صورت معادل واحد پول پایه ثبت می‌شوند؛ ارز اصلی و نرخ تسعیر باید در نسخه چندارزی تکمیل شود. سپرده کوتاه‌مدت فقط جزء محلی دارد.','Balances take effect on the day before the first planning period. Foreign amounts are currently entered as base-currency equivalents; source currency and FX translation are a separate multi-currency enhancement. Short-term deposits have only a local-currency field.')}</p>
  <div className="fw-grid">
   {moneyKeys.map(([field,label])=><label className="fw-field" key={field}><span>{t(label,label)}</span><input type="number" min="0" value={state.opening[field]} onChange={e=>updateOpening(field,Number(e.target.value))}/></label>)}
   <label className="fw-field"><span>{t('مقدار محصول نهایی موجودی','Finished Product Inventory Quantity')}</span><input type="number" min="0" value={state.opening.finishedQuantity} onChange={e=>updateOpening('finishedQuantity',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('قیمت واحد محصول موجودی','Finished Product Inventory Unit Price')}</span><input type="number" min="0" value={state.opening.finishedUnitPrice} onChange={e=>updateOpening('finishedUnitPrice',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('سهم ارزی موجودی محصول (%)','Foreign Currency Share of Inventory (%)')}</span><input type="number" min="0" max="100" value={state.opening.finishedForeignShare} onChange={e=>updateOpening('finishedForeignShare',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره وصول مطالبات محلی (روز)','Local Receivable Collection Period (Days)')}</span><input type="number" min="0" value={state.opening.receivableDaysLocal} onChange={e=>updateOpening('receivableDaysLocal',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره وصول مطالبات ارزی (روز)','Foreign Receivable Collection Period (Days)')}</span><input type="number" min="0" value={state.opening.receivableDaysForeign} onChange={e=>updateOpening('receivableDaysForeign',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره پرداختنی محلی (روز)','Local Payables Payout Period (Days)')}</span><input type="number" min="0" value={state.opening.payableDaysLocal} onChange={e=>updateOpening('payableDaysLocal',Number(e.target.value))}/></label>
   <label className="fw-field"><span>{t('دوره پرداختنی ارزی (روز)','Foreign Payables Payout Period (Days)')}</span><input type="number" min="0" value={state.opening.payableDaysForeign} onChange={e=>updateOpening('payableDaysForeign',Number(e.target.value))}/></label>
  </div>
  <div className="fw-result">{t('ارزش محصول نهایی موجودی','Finished Inventory Value')}: <b>{fmt(finished)} {currency}</b> · {t('جمع دارایی جاری افتتاحیه','Opening Current Assets')}: <b>{fmt(currentAssets)} {currency}</b></div>
  <h4>{t('۲. دارایی‌های ثابت موجود و ارزش فرصت','2. Existing Fixed Assets & Opportunity Value')}</h4>
  {state.assets.map(asset=><div className="fw-grid" key={asset.id}>
   <label className="fw-field"><span>{t('شرح دارایی','Asset Description')}</span><input value={asset.name} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,name:e.target.value}:a)}))}/></label>
   {([['grossCost','بهای تمام‌شده'],['accumulatedDepreciation','استهلاک انباشته'],['remainingLife','عمر مفید باقیمانده'],['opportunityValue','ارزش فرصت / بازار']] as [keyof Asset,string][]).map(([field,label])=><label className="fw-field" key={field}><span>{t(label,label)}</span><input type="number" min="0" value={asset[field]} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,[field]:Number(e.target.value)}:a)}))}/></label>)}
   <label className="fw-field"><span>{t('وضعیت دارایی','Asset Status')}</span><select value={asset.status} onChange={e=>setState(s=>({...s,assets:s.assets.map(a=>a.id===asset.id?{...a,status:e.target.value as Asset['status']}:a)}))}><option value="active">{t('فعال','Active')}</option><option value="replace">{t('جایگزین‌شونده','To Be Replaced')}</option><option value="idle">{t('بلااستفاده','Idle')}</option><option value="sell">{t('قابل فروش','For Sale')}</option></select></label>
   <button className="secondary-button" onClick={()=>setState(s=>({...s,assets:s.assets.filter(a=>a.id!==asset.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={addAsset}><Plus size={14}/>{t('افزودن دارایی موجود','Add Existing Asset')}</button>
  <div className="fw-result">{t('بهای ناخالص','Gross Cost')}: <b>{fmt(fixedGross)}</b> · {t('استهلاک انباشته','Accumulated Depreciation')}: <b>{fmt(fixedAccum)}</b> · {t('ارزش دفتری خالص','Net Book Value')}: <b>{fmt(fixedNet)}</b> · {t('ارزش فرصت مجموع','Total Opportunity Value')}: <b>{fmt(state.assets.reduce((sum,a)=>sum+a.opportunityValue,0))}</b></div>
  <h4>{t('۳. تسهیلات بلندمدت موجود','3. Existing Long-Term Debt')}</h4>
  {state.loans.map(loan=><div className="fw-grid" key={loan.id}>
   <label className="fw-field"><span>{t('عنوان تسهیلات','Loan Name')}</span><input value={loan.name} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,name:e.target.value}:l)}))}/></label>
   {([['openingBalance','مانده اصل بدهی'],['annualRate','نرخ بهره سالانه (%)'],['annualDebtService','خدمت بدهی سالانه']] as [keyof LegacyLoan,string][]).map(([field,label])=><label className="fw-field" key={field}><span>{t(label,label)}</span><input type="number" min="0" value={loan[field]} onChange={e=>setState(s=>({...s,loans:s.loans.map(l=>l.id===loan.id?{...l,[field]:Number(e.target.value)}:l)}))}/></label>)}
   <button className="secondary-button" onClick={()=>setState(s=>({...s,loans:s.loans.filter(l=>l.id!==loan.id)}))}><Trash2 size={14}/>{t('حذف','Remove')}</button>
  </div>)}
  <button className="secondary-button" onClick={addLoan}><Plus size={14}/>{t('افزودن تسهیلات موجود','Add Existing Loan')}</button>
  <div className="fw-result">{t('جمع بدهی افتتاحیه','Opening Debt Total')}: <b>{fmt(debt)}</b> · {t('جمع بدهی و حقوق مالکانه','Liabilities & Equity')}: <b>{fmt(liabilities+equity)}</b> · {t('اختلاف تراز افتتاحیه','Opening Balance Difference')}: <b>{fmt(balanceDifference)} {currency}</b> {Math.abs(balanceDifference)<0.01?'✓':'⚠'}</div>
  <p className="fw-hint">{t('کنترل تراز صرفاً اختلاف را نشان می‌دهد و هیچ رقم ترازکننده‌ای به سود انباشته یا حقوق مالکانه اضافه نمی‌کند. اقلام ارزی فعلاً با معادل پول پایه جمع می‌شوند؛ برای تصمیم نهایی باید جزئیات ارز، نرخ تسعیر و ثبت حسابداری هر مانده تکمیل شود.','The balance check reports the difference and never inserts a balancing plug into retained earnings or equity. Foreign items are currently summed as base-currency equivalents; currency denomination, FX rates and accounting entries must be completed before final appraisal.')}</p>
  <h4>{t('۴. جریان نقدی بنگاه بدون طرح','4. Existing Enterprise — Without Project')}</h4>
  {inputFields('without',state.without)}
  <h4>{t('۵. جریان نقدی بنگاه پس از اجرای طرح','5. Expanded/Rehabilitated Enterprise — With Project')}</h4>
  {inputFields('with',state.with)}
  <h4>{t('۶. اثر افزایشی سرمایه‌گذاری جدید','6. Incremental Effect of New Investment')}</h4>
  <div className="fw-grid">
   <article className="fw-result"><small>{t('NPV بدون طرح','Without-Project NPV')}</small><b>{fmt(result.withoutProjectNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('NPV با طرح','With-Project NPV')}</small><b>{fmt(result.withProjectNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('NPV افزایشی','Incremental NPV')}</small><b>{fmt(result.incrementalNpv)} {currency}</b></article>
   <article className="fw-result"><small>{t('IRR افزایشی','Incremental IRR')}</small><b>{result.incrementalIrr===null?'—':fmt(result.incrementalIrr*100)+'٪'}</b></article>
  </div>
  <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('دوره','Period')}</th><th>{t('بدون طرح','Without Project')}</th><th>{t('با طرح','With Project')}</th><th>{t('اثر افزایشی','Incremental')}</th></tr></thead><tbody>{result.periods.map(row=><tr key={row.period}><th>{row.period}</th><td>{fmt(row.withoutProjectCashFlow)}</td><td>{fmt(row.withProjectCashFlow)}</td><td>{fmt(row.incrementalCashFlow)}</td></tr>)}</tbody></table></div>
  <p className="fw-hint">{t('جریان نقدی هر سناریو = درآمد − هزینه نقدی عملیاتی − مالیات − CAPEX − تغییر سرمایه در گردش + عواید فروش دارایی + ارزش نهایی. تحلیل افزایشی از تفاضل جریان‌های نقدی هم‌دوره ساخته می‌شود. برای جلوگیری از دو بار شماری، جریان‌های هر دو سناریو باید شامل اقلام بنگاه و طرح با طبقه‌بندی یکسان باشند.','Each scenario cash flow = revenue − cash operating costs − tax − CAPEX − change in working capital + asset sale proceeds + terminal value. Incremental analysis is the period-by-period difference. Both scenarios must use consistent enterprise/project classifications to avoid double counting.')}</p>
 </section>
}
