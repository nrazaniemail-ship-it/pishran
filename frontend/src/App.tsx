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

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'project-wizard' | 'guide'

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

    {page === 'projects' && <ProjectsView language={settings.language} projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenProject={project => { setActiveProject(project); setPage('project-wizard') }}/>}
    {page === 'guide' && <Guide language={settings.language}/>}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onRestored={refreshAfterRestore}/>}
    {page === 'steel-group' && <SteelGroupWorkspace language={settings.language}/>}
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
