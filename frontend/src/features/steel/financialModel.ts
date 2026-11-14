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

export type WorkingCapitalPolicy = {
  dayBasis: 360 | 365
  rawMaterialDays: number
  workInProgressDays: number
  workInProgressMaterialCompletionPercent: number
  workInProgressConversionCompletionPercent: number
  finishedGoodsDays: number
  receivableDays: number
  cashDays: number
  payableDays: number
  annualRawMaterialCost: number
  annualFixedRawMaterialCost?: number
  annualPayablesCost?: number
  annualFixedPayablesCost?: number
  annualConversionCost: number
  annualFixedConversionCost?: number
  annualFinishedGoodsCost: number
  annualFixedFinishedGoodsCost?: number
  annualRevenue: number
  annualCashOperatingCost: number
  annualFixedCashOperatingCost?: number
}

export type WorkingCapitalBreakdown = {
  rawMaterials: number
  workInProgress: number
  finishedGoods: number
  receivables: number
  minimumCash: number
  payables: number
  netWorkingCapital: number
}

export function calculateOperatingCycleWorkingCapital(policy: WorkingCapitalPolicy, utilization: number, salesFactor = 1, opexFactor = 1): WorkingCapitalBreakdown {
  const values = [policy.dayBasis, policy.rawMaterialDays, policy.workInProgressDays, policy.workInProgressMaterialCompletionPercent, policy.workInProgressConversionCompletionPercent, policy.finishedGoodsDays, policy.receivableDays, policy.cashDays, policy.payableDays, policy.annualRawMaterialCost, policy.annualFixedRawMaterialCost ?? 0, policy.annualPayablesCost ?? policy.annualRawMaterialCost, policy.annualFixedPayablesCost ?? 0, policy.annualConversionCost, policy.annualFixedConversionCost ?? 0, policy.annualFinishedGoodsCost, policy.annualFixedFinishedGoodsCost ?? 0, policy.annualRevenue, policy.annualCashOperatingCost, policy.annualFixedCashOperatingCost ?? 0, utilization, salesFactor, opexFactor]
  if (!values.every(Number.isFinite) || policy.dayBasis <= 0 || values.slice(1, 7).some(value => value < 0) || values[3] > 100 || values[4] > 100 || values.slice(7).some(value => value < 0)) return { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: 0 }
  const day = (base: number, days: number, factor: number) => base * factor * Math.min(days, policy.dayBasis) / policy.dayBasis
  const activeFactor = utilization > 0 ? 1 : 0
  const fixedRawMaterials = Math.min(policy.annualRawMaterialCost, policy.annualFixedRawMaterialCost ?? 0)
  const variableRawMaterials = policy.annualRawMaterialCost - fixedRawMaterials
  const rawMaterials = day(variableRawMaterials, policy.rawMaterialDays, utilization * opexFactor)
    + day(fixedRawMaterials, policy.rawMaterialDays, activeFactor * opexFactor)
  const materialCompletion = policy.workInProgressMaterialCompletionPercent / 100
  const conversionCompletion = policy.workInProgressConversionCompletionPercent / 100
  const fixedConversion = Math.min(policy.annualConversionCost, policy.annualFixedConversionCost ?? 0)
  const workInProgress = day(variableRawMaterials, policy.workInProgressDays, utilization * opexFactor * materialCompletion)
    + day(fixedRawMaterials, policy.workInProgressDays, activeFactor * opexFactor * materialCompletion)
    + day(policy.annualConversionCost - fixedConversion, policy.workInProgressDays, utilization * opexFactor * conversionCompletion)
    + day(fixedConversion, policy.workInProgressDays, activeFactor * opexFactor * conversionCompletion)
  const fixedFinishedGoods = Math.min(policy.annualFinishedGoodsCost, policy.annualFixedFinishedGoodsCost ?? 0)
  const finishedGoods = day(policy.annualFinishedGoodsCost - fixedFinishedGoods, policy.finishedGoodsDays, utilization * opexFactor)
    + day(fixedFinishedGoods, policy.finishedGoodsDays, activeFactor * opexFactor)
  const receivables = day(policy.annualRevenue, policy.receivableDays, utilization * salesFactor)
  const fixedCash = Math.min(policy.annualCashOperatingCost, policy.annualFixedCashOperatingCost ?? 0)
  const minimumCash = day(policy.annualCashOperatingCost - fixedCash, policy.cashDays, utilization * opexFactor)
    + day(fixedCash, policy.cashDays, activeFactor * opexFactor)
  const fixedPayables = Math.min(policy.annualPayablesCost ?? policy.annualRawMaterialCost, policy.annualFixedPayablesCost ?? 0)
  const variablePayables = Math.max(0, (policy.annualPayablesCost ?? policy.annualRawMaterialCost) - fixedPayables)
  const payables = day(variablePayables, policy.payableDays, utilization * opexFactor)
    + day(fixedPayables, policy.payableDays, activeFactor * opexFactor)
  return { rawMaterials, workInProgress, finishedGoods, receivables, minimumCash, payables, netWorkingCapital: rawMaterials + workInProgress + finishedGoods + receivables + minimumCash - payables }
}

export function calculateCashConversionCycleDays(policy: Pick<WorkingCapitalPolicy, 'dayBasis' | 'rawMaterialDays' | 'workInProgressDays' | 'finishedGoodsDays' | 'receivableDays' | 'payableDays'>) {
  const values = [policy.rawMaterialDays, policy.workInProgressDays, policy.finishedGoodsDays, policy.receivableDays, policy.payableDays]
  if (!Number.isFinite(policy.dayBasis) || policy.dayBasis <= 0 || !values.every(Number.isFinite) || values.some(value => value < 0)) return Number.NaN
  const [raw, wip, finished, receivables, payables] = values.map(value => Math.min(value, policy.dayBasis))
  return raw + wip + finished + receivables - payables
}

export function calculateCapacityScaledCapex(referenceCapex: number, referenceCapacity: number, targetCapacity: number, elasticity: number) {
  const valid = [referenceCapex, referenceCapacity, targetCapacity, elasticity].every(Number.isFinite) && referenceCapex >= 0 && referenceCapacity > 0 && targetCapacity >= 0 && elasticity >= 0 && elasticity <= 1
  if (!valid) return { amount: Number.NaN, factor: Number.NaN, ratio: Number.NaN, valid: false }
  const ratio = targetCapacity / referenceCapacity
  const factor = Math.pow(ratio, elasticity)
  return { amount: referenceCapex * factor, factor, ratio, valid: Number.isFinite(factor) }
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


export type CashFlowReconciliationPeriod = {
  period: number
  model: number | null
  reference: number | null
  difference: number | null
  differencePercent: number | null
  withinTolerance: boolean
}

export type CashFlowReconciliation = {
  matched: boolean
  periodCountMatch: boolean
  periods: CashFlowReconciliationPeriod[]
  modelTotal: number
  referenceTotal: number
  totalDifference: number
  maxAbsoluteDifference: number | null
}

/** Compare annual project/equity cash-flow vectors without silently aligning missing periods. */
export function reconcileCashFlowSeries(modelFlows: number[], referenceFlows: number[], tolerance = 0.01): CashFlowReconciliation {
  const allowedDifference = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0.01
  const periodCountMatch = modelFlows.length === referenceFlows.length
  const periodCount = Math.max(modelFlows.length, referenceFlows.length)
  const periods = Array.from({ length: periodCount }, (_, index) => {
    const model = Number.isFinite(modelFlows[index]) ? modelFlows[index] : null
    const reference = Number.isFinite(referenceFlows[index]) ? referenceFlows[index] : null
    const difference = model !== null && reference !== null ? model - reference : null
    return {
      period: index + 1,
      model,
      reference,
      difference,
      differencePercent: difference !== null && reference !== 0 ? difference / Math.abs(reference) * 100 : null,
      withinTolerance: difference !== null && Math.abs(difference) <= allowedDifference
    }
  })
  const modelTotal = modelFlows.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
  const referenceTotal = referenceFlows.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
  const differences = periods.map(period => period.difference).filter((value): value is number => value !== null)
  const maxAbsoluteDifference = differences.length ? Math.max(...differences.map(Math.abs)) : null
  return {
    matched: periodCountMatch && periods.every(period => period.withinTolerance),
    periodCountMatch,
    periods,
    modelTotal,
    referenceTotal,
    totalDifference: modelTotal - referenceTotal,
    maxAbsoluteDifference
  }
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


export type IntegratedLoanInput = {
  id: string
  label: string
  drawdowns: number[]
  annualRate: number
  graceYears: number
  termYears: number
  repaymentStartYear: number
  repaymentMethod: 'equal-principal' | 'annuity' | 'bullet'
  capitalizeInterest: boolean
}

export type IntegratedFinanceInput = {
  years: number
  constructionYears: number
  capacity: number
  fullCapacityRevenue: number
  fullCapacityVariableCashCost: number
  fullCapacityFixedCashCost: number
  annualDepreciation: number
  fixedInvestment: number
  preOperatingCost: number
  fixedInvestmentSchedule: number[]
  preOperatingSchedule: number[]
  utilization: number[]
  equityContributions: number[]
  loans: IntegratedLoanInput[]
  taxRate: number
  taxRateSchedule?: number[]
  waccTaxRate?: number
  costOfEquity: number
  workingCapitalPercent: number
  workingCapitalPolicy?: WorkingCapitalPolicy
  salesEscalationPercent: number
  opexEscalationPercent: number
  discountMode: 'wacc' | 'manual'
  manualDiscountRate: number
  salvageValue?: number
}

export type IntegratedLoanYear = {
  drawdown: number
  openingBalance: number
  interestExpense: number
  capitalizedInterest: number
  principal: number
  closingBalance: number
}

export type IntegratedFinanceYear = {
  year: number
  utilization: number
  production: number
  revenue: number
  variableCashCost: number
  fixedCashCost: number
  depreciation: number
  ebit: number
  interest: number
  taxableProfit: number
  tax: number
  principal: number
  debtDrawdown: number
  equityContribution: number
  fixedInvestment: number
  preOperatingCost: number
  workingCapital: number
  workingCapitalBreakdown: WorkingCapitalBreakdown
  salvageProceeds: number
  terminalValue: number
  changeInWorkingCapital: number
  projectFreeCashFlow: number
  equityFreeCashFlow: number
  cashBalance: number
  debtBalance: number
  debtService: number
  dscr: number | null
}

export type IntegratedFinanceResult = {
  years: IntegratedFinanceYear[]
  loanSchedules: Record<string, IntegratedLoanYear[]>
  wacc: number | null
  discountRate: number | null
  weightedCostOfDebt: number
  equityWeight: number
  debtWeight: number
  npvProject: number | null
  irrProject: number | null
  npvEquity: number | null
  irrEquity: number | null
  mirrProject: number | null
  mirrEquity: number | null
  simplePayback: number | null
  discountedPayback: number | null
  peakWorkingCapital: number
  totalDebtDrawdown: number
  totalEquityContribution: number
  totalFunding: number
  totalInvestment: number
  fundingGap: number
  warnings: string[]
}

function integratedLoanSchedule(loan: IntegratedLoanInput, years: number, constructionYears: number): IntegratedLoanYear[] {
  const rate = Math.max(0, finiteNonNegative(loan.annualRate) ? loan.annualRate : 0) / 100
  const term = Math.max(0, Math.floor(loan.termYears || 0))
  const start = Math.max(constructionYears + 1, Math.floor(loan.repaymentStartYear || constructionYears + 1))
  const firstPrincipalYear = start + Math.max(0, Math.floor(loan.graceYears || 0))
  const totalDrawdown = loan.drawdowns.reduce((total, value) => total + Math.max(0, Number(value) || 0), 0)
  let balance = 0
  let annuityPayment: number | null = null
  const result: IntegratedLoanYear[] = []
  for (let index = 0; index < years; index++) {
    const year = index + 1
    const drawdown = Math.max(0, Number(loan.drawdowns[index]) || 0)
    const openingBalance = balance
    const interestAccrued = (openingBalance + drawdown * 0.5) * rate
    const capitalize = Boolean(loan.capitalizeInterest) && year < firstPrincipalYear
    const interestExpense = capitalize ? 0 : interestAccrued
    const capitalizedInterest = capitalize ? interestAccrued : 0
    const repaymentIndex = year - firstPrincipalYear
    const repaymentActive = term > 0 && repaymentIndex >= 0 && repaymentIndex < term
    let principal = 0
    const availableBalance = openingBalance + drawdown + capitalizedInterest
    if (repaymentActive) {
      if (loan.repaymentMethod === 'bullet') {
        principal = repaymentIndex === term - 1 ? availableBalance : 0
      } else if (loan.repaymentMethod === 'annuity') {
        if (annuityPayment === null) {
          annuityPayment = rate === 0 ? availableBalance / term : availableBalance * rate / (1 - Math.pow(1 + rate, -term))
        }
        principal = Math.min(availableBalance, Math.max(0, annuityPayment - interestAccrued))
      } else {
        principal = Math.min(availableBalance, totalDrawdown / term)
      }
    }
    balance = Math.max(0, availableBalance - principal)
    result.push({ drawdown, openingBalance, interestExpense, capitalizedInterest, principal, closingBalance: balance })
  }
  return result
}

/** Integrated 20-year project model. All monetary inputs must use the same base currency. */
export function calculateIntegratedFinance(input: IntegratedFinanceInput): IntegratedFinanceResult {
  const years = Math.max(1, Math.min(40, Math.floor(input.years || 20)))
  const constructionYears = Math.max(1, Math.min(years, Math.floor(input.constructionYears || 4)))
  const loanSchedules: Record<string, IntegratedLoanYear[]> = {}
  input.loans.forEach(loan => { loanSchedules[loan.id] = integratedLoanSchedule(loan, years, constructionYears) })

  const totalDebtDrawdown = input.loans.reduce((sum, loan) =>
    sum + loan.drawdowns.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0), 0)
  const totalEquityContribution = input.equityContributions.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
  const totalFunding = totalDebtDrawdown + totalEquityContribution
  const totalInvestment = Math.max(0, input.fixedInvestment) + Math.max(0, input.preOperatingCost)
  const weightedCostOfDebt = totalDebtDrawdown > 0
    ? input.loans.reduce((sum, loan) => sum + loan.drawdowns.reduce((a, b) => a + Math.max(0, Number(b) || 0), 0) * Math.max(0, loan.annualRate), 0) / totalDebtDrawdown
    : 0
  const equityWeight = totalFunding > 0 ? totalEquityContribution / totalFunding * 100 : 0
  const debtWeight = totalFunding > 0 ? totalDebtDrawdown / totalFunding * 100 : 0
  const waccResult = totalFunding > 0
    ? calculateWacc({
        equityWeight,
        debtWeight,
        costOfEquity: Math.max(0, input.costOfEquity),
        costOfDebt: weightedCostOfDebt,
        taxRate: Math.max(0, Math.min(100, input.waccTaxRate ?? input.taxRate)),
      })
    : { value: null as number | null, valid: false, weightTotal: 0 }
  const wacc = waccResult.valid && waccResult.value !== null ? waccResult.value : null
  const discountRate = input.discountMode === 'manual'
    ? Math.max(0, input.manualDiscountRate) / 100
    : wacc

  let priorCash = 0
  let priorWorkingCapital = 0
  let taxLoss = 0
  let unleveredTaxLoss = 0
  let cumulativeProject = 0
  let cumulativeDiscounted = 0
  let simplePayback: number | null = null
  let discountedPayback: number | null = null
  const annualRows: IntegratedFinanceYear[] = []

  for (let index = 0; index < years; index++) {
    const year = index + 1
    const utilization = Math.max(0, Math.min(1, Number(input.utilization[index] ?? 0)))
    const operatingYear = Math.max(0, year - constructionYears - 1)
    const salesFactor = Math.pow(1 + Math.max(-99, input.salesEscalationPercent) / 100, operatingYear)
    const opexFactor = Math.pow(1 + Math.max(-99, input.opexEscalationPercent) / 100, operatingYear)
    const revenue = Math.max(0, input.fullCapacityRevenue) * utilization * salesFactor
    const variableCashCost = Math.max(0, input.fullCapacityVariableCashCost) * utilization * opexFactor
    const fixedCashCost = year > constructionYears && utilization > 0 ? Math.max(0, input.fullCapacityFixedCashCost) * opexFactor : 0
    const depreciation = year > constructionYears && utilization > 0 ? Math.max(0, input.annualDepreciation) : 0
    const fixedInvestment = Math.max(0, Number(input.fixedInvestmentSchedule[index]) || 0)
    const preOperatingCost = Math.max(0, Number(input.preOperatingSchedule[index]) || 0)
    const workingCapitalBreakdown: WorkingCapitalBreakdown = input.workingCapitalPolicy
      ? (year > constructionYears && utilization > 0 ? calculateOperatingCycleWorkingCapital(input.workingCapitalPolicy, utilization, salesFactor, opexFactor) : { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: 0 })
      : { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: year > constructionYears ? (variableCashCost + fixedCashCost) * Math.max(0, input.workingCapitalPercent) / 100 : 0 }
    const workingCapital = workingCapitalBreakdown.netWorkingCapital
    const changeInWorkingCapital = workingCapital - priorWorkingCapital
    priorWorkingCapital = workingCapital

    const loanRows = input.loans.map(loan => loanSchedules[loan.id][index])
    const debtDrawdown = loanRows.reduce((sum, row) => sum + row.drawdown, 0)
    const principal = loanRows.reduce((sum, row) => sum + row.principal, 0)
    const interest = loanRows.reduce((sum, row) => sum + row.interestExpense, 0)
    const debtBalance = loanRows.reduce((sum, row) => sum + row.closingBalance, 0)
    const ebit = revenue - variableCashCost - fixedCashCost - depreciation

    const effectiveTaxRate = Math.max(0, Math.min(100, Number(input.taxRateSchedule?.[index] ?? input.taxRate)))
    const taxableProfit = ebit - interest - taxLoss
    const tax = Math.max(0, taxableProfit) * effectiveTaxRate / 100
    taxLoss = taxableProfit < 0 ? -taxableProfit : 0

    const unleveredTaxableProfit = ebit - unleveredTaxLoss
    const unleveredTax = Math.max(0, unleveredTaxableProfit) * effectiveTaxRate / 100
    unleveredTaxLoss = unleveredTaxableProfit < 0 ? -unleveredTaxableProfit : 0

    const salvageProceeds = year === years ? Math.max(0, input.salvageValue || 0) : 0
    const terminalValue = salvageProceeds + (year === years ? workingCapital : 0)
    const equityContribution = Math.max(0, Number(input.equityContributions[index]) || 0)
    const projectFreeCashFlow = ebit - unleveredTax + depreciation - fixedInvestment - preOperatingCost - changeInWorkingCapital + terminalValue
    const equityFreeCashFlow = -equityContribution + revenue - variableCashCost - fixedCashCost - tax - interest - principal - changeInWorkingCapital + terminalValue
    const debtService = principal + interest
    const cfads = revenue - variableCashCost - fixedCashCost - tax - changeInWorkingCapital
    const dscr = debtService > 0 ? cfads / debtService : null
    const cashBalance = priorCash + equityContribution + debtDrawdown + revenue - variableCashCost - fixedCashCost -
      fixedInvestment - preOperatingCost - tax - interest - principal - changeInWorkingCapital + terminalValue
    priorCash = cashBalance

    cumulativeProject += projectFreeCashFlow
    if (simplePayback === null && cumulativeProject >= 0 && year > constructionYears) simplePayback = year
    if (discountRate !== null) {
      cumulativeDiscounted += projectFreeCashFlow / Math.pow(1 + discountRate, year)
      if (discountedPayback === null && cumulativeDiscounted >= 0 && year > constructionYears) discountedPayback = year
    }

    annualRows.push({
      year, utilization, production: Math.max(0, input.capacity) * utilization, revenue,
      variableCashCost, fixedCashCost, depreciation, ebit, interest, taxableProfit, tax, principal, debtDrawdown,
      equityContribution, fixedInvestment, preOperatingCost, workingCapital, workingCapitalBreakdown, salvageProceeds, terminalValue, changeInWorkingCapital,
      projectFreeCashFlow, equityFreeCashFlow, cashBalance, debtBalance, debtService, dscr,
    })
  }

  const projectFlows = [0, ...annualRows.map(row => row.projectFreeCashFlow)]
  const equityFlows = [0, ...annualRows.map(row => row.equityFreeCashFlow)]
  const npvProject = discountRate === null ? null : calculateNpv(projectFlows, discountRate)
  const irrProject = calculateIrr(projectFlows)
  const npvEquity = calculateNpv(equityFlows, Math.max(0, input.costOfEquity) / 100)
  const irrEquity = calculateIrr(equityFlows)
  const mirrProject = discountRate === null ? null : calculateMirr(projectFlows, discountRate, discountRate)
  const mirrEquity = calculateMirr(equityFlows, Math.max(0, input.costOfEquity) / 100, Math.max(0, input.costOfEquity) / 100)
  const peakWorkingCapital = Math.max(0, ...annualRows.map(row => row.workingCapital))
  const fundingGap = totalInvestment + peakWorkingCapital - totalFunding
  const warnings: string[] = []
  if (totalFunding <= 0) warnings.push('ساختار تأمین مالی ثبت نشده است؛ WACC محاسبه نمی‌شود.')
  if (totalEquityContribution <= 0 && totalDebtDrawdown > 0) warnings.push('آورده نقدی سهامدار ثبت نشده است؛ وزن حقوق صاحبان سهام صفر است.')
  if (totalFunding + 1 < totalInvestment + peakWorkingCapital) warnings.push('منابع مالی ثبت‌شده برای سرمایه‌گذاری و سرمایه در گردش کافی نیست.')
  if (input.loans.some(loan => loan.annualRate <= 0 && loan.drawdowns.some(value => value > 0))) warnings.push('برای یک یا چند وام، نرخ بهره صفر یا ثبت‌نشده است.')
  if (input.loans.some(loan => loan.termYears <= 0 && loan.drawdowns.some(value => value > 0))) warnings.push('برای یک یا چند وام، دوره بازپرداخت ثبت نشده است.')
  if (input.workingCapitalPolicy) {
    const policy = input.workingCapitalPolicy
    const dayEntries: [string, number][] = [['موجودی مواد اولیه', policy.rawMaterialDays], ['کالای در جریان ساخت', policy.workInProgressDays], ['محصول نهایی', policy.finishedGoodsDays], ['وصول مطالبات', policy.receivableDays], ['حداقل نقد عملیاتی', policy.cashDays], ['پرداخت بدهی تجاری', policy.payableDays]]
    dayEntries.forEach(([label, days]) => {
      if (!Number.isFinite(days) || days < 0) warnings.push(`روزهای ${label} باید عددی معتبر و غیرمنفی باشد.`)
      else if (days > policy.dayBasis) warnings.push(`دوره ${label} از مبنای روزهای سال بیشتر است؛ در محاسبه به مبنای سال محدود می‌شود.`)
    })
    const completionEntries: [string, number][] = [['درصد تکمیل مواد در جریان ساخت', policy.workInProgressMaterialCompletionPercent], ['درصد تکمیل تبدیل در جریان ساخت', policy.workInProgressConversionCompletionPercent]]
    completionEntries.forEach(([label, value]) => { if (!Number.isFinite(value) || value < 0 || value > 100) warnings.push(`${label} باید بین صفر تا ۱۰۰ درصد باشد.`) })
    const payableBase = policy.annualPayablesCost ?? policy.annualRawMaterialCost
    const costEntries: [string, number][] = [['هزینه مواد اولیه', policy.annualRawMaterialCost], ['هزینه ثابت مواد اولیه', policy.annualFixedRawMaterialCost ?? 0], ['مبنای بدهی تجاری', payableBase], ['هزینه ثابت مشمول بدهی تجاری', policy.annualFixedPayablesCost ?? 0], ['هزینه تبدیل', policy.annualConversionCost], ['هزینه ثابت تبدیل', policy.annualFixedConversionCost ?? 0], ['بهای محصول نهایی', policy.annualFinishedGoodsCost], ['هزینه ثابت محصول نهایی', policy.annualFixedFinishedGoodsCost ?? 0], ['درآمد فروش', policy.annualRevenue], ['هزینه نقدی عملیاتی', policy.annualCashOperatingCost], ['هزینه ثابت نقدی عملیاتی', policy.annualFixedCashOperatingCost ?? 0]]
    costEntries.forEach(([label, value]) => { if (!Number.isFinite(value) || value < 0) warnings.push(`${label} باید عددی معتبر و غیرمنفی باشد.`) })
    const fixedCostCaps: [string, number, number][] = [['هزینه ثابت مواد اولیه', policy.annualFixedRawMaterialCost ?? 0, policy.annualRawMaterialCost], ['هزینه ثابت مشمول بدهی تجاری', policy.annualFixedPayablesCost ?? 0, payableBase], ['هزینه ثابت تبدیل', policy.annualFixedConversionCost ?? 0, policy.annualConversionCost], ['هزینه ثابت محصول نهایی', policy.annualFixedFinishedGoodsCost ?? 0, policy.annualFinishedGoodsCost], ['هزینه ثابت نقدی عملیاتی', policy.annualFixedCashOperatingCost ?? 0, policy.annualCashOperatingCost]]
    fixedCostCaps.forEach(([label, fixed, total]) => { if (Number.isFinite(fixed) && Number.isFinite(total) && fixed > total) warnings.push(`${label} از کل مبنای هزینه بیشتر است؛ در محاسبه به سقف کل هزینه محدود می‌شود.`) })
  }
  if (input.taxRateSchedule?.some(rate => !Number.isFinite(rate) || rate < 0 || rate > 100)) warnings.push('نرخ مالیات عملکرد سالانه باید در تمام دوره‌ها بین صفر تا ۱۰۰ درصد باشد.')
  if (input.waccTaxRate !== undefined && (!Number.isFinite(input.waccTaxRate) || input.waccTaxRate < 0 || input.waccTaxRate > 100)) warnings.push('نرخ مالیات سپر مالیاتی WACC باید بین صفر تا ۱۰۰ درصد باشد.')
  if (input.discountMode === 'wacc' && discountRate === null) warnings.push('برای محاسبه نرخ تنزیل، ساختار سرمایه و نرخ بازده مورد انتظار سهامدار را تکمیل کنید.')
  if (input.loans.some(loan => loan.repaymentStartYear + loan.graceYears + loan.termYears - 1 > years)) warnings.push('بخشی از بازپرداخت وام‌ها خارج از افق زمانی مدل قرار می‌گیرد.')
  return {
    years: annualRows, loanSchedules, wacc, discountRate, weightedCostOfDebt, equityWeight, debtWeight,
    npvProject, irrProject, npvEquity, irrEquity, mirrProject, mirrEquity, simplePayback, discountedPayback,
    peakWorkingCapital, totalDebtDrawdown, totalEquityContribution, totalFunding, totalInvestment, fundingGap, warnings,
  }
}
