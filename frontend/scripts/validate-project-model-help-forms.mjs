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
 const h=await import(pathToFileURL(join(temp,'projectModelHelpForms.mjs')).href)
 const m=await import(pathToFileURL(join(temp,'projectModelFormDrafts.mjs')).href)
 const draft=m.createBlankProjectModelFinancialFormDrafts()
 assert.ok(h.HELP_FORM_SECTIONS.length>=25)
 assert.deepEqual(m.validateProjectModelFinancialFormDrafts(draft),[])
 let allocation=draft.helpDriven
 allocation=h.addHelpFormRow(allocation,'cost-allocation','a')
 allocation=h.updateHelpFormRow(allocation,'cost-allocation','a','name','Production cost')
 allocation=h.updateHelpFormRow(allocation,'cost-allocation','a','allocationPercent',40)
 assert.ok(h.validateHelpDrivenProjectForms(allocation).includes('cost-allocation:Production cost:allocation-must-equal-100'))
 allocation=h.addHelpFormRow(allocation,'cost-allocation','b')
 allocation=h.updateHelpFormRow(allocation,'cost-allocation','b','name','Production cost')
 allocation=h.updateHelpFormRow(allocation,'cost-allocation','b','allocationPercent',60)
 assert.equal(h.validateHelpDrivenProjectForms(allocation).length,0)
 let assets=h.addHelpFormRow(draft.helpDriven,'fixed-investment','asset-1')
 assets=h.updateHelpFormRow(assets,'fixed-investment','asset-1','quantity',3)
 assets=h.updateHelpFormRow(assets,'fixed-investment','asset-1','unitPrice',25)
 assert.equal(assets.sections['fixed-investment'][0].values.total,75)
 let loans=h.addHelpFormRow(draft.helpDriven,'loan-conditions','short')
 loans=h.updateHelpFormRow(loans,'loan-conditions','short','kind','short-term')
 loans=h.updateHelpFormRow(loans,'loan-conditions','short','repaymentType','annuity')
 assert.ok(h.validateHelpDrivenProjectForms(loans).includes('short-term-loan-must-use-profile'))
 let fees=h.addHelpFormRow(draft.helpDriven,'loan-fees','fee-1')
 fees=h.updateHelpFormRow(fees,'loan-fees','fee-1','type','agency')
 fees=h.updateHelpFormRow(fees,'loan-fees','fee-1','basis','total-loan')
 assert.ok(h.validateHelpDrivenProjectForms(fees).includes('loan-fee-basis-mismatch:agency'))
 let wc=h.addHelpFormRow(draft.helpDriven,'working-capital','wc-1')
 wc=h.updateHelpFormRow(wc,'working-capital','wc-1','category','accounts-receivable')
 wc=h.updateHelpFormRow(wc,'working-capital','wc-1','mode','units')
 assert.ok(h.validateHelpDrivenProjectForms(wc).includes('working-capital-category-value-mode-only:accounts-receivable'))
 let finishedStock=h.addHelpFormRow(draft.helpDriven,'working-capital','finished-1')
 finishedStock=h.updateHelpFormRow(finishedStock,'working-capital','finished-1','category','finished-products')
 finishedStock=h.updateHelpFormRow(finishedStock,'working-capital','finished-1','mode','value')
 assert.ok(h.validateHelpDrivenProjectForms(finishedStock).includes('finished-products-inventory-must-use-quantity-mode'))
 let receivable=h.addHelpFormRow(draft.helpDriven,'working-capital','ar-1')
 receivable=h.updateHelpFormRow(receivable,'working-capital','ar-1','category','accounts-receivable')
 receivable=h.updateHelpFormRow(receivable,'working-capital','ar-1','mode','value')
 receivable=h.updateHelpFormRow(receivable,'working-capital','ar-1','basis','cost-of-products-produced-materials')
 assert.ok(h.validateHelpDrivenProjectForms(receivable).includes('working-capital-basis-mismatch:accounts-receivable'))
 let economics=draft.helpDriven
 economics=h.updateHelpFormRow(economics,'economic-global','economic-global-main','numeraireType','foreign-border-prices')
 economics=h.updateHelpFormRow(economics,'economic-global','economic-global-main','numeraireCurrency','USD')
 economics=h.updateHelpFormRow(economics,'economic-global','economic-global-main','standardConversionFactor',0.8)
 economics=h.updateHelpFormRow(economics,'economic-global','economic-global-main','foreignCurrencyConversionFactor',1.25)
 assert.equal(h.validateHelpDrivenProjectForms(economics).length,0)
 economics=h.updateHelpFormRow(economics,'economic-global','economic-global-main','foreignCurrencyConversionFactor',1.1)
 assert.ok(h.validateHelpDrivenProjectForms(economics).includes('economic-global:scf-fccf-must-be-reciprocal'))
 let economicItems=h.addHelpFormRow(draft.helpDriven,'economic-items','economic-1')
 economicItems=h.updateHelpFormRow(economicItems,'economic-items','economic-1','direction','input')
 economicItems=h.updateHelpFormRow(economicItems,'economic-items','economic-1','market','local')
 economicItems=h.updateHelpFormRow(economicItems,'economic-items','economic-1','tradeCategory','imported')
 assert.ok(h.validateHelpDrivenProjectForms(economicItems).includes('economic-item:invalid-trade-category:input:local:imported'))
 let products=h.addHelpFormRow(draft.helpDriven,'products','product-1')
 products=h.updateHelpFormRow(products,'products','product-1','name','Product A')
 products=h.updateHelpFormRow(products,'products','product-1','productionIntervalMode','user-defined')
 assert.ok(h.validateHelpDrivenProjectForms(products).includes('product:user-defined-production-interval-requires-start-and-end'))
 products=h.updateHelpFormRow(products,'products','product-1','productionIntervalStart','2026-01-01')
 products=h.updateHelpFormRow(products,'products','product-1','productionIntervalEnd','2026-12-31')
 assert.equal(h.validateHelpDrivenProjectForms(products).length,0)
 let invalidSection={...draft.helpDriven,sections:{...draft.helpDriven.sections,unexpected:[]}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidSection).includes('help-forms:unknown-section:unexpected'))
 let invalidField=h.addHelpFormRow(draft.helpDriven,'products','invalid-field')
 invalidField={...invalidField,sections:{...invalidField.sections,products:invalidField.sections.products.map(row=>({...row,values:{...row.values,unregisteredInput:12}}))}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidField).includes('products:0:unknown-field:unregisteredInput'))
 let invalidType=h.addHelpFormRow(draft.helpDriven,'products','invalid-type')
 invalidType=h.updateHelpFormRow(invalidType,'products','invalid-type','name','Product A')
 invalidType={...invalidType,sections:{...invalidType.sections,products:invalidType.sections.products.map(row=>({...row,values:{...row.values,name:42}}))}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidType).includes('products:0:invalid-text:name'))
 assert.throws(()=>h.updateHelpFormRow(draft.helpDriven,'products','products-main','unknownField',1),/unknown-help-form-field/)
 assert.throws(()=>h.updateHelpFormRow(draft.helpDriven,'unknown-section','x','name','x'),/unknown-help-form-section/)
 let invalidSection={...draft.helpDriven,sections:{...draft.helpDriven.sections,unexpected:[]}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidSection).includes('help-forms:unknown-section:unexpected'))
 let invalidField=h.addHelpFormRow(draft.helpDriven,'products','invalid-field')
 invalidField={...invalidField,sections:{...invalidField.sections,products:invalidField.sections.products.map(row=>({...row,values:{...row.values,unregisteredInput:12}}))}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidField).includes('products:0:unknown-field:unregisteredInput'))
 let invalidType=h.addHelpFormRow(draft.helpDriven,'products','invalid-type')
 invalidType=h.updateHelpFormRow(invalidType,'products','invalid-type','name','Product A')
 invalidType={...invalidType,sections:{...invalidType.sections,products:invalidType.sections.products.map(row=>({...row,values:{...row.values,name:42}}))}}
 assert.ok(h.validateHelpDrivenProjectForms(invalidType).includes('products:0:invalid-text:name'))
 assert.throws(()=>h.updateHelpFormRow(draft.helpDriven,'products','products-main','unknownField',1),/unknown-help-form-field/)
 assert.throws(()=>h.updateHelpFormRow(draft.helpDriven,'unknown-section','x','name','x'),/unknown-help-form-section/)
 console.log('COMFAR help form coverage tests passed')
} finally {
 await rm(temp,{recursive:true,force:true})
}
