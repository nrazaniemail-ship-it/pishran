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
      const capitalizationValues=new Set<string>()
      for(const row of datedRates){
        const effectiveDate=str(row,'effectiveDate'),annualRate=num(row,'annualRate')
        if(!validDate(effectiveDate)||annualRate===null){issues.push('loan-interest:'+row.id+': valid effective date and annual rate are required.');continue}
        loan.interestRateChanges.push({effectiveDate,annualRatePercent:annualRate})
        const capitalization=num(row,'capitalizePercent')
        if(capitalization!==null)capitalizationValues.add(String(capitalization))
        const until=str(row,'capitalizeUntil')
        if(until)capitalizationValues.add('until:'+until)
        for(const key of ['capitalizedInterestMethod','capitalizedInterestStart','capitalizedInterestRate','capitalizedInterestLength'])
          if(row.values[key]!==null&&row.values[key]!==undefined&&row.values[key]!=='')
            issues.push('loan-interest:'+row.id+': capitalized-interest amortization fields are not yet supported by the periodic loan adapter.')
      }
      if(capitalizationValues.size>2)issues.push('loan-interest:'+name+': capitalization settings conflict between rate rows.')
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

  const costRows=rows('production-costs')
  if(costRows.length){
    const costs=costRows.map(row=>{
      const cost=createBlankProductionCostFormDraft(row.id)
      const classification=str(row,'classification')
      const basis=str(row,'basis')
      const productId=str(row,'productId')
      if(classification!=='direct'&&classification!=='indirect')issues.push('production-costs:'+row.id+': cost classification is required.')
      if(!['nominal-capacity','per-unit-output','period-adjustments'].includes(basis))issues.push('production-costs:'+row.id+': valid cost basis is required.')
      required(productId,'production-costs:'+row.id+': product',issues)
      const fixedPercent=num(row,'fixedPercent'),variablePercent=num(row,'variablePercent')
      required(fixedPercent,'production-costs:'+row.id+': fixed share',issues)
      required(variablePercent,'production-costs:'+row.id+': variable share',issues)
      cost.metadata={...cost.metadata,description:str(row,'item'),currencyCode:str(row,'currency')||null,
        marketOrigin:str(row,'origin')==='foreign'?'foreign':str(row,'origin')==='local'?'local':null,
        costCentreId:str(row,'costCentreId')||null}
      cost.classification=classification==='direct'||classification==='indirect'?classification:null
      cost.productId=productId||null
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
      return cost
    })
    result.productionCosts=costs
    boundSections.push('production-costs')
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
        for(const [field,value] of [['sales quantity',salesQuantity],['net unit price',netUnitPrice],['sales tax',salesTaxPercent],['closing finished goods',closing]] as const)
          required(value,'sales-programme:'+row.id+': '+field,issues)
        if((subsidyPercent===null)===(subsidyAmount===null))
          issues.push('sales-programme:'+row.id+': provide exactly one subsidy basis (percentage or absolute amount).')
        return {period:period??str(row,'period'),salesQuantity,netUnitPrice,salesTaxPercent,
          subsidyPercent,subsidyAmount,finishedGoodsClosingQuantity:closing}
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
        required(amount,'working-capital:'+row.id+': required value',issues)
        return {period:period??str(row,'period'),amount}
      })
      const opening=num(first,'startingBalance')
      component.openingBalance=opening
      if(opening===null)issues.push('working-capital:'+first.id+': explicit opening balance is required.')
      const basis=str(first,'basis')
      component.valuationBasis=basis.includes('sold')?'cost-of-sales':basis.includes('produced')?'cost-of-production':'user-defined'
      component.minimumDaysCoverage=num(first,'daysCoverage')
      component.turnoverCoefficient=num(first,'turnover')
      return component
    })
    boundSections.push('working-capital')
  }

  return {drafts:result,issues,boundSections}
}
