import type { AppSettings } from '../../core/settings/settings'
import BackupSettings from './BackupSettings'

interface Props {
  settings: AppSettings
  storageInfo: { backend: string; items: number }
  onChange: (next: AppSettings) => void
  onRestored: () => Promise<void>|void
}

export default function SettingsView({ settings, storageInfo, onChange, onRestored }: Props) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })

  return <section className="settings-page">
    <div className="page-heading"><div><span className="eyebrow">PREFERENCES & LOCAL DATA</span><h1>تنظیمات پیشران</h1><p>ظاهر، رفتار برنامه و مدیریت اطلاعات روی همین دستگاه</p></div></div>

    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">◐</span><div><b>نمایش و ظاهر</b><small>پوسته و رنگ محیط برنامه</small></div></div>
        <label className="setting-row"><span>حالت نمایش</span><select value={settings.themeMode} onChange={e => update('themeMode', e.target.value as AppSettings['themeMode'])}><option value="light">روشن</option><option value="dark">تیره</option><option value="system">مطابق دستگاه</option></select></label>
        <label className="setting-row"><span>رنگ اصلی</span><select value={settings.accentTheme} onChange={e => update('accentTheme', e.target.value as AppSettings['accentTheme'])}><option value="navy">آبی Word (پیش‌فرض)</option><option value="emerald">سبز Excel</option><option value="gold">نارنجی PowerPoint</option><option value="graphite">بنفش OneNote</option></select></label>
        <label className="setting-row"><span>چیدمان فشرده</span><input type="checkbox" checked={settings.compactMode} onChange={e => update('compactMode', e.target.checked)}/></label>
      </article>

      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">⚙</span><div><b>رفتار برنامه</b><small>گزینه‌های عمومی و ایمنی</small></div></div>
        <label className="setting-row"><span>تأیید پیش از حذف اطلاعات</span><input type="checkbox" checked={settings.confirmBeforeDelete} onChange={e => update('confirmBeforeDelete', e.target.checked)}/></label>
        <label className="setting-row"><span>پشتیبان‌گیری خودکار هنگام خروجی گرفتن</span><input type="checkbox" checked={settings.autoBackup} onChange={e => update('autoBackup', e.target.checked)}/></label>
        <label className="setting-row"><span>زبان برنامه</span><select value={settings.language} onChange={e => update('language', e.target.value as AppSettings['language'])}><option value="fa">فارسی</option><option value="en">English</option></select></label>
      </article>

      <BackupSettings onRestored={onRestored}/>
    </div>
    <div className="local-only-note"><b>حریم خصوصی:</b> در حالت محلی، اطلاعات پروژه‌ها برای ورود به حساب یا سرور ارسال نمی‌شوند.</div>
  </section>
}
