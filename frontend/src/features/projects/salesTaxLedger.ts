export type SalesTaxOutputEntry = {
  productId: string
  period: number
  taxableSales: number
  ratePercent: number
}

export type SalesTaxInputCreditEntry = {
  id: string
  period: number
  taxAmount: number
  sourceReference: string
  sourceVerified: boolean
}

export type SalesTaxSettlementEntry = {
  period: number
  amount: number
  sourceReference: string
}

export type SalesTaxPeriodRow = {
  period: number
  openingBalance: number
  outputTax: number
  recoverableInputTax: number
  netTaxAccrued: number
  settlement: number
  closingBalance: number
}

export type SalesTaxLedgerResult = {
  valid: boolean
  issues: string[]
  rows: SalesTaxPeriodRow[]
  totalOutputTax: number
  totalRecoverableInputTax: number
  totalSettlements: number
  closingBalance: number
}

export type SalesTaxWorkingCapitalBinding = {
  valid: boolean
  issues: string[]
  openingWorkingCapital: number
  closingWorkingCapitalByPeriod: number[]
}

/** Include tax payable as an operating liability and recoverable tax as a current asset exactly once. */
export function bindSalesTaxLedgerToWorkingCapital(
  workingCapitalByPeriod: number[],
  openingWorkingCapital: number,
  ledger: SalesTaxLedgerResult,
): SalesTaxWorkingCapitalBinding {
  const issues: string[] = []
  if (!ledger.valid) issues.push('A valid sales-tax ledger is required before working-capital posting.')
  if (!Number.isFinite(openingWorkingCapital)) issues.push('Opening net working capital must be finite.')
  if (!Array.isArray(workingCapitalByPeriod) || workingCapitalByPeriod.length !== ledger.rows.length ||
      workingCapitalByPeriod.some(value => !Number.isFinite(value))) {
    issues.push('Working-capital balances must align with every sales-tax ledger period.')
  }
  if (issues.length) return { valid:false, issues, openingWorkingCapital:Number.NaN, closingWorkingCapitalByPeriod:[] }
  const openingTaxBalance = ledger.rows[0]?.openingBalance ?? 0
  return {
    valid:true,
    issues:[],
    openingWorkingCapital:openingWorkingCapital-openingTaxBalance,
    // Positive tax balance is payable (liability); negative is recoverable (asset).
    closingWorkingCapitalByPeriod:workingCapitalByPeriod.map((amount,index)=>amount-ledger.rows[index].closingBalance),
  }
}

/**
 * Separate indirect-tax control account. Positive balances are payable to the
 * tax authority; negative balances are recoverable credits. Sales are tax-exclusive.
 * Credits and settlements are accepted only with explicit source references.
 */
export function buildSalesTaxLedger(
  periodCount: number,
  outputEntries: SalesTaxOutputEntry[],
  inputCredits: SalesTaxInputCreditEntry[],
  settlements: SalesTaxSettlementEntry[],
  openingBalance = 0,
): SalesTaxLedgerResult {
  const issues: string[] = []
  const empty = (): SalesTaxLedgerResult => ({
    valid: false, issues, rows: [], totalOutputTax: 0,
    totalRecoverableInputTax: 0, totalSettlements: 0, closingBalance: Number.NaN,
  })
  if (!Number.isInteger(periodCount) || periodCount < 1) issues.push('A positive integer project period count is required.')
  if (!Number.isFinite(openingBalance)) issues.push('Opening sales-tax balance must be finite.')
  const outputKeys = new Set<string>()
  for (const entry of outputEntries) {
    const key = entry.productId.trim().toLocaleLowerCase() + ':' + entry.period
    if (!entry.productId.trim() || outputKeys.has(key)) issues.push('Sales-tax output rows require unique product-period keys.')
    outputKeys.add(key)
    if (!Number.isInteger(entry.period) || entry.period < 1 || entry.period > periodCount ||
        !Number.isFinite(entry.taxableSales) || entry.taxableSales < 0 ||
        !Number.isFinite(entry.ratePercent) || entry.ratePercent < 0 || entry.ratePercent > 100) {
      issues.push('Sales-tax output row for ' + entry.productId + ' has an invalid period, taxable sales or rate.')
    }
  }
  const creditIds = new Set<string>()
  for (const entry of inputCredits) {
    const id = entry.id.trim().toLocaleLowerCase()
    if (!id || creditIds.has(id)) issues.push('Input-tax credit identifiers must be present and unique.')
    creditIds.add(id)
    if (!Number.isInteger(entry.period) || entry.period < 1 || entry.period > periodCount ||
        !Number.isFinite(entry.taxAmount) || entry.taxAmount < 0) {
      issues.push('Input-tax credit ' + entry.id + ' has an invalid period or amount.')
    }
    if (!entry.sourceVerified || !entry.sourceReference.trim()) {
      issues.push('Input-tax credit ' + entry.id + ' requires a verified source reference.')
    }
  }
  const settlementByPeriod = new Map<number, SalesTaxSettlementEntry>()
  for (const entry of settlements) {
    if (!Number.isInteger(entry.period) || entry.period < 1 || entry.period > periodCount ||
        !Number.isFinite(entry.amount) || entry.amount < 0 || !entry.sourceReference.trim()) {
      issues.push('Sales-tax settlement requires a valid period, non-negative amount and source reference.')
      continue
    }
    if (settlementByPeriod.has(entry.period)) issues.push('Only one consolidated sales-tax settlement row is allowed per period.')
    settlementByPeriod.set(entry.period, entry)
  }
  for (let period = 1; period <= periodCount; period++) {
    if (!settlementByPeriod.has(period)) issues.push('Sales-tax settlement schedule is missing period ' + period + '.')
  }
  if (issues.length) return empty()

  const rows: SalesTaxPeriodRow[] = []
  let balance = openingBalance
  let totalOutputTax = 0
  let totalRecoverableInputTax = 0
  let totalSettlements = 0
  for (let period = 1; period <= periodCount; period++) {
    const outputTax = outputEntries.filter(row => row.period === period)
      .reduce((sum, row) => sum + row.taxableSales * row.ratePercent / 100, 0)
    const recoverableInputTax = inputCredits.filter(row => row.period === period)
      .reduce((sum, row) => sum + row.taxAmount, 0)
    const settlement = settlementByPeriod.get(period)!.amount
    const opening = balance
    const accrued = outputTax - recoverableInputTax
    const availablePayable = opening + accrued
    if (settlement > Math.max(0, availablePayable) + 0.01) {
      issues.push('Sales-tax settlement exceeds the payable balance available in period ' + period + '.')
      return empty()
    }
    balance = availablePayable - settlement
    rows.push({ period, openingBalance: opening, outputTax, recoverableInputTax,
      netTaxAccrued: accrued, settlement, closingBalance: balance })
    totalOutputTax += outputTax
    totalRecoverableInputTax += recoverableInputTax
    totalSettlements += settlement
  }
  if (issues.length) return empty()
  return { valid: true, issues: [], rows, totalOutputTax, totalRecoverableInputTax,
    totalSettlements, closingBalance: balance }
}
