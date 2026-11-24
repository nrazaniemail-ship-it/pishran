import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Bot } from 'lucide-react'
import { Factory, Plus, Trash2 } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'capacity' | 'location' | 'steelStage' | 'templateId'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
  onOpenProject: (project: FeasibilityProject) => void
  language?: 'fa' | 'en'
  storageInfo: { backend: string; items: number }
}

const STEEL_INDUSTRY = 'فولاد و صنایع معدنی'
const STEEL_PROJECT_OPTIONS = [
  { name: 'معدن سنگ آهن', stage: 'استخراج سنگ‌آهن' },
  { name: 'کنستانتره', stage: 'فرآوری و کنسانتره' },
  { name: 'گندله سازی', stage: 'گندله‌سازی' },
  { name: 'احیاء', stage: 'احیای مستقیم' },
  { name: 'ذوب و ریخته گری', stage: 'فولادسازی و ریخته‌گری' },
  { name: 'نورد ورق گرم- تولید پلیت', stage: 'نورد گرم ورق - تولید پلیت' },
  { name: 'نورد ورق گرم- تولید کلاف', stage: 'نورد گرم ورق - تولید کلاف' },
  { name: 'نورد سرد ورق', stage: 'نورد سرد و پوشش‌دهی' },
  { name: 'نورد میلگرد', stage: 'نورد میلگرد' },
  { name: 'نورد نبشی', stage: 'نورد نبشی' },
  { name: 'نورد تیرآهن', stage: 'نورد تیرآهن' },
  { name: 'سایر', stage: 'سایر' },
]

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete, onOpenProject, language = 'fa', storageInfo }: Props) {
  const en = language === 'en'
  const t = (fa: string, english: string) => en ? english : fa
  const chart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 24, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: en ? ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'] : ['سال ۱', 'سال ۲', 'سال ۳', 'سال ۴', 'سال ۵'], axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf0f4' } } },
    series: [{ name: en ? 'Illustrative return' : 'بازده نمونه', type: 'line', smooth: true, data: [8, 12, 16, 19, 23], areaStyle: { opacity: .08 }, lineStyle: { width: 3 }, symbolSize: 8 }]
  }), [en])
  const projectNames: Record<string, string> = { 'معدن سنگ آهن':'Iron Ore Mining', 'کنستانتره':'Iron Ore Concentration', 'گندله سازی':'Pelletizing', 'احیاء':'Direct Reduction', 'ذوب و ریخته گری':'Steelmaking & Casting', 'نورد ورق گرم- تولید پلیت':'Hot-Rolled Plate', 'نورد ورق گرم- تولید کلاف':'Hot-Rolled Coil', 'نورد سرد ورق':'Cold Rolling', 'نورد میلگرد':'Rebar Rolling', 'نورد نبشی':'Angle Rolling', 'نورد تیرآهن':'Beam Rolling', 'سایر':'Other' }
  const industryNames: Record<string,string> = { [STEEL_INDUSTRY]:'Steel & Mining', 'انرژی و نیروگاه':'Energy & Power', 'نفت، گاز و پتروشیمی':'Oil, Gas & Petrochemicals', 'ساختمان و زیرساخت':'Construction & Infrastructure', 'سایر صنایع':'Other Industries' }
  const stageNames: Record<string,string> = { 'استخراج سنگ‌آهن':'Iron Ore Mining', 'فرآوری و کنسانتره':'Processing & Concentration', 'گندله‌سازی':'Pelletizing', 'احیای مستقیم':'Direct Reduction', 'فولادسازی و ریخته‌گری':'Steelmaking & Casting', 'نورد گرم ورق - تولید پلیت':'Hot-Rolled Plate', 'نورد گرم ورق - تولید کلاف':'Hot-Rolled Coil', 'نورد سرد و پوشش‌دهی':'Cold Rolling & Coating', 'نورد میلگرد':'Rebar Rolling', 'نورد نبشی':'Angle Rolling', 'نورد تیرآهن':'Beam Rolling', 'سایر':'Other' }
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('')
  const [steelStage, setSteelStage] = useState('')
  const [industry, setIndustry] = useState(STEEL_INDUSTRY)
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const isSteel = industry === STEEL_INDUSTRY
  const isEnergy = industry === 'انرژی و نیروگاه'


  function changeIndustry(value: string) {
    setIndustry(value)
    setName('')
    setProjectType('')
    setSteelStage('')
  }

  function changeSteelProject(value: string) {
    setProjectType(value)
    setName('')
    const option = STEEL_PROJECT_OPTIONS.find(item => item.name === value)
    setSteelStage(option?.stage ?? '')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const projectName = name.trim()
    if (!projectName) return
    await onCreate({
      name: projectName,
      industry,
      ...(projectType.trim() ? { projectType: projectType.trim() } : {}),
      ...(isSteel && steelStage ? { steelStage } : {}),
      capacity: capacity.trim(),
      location: location.trim(),
      templateId: 'raw'
    })
    setName(''); setProjectType(''); setSteelStage(''); setCapacity(''); setLocation(''); setShowForm(false)
  }

  return <section className="projects-page">
      <section className="section-head"><div><h2>{en ? "Investment Control Center" : "مرکز کنترل سرمایه‌گذاری"}</h2></div><span className="muted">{en ? 'Version 1.0.1' : 'نسخه ۱.۰.۱'}</span></section>
      <section className="kpis">
        <article className="kpi"><span>{en ? 'Registered projects' : 'پروژه‌های ثبت‌شده'}</span><b>{projects.length.toLocaleString(en ? 'en-US' : 'fa-IR')}</b><small>{en ? 'Stored on this device' : 'ذخیره‌شده روی این دستگاه'}</small></article>
        <article className="kpi"><span>{en ? 'Financial models' : 'مدل‌های مالی'}</span><b>{en ? '0' : '۰'}</b><small>{en ? 'Traceable and versioned calculations' : 'محاسبات قابل ثبت و نسخه‌بندی'}</small></article>
        <article className="kpi"><span>{en ? 'Compared scenarios' : 'سناریوهای مقایسه‌شده'}</span><b>{en ? '0' : '۰'}</b><small>{en ? 'A foundation for uncertainty analysis' : 'پایه‌ای برای تحلیل عدم‌قطعیت'}</small></article>
        <article className="kpi"><span>{en ? 'Storage status' : 'وضعیت ذخیره‌سازی'}</span><b className="live">{en&&storageInfo.backend==='در حال بررسی'?'Checking...':storageInfo.backend}</b><small>{en ? 'Data is kept on this device' : 'اطلاعات روی دستگاه نگهداری می‌شود'}</small></article>
      </section>

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{en ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{en ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{en ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{en ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{en ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    <div className="projects-workspace-divider" aria-hidden="true"></div>
    <div className="page-heading"><div><h1>{t('پروژه‌های امکان‌سنجی','Feasibility Projects')}</h1><p>{t('پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.','Manage your projects and investment studies on this device.')}</p></div><div className="projects-head-actions"><button className="primary projects-head-create" onClick={() => setShowForm(v => !v)}><Plus size={17}/> {t('پروژه جدید','New Project')}</button></div></div>
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>{t('تعریف پروژه جدید','Create New Project')}</h3>
      <div className="form-grid">
        <label>{t('صنعت','Industry')}
          <select value={industry} onChange={e => changeIndustry(e.target.value)}>
            {Object.entries(industryNames).map(([value,label]) => <option key={value} value={value}>{en ? label : value}</option>)}
          </select>
        </label>
        {isSteel ? <>
          <label>{t('نوع پروژه','Project Type')}
            <select required value={projectType}  onChange={e => changeSteelProject(e.target.value)}>
              <option value="" disabled>{t('ابتدا نوع پروژه را انتخاب کنید','Select a project type first')}</option>
              {STEEL_PROJECT_OPTIONS.map(option => <option key={option.name} value={option.name}>{en ? (projectNames[option.name] ?? option.name) : option.name}</option>)}
            </select>
          </label>
          
          {steelStage && <label>{t('نام پروژه','Project Name')}<input required value={name} onChange={e => setName(e.target.value)} placeholder={t('نام دلخواه پروژه را وارد کنید','Enter a project name')}/></label>}
        </> : <>
          <label>{t('نوع پروژه','Project Type')}<input required value={projectType} onChange={e => setProjectType(e.target.value)} placeholder={t('نوع فعالیت یا پروژه را وارد کنید','Enter the project or activity type')}/></label>
          <label>{t('نام پروژه','Project Name')}<input required value={name} onChange={e => setName(e.target.value)} placeholder={t('نام دلخواه پروژه را وارد کنید','Enter a project name')}/></label>
        </>}
        {isSteel ? <label>{t('ظرفیت اسمی (تن در سال)','Nameplate Capacity (tonnes/year)')}<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder={t('مثلاً ۵۰۰۰۰۰','e.g. 500000')}/></label> : isEnergy ? <label>{t('ظرفیت اسمی (مگاوات)','Nameplate Capacity (MW)')}<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder={t('مثلاً ۵۰۰','e.g. 500')}/></label> : <label>{t('ظرفیت اسمی','Nameplate Capacity')}<input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={t('ظرفیت پروژه را وارد کنید','Enter project capacity')}/></label>}
        <label>{t('موقعیت پروژه','Project Location')}<input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('شهر، استان، کشور','City, region, country')}/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">{t('ذخیره پروژه','Save Project')}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>{t('انصراف','Cancel')}</button></div>
    </form>}
    {projects.length > 0 &&       <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpenProject(project) }}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title={t('حذف پروژه','Delete project')} onClick={event => { event.stopPropagation(); if (!confirmBeforeDelete || window.confirm(t('این پروژه حذف شود؟','Delete this project?'))) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.steelStage ? `${en ? (industryNames[project.industry] ?? project.industry) : project.industry} · ${en ? (stageNames[project.steelStage] ?? project.steelStage) : project.steelStage}` : project.projectType ? `${en ? (industryNames[project.industry] ?? project.industry) : project.industry} · ${project.projectType}` : (en ? (industryNames[project.industry] ?? project.industry) : project.industry)}</p><small className="draft-pill">{project.templateId === 'raw' ? t('قالب خام','Blank Template') : t('پروژه قدیمی / بدون قالب','Legacy project / no template')}</small><div className="project-meta"><span>{project.capacity || t('ظرفیت ثبت نشده','Capacity not set')}</span><span>{project.location || t('موقعیت ثبت نشده','Location not set')}</span></div><div className="project-footer"><button type="button" className="draft-pill draft-action" onClick={event => { event.stopPropagation(); onOpenProject(project) }} aria-label={`${t('ادامه تکمیل پیش‌نویس','Continue draft')} ${project.name}`}>{t('ادامه تکمیل پیش‌نویس','Continue draft')} <span aria-hidden="true">←</span></button><small>{t('ایجاد شده در','Created')} {new Date(project.createdAt).toLocaleDateString(en ? 'en-US' : 'fa-IR')}</small></div></article>)}</div>}
  </section>
}
