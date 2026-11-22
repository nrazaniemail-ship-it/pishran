export type WasteClassification='normal'|'abnormal'
export type WasteLedgerEntry={id:string;period:number;productId:string;costCentreId:string;classification:WasteClassification;quantity:number;unitCost:number;amount:number}
export type ProductionTransferEntry={id:string;period:number;sourceProductId:string;destinationProductId:string;sourceCostCentreId:string;destinationCostCentreId:string;quantity:number;sourceUnit:string;destinationUnit:string;conversionFactor:number;costAmount:number}
export type InventoryReconciliationPeriod={
 period:number
 model:{rawMaterials:number;workInProgress:number;finishedGoods:number;otherCurrentAssets:number;currentLiabilities:number;netWorkingCapital:number}
 balanceSheet:{rawMaterials:number;workInProgress:number;finishedGoods:number;otherCurrentAssets:number;currentLiabilities:number;netWorkingCapital:number}
 cppCps:{rawMaterials:number;workInProgress:number;finishedGoods:number;totalInventory:number}
}
export type InventoryReferenceBenchmarkEntry={id:string;period:number;sourceDocument:string;schedule:string;page:string;currency:string;amountScaleToModel:number|null;rawMaterials:number|null;workInProgress:number|null;finishedGoods:number|null;totalInventory:number|null;cpp:number|null;cps:number|null}
export type InventoryReferenceComparisonRow={period:number;matchedFields:string[];missingFields:string[];variances:Record<string,number>;status:'matched'|'mismatch'|'incomplete'}
export type InventoryReferenceComparisonResult={valid:boolean;rows:InventoryReferenceComparisonRow[];issues:string[]}
export type WasteLedgerResult={valid:boolean;issues:string[];normalWasteAbsorbedByPeriod:number[];abnormalWasteExpenseByPeriod:number[];totalNormalWaste:number;totalAbnormalWaste:number}
export type TransferLedgerResult={valid:boolean;issues:string[];netQuantityByProductCentre:Record<string,number>;netValueByProductCentre:Record<string,number>;totalSourceValue:number;totalDestinationValue:number}
export type InventoryReconciliationResult={valid:boolean;issues:string[];rows:{period:number;inventoryModel:number;inventoryBalanceSheet:number;inventoryCppCps:number;netWorkingCapitalModel:number;netWorkingCapitalBalanceSheet:number;inventoryVariance:number;cppCpsVariance:number;workingCapitalVariance:number}[]}
export type CostCentreInventoryMovement={
 period:number
 productId:string
 costCentreId:string
 openingQuantity:number
 openingValue:number
 receiptsQuantity:number
 receiptsValue:number
 productionQuantity:number
 productionValue:number
 consumptionQuantity:number
 consumptionValue:number
 wasteQuantity:number
 wasteValue:number
 closingQuantity:number
 closingValue:number
}
export type CostCentreInventoryReconciliationResult={
 valid:boolean
 issues:string[]
 rows:{period:number;productId:string;costCentreId:string;transferNetQuantity:number;transferNetValue:number;expectedClosingQuantity:number;expectedClosingValue:number;quantityVariance:number;valueVariance:number}[]
}
const finite=(v:number)=>Number.isFinite(v)&&v>=0
const near=(a:number,b:number,t:number)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b))

export function validateWasteLedger(entries:WasteLedgerEntry[],periodCount:number,tolerance=0.01):WasteLedgerResult{
 const issues:string[]=[],ids=new Set<string>(),normal=Array(periodCount).fill(0) as number[],abnormal=Array(periodCount).fill(0) as number[]
 for(const e of entries){
  if(!e.id||ids.has(e.id))issues.push('Waste entries require unique non-empty identifiers.')
  ids.add(e.id)
  if(!Number.isInteger(e.period)||e.period<1||e.period>periodCount){issues.push('Waste entry '+e.id+' has an invalid period.');continue}
  if(!e.productId.trim()||!e.costCentreId.trim())issues.push('Waste entry '+e.id+' requires product and cost-centre identifiers.')
  if(!finite(e.quantity)||!finite(e.unitCost)||!finite(e.amount))issues.push('Waste entry '+e.id+' requires explicit finite non-negative quantity, unit cost and amount.')
  if(!near(e.quantity*e.unitCost,e.amount,tolerance/100))issues.push('Waste entry '+e.id+' amount does not equal quantity multiplied by unit cost.')
  if(e.classification==='normal')normal[e.period-1]+=e.amount
  else if(e.classification==='abnormal')abnormal[e.period-1]+=e.amount
  else issues.push('Waste entry '+e.id+' has an unsupported classification.')
 }
 return {valid:!issues.length,issues,normalWasteAbsorbedByPeriod:issues.length?[]:normal,abnormalWasteExpenseByPeriod:issues.length?[]:abnormal,totalNormalWaste:normal.reduce((a,b)=>a+b,0),totalAbnormalWaste:abnormal.reduce((a,b)=>a+b,0)}
}

export function validateProductionTransfers(entries:ProductionTransferEntry[],periodCount:number,tolerance=0.01):TransferLedgerResult{
 const issues:string[]=[],ids=new Set<string>(),qty:Record<string,number>={},value:Record<string,number>={},unitByProduct:Record<string,string>={}
 let source=0,destination=0
 for(const e of entries){
  if(!e.id||ids.has(e.id))issues.push('Transfer entries require unique non-empty identifiers.')
  ids.add(e.id)
  if(!Number.isInteger(e.period)||e.period<1||e.period>periodCount)issues.push('Transfer '+e.id+' has an invalid period.')
  if(!e.sourceProductId.trim()||!e.destinationProductId.trim()||!e.sourceCostCentreId.trim()||!e.destinationCostCentreId.trim())issues.push('Transfer '+e.id+' requires source and destination product and cost-centre identifiers.')
  if(e.sourceProductId===e.destinationProductId&&e.sourceCostCentreId===e.destinationCostCentreId)issues.push('Transfer '+e.id+' cannot have identical source and destination.')
  if(!finite(e.quantity)||!finite(e.costAmount)||!e.sourceUnit?.trim()||!e.destinationUnit?.trim()||!Number.isFinite(e.conversionFactor)||e.conversionFactor<=0)issues.push('Transfer '+e.id+' requires finite quantity and cost, explicit source and destination units, and a positive conversion factor.')
  if(e.sourceUnit?.trim()===e.destinationUnit?.trim()&&Math.abs(e.conversionFactor-1)>tolerance/100)issues.push('Transfer '+e.id+' uses identical units; its conversion factor must equal 1.')
  if(!e.sourceUnit?.trim()||!e.destinationUnit?.trim()||!Number.isFinite(e.conversionFactor)||e.conversionFactor<=0)continue
  for(const [product,unit] of [[e.sourceProductId,e.sourceUnit],[e.destinationProductId,e.destinationUnit]] as const){
   const known=unitByProduct[product]
   if(known&&known!==unit)issues.push('Transfer '+e.id+' uses '+unit+' for product '+product+' but another transfer uses '+known+'. A product must have one base unit.')
   unitByProduct[product]=unit
  }
  const from=e.period+':'+e.sourceProductId+'@'+e.sourceCostCentreId,to=e.period+':'+e.destinationProductId+'@'+e.destinationCostCentreId
  qty[from]=(qty[from]??0)-e.quantity;qty[to]=(qty[to]??0)+e.quantity*e.conversionFactor
  value[from]=(value[from]??0)-e.costAmount;value[to]=(value[to]??0)+e.costAmount
  source+=e.costAmount;destination+=e.costAmount
 }
 if(!near(source,destination,tolerance/100))issues.push('Transfer source and destination values do not balance.')
 return {valid:!issues.length,issues,netQuantityByProductCentre:issues.length?{}:qty,netValueByProductCentre:issues.length?{}:value,totalSourceValue:source,totalDestinationValue:destination}
}

/**
 * Reconciles explicit product/cost-centre stock movements against the transfer
 * register. Transfer deltas are internal movements: they change the location
 * balance but do not create additional group inventory value.
 */
export function reconcileCostCentreInventory(
 movements:CostCentreInventoryMovement[],
 transfers:ProductionTransferEntry[],
 periodCount:number,
 tolerance=0.01
):CostCentreInventoryReconciliationResult{
 const issues:string[]=[]
 if(!Number.isInteger(periodCount)||periodCount<1)issues.push('Cost-centre inventory reconciliation requires a positive period count.')
 if(!Number.isFinite(tolerance)||tolerance<0)issues.push('Cost-centre inventory tolerance must be a finite non-negative percentage.')
 const transferLedger=validateProductionTransfers(transfers,periodCount,tolerance)
 issues.push(...transferLedger.issues)
 if(issues.length)return {valid:false,issues,rows:[]}
 const keyOf=(period:number,productId:string,costCentreId:string)=>period+':'+productId+'@'+costCentreId
 const movementByKey=new Map<string,CostCentreInventoryMovement>()
 const previousByProductCentre=new Map<string,CostCentreInventoryMovement>()
 const rows:CostCentreInventoryReconciliationResult['rows']=[]
 const ordered=[...movements].sort((a,b)=>a.period-b.period||a.productId.localeCompare(b.productId)||a.costCentreId.localeCompare(b.costCentreId))
 for(const movement of ordered){
  if(!Number.isInteger(movement.period)||movement.period<1||movement.period>periodCount){
   issues.push('Cost-centre inventory movement has an invalid period.')
   continue
  }
  if(!movement.productId.trim()||!movement.costCentreId.trim()){
   issues.push('Cost-centre inventory movement requires product and cost-centre identifiers.')
   continue
  }
  const key=keyOf(movement.period,movement.productId,movement.costCentreId)
  if(movementByKey.has(key)){
   issues.push('Duplicate cost-centre inventory movement '+key+'.')
   continue
  }
  movementByKey.set(key,movement)
  const amounts=[movement.openingQuantity,movement.openingValue,movement.receiptsQuantity,movement.receiptsValue,
   movement.productionQuantity,movement.productionValue,movement.consumptionQuantity,movement.consumptionValue,
   movement.wasteQuantity,movement.wasteValue,movement.closingQuantity,movement.closingValue]
  if(amounts.some(value=>!finite(value))){
   issues.push('Cost-centre inventory movement '+key+' requires explicit finite non-negative quantities and values.')
   continue
  }
  const productCentre=movement.productId+'@'+movement.costCentreId
  const previous=previousByProductCentre.get(productCentre)
  if(previous&&previous.period===movement.period-1){
   if(!near(movement.openingQuantity,previous.closingQuantity,tolerance/100))
    issues.push('Cost-centre inventory '+key+' opening quantity does not equal prior-period closing quantity.')
   if(!near(movement.openingValue,previous.closingValue,tolerance/100))
    issues.push('Cost-centre inventory '+key+' opening value does not equal prior-period closing value.')
  }
  previousByProductCentre.set(productCentre,movement)
  const transferKey=key
  const transferNetQuantity=transferLedger.netQuantityByProductCentre[transferKey]??0
  const transferNetValue=transferLedger.netValueByProductCentre[transferKey]??0
  const expectedClosingQuantity=movement.openingQuantity+movement.receiptsQuantity+movement.productionQuantity+
   transferNetQuantity-movement.consumptionQuantity-movement.wasteQuantity
  const expectedClosingValue=movement.openingValue+movement.receiptsValue+movement.productionValue+
   transferNetValue-movement.consumptionValue-movement.wasteValue
  const quantityVariance=movement.closingQuantity-expectedClosingQuantity
  const valueVariance=movement.closingValue-expectedClosingValue
  if(expectedClosingQuantity< -tolerance/100*Math.max(1,movement.openingQuantity+movement.receiptsQuantity+movement.productionQuantity))
   issues.push('Cost-centre inventory '+key+' has a negative expected closing quantity; issues and transfers exceed available stock.')
  if(expectedClosingValue< -tolerance/100*Math.max(1,movement.openingValue+movement.receiptsValue+movement.productionValue))
   issues.push('Cost-centre inventory '+key+' has a negative expected closing value; issues and transfers exceed available value.')
  if(!near(movement.closingQuantity,expectedClosingQuantity,tolerance/100))
   issues.push('Cost-centre inventory '+key+' closing quantity does not reconcile to opening stock and period movements.')
  if(!near(movement.closingValue,expectedClosingValue,tolerance/100))
   issues.push('Cost-centre inventory '+key+' closing value does not reconcile to opening stock and period movements.')
  rows.push({period:movement.period,productId:movement.productId,costCentreId:movement.costCentreId,
   transferNetQuantity,transferNetValue,expectedClosingQuantity,expectedClosingValue,quantityVariance,valueVariance})
 }
 for(const key of Object.keys(transferLedger.netQuantityByProductCentre)){
  if(!movementByKey.has(key))issues.push('Production transfer '+key+' has no matching cost-centre inventory movement row.')
 }
 return {valid:!issues.length,issues,rows:issues.length?[]:rows}
}

export type InventoryStageTransfer={
 id:string
 period:number|null
 sourceStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 destinationStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 sourceProductId:string
 destinationProductId:string
 sourceCostCentreId:string
 destinationCostCentreId:string
 quantity:number|null
 sourceUnit:string
 destinationUnit:string
 conversionFactor:number|null
 transferValue:number|null
 sourceReference:string
 sourceVerified:boolean
}
export type StageInventoryMovementDraft={
 period:number|null
 inventoryStage:'raw-materials'|'work-in-progress'|'finished-goods'|null
 productId:string
 costCentreId:string
 openingQuantity:number|null
 openingValue:number|null
 receiptsQuantity:number|null
 receiptsValue:number|null
 transfersInQuantity:number|null
 transfersInValue:number|null
 transfersOutQuantity:number|null
 transfersOutValue:number|null
 productionQuantity:number|null
 productionValue:number|null
 consumptionQuantity:number|null
 consumptionValue:number|null
 salesQuantity:number|null
 salesCostValue:number|null
 wasteQuantity:number|null
 wasteValue:number|null
 closingQuantity:number|null
 closingValue:number|null
 sourceReference:string
 sourceVerified:boolean
}
export type StageInventoryReconciliationResult={
 valid:boolean
 issues:string[]
 rows:{period:number;inventoryStage:'raw-materials'|'work-in-progress'|'finished-goods';ledgerClosingValue:number;engineClosingValue:number;variance:number;movementCount:number}[]
}
/**
 * Cross-checks stage-specific cost-centre closing balances against the existing
 * inventory values produced by the finance engine. It is a validation bridge,
 * not a posting routine: values are never added to CPP/CPS or working capital.
 */
export function reconcileStageInventoryMovements(
 movements:StageInventoryMovementDraft[],
 expectedByPeriod:{period:number;rawMaterials:number;workInProgress:number;finishedGoods:number}[],
 periodCount:number,
 tolerance=0.01,
 stageTransfers:InventoryStageTransfer[]=[],
 expectedByProductPeriod?:{period:number;productId:string;rawMaterials:number;workInProgress:number;finishedGoods:number;finishedGoodsSalesQuantity?:number;finishedGoodsCostOfSales?:number;productionQuantity?:number;productionCost?:number}[]
):StageInventoryReconciliationResult{
 const issues:string[]=[]
 for(const row of movements){
  const hasAnyValue=[row.period,row.inventoryStage,row.productId,row.costCentreId,row.openingQuantity,row.openingValue,
   row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,row.transfersOutQuantity,row.transfersOutValue,
   row.productionQuantity,row.productionValue,row.consumptionQuantity,row.consumptionValue,row.salesQuantity,row.salesCostValue,row.wasteQuantity,row.wasteValue,
   row.closingQuantity,row.closingValue,row.sourceReference,row.sourceVerified===true?true:null].some(value=>value!==null&&value!==undefined&&value!=='')
  if(!hasAnyValue)continue
  if(row.period===null||!Number.isInteger(row.period)||row.period<1||row.period>periodCount||
     !row.inventoryStage||!row.productId.trim()||!row.costCentreId.trim())
   issues.push('Stage inventory movement requires a valid period, stage, product and cost-centre identifier.')
  const amounts=[row.openingQuantity,row.openingValue,row.receiptsQuantity,row.receiptsValue,row.transfersInQuantity,row.transfersInValue,
   row.transfersOutQuantity,row.transfersOutValue,row.productionQuantity,row.productionValue,row.consumptionQuantity,row.consumptionValue,row.salesQuantity,row.salesCostValue,
   row.wasteQuantity,row.wasteValue,row.closingQuantity,row.closingValue]
  if(amounts.some(value=>value===null||!finite(value as number)))
   issues.push('Stage inventory movement requires every quantity and value to be explicitly entered as a finite non-negative amount.')
  if(row.inventoryStage!=='finished-goods'&&((row.salesQuantity??0)>tolerance/100||(row.salesCostValue??0)>tolerance/100))
   issues.push('Sales quantity and cost of sales may only be recorded against finished-goods inventory.')
  if(!row.sourceReference.trim()||!row.sourceVerified)
   issues.push('Stage inventory movement requires a verified source reference.')
 }
 if(issues.length)return {valid:false,issues,rows:[]}
 const movementByStageKey=new Map<string,StageInventoryMovementDraft>()
 for(const row of movements){
  if(row.period===null||!row.inventoryStage||!row.productId.trim()||!row.costCentreId.trim())continue
  const key=[row.period,row.inventoryStage,row.productId.trim(),row.costCentreId.trim()].join(':')
  if(movementByStageKey.has(key)){
   issues.push('Duplicate stage inventory movement '+key+'. Each period, stage, product and cost centre must have exactly one closing-balance row.')
   continue
  }
  movementByStageKey.set(key,row)
 }
 if(issues.length)return {valid:false,issues,rows:[]}
 const transferIds=new Set<string>()
 const transferOut=new Map<string,{quantity:number;value:number}>()
 const transferIn=new Map<string,{quantity:number;value:number}>()
 for(const transfer of stageTransfers){
  const hasAnyValue=[transfer.period,transfer.sourceStage,transfer.destinationStage,transfer.sourceProductId,transfer.destinationProductId,
   transfer.sourceCostCentreId,transfer.destinationCostCentreId,transfer.quantity,transfer.sourceUnit,transfer.destinationUnit,
   transfer.conversionFactor,transfer.transferValue,transfer.sourceReference,transfer.sourceVerified===true?true:null].some(value=>value!==null&&value!==undefined&&value!=='')
  if(!hasAnyValue)continue
  const id=transfer.id.trim()
  if(!id||transferIds.has(id))issues.push('Inter-stage transfers require unique non-empty identifiers.')
  transferIds.add(id)
  if(transfer.period===null||!Number.isInteger(transfer.period)||transfer.period<1||transfer.period>periodCount)
   issues.push('Inter-stage transfer '+id+' has an invalid period.')
  if(!transfer.sourceStage||!transfer.destinationStage||transfer.sourceStage===transfer.destinationStage)
   issues.push('Inter-stage transfer '+id+' requires two distinct inventory stages.')
  if(!transfer.sourceProductId.trim()||!transfer.destinationProductId.trim()||!transfer.sourceCostCentreId.trim()||!transfer.destinationCostCentreId.trim())
   issues.push('Inter-stage transfer '+id+' requires source and destination product and cost-centre identifiers.')
  if(transfer.quantity===null||!Number.isFinite(transfer.quantity)||transfer.quantity<=0||
     transfer.conversionFactor===null||!Number.isFinite(transfer.conversionFactor)||transfer.conversionFactor<=0||
     transfer.transferValue===null||!Number.isFinite(transfer.transferValue)||transfer.transferValue<0)
   issues.push('Inter-stage transfer '+id+' requires positive quantity and conversion factor and a finite non-negative transfer value.')
  if(!transfer.sourceUnit.trim()||!transfer.destinationUnit.trim())
   issues.push('Inter-stage transfer '+id+' requires explicit source and destination units.')
  if(transfer.sourceUnit.trim()===transfer.destinationUnit.trim()&&transfer.conversionFactor!==null&&Math.abs(transfer.conversionFactor-1)>tolerance/100)
   issues.push('Inter-stage transfer '+id+' has identical units and must use conversion factor 1.')
  if(!transfer.sourceReference.trim()||!transfer.sourceVerified)
   issues.push('Inter-stage transfer '+id+' requires a verified source reference.')
  if(transfer.period===null||!transfer.sourceStage||!transfer.destinationStage||transfer.sourceStage===transfer.destinationStage||
     !transfer.sourceProductId.trim()||!transfer.destinationProductId.trim()||!transfer.sourceCostCentreId.trim()||!transfer.destinationCostCentreId.trim()||
     transfer.quantity===null||!Number.isFinite(transfer.quantity)||transfer.quantity<=0||
     transfer.conversionFactor===null||!Number.isFinite(transfer.conversionFactor)||transfer.conversionFactor<=0||
     transfer.transferValue===null||!Number.isFinite(transfer.transferValue)||transfer.transferValue<0)continue
  const sourceKey=[transfer.period,transfer.sourceStage,transfer.sourceProductId.trim(),transfer.sourceCostCentreId.trim()].join(':')
  const destinationKey=[transfer.period,transfer.destinationStage,transfer.destinationProductId.trim(),transfer.destinationCostCentreId.trim()].join(':')
  if(!movementByStageKey.has(sourceKey))issues.push('Inter-stage transfer '+id+' has no matching source-stage inventory movement row.')
  if(!movementByStageKey.has(destinationKey))issues.push('Inter-stage transfer '+id+' has no matching destination-stage inventory movement row.')
  const from=transferOut.get(sourceKey)??{quantity:0,value:0}
  from.quantity+=transfer.quantity;from.value+=transfer.transferValue;transferOut.set(sourceKey,from)
  const to=transferIn.get(destinationKey)??{quantity:0,value:0}
  to.quantity+=transfer.quantity*transfer.conversionFactor;to.value+=transfer.transferValue;transferIn.set(destinationKey,to)
 }
 if(issues.length)return {valid:false,issues,rows:[]}
 const adjustedMovements=movements.map(row=>{
  const key=[row.period,row.inventoryStage,row.productId.trim(),row.costCentreId.trim()].join(':')
  const outgoing=transferOut.get(key)??{quantity:0,value:0}
  const incoming=transferIn.get(key)??{quantity:0,value:0}
  return {...row,
   receiptsQuantity:(row.receiptsQuantity??0)+incoming.quantity,
   receiptsValue:(row.receiptsValue??0)+incoming.value,
   consumptionQuantity:(row.consumptionQuantity??0)+outgoing.quantity,
   consumptionValue:(row.consumptionValue??0)+outgoing.value,
  }
 })
 const stages=['raw-materials','work-in-progress','finished-goods'] as const
 if(!Number.isInteger(periodCount)||periodCount<1)issues.push('Stage inventory reconciliation requires a positive period count.')
 if(!Number.isFinite(tolerance)||tolerance<0)issues.push('Stage inventory tolerance must be finite and non-negative.')
 const expected=new Map<number,{rawMaterials:number;workInProgress:number;finishedGoods:number}>()
 for(const row of expectedByPeriod){
  if(!Number.isInteger(row.period)||row.period<1||row.period>periodCount||expected.has(row.period))
   issues.push('Stage inventory engine values contain an invalid or duplicate period.')
  if([row.rawMaterials,row.workInProgress,row.finishedGoods].some(value=>!finite(value)))
   issues.push('Stage inventory engine values must be finite and non-negative.')
  expected.set(row.period,{rawMaterials:row.rawMaterials,workInProgress:row.workInProgress,finishedGoods:row.finishedGoods})
 }
 const expectedProductRows=new Map<string,{rawMaterials:number;workInProgress:number;finishedGoods:number;finishedGoodsSalesQuantity?:number;finishedGoodsCostOfSales?:number;productionQuantity?:number;productionCost?:number}>()
 for(const row of expectedByProductPeriod??[]){
  const key=[row.period,row.productId.trim()].join(':')
  if(!Number.isInteger(row.period)||row.period<1||row.period>periodCount||!row.productId.trim()||expectedProductRows.has(key))
   issues.push('Product-level inventory engine values contain an invalid or duplicate period/product key.')
  if([row.rawMaterials,row.workInProgress,row.finishedGoods].some(value=>!finite(value)))
   issues.push('Product-level inventory engine values must be finite and non-negative.')
  if([row.finishedGoodsSalesQuantity,row.finishedGoodsCostOfSales,row.productionQuantity,row.productionCost].some(value=>value!==undefined&&(!Number.isFinite(value)||value<0)))
   issues.push('Product-level production, finished-goods sales quantity and cost of sales must be finite and non-negative when supplied.')
  expectedProductRows.set(key,{rawMaterials:row.rawMaterials,workInProgress:row.workInProgress,finishedGoods:row.finishedGoods,
   finishedGoodsSalesQuantity:row.finishedGoodsSalesQuantity,finishedGoodsCostOfSales:row.finishedGoodsCostOfSales,
   productionQuantity:row.productionQuantity,productionCost:row.productionCost})
 }
 const rows:StageInventoryReconciliationResult['rows']=[]
 for(const stage of stages){
  const stageRows=adjustedMovements.filter(row=>row.inventoryStage===stage)
  const byPeriod=new Map<number,StageInventoryMovementDraft[]>()
  if(!stageRows.length){
   const field=stage==='raw-materials'?'rawMaterials':stage==='work-in-progress'?'workInProgress':'finishedGoods'
   for(let period=1;period<=periodCount;period++){
    const expectedRow=expected.get(period)
    if(!expectedRow){
     issues.push('Stage '+stage+' has no corresponding finance-engine inventory value for period '+period+'.')
     continue
    }
    if(expectedRow[field]>tolerance/100)
     issues.push('Stage '+stage+' has a non-zero finance-engine balance but no cost-centre inventory movement rows in period '+period+'.')
    if(stage==='finished-goods'){
     for(const [key,engineProduct] of expectedProductRows){
      if(!key.startsWith(period+':'))continue
      const productId=key.slice(String(period).length+1)
      if((engineProduct.finishedGoodsSalesQuantity??0)>tolerance/100||(engineProduct.finishedGoodsCostOfSales??0)>tolerance/100)
       issues.push('Finished-goods product '+productId+' has sales or cost of sales in the product schedule but no finished-goods movement rows in period '+period+'.')
     }
    }
   }
   continue
  }
  for(const row of stageRows){
   if(row.period===null||!Number.isInteger(row.period)||row.period<1||row.period>periodCount){
    issues.push('Stage '+stage+' contains a movement with an invalid period.')
    continue
   }
   if(!row.sourceReference.trim()||!row.sourceVerified)
    issues.push('Stage '+stage+' period '+row.period+' requires a verified source reference.')
   const current=byPeriod.get(row.period)??[]
   current.push(row);byPeriod.set(row.period,current)
  }
  for(let period=1;period<=periodCount;period++){
   const periodRows=byPeriod.get(period)??[]
   if(!periodRows.length){
    issues.push('Stage '+stage+' is missing cost-centre inventory rows for period '+period+'.')
    continue
   }
   const transferInQuantity=periodRows.reduce((sum,row)=>sum+(row.transfersInQuantity??0),0)
   const transferOutQuantity=periodRows.reduce((sum,row)=>sum+(row.transfersOutQuantity??0),0)
   const transferInValue=periodRows.reduce((sum,row)=>sum+(row.transfersInValue??0),0)
   const transferOutValue=periodRows.reduce((sum,row)=>sum+(row.transfersOutValue??0),0)
   if(!near(transferInQuantity,transferOutQuantity,tolerance/100)||!near(transferInValue,transferOutValue,tolerance/100))
    issues.push('Stage '+stage+' internal cost-centre transfers do not balance in period '+period+'.')
   const mapped:CostCentreInventoryMovement[]=periodRows.map(row=>({
    period:row.period as number,productId:row.productId,costCentreId:row.costCentreId,
    openingQuantity:row.openingQuantity as number,openingValue:row.openingValue as number,
    receiptsQuantity:(row.receiptsQuantity as number)+(row.transfersInQuantity as number),receiptsValue:(row.receiptsValue as number)+(row.transfersInValue as number),
    productionQuantity:row.productionQuantity as number,productionValue:row.productionValue as number,
    consumptionQuantity:(row.consumptionQuantity as number)+(row.transfersOutQuantity as number)+(row.salesQuantity as number),consumptionValue:(row.consumptionValue as number)+(row.transfersOutValue as number)+(row.salesCostValue as number),
    wasteQuantity:row.wasteQuantity as number,wasteValue:row.wasteValue as number,
    closingQuantity:row.closingQuantity as number,closingValue:row.closingValue as number,
   }))
   const centreCheck=reconcileCostCentreInventory(mapped,[],periodCount,tolerance)
   issues.push(...centreCheck.issues.map(issue=>'Stage '+stage+': '+issue))
   const productField=stage==='raw-materials'?'rawMaterials':stage==='work-in-progress'?'workInProgress':'finishedGoods'
   const expectedProductStageTotal=[...expectedProductRows.entries()].filter(([key])=>key.startsWith(period+':')).reduce((sum,[,row])=>sum+row[productField],0)
   // Apply product-level closing-balance checks to raw materials, WIP and finished goods.
   // Only enable this comparison when the product schedule fully explains the stage aggregate.
   const productBreakdownMatchesStage=!!expectedByProductPeriod&&near(expectedProductStageTotal,expected.get(period)?.[productField]??0,tolerance/100)
   if(productBreakdownMatchesStage){
    const ledgerByProduct=new Map<string,number>()
    const ledgerSalesByProduct=new Map<string,{quantity:number;cost:number}>()
    const ledgerProductionByProduct=new Map<string,{quantity:number;value:number}>()
    for(const row of periodRows){
     const productId=row.productId.trim()
     ledgerByProduct.set(productId,(ledgerByProduct.get(productId)??0)+(row.closingValue??0))
     if(stage==='finished-goods'){
      const sales=ledgerSalesByProduct.get(productId)??{quantity:0,cost:0}
      sales.quantity+=row.salesQuantity??0;sales.cost+=row.salesCostValue??0;ledgerSalesByProduct.set(productId,sales)
      const production=ledgerProductionByProduct.get(productId)??{quantity:0,value:0}
      const stageTransferIn=transferIn.get([row.period,row.inventoryStage,row.productId.trim(),row.costCentreId.trim()].join(':'))??{quantity:0,value:0}
      production.quantity+=(row.productionQuantity??0)+stageTransferIn.quantity
      production.value+=(row.productionValue??0)+stageTransferIn.value
      ledgerProductionByProduct.set(productId,production)
     }
    }
    for(const [key,engineProduct] of expectedProductRows){
     if(!key.startsWith(period+':'))continue
     const productId=key.slice(String(period).length+1)
     const ledgerValue=ledgerByProduct.get(productId)??0
     if(!near(ledgerValue,engineProduct[productField],tolerance/100))
      issues.push('Stage '+stage+' product '+productId+' closing inventory does not match the finance engine in period '+period+'.')
     if(stage==='finished-goods'){
      const production=ledgerProductionByProduct.get(productId)??{quantity:0,value:0}
      if(engineProduct.productionQuantity!==undefined&&!near(production.quantity,engineProduct.productionQuantity,tolerance/100))
       issues.push('Finished-goods product '+productId+' production quantity does not match the product operating schedule in period '+period+'.')
      if(engineProduct.productionCost!==undefined&&!near(production.value,engineProduct.productionCost,tolerance/100))
       issues.push('Finished-goods product '+productId+' production value does not match the product operating schedule in period '+period+'.')
      const sales=ledgerSalesByProduct.get(productId)??{quantity:0,cost:0}
      if(engineProduct.finishedGoodsSalesQuantity!==undefined&&!near(sales.quantity,engineProduct.finishedGoodsSalesQuantity,tolerance/100))
       issues.push('Finished-goods product '+productId+' sales quantity does not match the product operating schedule in period '+period+'.')
      if(engineProduct.finishedGoodsCostOfSales!==undefined&&!near(sales.cost,engineProduct.finishedGoodsCostOfSales,tolerance/100))
       issues.push('Finished-goods product '+productId+' cost of sales does not match the product operating schedule in period '+period+'.')
      ledgerSalesByProduct.delete(productId)
      ledgerProductionByProduct.delete(productId)
     }
     ledgerByProduct.delete(productId)
    }
    for(const [productId,ledgerValue] of ledgerByProduct){
     const sales=ledgerSalesByProduct.get(productId)??{quantity:0,cost:0}
     const production=ledgerProductionByProduct.get(productId)??{quantity:0,value:0}
     if(ledgerValue>tolerance/100||sales.quantity>tolerance/100||sales.cost>tolerance/100||production.quantity>tolerance/100||production.value>tolerance/100)
      issues.push('Stage '+stage+' product '+productId+' has no matching product-level finance-engine inventory row in period '+period+'.')
    }
   }
   const ledgerClosingValue=periodRows.reduce((sum,row)=>sum+(row.closingValue??0),0)
   const expectedRow=expected.get(period)
   if(!expectedRow){
    issues.push('Stage '+stage+' has no corresponding finance-engine inventory value for period '+period+'.')
    continue
   }
   const field=stage==='raw-materials'?'rawMaterials':stage==='work-in-progress'?'workInProgress':'finishedGoods'
   const engineClosingValue=expectedRow[field]
   const variance=ledgerClosingValue-engineClosingValue
   if(!near(ledgerClosingValue,engineClosingValue,tolerance/100))
    issues.push('Stage '+stage+' closing inventory does not match finance engine in period '+period+'.')
   rows.push({period,inventoryStage:stage,ledgerClosingValue,engineClosingValue,variance,movementCount:periodRows.length})
  }
 }
 return {valid:issues.length===0,issues,rows:issues.length?[]:rows}
}

export function reconcileInventoryThreeWay(periods:InventoryReconciliationPeriod[],tolerance=0.01):InventoryReconciliationResult{
 const issues:string[]=[],seen=new Set<number>()
 if(!Number.isFinite(tolerance)||tolerance<0)issues.push('Inventory reconciliation tolerance must be a finite non-negative percentage.')
 const rows=periods.map(p=>{
  if(!Number.isInteger(p.period)||p.period<1)issues.push('Inventory reconciliation requires a positive integer period.')
  if(seen.has(p.period))issues.push('Inventory reconciliation contains duplicate period '+p.period+'.')
  seen.add(p.period)
  const groups=[['model',p.model],['balance sheet',p.balanceSheet],['CPP/CPS',p.cppCps]] as const
  for(const [label,values] of groups)for(const [field,value] of Object.entries(values)){
   if(!Number.isFinite(value)||value<0)issues.push('Period '+p.period+' '+label+' '+field+' must be a finite non-negative amount.')
  }
  const mi=p.model.rawMaterials+p.model.workInProgress+p.model.finishedGoods
  const bi=p.balanceSheet.rawMaterials+p.balanceSheet.workInProgress+p.balanceSheet.finishedGoods
  const ci=p.cppCps.rawMaterials+p.cppCps.workInProgress+p.cppCps.finishedGoods
  const mn=mi+p.model.otherCurrentAssets-p.model.currentLiabilities
  const bn=bi+p.balanceSheet.otherCurrentAssets-p.balanceSheet.currentLiabilities
  const row={period:p.period,inventoryModel:mi,inventoryBalanceSheet:bi,inventoryCppCps:p.cppCps.totalInventory,netWorkingCapitalModel:mn,netWorkingCapitalBalanceSheet:bn,inventoryVariance:mi-bi,cppCpsVariance:mi-p.cppCps.totalInventory,workingCapitalVariance:mn-p.model.netWorkingCapital}
  for(const [label,a,b] of [['model vs balance sheet',mi,bi],['model vs CPP/CPS',mi,ci],['CPP/CPS total vs detail',p.cppCps.totalInventory,ci],['working capital vs model control',mn,p.model.netWorkingCapital],['working capital vs balance sheet',mn,bn]] as const)if(!near(a,b,tolerance/100))issues.push('Period '+p.period+' reconciliation failed: '+label+'.')
  return row
 })
 if(!periods.length)issues.push('At least one inventory reconciliation period is required.')
 return {valid:!issues.length,issues,rows}
}

export function reconcileInventoryReference(
 benchmarks:InventoryReferenceBenchmarkEntry[],
 modeled: {period:number;rawMaterials:number;workInProgress:number;finishedGoods:number;totalInventory:number;cpp:number;cps:number}[],
 tolerance=0.01,
 expectedCurrency?:string
):InventoryReferenceComparisonResult{
 const issues:string[]=[],rows:InventoryReferenceComparisonRow[]=[]
 const seen=new Set<number>()
 for(const b of benchmarks){
  if(seen.has(b.period))issues.push('Reference inventory benchmark has duplicate period '+b.period+'.')
  seen.add(b.period)
  const matchedFields:string[]=[],missingFields:string[]=[],variances:Record<string,number>={}
  if(!b.sourceDocument.trim())missingFields.push('sourceDocument')
  if(!b.schedule.trim())missingFields.push('schedule')
  if(!b.page.trim())missingFields.push('page')
  if(!b.currency.trim())missingFields.push('currency')
  const currencyMatches=!expectedCurrency||b.currency.trim().toUpperCase()===expectedCurrency.trim().toUpperCase()
  if(!currencyMatches){missingFields.push('currencyConversion');issues.push('Reference benchmark period '+b.period+' currency '+b.currency+' does not match project currency '+expectedCurrency+'. Convert through an evidenced exchange-rate schedule before comparison.')}
  if(b.amountScaleToModel===null||!Number.isFinite(b.amountScaleToModel)||b.amountScaleToModel<=0){missingFields.push('amountScaleToModel');issues.push('Reference benchmark period '+b.period+' requires a positive explicit scale factor from report amount units to model amount units.')}
  const m=modeled.find(x=>x.period===b.period)
  if(!m){issues.push('Reference benchmark period '+b.period+' has no matching model period.');continue}
  const scale=b.amountScaleToModel??Number.NaN
  const pairs=[['rawMaterials',b.rawMaterials,m.rawMaterials],['workInProgress',b.workInProgress,m.workInProgress],['finishedGoods',b.finishedGoods,m.finishedGoods],['totalInventory',b.totalInventory,m.totalInventory],['cpp',b.cpp,m.cpp],['cps',b.cps,m.cps]] as const
  for(const [field,reference,actual] of pairs){
   if(reference===null||reference===undefined){missingFields.push(field);continue}
   if(!Number.isFinite(reference)||reference<0){issues.push('Reference benchmark '+field+' in period '+b.period+' must be a finite non-negative amount.');continue}
   if(!Number.isFinite(scale)||!currencyMatches)continue
   const scaledReference=reference*scale
   const variance=actual-scaledReference;variances[field]=variance
   if(Number.isFinite(scale)&&near(actual,scaledReference,tolerance/100))matchedFields.push(field)
  }
  const hasMismatch=pairs.some(([field,reference,actual])=>reference!==null&&reference!==undefined&&Number.isFinite(reference)&&Number.isFinite(scale)&&currencyMatches&&!near(actual,reference*scale,tolerance/100))
  const status:InventoryReferenceComparisonRow['status']=hasMismatch?'mismatch':missingFields.length?'incomplete':'matched'
  if(b.rawMaterials!==null&&b.workInProgress!==null&&b.finishedGoods!==null&&b.totalInventory!==null&&!near(b.rawMaterials+b.workInProgress+b.finishedGoods,b.totalInventory,tolerance/100))issues.push('Reference benchmark period '+b.period+' total inventory does not equal raw materials + WIP + finished goods.')
  if(status==='mismatch')issues.push('Reference benchmark period '+b.period+' differs from model values.')
  rows.push({period:b.period,matchedFields,missingFields,variances,status})
 }
 return {valid:issues.length===0&&rows.length>0&&rows.every(row=>row.status==='matched'),rows,issues}
}
