import type { ProjectCalendarPeriod, ProjectDiscountConvention } from './projectFoundation'
import type { EconomicAdjustmentFormDraft } from './projectModelFormDrafts'
import type { SalesTaxLedgerResult } from './salesTaxLedger'
import { calculatePeriodicIrr, calculatePeriodicNpv, type PeriodicProjectFinanceResult, type PeriodCashFlowTiming } from '../steel/periodicFinancialEngine'

export type ProjectEconomicAnalysisResult = {
  valid:boolean
  issues:string[]
  rows:{period:number;financialProjectCashFlow:number;taxTransferRemoved:number;indirectTaxTransferRemoved:number;subsidyTransferRemoved:number;economicAdjustment:number;economicCashFlow:number}[]
  economicCashFlows:number[]
  economicNpv:number|null
  economicIrr:number|null
  totalTaxTransferRemoved:number
  totalIndirectTaxTransferRemoved:number
  totalSubsidyTransferRemoved:number
  totalForeignExchangeAdjustment:number
  totalEmploymentAdjustment:number
  totalGeneralAdjustment:number
}

/** Shadow-price adjustment report based on the validated unlevered periodic cash flow. */
export function buildProjectEconomicAnalysis(
  finance:PeriodicProjectFinanceResult,
  periods:ProjectCalendarPeriod[],
  adjustments:EconomicAdjustmentFormDraft[],
  discountRatePercent:number|null,
  dayCountBasis:360|365,
  timing:PeriodCashFlowTiming,
  valuationDate:string|undefined,
  discountConvention:ProjectDiscountConvention,
  periodsPerYear:1|2|4|12,
  salesTaxLedger:SalesTaxLedgerResult|null=null,
  salesTaxLedgerActive=false,
  discountRateSourceReference='',
  discountRateSourceVerified=false,
):ProjectEconomicAnalysisResult {
  const issues:string[]=[]
  const empty=():ProjectEconomicAnalysisResult=>({
    valid:false,issues,rows:[],economicCashFlows:[],economicNpv:null,economicIrr:null,
    totalTaxTransferRemoved:0,totalIndirectTaxTransferRemoved:0,totalSubsidyTransferRemoved:0,totalForeignExchangeAdjustment:0,
    totalEmploymentAdjustment:0,totalGeneralAdjustment:0,
  })
  if(!finance.valid)issues.push('A valid periodic financial model is required for economic appraisal.')
  if(salesTaxLedgerActive&&(!salesTaxLedger?.valid||salesTaxLedger.rows.length!==periods.length))
    issues.push('A valid period-aligned indirect sales-tax ledger is required to remove tax transfers from economic cash flow.')
  if(periods.length!==finance.rows.length||!periods.length)issues.push('Economic appraisal requires one financial result for every project period.')
  if(discountRatePercent===null||!Number.isFinite(discountRatePercent)||discountRatePercent<=-100)
    issues.push('Enter an explicit economic discount rate greater than -100%.')
  if(!discountRateSourceReference.trim()||!discountRateSourceVerified)
    issues.push('The economic discount rate requires an independently verified source reference.')
  if((dayCountBasis!==360&&dayCountBasis!==365)||!['period-end','mid-period'].includes(timing))
    issues.push('A valid economic discount timing and day-count basis are required.')
  const adjustmentByPeriod=periods.map(()=>0)
  let totalForeignExchangeAdjustment=0,totalEmploymentAdjustment=0,totalGeneralAdjustment=0
  for(const item of adjustments){
    if(!item.name.trim()||!item.treatment||!item.effectType){
      issues.push('Every economic adjustment requires a description, treatment and effect category.')
      continue
    }
    if(!item.sourceReference.trim()||!item.sourceVerified){
      issues.push('Economic adjustment '+item.name+' requires a verified shadow-price source reference.')
      continue
    }
    const matches:number[]=[]
    periods.forEach((period,index)=>{
      if(item.period===String(index+1)||item.period===String(period.index)||
        item.period===period.startDate||item.period===period.endDate)matches.push(index)
    })
    if(matches.length!==1){issues.push('Economic adjustment '+item.name+' has an unknown or ambiguous project period.');continue}
    if(item.financialAmount===null||item.economicAmount===null||
      !Number.isFinite(item.financialAmount)||!Number.isFinite(item.economicAmount)||
      item.financialAmount<0||item.economicAmount<0){
      issues.push('Economic adjustment '+item.name+' requires non-negative financial and economic amounts.')
      continue
    }
    const difference=item.economicAmount-item.financialAmount
    const signed=item.treatment==='benefit'?difference:-difference
    const index=matches[0]
    adjustmentByPeriod[index]+=signed
    if(item.effectType==='foreign-exchange')totalForeignExchangeAdjustment+=signed
    else if(item.effectType==='employment')totalEmploymentAdjustment+=signed
    else totalGeneralAdjustment+=signed
  }
  if(issues.length)return empty()
  const rows=finance.rows.map((row,index)=>{
    const taxTransferRemoved=row.unleveredTax
    const taxBalanceChange=salesTaxLedgerActive
      ?salesTaxLedger!.rows[index].closingBalance-salesTaxLedger!.rows[index].openingBalance:0
    // The financial NWC cash flow includes the movement in VAT payable/receivable.
    // Remove that transfer from economic cash flow; settlements are already reflected in the balance movement.
    const indirectTaxTransferRemoved=-taxBalanceChange
    const subsidyTransferRemoved=row.subsidyIncome??0
    const economicAdjustment=adjustmentByPeriod[index]
    const economicCashFlow=row.projectFreeCashFlow+taxTransferRemoved+indirectTaxTransferRemoved-subsidyTransferRemoved+economicAdjustment
    return {period:index+1,financialProjectCashFlow:row.projectFreeCashFlow,taxTransferRemoved,
      indirectTaxTransferRemoved,subsidyTransferRemoved,economicAdjustment,economicCashFlow}
  })
  const economicCashFlows=rows.map(row=>row.economicCashFlow)
  const economicNpv=calculatePeriodicNpv(economicCashFlows,periods,discountRatePercent as number,
    dayCountBasis,timing,valuationDate,discountConvention,periodsPerYear)
  const economicIrr=calculatePeriodicIrr(economicCashFlows,periods,dayCountBasis,timing)
  if(!Number.isFinite(economicNpv))issues.push('Economic NPV could not be calculated from the supplied dates, rate and cash flows.')
  if(issues.length)return empty()
  return {valid:true,issues:[],rows,economicCashFlows,economicNpv,economicIrr,
    totalTaxTransferRemoved:rows.reduce((sum,row)=>sum+row.taxTransferRemoved,0),
    totalIndirectTaxTransferRemoved:rows.reduce((sum,row)=>sum+row.indirectTaxTransferRemoved,0),
    totalSubsidyTransferRemoved:rows.reduce((sum,row)=>sum+row.subsidyTransferRemoved,0),
    totalForeignExchangeAdjustment,totalEmploymentAdjustment,totalGeneralAdjustment}
}
