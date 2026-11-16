/**
 * Pure, deterministic formula rules for the help-driven project input model.
 * These functions are intentionally independent of any project benchmark.
 * They are calculation primitives, not a COMFAR-output certification.
 */
export type CostActivityBasis='production'|'sales'
export type NominalCapacityCostInput={
 standardQuantity:number;standardUnitPrice:number;nominalCapacity:number
 activityVolume:number;activityBasis:CostActivityBasis
 fixedPercent:number;variablePercent:number
 adjustmentQuantity?:number;adjustmentUnitPrice?:number
 adjustmentFixedPercent?:number;adjustmentVariablePercent?:number
}
export type CostBuildUp={standardCost:number;standardFixedCost:number;standardVariableCost:number;periodAdjustmentCost:number;adjustmentFixedCost:number;adjustmentVariableCost:number;totalCost:number}
const finiteNonNegative=(v:number)=>Number.isFinite(v)&&v>=0
const validSplit=(a:number,b:number)=>finiteNonNegative(a)&&finiteNonNegative(b)&&a<=100&&b<=100&&Math.abs(a+b-100)<1e-8
export function calculateNominalCapacityCost(input:NominalCapacityCostInput):CostBuildUp{
 const {standardQuantity,standardUnitPrice,nominalCapacity,activityVolume,fixedPercent,variablePercent}=input
 const aq=input.adjustmentQuantity??0,ap=input.adjustmentUnitPrice??0,af=input.adjustmentFixedPercent??0,av=input.adjustmentVariablePercent??0
 if(![standardQuantity,standardUnitPrice,nominalCapacity,activityVolume,aq,ap].every(finiteNonNegative)||nominalCapacity<=0)throw new Error('invalid-cost-volume-or-price')
 if(!validSplit(fixedPercent,variablePercent))throw new Error('invalid-fixed-variable-split')
 const standardCost=standardQuantity*standardUnitPrice
 const periodAdjustmentCost=aq*ap
 if(periodAdjustmentCost>0&&!validSplit(af,av))throw new Error('invalid-period-adjustment-split')
 const activityRatio=activityVolume/nominalCapacity
 const standardFixedCost=standardCost*fixedPercent/100
 const standardVariableCost=standardCost*variablePercent/100*activityRatio
 const adjustmentFixedCost=periodAdjustmentCost*af/100
 const adjustmentVariableCost=periodAdjustmentCost*av/100
 return {standardCost,standardFixedCost,standardVariableCost,periodAdjustmentCost,adjustmentFixedCost,adjustmentVariableCost,totalCost:standardFixedCost+standardVariableCost+adjustmentFixedCost+adjustmentVariableCost}
}
export function calculatePerUnitOutputCost(input:{inputQuantityPerUnit:number;unitPrice:number;outputVolume:number;fixedPeriodCost?:number}):{variableCost:number;fixedCost:number;totalCost:number}{
 const {inputQuantityPerUnit,unitPrice,outputVolume}=input,fixedCost=input.fixedPeriodCost??0
 if(![inputQuantityPerUnit,unitPrice,outputVolume,fixedCost].every(finiteNonNegative))throw new Error('invalid-per-unit-cost-input')
 const variableCost=inputQuantityPerUnit*unitPrice*outputVolume
 return {variableCost,fixedCost,totalCost:variableCost+fixedCost}
}
export function calculateWorkingCapitalTurnover(daysCoverage:number,periodDays=360):number{
 if(!finiteNonNegative(daysCoverage)||daysCoverage===0||!finiteNonNegative(periodDays)||periodDays===0)throw new Error('invalid-working-capital-days')
 return periodDays/daysCoverage
}
export function calculateNetWorkingCapital(currentAssets:number,currentLiabilities:number):number{
 if(!Number.isFinite(currentAssets)||!Number.isFinite(currentLiabilities)||currentAssets<0||currentLiabilities<0)throw new Error('invalid-working-capital-balances')
 return currentAssets-currentLiabilities
}
export function calculateWorkingCapitalMovement(previousNwc:number,currentNwc:number):{increase:number;release:number;netChange:number}{
 if(!Number.isFinite(previousNwc)||!Number.isFinite(currentNwc))throw new Error('invalid-working-capital-movement')
 const netChange=currentNwc-previousNwc
 return {increase:Math.max(0,netChange),release:Math.max(0,-netChange),netChange}
}
export type DepreciationMethod='linear-to-zero'|'linear-to-scrap'|'accelerated-declining-balance'|'sum-of-years-digits'
export type DepreciationPeriodInput={
 method:DepreciationMethod;acquisitionCost:number;salvageValue:number;usefulLifeMonths:number
 monthsElapsed:number;periodMonths:number;openingBookValue:number;annualRatePercent?:number;firstDepreciationYearMonths?:number
}
export type DepreciationPeriodResult={charge:number;closingBookValue:number;remainingLifeMonths:number;methodUsed:DepreciationMethod}
export function calculateAssetDepreciationPeriod(input:DepreciationPeriodInput):DepreciationPeriodResult{
 const {method,acquisitionCost,salvageValue,usefulLifeMonths,monthsElapsed,periodMonths,openingBookValue}=input
 if(![acquisitionCost,salvageValue,usefulLifeMonths,monthsElapsed,periodMonths,openingBookValue].every(Number.isFinite)||acquisitionCost<0||salvageValue<0||salvageValue>acquisitionCost||!Number.isInteger(usefulLifeMonths)||usefulLifeMonths<=0||monthsElapsed<0||periodMonths<0||openingBookValue<0)throw new Error('invalid-depreciation-input')
 const remainingLifeMonths=Math.max(0,usefulLifeMonths-monthsElapsed)
 const activeMonths=Math.min(periodMonths,remainingLifeMonths)
 const bookFloor=salvageValue
 const depreciableBase=acquisitionCost-salvageValue
 if(method==='sum-of-years-digits'&&(usefulLifeMonths%12!==0||(input.firstDepreciationYearMonths!==undefined&&input.firstDepreciationYearMonths!==12)))throw new Error('syd-partial-year-schedule-not-yet-implemented')
 if(activeMonths===0||openingBookValue<=bookFloor)return {charge:0,closingBookValue:Math.max(bookFloor,openingBookValue),remainingLifeMonths,methodUsed:method}
 let charge=0,methodUsed=method
 if(method==='linear-to-zero')charge=acquisitionCost/usefulLifeMonths*activeMonths
 else if(method==='linear-to-scrap')charge=depreciableBase/usefulLifeMonths*activeMonths
 else if(method==='sum-of-years-digits'){
  const lifeYears=Math.ceil(usefulLifeMonths/12),denominator=lifeYears*(lifeYears+1)/2
  let elapsed=monthsElapsed,months=activeMonths
  while(months>0){
   const yearIndex=Math.min(lifeYears-1,Math.floor(elapsed/12))
   const monthsInYear=Math.min(months,12-(elapsed%12))
   const remainingYears=lifeYears-yearIndex
   charge+=depreciableBase*(remainingYears/denominator)*(monthsInYear/12)
   elapsed+=monthsInYear;months-=monthsInYear
  }
 }else{
  const rate=input.annualRatePercent
  if(rate===undefined||!Number.isFinite(rate)||rate<0||rate>100)throw new Error('invalid-declining-balance-rate')
  const decliningCharge=openingBookValue*(rate/100)*activeMonths/12
  const straightLineCharge=Math.max(0,openingBookValue-salvageValue)/remainingLifeMonths*activeMonths
  if(decliningCharge>=straightLineCharge)charge=decliningCharge
  else {charge=straightLineCharge;methodUsed='linear-to-scrap'}
 }
 charge=Math.min(Math.max(0,charge),Math.max(0,openingBookValue-bookFloor))
 const closingBookValue=Math.max(bookFloor,openingBookValue-charge)
 return {charge,closingBookValue,remainingLifeMonths:Math.max(0,remainingLifeMonths-activeMonths),methodUsed}
}
export type AnnuityLoanPeriod={period:number;openingBalance:number;payment:number;interest:number;principal:number;closingBalance:number}
export function buildAnnuityLoanSchedule(principal:number,annualRatePercent:number,periodsPerYear:number,numberOfPayments:number):AnnuityLoanPeriod[]{
 if(!finiteNonNegative(principal)||!finiteNonNegative(annualRatePercent)||!Number.isInteger(periodsPerYear)||periodsPerYear<=0||!Number.isInteger(numberOfPayments)||numberOfPayments<=0)throw new Error('invalid-annuity-loan-input')
 if(principal===0)return Array.from({length:numberOfPayments},(_,i)=>({period:i+1,openingBalance:0,payment:0,interest:0,principal:0,closingBalance:0}))
 const rate=annualRatePercent/100/periodsPerYear
 const payment=rate===0?principal/numberOfPayments:principal*rate*Math.pow(1+rate,numberOfPayments)/(Math.pow(1+rate,numberOfPayments)-1)
 let balance=principal
 return Array.from({length:numberOfPayments},(_,i)=>{
  const openingBalance=balance,interest=openingBalance*rate
  const principalPaid=i===numberOfPayments-1?openingBalance:Math.min(openingBalance,Math.max(0,payment-interest))
  const actualPayment=principalPaid+interest
  balance=Math.max(0,openingBalance-principalPaid)
  return {period:i+1,openingBalance,payment:actualPayment,interest,principal:principalPaid,closingBalance:balance}
 })
}
export function rollForwardDebt(openingDebt:number,disbursements:number,principalRepayments:number,capitalizedInterest:number):number{
 if(![openingDebt,disbursements,principalRepayments,capitalizedInterest].every(finiteNonNegative)||principalRepayments>openingDebt+disbursements+capitalizedInterest+1e-8)throw new Error('invalid-debt-roll-forward')
 return openingDebt+disbursements-principalRepayments+capitalizedInterest
}
