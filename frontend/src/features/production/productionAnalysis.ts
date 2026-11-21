export type ProductionMaterial = {
  id: string
  name: string
  consumedQuantity: number
  unit: string
  unitCost: number
  currency: string
}

export type ProductionRecord = {
  id: string
  projectId: string
  lineId: string
  product: string
  periodStart: string
  periodEnd: string
  plannedOutput: number
  totalOutput: number
  goodOutput: number
  scrapOutput: number
  matchedMaterialInput: number
  matchedMaterialUnit: string
  materials: ProductionMaterial[]
  finishedGoodsOpeningQuantity?: number
  finishedGoodsOpeningValue?: number
  salesQuantity?: number
  directLaborCost: number
  energyCost: number
  maintenanceCost: number
  allocatedOverhead: number
  currency: string
  createdAt: string
  updatedAt: string
}

export type ProductionAnalysis = {
  materialCost: number
  conversionCost: number
  totalProductionCost: number
  unitCostPerGoodOutput: number | null
  yield: number | null
  planAchievement: number | null
  qualityRate: number | null
  scrapRate: number | null
  productionVariance: number
  materialCostByItem: Array<{ id: string; name: string; cost: number; currency: string }>
  warnings: string[]
}

const finiteNonNegative = (value: number) => Number.isFinite(value) && value >= 0

export function validateProductionRecord(record: ProductionRecord): string[] {
  const errors: string[] = []
  if (!record.id.trim() || !record.projectId.trim() || !record.lineId.trim()) errors.push('شناسه پروژه، خط و رکورد الزامی است')
  if (!record.product.trim()) errors.push('محصول الزامی است')
  if (!record.periodStart || !record.periodEnd || record.periodStart > record.periodEnd) errors.push('بازه زمانی تولید معتبر نیست')
  const quantities = [record.plannedOutput, record.totalOutput, record.goodOutput, record.scrapOutput, record.matchedMaterialInput]
  if (!quantities.every(finiteNonNegative)) errors.push('مقادیر تولید و مواد باید عددی، محدود و نامنفی باشند')
  if (record.goodOutput + record.scrapOutput > record.totalOutput + 1e-9) errors.push('تولید سالم و ضایعات از تولید کل بیشتر است')
  if (record.materials.some(item => !item.id.trim() || !item.name.trim() || !item.unit.trim() || !item.currency.trim() || !finiteNonNegative(item.consumedQuantity) || !finiteNonNegative(item.unitCost))) errors.push('اطلاعات مواد مصرفی یا نرخ واحد معتبر نیست')
  if (![record.directLaborCost, record.energyCost, record.maintenanceCost, record.allocatedOverhead].every(finiteNonNegative)) errors.push('هزینه‌های تبدیل باید عددی، محدود و نامنفی باشند')
  if (!record.currency.trim()) errors.push('ارز مبنای هزینه الزامی است')
  if (record.materials.some(item => item.currency !== record.currency)) errors.push('ارز مواد با ارز مبنای رکورد یکسان نیست؛ ابتدا تسعیر مستند انجام دهید')
  return errors
}

export function analyzeProductionRecord(record: ProductionRecord): ProductionAnalysis {
  const errors = validateProductionRecord(record)
  if (errors.length) throw new Error(errors.join('؛ '))
  const materialCostByItem = record.materials.map(item => ({ id: item.id, name: item.name, cost: item.consumedQuantity * item.unitCost, currency: item.currency }))
  const materialCost = materialCostByItem.reduce((sum, item) => sum + item.cost, 0)
  const conversionCost = record.directLaborCost + record.energyCost + record.maintenanceCost + record.allocatedOverhead
  const totalProductionCost = materialCost + conversionCost
  const warnings: string[] = []
  const yieldValue = record.matchedMaterialInput > 0 ? record.goodOutput / record.matchedMaterialInput : null
  const planAchievement = record.plannedOutput > 0 ? record.totalOutput / record.plannedOutput : null
  const qualityRate = record.totalOutput > 0 ? record.goodOutput / record.totalOutput : null
  const scrapRate = record.totalOutput > 0 ? record.scrapOutput / record.totalOutput : null
  if (yieldValue !== null && yieldValue > 1) warnings.push('Yield بیش از ۱۰۰٪ است؛ مرز فرآیند، واحد و دوره ورودی/خروجی را بررسی کنید. مقدار خام تغییر داده نشده است.')
  if (planAchievement === null) warnings.push('برنامه تولید صفر است؛ درصد تحقق برنامه قابل محاسبه نیست.')
  if (yieldValue === null) warnings.push('ورودی ماده متناظر صفر یا ناموجود است؛ Yield قابل محاسبه نیست.')
  if (record.goodOutput === 0) warnings.push('تولید سالم صفر است؛ بهای واحد محصول قابل محاسبه نیست.')
  if (record.goodOutput + record.scrapOutput < record.totalOutput - 1e-9) warnings.push('بخشی از تولید کل در دسته سالم یا ضایعات ثبت نشده است.')
  return {
    materialCost, conversionCost, totalProductionCost,
    unitCostPerGoodOutput: record.goodOutput > 0 ? totalProductionCost / record.goodOutput : null,
    yield: yieldValue, planAchievement, qualityRate, scrapRate,
    productionVariance: record.totalOutput - record.plannedOutput,
    materialCostByItem, warnings
  }
}


export type FinishedGoodsPeriodInput = {
  openingQuantity: number
  openingValue: number
  currentGoodOutput: number
  currentProductionCost: number
  salesQuantity: number
}

export type FinishedGoodsPeriodResult = {
  cpp: number
  currentUnitProductionCost: number | null
  availableQuantity: number
  availableValue: number
  weightedAverageUnitCost: number | null
  cps: number
  closingQuantity: number
  closingInventoryValue: number
  warnings: string[]
}

/** Periodic finished-goods roll-forward using an explicitly selected weighted-average policy. */
export function calculateFinishedGoodsPeriod(input: FinishedGoodsPeriodInput): FinishedGoodsPeriodResult {
  const values = [input.openingQuantity, input.openingValue, input.currentGoodOutput, input.currentProductionCost, input.salesQuantity]
  if (!values.every(finiteNonNegative)) throw new Error('مقادیر موجودی محصول، تولید، فروش و بهای تولید باید محدود و نامنفی باشند')
  if (input.openingQuantity === 0 && input.openingValue > 1e-9) throw new Error('ارزش موجودی اول دوره بدون مقدار موجودی قابل قبول نیست')
  if (input.currentGoodOutput === 0 && input.currentProductionCost > 1e-9) throw new Error('بهای تولید دوره بدون محصول سالم قابل تخصیص نیست')
  const availableQuantity = input.openingQuantity + input.currentGoodOutput
  const availableValue = input.openingValue + input.currentProductionCost
  const weightedAverageUnitCost = availableQuantity > 0 ? availableValue / availableQuantity : null
  const warnings: string[] = []
  if (input.salesQuantity > availableQuantity + 1e-9) warnings.push('مقدار فروش از موجودی قابل فروش بیشتر است؛ کسری محصول نهایی وجود دارد.')
  const cps = weightedAverageUnitCost === null ? 0 : input.salesQuantity * weightedAverageUnitCost
  const closingQuantity = availableQuantity - input.salesQuantity
  const closingInventoryValue = weightedAverageUnitCost === null ? 0 : closingQuantity * weightedAverageUnitCost
  return { cpp: input.currentProductionCost, currentUnitProductionCost: input.currentGoodOutput > 0 ? input.currentProductionCost / input.currentGoodOutput : null, availableQuantity, availableValue, weightedAverageUnitCost, cps, closingQuantity, closingInventoryValue, warnings }
}


export type FinishedGoodsProductInput = FinishedGoodsPeriodInput & { productId: string; currency: string }
export type FinishedGoodsProductResult = FinishedGoodsPeriodResult & { productId: string; currency: string }

/** Calculate each product's stock and cost independently; never pool unlike products. */
export function calculateFinishedGoodsPortfolio(products: FinishedGoodsProductInput[]): FinishedGoodsProductResult[] {
  const ids = new Set<string>()
  const currencies = new Map<string, string>()
  return products.map(product => {
    if (!product.productId.trim() || ids.has(product.productId)) throw new Error('شناسه محصول در سبد موجودی خالی یا تکراری است')
    ids.add(product.productId)
    const previousCurrency = currencies.get(product.productId)
    if (previousCurrency && previousCurrency !== product.currency) throw new Error('ارز موجودی محصول در دوره‌ها ناسازگار است')
    currencies.set(product.productId, product.currency)
    return { productId: product.productId, currency: product.currency, ...calculateFinishedGoodsPeriod(product) }
  })
}

/** Sum only after product-level valuation; currencies must match before monetary consolidation. */
export function summarizeFinishedGoodsPortfolio(products: FinishedGoodsProductResult[], reportingCurrency: string) {
  if (products.some(product => product.currency !== reportingCurrency)) throw new Error('تجمیع موجودی محصولات با ارزهای متفاوت بدون تسعیر مجاز نیست')
  return products.reduce((sum, product) => ({
    cpp: sum.cpp + product.cpp,
    cps: sum.cps + product.cps,
    closingQuantity: sum.closingQuantity + product.closingQuantity,
    closingInventoryValue: sum.closingInventoryValue + product.closingInventoryValue,
  }), { cpp: 0, cps: 0, closingQuantity: 0, closingInventoryValue: 0 })
}


export type ComfarProductionStockInput = {
  openingStock: number
  salesQuantity: number
  closingStockRequirement: number
}

/** COMFAR III production/sales schedule: production = sales + closing stock - opening stock. */
export function calculateComfarProductionRequirement(input: ComfarProductionStockInput) {
  const values = [input.openingStock, input.salesQuantity, input.closingStockRequirement]
  if (!values.every(finiteNonNegative)) throw new Error('مقادیر فروش و موجودی اول/پایان باید محدود و نامنفی باشند')
  const productionQuantity = input.salesQuantity + input.closingStockRequirement - input.openingStock
  if (productionQuantity < -1e-9) throw new Error('موجودی اول دوره برای فروش و موجودی پایان تعیین‌شده کافی است؛ تولید منفی مجاز نیست')
  return { productionQuantity: Math.max(0, productionQuantity), openingStock: input.openingStock, salesQuantity: input.salesQuantity, closingStock: input.closingStockRequirement }
}

export type ProductIncomeStatementInput = {
  productId: string
  currency: string
  salesRevenue: number
  cpp: number
  openingInventoryValue: number
  closingInventoryValue: number
}

/** Product-level P&L bridge; cost of sales follows opening stock + current production cost - closing stock. */
export function calculateProductIncomeStatementLine(input: ProductIncomeStatementInput) {
  const values = [input.salesRevenue, input.cpp, input.openingInventoryValue, input.closingInventoryValue]
  if (!input.productId.trim() || !input.currency.trim() || !values.every(finiteNonNegative)) throw new Error('ورودی سطر سود و زیان محصول معتبر نیست')
  const availableCost = input.openingInventoryValue + input.cpp
  if (input.closingInventoryValue > availableCost + 1e-9) throw new Error('ارزش موجودی پایان از بهای کالای قابل فروش بیشتر است')
  const cps = availableCost - input.closingInventoryValue
  return { productId: input.productId, currency: input.currency, salesRevenue: input.salesRevenue, cpp: input.cpp, cps, grossProfit: input.salesRevenue - cps, closingInventoryAsset: input.closingInventoryValue }
}
