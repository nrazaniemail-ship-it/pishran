export type EnergyResource='electricity'|'gas'|'water'
export type EnergyRecordInput={resource:EnergyResource;period:string;site:string;seu:string;meterId?:string;consumption:string|number;production:string|number;operatingHours?:string|number;cost:string|number;startReading?:string|number;endReading?:string|number;calorificValue?:string|number;calorificBasis?:'gross'|'net';gasReferenceConditions?:string;sourceBillId?:string;sourceBillNumber?:string;note?:string;dataQuality?:'measured'|'estimated'}
export type EnergyBaselineInput={resource:EnergyResource;period:string;site:string;seu:string;consumption:string|number;production:string|number;calorificValue?:string|number;calorificBasis?:'gross'|'net';gasReferenceConditions?:string}
export type EnergyActionInput={title:string;resource:EnergyResource;owner:string;dueDate:string;expectedSavings:string|number;status?:'planned'|'in-progress'|'cancelled'}
export type EnergyStore={get<T>(key:string):Promise<T|undefined>;set<T>(key:string,value:T):Promise<void>;update<T>(key:string,fn:(old:T|undefined)=>T):Promise<T>}
export const ENERGY_DATA_KEY:string
export const ENERGY_BASELINES_KEY:string
export const ENERGY_ACTIONS_KEY:string
export const RESOURCE_CONFIG:Record<EnergyResource,{unit:string;factorUnit:string}>
export function validateEnergyRecord(i:EnergyRecordInput):any
export function calculateEnergyPerformance(i:{resource:EnergyResource;baseline:{resource?:EnergyResource;site?:string;seu?:string;consumption:number;production:number;gasEnergyKwh?:number|null;calorificBasis?:'gross'|'net'|null;gasReferenceConditions?:string|null};actual:{resource?:EnergyResource;site?:string;seu?:string;consumption:number;production:number;gasEnergyKwh?:number|null;calorificBasis?:'gross'|'net'|null;gasReferenceConditions?:string|null}}):any
export function saveEnergyRecord(i:EnergyRecordInput,s:EnergyStore,d?:string):Promise<any>
export function saveEnergyBaseline(i:EnergyBaselineInput,s:EnergyStore,d?:string):Promise<any>
export function saveEnergyAction(i:EnergyActionInput,s:EnergyStore,d?:string):Promise<any>
export function updateEnergyActionStatus(id:string,status:string,s:EnergyStore,verification?:{period:string;measuredSavings:string|number;verifier:string;evidenceNote:string}):Promise<boolean>

export const WATER_BALANCE_KEY:string
export const ENERGY_COST_ALLOCATIONS_KEY:string
export function analyzeGasUtility(input:{consumptionNm3:string|number;calorificValueKwhPerNm3:string|number;productionTon:string|number;cost?:string|number|null}):{volumeNm3:number;energyKwh:number;energyGJ:number;specificVolumeNm3PerTon:number;specificEnergyKwhPerTon:number;costPerGJ:number|null}
export function analyzeWaterBalance(input:{freshwaterM3?:string|number;municipalWaterM3?:string|number;groundwaterM3?:string|number;surfaceWaterM3?:string|number;otherFreshwaterM3?:string|number;externalReuseM3?:string|number;internalRecirculationM3?:string|number;dischargeM3?:string|number;evaporationM3?:string|number;productIncorporationM3?:string|number;inventoryIncreaseM3?:string|number;productionTon:string|number}):any
export function saveWaterBalance(input:Parameters<typeof analyzeWaterBalance>[0]&{period:string;site:string;seu:string},store:EnergyStore,createdAt?:string):Promise<any>

export function analyzeEnergyTrends(records:any[],filters?:{resource?:EnergyResource;site?:string;seu?:string}):{count:number;points:any[];warnings:string[]}
export function allocateElectricityBillCost(input:{bill:{id?:string;billNumber?:string;period?:string;amount:number|string;energyCharge?:number|string|null;demandCharge?:number|string|null;reactiveCharge?:number|string|null;taxCharge?:number|string|null};consumers:Array<{id?:string;name?:string;consumptionKwh:number|string;peakDemandKw?:number|string;reactiveKvarh?:number|string;productionTon?:number|string}>}):any
export function prepareModule02EnergyCostPosting(input:{baseInput:Record<string,string|number>;allocation:any;costCenterId:string}):{input:Record<string,string|number>;sourceReferences:Record<string,string|number>;duplicatePostingGuard:string}

export type EnergyActionStatusHistory={from:string|null;to:'planned'|'in-progress'|'verified'|'cancelled';changedAt:string;verifier:string|null}
export type EnergyVerificationEvidence={period:string;measuredSavings:number;verifier:string;evidenceNote:string;verifiedAt:string}
export type EnergyActionAudit={statusHistory:EnergyActionStatusHistory[];verificationHistory:Array<EnergyVerificationEvidence&{supersededAt:string}>}

export function analyzeMultivariableEnergyNormalization(records:any[],filters?:{resource:EnergyResource;site?:string;seu?:string}):{results:Array<{site:string;seu:string;resource:EnergyResource;comparisonBasis:string;comparisonUnit:string;trainingPeriods:string[];actualPeriod:string;actualConsumption:number;normalizedConsumption:number;adjustedSavings:number;adjustedSavingsPercent:number;rSquared:number|null;rmse:number;coefficients:{intercept:number;production:number;operatingHours:number};warnings:string[]}>;warnings:string[]}


export const METER_CALIBRATIONS_KEY:string
export const ENERGY_MV_EVIDENCE_KEY:string
export type MeterCalibrationInput={id?:string;meterId:string;site:string;parameter:string;unit:string;intervalDays:string|number;lastCalibrationDate:string;certificateRef:string;provider:string;owner?:string;accuracy?:string|number;measurementRange?:string;notes?:string}
export type MeterCalibrationRecord={id:string;meterId:string;site:string;parameter:string;unit:string;intervalDays:number;lastCalibrationDate:string;nextCalibrationDate:string;certificateRef:string;provider:string;owner:string;accuracy:number|null;measurementRange:string;notes:string;status:'valid'|'due-soon'|'overdue';daysUntilDue:number;createdAt:string;updatedAt:string;history:any[]}
export function validateMeterCalibration(input:MeterCalibrationInput,asOf?:string):Omit<MeterCalibrationRecord,'id'|'createdAt'|'updatedAt'|'history'>
export function getMeterCalibrationStatus(record:{nextCalibrationDate:string},asOf?:string,dueSoonDays?:number):{status:'valid'|'due-soon'|'overdue';daysUntilDue:number;nextCalibrationDate:string}
export function listMeterCalibrationAlerts(records:MeterCalibrationRecord[],asOf?:string,dueSoonDays?:number):MeterCalibrationRecord[]
export function saveMeterCalibration(input:MeterCalibrationInput,store:EnergyStore,createdAt?:string):Promise<MeterCalibrationRecord>
export type EnergyMvEvidenceInput={resource:EnergyResource;baselineId:string;actualRecordIds:string[];method:string;verifier:string;measurementBoundary:string;boundaryConfirmed:boolean;adjustmentNotes:string;evidenceReferences:string;baselineUncertaintyPct:string|number;actualUncertaintyPct:string|number;modelUncertaintyPct?:string|number;coverageFactor?:string|number;evidenceAttachments?:Array<{name:string;mimeType:string;size:number;lastModified?:number;dataUrl:string}>}
export type EnergyMvEvidencePack={id:string;generatedAt:string;resource:EnergyResource;site:string;seu:string;baseline:any;actualRecordIds:string[];periods:string[];method:string;verifier:string;measurementBoundary:string;boundaryConfirmed:boolean;adjustmentNotes:string;evidenceReferences:string;calculations:any[];normalizedBaseline:number;actualConsumption:number;comparisonUnit:string;calculatedVariance:number;calculatedVariancePercent:number;uncertaintyBudget:{baselineUncertaintyPct:number;actualUncertaintyPct:number;modelUncertaintyPct:number;baselineUncertainty:number;actualUncertainty:number;modelUncertainty:number;combinedStandardUncertainty:number;coverageFactor:number;expandedUncertainty:number;lowerBound:number;upperBound:number;conclusion:string;interpretation:string};evidenceAttachments:Array<{name:string;mimeType:string;size:number;lastModified?:number;dataUrl:string}>;calibrationCoverage:Array<{recordId:string;period:string;meterId:string;site:string;calibrationId:string|null;status:string;nextCalibrationDate:string|null}>;warnings:string[];reviewStatus:'prepared-not-independent-review';limitations:string[]}
export function buildEnergyMvEvidencePack(input:EnergyMvEvidenceInput,context:{rows:any[];baselines:any[];calibrations:MeterCalibrationRecord[]},generatedAt?:string):EnergyMvEvidencePack
export function saveEnergyMvEvidencePack(input:EnergyMvEvidenceInput,context:{rows:any[];baselines:any[];calibrations:MeterCalibrationRecord[]},store:EnergyStore,generatedAt?:string):Promise<EnergyMvEvidencePack>


export const ENERGY_TARIFF_CONTRACTS_KEY:string
export const ENERGY_TARIFF_CALCULATIONS_KEY:string
export type EnergyTariffTier={upperLimit:number|null;rate:number;order?:number}
export type EnergyTariffContractInput={id?:string;resource:EnergyResource;site:string;supplier:string;contractNumber:string;currency:string;effectiveFrom:string;effectiveTo?:string;unit?:string;energyRate?:string|number|null;fixedCharge?:string|number;demandRate?:string|number;reactiveRate?:string|number;taxPercent?:string|number;tiers?:EnergyTariffTier[];tiersText?:string;notes?:string}
export type EnergyTariffContract=ReturnType<typeof validateEnergyTariffContract>&{id:string;createdAt:string;updatedAt:string;history:any[]}
export function parseEnergyTariffTiers(text:string):EnergyTariffTier[]
export function validateEnergyTariffContract(input:EnergyTariffContractInput,asOf?:string):Omit<EnergyTariffContract,'id'|'createdAt'|'updatedAt'|'history'>
export function saveEnergyTariffContract(input:EnergyTariffContractInput,store:EnergyStore,createdAt?:string):Promise<EnergyTariffContract>
export type EnergyTariffCalculationInput={contractId:string;resource:EnergyResource;site:string;period:string;quantity:string|number;demand?:string|number;reactive?:string|number}
export type EnergyTariffCalculation={id:string;contractId:string;resource:EnergyResource;site:string;period:string;supplier:string;contractNumber:string;currency:string;unit:string;quantity:number;demand:number;reactive:number;energyCharge:number;demandCharge:number;reactiveCharge:number;fixedCharge:number;subtotal:number;taxPercent:number;tax:number;total:number;calculatedAt:string;source:string;warnings:string[]}
export function calculateConfiguredEnergyTariff(input:EnergyTariffCalculationInput,context:{contracts:EnergyTariffContract[]},calculatedAt?:string):EnergyTariffCalculation
export function saveEnergyTariffCalculation(input:EnergyTariffCalculationInput,context:{contracts:EnergyTariffContract[]},store:EnergyStore,calculatedAt?:string):Promise<EnergyTariffCalculation>
