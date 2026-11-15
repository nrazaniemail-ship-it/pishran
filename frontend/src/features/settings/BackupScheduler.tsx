import {useEffect} from 'react'
import {backupFolderStatus,backupIntervalMs,getBackupPreferences,saveBackupFile,updateBackupMeta} from '../../core/storage/backupService'

export default function BackupScheduler(){
 useEffect(()=>{
  let active=true
  let running=false
  const check=async()=>{
   if(!active||running)return
   running=true
   try{
    const prefs=await getBackupPreferences()
    if(!prefs.enabled)return
    const folder=await backupFolderStatus()
    if(!folder.hasFolder)return
    const due=!prefs.lastAt||Date.now()-new Date(prefs.lastAt).getTime()>=backupIntervalMs(prefs.interval)
    if(!due)return
    const result=await saveBackupFile('automatic')
    await updateBackupMeta('automatic',result.size)
    window.dispatchEvent(new CustomEvent('pishran-backup-complete',{detail:{at:new Date().toISOString(),size:result.size}}))
   }catch(error){
    window.dispatchEvent(new CustomEvent('pishran-backup-error',{detail:error instanceof Error?error.message:(document.documentElement.lang==='en'?'Automatic backup failed':'پشتیبان‌گیری خودکار ناموفق بود')}))
   }finally{running=false}
  }
  void check()
  const timer=window.setInterval(()=>void check(),60000)
  const onVisible=()=>{if(document.visibilityState==='visible')void check()}
  document.addEventListener('visibilitychange',onVisible)
  return()=>{active=false;window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible)}
 },[])
 return null
}
