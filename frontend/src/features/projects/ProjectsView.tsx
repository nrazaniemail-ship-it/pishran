import { useState } from 'react'
import { Factory, Plus, Trash2, FolderOpen, FileText } from 'lucide-react'
import type { FeasibilityProject, ProjectTemplateId } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'capacity' | 'location' | 'steelStage' | 'templateId'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
  onOpenProject: (project: FeasibilityProject) => void
  language?: 'fa' | 'en'
}

const STEEL_INDUSTRY = 'فولاد و صنایع معدنی'
const STEEL_PROJECT_OPTIONS = [
  { name: 'معدن سنگ آهن', stage: 'استخراج سنگ‌آهن' },
  { name: 'کنستانتره', stage: 'فرآوری و کنسانتره' },
  { name: 'گندله سازی', stage: 'گندله‌سازی' },
  { name: 'احیاء', stage: 'احیای مستقیم' },
  { name: 'ذوب و ریخته گری', stage: 'فولادسازی و ریخته‌گری' },
  { name: 'احیاء و فولادسازی- تولید اسلب', stage: 'مجتمع احیاء و فولادسازی - تولید اسلب' },
  { name: 'نورد ورق گرم- تولید پلیت', stage: 'نورد گرم ورق - تولید پلیت' },
  { name: 'نورد ورق گرم- تولید کلاف', stage: 'نورد گرم ورق - تولید کلاف' },
  { name: 'نورد سرد ورق', stage: 'نورد سرد و پوشش‌دهی' },
  { name: 'نورد میلگرد', stage: 'نورد میلگرد' },
  { name: 'نورد نبشی', stage: 'نورد نبشی' },
  { name: 'نورد تیرآهن', stage: 'نورد تیرآهن' },
  { name: 'سایر', stage: 'سایر' },
]

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete, onOpenProject, language = 'fa' }: Props) {
  const en = language === 'en'
  const t = (fa: string, english: string) => en ? english : fa
  const projectNames: Record<string, string> = { 'معدن سنگ آهن':'Iron Ore Mining', 'کنستانتره':'Iron Ore Concentration', 'گندله سازی':'Pelletizing', 'احیاء':'Direct Reduction', 'ذوب و ریخته گری':'Steelmaking & Casting', 'احیاء و فولادسازی- تولید اسلب':'DRI & Steelmaking – Slab', 'نورد ورق گرم- تولید پلیت':'Hot-Rolled Plate', 'نورد ورق گرم- تولید کلاف':'Hot-Rolled Coil', 'نورد سرد ورق':'Cold Rolling', 'نورد میلگرد':'Rebar Rolling', 'نورد نبشی':'Angle Rolling', 'نورد تیرآهن':'Beam Rolling', 'سایر':'Other' }
  const industryNames: Record<string,string> = { [STEEL_INDUSTRY]:'Steel & Mining', 'انرژی و نیروگاه':'Energy & Power', 'نفت، گاز و پتروشیمی':'Oil, Gas & Petrochemicals', 'ساختمان و زیرساخت':'Construction & Infrastructure', 'سایر صنایع':'Other Industries' }
  const stageNames: Record<string,string> = { 'استخراج سنگ‌آهن':'Iron Ore Mining', 'فرآوری و کنسانتره':'Processing & Concentration', 'گندله‌سازی':'Pelletizing', 'احیای مستقیم':'Direct Reduction', 'فولادسازی و ریخته‌گری':'Steelmaking & Casting', 'مجتمع احیاء و فولادسازی - تولید اسلب':'DRI & Steelmaking – Slab', 'نورد گرم ورق - تولید پلیت':'Hot-Rolled Plate', 'نورد گرم ورق - تولید کلاف':'Hot-Rolled Coil', 'نورد سرد و پوشش‌دهی':'Cold Rolling & Coating', 'نورد میلگرد':'Rebar Rolling', 'نورد نبشی':'Angle Rolling', 'نورد تیرآهن':'Beam Rolling', 'سایر':'Other' }
  const [showForm, setShowForm] = useState(false)
  const [showTemplateChooser, setShowTemplateChooser] = useState(false)
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('raw')
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('')
  const [steelStage, setSteelStage] = useState('')
  const [industry, setIndustry] = useState(STEEL_INDUSTRY)
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const isSteel = industry === STEEL_INDUSTRY
  const isEnergy = industry === 'انرژی و نیروگاه'

  function chooseTemplate(value: ProjectTemplateId) {
    setTemplateId(value)
    setShowTemplateChooser(false)
    setShowForm(true)
    setIndustry(STEEL_INDUSTRY)
    if (value === 'hot-rolling-200kt') {
      setProjectType('نورد ورق گرم- تولید کلاف')
      setName('نورد ورق گرم- تولید کلاف')
      setSteelStage('نورد گرم ورق - تولید کلاف')
      setCapacity('200000')
      setLocation('کاشان، ایران')
    } else {
      setName('')
      setProjectType('')
      setSteelStage('')
      setCapacity('')
      setLocation('')
    }
  }

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
      ...(isSteel && steelStage ? { steelStage } : {}),
      capacity: capacity.trim(),
      location: location.trim(),
      templateId
    })
    setName(''); setProjectType(''); setSteelStage(''); setCapacity(''); setLocation(''); setShowForm(false); setShowTemplateChooser(false); setTemplateId('raw')
  }

  return <section className="projects-page">
    <div className="page-heading"><div><span className="eyebrow">{t('PROJECT WORKSPACE','PROJECT WORKSPACE')}</span><h1>{t('پروژه‌های امکان‌سنجی','Feasibility Projects')}</h1><p>{t('پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.','Manage your projects and investment studies on this device.')}</p></div><div className="projects-head-actions"><button className="primary" onClick={() => { setShowForm(false); setShowTemplateChooser(v => !v) }}><Plus size={17}/> {t('پروژه جدید','New Project')}</button></div></div>
    {showTemplateChooser && <section className="project-form template-chooser" aria-label="{t('انتخاب قالب پروژه','Choose a project template')}"><h3>قالب {t('پروژه جدید','New Project')} را انتخاب کنید</h3><p>{t('می‌خواهید از یک پروژه خالی شروع کنید یا اطلاعات مرجع نورد ورق گرم بارگذاری شود؟','Start with a blank project or load the hot-rolling reference data?')}</p><div className="project-grid"><article className="project-card"><div className="module-icon"><FileText size={21}/></div><h3>{t('تمپلت خام','Blank Template')}</h3><p>{t('ساختار استاندارد و خالی؛ بدون فرض‌ها و داده‌های اختصاصی پروژه نورد گرم','A clean standard structure without hot-rolling-specific assumptions or data')}</p><button type="button" className="secondary-button" onClick={() => chooseTemplate('raw')}>انتخاب {t('تمپلت خام','Blank Template')}</button></article><article className="project-card"><div className="module-icon"><Factory size={21}/></div><h3>{t('تمپلیت پروژه نورد ورق گرم','Hot-Rolling Project Template')}</h3><p>{t('بارگذاری داده‌های مرجع HRCR200 با ظرفیت ۲۰۰ هزار تن در سال و امکان ویرایش همه مفروضات','Load HRCR200 reference data at 200,000 tonnes per year; all assumptions remain editable')}</p><button type="button" className="primary" onClick={() => chooseTemplate('hot-rolling-200kt')}>{t('انتخاب تمپلیت نورد ورق گرم','Use Hot-Rolling Template')}</button></article></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowTemplateChooser(false)}>{t('انصراف','Cancel')}</button></div></section>}
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>تعریف {t('پروژه جدید','New Project')} · {templateId === 'raw' ? '{t('تمپلت خام','Blank Template')}' : '{t('تمپلیت پروژه نورد ورق گرم','Hot-Rolling Project Template')}'}</h3>
      <div className="form-grid">
        <label>{t('صنعت','Industry')}
          <select value={industry} disabled={templateId === 'hot-rolling-200kt'} onChange={e => changeIndustry(e.target.value)}>
            {Object.entries(industryNames).map(([value,label]) => <option key={value} value={value}>{en ? label : value}</option>)}
          </select>
        </label>
        {isSteel ? <>
          <label>{t('نوع پروژه','Project Type')}
            <select required value={projectType} disabled={templateId === 'hot-rolling-200kt'} onChange={e => changeSteelProject(e.target.value)}>
              <option value="" disabled>ابتدا {t('نوع پروژه','Project Type')} را انتخاب کنید</option>
              {STEEL_PROJECT_OPTIONS.map(option => <option key={option.name} value={option.name}>{en ? (projectNames[option.name] ?? option.name) : option.name}</option>)}
            </select>
          </label>
          
          {steelStage && <label>{t('نام پروژه','Project Name')}<input required value={name} onChange={e => setName(e.target.value)} placeholder="{t('نام دلخواه پروژه را وارد کنید','Enter a project name')}"/></label>}
        </> : <label>{t('نوع پروژه','Project Type')}<input required value={name} onChange={e => setName(e.target.value)} placeholder="{t('نوع پروژه','Project Type')} را وارد کنید"/></label>}
        {isSteel ? <label>{t('${t('ظرفیت اسمی','Nameplate Capacity')} (تن در سال)','Nameplate Capacity (tonnes/year)')}<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder="{t('${t('مثلاً ۵۰۰','e.g. 500')}۰۰۰','e.g. 500000')}"/></label> : isEnergy ? <label>{t('${t('ظرفیت اسمی','Nameplate Capacity')} (مگاوات)','Nameplate Capacity (MW)')}<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder="{t('مثلاً ۵۰۰','e.g. 500')}"/></label> : <label>{t('ظرفیت اسمی','Nameplate Capacity')}<input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="{t('ظرفیت پروژه را وارد کنید','Enter project capacity')}"/></label>}
        <label>{t('موقعیت پروژه','Project Location')}<input value={location} onChange={e => setLocation(e.target.value)} placeholder="{t('شهر، استان، کشور','City, region, country')}"/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">{t('ذخیره پروژه','Save Project')}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>{t('انصراف','Cancel')}</button></div>
    </form>}
    {projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={30}/></div><h3>{t('هنوز پروژه‌ای ثبت نشده است','No projects yet')}</h3><p>{t('اولین پروژه امکان‌سنجی خود را ایجاد کنید. اطلاعات فقط روی همین دستگاه ذخیره می‌شود.','Create your first feasibility project. Data is stored on this device only.')}</p><button className="primary" onClick={() => setShowTemplateChooser(true)}><Plus size={17}/> {t('ایجاد اولین پروژه','Create First Project')}</button></div> :
      <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpenProject(project) }}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title="{t('حذف پروژه','Delete project')}" onClick={event => { event.stopPropagation(); if (!confirmBeforeDelete || window.confirm('{t('این پروژه حذف شود؟','Delete this project?')}')) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.steelStage ? `${project.industry} · ${project.steelStage}` : (en ? (industryNames[project.industry] ?? project.industry) : project.industry)}</p><small className="draft-pill">{project.templateId === 'raw' ? '{t('تمپلت خام','Blank Template')}' : project.templateId === 'hot-rolling-200kt' ? '{t('تمپلیت پروژه نورد ورق گرم','Hot-Rolling Project Template')}' : '{t('پروژه قدیمی / بدون قالب','Legacy project / no template')}'}</small><div className="project-meta"><span>{project.capacity || '{t('ظرفیت ثبت نشده','Capacity not set')}'}</span><span>{project.location || '{t('موقعیت ثبت نشده','Location not set')}'}</span></div><div className="project-footer"><button type="button" className="draft-pill draft-action" onClick={event => { event.stopPropagation(); onOpenProject(project) }} aria-label={`{t('ادامه تکمیل پیش‌نویس','Continue draft')} ${project.name}`}>{t('ادامه تکمیل پیش‌نویس','Continue draft')} <span aria-hidden="true">←</span></button><small>{t('ایجاد شده در','Created')} {new Date(project.createdAt).toLocaleDateString(en ? 'en-US' : 'fa-IR')}</small></div></article>)}</div>}
  </section>
}
