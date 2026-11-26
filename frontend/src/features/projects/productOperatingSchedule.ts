import type { ProjectCalendarPeriod } from './projectFoundation'
import { fiscalYearIndexForPeriod } from '../steel/periodicFinancialEngine'
import type { ProjectModelFinancialFormDrafts, SalesProductFormDraft } from './projectModelFormDrafts'
import { buildInventoryFlowSchedule } from './inventoryProductionFlow'
import { validateWasteLedger, validateProductionTransfers } from './inventoryControlLedgers'

export type ProductOperatingPeriodRow = {
  productId: string
  period: number
  openingInventoryQuantity: number
  openingInventoryValue: number
  salesQuantity: number
  productionQuantity: number
  closingInventoryQuantity: number
  closingInventoryValue: number
  unitProductionCost: number
  productionCost: number
  weightedAverageUnitCost: number
  costOfSales: number
  netSalesRevenue: number
  subsidyIncome: number
  salesTaxPercent: number
  salesTaxSourceReference: string
  salesTaxSourceVerified: boolean
  taxableSales: number
  outputSalesTax: number
  grossProfit: number
  rawMaterialInventoryValue: number
  wipInventoryValue: number
  abnormalWasteValue: number
  abnormalWasteSourceReference: string
  abnormalWasteSourceVerified: boolean
  completedUnits: number
  hasInventoryFlow: boolean
  wipQuantity: number
  materialEquivalentUnits: number
  conversionEquivalentUnits: number
  materialCompletionPercent: number
  conversionCompletionPercent: number
}
export type ProductOperatingSchedule = {
  valid: boolean
  issues: string[]
  rows: ProductOperatingPeriodRow[]
  periodRevenue: number[]
  periodCostOfSales: number[]
  periodSubsidyIncome: number[]
  periodOutputSalesTax: number[]
  annualRevenue: number[]
  annualCostOfSales: number[]
  totalProductionQuantity: number
  totalSalesQuantity: number
  totalClosingInventoryValue: number
  periodRawMaterialInventoryValue: number[]
  periodWipInventoryValue: number[]
  periodAbnormalWasteExpense: number[]
  periodNormalWasteAbsorbed: number[]
  hasInventoryFlow: boolean
}

function comfarDaysInPeriod(period:ProjectCalendarPeriod):number {
  const start=new Date(period.startDate+'T00:00:00Z')
  const end=new Date(period.endDate+'T00:00:00Z')
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)return Number.NaN
  const months=(end.getUTCFullYear()-start.getUTCFullYear())*12+end.getUTCMonth()-start.getUTCMonth()+1
  const lastDay=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()+1,0)).getUTCDate()
  const fullMonths=start.getUTCDate()===1&&end.getUTCDate()===lastDay
  return fullMonths?30*months:period.days
}

/**
 * Builds product-by-product production, weighted-average finished-goods inventory,
 * cost of sales and net revenue. No missing quantity, opening inventory or unit-cost
 * input is silently replaced with zero. Sales tax/VAT is blocked until its separate
 * payable/receivable ledger is connected to the statements.
 */
export function buildProductOperatingSchedule(
  drafts: Pick<ProjectModelFinancialFormDrafts, 'sales' | 'productionCosts'> & Partial<Pick<ProjectModelFinancialFormDrafts, 'wasteLedgerEntries' | 'productionTransfers'>>,
  periods: ProjectCalendarPeriod[],
  fiscalYearStartMonth: number,
  baseCurrency: string,
): ProductOperatingSchedule {
  const issues: string[] = []
  const count = periods.length
  const empty = (): ProductOperatingSchedule => ({
    valid:false,issues,rows:[],periodRevenue:[],periodCostOfSales:[],periodSubsidyIncome:[],periodOutputSalesTax:[],
    annualRevenue:[],annualCostOfSales:[],totalProductionQuantity:0,
    totalSalesQuantity:0,totalClosingInventoryValue:0,periodRawMaterialInventoryValue:[],periodWipInventoryValue:[],periodAbnormalWasteExpense:[],periodNormalWasteAbsorbed:[],hasInventoryFlow:false,
  })
  if (!count) issues.push('At least one project period is required.')
  if (!Number.isInteger(fiscalYearStartMonth)||fiscalYearStartMonth<1||fiscalYearStartMonth>12)
    issues.push('Fiscal-year start month must be between 1 and 12.')
  if (!baseCurrency.trim()) issues.push('Project base currency is required.')
  if (!drafts.sales.length) issues.push('At least one product sales programme is required.')
  const wasteLedger=validateWasteLedger(drafts.wasteLedgerEntries??[],count)
  const transferLedger=validateProductionTransfers(drafts.productionTransfers??[],count)
  issues.push(...wasteLedger.issues,...transferLedger.issues)
  for(const entry of [...(drafts.wasteLedgerEntries??[])])if(!drafts.sales.some(sale=>sale.productId===entry.productId))issues.push('Waste entry '+entry.id+' references an unknown product.')
  for(const entry of [...(drafts.productionTransfers??[])])if(!drafts.sales.some(sale=>sale.productId===entry.sourceProductId)||!drafts.sales.some(sale=>sale.productId===entry.destinationProductId))issues.push('Transfer '+entry.id+' references an unknown product.')
  if (new Set(drafts.sales.map(item=>item.productId.trim())).size!==drafts.sales.length||
      drafts.sales.some(item=>!item.productId.trim()))
    issues.push('Product identifiers must be present and unique.')

  const periodAbnormalWasteExpense=Array(count).fill(0) as number[]
  const periodNormalWasteAbsorbed=Array(count).fill(0) as number[]
  for(const entry of drafts.wasteLedgerEntries??[]){
    const index=entry.period-1
    if(entry.classification==='normal'){
      const sale=drafts.sales.find(item=>item.productId===entry.productId)
      const periodRow=sale?.periods.find(row=>row.period===String(entry.period)||row.period===String(periods[index]?.index)||row.period===periods[index]?.startDate||row.period===periods[index]?.endDate)
      if(periodRow?.normalRawMaterialWasteQuantity!=null&&periodRow.normalRawMaterialWasteQuantity>0)
        issues.push('Normal waste '+entry.id+' is already represented in the production-flow waste quantity; duplicate absorption is blocked.')
      periodNormalWasteAbsorbed[index]+=entry.amount
    }else if(entry.classification==='abnormal'){
      const sale=drafts.sales.find(item=>item.productId===entry.productId)
      const periodRow=sale?.periods.find(row=>row.period===String(entry.period)||row.period===String(periods[index]?.index)||row.period===periods[index]?.startDate||row.period===periods[index]?.endDate)
      if(periodRow?.abnormalRawMaterialWasteQuantity!=null&&periodRow.abnormalRawMaterialWasteQuantity>0)
        issues.push('Abnormal waste '+entry.id+' is already represented in the production-flow waste quantity; duplicate expense is blocked.')
      periodAbnormalWasteExpense[index]+=entry.amount
    }
  }
  const unitCostByProduct = new Map<string,number>()
  const periodAdjustmentByProduct = new Map<string,Map<number,number>>()
  for (const cost of drafts.productionCosts) {
    if (!cost || !cost.id) { issues.push('Every production-cost item requires a stable identifier.'); continue }
    const entered = cost.metadata.description.trim()!=='' || cost.standardQuantity!==null ||
      cost.standardUnitPrice!==null || cost.standardTotal!==null || cost.nominalCapacity!==null ||
      cost.adjustments.length>0
    if (!entered) continue
    if (cost.classification!=='direct'||!cost.productId) {
      issues.push('Production-cost item '+cost.id+' must be directly assigned to a product; unallocated indirect costs are not spread by assumption.')
      continue
    }
    if (!drafts.sales.some(sale=>sale.productId===cost.productId)) {
      issues.push('Production-cost item '+cost.id+' references an unknown product.')
      continue
    }
    const currency=cost.metadata.currencyCode?.trim().toUpperCase()
    if(!currency){issues.push('Production-cost item '+cost.id+' requires an explicit currency code; project currency is not assumed.');continue}
    if (currency!==baseCurrency.trim().toUpperCase()) {
      issues.push('Production-cost item '+cost.id+' uses '+currency+'; convert it through the foreign-currency schedule before product costing.')
      continue
    }
    if ((cost.metadata.escalationPercent??0)!==0) {
      issues.push('Production-cost item '+cost.id+' has price escalation; a dated price-index schedule is required before applying it.')
      continue
    }
    let unitCost=Number.NaN
    if (cost.basis==='per-unit-output'&&cost.standardQuantity!==null&&cost.standardUnitPrice!==null)
      unitCost=cost.standardQuantity*cost.standardUnitPrice
    else if (cost.basis==='nominal-capacity'&&cost.standardTotal!==null&&cost.nominalCapacity!==null&&cost.nominalCapacity>0)
      unitCost=cost.standardTotal/cost.nominalCapacity
    else if(cost.basis==='period-adjustments')unitCost=0
    if (!Number.isFinite(unitCost)||unitCost<0) {
      issues.push('Production-cost item '+cost.id+' requires a supported per-unit-output, nominal-capacity or period-adjustments basis with complete non-negative values.')
      continue
    }
    unitCostByProduct.set(cost.productId,(unitCostByProduct.get(cost.productId)??0)+unitCost)
    if(cost.basis==='period-adjustments'&&!cost.adjustments.length)
      issues.push('Period-adjustment cost item '+cost.id+' requires at least one dated amount.')
    for(const adjustment of cost.adjustments){
      const matches:number[]=[]
      periods.forEach((period,index)=>{
        if(adjustment.period===String(index+1)||adjustment.period===String(period.index)||
          adjustment.period===period.startDate||adjustment.period===period.endDate)matches.push(index)
      })
      if(matches.length!==1){issues.push('Production-cost item '+cost.id+' has an unknown or ambiguous adjustment period: '+adjustment.period);continue}
      const hasUnit=adjustment.quantity!==null&&adjustment.unitPrice!==null
      const calculated=hasUnit?(adjustment.quantity as number)*(adjustment.unitPrice as number):null
      if(adjustment.total===null&&calculated===null||adjustment.total!==null&&(!Number.isFinite(adjustment.total)||adjustment.total<0)||
        calculated!==null&&(!Number.isFinite(calculated)||calculated<0)||
        adjustment.total!==null&&calculated!==null&&Math.abs(adjustment.total-calculated)>0.01){
        issues.push('Production-cost item '+cost.id+' has an incomplete or inconsistent adjustment in period '+(matches[0]+1)+'.')
        continue
      }
      const amount=adjustment.total??calculated as number
      const productAdjustments=periodAdjustmentByProduct.get(cost.productId)??new Map<number,number>()
      productAdjustments.set(matches[0],(productAdjustments.get(matches[0])??0)+amount)
      periodAdjustmentByProduct.set(cost.productId,productAdjustments)
    }
  }

  const periodRevenue=Array(count).fill(0) as number[]
  const periodCostOfSales=Array(count).fill(0) as number[]
  const periodSubsidyIncome=Array(count).fill(0) as number[]
  const periodOutputSalesTax=Array(count).fill(0) as number[]
  const periodRawMaterialInventoryValue=Array(count).fill(0) as number[]
  const periodWipInventoryValue=Array(count).fill(0) as number[]
  const rows:ProductOperatingPeriodRow[]=[]
  let totalProductionQuantity=0,totalSalesQuantity=0,totalClosingInventoryValue=0
  for (const sale of drafts.sales) {
    if(!sale.inventoryPolicy){
      issues.push('Product '+sale.productId+' must select manual inventory or COMFAR days-coverage production.')
      continue
    }
    let productionStartIndex=0,productionEndIndex=count-1
    if(sale.inventoryPolicy==='comfar-days-coverage'){
      if(sale.finishedGoodsDaysCoverage===null||!Number.isFinite(sale.finishedGoodsDaysCoverage)||sale.finishedGoodsDaysCoverage<0)
        issues.push('Product '+sale.productId+' requires non-negative finished-goods days coverage.')
      if(!Number.isInteger(sale.productionStartPeriod)||!Number.isInteger(sale.productionEndPeriod)||
        sale.productionStartPeriod===null||sale.productionEndPeriod===null||
        sale.productionStartPeriod<1||sale.productionEndPeriod<sale.productionStartPeriod||
        sale.productionEndPeriod>=count)
        issues.push('Product '+sale.productId+' production interval must be explicit and leave at least one project period for final stock liquidation.')
      else {productionStartIndex=sale.productionStartPeriod-1;productionEndIndex=sale.productionEndPeriod-1}
    }
    const mapped=new Map<number,SalesProductFormDraft['periods'][number]>()
    for (const row of sale.periods) {
      const matches:number[]=[]
      periods.forEach((period,index)=>{
        if(row.period===String(index+1)||row.period===String(period.index)||
          row.period===period.startDate||row.period===period.endDate)matches.push(index)
      })
      if(matches.length!==1) { issues.push('Product '+sale.productId+' has an unknown or ambiguous project period: '+row.period); continue }
      if(mapped.has(matches[0])) { issues.push('Product '+sale.productId+' has duplicate data for period '+(matches[0]+1)+'.'); continue }
      mapped.set(matches[0],row)
    }
    const flowKeys=['rawMaterialPurchasesQuantity','rawMaterialPurchasesValue','rawMaterialConsumptionQuantity','normalRawMaterialWasteQuantity','abnormalRawMaterialWasteQuantity','unitsStarted','unitsCompleted','closingWipQuantity','materialCompletionPercent','conversionCompletionPercent','conversionCost'] as const
    const flowEntered=sale.periods.some(row=>flowKeys.some(key=>row[key]!==null&&row[key]!==undefined))
    let inventoryFlow:ReturnType<typeof buildInventoryFlowSchedule>|null=null
    if(flowEntered){
      const flowRows=periods.map((_,index)=>mapped.get(index))
      if(flowRows.some(row=>!row||flowKeys.some(key=>row[key]===null||row[key]===undefined||!Number.isFinite(row[key] as number)))){
        issues.push('Product '+sale.productId+' requires complete purchase, consumption, production, WIP and conversion-cost inputs for every period.')
        continue
      }
      if(flowRows.some(row=>(row!.abnormalRawMaterialWasteQuantity as number)>0&&(!row!.abnormalWasteSourceReference?.trim()||row!.abnormalWasteSourceVerified!==true))){
        issues.push('Product '+sale.productId+' requires a verified abnormal-waste incident source reference for every period with abnormal waste.')
        continue
      }
      const first=mapped.get(0)
      if(!first||[first.openingRawMaterialQuantity,first.openingRawMaterialValue,first.openingWipQuantity,first.openingWipMaterialValue,first.openingWipConversionValue].some(v=>v===null||v===undefined||!Number.isFinite(v))){
        issues.push('Product '+sale.productId+' requires explicit opening raw-material and WIP quantity/value balances.')
        continue
      }
      inventoryFlow=buildInventoryFlowSchedule({
        openingRawMaterialQuantity:first.openingRawMaterialQuantity as number,
        openingRawMaterialValue:first.openingRawMaterialValue as number,
        rawMaterialPurchasesQuantity:flowRows.map(row=>row!.rawMaterialPurchasesQuantity as number),
        rawMaterialPurchasesValue:flowRows.map(row=>row!.rawMaterialPurchasesValue as number),
        rawMaterialConsumptionQuantity:flowRows.map(row=>row!.rawMaterialConsumptionQuantity as number),
        normalRawMaterialWasteQuantity:flowRows.map(row=>row!.normalRawMaterialWasteQuantity as number),
        abnormalRawMaterialWasteQuantity:flowRows.map(row=>row!.abnormalRawMaterialWasteQuantity as number),
        openingWipQuantity:first.openingWipQuantity as number,
        openingWipMaterialValue:first.openingWipMaterialValue as number,
        openingWipConversionValue:first.openingWipConversionValue as number,
        unitsStarted:flowRows.map(row=>row!.unitsStarted as number),
        unitsCompleted:flowRows.map(row=>row!.unitsCompleted as number),
        closingWipQuantity:flowRows.map(row=>row!.closingWipQuantity as number),
        materialCompletionPercent:flowRows.map(row=>row!.materialCompletionPercent as number),
        conversionCompletionPercent:flowRows.map(row=>row!.conversionCompletionPercent as number),
        conversionCost:flowRows.map(row=>row!.conversionCost as number),
      })
      if(!inventoryFlow.valid){issues.push(...inventoryFlow.issues.map(issue=>'Product '+sale.productId+': '+issue));continue}
    } else if(!unitCostByProduct.has(sale.productId)){
      issues.push('Product '+sale.productId+' requires either a validated direct production-cost basis or a complete inventory production flow.')
      continue
    }
    let previousClosingQuantity:number|null=null
    let previousClosingValue:number|null=null
    for(let index=0;index<count;index++) {
      const source=mapped.get(index)
      if(!source) { issues.push('Product '+sale.productId+' is missing period '+(index+1)+'.'); continue }
      const required=[source.salesQuantity,source.netUnitPrice,source.salesTaxPercent]
      if(required.some(value=>value===null||!Number.isFinite(value))||
        required.some(value=>(value as number)<0)) {
        issues.push('Product '+sale.productId+' requires non-negative sales quantity, price and explicit sales-tax rate in period '+(index+1)+'.')
        continue
      }
      const openingQuantity:number|null=index===0
        ?source.openingFinishedGoodsQuantity
        :sale.inventoryPolicy==='comfar-days-coverage'?previousClosingQuantity:source.openingFinishedGoodsQuantity
      const openingValue:number|null=index===0
        ?source.openingFinishedGoodsValue
        :(sale.inventoryPolicy==='comfar-days-coverage'||source.openingFinishedGoodsValue===null)?previousClosingValue:source.openingFinishedGoodsValue
      if(openingQuantity===null||openingValue===null||!Number.isFinite(openingQuantity)||!Number.isFinite(openingValue)||
        openingQuantity<0||openingValue<0){
        issues.push('Product '+sale.productId+' requires explicit opening inventory quantity and value in period '+(index+1)+'.')
        continue
      }
      const salesQuantity=source.salesQuantity as number
      if(sale.inventoryPolicy==='manual'&&
        (source.finishedGoodsClosingQuantity===null||!Number.isFinite(source.finishedGoodsClosingQuantity)||source.finishedGoodsClosingQuantity<0)){
        issues.push('Product '+sale.productId+' requires a non-negative manual closing inventory quantity in period '+(index+1)+'.')
        continue
      }
      let closingQuantity:number
      let productionQuantity:number
      if(sale.inventoryPolicy==='comfar-days-coverage'){
        const insideProduction=index>=productionStartIndex&&index<=productionEndIndex
        if(insideProduction){
          const periodDays=comfarDaysInPeriod(periods[index])
          if(!Number.isFinite(periodDays)||periodDays<=0){
            issues.push('Product '+sale.productId+' has an invalid period length for COMFAR finished-goods coverage.')
            continue
          }
          const requiredStock=salesQuantity*(sale.finishedGoodsDaysCoverage as number)/periodDays
          closingQuantity=Math.max(openingQuantity-salesQuantity,requiredStock)
          productionQuantity=salesQuantity-openingQuantity+closingQuantity
        }else{
          productionQuantity=0
          closingQuantity=openingQuantity-salesQuantity
          if(closingQuantity< -0.000001){
            issues.push('Product '+sale.productId+' sales exceed available finished-goods stock outside the production interval in period '+(index+1)+'.')
            continue
          }
        }
        if(index===count-1&&closingQuantity>0.000001){
          issues.push('Product '+sale.productId+' has unsold finished goods at the end of the model; add a liquidation period or extend sales until the closing stock is zero.')
          continue
        }
      }else{
        closingQuantity=source.finishedGoodsClosingQuantity as number
        productionQuantity=salesQuantity+closingQuantity-openingQuantity
      }
      let expectedOpeningQuantity=previousClosingQuantity??Number.NaN
      if(index>0){
        for(const transfer of drafts.productionTransfers??[]){
          if(transfer.period!==index)continue
          if(transfer.sourceProductId===sale.productId)expectedOpeningQuantity-=transfer.quantity
          if(transfer.destinationProductId===sale.productId)expectedOpeningQuantity+=transfer.quantity*transfer.conversionFactor
        }
      }
      // Quantity can be checked before transfer valuation. Value cannot: an inbound
      // transfer changes the recipient's weighted-average cost and revalues its
      // entire closing stock, not merely the transferred amount.
      if(index>0&&sale.inventoryPolicy==='manual'&&
        Math.abs((source.openingFinishedGoodsQuantity as number)-expectedOpeningQuantity)>0.000001){
        issues.push('Product '+sale.productId+' opening inventory quantity in period '+(index+1)+' must reconcile to the previous period closing quantity after inter-product transfers.')
        continue
      }
      if(source.subsidyPercent!=null&&(!Number.isFinite(source.subsidyPercent)||source.subsidyPercent<0||source.subsidyPercent>100)||
        source.subsidyAmount!=null&&(!Number.isFinite(source.subsidyAmount)||source.subsidyAmount<0)||
        (source.subsidyPercent??0)>0&&(source.subsidyAmount??0)>0) {
        issues.push('Product '+sale.productId+' subsidy must use one non-negative method (percentage or fixed amount) in period '+(index+1)+'.')
        continue
      }
      if(productionQuantity< -0.000001) {
        issues.push('Product '+sale.productId+' sales exceed opening inventory plus non-negative production in period '+(index+1)+'.')
        continue
      }
      const baseUnitProductionCost=unitCostByProduct.get(sale.productId) as number
      const periodAdjustment=(periodAdjustmentByProduct.get(sale.productId)?.get(index)??0)+
        (drafts.wasteLedgerEntries??[]).filter(entry=>entry.classification==='normal'&&entry.productId===sale.productId&&entry.period===index+1).reduce((sum,entry)=>sum+entry.amount,0)
      if(periodAdjustment>0&&productionQuantity<=0){issues.push('Product '+sale.productId+' has period production costs but no production quantity in period '+(index+1)+'.');continue}
      if(productionQuantity>0&&baseUnitProductionCost===0&&!periodAdjustmentByProduct.get(sale.productId)?.has(index)){
        issues.push('Product '+sale.productId+' has no production-cost amount for period '+(index+1)+'.');continue
      }
      const flowRow=inventoryFlow?.rows[index]
      if(flowRow&&Math.abs(flowRow.unitsCompleted-productionQuantity)>0.000001){issues.push('Product '+sale.productId+' completed production quantity must equal finished-goods production transfer in period '+(index+1)+'.');continue}
      const productionCost=flowRow?flowRow.completedProductionCost+periodAdjustment:Math.max(0,productionQuantity)*baseUnitProductionCost+periodAdjustment
      const unitProductionCost=productionQuantity>0?productionCost/productionQuantity:(unitCostByProduct.get(sale.productId)??0)
      const availableQuantity=openingQuantity+Math.max(0,productionQuantity)
      const availableValue:number=openingValue+productionCost
      if(availableQuantity<=0&&(salesQuantity>0||closingQuantity>0)) {
        issues.push('Product '+sale.productId+' has positive sales or closing inventory without available stock in period '+(index+1)+'.')
        continue
      }
      const weightedAverageUnitCost:number=availableQuantity>0?availableValue/availableQuantity:0
      const costOfSales=salesQuantity*weightedAverageUnitCost
      const closingInventoryValue:number=closingQuantity*weightedAverageUnitCost
      const baseRevenue=salesQuantity*(source.netUnitPrice as number)
      const subsidyIncome=source.subsidyPercent!=null
        ?baseRevenue*source.subsidyPercent/100
        :source.subsidyAmount??0
      const netSalesRevenue=baseRevenue+subsidyIncome
      // The declared sales-tax rate applies to the explicit tax-exclusive unit price;
      // subsidy is excluded from the taxable base until its legal treatment is sourced.
      const salesTaxPercent=source.salesTaxPercent as number
      const outputSalesTax=baseRevenue*salesTaxPercent/100
      const row:ProductOperatingPeriodRow={
        productId:sale.productId,period:index+1,openingInventoryQuantity:openingQuantity,
        openingInventoryValue:openingValue,salesQuantity,productionQuantity:Math.max(0,productionQuantity),
        closingInventoryQuantity:closingQuantity,closingInventoryValue,unitProductionCost,
        productionCost,weightedAverageUnitCost,costOfSales,netSalesRevenue,subsidyIncome,
        salesTaxPercent,salesTaxSourceReference:source.salesTaxSourceReference??'',salesTaxSourceVerified:source.salesTaxSourceVerified===true,
        taxableSales:baseRevenue,outputSalesTax,
        grossProfit:netSalesRevenue-costOfSales,
        rawMaterialInventoryValue:flowRow?.closingRawMaterialValue??0,
        wipInventoryValue:flowRow?.closingWipValue??0,
        abnormalWasteValue:flowRow?.abnormalWasteValue??0,
        abnormalWasteSourceReference:source.abnormalWasteSourceReference??'',
        abnormalWasteSourceVerified:source.abnormalWasteSourceVerified===true,
        completedUnits:flowRow?.unitsCompleted??productionQuantity,
        hasInventoryFlow:!!flowRow,
        wipQuantity:flowRow?.closingWipQuantity??0,
        materialEquivalentUnits:flowRow?.materialEquivalentUnits??0,
        conversionEquivalentUnits:flowRow?.conversionEquivalentUnits??0,
        materialCompletionPercent:flowRow?.closingWipQuantity?flowRow.materialEquivalentUnits===0?0:Math.max(0,Math.min(100,(flowRow.materialEquivalentUnits-flowRow.unitsCompleted)/flowRow.closingWipQuantity*100)):0,
        conversionCompletionPercent:flowRow?.closingWipQuantity?flowRow.conversionEquivalentUnits===0?0:Math.max(0,Math.min(100,(flowRow.conversionEquivalentUnits-flowRow.unitsCompleted)/flowRow.closingWipQuantity*100)):0,
      }
      rows.push(row)
      periodRevenue[index]+=netSalesRevenue
      periodCostOfSales[index]+=costOfSales
      periodSubsidyIncome[index]+=subsidyIncome
      periodOutputSalesTax[index]+=outputSalesTax
      totalProductionQuantity+=row.productionQuantity
      totalSalesQuantity+=salesQuantity
      totalClosingInventoryValue+=closingInventoryValue
      if(flowRow){periodRawMaterialInventoryValue[index]+=flowRow.closingRawMaterialValue;periodWipInventoryValue[index]+=flowRow.closingWipValue;periodNormalWasteAbsorbed[index]+=flowRow.normalWasteValue;periodAbnormalWasteExpense[index]+=flowRow.abnormalWasteValue}
      previousClosingQuantity=closingQuantity
      previousClosingValue=closingInventoryValue
    }
  }
  if(issues.length)return empty()
  // Reclassify transferred CPP from the source product/cost centre to the destination.
  // Quantity is retained as an audit/control quantity; value is the posted accounting amount.
  const transferredOutByProductPeriod=new Map<string,number>()
  const transferredOutQuantityByProductPeriod=new Map<string,number>()
  const sourceClosingQuantityByProductPeriod=new Map<string,number>()
  const sourceCostByProductPeriod=new Map<string,number>()
  for(const transfer of drafts.productionTransfers??[]){
    const source=rows.find(row=>row.productId===transfer.sourceProductId&&row.period===transfer.period)
    const destination=rows.find(row=>row.productId===transfer.destinationProductId&&row.period===transfer.period)
    const sourceProduct=drafts.sales.find(item=>item.productId===transfer.sourceProductId)
    const destinationProduct=drafts.sales.find(item=>item.productId===transfer.destinationProductId)
    if(!source||!destination){issues.push('Transfer '+transfer.id+' requires source and destination product rows in the same period.');continue}
    if(!sourceProduct?.unitOfMeasure?.trim()||sourceProduct.unitOfMeasure.trim()!==transfer.sourceUnit.trim())issues.push('Transfer '+transfer.id+' source unit must match the declared base unit of product '+transfer.sourceProductId+'.')
    if(!destinationProduct?.unitOfMeasure?.trim()||destinationProduct.unitOfMeasure.trim()!==transfer.destinationUnit.trim())issues.push('Transfer '+transfer.id+' destination unit must match the declared base unit of product '+transfer.destinationProductId+'.')
    const sourceKey=transfer.sourceProductId+':'+transfer.period
    if(!sourceCostByProductPeriod.has(sourceKey))sourceCostByProductPeriod.set(sourceKey,source.productionCost)
    if(!sourceClosingQuantityByProductPeriod.has(sourceKey))sourceClosingQuantityByProductPeriod.set(sourceKey,source.closingInventoryQuantity)
    const alreadyTransferred=transferredOutByProductPeriod.get(sourceKey)??0
    const alreadyTransferredQuantity=transferredOutQuantityByProductPeriod.get(sourceKey)??0
    const destinationQuantity=transfer.quantity*transfer.conversionFactor
    if((sourceClosingQuantityByProductPeriod.get(sourceKey) as number)+0.01<alreadyTransferredQuantity+transfer.quantity){issues.push('Transfer '+transfer.id+' exceeds the source product finished-goods quantity available for transfer.');continue}
    const sourceAvailableQuantity=source.openingInventoryQuantity+source.productionQuantity
    const sourceAvailableValue=source.openingInventoryValue+(sourceCostByProductPeriod.get(sourceKey) as number)
    if(transfer.costAmount>sourceAvailableValue-alreadyTransferred+0.01){issues.push('Transfer '+transfer.id+' exceeds the remaining source product inventory value available for reclassification.');continue}
    const sourceWeightedAverage=sourceAvailableQuantity>0?sourceAvailableValue/sourceAvailableQuantity:0
    const expectedTransferValue=transfer.quantity*sourceWeightedAverage
    if(Math.abs(transfer.costAmount-expectedTransferValue)>0.01*Math.max(1,Math.abs(expectedTransferValue))){issues.push('Transfer '+transfer.id+' cost must equal transferred source quantity multiplied by the source weighted-average inventory cost.');continue}
    transferredOutByProductPeriod.set(sourceKey,alreadyTransferred+transfer.costAmount)
    transferredOutQuantityByProductPeriod.set(sourceKey,alreadyTransferredQuantity+transfer.quantity)
    // The schedule is product-level, not cost-centre-level. A transfer between
    // centres of the same product is an internal reclassification and must not
    // manufacture additional product output or alter aggregate inventory/COGS.
    if(transfer.sourceProductId===transfer.destinationProductId)continue
    source.closingInventoryQuantity-=transfer.quantity
    destination.productionQuantity+=destinationQuantity
    destination.completedUnits+=destinationQuantity
    destination.closingInventoryQuantity+=destinationQuantity
    source.productionCost-=transfer.costAmount
    destination.productionCost+=transfer.costAmount
    for(const row of [source,destination]){
      row.unitProductionCost=row.productionQuantity>0?row.productionCost/row.productionQuantity:row.unitProductionCost
      const availableQty=row.openingInventoryQuantity+row.productionQuantity
      const grossSourceCost=row.productId===transfer.sourceProductId?(sourceCostByProductPeriod.get(sourceKey) as number):row.productionCost
      const availableValue=row.openingInventoryValue+grossSourceCost
      row.weightedAverageUnitCost=availableQty>0?availableValue/availableQty:0
      row.costOfSales=row.salesQuantity*row.weightedAverageUnitCost
      row.closingInventoryValue=row.closingInventoryQuantity*row.weightedAverageUnitCost
      row.grossProfit=row.netSalesRevenue-row.costOfSales
    }
  }
  // Carry transferred closing-stock value into the next period's opening balance,
  // then revalue subsequent sales and closing stock using the revised weighted average.
  for(const productId of drafts.sales.map(item=>item.productId)){
    const productRows=rows.filter(row=>row.productId===productId).sort((a,b)=>a.period-b.period)
    for(let index=1;index<productRows.length;index++){
      const previous=productRows[index-1],current=productRows[index]
      current.openingInventoryQuantity=previous.closingInventoryQuantity
      if(drafts.sales.find(item=>item.productId===productId)?.inventoryPolicy==='manual'&&
         Math.abs(current.openingInventoryValue-previous.closingInventoryValue)>0.01){
        issues.push('Product '+productId+' opening inventory value in period '+current.period+' must reconcile to the prior-period closing value after weighted-average transfer revaluation.')
      }
      current.openingInventoryValue=previous.closingInventoryValue
      const availableQuantity=current.openingInventoryQuantity+current.productionQuantity
      const availableValue=current.openingInventoryValue+current.productionCost
      current.weightedAverageUnitCost=availableQuantity>0?availableValue/availableQuantity:0
      current.costOfSales=current.salesQuantity*current.weightedAverageUnitCost
      current.closingInventoryValue=current.closingInventoryQuantity*current.weightedAverageUnitCost
      current.grossProfit=current.netSalesRevenue-current.costOfSales
    }
  }
  if(issues.length)return empty()
  periodCostOfSales.fill(0)
  totalProductionQuantity=rows.reduce((sum,row)=>sum+row.productionQuantity,0)
  totalClosingInventoryValue=0
  for(const row of rows){periodCostOfSales[row.period-1]+=row.costOfSales;totalClosingInventoryValue+=row.closingInventoryValue}
  const fiscalYearCount=Math.max(...periods.map(period=>fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)))+1
  const annualRevenue=Array(fiscalYearCount).fill(0) as number[]
  const annualCostOfSales=Array(fiscalYearCount).fill(0) as number[]
  periods.forEach((period,index)=>{
    const year=fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)
    if(year<0||year>=fiscalYearCount)issues.push('Project period '+(index+1)+' is outside the fiscal-year model horizon.')
    else {annualRevenue[year]+=periodRevenue[index];annualCostOfSales[year]+=periodCostOfSales[index]}
  })
  if(issues.length)return empty()
  return {valid:true,issues:[],rows,periodRevenue,periodCostOfSales,periodSubsidyIncome,periodOutputSalesTax,annualRevenue,annualCostOfSales,
    totalProductionQuantity,totalSalesQuantity,totalClosingInventoryValue,periodRawMaterialInventoryValue,periodWipInventoryValue,periodAbnormalWasteExpense,periodNormalWasteAbsorbed,hasInventoryFlow:rows.some(row=>row.rawMaterialInventoryValue>0||row.wipInventoryValue>0)||salesHaveInventoryFlow(drafts.sales)}
}

function salesHaveInventoryFlow(sales:SalesProductFormDraft[]):boolean{return sales.some(sale=>sale.periods.some(row=>row.rawMaterialPurchasesQuantity!=null||row.rawMaterialPurchasesValue!=null||row.rawMaterialConsumptionQuantity!=null||row.normalRawMaterialWasteQuantity!=null||row.abnormalRawMaterialWasteQuantity!=null||row.unitsStarted!=null||row.unitsCompleted!=null||row.closingWipQuantity!=null||row.conversionCost!=null))}
