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
 const blankStageTransfer=forms.createBlankInventoryStageTransferFormDraft('stage-transfer-1')
 assert.equal(blankStageTransfer.transferValue,null,'inter-stage transfer value must remain blank until sourced')
 assert.equal(blankStageTransfer.sourceVerified,false)
 assert.deepEqual(complete.inventoryStageTransfers,[])
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[blankStageTransfer]}),[])
 const blankMovement=forms.createBlankCostCentreInventoryMovementFormDraft('movement-1')
 assert.equal(blankMovement.openingQuantity,null,'new inventory rows must keep unknown quantities blank')
 assert.equal(blankMovement.closingValue,null,'new inventory rows must keep unknown values blank')
 assert.equal(blankMovement.sourceVerified,false)
 assert.equal(blankMovement.transfersInQuantity,null,'internal transfer quantities must remain unknown until explicitly entered')
 assert.equal(blankMovement.transfersOutValue,null,'internal transfer values must not default to zero')
 assert.equal(blankMovement.salesQuantity,null,'finished-goods sales quantity must remain unknown until explicitly entered')
 assert.equal(blankMovement.salesCostValue,null,'finished-goods cost of sales must remain unknown until explicitly entered')

 const persistedMovement={...blankMovement,period:1,inventoryStage:'raw-materials',productId:'ORE',costCentreId:'ORE-STORE',
  openingQuantity:10,openingValue:100,receiptsQuantity:0,receiptsValue:0,transfersInQuantity:0,transfersInValue:0,
  transfersOutQuantity:0,transfersOutValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:2,consumptionValue:20,
  wasteQuantity:0,wasteValue:0,closingQuantity:8,closingValue:80,sourceReference:'stock-card-1',sourceVerified:true}
 const persistedTransfer={...blankStageTransfer,period:1,sourceStage:'raw-materials',destinationStage:'work-in-progress',
  sourceProductId:'ORE',destinationProductId:'PELLET',sourceCostCentreId:'ORE-STORE',destinationCostCentreId:'DRI',
  quantity:2,sourceUnit:'kg',destinationUnit:'kg',conversionFactor:1,transferValue:20,sourceReference:'issue-1',sourceVerified:true}
 const restored=forms.mergeProjectModelFinancialFormDrafts({costCentreInventoryMovements:[persistedMovement],inventoryStageTransfers:[persistedTransfer]})
 assert.deepEqual(restored.costCentreInventoryMovements,[persistedMovement],'saved cost-centre inventory rows must survive project hydration')
 assert.deepEqual(restored.inventoryStageTransfers,[persistedTransfer],'saved inter-stage transfer rows must survive project hydration')
 const legacyRestored=forms.mergeProjectModelFinancialFormDrafts({tax:{system:'profit-tax'},economic:{discountRatePercent:12,adjustments:[]}})
 assert.deepEqual(legacyRestored.costCentreInventoryMovements,[],'legacy projects without the inventory ledger must hydrate with an empty collection')
 assert.deepEqual(legacyRestored.inventoryStageTransfers,[],'legacy projects without inter-stage transfers must hydrate with an empty collection')
 assert.equal(legacyRestored.tax.system,'profit-tax','hydration must retain existing nested tax settings')
 assert.equal(legacyRestored.economic.discountRatePercent,12,'hydration must retain existing economic settings')
 const malformedRestored=forms.mergeProjectModelFinancialFormDrafts({costCentreInventoryMovements:null,inventoryStageTransfers:null})
 assert.deepEqual(malformedRestored.costCentreInventoryMovements,[],'malformed null inventory collection must not break hydration')
 assert.deepEqual(malformedRestored.inventoryStageTransfers,[],'malformed null transfer collection must not break hydration')

 assert.deepEqual(complete.costCentreInventoryMovements,[])
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[blankMovement]}),[])
 const verificationOnlyMovement={...blankMovement,sourceVerified:true}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[verificationOnlyMovement]}).includes('cost-centre-inventory-0:all-quantities-and-values-required'),
  'a verification-only inventory row must be validated as incomplete')
assert.ok(forms.listUnintegratedFinancialDraftInputs({...complete,costCentreInventoryMovements:[verificationOnlyMovement]}).includes('financialForms.costCentreInventoryMovements.0'),
  'a verification-only inventory row must remain a report blocker')
 const verificationOnlyTransfer={...blankStageTransfer,sourceVerified:true}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[verificationOnlyTransfer]}).includes('inventory-stage-transfer-0:invalid-period'),
  'a verification-only inter-stage transfer must be validated as incomplete')
assert.ok(forms.listUnintegratedFinancialDraftInputs({...complete,inventoryStageTransfers:[verificationOnlyTransfer]}).includes('financialForms.inventoryStageTransfers.0'),
  'a verification-only inter-stage transfer must remain a report blocker')

 const partialMovement={...blankMovement,period:1,inventoryStage:'raw-materials',productId:'RM-1',costCentreId:'STORE-A',openingQuantity:0}
 const partialMovementDraft={...complete,costCentreInventoryMovements:[partialMovement]}
 assert.ok(forms.validateProjectModelFinancialFormDrafts(partialMovementDraft).includes('cost-centre-inventory-0:all-quantities-and-values-required'))
 assert.ok(forms.listUnintegratedFinancialDraftInputs(partialMovementDraft).includes('financialForms.costCentreInventoryMovements.0'),
  'entered inventory rows must remain report blockers until posted into the financial engine')
 const verifiedMovement={...partialMovement,openingValue:0,receiptsQuantity:10,receiptsValue:100,transfersInQuantity:0,transfersInValue:0,transfersOutQuantity:0,transfersOutValue:0,productionQuantity:0,productionValue:0,consumptionQuantity:4,consumptionValue:40,salesQuantity:0,salesCostValue:0,wasteQuantity:0,wasteValue:0,closingQuantity:6,closingValue:60,sourceReference:'inventory card / page 2',sourceVerified:true}
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[verifiedMovement]}),[])
 const missingSalesEvidence={...verifiedMovement,salesQuantity:undefined,salesCostValue:undefined}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[missingSalesEvidence]}).includes('cost-centre-inventory-0:all-quantities-and-values-required'),
  'finished-goods sales and COGS must not default to zero')
 const missingTransferEvidence={...verifiedMovement,transfersInQuantity:undefined,transfersInValue:undefined,transfersOutQuantity:undefined,transfersOutValue:undefined}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[missingTransferEvidence]}).includes('cost-centre-inventory-0:all-quantities-and-values-required'),
  'legacy or incomplete rows must not silently interpret missing internal transfer fields as zero')

 const duplicateMovement={...verifiedMovement,id:'movement-2'}
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[verifiedMovement,duplicateMovement]}).includes('cost-centre-inventory-1:duplicate-movement-key'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,costCentreInventoryMovements:[{...verifiedMovement,sourceVerified:false}]}).includes('cost-centre-inventory-0:verified-source-required'))
 const validStageTransfer={...blankStageTransfer,period:1,sourceStage:'raw-materials',destinationStage:'work-in-progress',
  sourceProductId:'ORE',destinationProductId:'PELLET',sourceCostCentreId:'ORE-STORE',destinationCostCentreId:'DRI-PLANT',
  quantity:4,sourceUnit:'tonne',destinationUnit:'tonne',conversionFactor:1,transferValue:40,
  sourceReference:'material transfer note / 17',sourceVerified:true}
 assert.deepEqual(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[validStageTransfer]}),[])
 assert.ok(forms.listUnintegratedFinancialDraftInputs({...complete,inventoryStageTransfers:[validStageTransfer]}).includes('financialForms.inventoryStageTransfers.0'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[{...validStageTransfer,destinationStage:'raw-materials'}]}).includes('inventory-stage-transfer-0:distinct-source-and-destination-stages-required'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[{...validStageTransfer,sourceVerified:false}]}).includes('inventory-stage-transfer-0:verified-source-required'))
 assert.ok(forms.validateProjectModelFinancialFormDrafts({...complete,inventoryStageTransfers:[{...validStageTransfer,quantity:0}]}).includes('inventory-stage-transfer-0:invalid-quantity-conversion-or-value'))


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
