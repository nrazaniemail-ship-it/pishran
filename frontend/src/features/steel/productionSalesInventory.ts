/**
 * Help-driven production, finished-goods inventory and production-cost calculations.
 *
 * The equations are transcribed from the reference manual's XI.J (Production costs)
 * and XI.L (Sales and production programme). Prices supplied here must already be
 * escalated and converted to the selected calculation currency by the project pricing
 * layer; this module does not invent inflation, exchange rates or missing inputs.
 */

export type ProductionSalesPeriodInput = {
  index: number
  /** Number of months represented by this production period (1..12). */
  months: number
  salesQuantity: number
}

export type FinishedGoodsProductionInput = {
  periods: ProductionSalesPeriodInput[]
  /** Finished-product stock coverage, in days. */
  finishedGoodsDaysCoverage: number
  /** Opening finished-goods quantity at the start of period 1. */
  startingStock: number
  /** Inclusive production interval; defaults to the full supplied horizon. */
  productionStartPeriod?: number
  productionEndPeriod?: number
  /** Last period in which sales occur. If before productionEndPeriod, production is reduced to avoid excess closing stock. */
  salesEndPeriod?: number
}

export type FinishedGoodsProductionRow = {
  period: number
  stockBroughtForward: number
  salesQuantity: number
  requiredStock: number
  stockCarriedOver: number
  productionQuantity: number
  productionAllowed: boolean
}

export type FinishedGoodsProductionResult = {
  valid: boolean
  rows: FinishedGoodsProductionRow[]
  terminalStockSoldInFollowingPeriod: number
  issues: string[]
}

/**
 * Calculates finished-goods production from sales and stock policy.
 * c = (30 × months in period) / days coverage; required stock = sales / c.
 * Production quantity = sales + stock carried over - stock brought forward.
 */
export function calculateFinishedGoodsProductionSchedule(
  input: FinishedGoodsProductionInput,
): FinishedGoodsProductionResult {
  const issues: string[] = []
  const periods = input.periods
  const count = Array.isArray(periods) ? periods.length : 0
  const start = input.productionStartPeriod ?? 1
  const end = input.productionEndPeriod ?? count
  const salesEnd = input.salesEndPeriod ?? count

  if (!count) issues.push('At least one production/sales period is required.')
  if (!Number.isFinite(input.finishedGoodsDaysCoverage) || input.finishedGoodsDaysCoverage <= 0)
    issues.push('Finished-goods days coverage must be a positive finite number.')
  if (!Number.isFinite(input.startingStock) || input.startingStock < 0)
    issues.push('Starting finished-goods stock must be finite and non-negative.')
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > count)
    issues.push('Production interval must be an inclusive range within the supplied periods.')
  if (!Number.isInteger(salesEnd) || salesEnd < 1 || salesEnd > count)
    issues.push('Sales end period must fall within the supplied periods.')
  periods?.forEach((period, index) => {
    if (!period || period.index !== index + 1 || !Number.isFinite(period.months) ||
        period.months <= 0 || period.months > 12 || !Number.isFinite(period.salesQuantity) ||
        period.salesQuantity < 0) {
      issues.push('Period ' + (index + 1) + ' requires a sequential index, 0–12 month fraction above zero and non-negative sales.')
    }
  })
  if (issues.length) return { valid: false, rows: [], terminalStockSoldInFollowingPeriod: 0, issues }

  const totalSales = periods.slice(0, salesEnd).reduce((sum, period) => sum + period.salesQuantity, 0)
  let stock = input.startingStock
  const rows: FinishedGoodsProductionRow[] = []
  const noProductionNeeded = input.startingStock > totalSales
  const salesEndBeforeProductionEnd = salesEnd < end

  for (let index = 0; index < count; index++) {
    const period = periods[index]
    const periodNumber = index + 1
    const stockBroughtForward = stock
    const productionAllowed = periodNumber >= start && periodNumber <= end && !noProductionNeeded
    const salesQuantity = period.salesQuantity
    let requiredStock = 0
    let stockCarriedOver = 0
    let productionQuantity = 0

    if (!productionAllowed) {
      if (salesQuantity > stockBroughtForward + 1e-9) {
        issues.push('Sales in period ' + periodNumber + ' exceed available opening finished-goods stock outside the production interval.')
        break
      }
      stockCarriedOver = stockBroughtForward - salesQuantity
    } else {
      const turnoverCoefficient = 30 * period.months / input.finishedGoodsDaysCoverage
      requiredStock = salesQuantity / turnoverCoefficient
      if (salesEndBeforeProductionEnd) {
        const futureSales = periods.slice(index + 1, salesEnd).reduce((sum, future) => sum + future.salesQuantity, 0)
        requiredStock = Math.min(requiredStock, futureSales)
        if (salesQuantity < stockBroughtForward) {
          stockCarriedOver = stockBroughtForward - salesQuantity
          productionQuantity = 0
        } else {
          stockCarriedOver = requiredStock
          productionQuantity = salesQuantity + stockCarriedOver - stockBroughtForward
        }
      } else {
        stockCarriedOver = Math.max(stockBroughtForward - salesQuantity, requiredStock)
        productionQuantity = salesQuantity + stockCarriedOver - stockBroughtForward
      }
    }

    if (stockCarriedOver < -1e-9 || productionQuantity < -1e-9 ||
        ![requiredStock, stockCarriedOver, productionQuantity].every(Number.isFinite)) {
      issues.push('Production or finished-goods stock became invalid in period ' + periodNumber + '.')
      break
    }
    stock = Math.max(0, stockCarriedOver)
    rows.push({
      period: periodNumber, stockBroughtForward, salesQuantity, requiredStock,
      stockCarriedOver: stock, productionQuantity: Math.max(0, productionQuantity), productionAllowed,
    })
  }

  if (issues.length) return { valid: false, rows: [], terminalStockSoldInFollowingPeriod: 0, issues }
  return {
    valid: true,
    rows,
    // The manual sells the final production-period stock automatically in period n+1.
    terminalStockSoldInFollowingPeriod: rows.length ? rows[rows.length - 1].stockCarriedOver : 0,
    issues: [],
  }
}

export type ProductionCostBasis = 'nominal-capacity' | 'per-unit-output' | 'period-adjustments'
export type ProductionCostActivityBasis = 'sales' | 'production'

export type ProductionCostAdjustment = {
  period: number
  quantity: number
  unitPrice: number
  fixedPercent: number
  variablePercent: number
}

export type ProductionCostItemInput = {
  id: string
  basis: ProductionCostBasis
  activityBasis: ProductionCostActivityBasis
  standardQuantity?: number
  /** Current period standard prices, already escalated/translated by the pricing layer. */
  standardUnitPrices?: number[]
  nominalCapacity?: number
  /** Used only by per-unit-output basis. */
  standardFixedCost?: number
  fixedPercent?: number
  variablePercent?: number
  adjustments?: ProductionCostAdjustment[]
}

export type ProductionCostPeriodInput = {
  index: number
  months: number
  salesQuantity: number
  productionQuantity: number
}

export type ProductionCostPeriodResult = {
  period: number
  standardCost: number
  adjustmentAmount: number
  fixedCost: number
  variableCost: number
  totalCost: number
}

export type ProductionCostItemResult = {
  id: string
  valid: boolean
  rows: ProductionCostPeriodResult[]
  totalFixedCost: number
  totalVariableCost: number
  totalCost: number
  issues: string[]
}

const finite = (value: number): boolean => Number.isFinite(value)
const validPercent = (value: number): boolean => finite(value) && value >= 0 && value <= 100

/**
 * Calculates one direct or indirect production-cost item.
 *
 * Nominal-capacity basis:
 *   SCj=Q×Cj; Aj=Qaj×Caj
 *   FCj=f×SCj×months/12 + faj×Aj
 *   VCj=v×SCj×(Sj or Pj)/PC + vaj×Aj
 *
 * Per-unit-output basis:
 *   FCj=FC×months/12 + faj×Aj
 *   VCj=Q×Cj×(Sj or Pj) + vaj×Aj
 */
export function calculateProductionCostItem(
  item: ProductionCostItemInput,
  periods: ProductionCostPeriodInput[],
): ProductionCostItemResult {
  const issues: string[] = []
  if (!item?.id?.trim()) issues.push('Production cost item requires an identifier.')
  if (!['nominal-capacity', 'per-unit-output', 'period-adjustments'].includes(item?.basis))
    issues.push('Unsupported production-cost basis.')
  if (!['sales', 'production'].includes(item?.activityBasis))
    issues.push('Production-cost activity basis must be sales or production.')
  if (!Array.isArray(periods) || !periods.length)
    issues.push('At least one production-cost period is required.')
  if (periods?.some((period, index) => !period || period.index !== index + 1 ||
      !finite(period.months) || period.months <= 0 || period.months > 12 ||
      !finite(period.salesQuantity) || period.salesQuantity < 0 ||
      !finite(period.productionQuantity) || period.productionQuantity < 0))
    issues.push('Production-cost periods require sequential indices, valid months and non-negative sales/production quantities.')

  if (item.basis === 'nominal-capacity') {
    if (!finite(item.standardQuantity ?? Number.NaN) || (item.standardQuantity ?? 0) < 0)
      issues.push('Nominal-capacity basis requires a non-negative standard quantity.')
    if (!finite(item.nominalCapacity ?? Number.NaN) || (item.nominalCapacity ?? 0) <= 0)
      issues.push('Nominal-capacity basis requires positive nominal capacity.')
    if (!Array.isArray(item.standardUnitPrices) || item.standardUnitPrices.length !== periods.length ||
        item.standardUnitPrices.some(price => !finite(price) || price < 0))
      issues.push('Nominal-capacity basis requires one non-negative current standard price per period.')
    if (!validPercent(item.fixedPercent ?? Number.NaN) || !validPercent(item.variablePercent ?? Number.NaN))
      issues.push('Nominal-capacity basis requires fixed and variable percentages from 0 to 100.')
    if (Math.abs((item.fixedPercent ?? 0) + (item.variablePercent ?? 0) - 100) > 1e-8)
      issues.push('Fixed and variable percentages must total 100%.')
  }
  if (item.basis === 'per-unit-output') {
    if (!finite(item.standardQuantity ?? Number.NaN) || (item.standardQuantity ?? 0) < 0)
      issues.push('Per-unit-output basis requires a non-negative standard quantity per unit.')
    if (!Array.isArray(item.standardUnitPrices) || item.standardUnitPrices.length !== periods.length ||
        item.standardUnitPrices.some(price => !finite(price) || price < 0))
      issues.push('Per-unit-output basis requires one non-negative current standard price per period.')
    if (!finite(item.standardFixedCost ?? Number.NaN) || (item.standardFixedCost ?? 0) < 0)
      issues.push('Per-unit-output basis requires a non-negative standard fixed cost.')
  }
  const adjustments = item.adjustments ?? []
  if (!Array.isArray(adjustments) || adjustments.some((row, index) => !row ||
      !Number.isInteger(row.period) || row.period < 1 || row.period > periods.length ||
      (index > 0 && adjustments[index - 1].period >= row.period) ||
      ![row.quantity, row.unitPrice, row.fixedPercent, row.variablePercent].every(finite) ||
      row.quantity < 0 || row.unitPrice < 0 || !validPercent(row.fixedPercent) ||
      !validPercent(row.variablePercent)))
    issues.push('Adjustments require unique increasing period numbers, non-negative quantity/price and percentages from 0 to 100.')
  if (adjustments.some(row => Math.abs(row.fixedPercent + row.variablePercent - 100) > 1e-8))
    issues.push('Each adjustment fixed and variable percentage pair must total 100%.')
  if (issues.length) return { id: item?.id ?? '', valid: false, rows: [], totalFixedCost: 0, totalVariableCost: 0, totalCost: 0, issues }

  const rows = periods.map((period, index): ProductionCostPeriodResult => {
    const adjustment = adjustments.find(row => row.period === period.index)
    const adjustmentAmount = adjustment ? adjustment.quantity * adjustment.unitPrice : 0
    const activity = item.activityBasis === 'sales' ? period.salesQuantity : period.productionQuantity
    let standardCost = 0
    let fixedCost = 0
    let variableCost = 0

    if (item.basis === 'nominal-capacity') {
      standardCost = (item.standardQuantity as number) * (item.standardUnitPrices as number[])[index]
      fixedCost = (item.fixedPercent as number) / 100 * standardCost * period.months / 12
        + (adjustment?.fixedPercent ?? 0) / 100 * adjustmentAmount
      variableCost = (item.variablePercent as number) / 100 * standardCost * activity / (item.nominalCapacity as number)
        + (adjustment?.variablePercent ?? 0) / 100 * adjustmentAmount
    } else if (item.basis === 'per-unit-output') {
      standardCost = (item.standardQuantity as number) * (item.standardUnitPrices as number[])[index]
      fixedCost = (item.standardFixedCost as number) * period.months / 12
        + (adjustment?.fixedPercent ?? 0) / 100 * adjustmentAmount
      variableCost = standardCost * activity
        + (adjustment?.variablePercent ?? 0) / 100 * adjustmentAmount
    } else {
      fixedCost = (adjustment?.fixedPercent ?? 0) / 100 * adjustmentAmount
      variableCost = (adjustment?.variablePercent ?? 0) / 100 * adjustmentAmount
    }
    return { period: period.index, standardCost, adjustmentAmount, fixedCost, variableCost, totalCost: fixedCost + variableCost }
  })
  return {
    id: item.id, valid: true, rows,
    totalFixedCost: rows.reduce((sum, row) => sum + row.fixedCost, 0),
    totalVariableCost: rows.reduce((sum, row) => sum + row.variableCost, 0),
    totalCost: rows.reduce((sum, row) => sum + row.totalCost, 0),
    issues: [],
  }
}
