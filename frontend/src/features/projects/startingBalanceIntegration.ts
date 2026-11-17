import { allocateAnnualFlowsToPeriods, type PeriodicProjectFinanceInput, type PeriodicStatementOpeningBalances } from '../steel/periodicFinancialEngine'
import type { ProjectFoundation, ProjectCalendarPeriod } from './projectFoundation'
import type { HelpFormRow } from './projectModelHelpForms'

export type StartingBalanceIntegrationResult={
  valid:boolean
  issues:string[]
  openingBalances:PeriodicStatementOpeningBalances
  financeInput:PeriodicProjectFinanceInput
  translatedRows:{rowId:string;category:string;amountLocal:number;exchangeRate:number}[]
  openingAssets:number
  openingLiabilitiesAndEquity:number
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const blankBalances=():Required<PeriodicStatementOpeningBalances>=>({
  cash:0,debt:0,netFixedAssets:0,netWorkingCapital:0,
  deferredPreOperatingAssets:0,paidInCapital:0,retainedEarnings:0,
})

/**
 * Converts the raw-template opening-balance subledger into the exact opening
 * balances consumed by the periodic statements. Amounts are translated at the
 * local-currency carrying value. Foreign opening balances fail closed because
 * cash/receivable/payable and debt subledgers do not yet carry period-by-period
 * foreign-currency revaluation through this raw-template section. Existing fixed
 * assets require a straight-line-to-zero remaining-life schedule.
 */
export function bindStartingBalancesToPeriodicFinance(input:{
  rows:readonly HelpFormRow[]
  periods:readonly ProjectCalendarPeriod[]
  finance:PeriodicProjectFinanceInput
  currencies:ProjectFoundation['currencies']
  existingOpeningBalances?:PeriodicStatementOpeningBalances
  summaryOpeningBalanceEnabled?:boolean
}):StartingBalanceIntegrationResult {
  const issues:string[]=[]
  const openingBalances=blankBalances()
  const financeInput:PeriodicProjectFinanceInput={...input.finance,annualDepreciation:[...input.finance.annualDepreciation]}
  const translatedRows:StartingBalanceIntegrationResult['translatedRows']=[]
  const fail=():StartingBalanceIntegrationResult=>({
    valid:false,issues,openingBalances,financeInput,translatedRows,openingAssets:0,openingLiabilitiesAndEquity:0,
  })
  if(!input.rows.length)return {valid:true,issues:[],openingBalances:input.existingOpeningBalances??blankBalances(),financeInput:input.finance,translatedRows,openingAssets:0,openingLiabilitiesAndEquity:0}
  if(input.summaryOpeningBalanceEnabled)
    issues.push('Detailed raw-template starting balances cannot be combined with the summary opening balance sheet.')
  if(Object.values(input.existingOpeningBalances??{}).some(value=>finite(value)&&Math.abs(value)>0.000001))
    issues.push('Detailed raw-template starting balances cannot be combined with separately supplied opening balances.')
  if(!input.periods.length||input.periods.length!==input.finance.periods.length)
    issues.push('Starting balances require the same non-empty project calendar as the periodic finance input.')
  if(input.periods.some((period,index)=>period.index!==input.finance.periods[index]?.index))
    issues.push('Starting-balance calendar periods do not match the financial model periods.')
  const localCode=input.currencies.localCurrencyCode.trim().toUpperCase()
  if(!localCode)issues.push('A local accounting currency is required to translate opening balances.')
  let openingAssets=0,openingLiabilitiesAndEquity=0
  const annualDepreciation=[...input.finance.annualDepreciation]
  const incrementalAnnualDepreciation=Array(annualDepreciation.length).fill(0) as number[]
  for(const row of input.rows){
    const v=row.values
    const category=typeof v.category==='string'?v.category:''
    const item=typeof v.item==='string'?v.item.trim():''
    const amount=v.amount
    const currency=typeof v.currency==='string'?v.currency.trim().toUpperCase():''
    const origin=v.origin
    if(!item)issues.push('Starting-balance row '+row.id+' requires an account description.')
    if(!finite(amount)) {issues.push('Starting-balance row '+row.id+' requires a finite amount.');continue}
    if(category!=='retained-earnings'&&amount<0){issues.push('Starting-balance row '+row.id+' cannot have a negative amount for '+category+'.');continue}
    if(origin!=='local'&&origin!=='foreign'){issues.push('Starting-balance row '+row.id+' must identify local or foreign currency origin.');continue}
    if(!currency){issues.push('Starting-balance row '+row.id+' requires a currency code.');continue}
    if(origin==='foreign'){
      issues.push('Foreign-currency opening balance '+row.id+' requires a period-by-period monetary revaluation subledger. Enter its local-currency carrying value here; record foreign-currency debt in the linked loan facility.')
      continue
    }
    if(currency!==localCode){issues.push('Starting-balance row '+row.id+' must use the project local currency '+localCode+' for its recorded carrying value.');continue}
    const exchangeRate=1
    const foreignPercent=v.foreignPercent
    if(foreignPercent!==null&&foreignPercent!==undefined&&foreignPercent!==''&&(!finite(foreignPercent)||foreignPercent!==0)){
      issues.push('Starting-balance row '+row.id+' uses a mixed-currency percentage; split it into separate local and foreign rows.')
      continue
    }
    const quantity=v.quantity,unitPrice=v.unitPrice
    if(quantity!==null&&quantity!==undefined&&quantity!==''&&!finite(quantity)){issues.push('Starting-balance row '+row.id+' has an invalid quantity.');continue}
    if(unitPrice!==null&&unitPrice!==undefined&&unitPrice!==''&&!finite(unitPrice)){issues.push('Starting-balance row '+row.id+' has an invalid unit price.');continue}
    if(finite(quantity)&&quantity<0||finite(unitPrice)&&unitPrice<0){issues.push('Starting-balance row '+row.id+' quantity and unit price cannot be negative.');continue}
    if(finite(quantity)&&finite(unitPrice)&&Math.abs(quantity*unitPrice-amount)>Math.max(0.01,Math.abs(amount)*1e-8)){
      issues.push('Starting-balance row '+row.id+' amount does not reconcile to quantity multiplied by unit price.')
      continue
    }
    const amountLocal=amount*exchangeRate
    if(!Number.isFinite(amountLocal)){issues.push('Starting-balance row '+row.id+' overflows after currency translation.');continue}
    switch(category){
      case 'cash-in-hand':
      case 'cash-surplus':
        openingBalances.cash!+=amountLocal;openingAssets+=amountLocal;break
      case 'fixed-assets': {
        openingBalances.netFixedAssets!+=amountLocal;openingAssets+=amountLocal
        if(amountLocal>0){
          if(v.depreciationMethod!=='linear-to-zero')
            issues.push('Existing fixed asset '+row.id+' currently supports only linear-to-zero depreciation from its opening carrying amount.')
          if(!finite(v.remainingLife)||v.remainingLife<=0||v.remainingLife>100)
            issues.push('Existing fixed asset '+row.id+' requires a remaining useful life greater than 0 and no greater than 100 years.')
          else if(v.depreciationMethod==='linear-to-zero'){
            const annualCharge=amountLocal/v.remainingLife
            for(let year=0;year<annualDepreciation.length;year++){
              const fraction=Math.min(1,Math.max(0,v.remainingLife-year))
              if(fraction>0){
                const charge=annualCharge*fraction
                annualDepreciation[year]+=charge
                incrementalAnnualDepreciation[year]+=charge
              }
            }
          }
        }
        break
      }
      case 'materials-supplies':
      case 'work-in-progress':
      case 'finished-products':
      case 'accounts-receivable':
      case 'other-current-assets':
        openingBalances.netWorkingCapital!+=amountLocal;openingAssets+=amountLocal;break
      case 'accounts-payable':
      case 'other-current-liabilities':
        openingBalances.netWorkingCapital!-=amountLocal;openingAssets-=amountLocal;break
      case 'short-term-debt':
      case 'long-term-debt':
        openingBalances.debt!+=amountLocal;openingLiabilitiesAndEquity+=amountLocal;break
      case 'equity-capital':
        openingBalances.paidInCapital!+=amountLocal;openingLiabilitiesAndEquity+=amountLocal;break
      case 'retained-earnings':
        openingBalances.retainedEarnings!+=amountLocal;openingLiabilitiesAndEquity+=amountLocal;break
      case 'deferred-pre-operating-assets':
        openingBalances.deferredPreOperatingAssets!+=amountLocal;openingAssets+=amountLocal;break
      case 'short-term-deposits':
        issues.push('Short-term deposits are not treated as immediately available cash; a separate restricted-deposit asset schedule is required.')
        continue
      case 'other-assets':
        issues.push('Starting-balance category other-assets is ambiguous; classify the balance as other-current-assets, fixed-assets or deferred-pre-operating-assets.')
        continue
      case 'grants-subsidies':
        issues.push('Opening grants and subsidies require a deferred-grant liability/equity treatment that is not represented in the current periodic balance-sheet schema.')
        continue
      default:
        issues.push('Starting-balance row '+row.id+' uses an unsupported balance category.')
        continue
    }
    translatedRows.push({rowId:row.id,category,amountLocal,exchangeRate})
  }
  if(openingBalances.netWorkingCapital!<0)
    issues.push('Opening net working capital is negative; the current periodic engine requires a non-negative opening working-capital balance.')
  const balanceDifference=openingAssets-openingLiabilitiesAndEquity
  if(Math.abs(balanceDifference)>0.01)
    issues.push('Translated opening balances do not reconcile: assets minus liabilities and equity equals '+balanceDifference.toFixed(2)+'.')
  if(issues.length)return fail()
  financeInput.annualDepreciation=annualDepreciation
  financeInput.openingWorkingCapital=openingBalances.netWorkingCapital
  if(input.finance.periodDepreciationSchedule){
    const allocatedOpeningDepreciation=allocateAnnualFlowsToPeriods(incrementalAnnualDepreciation,[...input.periods],input.finance.fiscalYearStartMonth)
    if(allocatedOpeningDepreciation.length!==input.periods.length||allocatedOpeningDepreciation.some(value=>!Number.isFinite(value))){
      issues.push('Opening fixed-asset depreciation could not be allocated to the project calendar.')
      return fail()
    }
    financeInput.periodDepreciationSchedule=input.finance.periodDepreciationSchedule.map((value,index)=>value+allocatedOpeningDepreciation[index])
  }
  return {valid:true,issues:[],openingBalances,financeInput,translatedRows,openingAssets,openingLiabilitiesAndEquity}
}
