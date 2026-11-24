import type { AppSettings } from '../../core/settings/settings'
import { Mail } from 'lucide-react'
import BackupSettings from './BackupSettings'

interface Props {
  settings: AppSettings
  storageInfo: { backend: string; items: number }
  onChange: (next: AppSettings) => void
  onRestored: () => Promise<void>|void
}

export default function SettingsView({ settings, storageInfo, onChange, onRestored }: Props) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })
  const en = settings.language === 'en'

  return <section className="settings-page">
    <div className="page-heading"><div><h1>{en ? 'Pishran Settings' : 'تنظیمات پیشران'}</h1><p>{en ? 'Appearance, app behaviour and on-device data management' : 'ظاهر، رفتار برنامه و مدیریت اطلاعات روی همین دستگاه'}</p></div></div>

    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">◐</span><div><b>{en ? 'Display & Appearance' : 'نمایش و ظاهر'}</b><small>{en ? 'App theme and accent colour' : 'پوسته و رنگ محیط برنامه'}</small></div></div>
        <label className="setting-row"><span>{en ? 'Display mode' : 'حالت نمایش'}</span><select value={settings.themeMode} onChange={e => update('themeMode', e.target.value as AppSettings['themeMode'])}><option value="light">{en ? 'Light' : 'روشن'}</option><option value="dark">{en ? 'Dark' : 'تیره'}</option><option value="system">{en ? 'System' : 'مطابق دستگاه'}</option></select></label>
        <label className="setting-row"><span>{en ? 'Accent colour' : 'رنگ اصلی'}</span><select value={settings.accentTheme} onChange={e => update('accentTheme', e.target.value as AppSettings['accentTheme'])}><option value="navy">{en ? 'Soft teal (default)' : 'سبزآبی ملایم (پیش‌فرض)'}</option><option value="emerald">{en ? 'Sage green' : 'سبز مریم‌گلی'}</option><option value="gold">{en ? 'Warm sand' : 'شن روشن'}</option><option value="graphite">{en ? 'Slate grey' : 'خاکستری سنگی'}</option></select></label>
        <label className="setting-row"><span>{en ? 'Font directory' : 'انتخاب فونت'}</span><select value={settings.fontTheme ?? 'vazirmatn'} onChange={e => update('fontTheme', e.target.value as AppSettings['fontTheme'])}>
          <option value="vazirmatn">Vazirmatn — وزیرمتن</option>
          <option value="tahoma">Tahoma — تاهوما</option>
          <option value="arial">Arial — آریال</option>
          <option value="system">{en ? 'System default' : 'فونت پیش‌فرض دستگاه'}</option>
          <option value="noto">Noto Sans Arabic — نوتو نسخ عربی</option>
          <option value="sahel">Sahel — ساحل</option>
          <option value="shabnam">Shabnam — شبنم</option>
          <option value="samim">Samim — صمیم</option>
          <option value="nazanin">B Nazanin — نازنین</option>
          <option value="titr">B Titr — تیتر</option>
          <option value="inter">Inter — English</option>
          <option value="roboto">Roboto — English</option>
          <option value="opensans">Open Sans — English</option>
          <option value="lato">Lato — English</option>
          <option value="montserrat">Montserrat — English</option>
          <option value="poppins">Poppins — English</option>
          <option value="serif">{en ? 'Serif' : 'سریف (با دندانه)'}</option>
          <option value="mono">{en ? 'Monospace' : 'تک‌فاصله (Monospace)'}</option>
        </select></label>
        <p className="font-directory-note">{en ? 'Includes Persian and English font families. B Nazanin and B Titr require local installation; web fonts load from Google Fonts.' : 'فهرست شامل فونت‌های فارسی و انگلیسی است. نازنین و تیتر در صورت نصب بودن روی دستگاه نمایش داده می‌شوند؛ فونت‌های وب از Google Fonts بارگذاری می‌شوند.'}</p>
        <label className="setting-row"><span>{en ? 'Background palette' : 'رنگ زمینه'}</span><select value={settings.backgroundTheme ?? 'bluegray'} onChange={e => update('backgroundTheme', e.target.value as AppSettings['backgroundTheme'])}>
          <option value="bluegray">{en ? 'Blue grey' : 'آبی خاکستری'}</option>
          <option value="mist">{en ? 'Cool mist' : 'مه‌آلود روشن'}</option>
          <option value="sage">{en ? 'Soft sage' : 'سبز مریم‌گلی روشن'}</option>
          <option value="sand">{en ? 'Warm sand' : 'شن روشن'}</option>
          <option value="sky">{en ? 'Pale sky' : 'آسمانی ملایم'}</option>
          <option value="lavender">{en ? 'Soft lavender' : 'یاسی ملایم'}</option>
        </select></label>
        <label className="setting-row"><span>{en ? 'Compact layout' : 'چیدمان فشرده'}</span><input type="checkbox" checked={settings.compactMode} onChange={e => update('compactMode', e.target.checked)}/></label>
      </article>

      <BackupSettings language={settings.language} settings={settings} onChange={onChange} onRestored={onRestored}/>
    </div>
    <div className="local-only-note"><b>{en ? 'Privacy:' : 'حریم خصوصی:'}</b> {en ? 'In local mode, project data is not sent to an account or server.' : 'در حالت محلی، اطلاعات پروژه‌ها برای ورود به حساب یا سرور ارسال نمی‌شوند.'}</div>
    <article className="settings-card settings-support-card">
      <div className="settings-card-title"><span className="settings-symbol"><Mail size={18}/></span><div><b>{en ? 'Contact Support' : 'تماس با پشتیبان'}</b><small>{en ? 'Get help with Pishran' : 'برای دریافت راهنمایی و پشتیبانی پیشران'}</small></div></div>
      <a className="setting-row" href="mailto:pishranfeasibiltystudy@gmail.com"><span>{en ? 'Send an email' : 'ارسال ایمیل به پشتیبانی'}</span><b dir="ltr">pishranfeasibiltystudy@gmail.com</b></a>
    </article>
  </section>
}
