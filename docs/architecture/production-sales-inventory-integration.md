# Production, sales and finished-goods integration

## Data flow

The production/sales adapter transforms the saved product forms into the annual series consumed by `calculateIntegratedPeriodicFinance`:

- `annualRevenue`: net sales revenue plus subsidy; sales tax is reported separately and is not treated as project income.
- `annualVariableCost` and `annualFixedCost`: product-assigned production-cost items using the help formula primitives.
- `periodProductionQuantity`: sales quantity plus closing finished-goods stock less opening finished-goods stock.
- `closingFinishedGoodsQuantityByProduct`: explicit stock roll-forward, product by product and period by period.

Missing opening stock, closing stock, sales quantities, prices, cost bases or period keys are validation errors. The adapter does not infer missing balances as zero.

## Formula conventions

For each product and period:

`Production = Quantity sold + Closing finished goods - Opening finished goods`

`Gross sales = Quantity sold × Net unit price + Sales tax`

`Net sales = Gross sales - Sales tax`

`Sales revenue = Net sales + Subsidy`

Production-cost form calculations call the existing help-driven formula functions for nominal-capacity and per-unit-output methods. Period-adjustment costs require explicit totals and a 100% fixed/variable split.

Indirect cost items remain visible in separate fixed/variable buckets. The form-binding layer expands an indirect item into product-level rows only after a user-defined allocation key has been supplied and its shares reconcile to exactly 100% for the matching cost-centre group. The production/sales adapter rejects an indirect row without its allocation-key reference, so an unallocated shared cost cannot be silently attributed to one product. Formula-based allocation drivers remain blocked until their driver schedules are implemented.

## Independent external benchmark

The regression fixture `frontend/scripts/fixtures/comfar-steel-sales-output.fixture.mjs` transcribes actual output from `COMFAR III - 001 - Summary sheet1.pdf`, pages 34–40. It covers project periods 5–10 for Steel Slab and Extra DRI, including opening/closing finished goods, production, sales quantities, unit prices and period revenue.

The test compares each product-period production quantity, sales quantity, closing inventory and sales revenue with the reported values, using a 0.02 tolerance for printed two-decimal inventory quantities. The fixture is test-only and is not imported by the production engine.

This benchmark validates the production/sales/inventory roll-forward and sales revenue only. It does not establish full financial-model parity, because it does not by itself reconcile the loan, depreciation, working-capital valuation, tax, cash-flow and three-statement schedules.
