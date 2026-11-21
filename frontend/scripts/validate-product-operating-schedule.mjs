import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engineSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const engineUrl='data:text/javascript;base64,'+Buffer.from(transpile(engineSource)).toString('base64')
const flowSource=await readFile(new URL('../src/features/projects/inventoryProductionFlow.ts',import.meta.url),'utf8')
const flowUrl='data:text/javascript;base64,'+Buffer.from(transpile(flowSource)).toString('base64')
const controlSource=transpile(await readFile(new URL('../src/features/projects/inventoryControlLedgers.ts',import.meta.url),'utf8'))
const controlUrl='data:text/javascript;base64,'+Buffer.from(controlSource).toString('base64')
const source=await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8')
const output=transpile(source).replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl)).replace("'./inventoryControlLedgers'",JSON.stringify(controlUrl))
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
 {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
]
const base={
 sales:[{productId:'P1',inventoryPolicy:'manual',periods:[
  {period:'1',salesQuantity:80,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
   openingFinishedGoodsQuantity:10,openingFinishedGoodsValue:100,finishedGoodsClosingQuantity:30},
  {period:'2',salesQuantity:90,netUnitPrice:22,salesTaxPercent:0,subsidyPercent:5,subsidyAmount:null,
   openingFinishedGoodsQuantity:30,openingFinishedGoodsValue:300,finishedGoodsClosingQuantity:20},
 ]}],
 productionCosts:[{id:'cost-p1',metadata:{description:'Direct manufacturing cost',currencyCode:'IRR',escalationPercent:null},
  classification:'direct',productId:'P1',basis:'per-unit-output',standardQuantity:2,standardUnitPrice:5,
  standardTotal:10,nominalCapacity:null,fixedPercent:null,variablePercent:null,adjustments:[]}],
}
const result=module.buildProductOperatingSchedule(base,periods,1,'IRR')
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.rows.map(row=>row.productionQuantity),[100,80],
 'Production must equal sales plus closing stock less opening stock')
assert.deepEqual(result.rows.map(row=>row.productionCost),[1000,800])
assert.deepEqual(result.rows.map(row=>row.weightedAverageUnitCost),[10,10])
assert.deepEqual(result.rows.map(row=>row.costOfSales),[800,900])
assert.deepEqual(result.periodRevenue,[1600,2079])
assert.deepEqual(result.periodSubsidyIncome,[0,99])
assert.deepEqual(result.periodCostOfSales,[800,900])
assert.deepEqual(result.annualRevenue,[3679])
assert.deepEqual(result.annualCostOfSales,[1700])
assert.equal(result.totalProductionQuantity,180)
assert.equal(result.totalSalesQuantity,170)
assert.equal(result.totalClosingInventoryValue,500)

const badOpening=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[base.sales[0].periods[0],{...base.sales[0].periods[1],openingFinishedGoodsValue:301}]}]
},periods,1,'IRR')
assert.equal(badOpening.valid,false)
assert.ok(badOpening.issues.some(issue=>issue.includes('must reconcile to the prior-period closing value')))
const noCost=module.buildProductOperatingSchedule({...base,productionCosts:[]},periods,1,'IRR')
assert.equal(noCost.valid,false)
assert.ok(noCost.issues.some(issue=>issue.includes('requires either a validated direct production-cost basis')))
const unsupportedIndirect=module.buildProductOperatingSchedule({
 ...base,productionCosts:[{...base.productionCosts[0],classification:'indirect',productId:null}]
},periods,1,'IRR')
assert.equal(unsupportedIndirect.valid,false)
assert.ok(unsupportedIndirect.issues.some(issue=>issue.includes('not spread by assumption')))
const vat=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[{...base.sales[0].periods[0],salesTaxPercent:9},base.sales[0].periods[1]]}]
},periods,1,'IRR')
assert.equal(vat.valid,false)
assert.ok(vat.issues.some(issue=>issue.includes('sales tax/VAT')))
const negativeProduction=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:[{...base.sales[0].periods[0],salesQuantity:5,finishedGoodsClosingQuantity:0,openingFinishedGoodsQuantity:10},base.sales[0].periods[1]]}]
},periods,1,'IRR')
assert.equal(negativeProduction.valid,false)
assert.ok(negativeProduction.issues.some(issue=>issue.includes('sales exceed opening inventory plus non-negative production')))
const fxCost=module.buildProductOperatingSchedule({
 ...base,productionCosts:[{...base.productionCosts[0],metadata:{...base.productionCosts[0].metadata,currencyCode:'EUR'}}]
},periods,1,'IRR')
assert.equal(fxCost.valid,false)
assert.ok(fxCost.issues.some(issue=>issue.includes('foreign-currency schedule')))
const daysCoverageDraft={
 sales:[{productId:'P1',inventoryPolicy:'comfar-days-coverage',finishedGoodsDaysCoverage:30,
  productionStartPeriod:1,productionEndPeriod:2,periods:[
   {period:'1',salesQuantity:100,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:0,openingFinishedGoodsValue:0,finishedGoodsClosingQuantity:null},
   {period:'2',salesQuantity:100,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:null,openingFinishedGoodsValue:null,finishedGoodsClosingQuantity:null},
   {period:'3',salesQuantity:100*30/90,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
    openingFinishedGoodsQuantity:null,openingFinishedGoodsValue:null,finishedGoodsClosingQuantity:null},
  ]}],
 productionCosts:[{id:'cost-p1',metadata:{description:'Direct manufacturing cost',currencyCode:'IRR',escalationPercent:0},
  classification:'direct',productId:'P1',basis:'per-unit-output',standardQuantity:1,standardUnitPrice:10,
  standardTotal:null,nominalCapacity:null,fixedPercent:null,variablePercent:null,adjustments:[]}],
}
const coveragePeriods=[...periods,{index:3,startDate:'2025-07-01',endDate:'2025-09-30',days:92,partial:false}]
const coverageResult=module.buildProductOperatingSchedule(daysCoverageDraft,coveragePeriods,1,'IRR')
assert.equal(coverageResult.valid,true,coverageResult.issues.join('; '))
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.0001,'Expected '+b+', got '+a)
coverageResult.rows.filter(row=>row.productId==='P1').forEach((row,index)=>{
 close(row.closingInventoryQuantity,[100*30/90,100*30/90,0][index])
 // 30 days of cover = 30/90 of the quarter's sales, not 30/360.
 close(row.productionQuantity,[100+100*30/90,100,0][index])
})
const noLiquidation=module.buildProductOperatingSchedule({
 ...daysCoverageDraft,sales:[{...daysCoverageDraft.sales[0],periods:daysCoverageDraft.sales[0].periods.map((row,index)=>index===2?{...row,salesQuantity:0}:row)}]
},coveragePeriods,1,'IRR')
assert.equal(noLiquidation.valid,false)
assert.ok(noLiquidation.issues.some(issue=>issue.includes('unsold finished goods')))


const controlledDraft={
 ...base,
 sales:[{...base.sales[0],unitOfMeasure:'kg',periods:base.sales[0].periods.map((row,index)=>index===1?{...row,openingFinishedGoodsQuantity:20,openingFinishedGoodsValue:1150*20/110}:({...row}))},{...base.sales[0],productId:'P2',unitOfMeasure:'kg',periods:base.sales[0].periods.map((row,index)=>index===1?{...row,openingFinishedGoodsQuantity:40,openingFinishedGoodsValue:(100+1000+1150*10/110)*40/120}:({...row}))}],
 productionCosts:[...base.productionCosts,{...base.productionCosts[0],id:'cost-p2',productId:'P2'}],
 wasteLedgerEntries:[
  {id:'WN-1',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:5,unitCost:10,amount:50},
  {id:'WA-1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:2,unitCost:10,amount:20},
 ],
 productionTransfers:[
  {id:'TR-1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:1150*10/110},
 ],
}
const controlled=module.buildProductOperatingSchedule(controlledDraft,periods,1,'IRR')
assert.equal(controlled.valid,true,controlled.issues.join('; '))
const p1=controlled.rows.find(row=>row.productId==='P1'&&row.period===1)
const p2=controlled.rows.find(row=>row.productId==='P2'&&row.period===1)
assert.ok(Math.abs(p1.productionCost-(1050-1150*10/110))<1e-8,'normal waste is absorbed, then weighted-average transfer value is reclassified from source CPP')
assert.ok(Math.abs(p2.productionCost-(1000+1150*10/110))<1e-8,'transferred CPP is posted to destination without creating new total cost')
assert.equal(controlled.periodAbnormalWasteExpense[0],20,'abnormal waste is separated from inventory cost')
assert.equal(controlled.periodNormalWasteAbsorbed[0],50,'normal waste is disclosed as absorbed production cost')
assert.ok(Math.abs(p1.productionCost+p2.productionCost-2050)<1e-8,'inter-product transfer must preserve total CPP')
const p1Next=controlled.rows.find(row=>row.productId==='P1'&&row.period===2)
const p2Next=controlled.rows.find(row=>row.productId==='P2'&&row.period===2)
assert.equal(p1Next.openingInventoryQuantity,20,'source opening quantity carries forward after transfer')
assert.ok(Math.abs(p1Next.openingInventoryValue-1150*20/110)<1e-8,'source opening value carries forward after transfer')
assert.equal(p2Next.openingInventoryQuantity,40,'destination opening quantity carries forward after transfer')
assert.ok(Math.abs(p2Next.openingInventoryValue-(100+1000+1150*10/110)*40/120)<1e-8,'destination opening value carries forward after transfer')
assert.equal(p1.closingInventoryQuantity,20,'source finished-goods quantity is reduced by transferred source units')
assert.equal(p2.closingInventoryQuantity,40,'destination finished-goods quantity receives converted transfer units')
const wrongTransferCost=module.buildProductOperatingSchedule({...controlledDraft,productionTransfers:[{...controlledDraft.productionTransfers[0],costAmount:100}]},periods,1,'IRR')
assert.equal(wrongTransferCost.valid,false,'transfer value must reconcile to source weighted-average cost times transferred quantity')

const convertedDraft={...controlledDraft,sales:controlledDraft.sales.map((sale,index)=>({...sale,unitOfMeasure:index===0?'kg':'tonne',periods:sale.periods.map((row,periodIndex)=>periodIndex===1&&index===1?{...row,openingFinishedGoodsQuantity:30.01,openingFinishedGoodsValue:30.01*(100+1000+1150*10/110)/(10+100+0.01)}:row)})),productionTransfers:[{...controlledDraft.productionTransfers[0],quantity:10,sourceUnit:'kg',destinationUnit:'tonne',conversionFactor:0.001,costAmount:1150*10/110}]}
const convertedSchedule=module.buildProductOperatingSchedule(convertedDraft,periods,1,'IRR')
assert.equal(convertedSchedule.valid,true,convertedSchedule.issues.join('; '))
assert.equal(convertedSchedule.rows.find(row=>row.productId==='P1'&&row.period===1).closingInventoryQuantity,20)
assert.ok(Math.abs(convertedSchedule.rows.find(row=>row.productId==='P2'&&row.period===1).closingInventoryQuantity-30.01)<1e-8)

const duplicateWaste=module.buildProductOperatingSchedule({
 ...controlledDraft,
 sales:[{...controlledDraft.sales[0],periods:controlledDraft.sales[0].periods.map((row,index)=>index===0?{...row,rawMaterialWasteQuantity:2}:row)},controlledDraft.sales[1]]
},periods,1,'IRR')
assert.equal(duplicateWaste.valid,false,'normal waste must not be absorbed twice when already in inventory-flow waste')
const excessiveTransfer=module.buildProductOperatingSchedule({
 ...controlledDraft,productionTransfers:[{...controlledDraft.productionTransfers[0],costAmount:5000}]
},periods,1,'IRR')
assert.equal(excessiveTransfer.valid,false,'transfer value cannot exceed source-period production cost')

const openingStockTransferDraft={
 ...controlledDraft,
 sales:controlledDraft.sales.map((sale,index)=>({...sale,periods:sale.periods.map((row,periodIndex)=>
  index===0&&periodIndex===1?{...row,salesQuantity:10,finishedGoodsClosingQuantity:10}:row
 )})),
 productionTransfers:[
  ...controlledDraft.productionTransfers,
  {id:'TR-2',period:2,sourceProductId:'P1',destinationProductId:'P2',
   sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:5,
   sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,
   costAmount:(1150*20/110)/20*5},
 ],
}
const openingStockTransfer=module.buildProductOperatingSchedule(openingStockTransferDraft,periods,1,'IRR')
assert.equal(openingStockTransfer.valid,true,openingStockTransfer.issues.join('; '))
assert.equal(openingStockTransfer.rows.find(row=>row.productId==='P1'&&row.period===2).closingInventoryQuantity,5,
 'a transfer funded by opening finished-goods stock must reduce the source closing quantity')
assert.ok(Math.abs(openingStockTransfer.rows.find(row=>row.productId==='P2'&&row.period===2).productionCost-
 (700+(1150*20/110)/20*5))<1e-8,
 'opening-stock transfer value must be reclassified into the destination CPP without creating group cost')

// Same-period chained transfers: P1 -> P2 -> P3 must preserve group CPP and carry
// the intermediate weighted-average cost through each transfer without losing stock.
const chainedBase={
 ...controlledDraft,
 sales:controlledDraft.sales.map(sale=>({...sale,periods:sale.periods.map((row,index)=>index===1?{...row,openingFinishedGoodsQuantity:30,openingFinishedGoodsValue:sale.productId==='P1'?30*(100+1000+50)/110:300}:row)})).concat([
  {...controlledDraft.sales[1],productId:'P3',periods:controlledDraft.sales[1].periods.map((row,index)=>index===1?{...row,openingFinishedGoodsQuantity:30,openingFinishedGoodsValue:300}:({...row}))},
 ]),
 productionCosts:[...controlledDraft.productionCosts,{...controlledDraft.productionCosts[1],id:'cost-p3',productId:'P3'}],
 productionTransfers:[],
}
const chainedProbe=module.buildProductOperatingSchedule(chainedBase,periods,1,'IRR')
assert.equal(chainedProbe.valid,true,chainedProbe.issues.join('; '))
const p1Wac=(100+1000+50)/110
const transferOneCost=10*p1Wac
const p2Wac=(100+1000+transferOneCost)/(10+100+10)
const transferTwoCost=5*p2Wac
const chainedDraft={
 ...chainedBase,
 sales:chainedBase.sales.map(sale=>({...sale,periods:sale.periods.map((row,index)=>{
  if(index!==1)return row
  if(sale.productId==='P1')return {...row,openingFinishedGoodsQuantity:20,openingFinishedGoodsValue:20*p1Wac}
  if(sale.productId==='P2')return {...row,openingFinishedGoodsQuantity:35,openingFinishedGoodsValue:35*p2Wac}
  return {...row,openingFinishedGoodsQuantity:35,openingFinishedGoodsValue:35*(100+1000+transferTwoCost)/115}
 })})),
 productionTransfers:[
  {id:'CHAIN-1',period:1,sourceProductId:'P1',destinationProductId:'P2',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:transferOneCost},
  {id:'CHAIN-2',period:1,sourceProductId:'P2',destinationProductId:'P3',sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-C',quantity:5,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:transferTwoCost},
 ],
}
const chained=module.buildProductOperatingSchedule(chainedDraft,periods,1,'IRR')
assert.equal(chained.valid,true,chained.issues.join('; '))
const chainP1=chained.rows.find(row=>row.productId==='P1'&&row.period===1)
const chainP2=chained.rows.find(row=>row.productId==='P2'&&row.period===1)
const chainP3=chained.rows.find(row=>row.productId==='P3'&&row.period===1)
close(chainP1.closingInventoryQuantity,20)
close(chainP2.closingInventoryQuantity,35)
close(chainP3.closingInventoryQuantity,35)
close(chainP1.productionCost+chainP2.productionCost+chainP3.productionCost,3050)
close(chainP2.weightedAverageUnitCost,p2Wac)
close(chainP3.weightedAverageUnitCost,(100+1000+transferTwoCost)/115)
close(chained.rows.find(row=>row.productId==='P2'&&row.period===2).openingInventoryValue,35*p2Wac)
close(chained.rows.find(row=>row.productId==='P3'&&row.period===2).openingInventoryValue,35*(100+1000+transferTwoCost)/115)
assert.deepEqual([chainP1.productionQuantity,chainP2.productionQuantity,chainP3.productionQuantity],[100,110,105], 'destination-stage transfer quantities must be included in the destination product operating volume')

console.log('Product-by-product production, weighted-average inventory, COGS and sales validation passed.')

const flowProduct={
 sales:[{productId:'FLOW-1',inventoryPolicy:'manual',periods:[{
  period:'1',salesQuantity:80,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
  openingFinishedGoodsQuantity:10,openingFinishedGoodsValue:100,finishedGoodsClosingQuantity:30,
  openingRawMaterialQuantity:100,openingRawMaterialValue:1000,openingWipQuantity:0,openingWipMaterialValue:0,openingWipConversionValue:0,
  rawMaterialPurchasesQuantity:100,rawMaterialPurchasesValue:1200,rawMaterialConsumptionQuantity:120,rawMaterialWasteQuantity:5,
  unitsStarted:120,unitsCompleted:100,closingWipQuantity:20,materialCompletionPercent:100,
  conversionCompletionPercent:50,conversionCost:500,
 }]}],
 productionCosts:[],
}
const flowSchedule=module.buildProductOperatingSchedule(flowProduct,[periods[0]],1,'IRR')
assert.equal(flowSchedule.valid,true,flowSchedule.issues.join('; '))
assert.equal(flowSchedule.hasInventoryFlow,true)
assert.equal(flowSchedule.rows[0].productionQuantity,100)
assert.equal(flowSchedule.rows[0].completedUnits,100)
assert.ok(Math.abs(flowSchedule.rows[0].productionCost-flowSchedule.rows[0].unitProductionCost*100)<1e-7)
assert.equal(flowSchedule.periodRawMaterialInventoryValue[0],825)
assert.equal(flowSchedule.periodNormalWasteAbsorbed[0],55,'normal waste valued from raw-material WAC must be disclosed as absorbed CPP')
assert.equal(flowSchedule.rows[0].rawMaterialInventoryValue,825)
assert.ok(flowSchedule.periodWipInventoryValue[0]>0)
assert.equal(flowSchedule.rows[0].costOfSales,flowSchedule.rows[0].weightedAverageUnitCost*80)
assert.equal(flowSchedule.rows[0].closingInventoryValue,flowSchedule.rows[0].weightedAverageUnitCost*30)
const badFlow=module.buildProductOperatingSchedule({
 ...flowProduct,sales:[{...flowProduct.sales[0],periods:[{...flowProduct.sales[0].periods[0],unitsStarted:119,unitsCompleted:99}]}]
},[periods[0]],1,'IRR')
assert.equal(badFlow.valid,false)
assert.ok(badFlow.issues.some(issue=>issue.includes('completed production quantity must equal')))

console.log('Product schedule posts completed production from raw-material/WIP ledger and recognizes cost of sales only on sales.');
