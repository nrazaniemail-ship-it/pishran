import type { ProjectCalendarPeriod, ProjectDiscountConvention } from './projectFoundation'
import type { ValueAddedPeriodFormDraft } from './projectModelFormDrafts'
import type { ProductOperatingSchedule } from './productOperatingSchedule'
import type { SalesTaxLedgerResult } from './salesTaxLedger'
import {
  buildComfarValueAddedAnalysis,
  type ValueAddedAnalysisResult,
  type ValueAddedInputItem,
  type ValueAddedInvestmentItem,
} from './projectValueAddedAnalysis'
import {
  calculatePeriodicNpv,
  type PeriodCashFlowTiming,
  type PeriodicProjectFinanceResult,
} from '../steel/periodicFinancialEngine'

export type ProjectValueAddedIntegrationInput = {
  periods: ProjectCalendarPeriod[]
  drafts: ValueAddedPeriodFormDraft[]
  productSchedule: ProductOperatingSchedule | null
  finance: PeriodicProjectFinanceResult | null
  salesTaxLedger: SalesTaxLedgerResult | null
  salesTaxLedgerActive: boolean
  discountRatePercent: number | null
  dayCountBasis: 360 | 365
  timing: PeriodCashFlowTiming
  valuationDate?: string
  discountConvention: ProjectDiscountConvention
  periodsPerYear: 1 | 2 | 4 | 12
}

function invalid(issues: string[]): ValueAddedAnalysisResult {
  return {
    valid:false,issues,rows:[],
    totals:{
      grossDomesticValueAdded:0,netDomesticValueAdded:0,repatriatedPayments:0,
      netNationalValueAdded:0,domesticWages:0,domesticDividendsAndInterest:0,
      governmentShare:0,otherValueAdded:0,presentValueNetNationalValueAdded:0,
      presentValueDomesticWages:0,absoluteEfficiencyRatio:null,
      relativeEfficiency:{investment:null,foreignExchange:null,skilledLabour:null,totalLabour:null},
    },
  }
}

const amount = (value:number|null|undefined):number => value ?? Number.NaN

function mapInput(item:ValueAddedPeriodFormDraft['intermediateInputs'][number],period:number):ValueAddedInputItem {
  return {
    id:item.id,period,description:item.description,amount:amount(item.amount),
    marketOrigin:item.marketOrigin as ValueAddedInputItem['marketOrigin'],
    taxesDutiesIncludedPercent:amount(item.taxesDutiesIncludedPercent),
    valueAddedIncludedPercentages:item.valueAddedIncludedPercentages as [number,number,number],
    sourceReference:item.sourceReference,sourceVerified:item.sourceVerified,
  }
}

function mapInvestment(item:ValueAddedPeriodFormDraft['investmentInputs'][number],period:number):ValueAddedInvestmentItem {
  return {
    ...mapInput(item,period),
    kind:item.kind as ValueAddedInvestmentItem['kind'],
  }
}

/**
 * Connects the source-backed value-added form to the validated product, tax and
 * periodic-finance schedules. Missing form amounts stay NaN and fail validation;
 * they are never silently interpreted as zero.
 */
export function buildIntegratedProjectValueAddedAnalysis(input:ProjectValueAddedIntegrationInput):ValueAddedAnalysisResult {
  const issues:string[]=[]
  const count=input.periods.length
  if(!count)issues.push('A complete project-period calendar is required for value-added analysis.')
  if(!input.productSchedule?.valid)issues.push('A valid product-by-product sales schedule is required for value-added analysis.')
  if(!input.finance?.valid||input.finance.rows.length!==count)issues.push('A valid periodic financial result is required for value-added analysis.')
  if(input.salesTaxLedgerActive&&!input.salesTaxLedger?.valid)issues.push('A valid indirect sales-tax ledger is required for value-added analysis.')
  if(input.discountRatePercent===null||!Number.isFinite(input.discountRatePercent)||input.discountRatePercent<=-100)
    issues.push('An explicit economic discount rate greater than -100% is required for value-added efficiency ratios.')
  if(issues.length)return invalid(issues)

  const product=input.productSchedule!
  const finance=input.finance!
  const tax=input.salesTaxLedger
  const rows=input.periods.map((_,index)=>{
    const period=index+1
    const draft=input.drafts.find(item=>item.period===period)
    const financeRow=finance.rows[index]
    const salesRevenue=(product.periodRevenue[index]??Number.NaN)-(product.periodSubsidyIncome[index]??Number.NaN)
    const outputSalesTax=input.salesTaxLedgerActive
      ?tax!.rows[index]?.outputTax??Number.NaN
      :product.periodOutputSalesTax[index]??Number.NaN
    const factor=calculatePeriodicNpv(
      input.periods.map((__,i)=>i===index?1:0),input.periods,
      input.discountRatePercent as number,input.dayCountBasis,input.timing,
      input.valuationDate,input.discountConvention,input.periodsPerYear,
    )
    return {
      period,salesRevenue,outputSalesTax,
      otherIncome:amount(draft?.otherIncome),
      subsidiesOnOutput:product.periodSubsidyIncome[index]??Number.NaN,
      intermediateInputs:(draft?.intermediateInputs??[]).map(item=>mapInput(item,period)),
      investmentInputs:(draft?.investmentInputs??[]).map(item=>mapInvestment(item,period)),
      repatriatedWages:amount(draft?.repatriatedWages),
      repatriatedProfitDividends:amount(draft?.repatriatedProfitDividends),
      repatriatedInterest:amount(draft?.repatriatedInterest),
      repatriatedOther:amount(draft?.repatriatedOther),
      domesticWages:amount(draft?.domesticWages),
      domesticDividendsAndInterest:amount(draft?.domesticDividendsAndInterest),
      corporateTax:financeRow.tax,
      subsidiesOnInput:amount(draft?.subsidiesOnInput),
      subsidiesOnInvestment:amount(draft?.subsidiesOnInvestment),
      skilledDomesticLabour:amount(draft?.skilledDomesticLabour),
      totalDomesticLabour:amount(draft?.totalDomesticLabour),
      foreignExchangeOutflow:amount(draft?.foreignExchangeOutflow),
      presentValueFactor:factor,
      sourceReference:draft?.sourceReference??'',
      sourceVerified:draft?.sourceVerified??false,
    }
  })
  return buildComfarValueAddedAnalysis(rows)
}
