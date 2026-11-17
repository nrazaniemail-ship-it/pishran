import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Layers3, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen, Calculator, X } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, removeSampleProjects, listProjects, updateProject, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import RollingWorkspace from './features/steel/RollingWorkspace'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import FeasibilityWizard from './features/projects/FeasibilityWizard'
import ProcessPlantWorkspace from './features/steel/ProcessPlantWorkspace'
import IntegratedSteelComplexWorkspace from './features/steel/IntegratedSteelComplexWorkspace'
import Guide from './features/guide/Guide'
import BackupScheduler from './features/settings/BackupScheduler'

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'hot-rolling' | 'project-wizard' | 'split-integrated' | 'integrated-plant' | 'process-plant' | 'guide'

const modules = [
  { icon: Factory, title: 'مهندسی و طراحی فرآیند', enTitle: 'Process Engineering & Design', sub: 'ظرفیت، توازن مواد، انرژی و تجهیزات', enSub: 'Capacity, material balance, energy and equipment', status: 'در نقشه راه', enStatus: 'Roadmap' },
  { icon: Globe2, title: 'هوشمندی بازار', enTitle: 'Market Intelligence', sub: 'عرضه، تقاضا، قیمت و رقبا', enSub: 'Supply, demand, pricing and competitors', status: 'در نقشه راه', enStatus: 'Roadmap' },
  { icon: TrendingUp, title: 'مدل مالی و اقتصادی', enTitle: 'Financial & Economic Model', sub: 'NPV، IRR، جریان نقدی و تأمین مالی', enSub: 'NPV, IRR, cash flow and financing', status: 'نمونه اولیه', enStatus: 'Prototype' },
  { icon: Activity, title: 'ریسک و سناریو', enTitle: 'Risk & Scenarios', sub: 'حساسیت، سناریو و مونت‌کارلو', enSub: 'Sensitivity, scenarios and Monte Carlo', status: 'در نقشه راه', enStatus: 'Roadmap' },
  { icon: Bot, title: 'دستیار هوش مصنوعی', enTitle: 'AI Assistant', sub: 'تحلیل مستند و پاسخ‌گویی به سرمایه‌گذار', enSub: 'Evidence-based analysis for investors', status: 'در نقشه راه', enStatus: 'Roadmap' },
  { icon: FileChartColumn, title: 'گزارش سرمایه‌گذاری', enTitle: 'Investment Reports', sub: 'گزارش مدیریتی، بانکی و سرمایه‌گذار', enSub: 'Management, banking and investor reports', status: 'در نقشه راه', enStatus: 'Roadmap' },
]


function calculateExpression(expression: string): number {
  const tokens = expression.replace(/×/g, '*').replace(/÷/g, '/').match(/(?:\d+\.?\d*|\.\d+)|[()+\-*/%]/g) ?? []
  let index = 0
  const parsePrimary = (): number => {
    const token = tokens[index++]
    if (token === '(') {
      const value = parseSum()
      if (tokens[index++] !== ')') throw new Error('پرانتز نامعتبر')
      return value
    }
    if (token === '-') return -parsePrimary()
    if (token === '+') return parsePrimary()
    const value = Number(token)
    if (!Number.isFinite(value)) throw new Error('عبارت نامعتبر')
    return value
  }
  const parseProduct = (): number => {
    let value = parsePrimary()
    while (tokens[index] === '*' || tokens[index] === '/' || tokens[index] === '%') {
      const op = tokens[index++]
      const next = parsePrimary()
      if ((op === '/' || op === '%') && next === 0) throw new Error('تقسیم بر صفر')
      value = op === '*' ? value * next : op === '/' ? value / next : value % next
    }
    return value
  }
  const parseSum = (): number => {
    let value = parseProduct()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++]
      const next = parseProduct()
      value = op === '+' ? value + next : value - next
    }
    return value
  }
  if (!tokens.length) return 0
  const result = parseSum()
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('عبارت نامعتبر')
  return result
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [activePlantType, setActivePlantType] = useState<'dri'|'steelmaking'>('dri')
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calculatorExpression, setCalculatorExpression] = useState('')
  const [calculatorError, setCalculatorError] = useState('')
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [commandSelection, setCommandSelection] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [treeQuery, setTreeQuery] = useState('')
  const [treeStatusFilter, setTreeStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [treeSort, setTreeSort] = useState<'manual' | 'name-asc' | 'name-desc'>('manual')
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [contextProjectId, setContextProjectId] = useState<string | null>(null)
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))
  const modern = settings.uiMode === 'modern'
  const navigation = [
    { id: 'dashboard' as Page, label: isEn ? 'Overview' : 'نمای کلی', icon: LayoutDashboard },
    { id: 'projects' as Page, label: isEn ? 'Projects' : 'پروژه‌ها', icon: FolderKanban },
    { id: 'steel-group' as Page, label: isEn ? 'Steel value chain' : 'زنجیره فولاد', icon: Factory },
    { id: 'guide' as Page, label: isEn ? 'Knowledge base' : 'راهنما', icon: BookOpen },
    { id: 'settings' as Page, label: isEn ? 'Settings' : 'تنظیمات', icon: Settings },
  ]
  useEffect(() => {
    if (!modern) return
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(value => !value)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modern])

  useEffect(() => {
    let alive = true
    Promise.all([localStore.remove('sample:plate-250k:v1'), localStore.remove('rolling:sample:v2')])
      .then(() => Promise.all([loadSettings(), removeSampleProjects(), localStore.info()]))
      .then(async ([nextSettings, nextProjects, info]) => {
        if (!alive) return
        setSettings(nextSettings)
        applySettings(nextSettings)
        const savedProjectOrder = await localStore.get<string[]>('ui:modern-project-order')
        const orderedProjects = Array.isArray(savedProjectOrder) && savedProjectOrder.length
          ? [...nextProjects].sort((left, right) => {
              const leftIndex = savedProjectOrder.indexOf(left.id)
              const rightIndex = savedProjectOrder.indexOf(right.id)
              if (leftIndex < 0 && rightIndex < 0) return 0
              if (leftIndex < 0) return 1
              if (rightIndex < 0) return -1
              return leftIndex - rightIndex
            })
          : nextProjects
        setProjects(orderedProjects)
        setStorageInfo(info)
        setReady(true)
      }).catch(error => { if (alive) { setLoadError(error instanceof Error ? error.message : 'خطا در بارگذاری داده‌ها'); setReady(true) } })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!ready) return
    void localStore.set('ui:modern-project-order', projects.map(project => project.id))
  }, [projects, ready])

  useEffect(() => {
    document.documentElement.lang = settings.language
    document.documentElement.dir = settings.language === 'en' ? 'ltr' : 'rtl'
  }, [settings.language])

  useEffect(() => {
    if (!ready) return
    applySettings(settings)
    void saveSettings(settings)
  }, [settings, ready])

  const chart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 24, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: isEn ? ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'] : ['سال ۱', 'سال ۲', 'سال ۳', 'سال ۴', 'سال ۵'], axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf0f4' } } },
    series: [{ name: isEn ? 'Illustrative return' : 'بازده نمونه', type: 'line', smooth: true, data: [8, 12, 16, 19, 23], areaStyle: { opacity: .08 }, lineStyle: { width: 3 }, symbolSize: 8 }]
  }), [isEn])

  const normalizedCommandQuery = commandQuery.trim().toLocaleLowerCase()
  const commandItems = [
    ...navigation.filter(item => !normalizedCommandQuery || item.label.toLocaleLowerCase().includes(normalizedCommandQuery) || item.id.includes(normalizedCommandQuery)).map(item => ({ key: `page:${item.id}`, label: item.label, icon: item.icon, run: () => setPage(item.id) })),
    ...projects.filter(project => !normalizedCommandQuery || project.name.toLocaleLowerCase().includes(normalizedCommandQuery)).slice(0, 6).map(project => ({ key: `project:${project.id}`, label: project.name, icon: FolderKanban, run: () => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard') } })),
    { key: 'create-project', label: isEn ? 'Create or open a project' : 'ایجاد یا بازکردن پروژه', icon: Plus, run: () => setPage('projects') }
  ]

  useEffect(() => { setCommandSelection(0) }, [commandQuery, commandOpen])

  async function refreshStorage() {
    try {
      setStorageInfo(await localStore.info())
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (isEn ? 'Unable to inspect local storage' : 'بررسی فضای ذخیره‌سازی ناموفق بود'))
    }
  }

  async function handleCreateProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'projectType' | 'capacity' | 'location' | 'templateId'>) {
    const created = await createProject(input)
    setProjects(current => [created, ...current])
    await refreshStorage()
  }

  async function handleUpdateProject(id: string, patch: Partial<Pick<FeasibilityProject, 'name' | 'location'>>) {
    const updated = await updateProject(id, patch)
    setProjects(await listProjects())
    setActiveProject(current => current?.id === id ? updated : current)
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id)
    setProjects(await listProjects())
    await refreshStorage()
  }

  async function refreshAfterRestore() {
    setSettings(await loadSettings())
    setProjects(await listProjects())
    await refreshStorage()
  }

  return <main className={`app-shell app-page-${page} ${modern ? 'ui-modern' : 'ui-simple'} ${focusMode ? 'focus-mode' : ''}`} dir={isEn?"ltr":"rtl"}>
    <BackupScheduler/>
    {modern && <aside className="modern-sidebar">
      <div className="modern-brand"><span className="modern-brand-mark">P</span><div><b>{isEn ? 'Pishran' : 'پیشران'}</b><small>{isEn ? 'PROJECT INTELLIGENCE' : 'مدیریت هوشمند پروژه'}</small></div></div>
      <button className="modern-search" type="button" onClick={() => setCommandOpen(true)}><span>⌕ {isEn ? 'Search commands...' : 'جستجو در پیشران...'}</span><kbd>Ctrl K</kbd></button>
      <div className="modern-side-label">{isEn ? 'WORKSPACE' : 'فضای کاری'}</div>
      <nav className="modern-side-nav">{navigation.map(item => <button key={item.id} className={page === item.id || (item.id === 'steel-group' && page === 'hot-rolling') ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon size={17}/><span>{item.label}</span></button>)}</nav>
      <div className="modern-side-label">{isEn ? 'PROJECT BROWSER' : 'مرورگر پروژه‌ها'}</div>
      <div className="modern-project-tree"><div className="tree-root"><FolderKanban size={15}/><b>{isEn ? 'My projects' : 'پروژه‌های من'}</b><span>{projects.length}</span></div>
        <input className="tree-search-input" value={treeQuery} onChange={event => setTreeQuery(event.target.value)} placeholder={isEn ? 'Filter projects...' : 'جستجوی پروژه‌ها...'} aria-label={isEn ? 'Filter projects' : 'جستجوی پروژه‌ها'}/>
        <select className="tree-status-filter" value={treeStatusFilter} onChange={event => setTreeStatusFilter(event.target.value as typeof treeStatusFilter)} aria-label={isEn ? 'Filter project status' : 'فیلتر وضعیت پروژه'}>
          <option value="all">{isEn ? 'All statuses' : 'همه وضعیت‌ها'}</option>
          <option value="draft">{isEn ? 'Draft' : 'پیش‌نویس'}</option>
          <option value="active">{isEn ? 'Active' : 'فعال'}</option>
          <option value="archived">{isEn ? 'Archived' : 'بایگانی‌شده'}</option>
        </select>
        <select className="tree-status-filter tree-sort-filter" value={treeSort} onChange={event => setTreeSort(event.target.value as typeof treeSort)} aria-label={isEn ? 'Sort projects' : 'مرتب‌سازی پروژه‌ها'}>
          <option value="manual">{isEn ? 'Custom order' : 'ترتیب دستی'}</option>
          <option value="name-asc">{isEn ? 'Name: A to Z' : 'نام: الف تا ی'}</option>
          <option value="name-desc">{isEn ? 'Name: Z to A' : 'نام: ی تا الف'}</option>
        </select>
        {[...projects].filter(project => project.name.toLocaleLowerCase().includes(treeQuery.trim().toLocaleLowerCase()) && (treeStatusFilter === 'all' || project.status === treeStatusFilter)).sort((a,b) => treeSort === 'manual' ? 0 : treeSort === 'name-asc' ? a.name.localeCompare(b.name, isEn ? 'en' : 'fa') : b.name.localeCompare(a.name, isEn ? 'en' : 'fa')).slice(0, 30).map(project => <div key={project.id} className="tree-project-wrap" draggable={treeSort === 'manual'} tabIndex={0} role="listitem" aria-label={isEn ? `Project ${project.name}. Use Alt plus arrow keys to reorder.` : `پروژه ${project.name}. برای جابه‌جایی از کلیدهای Alt و جهت‌نما استفاده کنید.`} onKeyDown={event => { if (treeSort !== 'manual' || !event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return; event.preventDefault(); setProjects(current => { const next=[...current]; const index=next.findIndex(item=>item.id===project.id); const target=index+(event.key==='ArrowUp'?-1:1); if(index<0||target<0||target>=next.length)return current; [next[index],next[target]]=[next[target],next[index]]; return next }) }} onDragStart={() => setDraggedProjectId(project.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (treeSort !== 'manual' || !draggedProjectId || draggedProjectId === project.id) return; setProjects(current => { const next=[...current]; const from=next.findIndex(item=>item.id===draggedProjectId); const to=next.findIndex(item=>item.id===project.id); if(from<0||to<0)return current; const [moved]=next.splice(from,1); next.splice(to,0,moved); return next }); setDraggedProjectId(null) }} onDragEnd={() => setDraggedProjectId(null)}>
          <button className={activeProject?.id === project.id ? 'selected' : ''} onContextMenu={event => { event.preventDefault(); setContextProjectId(contextProjectId === project.id ? null : project.id) }} onClick={() => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard'); setContextProjectId(null) }}><span className={`tree-status status-${project.status}`} title={isEn ? project.status : project.status === 'draft' ? 'پیش‌نویس' : project.status === 'active' ? 'فعال' : 'بایگانی‌شده'} aria-hidden="true"/><span>{project.name}</span><span className="tree-grip">⠿</span></button>
          {contextProjectId === project.id && <div className="tree-context-menu"><button onClick={() => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard'); setContextProjectId(null) }}>{isEn ? 'Open project' : 'بازکردن پروژه'}</button><button onClick={() => { setPage('projects'); setContextProjectId(null) }}>{isEn ? 'Project list' : 'فهرست پروژه‌ها'}</button></div>}
        </div>)}
        {projects.length === 0 && <small className="tree-empty">{isEn ? 'No projects yet' : 'هنوز پروژه‌ای ثبت نشده است'}</small>}
        {projects.length > 0 && !projects.some(project => project.name.toLocaleLowerCase().includes(treeQuery.trim().toLocaleLowerCase()) && (treeStatusFilter === 'all' || project.status === treeStatusFilter)) && <small className="tree-empty">{isEn ? 'No matching projects' : 'پروژه‌ای یافت نشد'}</small>}
      </div>
      <div className="modern-sidebar-bottom"><button onClick={() => setFocusMode(value => !value)}><Layers3 size={16}/>{focusMode ? (isEn ? 'Exit focus mode' : 'خروج از حالت تمرکز') : (isEn ? 'Focus mode' : 'حالت تمرکز')}</button><button onClick={() => setInspectorOpen(value => !value)}><ShieldCheck size={16}/>{isEn ? 'Context panel' : 'پنل جزئیات'}</button></div>
    </aside>}
    <header className="topbar">
      <button className="language-switch page-language-switch" type="button" onClick={toggleLanguage} aria-label={isEn ? "Switch to Persian" : "Switch to English"}>{isEn ? "FA" : "EN"}</button>
      <div className="brand"><button className="brand-title" type="button" onClick={() => setPage('dashboard')}><b>{isEn ? "Pishran" : "پیشران"}</b></button></div>
      <nav className="main-nav" aria-label={isEn?"Primary navigation":"ناوبری اصلی"}>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}><LayoutDashboard size={17}/> {isEn ? "Dashboard" : "داشبورد"}</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('projects')}><FolderKanban size={17}/> {isEn ? "Projects" : "پروژه‌ها"}</button>
        <button className={page === 'steel-group' || page === 'hot-rolling' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('steel-group')}><Factory size={17}/> {isEn ? "Steel Group" : "گروه فولاد"}</button>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('guide')}><BookOpen size={17}/> {isEn ? "Guide" : "راهنما"}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings size={17}/> {isEn ? "Settings" : "تنظیمات"}</button>
      </nav>
      <div className="top-actions">{modern && <><button className="modern-header-action" onClick={() => setCommandOpen(true)}>{isEn ? 'Quick actions' : 'دستورات سریع'} <kbd>Ctrl K</kbd></button><button className="modern-header-action" onClick={() => setPage('projects')}>{isEn ? 'New project' : 'پروژه جدید'} <Plus size={15}/></button><button className="modern-header-avatar">P</button></>}</div>
    </header>
    {modern && <div className="modern-workspace-heading"><div><small>{isEn ? 'WORKSPACE' : 'فضای کاری'}</small><h1>{activeProject?.name ?? (isEn ? 'Investment workspace' : 'فضای کاری ارزیابی سرمایه‌گذاری')}</h1></div><div className="modern-live-status"><span/> <span className={loadError ? 'status-warning' : ''}/>{loadError ? (isEn ? 'Data needs attention' : 'نیازمند بررسی داده‌ها') : (isEn ? 'Local data ready' : 'داده‌های محلی آماده‌اند')} <button onClick={() => setInspectorOpen(value => !value)}>{isEn ? 'Details' : 'جزئیات'}</button></div></div>}
    <div className="modern-content-layout"><div className="modern-main-content">

    {page === 'dashboard' && <>
      <section className="hero">
        <div className="hero-copy">
          
          <h1>{isEn ? <>From idea to investment decision, <em>with greater confidence.</em></> : <><em> ... با اطمینان بیشتر.</em></>}</h1>
          <p>{isEn ? 'An integrated workspace for feasibility studies, engineering design, market analysis, financial modelling and project risk assessment.' : 'محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.'}</p>
          <div className="hero-actions"><button className="primary" onClick={() => setPage('projects')}><Plus size={18}/> {isEn ? 'Create project' : 'ایجاد پروژه جدید'}</button></div>
        </div>
        <div className="hero-art honeycomb-art" aria-label={isEn ? "Pishran capabilities" : "قابلیت‌های پیشران"}>
          <div className="honeycomb-row">
            <div className="honeycomb-cell honeycomb-yellow"><TrendingUp/><span>{isEn ? 'Financial Analysis' : 'تحلیل مالی'}</span></div>
            <div className="honeycomb-cell honeycomb-red"><ShieldCheck/><span>{isEn ? 'Risk Assessment' : 'ارزیابی ریسک'}</span></div>
            <div className="honeycomb-cell honeycomb-yellow"><Gauge/><span>{isEn ? 'Feasibility' : 'امکان‌سنجی'}</span></div>
          </div>
          <div className="honeycomb-row honeycomb-row-middle">
            <div className="honeycomb-cell honeycomb-red"><Globe2/><span>{isEn ? 'Market Analysis' : 'تحلیل بازار'}</span></div>
            <div className="honeycomb-cell honeycomb-yellow"><Factory/><span>{isEn ? 'Process Design' : 'طراحی فرآیند'}</span></div>
          </div>
          <div className="honeycomb-row">
            <div className="honeycomb-cell honeycomb-yellow"><FolderKanban/><span>{isEn ? 'Project Control' : 'مدیریت پروژه'}</span></div>
            <div className="honeycomb-cell honeycomb-red"><FileChartColumn/><span>{isEn ? 'Reports' : 'گزارش‌گیری'}</span></div>
            <div className="honeycomb-cell honeycomb-yellow"><Bot/><span>{isEn ? 'AI Assistant' : 'دستیار هوشمند'}</span></div>
          </div>
        </div>
      </section>

      <section className="section-head"><div><h2>{isEn ? "Investment Control Center" : "مرکز کنترل سرمایه‌گذاری"}</h2></div><span className="muted">{isEn ? 'Version 1.0.1' : 'نسخه ۱.۰.۱'}</span></section>
      <section className="kpis">
        <article className="kpi"><span>{isEn ? 'Registered projects' : 'پروژه‌های ثبت‌شده'}</span><b>{projects.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</b><small>{isEn ? 'Stored on this device' : 'ذخیره‌شده روی این دستگاه'}</small></article>
        <article className="kpi"><span>{isEn ? 'Financial models' : 'مدل‌های مالی'}</span><b>{isEn ? '0' : '۰'}</b><small>{isEn ? 'Traceable and versioned calculations' : 'محاسبات قابل ثبت و نسخه‌بندی'}</small></article>
        <article className="kpi"><span>{isEn ? 'Compared scenarios' : 'سناریوهای مقایسه‌شده'}</span><b>{isEn?'0':'۰'}</b><small>{isEn ? 'A foundation for uncertainty analysis' : 'پایه‌ای برای تحلیل عدم‌قطعیت'}</small></article>
        <article className="kpi"><span>{isEn ? 'Storage status' : 'وضعیت ذخیره‌سازی'}</span><b className="live">{isEn&&storageInfo.backend==='در حال بررسی'?'Checking...':storageInfo.backend}</b><small>{isEn ? 'Data is kept on this device' : 'اطلاعات روی دستگاه نگهداری می‌شود'}</small></article>
      </section>

      <section className="section-head"><div><h2>{isEn ? "Pishran Modules" : "ماژول‌های پیشران"}</h2></div><span className="muted">{isEn ? 'Layered and extensible architecture' : 'معماری لایه‌ای و توسعه‌پذیر'}</span></section>
      <section className="module-grid">{modules.map(({icon: Icon,title,sub,status,enTitle,enSub,enStatus})=><article className="module" key={title}><div className="module-icon"><Icon size={21}/></div><div className="module-text"><b>{isEn ? enTitle : title}</b><p>{isEn ? enSub : sub}</p><small>{isEn ? enStatus : status}</small></div></article>)}</section>

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard') }}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language} onOpenHotRolling={() => { setActiveProject(null); setPage('hot-rolling') }}/>}
    {page === 'hot-rolling' && <RollingWorkspace language={settings.language} project={activeProject ?? undefined} onUpdateProject={handleUpdateProject} onBack={() => setPage('projects')}/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => setPage('projects')}/>}
    {page === 'split-integrated' && activeProject && <section className="projects-page split-integrated-page" dir={isEn?"ltr":"rtl"}>
      <div className="page-heading"><div><h1>{isEn?"Split Integrated Steel Project":"تفکیک پروژه مجتمع فولادی"}</h1><p>{activeProject.name}</p></div><button className="secondary-button" onClick={() => setPage('projects')}>{isEn?"Back to Projects":"بازگشت به پروژه‌ها"}</button></div>
      <div className="ppw-note"><b>{isEn?"This legacy project was defined as an integrated facility.":"این پروژه قدیمی به‌صورت یکپارچه تعریف شده است."}</b><p>{isEn?"To preserve study independence, two separate projects will be created. Each unit’s capacity is intentionally left blank so you can enter its independent DRI and steelmaking capacity. Technical and financial data from the integrated project will not be copied automatically.":"برای رعایت استقلال مطالعات، دو پروژه جداگانه ایجاد می‌شوند. ظرفیت هر واحد عمداً خالی می‌ماند تا ظرفیت مستقل احیاء و فولادسازی را جداگانه وارد کنید. اطلاعات مالی یا فنی پروژه یکپارچه به‌طور خودکار بین دو پروژه کپی نمی‌شود."}</p></div>
      <div className="project-grid">
        <article className="project-card"><div className="module-icon"><Factory size={22}/></div><h3>{isEn?"Standalone Direct Reduction (DRI) Project":"پروژه مستقل احیاء مستقیم (DRI)"}</h3><p>{isEn?"Pellet feed, sponge iron capacity, DRI-specific materials and energy, staffing and unit CAPEX.":"خوراک گندله، ظرفیت تولید آهن اسفنجی، مواد و انرژی مختص احیاء، نیروی انسانی و CAPEX واحد احیاء."}</p><button className="primary" onClick={async()=>{const created=await createProject({name:activeProject.name+(isEn?' — Direct Reduction':' — احیاء مستقیم'),industry:activeProject.industry,capacity:'',location:activeProject.location});setProjects(await listProjects());setActiveProject(created);setActivePlantType('dri');setPage('process-plant');await refreshStorage()}}>{isEn?"Create & Open DRI Project":"ایجاد و ورود به پروژه احیاء"}</button></article>
        <article className="project-card"><div className="module-icon"><Layers3 size={22}/></div><h3>{isEn?"Standalone Steelmaking & Casting Project":"پروژه مستقل فولادسازی و ریخته‌گری"}</h3><p>{isEn?"Melting furnace, secondary refining, continuous casting, product grades, alloying materials and steelmaking-specific costs.":"کوره ذوب، پالایش ثانویه، ریخته‌گری مداوم، گریدهای محصول، مواد آلیاژی و هزینه‌های اختصاصی فولادسازی."}</p><button className="primary" onClick={async()=>{const created=await createProject({name:activeProject.name+(isEn?' — Steelmaking & Casting':' — فولادسازی و ریخته‌گری'),industry:activeProject.industry,capacity:'',location:activeProject.location});setProjects(await listProjects());setActiveProject(created);setActivePlantType('steelmaking');setPage('process-plant');await refreshStorage()}}>{isEn?"Create & Open Steelmaking Project":"ایجاد و ورود به پروژه فولادسازی"}</button></article>
      </div>
    </section>}
    {page === 'integrated-plant' && activeProject && <IntegratedSteelComplexWorkspace language={settings.language} project={activeProject} onBack={() => setPage('projects')}/>}
    {page === 'process-plant' && activeProject && <ProcessPlantWorkspace language={settings.language} project={activeProject} plantType={activePlantType} onBack={() => setPage('projects')}/>} 

    </div>
    {modern && inspectorOpen && <aside className="modern-inspector"><div className="inspector-heading"><b>{isEn ? 'Context & details' : 'جزئیات و راهنما'}</b><button onClick={() => setInspectorOpen(false)}>×</button></div>
      <section><small>{isEn ? 'CURRENT PROJECT' : 'پروژه انتخاب‌شده'}</small><b>{activeProject?.name ?? (isEn ? 'No project selected' : 'پروژه‌ای انتخاب نشده')}</b><p>{activeProject ? (isEn ? 'Project workspace is active.' : 'فضای کاری پروژه فعال است.') : (isEn ? 'Select a project from the browser to inspect its context.' : 'برای مشاهده جزئیات، پروژه‌ای را از مرورگر انتخاب کنید.')}</p></section>
      <section><small>{isEn ? 'WORKSPACE STATUS' : 'وضعیت فضای کاری'}</small><div className={`inspector-status ${loadError ? 'status-warning' : ''}`}><span/> {loadError ? (isEn ? 'Data loading issue' : 'اختلال در بارگذاری داده‌ها') : (isEn ? 'Local storage available' : 'ذخیره‌سازی محلی در دسترس')}</div><p>{loadError || (isEn ? 'Project data uses the current storage layer.' : 'اطلاعات پروژه از لایه ذخیره‌سازی فعلی استفاده می‌کند.')}</p></section>
      <section><small>{isEn ? 'QUICK HELP' : 'راهنمای سریع'}</small><button className="inspector-link" onClick={() => setPage('guide')}>{isEn ? 'Open user guide' : 'مشاهده راهنمای کاربر'} <BookOpen size={14}/></button></section>
    </aside>}
    </div>
    {modern && <div className="modern-statusbar"><span className={loadError ? 'status-warning' : ''}><i/> {loadError ? (isEn ? 'Needs attention' : 'نیازمند بررسی') : (isEn ? 'Ready' : 'آماده')}</span><span>{isEn ? `${projects.length} projects` : `${projects.length.toLocaleString('fa-IR')} پروژه`}</span><span>{isEn ? 'Autosave enabled' : 'ذخیره‌سازی خودکار فعال'}</span><span>{isEn ? 'Calculations on demand' : 'محاسبه با فرمان کاربر'}</span></div>}
    {modern && commandOpen && <div className="command-overlay" onMouseDown={event => { if (event.target === event.currentTarget) { setCommandOpen(false); setCommandQuery('') } }}><section className="command-dialog" role="dialog" aria-modal="true" aria-label={isEn ? 'Quick command search' : 'جستجوی دستورات سریع'}><div className="command-input-row"><span>⌕</span><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} placeholder={isEn ? 'Search pages and actions...' : 'جستجوی صفحه و دستور...'} aria-controls="command-results-list" onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setCommandSelection(index => Math.min(index + 1, commandItems.length - 1)) } else if (event.key === 'ArrowUp') { event.preventDefault(); setCommandSelection(index => Math.max(0, index - 1)) } else if (event.key === 'Enter') { event.preventDefault(); const selected = commandItems[commandSelection]; if (selected) { selected.run(); setCommandOpen(false); setCommandQuery('') } } }}/><kbd>ESC</kbd></div><div className="command-results" id="command-results-list" role="listbox">{commandItems.map((item,index) => <button type="button" role="option" aria-selected={commandSelection === index} className={commandSelection === index ? 'selected' : ''} key={item.key} onMouseEnter={() => setCommandSelection(index)} onClick={() => { item.run(); setCommandOpen(false); setCommandQuery('') }}><item.icon size={16}/>{item.label}<span>↵</span></button>)}</div></section></div>}
    <div className="floating-calculator" dir="ltr">
      {calculatorOpen && <section className="calculator-panel" aria-label={isEn ? 'Calculator' : 'ماشین حساب'}>
        <div className="calculator-heading"><b>{isEn ? 'Calculator' : 'ماشین حساب'}</b><button type="button" aria-label={isEn ? 'Close calculator' : 'بستن ماشین حساب'} onClick={() => setCalculatorOpen(false)}><X size={18}/></button></div>
        <div className="calculator-display" aria-live="polite"><span>{calculatorExpression || '0'}</span>{calculatorError && <small>{calculatorError}</small>}</div>
        <div className="calculator-keys">
          {['C','(',')','⌫','7','8','9','÷','4','5','6','×','1','2','3','−','0','.','%','+','='].map(key => <button key={key} type="button" className={['÷','×','−','+','='].includes(key) ? 'operator' : key === 'C' ? 'clear' : ''} onClick={() => {
            setCalculatorError('')
            if (key === 'C') { setCalculatorExpression(''); return }
            if (key === '⌫') { setCalculatorExpression(value => value.slice(0, -1)); return }
            if (key === '=') {
              try { setCalculatorExpression(String(Number(calculateExpression(calculatorExpression).toPrecision(12)))) }
              catch (error) { setCalculatorError(error instanceof Error ? error.message : (isEn ? 'Invalid expression' : 'عبارت نامعتبر')) }
              return
            }
            setCalculatorExpression(value => value + key)
          }}>{key}</button>)}
        </div>
      </section>}
      <button className="calculator-launcher" type="button" onClick={() => setCalculatorOpen(value => !value)} aria-label={isEn ? 'Open calculator' : 'باز کردن ماشین حساب'} aria-expanded={calculatorOpen}>
        {calculatorOpen ? <X size={21}/> : <Calculator size={21}/>}<span>{isEn ? 'Calculator' : 'ماشین حساب'}</span>
      </button>
    </div>
    <footer>{isEn ? "Pishran · Intelligent Feasibility & Investment Assessment Platform" : "پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری"} <span>{isEn ? "Version 1.0.1 · No sign-in required" : "نسخه ۱.۰.۱ · بدون نیاز به ورود یا حساب کاربری"}</span></footer>
  </main>
}
