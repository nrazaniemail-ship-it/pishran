import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/steel/periodicSensitivity.ts',import.meta.url),'utf8')
const engineSource=await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8')
const compile=(text)=>ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engineUrl='data:text/javascript;base64,'+Buffer.from(compile(engineSource)).toString('base64')
const output=compile(source).replace("'./periodicFinancialEngine'",JSON.stringify(engineUrl))
const sensitivity=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const input={
 periods:[
  {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
  {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
 ],
 fiscalYearStartMonth:1,dayCountBasis:365,cashFlowTiming:'period-end',
 annualRevenue:[0,150],annualVariableCost:[0,50],annualFixedCost:[0,20],
 annualDepreciation:[0,0],annualFixedInvestment:[100,0],annualPreOperatingCost:[0,0],
 annualMaintenanceCapex:[0,0],annualTaxRates:[25,25],annualEquityContributions:[100,0],
 annualEquityWorkingCapitalContributions:[0,0],workingCapitalByPeriod:[0,0],openingWorkingCapital:0,
 loans:[],discountRatePercent:10,
}
const base=sensitivity.calculatePeriodicSensitivity(input,['revenue','variable-cost','investment'],10)
assert.equal(base.baseline.valid,true,base.baseline.warnings.join('; '))
assert.equal(base.valid,true,base.issues.join('; '))
assert.equal(base.points.length,6)
assert.equal(base.optimistic.valid,true)
assert.equal(base.pessimistic.valid,true)
const highRevenue=sensitivity.applyPeriodicSensitivityShock(input,'revenue',10)
assert.deepEqual(highRevenue.annualRevenue,[0,165])
assert.deepEqual(input.annualRevenue,[0,150])
const target=sensitivity.searchPeriodicFinanceTarget({
 finance:input,variable:'revenue',metric:'npvProject',
 target:(base.baseline.npvProject??0)+5,direction:'increase',maxVariationPercent:100,
})
assert.equal(target.achieved,true,target.issues.join('; '))
assert.ok((target.achievedValue??0)>=(target.target-0.001))
const unreachable=sensitivity.searchPeriodicFinanceTarget({
 finance:input,variable:'revenue',metric:'npvProject',
 target:1e12,direction:'increase',maxVariationPercent:10,
})
assert.equal(unreachable.achieved,false)
assert.ok(unreachable.issues[0].includes('not reached'))
console.log('Periodic sensitivity and target-search validation passed.')
