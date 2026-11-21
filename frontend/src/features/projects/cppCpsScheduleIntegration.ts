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
      const rowKey = entry.row.productId + ':' + entry.row.period
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
    const addedCpp = allocations.get(row.productId + ':' + row.period) ?? 0
    const productionCost = row.productionCost + addedCpp
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
      costOfSales, closingInventoryValue, grossProfit: row.netSalesRevenue - costOfSales,
    }
    rows.push(revisedRow)
    closingByProduct.set(row.productId, {
      quantity: row.closingInventoryQuantity, value: closingInventoryValue, period: row.period,
    })
  }
  if (issues.length) return { valid: false, issues, schedule: null, incrementalCppByPeriod: [] }
  const periodCostOfSales = Array(periodCount).fill(0) as number[]
  let totalClosingInventoryValue = 0
  for (const row of rows) {
    periodCostOfSales[row.period - 1] += row.costOfSales
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
    schedule: { ...schedule, rows, periodCostOfSales, annualCostOfSales, totalClosingInventoryValue },
    incrementalCppByPeriod: [...incrementalCppByPeriod],
  }
}
