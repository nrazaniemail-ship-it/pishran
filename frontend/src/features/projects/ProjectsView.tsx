import { useState } from 'react'
import { Factory, Plus, Trash2, FolderOpen } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'capacity' | 'location' | 'steelStage'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
  onOpenSample: () => void
  onOpenProject: (project: FeasibilityProject) => void
}

const STEEL_INDUSTRY = 'فولاد و صنایع معدنی'
const CUSTOM_PROJECT = '__custom__'
const STEEL_PROJECT_GROUPS = [
  { stage: 'استخراج سنگ‌آهن', projects: ['احداث معدن سنگ‌آهن', 'توسعه و تجهیز معدن سنگ‌آهن', 'استخراج و دانه‌بندی سنگ‌آهن'] },
  { stage: 'فرآوری و کنسانتره', projects: ['احداث کارخانه کنسانتره سنگ‌آهن', 'توسعه کارخانه کنسانتره', 'بهینه‌سازی خطوط خردایش و پرعیارسازی'] },
  { stage: 'گندله‌سازی', projects: ['احداث کارخانه گندله‌سازی', 'توسعه ظرفیت گندله‌سازی', 'احداث واحد آماده‌سازی و پخت گندله'] },
  { stage: 'احیای مستقیم', projects: ['احداث واحد احیای مستقیم', 'توسعه ظرفیت تولید آهن اسفنجی', 'احداث واحد بریکت‌سازی گرم یا سرد (HBI/CBI)'] },
  { stage: 'فولادسازی و ریخته‌گری', projects: ['احداث کارخانه فولادسازی و ریخته‌گری اسلب', 'احداث واحد تولید بیلت', 'احداث واحد تولید بلوم', 'توسعه فولادسازی و ریخته‌گری مداوم'] },
  { stage: 'نورد گرم / ورق', projects: ['احداث خط تولید ورق تخت (Plate)', 'احداث خط تولید کلاف گرم (Coil)'] },
  { stage: 'نورد گرم / محصولات مستقل', projects: ['احداث خط نورد میلگرد', 'احداث خط نورد تیرآهن', 'احداث خط نورد نبشی'] },
  { stage: 'نورد سرد', projects: ['احداث خط تولید کلاف سرد', 'احداث خط تولید کلاف گالوانیزه', 'احداث خط تولید کلاف رنگی'] },
]

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete, onOpenSample, onOpenProject }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [customName, setCustomName] = useState('')
  const [steelStage, setSteelStage] = useState('')
  const [industry, setIndustry] = useState(STEEL_INDUSTRY)
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const isSteel = industry === STEEL_INDUSTRY
  const isCustom = isSteel && name === CUSTOM_PROJECT

  function changeIndustry(value: string) {
    setIndustry(value)
    setName('')
    setCustomName('')
    setSteelStage('')
  }

  function changeSteelProject(value: string) {
    setName(value)
    const group = STEEL_PROJECT_GROUPS.find(item => item.projects.includes(value))
    setSteelStage(group?.stage ?? '')
    setCustomName('')
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const projectName = isCustom ? customName.trim() : name.trim()
    if (!projectName) return
    await onCreate({
      name: projectName,
      industry,
      ...(isSteel && steelStage ? { steelStage } : {}),
      capacity: capacity.trim(),
      location: location.trim()
    })
    setName(''); setCustomName(''); setSteelStage(''); setCapacity(''); setLocation(''); setShowForm(false)
  }

  return <section className="projects-page">
    <div className="page-heading"><div><span className="eyebrow">PROJECT WORKSPACE</span><h1>پروژه‌های امکان‌سنجی</h1><p>پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.</p></div><div className="projects-head-actions"><button className="secondary-button" onClick={onOpenSample}><Factory size={16}/> مشاهده پروژه نمونه نورد ورق ۲۵۰ هزار تنی</button><button className="primary" onClick={() => setShowForm(v => !v)}><Plus size={17}/> پروژه جدید</button></div></div>
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>تعریف پروژه جدید</h3>
      <div className="form-grid">
        <label>صنعت
          <select value={industry} onChange={e => changeIndustry(e.target.value)}>
            <option>{STEEL_INDUSTRY}</option><option>انرژی و نیروگاه</option><option>نفت، گاز و پتروشیمی</option><option>ساختمان و زیرساخت</option><option>سایر صنایع</option>
          </select>
        </label>
        {isSteel ? <>
          <label>نام پروژه
            <select required value={name} onChange={e => changeSteelProject(e.target.value)}>
              <option value="" disabled>ابتدا نام پروژه را انتخاب کنید</option>
              {STEEL_PROJECT_GROUPS.map(group => <optgroup key={group.stage} label={group.stage}>
                {group.projects.map(projectName => <option key={projectName} value={projectName}>{projectName}</option>)}
              </optgroup>)}
              <option value={CUSTOM_PROJECT}>سایر پروژه‌های فولادی (عنوان دلخواه)</option>
            </select>
          </label>
          {isCustom && <label>عنوان دلخواه پروژه<input required value={customName} onChange={e => setCustomName(e.target.value)} placeholder="عنوان پروژه فولادی را وارد کنید"/></label>}
          {steelStage && <label>مرحله زنجیره فولاد<input value={steelStage} readOnly aria-readonly="true"/></label>}
        </> : <label>نام پروژه<input required value={name} onChange={e => setName(e.target.value)} placeholder="عنوان پروژه را وارد کنید"/></label>}
        <label>ظرفیت اسمی<input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="مثلاً ۵۰۰ هزار تن در سال"/></label>
        <label>موقعیت پروژه<input value={location} onChange={e => setLocation(e.target.value)} placeholder="شهر، استان، کشور"/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">ذخیره پروژه</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>انصراف</button></div>
    </form>}
    {projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={30}/></div><h3>هنوز پروژه‌ای ثبت نشده است</h3><p>اولین پروژه امکان‌سنجی خود را ایجاد کنید. اطلاعات فقط روی همین دستگاه ذخیره می‌شود.</p><button className="primary" onClick={() => setShowForm(true)}><Plus size={17}/> ایجاد اولین پروژه</button></div> :
      <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpenProject(project) }}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title="حذف پروژه" onClick={() => { if (!confirmBeforeDelete || window.confirm('این پروژه حذف شود؟')) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.steelStage ? `${project.industry} · ${project.steelStage}` : project.industry}</p><div className="project-meta"><span>{project.capacity || 'ظرفیت ثبت نشده'}</span><span>{project.location || 'موقعیت ثبت نشده'}</span></div><div className="project-footer"><span className="draft-pill">پیش‌نویس</span><small>ایجاد شده در {new Date(project.createdAt).toLocaleDateString('fa-IR')}</small></div></article>)}</div>}
  </section>
}
