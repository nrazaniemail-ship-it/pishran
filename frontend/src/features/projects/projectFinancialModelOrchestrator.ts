import type { ProjectFoundation, ProjectCalendarPeriod } from './projectFoundation'
import { validateOpeningBalanceSheetDraft, validateProjectModelCrossReferences, type ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
import { validateHelpDrivenProjectForms, validateHelpDrivenProjectPeriods, type HelpDrivenProjectForms } from './projectModelHelpForms'
import { fiscalYearIndexForPeriod, type PeriodicProjectFinanceInput, type PeriodicStatementOpeningBalances } from '../steel/periodicFinancialEngine'
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
import { bindHelpDrivenFinancialDrafts } from './helpDrivenFinancialDraftBinding'
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
    const match=periods.find(period=>key===String(period.index)||
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
    ...(typeof row.values.group==='string'&&row.values.group.trim()?{group:row.values.group.trim()}:{}),
    ...(typeof row.values.level==='string'&&row.values.level.trim()?{level:row.values.level.trim()}:{}),
    ...(typeof row.values.productIds==='string'&&row.values.productIds.trim()
      ?{productIds:row.values.productIds.split(/[;,]+/).map(id=>id.trim()).filter(Boolean)}:{}),
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
  const draftBinding=bindHelpDrivenFinancialDrafts(input.drafts.helpDriven,input.finance.periods,{
    assets:input.drafts.assets,productionCosts:input.drafts.productionCosts,
    sales:input.drafts.sales,workingCapital:input.drafts.workingCapital,loans:input.drafts.loans,
  })
  if(draftBinding.issues.length)return {valid:false,issues:draftBinding.issues,financeInput:null,productionSales:null,workingCapital:null,fixedAssets:null,finalRun:null}
  const effectiveDrafts={...input.drafts,...draftBinding.drafts}
  let finance=input.finance
  const foundationBinding=bindHelpDrivenFoundation(input.foundation,effectiveDrafts.helpDriven,input.finance.periods)
  if(foundationBinding.issues.length)return {valid:false,issues:foundationBinding.issues,financeInput:null,productionSales:null,workingCapital:null,fixedAssets:null,finalRun:null}
  const effectiveFoundation=foundationBinding.foundation
  let productionSales:ProductionSalesInventorySchedule|null=null
  let workingCapital:WorkingCapitalDraftSchedule|null=null
  let fixedAssets:FixedAssetFinanceBinding|null=null
  const fail=(issues:string[]):ProjectFinancialModelOrchestrationResult=>({
    valid:false,issues,financeInput:null,productionSales,workingCapital,fixedAssets,finalRun:null,
  })
  const openingDraft=effectiveDrafts.openingBalanceSheet
  const crossFormIssues=[...validateProjectModelCrossReferences(effectiveDrafts,input.projectProductIds),...(effectiveDrafts.helpDriven?validateHelpDrivenProjectForms(effectiveDrafts.helpDriven):[]),...(effectiveDrafts.helpDriven?validateHelpDrivenProjectPeriods(effectiveDrafts.helpDriven,input.finance.periods):[])]
  // Never let populated raw-template sections disappear silently from a financial run.
  // These sections require dedicated adapters and are deliberately rejected until their
  // schedules are represented in the periodic engine (rather than being treated as zero).
  const notYetIntegratedSections=new Set([
    'joint-venture',
    'profit-distribution','starting-balances',
    'economic-items','economic-effects','sensitivity','incremental-analysis',
  ])
  for(const [sectionId,sectionRows] of Object.entries(effectiveDrafts.helpDriven?.sections??{})){
    if(notYetIntegratedSections.has(sectionId)&&sectionRows.length){
      crossFormIssues.push('Raw-template section "'+sectionId+'" contains data but is not yet connected to the periodic financial calculation. The model run is blocked to prevent silently ignored inputs.')
    }
  }
  // Several sections are partially mapped. Reject only populated fields for which no
  // engine posting exists; supported sibling fields in the same section remain usable.
  const notYetMappedFields:Record<string,readonly string[]> = {
    'discounting':['shortNpvYears','referencePoint'],
    'economic-global':['method','numeraireType','numeraireCurrency','numeraireUnit','officialExchangeRate','shadowExchangeRate','standardConversionFactor','foreignCurrencyConversionFactor','referenceDate'],
    'income-tax':['taxSystem','taxCurrency','adjustmentPeriod','adjustmentAmount'],
    'production-costs':['initialStockQuantity','initialStockValue'],
    'sales-programme':['grossUnitPrice','productionActive','futureSalesQuantity','terminalInventorySale'],
    'working-capital':['mode','basis','activityBasis','daysCoverage','turnover','requiredQuantity','initialStockQuantity','initialStockValue','recoveryPeriod','depositPercent','depositRate','periodMonths'],
  }
  for(const [sectionId,fieldKeys] of Object.entries(notYetMappedFields)){
    for(const row of effectiveDrafts.helpDriven?.sections?.[sectionId]??[]){
      for(const fieldKey of fieldKeys){
        const value=row.values[fieldKey]
        if(value!==null&&value!==undefined&&value!==''){
          crossFormIssues.push('Raw-template field "'+sectionId+'.'+fieldKey+'" contains data but is not yet connected to the periodic financial calculation. The model run is blocked to prevent silently ignored inputs.')
        }
      }
    }
  }
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
  const discountingRow=effectiveDrafts.helpDriven?.sections?.['discounting']?.[0]
  if(discountingRow){
    const values=discountingRow.values
    const investmentRate=values.investmentRate
    const equityRate=values.equityRate
    const referenceDate=values.referenceDate
    const investmentReinvestmentRate=values.investmentReinvestmentRate
    const investmentBorrowingRate=values.investmentBorrowingRate
    const equityReinvestmentRate=values.equityReinvestmentRate
    const equityBorrowingRate=values.equityBorrowingRate
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
    const mirrRates=[
      ['mirrFinanceRatePercent',investmentBorrowingRate,'Total-investment MIRR borrowing rate'],
      ['mirrReinvestmentRatePercent',investmentReinvestmentRate,'Total-investment MIRR reinvestment rate'],
      ['equityMirrFinanceRatePercent',equityBorrowingRate,'Equity MIRR borrowing rate'],
      ['equityMirrReinvestmentRatePercent',equityReinvestmentRate,'Equity MIRR reinvestment rate'],
    ] as const
    for(const [key,rate,label] of mirrRates){
      if(rate===null||rate===undefined||rate==='')continue
      if(typeof rate!=='number'||!Number.isFinite(rate)||rate<=-100)
        return fail([label+' must be a finite rate greater than -100%.'])
      finance={...finance,[key]:rate}
    }
  }
  const depreciationAdjustmentRows=effectiveDrafts.helpDriven?.sections?.['depreciation-adjustments']??[]
  if(depreciationAdjustmentRows.length){
    const adjustments=Array(finance.periods.length).fill(0) as number[]
    for(const row of depreciationAdjustmentRows){
      const periodKey=typeof row.values.period==='string'?row.values.period.trim():''
      const periodIndex=periodKey?resolveTaxPeriod(periodKey):-1
      const amount=row.values.amount
      const origin=row.values.origin
      const currencyCode=typeof row.values.currency==='string'&&row.values.currency.trim()
        ?row.values.currency.trim().toUpperCase():effectiveFoundation.currencies.localCurrencyCode
      if(periodIndex<0||typeof amount!=='number'||!Number.isFinite(amount))
        return fail(['Tax depreciation adjustment '+row.id+' requires a valid project period and a finite signed amount.'])
      if(origin!=='local'&&origin!=='foreign')
        return fail(['Tax depreciation adjustment '+row.id+' must identify a local or foreign asset origin.'])
      if((origin==='local'&&currencyCode!==effectiveFoundation.currencies.localCurrencyCode)||
        (origin==='foreign'&&currencyCode===effectiveFoundation.currencies.localCurrencyCode))
        return fail(['Tax depreciation adjustment '+row.id+' has a currency that conflicts with its asset origin.'])
      const exchangeRate=currencyCode===effectiveFoundation.currencies.localCurrencyCode?1:
        effectiveFoundation.currencies.foreignCurrencies.find(currency=>currency.code===currencyCode)
          ?.exchangeRates.find(rate=>rate.period===String(finance.periods[periodIndex].index))?.rateToLocal
      if(!Number.isFinite(exchangeRate)||exchangeRate!<=0)
        return fail(['Tax depreciation adjustment currency '+currencyCode+' has no exchange rate for period '+periodKey+'.'])
      adjustments[periodIndex]+=amount*exchangeRate!
    }
    finance={...finance,taxDepreciationAdjustmentsByPeriod:adjustments}
  }
  const equityRows=effectiveDrafts.helpDriven?.sections?.['equity-grants']??[]
  if(equityRows.length){
    const annualContributions=[...finance.annualEquityContributions]
    for(const row of equityRows){
      const sourceType=row.values.sourceType
      const periodKey=typeof row.values.period==='string'?row.values.period.trim():''
      const periodIndex=periodKey?resolveTaxPeriod(periodKey):-1
      const amount=row.values.paidIn
      const paidOut=row.values.paidOut
      const preferredAbsolute=row.values.preferredDividendAbsolute
      const preferredPercent=row.values.preferredDividendPercent
      const shareClass=typeof row.values.shareClass==='string'?row.values.shareClass.trim():''
      if(sourceType!=='equity')
        return fail(['Equity/grant row '+row.id+' uses a grant or subsidy source; only paid-in equity contributions are currently connected to the periodic model.'])
      if(periodIndex<0||typeof amount!=='number'||!Number.isFinite(amount)||amount<0)
        return fail(['Equity contribution '+row.id+' requires a valid project period and a non-negative paid-in amount.'])
      if((typeof paidOut==='number'&&paidOut!==0)||(typeof preferredAbsolute==='number'&&preferredAbsolute!==0)||
        (typeof preferredPercent==='number'&&preferredPercent!==0)||shareClass)
        return fail(['Equity contribution '+row.id+' includes capital refunds, preferred dividends or share-class terms that are not yet supported by the periodic equity engine.'])
      const currencyCode=typeof row.values.currency==='string'&&row.values.currency.trim()
        ?row.values.currency.trim().toUpperCase():effectiveFoundation.currencies.localCurrencyCode
      const exchangeRate=currencyCode===effectiveFoundation.currencies.localCurrencyCode?1:
        effectiveFoundation.currencies.foreignCurrencies.find(currency=>currency.code===currencyCode)
          ?.exchangeRates.find(rate=>rate.period===String(finance.periods[periodIndex].index))?.rateToLocal
      if(!Number.isFinite(exchangeRate)||exchangeRate!<=0)
        return fail(['Equity contribution currency '+currencyCode+' has no exchange rate for period '+periodKey+'.'])
      const fiscalYear=fiscalYearIndexForPeriod(finance.periods[periodIndex],finance.periods,finance.fiscalYearStartMonth)
      if(fiscalYear<0||fiscalYear>=annualContributions.length)
        return fail(['Equity contribution '+row.id+' cannot be allocated to a project fiscal year.'])
      annualContributions[fiscalYear]+=amount*exchangeRate!
    }
    finance={...finance,annualEquityContributions:annualContributions}
  }
  const progressiveTaxRows=effectiveDrafts.helpDriven?.sections?.['tax-brackets']??[]
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
  const taxDraft=effectiveDrafts.tax??{system:null,rates:[],allowances:[],lossCarryForward:null,lossCarryForwardYears:null}
  const incomeTaxRow=effectiveDrafts.helpDriven?.sections?.['income-tax']?.[0]
  if(incomeTaxRow){
    const carryYears=incomeTaxRow.values.lossCarryForwardYears
    if(typeof carryYears==='number'){
      if(!Number.isInteger(carryYears)||carryYears<1)return fail(['Income-tax loss carry-forward duration must be a positive whole number of years.'])
      if(taxDraft.lossCarryForward!==false)
        finance={...finance,taxLossCarryForwardEnabled:true,taxLossCarryForwardYears:taxDraft.lossCarryForwardYears??carryYears}
    }

  }
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
    const helpTaxAllowances=effectiveDrafts.helpDriven?.sections?.['tax-allowances']??[]
    if(taxDraft.allowances.length||helpTaxAllowances.length) {
      const allowances=Array(finance.periods.length).fill(0) as number[]
      for(const allowance of taxDraft.allowances)for(const row of allowance.periodAmounts) {
        const index=resolveTaxPeriod(row.period)
        if(index<0||row.amount===null||!Number.isFinite(row.amount)||row.amount<0)
          return fail(['Every tax allowance amount must have a valid project-period key and a non-negative amount.'])
        allowances[index]+=row.amount
      }
      for(const row of helpTaxAllowances) {
        const periodKey=row.values.period
        const amount=row.values.amount
        const index=typeof periodKey==='string'?resolveTaxPeriod(periodKey):-1
        const currencyCode=typeof row.values.currency==='string'&&row.values.currency.trim()
          ?row.values.currency.trim().toUpperCase():effectiveFoundation.currencies.localCurrencyCode
        if(index<0||typeof amount!=='number'||!Number.isFinite(amount)||amount<0)
          return fail(['Every reference-driven tax allowance must have a valid period and a non-negative amount.'])
        const exchangeRate=currencyCode===effectiveFoundation.currencies.localCurrencyCode?1:
          effectiveFoundation.currencies.foreignCurrencies.find(currency=>currency.code===currencyCode)
            ?.exchangeRates.find(rate=>rate.period===String(finance.periods[index].index))?.rateToLocal
        if(!Number.isFinite(exchangeRate)||exchangeRate!<=0)
          return fail(['Tax allowance currency '+currencyCode+' has no exchange rate for period '+periodKey+'.'])
        allowances[index]+=amount*exchangeRate!
      }
      finance={...finance,taxAllowancesByPeriod:allowances}
    }
    if(taxDraft.lossCarryForward===false)finance={...finance,openingTaxLoss:0,openingUnleveredTaxLoss:0,taxLossCarryForwardEnabled:false}
    if(taxDraft.lossCarryForward===true) {
      const carryForwardYears=taxDraft.lossCarryForwardYears??
        (typeof incomeTaxRow?.values.lossCarryForwardYears==='number'?incomeTaxRow.values.lossCarryForwardYears:null)
      if(carryForwardYears!==null&&(!Number.isInteger(carryForwardYears)||carryForwardYears<1))
        return fail(['Tax-loss carry-forward duration must be a positive whole number of years.'])
      finance={...finance,taxLossCarryForwardEnabled:true,taxLossCarryForwardYears:carryForwardYears}
    }
  }
  if(incomeTaxRow){
    const holidayYears=incomeTaxRow.values.taxHolidayYears
    const suppliedHolidayEnd=incomeTaxRow.values.taxHolidayEndDate
    let holidayEnd=typeof suppliedHolidayEnd==='string'&&suppliedHolidayEnd.trim()?suppliedHolidayEnd.trim():''
    if(holidayYears!==null&&holidayYears!==undefined&&holidayYears!==''){
      if(typeof holidayYears!=='number'||!Number.isInteger(holidayYears)||holidayYears<1)
        return fail(['Tax holiday duration must be a positive whole number of years.'])
      const start=Date.parse(finance.periods[0].startDate+'T00:00:00.000Z')
      if(!Number.isFinite(start))return fail(['Tax holiday requires a valid project start date.'])
      const date=new Date(start),targetYear=date.getUTCFullYear()+holidayYears
      const targetDay=Math.min(date.getUTCDate(),new Date(Date.UTC(targetYear,date.getUTCMonth()+1,0)).getUTCDate())
      const anniversary=Date.UTC(targetYear,date.getUTCMonth(),targetDay)
      const derivedEnd=new Date(anniversary-86400000).toISOString().slice(0,10)
      if(holidayEnd&&holidayEnd!==derivedEnd)return fail(['Tax holiday end date and duration do not reconcile.'])
      holidayEnd=derivedEnd
    }
    if(holidayEnd){
      const parsed=Date.parse(holidayEnd+'T00:00:00.000Z')
      if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==holidayEnd||
        holidayEnd<finance.periods[0].startDate||holidayEnd>finance.periods[finance.periods.length-1].endDate)
        return fail(['Tax holiday end date must be a valid date inside the project calendar.'])
      const boundary=finance.periods.findIndex(period=>period.endDate===holidayEnd)
      if(boundary<0)return fail(['Tax holiday end date must align with a project-period boundary.'])
      const rates=finance.taxRatesByPeriod??finance.periods.map(period=>{
        const yearIndex=fiscalYearIndexForPeriod(period,finance.periods,finance.fiscalYearStartMonth)
        return finance.annualTaxRates[yearIndex]??Number.NaN
      })
      if(rates.some(rate=>!Number.isFinite(rate)))return fail(['Tax holiday cannot be applied because the base tax schedule is incomplete.'])
      for(let index=0;index<=boundary;index++)rates[index]=0
      finance={...finance,taxRatesByPeriod:rates,
        ...(finance.taxBracketsByPeriod?{taxBracketsByPeriod:finance.taxBracketsByPeriod.map((brackets,index)=>
          index<=boundary?brackets.map(bracket=>({...bracket,ratePercent:0})):brackets)}:{})}
    }
  }
  const detailedOpeningNwc=openingDraft?.enabled
    ?openingDraft.inventory!+openingDraft.workInProgress!+openingDraft.finishedGoods!+openingDraft.receivables!+
      openingDraft.otherCurrentAssets!-openingDraft.tradePayables!-openingDraft.otherCurrentLiabilities!
    :undefined

  if(effectiveDrafts.sales.length||effectiveDrafts.productionCosts.length) {
    const openingFinishedGoodsByProduct=input.openingFinishedGoodsByProduct??Object.fromEntries(effectiveDrafts.sales.map(product=>[product.productId,product.openingFinishedGoodsQuantity??Number.NaN]))
    const result=bindProductionSalesToPeriodicFinance(finance,effectiveDrafts,openingFinishedGoodsByProduct)
    productionSales=result.schedule
    if(!result.valid||!result.financeInput)return fail(result.issues)
    finance=result.financeInput
  }
  if(effectiveDrafts.workingCapital.length) {
    const componentOpeningBalances=effectiveDrafts.workingCapital.map(component=>component.openingBalance)
    if(input.openingWorkingCapital==null&&componentOpeningBalances.some(value=>!Number.isFinite(value)||value!<0))
      return fail(['Every working-capital component requires an explicit non-negative opening balance.'])
    const openingWorkingCapital=input.openingWorkingCapital??detailedOpeningNwc??effectiveDrafts.workingCapital.reduce((sum,component)=>{
      const liability=component.category==='payables'||component.category==='other-current-liability'
      return sum+(liability?-1:1)*(component.openingBalance??0)
    },0)
    if(openingWorkingCapital<0)return fail(['Opening net working capital cannot be negative in this model input.'])
    const result=bindWorkingCapitalDraftsToPeriodicFinance(
      finance,{workingCapital:effectiveDrafts.workingCapital},openingWorkingCapital,
    )
    workingCapital=result.schedule
    if(!result.valid||!result.financeInput)return fail(result.issues)
    finance=result.financeInput
  }
  if(effectiveDrafts.assets.length) {
    fixedAssets=bindFixedAssetDraftsToPeriodicFinance({
      finance,assets:effectiveDrafts.assets,foundation:effectiveFoundation,
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
  const openingForeignBalances={...input.openingForeignBalances,...Object.fromEntries(effectiveDrafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingForeignBalance as number]))}
  const openingExchangeRatesToLocal={...input.openingExchangeRatesToLocal,...Object.fromEntries(effectiveDrafts.loans
    .filter(loan=>loan.marketOrigin==='foreign'&&(loan.openingForeignBalance??0)>0)
    .map(loan=>[loan.id,loan.openingExchangeRateToLocal as number]))}
  const finalRun=calculatePeriodicFinanceWithForeignCurrencyLoans({
    finance,loans:effectiveDrafts.loans,foundation:effectiveFoundation,
    openingBalances,taxTreatment:input.taxTreatment,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,
    openingForeignBalances,openingExchangeRatesToLocal,
  })
  if(!finalRun.valid)return {
    valid:false,issues:finalRun.issues,financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun,
  }
  return {valid:true,issues:[],financeInput:finance,productionSales,workingCapital,fixedAssets,finalRun}
}
