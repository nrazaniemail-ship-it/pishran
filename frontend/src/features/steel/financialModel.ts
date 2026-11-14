export type CapitalStructureInput = {
  equityWeight: number
  debtWeight: number
  costOfEquity: number
  costOfDebt: number
  taxRate: number
}

export type WorkingCapitalItem = {
  id: string
  name: string
  classification: 'asset' | 'liability'
  annualBase: number
  days: number
}

export type PayrollItem = {
  count: number
  monthlySalary: number
  monthlyInsurance: number
  monthlyOvertime: number
  annualBonus: number
  annualSeniority: number
}

const finiteNonNegative = (value: number) => Number.isFinite(value) && value >= 0

export function calculateWacc(input: CapitalStructureInput) {
  const { equityWeight, debtWeight, costOfEquity, costOfDebt, taxRate } = input
  const weightTotal = equityWeight + debtWeight
  const valid = [equityWeight, debtWeight, costOfEquity, costOfDebt, taxRate].every(finiteNonNegative)
    && equityWeight <= 100 && debtWeight <= 100 && costOfEquity <= 100
    && costOfDebt <= 100 && taxRate <= 100 && Math.abs(weightTotal - 100) <= 0.01
  if (!valid) return { value: null as number | null, weightTotal, valid: false }
  const value = (equityWeight / 100) * (costOfEquity / 100)
    + (debtWeight / 100) * (costOfDebt / 100) * (1 - taxRate / 100)
  return { value, weightTotal, valid: Number.isFinite(value) && value >= 0 && value < 1 }
}

export function calculatePayrollCost(item: PayrollItem) {
  const values = [item.count, item.monthlySalary, item.monthlyInsurance, item.monthlyOvertime, item.annualBonus, item.annualSeniority]
  if (!values.every(finiteNonNegative)) return 0
  const monthlyCost = item.monthlySalary + item.monthlyInsurance + item.monthlyOvertime
  return item.count * (monthlyCost * 12 + item.annualBonus + item.annualSeniority)
}

export function calculateWorkingCapital(items: WorkingCapitalItem[], ramp = 1, dayBasis = 360) {
  if (!Number.isFinite(ramp) || ramp < 0 || !Number.isFinite(dayBasis) || dayBasis <= 0) return 0
  return items.reduce((total, item) => {
    if (!finiteNonNegative(item.annualBase) || !finiteNonNegative(item.days)) return total
    const amount = item.annualBase * Math.min(item.days, dayBasis) / dayBasis * ramp
    return total + (item.classification === 'liability' ? -amount : amount)
  }, 0)
}

export function calculateNpv(flows: number[], rate: number) {
  if (!Number.isFinite(rate) || rate <= -1) return Number.NaN
  return flows.reduce((sum, flow, index) => sum + flow / Math.pow(1 + rate, index), 0)
}

export function calculateIrr(flows: number[]): number | null {
  if (!flows.length || !flows.every(Number.isFinite) || !flows.some(value => value > 0) || !flows.some(value => value < 0)) return null
  const rates = [-0.999, -0.99, -0.975, -0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0,
    0.01, 0.02, 0.05, 0.075, 0.1, 0.125, 0.15, 0.175, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50, 100, 500, 1000]
  const roots: number[] = []
  let left = rates[0]
  let leftValue = calculateNpv(flows, left)
  for (const right of rates.slice(1)) {
    const rightValue = calculateNpv(flows, right)
    if (leftValue === 0) roots.push(left)
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue * rightValue < 0) {
      let lo = left, hi = right, flo = leftValue
      for (let iteration = 0; iteration < 140; iteration++) {
        const mid = (lo + hi) / 2
        const value = calculateNpv(flows, mid)
        if (Math.abs(value) < 1e-8) { lo = mid; hi = mid; break }
        if (flo * value <= 0) hi = mid
        else { lo = mid; flo = value }
      }
      roots.push((lo + hi) / 2)
    }
    left = right
    leftValue = rightValue
  }
  return roots.length ? roots.sort((a, b) => Math.abs(a) - Math.abs(b))[0] : null
}

export function calculateMirr(flows: number[], financeRate: number, reinvestmentRate: number): number | null {
  if (!flows.length || !flows.every(Number.isFinite) || financeRate <= -1 || reinvestmentRate <= -1) return null
  const periods = flows.length - 1
  if (periods <= 0) return null
  const presentValueNegative = flows.reduce((sum, flow, index) => flow < 0 ? sum + flow / Math.pow(1 + financeRate, index) : sum, 0)
  const futureValuePositive = flows.reduce((sum, flow, index) => flow > 0 ? sum + flow * Math.pow(1 + reinvestmentRate, periods - index) : sum, 0)
  if (presentValueNegative >= 0 || futureValuePositive <= 0) return null
  return Math.pow(futureValuePositive / -presentValueNegative, 1 / periods) - 1
}


export type OperatingCostRow = {
  quantity: number
  unitPrice: number
  period: string
  currency?: string
  fxRate?: number
}

export type OperatingCostBreakdown = {
  fixedAnnual: number
  variablePerTonne: number
  oneTimeExcluded: number
  totalAtFullOutput: number
}

/** Annual/monthly rows are fixed, per-tonne rows scale with output, one-time rows are excluded from recurring OPEX. */
export function calculateOperatingCostRows(rows: OperatingCostRow[], annualOutput: number, baseCurrency: string): OperatingCostBreakdown {
  const result: OperatingCostBreakdown = { fixedAnnual: 0, variablePerTonne: 0, oneTimeExcluded: 0, totalAtFullOutput: 0 }
  if (!Number.isFinite(annualOutput) || annualOutput < 0) return result
  for (const row of rows) {
    if (!finiteNonNegative(row.quantity) || !finiteNonNegative(row.unitPrice)) continue
    const fx = row.currency && row.currency !== baseCurrency ? row.fxRate : 1
    if (fx === undefined || !finiteNonNegative(fx) || fx === 0) continue
    const amount = row.quantity * row.unitPrice * fx
    if (row.period === 'به‌ازای هر تن') result.variablePerTonne += amount
    else if (row.period === 'ماهانه') result.fixedAnnual += amount * 12
    else if (row.period === 'یک‌باره') result.oneTimeExcluded += amount
    else result.fixedAnnual += amount
  }
  result.totalAtFullOutput = result.fixedAnnual + result.variablePerTonne * annualOutput
  return result
}


export type ProjectCashFlowPeriodInput = {
  ebitda: number
  depreciation: number
  capexSpend: number
  deltaWorkingCapital: number
  terminalValue: number
}

export type ProjectCashFlowPeriodResult = {
  ebit: number
  tax: number
  lossCarryForward: number
  projectCashFlow: number
}

/** Project cash flow before financing, with tax-loss carry-forward. */
export function calculateProjectCashFlowPeriod(
  input: ProjectCashFlowPeriodInput,
  taxRate: number,
  priorLoss = 0,
): ProjectCashFlowPeriodResult {
  const values = [input.ebitda, input.depreciation, input.capexSpend, input.deltaWorkingCapital, input.terminalValue, taxRate, priorLoss]
  if (!values.every(Number.isFinite) || taxRate < 0 || taxRate > 100 || priorLoss < 0) {
    return { ebit: Number.NaN, tax: Number.NaN, lossCarryForward: Number.NaN, projectCashFlow: Number.NaN }
  }
  const ebit = input.ebitda - input.depreciation
  const taxable = ebit - priorLoss
  const tax = Math.max(0, taxable) * taxRate / 100
  const lossCarryForward = taxable < 0 ? -taxable : Math.max(0, priorLoss - ebit)
  const projectCashFlow = input.ebitda - tax - input.capexSpend - input.deltaWorkingCapital + input.terminalValue
  return { ebit, tax, lossCarryForward, projectCashFlow }
}
