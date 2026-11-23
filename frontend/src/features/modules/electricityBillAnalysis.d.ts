export type ElectricityBillRecord = {
 period?:string;billNumber?:string;accountNumber?:string;paymentId?:string;meterNumber?:string;
 previousReading?:number|null;currentReading?:number|null;consumption?:number|null;billingDays?:number|null;
 demand?:number|null;contractDemand?:number|null;reactiveEnergy?:number|null;powerFactor?:number|null;
 peakConsumption?:number|null;midConsumption?:number|null;offPeakConsumption?:number|null;
 energyCharge?:number|null;demandCharge?:number|null;reactiveCharge?:number|null;taxCharge?:number|null;
 multiplier?:number|null;tariff?:string;voltage?:string;amount?:number|null;dueDate?:string;
 production?:number|null;ocrConfidence?:number;createdAt?:string;
}
export function normalizeBillDigits(value?:string):string
export function parseElectricityBillText(sourceText?:string):Partial<ElectricityBillRecord>
export function analyzeElectricityBill(bill:ElectricityBillRecord,history?:ElectricityBillRecord[]):{
 daily:number|null;previousDaily:number|null;dailyChange:number|null;previousBill:ElectricityBillRecord|null;
 readingDelta:number|null;specificConsumption:number|null;amountPerKwh:number|null;demandRatio:number|null;
 componentTotal:number|null;warnings:string[]
}
