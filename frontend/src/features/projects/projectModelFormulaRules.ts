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
 const firstYearMonths=input.firstDepreciationYearMonths??Math.min(12,usefulLifeMonths)
 if(!Number.isInteger(firstYearMonths)||firstYearMonths<1||firstYearMonths>12||firstYearMonths>usefulLifeMonths)throw new Error('invalid-first-depreciation-year-months')
 if(method==='sum-of-years-digits'&&usefulLifeMonths%12===0&&firstYearMonths!==12)throw new Error('syd-exact-year-life-with-partial-first-year-not-defined-by-reference')
 if(activeMonths===0||openingBookValue<=bookFloor)return {charge:0,closingBookValue:Math.max(bookFloor,openingBookValue),remainingLifeMonths,methodUsed:method}
 let charge=0,methodUsed=method
 if(method==='linear-to-zero'||method==='linear-to-scrap'){
  const base=method==='linear-to-zero'?acquisitionCost:depreciableBase
  const m1=firstYearMonths,L=usefulLifeMonths/12,svRate=acquisitionCost===0?0:salvageValue/acquisitionCost
  const M=Math.max(1,Math.floor((method==='linear-to-zero'?(1-svRate):1)*L-m1/12+1))
  const segments=[m1,...Array(Math.max(0,M-1)).fill(12)]
  const elapsedBeforeFinal=segments.reduce((sum,v)=>sum+v,0)
  const finalMonths=Math.max(0,usefulLifeMonths-elapsedBeforeFinal)
  const annual=base/L
  const annualCharges=[annual*m1/12,...Array(Math.max(0,M-1)).fill(annual)]
  const finalCharge=Math.max(0,acquisitionCost-annualCharges.reduce((sum,v)=>sum+v,0)-salvageValue)
  const schedule=[...annualCharges,finalCharge]
  let cursor=0
  for(let i=0;i<schedule.length;i++){
   const length=i===0?m1:i<M?12:finalMonths
   const overlap=Math.max(0,Math.min(monthsElapsed+activeMonths,cursor+length)-Math.max(monthsElapsed,cursor))
   if(length>0&&overlap>0)charge+=schedule[i]*overlap/length
   cursor+=length
  }
 }else if(method==='sum-of-years-digits'){
  const Y=Math.floor(usefulLifeMonths/12),m=usefulLifeMonths%12,m1=firstYearMonths,base=depreciableBase
  if(m===0){
   // The manual's whole-year SYD amounts are annual tranches. A partial first
   // depreciation year shifts the calendar-year boundaries, so later reporting
   // years contain the unused tail of one tranche plus the head of the next.
   // Accrue each annual tranche uniformly by month and intersect it with the
   // requested reporting interval; this preserves the exact SYD total.
   const divisor=Y*(Y+1)/2
   const trancheAmounts=Array.from({length:Y},(_,i)=>(Y-i)/divisor*base)
   const requestedStart=monthsElapsed
   const requestedEnd=monthsElapsed+activeMonths
   const bucketStarts:number[]=[0]
   const bucketLengths:number[]=[m1]
   let next=m1
   while(next<usefulLifeMonths){bucketStarts.push(next);const length=Math.min(12,usefulLifeMonths-next);bucketLengths.push(length);next+=length}
   for(let bucket=0;bucket<bucketStarts.length;bucket++){
    const bucketStart=bucketStarts[bucket],bucketEnd=bucketStart+bucketLengths[bucket]
    const overlapStart=Math.max(requestedStart,bucketStart),overlapEnd=Math.min(requestedEnd,bucketEnd)
    if(overlapEnd<=overlapStart)continue
    for(let tranche=0;tranche<Y;tranche++){
     const trancheStart=tranche*12,trancheEnd=trancheStart+12
     const overlap=Math.max(0,Math.min(overlapEnd,trancheEnd)-Math.max(overlapStart,trancheStart))
     if(overlap>0)charge+=trancheAmounts[tranche]*overlap/12
    }
   }
  }else{
   const sodl=(Y+1)*(Y+2*m/12)/2,sodlAdj=(Y+1)*Y/2
   const d1=(Y+m/12)/sodl*(m/12)*base
   const intermediate=[d1]
   for(let j=2;j<=Y+1;j++)intermediate.push((Y-j+2)/sodlAdj*(base-d1))
   const partial=[]
   if(m1<=m){
    partial.push(d1*m1/m)
    for(let j=2;j<=Y+1;j++){const prev=intermediate[j-2]??0,cur=intermediate[j-1]??0;partial.push(prev*(m-m1)/12+cur*(12-(m-m1))/12)}
   }else{
    partial.push(d1+((intermediate[1]??0)*(m1-m)/12))
    for(let j=2;j<=Y;j++){const cur=intermediate[j-1]??0,next=intermediate[j]??0;partial.push(cur*(m1-m)/12+next*(12-(m1-m))/12)}
   }
   const segs=[m1,...Array(Math.max(0,Math.ceil((usefulLifeMonths-m1)/12))).fill(12)].map((v,i)=>i===0?v:Math.min(12,usefulLifeMonths-(m1+(i-1)*12)))
   const total=partial.reduce((sum,v)=>sum+v,0);if(segs.length>partial.length)partial.push(base-total);else if(partial.length)partial[partial.length-1]+=base-total
   let cursor=0
   for(let i=0;i<segs.length;i++){const len=segs[i]??0,amt=partial[i]??0,overlap=Math.max(0,Math.min(monthsElapsed+activeMonths,cursor+len)-Math.max(monthsElapsed,cursor));if(len>0)charge+=amt*overlap/len;cursor+=len}
  }
 }else{
  const rate=input.annualRatePercent
  if(rate===undefined||!Number.isFinite(rate)||rate<0||rate>100)throw new Error('invalid-declining-balance-rate')
  const lengths=[Math.min(firstYearMonths,usefulLifeMonths)]
  let unallocated=usefulLifeMonths-lengths[0]
  while(unallocated>0){const length=Math.min(12,unallocated);lengths.push(length);unallocated-=length}
  let book=acquisitionCost,cursor=0,switched=false
  const requestedEnd=monthsElapsed+activeMonths
  for(const length of lengths){
   const remaining=usefulLifeMonths-cursor
   if(book<=salvageValue||remaining<=0)break
   const declining=book*(rate/100)*length/12
   const straight=Math.max(0,book-salvageValue)/remaining*length
   let segmentCharge:number
   if(!switched&&declining>straight)segmentCharge=declining
   else{switched=true;segmentCharge=straight}
   segmentCharge=Math.min(segmentCharge,Math.max(0,book-salvageValue))
   const overlap=Math.max(0,Math.min(requestedEnd,cursor+length)-Math.max(monthsElapsed,cursor))
   if(overlap>0)charge+=segmentCharge*overlap/length
   if(switched&&cursor<requestedEnd)methodUsed='linear-to-scrap'
   book-=segmentCharge
   cursor+=length
  }
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
