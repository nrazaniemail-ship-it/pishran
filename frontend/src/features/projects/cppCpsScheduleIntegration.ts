import type { ProductOperatingSchedule, ProductOperatingPeriodRow } from './productOperatingSchedule'
import type { CppCpsTraceLedger, CppCpsTracePeriodRow } from './cppCpsCostTraceability'
import type { CostCentreFormDraft } from './projectModelFormDrafts'

export type CppCpsTracePathRow = {
  itemId: string
  category: CppCpsTracePeriodRow['category']
  period: number
  productId: string
  postingStatus: 'incremental' | 'base-covered'
  grossCost: number
  baseCoveredCost: number
  incrementalCpp: number
  openingWipCarry: number
  completedProductionCpp: number
  closingWipCpp: number
  openingFinishedGoodsCarry: number
  costOfSalesCpp: number
  closingFinishedGoodsCpp: number
  grossProfitImpact: number
  workingCapitalImpact: number
}

export type CppCpsProductScheduleBinding = {
  valid: boolean
  issues: string[]
  schedule: ProductOperatingSchedule | null
  incrementalCppByPeriod: number[]
  tracePathRows: CppCpsTracePathRow[]
}

/**
 * Posts only source-complete incremental manufacturing costs into production.
 * The existing base CPP remains in the product schedule; this adapter adds only
 * the uncovered portion from the trace ledger, then revalues WIP/finished goods
 * through weighted-average inventory and recalculates CPS and gross profit.
 */
export function bindCppCpsTraceLedgerToProductSchedule(
  schedule: ProductOperatingSchedule,
  ledger: CppCpsTraceLedger,
  periodFiscalYearIndexes: number[],
  costCentres: CostCentreFormDraft[] = [],
): CppCpsProductScheduleBinding {
  const issues: string[] = []
  const periodCount = schedule.periodRevenue.length
  if (!schedule.valid) issues.push('A valid product operating schedule is required before CPP/CPS posting.')
  if (!ledger.valid || !ledger.complete || !ledger.readyForCppPosting)
    issues.push('CPP/CPS source ledger is incomplete or invalid; posting is blocked until all cost evidence is verified.')
  if (ledger.completeIncrementalByPeriod.length !== periodCount ||
      ledger.completeIncrementalByPeriod.some(value => value === null || !Number.isFinite(value) || value < 0))
    issues.push('Complete non-negative incremental CPP amounts are required for every period.')
  if (periodFiscalYearIndexes.length !== periodCount ||
      periodFiscalYearIndexes.some(value => !Number.isInteger(value) || value < 0))
    issues.push('A valid fiscal-year index is required for every project period.')
  if (schedule.rows.some(row => !Number.isInteger(row.period) || row.period < 1 || row.period > periodCount))
    issues.push('Product schedule contains an invalid period index.')
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [], tracePathRows: [] }

  const itemAllocations = new Map<string, {
    itemId: string
    category: CppCpsTracePeriodRow['category']
    period: number
    productId: string
    grossCost: number
    baseCoveredCost: number
    incrementalCpp: number
  }>()
  const incrementalCppByPeriod = ledger.completeIncrementalByPeriod as number[]
  const traceRowsByItemPeriod = new Map<string, CppCpsTracePeriodRow[]>()
  for (const traceRow of ledger.rows) {
    const key = traceRow.itemId + ':' + traceRow.period
    const current = traceRowsByItemPeriod.get(key) ?? []
    current.push(traceRow)
    traceRowsByItemPeriod.set(key, current)
  }

  for (const [key, traceRows] of traceRowsByItemPeriod) {
    const trace = traceRows[0]
    if (trace.incrementalCpp === null || trace.sourceStatus !== 'verified') {
      issues.push('Unverified cost item cannot be posted: ' + key)
      continue
    }
    const amount = trace.incrementalCpp
    // Keep fully base-covered items in the item/product trace with a zero posting.
    // They still need a product allocation path for visibility, but add no CPP.
    const periodRows = schedule.rows.filter(row => row.period === trace.period)
    if (!periodRows.length) {
      issues.push('No production schedule rows exist for cost item ' + key + '.')
      continue
    }
    let weights: { row: ProductOperatingPeriodRow; weight: number }[] = []
    if (trace.allocationMethod === 'direct-product') {
      const target = periodRows.find(row => row.productId === trace.productId)
      if (!target) {
        issues.push('Direct cost item ' + key + ' has no matching product in its period.')
        continue
      }
      weights = [{ row: target, weight: 1 }]
    } else if (trace.allocationMethod === 'production-quantity') {
      weights = periodRows.map(row => ({ row, weight: row.productionQuantity }))
    } else if (trace.allocationMethod === 'revenue') {
      weights = periodRows.map(row => ({ row, weight: row.netSalesRevenue }))
    } else if (trace.allocationMethod === 'cost-centre-driver') {
      const centre = costCentres.find(item => item.id === trace.costCentreId)
      if (!centre?.allocationBasis) {
        issues.push('Cost item ' + key + ' requires a defined cost-centre allocation basis.')
        continue
      }
      if (centre.allocationBasis === 'production-quantity') {
        weights = periodRows.map(row => ({ row, weight: row.productionQuantity }))
      } else if (centre.allocationBasis === 'sales-revenue') {
        weights = periodRows.map(row => ({ row, weight: row.netSalesRevenue }))
      } else {
        const driverRows = centre.driverRows.filter(driver => driver.period === trace.period)
        const unexpected = driverRows.filter(driver => !periodRows.some(row => row.productId === driver.productId))
        if (unexpected.length) {
          issues.push('Cost centre ' + centre.id + ' has manual driver rows for products outside period ' + trace.period + '.')
          continue
        }
        const missing = periodRows.filter(row => !driverRows.some(driver => driver.productId === row.productId))
        if (missing.length || driverRows.some(driver => driver.amount === null || !Number.isFinite(driver.amount) || driver.amount < 0)) {
          issues.push('Cost centre ' + centre.id + ' requires a valid manual driver amount for every product in period ' + trace.period + '.')
          continue
        }
        weights = periodRows.map(row => ({
          row,
          weight: driverRows.find(driver => driver.productId === row.productId)!.amount as number,
        }))
      }
    } else {
      issues.push('Cost item ' + key + ' has a positive uncovered amount but no allocation method.')
      continue
    }
    const denominator = weights.reduce((sum, item) => sum + item.weight, 0)
    if (!Number.isFinite(denominator) || denominator <= 0) {
      issues.push('Cost item ' + key + ' cannot be allocated because its selected driver totals zero.')
      continue
    }
    for (const entry of weights) {
      if (entry.weight <= 0) continue
      if (entry.row.productionQuantity <= 0) {
        issues.push('Cost item ' + key + ' would allocate CPP to a product with no production.')
        continue
      }
      const share = entry.weight / denominator
      const allocatedAmount = amount * share
      const itemKey = trace.itemId + ':' + entry.row.productId + ':' + entry.row.period
      const currentItem = itemAllocations.get(itemKey) ?? {
        itemId: trace.itemId,
        category: trace.category,
        period: entry.row.period,
        productId: entry.row.productId,
        grossCost: 0,
        baseCoveredCost: 0,
        incrementalCpp: 0,
      }
      currentItem.grossCost += (trace.grossCost ?? 0) * share
      currentItem.baseCoveredCost += (trace.baseCoveredCost ?? 0) * share
      currentItem.incrementalCpp += allocatedAmount
      itemAllocations.set(itemKey, currentItem)
    }
  }
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [], tracePathRows: [] }

  const closingByProduct = new Map<string, { quantity: number; value: number; period: number }>()
  const openingWipByItemProduct = new Map<string, number>()
  const openingFinishedGoodsByItemProduct = new Map<string, number>()
  const itemCategoryByItemProduct = new Map<string, CppCpsTracePeriodRow['category']>()
  const itemProductKey = (itemId: string, productId: string) => itemId + '\u0000' + productId
  const tracePathRows: CppCpsTracePathRow[] = []
  const rows: ProductOperatingPeriodRow[] = []
  for (const row of schedule.rows) {
    const previous = closingByProduct.get(row.productId)
    if (previous && previous.period === row.period - 1 &&
        Math.abs(previous.quantity - row.openingInventoryQuantity) > 0.000001) {
      issues.push('Product ' + row.productId + ' opening quantity does not reconcile to prior-period closing stock.')
      continue
    }
    const openingInventoryValue = previous && previous.period === row.period - 1
      ? previous.value : row.openingInventoryValue
    const currentItems = [...itemAllocations.values()].filter(item =>
      item.productId === row.productId && item.period === row.period)
    const carriedItemKeys = [...openingWipByItemProduct.keys(), ...openingFinishedGoodsByItemProduct.keys()]
      .filter(key => key.endsWith('\u0000' + row.productId))
    const itemIds = new Set([
      ...currentItems.map(item => item.itemId),
      ...carriedItemKeys.map(key => key.slice(0, key.indexOf('\u0000'))),
    ])
    let completedCpp = 0
    let wipCpp = 0
    for (const itemId of itemIds) {
      const itemKey = itemProductKey(itemId, row.productId)
      const current = currentItems.find(item => item.itemId === itemId)
      const category = current?.category ?? itemCategoryByItemProduct.get(itemKey)
      if (!category) {
        issues.push('CPP/CPS trace item ' + itemId + ' has no category for carried inventory in product ' + row.productId + '.')
        continue
      }
      itemCategoryByItemProduct.set(itemKey, category)
      const openingWipCarry = openingWipByItemProduct.get(itemKey) ?? 0
      const currentIncrementalCpp = current?.incrementalCpp ?? 0
      const itemPool = openingWipCarry + currentIncrementalCpp
      let completedItemCpp = itemPool
      let closingWipItemCpp = 0
      if (row.hasInventoryFlow && itemPool > 0) {
        const equivalentUnits = category === 'materials'
          ? row.materialEquivalentUnits : row.conversionEquivalentUnits
        if (!Number.isFinite(equivalentUnits) || equivalentUnits <= 0) {
          issues.push('Product ' + row.productId + ' period ' + row.period + ' has carried or current CPP item ' + itemId + ' but no valid equivalent units.')
          continue
        }
        const rate = itemPool / equivalentUnits
        completedItemCpp = row.completedUnits * rate
        closingWipItemCpp = Math.max(0, equivalentUnits - row.completedUnits) * rate
        if (Math.abs(completedItemCpp + closingWipItemCpp - itemPool) >
            1e-7 * Math.max(1, itemPool)) {
          issues.push('CPP/CPS item ' + itemId + ' does not reconcile between completed production and closing WIP in period ' + row.period + '.')
          continue
        }
      } else if (!row.hasInventoryFlow && openingWipCarry > 1e-8) {
        issues.push('CPP/CPS item ' + itemId + ' has opening WIP carry but product ' + row.productId + ' has no inventory-flow equivalent units in period ' + row.period + '.')
        continue
      }
      const openingFinishedGoodsCarry = openingFinishedGoodsByItemProduct.get(itemKey) ?? 0
      const availableQuantity = row.openingInventoryQuantity + row.productionQuantity
      if (availableQuantity <= 0 && openingFinishedGoodsCarry + completedItemCpp > 1e-8) {
        issues.push('CPP/CPS item ' + itemId + ' has finished-goods cost but no available product quantity in period ' + row.period + '.')
        continue
      }
      const unitCostContribution = availableQuantity > 0
        ? (openingFinishedGoodsCarry + completedItemCpp) / availableQuantity : 0
      const costOfSalesCpp = row.salesQuantity * unitCostContribution
      const closingFinishedGoodsCpp = row.closingInventoryQuantity * unitCostContribution
      const finishedGoodsPool = openingFinishedGoodsCarry + completedItemCpp
      if (Math.abs(costOfSalesCpp + closingFinishedGoodsCpp - finishedGoodsPool) >
          1e-7 * Math.max(1, finishedGoodsPool)) {
        issues.push('CPP/CPS item ' + itemId + ' does not reconcile from finished goods to CPS and closing inventory in period ' + row.period + '.')
        continue
      }
      openingWipByItemProduct.set(itemKey, closingWipItemCpp)
      openingFinishedGoodsByItemProduct.set(itemKey, closingFinishedGoodsCpp)
      completedCpp += completedItemCpp
      wipCpp += closingWipItemCpp
      if (current || openingWipCarry > 0 || openingFinishedGoodsCarry > 0 || itemPool > 0) {
        const fullyBaseCovered = Boolean(current &&
          current.incrementalCpp === 0 &&
          current.grossCost > 0 &&
          current.baseCoveredCost >= current.grossCost - 1e-8 &&
          openingWipCarry === 0 &&
          openingFinishedGoodsCarry === 0)
        tracePathRows.push({
          itemId,
          category,
          period: row.period,
          productId: row.productId,
          postingStatus: fullyBaseCovered ? 'base-covered' : 'incremental',
          grossCost: current?.grossCost ?? 0,
          baseCoveredCost: current?.baseCoveredCost ?? 0,
          incrementalCpp: currentIncrementalCpp,
          openingWipCarry,
          completedProductionCpp: completedItemCpp,
          closingWipCpp: closingWipItemCpp,
          openingFinishedGoodsCarry,
          costOfSalesCpp,
          closingFinishedGoodsCpp,
          grossProfitImpact: -costOfSalesCpp,
          workingCapitalImpact: closingWipItemCpp + closingFinishedGoodsCpp,
        })
      }
    }
    const productionCost = row.productionCost + completedCpp
    const wipInventoryValue = row.wipInventoryValue + wipCpp
    const unitProductionCost = row.productionQuantity > 0
      ? productionCost / row.productionQuantity
      : row.unitProductionCost
    const availableQuantity = row.openingInventoryQuantity + row.productionQuantity
    const availableValue = openingInventoryValue + productionCost
    const weightedAverageUnitCost = availableQuantity > 0 ? availableValue / availableQuantity : 0
    const costOfSales = row.salesQuantity * weightedAverageUnitCost
    const closingInventoryValue = row.closingInventoryQuantity * weightedAverageUnitCost
    const revisedRow = {
      ...row, openingInventoryValue, productionCost, unitProductionCost, weightedAverageUnitCost,
      wipInventoryValue, costOfSales, closingInventoryValue, grossProfit: row.netSalesRevenue - costOfSales,
    }
    rows.push(revisedRow)
    closingByProduct.set(row.productId, {
      quantity: row.closingInventoryQuantity, value: closingInventoryValue, period: row.period,
    })
  }
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [], tracePathRows: [] }
  for (const trace of ledger.rows) {
    if (trace.sourceStatus !== 'verified' || trace.incrementalCpp !== 0 ||
        !Number.isFinite(trace.grossCost) || (trace.grossCost ?? 0) <= 0) continue
    if (tracePathRows.some(row => row.itemId === trace.itemId && row.period === trace.period)) continue
    tracePathRows.push({
      itemId: trace.itemId,
      category: trace.category,
      period: trace.period,
      productId: trace.productId ?? '—',
      postingStatus: 'base-covered',
      grossCost: trace.grossCost ?? 0,
      baseCoveredCost: trace.baseCoveredCost ?? 0,
      incrementalCpp: 0,
      openingWipCarry: 0,
      completedProductionCpp: 0,
      closingWipCpp: 0,
      openingFinishedGoodsCarry: 0,
      costOfSalesCpp: 0,
      closingFinishedGoodsCpp: 0,
      grossProfitImpact: 0,
      workingCapitalImpact: 0,
    })
  }
  const periodCostOfSales = Array(periodCount).fill(0) as number[]
  const periodWipInventoryValue = Array(periodCount).fill(0) as number[]
  let totalClosingInventoryValue = 0
  for (const row of rows) {
    periodCostOfSales[row.period - 1] += row.costOfSales
    periodWipInventoryValue[row.period - 1] += row.wipInventoryValue
    totalClosingInventoryValue += row.closingInventoryValue
  }
  const fiscalYearCount = periodFiscalYearIndexes.length
    ? Math.max(...periodFiscalYearIndexes) + 1 : 0
  const annualCostOfSales = Array(fiscalYearCount).fill(0) as number[]
  periodCostOfSales.forEach((amount, periodIndex) => {
    annualCostOfSales[periodFiscalYearIndexes[periodIndex]] += amount
  })
  return {
    valid: true, issues: [],
    schedule: { ...schedule, rows, periodCostOfSales, periodWipInventoryValue, annualCostOfSales, totalClosingInventoryValue },
    incrementalCppByPeriod: [...incrementalCppByPeriod],
    tracePathRows,
  }
}

export type FinishedGoodsWorkingCapitalBinding = {
  valid: boolean
  issues: string[]
  closingWorkingCapitalByPeriod: number[]
  inventoryAddedByPeriod: number[]
}

/**
 * Add finished-goods closing values to net working capital only when the user
 * has not already entered a dedicated finished-goods component. This avoids
 * double counting and deliberately retains terminal stock as an asset.
 */
export function bindFinishedGoodsInventoryToWorkingCapital(
  closingWorkingCapitalByPeriod: number[],
  schedule: ProductOperatingSchedule | null,
  hasExplicitFinishedGoodsComponent: boolean,
  estimatedFinishedGoodsByPeriod: number[] = [],
): FinishedGoodsWorkingCapitalBinding {
  const issues: string[] = []
  if (!Array.isArray(closingWorkingCapitalByPeriod) ||
      closingWorkingCapitalByPeriod.some(value => !Number.isFinite(value)))
    issues.push('A finite working-capital closing balance is required for every project period.')
  if (schedule && (!schedule.valid || schedule.periodRevenue.length !== closingWorkingCapitalByPeriod.length))
    issues.push('A valid product operating schedule matching the working-capital period count is required.')
  if (estimatedFinishedGoodsByPeriod.length &&
      (estimatedFinishedGoodsByPeriod.length !== closingWorkingCapitalByPeriod.length ||
       estimatedFinishedGoodsByPeriod.some(value => !Number.isFinite(value) || value < 0)))
    issues.push('Estimated finished-goods inventory must contain one finite non-negative amount for every project period.')
  if (issues.length) return { valid: false, issues, closingWorkingCapitalByPeriod: [], inventoryAddedByPeriod: [] }

  const result = [...closingWorkingCapitalByPeriod]
  const inventoryAddedByPeriod = Array(result.length).fill(0) as number[]
  if (schedule && !hasExplicitFinishedGoodsComponent) {
    // The automatic operating-cycle estimate may already contain a finished-goods
    // allowance. Replace that estimate with the product-led closing stock instead
    // of adding the product-led value on top of it.
    for (let index = 0; index < result.length; index++) {
      const estimated = estimatedFinishedGoodsByPeriod[index] ?? 0
      result[index] -= estimated
      inventoryAddedByPeriod[index] -= estimated
    }
    for (const row of schedule.rows) {
      const index = row.period - 1
      if (!Number.isInteger(row.period) || index < 0 || index >= result.length ||
          !Number.isFinite(row.closingInventoryValue) || row.closingInventoryValue < 0) {
        issues.push('Invalid finished-goods closing value or period in product ' + row.productId + '.')
        continue
      }
      result[index] += row.closingInventoryValue
      inventoryAddedByPeriod[index] += row.closingInventoryValue
    }
  }
  if (issues.length) return { valid: false, issues, closingWorkingCapitalByPeriod: [], inventoryAddedByPeriod: [] }
  return { valid: true, issues: [], closingWorkingCapitalByPeriod: result, inventoryAddedByPeriod }
}


export type StageJournalCorrection = {
  id: string
  period: number
  kind: 'stage-transfer' | 'cost-of-sales' | 'abnormal-waste'
  productId: string
  debitAccount: string
  creditAccount: string
  amount: number
  documentType?: 'original' | 'reversal' | 'adjustment'
  originalDocumentId?: string
  adjustmentOfDocumentId?: string
}
export type StageJournalScheduleBinding = {
  valid: boolean
  issues: string[]
  schedule: ProductOperatingSchedule | null
  appliedDocumentIds: string[]
}

/**
 * Applies only append-only correction documents to the already-calculated
 * product schedule. Original preview documents are deliberately ignored:
 * their operational effects are already present in the source schedule.
 * Inventory transfers are reclassifications; COGS corrections change the
 * period expense and finished-goods value once, then carry the stock value
 * forward. Prior-period COGS corrections are blocked if later sales exist,
 * because a weighted-average re-cost would otherwise be required.
 */
export function applyStageJournalCorrectionsToProductSchedule(
  source: ProductOperatingSchedule,
  documents: StageJournalCorrection[],
  periodFiscalYearIndexes: number[],
): StageJournalScheduleBinding {
  const issues: string[] = []
  if (!source.valid) issues.push('A valid base product schedule is required before applying stage journal corrections.')
  if (periodFiscalYearIndexes.length !== source.periodRevenue.length ||
      periodFiscalYearIndexes.some(index => !Number.isInteger(index) || index < 0))
    issues.push('Fiscal-year indexes must be non-negative integers matching the product schedule period count.')
  const originalById = new Map(documents.filter(row => (row.documentType ?? 'original') === 'original').map(row => [row.id, row]))
  const allIds = new Set<string>()
  for (const row of documents) {
    if (!row.id?.trim() || allIds.has(row.id)) issues.push('Stage journal document IDs must be globally unique and non-empty.')
    allIds.add(row.id)
  }
  const ids = new Set<string>()
  const corrections = documents.filter(row => row.documentType === 'reversal' || row.documentType === 'adjustment')
  const correctionTypesByOriginal = new Map<string, Set<StageJournalCorrection['documentType']>>()
  for (const row of corrections) {
    const reference = row.documentType === 'reversal' ? row.originalDocumentId : row.adjustmentOfDocumentId
    if (!reference) continue
    const types = correctionTypesByOriginal.get(reference) ?? new Set<StageJournalCorrection['documentType']>()
    types.add(row.documentType)
    correctionTypesByOriginal.set(reference, types)
  }
  for (const [originalId, types] of correctionTypesByOriginal) {
    if (types.has('reversal') && types.has('adjustment'))
      issues.push('Original stage journal document ' + originalId + ' cannot have both a reversal and an adjustment; mixed correction chains are blocked.')
  }
  for (const row of corrections) {
    if (!row.id?.trim() || ids.has(row.id)) issues.push('Stage journal correction IDs must be unique and non-empty.')
    ids.add(row.id)
    if (!Number.isInteger(row.period) || row.period < 1 || row.period > source.periodRevenue.length)
      issues.push('Stage journal correction ' + row.id + ' has an invalid period.')
    if (!Number.isFinite(row.amount) || row.amount <= 0 || !row.productId?.trim())
      issues.push('Stage journal correction ' + row.id + ' requires a product and positive finite amount.')
    const reference = row.documentType === 'reversal' ? row.originalDocumentId : row.adjustmentOfDocumentId
    const original = reference ? originalById.get(reference) : undefined
    if (!original)
      issues.push('Stage journal correction ' + row.id + ' must reference an existing original document.')
    else {
      if (row.period < original.period)
        issues.push('Stage journal correction ' + row.id + ' cannot be applied before its original document period.')
      if (row.productId !== original.productId || row.kind !== original.kind)
        issues.push('Stage journal correction ' + row.id + ' must retain the original product and document kind.')
      if (row.documentType === 'reversal' &&
          (row.amount !== original.amount || row.debitAccount !== original.creditAccount ||
           row.creditAccount !== original.debitAccount))
        issues.push('Reversal document ' + row.id + ' must exactly reverse the original amount and debit/credit accounts.')
      if (row.documentType === 'adjustment' &&
          (row.debitAccount !== original.debitAccount || row.creditAccount !== original.creditAccount))
        issues.push('Adjustment document ' + row.id + ' must retain the original debit and credit accounts; use a reversal for an opposite-direction correction.')
    }
  }
  if (issues.length) return { valid: false, issues, schedule: null, appliedDocumentIds: [] }

  const rows = source.rows.map(row => ({ ...row }))
  const raw = [...source.periodRawMaterialInventoryValue]
  const wip = [...source.periodWipInventoryValue]
  const cogs = [...source.periodCostOfSales]
  const abnormalWasteExpense = [...source.periodAbnormalWasteExpense]
  if (abnormalWasteExpense.length !== source.periodRevenue.length ||
      abnormalWasteExpense.some(value => !Number.isFinite(value)))
    issues.push('The product schedule must contain a finite abnormal-waste expense amount for every period.')
  const appliedDocumentIds: string[] = []
  const stageField = (account: string): 'raw' | 'wip' | 'fg' | null => {
    if (account === 'Inventory:raw-materials') return 'raw'
    if (account === 'Inventory:work-in-progress') return 'wip'
    if (account === 'Inventory:finished-goods') return 'fg'
    return null
  }
  for (const document of corrections) {
    const periodIndex = document.period - 1
    const sign = 1 // reversal rows already contain the inverse debit/credit direction
    const debitStage = stageField(document.debitAccount)
    const creditStage = stageField(document.creditAccount)
    const debitCogs = document.debitAccount === 'Cost of Sales'
    const creditCogs = document.creditAccount === 'Cost of Sales'
    const supportedStageTransfer = document.kind === 'stage-transfer' && Boolean(debitStage && creditStage)
    const supportedCogsCorrection = document.kind === 'cost-of-sales' && Boolean(debitCogs !== creditCogs) &&
      ((debitCogs && creditStage === 'fg') || (creditCogs && debitStage === 'fg'))
    const supportedAbnormalWasteWriteOff = document.kind === 'abnormal-waste' &&
      ((document.debitAccount === 'Abnormal Waste Expense' && creditStage === 'raw') ||
       (debitStage === 'raw' && document.creditAccount === 'Abnormal Waste Expense'))
    if (!supportedStageTransfer && !supportedCogsCorrection && !supportedAbnormalWasteWriteOff) {
      issues.push('Stage journal correction ' + document.id + ' uses unsupported accounts; only inventory-stage, Cost of Sales, and abnormal-waste/raw-material write-off accounts can affect the product schedule.')
      continue
    }
    const deltas = new Map<'raw' | 'wip' | 'fg', number>()
    if (debitStage) deltas.set(debitStage, (deltas.get(debitStage) ?? 0) + sign * document.amount)
    if (creditStage) deltas.set(creditStage, (deltas.get(creditStage) ?? 0) - sign * document.amount)
    const cogsDelta = (debitCogs ? sign * document.amount : 0) -
      (creditCogs ? sign * document.amount : 0)
    const abnormalWasteExpenseDelta =
      (document.debitAccount === 'Abnormal Waste Expense' ? sign * document.amount : 0) -
      (document.creditAccount === 'Abnormal Waste Expense' ? sign * document.amount : 0)
    const productRows = rows.filter(row => row.productId === document.productId)
    if (!productRows.some(row => row.period === document.period)) {
      issues.push('Stage journal correction ' + document.id + ' has no matching product schedule row.')
      continue
    }
    if (Math.abs(cogsDelta) > 0 && productRows.filter(row => row.period === document.period)
        .reduce((sum, row) => sum + row.salesQuantity, 0) <= 0) {
      issues.push('Stage journal correction ' + document.id + ' changes COGS in a period without finished-goods sales.')
      continue
    }
    if (Math.abs(cogsDelta) > 0 && rows.some(row => row.productId === document.productId &&
        row.period > document.period && row.salesQuantity > 0)) {
      issues.push('Stage journal correction ' + document.id + ' changes prior-period COGS before later sales; weighted-average inventory must be recalculated first.')
      continue
    }
    for (const [stage, delta] of deltas) {
      for (let index = periodIndex; index < raw.length; index++) {
        const matching = rows.filter(row => row.productId === document.productId && row.period === index + 1)
        if (!matching.length) {
          issues.push('Stage journal correction ' + document.id + ' cannot carry ' + stage + ' inventory through missing product period ' + (index + 1) + '.')
          break
        }
        if (stage === 'raw') {
          raw[index] += delta
          for (const row of matching) row.rawMaterialInventoryValue += delta / matching.length
        } else if (stage === 'wip') {
          wip[index] += delta
          for (const row of matching) row.wipInventoryValue += delta / matching.length
        } else {
          for (const row of matching) {
            row.closingInventoryValue += delta / matching.length
            if (index > periodIndex) row.openingInventoryValue += delta / matching.length
          }
        }
      }
    }
    if (Math.abs(cogsDelta) > 0) {
      cogs[periodIndex] += cogsDelta
      const matching = rows.filter(row => row.productId === document.productId && row.period === document.period)
      for (const row of matching) {
        row.costOfSales += cogsDelta / matching.length
        row.grossProfit -= cogsDelta / matching.length
        row.weightedAverageUnitCost += cogsDelta / Math.max(1, matching.reduce((sum, item) => sum + item.salesQuantity, 0))
      }
    }
    if (supportedAbnormalWasteWriteOff) {
      abnormalWasteExpense[periodIndex] += abnormalWasteExpenseDelta
      const matching = rows.filter(row => row.productId === document.productId && row.period === document.period)
      for (const row of matching)
        row.abnormalWasteValue = (row.abnormalWasteValue ?? 0) + abnormalWasteExpenseDelta / matching.length
    }
    appliedDocumentIds.push(document.id)
  }
  if (issues.length) return { valid: false, issues, schedule: null, appliedDocumentIds: [] }
  for (let index = 0; index < source.periodRevenue.length; index++) {
    if ([raw[index], wip[index], cogs[index]].some(value => !Number.isFinite(value) || value < -0.000001))
      issues.push('Stage journal corrections create a negative or non-finite inventory/COGS balance in period ' + (index + 1) + '.')
  }
  for (const row of rows) {
    if ([row.openingInventoryValue, row.closingInventoryValue, row.costOfSales, row.grossProfit,
      row.rawMaterialInventoryValue, row.wipInventoryValue].some(value => !Number.isFinite(value) || value < -0.000001))
      issues.push('Stage journal corrections create a negative or non-finite product balance in period ' + row.period + '.')
  }
  if (issues.length) return { valid: false, issues, schedule: null, appliedDocumentIds: [] }
  const annualCount = periodFiscalYearIndexes.length ? Math.max(...periodFiscalYearIndexes) + 1 : 0
  const annualCostOfSales = Array(annualCount).fill(0) as number[]
  cogs.forEach((amount, index) => { annualCostOfSales[periodFiscalYearIndexes[index]] += amount })
  return {
    valid: true, issues: [],
    schedule: {
      ...source, rows, periodCostOfSales: cogs, annualCostOfSales,
      periodRawMaterialInventoryValue: raw, periodWipInventoryValue: wip,
      periodAbnormalWasteExpense: abnormalWasteExpense,
      totalClosingInventoryValue: rows.reduce((sum, row) => sum + row.closingInventoryValue, 0),
    },
    appliedDocumentIds,
  }
}
