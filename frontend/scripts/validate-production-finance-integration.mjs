import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const root = new URL('../src/features/', import.meta.url)
async function transpile(path) {
 const source = await readFile(new URL(path, root), 'utf8')
 return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
}
const analysisOutput = await transpile('production/productionAnalysis.ts')
const analysisUrl = 'data:text/javascript;base64,' + Buffer.from(analysisOutput).toString('base64')
const integrationOutput = (await transpile('projects/productionFinanceIntegration.ts')).replace("'../production/productionAnalysis'", JSON.stringify(analysisUrl))
const integrationUrl = 'data:text/javascript;base64,' + Buffer.from(integrationOutput).toString('base64')
const { analyzeProductionRecord } = await import(analysisUrl)
const { buildProductionFinanceBridge } = await import(integrationUrl)
const mappingOutput = await transpile('projects/productionCostMapping.ts')
const mappingUrl = 'data:text/javascript;base64,' + Buffer.from(mappingOutput).toString('base64')
const { mapProductionCostsToFinance } = await import(mappingUrl)
const financeOutput = await transpile('steel/financialModel.ts')
const financeUrl = 'data:text/javascript;base64,' + Buffer.from(financeOutput).toString('base64')
const { calculateIntegratedFinance, buildThreeFinancialStatements, calculateSensitivityMatrix, calculateOneWaySensitivity } = await import(financeUrl)


const record = (overrides={}) => ({id:'r1',projectId:'p1',lineId:'l1',product:'coil',periodStart:'2026-01-01',periodEnd:'2026-01-31',plannedOutput:100,totalOutput:100,goodOutput:100,scrapOutput:0,matchedMaterialInput:100,matchedMaterialUnit:'t',materials:[{id:'m1',name:'billet',consumedQuantity:100,unit:'t',unitCost:2,currency:'USD'}],directLaborCost:10,energyCost:10,maintenanceCost:0,allocatedOverhead:0,currency:'USD',createdAt:'2026-01-31',updatedAt:'2026-01-31',salesQuantity:80,...overrides})
const periods=[{index:1,startDate:'2026-01-01',endDate:'2026-01-31',days:31,partial:false},{index:2,startDate:'2026-02-01',endDate:'2026-02-28',days:28,partial:false}]
let result=buildProductionFinanceBridge([record()], 'p1', periods, 'USD')
console.log('Bridge diagnostic:', JSON.stringify(result))
assert.equal(result.valid,true)
assert.equal(result.periods[0].cpp,220)
assert.equal(result.periods[0].cps,176)
assert.equal(result.periods[0].closingFinishedGoodsQuantity,20)
assert.equal(result.periods[0].closingFinishedGoodsValue,44)
assert.equal(result.periods[0].materialCost,200)
assert.equal(result.periods[0].directLaborCost,10)
assert.equal(result.periods[0].energyCost,10)
assert.equal(result.periods[1].closingFinishedGoodsValue,44)
assert.equal(result.periods[1].products[0].openingInventoryValue,44)
assert.equal(buildProductionFinanceBridge([record({projectId:'p2'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({currency:'EUR',materials:[{id:'m1',name:'billet',consumedQuantity:100,unit:'t',unitCost:2,currency:'EUR'}]})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record(),record({id:'r2',periodStart:'2026-01-20',periodEnd:'2026-01-31'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({salesQuantity:101})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({periodStart:'2025-12-01',periodEnd:'2026-01-31'})],'p1',periods,'USD').valid,false)
assert.equal(buildProductionFinanceBridge([record({finishedGoodsOpeningQuantity:1,finishedGoodsOpeningValue:999})],'p1',periods,'USD').valid,true)
const twoPeriod=[record(),record({id:'r2',periodStart:'2026-02-01',periodEnd:'2026-02-28',salesQuantity:10,finishedGoodsOpeningQuantity:20,finishedGoodsOpeningValue:44})]
result=buildProductionFinanceBridge(twoPeriod,'p1',periods,'USD')
assert.equal(result.valid,true)
assert.ok(Math.abs(result.periods[1].products[0].closingInventoryValue-242)<1e-9)
assert.equal(analyzeProductionRecord(record()).totalProductionCost,220)
const mapped = mapProductionCostsToFinance({
 cpp:[220,0],cps:[176,0],hasProductionRecords:[true,false],utilization:[0.8,0.9],opexFactors:[1,1.1],
 fullCapacityVariableCashCost:500,fullCapacityFixedCashCost:50,
 mappedBaseCosts:{variable:{materials:100,directLabor:50,energy:30,maintenance:20,overhead:20},fixed:{materials:0,directLabor:0,energy:0,maintenance:10,overhead:0}}
})
const integrated = calculateIntegratedFinance({
 years:2,constructionYears:1,capacity:100,fullCapacityRevenue:1000,fullCapacityVariableCashCost:500,fullCapacityFixedCashCost:50,
 costOfProductsSoldByYear:[0,176],otherVariableCashCostByYear:[0,224],otherFixedCashCostByYear:[0,40],finishedGoodsInventoryValueByYear:[0,44],
 annualDepreciation:0,fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0],preOperatingSchedule:[0,0],
 utilization:[0,1],equityContributions:[0,0],loans:[],taxRate:0,costOfEquity:10,workingCapitalPercent:0,
 salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:10
})
assert.equal(integrated.years[1].variableCashCost,400)
assert.equal(integrated.years[1].fixedCashCost,40)
assert.equal(integrated.years[1].workingCapitalBreakdown.finishedGoods,44)
const integratedStatements=buildThreeFinancialStatements(integrated.years)
assert.equal(integratedStatements[1].incomeStatement.cashOperatingCosts,440)
assert.equal(integratedStatements[1].balanceSheet.workingCapitalAssets,44)
const volumeSensitivity=calculateSensitivityMatrix({
 years:2,constructionYears:1,capacity:100,fullCapacityRevenue:1000,fullCapacityVariableCashCost:500,fullCapacityFixedCashCost:50,
 costOfProductsSoldByYear:[0,176],otherVariableCashCostByYear:[0,224],otherFixedCashCostByYear:[0,40],finishedGoodsInventoryValueByYear:[0,44],
 annualDepreciation:0,fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0],preOperatingSchedule:[0,0],
 utilization:[0,1],equityContributions:[0,0],loans:[],taxRate:0,costOfEquity:10,workingCapitalPercent:0,
 salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:10
},[0],[20])
const manuallyScaled=calculateIntegratedFinance({
 years:2,constructionYears:1,capacity:120,fullCapacityRevenue:1200,fullCapacityVariableCashCost:600,fullCapacityFixedCashCost:50,
 costOfProductsSoldByYear:[0,211.2],otherVariableCashCostByYear:[0,268.8],otherFixedCashCostByYear:[0,40],finishedGoodsInventoryValueByYear:[0,52.8],
 annualDepreciation:0,fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0],preOperatingSchedule:[0,0],
 utilization:[0,1],equityContributions:[0,0],loans:[],taxRate:0,costOfEquity:10,workingCapitalPercent:0,
 salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:10
})
assert.ok(Math.abs(volumeSensitivity[0][0].npv-manuallyScaled.npvProject)<1e-6)
const oneWay=calculateOneWaySensitivity({
 years:2,constructionYears:1,capacity:100,fullCapacityRevenue:1000,fullCapacityVariableCashCost:500,fullCapacityFixedCashCost:50,
 costOfProductsSoldByYear:[0,176],otherVariableCashCostByYear:[0,224],otherFixedCashCostByYear:[0,40],finishedGoodsInventoryValueByYear:[0,44],
 annualDepreciation:0,fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0],preOperatingSchedule:[0,0],
 utilization:[0,1],equityContributions:[0,0],loans:[],taxRate:0,costOfEquity:10,workingCapitalPercent:0,
 salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:10
},20)
assert.equal(oneWay.factors.find(factor=>factor.id==='operating-cost')?.available,true)
assert.equal(mapped.valid,true)
assert.deepEqual(mapped.costOfProductsSoldByYear,[176,0])
assert.deepEqual(mapped.otherVariableCashCostByYear,[224,495])
assert.deepEqual(mapped.otherFixedCashCostByYear,[32,49.5])
assert.equal(mapProductionCostsToFinance({
 cpp:[220],cps:[176],hasProductionRecords:[true],utilization:[1],opexFactors:[1],
 fullCapacityVariableCashCost:100,fullCapacityFixedCashCost:50,mappedBaseCosts:{variable:{materials:100,directLabor:50,energy:30,maintenance:20,overhead:20},fixed:{materials:0,directLabor:0,energy:0,maintenance:0,overhead:0}}
}).valid,false)
assert.equal(mapProductionCostsToFinance({
 cpp:[220],cps:[176],hasProductionRecords:[true],utilization:[1],opexFactors:[1],
 fullCapacityVariableCashCost:500,fullCapacityFixedCashCost:50,mappedBaseCosts:{variable:{materials:-1,directLabor:0,energy:0,maintenance:0,overhead:0},fixed:{materials:0,directLabor:0,energy:0,maintenance:0,overhead:0}}
}).valid,false)

console.log('Production-finance tests passed: project scope, period mapping, overlap, currency, inventory roll-forward, sales, CPP/CPS, baseline component replacement and no-double-counting.')
