import { useEffect, useMemo, useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen, Zap, Wrench, Boxes, Target, BriefcaseBusiness } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, purgeRemovedCaseProjects, listProjects, updateProject, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import FeasibilityWizard from './features/projects/FeasibilityWizard'
import Guide from './features/guide/Guide'
import BackupScheduler from './features/settings/BackupScheduler'
import ModuleIntelligencePanel from './features/modules/ModuleIntelligencePanel'
import ExecutiveDashboardPanel from './features/modules/ExecutiveDashboardPanel'

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'project-wizard' | 'guide' | 'module'

type ModuleWorkspace = { id: string; moduleId: string; name: string; createdAt: string }

const modules = [
  { id: 'MOD-01', icon: LayoutDashboard, title: 'داشبورد هوشمند مدیرعامل', enTitle: 'Executive Intelligence Dashboard', sub: 'نمای یکپارچه وضعیت و استثناهای مدیریتی', enSub: 'Unified business status and management exceptions', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-02', icon: TrendingUp, title: 'مدیریت اقتصادی و بهای تمام‌شده', enTitle: 'Steel Cost & Profitability Intelligence', sub: 'هزینه، حاشیه سود و انحراف بهای تمام‌شده', enSub: 'Cost, margin and cost variance analysis', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-03', icon: Gauge, title: 'هوشمندی تولید و بهره‌وری', enTitle: 'Production & OEE Intelligence', sub: 'تولید، ظرفیت، توقفات و راندمان', enSub: 'Output, capacity, downtime and OEE', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-04', icon: Target, title: 'مدیریت عملکرد و شاخص‌ها', enTitle: 'Enterprise Performance Management', sub: 'اهداف، KPI و تحلیل انحراف عملکرد', enSub: 'Goals, KPIs and performance variance', group: 'دید مدیریتی و سودآوری', enGroup: 'Management & Profitability' },
  { id: 'MOD-05', icon: Zap, title: 'مدیریت انرژی', enTitle: 'Energy Intelligence & Optimization', sub: 'مصرف ویژه، هزینه و فرصت‌های بهینه‌سازی', enSub: 'Specific consumption, cost and optimization', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-06', icon: Wrench, title: 'تعمیرات و قابلیت اطمینان', enTitle: 'Maintenance & Asset Reliability', sub: 'خرابی، توقف و قابلیت اطمینان تجهیزات', enSub: 'Failures, downtime and asset reliability', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-07', icon: Factory, title: 'مهندسی فرآیند و تعالی عملیاتی', enTitle: 'Process Engineering & Operational Excellence', sub: 'توازن مواد و انرژی، گلوگاه و بهبود', enSub: 'Material and energy balance, bottlenecks and improvement', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-08', icon: Boxes, title: 'زنجیره تأمین و موجودی', enTitle: 'Supply Chain & Inventory Intelligence', sub: 'تأمین، گردش موجودی و سرمایه در گردش', enSub: 'Procurement, inventory turnover and working capital', group: 'بهره‌وری و تعالی عملیات', enGroup: 'Operational Excellence' },
  { id: 'MOD-09', icon: Globe2, title: 'هوشمندی بازار و سودآوری محصول', enTitle: 'Steel Market & Product Profitability', sub: 'بازار، قیمت، رقبا و ترکیب سودآور محصول', enSub: 'Markets, pricing, competitors and product mix', group: 'بازار و رشد سودآور', enGroup: 'Market & Profitable Growth' },
  { id: 'MOD-10', icon: ShieldCheck, title: 'رتبه‌بندی و هوشمندی تصمیم', enTitle: 'Ranking & Decision Intelligence', sub: 'مقایسه گزینه‌ها با معیار و شواهد شفاف', enSub: 'Evidence-based comparison and ranking', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
  { id: 'MOD-11', icon: FolderKanban, title: 'مدیریت پروژه و سرمایه‌گذاری', enTitle: 'Capital Project & Portfolio Management', sub: 'بودجه، پیشرفت، زمان و منافع پروژه', enSub: 'Project budget, progress, schedule and benefits', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
  { id: 'MOD-12', icon: Activity, title: 'مدیریت ریسک و تاب‌آوری', enTitle: 'Enterprise Risk & Resilience', sub: 'ریسک‌های عملیاتی، مالی و استمرار کسب‌وکار', enSub: 'Operational, financial and continuity risks', group: 'تصمیم‌گیری و تاب‌آوری', enGroup: 'Decision & Resilience' },
]

const moduleIconFiles = ['01-dashboard.svg','02-economics.svg','03-production.svg','04-kpi.svg','05-energy.svg','06-maintenance.svg','07-process.svg','08-supply-chain.svg','09-market.svg','10-decision.svg','11-project-investment.svg','12-risk.svg']

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState('MOD-01')
  const [moduleWorkspaces, setModuleWorkspaces] = useState<ModuleWorkspace[]>([])
  const [moduleWorkspaceName, setModuleWorkspaceName] = useState('')
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))
  type NavigationEntry = { page: Page; project: FeasibilityProject | null; moduleId: string }
  const navigationStackRef = useRef<NavigationEntry[]>([{ page: 'dashboard', project: null, moduleId: 'MOD-01' }])
  const [moduleDropdownOpen, setModuleDropdownOpen] = useState(false)

  function navigateTo(nextPage: Page, nextProject: FeasibilityProject | null = activeProject, nextModuleId = activeModuleId) {
    const current = navigationStackRef.current[navigationStackRef.current.length - 1]
    if (current.page === nextPage && current.project?.id === nextProject?.id && current.moduleId === nextModuleId) return
    navigationStackRef.current.push({ page: nextPage, project: nextProject, moduleId: nextModuleId })
    window.history.pushState({ pishranNavigation: true }, '', window.location.href)
    setActiveProject(nextProject)
    setActiveModuleId(nextModuleId)
    setPage(nextPage)
  }

  function navigateBack(fallbackPage: Page) {
    if (navigationStackRef.current.length > 1) window.history.back()
    else navigateTo(fallbackPage)
  }

  useEffect(() => {
    // Each in-app navigation adds one history entry. Android's Back key
    // therefore unwinds nested screens first; at the dashboard, native
    // back is left untouched so the user can exit normally.
    const handlePopState = () => {
      if (navigationStackRef.current.length > 1) {
        navigationStackRef.current.pop()
        const previous = navigationStackRef.current[navigationStackRef.current.length - 1]
        setPage(previous.page)
        setActiveProject(previous.project)
        setActiveModuleId(previous.moduleId)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])


  useEffect(() => {
    let alive = true
    Promise.all([loadSettings(), purgeRemovedCaseProjects()])
      .then(async ([nextSettings, nextProjects]) => {
        const info = await localStore.info()
        if (!alive) return
        setSettings(nextSettings)
        applySettings(nextSettings)
        setProjects(nextProjects)
        setStorageInfo(info)
        setReady(true)
      }).catch(() => setReady(true))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    localStore.get<ModuleWorkspace[]>('module-workspaces:v1').then(items => {
      if (alive) setModuleWorkspaces(Array.isArray(items) ? items : [])
    }).catch(() => undefined)
    return () => { alive = false }
  }, [])

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

  async function refreshStorage() {
    setStorageInfo(await localStore.info())
  }

  async function handleCreateProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'steelStage' | 'capacity' | 'location' | 'templateId'>) {
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
    await purgeRemovedCaseProjects()
    setSettings(await loadSettings())
    setProjects(await listProjects())
    setModuleWorkspaces(await localStore.get<ModuleWorkspace[]>('module-workspaces:v1') ?? [])
    await refreshStorage()
  }

  function openModule(moduleId: string) {
    setModuleDropdownOpen(false)
    navigateTo('module', activeProject, moduleId)
  }

  async function createModuleWorkspace() {
    const name = moduleWorkspaceName.trim()
    if (!name) return
    const record: ModuleWorkspace = { id: `${activeModuleId}-${Date.now()}`, moduleId: activeModuleId, name, createdAt: new Date().toISOString() }
    const next = [record, ...moduleWorkspaces]
    await localStore.set('module-workspaces:v1', next)
    setModuleWorkspaces(next)
    setModuleWorkspaceName('')
    await refreshStorage()
  }

  const activeModule = modules.find(item => item.id === activeModuleId) ?? modules[0]
  const ActiveModuleIcon = activeModule.icon
  const activeModuleWorkspaces = moduleWorkspaces.filter(item => item.moduleId === activeModule.id)

  return <main className={`app-shell app-page-${page}`} dir={isEn?"ltr":"rtl"}>
    <BackupScheduler/>
    <header className="topbar">
      <button className="language-switch page-language-switch" type="button" onClick={toggleLanguage} aria-label={isEn ? "Switch to Persian" : "Switch to English"}>{isEn ? "FA" : "EN"}</button>
      <div className="brand"><button className="brand-title" type="button" onClick={() => navigateTo('dashboard')}><b>{isEn ? "Pishran" : "پیشران"}</b></button></div>
      <nav className="main-nav" aria-label={isEn?"Primary navigation":"ناوبری اصلی"}>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('dashboard')}><LayoutDashboard size={17}/> {isEn ? "Dashboard" : "داشبورد"}</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('projects')}><FolderKanban size={17}/> {isEn ? "Projects" : "پروژه‌ها"}</button>
        <button className={page === 'steel-group' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('steel-group')}><Factory size={17}/> {isEn ? "Steel Group" : "گروه فولاد"}</button>
        <details className="nav-dropdown" open={moduleDropdownOpen}>
          <summary className={page === 'module' ? 'nav-item active' : 'nav-item'} onClick={event => { event.preventDefault(); setModuleDropdownOpen(current => !current) }}><Boxes size={17}/> {isEn ? 'Modules' : 'ماژولها'}</summary>
          <div className="nav-dropdown-menu">
            {modules.map(item => <button type="button" key={item.id} className={page === 'module' && activeModuleId === item.id ? 'dropdown-module active' : 'dropdown-module'} onClick={() => openModule(item.id)}><span>{item.id}</span>{isEn ? item.enTitle : item.title}</button>)}
          </div>
        </details>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('guide')}><BookOpen size={17}/> {isEn ? "Guide" : "راهنما"}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigateTo('settings')}><Settings size={17}/> {isEn ? "Settings" : "تنظیمات"}</button>
      </nav>
      <div className="top-actions"></div>
    </header>

    {page === 'dashboard' && <>
      <section className="hero">
        <div className="hero-copy">
          
          <h1>{isEn ? <>From idea to investment decision, <em>with greater confidence.</em></> : <><em> ... با اطمینان بیشتر.</em></>}</h1>
          <p>{isEn ? 'An integrated workspace for feasibility studies, engineering design, market analysis, financial modelling and project risk assessment.' : 'محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.'}</p>
          <div className="hero-actions"><button className="primary" onClick={() => navigateTo('projects')}><Plus size={18}/> {isEn ? 'Create project' : 'ایجاد پروژه جدید'}</button></div>
        </div>
        <div className="hero-art dashboard-image-art">
          <div className="dashboard-diagram-stage" aria-label={isEn ? "Interactive Pishran module diagram" : "نمودار تعاملی ماژول‌های پیشران"}>
            <img className="dashboard-module-image" src="/modules/diagram-3d-light.svg" alt={isEn ? "Three-dimensional twelve-module Pishran dashboard diagram" : "نمودار سه‌بعدی روشن دوازده ماژول پیشران"} />
            {modules.map((item, index) => {
              const spots = [
                { left:'40.54%', top:'1%', width:'18.92%', height:'19.62%' },
                { left:'60.14%', top:'6.26%', width:'18.92%', height:'19.62%' },
                { left:'74.47%', top:'20.59%', width:'18.92%', height:'19.62%' },
                { left:'79.73%', top:'40.19%', width:'18.92%', height:'19.62%' },
                { left:'74.47%', top:'59.79%', width:'18.92%', height:'19.62%' },
                { left:'60.14%', top:'74.12%', width:'18.92%', height:'19.62%' },
                { left:'40.54%', top:'79.73%', width:'18.92%', height:'19.62%' },
                { left:'20.94%', top:'74.12%', width:'18.92%', height:'19.62%' },
                { left:'6.61%', top:'59.79%', width:'18.92%', height:'19.62%' },
                { left:'1.35%', top:'40.19%', width:'18.92%', height:'19.62%' },
                { left:'6.61%', top:'20.59%', width:'18.92%', height:'19.62%' },
                { left:'20.94%', top:'6.26%', width:'18.92%', height:'19.62%' },
              ]
              return <button key={item.id} type="button" className="dashboard-diagram-hotspot" style={spots[index]}
                title={isEn ? item.enSub : item.sub}
                onClick={() => openModule(item.id)}
                aria-label={`${item.id}: ${isEn ? item.enTitle : item.title}. ${isEn ? item.enSub : item.sub}`}>
                <span className="dashboard-diagram-tooltip">
                  <img src={`/modules/icons/${moduleIconFiles[index]}`} alt="" />
                  <span>{isEn ? item.enSub : item.sub}</span>
                </span>
                <span className="visually-hidden">{isEn ? item.enTitle : item.title}</span>
              </button>
            })}
            <button type="button" className="dashboard-diagram-core-hotspot"
              data-tooltip={isEn ? "Open project feasibility and investment assessment" : "ورود به ارزیابی فنی و اقتصادی پروژه‌ها"}
              title={isEn ? "Open project assessment" : "ورود به ارزیابی پروژه‌ها"}
              onClick={() => navigateTo('projects')}
              aria-label={isEn ? "Open project assessment" : "ورود به ارزیابی فنی و اقتصادی پروژه‌ها"} />
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

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => navigateTo('project-wizard', project)}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language}/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => navigateBack('projects')}/>}
    {page === 'module' && <section className="module-workspace-page">
      <div className="module-workspace-heading"><button type="button" className="secondary" onClick={() => navigateBack('dashboard')}>{isEn ? 'Back to dashboard' : 'بازگشت به داشبورد'}</button><span className="module-id">{activeModule.id}</span></div>
      <div className="module-workspace-hero"><div className="module-icon"><ActiveModuleIcon size={26}/></div><div><h1>{isEn ? activeModule.enTitle : activeModule.title}</h1><p>{isEn ? activeModule.enSub : activeModule.sub}</p><small>{isEn ? activeModule.enGroup : activeModule.group}</small></div></div>
      {activeModule.id === 'MOD-01' && <ExecutiveDashboardPanel language={settings.language} onOpenModule={openModule}/>}
      {(activeModule.id === 'MOD-02' || activeModule.id === 'MOD-03') && <ModuleIntelligencePanel moduleId={activeModule.id} language={settings.language}/>}
      <section className="module-workspace-card"><div className="section-head"><div><h2>{isEn ? 'Module workspaces' : 'پرونده‌های این ماژول'}</h2><p>{isEn ? 'Create and manage workspaces dedicated to this module.' : 'برای ثبت پروژه‌ها، تحلیل‌ها و اطلاعات اختصاصی این ماژول پرونده ایجاد کنید.'}</p></div><span className="muted">{activeModuleWorkspaces.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</span></div>
        <form className="module-create-form" onSubmit={event => { event.preventDefault(); void createModuleWorkspace() }}><label htmlFor="module-workspace-name">{isEn ? 'New module workspace name' : 'نام پرونده جدید ماژول'}</label><div><input id="module-workspace-name" value={moduleWorkspaceName} onChange={event => setModuleWorkspaceName(event.target.value)} placeholder={isEn ? 'Enter a name' : 'نام پروژه یا پرونده را وارد کنید'} maxLength={100}/><button className="primary" type="submit" disabled={!moduleWorkspaceName.trim()}><Plus size={17}/>{isEn ? 'Create' : 'ایجاد پرونده'}</button></div></form>
        {activeModuleWorkspaces.length ? <div className="module-workspace-list">{activeModuleWorkspaces.map(item => <article className="module-workspace-item" key={item.id}><div><b>{item.name}</b><small>{new Date(item.createdAt).toLocaleDateString(isEn ? 'en-US' : 'fa-IR')}</small></div><span>{isEn ? 'Saved locally' : 'ذخیره‌شده روی دستگاه'}</span></article>)}</div> : <div className="empty-state"><b>{isEn ? 'No workspaces yet' : 'هنوز پرونده‌ای برای این ماژول ایجاد نشده است'}</b><p>{isEn ? 'Create the first workspace to start collecting module-specific information.' : 'با ایجاد اولین پرونده، اطلاعات و تحلیل‌های اختصاصی این ماژول را ثبت کنید.'}</p></div>}
      </section>
    </section>}


    <footer>{isEn ? "Pishran · Intelligent Feasibility & Investment Assessment Platform" : "پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری"} <span>{isEn ? "Version 1.0.1 · No sign-in required" : "نسخه ۱.۰.۱ · بدون نیاز به ورود یا حساب کاربری"}</span></footer>
  </main>
}
