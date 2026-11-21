export type ProductionCostComponent = 'materials' | 'directLabor' | 'energy' | 'maintenance' | 'overhead'
export type ProductionCostMapping = { variable: Record<ProductionCostComponent, number>; fixed: Record<ProductionCostComponent, number> }
const emptyComponents = (): Record<ProductionCostComponent, number> => ({
  materials: 0, directLabor: 0, energy: 0, maintenance: 0, overhead: 0,
})

/** Backward-compatible normalization for previously saved cost mappings. */
export function normalizeProductionCostMapping(value: unknown): ProductionCostMapping {
  if (!value || typeof value !== 'object') return { variable: emptyComponents(), fixed: emptyComponents() }
  const candidate = value as { variable?: unknown; fixed?: unknown } & Record<string, unknown>
  const normalize = (source: unknown) => {
    const result = emptyComponents()
    if (source && typeof source === 'object') {
      for (const key of Object.keys(result) as ProductionCostComponent[]) {
        const amount = (source as Record<string, unknown>)[key]
        if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) result[key] = amount
      }
    }
    return result
  }
  if (candidate.variable && candidate.fixed)
    return { variable: normalize(candidate.variable), fixed: normalize(candidate.fixed) }
  return { variable: normalize(candidate), fixed: emptyComponents() }
}

export type ProductionAnnualCostInput = {
  cpp: number[]
  cps: number[]
  hasProductionRecords: boolean[]
  utilization: number[]
  opexFactors: number[]
  fullCapacityVariableCashCost: number
  fullCapacityFixedCashCost: number
  mappedBaseCosts: ProductionCostMapping
}
export type ProductionCostMappingResult = {
  valid: boolean
  errors: string[]
  costOfProductsSoldByYear: number[]
  otherVariableCashCostByYear: number[]
  otherFixedCashCostByYear: number[]
  mappedVariableBaseCostTotal: number
  mappedFixedBaseCostTotal: number
}

/** Replace only the explicitly mapped portion of legacy variable costs with actual CPS. */
export function mapProductionCostsToFinance(input: ProductionAnnualCostInput): ProductionCostMappingResult {
  const errors: string[] = []
  const years = input.cps.length
  if ([input.cpp, input.hasProductionRecords, input.utilization, input.opexFactors].some(vector => vector.length !== years))
    errors.push('طول برنامه سالانه هزینه تولید و ضرایب مالی یکسان نیست')
  if (!Number.isFinite(input.fullCapacityVariableCashCost) || input.fullCapacityVariableCashCost < 0)
    errors.push('هزینه متغیر پایه باید عددی معتبر و نامنفی باشد')
  if (!Number.isFinite(input.fullCapacityFixedCashCost) || input.fullCapacityFixedCashCost < 0)
    errors.push('هزینه ثابت پایه باید عددی معتبر و نامنفی باشد')
  // Persisted projects can contain incomplete legacy objects despite the static type.
  const mapping = input.mappedBaseCosts && typeof input.mappedBaseCosts === 'object' ? input.mappedBaseCosts : undefined
  const variableSource = mapping?.variable && typeof mapping.variable === 'object' ? mapping.variable : undefined
  const fixedSource = mapping?.fixed && typeof mapping.fixed === 'object' ? mapping.fixed : undefined
  const variableEntries = variableSource ? Object.entries(variableSource) as [ProductionCostComponent, number][] : []
  const fixedEntries = fixedSource ? Object.entries(fixedSource) as [ProductionCostComponent, number][] : []
  if (!variableSource || !fixedSource || [...variableEntries, ...fixedEntries].some(([, value]) => !Number.isFinite(value) || value < 0))
    errors.push('مبالغ نگاشت هزینه پایه باید محدود و نامنفی باشند')
  const mappedVariableBaseCostTotal = variableEntries.reduce((sum, [, value]) => sum + value, 0)
  const mappedFixedBaseCostTotal = fixedEntries.reduce((sum, [, value]) => sum + value, 0)
  if (!Number.isFinite(mappedVariableBaseCostTotal) || !Number.isFinite(mappedFixedBaseCostTotal))
    errors.push('جمع اجزای نگاشت هزینه پایه از محدوده عددی معتبر خارج است')
  if (mappedVariableBaseCostTotal > input.fullCapacityVariableCashCost + 0.005)
    errors.push('جمع اجزای نگاشت متغیر از کل هزینه متغیر پایه بیشتر است')
  if (mappedFixedBaseCostTotal > input.fullCapacityFixedCashCost + 0.005)
    errors.push('جمع اجزای نگاشت ثابت از کل هزینه ثابت پایه بیشتر است؛ اتصال CPS برای جلوگیری از دوباره‌شماری متوقف شد')
  if (input.cpp.some(value => !Number.isFinite(value) || value < 0) || input.cps.some(value => !Number.isFinite(value) || value < 0) ||
      input.utilization.some(value => !Number.isFinite(value) || value < 0 || value > 1) || input.hasProductionRecords.some(value => typeof value !== 'boolean') ||
      input.opexFactors.some(value => !Number.isFinite(value) || value < 0))
    errors.push('CPS، ضریب ظرفیت یا ضریب تعدیل هزینه دارای مقدار نامعتبر است')
  if (errors.length) return { valid: false, errors, costOfProductsSoldByYear: [], otherVariableCashCostByYear: [], otherFixedCashCostByYear: [], mappedVariableBaseCostTotal, mappedFixedBaseCostTotal }
  const costOfProductsSoldByYear = input.cps.map((cps, index) => input.hasProductionRecords[index] ? cps : 0)
  const otherVariableCashCostByYear = input.cps.map((_, index) => {
    const remainingBase = input.hasProductionRecords[index]
      ? input.fullCapacityVariableCashCost - mappedVariableBaseCostTotal
      : input.fullCapacityVariableCashCost
    return remainingBase * input.utilization[index] * input.opexFactors[index]
  })
  const otherFixedCashCostByYear = input.cps.map((_, index) => {
    const remainingBase = input.hasProductionRecords[index]
      ? input.fullCapacityFixedCashCost - mappedFixedBaseCostTotal
      : input.fullCapacityFixedCashCost
    return remainingBase * input.utilization[index] * input.opexFactors[index]
  })
  return { valid: true, errors, costOfProductsSoldByYear, otherVariableCashCostByYear, otherFixedCashCostByYear, mappedVariableBaseCostTotal, mappedFixedBaseCostTotal }
}
