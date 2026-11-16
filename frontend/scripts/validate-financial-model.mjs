import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const loadTypeScriptModule = async (relativePath) => {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}
const near = (actual, expected, tolerance, label) => {
  assert.ok(Number.isFinite(actual), label + ': result is not finite: ' + actual)
  assert.ok(Math.abs(actual - expected) <= tolerance,
    label + ': expected ' + expected + ', got ' + actual + ', delta ' + (actual - expected))
}
const [engine, reference, integratedReference, workbookAudit, foundation, comfarOutput] = await Promise.all([
  loadTypeScriptModule('../src/features/steel/financialModel.ts'),
  loadTypeScriptModule('../src/features/steel/hotRollingExcelBenchmark.ts'),
  loadTypeScriptModule('../src/features/steel/integratedProjectBenchmark.ts'),
  loadTypeScriptModule('../src/features/steel/workbookReconciliation.ts'),
  loadTypeScriptModule('../src/features/projects/projectFoundation.ts'),
  loadTypeScriptModule('../src/features/steel/hrcr200ComfarOutputReference.ts')
])

const validStartingAsset = {
  id: 'validation-asset', name: 'Validation asset', grossCost: 1000,
  accumulatedDepreciation: 0, remainingLife: 5, opportunityValue: 1000,
  commissioningDate: '2024-02-29', depreciationStartDate: '2024-03-01',
  depreciationMethod: 'linear-scrap', depreciationLengthYears: 5,
  depreciationLengthMonths: 0, firstDepreciationMonths: 12,
  status: 'active'
}
assert.equal(foundation.validateStartingFixedAssetBalances([validStartingAsset], foundation.createBlankProjectFoundation()).length, 0,
  'A valid leap-day commissioning date and integer asset life must pass')
for (const invalidDate of ['2023-02-29', '2024-04-31', '2024-13-01', '2024-00-10']) {
  const issues = foundation.validateStartingFixedAssetBalances([{...validStartingAsset, commissioningDate: invalidDate}], foundation.createBlankProjectFoundation())
  assert.ok(issues.some(issue => issue.code === 'invalid-starting-asset-date'),
    'Impossible calendar date must be rejected: ' + invalidDate)
}
const fractionalLifeIssues = foundation.validateStartingFixedAssetBalances(
  [{...validStartingAsset, depreciationLengthYears: 2.5}], foundation.createBlankProjectFoundation())
assert.ok(fractionalLifeIssues.some(issue => issue.code === 'invalid-starting-asset-depreciation-length'),
  'Depreciation life in years must be an integer')
console.log('PASS: raw foundation rejects impossible calendar dates and fractional asset useful lives')

const blankCalendarFoundation = foundation.createBlankProjectFoundation()
assert.equal(blankCalendarFoundation.planning.projectStartDate, '')
assert.equal(blankCalendarFoundation.planning.projectEndDate, '')
const validCalendarFoundation = foundation.mergeProjectFoundation({
  planning: { ...blankCalendarFoundation.planning, projectStartDate: '2026-10-15', projectEndDate: '2027-02-10', fiscalYearStartMonth: 4, periodFrequency: 'monthly' },
  currencies: { ...blankCalendarFoundation.currencies, localCurrencyCode: 'USD', localCurrencyName: 'US dollar' }
})
assert.equal(foundation.validateProjectFoundation(validCalendarFoundation).filter(issue => issue.severity === 'error').length, 0,
  'Valid project calendar dates and fiscal-year start month must pass foundation validation')
for (const invalidDate of ['2026-02-29', '2026-13-01', '2026-04-31']) {
  const invalid = foundation.mergeProjectFoundation({ planning: { ...blankCalendarFoundation.planning, projectStartDate: invalidDate } })
  assert.ok(foundation.validateProjectFoundation(invalid).some(issue => issue.code === 'invalid-project-start-date'),
    'Invalid project start date must be rejected: ' + invalidDate)
}
const monthlyPeriods = foundation.buildProjectCalendarPeriods('2026-10-15', '2027-02-10', 'monthly', 4)
assert.deepEqual(monthlyPeriods.map(period => [period.startDate, period.endDate, period.days, period.partial]), [
  ['2026-10-15', '2026-10-31', 17, true],
  ['2026-11-01', '2026-11-30', 30, false],
  ['2026-12-01', '2026-12-31', 31, false],
  ['2027-01-01', '2027-01-31', 31, false],
  ['2027-02-01', '2027-02-10', 10, true],
], 'Monthly periods must preserve mid-month project start and partial first/last periods')
const quarterlyPeriods = foundation.buildProjectCalendarPeriods('2026-10-15', '2027-02-10', 'quarterly', 4)
assert.deepEqual(quarterlyPeriods.map(period => [period.startDate, period.endDate, period.days, period.partial]), [
  ['2026-10-15', '2026-12-31', 78, true],
  ['2027-01-01', '2027-02-10', 41, true],
], 'Quarterly periods must align to the fiscal-year start month')
assert.equal(foundation.buildProjectCalendarPeriods('2027-02-10', '2026-10-15', 'monthly', 1).length, 0,
  'A reversed project date range must not produce periods')
console.log('PASS: project calendar validates dates and generates fiscal monthly/quarterly periods with partial periods')

const driAudit = workbookAudit.DRI_STEELMAKING_AUDIT
near(driAudit.capexCategories.reduce((sum,row)=>sum+row.amount,0),
  driAudit.capex.fixedInvestment, 0.01, 'DRI CAPEX category roll-up')
near(driAudit.materials.driUnit + driAudit.materials.steelmakingBase
  + driAudit.materials.marineGradeAdditives + driAudit.materials.apiGradeAdditives
  + driAudit.materials.pressureVesselGradeAdditives,
  driAudit.materials.total, 0.01, 'DRI raw-material grade and process roll-up')
near(driAudit.products.slabRevenue + driAudit.products.surplusDriRevenue,
  driAudit.products.totalRevenue, 0.01, 'DRI slab and surplus-DRI sales bridge')
near(driAudit.energy.driElectricityKwhPerT * 1_760_000
  + driAudit.energy.steelmakingElectricityKwhPerT * 1_200_000,
  driAudit.energy.totalElectricityKwh, 0.01, 'DRI and steelmaking electricity consumption')
near(driAudit.energy.driGasNm3PerT * 1_760_000
  + driAudit.energy.steelmakingGasNm3PerT * 1_200_000,
  driAudit.energy.totalGasNm3, 0.01, 'DRI and steelmaking gas consumption')
near(driAudit.capex.fixedInvestment + driAudit.capex.preproductionNet + driAudit.capex.capitalizedInterest,
  driAudit.capex.constructionUses, 0.2, 'DRI construction uses bridge')
near(driAudit.capex.constructionUses + driAudit.workingCapital, driAudit.totalUses, 0.2, 'DRI total uses bridge')
near(driAudit.funding.equity + driAudit.funding.longTermDebt + driAudit.funding.shortTermDebt,
  driAudit.funding.totalSources, 0.01, 'DRI total sources bridge')
near(driAudit.totalUses - driAudit.funding.totalSources, driAudit.funding.fundingGap, 0.01, 'DRI funding gap')
near(driAudit.annualOpex.rawMaterials + driAudit.annualOpex.labor + driAudit.annualOpex.laborOverhead
  + driAudit.annualOpex.maintenance + driAudit.annualOpex.utilities + driAudit.annualOpex.other,
  driAudit.annualOpex.factoryCostExDepreciation, 0.5, 'DRI factory cost excluding depreciation')
near(driAudit.annualOpex.factoryCostExDepreciation + driAudit.annualOpex.depreciationDetailed,
  driAudit.annualOpex.totalIncludingDepreciation, 0.5, 'DRI total cost including detailed depreciation')
near(driAudit.annualOpex.depreciationDetailed - driAudit.reference.referenceDepreciation,
  6292799.41, 0.02, 'DRI depreciation discrepancy retained as an audit flag')



const rollingAudit = workbookAudit.HOT_ROLLING_200KT_AUDIT

const hrcrFixedAssets = reference.createHotRollingCoilFixedInvestmentItems()
const hrcrFoundation = reference.createHotRollingCoilProjectFoundation()
assert.equal(hrcrFoundation.planning.valuationDate, '2026-03-20', 'HRCR200 12/1404 valuation date must be stored as ISO for HTML date input and periodic discounting')
const migratedLegacyValuation = reference.mergeHotRollingCoilProjectFoundation({...hrcrFoundation,planning:{...hrcrFoundation.planning,valuationDate:'1404-12'}})
assert.equal(migratedLegacyValuation.planning.valuationDate, '2026-03-20', 'Legacy Jalali year-month valuation strings must migrate to the source-backed 12/1404 ISO date')
const preservedCustomValuation = reference.mergeHotRollingCoilProjectFoundation({...hrcrFoundation,planning:{...hrcrFoundation.planning,valuationDate:'2027-04-15'}})
assert.equal(preservedCustomValuation.planning.valuationDate, '2027-04-15', 'A valid user-selected ISO valuation date must survive foundation merging')
const hrcrFixedRegisterTotal = hrcrFixedAssets.filter(item=>item.assetClass!=='preproduction').reduce((total,item)=>total+item.acquisitions.reduce((subtotal,acquisition)=>subtotal+acquisition.quantity*acquisition.unitPrice*(item.origin==='foreign'?(acquisition.exchangeRateToLocal??0):1),0),0)
const hrcrPreproductionTotal = hrcrFixedAssets.filter(item=>item.assetClass==='preproduction').reduce((total,item)=>total+item.acquisitions.reduce((subtotal,acquisition)=>subtotal+acquisition.quantity*acquisition.unitPrice*(item.origin==='foreign'?(acquisition.exchangeRateToLocal??0):1),0),0)
near(hrcrFixedRegisterTotal,rollingAudit.capex.fixedInvestment,0.01,'HRCR200 fixed-asset register must reconcile to fixed investment CAPEX')
near(hrcrPreproductionTotal,rollingAudit.capex.preproductionNet,0.01,'HRCR200 pre-production cost must reconcile separately from fixed investment')
near(hrcrFixedRegisterTotal+hrcrPreproductionTotal,rollingAudit.capex.constructionInvestment,0.01,'HRCR200 fixed assets plus pre-production cost must reconcile to construction investment')
assert.equal(hrcrFixedAssets.length,11,'HRCR200 register must seed 10 fixed-asset groups plus the separate pre-production cost item')
assert.ok(hrcrFixedAssets.find(item=>item.id==='hrcr-site')?.acquisitions.every(row=>row.allocationBasis==='source-period'),'HRCR200 site works must use CAPEX source-period evidence')
assert.ok(hrcrFixedAssets.find(item=>item.id==='hrcr-infrastructure-depreciable')?.acquisitions.every(row=>row.allocationBasis==='proportional-estimate'),'HRCR200 utility subcategory timing must remain labelled as proportional estimates')
const hrcrValidation = foundation.validateFixedInvestmentItems(hrcrFixedAssets,hrcrFoundation)
assert.equal(hrcrValidation.filter(issue=>issue.severity==='error').length,0,'Seeded HRCR200 asset register must pass fixed-investment validation')
assert.ok(hrcrValidation.some(issue=>issue.code==='asset-acquisition-period-estimated'),'Estimated acquisition periods must remain visible as validation warnings')
assert.ok(hrcrValidation.some(issue=>issue.code==='depreciation-basis-conflict'),'Conflicting source depreciation conditions must remain visible as validation warnings')
const mergedHrcrFoundation = reference.mergeHotRollingCoilProjectFoundation({...hrcrFoundation,planning:{...hrcrFoundation.planning,periodFrequency:'unspecified'},currencies:{...hrcrFoundation.currencies,foreignCurrencies:[]}})
assert.equal(mergedHrcrFoundation.planning.periodFrequency,'annual','HRCR reference migration must restore annual source-model frequency when legacy state is unspecified')
assert.equal(mergedHrcrFoundation.currencies.foreignCurrencies[0].code,'EUR','HRCR reference migration must retain the EUR basis required by imported machinery')
const hrcrDepreciationBuild = engine.buildComfarDepreciationAssetsFromFixedInvestmentItems(hrcrFixedAssets,1403,17,'annual',hrcrFoundation)
assert.equal(hrcrDepreciationBuild.warnings.filter(warning=>/تاریخ\/دوره تحصیل|بهای تحصیل پس از تبدیل|تاریخ Starting at|exchange rate|currency/i.test(warning)).length,0,'HRCR200 reference fixed-asset vintages must map without unsupported dates or currencies; source conflicts and estimated allocation warnings must remain visible')
const hrcrLifecycle = engine.calculateComfarAssetLifecycle(hrcrDepreciationBuild.assets,hrcrDepreciationBuild.sales,17)
near(hrcrLifecycle.depreciation.periods[2].depreciation,reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.seededRegisterFirstYearDepreciation,0.02,'HRCR200 first production-year depreciation from the seeded register')
for (const [year, expected] of reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.seededRegisterEngineByYear) {
  const actual = hrcrLifecycle.depreciation.periods.find(period=>1403+period.period-1===year)?.depreciation
  near(actual,expected,0.02,'HRCR200 annual seeded-register depreciation '+year)
}
const hrcr1414 = hrcrLifecycle.depreciation.periods.find(period=>1403+period.period-1===1414)?.depreciation ?? 0
const comfar1414 = reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.comfarDepreciationByYear.find(([year])=>year===1414)?.[1] ?? 0
assert.ok(hrcr1414-comfar1414>300_000,'HRCR200 1414 depreciation mismatch must remain visible pending asset-level disposals and Starting at dates')
near(hrcrLifecycle.depreciation.periods[2].depreciation-reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.comfarFirstYearDepreciation,reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.seededRegisterFirstYearVarianceToComfar,0.02,'HRCR200 first-year seeded-register variance must remain visible')
near(hrcrLifecycle.depreciation.periods[2].depreciation-reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.opexScheduleAnnualDepreciation,reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.seededRegisterVsOpexScheduleVariance,0.02,'HRCR200 pre-production salvage assumption must explain the difference from the OPEX annual schedule')
assert.ok(Math.abs(hrcrLifecycle.depreciation.periods[2].depreciation-rollingAudit.depreciationReconciliation.comfarFirstYear)>500,'HRCR200 depreciation reconciliation must remain open pending asset-level Starting at/disposal data')
near(rollingAudit.capex.fixedInvestment + rollingAudit.capex.preproductionNet,
  rollingAudit.capex.constructionInvestment, 0.01, 'HRCR200 construction investment')
near(rollingAudit.capex.constructionInvestment + rollingAudit.capex.capitalizedInterest,
  rollingAudit.capex.constructionUsesIncludingInterest, 0.01, 'HRCR200 construction uses including interest')
near(rollingAudit.annualOpex.totalIncludingDepreciation - rollingAudit.annualOpex.depreciation,
  rollingAudit.annualOpex.totalExcludingDepreciation, 0.01, 'HRCR200 OPEX excluding depreciation')
assert.equal(rollingAudit.financingAlternativesInWorkbook.mechanismTabDebtSharePercent, 30,
  'HRCR200 mechanism-tab actual amounts must imply 30% debt during construction')
assert.equal(rollingAudit.financingAlternativesInWorkbook.mechanismTabLabelDebtSharePercent, 80,
  'HRCR200 contradictory 80% debt label must remain visible separately from the amounts')
assert.equal(rollingAudit.financingAlternativesInWorkbook.fundingSummaryTabEquitySharePercent, 70,
  'HRCR200 funding-summary actual amounts must preserve 70% equity')
assert.equal(rollingAudit.financingAlternativesInWorkbook.fundingSummaryTabDebtLabelSharePercent, 20,
  'HRCR200 conflicting 20% debt label must remain visible')
assert.equal(rollingAudit.financingAlternativesInWorkbook.workingCapitalFundingSourceConflict, true,
  'HRCR200 working-capital funding gap must remain flagged')
near(rollingAudit.financingAlternativesInWorkbook.workingCapitalFundingGap, 1286225.931577, 0.01,
  'HRCR200 unidentified working-capital funding gap')
const fundingAudit = rollingAudit.financingAlternativesInWorkbook
near(fundingAudit.comfarOutputConstructionEquity + fundingAudit.comfarOutputWorkingCapitalEquity,
  fundingAudit.comfarOutputTotalEquity, 0.01, 'HRCR200 COMFAR equity sources by construction and production phase')
near(fundingAudit.comfarOutputTotalEquity + fundingAudit.comfarOutputLongTermDebtGross,
  fundingAudit.comfarOutputTotalSources, 0.01, 'HRCR200 COMFAR total finance sources')
near(fundingAudit.comfarOutputLongTermDebtGross - fundingAudit.comfarReferenceDebtAmount,
  fundingAudit.comfarReferenceCapitalizedInterest, 0.21, 'HRCR200 gross COMFAR long-term debt includes capitalized construction interest')
near(fundingAudit.comfarOutputEquitySharePercent + fundingAudit.comfarOutputDebtSharePercent,
  100, 1e-9, 'HRCR200 COMFAR output gross source shares')
near(fundingAudit.comfarOutputEquitySharePercent,
  fundingAudit.comfarOutputTotalEquity / fundingAudit.comfarOutputTotalSources * 100, 1e-9,
  'HRCR200 COMFAR equity share across total reported sources')
assert.equal(fundingAudit.comfarOutputWorkingCapitalLoan, 0,
  'HRCR200 COMFAR output classifies the production-phase working-capital contribution as equity, not a loan')
near(fundingAudit.excelMechanismWorkingCapitalLoan, 3309144.525623, 0.01,
  'HRCR200 Excel mechanism tab separately labels working capital as a loan')

const comfar30_70FixedWacc = engine.calculateWacc({
  equityWeight: 70, debtWeight: 30, costOfEquity: 30, costOfDebt: 26, taxRate: 25
})
near(comfar30_70FixedWacc.value, fundingAudit.derivedWacc30_70FixedCapitalPercent / 100, 1e-12,
  'HRCR200 pure fixed-capital 30/70 WACC with 25% debt tax shield')
const comfar30_70EquityWeight = fundingAudit.comfarOutputTotalEquity
  / (fundingAudit.comfarOutputTotalEquity + fundingAudit.comfarReferenceDebtAmount) * 100
const comfar30_70DebtWeight = 100 - comfar30_70EquityWeight
const comfar30_70Wacc = engine.calculateWacc({
  equityWeight: comfar30_70EquityWeight, debtWeight: comfar30_70DebtWeight,
  costOfEquity: 30, costOfDebt: 26, taxRate: 25
})
near(comfar30_70Wacc.value, fundingAudit.comfarWaccWithWorkingCapitalEquityPercent / 100, 1e-12,
  'HRCR200 30/70 fixed capital plus COMFAR working-capital equity WACC')
const workbook20_80Amounts = {
  equity: 3740567.0717058936,
  fixedDebt: 14962268.286823574,
  workingCapitalDebt: 3309144.525623
}
const workbook20_80EquityWeight = workbook20_80Amounts.equity
  / (workbook20_80Amounts.equity + workbook20_80Amounts.fixedDebt + workbook20_80Amounts.workingCapitalDebt) * 100
const workbook20_80DebtWeight = 100 - workbook20_80EquityWeight
const workbook20_80Wacc = engine.calculateWacc({
  equityWeight: workbook20_80EquityWeight, debtWeight: workbook20_80DebtWeight,
  costOfEquity: 30, costOfDebt: 26, taxRate: 25
})
near(workbook20_80Wacc.value, fundingAudit.excelWacc20_80WithWorkingCapitalDebtPercent / 100, 1e-12,
  'HRCR200 Excel WACC sheet reproduces 20/80 fixed funding plus separate working-capital debt')
near(engine.calculateWacc({equityWeight:20,debtWeight:80,costOfEquity:30,costOfDebt:26,taxRate:25}).value,
  fundingAudit.excelWacc20_80FixedOnlyPercent / 100, 1e-12, 'Pure 20/80 fixed-capital WACC')

const comfarReferenceFlows = [...reference.HOT_ROLLING_COMFAR_OUTPUT_AUDIT.projectCashFlowsForIrr]
const comfarValuationNpv = (rate) => engine.calculateNpv(comfarReferenceFlows, rate) * (1 + rate)
near(comfarValuationNpv(0.25), reference.HOT_ROLLING_COMFAR_OUTPUT_AUDIT.projectNpvAt25, 0.02,
  'HRCR200 COMFAR cash flows reproduce reported NPV at the 25% valuation-date convention')
near(engine.calculateIrr(comfarReferenceFlows),
  reference.HOT_ROLLING_COMFAR_OUTPUT_AUDIT.projectIrrPercent / 100, 0.0001,
  'HRCR200 COMFAR project IRR remains independent of the discount-rate scenario')
// Compare total funding bases consistently: COMFAR 30/70 keeps working capital as equity; Excel 20/80 funds it with a separate loan.
const discountOnlyNpv20_80 = comfarValuationNpv(workbook20_80Wacc.value)
const discountOnlyNpv30_70 = comfarValuationNpv(comfar30_70Wacc.value)
near(discountOnlyNpv20_80, 41119481.85, 0.02,
  'HRCR200 discount-only NPV at workbook 20/80 WACC, before recalculating capitalized interest')
near(discountOnlyNpv30_70, 26373890.94, 0.02,
  'HRCR200 discount-only NPV at 30/70 construction WACC, before recalculating capitalized interest')
assert.ok(discountOnlyNpv20_80 > discountOnlyNpv30_70,
  'Lower 20/80 WACC must raise NPV when the same unlevered cash-flow vector is held constant')
// A financing-ratio change does not alter project NPV at a fixed manual discount rate or project IRR when the unlevered project cash-flow vector is unchanged.
const projectNpv25For30_70 = comfarValuationNpv(0.25)
const projectNpv25For20_80 = comfarValuationNpv(0.25)
near(projectNpv25For30_70, projectNpv25For20_80, 0.000001,
  'HRCR200 project NPV at fixed 25% must be invariant to 30/70 versus 20/80 financing')
near(engine.calculateIrr(comfarReferenceFlows), 0.4831, 0.0001,
  'HRCR200 project IRR must remain 48.31% irrespective of WACC weights')
near(projectNpv25For30_70, 31399764.27, 0.02,
  'HRCR200 project NPV at fixed 25% remains the COMFAR output regardless of financing mix')

const firstYear = fundingAudit.firstOperatingYear1405
const baseLoanPrincipal = fundingAudit.comfarReferenceDebtAmount
const loanScale20_80 = workbook20_80Amounts.fixedDebt / baseLoanPrincipal
const firstYearEbitBeforeInterest = firstYear.taxableProfitAfterComfarDebtInterest + firstYear.comfarInterest
const evaluateFirstYearDscr = (loanScale) => {
  const interest = firstYear.comfarInterest * loanScale
  const principal = firstYear.comfarPrincipal * loanScale
  const taxableProfit = Math.max(0, firstYearEbitBeforeInterest - interest)
  const tax = taxableProfit * 0.25
  const cfads = firstYear.revenue - firstYear.operatingCosts - firstYear.marketingCosts
    - tax - firstYear.workingCapitalIncrease
  const debtService = interest + principal
  return { interest, principal, taxableProfit, tax, cfads, debtService, dscr: cfads / debtService }
}
const firstYear30_70 = evaluateFirstYearDscr(1)
const firstYear20_80 = evaluateFirstYearDscr(loanScale20_80)
near(firstYear30_70.debtService, firstYear.comfarAnnualDebtService, 0.01,
  'HRCR200 30/70 first operating-year debt service must match COMFAR')
near(firstYear30_70.dscr, 2.2862240332667514, 1e-9,
  'HRCR200 first operating-year DSCR under 30/70 and 25% flat tax')
near(firstYear20_80.debtService, 8970583.878993252, 0.02,
  'HRCR200 first operating-year debt service under 20/80 scaled COMFAR annuity')
near(firstYear20_80.dscr, 0.9687650693316578, 1e-9,
  'HRCR200 first operating-year DSCR under 20/80 and 25% flat tax')
assert.ok(firstYear30_70.dscr > 1 && firstYear20_80.dscr < 1,
  'HRCR200 first-year 20/80 fixed-debt scenario must flag DSCR below 1 before any separate working-capital loan service')
console.log('FIRST-YEAR DSCR COMPARISON (flat 25% tax; same operations; debt service scaled to the COMFAR five-year annuity; excludes any separate working-capital loan):', {
  DSCR30_70: firstYear30_70.dscr, debtService30_70: firstYear30_70.debtService,
  DSCR20_80: firstYear20_80.dscr, debtService20_80: firstYear20_80.debtService
})
console.log('FINANCING COMPARISON (discount-only; loan interest/capitalized interest not re-run):', {
  WACC20_80: workbook20_80Wacc.value, WACC30_70: comfar30_70Wacc.value,
  WACC30_70FixedOnly: comfar30_70FixedWacc.value,
  NPV20_80: discountOnlyNpv20_80, NPV30_70: discountOnlyNpv30_70,
  NPVAt25Both: comfarValuationNpv(0.25)
})
near(rollingAudit.alternativeMetricsInWorkbook.generalSummaryIrrPercent, 48.31, 0.001,
  'HRCR200 general-summary IRR')
near(rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetProjectIrrPercent, 43.378234116396674, 1e-9,
  'HRCR200 IRR-NPV sheet IRR')
assert.ok(Math.abs(rollingAudit.alternativeMetricsInWorkbook.generalSummaryIrrPercent
  - rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetProjectIrrPercent) > 4,
  'Conflicting HRCR200 IRR outputs must remain an explicit audit item')
near(rollingAudit.financingCashflowSchedule.equityContributionsTotal, 16401129.53, 0.01,
  'HRCR200 reference financing schedule equity contributions')
near(rollingAudit.financingCashflowSchedule.longTermLoanGrossDrawdowns,
  rollingAudit.financingCashflowSchedule.longTermLoanPrincipalRepayments, 0.01,
  'HRCR200 long-term loan gross drawdowns and principal repayments')
near(rollingAudit.alternativeMetricsInWorkbook.generalSummaryTotalInvestment
  - rollingAudit.alternativeMetricsInWorkbook.irrNpvSheetTotalInvestment,
  10009707.09412, 0.1, 'HRCR200 investment base discrepancy')
assert.ok(workbookAudit.WORKBOOK_RECONCILIATION_FLAGS.some(flag => flag.toLowerCase().includes('rows 7–9') && flag.includes('discounted cash flows')), 'HRCR200 discounted-row methodology conflict must remain explicit')
assert.ok(workbookAudit.WORKBOOK_RECONCILIATION_FLAGS.length >= 5,
  'Source conflicts must remain explicit audit flags')
const referenceCashFlow = workbookAudit.HOT_ROLLING_reference_CASHFLOW_AUDIT
assert.equal(referenceCashFlow.periodCount, 18, 'HRCR200 raw reference planning cash flow periods')
assert.equal(referenceCashFlow.rawPlanningNetHasNegativePeriod, false,
  'HRCR200 raw financial-planning net flow has no initial negative investment period')
near(referenceCashFlow.rawPlanningNetC6T6.reduce((sum,value)=>sum+value,0),
  referenceCashFlow.rawPlanningNetTotal, 0.01, 'HRCR200 raw planning net cash flow total')
assert.equal(engine.calculateIrr(referenceCashFlow.rawPlanningNetC6T6), null,
  'HRCR200 raw planning net flow cannot produce project IRR without negative investment cash flow')
assert.equal(referenceCashFlow.netDiscountedC9S9.length, 17, 'HRCR200 discounted net row periods')
near(referenceCashFlow.netDiscountedC9S9.reduce((sum,value)=>sum+value,0),
  referenceCashFlow.netDiscountedSumC9S9, 0.01, 'HRCR200 net discounted row sum')
near(referenceCashFlow.secondDiscountedNpvRow11Sum, 18509558.820966564, 0.01,
  'HRCR200 NPV after second discount in source sheet')
assert.ok(referenceCashFlow.reportedNpvFormula.includes('NPV(')
  && referenceCashFlow.reportedNpvFormula.includes('D9:S9'),
  'HRCR200 source NPV formula must remain visible')
near(referenceCashFlow.equityCashFlowC51T51[0] + referenceCashFlow.equityCashFlowC51T51[1],
  -2761971, 0.01, 'HRCR200 equity cash-flow initial outflows')

console.log('PASS: source-workbook DRI and HRCR200 CAPEX/OPEX bridges and unresolved financing/depreciation flags')

const model = reference.EXCEL_HOT_ROLLING_200KT
const expected = reference.EXCEL_REFERENCE_EXPECTED
const pishranExpected = reference.PISHRAN_REFERENCE_MODEL_OUTPUT
const workspaceSource = await readFile(new URL('../src/features/steel/ProcessPlantWorkspace.tsx', import.meta.url), 'utf8')
const [projectsViewSource,projectRepositorySource,rollingWorkspaceSource,wizardSource,appSource] = await Promise.all([
  readFile(new URL('../src/features/projects/ProjectsView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/projects/projectRepository.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/steel/RollingWorkspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
])
assert.ok(projectsViewSource.includes('قالب پروژه جدید را انتخاب کنید')
  && projectsViewSource.includes('قالب خام')
  && !projectsViewSource.includes('قالب پروژه نورد ورق گرم')
  && !projectsViewSource.includes('hot-rolling-200kt'),
  'New project creation must expose only the blank template')
assert.ok(projectRepositorySource.includes("ProjectTemplateId = 'raw'")
  && projectRepositorySource.includes('templateId?: ProjectTemplateId')
  && projectRepositorySource.includes('removeSampleProjects')
  && projectRepositorySource.includes('projects:workbook-seed:v1')
  && projectRepositorySource.includes('projects:dri-direct-reduction-seed:v1'),
  'Only the raw template remains and saved demonstration projects are removed')
assert.ok(rollingWorkspaceSource.includes("(project.templateId as string)==='hot-rolling-200kt'")
  && rollingWorkspaceSource.includes("!project.templateId&&project.steelStage?.includes('نورد گرم')"),
  'Legacy project detection remains isolated from new raw-template projects')
assert.ok(wizardSource.includes("project.templateId==='raw'"),
  'Raw template must initialize an empty feasibility model')
assert.ok(appSource.includes("onOpenProject={project => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard') }}")
  && !appSource.includes("stage.includes('نورد گرم')"),
  'Every saved project must open in the single raw feasibility model')
assert.ok(projectsViewSource.indexOf("t('نوع پروژه','Project Type')") < projectsViewSource.indexOf("t('نام پروژه','Project Name')")
  && projectsViewSource.includes("value={projectType} onChange={e => setProjectType(e.target.value)}")
  && projectsViewSource.includes("value={name} onChange={e => setName(e.target.value)}")
  && !projectsViewSource.includes('steelStage')
  && !projectsViewSource.includes('نورد ورق گرم'),
  'Raw project creation must ask for a generic project type and manually entered name without specialized steel stages')
assert.ok(projectsViewSource.includes("value={projectType} onChange={e => setProjectType(e.target.value)}")
  && projectsViewSource.includes("projectType: projectType.trim()")
  && projectsViewSource.includes("value={name} onChange={e => setName(e.target.value)}")
  && projectRepositorySource.includes("projectType?: string"),
  'Non-steel raw templates must persist project type separately from the manually entered project name')
assert.ok(!wizardSource.includes("مرحله اصلی زنجیره فولاد")
  && wizardSource.includes('technical:rawProject?[]')
  && wizardSource.includes('balance:rawProject?[]')
  && wizardSource.includes('utilities:rawProject?[]')
  && wizardSource.includes('capex:rawProject?[]')
  && wizardSource.includes('opex:rawProject?[]'),
  'Raw template must hide stage-specific selector and start technical, material, utility, CAPEX and OPEX rows blank')
assert.ok(['mining','concentrate','pellet','dri','steelmaking','dri-steelmaking-slab','hot-rolling','hot-plate','cold-rolling','rebar-rolling','angle-rolling','beam-rolling']
  .every(id=>wizardSource.includes("id:'"+id+"'")&&(wizardSource.includes(id+':{')||wizardSource.includes("'"+id+"':{"))),
  'Every requested steel-chain stage must have a matching stage-specific form definition')
assert.ok(wizardSource.includes("id:'dri-steelmaking-slab'")
  && wizardSource.includes("id:'hot-plate'")
  && wizardSource.includes("const stageFormDefinitions")
  && wizardSource.includes("dri:{")
  && wizardSource.includes("'dri-steelmaking-slab':{")
  && wizardSource.includes("'hot-plate':{")
  && wizardSource.includes("stageRows(stageFormDefinitions[selectedStage.id]?.materials")
  && wizardSource.includes("stageRows(stageFormDefinitions[selectedStage.id]?.utilities")
  && wizardSource.includes("stageCapexRows(stageFormDefinitions[selectedStage.id]?.capex")
  && wizardSource.includes("stageRows(stageFormDefinitions[selectedStage.id]?.opex"),
  'Mining, concentration, pelletizing, DRI, steelmaking, integrated slab, hot plate, hot coil and rolling forms must use stage-specific input rows')
assert.ok(wizardSource.includes("stageOptions.find(s=>s.id==='other')")
  && !wizardSource.includes("stageOptions[10]"),
  'Blank-template stage selection must use stable stage IDs, not a fragile array index')
assert.ok(wizardSource.includes("خرید زمین (۱۳ هکتار؛ ۱۳۰٬۰۰۰ مترمربع)")
  && wizardSource.includes("حقوق و دستمزد ۲۵۰ نفر")
  && wizardSource.includes("کلاف گرم (ماده اولیه اصلی)"),
  'Existing cold-rolling source-based CAPEX, payroll and material-balance fields must be preserved')
assert.ok(wizardSource.includes("unit={project.industry==='انرژی و نیروگاه'?'مگاوات':'واحد/سال'}")
  && projectsViewSource.includes("const INDUSTRY_OPTIONS")
  && !projectsViewSource.includes('inputMode="numeric" pattern="[0-9]*"')
  && projectsViewSource.includes("capacity: '',")
  && projectsViewSource.includes("location: '',"),
  'Raw project creation stays industry-neutral and defers capacity and location inputs to the blank model form')
assert.ok(wizardSource.includes("value=\"industrial\"")
  && wizardSource.includes("value=\"maritime\"")
  && wizardSource.includes("value=\"agricultural\"")
  && wizardSource.includes("value=\"infrastructure\"")
  && wizardSource.includes("value=\"tourism\"")
  && wizardSource.includes("value=\"mining\""),
  'Project Type must cover COMFAR industrial, maritime, agricultural, infrastructure, tourism and mining categories')
assert.ok(wizardSource.includes("Joint-venture Partners")
  && wizardSource.includes("m.partners.length>=20")
  && wizardSource.includes("profitSharePercent"),
  'Joint-venture project must support up to 20 partner records and separate capital/profit shares')
assert.ok(wizardSource.includes("Opportunity Study")
  && wizardSource.includes("Feasibility Study")
  && wizardSource.includes("Joint-venture Project")
  && wizardSource.includes("Economic Analysis")
  && wizardSource.includes("Cost Centre Analysis")
  && wizardSource.includes("Cost Allocation")
  && wizardSource.includes("Value-added Analysis")
  && wizardSource.includes("Foreign Exchange Effect")
  && wizardSource.includes("Employment Effects"),
  'Project identification must expose COMFAR study levels and analysis scope features')
assert.ok(wizardSource.includes("costCentreAnalysis:e.target.checked||m.scope.costAllocation")
  && wizardSource.includes("costAllocation:e.target.checked,costCentreAnalysis:e.target.checked?true:m.scope.costCentreAnalysis"),
  'Cost Allocation must activate Cost Centre Analysis as in the COMFAR Tutorial workflow')
assert.ok(appSource.includes("onOpenProject={project => { setActiveProject({...project,templateId:'raw',steelStage:undefined}); setPage('project-wizard') }}"),
  'All projects must route to the single raw model form')
assert.ok(rollingWorkspaceSource.includes('ممیزی جریان نقدی خام و اصلاح‌شده مرجع مالی')
  && rollingWorkspaceSource.includes('HOT_ROLLING_reference_CASHFLOW_AUDIT'),
  'Active rolling workspace must expose the reference cash-flow audit')
assert.ok(wizardSource.includes('useFixedInvestmentRegister={true}'), 'The shared fixed investment register must remain the authoritative depreciation source for every feasibility project, including when it is empty')
assert.equal(model.discountMode, 'wacc', 'Hot-rolling template must use the sponsor-confirmed WACC by default')

const output = expected.capacity
const currency = model.currency
assert.equal(model.equity, 70, 'HRCR200 Excel reference benchmark must preserve the COMFAR 70/30 construction funding split')
assert.equal(model.debt, 30, 'HRCR200 Excel reference benchmark must preserve the COMFAR 70/30 construction funding split')
assert.equal(model.loans.length, 1, 'HRCR200 COMFAR reference benchmark must not assume an unconfirmed working-capital loan')
near(model.loans[0].amount, 5610850.8, 0.01, 'HRCR200 COMFAR-reference fixed loan amount under 70/30 construction financing')

const integratedreference19 = [...integratedReference.INTEGRATED_reference_PROJECT_CASH_FLOWS]
const integratedControls = integratedReference.INTEGRATED_reference_REFERENCE
near(engine.calculateNpv(integratedreference19, 0.25), integratedControls.projectNpvAt25, 0.01, 'Integrated reference 19-period NPV at 25%')
near(engine.calculateIrr(integratedreference19), integratedControls.projectIrr / 100, 0.0002, 'Integrated reference 19-period IRR')
const funding = integratedReference.calculatereferenceFundingGap()
near(funding.uses, integratedControls.totalInvestment, 0.01, 'reference total uses')
near(funding.sources, integratedControls.totalSources, 0.01, 'reference total sources')
near(funding.gap, integratedControls.fundingGap, 0.01, 'reference funding gap')
assert.ok(workspaceSource.includes('INTEGRATED_reference_PROJECT_CASH_FLOWS'), 'Plant reconciliation must use the centralized reference cash-flow reference')
assert.ok(workspaceSource.includes('calculateNpv(referenceActualFlows,referenceDiscountRate)'), 'reference NPV must discount year 1 at period zero like the reference')

const material = engine.calculateOperatingCostRows(model.materialBalance, output, currency)
const consumables = engine.calculateOperatingCostRows(model.processConsumables, output, currency)
const energy = engine.calculateOperatingCostRows(model.utilities, output, currency)
const spares = engine.calculateOperatingCostRows(model.spareParts, output, currency)
const maintenance = engine.calculateOperatingCostRows(model.maintenance, output, currency)
const general = engine.calculateOperatingCostRows(model.opex, output, currency)
const payrollBase = model.staff.reduce((sum, line) => sum + engine.calculatePayrollCost({
  count: line.count,
  monthlySalary: line.monthlySalary,
  monthlyInsurance: line.insurance,
  monthlyOvertime: line.overtime,
  annualBonus: line.bonus,
  annualSeniority: line.seniority
}), 0)
const payrollOverhead = payrollBase * model.staffOverheadRate / 100
const payrollTotal = payrollBase + payrollOverhead

near(material.totalAtFullOutput + consumables.totalAtFullOutput, expected.rawMaterials, 0.01, 'Raw material and consumables')
near(energy.totalAtFullOutput, expected.energy, 0.01, 'Energy')
near(consumables.totalAtFullOutput, expected.processConsumables, 0.01, 'Process consumables')
near(spares.totalAtFullOutput, expected.spareParts, 0.01, 'Spare parts')
near(maintenance.totalAtFullOutput, expected.maintenance, 0.01, 'Maintenance')
near(payrollBase, expected.payrollBase, 0.000001, 'Annual payroll')
near(payrollOverhead, expected.payrollOverhead, 0.000001, 'Payroll overhead')
near(payrollTotal, expected.payrollTotal, 0.000001, 'Payroll total')
near(general.fixedAnnual, expected.factoryOverhead, 0.01, 'Factory overhead')
near(general.variablePerTonne * output, expected.marketing, 0.01, 'Direct marketing')
const opexWithoutDepreciation = material.totalAtFullOutput + consumables.totalAtFullOutput +
  energy.totalAtFullOutput + spares.totalAtFullOutput + maintenance.totalAtFullOutput +
  general.totalAtFullOutput + payrollTotal
near(opexWithoutDepreciation, expected.opexWithoutDepreciation, 1, 'Annual OPEX excluding depreciation')
near(opexWithoutDepreciation + model.annualDepreciationOverride, expected.opexWithDepreciation, 1, 'Annual cost including depreciation')

const departmentTotals = model.staffDepartments.reduce((totals, row) => ({
  expert: totals.expert + row.expert,
  technician: totals.technician + row.technician,
  secretary: totals.secretary + row.secretary,
  operator: totals.operator + row.operator,
  driver: totals.driver + row.driver,
  laborer: totals.laborer + row.laborer
}), { expert: 0, technician: 0, secretary: 0, operator: 0, driver: 0, laborer: 0 })
for (const [key, value] of Object.entries({expert:66,technician:61,secretary:17,operator:71,driver:20,laborer:50})) {
  assert.equal(departmentTotals[key], value, 'Staff matrix total: ' + key)
}

const wacc = engine.calculateWacc({
  equityWeight: model.equity,
  debtWeight: model.debt,
  costOfEquity: model.ke,
  costOfDebt: model.kd,
  taxRate: model.waccTax
})
assert.equal(wacc.valid, true, 'WACC inputs must be valid')
near(wacc.value, 0.2685, 1e-12, 'Historical COMFAR-reference 70/30 WACC')
near(expected.wacc, 0.21284299025331596, 1e-12, 'Historical workbook WACC remains a source-only benchmark')

const factoryRows = model.opex.filter(row => row.costGroup === 'سربار کارخانه')
const factory = engine.calculateOperatingCostRows(factoryRows, output, currency)
const wcProductionBasis = material.totalAtFullOutput + consumables.totalAtFullOutput +
  Math.round(energy.totalAtFullOutput) + spares.totalAtFullOutput + maintenance.totalAtFullOutput +
  Math.round(payrollBase) + Math.round(payrollOverhead) + factory.totalAtFullOutput
const wcCashBasis = maintenance.totalAtFullOutput + Math.round(payrollBase) +
  Math.round(payrollOverhead) + factory.totalAtFullOutput
const wcBases = {
  'wc-raw': material.totalAtFullOutput + consumables.totalAtFullOutput,
  'wc-energy': energy.totalAtFullOutput,
  'wc-spares': spares.totalAtFullOutput,
  'wc-wip': wcProductionBasis,
  'wc-finished': wcProductionBasis,
  'wc-receivable': output * model.products.reduce((sum, product) => sum + product.mix / 100 * product.price, 0),
  'wc-cash': wcCashBasis,
  'wc-foreign-cash': 0,
  'wc-deposit': 0,
  'wc-interest': 0,
  'wc-payables': material.totalAtFullOutput + consumables.totalAtFullOutput
}
const wcItems = model.workingCapitalItems.map(item => ({ ...item, annualBase: item.annualBase > 0 ? item.annualBase : (wcBases[item.id] ?? 0) }))
const workingCapital = engine.calculateWorkingCapital(wcItems, 1, model.workingCapitalDayBasis)
near(workingCapital, expected.workingCapital, 0.02, 'Net working capital with 360-day basis')
const wc365 = engine.calculateWorkingCapital(wcItems, 1, 365)
assert.ok(Math.abs(wc365 - workingCapital) > 1000, '360/365 convention must materially change the benchmark result')

const cashFlows = [...expected.referenceIrrNpvNetDiscountedCashFlows]
near(engine.calculateNpv(cashFlows, expected.roundedDiscountRate), expected.irrNpvSheetReportedNpvAt21, 0.01, 'Reproduce reported IRR-NPV sheet NPV at 21% from its row 9 basis')
near(engine.calculateNpv(cashFlows, expected.wacc), expected.npvAtExactWacc, 0.01, 'Reproduce IRR-NPV sheet NPV on reported discounted-row basis at exact WACC')
near(engine.calculateIrr(cashFlows), expected.irrNpvSheetReportedIrr, 1e-8, 'Reproduce IRR-NPV sheet reported IRR from its row 9 basis')
near(engine.calculateMirr(cashFlows, expected.financeRate, expected.reinvestmentRate), expected.irrNpvSheetReportedMirr, 1e-8, 'Reproduce IRR-NPV sheet reported MIRR from its row 9 basis')


const totalCapex = model.capex.reduce((sum, row) => sum + row.quantity * row.unitPrice * (row.currency === currency ? 1 : row.fxRate), 0)
const landCost = model.capex.filter(row => row.costGroup === 'زمین').reduce((sum, row) => sum + row.quantity * row.unitPrice, 0)
const depreciable = Math.max(0, totalCapex - landCost)
const ramp = model.ramp
let priorProjectLoss = 0
let previousNwc = 0
let accumulatedDepreciation = 0
const generatedProjectCashFlows = []
const weightedPrice = model.products.reduce((sum, product) => sum + product.mix / 100 * product.price, 0)
const fixedShare = model.opexFixedShare / 100
const directFixed = material.fixedAnnual + energy.fixedAnnual + consumables.fixedAnnual +
  spares.fixedAnnual + maintenance.fixedAnnual + payrollTotal
const directVariablePerTonne = material.variablePerTonne + energy.variablePerTonne +
  consumables.variablePerTonne + spares.variablePerTonne + maintenance.variablePerTonne
const capexYears = Math.max(1, Math.floor(model.constructionYears))
for (let index = 0; index < capexYears + model.life; index++) {
  const constructionYear = index < capexYears
  const operatingYear = constructionYear ? 0 : index - capexYears + 1
  const rampFactor = operatingYear > 0 ? (ramp[operatingYear - 1] ?? 100) / 100 : 0
  const output = expected.capacity * rampFactor
  const revenue = output * weightedPrice
  const generalOpex = general.fixedAnnual * (fixedShare + (1 - fixedShare) * rampFactor) +
    general.variablePerTonne * output
  const operatingCost = operatingYear > 0 ? generalOpex + directFixed + directVariablePerTonne * output : 0
  const ebitda = revenue - operatingCost
  const annualDepreciation = model.annualDepreciationOverride > 0
    ? model.annualDepreciationOverride : depreciable / Math.max(1, model.depreciationYears)
  const depreciation = operatingYear > 0 && operatingYear <= model.depreciationYears
    ? Math.min(annualDepreciation, Math.max(0, depreciable - accumulatedDepreciation)) : 0
  accumulatedDepreciation += depreciation
  const nwc = operatingYear > 0 && operatingYear < model.life
    ? engine.calculateWorkingCapital(wcItems, rampFactor, model.workingCapitalDayBasis) : 0
  const deltaWorkingCapital = nwc - previousNwc
  previousNwc = nwc
  const capexSpend = constructionYear ? totalCapex * (model.capexSchedule[index] ?? 0) / 100 : 0
  const terminalValue = operatingYear === model.life
    ? (model.terminalValueOverride > 0 ? model.terminalValueOverride : depreciable * model.salvagePct / 100) : 0
  const result = engine.calculateProjectCashFlowPeriod({
    ebitda, depreciation, capexSpend, deltaWorkingCapital, terminalValue
  }, model.tax, priorProjectLoss)
  priorProjectLoss = result.lossCarryForward
  generatedProjectCashFlows.push(result.projectCashFlow)
}
console.log('DEBUG Pishran generated flows:', JSON.stringify(generatedProjectCashFlows))
console.log('DEBUG reference flows:', JSON.stringify(pishranExpected.projectCashFlows))
console.log('DEBUG working capital:', workingCapital, 'OPEX:', opexWithoutDepreciation, 'WACC:', wacc.value)
const generatedreferenceComparison = engine.reconcileCashFlowSeries(generatedProjectCashFlows, expected.referenceIrrNpvNetDiscountedCashFlows, 0.01)
assert.equal(generatedreferenceComparison.matched, false, 'Raw Pishran project cash flows must not be represented as matching the IRR-NPV sheet discounted-row vector')
console.log('Basis comparison: raw Pishran project flows vs IRR-NPV sheet row 9 (reported net discounted flows; not like-for-like):', {
  matched: generatedreferenceComparison.matched,
  periodCountMatch: generatedreferenceComparison.periodCountMatch,
  modelTotal: generatedreferenceComparison.modelTotal,
  referenceTotal: generatedreferenceComparison.referenceTotal,
  totalDifference: generatedreferenceComparison.totalDifference,
  maxAbsoluteDifference: generatedreferenceComparison.maxAbsoluteDifference
})
assert.equal(generatedProjectCashFlows.length, pishranExpected.projectCashFlows.length, 'Pishran project flow period count')
for (let index = 0; index < generatedProjectCashFlows.length; index++) near(generatedProjectCashFlows[index], pishranExpected.projectCashFlows[index], 0.01, 'Pishran raw project cash flow period ' + (index + 1))
assert.ok(generatedProjectCashFlows.every(Number.isFinite), 'Pishran generated cash flows must all be finite')
assert.ok(generatedProjectCashFlows.some(value => value < 0) && generatedProjectCashFlows.some(value => value > 0),
  'Pishran generated cash flows must contain investment outflow and operating inflow')
const generatedNpv = engine.calculateNpv(generatedProjectCashFlows, expected.roundedDiscountRate)
const generatedIrr = engine.calculateIrr(generatedProjectCashFlows)
const generatedMirr = engine.calculateMirr(generatedProjectCashFlows, expected.financeRate, expected.reinvestmentRate)
assert.ok(Number.isFinite(generatedNpv) && Number.isFinite(generatedIrr) && Number.isFinite(generatedMirr),
  'Pishran-generated NPV, IRR and MIRR must be finite')
near(generatedNpv, pishranExpected.npvAt21Percent, 0.01, 'Pishran-generated NPV at 21%')
near(engine.calculateNpv(generatedProjectCashFlows, 0.25), pishranExpected.npvAt25Percent, 0.01, 'Pishran-generated NPV at 25% for like-rate comparison with General Summary')
near(pishranExpected.npvAt25Percent - workbookAudit.HOT_ROLLING_200KT_AUDIT.alternativeMetricsInWorkbook.generalSummaryNpvAt25, -37940.98962954, 0.02, 'Pishran and reference General Summary same-rate NPV difference')
near(generatedIrr, pishranExpected.irr, 1e-8, 'Pishran-generated IRR')
near(generatedMirr, pishranExpected.mirr, 1e-8, 'Pishran-generated MIRR')
console.log('Pishran independent project metrics; source reference outputs remain unreconciled pending corrected raw cash-flow export:', {
  NPV21: generatedNpv, NPV25: engine.calculateNpv(generatedProjectCashFlows, 0.25), IRR: generatedIrr, MIRR: generatedMirr
})

console.log('PASS: raw materials, energy, process consumables, spares, maintenance and payroll')
console.log('PASS: 360-day working capital = ' + workingCapital.toFixed(4) + ' million Rial')
console.log('PASS: WACC = ' + (wacc.value * 100).toFixed(6) + '%')
console.log('PASS: Pishran independently reproduces its own raw project cash-flow benchmark; reference row 9 is kept as a separate reported discounted-row control.')
console.log('PASS: Pishran-generated project cash flows are finite and return valid NPV / IRR / MIRR')
console.log('REVIEW REQUIRED: reference IRR-NPV row 9 is not a verified raw project cash-flow vector; source investment base and financing schedules conflict with the CAPEX workbook.')
console.log('NOTE: Excel rounds WACC 21.284299% to 21% for its IRR-NPV sheet cell; its row 9 basis is not validated as raw project cash flow.')


const integrated = engine.calculateIntegratedFinance({
  years: 6,
  constructionYears: 1,
  capacity: 100,
  fullCapacityRevenue: 2000,
  fullCapacityVariableCashCost: 600,
  fullCapacityFixedCashCost: 400,
  annualDepreciation: 100,
  fixedInvestment: 1000,
  preOperatingCost: 100,
  fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
  preOperatingSchedule: [100, 0, 0, 0, 0, 0],
  utilization: [0, 1, 1, 1, 1, 1],
  equityContributions: [600, 0, 0, 0, 0, 0],
  loans: [{
    id: 'test-loan',
    label: 'Test loan',
    drawdowns: [400, 0, 0, 0, 0, 0],
    annualRate: 10,
    graceYears: 0,
    termYears: 2,
    repaymentStartYear: 2,
    repaymentMethod: 'equal-principal',
    capitalizeInterest: false
  }],
  taxRate: 25,
  costOfEquity: 20,
  workingCapitalPercent: 10,
  salesEscalationPercent: 1,
  opexEscalationPercent: 2,
  discountMode: 'wacc',
  manualDiscountRate: 25,
  salvageValue: 50,
  salvageBookValue: 20
})
near(integrated.wacc, 0.15, 1e-12, 'Integrated WACC')
const matchingCashFlows = engine.reconcileCashFlowSeries([-100, 60, 60], [-100, 60, 60], 0.01)
assert.equal(matchingCashFlows.matched, true, 'Identical reference cash-flow vectors must reconcile')
const differingCashFlows = engine.reconcileCashFlowSeries([-100, 55, 60], [-100, 60, 60], 0.01)
assert.equal(differingCashFlows.matched, false, 'Cash-flow differences above tolerance must be flagged')
near(differingCashFlows.maxAbsoluteDifference, 5, 1e-12, 'Maximum annual cash-flow variance')
const missingPeriodCashFlows = engine.reconcileCashFlowSeries([-100, 60], [-100, 60, 0], 0.01)
assert.equal(missingPeriodCashFlows.periodCountMatch, false, 'Missing reference periods must not be silently aligned')
const taxSeparationInput = {
  years: 3, constructionYears: 1, capacity: 10,
  fullCapacityRevenue: 1000, fullCapacityVariableCashCost: 200,
  fullCapacityFixedCashCost: 100, annualDepreciation: 50,
  fixedInvestment: 100, preOperatingCost: 0,
  fixedInvestmentSchedule: [100, 0, 0], preOperatingSchedule: [0, 0, 0],
  utilization: [0, 1, 1], equityContributions: [60, 0, 0],
  loans: [{ id: 'tax-test-loan', label: 'Tax test loan', drawdowns: [40, 0, 0],
    annualRate: 10, graceYears: 0, termYears: 1, repaymentStartYear: 2,
    repaymentMethod: 'bullet', capitalizeInterest: false }],
  taxRate: 25, waccTaxRate: 25, costOfEquity: 20,
  workingCapitalPercent: 0, salesEscalationPercent: 0, opexEscalationPercent: 0,
  discountMode: 'wacc', manualDiscountRate: 25
}
const taxBase = engine.calculateIntegratedFinance(taxSeparationInput)
const reportSensitivityInput = {
  ...taxSeparationInput,
  workingCapitalPolicy: {
    dayBasis: 360, rawMaterialDays: 30, workInProgressDays: 2,
    workInProgressMaterialCompletionPercent: 100, workInProgressConversionCompletionPercent: 100,
    finishedGoodsDays: 5, receivableDays: 0, cashDays: 10, payableDays: 0,
    annualRawMaterialCost: 100, energyDays: 15, annualEnergyCost: 20,
    sparePartsDays: 30, annualSparePartsCost: 10, annualConversionCost: 80,
    annualFinishedGoodsCost: 180, annualRevenue: 1000, annualCashOperatingCost: 300
  }
}
const reportSensitivity = engine.calculateOneWaySensitivity(reportSensitivityInput, 20)
assert.equal(reportSensitivity.factors.length, 4, 'One-way report sensitivity must include price, fixed investment, operating cost and energy')
assert.ok(reportSensitivity.factors.every(factor => factor.available && factor.lowNpv !== null && factor.highNpv !== null),
  'All four report sensitivity factors must be recalculated from the integrated model when energy cost is available')
assert.ok(reportSensitivity.factors[0].lowNpv < reportSensitivity.baseNpv
  && reportSensitivity.factors[0].highNpv > reportSensitivity.baseNpv,
  'Selling-price sensitivity must move NPV in the expected direction')
assert.ok(reportSensitivity.factors[1].lowNpv > reportSensitivity.baseNpv
  && reportSensitivity.factors[1].highNpv < reportSensitivity.baseNpv,
  'Fixed-investment sensitivity must move NPV in the expected direction')
assert.ok(reportSensitivity.factors[2].lowNpv > reportSensitivity.baseNpv
  && reportSensitivity.factors[2].highNpv < reportSensitivity.baseNpv,
  'Operating-cost sensitivity must move NPV in the expected direction')
assert.ok(reportSensitivity.factors[3].lowNpv > reportSensitivity.baseNpv
  && reportSensitivity.factors[3].highNpv < reportSensitivity.baseNpv,
  'Energy-cost sensitivity must move NPV in the expected direction')
const lowerOperatingTax = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRate: 5 })
const lowerWaccTaxShield = engine.calculateIntegratedFinance({ ...taxSeparationInput, waccTaxRate: 20 })
near(lowerOperatingTax.wacc, taxBase.wacc, 1e-12, 'Operating tax must not change WACC tax shield')
assert.ok(lowerOperatingTax.years[1].tax < taxBase.years[1].tax, 'Operating tax rate must change cash taxes')
assert.notEqual(lowerWaccTaxShield.wacc, taxBase.wacc, 'WACC tax shield rate must change WACC')
near(lowerWaccTaxShield.years[1].tax, taxBase.years[1].tax, 1e-9, 'WACC tax shield must not change operating cash taxes')
const annualTaxSchedule = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRateSchedule: [25, 5, 25] })
near(annualTaxSchedule.years[1].tax, lowerOperatingTax.years[1].tax, 1e-9, 'Year-specific operating tax schedule')
near(annualTaxSchedule.wacc, taxBase.wacc, 1e-12, 'Annual operating tax schedule must not alter WACC')
const invalidTaxSchedule = engine.calculateIntegratedFinance({ ...taxSeparationInput, taxRateSchedule: [25, 105, 25] })
assert.ok(invalidTaxSchedule.warnings.some(warning => warning.includes('نرخ مالیات عملکرد سالانه')), 'Invalid annual tax rates must produce a warning')
near(integrated.totalFunding, 1000, 1e-9, 'Integrated funding')
near(integrated.peakWorkingCapital, 108.243216, 1e-9, 'Integrated working capital with OPEX escalation')
near(integrated.fundingGap, 208.243216, 1e-9, 'Integrated funding gap with OPEX escalation')
near(integrated.loanSchedules['test-loan'][1].principal, 200, 1e-9, 'Equal principal repayment')
near(integrated.years[1].revenue, 2000, 1e-9, 'First operating year sales')
near(integrated.years[2].revenue, 2020, 1e-9, 'Sales escalation')
near(integrated.years[2].variableCashCost, 612, 1e-9, 'OPEX escalation')
assert.ok(Number.isFinite(integrated.npvProject), 'Integrated project NPV must be finite')
assert.ok(Number.isFinite(integrated.irrProject), 'Integrated project IRR must be finite')
assert.ok(Number.isFinite(integrated.irrEquity), 'Integrated equity IRR must be finite')
assert.ok(Number.isFinite(integrated.mirrEquity), 'Integrated modified equity IRR must be finite')
assert.ok(workspaceSource.includes("'Modified IRRE on equity':financeResult.mirrEquity===null?0:financeResult.mirrEquity*100"), 'reference modified equity IRR must use the integrated equity cash flow')
assert.equal(integrated.years.length, 6, 'Integrated model period count')
near(integrated.years[5].salvageProceeds, 50, 1e-9, 'Terminal salvage proceeds')
near(integrated.years[5].terminalValue, 50, 1e-9, 'Terminal value includes salvage only; working capital is recovered through the final-period NWC release')
near(integrated.years[5].workingCapital, 108.243216, 1e-9, 'Terminal-year operating working-capital requirement remains visible before recovery')
near(integrated.years[5].closingWorkingCapital, 0, 1e-9, 'Terminal working capital is released at project end')
for (let index = 0; index < integrated.years.length; index++) {
  const year = integrated.years[index]
  const openingCash = index ? integrated.years[index - 1].cashBalance : 0
  const inflows = year.revenue + year.equityContribution + year.debtDrawdown + year.terminalValue
  const outflows = year.fixedInvestment + year.preOperatingCost + year.changeInWorkingCapital + year.variableCashCost + year.fixedCashCost + year.tax + year.interest + year.principal
  near(year.cashBalance - openingCash, inflows - outflows, 1e-8, 'Annual cash flow statement reconciliation year ' + year.year)
}

const capacityScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 200,
    fullCapacityRevenue: 4000, fullCapacityVariableCashCost: 1200,
    fullCapacityFixedCashCost: 400, annualDepreciation: 200,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(capacityScenario.years[1].production, 200, 1e-9, 'Capacity scenario production')
near(capacityScenario.years[1].revenue, 4000, 1e-9, 'Capacity scenario revenue')
near(capacityScenario.years[1].variableCashCost, 1200, 1e-9, 'Capacity scenario variable OPEX')
near(capacityScenario.years[1].fixedCashCost, 400, 1e-9, 'Capacity scenario fixed OPEX')
assert.notEqual(capacityScenario.npvProject, integrated.npvProject, 'Capacity changes must update project NPV')

const priceScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2200, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(priceScenario.years[1].revenue, 2200, 1e-9, 'Sales price scenario revenue')
assert.notEqual(priceScenario.npvProject, integrated.npvProject, 'Sales price changes must update project NPV')

const capitalStructureScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2000, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [800, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [200, 0, 0, 0, 0, 0],
      annualRate: 10, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
near(capitalStructureScenario.wacc, 0.175, 1e-12, 'Capital structure scenario WACC')
assert.notEqual(capitalStructureScenario.wacc, integrated.wacc, 'Capital structure changes must update WACC')

const loanRateScenario = engine.calculateIntegratedFinance({
  ...{
    years: 6, constructionYears: 1, capacity: 100,
    fullCapacityRevenue: 2000, fullCapacityVariableCashCost: 600,
    fullCapacityFixedCashCost: 400, annualDepreciation: 100,
    fixedInvestment: 1000, preOperatingCost: 100,
    fixedInvestmentSchedule: [1000, 0, 0, 0, 0, 0],
    preOperatingSchedule: [100, 0, 0, 0, 0, 0],
    utilization: [0, 1, 1, 1, 1, 1],
    equityContributions: [600, 0, 0, 0, 0, 0],
    loans: [{ id: 'test-loan', label: 'Test loan', drawdowns: [400, 0, 0, 0, 0, 0],
      annualRate: 12, graceYears: 0, termYears: 2, repaymentStartYear: 2,
      repaymentMethod: 'equal-principal', capitalizeInterest: false }],
    taxRate: 25, costOfEquity: 20, workingCapitalPercent: 10,
    salesEscalationPercent: 1, opexEscalationPercent: 2,
    discountMode: 'wacc', manualDiscountRate: 25
  }
})
assert.ok(loanRateScenario.years[1].interest > integrated.years[1].interest,
  'Loan rate changes must update interest expense')
assert.notEqual(loanRateScenario.wacc, integrated.wacc, 'Loan rate changes must update WACC')
console.log('PASS: capacity, selling price, capital structure and loan-rate changes propagate to financial results')

const cyclePolicy = {
  dayBasis: 360,
  rawMaterialDays: 30,
  workInProgressDays: 10,
  workInProgressMaterialCompletionPercent: 100,
  workInProgressConversionCompletionPercent: 50,
  finishedGoodsDays: 15,
  receivableDays: 45,
  cashDays: 5,
  payableDays: 20,
  annualRawMaterialCost: 3600,
  annualPayablesCost: 5400,
  annualFixedPayablesCost: 0,
  annualConversionCost: 1800,
  annualFinishedGoodsCost: 7200,
  annualRevenue: 7200,
  annualCashOperatingCost: 3600
}
const cycle = engine.calculateOperatingCycleWorkingCapital(cyclePolicy, 0.5, 1.1, 1.2)
near(cycle.rawMaterials, 180, 1e-9, 'Operating cycle raw material inventory')
near(cycle.workInProgress, 75, 1e-9, 'Operating cycle WIP inventory with material and conversion completion')
near(cycle.finishedGoods, 180, 1e-9, 'Operating cycle finished goods')
near(cycle.receivables, 495, 1e-9, 'Operating cycle receivables')
near(cycle.minimumCash, 30, 1e-9, 'Operating cycle minimum cash')
near(cycle.payables, 180, 1e-9, 'Operating cycle supplier payables including energy and maintenance purchases')
near(cycle.netWorkingCapital, 780, 1e-9, 'Operating cycle net working capital with supplier purchase base')
near(engine.calculateCashConversionCycleDays(cyclePolicy), 80, 1e-9, 'Cash conversion cycle days')
near(engine.calculateCashConversionCycleDays({ ...cyclePolicy, rawMaterialDays: 500 }), 410, 1e-9, 'Cash conversion cycle clamps days to the selected annual basis')
const fixedCostCycle = engine.calculateOperatingCycleWorkingCapital({ ...cyclePolicy, annualFixedConversionCost: 900, annualFixedFinishedGoodsCost: 900, annualFixedCashOperatingCost: 900 }, 0.5, 1.1, 1.2)
near(fixedCostCycle.workInProgress, 82.5, 1e-9, 'WIP fixed and variable conversion cost split')
near(fixedCostCycle.finishedGoods, 202.5, 1e-9, 'Finished goods fixed and variable cost split')
near(fixedCostCycle.minimumCash, 37.5, 1e-9, 'Minimum cash fixed and variable cost split')
near(fixedCostCycle.payables, 180, 1e-9, 'Supplier payables use eligible purchases rather than raw materials only')
near(fixedCostCycle.netWorkingCapital, 817.5, 1e-9, 'Fixed-cost-aware operating working capital')

const scaledCapex = engine.calculateCapacityScaledCapex(1000, 100, 200, 0.6)
near(scaledCapex.factor, Math.pow(2, 0.6), 1e-12, 'Non-linear CAPEX scale factor')
near(scaledCapex.amount, 1000 * Math.pow(2, 0.6), 1e-9, 'Non-linear CAPEX scaled amount')
near(engine.calculateCapacityScaledCapex(1000, 100, 200, 0).amount, 1000, 1e-9, 'Fixed CAPEX category elasticity')
assert.equal(engine.calculateCapacityScaledCapex(1000, 0, 200, 0.6).valid, false, 'Invalid reference capacity must be rejected')

const grossWorkingCapitalChange = cycle.rawMaterials + cycle.workInProgress + cycle.finishedGoods + cycle.receivables + cycle.minimumCash
const netWorkingCapitalChange = grossWorkingCapitalChange - cycle.payables
near(netWorkingCapitalChange, cycle.netWorkingCapital, 1e-9, 'reference working capital bridge: gross assets less supplier credit')
const priorNwc = 500, currentNwc = 780, priorPayables = 100, currentPayables = 180
const referenceGrossAssetIncrease = (currentNwc - priorNwc) + (currentPayables - priorPayables)
near(referenceGrossAssetIncrease - (currentPayables - priorPayables), currentNwc - priorNwc, 1e-9, 'reference gross working capital and payable source reconciliation')
console.log('PASS: operating-cycle working capital, WIP completion, fixed/variable costs, supplier credit and cash conversion cycle')
console.log('PASS: non-linear category CAPEX scaling and invalid-input handling')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'reference must report the net working-capital movement after supplier credit')
assert.ok(workspaceSource.includes("'Accounts payable':0,'TOTAL SOURCES OF FINANCE':year.equityContribution+year.debtDrawdown+financeSumAt(financeLoans,i,'capitalizedInterest')"), 'reference must not double count payables already deducted in net working capital')
assert.ok(workspaceSource.includes("'TOTAL INVESTMENT COSTS':year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+capitalizedInterest"), 'reference total investment costs must reconcile CAPEX, pre-production, capitalized interest and net working capital')
assert.ok(workspaceSource.includes("'TOTAL CASH INFLOW':year.revenue+year.equityContribution+year.debtDrawdown+year.terminalValue"), 'Cash flow statement must include terminal recoveries')
assert.ok(workspaceSource.includes("'TOTAL CASH OUTFLOW':uses"), 'reference cash outflow subtotal must use the same cash-use bridge as the balance')
assert.ok(workspaceSource.includes("uses=year.fixedInvestment+year.preOperatingCost+year.changeInWorkingCapital+cashOpex+year.tax+year.interest+year.principal"), 'Cash outflow must include fixed assets, pre-production, net working capital, operating costs, tax, interest and principal')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'Other income must reconcile to terminal value')
assert.ok(workspaceSource.includes("'Total short-term loans':shortTerm"), 'Cash-flow statement must use reference short-term-loan row naming')
assert.ok(workspaceSource.includes("'SURPLUS (DEFICIT)':year.cashBalance-opening,'CUMULATIVE CASH BALANCE':year.cashBalance"), 'Annual and cumulative cash balances must reconcile to the cash-flow statement')
assert.ok(workspaceSource.includes("'TAXABLE PROFIT':year.taxableProfit"), 'reference taxable profit must use loss carry-forward')
assert.ok(workspaceSource.includes("'Interest':capitalizedInterest"), 'reference investment cost must include only capitalized interest, not cash interest twice')
assert.ok(workspaceSource.includes("'Total pre-production expenditures':year.preOperatingCost+capitalizedInterest,'Pre-production expenditures (net of interest)':year.preOperatingCost"), 'reference pre-production subtotal must reconcile net expenditures plus capitalized interest')
assert.ok(workspaceSource.includes("taxRateSchedule:Array.from({length:19},(_,i)=>Math.max(0,Math.min(100,Number(financeRow('نرخ مالیات عملکرد سالانه (%)')?.values['y'+(i+1)]??financeValue('نرخ مالیات عملکرد پایه (%)',25)))))"), 'Annual tax schedule must feed all 19 project years')
assert.ok(workspaceSource.includes("for(let year=1;year<=19;year++)values['y'+year]=year===5?5:25"), 'Default year-five tax assumption must match reference reference and remain editable')
assert.ok(workspaceSource.includes("waccTaxRate:financeValue('نرخ مالیات برای سپر مالیاتی WACC (%)',25)"), 'WACC tax shield must be separately configurable from operating tax')
assert.ok(workspaceSource.includes("annualFixedConversionCost:fixedConversionCost"), 'WIP fixed conversion must exclude fixed raw-material inventory cost')
assert.ok(workspaceSource.includes("annualPayablesCost:materialCost+energyCost+maintenanceCostTotal+otherOpexTotal"), 'Supplier credit must use eligible material, energy, maintenance and supplier purchases')
assert.ok(workspaceSource.includes("annualFixedPayablesCost:financeValue('هزینه ثابت سالانه مشمول بدهی تجاری (یورو)',0)"), 'Fixed supplier-credit purchases must be separately configurable')
assert.ok(workspaceSource.includes("'Other income':year.terminalValue"), 'reference Other income must include terminal working-capital recovery and salvage')
assert.ok(workspaceSource.includes('years:19,constructionYears,') && workspaceSource.includes("financeValue('تعداد سال دوره ساخت',4)") && workspaceSource.includes("financeValue('تعداد سال دوره بهره‌برداری',15)"), 'Project model horizon must default to four construction plus fifteen operating years and remain configurable')
assert.ok(workspaceSource.includes("referenceYear:isScalar?0:annual[8]??0,lastYear:isScalar?0:annual[18]??0"), 'reference reference year 9 and last year 19 must map to the correct periods')
assert.ok(workspaceSource.includes("const utilizationSchedule=Array.from({length:19},(_,i)=>i<constructionYears?0:Math.min(1,[.7,.8,.9,1][i-constructionYears]??1))"), 'The terminal year must be the final operating year, not an extra non-operating year')
assert.ok(workspaceSource.includes("'Increase in fixed assets':year.fixedInvestment"), 'reference cash flow must map annual fixed-asset investment')
assert.ok(workspaceSource.includes("'Marketing costs':0"), 'reference marketing cost line must remain explicit when no separate marketing input exists')
assert.ok(workspaceSource.includes("'Increase in net working capital':year.changeInWorkingCapital"), 'reference cash flow must use the annual net working-capital movement')
console.log('PASS: reference net working capital, no double-counting of supplier credit, capitalized interest and taxable profit mapping')

const assetSchedule = engine.calculateAssetDepreciationSchedule([
  { id:'plant', name:'Plant', cost:1000, residualValue:100, usefulLife:3, startYear:2, method:'straight-line' },
  { id:'land', name:'Land', cost:500, residualValue:500, usefulLife:30, startYear:2, method:'straight-line' }
], 5)
near(assetSchedule[0].depreciation, 0, 1e-9, 'Asset depreciation before in-service year')
near(assetSchedule[1].depreciation, 300, 1e-9, 'Asset-by-asset straight-line depreciation')
near(assetSchedule[4].depreciation, 0, 1e-9, 'Depreciation ends after useful life')
near(assetSchedule[3].closingBookValue, 600, 1e-9, 'Asset book value at residual value')







const startingAssetBase = {
  id:'opening-machine',name:'Existing machine',grossCost:1000,accumulatedDepreciation:400,
  remainingLife:6,opportunityValue:700,residualValue:100,commissioningDate:'1400-01-01',
  depreciationMethod:'linear-scrap',depreciationRatePercent:10,depreciationLengthYears:6,
  depreciationLengthMonths:0,firstDepreciationMonths:12,salvagePercent:10,
  depreciationStartDate:'1400-01-01',costCentre:'',foreignSharePercent:20,status:'active'
}
assert.equal(foundation.validateStartingFixedAssetBalances([startingAssetBase],foundation.createBlankProjectFoundation()).length,0,
  'A complete existing fixed asset opening balance must pass foundation validation')
const invalidStartingAsset = foundation.validateStartingFixedAssetBalances([{
  ...startingAssetBase,accumulatedDepreciation:1200,remainingLife:0,foreignSharePercent:120,
  commissioningDate:'1400-13-40',depreciationStartDate:'1399-01-01'
}],foundation.createBlankProjectFoundation())
assert.ok(invalidStartingAsset.some(issue=>issue.code==='invalid-starting-asset-accumulated-depreciation'),
  'Accumulated depreciation cannot exceed gross cost')
assert.ok(invalidStartingAsset.some(issue=>issue.code==='missing-starting-asset-remaining-life'),
  'Active depreciable assets require remaining useful life')
assert.ok(invalidStartingAsset.some(issue=>issue.code==='invalid-starting-asset-foreign-share'),
  'Foreign currency component percentage must remain within 0-100')
assert.ok(invalidStartingAsset.some(issue=>issue.code==='invalid-starting-asset-date'),
  'Starting asset dates must use valid ISO date structure')
assert.ok(invalidStartingAsset.some(issue=>issue.code==='depreciation-before-commissioning'),
  'Depreciation cannot begin before commissioning')

const hrcrVersionOneSeed=reference.createHotRollingCoilFixedInvestmentItems()
  .filter(item=>item.assetClass!=='preproduction')
  .map(item=>({...item,depreciationBasis:undefined,acquisitions:item.acquisitions.map(row=>({...row,allocationBasis:undefined}))}))
const hrcrMigratedSeed=reference.migrateHotRollingCoilFixedInvestmentItems(hrcrVersionOneSeed,1)
assert.ok(hrcrMigratedSeed.some(item=>item.assetClass==='preproduction'),'HRCR seed v2 migration must add separately classified preproduction expenditures')
assert.equal(hrcrMigratedSeed.find(item=>item.id==='hrcr-machinery-local').depreciationBasis,'source-conflict',
  'HRCR seed migration must disclose source-conflicting depreciation conditions')
assert.equal(hrcrMigratedSeed.find(item=>item.id==='hrcr-site').acquisitions[0].allocationBasis,'source-period',
  'HRCR seed migration must restore documented acquisition-period evidence')
const editedHrcrItems=hrcrVersionOneSeed.map(item=>item.id==='hrcr-machinery-local'?{
  ...item,depreciation:{...item.depreciation,ratePercent:8},
  acquisitions:item.acquisitions.map((row,index)=>index===0?{...row,quantity:3}:row)
}:item)
const editedHrcrMigration=reference.migrateHotRollingCoilFixedInvestmentItems(editedHrcrItems,1)
assert.equal(editedHrcrMigration.find(item=>item.id==='hrcr-machinery-local').depreciation.ratePercent,8,
  'HRCR seed migration must preserve user-edited depreciation rates')
assert.equal(editedHrcrMigration.find(item=>item.id==='hrcr-machinery-local').acquisitions[0].quantity,3,
  'HRCR seed migration must preserve user-edited acquisition quantities')

const hrcrDepreciationAssets=reference.createHotRollingCoilFixedInvestmentItems()
const hrcrAssetBridge=engine.reconcileFixedInvestmentRegister(
  hrcrDepreciationAssets,
  workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.constructionInvestment,
  workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.preproductionNet
)
near(hrcrAssetBridge.registerTotal,workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.fixedInvestment,0.01,
  'HRCR fixed asset register must reconcile to CAPEX fixed investment')
near(hrcrAssetBridge.preproductionTotal,workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.preproductionNet,0.01,
  'HRCR preproduction register must reconcile separately')
assert.equal(hrcrAssetBridge.status,'matched','HRCR fixed assets and preproduction expenditures must reconcile as separate categories')
const hrcrAssetValidation=foundation.validateFixedInvestmentItems(hrcrDepreciationAssets,reference.createHotRollingCoilProjectFoundation())
assert.equal(hrcrAssetValidation.filter(issue=>issue.severity==='error').length,0,'HRCR seed fractional depreciation lives must pass fixed asset validation')
const hrcrMonthlyAssetBuild=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  hrcrDepreciationAssets,1403,17,'monthly',reference.createHotRollingCoilProjectFoundation()
)
assert.ok(hrcrMonthlyAssetBuild.assets.length>=18,
  'The fixed investment register must preserve asset acquisition vintages for monthly calendar depreciation')
assert.ok(!hrcrMonthlyAssetBuild.warnings.some(warning=>warning.includes('only computes an annual schedule')),
  'Monthly projects must no longer be blocked by the annual-only asset register guard')
const hrcrAssetBuild=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems(
  hrcrDepreciationAssets,1403,17,'annual',reference.createHotRollingCoilProjectFoundation()
)
assert.ok(hrcrAssetBuild.assets.length>=18,'HRCR reference must create asset acquisition vintages from the CAPEX workbook')

const monthlyCalendar=foundation.buildProjectCalendarPeriods('2025-01-01','2025-12-31','monthly',1)
const invalidMonthlyCalendar=monthlyCalendar.map((period,index)=>index===1?{...period,days:period.days+1}:period)
assert.equal(engine.calculateComfarCalendarDepreciationSchedule([],invalidMonthlyCalendar,1).valid,false,
  'Calendar periods with inconsistent day counts must be rejected')
const monthlyAsset={id:'monthly-asset',name:'Monthly asset',originalValue:1200,initialBookValue:1200,
  scrapPercent:10,lengthYears:2,lengthMonths:0,ratePercent:50,method:'linear-to-scrap',
  acquisitionPeriod:1,startingAtPeriod:1,acquisitionDate:'2025-02-15',startingAtDate:'2025-03-01'}
const monthlyRun=engine.calculateComfarCalendarDepreciationSchedule([monthlyAsset],monthlyCalendar,1)
assert.equal(monthlyRun.valid,true,'Date-driven monthly straight-line schedule must validate')
near(monthlyRun.periods[0].depreciation,0,1e-9,'Monthly depreciation must not begin before acquisition')
near(monthlyRun.periods[1].depreciation,0,1e-9,'Monthly depreciation must respect the explicit March start date')
near(monthlyRun.periods[2].depreciation,540*31/365.2425,0.01,'Monthly depreciation must use the actual days in the first eligible month')
near(monthlyRun.periods.reduce((sum,row)=>sum+row.depreciation,0),540*306/365.2425,0.02,
  'Monthly depreciation must use actual eligible days through year end')
near(monthlyRun.periods[11].assets[0].closingBookValue,1200-monthlyRun.periods.reduce((sum,row)=>sum+row.depreciation,0),0.02,
  'Monthly closing book value must reconcile to opening cost less accumulated depreciation')

const annualOnlyAcquisition=engine.calculateComfarCalendarDepreciationSchedule([{
  ...monthlyAsset,acquisitionDate:undefined,startingAtDate:undefined
}],monthlyCalendar,1)
assert.equal(annualOnlyAcquisition.valid,false,
  'Annual-only acquisition timing must not be silently treated as an exact monthly acquisition date')
assert.ok(annualOnlyAcquisition.warnings.some(warning=>warning.includes('تاریخ دقیق')),
  'Missing subannual acquisition dates must be disclosed as a blocking reconciliation warning')

const quarterlyCalendar=foundation.buildProjectCalendarPeriods('2025-01-01','2025-12-31','quarterly',1)
const quarterlyAsset={id:'quarterly-asset',name:'Quarterly asset',originalValue:1000,initialBookValue:1000,
  scrapPercent:10,lengthYears:2,lengthMonths:0,ratePercent:50,method:'linear-to-scrap',
  acquisitionPeriod:1,startingAtPeriod:1,acquisitionDate:'2025-01-15',startingAtDate:'2025-02-01'}
const invalidCalendarSale=engine.calculateComfarCalendarAssetLifecycle([quarterlyAsset],[{
  id:'invalid-calendar-sale',assetId:'quarterly-asset',period:3,priceMode:'self-defined',
  selfDefinedPrice:500,saleDate:'2025-07-15'
}],quarterlyCalendar,1)
assert.equal(invalidCalendarSale.valid,false,
  'Self-defined calendar disposal must require a positive exchange rate')
const quarterlyRun=engine.calculateComfarCalendarDepreciationSchedule([quarterlyAsset],quarterlyCalendar,1)
assert.equal(quarterlyRun.valid,true,'Date-driven quarterly schedule must validate')
near(quarterlyRun.periods[0].depreciation,450*59/365.2425,0.02,
  'Quarterly depreciation must begin on the actual February start date')
near(quarterlyRun.periods[1].depreciation,450*91/365.2425,0.02,
  'Quarterly depreciation must use the actual length of the second quarter')

const quarterlySale=engine.calculateComfarCalendarAssetLifecycle([quarterlyAsset],[{
  id:'quarterly-sale',assetId:'quarterly-asset',period:3,priceMode:'self-defined',
  selfDefinedPrice:500,exchangeRateToLocal:1,saleDate:'2025-07-15'
}],quarterlyCalendar,1)
assert.equal(quarterlySale.valid,true,'A dated asset sale must be accepted on the quarterly calendar')
const expectedQuarterlySaleBook=1000-450*(59+91+15)/365.2425
near(quarterlySale.sales[0].bookValueAtSale,expectedQuarterlySaleBook,0.03,
  'Asset book value at sale must include depreciation only through the actual disposal date')
near(quarterlySale.depreciation.periods[2].depreciation,450*15/365.2425,0.02,
  'Quarterly sale-period depreciation must stop on the actual sale date')
near(quarterlySale.sales[0].returnOfCapital,500,0.01,
  'Sale proceeds below book value must be treated as return of capital up to proceeds')
near(quarterlySale.sales[0].otherIncomeLoss,500-expectedQuarterlySaleBook,0.03,
  'Sale loss must reconcile proceeds to book value')
near(quarterlySale.depreciation.periods[2].closingBookValue,0,1e-9,
  'Disposed asset must be derecognised in the sale period')
near(quarterlySale.depreciation.periods[3].assets[0].closingBookValue,0,1e-9,
  'Disposed asset must not carry a book value into later periods')

const zeroMethodAsset={id:'linear-zero-salvage-check',name:'Linear to zero asset',originalValue:1000,initialBookValue:1000,
  scrapPercent:10,lengthYears:2,lengthMonths:0,ratePercent:50,method:'linear-to-zero',
  acquisitionPeriod:1,startingAtPeriod:1,acquisitionDate:'2024-12-31',startingAtDate:'2025-01-01'}
const annualZeroMethod=engine.calculateComfarAssetDepreciationSchedule([zeroMethodAsset],3)
near(annualZeroMethod.periods[0].depreciation,500,1e-9,'Linear-to-zero first year must use the original book value as its depreciation base')
near(annualZeroMethod.periods[1].depreciation,400,1e-9,'Linear-to-zero final year must stop at the defined scrap value')
near(annualZeroMethod.periods[1].closingBookValue,100,1e-9,'Linear-to-zero must preserve the configured scrap value')
const threeYearMonthlyCalendar=foundation.buildProjectCalendarPeriods('2025-01-01','2027-12-31','monthly',1)
const calendarZeroMethod=engine.calculateComfarCalendarDepreciationSchedule([zeroMethodAsset],threeYearMonthlyCalendar,1)
assert.equal(calendarZeroMethod.valid,true,'Calendar linear-to-zero depreciation must accept a valid dated asset')
near(calendarZeroMethod.periods.reduce((sum,row)=>sum+row.depreciation,0),900,1e-6,
  'Calendar linear-to-zero must stop at the configured 10 percent scrap value')
near(calendarZeroMethod.periods[calendarZeroMethod.periods.length-1].assets[0].closingBookValue,100,1e-6,
  'Calendar linear-to-zero must retain the configured scrap value after useful life')
const zeroScrapAsset={...zeroMethodAsset,id:'linear-zero-no-scrap',name:'Linear to zero no scrap',scrapPercent:0}
const calendarNoScrap=engine.calculateComfarCalendarDepreciationSchedule([zeroScrapAsset],threeYearMonthlyCalendar,1)
near(calendarNoScrap.periods.reduce((sum,row)=>sum+row.depreciation,0),1000,1e-6,
  'Calendar zero-scrap asset must depreciate to zero exactly once')
near(calendarNoScrap.periods[calendarNoScrap.periods.length-1].assets[0].closingBookValue,0,1e-6,
  'Calendar asset at zero book value must not restart depreciation in later periods')

for (const method of ['none','linear-to-zero','linear-to-scrap','accelerated','sum-of-years-digits']) {
  const methodAsset={...monthlyAsset,id:'method-'+method,name:'Method '+method,method,
    lengthYears:method==='sum-of-years-digits'?3:2,lengthMonths:0,
    ratePercent:method==='none'?undefined:method==='sum-of-years-digits'?undefined:50}
  const methodRun=engine.calculateComfarCalendarDepreciationSchedule([methodAsset],monthlyCalendar,1)
  assert.equal(methodRun.valid,true,'Directory depreciation method '+method+' must have an independently executable calendar path')
  assert.ok(methodRun.periods.every(row=>Number.isFinite(row.depreciation)&&row.depreciation>=0),
    'Directory depreciation method '+method+' must produce finite non-negative period charges')
  assert.equal(methodRun.methodControls.find(control=>control.method===method).calculationImplemented,true,
    'Directory method '+method+' must expose its executable formula control')
  assert.equal(methodRun.methodControls.find(control=>control.method===method).numericalBenchmark,'pending',
    'Directory method '+method+' must remain explicitly unverified until reconciled to an independent reference output')
}
const hrcrDepreciationRun=engine.calculateComfarAssetDepreciationSchedule(hrcrAssetBuild.assets,17)
assert.equal(hrcrDepreciationRun.valid,true,'Fractional useful lives from HRCR depreciation rates must be accepted by the XI.H engine')
near(hrcrDepreciationRun.periods[2].depreciation,reference.HOT_ROLLING_FIXED_ASSET_REFERENCE.seededRegisterFirstYearDepreciation,0.01,
  'HRCR seeded register first-year depreciation must match its independently calculated benchmark')
near(hrcrDepreciationRun.periods[2].depreciation-workbookAudit.HOT_ROLLING_200KT_AUDIT.depreciationReconciliation.comfarFirstYear,150171.6296744,0.01,
  'HRCR preliminary register must disclose rather than conceal its first-year variance from COMFAR output')
near(hrcrAssetBuild.investmentSchedule.reduce((sum,value)=>sum+value,0),
  workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.fixedInvestment,0.01,
  'HRCR asset acquisition schedule must exclude preproduction costs and reconcile to fixed investment')
near(hrcrAssetBuild.preOperatingSchedule.reduce((sum,value)=>sum+value,0),workbookAudit.HOT_ROLLING_200KT_AUDIT.capex.preproductionNet,0.01,'HRCR preproduction timing schedule must retain the separately reconciled amount')
assert.equal(hrcrAssetBuild.preOperatingScheduleVerified,false,'HRCR preproduction acquisition dates remain estimated')
assert.equal(hrcrAssetBuild.investmentScheduleVerified,false,
  'HRCR construction timing estimates must not be treated as verified investment cash flows')
assert.ok(hrcrAssetBuild.warnings.some(warning=>warning.includes('proportional estimate')),
  'HRCR acquisition timing assumptions must be disclosed')
assert.ok(hrcrAssetBuild.warnings.some(warning=>warning.includes('source documents conflict')),
  'HRCR depreciation condition conflicts must be disclosed')
const hrcrSite=hrcrDepreciationAssets.find(item=>item.id==='hrcr-site')
near(hrcrSite.acquisitions[0].unitPrice,126360.2406094665,0.01,
  'HRCR site preparation first construction-period acquisition must match the CAPEX source-year rows')
const hrcrMachinery=hrcrDepreciationAssets.find(item=>item.id==='hrcr-machinery-local')
near(hrcrMachinery.depreciation.ratePercent,10.97955,1e-6,
  'HRCR machinery depreciation rate must use the detailed OPEX depreciation table')
const hrcrInfrastructure=hrcrDepreciationAssets.find(item=>item.id==='hrcr-infrastructure-depreciable')
near(hrcrInfrastructure.depreciation.ratePercent,12,1e-9,
  'HRCR infrastructure depreciation rate must use the detailed OPEX depreciation table')


const linearScrapFractionalLife=engine.calculateComfarAssetDepreciationSchedule([{
  id:'linear-scrap-fractional-life',name:'Linear to scrap fractional life',originalValue:1000,initialBookValue:1000,
  scrapPercent:10,lengthYears:10,lengthMonths:10,ratePercent:100/(10+10/12),
  method:'linear-to-scrap',acquisitionPeriod:1,startingAtPeriod:1,acquisitionDate:'1405-01-01',startingAtDate:'1405-06-01',firstDepreciationMonths:3
}],14)
assert.equal(linearScrapFractionalLife.valid,true,'Linear to scrap fractional useful life must validate')
near(linearScrapFractionalLife.periods[0].depreciation,900/(10+10/12)*3/12,1e-9,
  'Linear to scrap first partial year must follow COMFAR XI.H')
near(linearScrapFractionalLife.periods[10].depreciation,900/(10+10/12),1e-9,
  'COMFAR XI.H must count the correct number of full years after a partial first year')
near(linearScrapFractionalLife.periods[11].closingBookValue,100,1e-9,
  'Linear to scrap final period must terminate at salvage value after the correct partial-year count')

const comfarLinearZero = engine.calculateComfarAssetDepreciationSchedule([{
  id:'linear-zero',name:'Linear zero',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,lengthMonths:0,ratePercent:20,method:'linear-to-zero',
  acquisitionPeriod:1,startingAtPeriod:2,firstDepreciationMonths:6
}],7)
assert.equal(comfarLinearZero.valid,true,'COMFAR Linear to zero partial first-year schedule must validate')
near(comfarLinearZero.periods[0].depreciation,0,1e-9,'Depreciation must not start before Starting at')
near(comfarLinearZero.periods[1].depreciation,100,1e-9,'Linear to zero first partial-year depreciation')
near(comfarLinearZero.periods[5].closingBookValue,100,1e-9,'Linear to zero must stop at salvage value')
near(comfarLinearZero.periods[6].depreciation,0,1e-9,'Linear to zero must not depreciate after reaching salvage')
near(comfarLinearZero.periods[6].closingBookValue,100,1e-9,'Linear to zero must preserve salvage after the useful life')
const comfarLinearScrap = engine.calculateComfarAssetDepreciationSchedule([{
  id:'linear-scrap',name:'Linear scrap',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,ratePercent:20,method:'linear-to-scrap',
  acquisitionPeriod:2,startingAtPeriod:1,firstDepreciationMonths:12
}],7)
near(comfarLinearScrap.periods[0].closingBookValue,0,1e-9,'Assets must not appear on the balance sheet before acquisition period')
near(comfarLinearScrap.periods[2].depreciation,180,1e-9,'Linear to scrap annual depreciation')
near(comfarLinearScrap.periods[6].closingBookValue,100,1e-9,'Linear to scrap must finish at salvage')
const comfarAccelerated = engine.calculateComfarAssetDepreciationSchedule([{
  id:'accelerated',name:'Accelerated',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,ratePercent:30,method:'accelerated',
  acquisitionPeriod:1,startingAtPeriod:1,firstDepreciationMonths:12
}],7)
assert.equal(comfarAccelerated.periods[1].assets[0].methodApplied,'accelerated','Accelerated method must use declining balance while it exceeds linear-to-scrap')
assert.equal(comfarAccelerated.periods[3].assets[0].methodApplied,'linear-to-scrap','Accelerated method must switch automatically when linear-to-scrap is greater')
near(comfarAccelerated.periods[6].closingBookValue,100,1e-8,'Accelerated depreciation must stop at salvage')
const comfarSumDigits = engine.calculateComfarAssetDepreciationSchedule([{
  id:'sum-digits',name:'Sum digits',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,method:'sum-of-years-digits',
  acquisitionPeriod:0,startingAtPeriod:1,firstDepreciationMonths:12
}],5)
near(comfarSumDigits.periods[0].depreciation,300,1e-9,'Sum of years digits first-year depreciation')
near(comfarSumDigits.periods[4].depreciation,60,1e-9,'Sum of years digits final-year depreciation')
assert.equal(engine.resolveComfarDepreciationStartPeriod(1,3),3,'Assets acquired before Starting at must commence at Starting at')
assert.equal(engine.resolveComfarDepreciationStartPeriod(0,1),1,'Opening assets acquired before the model horizon must commence at Starting at')
assert.equal(engine.resolveComfarDepreciationStartPeriod(3,3),4,'Assets acquired after Starting at must commence in the following period')
const unsupportedSumPartial = engine.calculateComfarAssetDepreciationSchedule([{
  id:'sum-partial',name:'Sum digits partial',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,method:'sum-of-years-digits',
  acquisitionPeriod:1,startingAtPeriod:1,firstDepreciationMonths:6
}],5)
assert.equal(unsupportedSumPartial.valid,false,'Sum of years digits partial-year schedule must fail closed until its month-overlap formula is independently benchmarked')


const lifecycle = engine.calculateComfarAssetLifecycle([{
  id:'sold-machine',name:'Sold machine',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,ratePercent:20,method:'linear-to-scrap',
  acquisitionPeriod:0,startingAtPeriod:1,firstDepreciationMonths:12
}],[
  {id:'sale-above-book',assetId:'sold-machine',period:2,priceMode:'self-defined',selfDefinedPrice:900,exchangeRateToLocal:1}
],5)
assert.equal(lifecycle.valid,true,'A valid asset disposal must produce a complete lifecycle')
near(lifecycle.depreciation.periods[1].assets[0].closingBookValue,0,1e-9,'Asset book value must be removed at the sale balance date')
near(lifecycle.depreciation.periods[2].assets[0].depreciation,0,1e-9,'Depreciation must stop after the sale period')
near(lifecycle.sales[0].bookValueAtSale,640,1e-9,'Sale book value must include depreciation through the sale period')
near(lifecycle.sales[0].returnOfCapital,640,1e-9,'Book value at disposal is return of capital')
near(lifecycle.sales[0].otherIncomeLoss,260,1e-9,'Sale proceeds above book value are Other income')
near(lifecycle.sales[0].saleProceeds,lifecycle.sales[0].returnOfCapital+lifecycle.sales[0].otherIncomeLoss,1e-9,'Disposal cash proceeds must reconcile to return of capital plus Other income/loss')
const lifecycleLoss = engine.calculateComfarAssetLifecycle([{
  id:'loss-machine',name:'Loss machine',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,ratePercent:20,method:'linear-to-scrap',
  acquisitionPeriod:0,startingAtPeriod:1,firstDepreciationMonths:12
}],[
  {id:'sale-below-book',assetId:'loss-machine',period:2,priceMode:'self-defined',selfDefinedPrice:500,exchangeRateToLocal:1}
],5)
near(lifecycleLoss.sales[0].otherIncomeLoss,-140,1e-9,'Sale proceeds below book value are Other loss')
near(lifecycleLoss.sales[0].returnOfCapital,500,1e-9,'Only proceeds actually recovered up to book value count as return of capital')
near(lifecycle.depreciation.periods[2].assets[0].openingBookValue,0,1e-9,'Disposed asset must not reappear as an opening fixed asset in later periods')
const landLifecycle = engine.calculateComfarAssetLifecycle([{
  id:'land-no-dep',name:'Land',originalValue:1000,initialBookValue:1000,scrapPercent:100,
  lengthYears:0,method:'none',acquisitionPeriod:1,startingAtPeriod:1,firstDepreciationMonths:12
}],[{id:'land-sale',assetId:'land-no-dep',period:2,priceMode:'book-value'}],4)
assert.equal(landLifecycle.valid,true,'Non-depreciated land must still be available for disposal')
near(landLifecycle.depreciation.periods[0].assets[0].depreciation,0,1e-9,'Land must not be depreciated')
near(landLifecycle.sales[0].saleProceeds,1000,1e-9,'Book-value sale of land must return its book value')
const lifecycleForeign = engine.calculateComfarAssetLifecycle([{
  id:'foreign-machine',name:'Foreign machine',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,ratePercent:20,method:'linear-to-scrap',
  acquisitionPeriod:0,startingAtPeriod:1,firstDepreciationMonths:12
}],[
  {id:'foreign-sale',assetId:'foreign-machine',period:2,priceMode:'self-defined',selfDefinedPrice:2,exchangeRateToLocal:300}
],5)
near(lifecycleForeign.sales[0].saleProceeds,600,1e-9,'Foreign sale proceeds must convert to local currency at the sale-period rate')
assert.equal(engine.calculateComfarAssetLifecycle([],[
  {id:'orphan-sale',assetId:'missing',period:1,priceMode:'book-value'}
],2).valid,false,'Asset disposal must reject a sale without a linked acquisition vintage')


const saleIntegrated = engine.calculateIntegratedFinance({
  years:3,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:100,depreciationSchedule:[0,180,100],
  fixedInvestment:1000,preOperatingCost:0,fixedInvestmentSchedule:[1000,0,0],preOperatingSchedule:[0,0,0],
  utilization:[0,1,1],equityContributions:[1000,0,0],loans:[],taxRate:25,costOfEquity:20,
  workingCapitalPercent:0,salesEscalationPercent:0,opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:15,
  assetSaleSchedule:[{saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0},{saleProceeds:900,returnOfCapital:640,otherIncomeLoss:260,bookValueDisposed:640},{saleProceeds:0,returnOfCapital:0,otherIncomeLoss:0,bookValueDisposed:0}]
})
near(saleIntegrated.years[1].assetSaleProceeds,900,1e-9,'Asset disposal proceeds must enter the matching model period')
near(saleIntegrated.years[1].assetSaleOtherIncomeLoss,260,1e-9,'Asset disposal gain/loss must be separately reported')
near(saleIntegrated.years[1].ebit,1080,1e-9,'Asset disposal gain/loss must affect taxable income')
near(saleIntegrated.years[1].projectFreeCashFlow,1630,1e-9,'Asset sale proceeds must enter project cash flow once, without double-counting the gain')
const saleStatements=engine.buildThreeFinancialStatements(saleIntegrated.years)
near(saleStatements[1].incomeStatement.otherIncomeLoss,260,1e-9,'Income statement must show disposal Other income/loss')
near(saleStatements[1].cashFlowStatement.investingCashFlow,900,1e-9,'Cash flow statement must classify disposal proceeds as investing cash flow')
near(saleStatements[1].balanceSheet.netFixedAssets,180,1e-9,'Balance sheet must remove disposed book value from fixed assets')
assert.ok(saleStatements[1].balanceSheet.reconciled,'Asset disposal must reconcile all three financial statements')

near(integrated.years[integrated.years.length-1].salvageGainLoss,30,1e-9,
  'Terminal salvage gain must be sale proceeds less disposed book value')
near(integrated.years[integrated.years.length-1].ebit,
  integrated.years[integrated.years.length-1].revenue-integrated.years[integrated.years.length-1].variableCashCost-
    integrated.years[integrated.years.length-1].fixedCashCost-integrated.years[integrated.years.length-1].depreciation+30+
    integrated.years[integrated.years.length-1].assetSaleOtherIncomeLoss,1e-9,
  'Terminal salvage gain must enter taxable EBIT')
const statements = engine.buildThreeFinancialStatements(integrated.years)
assert.equal(statements.length, integrated.years.length, 'Three statements must cover the full model horizon')
assert.ok(statements.every(row => row.balanceSheet.reconciled), 'Balance sheet must reconcile without a plug for the integrated reference case')
for (const row of statements) {
  for (const [movement,value] of Object.entries(row.movementChecks)) {
    near(value,0,1e-6,'Three-statement roll-forward '+movement+' year '+row.year)
  }
  near(row.cashFlowStatement.closingCash-row.openingBalances.cash,row.cashFlowStatement.netChangeInCash,1e-6,
    'Opening-to-closing cash must reconcile to the three cash-flow sections')
  near(row.balanceSheet.cash,row.cashFlowStatement.closingCash,1e-9,
    'Cash flow statement and balance sheet cash tie')
  near(row.balanceSheet.totalAssets,row.balanceSheet.totalLiabilitiesAndEquity,1e-6,
    'Balance sheet reconciliation year '+row.year)
  near(row.balanceSheet.netFixedAssets-row.openingBalances.netFixedAssets,
    integrated.years[row.year-1].fixedInvestment+integrated.years[row.year-1].maintenanceCapex-
      integrated.years[row.year-1].depreciation-integrated.years[row.year-1].assetBookValueDisposed-
      integrated.years[row.year-1].salvageBookValueDisposed,1e-6,
    'Fixed asset movement must use book value disposed, not sale proceeds')
}
const sensitivity = engine.calculateSensitivityMatrix({
  years:6,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:100,fixedInvestment:1000,preOperatingCost:100,
  fixedInvestmentSchedule:[1000,0,0,0,0,0],preOperatingSchedule:[100,0,0,0,0,0],
  utilization:[0,1,1,1,1,1],equityContributions:[600,0,0,0,0,0],
  loans:[{id:'sensitivity-loan',label:'Loan',drawdowns:[400,0,0,0,0,0],annualRate:10,graceYears:0,termYears:2,repaymentStartYear:2,repaymentMethod:'equal-principal',capitalizeInterest:false}],
  taxRate:25,costOfEquity:20,workingCapitalPercent:10,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
assert.equal(sensitivity.length,5,'Sensitivity matrix must contain five volume cases')
assert.equal(sensitivity[0].length,5,'Sensitivity matrix must contain five price cases')
assert.ok(sensitivity[0][0].npv < sensitivity[4][4].npv,'Higher price and volume should improve project NPV')
const scenarioResults = engine.calculateFinancialScenarios({
  years:6,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:100,fixedInvestment:1000,preOperatingCost:100,
  fixedInvestmentSchedule:[1000,0,0,0,0,0],preOperatingSchedule:[100,0,0,0,0,0],
  utilization:[0,1,1,1,1,1],equityContributions:[600,0,0,0,0,0],
  loans:[],taxRate:25,costOfEquity:20,workingCapitalPercent:10,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
assert.ok(scenarioResults.optimistic.npvProject > scenarioResults.base.npvProject,'Optimistic scenario must exceed base NPV')
assert.ok(scenarioResults.pessimistic.npvProject < scenarioResults.base.npvProject,'Pessimistic scenario must be below base NPV')
assert.ok(sensitivity.flat().every(cell=>Number.isFinite(cell.npv)&&(cell.irr===null||Number.isFinite(cell.irr))),
  'Every multi-variable sensitivity cell must return a finite NPV and a finite or explicitly unavailable IRR')
for (const [scenarioName,scenario] of Object.entries(scenarioResults)) {
  const scenarioStatements=engine.buildThreeFinancialStatements(scenario.years)
  assert.equal(scenarioStatements.length,scenario.years.length,
    scenarioName+' scenario must produce all three statements for every model year')
  assert.ok(scenarioStatements.every(row=>row.balanceSheet.reconciled),
    scenarioName+' scenario must reconcile assets, liabilities and equity without a plug')
}

console.log('PASS: integrated WACC, staged loan amortization, working capital, terminal value, cash flow reconciliation, NPV and project/equity IRR')
const comfarSource=comfarOutput.HRCR200_COMFAR_OUTPUT_REFERENCE
assert.equal(comfarSource.projectCashFlows.length,18,'COMFAR HRCR200 project cash-flow source must cover 1403–1420')
for (const row of comfarSource.projectCashFlows) {
  near(row.inflows-row.outflows,row.net,0.02,'COMFAR raw project cash-flow identity '+row.year)
}
near(comfarSource.projectCashFlows.reduce((sum,row)=>sum+row.presentValue,0),
  comfarSource.summary.projectNpvAt25Percent,0.02,'COMFAR discounted project cash flows must sum to reported NPV')
near(comfarSource.financing.originalConstructionLoanPrincipal+comfarSource.financing.capitalizedConstructionInterest,
  comfarSource.financing.longTermDebtAfterConstruction,0.5,
  'COMFAR original loan principal plus capitalized construction interest must explain closing construction debt')
near(comfarSource.financing.annualSchedule.reduce((sum,row)=>sum+row.equityContribution,0),
  comfarSource.financing.totalEquityCapital,0.02,'COMFAR annual equity contributions must reconcile to paid-in capital')
near(comfarSource.financing.annualSchedule.reduce((sum,row)=>sum+row.debtAddition,0),
  comfarSource.financing.longTermDebtAfterConstruction,0.02,'COMFAR annual debt additions must reconcile to gross closing debt')
near(comfarSource.financing.annualSchedule.reduce((sum,row)=>sum+row.principalRepayment,0),
  comfarSource.financing.longTermDebtAfterConstruction,0.02,'COMFAR annual principal repayments must extinguish the gross debt')
for (const row of comfarSource.financing.annualSchedule) {
  const balanceSheetRow=comfarSource.balanceSheet.find(item=>item.year===row.year)
  assert.ok(balanceSheetRow,'COMFAR financing row must have a matching balance-sheet year '+row.year)
  near(row.closingDebt,balanceSheetRow.longTermDebt,0.02,'COMFAR financing schedule debt roll-forward '+row.year)
}
near(comfarSource.financing.annualSchedule.find(row=>row.year===1405).equityContribution,
  comfarSource.financing.operatingWorkingCapitalEquity,0.02,
  'COMFAR production-phase working capital contribution is equity, not a short-term loan')
assert.equal(comfarSource.financing.operatingWorkingCapitalLoan,0,
  'COMFAR output reports no separate working-capital loan')
assert.equal(comfarSource.incomeStatement.length,15,'COMFAR income statement must cover 1405–1419')
for (const row of comfarSource.incomeStatement) {
  near(row.revenue-row.variableCosts-row.fixedCosts-row.financingCosts,row.profitBeforeTax,0.02,
    'COMFAR income statement profit bridge '+row.year)
  near(row.profitBeforeTax-row.tax,row.netProfit,0.02,'COMFAR net profit bridge '+row.year)
  near(row.tax/row.profitBeforeTax,row.year<=1409?0.05:0.25,0.000001,
    'COMFAR effective tax rate shown in report '+row.year)
}
assert.equal(comfarSource.depreciationSchedule.length,15,'COMFAR asset depreciation schedule must cover 1405–1419')
for (const row of comfarSource.depreciationSchedule) {
  assert.ok(row.depreciation>=0,'COMFAR depreciation cannot be negative '+row.year)
}
assert.equal(comfarSource.balanceSheet.length,17,'COMFAR balance sheet must cover 1403–1419')
for (const row of comfarSource.balanceSheet) {
  near(row.currentAssets+row.netFixedAssets,row.totalAssets,0.02,'COMFAR asset composition '+row.year)
  near(row.currentLiabilities+row.longTermDebt+row.netWorth,row.totalAssets,0.02,
    'COMFAR balance sheet assets = liabilities + equity '+row.year)
  near(row.paidInCapital+row.retainedEarningsBeginning+row.currentYearProfit,row.netWorth,0.02,
    'COMFAR equity roll-forward '+row.year)
}
const comfarIncomeByYear=new Map(comfarSource.incomeStatement.map(row=>[row.year,row]))
const comfarBalanceByYear=new Map(comfarSource.balanceSheet.map(row=>[row.year,row]))
const comfarFundingByYear=new Map(comfarSource.financing.annualSchedule.map(row=>[row.year,row]))
const comfarConstructionByYear=new Map(comfarSource.constructionSchedule.map(row=>[row.year,row]))
const comfarWorkingCapitalByYear=new Map(comfarSource.workingCapitalSchedule.map(row=>[row.year,row]))
const comfarDepreciationByYear=new Map(comfarSource.depreciationSchedule.map(row=>[row.year,row.depreciation]))
const comfarProjectCashFlowByYear=new Map(comfarSource.projectCashFlows.map(row=>[row.year,row.net]))
const comfarStatementInputs=Array.from({length:17},(_,index)=>{
  const year=1403+index
  const income=comfarIncomeByYear.get(year)
  const balance=comfarBalanceByYear.get(year)
  const funding=comfarFundingByYear.get(year)
  const construction=comfarConstructionByYear.get(year)
  const workingCapital=comfarWorkingCapitalByYear.get(year)
  const depreciation=comfarDepreciationByYear.get(year)??0
  const fixedCashCost=income?income.fixedCosts-depreciation:0
  const wcAssets=workingCapital?.currentAssets??0
  const cashBalance=balance?balance.currentAssets-wcAssets:0
  const revenue=income?.revenue??0
  const variableCashCost=income?.variableCosts??0
  const interest=income?.financingCosts??0
  return {
    year,utilization:year<1405?0:year===1405?0.7:year===1406?0.8:year===1407?0.9:1,
    production:0,revenue,variableCashCost,fixedCashCost,depreciation,
    ebit:revenue-variableCashCost-fixedCashCost-depreciation,interest,
    taxableProfit:income?.profitBeforeTax??0,taxLossCarryForward:0,tax:income?.tax??0,
    principal:funding?.principalRepayment??0,
    debtDrawdown:construction?.cashLoanDrawdown??0,
    equityContribution:construction?.equityContribution??0,
    fixedInvestment:construction?.fixedInvestment??0,
    preOperatingCost:construction?.preOperatingCost??0,
    maintenanceCapex:0,capitalizedInterest:construction?.capitalizedInterest??0,
    workingCapital:wcAssets,closingWorkingCapital:wcAssets,
    workingCapitalBreakdown:{
      rawMaterials:workingCapital?.inventory??0,energy:0,spareParts:0,
      workInProgress:0,finishedGoods:0,receivables:0,
      minimumCash:workingCapital?.minimumCash??0,payables:0
    },
    salvageProceeds:0,assetSaleProceeds:0,assetReturnOfCapital:0,
    assetSaleOtherIncomeLoss:0,assetBookValueDisposed:0,terminalValue:0,
    changeInWorkingCapital:workingCapital?.changeInWorkingCapital??0,
    projectFreeCashFlow:comfarProjectCashFlowByYear.get(year)??0,
    equityFreeCashFlow:0,cashBalance,debtBalance:balance?.longTermDebt??0,
    debtService:interest+(funding?.principalRepayment??0),cfads:0,dscr:null
  }
})
const reconstructedComfarStatements=engine.buildThreeFinancialStatements(comfarStatementInputs,0.02)
assert.equal(reconstructedComfarStatements.length,17,'COMFAR reconstruction must cover construction and all operating balance-sheet years')
let previousComfarCash=0
for(const statement of reconstructedComfarStatements){
  const year=statement.year
  const sourceBalance=comfarBalanceByYear.get(year)
  const sourceIncome=comfarIncomeByYear.get(year)
  assert.ok(statement.balanceSheet.reconciled,'Reconstructed COMFAR three statements must reconcile without a plug in '+year)
  if(sourceIncome){
    near(statement.incomeStatement.revenue,sourceIncome.revenue,0.05,'Reconstructed COMFAR revenue '+year)
    near(statement.incomeStatement.cashOperatingCosts+statement.incomeStatement.depreciation,
      sourceIncome.variableCosts+sourceIncome.fixedCosts,0.05,'Reconstructed COMFAR operating cost and depreciation bridge '+year)
    near(statement.incomeStatement.interest,sourceIncome.financingCosts,0.05,'Reconstructed COMFAR financing cost '+year)
    near(statement.incomeStatement.profitBeforeTax,sourceIncome.profitBeforeTax,0.05,'Reconstructed COMFAR profit before tax '+year)
    near(statement.incomeStatement.tax,sourceIncome.tax,0.05,'Reconstructed COMFAR tax '+year)
    near(statement.incomeStatement.netIncome,sourceIncome.netProfit,0.05,'Reconstructed COMFAR net profit '+year)
  }
  near(statement.balanceSheet.cash+statement.balanceSheet.workingCapitalAssets,
    sourceBalance.currentAssets,0.05,'Reconstructed COMFAR current assets '+year)
  near(statement.balanceSheet.netFixedAssets+statement.balanceSheet.deferredPreOperatingAssets,
    sourceBalance.netFixedAssets,0.10,'Reconstructed COMFAR fixed and pre-operating assets '+year)
  near(statement.balanceSheet.debt,sourceBalance.longTermDebt,0.05,'Reconstructed COMFAR debt '+year)
  near(statement.balanceSheet.totalEquity,sourceBalance.netWorth,0.05,'Reconstructed COMFAR equity '+year)
  near(statement.balanceSheet.totalAssets,sourceBalance.totalAssets,0.05,'Reconstructed COMFAR total assets '+year)
  near(statement.balanceSheet.totalLiabilitiesAndEquity,sourceBalance.totalAssets,0.05,
    'Reconstructed COMFAR total liabilities and equity '+year)
  near(statement.cashFlowStatement.closingCash,statement.balanceSheet.cash,0.05,
    'Reconstructed cash-flow closing cash '+year)
  near(statement.cashFlowStatement.netChangeInCash,statement.balanceSheet.cash-previousComfarCash,0.05,
    'Reconstructed cash-flow movement to balance-sheet cash '+year)
  previousComfarCash=statement.balanceSheet.cash
}
near(comfarSource.terminalRecovery.remainingNetFixedAssets+comfarSource.terminalRecovery.workingCapitalRecovery,
  comfarSource.terminalRecovery.totalTerminalInflows,0.05,
  'COMFAR terminal value must equal remaining net fixed assets plus recovered working capital')
near(comfarSource.projectCashFlows.find(row=>row.year===1420).net,
  comfarSource.terminalRecovery.totalTerminalInflows,0.05,
  'COMFAR terminal project cash flow must include asset salvage and working-capital recovery')
console.log('PASS: asset-level depreciation, tax loss carry-forward, multi-variable sensitivity, scenarios and three-statement balance-sheet reconciliation')
const taxLossModel = engine.calculateIntegratedFinance({
  years:4,constructionYears:1,capacity:100,fullCapacityRevenue:2000,fullCapacityVariableCashCost:600,
  fullCapacityFixedCashCost:400,annualDepreciation:0,depreciationSchedule:[0,1500,0,0],
  fixedInvestment:1000,preOperatingCost:0,fixedInvestmentSchedule:[1000,0,0,0],
  preOperatingSchedule:[0,0,0,0],utilization:[0,1,1,1],equityContributions:[1000,0,0,0],
  loans:[],taxRate:25,costOfEquity:20,workingCapitalPercent:0,salesEscalationPercent:0,
  opexEscalationPercent:0,discountMode:'manual',manualDiscountRate:15
})
near(taxLossModel.years[1].taxLossCarryForward,500,1e-9,'Tax loss carried forward after first operating year')
near(taxLossModel.years[2].taxLossCarryForward,0,1e-9,'Tax loss fully utilized in the following year')
near(taxLossModel.years[2].tax,125,1e-9,'Tax calculated only after loss carry-forward utilization')
const capitalizedLoanModel = engine.calculateIntegratedFinance({
  years:4,constructionYears:2,capacity:100,fullCapacityRevenue:1000,fullCapacityVariableCashCost:200,
  fullCapacityFixedCashCost:100,annualDepreciation:0,fixedInvestment:1000,preOperatingCost:0,
  fixedInvestmentSchedule:[500,500,0,0],preOperatingSchedule:[0,0,0,0],utilization:[0,0,1,1],
  equityContributions:[0,0,0,0],loans:[{id:'capitalized',label:'Capitalized interest loan',drawdowns:[100,0,0,0],
    annualRate:10,graceYears:0,termYears:2,repaymentStartYear:3,repaymentMethod:'equal-principal',capitalizeInterest:true}],
  taxRate:20,costOfEquity:20,workingCapitalPercent:0,salesEscalationPercent:0,opexEscalationPercent:0,
  discountMode:'manual',manualDiscountRate:15
})
near(capitalizedLoanModel.loanSchedules.capitalized[0].capitalizedInterest,5,1e-9,'Half-year interest capitalized in drawdown year')
near(capitalizedLoanModel.loanSchedules.capitalized[1].capitalizedInterest,10.5,1e-9,'Interest capitalized on opening balance in grace year')
near(capitalizedLoanModel.loanSchedules.capitalized[2].principal,57.75,1e-9,'Equal principal repayment includes capitalized interest')
assert.ok(engine.buildThreeFinancialStatements(capitalizedLoanModel.years).every(r=>r.balanceSheet.reconciled),'Capitalized interest must be recognized as an asset and balance sheet liability')


const withoutEnterprise = [
  { revenue:0, cashOperatingCosts:0, tax:0, capex:0, changeInWorkingCapital:0 },
  { revenue:500, cashOperatingCosts:400, tax:0, capex:0, changeInWorkingCapital:0 }
]
const withEnterprise = [
  { revenue:0, cashOperatingCosts:0, tax:0, capex:1000, changeInWorkingCapital:0 },
  { revenue:2000, cashOperatingCosts:500, tax:0, capex:0, changeInWorkingCapital:100 }
]
const incremental = engine.calculateIncrementalEnterpriseAnalysis(withoutEnterprise, withEnterprise, 0.1)
near(incremental.periods[0].incrementalCashFlow, -1000, 1e-9, 'Expansion incremental construction outflow')
near(incremental.periods[1].incrementalCashFlow, 1300, 1e-9, 'Expansion incremental operating cash flow after incremental working capital')
near(incremental.incrementalNpv, 181.81818181818176, 1e-8, 'Expansion incremental NPV')
near(incremental.incrementalIrr, 0.3, 1e-8, 'Expansion incremental IRR')
assert.equal(incremental.periods.length, 2, 'Incremental analysis must preserve aligned period count')
const invalidIncremental = engine.calculateIncrementalEnterpriseAnalysis(
  [{ revenue: Number.NaN, cashOperatingCosts: 0, tax: 0, capex: 0, changeInWorkingCapital: 0 }],
  [{ revenue: 100, cashOperatingCosts: 0, tax: 0, capex: 0, changeInWorkingCapital: 0 }],
  0.1
)
assert.equal(invalidIncremental.periods.length, 0, 'Incremental analysis must reject non-finite source data rather than coerce it')
const mismatchedIncremental = engine.calculateIncrementalEnterpriseAnalysis(
  withoutEnterprise, withEnterprise.slice(0, 1), 0.1
)
assert.equal(mismatchedIncremental.periods.length, 0, 'Incremental analysis must reject non-aligned planning horizons')
const expansionPanelSource = await readFile(new URL('../src/features/projects/ExpansionRehabilitationPanel.tsx', import.meta.url), 'utf8')
const expansionWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
assert.ok(expansionWizardSource.includes("analysisMode: 'unspecified'|'new'|'expansion'|'rehabilitation'|'combined'")
  && expansionWizardSource.includes("['expansion','rehabilitation','combined'].includes(m.analysisMode)&&Number.isFinite(m.project.constructionYears)&&Number.isFinite(m.project.operatingYears)&&<ExpansionRehabilitationPanel"),
  'Project wizard must activate the existing-enterprise module only for explicit expansion/rehabilitation classifications with a defined planning horizon')
assert.ok(expansionPanelSource.includes('Starting Balances')
  && expansionPanelSource.includes('Incremental Analysis')
  && expansionPanelSource.includes('Work in progress')
  && expansionPanelSource.includes('Finished Product Inventory'),
  'Expansion/rehabilitation English UI must use COMFAR Reference Manual terminology')
assert.ok(expansionPanelSource.includes('Starting Balances — Equity Capital and Partners')
  && expansionPanelSource.includes('Ordinary Capital')
  && expansionPanelSource.includes('Preference Capital')
  && expansionPanelSource.includes('Paid-in Capital')
  && expansionPanelSource.includes('Preferred Dividends (%)')
  && expansionPanelSource.includes('Export of Profit (%)')
  && expansionPanelSource.includes('equityCapital:saved.equityCapital??'),
  'Expansion/Rehabilitation must capture COMFAR partner-level ordinary/preference equity and profit distribution settings')
assert.ok(expansionPanelSource.includes('Work in Progress — by Product')
  && expansionPanelSource.includes('Finished Product Inventory — by Product')
  && expansionPanelSource.includes('localValue')
  && expansionPanelSource.includes('foreignValue')
  && expansionPanelSource.includes('foreignSharePercent')
  && expansionPanelSource.includes("saved.workInProgress??")
  && expansionPanelSource.includes("saved.finishedProducts??"),
  'Expansion/Rehabilitation Starting Balances must support product-level WIP and finished goods, including legacy-data migration')
assert.ok(expansionPanelSource.includes('Local Accounts Receivable Liquidation Period (Days)')
  && expansionPanelSource.includes('Local Accounts Payable Payout Period (Days)')
  && expansionPanelSource.includes('Short-term deposits have only a local-currency field'),
  'COMFAR current-asset and liability starting balances must retain collection and payout periods and local-only short-term deposits')
assert.ok(expansionPanelSource.includes('Linear to zero')
  && expansionPanelSource.includes('Linear to scrap')
  && expansionPanelSource.includes('Accelerated')
  && expansionPanelSource.includes('Sum of digits')
  && expansionPanelSource.includes('Starting at')
  && expansionPanelSource.includes('Scrap (% of original value)')
  && expansionPanelSource.includes("asset.depreciationMethod!=='sum-of-digits'"),
  'Existing fixed-asset depreciation inputs must match COMFAR four methods and disable rate for Sum of digits')
assert.ok(expansionPanelSource.includes('Residual / salvage value')
  && expansionPanelSource.includes('Type of Depreciation')
  && expansionPanelSource.includes('Cost Centre')
  && expansionPanelSource.includes('Repayment Frequency')
  && expansionPanelSource.includes('Grace Period (years)')
  && expansionPanelSource.includes('Next Instalment Date'),
  'Existing fixed assets and long-term debt starting balances must expose COMFAR depreciation and repayment attributes')
assert.ok(expansionPanelSource.includes('Long-Term Debt and Equity Capital')
  && expansionPanelSource.includes('Opportunity Value'),
  'Existing fixed assets and long-term finance must use consistent COMFAR vocabulary')
assert.ok(expansionPanelSource.includes('Existing Enterprise — Without Project')
  && expansionPanelSource.includes('Existing Enterprise + Project')
  && expansionPanelSource.includes('Incremental Project Effect'),
  'Expansion/Rehabilitation workflow must explicitly model COMFAR stages 1, 2 and 3')
assert.ok(expansionPanelSource.includes('calculateIncrementalEnterpriseAnalysis')
  && expansionPanelSource.includes('Opening Balance Difference')
  && expansionPanelSource.includes('opportunityValue')
  && expansionPanelSource.includes('withoutProjectCashFlow')
  && expansionPanelSource.includes('withProjectCashFlow'),
  'Expansion form must expose opening balances, opportunity values and with/without/incremental scenarios')
console.log('PASS: COMFAR-style existing-enterprise opening balances and incremental with/without-project analysis')

const opportunityCostCase = engine.calculateIncrementalEnterpriseAnalysis(
  withoutEnterprise,
  withEnterprise.map((period,index)=>index===0?{...period,opportunityCost:200}:period),
  0.1
)
near(opportunityCostCase.periods[0].incrementalCashFlow, -1200, 1e-9,
  'Existing asset opportunity cost must be charged to the with-project incremental case')

const existingAnnuityLoan = engine.calculateExistingLoanSchedule({
  openingBalance: 1000,
  annualInterestRatePercent: 12,
  startDate: '2026-01-31',
  firstRepaymentDate: '2027-01-31',
  repaymentFrequency: 'annual',
  repaymentType: 'annuity',
  numberOfRepayments: 2,
  capitalizeGraceInterest: true,
})
assert.equal(existingAnnuityLoan.valid, true, 'Existing annuity loan schedule must be valid')
near(existingAnnuityLoan.rows[0].capitalizedInterest, 120, 1e-9,
  'COMFAR grace-period interest capitalization')
near(existingAnnuityLoan.rows[0].openingBalance, 1120, 1e-9,
  'Annuity schedule opening balance includes capitalized grace interest')
near(existingAnnuityLoan.totalPrincipal, 1120, 1e-9,
  'Annuity schedule must repay all principal')
near(existingAnnuityLoan.closingBalance, 0, 1e-9,
  'Annuity schedule must close at zero')

const existingConstantLoan = engine.calculateExistingLoanSchedule({
  openingBalance: 1200,
  annualInterestRatePercent: 12,
  startDate: '2026-01-31',
  firstRepaymentDate: '2026-04-30',
  repaymentFrequency: 'quarterly',
  repaymentType: 'constant-principal',
  numberOfRepayments: 4,
  capitalizeGraceInterest: false,
})
assert.equal(existingConstantLoan.valid, true, 'Existing constant-principal loan schedule must be valid')
near(existingConstantLoan.rows[0].interestPayable, 36, 1e-9,
  'Quarterly opening grace interest must use annual rate × months / 12')
near(existingConstantLoan.rows[0].principalRepayment, 300, 1e-9,
  'Constant-principal schedule must divide principal evenly')
near(existingConstantLoan.closingBalance, 0, 1e-9,
  'Constant-principal schedule must close at zero')

const existingProfileLoan = engine.calculateExistingLoanSchedule({
  openingBalance: 1000,
  annualInterestRatePercent: 10,
  startDate: '2026-01-31',
  firstRepaymentDate: '2026-04-30',
  repaymentFrequency: 'quarterly',
  repaymentType: 'profile',
  numberOfRepayments: 2,
  interestPaymentMonth: 12,
  profileRepayments: [
    { date: '2026-04-30', principal: 250 },
    { date: '2026-10-31', principal: 750 },
  ],
})
assert.equal(existingProfileLoan.valid, true, 'Existing profile loan must accept dated principal repayments')
near(existingProfileLoan.totalPrincipal, 1000, 1e-9,
  'Profile loan must aggregate user-defined principal repayments')
assert.equal(engine.calculateExistingLoanSchedule({
  openingBalance: 1000, annualInterestRatePercent: 10, startDate: '2026-01-31',
  firstRepaymentDate: '2026-04-30', repaymentFrequency: 'quarterly',
  repaymentType: 'annuity', numberOfRepayments: 0,
}).valid, false, 'Existing loan must reject a zero repayment count')

assert.ok(expansionPanelSource.includes('Annuity')
  && expansionPanelSource.includes('openingAccruedInterest:loan.accruedInterest??0')
  && expansionPanelSource.includes('Accrued Interest Payable')
  && expansionPanelSource.includes('Constant Principal')
  && expansionPanelSource.includes('Profile')
  && expansionPanelSource.includes('First Repayment Date')
  && expansionPanelSource.includes('Number of Repayments')
  && expansionPanelSource.includes('Repayment Schedule and Debt Service')
  && expansionPanelSource.includes('Month Interest Paid')
  && expansionPanelSource.includes('interestPaymentMonth:loan.interestPaymentMonth??12'),
  'Expansion/Rehabilitation loan form must expose COMFAR loan types and repayment schedule')
console.log('PASS: COMFAR-style existing-loan repayment schedules, grace-period capitalization and profile repayments')

const accruedInterestLoan = engine.calculateExistingLoanSchedule({
  openingBalance: 1000,
  openingAccruedInterest: 20,
  annualInterestRatePercent: 12,
  startDate: '2026-01-31',
  firstRepaymentDate: '2026-04-30',
  repaymentFrequency: 'quarterly',
  repaymentType: 'annuity',
  numberOfRepayments: 4,
  capitalizeGraceInterest: true,
})
assert.equal(accruedInterestLoan.valid, true, 'Existing accrued interest must not invalidate an annuity schedule')
near(accruedInterestLoan.rows[0].capitalizedInterest, 30, 1e-9,
  'Quarterly grace interest is capitalized when selected')
near(accruedInterestLoan.rows[0].interestPayable, 20, 1e-9,
  'Previously accrued interest remains payable, not capitalized again')
near(accruedInterestLoan.rows[0].totalDebtService, accruedInterestLoan.regularPayment + 20, 1e-7,
  'Opening accrued interest is paid in addition to the regular annuity instalment')

const profileLoanInterestDates = engine.calculateExistingLoanSchedule({
  openingBalance: 1000,
  annualInterestRatePercent: 12,
  startDate: '2026-01-31',
  firstRepaymentDate: '',
  repaymentFrequency: 'quarterly',
  repaymentType: 'profile',
  numberOfRepayments: 0,
  interestPaymentMonth: 12,
  profileRepayments: [
    { date: '2026-06-30', principal: 500 },
    { date: '2027-06-30', principal: 500 },
  ],
})
assert.equal(profileLoanInterestDates.valid, true,
  'Profile loan must calculate without an annuity-style first repayment date')
near(profileLoanInterestDates.rows.find(row=>row.date==='2026-12-31')?.interestPayable??NaN, 80, 1e-9,
  'Profile loan interest is paid in the selected month, independent of principal repayments')
near(profileLoanInterestDates.totalInterest, 110, 1e-9,
  'Profile loan interest accrues over principal changes and is settled at repayment')

assert.equal(engine.calculateExistingLoanSchedule({
  openingBalance: 1000, annualInterestRatePercent: 12, startDate: '2026-01-31',
  firstRepaymentDate: '2026-04-15', repaymentFrequency: 'quarterly',
  repaymentType: 'annuity', numberOfRepayments: 4,
}).valid, false, 'Annuity and constant-principal repayments must use month-end dates')


const blankFoundation = foundation.createBlankProjectFoundation()
assert.equal(blankFoundation.schemaVersion, 1, 'Project foundation must be versioned')
assert.equal(blankFoundation.currencies.localCurrencyCode, '', 'Blank template must not assume a local currency')
assert.equal(blankFoundation.planning.periodFrequency, 'unspecified', 'Blank template must not assume annual periods')
assert.equal(blankFoundation.planning.balanceDateMonth, null, 'Blank template must not assume a balance date month')
assert.equal(blankFoundation.planning.dayCountBasis, null, 'Blank template must not assume a day-count basis')
assert.equal(blankFoundation.discounting.method, 'unspecified', 'Blank template must not assume a discounting method')
assert.equal(blankFoundation.taxation.system, 'unspecified', 'Blank template must not assume a tax system')
assert.equal(blankFoundation.taxation.lossCarryForward, null, 'Blank template must not assume loss carry-forward treatment')
assert.ok((await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')).includes("method:rawProject?'unspecified'") , 'Raw template must not assume a discounting method in the finance form')
assert.equal(blankFoundation.currencies.foreignCurrencies.length, 0, 'Blank template must not invent foreign currencies or exchange rates')
assert.equal(blankFoundation.discounting.financialRatePercent, null, 'Blank template must not assume a financial discount rate')
assert.equal(blankFoundation.taxation.rates.length, 0, 'Blank template must not assume tax rates')
assert.equal(blankFoundation.inflation.indices.length, 0, 'Blank template must not assume inflation indices')
assert.equal(blankFoundation.costCentres.items.length, 0, 'Blank template must not invent cost centres')
const validFoundation = foundation.mergeProjectFoundation({
  planning: { periodFrequency:'annual', balanceDateMonth:12, balanceDateDay:31, dayCountBasis:360, valuationDate:'2026-12-31', cashFlowTiming:'period-end' },
  currencies: { localCurrencyCode: 'IRR', localCurrencyName: 'Iranian Rial', foreignCurrencies: [
    { id:'usd', code:'USD', name:'US Dollar', exchangeRates:[{period:'1405',rateToLocal:1000000}] }
  ] },
  discounting: { method:'manual', financialRatePercent:25, economicRatePercent:12 },
  taxation: { system:'corporate', lossCarryForward:true, lossCarryForwardYears:5, rates:[{id:'tax-1405',period:'1405',ratePercent:25}] }
})
assert.equal(foundation.validateProjectFoundation(validFoundation).filter(issue=>issue.severity==='error').length, 0,
  'A complete project foundation must pass structural validation')
const duplicateCurrencyFoundation = foundation.mergeProjectFoundation({
  currencies: { localCurrencyCode:'IRR', localCurrencyName:'Iranian Rial', foreignCurrencies:[
    {id:'usd-1',code:'USD',name:'US Dollar',exchangeRates:[]},
    {id:'usd-2',code:'USD',name:'Duplicate US Dollar',exchangeRates:[]}
  ]}
})
assert.ok(foundation.validateProjectFoundation(duplicateCurrencyFoundation).some(issue=>issue.code==='duplicate-currency-code'),
  'Project foundation must reject duplicate currency codes')
const missingCurrencyFoundation = foundation.createBlankProjectFoundation()
assert.ok(foundation.validateProjectFoundation(missingCurrencyFoundation).some(issue=>issue.code==='missing-local-currency'),
  'Project foundation must block calculation without a local currency')

const blankAsset = foundation.createBlankFixedInvestmentItem()
assert.equal(blankAsset.acquisitions.length, 0, 'Blank fixed investment item must not invent acquisition amounts')
assert.equal(blankAsset.depreciation.method, 'none', 'Blank fixed investment item must not assume a depreciation method')
assert.equal(blankAsset.depreciation.firstDepreciationMonths, 12, 'Blank asset must expose an explicit first-year month default that is neutral until depreciation is selected')
const validAsset = {
  ...blankAsset,
  id:'asset-valid', description:'Production machinery', assetClass:'machinery', origin:'local', currencyCode:'IRR',
  depreciation:{method:'linear-scrap',startingAt:'1405-01-01',ratePercent:10,lengthYears:10,lengthMonths:0,firstDepreciationMonths:12,scrapPercent:10},
  acquisitions:[{id:'acq-1',period:'1403',quantity:1,unitPrice:100,currencyCode:'IRR',exchangeRateToLocal:null}],
  sales:[]
}
const validAssetIssues = foundation.validateFixedInvestmentItems([validAsset], validFoundation)
assert.equal(validAssetIssues.filter(issue=>issue.severity==='error').length, 0,
  'A complete local fixed-asset record must pass register validation: ' + JSON.stringify(validAssetIssues))
const sameYearBeforeStart = engine.resolveComfarDepreciationStartPeriod(2,2,'1405-01-01','1405-06-01')
const sameYearAfterStart = engine.resolveComfarDepreciationStartPeriod(2,2,'1405-07-01','1405-06-01')
assert.equal(sameYearBeforeStart,2,'An acquisition before Starting at in the same year must start depreciation in that year')
assert.equal(sameYearAfterStart,3,'An acquisition after Starting at in the same year must start depreciation in the following year')
const registerAsset = {
  ...validAsset,
  id:'register-asset',
  depreciationBasis:'source-table',
  depreciation:{method:'linear-scrap',startingAt:'1405-06-01',ratePercent:10,lengthYears:10,lengthMonths:0,firstDepreciationMonths:6,scrapPercent:10},
  acquisitions:[{id:'register-acq',period:'1405-01-01',quantity:2,unitPrice:100,currencyCode:'IRR',exchangeRateToLocal:null,allocationBasis:'source-period'}],
  sales:[]
}
const duplicateSaleIssues = foundation.validateFixedInvestmentItems([{
  ...registerAsset,
  sales:[
    {id:'sale-one',acquisitionId:'register-acq',period:'1406-12-29',market:'local',priceMode:'book-value',currencyCode:'IRR',selfDefinedPrice:null},
    {id:'sale-two',acquisitionId:'register-acq',period:'1407-12-29',market:'local',priceMode:'book-value',currencyCode:'IRR',selfDefinedPrice:null}
  ]
}],foundation.createBlankProjectFoundation())
assert.ok(duplicateSaleIssues.some(issue=>issue.code==='duplicate-acquisition-disposal'),'One acquisition vintage must not be disposed twice')

const capexBridge = engine.reconcileFixedInvestmentRegister([registerAsset],200,0)
near(capexBridge.registerTotal,200,1e-9,'Fixed investment register must sum acquisitions in local currency')
near(capexBridge.capexFixedAssetTarget,200,1e-9,'CAPEX reconciliation target must exclude pre-operating costs')
near(capexBridge.difference,0,1e-9,'Matching fixed investment register and CAPEX must reconcile')
assert.equal(capexBridge.status,'matched','A fully reconciled fixed investment register must be marked matched')
const capexBridgeWithPreop = engine.reconcileFixedInvestmentRegister([registerAsset],250,50)
near(capexBridgeWithPreop.capexFixedAssetTarget,200,1e-9,'Pre-operating expenses must be excluded from fixed-asset reconciliation')
const capexBridgeMismatch = engine.reconcileFixedInvestmentRegister([registerAsset],260,0)
assert.equal(capexBridgeMismatch.status,'unreconciled','A difference between register and aggregate CAPEX must be flagged')
assert.ok(capexBridgeMismatch.warnings.length>0,'Unreconciled CAPEX must produce an actionable warning')
const capexBridgeNoRegister = engine.reconcileFixedInvestmentRegister([],260,0)
assert.equal(capexBridgeNoRegister.status,'unreconciled','Aggregate CAPEX without asset-register coverage must be flagged')
assert.ok(capexBridgeNoRegister.warnings.length>0,'Missing asset-register coverage must produce an actionable warning')
const capexBridgeForeign = engine.reconcileFixedInvestmentRegister([{
  ...registerAsset,origin:'foreign',
  acquisitions:[{id:'fx-acq',period:'1405-01-01',quantity:2,unitPrice:100,currencyCode:'USD',exchangeRateToLocal:300}]
}],60000,0)
near(capexBridgeForeign.registerTotal,60000,1e-9,'Foreign fixed-asset acquisitions must be translated to local currency before reconciliation')
const capexBridgeMissingFx = engine.reconcileFixedInvestmentRegister([{
  ...registerAsset,origin:'foreign',
  acquisitions:[{id:'fx-missing',period:'1405-01-01',quantity:2,unitPrice:100,currencyCode:'USD',exchangeRateToLocal:null}]
}],0,0)
assert.equal(capexBridgeMissingFx.status,'unreconciled','Foreign acquisition without an exchange rate must not reconcile')
const registerBuild = engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([registerAsset],1405,12)
assert.equal(registerBuild.assets.length,1,'A valid fixed-asset acquisition must map to one depreciation vintage')
assert.equal(registerBuild.assets[0].acquisitionPeriod,1,'Fixed-asset acquisition year must map to annual project period')
assert.equal(registerBuild.assets[0].startingAtPeriod,1,'Starting at year must map to annual project period')
const quarterlyRegisterBuild = engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([registerAsset],1405,48,'quarterly')
assert.equal(quarterlyRegisterBuild.assets.length,1,'The fixed investment register must preserve vintages for the quarterly calendar engine')
assert.ok(!quarterlyRegisterBuild.warnings.some(warning=>warning.includes('فقط برنامه سالانه')),'Quarterly asset vintages must no longer be blocked by the annual-only depreciation guard')
const quarterlyRegisterCalendar=foundation.buildProjectCalendarPeriods('1405-01-01','1405-12-31','quarterly',1)
const quarterlyRegisterDepreciation=engine.calculateComfarCalendarDepreciationSchedule(quarterlyRegisterBuild.assets,quarterlyRegisterCalendar,1)
assert.equal(quarterlyRegisterDepreciation.valid,true,'Dated fixed-asset vintages must calculate on a quarterly project calendar')
near(quarterlyRegisterDepreciation.periods[0].depreciation,0,1e-9,'Quarterly depreciation must respect the fixed asset Starting at date')
assert.ok(quarterlyRegisterDepreciation.periods[1].depreciation>0,'Quarterly depreciation must begin in the period containing the configured start date')

const threeYearDepreciationCalendar=foundation.buildProjectCalendarPeriods('2024-01-01','2026-12-31','annual',1)
const depreciationMethodCases=[
  {method:'none',ratePercent:undefined},
  {method:'linear-to-zero',ratePercent:33.3333333333},
  {method:'linear-to-scrap',ratePercent:33.3333333333},
  {method:'accelerated',ratePercent:50},
  {method:'sum-of-years-digits',ratePercent:undefined},
]
for (const testCase of depreciationMethodCases) {
  const asset={
    id:'calendar-'+testCase.method,name:'Calendar '+testCase.method,
    originalValue:1200,initialBookValue:1200,scrapPercent:10,
    lengthYears:3,lengthMonths:0,ratePercent:testCase.ratePercent,
    method:testCase.method,acquisitionPeriod:0,startingAtPeriod:1,
    acquisitionDate:'2024-01-01',startingAtDate:'2024-01-01',firstDepreciationMonths:12,
  }
  const schedule=engine.calculateComfarCalendarDepreciationSchedule([asset],threeYearDepreciationCalendar,1)
  assert.equal(schedule.valid,true,testCase.method+' calendar depreciation must accept a valid dated asset')
  assert.equal(schedule.periods.length,3,testCase.method+' calendar depreciation must return all fiscal years')
  assert.ok(schedule.periods.every(row=>row.assets.length===1),testCase.method+' must preserve asset-by-asset rows in every period')
  assert.ok(schedule.periods.every(row=>row.assets[0].closingBookValue>=120-1e-8),testCase.method+' must never depreciate below the 10% salvage floor')
  assert.ok(schedule.periods.every(row=>row.assets[0].depreciation>=0),testCase.method+' depreciation must never be negative')
  const totalDepreciation=schedule.periods.reduce((sum,row)=>sum+row.assets[0].depreciation,0)
  if (testCase.method==='none') near(totalDepreciation,0,1e-9,'Non-depreciable asset must retain zero depreciation')
  else {
    near(totalDepreciation,1080,0.02,testCase.method+' must depreciate exactly original value less salvage by end of useful life')
    near(schedule.periods[2].assets[0].closingBookValue,120,0.02,testCase.method+' must finish at salvage value')
  }
  assert.ok(schedule.methodControls.every(control=>control.numericalBenchmark==='pending'),
    'Method formulas must not be labelled externally benchmarked until matched to independent COMFAR method outputs')
}
const datedStartAsset={
  id:'dated-start',name:'Dated start',originalValue:1200,initialBookValue:1200,scrapPercent:10,
  lengthYears:3,lengthMonths:0,ratePercent:33.3333333333,method:'linear-to-scrap',
  acquisitionPeriod:0,startingAtPeriod:1,acquisitionDate:'2024-01-01',startingAtDate:'2024-07-01',
}
const datedStartSchedule=engine.calculateComfarCalendarDepreciationSchedule([datedStartAsset],threeYearDepreciationCalendar,1)
assert.equal(datedStartSchedule.valid,true,'A mid-year depreciation start date must be accepted')
near(datedStartSchedule.periods[0].assets[0].depreciation,181.36,0.02,
  'First-year straight-line depreciation must be prorated from the actual July 1 start date')
assert.ok(datedStartSchedule.periods[0].assets[0].openingBookValue===1200,
  'The asset opening book value must remain its full acquisition cost before depreciation')

assert.equal(engine.resolveComfarDepreciationStartPeriod(registerBuild.assets[0].acquisitionPeriod,registerBuild.assets[0].startingAtPeriod,registerBuild.assets[0].acquisitionDate,registerBuild.assets[0].startingAtDate),1,'Full acquisition date before Starting at must retain same-year depreciation')
near(registerBuild.assets[0].originalValue,200,1e-9,'Fixed-asset acquisition amount must be converted to local currency')
assert.equal(registerBuild.investmentSchedule[0],200,'Confirmed asset acquisitions must create a periodised investment cash-flow schedule')
assert.equal(registerBuild.investmentScheduleVerified,true,'Source-supported acquisition periods must verify register-based CAPEX timing')
const unspecifiedFrequencyBuild=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([registerAsset],1405,12,'unspecified',validFoundation)
assert.equal(unspecifiedFrequencyBuild.investmentScheduleVerified,false,'Unspecified project period frequency must not verify register-based CAPEX timing')
const estimatedRegisterBuild=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([{
  ...registerAsset,acquisitions:registerAsset.acquisitions.map(row=>({...row,allocationBasis:'proportional-estimate'}))
}],1405,12,'annual',validFoundation)
assert.equal(estimatedRegisterBuild.investmentScheduleVerified,false,'Estimated acquisition timing must not be treated as a verified cash-flow schedule')
assert.ok(estimatedRegisterBuild.warnings.some(warning=>warning.includes('proportional estimate')),'Estimated acquisition timing must be disclosed')
const preproductionRegisterItem={...registerAsset,id:'preproduction-register',assetClass:'preproduction',acquisitions:[{id:'preproduction-acq',period:'1405',quantity:1,unitPrice:50,currencyCode:'IRR',exchangeRateToLocal:null,allocationBasis:'proportional-estimate'}]}
const preproductionBridge=engine.reconcileFixedInvestmentRegister([registerAsset,preproductionRegisterItem],250,50)
near(preproductionBridge.registerTotal,200,1e-9,'Pre-production expenditures must not be included in fixed asset CAPEX total')
near(preproductionBridge.preproductionTotal,50,1e-9,'Pre-production expenditure must be reconciled separately')
assert.equal(preproductionBridge.status,'matched','Fixed assets and pre-production expenditures must reconcile to separate CAPEX targets')
const preproductionSchedule=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([registerAsset,preproductionRegisterItem],1405,12)
near(preproductionSchedule.investmentSchedule[0],200,1e-9,'Pre-production costs must not be double-counted in fixed asset investment cash-flow schedule')
near(preproductionSchedule.preOperatingSchedule[0],50,1e-9,'Pre-production expenditures must have a separate periodised cash-flow schedule')
assert.equal(preproductionSchedule.preOperatingScheduleVerified,false,'Estimated pre-production timing must remain provisional')

const landRegisterAsset = {
  ...registerAsset,id:'land-register',assetClass:'land',
  depreciation:{method:'none',startingAt:'',ratePercent:null,lengthYears:null,lengthMonths:0,firstDepreciationMonths:12,scrapPercent:100},
  acquisitions:[{id:'land-acq',period:'1405-01-01',quantity:1,unitPrice:500,currencyCode:'IRR',exchangeRateToLocal:null}],
  sales:[{id:'land-sale',acquisitionId:'land-acq',period:'1407',market:'local',priceMode:'book-value',currencyCode:'IRR',selfDefinedPrice:null}]
}
const landRegisterBuild=engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([landRegisterAsset],1405,12,'annual',validFoundation)
assert.equal(landRegisterBuild.assets.length,1,'Non-depreciated land must still be included in the disposal register')
assert.equal(landRegisterBuild.assets[0].method,'none','Land must retain the non-depreciated method in the lifecycle engine')
const landRegisterLifecycle=engine.calculateComfarAssetLifecycle(landRegisterBuild.assets,landRegisterBuild.sales,12)
assert.equal(landRegisterLifecycle.valid,true,'A sale of non-depreciated land must be calculated without a missing-vintage warning')
near(landRegisterLifecycle.sales[0].bookValueAtSale,500,1e-9,'Non-depreciated land must retain its book value until disposal')
const soldRegisterAsset = { ...registerAsset, sales:[{id:'register-sale',acquisitionId:'register-acq',period:'1407',market:'local',priceMode:'book-value',currencyCode:'IRR',selfDefinedPrice:null}] }
const soldRegisterBuild = engine.buildComfarDepreciationAssetsFromFixedInvestmentItems([soldRegisterAsset],1405,12,'annual',validFoundation)
assert.equal(soldRegisterBuild.assets.length,1,'An asset sold within the horizon must retain its depreciation vintage through the disposal period')
assert.equal(soldRegisterBuild.sales.length,1,'A fixed-investment register sale must map to its acquisition vintage')
assert.equal(soldRegisterBuild.sales[0].assetId,'register-asset:register-acq','The sale must reference the exact acquisition vintage')
const soldRegisterLifecycle = engine.calculateComfarAssetLifecycle(soldRegisterBuild.assets,soldRegisterBuild.sales,12)
assert.equal(soldRegisterLifecycle.valid,true,'A valid register sale must flow into the COMFAR asset lifecycle')
assert.equal(soldRegisterLifecycle.sales[0].period,3,'A sale period in the register must map to the matching annual project period')
near(soldRegisterLifecycle.depreciation.periods[3].assets[0].depreciation,0,1e-9,'Depreciation must stop after the registered sale period')
const invalidBeforeAcquisition = engine.calculateComfarAssetDepreciationSchedule([{
  id:'invalid-before-acquisition',name:'Invalid asset',originalValue:1000,initialBookValue:1000,scrapPercent:10,
  lengthYears:5,method:'sum-of-years-digits',acquisitionPeriod:2,startingAtPeriod:1,firstDepreciationMonths:6
}],4)
near(invalidBeforeAcquisition.periods[0].closingBookValue,0,1e-9,'Invalid assets must not appear before acquisition period')
const landDepreciation = { ...validAsset, id:'land-depreciation', assetClass:'land' }
assert.ok(foundation.validateFixedInvestmentItems([landDepreciation], validFoundation).some(issue=>issue.code==='land-not-depreciable'),
  'Land must not be depreciated')
const saleBeforeAcquisition = {
  ...validAsset,
  sales:[{id:'sale-early',acquisitionId:'acq-1',period:'1402',market:'local',priceMode:'self-defined',currencyCode:'IRR',selfDefinedPrice:50}]
}
assert.ok(foundation.validateFixedInvestmentItems([saleBeforeAcquisition], validFoundation).some(issue=>issue.code==='asset-sale-before-acquisition'),
  'Asset disposal cannot precede acquisition')
const saleOffBalanceDate = { ...validAsset, sales:[{id:'sale-off-date',acquisitionId:'acq-1',period:'1405-06-30',market:'local',priceMode:'book-value',currencyCode:'IRR',selfDefinedPrice:null}] }
assert.ok(foundation.validateFixedInvestmentItems([saleOffBalanceDate], validFoundation).some(issue=>issue.code==='asset-sale-not-at-balance-date'), 'Asset sale dates must be balance dates')
const invalidSumDigitsPartial = {
  ...validAsset, id:'asset-sum-partial',
  depreciation:{method:'sum-of-digits',startingAt:'1405-01-01',ratePercent:null,lengthYears:5,lengthMonths:0,firstDepreciationMonths:6,scrapPercent:10}
}
assert.ok(foundation.validateFixedInvestmentItems([invalidSumDigitsPartial], validFoundation).some(issue=>issue.code==='sum-of-years-partial-period-not-benchmarked'),
  'Sum of years digits must fail closed for unbenchmarked partial-year depreciation')
const invalidForeignAsset = {
  ...validAsset, id:'asset-foreign', origin:'foreign', currencyCode:'USD',
  acquisitions:[{id:'acq-foreign',period:'1403',quantity:1,unitPrice:100,currencyCode:'USD',exchangeRateToLocal:null}]
}
assert.ok(foundation.validateFixedInvestmentItems([invalidForeignAsset], validFoundation).some(issue=>issue.code==='missing-asset-exchange-rate'),
  'Foreign-origin fixed-asset acquisitions must require an exchange rate to local currency')
const foundationWizard = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
const foundationPanel = await readFile(new URL('../src/features/projects/ProjectFoundationPanel.tsx', import.meta.url), 'utf8')
assert.ok(foundationWizard.includes('ProjectFoundationPanel')
  && foundationWizard.includes('mergeProjectFoundation(v.foundation)')
  && foundationWizard.includes('createBlankProjectFoundation()')
  && foundationWizard.includes('foundation:isHotRolling?mergeHotRollingCoilProjectFoundation(v.foundation):mergeProjectFoundation(v.foundation)'),
  'Project foundation must be integrated into the saved project model with legacy-safe migration')
assert.ok(foundationPanel.includes('Currencies & Exchange Rates')
  && foundationPanel.includes('Cost Centres')
  && foundationPanel.includes('Inflation & Price Indices')
  && foundationPanel.includes('Discounting & Taxation')
  && foundationPanel.includes('no exchange rate, inflation, tax or discount rate is assumed')
  && foundationPanel.includes('Add Period Exchange Rate')
  && foundationPanel.includes('Add Period Inflation Rate'),
  'Common project foundation form must cover the base schedules without inventing unknown assumptions')
const fixedInvestmentPanel = await readFile(new URL('../src/features/projects/FixedInvestmentPanel.tsx', import.meta.url), 'utf8')
assert.ok(foundationWizard.includes('FixedInvestmentPanel')
  && foundationWizard.includes('fixedInvestmentItems:hotRollingCoilProject?createHotRollingCoilFixedInvestmentItems():[]')
  && foundationWizard.includes('Array.isArray(v.fixedInvestmentItems)?v.fixedInvestmentItems:[]')
  && foundationWizard.includes('fixedInvestmentItems:(isHotRolling?migratedFixedInvestmentItems:savedFixedInvestmentItems).map(item=>({...item,depreciationBasis:')
  && foundationWizard.includes('fixedInvestmentItems:[]'),
  'The reusable fixed investment register must be initialized for new projects and restored with legacy-safe migration')
assert.ok(fixedInvestmentPanel.includes("listFinancialMethods('depreciation')")
  && fixedInvestmentPanel.includes('directoryMethodToAssetMethod')
  && fixedInvestmentPanel.includes('Depreciation Method Directory')
  && fixedInvestmentPanel.includes('Benchmark verified')
  && fixedInvestmentPanel.includes('Not numerically benchmarked')
  && fixedInvestmentPanel.includes('buildComfarDepreciationAssetsFromFixedInvestmentItems'),
  'The asset depreciation selector must be directory-driven, expose method evidence/benchmark status and remain connected to the existing calculation engine')
assert.ok(fixedInvestmentPanel.includes('Costs of Assets by Period')
  && fixedInvestmentPanel.includes('Depreciation Conditions')
  && fixedInvestmentPanel.includes('Sale of Asset')
  && fixedInvestmentPanel.includes("'depreciation.straight-line-zero': 'linear-zero'")
  && fixedInvestmentPanel.includes("'depreciation.straight-line-scrap': 'linear-scrap'")
  && fixedInvestmentPanel.includes("'depreciation.accelerated': 'accelerated'")
  && fixedInvestmentPanel.includes("'depreciation.sum-of-years-digits': 'sum-of-digits'")
  && fixedInvestmentPanel.includes('Sum of years digits')
  && fixedInvestmentPanel.includes('aggregate CAPEX') && fixedInvestmentPanel.includes('preventing double-counting') && fixedInvestmentPanel.includes('first depreciation year') && fixedInvestmentPanel.includes('Asset Depreciation Schedule Preview') && fixedInvestmentPanel.includes('buildComfarDepreciationAssetsFromFixedInvestmentItems') && fixedInvestmentPanel.includes('asset-sale-not-at-balance-date') && fixedInvestmentPanel.includes('missing-asset-sale-exchange-rate') && fixedInvestmentPanel.includes('Annual Depreciation vs Reference Output') && fixedInvestmentPanel.includes('referenceDepreciationByYear') && fixedInvestmentPanel.includes('Acquisition Period Basis') && fixedInvestmentPanel.includes('Depreciation Condition Evidence') && fixedInvestmentPanel.includes('depreciation-basis-conflict') && fixedInvestmentPanel.includes('calculateComfarAssetLifecycle') && fixedInvestmentPanel.includes('Asset Sale Proceeds'),
  'Fixed investment foundation must capture acquisition periods, COMFAR depreciation conditions and asset disposals without double-counting CAPEX')
const advancedFinanceSource = await readFile(new URL('../src/features/projects/AdvancedFinancePanel.tsx', import.meta.url), 'utf8')
assert.ok(foundationWizard.includes('buildComfarDepreciationAssetsFromFixedInvestmentItems')
  && foundationWizard.includes('comfarDepreciationAssets={fixedInvestmentLifecycleInputs.assets}')
  && foundationWizard.includes('comfarAssetSales={fixedInvestmentLifecycleInputs.sales}'),
  'The fixed investment register must feed acquisition vintages and sale events into the project finance panel')
assert.ok(advancedFinanceSource.includes('useFixedInvestmentRegister ? Array(years).fill(0)')
  && advancedFinanceSource.includes('!props.useFixedInvestmentRegister'),
  'New feasibility projects must not fall back to assumed legacy depreciation when the shared register is blank')
assert.ok(foundationWizard.includes('useFixedInvestmentRegister={true}'),
  'The project wizard must use the common Fixed Investment Register as the authoritative depreciation source')
assert.ok(advancedFinanceSource.includes('calculateComfarAssetLifecycle')
  && advancedFinanceSource.includes('assetSaleSchedule')
  && advancedFinanceSource.includes('Other income / loss')
  && advancedFinanceSource.includes('depreciationValues'),
  'The integrated finance panel must use COMFAR depreciation and asset sale results instead of the legacy two-method schedule when register assets are supplied')
const reportWizardSource = await readFile(new URL('../src/features/projects/FeasibilityWizard.tsx', import.meta.url), 'utf8')
const reportVisualsSource = await readFile(new URL('../src/features/projects/ProjectReportVisuals.tsx', import.meta.url), 'utf8')
assert.ok(reportWizardSource.includes('ProjectReportVisuals')
  && reportWizardSource.includes('onSensitivity={setReportSensitivity}')
  && reportWizardSource.includes("display:step==='cashflow'?'block':'none'"),
  'Project reports must receive live integrated sensitivity analysis even when the report tab is opened directly')
assert.ok(reportVisualsSource.includes('chartMaxQuantity?:number')
  && reportVisualsSource.includes('capacity={200000} chartMaxQuantity={83000}')
  && reportVisualsSource.includes('breakEven/capacity*100'),
  'Reference break-even plot must use the workbook chart range separately from the actual 200,000-tonne capacity denominator')
assert.ok(reportVisualsSource.includes('Sensitivity Analysis Chart')
  && reportVisualsSource.includes('Break-Even Chart')
  && reportVisualsSource.includes('General Project Specification')
  && reportVisualsSource.includes('24,675.80')
  && reportVisualsSource.includes('12.15'),
  'Project report must include sensitivity, break-even and source-backed OPEX specification outputs with conflicts preserved')
assert.ok(reportVisualsSource.includes('1,286,225.93')
  && reportVisualsSource.includes('80% وام / 20% آورده')
  && reportVisualsSource.includes('70% آورده / 30% وام'),
  'Project report must disclose amount-derived 70/30 financing and the contradictory 80/20 label plus working-capital funding gap')
assert.ok(reportVisualsSource.includes('HOT_ROLLING_COMFAR_OUTPUT_AUDIT')
  && reportVisualsSource.includes('comfarTaxScheduleMatches')
  && reportVisualsSource.includes('Tax schedule')
  && reportVisualsSource.includes('5% in 1405–1409; 25% in 1410–1419'),
  'COMFAR reconciliation must compare the original five-year 5% tax period and subsequent 25% schedule, not only the uniform 25% sponsor scenario')
assert.ok(reportVisualsSource.includes('Construction financing split')
  && reportVisualsSource.includes('props.equityPercent - 70')
  && reportVisualsSource.includes('props.debtPercent - 30'),
  'Exact COMFAR basis matching must require the amount-derived 70/30 construction financing, while the sponsor 20/80 scenario remains separate')
assert.ok(reportVisualsSource.includes('Period-by-period cash-flow and driver reconciliation')
  && reportVisualsSource.includes('projectFreeCashFlow-referenceCashFlow')
  && reportVisualsSource.includes('depreciationByOperatingYear')
  && reportVisualsSource.includes('changeInWorkingCapitalByOperatingYear')
  && wizardSource.includes('periodFrequency={m.foundation.planning.periodFrequency}'),
  'Annual COMFAR reconciliation must expose project cash flow, tax, depreciation and working-capital variances period by period')
assert.ok(foundationPanel.includes('Project Start Date')
  && foundationPanel.includes('Project End Date')
  && foundationPanel.includes('Fiscal Year Start Month')
  && foundationPanel.includes('buildProjectCalendarPeriods')
  && foundationPanel.includes('Generated Financial Calendar'),
  'Project foundation must expose project dates, fiscal-year start month and generated-period preview')
console.log('PASS: industry-independent project foundation schema, blank defaults, validation and wizard persistence')
