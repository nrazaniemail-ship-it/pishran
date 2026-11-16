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
 const annualFactor=1+discountRatePercent/100
 const referenceShift=referencePoint==='end-of-first-period'?1/periodsPerYear:0
 const exponents=cashFlows.map((_,index)=>Math.max(0,(index+1)/periodsPerYear-referenceShift))
 const discountedCashFlows=cashFlows.map((flow,index)=>flow/Math.pow(annualFactor,exponents[index]))
 const salvageExponent=Math.max(0,cashFlows.length/periodsPerYear-referenceShift)
 const discountedSalvageValue=salvageValue/Math.pow(annualFactor,salvageExponent)
 return {npv:discountedCashFlows.reduce((sum,flow)=>sum+flow,0)+discountedSalvageValue,discountedCashFlows,discountedSalvageValue}
}
export function calculateHelpMirr(cashFlows:number[],reinvestmentRatePercent:number,borrowingRatePercent:number,planningHorizonYears:number,periodsPerYear:number,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period'){
 if(!cashFlows.every(finite)||!nonNegative(reinvestmentRatePercent)||!nonNegative(borrowingRatePercent)||!nonNegative(planningHorizonYears)||planningHorizonYears===0||!Number.isInteger(periodsPerYear)||periodsPerYear<=0)throw new Error('invalid-mirr-input')
 const reinvest=1+reinvestmentRatePercent/100,borrow=1+borrowingRatePercent/100
 const horizon=planningHorizonYears,referenceShift=referencePoint==='end-of-first-period'?1/periodsPerYear:0
 const positiveFuture=cashFlows.reduce((sum,flow,index)=>flow>0?sum+flow*Math.pow(reinvest,Math.max(0,horizon+1-(index+1)/periodsPerYear)):sum,0)
 const negativePresent=cashFlows.reduce((sum,flow,index)=>flow<0?sum+(-flow)/Math.pow(borrow,Math.max(0,(index+1)/periodsPerYear-referenceShift)):sum,0)
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


/** Financial prices are converted to local currency at the official exchange rate. */
export function calculateEconomicFinancialValue(price:number,marketOrigin:'local'|'foreign',officialExchangeRate:number){
 if(!nonNegative(price)||!nonNegative(officialExchangeRate)||(marketOrigin==='foreign'&&officialExchangeRate===0))throw new Error('invalid-economic-financial-value')
 return marketOrigin==='foreign'?price*officialExchangeRate:price
}
export function calculateAdjustedMarketValue(financialValue:number,adjustmentFactor:number){
 if(!finite(financialValue)||!nonNegative(adjustmentFactor))throw new Error('invalid-adjusted-market-value')
 return financialValue*adjustmentFactor
}
export function deriveEconomicAdjustmentFactor(financialValue:number,adjustedMarketValue:number){
 if(!finite(financialValue)||financialValue===0||!finite(adjustedMarketValue))throw new Error('invalid-economic-adjustment-factor')
 return adjustedMarketValue/financialValue
}
export type EconomicCompositeItem={financialValue:number;adjustedMarketValue:number;foreignCurrencyExposurePercent:number}
export function calculateEconomicComposite(items:EconomicCompositeItem[]){
 if(items.length===0||items.some(x=>![x.financialValue,x.adjustedMarketValue,x.foreignCurrencyExposurePercent].every(finite)||x.foreignCurrencyExposurePercent<0||x.foreignCurrencyExposurePercent>100))throw new Error('invalid-economic-composite')
 const financialValue=items.reduce((s,x)=>s+x.financialValue,0)
 const adjustedMarketValue=items.reduce((s,x)=>s+x.adjustedMarketValue,0)
 const foreignWeighted=items.reduce((s,x)=>s+x.adjustedMarketValue*x.foreignCurrencyExposurePercent/100,0)
 return {financialValue,adjustedMarketValue,adjustmentFactor:financialValue===0?null:adjustedMarketValue/financialValue,foreignCurrencyExposurePercent:adjustedMarketValue===0?0:foreignWeighted/adjustedMarketValue*100}
}
export function calculateNetForeignExchangeEffect(input:{price:number;officialExchangeRate:number;quantity:number;tradablePercent:number;marketOrigin:'local'|'foreign';direction:'inflow'|'outflow'}){
 if(![input.price,input.officialExchangeRate,input.quantity,input.tradablePercent].every(nonNegative)||input.tradablePercent>100)throw new Error('invalid-net-foreign-exchange-input')
 if(input.marketOrigin==='local')return 0
 const value=input.price*input.officialExchangeRate*input.quantity*input.tradablePercent/100
 return input.direction==='inflow'?value:-value
}
export function calculateValueAdded(input:{grossSalesRevenue:number;salesTaxes:number;subsidiesOnSales:number;otherIncome:number;materialInputs:number;fixedInvestment:number;preproductionExInterest:number;inventoryIncrease:number;repatriatedPayments:number}){
 const values=Object.values(input)
 if(!values.every(finite)||input.materialInputs<0||input.fixedInvestment<0||input.preproductionExInterest<0)throw new Error('invalid-value-added-input')
 const output=input.grossSalesRevenue+input.salesTaxes
 const grossDomesticValueAdded=output+input.otherIncome-input.materialInputs
 const investment=input.fixedInvestment+input.preproductionExInterest+input.inventoryIncrease
 const netDomesticValueAdded=grossDomesticValueAdded-investment
 const netNationalValueAdded=netDomesticValueAdded-input.repatriatedPayments
 return {output,grossDomesticValueAdded,investment,netDomesticValueAdded,netNationalValueAdded}
}
export function calculateEconomicPresentValue(periodAmounts:number[],annualDiscountRatePercent:number,firstYearIndex=0){
 if(!periodAmounts.every(finite)||!nonNegative(annualDiscountRatePercent)||!Number.isInteger(firstYearIndex)||firstYearIndex<0)throw new Error('invalid-economic-present-value')
 const rate=annualDiscountRatePercent/100
 return periodAmounts.reduce((sum,amount,index)=>sum+amount/Math.pow(1+rate,index+firstYearIndex),0)
}
export function calculateEconomicAppraisalLevels(input:{financialValue:number[];adjustedMarketValue:number[];foreignExchangeAdjustment:number[];indirectEffects:number[];discountRatePercent:number}){
 const lengths=[input.financialValue.length,input.adjustedMarketValue.length,input.foreignExchangeAdjustment.length,input.indirectEffects.length]
 if(new Set(lengths).size!==1||![...input.financialValue,...input.adjustedMarketValue,...input.foreignExchangeAdjustment,...input.indirectEffects].every(finite)||!nonNegative(input.discountRatePercent))throw new Error('invalid-economic-appraisal')
 const economicValue1=input.adjustedMarketValue.map((value,i)=>value+input.foreignExchangeAdjustment[i])
 const economicValue2=economicValue1.map((value,i)=>value+input.indirectEffects[i])
 return {financialPresentValue:calculateEconomicPresentValue(input.financialValue,input.discountRatePercent,1),adjustedMarketPresentValue:calculateEconomicPresentValue(input.adjustedMarketValue,input.discountRatePercent,1),economicValue1:calculateEconomicPresentValue(economicValue1,input.discountRatePercent,1),economicValue2:calculateEconomicPresentValue(economicValue2,input.discountRatePercent,1)}
}
export function calculateEmploymentIndicators(input:{unskilledJobs:number;skilledJobs:number;investment:number;unskilledWages:number;skilledWages:number;totalWages:number}){
 if(!Object.values(input).every(nonNegative)||input.investment===0||input.unskilledWages===0||input.skilledWages===0||input.totalWages===0)throw new Error('invalid-employment-indicators')
 return {unskilledJobsPerInvestment:input.unskilledJobs/input.investment,skilledJobsPerInvestment:input.skilledJobs/input.investment,totalJobsPerInvestment:(input.unskilledJobs+input.skilledJobs)/input.investment,investmentToUnskilledWages:input.investment/input.unskilledWages,investmentToSkilledWages:input.investment/input.skilledWages,investmentToTotalWages:input.investment/input.totalWages}
}

/** Apply global sensitivity percentages without mutating the source assumptions. */
export function applyGlobalSensitivityVariation<T extends {quantity:number;price:number}>(items:T[],variations:Record<string,{quantityPercent?:number;pricePercent?:number}>):T[]{
 return items.map((item,index)=>{
  const variation=variations[String(index)]??{}
  const q=variation.quantityPercent??0,p=variation.pricePercent??0
  if(!finite(q)||!finite(p)||q< -100||p< -100)throw new Error('invalid-global-sensitivity-variation')
  return {...item,quantity:item.quantity*(1+q/100),price:item.price*(1+p/100)}
 })
}
export function calculateParametricSeries<T>(baseValue:number,variationPercent:number,steps:number,evaluate:(value:number)=>T){
 if(!finite(baseValue)||!finite(variationPercent)||variationPercent<0||variationPercent>100||!Number.isInteger(steps)||steps<1)throw new Error('invalid-parametric-analysis')
 return Array.from({length:steps*2+1},(_,i)=>{
  const variation=(i-steps)*variationPercent/steps
  const value=baseValue*(1+variation/100)
  return {variationPercent:variation,inputValue:value,result:evaluate(value)}
 })
}
/** Target search applies one-percent changes to each selected variable in sequence. */
export function searchSensitivityTarget<T>(input:{variables:{id:string;baseValue:number;maxIncreasePercent:number;maxDecreasePercent:number}[];target:number;direction:'increase'|'decrease';evaluate:(values:Record<string,number>)=>number;maxIterations?:number}){
 const values:Record<string,number>=Object.fromEntries(input.variables.map(v=>[v.id,v.baseValue]))
 if(input.variables.some(v=>!finite(v.baseValue)||!nonNegative(v.maxIncreasePercent)||!nonNegative(v.maxDecreasePercent))||!finite(input.target))throw new Error('invalid-sensitivity-target')
 const original={...values},history:{iteration:number;variableId:string;changePercent:number;metric:number}[]=[]
 const limit=input.maxIterations??10000
 let iteration=0,metric=input.evaluate(values)
 const achieved=()=>input.direction==='increase'?metric>=input.target:metric<=input.target
 if(achieved())return {achieved:true,values:{...original},achievedValues:{...original},original,metric,history,iterations:0}
 for(const variable of input.variables){
  const max=input.direction==='increase'?variable.maxIncreasePercent:variable.maxDecreasePercent
  const sign=input.direction==='increase'?1:-1
  for(let pct=1;pct<=max+1e-9;pct+=1){
   if(iteration>=limit)return {achieved:false,values:{...values},original,metric,history,iterations:iteration,limitReached:true}
   values[variable.id]=variable.baseValue*(1+sign*pct/100)
   metric=input.evaluate(values);iteration++
   history.push({iteration,variableId:variable.id,changePercent:sign*pct,metric})
   if(achieved())return {achieved:true,values:{...original},achievedValues:{...values},original,metric,history,iterations:iteration}
  }
 }
 return {achieved:false,values:{...original},original,metric:input.evaluate(original),history,iterations:iteration,limitReached:false}
}
/** Incremental analysis requires identical period counts and returns alternative minus base. */
export function calculateIncrementalSeries(base:number[],alternative:number[]){
 if(base.length!==alternative.length||!base.every(finite)||!alternative.every(finite))throw new Error('incremental-analysis-horizon-mismatch')
 return alternative.map((value,index)=>value-base[index])
}


/** Relative inflation is local-currency inflation divided by input-currency inflation. */
export function calculateRelativeInflationFactor(localInflationPercent:number[],inputInflationPercent:number[],periodIndex:number){
 if(!Number.isInteger(periodIndex)||periodIndex<0||periodIndex>localInflationPercent.length||periodIndex>inputInflationPercent.length||!localInflationPercent.every(finite)||!inputInflationPercent.every(finite)||[...localInflationPercent,...inputInflationPercent].some(x=>x<=-100))throw new Error('invalid-relative-inflation-input')
 let factor=1
 for(let year=0;year<periodIndex;year++)factor*=(1+localInflationPercent[year]/100)/(1+inputInflationPercent[year]/100)
 return factor
}
export function calculateCurrentExchangeRate(baseLocalPerInput:number,localInflationPercent:number[],inputInflationPercent:number[],periodIndex:number){
 if(!nonNegative(baseLocalPerInput)||baseLocalPerInput===0)throw new Error('invalid-base-exchange-rate')
 return baseLocalPerInput*calculateRelativeInflationFactor(localInflationPercent,inputInflationPercent,periodIndex)
}
/** COMFAR's first-year escalator is separate from subsequent annual inflation + escalation. */
export function calculateInflatedEscalatedPrice(input:{enteredPrice:number;inflationRatesPercent:number[];periodIndex:number;escalationPercent:number;firstYearEscalator:number}){
 const {enteredPrice,inflationRatesPercent,periodIndex,escalationPercent,firstYearEscalator}=input
 if(!nonNegative(enteredPrice)||!finite(escalationPercent)||escalationPercent<=-100||!Number.isInteger(periodIndex)||periodIndex<0||periodIndex>=inflationRatesPercent.length||!finite(firstYearEscalator)||firstYearEscalator<0||inflationRatesPercent.some(x=>!finite(x)||x<=-100))throw new Error('invalid-inflation-escalation-input')
 const escalation=escalationPercent/100
 let factor=1+inflationRatesPercent[0]/100+(firstYearEscalator===0?0:Math.pow(1+escalation,firstYearEscalator)-1)
 for(let year=1;year<=periodIndex;year++)factor*=1+inflationRatesPercent[year]/100+escalation
 return enteredPrice*factor
}
export function calculateFixedAssetRevaluation(initialLocalValue:number,acquisitionYearIndex:number,currentYearIndex:number,localInflationPercent:number[]){
 if(!nonNegative(initialLocalValue)||!Number.isInteger(acquisitionYearIndex)||!Number.isInteger(currentYearIndex)||acquisitionYearIndex<0||currentYearIndex<acquisitionYearIndex||currentYearIndex>localInflationPercent.length||!localInflationPercent.every(x=>finite(x)&&x>-100))throw new Error('invalid-fixed-asset-revaluation')
 const indexAt=(year:number)=>localInflationPercent.slice(0,year).reduce((factor,rate)=>factor*(1+rate/100),1)
 return initialLocalValue*indexAt(currentYearIndex)/indexAt(acquisitionYearIndex)
}


function parseIsoDate(value:string){
 const time=Date.parse(value+'T00:00:00Z')
 if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==value)throw new Error('invalid-financial-date')
 return time
}
function daysBetween30_360(from:string,to:string){
 const a=new Date(parseIsoDate(from)),b=new Date(parseIsoDate(to))
 const dayA=Math.min(a.getUTCDate(),30),dayB=Math.min(b.getUTCDate(),30)
 return (b.getUTCFullYear()-a.getUTCFullYear())*360+(b.getUTCMonth()-a.getUTCMonth())*30+dayB-dayA
}
export function calculateDiscountFactor30_360(annualRatePercent:number,referenceDate:string,transactionDate:string){
 if(!finite(annualRatePercent)||annualRatePercent<=-100)throw new Error('invalid-dated-discount-rate')
 const months=daysBetween30_360(referenceDate,transactionDate)/30
 return Math.pow(1+annualRatePercent/100,months/12)
}
export function calculateDatedNpv(input:{cashFlows:{date:string;amount:number}[];discountRatePercent:number;referenceDate:string;salvageValue?:number;salvageDate?:string}){
 if(!input.cashFlows.every(x=>finite(x.amount))||!finite(input.discountRatePercent)||input.discountRatePercent<=-100)throw new Error('invalid-dated-npv')
 const discountedCashFlows=input.cashFlows.map(flow=>({date:flow.date,amount:flow.amount,discountFactor:calculateDiscountFactor30_360(input.discountRatePercent,input.referenceDate,flow.date),presentValue:flow.amount/calculateDiscountFactor30_360(input.discountRatePercent,input.referenceDate,flow.date)}))
 let discountedSalvageValue=0
 if(input.salvageValue!==undefined){
  if(!finite(input.salvageValue)||!input.salvageDate)throw new Error('invalid-dated-salvage')
  discountedSalvageValue=input.salvageValue/calculateDiscountFactor30_360(input.discountRatePercent,input.referenceDate,input.salvageDate)
 }
 return {npv:discountedCashFlows.reduce((sum,x)=>sum+x.presentValue,0)+discountedSalvageValue,discountedCashFlows,discountedSalvageValue}
}
export function calculateDatedMirr(input:{cashFlows:{date:string;amount:number}[];reinvestmentRatePercent:number;borrowingRatePercent:number;referenceDate:string;recoveryDate:string;planningHorizonYears:number}){
 if(!input.cashFlows.every(x=>finite(x.amount))||!nonNegative(input.reinvestmentRatePercent)||!nonNegative(input.borrowingRatePercent)||!Number.isInteger(input.planningHorizonYears)||input.planningHorizonYears<=0)throw new Error('invalid-dated-mirr')
 const horizonDays=daysBetween30_360(input.referenceDate,input.recoveryDate)
 if(horizonDays<=0)throw new Error('invalid-mirr-horizon')
 const reinvest=1+input.reinvestmentRatePercent/100,borrow=1+input.borrowingRatePercent/100
 const positiveFuture=input.cashFlows.reduce((sum,flow)=>flow.amount>0?sum+flow.amount*Math.pow(reinvest,daysBetween30_360(flow.date,input.recoveryDate)/360):sum,0)
 const negativePresent=input.cashFlows.reduce((sum,flow)=>flow.amount<0?sum+(-flow.amount)/Math.pow(borrow,daysBetween30_360(input.referenceDate,flow.date)/360):sum,0)
 if(negativePresent===0)return null
 return Math.pow(positiveFuture/negativePresent,1/input.planningHorizonYears)-1
}


export type EconomicNumeraire='local-domestic-prices'|'local-border-prices'|'foreign-border-prices'
export function calculateForeignExchangeAdjustment(adjustedMarketValue:number,foreignCurrencyExposurePercent:number,standardConversionFactor:number,numeraire:EconomicNumeraire){
 if(!finite(adjustedMarketValue)||!nonNegative(foreignCurrencyExposurePercent)||foreignCurrencyExposurePercent>100||!nonNegative(standardConversionFactor)||standardConversionFactor===0)throw new Error('invalid-foreign-exchange-adjustment')
 const exposure=foreignCurrencyExposurePercent/100
 return numeraire==='local-domestic-prices'
  ? adjustedMarketValue*exposure*(1/standardConversionFactor-1)
  : adjustedMarketValue*(1-exposure)*(standardConversionFactor-1)
}
export function calculateEconomicNumeraireValue(localCurrencyValue:number,officialNumeraireToLocalRate:number){
 if(!finite(localCurrencyValue)||!nonNegative(officialNumeraireToLocalRate)||officialNumeraireToLocalRate===0)throw new Error('invalid-numeraire-conversion')
 return localCurrencyValue*officialNumeraireToLocalRate
}
export function calculateIndirectEffectInLocalCurrency(amount:number,marketOrigin:'local'|'foreign',numeraire:EconomicNumeraire,shadowExchangeRate:number,standardConversionFactor:number){
 if(!finite(amount)||!nonNegative(shadowExchangeRate)||!nonNegative(standardConversionFactor))throw new Error('invalid-indirect-effect-conversion')
 if(marketOrigin==='local')return amount
 return numeraire==='local-domestic-prices'?amount*shadowExchangeRate:amount*standardConversionFactor
}
export function calculateEconomicCalculationSupport(input:{direction:'input'|'output';tradeCategory:'exported'|'exportable'|'imported'|'importable'|'non-traded';borderPriceLocal:number;transportAdjustedValue:number;transportForeignExposurePercent:number;otherAdjustedValue:number;otherForeignExposurePercent:number;nonTradedPriceLocal?:number}){
 const vals=[input.borderPriceLocal,input.transportAdjustedValue,input.transportForeignExposurePercent,input.otherAdjustedValue,input.otherForeignExposurePercent]
 if(!vals.every(finite)||input.transportForeignExposurePercent<0||input.transportForeignExposurePercent>100||input.otherForeignExposurePercent<0||input.otherForeignExposurePercent>100)throw new Error('invalid-economic-calculation-support')
 if(input.tradeCategory==='non-traded'){
  if(input.nonTradedPriceLocal===undefined||!finite(input.nonTradedPriceLocal)||input.nonTradedPriceLocal<0)throw new Error('non-traded-price-required')
  return {adjustedMarketValue:input.nonTradedPriceLocal,foreignCurrencyExposurePercent:0,adjustmentFactor:null}
 }
 const subtract=input.direction==='output'&&(input.tradeCategory==='exported'||input.tradeCategory==='exportable')||input.direction==='input'&&input.tradeCategory==='exportable'
 const sign=subtract?-1:1
 const adjustedMarketValue=input.borderPriceLocal+sign*(input.transportAdjustedValue+input.otherAdjustedValue)
 if(adjustedMarketValue===0)throw new Error('zero-economic-adjusted-market-value')
 const foreignPart=input.borderPriceLocal+sign*(input.transportAdjustedValue*input.transportForeignExposurePercent/100+input.otherAdjustedValue*input.otherForeignExposurePercent/100)
 const foreignCurrencyExposurePercent=Math.max(0,Math.min(100,foreignPart/adjustedMarketValue*100))
 return {adjustedMarketValue,foreignCurrencyExposurePercent,adjustmentFactor:null}
}


export function calculateValueAddedDistribution(input:{netNationalValueAdded:number;domesticWages:number;profitDividendsInterest:number;corporateTax:number;outputIndirectTax:number;materialInputIndirectTax:number;investmentIndirectTax:number;subsidyOnOutput:number;subsidyOnInvestment:number;subsidyOnInput:number}){
 if(!Object.values(input).every(finite))throw new Error('invalid-value-added-distribution')
 const government=input.corporateTax+input.outputIndirectTax+input.materialInputIndirectTax+input.investmentIndirectTax-input.subsidyOnOutput-input.subsidyOnInvestment-input.subsidyOnInput
 const other=input.netNationalValueAdded-input.domesticWages-input.profitDividendsInterest-government
 return {domesticWages:input.domesticWages,profitDividendsInterest:input.profitDividendsInterest,government,other,check:input.domesticWages+input.profitDividendsInterest+government+other-input.netNationalValueAdded}
}
export function calculateEconomicCostBenefitPeriod(input:{salesRevenue:number;shortTermDepositInterest:number;otherIncome:number;foreignLoanDisbursements:number;indirectBenefits:number;fixedInvestment:number;preproductionExInterest:number;increaseInNetWorkingCapital:number;operatingCosts:number;marketingCosts:number;foreignDebtService:number;corporateTax:number;indirectCosts:number}){
 const values=Object.values(input)
 if(!values.every(finite))throw new Error('invalid-cost-benefit-period')
 const cashInflows=input.salesRevenue+input.shortTermDepositInterest+input.otherIncome+input.foreignLoanDisbursements+input.indirectBenefits
 const cashOutflows=input.fixedInvestment+input.preproductionExInterest+input.increaseInNetWorkingCapital+input.operatingCosts+input.marketingCosts+input.foreignDebtService+input.corporateTax+input.indirectCosts
 return {cashInflows,cashOutflows,netCashFlow:cashInflows-cashOutflows}
}


export function calculateInternalRateOfReturn(cashFlows:number[],periodsPerYear=1,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period'){
 if(!cashFlows.every(finite)||!Number.isInteger(periodsPerYear)||periodsPerYear<=0)throw new Error('invalid-irr-input')
 if(!cashFlows.some(x=>x<0)||!cashFlows.some(x=>x>0))return []
 const shift=referencePoint==='end-of-first-period'?1/periodsPerYear:0
 const npvAtLogRate=(logFactor:number)=>cashFlows.reduce((sum,flow,index)=>sum+flow/Math.exp(logFactor*Math.max(0,(index+1)/periodsPerYear-shift)),0)
 const low=Math.log(0.0001),high=Math.log(101),samples=1600
 const roots:number[]=[]
 let prevX=low,prev=npvAtLogRate(prevX)
 for(let i=1;i<=samples;i++){
  const x=low+(high-low)*i/samples,value=npvAtLogRate(x)
  if(value===0)roots.push(Math.exp(x)-1)
  else if(prev===0)roots.push(Math.exp(prevX)-1)
  else if(Math.sign(value)!==Math.sign(prev)){
   let a=prevX,b=x,fa=prev
   for(let k=0;k<100;k++){
    const mid=(a+b)/2,fm=npvAtLogRate(mid)
    if(Math.abs(fm)<1e-10||Math.abs(b-a)<1e-12){a=mid;b=mid;break}
    if(Math.sign(fm)===Math.sign(fa)){a=mid;fa=fm}else b=mid
   }
   const root=Math.exp((a+b)/2)-1
   if(!roots.some(existing=>Math.abs(existing-root)<1e-7))roots.push(root)
  }
  prevX=x;prev=value
 }
 return roots.sort((a,b)=>a-b)
}
export function calculateSimplePayback(cashFlows:number[]){
 if(!cashFlows.every(finite))throw new Error('invalid-simple-payback')
 let cumulative=0
 for(let i=0;i<cashFlows.length;i++){
  const previous=cumulative;cumulative+=cashFlows[i]
  if(cumulative>=0&&previous<0&&cashFlows[i]>0)return {period:i+1,years:i+(Math.abs(previous)/cashFlows[i])}
 }
 return null
}
export function calculateDynamicPayback(cashFlows:number[],discountRatePercent:number,periodsPerYear=1,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period'){
 const npv=calculateHelpNpv(cashFlows,discountRatePercent,periodsPerYear,referencePoint)
 let cumulative=0
 for(let i=0;i<npv.discountedCashFlows.length;i++){
  const previous=cumulative;cumulative+=npv.discountedCashFlows[i]
  if(cumulative>=0&&previous<0&&npv.discountedCashFlows[i]>0)return {period:i+1,years:i+Math.abs(previous)/npv.discountedCashFlows[i],cumulativeNpv:cumulative}
 }
 return null
}
export function calculateShortNpv(cashFlows:number[],discountRatePercent:number,years:number,periodsPerYear=1,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period'){
 if(!Number.isInteger(years)||years<1||!Number.isInteger(periodsPerYear)||periodsPerYear<=0)throw new Error('invalid-short-npv-horizon')
 return calculateHelpNpv(cashFlows.slice(0,years*periodsPerYear),discountRatePercent,periodsPerYear,referencePoint).npv
}
export function calculateNpvRatio(npv:number,investmentByPeriod:number[],discountRatePercent:number,periodsPerYear=1,referencePoint:'beginning-of-first-period'|'end-of-first-period'='beginning-of-first-period'){
 if(!finite(npv)||!investmentByPeriod.every(nonNegative)||!nonNegative(discountRatePercent)||!Number.isInteger(periodsPerYear)||periodsPerYear<=0)throw new Error('invalid-npv-ratio')
 const shift=referencePoint==='end-of-first-period'?1/periodsPerYear:0
 const pvi=investmentByPeriod.reduce((sum,value,index)=>sum+value/Math.pow(1+discountRatePercent/100,Math.max(0,(index+1)/periodsPerYear-shift)),0)
 return {npv,presentValueOfInvestment:pvi,ratio:pvi===0?null:npv/pvi}
}
export function calculateBreakEven(input:{fixedCost:number;variableCostPerUnit:number;salesPricePerUnit:number;capacity:number}){
 if(![input.fixedCost,input.variableCostPerUnit,input.salesPricePerUnit,input.capacity].every(nonNegative)||input.salesPricePerUnit<=input.variableCostPerUnit)throw new Error('invalid-break-even-input')
 const quantity=input.fixedCost/(input.salesPricePerUnit-input.variableCostPerUnit)
 return {quantity,capacityPercent:input.capacity===0?null:quantity/input.capacity*100,revenue:quantity*input.salesPricePerUnit}
}
