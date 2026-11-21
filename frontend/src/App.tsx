import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard, BookOpen, Calculator, X } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, purgeRemovedCaseProjects, listProjects, updateProject, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import FeasibilityWizard from './features/projects/FeasibilityWizard'
import Guide from './features/guide/Guide'
import BackupScheduler from './features/settings/BackupScheduler'
import ProductionWorkspace from './features/production/ProductionWorkspace'

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'project-wizard' | 'guide' | 'production'

const moduleGroups = [
  {
    title: 'دید مدیریتی، سودآوری و کنترل عملکرد', enTitle: 'Management, Profitability & Performance',
    modules: [
      { icon: LayoutDashboard, title: 'داشبورد هوشمند مدیرعامل', enTitle: 'Executive Intelligence Dashboard', sub: 'وضعیت شرکت، انحراف‌ها و هشدارهای مدیریتی', enSub: 'Company status, variances and executive alerts' },
      { icon: TrendingUp, title: 'مدیریت اقتصادی و بهای تمام‌شده', enTitle: 'Steel Cost & Profitability Intelligence', sub: 'بهای تمام‌شده، حاشیه سود و نقطه سربه‌سر', enSub: 'Cost, margins and break-even analysis' },
      { icon: Activity, title: 'هوشمندی تولید و بهره‌وری', enTitle: 'Production & OEE Intelligence', sub: 'تولید، ظرفیت، توقفات و راندمان', enSub: 'Output, capacity, downtime and OEE' },
      { icon: Gauge, title: 'مدیریت عملکرد و شاخص‌ها', enTitle: 'Enterprise Performance Management', sub: 'اهداف، KPI، انحراف و اقدام اصلاحی', enSub: 'Objectives, KPIs, variances and actions' },
    ],
  },
  {
    title: 'بهره‌وری، پایداری و تعالی عملیات', enTitle: 'Productivity, Sustainability & Operational Excellence',
    modules: [
      { icon: Activity, title: 'مدیریت انرژی', enTitle: 'Energy Intelligence & Optimization', sub: 'مصرف ویژه، هزینه و فرصت‌های بهینه‌سازی', enSub: 'Specific consumption, cost and optimization' },
      { icon: Settings, title: 'تعمیرات و قابلیت اطمینان', enTitle: 'Maintenance & Asset Reliability', sub: 'خرابی، توقف، MTBF و MTTR', enSub: 'Failures, downtime, MTBF and MTTR' },
      { icon: Factory, title: 'مهندسی فرآیند و تعالی عملیاتی', enTitle: 'Process Engineering & Operational Excellence', sub: 'توازن مواد و انرژی، گلوگاه و بهبود', enSub: 'Material and energy balance, bottlenecks and improvement' },
      { icon: FolderKanban, title: 'زنجیره تأمین و موجودی', enTitle: 'Supply Chain & Inventory Intelligence', sub: 'تأمین‌کنندگان، موجودی و سرمایه در گردش', enSub: 'Suppliers, inventory and working capital' },
    ],
  },
  {
    title: 'بازار، مشتری و رشد سودآور', enTitle: 'Market, Customer & Profitable Growth',
    modules: [
      { icon: Globe2, title: 'هوشمندی بازار و سودآوری محصول', enTitle: 'Steel Market & Product Profitability', sub: 'قیمت، عرضه و تقاضا، رقبا و ترکیب محصول', enSub: 'Prices, supply, demand, competitors and product mix' },
    ],
  },
  {
    title: 'تصمیم‌گیری، سرمایه‌گذاری و تاب‌آوری', enTitle: 'Decision, Investment & Resilience',
    modules: [
      { icon: FileChartColumn, title: 'رتبه‌بندی و هوشمندی تصمیم', enTitle: 'Ranking & Decision Intelligence', sub: 'وزن‌دهی، رتبه‌بندی و پایداری تصمیم', enSub: 'Weighting, ranking and decision robustness' },
      { icon: FolderKanban, title: 'مدیریت پروژه‌های توسعه و سرمایه‌گذاری', enTitle: 'Capital Project & Portfolio Management', sub: 'بودجه، پیشرفت، زمان‌بندی و سبد پروژه', enSub: 'Budget, progress, schedule and project portfolio' },
      { icon: ShieldCheck, title: 'مدیریت ریسک و تاب‌آوری', enTitle: 'Enterprise Risk & Resilience', sub: 'ریسک‌های عملیاتی، مالی و استمرار کسب‌وکار', enSub: 'Operational, financial and continuity risks' },
    ],
  },
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
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calculatorExpression, setCalculatorExpression] = useState('')
  const [calculatorError, setCalculatorError] = useState('')
  const isEn = settings.language === 'en'
  const toggleLanguage = () => setSettings(current => ({ ...current, language: current.language === 'fa' ? 'en' : 'fa' }))

  useEffect(() => {
    let alive = true
    Promise.all([loadSettings(), purgeRemovedCaseProjects(), localStore.info()])
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
      <div className="brand"><button className="brand-title" type="button" onClick={() => setPage('dashboard')}><b>{isEn ? "Pishran" : "پیشران"}</b></button></div>
      <nav className="main-nav" aria-label={isEn?"Primary navigation":"ناوبری اصلی"}>
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}><LayoutDashboard size={17}/> {isEn ? "Dashboard" : "داشبورد"}</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('projects')}><FolderKanban size={17}/> {isEn ? "Projects" : "پروژه‌ها"}</button>
        <button className={page === 'steel-group' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('steel-group')}><Factory size={17}/> {isEn ? "Steel Group" : "گروه فولاد"}</button>
        <button className={page === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('guide')}><BookOpen size={17}/> {isEn ? "Guide" : "راهنما"}</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings size={17}/> {isEn ? "Settings" : "تنظیمات"}</button>
      </nav>
      <div className="top-actions"></div>
    </header>

    {page === 'dashboard' && <>
      <section className="hero">
        <div className="hero-copy">
          
          <h1>{isEn ? <>From idea to investment decision, <em>with greater confidence.</em></> : <><em> ... با اطمینان بیشتر.</em></>}</h1>
          <p>{isEn ? 'An integrated workspace for feasibility studies, engineering design, market analysis, financial modelling and project risk assessment.' : 'محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.'}</p>
          <div className="hero-actions"><button className="primary" onClick={() => setPage('projects')}><Plus size={18}/> {isEn ? 'Create project' : 'ایجاد پروژه جدید'}</button></div>
        </div>
        <div className="hero-art honeycomb-art" aria-label={isEn ? "Feasibility core and priority modules" : "هسته امکان‌سنجی و ماژول‌های اولویت‌دار"}>
          <div className="honeycomb-row">
            <button type="button" className="honeycomb-cell honeycomb-yellow roadmap" disabled><LayoutDashboard/><span>{isEn ? 'Executive Dashboard' : 'داشبورد هوشمند مدیرعامل'}</span></button>
            <button type="button" className="honeycomb-cell honeycomb-red roadmap" disabled><TrendingUp/><span>{isEn ? 'Cost & Profitability' : 'بهای تمام‌شده و سودآوری'}</span></button>
            <button type="button" className="honeycomb-cell honeycomb-yellow" onClick={() => setPage('production')}><Activity/><span>{isEn ? 'Production & OEE' : 'تولید، Yield و بهره‌وری'}</span></button>
          </div>
          <div className="honeycomb-row honeycomb-row-middle">
            <button type="button" className="honeycomb-cell honeycomb-red roadmap" disabled><Gauge/><span>{isEn ? 'Performance & KPI' : 'مدیریت عملکرد و KPI'}</span></button>
            <button type="button" className="honeycomb-cell honeycomb-core" onClick={() => setPage('project-wizard')} aria-label={isEn ? "Start feasibility study" : "شروع امکان‌سنجی پروژه"}><Gauge/><span>{isEn ? 'Feasibility Study' : 'امکان‌سنجی فنی، اقتصادی و مالی'}</span><small>{isEn ? 'Pishran core' : 'هسته ثابت پیشران'}</small></button>
          </div>
          <p className="honeycomb-hint">{isEn ? 'Feasibility is the active core; enterprise modules are introduced in phases.' : 'امکان‌سنجی هسته فعال پیشران است؛ ماژول‌های بنگاه به‌صورت مرحله‌ای توسعه می‌یابند.'}</p>
        </div>
      </section>

      <section className="section-head"><div><h2>{isEn ? "Investment Control Center" : "مرکز کنترل سرمایه‌گذاری"}</h2></div><span className="muted">{isEn ? 'Version 1.0.1' : 'نسخه ۱.۰.۱'}</span></section>
      <section className="kpis">
        <article className="kpi"><span>{isEn ? 'Registered projects' : 'پروژه‌های ثبت‌شده'}</span><b>{projects.length.toLocaleString(isEn ? 'en-US' : 'fa-IR')}</b><small>{isEn ? 'Stored on this device' : 'ذخیره‌شده روی این دستگاه'}</small></article>
        <article className="kpi"><span>{isEn ? 'Financial models' : 'مدل‌های مالی'}</span><b>{isEn ? '0' : '۰'}</b><small>{isEn ? 'Traceable and versioned calculations' : 'محاسبات قابل ثبت و نسخه‌بندی'}</small></article>
        <article className="kpi"><span>{isEn ? 'Compared scenarios' : 'سناریوهای مقایسه‌شده'}</span><b>{isEn?'0':'۰'}</b><small>{isEn ? 'A foundation for uncertainty analysis' : 'پایه‌ای برای تحلیل عدم‌قطعیت'}</small></article>
        <article className="kpi"><span>{isEn ? 'Storage status' : 'وضعیت ذخیره‌سازی'}</span><b className="live">{isEn&&storageInfo.backend==='در حال بررسی'?'Checking...':storageInfo.backend}</b><small>{isEn ? 'Data is kept on this device' : 'اطلاعات روی دستگاه نگهداری می‌شود'}</small></article>
      </section>

      <section className="section-head"><div><h2>{isEn ? "Pishran Modules" : "نقشه ماژول‌های پیشران"}</h2></div><span className="muted">{isEn ? '12 specialized modules · phased roadmap' : '۱۲ ماژول تخصصی · نقشه راه مرحله‌ای'}</span></section>
      {moduleGroups.map(group=><section className="module-group" key={group.title}><h3>{isEn ? group.enTitle : group.title}</h3><div className="module-grid">{group.modules.map(({icon: Icon,title,sub,enTitle,enSub})=><article className="module" key={title}><div className="module-icon"><Icon size={21}/></div><div className="module-text"><b>{isEn ? enTitle : title}</b><p>{isEn ? enSub : sub}</p><small>{isEn ? 'Roadmap · not yet active' : 'در نقشه راه · هنوز فعال نشده'}</small></div></article>)}</div></section>)}

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><h3>{isEn ? "Illustrative return trend" : "نمای نمونه روند بازده"}</h3></div><span className="tag">{isEn ? "Sample data" : "داده نمایشی"}</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><h3>{isEn ? "Investment Decision Assistant" : "دستیار تصمیم‌یار سرمایه‌گذاری"}</h3><p>{isEn ? 'Future versions of Pishran will review assumptions, explain risks and analyse results with references to source data.' : 'در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.'}</p><div className="notice">{isEn ? 'This version contains illustrative outputs. Do not use them as the basis for actual investment decisions.' : 'خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.'}</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => { setActiveProject(project); setPage('project-wizard') }}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language}/>}
    {page === 'production' && <ProductionWorkspace language={settings.language} onBack={() => setPage('dashboard')}/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard language={settings.language} project={activeProject} onBack={() => setPage('projects')}/>}


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
