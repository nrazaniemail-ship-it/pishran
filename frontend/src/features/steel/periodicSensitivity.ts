import type { PeriodicProjectFinanceInput, PeriodicProjectFinanceResult } from './periodicFinancialEngine'
import { calculateIntegratedPeriodicFinance } from './periodicFinancialEngine'

export type PeriodicSensitivityVariable =
  | 'revenue'
  | 'variable-cost'
  | 'fixed-cost'
  | 'investment'
  | 'working-capital'
  | 'tax-rate'
  | 'discount-rate'
  | 'loan-interest-rate'

export type PeriodicSensitivityMetric = 'npvProject' | 'irrProject' | 'npvEquity' | 'irrEquity'
export type PeriodicSensitivityPoint = {
  variable: PeriodicSensitivityVariable
  variationPercent: number
  metric: number | null
  valid: boolean
  warnings: string[]
}
export type PeriodicSensitivityResult = {
  valid: boolean
  baseline: PeriodicProjectFinanceResult
  points: PeriodicSensitivityPoint[]
  optimistic: PeriodicProjectFinanceResult
  pessimistic: PeriodicProjectFinanceResult
  issues: string[]
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
function mapSeries(values:number[],factor:number):number[] { return values.map(value=>value*factor) }

/** Apply one controlled shock to a copy of the complete periodic finance input. */
export function applyPeriodicSensitivityShock(
  input:PeriodicProjectFinanceInput,
  variable:PeriodicSensitivityVariable,
  variationPercent:number,
):PeriodicProjectFinanceInput {
  if (!finite(variationPercent) || variationPercent < -100) throw new Error('invalid-sensitivity-variation')
  const factor=1+variationPercent/100
  const next:PeriodicProjectFinanceInput={...input}
  switch(variable) {
    case 'revenue':
      next.annualRevenue=mapSeries(input.annualRevenue,factor)
      break
    case 'variable-cost':
      next.annualVariableCost=mapSeries(input.annualVariableCost,factor)
      break
    case 'fixed-cost':
      next.annualFixedCost=mapSeries(input.annualFixedCost,factor)
      break
    case 'investment':
      next.annualFixedInvestment=mapSeries(input.annualFixedInvestment,factor)
      next.annualPreOperatingCost=mapSeries(input.annualPreOperatingCost,factor)
      next.annualMaintenanceCapex=mapSeries(input.annualMaintenanceCapex,factor)
      break
    case 'working-capital':
      next.workingCapitalByPeriod=mapSeries(input.workingCapitalByPeriod,factor)
      next.openingWorkingCapital=(input.openingWorkingCapital??0)*factor
      break
    case 'tax-rate':
      next.annualTaxRates=input.annualTaxRates.map(rate=>Math.min(100,Math.max(0,rate+variationPercent)))
      next.taxRatesByPeriod=input.taxRatesByPeriod?.map(rate=>Math.min(100,Math.max(0,rate+variationPercent)))
      break
    case 'discount-rate':
      if(input.discountRatePercent==null) throw new Error('discount-rate-not-configured')
      next.discountRatePercent=Math.max(-99.999,input.discountRatePercent+variationPercent)
      break
    case 'loan-interest-rate':
      // A precomputed schedule is already the authoritative repayment path.
      // Mutating the source rate without rebuilding that schedule would produce
      // a false sensitivity result, so fail closed until its originating form
      // can be recalculated as part of the scenario.
      if(Object.keys(input.precomputedLoanSchedules??{}).length)
        throw new Error('loan-interest-rate-sensitivity-unavailable-for-precomputed-schedules')
      next.loans=input.loans.map(loan=>({
        ...loan,input:{
          ...loan.input,
          annualRatePercent:Math.max(0,loan.input.annualRatePercent+variationPercent),
          rateChanges:loan.input.rateChanges?.map(reset=>({
            ...reset,annualRatePercent:Math.max(0,reset.annualRatePercent+variationPercent)
          })),
        },
      }))
      break
  }
  return next
}

function metricValue(result:PeriodicProjectFinanceResult,metric:PeriodicSensitivityMetric):number|null {
  const value=result[metric]
  return value==null||!finite(value)?null:value
}

/** One-factor-at-a-time sensitivity and coherent optimistic/pessimistic combined cases. */
export function calculatePeriodicSensitivity(
  input:PeriodicProjectFinanceInput,
  variables:PeriodicSensitivityVariable[],
  shockPercent=10,
  metric:PeriodicSensitivityMetric='npvProject',
):PeriodicSensitivityResult {
  const issues:string[]=[]
  if(!finite(shockPercent)||shockPercent<=0||shockPercent>100) issues.push('Sensitivity shock must be greater than 0% and no more than 100%.')
  if(!variables.length||new Set(variables).size!==variables.length) issues.push('Select at least one unique sensitivity variable.')
  if(issues.length) {
    const invalid=calculateIntegratedPeriodicFinance({...input,annualRevenue:[]})
    return {valid:false,baseline:invalid,points:[],optimistic:invalid,pessimistic:invalid,issues}
  }
  const baseline=calculateIntegratedPeriodicFinance(input)
  if(!baseline.valid) return {valid:false,baseline,points:[],optimistic:baseline,pessimistic:baseline,issues:['Base case is invalid: '+baseline.warnings.join('; ')]}
  const points:PeriodicSensitivityPoint[]=[]
  for(const variable of variables) {
    for(const variationPercent of [-shockPercent,shockPercent]) {
      try {
        const result=calculateIntegratedPeriodicFinance(applyPeriodicSensitivityShock(input,variable,variationPercent))
        points.push({variable,variationPercent,metric:metricValue(result,metric),valid:result.valid,warnings:result.warnings})
      } catch(error) {
        issues.push(variable+': '+(error instanceof Error?error.message:'invalid sensitivity input'))
      }
    }
  }
  const optimisticInput={...input}
  const pessimisticInput={...input}
  for(const variable of variables) {
    const optimisticShock:Record<PeriodicSensitivityVariable,number>={
      revenue:shockPercent,'variable-cost':-shockPercent,'fixed-cost':-shockPercent,
      investment:-shockPercent,'working-capital':-shockPercent,'tax-rate':-shockPercent,
      'discount-rate':-shockPercent,'loan-interest-rate':-shockPercent,
    }
    const pessimisticShock:Record<PeriodicSensitivityVariable,number>={
      revenue:-shockPercent,'variable-cost':shockPercent,'fixed-cost':shockPercent,
      investment:shockPercent,'working-capital':shockPercent,'tax-rate':shockPercent,
      'discount-rate':shockPercent,'loan-interest-rate':shockPercent,
    }
    try {
      Object.assign(optimisticInput,applyPeriodicSensitivityShock(optimisticInput,variable,optimisticShock[variable]))
      Object.assign(pessimisticInput,applyPeriodicSensitivityShock(pessimisticInput,variable,pessimisticShock[variable]))
    } catch(error) {
      issues.push(variable+': '+(error instanceof Error?error.message:'invalid scenario input'))
    }
  }
  const optimistic=calculateIntegratedPeriodicFinance(optimisticInput)
  const pessimistic=calculateIntegratedPeriodicFinance(pessimisticInput)
  if(points.some(point=>!point.valid)) issues.push('One or more sensitivity cases are invalid; inspect their warnings.')
  if(!optimistic.valid||!pessimistic.valid) issues.push('Optimistic or pessimistic combined scenario is invalid.')
  return {valid:issues.length===0,baseline,points,optimistic,pessimistic,issues}
}

export type PeriodicTargetSearchResult={
  achieved:boolean
  variable:PeriodicSensitivityVariable
  target:number
  metric:PeriodicSensitivityMetric
  baseValue:number|null
  achievedValue:number|null
  result:PeriodicProjectFinanceResult
  iterations:number
  issues:string[]
}

/** Binary-search a single model driver until project/equity NPV or IRR reaches its target. */
export function searchPeriodicFinanceTarget(input:{
  finance:PeriodicProjectFinanceInput
  variable:PeriodicSensitivityVariable
  metric:PeriodicSensitivityMetric
  target:number
  direction:'increase'|'decrease'
  maxVariationPercent:number
  tolerance?:number
  maxIterations?:number
}):PeriodicTargetSearchResult {
  const issues:string[]=[]
  const {finance,variable,metric,target,direction}=input
  const tolerance=input.tolerance??0.0001
  const maxIterations=input.maxIterations??80
  const base=calculateIntegratedPeriodicFinance(finance)
  const baseValue=base.valid?metricValue(base,metric):null
  const fail=(message:string):PeriodicTargetSearchResult=>({
    achieved:false,variable,target,metric,baseValue,achievedValue:null,result:base,iterations:0,issues:[message],
  })
  if(!base.valid||baseValue==null) return fail('Base model is invalid or the selected metric is unavailable.')
  if(!finite(target)||!finite(input.maxVariationPercent)||input.maxVariationPercent<=0||
     !finite(tolerance)||tolerance<=0||!Number.isInteger(maxIterations)||maxIterations<1)
    return fail('Target, maximum variation, tolerance or iteration limit is invalid.')
  const reached=(value:number)=>direction==='increase'?value>=target:value<=target
  if(reached(baseValue)) return {achieved:true,variable,target,metric,baseValue,achievedValue:baseValue,result:base,iterations:0,issues:[]}
  const sign=direction==='increase'?1:-1
  let low=0,high=input.maxVariationPercent
  const evaluate=(variation:number)=>{
    const result=calculateIntegratedPeriodicFinance(applyPeriodicSensitivityShock(finance,variable,sign*variation))
    return {result,value:result.valid?metricValue(result,metric):null}
  }
  let upper=evaluate(high)
  if(upper.value==null||!reached(upper.value)) {
    return {achieved:false,variable,target,metric,baseValue,achievedValue:upper.value,result:upper.result,iterations:1,issues:['Target not reached within the permitted variation range.']}
  }
  let best=upper,iterations=1
  while(iterations<maxIterations&&high-low>tolerance) {
    const mid=(low+high)/2
    const candidate=evaluate(mid);iterations++
    if(candidate.value==null) { high=mid;continue }
    if(reached(candidate.value)) {high=mid;best=candidate}
    else low=mid
  }
  return {achieved:true,variable,target,metric,baseValue,achievedValue:best.value,result:best.result,iterations,issues:[]}
}
