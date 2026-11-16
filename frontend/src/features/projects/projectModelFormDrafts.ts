/**
 * Item-level empty form drafts for COMFAR help-driven project modelling.
 * Every quantitative field is null until explicitly supplied by the analyst.
 */
import { createBlankCommonFinancialItemMetadata, type CommonFinancialItemMetadata } from './projectModelSchema'

export type DepreciationMethod='linear-to-zero'|'linear-to-scrap'|'accelerated-declining-balance'|'sum-of-years-digits'
export type FixedAssetFormDraft={
 id:string; metadata:CommonFinancialItemMetadata; acquisitionPeriods:{period:string;quantity:number|null;unitPrice:number|null;total:number|null}[]
 depreciation:{method:DepreciationMethod|null;startDate:string;ratePercent:number|null;usefulLifeMonths:number|null;salvageValue:number|null}
 disposal:{date:string;proceeds:number|null}|null
}
export function createBlankFixedAssetFormDraft(id=''):FixedAssetFormDraft{return{
 id,metadata:createBlankCommonFinancialItemMetadata(),acquisitionPeriods:[],
 depreciation:{method:null,startDate:'',ratePercent:null,usefulLifeMonths:null,salvageValue:null},disposal:null
}}

export type ProductionCostFormDraft={
 id:string; metadata:CommonFinancialItemMetadata; classification:'direct'|'indirect'|null
 productId:string|null; basis:'nominal-capacity'|'per-unit-output'|'period-adjustments'|null
 standardQuantity:number|null; standardUnitPrice:number|null; standardTotal:number|null
 nominalCapacity:number|null; fixedPercent:number|null; variablePercent:number|null
 adjustments:{period:string;quantity:number|null;unitPrice:number|null;total:number|null;fixedPercent:number|null;variablePercent:number|null}[]
}
export function createBlankProductionCostFormDraft(id=''):ProductionCostFormDraft{return{
 id,metadata:createBlankCommonFinancialItemMetadata(),classification:null,productId:null,basis:null,
 standardQuantity:null,standardUnitPrice:null,standardTotal:null,nominalCapacity:null,fixedPercent:null,variablePercent:null,adjustments:[]
}}

export type SalesProductFormDraft={
 productId:string
 periods:{period:string;salesQuantity:number|null;netUnitPrice:number|null;salesTaxPercent:number|null;subsidyPercent:number|null;subsidyAmount:number|null;finishedGoodsClosingQuantity:number|null}[]
}
export function createBlankSalesProductFormDraft(productId=''):SalesProductFormDraft{return{productId,periods:[]}}

export type WorkingCapitalComponentFormDraft={
 id:string; name:string; category:'inventory'|'work-in-progress'|'finished-goods'|'receivables'|'cash'|'payables'|'other-current-asset'|'other-current-liability'|null
 minimumDaysCoverage:number|null; turnoverCoefficient:number|null; valuationBasis:'cost-of-production'|'cost-of-sales'|'sales-revenue'|'user-defined'|null
 periodBalances:{period:string;amount:number|null}[]
}
export function createBlankWorkingCapitalComponentFormDraft(id=''):WorkingCapitalComponentFormDraft{return{
 id,name:'',category:null,minimumDaysCoverage:null,turnoverCoefficient:null,valuationBasis:null,periodBalances:[]
}}
/** COMFAR reference uses a 360-day year for days coverage / turnover. */
export function deriveWorkingCapitalTurnover(daysCoverage:number|null,periodDays=360):number|null{
 if(daysCoverage===null||!Number.isFinite(daysCoverage)||daysCoverage<=0||!Number.isFinite(periodDays)||periodDays<=0)return null
 return (360/daysCoverage)*(periodDays/360)
}

export type LoanFeeType='agency'|'guarantee'|'commitment'|'other'
export type LoanFacilityFormDraft={
 id:string; name:string; currencyCode:string|null; marketOrigin:'local'|'foreign'|null
 loanType:'annuity'|'constant-principal'|'profile'|null
 repaymentInterval:'annual'|'semiannual'|'quarterly'|'monthly'|null
 firstRepaymentDate:string; numberOfRepayments:number|null
 disbursements:{date:string;amount:number|null}[]
 profileMovements:{date:string;amount:number|null}[]
 interestRateChanges:{effectiveDate:string;annualRatePercent:number|null}[]
 interestPaymentMonth:number|null
 capitalizedInterestPercent:number|null; capitalizeUntilDate:string
 fees:{id:string;type:LoanFeeType|null;ratePercent:number|null;currencyCode:string|null}[]
}
export function createBlankLoanFacilityFormDraft(id=''):LoanFacilityFormDraft{return{
 id,name:'',currencyCode:null,marketOrigin:null,loanType:null,repaymentInterval:null,firstRepaymentDate:'',numberOfRepayments:null,
 disbursements:[],profileMovements:[],interestRateChanges:[],interestPaymentMonth:null,
 capitalizedInterestPercent:null,capitalizeUntilDate:'',fees:[]
}}

export type ProjectTaxFormDraft={
 system:'corporate'|'none'|'custom'|null
 rates:{period:string;ratePercent:number|null}[]
 allowances:{id:string;name:string;periodAmounts:{period:string;amount:number|null}[]}[]
 lossCarryForward:boolean|null;lossCarryForwardYears:number|null
}
export function createBlankProjectTaxFormDraft():ProjectTaxFormDraft{return{
 system:null,rates:[],allowances:[],lossCarryForward:null,lossCarryForwardYears:null
}}

export function validateProductionCostFormDraft(value:ProductionCostFormDraft):string[]{
 const errors:string[]=[]
 if(value.classification==='direct'&&!value.productId)errors.push('direct-cost-missing-product')
 if(value.classification==='indirect'&&value.productId)errors.push('indirect-cost-must-not-have-product')
 if(value.basis==='nominal-capacity'&&(!value.nominalCapacity||value.nominalCapacity<=0))errors.push('nominal-capacity-required')
 if(value.fixedPercent!==null&&value.variablePercent!==null&&Math.abs(value.fixedPercent+value.variablePercent-100)>1e-8)errors.push('fixed-variable-percentages-must-equal-100')
 for(const row of value.adjustments)if(row.fixedPercent!==null&&row.variablePercent!==null&&Math.abs(row.fixedPercent+row.variablePercent-100)>1e-8)errors.push('adjustment-fixed-variable-percentages-must-equal-100')
 return errors
}
export function validateFixedAssetFormDraft(value:FixedAssetFormDraft):string[]{
 const errors:string[]=[]
 const d=value.depreciation
 if(d.ratePercent!==null&&(!Number.isFinite(d.ratePercent)||d.ratePercent<0||d.ratePercent>100))errors.push('invalid-depreciation-rate')
 if(d.usefulLifeMonths!==null&&(!Number.isInteger(d.usefulLifeMonths)||d.usefulLifeMonths<=0))errors.push('invalid-useful-life-months')
 if(d.salvageValue!==null&&(!Number.isFinite(d.salvageValue)||d.salvageValue<0))errors.push('invalid-salvage-value')
 if(d.method==='sum-of-years-digits'&&d.ratePercent!==null)errors.push('sum-of-years-digits-does-not-use-rate')
 return errors
}
export function validateLoanFacilityFormDraft(value:LoanFacilityFormDraft):string[]{
 const errors:string[]=[]
 if(value.loanType==='profile'&&value.numberOfRepayments!==null)errors.push('profile-loan-uses-dated-movements')
 if(value.loanType!=='profile'&&value.loanType!==null&&value.numberOfRepayments!==null&&(!Number.isInteger(value.numberOfRepayments)||value.numberOfRepayments<=0))errors.push('invalid-number-of-repayments')
 if(value.capitalizedInterestPercent!==null&&(!Number.isFinite(value.capitalizedInterestPercent)||value.capitalizedInterestPercent<0||value.capitalizedInterestPercent>100))errors.push('invalid-capitalized-interest-percent')
 if(value.interestPaymentMonth!==null&&(!Number.isInteger(value.interestPaymentMonth)||value.interestPaymentMonth<1||value.interestPaymentMonth>12))errors.push('invalid-interest-payment-month')
 if(value.fees.some(fee=>fee.ratePercent!==null&&(!Number.isFinite(fee.ratePercent)||fee.ratePercent<0)))errors.push('invalid-loan-fee-rate')
 return errors
}
