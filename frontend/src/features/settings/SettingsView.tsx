import type { AppSettings } from '../../core/settings/settings'

interface Props {
  settings: AppSettings
  storageInfo: { backend: string; items: number }
  onChange: (next: AppSettings) => void
  onExport: () => void
  onImport: (file: File) => void
}

export default function SettingsView({ settings, storageInfo, onChange, onExport, onImport }: Props) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })

  return <section className="settings-page">
    <div className="page-heading"><div><span className="eyebrow">PREFERENCES & LOCAL DATA</span><h1>تنظیمات پیشران</h1><p>ظاهر، رفتار برنامه و مدیریت اطلاعات روی همین دستگاه</p></div></div>

    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">◐</span><div><b>نمایش و ظاهر</b><small>پوسته و رنگ محیط برنامه</small></div></div>
        <label className="setting-row"><span>حالت نمایش</span><select value={settings.themeMode} onChange={e => update('themeMode', e.target.value as AppSettings['themeMode'])}><option value="light">روشن</option><option value="dark">تیره</option><option value="system">مطابق دستگاه</option></select></label>
        <label className="setting-row"><span>رنگ اصلی</span><select value={settings.accentTheme} onChange={e => update('accentTheme', e.target.value as AppSettings['accentTheme'])}><option value="navy">سرمه‌ای</option><option value="gold">طلایی</option><option value="emerald">زمردی</option><option value="graphite">گرافیتی</option></select></label>
        <label className="setting-row"><span>چیدمان فشرده</span><input type="checkbox" checked={settings.compactMode} onChange={e => update('compactMode', e.target.checked)}/></label>
      </article>

      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">⚙</span><div><b>رفتار برنامه</b><small>گزینه‌های عمومی و ایمنی</small></div></div>
        <label className="setting-row"><span>تأیید پیش از حذف اطلاعات</span><input type="checkbox" checked={settings.confirmBeforeDelete} onChange={e => update('confirmBeforeDelete', e.target.checked)}/></label>
        <label className="setting-row"><span>پشتیبان‌گیری خودکار هنگام خروجی گرفتن</span><input type="checkbox" checked={settings.autoBackup} onChange={e => update('autoBackup', e.target.checked)}/></label>
        <label className="setting-row"><span>زبان برنامه</span><select value={settings.language} onChange={e => update('language', e.target.value as AppSettings['language'])}><option value="fa">فارسی</option><option value="en">English</option></select></label>
      </article>

      <article className="settings-card storage-card">
        <div className="settings-card-title"><span className="settings-symbol">▣</span><div><b>ذخیره‌سازی و پشتیبان</b><small>اطلاعات پروژه‌ها روی دستگاه شما نگهداری می‌شود</small></div></div>
        <div className="storage-status"><span className="status-dot"/><div><b>ذخیره‌سازی محلی فعال است</b><small>{storageInfo.backend} · {storageInfo.items} مورد داده</small></div></div>
        <p className="settings-note">در این نسخه ورود کاربری و همگام‌سازی ابری غیرفعال است. داده‌ها در مرورگر یا حافظه داخلی برنامه ذخیره می‌شوند؛ پاک‌کردن داده‌های مرورگر یا حذف برنامه ممکن است آن‌ها را حذف کند.</p>
        <div className="backup-actions"><button className="primary" onClick={onExport}>دریافت فایل پشتیبان</button><label className="secondary-button">بازیابی فایل پشتیبان<input type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if (file) onImport(file); e.currentTarget.value = '' }}/></label></div>
      </article>
    </div>
    <div className="local-only-note"><b>حریم خصوصی:</b> در حالت محلی، اطلاعات پروژه‌ها برای ورود به حساب یا سرور ارسال نمی‌شوند.</div>
  </section>
}
