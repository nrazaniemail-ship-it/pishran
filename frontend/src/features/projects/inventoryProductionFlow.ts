import type { InventoryStageTransfer } from './inventoryControlLedgers'
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
  normalRawMaterialWasteQuantity: number[]
  abnormalRawMaterialWasteQuantity: number[]
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
  abnormalWasteQuantity: number
  abnormalWasteValue: number
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
    'rawMaterialPurchasesValue','rawMaterialConsumptionQuantity','normalRawMaterialWasteQuantity','abnormalRawMaterialWasteQuantity','unitsStarted','unitsCompleted',
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
  if (input.openingRawMaterialQuantity === 0 && input.openingRawMaterialValue > 0)
    issues.push('Opening raw-material value cannot be positive when opening raw-material quantity is zero.')
  if (input.openingWipQuantity === 0 &&
      (input.openingWipMaterialValue > 0 || input.openingWipConversionValue > 0))
    issues.push('Opening WIP value cannot be positive when opening WIP quantity is zero.')
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
      input.rawMaterialConsumptionQuantity[i], input.normalRawMaterialWasteQuantity[i], input.abnormalRawMaterialWasteQuantity[i], input.unitsStarted[i], input.unitsCompleted[i],
      input.closingWipQuantity[i], input.materialCompletionPercent[i],
      input.conversionCompletionPercent[i], input.conversionCost[i],
    ]
    if (values.some(value => !finiteNonNegative(value))) {
      issues.push('Period ' + (i + 1) + ' contains missing, negative or non-finite inventory-flow data.')
      continue
    }
    const [purchasesQty,purchasesValue,consumptionQty,normalWasteQty,abnormalWasteQty,started,completed,closingWip,
      materialPct,conversionPct,conversionCost] = values as number[]
    if (materialPct > 100 || conversionPct > 100)
      issues.push('Period ' + (i + 1) + ' WIP completion percentages must be between 0 and 100.')
    const availableRawQty = rawQty + purchasesQty
    const availableRawValue = rawValue + purchasesValue
    if (availableRawQty === 0 && availableRawValue > 0)
      issues.push('Period ' + (i + 1) + ' raw-material value cannot be positive when available quantity is zero.')
    if (consumptionQty + normalWasteQty + abnormalWasteQty > availableRawQty + 1e-7)
      issues.push('Period ' + (i + 1) + ' raw-material consumption plus normal and abnormal waste exceeds available stock.')
    const materialUnitCost = availableRawQty > 0 ? availableRawValue / availableRawQty : 0
    const consumptionValue = consumptionQty * materialUnitCost
    const normalWasteValue = normalWasteQty * materialUnitCost
    const abnormalWasteValue = abnormalWasteQty * materialUnitCost
    const closingRawQty = availableRawQty - consumptionQty - normalWasteQty - abnormalWasteQty
    const closingRawValue = availableRawValue - consumptionValue - normalWasteValue - abnormalWasteValue
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
      consumptionQuantity:consumptionQty, normalWasteQuantity:normalWasteQty, normalWasteValue,
      abnormalWasteQuantity:abnormalWasteQty, abnormalWasteValue, closingRawMaterialQuantity:closingRawQty,
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


export type ProductionSalesProductInput = {
  productId: string
  unitOfMeasure?: string
  periods: {
    period: string
    rawMaterialPurchasesQuantity: number | null
    rawMaterialPurchasesValue: number | null
    rawMaterialConsumptionQuantity: number | null
    normalRawMaterialWasteQuantity: number | null
    abnormalRawMaterialWasteQuantity: number | null
    unitsStarted: number | null
    unitsCompleted: number | null
    closingWipQuantity: number | null
    materialCompletionPercent: number | null
    conversionCompletionPercent: number | null
    conversionCost: number | null
    openingRawMaterialQuantity: number | null
    openingRawMaterialValue: number | null
    openingWipQuantity: number | null
    openingWipMaterialValue: number | null
    openingWipConversionValue: number | null
  }[]
}

/**
 * Adapts one product's explicitly entered production-period form into the
 * validated inventory-flow bridge. No missing amount is defaulted to zero;
 * opening balances come only from the first period and all period inputs are
 * required. The WIP-to-finished-goods destination must be the selected saleable
 * product so a valid flow cannot be routed to another product by accident.
 */
export function buildProductionBridgeDraftsFromSalesProduct(
  salesProduct: ProductionSalesProductInput,
  evidenceByPeriod: ProductionStageTransferEvidence[],
): InventoryStageTransfer[] {
  if (!salesProduct.productId?.trim() || !Array.isArray(salesProduct.periods) || !salesProduct.periods.length)
    throw new Error('A saleable product and at least one production period are required for the production bridge.')
  const fields = [
    'rawMaterialPurchasesQuantity','rawMaterialPurchasesValue','rawMaterialConsumptionQuantity',
    'normalRawMaterialWasteQuantity','abnormalRawMaterialWasteQuantity','unitsStarted','unitsCompleted',
    'closingWipQuantity','materialCompletionPercent','conversionCompletionPercent','conversionCost',
  ] as const
  const first = salesProduct.periods[0]
  const openingFields = [
    'openingRawMaterialQuantity','openingRawMaterialValue','openingWipQuantity',
    'openingWipMaterialValue','openingWipConversionValue',
  ] as const
  const opening = openingFields.map(key => first[key])
  if (opening.some(value => value === null || !finiteNonNegative(value)))
    throw new Error('The first production period requires explicit raw-material and WIP opening quantities and values.')
  const periodRows = salesProduct.periods
  for (let index = 0; index < periodRows.length; index++) {
    const row = periodRows[index]
    if (!row.period?.trim() || fields.some(key => row[key] === null || !finiteNonNegative(row[key] as number)))
      throw new Error('Production period ' + (index + 1) + ' is incomplete; every inventory-flow quantity, value and completion rate must be explicitly entered.')
    if ((row.materialCompletionPercent as number) > 100 || (row.conversionCompletionPercent as number) > 100)
      throw new Error('Production period ' + (index + 1) + ' WIP completion percentages must be between 0 and 100.')
    if (index > 0 && periodRows[index - 1].period === row.period)
      throw new Error('Production period labels must be unique.')
  }
  if (evidenceByPeriod.length !== periodRows.length ||
      evidenceByPeriod.some((evidence, index) => evidence.period !== index + 1))
    throw new Error('Explicit production bridge evidence must match every production period in order.')
  if (evidenceByPeriod.some(evidence => evidence.wipToFinishedGoods.destinationProductId !== salesProduct.productId))
    throw new Error('Every WIP-to-finished-goods bridge must target the selected saleable product.')
  const schedule = buildInventoryFlowSchedule({
    openingRawMaterialQuantity: first.openingRawMaterialQuantity as number,
    openingRawMaterialValue: first.openingRawMaterialValue as number,
    openingWipQuantity: first.openingWipQuantity as number,
    openingWipMaterialValue: first.openingWipMaterialValue as number,
    openingWipConversionValue: first.openingWipConversionValue as number,
    rawMaterialPurchasesQuantity: periodRows.map(row => row.rawMaterialPurchasesQuantity as number),
    rawMaterialPurchasesValue: periodRows.map(row => row.rawMaterialPurchasesValue as number),
    rawMaterialConsumptionQuantity: periodRows.map(row => row.rawMaterialConsumptionQuantity as number),
    normalRawMaterialWasteQuantity: periodRows.map(row => row.normalRawMaterialWasteQuantity as number),
    abnormalRawMaterialWasteQuantity: periodRows.map(row => row.abnormalRawMaterialWasteQuantity as number),
    unitsStarted: periodRows.map(row => row.unitsStarted as number),
    unitsCompleted: periodRows.map(row => row.unitsCompleted as number),
    closingWipQuantity: periodRows.map(row => row.closingWipQuantity as number),
    materialCompletionPercent: periodRows.map(row => row.materialCompletionPercent as number),
    conversionCompletionPercent: periodRows.map(row => row.conversionCompletionPercent as number),
    conversionCost: periodRows.map(row => row.conversionCost as number),
  })
  if (!schedule.valid) throw new Error(schedule.issues.join(' '))
  return buildProductionStageTransferDrafts(schedule, evidenceByPeriod)
}

export type ProductionStageTransferLink = {
  sourceProductId: string
  destinationProductId: string
  sourceCostCentreId: string
  destinationCostCentreId: string
  sourceUnit: string
  destinationUnit: string
  conversionFactor: number
}
export type ProductionStageTransferEvidence = {
  period: number
  sourceReference: string
  sourceVerified: boolean
  rawMaterialsToWip: ProductionStageTransferLink
  wipToFinishedGoods: ProductionStageTransferLink
}

/**
 * Builds auditable stage-transfer drafts from a validated production-flow schedule.
 * All product, centre, unit and evidence identities must be supplied explicitly;
 * the function never guesses a BOM, cost centre, unit conversion or source reference.
 * Transfers are reclassifications only: callers must not add their values again to
 * CPP/CPS, COGS, working capital or the three financial statements.
 */
export function buildProductionStageTransferDrafts(
  schedule: InventoryFlowSchedule,
  evidenceByPeriod: ProductionStageTransferEvidence[],
): InventoryStageTransfer[] {
  const issues: string[] = []
  if (!schedule.valid || !schedule.rows.length)
    issues.push('A valid non-empty inventory production-flow schedule is required before stage-transfer drafts can be built.')
  if (evidenceByPeriod.length !== schedule.rows.length)
    issues.push('Explicit source evidence and stage identities are required for every production period.')
  const byPeriod = new Map<number, ProductionStageTransferEvidence>()
  for (const evidence of evidenceByPeriod) {
    if (!Number.isInteger(evidence.period) || evidence.period < 1 ||
        evidence.period > schedule.rows.length || byPeriod.has(evidence.period))
      issues.push('Production stage-transfer evidence contains an invalid or duplicate period.')
    byPeriod.set(evidence.period, evidence)
    if (!evidence.sourceReference?.trim() || evidence.sourceVerified !== true)
      issues.push('Every production stage transfer requires a verified source reference.')
    for (const [name, link] of [['raw-materials to WIP', evidence.rawMaterialsToWip],
                                ['WIP to finished goods', evidence.wipToFinishedGoods]] as const) {
      if (!link || !link.sourceProductId?.trim() || !link.destinationProductId?.trim() ||
          !link.sourceCostCentreId?.trim() || !link.destinationCostCentreId?.trim() ||
          !link.sourceUnit?.trim() || !link.destinationUnit?.trim() ||
          !Number.isFinite(link.conversionFactor) || link.conversionFactor <= 0) {
        issues.push('The ' + name + ' link in period ' + evidence.period +
          ' requires explicit product, cost-centre, unit and positive conversion-factor data.')
        continue
      }
      if (link.sourceProductId === link.destinationProductId &&
          link.sourceCostCentreId === link.destinationCostCentreId)
        issues.push('The ' + name + ' link in period ' + evidence.period +
          ' must identify distinct source and destination inventory locations.')
      if (link.sourceUnit === link.destinationUnit && Math.abs(link.conversionFactor - 1) > 1e-9)
        issues.push('Identical units in period ' + evidence.period + ' require a conversion factor of 1.')
    }
  }
  if (issues.length) throw new Error(issues.join(' '))
  const drafts: InventoryStageTransfer[] = []
  for (const row of schedule.rows) {
    const evidence = byPeriod.get(row.period) as ProductionStageTransferEvidence
    const links = [
      { key: 'raw-to-wip', sourceStage: 'raw-materials' as const, destinationStage: 'work-in-progress' as const,
        link: evidence.rawMaterialsToWip, quantity: row.consumptionQuantity + row.normalWasteQuantity,
        value: row.consumptionValue + row.normalWasteValue },
      { key: 'wip-to-finished-goods', sourceStage: 'work-in-progress' as const, destinationStage: 'finished-goods' as const,
        link: evidence.wipToFinishedGoods, quantity: row.unitsCompleted, value: row.completedProductionCost },
    ]
    for (const transfer of links) {
      if (transfer.quantity <= 0) {
        if (transfer.value > 1e-7)
          throw new Error('Period ' + row.period + ' ' + transfer.key +
            ' has a positive transfer value without a positive physical quantity.')
        continue
      }
      drafts.push({
        id: 'production-bridge:' + row.period + ':' + transfer.key + ':' +
          transfer.link.sourceProductId + '@' + transfer.link.sourceCostCentreId + '->' +
          transfer.link.destinationProductId + '@' + transfer.link.destinationCostCentreId,
        period: row.period, sourceStage: transfer.sourceStage, destinationStage: transfer.destinationStage,
        sourceProductId: transfer.link.sourceProductId, destinationProductId: transfer.link.destinationProductId,
        sourceCostCentreId: transfer.link.sourceCostCentreId, destinationCostCentreId: transfer.link.destinationCostCentreId,
        quantity: transfer.quantity, sourceUnit: transfer.link.sourceUnit, destinationUnit: transfer.link.destinationUnit,
        conversionFactor: transfer.link.conversionFactor, transferValue: transfer.value,
        sourceReference: evidence.sourceReference, sourceVerified: true,
      })
    }
  }
  return drafts
}
