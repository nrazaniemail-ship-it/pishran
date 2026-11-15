export type ProjectPeriodFrequency = 'annual' | 'semiannual' | 'quarterly' | 'monthly'
export type ProjectCurrency = { id: string; code: string; name: string; exchangeRates: { period: string; rateToLocal: number }[] }
export type ProjectCostCentre = { id: string; code: string; name: string; parentId?: string }
export type ProjectInflationIndex = { id: string; name: string; currencyCode: string; rates: { period: string; ratePercent: number }[] }
export type ProjectTaxRate = { id: string; period: string; ratePercent: number }

export type ProjectFoundation = {
  schemaVersion: 1
  planning: {
    periodFrequency: ProjectPeriodFrequency
    balanceDateMonth: number
    balanceDateDay: number
    dayCountBasis: 360 | 365
    valuationDate: string
    cashFlowTiming: 'period-end' | 'mid-period'
  }
  currencies: {
    localCurrencyCode: string
    localCurrencyName: string
    foreignCurrencies: ProjectCurrency[]
  }
  costCentres: { active: boolean; items: ProjectCostCentre[] }
  inflation: { active: boolean; indices: ProjectInflationIndex[] }
  discounting: {
    method: 'manual' | 'wacc'
    financialRatePercent: number | null
    economicRatePercent: number | null
  }
  taxation: {
    system: 'corporate' | 'none' | 'custom'
    lossCarryForward: boolean
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
      periodFrequency: 'annual',
      balanceDateMonth: 12,
      balanceDateDay: 31,
      dayCountBasis: 360,
      valuationDate: '',
      cashFlowTiming: 'period-end',
    },
    currencies: { localCurrencyCode: '', localCurrencyName: '', foreignCurrencies: [] },
    costCentres: { active: false, items: [] },
    inflation: { active: false, indices: [] },
    discounting: { method: 'manual', financialRatePercent: null, economicRatePercent: null },
    taxation: { system: 'corporate', lossCarryForward: true, lossCarryForwardYears: null, rates: [] },
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
  if (!Number.isInteger(planning.balanceDateMonth) || planning.balanceDateMonth < 1 || planning.balanceDateMonth > 12)
    issue('planning.balanceDateMonth', 'error', 'invalid-balance-month', 'Balance date month must be an integer from 1 to 12.')
  if (!Number.isInteger(planning.balanceDateDay) || planning.balanceDateDay < 1 || planning.balanceDateDay > 31)
    issue('planning.balanceDateDay', 'error', 'invalid-balance-day', 'Balance date day must be an integer from 1 to 31.')
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
  if (value.discounting.method === 'manual' && value.discounting.financialRatePercent === null)
    issue('discounting.financialRatePercent', 'warning', 'missing-financial-discount-rate', 'A manual financial discount rate has not been defined.')
  if (value.taxation.lossCarryForwardYears !== null && (!Number.isInteger(value.taxation.lossCarryForwardYears) || value.taxation.lossCarryForwardYears < 0))
    issue('taxation.lossCarryForwardYears', 'error', 'invalid-loss-carryforward-period', 'Loss carry-forward years must be a non-negative integer.')
  value.taxation.rates.forEach((rate, index) => {
    if (!rate.period.trim() || !Number.isFinite(rate.ratePercent) || rate.ratePercent < 0 || rate.ratePercent > 100)
      issue(`taxation.rates[${index}]`, 'error', 'invalid-tax-rate', 'Each tax rate requires a period and a percentage from 0 to 100.')
  })
  if (value.taxation.system !== 'none' && value.taxation.rates.length === 0)
    issue('taxation.rates', 'warning', 'missing-tax-rates', 'The tax system is selected but no period-specific tax rates have been entered.')
  return issues
}

export type FixedInvestmentAssetClass = 'land' | 'site' | 'buildings' | 'machinery' | 'infrastructure' | 'vehicles' | 'office' | 'intangible' | 'other'
export type FixedInvestmentDepreciationMethod = 'none' | 'linear-zero' | 'linear-scrap' | 'accelerated' | 'sum-of-digits'
export type FixedInvestmentAcquisition = {
  id: string
  period: string
  quantity: number
  unitPrice: number
  currencyCode: string
  exchangeRateToLocal: number | null
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
    scrapPercent: number
  }
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
    depreciation: { method: 'none', startingAt: '', ratePercent: null, lengthYears: null, lengthMonths: 0, scrapPercent: 0 },
    acquisitions: [],
    sales: [],
  }
}

export function validateFixedInvestmentItems(items: FixedInvestmentItem[], foundation: ProjectFoundation): ProjectFoundationIssue[] {
  const issues: ProjectFoundationIssue[] = []
  const issue = (path: string, code: string, message: string) => issues.push({ path, severity: 'error', code, message })
  const itemIds = items.map(item => item.id)
  if (new Set(itemIds).size !== itemIds.length) issue('fixedInvestmentItems', 'duplicate-fixed-asset-id', 'Fixed investment item identifiers must be unique.')
  const validCurrencyCodes = new Set([foundation.currencies.localCurrencyCode, ...foundation.currencies.foreignCurrencies.map(currency => currency.code)].map(code => code.trim().toUpperCase()).filter(Boolean))
  items.forEach((item, index) => {
    const path = `fixedInvestmentItems[${index}]`
    if (!item.description.trim()) issue(path + '.description', 'missing-fixed-asset-description', 'Enter a description for each fixed investment item.')
    if (!item.currencyCode.trim() || !validCurrencyCodes.has(item.currencyCode.trim().toUpperCase()))
      issue(path + '.currencyCode', 'unknown-fixed-asset-currency', 'The asset currency must be defined in the project currency structure.')
    if (foundation.costCentres.active && (!item.costCentreId || !foundation.costCentres.items.some(centre => centre.id === item.costCentreId)))
      issue(path + '.costCentreId', 'missing-fixed-asset-cost-centre', 'Select a valid Cost Centre for this fixed investment item.')
    if (item.acquisitions.length === 0) issue(path + '.acquisitions', 'missing-asset-acquisition', 'At least one acquisition period is required for a fixed investment item.')
    item.acquisitions.forEach((acquisition, acquisitionIndex) => {
      const acquisitionPath = path + `.acquisitions[${acquisitionIndex}]`
      if (!acquisition.period.trim() || !Number.isFinite(acquisition.quantity) || acquisition.quantity < 0 || !Number.isFinite(acquisition.unitPrice) || acquisition.unitPrice < 0)
        issue(acquisitionPath, 'invalid-asset-acquisition', 'Acquisition period, quantity and unit price must be valid and non-negative.')
      if (acquisition.currencyCode.trim().toUpperCase() !== item.currencyCode.trim().toUpperCase())
        issue(acquisitionPath + '.currencyCode', 'asset-acquisition-currency-mismatch', 'Acquisition currency must match the fixed investment item currency.')
      if (item.origin === 'foreign' && (!Number.isFinite(acquisition.exchangeRateToLocal) || (acquisition.exchangeRateToLocal ?? 0) <= 0))
        issue(acquisitionPath + '.exchangeRateToLocal', 'missing-asset-exchange-rate', 'Foreign-origin asset acquisitions require a positive exchange rate to local currency.')
    })
    if (item.depreciation.method !== 'none') {
      if (!item.depreciation.startingAt.trim()) issue(path + '.depreciation.startingAt', 'missing-depreciation-start', 'Define Starting at for depreciable assets.')
      if (!Number.isInteger(item.depreciation.lengthYears) || (item.depreciation.lengthYears ?? 0) < 0 || !Number.isInteger(item.depreciation.lengthMonths) || item.depreciation.lengthMonths < 0 || item.depreciation.lengthMonths > 11 || ((item.depreciation.lengthYears ?? 0) + item.depreciation.lengthMonths / 12) <= 0)
        issue(path + '.depreciation.length', 'invalid-depreciation-length', 'Depreciation Length must be greater than zero and months must be from 0 to 11.')
      if (!Number.isFinite(item.depreciation.scrapPercent) || item.depreciation.scrapPercent < 0 || item.depreciation.scrapPercent > 100)
        issue(path + '.depreciation.scrapPercent', 'invalid-scrap-percent', 'Scrap must be between 0 and 100 percent of original value.')
      if (item.depreciation.method !== 'sum-of-digits' && (!Number.isFinite(item.depreciation.ratePercent) || (item.depreciation.ratePercent ?? 0) <= 0 || (item.depreciation.ratePercent ?? 0) > 100))
        issue(path + '.depreciation.ratePercent', 'invalid-depreciation-rate', 'Rate must be greater than 0 and no more than 100 percent per annum.')
    }
    item.sales.forEach((sale, saleIndex) => {
      const salePath = path + `.sales[${saleIndex}]`
      if (!sale.acquisitionId || !item.acquisitions.some(acquisition => acquisition.id === sale.acquisitionId))
        issue(salePath + '.acquisitionId', 'unknown-asset-sale-acquisition', 'An asset sale must refer to an existing acquisition.')
      if (!sale.period.trim() || !sale.currencyCode.trim() || !validCurrencyCodes.has(sale.currencyCode.trim().toUpperCase()))
        issue(salePath, 'invalid-asset-sale-period-currency', 'Asset sale requires a period and a defined currency.')
      if (sale.priceMode === 'self-defined' && (!Number.isFinite(sale.selfDefinedPrice) || (sale.selfDefinedPrice ?? 0) < 0))
        issue(salePath + '.selfDefinedPrice', 'invalid-asset-sale-price', 'A self-defined sale price must be a non-negative number.')
    })
  })
  return issues
}
