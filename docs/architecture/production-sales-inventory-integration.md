# Production, sales and finished-goods integration

## Data flow

The production/sales adapter transforms saved product and production-cost forms into the annual and period series consumed by `calculateIntegratedPeriodicFinance`:

- `annualRevenue`: net sales revenue plus subsidy; sales tax is reported separately and is not treated as project income.
- `annualCostOfGoodsSold`: period COGS calculated from each product's production cost and selected finished-goods valuation method, aggregated by fiscal year.
- `finishedGoodsInventoryValueByPeriod`: closing finished-goods carrying value by project period.
- `periodProductionQuantity` and `periodProductionCost`: product-level production quantity and allocated production cost, retained in the operating schedule for auditability.
- `closingFinishedGoodsQuantityByProduct`: explicit stock roll-forward, product by product and period by period.

Production costs are not blindly added to period variable/fixed operating expenses. Only the cost assigned to units sold is posted as COGS; the unsold portion remains in finished-goods inventory. This prevents the same production cost from being expensed once as a production input and again through inventory consumption.

Missing opening stock quantity/value, closing stock, sales quantities, prices, cost bases or period keys are validation errors. Opening finished-goods quantity and carrying value must be explicit. Positive opening quantity requires a positive/zero explicit carrying value, and a non-zero opening value without quantity is rejected.

## Formula conventions

For each product and period:

`Production = Quantity sold + Closing finished goods - Opening finished goods`

`Gross sales = Quantity sold × Net unit price + Sales tax`

`Net sales = Gross sales - Sales tax`

`Sales revenue = Net sales + Subsidy`

Production-cost form calculations call the existing help-driven formula functions for nominal-capacity and per-unit-output methods. Period-adjustment costs require explicit totals and a 100% fixed/variable split. Product-period production cost is the sum of validated direct and allocated indirect fixed/variable production costs.

Each product must select FIFO or weighted-average valuation whenever finished-goods stock is carried. Weighted-average costing rolls the opening carrying value and current-period production cost over available units. FIFO consumes the oldest opening/production layers first. Both methods enforce quantity and value reconciliation in every period and carry closing quantity/value into the next period.

If a period's closing quantity is left blank and product-level finished-goods days coverage is supplied, the adapter derives the COMFAR-style target stock:
`required stock = sales quantity × days coverage / (30 × months in period)`
and
`closing stock = max(opening stock − sales quantity, required stock)`.
The period's production requirement then follows the stock identity above. A manually entered closing quantity takes precedence over the derived value. Full calendar periods use their calendar-month count; partial periods use their actual day count on a 30-day month convention.

## Financial statement posting

The orchestrator binds the calculated annual COGS and period closing inventory values into the periodic finance engine:

- COGS is deducted in EBIT, taxable income, CFADS, project free cash flow and equity free cash flow.
- Closing finished-goods value is added to period working capital and appears in the balance-sheet net working-capital balance.
- The opening working-capital balance must include opening finished-goods carrying value. When a detailed opening balance sheet or finished-goods working-capital component is present, the product-level valuation must reconcile to it.
- If a finished-goods working-capital component is entered, its period balances must match the calculated product-level inventory valuation; the engine's separate inventory posting is then suppressed to avoid double counting.
- Linked income statement, cash-flow statement, balance sheet and movement checks are tested together. Unsold production is capitalized as inventory, while inventory consumed by sales becomes COGS.

## Indirect production costs

Indirect cost items remain visible in separate fixed/variable buckets. The form-binding layer expands an indirect item into product-level rows only after a user-defined allocation key has been supplied and its shares reconcile to exactly 100% for the matching cost-centre group. The source cost item and allocation key must reference the same cost centre; a cross-centre allocation is rejected before product rows are created. The production/sales adapter rejects an indirect row without its allocation-key reference, so an unallocated shared cost cannot be silently attributed to one product. Formula-based allocation drivers remain blocked until their driver schedules are implemented.

## Independent external benchmark

The regression fixture `frontend/scripts/fixtures/comfar-steel-sales-output.fixture.mjs` transcribes actual output from `COMFAR III - 001 - Summary sheet.pdf`, pages 34–40. It covers project periods 5–10 for Steel Slab and Extra DRI, including opening/closing finished goods, production, sales quantities, unit prices and period revenue.

The test compares each product-period production quantity, sales quantity, closing inventory and sales revenue with the reported values, using a 0.02 tolerance for printed two-decimal inventory quantities. The benchmark supplies weighted-average as an adapter-required test input only; the COMFAR pages do not identify an inventory cost-flow method, so the fixture does not claim that COMFAR used weighted-average. The fixture is test-only and is not imported by the production engine.

This benchmark validates the production/sales/inventory roll-forward and sales revenue only. It does not establish full financial-model parity, because it does not by itself reconcile the loan, depreciation, working-capital valuation, tax, cash-flow and three-statement schedules. The FIFO/weighted-average integration regression tests verify the local financial posting mechanics; a separate complete COMFAR period-by-period output comparison is still required before claiming reference parity.
