export type InventoryReceipt = { id: string; quantity: number; unitPurchaseRate: number; currency: string; receivedAt: string }
export type InventoryLedger = {
  itemId: string; itemName: string; unit: string; currency: string
  openingQuantity: number; openingValue: number
  receipts: InventoryReceipt[]
  issuedQuantity: number; closingQuantity: number
}
export type InventoryValuation = {
  availableQuantity: number; availableValue: number; weightedAverageRate: number | null
  issueValue: number; expectedClosingQuantity: number; quantityVariance: number
  warnings: string[]
}
const valid = (n:number) => Number.isFinite(n) && n >= 0
export function validateInventoryLedger(x:InventoryLedger):string[] {
  const errors:string[]=[]
  if(!x.itemId.trim()||!x.itemName.trim()||!x.unit.trim()||!x.currency.trim()) errors.push('شناسه، نام، واحد و ارز کالا الزامی است')
  if(!valid(x.openingQuantity)||!valid(x.openingValue)||!valid(x.issuedQuantity)||!valid(x.closingQuantity)) errors.push('مقادیر موجودی و حواله باید نامنفی و محدود باشند')
  if(!Array.isArray(x.receipts)||x.receipts.some(r=>!r.id.trim()||!r.receivedAt||!valid(r.quantity)||!valid(r.unitPurchaseRate)||r.currency!==x.currency)) errors.push('رسید خرید یا نرخ خرید نامعتبر است؛ ارز رسید باید با ارز کالا یکسان باشد')
  if(new Set(x.receipts.map(r=>r.id)).size!==x.receipts.length) errors.push('شناسه رسید خرید تکراری است')
  return errors
}
/** Moving weighted average for the period; this is an explicit selectable policy, not an inferred accounting mandate. */
export function valueInventoryLedger(x:InventoryLedger):InventoryValuation {
  const errors=validateInventoryLedger(x); if(errors.length) throw new Error(errors.join('؛ '))
  const receiptQty=x.receipts.reduce((s,r)=>s+r.quantity,0)
  const receiptValue=x.receipts.reduce((s,r)=>s+r.quantity*r.unitPurchaseRate,0)
  const availableQuantity=x.openingQuantity+receiptQty
  const availableValue=x.openingValue+receiptValue
  const weightedAverageRate=availableQuantity>0?availableValue/availableQuantity:null
  const issueValue=weightedAverageRate===null?0:x.issuedQuantity*weightedAverageRate
  const expectedClosingQuantity=availableQuantity-x.issuedQuantity
  const quantityVariance=x.closingQuantity-expectedClosingQuantity
  const warnings:string[]=[]
  if(x.issuedQuantity>availableQuantity) warnings.push('حواله از موجودی قابل دسترس بیشتر است؛ موجودی منفی مجاز نیست.')
  if(Math.abs(quantityVariance)>1e-9) warnings.push('موجودی پایان ثبت‌شده با موجودی اول + رسید − حواله تطبیق ندارد.')
  if(weightedAverageRate===null) warnings.push('موجودی قابل ارزش‌گذاری وجود ندارد؛ نرخ میانگین قابل محاسبه نیست.')
  return {availableQuantity,availableValue,weightedAverageRate,issueValue,expectedClosingQuantity,quantityVariance,warnings}
}
export type ConversionCostPool = { id:string; name:string; amount:number; currency:string }
export type ConversionAllocation = { poolId:string; poolName:string; allocatedAmount:number; allocationRate:number }
export function allocateConversionCosts(pools:ConversionCostPool[], outputBase:number):ConversionAllocation[]
export function allocateConversionCosts(pools:ConversionCostPool[], outputBase:number):ConversionAllocation[] {
  if(!Number.isFinite(outputBase)||outputBase<=0) throw new Error('مبنای تخصیص باید بزرگ‌تر از صفر باشد')
  if(pools.some(p=>!p.id.trim()||!p.name.trim()||!valid(p.amount)||!p.currency.trim())) throw new Error('مرکز هزینه یا مبلغ تخصیص نامعتبر است')
  const currencies=new Set(pools.map(p=>p.currency)); if(currencies.size>1) throw new Error('ارز مراکز هزینه یکسان نیست')
  return pools.map(p=>({poolId:p.id,poolName:p.name,allocatedAmount:p.amount,allocationRate:p.amount/outputBase}))
}
