import { useState } from 'react'
import { Factory, Plus, Trash2, FolderOpen } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'capacity' | 'location' | 'templateId'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
  onOpenProject: (project: FeasibilityProject) => void
  language?: 'fa' | 'en'
}

const INDUSTRY_OPTIONS = [
  { value: 'صنعتی', fa: 'صنعتی', en: 'Industrial' },
  { value: 'معدن', fa: 'معدن', en: 'Mining' },
  { value: 'انرژی و نیروگاه', fa: 'انرژی و نیروگاه', en: 'Energy & Power' },
  { value: 'نفت، گاز و پتروشیمی', fa: 'نفت، گاز و پتروشیمی', en: 'Oil, Gas & Petrochemicals' },
  { value: 'کشاورزی', fa: 'کشاورزی', en: 'Agriculture' },
  { value: 'ساختمان و زیرساخت', fa: 'ساختمان و زیرساخت', en: 'Construction & Infrastructure' },
  { value: 'خدمات', fa: 'خدمات', en: 'Services' },
  { value: 'سایر صنایع', fa: 'سایر صنایع', en: 'Other Industries' },
]

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete, onOpenProject, language = 'fa' }: Props) {
  const en = language === 'en'
  const t = (fa: string, english: string) => en ? english : fa
  const [showForm, setShowForm] = useState(false)
  const [showTemplateChooser, setShowTemplateChooser] = useState(false)
  const templateId = 'raw' as const
  const [name, setName] = useState('')
  const [projectType, setProjectType] = useState('')
  const [industry, setIndustry] = useState('')


  function changeIndustry(value: string) {
    setIndustry(value)
    setName('')
    setProjectType('')
  }


  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const projectName = name.trim()
    if (!projectName) return
    await onCreate({
      name: projectName,
      industry,
      projectType: projectType.trim(),
      capacity: '',
      location: '',
      templateId: 'raw'
    })
    setName(''); setProjectType(''); setShowForm(false); setShowTemplateChooser(false)
  }

  return <section className="projects-page">
    <div className="page-heading"><div><h1>{t('پروژه‌های امکان‌سنجی','Feasibility Projects')}</h1><p>{t('پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.','Manage your projects and investment studies on this device.')}</p></div><div className="projects-head-actions"><button className="primary" onClick={() => setShowForm(v => !v)}><Plus size={17}/> {t('پروژه جدید','New Project')}</button></div></div>
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>{t('تعریف پروژه جدید','Create New Project')} · {t('قالب خام','Blank Template')}</h3>
      <div className="form-grid">
        <label>{t('صنعت / حوزه فعالیت','Industry / Sector')}
          <select required value={industry} onChange={e => changeIndustry(e.target.value)}>
            <option value="" disabled>{t('انتخاب حوزه فعالیت','Select a sector')}</option>
            {INDUSTRY_OPTIONS.map(option => <option key={option.value} value={option.value}>{en ? option.en : option.fa}</option>)}
          </select>
        </label>
        <label>{t('نوع پروژه','Project Type')}<input required value={projectType} onChange={e => setProjectType(e.target.value)} placeholder={t('نوع فعالیت یا پروژه را وارد کنید','Describe the project type')}/></label>
        <label>{t('نام پروژه','Project Name')}<input required value={name} onChange={e => setName(e.target.value)} placeholder={t('نام دلخواه پروژه را وارد کنید','Enter a project name')}/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">{t('ذخیره پروژه','Save Project')}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>{t('انصراف','Cancel')}</button></div>
    </form>}
    {projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={30}/></div><h3>{t('هنوز پروژه‌ای ثبت نشده است','No projects yet')}</h3><p>{t('اولین پروژه امکان‌سنجی خود را ایجاد کنید. اطلاعات فقط روی همین دستگاه ذخیره می‌شود.','Create your first feasibility project. Data is stored on this device only.')}</p><button className="primary" onClick={() => setShowForm(true)}><Plus size={17}/> {t('ایجاد اولین پروژه','Create First Project')}</button></div> :
      <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id} onClick={() => onOpenProject(project)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpenProject(project) }}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title={t('حذف پروژه','Delete project')} onClick={event => { event.stopPropagation(); if (!confirmBeforeDelete || window.confirm(t('این پروژه حذف شود؟','Delete this project?'))) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.industry}{project.projectType ? ` · ${project.projectType}` : ''}</p><small className="draft-pill">{t('قالب خام','Blank Template')}</small><div className="project-meta"><span>{project.capacity || t('ظرفیت ثبت نشده','Capacity not set')}</span><span>{project.location || t('موقعیت ثبت نشده','Location not set')}</span></div><div className="project-footer"><button type="button" className="draft-pill draft-action" onClick={event => { event.stopPropagation(); onOpenProject(project) }} aria-label={`${t('ادامه تکمیل پیش‌نویس','Continue draft')} ${project.name}`}>{t('ادامه تکمیل پیش‌نویس','Continue draft')} <span aria-hidden="true">←</span></button><small>{t('ایجاد شده در','Created')} {new Date(project.createdAt).toLocaleDateString(en ? 'en-US' : 'fa-IR')}</small></div></article>)}</div>}
  </section>
}
