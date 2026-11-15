import type { OneWaySensitivityAnalysis } from '../steel/financialModel'
import type { PeriodicProjectFinanceResult } from '../steel/periodicFinancialEngine'

type Props = {
  language: 'fa' | 'en'
  isHotRollingCoil: boolean
  project: { name: string; location: string; owner: string; startYear: number; constructionYears: number; operatingYears: number; currency: string; fxRate: number }
  capacity: number
  sellingPrice: number
  variableCostPerUnit: number
  fixedAnnualCost: number
  breakEvenQuantity: number
  capex: number
  workingCapital: number
  equityPercent: number
  debtPercent: number
  taxPercent: number
  discountRatePercent: number
  npvProject: number | null
  irrProject: number | null
  mirrProject: number | null
  npvEquity: number | null
  irrEquity: number | null
  mirrEquity: number | null
  sensitivity: OneWaySensitivityAnalysis | null
  periodicResult: PeriodicProjectFinanceResult | null
  periodicAssetScheduleVerified?: boolean
  periodicAssetWarnings?: string[]
}

const referenceRows: [string,string,string,string][] = [
  ['ظرفیت طرح','200,000','تن در سال','OPEX › مشخصات کلی طرح، ردیف 6'],
  ['اشتغال مستقیم','285','نفر','OPEX › مشخصات کلی طرح، ردیف 7'],
  ['مدت زمان ساخت','2','سال','OPEX › مشخصات کلی طرح، ردیف 5'],
  ['Learning Curve','70% / 80% / 90% / 100%','سال اول تا چهارم','OPEX › مشخصات کلی طرح، ردیف‌های 8 و 9'],
  ['نرخ تسعیر یورو','524,000','ریال/یورو','OPEX › مشخصات کلی طرح، ردیف 18'],
  ['سرمایه‌گذاری ثابت','18,463,008.72','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 22'],
  ['هزینه‌های قبل از بهره‌برداری، خالص از بهره','239,826.64','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 23'],
  ['کل سرمایه‌گذاری دوران ساخت','18,702,835.36','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 24'],
  ['سرمایه در گردش در ظرفیت کامل','4,595,370.46','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 25'],
  ['بهره سرمایه‌ای‌شده دوران ساخت','3,298,633.06','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 26'],
  ['جمع سرمایه‌گذاری با بهره وام','26,596,838.88','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 27'],
  ['متوسط بهای تمام‌شده، خلاصه طرح','213.3','میلیون ریال/تن','OPEX › مشخصات کلی طرح، ردیف 28'],
  ['متوسط قیمت فروش، خلاصه طرح','307','میلیون ریال/تن','OPEX › مشخصات کلی طرح، ردیف 29'],
  ['سود سالانه در ظرفیت کامل','16,127,965.95','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 30'],
  ['دوره بازگشت عادی با ساخت','3.86','سال','OPEX › مشخصات کلی طرح، ردیف 31'],
  ['دوره بازگشت دینامیک با ساخت','5.02','سال','OPEX › مشخصات کلی طرح، ردیف 32'],
  ['NPV در نرخ 25%','31,399,764.27','میلیون ریال','OPEX › مشخصات کلی طرح، ردیف 33'],
  ['IRR گزارش خلاصه','48.31','درصد','OPEX › مشخصات کلی طرح، ردیف 34'],
  ['MIRR گزارش خلاصه','28.03','درصد','OPEX › مشخصات کلی طرح، ردیف 35'],
  ['IRR حقوق صاحبان سهام','57.99','درصد','OPEX › مشخصات کلی طرح، ردیف 36'],
  ['MIRR حقوق صاحبان سهام','30.90','درصد','OPEX › مشخصات کلی طرح، ردیف 37'],
  ['نقطه سربه‌سر، خلاصه طرح','12.15','درصد ظرفیت کامل','OPEX › مشخصات کلی طرح، ردیف 38'],
  ['نقطه سربه‌سر، محاسبه تفصیلی','24,675.80','تن/سال؛ 12.3379% ظرفیت','OPEX › تحلیل نقطه سر به سر، ردیف 22'],
  ['مبنای تأمین مالی بر اساس مبالغ منبع','70% آورده / 30% وام','درصد سرمایه‌گذاری ساخت','OPEX › نحوه تأمین منابع، ردیف‌های 9 تا 13'],
  ['نرخ تسهیلات عمومی / جدول اقساط','23% / 26%','سالانه','OPEX › مشخصات کلی طرح و برنامه زمانی بازپرداخت']
]

const t = (fa: string, en: string, language: 'fa'|'en') => language === 'en' ? en : fa
const fmt = (value: number | null | undefined, language: 'fa'|'en', digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toLocaleString(language === 'en' ? 'en-US' : 'fa-IR', { maximumFractionDigits: digits, minimumFractionDigits: digits })

function SensitivityChart({ analysis, language, currency }: { analysis: OneWaySensitivityAnalysis | null; language: 'fa'|'en'; currency: string }) {
  if (!analysis) return <p className="fw-hint">{t('در حال آماده‌سازی تحلیل حساسیت یک‌متغیره؛ مدل مالی یکپارچه باید یک بار محاسبه شود.','One-way sensitivity analysis is being prepared; the integrated financial model must complete one calculation.',language)}</p>
  const usable = analysis.factors.filter(f => f.available && f.lowNpv != null && f.highNpv != null)
  const maxDelta = Math.max(1, ...usable.flatMap(f => [Math.abs((f.lowNpv ?? analysis.baseNpv ?? 0) - (analysis.baseNpv ?? 0)), Math.abs((f.highNpv ?? analysis.baseNpv ?? 0) - (analysis.baseNpv ?? 0))]))
  const center = 420, half = 280, rowHeight = 54
  const xFor = (delta: number) => center + delta / maxDelta * half
  return <div>
    <p className="fw-hint">{t('تغییر هر عامل به‌صورت مستقل و در دامنه ±','Each factor is changed independently by ±',language)}{fmt(analysis.changePercent,language,0)}{t('٪؛ سایر مفروضات ثابت می‌مانند. نمودار تغییر NPV نسبت به حالت پایه را نشان می‌دهد.','%; all other assumptions remain unchanged. Bars show NPV change against the base case.',language)}</p>
    <svg viewBox="0 0 740 280" role="img" aria-label={t('نمودار حساسیت NPV','NPV sensitivity chart',language)} style={{width:'100%',height:'auto',minHeight:220}}>
      <line x1={center} y1="12" x2={center} y2="258" stroke="currentColor" strokeOpacity=".45" strokeDasharray="4 4"/>
      <text x={center} y="10" textAnchor="middle" fontSize="10" fill="currentColor">{t('حالت پایه','Base',language)}</text>
      {usable.map((factor,index)=>{
        const y=32+index*rowHeight
        const low=(factor.lowNpv??0)-(analysis.baseNpv??0)
        const high=(factor.highNpv??0)-(analysis.baseNpv??0)
        const lowX=xFor(low), highX=xFor(high)
        return <g key={factor.id}>
          <text x="8" y={y+18} fontSize="12" fill="currentColor">{language==='en'?factor.labelEn:factor.labelFa}</text>
          <rect x={Math.min(center,lowX)} y={y+5} width={Math.max(1,Math.abs(lowX-center))} height="12" rx="3" fill="#c75b54"/>
          <rect x={Math.min(center,highX)} y={y+23} width={Math.max(1,Math.abs(highX-center))} height="12" rx="3" fill="#2f9676"/>
          <text x="725" y={y+16} textAnchor="end" fontSize="10" fill="currentColor">{t('کاهش','Down',language)}: {fmt(low,language,0)}</text>
          <text x="725" y={y+34} textAnchor="end" fontSize="10" fill="currentColor">{t('افزایش','Up',language)}: {fmt(high,language,0)}</text>
        </g>
      })}
    </svg>
    <div className="fw-hint">{t('واحد تغییر NPV:','NPV delta unit:',language)} {currency} · {t('NPV پایه:','Base NPV:',language)} {fmt(analysis.baseNpv,language)} · IRR {fmt((analysis.baseIrr ?? NaN)*100,language)}٪</div>
    {analysis.factors.some(f=>!f.available)&&<p className="fw-hint">{t('تحلیل انرژی فقط در صورت ثبت مستقل هزینه سالانه انرژی در سیاست سرمایه در گردش فعال می‌شود.','Energy sensitivity is enabled only when annual energy cost is entered as a separate working-capital basis.',language)}</p>}
  </div>
}


function ReferenceSensitivityChart({ language }: { language:'fa'|'en' }) {
  const shocks=[-20,-16,-12,-8,-4,0,4,8,12,16,20]
  const series=[
    {nameFa:'قیمت فروش',nameEn:'Selling price',values:[19.45,25.98,32.06,37.77,43.17,48.31,53.24,57.96,62.52,66.92,71.18],color:'#2f9676'},
    {nameFa:'سرمایه‌گذاری ثابت',nameEn:'Fixed investment',values:[56.91,54.93,53.10,51.40,49.80,48.31,46.92,45.60,44.36,43.19,42.08],color:'#c28b36'},
    {nameFa:'هزینه‌های عملیاتی',nameEn:'Operating costs',values:[64.47,61.40,58.26,55.03,51.72,48.31,44.80,41.18,37.42,33.53,29.48],color:'#547baf'}
  ]
  const x=(value:number)=>64+(value+20)/40*620
  const y=(value:number)=>258-(value-15)/60*210
  return <div>
    <p className="fw-hint">{language==='en'?'Source workbook IRR response to ±20% one-way changes in selling price, fixed investment and operating costs.':'واکنش IRR در فایل مرجع OPEX به تغییر مستقل ±۲۰٪ قیمت فروش، سرمایه‌گذاری ثابت و هزینه‌های عملیاتی.'}</p>
    <svg viewBox="0 0 740 300" role="img" aria-label={language==='en'?'Reference IRR sensitivity':'تحلیل حساسیت IRR مرجع'} style={{width:'100%',height:'auto',minHeight:220}}>
      {[20,30,40,50,60,70].map(v=><g key={v}><line x1="64" x2="684" y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity=".12"/><text x="56" y={y(v)+4} textAnchor="end" fontSize="10" fill="currentColor">{v}%</text></g>)}
      {shocks.map(v=><text key={v} x={x(v)} y="280" textAnchor="middle" fontSize="9" fill="currentColor">{v>0?'+':''}{v}%</text>)}
      {series.map(s=><g key={s.nameEn}><polyline points={s.values.map((v,i)=>`${x(shocks[i])},${y(v)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5"/>{s.values.map((v,i)=><circle key={i} cx={x(shocks[i])} cy={y(v)} r="3" fill={s.color}/>)}</g>)}
    </svg>
    <div className="fw-grid" style={{gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
      {series.map(s=><div className="fw-hint" key={s.nameEn}><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:s.color,marginInlineEnd:6}}/>{language==='en'?s.nameEn:s.nameFa}</div>)}
    </div>
    <p className="fw-hint">{language==='en'?'Energy tariff sensitivity is a separate workbook case: a −80% to +80% energy-cost change moves IRR from 47.65% to 46.01%, with 46.83% at the base case.':'حساسیت نرخ انرژی در شیت جداگانه بررسی شده است: تغییر هزینه انرژی از ۸۰٪ کاهش تا ۸۰٪ افزایش، IRR را از ۴۷٫۶۵٪ به ۴۶٫۰۱٪ می‌رساند؛ مقدار پایه این شیت ۴۶٫۸۳٪ است.'}</p>
    <svg viewBox="0 0 740 300" role="img" aria-label={language==='en'?'Energy cost sensitivity':'حساسیت هزینه انرژی'} style={{width:'100%',height:'auto',minHeight:210}}>
      {[46,47,48].map(v=><g key={v}><line x1="64" x2="684" y1={258-(v-45)/5*210} y2={258-(v-45)/5*210} stroke="currentColor" strokeOpacity=".12"/><text x="56" y={262-(v-45)/5*210} textAnchor="end" fontSize="10" fill="currentColor">{v}%</text></g>)}
      {[-80,-60,-40,-20,0,20,40,60,80].map(v=><text key={v} x={64+(v+80)/160*620} y="280" textAnchor="middle" fontSize="9" fill="currentColor">{v>0?'+':''}{v}%</text>)}
      <polyline points={[47.65,47.45,47.24,47.04,46.83,46.63,46.42,46.21,46.01].map((v,i)=>`${64+(i/8)*620},${258-(v-45)/5*210}`).join(' ')} fill="none" stroke="#547baf" strokeWidth="3"/>
      {[47.65,47.45,47.24,47.04,46.83,46.63,46.42,46.21,46.01].map((v,i)=><circle key={i} cx={64+(i/8)*620} cy={258-(v-45)/5*210} r="3.5" fill="#547baf"/>)}
      <text x="374" y="296" textAnchor="middle" fontSize="11" fill="currentColor">{language==='en'?'Energy cost change':'تغییر هزینه انرژی'}</text>
    </svg>
    <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{language==='en'?'Energy cost change':'تغییر هزینه انرژی'}</th><th>IRR</th></tr></thead><tbody>{[-80,-60,-40,-20,0,20,40,60,80].map((v,i)=><tr key={v}><td>{v>0?'+':''}{v}%</td><td>{[47.65,47.45,47.24,47.04,46.83,46.63,46.42,46.21,46.01][i].toFixed(2)}%</td></tr>)}</tbody></table></div>
  </div>
}

function BreakEvenChart({ capacity, price, variable, fixed, breakEven, currency, language }: { capacity:number; price:number; variable:number; fixed:number; breakEven:number; currency:string; language:'fa'|'en' }) {
  const valid = capacity > 0 && price >= 0 && variable >= 0 && fixed >= 0
  if (!valid) return <p className="fw-hint">{t('برای ترسیم نمودار، ظرفیت، قیمت فروش و هزینه‌ها را تکمیل کنید.','Enter capacity, selling price and costs to draw the chart.',language)}</p>
  const maxRevenue = capacity * price
  const maxCost = fixed + capacity * variable
  const maxY = Math.max(1, maxRevenue, maxCost) * 1.08
  const x = (q:number) => 64 + (q / capacity) * 620
  const y = (amount:number) => 258 - (amount / maxY) * 210
  const samples = Array.from({length:7},(_,i)=>capacity*i/6)
  const path = (values:number[]) => values.map((value,index)=>`${index===0?'M':'L'} ${x(samples[index])} ${y(value)}`).join(' ')
  const revenuePath = path(samples.map(q=>q*price))
  const variablePath = path(samples.map(q=>q*variable))
  const totalPath = path(samples.map(q=>fixed+q*variable))
  const fixedPath = path(samples.map(()=>fixed))
  const markerVisible = Number.isFinite(breakEven) && breakEven >= 0 && breakEven <= capacity
  return <div>
    <svg viewBox="0 0 740 310" role="img" aria-label={t('نمودار نقطه سربه‌سر','Break-even chart',language)} style={{width:'100%',height:'auto',minHeight:230}}>
      {[0,1,2,3,4].map(i=><g key={i}><line x1="64" x2="684" y1={258-i*52.5} y2={258-i*52.5} stroke="currentColor" strokeOpacity=".12"/><text x="56" y={262-i*52.5} textAnchor="end" fontSize="10" fill="currentColor">{fmt(maxY*i/4,language,0)}</text></g>)}
      <line x1="64" y1="258" x2="684" y2="258" stroke="currentColor" strokeOpacity=".65"/>
      <line x1="64" y1="48" x2="64" y2="258" stroke="currentColor" strokeOpacity=".65"/>
      <path d={fixedPath} fill="none" stroke="#9b8c70" strokeWidth="2" strokeDasharray="5 4"/>
      <path d={variablePath} fill="none" stroke="#8a9eaa" strokeWidth="2"/>
      <path d={totalPath} fill="none" stroke="#c75b54" strokeWidth="3"/>
      <path d={revenuePath} fill="none" stroke="#2f9676" strokeWidth="3"/>
      {markerVisible&&<g><line x1={x(breakEven)} x2={x(breakEven)} y1="48" y2="258" stroke="#c28b36" strokeDasharray="4 4" strokeWidth="2"/><circle cx={x(breakEven)} cy={y(breakEven*price)} r="5" fill="#c28b36"/><text x={Math.min(680,x(breakEven)+8)} y={Math.max(45,y(breakEven*price)-10)} fontSize="11" fill="currentColor">{t('نقطه سربه‌سر','Break-even',language)}</text></g>}
      <text x="374" y="294" textAnchor="middle" fontSize="12" fill="currentColor">{t('حجم تولید (تن در سال)','Production volume (tonnes/year)',language)}</text>
    </svg>
    <div className="fw-grid" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
      {[[t('درآمد فروش','Sales revenue',language),'#2f9676'],[t('هزینه کل','Total cost',language),'#c75b54'],[t('هزینه ثابت','Fixed cost',language),'#9b8c70'],[t('هزینه متغیر','Variable cost',language),'#8a9eaa']].map(([label,color])=><div key={label} className="fw-hint"><span style={{display:'inline-block',width:10,height:10,borderRadius:2,background:color,marginInlineEnd:6}}/>{label}</div>)}
    </div>
    <div className="fw-validation"><span>{t('مقدار نقطه سربه‌سر','Break-even volume',language)}</span><b>{fmt(breakEven,language)} {t('تن','tonnes',language)} · {fmt(capacity>0?breakEven/capacity*100:NaN,language)}٪ {t('ظرفیت','capacity',language)}</b></div>
    {breakEven>capacity&&<p className="fw-hint">{t('نقطه سربه‌سر بالاتر از ظرفیت عملی پروژه است؛ در ظرفیت فعلی، پروژه به حاشیه مشارکت کافی نمی‌رسد.','Break-even exceeds project capacity; the current project does not reach sufficient contribution margin.',language)}</p>}
  </div>
}

export default function ProjectReportVisuals(props: Props) {
  const { language, isHotRollingCoil, project } = props
  const fmtValue=(value:number|null|undefined,digits=2)=>fmt(value,language,digits)
  const currentRows: [string,string,string][] = [
    [t('ظرفیت عملی قابل فروش','Saleable capacity',language),fmtValue(props.capacity,0),t('تن در سال','tonnes/year',language)],
    [t('سرمایه‌گذاری ثبت‌شده','Recorded investment',language),fmtValue(props.capex),props.project.currency],
    [t('سرمایه در گردش','Working capital',language),fmtValue(props.workingCapital),props.project.currency],
    [t('آورده / تسهیلات','Equity / debt',language),`${fmtValue(props.equityPercent,1)}% / ${fmtValue(props.debtPercent,1)}%`,t('درصد','percent',language)],
    [t('مالیات','Tax rate',language),fmtValue(props.taxPercent,2)+'%',t('درصد','percent',language)],
    [t('نرخ تنزیل فعال','Active discount rate',language),fmtValue(props.discountRatePercent,2)+'%',t('درصد','percent',language)],
    ['NPV',fmtValue(props.npvProject),props.project.currency],
    ['IRR',props.irrProject==null?'—':fmtValue(props.irrProject*100)+'%',t('درصد','percent',language)],
    ['MIRR',props.mirrProject==null?'—':fmtValue(props.mirrProject*100)+'%',t('درصد','percent',language)],
    [t('NPV حقوق صاحبان سهام','Equity NPV',language),fmtValue(props.npvEquity),props.project.currency],
    [t('IRR حقوق صاحبان سهام','Equity IRR',language),props.irrEquity==null?'—':fmtValue(props.irrEquity*100)+'%',t('درصد','percent',language)],
    [t('MIRR حقوق صاحبان سهام','Equity MIRR',language),props.mirrEquity==null?'—':fmtValue(props.mirrEquity*100)+'%',t('درصد','percent',language)],
  ]
  return <div className="fw-card" style={{marginTop:18}}>
    <h3>{t('گزارش تفصیلی، نمودارها و مشخصات کلی پروژه','Detailed Report, Charts & Project Specifications',language)}</h3>
    <div className="fw-card">
      <h4>{t('نمودار تحلیل حساسیت','Sensitivity Analysis Chart',language)}</h4>
      <SensitivityChart analysis={props.sensitivity} language={language} currency={project.currency}/>
      {isHotRollingCoil&&<div className="fw-card"><h4>{t('نمودار حساسیت مرجع OPEX','OPEX Reference Sensitivity Charts',language)}</h4><ReferenceSensitivityChart language={language}/></div>}
    </div>
    <div className="fw-card">
      <h4>{t('نمودار نقطه سربه‌سر','Break-Even Chart',language)}</h4>
      {isHotRollingCoil&&<><p className="fw-hint">{t('نمودار مرجع بازسازی‌شده از شیت «تحلیل نقطه سر به سر» فایل OPEX؛ مقادیر مستقل از مفروضات جاری نگهداری می‌شوند.','Reconstructed from the OPEX “Break-even Analysis” sheet; these source values remain separate from current model assumptions.',language)}</p><BreakEvenChart capacity={83000} price={311.298} variable={207.196445} fixed={2568789} breakEven={24675.79855075171} currency="میلیون ریال" language={language}/></>}
      <h4>{t('نقطه سربه‌سر بر اساس مفروضات جاری پروژه','Break-even Based on Current Project Assumptions',language)}</h4>
      <BreakEvenChart capacity={props.capacity} price={props.sellingPrice} variable={props.variableCostPerUnit} fixed={props.fixedAnnualCost} breakEven={props.breakEvenQuantity} currency={project.currency} language={language}/>
    </div>
    <div className="fw-card">
      <h4>{t('مشخصات جاری پروژه','Current Project Specifications',language)}</h4>
      <div className="fw-validation"><span>{t('نام پروژه','Project name',language)}</span><b>{project.name}</b></div>
      <div className="fw-validation"><span>{t('موقعیت','Location',language)}</span><b>{project.location}</b></div>
      <div className="fw-validation"><span>{t('سرمایه‌گذار / مجری','Investor / operator',language)}</span><b>{project.owner||'—'}</b></div>
      <div className="fw-validation"><span>{t('سال شروع / دوره ساخت / بهره‌برداری','Start year / construction / operation',language)}</span><b>{fmtValue(project.startYear,0)} / {fmtValue(project.constructionYears,1)} / {fmtValue(project.operatingYears,1)}</b></div>
      <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('شاخص','Indicator',language)}</th><th>{t('مقدار','Value',language)}</th><th>{t('واحد','Unit',language)}</th></tr></thead><tbody>{currentRows.map((row,i)=><tr key={i}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></div>
    </div>
    {props.periodicResult?.valid&&<div className="fw-card">
      <h4>{t('خروجی‌های مدل مالی دوره‌ای','Periodic Financial Model Outputs',language)}</h4>
      <p className="fw-hint">{props.periodicAssetScheduleVerified?t('CAPEX، هزینه‌های قبل از بهره‌برداری، استهلاک دارایی‌ها و فروش‌ها از دفتر دارایی دوره‌ای و تاریخ‌های دقیق تغذیه شده‌اند.','CAPEX, pre-production cost, asset depreciation and disposals are sourced from the date-specific periodic asset register.'):t('برای این گزارش، برنامه دارایی دوره‌ای به‌طور کامل تأیید نشده است؛ CAPEX و استهلاک از برنامه سالانه به دوره‌ها تخصیص یافته‌اند.','The periodic asset register is not fully verified for this report; CAPEX and depreciation are allocated from annual schedules.')}</p>
      {props.periodicAssetWarnings?.length>0&&<ul className="fw-checklist">{props.periodicAssetWarnings.map((warning,i)=><li key={'asset-report-'+i}>{warning}</li>)}</ul>}
      <div className="fw-grid">
        <div className="fw-result">NPV · {fmtValue(props.periodicResult.npvProject)} {project.currency}</div>
        <div className="fw-result">IRR · {props.periodicResult.irrProject==null?'—':fmtValue(props.periodicResult.irrProject)+'%'}</div>
        <div className="fw-result">MIRR · {props.periodicResult.mirrProject==null?'—':fmtValue(props.periodicResult.mirrProject)+'%'}</div>
        <div className="fw-result">{t('NPV سهامدار','Equity NPV',language)} · {fmtValue(props.periodicResult.npvEquity)} {project.currency}</div>
        <div className="fw-result">{t('IRR سهامدار','Equity IRR',language)} · {props.periodicResult.irrEquity==null?'—':fmtValue(props.periodicResult.irrEquity)+'%'}</div>
        <div className="fw-result">{t('اوج سرمایه در گردش','Peak working capital',language)} · {fmtValue(props.periodicResult.peakWorkingCapital)} {project.currency}</div>
      </div>
      <div style={{overflowX:'auto',maxHeight:420}}><table className="fw-table"><thead><tr><th>{t('دوره','Period',language)}</th><th>{t('تاریخ','Dates',language)}</th><th>{t('نرخ مالیات','Tax rate',language)}</th><th>{t('بهره','Interest',language)}</th><th>{t('اصل','Principal',language)}</th><th>CFADS</th><th>DSCR</th><th>{t('جریان نقد پروژه','Project FCF',language)}</th><th>{t('جریان نقد سهامدار','Equity FCF',language)}</th></tr></thead><tbody>{props.periodicResult.rows.map(row=><tr key={row.period}><td>{row.period}</td><td>{row.startDate} – {row.endDate}</td><td>{fmtValue(row.taxRatePercent)}%</td><td>{fmtValue(row.interestExpense)}</td><td>{fmtValue(row.principal)}</td><td>{fmtValue(row.cfads)}</td><td>{row.dscr==null?'—':fmtValue(row.dscr)+'x'}</td><td>{fmtValue(row.projectFreeCashFlow)}</td><td>{fmtValue(row.equityFreeCashFlow)}</td></tr>)}</tbody></table></div>
      {props.periodicResult.warnings.length>0&&<p className="fw-hint">{props.periodicResult.warnings.join(' · ')}</p>}
    </div>}
    {props.periodicResult&&!props.periodicResult.valid&&<div className="fw-hint">{t('مدل دوره‌ای به علت نقص یا ناسازگاری ورودی‌ها محاسبه نشده است:','Periodic model was not calculated because inputs are incomplete or inconsistent:',language)} {props.periodicResult.warnings.join(' · ')}</div>}
    {!props.periodicResult&&<p className="fw-hint">{t('برای نمایش خروجی دوره‌ای، تاریخ‌ها و تناوب مالی را در فونداسیون پروژه تعیین و مرحله جریان نقدی را باز کنید.','Set project dates and financial frequency in the project foundation and open the cash-flow step to generate periodic outputs.',language)}</p>}
    {isHotRollingCoil&&<div className="fw-card">
      <h4>{t('جدول مشخصات کلی پروژه ـ مرجع فایل OPEX','General Project Specification — OPEX Workbook Reference',language)}</h4>
      <p className="fw-hint">{t('این جدول مقادیر مستند شیت «مشخصات کلی طرح» را حفظ می‌کند؛ این ارقام، snapshot تاریخی فایل مرجع هستند و با مفروضات جاری مدل جایگزین نمی‌شوند.','This table preserves the source values from the “General Project Specifications” sheet. These are historical workbook values and are not silently substituted for current model assumptions.',language)}</p>
      <div style={{overflowX:'auto'}}><table className="fw-table"><thead><tr><th>{t('شاخص','Indicator',language)}</th><th>{t('مقدار مرجع','Reference value',language)}</th><th>{t('واحد','Unit',language)}</th><th>{t('منبع','Source',language)}</th></tr></thead><tbody>{referenceRows.map((row,i)=><tr key={i}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td></tr>)}</tbody></table></div>
      <p className="fw-hint">{t('مغایرت‌های منبع: متن سلول فاینانس ۸۰٪ را ذکر می‌کند، اما مبالغ جدول تأمین منابع به حدود ۳۰٪ وام و ۷۰٪ آورده می‌رسند؛ نرخ تسهیلات عمومی ۲۳٪ و نرخ جدول اقساط ۲۶٪ است؛ قیمت فروش خلاصه ۳۰۷ و قیمت تفصیلی ۳۱۱٫۲۹۸ میلیون ریال بر تن است؛ بهای تمام‌شده خلاصه ۲۱۳٫۳ و شیت هزینه جاری ۲۲۱٫۲۳۴ میلیون ریال بر تن را نشان می‌دهد.','Source conflicts: the finance label says 80%, but the funding amounts imply about 30% debt and 70% equity; general loan rate is 23% while the repayment sheet uses 26%; summary selling price is 307 versus 311.298 million IRR/tonne in the detailed sheet; summary unit cost is 213.3 versus 221.234 million IRR/tonne in the operating-cost sheet.',language)}</p>
      <p className="fw-hint">{t('مبنای سربه‌سر نیز دو مقدار دارد: ۱۲٫۱۵٪ در خلاصه طرح و ۱۲٫۳۳۷۹٪ در تحلیل تفصیلی. نمودار بالا از مفروضات جاری پروژه محاسبه می‌شود و این دو مقدار مرجع را جداگانه نگه می‌دارد.','Break-even is also reported in two ways: 12.15% in the summary sheet and 12.3379% in the detailed analysis. The chart above is calculated from the current project assumptions and keeps these historical values separate.',language)}</p>
    </div>}
  </div>
}
