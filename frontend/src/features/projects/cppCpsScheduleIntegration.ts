import type { ProductOperatingSchedule, ProductOperatingPeriodRow } from './productOperatingSchedule'
import type { CppCpsTraceLedger, CppCpsTracePeriodRow } from './cppCpsCostTraceability'

export type CppCpsProductScheduleBinding = {
  valid: boolean
  issues: string[]
  schedule: ProductOperatingSchedule | null
  incrementalCppByPeriod: number[]
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
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [] }

  const allocations = new Map<string, number>()
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
    if (amount === 0) continue
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
      const rowKey = entry.row.productId + ':' + entry.row.period + ':' + trace.category
      allocations.set(rowKey, (allocations.get(rowKey) ?? 0) + amount * entry.weight / denominator)
    }
  }
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [] }

  const closingByProduct = new Map<string, { quantity: number; value: number; period: number }>()
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
    const materialCpp = allocations.get(row.productId + ':' + row.period + ':materials') ?? 0
    const conversionCpp = (allocations.get(row.productId + ':' + row.period + ':labour') ?? 0) +
      (allocations.get(row.productId + ':' + row.period + ':energy') ?? 0) +
      (allocations.get(row.productId + ':' + row.period + ':maintenance') ?? 0) +
      (allocations.get(row.productId + ':' + row.period + ':overhead') ?? 0)
    let completedCpp = materialCpp + conversionCpp
    let wipCpp = 0
    if (row.hasInventoryFlow && (materialCpp > 0 || conversionCpp > 0)) {
      if ((materialCpp > 0 && (!Number.isFinite(row.materialEquivalentUnits) || row.materialEquivalentUnits <= 0)) ||
          (conversionCpp > 0 && (!Number.isFinite(row.conversionEquivalentUnits) || row.conversionEquivalentUnits <= 0))) {
        issues.push('Product ' + row.productId + ' period ' + row.period + ' has incremental CPP but no valid equivalent units for WIP allocation.')
        continue
      }
      const materialRate = row.materialEquivalentUnits > 0 ? materialCpp / row.materialEquivalentUnits : 0
      const conversionRate = row.conversionEquivalentUnits > 0 ? conversionCpp / row.conversionEquivalentUnits : 0
      const completedMaterialCpp = row.completedUnits * materialRate
      const completedConversionCpp = row.completedUnits * conversionRate
      const closingWipMaterialCpp = Math.max(0, row.materialEquivalentUnits - row.completedUnits) * materialRate
      const closingWipConversionCpp = Math.max(0, row.conversionEquivalentUnits - row.completedUnits) * conversionRate
      completedCpp = completedMaterialCpp + completedConversionCpp
      wipCpp = closingWipMaterialCpp + closingWipConversionCpp
      const allocatedTotal = completedCpp + wipCpp
      const sourceTotal = materialCpp + conversionCpp
      if (Math.abs(allocatedTotal - sourceTotal) > 1e-7 * Math.max(1, sourceTotal)) {
        issues.push('Product ' + row.productId + ' period ' + row.period + ' incremental CPP does not reconcile between completed output and closing WIP.')
        continue
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
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [] }
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
): FinishedGoodsWorkingCapitalBinding {
  const issues: string[] = []
  if (!Array.isArray(closingWorkingCapitalByPeriod) ||
      closingWorkingCapitalByPeriod.some(value => !Number.isFinite(value)))
    issues.push('A finite working-capital closing balance is required for every project period.')
  if (schedule && (!schedule.valid || schedule.periodRevenue.length !== closingWorkingCapitalByPeriod.length))
    issues.push('A valid product operating schedule matching the working-capital period count is required.')
  if (issues.length) return { valid: false, issues, closingWorkingCapitalByPeriod: [], inventoryAddedByPeriod: [] }

  const result = [...closingWorkingCapitalByPeriod]
  const inventoryAddedByPeriod = Array(result.length).fill(0) as number[]
  if (schedule && !hasExplicitFinishedGoodsComponent) {
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
