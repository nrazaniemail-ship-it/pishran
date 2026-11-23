export type ModuleKpiInput = { name:string; unit:string; period:string; target:string|number; actual:string|number; direction:'higher'|'lower' }
export type ModuleKpiMetrics = { name:string; unit:string; period:string; target:number; actual:number; direction:'higher'|'lower'; variance:number; variancePercent:number; status:'on-target'|'favorable'|'unfavorable' }
export type ModuleKpiReport = ModuleKpiMetrics & { id:string; moduleId:'MOD-04'; createdAt:string }
export type ModuleKpiStore = { get<T>(key:string):Promise<T|undefined>; set<T>(key:string,value:T):Promise<void> }
export const KPI_HISTORY_KEY: string
export function calculateModuleKpi(input:ModuleKpiInput):ModuleKpiMetrics
export function executeModuleKpi(input:ModuleKpiInput,store:ModuleKpiStore,createdAt?:string):Promise<ModuleKpiReport>
