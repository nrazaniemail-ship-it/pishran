import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const compilerOptions={module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
const temp=await mkdtemp(join(tmpdir(),'pishran-help-forms-'))
try {
 const formsSource=await readFile(new URL('../src/features/projects/projectModelHelpForms.ts',import.meta.url),'utf8')
 const draftsSource=await readFile(new URL('../src/features/projects/projectModelFormDrafts.ts',import.meta.url),'utf8')
 const formsOutput=ts.transpileModule(formsSource,{compilerOptions}).outputText
 const draftsOutput=ts.transpileModule(draftsSource,{compilerOptions}).outputText.replaceAll("'./projectModelHelpForms'","'./projectModelHelpForms.mjs'").replaceAll('"./projectModelHelpForms"','"./projectModelHelpForms.mjs"')
 await writeFile(join(temp,'projectModelHelpForms.mjs'),formsOutput)
 await writeFile(join(temp,'projectModelFormDrafts.mjs'),draftsOutput)
 const m=await import(pathToFileURL(join(temp,'projectModelFormDrafts.mjs')).href)
 const draft=m.createBlankProjectModelFinancialFormDrafts()
 assert.ok(m.HELP_FORM_SECTIONS?.length===undefined || m.HELP_FORM_SECTIONS.length>=25)
 assert.deepEqual(m.validateProjectModelFinancialFormDrafts(draft),[])
 let allocation=draft.helpDriven
 allocation=m.addHelpFormRow(allocation,'cost-allocation','a')
 allocation=m.updateHelpFormRow(allocation,'cost-allocation','a','name','Split A')
 allocation=m.updateHelpFormRow(allocation,'cost-allocation','a','allocationPercent',40)
 assert.ok(m.validateHelpDrivenProjectForms(allocation).includes('cost-allocation:Split A:allocation-must-equal-100'))
 allocation=m.addHelpFormRow(allocation,'cost-allocation','b')
 allocation=m.updateHelpFormRow(allocation,'cost-allocation','b','name','Split B')
 allocation=m.updateHelpFormRow(allocation,'cost-allocation','b','allocationPercent',60)
 assert.equal(m.validateHelpDrivenProjectForms(allocation).length,0)
 let assets=m.addHelpFormRow(draft.helpDriven,'fixed-investment','asset-1')
 assets=m.updateHelpFormRow(assets,'fixed-investment','asset-1','quantity',3)
 assets=m.updateHelpFormRow(assets,'fixed-investment','asset-1','unitPrice',25)
 assert.equal(assets.sections['fixed-investment'][0].values.total,75)
 let loans=m.addHelpFormRow(draft.helpDriven,'loan-conditions','short')
 loans=m.updateHelpFormRow(loans,'loan-conditions','short','kind','short-term')
 loans=m.updateHelpFormRow(loans,'loan-conditions','short','repaymentType','annuity')
 assert.ok(m.validateHelpDrivenProjectForms(loans).includes('short-term-loan-must-use-profile'))
 let fees=m.addHelpFormRow(draft.helpDriven,'loan-fees','fee-1')
 fees=m.updateHelpFormRow(fees,'loan-fees','fee-1','type','agency')
 fees=m.updateHelpFormRow(fees,'loan-fees','fee-1','basis','total-loan')
 assert.ok(m.validateHelpDrivenProjectForms(fees).includes('loan-fee-basis-mismatch:agency'))
 let wc=m.addHelpFormRow(draft.helpDriven,'working-capital','wc-1')
 wc=m.updateHelpFormRow(wc,'working-capital','wc-1','category','accounts-receivable')
 wc=m.updateHelpFormRow(wc,'working-capital','wc-1','mode','units')
 assert.ok(m.validateHelpDrivenProjectForms(wc).includes('working-capital-category-value-mode-only:accounts-receivable'))
 console.log('COMFAR help form coverage tests passed')
} finally {
 await rm(temp,{recursive:true,force:true})
}
