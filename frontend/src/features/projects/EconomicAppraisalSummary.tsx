import type { EconomicAppraisalConfigurationResult } from './economicAppraisalIntegration'

type Props={result:EconomicAppraisalConfigurationResult|null;language?:'fa'|'en'}
const number=(value:number,language:'fa'|'en')=>new Intl.NumberFormat(language==='fa'?'fa-IR':'en-US',{maximumFractionDigits:2}).format(value)

export default function EconomicAppraisalSummary({result,language='fa'}:Props){
 if(!result||result.status==='not-requested')return null
 const en=language==='en'
 const t=(fa:string,english:string)=>en?english:fa
 const cashFlow=result.cashFlow
 return <section className="fw-card fw-economic-summary">
  <h3>{t('ارزیابی اقتصادی و اجتماعی','Economic and Social Appraisal')}</h3>
  {result.status==='blocked'&&<><p className="fw-lead">{t('محاسبه اقتصادی متوقف شده است؛ داده‌های زیر باید اصلاح یا تکمیل شوند.','Economic calculation is blocked; resolve the following data requirements.')}</p><ul className="fw-checklist">{result.issues.map((issue,index)=><li key={index}>{issue}</li>)}</ul></>}
  {result.status==='configuration-ready-not-valued'&&<p>{t('پارامترهای کلان ثبت شده‌اند، اما هنوز جریان اقتصادی دوره‌ای برای ارزش‌گذاری وجود ندارد.','Global parameters are configured, but no period economic cash flow is available yet.')}</p>}
  {result.status==='calculated'&&cashFlow&&<>
   <p className="fw-lead">{t('نتایج بر مبنای جریان‌های اقتصادی دوره‌ای در واحد شمارش انتخاب‌شده محاسبه شده‌اند.','Results are calculated from period economic flows in the selected numeraire.')}</p>
   <p>{t('واحد شمارش','Numeraire')}: <b>{cashFlow.currency}</b> · {t('مقیاس گزارش','Reporting unit')}: <b>{cashFlow.unit}</b></p>
   <div className="fw-kpis">
    <article><small>ENPV</small><b>{number(cashFlow.enpv,language)}</b></article>
    <article><small>EIRR</small><b>{cashFlow.eirr===null?'—':number(cashFlow.eirr,language)+'%'}</b></article>
    <article><small>BCR</small><b>{cashFlow.benefitCostRatio===null?'—':number(cashFlow.benefitCostRatio,language)}</b></article>
    <article><small>{t('ارزش فعلی منافع','PV of benefits')}</small><b>{number(cashFlow.presentValueBenefits,language)}</b></article>
    <article><small>{t('ارزش فعلی هزینه‌ها','PV of costs')}</small><b>{number(cashFlow.presentValueCosts,language)}</b></article>
   </div>
   {cashFlow.irrStatus==='no-single-conventional-root'&&<p className="fw-hint">{t('برای جریان نقدی فعلی، ریشه متعارف و یکتای EIRR پیدا نشد؛ شاخص به‌صورت خط تیره نمایش داده شده است.','No single conventional EIRR root was found for the supplied cash flows; the metric is shown as a dash.')}</p>}
   <h4>{t('جریان اقتصادی دوره‌ای','Period Economic Cash Flow')}</h4>
   {cashFlow.periods.map(period=><div className="fw-validation" key={period.period}><span>{t('دوره','Period')} {period.period} · {period.startDate} – {period.endDate}</span><b>{t('منافع','Benefits')}: {number(period.benefits,language)} · {t('هزینه‌ها','Costs')}: {number(period.costs,language)} · {t('خالص','Net')}: {number(period.netBenefits,language)}</b></div>)}
  </>}
 </section>
}
