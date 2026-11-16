/**
 * HRCR200 COMFAR III Expert output transcribed from the original PDF report.
 * Amounts are million IRR. This is a source fixture, not a claim that the current
 * Pishran model already matches these values.
 *
 * Source pages: project cash flows 67–71; income statement 82–85;
 * projected balance sheet 89–93; summary metrics 1–2.
 */
export const HRCR200_COMFAR_OUTPUT_REFERENCE = {
  source: {
    file: 'COMFAR III - 001 - 02 - 1403.12.22 - NORD KALA - HRCR200.pdf',
    projectCashFlowPages: [67, 68, 69, 70, 71],
    incomeStatementPages: [82, 83, 84, 85],
    balanceSheetPages: [89, 90, 91, 92, 93],
    summaryPages: [1, 2],
    currency: 'million IRR',
    valuationDate: '12/1404'
  },
  summary: {
    projectNpvAt25Percent: 31_399_764.27,
    projectIrrPercent: 48.31,
    projectMirrPercent: 28.03,
    normalPaybackYears: 3.86,
    discountedPaybackYears: 5.02,
    equityNpvAt30Percent: 23_579_675.01,
    equityIrrPercent: 57.99,
    equityMirrPercent: 30.90
  },
  projectCashFlows: [
    { year: 1403, inflows: 0, outflows: 13_907_805.03, net: -13_907_805.03, presentValue: -17_384_756.29 },
    { year: 1404, inflows: 0, outflows: 8_093_664.03, net: -8_093_664.03, presentValue: -8_093_664.03 },
    { year: 1405, inflows: 43_581_720, outflows: 33_979_377.41, net: 9_602_342.59, presentValue: 7_681_874.07 },
    { year: 1406, inflows: 49_807_680, outflows: 35_355_886.20, net: 14_451_793.80, presentValue: 9_249_148.03 },
    { year: 1407, inflows: 56_033_640, outflows: 39_668_935.15, net: 16_364_704.85, presentValue: 8_378_728.89 },
    { year: 1408, inflows: 62_259_600, outflows: 43_956_492.24, net: 18_303_107.76, presentValue: 7_496_952.94 },
    { year: 1409, inflows: 62_259_600, outflows: 43_546_749.32, net: 18_712_850.68, presentValue: 6_131_826.91 },
    { year: 1410, inflows: 62_259_600, outflows: 47_235_535.18, net: 15_024_064.82, presentValue: 3_938_468.45 },
    { year: 1411, inflows: 62_259_600, outflows: 47_235_535.18, net: 15_024_064.82, presentValue: 3_150_774.76 },
    { year: 1412, inflows: 62_259_600, outflows: 47_235_535.18, net: 15_024_064.82, presentValue: 2_520_619.81 },
    { year: 1413, inflows: 62_259_600, outflows: 47_235_535.18, net: 15_024_064.82, presentValue: 2_016_495.85 },
    { year: 1414, inflows: 62_259_600, outflows: 47_540_053.20, net: 14_719_546.80, presentValue: 1_580_499.30 },
    { year: 1415, inflows: 62_259_600, outflows: 47_540_053.20, net: 14_719_546.80, presentValue: 1_264_399.44 },
    { year: 1416, inflows: 62_259_600, outflows: 47_540_053.20, net: 14_719_546.80, presentValue: 1_011_519.55 },
    { year: 1417, inflows: 62_259_600, outflows: 47_541_128.22, net: 14_718_471.78, presentValue: 809_156.54 },
    { year: 1418, inflows: 62_259_600, outflows: 47_549_576.90, net: 14_710_023.10, presentValue: 646_953.66 },
    { year: 1419, inflows: 62_259_600, outflows: 47_551_575.46, net: 14_708_024.54, presentValue: 517_492.61 },
    { year: 1420, inflows: 13_735_466.82, outflows: 0, net: 13_735_466.82, presentValue: 483_273.78 }
  ],
  financing: {
    originalConstructionLoanPrincipal: 5_610_850.80,
    capitalizedConstructionInterest: 3_298_633.06,
    longTermDebtAfterConstruction: 8_909_484.06,
    constructionEquity: 13_091_985.00,
    operatingWorkingCapitalEquity: 3_309_144.53,
    operatingWorkingCapitalLoan: 0,
    totalEquityCapital: 16_401_129.53,
    annualSchedule: [
      { year: 1403, equityContribution: 8_905_157.30, debtAddition: 5_002_647.728981, principalRepayment: 0, closingDebt: 5_002_647.73 },
      { year: 1404, equityContribution: 4_186_827.70, debtAddition: 3_906_836.328126, principalRepayment: 0, closingDebt: 8_909_484.06 },
      { year: 1405, equityContribution: 3_309_144.53, debtAddition: 0, principalRepayment: 964_925.632872, closingDebt: 7_944_558.42 },
      { year: 1406, equityContribution: 0, debtAddition: 0, principalRepayment: 1_264_820.669515, closingDebt: 6_679_737.75 },
      { year: 1407, equityContribution: 0, debtAddition: 0, principalRepayment: 1_657_921.886966, closingDebt: 5_021_815.87 },
      { year: 1408, equityContribution: 0, debtAddition: 0, principalRepayment: 2_173_197.394327, closingDebt: 2_848_618.47 },
      { year: 1409, equityContribution: 0, debtAddition: 0, principalRepayment: 2_848_618.473426, closingDebt: 0 },
      { year: 1410, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1411, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1412, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1413, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1414, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1415, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1416, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1417, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1418, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 },
      { year: 1419, equityContribution: 0, debtAddition: 0, principalRepayment: 0, closingDebt: 0 }
    ]
  },
  depreciationSchedule: [
    { year: 1405, depreciation: 1_432_554.34 },
    { year: 1406, depreciation: 1_432_554.34 },
    { year: 1407, depreciation: 1_432_554.34 },
    { year: 1408, depreciation: 1_425_537.64 },
    { year: 1409, depreciation: 1_365_962.59 },
    { year: 1410, depreciation: 1_316_912.59 },
    { year: 1411, depreciation: 1_316_912.59 },
    { year: 1412, depreciation: 1_316_912.59 },
    { year: 1413, depreciation: 1_316_912.59 },
    { year: 1414, depreciation: 98_840.49 },
    { year: 1415, depreciation: 98_840.49 },
    { year: 1416, depreciation: 98_840.49 },
    { year: 1417, depreciation: 94_540.41 },
    { year: 1418, depreciation: 60_745.69 },
    { year: 1419, depreciation: 52_751.46 }
  ],
  constructionSchedule: [
    { year: 1403, fixedInvestment: 12_649_705.20, preOperatingCost: 0, capitalizedInterest: 1_258_099.83, cashLoanDrawdown: 3_744_547.90, equityContribution: 8_905_157.30 },
    { year: 1404, fixedInvestment: 5_813_303.80, preOperatingCost: 239_827.00, capitalizedInterest: 2_040_533.23, cashLoanDrawdown: 1_866_303.10, equityContribution: 4_186_827.70 },
    { year: 1405, fixedInvestment: 0, preOperatingCost: 0, capitalizedInterest: 0, cashLoanDrawdown: 0, equityContribution: 3_309_144.53 }
  ],
  workingCapitalSchedule: [
    { year: 1405, inventory: 3_108_516.19, minimumCash: 200_628.34, currentAssets: 3_309_144.53, changeInWorkingCapital: 3_309_144.53 },
    { year: 1406, inventory: 3_511_936.83, minimumCash: 206_423.78, currentAssets: 3_718_360.61, changeInWorkingCapital: 409_216.09 },
    { year: 1407, inventory: 3_946_782.02, minimumCash: 212_746.09, currentAssets: 4_159_528.11, changeInWorkingCapital: 441_167.49 },
    { year: 1408, inventory: 4_381_627.22, minimumCash: 219_068.38, currentAssets: 4_600_695.60, changeInWorkingCapital: 441_167.49 },
    { year: 1409, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: -5_325.23 },
    { year: 1410, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1411, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1412, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1413, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1414, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1415, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1416, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1417, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1418, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 },
    { year: 1419, inventory: 4_376_389.79, minimumCash: 218_980.57, currentAssets: 4_595_370.36, changeInWorkingCapital: 0 }
  ],
  terminalRecovery: {
    year: 1420,
    remainingNetFixedAssets: 9_140_096.46,
    workingCapitalRecovery: 4_595_370.36,
    totalTerminalInflows: 13_735_466.82
  },
  incomeStatement: [
    { year: 1405, revenue: 43_581_720, variableCosts: 29_106_327.74, fixedCosts: 2_518_570.57, financingCosts: 2_399_043.44, profitBeforeTax: 9_557_778.26, tax: 477_888.91, netProfit: 9_079_889.35 },
    { year: 1406, revenue: 49_807_680, variableCosts: 33_264_374.56, fixedCosts: 2_518_570.57, financingCosts: 2_099_148.40, profitBeforeTax: 11_925_586.47, tax: 596_279.32, netProfit: 11_329_307.15 },
    { year: 1407, revenue: 56_033_640, variableCosts: 37_422_421.38, fixedCosts: 2_518_570.57, financingCosts: 1_706_047.18, profitBeforeTax: 14_386_600.87, tax: 719_330.04, netProfit: 13_667_270.83 },
    { year: 1408, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_511_553.87, financingCosts: 1_190_771.67, profitBeforeTax: 16_976_806.26, tax: 848_840.31, netProfit: 16_127_965.95 },
    { year: 1409, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_451_978.82, financingCosts: 515_350.59, profitBeforeTax: 17_711_802.39, tax: 885_590.12, netProfit: 16_826_212.27 },
    { year: 1410, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_402_928.82, financingCosts: 0, profitBeforeTax: 18_276_202.98, tax: 4_569_050.75, netProfit: 13_707_152.24 },
    { year: 1411, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_402_928.82, financingCosts: 0, profitBeforeTax: 18_276_202.98, tax: 4_569_050.75, netProfit: 13_707_152.24 },
    { year: 1412, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_402_928.82, financingCosts: 0, profitBeforeTax: 18_276_202.98, tax: 4_569_050.75, netProfit: 13_707_152.24 },
    { year: 1413, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 2_402_928.82, financingCosts: 0, profitBeforeTax: 18_276_202.98, tax: 4_569_050.75, netProfit: 13_707_152.24 },
    { year: 1414, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_184_856.72, financingCosts: 0, profitBeforeTax: 19_494_275.08, tax: 4_873_568.77, netProfit: 14_620_706.31 },
    { year: 1415, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_184_856.72, financingCosts: 0, profitBeforeTax: 19_494_275.08, tax: 4_873_568.77, netProfit: 14_620_706.31 },
    { year: 1416, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_184_856.72, financingCosts: 0, profitBeforeTax: 19_494_275.08, tax: 4_873_568.77, netProfit: 14_620_706.31 },
    { year: 1417, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_180_556.64, financingCosts: 0, profitBeforeTax: 19_498_575.16, tax: 4_874_643.79, netProfit: 14_623_931.37 },
    { year: 1418, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_146_761.92, financingCosts: 0, profitBeforeTax: 19_532_369.88, tax: 4_883_092.47, netProfit: 14_649_277.41 },
    { year: 1419, revenue: 62_259_600, variableCosts: 41_580_468.20, fixedCosts: 1_138_767.69, financingCosts: 0, profitBeforeTax: 19_540_364.11, tax: 4_885_091.03, netProfit: 14_655_273.08 }
  ],
  balanceSheet: [
    { year: 1403, totalAssets: 13_907_805.03, currentAssets: 0, netFixedAssets: 13_907_805.03, currentLiabilities: 0, longTermDebt: 5_002_647.73, paidInCapital: 8_905_157.30, retainedEarningsBeginning: 0, currentYearProfit: 0, netWorth: 8_905_157.30 },
    { year: 1404, totalAssets: 22_001_469.06, currentAssets: 0, netFixedAssets: 22_001_469.06, currentLiabilities: 0, longTermDebt: 8_909_484.06, paidInCapital: 13_091_985, retainedEarningsBeginning: 0, currentYearProfit: 0, netWorth: 13_091_985 },
    { year: 1405, totalAssets: 33_425_577.30, currentAssets: 12_856_662.58, netFixedAssets: 20_568_914.72, currentLiabilities: 0, longTermDebt: 7_944_558.42, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 0, currentYearProfit: 9_079_889.35, netWorth: 25_481_018.88 },
    { year: 1406, totalAssets: 43_490_063.78, currentAssets: 24_353_703.40, netFixedAssets: 19_136_360.38, currentLiabilities: 0, longTermDebt: 6_679_737.75, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 9_079_889.35, currentYearProfit: 11_329_307.15, netWorth: 36_810_326.03 },
    { year: 1407, totalAssets: 55_499_412.72, currentAssets: 37_795_606.68, netFixedAssets: 17_703_806.05, currentLiabilities: 0, longTermDebt: 5_021_815.87, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 20_409_196.50, currentYearProfit: 13_667_270.83, netWorth: 50_477_596.85 },
    { year: 1408, totalAssets: 69_454_181.27, currentAssets: 53_175_912.86, netFixedAssets: 16_278_268.41, currentLiabilities: 0, longTermDebt: 2_848_618.47, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 34_076_467.32, currentYearProfit: 16_127_965.95, netWorth: 66_605_562.80 },
    { year: 1409, totalAssets: 83_431_775.07, currentAssets: 68_519_469.25, netFixedAssets: 14_912_305.82, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 50_204_433.27, currentYearProfit: 16_826_212.27, netWorth: 83_431_775.07 },
    { year: 1410, totalAssets: 97_138_927.31, currentAssets: 83_543_534.07, netFixedAssets: 13_595_393.24, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 67_030_645.54, currentYearProfit: 13_707_152.24, netWorth: 97_138_927.31 },
    { year: 1411, totalAssets: 110_846_079.55, currentAssets: 98_567_598.90, netFixedAssets: 12_278_480.65, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 80_737_797.78, currentYearProfit: 13_707_152.24, netWorth: 110_846_079.55 },
    { year: 1412, totalAssets: 124_553_231.78, currentAssets: 113_591_663.72, netFixedAssets: 10_961_568.06, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 94_444_950.02, currentYearProfit: 13_707_152.24, netWorth: 124_553_231.78 },
    { year: 1413, totalAssets: 138_260_384.02, currentAssets: 128_615_728.54, netFixedAssets: 9_644_655.48, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 108_152_102.25, currentYearProfit: 13_707_152.24, netWorth: 138_260_384.02 },
    { year: 1414, totalAssets: 152_881_090.33, currentAssets: 143_335_275.34, netFixedAssets: 9_545_814.99, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 121_859_254.49, currentYearProfit: 14_620_706.31, netWorth: 152_881_090.33 },
    { year: 1415, totalAssets: 167_501_796.65, currentAssets: 158_054_822.14, netFixedAssets: 9_446_974.50, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 136_479_960.80, currentYearProfit: 14_620_706.31, netWorth: 167_501_796.65 },
    { year: 1416, totalAssets: 182_122_502.96, currentAssets: 172_774_368.94, netFixedAssets: 9_348_134.02, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 151_100_667.12, currentYearProfit: 14_620_706.31, netWorth: 182_122_502.96 },
    { year: 1417, totalAssets: 196_746_434.33, currentAssets: 187_492_840.72, netFixedAssets: 9_253_593.61, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 165_721_373.43, currentYearProfit: 14_623_931.37, netWorth: 196_746_434.33 },
    { year: 1418, totalAssets: 211_395_711.74, currentAssets: 202_202_863.82, netFixedAssets: 9_192_847.92, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 180_345_304.80, currentYearProfit: 14_649_277.41, netWorth: 211_395_711.74 },
    { year: 1419, totalAssets: 226_050_984.82, currentAssets: 216_910_888.36, netFixedAssets: 9_140_096.46, currentLiabilities: 0, longTermDebt: 0, paidInCapital: 16_401_129.53, retainedEarningsBeginning: 194_994_582.21, currentYearProfit: 14_655_273.08, netWorth: 226_050_984.82 }
  ]
} as const
