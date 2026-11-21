import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Calculator, Save, Trash2 } from 'lucide-react'
import { analyzeProductionRecord, calculateFinishedGoodsPeriod, type ProductionRecord } from './productionAnalysis'
import { deleteProductionRecord, listProductionRecords, saveProductionRecord } from './productionRepository'

type Props = { language?: 'fa' | 'en'; onBack: () => void }
const number = (value: string) => value === '' ? 0 : Number(value)
const initial = (): ProductionRecord => ({
  id: crypto.randomUUID(), projectId: 'local-project', lineId: 'line-1', product: '',
  periodStart: new Date().toISOString().slice(0,10), periodEnd: new Date().toISOString().slice(0,10),
  plannedOutput: 0, totalOutput: 0, goodOutput: 0, scrapOutput: 0, matchedMaterialInput: 0,
  matchedMaterialUnit: 'ton', materials: [{id:'material-1',name:'ماده اصلی',consumedQuantity:0,unit:'ton',unitCost:0,currency:'USD'}],
  directLaborCost:0, energyCost:0, maintenanceCost:0, allocatedOverhead:0, currency:'USD',
  createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
})
export default function ProductionWorkspace({language='fa',onBack}:Props){
 const en=language==='en'
 const [record,setRecord]=useState<ProductionRecord>(initial)
 const [records,setRecords]=useState<ProductionRecord[]>([])
 const [error,setError]=useState('')
 const [saved,setSaved]=useState(false)
 const result=useMemo(()=>{try{return analyzeProductionRecord(record)}catch{return null}},[record])
 const refresh=async()=>setRecords(await listProductionRecords())
 useEffect(()=>{void refresh()},[])
 const t=(fa:string,english:string)=>en?english:fa
 const update=(key:keyof ProductionRecord,value:unknown)=>setRecord(current=>({...current,[key]:value}))
 const updateMaterial=(key:'consumedQuantity'|'unitCost'|'name',value:string)=>setRecord(current=>({...current,materials:current.materials.map((item,index)=>index===0?{...item,[key]:key==='name'?value:number(value)}:item)}))
 const save=async()=>{setError('');setSaved(false);try{await saveProductionRecord({...record,updatedAt:new Date().toISOString()});await refresh();setSaved(true)}catch(e){setError(e instanceof Error?e.message:String(e))}}
 const field=(label:string,key:keyof ProductionRecord,value:number)=> <label className="production-field"><span>{label}</span><input type="number" min="0" step="any" value={value} onChange={e=>update(key,number(e.target.value))}/></label>
 const metric=(label:string,value:number|null,suffix='')=><div className="production-metric"><small>{label}</small><b>{value===null?'—':(value*100).toLocaleString(en?'en-US':'fa-IR',{maximumFractionDigits:2})+(suffix||'%')}</b></div>
 return <main className="production-workspace">
  <header className="production-head"><button onClick={onBack}><ArrowLeft size={17}/>{t('بازگشت','Back')}</button><div><h1>{t('ثبت تولید، مصرف مواد و بهای تمام‌شده','Production, Material Consumption & Cost')}</h1><p>{t('جریان عملیاتی MOD-03 → MOD-08 → MOD-02','Operational flow MOD-03 → MOD-08 → MOD-02')}</p></div></header>
  <div className="production-notice">{t('این فرم برای ثبت داده واقعی است. برای شروع، شناسه پروژه و خط را در داده ذخیره‌شده اصلاح کنید؛ هیچ مقدار نمونه‌ای به‌صورت پیش‌فرض ثبت نمی‌شود.','This form records actual data. No sample production values are prefilled.')}</div>
  <section className="production-card"><h2>{t('مشخصات دوره و محصول','Period & Product')}</h2><div className="production-form-grid">
   <label className="production-field"><span>{t('شناسه پروژه','Project ID')}</span><input value={record.projectId} onChange={e=>update('projectId',e.target.value)}/></label>
   <label className="production-field"><span>{t('شناسه خط','Line ID')}</span><input value={record.lineId} onChange={e=>update('lineId',e.target.value)}/></label>
   <label className="production-field"><span>{t('محصول','Product')}</span><input value={record.product} onChange={e=>update('product',e.target.value)}/></label>
   <label className="production-field"><span>{t('ارز','Currency')}</span><select value={record.currency} onChange={e=>{update('currency',e.target.value);update('materials',record.materials.map(m=>({...m,currency:e.target.value})))}}><option>USD</option><option>IRR</option><option>EUR</option></select></label>
   <label className="production-field"><span>{t('شروع دوره','Period start')}</span><input type="date" value={record.periodStart} onChange={e=>update('periodStart',e.target.value)}/></label>
   <label className="production-field"><span>{t('پایان دوره','Period end')}</span><input type="date" value={record.periodEnd} onChange={e=>update('periodEnd',e.target.value)}/></label>
  </div></section>
  <section className="production-card"><h2>{t('تولید و تراز مواد','Production & Material Balance')}</h2><div className="production-form-grid">
   {field(t('برنامه تولید (تن)','Planned output (t)'),'plannedOutput',record.plannedOutput)}
   {field(t('تولید کل (تن)','Total output (t)'),'totalOutput',record.totalOutput)}
   {field(t('تولید سالم (تن)','Good output (t)'),'goodOutput',record.goodOutput)}
   {field(t('ضایعات (تن)','Scrap (t)'),'scrapOutput',record.scrapOutput)}
   {field(t('ورودی ماده متناظر (تن)','Matched material input (t)'),'matchedMaterialInput',record.matchedMaterialInput)}
  </div><p className="production-help">{t('ورودی متناظر باید فقط خوراک واقعاً عبوری از مرز فرآیند تعریف‌شده باشد؛ مجموع چند ماده ناهمگن را بدون تبدیل معتبر وارد نکنید.','Matched input must reflect the defined process boundary; do not sum heterogeneous materials without a valid conversion.')}</p>
  <div className="production-form-grid">
   <label className="production-field"><span>{t('نام ماده اصلی','Primary material')}</span><input value={record.materials[0]?.name??''} onChange={e=>updateMaterial('name',e.target.value)}/></label>
   <label className="production-field"><span>{t('مقدار مصرف (تن)','Consumed quantity (t)')}</span><input type="number" min="0" step="any" value={record.materials[0]?.consumedQuantity??0} onChange={e=>updateMaterial('consumedQuantity',e.target.value)}/></label>
   <label className="production-field"><span>{t('نرخ واحد','Unit cost')}</span><input type="number" min="0" step="any" value={record.materials[0]?.unitCost??0} onChange={e=>updateMaterial('unitCost',e.target.value)}/></label>
  </div><h3>{t('فروش و موجودی محصول نهایی','Sales & Finished Goods Inventory')}</h3><div className="production-form-grid">
   {field(t('موجودی اول دوره (تن)','Opening finished goods (t)'),'finishedGoodsOpeningQuantity',record.finishedGoodsOpeningQuantity??0)}
   {field(t('ارزش موجودی اول دوره','Opening inventory value'),'finishedGoodsOpeningValue',record.finishedGoodsOpeningValue??0)}
   {field(t('مقدار فروش دوره (تن)','Period sales (t)'),'salesQuantity',record.salesQuantity??0)}
  </div></section>
  <section className="production-card"><h2>{t('هزینه‌های تبدیل','Conversion Costs')}</h2><div className="production-form-grid">
   {field(t('نیروی انسانی مستقیم','Direct labor'),'directLaborCost',record.directLaborCost)}
   {field(t('انرژی','Energy'),'energyCost',record.energyCost)}
   {field(t('تعمیرات','Maintenance'),'maintenanceCost',record.maintenanceCost)}
   {field(t('سربار تخصیص‌یافته','Allocated overhead'),'allocatedOverhead',record.allocatedOverhead)}
  </div></section>
  {result&&<section className="production-card"><h2><Calculator size={19}/>{t('نتایج محاسباتی','Calculated Results')}</h2><div className="production-metrics">
   {metric(t('Yield','Yield'),result.yield)}
   {metric(t('تحقق برنامه','Plan achievement'),result.planAchievement)}
   {metric(t('نرخ کیفیت','Quality rate'),result.qualityRate)}
   {metric(t('نرخ ضایعات','Scrap rate'),result.scrapRate)}
  </div><div className="production-cost-lines"><p><span>{t('هزینه مواد','Material cost')}</span><b>{result.materialCost.toLocaleString()} {record.currency}</b></p><p><span>{t('هزینه تبدیل','Conversion cost')}</span><b>{result.conversionCost.toLocaleString()} {record.currency}</b></p><p><span>{t('کل بهای تولید','Total production cost')}</span><b>{result.totalProductionCost.toLocaleString()} {record.currency}</b></p><p><span>{t('بهای هر تن محصول سالم','Cost per good ton')}</span><b>{result.unitCostPerGoodOutput===null?'—':result.unitCostPerGoodOutput.toLocaleString()} {record.currency}</b></p></div>
  {result.warnings.map(w=><p className="production-warning" key={w}>{w}</p>)}
  {finishedGoods&&<div className="production-cost-lines"><p><span>{t('CPP ـ بهای تولید دوره','CPP — Current production cost')}</span><b>{finishedGoods.cpp.toLocaleString()} {record.currency}</b></p><p><span>{t('CPS ـ بهای کالای فروش‌رفته','CPS — Cost of products sold')}</span><b>{finishedGoods.cps.toLocaleString()} {record.currency}</b></p><p><span>{t('موجودی پایان محصول (تن)','Closing finished goods (t)')}</span><b>{finishedGoods.closingQuantity.toLocaleString()}</b></p><p><span>{t('ارزش موجودی پایان','Closing inventory value')}</span><b>{finishedGoods.closingInventoryValue.toLocaleString()} {record.currency}</b></p>{finishedGoods.warnings.map(w=><p className="production-warning" key={w}>{w}</p>)}</div>}
  </section>}
  {error&&<p className="production-error">{error}</p>}{saved&&<p className="production-success">{t('رکورد با موفقیت ذخیره شد.','Record saved successfully.')}</p>}
  <button className="production-save" onClick={()=>void save()}><Save size={17}/>{t('ذخیره رکورد تولید','Save production record')}</button>
  {records.length>0&&<section className="production-card"><h2>{t('سوابق ثبت‌شده','Saved records')}</h2>{records.map(item=><div className="production-record" key={item.id}><span>{item.product||item.id} · {item.periodStart} — {item.periodEnd}</span><button onClick={async()=>{await deleteProductionRecord(item.id);await refresh()}} aria-label={t('حذف رکورد','Delete record')}><Trash2 size={16}/></button></div>)}</section>}
 </main>
}
