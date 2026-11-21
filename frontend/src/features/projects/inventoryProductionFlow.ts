/**
 * Periodic raw-material and work-in-process inventory roll-forward.
 * Weighted-average raw-material valuation and weighted-average process costing.
 * All values are explicit source inputs; missing data blocks the schedule.
 */
export type InventoryFlowInput = {
  openingRawMaterialQuantity: number
  openingRawMaterialValue: number
  rawMaterialPurchasesQuantity: number[]
  rawMaterialPurchasesValue: number[]
  rawMaterialConsumptionQuantity: number[]
  rawMaterialWasteQuantity: number[]
  openingWipQuantity: number
  openingWipMaterialValue: number
  openingWipConversionValue: number
  unitsStarted: number[]
  unitsCompleted: number[]
  closingWipQuantity: number[]
  materialCompletionPercent: number[]
  conversionCompletionPercent: number[]
  conversionCost: number[]
}

export type InventoryFlowPeriod = {
  period: number
  openingRawMaterialQuantity: number
  openingRawMaterialValue: number
  purchasesQuantity: number
  consumptionQuantity: number
  normalWasteQuantity: number
  normalWasteValue: number
  closingRawMaterialQuantity: number
  weightedAverageRawMaterialUnitCost: number
  purchasesValue: number
  consumptionValue: number
  closingRawMaterialValue: number
  openingWipQuantity: number
  openingWipMaterialValue: number
  openingWipConversionValue: number
  unitsStarted: number
  unitsCompleted: number
  closingWipQuantity: number
  materialEquivalentUnits: number
  conversionEquivalentUnits: number
  materialCostPerEquivalentUnit: number
  conversionCostPerEquivalentUnit: number
  completedProductionMaterialCost: number
  completedProductionConversionCost: number
  completedProductionCost: number
  closingWipMaterialValue: number
  closingWipConversionValue: number
  closingWipValue: number
  materialQuantityVariance: number
  wipQuantityVariance: number
  materialValueVariance: number
  wipValueVariance: number
}

export type InventoryFlowSchedule = {
  valid: boolean
  issues: string[]
  rows: InventoryFlowPeriod[]
  totalPurchasesValue: number
  totalMaterialConsumptionValue: number
  totalCompletedProductionCost: number
  closingRawMaterialQuantity: number | null
  closingRawMaterialValue: number | null
  closingWipQuantity: number | null
  closingWipValue: number | null
}

const finiteNonNegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0
const closeEnough = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))

/**
 * Reconciles purchase -> raw-material stock -> consumption -> WIP -> completed output.
 * Weighted-average material cost is used for issues. Weighted-average equivalent-unit
 * costing allocates opening WIP plus current material/conversion costs to completed
 * units and closing WIP. This function does not post finished-goods sales; its completed
 * production cost is the transfer value to the finished-goods subledger.
 */
export function buildInventoryFlowSchedule(input: InventoryFlowInput): InventoryFlowSchedule {
  const issues: string[] = []
  const count = input.rawMaterialPurchasesQuantity.length
  const arrays: (keyof InventoryFlowInput)[] = [
    'rawMaterialPurchasesValue','rawMaterialConsumptionQuantity','rawMaterialWasteQuantity','unitsStarted','unitsCompleted',
    'closingWipQuantity','materialCompletionPercent','conversionCompletionPercent','conversionCost',
  ]
  if (!count) issues.push('At least one inventory period is required.')
  for (const key of arrays) {
    const value = input[key]
    if (!Array.isArray(value) || value.length !== count)
      issues.push(key + ' must contain one value for every period.')
  }
  const openingFields: (keyof InventoryFlowInput)[] = [
    'openingRawMaterialQuantity','openingRawMaterialValue','openingWipQuantity',
    'openingWipMaterialValue','openingWipConversionValue',
  ]
  for (const key of openingFields) if (!finiteNonNegative(input[key]))
    issues.push(key + ' must be an explicit finite non-negative amount.')
  if (issues.length) return empty(issues)

  const rows: InventoryFlowPeriod[] = []
  let rawQty = input.openingRawMaterialQuantity
  let rawValue = input.openingRawMaterialValue
  let wipQty = input.openingWipQuantity
  let wipMaterialValue = input.openingWipMaterialValue
  let wipConversionValue = input.openingWipConversionValue

  for (let i = 0; i < count; i++) {
    const values = [
      input.rawMaterialPurchasesQuantity[i], input.rawMaterialPurchasesValue[i],
      input.rawMaterialConsumptionQuantity[i], input.rawMaterialWasteQuantity[i], input.unitsStarted[i], input.unitsCompleted[i],
      input.closingWipQuantity[i], input.materialCompletionPercent[i],
      input.conversionCompletionPercent[i], input.conversionCost[i],
    ]
    if (values.some(value => !finiteNonNegative(value))) {
      issues.push('Period ' + (i + 1) + ' contains missing, negative or non-finite inventory-flow data.')
      continue
    }
    const [purchasesQty,purchasesValue,consumptionQty,wasteQty,started,completed,closingWip,
      materialPct,conversionPct,conversionCost] = values as number[]
    if (materialPct > 100 || conversionPct > 100)
      issues.push('Period ' + (i + 1) + ' WIP completion percentages must be between 0 and 100.')
    const availableRawQty = rawQty + purchasesQty
    const availableRawValue = rawValue + purchasesValue
    if (consumptionQty + wasteQty > availableRawQty + 1e-7)
      issues.push('Period ' + (i + 1) + ' raw-material consumption plus normal waste exceeds available stock.')
    const materialUnitCost = availableRawQty > 0 ? availableRawValue / availableRawQty : 0
    const consumptionValue = consumptionQty * materialUnitCost
    const normalWasteValue = wasteQty * materialUnitCost
    const closingRawQty = availableRawQty - consumptionQty - wasteQty
    const closingRawValue = availableRawValue - consumptionValue - normalWasteValue
    const quantityVariance = rawQty + purchasesQty - consumptionQty - closingRawQty
    const wipQuantityVariance = wipQty + started - completed - closingWip
    if (!closeEnough(wipQty + started, completed + closingWip))
      issues.push('Period ' + (i + 1) + ' WIP quantity roll-forward does not reconcile.')

    const materialPool = wipMaterialValue + consumptionValue + normalWasteValue
    const conversionPool = wipConversionValue + conversionCost
    const materialEquivalentUnits = completed + closingWip * materialPct / 100
    const conversionEquivalentUnits = completed + closingWip * conversionPct / 100
    if ((materialPool > 0 && materialEquivalentUnits <= 0) ||
        (conversionPool > 0 && conversionEquivalentUnits <= 0))
      issues.push('Period ' + (i + 1) + ' has WIP cost but no equivalent units for allocation.')
    const materialPerEU = materialEquivalentUnits > 0 ? materialPool / materialEquivalentUnits : 0
    const conversionPerEU = conversionEquivalentUnits > 0 ? conversionPool / conversionEquivalentUnits : 0
    const closingWipMaterialValue = closingWip * materialPct / 100 * materialPerEU
    const closingWipConversionValue = closingWip * conversionPct / 100 * conversionPerEU
    const completedMaterial = materialPool - closingWipMaterialValue
    const completedConversion = conversionPool - closingWipConversionValue
    const closingWipValue = closingWipMaterialValue + closingWipConversionValue
    const materialValueVariance = materialPool - completedMaterial - closingWipMaterialValue
    const wipValueVariance = materialPool + conversionPool - completedMaterial - completedConversion - closingWipValue
    rows.push({
      period:i+1, openingRawMaterialQuantity:rawQty, openingRawMaterialValue:rawValue, purchasesQuantity:purchasesQty,
      consumptionQuantity:consumptionQty, normalWasteQuantity:wasteQty, normalWasteValue, closingRawMaterialQuantity:closingRawQty,
      weightedAverageRawMaterialUnitCost:materialUnitCost, purchasesValue,
      consumptionValue, closingRawMaterialValue:closingRawValue,
      openingWipQuantity:wipQty, openingWipMaterialValue:wipMaterialValue,
      openingWipConversionValue:wipConversionValue, unitsStarted:started, unitsCompleted:completed,
      closingWipQuantity:closingWip, materialEquivalentUnits, conversionEquivalentUnits,
      materialCostPerEquivalentUnit:materialPerEU, conversionCostPerEquivalentUnit:conversionPerEU,
      completedProductionMaterialCost:completedMaterial,
      completedProductionConversionCost:completedConversion,
      completedProductionCost:completedMaterial+completedConversion,
      closingWipMaterialValue, closingWipConversionValue, closingWipValue,
      materialQuantityVariance:quantityVariance, wipQuantityVariance,
      materialValueVariance, wipValueVariance,
    })
    rawQty=closingRawQty; rawValue=closingRawValue; wipQty=closingWip
    wipMaterialValue=closingWipMaterialValue; wipConversionValue=closingWipConversionValue
  }
  if (issues.length) return empty(issues)
  return {
    valid:true,issues,rows,
    totalPurchasesValue:rows.reduce((s,r)=>s+r.purchasesValue,0),
    totalMaterialConsumptionValue:rows.reduce((s,r)=>s+r.consumptionValue,0),
    totalCompletedProductionCost:rows.reduce((s,r)=>s+r.completedProductionCost,0),
    closingRawMaterialQuantity:rawQty,closingRawMaterialValue:rawValue,
    closingWipQuantity:wipQty,closingWipValue:wipMaterialValue+wipConversionValue,
  }
}

function empty(issues: string[]): InventoryFlowSchedule {
  return {valid:false,issues,rows:[],totalPurchasesValue:0,totalMaterialConsumptionValue:0,
    totalCompletedProductionCost:0,closingRawMaterialQuantity:null,closingRawMaterialValue:null,
    closingWipQuantity:null,closingWipValue:null}
}
