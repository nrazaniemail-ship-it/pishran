/**
 * Financial algorithms transcribed from the COMFAR III Expert Reference Manual.
 * These pure functions are formula-level building blocks, not a complete
 * period-by-period calculation engine or certification of output equivalence.
 */
const finite=(x:number)=>Number.isFinite(x)
const nonNegative=(x:number)=>finite(x)&&x>=0
export type PeriodCostInput={
 standardQuantity:number;standardUnitPrice:number;nominalCapacity:number
 activityVolume:number;activityBasis:'sales'|'production'
 fixedPercent:number;variablePercent:number;periodMonths:number
 adjustmentQuantity?:number;adjustmentUnitPrice?:number
 adjustmentFixedPercent?:number;adjustmentVariablePercent?:number
}
export function calculateHelpNominalCapacityCost(x:PeriodCostInput){
 const aq=x.adjustmentQuantity??0,ap=x.adjustmentUnitPrice??0
 const af=x.adjustmentFixedPercent??0,av=x.adjustmentVariablePercent??0
 if(![x.standardQuantity,x.standardUnitPrice,x.nominalCapacity,x.activityVolume,x.periodMonths,aq,ap].every(nonNegative)||x.nominalCapacity<=0||x.periodMonths<=0||x.periodMonths>12)throw new Error('invalid-nominal-cost-input')
 if(!nonNegative(x.fixedPercent)||!nonNegative(x.variablePercent)||Math.abs(x.fixedPercent+x.variablePercent-100)>1e-8)throw new Error('invalid-fixed-variable-share')
 if(aq*ap>0&&(!nonNegative(af)||!nonNegative(av)||Math.abs(af+av-100)>1e-8))throw new Error('invalid-adjustment-share')
 const standard=x.standardQuantity*x.standardUnitPrice
 const adjustment=aq*ap
 const activityRatio=x.activityVolume/x.nominalCapacity
 const standardFixed=standard*x.fixedPercent/100*x.periodMonths/12
 const standardVariable=standard*x.variablePercent/100*activityRatio
 const adjustmentFixed=adjustment*af/100
 const adjustmentVariable=adjustment*av/100
 return {standardCost:standard,adjustmentCost:adjustment,standardFixed,standardVariable,adjustmentFixed,adjustmentVariable,total:standardFixed+standardVariable+adjustmentFixed+adjustmentVariable}
}
export function calculateHelpPerUnitOutputCost(x:{inputQuantityPerUnit:number;unitPrice:number;outputVolume:number;standardFixedCost:number;adjustmentTotal?:number;adjustmentVariablePercent?:number;periodMonths:number}){
 const adjustment=x.adjustmentTotal??0,variableShare=x.adjustmentVariablePercent??0
 if(![x.inputQuantityPerUnit,x.unitPrice,x.outputVolume,x.standardFixedCost,adjustment,variableShare,x.periodMonths].every(nonNegative)||x.periodMonths<=0||x.periodMonths>12||variableShare>100)throw new Error('invalid-per-unit-cost-input')
 const fixed=x.standardFixedCost*x.periodMonths/12+adjustment*(1-variableShare/100)
 const variable=x.inputQuantityPerUnit*x.unitPrice*x.outputVolume+adjustment*variableShare/100
 return {fixed,variable,total:fixed+variable}
}
export function calculateHelpWorkingCapitalTurnover(daysCoverage:number,periodMonths:number){
 if(!nonNegative(daysCoverage)||daysCoverage===0||!nonNegative(periodMonths)||periodMonths===0||periodMonths>12)throw new Error('invalid-working-capital-days')
 return periodMonths*30/daysCoverage
}
export function calculateHelpWorkingCapitalRequirement(basis:number,daysCoverage:number,periodMonths:number){
 if(!nonNegative(basis))throw new Error('invalid-working-capital-basis')
 const turnover=calculateHelpWorkingCapitalTurnover(daysCoverage,periodMonths)
 return {turnover,requiredValue:basis/turnover}
}
export function calculateHelpNwc(currentAssets:number,currentLiabilities:number){
 if(!nonNegative(currentAssets)||!nonNegative(currentLiabilities))throw new Error('invalid-current-balance')
 return currentAssets-currentLiabilities
}
export function calculateHelpNwcMovement(previous:number,current:number){
 if(!finite(previous)||!finite(current))throw new Error('invalid-nwc-movement')
 const change=current-previous
 return {change,cashOutflow:Math.max(0,change),cashInflow:Math.max(0,-change)}
}
export function calculateDefaultSalesProduction(input:{sales:number;openingFinishedGoods:number;daysCoverage:number;periodMonths:number}){
 const {sales,openingFinishedGoods,daysCoverage,periodMonths}=input
 if(![sales,openingFinishedGoods].every(nonNegative))throw new Error('invalid-sales-production-input')
 const turnover=calculateHelpWorkingCapitalTurnover(daysCoverage,periodMonths)
 const requiredStock=sales/turnover
 if(sales<openingFinishedGoods){
  const production=0
  return {production,closingFinishedGoods:openingFinishedGoods-sales,requiredStock,turnover}
 }
 const production=sales+requiredStock-openingFinishedGoods
 return {production,closingFinishedGoods:requiredStock,requiredStock,turnover}
}
export function calculateGraduatedIncomeTax(taxableIncome:number,brackets:{lowerLimit:number;ratePercent:number}[]){
 if(!finite(taxableIncome))throw new Error('invalid-taxable-income')
 if(taxableIncome<=0)return 0
 const sorted=[...brackets].sort((a,b)=>a.lowerLimit-b.lowerLimit)
 if(!sorted.length)return 0
 let tax=0
 for(let i=0;i<sorted.length;i++){
  const current=sorted[i],next=sorted[i+1]
  if(!nonNegative(current.lowerLimit)||!nonNegative(current.ratePercent)||current.ratePercent>100)throw new Error('invalid-tax-bracket')
  const upper=next?next.lowerLimit:Infinity
  const taxable=Math.max(0,Math.min(taxableIncome,upper)-current.lowerLimit)
  tax+=taxable*current.ratePercent/100
 }
 return tax
}
export type LossCarryForwardLot={originPeriod:number;amount:number}
export function applyLossCarryForward(profits:number[],carryForwardYears:number){
 if(!Number.isInteger(carryForwardYears)||carryForwardYears<0)throw new Error('invalid-loss-carry-forward-years')
 const lots:LossCarryForwardLot[]=[]
 const rows=profits.map((profit,index)=>{
  if(!finite(profit))throw new Error('invalid-tax-profit')
  for(let i=lots.length-1;i>=0;i--)if(index-lots[i].originPeriod>carryForwardYears)lots.splice(i,1)
  if(profit<0){lots.push({originPeriod:index,amount:-profit});return {period:index,taxableBeforeLoss:profit,taxableAfterLoss:0,lossUsed:0,lossCarriedForward:lots.reduce((s,x)=>s+x.amount,0)}}
  let remaining=profit,used=0
  for(const lot of lots){const applied=Math.min(remaining,lot.amount);lot.amount-=applied;remaining-=applied;used+=applied;if(remaining<=1e-10)break}
  for(let i=lots.length-1;i>=0;i--)if(lots[i].amount<=1e-10)lots.splice(i,1)
  return {period:index,taxableBeforeLoss:profit,taxableAfterLoss:remaining,lossUsed:used,lossCarriedForward:lots.reduce((s,x)=>s+x.amount,0)}
 })
 return rows
}
export function calculateComfarLoanInterest(input:{openingDebt:number;events:{date:string;type:'drawdown'|'repayment';amount:number}[];rateChanges:{effectiveDate:string;annualRatePercent:number}[];startDate:string;endDate:string}){
 const {openingDebt,events,rateChanges,startDate,endDate}=input
 if(!nonNegative(openingDebt))throw new Error('invalid-opening-debt')
 const parse=(d:string)=>{const v=Date.parse(d+'T00:00:00Z');if(!Number.isFinite(v))throw new Error('invalid-loan-date');return v}
 const days360=(a:number,b:number)=>{const x=new Date(a),y=new Date(b);const xDay=Math.min(x.getUTCDate(),30),yDay=Math.min(y.getUTCDate(),30);return (y.getUTCFullYear()-x.getUTCFullYear())*360+(y.getUTCMonth()-x.getUTCMonth())*30+(yDay-xDay)}
 const start=parse(startDate),end=parse(endDate)
 if(end<=start)throw new Error('invalid-loan-interval')
 const boundaries=new Set<number>([start,end])
 for(const e of events){const d=parse(e.date);if(d>start&&d<end)boundaries.add(d)}
 for(const r of rateChanges){const d=parse(r.effectiveDate);if(d>start&&d<end)boundaries.add(d)}
 const dates=[...boundaries].sort((a,b)=>a-b)
 const getRate=(date:number)=>rateChanges.filter(r=>parse(r.effectiveDate)<=date).sort((a,b)=>parse(b.effectiveDate)-parse(a.effectiveDate))[0]?.annualRatePercent??rateChanges[0]?.annualRatePercent??0
 let balance=openingDebt,totalInterest=0
 const segments=[]
 for(let i=0;i<dates.length-1;i++){
  const a=dates[i],b=dates[i+1]
  const event=events.filter(e=>parse(e.date)===a).reduce((sum,e)=>sum+(e.type==='drawdown'?e.amount:-e.amount),0)
  balance+=event
  if(balance< -1e-8)throw new Error('negative-loan-balance')
  const days=days360(a,b)
  const rate=getRate(a)
  if(!nonNegative(rate))throw new Error('invalid-interest-rate')
  const interest=balance*(rate/100)*(days/360)
  totalInterest+=interest
  segments.push({startDate:new Date(a).toISOString().slice(0,10),endDate:new Date(b).toISOString().slice(0,10),openingBalance:balance,annualRatePercent:rate,days360:days,interest})
 }
 const endEvents=events.filter(e=>parse(e.date)===end).reduce((sum,e)=>sum+(e.type==='drawdown'?e.amount:-e.amount),0)
 balance+=endEvents
 if(balance< -1e-8)throw new Error('negative-loan-balance')
 return {totalInterest,closingBalance:balance,segments}
}
export function calculateLoanFee(input:{type:'agency'|'guarantee'|'commitment'|'other';ratePercent:number;disbursement:number;outstandingBefore:number;repayment:number;undisbursedCommitment:number;totalLoan:number;periodMonths?:number}){
 const {type,ratePercent,disbursement,outstandingBefore,repayment,undisbursedCommitment,totalLoan}=input
 const periodMonths=input.periodMonths??12
 if(!Number.isInteger(periodMonths)||periodMonths<0||periodMonths>12)throw new Error('invalid-fee-period')
 if(!nonNegative(ratePercent)||![disbursement,outstandingBefore,repayment,undisbursedCommitment,totalLoan].every(nonNegative))throw new Error('invalid-loan-fee-input')
 const basis=type==='agency'?disbursement:type==='guarantee'?Math.max(0,outstandingBefore+disbursement-repayment):type==='commitment'?undisbursedCommitment:totalLoan
 return {basis,fee:basis*ratePercent/100*(type==='guarantee'||type==='commitment'?periodMonths/12:1),paymentTiming:type==='agency'?'at-each-disbursement':type==='other'?'at-first-disbursement':'with-interest'}
}
export function calculateHelpNpv(cashFlows:number[],discountRatePercent:number,periodsPerYear:number,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period',salvageValue=0){
 if(!cashFlows.every(finite)||!nonNegative(discountRatePercent)||!Number.isInteger(periodsPerYear)||periodsPerYear<=0||!finite(salvageValue))throw new Error('invalid-npv-input')
 const rate=discountRatePercent/100/periodsPerYear
 const shift=referencePoint==='end-of-first-period'?1:0
 const discounted=cashFlows.reduce((sum,flow,index)=>sum+flow/Math.pow(1+rate,Math.max(0,index+1-shift)),0)
 const salvageDiscount=salvageValue/Math.pow(1+rate,Math.max(0,cashFlows.length-shift))
 return {npv:discounted+salvageDiscount,discountedCashFlows:cashFlows.map((flow,index)=>flow/Math.pow(1+rate,Math.max(0,index+1-shift))),discountedSalvageValue:salvageDiscount}
}
export function calculateHelpMirr(cashFlows:number[],reinvestmentRatePercent:number,borrowingRatePercent:number,planningHorizonYears:number,periodsPerYear:number){
 if(!cashFlows.every(finite)||!nonNegative(reinvestmentRatePercent)||!nonNegative(borrowingRatePercent)||!nonNegative(planningHorizonYears)||planningHorizonYears===0||!Number.isInteger(periodsPerYear)||periodsPerYear<=0)throw new Error('invalid-mirr-input')
 const reinvest=reinvestmentRatePercent/100,borrow=borrowingRatePercent/100
 const horizon=planningHorizonYears
 const positiveFuture=cashFlows.reduce((sum,flow,index)=>flow>0?sum+flow*Math.pow(1+reinvest,horizon+1-(index+1)/periodsPerYear):sum,0)
 const negativePresent=cashFlows.reduce((sum,flow,index)=>flow<0?sum+(-flow)/Math.pow(1+borrow,(index+1)/periodsPerYear):sum,0)
 if(negativePresent===0)return null
 return Math.pow(positiveFuture/negativePresent,1/horizon)-1
}
export function calculateDividendPool(netProfit:number,retainedPercent:number,preferredDividends:number[],jointVentureCount:number){
 if(!finite(netProfit)||!nonNegative(retainedPercent)||retainedPercent>100||!preferredDividends.every(nonNegative)||!Number.isInteger(jointVentureCount)||jointVentureCount<0||jointVentureCount>preferredDividends.length)throw new Error('invalid-dividend-input')
 const retained=netProfit>0?netProfit*retainedPercent/100:netProfit
 const distributable=netProfit>0?netProfit-retained:0
 const totalPreferred=preferredDividends.reduce((s,x)=>s+x,0)
 const paidPreferred=Math.min(distributable,totalPreferred)
 let remaining=distributable-paidPreferred
 const partnerPreferred=preferredDividends.slice(0,jointVentureCount).reduce((s,x)=>s+x,0)
 const shareholderPreferred=totalPreferred-partnerPreferred
 const partnerPaid=Math.min(paidPreferred,partnerPreferred)
 const shareholderPaid=Math.max(0,paidPreferred-partnerPaid)
 const ordinary=remaining
 return {retained,distributable,preferredRequested:totalPreferred,preferredPaid:paidPreferred,partnerPreferredPaid:partnerPaid,shareholderPreferredPaid:shareholderPaid,ordinaryDividendPool:ordinary,undistributedShortfall:totalPreferred-paidPreferred}
}
export function composeTotalInvestmentCashFlow(input:{netCashFlow:number;equity:number;loanDrawdowns:number;principalRepayments:number;interestAndFees:number;dividends:number;}){
 const {netCashFlow,equity,loanDrawdowns,principalRepayments,interestAndFees,dividends}=input
 if(![netCashFlow,equity,loanDrawdowns,principalRepayments,interestAndFees,dividends].every(finite))throw new Error('invalid-total-investment-flow')
 return netCashFlow-equity-loanDrawdowns+principalRepayments+interestAndFees+dividends
}

/** Asset sale proceeds up to book value are return of capital; the excess/shortfall is other income/loss. */
export function calculateAssetDisposal(bookValue:number,saleProceeds:number){
 if(!nonNegative(bookValue)||!nonNegative(saleProceeds))throw new Error('invalid-asset-disposal')
 return {returnOfCapital:Math.min(bookValue,saleProceeds),otherIncomeOrLoss:saleProceeds-bookValue}
}
/** Exchange-rate adjustment in the debt schedule: DBj - (DBj-1 + CIj + Dj - Rj). */
export function calculateForeignCurrencyDebtAdjustment(input:{closingDebt:number;openingDebt:number;capitalizedInterest:number;disbursements:number;principalRepayments:number}){
 const values=Object.values(input)
 if(!values.every(nonNegative))throw new Error('invalid-fx-debt-adjustment')
 return input.closingDebt-(input.openingDebt+input.capitalizedInterest+input.disbursements-input.principalRepayments)
}
/** Automatic local equity covers each construction-period cash deficit, including interest payable. */
export function coverConstructionCashDeficit(periodCashBeforeCoverage:number[]){
 if(!periodCashBeforeCoverage.every(finite))throw new Error('invalid-construction-cash')
 let cumulative=0
 return periodCashBeforeCoverage.map((netCash,period)=>{
  const opening=cumulative
  const before=opening+netCash
  const automaticEquity=Math.max(0,-before)
  cumulative=before+automaticEquity
  return {period,openingCash:opening,netCashBeforeCoverage:netCash,automaticEquity,closingCash:cumulative}
 })
}
/** Production-period overdraft is interest-free and is repaid as soon as cash surpluses occur. */
export function coverOperatingCashDeficits(periodCashBeforeCoverage:number[]){
 if(!periodCashBeforeCoverage.every(finite))throw new Error('invalid-operating-cash')
 let cash=0,overdraft=0
 return periodCashBeforeCoverage.map((netCash,period)=>{
  const openingCash=cash,openingOverdraft=overdraft
  cash+=netCash
  const drawdown=Math.max(0,-cash)
  overdraft+=drawdown
  cash+=drawdown
  const repayment=Math.min(cash,overdraft)
  cash-=repayment
  overdraft-=repayment
  return {period,openingCash,openingOverdraft,netCashBeforeCoverage:netCash,automaticOverdraftDrawdown:drawdown,automaticOverdraftRepayment:repayment,closingCash:cash,closingOverdraft:overdraft,interest:0}
 })
}
/** Short-term deposit interest on the specified portion of cash-in-hand. */
export function calculateShortTermDepositInterest(cashInHand:number,portionPercent:number,annualRatePercent:number,periodMonths:number){
 if(!nonNegative(cashInHand)||!nonNegative(portionPercent)||portionPercent>100||!nonNegative(annualRatePercent)||!nonNegative(periodMonths)||periodMonths>12)throw new Error('invalid-short-term-deposit')
 return cashInHand*portionPercent/100*annualRatePercent/100*periodMonths/12
}

export function calculateInterestCapitalization(totalInterest:number,capitalizedPercent:number,capitalizationStillActive:boolean){
 if(!nonNegative(totalInterest)||!nonNegative(capitalizedPercent)||capitalizedPercent>100)throw new Error('invalid-interest-capitalization')
 const capitalized=capitalizationStillActive?totalInterest*capitalizedPercent/100:0
 return {capitalized,paid:totalInterest-capitalized}
}
export function calculateLoanDisbursementPhaseEnd(type:'annuity'|'constant-principal'|'profile',firstRepaymentDate:string,interval:'yearly'|'half-yearly'|'quarterly'|'monthly'){
 if(type==='profile')return null
 const timestamp=Date.parse(firstRepaymentDate+'T00:00:00Z')
 if(!Number.isFinite(timestamp))throw new Error('invalid-first-repayment-date')
 const date=new Date(timestamp)
 const isMonthEnd=date.getUTCDate()===new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate()
 if(!isMonthEnd)throw new Error('first-repayment-must-be-month-end')
 if(type==='constant-principal')return new Date(timestamp-86400000).toISOString().slice(0,10)
 const months=interval==='yearly'?12:interval==='half-yearly'?6:interval==='quarterly'?3:1
 const targetMonth=date.getUTCFullYear()*12+date.getUTCMonth()-months
 const year=Math.floor(targetMonth/12),month=((targetMonth%12)+12)%12
 return new Date(Date.UTC(year,month+1,0)).toISOString().slice(0,10)
}
export function buildConstantPrincipalLoanSchedule(principal:number,annualRatePercent:number,periodsPerYear:number,numberOfPayments:number){
 if(!nonNegative(principal)||!nonNegative(annualRatePercent)||!Number.isInteger(periodsPerYear)||periodsPerYear<=0||!Number.isInteger(numberOfPayments)||numberOfPayments<=0)throw new Error('invalid-constant-principal-input')
 const principalPayment=principal/numberOfPayments
 let balance=principal
 return Array.from({length:numberOfPayments},(_,index)=>{
  const openingBalance=balance
  const principalPaid=index===numberOfPayments-1?balance:Math.min(balance,principalPayment)
  const interest=openingBalance*annualRatePercent/100/periodsPerYear
  balance=Math.max(0,openingBalance-principalPaid)
  return {period:index+1,openingBalance,principal:principalPaid,interest,payment:principalPaid+interest,closingBalance:balance}
 })
}

export type CostAllocationProduct={id:string;directCost:number;directFactoryCost:number;directMaterialCost:number;directLabourCost:number;salesRevenue:number}
export function allocateIndirectCost(totalIndirectCost:number,products:CostAllocationProduct[],key:'direct-cost'|'direct-factory-cost'|'direct-material-cost'|'direct-labour-cost'|'sales-revenue'|'equal-products'|'user-defined',userPercentages?:Record<string,number>){
 if(!nonNegative(totalIndirectCost)||products.length===0)throw new Error('invalid-cost-allocation-input')
 if(products.some(p=>![p.directCost,p.directFactoryCost,p.directMaterialCost,p.directLabourCost,p.salesRevenue].every(nonNegative)))throw new Error('invalid-cost-allocation-basis')
 if(key==='equal-products')return products.map(p=>({productId:p.id,allocatedCost:totalIndirectCost/products.length}))
 if(key==='user-defined'){
  const shares=products.map(p=>userPercentages?.[p.id])
  if(shares.some(x=>x===undefined||!nonNegative(x!))||Math.abs(shares.reduce<number>((sum,x)=>sum+(x??0),0)-100)>1e-8)throw new Error('invalid-user-allocation-percentages')
  return products.map((p,i)=>({productId:p.id,allocatedCost:totalIndirectCost*(shares[i]??0)/100}))
 }
 const field=key==='direct-cost'?'directCost':key==='direct-factory-cost'?'directFactoryCost':key==='direct-material-cost'?'directMaterialCost':key==='direct-labour-cost'?'directLabourCost':'salesRevenue'
 const denominator=products.reduce((sum,p)=>sum+p[field],0)
 if(denominator<=0)throw new Error('zero-cost-allocation-denominator')
 return products.map(p=>({productId:p.id,allocatedCost:totalIndirectCost*p[field]/denominator}))
}
export function calculateTaxableProfitAfterAllowances(grossProfit:number,investmentAllowance:number,depreciationAllowance:number){
 if(!finite(grossProfit)||!nonNegative(investmentAllowance)||!nonNegative(depreciationAllowance))throw new Error('invalid-tax-allowance-input')
 return {taxableProfit:grossProfit-investmentAllowance-depreciationAllowance,investmentAllowance,depreciationAllowance,bookValueAdjustment:-depreciationAllowance}
}
export function calculateIncomeTaxAfterHoliday(taxableProfit:number,brackets:{lowerLimit:number;ratePercent:number}[],productionYear:number,taxHolidayYears:number){
 if(!finite(taxableProfit)||!Number.isInteger(productionYear)||productionYear<1||!Number.isInteger(taxHolidayYears)||taxHolidayYears<0)throw new Error('invalid-tax-holiday-input')
 const exempt=productionYear<=taxHolidayYears
 return {taxHolidayActive:exempt,taxBeforeAdjustments:exempt?0:calculateGraduatedIncomeTax(taxableProfit,brackets)}
}
export function calculatePreferredDividend(accumulatedPaidInEquity:number,preferredRatePercent:number,absolutePreferredDividend:number){
 if(!nonNegative(accumulatedPaidInEquity)||!nonNegative(preferredRatePercent)||preferredRatePercent>100||!nonNegative(absolutePreferredDividend))throw new Error('invalid-preferred-dividend-input')
 return accumulatedPaidInEquity*preferredRatePercent/100+absolutePreferredDividend
}
export function calculateDividendRepatriation(dividend:number,repatriationPercent:number){
 if(!nonNegative(dividend)||!nonNegative(repatriationPercent)||repatriationPercent>100)throw new Error('invalid-dividend-repatriation')
 const exported=dividend*repatriationPercent/100
 return {exported,local:dividend-exported}
}
