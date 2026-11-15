import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Layers3, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen } from 'lucide-react'
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

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [activePlantType, setActivePlantType] = useState<'dri'|'steelmaking'>('dri')
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))

  useEffect(() => {
    let alive = true
    Promise.all([localStore.remove('sample:plate-250k:v1'), localStore.remove('rolling:sample:v2')])
      .then(() => Promise.all([loadSettings(), removeSampleProjects(), localStore.info()]))
      .then(([nextSettings, nextProjects, info]) => {
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
    setSettings(await loadSettings())
    setProjects(await listProjects())
    await refreshStorage()
  }

  return <main className={`app-shell app-page-${page}`} dir={isEn?"ltr":"rtl"}>
    <BackupScheduler/>
    <header className="topbar">
      <button className="language-switch page-language-switch" type="button" onClick={toggleLanguage} aria-label={isEn ? "Switch to Persian" : "Switch to English"}>{isEn ? "FA" : "EN"}</button>
      <div className="brand"><button className="brand-title" type="button" onClick={() => setPage('dashboard')}><b>{isEn ? "Pishran" : "پیشران"}</b><small>INTELLIGENT FEASIBILITY PLATFORM</small></button></div>
      <nav className="main-nav" aria-label={isEn?"Primary navigation":"ناوبری اصلی"}>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}><LayoutDashboard size={17}/> {isEn ? "Dashboard" : "داشبورد"}</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('projects')}><FolderKanban size={17}/> {isEn ? "Projects" : "پروژه‌ها"}</button>
        <button className={page === 'steel-group' || page === 'hot-rolling' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('steel-group')}><Factory size={17}/> {isEn ? "Steel Group" : "گروه فولاد"}</button>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('guide')}><BookOpen size={17}/> {isEn ? "Guide" : "راهنما"}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings size={17}/> {isEn ? "Settings" : "تنظیمات"}</button>
      </nav>
      <div className="top-actions"><span className="connection"><i/> {isEn ? "Local storage active" : "ذخیره محلی فعال"}</span></div>
    </header>

    {page === 'dashboard' && <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">INVESTMENT DECISION INTELLIGENCE</span>
          <h1>{isEn ? <>From idea to investment decision, <em>with greater confidence.</em></> : <><em> ... با اطمینان بیشتر.</em></>}</h1>
          <p>{isEn ? 'An integrated workspace for feasibility studies, engineering design, market analysis, financial modelling and project risk assessment.' : 'محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.'}</p>
          <div className="hero-actions"><button className="primary" onClick={() => setPage('projects')}><Plus size={18}/> {isEn ? 'Create project' : 'ایجاد پروژه جدید'}</button><button className="hero-secondary" onClick={() => setPage('steel-group')}><Factory size={17}/>{isEn ? "Explore steel value chain" : "مشاهده زنجیره فولاد"}</button></div>
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

      <section className="section-head"><div><span className="eyebrow">WORKSPACE</span><h2>{isEn ? "Investment Control Center" : "مرکز کنترل سرمایه‌گذاری"}</h2></div><span className="muted">{isEn ? 'Version 1.0.1' : 'نسخه ۱.۰.۱'}</span></section>
      <section className="kpis">
        <article className="kpi"><span>{isEn ? 'Registered projects' : 'پروژه‌های ثبت‌شده'}</span><b>{projects.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</b><small>{isEn ? 'Stored on this device' : 'ذخیره‌شده روی این دستگاه'}</small></article>
        <article className="kpi"><span>{isEn ? 'Financial models' : 'مدل‌های مالی'}</span><b>{isEn ? '0' : '۰'}</b><small>{isEn ? 'Traceable and versioned calculations' : 'محاسبات قابل ثبت و نسخه‌بندی'}</small></article>
        <article className="kpi"><span>{isEn ? 'Compared scenarios' : 'سناریوهای مقایسه‌شده'}</span><b>{isEn?'0':'۰'}</b><small>{isEn ? 'A foundation for uncertainty analysis' : 'پایه‌ای برای تحلیل عدم‌قطعیت'}</small></article>
        <article className="kpi"><span>{isEn ? 'Storage status' : 'وضعیت ذخیره‌سازی'}</span><b className="live">{isEn&&storageInfo.backend==='در حال بررسی'?'Checking...':storageInfo.backend}</b><small>{isEn ? 'Data is kept on this device' : 'اطلاعات روی دستگاه نگهداری می‌شود'}</small></article>
      </section>

      <section className="section-head"><div><span className="eyebrow">PLATFORM MODULES</span><h2>{isEn ? "Pishran Modules" : "ماژول‌های پیشران"}</h2></div><span className="muted">{isEn ? 'Layered and extensible architecture' : 'معماری لایه‌ای و توسعه‌پذیر'}</span></section>
      <section className="module-grid">{modules.map(({icon: Icon,title,sub,status,enTitle,enSub,enStatus})=><article className="module" key={title}><div className="module-icon"><Icon size={21}/></div><div className="module-text"><b>{isEn ? enTitle : title}</b><p>{isEn ? enSub : sub}</p><small>{isEn ? enStatus : status}</small></div></article>)}</section>

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><span className="eyebrow">ILLUSTRATIVE DATA</span><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><span className="eyebrow">PISHRAN AI COPILOT</span><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => { setActiveProject(project); const stage=project.steelStage||''; if(project.templateId==='raw') setPage('project-wizard'); else if(project.industry!=='فولاد و صنایع معدنی') setPage('project-wizard'); else if(stage.includes('مجتمع احیاء')) setPage('integrated-plant'); else if(stage.includes('احیای مستقیم')) {setActivePlantType('dri');setPage('process-plant')} else if(stage.includes('فولادسازی و ریخته‌گری')) {setActivePlantType('steelmaking');setPage('process-plant')} else if(stage.includes('نورد گرم')) setPage('hot-rolling'); else setPage('project-wizard') }}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language} onOpenHotRolling={() => { setActiveProject(null); setPage('hot-rolling') }}/>}
    {page === 'hot-rolling' && <RollingWorkspace language={settings.language} project={activeProject ?? undefined} onUpdateProject={handleUpdateProject} onBack={() => setPage('projects')}/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => setPage('projects')}/>}
    {page === 'split-integrated' && activeProject && <section className="projects-page split-integrated-page" dir={isEn?"ltr":"rtl"}>
      <div className="page-heading"><div><span className="eyebrow">PISHRAN / PROJECT SEPARATION</span><h1>{isEn?"Split Integrated Steel Project":"تفکیک پروژه مجتمع فولادی"}</h1><p>{activeProject.name}</p></div><button className="secondary-button" onClick={() => setPage('projects')}>{isEn?"Back to Projects":"بازگشت به پروژه‌ها"}</button></div>
      <div className="ppw-note"><b>{isEn?"This legacy project was defined as an integrated facility.":"این پروژه قدیمی به‌صورت یکپارچه تعریف شده است."}</b><p>{isEn?"To preserve study independence, two separate projects will be created. Each unit’s capacity is intentionally left blank so you can enter its independent DRI and steelmaking capacity. Technical and financial data from the integrated project will not be copied automatically.":"برای رعایت استقلال مطالعات، دو پروژه جداگانه ایجاد می‌شوند. ظرفیت هر واحد عمداً خالی می‌ماند تا ظرفیت مستقل احیاء و فولادسازی را جداگانه وارد کنید. اطلاعات مالی یا فنی پروژه یکپارچه به‌طور خودکار بین دو پروژه کپی نمی‌شود."}</p></div>
      <div className="project-grid">
        <article className="project-card"><div className="module-icon"><Factory size={22}/></div><h3>{isEn?"Standalone Direct Reduction (DRI) Project":"پروژه مستقل احیاء مستقیم (DRI)"}</h3><p>{isEn?"Pellet feed, sponge iron capacity, DRI-specific materials and energy, staffing and unit CAPEX.":"خوراک گندله، ظرفیت تولید آهن اسفنجی، مواد و انرژی مختص احیاء، نیروی انسانی و CAPEX واحد احیاء."}</p><button className="primary" onClick={async()=>{const created=await createProject({name:activeProject.name+(isEn?' — Direct Reduction':' — احیاء مستقیم'),industry:activeProject.industry,steelStage:'احیای مستقیم',capacity:'',location:activeProject.location});setProjects(await listProjects());setActiveProject(created);setActivePlantType('dri');setPage('process-plant');await refreshStorage()}}>{isEn?"Create & Open DRI Project":"ایجاد و ورود به پروژه احیاء"}</button></article>
        <article className="project-card"><div className="module-icon"><Layers3 size={22}/></div><h3>{isEn?"Standalone Steelmaking & Casting Project":"پروژه مستقل فولادسازی و ریخته‌گری"}</h3><p>{isEn?"Melting furnace, secondary refining, continuous casting, product grades, alloying materials and steelmaking-specific costs.":"کوره ذوب، پالایش ثانویه، ریخته‌گری مداوم، گریدهای محصول، مواد آلیاژی و هزینه‌های اختصاصی فولادسازی."}</p><button className="primary" onClick={async()=>{const created=await createProject({name:activeProject.name+(isEn?' — Steelmaking & Casting':' — فولادسازی و ریخته‌گری'),industry:activeProject.industry,steelStage:'فولادسازی و ریخته‌گری (ذوب و ریخته‌گری مداوم)',capacity:'',location:activeProject.location});setProjects(await listProjects());setActiveProject(created);setActivePlantType('steelmaking');setPage('process-plant');await refreshStorage()}}>{isEn?"Create & Open Steelmaking Project":"ایجاد و ورود به پروژه فولادسازی"}</button></article>
      </div>
    </section>}
    {page === 'integrated-plant' && activeProject && <IntegratedSteelComplexWorkspace language={settings.language} project={activeProject} onBack={() => setPage('projects')}/>}
    {page === 'process-plant' && activeProject && <ProcessPlantWorkspace language={settings.language} project={activeProject} plantType={activePlantType} onBack={() => setPage('projects')}/>} 

    <footer>{isEn ? "Pishran · Intelligent Feasibility & Investment Assessment Platform" : "پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری"} <span>{isEn ? "Version 1.0.1 · No sign-in required" : "نسخه ۱.۰.۱ · بدون نیاز به ورود یا حساب کاربری"}</span></footer>
  </main>
}
