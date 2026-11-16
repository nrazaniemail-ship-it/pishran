import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const compilerOptions={module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
const encode=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
const dependency=await readFile(new URL('../src/features/projects/projectModelHelpForms.ts',import.meta.url),'utf8')
const dependencyOutput=ts.transpileModule(dependency,{compilerOptions}).outputText
const dependencyUrl=encode(dependencyOutput)
const source=await readFile(new URL('../src/features/projects/projectModelFormDrafts.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions}).outputText.replaceAll("'./projectModelHelpForms'",'\''+dependencyUrl+'\'').replaceAll('"./projectModelHelpForms"','\"'+dependencyUrl+'\"')
const m=await import(encode(output))
const draft=m.createBlankHelpDrivenProjectForms()
assert.ok(m.HELP_FORM_SECTIONS.length>=25)
assert.deepEqual(m.validateHelpDrivenProjectForms(draft),[])
for(const section of m.HELP_FORM_SECTIONS){
 const rows=draft.sections[section.id]
 assert.equal(rows.length,section.repeatable?0:1)
 for(const row of rows)for(const field of section.fields)assert.ok(Object.hasOwn(row.values,field.key))
}
let allocation=m.addHelpFormRow(draft,'cost-allocation','a')
allocation=m.updateHelpFormRow(allocation,'cost-allocation','a','name','Split A')
allocation=m.updateHelpFormRow(allocation,'cost-allocation','a','allocationPercent',40)
assert.ok(m.validateHelpDrivenProjectForms(allocation).includes('cost-allocation:Split A:allocation-must-equal-100'))
allocation=m.addHelpFormRow(allocation,'cost-allocation','b')
allocation=m.updateHelpFormRow(allocation,'cost-allocation','b','name','Split A')
allocation=m.updateHelpFormRow(allocation,'cost-allocation','b','allocationPercent',60)
assert.equal(m.validateHelpDrivenProjectForms(allocation).length,0)
let assets=m.addHelpFormRow(draft,'fixed-investment','asset-1')
assets=m.updateHelpFormRow(assets,'fixed-investment','asset-1','quantity',3)
assets=m.updateHelpFormRow(assets,'fixed-investment','asset-1','unitPrice',25)
assert.equal(assets.sections['fixed-investment'][0].values.total,75)
let loans=m.addHelpFormRow(draft,'loan-conditions','short')
loans=m.updateHelpFormRow(loans,'loan-conditions','short','kind','short-term')
loans=m.updateHelpFormRow(loans,'loan-conditions','short','repaymentType','annuity')
assert.ok(m.validateHelpDrivenProjectForms(loans).includes('short-term-loan-must-use-profile'))
let fees=m.addHelpFormRow(draft,'loan-fees','fee-1')
fees=m.updateHelpFormRow(fees,'loan-fees','fee-1','type','agency')
fees=m.updateHelpFormRow(fees,'loan-fees','fee-1','basis','total-loan')
assert.ok(m.validateHelpDrivenProjectForms(fees).includes('loan-fee-basis-mismatch:agency'))
let wc=m.addHelpFormRow(draft,'working-capital','wc-1')
wc=m.updateHelpFormRow(wc,'working-capital','wc-1','category','accounts-receivable')
wc=m.updateHelpFormRow(wc,'working-capital','wc-1','mode','units')
assert.ok(m.validateHelpDrivenProjectForms(wc).includes('working-capital-category-value-mode-only:accounts-receivable'))
console.log('COMFAR help form coverage tests passed')
