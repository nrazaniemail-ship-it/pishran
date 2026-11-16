import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source=await readFile(new URL('../src/features/projects/projectModelFormDrafts.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
const forms=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))

const asset=forms.createBlankFixedAssetFormDraft()
assert.equal(asset.depreciation.method,null)
assert.equal(asset.depreciation.ratePercent,null)
assert.equal(asset.depreciation.salvagePercent,null)
assert.deepEqual(forms.validateFixedAssetFormDraft(asset),[])

const direct=forms.createBlankProductionCostFormDraft()
assert.equal(direct.classification,null)
assert.equal(direct.basis,null)
assert.deepEqual(forms.deriveFixedVariableSplit(35,null),{fixedPercent:35,variablePercent:65})
assert.deepEqual(forms.deriveFixedVariableSplit(null,70),{fixedPercent:30,variablePercent:70})
assert.deepEqual(forms.deriveFixedVariableSplit(35,70),{fixedPercent:35,variablePercent:70})
assert.ok(forms.validateProductionCostFormDraft({...direct,classification:'direct',productId:null}).includes('direct-cost-missing-product'))

assert.equal(forms.deriveWorkingCapitalTurnover(30,360),12)
assert.equal(forms.deriveWorkingCapitalTurnover(30,90),3)
assert.equal(forms.deriveWorkingCapitalTurnover(0,90),null)
assert.equal(forms.createBlankWorkingCapitalComponentFormDraft().minimumDaysCoverage,null)

const loan=forms.createBlankLoanFacilityFormDraft()
assert.equal(loan.loanType,null)
assert.deepEqual(loan.disbursements,[])
assert.equal(forms.resolveLoanFeeBasis('agency'),'each-positive-disbursement')
assert.equal(forms.resolveLoanFeeBasis('commitment'),'undisbursed-commitment')
assert.equal(forms.resolveLoanFeeBasis('guarantee'),'outstanding-loan-including-current-disbursement-excluding-current-repayment')
assert.equal(forms.resolveLoanFeeBasis('other'),'total-loan-at-first-disbursement')
assert.deepEqual(forms.validateLoanFacilityFormDraft(loan),[])
assert.ok(forms.validateProductionCostFormDraft({...direct,classification:'direct',productId:'p1',fixedPercent:120,variablePercent:-20}).includes('invalid-fixed-cost-percent'))
assert.ok(forms.validateFixedAssetFormDraft({...asset,disposal:{date:'2026-01-01',proceeds:-1}}).includes('invalid-asset-disposal-proceeds'))
assert.ok(forms.validateLoanFacilityFormDraft({...loan,fees:[{id:'fee-1',type:null,ratePercent:2,currencyCode:null}]}).includes('loan-fee-type-required'))
assert.ok(forms.validateLoanFacilityFormDraft({...loan,disbursements:[{date:'',amount:-1}]}).includes('invalid-loan-disbursement'))


const tax=forms.createBlankProjectTaxFormDraft()
assert.equal(tax.system,null)
assert.deepEqual(tax.rates,[])
console.log('Help-driven item-level finance forms: all assertions passed.')
