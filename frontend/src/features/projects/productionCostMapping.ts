export type ProductionCostComponent = 'materials' | 'directLabor' | 'energy' | 'maintenance' | 'overhead'
export type ProductionCostMapping = { variable: Record<ProductionCostComponent, number>; fixed: Record<ProductionCostComponent, number> }
const emptyComponents = (): Record<ProductionCostComponent, number> => ({
  materials: 0, directLabor: 0, energy: 0, maintenance: 0, overhead: 0,
})

/** Backward-compatible normalization for previously saved cost mappings. */
export function normalizeProductionCostMapping(value: unknown): ProductionCostMapping {
  if (!value || typeof value !== 'object') return { variable: emptyComponents(), fixed: emptyComponents() }
  const candidate = value as { variable?: unknown; fixed?: unknown } & Record<string, unknown>
  const normalize = (source: unknown) => {
    const result = emptyComponents()
    if (source && typeof source === 'object') {
      for (const key of Object.keys(result) as ProductionCostComponent[]) {
        const amount = (source as Record<string, unknown>)[key]
        if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) result[key] = amount
      }
    }
    return result
  }
  if (candidate.variable && candidate.fixed)
    return { variable: normalize(candidate.variable), fixed: normalize(candidate.fixed) }
  return { variable: normalize(candidate), fixed: emptyComponents() }
}

export type ProductionAnnualCostInput = {
  cpp: number[]
  cps: number[]
  hasProductionRecords: boolean[]
  utilization: number[]
  opexFactors: number[]
  fullCapacityVariableCashCost: number
  fullCapacityFixedCashCost: number
  mappedBaseCosts: ProductionCostMapping
}
export type ProductionCostMappingResult = {
  valid: boolean
  errors: string[]
  costOfProductsSoldByYear: number[]
  otherVariableCashCostByYear: number[]
  otherFixedCashCostByYear: number[]
  mappedVariableBaseCostTotal: number
  mappedFixedBaseCostTotal: number
}

/** Replace only the explicitly mapped portion of legacy variable costs with actual CPS. */
export function mapProductionCostsToFinance(input: ProductionAnnualCostInput): ProductionCostMappingResult {
  const errors: string[] = []
  const years = input.cps.length
  if ([input.cpp, input.hasProductionRecords, input.utilization, input.opexFactors].some(vector => vector.length !== years))
    errors.push('طول برنامه سالانه هزینه تولید و ضرایب مالی یکسان نیست')
  if (!Number.isFinite(input.fullCapacityVariableCashCost) || input.fullCapacityVariableCashCost < 0)
    errors.push('هزینه متغیر پایه باید عددی معتبر و نامنفی باشد')
  if (!Number.isFinite(input.fullCapacityFixedCashCost) || input.fullCapacityFixedCashCost < 0)
    errors.push('هزینه ثابت پایه باید عددی معتبر و نامنفی باشد')
  // Persisted projects can contain incomplete legacy objects despite the static type.
  const mapping = input.mappedBaseCosts && typeof input.mappedBaseCosts === 'object' ? input.mappedBaseCosts : undefined
  const variableSource = mapping?.variable && typeof mapping.variable === 'object' ? mapping.variable : undefined
  const fixedSource = mapping?.fixed && typeof mapping.fixed === 'object' ? mapping.fixed : undefined
  const variableEntries = variableSource ? Object.entries(variableSource) as [ProductionCostComponent, number][] : []
  const fixedEntries = fixedSource ? Object.entries(fixedSource) as [ProductionCostComponent, number][] : []
  if (!variableSource || !fixedSource || [...variableEntries, ...fixedEntries].some(([, value]) => !Number.isFinite(value) || value < 0))
    errors.push('مبالغ نگاشت هزینه پایه باید محدود و نامنفی باشند')
  const mappedVariableBaseCostTotal = variableEntries.reduce((sum, [, value]) => sum + value, 0)
  const mappedFixedBaseCostTotal = fixedEntries.reduce((sum, [, value]) => sum + value, 0)
  if (!Number.isFinite(mappedVariableBaseCostTotal) || !Number.isFinite(mappedFixedBaseCostTotal))
    errors.push('جمع اجزای نگاشت هزینه پایه از محدوده عددی معتبر خارج است')
  if (mappedVariableBaseCostTotal > input.fullCapacityVariableCashCost + 0.005)
    errors.push('جمع اجزای نگاشت متغیر از کل هزینه متغیر پایه بیشتر است')
  if (mappedFixedBaseCostTotal > input.fullCapacityFixedCashCost + 0.005)
    errors.push('جمع اجزای نگاشت ثابت از کل هزینه ثابت پایه بیشتر است؛ اتصال CPS برای جلوگیری از دوباره‌شماری متوقف شد')
  if (input.cpp.some(value => !Number.isFinite(value) || value < 0) || input.cps.some(value => !Number.isFinite(value) || value < 0) ||
      input.utilization.some(value => !Number.isFinite(value) || value < 0 || value > 1) || input.hasProductionRecords.some(value => typeof value !== 'boolean') ||
      input.opexFactors.some(value => !Number.isFinite(value) || value < 0))
    errors.push('CPS، ضریب ظرفیت یا ضریب تعدیل هزینه دارای مقدار نامعتبر است')
  if (errors.length) return { valid: false, errors, costOfProductsSoldByYear: [], otherVariableCashCostByYear: [], otherFixedCashCostByYear: [], mappedVariableBaseCostTotal, mappedFixedBaseCostTotal }
  const costOfProductsSoldByYear = input.cps.map((cps, index) => input.hasProductionRecords[index] ? cps : 0)
  const otherVariableCashCostByYear = input.cps.map((_, index) => {
    const remainingBase = input.hasProductionRecords[index]
      ? input.fullCapacityVariableCashCost - mappedVariableBaseCostTotal
      : input.fullCapacityVariableCashCost
    return remainingBase * input.utilization[index] * input.opexFactors[index]
  })
  const otherFixedCashCostByYear = input.cps.map((_, index) => {
    const remainingBase = input.hasProductionRecords[index]
      ? input.fullCapacityFixedCashCost - mappedFixedBaseCostTotal
      : input.fullCapacityFixedCashCost
    // Fixed cash costs are not volume-scaled; the finance engine applies them
    // in operating years independently of utilization.
    return remainingBase * input.opexFactors[index]
  })
  return { valid: true, errors, costOfProductsSoldByYear, otherVariableCashCostByYear, otherFixedCashCostByYear, mappedVariableBaseCostTotal, mappedFixedBaseCostTotal }
}


export type ProductionCostTraceabilityRow = {
  component: ProductionCostComponent
  titleFa: string
  costDriverBasis: string
  variableMappedAmount: number
  fixedMappedAmount: number
  totalMappedAmount: number
  classificationStatus: 'user-split-required'
  baselineCoverageStatus: 'user-mapped-not-source-verified' | 'not-mapped'
  outsideBasePoolAmount: null
  sourceStatus: 'project-source-missing'
  sourceReference: null
  incomeStatementRoute: string
  workingCapitalRoute: string
  doubleCountControl: string
}

export type ProductionCostTraceabilityLedger = {
  projectReference: string
  sourceVerification: 'unverified'
  rows: ProductionCostTraceabilityRow[]
  mappedVariableTotal: number
  mappedFixedTotal: number
  mappedTotal: number
  baselineVariablePool: number | null
  baselineFixedPool: number | null
  unallocatedVariableBaseline: number | null
  unallocatedFixedBaseline: number | null
}

/**
 * Produces an audit ledger, not a source-derived estimate.
 * Amounts in mappedBaseCosts are user-entered allocations; CRC200 source
 * operating-cost schedules are absent, so outside-pool values remain null.
 */
export function buildProductionCostTraceabilityLedger(input: {
  projectReference: string
  mappedBaseCosts: ProductionCostMapping
  fullCapacityVariableCashCost?: number | null
  fullCapacityFixedCashCost?: number | null
}): ProductionCostTraceabilityLedger {
  const definitions: Array<Pick<ProductionCostTraceabilityRow, 'component' | 'titleFa' | 'costDriverBasis' | 'incomeStatementRoute' | 'workingCapitalRoute' | 'doubleCountControl'>> = [
    { component: 'materials', titleFa: 'مواد مستقیم و مصرفی', costDriverBasis: 'مقدار مصرف تأییدشده × نرخ واحد خرید؛ واحد، دوره و ارز باید همسان باشند', incomeStatementRoute: 'هزینه مواد ابتدا در CPP محصول سالم منظور و هنگام فروش از طریق CPS به بهای تمام‌شده کالای فروش‌رفته منتقل می‌شود', workingCapitalRoute: 'موجودی مواد اولیه و بدهی تجاری از سیاست سرمایه در گردش؛ سهم مواد در کالای در جریان ساخت و محصول نهایی فقط از مسیر CPP/CPS', doubleCountControl: 'مواد منظورشده در CPP از هزینه پایه متغیر متناظر کسر می‌شود؛ خرید مواد و مصرف مواد دو بار هزینه نمی‌شوند' },
    { component: 'directLabor', titleFa: 'دستمزد مستقیم', costDriverBasis: 'ساعات کار مستقیم × نرخ دستمزد و مزایای قابل انتساب؛ مبنای واقعی باید از لیست حقوق/کارکرد بیاید', incomeStatementRoute: 'سهم تولیدی در CPP و سپس CPS؛ دستمزد غیرتولیدی/اداری فقط در هزینه عملیاتی یا اداری متناظر', workingCapitalRoute: 'سهم تولیدی در WIP و محصول نهایی از مسیر CPP/CPS؛ مطالبات/بدهی حقوقی فقط در صورت تعریف جداگانه در سرمایه در گردش', doubleCountControl: 'فقط سهم تولیدی وارد CPP می‌شود؛ هزینه اداری یا هزینه‌ای که قبلاً در پایه ثابت/متغیر ثبت شده دوباره اضافه نمی‌شود' },
    { component: 'energy', titleFa: 'انرژی و سوخت', costDriverBasis: 'مصرف اندازه‌گیری‌شده برق، گاز و سوخت × تعرفه/نرخ قرارداد همان دوره', incomeStatementRoute: 'انرژی تولیدی در CPP و سپس CPS؛ مصرف عمومی و اداری خارج از CPP در هزینه عملیاتی مربوط', workingCapitalRoute: 'انرژی تولیدی در WIP/محصول نهایی از مسیر CPP/CPS؛ بدهی انرژی فقط در صورت ثبت در سیاست پرداختنی‌ها', doubleCountControl: 'مصرف تولیدی تخصیص‌یافته به CPP از پایه هزینه حذف می‌شود؛ انرژی عمومی خارج از تولید جدا می‌ماند' },
    { component: 'maintenance', titleFa: 'تعمیرات و نگهداری', costDriverBasis: 'دستورکار تعمیرات، قطعات مصرفی و ساعات نیروی تعمیراتی؛ تفکیک تعمیرات جاری از سرمایه‌ای الزامی است', incomeStatementRoute: 'تعمیرات جاری تولیدی در CPP/CPS؛ تعمیرات اداری در هزینه عملیاتی؛ بهسازی سرمایه‌ای در CAPEX و نه هزینه جاری', workingCapitalRoute: 'بخش تولیدی جاری فقط از مسیر CPP/CPS در WIP/محصول نهایی؛ قطعات یدکی موجودی جداگانه در صورت فعال‌بودن سیاست آن', doubleCountControl: 'هزینه سرمایه‌ای از هزینه جاری جدا؛ قطعات/دستمزد تعمیراتی فقط یک‌بار و متناسب با محل مصرف ثبت می‌شود' },
    { component: 'overhead', titleFa: 'سربار تولید', costDriverBasis: 'مبنای تسهیم مصوب مانند ساعت ماشین، ساعت کار یا حجم تولید؛ مبنا و نرخ تسهیم باید قابل ردیابی باشد', incomeStatementRoute: 'فقط سربار تولید قابل انتساب وارد CPP/CPS؛ سربار اداری، فروش و مالی در سرفصل‌های مستقل سود و زیان', workingCapitalRoute: 'سربار تولید تخصیص‌یافته در WIP/محصول نهایی از مسیر CPP/CPS؛ اقلام غیرتولیدی در سرمایه در گردش تولید وارد نمی‌شوند', doubleCountControl: 'مانده تخصیص‌نیافته و سربار اداری/فروش/مالی نباید به CPP اضافه شود؛ هر قلم فقط یک مقصد حسابداری دارد' },
  ]
  const rows = definitions.map(definition => {
    const variableMappedAmount = input.mappedBaseCosts.variable[definition.component]
    const fixedMappedAmount = input.mappedBaseCosts.fixed[definition.component]
    const validAmounts = Number.isFinite(variableMappedAmount) && variableMappedAmount >= 0 && Number.isFinite(fixedMappedAmount) && fixedMappedAmount >= 0
    return {
      ...definition,
      variableMappedAmount: validAmounts ? variableMappedAmount : 0,
      fixedMappedAmount: validAmounts ? fixedMappedAmount : 0,
      totalMappedAmount: validAmounts ? variableMappedAmount + fixedMappedAmount : 0,
      classificationStatus: 'user-split-required' as const,
      baselineCoverageStatus: validAmounts && variableMappedAmount + fixedMappedAmount > 0 ? 'user-mapped-not-source-verified' as const : 'not-mapped' as const,
      outsideBasePoolAmount: null,
      sourceStatus: 'project-source-missing' as const,
      sourceReference: null,
    }
  })
  const mappedVariableTotal = rows.reduce((sum, row) => sum + row.variableMappedAmount, 0)
  const mappedFixedTotal = rows.reduce((sum, row) => sum + row.fixedMappedAmount, 0)
  const validVariablePool = typeof input.fullCapacityVariableCashCost === 'number' && Number.isFinite(input.fullCapacityVariableCashCost) && input.fullCapacityVariableCashCost >= mappedVariableTotal
  const validFixedPool = typeof input.fullCapacityFixedCashCost === 'number' && Number.isFinite(input.fullCapacityFixedCashCost) && input.fullCapacityFixedCashCost >= mappedFixedTotal
  return {
    projectReference: input.projectReference,
    sourceVerification: 'unverified',
    rows,
    mappedVariableTotal,
    mappedFixedTotal,
    mappedTotal: mappedVariableTotal + mappedFixedTotal,
    baselineVariablePool: typeof input.fullCapacityVariableCashCost === 'number' ? input.fullCapacityVariableCashCost : null,
    baselineFixedPool: typeof input.fullCapacityFixedCashCost === 'number' ? input.fullCapacityFixedCashCost : null,
    unallocatedVariableBaseline: validVariablePool ? input.fullCapacityVariableCashCost! - mappedVariableTotal : null,
    unallocatedFixedBaseline: validFixedPool ? input.fullCapacityFixedCashCost! - mappedFixedTotal : null,
  }
}
