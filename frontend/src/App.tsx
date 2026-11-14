import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Activity, Bot, Factory, FileChartColumn, Gauge, Globe2, Layers3, Plus, ShieldCheck, TrendingUp } from 'lucide-react'
import { getHealth } from './api'

const modules = [
  { icon: Factory, title: 'مهندسی و طراحی فرآیند', sub: 'ظرفیت، توازن مواد، انرژی و تجهیزات', status: 'در نقشه راه' },
  { icon: Globe2, title: 'هوشمندی بازار', sub: 'عرضه، تقاضا، قیمت و رقبا', status: 'در نقشه راه' },
  { icon: TrendingUp, title: 'مدل مالی و اقتصادی', sub: 'NPV، IRR، جریان نقدی و تأمین مالی', status: 'نمونه اولیه' },
  { icon: Activity, title: 'ریسک و سناریو', sub: 'حساسیت، سناریو و مونت‌کارلو', status: 'در نقشه راه' },
  { icon: Bot, title: 'دستیار هوش مصنوعی', sub: 'تحلیل مستند و پاسخ‌گویی به سرمایه‌گذار', status: 'در نقشه راه' },
  { icon: FileChartColumn, title: 'گزارش سرمایه‌گذاری', sub: 'گزارش مدیریتی، بانکی و سرمایه‌گذار', status: 'در نقشه راه' },
]

export default function App() {
  const [apiStatus, setApiStatus] = useState('در حال بررسی')
  useEffect(() => { getHealth().then(() => setApiStatus('متصل')).catch(() => setApiStatus('آفلاین / تنظیم‌نشده')) }, [])

  const chart = {
    tooltip: { trigger: 'axis' },
    grid: { left: 12, right: 12, top: 24, bottom: 20, containLabel: true },
    xAxis: { type: 'category', data: ['سال ۱', 'سال ۲', 'سال ۳', 'سال ۴', 'سال ۵'], axisLine: { lineStyle: { color: '#cbd5e1' } } },
    yAxis: { type: 'value', axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#edf0f4' } } },
    series: [{ name: 'بازده نمونه', type: 'line', smooth: true, data: [8, 12, 16, 19, 23], areaStyle: { opacity: .08 }, lineStyle: { width: 3 }, symbolSize: 8 }]
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><div className="brandmark">پ</div><div><b>پیشران</b><small>INTELLIGENT FEASIBILITY PLATFORM</small></div></div>
      <div className="top-actions"><span className="connection"><i /> {apiStatus}</span><button className="avatar">P</button></div>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">INVESTMENT DECISION INTELLIGENCE</span>
        <h1>از ایده تا تصمیم سرمایه‌گذاری، <em>با اطمینان بیشتر.</em></h1>
        <p>محیط یکپارچه برای امکان‌سنجی، طراحی مهندسی، تحلیل بازار، مدل‌سازی مالی و ارزیابی ریسک پروژه‌ها.</p>
        <button className="primary"><Plus size={18}/> ایجاد پروژه جدید</button>
      </div>
      <div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-icon"><Layers3 size={48}/></div><span className="floating f1"><Gauge/> تحلیل اقتصادی</span><span className="floating f2"><ShieldCheck/> ارزیابی ریسک</span></div>
    </section>

    <section className="section-head"><div><span className="eyebrow">WORKSPACE</span><h2>مرکز کنترل سرمایه‌گذاری</h2></div><span className="muted">نسخه پایه ۰.۱</span></section>
    <section className="kpis">
      <article className="kpi"><span>پروژه‌های فعال</span><b>۰</b><small>فضای کاری آماده ایجاد پروژه</small></article>
      <article className="kpi"><span>مدل‌های مالی</span><b>۰</b><small>محاسبات قابل ثبت و نسخه‌بندی</small></article>
      <article className="kpi"><span>سناریوهای مقایسه‌شده</span><b>۰</b><small>پایه‌ای برای تحلیل عدم‌قطعیت</small></article>
      <article className="kpi"><span>وضعیت سامانه</span><b className="live">آماده توسعه</b><small>رابط PWA بارگذاری شده است</small></article>
    </section>

    <section className="section-head"><div><span className="eyebrow">PLATFORM MODULES</span><h2>ماژول‌های پیشران</h2></div><span className="muted">معماری توسعه‌پذیر</span></section>
    <section className="module-grid">{modules.map(({icon: Icon,title,sub,status})=><article className="module" key={title}><div className="module-icon"><Icon size={21}/></div><div className="module-text"><b>{title}</b><p>{sub}</p><small>{status}</small></div></article>)}</section>

    <section className="analytics">
      <article className="chart-card"><div className="card-heading"><div><span className="eyebrow">ILLUSTRATIVE DATA</span><h3>نمای نمونه روند بازده</h3></div><span className="tag">داده نمایشی</span></div><ReactECharts option={chart} style={{height:250}}/></article>
      <article className="insight-card"><div className="module-icon gold"><Bot size={23}/></div><span className="eyebrow">PISHRAN AI COPILOT</span><h3>دستیار تصمیم‌یار سرمایه‌گذاری</h3><p>در نسخه‌های بعدی، پیشران می‌تواند مفروضات را بررسی کند، ریسک‌ها را توضیح دهد و نتایج را با ارجاع به منابع داده تحلیل کند.</p><div className="notice">خروجی‌های این نسخه نمایشی هستند و مبنای تصمیم واقعی سرمایه‌گذاری نیستند.</div></article>
    </section>
    <footer>پیشران · سامانه هوشمند امکان‌سنجی و ارزیابی سرمایه‌گذاری <span>ساخته‌شده برای توسعه تدریجی و قابل ممیزی</span></footer>
  </main>
}
