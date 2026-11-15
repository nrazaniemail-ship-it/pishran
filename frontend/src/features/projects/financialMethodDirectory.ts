export type FinancialMethodDomain =
  | 'depreciation' | 'financing' | 'taxation' | 'investment'
  | 'working-capital' | 'revenue' | 'costs' | 'inflation-fx'
  | 'valuation' | 'risk'

export type FinancialMethodParameter = {
  key: string
  nameFa: string
  nameEn: string
  valueType: 'number' | 'integer' | 'boolean' | 'enum'
  unit: string
  required: boolean
  min?: number
  max?: number
  options?: readonly string[]
}

export type FinancialMethodDefinition = {
  id: string
  domain: FinancialMethodDomain
  nameFa: string
  nameEn: string
  calculationStatus: 'implemented' | 'conditional' | 'catalog-only'
  benchmarkStatus: 'verified' | 'partial' | 'unverified'
  parameters: readonly FinancialMethodParameter[]
  formula: string
  validity: string
  source: string
  referenceTest: string
  limitations?: string
}

const p = (
  key: string, nameFa: string, nameEn: string, valueType: FinancialMethodParameter['valueType'],
  unit: string, required = true, min?: number, max?: number, options?: readonly string[],
): FinancialMethodParameter => ({ key, nameFa, nameEn, valueType, unit, required, min, max, options })

/**
 * Extensible, metadata-driven catalogue for calculation methods.
 * Catalogue presence is not evidence of numeric validation: benchmarkStatus is explicit.
 */
export const FINANCIAL_METHOD_DIRECTORY: readonly FinancialMethodDefinition[] = [
  { id:'depreciation.none', domain:'depreciation', nameFa:'بدون استهلاک', nameEn:'No depreciation', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[], formula:'Depreciation = 0; book value remains until disposal.', validity:'Land and other assets explicitly designated non-depreciable.', source:'Asset-register policy; project evidence required.', referenceTest:'Non-depreciated land lifecycle regression.', limitations:'Tax treatment must be confirmed separately.' },
  { id:'depreciation.straight-line-zero', domain:'depreciation', nameFa:'خط مستقیم تا صفر', nameEn:'Straight-line to zero', calculationStatus:'implemented', benchmarkStatus:'unverified', parameters:[p('usefulLifeYears','عمر مفید','Useful life','number','years',true,0.0001),p('firstPeriodMonths','ماه‌های دوره اول','First-period months','integer','months',true,1,12)], formula:'Depreciation = opening depreciable value / useful life, prorated for first period.', validity:'Positive useful life; first period from 1 to 12 months.', source:'COMFAR III Reference, depreciation method description; numeric benchmark pending.', referenceTest:'Depreciation schedule regression; hot-rolling reference comparison pending.' },
  { id:'depreciation.straight-line-scrap', domain:'depreciation', nameFa:'خط مستقیم با ارزش اسقاط', nameEn:'Straight-line to scrap value', calculationStatus:'implemented', benchmarkStatus:'unverified', parameters:[p('usefulLifeYears','عمر مفید','Useful life','number','years',true,0.0001),p('scrapPercent','ارزش اسقاط','Scrap value','number','% of gross cost',true,0,100),p('firstPeriodMonths','ماه‌های دوره اول','First-period months','integer','months',true,1,12)], formula:'Depreciation = (depreciable cost - scrap value) / useful life, prorated for first period.', validity:'Useful life > 0; scrap value between 0% and 100%; first period 1–12 months.', source:'COMFAR III Reference, depreciation method description; numeric benchmark pending.', referenceTest:'Asset-by-asset depreciation schedule and book-value roll-forward.' },
  { id:'depreciation.accelerated', domain:'depreciation', nameFa:'استهلاک شتاب‌یافته', nameEn:'Accelerated depreciation', calculationStatus:'implemented', benchmarkStatus:'unverified', parameters:[p('ratePercent','نرخ شتاب‌یافته','Accelerated rate','number','% per year',true,0,100),p('usefulLifeYears','عمر مفید','Useful life','number','years',true,0.0001),p('scrapPercent','ارزش اسقاط','Scrap value','number','% of gross cost',true,0,100)], formula:'Higher of declining-balance charge and straight-line charge over remaining life, capped at scrap value.', validity:'Rate > 0 and < 100%; positive useful life; non-negative depreciable base.', source:'Existing Pishran calculation routine; external numeric benchmark pending.', referenceTest:'Accelerated-to-straight-line switch and terminal scrap-value tests.' },
  { id:'depreciation.sum-of-years-digits', domain:'depreciation', nameFa:'مجموع سنوات', nameEn:'Sum-of-years-digits', calculationStatus:'conditional', benchmarkStatus:'unverified', parameters:[p('usefulLifeYears','عمر مفید','Useful life','integer','years',true,1),p('scrapPercent','ارزش اسقاط','Scrap value','number','% of gross cost',true,0,100)], formula:'Annual charge = remaining useful-life digits / sum(1..n) × depreciable base.', validity:'Whole-year schedule only in the current implementation.', source:'Existing Pishran calculation routine; external numeric benchmark pending.', referenceTest:'Whole-year schedule regression.', limitations:'Partial first periods are deliberately rejected until benchmarked.' },
  { id:'financing.equal-principal', domain:'financing', nameFa:'اقساط با اصل مساوی', nameEn:'Equal principal', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('annualRate','نرخ سالانه','Annual interest rate','number','%',true,0,100),p('graceYears','دوره تنفس','Grace period','integer','years',true,0),p('termYears','مدت بازپرداخت','Repayment term','integer','years',true,1)], formula:'Equal principal instalments after the grace period; interest on outstanding balance.', validity:'Positive term; non-negative grace period and interest rate.', source:'Pishran integrated loan schedule.', referenceTest:'Loan balance roll-forward and principal sum checks.' },
  { id:'financing.annuity', domain:'financing', nameFa:'اقساط ثابت (مستمری)', nameEn:'Annuity', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('annualRate','نرخ سالانه','Annual interest rate','number','%',true,0,100),p('termYears','مدت بازپرداخت','Repayment term','integer','years',true,1)], formula:'Constant payment calculated from rate and outstanding principal.', validity:'Positive repayment term; zero-rate case handled separately.', source:'Pishran integrated loan schedule.', referenceTest:'Payment consistency and closing-balance checks.' },
  { id:'financing.effective-annual-frequency-rate', domain:'financing', nameFa:'نرخ مؤثر سالانه تقسیم‌شده بر تناوب', nameEn:'Effective annual rate divided by period frequency', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('effectiveAnnualRatePercent','نرخ مؤثر سالانه','Effective annual rate','number','%',true,0,100),p('periodsPerYear','تعداد دوره در سال','Periods per year','enum','periods',true,undefined,undefined,['1','2','4','12']),p('dayCountBasis','مبنای روزشمار','Day-count basis','enum','days',true,undefined,undefined,['360','365'])], formula:'Full-period rate = effective annual rate / periods per year. Partial periods are scaled by actual days relative to the nominal period length.', validity:'Use only when the selected financing convention explicitly specifies simple division of the effective annual rate by the number of periods; this is not equivalent to compounding an effective annual rate by actual days.', source:'HRCR200 CAPEX workbook, repayment schedule: monthly nominal rate = 26% / 12; effective annual rate = (1 + monthly rate)^12 - 1; quarterly rate = effective annual rate / 4.', referenceTest:'HRCR200 3,816,495.99 million Rial loan, 20 quarterly annuity payments; first principal 89,759.7075, first interest 279,876.9941 and payment 369,636.7017 million Rial.', limitations:'The convention is workbook-specific and must be selected explicitly. It must not silently replace actual-day effective compounding or be assumed for other projects.' },
  { id:'financing.bullet', domain:'financing', nameFa:'بازپرداخت یکجا', nameEn:'Bullet repayment', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('annualRate','نرخ سالانه','Annual interest rate','number','%',true,0,100),p('termYears','مدت بازپرداخت','Repayment term','integer','years',true,1)], formula:'Principal repaid at maturity; interest charged on outstanding balance.', validity:'Positive repayment term.', source:'Pishran integrated loan schedule.', referenceTest:'Maturity principal and debt-balance checks.' },
  { id:'taxation.corporate-rate', domain:'taxation', nameFa:'مالیات شرکتی دوره‌ای', nameEn:'Period corporate tax', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('taxRatePercent','نرخ مالیات','Tax rate','number','%',true,0,100)], formula:'Tax = max(0, taxable profit after eligible losses) × tax rate.', validity:'Tax rate from 0% to 100%.', source:'Pishran integrated financial model.', referenceTest:'Tax and loss carry-forward regression.', limitations:'Expiry and jurisdiction-specific ordering of losses require separate rules.' },
  { id:'taxation.period-rate-schedule', domain:'taxation', nameFa:'نرخ مالیات متغیر در دوره‌ها', nameEn:'Period-specific tax-rate schedule', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('taxRates','نرخ مالیات هر دوره','Tax rate per period','number','% per period',true,0,100)], formula:'Tax for each period = max(0, taxable profit after eligible losses) × that period tax rate.', validity:'One rate per model period; each rate must be between 0% and 100%.', source:'Pishran periodic financial engine taxRatesByPeriod input; annual fiscal-year rates remain the fallback when no period override is entered.', referenceTest:'Annual rate-schedule length, bounds and period tax regression.', limitations:'Period-specific rates are supported when a project calendar is configured. Jurisdiction-specific tax bases, tax payment timing, withholding, expiry and annual loss-offset caps are not yet configurable.' },
  { id:'taxation.loss-carry-forward', domain:'taxation', nameFa:'انتقال زیان مالیاتی', nameEn:'Tax-loss carry-forward', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('openingLoss','زیان انتقالی ابتدای دوره','Opening tax loss','number','currency',true,0),p('taxRatePercent','نرخ مالیات','Tax rate','number','%',true,0,100)], formula:'Taxable profit after losses = EBIT − interest − eligible opening tax loss; tax is zero when the result is non-positive; unused loss carries forward.', validity:'Opening loss is non-negative; loss offset is limited to taxable profit.', source:'Pishran integrated financial model tax-loss roll-forward.', referenceTest:'Loss creation, partial use, full use and zero-tax-period regression.', limitations:'Expiry, annual utilization caps and jurisdiction-specific ordering are not yet configurable.' },
  { id:'investment.asset-register', domain:'investment', nameFa:'دفتر دارایی به تفکیک تحصیل', nameEn:'Asset acquisition register', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('acquisitionPeriod','دوره تحصیل','Acquisition period','integer','period',true,1),p('scrapPercent','ارزش اسقاط','Scrap value','number','%',true,0,100)], formula:'Each acquisition vintage is reconciled to CAPEX and passed to the depreciation lifecycle.', validity:'Unique acquisition IDs; positive FX conversion where applicable.', source:'Pishran fixed-investment register and reconciliation bridge.', referenceTest:'CAPEX reconciliation and asset-vintage mapping.' },
  { id:'working-capital.operating-cycle', domain:'working-capital', nameFa:'چرخه عملیاتی', nameEn:'Operating cycle', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('dayBasis','مبنای روز','Day-count basis','enum','days',true,undefined,undefined,['360','365']),p('receivableDays','روزهای دریافتنی','Receivable days','number','days',true,0),p('payableDays','روزهای پرداختنی','Payable days','number','days',true,0)], formula:'Operating assets by holding days less trade payables by payment days.', validity:'Days are non-negative and capped at the selected day basis.', source:'Pishran operating-cycle working-capital model.', referenceTest:'Working-capital component and cash-conversion-cycle tests.' },
  { id:'revenue.capacity-utilization', domain:'revenue', nameFa:'ظرفیت و ضریب بهره‌برداری', nameEn:'Capacity and utilization', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('capacity','ظرفیت اسمی','Nameplate capacity','number','unit/year',true,0),p('utilizationPercent','ضریب بهره‌برداری','Utilization','number','%',true,0,100)], formula:'Production = nameplate capacity × utilization.', validity:'Capacity ≥ 0; utilization between 0% and 100%.', source:'Pishran integrated project model.', referenceTest:'Production and revenue scaling regression.' },
  { id:'costs.fixed-variable', domain:'costs', nameFa:'تفکیک ثابت و متغیر', nameEn:'Fixed and variable cost split', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('fixedAnnual','هزینه ثابت سالانه','Annual fixed cost','number','currency/year',true,0),p('variablePerUnit','هزینه متغیر واحد','Variable cost per unit','number','currency/unit',true,0)], formula:'Recurring cost = fixed annual cost + variable unit cost × output.', validity:'Non-negative cost inputs.', source:'Pishran OPEX row classification.', referenceTest:'OPEX aggregation and utilization-scaling tests.' },
  { id:'inflation-fx.period-index', domain:'inflation-fx', nameFa:'شاخص دوره‌ای تورم و ارز', nameEn:'Period inflation and FX index', calculationStatus:'conditional', benchmarkStatus:'unverified', parameters:[p('periodRate','نرخ دوره','Period rate','number','%',true,-99.99)], formula:'Period-specific indexation/translation using a dated index or exchange-rate series.', validity:'A dated, currency-matched series is required.', source:'Project foundation inflation and exchange-rate schedules.', referenceTest:'Series completeness and currency-mapping tests.', limitations:'No rate is assumed when the source series is missing.' },
  { id:'valuation.npv-irr', domain:'valuation', nameFa:'ارزش فعلی خالص و نرخ بازده داخلی', nameEn:'NPV and IRR', calculationStatus:'implemented', benchmarkStatus:'partial', parameters:[p('discountRate','نرخ تنزیل','Discount rate','number','%',true,-99.99)], formula:'NPV discounts dated cash flows; IRR solves for a rate that sets NPV to zero.', validity:'Cash-flow signs and period alignment must be valid.', source:'Pishran financial evaluation engine.', referenceTest:'NPV/IRR regression and reference cash-flow reconciliation.' },
  { id:'valuation.mirr', domain:'valuation', nameFa:'نرخ بازده داخلی تعدیل‌شده', nameEn:'Modified IRR', calculationStatus:'conditional', benchmarkStatus:'unverified', parameters:[p('financeRate','نرخ تأمین مالی','Finance rate','number','%',true,-99.99),p('reinvestmentRate','نرخ سرمایه‌گذاری مجدد','Reinvestment rate','number','%',true,-99.99)], formula:'MIRR uses explicit finance and reinvestment rates.', validity:'Both rates must be supplied; do not infer either rate.', source:'Pishran MIRR routine; project-specific rates required.', referenceTest:'MIRR regression with explicit rates.', limitations:'Not comparable to a reference report when finance/reinvestment rates are undisclosed.' },
  { id:'risk.sensitivity', domain:'risk', nameFa:'تحلیل حساسیت چندمتغیره', nameEn:'Multivariable sensitivity', calculationStatus:'catalog-only', benchmarkStatus:'unverified', parameters:[p('variableCount','تعداد متغیرها','Variable count','integer','count',true,1)], formula:'Recalculate model outputs across explicitly defined input perturbations.', validity:'Requires defined variables, ranges and recalculation linkage.', source:'Planned extensible method catalogue.', referenceTest:'Not implemented; no benchmark test yet.', limitations:'Catalogue entry only; no sensitivity result is produced.' },
] as const

export type FinancialMethodValidationIssue = { methodId: string; parameter: string; code: string; message: string }

export function listFinancialMethods(domain?: FinancialMethodDomain): readonly FinancialMethodDefinition[] {
  return domain ? FINANCIAL_METHOD_DIRECTORY.filter(method => method.domain === domain) : FINANCIAL_METHOD_DIRECTORY
}

export function getFinancialMethod(methodId: string): FinancialMethodDefinition | undefined {
  return FINANCIAL_METHOD_DIRECTORY.find(method => method.id === methodId)
}

export function validateFinancialMethodParameters(
  methodId: string,
  values: Record<string, unknown>,
): FinancialMethodValidationIssue[] {
  const method = getFinancialMethod(methodId)
  if (!method) return [{ methodId, parameter: '', code: 'unknown-method', message: 'Selected financial method is not registered.' }]
  const issues: FinancialMethodValidationIssue[] = []
  for (const spec of method.parameters) {
    const value = values[spec.key]
    if (value === undefined || value === null || value === '') {
      if (spec.required) issues.push({ methodId, parameter: spec.key, code: 'missing-parameter', message: `Required parameter "${spec.key}" is missing.` })
      continue
    }
    if (spec.valueType === 'boolean') {
      if (typeof value !== 'boolean') issues.push({ methodId, parameter: spec.key, code: 'invalid-parameter-type', message: `Parameter "${spec.key}" must be boolean.` })
      continue
    }
    if (spec.valueType === 'enum') {
      if (typeof value !== 'string' || !spec.options?.includes(value)) issues.push({ methodId, parameter: spec.key, code: 'invalid-parameter-option', message: `Parameter "${spec.key}" must be one of the registered options.` })
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ methodId, parameter: spec.key, code: 'invalid-parameter-type', message: `Parameter "${spec.key}" must be a finite number.` })
      continue
    }
    if (spec.valueType === 'integer' && !Number.isInteger(value)) issues.push({ methodId, parameter: spec.key, code: 'invalid-parameter-integer', message: `Parameter "${spec.key}" must be an integer.` })
    if (spec.min !== undefined && value < spec.min) issues.push({ methodId, parameter: spec.key, code: 'parameter-below-minimum', message: `Parameter "${spec.key}" is below its minimum.` })
    if (spec.max !== undefined && value > spec.max) issues.push({ methodId, parameter: spec.key, code: 'parameter-above-maximum', message: `Parameter "${spec.key}" exceeds its maximum.` })
  }
  return issues
}

export function validateFinancialMethodDirectory(): string[] {
  const errors: string[] = []
  const ids = FINANCIAL_METHOD_DIRECTORY.map(method => method.id)
  if (new Set(ids).size !== ids.length) errors.push('Method IDs must be unique.')
  for (const method of FINANCIAL_METHOD_DIRECTORY) {
    if (!method.id.trim() || !method.nameFa.trim() || !method.nameEn.trim() || !method.formula.trim() || !method.validity.trim() || !method.source.trim() || !method.referenceTest.trim()) errors.push(`Method "${method.id}" is missing required metadata.`)
    const keys = method.parameters.map(parameter => parameter.key)
    if (new Set(keys).size !== keys.length) errors.push(`Method "${method.id}" has duplicate parameter keys.`)
    if (method.calculationStatus === 'catalog-only' && method.benchmarkStatus === 'verified') errors.push(`Catalog-only method "${method.id}" cannot be benchmark-verified.`)
  }
  return errors
}
