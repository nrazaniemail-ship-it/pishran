# COMFAR help-driven financial form and formula blueprint

## Scope

This specification is derived from the COMFAR III Expert Reference Manual's input and calculation chapters. It is not a reproduction claim and it does not use any project-specific report or spreadsheet. Formula implementations must be separately unit-tested against these definitions before any COMFAR-output simulation begins.

## 1. Project calendar and input grain

The planning horizon runs from the beginning of construction through the end of production. Input data are period-dated; construction and production phases are distinct, and periods may be annual, semiannual, quarterly or monthly. The calendar is the master index for all period series. The form layer must preserve exact dates and partial periods; it must not silently spread annual values into shorter periods.

## 2. Common financial-item form

Each reusable cost, revenue, asset or financing item carries common metadata where applicable: description, currency, local/foreign origin (or product market), price escalation, remarks and optional cost-centre assignment. Currency, origin and escalation are item attributes, not global assumptions copied into every item. If inflation and escalation are both used, the engine must apply both according to their separate meanings and warn against double counting.

### Quantity / price / total

For a row with exactly two of the three inputs:
- Total = Quantity × Unit price
- Unit price = Total / Quantity when quantity is non-zero
- Quantity = Total / Unit price when unit price is non-zero

If fewer or all three values are entered, do not auto-correct the row. A zero divisor leaves the third value unresolved and triggers validation. Currency and unit are shown beside the input values.

## 3. Fixed investment and asset lifecycle

Every asset item has its own acquisition schedule, currency, depreciation start, method, rate or useful life, salvage value, and disposal event. Asset additions are dated in the project calendar. Depreciation starts no earlier than the configured start date and never before commissioning; it stops at salvage book value or asset disposal.

Supported COMFAR III methods:
1. Linear to zero
2. Linear to scrap
3. Accelerated (declining balance), switching to linear-to-scrap when the accelerated charge is no longer greater than the linear-to-scrap charge
4. Sum of years' digits

For linear-to-scrap, depreciable basis is initial book value less salvage value. For sum-of-years'-digits, the period weight is (remaining life periods) / sum(1..n). Partial first/last years are prorated by the applicable months, and depreciation is charged at the balance date. Disposal gain/loss is sale proceeds less book value; recovery of book value is return of capital. These rules require an asset-by-asset ledger and a period roll-forward, not a single project-wide depreciation percentage.

## 4. Production-cost forms

Direct costs are associated with a product. Indirect costs are entered separately and are not automatically assigned to a product. Cost allocation is optional; where user-defined allocation is used, percentages must sum to exactly 100% before acceptance.

For direct costs the form offers two bases:
- At nominal capacity: standard quantity and price/total are defined for the product's nominal capacity; the user specifies either fixed or variable percentage and the other is derived as 100% minus the entered percentage.
- Per unit of output: unit input quantity and price define variable cost per unit of output; fixed costs are entered separately.

For nominal-capacity basis, the help describes:
- Standard cost SC_j = Q × C_j
- Period adjustment A_j = Q_adj_j × C_adj_j
- Fixed cost FC_j = f × SC_j + f_adj_j × A_j
- Variable cost VC_j = v × SC_j × (S_j or P_j) / PC + v_adj_j × A_j

where Q is standard input quantity, C is its period price, PC is product nominal capacity, S is sales volume, P is production volume, and f / v are fixed and variable shares. The choice of sales or production volume follows the COMFAR schedule definition for the item and stock treatment.

For per-unit basis, variable cost scales with output quantity; fixed costs remain period costs. For periods shorter than a year, fixed costs are prorated by months/12. Indirect cost items use period adjustments rather than product nominal-capacity standard costs.

The forms must keep separate: direct cost item vs indirect cost item; standard cost vs period adjustment; fixed portion vs variable portion; cost of products produced (CPP) vs cost of products sold (CPS).

## 5. Production and sales programme

Sales quantity, net unit price, sales tax and subsidy are period inputs by product. Production is calculated from sales and finished-goods inventory movement; it is not assumed equal to sales when inventory changes. Sales tax and subsidy must be separately represented so net sales, gross sales display and economic-analysis treatment remain distinguishable.

## 6. Working capital

Working capital is modelled by component and period: raw materials and other input inventories; work in progress; finished goods; accounts receivable; cash in hand; accounts payable and other current liabilities.

At each period:
- NWC_j = Current assets_j − Current liabilities_j
- Change in NWC_j = NWC_j − NWC_(j−1)
- Turnover coefficient = 360 / Minimum days coverage

The help describes the 360-day convention and automatic adjustment of turnover for periods shorter than one year. The model must make the day-count convention explicit and not silently mix it with a 365-day basis. Inventory valuation and receivables use the correct production/sales cost basis, not one common denominator for every component. Working-capital increases are financing uses; decreases/recovery are financing sources. Recovery timing is an explicit input, not a hidden terminal plug.

## 7. Sources of finance and debt

Separate equity/risk capital, grants/subsidies, medium/long-term loans, short-term loans and profit distribution. Each loan has currency and local/foreign designation; loan type (annuity, constant principal or profile); dated disbursements; repayment interval, first repayment date and number of repayments where relevant; dated interest-rate conditions; interest payment convention; capitalization percentage and end date; fee definitions and bases; and asset/cost treatment of capitalized interest and fees where relevant.

Core balance identity:
- Debt_j = Debt_(j−1) + Disbursements_j − Principal repayments_j + Capitalized interest_j

For an annuity loan with non-zero periodic rate i and n repayments:
- A = D × i(1+i)^n / ((1+i)^n − 1)
- Interest_j = Opening debt_j × i
- Principal_j = Payment_j − Interest_j

For zero-rate annuity cases, use the constant-principal limit rather than divide by zero. A profile loan takes dated positive drawdowns and negative repayments as user-entered movements. Interest must be segmented at dated changes in rate and loan balance. Capitalized interest increases debt and pre-production expenditure, but is not a second cash disbursement and must not be included as an investment cash outflow in total-capital NPV/IRR. Fee bases differ: agency on each positive drawdown, commitment on undisbursed balance, guarantee on outstanding loan amount, and other fees on total loan amount as defined by the manual.

## 8. Taxes, allowances and starting balances

Tax is a period schedule with selectable tax system, period rates, allowances and loss carry-forward policy. Do not hard-code a tax rate. Tax allowances are separate from accounting depreciation and must flow through taxable income and asset book values only according to the selected rule. Opening balances appear only for expansion/rehabilitation projects and require a balanced opening statement.

## 9. Required output graph before calculation

A validated project must be able to trace each output back to source inputs: project calendar and assumptions; asset acquisition and depreciation schedules; direct/indirect production cost build-up; production/sales/inventory bridge; working-capital component and NWC bridge; equity, debt drawdown, interest, fees and principal schedule; tax computation and loss carry-forward; income statement, financial-planning cash flow and balance sheet.

No return metric is certified unless its underlying dated cash-flow perimeter, currency and discount convention are explicit.

## Source sections

UNIDO, COMFAR III Expert Reference Manual:
- Chapter VI: Data structures and standard input data structures.
- Chapter VII: Financial data input (project identification, planning horizon, products, currencies, cost centres, inflation, joint ventures, discounting, fixed investment, production costs, sales programme, working capital, sources of finance and taxes/allowances).
- Chapter XI: Financial calculation rules (depreciation, asset disposals, production costs, working capital and debt calculations).
