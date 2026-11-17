/**
 * Transcribed independently from:
 * "COMFAR III - 001 - Summary sheet.pdf", SARZAMIN steelmaking project,
 * COMFAR III Expert output, pages 34-40 (May 1402).
 *
 * Values are in EUR, absolute units. Periods 5-10 are copied from the
 * product-specific "Sales and Production Programme" schedules:
 * Steel Slab (PDF page 34) and Extra DRI (PDF page 38).
 * The "finished goods consumed" line in the Persian output is the
 * closing stock carried forward: opening stock + production - sales.
 * Five-day coverage is inferred from closing stock / sales for periods 5-10.
 * Weighted-average is an adapter-required test input only; the source pages
 * do not identify COMFAR's inventory cost-flow method.
 */
export const STEEL_SLAB_EXTRA_DRI_SALES_BENCHMARK = Object.freeze({
  source: "COMFAR III - 001 - Summary sheet.pdf",
  sourcePages: [34, 35, 36, 38, 39, 40],
  project: "SARZAMIN steelmaking project",
  currency: "EUR",
  units: "absolute",
  periods: [5, 6, 7, 8, 9, 10],
  products: [
    {
      productId: "steel-slab",
      name: "Steel Slab",
      unitPrice: 634,
      inventoryValuationMethod: 'weighted-average',
      finishedGoodsDaysCoverage: 5,
      openingFinishedGoods: [0, 11666.67, 13333.33, 15000, 16666.67, 16666.67],
      production: [851666.67, 961666.67, 1081666.67, 1201666.67, 1200000, 1200000],
      sales: [840000, 960000, 1080000, 1200000, 1200000, 1200000],
      closingFinishedGoods: [11666.67, 13333.33, 15000, 16666.67, 16666.67, 16666.67],
      salesRevenue: [532560000, 608640000, 684720000, 760800000, 760800000, 760800000],
    },
    {
      productId: "extra-dri",
      name: "Extra DRI",
      unitPrice: 275,
      inventoryValuationMethod: 'weighted-average',
      finishedGoodsDaysCoverage: 5,
      openingFinishedGoods: [0, 5111.11, 5750, 6388.89, 6388.89, 6388.89],
      production: [373111.11, 414638.89, 460638.89, 460000, 460000, 460000],
      sales: [368000, 414000, 460000, 460000, 460000, 460000],
      closingFinishedGoods: [5111.11, 5750, 6388.89, 6388.89, 6388.89, 6388.89],
      salesRevenue: [101200000, 113850000, 126500000, 126500000, 126500000, 126500000],
    },
  ],
  totalSalesRevenue: [633760000, 722490000, 811220000, 887300000, 887300000, 887300000],
});
