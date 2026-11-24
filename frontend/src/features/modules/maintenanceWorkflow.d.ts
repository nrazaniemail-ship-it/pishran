export type MaintenanceCriticality = 'low'|'medium'|'high'|'critical'
export type MaintenanceKind = 'corrective'|'preventive'|'inspection'
export type MaintenanceStatus = 'planned'|'in-progress'|'completed'|'cancelled'
export const MAINTENANCE_ASSETS_KEY: string
export const MAINTENANCE_ORDERS_KEY: string
export const MAINTENANCE_RELIABILITY_KEY: string
export function validateMaintenanceAsset(input: Record<string, unknown>): Record<string, unknown>
export function saveMaintenanceAsset(input: Record<string, unknown>, store: any, now?: string): Promise<any>
export function validateMaintenanceOrder(input: Record<string, unknown>, assets?: any[]): Record<string, unknown>
export function saveMaintenanceOrder(input: Record<string, unknown>, store: any, now?: string): Promise<any>
export function calculateAssetReliability(input: {asset:any;workOrders?:any[];operatingHours:number|string;startDate:string;endDate:string}): any
export function saveReliabilitySnapshot(input: {assetId:string;operatingHours:number|string;startDate:string;endDate:string}, store:any, now?:string): Promise<any>
export function updateMaintenanceOrderStatus(orderId:string,status:MaintenanceStatus,store:any,now?:string):Promise<any>
