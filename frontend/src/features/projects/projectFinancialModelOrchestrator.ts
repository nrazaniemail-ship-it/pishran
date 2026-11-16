import type { ProjectFoundation } from './projectFoundation'
import type { ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
import type { PeriodicProjectFinanceInput, PeriodicStatementOpeningBalances } from '../steel/periodicFinancialEngine'
import {
  bindProductionSalesToPeriodicFinance,
  type ProductionSalesInventorySchedule,
} from './productionSalesInventoryIntegration'
import {
  bindWorkingCapitalDraftsToPeriodicFinance,
  type WorkingCapitalDraftSchedule,
} from './workingCapitalDraftIntegration'
import {
  bindFixedAssetDraftsToPeriodicFinance,
  type FixedAssetFinanceBinding,
} from './fixedAssetDraftIntegration'
import {
  calculatePeriodicFinanceWithForeignCurrencyLoans,
  type ForeignCurrencyFinanceRunResult,
} from './foreignCurrencyLoanFinanceBinding'

export type ProjectFinancialModelOrchestrationInput={
  finance:PeriodicProjectFinanceInput
  drafts:Pick<ProjectModelFinancialFormDrafts,'sales'|'productionCosts'|'workingCapital'|'assets'|'loans'>
  foundation:ProjectFoundation
  productionStartDate:string
  openingFinishedGoodsByProduct?:Record<string,number>
  openingWorkingCapital:number
  openingBalances:PeriodicStatementOpeningBalances
  taxTreatment:'deductible'|'non-deductible'
  openingTaxLossCarryForward?:number
  openingForeignBalances?:Record<string,number>
  openingExchangeRatesToLocal?:Record<string,number>
}

export type ProjectFinancialModelOrchestrationResult={
  valid:boolean
  issues:string[]
  financeInput:PeriodicProjectFinanceInput|null
  productionSales:ProductionSalesInventorySchedule|null
  workingCapital:WorkingCapitalDraftSchedule|null
  fixedAssets:FixedAssetFinanceBinding|null
  finalRun:ForeignCurrencyFinanceRunResult|null
}

/**
 * Single ordered calculation path for project forms:
 * product operations -> working capital -> fixed assets -> debt/FX -> statements.
 * Every adapter is fail-fast; no missing form value is silently converted to zero.
 */
export function calculateProjectFinancialModelFromDrafts(
  input:ProjectFinancialModelOrchestrationInput,
):ProjectFinancialModelOrchestrationResult {
  let finance=input.finance
  let productionSales:ProductionSalesInventorySchedule|null=null
  let workingCapital:WorkingCapitalDraftSchedule|null=null
  let fixedAssets:FixedAssetFinanceBinding|null=null
  const fail=(issues:string[]):ProjectFinancialModelOrchestrationResult=>({
    valid:false,issues,financeInput:null,productionSales,workingCapital,fixedAssets,finalRun:null,
  })

  if(input.drafts.sales.length||input.drafts.productionCosts.length) {
    const openingFinishedGoodsByProduct=input.openingFinishedGoodsByProduct??Object.fromEntries(input.drafts.sales.map(product=>[product.productId,product.openingFinishedGoodsQuantity??Number.NaN]))
    const result=bindProductionSalesToPeriodicFinance(finance,input.drafts,openingFinishedGoodsByProduct)
    productionSales=result.schedule
    if(!result.valid||!result.financeInput)return fail(result.issues)
    finance=result.financeInput
  }
  if(input.drafts.workingCapital.length) {
    const result=bindWorkingCapitalDraftsToPeriodicFinance(
      finance,{workingCapital:input.drafts.workingCapital},input.openingWorkingCapital,
    )
    workingCapital=result.schedule
    if(!result.valid||!result.financeInput)return fail(result.issues)
    finance=result.financeInput
  }
  if(input.drafts.assets.length) {
    fixedAssets=bindFixedAssetDraftsToPeriodicFinance({
      finance,assets:input.drafts.assets,foundation:input.foundation,
      productionStartDate:input.productionStartDate,
    })
    if(!fixedAssets.valid||!fixedAssets.financeInput)return fail(fixedAssets.issues)
    finance=fixedAssets.financeInput
  }
  const finalRun=calculatePeriodicFinanceWithForeignCurrencyLoans({
    finance,loans:input.drafts.loans,foundation:input.foundation,
    openingBalances:input.openingBalances,taxTreatment:input.taxTreatment,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,
    openingForeignBalances:input.openingForeignBalances,
    openingExchangeRatesToLocal:input.openingExchangeRatesToLocal,
  })
  if(!finalRun.valid)return {
    valid:false,issues:finalRun.issues,financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun,
  }
  return {valid:true,issues:[],financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun}
}
