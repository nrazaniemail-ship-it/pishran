import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const engine=transpile(await readFile(new URL('../src/features/steel/periodicFinancialEngine.ts',import.meta.url),'utf8'))
const engineUrl='data:text/javascript;base64,'+Buffer.from(engine).toString('base64')
const source=transpile(await readFile(new URL('../src/features/projects/projectTaxDraftIntegration.ts',import.meta.url),'utf8'))
const output=source.replace("'../steel/periodicFinancialEngine'",JSON.stringify(engineUrl))
const adapter=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
 {index:3,startDate:'2027-01-01',endDate:'2027-12-31',days:365,partial:false},
]
const draft={
 system:'corporate',rates:[{period:'1',ratePercent:20},{period:'2',ratePercent:20},{period:'3',ratePercent:25}],
 allowances:[],lossCarryForward:true,lossCarryForwardYears:2,
 openingLossVintages:[{amount:100,originFiscalYearIndex:-1}],
}
const result=adapter.buildProjectTaxDraftSchedule(draft,periods,1)
assert.equal(result.valid,true,result.issues.join('; '))
assert.deepEqual(result.taxRatesByPeriod,[20,20,25])
assert.deepEqual(result.annualTaxRates,[20,20,25])
assert.equal(result.openingTaxLoss,100)
assert.deepEqual(result.openingTaxLossVintages,[{amount:100,originFiscalYearIndex:-1}])
assert.equal(result.taxLossCarryForwardEnabled,true)
assert.equal(result.taxLossCarryForwardYears,2)
const missingRate=adapter.buildProjectTaxDraftSchedule({...draft,rates:draft.rates.slice(0,2)},periods,1)
assert.equal(missingRate.valid,false)
assert.ok(missingRate.issues.some(issue=>issue.includes('Every project period requires one explicit tax rate')))
const missingDuration=adapter.buildProjectTaxDraftSchedule({...draft,lossCarryForwardYears:null},periods,1)
assert.equal(missingDuration.valid,false)
assert.ok(missingDuration.issues.some(issue=>issue.includes('positive carry-forward duration')))
const invalidVintage=adapter.buildProjectTaxDraftSchedule({...draft,openingLossVintages:[{amount:0,originFiscalYearIndex:-1}]},periods,1)
assert.equal(invalidVintage.valid,false)
const allowances=adapter.buildProjectTaxDraftSchedule({...draft,allowances:[{id:'allow',name:'Exemption',treatment:'deduction',periodAmounts:[{period:'1',amount:10},{period:'2',amount:20},{period:'3',amount:0}]}]},periods,1)
assert.equal(allowances.valid,true,allowances.issues.join('; '))
assert.deepEqual(allowances.taxableDeductionsByPeriod,[10,20,0])
const unsupportedCredit=adapter.buildProjectTaxDraftSchedule({...draft,allowances:[{id:'credit',name:'Tax credit',treatment:'credit',periodAmounts:[{period:'1',amount:10},{period:'2',amount:0},{period:'3',amount:0}]}]},periods,1)
assert.equal(unsupportedCredit.valid,false)
assert.ok(unsupportedCredit.issues.some(issue=>issue.includes('tax credits require a separate tax-credit posting')))
const taxFree=adapter.buildProjectTaxDraftSchedule({system:'none',rates:[],allowances:[],lossCarryForward:false,lossCarryForwardYears:null,openingLossVintages:[]},periods,1)
assert.equal(taxFree.valid,true,taxFree.issues.join('; '))
assert.deepEqual(taxFree.taxRatesByPeriod,[0,0,0])
console.log('Detailed project tax schedule and opening loss vintage validation passed.')
