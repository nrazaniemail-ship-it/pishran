import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/features/projects/projectModelHelpForms.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const m=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
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
console.log('COMFAR help form coverage tests passed')
