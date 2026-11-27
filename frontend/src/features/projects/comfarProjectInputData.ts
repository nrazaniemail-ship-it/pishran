import type { FixedInvestmentAssetClass } from './projectFoundation'

export type ComfarSourceCapexItem = {
  name: string
  assetClass: FixedInvestmentAssetClass
  periods: { period: string; amount: number }[]
}
export type ComfarSourceWorkingCapitalPeriod = {
  period: string
  inventory: number
  cash: number
  payables?: number
}
export type ComfarSourceInputData = {
  fixedInvestment: ComfarSourceCapexItem[]
  preproduction: { period: string; net: number; capitalizedInterest: number }[]
  operatingCostYear: number
  operatingCostSchedule?: { period:string; rows:{ name:string; amount:number }[] }[]
  variableCostSharePercentByPeriod?: { period:string; percent:number }[]
  salesUnitPrice?: number
  salesPriceSource?: string
  productionSalesSchedule?: { period: string; openingInventory: number; production: number; sales: number; closingInventory: number; netUnitPrice: number; salesRevenue: number }[]
  byproductSalesSchedule?: { productName:string; period:string; openingInventory:number; production:number; sales:number; closingInventory:number; netUnitPrice:number; salesRevenue:number }[]
  financingSchedule?: { period: string; loanType?: 'long-term' | 'short-term'; loanDisbursement: number; principalRepayment: number; interestExpense: number; capitalizedInterest: number; closingDebt: number }[]
  depreciationSchedule?: { period: string; totalDepreciation: number }[]
  taxAmountSchedule?: { period:string; amount:number; sourceReference:string }[]
  equityContributionSchedule?: { period:string; amount:number }[]
  otherIncomeSchedule?: { period:string; amount:number; sourceReference:string }[]
  variableCostSharePercent: number
  foreignFixedInvestmentSharePercent: number
  capacityUtilization?: number[]
  operatingCostRows: { name: string; amount: number }[]
  workingCapital: ComfarSourceWorkingCapitalPeriod[]
  missingSourceDetails: string[]
}

/**
 * Source-derived input schedules transcribed from the attached COMFAR III reports.
 * Amounts remain in each report's accounting currency; no FX conversion is inferred.
 * Missing engineering and financing assumptions are deliberately left unfilled.
 */
export const COMFAR_PROJECT_INPUTS: Record<string, ComfarSourceInputData> = {
  'comfar-hr-coil-200k': {
    fixedInvestment: [
      { name: 'خرید زمین', assetClass: 'land', periods: [{ period: '1403', amount: 2015000 }] },
      { name: 'محوطه‌سازی و بهبود زمین', assetClass: 'site', periods: [{ period: '1403', amount: 301005.60 }, { period: '1404', amount: 129002.40 }] },
      { name: 'کارهای عمرانی، بنا و ساختمان‌ها', assetClass: 'buildings', periods: [{ period: '1403', amount: 1084284.40 }, { period: '1404', amount: 1313137.60 }] },
      { name: 'ماشین‌آلات و تجهیزات کارخانه', assetClass: 'machinery', periods: [{ period: '1403', amount: 8087192 }, { period: '1404', amount: 2385548 }] },
      { name: 'تجهیزات خدماتی و جانبی کارخانه', assetClass: 'infrastructure', periods: [{ period: '1403', amount: 722627.70 }, { period: '1404', amount: 1546020.30 }] },
      { name: 'هزینه‌های احتمالی', assetClass: 'other', periods: [{ period: '1403', amount: 439595.50 }, { period: '1404', amount: 439595.50 }] },
    ],
    preproduction: [
      { period: '1403', net: 71948.10, capitalizedInterest: 1186151.73 },
      { period: '1404', net: 167878.90, capitalizedInterest: 2112481.33 },
    ],
    operatingCostYear: 1408,
    operatingCostSchedule: [{"period":"1405","rows":[{"name":"مواد خام","amount":28988098.13},{"name":"انرژی","amount":206977.53},{"name":"قطعات یدکی مصرف‌شده","amount":135492.82},{"name":"تعمیرات و نگهداری","amount":287732.4},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":135974.21}]},{"period":"1406","rows":[{"name":"مواد خام","amount":32732157.78},{"name":"انرژی","amount":226746.73},{"name":"قطعات یدکی مصرف‌شده","amount":148434.24},{"name":"تعمیرات و نگهداری","amount":315214.8},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":143264.46}]},{"period":"1407","rows":[{"name":"مواد خام","amount":36816586.48},{"name":"انرژی","amount":248313.13},{"name":"قطعات یدکی مصرف‌شده","amount":162552.16},{"name":"تعمیرات و نگهداری","amount":345195.6},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":151217.46}]},{"period":"1408","rows":[{"name":"مواد خام","amount":40901015.18},{"name":"انرژی","amount":269879.53},{"name":"قطعات یدکی مصرف‌شده","amount":176670.08},{"name":"تعمیرات و نگهداری","amount":375176.4},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159170.46}]},{"period":"1409","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1410","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1411","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1412","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1413","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1414","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1415","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1416","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1417","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1418","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]},{"period":"1419","rows":[{"name":"مواد خام","amount":40844287},{"name":"انرژی","amount":269580},{"name":"قطعات یدکی مصرف‌شده","amount":176474},{"name":"تعمیرات و نگهداری","amount":374760},{"name":"دستمزد","amount":650052.86},{"name":"بالاسری دستمزد","amount":130010.57},{"name":"سربار کارخانه","amount":159060}]}],
    capacityUtilization: [70, 80, 90, 100],
    salesUnitPrice: 307,
    salesPriceSource: 'گزارش مرجع، صفحه ۳۵؛ میانگین قیمت فروش خالص هر تن',
    productionSalesSchedule: [{"period":"1405","openingInventory":0,"production":141944.44,"sales":140000,"closingInventory":1944.44,"netUnitPrice":307,"salesRevenue":42980000},{"period":"1406","openingInventory":1944.44,"production":160277.78,"sales":160000,"closingInventory":2222.22,"netUnitPrice":307,"salesRevenue":49120000},{"period":"1407","openingInventory":2222.22,"production":180277.78,"sales":180000,"closingInventory":2500,"netUnitPrice":307,"salesRevenue":55260000},{"period":"1408","openingInventory":2500,"production":200277.78,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1409","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1410","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1411","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1412","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1413","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1414","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1415","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1416","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1417","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1418","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000},{"period":"1419","openingInventory":2777.78,"production":200000,"sales":200000,"closingInventory":2777.78,"netUnitPrice":307,"salesRevenue":61400000}],
    byproductSalesSchedule: [{"productName":"Scrape#","period":"1405","openingInventory":0,"production":2838.89,"sales":2800,"closingInventory":38.89,"netUnitPrice":214.9,"salesRevenue":601720},{"productName":"Scrape#","period":"1406","openingInventory":38.89,"production":3205.56,"sales":3200,"closingInventory":44.44,"netUnitPrice":214.9,"salesRevenue":687680},{"productName":"Scrape#","period":"1407","openingInventory":44.44,"production":3605.56,"sales":3600,"closingInventory":50,"netUnitPrice":214.9,"salesRevenue":773640},{"productName":"Scrape#","period":"1408","openingInventory":50,"production":4005.56,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1409","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1410","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1411","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1412","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1413","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1414","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1415","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1416","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1417","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1418","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600},{"productName":"Scrape#","period":"1419","openingInventory":55.56,"production":4000,"sales":4000,"closingInventory":55.56,"netUnitPrice":214.9,"salesRevenue":859600}],
    financingSchedule: [{"period":"1403","loanDisbursement":3816496,"principalRepayment":0,"interestExpense":0,"capitalizedInterest":1186151.73,"closingDebt":5002647.73},{"period":"1404","loanDisbursement":1794355,"principalRepayment":0,"interestExpense":0,"capitalizedInterest":2112481.33,"closingDebt":8909484.06},{"period":"1405","loanDisbursement":0,"principalRepayment":964925.63,"interestExpense":2399043.44,"capitalizedInterest":0,"closingDebt":7944558.42},{"period":"1406","loanDisbursement":0,"principalRepayment":1264820.67,"interestExpense":2099148.4,"capitalizedInterest":0,"closingDebt":6679737.75},{"period":"1407","loanDisbursement":0,"principalRepayment":1657921.89,"interestExpense":1706047.18,"capitalizedInterest":0,"closingDebt":5021815.87},{"period":"1408","loanDisbursement":0,"principalRepayment":2173197.39,"interestExpense":1190771.67,"capitalizedInterest":0,"closingDebt":2848618.47},{"period":"1409","loanDisbursement":0,"principalRepayment":2848618.47,"interestExpense":515350.59,"capitalizedInterest":0,"closingDebt":0}],
    depreciationSchedule: [{"period":"1405","totalDepreciation":1432554.34},{"period":"1406","totalDepreciation":1432554.34},{"period":"1407","totalDepreciation":1432554.34},{"period":"1408","totalDepreciation":1425537.64},{"period":"1409","totalDepreciation":1365962.59},{"period":"1410","totalDepreciation":1316912.59},{"period":"1411","totalDepreciation":1316912.59},{"period":"1412","totalDepreciation":1316912.59},{"period":"1413","totalDepreciation":98840.49},{"period":"1414","totalDepreciation":98840.49},{"period":"1415","totalDepreciation":98840.49},{"period":"1416","totalDepreciation":98840.49},{"period":"1417","totalDepreciation":94540.41},{"period":"1418","totalDepreciation":60745.69},{"period":"1419","totalDepreciation":52751.46}],
    otherIncomeSchedule: [
      {period:'1420',amount:13735466.82,sourceReference:'COMFAR III Expert, pages 62 and 71, other-income row (liquidation period)'},
    ],
    taxAmountSchedule: [
      {period:'1403',amount:0,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1404',amount:0,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1405',amount:477888.91,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1406',amount:596279.32,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1407',amount:719330.04,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1408',amount:848840.31,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1409',amount:885590.12,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1410',amount:4569050.75,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1411',amount:4569050.75,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1412',amount:4569050.75,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1413',amount:4569050.75,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1414',amount:4873568.77,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1415',amount:4873568.77,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1416',amount:4873568.77,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1417',amount:4874643.79,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1418',amount:4883092.47,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1419',amount:4885091.03,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
      {period:'1420',amount:0,sourceReference:'COMFAR III Expert, pages 59–62 and 67–71, corporate income-tax row'},
    ],
    variableCostSharePercent: 91.83,
    foreignFixedInvestmentSharePercent: 43.19,
    operatingCostRows: [
      { name: 'مواد خام', amount: 40901015.18 },
      { name: 'ملزومات کارخانه', amount: 0 },
      { name: 'یوتیلیتی', amount: 0 },
      { name: 'انرژی', amount: 269879.53 },
      { name: 'قطعات یدکی مصرف‌شده', amount: 176670.08 },
      { name: 'تعمیرات و نگهداری', amount: 375176.40 },
      { name: 'حق امتیاز', amount: 0 },
      { name: 'دستمزد', amount: 650052.86 },
      { name: 'هزینه‌های بالاسری دستمزد', amount: 130010.57 },
      { name: 'سربار کارخانه', amount: 159170.46 },
      { name: 'بازاریابی مستقیم', amount: 62260 },
    ],
    workingCapital: [
      { period: '1403', inventory: 0, cash: 0 },
      { period: '1404', inventory: 0, cash: 0 },
      { period: '1405', inventory: 3108516.19, cash: 200628.34 },
      { period: '1406', inventory: 3511936.83, cash: 206423.78 },
      { period: '1407', inventory: 3946782.02, cash: 212746.08 },
      { period: '1408', inventory: 4381627.22, cash: 219068.38 },
      ...Array.from({ length: 12 }, (_, index) => ({ period: String(1409 + index), inventory: 4376389.79, cash: 218980.57 })),
    ],
    missingSourceDetails: ['مقادیر فیزیکی مواد اولیه و ضرایب مصرف ویژه', 'مقادیر مصرف آب، برق و گاز به تفکیک تجهیز', 'عمر مفید و روش استهلاک تفکیکی هر دارایی', 'نرخ سود، دوره تنفس و قرارداد تفصیلی تسهیلات'],
  },
  'comfar-hr-plate-250k': {
    fixedInvestment: [
      { name: 'خرید زمین', assetClass: 'land', periods: [{ period: '1403', amount: 1000000 }] },
      { name: 'محوطه‌سازی و بهبود زمین', assetClass: 'site', periods: [{ period: '1403', amount: 75700 }] },
      { name: 'کارهای عمرانی، بنا و ساختمان‌ها', assetClass: 'buildings', periods: [{ period: '1402', amount: 427314.60 }, { period: '1403', amount: 932876.40 }] },
      { name: 'ماشین‌آلات و تجهیزات کارخانه', assetClass: 'machinery', periods: [{ period: '1402', amount: 4570408.32 }, { period: '1403', amount: 4253281.52 }] },
      { name: 'تجهیزات خدماتی و جانبی کارخانه', assetClass: 'infrastructure', periods: [{ period: '1402', amount: 638634 }, { period: '1403', amount: 1214646 }] },
      { name: 'هزینه‌های احتمالی', assetClass: 'other', periods: [{ period: '1402', amount: 107229.50 }, { period: '1403', amount: 107229.50 }] },
    ],
    preproduction: [
      { period: '1402', net: 214460.80, capitalizedInterest: 1787136.19 },
      { period: '1403', net: 53615.20, capitalizedInterest: 3627653.13 },
      { period: '1404', net: 0, capitalizedInterest: 3738117.99 },
    ],
    operatingCostYear: 1407,
    variableCostSharePercent: 87.62,
    foreignFixedInvestmentSharePercent: 38.07,
    operatingCostRows: [
      { name: 'مواد خام', amount: 38162283.50 },
      { name: 'ملزومات کارخانه', amount: 0 },
      { name: 'یوتیلیتی', amount: 0 },
      { name: 'انرژی', amount: 347779.50 },
      { name: 'قطعات یدکی مصرف‌شده', amount: 551805.14 },
      { name: 'تعمیرات و نگهداری', amount: 236488.06 },
      { name: 'حق امتیاز', amount: 0 },
      { name: 'دستمزد', amount: 653708 },
      { name: 'هزینه‌های بالاسری دستمزد', amount: 130742 },
      { name: 'سربار کارخانه', amount: 154777.98 },
    ],
    workingCapital: [
      { period: '1404', inventory: 1313822.72, cash: 91388.51, payables: 1172.42 },
      { period: '1405', inventory: 1491745.91, cash: 93535.11, payables: 1287.98 },
      { period: '1406', inventory: 1675054.83, cash: 95755.72, payables: 1410.56 },
      { period: '1407', inventory: 1858363.74, cash: 97976.34, payables: 1533.13 },
      ...Array.from({ length: 11 }, (_, index) => ({ period: String(1408 + index), inventory: 1857466.12, cash: 97964, payables: 1532.11 })),
    ],
    salesUnitPrice: 193.58,
    salesPriceSource: 'COMFAR III Expert، صفحات ۳۵ تا ۳۷؛ میانگین قیمت فروش خالص هر تن Plate',
    productionSalesSchedule: [
      { period: '1404', openingInventory: 0, production: 175972.22, sales: 175000, closingInventory: 972.22, netUnitPrice: 193.58, salesRevenue: 33876500 },
      { period: '1405', openingInventory: 972.22, production: 200138.89, sales: 200000, closingInventory: 1111.11, netUnitPrice: 193.58, salesRevenue: 38716000 },
      { period: '1406', openingInventory: 1111.11, production: 225138.89, sales: 225000, closingInventory: 1250, netUnitPrice: 193.58, salesRevenue: 43555500 },
      { period: '1407', openingInventory: 1250, production: 250138.89, sales: 250000, closingInventory: 1388.89, netUnitPrice: 193.58, salesRevenue: 48395000 },
      ...Array.from({ length: 11 }, (_, index) => ({ period: String(1408 + index), openingInventory: 1388.89, production: 250000, sales: 250000, closingInventory: 1388.89, netUnitPrice: 193.58, salesRevenue: 48395000 })),
    ],
    byproductSalesSchedule: [
      { productName: 'Scrape#', period: '1404', openingInventory: 0, production: 21996.53, sales: 21875, closingInventory: 121.53, netUnitPrice: 130.90, salesRevenue: 2863437.50 },
      { productName: 'Scrape#', period: '1405', openingInventory: 121.53, production: 25017.36, sales: 25000, closingInventory: 138.89, netUnitPrice: 130.90, salesRevenue: 3272500 },
      { productName: 'Scrape#', period: '1406', openingInventory: 138.89, production: 28142.36, sales: 28125, closingInventory: 156.25, netUnitPrice: 130.90, salesRevenue: 3681562.50 },
      { productName: 'Scrape#', period: '1407', openingInventory: 156.25, production: 31267.36, sales: 31250, closingInventory: 173.61, netUnitPrice: 130.90, salesRevenue: 4090625 },
      ...Array.from({ length: 11 }, (_, index) => ({ productName: 'Scrape#', period: String(1408 + index), openingInventory: 173.61, production: 31250, sales: 31250, closingInventory: 173.61, netUnitPrice: 130.90, salesRevenue: 4090625 })),
    ],
    financingSchedule: [
      { period: '1402', loanDisbursement: 6238555.38, principalRepayment: 0, interestExpense: 0, capitalizedInterest: 1787136.19, closingDebt: 8025691.57 },
      { period: '1403', loanDisbursement: 4637761.30, principalRepayment: 0, interestExpense: 0, capitalizedInterest: 3627653.13, closingDebt: 16291106 },
      { period: '1404', loanDisbursement: 1317715.93, principalRepayment: 520657.43, interestExpense: 1315266.57, capitalizedInterest: 3738117.98, closingDebt: 20826282.49 },
      { period: '1405', loanDisbursement: 0, principalRepayment: 2569900.33, interestExpense: 5173346.32, capitalizedInterest: 0, closingDebt: 18256382.16 },
      { period: '1406', loanDisbursement: 0, principalRepayment: 3307401.34, interestExpense: 4435845.31, capitalizedInterest: 0, closingDebt: 14948980.82 },
      { period: '1407', loanDisbursement: 0, principalRepayment: 4256556.14, interestExpense: 3486690.51, capitalizedInterest: 0, closingDebt: 10692424.68 },
      { period: '1408', loanDisbursement: 0, principalRepayment: 5478109.23, interestExpense: 2265137.42, capitalizedInterest: 0, closingDebt: 5214315.46 },
      { period: '1409', loanDisbursement: 0, principalRepayment: 5214315.46, interestExpense: 693007.19, capitalizedInterest: 0, closingDebt: 0 },
    ],
    missingSourceDetails: ['مقادیر فیزیکی اسلب و مواد مصرفی به ازای هر تن پلیت', 'مصرف ویژه آب، برق و گاز و تلفات خط', 'عمر مفید و روش استهلاک تفکیکی دارایی‌ها', 'نرخ قراردادی وام و جزئیات وثایق و کارمزد تسهیلات'],
  },
  'comfar-cold-coil-200k': {
    fixedInvestment: [
      { name: 'خرید زمین', assetClass: 'land', periods: [{ period: '1401-07', amount: 2015000 }] },
      { name: 'محوطه‌سازی و بهبود زمین', assetClass: 'site', periods: [{ period: '1401-07', amount: 764640.80 }, { period: '1402', amount: 327703.20 }] },
      { name: 'کارهای عمرانی، بنا و ساختمان‌ها', assetClass: 'buildings', periods: [{ period: '1401-07', amount: 765144.40 }, { period: '1402', amount: 1147716.60 }] },
      { name: 'ماشین‌آلات و تجهیزات کارخانه', assetClass: 'machinery', periods: [{ period: '1401-07', amount: 1986050 }, { period: '1402', amount: 6128750 }] },
      { name: 'تجهیزات خدماتی و جانبی کارخانه', assetClass: 'infrastructure', periods: [{ period: '1401-07', amount: 970850 }] },
      { name: 'هزینه‌های احتمالی', assetClass: 'other', periods: [{ period: '1401-07', amount: 68405.50 }, { period: '1402', amount: 213711.50 }] },
    ],
    preproduction: [
      { period: '1401-07', net: 90720, capitalizedInterest: 0 },
      { period: '1402', net: 211680, capitalizedInterest: 350000 },
    ],
    operatingCostYear: 1405,
    variableCostSharePercent: 95.60,
    foreignFixedInvestmentSharePercent: 48.28,
    capacityUtilization: [81.11, 90.14, 100.14, 100],
    operatingCostRows: [
      { name: 'مواد خام', amount: 63058700 },
      { name: 'ملزومات کارخانه', amount: 0 },
      { name: 'یوتیلیتی', amount: 0 },
      { name: 'انرژی', amount: 441856 },
      { name: 'قطعات یدکی مصرف‌شده', amount: 176670.08 },
      { name: 'تعمیرات و نگهداری', amount: 526809.19 },
      { name: 'حق امتیاز', amount: 0 },
      { name: 'دستمزد', amount: 187071.21 },
      { name: 'هزینه‌های بالاسری دستمزد', amount: 177872.18 },
      { name: 'سربار کارخانه', amount: 1637525 },
      { name: 'بازاریابی مستقیم', amount: 79000 },
    ],
    workingCapital: [
      { period: '1403', inventory: 2292317.03, cash: 101181.29 },
      { period: '1404', inventory: 2573679.11, cash: 103176.50 },
      { period: '1405', inventory: 2855059.33, cash: 105386.57 },
      ...Array.from({ length: 12 }, (_, index) => ({ period: String(1406 + index), inventory: 2855056.74, cash: 105355.87 })),
    ],
    salesUnitPrice: 395,
    salesPriceSource: 'COMFAR III Expert، صفحات ۲۹ تا ۳۱؛ قیمت فروش خالص متوسط هر تن کلاف سرد',
    productionSalesSchedule: [
      { period: '1403', openingInventory: 0, production: 162222.22, sales: 160000, closingInventory: 2222.22, netUnitPrice: 395, salesRevenue: 63200000 },
      { period: '1404', openingInventory: 2222.22, production: 180277.78, sales: 180000, closingInventory: 2500, netUnitPrice: 395, salesRevenue: 71100000 },
      { period: '1405', openingInventory: 2500, production: 200277.78, sales: 200000, closingInventory: 2777.78, netUnitPrice: 395, salesRevenue: 79000000 },
      ...Array.from({ length: 12 }, (_, index) => ({ period: String(1406 + index), openingInventory: 2777.78, production: 200000, sales: 200000, closingInventory: 2777.78, netUnitPrice: 395, salesRevenue: 79000000 })),
    ],
    financingSchedule: [
      { period: '1402', loanDisbursement: 5000000, principalRepayment: 0, interestExpense: 0, capitalizedInterest: 350000, closingDebt: 5350000 },
      { period: '1403', loanDisbursement: 0, principalRepayment: 1327878.79, interestExpense: 1366423.77, capitalizedInterest: 0, closingDebt: 4022121.21 },
      { period: '1404', loanDisbursement: 0, principalRepayment: 1740578.22, interestExpense: 953724.34, capitalizedInterest: 0, closingDebt: 2281542.99 },
      { period: '1405', loanDisbursement: 0, principalRepayment: 2281542.99, interestExpense: 412759.57, capitalizedInterest: 0, closingDebt: 0 },
    ],
    missingSourceDetails: ['مقادیر و مشخصات کلاف گرم ورودی و ضریب تبدیل به کلاف سرد', 'مصرف ویژه اسید، روغن نورد، آب و برق', 'عمر مفید و روش استهلاک تفکیکی دارایی‌ها', 'نرخ قراردادی و جزئیات وثایق و کارمزد تسهیلات'],
  },
  'comfar-integrated-steel-dri': {
    fixedInvestment: [
      { name: 'محوطه‌سازی و بهبود زمین', assetClass: 'site', periods: [{ period: '1401', amount: 368482.50 }, { period: '1402', amount: 466744.50 }, { period: '1403', amount: 1007185.50 }, { period: '1404', amount: 614137.50 }] },
      { name: 'کارهای عمرانی، بنا و ساختمان‌ها', assetClass: 'buildings', periods: [{ period: '1401', amount: 267692.10 }, { period: '1402', amount: 535384.20 }, { period: '1403', amount: 803076.30 }, { period: '1404', amount: 1070768.40 }] },
      { name: 'ماشین‌آلات و تجهیزات کارخانه', assetClass: 'machinery', periods: [{ period: '1401', amount: 99980360.16 }, { period: '1402', amount: 128191433.40 }, { period: '1403', amount: 123627543.84 }, { period: '1404', amount: 75505440.60 }] },
      { name: 'تجهیزات خدماتی و جانبی کارخانه', assetClass: 'infrastructure', periods: [{ period: '1401', amount: 1746184.40 }, { period: '1402', amount: 3445384.40 }, { period: '1403', amount: 5683334.80 }, { period: '1404', amount: 9280692.40 }] },
      { name: 'هزینه‌های احتمالی', assetClass: 'other', periods: [{ period: '1401', amount: 316113.25 }, { period: '1402', amount: 316113.25 }, { period: '1403', amount: 316113.25 }, { period: '1404', amount: 316113.25 }] },
    ],
    preproduction: [
      { period: '1401', net: 1656006.75, capitalizedInterest: 9760000 },
      { period: '1402', net: 1656006.75, capitalizedInterest: 22920000 },
      { period: '1403', net: 1656006.75, capitalizedInterest: 36080000 },
      { period: '1404', net: 1656006.75, capitalizedInterest: 41740000 },
    ],
    operatingCostYear: 1405,
    variableCostSharePercent: 90.91,
    variableCostSharePercentByPeriod: [
      { period: '1405', percent: 79.41 }, { period: '1406', percent: 83.57 },
      { period: '1407', percent: 87.81 }, { period: '1408', percent: 90.29 },
      { period: '1409', percent: 90.91 }, { period: '1410', percent: 91.19 },
      { period: '1411', percent: 91.22 }, { period: '1412', percent: 91.25 },
      ...Array.from({ length: 7 }, (_, index) => ({ period: String(1413 + index), percent: 91.28 })),
    ],
    operatingCostSchedule: [
      { period: '1405', rows: [
        { name: 'مواد خام', amount: 381465091.19 }, { name: 'انرژی', amount: 53384216.93 },
        { name: 'تعمیرات و نگهداری', amount: 13802562.23 }, { name: 'دستمزد', amount: 10272936 },
        { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 }, { name: 'سربار کارخانه', amount: 5678679.94 },
      ] },
      { period: '1406', rows: [
        { name: 'مواد خام', amount: 430734555.03 }, { name: 'انرژی', amount: 58483143.58 },
        { name: 'تعمیرات و نگهداری', amount: 15120896.68 }, { name: 'دستمزد', amount: 10272936 },
        { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 }, { name: 'سربار کارخانه', amount: 5983142.06 },
      ] },
      { period: '1407', rows: [
        { name: 'مواد خام', amount: 484483061.03 }, { name: 'انرژی', amount: 64045609.02 },
        { name: 'تعمیرات و نگهداری', amount: 16559079.72 }, { name: 'دستمزد', amount: 10272936 },
        { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 }, { name: 'سربار کارخانه', amount: 6315282.56 },
      ] },
      { period: '1408', rows: [
        { name: 'مواد خام', amount: 538231567.03 }, { name: 'انرژی', amount: 69608074.46 },
        { name: 'تعمیرات و نگهداری', amount: 17997262.76 }, { name: 'دستمزد', amount: 10272936 },
        { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 }, { name: 'سربار کارخانه', amount: 6647423.06 },
      ] },
      ...Array.from({ length: 11 }, (_, index) => ({
        period: String(1409 + index),
        rows: [
          { name: 'مواد خام', amount: 537485060 }, { name: 'انرژی', amount: 69530818 },
          { name: 'تعمیرات و نگهداری', amount: 17977288 }, { name: 'دستمزد', amount: 10272936 },
          { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 }, { name: 'سربار کارخانه', amount: 6642810 },
        ],
      })),
    ],
    foreignFixedInvestmentSharePercent: 54.22,
    operatingCostRows: [
      { name: 'مواد خام', amount: 537485060 },
      { name: 'ملزومات کارخانه', amount: 0 },
      { name: 'یوتیلیتی', amount: 0 },
      { name: 'انرژی', amount: 69530818 },
      { name: 'قطعات یدکی مصرف‌شده', amount: 0 },
      { name: 'تعمیرات و نگهداری', amount: 17977288 },
      { name: 'حق امتیاز', amount: 0 },
      { name: 'دستمزد', amount: 10272936 },
      { name: 'هزینه‌های بالاسری دستمزد', amount: 2054587 },
      { name: 'سربار کارخانه', amount: 6642810 },
    ],
    workingCapital: [
      { period: '1405', inventory: 44300800.78, cash: 5301460.86 },
      { period: '1406', inventory: 49933989.25, cash: 5571926.96 },
      { period: '1407', inventory: 56002162.92, cash: 5866980.88 },
      { period: '1408', inventory: 62070336.59, cash: 6162034.80 },
      ...Array.from({ length: 11 }, (_, index) => ({ period: String(1409 + index), inventory: 61997839.06, cash: 6157936.83 })),
    ],
    salesUnitPrice: 634,
    salesPriceSource: 'COMFAR III Expert؛ جدول‌های برنامه تولید و فروش Steel Slab و Extra DRI؛ یورو به ازای تن',
    productionSalesSchedule: [
      { period: '1405', openingInventory: 0, production: 851666.67, sales: 840000, closingInventory: 11666.67, netUnitPrice: 634, salesRevenue: 532560000 },
      { period: '1406', openingInventory: 11666.67, production: 961666.67, sales: 960000, closingInventory: 13333.33, netUnitPrice: 634, salesRevenue: 608640000 },
      { period: '1407', openingInventory: 13333.33, production: 1081666.67, sales: 1080000, closingInventory: 15000, netUnitPrice: 634, salesRevenue: 684720000 },
      { period: '1408', openingInventory: 15000, production: 1201666.67, sales: 1200000, closingInventory: 16666.67, netUnitPrice: 634, salesRevenue: 760800000 },
      ...Array.from({ length: 11 }, (_, index) => ({ period: String(1409 + index), openingInventory: 16666.67, production: 1200000, sales: 1200000, closingInventory: 16666.67, netUnitPrice: 634, salesRevenue: 760800000 })),
    ],
    byproductSalesSchedule: [
      { productName: 'Extra DRI', period: '1405', openingInventory: 0, production: 373111.11, sales: 368000, closingInventory: 5111.11, netUnitPrice: 275, salesRevenue: 101200000 },
      { productName: 'Extra DRI', period: '1406', openingInventory: 5111.11, production: 414638.89, sales: 414000, closingInventory: 5750, netUnitPrice: 275, salesRevenue: 113850000 },
      { productName: 'Extra DRI', period: '1407', openingInventory: 5750, production: 460638.89, sales: 460000, closingInventory: 6388.89, netUnitPrice: 275, salesRevenue: 126500000 },
      ...Array.from({ length: 12 }, (_, index) => ({ productName: 'Extra DRI', period: String(1408 + index), openingInventory: 6388.89, production: 460000, sales: 460000, closingInventory: 6388.89, netUnitPrice: 275, salesRevenue: 126500000 })),
    ],
    financingSchedule: [
      { period: '1401', loanType: 'long-term', loanDisbursement: 101000000, principalRepayment: 0, interestExpense: 9760000, capitalizedInterest: 0, closingDebt: 101000000 },
      { period: '1402', loanType: 'long-term', loanDisbursement: 135000000, principalRepayment: 0, interestExpense: 22920000, capitalizedInterest: 0, closingDebt: 236000000 },
      { period: '1403', loanType: 'long-term', loanDisbursement: 135000000, principalRepayment: 0, interestExpense: 36080000, capitalizedInterest: 0, closingDebt: 371000000 },
      { period: '1404', loanType: 'long-term', loanDisbursement: 60000000, principalRepayment: 0, interestExpense: 41740000, capitalizedInterest: 0, closingDebt: 431000000 },
      { period: '1405', loanType: 'long-term', loanDisbursement: 0, principalRepayment: 101000000, interestExpense: 31980000, capitalizedInterest: 0, closingDebt: 330000000 },
      { period: '1406', loanType: 'long-term', loanDisbursement: 0, principalRepayment: 135000000, interestExpense: 20180000, capitalizedInterest: 0, closingDebt: 195000000 },
      { period: '1407', loanType: 'long-term', loanDisbursement: 0, principalRepayment: 135000000, interestExpense: 5660000, capitalizedInterest: 0, closingDebt: 60000000 },
      { period: '1408', loanType: 'long-term', loanDisbursement: 0, principalRepayment: 60000000, interestExpense: 0, capitalizedInterest: 0, closingDebt: 0 },
      { period: '1405', loanType: 'short-term', loanDisbursement: 49523442.75, principalRepayment: 0, interestExpense: 8914219.70, capitalizedInterest: 0, closingDebt: 49523442.75 },
      { period: '1406', loanType: 'short-term', loanDisbursement: 0, principalRepayment: 12380860.69, interestExpense: 7892798.69, capitalizedInterest: 0, closingDebt: 37142582.06 },
      { period: '1407', loanType: 'short-term', loanDisbursement: 0, principalRepayment: 12380860.69, interestExpense: 5664243.76, capitalizedInterest: 0, closingDebt: 24761721.38 },
      { period: '1408', loanType: 'short-term', loanDisbursement: 0, principalRepayment: 12380860.69, interestExpense: 3435688.84, capitalizedInterest: 0, closingDebt: 12380860.69 },
      { period: '1409', loanType: 'short-term', loanDisbursement: 0, principalRepayment: 12380860.69, interestExpense: 1207133.92, capitalizedInterest: 0, closingDebt: 0 },
    ],
    depreciationSchedule: [
      { period: '1405', totalDepreciation: 38388721.26 },
      { period: '1406', totalDepreciation: 34986519.18 },
      { period: '1407', totalDepreciation: 31933067.3 },
      { period: '1408', totalDepreciation: 29194294.41 },
      { period: '1409', totalDepreciation: 26727770.59 },
      { period: '1410', totalDepreciation: 25851995.48 },
      { period: '1411', totalDepreciation: 25623883.74 },
      { period: '1412', totalDepreciation: 25433935.68 },
      { period: '1413', totalDepreciation: 25196701.1 },
      { period: '1414', totalDepreciation: 25192800.07 },
      { period: '1415', totalDepreciation: 25183652.51 },
      { period: '1416', totalDepreciation: 25180187.8 },
      { period: '1417', totalDepreciation: 25180187.8 },
      { period: '1418', totalDepreciation: 25180187.8 },
      { period: '1419', totalDepreciation: 25180187.8 },
    ],
    taxAmountSchedule: [
      { period: '1401', amount: 0, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1402', amount: 0, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1403', amount: 0, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1404', amount: 0, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1405', amount: 4687872.25, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1406', amount: 6881488.65, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1407', amount: 9254024.25, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1408', amount: 10535325.89, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1409', amount: 53850399.12, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1410', amount: 54371126.38, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1411', amount: 54428154.32, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1412', amount: 54475641.33, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1413', amount: 54534949.98, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1414', amount: 54535925.23, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1415', amount: 54538212.12, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1416', amount: 54539078.3, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1417', amount: 54539078.3, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1418', amount: 54539078.3, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
      { period: '1419', amount: 54539078.3, sourceReference: 'COMFAR III Expert؛ خلاصه و جریان نقدی مالی، صفحات ۲ و ۵۹ تا ۶۱' },
    ],
    equityContributionSchedule: [
      { period: '1401', amount: 13094839.16 },
      { period: '1402', amount: 22531066.5 },
      { period: '1403', amount: 34173260.44 },
      { period: '1404', amount: 70183158.9 },
      { period: '1405', amount: 0 },
      { period: '1406', amount: 0 },
      { period: '1407', amount: 0 },
      { period: '1408', amount: 0 },
      { period: '1409', amount: 0 },
      { period: '1410', amount: 0 },
      { period: '1411', amount: 0 },
      { period: '1412', amount: 0 },
      { period: '1413', amount: 0 },
      { period: '1414', amount: 0 },
      { period: '1415', amount: 0 },
      { period: '1416', amount: 0 },
      { period: '1417', amount: 0 },
      { period: '1418', amount: 0 },
      { period: '1419', amount: 0 },
    ],
    missingSourceDetails: ['موازنه فیزیکی DRI هات‌لینک به فولاد مذاب و ترکیب شارژ', 'مصرف ویژه برق، گاز، اکسیژن، آب و فروآلیاژها', 'تخصیص داخلی DRI تولیدی در فولادسازی در برابر Extra DRI مازاد قابل فروش', 'عمر مفید و روش استهلاک تفکیکی تجهیزات احیا و فولادسازی', 'نرخ قراردادی وام‌ها و کارمزدها؛ جدول مبالغ و بازپرداخت‌ها از گزارش استخراج شده است'],
  },
}
