export type CostDashboardReport = {
  id: string
  moduleId: 'MOD-02'
  createdAt: string
  inputs: Record<string, string>
  metrics: Record<string, number>
}

export type ProductionDashboardReport = {
  id: string
  moduleId: 'MOD-03'
  createdAt: string
  inputs: Record<string, string>
  metrics: Record<string, number>
}

export type ExecutiveDashboardStore = {
  get<T>(key: string): Promise<T | undefined>
}

export function loadExecutiveDashboardReports(
  store: ExecutiveDashboardStore,
): Promise<{
  cost: CostDashboardReport[]
  production: ProductionDashboardReport[]
}>
