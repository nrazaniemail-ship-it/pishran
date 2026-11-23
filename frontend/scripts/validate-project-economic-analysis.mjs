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
 {id:'fx',name:'Imported equipment FX shadow adjustment',period:'1',treatment:'cost',effectType:'foreign-exchange',financialAmount:10,economicAmount:8,sourceReference:'shadow-price-study-page-12',sourceVerified:true},
 {id:'jobs',name:'Employment shadow benefit',period:'2',treatment:'benefit',effectType:'employment',financialAmount:0,economicAmount:5,sourceReference:'employment-study-page-8',sourceVerified:true},
]
const report=module.buildProjectEconomicAnalysis(result,periods,adjustments,10,365,'period-end',undefined,'actual-days',1,null,false,'economic-discount-rate-study',true)
assert.equal(report.valid,true,report.issues.join('; '))
assert.deepEqual(report.rows.map(row=>row.taxTransferRemoved),result.rows.map(row=>row.unleveredTax))
assert.deepEqual(report.rows.map(row=>row.subsidyTransferRemoved),[5,0])
assert.deepEqual(report.rows.map(row=>row.economicAdjustment),[2,5])
assert.deepEqual(report.economicCashFlows,[67,75])
assert.ok(Math.abs(report.economicNpv-(67/1.1+75/1.1**2))<0.01)
assert.equal(report.totalForeignExchangeAdjustment,2)
assert.equal(report.totalEmploymentAdjustment,5)

const salesTaxLedger={
 valid:true,issues:[],totalOutputTax:50,totalRecoverableInputTax:0,totalSettlements:30,closingBalance:20,
 rows:[
  {period:1,openingBalance:0,outputTax:50,recoverableInputTax:0,netTaxAccrued:50,settlement:0,closingBalance:50},
  {period:2,openingBalance:50,outputTax:0,recoverableInputTax:0,netTaxAccrued:0,settlement:30,closingBalance:20},
 ],
}
const economicWithIndirectTax=module.buildProjectEconomicAnalysis(
 result,periods,adjustments,10,365,'period-end',undefined,'actual-days',1,salesTaxLedger,true,'economic-discount-rate-study',true)
assert.equal(economicWithIndirectTax.valid,true,economicWithIndirectTax.issues.join('; '))
assert.deepEqual(economicWithIndirectTax.rows.map(row=>row.indirectTaxTransferRemoved),[-50,30])
assert.deepEqual(economicWithIndirectTax.economicCashFlows,[17,105])
assert.equal(economicWithIndirectTax.totalIndirectTaxTransferRemoved,-20)

const invalidIndirectTax=module.buildProjectEconomicAnalysis(
 result,periods,adjustments,10,365,'period-end',undefined,'actual-days',1,{...salesTaxLedger,valid:false},true,'economic-discount-rate-study',true)
assert.equal(invalidIndirectTax.valid,false)
assert.ok(invalidIndirectTax.issues.some(issue=>issue.includes('indirect sales-tax ledger')))

const missingDiscount=module.buildProjectEconomicAnalysis(result,periods,adjustments,null,365,'period-end',undefined,'actual-days',1,null,false,'economic-discount-rate-study',true)
assert.equal(missingDiscount.valid,false)
const invalidAmount=module.buildProjectEconomicAnalysis(result,periods,[{...adjustments[0],economicAmount:-1}],10,365,'period-end',undefined,'actual-days',1,null,false,'economic-discount-rate-study',true)
assert.equal(invalidAmount.valid,false)
const unknownPeriod=module.buildProjectEconomicAnalysis(result,periods,[{...adjustments[0],period:'2035'}],10,365,'period-end',undefined,'actual-days',1,null,false,'economic-discount-rate-study',true)
assert.equal(unknownPeriod.valid,false)
const missingAdjustmentSource=module.buildProjectEconomicAnalysis(result,periods,[{...adjustments[0],sourceVerified:false}],10,365,'period-end',undefined,'actual-days',1,null,false,'economic-discount-rate-study',true)
assert.equal(missingAdjustmentSource.valid,false)
assert.ok(missingAdjustmentSource.issues.some(issue=>issue.includes('verified shadow-price source')))
const missingDiscountSource=module.buildProjectEconomicAnalysis(result,periods,adjustments,10,365,'period-end',undefined,'actual-days',1,null,false,'',false)
assert.equal(missingDiscountSource.valid,false)
assert.ok(missingDiscountSource.issues.some(issue=>issue.includes('discount rate requires an independently verified source')))
const panelSource=await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx',import.meta.url),'utf8')
const wizardSource=await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx',import.meta.url),'utf8')
assert.ok(panelSource.includes('onSalesTaxLedgerResult?.(salesTaxLedgerResult)'))
assert.ok(wizardSource.includes('onSalesTaxLedgerResult={setReportSalesTaxLedgerResult}'))
assert.ok(wizardSource.includes('reportSalesTaxLedgerResult,reportSalesTaxLedgerResult!==null'))
assert.ok(wizardSource.includes('row.indirectTaxTransferRemoved'))
assert.ok(panelSource.includes('economicDiscountRateSourceReference?.trim()'))
assert.ok(wizardSource.includes('economicDiscountRateSourceReference={m.financialForms.economic.discountRateSourceReference}'))
const economicForms=await readFile(new URL('../src/features/projects/ProjectModelFinancialFormsPanel.tsx',import.meta.url),'utf8')
assert.ok(economicForms.includes('Economic discount-rate source reference'))
assert.ok(economicForms.includes('Shadow-price / adjustment source reference'))
console.log('Economic NPV/IRR, corporate and indirect-tax transfer removal, subsidy, shadow FX and employment adjustments passed.')
