import {useRef,useState} from 'react'
import * as XLSX from 'xlsx'

type Props={moduleId:string;moduleTitle:string;projectId?:string;language?:'fa'|'en'}
const clean=(value:string)=>value.replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'module'
const visible=(element:Element)=>{const style=window.getComputedStyle(element);return style.display!=='none'&&style.visibility!=='hidden'}
export default function ModuleExportActions({moduleId,moduleTitle,projectId='',language='fa'}:Props){
 const en=language==='en',[busy,setBusy]=useState(false),[message,setMessage]=useState(''),rootRef=useRef<HTMLDivElement>(null)
 function exportExcel(){
  setBusy(true);setMessage('')
  try{
   const root=rootRef.current?.closest<HTMLElement>('[data-module-export-root]') ?? null
   if(!root)throw new Error(en?'Module report is not available.':'محتوای ماژول برای خروجی در دسترس نیست.')
   const projectName=(root.querySelector<HTMLInputElement>('#ranking-project-edit-name, [data-project-name-input]')?.value.trim()||root.getAttribute('data-project-export-name')||moduleTitle).trim()
   const activeProjectId=projectId||root.getAttribute('data-project-export-id')||''
   const wb=XLSX.utils.book_new()
   const overview:unknown[][]=[[en?'Pishran module report':'گزارش ماژول پیشران'],[en?'Module ID':'شناسه ماژول',moduleId],[en?'Module':'ماژول',moduleTitle],[en?'Project ID':'شناسه پروژه',activeProjectId],[en?'Project':'پروژه',projectName],[en?'Generated at':'زمان تهیه',new Date().toLocaleString()],[en?'Content type':'نوع محتوا',en?'Visible module content and current form values':'محتوای قابل مشاهده ماژول و مقادیر فعلی فرم']]
   const contentNodes=Array.from(root.querySelectorAll('h1,h2,h3,h4,p,article,li,label')).filter(el=>visible(el)&&!el.closest('.module-export-actions')&&!el.querySelector('article')&&el.tagName!=='LABEL')
   for(const el of contentNodes){const value=(el as HTMLElement).innerText?.trim()||el.textContent?.trim();if(value)overview.push([el.tagName.toLowerCase(),value])}
   Array.from(root.querySelectorAll('label')).filter(visible).forEach(label=>{const input=label.querySelector('input,select,textarea') as HTMLInputElement|null;if(input){const value=input instanceof HTMLSelectElement?input.selectedOptions[0]?.textContent:input.value;if(value)overview.push([label.childNodes[0]?.textContent?.trim()||'Input',value])}})
   XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(overview),en?'Module report':'گزارش ماژول')
   Array.from(root.querySelectorAll('table')).filter(visible).forEach((table,index)=>{const sheet=XLSX.utils.table_to_sheet(table,{raw:true});XLSX.utils.book_append_sheet(wb,sheet,('Table-'+(index+1)).slice(0,31))})
   XLSX.writeFile(wb,clean(moduleId+'-'+projectName)+'-'+new Date().toISOString().slice(0,10)+'.xlsx')
   setMessage(en?'Excel workbook generated.':'فایل Excel ماژول آماده شد.')
  }catch(error){setMessage(error instanceof Error?error.message:(en?'Excel export failed.':'ساخت فایل Excel ناموفق بود.'))}
  finally{setBusy(false)}
 }
 function exportPdf(){
  const root=rootRef.current?.closest<HTMLElement>('[data-module-export-root]');
  if(!root){setMessage(en?'Module report is not available.':'محتوای پروژه برای خروجی در دسترس نیست.');return}
  setMessage('');
  const projectName=(root.querySelector<HTMLInputElement>('#ranking-project-edit-name, [data-project-name-input]')?.value.trim()||root.getAttribute('data-project-export-name')||moduleTitle).trim();
  const activeProjectId=projectId||root.getAttribute('data-project-export-id')||'';
  const printTitle=document.createElement('h1');
  printTitle.className='module-export-print-title';
  printTitle.textContent=projectName;
  const printId=document.createElement('p');
  printId.className='module-export-print-project-id';
  printId.textContent=activeProjectId?'Project ID: '+activeProjectId:'';
  root.prepend(printId);
  root.prepend(printTitle);
  root.classList.add('module-export-print-target');
  document.body.classList.add('module-export-printing');
  const cleanup=()=>{
   root.classList.remove('module-export-print-target');
   document.body.classList.remove('module-export-printing');
   printTitle.remove();
   printId.remove();
   window.removeEventListener('afterprint',cleanup);
  };
  window.addEventListener('afterprint',cleanup);
  window.print();
 }
 return <div ref={rootRef} className="module-export-actions" data-export-module-id={moduleId} data-export-module-title={moduleTitle} data-export-scope="project" aria-label={en?'Module exports':'خروجی‌های ماژول'}>
  <span>{en?'Export this module':'دریافت خروجی ماژول'}</span>
  <button type="button" onClick={exportExcel} disabled={busy}><span aria-hidden="true">▦</span>{busy?(en?'Preparing…':'در حال آماده‌سازی…'):(en?'Export Excel':'خروجی Excel')}</button>
  <button type="button" onClick={exportPdf}><span aria-hidden="true">▤</span>{en?'Print / Save PDF':'چاپ / ذخیره PDF'}</button>
  {message&&<small role="status">{message}</small>}
 </div>
}
