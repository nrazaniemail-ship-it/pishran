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
const controlModule=await import(controlUrl)
const integrationSource=await readFile(new URL('../src/features/projects/cppCpsScheduleIntegration.ts',import.meta.url),'utf8')
const integrationModule=await import('data:text/javascript;base64,'+Buffer.from(transpile(integrationSource)).toString('base64'))
const source=await readFile(new URL('../src/features/projects/productOperatingSchedule.ts',import.meta.url),'utf8')
const output=transpile(source).replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl)).replace("'./inventoryProductionFlow'",JSON.stringify(flowUrl)).replace("'./inventoryControlLedgers'",JSON.stringify(controlUrl))
const module=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-03-31',days:90,partial:false},
 {index:2,startDate:'2025-04-01',endDate:'2025-06-30',days:91,partial:false},
]
const base={
 sales:[{productId:'P1',unitOfMeasure:'kg',inventoryPolicy:'manual',periods:[
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
const carriedOpeningValue=module.buildProductOperatingSchedule({
 ...base,sales:[{...base.sales[0],periods:base.sales[0].periods.map((row,index)=>index===1?{...row,openingFinishedGoodsValue:null}:row)}]
},periods,1,'IRR')
assert.equal(carriedOpeningValue.valid,true,carriedOpeningValue.issues.join('; '))
assert.equal(carriedOpeningValue.rows[1].openingInventoryValue,300,
 'An omitted manual opening stock value must carry forward the prior calculated closing value, not default to zero')

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
 ...base,sales:[{...base.sales[0],periods:[{...base.sales[0].periods[0],salesTaxPercent:9,salesTaxSourceReference:'VAT statute article 1',salesTaxSourceVerified:true},base.sales[0].periods[1]]}]
},periods,1,'IRR')
assert.equal(vat.valid,true,vat.issues.join('; '))
assert.deepEqual(vat.periodOutputSalesTax,[144,0])
assert.equal(vat.rows.find(row=>row.period===1)?.taxableSales,1600)
assert.equal(vat.rows.find(row=>row.period===1)?.netSalesRevenue,1600)
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
  {id:'WN-1',period:1,productId:'P1',costCentreId:'CC-A',classification:'normal',quantity:5,unitCost:10,amount:50,sourceReference:'normal-waste-report-p1',sourceVerified:true},
  {id:'WA-1',period:1,productId:'P1',costCentreId:'CC-A',classification:'abnormal',quantity:2,unitCost:10,amount:20,sourceReference:'abnormal-incident-report-p1',sourceVerified:true},
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
 sales:[{...controlledDraft.sales[0],periods:controlledDraft.sales[0].periods.map((row,index)=>index===0?{...row,normalRawMaterialWasteQuantity:2}:row)},controlledDraft.sales[1]]
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

// A transfer between cost centres of the same product is an internal
// reclassification at product-schedule level: it must not create output or COGS.
const sameProductCentreTransfer=module.buildProductOperatingSchedule({
 ...base,
 productionTransfers:[
  {id:'INTRA-1',period:1,sourceProductId:'P1',destinationProductId:'P1',
   sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,
   sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
 ],
},periods,1,'IRR')
assert.equal(sameProductCentreTransfer.valid,true,sameProductCentreTransfer.issues.join('; '))
const intraRow=sameProductCentreTransfer.rows.find(row=>row.productId==='P1'&&row.period===1)
assert.equal(intraRow.productionQuantity,100,'intra-product transfer must not inflate production volume')
assert.equal(intraRow.productionCost,1000,'intra-product transfer must not duplicate or remove CPP')
assert.equal(intraRow.closingInventoryQuantity,30,'intra-product transfer must not change aggregate finished-goods quantity')
assert.equal(intraRow.closingInventoryValue,300,'intra-product transfer must not revalue aggregate finished goods')
assert.equal(intraRow.costOfSales,800,'intra-product transfer must not distort cost of sales')
const overTransferredIntra=module.buildProductOperatingSchedule({
 ...base,
 productionTransfers:[
  {id:'INTRA-1',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:20,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:200},
  {id:'INTRA-2',period:1,sourceProductId:'P1',destinationProductId:'P1',sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-C',quantity:20,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:200},
 ],
},periods,1,'IRR')
assert.equal(overTransferredIntra.valid,false,'multiple internal transfers cannot exceed aggregate source closing quantity')


// Three-period round trip between centres of the same product must be invisible
// to product CPP, weighted-average valuation, COGS and finished-goods working capital.
const roundTripSameProduct=module.buildProductOperatingSchedule({
 ...base,
 productionTransfers:[
  {id:'RT-OUT',period:1,sourceProductId:'P1',destinationProductId:'P1',
   sourceCostCentreId:'CC-A',destinationCostCentreId:'CC-B',quantity:10,
   sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:100},
  {id:'RT-RETURN',period:2,sourceProductId:'P1',destinationProductId:'P1',
   sourceCostCentreId:'CC-B',destinationCostCentreId:'CC-A',quantity:5,
   sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,costAmount:50},
 ],
},periods,1,'IRR')
assert.equal(roundTripSameProduct.valid,true,roundTripSameProduct.issues.join('; '))
assert.deepEqual(roundTripSameProduct.rows.map(row=>row.productionQuantity),result.rows.map(row=>row.productionQuantity))
assert.deepEqual(roundTripSameProduct.rows.map(row=>row.productionCost),result.rows.map(row=>row.productionCost))
assert.deepEqual(roundTripSameProduct.rows.map(row=>row.costOfSales),result.rows.map(row=>row.costOfSales),
 'returning stock to its original centre in a later period must not reverse or duplicate sales COGS')
assert.deepEqual(roundTripSameProduct.rows.map(row=>row.closingInventoryQuantity),result.rows.map(row=>row.closingInventoryQuantity))
assert.deepEqual(roundTripSameProduct.rows.map(row=>row.closingInventoryValue),result.rows.map(row=>row.closingInventoryValue))
assert.deepEqual(roundTripSameProduct.periodCostOfSales,result.periodCostOfSales)
assert.equal(roundTripSameProduct.totalProductionQuantity,result.totalProductionQuantity)
assert.equal(roundTripSameProduct.totalClosingInventoryValue,result.totalClosingInventoryValue)
const roundTripWorkingCapital=integrationModule.bindFinishedGoodsInventoryToWorkingCapital([0,0],roundTripSameProduct,false)
assert.equal(roundTripWorkingCapital.valid,true,roundTripWorkingCapital.issues.join('; '))
assert.deepEqual(roundTripWorkingCapital.closingWorkingCapitalByPeriod,
 result.rows.map(row=>row.closingInventoryValue),
 'finished goods must enter working capital once, regardless of centre transfer and reversal');
assert.deepEqual(roundTripWorkingCapital.inventoryAddedByPeriod,
 result.rows.map(row=>row.closingInventoryValue));

console.log('Product-by-product production, weighted-average inventory, COGS and sales validation passed.')

const flowProduct={
 sales:[{productId:'FLOW-1',inventoryPolicy:'manual',periods:[{
  period:'1',salesQuantity:80,netUnitPrice:20,salesTaxPercent:0,subsidyPercent:null,subsidyAmount:null,
  openingFinishedGoodsQuantity:10,openingFinishedGoodsValue:100,finishedGoodsClosingQuantity:30,
  openingRawMaterialQuantity:100,openingRawMaterialValue:1000,openingWipQuantity:0,openingWipMaterialValue:0,openingWipConversionValue:0,
  rawMaterialPurchasesQuantity:100,rawMaterialPurchasesValue:1200,rawMaterialConsumptionQuantity:120,normalRawMaterialWasteQuantity:5,abnormalRawMaterialWasteQuantity:2,
  unitsStarted:120,unitsCompleted:100,closingWipQuantity:20,materialCompletionPercent:100,
  conversionCompletionPercent:50,conversionCost:500,abnormalWasteSourceReference:'incident-report-page-3',abnormalWasteSourceVerified:true,
 }]}],
 productionCosts:[],
}
const flowSchedule=module.buildProductOperatingSchedule(flowProduct,[periods[0]],1,'IRR')
assert.equal(flowSchedule.valid,true,flowSchedule.issues.join('; '))
assert.equal(flowSchedule.hasInventoryFlow,true)
const abnormalWasteJournal=controlModule.buildAbnormalWasteAccountingPostings([],1,flowSchedule.rows.map(row=>({
 period:row.period,productId:row.productId,abnormalWasteValue:row.abnormalWasteValue,
 abnormalWasteSourceReference:row.abnormalWasteSourceReference,
 abnormalWasteSourceVerified:row.abnormalWasteSourceVerified,
})))
assert.equal(abnormalWasteJournal.valid,true,abnormalWasteJournal.issues.join('; '))
assert.equal(abnormalWasteJournal.postings.length,1)
assert.equal(abnormalWasteJournal.postings[0].period,1)
assert.equal(abnormalWasteJournal.postings[0].amount,22)
assert.equal(abnormalWasteJournal.postings[0].sourceReference,'incident-report-page-3',
 'The append-only journal trace must retain the exact verified incident source used by the production flow.')
assert.equal(controlModule.canPersistStageAccountingPostings(true,null,true,'FS00-PROJECT'),true,
 'A valid abnormal-waste journal must persist even when no optional cost-centre inventory ledger is supplied.')
assert.equal(controlModule.canPersistStageAccountingPostings(true,{valid:true},true,'FS00-PROJECT'),true)
assert.equal(controlModule.canPersistStageAccountingPostings(true,{valid:false},true,'FS00-PROJECT'),false,
 'An explicitly supplied but invalid cost-centre inventory ledger must still block journal persistence.')
assert.equal(controlModule.canPersistStageAccountingPostings(false,null,true,'FS00-PROJECT'),false)
assert.equal(controlModule.canPersistStageAccountingPostings(true,null,false,'FS00-PROJECT'),false)
assert.equal(controlModule.canPersistStageAccountingPostings(true,null,true,''),false)
const advancedFinancePanelSource=await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx',import.meta.url),'utf8')
assert.ok(advancedFinancePanelSource.includes('periodAbnormalWasteExpense:productOperatingSchedule?.valid?productOperatingSchedule.periodAbnormalWasteExpense:undefined'),
 'The live finance panel must pass the product schedule abnormal-waste expense into the periodic engine.')
assert.ok(advancedFinancePanelSource.includes('canPersistStageAccountingPostings(stageJournalLoaded,stageInventoryReconciliation,abnormalWasteAccounting.valid,props.projectId)'),
 'The live persistence effect must permit abnormal-waste-only journals while retaining invalid-ledger blocking.')
assert.equal(flowSchedule.rows[0].productionQuantity,100)
assert.equal(flowSchedule.rows[0].completedUnits,100)
assert.ok(Math.abs(flowSchedule.rows[0].productionCost-flowSchedule.rows[0].unitProductionCost*100)<1e-7)
assert.equal(flowSchedule.periodRawMaterialInventoryValue[0],803)
assert.equal(flowSchedule.periodNormalWasteAbsorbed[0],55,'normal waste valued from raw-material WAC must be disclosed as absorbed CPP')
assert.equal(flowSchedule.periodAbnormalWasteExpense[0],22,'abnormal waste must be expensed at weighted-average raw-material cost, not capitalized into WIP or finished goods')
const missingAbnormalWasteEvidence=module.buildProductOperatingSchedule({...flowProduct,sales:[{...flowProduct.sales[0],periods:[{...flowProduct.sales[0].periods[0],abnormalWasteSourceVerified:false}]}]},[periods[0]],1,'IRR')
assert.equal(missingAbnormalWasteEvidence.valid,false,'positive abnormal-waste quantity without verified incident evidence must block the product schedule')
assert.ok(missingAbnormalWasteEvidence.issues.some(issue=>issue.includes('verified abnormal-waste incident source reference')))
const duplicatedAbnormalWaste=module.buildProductOperatingSchedule({...flowProduct,wasteLedgerEntries:[{id:'ABN-DUP',period:1,productId:'FLOW-1',costCentreId:'CC-WASTE',classification:'abnormal',quantity:2,unitCost:11,amount:22,sourceReference:'incident-report-page-3',sourceVerified:true}]},[periods[0]],1,'IRR')
assert.equal(duplicatedAbnormalWaste.valid,false,'abnormal waste represented in both production flow and waste ledger must be rejected instead of expensed twice')
assert.ok(duplicatedAbnormalWaste.issues.some(issue=>issue.includes('duplicate expense is blocked')))
assert.equal(flowSchedule.rows[0].rawMaterialInventoryValue,803)
assert.ok(flowSchedule.periodWipInventoryValue[0]>0)
assert.equal(flowSchedule.rows[0].costOfSales,flowSchedule.rows[0].weightedAverageUnitCost*80)
assert.equal(flowSchedule.rows[0].closingInventoryValue,flowSchedule.rows[0].weightedAverageUnitCost*30)
const badFlow=module.buildProductOperatingSchedule({
 ...flowProduct,sales:[{...flowProduct.sales[0],periods:[{...flowProduct.sales[0].periods[0],unitsStarted:119,unitsCompleted:99}]}]
},[periods[0]],1,'IRR')
assert.equal(badFlow.valid,false)
assert.ok(badFlow.issues.some(issue=>issue.includes('completed production quantity must equal')))

console.log('Product schedule posts completed production from raw-material/WIP ledger and recognizes cost of sales only on sales.');


// End-to-end accounting bridge: product schedule -> inventory working capital ->
// periodic finance engine -> linked three-statement balance sheet.
const financialEngine=await import(engineUrl)
const closingFinishedGoods=flowSchedule.rows.reduce((sum,row)=>sum+row.closingInventoryValue,0)
const closingInventory=flowSchedule.periodRawMaterialInventoryValue[0]+
  flowSchedule.periodWipInventoryValue[0]+closingFinishedGoods
const openingInventory=1000+0+100
const integrated=financialEngine.calculateIntegratedPeriodicFinance({
 periods:[periods[0]],fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[flowSchedule.annualRevenue[0]],
 periodRevenue:[flowSchedule.periodRevenue[0]],
 annualVariableCost:[flowSchedule.annualCostOfSales[0]],
 periodVariableCost:[flowSchedule.periodCostOfSales[0]],
 periodAbnormalWasteExpense:flowSchedule.periodAbnormalWasteExpense,
 annualFixedCost:[0],annualDepreciation:[0],annualFixedInvestment:[0],
 annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[0],
 annualEquityContributions:[0],
 workingCapitalByPeriod:[closingInventory],
 rawMaterialsInventoryByPeriod:[flowSchedule.periodRawMaterialInventoryValue[0]],
 workInProgressInventoryByPeriod:[flowSchedule.periodWipInventoryValue[0]],
 finishedGoodsInventoryByPeriod:[closingFinishedGoods],
 openingWorkingCapital:openingInventory,openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(integrated.valid,true,integrated.warnings.join('; '))
assert.equal(integrated.rows.length,1)
close(integrated.rows[0].revenue,flowSchedule.periodRevenue[0])
close(integrated.rows[0].variableCost,flowSchedule.periodCostOfSales[0])
close(integrated.rows[0].abnormalWasteExpense,flowSchedule.periodAbnormalWasteExpense[0])
close(integrated.rows[0].ebit,flowSchedule.periodRevenue[0]-flowSchedule.periodCostOfSales[0]-flowSchedule.periodAbnormalWasteExpense[0],
 'The period engine must receive abnormal waste from the product schedule as a separate expense, outside COGS.')
close(integrated.rows[0].rawMaterialsInventory,flowSchedule.periodRawMaterialInventoryValue[0])
close(integrated.rows[0].workInProgressInventory,flowSchedule.periodWipInventoryValue[0])
close(integrated.rows[0].finishedGoodsInventory,closingFinishedGoods)
close(integrated.rows[0].closingWorkingCapital,closingInventory)
close(integrated.rows[0].changeInWorkingCapital,closingInventory-openingInventory)
const integratedStatements=financialEngine.buildPeriodicThreeFinancialStatements(integrated,{
 cash:0,debt:0,netFixedAssets:0,netWorkingCapital:openingInventory,
 rawMaterialsInventory:1000,workInProgressInventory:0,finishedGoodsInventory:100,
 paidInCapital:openingInventory,
})
assert.equal(integratedStatements.length,1)
const integratedBalanceSheet=integratedStatements[0].balanceSheet
assert.equal(integratedBalanceSheet.reconciled,true,
  'Product-derived inventory, working-capital movement, retained earnings and cash must reconcile without a balance-sheet plug')
close(integratedBalanceSheet.rawMaterialsInventory,flowSchedule.periodRawMaterialInventoryValue[0])
close(integratedBalanceSheet.workInProgressInventory,flowSchedule.periodWipInventoryValue[0])
close(integratedBalanceSheet.finishedGoodsInventory,closingFinishedGoods)
close(integratedBalanceSheet.netWorkingCapital,closingInventory)
close(integratedBalanceSheet.rawMaterialsInventory+integratedBalanceSheet.workInProgressInventory+
  integratedBalanceSheet.finishedGoodsInventory+integratedBalanceSheet.otherNetWorkingCapital,
  integratedBalanceSheet.netWorkingCapital)
close(integratedStatements[0].movementChecks.netWorkingCapital,0)
close(integratedStatements[0].incomeStatement.abnormalWasteExpense,22)
close(integratedStatements[0].incomeStatement.netIncome,integrated.rows[0].ebit,
 'The abnormal-waste expense must flow into net income exactly once.')
close(integratedStatements[0].balanceSheet.retainedEarnings,-integratedStatements[0].incomeStatement.netIncome*-1,
 'Retained earnings must reflect the actual period net income without a balancing plug.')
const noWasteInventory=closingInventory+flowSchedule.periodAbnormalWasteExpense[0]
const integratedWithoutAbnormalWaste=financialEngine.calculateIntegratedPeriodicFinance({
 periods:[periods[0]],fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[flowSchedule.annualRevenue[0]],periodRevenue:[flowSchedule.periodRevenue[0]],
 annualVariableCost:[flowSchedule.annualCostOfSales[0]],periodVariableCost:[flowSchedule.periodCostOfSales[0]],
 annualFixedCost:[0],annualDepreciation:[0],annualFixedInvestment:[0],
 annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[0],
 annualEquityContributions:[0],workingCapitalByPeriod:[noWasteInventory],
 rawMaterialsInventoryByPeriod:[flowSchedule.periodRawMaterialInventoryValue[0]+flowSchedule.periodAbnormalWasteExpense[0]],
 workInProgressInventoryByPeriod:[flowSchedule.periodWipInventoryValue[0]],
 finishedGoodsInventoryByPeriod:[closingFinishedGoods],
 openingWorkingCapital:openingInventory,openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(integratedWithoutAbnormalWaste.valid,true,integratedWithoutAbnormalWaste.warnings.join('; '))
close(integratedWithoutAbnormalWaste.rows[0].variableCost,integrated.rows[0].variableCost,
 'Abnormal waste must not be reclassified into COGS.')
close(integratedWithoutAbnormalWaste.rows[0].ebit-integrated.rows[0].ebit,22,
 'The verified abnormal-waste event must reduce EBIT exactly once.')
close(integratedWithoutAbnormalWaste.rows[0].changeInWorkingCapital-integrated.rows[0].changeInWorkingCapital,22,
 'The raw-material write-off must reduce closing working capital once.')
close(integratedWithoutAbnormalWaste.rows[0].closingCash,integrated.rows[0].closingCash,
 'The non-cash inventory write-off must not create a second cash outflow.')
const noWasteStatements=financialEngine.buildPeriodicThreeFinancialStatements(integratedWithoutAbnormalWaste,{
 cash:0,debt:0,netFixedAssets:0,netWorkingCapital:openingInventory,
 rawMaterialsInventory:1000,workInProgressInventory:0,finishedGoodsInventory:100,
 paidInCapital:openingInventory,
})
assert.equal(noWasteStatements[0].balanceSheet.reconciled,true)
close(noWasteStatements[0].incomeStatement.netIncome-integratedStatements[0].incomeStatement.netIncome,22)
close(noWasteStatements[0].balanceSheet.rawMaterialsInventory-integratedStatements[0].balanceSheet.rawMaterialsInventory,22)
close(noWasteStatements[0].balanceSheet.netWorkingCapital-integratedStatements[0].balanceSheet.netWorkingCapital,22)
close(noWasteStatements[0].cashFlowStatement.closingCash-integratedStatements[0].cashFlowStatement.closingCash,0)
console.log('End-to-end abnormal-waste journal trace -> raw-material inventory -> CPP/CPS/WIP/FG -> COGS -> working capital -> income, cash-flow and balance-sheet statements passed.')

 
// Two-period end-to-end roll-forward: raw materials -> WIP -> finished goods -> sales/COGS.
// Period 2 must open from period 1 closing quantities and values at every inventory stage.
const multiPeriodFlowProduct={
 ...flowProduct,
 sales:[{...flowProduct.sales[0],periods:[
  {...flowProduct.sales[0].periods[0]},
  {...flowProduct.sales[0].periods[0],
   period:'2',salesQuantity:100,netUnitPrice:22,
   openingFinishedGoodsQuantity:30,openingFinishedGoodsValue:flowSchedule.rows[0].closingInventoryValue,
   finishedGoodsClosingQuantity:20,
   rawMaterialPurchasesQuantity:0,rawMaterialPurchasesValue:0,
   rawMaterialConsumptionQuantity:20,normalRawMaterialWasteQuantity:0,abnormalRawMaterialWasteQuantity:0,
   unitsStarted:80,unitsCompleted:90,closingWipQuantity:10,
   materialCompletionPercent:100,conversionCompletionPercent:50,conversionCost:400,
  },
 ]}],
}
const multiPeriodSchedule=module.buildProductOperatingSchedule(multiPeriodFlowProduct,periods,1,'IRR')
assert.equal(multiPeriodSchedule.valid,true,multiPeriodSchedule.issues.join('; '))
assert.deepEqual(multiPeriodSchedule.rows.map(row=>row.productionQuantity),[100,90])
const multiPeriodWasteOriginal=controlModule.buildAbnormalWasteAccountingPostings([],2,multiPeriodSchedule.rows.map(row=>({
 period:row.period,productId:row.productId,abnormalWasteValue:row.abnormalWasteValue,
 abnormalWasteSourceReference:row.abnormalWasteSourceReference,
 abnormalWasteSourceVerified:row.abnormalWasteSourceVerified,
}))).postings[0]
assert.ok(multiPeriodWasteOriginal,'The period-1 abnormal-waste source must create one original journal document.')
const multiPeriodWasteReversal={
 id:'REV-ABNORMAL-WASTE-P1-P2',period:2,kind:'abnormal-waste',productId:'FLOW-1',
 sourceReference:'REVERSAL:'+multiPeriodWasteOriginal.id,
 debitAccount:multiPeriodWasteOriginal.creditAccount,
 creditAccount:multiPeriodWasteOriginal.debitAccount,
 amount:multiPeriodWasteOriginal.amount,documentType:'reversal',
 originalDocumentId:multiPeriodWasteOriginal.id,
}
const reversedWasteSchedule=integrationModule.applyStageJournalCorrectionsToProductSchedule(
 multiPeriodSchedule,[{...multiPeriodWasteOriginal,documentType:'original'},multiPeriodWasteReversal],[0,0])
assert.equal(reversedWasteSchedule.valid,true,reversedWasteSchedule.issues.join('; '))
assert.deepEqual(reversedWasteSchedule.schedule.periodAbnormalWasteExpense,[22,-22],
 'A reversal must credit abnormal-waste expense only in its own posting period, leaving the original period unchanged.')
assert.equal(reversedWasteSchedule.schedule.periodRawMaterialInventoryValue[0],multiPeriodSchedule.periodRawMaterialInventoryValue[0])
assert.equal(reversedWasteSchedule.schedule.periodRawMaterialInventoryValue[1],
 multiPeriodSchedule.periodRawMaterialInventoryValue[1]+22,
 'A later reversal must restore raw-material inventory from its own period onward.')
assert.equal(reversedWasteSchedule.schedule.rows.find(row=>row.period===2).abnormalWasteValue,-22)
const incrementalWasteAdjustment={
 id:'ADJ-ABNORMAL-WASTE-P2',period:2,kind:'abnormal-waste',productId:'FLOW-1',
 sourceReference:'ADJUST:'+multiPeriodWasteOriginal.id,
 debitAccount:multiPeriodWasteOriginal.debitAccount,
 creditAccount:multiPeriodWasteOriginal.creditAccount,
 amount:5,documentType:'adjustment',adjustmentOfDocumentId:multiPeriodWasteOriginal.id,
}
const adjustedWasteSchedule=integrationModule.applyStageJournalCorrectionsToProductSchedule(
 multiPeriodSchedule,[{...multiPeriodWasteOriginal,documentType:'original'},incrementalWasteAdjustment],[0,0])
assert.equal(adjustedWasteSchedule.valid,true,adjustedWasteSchedule.issues.join('; '))
assert.deepEqual(adjustedWasteSchedule.schedule.periodAbnormalWasteExpense,[22,5],
 'An adjustment must add only its incremental expense in its own period.')
assert.equal(adjustedWasteSchedule.schedule.periodRawMaterialInventoryValue[1],
 multiPeriodSchedule.periodRawMaterialInventoryValue[1]-5,
 'An incremental abnormal-waste adjustment must reduce raw-material inventory once from its posting period onward.')
assert.ok(Math.abs(multiPeriodSchedule.rows[1].openingInventoryValue-multiPeriodSchedule.rows[0].closingInventoryValue)<1e-8,
 'Finished-goods opening value must carry forward from prior-period closing value')
assert.ok(Math.abs(multiPeriodSchedule.rows[1].openingInventoryQuantity-multiPeriodSchedule.rows[0].closingInventoryQuantity)<1e-8,
 'Finished-goods opening quantity must carry forward from prior-period closing quantity')
assert.ok(Math.abs(multiPeriodSchedule.rows[1].rawMaterialInventoryValue-
 multiPeriodSchedule.rows[0].rawMaterialInventoryValue+220)<1e-7,
 'Period-2 raw-material closing value must reflect the 20-unit issue at the carried weighted-average material cost')
assert.ok(multiPeriodSchedule.periodWipInventoryValue[1]>=0)
assert.ok(Math.abs(multiPeriodSchedule.rows[1].wipInventoryValue-multiPeriodSchedule.periodWipInventoryValue[1])<1e-8)
assert.ok(Math.abs(multiPeriodSchedule.periodCostOfSales[1]-multiPeriodSchedule.rows[1].costOfSales)<1e-8,
 'Period-2 COGS must be recognized once against sales, not against production transfers')
const multiPeriodFinishedGoods=periods.map((_,index)=>multiPeriodSchedule.rows
 .filter(row=>row.period===index+1).reduce((sum,row)=>sum+row.closingInventoryValue,0))
const multiPeriodInventory=periods.map((_,index)=>
 (multiPeriodSchedule.periodRawMaterialInventoryValue[index]??0)+
 (multiPeriodSchedule.periodWipInventoryValue[index]??0)+multiPeriodFinishedGoods[index])
const multiPeriodOpeningInventory=1000+0+100
const multiPeriodIntegrated=financialEngine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:multiPeriodSchedule.annualRevenue,periodRevenue:multiPeriodSchedule.periodRevenue,
 annualVariableCost:multiPeriodSchedule.annualCostOfSales,periodVariableCost:multiPeriodSchedule.periodCostOfSales,
 periodAbnormalWasteExpense:multiPeriodSchedule.periodAbnormalWasteExpense,
 annualFixedCost:[0],annualDepreciation:[0],annualFixedInvestment:[0],
 annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[0],
 annualEquityContributions:[0],workingCapitalByPeriod:multiPeriodInventory,
 rawMaterialsInventoryByPeriod:multiPeriodSchedule.periodRawMaterialInventoryValue,
 workInProgressInventoryByPeriod:multiPeriodSchedule.periodWipInventoryValue,
 finishedGoodsInventoryByPeriod:multiPeriodFinishedGoods,
 openingWorkingCapital:multiPeriodOpeningInventory,openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(multiPeriodIntegrated.valid,true,multiPeriodIntegrated.warnings.join('; '))
assert.deepEqual(multiPeriodIntegrated.rows.map(row=>row.variableCost),multiPeriodSchedule.periodCostOfSales,
 'Periodic engine must consume product-schedule COGS exactly once in each period')
for(let index=0;index<periods.length;index++){
 const row=multiPeriodIntegrated.rows[index]
 close(row.rawMaterialsInventory,multiPeriodSchedule.periodRawMaterialInventoryValue[index])
 close(row.workInProgressInventory,multiPeriodSchedule.periodWipInventoryValue[index])
 close(row.finishedGoodsInventory,multiPeriodFinishedGoods[index])
 close(row.closingWorkingCapital,multiPeriodInventory[index])
 close(row.changeInWorkingCapital,multiPeriodInventory[index]-(index===0?multiPeriodOpeningInventory:multiPeriodInventory[index-1]))
}
const multiPeriodStatements=financialEngine.buildPeriodicThreeFinancialStatements(multiPeriodIntegrated,{
 cash:0,debt:0,netFixedAssets:0,netWorkingCapital:multiPeriodOpeningInventory,
 rawMaterialsInventory:1000,workInProgressInventory:0,finishedGoodsInventory:100,
 paidInCapital:multiPeriodOpeningInventory,
})
assert.equal(multiPeriodStatements.length,2)
assert.ok(multiPeriodStatements.every(row=>row.balanceSheet.reconciled),
 'Both periods must reconcile without a balance-sheet plug after raw-material, WIP and finished-goods roll-forward')
for(let index=0;index<periods.length;index++){
 const bs=multiPeriodStatements[index].balanceSheet
 close(bs.rawMaterialsInventory,multiPeriodSchedule.periodRawMaterialInventoryValue[index])
 close(bs.workInProgressInventory,multiPeriodSchedule.periodWipInventoryValue[index])
 close(bs.finishedGoodsInventory,multiPeriodFinishedGoods[index])
 close(bs.netWorkingCapital,multiPeriodInventory[index])
 close(multiPeriodStatements[index].movementChecks.netWorkingCapital,0)
}
const reversedWasteFinishedGoods=multiPeriodFinishedGoods
const reversedWasteInventory=periods.map((_,index)=>
 reversedWasteSchedule.schedule.periodRawMaterialInventoryValue[index]+
 reversedWasteSchedule.schedule.periodWipInventoryValue[index]+reversedWasteFinishedGoods[index])
const reversedWasteFinance=financialEngine.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:reversedWasteSchedule.schedule.annualRevenue,
 periodRevenue:reversedWasteSchedule.schedule.periodRevenue,
 annualVariableCost:reversedWasteSchedule.schedule.annualCostOfSales,
 periodVariableCost:reversedWasteSchedule.schedule.periodCostOfSales,
 periodAbnormalWasteExpense:reversedWasteSchedule.schedule.periodAbnormalWasteExpense,
 annualFixedCost:[0],annualDepreciation:[0],annualFixedInvestment:[0],
 annualPreOperatingCost:[0],annualMaintenanceCapex:[0],annualTaxRates:[0],
 annualEquityContributions:[0],workingCapitalByPeriod:reversedWasteInventory,
 rawMaterialsInventoryByPeriod:reversedWasteSchedule.schedule.periodRawMaterialInventoryValue,
 workInProgressInventoryByPeriod:reversedWasteSchedule.schedule.periodWipInventoryValue,
 finishedGoodsInventoryByPeriod:reversedWasteFinishedGoods,
 openingWorkingCapital:multiPeriodOpeningInventory,openingCash:0,loans:[],discountRatePercent:10,
})
assert.equal(reversedWasteFinance.valid,true,reversedWasteFinance.warnings.join('; '))
assert.deepEqual(reversedWasteFinance.rows.map(row=>row.abnormalWasteExpense),[22,-22])
close(reversedWasteFinance.rows[0].ebit,multiPeriodIntegrated.rows[0].ebit,
 'The later reversal must not rewrite the original posting-period EBIT.')
close(reversedWasteFinance.rows[1].ebit-multiPeriodIntegrated.rows[1].ebit,22,
 'The reversal credit must increase EBIT only in its own period.')
close(reversedWasteFinance.rows[1].changeInWorkingCapital-multiPeriodIntegrated.rows[1].changeInWorkingCapital,22,
 'The restored raw-material balance must enter working capital only from the reversal period.')
close(reversedWasteFinance.rows[1].projectFreeCashFlow,multiPeriodIntegrated.rows[1].projectFreeCashFlow,
 'The non-cash reversal must not create a cash inflow when the matching inventory increase is already in working capital.')
close(reversedWasteFinance.rows[1].closingCash,multiPeriodIntegrated.rows[1].closingCash)
const reversedWasteStatements=financialEngine.buildPeriodicThreeFinancialStatements(reversedWasteFinance,{
 cash:0,debt:0,netFixedAssets:0,netWorkingCapital:multiPeriodOpeningInventory,
 rawMaterialsInventory:1000,workInProgressInventory:0,finishedGoodsInventory:100,
 paidInCapital:multiPeriodOpeningInventory,
})
assert.equal(reversedWasteStatements.length,2)
assert.ok(reversedWasteStatements.every(row=>row.balanceSheet.reconciled),
 'The abnormal-waste reversal must reconcile through all three statements without a balance-sheet plug.')
close(reversedWasteStatements[0].incomeStatement.netIncome,multiPeriodStatements[0].incomeStatement.netIncome)
close(reversedWasteStatements[1].incomeStatement.netIncome-multiPeriodStatements[1].incomeStatement.netIncome,22)
close(reversedWasteStatements[1].balanceSheet.rawMaterialsInventory-multiPeriodStatements[1].balanceSheet.rawMaterialsInventory,22)
close(reversedWasteStatements[1].balanceSheet.netWorkingCapital-multiPeriodStatements[1].balanceSheet.netWorkingCapital,22)
close(reversedWasteStatements[1].balanceSheet.retainedEarnings-multiPeriodStatements[1].balanceSheet.retainedEarnings,22)
close(reversedWasteStatements[1].cashFlowStatement.closingCash-multiPeriodStatements[1].cashFlowStatement.closingCash,0)
console.log('PASS: two-period raw materials, WIP, finished goods, single-post COGS, working capital and three statements reconcile.')
