import type { PeriodicProjectFinanceResult, PeriodicFinancialStatement } from '../steel/periodicFinancialEngine'
import type { HelpDrivenProjectForms } from './projectModelHelpForms'

export type ShareholderDistributionPeriod = {
  period: number
  openingDistributableProfit: number
  netIncome: number
  profitAvailable: number
  retainedProfit: number
  preferredDividend: number
  ordinaryDividend: number
  totalDividend: number
  repatriatedDividend: number
  ordinaryAllocations: {shareholderClass:string;amount:number}[]
  preferredAllocations: {shareholderClass:string;amount:number}[]
  capitalRefund: number
  terminalNetWorthDistribution: number
  closingRetainedEarnings: number
  closingPaidInCapital: number
  closingCash: number
}
export type ShareholderDistributionResult = {
  valid: boolean
  issues: string[]
  periods: ShareholderDistributionPeriod[]
  finance: PeriodicProjectFinanceResult
  statements: PeriodicFinancialStatement[]
  totalDividends: number
  totalCapitalRefund: number
  totalRepatriatedDividend: number
}

const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)
const nonNegative=(value:unknown):value is number=>finite(value)&&value>=0
const close=(a:number,b:number)=>Math.abs(a-b)<=0.01

/**
 * Posts shareholder distributions after tax and after accumulated-loss coverage.
 * Dividends reduce retained earnings; capital refunds reduce paid-in capital.
 * Both are financing cash outflows and are kept outside project free cash flow.
 */
export function applyShareholderDistributions(
  finance:PeriodicProjectFinanceResult,
  statements:PeriodicFinancialStatement[],
  forms:HelpDrivenProjectForms|undefined,
):ShareholderDistributionResult {
  const empty=(issues:string[]):ShareholderDistributionResult=>({
    valid:false,issues,periods:[],finance,statements,totalDividends:0,totalCapitalRefund:0,totalRepatriatedDividend:0,
  })
  if(!finance.valid||statements.length!==finance.rows.length||!statements.length)
    return empty(['Shareholder distribution requires a valid, reconciled periodic finance run.'])
  const policies=forms?.sections?.['profit-distribution']??[]
  const partners=forms?.sections?.['joint-venture']??[]
  if(!policies.length&&!partners.some(row=>['paidIn','paidOut','preferredDividendAbsolute','preferredDividendPercent','netWorthDistribution'].some(key=>finite(row.values[key])&&row.values[key]>0)))
    return {valid:true,issues:[],periods:[],finance,statements,totalDividends:0,totalCapitalRefund:0,totalRepatriatedDividend:0}
  const periodIndex=(key:unknown):number=>{
    if(typeof key!=='string'||!key.trim())return -1
    const matches=finance.rows.map((row,index)=>String(row.period)===key.trim()||row.startDate===key.trim()||row.endDate===key.trim()?index:-1).filter(index=>index>=0)
    return matches.length===1?matches[0]:-1
  }
  const issues:string[]=[]
  const policyByPeriod=new Map<number,typeof policies>()
  for(const [index,row] of policies.entries()){
    const p=periodIndex(row.values.period)
    if(p<0){issues.push('Profit-distribution row '+row.id+' must identify exactly one project period.');continue}
    const retained=row.values.retainedPercent,distributed=row.values.distributedPercent
    if(!finite(retained)||!finite(distributed)||retained<0||distributed<0||retained>100||distributed>100||!close(retained+distributed,100))
      issues.push('Profit-distribution row '+row.id+' must have retained and distributed percentages that sum to 100%.')
    const repatriated=row.values.repatriatedPercent
    if(repatriated!==null&&repatriated!==undefined&&(!finite(repatriated)||repatriated<0||repatriated>100))
      issues.push('Profit-distribution row '+row.id+' has an invalid repatriation percentage.')
    const netWorthDistribution=row.values.netWorthDistribution
    if(netWorthDistribution!==null&&netWorthDistribution!==undefined&&netWorthDistribution!==''&&(!finite(netWorthDistribution)||netWorthDistribution<0||netWorthDistribution>100))
      issues.push('Net-worth distribution percentage must be between 0% and 100%.')
    if(finite(netWorthDistribution)&&netWorthDistribution>0&&p!==finance.rows.length-1)
      issues.push('Net-worth distribution can only be entered in the final project period.')
    const share=row.values.remainingProfitShare
    if(share!==null&&share!==undefined&&(!finite(share)||share<0||share>100))
      issues.push('Profit-distribution row '+row.id+' has an invalid remaining-profit share.')
    policyByPeriod.set(p,[...(policyByPeriod.get(p)??[]),row])
  }
  const refunds=new Map<number,number>()
  const contributions=new Map<number,number>()
  const partnerContributions=new Map<string,Map<number,number>>()
  for(const row of partners){
    const partnerKey=String(row.values.name??row.id).trim()||row.id
    const paidIn=row.values.paidIn
    if(paidIn!==null&&paidIn!==undefined&&paidIn!==''){
      if(!nonNegative(paidIn)||periodIndex(row.values.period)<0)issues.push('Joint-venture contribution '+row.id+' requires a valid project period and non-negative paid-in amount.')
      else {
        const p=periodIndex(row.values.period)
        contributions.set(p,(contributions.get(p)??0)+paidIn)
        const schedule=partnerContributions.get(partnerKey)??new Map<number,number>()
        schedule.set(p,(schedule.get(p)??0)+paidIn)
        partnerContributions.set(partnerKey,schedule)
      }
    }
    const p=periodIndex(row.values.period)
    const refund=row.values.paidOut
    if(refund!==null&&refund!==undefined&&refund!==''){
      if(p<0||!nonNegative(refund))issues.push('Joint-venture capital refund '+row.id+' requires a valid project period and non-negative amount.')
      else refunds.set(p,(refunds.get(p)??0)+refund)
    }
    for(const key of ['preferredDividendAbsolute','preferredDividendPercent','profitSharePercent'] as const){
      const value=row.values[key]
      if(value!==null&&value!==undefined&&value!==''&&(!finite(value)||value<0||(key!=='preferredDividendAbsolute'&&value>100)))
        issues.push('Joint-venture row '+row.id+' has an invalid '+key+'.')
    }
  }
  if(!policies.length&&partners.some(row=>(finite(row.values.preferredDividendAbsolute)&&row.values.preferredDividendAbsolute>0)||(finite(row.values.preferredDividendPercent)&&row.values.preferredDividendPercent>0)))
    issues.push('Preferred dividend terms require an explicit profit-distribution policy before they can be posted.')
  if(issues.length)return empty(issues)
  const updatedFinance:PeriodicProjectFinanceResult={...finance,rows:finance.rows.map(row=>({...row}))}
  const periods:ShareholderDistributionPeriod[]=[]
  const updatedStatements=statements.map(statement=>({...statement,
    cashFlowStatement:{...statement.cashFlowStatement},
    balanceSheet:{...statement.balanceSheet},
    movementChecks:{...statement.movementChecks},
  }))
  let totalDividends=0,totalCapitalRefund=0,totalRepatriatedDividend=0
  let cumulativePaidIn=statements[0].openingBalances.paidInCapital
  let priorRefunds=0
  let retained=statements[0].openingBalances.retainedEarnings
  let paidIn=statements[0].openingBalances.paidInCapital
  const partnerCapitalBalances=new Map<string,number>()
  for(let i=0;i<finance.rows.length;i++){
    let row=updatedFinance.rows[i]
    const statement=updatedStatements[i]
    const newPartnerContribution=contributions.get(i)??0
    if(newPartnerContribution>0){
      updatedFinance.rows[i]={...row,equityContribution:row.equityContribution+newPartnerContribution,equityFreeCashFlow:row.equityFreeCashFlow+newPartnerContribution}
      updatedFinance.totalEquityContribution+=newPartnerContribution
      row=updatedFinance.rows[i]
      statement.cashFlowStatement.financingCashFlow+=newPartnerContribution
      statement.cashFlowStatement.netChangeInCash+=newPartnerContribution
      statement.cashFlowStatement.closingCash+=newPartnerContribution
      statement.balanceSheet.cash+=newPartnerContribution
      statement.balanceSheet.totalAssets+=newPartnerContribution
      statement.balanceSheet.paidInCapital+=newPartnerContribution
      statement.balanceSheet.totalEquity+=newPartnerContribution
      statement.balanceSheet.totalLiabilitiesAndEquity+=newPartnerContribution
    }
    const openingDistributableProfit=retained
    const netIncome=statement.incomeStatement.netIncome
    const profitAvailable=Math.max(0,openingDistributableProfit+netIncome)
    const rows=policyByPeriod.get(i)??[]
    const retainedPercent=rows.length?rows[0].values.retainedPercent as number:100
    const distributedPercent=rows.length?rows[0].values.distributedPercent as number:0
    if(rows.some(item=>!close(item.values.retainedPercent as number,retainedPercent)||!close(item.values.distributedPercent as number,distributedPercent))){
      issues.push('All profit-distribution rows in one period must use the same retained/distributed policy.')
      continue
    }
    const profitPool=profitAvailable*distributedPercent/100
    const preferredRows=partners.filter(item=>item.values.type==='preferred-shareholder')
    let preferredDividend=0
    const preferredAllocations:{shareholderClass:string;amount:number}[]=[]
    for(const partner of preferredRows){
      const partnerPeriod=partner.values.period
      if(typeof partnerPeriod==='string'&&partnerPeriod.trim()&&periodIndex(partnerPeriod)!==i)continue
      const partnerKey=String(partner.values.name??partner.id).trim()||partner.id
      const contribution=partnerContributions.get(partnerKey)?.get(i)??0
      const basis=(partnerCapitalBalances.get(partnerKey)??0)+contribution
      const absolute=finite(partner.values.preferredDividendAbsolute)?partner.values.preferredDividendAbsolute:0
      const percent=finite(partner.values.preferredDividendPercent)?partner.values.preferredDividendPercent:0
      const requested=absolute+basis*percent/100
      if(requested>0)preferredAllocations.push({shareholderClass:partnerKey,amount:requested})
      preferredDividend+=requested
    }
    preferredDividend=Math.min(profitPool,preferredDividend)
    if(preferredDividend>0){
      let remainingPreferred=preferredDividend
      for(let j=0;j<preferredAllocations.length;j++){
        const amount=j===preferredAllocations.length-1?remainingPreferred:Math.min(remainingPreferred,preferredAllocations[j].amount)
        preferredAllocations[j]={...preferredAllocations[j],amount};remainingPreferred-=amount
      }
    }
    const ordinaryPool=Math.max(0,profitPool-preferredDividend)
    const shareRows=rows.filter(item=>typeof item.values.shareholderClass==='string'&&item.values.shareholderClass.trim())
    const explicitShares=shareRows.map(item=>item.values.remainingProfitShare)
    let shareTotal=0
    if(explicitShares.some(value=>value!==null&&value!==undefined&&value!=='')){
      if(explicitShares.some(value=>!finite(value)||value<0))issues.push('Remaining-profit shares must be explicit percentages when any class share is entered.')
      else shareTotal=(explicitShares as number[]).reduce((sum,value)=>sum+value,0)
      if(!close(shareTotal,100))issues.push('Remaining-profit share percentages must sum to 100% in period '+row.period+'.')
    } else {
      const partnerShares=partners.filter(item=>item.values.type!=='preferred-shareholder'&&finite(item.values.profitSharePercent))
      shareTotal=partnerShares.reduce((sum,item)=>sum+(item.values.profitSharePercent as number),0)
      if(partnerShares.length&&!close(shareTotal,100))issues.push('Joint-venture profit-share percentages must sum to 100%.')
    }
    const ordinaryDividend=ordinaryPool
    const ordinaryAllocations:{shareholderClass:string;amount:number}[]=[]
    if(explicitShares.some(value=>value!==null&&value!==undefined&&value!=='')){
      for(const item of shareRows)ordinaryAllocations.push({shareholderClass:String(item.values.shareholderClass).trim(),amount:ordinaryPool*(item.values.remainingProfitShare as number)/100})
    } else {
      const partnerShares=partners.filter(item=>item.values.type!=='preferred-shareholder'&&finite(item.values.profitSharePercent))
      if(partnerShares.length){for(const item of partnerShares)ordinaryAllocations.push({shareholderClass:String(item.values.name??item.id),amount:ordinaryPool*(item.values.profitSharePercent as number)/100})}
      else if(ordinaryPool>0)ordinaryAllocations.push({shareholderClass:'unallocated',amount:ordinaryPool})
    }
    const totalDividend=preferredDividend+ordinaryDividend
    const repatriationValues=rows.map(item=>item.values.repatriatedPercent).filter(value=>value!==null&&value!==undefined&&value!=='')
    if(repatriationValues.some(value=>!finite(value)||!close(value as number,repatriationValues.length?repatriationValues[0] as number:0)))
      issues.push('All shareholder classes in one period must use the same dividend repatriation percentage.')
    const repatriationPercent=repatriationValues.length&&finite(repatriationValues[0])?repatriationValues[0]:0
    const repatriatedDividend=totalDividend*repatriationPercent/100
    const scheduledCapitalRefund=refunds.get(i)??0
    cumulativePaidIn+=row.equityContribution+row.equityWorkingCapitalContribution
    if(priorRefunds+scheduledCapitalRefund>cumulativePaidIn+0.01)
      issues.push('Capital refunds exceed cumulative paid-in capital in period '+row.period+'.')
    const preTerminalRetainedEarnings=retained+netIncome-totalDividend
    const preTerminalPaidInCapital=paidIn+row.equityContribution+row.equityWorkingCapitalContribution-scheduledCapitalRefund
    const preTerminalCash=statement.cashFlowStatement.closingCash-totalDividend-scheduledCapitalRefund
    const terminalPercent=rows.reduce((value,item)=>Math.max(value,finite(item.values.netWorthDistribution)?item.values.netWorthDistribution:0),0)
    const netWorthBeforeTerminal=statement.balanceSheet.totalAssets-totalDividend-scheduledCapitalRefund-statement.balanceSheet.totalLiabilities
    const terminalNetWorthDistribution=i===finance.rows.length-1?Math.max(0,netWorthBeforeTerminal)*terminalPercent/100:0
    const terminalCapitalRefund=Math.min(terminalNetWorthDistribution,Math.max(0,preTerminalPaidInCapital))
    const terminalDividend=terminalNetWorthDistribution-terminalCapitalRefund
    if(terminalDividend>preTerminalRetainedEarnings+0.01)
      issues.push('Terminal net-worth distribution exceeds the remaining retained earnings and paid-in capital available for return in period '+row.period+'.')
    const capitalRefund=scheduledCapitalRefund+terminalCapitalRefund
    const totalDividendWithTerminal=totalDividend+terminalDividend
    const totalOutflow=totalDividendWithTerminal+capitalRefund
    const availableCash=Math.max(0,statement.cashFlowStatement.closingCash)
    if(totalOutflow>availableCash+0.01)
      issues.push('Dividends and capital refunds exceed closing cash available in period '+row.period+'.')
    if(priorRefunds+capitalRefund>cumulativePaidIn+0.01)
      issues.push('Total scheduled and terminal capital refunds exceed cumulative paid-in capital in period '+row.period+'.')
    const closingRetainedEarnings=preTerminalRetainedEarnings-terminalDividend
    const closingPaidInCapital=preTerminalPaidInCapital-terminalCapitalRefund
    const closingCash=statement.cashFlowStatement.closingCash-totalOutflow
    const bs=statement.balanceSheet
    const totalAssets=bs.totalAssets-totalOutflow
    const totalEquity=closingPaidInCapital+closingRetainedEarnings
    const totalLiabilitiesAndEquity=bs.totalLiabilities+totalEquity
    const balanceDifference=totalAssets-totalLiabilitiesAndEquity
    statement.cashFlowStatement.financingCashFlow-=totalOutflow
    statement.cashFlowStatement.netChangeInCash-=totalOutflow
    statement.cashFlowStatement.closingCash=closingCash
    statement.balanceSheet.cash=closingCash
    statement.balanceSheet.totalAssets=totalAssets
    statement.balanceSheet.paidInCapital=closingPaidInCapital
    statement.balanceSheet.retainedEarnings=closingRetainedEarnings
    statement.balanceSheet.totalEquity=totalEquity
    statement.balanceSheet.totalLiabilitiesAndEquity=totalLiabilitiesAndEquity
    statement.balanceSheet.balanceDifference=balanceDifference
    statement.balanceSheet.reconciled=statement.balanceSheet.reconciled&&Math.abs(balanceDifference)<=0.01
    updatedFinance.rows[i]={...row,equityFreeCashFlow:row.equityFreeCashFlow-totalOutflow}
    periods.push({period:row.period,openingDistributableProfit,netIncome,profitAvailable,
      retainedProfit:profitAvailable*retainedPercent/100,preferredDividend,ordinaryDividend,totalDividend,
      repatriatedDividend,ordinaryAllocations,preferredAllocations,capitalRefund,terminalNetWorthDistribution,closingRetainedEarnings,closingPaidInCapital,closingCash})
    totalDividends+=totalDividendWithTerminal;totalCapitalRefund+=capitalRefund;totalRepatriatedDividend+=repatriatedDividend
    priorRefunds+=capitalRefund;retained=closingRetainedEarnings;paidIn=closingPaidInCapital
    for(const [partnerKey,schedule] of partnerContributions){partnerCapitalBalances.set(partnerKey,(partnerCapitalBalances.get(partnerKey)??0)+(schedule.get(i)??0))}
  }
  if(issues.length)return empty(issues)
  return {valid:true,issues:[],periods,finance:updatedFinance,statements:updatedStatements,totalDividends,totalCapitalRefund,totalRepatriatedDividend}
}
