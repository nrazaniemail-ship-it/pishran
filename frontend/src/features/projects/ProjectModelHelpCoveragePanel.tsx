import {
 HELP_FORM_SECTIONS, createBlankHelpDrivenProjectForms, addHelpFormRow,
 removeHelpFormRow, updateHelpFormRow, validateHelpDrivenProjectForms,
 type HelpDrivenProjectForms, type HelpFormField, type HelpFormRow, type HelpFormSection
} from './projectModelHelpForms'

type Props={value?:HelpDrivenProjectForms;onChange:(value:HelpDrivenProjectForms)=>void;language?:'fa'|'en'}
const parseNumber=(value:string):number|null=>value.trim()===''?null:Number.isFinite(Number(value))?Number(value):null
function FieldControl({field,row,onChange,language,referenceOptions}:{field:HelpFormField;row:HelpFormRow;onChange:(value:string|number|boolean|null)=>void;language:'fa'|'en';referenceOptions?:{value:string;label:string}[]}){
 const value=row.values[field.key]
 const label=language==='en'?field.en:field.fa
 const suffix=field.unit?' ('+field.unit+')':''
 if(field.type==='select'||(referenceOptions&&referenceOptions.length>0))return <label className="fw-field"><span>{label}{suffix}</span><select value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value||'')}><option value="">{language==='en'?'Select':'انتخاب'}</option>{referenceOptions&&referenceOptions.length>0?referenceOptions.map(option=><option value={option.value} key={option.value}>{option.label}</option>):(field.options??[]).map(option=><option value={option} key={option}>{option}</option>)}</select></label>
 if(field.type==='boolean')return <label className="fw-field"><span>{label}</span><select value={value===null?'':String(value)} onChange={e=>onChange(e.target.value===''?null:e.target.value==='true')}><option value="">{language==='en'?'Not specified':'تعیین نشده'}</option><option value="true">{language==='en'?'Yes':'بله'}</option><option value="false">{language==='en'?'No':'خیر'}</option></select></label>
 if(field.type==='number'||field.type==='percent')return <label className="fw-field"><span>{label}{suffix}</span><input type="number" step="any" value={typeof value==='number'?value:''} onChange={e=>onChange(parseNumber(e.target.value))}/></label>
 return <label className="fw-field"><span>{label}{suffix}</span><input type={field.type==='date'?'date':'text'} value={typeof value==='string'?value:''} onChange={e=>onChange(e.target.value)}/></label>
}

function referenceOptionsFor(fieldKey:string,model:HelpDrivenProjectForms):{value:string;label:string}[]|undefined{
 const rows=(id:string)=>model.sections?.[id]??[]
 const name=(row:HelpFormRow,key:string)=>typeof row.values[key]==='string'?String(row.values[key]).trim():''
 if(fieldKey==='productId')return rows('products').filter(row=>name(row,'name')).map(row=>({value:row.id,label:name(row,'name')}))
 if(fieldKey==='costCentreId'||fieldKey==='parentId')return rows('cost-centres').filter(row=>name(row,'name')).map(row=>({value:row.id,label:name(row,'name')}))
 if(fieldKey==='allocationKeyId')return rows('cost-allocation').filter(row=>name(row,'name')).map(row=>({value:row.id,label:name(row,'name')}))
 if(fieldKey==='costItemId')return rows('production-costs').filter(row=>name(row,'item')).map(row=>({value:row.id,label:name(row,'item')}))
 if(fieldKey==='loanName')return rows('loan-conditions').filter(row=>name(row,'loanName')).map(row=>({value:name(row,'loanName'),label:name(row,'loanName')}))
 if(fieldKey==='currency'||fieldKey==='currencyCode')return rows('currencies').filter(row=>name(row,'code')).map(row=>({value:name(row,'code'),label:name(row,'code')+(name(row,'name')?' — '+name(row,'name'):'')}))
 if(fieldKey==='financialItemId'||fieldKey==='parentEconomicItemId')return rows('economic-items').filter(row=>name(row,'item')).map(row=>({value:row.id,label:name(row,'item')}))
 if(fieldKey==='shareClass')return rows('joint-venture').filter(row=>name(row,'name')).map(row=>({value:name(row,'name'),label:name(row,'name')}))
 return undefined
}

export default function ProjectModelHelpCoveragePanel({value,onChange,language='fa'}:Props){
 const en=language==='en'
 const t=(fa:string,english:string)=>en?english:fa
 const model=value??createBlankHelpDrivenProjectForms()
 const errors=validateHelpDrivenProjectForms(model)
 const groups:HelpFormSection['group'][]=['project','operating','investment','finance','tax','economic','analysis']
 const groupFa:Record<string,string>={project:'۱. تعریف پروژه و تقویم',operating:'۲. عملیات، هزینه و سرمایه در گردش',investment:'۳. سرمایه‌گذاری و دارایی',finance:'۴. منابع مالی و بدهی',tax:'۵. مالیات و مانده‌های افتتاحیه',economic:'۶. ارزیابی اقتصادی',analysis:'۷. تحلیل حساسیت و افزایشی'}
 const groupEn:Record<string,string>={project:'1. Project definition and calendar',operating:'2. Operations, costs and working capital',investment:'3. Investment and assets',finance:'4. Finance and debt',tax:'5. Tax and opening balances',economic:'6. Economic appraisal',analysis:'7. Sensitivity and incremental analysis'}
 return <section className="fw-card" style={{marginTop:16}}>
  <h3>{t('فرم جامع مدل بر مبنای راهنمای مرجع','Complete reference-driven project model forms')}</h3>
  <p className="fw-hint">{t('ساختار زیر حوزه‌های ورودی مالی و اقتصادی مستندشده در راهنمای مرجع را پوشش می‌دهد. همه مقادیر عددی خالی هستند؛ هیچ نرخ، مقدار، دوره یا فرض پروژه‌ای پیش‌فرض‌گذاری نشده است. داده‌های این لایه ذخیره و اعتبارسنجی می‌شوند؛ اتصال هر فیلد به موتور محاسبات و صورت‌های مالی باید جداگانه آزمون شود.','The sections below cover the financial and economic input domains documented in the reference manual. All numeric values start blank; no project rate, amount, period or assumption is prefilled. This layer is persisted and validated; each field still requires separately tested integration into the calculation engine and statements.')}</p>
  {groups.map(group=><div key={group}>
   <h4>{en?groupEn[group]:groupFa[group]}</h4>
   {HELP_FORM_SECTIONS.filter(section=>section.group===group).map(section=>{
    const rows=model.sections?.[section.id]??[]
    return <div className="fw-validation" key={section.id} style={{marginTop:10,padding:12}}>
     <div className="fw-card-head"><div><h5>{en?section.en:section.fa}</h5><small className="fw-hint">{t('مرجع مستند: ','Manual reference: ')}{section.source}</small></div></div>
     {rows.map(row=><div key={row.id} style={{marginTop:10,padding:10,border:'1px solid var(--border-color, #d7dee8)',borderRadius:8}}>
      <div className="fw-grid">{section.fields.map(field=><FieldControl key={field.key} field={field} row={row} language={language} referenceOptions={referenceOptionsFor(field.key,model)} onChange={next=>onChange(updateHelpFormRow(model,section.id,row.id,field.key,next))}/>)}</div>
      {section.repeatable&&<button type="button" className="secondary-button" onClick={()=>onChange(removeHelpFormRow(model,section.id,row.id))}>{t('حذف ردیف','Remove row')}</button>}
     </div>)}
     {section.repeatable&&<button type="button" className="secondary-button" style={{marginTop:8}} onClick={()=>onChange(addHelpFormRow(model,section.id,crypto.randomUUID()))}>{t('افزودن ردیف','Add row')}</button>}
    </div>
   })}
  </div>)}
  {errors.length>0&&<div className="fw-validation" role="alert"><b>{t('کنترل‌های ساختاری نیازمند اصلاح','Structural validation issues')}</b><ul>{errors.slice(0,30).map((error,index)=><li key={index}>{error}</li>)}</ul>{errors.length>30&&<small>{t('و موارد بیشتر...','And more...')}</small>}</div>}
 </section>
}
