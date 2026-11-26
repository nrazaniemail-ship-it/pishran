import type { ProjectCalendarPeriod } from './projectFoundation'
import type { ProjectTaxFormDraft } from './projectModelFormDrafts'
import { fiscalYearIndexForPeriod, type TaxLossVintage } from '../steel/periodicFinancialEngine'

export type ProjectTaxDraftSchedule = {
  active:boolean
  valid:boolean
  issues:string[]
  annualTaxRates:number[]
  taxRatesByPeriod:number[]
  taxLossCarryForwardEnabled:boolean
  taxLossCarryForwardYears:number|null
  openingTaxLoss:number
  openingTaxLossVintages:TaxLossVintage[]
  taxableDeductionsByPeriod:number[]
  taxCreditsByPeriod:number[]
  taxAmountOverridesByPeriod:number[]|null
  taxAmountSourceReference:string|null
}

/** Resolve explicit tax-form rates and opening loss vintages onto the exact project calendar. */
export function buildProjectTaxDraftSchedule(
  draft:ProjectTaxFormDraft,
  periods:ProjectCalendarPeriod[],
  fiscalYearStartMonth:number,
):ProjectTaxDraftSchedule {
  const documentedAmounts=draft.documentedAmounts??[]
  const active=draft.system!==null||draft.rates.length>0||documentedAmounts.length>0||draft.allowances.length>0||
    draft.lossCarryForward!==null||draft.lossCarryForwardYears!==null||draft.openingLossVintages.length>0
  const issues:string[]=[]
  const fiscalYearCount=periods.length
    ?Math.max(...periods.map(period=>fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)))+1:0
  const empty=():ProjectTaxDraftSchedule=>({active,valid:false,issues,annualTaxRates:[],taxRatesByPeriod:[],
    taxLossCarryForwardEnabled:false,taxLossCarryForwardYears:null,openingTaxLoss:0,openingTaxLossVintages:[],taxableDeductionsByPeriod:[],taxCreditsByPeriod:[],
    taxAmountOverridesByPeriod:null,taxAmountSourceReference:null})
  if(!active)return {...empty(),valid:true,annualTaxRates:[],taxRatesByPeriod:[]}
  if(!periods.length||!Number.isInteger(fiscalYearStartMonth)||fiscalYearStartMonth<1||fiscalYearStartMonth>12)
    issues.push('A valid project calendar and fiscal-year start month are required for detailed taxation.')
  if(draft.system===null)issues.push('Select the project tax system before entering tax rates.')
  let taxRatesByPeriod:number[]=[]
  let taxAmountOverridesByPeriod:number[]|null=null
  let taxAmountSourceReference:string|null=null
  if(documentedAmounts.length){
    if(draft.system!=='corporate'&&draft.system!=='custom')issues.push('Documented tax amounts require a corporate or custom tax system.')
    if(draft.rates.length)issues.push('Use either documented tax amounts or tax-rate rows, not both.')
    if(draft.allowances.length)issues.push('Tax allowances cannot be layered onto final documented tax amounts.')
    const resolved=new Map<number,number>()
    const sourceReferences=new Set<string>()
    for(const row of documentedAmounts){
      const matches:number[]=[]
      periods.forEach((period,index)=>{
        if(row.period===String(index+1)||row.period===String(period.index)||
          row.period===period.startDate||row.period===period.endDate||
          (row.period.length===7&&row.period===period.startDate.slice(0,7)&&row.period===period.endDate.slice(0,7)))
          matches.push(index)
      })
      if(matches.length!==1){issues.push('Documented tax amount period is unknown or ambiguous: '+row.period);continue}
      const index=matches[0]
      if(resolved.has(index)){issues.push('Duplicate documented tax amount for project period '+(index+1)+'.');continue}
      if(row.amount===null||!Number.isFinite(row.amount)||row.amount<0){issues.push('A finite non-negative documented tax amount is required for project period '+(index+1)+'.');continue}
      if(!row.sourceVerified||!row.sourceReference.trim()){issues.push('A verified source reference is required for documented tax amount in project period '+(index+1)+'.');continue}
      resolved.set(index,row.amount)
      sourceReferences.add(row.sourceReference.trim())
    }
    for(let index=0;index<periods.length;index++)if(!resolved.has(index))
      issues.push('Documented tax amount is missing for project period '+(index+1)+'.')
    taxAmountOverridesByPeriod=periods.map((_,index)=>resolved.get(index)??Number.NaN)
    taxAmountSourceReference=[...sourceReferences].join(' | ')
    taxRatesByPeriod=Array(periods.length).fill(0)
  } else if(draft.system==='none'){
    if(draft.rates.length)issues.push('A tax-free project cannot also contain taxable-rate rows.')
    taxRatesByPeriod=Array(periods.length).fill(0)
  } else if(draft.system==='corporate'||draft.system==='custom') {
    const resolved=new Map<number,number>()
    for(const row of draft.rates){
      const matches:number[]=[]
      periods.forEach((period,index)=>{
        if(row.period===String(index+1)||row.period===String(period.index)||
          row.period===period.startDate||row.period===period.endDate||
          (row.period.length===7&&row.period===period.startDate.slice(0,7)&&row.period===period.endDate.slice(0,7)))
          matches.push(index)
      })
      if(matches.length!==1){issues.push('Tax rate period is unknown or ambiguous: '+row.period);continue}
      const index=matches[0]
      if(resolved.has(index)){issues.push('Duplicate tax rate for project period '+(index+1)+'.');continue}
      if(row.ratePercent===null||!Number.isFinite(row.ratePercent)||row.ratePercent<0||row.ratePercent>100){
        issues.push('A tax rate from 0% to 100% is required for project period '+(index+1)+'.');continue
      }
      resolved.set(index,row.ratePercent)
    }
    taxRatesByPeriod=periods.map((_,index)=>resolved.get(index)??Number.NaN)
    if(taxRatesByPeriod.some(rate=>!Number.isFinite(rate)))
      issues.push('Every project period requires one explicit tax rate; missing periods are not assigned a default.')
  } else issues.push('Unsupported project tax system.')

  if(documentedAmounts.length){
    if(draft.lossCarryForward===true||draft.lossCarryForwardYears!==null||draft.openingLossVintages.length)
      issues.push('Tax-loss carry-forward settings cannot be combined with final documented tax amounts.')
  } else if(draft.system==='none'){
    if(draft.lossCarryForward===true||draft.openingLossVintages.length)
      issues.push('Tax-loss carry-forward cannot be enabled for a tax-free project.')
  } else if(draft.lossCarryForward===null) {
    issues.push('Explicitly select whether tax losses can be carried forward.')
  } else if(draft.lossCarryForward&&(!Number.isInteger(draft.lossCarryForwardYears)||!draft.lossCarryForwardYears||draft.lossCarryForwardYears<1)) {
    issues.push('A positive carry-forward duration in years is required when tax-loss carry-forward is enabled.')
  }
  const taxableDeductionsByPeriod=Array(periods.length).fill(0) as number[]
  const taxCreditsByPeriod=Array(periods.length).fill(0) as number[]
  for(const allowance of draft.allowances){
    if(!allowance.name.trim())issues.push('Every tax allowance requires a description.')
    if(allowance.treatment!=='deduction'&&allowance.treatment!=='credit'){
      issues.push('Tax allowance '+allowance.name+' must be classified as a taxable-income deduction or tax credit.')
      continue
    }
    const amounts=new Map<number,number>()
    for(const item of allowance.periodAmounts){
      const matches:number[]=[]
      periods.forEach((period,index)=>{
        if(item.period===String(index+1)||item.period===String(period.index)||
          item.period===period.startDate||item.period===period.endDate||
          (item.period.length===7&&item.period===period.startDate.slice(0,7)&&item.period===period.endDate.slice(0,7)))
          matches.push(index)
      })
      if(matches.length!==1){issues.push('Tax allowance '+allowance.name+' has an unknown or ambiguous period: '+item.period);continue}
      const index=matches[0]
      if(amounts.has(index)){issues.push('Tax allowance '+allowance.name+' has a duplicate amount for period '+(index+1)+'.');continue}
      if(item.amount===null||!Number.isFinite(item.amount)||item.amount<0){issues.push('Tax allowance '+allowance.name+' requires a non-negative explicit amount for period '+(index+1)+'.');continue}
      amounts.set(index,item.amount)
    }
    for(let index=0;index<periods.length;index++){
      if(!amounts.has(index)){issues.push('Tax allowance '+allowance.name+' is missing an explicit amount for period '+(index+1)+'.');continue}
      if(allowance.treatment==='deduction')taxableDeductionsByPeriod[index]+=amounts.get(index) as number
      else taxCreditsByPeriod[index]+=amounts.get(index) as number
    }
  }
  const openingTaxLossVintages:TaxLossVintage[]=[]
  for(const [index,item] of draft.openingLossVintages.entries()){
    if(item.amount===null||!Number.isFinite(item.amount)||item.amount<=0||
      item.originFiscalYearIndex===null||!Number.isInteger(item.originFiscalYearIndex)||item.originFiscalYearIndex>0){
      issues.push('Opening tax-loss vintage '+(index+1)+' requires a positive amount and a fiscal-year index no later than model year zero.')
      continue
    }
    openingTaxLossVintages.push({amount:item.amount,originFiscalYearIndex:item.originFiscalYearIndex})
  }
  if(draft.lossCarryForward!==true&&openingTaxLossVintages.length)
    issues.push('Opening tax-loss vintages cannot be retained when loss carry-forward is disabled.')
  if(issues.length)return empty()
  const annualTaxRates=Array(fiscalYearCount).fill(0) as number[]
  const dayTotals=Array(fiscalYearCount).fill(0) as number[]
  periods.forEach((period,index)=>{
    const year=fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)
    annualTaxRates[year]+=taxRatesByPeriod[index]*period.days
    dayTotals[year]+=period.days
  })
  for(let year=0;year<fiscalYearCount;year++)annualTaxRates[year]=dayTotals[year]>0?annualTaxRates[year]/dayTotals[year]:Number.NaN
  if(annualTaxRates.some(rate=>!Number.isFinite(rate)))issues.push('Tax rates do not cover every fiscal year.')
  if(issues.length)return empty()
  return {active:true,valid:true,issues:[],annualTaxRates,taxRatesByPeriod,
    taxLossCarryForwardEnabled:documentedAmounts.length?false:draft.system==='none'?false:draft.lossCarryForward===true,
    taxLossCarryForwardYears:documentedAmounts.length?null:draft.lossCarryForward===true?draft.lossCarryForwardYears:null,
    openingTaxLoss:openingTaxLossVintages.reduce((sum,item)=>sum+item.amount,0),openingTaxLossVintages,taxableDeductionsByPeriod,taxCreditsByPeriod,
    taxAmountOverridesByPeriod,taxAmountSourceReference}
}
