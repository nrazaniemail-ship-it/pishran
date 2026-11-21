import assert from 'node:assert/strict'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const compilerOptions={module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
const temp=await mkdtemp(join(tmpdir(),'pishran-form-drafts-'))
try {
 const formsSource=await readFile(new URL('../src/features/projects/projectModelHelpForms.ts',import.meta.url),'utf8')
 const draftsSource=await readFile(new URL('../src/features/projects/projectModelFormDrafts.ts',import.meta.url),'utf8')
 const formsOutput=ts.transpileModule(formsSource,{compilerOptions}).outputText
 const draftsOutput=ts.transpileModule(draftsSource,{compilerOptions}).outputText.replaceAll("'./projectModelHelpForms'","'./projectModelHelpForms.mjs'").replaceAll('"./projectModelHelpForms"','"./projectModelHelpForms.mjs"')
 await writeFile(join(temp,'projectModelHelpForms.mjs'),formsOutput)
 const h=await import(pathToFileURL(join(temp,'projectModelHelpForms.mjs')).href)
 await writeFile(join(temp,'projectModelFormDrafts.mjs'),draftsOutput)
 const forms=await import(pathToFileURL(join(temp,'projectModelFormDrafts.mjs')).href)

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
 const complete=forms.createBlankProjectModelFinancialFormDrafts()
 assert.deepEqual(complete.costCentres,[])
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts(complete),[])
 const blankMovement=forms.createBlankCostCentreInventoryMovementFormDraft('movement-1')
 assert.equal(blankMovement.openingQuantity,null,'new inventory rows must keep unknown quantities blank')
 assert.equal(blankMovement.closingValue,null,'new inventory rows must keep unknown values blank')
 assert.equal(blankMovement.sourceVerified,false)
 assert.deepEqual(complete.costCentreInventoryMovements,[])
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[blankMovement]}),[])
 const partialMovement={...blankMovement,period:1,inventoryStage:'raw-materials',productId:'RM-1',costCentreId:'STORE-A',openingQuantity:0}
 const partialMovementDraft={...complete,costCentreInventoryMovements:[partialMovement]}
 assert.ok(forms.validateProjectModelFinancialFormDrafts(partialMovementDraft).includes('cost-centre-inventory-0:all-quantities-and-values-required'))
 assert.ok(forms.listUnintegratedFinancialDraftInputs(partialMovementDraft).includes('financialForms.costCentreInventoryMovements.0'),
  'entered inventory rows must remain report blockers until posted into the financial engine')
 const verifiedMovement={...partialMovement,openingValue:0,receiptsQuantity:10,receiptsValue:100,transfersInQuantity:0,transfersInValue:0,transfersOutQuantity:0,transfersOutValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:4,consumptionValue:40,wasteQuantity:0,wasteValue:0,closingQuantity:6,closingValue:60,sourceReference:'inventory card / page 2',sourceVerified:true}
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[verifiedMovement]}),[])
 const duplicateMovement={...verifiedMovement,id:'movement-2'}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[verifiedMovement,duplicateMovement]}).includes('cost-centre-inventory-1:duplicate-movement-key'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[{...verifiedMovement,sourceVerified:false}]}).includes('cost-centre-inventory-0:verified-source-required'))
 const blankCentre=forms.createBlankCostCentreFormDraft('CC-1')
 assert.ok(forms.validateCostCentreFormDraft(blankCentre).includes('cost-centre-name-required'))
 const validCentre={...blankCentre,name:'Rolling mill',type:'production'}
 assert.deepEqual(forms.validateCostCentreFormDraft(validCentre),[])
 const manualCentre={...validCentre,allocationBasis:'manual',manualDriverName:'Machine hours',manualDriverUnit:'h',driverRows:[{period:1,productId:'P1',amount:1}]}
 assert.ok(forms.validateCostCentreFormDraft({...manualCentre,manualDriverName:''}).includes('manual-cost-centre-driver-name-required'))
 assert.deepEqual(forms.validateCostCentreFormDraft(manualCentre),[])
 assert.ok(forms.validateCostCentreFormDraft({...manualCentre,driverRows:[{period:1,productId:'',amount:null}]}).includes('invalid-manual-cost-centre-driver'))
 const trace=forms.createBlankCppCpsTraceItem('trace-1',1)
 Object.assign(trace,{label:'Power',basis:'period-total',behaviour:'variable',fixedPercent:0,variablePercent:100,costCentreId:'CC-1',allocationMethod:'production-quantity',baseCostCoverage:'excluded',periodAmounts:[100],baseCoveredAmounts:[0],source:{status:'verified',reference:'invoice-1',description:'Power invoice',reliability:'primary-document'}})
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,cppCpsTraceItems:[trace]}).includes('cpp-cps-item-trace-1:unknown-cost-centre'))
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentres:[validCentre],cppCpsTraceItems:[trace]}),[])
 const driverTrace={...trace,allocationMethod:'cost-centre-driver'}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentres:[validCentre],cppCpsTraceItems:[driverTrace]}).includes('cpp-cps-item-trace-1:cost-centre-allocation-basis-required'))
 const driverCentre={...manualCentre,allocationBasis:'manual',driverRows:[{period:1,productId:'P1',amount:1}]}
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentres:[driverCentre],cppCpsTraceItems:[driverTrace]}),[])
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentres:[validCentre,{...validCentre,name:'Duplicate'}]}).includes('cost-centre-1:duplicate-cost-centre-id'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentres:[validCentre,{...validCentre,id:' cc-1 ',name:'Duplicate'}]}).includes('cost-centre-1:duplicate-cost-centre-id'))
 assert.ok(forms.validateCostCentreFormDraft({...manualCentre,driverRows:[{period:1,productId:'P1',amount:1},{period:1,productId:' p1 ',amount:2}]}).includes('duplicate-manual-cost-centre-driver'))

 const auditDraft=forms.createBlankProjectModelFinancialFormDrafts()
 assert.deepEqual(forms.listUnintegratedFinancialDraftInputs(auditDraft),[])
 let unintegrated=auditDraft.helpDriven
 unintegrated=h.addHelpFormRow(unintegrated,'production-costs','cost-1')
 unintegrated=h.updateHelpFormRow(unintegrated,'production-costs','cost-1','item','Steel input')
 assert.ok(forms.listUnintegratedFinancialDraftInputs({...auditDraft,helpDriven:unintegrated}).includes('production-costs.cost-1.item'))

 let explicitFalse=auditDraft.helpDriven
 explicitFalse=h.addHelpFormRow(explicitFalse,'sales-programme','sales-1')
 explicitFalse=h.updateHelpFormRow(explicitFalse,'sales-programme','sales-1','productionActive',false)
 assert.ok(forms.listUnintegratedFinancialDraftInputs({...auditDraft,helpDriven:explicitFalse}).includes('sales-programme.sales-1.productionActive'))

 const descriptiveOnly=h.updateHelpFormRow(auditDraft.helpDriven,'project-identification','project-identification-main','title','Test project')
 assert.deepEqual(forms.listUnintegratedFinancialDraftInputs({...auditDraft,helpDriven:descriptiveOnly}),[])
 const blankAsset=forms.createBlankFixedAssetFormDraft('asset-1')
 const withAsset={...auditDraft,assets:[{...blankAsset,metadata:{...blankAsset.metadata,description:'Plant equipment'}}]}
 assert.ok(forms.listUnintegratedFinancialDraftInputs(withAsset).includes('financialForms.assets.0'))

 const salesDraft=forms.createBlankSalesProductFormDraft('product-1')
 const costDraft=forms.createBlankProductionCostFormDraft('cost-1')
 const loanDraft=forms.createBlankLoanFacilityFormDraft('loan-1')
 const taxDraft={...forms.createBlankProjectTaxFormDraft(),system:'corporate'}
 const withAllUnintegrated={...auditDraft,assets:[{...blankAsset,metadata:{...blankAsset.metadata,description:'Plant'}}],productionCosts:[{...costDraft,metadata:{...costDraft.metadata,description:'Raw material'}}],sales:[salesDraft],loans:[{...loanDraft,name:'Term loan'}],tax:taxDraft}
 const blocked=forms.listUnintegratedFinancialDraftInputs(withAllUnintegrated)
 assert.ok(blocked.includes('financialForms.assets.0'),'Asset register remains blocked until its acquisition and depreciation schedules reconcile.')
 for(const path of ['financialForms.productionCosts.0','financialForms.sales.0','financialForms.loans.0','financialForms.tax'])
  assert.ok(!blocked.includes(path),'This form is now validated by its dedicated periodic-engine integration gate: '+path)
 assert.match(forms.describeUnintegratedFinancialDraftInput('financialForms.sales.0','fa'),/برنامه فروش محصول 1/)
 assert.match(forms.describeUnintegratedFinancialDraftInput('financialForms.productionCosts.0','en'),/Production-cost item 1/)
 assert.match(forms.describeUnintegratedFinancialDraftInput('financialForms.economic:employment-effect-required','fa'),/اشتغال/)
 assert.doesNotMatch(forms.describeUnintegratedFinancialDraftInput('financialForms.loans.0','fa'),/financialForms\\./)
 assert.match(forms.describeUnintegratedFinancialDraftInput('financialForms.workingCapital:periodic-working-capital-schedule-not-valid','en'),/Working-capital schedule/)
 const sourcedEconomic={...auditDraft,economic:{...auditDraft.economic,discountRatePercent:10,discountRateSourceReference:'economic-study-page-4',discountRateSourceVerified:true,adjustments:[]}}
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts(sourcedEconomic),[])
 const missingRateSource={...sourcedEconomic,economic:{...sourcedEconomic.economic,discountRateSourceVerified:false}}
 assert.ok(forms.validateProjectModelFinancialFormDrafts(missingRateSource).includes('economic-discount-rate:verified-source-required'))
 const missingShadowSource={...sourcedEconomic,economic:{...sourcedEconomic.economic,adjustments:[{id:'fx-1',name:'FX shadow adjustment',period:'1',treatment:'cost',effectType:'foreign-exchange',financialAmount:100,economicAmount:90,sourceReference:'',sourceVerified:false}]}}
 assert.ok(forms.validateProjectModelFinancialFormDrafts(missingShadowSource).includes('economic-adjustment-0:verified-source-required'))

 console.log('Help-driven item-level finance forms: all assertions passed.')
} finally {
 await rm(temp,{recursive:true,force:true})
}
