/**
 * COMFAR III value-added schedule.
 * Financial amounts are kept separate from indirect-tax transfers and subsidies.
 * Every manually sourced cost input requires documentary evidence.
 */
export type ValueAddedMarketOrigin = 'local' | 'foreign'
export type ValueAddedInvestmentKind = 'fixed-investment' | 'pre-production-net-of-interest' | 'inventory-increase'

export type ValueAddedInputItem = {
  id: string
  period: number
  description: string
  amount: number
  marketOrigin: ValueAddedMarketOrigin
  /** Indirect taxes/duties included in the financial amount; negative values represent input subsidies. */
  taxesDutiesIncludedPercent: number
  /** Up to three successive rounds of domestic value-added content, each applied to the remaining amount. */
  valueAddedIncludedPercentages: [number, number, number]
  sourceReference: string
  sourceVerified: boolean
}

export type ValueAddedInvestmentItem = ValueAddedInputItem & {
  kind: ValueAddedInvestmentKind
}

export type ValueAddedPeriodInput = {
  period: number
  /** Sales revenue net of output sales tax and excluding sales subsidies. */
  salesRevenue: number
  outputSalesTax: number
  otherIncome: number
  subsidiesOnOutput: number
  intermediateInputs: ValueAddedInputItem[]
  investmentInputs: ValueAddedInvestmentItem[]
  /** Foreign payments at the official exchange rate, separated by COMFAR repatriation class. */
  repatriatedWages: number
  repatriatedProfitDividends: number
  repatriatedInterest: number
  repatriatedOther: number
  domesticWages: number
  domesticDividendsAndInterest: number
  corporateTax: number
  subsidiesOnInput: number
  subsidiesOnInvestment: number
  skilledDomesticLabour: number
  totalDomesticLabour: number
  foreignExchangeOutflow: number
  /** Present-value factor from the economic discount convention, not a financial WACC factor. */
  presentValueFactor: number
  sourceReference: string
  sourceVerified: boolean
}

export type ValueAddedInputAdjustment = {
  financialAmount: number
  indirectTaxIncluded: number
  valueAddedIncluded: number
  amountDeducted: number
  localContent: number
  foreignContent: number
}

export type ValueAddedPeriodRow = {
  period: number
  grossOutput: number
  intermediateInput: ValueAddedInputAdjustment
  investment: ValueAddedInputAdjustment
  grossDomesticValueAdded: number
  netDomesticValueAdded: number
  repatriatedPayments: number
  netNationalValueAdded: number
  domesticWages: number
  domesticDividendsAndInterest: number
  governmentShare: number
  otherValueAdded: number
  distributionDifference: number
  presentValueFactor: number
}

export type ValueAddedAnalysisResult = {
  valid: boolean
  issues: string[]
  rows: ValueAddedPeriodRow[]
  totals: {
    grossDomesticValueAdded: number
    netDomesticValueAdded: number
    repatriatedPayments: number
    netNationalValueAdded: number
    domesticWages: number
    domesticDividendsAndInterest: number
    governmentShare: number
    otherValueAdded: number
    presentValueNetNationalValueAdded: number
    presentValueDomesticWages: number
    absoluteEfficiencyRatio: number | null
    relativeEfficiency: {
      investment: number | null
      foreignExchange: number | null
      skilledLabour: number | null
      totalLabour: number | null
    }
  }
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function emptyResult(issues: string[]): ValueAddedAnalysisResult {
  return {
    valid:false,issues,rows:[],
    totals:{
      grossDomesticValueAdded:0,netDomesticValueAdded:0,repatriatedPayments:0,
      netNationalValueAdded:0,domesticWages:0,domesticDividendsAndInterest:0,
      governmentShare:0,otherValueAdded:0,presentValueNetNationalValueAdded:0,
      presentValueDomesticWages:0,absoluteEfficiencyRatio:null,
      relativeEfficiency:{investment:null,foreignExchange:null,skilledLabour:null,totalLabour:null},
    },
  }
}

/** Calculate the COMFAR sequential input-content decomposition without zero-filling missing evidence. */
export function adjustValueAddedInput(item: ValueAddedInputItem): ValueAddedInputAdjustment {
  const indirectTaxIncluded=item.amount*item.taxesDutiesIncludedPercent/100
  const netOfIndirectTax=item.amount-indirectTaxIncluded
  const [first,second,third]=item.valueAddedIncludedPercentages
  const firstValueAdded=netOfIndirectTax*first/100
  const afterFirst=netOfIndirectTax-firstValueAdded
  const secondValueAdded=afterFirst*second/100
  const afterSecond=afterFirst-secondValueAdded
  const thirdValueAdded=afterSecond*third/100
  const valueAddedIncluded=firstValueAdded+secondValueAdded+thirdValueAdded
  const amountDeducted=netOfIndirectTax-valueAddedIncluded
  return {
    financialAmount:item.amount,
    indirectTaxIncluded,
    valueAddedIncluded,
    amountDeducted,
    localContent:item.marketOrigin==='local'?amountDeducted:0,
    foreignContent:item.marketOrigin==='foreign'?amountDeducted:0,
  }
}

function validateInputItem(item: ValueAddedInputItem, expectedPeriod: number, label: string, issues: string[], allowNegativeAmount = false): void {
  if(!item.id.trim()||!item.description.trim())issues.push(label+' requires a stable ID and description.')
  if(item.period!==expectedPeriod)issues.push(label+' is assigned to an incorrect period.')
  if(!Number.isFinite(item.amount)||(!allowNegativeAmount&&item.amount<0))issues.push(label+(allowNegativeAmount?' amount must be finite.':' amount must be finite and non-negative.'))
  if(item.marketOrigin!=='local'&&item.marketOrigin!=='foreign')issues.push(label+' requires a local or foreign market origin.')
  if(!Number.isFinite(item.taxesDutiesIncludedPercent)||item.taxesDutiesIncludedPercent< -100||item.taxesDutiesIncludedPercent>100)
    issues.push(label+' indirect-tax percentage must be between -100% and 100%.')
  if(!Array.isArray(item.valueAddedIncludedPercentages)||item.valueAddedIncludedPercentages.length!==3||
    item.valueAddedIncludedPercentages.some(value=>!Number.isFinite(value)||value<0||value>100))
    issues.push(label+' requires three valid value-added decomposition percentages from 0% to 100%.')
  if(!item.sourceVerified||!item.sourceReference.trim())issues.push(label+' requires a verified source reference.')
}

function safeRatio(numerator:number,denominator:number):number|null {
  return denominator>0?numerator/denominator:null
}

/**
 * GDVA = (sales + output taxes + other income) - adjusted intermediate inputs.
 * NDVA = GDVA - adjusted fixed investment, pre-production expenditure and inventory increase.
 * NNVA = NDVA - repatriated payments.
 * Distribution: NNVA = domestic wages + domestic dividends/interest + government + other value added.
 */
export function buildComfarValueAddedAnalysis(periods: ValueAddedPeriodInput[]): ValueAddedAnalysisResult {
  const issues:string[]=[]
  if(!periods.length)issues.push('At least one period is required for value-added analysis.')
  const seen=new Set<number>()
  for(const row of periods){
    if(!Number.isInteger(row.period)||row.period<1||seen.has(row.period))issues.push('Value-added period numbers must be positive and unique.')
    seen.add(row.period)
    const nonNegativeFields:[string,number][]=[
      ['sales revenue',row.salesRevenue],['output sales tax',row.outputSalesTax],['other income',row.otherIncome],
      ['output subsidy',row.subsidiesOnOutput],['repatriated wages',row.repatriatedWages],
      ['repatriated profit/dividends',row.repatriatedProfitDividends],['repatriated interest',row.repatriatedInterest],
      ['other repatriated payments',row.repatriatedOther],['domestic wages',row.domesticWages],
      ['domestic dividends/interest',row.domesticDividendsAndInterest],['corporate tax',row.corporateTax],
      ['input subsidy',row.subsidiesOnInput],['investment subsidy',row.subsidiesOnInvestment],
      ['skilled domestic labour',row.skilledDomesticLabour],['total domestic labour',row.totalDomesticLabour],
      ['foreign-exchange outflow',row.foreignExchangeOutflow],
    ]
    for(const [name,value] of nonNegativeFields)if(!finiteNonNegative(value))issues.push('Period '+row.period+' '+name+' must be finite and non-negative.')
    if(!Number.isFinite(row.presentValueFactor)||row.presentValueFactor<=0)issues.push('Period '+row.period+' requires a positive economic present-value factor.')
    if(row.skilledDomesticLabour>row.totalDomesticLabour+0.000001)issues.push('Period '+row.period+' skilled domestic labour cannot exceed total domestic labour.')
    if(!row.sourceVerified||!row.sourceReference.trim())issues.push('Period '+row.period+' requires a verified source reference for linked output, wages, taxes and repatriated-payment data.')
    const ids=new Set<string>()
    for(const item of row.intermediateInputs??[]){
      validateInputItem(item,row.period,'Intermediate input '+item.id,issues)
      const key=item.id.trim().toLocaleLowerCase()
      if(ids.has(key))issues.push('Duplicate value-added input ID '+item.id+' in period '+row.period+'.')
      ids.add(key)
    }
    for(const item of row.investmentInputs??[]){
      validateInputItem(item,row.period,'Investment input '+item.id,issues,item.kind==='inventory-increase')
      if(!['fixed-investment','pre-production-net-of-interest','inventory-increase'].includes(item.kind))
        issues.push('Investment input '+item.id+' has an unsupported investment category.')
      const key=item.id.trim().toLocaleLowerCase()
      if(ids.has(key))issues.push('Duplicate value-added input ID '+item.id+' in period '+row.period+'.')
      ids.add(key)
    }
  }
  if(issues.length)return emptyResult(issues)

  const rows:ValueAddedPeriodRow[]=periods.map(row=>{
    const intermediateItems=row.intermediateInputs.map(adjustValueAddedInput)
    const investmentItems=row.investmentInputs.map(adjustValueAddedInput)
    const sum=(items:ValueAddedInputAdjustment,key:'financialAmount'|'indirectTaxIncluded'|'valueAddedIncluded'|'amountDeducted'|'localContent'|'foreignContent')=>
      items.reduce((total,item)=>total+item[key],0)
    const intermediateInput:ValueAddedInputAdjustment={
      financialAmount:sum(intermediateItems,'financialAmount'),
      indirectTaxIncluded:sum(intermediateItems,'indirectTaxIncluded'),
      valueAddedIncluded:sum(intermediateItems,'valueAddedIncluded'),
      amountDeducted:sum(intermediateItems,'amountDeducted'),
      localContent:sum(intermediateItems,'localContent'),
      foreignContent:sum(intermediateItems,'foreignContent'),
    }
    const investment:ValueAddedInputAdjustment={
      financialAmount:sum(investmentItems,'financialAmount'),
      indirectTaxIncluded:sum(investmentItems,'indirectTaxIncluded'),
      valueAddedIncluded:sum(investmentItems,'valueAddedIncluded'),
      amountDeducted:sum(investmentItems,'amountDeducted'),
      localContent:sum(investmentItems,'localContent'),
      foreignContent:sum(investmentItems,'foreignContent'),
    }
    const grossOutput=row.salesRevenue+row.outputSalesTax+row.otherIncome
    const grossDomesticValueAdded=grossOutput-intermediateInput.amountDeducted
    const netDomesticValueAdded=grossDomesticValueAdded-investment.amountDeducted
    const repatriatedPayments=row.repatriatedWages+row.repatriatedProfitDividends+row.repatriatedInterest+row.repatriatedOther
    const netNationalValueAdded=netDomesticValueAdded-repatriatedPayments
    const governmentShare=row.corporateTax+row.outputSalesTax+intermediateInput.indirectTaxIncluded+
      investment.indirectTaxIncluded-row.subsidiesOnOutput-row.subsidiesOnInvestment-row.subsidiesOnInput
    const otherValueAdded=netNationalValueAdded-row.domesticWages-row.domesticDividendsAndInterest-governmentShare
    const distributionDifference=netNationalValueAdded-(row.domesticWages+row.domesticDividendsAndInterest+governmentShare+otherValueAdded)
    return {
      period:row.period,grossOutput,intermediateInput,investment,grossDomesticValueAdded,
      netDomesticValueAdded,repatriatedPayments,netNationalValueAdded,domesticWages:row.domesticWages,
      domesticDividendsAndInterest:row.domesticDividendsAndInterest,governmentShare,otherValueAdded,
      distributionDifference,presentValueFactor:row.presentValueFactor,
    }
  })
  const sum=(key:keyof Pick<ValueAddedPeriodRow,'grossDomesticValueAdded'|'netDomesticValueAdded'|'repatriatedPayments'|'netNationalValueAdded'|'domesticWages'|'domesticDividendsAndInterest'|'governmentShare'|'otherValueAdded'>)=>
    rows.reduce((total,row)=>total+row[key],0)
  const pv=(selector:(row:ValueAddedPeriodInput)=>number)=>periods.reduce((total,row)=>total+selector(row)*row.presentValueFactor,0)
  const pvNnva=rows.reduce((total,row)=>total+row.netNationalValueAdded*row.presentValueFactor,0)
  const pvWages=rows.reduce((total,row)=>total+row.domesticWages*row.presentValueFactor,0)
  const pvInvestment=pv(row=>row.investmentInputs.reduce((total,item)=>total+adjustValueAddedInput(item).amountDeducted,0))
  const pvForeignExchange=pv(row=>row.foreignExchangeOutflow)
  const pvSkilledLabour=pv(row=>row.skilledDomesticLabour)
  const pvTotalLabour=pv(row=>row.totalDomesticLabour)
  return {
    valid:true,issues:[],rows,
    totals:{
      grossDomesticValueAdded:sum('grossDomesticValueAdded'),netDomesticValueAdded:sum('netDomesticValueAdded'),
      repatriatedPayments:sum('repatriatedPayments'),netNationalValueAdded:sum('netNationalValueAdded'),
      domesticWages:sum('domesticWages'),domesticDividendsAndInterest:sum('domesticDividendsAndInterest'),
      governmentShare:sum('governmentShare'),otherValueAdded:sum('otherValueAdded'),
      presentValueNetNationalValueAdded:pvNnva,presentValueDomesticWages:pvWages,
      absoluteEfficiencyRatio:safeRatio(pvNnva,pvWages),
      relativeEfficiency:{
        investment:safeRatio(pvNnva,pvInvestment),foreignExchange:safeRatio(pvNnva,pvForeignExchange),
        skilledLabour:safeRatio(pvNnva,pvSkilledLabour),totalLabour:safeRatio(pvNnva,pvTotalLabour),
      },
    },
  }
}
