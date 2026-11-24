export type EnergyResource='electricity'|'gas'|'water'
export type EnergyRecordInput={resource:EnergyResource;period:string;site:string;seu:string;meterId?:string;consumption:string|number;production:string|number;cost:string|number;startReading?:string|number;endReading?:string|number;calorificValue?:string|number;calorificBasis?:'gross'|'net';gasReferenceConditions?:string;sourceBillId?:string;sourceBillNumber?:string;note?:string;dataQuality?:'measured'|'estimated'}
export type EnergyBaselineInput={resource:EnergyResource;period:string;site:string;seu:string;consumption:string|number;production:string|number;calorificValue?:string|number;calorificBasis?:'gross'|'net';gasReferenceConditions?:string}
export type EnergyActionInput={title:string;resource:EnergyResource;owner:string;dueDate:string;expectedSavings:string|number;status?:string}
export type EnergyStore={get<T>(key:string):Promise<T|undefined>;set<T>(key:string,value:T):Promise<void>;update<T>(key:string,fn:(old:T|undefined)=>T):Promise<T>}
export const ENERGY_DATA_KEY:string
export const ENERGY_BASELINES_KEY:string
export const ENERGY_ACTIONS_KEY:string
export const RESOURCE_CONFIG:Record<EnergyResource,{unit:string;factorUnit:string}>
export function validateEnergyRecord(i:EnergyRecordInput):any
export function calculateEnergyPerformance(i:{resource:EnergyResource;baseline:{consumption:number;production:number;gasEnergyKwh?:number|null;calorificBasis?:'gross'|'net'|null;gasReferenceConditions?:string|null};actual:{consumption:number;production:number;gasEnergyKwh?:number|null;calorificBasis?:'gross'|'net'|null;gasReferenceConditions?:string|null}}):any
export function saveEnergyRecord(i:EnergyRecordInput,s:EnergyStore,d?:string):Promise<any>
export function saveEnergyBaseline(i:EnergyBaselineInput,s:EnergyStore,d?:string):Promise<any>
export function saveEnergyAction(i:EnergyActionInput,s:EnergyStore,d?:string):Promise<any>
export function updateEnergyActionStatus(id:string,status:string,s:EnergyStore):Promise<boolean>

export const WATER_BALANCE_KEY:string
export const ENERGY_COST_ALLOCATIONS_KEY:string
export function analyzeGasUtility(input:{consumptionNm3:string|number;calorificValueKwhPerNm3:string|number;productionTon:string|number;cost?:string|number|null}):{volumeNm3:number;energyKwh:number;energyGJ:number;specificVolumeNm3PerTon:number;specificEnergyKwhPerTon:number;costPerGJ:number|null}
export function analyzeWaterBalance(input:{freshwaterM3?:string|number;municipalWaterM3?:string|number;groundwaterM3?:string|number;surfaceWaterM3?:string|number;otherFreshwaterM3?:string|number;externalReuseM3?:string|number;internalRecirculationM3?:string|number;dischargeM3?:string|number;evaporationM3?:string|number;productIncorporationM3?:string|number;inventoryIncreaseM3?:string|number;productionTon:string|number}):any
export function saveWaterBalance(input:Parameters<typeof analyzeWaterBalance>[0],store:EnergyStore,createdAt?:string):Promise<any>

export function analyzeEnergyTrends(records:any[],filters?:{resource?:EnergyResource;site?:string;seu?:string}):{count:number;points:any[];warnings:string[]}
export function allocateElectricityBillCost(input:{bill:{id?:string;billNumber?:string;period?:string;amount:number|string;energyCharge?:number|string|null;demandCharge?:number|string|null;reactiveCharge?:number|string|null;taxCharge?:number|string|null};consumers:Array<{id?:string;name?:string;consumptionKwh:number|string;peakDemandKw?:number|string;reactiveKvarh?:number|string;productionTon?:number|string}>}):any
export function prepareModule02EnergyCostPosting(input:{baseInput:Record<string,string|number>;allocation:any;costCenterId:string}):{input:Record<string,string|number>;sourceReferences:Record<string,string|number>;duplicatePostingGuard:string}
