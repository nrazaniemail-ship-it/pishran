import { useState } from 'react'
import { ArrowRight, Factory, Layers3, AlertTriangle, Calculator } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'
import ProcessPlantWorkspace from './ProcessPlantWorkspace'
import { INTEGRATED_reference_REFERENCE as benchmark } from './integratedProjectBenchmark'
import { WORKBOOK_RECONCILIATION_FLAGS } from './workbookReconciliation'

type Unit = 'dri' | 'steelmaking'



export default function IntegratedSteelComplexWorkspace({ project, onBack, language='fa' }: { project: FeasibilityProject; onBack: () => void; language?: 'fa'|'en' }) {
  const en=language==='en'
  const money=(value:number)=>new Intl.NumberFormat(en?'en-GB':'fa-IR',{maximumFractionDigits:2}).format(value)
  const t=(fa:string,english:string)=>en?english:fa
  const [unit, setUnit] = useState<Unit>('dri')
  return <section className="projects-page" dir={en?"ltr":"rtl"}>
    <div className="page-heading">
      <div><span className="eyebrow">INTEGRATED STEEL COMPLEX / DRI + MELTING + CASTING</span><h1>{project.name}</h1><p>{t('یک پروژه، دو کارگاه فرایندی مستقل و یک مبنای مشترک برای کنترل سرمایه‌گذاری','One project, two independent process units and a shared investment-control basis')}</p></div>
      <button className="secondary-button" onClick={onBack}><ArrowRight size={16}/> {t('بازگشت به پروژه‌ها','Back to Projects')}</button>
    </div>
    <div className="project-grid">
      <article className="project-card">
        <div className="module-icon"><Factory size={22}/></div><h3>{en?'Direct Reduction':'احیای مستقیم'}</h3><p>{t('ظرفیت مرجع: ','Reference capacity: ')}{benchmark.driCapacityTpy.toLocaleString(en?'en-US':'fa-IR')}{t(' تن DRI در سال',' tonnes of DRI per year')}</p>
        <button className={unit === 'dri' ? 'primary' : 'secondary-button'} onClick={() => setUnit('dri')}>{t('ورود به کارگاه DRI','Open DRI Workspace')}</button>
      </article>
      <article className="project-card">
        <div className="module-icon"><Layers3 size={22}/></div><h3>{en?'Melting & Casting':'ذوب و ریخته‌گری'}</h3><p>{t('ظرفیت مرجع: ','Reference capacity: ')}{benchmark.slabCapacityTpy.toLocaleString(en?'en-US':'fa-IR')}{t(' تن تختال در سال',' tonnes of slab per year')}</p>
        <button className={unit === 'steelmaking' ? 'primary' : 'secondary-button'} onClick={() => setUnit('steelmaking')}>{t('ورود به کارگاه فولادسازی','Open Steelmaking Workspace')}</button>
      </article>
    </div>
    <div className="ppw-note"><b>{unit==='dri'?t('کارگاه احیای مستقیم','Direct Reduction Workspace'):t('کارگاه فولادسازی و ریخته‌گری','Steelmaking & Casting Workspace')}</b><p>{t('هر دو کارگاه با شناسه همین پروژه ذخیره می‌شوند؛ داده‌های فنی مستقل می‌مانند و پروژه به دو پروژه جداگانه تکثیر نمی‌شود.','Both workspaces are saved under this project ID. Their technical data remain independent, without duplicating the project into two separate projects.')}</p></div>
    <ProcessPlantWorkspace language={language} project={project} plantType={unit} onBack={onBack}/>
    <section className="analytics" style={{ marginTop: 24 }}>
      <article className="chart-card">
        <div className="card-heading"><div><span className="eyebrow">Reference CONTROL TOTALS</span><h3>{t('مبنای تطبیق گزارش مرجع مالی','Reference Report Reconciliation Basis')}</h3></div><span className="tag">{t('یورو','EUR')}</span></div>
        <div className="kpis">
          <div className="kpi"><span>{t('سرمایه‌گذاری کل','Total Investment')}</span><b>{money(benchmark.totalInvestment)}</b></div>
          <div className="kpi"><span>{t('کل منابع تأمین مالی','Total Funding Sources')}</span><b>{money(benchmark.totalSources)}</b></div>
          <div className="kpi"><span>{t('شکاف منابع','Funding Gap')}</span><b>{money(benchmark.fundingGap)}</b></div>
          <div className="kpi"><span>NPV پروژه @25%</span><b>{money(benchmark.projectNpvAt25)}</b></div>
        </div>
        <div className="notice">{t('فروش سال مرجع: ','Reference-year revenue: ')}{money(benchmark.referenceRevenue)} · {t('هزینه کارخانه‌ای: ','Factory cost: ')}{money(benchmark.referenceFactoryCost)} · {t('استهلاک: ','Depreciation: ')}{money(benchmark.referenceDepreciation)} · IRR پروژه: {benchmark.projectIrr}% · IRR حقوق صاحبان سهام: {benchmark.equityIrr}%</div>
      </article>
      <article className="insight-card">
        <div className="module-icon gold"><Calculator size={22}/></div><span className="eyebrow">AUDIT FLAGS</span><h3>{t('موارد نیازمند اصلاح/تأیید','Items Requiring Correction / Confirmation')}</h3>
        <p><AlertTriangle size={15}/> {t('شکاف منابع','Funding Gap')} و مصارف برابر {money(benchmark.fundingGap)} {t('یورو','EUR')} است؛ پیش از تأیید مدل باید منبع پوشش آن مشخص شود.</p>
        <p>{t('هزینه کارخانه‌ای مرجع مالی، استهلاک را جداگانه گزارش می‌کند؛ مقایسه با OPEX اکسل باید بر مبنای هزینه نقدی و سپس استهلاک جداگانه انجام شود.','Reference reports depreciation separately from factory cost. Compare Excel OPEX on a cash-cost basis, then reconcile depreciation separately.')}</p>
        <p>{t('نرخ مالیات دوره اول در خروجی مرجع مالی ۵٪ و نرخ سال مرجع ۲۵٪ است؛ اعمال نرخ ثابت بدون بازسازی معافیت‌ها مجاز نیست.','The Reference output shows a 5% tax rate in the first period and 25% in the reference year. Do not apply a flat rate without reconstructing tax holidays.')}</p>
        <p>{t('این ارقام «مبنای کنترل گزارش» هستند، نه جایگزین مدل محاسباتی و نه تأیید صحت مفروضات مهندسی.','These figures are report-control benchmarks, not a replacement for the calculation model or confirmation of engineering assumptions.')}</p>
        {WORKBOOK_RECONCILIATION_FLAGS.slice(0,3).map((flag,index)=><p key={index}><AlertTriangle size={15}/> {flag}</p>) }
      </article>
    </section>
  </section>
}
