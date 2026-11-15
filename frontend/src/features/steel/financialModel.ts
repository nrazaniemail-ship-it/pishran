import type { FixedInvestmentItem, ProjectFoundation, ProjectPeriodFrequency } from '../projects/projectFoundation'

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
  energyDays?: number
  annualEnergyCost?: number
  sparePartsDays?: number
  annualSparePartsCost?: number
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
  energy?: number
  spareParts?: number
  workInProgress: number
  finishedGoods: number
  receivables: number
  minimumCash: number
  payables: number
  netWorkingCapital: number
}

export function calculateOperatingCycleWorkingCapital(policy: WorkingCapitalPolicy, utilization: number, salesFactor = 1, opexFactor = 1): WorkingCapitalBreakdown {
  const values = [policy.dayBasis, policy.rawMaterialDays, policy.energyDays ?? 0, policy.sparePartsDays ?? 0, policy.workInProgressDays, policy.workInProgressMaterialCompletionPercent, policy.workInProgressConversionCompletionPercent, policy.finishedGoodsDays, policy.receivableDays, policy.cashDays, policy.payableDays, policy.annualRawMaterialCost, policy.annualEnergyCost ?? 0, policy.annualSparePartsCost ?? 0, policy.annualFixedRawMaterialCost ?? 0, policy.annualPayablesCost ?? policy.annualRawMaterialCost, policy.annualFixedPayablesCost ?? 0, policy.annualConversionCost, policy.annualFixedConversionCost ?? 0, policy.annualFinishedGoodsCost, policy.annualFixedFinishedGoodsCost ?? 0, policy.annualRevenue, policy.annualCashOperatingCost, policy.annualFixedCashOperatingCost ?? 0, utilization, salesFactor, opexFactor]
  if (!values.every(Number.isFinite) || policy.dayBasis <= 0 || values.slice(1).some(value => value < 0) || policy.workInProgressMaterialCompletionPercent > 100 || policy.workInProgressConversionCompletionPercent > 100) return { rawMaterials: 0, energy: 0, spareParts: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: 0 }
  const day = (base: number, days: number, factor: number) => base * factor * Math.min(days, policy.dayBasis) / policy.dayBasis
  const activeFactor = utilization > 0 ? 1 : 0
  const fixedRawMaterials = Math.min(policy.annualRawMaterialCost, policy.annualFixedRawMaterialCost ?? 0)
  const variableRawMaterials = policy.annualRawMaterialCost - fixedRawMaterials
  const rawMaterials = day(variableRawMaterials, policy.rawMaterialDays, utilization * opexFactor)
    + day(fixedRawMaterials, policy.rawMaterialDays, activeFactor * opexFactor)
  const energy = day(policy.annualEnergyCost ?? 0, policy.energyDays ?? 0, utilization * opexFactor)
  const spareParts = day(policy.annualSparePartsCost ?? 0, policy.sparePartsDays ?? 0, utilization * opexFactor)
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
  return { rawMaterials, energy, spareParts, workInProgress, finishedGoods, receivables, minimumCash, payables, netWorkingCapital: rawMaterials + energy + spareParts + workInProgress + finishedGoods + receivables + minimumCash - payables }
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
      differencePercent: difference !== null && reference !== null && reference !== 0 ? difference / Math.abs(reference) * 100 : null,
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
  depreciationSchedule?: number[]
  maintenanceCapexSchedule?: number[]
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
  mirrFinanceRate?: number
  mirrReinvestmentRate?: number
  equityMirrFinanceRate?: number
  equityMirrReinvestmentRate?: number
  salvageValue?: number
  assetSaleSchedule?: { saleProceeds: number; returnOfCapital: number; otherIncomeLoss: number; bookValueDisposed: number }[]
}

export type IntegratedLoanYear = {
  drawdown: number
  openingBalance: number
  interestExpense: number
  capitalizedInterest: number
  principal: number
  closingBalance: number
  accruedInterestBalance?: number
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
  taxLossCarryForward: number
  tax: number
  principal: number
  debtDrawdown: number
  equityContribution: number
  fixedInvestment: number
  preOperatingCost: number
  maintenanceCapex: number
  capitalizedInterest: number
  workingCapital: number
  closingWorkingCapital: number
  workingCapitalBreakdown: WorkingCapitalBreakdown
  salvageProceeds: number
  assetSaleProceeds: number
  assetReturnOfCapital: number
  assetSaleOtherIncomeLoss: number
  assetBookValueDisposed: number
  terminalValue: number
  changeInWorkingCapital: number
  projectFreeCashFlow: number
  equityFreeCashFlow: number
  cashBalance: number
  debtBalance: number
  debtService: number
  cfads: number
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
  let equalPrincipalPayment: number | null = null
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
        if (equalPrincipalPayment === null) equalPrincipalPayment = availableBalance / term
        principal = Math.min(availableBalance, equalPrincipalPayment)
      }
    }
    balance = Math.max(0, availableBalance - principal)
    result.push({ drawdown, openingBalance, interestExpense, capitalizedInterest, principal, closingBalance: balance })
  }
  return result
}

/** Integrated project model with a 60-period planning horizon. All monetary inputs must use the same base currency. */
export function calculateIntegratedFinance(input: IntegratedFinanceInput): IntegratedFinanceResult {
  const years = Math.max(1, Math.min(60, Math.floor(input.years || 20)))
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
    const depreciation = year > constructionYears && utilization > 0 ? Math.max(0, Number(input.depreciationSchedule?.[index] ?? input.annualDepreciation)) : 0
    const maintenanceCapex = Math.max(0, Number(input.maintenanceCapexSchedule?.[index]) || 0)
    const fixedInvestment = Math.max(0, Number(input.fixedInvestmentSchedule[index]) || 0)
    const preOperatingCost = Math.max(0, Number(input.preOperatingSchedule[index]) || 0)
    const workingCapitalBreakdown: WorkingCapitalBreakdown = input.workingCapitalPolicy
      ? (year > constructionYears && utilization > 0 ? calculateOperatingCycleWorkingCapital(input.workingCapitalPolicy, utilization, salesFactor, opexFactor) : { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: 0 })
      : (() => { const amount = year > constructionYears ? (variableCashCost + fixedCashCost) * Math.max(0, input.workingCapitalPercent) / 100 : 0; return { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: amount, payables: 0, netWorkingCapital: amount } })()
    const calculatedWorkingCapital = workingCapitalBreakdown.netWorkingCapital
    const workingCapital = calculatedWorkingCapital
    const closingWorkingCapital = year === years ? 0 : calculatedWorkingCapital
    const statementWorkingCapitalBreakdown: WorkingCapitalBreakdown = year === years ? { rawMaterials: 0, workInProgress: 0, finishedGoods: 0, receivables: 0, minimumCash: 0, payables: 0, netWorkingCapital: 0 } : workingCapitalBreakdown
    const changeInWorkingCapital = closingWorkingCapital - priorWorkingCapital
    priorWorkingCapital = closingWorkingCapital

    const loanRows = input.loans.map(loan => loanSchedules[loan.id][index])
    const debtDrawdown = loanRows.reduce((sum, row) => sum + row.drawdown, 0)
    const principal = loanRows.reduce((sum, row) => sum + row.principal, 0)
    const interest = loanRows.reduce((sum, row) => sum + row.interestExpense, 0)
    const capitalizedInterest = loanRows.reduce((sum, row) => sum + row.capitalizedInterest, 0)
    const debtBalance = loanRows.reduce((sum, row) => sum + row.closingBalance, 0)
    const assetSale = input.assetSaleSchedule?.[index]
    const assetSaleProceeds = Math.max(0, Number(assetSale?.saleProceeds) || 0)
    const assetReturnOfCapital = Math.max(0, Number(assetSale?.returnOfCapital) || 0)
    const assetSaleOtherIncomeLoss = Number.isFinite(assetSale?.otherIncomeLoss) ? Number(assetSale?.otherIncomeLoss) : 0
    const assetBookValueDisposed = Math.max(0, Number(assetSale?.bookValueDisposed) || 0)
    const ebit = revenue - variableCashCost - fixedCashCost - depreciation + assetSaleOtherIncomeLoss

    const effectiveTaxRate = Math.max(0, Math.min(100, Number(input.taxRateSchedule?.[index] ?? input.taxRate)))
    const taxableProfit = ebit - interest - taxLoss
    const tax = Math.max(0, taxableProfit) * effectiveTaxRate / 100
    taxLoss = taxableProfit < 0 ? -taxableProfit : Math.max(0, taxLoss - (ebit - interest))
    const taxLossCarryForward = taxLoss

    const unleveredTaxableProfit = ebit - unleveredTaxLoss
    const unleveredTax = Math.max(0, unleveredTaxableProfit) * effectiveTaxRate / 100
    unleveredTaxLoss = unleveredTaxableProfit < 0 ? -unleveredTaxableProfit : Math.max(0, unleveredTaxLoss - ebit)

    const salvageProceeds = year === years ? Math.max(0, input.salvageValue || 0) : 0
    const terminalValue = salvageProceeds + assetSaleProceeds
    const equityContribution = Math.max(0, Number(input.equityContributions[index]) || 0)
    const projectFreeCashFlow = ebit - assetSaleOtherIncomeLoss - unleveredTax + depreciation - fixedInvestment - preOperatingCost - maintenanceCapex - changeInWorkingCapital + terminalValue
    const equityFreeCashFlow = -equityContribution + revenue - variableCashCost - fixedCashCost - tax - interest - principal - maintenanceCapex - changeInWorkingCapital + terminalValue
    const debtService = principal + interest
    const cfads = revenue - variableCashCost - fixedCashCost - tax - maintenanceCapex - changeInWorkingCapital
    const dscr = debtService > 0 ? cfads / debtService : null
    const cashBalance = priorCash + equityContribution + debtDrawdown + revenue - variableCashCost - fixedCashCost -
      fixedInvestment - preOperatingCost - maintenanceCapex - tax - interest - principal - changeInWorkingCapital + terminalValue
    priorCash = cashBalance

    cumulativeProject += projectFreeCashFlow
    if (simplePayback === null && cumulativeProject >= 0 && year > constructionYears) simplePayback = year
    if (discountRate !== null) {
      cumulativeDiscounted += projectFreeCashFlow / Math.pow(1 + discountRate, year - 1)
      if (discountedPayback === null && cumulativeDiscounted >= 0 && year > constructionYears) discountedPayback = year
    }

    annualRows.push({
      year, utilization, production: Math.max(0, input.capacity) * utilization, revenue,
      variableCashCost, fixedCashCost, depreciation, ebit, interest, taxableProfit, taxLossCarryForward, tax, principal, debtDrawdown,
      equityContribution, fixedInvestment, preOperatingCost, maintenanceCapex, capitalizedInterest, workingCapital, closingWorkingCapital, workingCapitalBreakdown: statementWorkingCapitalBreakdown, salvageProceeds, assetSaleProceeds, assetReturnOfCapital, assetSaleOtherIncomeLoss, assetBookValueDisposed, terminalValue, changeInWorkingCapital,
      projectFreeCashFlow, equityFreeCashFlow, cashBalance, debtBalance, debtService, cfads, dscr,
    })
  }

  const projectFlows = annualRows.map(row => row.projectFreeCashFlow)
  const equityFlows = annualRows.map(row => row.equityFreeCashFlow)
  const npvProject = discountRate === null ? null : calculateNpv(projectFlows, discountRate)
  const irrProject = calculateIrr(projectFlows)
  const npvEquity = calculateNpv(equityFlows, Math.max(0, input.costOfEquity) / 100)
  const irrEquity = calculateIrr(equityFlows)
  const mirrProject = discountRate === null ? null : calculateMirr(projectFlows, Math.max(-99, input.mirrFinanceRate ?? discountRate * 100) / 100, Math.max(-99, input.mirrReinvestmentRate ?? discountRate * 100) / 100)
  const mirrEquity = calculateMirr(equityFlows, Math.max(-99, input.equityMirrFinanceRate ?? input.costOfEquity) / 100, Math.max(-99, input.equityMirrReinvestmentRate ?? input.costOfEquity) / 100)
  const peakWorkingCapital = Math.max(0, ...annualRows.map(row => row.workingCapital))
  const fundingGap = totalInvestment + peakWorkingCapital - totalFunding
  if (input.assetSaleSchedule?.some(row => ![row.saleProceeds,row.returnOfCapital,row.otherIncomeLoss,row.bookValueDisposed].every(Number.isFinite) || row.saleProceeds < 0 || row.returnOfCapital < 0 || row.bookValueDisposed < 0 || Math.abs(row.saleProceeds-row.returnOfCapital-row.otherIncomeLoss)>0.01)) warnings.push('برنامه فروش دارایی باید عواید فروش را با Return of capital و Other income/loss تطبیق دهد و ارزش‌ها معتبر باشند.')
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


export type DepreciationAssetInput = {
  id: string
  name: string
  cost: number
  residualValue: number
  usefulLife: number
  startYear: number
  method: 'straight-line' | 'declining-balance'
  decliningRate?: number
}

export type AssetDepreciationYear = {
  year: number
  depreciation: number
  closingBookValue: number
  assets: { id: string; name: string; depreciation: number; closingBookValue: number }[]
}

/** Asset-by-asset depreciation schedule. Years are model periods, starting at 1. */
export function calculateAssetDepreciationSchedule(assets: DepreciationAssetInput[], years: number): AssetDepreciationYear[] {
  const safeYears = Math.max(0, Math.min(60, Math.floor(years)))
  const books = new Map<string, number>()
  const rows: AssetDepreciationYear[] = []
  for (let index = 0; index < safeYears; index++) {
    const year = index + 1
    let total = 0
    let closingTotal = 0
    const assetRows = assets.map(asset => {
      const valid = finiteNonNegative(asset.cost) && finiteNonNegative(asset.residualValue)
        && asset.residualValue <= asset.cost && Number.isFinite(asset.usefulLife) && asset.usefulLife > 0
        && Number.isFinite(asset.startYear) && asset.startYear >= 1
      if (!valid) return { id: asset.id, name: asset.name, depreciation: 0, closingBookValue: books.get(asset.id) ?? 0 }
      const opening = books.has(asset.id) ? books.get(asset.id)! : asset.cost
      const age = year - Math.floor(asset.startYear) + 1
      let depreciation = 0
      if (age > 0 && age <= Math.ceil(asset.usefulLife) && opening > asset.residualValue) {
        if (asset.method === 'declining-balance') {
          const rate = finiteNonNegative(asset.decliningRate ?? 0) && (asset.decliningRate ?? 0) > 0
            ? (asset.decliningRate ?? 0) / 100 : 2 / asset.usefulLife
          depreciation = Math.min(opening - asset.residualValue, opening * rate)
        } else {
          depreciation = Math.min(opening - asset.residualValue, (asset.cost - asset.residualValue) / asset.usefulLife)
        }
        if (age >= Math.ceil(asset.usefulLife)) depreciation = opening - asset.residualValue
      }
      const closingBookValue = Math.max(asset.residualValue, opening - depreciation)
      books.set(asset.id, closingBookValue)
      total += depreciation
      closingTotal += closingBookValue
      return { id: asset.id, name: asset.name, depreciation, closingBookValue }
    })
    rows.push({ year, depreciation: total, closingBookValue: closingTotal, assets: assetRows })
  }
  return rows
}


export type ComfarDepreciationMethod = 'none' | 'linear-to-zero' | 'linear-to-scrap' | 'accelerated' | 'sum-of-years-digits'

/**
 * One acquisition vintage / asset cohort. For an existing asset, initialBookValue is
 * its book value at the start of this schedule; originalValue remains the historical
 * gross cost used to calculate the COMFAR scrap percentage.
 */
export type ComfarDepreciationAssetInput = {
  id: string
  name: string
  originalValue: number
  initialBookValue: number
  scrapPercent: number
  lengthYears: number
  lengthMonths?: number
  ratePercent?: number
  method: ComfarDepreciationMethod
  acquisitionPeriod: number
  startingAtPeriod: number
  firstDepreciationMonths?: number
  acquisitionDate?: string
  startingAtDate?: string
}

export type ComfarAssetDepreciationRow = {
  id: string
  name: string
  methodApplied: ComfarDepreciationMethod | null
  openingBookValue: number
  depreciation: number
  closingBookValue: number
}

export type ComfarDepreciationPeriod = {
  period: number
  depreciation: number
  closingBookValue: number
  assets: ComfarAssetDepreciationRow[]
}

export type ComfarDepreciationSchedule = {
  valid: boolean
  warnings: string[]
  periods: ComfarDepreciationPeriod[]
}

/** COMFAR VII.N: pre-existing assets start at Starting at; later acquisitions start in the following production period. */
function comparableComfarDate(value?: string): number | null {
  if (!value) return null
  const match = /^(\\d{3,4})[-/](\\d{1,2})[-/](\\d{1,2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return year * 10000 + month * 100 + day
}

export function resolveComfarDepreciationStartPeriod(
  acquisitionPeriod: number,
  startingAtPeriod: number,
  acquisitionDate?: string,
  startingAtDate?: string,
): number | null {
  if (!Number.isInteger(acquisitionPeriod) || acquisitionPeriod < 0 || !Number.isInteger(startingAtPeriod) || startingAtPeriod < 1) return null
  if (acquisitionPeriod < startingAtPeriod) return startingAtPeriod
  if (acquisitionPeriod === startingAtPeriod) {
    const acquiredOn = comparableComfarDate(acquisitionDate)
    const startingOn = comparableComfarDate(startingAtDate)
    if (acquiredOn !== null && startingOn !== null && acquiredOn < startingOn) return startingAtPeriod
  }
  return acquisitionPeriod + 1
}

/**
 * COMFAR III Expert XI.H depreciation algorithms.
 * Each input row represents one acquisition vintage. The caller supplies the
 * first-year month count derived from the project's balance-date calendar.
 */
export function calculateComfarAssetDepreciationSchedule(
  assets: ComfarDepreciationAssetInput[],
  periodCount: number,
): ComfarDepreciationSchedule {
  const count = Number.isInteger(periodCount) ? Math.max(0, Math.min(120, periodCount)) : 0
  const warnings: string[] = []
  const perAsset = new Map<number, ComfarAssetDepreciationRow[]>()
  for (let period = 1; period <= count; period += 1) perAsset.set(period, [])

  for (const asset of assets) {
    const months = asset.lengthMonths ?? 0
    const firstMonths = asset.firstDepreciationMonths ?? 12
    const length = asset.lengthYears + months / 12
    const scrapValue = asset.originalValue * asset.scrapPercent / 100
    const startPeriod = resolveComfarDepreciationStartPeriod(asset.acquisitionPeriod, asset.startingAtPeriod, asset.acquisitionDate, asset.startingAtDate)
    const valid = [asset.originalValue, asset.initialBookValue, asset.scrapPercent, asset.lengthYears, months, firstMonths].every(Number.isFinite)
      && asset.originalValue >= 0 && asset.initialBookValue >= 0 && scrapValue <= asset.initialBookValue + 1e-8
      && asset.scrapPercent >= 0 && asset.scrapPercent <= 100
      && Number.isInteger(asset.lengthYears) && asset.lengthYears >= 0
      && Number.isInteger(months) && months >= 0 && months <= 11
      && (asset.method === 'none' || length > 0) && Number.isInteger(firstMonths) && firstMonths >= 1 && firstMonths <= 12
      && startPeriod !== null
      && (asset.method === 'none'
        || (asset.method === 'sum-of-years-digits'
          ? months === 0 && firstMonths === 12
          : Number.isFinite(asset.ratePercent) && (asset.ratePercent ?? 0) > 0 && (asset.ratePercent ?? 0) <= 100))
      && (asset.method !== 'accelerated' || (asset.ratePercent ?? 0) < 100)
    if (!valid) {
      warnings.push(`${asset.name}: داده‌های استهلاک معتبر نیست یا حالت تقویمی این روش هنوز با فرمول مرجع قابل محاسبه نیست.`)
      for (let period = 1; period <= count; period += 1) {
        const exists = period >= asset.acquisitionPeriod
        const bookValue = exists ? asset.initialBookValue : 0
        perAsset.get(period)!.push({ id: asset.id, name: asset.name, methodApplied: null, openingBookValue: bookValue, depreciation: 0, closingBookValue: bookValue })
      }
      continue
    }

    const annualRateFromLength = 100 / length
    if ((asset.method === 'linear-to-zero' || asset.method === 'linear-to-scrap')
      && Math.abs((asset.ratePercent ?? 0) - annualRateFromLength) > 0.02) {
      warnings.push(`${asset.name}: نرخ سالانه با مدت استهلاک سازگار نیست؛ نرخ و مدت را مطابق هم تنظیم کنید.`)
    }

    const depreciationByPeriod = new Map<number, { amount: number; method: ComfarDepreciationMethod }>()
    let bookValue = asset.initialBookValue
    const salvage = scrapValue
    const m1 = firstMonths
    const maxAge = Math.min(120, Math.ceil(length + (12 - m1) / 12) + 2)

    if (asset.method === 'none') {
      // Land and other non-depreciated assets remain at book value until disposal.
    } else if (asset.method === 'linear-to-zero' || asset.method === 'linear-to-scrap') {
      const depreciableBase = asset.method === 'linear-to-zero' ? asset.initialBookValue : asset.initialBookValue - salvage
      const m = asset.method === 'linear-to-zero'
        ? Math.floor(((asset.initialBookValue - salvage) * length / Math.max(asset.initialBookValue, 1e-12)) - m1 / 12 + 1)
        : Math.floor(length)
      const first = depreciableBase / length * m1 / 12
      for (let age = 1; age <= Math.max(1, m + 1) && age <= maxAge; age += 1) {
        const amount = age === 1 ? first : age <= m ? depreciableBase / length : Math.max(0, bookValue - salvage)
        const depreciation = Math.min(Math.max(0, bookValue - salvage), Math.max(0, amount))
        const period = startPeriod! + age - 1
        depreciationByPeriod.set(period, { amount: depreciation, method: asset.method })
        bookValue = Math.max(salvage, bookValue - depreciation)
      }
    } else if (asset.method === 'accelerated') {
      const rate = (asset.ratePercent ?? 0) / 100
      for (let age = 1; age <= maxAge && bookValue > salvage + 1e-8; age += 1) {
        const remainingLife = length - (age - 1) - m1 / 12
        if (remainingLife <= 0) {
          const period = startPeriod! + age - 1
          const depreciation = Math.max(0, bookValue - salvage)
          depreciationByPeriod.set(period, { amount: depreciation, method: 'linear-to-scrap' })
          bookValue = salvage
          break
        }
        const periodFraction = age === 1 ? m1 / 12 : 1
        const acceleratedAnnual = bookValue * rate
        const linearAnnual = (bookValue - salvage) / remainingLife
        const useAccelerated = acceleratedAnnual > linearAnnual
        const amount = (useAccelerated ? acceleratedAnnual : linearAnnual) * periodFraction
        const depreciation = Math.min(bookValue - salvage, Math.max(0, amount))
        const period = startPeriod! + age - 1
        depreciationByPeriod.set(period, { amount: depreciation, method: useAccelerated ? 'accelerated' : 'linear-to-scrap' })
        bookValue = Math.max(salvage, bookValue - depreciation)
      }
    } else if (asset.method === 'sum-of-years-digits') {
      const years = asset.lengthYears
      const divisor = years * (years + 1) / 2
      for (let age = 1; age <= years; age += 1) {
        const amount = (years - age + 1) / divisor * (asset.initialBookValue - salvage)
        const depreciation = Math.min(Math.max(0, bookValue - salvage), amount)
        const period = startPeriod! + age - 1
        depreciationByPeriod.set(period, { amount: depreciation, method: asset.method })
        bookValue = Math.max(salvage, bookValue - depreciation)
      }
    }

    let rollingBookValue = asset.acquisitionPeriod === 0 ? asset.initialBookValue : 0
    for (let period = 1; period <= count; period += 1) {
      if (period < asset.acquisitionPeriod) {
        perAsset.get(period)!.push({
          id: asset.id, name: asset.name, methodApplied: null,
          openingBookValue: 0, depreciation: 0, closingBookValue: 0,
        })
        continue
      }
      if (period === asset.acquisitionPeriod) rollingBookValue = asset.initialBookValue
      const scheduled = depreciationByPeriod.get(period)
      const openingBookValue = rollingBookValue
      const depreciation = scheduled?.amount ?? 0
      rollingBookValue = Math.max(salvage, rollingBookValue - depreciation)
      perAsset.get(period)!.push({
        id: asset.id, name: asset.name, methodApplied: scheduled?.method ?? null,
        openingBookValue, depreciation, closingBookValue: rollingBookValue,
      })
    }
  }

  const periods = Array.from({ length: count }, (_, index) => {
    const period = index + 1
    const rows = perAsset.get(period) ?? []
    return {
      period,
      depreciation: rows.reduce((sum, row) => sum + row.depreciation, 0),
      closingBookValue: rows.reduce((sum, row) => sum + row.closingBookValue, 0),
      assets: rows,
    }
  })
  return { valid: warnings.length === 0, warnings, periods }
}


export type ComfarAssetSaleInput = {
  id: string
  assetId: string
  period: number
  priceMode: 'book-value' | 'self-defined'
  selfDefinedPrice?: number
  exchangeRateToLocal?: number
}

export type ComfarAssetSaleResult = {
  id: string
  assetId: string
  period: number
  bookValueAtSale: number
  saleProceeds: number
  returnOfCapital: number
  extraordinaryIncome: number
  extraordinaryLoss: number
  otherIncomeLoss: number
}

export type ComfarAssetLifecycle = {
  valid: boolean
  warnings: string[]
  depreciation: ComfarDepreciationSchedule
  sales: ComfarAssetSaleResult[]
}

/**
 * COMFAR XI.H–XI.I asset lifecycle.
 * Depreciation is charged through the sale balance date. The remaining book
 * value is removed from fixed assets at disposal; proceeds up to book value
 * are return of capital and the difference is Other income / loss.
 */
export function calculateComfarAssetLifecycle(
  assets: ComfarDepreciationAssetInput[],
  sales: ComfarAssetSaleInput[],
  periodCount: number,
): ComfarAssetLifecycle {
  const depreciation = calculateComfarAssetDepreciationSchedule(assets, periodCount)
  const warnings = [...depreciation.warnings]
  const results: ComfarAssetSaleResult[] = []
  const seenAssets = new Set<string>()
  const saleByAsset = new Map<string, ComfarAssetSaleResult>()
  for (const sale of sales) {
    const asset = assets.find(item => item.id === sale.assetId)
    if (!asset) {
      warnings.push(`Sale ${sale.id}: linked acquisition vintage was not found.`)
      continue
    }
    if (seenAssets.has(sale.assetId)) {
      warnings.push(`${asset.name}: more than one sale is defined for the same acquisition vintage.`)
      continue
    }
    seenAssets.add(sale.assetId)
    if (!Number.isInteger(sale.period) || sale.period < Math.max(1, asset.acquisitionPeriod)
      || sale.period > depreciation.periods.length) {
      warnings.push(`${asset.name}: sale period must fall within the project horizon and after acquisition.`)
      continue
    }
    if (sale.priceMode === 'self-defined' && (!Number.isFinite(sale.selfDefinedPrice)
      || (sale.selfDefinedPrice ?? -1) < 0
      || !Number.isFinite(sale.exchangeRateToLocal) || (sale.exchangeRateToLocal ?? 0) <= 0)) {
      warnings.push(`${asset.name}: a non-negative sale price and positive exchange rate to local currency are required.`)
      continue
    }
    const periodRow = depreciation.periods[sale.period - 1]
    const assetRow = periodRow.assets.find(row => row.id === sale.assetId)
    if (!assetRow) {
      warnings.push(`${asset.name}: depreciation book value is unavailable in the sale period.`)
      continue
    }
    const bookValueAtSale = assetRow.closingBookValue
    const saleProceeds = sale.priceMode === 'book-value'
      ? bookValueAtSale
      : (sale.selfDefinedPrice ?? 0) * (sale.exchangeRateToLocal ?? 1)
    const extraordinaryIncome = Math.max(0, saleProceeds - bookValueAtSale)
    const extraordinaryLoss = Math.max(0, bookValueAtSale - saleProceeds)
    const result: ComfarAssetSaleResult = {
      id: sale.id,
      assetId: sale.assetId,
      period: sale.period,
      bookValueAtSale,
      saleProceeds,
      returnOfCapital: Math.min(saleProceeds, bookValueAtSale),
      extraordinaryIncome,
      extraordinaryLoss,
      otherIncomeLoss: extraordinaryIncome - extraordinaryLoss,
    }
    results.push(result)
    saleByAsset.set(sale.assetId, result)
  }

  if (results.length > 0) {
    for (const period of depreciation.periods) {
      for (const row of period.assets) {
        const sale = saleByAsset.get(row.id)
        if (sale && period.period === sale.period) {
          // Depreciation is charged through the sale balance date; the asset is then derecognised.
          row.closingBookValue = 0
        } else if (sale && period.period > sale.period) {
          row.openingBookValue = 0
          row.depreciation = 0
          row.closingBookValue = 0
          row.methodApplied = null
        }
      }
      period.depreciation = period.assets.reduce((sum, row) => sum + row.depreciation, 0)
      period.closingBookValue = period.assets.reduce((sum, row) => sum + row.closingBookValue, 0)
    }
  }
  return { valid: warnings.length === 0, warnings, depreciation, sales: results }
}



export type FixedInvestmentDepreciationBuild = {
  assets: ComfarDepreciationAssetInput[]
  sales: ComfarAssetSaleInput[]
  warnings: string[]
}

/** Convert the shared fixed-investment register to annual acquisition vintages and linked disposal events. */
export function buildComfarDepreciationAssetsFromFixedInvestmentItems(
  items: FixedInvestmentItem[],
  projectStartYear: number,
  periodCount: number,
  periodFrequency: ProjectPeriodFrequency = 'annual',
  foundation?: ProjectFoundation,
): FixedInvestmentDepreciationBuild {
  const assets: ComfarDepreciationAssetInput[] = []
  const sales: ComfarAssetSaleInput[] = []
  const warnings: string[] = []
  if (!Number.isInteger(projectStartYear) || projectStartYear < 1 || !Number.isInteger(periodCount) || periodCount < 1) {
    return { assets, sales, investmentSchedule, warnings: ['سال شروع پروژه و تعداد دوره‌های سالانه باید پیش از ساخت برنامه استهلاک تعیین شوند.'] }
  }
  if (periodFrequency !== 'annual' && periodFrequency !== 'unspecified') {
    return { assets, sales, investmentSchedule, warnings: ['موتور یکپارچه فعلی فقط برنامه سالانه را محاسبه می‌کند؛ برای دوره‌های نیم‌سالانه، فصلی یا ماهانه، موتور دوره‌ای متناظر باید فعال شود.'] }
  }
  if (periodFrequency === 'unspecified') {
    warnings.push('تناوب دوره در فونداسیون تعیین نشده است؛ نگاشت سالانه فقط برای پیش‌نمایش استفاده می‌شود و نتیجه تا تعیین Annual تأییدشده نیست.')
  }
  const parsePeriod = (value: string): { year: number; date: string | undefined } | null => {
    const match = /^(\\d{3,4})(?:[-/](\\d{1,2})(?:[-/](\\d{1,2}))?)?$/.exec(value.trim())
    if (!match) return null
    const date = match[2] && match[3] ? value.trim().replace(/\\//g, '-') : undefined
    return { year: Number(match[1]), date }
  }
  const methodMap: Record<FixedInvestmentItem['depreciation']['method'], ComfarDepreciationMethod> = {
    none: 'none',
    'linear-zero': 'linear-to-zero',
    'linear-scrap': 'linear-to-scrap',
    accelerated: 'accelerated',
    'sum-of-digits': 'sum-of-years-digits',
  }
  const exchangeRateForSale = (currencyCode: string, period: string): number | null => {
    if (!foundation) return null
    if (currencyCode.trim().toUpperCase() === foundation.currencies.localCurrencyCode.trim().toUpperCase()) return 1
    const currency = foundation.currencies.foreignCurrencies.find(row => row.code.trim().toUpperCase() === currencyCode.trim().toUpperCase())
    if (!currency) return null
    const salePeriod = parsePeriod(period)
    if (!salePeriod) return null
    const exact = currency.exchangeRates.find(row => row.period === period)
    const annual = currency.exchangeRates.find(row => parsePeriod(row.period)?.year === salePeriod.year)
    const rate = exact?.rateToLocal ?? annual?.rateToLocal
    return Number.isFinite(rate) && (rate ?? 0) > 0 ? rate! : null
  }
  for (const item of items) {
    const method = methodMap[item.depreciation.method]
    const starting = parsePeriod(item.depreciation.startingAt)
    if (method !== 'none' && !starting) {
      warnings.push(`${item.description || item.id}: تاریخ Starting at باید به‌صورت سال یا YYYY-MM-DD وارد شود.`)
      continue
    }
    const startingAtPeriod = starting ? Math.max(1, starting.year - projectStartYear + 1) : 1
    for (const acquisition of item.acquisitions) {
      const acquired = parsePeriod(acquisition.period)
      if (!acquired) {
        warnings.push(`${item.description || item.id}: تاریخ/دوره تحصیل «${acquisition.period}» قابل تشخیص نیست.`)
        continue
      }
      if (acquired.year < projectStartYear) {
        warnings.push(`${item.description || item.id}: تحصیل قبل از شروع مدل باید از دفتر Starting Balances با بهای ناخالص و استهلاک انباشته وارد شود؛ این نوبت از محاسبه جدید کنار گذاشته شد.`)
        continue
      }
      const acquisitionPeriod = acquired.year - projectStartYear + 1
      if (acquisitionPeriod > periodCount) continue
      const exchangeRate = item.origin === 'foreign' ? (acquisition.exchangeRateToLocal ?? 0) : 1
      const originalValue = acquisition.quantity * acquisition.unitPrice * exchangeRate
      if (acquisitionPeriod >= 1 && acquisitionPeriod <= investmentSchedule.length) investmentSchedule[acquisitionPeriod - 1] += originalValue
      if (!Number.isFinite(originalValue) || originalValue < 0) {
        warnings.push(`${item.description || item.id}: بهای تحصیل پس از تبدیل به ارز محلی معتبر نیست.`)
        continue
      }
      const assetId = `${item.id}:${acquisition.id}`
      if (method) {
        assets.push({
          id: assetId,
          name: item.description || item.id,
          originalValue,
          initialBookValue: originalValue,
          scrapPercent: item.depreciation.scrapPercent,
          lengthYears: method === 'none' ? 0 : (item.depreciation.lengthYears ?? 0),
          lengthMonths: item.depreciation.lengthMonths,
          ratePercent: item.depreciation.ratePercent ?? undefined,
          method,
          acquisitionPeriod,
          startingAtPeriod,
          firstDepreciationMonths: item.depreciation.firstDepreciationMonths,
          acquisitionDate: acquired.date,
          startingAtDate: starting?.date,
        })
      }
      for (const sale of item.sales.filter(row => row.acquisitionId === acquisition.id)) {
        const sold = parsePeriod(sale.period)
        if (!sold) {
          warnings.push(`${item.description || item.id}: تاریخ فروش «${sale.period}» قابل تشخیص نیست.`)
          continue
        }
        const salePeriod = sold.year - projectStartYear + 1
        if (salePeriod < acquisitionPeriod || salePeriod > periodCount) {
          warnings.push(`${item.description || item.id}: دوره فروش باید پس از تحصیل و در افق پروژه باشد.`)
          continue
        }
        let saleFx = 1
        if (sale.priceMode === 'self-defined' && sale.market === 'foreign') {
          const resolved = exchangeRateForSale(sale.currencyCode, sale.period)
          if (resolved === null) {
            warnings.push(`${item.description || item.id}: برای فروش ارزی در ${sale.period} نرخ تبدیل به ارز محلی تعریف نشده است.`)
            continue
          }
          saleFx = resolved
        }
        sales.push({
          id: sale.id,
          assetId,
          period: salePeriod,
          priceMode: sale.priceMode,
          selfDefinedPrice: sale.selfDefinedPrice ?? undefined,
          exchangeRateToLocal: saleFx,
        })
      }
    }
  }
  return { assets, sales, warnings }
}

export type FixedInvestmentRegisterReconciliation = {
  registerTotal: number
  capexFixedAssetTarget: number
  difference: number
  status: 'not-entered' | 'matched' | 'unreconciled'
  warnings: string[]
}

/**
 * Compare the asset-by-asset acquisition register with aggregate CAPEX.
 * The register is not added to CAPEX here: this is a control bridge only,
 * so the same acquisition cannot be counted twice.
 */
export function reconcileFixedInvestmentRegister(
  items: FixedInvestmentItem[],
  capexTotal: number,
  preOperatingCost = 0,
  tolerance = 1,
): FixedInvestmentRegisterReconciliation {
  const warnings: string[] = []
  const target = Math.max(0, Number(capexTotal) - Math.max(0, Number(preOperatingCost) || 0))
  let registerTotal = 0
  for (const item of items) {
    for (const acquisition of item.acquisitions) {
      const quantity = Number(acquisition.quantity)
      const unitPrice = Number(acquisition.unitPrice)
      const rate = item.origin === 'foreign' ? Number(acquisition.exchangeRateToLocal) : 1
      if (![quantity, unitPrice, rate].every(Number.isFinite) || quantity < 0 || unitPrice < 0 || rate <= 0) {
        warnings.push(`${item.description || item.id}: acquisition cannot be reconciled without a valid quantity, price and exchange rate to local currency.`)
        continue
      }
      registerTotal += quantity * unitPrice * rate
    }
  }
  if (!Number.isFinite(capexTotal) || capexTotal < 0 || !Number.isFinite(preOperatingCost) || preOperatingCost < 0) {
    warnings.push('Aggregate CAPEX and pre-operating cost must be finite non-negative local-currency amounts.')
  }
  const difference = registerTotal - target
  const hasRegister = items.some(item => item.acquisitions.length > 0)
  const status = !hasRegister && target === 0
    ? 'not-entered'
    : Math.abs(difference) <= Math.max(0, tolerance) && warnings.length === 0
      ? 'matched'
      : 'unreconciled'
  if (status === 'unreconciled') {
    warnings.push('Fixed Investment Register acquisitions do not reconcile to aggregate CAPEX excluding pre-operating expenses. Review unallocated CAPEX, non-depreciable assets and duplicate entries before using the register as a cash-investment source.')
  }
  return { registerTotal, capexFixedAssetTarget: target, difference, status, warnings }
}

export type FinancialStatementYear = {
  year: number
  incomeStatement: { revenue: number; cashOperatingCosts: number; ebitda: number; depreciation: number; otherIncomeLoss: number; ebit: number; interest: number; profitBeforeTax: number; tax: number; taxLossCarryForward: number; netIncome: number }
  cashFlowStatement: { operatingCashFlow: number; investingCashFlow: number; financingCashFlow: number; netChangeInCash: number; closingCash: number }
  balanceSheet: { cash: number; workingCapitalAssets: number; netFixedAssets: number; deferredPreOperatingAssets: number; totalAssets: number; tradePayables: number; debt: number; totalLiabilities: number; paidInCapital: number; retainedEarnings: number; totalEquity: number; totalLiabilitiesAndEquity: number; balanceDifference: number; reconciled: boolean }
}

/** Builds linked annual P&L, cash flow and balance sheet; never forces the balance sheet to balance with a plug. */
export function buildThreeFinancialStatements(years: IntegratedFinanceYear[], tolerance = 0.01): FinancialStatementYear[] {
  let retainedEarnings = 0
  let paidInCapital = 0
  let cumulativeGrossFixedAssets = 0
  let cumulativePreOperatingAssets = 0
  let accumulatedDepreciation = 0
  let cumulativeBookValueDisposed = 0
  return years.map(row => {
    const cashOperatingCosts = row.variableCashCost + row.fixedCashCost
    const ebitda = row.revenue - cashOperatingCosts
    const ebit = ebitda - row.depreciation + (row.assetSaleOtherIncomeLoss ?? 0)
    const profitBeforeTax = ebit - row.interest
    const netIncome = profitBeforeTax - row.tax
    retainedEarnings += netIncome
    paidInCapital += row.equityContribution
    cumulativeGrossFixedAssets += row.fixedInvestment + row.maintenanceCapex
    cumulativePreOperatingAssets += row.preOperatingCost + row.capitalizedInterest
    accumulatedDepreciation += row.depreciation
    cumulativeBookValueDisposed += row.assetBookValueDisposed ?? 0
    const currentAssets = row.workingCapitalBreakdown.rawMaterials + (row.workingCapitalBreakdown.energy ?? 0) + (row.workingCapitalBreakdown.spareParts ?? 0) + row.workingCapitalBreakdown.workInProgress
      + row.workingCapitalBreakdown.finishedGoods + row.workingCapitalBreakdown.receivables + row.workingCapitalBreakdown.minimumCash
    const tradePayables = row.workingCapitalBreakdown.payables
    const netFixedAssets = Math.max(0, cumulativeGrossFixedAssets - accumulatedDepreciation - cumulativeBookValueDisposed - row.salvageProceeds)
    const deferredPreOperatingAssets = cumulativePreOperatingAssets
    const totalAssets = row.cashBalance + currentAssets + netFixedAssets + deferredPreOperatingAssets
    const totalLiabilities = row.debtBalance + tradePayables
    const totalEquity = paidInCapital + retainedEarnings
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const balanceDifference = totalAssets - totalLiabilitiesAndEquity
    const operatingCashFlow = netIncome + row.depreciation - (row.assetSaleOtherIncomeLoss ?? 0) - row.changeInWorkingCapital
    const investingCashFlow = -row.fixedInvestment - row.preOperatingCost - row.maintenanceCapex + row.salvageProceeds + (row.assetSaleProceeds ?? 0)
    const financingCashFlow = row.debtDrawdown + row.equityContribution - row.principal
    const netChangeInCash = operatingCashFlow + investingCashFlow + financingCashFlow
    return {
      year: row.year,
      incomeStatement: { revenue: row.revenue, cashOperatingCosts, ebitda, depreciation: row.depreciation, otherIncomeLoss: row.assetSaleOtherIncomeLoss ?? 0, ebit, interest: row.interest, profitBeforeTax, tax: row.tax, taxLossCarryForward: row.taxLossCarryForward, netIncome },
      cashFlowStatement: { operatingCashFlow, investingCashFlow, financingCashFlow, netChangeInCash, closingCash: row.cashBalance },
      balanceSheet: {
        cash: row.cashBalance, workingCapitalAssets: currentAssets, netFixedAssets, deferredPreOperatingAssets,
        totalAssets, tradePayables, debt: row.debtBalance, totalLiabilities, paidInCapital, retainedEarnings,
        totalEquity, totalLiabilitiesAndEquity, balanceDifference, reconciled: Math.abs(balanceDifference) <= Math.max(0, tolerance),
      },
    }
  })
}

export type SensitivityCell = { priceChangePercent: number; volumeChangePercent: number; npv: number | null; irr: number | null }
export function calculateSensitivityMatrix(input: IntegratedFinanceInput, priceChanges = [-20, -10, 0, 10, 20], volumeChanges = [-20, -10, 0, 10, 20]): SensitivityCell[][] {
  return volumeChanges.map(volumeChangePercent => priceChanges.map(priceChangePercent => {
    const result = calculateIntegratedFinance({
      ...input,
      fullCapacityRevenue: input.fullCapacityRevenue * (1 + priceChangePercent / 100) * (1 + volumeChangePercent / 100),
      capacity: input.capacity * (1 + volumeChangePercent / 100),
      fullCapacityVariableCashCost: input.fullCapacityVariableCashCost * (1 + volumeChangePercent / 100),
      workingCapitalPolicy: input.workingCapitalPolicy ? {
        ...input.workingCapitalPolicy,
        annualRawMaterialCost: input.workingCapitalPolicy.annualRawMaterialCost * (1 + volumeChangePercent / 100),
        annualEnergyCost: (input.workingCapitalPolicy.annualEnergyCost ?? 0) * (1 + volumeChangePercent / 100),
        annualSparePartsCost: (input.workingCapitalPolicy.annualSparePartsCost ?? 0) * (1 + volumeChangePercent / 100),
        annualPayablesCost: (input.workingCapitalPolicy.annualPayablesCost ?? input.workingCapitalPolicy.annualRawMaterialCost) * (1 + volumeChangePercent / 100),
        annualConversionCost: input.workingCapitalPolicy.annualConversionCost * (1 + volumeChangePercent / 100),
        annualFinishedGoodsCost: input.workingCapitalPolicy.annualFinishedGoodsCost * (1 + volumeChangePercent / 100),
        annualCashOperatingCost: input.workingCapitalPolicy.annualCashOperatingCost * (1 + volumeChangePercent / 100),
        annualRevenue: input.workingCapitalPolicy.annualRevenue * (1 + priceChangePercent / 100) * (1 + volumeChangePercent / 100),
      } : undefined,
      fixedInvestment: input.fixedInvestment,
    })
    return { priceChangePercent, volumeChangePercent, npv: result.npvProject, irr: result.irrProject }
  }))
}

export function calculateFinancialScenarios(input: IntegratedFinanceInput) {
  const scenario = (price: number, volume: number, variableCost: number, fixedCost: number, capex: number) =>
    calculateIntegratedFinance({
      ...input,
      fullCapacityRevenue: input.fullCapacityRevenue * price * volume,
      capacity: input.capacity * volume,
      fullCapacityVariableCashCost: input.fullCapacityVariableCashCost * variableCost * volume,
      fullCapacityFixedCashCost: input.fullCapacityFixedCashCost * fixedCost,
      fixedInvestment: input.fixedInvestment * capex,
      fixedInvestmentSchedule: input.fixedInvestmentSchedule.map(value => value * capex),
      depreciationSchedule: input.depreciationSchedule?.map(value => value * capex),
      workingCapitalPolicy: input.workingCapitalPolicy ? {
        ...input.workingCapitalPolicy,
        annualRawMaterialCost: input.workingCapitalPolicy.annualRawMaterialCost * variableCost * volume,
        annualEnergyCost: (input.workingCapitalPolicy.annualEnergyCost ?? 0) * variableCost * volume,
        annualSparePartsCost: (input.workingCapitalPolicy.annualSparePartsCost ?? 0) * variableCost * volume,
        annualPayablesCost: (input.workingCapitalPolicy.annualPayablesCost ?? input.workingCapitalPolicy.annualRawMaterialCost) * variableCost * volume,
        annualConversionCost: input.workingCapitalPolicy.annualConversionCost * variableCost * volume,
        annualFinishedGoodsCost: input.workingCapitalPolicy.annualFinishedGoodsCost * variableCost * volume,
        annualCashOperatingCost: input.workingCapitalPolicy.annualCashOperatingCost * variableCost * volume,
        annualRevenue: input.workingCapitalPolicy.annualRevenue * price * volume,
      } : undefined,
    })
  return {
    pessimistic: scenario(0.9, 0.85, 1.15, 1.1, 1.1),
    base: scenario(1, 1, 1, 1, 1),
    optimistic: scenario(1.1, 1.1, 0.95, 0.98, 0.95),
  }
}


export type EnterpriseScenarioPeriodInput = {
  revenue: number
  cashOperatingCosts: number
  tax: number
  capex: number
  opportunityCost?: number
  changeInWorkingCapital: number
  assetSaleProceeds?: number
  terminalValue?: number
}

export type IncrementalAnalysisPeriod = {
  period: number
  withoutProjectCashFlow: number
  withProjectCashFlow: number
  incrementalCashFlow: number
}

export type IncrementalAnalysisResult = {
  periods: IncrementalAnalysisPeriod[]
  withoutProjectNpv: number
  withProjectNpv: number
  incrementalNpv: number
  incrementalIrr: number | null
  incrementalCashFlowTotal: number
}

/** Builds the COMFAR-style three-stage view: without project, with project, and the period-by-period incremental effect. */
export function calculateIncrementalEnterpriseAnalysis(
  withoutProject: EnterpriseScenarioPeriodInput[],
  withProject: EnterpriseScenarioPeriodInput[],
  discountRate: number,
): IncrementalAnalysisResult {
  const invalidResult: IncrementalAnalysisResult = {
    periods: [], withoutProjectNpv: Number.NaN, withProjectNpv: Number.NaN,
    incrementalNpv: Number.NaN, incrementalIrr: null, incrementalCashFlowTotal: Number.NaN,
  }
  if (!withoutProject.length || withoutProject.length !== withProject.length ||
      !Number.isFinite(discountRate) || discountRate <= -1) return invalidResult

  // The two enterprise cases must share the same period boundaries. Never
  // silently truncate, pad or coerce missing source values into a cash flow.
  const requiredValuesAreValid = (period: EnterpriseScenarioPeriodInput) =>
    [period.revenue, period.cashOperatingCosts, period.tax, period.capex,
      period.changeInWorkingCapital].every(Number.isFinite) &&
    [period.opportunityCost, period.assetSaleProceeds, period.terminalValue]
      .every(value => value === undefined || Number.isFinite(value))
  if (![...withoutProject, ...withProject].every(requiredValuesAreValid)) return invalidResult

  const cashFlow = (period: EnterpriseScenarioPeriodInput) =>
    period.revenue - period.cashOperatingCosts - period.tax - period.capex - (period.opportunityCost ?? 0) -
    period.changeInWorkingCapital + (period.assetSaleProceeds ?? 0) + (period.terminalValue ?? 0)
  const withoutFlows = withoutProject.map(cashFlow)
  const withFlows = withProject.map(cashFlow)
  const periods = withoutFlows.map((value, index) => ({
    period: index + 1,
    withoutProjectCashFlow: value,
    withProjectCashFlow: withFlows[index],
    incrementalCashFlow: withFlows[index] - value,
  }))
  const incrementalFlows = periods.map(row => row.incrementalCashFlow)
  return {
    periods,
    withoutProjectNpv: calculateNpv(withoutFlows, discountRate),
    withProjectNpv: calculateNpv(withFlows, discountRate),
    incrementalNpv: calculateNpv(incrementalFlows, discountRate),
    incrementalIrr: calculateIrr(incrementalFlows),
    incrementalCashFlowTotal: incrementalFlows.reduce((sum, value) => sum + value, 0),
  }
}

export type ExistingLoanRepaymentFrequency = 'annual'|'semiannual'|'quarterly'|'monthly'
export type ExistingLoanRepaymentType = 'annuity'|'constant-principal'|'profile'
export type ExistingLoanScheduleInput = {
  openingBalance: number
  openingAccruedInterest?: number
  annualInterestRatePercent: number
  startDate: string
  firstRepaymentDate: string
  repaymentFrequency: ExistingLoanRepaymentFrequency
  repaymentType: ExistingLoanRepaymentType
  numberOfRepayments: number
  interestPaymentMonth?: number
  capitalizeGraceInterest?: boolean
  profileRepayments?: { date: string; principal: number }[]
}
export type ExistingLoanScheduleRow = {
  date: string
  openingBalance: number
  capitalizedInterest: number
  interestPayable: number
  principalRepayment: number
  totalDebtService: number
  closingBalance: number
  accruedInterestBalance?: number
}
export type ExistingLoanScheduleResult = {
  valid: boolean
  error?: string
  periodicRate: number
  regularPayment: number
  totalInterest: number
  totalPrincipal: number
  closingBalance: number
  rows: ExistingLoanScheduleRow[]
}

const loanIntervalMonths: Record<ExistingLoanRepaymentFrequency, number> = {
  monthly: 1, quarterly: 3, semiannual: 6, annual: 12,
}
const parseIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
const isMonthEndDate = (date: Date) => date.getUTCDate() ===
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
const addMonthsAtMonthEnd = (date: Date, months: number) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 0))
  return target.toISOString().slice(0, 10)
}
const monthsBetween30Day = (from: Date, to: Date) => {
  const wholeMonths = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    to.getUTCMonth() - from.getUTCMonth()
  const isMonthEnd = (date: Date) => date.getUTCDate() ===
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  if (isMonthEnd(from) && isMonthEnd(to)) return wholeMonths
  return wholeMonths + (to.getUTCDate() - from.getUTCDate()) / 30
}

/**
 * Reconstructs the existing-loan repayment phase using COMFAR's annual-rate
 * convention: periodic rate = annual rate × repayment interval in months / 12.
 * Interest during the opening grace interval is either capitalized or payable.
 */
export function calculateExistingLoanSchedule(input: ExistingLoanScheduleInput): ExistingLoanScheduleResult {
  const invalid = (error: string): ExistingLoanScheduleResult => ({
    valid: false, error, periodicRate: Number.NaN, regularPayment: Number.NaN,
    totalInterest: Number.NaN, totalPrincipal: Number.NaN,
    closingBalance: Number.NaN, rows: [],
  })
  const start = parseIsoDate(input.startDate)
  if (!start) return invalid('A valid opening date is required.')
  const profile = input.repaymentType === 'profile'
  const first = profile ? null : parseIsoDate(input.firstRepaymentDate)
  if (!profile && !first) return invalid('A valid first repayment date is required.')
  if (first && first <= start) return invalid('The first repayment date must be after the opening date.')
  if (first && !isMonthEndDate(first)) return invalid('Annuity and constant-principal repayments must fall on the last day of a month.')
  if (!Number.isFinite(input.openingBalance) || input.openingBalance < 0 ||
      !Number.isFinite(input.openingAccruedInterest ?? 0) || (input.openingAccruedInterest ?? 0) < 0 ||
      !Number.isFinite(input.annualInterestRatePercent) || input.annualInterestRatePercent < 0)
    return invalid('Opening balance and annual interest rate must be non-negative finite values.')
  if (!profile && (!Number.isInteger(input.numberOfRepayments) || input.numberOfRepayments < 1 || input.numberOfRepayments > 1200))
    return invalid('Number of repayments must be an integer between 1 and 1200.')
  const annualRate = input.annualInterestRatePercent / 100
  const intervalMonths = loanIntervalMonths[input.repaymentFrequency]
  if (!profile && !intervalMonths) return invalid('Unsupported repayment frequency.')
  let balance = input.openingBalance
  const rows: ExistingLoanScheduleRow[] = []

  if (profile) {
    const repayments = input.profileRepayments
    if (!repayments?.length || repayments.some(item =>
      !parseIsoDate(item.date) || !Number.isFinite(item.principal) || item.principal < 0))
      return invalid('Profile loans require dated, non-negative principal repayments.')
    if (repayments.some((item, index) => index > 0 && item.date <= repayments[index - 1].date))
      return invalid('Profile repayment dates must be strictly increasing.')
    if (repayments.some(item => parseIsoDate(item.date)! <= start))
      return invalid('Profile repayment dates must be after the opening date.')
    const interestMonth = input.interestPaymentMonth
    if (!Number.isInteger(interestMonth) || (interestMonth as number) < 1 || (interestMonth as number) > 12)
      return invalid('Profile loans require a valid Month Interest Paid (1–12).')
    const lastRepaymentDate = repayments[repayments.length - 1].date
    const events = new Map<string, { principal: number; interestPayment: boolean }>()
    repayments.forEach(item => {
      const event = events.get(item.date) ?? { principal: 0, interestPayment: false }
      event.principal += item.principal
      events.set(item.date, event)
    })
    const lastDate = parseIsoDate(lastRepaymentDate)!
    for (let year = start.getUTCFullYear(); year <= lastDate.getUTCFullYear(); year += 1) {
      const date = new Date(Date.UTC(year, (interestMonth as number), 0))
      const dateString = date.toISOString().slice(0, 10)
      if (date > start && date <= lastDate) {
        const event = events.get(dateString) ?? { principal: 0, interestPayment: false }
        event.interestPayment = true
        events.set(dateString, event)
      }
    }
    const sortedEvents = [...events.entries()].sort(([a], [b]) => a.localeCompare(b))
    let previousDate = start
    let accruedInterest = input.openingAccruedInterest ?? 0
    let totalInterest = 0
    let totalPrincipal = 0
    for (const [dateString, event] of sortedEvents) {
      const date = parseIsoDate(dateString)!
      const openingBalance = balance
      const interval = monthsBetween30Day(previousDate, date)
      accruedInterest += balance * annualRate * interval / 12
      let interestPayable = 0
      if (event.interestPayment) {
        interestPayable = accruedInterest
        accruedInterest = 0
      }
      if (event.principal > balance + 1e-7)
        return invalid('Profile principal repayments exceed the outstanding loan balance.')
      const principal = Math.min(balance, event.principal)
      balance = Math.max(0, balance - principal)
      if (balance <= 1e-7 && accruedInterest > 0) {
        interestPayable += accruedInterest
        accruedInterest = 0
      }
      totalInterest += interestPayable
      totalPrincipal += principal
      rows.push({
        date: dateString, openingBalance, capitalizedInterest: 0,
        interestPayable, principalRepayment: principal,
        totalDebtService: principal + interestPayable, closingBalance: balance,
        accruedInterestBalance: accruedInterest,
      })
      previousDate = date
    }
    totalInterest += accruedInterest
    return {
      valid: true, periodicRate: Number.NaN, regularPayment: 0,
      totalInterest, totalPrincipal, closingBalance: balance, rows,
    }
  }

  const firstDate = first!
  const graceMonths = monthsBetween30Day(start, firstDate)
  if (!(graceMonths > 0)) return invalid('The opening grace interval must be positive.')
  const graceInterest = input.openingBalance * annualRate * graceMonths / 12
  let capitalizedGraceInterest = 0
  let firstGraceInterestPayable = graceInterest
  let firstInterestPayable = graceInterest + (input.openingAccruedInterest ?? 0)
  if (input.capitalizeGraceInterest) {
    capitalizedGraceInterest = graceInterest
    balance += graceInterest
    firstGraceInterestPayable = 0
    firstInterestPayable = input.openingAccruedInterest ?? 0
  }
  const periodicRate = annualRate * intervalMonths! / 12
  const regularPayment = periodicRate === 0
    ? balance / input.numberOfRepayments
    : balance * periodicRate / (1 - Math.pow(1 + periodicRate, -input.numberOfRepayments))
  let previousDate = start
  for (let index = 0; index < input.numberOfRepayments; index += 1) {
    const dateString = addMonthsAtMonthEnd(firstDate, index * intervalMonths!)
    const date = parseIsoDate(dateString)!
    if (date <= previousDate) return invalid('Repayment dates must be after the preceding date.')
    const interval = monthsBetween30Day(previousDate, date)
    const intervalInterest = index === 0 ? firstInterestPayable : balance * annualRate * interval / 12
    const openingBalance = balance
    let principal = input.repaymentType === 'constant-principal'
      ? balance / (input.numberOfRepayments - index)
      : regularPayment - (index === 0 ? firstGraceInterestPayable : intervalInterest)
    if (index === input.numberOfRepayments - 1) principal = balance
    if (!Number.isFinite(principal) || principal < -1e-7 || principal > balance + 1e-7)
      return invalid('The selected repayment terms do not amortize the opening balance.')
    principal = Math.min(balance, Math.max(0, principal))
    const capitalizedInterest = index === 0 ? capitalizedGraceInterest : 0
    balance = Math.max(0, balance - principal)
    rows.push({
      date: dateString, openingBalance, capitalizedInterest,
      interestPayable: intervalInterest, principalRepayment: principal,
      totalDebtService: principal + intervalInterest, closingBalance: balance,
      accruedInterestBalance: 0,
    })
    previousDate = date
  }
  const totalInterest = rows.reduce((sum, row) => sum + row.interestPayable + row.capitalizedInterest, 0)
  const totalPrincipal = rows.reduce((sum, row) => sum + row.principalRepayment, 0)
  return {
    valid: true, periodicRate, regularPayment, totalInterest, totalPrincipal,
    closingBalance: balance, rows,
  }
}
