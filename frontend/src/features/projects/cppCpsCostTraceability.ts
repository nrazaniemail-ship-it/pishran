/**
 * FS-00 CPP/CPS traceability ledger.
 * Source-first: unverified CRC200 items keep null amounts and are never zero-filled.
 */
export type TraceCostCategory = 'materials' | 'labour' | 'energy' | 'maintenance' | 'overhead'
export type TraceCostBehaviour = 'fixed' | 'variable' | 'mixed'
export type TraceCostBasis = 'per-unit-output' | 'nominal-capacity' | 'period-total' | 'period-adjustments'
export type BaseCostCoverage = 'fully-included' | 'partially-included' | 'excluded' | 'unverified'
export type TraceSourceStatus = 'verified' | 'unverified'
export type TraceAllocationMethod = 'direct-product' | 'production-quantity' | 'revenue' | 'not-allocated'

export type CppCpsTraceItem = {
  id: string
  label: string
  category: TraceCostCategory
  basis: TraceCostBasis | null
  behaviour: TraceCostBehaviour | null
  fixedPercent: number | null
  variablePercent: number | null
  productId: string | null
  allocationMethod: TraceAllocationMethod
  baseCostCoverage: BaseCostCoverage
  periodAmounts: (number | null)[]
  baseCoveredAmounts: (number | null)[]
  source: {
    status: TraceSourceStatus
    reference: string
    description: string
    reliability: 'primary-document' | 'audited-report' | 'management-record' | 'secondary-source' | 'unverified'
  }
}

export type CppCpsTracePeriodRow = {
  itemId: string
  category: TraceCostCategory
  period: number
  grossCost: number | null
  baseCoveredCost: number | null
  incrementalCpp: number | null
  baseCoverage: BaseCostCoverage
  sourceStatus: TraceSourceStatus
  path: readonly ['production-cost' | 'raw-material-inventory', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital']
}

export type CppCpsTraceLedger = {
  valid: boolean
  complete: boolean
  issues: string[]
  rows: CppCpsTracePeriodRow[]
  knownIncrementalByPeriod: (number | null)[]
  completeIncrementalByPeriod: (number | null)[]
  knownIncrementalByCategory: Record<TraceCostCategory, number>
  unverifiedItemIds: string[]
  readyForCppPosting: boolean
}

const categories: TraceCostCategory[] = ['materials', 'labour', 'energy', 'maintenance', 'overhead']
const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

function emptyCategoryTotals(): Record<TraceCostCategory, number> {
  return { materials: 0, labour: 0, energy: 0, maintenance: 0, overhead: 0 }
}

/**
 * Validate cost evidence without inventing missing values.
 * Complete period totals are null if any item for that period is unverified;
 * the known subtotal remains separately visible for reconciliation.
 */
export function buildCppCpsTraceLedger(items: CppCpsTraceItem[], periodCount: number): CppCpsTraceLedger {
  const issues: string[] = []
  const rows: CppCpsTracePeriodRow[] = []
  const knownIncrementalByPeriod = Array(Math.max(0, periodCount)).fill(0) as number[]
  const hasUnverifiedByPeriod = Array(Math.max(0, periodCount)).fill(false) as boolean[]
  const knownIncrementalByCategory = emptyCategoryTotals()
  const unverifiedItemIds: string[] = []
  const ids = new Set<string>()

  if (!Number.isInteger(periodCount) || periodCount < 1)
    issues.push('A positive integer project period count is required.')
  if (!Array.isArray(items)) issues.push('Cost trace items must be an array.')

  for (const item of Array.isArray(items) ? items : []) {
    const prefix = 'cost-item-' + (item?.id || 'unknown') + ':'
    if (!item || !item.id?.trim() || ids.has(item.id)) {
      issues.push(prefix + 'stable-unique-id-required')
      continue
    }
    ids.add(item.id)
    if (!item.label?.trim()) issues.push(prefix + 'label-required')
    if (!categories.includes(item.category)) issues.push(prefix + 'unsupported-cost-category')
    if (!item.basis) issues.push(prefix + 'calculation-basis-required')
    if (!item.behaviour) issues.push(prefix + 'fixed-variable-behaviour-required')
    if (item.behaviour === 'fixed' && (item.fixedPercent !== 100 || item.variablePercent !== 0))
      issues.push(prefix + 'fixed-cost-must-be-100-percent-fixed')
    if (item.behaviour === 'variable' && (item.fixedPercent !== 0 || item.variablePercent !== 100))
      issues.push(prefix + 'variable-cost-must-be-100-percent-variable')
    if (item.behaviour === 'mixed' &&
      (!isFiniteNonNegative(item.fixedPercent) || !isFiniteNonNegative(item.variablePercent) ||
       item.fixedPercent > 100 || item.variablePercent > 100 ||
       Math.abs(item.fixedPercent + item.variablePercent - 100) > 1e-8))
      issues.push(prefix + 'mixed-cost-split-must-equal-100-percent')
    if (item.allocationMethod === 'direct-product' && !item.productId?.trim())
      issues.push(prefix + 'direct-product-allocation-requires-product-id')
    if (item.allocationMethod !== 'direct-product' && item.productId)
      issues.push(prefix + 'product-id-only-allowed-for-direct-product-allocation')
    if (!['direct-product', 'production-quantity', 'revenue', 'not-allocated'].includes(item.allocationMethod))
      issues.push(prefix + 'allocation-method-required')

    const amounts = item.periodAmounts ?? []
    const covered = item.baseCoveredAmounts ?? []
    if (amounts.length !== periodCount || covered.length !== periodCount) {
      issues.push(prefix + 'period-amount-and-base-coverage-arrays-must-match-project-periods')
      continue
    }

    if (item.source?.status === 'unverified') {
      unverifiedItemIds.push(item.id)
      if (item.source.reliability !== 'unverified')
        issues.push(prefix + 'unverified-source-must-use-unverified-reliability')
      if (amounts.some(value => value !== null) || covered.some(value => value !== null))
        issues.push(prefix + 'unverified-source-amounts-must-remain-null')
      if (item.baseCostCoverage !== 'unverified')
        issues.push(prefix + 'unverified-source-cannot-claim-base-cost-coverage')
      for (let period = 0; period < periodCount; period++) {
        hasUnverifiedByPeriod[period] = true
        rows.push({
          itemId: item.id, category: item.category, period: period + 1,
          grossCost: null, baseCoveredCost: null, incrementalCpp: null,
          baseCoverage: 'unverified', sourceStatus: 'unverified',
          path: item.category === 'materials'
            ? ['raw-material-inventory', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital']
            : ['production-cost', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital'],
        })
      }
      continue
    }

    if (item.source?.status !== 'verified' || !item.source.reference?.trim() ||
        !item.source.description?.trim() || item.source.reliability === 'unverified') {
      issues.push(prefix + 'verified-source-requires-reference-description-and-reliability')
      continue
    }
    if (item.baseCostCoverage === 'unverified') {
      issues.push(prefix + 'verified-cost-requires-explicit-base-coverage-treatment')
      continue
    }

    for (let period = 0; period < periodCount; period++) {
      const gross = amounts[period]
      const base = covered[period]
      if (!isFiniteNonNegative(gross)) {
        issues.push(prefix + 'missing-or-invalid-source-amount-period-' + (period + 1))
        continue
      }
      let coveredAmount: number | null = base
      if (item.baseCostCoverage === 'fully-included') coveredAmount = gross
      else if (item.baseCostCoverage === 'excluded') coveredAmount = 0
      else if (item.baseCostCoverage === 'partially-included' && !isFiniteNonNegative(base)) {
        issues.push(prefix + 'partial-base-coverage-amount-required-period-' + (period + 1))
        continue
      }
      if (coveredAmount === null || !isFiniteNonNegative(coveredAmount) || coveredAmount > gross) {
        issues.push(prefix + 'base-covered-amount-must-be-between-zero-and-gross-cost-period-' + (period + 1))
        continue
      }
      const incremental = gross - coveredAmount
      knownIncrementalByPeriod[period] += incremental
      knownIncrementalByCategory[item.category] += incremental
      rows.push({
        itemId: item.id, category: item.category, period: period + 1,
        grossCost: gross, baseCoveredCost: coveredAmount, incrementalCpp: incremental,
        baseCoverage: item.baseCostCoverage, sourceStatus: 'verified',
        path: item.category === 'materials'
          ? ['raw-material-inventory', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital']
          : ['production-cost', 'wip', 'finished-goods', 'cost-of-sales', 'income-statement', 'working-capital'],
      })
    }
  }

  const complete = unverifiedItemIds.length === 0
  const valid = issues.length === 0
  return {
    valid, complete: valid && complete, issues, rows: valid ? rows : [],
    knownIncrementalByPeriod: valid ? knownIncrementalByPeriod : [],
    completeIncrementalByPeriod: valid
      ? knownIncrementalByPeriod.map((amount, index) => hasUnverifiedByPeriod[index] ? null : amount)
      : [],
    knownIncrementalByCategory, unverifiedItemIds,
    readyForCppPosting: valid && complete,
  }
}
