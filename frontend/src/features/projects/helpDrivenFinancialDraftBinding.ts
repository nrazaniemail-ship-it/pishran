import {
  createBlankFixedAssetFormDraft,
  createBlankProductionCostFormDraft,
  createBlankSalesProductFormDraft,
  createBlankWorkingCapitalComponentFormDraft,
  createBlankLoanFacilityFormDraft,
  type LoanFacilityFormDraft,
  type ProjectModelFinancialFormDrafts,
} from './projectModelFormDrafts'
import type { HelpDrivenProjectForms, HelpFormRow } from './projectModelHelpForms'
import type { ProjectCalendarPeriod } from './projectFoundation'

type DraftCollections = Pick<ProjectModelFinancialFormDrafts, 'assets'|'productionCosts'|'sales'|'workingCapital'|'loans'>
type BindingResult = { drafts: DraftCollections; issues: string[]; boundSections: string[] }

const str=(row:HelpFormRow,key:string):string=>{
  const value=row.values[key]
  return typeof value==='string'?value.trim():''
}
const num=(row:HelpFormRow,key:string):number|null=>{
  const value=row.values[key]
  return typeof value==='number'&&Number.isFinite(value)?value:null
}
const bool=(row:HelpFormRow,key:string):boolean|null=>{
  const value=row.values[key]
  return typeof value==='boolean'?value:null
}
const validDate=(value:string):boolean=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
  const date=new Date(value+'T00:00:00.000Z')
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value
}
const periodKey=(value:string,periods:readonly ProjectCalendarPeriod[]):string|null=>{
  const matches=periods.filter((period,index)=>value===String(index+1)||value===String(period.index)||
    value===period.startDate||value===period.endDate||
    (value.length===7&&value===period.startDate.slice(0,7)&&value===period.endDate.slice(0,7)))
  return matches.length===1?String(matches[0].index):null
}
const periodForDate=(value:string,periods:readonly ProjectCalendarPeriod[]):string|null=>{
  if(!validDate(value))return null
  const matches=periods.filter(period=>value>=period.startDate&&value<=period.endDate)
  return matches.length===1?String(matches[0].index):null
}
const required=(value:string|number|null,label:string,issues:string[]):void=>{
  if(value===null||value==='')issues.push(label+' is required in the help-driven form.')
}

export function bindHelpDrivenFinancialDrafts(
  source:HelpDrivenProjectForms|undefined,
  periods:readonly ProjectCalendarPeriod[],
  existing:DraftCollections,
):BindingResult {
  if(!source)return {drafts:existing,issues:[],boundSections:[]}
  const sections=source.sections??{}
  const issues:string[]=[]
  const boundSections:string[]=[]
  const result:DraftCollections={...existing}
  const rows=(id:string)=>sections[id]??[]

  const conditionRows=rows('loan-conditions')
  if(conditionRows.length){
    const loans:LoanFacilityFormDraft[]=[]
    const disbursementRows=rows('loan-disbursements')
    const interestRows=rows('loan-interest')
    const feeRows=rows('loan-fees')
    const names=new Set<string>()
    for(const condition of conditionRows){
      const name=str(condition,'loanName')
      if(!name){issues.push('loan-conditions:'+condition.id+': loan name is required.');continue}
      if(names.has(name)){issues.push('loan-conditions:'+name+': duplicate facility definition.');continue}
      names.add(name)
      const loan=createBlankLoanFacilityFormDraft(condition.id)
      loan.name=name
      loan.currencyCode=str(condition,'currency').toUpperCase()||null
      loan.marketOrigin=str(condition,'origin')==='foreign'?'foreign':str(condition,'origin')==='local'?'local':null
      const repaymentType=str(condition,'repaymentType')
      loan.loanType=repaymentType==='annuity'?'annuity':repaymentType==='constant-principal'?'constant-principal':repaymentType==='profile'?'profile':null
      if(!loan.loanType)issues.push('loan-conditions:'+name+': repayment type is required.')
      const interval=str(condition,'interval')
      loan.repaymentInterval=interval==='yearly'?'annual':interval==='half-yearly'?'semiannual':
        interval==='quarterly'?'quarterly':interval==='monthly'?'monthly':null
      if(!loan.repaymentInterval)issues.push('loan-conditions:'+name+': repayment interval is required.')
      loan.firstRepaymentDate=str(condition,'firstRepaymentDate')
      loan.graceMonths=num(condition,'graceMonths')
      loan.numberOfRepayments=num(condition,'numberOfRepayments')
      loan.facilityLimit=num(condition,'facilityLimit')
      loan.interestPaymentMonth=num(condition,'interestPaymentMonth')
      const openingDebt=num(condition,'openingDebt')
      loan.openingExchangeRateToLocal=num(condition,'openingExchangeRateToLocal')
      if(loan.marketOrigin==='local'&&loan.openingExchangeRateToLocal!==null)issues.push('loan-conditions:'+name+': opening exchange rate is only applicable to foreign-currency facilities.')
      if(openingDebt!==null&&openingDebt>0){
        if(loan.marketOrigin==='foreign')loan.openingForeignBalance=openingDebt
        else if(loan.marketOrigin==='local')loan.openingLocalBalance=openingDebt
        else issues.push('loan-conditions:'+name+': opening debt requires an explicit local or foreign facility origin.')
      }
      const disbursementUntil=str(condition,'disbursementUntil')
      const datedDrawdowns=disbursementRows.filter(row=>str(row,'loanName')===name)
      for(const row of datedDrawdowns){
        const date=str(row,'date'),amount=num(row,'amount'),flowType=str(row,'flowType')
        if(!validDate(date)||amount===null){issues.push('loan-disbursements:'+row.id+': valid date and explicit amount are required.');continue}
        if(flowType==='drawdown'){
          if(amount<0)issues.push('loan-disbursements:'+row.id+': drawdown amount must be non-negative.')
          else loan.disbursements.push({date,amount})
        }else if(flowType==='profile-repayment'){
          if(amount>=0)issues.push('loan-disbursements:'+row.id+': profile repayment must be entered as a negative amount.')
          else loan.profileMovements.push({date,amount:Math.abs(amount)})
        }else issues.push('loan-disbursements:'+row.id+': flow type must be drawdown or profile repayment.')
        if(flowType==='drawdown'&&disbursementUntil&&validDate(disbursementUntil)&&date>disbursementUntil)
          issues.push('loan-disbursements:'+row.id+': drawdown/repayment date exceeds the facility disbursement end date.')
      }
      const datedRates=interestRows.filter(row=>str(row,'loanName')===name)
      const capitalizationPercentages=new Set<number>()
      const capitalizationEndDates=new Set<string>()
      for(const row of datedRates){
        const effectiveDate=str(row,'effectiveDate'),annualRate=num(row,'annualRate')
        if(!validDate(effectiveDate)||annualRate===null){issues.push('loan-interest:'+row.id+': valid effective date and annual rate are required.');continue}
        loan.interestRateChanges.push({effectiveDate,annualRatePercent:annualRate})
        const capitalization=num(row,'capitalizePercent')
        if(capitalization!==null)capitalizationPercentages.add(capitalization)
        const until=str(row,'capitalizeUntil')
        if(until)capitalizationEndDates.add(until)
        for(const key of ['capitalizedInterestMethod','capitalizedInterestStart','capitalizedInterestRate','capitalizedInterestLength'])
          if(row.values[key]!==null&&row.values[key]!==undefined&&row.values[key]!=='')
            issues.push('loan-interest:'+row.id+': capitalized-interest amortization fields are not yet supported by the periodic loan adapter.')
      }
      if(capitalizationPercentages.size>1||capitalizationEndDates.size>1)issues.push('loan-interest:'+name+': capitalization settings conflict between rate rows.')
      const firstCapitalization=datedRates.find(row=>num(row,'capitalizePercent')!==null)
      loan.capitalizedInterestPercent=firstCapitalization?num(firstCapitalization,'capitalizePercent'):null
      loan.capitalizeUntilDate=firstCapitalization?str(firstCapitalization,'capitalizeUntil'):''
      if(loan.capitalizedInterestPercent===null)issues.push('loan-interest:'+name+': an explicit interest capitalization percentage is required.')
      const fees=feeRows.filter(row=>str(row,'loanName')===name)
      for(const row of fees){
        const type=str(row,'type'),rate=num(row,'rate'),paymentDate=str(row,'paymentDate')
        const treatment=str(row,'treatment'),currencyChoice=str(row,'currency')
        if(!['agency','guarantee','commitment','other'].includes(type)||rate===null||
          !validDate(paymentDate)||(treatment!=='expense'&&treatment!=='capitalize')){
          issues.push('loan-fees:'+row.id+': fee type, rate, payment date and accounting treatment are required.')
          continue
        }
        const expectedBasis=type==='agency'?'each-positive-disbursement':
          type==='guarantee'?'outstanding-loan-including-current-disbursement-excluding-current-repayment':
          type==='commitment'?'undisbursed-commitment':'total-loan'
        if(str(row,'basis')!==expectedBasis)
          issues.push('loan-fees:'+row.id+': selected fee basis is not supported for this fee type by the current periodic adapter.')
        if(currencyChoice==='local-currency'&&loan.marketOrigin==='foreign')
          issues.push('loan-fees:'+row.id+': local-currency fees on a foreign-currency facility are not supported by the current adapter.')
        const payment=str(row,'payment')
        if(type==='agency'&&payment!=='at-each-disbursement')
          issues.push('loan-fees:'+row.id+': agency fees must use the per-disbursement payment basis.')
        if(type==='other'&&payment!=='at-first-disbursement')
          issues.push('loan-fees:'+row.id+': other fees must use first-disbursement payment timing.')
        if((type==='guarantee'||type==='commitment')&&payment==='with-interest')
          issues.push('loan-fees:'+row.id+': recurring fee payment with each interest period is not yet supported; provide a dated one-off fee only.')
        for(const key of ['depreciationMethod','depreciationStart','depreciationRate','depreciationLength'])
          if(row.values[key]!==null&&row.values[key]!==undefined&&row.values[key]!=='')
            issues.push('loan-fees:'+row.id+': fee amortization settings are not yet supported by the periodic adapter.')
        const feeCurrency=loan.currencyCode
        loan.fees.push({id:row.id,type:type as LoanFacilityFormDraft['fees'][number]['type'],
          ratePercent:rate,currencyCode:feeCurrency,paymentDate,
          treatment:treatment as 'expense'|'capitalize'})
      }
      loans.push(loan)
    }
    result.loans=loans
    boundSections.push('loan-conditions','loan-disbursements','loan-interest','loan-fees')
    for(const row of disbursementRows)if(!conditionRows.some(condition=>str(condition,'loanName')===str(row,'loanName')))
      issues.push('loan-disbursements:'+row.id+': references an unknown loan facility.')
    for(const row of interestRows)if(!conditionRows.some(condition=>str(condition,'loanName')===str(row,'loanName')))
      issues.push('loan-interest:'+row.id+': references an unknown loan facility.')
    for(const row of feeRows)if(!conditionRows.some(condition=>str(condition,'loanName')===str(row,'loanName')))
      issues.push('loan-fees:'+row.id+': references an unknown loan facility.')
  }

  const assetRows=rows('fixed-investment')
  if(assetRows.length){
    const assets=assetRows.map((row,index)=>{
      const asset=createBlankFixedAssetFormDraft(row.id)
      const date=str(row,'acquisitionDate')
      const period=periodForDate(date,periods)
      if(!period)issues.push('fixed-investment:'+row.id+': acquisition date must fall inside exactly one project period.')
      const quantity=num(row,'quantity'),unitPrice=num(row,'unitPrice'),total=num(row,'total')
      required(quantity,'fixed-investment:'+row.id+': quantity',issues)
      required(unitPrice,'fixed-investment:'+row.id+': unit price',issues)
      required(total,'fixed-investment:'+row.id+': total',issues)
      if(quantity!==null&&unitPrice!==null&&total!==null&&Math.abs(quantity*unitPrice-total)>0.01)
        issues.push('fixed-investment:'+row.id+': quantity × unit price does not reconcile to total.')
      const method=str(row,'method')
      const startMode=str(row,'startMode')
      const lengthYears=num(row,'lengthYears')
      const methods=['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits'] as const
      if(!methods.includes(method as typeof methods[number]))issues.push('fixed-investment:'+row.id+': valid depreciation method is required.')
      if(startMode!=='production-start'&&startMode!=='specified-date')issues.push('fixed-investment:'+row.id+': depreciation start mode is required.')
      if(lengthYears===null||lengthYears<=0)issues.push('fixed-investment:'+row.id+': positive useful life in years is required.')
      const currency=str(row,'currency')
      asset.metadata={...asset.metadata,description:str(row,'assetName'),currencyCode:currency||null,
        marketOrigin:str(row,'origin')==='foreign'?'foreign':str(row,'origin')==='local'?'local':null,
        costCentreId:str(row,'costCentreId')||null}
      asset.acquisitionPeriods=period?[{period,quantity,unitPrice,total}]:[]
      asset.depreciation={
        method:methods.includes(method as typeof methods[number])?method as typeof methods[number]:null,
        startMode:startMode==='production-start'||startMode==='specified-date'?startMode:null,
        startDate:str(row,'startDate'),
        firstDepreciationYearMonths:num(row,'firstDepreciationYearMonths'),
        ratePercent:num(row,'ratePercent'),
        usefulLifeMonths:lengthYears!==null&&Number.isFinite(lengthYears)?Math.round(lengthYears*12):null,
        salvagePercent:num(row,'scrapPercent'),
      }
      const saleDate=str(row,'saleDate'),salePrice=num(row,'salePrice')
      if(saleDate||salePrice!==null){
        if(!validDate(saleDate)||salePrice===null)issues.push('fixed-investment:'+row.id+': disposal requires a valid sale date and proceeds.')
        else asset.disposal={date:saleDate,proceeds:salePrice}
      }
      return asset
    })
    result.assets=assets
    boundSections.push('fixed-investment')
  }

  const preproductionRows=rows('preproduction-expenditure')
  if(preproductionRows.length){
    const assets=preproductionRows.map(row=>{
      const asset=createBlankFixedAssetFormDraft(row.id)
      asset.assetClass='preproduction'
      const period=periodKey(str(row,'period'),periods)
      const periodRecord=period?periods.find(item=>String(item.index)===period):undefined
      const quantity=num(row,'quantity'),unitPrice=num(row,'unitPrice'),total=num(row,'total')
      required(quantity,'preproduction-expenditure:'+row.id+': quantity',issues)
      required(unitPrice,'preproduction-expenditure:'+row.id+': unit price',issues)
      required(total,'preproduction-expenditure:'+row.id+': total',issues)
      if(!periodRecord)issues.push('preproduction-expenditure:'+row.id+': expenditure period must resolve to exactly one project period.')
      if(quantity!==null&&unitPrice!==null&&total!==null&&Math.abs(quantity*unitPrice-total)>0.01)
        issues.push('preproduction-expenditure:'+row.id+': quantity × unit price does not reconcile to total.')
      const method=str(row,'amortizationMethod')
      const startMode=str(row,'amortizationStartMode')
      const lifeYears=num(row,'amortizationLength')
      const firstMonths=num(row,'firstAmortizationYearMonths')
      const salvage=num(row,'scrapPercent')
      const methods=['linear-to-zero','linear-to-scrap','accelerated-declining-balance','sum-of-years-digits'] as const
      if(!methods.includes(method as typeof methods[number]))issues.push('preproduction-expenditure:'+row.id+': valid amortization method is required.')
      if(startMode!=='production-start'&&startMode!=='specified-date')issues.push('preproduction-expenditure:'+row.id+': amortization start mode is required.')
      if(startMode==='specified-date'&&!validDate(str(row,'amortizationStartDate')))
        issues.push('preproduction-expenditure:'+row.id+': specified amortization start requires a valid date.')
      if(lifeYears===null||lifeYears<=0)issues.push('preproduction-expenditure:'+row.id+': positive amortization life in years is required.')
      if(firstMonths===null||!Number.isInteger(firstMonths)||firstMonths<1||firstMonths>12)
        issues.push('preproduction-expenditure:'+row.id+': first amortization-year months must be between 1 and 12.')
      if(method!=='linear-to-zero'&&(salvage===null||salvage<0||salvage>100))
        issues.push('preproduction-expenditure:'+row.id+': salvage percentage is required for this amortization method.')
      asset.metadata={...asset.metadata,description:str(row,'description'),currencyCode:str(row,'currency').toUpperCase()||null,
        marketOrigin:str(row,'origin')==='foreign'?'foreign':str(row,'origin')==='local'?'local':null}
      asset.acquisitionPeriods=periodRecord?[{period:String(periodRecord.index),quantity,unitPrice,total}]:[]
      asset.depreciation={
        method:methods.includes(method as typeof methods[number])?method as typeof methods[number]:null,
        startMode:startMode==='production-start'||startMode==='specified-date'?startMode:null,
        startDate:str(row,'amortizationStartDate'),firstDepreciationYearMonths:firstMonths,
        ratePercent:num(row,'amortizationRatePercent'),usefulLifeMonths:lifeYears!==null?Math.round(lifeYears*12):null,
        salvagePercent:method==='linear-to-zero'?0:salvage,
      }
      return asset
    })
    result.assets=[...result.assets,...assets]
    boundSections.push('preproduction-expenditure')
  }

  const costRows=rows('production-costs')
  const allocationRows=rows('cost-allocation')
  if(costRows.length){
    const allocationsByKey=new Map<string,HelpFormRow[]>()
    const allocationGroupByRowId=new Map<string,string>()
    for(const row of allocationRows){
      const name=str(row,'name'),centre=str(row,'costCentreId')
      if(!name||!centre){issues.push('cost-allocation:'+row.id+': allocation key name and cost centre are required.');continue}
      const groupKey=name+'|'+centre
      allocationsByKey.set(groupKey,[...(allocationsByKey.get(groupKey)??[]),row])
      allocationGroupByRowId.set(row.id,groupKey)
    }
    const costs:ReturnType<typeof createBlankProductionCostFormDraft>[]=[]
    for(const row of costRows){
      const cost=createBlankProductionCostFormDraft(row.id)
      const classification=str(row,'classification')
      const basis=str(row,'basis')
      const productId=str(row,'productId')
      const allocationKeyId=str(row,'allocationKeyId')
      if(classification!=='direct'&&classification!=='indirect')issues.push('production-costs:'+row.id+': cost classification is required.')
      if(!['nominal-capacity','per-unit-output','period-adjustments'].includes(basis))issues.push('production-costs:'+row.id+': valid cost basis is required.')
      if(!allocationKeyId)required(productId,'production-costs:'+row.id+': product',issues)
      if(allocationKeyId&&classification!=='indirect')issues.push('production-costs:'+row.id+': allocation keys can only be used for indirect costs.')
      const fixedPercent=num(row,'fixedPercent'),variablePercent=num(row,'variablePercent')
      required(fixedPercent,'production-costs:'+row.id+': fixed share',issues)
      required(variablePercent,'production-costs:'+row.id+': variable share',issues)
      cost.metadata={...cost.metadata,description:str(row,'item'),currencyCode:str(row,'currency')||null,
        marketOrigin:str(row,'origin')==='foreign'?'foreign':str(row,'origin')==='local'?'local':null,
        costCentreId:str(row,'costCentreId')||null}
      cost.classification=classification==='direct'||classification==='indirect'?classification:null
      cost.productId=productId||null
      cost.allocationKeyId=allocationKeyId||null
      const activityBasis=str(row,'activityBasis')
      if(activityBasis!=='sales'&&activityBasis!=='production')issues.push('production-costs:'+row.id+': activity basis must be explicitly set to sales or production.')
      cost.activityBasis=activityBasis==='sales'||activityBasis==='production'?activityBasis:null
      cost.basis=['nominal-capacity','per-unit-output','period-adjustments'].includes(basis)?basis as typeof cost.basis:null
      cost.standardQuantity=num(row,'standardQuantity')
      cost.standardUnitPrice=num(row,'standardUnitPrice')
      cost.standardTotal=num(row,'standardTotal')
      cost.nominalCapacity=num(row,'nominalCapacity')
      cost.fixedPercent=fixedPercent
      cost.variablePercent=variablePercent
      const adjustmentPeriod=str(row,'period')
      const adjustmentTotal=num(row,'adjustmentTotal')
      if(adjustmentPeriod||adjustmentTotal!==null||num(row,'adjustmentQuantity')!==null||num(row,'adjustmentUnitPrice')!==null){
        const resolved=periodKey(adjustmentPeriod,periods)
        if(!resolved)issues.push('production-costs:'+row.id+': adjustment period must resolve to exactly one project period.')
        else cost.adjustments=[{period:resolved,quantity:num(row,'adjustmentQuantity'),unitPrice:num(row,'adjustmentUnitPrice'),
          total:adjustmentTotal,fixedPercent:num(row,'adjustmentFixedPercent'),variablePercent:num(row,'adjustmentVariablePercent')}]
      }
      if(!allocationKeyId){costs.push(cost);continue}
      const groupKey=allocationGroupByRowId.get(allocationKeyId)
      const shares=groupKey?allocationsByKey.get(groupKey)??[]:[]
      if(!shares.length){issues.push('production-costs:'+row.id+': allocation key "'+allocationKeyId+'" was not defined.');continue}
      const sourceCostCentre=str(row,'costCentreId')
      const allocationCostCentre=groupKey?.split('|').slice(1).join('|')??''
      if(!sourceCostCentre||sourceCostCentre!==allocationCostCentre){
        issues.push('production-costs:'+row.id+': indirect-cost allocation key must belong to the same cost centre as the source cost item.')
        continue
      }
      if(shares.some(share=>str(share,'type')!=='user-defined')){
        issues.push('cost-allocation:'+allocationKeyId+': only explicit user-defined allocation percentages are currently supported.')
        continue
      }
      const parsedShares=shares.map(share=>({row:share,productId:str(share,'productId'),percent:num(share,'allocationPercent')}))
      if(parsedShares.some(share=>!share.productId||share.percent===null||share.percent<0||share.percent>100)){
        issues.push('cost-allocation:'+allocationKeyId+': every share requires a product and an allocation percentage from 0% to 100%.')
        continue
      }
      const totalShare=parsedShares.reduce((sum,share)=>sum+(share.percent??0),0)
      if(Math.abs(totalShare-100)>0.000001){
        issues.push('cost-allocation:'+allocationKeyId+': allocation percentages must total exactly 100%.')
        continue
      }
      if(new Set(parsedShares.map(share=>share.productId)).size!==parsedShares.length){
        issues.push('cost-allocation:'+allocationKeyId+': a product may appear only once in one allocation key.')
        continue
      }
      for(const share of parsedShares){
        const factor=(share.percent??0)/100
        costs.push({
          ...cost,id:cost.id+'@'+share.row.id,productId:share.productId,
          metadata:{...cost.metadata,costCentreId:str(share.row,'costCentreId')||cost.metadata.costCentreId},
          standardQuantity:cost.standardQuantity===null?null:cost.standardQuantity*factor,
          standardTotal:cost.standardTotal===null?null:cost.standardTotal*factor,
          adjustments:cost.adjustments.map(adjustment=>({
            ...adjustment,
            quantity:adjustment.quantity===null?null:adjustment.quantity*factor,
            total:adjustment.total===null?null:adjustment.total*factor,
          })),
        })
      }
    }
    result.productionCosts=costs
    boundSections.push('production-costs')
    if(allocationRows.length)boundSections.push('cost-allocation')
    for(const [groupKey,shares] of allocationsByKey){
      if(!shares.some(share=>costRows.some(cost=>str(cost,'allocationKeyId')===share.id)))
        issues.push('cost-allocation:'+groupKey+': allocation key is not referenced by an indirect production-cost item.')
    }
  } else if(allocationRows.length){
    issues.push('Cost-allocation rows require at least one production-cost item that references the allocation key.')
  }
  const salesRows=rows('sales-programme')
  if(salesRows.length){
    const grouped=new Map<string,HelpFormRow[]>()
    for(const row of salesRows){
      const productId=str(row,'productId')
      required(productId,'sales-programme:'+row.id+': product',issues)
      if(productId)grouped.set(productId,[...(grouped.get(productId)??[]),row])
    }
    result.sales=[...grouped.entries()].map(([productId,items])=>{
      const sales=createBlankSalesProductFormDraft(productId)
      const seen=new Set<string>()
      sales.periods=items.map(row=>{
        const period=periodKey(str(row,'period'),periods)
        if(!period)issues.push('sales-programme:'+row.id+': period must resolve to exactly one project period.')
        if(period&&seen.has(period))issues.push('sales-programme:'+productId+': duplicate sales row for period '+period+'.')
        if(period)seen.add(period)
        const salesQuantity=num(row,'salesQuantity'),netUnitPrice=num(row,'netUnitPrice')
        const salesTaxPercent=num(row,'salesTaxPercent')
        const subsidyPercent=num(row,'subsidyPercent'),subsidyAmount=num(row,'subsidyAmount')
        const closing=num(row,'closingFinishedGoods')
        const grossUnitPrice=num(row,'grossUnitPrice')
        const productionActive=bool(row,'productionActive')
        for(const [field,value] of [['sales quantity',salesQuantity],['net unit price',netUnitPrice],['sales tax',salesTaxPercent],['closing finished goods',closing]] as const)
          required(value,'sales-programme:'+row.id+': '+field,issues)
        if((subsidyPercent===null)===(subsidyAmount===null))
          issues.push('sales-programme:'+row.id+': provide exactly one subsidy basis (percentage or absolute amount).')
        return {period:period??str(row,'period'),salesQuantity,netUnitPrice,salesTaxPercent,
          subsidyPercent,subsidyAmount,finishedGoodsClosingQuantity:closing,grossUnitPrice,productionActive}
      })
      const opening=items.map(row=>num(row,'openingFinishedGoods')).filter((value):value is number=>value!==null)
      if(opening.length&&opening.some(value=>Math.abs(value-opening[0])>0.000001))
        issues.push('sales-programme:'+productId+': opening finished-goods quantities conflict between periods.')
      sales.openingFinishedGoodsQuantity=opening[0]??null
      return sales
    })
    boundSections.push('sales-programme')
  }

  const wcRows=rows('working-capital')
  if(wcRows.length){
    const categoryMap:Record<string,NonNullable<ReturnType<typeof createBlankWorkingCapitalComponentFormDraft>['category']>>={
      'raw-materials':'inventory','factory-supplies':'inventory','utilities':'other-current-asset','energy':'other-current-asset',
      'spare-parts':'inventory','work-in-progress':'work-in-progress','finished-products':'finished-goods',
      'accounts-receivable':'receivables','cash-in-hand-local':'cash','cash-in-hand-foreign':'cash','accounts-payable':'payables',
    }
    const groups=new Map<string,HelpFormRow[]>()
    for(const row of wcRows){
      const key=[str(row,'item'),str(row,'category'),str(row,'productId'),str(row,'costItemId'),str(row,'origin'),str(row,'market')].join('|')
      groups.set(key,[...(groups.get(key)??[]),row])
    }
    result.workingCapital=[...groups.entries()].map(([key,items])=>{
      const first=items[0],category=str(first,'category')
      const mapped=categoryMap[category]
      if(!mapped)issues.push('working-capital:'+first.id+': unsupported or missing component category.')
      const component=createBlankWorkingCapitalComponentFormDraft(first.id)
      component.name=str(first,'item')
      component.category=mapped??null
      const seen=new Set<string>()
      component.periodBalances=items.map(row=>{
        const period=periodKey(str(row,'period'),periods)
        const amount=num(row,'requiredValue')
        if(!period)issues.push('working-capital:'+row.id+': period must resolve to exactly one project period.')
        if(period&&seen.has(period))issues.push('working-capital:'+key+': duplicate balance for period '+period+'.')
        if(period)seen.add(period)
        const driverCanDerive = str(first,'mode')==='value' && str(first,'activityBasis')==='sales' &&
          str(first,'basis')==='sales-revenue' && category==='accounts-receivable' &&
          (num(first,'daysCoverage')!==null || num(first,'turnover')!==null)
        if(amount===null&&!driverCanDerive)
          required(amount,'working-capital:'+row.id+': required value',issues)
        return {period:period??str(row,'period'),amount}
      })
      const opening=num(first,'startingBalance')
      component.openingBalance=opening
      if(opening===null)issues.push('working-capital:'+first.id+': explicit opening balance is required.')
      const basis=str(first,'basis')
      component.valuationBasis=basis==='sales-revenue'?'sales-revenue':basis.includes('sold')?'cost-of-sales':basis.includes('produced')?'cost-of-production':'user-defined'
      component.minimumDaysCoverage=num(first,'daysCoverage')
      component.turnoverCoefficient=num(first,'turnover')
      const mode=str(first,'mode')
      component.calculationMode=mode==='units'||mode==='value'?mode:null
      const activityBasis=str(first,'activityBasis')
      component.activityBasis=activityBasis==='sales'||activityBasis==='production'?activityBasis:null
      for(const row of items){
        if(str(row,'mode')!==mode||str(row,'activityBasis')!==activityBasis||
          str(row,'basis')!==basis||num(row,'daysCoverage')!==component.minimumDaysCoverage||
          num(row,'turnover')!==component.turnoverCoefficient)
          issues.push('working-capital:'+row.id+': calculation drivers must remain consistent across all periods of a component.')
      }
      return component
    })
    boundSections.push('working-capital')
  }

  return {drafts:result,issues,boundSections}
}
