import type { ProjectCalendarPeriod, ProjectFoundation, ProjectPeriodFrequency } from './projectFoundation'
import type { LoanFacilityFormDraft } from './projectModelFormDrafts'
import { calculatePeriodicLoanSchedule, type PeriodicLoanInput, type PeriodicLoanRow, type PeriodicProjectLoan } from '../steel/periodicFinancialEngine'
import { resolveLoanFacilityCurrency, translatePeriodicForeignCurrencyLoan, type PeriodicForeignCurrencyDebtResult } from '../steel/foreignCurrencyTranslation'

export type ProjectLoanDraftIntegration = {
  valid:boolean
  issues:string[]
  loans:PeriodicProjectLoan[]
  loanScheduleOverrides:Record<string,PeriodicLoanRow[]>
  foreignExchangeLossByPeriod:number[]
  foreignTranslations:Record<string,PeriodicForeignCurrencyDebtResult>
}
const periodsPerYearFor=(frequency:ProjectPeriodFrequency):1|2|4|12|null=>frequency==='annual'?1:frequency==='semiannual'?2:frequency==='quarterly'?4:frequency==='monthly'?12:null
function periodIndexForDate(date:string,periods:ProjectCalendarPeriod[]):number {
  const matches:number[]=[]
  periods.forEach((period,index)=>{if(date>=period.startDate&&date<=period.endDate)matches.push(index)})
  return matches.length===1?matches[0]:-1
}
function resolveCurrencyRate(currency:ProjectFoundation['currencies']['foreignCurrencies'][number],period:ProjectCalendarPeriod):number|null {
  const keys=[String(period.index),period.startDate,period.endDate,period.startDate.slice(0,7)]
  for(const key of keys){
    const matches=currency.exchangeRates.filter(item=>item.period.trim()===key)
    if(matches.length>1)return null
    if(matches.length===1)return matches[0].rateToLocal
  }
  return null
}

/**
 * Converts explicit loan forms into periodic schedules. Foreign facilities are
 * calculated in their contract currency, translated at the project's explicit
 * period rates, and supplied to the three-statement engine as pretranslated rows.
 * Fee-rate forms are deliberately blocked until their fee bases/amounts are explicit.
 */
export function buildProjectLoanDraftIntegration(
  drafts:LoanFacilityFormDraft[],
  periods:ProjectCalendarPeriod[],
  dayCountBasis:360|365,
  periodFrequency:ProjectPeriodFrequency,
  foundation:ProjectFoundation,
):ProjectLoanDraftIntegration {
  const issues:string[]=[]
  const loans:PeriodicProjectLoan[]=[]
  const loanScheduleOverrides:Record<string,PeriodicLoanRow[]>={}
  const foreignTranslations:Record<string,PeriodicForeignCurrencyDebtResult>={}
  const foreignExchangeLossByPeriod=Array(periods.length).fill(0) as number[]
  const frequency=periodsPerYearFor(periodFrequency)
  if(!periods.length)issues.push('A complete project calendar is required before loan schedules can be connected.')
  if(!frequency)issues.push('Project period frequency must be annual, semiannual, quarterly or monthly.')
  if(new Set(drafts.map(item=>item.id)).size!==drafts.length||drafts.some(item=>!item.id||!item.name.trim()))
    issues.push('Every loan facility requires a unique identifier and a name.')
  for(const loan of drafts){
    const prefix='Facility '+(loan.name||loan.id)+': '
    if(loan.manualPeriodSchedule?.length){
      if(loan.marketOrigin!=='local')issues.push(prefix+'documented manual schedule overrides currently require a local-currency facility.')
      const byPeriod=new Map<number,NonNullable<LoanFacilityFormDraft['manualPeriodSchedule']>[number]>()
      for(const row of loan.manualPeriodSchedule){
        const period=Number(row.period)
        if(!Number.isInteger(period)||period<1||period>periods.length||byPeriod.has(period)||
          ![row.drawdown,row.principal,row.interestExpense,row.capitalizedInterest,row.closingBalance].every(value=>Number.isFinite(value)&&value>=0)){
          issues.push(prefix+'manual schedule rows require unique in-calendar period indexes and finite non-negative amounts.')
          continue
        }
        byPeriod.set(period,row)
      }
      if(!loan.currencyCode?.trim())issues.push(prefix+'a documented manual schedule requires an explicit facility currency.')
      const sortedPeriods=[...byPeriod.keys()].sort((a,b)=>a-b)
      if(sortedPeriods.length&&sortedPeriods.some((period,index)=>index>0&&period!==sortedPeriods[index-1]+1))
        issues.push(prefix+'manual schedule period indexes must be contiguous; missing periods cannot be assumed to be zero.')
      if(issues.some(issue=>issue.startsWith(prefix)))continue
      let openingBalance=0
      const rows:PeriodicLoanRow[]=periods.map((_,index)=>{
        const period=index+1,source=byPeriod.get(period)
        const drawdown=source?.drawdown??0,principal=source?.principal??0
        const interestExpense=source?.interestExpense??0,capitalizedInterest=source?.capitalizedInterest??0
        const closingBalance=source?.closingBalance??openingBalance
        if(Math.abs(openingBalance+drawdown+capitalizedInterest-principal-closingBalance)>0.05)
          issues.push(prefix+'manual debt balance does not reconcile in period '+period+' (opening + drawdown + capitalized interest - principal must equal closing balance).')
        const row:PeriodicLoanRow={period,drawdown,openingBalance,periodRatePercent:0,interestExpense,capitalizedInterest,financingFeeExpense:0,commitmentFeeExpense:0,capitalizedFinancingFees:0,principal,closingBalance,debtService:principal+interestExpense}
        openingBalance=closingBalance
        return row
      })
      const lastDocumentedPeriod=sortedPeriods.at(-1)??0
      if(lastDocumentedPeriod>0&&lastDocumentedPeriod<periods.length&&rows[lastDocumentedPeriod-1].closingBalance>0.01)
        issues.push(prefix+'the documented schedule ends with outstanding principal; add subsequent repayment periods or a verified terminal balance.')
      if(issues.some(issue=>issue.startsWith(prefix)))continue
      const firstPrincipal=rows.findIndex(row=>row.principal>0)
      const drawdowns=rows.map(row=>row.drawdown)
      loans.push({id:loan.id,input:{
        annualRatePercent:0,drawdowns,repaymentMethod:'custom',
        repaymentStartPeriod:firstPrincipal>=0?firstPrincipal+1:periods.length,
        gracePeriods:0,termPeriods:Math.max(1,rows.filter(row=>row.principal>0).length),
        capitalizeInterest:false,rateConversion:'effective-annual-by-actual-days',
        periodsPerYear:frequency??1,openingBalance:0,
        customPrincipalRepayments:rows.filter(row=>row.principal>0).map(row=>({period:row.period,amount:row.principal})),
        interestConvention:'comfar-months-plus-360',
      }})
      loanScheduleOverrides[loan.id]=rows
      continue
    }
    if(loan.annualRatePercent===null||!Number.isFinite(loan.annualRatePercent)||loan.annualRatePercent<0)
      issues.push(prefix+'enter a non-negative base annual interest rate.')
    if(loan.openingBalance===null||!Number.isFinite(loan.openingBalance)||loan.openingBalance<0)
      issues.push(prefix+'enter the opening principal balance explicitly (use zero for a new facility).')
    if(loan.interestConvention===null)issues.push(prefix+'select an interest day-count convention.')
    if(loan.capitalizedInterestPercent!==0&&loan.capitalizedInterestPercent!==100)
      issues.push(prefix+'only 0% or 100% interest capitalization is supported; partial capitalization requires a separate split schedule.')
    if(loan.capitalizedInterestPercent===100&&!loan.capitalizeUntilDate)
      issues.push(prefix+'enter the capitalization end date.')
    if(loan.capitalizedInterestPercent===0&&loan.capitalizeUntilDate)
      issues.push(prefix+'remove the capitalization end date when interest capitalization is zero.')
    if(loan.fees.length)issues.push(prefix+'fee rates need explicit fee amounts, dates and fee bases before they can enter cash flow.')
    if(loan.interestPaymentMonth!==null)issues.push(prefix+'intra-period interest payment month is not yet modeled; use the project-period interest settlement convention or leave this field blank.')
    if(loan.marketOrigin===null||loan.loanType===null)issues.push(prefix+'select the loan type and currency origin.')
    const currencyResolution=resolveLoanFacilityCurrency(loan,foundation)
    if(!currencyResolution.valid)issues.push(...currencyResolution.issues.map(item=>prefix+item))
    if(loan.marketOrigin==='foreign'&&
      (loan.openingExchangeRateToLocal===null||!Number.isFinite(loan.openingExchangeRateToLocal)||loan.openingExchangeRateToLocal<=0))
      issues.push(prefix+'enter the opening exchange rate to the project local currency.')
    if(loan.interestRateChanges.some((item,index)=>!item.effectiveDate||item.annualRatePercent===null||
      !Number.isFinite(item.annualRatePercent)||item.annualRatePercent<0||
      (index>0&&loan.interestRateChanges[index-1].effectiveDate>=item.effectiveDate)))
      issues.push(prefix+'rate resets require valid dates, non-negative rates and strictly increasing effective dates.')
    if(loan.interestRateChanges.some(item=>periodIndexForDate(item.effectiveDate,periods)<0))
      issues.push(prefix+'every rate reset date must fall inside the project calendar.')
    const drawdowns=Array(periods.length).fill(0) as number[]
    const datedDrawdowns:{date:string;amount:number}[]=[]
    const repaymentMovements:{period:number;amount:number}[]=[]
    if(loan.loanType==='profile'){
      if(loan.disbursements.length)issues.push(prefix+'use dated profile movements or the standard drawdown register, not both.')
      for(const movement of loan.profileMovements){
        const index=periodIndexForDate(movement.date,periods)
        if(index<0||movement.amount===null||!Number.isFinite(movement.amount)||movement.amount===0){
          issues.push(prefix+'each profile movement needs an in-calendar date and a non-zero signed amount.')
          continue
        }
        if(movement.amount>0){drawdowns[index]+=movement.amount;datedDrawdowns.push({date:movement.date,amount:movement.amount})}
        else repaymentMovements.push({period:index+1,amount:-movement.amount})
      }
      if(!repaymentMovements.length)issues.push(prefix+'a profile loan requires at least one dated principal repayment.')
    }else{
      if(loan.profileMovements.length)issues.push(prefix+'remove profile movements from an annuity or constant-principal facility.')
      for(const drawdown of loan.disbursements){
        const index=periodIndexForDate(drawdown.date,periods)
        if(index<0||drawdown.amount===null||!Number.isFinite(drawdown.amount)||drawdown.amount<=0){
          issues.push(prefix+'each drawdown requires an in-calendar date and a positive amount.')
          continue
        }
        drawdowns[index]+=drawdown.amount
        datedDrawdowns.push({date:drawdown.date,amount:drawdown.amount})
      }
    }
    const repayments=Array.from(repaymentMovements.reduce((map,item)=>map.set(item.period,(map.get(item.period)??0)+item.amount),new Map<number,number>()).entries()).map(([period,amount])=>({period,amount}))
    let repaymentStartPeriod=0,gracePeriods=0,termPeriods=0
    let repaymentMethod:PeriodicLoanInput['repaymentMethod']='annuity'
    if(loan.loanType==='profile'){
      const repaymentPeriods=repayments.map(item=>item.period)
      repaymentStartPeriod=Math.min(...repaymentPeriods)
      termPeriods=Math.max(...repaymentPeriods)-repaymentStartPeriod+1
      repaymentMethod='custom'
    }else{
      if(!frequency||loan.repaymentInterval!==periodFrequency)
        issues.push(prefix+'repayment interval must match the project period frequency; intra-period instalments require a finer project calendar.')
      const first=periodIndexForDate(loan.firstRepaymentDate,periods)
      if(first<0)issues.push(prefix+'first repayment date must fall inside the project calendar.')
      repaymentStartPeriod=first+1
      if(!Number.isInteger(loan.gracePeriods)||loan.gracePeriods===null||loan.gracePeriods<0)
        issues.push(prefix+'enter a non-negative integer principal grace period.')
      else gracePeriods=loan.gracePeriods
      if(!Number.isInteger(loan.numberOfRepayments)||loan.numberOfRepayments===null||loan.numberOfRepayments<1)
        issues.push(prefix+'enter a positive integer number of repayments.')
      else termPeriods=loan.numberOfRepayments
      repaymentMethod=loan.loanType==='constant-principal'?'equal-principal':'annuity'
    }
    const firstPrincipalIndex=repaymentStartPeriod-1+gracePeriods
    if(loan.capitalizedInterestPercent===100){
      if(firstPrincipalIndex<1||periods[firstPrincipalIndex-1]?.endDate!==loan.capitalizeUntilDate)
        issues.push(prefix+'capitalization end date must equal the final project-period end immediately before principal repayments begin.')
    }
    const input:PeriodicLoanInput={
      annualRatePercent:loan.annualRatePercent??Number.NaN,drawdowns,
      repaymentMethod,repaymentStartPeriod,gracePeriods,termPeriods,
      capitalizeInterest:loan.capitalizedInterestPercent===100,
      rateConversion:'effective-annual-by-actual-days',periodsPerYear:frequency??1,
      openingBalance:loan.openingBalance??Number.NaN,
      datedDrawdowns,
      rateChanges:loan.interestRateChanges.map(item=>({effectiveDate:item.effectiveDate,annualRatePercent:item.annualRatePercent??Number.NaN})),
      interestConvention:loan.interestConvention??undefined,
      customPrincipalRepayments:loan.loanType==='profile'?repayments:undefined,
    }
    const schedule=calculatePeriodicLoanSchedule(input,periods,dayCountBasis)
    if(!schedule.valid){issues.push(...schedule.issues.map(item=>prefix+item));continue}
    loans.push({id:loan.id,input})
    if(loan.marketOrigin==='foreign'&&currencyResolution.currency){
      const translation=translatePeriodicForeignCurrencyLoan({
        currency:currencyResolution.currency,periods,schedule:schedule.rows,
        openingForeignBalance:loan.openingBalance??Number.NaN,
        openingExchangeRateToLocal:loan.openingExchangeRateToLocal??Number.NaN,
      })
      if(!translation.valid){issues.push(...translation.issues.map(item=>prefix+item));continue}
      foreignTranslations[loan.id]=translation
      const localRows:PeriodicLoanRow[]=schedule.rows.map((foreignRow,index)=>{
        const translated=translation.rows[index]
        const rate=resolveCurrencyRate(currencyResolution.currency!,periods[index])??Number.NaN
        const interestExpense=foreignRow.interestExpense*rate
        const financingFeeExpense=foreignRow.financingFeeExpense*rate
        const commitmentFeeExpense=foreignRow.commitmentFeeExpense*rate
        const capitalizedFinancingFees=translated.capitalizedFeesLocal
        return {
          period:index+1,drawdown:translated.drawdownLocal,openingBalance:translated.openingCarryingAmountLocal,
          periodRatePercent:foreignRow.periodRatePercent,interestExpense,
          capitalizedInterest:translated.capitalizedInterestLocal,financingFeeExpense,
          commitmentFeeExpense,capitalizedFinancingFees,principal:translated.principalRepaymentLocal,
          closingBalance:translated.closingCarryingAmountLocal,
          debtService:interestExpense+financingFeeExpense+commitmentFeeExpense+translated.principalRepaymentLocal,
        }
      })
      loanScheduleOverrides[loan.id]=localRows
      translation.rows.forEach((row,index)=>{foreignExchangeLossByPeriod[index]+=row.foreignExchangeLossLocal})
    }
  }
  return {valid:issues.length===0,issues,loans,loanScheduleOverrides,foreignExchangeLossByPeriod,foreignTranslations}
}
