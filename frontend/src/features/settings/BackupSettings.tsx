import {useEffect,useState} from 'react'
import {CloudDownload,CloudUpload,FolderOpen,RotateCcw,ShieldCheck,Clock,AlertTriangle} from 'lucide-react'
import {backupFolderStatus,backupIntervalMs,canUndoRestore,chooseBackupFolder,getBackupPreferences,parseBackup,restoreBackup,saveBackupFile,saveBackupPreferences,undoLastRestore,updateBackupMeta,type BackupPreferences,type BackupInterval} from '../../core/storage/backupService'

const intervals:{value:BackupInterval;fa:string;en:string}[]=[{value:'15m',fa:'۱۵ دقیقه',en:'15 minutes'},{value:'1h',fa:'۱ ساعت',en:'1 hour'},{value:'6h',fa:'۶ ساعت',en:'6 hours'},{value:'12h',fa:'۱۲ ساعت',en:'12 hours'},{value:'1d',fa:'۱ روز',en:'1 day'},{value:'1w',fa:'۱ هفته',en:'1 week'}]
const formatDate=(v:string,en:boolean)=>v?new Intl.DateTimeFormat(en?'en-US':'fa-IR',{dateStyle:'long',timeStyle:'short'}).format(new Date(v)):(en?'No backup created yet':'هنوز پشتیبانی ساخته نشده است')
const formatSize=(n:number,en:boolean)=>n?new Intl.NumberFormat(en?'en-US':'fa-IR',{maximumFractionDigits:1}).format(n/1024)+' KB':'—'

export default function BackupSettings({onRestored,language='fa'}:{onRestored:()=>Promise<void>|void;language?:'fa'|'en'}){
 const en=language==='en'
 const t=(fa:string,english:string)=>en?english:fa
 const [prefs,setPrefs]=useState<BackupPreferences|null>(null)
 const [folder,setFolder]=useState({hasFolder:false,folderName:''})
 const [undoAvailable,setUndoAvailable]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')

 async function refresh(){const [p,f,u]=await Promise.all([getBackupPreferences(),backupFolderStatus(),canUndoRestore()]);setPrefs(p);setFolder(f);setUndoAvailable(u)}
 useEffect(()=>{void refresh()},[])
 useEffect(()=>{
  const complete=()=>{void refresh();setMessage(t('پشتیبان‌گیری خودکار با موفقیت انجام شد.','Automatic backup completed successfully.'));setError('')}
  const failed=(event:Event)=>{const detail=(event as CustomEvent<string>).detail;setError(detail||t('پشتیبان‌گیری خودکار ناموفق بود.','Automatic backup failed.'))}
  window.addEventListener('pishran-backup-complete',complete)
  window.addEventListener('pishran-backup-error',failed)
  return()=>{window.removeEventListener('pishran-backup-complete',complete);window.removeEventListener('pishran-backup-error',failed)}
 },[])

 async function update(next:Partial<BackupPreferences>){if(!prefs)return;const p={...prefs,...next};setPrefs(p);await saveBackupPreferences(p)}
 async function pickFolder(){setBusy(true);setError('');setMessage('');try{await chooseBackupFolder();await refresh();setMessage(t('پوشه پشتیبان با موفقیت انتخاب شد.','Backup folder selected successfully.'))}catch(e){setError(e instanceof Error?e.message:t('انتخاب پوشه ناموفق بود.','Could not select the folder.'))}finally{setBusy(false)}}
 async function createManual(){setBusy(true);setError('');setMessage('');try{const result=await saveBackupFile('manual');await updateBackupMeta('manual',result.size);await refresh();setMessage(t('فایل پشتیبان با موفقیت ایجاد شد: ','Backup file created successfully: ')+result.fileName)}catch(e){setError(e instanceof Error?e.message:t('ایجاد فایل پشتیبان ناموفق بود.','Could not create the backup file.'))}finally{setBusy(false)}}
 async function restoreFile(file:File){setBusy(true);setError('');setMessage('');try{const payload=parseBackup(await file.text());if(!window.confirm(t('تمام داده‌های فعلی پیشران با اطلاعات این فایل جایگزین می‌شوند. پیش از جایگزینی، نسخه اضطراری ساخته می‌شود. ادامه می‌دهید؟','All current Pishran data will be replaced by this file. An emergency backup will be created first. Continue?')))return;const count=await restoreBackup(payload);await onRestored();await refresh();setMessage(t('بازیابی با موفقیت انجام شد؛ ','Restore completed successfully; ')+count.toLocaleString(en?'en-US':'fa-IR')+t(' رکورد بازگردانی شد. امکان لغو آخرین بازیابی فراهم است.',' records restored. You can undo the latest restore.'))}catch(e){setError(e instanceof Error?e.message:t('بازیابی فایل ناموفق بود.','Could not restore the backup file.'))}finally{setBusy(false)}}
 async function undo(){if(!window.confirm(t('وضعیت پیشران به نسخه‌ای که بلافاصله پیش از آخرین بازیابی وجود داشت بازگردد؟','Restore Pishran to the state immediately before the latest restore?')))return;setBusy(true);setError('');try{const count=await undoLastRestore();await onRestored();await refresh();setMessage(t('بازیابی قبلی لغو شد؛ ','Previous restore undone; ')+count.toLocaleString(en?'en-US':'fa-IR')+t(' رکورد بازگردانده شد.',' records reverted.'))}catch(e){setError(e instanceof Error?e.message:t('لغو بازیابی ناموفق بود.','Could not undo the restore.'))}finally{setBusy(false)}}
 if(!prefs)return <article className="settings-card storage-card"><p>{t('در حال بارگذاری تنظیمات پشتیبان...','Loading backup settings...')}</p></article>
 const lastLabel=prefs.lastAt?formatDate(prefs.lastAt,en):t('هنوز پشتیبانی ساخته نشده است','No backup created yet')
 return <article className="settings-card storage-card backup-manager">
  <div className="settings-card-title"><span className="settings-symbol"><ShieldCheck size={20}/></span><div><b>{t('پشتیبان‌گیری و بازیابی داده‌ها','Data Backup & Restore')}</b><small>{t('پشتیبان کامل اطلاعات محلی پروژه‌های پیشران','Complete backup of Pishran's local project data')}</small></div></div>
  <p className="backup-description">{t('پشتیبان شامل تمام رکوردهای ذخیره‌شده برنامه است: پروژه‌ها، فرم‌های مهندسی و تولید، موازنه مواد، یوتیلیتی‌ها، هزینه‌های سرمایه‌گذاری و بهره‌برداری، مفروضات مالی، تسهیلات، جریان نقدی، تنظیمات و سایر داده‌های محلی.','The backup includes all app records: projects, engineering and production forms, material balances, utilities, CAPEX and OPEX, financial assumptions, loans, cash flows, settings and other local data.')}</p>
  <div className="backup-action-grid">
   <label className="backup-action"><span className="backup-action-icon"><CloudDownload size={21}/></span><span><b>{t('بازیابی فایل پشتیبان','Restore Backup File')}</b><small>{t('وارد کردن و جایگزینی داده‌های برنامه','Import and replace app data')}</small></span><input type="file" accept="application/json,.json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void restoreFile(f);e.currentTarget.value=''}}/></label>
   <button className="backup-action" type="button" disabled={busy} onClick={()=>void createManual()}><span className="backup-action-icon"><CloudUpload size={21}/></span><span><b>{t('ایجاد فایل پشتیبان','Create Backup File')}</b><small>{t('خروجی کامل داده‌ها با قالب JSON','Full data export in JSON format')}</small></span></button>
  </div>
   <div className="backup-last"><span className="backup-ok">✓</span><div><b>{prefs.lastKind==='automatic'?t('آخرین پشتیبان خودکار','Last automatic backup'):t('آخرین پشتیبان','Last backup')}</b><small>{lastLabel} · {formatSize(prefs.lastSize,en)}</small></div></div>
   <div className="backup-folder-row"><div><b>{t('پوشه ذخیره فایل پشتیبان','Backup Folder')}</b><small>{folder.folderName||prefs.folderName||t('هنوز پوشه‌ای انتخاب نشده است','No folder selected')}</small></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void pickFolder()}><FolderOpen size={15}/> {t('انتخاب پوشه','Choose Folder')}</button></div>
   <p className="backup-help">{en?<>On Android, choose <b>Download/Pishran-Backups</b>. Folder permission is saved persistently and files can be viewed in the Files app. On the web, folder selection depends on browser support.</>:<>در نسخه نصب‌شده اندروید، پوشه <b>Download/Pishran-Backups</b> را انتخاب کنید. مجوز پوشه به‌صورت پایدار ذخیره می‌شود و فایل‌ها با برنامه Files قابل مشاهده‌اند. در نسخه وب، انتخاب پوشه به پشتیبانی مرورگر از دسترسی فایل وابسته است.</>}</p>
  {undoAvailable&&<button type="button" className="backup-undo" disabled={busy} onClick={()=>void undo()}><RotateCcw size={16}/> {t('لغو آخرین بازیابی (بازگرداندن وضعیت قبل از آن)','Undo Latest Restore (return to previous state)')}</button>}
  <div className="backup-auto">
   <div className="backup-auto-heading"><span><Clock size={17}/></span><div><b>{t('پشتیبان‌گیری خودکار','Automatic Backup')}</b><small>{t('هنگام باز بودن برنامه و در مراجعه بعدی، موعد پشتیبان بررسی می‌شود.','The backup schedule is checked while Pishran is open and on the next visit.')}</small></div><input type="checkbox" checked={prefs.enabled} onChange={e=>void update({enabled:e.target.checked})}/></div>
   <label className="backup-interval"><span>{t('بازه زمانی تکرار پشتیبان‌گیری','Backup interval')}</span><select value={prefs.interval} onChange={e=>void update({interval:e.target.value as BackupInterval})}>{intervals.map(x=><option key={x.value} value={x.value}>{en?x.en:x.fa}</option>)}</select></label>
   <div className="backup-folder-row"><div><b>{t('مسیر ذخیره‌سازی خودکار','Automatic backup location')}</b><small>{folder.folderName||'Download/Pishran-Backups'} · {t('نگهداری آخرین ۸ فایل','Keep the latest 8 files')}</small></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void pickFolder()}><FolderOpen size={15}/> {t('انتخاب پوشه','Choose Folder')}</button></div>
   {!folder.hasFolder&&prefs.enabled&&<div className="backup-warning"><AlertTriangle size={16}/> {t('برای اجرای پشتیبان خودکار، ابتدا پوشه ذخیره‌سازی را انتخاب کنید.','Choose a backup folder to enable automatic backups.')}</div>}
   <p className="backup-help">{t('پشتیبان خودکار فقط وقتی پیشران باز است یا هنگام باز شدن بعدی اجرا می‌شود؛ اجرای زمان‌بندی‌شده در حالت بسته بودن برنامه تضمین نمی‌شود. اگر مرورگر مجوز پوشه را از دست بدهد، باید دوباره انتخاب و تأیید شود.','Automatic backup runs only while Pishran is open or on the next launch; it is not guaranteed while the app is closed. If the browser loses folder permission, select and approve the folder again.')}</p>
  </div>
  {message&&<div className="backup-message">{message}</div>}
  {error&&<div className="backup-error">{error}</div>}
  {busy&&<div className="backup-busy">{t('در حال انجام عملیات پشتیبان‌گیری...','Backup operation in progress...')}</div>}
 </article>
}
