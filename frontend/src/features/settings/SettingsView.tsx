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
  const en = settings.language === 'en'

  return <section className="settings-page">
    <div className="page-heading"><div><h1>{en ? 'Pishran Settings' : 'تنظیمات پیشران'}</h1><p>{en ? 'Appearance, app behaviour and on-device data management' : 'ظاهر، رفتار برنامه و مدیریت اطلاعات روی همین دستگاه'}</p></div></div>

    <div className="settings-grid">
      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">◐</span><div><b>{en ? 'Display & Appearance' : 'نمایش و ظاهر'}</b><small>{en ? 'App theme and accent colour' : 'پوسته و رنگ محیط برنامه'}</small></div></div>
        <label className="setting-row"><span>{en ? 'Display mode' : 'حالت نمایش'}</span><select value={settings.themeMode} onChange={e => update('themeMode', e.target.value as AppSettings['themeMode'])}><option value="light">{en ? 'Light' : 'روشن'}</option><option value="dark">{en ? 'Dark' : 'تیره'}</option><option value="system">{en ? 'System' : 'مطابق دستگاه'}</option></select></label>
        <label className="setting-row"><span>{en ? 'Accent colour' : 'رنگ اصلی'}</span><select value={settings.accentTheme} onChange={e => update('accentTheme', e.target.value as AppSettings['accentTheme'])}><option value="navy">{en ? 'Soft teal (default)' : 'سبزآبی ملایم (پیش‌فرض)'}</option><option value="emerald">{en ? 'Sage green' : 'سبز مریم‌گلی'}</option><option value="gold">{en ? 'Warm sand' : 'شن روشن'}</option><option value="graphite">{en ? 'Slate grey' : 'خاکستری سنگی'}</option></select></label>
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

      <article className="settings-card">
        <div className="settings-card-title"><span className="settings-symbol">⚙</span><div><b>{en ? 'App Behaviour' : 'رفتار برنامه'}</b><small>{en ? 'General and safety options' : 'گزینه‌های عمومی و ایمنی'}</small></div></div>
        <label className="setting-row"><span>{en ? 'Confirm before deleting data' : 'تأیید پیش از حذف اطلاعات'}</span><input type="checkbox" checked={settings.confirmBeforeDelete} onChange={e => update('confirmBeforeDelete', e.target.checked)}/></label>
        <label className="setting-row"><span>{en ? 'Back up automatically when exporting' : 'پشتیبان‌گیری خودکار هنگام خروجی گرفتن'}</span><input type="checkbox" checked={settings.autoBackup} onChange={e => update('autoBackup', e.target.checked)}/></label>
        <label className="setting-row"><span>{en ? 'Application language' : 'زبان برنامه'}</span><select value={settings.language} onChange={e => update('language', e.target.value as AppSettings['language'])}><option value="fa">{en ? 'Persian' : 'فارسی'}</option><option value="en">English</option></select></label>
      </article>

      <BackupSettings language={settings.language} onRestored={onRestored}/>
    </div>
    <div className="local-only-note"><b>{en ? 'Privacy:' : 'حریم خصوصی:'}</b> {en ? 'In local mode, project data is not sent to an account or server.' : 'در حالت محلی، اطلاعات پروژه‌ها برای ورود به حساب یا سرور ارسال نمی‌شوند.'}</div>
  </section>
}
