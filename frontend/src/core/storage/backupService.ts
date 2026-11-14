import { localStore } from './localStore'

export type BackupInterval = '15m' | '1h' | '6h' | '12h' | '1d' | '1w'
export interface BackupPreferences { enabled: boolean; interval: BackupInterval; lastAt: string; lastSize: number; lastKind: 'manual'|'automatic'|''; folderName: string; }
const PREF_KEY='pishran_backup_preferences_v1'
const HANDLE_DB='pishran_backup_handles'
const HANDLE_STORE='handles'
const UNDO_KEY='pishran_restore_undo_v1'
const INTERVALS:Record<BackupInterval,number>={ '15m':900000,'1h':3600000,'6h':21600000,'12h':43200000,'1d':86400000,'1w':604800000 }
const DEFAULTS:BackupPreferences={enabled:false,interval:'1d',lastAt:'',lastSize:0,lastKind:'',folderName:''}
type BackupRecord={key:string;value:unknown}
export type PishranBackup={app:'Pishran';schema:number;exportedAt:string;records:BackupRecord[];backupPreferences?:{enabled:boolean;interval:BackupInterval}}

function openHandleDb():Promise<IDBDatabase|null>{
 if(typeof indexedDB==='undefined')return Promise.resolve(null)
 return new Promise(resolve=>{const req=indexedDB.open(HANDLE_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(HANDLE_STORE))req.result.createObjectStore(HANDLE_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null)})
}
async function saveHandle(handle:any){const db=await openHandleDb();if(!db)return;await new Promise<void>((resolve,reject)=>{const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).put(handle,'directory');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function getHandle():Promise<any>{const db=await openHandleDb();if(!db)return null;return new Promise(resolve=>{const tx=db.transaction(HANDLE_STORE,'readonly');const req=tx.objectStore(HANDLE_STORE).get('directory');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>resolve(null)})}
export async function getBackupPreferences():Promise<BackupPreferences>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}}catch{return DEFAULTS}}
export async function saveBackupPreferences(p:BackupPreferences){localStorage.setItem(PREF_KEY,JSON.stringify(p))}
export function backupIntervalMs(v:BackupInterval){return INTERVALS[v]||INTERVALS['1d']}
export async function chooseBackupFolder():Promise<string>{
 const cap=(window as any).Capacitor
 const native=cap?.Plugins?.PishranBackup
 if(native?.pickFolder){const result=await native.pickFolder();const prefs=await getBackupPreferences();await saveBackupPreferences({...prefs,folderName:result.folderName||'Download/Pishran-Backups'});return result.folderName||'Download/Pishran-Backups'}
 const picker=(window as any).showDirectoryPicker
 if(typeof picker!=='function')throw new Error('انتخاب پوشه در این مرورگر پشتیبانی نمی‌شود. در نسخه نصب‌شده اندروید از انتخاب‌گر پوشه استفاده کنید.')
 const handle=await picker({id:'pishran-backups',mode:'readwrite'})
 const permission=await handle.requestPermission({mode:'readwrite'})
 if(permission!=='granted')throw new Error('مجوز نوشتن در پوشه داده نشد.')
 await saveHandle(handle)
 const prefs=await getBackupPreferences();await saveBackupPreferences({...prefs,folderName:handle.name||'پوشه انتخاب‌شده'})
 return handle.name||'پوشه انتخاب‌شده'
}
export async function backupFolderStatus():Promise<{hasFolder:boolean;folderName:string}>{
 const native=(window as any).Capacitor?.Plugins?.PishranBackup
 if(native?.getStatus){try{return await native.getStatus()}catch{return {hasFolder:false,folderName:''}}}
 const handle=await getHandle()
 if(!handle)return {hasFolder:false,folderName:''}
 try{const p=await handle.queryPermission({mode:'readwrite'});return {hasFolder:p==='granted',folderName:handle.name||''}}catch{return {hasFolder:false,folderName:handle.name||''}}
}
export async function buildBackup():Promise<{payload:PishranBackup;json:string;size:number}>{
 const raw=await localStore.exportAll()
 const preferences=await getBackupPreferences()
 const payload:PishranBackup={app:'Pishran',schema:2,exportedAt:new Date().toISOString(),records:raw.records,backupPreferences:{enabled:preferences.enabled,interval:preferences.interval}}
 if(!payload.records.length)throw new Error('هیچ داده‌ای برای پشتیبان‌گیری یافت نشد.')
 const json=JSON.stringify(payload,null,2)
 return {payload,json,size:new Blob([json]).size}
}
function safeDate(d:Date){return d.toISOString().replace(/[:.]/g,'-').replace('T','_').replace('Z','')}
export async function saveBackupFile(kind:'manual'|'automatic'='manual'):{fileName:string;size:number;folder:string;downloaded:boolean}{
 const {json,size}=await buildBackup()
 const fileName=(kind==='automatic'?'pishran-auto-':'pishran-backup-')+safeDate(new Date())+'.json'
 const native=(window as any).Capacitor?.Plugins?.PishranBackup
 if(native?.saveBackup){const status=await backupFolderStatus();if(!status.hasFolder)throw new Error('ابتدا پوشه پشتیبان را انتخاب کنید.');const result=await native.saveBackup({fileName,content:json});return {fileName,size,folder:result.folderName||status.folderName,downloaded:false}}
 const handle=await getHandle()
 if(handle){
  let permission=await handle.queryPermission({mode:'readwrite'})
  if(permission!=='granted')permission=await handle.requestPermission({mode:'readwrite'})
  if(permission==='granted'){
   const file=await handle.getFileHandle(fileName,{create:true});const writable=await file.createWritable();await writable.write(json);await writable.close()
   await pruneBrowserFolder(handle)
   return {fileName,size,folder:handle.name||'پوشه انتخاب‌شده',downloaded:false}
  }
 }
 if(kind==='automatic')throw new Error('برای پشتیبان خودکار، ابتدا پوشه ذخیره‌سازی را انتخاب و مجوز آن را تأیید کنید.')
 const blob=new Blob([json],{type:'application/json'})
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)
 return {fileName,size,folder:'پوشه دانلود پیش‌فرض مرورگر',downloaded:true}
}
async function pruneBrowserFolder(handle:any){
 const items:Array<{name:string;modified:number}>=[]
 for await(const [name,h] of handle.entries()){if(name.startsWith('pishran-auto-')&&name.endsWith('.json')){const f=await h.getFile();items.push({name,modified:f.lastModified})}}
 items.sort((a,b)=>b.modified-a.modified)
 for(const item of items.slice(8))await handle.removeEntry(item.name)
}
export function parseBackup(text:string):PishranBackup{
 let obj:any;try{obj=JSON.parse(text)}catch{throw new Error('فایل انتخاب‌شده JSON معتبر نیست.')}
 if(!obj||obj.app!=='Pishran'||![1,2].includes(obj.schema)||!Array.isArray(obj.records)||obj.records.length===0)throw new Error('ساختار فایل پشتیبان پیشران معتبر نیست یا فایل خالی است.')
 const seen=new Set<string>()
 for(const r of obj.records){if(!r||typeof r.key!=='string'||!r.key.trim()||r.key.length>240||seen.has(r.key))throw new Error('ساختار رکوردهای فایل پشتیبان معتبر نیست.');seen.add(r.key)}
 return obj as PishranBackup
}
export async function restoreBackup(payload:PishranBackup):Promise<number>{
 const current=await localStore.exportAll()
 if(!current.records.length)throw new Error('تهیه نسخه اضطراری از اطلاعات فعلی ممکن نشد؛ بازیابی متوقف شد.')
 localStorage.setItem(UNDO_KEY,JSON.stringify({at:new Date().toISOString(),snapshot:current}))
 await localStore.replaceAll(payload.records)
 return payload.records.length
}
export async function canUndoRestore():Promise<boolean>{try{return !!JSON.parse(localStorage.getItem(UNDO_KEY)||'null')?.snapshot?.records?.length}catch{return false}}
export async function undoLastRestore():Promise<number>{
 const raw=localStorage.getItem(UNDO_KEY);if(!raw)throw new Error('نسخه قبل از بازیابی در دسترس نیست.')
 const saved=JSON.parse(raw);if(!Array.isArray(saved.snapshot?.records)||!saved.snapshot.records.length)throw new Error('نسخه اضطراری معتبر نیست.')
 await localStore.replaceAll(saved.snapshot.records);if(saved.backupPreferences)await saveBackupPreferences(saved.backupPreferences);localStorage.removeItem(UNDO_KEY);return saved.snapshot.records.length
}
export async function updateBackupMeta(kind:'manual'|'automatic',size:number){
 const p=await getBackupPreferences();await saveBackupPreferences({...p,lastAt:new Date().toISOString(),lastSize:size,lastKind:kind})
}
