import { useState } from 'react'
import { ArrowRight, Factory, Layers3, AlertTriangle, Calculator } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'
import ProcessPlantWorkspace from './ProcessPlantWorkspace'

type Unit = 'dri' | 'steelmaking'

const benchmark = {
  currency: 'EUR',
  driCapacityTpy: 1_760_000,
  slabCapacityTpy: 1_200_000,
  fixedInvestment: 453_858_298,
  preproductionNet: 6_624_027,
  capitalizedInterest: 110_500_000,
  workingCapital: 68_155_775.89,
  totalInvestment: 639_138_100.89,
  equity: 139_982_325,
  longTermDebt: 431_000_000,
  shortTermDebt: 49_523_442.75,
  totalSources: 620_505_767.75,
  fundingGap: 18_632_333.14,
  referenceRevenue: 887_300_000,
  referenceFactoryCost: 643_963_499,
  referenceDepreciation: 26_727_770.59,
  projectNpvAt25: 19_964_251.38,
  projectIrr: 26.08,
  equityNpvAt30: 60_342_720.87,
  equityIrr: 40.51
}

const money = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value)

export default function IntegratedSteelComplexWorkspace({ project, onBack }: { project: FeasibilityProject; onBack: () => void }) {
  const [unit, setUnit] = useState<Unit>('dri')
  return <section className="projects-page" dir="rtl">
    <div className="page-heading">
      <div><span className="eyebrow">INTEGRATED STEEL COMPLEX / DRI + MELTING + CASTING</span><h1>{project.name}</h1><p>یک پروژه، دو کارگاه فرایندی مستقل و یک مبنای مشترک برای کنترل سرمایه‌گذاری</p></div>
      <button className="secondary-button" onClick={onBack}><ArrowRight size={16}/> بازگشت به پروژه‌ها</button>
    </div>
    <div className="project-grid">
      <article className="project-card">
        <div className="module-icon"><Factory size={22}/></div><h3>احیای مستقیم</h3><p>ظرفیت مرجع: {benchmark.driCapacityTpy.toLocaleString('fa-IR')} تن DRI در سال</p>
        <button className={unit === 'dri' ? 'primary' : 'secondary-button'} onClick={() => setUnit('dri')}>ورود به کارگاه DRI</button>
      </article>
      <article className="project-card">
        <div className="module-icon"><Layers3 size={22}/></div><h3>ذوب و ریخته‌گری</h3><p>ظرفیت مرجع: {benchmark.slabCapacityTpy.toLocaleString('fa-IR')} تن تختال در سال</p>
        <button className={unit === 'steelmaking' ? 'primary' : 'secondary-button'} onClick={() => setUnit('steelmaking')}>ورود به کارگاه فولادسازی</button>
      </article>
    </div>
    <div className="ppw-note"><b>{unit === 'dri' ? 'کارگاه احیای مستقیم' : 'کارگاه فولادسازی و ریخته‌گری'}</b><p>هر دو کارگاه با شناسه همین پروژه ذخیره می‌شوند؛ داده‌های فنی مستقل می‌مانند و پروژه به دو پروژه جداگانه تکثیر نمی‌شود.</p></div>
    <ProcessPlantWorkspace project={project} plantType={unit} onBack={() => setUnit(unit === 'dri' ? 'steelmaking' : 'dri')}/>
    <section className="analytics" style={{ marginTop: 24 }}>
      <article className="chart-card">
        <div className="card-heading"><div><span className="eyebrow">COMFAR CONTROL TOTALS</span><h3>مبنای تطبیق گزارش کامفار</h3></div><span className="tag">یورو</span></div>
        <div className="kpis">
          <div className="kpi"><span>سرمایه‌گذاری کل</span><b>{money(benchmark.totalInvestment)}</b></div>
          <div className="kpi"><span>کل منابع تأمین مالی</span><b>{money(benchmark.totalSources)}</b></div>
          <div className="kpi"><span>شکاف منابع</span><b>{money(benchmark.fundingGap)}</b></div>
          <div className="kpi"><span>NPV پروژه @25%</span><b>{money(benchmark.projectNpvAt25)}</b></div>
        </div>
        <div className="notice">فروش سال مرجع: {money(benchmark.referenceRevenue)} · هزینه کارخانه‌ای: {money(benchmark.referenceFactoryCost)} · استهلاک: {money(benchmark.referenceDepreciation)} · IRR پروژه: {benchmark.projectIrr}% · IRR حقوق صاحبان سهام: {benchmark.equityIrr}%</div>
      </article>
      <article className="insight-card">
        <div className="module-icon gold"><Calculator size={22}/></div><span className="eyebrow">AUDIT FLAGS</span><h3>موارد نیازمند اصلاح/تأیید</h3>
        <p><AlertTriangle size={15}/> شکاف منابع و مصارف برابر {money(benchmark.fundingGap)} یورو است؛ پیش از تأیید مدل باید منبع پوشش آن مشخص شود.</p>
        <p>هزینه کارخانه‌ای کامفار، استهلاک را جداگانه گزارش می‌کند؛ مقایسه با OPEX اکسل باید بر مبنای هزینه نقدی و سپس استهلاک جداگانه انجام شود.</p>
        <p>نرخ مالیات دوره اول در خروجی کامفار ۵٪ و نرخ سال مرجع ۲۵٪ است؛ اعمال نرخ ثابت بدون بازسازی معافیت‌ها مجاز نیست.</p>
        <p>این ارقام «مبنای کنترل گزارش» هستند، نه جایگزین مدل محاسباتی و نه تأیید صحت مفروضات مهندسی.</p>
      </article>
    </section>
  </section>
}
