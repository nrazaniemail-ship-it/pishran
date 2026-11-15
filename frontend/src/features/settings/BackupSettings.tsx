import {useEffect,useState} from 'react'
import {CloudDownload,CloudUpload,FolderOpen,RotateCcw,ShieldCheck,Clock,AlertTriangle} from 'lucide-react'
import {backupFolderStatus,backupIntervalMs,canUndoRestore,chooseBackupFolder,getBackupPreferences,parseBackup,restoreBackup,saveBackupFile,saveBackupPreferences,undoLastRestore,updateBackupMeta,type BackupPreferences,type BackupInterval} from '../../core/storage/backupService'

const intervals:{value:BackupInterval;label:string}[]=[{value:'15m',label:'۱۵ دقیقه'},{value:'1h',label:'۱ ساعت'},{value:'6h',label:'۶ ساعت'},{value:'12h',label:'۱۲ ساعت'},{value:'1d',label:'۱ روز'},{value:'1w',label:'۱ هفته'}]
const formatDate=(v:string)=>v?new Intl.DateTimeFormat('fa-IR',{dateStyle:'long',timeStyle:'short'}).format(new Date(v)):'هنوز پشتیبانی ساخته نشده است'
const formatSize=(n:number)=>n?new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(n/1024)+' KB':'—'

export default function BackupSettings({onRestored}:{onRestored:()=>Promise<void>|void}){
 const [prefs,setPrefs]=useState<BackupPreferences|null>(null)
 const [folder,setFolder]=useState({hasFolder:false,folderName:''})
 const [undoAvailable,setUndoAvailable]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')

 async function refresh(){const [p,f,u]=await Promise.all([getBackupPreferences(),backupFolderStatus(),canUndoRestore()]);setPrefs(p);setFolder(f);setUndoAvailable(u)}
 useEffect(()=>{void refresh()},[])
 useEffect(()=>{
  const complete=()=>{void refresh();setMessage('پشتیبان‌گیری خودکار با موفقیت انجام شد.');setError('')}
  const failed=(event:Event)=>{const detail=(event as CustomEvent<string>).detail;setError(detail||'پشتیبان‌گیری خودکار ناموفق بود.')}
  window.addEventListener('pishran-backup-complete',complete)
  window.addEventListener('pishran-backup-error',failed)
  return()=>{window.removeEventListener('pishran-backup-complete',complete);window.removeEventListener('pishran-backup-error',failed)}
 },[])

 async function update(next:Partial<BackupPreferences>){if(!prefs)return;const p={...prefs,...next};setPrefs(p);await saveBackupPreferences(p)}
 async function pickFolder(){setBusy(true);setError('');setMessage('');try{await chooseBackupFolder();await refresh();setMessage('پوشه پشتیبان با موفقیت انتخاب شد.')}catch(e){setError(e instanceof Error?e.message:'انتخاب پوشه ناموفق بود.')}finally{setBusy(false)}}
 async function createManual(){setBusy(true);setError('');setMessage('');try{const result=await saveBackupFile('manual');await updateBackupMeta('manual',result.size);await refresh();setMessage('فایل پشتیبان با موفقیت ایجاد شد: '+result.fileName)}catch(e){setError(e instanceof Error?e.message:'ایجاد فایل پشتیبان ناموفق بود.')}finally{setBusy(false)}}
 async function restoreFile(file:File){setBusy(true);setError('');setMessage('');try{const payload=parseBackup(await file.text());if(!window.confirm('تمام داده‌های فعلی پیشران با اطلاعات این فایل جایگزین می‌شوند. پیش از جایگزینی، نسخه اضطراری ساخته می‌شود. ادامه می‌دهید؟'))return;const count=await restoreBackup(payload);await onRestored();await refresh();setMessage('بازیابی با موفقیت انجام شد؛ '+count.toLocaleString('fa-IR')+' رکورد بازگردانی شد. امکان لغو آخرین بازیابی فراهم است.')}catch(e){setError(e instanceof Error?e.message:'بازیابی فایل ناموفق بود.')}finally{setBusy(false)}}
 async function undo(){if(!window.confirm('وضعیت پیشران به نسخه‌ای که بلافاصله پیش از آخرین بازیابی وجود داشت بازگردد؟'))return;setBusy(true);setError('');try{const count=await undoLastRestore();await onRestored();await refresh();setMessage('بازیابی قبلی لغو شد؛ '+count.toLocaleString('fa-IR')+' رکورد بازگردانده شد.')}catch(e){setError(e instanceof Error?e.message:'لغو بازیابی ناموفق بود.')}finally{setBusy(false)}}
 if(!prefs)return <article className="settings-card storage-card"><p>در حال بارگذاری تنظیمات پشتیبان...</p></article>
 const lastLabel=prefs.lastAt?formatDate(prefs.lastAt):'هنوز پشتیبانی ساخته نشده است'
 return <article className="settings-card storage-card backup-manager">
  <div className="settings-card-title"><span className="settings-symbol"><ShieldCheck size={20}/></span><div><b>پشتیبان‌گیری و بازیابی داده‌ها</b><small>پشتیبان کامل اطلاعات محلی پروژه‌های پیشران</small></div></div>
  <p className="backup-description">پشتیبان شامل تمام رکوردهای ذخیره‌شده برنامه است: پروژه‌ها، فرم‌های مهندسی و تولید، موازنه مواد، یوتیلیتی‌ها، هزینه‌های سرمایه‌گذاری و بهره‌برداری، مفروضات مالی، تسهیلات، جریان نقدی، تنظیمات و سایر داده‌های محلی.</p>
  <div className="backup-action-grid">
   <label className="backup-action"><span className="backup-action-icon"><CloudDownload size={21}/></span><span><b>بازیابی فایل پشتیبان</b><small>وارد کردن و جایگزینی داده‌های برنامه</small></span><input type="file" accept="application/json,.json" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void restoreFile(f);e.currentTarget.value=''}}/></label>
   <button className="backup-action" type="button" disabled={busy} onClick={()=>void createManual()}><span className="backup-action-icon"><CloudUpload size={21}/></span><span><b>ایجاد فایل پشتیبان</b><small>خروجی کامل داده‌ها با قالب JSON</small></span></button>
  </div>
  <div className="backup-last"><span className="backup-ok">✓</span><div><b>{prefs.lastKind==='automatic'?'آخرین پشتیبان خودکار':'آخرین پشتیبان'}</b><small>{lastLabel} · {formatSize(prefs.lastSize)}</small></div></div>
  <div className="backup-folder-row"><div><b>پوشه ذخیره فایل پشتیبان</b><small>{folder.folderName||prefs.folderName||'هنوز پوشه‌ای انتخاب نشده است'}</small></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void pickFolder()}><FolderOpen size={15}/> انتخاب پوشه</button></div>
  <p className="backup-help">در نسخه نصب‌شده اندروید، پوشه <b>Download/Pishran-Backups</b> را انتخاب کنید. مجوز پوشه به‌صورت پایدار ذخیره می‌شود و فایل‌ها با برنامه Files قابل مشاهده‌اند. در نسخه وب، انتخاب پوشه به پشتیبانی مرورگر از دسترسی فایل وابسته است.</p>
  {undoAvailable&&<button type="button" className="backup-undo" disabled={busy} onClick={()=>void undo()}><RotateCcw size={16}/> لغو آخرین بازیابی (بازگرداندن وضعیت قبل از آن)</button>}
  <div className="backup-auto">
   <div className="backup-auto-heading"><span><Clock size={17}/></span><div><b>پشتیبان‌گیری خودکار</b><small>هنگام باز بودن برنامه و در مراجعه بعدی، موعد پشتیبان بررسی می‌شود.</small></div><input type="checkbox" checked={prefs.enabled} onChange={e=>void update({enabled:e.target.checked})}/></div>
   <label className="backup-interval"><span>بازه زمانی تکرار پشتیبان‌گیری</span><select value={prefs.interval} onChange={e=>void update({interval:e.target.value as BackupInterval})}>{intervals.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
   <div className="backup-folder-row"><div><b>مسیر ذخیره‌سازی خودکار</b><small>{folder.folderName||'Download/Pishran-Backups'} · نگهداری آخرین ۸ فایل</small></div><button type="button" className="secondary-button" disabled={busy} onClick={()=>void pickFolder()}><FolderOpen size={15}/> انتخاب پوشه</button></div>
   {!folder.hasFolder&&prefs.enabled&&<div className="backup-warning"><AlertTriangle size={16}/> برای اجرای پشتیبان خودکار، ابتدا پوشه ذخیره‌سازی را انتخاب کنید.</div>}
   <p className="backup-help">پشتیبان خودکار فقط وقتی پیشران باز است یا هنگام باز شدن بعدی اجرا می‌شود؛ اجرای زمان‌بندی‌شده در حالت بسته بودن برنامه تضمین نمی‌شود. اگر مرورگر مجوز پوشه را از دست بدهد، باید دوباره انتخاب و تأیید شود.</p>
  </div>
  {message&&<div className="backup-message">{message}</div>}
  {error&&<div className="backup-error">{error}</div>}
  {busy&&<div className="backup-busy">در حال انجام عملیات پشتیبان‌گیری...</div>}
 </article>
}
