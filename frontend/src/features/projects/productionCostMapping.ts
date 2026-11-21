export type ProductionCostComponent = 'materials' | 'directLabor' | 'energy' | 'maintenance' | 'overhead'
export type ProductionCostMapping = Record<ProductionCostComponent, number>
export type ProductionAnnualCostInput = {
  cpp: number[]
  cps: number[]
  hasProductionRecords: boolean[]
  utilization: number[]
  opexFactors: number[]
  fullCapacityVariableCashCost: number
  mappedBaseCosts: ProductionCostMapping
}
export type ProductionCostMappingResult = {
  valid: boolean
  errors: string[]
  costOfProductsSoldByYear: number[]
  otherVariableCashCostByYear: number[]
  mappedBaseCostTotal: number
}

/** Replace only the explicitly mapped portion of legacy variable costs with actual CPS. */
export function mapProductionCostsToFinance(input: ProductionAnnualCostInput): ProductionCostMappingResult {
  const errors: string[] = []
  const years = input.cps.length
  if ([input.cpp, input.hasProductionRecords, input.utilization, input.opexFactors].some(vector => vector.length !== years))
    errors.push('طول برنامه سالانه هزینه تولید و ضرایب مالی یکسان نیست')
  if (!Number.isFinite(input.fullCapacityVariableCashCost) || input.fullCapacityVariableCashCost < 0)
    errors.push('هزینه متغیر پایه باید عددی معتبر و نامنفی باشد')
  const entries = Object.entries(input.mappedBaseCosts) as [ProductionCostComponent, number][]
  if (entries.some(([, value]) => !Number.isFinite(value) || value < 0))
    errors.push('مبالغ نگاشت هزینه پایه باید محدود و نامنفی باشند')
  const mappedBaseCostTotal = entries.reduce((sum, [, value]) => sum + value, 0)
  if (mappedBaseCostTotal > input.fullCapacityVariableCashCost + 0.005)
    errors.push('جمع اجزای نگاشت‌شده از کل هزینه متغیر پایه بیشتر است؛ اتصال CPS برای جلوگیری از دوباره‌شماری متوقف شد')
  if (input.cps.some(value => !Number.isFinite(value) || value < 0) ||
      input.utilization.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
      input.opexFactors.some(value => !Number.isFinite(value) || value < 0))
    errors.push('CPS، ضریب ظرفیت یا ضریب تعدیل هزینه دارای مقدار نامعتبر است')
  if (errors.length) return { valid: false, errors, costOfProductsSoldByYear: [], otherVariableCashCostByYear: [], mappedBaseCostTotal }
  const costOfProductsSoldByYear = input.cps.map((cps, index) => input.hasProductionRecords[index] ? cps : 0)
  const otherVariableCashCostByYear = input.cps.map((_, index) => {
    const remainingBase = input.hasProductionRecords[index]
      ? input.fullCapacityVariableCashCost - mappedBaseCostTotal
      : input.fullCapacityVariableCashCost
    return remainingBase * input.utilization[index] * input.opexFactors[index]
  })
  return { valid: true, errors, costOfProductsSoldByYear, otherVariableCashCostByYear, mappedBaseCostTotal }
}
