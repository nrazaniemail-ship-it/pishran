# Fixed-asset form integration

The fixed-asset adapter expands each dated acquisition row into a separate asset vintage, values the vintage in local currency using the project's explicit period exchange rate, and sends the asset-by-asset lifecycle result into the periodic finance input.

It binds:
- period depreciation and the reconciled annual depreciation totals;
- fixed-asset acquisition flows and pre-production acquisition flows;
- period and annual disposal proceeds, return of capital, other income and book value disposed.

Acquisition is dated at the end of the selected project period because the current form stores a period key rather than a transaction date. The depreciation engine then applies its established rule: depreciation starts in the next period unless a later explicit start date is supplied. Production-start depreciation requires an explicit production start date.

Multiple acquisition vintages are supported. A disposal must identify one unambiguous vintage; assets with multiple vintages must be split into separate rows before disposal. A disposal loss is rejected because the current disposal posting schema cannot represent negative other income/loss consistently with its return-of-capital validation. The disposal form must be extended before loss disposals are enabled.

The adapter preserves any existing annual depreciation by allocating it across periods using fiscal-year day fractions, then adds the asset-specific depreciation schedule. Annual and period schedules are reconciled by the periodic finance engine.
