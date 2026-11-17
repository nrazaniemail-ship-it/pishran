import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function compile(path) {
 const source=await readFile(new URL(path,import.meta.url),'utf8')
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
}
const helpFormsUrl='data:text/javascript;base64,'+Buffer.from(await compile('../src/features/projects/projectModelHelpForms.ts')).toString('base64')
let draftOutput=await compile('../src/features/projects/projectModelFormDrafts.ts')
draftOutput=draftOutput.replace("'./projectModelHelpForms'",JSON.stringify(helpFormsUrl))
const draftUrl='data:text/javascript;base64,'+Buffer.from(draftOutput).toString('base64')
let bindingOutput=await compile('../src/features/projects/helpDrivenFinancialDraftBinding.ts')
bindingOutput=bindingOutput.replace("'./projectModelFormDrafts'",JSON.stringify(draftUrl))
const bindingUrl='data:text/javascript;base64,'+Buffer.from(bindingOutput).toString('base64')
const forms=await import(helpFormsUrl)
const binder=await import(bindingUrl)

const periods=[
 {index:1,startDate:'2025-01-01',endDate:'2025-12-31',days:365,partial:false},
 {index:2,startDate:'2026-01-01',endDate:'2026-12-31',days:365,partial:false},
]
let help=forms.createBlankHelpDrivenProjectForms()
help=forms.addHelpFormRow(help,'currencies','local-eur')
for(const [key,value] of Object.entries({code:'EUR',name:'Euro',type:'local',accountingCurrency:true}))
 help=forms.updateHelpFormRow(help,'currencies','local-eur',key,value)
help=forms.addHelpFormRow(help,'cost-centres','centre-a')
for(const [key,value] of Object.entries({name:'General overhead',group:'services'}))
 help=forms.updateHelpFormRow(help,'cost-centres','centre-a',key,value)
help=forms.addHelpFormRow(help,'production-costs','cost-a')
for(const [key,value] of Object.entries({
 item:'Indirect shared cost',classification:'indirect',productId:'',allocationKeyId:'overhead-key',
 costCentreId:'centre-a',currency:'EUR',origin:'local',basis:'nominal-capacity',
 activityBasis:'production',nominalCapacity:100,standardQuantity:1,standardUnitPrice:2,
 fixedPercent:50,variablePercent:50,
}))
 help=forms.updateHelpFormRow(help,'production-costs','cost-a',key,value)
for(const [id,productId,allocationPercent] of [
 ['share-a','product-a',60],['share-b','product-b',40],
]){
 help=forms.addHelpFormRow(help,'cost-allocation',id)
 for(const [key,value] of Object.entries({
  name:'overhead-key',type:'user-defined',productId,allocationPercent,costCentreId:'centre-a',
 }))
  help=forms.updateHelpFormRow(help,'cost-allocation',id,key,value)
}
assert.deepEqual(forms.validateHelpDrivenProjectForms(help),[])
const bound=binder.bindHelpDrivenFinancialDrafts(help,periods,{
 assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[],
})
assert.deepEqual(bound.issues,[])
assert.ok(bound.boundSections.includes('cost-allocation'))
assert.equal(bound.drafts.productionCosts.length,2)
assert.deepEqual(bound.drafts.productionCosts.map(row=>row.productId),['product-a','product-b'])
assert.deepEqual(bound.drafts.productionCosts.map(row=>row.standardQuantity),[0.6,0.4])
assert.deepEqual(bound.drafts.productionCosts.map(row=>row.allocationKeyId),['overhead-key','overhead-key'])

let invalid=forms.updateHelpFormRow(help,'cost-allocation','share-b','allocationPercent',30)
const invalidBound=binder.bindHelpDrivenFinancialDrafts(invalid,periods,{
 assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[],
})
assert.ok(invalidBound.issues.some(issue=>issue.includes('allocation percentages must total exactly 100%')))

let unsupported=forms.updateHelpFormRow(help,'cost-allocation','share-a','type','sales-revenue')
const unsupportedBound=binder.bindHelpDrivenFinancialDrafts(unsupported,periods,{
 assets:[],productionCosts:[],sales:[],workingCapital:[],loans:[],
})
assert.ok(unsupportedBound.issues.some(issue=>issue.includes('only explicit user-defined allocation percentages')))

console.log('Help-driven user-defined indirect-cost allocation and percentage reconciliation passed.')
