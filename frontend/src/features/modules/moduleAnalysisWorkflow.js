const COST_KEY = 'module-intelligence:MOD-02:v1'
const OEE_KEY = 'module-intelligence:MOD-03:v1'
const numberValue = value => String(value ?? '').trim() === '' ? Number.NaN : Number(value)

export async function executeModuleAnalysis(moduleId, input, store, createdAt = new Date().toISOString()) {
  if (moduleId !== 'MOD-02' && moduleId !== 'MOD-03') throw new Error('Unsupported module')
  const values = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, numberValue(value)]))
  if (Object.values(values).some(value => !Number.isFinite(value) || value < 0)) throw new Error('همه فیلدها باید با اعداد معتبر و غیرمنفی تکمیل شوند.')
  let metrics
  if (moduleId === 'MOD-02') {
    const required = ['outputTon','material','labor','energy','maintenance','overhead','sellingPrice']
    if (required.some(key => !Object.hasOwn(values,key))) throw new Error('اطلاعات بهای تمام‌شده ناقص است.')
    const x=values
    if(x.outputTon<=0||x.sellingPrice<=0) throw new Error('مقدار تولید و قیمت فروش باید بزرگ‌تر از صفر باشند.')
    const totalCost=x.material+x.labor+x.energy+x.maintenance+x.overhead
    const unitCost=totalCost/x.outputTon
    metrics={totalCost,unitCost,sellingPrice:x.sellingPrice,grossMarginPerTon:x.sellingPrice-unitCost,grossMarginPercent:(x.sellingPrice-unitCost)/x.sellingPrice*100}
  } else {
    const required=['plannedMinutes','downtimeMinutes','idealCycleSeconds','totalCount','goodCount']
    if(required.some(key=>!Object.hasOwn(values,key))) throw new Error('اطلاعات تولید ناقص است.')
    const x=values, runMinutes=x.plannedMinutes-x.downtimeMinutes
    if(x.plannedMinutes<=0||x.downtimeMinutes>x.plannedMinutes||runMinutes<=0||x.idealCycleSeconds<=0||x.totalCount<=0||x.goodCount>x.totalCount) throw new Error('زمان، توقفات، سیکل ایده‌آل و تعداد تولید را کنترل کنید.')
    const availability=runMinutes/x.plannedMinutes*100
    const performance=x.totalCount*x.idealCycleSeconds/(runMinutes*60)*100
    const quality=x.goodCount/x.totalCount*100
    metrics={availability,performance,quality,oee:availability/100*performance/100*quality/100*100}
  }
  const key=moduleId==='MOD-02'?COST_KEY:OEE_KEY
  const previous=await store.get(key), history=Array.isArray(previous)?previous:[]
  const saved={id:`${moduleId}-${Date.parse(createdAt)}`,moduleId,createdAt,inputs:{...input},metrics}
  await store.set(key,[saved,...history].slice(0,30))
  return saved
}
