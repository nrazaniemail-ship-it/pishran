/**
 * Item-level empty form drafts for COMFAR help-driven project modelling.
 * Every quantitative field is null until explicitly supplied by the analyst.
 */
import type { CommonFinancialItemMetadata } from './projectModelSchema'
import { HELP_FORM_SECTIONS, createBlankHelpDrivenProjectForms, validateHelpDrivenProjectForms, type HelpDrivenProjectForms } from './projectModelHelpForms'
const createBlankCommonFinancialItemMetadata=():CommonFinancialItemMetadata=>({description:'',currencyCode:null,marketOrigin:null,escalationPercent:null,remarks:'',costCentreId:null})

export type DepreciationMethod='linear-to-zero'|'linear-to-scrap'|'accelerated-declining-balance'|'sum-of-years-digits'
export type FixedAssetFormDraft={
 id:string; metadata:CommonFinancialItemMetadata; acquisitionPeriods:{period:string;quantity:number|null;unitPrice:number|null;total:number|null}[]
 depreciation:{method:DepreciationMethod|null;startMode:'production-start'|'specified-date'|null;startDate:string;firstDepreciationYearMonths:number|null;ratePercent:number|null;usefulLifeMonths:number|null;salvagePercent:number|null}
 disposal:{date:string;proceeds:number|null}|null
}
export function createBlankFixedAssetFormDraft(id=''):FixedAssetFormDraft{return{
 id,metadata:createBlankCommonFinancialItemMetadata(),acquisitionPeriods:[],
 depreciation:{method:null,startMode:null,startDate:'',firstDepreciationYearMonths:null,ratePercent:null,usefulLifeMonths:null,salvagePercent:null},disposal:null
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
export type LoanFeeBasis='each-positive-disbursement'|'outstanding-loan-including-current-disbursement-excluding-current-repayment'|'undisbursed-commitment'|'total-loan-at-first-disbursement'
export function resolveLoanFeeBasis(type:LoanFeeType):LoanFeeBasis{
 if(type==='agency')return 'each-positive-disbursement'
 if(type==='guarantee')return 'outstanding-loan-including-current-disbursement-excluding-current-repayment'
 if(type==='commitment')return 'undisbursed-commitment'
 return 'total-loan-at-first-disbursement'
}
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

export function deriveFixedVariableSplit(fixedPercent:number|null,variablePercent:number|null):{fixedPercent:number|null;variablePercent:number|null}{
 if(fixedPercent!==null&&variablePercent===null&&fixedPercent>=0&&fixedPercent<=100)return {fixedPercent,variablePercent:100-fixedPercent}
 if(variablePercent!==null&&fixedPercent===null&&variablePercent>=0&&variablePercent<=100)return {fixedPercent:100-variablePercent,variablePercent}
 return {fixedPercent,variablePercent}
}
export function validateProductionCostFormDraft(value:ProductionCostFormDraft):string[]{
 const errors:string[]=[]
 if(value.classification==='direct'&&!value.productId)errors.push('direct-cost-missing-product')
 if(value.classification==='indirect'&&value.productId)errors.push('indirect-cost-must-not-have-product')
 if(value.basis==='nominal-capacity'&&(!Number.isFinite(value.nominalCapacity)||!value.nominalCapacity||value.nominalCapacity<=0))errors.push('nominal-capacity-required')
 for(const [label,v] of [['fixed',value.fixedPercent],['variable',value.variablePercent]] as const)if(v!==null&&(!Number.isFinite(v)||v<0||v>100))errors.push('invalid-'+label+'-cost-percent')
 if(value.fixedPercent!==null&&value.variablePercent!==null&&Math.abs(value.fixedPercent+value.variablePercent-100)>1e-8)errors.push('fixed-variable-percentages-must-equal-100')
 for(const row of value.adjustments){
  if(row.fixedPercent!==null&&(!Number.isFinite(row.fixedPercent)||row.fixedPercent<0||row.fixedPercent>100))errors.push('invalid-adjustment-fixed-percent')
  if(row.variablePercent!==null&&(!Number.isFinite(row.variablePercent)||row.variablePercent<0||row.variablePercent>100))errors.push('invalid-adjustment-variable-percent')
  if(row.fixedPercent!==null&&row.variablePercent!==null&&Math.abs(row.fixedPercent+row.variablePercent-100)>1e-8)errors.push('adjustment-fixed-variable-percentages-must-equal-100')
 }
 return errors
}
export function validateFixedAssetFormDraft(value:FixedAssetFormDraft):string[]{
 const errors:string[]=[]
 const d=value.depreciation
 if(d.ratePercent!==null&&(!Number.isFinite(d.ratePercent)||d.ratePercent<0||d.ratePercent>100))errors.push('invalid-depreciation-rate')
 if(d.usefulLifeMonths!==null&&(!Number.isInteger(d.usefulLifeMonths)||d.usefulLifeMonths<=0))errors.push('invalid-useful-life-months')
 if(d.salvagePercent!==null&&(!Number.isFinite(d.salvagePercent)||d.salvagePercent<0||d.salvagePercent>100))errors.push('invalid-salvage-percent')
 if(d.firstDepreciationYearMonths!==null&&(!Number.isInteger(d.firstDepreciationYearMonths)||d.firstDepreciationYearMonths<1||d.firstDepreciationYearMonths>12))errors.push('invalid-first-depreciation-year-months')
 if(d.startMode==='specified-date'&&!d.startDate)errors.push('depreciation-start-date-required')
 if(d.method==='sum-of-years-digits'&&d.ratePercent!==null)errors.push('sum-of-years-digits-does-not-use-rate')
 for(const row of value.acquisitionPeriods){
  if(row.quantity!==null&&(!Number.isFinite(row.quantity)||row.quantity<0))errors.push('invalid-asset-acquisition-quantity')
  if(row.unitPrice!==null&&(!Number.isFinite(row.unitPrice)||row.unitPrice<0))errors.push('invalid-asset-acquisition-unit-price')
  if(row.total!==null&&(!Number.isFinite(row.total)||row.total<0))errors.push('invalid-asset-acquisition-total')
 }
 if(value.disposal?.proceeds!==null&&value.disposal?.proceeds!==undefined&&(!Number.isFinite(value.disposal.proceeds)||value.disposal.proceeds<0))errors.push('invalid-asset-disposal-proceeds')
 return errors
}
export function validateLoanFacilityFormDraft(value:LoanFacilityFormDraft):string[]{
 const errors:string[]=[]
 if(value.loanType==='profile'&&value.numberOfRepayments!==null)errors.push('profile-loan-uses-dated-movements')
 if(value.loanType!=='profile'&&value.loanType!==null&&value.numberOfRepayments!==null&&(!Number.isInteger(value.numberOfRepayments)||value.numberOfRepayments<=0))errors.push('invalid-number-of-repayments')
 if(value.capitalizedInterestPercent!==null&&(!Number.isFinite(value.capitalizedInterestPercent)||value.capitalizedInterestPercent<0||value.capitalizedInterestPercent>100))errors.push('invalid-capitalized-interest-percent')
 if(value.interestPaymentMonth!==null&&(!Number.isInteger(value.interestPaymentMonth)||value.interestPaymentMonth<1||value.interestPaymentMonth>12))errors.push('invalid-interest-payment-month')
 if(value.disbursements.some(row=>row.amount!==null&&(!Number.isFinite(row.amount)||row.amount<0)))errors.push('invalid-loan-disbursement')
 if(value.interestRateChanges.some(row=>row.annualRatePercent!==null&&(!Number.isFinite(row.annualRatePercent)||row.annualRatePercent<0)))errors.push('invalid-loan-interest-rate')
 if(value.fees.some(fee=>fee.type===null))errors.push('loan-fee-type-required')
 if(value.fees.some(fee=>fee.ratePercent!==null&&(!Number.isFinite(fee.ratePercent)||fee.ratePercent<0)))errors.push('invalid-loan-fee-rate')
 return errors
}


export type ProjectModelFinancialFormDrafts = {
 helpDriven: HelpDrivenProjectForms
 assets: FixedAssetFormDraft[]
 productionCosts: ProductionCostFormDraft[]
 sales: SalesProductFormDraft[]
 workingCapital: WorkingCapitalComponentFormDraft[]
 loans: LoanFacilityFormDraft[]
 tax: ProjectTaxFormDraft
}
export function createBlankProjectModelFinancialFormDrafts():ProjectModelFinancialFormDrafts {
 return {helpDriven:createBlankHelpDrivenProjectForms(),assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[],tax:createBlankProjectTaxFormDraft()}
}

const hasEnteredValue=(value:unknown):boolean=>{
 if(value===null||value===undefined||value==='')return false
 if(typeof value==='boolean')return true
 if(typeof value==='number')return Number.isFinite(value)
 if(Array.isArray(value))return value.some(hasEnteredValue)
 if(typeof value==='object')return Object.entries(value as Record<string,unknown>).some(([key,child])=>key!=='id'&&hasEnteredValue(child))
 return typeof value==='string'&&value.trim().length>0
}
/** Identify entered form values that are stored but are not yet bound to the financial engine. */
export function listUnintegratedFinancialDraftInputs(value:ProjectModelFinancialFormDrafts):string[]{
 const issues:string[]=[]
 const descriptiveProjectFields=new Set(['title','description','dateTime','status','projectType','analysisLevel'])
 for(const section of HELP_FORM_SECTIONS)for(const row of value.helpDriven?.sections?.[section.id]??[])for(const field of section.fields){
  if(section.id==='project-identification'&&descriptiveProjectFields.has(field.key))continue
  if(hasEnteredValue(row.values?.[field.key]))issues.push(section.id+'.'+row.id+'.'+field.key)
 }
 const collections:[string,unknown[]][]=[['financialForms.assets',value.assets],['financialForms.productionCosts',value.productionCosts],['financialForms.sales',value.sales],['financialForms.loans',value.loans]]
 // Working-capital component balances are bound to the periodic finance engine; do not block reports for these integrated rows.
 for(const [label,rows] of collections)for(const [index,row] of (rows??[]).entries())if(hasEnteredValue(row))issues.push(label+'.'+index)
 if(value.tax&&(value.tax.system!==null||value.tax.lossCarryForward!==null||value.tax.lossCarryForwardYears!==null||value.tax.rates.length||value.tax.allowances.length))issues.push('financialForms.tax')
 return issues
}


/** Convert internal integration-blocker paths into readable bilingual report messages. */
export function describeUnintegratedFinancialDraftInput(path:string,language:'fa'|'en'='fa'):string {
 const en=language==='en'
 const collection=/^financialForms\.(assets|productionCosts|sales|loans)\.(\d+)$/.exec(path)
 if(collection){
  const labels:Record<string,[string,string]> = {
   assets:['دارایی ثابت','Fixed asset'],
   productionCosts:['قلم هزینه تولید','Production-cost item'],
   sales:['برنامه فروش محصول','Product sales programme'],
   loans:['تسهیلات مالی','Loan facility'],
  }
  const label=labels[collection[1]]??['ورودی مالی','Financial input']
  return (en?label[1]:label[0])+' '+(Number(collection[2])+1)+' — '+(en?'not yet connected and validated in the calculation engine':'هنوز به موتور محاسبات متصل و اعتبارسنجی نشده است')
 }
 if(path==='financialForms.tax')return en?'Tax assumptions are not yet integrated and validated':'مفروضات مالیاتی هنوز به موتور محاسبات متصل و اعتبارسنجی نشده‌اند'
 const help=/^([a-z0-9-]+)\.([^.]+)\.([^.]+)$/.exec(path)
 if(help){
  const sections:Record<string,[string,string]> = {
   'production-costs':['هزینه‌های تولید','Production costs'],
   'sales-programme':['برنامه فروش','Sales programme'],
   'project-identification':['مشخصات پروژه','Project identification'],
  }
  const section=sections[help[1]]
  return (section?(en?section[1]:section[0]):help[1])+' · '+help[2]+' · '+help[3]+' — '+(en?'requires calculation-engine integration and validation':'نیازمند اتصال به موتور محاسبات و اعتبارسنجی است')
 }
 if(path.startsWith('financialForms.workingCapital:'))return en?'Working-capital schedule is invalid or incomplete':'برنامه سرمایه در گردش ناقص یا نامعتبر است'
 return path
}

export function validateProjectModelFinancialFormDrafts(value:ProjectModelFinancialFormDrafts):string[] {
 const errors:string[]=[]
 errors.push(...validateHelpDrivenProjectForms(value.helpDriven ?? createBlankHelpDrivenProjectForms()))
 value.assets.forEach((item,index)=>validateFixedAssetFormDraft(item).forEach(error=>errors.push('asset-'+index+':'+error)))
 value.productionCosts.forEach((item,index)=>validateProductionCostFormDraft(item).forEach(error=>errors.push('production-cost-'+index+':'+error)))
 value.loans.forEach((item,index)=>validateLoanFacilityFormDraft(item).forEach(error=>errors.push('loan-'+index+':'+error)))
 for(const [index,item] of value.workingCapital.entries()) {
  if(item.minimumDaysCoverage!==null&&(!Number.isFinite(item.minimumDaysCoverage)||item.minimumDaysCoverage<=0))errors.push('working-capital-'+index+':invalid-days-coverage')
  if(item.turnoverCoefficient!==null&&(!Number.isFinite(item.turnoverCoefficient)||item.turnoverCoefficient<0))errors.push('working-capital-'+index+':invalid-turnover')
 }
 for(const [index,row] of value.tax.rates.entries())if(row.ratePercent!==null&&(!Number.isFinite(row.ratePercent)||row.ratePercent<0||row.ratePercent>100))errors.push('tax-rate-'+index+':invalid-tax-rate')
 if(value.tax.lossCarryForwardYears!==null&&(!Number.isInteger(value.tax.lossCarryForwardYears)||value.tax.lossCarryForwardYears<0))errors.push('invalid-loss-carry-forward-years')
 return errors
}
