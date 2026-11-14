import { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Layers3, Plus, ShieldCheck, TrendingUp, Settings, FolderKanban, LayoutDashboard } from 'lucide-react'
import { localStore } from './core/storage/localStore'
import { applySettings, DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from './core/settings/settings'
import { createProject, deleteProject, listProjects, type FeasibilityProject } from './core/projects/projectRepository'
import ProjectsView from './features/projects/ProjectsView'
import SettingsView from './features/settings/SettingsView'
import HotRollingWorkspace from './features/steel/HotRollingWorkspace'
import SteelGroupWorkspace from './features/steel/SteelGroupWorkspace'
import PlateSampleProject from './features/steel/PlateSampleProject'
import FeasibilityWizard from './features/projects/FeasibilityWizard'

type Page = 'dashboard' | 'projects' | 'settings' | 'steel-group' | 'hot-rolling' | 'plate-sample' | 'project-wizard'

const modules = [
  { icon: Factory, title: 'مهندسی و طراحی فرآیند', sub: 'ظرفیت، توازن مواد، انرژی و تجهیزات', status: 'در نقشه راه' },
  { icon: Globe2, title: 'هوشمندی بازار', sub: 'عرضه، تقاضا، قیمت و رقبا', status: 'در نقشه راه' },
  { icon: TrendingUp, title: 'مدل مالی و اقتصادی', sub: 'NPV، IRR، جریان نقدی و تأمین مالی', status: 'نمونه اولیه' },
  { icon: Activity, title: 'ریسک و سناریو', sub: 'حساسیت، سناریو و مونت‌کارلو', status: 'در نقشه راه' },
  { icon: Bot, title: 'دستیار هوش مصنوعی', sub: 'تحلیل مستند و پاسخ‌گویی به سرمایه‌گذار', status: 'در نقشه راه' },
  { icon: FileChartColumn, title: 'گزارش سرمایه‌گذاری', sub: 'گزارش مدیریتی، بانکی و سرمایه‌گذار', status: 'در نقشه راه' },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [projects, setProjects] = useState<FeasibilityProject[]>([])
  const [activeProject, setActiveProject] = useState<FeasibilityProject | null>(null)
  const [storageInfo, setStorageInfo] = useState({ backend: 'در حال بررسی', items: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([loadSettings(), listProjects(), localStore.info()]).then(([nextSettings, nextProjects, info]) => {
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
    if (!ready) return
    applySettings(settings)
    void saveSettings(settings)
  }, [settings, ready])

  const chart = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 24, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: ['سال ۱', 'سال ۲', 'سال ۳', 'سال ۴', 'سال ۵'], axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf0f4' } } },
    series: [{ name: 'بازده نمونه', type: 'line', smooth: true, data: [8, 12, 16, 19, 23], areaStyle: { opacity: .08 }, lineStyle: { width: 3 }, symbolSize: 8 }]
  }), [])

  async function refreshStorage() {
    setStorageInfo(await localStore.info())
  }

  async function handleCreateProject(input: Pick<FeasibilityProject, 'name' | 'industry' | 'steelStage' | 'capacity' | 'location'>) {
    const created = await createProject(input)
    setProjects(current => [created, ...current])
    await refreshStorage()
  }

  async function handleDeleteProject(id: string) {
    await deleteProject(id)
    setProjects(await listProjects())
    await refreshStorage()
  }

  async function exportBackup() {
    const backup = await localStore.exportAll()
    const blob = new Blob([JSON.stringify({ app: 'Pishran', ...backup }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pishran-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file: File) {
    try {
      const backup = JSON.parse(await file.text())
      const count = await localStore.importAll(backup)
      setSettings(await loadSettings())
      setProjects(await listProjects())
      await refreshStorage()
      window.alert(`بازیابی انجام شد؛ ${count} مورد اطلاعات وارد شد.`)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'بازیابی فایل ناموفق بود.')
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setPage('dashboard')} aria-label="صفحه اصلی پیشران"><div className="brandmark">پ</div><div><b>پیشران</b><small>INTELLIGENT FEASIBILITY PLATFORM</small></div></button>
      <nav className="main-nav" aria-label="ناوبری اصلی">
        <button className={page === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('dashboard')}><LayoutDashboard size={17}/> داشبورد</button>
        <button className={page === 'projects' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('projects')}><FolderKanban size={17}/> پروژه‌ها</button>
        <button className={page === 'steel-group' || page === 'hot-rolling' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('steel-group')}><Factory size={17}/> گروه فولاد</button>
        <button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('settings')}><Settings size={17}/> تنظیمات</button>
      </nav>
      <div className="top-actions"><span className="connection"><i/> ذخیره محلی فعال</span><button className="avatar" onClick={() => setPage('settings')}>P</button></div>
    </header>

    {page === 'dashboard' && <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">INVESTMENT DECISION INTELLIGENCE</span>
          <h1>از ایده تا تصمیم سرمایه‌گذاری، <em>با اطمینان بیشتر.</em></h1>
          <p>محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.</p>
          <div className="hero-actions"><button className="primary" onClick={() => setPage('projects')}><Plus size={18}/> ایجاد پروژه جدید</button><button className="hero-secondary" onClick={() => setPage('steel-group')}><Factory size={17}/> مشاهده زنجیره فولاد</button></div>
        </div>
        <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-icon"><Layers3 size={48}/></div><span className="floating f1"><Gauge/> تحلیل اقتصادی</span><span className="floating f2"><ShieldCheck/> ارزیابی ریسک</span></div>
      </section>

      <section className="section-head"><div><span className="eyebrow">WORKSPACE</span><h2>مرکز کنترل سرمایه‌گذاری</h2></div><span className="muted">نسخه ۱.۰.۱</span></section>
      <section className="kpis">
        <article className="kpi"><span>پروژه‌های ثبت‌شده</span><b>{projects.length.toLocaleString('fa-IR')}</b><small>ذخیره‌شده روی این دستگاه</small></article>
        <article className="kpi"><span>مدل‌های مالی</span><b>۰</b><small>محاسبات قابل ثبت و نسخه‌بندی</small></article>
        <article className="kpi"><span>سناریوهای مقایسه‌شده</span><b>۰</b><small>پایه‌ای برای تحلیل عدم‌قطعیت</small></article>
        <article className="kpi"><span>وضعیت ذخیره‌سازی</span><b className="live">{storageInfo.backend}</b><small>اطلاعات روی دستگاه نگهداری می‌شود</small></article>
      </section>

      <section className="section-head"><div><span className="eyebrow">PLATFORM MODULES</span><h2>ماژول‌های پیشران</h2></div><span className="muted">معماری لایه‌ای و توسعه‌پذیر</span></section>
      <section className="module-grid">{modules.map(({icon: Icon,title,sub,status})=><article className="module" key={title}><div className="module-icon"><Icon size={21}/></div><div className="module-text"><b>{title}</b><p>{sub}</p><small>{status}</small></div></article>)}</section>

      <section className="analytics">
        <article className="chart-card"><div className="card-heading"><div><span className="eyebrow">ILLUSTRATIVE DATA</span><h3>نمای نمونه روند بازده</h3></div><span className="tag">داده نمایشی</span></div><ReactECharts option={chart} style={{height:250}}/></article>
        <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><span className="eyebrow">PISHRAN AI COPILOT</span><h3>دستیار تصمیم‌یار سرمایه‌گذاری</h3><p>در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.</p><div className="notice">خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.</div></article>
      </section>
    </>}

    {page === 'projects' && <ProjectsView projects={projects} onCreate={handleCreateProject} onDelete={handleDeleteProject} confirmBeforeDelete={settings.confirmBeforeDelete} onOpenSample={() => setPage('plate-sample')} onOpenProject={project => { setActiveProject(project); setPage('project-wizard') }}/ >}
    {page === 'settings' && <SettingsView settings={settings} storageInfo={storageInfo} onChange={setSettings} onExport={exportBackup} onImport={importBackup}/>}
    {page === 'steel-group' && <SteelGroupWorkspace onOpenHotRolling={() => setPage('hot-rolling')}/>}
    {page === 'hot-rolling' && <HotRollingWorkspace/>}
    {page === 'plate-sample' && <PlateSampleProject/>}
    {page === 'project-wizard' && activeProject && <FeasibilityWizard project={activeProject} onBack={() => setPage('projects')}/ >}

    <footer>پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری <span>نسخه ۱.۰.۱ · بدون نیاز به ورود یا حساب کاربری</span></footer>
  </main>
}
