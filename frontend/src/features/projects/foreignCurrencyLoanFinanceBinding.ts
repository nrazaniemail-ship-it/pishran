import type { ProjectCalendarPeriod, ProjectFoundation } from '../projects/projectFoundation'
import type { LoanFacilityFormDraft } from '../projects/projectModelFormDrafts'
import { validateLoanFacilityFormDraft } from '../projects/projectModelFormDrafts'
import { calculateLoanFee } from './projectModelHelpFormulaRules'
import {
  calculateIntegratedPeriodicFinance,
  calculatePeriodicLoanSchedule,
  buildPeriodicThreeFinancialStatements,
  fiscalYearIndexForPeriod,
  type PeriodicLoanInput,
  type PeriodicLoanRow,
  type PeriodicProjectLoan,
  type PeriodicProjectFinanceInput,
  type PeriodicProjectFinanceResult,
  type PeriodicStatementOpeningBalances,
  type PeriodicFinancialStatement,
} from '../steel/periodicFinancialEngine'
import {
  resolveLoanFacilityCurrency,
  translatePeriodicForeignCurrencyLoan,
  postMultipleForeignCurrencyDebtsIntoThreeFinancialStatements,
  type PeriodicForeignCurrencyDebtResult,
  type ForeignExchangeStatementPostingResult,
} from '../steel/foreignCurrencyTranslation'

export type PeriodicLoanFacilityBinding = {
  valid:boolean
  issues:string[]
  loan:PeriodicProjectLoan|null
  localSchedule:PeriodicLoanRow[]|null
  fxTranslation:PeriodicForeignCurrencyDebtResult|null
  openingCarryingAmountLocal:number
}

export type ProjectLoanFinanceBinding = {
  valid:boolean
  issues:string[]
  financeInput:PeriodicProjectFinanceInput|null
  fxTranslations:PeriodicForeignCurrencyDebtResult[]
  openingDebtFromFacilitiesLocal:number
}

export type ForeignCurrencyFinanceRunResult = {
  valid:boolean
  finance:PeriodicProjectFinanceResult
  statements:PeriodicFinancialStatement[]
  fxPosting:ForeignExchangeStatementPostingResult|null
  issues:string[]
}

const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x)
const nonNegative=(x:unknown):x is number=>finite(x)&&x>=0
const parseDate=(value:string):number=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return Number.NaN
  const time=Date.parse(value+'T00:00:00.000Z')
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time:Number.NaN
}

function periodForDate(date:string,periods:ProjectCalendarPeriod[]):number {
  const timestamp=parseDate(date)
  if(!Number.isFinite(timestamp))return -1
  return periods.findIndex(period=>timestamp>=parseDate(period.startDate)&&timestamp<=parseDate(period.endDate))
}

function periodFrequencyMatches(periods:ProjectCalendarPeriod[],periodsPerYear:number):boolean {
  const ranges:Record<number,[number,number]>={1:[350,367],2:[177,185],4:[88,93],12:[27,32]}
  const range=ranges[periodsPerYear]
  return Boolean(range)&&periods.every(period=>period.days>=range[0]&&period.days<=range[1])
}

function resolveCurrencyRate(currency:{exchangeRates:{period:string;rateToLocal:number}[]},period:ProjectCalendarPeriod):number|null {
  const candidates=[String(period.index),period.startDate,period.endDate,period.startDate.slice(0,7)]
  for(const key of candidates) {
    const matches=currency.exchangeRates.filter(rate=>rate.period.trim()===key)
    if(matches.length>1)return null
    if(matches.length===1&&nonNegative(matches[0].rateToLocal)&&matches[0].rateToLocal>0)return matches[0].rateToLocal
  }
  return null
}

/**
 * Build a loan schedule directly from the saved loan form. The first effective
 * rate row is the facility's base rate; subsequent rows are dated resets.
 * The project calendar must have the same frequency as the repayment interval.
 */
export function buildPeriodicLoanFacilityBinding(input:{
  loan:LoanFacilityFormDraft
  foundation:ProjectFoundation
  periods:ProjectCalendarPeriod[]
  dayCountBasis:360|365
  openingLocalBalance?:number
  openingForeignBalance?:number
  openingExchangeRateToLocal?:number
}):PeriodicLoanFacilityBinding {
  const issues:string[]=[]
  const {loan,foundation,periods,dayCountBasis}=input
  issues.push(...validateLoanFacilityFormDraft(loan))
  if(!loan.id.trim())issues.push('Loan facility identifier is required.')
  if(!periods.length)issues.push('Project calendar is required.')
  const currencyResolution=resolveLoanFacilityCurrency(loan,foundation)
  if(!currencyResolution.valid)issues.push(...currencyResolution.issues)
  const periodsPerYear=loan.repaymentInterval==='annual'?1:loan.repaymentInterval==='semiannual'?2:loan.repaymentInterval==='quarterly'?4:loan.repaymentInterval==='monthly'?12:0
  const monthsPerRepayment=periodsPerYear>0?12/periodsPerYear:0
  const graceMonths=loan.graceMonths
  const gracePeriods=graceMonths!==null&&monthsPerRepayment>0&&graceMonths%monthsPerRepayment===0?graceMonths/monthsPerRepayment:0
  if(graceMonths===null||!Number.isInteger(graceMonths)||graceMonths<0)issues.push('An explicit non-negative grace period in months is required.')
  else if(monthsPerRepayment>0&&graceMonths%monthsPerRepayment!==0)issues.push('Grace period must be an exact multiple of the repayment interval.')
  if(loan.loanType==='profile'&&graceMonths!==0)issues.push('For profile loans, enter grace directly in the dated principal movements and set grace months to zero.')
  if(!periodFrequencyMatches(periods,periodsPerYear))issues.push('Loan repayment interval must match the project period frequency; mixed-frequency amortization is not inferred.')
  const firstRepaymentIndex=periodForDate(loan.firstRepaymentDate,periods)
  if(firstRepaymentIndex<0)issues.push('First repayment date must fall inside the project calendar.')
  if(!loan.loanType)issues.push('Loan repayment type is required.')
  if(loan.loanType!=='profile'&&(!Number.isInteger(loan.numberOfRepayments)||!loan.numberOfRepayments||loan.numberOfRepayments<1))
    issues.push('A positive repayment count is required for annuity or constant-principal loans.')
  const rateRows=[...loan.interestRateChanges].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate))
  if(!rateRows.length||rateRows[0].annualRatePercent===null||rateRows[0].effectiveDate>periods[0]?.startDate)
    issues.push('A base interest rate effective on or before the first project period is required.')
  if(rateRows.some(row=>row.annualRatePercent===null||!nonNegative(row.annualRatePercent)))
    issues.push('Every base or reset interest rate must be explicitly supplied.')
  const drawdowns=Array(periods.length).fill(0) as number[]
  const datedDrawdowns:{date:string;amount:number}[]=[]
  for(const row of loan.disbursements) {
    if(row.amount===null||!nonNegative(row.amount)) {issues.push('Every loan disbursement amount must be explicit and non-negative.');continue}
    if(row.amount===0)continue
    const index=periodForDate(row.date,periods)
    if(index<0){issues.push('Loan disbursement date falls outside the project calendar: '+row.date);continue}
    drawdowns[index]+=row.amount
    datedDrawdowns.push({date:row.date,amount:row.amount})
  }
  const profileRows:{period:number;amount:number}[]=[]
  for(const row of loan.profileMovements) {
    if(row.amount===null||!finite(row.amount)||row.amount<=0){issues.push('Profile principal movements must be positive finite amounts.');continue}
    const index=periodForDate(row.date,periods)
    if(index<0){issues.push('Profile repayment date falls outside the project calendar: '+row.date);continue}
    profileRows.push({period:index+1,amount:row.amount})
  }
  if(loan.loanType==='profile'&&!profileRows.length)issues.push('Profile loan requires dated principal repayments.')
  const termPeriods=loan.loanType==='profile'
    ?Math.max(0,...profileRows.map(row=>row.period))-Math.max(0,firstRepaymentIndex+1)+1
    :loan.numberOfRepayments??0
  if(firstRepaymentIndex>=0&&firstRepaymentIndex+termPeriods>periods.length)
    issues.push('Loan repayment term exceeds the project calendar.')
  if(issues.length)return {valid:false,issues,loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}

  const baseRate=rateRows[0].annualRatePercent as number
  const rateChanges=rateRows.slice(1).map(row=>({effectiveDate:row.effectiveDate,annualRatePercent:row.annualRatePercent as number}))
  const repaymentMethod=loan.loanType==='annuity'?'annuity':loan.loanType==='constant-principal'?'equal-principal':'custom'
  const capitalizationPercent=loan.capitalizedInterestPercent as number
  let loanInput:PeriodicLoanInput={
    annualRatePercent:baseRate,
    drawdowns,
    datedDrawdowns,
    repaymentMethod,
    repaymentStartPeriod:firstRepaymentIndex+1,
    gracePeriods,
    termPeriods,
    capitalizeInterest:capitalizationPercent===100,
    capitalizedInterestPercent:capitalizationPercent,
    ...(loan.capitalizeUntilDate?{capitalizeUntilDate:loan.capitalizeUntilDate}:{}),
    rateConversion:'effective-annual-by-actual-days',
    periodsPerYear:periodsPerYear as 1|2|4|12,
    rateChanges,
    facilityLimit:loan.facilityLimit??undefined,
    interestConvention:'comfar-months-plus-360',
    ...(repaymentMethod==='custom'?{customPrincipalRepayments:profileRows}:{}),
  }
  const openingLocalBalance=input.openingLocalBalance??loan.openingLocalBalance??0
  const openingForeignBalance=input.openingForeignBalance??loan.openingForeignBalance??0
  if(!nonNegative(openingLocalBalance))issues.push('Opening local debt must be finite and non-negative.')
  if(loan.fees.length) {
    const openingForFeeBasis=input.openingForeignBalance??0
    const preliminary=calculatePeriodicLoanSchedule({...loanInput,openingBalance:openingForFeeBasis,fees:[]},periods,dayCountBasis)
    if(!preliminary.valid)issues.push(...preliminary.issues)
    const feeEvents:{date:string;amount:number;treatment:'expense'|'capitalize';label:string}[]=[]
    const totalDrawdowns=drawdowns.reduce((sum,value)=>sum+value,0)
    const firstDisbursementDate=datedDrawdowns.map(row=>row.date).sort()[0]
    for(const fee of loan.fees) {
      if(!fee.type||fee.ratePercent===null||!nonNegative(fee.ratePercent)||!fee.paymentDate||
        (fee.treatment!=='expense'&&fee.treatment!=='capitalize')) {
        issues.push('Fee '+fee.id+' requires type, rate, payment date and accounting treatment.')
        continue
      }
      if(fee.currencyCode&&loan.currencyCode&&fee.currencyCode!==loan.currencyCode) {
        issues.push('Fee '+fee.id+' currency must match its facility currency.')
        continue
      }
      const feePeriod=periodForDate(fee.paymentDate,periods)
      if(feePeriod<0) {issues.push('Fee payment date falls outside the project calendar: '+fee.paymentDate);continue}
      if(fee.type==='agency'&&!datedDrawdowns.some(row=>row.date===fee.paymentDate&&row.amount>0)) {
        issues.push('Agency fee payment date must match a positive loan disbursement date.')
        continue
      }
      if(fee.type==='other'&&fee.paymentDate!==firstDisbursementDate) {
        issues.push('Other fee payment date must match the first positive disbursement date.')
        continue
      }
      if(!preliminary.valid)continue
      const scheduleRow=preliminary.rows[feePeriod]
      const disbursement=datedDrawdowns.filter(row=>row.date===fee.paymentDate).reduce((sum,row)=>sum+row.amount,0)
      const facilityLimit=loan.facilityLimit??totalDrawdowns
      const undisbursedCommitment=fee.type==='commitment'
        ?Math.max(0,(loan.facilityLimit??0)-scheduleRow.openingBalance-scheduleRow.drawdown):0
      try {
        const calculated=calculateLoanFee({
          type:fee.type,ratePercent:fee.ratePercent,disbursement,
          outstandingBefore:scheduleRow.openingBalance,repayment:scheduleRow.principal,
          undisbursedCommitment,totalLoan:facilityLimit,periodMonths:12/periodsPerYear,
        })
        if(calculated.fee>0)feeEvents.push({
          date:fee.paymentDate,amount:calculated.fee,treatment:fee.treatment,label:fee.type+' fee',
        })
      } catch(error) {
        issues.push('Fee '+fee.id+': '+(error instanceof Error?error.message:'invalid fee input'))
      }
    }
    if(issues.length)return {valid:false,issues,loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
    loanInput={...loanInput,fees:feeEvents}
  }
  if(!nonNegative(openingForeignBalance))return {valid:false,issues:['Opening foreign debt must be finite and non-negative.'],loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
  const resolvedCurrency=currencyResolution.currency
  if(!resolvedCurrency) {
    const schedule=calculatePeriodicLoanSchedule({...loanInput,openingBalance:0},periods,dayCountBasis)
    if(!schedule.valid)return {valid:false,issues:schedule.issues,loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
    return {
      valid:true,issues:[],loan:{id:loan.id,input:loanInput},localSchedule:null,fxTranslation:null,
      openingCarryingAmountLocal:0,
    }
  }
  const periodRates=periods.map(period=>resolveCurrencyRate(resolvedCurrency,period))
  if(periodRates.some(rate=>rate===null))
    return {valid:false,issues:['Foreign-currency exchange-rate directory must provide one unique positive rate for every project period.'],loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
  const openingRate=input.openingExchangeRateToLocal??(openingForeignBalance===0?periodRates[0] as number:null)
  if(openingRate===null||!finite(openingRate)||openingRate<=0)
    return {valid:false,issues:['An explicit opening exchange rate is required for a foreign loan with an opening balance.'],loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
  const foreignSchedule=calculatePeriodicLoanSchedule({...loanInput,openingBalance:openingForeignBalance},periods,dayCountBasis)
  if(!foreignSchedule.valid)return {valid:false,issues:foreignSchedule.issues,loan:null,localSchedule:null,fxTranslation:null,openingCarryingAmountLocal:0}
  const fxTranslation=translatePeriodicForeignCurrencyLoan({
    currency:resolvedCurrency,periods,schedule:foreignSchedule.rows,
    openingForeignBalance,openingExchangeRateToLocal:openingRate,
  })
  if(!fxTranslation.valid)return {valid:false,issues:fxTranslation.issues,loan:null,localSchedule:null,fxTranslation,openingCarryingAmountLocal:openingForeignBalance*openingRate}
  const localSchedule=foreignSchedule.rows.map((row,index)=>{
    const translated=fxTranslation.rows[index]
    const rate=periodRates[index] as number
    const interestExpense=row.interestExpense*rate
    const financingFeeExpense=row.financingFeeExpense*rate
    const commitmentFeeExpense=row.commitmentFeeExpense*rate
    // Local debt roll-forward includes the non-cash period-end FX remeasurement.
    // Cash debt service remains translated at the supplied period rate.
    const openingBalance=translated.openingCarryingAmountLocal
    const drawdown=translated.drawdownLocal
    const capitalizedInterest=translated.capitalizedInterestLocal
    const capitalizedFinancingFees=translated.capitalizedFeesLocal
    const principal=translated.principalRepaymentLocal
    const foreignExchangeLoss=translated.foreignExchangeLossLocal
    const closingBalance=translated.closingCarryingAmountLocal
    return {
      period:index+1,drawdown,openingBalance,periodRatePercent:row.periodRatePercent,
      interestExpense,capitalizedInterest,financingFeeExpense,commitmentFeeExpense,
      capitalizedFinancingFees,principal,foreignExchangeLoss,closingBalance,
      debtService:interestExpense+financingFeeExpense+principal,
    }
  })
  return {
    valid:true,issues:[],loan:{id:loan.id,input:loanInput},localSchedule,fxTranslation,
    openingCarryingAmountLocal:openingForeignBalance*openingRate,
  }
}

export function bindLoanFacilitiesToPeriodicFinance(input:{
  finance:PeriodicProjectFinanceInput
  loans:LoanFacilityFormDraft[]
  foundation:ProjectFoundation
  openingForeignBalances?:Record<string,number>
  openingExchangeRatesToLocal?:Record<string,number>
}):ProjectLoanFinanceBinding {
  const issues:string[]=[]
  const bindings=input.loans.map(loan=>buildPeriodicLoanFacilityBinding({
    loan,foundation:input.foundation,periods:input.finance.periods,dayCountBasis:input.finance.dayCountBasis,
    openingLocalBalance:loan.openingLocalBalance??0,
    openingForeignBalance:input.openingForeignBalances?.[loan.id]??loan.openingForeignBalance??0,
    openingExchangeRateToLocal:input.openingExchangeRatesToLocal?.[loan.id],
  }))
  bindings.forEach((binding,index)=>{if(!binding.valid)issues.push(...binding.issues.map(issue=>input.loans[index].id+': '+issue))})
  if(new Set(input.loans.map(loan=>loan.id)).size!==input.loans.length)issues.push('Loan facility identifiers must be unique.')
  if(issues.length)return {valid:false,issues,financeInput:null,fxTranslations:[],openingDebtFromFacilitiesLocal:0}
  const existing=input.finance.loans.filter(loan=>!input.loans.some(form=>form.id===loan.id))
  const loans=[...existing,...bindings.map(binding=>binding.loan as PeriodicProjectLoan)]
  const precomputed={...(input.finance.precomputedLoanSchedules??{})}
  bindings.forEach(binding=>{
    if(binding.localSchedule)precomputed[(binding.loan as PeriodicProjectLoan).id]=binding.localSchedule
  })
  const fxTranslations=bindings.flatMap(binding=>binding.fxTranslation?[binding.fxTranslation]:[])
  return {
    valid:true,issues:[],
    financeInput:{...input.finance,loans,precomputedLoanSchedules:precomputed},
    fxTranslations,
    openingDebtFromFacilitiesLocal:bindings.reduce((sum,binding)=>sum+binding.openingCarryingAmountLocal,0),
  }
}

export function calculatePeriodicFinanceWithForeignCurrencyLoans(input:{
  finance:PeriodicProjectFinanceInput
  loans:LoanFacilityFormDraft[]
  foundation:ProjectFoundation
  openingBalances:PeriodicStatementOpeningBalances
  taxTreatment:'deductible'|'non-deductible'
  openingTaxLossCarryForward?:number
  openingForeignBalances?:Record<string,number>
  openingExchangeRatesToLocal?:Record<string,number>
}):ForeignCurrencyFinanceRunResult {
  const binding=bindLoanFacilitiesToPeriodicFinance(input)
  const invalid=calculateIntegratedPeriodicFinance({...input.finance,annualRevenue:[]})
  if(!binding.valid||!binding.financeInput)
    return {valid:false,finance:invalid,statements:[],fxPosting:null,issues:binding.issues}
  const finance=calculateIntegratedPeriodicFinance(binding.financeInput)
  if(!finance.valid)return {valid:false,finance,statements:[],fxPosting:null,issues:finance.warnings}
  const openingBalances={...input.openingBalances}
  if((openingBalances.debt??0)+0.01<binding.openingDebtFromFacilitiesLocal)
    return {valid:false,finance,statements:[],fxPosting:null,issues:['Opening statement debt does not include the foreign-loan opening carrying amounts.']}
  const statements=buildPeriodicThreeFinancialStatements(finance,openingBalances)
  if(!statements.length)return {valid:false,finance,statements:[],fxPosting:null,issues:['Base three-statement model could not be reconciled before FX remeasurement.']}
  if(!binding.fxTranslations.length)return {valid:true,finance,statements,fxPosting:null,issues:[]}
  const taxRates=input.finance.taxRatesByPeriod??input.finance.periods.map(period=>{
    const index=fiscalYearIndexForPeriod(period,input.finance.periods,input.finance.fiscalYearStartMonth)
    return input.finance.annualTaxRates[index]??Number.NaN
  })
  const fxPosting=postMultipleForeignCurrencyDebtsIntoThreeFinancialStatements({
    statements,debtTranslations:binding.fxTranslations,taxRatesPercent:taxRates,
    openingTaxLossCarryForward:input.openingTaxLossCarryForward,taxTreatment:input.taxTreatment,
    debtAlreadyRemeasured:true,
  })
  if(!fxPosting.valid)return {valid:false,finance,statements,fxPosting,issues:fxPosting.issues}
  return {valid:true,finance,statements:fxPosting.statements,fxPosting,issues:[]}
}
