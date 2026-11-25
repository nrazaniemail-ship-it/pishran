export type OeeInput={shiftMinutes:string;breakMinutes:string;downtimeMinutes:string;idealCycleSeconds:string;totalCount:string;rejectCount:string;plannedMinutes?:string;goodCount?:string}
export function calculateOee(input:OeeInput):{shiftMinutes:number|null;breakMinutes:number;plannedMinutes:number;downtimeMinutes:number;runMinutes:number;availability:number;performance:number;quality:number;oee:number;directOee:number;variance:number;idealProduction:number;goodProductionRate:number;totalCount:number;goodCount:number;rejectCount:number;warnings:string[]}
export function aggregateLineOee(input:OeeInput):ReturnType<typeof calculateOee>
export function calculateStationOees<T extends {id:string;name:string}&OeeInput>(stations:T[]):Array<T&{result:ReturnType<typeof calculateOee> }>
export function summarizeLosses(events:Array<{category:string;minutes:number}>):Array<{id:string;fa:string;en:string;group:string;minutes:number}>
export const OEE_STORAGE_KEY:string
export const OEE_LOSS_CATEGORIES:Array<{id:string;fa:string;en:string;group:string}>
export function saveOeeAnalysis(store:{get<T>(key:string):Promise<T|undefined>;set<T>(key:string,value:T):Promise<void>},record:Record<string,any>):Promise<Record<string,any>>
