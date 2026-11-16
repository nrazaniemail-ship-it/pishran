import type { ProjectFoundation } from './projectFoundation'
import { validateOpeningBalanceSheetDraft, type ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
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
  drafts:Pick<ProjectModelFinancialFormDrafts,'sales'|'productionCosts'|'workingCapital'|'assets'|'loans'> & Partial<Pick<ProjectModelFinancialFormDrafts,'openingBalanceSheet'>>
  foundation:ProjectFoundation
  productionStartDate:string
  openingFinishedGoodsByProduct?:Record<string,number>
  openingWorkingCapital?:number
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
  const openingDraft=input.drafts.openingBalanceSheet
  const detailedOpeningNwc=openingDraft?.enabled
    ?openingDraft.inventory!+openingDraft.workInProgress!+openingDraft.finishedGoods!+openingDraft.receivables!+
      openingDraft.otherCurrentAssets!-openingDraft.tradePayables!-openingDraft.otherCurrentLiabilities!
    :undefined

  if(input.drafts.sales.length||input.drafts.productionCosts.length) {
    const openingFinishedGoodsByProduct=input.openingFinishedGoodsByProduct??Object.fromEntries(input.drafts.sales.map(product=>[product.productId,product.openingFinishedGoodsQuantity??Number.NaN]))
    const result=bindProductionSalesToPeriodicFinance(finance,input.drafts,openingFinishedGoodsByProduct)
    productionSales=result.schedule
    if(!result.valid||!result.financeInput)return fail(result.issues)
    finance=result.financeInput
  }
  if(input.drafts.workingCapital.length) {
    const componentOpeningBalances=input.drafts.workingCapital.map(component=>component.openingBalance)
    if(input.openingWorkingCapital==null&&componentOpeningBalances.some(value=>!Number.isFinite(value)||value!<0))
      return fail(['Every working-capital component requires an explicit non-negative opening balance.'])
    const openingWorkingCapital=input.openingWorkingCapital??detailedOpeningNwc??input.drafts.workingCapital.reduce((sum,component)=>{
      const liability=component.category==='payables'||component.category==='other-current-liability'
      return sum+(liability?-1:1)*(component.openingBalance??0)
    },0)
    if(openingWorkingCapital<0)return fail(['Opening net working capital cannot be negative in this model input.'])
    const result=bindWorkingCapitalDraftsToPeriodicFinance(
      finance,{workingCapital:input.drafts.workingCapital},openingWorkingCapital,
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
  let openingBalances=input.openingBalances
  if(openingDraft?.enabled) {
    const openingIssues=validateOpeningBalanceSheetDraft(openingDraft)
    if(openingIssues.length)return fail(openingIssues)
    openingBalances={
      cash:openingDraft.cash!,
      debt:openingDraft.shortTermDebt!+openingDraft.longTermDebt!,
      netFixedAssets:openingDraft.grossFixedAssets!-openingDraft.accumulatedDepreciation!,
      netWorkingCapital:openingDraft.inventory!+openingDraft.workInProgress!+openingDraft.finishedGoods!+
        openingDraft.receivables!+openingDraft.otherCurrentAssets!-openingDraft.tradePayables!-openingDraft.otherCurrentLiabilities!,
      deferredPreOperatingAssets:openingDraft.deferredPreOperatingAssets!,
      paidInCapital:openingDraft.shareCapital!,
      retainedEarnings:openingDraft.retainedEarnings!,
    }
  }
  const openingForeignBalances=Object.fromEntries(input.drafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingForeignBalance as number]))
  const openingExchangeRatesToLocal=Object.fromEntries(input.drafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingExchangeRateToLocal as number]))
  const finalRun=calculatePeriodicFinanceWithForeignCurrencyLoans({
    finance,loans:input.drafts.loans,foundation:input.foundation,
    openingForeignBalances,openingExchangeRatesToLocal,
    openingBalances,taxTreatment:input.taxTreatment,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,
    openingForeignBalances:input.openingForeignBalances,
    openingExchangeRatesToLocal:input.openingExchangeRatesToLocal,
  })
  if(!finalRun.valid)return {
    valid:false,issues:finalRun.issues,financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun,
  }
  return {valid:true,issues:[],financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun}
}
