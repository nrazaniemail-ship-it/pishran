export const KPI_HISTORY_KEY = 'module-intelligence:MOD-04:v1'

const toNumber = value => String(value ?? '').trim() === '' ? Number.NaN : Number(value)

export function calculateModuleKpi(input) {
  const target = toNumber(input.target)
  const actual = toNumber(input.actual)
  if (!String(input.name ?? '').trim()) throw new Error('نام شاخص را وارد کنید.')
  if (!String(input.period ?? '').trim()) throw new Error('دوره گزارش را وارد کنید.')
  if (!String(input.unit ?? '').trim()) throw new Error('واحد شاخص را وارد کنید.')
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual) || actual < 0) {
    throw new Error('هدف باید بزرگ‌تر از صفر و عملکرد واقعی باید عددی غیرمنفی باشد.')
  }
  if (input.direction !== 'higher' && input.direction !== 'lower') throw new Error('جهت مطلوب شاخص را مشخص کنید.')
  const variance = actual - target
  const variancePercent = variance / target * 100
  const favorable = input.direction === 'higher' ? variance >= 0 : variance <= 0
  return {
    name: String(input.name).trim(),
    unit: String(input.unit).trim(),
    period: String(input.period).trim(),
    target,
    actual,
    direction: input.direction,
    variance,
    variancePercent,
    status: variance === 0 ? 'on-target' : favorable ? 'favorable' : 'unfavorable',
  }
}

export async function executeModuleKpi(input, store, createdAt = new Date().toISOString()) {
  const metrics = calculateModuleKpi(input)
  const previous = await store.get(KPI_HISTORY_KEY)
  const history = Array.isArray(previous) ? previous : []
  const saved = { id: `MOD-04-${Date.parse(createdAt)}`, moduleId: 'MOD-04', createdAt, ...metrics }
  await store.set(KPI_HISTORY_KEY, [saved, ...history].slice(0, 50))
  return saved
}
