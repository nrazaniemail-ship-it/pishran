import type { PeriodicProjectFinanceResult } from '../steel/periodicFinancialEngine'

export type JointVenturePartner = {
  id: string
  name: string
  sharePercent: number
  capitalContribution: number
  profitSharePercent: number
}

export type PartnerCashFlowAllocation = {
  partnerId: string
  partnerName: string
  declaredCapitalContribution: number
  expectedCapitalContribution: number
  capitalContributionVariance: number
  negativeCashFlowAllocation: number
  positiveCashFlowDistribution: number
  netCashFlow: number
  periods: {
    period: number
    startDate: string
    endDate: string
    allocatedCashFlow: number
    negativeCashFlowAllocation: number
    positiveCashFlowDistribution: number
  }[]
}

export type PartnerFinancePeriodSummary = {
  period:number
  startDate:string
  endDate:string
  totalEquityCashFlow:number
  partnerNetCashFlow:number
  distributedPositiveCashFlow:number
  retainedPositiveCashFlow:number
  reconciliationVariance:number
}

export type PartnerFinanceResult = {
  valid: boolean
  warnings: string[]
  rows: PartnerCashFlowAllocation[]
  periods: PartnerFinancePeriodSummary[]
  totalProjectEquityCashFlow: number
  positiveCashFlowDistributionPercent: number
  allocationReconciliationVariance: number
  totalScheduledEquityContribution: number
  totalDeclaredCapitalContribution: number
  declaredCapitalContributionVariance: number
  distributedPositiveCashFlow: number
  retainedPositiveCashFlow: number
}

/**
 * Allocates investor-level cash flows to JV partners.
 * Negative investor cash flows follow capital shares; positive cash flows are
 * distributed by profit shares, subject to the explicit distribution policy.
 * Declared capital contributions are reported for reconciliation and are not
 * deducted a second time from the engine's equity cash flows.
 */
export function allocateJointVentureCashFlows(
  finance: PeriodicProjectFinanceResult,
  partners: JointVenturePartner[],
  positiveCashFlowDistributionPercent: number,
): PartnerFinanceResult {
  const warnings: string[] = []
  const empty = (): PartnerFinanceResult => ({
    valid: false, warnings, rows: [], periods:[], totalProjectEquityCashFlow: 0,
    positiveCashFlowDistributionPercent:0,allocationReconciliationVariance:0,
    totalScheduledEquityContribution: 0,totalDeclaredCapitalContribution: 0,
    declaredCapitalContributionVariance: 0,distributedPositiveCashFlow: 0,retainedPositiveCashFlow: 0,
  })
  const validIsoDate=(value:unknown):value is string=>{
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
    const parsed=new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value
  }
  const financeRows=Array.isArray(finance?.rows)?finance.rows:[]
  const scheduleRowsValid=financeRows.length>0&&financeRows.every((period,index)=>{
    if(!period||typeof period!=='object')return false
    const start=validIsoDate(period.startDate),end=validIsoDate(period.endDate)
    const startTime=start?Date.parse(`${period.startDate}T00:00:00.000Z`):NaN
    const endTime=end?Date.parse(`${period.endDate}T00:00:00.000Z`):NaN
    const previous=finance.rows[index-1]
    const previousEnd=previous&&validIsoDate(previous.endDate)
      ?Date.parse(`${previous.endDate}T00:00:00.000Z`):NaN
    return Number.isInteger(period.period)&&period.period>0&&
      Number.isFinite(period.equityFreeCashFlow)&&
      Number.isFinite(period.equityContribution)&&period.equityContribution>=0&&
      Number.isFinite(period.equityWorkingCapitalContribution)&&period.equityWorkingCapitalContribution>=0&&
      start&&end&&endTime>=startTime&&
      (!previous||(period.period===previous.period+1&&startTime===previousEnd+86400000))
  })
  const rowScheduledEquityContribution=financeRows.reduce((sum,period)=>
    sum+(Number.isFinite(period.equityContribution)?period.equityContribution:0)+
      (Number.isFinite(period.equityWorkingCapitalContribution)?period.equityWorkingCapitalContribution:0),0)
  if (!finance || !finance.valid || !Array.isArray(finance.rows) || !scheduleRowsValid ||
      !Number.isFinite(finance.totalEquityContribution) || finance.totalEquityContribution < 0) {
    warnings.push('A valid periodic equity cash-flow schedule with finite, non-negative contribution components and ordered, valid period dates is required before partner allocations can be calculated.')
    return empty()
  }
  if(Math.abs(rowScheduledEquityContribution-finance.totalEquityContribution)>0.01){
    warnings.push('The aggregated equity contribution does not reconcile to the sum of periodic equity and shareholder-funded working-capital contributions.')
    return empty()
  }
  if (!Array.isArray(partners) || !partners.length || partners.length > 20) {
    warnings.push('Define between one and twenty joint-venture partners.')
    return empty()
  }
  if (!Number.isFinite(positiveCashFlowDistributionPercent) ||
      positiveCashFlowDistributionPercent < 0 || positiveCashFlowDistributionPercent > 100) {
    warnings.push('The positive cash-flow distribution percentage must be between 0% and 100%.')
    return empty()
  }
  if (partners.some(partner=>!partner||typeof partner!=='object'||
        typeof partner.id!=='string'||!partner.id.trim()||
        typeof partner.name!=='string'||!partner.name.trim()) ||
      new Set(partners.map(partner=>partner.id)).size !== partners.length ||
      partners.some(partner=>
        ![partner.sharePercent,partner.capitalContribution,partner.profitSharePercent].every(Number.isFinite) ||
        partner.sharePercent < 0 || partner.sharePercent > 100 ||
        partner.capitalContribution < 0 ||
        partner.profitSharePercent < 0 || partner.profitSharePercent > 100)) {
    warnings.push('Partner identifiers, names, capital contributions and participation percentages must be valid.')
    return empty()
  }
  const equityShareTotal=partners.reduce((sum,partner)=>sum+partner.sharePercent,0)
  const profitShareTotal=partners.reduce((sum,partner)=>sum+partner.profitSharePercent,0)
  if (Math.abs(equityShareTotal-100)>0.01 || Math.abs(profitShareTotal-100)>0.01) {
    warnings.push('Partner capital shares and profit-sharing percentages must each total 100%.')
    return empty()
  }
  const totalScheduledEquityContribution=finance.totalEquityContribution
  const rows: PartnerCashFlowAllocation[] = partners.map(partner=>({
    partnerId:partner.id,partnerName:partner.name.trim(),
    declaredCapitalContribution:partner.capitalContribution,
    expectedCapitalContribution:totalScheduledEquityContribution*partner.sharePercent/100,
    capitalContributionVariance:partner.capitalContribution-totalScheduledEquityContribution*partner.sharePercent/100,
    negativeCashFlowAllocation:0,positiveCashFlowDistribution:0,netCashFlow:0,periods:[],
  }))
  const periods:PartnerFinancePeriodSummary[]=[]
  let totalProjectEquityCashFlow=0
  let distributedPositiveCashFlow=0
  let retainedPositiveCashFlow=0
  finance.rows.forEach(period=>{
    const investorCashFlow=period.equityFreeCashFlow
    totalProjectEquityCashFlow+=investorCashFlow
    const distributionPool=Math.max(0,investorCashFlow)*positiveCashFlowDistributionPercent/100
    retainedPositiveCashFlow+=Math.max(0,investorCashFlow)-distributionPool
    distributedPositiveCashFlow+=distributionPool
    let partnerNetCashFlow=0
    rows.forEach((row,index)=>{
      const partner=partners[index]
      const negativeAllocation=investorCashFlow<0
        ? investorCashFlow*partner.sharePercent/100 : 0
      const positiveDistribution=distributionPool*partner.profitSharePercent/100
      const allocatedCashFlow=negativeAllocation+positiveDistribution
      partnerNetCashFlow+=allocatedCashFlow
      row.negativeCashFlowAllocation+=negativeAllocation
      row.positiveCashFlowDistribution+=positiveDistribution
      row.netCashFlow+=allocatedCashFlow
      row.periods.push({
        period:period.period,startDate:period.startDate,endDate:period.endDate,
        allocatedCashFlow,negativeCashFlowAllocation:negativeAllocation,
        positiveCashFlowDistribution:positiveDistribution,
      })
    })
    periods.push({
      period:period.period,startDate:period.startDate,endDate:period.endDate,
      totalEquityCashFlow:investorCashFlow,partnerNetCashFlow,
      distributedPositiveCashFlow:distributionPool,
      retainedPositiveCashFlow:Math.max(0,investorCashFlow)-distributionPool,
      reconciliationVariance:partnerNetCashFlow+Math.max(0,investorCashFlow)-distributionPool-investorCashFlow,
    })
  })
  const totalDeclaredCapitalContribution=partners.reduce((sum,partner)=>sum+partner.capitalContribution,0)
  const allocatedPartnerNetCashFlow=rows.reduce((sum,row)=>sum+row.netCashFlow,0)
  const allocationReconciliationVariance=allocatedPartnerNetCashFlow+retainedPositiveCashFlow-totalProjectEquityCashFlow
  const capitalContributionMismatch=rows.some(row=>Math.abs(row.capitalContributionVariance)>0.01)
  if(capitalContributionMismatch)warnings.push('Each partner declared capital contribution must reconcile to that partner’s scheduled contribution based on the agreed capital share.')
  if(Math.abs(totalDeclaredCapitalContribution-totalScheduledEquityContribution)>0.01)warnings.push('Total declared partner capital contributions do not reconcile to total scheduled equity contributions.')
  if(Math.abs(allocationReconciliationVariance)>0.01)warnings.push('Partner cash-flow allocations and retained cash do not reconcile to total equity cash flow.')
  return {
    valid:!capitalContributionMismatch&&Math.abs(totalDeclaredCapitalContribution-totalScheduledEquityContribution)<=0.01&&Math.abs(allocationReconciliationVariance)<=0.01,warnings,rows,periods,totalProjectEquityCashFlow,
    positiveCashFlowDistributionPercent,allocationReconciliationVariance,totalScheduledEquityContribution,
    totalDeclaredCapitalContribution,
    declaredCapitalContributionVariance:totalDeclaredCapitalContribution-totalScheduledEquityContribution,
    distributedPositiveCashFlow,retainedPositiveCashFlow
  }
}
