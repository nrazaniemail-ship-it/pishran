/**
 * Source-derived reconciliation controls for the five supplied Excel workbooks.
 * Monetary amounts are stored exactly in each workbook's stated unit:
 * DRI/steelmaking = EUR; HRCR200 = million IRR (unit costs are IRR/kg).
 * These are audit controls, not default assumptions for cross-project aggregation.
 */
export const DRI_STEELMAKING_AUDIT = {
  currency: 'EUR',
  capacity: { driTpy: 1_760_000, slabTpy: 1_200_000 },
  capexCategories: [
    { name: 'زمین', amount: 0 },
    { name: 'محوطه‌سازی', amount: 2_456_550 },
    { name: 'ساختمان‌های غیرصنعتی', amount: 2_676_921 },
    { name: 'ماشین‌آلات و تجهیزات', amount: 427_304_778 },
    { name: 'تأسیسات زیربنایی', amount: 16_992_000 },
    { name: 'وسائط نقلیه', amount: 2_693_752 },
    { name: 'تجهیزات اداری و خدماتی', amount: 469_844 },
    { name: 'هزینه‌های پیش‌بینی‌نشده', amount: 1_264_453 }
  ],
  materials: {
    driUnit: 359_973_680,
    steelmakingBase: 88_066_260,
    marineGradeAdditives: 7_034_880,
    apiGradeAdditives: 67_001_880,
    pressureVesselGradeAdditives: 15_408_360,
    total: 537_485_060,
    pelletConsumptionTPerTDri: 1.45,
    annualPelletConsumptionT: 2_552_000,
    scrapNetPurchaseTPerTSlab: 0.05,
    annualScrapNetPurchaseT: 60_000
  },
  energy: {
    driElectricityKwhPerT: 110,
    steelmakingElectricityKwhPerT: 568,
    totalElectricityKwh: 875_200_000,
    driGasNm3PerT: 250,
    steelmakingGasNm3PerT: 20,
    totalGasNm3: 464_000_000,
    driOxygenNm3PerT: 15,
    steelmakingOxygenNm3PerT: 40,
    totalOxygenNm3: 74_400_000,
    totalWaterM3: 5_621_680,
    compressedAirNm3: 60_720_000,
    nitrogenNm3: 4_320_000,
    argonNm3: 648_000,
    pricedUtilityCost: 69_530_818.4
  },
  products: {
    slabTpy: 1_200_000,
    slabRevenue: 760_800_000,
    surplusDriTpy: 460_000,
    surplusDriRevenue: 126_500_000,
    totalRevenue: 887_300_000,
    gradeMixTpy: { marine: 240_000, api: 660_000, pressureVessel: 180_000, construction: 120_000 }
  },
  capex: {
    fixedInvestment: 453_858_298,
    preproductionNet: 6_624_026.85,
    capitalizedInterest: 110_500_000,
    constructionUses: 570_982_324.85
  },
  workingCapital: 68_155_775.89,
  totalUses: 639_138_100.89,
  funding: {
    equity: 139_982_325,
    longTermDebt: 431_000_000,
    shortTermDebt: 49_523_442.75,
    totalSources: 620_505_767.75,
    fundingGap: 18_632_333.14
  },
  annualOpex: {
    rawMaterials: 537_485_060,
    labor: 10_272_936,
    laborOverhead: 2_054_587,
    maintenance: 17_977_288,
    utilities: 69_530_818.4,
    other: 6_642_810,
    depreciationDetailed: 33_020_570,
    factoryCostExDepreciation: 643_963_499.4,
    totalIncludingDepreciation: 676_984_069.4
  },
  reference: {
    referenceRevenue: 887_300_000,
    referenceFactoryCostExDepreciation: 643_963_499,
    referenceDepreciation: 26_727_770.59,
    firstOperatingYearDepreciation: 38_388_721.26,
    lastOperatingYearDepreciation: 25_180_187.8,
    projectNpvAt25: 19_964_251.38,
    projectIrrPercent: 26.08,
    equityNpvAt30: 60_342_720.87,
    equityIrrPercent: 40.51
  },
  model: {
    constructionYears: 4,
    operatingYears: 15,
    legacyRollingCapacityTpy: 700_000,
    firstOperatingPeriod: 5,
    firstFourOperatingYearsTaxPercent: 5,
    taxPercentFromOperatingYearFive: 25,
    workingCapitalScheduleTotal: 68_155_775.894444
  }
} as const

export const HOT_ROLLING_200KT_AUDIT = {
  currency: 'million IRR',
  capacityTpy: 200_000,
  fxAt14020710: { eurToIrr: 524_000, usdToIrr: 495_000, cnyToIrr: 68_000 },
  capex: {
    fixedInvestment: 18_463_008.720569465,
    preproductionNet: 239_826.63796,
    constructionInvestment: 18_702_835.358529467,
    capitalizedInterest: 3_298_633.06,
    constructionUsesIncludingInterest: 22_001_468.418529467,
    fullCapacityWorkingCapital: 4_595_370.4572,
    totalIncludingWorkingCapital: 26_596_838.875729468
  },
  funding: {
    sourcesReported: 22_001_469.06,
    sourceUseDifference: 0.641470533
  },
  depreciationReconciliation: {
    comfarOutputByYear: [
      [1405,1_432_554.34],[1406,1_432_554.34],[1407,1_432_554.34],
      [1408,1_425_537.64],[1409,1_365_962.59],
      [1410,1_316_912.59],[1411,1_316_912.59],[1412,1_316_912.59],[1413,1_316_912.59],
      [1414,98_840.49],[1415,98_840.49],[1416,98_840.49],
      [1417,94_540.41],[1418,60_745.69],[1419,52_751.46]
    ],
    conditionsTableFirstYear: 1_432_000.0916753965,
    comfarFirstYear: 1_432_554.34,
    conditionsTableVariance: 554.2483246035408,
    opexWorkbookAnnual: 1_580_327,
    opexWorkbookVariance: -147_772.66,
    preProductionAmortisationNotIncludedInFixedAssetRegister: 239_826.63796,
    status: 'open-asset-start-dates-and-disposals-not-yet-reconciled'
  },
  annualOpex: {
    rawMaterials: 40_844_287,
    utilities: 269_580,
    spareParts: 176_473.792,
    maintenance: 374_760,
    labor: 650_053,
    laborOverhead: 130_011,
    depreciation: 1_580_327,
    factoryOverhead: 159_060,
    directMarketing: 62_259.6,
    totalIncludingDepreciation: 44_246_811.392,
    totalExcludingDepreciation: 42_666_484.392,
    unitCostIncludingDepreciationIrrPerKg: 221_234.05696,
    unitCostExcludingDepreciationIrrPerKg: 170_665.937568
  },
  returnMetrics: {
    projectNpvAt21: 18_509_558.82096656,
    projectIrrPercent: 43.378234116396674,
    projectMirrPercent: 33.865108092920493,
    equityNpvAt30: 6_043_074.77598321,
    equityIrrPercent: 55.85519706607913,
    equityMirrPercent: 40.302869421931775
  },
  alternativeMetricsInWorkbook: {
    generalSummaryTotalInvestment: 26_596_838.875729468,
    irrNpvSheetTotalInvestment: 16_587_131.781609466,
    irrNpvSheetFixedInvestmentLink: 16_587_131.781609466,
    capexWorkbookFixedInvestment: 18_463_008.720569465,
    fixedInvestmentLinkDifference: 1_875_876.938959999,
    generalSummaryNpvAt25: 31_399_764.273352,
    generalSummaryIrrPercent: 48.31,
    generalSummaryMirrPercent: 28.03,
    generalSummaryEquityIrrPercent: 57.99,
    generalSummaryEquityMirrPercent: 30.9,
    irrNpvSheetProjectNpvAt21: 18_509_558.82096656,
    irrNpvSheetProjectIrrPercent: 43.378234116396674,
    irrNpvSheetNpvFormulaUsesNetDiscountedRow: true
  },
  financingCashflowSchedule: {
    equityContributionsTotal: 16_401_129.53,
    longTermLoanGrossDrawdowns: 8_909_484.057107,
    longTermLoanPrincipalRepayments: 8_909_484.057106,
    netDomesticSourcesInPeriodicSchedule: 16_401_129.530001,
    irrNpvEquityInitialOutflows: 2_761_971
  },
  financingAlternativesInWorkbook: {
    workingCapitalFundingSourceConflict: true,
    mechanismTabDebtSharePercent: 80,
    mechanismTabEquitySharePercent: 20,
    fundingSummaryTabEquitySharePercent: 70,
    fundingSummaryTabDebtSharePercent: 30,
    sponsorRequestedEquitySharePercent: 20,
    sponsorRequestedDebtSharePercent: 80,
    comfarReferenceEquityAmount: 13_091_985.2,
    comfarReferenceDebtAmount: 5_610_850.8,
    comfarReferenceFundingBase: 18_702_835.358529467,
    comfarReferenceWaccPercent: 26.85
  }
} as const

/** Exact cash-flow rows transcribed from OPEX workbook sheet "IRR-NPV" (million IRR). */
export const HOT_ROLLING_reference_CASHFLOW_AUDIT = {
  periodCount: 18,
  rawPlanningInflowsC4T4: [9721185.16442,9590444.960733,40836220.027034,41998170.083401,47247051.606626,52495933.129851,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,13954745.454709],
  rawPlanningOutflowsC5T5: [9721185.16442,9590444.960733,39877355.661086,41349163.44405,45797151.405755,50298705.351348,50126679.414203,44406000.43036,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,0],
  rawPlanningNetC6T6: [0,0,958864.3659479991,649006.6393510029,1449900.2008709982,2197227.7785030007,2369251.9432969987,8089930.927140005,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,13954745.454709],
  rawPlanningNetTotal: 115352013.186844,
  rawPlanningNetHasNegativePeriod: false,
  discountedInflowsC7T7: [0,0,36749299.194284,41998170.083401,47247051.606626,52495933.129851,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,52495931.3575,66450676.812209,13954745.454709],
  discountedOutflowsC8T8: [7908572.82,5905218.02,32823019.989519,33857557.006039,38305544.967744,42807098.913338,42635072.976192,42922343.618779,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,42975588.482275,0],
  netDiscountedC9S9: [-7908572.82,-5905218.02,3926279.2047649994,8140613.077362001,8941506.638881996,9688834.216513,9860858.381308004,9573587.738720998,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,23475088.329934],
  netDiscountedSumC9S9: 135955719.749285,
  secondDiscountedNpvRow11Sum: 18509558.820966564,
  reportedNpvFormula: 'IRR-NPV!C23 = NPV(C14,D9:S9)+C9',
  reportedIrrFormula: 'IRR-NPV!C24 = IRR(C9:S9)',
  reportedMirrFormula: 'IRR-NPV!C25 = MIRR(C9:S9,C18,C17)',
  equityCashFlowC51T51: [-1581085,-1180886,958864.365948,649006.639351,1449900.200871,2197227.778503,2369251.943297,8089930.92714,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,9520342.875225,23475088.329934,13954745.454709],
  equityMetricsReported: { npveAt30: 6043074.77598321, irrePercent: 55.85519706607913, mirrePercent: 40.302869421931775 },
  conclusion: 'The supplied planning rows C4:T6 are not a usable unlevered project cash-flow vector because net flows contain no negative investment periods. Rows 7 and 8 are labelled discounted; row 9 is their net and is then discounted again in row 11 and C23. The sheet IRR/MIRR also operate on row 9. A corrected project IRR/MIRR cannot be reconstructed without the original reference undiscounted project cash-flow export and its timing convention.'
} as const

export const WORKBOOK_RECONCILIATION_FLAGS = [
  'DRI detailed annual depreciation is EUR 33,020,570, while reference reference-year depreciation is EUR 26,727,770.59; the EUR 6,292,799.41 difference needs an asset-by-asset/year schedule bridge.',
  'DRI reference total uses exceed total financing sources by EUR 18,632,333.14; the gap is not a funded source in the reference sources table.',
  'The integrated cash-flow workbook includes net profit from an existing 700,000 t/y rolling line and a separate uplift after steelmaking starts; those are not the HRCR200 200,000 t/y project.',
  'HRCR200 source tabs conflict: the mechanism-tab summary reports 80/20 debt/equity, while the periodised funding summary and COMFAR output report 30/70 debt/equity during construction. The sponsor-requested active case is 20/80 equity/debt and must remain separate from both source cases. Working-capital funding is also inconsistent between the CAPEX schedule and COMFAR output.',
  'HRCR200 funding summary sources exceed construction uses including capitalized interest by 0.641470533 million IRR; this small difference may be rounding but is not silently adjusted.',
  'HRCR200 OPEX IRR-NPV rows 4–6 are raw financial-planning inflows/outflows/net flows; row 6 has no negative investment period and cannot produce project IRR. Rows 7–9 are labelled discounted cash flows; NPV row 23 discounts row 9 again, while IRR/MIRR also use row 9. A valid unlevered project IRR/MIRR requires the original reference undiscounted project cash-flow export.',
  'HRCR200 OPEX IRR-NPV links total investment to 16,587,131.78 million IRR, while the CAPEX workbook fixed investment is 18,463,008.72 million IRR and the project summary total including construction interest and working capital is 26,596,838.88 million IRR.',
  'HRCR200 detailed OPEX and sales sheets imply 221.234 million IRR/t unit cost and 311.298 million IRR/t average selling price, while the general summary sheet states 213.3 and 307 million IRR/t; detailed-sheet values are used for the independent Pishran model and summary values remain separately disclosed.',

  'HRCR200 infrastructure CAPEX is 1,707,981.40 million IRR, but the OPEX depreciation schedule uses only 1,423,564.00 million IRR as the depreciable base; the 284,417.40 million IRR difference has no asset-level classification and must not be silently depreciated or excluded.',
  'HRCR200 depreciation rows label 879,191 million IRR as pre-operating costs with zero scrap, while the CAPEX workbook classifies 879,191 million IRR as contingency; the separate 239,826.64 million IRR preproduction amount appears as Other costs with 10% scrap in the OPEX depreciation table, conflicting with the narrative that preproduction expenditure has zero scrap. Both labels and salvage assumptions require confirmation before seeding the asset register.',
  'HRCR200 CAPEX sheets do not consistently provide acquisition dates by asset group. The annual register must not invent acquisition periods; construction-period cash flows and asset acquisition vintages need separate, explicit inputs.'
] as const
