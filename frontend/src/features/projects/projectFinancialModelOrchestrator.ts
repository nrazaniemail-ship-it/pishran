import type { ProjectFoundation, ProjectCalendarPeriod } from './projectFoundation'
import { validateOpeningBalanceSheetDraft, validateProjectModelCrossReferences, type ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
import { validateHelpDrivenProjectForms, validateHelpDrivenProjectPeriods, type HelpDrivenProjectForms } from './projectModelHelpForms'
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

export function bindHelpDrivenFoundation(
  foundation:ProjectFoundation,
  forms:HelpDrivenProjectForms|undefined,
  periods:readonly ProjectCalendarPeriod[],
):{foundation:ProjectFoundation;issues:string[]} {
  if(!forms)return {foundation,issues:[]}
  const issues:string[]=[]
  let result=foundation
  const rows=(id:string)=>forms.sections?.[id]??[]
  const resolvePeriod=(key:string,date?:string):string|null=>{
    const match=periods.find(period=>key===String(period.index)||key===String(period.index+1)||
      key===period.startDate||key===period.endDate||
      (key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7))||
      (date!=null&&date>=period.startDate&&date<=period.endDate))
    return match?String(match.index):null
  }
  const currencies=rows('currencies')
  if(currencies.length){
    const local=currencies.find(row=>row.values.type==='local')
    if(!local){issues.push('A local currency is required in the help-driven currency directory.');return {foundation,issues}}
    const localCode=String(local.values.code??'').trim().toUpperCase()
    const localName=String(local.values.name??'').trim()
    const rateRows=rows('currency-rates')
    const foreignCurrencies=currencies.filter(row=>row.values.type==='foreign').map(row=>{
      const code=String(row.values.code??'').trim().toUpperCase()
      const rates=rateRows.filter(rate=>String(rate.values.currencyCode??'').trim().toUpperCase()===code)
      const mapped=rates.map(rate=>{
        const period=resolvePeriod(String(rate.values.period??'').trim(),typeof rate.values.effectiveDate==='string'?rate.values.effectiveDate:undefined)
        if(!period||typeof rate.values.exchangeRate!=='number'||!Number.isFinite(rate.values.exchangeRate)||rate.values.exchangeRate<=0){
          issues.push('Invalid or out-of-calendar exchange-rate row for '+code+'.')
          return null
        }
        return {period,rateToLocal:rate.values.exchangeRate}
      }).filter((rate):rate is {period:string;rateToLocal:number}=>rate!==null)
      if(!mapped.length&&typeof row.values.exchangeRate==='number'&&typeof row.values.effectiveDate==='string'){
        const period=resolvePeriod('',row.values.effectiveDate)
        if(period)mapped.push({period,rateToLocal:row.values.exchangeRate})
      }
      if(!mapped.length)issues.push('Foreign currency '+code+' requires at least one dated period exchange rate.')
      return {id:row.id,code,name:String(row.values.name??'').trim(),exchangeRates:mapped}
    })
    result={...result,currencies:{...result.currencies,localCurrencyCode:localCode,localCurrencyName:localName,foreignCurrencies}}
  }
  const costCentres=rows('cost-centres')
  if(costCentres.length)result={...result,costCentres:{active:true,items:costCentres.map(row=>({
    id:row.id,code:row.id,name:String(row.values.name??'').trim(),
    ...(typeof row.values.parentId==='string'&&row.values.parentId.trim()?{parentId:row.values.parentId.trim()}:{}),
  }))}}
  const inflationRows=rows('inflation')
  if(inflationRows.length){
    const groups=new Map<string,typeof inflationRows>()
    for(const row of inflationRows){
      const code=String(row.values.currencyCode??'').trim().toUpperCase()
      if(!code){issues.push('Inflation rows must identify a currency code.');continue}
      groups.set(code,[...(groups.get(code)??[]),row])
    }
    const indices=[...groups.entries()].map(([code,group])=>{
      const sorted=[...group].sort((a,b)=>{
        const ai=resolvePeriod(String(a.values.period??'').trim())
        const bi=resolvePeriod(String(b.values.period??'').trim())
        return (ai===null?Number.POSITIVE_INFINITY:Number(ai))-(bi===null?Number.POSITIVE_INFINITY:Number(bi))
      })
      let previousIndex:number|null=null
      const rates=sorted.map(row=>{
        const period=resolvePeriod(String(row.values.period??'').trim(),typeof row.values.effectiveDate==='string'?row.values.effectiveDate:undefined)
        const priceIndex=typeof row.values.priceIndex==='number'?row.values.priceIndex:null
        const explicitRate=typeof row.values.inflationPercent==='number'?row.values.inflationPercent:null
        if(!period||((priceIndex===null)&&(explicitRate===null))||
          (priceIndex!==null&&(!Number.isFinite(priceIndex)||priceIndex<=0))||
          (explicitRate!==null&&(!Number.isFinite(explicitRate)||explicitRate< -100))){
          issues.push('Invalid inflation index or period for currency '+code+'.')
          return null
        }
        const derivedRate=priceIndex===null?null:previousIndex===null?0:(priceIndex/previousIndex-1)*100
        if(derivedRate!==null&&explicitRate!==null&&Math.abs(derivedRate-explicitRate)>0.05){
          issues.push('Inflation rate and price-index movement do not reconcile for '+code+' in period '+period+'.')
          return null
        }
        if(priceIndex!==null)previousIndex=priceIndex
        return {period,ratePercent:explicitRate??derivedRate as number}
      }).filter((rate):rate is {period:string;ratePercent:number}=>rate!==null)
      return {id:'inflation-'+code,name:code,currencyCode:code,rates}
    })
    if(indices.some(index=>!result.currencies.foreignCurrencies.some(currency=>currency.code===index.currencyCode)&&
      result.currencies.localCurrencyCode!==index.currencyCode))
      issues.push('Inflation schedules must reference a currency in the project currency directory.')
    result={...result,inflation:{active:true,indices}}
  }
  const economicGlobal=rows('economic-global')[0]
  if(economicGlobal&&typeof economicGlobal.values.discountRate==='number'){
    const rate=economicGlobal.values.discountRate
    if(!Number.isFinite(rate)||rate<0||rate>100)issues.push('Economic discount rate must be between 0% and 100%.')
    else result={...result,discounting:{...result.discounting,economicRatePercent:rate}}
  }
  return {foundation:result,issues}
}

export type ProjectFinancialModelOrchestrationInput={
  finance:PeriodicProjectFinanceInput
  drafts:Pick<ProjectModelFinancialFormDrafts,'sales'|'productionCosts'|'workingCapital'|'assets'|'loans'|'tax'> & Partial<Pick<ProjectModelFinancialFormDrafts,'openingBalanceSheet'>> & {helpDriven?:HelpDrivenProjectForms}
  foundation:ProjectFoundation
  productionStartDate:string
  projectProductIds?:readonly string[]
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
  const foundationBinding=bindHelpDrivenFoundation(input.foundation,input.drafts.helpDriven,input.finance.periods)
  if(foundationBinding.issues.length)return {valid:false,issues:foundationBinding.issues,financeInput:null,productionSales:null,workingCapital:null,fixedAssets:null,finalRun:null}
  const effectiveFoundation=foundationBinding.foundation
  let productionSales:ProductionSalesInventorySchedule|null=null
  let workingCapital:WorkingCapitalDraftSchedule|null=null
  let fixedAssets:FixedAssetFinanceBinding|null=null
  const fail=(issues:string[]):ProjectFinancialModelOrchestrationResult=>({
    valid:false,issues,financeInput:null,productionSales,workingCapital,fixedAssets,finalRun:null,
  })
  const openingDraft=input.drafts.openingBalanceSheet
  const crossFormIssues=[...validateProjectModelCrossReferences(input.drafts,input.projectProductIds),...(input.drafts.helpDriven?validateHelpDrivenProjectForms(input.drafts.helpDriven):[]),...(input.drafts.helpDriven?validateHelpDrivenProjectPeriods(input.drafts.helpDriven,input.finance.periods):[])]
  if(crossFormIssues.length)return fail(crossFormIssues)
  const resolveTaxPeriod=(key:string):number=>{
    const matches:number[]=[]
    finance.periods.forEach((period,index)=>{
      if(key===String(index+1)||key===String(period.index)||key===period.startDate||key===period.endDate||
        (key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7)))matches.push(index)
    })
    return matches.length===1?matches[0]:-1
  }
  // Explicit reference-driven discounting inputs override foundation-derived rates only when populated.
  const discountingRow=input.drafts.helpDriven?.sections?.['discounting']?.[0]
  if(discountingRow){
    const values=discountingRow.values
    const investmentRate=values.investmentRate
    const equityRate=values.equityRate
    const referenceDate=values.referenceDate
    if(investmentRate!==null&&investmentRate!==undefined&&investmentRate!==''){
      if(typeof investmentRate!=='number'||!Number.isFinite(investmentRate)||investmentRate<0||investmentRate>100)
        return fail(['Total-investment discount rate must be between 0% and 100%.'])
      finance={...finance,discountRatePercent:investmentRate}
    }
    if(equityRate!==null&&equityRate!==undefined&&equityRate!==''){
      if(typeof equityRate!=='number'||!Number.isFinite(equityRate)||equityRate<0||equityRate>100)
        return fail(['Total-equity discount rate must be between 0% and 100%.'])
      finance={...finance,equityDiscountRatePercent:equityRate}
    }
    if(typeof referenceDate==='string'&&referenceDate.trim()){
      const parsed=Date.parse(referenceDate+'T00:00:00.000Z')
      if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==referenceDate)
        return fail(['Discount reference date must be a valid ISO calendar date.'])
      finance={...finance,valuationDate:referenceDate}
    }
  }
  const progressiveTaxRows=input.drafts.helpDriven?.sections?.['tax-brackets']??[]
  if(progressiveTaxRows.length){
    const bracketsByPeriod=finance.periods.map(()=>[] as {lowerLimit:number;ratePercent:number}[])
    for(const row of progressiveTaxRows){
      const periodKey=row.values.period
      const lowerLimit=row.values.lowerLimit
      const ratePercent=row.values.rate
      const periodIndex=typeof periodKey==='string'?resolveTaxPeriod(periodKey):-1
      if(periodIndex<0||typeof lowerLimit!=='number'||!Number.isFinite(lowerLimit)||lowerLimit<0||
        typeof ratePercent!=='number'||!Number.isFinite(ratePercent)||ratePercent<0||ratePercent>100)
        return fail(['Every progressive tax bracket must have a valid project period, non-negative lower limit and rate from 0% to 100%.'])
      bracketsByPeriod[periodIndex].push({lowerLimit,ratePercent})
    }
    for(let index=0;index<bracketsByPeriod.length;index++){
      const brackets=bracketsByPeriod[index].sort((a,b)=>a.lowerLimit-b.lowerLimit)
      if(!brackets.length||brackets[0].lowerLimit!==0||
        brackets.some((row,bracketIndex)=>bracketIndex>0&&
          (row.lowerLimit<=brackets[bracketIndex-1].lowerLimit||row.ratePercent<brackets[bracketIndex-1].ratePercent)))
        return fail(['Progressive tax brackets must be defined for every period, start at zero and use increasing limits with non-decreasing rates.'])
    }
    finance={...finance,taxBracketsByPeriod:bracketsByPeriod}
  }
  const taxDraft=input.drafts.tax??{system:null,rates:[],allowances:[],lossCarryForward:null,lossCarryForwardYears:null}
  if(taxDraft.system==='none') {
    finance={...finance,taxRatesByPeriod:finance.periods.map(()=>0),taxBracketsByPeriod:undefined,
      taxAllowancesByPeriod:finance.periods.map(()=>0),openingTaxLoss:0,openingUnleveredTaxLoss:0,taxLossCarryForwardEnabled:false}
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
      finance,assets:input.drafts.assets,foundation:effectiveFoundation,
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
    finance,loans:input.drafts.loans,foundation:effectiveFoundation,
    openingBalances,taxTreatment:input.taxTreatment,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,
    openingForeignBalances,openingExchangeRatesToLocal,
  })
  if(!finalRun.valid)return {
    valid:false,issues:finalRun.issues,financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun,
  }
  return {valid:true,issues:[],financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun}
}
