import type { ProjectCalendarPeriod } from './projectFoundation'
import type { PeriodicProjectFinanceInput } from '../steel/periodicFinancialEngine'
import { fiscalYearIndexForPeriod } from '../steel/periodicFinancialEngine'
import { calculateHelpNominalCapacityCost, calculateHelpPerUnitOutputCost } from './projectModelHelpFormulaRules'
import type { ProductionCostFormDraft, ProjectModelFinancialFormDrafts, SalesProductFormDraft } from './projectModelFormDrafts'

export type ProductPeriodOperatingRow = {
  productId: string
  period: number
  salesQuantity: number
  productionQuantity: number
  openingFinishedGoodsQuantity: number
  closingFinishedGoodsQuantity: number
  baseSalesRevenue: number
  salesTax: number
  subsidy: number
  recognizedRevenue: number
  directVariableCost: number
  directFixedCost: number
  indirectVariableCost: number
  indirectFixedCost: number
  totalProductionCost: number
  costOfGoodsSold: number
  closingFinishedGoodsValue: number
}

export type ProductionSalesInventorySchedule = {
  valid: boolean
  issues: string[]
  rows: ProductPeriodOperatingRow[]
  annualRevenue: number[]
  annualVariableCost: number[]
  annualFixedCost: number[]
  annualCostOfGoodsSold: number[]
  periodRevenue: number[]
  periodProductionCost: number[]
  periodSalesQuantity: number[]
  periodProductionQuantity: number[]
  periodCostOfGoodsSold: number[]
  periodClosingFinishedGoodsValue: number[]
  openingFinishedGoodsValueByProduct: Record<string, number>
  closingFinishedGoodsQuantityByProduct: Record<string, number[]>
}

export type ProductionSalesFinanceBinding = {
  valid: boolean
  issues: string[]
  financeInput: PeriodicProjectFinanceInput | null
  schedule: ProductionSalesInventorySchedule
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const nonNegative = (x: unknown): x is number => finite(x) && x >= 0

function resolvePeriod(key: string, periods: ProjectCalendarPeriod[]): number[] {
  const result: number[] = []
  periods.forEach((period, index) => {
    if (key === String(index + 1) || key === String(period.index) ||
        key === period.startDate || key === period.endDate ||
        (key.length === 7 && key === period.startDate.slice(0, 7) && key === period.endDate.slice(0, 7))) result.push(index)
  })
  return result
}

function periodMonths(period: ProjectCalendarPeriod): number {
  const start = new Date(period.startDate + 'T00:00:00.000Z')
  const end = new Date(period.endDate + 'T00:00:00.000Z')
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return Number.NaN
  const whole = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth()
  const months = whole + (end.getUTCDate() - start.getUTCDate() + 1) / 30
  return Math.min(12, Math.max(1 / 30, months))
}

function validCalendar(periods: ProjectCalendarPeriod[]): string[] {
  const issues: string[] = []
  if (!periods.length) return ['At least one project period is required.']
  periods.forEach((p, i) => {
    const start = new Date(p.startDate + 'T00:00:00.000Z')
    const end = new Date(p.endDate + 'T00:00:00.000Z')
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
        !Number.isInteger(p.days) || p.days <= 0 || end < start ||
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1 !== p.days) {
      issues.push('Invalid project calendar period ' + (i + 1) + '.')
    }
    if (i > 0) {
      const previous = new Date(periods[i - 1].endDate + 'T00:00:00.000Z').getTime()
      if (start.getTime() !== previous + 86400000) issues.push('Project periods are not contiguous at period ' + (i + 1) + '.')
    }
  })
  return issues
}

function resolveRows<T extends {period:string}>(rows:T[], periods:ProjectCalendarPeriod[], label:string, issues:string[]):Map<number,T> {
  const result = new Map<number,T>()
  rows.forEach(row => {
    const matches = resolvePeriod(row.period, periods)
    if (matches.length !== 1) {
      issues.push(label + (matches.length ? ' has an ambiguous period key: ' : ' has an unknown period key: ') + row.period)
      return
    }
    const index = matches[0]
    if (result.has(index)) {
      issues.push(label + ' has duplicate data for period ' + (index + 1) + '.')
      return
    }
    result.set(index, row)
  })
  return result
}

/**
 * Reconcile product sales, production and finished-goods quantities period by period.
 * Opening finished-goods quantities must be explicitly supplied; a missing value is
 * never silently assumed to be zero. Closing quantities are read from the sales form.
 */
export function buildProductionSalesInventorySchedule(
  drafts: Pick<ProjectModelFinancialFormDrafts, 'sales' | 'productionCosts'>,
  periods: ProjectCalendarPeriod[],
  fiscalYearStartMonth: number,
  openingFinishedGoodsByProduct: Record<string, number>,
  openingFinishedGoodsValueByProduct: Record<string, number> = {},
): ProductionSalesInventorySchedule {
  const issues = validCalendar(periods)
  const empty = (): ProductionSalesInventorySchedule => ({
    valid:false,issues,rows:[],annualRevenue:[],annualVariableCost:[],annualFixedCost:[],annualCostOfGoodsSold:[],
    periodRevenue:[],periodProductionCost:[],periodSalesQuantity:[],periodProductionQuantity:[],
    periodCostOfGoodsSold:[],periodClosingFinishedGoodsValue:[],openingFinishedGoodsValueByProduct:{},
    closingFinishedGoodsQuantityByProduct:{},
  })
  if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12)
    issues.push('Fiscal-year start month must be between 1 and 12.')
  const productIds = drafts.sales.map(x=>x.productId)
  if (productIds.some(x=>!x) || new Set(productIds).size !== productIds.length)
    issues.push('Sales product identifiers must be present and unique.')
  const fiscalIndexes = periods.map(p=>fiscalYearIndexForPeriod(p,periods,fiscalYearStartMonth))
  if (fiscalIndexes.some(x=>x<0)) issues.push('Could not map every period to a fiscal year.')
  const yearCount = Math.max(0,...fiscalIndexes)+1
  const annualRevenue=Array(yearCount).fill(0) as number[]
  const annualVariableCost=Array(yearCount).fill(0) as number[]
  const annualFixedCost=Array(yearCount).fill(0) as number[]
  const annualCostOfGoodsSold=Array(yearCount).fill(0) as number[]
  const periodRevenue=Array(periods.length).fill(0) as number[]
  const periodProductionCost=Array(periods.length).fill(0) as number[]
  const periodSalesQuantity=Array(periods.length).fill(0) as number[]
  const periodProductionQuantity=Array(periods.length).fill(0) as number[]
  const periodCostOfGoodsSold=Array(periods.length).fill(0) as number[]
  const periodClosingFinishedGoodsValue=Array(periods.length).fill(0) as number[]
  const rows:ProductPeriodOperatingRow[]=[]
  const closingFinishedGoodsQuantityByProduct:Record<string,number[]>={}
  const openingFinishedGoodsValueByProductResolved:Record<string,number>={}
  const salesByProduct=new Map<string,Map<number,SalesProductFormDraft['periods'][number]>>()
  for (const product of drafts.sales) {
    const map=resolveRows(product.periods,periods,'Sales for product '+product.productId,issues)
    if (map.size!==periods.length) issues.push('Sales and closing finished-goods data must be provided for every period for product '+product.productId+'.')
    salesByProduct.set(product.productId,map)
    const openingQuantity=openingFinishedGoodsByProduct[product.productId]??product.openingFinishedGoodsQuantity
    if (!nonNegative(openingQuantity))
      issues.push('Explicit opening finished-goods quantity is required for product '+product.productId+'.')
    const openingValue=openingFinishedGoodsValueByProduct[product.productId]??product.openingFinishedGoodsValue
    if(openingValue!==undefined&&openingValue!==null&&!nonNegative(openingValue))
      issues.push('Opening finished-goods carrying value must be finite and non-negative for product '+product.productId+'.')
    if(nonNegative(openingQuantity)&&openingQuantity>1e-8&&!nonNegative(openingValue))
      issues.push('Explicit opening finished-goods carrying value is required when opening quantity is positive for product '+product.productId+'.')
    if(nonNegative(openingQuantity)&&openingQuantity<=1e-8&&openingValue!=null&&nonNegative(openingValue)&&openingValue>0.01)
      issues.push('Opening finished-goods value cannot exist without opening quantity for product '+product.productId+'.')
    openingFinishedGoodsValueByProductResolved[product.productId]=nonNegative(openingValue)?openingValue:0
  }
  const costRowsByPeriod=new Map<ProductionCostFormDraft,Map<number,ProductionCostFormDraft['adjustments'][number]>>()
  for (const cost of drafts.productionCosts) {
    if (!cost.id || !cost.productId || !productIds.includes(cost.productId))
      issues.push('Every production-cost item must identify an existing product: '+(cost.id||'(missing id)')+'.')
    if (cost.classification !== 'direct' && cost.classification !== 'indirect')
      issues.push('Cost classification is required for item '+cost.id+'.')
    if (cost.classification === 'indirect' && !cost.allocationKeyId)
      issues.push('Indirect production cost '+cost.id+' must be expanded by a validated user-defined allocation key before product-level costing.')
    if (!cost.basis) issues.push('Cost calculation basis is required for item '+cost.id+'.')
    if (cost.fixedPercent===null || cost.variablePercent===null ||
        !nonNegative(cost.fixedPercent) || !nonNegative(cost.variablePercent) ||
        Math.abs(cost.fixedPercent+cost.variablePercent-100)>1e-8)
      issues.push('Fixed and variable shares must be explicitly supplied and total 100% for item '+cost.id+'.')
    costRowsByPeriod.set(cost,resolveRows(cost.adjustments,periods,'Cost adjustment '+cost.id,issues))
  }
  for(const product of drafts.sales){
    const opening=openingFinishedGoodsByProduct[product.productId]??product.openingFinishedGoodsQuantity??0
    const salesMap=salesByProduct.get(product.productId)
    const hasClosingStock=Array.from(salesMap?.values()??[]).some(row=>(row.finishedGoodsClosingQuantity??0)>1e-8)
    if((opening>1e-8||hasClosingStock)&&product.inventoryValuationMethod!=='fifo'&&product.inventoryValuationMethod!=='weighted-average')
      issues.push('An explicit FIFO or weighted-average finished-goods valuation method is required for product '+product.productId+'.')
  }
  if (issues.length) return empty()

  const openingByProduct={...openingFinishedGoodsByProduct}
  const closingByProduct:Record<string,number[]>={}
  for (const product of drafts.sales) {
    let opening=openingByProduct[product.productId]??product.openingFinishedGoodsQuantity??Number.NaN
    const productClosings:number[]=[]
    const salesMap=salesByProduct.get(product.productId)!
    for (let i=0;i<periods.length;i++) {
      const sales=salesMap.get(i)!
      const required=[sales.salesQuantity,sales.netUnitPrice,sales.finishedGoodsClosingQuantity]
      if (!required.every(nonNegative) || sales.salesTaxPercent===null ||
          (sales.subsidyPercent===null&&sales.subsidyAmount===null) ||
          (sales.subsidyPercent!==null&&sales.subsidyAmount!==null) ||
          (sales.salesTaxPercent!==null && (!nonNegative(sales.salesTaxPercent)||sales.salesTaxPercent>100)) ||
          (sales.subsidyPercent!==null && (!nonNegative(sales.subsidyPercent)||sales.subsidyPercent>100)) ||
          (sales.subsidyAmount!==null && !nonNegative(sales.subsidyAmount))) {
        issues.push('Sales quantity, net price and closing stock (plus valid tax/subsidy) are required for '+product.productId+' period '+(i+1)+'.')
        continue
      }
      const closing=sales.finishedGoodsClosingQuantity as number
      const production=sales.salesQuantity as number + closing - opening
      if (sales.grossUnitPrice != null) {
        if (!nonNegative(sales.grossUnitPrice)) {
          issues.push('Gross unit price must be finite and non-negative for '+product.productId+' period '+(i+1)+'.')
          continue
        }
        const expectedGrossUnitPrice=(sales.netUnitPrice as number)*(1+(sales.salesTaxPercent as number)/100)
        if (Math.abs((sales.grossUnitPrice as number)-expectedGrossUnitPrice)>0.01) {
          issues.push('Gross unit price must reconcile to net unit price plus sales tax for '+product.productId+' period '+(i+1)+'.')
          continue
        }
      }
      if (sales.productionActive === false && Math.abs(production)>1e-8) {
        issues.push('Production is marked inactive but the inventory roll-forward requires production for '+product.productId+' period '+(i+1)+'.')
        continue
      }
      if (production < -1e-8) {
        issues.push('Sales exceed opening stock plus production for '+product.productId+' period '+(i+1)+'.')
        continue
      }
      const quantity=sales.salesQuantity as number
      const baseRevenue=quantity*(sales.netUnitPrice as number)
      const salesTax=baseRevenue*(sales.salesTaxPercent??0)/100
      const subsidy=(sales.subsidyAmount??(baseRevenue*(sales.subsidyPercent??0)/100))
      const recognizedRevenue=baseRevenue+subsidy
      const year=fiscalIndexes[i]
      annualRevenue[year]+=recognizedRevenue
      periodRevenue[i]+=recognizedRevenue
      periodSalesQuantity[i]+=quantity
      periodProductionQuantity[i]+=Math.max(0,production)
      productClosings.push(closing)
      rows.push({
        productId:product.productId,period:i+1,salesQuantity:quantity,
        productionQuantity:Math.max(0,production),openingFinishedGoodsQuantity:opening,
        closingFinishedGoodsQuantity:closing,baseSalesRevenue:baseRevenue,salesTax,subsidy,
        recognizedRevenue,directVariableCost:0,directFixedCost:0,indirectVariableCost:0,
        indirectFixedCost:0,totalProductionCost:0,costOfGoodsSold:0,closingFinishedGoodsValue:0,
      })
      opening=closing
    }
    closingByProduct[product.productId]=productClosings
  }

  const rowLookup=new Map(rows.map(r=>[r.productId+'|'+r.period,r]))
  for (const cost of drafts.productionCosts) {
    const product=cost.productId as string
    const adjustments=costRowsByPeriod.get(cost)!
    for (let i=0;i<periods.length;i++) {
      const operating=rowLookup.get(product+'|'+(i+1))
      if (!operating) continue
      const months=periodMonths(periods[i])
      const adjustment=adjustments.get(i)
      let fixed=0,variable=0
      try {
        if (cost.basis==='nominal-capacity') {
          if (![cost.standardQuantity,cost.standardUnitPrice,cost.nominalCapacity].every(nonNegative) ||
              cost.nominalCapacity===0 || cost.fixedPercent===null || cost.variablePercent===null) throw new Error('incomplete nominal-capacity basis')
          const calc=calculateHelpNominalCapacityCost({
            standardQuantity:cost.standardQuantity as number,standardUnitPrice:cost.standardUnitPrice as number,
            nominalCapacity:cost.nominalCapacity as number,activityVolume:operating.productionQuantity,
            activityBasis:'production',fixedPercent:cost.fixedPercent,variablePercent:cost.variablePercent,
            periodMonths:months,adjustmentQuantity:adjustment?.quantity??0,adjustmentUnitPrice:adjustment?.unitPrice??0,
            adjustmentFixedPercent:adjustment?.fixedPercent??0,adjustmentVariablePercent:adjustment?.variablePercent??0,
          })
          fixed=calc.standardFixed+calc.adjustmentFixed
          variable=calc.standardVariable+calc.adjustmentVariable
        } else if (cost.basis==='per-unit-output') {
          if (![cost.standardQuantity,cost.standardUnitPrice,cost.standardTotal].every(nonNegative) ||
              cost.fixedPercent===null || cost.variablePercent===null) throw new Error('incomplete per-unit-output basis')
          const adjustmentTotal=adjustment?.total??((adjustment?.quantity??0)*(adjustment?.unitPrice??0))
          const calc=calculateHelpPerUnitOutputCost({
            inputQuantityPerUnit:cost.standardQuantity as number,unitPrice:cost.standardUnitPrice as number,
            outputVolume:cost.activityBasis==='sales'?operating.salesQuantity:operating.productionQuantity,
            standardFixedCost:(cost.standardTotal as number)*cost.fixedPercent/100,
            adjustmentTotal,adjustmentVariablePercent:adjustment?.variablePercent??0,periodMonths:months,
          })
          fixed=calc.fixed
          variable=calc.variable
        } else {
          if (!adjustment || adjustment.total===null || !nonNegative(adjustment.total) ||
              adjustment.fixedPercent===null || adjustment.variablePercent===null ||
              !nonNegative(adjustment.fixedPercent)||!nonNegative(adjustment.variablePercent)||
              Math.abs(adjustment.fixedPercent+adjustment.variablePercent-100)>1e-8)
            throw new Error('period adjustment with total and 100% fixed/variable split is required')
          fixed=adjustment.total*adjustment.fixedPercent/100
          variable=adjustment.total*adjustment.variablePercent/100
        }
      } catch (error) {
        issues.push('Cost item '+cost.id+' period '+(i+1)+': '+(error instanceof Error?error.message:'invalid cost input'))
        continue
      }
      if (cost.classification==='direct') {
        operating.directFixedCost+=fixed
        operating.directVariableCost+=variable
      } else {
        operating.indirectFixedCost+=fixed
        operating.indirectVariableCost+=variable
      }
      periodProductionCost[i]+=fixed+variable
    }
  }
  for (const row of rows) {
    row.totalProductionCost=row.directFixedCost+row.directVariableCost+row.indirectFixedCost+row.indirectVariableCost
  }
  if (issues.length) return empty()
  for(const product of drafts.sales){
    const openingQuantity=openingFinishedGoodsByProduct[product.productId]??product.openingFinishedGoodsQuantity??0
    const openingValue=openingFinishedGoodsValueByProductResolved[product.productId]??0
    const productRows=rows.filter(row=>row.productId===product.productId).sort((a,b)=>a.period-b.period)
    const valuationPeriods=productRows.map(row=>({
      period:String(row.period),productionQuantity:row.productionQuantity,productionCost:row.totalProductionCost,
      salesQuantity:row.salesQuantity,closingQuantity:row.closingFinishedGoodsQuantity,
    }))
    const method=product.inventoryValuationMethod??'weighted-average'
    const valuation=method==='fifo'
      ?calculateFinishedGoodsFifoSchedule({openingQuantity,openingValue,periods:valuationPeriods})
      :calculateFinishedGoodsWeightedAverageSchedule({openingQuantity,openingValue,periods:valuationPeriods})
    if(!valuation.valid){
      issues.push(...valuation.issues.map(issue=>'Finished-goods valuation for '+product.productId+': '+issue))
      continue
    }
    valuation.periods.forEach((period,index)=>{
      const row=productRows[index]
      row.costOfGoodsSold=period.costOfGoodsSold
      row.closingFinishedGoodsValue=period.closingInventoryValue
      const year=fiscalIndexes[row.period-1]
      annualCostOfGoodsSold[year]+=period.costOfGoodsSold
      periodCostOfGoodsSold[row.period-1]+=period.costOfGoodsSold
      periodClosingFinishedGoodsValue[row.period-1]+=period.closingInventoryValue
    })
  }
  if (issues.length) return empty()
  return {
    valid:true,issues:[],rows,annualRevenue,annualVariableCost,annualFixedCost,annualCostOfGoodsSold,
    periodRevenue,periodProductionCost,periodSalesQuantity,periodProductionQuantity,
    periodCostOfGoodsSold,periodClosingFinishedGoodsValue,
    openingFinishedGoodsValueByProduct:openingFinishedGoodsValueByProductResolved,
    closingFinishedGoodsQuantityByProduct:closingByProduct,
  }
}

/** Bind the validated operating schedule into the annual series consumed by the periodic engine. */
export function bindProductionSalesToPeriodicFinance(
  input:PeriodicProjectFinanceInput,
  drafts:Pick<ProjectModelFinancialFormDrafts,'sales'|'productionCosts'>,
  openingFinishedGoodsByProduct:Record<string,number>,
  openingFinishedGoodsValueByProduct:Record<string,number> = {},
):ProductionSalesFinanceBinding {
  const schedule=buildProductionSalesInventorySchedule(drafts,input.periods,input.fiscalYearStartMonth,openingFinishedGoodsByProduct,openingFinishedGoodsValueByProduct)
  if (!schedule.valid) return {valid:false,issues:schedule.issues,financeInput:null,schedule}
  const issues:string[]=[]
  if(input.annualVariableCost.length!==schedule.annualVariableCost.length||
    input.annualFixedCost.length!==schedule.annualFixedCost.length||
    (input.annualCostOfGoodsSold!==undefined&&input.annualCostOfGoodsSold.length!==schedule.annualCostOfGoodsSold.length))
    issues.push('Existing annual operating-cost and cost-of-sales arrays must cover the same fiscal horizon as the product sales schedule.')
  if(input.finishedGoodsInventoryValueByPeriod!==undefined&&
    input.finishedGoodsInventoryValueByPeriod.length!==schedule.periodClosingFinishedGoodsValue.length)
    issues.push('Existing finished-goods inventory values must cover every project period.')
  if(issues.length)return {valid:false,issues,financeInput:null,schedule}
  const existingCogs=input.annualCostOfGoodsSold??Array(schedule.annualCostOfGoodsSold.length).fill(0)
  const existingInventory=input.finishedGoodsInventoryValueByPeriod??Array(schedule.periodClosingFinishedGoodsValue.length).fill(0)
  return {
    valid:true,issues:[],
    financeInput:{
      ...input,
      annualRevenue:schedule.annualRevenue,
      annualVariableCost:input.annualVariableCost.map((value,index)=>value+schedule.annualVariableCost[index]),
      annualFixedCost:input.annualFixedCost.map((value,index)=>value+schedule.annualFixedCost[index]),
      annualCostOfGoodsSold:existingCogs.map((value,index)=>value+schedule.annualCostOfGoodsSold[index]),
      finishedGoodsInventoryValueByPeriod:existingInventory.map((value,index)=>value+schedule.periodClosingFinishedGoodsValue[index]),
    },
    schedule,
  }
}


export type FinishedGoodsCostFlowInput = {
  method: 'weighted-average'
  openingQuantity: number
  openingValue: number
  productionQuantity: number
  productionCost: number
  salesQuantity: number
  closingQuantity: number
}

export type FinishedGoodsCostFlowResult = {
  valid: boolean
  issues: string[]
  availableQuantity: number
  availableValue: number
  weightedAverageUnitCost: number
  costOfGoodsSold: number
  closingInventoryValue: number
  reconciliationDifference: number
}

/**
 * Calculate periodic weighted-average finished-goods valuation.
 * Quantities must reconcile (opening + production = sales + closing).
 * Values are kept at full precision; presentation rounding belongs downstream.
 */
export function calculateFinishedGoodsWeightedAverage(input: FinishedGoodsCostFlowInput): FinishedGoodsCostFlowResult {
  const issues: string[] = []
  const values = [input.openingQuantity,input.openingValue,input.productionQuantity,
    input.productionCost,input.salesQuantity,input.closingQuantity]
  if (values.some(value => !nonNegative(value))) issues.push('Finished-goods cost-flow inputs must be finite and non-negative.')
  if (issues.length) return {valid:false,issues,availableQuantity:0,availableValue:0,
    weightedAverageUnitCost:0,costOfGoodsSold:0,closingInventoryValue:0,reconciliationDifference:0}

  const availableQuantity = input.openingQuantity + input.productionQuantity
  const availableValue = input.openingValue + input.productionCost
  const quantityDifference = availableQuantity - input.salesQuantity - input.closingQuantity
  if (Math.abs(quantityDifference) > 1e-8)
    issues.push('Finished-goods quantities do not reconcile: opening plus production must equal sales plus closing.')
  if (availableQuantity <= 1e-12) {
    if (availableValue > 0.01) issues.push('Finished-goods value exists without available quantity.')
    if (input.salesQuantity > 1e-12 || input.closingQuantity > 1e-12)
      issues.push('Sales or closing inventory cannot exist without available finished-goods quantity.')
    return {valid:issues.length===0,issues,availableQuantity,availableValue,
      weightedAverageUnitCost:0,costOfGoodsSold:0,closingInventoryValue:0,
      reconciliationDifference:availableValue}
  }
  const weightedAverageUnitCost = availableValue / availableQuantity
  const costOfGoodsSold = input.salesQuantity * weightedAverageUnitCost
  const closingInventoryValue = input.closingQuantity * weightedAverageUnitCost
  const reconciliationDifference = availableValue - costOfGoodsSold - closingInventoryValue
  if (Math.abs(reconciliationDifference) > Math.max(0.01,Math.abs(availableValue)*1e-10))
    issues.push('Finished-goods value does not reconcile to cost of goods sold plus closing inventory.')
  return {valid:issues.length===0,issues,availableQuantity,availableValue,
    weightedAverageUnitCost,costOfGoodsSold,closingInventoryValue,reconciliationDifference}
}



export type FinishedGoodsFifoPeriodInput = {
  period: string
  productionQuantity: number
  productionCost: number
  salesQuantity: number
  closingQuantity: number
}
export type FinishedGoodsFifoPeriodResult = {
  period: string
  openingQuantity: number
  openingValue: number
  productionQuantity: number
  productionCost: number
  salesQuantity: number
  closingQuantity: number
  availableQuantity: number
  availableValue: number
  costOfGoodsSold: number
  closingInventoryValue: number
  reconciliationDifference: number
}
export type FinishedGoodsFifoScheduleResult = {
  valid: boolean
  issues: string[]
  periods: FinishedGoodsFifoPeriodResult[]
  closingQuantity: number
  closingValue: number
}

/**
 * Value finished goods using FIFO layers. Opening stock is represented by one
 * carrying-value layer; each period's production creates a new layer at its
 * actual entered production cost. Sales consume the oldest layers first.
 */
export function calculateFinishedGoodsFifoSchedule(input: {
  openingQuantity: number
  openingValue: number
  periods: FinishedGoodsFifoPeriodInput[]
}): FinishedGoodsFifoScheduleResult {
  const issues: string[] = []
  const fail = (): FinishedGoodsFifoScheduleResult => ({
    valid:false,issues,periods:[],closingQuantity:0,closingValue:0,
  })
  if (!nonNegative(input.openingQuantity) || !nonNegative(input.openingValue))
    issues.push('Opening finished-goods quantity and value must be finite, explicit and non-negative.')
  if (!Array.isArray(input.periods) || input.periods.length === 0) {
    issues.push('At least one finished-goods FIFO period is required.')
    return fail()
  }
  if (input.openingQuantity <= 1e-12 && input.openingValue > 0.01)
    issues.push('Opening finished-goods value exists without opening quantity.')
  const keys = input.periods.map(row => row && typeof row.period === 'string' ? row.period.trim() : '')
  if (keys.some(key => !key) || new Set(keys).size !== keys.length)
    issues.push('Finished-goods FIFO period keys must be non-empty and unique.')
  if (issues.length) return fail()

  type Layer = { quantity:number; unitCost:number }
  const layers:Layer[] = input.openingQuantity > 1e-12
    ? [{quantity:input.openingQuantity,unitCost:input.openingValue/input.openingQuantity}]
    : []
  const results:FinishedGoodsFifoPeriodResult[]=[]
  let openingQuantity=input.openingQuantity
  let openingValue=input.openingValue
  for (const row of input.periods) {
    const values=[row.productionQuantity,row.productionCost,row.salesQuantity,row.closingQuantity]
    if (values.some(value=>!nonNegative(value))) {
      issues.push('Period '+row.period+': FIFO quantities and production cost must be finite and non-negative.')
      break
    }
    if (row.productionQuantity<=1e-12 && row.productionCost>0.01) {
      issues.push('Period '+row.period+': production value exists without production quantity.')
      break
    }
    const availableQuantity=openingQuantity+row.productionQuantity
    const availableValue=openingValue+row.productionCost
    const quantityDifference=availableQuantity-row.salesQuantity-row.closingQuantity
    if (Math.abs(quantityDifference)>1e-8) {
      issues.push('Period '+row.period+': finished-goods quantities do not reconcile under FIFO.')
      break
    }
    if (row.productionQuantity>1e-12)
      layers.push({quantity:row.productionQuantity,unitCost:row.productionCost/row.productionQuantity})
    let remainingSales=row.salesQuantity
    let costOfGoodsSold=0
    for (const layer of layers) {
      if (remainingSales<=1e-12) break
      const consumed=Math.min(layer.quantity,remainingSales)
      costOfGoodsSold+=consumed*layer.unitCost
      layer.quantity-=consumed
      remainingSales-=consumed
    }
    if (remainingSales>1e-8) {
      issues.push('Period '+row.period+': FIFO layers do not cover reported sales quantity.')
      break
    }
    for (let i=layers.length-1;i>=0;i--) if(layers[i].quantity<=1e-12) layers.splice(i,1)
    const closingInventoryValue=layers.reduce((sum,layer)=>sum+layer.quantity*layer.unitCost,0)
    const reconciliationDifference=availableValue-costOfGoodsSold-closingInventoryValue
    if (Math.abs(reconciliationDifference)>Math.max(0.01,Math.abs(availableValue)*1e-10)) {
      issues.push('Period '+row.period+': FIFO value does not reconcile to cost of goods sold plus closing inventory.')
      break
    }
    results.push({period:row.period,openingQuantity,openingValue,
      productionQuantity:row.productionQuantity,productionCost:row.productionCost,
      salesQuantity:row.salesQuantity,closingQuantity:row.closingQuantity,
      availableQuantity,availableValue,costOfGoodsSold,closingInventoryValue,reconciliationDifference})
    openingQuantity=row.closingQuantity
    openingValue=closingInventoryValue
  }
  return {valid:issues.length===0,issues,periods:results,
    closingQuantity:openingQuantity,closingValue:openingValue}
}

export type FinishedGoodsWeightedAveragePeriodInput = {
  period: string
  productionQuantity: number
  productionCost: number
  salesQuantity: number
  closingQuantity: number
}
export type FinishedGoodsWeightedAveragePeriodResult = FinishedGoodsCostFlowResult & {
  period: string
  openingQuantity: number
  openingValue: number
  productionQuantity: number
  productionCost: number
  salesQuantity: number
  closingQuantity: number
}
export type FinishedGoodsWeightedAverageScheduleResult = {
  valid: boolean
  issues: string[]
  periods: FinishedGoodsWeightedAveragePeriodResult[]
  closingQuantity: number
  closingValue: number
}

/**
 * Roll weighted-average finished-goods cost forward across ordered periods.
 * Each period's closing carrying value becomes the next period's opening value.
 * The first opening quantity and value must be explicitly supplied by the caller.
 */
export function calculateFinishedGoodsWeightedAverageSchedule(input: {
  openingQuantity: number
  openingValue: number
  periods: FinishedGoodsWeightedAveragePeriodInput[]
}): FinishedGoodsWeightedAverageScheduleResult {
  const issues: string[] = []
  if (!nonNegative(input.openingQuantity) || !nonNegative(input.openingValue))
    issues.push('Opening finished-goods quantity and value must be finite, explicit and non-negative.')
  if (!Array.isArray(input.periods) || input.periods.length === 0) {
    issues.push('At least one finished-goods valuation period is required.')
    return {valid:false,issues,periods:[],closingQuantity:0,closingValue:0}
  }
  const keys = input.periods.map(row => row && typeof row.period === 'string' ? row.period.trim() : '')
  if (keys.some(key => !key) || new Set(keys).size !== keys.length)
    issues.push('Finished-goods valuation period keys must be non-empty and unique.')
  if (issues.length) return {valid:false,issues,periods:[],closingQuantity:0,closingValue:0}

  let openingQuantity = input.openingQuantity
  let openingValue = input.openingValue
  const results: FinishedGoodsWeightedAveragePeriodResult[] = []
  for (const row of input.periods) {
    const calculated = calculateFinishedGoodsWeightedAverage({
      method:'weighted-average',openingQuantity,openingValue,
      productionQuantity:row.productionQuantity,productionCost:row.productionCost,
      salesQuantity:row.salesQuantity,closingQuantity:row.closingQuantity,
    })
    if (!calculated.valid) {
      issues.push('Period '+row.period+': '+calculated.issues.join(' '))
      continue
    }
    results.push({...calculated,period:row.period,openingQuantity,openingValue,
      productionQuantity:row.productionQuantity,productionCost:row.productionCost,
      salesQuantity:row.salesQuantity,closingQuantity:row.closingQuantity})
    openingQuantity = row.closingQuantity
    openingValue = calculated.closingInventoryValue
  }
  return {valid:issues.length===0,issues,periods:results,
    closingQuantity:openingQuantity,closingValue:openingValue}
}
