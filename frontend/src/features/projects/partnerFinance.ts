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

export type PartnerFinanceResult = {
  valid: boolean
  warnings: string[]
  rows: PartnerCashFlowAllocation[]
  totalProjectEquityCashFlow: number
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
    valid: false, warnings, rows: [], totalProjectEquityCashFlow: 0,
    totalScheduledEquityContribution: 0,totalDeclaredCapitalContribution: 0,
    declaredCapitalContributionVariance: 0,distributedPositiveCashFlow: 0,retainedPositiveCashFlow: 0,
  })
  if (!finance.valid || !finance.rows.length) {
    warnings.push('A valid periodic equity cash-flow schedule is required before partner allocations can be calculated.')
    return empty()
  }
  if (!partners.length || partners.length > 20) {
    warnings.push('Define between one and twenty joint-venture partners.')
    return empty()
  }
  if (!Number.isFinite(positiveCashFlowDistributionPercent) ||
      positiveCashFlowDistributionPercent < 0 || positiveCashFlowDistributionPercent > 100) {
    warnings.push('The positive cash-flow distribution percentage must be between 0% and 100%.')
    return empty()
  }
  if (new Set(partners.map(partner=>partner.id)).size !== partners.length ||
      partners.some(partner=>!partner.id || !partner.name.trim() ||
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
  const rows: PartnerCashFlowAllocation[] = partners.map(partner=>({
    partnerId:partner.id,partnerName:partner.name.trim(),
    declaredCapitalContribution:partner.capitalContribution,
    negativeCashFlowAllocation:0,positiveCashFlowDistribution:0,netCashFlow:0,periods:[],
  }))
  let totalProjectEquityCashFlow=0
  let distributedPositiveCashFlow=0
  let retainedPositiveCashFlow=0
  finance.rows.forEach(period=>{
    const investorCashFlow=period.equityFreeCashFlow
    totalProjectEquityCashFlow+=investorCashFlow
    const distributionPool=Math.max(0,investorCashFlow)*positiveCashFlowDistributionPercent/100
    retainedPositiveCashFlow+=Math.max(0,investorCashFlow)-distributionPool
    distributedPositiveCashFlow+=distributionPool
    rows.forEach((row,index)=>{
      const partner=partners[index]
      const negativeAllocation=investorCashFlow<0
        ? investorCashFlow*partner.sharePercent/100 : 0
      const positiveDistribution=distributionPool*partner.profitSharePercent/100
      const allocatedCashFlow=negativeAllocation+positiveDistribution
      row.negativeCashFlowAllocation+=Math.abs(negativeAllocation)
      row.positiveCashFlowDistribution+=positiveDistribution
      row.netCashFlow+=allocatedCashFlow
      row.periods.push({
        period:period.period,startDate:period.startDate,endDate:period.endDate,
        allocatedCashFlow,negativeCashFlowAllocation:negativeAllocation,
        positiveCashFlowDistribution:positiveDistribution,
      })
    })
  })
  const totalDeclaredCapitalContribution=partners.reduce((sum,partner)=>sum+partner.capitalContribution,0)
  const totalScheduledEquityContribution=finance.totalEquityContribution
  return {
    valid:true,warnings,rows,totalProjectEquityCashFlow,totalScheduledEquityContribution,
    totalDeclaredCapitalContribution,
    declaredCapitalContributionVariance:totalDeclaredCapitalContribution-totalScheduledEquityContribution,
    distributedPositiveCashFlow,retainedPositiveCashFlow
  }
}
