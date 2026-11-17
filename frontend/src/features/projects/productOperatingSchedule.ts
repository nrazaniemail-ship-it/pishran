import type { ProjectCalendarPeriod } from './projectFoundation'
import { fiscalYearIndexForPeriod } from '../steel/periodicFinancialEngine'
import type { ProjectModelFinancialFormDrafts, SalesProductFormDraft } from './projectModelFormDrafts'

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
  grossProfit: number
}
export type ProductOperatingSchedule = {
  valid: boolean
  issues: string[]
  rows: ProductOperatingPeriodRow[]
  periodRevenue: number[]
  periodCostOfSales: number[]
  annualRevenue: number[]
  annualCostOfSales: number[]
  totalProductionQuantity: number
  totalSalesQuantity: number
  totalClosingInventoryValue: number
}

/**
 * Builds product-by-product production, weighted-average finished-goods inventory,
 * cost of sales and net revenue. No missing quantity, opening inventory or unit-cost
 * input is silently replaced with zero. Sales tax/VAT is blocked until its separate
 * payable/receivable ledger is connected to the statements.
 */
export function buildProductOperatingSchedule(
  drafts: Pick<ProjectModelFinancialFormDrafts, 'sales' | 'productionCosts'>,
  periods: ProjectCalendarPeriod[],
  fiscalYearStartMonth: number,
  baseCurrency: string,
): ProductOperatingSchedule {
  const issues: string[] = []
  const count = periods.length
  const empty = (): ProductOperatingSchedule => ({
    valid:false,issues,rows:[],periodRevenue:[],periodCostOfSales:[],
    annualRevenue:[],annualCostOfSales:[],totalProductionQuantity:0,
    totalSalesQuantity:0,totalClosingInventoryValue:0,
  })
  if (!count) issues.push('At least one project period is required.')
  if (!Number.isInteger(fiscalYearStartMonth)||fiscalYearStartMonth<1||fiscalYearStartMonth>12)
    issues.push('Fiscal-year start month must be between 1 and 12.')
  if (!baseCurrency.trim()) issues.push('Project base currency is required.')
  if (!drafts.sales.length) issues.push('At least one product sales programme is required.')
  if (new Set(drafts.sales.map(item=>item.productId.trim())).size!==drafts.sales.length||
      drafts.sales.some(item=>!item.productId.trim()))
    issues.push('Product identifiers must be present and unique.')

  const unitCostByProduct = new Map<string,number>()
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
    if (currency&&currency!==baseCurrency.trim().toUpperCase()) {
      issues.push('Production-cost item '+cost.id+' uses '+currency+'; convert it through the foreign-currency schedule before product costing.')
      continue
    }
    if ((cost.metadata.escalationPercent??0)!==0) {
      issues.push('Production-cost item '+cost.id+' has price escalation; a dated price-index schedule is required before applying it.')
      continue
    }
    if (cost.adjustments.length) {
      issues.push('Production-cost item '+cost.id+' contains period adjustments; the adjustment basis must be explicitly normalized before product costing.')
      continue
    }
    let unitCost=Number.NaN
    if (cost.basis==='per-unit-output'&&cost.standardQuantity!==null&&cost.standardUnitPrice!==null)
      unitCost=cost.standardQuantity*cost.standardUnitPrice
    else if (cost.basis==='nominal-capacity'&&cost.standardTotal!==null&&cost.nominalCapacity!==null&&cost.nominalCapacity>0)
      unitCost=cost.standardTotal/cost.nominalCapacity
    if (!Number.isFinite(unitCost)||unitCost<0) {
      issues.push('Production-cost item '+cost.id+' requires a supported per-unit-output or nominal-capacity basis with complete non-negative values.')
      continue
    }
    unitCostByProduct.set(cost.productId,(unitCostByProduct.get(cost.productId)??0)+unitCost)
  }

  const periodRevenue=Array(count).fill(0) as number[]
  const periodCostOfSales=Array(count).fill(0) as number[]
  const rows:ProductOperatingPeriodRow[]=[]
  let totalProductionQuantity=0,totalSalesQuantity=0,totalClosingInventoryValue=0
  for (const sale of drafts.sales) {
    if (!unitCostByProduct.has(sale.productId)) {
      issues.push('Product '+sale.productId+' has no validated direct production-cost basis.')
      continue
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
    let previousClosingQuantity:number|null=null
    let previousClosingValue:number|null=null
    for(let index=0;index<count;index++) {
      const source=mapped.get(index)
      if(!source) { issues.push('Product '+sale.productId+' is missing period '+(index+1)+'.'); continue }
      const required=[source.salesQuantity,source.netUnitPrice,source.finishedGoodsClosingQuantity,
        source.openingFinishedGoodsQuantity,source.openingFinishedGoodsValue]
      if(required.some(value=>value===null||!Number.isFinite(value))||
        required.some(value=>(value as number)<0)) {
        issues.push('Product '+sale.productId+' requires non-negative sales, price, opening/closing inventory quantities and opening inventory value in period '+(index+1)+'.')
        continue
      }
      const openingQuantity=source.openingFinishedGoodsQuantity as number
      const openingValue=source.openingFinishedGoodsValue as number
      const salesQuantity=source.salesQuantity as number
      const closingQuantity=source.finishedGoodsClosingQuantity as number
      if(index>0&&(Math.abs(openingQuantity-(previousClosingQuantity??Number.NaN))>0.000001||
        Math.abs(openingValue-(previousClosingValue??Number.NaN))>0.01)) {
        issues.push('Product '+sale.productId+' opening inventory in period '+(index+1)+' must reconcile to the previous period closing inventory.')
        continue
      }
      if((source.salesTaxPercent??0)!==0) {
        issues.push('Product '+sale.productId+' has sales tax/VAT in period '+(index+1)+'; tax payable/receivable posting is not yet connected.')
        continue
      }
      if(source.subsidyPercent!==null&&(!Number.isFinite(source.subsidyPercent)||source.subsidyPercent<0||source.subsidyPercent>100)||
        source.subsidyAmount!==null&&(!Number.isFinite(source.subsidyAmount)||source.subsidyAmount<0)||
        (source.subsidyPercent??0)>0&&(source.subsidyAmount??0)>0) {
        issues.push('Product '+sale.productId+' subsidy must use one non-negative method (percentage or fixed amount) in period '+(index+1)+'.')
        continue
      }
      const productionQuantity=salesQuantity+closingQuantity-openingQuantity
      if(productionQuantity< -0.000001) {
        issues.push('Product '+sale.productId+' sales exceed opening inventory plus non-negative production in period '+(index+1)+'.')
        continue
      }
      const unitProductionCost=unitCostByProduct.get(sale.productId) as number
      const productionCost=Math.max(0,productionQuantity)*unitProductionCost
      const availableQuantity=openingQuantity+Math.max(0,productionQuantity)
      const availableValue=openingValue+productionCost
      if(availableQuantity<=0&&(salesQuantity>0||closingQuantity>0)) {
        issues.push('Product '+sale.productId+' has positive sales or closing inventory without available stock in period '+(index+1)+'.')
        continue
      }
      const weightedAverageUnitCost=availableQuantity>0?availableValue/availableQuantity:0
      const costOfSales=salesQuantity*weightedAverageUnitCost
      const closingInventoryValue=closingQuantity*weightedAverageUnitCost
      const baseRevenue=salesQuantity*(source.netUnitPrice as number)
      const subsidyIncome=source.subsidyPercent!==null
        ?baseRevenue*source.subsidyPercent/100
        :source.subsidyAmount??0
      const netSalesRevenue=baseRevenue+subsidyIncome
      const row:ProductOperatingPeriodRow={
        productId:sale.productId,period:index+1,openingInventoryQuantity:openingQuantity,
        openingInventoryValue:openingValue,salesQuantity,productionQuantity:Math.max(0,productionQuantity),
        closingInventoryQuantity:closingQuantity,closingInventoryValue,unitProductionCost,
        productionCost,weightedAverageUnitCost,costOfSales,netSalesRevenue,subsidyIncome,
        grossProfit:netSalesRevenue-costOfSales,
      }
      rows.push(row)
      periodRevenue[index]+=netSalesRevenue
      periodCostOfSales[index]+=costOfSales
      totalProductionQuantity+=row.productionQuantity
      totalSalesQuantity+=salesQuantity
      totalClosingInventoryValue+=closingInventoryValue
      previousClosingQuantity=closingQuantity
      previousClosingValue=closingInventoryValue
    }
  }
  if(issues.length)return empty()
  const fiscalYearCount=Math.max(...periods.map(period=>fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)))+1
  const annualRevenue=Array(fiscalYearCount).fill(0) as number[]
  const annualCostOfSales=Array(fiscalYearCount).fill(0) as number[]
  periods.forEach((period,index)=>{
    const year=fiscalYearIndexForPeriod(period,periods,fiscalYearStartMonth)
    if(year<0||year>=fiscalYearCount)issues.push('Project period '+(index+1)+' is outside the fiscal-year model horizon.')
    else {annualRevenue[year]+=periodRevenue[index];annualCostOfSales[year]+=periodCostOfSales[index]}
  })
  if(issues.length)return empty()
  return {valid:true,issues:[],rows,periodRevenue,periodCostOfSales,annualRevenue,annualCostOfSales,
    totalProductionQuantity,totalSalesQuantity,totalClosingInventoryValue}
}
