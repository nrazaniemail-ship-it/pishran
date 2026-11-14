import { useState } from 'react'
import { Factory, Plus, Trash2, FolderOpen } from 'lucide-react'
import type { FeasibilityProject } from '../../core/projects/projectRepository'

interface Props {
  projects: FeasibilityProject[]
  onCreate: (input: Pick<FeasibilityProject, 'name' | 'industry' | 'capacity' | 'location'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  confirmBeforeDelete: boolean
}

export default function ProjectsView({ projects, onCreate, onDelete, confirmBeforeDelete }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('فولاد و صنایع معدنی')
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    await onCreate({ name: name.trim(), industry, capacity: capacity.trim(), location: location.trim() })
    setName(''); setCapacity(''); setLocation(''); setShowForm(false)
  }

  return <section className="projects-page">
    <div className="page-heading"><div><span className="eyebrow">PROJECT WORKSPACE</span><h1>پروژه‌های امکان‌سنجی</h1><p>پروژه‌ها و مطالعات سرمایه‌گذاری خود را روی همین دستگاه مدیریت کنید.</p></div><button className="primary" onClick={() => setShowForm(v => !v)}><Plus size={17}/> پروژه جدید</button></div>
    {showForm && <form className="project-form" onSubmit={submit}>
      <h3>تعریف پروژه جدید</h3>
      <div className="form-grid">
        <label>نام پروژه<input required value={name} onChange={e => setName(e.target.value)} placeholder="مثلاً احداث خط نورد گرم"/></label>
        <label>صنعت<select value={industry} onChange={e => setIndustry(e.target.value)}><option>فولاد و صنایع معدنی</option><option>انرژی و نیروگاه</option><option>نفت، گاز و پتروشیمی</option><option>ساختمان و زیرساخت</option><option>سایر صنایع</option></select></label>
        <label>ظرفیت اسمی<input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="مثلاً ۵۰۰ هزار تن در سال"/></label>
        <label>موقعیت پروژه<input value={location} onChange={e => setLocation(e.target.value)} placeholder="شهر، استان، کشور"/></label>
      </div>
      <div className="form-actions"><button type="submit" className="primary">ذخیره پروژه</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>انصراف</button></div>
    </form>}
    {projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><FolderOpen size={30}/></div><h3>هنوز پروژه‌ای ثبت نشده است</h3><p>اولین پروژه امکان‌سنجی خود را ایجاد کنید. اطلاعات فقط روی همین دستگاه ذخیره می‌شود.</p><button className="primary" onClick={() => setShowForm(true)}><Plus size={17}/> ایجاد اولین پروژه</button></div> :
      <div className="project-grid">{projects.map(project => <article className="project-card" key={project.id}><div className="project-card-top"><div className="module-icon"><Factory size={21}/></div><button className="icon-button" title="حذف پروژه" onClick={() => { if (!confirmBeforeDelete || window.confirm('این پروژه حذف شود؟')) void onDelete(project.id) }}><Trash2 size={17}/></button></div><h3>{project.name}</h3><p>{project.industry}</p><div className="project-meta"><span>{project.capacity || 'ظرفیت ثبت نشده'}</span><span>{project.location || 'موقعیت ثبت نشده'}</span></div><div className="project-footer"><span className="draft-pill">پیش‌نویس</span><small>ایجاد شده در {new Date(project.createdAt).toLocaleDateString('fa-IR')}</small></div></article>)}</div>}
  </section>
}
