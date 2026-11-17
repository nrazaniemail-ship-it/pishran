import type { ProjectFoundation } from './projectFoundation'
import type { HelpDrivenProjectForms, HelpFormRow } from './projectModelHelpForms'

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

export type EconomicAppraisalConfigurationResult={
  valid:boolean
  issues:string[]
  configuration:EconomicAppraisalConfiguration|null
  status:'not-requested'|'configuration-ready-not-valued'|'blocked'
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const populated=(row:HelpFormRow|undefined):boolean=>!!row&&Object.values(row.values??{}).some(value=>value!==null&&value!==''&&value!==undefined)

/**
 * Validates the economic-appraisal control parameters independently from the
 * financial cash-flow engine. It intentionally does not calculate ENPV/EIRR:
 * economic items have no period allocation and effects do not yet have complete
 * shadow-price valuation contracts.
 */
export function bindEconomicAppraisalConfiguration(
  forms:HelpDrivenProjectForms|undefined,
  foundation:ProjectFoundation,
):EconomicAppraisalConfigurationResult {
  const issues:string[]=[]
  const rows=forms?.sections??{}
  const identification=rows['project-identification']?.[0]
  const enabled=identification?.values.economicAnalysis===true
  const row=rows['economic-global']?.[0]
  const values=row?.values??{}
  const hasParameters=populated(row)
  const economicItems=rows['economic-items']??[]
  const economicEffects=rows['economic-effects']??[]
  if(economicItems.length)issues.push('Economic items are not yet valued by period. Each item needs an explicit period-allocation schedule linked to a financial quantity/value series before it can enter economic cash flow.')
  if(economicEffects.length)issues.push('Economic effects are not yet valued. Foreign-loan transfers, indirect effects, employment and environmental effects require distinct period-specific shadow-price valuation rules before they can enter economic cash flow.')
  if(!enabled&&!hasParameters){
    if(issues.length)return {valid:false,issues,configuration:null,status:'blocked'}
    return {valid:true,issues:[],configuration:null,status:'not-requested'}
  }
  if(!enabled){
    const economicRate=values.discountRate
    if(economicRate!==null&&economicRate!==undefined&&economicRate!==''&&
      (!finite(economicRate)||economicRate<0||economicRate>100))
      issues.push('Economic discount rate must be between 0% and 100%.')
    if(issues.length)return {valid:false,issues,configuration:null,status:'blocked'}
    return {valid:true,issues:[],configuration:null,status:'not-requested'}
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
  if(typeof referenceDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)||(()=>{if(typeof referenceDate!=='string')return true;const [y,m,d]=referenceDate.split('-').map(Number);const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d})())
    issues.push('Economic reference date must be a valid ISO calendar date.')
  if(issues.length)return {valid:false,issues,configuration:null,status:'blocked'}
  return {
    valid:true,issues:[],
    configuration:{
      enabled,method:method as EconomicAppraisalConfiguration['method'],
      numeraireType:numeraireType as EconomicAppraisalConfiguration['numeraireType'],
      numeraireCurrency:currency,numeraireUnit:numeraireUnit as EconomicAppraisalConfiguration['numeraireUnit'],
      officialExchangeRate:oer as number,shadowExchangeRate:ser as number,
      standardConversionFactor:scf as number,
      foreignCurrencyConversionFactor:finite(fcf)?fcf:null,
      discountRatePercent:discount as number,referenceDate:referenceDate as string,
    },
    status:'configuration-ready-not-valued',
  }
}
