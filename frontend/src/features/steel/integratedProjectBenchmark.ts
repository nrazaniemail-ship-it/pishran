export const INTEGRATED_COMFAR_REFERENCE = {
  currency: 'EUR',
  driCapacityTpy: 1_760_000,
  slabCapacityTpy: 1_200_000,
  fixedInvestment: 453_858_298,
  preproductionNet: 6_624_027,
  capitalizedInterest: 110_500_000,
  workingCapital: 68_155_775.89,
  totalInvestment: 639_138_100.89,
  equity: 139_982_325,
  longTermDebt: 431_000_000,
  shortTermDebt: 49_523_442.75,
  totalSources: 620_505_767.75,
  fundingGap: 18_632_333.14,
  referenceRevenue: 887_300_000,
  referenceFactoryCost: 643_963_499,
  referenceDepreciation: 26_727_770.59,
  projectNpvAt25: 19_964_251.38,
  projectIrr: 26.08,
  equityNpvAt30: 60_342_720.87,
  equityIrr: 40.51
} as const

// Nineteen annual net project cash-flow periods transcribed from the COMFAR control schedule.
export const INTEGRATED_COMFAR_PROJECT_CASH_FLOWS = [
  -104334839.16, -134611066.5, -133093260.44, -88443158.9,
  118750252.05, 187903947.73, 212720544.14, 226437947.52,
  189562697.38, 188965374.62, 188908346.68, 188860859.67,
  188801551.02, 188800575.77, 188798288.88, 188797422.7,
  188797422.7, 188797422.7, 413501431.09
] as const

export function calculateComfarFundingGap() {
  const uses = INTEGRATED_COMFAR_REFERENCE.fixedInvestment
    + INTEGRATED_COMFAR_REFERENCE.preproductionNet
    + INTEGRATED_COMFAR_REFERENCE.capitalizedInterest
    + INTEGRATED_COMFAR_REFERENCE.workingCapital
  const sources = INTEGRATED_COMFAR_REFERENCE.equity
    + INTEGRATED_COMFAR_REFERENCE.longTermDebt
    + INTEGRATED_COMFAR_REFERENCE.shortTermDebt
  return { uses, sources, gap: uses - sources }
}
