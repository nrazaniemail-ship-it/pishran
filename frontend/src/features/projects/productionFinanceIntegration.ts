import { analyzeProductionRecord, type ProductionRecord } from '../production/productionAnalysis'
import type { ProjectCalendarPeriod } from './projectFoundation'

export type ProductionFinancePeriod = {
  periodIndex: number
  startDate: string
  endDate: string
  cpp: number
  cps: number
  materialCost: number
  directLaborCost: number
  energyCost: number
  maintenanceCost: number
  allocatedOverhead: number
  closingFinishedGoodsValue: number
  closingFinishedGoodsQuantity: number
  products: Array<{ product: string; currency: string; cpp: number; cps: number; materialCost: number; directLaborCost: number; energyCost: number; maintenanceCost: number; allocatedOverhead: number; openingInventoryValue: number; closingInventoryValue: number; closingQuantity: number }>
}
export type ProductionFinanceBridge = {
  valid: boolean
  periods: ProductionFinancePeriod[]
  errors: string[]
  warnings: string[]
}

/**
 * Maps saved production records to exact project calendar periods.
 * Inventory is rolled forward independently by product; no FX assumptions are made.
 */
export function buildProductionFinanceBridge(
  records: ProductionRecord[],
  projectId: string,
  periods: ProjectCalendarPeriod[],
  reportingCurrency: string,
): ProductionFinanceBridge {
  const errors: string[] = []
  const warnings: string[] = []
  const empty = (): ProductionFinanceBridge => ({ valid: false, periods: [], errors, warnings })
  if (!projectId.trim()) errors.push('شناسه پروژه برای اتصال تولید الزامی است')
  if (!reportingCurrency.trim()) errors.push('ارز گزارش مالی الزامی است')
  if (!periods.length) errors.push('تقویم دوره‌های مالی پروژه تعریف نشده است')
  if (errors.length) return empty()

  const sortedPeriods = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
  for (let i = 0; i < sortedPeriods.length; i++) {
    const period = sortedPeriods[i]
    if (!/^\d{4}-\d{2}-\d{2}$/.test(period.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(period.endDate) || period.startDate > period.endDate)
      errors.push(`دوره مالی ${period.index} تاریخ نامعتبر دارد`)
    if (i > 0 && sortedPeriods[i - 1].endDate >= period.startDate) errors.push('دوره‌های مالی هم‌پوشان یا نامرتب هستند')
  }
  if (errors.length) return empty()

  const projectRecords = records.filter(record => record.projectId === projectId)
  if (records.some(record => !record.projectId || record.projectId !== projectId))
    errors.push('رکورد تولید با شناسه پروژه جاری تطبیق ندارد؛ اتصال حدسی یا fallback مجاز نیست')
  const productCurrency = new Map<string, string>()
  const productRecords = new Map<string, Array<{ record: ProductionRecord; periodIndex: number }>>()
  const lineRanges = new Map<string, Array<{ start: string; end: string }>>()

  for (const record of projectRecords) {
    const key = record.product.trim()
    if (!key) { errors.push(`رکورد ${record.id}: شناسه محصول خالی است`); continue }
    const recordErrors = analyzeProductionRecordSafe(record)
    if (recordErrors) { errors.push(`رکورد ${record.id}: ${recordErrors}`); continue }
    const currency = record.currency.trim().toUpperCase()
    if (currency !== reportingCurrency.trim().toUpperCase()) {
      errors.push(`محصول ${key}: ارز ${currency} با ارز گزارش ${reportingCurrency} متفاوت است؛ نرخ تسعیر مستند ارائه نشده است`)
      continue
    }
    const previousCurrency = productCurrency.get(key)
    if (previousCurrency && previousCurrency !== currency) errors.push(`محصول ${key}: ارز در دوره‌های مختلف ناسازگار است`)
    productCurrency.set(key, currency)
    const matches = sortedPeriods.map((period, index) => ({ period, index })).filter(({ period }) => record.periodStart >= period.startDate && record.periodEnd <= period.endDate)
    if (matches.length !== 1) {
      errors.push(`رکورد ${record.id}: بازه تولید باید کاملاً داخل دقیقاً یک دوره مالی باشد`)
      continue
    }
    const rangeKey = key + '|' + record.lineId
    const ranges = lineRanges.get(rangeKey) ?? []
    if (ranges.some(range => record.periodStart <= range.end && record.periodEnd >= range.start))
      errors.push(`محصول ${key} و خط ${record.lineId}: رکوردهای تولید هم‌پوشان هستند`)
    ranges.push({ start: record.periodStart, end: record.periodEnd })
    lineRanges.set(rangeKey, ranges)
    const list = productRecords.get(key) ?? []
    list.push({ record, periodIndex: matches[0].index })
    productRecords.set(key, list)
  }
  if (errors.length) return empty()

  const rows: ProductionFinancePeriod[] = sortedPeriods.map((period, periodIndex) => ({
    periodIndex, startDate: period.startDate, endDate: period.endDate, cpp: 0, cps: 0,
    materialCost: 0, directLaborCost: 0, energyCost: 0, maintenanceCost: 0, allocatedOverhead: 0,
    closingFinishedGoodsValue: 0, closingFinishedGoodsQuantity: 0, products: [],
  }))
  for (const [product, entries] of productRecords) {
    entries.sort((a, b) => a.periodIndex - b.periodIndex || a.record.periodStart.localeCompare(b.record.periodStart))
    let openingQuantity = 0
    let openingValue = 0
    let currency = productCurrency.get(product)!
    let cursor = 0
    for (let periodIndex = 0; periodIndex < sortedPeriods.length; periodIndex++) {
      const current = entries.filter(entry => entry.periodIndex === periodIndex)
      if (!current.length) {
        rows[periodIndex].products.push({ product, currency, cpp: 0, cps: 0, openingInventoryValue: openingValue, closingInventoryValue: openingValue, closingQuantity: openingQuantity })
        continue
      }
      const explicitOpenings = current.filter(({ record }) => record.finishedGoodsOpeningQuantity !== undefined || record.finishedGoodsOpeningValue !== undefined)
      if (explicitOpenings.length > 1) errors.push(`محصول ${product}: موجودی اول دوره بیش از یک‌بار در دوره ${periodIndex + 1} ثبت شده است`)
      if (explicitOpenings.length === 1) {
        const suppliedQuantity = explicitOpenings[0].record.finishedGoodsOpeningQuantity ?? 0
        const suppliedValue = explicitOpenings[0].record.finishedGoodsOpeningValue ?? 0
        if (periodIndex > 0 && (Math.abs(suppliedQuantity - openingQuantity) > 1e-6 || Math.abs(suppliedValue - openingValue) > 0.01))
          errors.push(`محصول ${product}: موجودی اول دوره ${periodIndex + 1} با موجودی پایان دوره قبل تطبیق ندارد`)
        else { openingQuantity = suppliedQuantity; openingValue = suppliedValue }
      }
      const goodOutput = current.reduce((sum, entry) => sum + entry.record.goodOutput, 0)
      const cpp = current.reduce((sum, entry) => sum + analyzeProductionRecord(entry.record).totalProductionCost, 0)
      const salesQuantity = current.reduce((sum, entry) => sum + (entry.record.salesQuantity ?? 0), 0)
      const availableQuantity = openingQuantity + goodOutput
      const availableValue = openingValue + cpp
      if (salesQuantity > availableQuantity + 1e-6) errors.push(`محصول ${product}: فروش دوره ${periodIndex + 1} از موجودی قابل فروش بیشتر است`)
      const averageCost = availableQuantity > 0 ? availableValue / availableQuantity : 0
      const cps = salesQuantity * averageCost
      const closingQuantity = availableQuantity - salesQuantity
      const closingValue = closingQuantity * averageCost
      const materialCost = current.reduce((sum, entry) => sum + analyzeProductionRecord(entry.record).materialCost, 0)
      const directLaborCost = current.reduce((sum, entry) => sum + entry.record.directLaborCost, 0)
      const energyCost = current.reduce((sum, entry) => sum + entry.record.energyCost, 0)
      const maintenanceCost = current.reduce((sum, entry) => sum + entry.record.maintenanceCost, 0)
      const allocatedOverhead = current.reduce((sum, entry) => sum + entry.record.allocatedOverhead, 0)
      rows[periodIndex].cpp += cpp
      rows[periodIndex].cps += cps
      rows[periodIndex].materialCost += materialCost
      rows[periodIndex].directLaborCost += directLaborCost
      rows[periodIndex].energyCost += energyCost
      rows[periodIndex].maintenanceCost += maintenanceCost
      rows[periodIndex].allocatedOverhead += allocatedOverhead
      rows[periodIndex].products.push({ product, currency, cpp, cps, materialCost, directLaborCost, energyCost, maintenanceCost, allocatedOverhead, openingInventoryValue: openingValue, closingInventoryValue: closingValue, closingQuantity })
      openingQuantity = closingQuantity
      openingValue = closingValue
      cursor++
    }
  }
  for (const row of rows) {
    row.closingFinishedGoodsValue = row.products.reduce((sum, product) => sum + product.closingInventoryValue, 0)
    row.closingFinishedGoodsQuantity = row.products.reduce((sum, product) => sum + product.closingQuantity, 0)
  }
  if (projectRecords.length === 0) warnings.push('برای این پروژه سابقه تولید ذخیره‌شده‌ای یافت نشد؛ هیچ عددی به مدل مالی تزریق نشد')
  return { valid: errors.length === 0, periods: rows, errors, warnings }
}

function analyzeProductionRecordSafe(record: ProductionRecord): string | null {
  try { analyzeProductionRecord(record); return null } catch (error) { return error instanceof Error ? error.message : 'رکورد تولید نامعتبر است' }
}
