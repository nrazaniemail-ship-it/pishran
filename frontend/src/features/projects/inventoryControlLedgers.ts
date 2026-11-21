export type WasteClassification='normal'|'abnormal'
export type WasteLedgerEntry={id:string;period:number;productId:string;costCentreId:string;classification:WasteClassification;quantity:number;unitCost:number;amount:number}
export type ProductionTransferEntry={id:string;period:number;sourceProductId:string;destinationProductId:string;sourceCostCentreId:string;destinationCostCentreId:string;quantity:number;costAmount:number}
export type InventoryReconciliationPeriod={
 period:number
 model:{rawMaterials:number;workInProgress:number;finishedGoods:number;otherCurrentAssets:number;currentLiabilities:number;netWorkingCapital:number}
 balanceSheet:{rawMaterials:number;workInProgress:number;finishedGoods:number;otherCurrentAssets:number;currentLiabilities:number;netWorkingCapital:number}
 cppCps:{rawMaterials:number;workInProgress:number;finishedGoods:number;totalInventory:number}
}
export type WasteLedgerResult={valid:boolean;issues:string[];normalWasteAbsorbedByPeriod:number[];abnormalWasteExpenseByPeriod:number[];totalNormalWaste:number;totalAbnormalWaste:number}
export type TransferLedgerResult={valid:boolean;issues:string[];netQuantityByProductCentre:Record<string,number>;netValueByProductCentre:Record<string,number>;totalSourceValue:number;totalDestinationValue:number}
export type InventoryReconciliationResult={valid:boolean;issues:string[];rows:{period:number;inventoryModel:number;inventoryBalanceSheet:number;inventoryCppCps:number;netWorkingCapitalModel:number;netWorkingCapitalBalanceSheet:number;inventoryVariance:number;cppCpsVariance:number;workingCapitalVariance:number}[]}
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
 const issues:string[]=[],ids=new Set<string>(),qty:Record<string,number>={},value:Record<string,number>={}
 let source=0,destination=0
 for(const e of entries){
  if(!e.id||ids.has(e.id))issues.push('Transfer entries require unique non-empty identifiers.')
  ids.add(e.id)
  if(!Number.isInteger(e.period)||e.period<1||e.period>periodCount)issues.push('Transfer '+e.id+' has an invalid period.')
  if(!e.sourceProductId.trim()||!e.destinationProductId.trim()||!e.sourceCostCentreId.trim()||!e.destinationCostCentreId.trim())issues.push('Transfer '+e.id+' requires source and destination product and cost-centre identifiers.')
  if(e.sourceProductId===e.destinationProductId&&e.sourceCostCentreId===e.destinationCostCentreId)issues.push('Transfer '+e.id+' cannot have identical source and destination.')
  if(!finite(e.quantity)||!finite(e.costAmount))issues.push('Transfer '+e.id+' requires finite non-negative quantity and cost.')
  const from=e.sourceProductId+'@'+e.sourceCostCentreId,to=e.destinationProductId+'@'+e.destinationCostCentreId
  qty[from]=(qty[from]??0)-e.quantity;qty[to]=(qty[to]??0)+e.quantity
  value[from]=(value[from]??0)-e.costAmount;value[to]=(value[to]??0)+e.costAmount
  source+=e.costAmount;destination+=e.costAmount
 }
 if(!near(source,destination,tolerance/100))issues.push('Transfer source and destination values do not balance.')
 return {valid:!issues.length,issues,netQuantityByProductCentre:issues.length?{}:qty,netValueByProductCentre:issues.length?{}:value,totalSourceValue:source,totalDestinationValue:destination}
}

export function reconcileInventoryThreeWay(periods:InventoryReconciliationPeriod[],tolerance=0.01):InventoryReconciliationResult{
 const issues:string[]=[]
 const rows=periods.map(p=>{
  const mi=p.model.rawMaterials+p.model.workInProgress+p.model.finishedGoods
  const bi=p.balanceSheet.rawMaterials+p.balanceSheet.workInProgress+p.balanceSheet.finishedGoods
  const ci=p.cppCps.rawMaterials+p.cppCps.workInProgress+p.cppCps.finishedGoods
  const mn=mi+p.model.otherCurrentAssets-p.model.currentLiabilities
  const bn=bi+p.balanceSheet.otherCurrentAssets-p.balanceSheet.currentLiabilities
  const row={period:p.period,inventoryModel:mi,inventoryBalanceSheet:bi,inventoryCppCps:p.cppCps.totalInventory,netWorkingCapitalModel:mn,netWorkingCapitalBalanceSheet:bn,inventoryVariance:mi-bi,cppCpsVariance:mi-p.cppCps.totalInventory,workingCapitalVariance:mn-p.model.netWorkingCapital}
  for(const [label,a,b] of [['model vs balance sheet',mi,bi],['model vs CPP/CPS',mi,ci],['CPP/CPS total vs detail',p.cppCps.totalInventory,ci],['working capital vs model control',mn,p.model.netWorkingCapital],['working capital vs balance sheet',mn,bn]] as const)if(!near(a,b,tolerance/100))issues.push('Period '+p.period+' reconciliation failed: '+label+'.')
  return row
 })
 return {valid:!issues.length,issues,rows}
}
