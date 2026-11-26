export type ProjectPeriodFrequency = 'unspecified' | 'annual' | 'semiannual' | 'quarterly' | 'monthly'
export type ProjectDiscountConvention = 'actual-days' | 'period-count'
export type ProjectCurrency = { id: string; code: string; name: string; exchangeRates: { period: string; rateToLocal: number }[] }
export type ProjectCostCentre = { id: string; code: string; name: string; parentId?: string }
export type ProjectInflationIndex = { id: string; name: string; currencyCode: string; rates: { period: string; ratePercent: number }[] }
export type ProjectTaxRate = { id: string; period: string; ratePercent: number }

export type OpeningCurrentAccounts = {
  rawMaterials: number
  factorySupplies: number
  workInProgress: number
  finishedGoods: number
  receivables: number
  cash: number
  shortTermDeposits: number
  cashSurplus: number
  otherCurrentAssets: number
  tradePayables: number
  otherCurrentLiabilities: number
  accruedInterest: number
}
/** Detailed current-account balances are retained for opening reconciliation; the periodic balance sheet continues to post their net working-capital aggregate until each account has its own validated roll-forward. */
export type StartingFinancialBalanceSummary = {
  cash: number
  netWorkingCapital: number
  debt: number
  paidInCapital: number
  retainedEarnings: number
  grants: number
  currentAccounts?: OpeningCurrentAccounts
}
export type StartingFinancialBalanceInputs = {
  currentAssets: number
  cashLocal: number
  cashForeign: number
  shortTermDepositsLocal: number
  cashSurplusLocal: number
  cashSurplusForeign: number
  payablesLocal: number
  payablesForeign: number
  otherLiabilitiesLocal: number
  openingDebt: number
  accruedInterest: number
  paidInCapital: number
  retainedEarnings: number
  accumulatedLosses: number
  grants: number
  currentAccounts?: OpeningCurrentAccounts
}

/** Converts the detailed opening-balance register into the net balances used by the periodic statements. */
export function calculateStartingFinancialBalanceSummary(input: StartingFinancialBalanceInputs): StartingFinancialBalanceSummary {
  const cash = input.cashLocal + input.cashForeign + input.shortTermDepositsLocal +
    input.cashSurplusLocal + input.cashSurplusForeign
  const operatingPayables = input.payablesLocal + input.payablesForeign + input.otherLiabilitiesLocal
  return {
    cash,
    netWorkingCapital: input.currentAssets - cash - operatingPayables,
    debt: input.openingDebt + input.accruedInterest,
    paidInCapital: input.paidInCapital,
    retainedEarnings: input.retainedEarnings - input.accumulatedLosses,
    grants: input.grants,
    ...(input.currentAccounts ? { currentAccounts: { ...input.currentAccounts } } : {}),
  }
}

export type ProjectFoundation = {
  schemaVersion: 1
  planning: {
    periodFrequency: ProjectPeriodFrequency
    projectStartDate: string
    projectEndDate: string
    fiscalYearStartMonth: number | null
    balanceDateMonth: number | null
    balanceDateDay: number | null
    dayCountBasis: 360 | 365 | null
    valuationDate: string
    discountConvention: ProjectDiscountConvention
    cashFlowTiming: 'unspecified' | 'period-end' | 'mid-period'
  }
  currencies: {
    localCurrencyCode: string
    localCurrencyName: string
    foreignCurrencies: ProjectCurrency[]
  }
  costCentres: { active: boolean; items: ProjectCostCentre[] }
  inflation: { active: boolean; indices: ProjectInflationIndex[] }
  discounting: {
    method: 'unspecified' | 'manual' | 'wacc'
    financialRatePercent: number | null
    economicRatePercent: number | null
  }
  taxation: {
    system: 'unspecified' | 'corporate' | 'none' | 'custom'
    lossCarryForward: boolean | null
    lossCarryForwardYears: number | null
    rates: ProjectTaxRate[]
  }
}

export type ProjectFoundationIssue = {
  path: string
  severity: 'error' | 'warning'
  code: string
  message: string
}

export function createBlankProjectFoundation(): ProjectFoundation {
  return {
    schemaVersion: 1,
    planning: {
      periodFrequency: 'unspecified',
      projectStartDate: '',
      projectEndDate: '',
      fiscalYearStartMonth: null,
      balanceDateMonth: null,
      balanceDateDay: null,
      dayCountBasis: null,
      valuationDate: '',
      discountConvention: 'actual-days',
      cashFlowTiming: 'unspecified',
    },
    currencies: { localCurrencyCode: '', localCurrencyName: '', foreignCurrencies: [] },
    costCentres: { active: false, items: [] },
    inflation: { active: false, indices: [] },
    discounting: { method: 'unspecified', financialRatePercent: null, economicRatePercent: null },
    taxation: { system: 'unspecified', lossCarryForward: null, lossCarryForwardYears: null, rates: [] },
  }
}

export function mergeProjectFoundation(saved?: Partial<ProjectFoundation> | null): ProjectFoundation {
  const defaults = createBlankProjectFoundation()
  if (!saved) return defaults
  return {
    ...defaults,
    ...saved,
    planning: { ...defaults.planning, ...(saved.planning ?? {}) },
    currencies: { ...defaults.currencies, ...(saved.currencies ?? {}), foreignCurrencies: saved.currencies?.foreignCurrencies ?? [] },
    costCentres: { ...defaults.costCentres, ...(saved.costCentres ?? {}), items: saved.costCentres?.items ?? [] },
    inflation: { ...defaults.inflation, ...(saved.inflation ?? {}), indices: saved.inflation?.indices ?? [] },
    discounting: { ...defaults.discounting, ...(saved.discounting ?? {}) },
    taxation: { ...defaults.taxation, ...(saved.taxation ?? {}), rates: saved.taxation?.rates ?? [] },
  }
}

export function validateProjectFoundation(value: ProjectFoundation): ProjectFoundationIssue[] {
  const issues: ProjectFoundationIssue[] = []
  const issue = (path: string, severity: ProjectFoundationIssue['severity'], code: string, message: string) =>
    issues.push({ path, severity, code, message })
  const planning = value.planning
  const validIsoDate = (date: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!match) return false
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
    if (month < 1 || month > 12 || day < 1) return false
    return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
  }
  if (planning.projectStartDate && !validIsoDate(planning.projectStartDate))
    issue('planning.projectStartDate', 'error', 'invalid-project-start-date', 'Project start date must be a valid YYYY-MM-DD date.')
  if (planning.projectEndDate && !validIsoDate(planning.projectEndDate))
    issue('planning.projectEndDate', 'error', 'invalid-project-end-date', 'Project end date must be a valid YYYY-MM-DD date.')
  if (planning.projectStartDate && planning.projectEndDate && validIsoDate(planning.projectStartDate) && validIsoDate(planning.projectEndDate) && planning.projectEndDate < planning.projectStartDate)
    issue('planning.projectEndDate', 'error', 'project-end-before-start', 'Project end date cannot be earlier than project start date.')
  if (planning.fiscalYearStartMonth === null)
    issue('planning.fiscalYearStartMonth', 'warning', 'missing-fiscal-year-start-month', 'Fiscal year start month has not been defined.')
  else if (!Number.isInteger(planning.fiscalYearStartMonth) || planning.fiscalYearStartMonth < 1 || planning.fiscalYearStartMonth > 12)
    issue('planning.fiscalYearStartMonth', 'error', 'invalid-fiscal-year-start-month', 'Fiscal year start month must be an integer from 1 to 12.')
  if (planning.periodFrequency === 'unspecified')
    issue('planning.periodFrequency', 'warning', 'missing-period-frequency', 'Financial period frequency has not been defined.')
  if (planning.periodFrequency !== 'unspecified' && !planning.projectStartDate)
    issue('planning.projectStartDate', 'warning', 'missing-project-start-date', 'Project start date has not been defined for period generation.')
  if (planning.periodFrequency !== 'unspecified' && !planning.projectEndDate)
    issue('planning.projectEndDate', 'warning', 'missing-project-end-date', 'Project end date has not been defined for period generation.')
  if (planning.balanceDateMonth === null)
    issue('planning.balanceDateMonth', 'warning', 'missing-balance-month', 'Balance date month has not been defined.')
  else if (!Number.isInteger(planning.balanceDateMonth) || planning.balanceDateMonth < 1 || planning.balanceDateMonth > 12)
    issue('planning.balanceDateMonth', 'error', 'invalid-balance-month', 'Balance date month must be an integer from 1 to 12.')
  if (planning.balanceDateDay === null)
    issue('planning.balanceDateDay', 'warning', 'missing-balance-day', 'Balance date day has not been defined.')
  else if (!Number.isInteger(planning.balanceDateDay) || planning.balanceDateDay < 1 || planning.balanceDateDay > 31)
    issue('planning.balanceDateDay', 'error', 'invalid-balance-day', 'Balance date day must be an integer from 1 to 31.')
  if (planning.dayCountBasis === null)
    issue('planning.dayCountBasis', 'warning', 'missing-day-count-basis', 'Day-count basis has not been defined.')
  if (planning.cashFlowTiming === 'unspecified')
    issue('planning.cashFlowTiming', 'warning', 'missing-cash-flow-timing', 'Cash-flow timing for discounting has not been defined.')
  if (!planning.valuationDate) issue('planning.valuationDate', 'warning', 'missing-valuation-date', 'Valuation date has not been defined.')
  if (!value.currencies.localCurrencyCode.trim()) issue('currencies.localCurrencyCode', 'error', 'missing-local-currency', 'Define the local currency code before calculating the project.')
  const currencyCodes = [value.currencies.localCurrencyCode, ...value.currencies.foreignCurrencies.map(c => c.code)]
  const normalizedCodes = currencyCodes.map(code => code.trim().toUpperCase()).filter(Boolean)
  if (new Set(normalizedCodes).size !== normalizedCodes.length)
    issue('currencies', 'error', 'duplicate-currency-code', 'Currency codes must be unique.')
  value.currencies.foreignCurrencies.forEach((currency, index) => {
    if (!currency.code.trim() || !currency.name.trim())
      issue(`currencies.foreignCurrencies[${index}]`, 'error', 'incomplete-currency', 'Each foreign currency requires a code and name.')
    currency.exchangeRates.forEach((rate, rateIndex) => {
      if (!rate.period.trim() || !Number.isFinite(rate.rateToLocal) || rate.rateToLocal <= 0)
        issue(`currencies.foreignCurrencies[${index}].exchangeRates[${rateIndex}]`, 'error', 'invalid-exchange-rate', 'Each exchange rate requires a period and a positive rate to local currency.')
    })
  })
  if (value.costCentres.active && value.costCentres.items.length === 0)
    issue('costCentres.items', 'warning', 'empty-cost-centres', 'Cost Centre Analysis is active but no cost centres have been defined.')
  const costCentreCodes = value.costCentres.items.map(item => item.code.trim().toUpperCase()).filter(Boolean)
  if (new Set(costCentreCodes).size !== costCentreCodes.length)
    issue('costCentres.items', 'error', 'duplicate-cost-centre-code', 'Cost centre codes must be unique.')
  value.costCentres.items.forEach((item, index) => {
    if (!item.code.trim() || !item.name.trim())
      issue(`costCentres.items[${index}]`, 'error', 'incomplete-cost-centre', 'Each cost centre requires a code and name.')
    if (item.parentId && !value.costCentres.items.some(parent => parent.id === item.parentId))
      issue(`costCentres.items[${index}].parentId`, 'error', 'unknown-parent-cost-centre', 'The parent cost centre does not exist.')
  })
  if (value.inflation.active && value.inflation.indices.length === 0)
    issue('inflation.indices', 'warning', 'empty-inflation-indices', 'Inflation is active but no price index has been defined.')
  value.inflation.indices.forEach((index, i) => {
    if (!index.name.trim() || !index.currencyCode.trim())
      issue(`inflation.indices[${i}]`, 'error', 'incomplete-inflation-index', 'Each inflation index requires a name and currency.')
    index.rates.forEach((rate, j) => {
      if (!rate.period.trim() || !Number.isFinite(rate.ratePercent) || rate.ratePercent <= -100)
        issue(`inflation.indices[${i}].rates[${j}]`, 'error', 'invalid-inflation-rate', 'Inflation rates require a period and a rate greater than -100%.')
    })
  })
  for (const [key, rate] of [['financialRatePercent', value.discounting.financialRatePercent], ['economicRatePercent', value.discounting.economicRatePercent]] as const) {
    if (rate !== null && (!Number.isFinite(rate) || rate <= -100))
      issue(`discounting.${key}`, 'error', 'invalid-discount-rate', 'Discount rates must be greater than -100%.')
  }
  if (value.discounting.method === 'unspecified')
    issue('discounting.method', 'warning', 'missing-discounting-method', 'Discounting method has not been selected.')
  if (value.discounting.method === 'manual' && value.discounting.financialRatePercent === null)
    issue('discounting.financialRatePercent', 'warning', 'missing-financial-discount-rate', 'A manual financial discount rate has not been defined.')
  if (value.taxation.system === 'unspecified')
    issue('taxation.system', 'warning', 'missing-tax-system', 'Tax system has not been selected.')
  if (value.taxation.system !== 'none' && value.taxation.system !== 'unspecified' && value.taxation.lossCarryForward === null)
    issue('taxation.lossCarryForward', 'warning', 'missing-loss-carryforward-setting', 'Loss carry-forward treatment has not been specified.')
  if (value.taxation.lossCarryForwardYears !== null && (!Number.isInteger(value.taxation.lossCarryForwardYears) || value.taxation.lossCarryForwardYears < 0))
    issue('taxation.lossCarryForwardYears', 'error', 'invalid-loss-carryforward-period', 'Loss carry-forward years must be a non-negative integer.')
  value.taxation.rates.forEach((rate, index) => {
    if (!rate.period.trim() || !Number.isFinite(rate.ratePercent) || rate.ratePercent < 0 || rate.ratePercent > 100)
      issue(`taxation.rates[${index}]`, 'error', 'invalid-tax-rate', 'Each tax rate requires a period and a percentage from 0 to 100.')
  })
  if (value.taxation.system !== 'none' && value.taxation.system !== 'unspecified' && value.taxation.rates.length === 0)
    issue('taxation.rates', 'warning', 'missing-tax-rates', 'The tax system is selected but no period-specific tax rates have been entered.')
  return issues
}



export type ProjectCalendarPeriod = {
  index: number
  startDate: string
  endDate: string
  days: number
  partial: boolean
}

function utcDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
}

/**
 * Builds contiguous financial periods from an inclusive project start/end date.
 * Annual, semiannual and quarterly periods align to the selected fiscal-year start;
 * monthly periods align to calendar months. The first and last periods may be partial.
 */
export function buildProjectCalendarPeriods(
  projectStartDate: string,
  projectEndDate: string,
  frequency: Exclude<ProjectPeriodFrequency, 'unspecified'>,
  fiscalYearStartMonth = 1,
): ProjectCalendarPeriod[] {
  const start = utcDateOnly(projectStartDate)
  const end = utcDateOnly(projectEndDate)
  if (!start || !end || end < start || !Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) return []
  const monthsPerPeriod = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : frequency === 'semiannual' ? 6 : 12
  const anchorMonth = frequency === 'monthly' ? 1 : fiscalYearStartMonth
  const startMonthIndex = start.getUTCFullYear() * 12 + start.getUTCMonth()
  const anchorIndex = start.getUTCFullYear() * 12 + (anchorMonth - 1)
  const elapsed = startMonthIndex - anchorIndex
  const periodOffset = Math.floor(elapsed / monthsPerPeriod) * monthsPerPeriod
  let boundary = addUtcMonths(new Date(Date.UTC(start.getUTCFullYear(), anchorMonth - 1, 1)), periodOffset)
  while (addUtcMonths(boundary, monthsPerPeriod) <= start) boundary = addUtcMonths(boundary, monthsPerPeriod)
  const endExclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1))
  const periods: ProjectCalendarPeriod[] = []
  let cursor = start
  while (cursor < endExclusive && periods.length < 1200) {
    const nextBoundary = addUtcMonths(boundary, monthsPerPeriod)
    const periodEndExclusive = nextBoundary < endExclusive ? nextBoundary : endExclusive
    const days = Math.round((periodEndExclusive.getTime() - cursor.getTime()) / 86400000)
    if (days <= 0) return []
    periods.push({
      index: periods.length + 1,
      startDate: isoDateOnly(cursor),
      endDate: isoDateOnly(new Date(periodEndExclusive.getTime() - 86400000)),
      days,
      partial: cursor.getTime() !== boundary.getTime() || periodEndExclusive.getTime() !== nextBoundary.getTime(),
    })
    cursor = periodEndExclusive
    boundary = nextBoundary
  }
  return cursor.getTime() === endExclusive.getTime() ? periods : []
}

export type StartingFixedAssetBalance = {
  id: string
  name: string
  grossCost: number
  accumulatedDepreciation: number
  remainingLife: number
  opportunityValue: number
  residualValue?: number
  commissioningDate?: string
  depreciationMethod?: FixedInvestmentDepreciationMethod
  depreciationRatePercent?: number
  depreciationLengthYears?: number
  depreciationLengthMonths?: number
  firstDepreciationMonths?: number
  salvagePercent?: number
  depreciationStartDate?: string
  disposalDate?: string
  disposalPriceMode?: 'book-value' | 'self-defined'
  disposalProceeds?: number
  disposalExchangeRateToLocal?: number
  costCentre?: string
  foreignSharePercent?: number
  status: 'active' | 'replace' | 'idle' | 'sell'
}

export function validateStartingFixedAssetBalances(
  assets: StartingFixedAssetBalance[],
  foundation: ProjectFoundation,
): ProjectFoundationIssue[] {
  const issues: ProjectFoundationIssue[] = []
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path, severity: 'error', code, message })
  const ids = assets.map(asset => asset.id)
  if (new Set(ids).size !== ids.length) issue('startingAssets', 'duplicate-starting-asset-id', 'Starting fixed asset identifiers must be unique.')
  assets.forEach((asset, index) => {
    const path = `startingAssets[${index}]`
    if (!asset.name.trim()) issue(path + '.name', 'missing-starting-asset-name', 'Enter a description for each existing fixed asset.')
    if (!Number.isFinite(asset.grossCost) || asset.grossCost < 0)
      issue(path + '.grossCost', 'invalid-starting-asset-gross-cost', 'Gross cost must be a finite non-negative amount.')
    if (!Number.isFinite(asset.accumulatedDepreciation) || asset.accumulatedDepreciation < 0 || asset.accumulatedDepreciation > asset.grossCost)
      issue(path + '.accumulatedDepreciation', 'invalid-starting-asset-accumulated-depreciation', 'Accumulated depreciation must be between zero and gross cost.')
    if (!Number.isFinite(asset.remainingLife) || asset.remainingLife < 0)
      issue(path + '.remainingLife', 'invalid-starting-asset-remaining-life', 'Remaining useful life must be a finite non-negative number.')
    if (!Number.isFinite(asset.opportunityValue) || asset.opportunityValue < 0)
      issue(path + '.opportunityValue', 'invalid-starting-asset-opportunity-value', 'Opportunity value must be a finite non-negative amount.')
    if (asset.residualValue !== undefined && (!Number.isFinite(asset.residualValue) || asset.residualValue < 0 || asset.residualValue > asset.grossCost))
      issue(path + '.residualValue', 'invalid-starting-asset-residual-value', 'Residual value must be between zero and gross cost.')
    if (asset.foreignSharePercent !== undefined && (!Number.isFinite(asset.foreignSharePercent) || asset.foreignSharePercent < 0 || asset.foreignSharePercent > 100))
      issue(path + '.foreignSharePercent', 'invalid-starting-asset-foreign-share', 'Foreign currency component must be between zero and 100 percent.')
    if (foundation.costCentres.active && asset.costCentre && !foundation.costCentres.items.some(item => item.id === asset.costCentre || item.code === asset.costCentre))
      issue(path + '.costCentre', 'unknown-starting-asset-cost-centre', 'Select a defined Cost Centre for this existing fixed asset.')
    const validDate = (value?: string) => {
      if (!value) return true
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
      if (!match) return false
      const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
      if (month < 1 || month > 12 || day < 1) return false
      return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
    }
    if (!validDate(asset.commissioningDate) || !validDate(asset.depreciationStartDate))
      issue(path + '.dates', 'invalid-starting-asset-date', 'Commissioning date and depreciation start date must use YYYY-MM-DD.')
    if (asset.commissioningDate && asset.depreciationStartDate && asset.depreciationStartDate < asset.commissioningDate)
      issue(path + '.depreciationStartDate', 'depreciation-before-commissioning', 'Depreciation cannot start before the commissioning date.')
    if (asset.disposalDate !== undefined && !validDate(asset.disposalDate))
      issue(path + '.disposalDate', 'invalid-starting-asset-disposal-date', 'Disposal date must use YYYY-MM-DD.')
    if ((asset.status === 'replace' || asset.status === 'sell') && !asset.disposalDate)
      issue(path + '.disposalDate', 'missing-starting-asset-disposal-date', 'A planned replacement or sale requires an explicit disposal date.')
    if (asset.disposalDate && foundation.planning.projectStartDate && asset.disposalDate < foundation.planning.projectStartDate)
      issue(path + '.disposalDate', 'starting-asset-disposal-before-project', 'Opening asset disposal cannot precede the project start date.')
    if (asset.disposalDate && foundation.planning.projectEndDate && asset.disposalDate > foundation.planning.projectEndDate)
      issue(path + '.disposalDate', 'starting-asset-disposal-after-project', 'Opening asset disposal must fall within the project calendar.')
    if (asset.disposalPriceMode === 'self-defined') {
      if (!Number.isFinite(asset.disposalProceeds) || (asset.disposalProceeds ?? -1) < 0)
        issue(path + '.disposalProceeds', 'invalid-starting-asset-disposal-proceeds', 'Self-defined disposal proceeds must be a finite non-negative amount.')
      if (!Number.isFinite(asset.disposalExchangeRateToLocal) || (asset.disposalExchangeRateToLocal ?? 0) <= 0)
        issue(path + '.disposalExchangeRateToLocal', 'invalid-starting-asset-disposal-exchange-rate', 'A positive exchange rate to local currency is required for self-defined proceeds.')
    }
    const method = asset.depreciationMethod ?? 'linear-scrap'
    if (asset.salvagePercent !== undefined &&
        (!Number.isFinite(asset.salvagePercent) || asset.salvagePercent < 0 || asset.salvagePercent > 100))
      issue(path + '.salvagePercent', 'invalid-starting-asset-salvage-percent', 'Scrap percentage must be between zero and 100 percent.')
    const effectiveScrapPercent = asset.salvagePercent ??
      (asset.grossCost > 0 ? (asset.residualValue ?? 0) / asset.grossCost * 100 : 0)
    const netBookValue = Math.max(0, asset.grossCost - asset.accumulatedDepreciation)
    if (method !== 'none' && method !== 'linear-zero' &&
        Number.isFinite(effectiveScrapPercent) && effectiveScrapPercent >= 0 && effectiveScrapPercent <= 100 &&
        asset.grossCost * effectiveScrapPercent / 100 > netBookValue + 0.01)
      issue(path + '.salvagePercent', 'starting-asset-salvage-exceeds-net-book-value', 'Scrap value cannot exceed the opening net book value.')
    if (method === 'accelerated' &&
        (asset.depreciationRatePercent === undefined || asset.depreciationRatePercent === 100))
      issue(path + '.depreciationRatePercent', 'invalid-starting-asset-depreciation-rate', 'Accelerated depreciation requires a rate greater than zero and below 100 percent.')
    if (method !== 'none') {
      if (asset.status === 'active' && asset.remainingLife <= 0)
        issue(path + '.remainingLife', 'missing-starting-asset-remaining-life', 'An active depreciable asset requires positive remaining useful life.')
      if (asset.depreciationLengthYears !== undefined && (!Number.isInteger(asset.depreciationLengthYears) || asset.depreciationLengthYears < 0))
        issue(path + '.depreciationLengthYears', 'invalid-starting-asset-depreciation-length', 'Depreciation length in years must be a non-negative integer.')
      if (asset.depreciationLengthMonths !== undefined && (!Number.isInteger(asset.depreciationLengthMonths) || asset.depreciationLengthMonths < 0 || asset.depreciationLengthMonths > 11))
        issue(path + '.depreciationLengthMonths', 'invalid-starting-asset-depreciation-months', 'Additional depreciation life months must be from zero to 11.')
      if (asset.firstDepreciationMonths !== undefined && (!Number.isInteger(asset.firstDepreciationMonths) || asset.firstDepreciationMonths < 1 || asset.firstDepreciationMonths > 12))
        issue(path + '.firstDepreciationMonths', 'invalid-starting-asset-first-months', 'Months in first depreciation year must be from 1 to 12.')
      if (method !== 'sum-of-digits' && asset.depreciationRatePercent !== undefined && (!Number.isFinite(asset.depreciationRatePercent) || asset.depreciationRatePercent <= 0 || asset.depreciationRatePercent > 100))
        issue(path + '.depreciationRatePercent', 'invalid-starting-asset-depreciation-rate', 'Depreciation rate must be greater than zero and no more than 100 percent.')
      if (method === 'sum-of-digits' && ((asset.depreciationLengthMonths ?? 0) !== 0 || (asset.firstDepreciationMonths ?? 12) !== 12))
        issue(path + '.depreciation', 'starting-asset-sum-of-years-partial-not-benchmarked', 'Sum of years digits with partial periods is held until independently benchmarked.')
    }
  })
  return issues
}

export type FixedInvestmentAssetClass = 'land' | 'site' | 'buildings' | 'machinery' | 'infrastructure' | 'vehicles' | 'office' | 'intangible' | 'preproduction' | 'other'
export type FixedInvestmentDepreciationMethod = 'none' | 'linear-zero' | 'linear-scrap' | 'accelerated' | 'sum-of-digits'
export type FixedInvestmentAcquisition = {
  id: string
  period: string
  quantity: number
  unitPrice: number
  currencyCode: string
  exchangeRateToLocal: number | null
  allocationBasis?: 'source-period' | 'user-confirmed' | 'proportional-estimate' | 'unallocated'
}
export type FixedInvestmentSale = {
  id: string
  acquisitionId: string
  period: string
  market: 'local' | 'foreign'
  priceMode: 'book-value' | 'self-defined'
  currencyCode: string
  selfDefinedPrice: number | null
}
export type FixedInvestmentItem = {
  id: string
  description: string
  assetClass: FixedInvestmentAssetClass
  origin: 'local' | 'foreign'
  currencyCode: string
  costCentreId: string
  depreciation: {
    method: FixedInvestmentDepreciationMethod
    startingAt: string
    ratePercent: number | null
    lengthYears: number | null
    lengthMonths: number
    firstDepreciationMonths: number
    scrapPercent: number
  }
  depreciationBasis?: 'source-table' | 'user-confirmed' | 'source-conflict' | 'unresolved'
  /** Asset-by-asset document identifier, filename/page, or exact source reference. */
  depreciationEvidenceReference?: string
  /** Explicit confirmation that the referenced asset-level document was reviewed. */
  depreciationEvidenceVerified?: boolean
  acquisitions: FixedInvestmentAcquisition[]
  sales: FixedInvestmentSale[]
}

export function createBlankFixedInvestmentItem(): FixedInvestmentItem {
  return {
    id: 'fixed-asset-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    description: '',
    assetClass: 'other',
    origin: 'local',
    currencyCode: '',
    costCentreId: '',
    depreciation: { method: 'none', startingAt: '', ratePercent: null, lengthYears: null, lengthMonths: 0, firstDepreciationMonths: 12, scrapPercent: 0 },
    depreciationBasis: 'unresolved',
    depreciationEvidenceReference: '',
    depreciationEvidenceVerified: false,
    acquisitions: [],
    sales: [],
  }
}

function fixedInvestmentPeriodOrdinal(value: string): number | null {
  const match = /^(\d{3,4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?$/.exec(value.trim())
  if (!match) return null
  return Number(match[1]) * 10000 + Number(match[2] ?? 0) * 100 + Number(match[3] ?? 0)
}

export function validateFixedInvestmentItems(items: FixedInvestmentItem[], foundation: ProjectFoundation): ProjectFoundationIssue[] {
  const issues: ProjectFoundationIssue[] = []
  const issue = (path: string, code: string, message: string) => issues.push({ path, severity: 'error', code, message })
  const warn = (path: string, code: string, message: string) => issues.push({ path, severity: 'warning', code, message })
  const itemIds = items.map(item => item.id)
  if (new Set(itemIds).size !== itemIds.length) issue('fixedInvestmentItems', 'duplicate-fixed-asset-id', 'Fixed investment item identifiers must be unique.')
  const validCurrencyCodes = new Set([foundation.currencies.localCurrencyCode, ...foundation.currencies.foreignCurrencies.map(currency => currency.code)].map(code => code.trim().toUpperCase()).filter(Boolean))
  items.forEach((item, index) => {
    const path = `fixedInvestmentItems[${index}]`
    if (!item.description.trim()) issue(path + '.description', 'missing-fixed-asset-description', 'Enter a description for each fixed investment item.')
    const hasAssetLevelDepreciationEvidence=item.depreciationBasis==='source-table'&&!!item.depreciationEvidenceReference?.trim()&&item.depreciationEvidenceVerified===true
    if(item.depreciation.method!=='none'&&!hasAssetLevelDepreciationEvidence)
      warn(path+'.depreciationBasis','depreciation-evidence-required','Depreciation is excluded until an asset-by-asset source document is referenced and verified; user confirmation or aggregate schedules are not sufficient.')
    if (!item.currencyCode.trim() || !validCurrencyCodes.has(item.currencyCode.trim().toUpperCase()))
      issue(path + '.currencyCode', 'unknown-fixed-asset-currency', 'The asset currency must be defined in the project currency structure.')
    if (item.origin === 'local' && item.currencyCode.trim().toUpperCase() !== foundation.currencies.localCurrencyCode.trim().toUpperCase())
      issue(path + '.currencyCode', 'local-asset-currency-mismatch', 'A local-origin asset must be denominated in the local currency.')
    if (item.origin === 'foreign' && !foundation.currencies.foreignCurrencies.some(currency => currency.code.trim().toUpperCase() === item.currencyCode.trim().toUpperCase()))
      issue(path + '.currencyCode', 'foreign-asset-currency-mismatch', 'A foreign-origin asset must use a currency defined as foreign in the project currency structure.')
    if (foundation.costCentres.active && (!item.costCentreId || !foundation.costCentres.items.some(centre => centre.id === item.costCentreId)))
      issue(path + '.costCentreId', 'missing-fixed-asset-cost-centre', 'Select a valid Cost Centre for this fixed investment item.')
    if (item.assetClass === 'land' && item.depreciation.method !== 'none') issue(path + '.depreciation.method', 'land-not-depreciable', 'Land must not be assigned a depreciation method.')
    if (item.acquisitions.length === 0) issue(path + '.acquisitions', 'missing-asset-acquisition', 'At least one acquisition period is required for a fixed investment item.')
    const acquisitionIds = item.acquisitions.map(acquisition => acquisition.id)
    if (new Set(acquisitionIds).size !== acquisitionIds.length) issue(path + '.acquisitions', 'duplicate-asset-acquisition-id', 'Acquisition identifiers must be unique within an asset item.')
    item.acquisitions.forEach((acquisition, acquisitionIndex) => {
      const acquisitionPath = path + `.acquisitions[${acquisitionIndex}]`
      if (!acquisition.period.trim() || !Number.isFinite(acquisition.quantity) || acquisition.quantity <= 0 || !Number.isFinite(acquisition.unitPrice) || acquisition.unitPrice < 0)
        issue(acquisitionPath, 'invalid-asset-acquisition', 'Acquisition period, quantity and unit price must be valid and non-negative.')
      if (!acquisition.allocationBasis || acquisition.allocationBasis === 'unallocated') warn(acquisitionPath + '.allocationBasis', 'asset-acquisition-period-unallocated', 'Acquisition period has not been supported by a source or confirmed by the user.')
      else if (acquisition.allocationBasis === 'proportional-estimate') warn(acquisitionPath + '.allocationBasis', 'asset-acquisition-period-estimated', 'Acquisition period is a proportional estimate and must not be used as a verified investment cash-flow schedule.')
      if (acquisition.currencyCode.trim().toUpperCase() !== item.currencyCode.trim().toUpperCase())
        issue(acquisitionPath + '.currencyCode', 'asset-acquisition-currency-mismatch', 'Acquisition currency must match the fixed investment item currency.')
      if (item.origin === 'foreign' && (!Number.isFinite(acquisition.exchangeRateToLocal) || (acquisition.exchangeRateToLocal ?? 0) <= 0))
        issue(acquisitionPath + '.exchangeRateToLocal', 'missing-asset-exchange-rate', 'Foreign-origin asset acquisitions require a positive exchange rate to local currency.')
    })
    if (item.depreciation.method !== 'none') {
      if (!item.depreciation.startingAt.trim()) issue(path + '.depreciation.startingAt', 'missing-depreciation-start', 'Define Starting at for depreciable assets.')
      if (!Number.isFinite(item.depreciation.lengthYears) || (item.depreciation.lengthYears ?? 0) < 0 || !Number.isInteger(item.depreciation.lengthMonths) || item.depreciation.lengthMonths < 0 || item.depreciation.lengthMonths > 11 || ((item.depreciation.lengthYears ?? 0) + item.depreciation.lengthMonths / 12) <= 0)
        issue(path + '.depreciation.length', 'invalid-depreciation-length', 'Depreciation Length must be greater than zero and months must be from 0 to 11.')
      if (!Number.isFinite(item.depreciation.scrapPercent) || item.depreciation.scrapPercent < 0 || item.depreciation.scrapPercent > 100)
        issue(path + '.depreciation.scrapPercent', 'invalid-scrap-percent', 'Scrap must be between 0 and 100 percent of original value.')
      if (!Number.isInteger(item.depreciation.firstDepreciationMonths) || item.depreciation.firstDepreciationMonths < 1 || item.depreciation.firstDepreciationMonths > 12)
        issue(path + '.depreciation.firstDepreciationMonths', 'invalid-first-depreciation-months', 'Months in first depreciation year must be an integer from 1 to 12.')
      if (item.depreciation.method === 'sum-of-digits' && (item.depreciation.lengthMonths !== 0 || item.depreciation.firstDepreciationMonths !== 12))
        issue(path + '.depreciation', 'sum-of-years-partial-period-not-benchmarked', 'Sum of years digits with partial first year or additional life months is not enabled until independently benchmarked against reference output.')
      if (item.depreciation.method !== 'sum-of-digits' && (!Number.isFinite(item.depreciation.ratePercent) || (item.depreciation.ratePercent ?? 0) <= 0 || (item.depreciation.ratePercent ?? 0) > 100))
        issue(path + '.depreciation.ratePercent', 'invalid-depreciation-rate', 'Rate must be greater than 0 and no more than 100 percent per annum.')
      if ((item.depreciation.method === 'linear-zero' || item.depreciation.method === 'linear-scrap') && Number.isFinite(item.depreciation.ratePercent) && (item.depreciation.ratePercent ?? 0) > 0 && (item.depreciation.lengthYears ?? 0) + item.depreciation.lengthMonths / 12 > 0) {
        const expectedRate = 100 / ((item.depreciation.lengthYears ?? 0) + item.depreciation.lengthMonths / 12)
        if (Math.abs((item.depreciation.ratePercent ?? 0) - expectedRate) > 0.02)
          issue(path + '.depreciation.ratePercent', 'depreciation-rate-length-mismatch', 'For linear depreciation, Rate and Length must be mathematically consistent.')
      }
    }
    const saleIds = item.sales.map(sale => sale.id)
    if (new Set(saleIds).size !== saleIds.length)
      issue(path + '.sales', 'duplicate-asset-sale-id', 'Asset sale identifiers must be unique within a fixed investment item.')
    const soldAcquisitionIds = item.sales.map(sale => sale.acquisitionId).filter(Boolean)
    if (new Set(soldAcquisitionIds).size !== soldAcquisitionIds.length)
      issue(path + '.sales', 'duplicate-acquisition-disposal', 'Each acquisition vintage can be disposed only once.')
    item.sales.forEach((sale, saleIndex) => {
      const salePath = path + `.sales[${saleIndex}]`
      if (!sale.acquisitionId || !item.acquisitions.some(acquisition => acquisition.id === sale.acquisitionId))
        issue(salePath + '.acquisitionId', 'unknown-asset-sale-acquisition', 'An asset sale must refer to an existing acquisition.')
      if (!sale.period.trim() || !sale.currencyCode.trim() || !validCurrencyCodes.has(sale.currencyCode.trim().toUpperCase()))
        issue(salePath, 'invalid-asset-sale-period-currency', 'Asset sale requires a period and a defined currency.')
      if (sale.market === 'local' && sale.currencyCode.trim().toUpperCase() !== foundation.currencies.localCurrencyCode.trim().toUpperCase())
        issue(salePath + '.currencyCode', 'local-sale-currency-mismatch', 'A local-market asset sale must be denominated in the local currency.')
      if (sale.market === 'foreign' && !foundation.currencies.foreignCurrencies.some(currency => currency.code.trim().toUpperCase() === sale.currencyCode.trim().toUpperCase()))
        issue(salePath + '.currencyCode', 'foreign-sale-currency-mismatch', 'A foreign-market asset sale must use a defined foreign currency.')
      const acquisition = item.acquisitions.find(row => row.id === sale.acquisitionId)
      const acquisitionOrdinal = acquisition ? fixedInvestmentPeriodOrdinal(acquisition.period) : null
      const saleOrdinal = fixedInvestmentPeriodOrdinal(sale.period)
      if (acquisitionOrdinal !== null && saleOrdinal !== null && saleOrdinal < acquisitionOrdinal)
        issue(salePath + '.period', 'asset-sale-before-acquisition', 'An asset cannot be sold before its acquisition period.')
      const saleMatch = /^(\d{3,4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?$/.exec(sale.period.trim())
      if (!saleMatch) issue(salePath + '.period', 'invalid-asset-sale-period-format', 'Sale period must be a project year or a full date.')
      else if (saleMatch[2] && saleMatch[3]) {
        if (foundation.planning.balanceDateMonth === null || foundation.planning.balanceDateDay === null)
          issue(salePath + '.period', 'missing-sale-balance-date', 'Define the project balance date before entering a full asset sale date.')
        else if (Number(saleMatch[2]) !== foundation.planning.balanceDateMonth || Number(saleMatch[3]) !== foundation.planning.balanceDateDay)
          issue(salePath + '.period', 'asset-sale-not-at-balance-date', 'COMFAR asset sales must be defined at a project balance date.')
      }
      if (sale.priceMode === 'self-defined' && (!Number.isFinite(sale.selfDefinedPrice) || (sale.selfDefinedPrice ?? 0) < 0))
        issue(salePath + '.selfDefinedPrice', 'invalid-asset-sale-price', 'A self-defined sale price must be a non-negative number.')
      if (sale.priceMode === 'self-defined' && sale.currencyCode.trim().toUpperCase() !== foundation.currencies.localCurrencyCode.trim().toUpperCase()) {
        const currency = foundation.currencies.foreignCurrencies.find(row => row.code.trim().toUpperCase() === sale.currencyCode.trim().toUpperCase())
        const year = saleMatch ? saleMatch[1] : ''
        const hasRate = currency?.exchangeRates.some(rate => rate.period === sale.period || rate.period === year)
        if (!hasRate) issue(salePath + '.currencyCode', 'missing-asset-sale-exchange-rate', 'A period exchange rate is required for a foreign-currency asset sale.')
      }
    })
  })
  return issues
}
