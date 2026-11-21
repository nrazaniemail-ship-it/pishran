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
