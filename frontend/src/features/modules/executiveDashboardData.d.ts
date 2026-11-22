export type ExecutiveDashboardReport = {
  id: string
  moduleId: 'MOD-02' | 'MOD-03'
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
  cost: ExecutiveDashboardReport[]
  production: ExecutiveDashboardReport[]
}>
