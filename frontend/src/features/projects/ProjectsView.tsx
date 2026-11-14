import { useState } from 'react'
import { Factory, Plus, Trash2, FolderOpen, FileText } from 'lucide-react'
import type { FeasibilityProject, ProjectTemplateId } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'capacity' | 'location' | 'steelStage' | 'templateId'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
  onOpenProject: (project: FeasibilityProject) => void
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

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete, onOpenProject }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [showTemplateChooser, setShowTemplateChooser] = useState(false)
  const [templateId, setTemplateId] = useState<ProjectTemplateId>('raw')
  const [name, setName] = useState('')
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
      setName('نورد ورق گرم- تولید کلاف')
      setSteelStage('نورد گرم ورق - تولید کلاف')
      setCapacity('200000')
      setLocation('کاشان، ایران')
    } else {
      setName('')
      setSteelStage('')
      setCapacity('')
      setLocation('')
    }
  }

  function changeIndustry(value: string) {
    setIndustry(value)
    setName('')
    setSteelStage('')
  }

  function changeSteelProject(value: string) {
    setName(value)
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
    setName(''); setSteelStage(''); setCapacity(''); setLocation(''); setShowForm(false); setShowTemplateChooser(false); setTemplateId('raw')
  }

  return <section className="projects-page">
    <div className="page-heading"><div><span className="eyebrow">PROJECT WORKSPACE</span><h1>پروژه‌های امکان‌سنجی</h1><p>پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.</p></div><div className="projects-head-actions"><button className="primary" onClick={() => { setShowForm(false); setShowTemplateChooser(v => !v) }}><Plus size={17}/> پروژه جدید</button></div></div>
    {showTemplateChooser && <section className="project-form template-chooser" aria-label="انتخاب قالب پروژه"><h3>قالب پروژه جدید را انتخاب کنید</h3><p>می‌خواهید از یک پروژه خالی شروع کنید یا اطلاعات مرجع نورد ورق گرم بارگذاری شود؟</p><div className="project-grid"><article className="project-card"><div className="module-icon"><FileText size={21}/></div><h3>تمپلت خام</h3><p>ساختار استاندارد و خالی؛ بدون فرض‌ها و داده‌های اختصاصی پروژه نورد گرم</p><button type="button" className="secondary-button" onClick={() => chooseTemplate('raw')}>انتخاب تمپلت خام</button></article><article className="project-card"><div className="module-icon"><Factory size={21}/></div><h3>تمپلیت پروژه نورد ورق گرم</h3><p>بارگذاری داده‌های مرجع HRCR200 با ظرفیت ۲۰۰ هزار تن در سال و امکان ویرایش همه مفروضات</p><button type="button" className="primary" onClick={() => chooseTemplate('hot-rolling-200kt')}>انتخاب تمپلیت نورد ورق گرم</button></article></div><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setShowTemplateChooser(false)}>انصراف</button></div></section>}
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>تعریف پروژه جدید · {templateId === 'raw' ? 'تمپلت خام' : 'تمپلیت پروژه نورد ورق گرم'}</h3>
      <div className="form-grid">
        <label>صنعت
          <select value={industry} disabled={templateId === 'hot-rolling-200kt'} onChange={e => changeIndustry(e.target.value)}>
            <option>{STEEL_INDUSTRY}</option><option>انرژی و نیروگاه</option><option>نفت، گاز و پتروشیمی</option><option>ساختمان و زیرساخت</option><option>سایر صنایع</option>
          </select>
        </label>
        {isSteel ? <>
          <label>نوع پروژه
            <select required value={name} disabled={templateId === 'hot-rolling-200kt'} onChange={e => changeSteelProject(e.target.value)}>
              <option value="" disabled>ابتدا نوع پروژه را انتخاب کنید</option>
              {STEEL_PROJECT_OPTIONS.map(option => <option key={option.name} value={option.name}>{option.name}</option>)}
            </select>
          </label>
          
          {steelStage && <label>مرحله زنجیره فولاد<input value={steelStage} readOnly aria-readonly="true"/></label>}
        </> : <label>نوع پروژه<input required value={name} onChange={e => setName(e.target.value)} placeholder="نوع پروژه را وارد کنید"/></label>}
        {isSteel ? <label>ظرفیت اسمی (تن در سال)<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder="مثلاً ۵۰۰۰۰۰"/></label> : isEnergy ? <label>ظرفیت اسمی (مگاوات)<input type="text" inputMode="numeric" pattern="[0-9]*" value={capacity} onChange={e => setCapacity(e.target.value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^0-9]/g, ''))} placeholder="مثلاً ۵۰۰"/></label> : <label>ظرفیت اسمی<input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="ظرفیت پروژه را وارد کنید"/></label>}
        <label>موقعیت پروژه<input value={location} onChange={e => setLocation(e.target.value)} placeholder="شهر، استان، کشور"/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">ذخیره پروژه</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>انصراف</button></div>
    </form>}
    {projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={30}/></div><h3>هنوز پروژه‌ای ثبت نشده است</h3><p>اولین پروژه امکان‌سنجی خود را ایجاد کنید. اطلاعات فقط روی همین دستگاه ذخیره می‌شود.</p><button className="primary" onClick={() => setShowTemplateChooser(true)}><Plus size={17}/> ایجاد اولین پروژه</button></div> :
      <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpenProject(project) }}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title="حذف پروژه" onClick={event => { event.stopPropagation(); if (!confirmBeforeDelete || window.confirm('این پروژه حذف شود؟')) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.steelStage ? `${project.industry} · ${project.steelStage}` : project.industry}</p><small className="draft-pill">{project.templateId === 'raw' ? 'تمپلت خام' : project.templateId === 'hot-rolling-200kt' ? 'تمپلیت پروژه نورد ورق گرم' : 'پروژه قدیمی / بدون قالب'}</small><div className="project-meta"><span>{project.capacity || 'ظرفیت ثبت نشده'}</span><span>{project.location || 'موقعیت ثبت نشده'}</span></div><div className="project-footer"><button type="button" className="draft-pill draft-action" onClick={event => { event.stopPropagation(); onOpenProject(project) }} aria-label={`ادامه تکمیل پیش‌نویس ${project.name}`}>ادامه تکمیل پیش‌نویس <span aria-hidden="true">←</span></button><small>ایجاد شده در {new Date(project.createdAt).toLocaleDateString('fa-IR')}</small></div></article>)}</div>}
  </section>
}
