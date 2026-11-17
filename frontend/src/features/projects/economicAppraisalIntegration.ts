import type { ProjectFoundation } from './projectFoundation'
import type { HelpDrivenProjectForms, HelpFormRow } from './projectModelHelpForms'
import {
  calculatePeriodicIrr,
  calculatePeriodicNpv,
  type PeriodicProjectFinanceInput,
} from '../steel/periodicFinancialEngine'

export type EconomicAppraisalConfiguration={
  enabled:boolean
  method:'cost-benefit'|'value-added'
  numeraireType:'local-domestic-prices'|'local-border-prices'|'foreign-border-prices'
  numeraireCurrency:string
  numeraireUnit:'units'|'tens'|'hundreds'|'thousands'|'millions'
  officialExchangeRate:number
  shadowExchangeRate:number
  standardConversionFactor:number
  foreignCurrencyConversionFactor:number|null
  discountRatePercent:number
  referenceDate:string
}

export type EconomicCashFlowPeriod={
  period:number
  startDate:string
  endDate:string
  benefits:number
  costs:number
  netBenefits:number
}

export type EconomicCashFlowResult={
  currency:string
  unit:EconomicAppraisalConfiguration['numeraireUnit']
  periods:EconomicCashFlowPeriod[]
  netCashFlows:number[]
  presentValueBenefits:number
  presentValueCosts:number
  enpv:number
  eirr:number|null
  benefitCostRatio:number|null
  irrStatus:'calculated'|'no-single-conventional-root'
}

export type EconomicAppraisalConfigurationResult={
  valid:boolean
  issues:string[]
  configuration:EconomicAppraisalConfiguration|null
  cashFlow:EconomicCashFlowResult|null
  status:'not-requested'|'configuration-ready-not-valued'|'calculated'|'blocked'
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const populated=(row:HelpFormRow|undefined):boolean=>!!row&&Object.values(row.values??{}).some(value=>value!==null&&value!==''&&value!==undefined)
const resolvePeriod=(key:string,finance:PeriodicProjectFinanceInput):number=>{
  const matches:number[]=[]
  finance.periods.forEach((period,index)=>{
    if(key===String(index+1)||key===String(period.index)||key===period.startDate||key===period.endDate||
      (key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7)))matches.push(index)
  })
  return matches.length===1?matches[0]:-1
}

/**
 * Economic items are deliberately accepted only as explicit, period-specific
 * values already converted to the selected numeraire currency and reporting
 * unit. This boundary does not infer shadow prices from incomplete item data.
 */
export function bindEconomicAppraisalConfiguration(
  forms:HelpDrivenProjectForms|undefined,
  foundation:ProjectFoundation,
  finance:PeriodicProjectFinanceInput,
):EconomicAppraisalConfigurationResult {
  const issues:string[]=[]
  const rows=forms?.sections??{}
  const identification=rows['project-identification']?.[0]
  const enabled=identification?.values.economicAnalysis===true
  const row=rows['economic-global']?.[0]
  const values=row?.values??{}
  const hasParameters=populated(row)
  const allEconomicItems=rows['economic-items']??[]
  const assignedItems=allEconomicItems.filter(item=>item.values.assignedToEconomicBrowser===true)
  const populatedEffects=(rows['economic-effects']??[]).filter(populated)

  if(!enabled){
    if(assignedItems.length)issues.push('Economic items are assigned to the economic model, but economic analysis is disabled in project identification.')
    if(populatedEffects.length)issues.push('Economic effects are populated, but economic analysis is disabled. Enable economic analysis or remove the unprocessed effects before running the model.')
    const economicRate=values.discountRate
    if(economicRate!==null&&economicRate!==undefined&&economicRate!==''&&
      (!finite(economicRate)||economicRate<0||economicRate>100))
      issues.push('Economic discount rate must be between 0% and 100%.')
    if(issues.length)return {valid:false,issues,configuration:null,cashFlow:null,status:'blocked'}
    return {valid:true,issues:[],configuration:null,cashFlow:null,status:'not-requested'}
  }

  const required=(key:string,label:string):unknown=>{
    const value=values[key]
    if(value===null||value===undefined||value===''){issues.push('Economic appraisal requires '+label+'.');return null}
    return value
  }
  const method=required('method','an analysis method')
  const numeraireType=required('numeraireType','a numeraire price basis')
  const numeraireCurrency=required('numeraireCurrency','a numeraire currency')
  const numeraireUnit=required('numeraireUnit','a reporting unit')
  const oer=required('officialExchangeRate','the official exchange rate')
  const ser=required('shadowExchangeRate','the shadow exchange rate')
  const scf=required('standardConversionFactor','the standard conversion factor')
  const discount=required('discountRate','the economic discount rate')
  const referenceDate=required('referenceDate','an economic reference date')
  const fcf=values.foreignCurrencyConversionFactor

  if(method!=='cost-benefit'&&method!=='value-added')issues.push('Economic analysis method must be cost-benefit or value-added.')
  if(method==='value-added')issues.push('Value-added economic analysis is not yet implemented. Select cost-benefit only when explicit period economic values are available.')
  if(!['local-domestic-prices','local-border-prices','foreign-border-prices'].includes(String(numeraireType)))issues.push('Economic numeraire price basis is invalid.')
  const currency=typeof numeraireCurrency==='string'?numeraireCurrency.trim().toUpperCase():''
  if(!currency)issues.push('Economic numeraire currency must be a non-empty currency code.')
  else if(![foundation.currencies.localCurrencyCode,...foundation.currencies.foreignCurrencies.map(item=>item.code)].some(code=>code.toUpperCase()===currency))
    issues.push('Economic numeraire currency '+currency+' is not defined in the project currency directory.')
  if(!['units','tens','hundreds','thousands','millions'].includes(String(numeraireUnit)))issues.push('Economic numeraire reporting unit is invalid.')
  if(!finite(oer)||oer<=0)issues.push('Official exchange rate must be finite and greater than zero.')
  if(!finite(ser)||ser<=0)issues.push('Shadow exchange rate must be finite and greater than zero.')
  if(!finite(scf)||scf<=0)issues.push('Standard conversion factor must be finite and greater than zero.')
  if(fcf!==null&&fcf!==undefined&&fcf!==''&&(!finite(fcf)||fcf<=0))issues.push('Foreign-currency conversion factor must be finite and greater than zero.')
  if(finite(oer)&&oer>0&&finite(ser)&&ser>0&&finite(scf)&&scf>0&&Math.abs(scf-oer/ser)>Math.max(0.000001,Math.abs(oer/ser)*0.01))
    issues.push('Standard conversion factor does not reconcile to the entered OER/SER ratio within 1%.')
  if(fcf!==null&&fcf!==undefined&&fcf!==''&&finite(oer)&&oer>0&&finite(ser)&&ser>0&&finite(fcf)&&Math.abs(fcf-ser/oer)>Math.max(0.000001,Math.abs(ser/oer)*0.01))
    issues.push('Foreign-currency conversion factor does not reconcile to the entered SER/OER ratio within 1%.')
  if(!finite(discount)||discount<0||discount>100)issues.push('Economic discount rate must be between 0% and 100%.')
  if(typeof referenceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)||(()=>{
    if(typeof referenceDate!=='string')return true
    const [y,m,d]=referenceDate.split('-').map(Number)
    const date=new Date(Date.UTC(y,m-1,d))
    return date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d
  })())issues.push('Economic reference date must be a valid ISO calendar date.')

  if(typeof referenceDate==='string'&&finance.periods.length){
    const referenceTimestamp=Date.parse(referenceDate+'T00:00:00Z')
    const finalPeriodEnd=Date.parse(finance.periods[finance.periods.length-1].endDate+'T23:59:59Z')
    if(Number.isFinite(referenceTimestamp)&&Number.isFinite(finalPeriodEnd)&&referenceTimestamp>finalPeriodEnd)
      issues.push('Economic reference date cannot be later than the final project period.')
  }
  for(const effect of populatedEffects){
    const type=effect.values.type
    const period=typeof effect.values.period==='string'?effect.values.period.trim():''
    if(!period||resolvePeriod(period,finance)<0)
      issues.push('Economic effect '+effect.id+' requires a valid project-calendar period before valuation.')
    if(type==='foreign-loan'){
      issues.push('Economic effect '+effect.id+' is a foreign-loan financing transfer. Loan principal and financing transfers must remain in the financial model and must not be counted as economic benefits or costs; any real resource cost requires a separately evidenced economic valuation.')
    }else if(type==='indirect-effect'){
      issues.push('Economic effect '+effect.id+' is an indirect effect. It cannot enter economic cash flow until its physical impact, counterfactual, affected period and applicable shadow price are explicitly evidenced.')
    }else if(type==='employment'){
      issues.push('Economic effect '+effect.id+' is employment. Headcount and shadow-wage factor alone are insufficient: a period-specific wage/cost base and a defensible counterfactual opportunity wage are required before calculating an economic employment benefit.')
    }else if(type==='environmental'){
      issues.push('Economic effect '+effect.id+' is environmental. A physical quantity, measurement unit, counterfactual and period-specific shadow damage/abatement price are required before valuation.')
    }else{
      issues.push('Economic effect '+effect.id+' has an unsupported effect type and cannot enter economic cash flow.')
    }
  }
  if(!assignedItems.length)issues.push('Economic appraisal requires at least one item assigned to the economic browser with a period-specific numeraire value.')
  const unsupportedFields=['financialValue','firstAppearancePrice','firstAppearanceQuantity','borderPrice','adjustmentFactor','adjustedMarketValue','fxExposure','taxesDutiesIncludedPercent','valueAddedIncludedPercent','exportablePercent','importablePercent','importSubstitutionPercent','transportAdjustedValue','transportForeignExposurePercent','otherAdjustedValue','otherForeignExposurePercent','consumerOrProducerPrice','subsidyNegativeTax']
  for(const item of assignedItems){
    const v=item.values
    if(typeof v.item!=='string'||!v.item.trim())issues.push('Economic item '+item.id+' requires a description.')
    if(typeof v.financialItemId!=='string'||!v.financialItemId.trim())issues.push('Economic item '+item.id+' requires a linked financial item ID.')
    if(v.direction!=='input'&&v.direction!=='output')issues.push('Economic item '+item.id+' requires direction input or output.')
    if(typeof v.period!=='string'||!v.period.trim()||resolvePeriod(v.period.trim(),finance)<0)issues.push('Economic item '+item.id+' requires a valid project-calendar period.')
    if(!finite(v.periodNumeraireValue)||v.periodNumeraireValue<0)issues.push('Economic item '+item.id+' requires a finite, non-negative final period value in the selected numeraire.')
    if(typeof v.currency!=='string'||v.currency.trim().toUpperCase()!==currency)issues.push('Economic item '+item.id+' currency must equal the selected numeraire currency '+currency+'.')
    for(const field of unsupportedFields){
      const value=v[field]
      if(value!==null&&value!==undefined&&value!=='')
        issues.push('Economic item '+item.id+' also contains '+field+', which is not applied by the explicit numeraire-value pathway. Remove it or wait for the corresponding shadow-price adapter.')
    }
  }
  if(issues.length)return {valid:false,issues,configuration:null,cashFlow:null,status:'blocked'}

  const configuration:EconomicAppraisalConfiguration={
    enabled:true,method:method as EconomicAppraisalConfiguration['method'],
    numeraireType:numeraireType as EconomicAppraisalConfiguration['numeraireType'],
    numeraireCurrency:currency,numeraireUnit:numeraireUnit as EconomicAppraisalConfiguration['numeraireUnit'],
    officialExchangeRate:oer as number,shadowExchangeRate:ser as number,
    standardConversionFactor:scf as number,
    foreignCurrencyConversionFactor:finite(fcf)?fcf:null,
    discountRatePercent:discount as number,referenceDate:referenceDate as string,
  }
  const benefits=finance.periods.map(()=>0)
  const costs=finance.periods.map(()=>0)
  for(const item of assignedItems){
    const index=resolvePeriod(String(item.values.period),finance)
    const amount=item.values.periodNumeraireValue as number
    if(item.values.direction==='output')benefits[index]+=amount
    else costs[index]+=amount
  }
  const netCashFlows=benefits.map((benefit,index)=>benefit-costs[index])
  const presentValueBenefits=calculatePeriodicNpv(benefits,finance.periods,discount as number,finance.dayCountBasis,finance.cashFlowTiming,referenceDate as string,'actual-days',1)
  const presentValueCosts=calculatePeriodicNpv(costs,finance.periods,discount as number,finance.dayCountBasis,finance.cashFlowTiming,referenceDate as string,'actual-days',1)
  const enpv=calculatePeriodicNpv(netCashFlows,finance.periods,discount as number,finance.dayCountBasis,finance.cashFlowTiming,referenceDate as string,'actual-days',1)
  if(![presentValueBenefits,presentValueCosts,enpv].every(Number.isFinite))
    return {valid:false,issues:['Economic present-value calculation failed. Verify the economic reference date, project periods and numeraire cash-flow values.'],configuration:null,cashFlow:null,status:'blocked'}
  const eirr=calculatePeriodicIrr(netCashFlows,finance.periods,finance.dayCountBasis,finance.cashFlowTiming)
  const cashFlow:EconomicCashFlowResult={
    currency,unit:configuration.numeraireUnit,
    periods:finance.periods.map((period,index)=>({
      period:period.index,startDate:period.startDate,endDate:period.endDate,
      benefits:benefits[index],costs:costs[index],netBenefits:netCashFlows[index],
    })),
    netCashFlows,presentValueBenefits,presentValueCosts,enpv,eirr,
    benefitCostRatio:presentValueCosts>0?presentValueBenefits/presentValueCosts:null,
    irrStatus:eirr===null?'no-single-conventional-root':'calculated',
  }
  return {valid:true,issues:[],configuration,cashFlow,status:'calculated'}
}
