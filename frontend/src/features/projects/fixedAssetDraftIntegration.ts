import type { ProjectCalendarPeriod, ProjectFoundation } from './projectFoundation'
import type { FixedAssetFormDraft, ProjectModelFinancialFormDrafts } from './projectModelFormDrafts'
import { validateFixedAssetFormDraft } from './projectModelFormDrafts'
import {
  calculatePeriodicComfarAssetLifecycle,
  fiscalYearIndexForPeriod,
  type PeriodicDepreciationAssetInput,
  type PeriodicDepreciationSaleInput,
  type PeriodicProjectFinanceInput,
} from '../steel/periodicFinancialEngine'

export type FixedAssetFinanceBinding={
  valid:boolean
  issues:string[]
  financeInput:PeriodicProjectFinanceInput|null
  assets:PeriodicDepreciationAssetInput[]
  sales:PeriodicDepreciationSaleInput[]
  lifecycle:ReturnType<typeof calculatePeriodicComfarAssetLifecycle>
}

const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)
const nonNegative=(x:unknown):x is number=>finite(x)&&x>=0

function resolvePeriod(key:string,periods:ProjectCalendarPeriod[]):number {
  const matches:number[]=[]
  periods.forEach((period,index)=>{
    if(key===String(index+1)||key===String(period.index)||key===period.startDate||key===period.endDate||
      (key.length===7&&key===period.startDate.slice(0,7)&&key===period.endDate.slice(0,7)))matches.push(index)
  })
  return matches.length===1?matches[0]:-1
}
function exchangeRate(currencyCode:string|null,foundation:ProjectFoundation,period:ProjectCalendarPeriod):number|null {
  if(!currencyCode||currencyCode===foundation.currencies.localCurrencyCode)return 1
  const currency=foundation.currencies.foreignCurrencies.find(item=>item.code===currencyCode)
  if(!currency)return null
  for(const key of [String(period.index),period.startDate,period.endDate,period.startDate.slice(0,7)]) {
    const matches=currency.exchangeRates.filter(item=>item.period.trim()===key)
    if(matches.length>1)return null
    if(matches.length===1&&nonNegative(matches[0].rateToLocal)&&matches[0].rateToLocal>0)return matches[0].rateToLocal
  }
  return null
}

export function bindFixedAssetDraftsToPeriodicFinance(input:{
  finance:PeriodicProjectFinanceInput
  assets:Pick<ProjectModelFinancialFormDrafts,'assets'>['assets']
  foundation:ProjectFoundation
  productionStartDate:string
}):FixedAssetFinanceBinding {
  const issues:string[]=[]
  const {finance,foundation,productionStartDate}=input
  const periods=finance.periods
  const assets:PeriodicDepreciationAssetInput[]=[]
  const sales:PeriodicDepreciationSaleInput[]=[]
  for(const [assetIndex,asset] of input.assets.entries()) {
    issues.push(...validateFixedAssetFormDraft(asset).map(error=>'asset-'+assetIndex+':'+error))
    if(!asset.id.trim())issues.push('Asset identifier is required at row '+(assetIndex+1)+'.')
    if(!asset.acquisitionPeriods.length)issues.push('At least one dated acquisition vintage is required for asset '+asset.id+'.')
    if(asset.disposal&&asset.acquisitionPeriods.length!==1)
      issues.push('A disposal must identify one unambiguous asset vintage; split multiple vintages into separate asset rows: '+asset.id+'.')
    const methodMap:Record<NonNullable<FixedAssetFormDraft['depreciation']['method']>,PeriodicDepreciationAssetInput['method']>={
      'linear-to-zero':'linear-to-zero','linear-to-scrap':'linear-to-scrap',
      'accelerated-declining-balance':'accelerated','sum-of-years-digits':'sum-of-years-digits',
    }
    if(!asset.depreciation.method)issues.push('Depreciation method is required for asset '+asset.id+'.')
    if(asset.depreciation.method!=='linear-to-zero'&&asset.depreciation.method&&asset.depreciation.salvagePercent===null)
      issues.push('Salvage percentage must be explicit for asset '+asset.id+'.')
    if(asset.depreciation.method!=='none'&&(!asset.depreciation.usefulLifeMonths||!asset.depreciation.firstDepreciationYearMonths))
      issues.push('Useful life and first depreciation-year months are required for asset '+asset.id+'.')
    if(asset.depreciation.startMode==='production-start'&&!productionStartDate)
      issues.push('Production start date is required for production-start depreciation: '+asset.id+'.')
    const vintages:{periodIndex:number;value:number;id:string}[]=[]
    for(const [vintageIndex,acquisition] of asset.acquisitionPeriods.entries()) {
      const periodIndex=resolvePeriod(acquisition.period,periods)
      if(periodIndex<0){issues.push('Asset '+asset.id+' has an unknown or ambiguous acquisition period: '+acquisition.period);continue}
      const calculatedTotal=acquisition.quantity!==null&&acquisition.unitPrice!==null
        ?acquisition.quantity*acquisition.unitPrice:null
      if(acquisition.total!==null&&calculatedTotal!==null&&Math.abs(acquisition.total-calculatedTotal)>0.01)
        issues.push('Asset '+asset.id+' acquisition total does not reconcile with quantity × unit price in period '+(periodIndex+1)+'.')
      const sourceValue=acquisition.total??calculatedTotal
      if(sourceValue===null||!nonNegative(sourceValue)){issues.push('Asset '+asset.id+' acquisition value must be explicit in period '+(periodIndex+1)+'.');continue}
      const rate=exchangeRate(asset.metadata.currencyCode,foundation,periods[periodIndex])
      if(rate===null){issues.push('Missing or ambiguous acquisition exchange rate for asset '+asset.id+' period '+(periodIndex+1)+'.');continue}
      vintages.push({periodIndex,value:sourceValue*rate,id:asset.id+'@'+(periodIndex+1)+'-'+vintageIndex})
    }
    if(new Set(vintages.map(v=>v.periodIndex)).size!==vintages.length)
      issues.push('Asset '+asset.id+' contains duplicate acquisition vintages in the same project period.')
    for(const vintage of vintages) {
      const acquisitionDate=periods[vintage.periodIndex].endDate
      const usefulMonths=asset.depreciation.usefulLifeMonths??0
      const startingAtDate=asset.depreciation.startMode==='specified-date'
        ?asset.depreciation.startDate
        :asset.depreciation.startMode==='production-start'?productionStartDate:undefined
      const method=asset.depreciation.method==='none'?'none':
        asset.depreciation.method?methodMap[asset.depreciation.method]:'none'
      assets.push({
        id:vintage.id,name:asset.metadata.description||asset.id,assetClass:'fixed',
        originalValue:vintage.value,initialBookValue:vintage.value,
        scrapPercent:asset.depreciation.method==='linear-to-zero'?0:(asset.depreciation.salvagePercent??0),
        lengthYears:Math.floor(usefulMonths/12),lengthMonths:usefulMonths%12,
        firstDepreciationMonths:asset.depreciation.firstDepreciationYearMonths??12,
        ratePercent:asset.depreciation.ratePercent,method,acquisitionDate,
        ...(startingAtDate?{startingAtDate}:{}),
      })
    }
    if(asset.disposal&&vintages.length===1) {
      const vintage=vintages[0]
      const saleIndex=periods.findIndex(period=>asset.disposal!.date>=period.startDate&&asset.disposal!.date<=period.endDate)
      if(saleIndex<0)issues.push('Asset disposal date falls outside the project calendar: '+asset.id+'.')
      else {
        const rate=exchangeRate(asset.metadata.currencyCode,foundation,periods[saleIndex])
        if(rate===null)issues.push('Missing or ambiguous disposal exchange rate for asset '+asset.id+'.')
        else sales.push({
          id:asset.id+'-disposal',assetId:vintage.id,saleDate:asset.disposal.date,
          priceMode:asset.disposal.proceeds===null?'book-value':'self-defined',
          selfDefinedPrice:asset.disposal.proceeds===null?null:asset.disposal.proceeds,
          exchangeRateToLocal:rate,
        })
      }
    }
  }
  const invalidLifecycle=calculatePeriodicComfarAssetLifecycle([],[],periods)
  if(issues.length)return {valid:false,issues,financeInput:null,assets,sales,lifecycle:invalidLifecycle}
  const lifecycle=calculatePeriodicComfarAssetLifecycle(assets,sales,periods)
  if(!lifecycle.valid)return {valid:false,issues:lifecycle.warnings,financeInput:null,assets,sales,lifecycle}
  const years=finance.annualRevenue.length
  const periodYears=periods.map(period=>fiscalYearIndexForPeriod(period,periods,finance.fiscalYearStartMonth))
  if(periodYears.some(year=>year<0||year>=years))
    return {valid:false,issues:['Asset schedules could not be allocated to the project fiscal years.'],financeInput:null,assets,sales,lifecycle}
  const annualize=(series:number[])=>Array.from({length:years},(_,year)=>series.reduce((sum,value,index)=>sum+(periodYears[index]===year?value:0),0))
  const fiscalStart=(date:Date)=>{
    const year=date.getUTCMonth()+1<finance.fiscalYearStartMonth?date.getUTCFullYear()-1:date.getUTCFullYear()
    return new Date(Date.UTC(year,finance.fiscalYearStartMonth-1,1))
  }
  const allocateAnnual=(annual:number[])=>periods.map((period,index)=>{
    const start=new Date(period.startDate+'T00:00:00.000Z')
    const end=new Date(period.endDate+'T00:00:00.000Z')
    let cursor=start.getTime(),allocated=0
    while(cursor<=end.getTime()) {
      const current=new Date(cursor),yearStart=fiscalStart(current)
      const nextYear=new Date(Date.UTC(yearStart.getUTCFullYear()+1,finance.fiscalYearStartMonth-1,1))
      const segmentEnd=Math.min(end.getTime(),nextYear.getTime()-86400000)
      const year=periodYears[index]
      const yearDays=Math.round((nextYear.getTime()-yearStart.getTime())/86400000)
      const segmentDays=Math.round((segmentEnd-cursor)/86400000)+1
      if(year<0||year>=annual.length)return Number.NaN
      allocated+=annual[year]*segmentDays/yearDays
      cursor=segmentEnd+86400000
    }
    return allocated
  })
  const basePeriodDepreciation=finance.periodDepreciationSchedule??allocateAnnual(finance.annualDepreciation)
  if(basePeriodDepreciation.length!==periods.length||basePeriodDepreciation.some(value=>!nonNegative(value)))
    return {valid:false,issues:['Existing annual depreciation cannot be allocated to the project periods.'],financeInput:null,assets,sales,lifecycle}
  const periodDepreciation=basePeriodDepreciation.map((value,index)=>value+lifecycle.depreciationByPeriod[index])
  const annualDepreciation=annualize(periodDepreciation)
  const periodFixedInvestment=lifecycle.fixedInvestmentByPeriod
  const periodPreOperating=lifecycle.preOperatingCostByPeriod
  const periodSales=periods.map((_,index)=>lifecycle.periods[index])
  const existingSales=finance.periodAssetSaleSchedule
    ?finance.periodAssetSaleSchedule.map(row=>({...row}))
    :periods.map(()=>({saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}))
  if(!finance.periodAssetSaleSchedule&&finance.annualAssetSaleSchedule) {
    finance.annualAssetSaleSchedule.forEach((row,year)=>{
      const matching=periods.map((period,index)=>({period,index})).filter(({period})=>periodYears[periods.indexOf(period)]===year)
      const target=matching[matching.length-1]?.index
      if(target!==undefined) {
        existingSales[target].saleProceeds+=row.saleProceeds
        existingSales[target].returnOfCapital+=row.returnOfCapital
        existingSales[target].otherIncomeLoss+=row.otherIncomeLoss
        existingSales[target].bookValueDisposed+=row.bookValueDisposed
      }
    })
  }
  const periodAssetSaleSchedule=periodSales.map((row,index)=>{
    const gain=row.saleGainLoss
    if(gain < -0.01)issues.push('Asset disposal loss cannot be represented by the current sale posting schema; extend the disposal form/accounting mapping before posting '+row.period+'.')
    const returnOfCapital=Math.max(0,row.bookValueDisposed)
    const otherIncomeLoss=Math.max(0,row.saleProceeds-returnOfCapital)
    return {
      saleProceeds:existingSales[index].saleProceeds+row.saleProceeds,
      returnOfCapital:existingSales[index].returnOfCapital+returnOfCapital,
      otherIncomeLoss:existingSales[index].otherIncomeLoss+otherIncomeLoss,
      bookValueDisposed:existingSales[index].bookValueDisposed+row.bookValueDisposed,
    }
  })
  if(issues.length)return {valid:false,issues,financeInput:null,assets,sales,lifecycle}
  const annualAssetSaleSchedule=Array.from({length:years},(_,year)=>periodAssetSaleSchedule.reduce((sum,row,index)=>{
    if(periodYears[index]!==year)return sum
    return {
      saleProceeds:sum.saleProceeds+row.saleProceeds,
      returnOfCapital:sum.returnOfCapital+row.returnOfCapital,
      otherIncomeLoss:sum.otherIncomeLoss+row.otherIncomeLoss,
      bookValueDisposed:sum.bookValueDisposed+row.bookValueDisposed,
    }
  },{saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}))
  return {
    valid:true,issues:[],assets,sales,lifecycle,
    financeInput:{
      ...finance,
      annualDepreciation,
      annualFixedInvestment:finance.annualFixedInvestment.map((value,year)=>value+annualize(periodFixedInvestment)[year]),
      annualPreOperatingCost:finance.annualPreOperatingCost.map((value,year)=>value+annualize(periodPreOperating)[year]),
      periodDepreciationSchedule:periodDepreciation,
      periodAssetSaleSchedule,
      annualAssetSaleSchedule,
    },
  }
}
