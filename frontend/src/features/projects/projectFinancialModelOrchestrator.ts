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
  drafts:Pick<ProjectModelFinancialFormDrafts,'sales'|'productionCosts'|'workingCapital'|'assets'|'loans'|'tax'> & Partial<Pick<ProjectModelFinancialFormDrafts,'openingBalanceSheet'>>
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
  const resolveTaxPeriod=(key:string):number=>{
    const matches:number[]=[]
    finance.periods.forEach((period,index)=>{
      if(key===String(index+1)||key===String(period.index)||key===period.startDate||key===period.endDate||
        (key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7)))matches.push(index)
    })
    return matches.length===1?matches[0]:-1
  }
  const taxDraft=input.drafts.tax??{system:null,rates:[],allowances:[],lossCarryForward:null,lossCarryForwardYears:null}
  if(taxDraft.system==='none') {
    finance={...finance,taxRatesByPeriod:finance.periods.map(()=>0),taxAllowancesByPeriod:finance.periods.map(()=>0),
      openingTaxLoss:0,openingUnleveredTaxLoss:0,taxLossCarryForwardEnabled:false}
  } else {
    if(taxDraft.rates.length) {
      const rates=Array(finance.periods.length).fill(Number.NaN) as number[]
      for(const row of taxDraft.rates) {
        const index=resolveTaxPeriod(row.period)
        if(index<0||row.ratePercent===null||!Number.isFinite(row.ratePercent)||row.ratePercent<0||row.ratePercent>100)
          return fail(['Tax rate rows must identify one project period and contain a rate from 0 to 100%.'])
        if(Number.isFinite(rates[index]))return fail(['Only one tax rate may be assigned to each project period.'])
        rates[index]=row.ratePercent
      }
      if(rates.some(rate=>!Number.isFinite(rate)))return fail(['The tax form must provide a rate for every project period when period rates are used.'])
      finance={...finance,taxRatesByPeriod:rates}
    }
    if(taxDraft.allowances.length) {
      const allowances=Array(finance.periods.length).fill(0) as number[]
      for(const allowance of taxDraft.allowances)for(const row of allowance.periodAmounts) {
        const index=resolveTaxPeriod(row.period)
        if(index<0||row.amount===null||!Number.isFinite(row.amount)||row.amount<0)
          return fail(['Every tax allowance amount must have a valid project-period key and a non-negative amount.'])
        allowances[index]+=row.amount
      }
      finance={...finance,taxAllowancesByPeriod:allowances}
    }
    if(taxDraft.lossCarryForward===false)finance={...finance,openingTaxLoss:0,openingUnleveredTaxLoss:0,taxLossCarryForwardEnabled:false}
    if(taxDraft.lossCarryForward===true) {
      if(taxDraft.lossCarryForwardYears!==null&&(!Number.isInteger(taxDraft.lossCarryForwardYears)||taxDraft.lossCarryForwardYears<1))
        return fail(['Tax-loss carry-forward duration must be a positive whole number of years.'])
      finance={...finance,taxLossCarryForwardEnabled:true,taxLossCarryForwardYears:taxDraft.lossCarryForwardYears}
    }
  }
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
  const openingForeignBalances={...input.openingForeignBalances,...Object.fromEntries(input.drafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingForeignBalance as number]))}
  const openingExchangeRatesToLocal={...input.openingExchangeRatesToLocal,...Object.fromEntries(input.drafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingExchangeRateToLocal as number]))}
  const finalRun=calculatePeriodicFinanceWithForeignCurrencyLoans({
    finance,loans:input.drafts.loans,foundation:input.foundation,
    openingBalances,taxTreatment:input.taxTreatment,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,
    openingForeignBalances,openingExchangeRatesToLocal,
  })
  if(!finalRun.valid)return {
    valid:false,issues:finalRun.issues,financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun,
  }
  return {valid:true,issues:[],financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun}
}
