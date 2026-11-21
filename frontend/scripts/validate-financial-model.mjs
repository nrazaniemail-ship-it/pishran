import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const load = async relativePath => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const [engine, foundation] = await Promise.all([
  load('../src/features/steel/financialModel.ts'),
  load('../src/features/projects/projectFoundation.ts')
])
const near = (actual, expected, tolerance, label) => assert.ok(Number.isFinite(actual) && Math.abs(actual-expected)<=tolerance, label+': '+actual+' vs '+expected)

near(engine.calculateNpv([-100,60,60],0.1),4.13223140495867,1e-8,'NPV calculation')
near(engine.calculateIrr([-100,60,60]),0.1306623862918075,1e-8,'IRR calculation')
assert.ok(engine.calculateMirr([-100,60,60],0.1,0.1)!==null,'MIRR must be calculable for a conventional investment cash flow')
const wacc=engine.calculateWacc({equityWeight:60,debtWeight:40,costOfEquity:20,costOfDebt:10,taxRate:25})
assert.equal(wacc.valid,true,'WACC inputs must validate')
near(wacc.value,0.15,1e-12,'WACC calculation')
const reconciliation=engine.reconcileCashFlowSeries([-100,60,60],[-100,60,60])
assert.equal(reconciliation.matched,true,'Identical cash-flow series must reconcile')
const scaled=engine.calculateCapacityScaledCapex(1000,100,200,0.8)
near(scaled.amount,1741.1011265922482,1e-8,'Capacity-scaled CAPEX')

const blank=foundation.createBlankProjectFoundation()
assert.equal(blank.planning.projectStartDate,'')
assert.equal(blank.planning.projectEndDate,'')
const periods=foundation.buildProjectCalendarPeriods('2026-10-15','2027-02-10','monthly',4)
assert.deepEqual(periods.map(p=>[p.startDate,p.endDate,p.days,p.partial]),[
 ['2026-10-15','2026-10-31',17,true],['2026-11-01','2026-11-30',30,false],
 ['2026-12-01','2026-12-31',31,false],['2027-01-01','2027-01-31',31,false],
 ['2027-02-01','2027-02-10',10,true]
])
const validAsset={id:'asset-1',name:'Test asset',grossCost:1000,accumulatedDepreciation:0,remainingLife:5,opportunityValue:1000,commissioningDate:'2024-02-29',depreciationStartDate:'2024-03-01',depreciationMethod:'linear-scrap',depreciationLengthYears:5,depreciationLengthMonths:0,firstDepreciationMonths:12,status:'active'}
assert.equal(foundation.validateStartingFixedAssetBalances([validAsset],blank).length,0)
assert.ok(foundation.validateStartingFixedAssetBalances([{...validAsset,commissioningDate:'2023-02-29'}],blank).some(x=>x.code==='invalid-starting-asset-date'))
console.log('PASS: generic financial calculations, project calendar and opening-asset validation')

const integratedWithCps = engine.calculateIntegratedFinance({
 years:3, constructionYears:1, capacity:1000, fullCapacityRevenue:1000, fullCapacityVariableCashCost:0, fullCapacityFixedCashCost:0,
 annualDepreciation:0, fixedInvestment:1000, preOperatingCost:0, fixedInvestmentSchedule:[1000,0,0], preOperatingSchedule:[0,0,0],
 utilization:[0,1,1], equityContributions:[1000,0,0], loans:[], taxRate:0, costOfEquity:10, workingCapitalPercent:0,
 salesEscalationPercent:0, opexEscalationPercent:0, discountMode:'manual', manualDiscountRate:10,
 costOfProductsSoldByYear:[0,500,600], otherVariableCashCostByYear:[0,50,50], finishedGoodsInventoryValueByYear:[0,100,120]
})
near(integratedWithCps.years[1].variableCashCost,550,1e-9,'CPS plus other variable cash cost enters finance engine')
near(integratedWithCps.years[1].ebit,450,1e-9,'CPS affects EBIT')
near(integratedWithCps.years[1].workingCapitalBreakdown.finishedGoods,100,1e-9,'Finished goods asset enters working capital')
near(integratedWithCps.years[1].changeInWorkingCapital,100,1e-9,'Finished goods inventory movement enters cash flow')
assert.throws(()=>engine.calculateIntegratedFinance({
 years:2,constructionYears:1,capacity:1,fullCapacityRevenue:0,fullCapacityVariableCashCost:0,fullCapacityFixedCashCost:0,annualDepreciation:0,fixedInvestment:0,preOperatingCost:0,fixedInvestmentSchedule:[0,0],preOperatingSchedule:[0,0],utilization:[0,1],equityContributions:[0,0],loans:[],taxRate:0,costOfEquity:0,workingCapitalPercent:0,salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:0,costOfProductsSoldByYear:[0,1]
}),/Other variable cash costs must be supplied/)
