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
  comfar: {
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
    generalSummaryNpvAt25: 31_399_764.273352,
    generalSummaryIrrPercent: 48.31,
    generalSummaryMirrPercent: 28.03,
    generalSummaryEquityIrrPercent: 57.99,
    generalSummaryEquityMirrPercent: 30.9,
    irrNpvSheetProjectNpvAt21: 18_509_558.82096656,
    irrNpvSheetProjectIrrPercent: 43.378234116396674
  },
  financingCashflowSchedule: {
    equityContributionsTotal: 16_401_129.53,
    longTermLoanGrossDrawdowns: 8_909_484.057107,
    longTermLoanPrincipalRepayments: 8_909_484.057106,
    netDomesticSourcesInPeriodicSchedule: 16_401_129.530001,
    irrNpvEquityInitialOutflows: 2_761_971
  },
  financingAlternativesInWorkbook: {
    workingCapitalFundingSourceExplicit: false,
    mechanismTabDebtSharePercent: 80,
    mechanismTabEquitySharePercent: 20,
    fundingSummaryTabEquitySharePercent: 70,
    fundingSummaryTabDebtSharePercent: 30
  }
} as const

export const WORKBOOK_RECONCILIATION_FLAGS = [
  'DRI detailed annual depreciation is EUR 33,020,570, while COMFAR reference-year depreciation is EUR 26,727,770.59; the EUR 6,292,799.41 difference needs an asset-by-asset/year schedule bridge.',
  'DRI COMFAR total uses exceed total financing sources by EUR 18,632,333.14; the gap is not a funded source in the COMFAR sources table.',
  'The integrated cash-flow workbook includes net profit from an existing 700,000 t/y rolling line and a separate uplift after steelmaking starts; those are not the HRCR200 200,000 t/y project.',
  'HRCR200 financing tabs conflict: the mechanism tab implies 80% debt/20% equity, while the funding summary and general specification imply 30% debt/70% equity. Preserve the selected benchmark only as provisional until the sponsor confirms the intended structure.',
  'HRCR200 funding summary sources exceed construction uses including capitalized interest by 0.641470533 million IRR; this small difference may be rounding but is not silently adjusted.'
] as const
