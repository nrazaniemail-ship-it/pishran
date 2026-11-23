const costKey = 'module-intelligence:MOD-02:v1'
const productionKey = 'module-intelligence:MOD-03:v1'

function newestValidReports(rows, moduleId) {
  if (!Array.isArray(rows)) return []
  return rows
    .filter(row =>
      row &&
      row.moduleId === moduleId &&
      row.metrics &&
      typeof row.metrics === 'object' &&
      (moduleId === 'MOD-02'
        ? ['unitCost', 'grossMarginPerTon', 'grossMarginPercent'].every(key => Number.isFinite(row.metrics[key]))
        : ['oee', 'availability', 'quality'].every(key => Number.isFinite(row.metrics[key]))) &&
      Number.isFinite(Date.parse(row.createdAt))
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
}

export async function loadExecutiveDashboardReports(store) {
  const [costRows, productionRows] = await Promise.all([
    store.get(costKey),
    store.get(productionKey),
  ])
  return {
    cost: newestValidReports(costRows, 'MOD-02'),
    production: newestValidReports(productionRows, 'MOD-03'),
  }
}
