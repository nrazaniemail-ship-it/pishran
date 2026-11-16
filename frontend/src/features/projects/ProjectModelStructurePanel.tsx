import { getVisibleProjectModelNodes, type ProjectModelConfiguration, type ProjectModelNodeDefinition } from './projectModelSchema'

type Props = { configuration: ProjectModelConfiguration; language?: 'fa'|'en' }

const labels: Record<string,[string,string]> = {
 'project-identification':['شناسنامه و طبقه‌بندی پروژه','Project identification and classification'],
 'planning-horizon':['افق برنامه‌ریزی و تقویم مالی','Planning horizon and financial calendar'],
 'products':['محصولات و ظرفیت‌ها','Products and capacities'],
 'currencies':['ارزها و نرخ‌های تبدیل','Currencies and exchange rates'],
 'cost-centre-structure':['ساختار مراکز هزینه','Cost-centre structure'],
 'inflation':['شاخص‌های تورم','Inflation indices'],
 'joint-venture-partners':['شرکای مشارکت','Joint-venture partners'],
 'discounting':['تنزیل و تاریخ ارزش‌گذاری','Discounting and valuation date'],
 'fixed-investment':['سرمایه‌گذاری ثابت و دفتر دارایی‌ها','Fixed investment and asset register'],
 'production-costs':['هزینه‌های تولید مستقیم و غیرمستقیم','Direct and indirect production costs'],
 'sales-programme':['برنامه تولید و فروش','Production and sales programme'],
 'working-capital':['سرمایه در گردش','Working capital'],
 'sources-of-finance':['منابع تأمین مالی','Sources of finance'],
 'taxes-allowances':['مالیات و معافیت‌ها','Taxes and allowances'],
 'starting-balances':['مانده‌های افتتاحیه','Starting balances'],
 'economic-analysis':['تحلیل اقتصادی','Economic analysis'],
}
const groupLabels: Record<string,[string,string]> = {
 identification:['تعریف پروژه','Project definition'],
 time:['زمان و مفروضات عمومی','Time and common assumptions'],
 operating:['مدل عملیاتی','Operating model'],
 investment:['سرمایه‌گذاری','Investment'],
 financing:['تأمین مالی','Financing'],
 'tax-opening':['مالیات و مانده‌های افتتاحیه','Tax and opening balances'],
 economic:['ارزیابی اقتصادی','Economic appraisal'],
}

export default function ProjectModelStructurePanel({configuration,language='fa'}:Props) {
 const en=language==='en'
 const nodes=getVisibleProjectModelNodes(configuration)
 const detailLevel=(node:ProjectModelNodeDefinition)=>configuration.analysisLevel==='opportunity'?node.opportunityLevel:node.feasibilityLevel
 const detailLabel=(node:ProjectModelNodeDefinition)=>{const level=detailLevel(node);if(en)return level==='required'?'Core input':level==='reduced'?'Summary input':'Optional detail';return level==='required'?'ورودی اصلی':level==='reduced'?'ورودی خلاصه':'جزئیات اختیاری'}
 const groups=[...new Set(nodes.map(node=>node.group))]
 const label=(node:ProjectModelNodeDefinition)=>labels[node.id]?.[en?1:0]??node.id
 return <section className="fw-card" style={{marginTop:16}}>
  <h3>{en?'Project model structure':'درخت ساختاری مدل پروژه'}</h3>
  <p className="fw-hint">{en?'The structure is metadata only. It does not prefill project figures, prices, capacities, rates or financial assumptions. Modules are displayed according to the selected analysis features.':'این بخش نقشه ماژول‌های مدل است، نه داده آماده پروژه. هیچ مبلغ، قیمت، ظرفیت، نرخ یا فرض مالی از پیش وارد نمی‌شود؛ ماژول‌های اختیاری فقط با فعال‌بودن قابلیت مربوط نمایش داده می‌شوند.'}</p>
  {groups.map(group=><div key={group} style={{marginTop:12}}>
   <h4>{groupLabels[group]?.[en?1:0]??group}</h4>
   <div className="fw-grid">
    {nodes.filter(node=>node.group===group).map(node=><div key={node.id} className="fw-validation" style={{padding:10}}>
     <b>{label(node)}</b>
     <div className="fw-hint">{en?'Input fields defined':'فیلدهای ساختاری تعریف‌شده'}: {node.fields.length}</div>
     <div className="fw-hint">{detailLabel(node)}</div>
    </div>)}
   </div>
  </div>)}
 </section>
}
