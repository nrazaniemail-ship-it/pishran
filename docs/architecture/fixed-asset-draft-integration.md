# Fixed-asset form integration

The fixed-asset adapter expands each dated acquisition row into a separate asset vintage, values the vintage in local currency using the project's explicit period exchange rate, and sends the asset-by-asset lifecycle result into the periodic finance input.

It binds:
- period depreciation and the reconciled annual depreciation totals;
- fixed-asset acquisition flows and pre-production acquisition flows;
- period and annual disposal proceeds, return of capital, other income and book value disposed.

Acquisition is dated at the end of the selected project period because the current form stores a period key rather than a transaction date. The depreciation engine applies the Help-derived annual schedule: depreciation starts in the next period unless a later explicit start date is supplied; production-start depreciation requires an explicit production start date. The entered number of months in the first depreciation year determines the first depreciation segment. Subsequent segments are 12 months (with a final residual segment where required), and each charge is posted in the project period containing that segment's balance date. Linear-to-zero, linear-to-scrap, accelerated-declining-balance with its switch to straight-line, and full-year sum-of-years-digits are supported. Partial-year or fractional-life sum-of-years-digits remains guarded until its full formula is implemented and independently tested.

Multiple acquisition vintages are supported. A disposal must identify one unambiguous vintage; assets with multiple vintages must be split into separate rows before disposal. Disposal dates must be project-period balance dates. Return of capital is the lesser of sale proceeds and disposed book value; signed other income/loss is sale proceeds minus disposed book value. This supports both gains and losses and keeps cash proceeds separate from the income-statement gain/loss.

The adapter preserves any existing annual depreciation by allocating it across periods using fiscal-year day fractions, then adds the asset-specific depreciation schedule. Annual and period schedules are reconciled by the periodic finance engine.
