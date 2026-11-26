/**
 * Item-level empty form drafts for COMFAR help-driven project modelling.
 * Every quantitative field is null until explicitly supplied by the analyst.
 */
import type { CommonFinancialItemMetadata } from './projectModelSchema'
import type { CppCpsTraceItem } from './cppCpsCostTraceability'
import type { WasteLedgerEntry, ProductionTransferEntry, InventoryReferenceBenchmarkEntry } from './inventoryControlLedgers'
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

export type ProductionBridgeLinkFormDraft={sourceProductId:string;destinationProductId:string;sourceCostCentreId:string;destinationCostCentreId:string;sourceUnit:string;destinationUnit:string;conversionFactor:number|null}
export type ProductionBridgeEvidenceFormDraft={sourceReference:string;sourceVerified:boolean;rawMaterialsToWip:ProductionBridgeLinkFormDraft;wipToFinishedGoods:ProductionBridgeLinkFormDraft}
export function createBlankProductionBridgeEvidenceFormDraft():ProductionBridgeEvidenceFormDraft {
 const blankLink=():ProductionBridgeLinkFormDraft=>({sourceProductId:'',destinationProductId:'',sourceCostCentreId:'',destinationCostCentreId:'',sourceUnit:'',destinationUnit:'',conversionFactor:null})
 return {sourceReference:'',sourceVerified:false,rawMaterialsToWip:blankLink(),wipToFinishedGoods:blankLink()}
}

export type SalesProductFormDraft={
 productId:string
 unitOfMeasure?:string
 inventoryPolicy:'manual'|'comfar-days-coverage'|null
 finishedGoodsDaysCoverage:number|null
 productionStartPeriod:number|null
 productionEndPeriod:number|null
 periods:{period:string;salesQuantity:number|null;netUnitPrice:number|null;salesTaxPercent:number|null;salesTaxSourceReference?:string;salesTaxSourceVerified?:boolean;subsidyPercent:number|null;subsidyAmount:number|null;openingFinishedGoodsQuantity:number|null;openingFinishedGoodsValue:number|null;finishedGoodsClosingQuantity:number|null;rawMaterialPurchasesQuantity:number|null;rawMaterialPurchasesValue:number|null;rawMaterialConsumptionQuantity:number|null;normalRawMaterialWasteQuantity:number|null;abnormalRawMaterialWasteQuantity:number|null;abnormalWasteSourceReference?:string;abnormalWasteSourceVerified?:boolean;unitsStarted:number|null;unitsCompleted:number|null;closingWipQuantity:number|null;materialCompletionPercent:number|null;conversionCompletionPercent:number|null;conversionCost:number|null;openingRawMaterialQuantity:number|null;openingRawMaterialValue:number|null;openingWipQuantity:number|null;openingWipMaterialValue:number|null;openingWipConversionValue:number|null;productionBridgeEvidence?:ProductionBridgeEvidenceFormDraft}[]
}
export function createBlankSalesProductFormDraft(productId=''):SalesProductFormDraft{return{productId,unitOfMeasure:'',inventoryPolicy:null,finishedGoodsDaysCoverage:null,productionStartPeriod:null,productionEndPeriod:null,periods:[]}}

export type SalesTaxInputCreditFormDraft={id:string;period:number|null;taxAmount:number|null;sourceReference:string;sourceVerified:boolean}
export type SalesTaxSettlementFormDraft={period:number|null;amount:number|null;sourceReference:string;sourceVerified:boolean}
export type SalesTaxLedgerFormDraft={openingBalance:number|null;inputCredits:SalesTaxInputCreditFormDraft[];settlements:SalesTaxSettlementFormDraft[]}
export function createBlankSalesTaxLedgerFormDraft():SalesTaxLedgerFormDraft{return{openingBalance:null,inputCredits:[],settlements:[]}}

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
 annualRatePercent:number|null; openingBalance:number|null; openingExchangeRateToLocal:number|null; gracePeriods:number|null; interestConvention:'comfar-months-plus-360'|'actual-360'|'actual-365'|null
 loanType:'annuity'|'constant-principal'|'profile'|null
 repaymentInterval:'annual'|'semiannual'|'quarterly'|'monthly'|null
 firstRepaymentDate:string; numberOfRepayments:number|null
 disbursements:{date:string;amount:number|null}[]
 profileMovements:{date:string;amount:number|null}[]
 interestRateChanges:{effectiveDate:string;annualRatePercent:number|null}[]
 interestPaymentMonth:number|null
 capitalizedInterestPercent:number|null; capitalizeUntilDate:string
 fees:{id:string;type:LoanFeeType|null;ratePercent:number|null;currencyCode:string|null}[]
 manualPeriodSchedule?:{period:string;drawdown:number;principal:number;interestExpense:number;capitalizedInterest:number;closingBalance:number}[]
}
export function createBlankLoanFacilityFormDraft(id=''):LoanFacilityFormDraft{return{
 id,name:'',currencyCode:null,marketOrigin:null,annualRatePercent:null,openingBalance:null,openingExchangeRateToLocal:null,gracePeriods:null,interestConvention:null,loanType:null,repaymentInterval:null,firstRepaymentDate:'',numberOfRepayments:null,
 disbursements:[],profileMovements:[],interestRateChanges:[],interestPaymentMonth:null,
 capitalizedInterestPercent:null,capitalizeUntilDate:'',fees:[]
}}

export type ProjectTaxFormDraft={
 system:'corporate'|'none'|'custom'|null
 rates:{period:string;ratePercent:number|null}[]
 /** Final tax payable amounts transcribed from a source report; never inferred from a rate. */
 documentedAmounts?:{period:string;amount:number|null;sourceReference:string;sourceVerified:boolean}[]
 allowances:{id:string;name:string;treatment:'deduction'|'credit'|null;periodAmounts:{period:string;amount:number|null}[]}[]
 lossCarryForward:boolean|null;lossCarryForwardYears:number|null;openingLossVintages:{amount:number|null;originFiscalYearIndex:number|null}[]
}
export function createBlankProjectTaxFormDraft():ProjectTaxFormDraft{return{
 system:null,rates:[],documentedAmounts:[],allowances:[],lossCarryForward:null,lossCarryForwardYears:null,openingLossVintages:[]
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


export type EconomicAdjustmentFormDraft = { id:string; name:string; period:string; treatment:'benefit'|'cost'|null; effectType:'general'|'foreign-exchange'|'employment'|null; financialAmount:number|null; economicAmount:number|null; sourceReference:string; sourceVerified:boolean }
export function createBlankCppCpsTraceItem(id:string,periodCount:number):CppCpsTraceItem {
 return {
  id,label:'',category:'materials',basis:null,behaviour:null,fixedPercent:null,variablePercent:null,
  productId:null,costCentreId:null,allocationMethod:'not-allocated',baseCostCoverage:'unverified',
  periodAmounts:Array.from({length:periodCount},()=>null),
  baseCoveredAmounts:Array.from({length:periodCount},()=>null),
  source:{status:'unverified',reference:'',description:'',reliability:'unverified'}
 }
}

export type CostCentreAllocationBasis = 'production-quantity'|'sales-revenue'|'manual'
export type CostCentreDriverRow = { period:number; productId:string; amount:number|null }
export type CostCentreFormDraft = {
 id:string
 name:string
 type:'production'|'service'|'administration'|'sales'|'other'|null
 description:string
 allocationBasis:CostCentreAllocationBasis|null
 manualDriverName:string
 manualDriverUnit:string
 driverRows:CostCentreDriverRow[]
}
export function createBlankCostCentreFormDraft(id=''):CostCentreFormDraft {
 return {id,name:'',type:null,description:'',allocationBasis:null,manualDriverName:'',manualDriverUnit:'',driverRows:[]}
}
export function validateCostCentreFormDraft(value:CostCentreFormDraft):string[] {
 const errors:string[]=[]
 if(!value.id.trim())errors.push('cost-centre-id-required')
 if(!value.name.trim())errors.push('cost-centre-name-required')
 if(!value.type)errors.push('cost-centre-type-required')
 if(value.allocationBasis==='manual'){
  if(!value.manualDriverName.trim())errors.push('manual-cost-centre-driver-name-required')
  if(!value.manualDriverUnit.trim())errors.push('manual-cost-centre-driver-unit-required')
  const keys=new Set<string>()
  for(const row of value.driverRows){
   const key=row.period+':'+row.productId.trim().toLocaleLowerCase()
   if(!Number.isInteger(row.period)||row.period<1||!row.productId.trim()||row.amount===null||!Number.isFinite(row.amount)||row.amount<0)errors.push('invalid-manual-cost-centre-driver')
   if(keys.has(key))errors.push('duplicate-manual-cost-centre-driver')
   keys.add(key)
  }
 }
 if(value.allocationBasis!=='manual'&&value.driverRows.length)errors.push('manual-drivers-only-allowed-for-manual-basis')
 return errors
}

export type ValueAddedInputFormDraft={
 id:string;description:string;amount:number|null;marketOrigin:'local'|'foreign'|null
 taxesDutiesIncludedPercent:number|null;valueAddedIncludedPercentages:[number|null,number|null,number|null]
 sourceReference:string;sourceVerified:boolean
}
export type ValueAddedInvestmentFormDraft=ValueAddedInputFormDraft&{kind:'fixed-investment'|'pre-production-net-of-interest'|'inventory-increase'|null}
export type ValueAddedPeriodFormDraft={
 period:number;otherIncome:number|null;otherValueAdded:number|null;subsidiesOnInput:number|null;subsidiesOnInvestment:number|null
 repatriatedWages:number|null;repatriatedProfitDividends:number|null;repatriatedInterest:number|null;repatriatedOther:number|null
 domesticWages:number|null;domesticDividendsAndInterest:number|null
 skilledDomesticLabour:number|null;totalDomesticLabour:number|null;foreignExchangeOutflow:number|null
 sourceReference:string;sourceVerified:boolean
 intermediateInputs:ValueAddedInputFormDraft[];investmentInputs:ValueAddedInvestmentFormDraft[]
}
export function createBlankValueAddedInputFormDraft(id:string):ValueAddedInputFormDraft{
 return{id,description:'',amount:null,marketOrigin:null,taxesDutiesIncludedPercent:null,
  valueAddedIncludedPercentages:[null,null,null],sourceReference:'',sourceVerified:false}
}
export function createBlankValueAddedInvestmentFormDraft(id:string):ValueAddedInvestmentFormDraft{
 return{...createBlankValueAddedInputFormDraft(id),kind:null}
}
export function createBlankValueAddedPeriodFormDraft(period:number):ValueAddedPeriodFormDraft{
 return{period,otherIncome:null,otherValueAdded:null,subsidiesOnInput:null,subsidiesOnInvestment:null,
  repatriatedWages:null,repatriatedProfitDividends:null,repatriatedInterest:null,repatriatedOther:null,
  domesticWages:null,domesticDividendsAndInterest:null,skilledDomesticLabour:null,totalDomesticLabour:null,
  foreignExchangeOutflow:null,sourceReference:'',sourceVerified:false,intermediateInputs:[],investmentInputs:[]}
}

export type CostCentreInventoryMovementFormDraft = {
 id:string
 period:number|null
 inventoryStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 productId:string
 costCentreId:string
 openingQuantity:number|null
 openingValue:number|null
 receiptsQuantity:number|null
 receiptsValue:number|null
 transfersInQuantity:number|null
 transfersInValue:number|null
 transfersOutQuantity:number|null
 transfersOutValue:number|null
 productionQuantity:number|null
 productionValue:number|null
 consumptionQuantity:number|null
 consumptionValue:number|null
 salesQuantity:number|null
 salesCostValue:number|null
 wasteQuantity:number|null
 wasteValue:number|null
 closingQuantity:number|null
 closingValue:number|null
 sourceReference:string
 sourceVerified:boolean
}
export function createBlankCostCentreInventoryMovementFormDraft(id=''):CostCentreInventoryMovementFormDraft {
 return {id,period:null,inventoryStage:null,productId:'',costCentreId:'',
  openingQuantity:null,openingValue:null,receiptsQuantity:null,receiptsValue:null,transfersInQuantity:null,transfersInValue:null,
  transfersOutQuantity:null,transfersOutValue:null,productionQuantity:null,productionValue:null,consumptionQuantity:null,consumptionValue:null,salesQuantity:null,salesCostValue:null,
  wasteQuantity:null,wasteValue:null,closingQuantity:null,closingValue:null,
  sourceReference:'',sourceVerified:false}
}
const costCentreInventoryMovementHasData=(row:CostCentreInventoryMovementFormDraft):boolean =>
 [row.period,row.inventoryStage,row.productId,row.costCentreId,row.openingQuantity,row.openingValue,
  row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,row.transfersOutQuantity,row.transfersOutValue,row.productionQuantity,row.productionValue,row.consumptionQuantity,
  row.consumptionValue,row.salesQuantity,row.salesCostValue,row.wasteQuantity,row.wasteValue,row.closingQuantity,row.closingValue,row.sourceReference,row.sourceVerified===true?true:null]
  .some(value=>value!==null&&value!==undefined&&value!=='')

export type InventoryStageTransferFormDraft={
 id:string
 period:number|null
 sourceStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 destinationStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 sourceProductId:string
 destinationProductId:string
 sourceCostCentreId:string
 destinationCostCentreId:string
 quantity:number|null
 sourceUnit:string
 destinationUnit:string
 conversionFactor:number|null
 transferValue:number|null
 sourceReference:string
 sourceVerified:boolean
}
export function createBlankInventoryStageTransferFormDraft(id=''):InventoryStageTransferFormDraft{
 return {id,period:null,sourceStage:null,destinationStage:null,sourceProductId:'',destinationProductId:'',
  sourceCostCentreId:'',destinationCostCentreId:'',quantity:null,sourceUnit:'',destinationUnit:'',
  conversionFactor:null,transferValue:null,sourceReference:'',sourceVerified:false}
}
const inventoryStageTransferHasData=(row:InventoryStageTransferFormDraft):boolean=>
 [row.period,row.sourceStage,row.destinationStage,row.sourceProductId,row.destinationProductId,row.sourceCostCentreId,
  row.destinationCostCentreId,row.quantity,row.sourceUnit,row.destinationUnit,row.conversionFactor,row.transferValue,row.sourceReference,row.sourceVerified===true?true:null]
  .some(value=>value!==null&&value!==undefined&&value!=='')

export type ProjectModelFinancialFormDrafts = {
 cppCpsTraceItems: CppCpsTraceItem[]
 costCentres: CostCentreFormDraft[]
 wasteLedgerEntries: WasteLedgerEntry[]
 productionTransfers: ProductionTransferEntry[]
 inventoryReferenceBenchmarks: InventoryReferenceBenchmarkEntry[]
 costCentreInventoryMovements: CostCentreInventoryMovementFormDraft[]
 inventoryStageTransfers: InventoryStageTransferFormDraft[]
 helpDriven: HelpDrivenProjectForms
 assets: FixedAssetFormDraft[]
 productionCosts: ProductionCostFormDraft[]
 sales: SalesProductFormDraft[]
 workingCapital: WorkingCapitalComponentFormDraft[]
 loans: LoanFacilityFormDraft[]
 tax: ProjectTaxFormDraft
 salesTaxLedger: SalesTaxLedgerFormDraft
 economic: { discountRatePercent:number|null; discountRateSourceReference:string; discountRateSourceVerified:boolean; adjustments:EconomicAdjustmentFormDraft[]; valueAddedPeriods:ValueAddedPeriodFormDraft[] }
}
export function createBlankProjectModelFinancialFormDrafts():ProjectModelFinancialFormDrafts {
 return {cppCpsTraceItems:[],costCentres:[],wasteLedgerEntries:[],productionTransfers:[],inventoryReferenceBenchmarks:[],costCentreInventoryMovements:[],inventoryStageTransfers:[],helpDriven:createBlankHelpDrivenProjectForms(),assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[],tax:createBlankProjectTaxFormDraft(),salesTaxLedger:createBlankSalesTaxLedgerFormDraft(),economic:{discountRatePercent:null,discountRateSourceReference:'',discountRateSourceVerified:false,adjustments:[],valueAddedPeriods:[]}}
}

/** Merge persisted form data with current defaults without losing newer inventory ledgers. */
export function mergeProjectModelFinancialFormDrafts(saved?:Partial<ProjectModelFinancialFormDrafts>|null):ProjectModelFinancialFormDrafts {
 const defaults=createBlankProjectModelFinancialFormDrafts()
 if(!saved)return defaults
 return {
  ...defaults,...saved,
  costCentreInventoryMovements:Array.isArray(saved.costCentreInventoryMovements)?saved.costCentreInventoryMovements:defaults.costCentreInventoryMovements,
  inventoryStageTransfers:Array.isArray(saved.inventoryStageTransfers)?saved.inventoryStageTransfers:defaults.inventoryStageTransfers,
  tax:{...defaults.tax,...saved.tax,openingLossVintages:Array.isArray(saved.tax?.openingLossVintages)?saved.tax.openingLossVintages:defaults.tax.openingLossVintages},
  economic:{...defaults.economic,...saved.economic,adjustments:Array.isArray(saved.economic?.adjustments)?saved.economic.adjustments:defaults.economic.adjustments},
 }
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
 const collections:[string,unknown[]][]=[['financialForms.assets',value.assets]]
 // Working-capital component balances are bound to the periodic finance engine; do not block reports for these integrated rows.
 for(const [label,rows] of collections)for(const [index,row] of (rows??[]).entries())if(hasEnteredValue(row))issues.push(label+'.'+index)
 // Cost-centre inventory movements are persisted but not yet posted into the three-stage inventory engine.
 for(const [index,row] of (value.costCentreInventoryMovements??[]).entries())if(costCentreInventoryMovementHasData(row))issues.push('financialForms.costCentreInventoryMovements.'+index)
 // Inter-stage transfers are stored separately until stage-specific posting is complete.
 for(const [index,row] of (value.inventoryStageTransfers??[]).entries())if(inventoryStageTransferHasData(row))issues.push('financialForms.inventoryStageTransfers.'+index)
 // Tax form fields are bound to the period engine; schedule validity is checked by the periodic result gate.
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
 if(path.startsWith('financialForms.economic:')){
  const messages:Record<string,[string,string]> = {
   'foreign-exchange-effect-required':['برای اثر ارز خارجی، تعدیل اقتصادی با طبقه ارز خارجی ثبت کنید','Add at least one foreign-exchange economic adjustment'],
   'employment-effect-required':['برای اثر اشتغال، تعدیل اقتصادی اشتغال ثبت کنید','Add at least one employment economic adjustment'],
   'value-added-analysis-not-valid':['دفتر ارزش افزوده ناقص است یا با CPP/CPS، سرمایه‌گذاری و دوره‌های مالی تطبیق ندارد','Value-added ledger is incomplete or does not reconcile to CPP/CPS, investment and financial periods'],
   'cost-centre-analysis-not-integrated':['گزارش مراکز هزینه هنوز به دفتر هزینه تفصیلی متصل نشده است','Cost-centre reporting is not yet connected to the detailed cost ledger'],
   'cost-centre-ledger-not-ready':['برای تحلیل مراکز هزینه، دفتر CPP/CPS معتبر و دست‌کم یک قلم هزینه لازم است','A valid CPP/CPS trace ledger with at least one cost item is required for cost-centre analysis'],
   'cost-allocation-not-ready':['برای تأیید تخصیص، دفتر CPP/CPS باید کامل و مستند باشد و برنامه محصول/مالی با محرک تخصیص معتبر محاسبه شود','Cost allocation requires a complete sourced CPP/CPS ledger and a valid product/financial schedule with allocation drivers'],
   'incremental-analysis-not-ready':['برای گزارش بنگاه موجود، تاریخ و تراز افتتاحیه، نرخ تنزیل مستند و جریان‌های نقدی هر دو سناریو با منبع تأییدشده لازم است','Existing-enterprise reporting requires a sourced opening date and balanced opening statement, a verified discount rate, and sourced cash flows for both scenarios'],
   'economic-analysis-not-valid':['نرخ تنزیل یا تعدیلات قیمت سایه‌ای اقتصادی ناقص یا نامعتبر است','Economic discount rate or shadow-price adjustments are incomplete or invalid'],
  }
  const code=path.split(':')[1]??''
  const message=messages[code]
  if(message)return en?message[1]:message[0]
 }
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
 const centres=value.costCentres??[]
 const centreIds=new Set<string>()
 centres.forEach((centre,index)=>{
  validateCostCentreFormDraft(centre).forEach(error=>errors.push('cost-centre-'+index+':'+error))
  const normalizedCentreId=centre.id.trim().toLocaleLowerCase()
  if(centreIds.has(normalizedCentreId))errors.push('cost-centre-'+index+':duplicate-cost-centre-id')
  centreIds.add(normalizedCentreId)
 })
 for(const item of value.cppCpsTraceItems??[])if(item.source.status==='verified'){
  const centre=centres.find(candidate=>candidate.id===item.costCentreId)
  if(!centre)errors.push('cpp-cps-item-'+item.id+':unknown-cost-centre')
  else if(item.allocationMethod==='cost-centre-driver'&&!centre.allocationBasis)errors.push('cpp-cps-item-'+item.id+':cost-centre-allocation-basis-required')
  else if(item.allocationMethod==='cost-centre-driver'&&centre.allocationBasis==='manual'&&!centre.driverRows.length)errors.push('cpp-cps-item-'+item.id+':manual-cost-centre-drivers-required')
 }
 const inventoryMovementKeys=new Set<string>()
 for(const [index,row] of (value.costCentreInventoryMovements??[]).entries()){
  if(!costCentreInventoryMovementHasData(row))continue
  const values=[row.openingQuantity,row.openingValue,row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,row.transfersOutQuantity,row.transfersOutValue,row.productionQuantity,row.productionValue,row.consumptionQuantity,row.consumptionValue,row.salesQuantity,row.salesCostValue,row.wasteQuantity,row.wasteValue,row.closingQuantity,row.closingValue]
  if(!Number.isInteger(row.period)||row.period===null||row.period<1)errors.push('cost-centre-inventory-'+index+':invalid-period')
  if(!row.inventoryStage)errors.push('cost-centre-inventory-'+index+':inventory-stage-required')
  if(!row.productId.trim()||!row.costCentreId.trim())errors.push('cost-centre-inventory-'+index+':product-and-cost-centre-required')
  if(row.period!==null&&row.inventoryStage&&row.productId.trim()&&row.costCentreId.trim()){
   const key=[row.period,row.inventoryStage,row.productId.trim().toLocaleLowerCase(),row.costCentreId.trim().toLocaleLowerCase()].join(':')
   if(inventoryMovementKeys.has(key))errors.push('cost-centre-inventory-'+index+':duplicate-movement-key')
   inventoryMovementKeys.add(key)
  }
  if(values.some(amount=>amount===null||!Number.isFinite(amount)||amount<0))errors.push('cost-centre-inventory-'+index+':all-quantities-and-values-required')
  if(!row.sourceReference.trim()||!row.sourceVerified)errors.push('cost-centre-inventory-'+index+':verified-source-required')
 }
 const stageTransferIds=new Set<string>()
 for(const [index,row] of (value.inventoryStageTransfers??[]).entries()){
  if(!inventoryStageTransferHasData(row))continue
  const id=row.id.trim().toLocaleLowerCase()
  if(!id||stageTransferIds.has(id))errors.push('inventory-stage-transfer-'+index+':duplicate-or-missing-id')
  stageTransferIds.add(id)
  if(row.period===null||!Number.isInteger(row.period)||row.period<1)errors.push('inventory-stage-transfer-'+index+':invalid-period')
  if(!row.sourceStage||!row.destinationStage||row.sourceStage===row.destinationStage)errors.push('inventory-stage-transfer-'+index+':distinct-source-and-destination-stages-required')
  if(!row.sourceProductId.trim()||!row.destinationProductId.trim()||!row.sourceCostCentreId.trim()||!row.destinationCostCentreId.trim())errors.push('inventory-stage-transfer-'+index+':source-and-destination-product-centre-required')
  if(row.quantity===null||!Number.isFinite(row.quantity)||row.quantity<=0||row.conversionFactor===null||!Number.isFinite(row.conversionFactor)||row.conversionFactor<=0||row.transferValue===null||!Number.isFinite(row.transferValue)||row.transferValue<0)errors.push('inventory-stage-transfer-'+index+':invalid-quantity-conversion-or-value')
  if(!row.sourceUnit.trim()||!row.destinationUnit.trim())errors.push('inventory-stage-transfer-'+index+':source-and-destination-units-required')
  if(!row.sourceReference.trim()||!row.sourceVerified)errors.push('inventory-stage-transfer-'+index+':verified-source-required')
 }
 errors.push(...validateHelpDrivenProjectForms(value.helpDriven ?? createBlankHelpDrivenProjectForms()))
 value.assets.forEach((item,index)=>validateFixedAssetFormDraft(item).forEach(error=>errors.push('asset-'+index+':'+error)))
 value.productionCosts.forEach((item,index)=>validateProductionCostFormDraft(item).forEach(error=>errors.push('production-cost-'+index+':'+error)))
 value.loans.forEach((item,index)=>validateLoanFacilityFormDraft(item).forEach(error=>errors.push('loan-'+index+':'+error)))
 for(const [index,item] of value.workingCapital.entries()) {
  if(item.minimumDaysCoverage!==null&&(!Number.isFinite(item.minimumDaysCoverage)||item.minimumDaysCoverage<=0))errors.push('working-capital-'+index+':invalid-days-coverage')
  if(item.turnoverCoefficient!==null&&(!Number.isFinite(item.turnoverCoefficient)||item.turnoverCoefficient<0))errors.push('working-capital-'+index+':invalid-turnover')
 }
 const salesTax=value.salesTaxLedger??createBlankSalesTaxLedgerFormDraft()
 const salesTaxCreditIds=new Set<string>()
 for(const [index,item] of salesTax.inputCredits.entries()){
  const id=item.id.trim().toLocaleLowerCase()
  if(!id||salesTaxCreditIds.has(id))errors.push('sales-tax-credit-'+index+':duplicate-or-missing-id')
  salesTaxCreditIds.add(id)
  if(item.period===null||!Number.isInteger(item.period)||item.period<1||item.taxAmount===null||!Number.isFinite(item.taxAmount)||item.taxAmount<0)errors.push('sales-tax-credit-'+index+':invalid-period-or-amount')
  if(!item.sourceReference.trim()||!item.sourceVerified)errors.push('sales-tax-credit-'+index+':verified-source-required')
 }
 const settlementPeriods=new Set<number>()
 for(const [index,item] of salesTax.settlements.entries()){
  if(item.period===null||!Number.isInteger(item.period)||item.period<1||settlementPeriods.has(item.period))errors.push('sales-tax-settlement-'+index+':invalid-or-duplicate-period')
  if(item.period!==null)settlementPeriods.add(item.period)
  if(item.amount===null||!Number.isFinite(item.amount)||item.amount<0||!item.sourceReference.trim())errors.push('sales-tax-settlement-'+index+':amount-and-source-required')
 }
 if(salesTax.openingBalance!==null&&!Number.isFinite(salesTax.openingBalance))errors.push('sales-tax-opening-balance:invalid')
 if(value.economic.discountRatePercent!==null&&(!Number.isFinite(value.economic.discountRatePercent)||value.economic.discountRatePercent<=-100))errors.push('economic-discount-rate:invalid-rate')
 if(value.economic.discountRatePercent!==null&&(!value.economic.discountRateSourceReference.trim()||!value.economic.discountRateSourceVerified))errors.push('economic-discount-rate:verified-source-required')
 for(const [index,item] of value.economic.adjustments.entries()){
  const entered=[item.name,item.period,item.treatment,item.effectType,item.financialAmount,item.economicAmount].some(hasEnteredValue)
  if(entered&&(!item.sourceReference.trim()||!item.sourceVerified))errors.push('economic-adjustment-'+index+':verified-source-required')
  if(item.financialAmount!==null&&(!Number.isFinite(item.financialAmount)||item.financialAmount<0)||
    item.economicAmount!==null&&(!Number.isFinite(item.economicAmount)||item.economicAmount<0))
    errors.push('economic-adjustment-'+index+':invalid-amount')
 }
 const valueAddedPeriods=value.economic?.valueAddedPeriods??[]
 const valueAddedPeriodNumbers=new Set<number>()
 for(const [index,row] of valueAddedPeriods.entries()){
  if(!Number.isInteger(row.period)||row.period<1||valueAddedPeriodNumbers.has(row.period))errors.push('value-added-period-'+index+':invalid-or-duplicate-period')
  valueAddedPeriodNumbers.add(row.period)
  const periodValues=[row.otherIncome,row.subsidiesOnInput,row.subsidiesOnInvestment,row.repatriatedWages,row.repatriatedProfitDividends,row.repatriatedInterest,row.repatriatedOther,row.domesticWages,row.domesticDividendsAndInterest,row.skilledDomesticLabour,row.totalDomesticLabour,row.foreignExchangeOutflow]
  if(periodValues.some(amount=>amount!==null&&(!Number.isFinite(amount)||amount<0))||row.otherValueAdded!==null&&!Number.isFinite(row.otherValueAdded))errors.push('value-added-period-'+index+':invalid-period-amount')
  if(hasEnteredValue([...periodValues,row.otherValueAdded])&&(!row.sourceReference.trim()||!row.sourceVerified))errors.push('value-added-period-'+index+':verified-period-source-required')
  const itemIds=new Set<string>()
  for(const [itemIndex,item] of row.intermediateInputs.entries()){
   const id=item.id.trim().toLocaleLowerCase()
   if(!id||itemIds.has(id))errors.push('value-added-intermediate-'+index+'-'+itemIndex+':duplicate-or-missing-id')
   itemIds.add(id)
   if(!item.description.trim()||item.amount===null||!Number.isFinite(item.amount)||item.amount<0||!item.marketOrigin||
    item.taxesDutiesIncludedPercent===null||!Number.isFinite(item.taxesDutiesIncludedPercent)||item.taxesDutiesIncludedPercent< -100||item.taxesDutiesIncludedPercent>100||
    item.valueAddedIncludedPercentages.some(percent=>percent===null||!Number.isFinite(percent)||percent<0||percent>100)||
    !item.sourceReference.trim()||!item.sourceVerified)errors.push('value-added-intermediate-'+index+'-'+itemIndex+':incomplete-or-unverified-input')
  }
  for(const [itemIndex,item] of row.investmentInputs.entries()){
   const id=item.id.trim().toLocaleLowerCase()
   if(!id||itemIds.has(id))errors.push('value-added-investment-'+index+'-'+itemIndex+':duplicate-or-missing-id')
   itemIds.add(id)
   const amountInvalid=item.amount===null||!Number.isFinite(item.amount)||(item.kind!=='inventory-increase'&&item.amount<0)
   if(!item.description.trim()||amountInvalid||!item.marketOrigin||!item.kind||
    item.taxesDutiesIncludedPercent===null||!Number.isFinite(item.taxesDutiesIncludedPercent)||item.taxesDutiesIncludedPercent< -100||item.taxesDutiesIncludedPercent>100||
    item.valueAddedIncludedPercentages.some(percent=>percent===null||!Number.isFinite(percent)||percent<0||percent>100)||
    !item.sourceReference.trim()||!item.sourceVerified)errors.push('value-added-investment-'+index+'-'+itemIndex+':incomplete-or-unverified-input')
  }
 }
 for(const [index,row] of value.tax.rates.entries())if(row.ratePercent!==null&&(!Number.isFinite(row.ratePercent)||row.ratePercent<0||row.ratePercent>100))errors.push('tax-rate-'+index+':invalid-tax-rate')
 if(value.tax.lossCarryForwardYears!==null&&(!Number.isInteger(value.tax.lossCarryForwardYears)||value.tax.lossCarryForwardYears<0))errors.push('invalid-loss-carry-forward-years')
 return errors
}
