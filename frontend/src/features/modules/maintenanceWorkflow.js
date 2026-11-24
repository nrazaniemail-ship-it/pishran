export const MAINTENANCE_ASSETS_KEY = 'maintenance:assets:v1'
export const MAINTENANCE_ORDERS_KEY = 'maintenance:orders:v1'
export const MAINTENANCE_RELIABILITY_KEY = 'maintenance:reliability:v1'

const number = (value, label, { optional = false } = {}) => {
  if (optional && (value === '' || value === null || value === undefined)) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} باید عددی نامنفی باشد.`)
  return parsed
}
const required = (value, label) => {
  const text = String(value ?? '').trim()
  if (!text) throw new Error(`${label} الزامی است.`)
  return text
}
const date = (value, label) => {
  const text = required(value, label)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error(`${label} معتبر نیست.`)
  return text
}
const id = (prefix, now) => `${prefix}-${Date.parse(now)}-${Math.random().toString(36).slice(2, 8)}`

export function validateMaintenanceAsset(input) {
  const criticality = String(input.criticality || 'medium')
  if (!['low', 'medium', 'high', 'critical'].includes(criticality)) throw new Error('سطح بحرانی‌بودن تجهیز معتبر نیست.')
  return {
    assetTag: required(input.assetTag, 'کد تجهیز'),
    name: required(input.name, 'نام تجهیز'),
    area: required(input.area, 'ناحیه یا خط'),
    criticality,
    commissionedAt: input.commissionedAt ? date(input.commissionedAt, 'تاریخ راه‌اندازی') : null,
    replacementCost: number(input.replacementCost || 0, 'ارزش جایگزینی'),
  }
}

export async function saveMaintenanceAsset(input, store, now = new Date().toISOString()) {
  const asset = validateMaintenanceAsset(input)
  const rows = await store.get(MAINTENANCE_ASSETS_KEY) || []
  if (rows.some(row => row.assetTag.toLowerCase() === asset.assetTag.toLowerCase())) throw new Error('کد تجهیز تکراری است.')
  const saved = { ...asset, id: id('AST', now), createdAt: now }
  await store.set(MAINTENANCE_ASSETS_KEY, [saved, ...rows])
  return saved
}

export function validateMaintenanceOrder(input, assets = []) {
  const assetId = required(input.assetId, 'تجهیز')
  const asset = assets.find(row => row.id === assetId)
  if (!asset) throw new Error('تجهیز انتخاب‌شده در شناسنامه دارایی‌ها وجود ندارد.')
  const kind = String(input.kind || 'corrective')
  const status = String(input.status || 'planned')
  if (!['corrective', 'preventive', 'inspection'].includes(kind)) throw new Error('نوع دستورکار معتبر نیست.')
  if (!['planned', 'in-progress', 'completed', 'cancelled'].includes(status)) throw new Error('وضعیت دستورکار معتبر نیست.')
  const openedAt = date(input.openedAt, 'تاریخ شروع')
  const dueAt = input.dueAt ? date(input.dueAt, 'سررسید') : null
  const completedAt = input.completedAt ? date(input.completedAt, 'تاریخ تکمیل') : null
  if (completedAt && completedAt < openedAt) throw new Error('تاریخ تکمیل نمی‌تواند قبل از تاریخ شروع باشد.')
  if (status === 'completed' && !completedAt) throw new Error('برای دستورکار تکمیل‌شده، تاریخ تکمیل الزامی است.')
  return {
    assetId, assetTag: asset.assetTag, assetName: asset.name,
    orderNumber: required(input.orderNumber, 'شماره دستورکار'),
    kind, status, openedAt, dueAt, completedAt,
    downtimeHours: number(input.downtimeHours || 0, 'ساعات توقف'),
    repairHours: number(input.repairHours || 0, 'ساعات تعمیر'),
    laborHours: number(input.laborHours || 0, 'ساعات نیروی انسانی'),
    laborCost: number(input.laborCost || 0, 'هزینه نیروی انسانی'),
    materialCost: number(input.materialCost || 0, 'هزینه قطعات و مواد'),
    estimatedHours: number(input.estimatedHours || 0, 'ساعات برآوردی'),
    failureMode: String(input.failureMode || '').trim(),
    description: String(input.description || '').trim(),
  }
}

export async function saveMaintenanceOrder(input, store, now = new Date().toISOString()) {
  const assets = await store.get(MAINTENANCE_ASSETS_KEY) || []
  const order = validateMaintenanceOrder(input, assets)
  const rows = await store.get(MAINTENANCE_ORDERS_KEY) || []
  if (rows.some(row => row.orderNumber.toLowerCase() === order.orderNumber.toLowerCase())) throw new Error('شماره دستورکار تکراری است.')
  const saved = { ...order, id: id('WO', now), createdAt: now }
  await store.set(MAINTENANCE_ORDERS_KEY, [saved, ...rows])
  return saved
}

export function calculateAssetReliability({ asset, workOrders = [], operatingHours, startDate, endDate }) {
  if (!asset?.id) throw new Error('تجهیز برای محاسبه قابلیت اطمینان مشخص نشده است.')
  const hours = number(operatingHours, 'ساعات کارکرد')
  if (hours <= 0) throw new Error('ساعات کارکرد دوره باید بزرگ‌تر از صفر باشد.')
  const start = date(startDate, 'شروع دوره')
  const end = date(endDate, 'پایان دوره')
  if (end < start) throw new Error('پایان دوره نمی‌تواند قبل از شروع آن باشد.')
  const inPeriod = workOrders.filter(row => row.assetId === asset.id && row.openedAt >= start && row.openedAt <= end && row.status !== 'cancelled')
  const failures = inPeriod.filter(row => row.kind === 'corrective' && row.status === 'completed')
  const actual = inPeriod.filter(row => row.status === 'completed' || row.status === 'in-progress')
  const downtimeHours = actual.reduce((sum, row) => sum + row.downtimeHours, 0)
  const repairHours = failures.reduce((sum, row) => sum + row.repairHours, 0)
  const maintenanceCost = actual.reduce((sum, row) => sum + row.laborCost + row.materialCost, 0)
  const pmDue = inPeriod.filter(row => row.kind === 'preventive' && row.dueAt && row.dueAt <= end).length
  const pmCompleted = inPeriod.filter(row => row.kind === 'preventive' && row.status === 'completed' && row.dueAt && row.dueAt <= end).length
  const backlog = inPeriod.filter(row => row.status === 'planned' || row.status === 'in-progress')
  return {
    assetId: asset.id, assetTag: asset.assetTag, assetName: asset.name,
    startDate: start, endDate: end, operatingHours: hours,
    failureCount: failures.length, downtimeHours, repairHours,
    mtbfHours: failures.length ? hours / failures.length : null,
    mttrHours: failures.length ? repairHours / failures.length : null,
    availabilityPercent: hours / (hours + downtimeHours) * 100,
    maintenanceCost, pmDue, pmCompleted,
    pmCompliancePercent: pmDue ? pmCompleted / pmDue * 100 : null,
    backlogCount: backlog.length,
    backlogEstimatedHours: backlog.reduce((sum, row) => sum + row.estimatedHours, 0),
  }
}

export async function saveReliabilitySnapshot(input, store, now = new Date().toISOString()) {
  const assets = await store.get(MAINTENANCE_ASSETS_KEY) || []
  const asset = assets.find(row => row.id === input.assetId)
  const orders = await store.get(MAINTENANCE_ORDERS_KEY) || []
  const result = calculateAssetReliability({ ...input, asset, workOrders: orders })
  const rows = await store.get(MAINTENANCE_RELIABILITY_KEY) || []
  const saved = { ...result, id: id('REL', now), createdAt: now }
  await store.set(MAINTENANCE_RELIABILITY_KEY, [saved, ...rows].slice(0, 100))
  return saved
}

export async function updateMaintenanceOrderStatus(orderId, status, store, now = new Date().toISOString()) {
  if (!['planned', 'in-progress', 'completed', 'cancelled'].includes(status)) throw new Error('وضعیت دستورکار معتبر نیست.')
  const rows = await store.get(MAINTENANCE_ORDERS_KEY) || []
  const index = rows.findIndex(row => row.id === orderId)
  if (index < 0) throw new Error('دستورکار موردنظر پیدا نشد.')
  const current = rows[index]
  const updated = { ...current, status, completedAt: status === 'completed' ? (current.completedAt || now.slice(0, 10)) : current.completedAt, updatedAt: now }
  const next = [...rows]
  next[index] = updated
  await store.set(MAINTENANCE_ORDERS_KEY, next)
  return updated
}
