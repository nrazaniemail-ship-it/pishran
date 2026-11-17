import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engine=transpile(await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8'))
const engineUrl='data:text/javascript;base64,'+Buffer.from(engine).toString('base64')
let economic=transpile(await readFile(new URL('../src/features/projects/projectEconomicAnalysis.ts',import.meta.url),'utf8'))
economic=economic.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const module=await import('data:text/javascript;base64,'+Buffer.from(economic).toString('base64'))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
]
const finance=await import(engineUrl)
const result=finance.calculateIntegratedPeriodicFinance({
 periods,fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[100,100],annualVariableCost:[20,20],annualFixedCost:[10,10],
 annualDepreciation:[0,0],annualFixedInvestment:[0,0],annualPreOperatingCost:[0,0],
 annualMaintenanceCapex:[0,0],annualTaxRates:[20,20],annualEquityContributions:[0,0],
 workingCapitalByPeriod:[0,0],periodSubsidyIncome:[5,0],loans:[],discountRatePercent:10,
})
assert.equal(result.valid,true,result.warnings.join('; '))
assert.deepEqual(result.rows.map(row=>row.subsidyIncome),[5,0])
const adjustments=[
 {id:'fx',name:'Imported equipment FX shadow adjustment',period:'1',treatment:'cost',effectType:'foreign-exchange',financialAmount:10,economicAmount:8},
 {id:'jobs',name:'Employment shadow benefit',period:'2',treatment:'benefit',effectType:'employment',financialAmount:0,economicAmount:5},
]
const report=module.buildProjectEconomicAnalysis(result,periods,adjustments,10,365,'period-end',undefined,'actual-days',1)
assert.equal(report.valid,true,report.issues.join('; '))
assert.deepEqual(report.rows.map(row=>row.taxTransferRemoved),result.rows.map(row=>row.unleveredTax))
assert.deepEqual(report.rows.map(row=>row.subsidyTransferRemoved),[5,0])
assert.deepEqual(report.rows.map(row=>row.economicAdjustment),[2,5])
assert.deepEqual(report.economicCashFlows,[67,75])
assert.ok(Math.abs(report.economicNpv-(67/1.1+75/1.1**2))<0.01)
assert.equal(report.totalForeignExchangeAdjustment,2)
assert.equal(report.totalEmploymentAdjustment,5)
const missingDiscount=module.buildProjectEconomicAnalysis(result,periods,adjustments,null,365,'period-end',undefined,'actual-days',1)
assert.equal(missingDiscount.valid,false)
const invalidAmount=module.buildProjectEconomicAnalysis(result,periods,[{...adjustments[0],economicAmount:-1}],10,365,'period-end',undefined,'actual-days',1)
assert.equal(invalidAmount.valid,false)
const unknownPeriod=module.buildProjectEconomicAnalysis(result,periods,[{...adjustments[0],period:'2035'}],10,365,'period-end',undefined,'actual-days',1)
assert.equal(unknownPeriod.valid,false)
console.log('Economic NPV/IRR, tax and subsidy transfer removal, shadow FX and employment adjustments passed.')
