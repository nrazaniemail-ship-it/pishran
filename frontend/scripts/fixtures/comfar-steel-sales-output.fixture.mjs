/**
 * Independent output benchmark transcribed from the real project report:
 * "COMFAR III - 001 - Summary sheet1.pdf", pages 34-40 (project periods 5-10).
 * Keep this fixture isolated from production calculations; values are reference
 * observations used only by regression tests.
 */
export const STEEL_SLAB_EXTRA_DRI_SALES_BENCHMARK = {
  source: 'COMFAR III - 001 - Summary sheet1.pdf',
  pages: [34, 35, 36, 38, 39, 40],
  periods: [5, 6, 7, 8, 9, 10],
  products: [
    {
      productId: 'Steel Slab',
      unitPrice: 634,
      openingFinishedGoods: [0, 11666.67, 13333.33, 15000, 16666.67, 16666.67],
      production: [851666.67, 961666.67, 1081666.67, 1201666.67, 1200000, 1200000],
      sales: [840000, 960000, 1080000, 1200000, 1200000, 1200000],
      closingFinishedGoods: [11666.67, 13333.33, 15000, 16666.67, 16666.67, 16666.67],
      salesRevenue: [532560000, 608640000, 684720000, 760800000, 760800000, 760800000],
    },
    {
      productId: 'Extra DRI',
      unitPrice: 275,
      openingFinishedGoods: [0, 5111.11, 5750, 6388.89, 6388.89, 6388.89],
      production: [373111.11, 414638.89, 460638.89, 460000, 460000, 460000],
      sales: [368000, 414000, 460000, 460000, 460000, 460000],
      closingFinishedGoods: [5111.11, 5750, 6388.89, 6388.89, 6388.89, 6388.89],
      salesRevenue: [101200000, 113850000, 126500000, 126500000, 126500000, 126500000],
    },
  ],
  totalSalesRevenue: [633760000, 722490000, 811220000, 887300000, 887300000, 887300000],
}
