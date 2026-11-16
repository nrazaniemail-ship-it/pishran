# COMFAR III Expert reference-driven form and formula coverage

## Controlling source and interpretation

This design is based on the English COMFAR III Expert Reference Manual held in the project reference library ('Reference_Eng.pdf'), with the Tutorial Manual used only to clarify the workflow of entering data. The manual describes the on-line Help as context-sensitive procedural assistance; the detailed data definitions and algorithms are in the Reference Manual. This is therefore not a claim that an independently supplied CHM/Help archive has been read.

No project report, CAPEX/OPEX workbook, sample model or project-specific financial assumption is used as a design baseline. All form values are blank until entered by an analyst.

## Form coverage catalogue

The file frontend/src/features/projects/projectModelHelpForms.ts defines source-traceable sections, field metadata, blank-row constructors and validation. ProjectModelHelpCoveragePanel.tsx renders these sections in the project financial forms. The existing item-level asset/cost/sales/working-capital/loan/tax forms remain available alongside the comprehensive reference catalogue.

| Reference subject | Form coverage | Source |
|---|---|---|
| Project class, opportunity/feasibility depth, optional analysis features | Project identification and feature activation | VI, VII.F |
| Construction, start-up and production phases; balance month; period frequency | Planning horizon and calendar | VII.G |
| Product-specific actual production dates and nominal capacity | Products | VII.H |
| Local/foreign currencies, accounting currency/unit, exchange rates | Currencies | VII.I |
| Six cost-centre groups, hierarchy, product assignment | Cost centres | VII.J |
| Standard and user-defined indirect-cost allocation keys | Cost allocation | VII.J, XI.G |
| Inflation by currency and period; item price escalation remains separate | Inflation | VII.K, XI.A, XI.C |
| Joint-venture partners, share classes, contributions and preferred dividend data | Joint venture | VII.L, VII.R.1, XI.Q |
| Total investment/equity discount rates, short NPV length, reference point, MIRR rates | Discounting | VII.M, XI.E, XI.F |
| Fixed assets, acquisition dates, currency/origin, depreciation and disposal | Fixed investment | VII.N, XI.H, XI.I |
| Pre-production expenditure and amortization | Pre-production expenditure | X, XI |
| Direct/indirect cost items; nominal capacity and per-unit basis; annual adjustments | Production costs | VII.O, XI.J |
| Product-level sales quantity, net price, sales tax/export duties, subsidy | Sales programme | VII.P, XI.L |
| Material inventories, WIP, finished goods, receivables, cash, payables; units/value mode; days coverage | Working capital | VII.Q, XI.K |
| Equity classes, grants and subsidies | Equity and grants | VII.R.1 |
| Long-/short-term loans; annuity, constant principal and profile; repayment frequency, first repayment and count | Loan conditions | VII.R.2-3, XI.M |
| Dated drawdowns/profile repayments and dated interest-rate changes | Loan disbursements and interest | VII.R.2, XI.M |
| Capitalized interest share/end date and depreciation of capitalized interest | Loan interest | VII.R.2, XI.M |
| Agency, guarantee, commitment and other fees; fee currency and amortization | Loan fees | VII.R.2, XI.M |
| Retained profit, distribution, shareholder shares and repatriation | Profit distribution | VII.R.4, XI.Q |
| Tax holidays, loss carry-forward, period adjustments and tax currency | Income tax | VII.S, XI.P |
| Progressive tax brackets and tax rates by period | Tax brackets | VII.S, XI.P |
| Investment and depreciation allowances | Tax allowances | VII.S, XI.R |
| Local/foreign depreciation adjustments | Depreciation adjustments | VII.S, XI.R |
| Existing assets, inventory, WIP, receivables, cash, payables, debt and equity | Starting balances | VII.T, XI.F, XI.K |
| Cost-benefit/value-added method, numeraire, official/shadow FX and economic discount rate | Economic global parameters | VIII.E, XII |
| Traded/imported/importable/exportable/non-traded input/output classification, adjustment factors, tax and subsidy treatment | Economic items | VIII.F-H, XII |
| Foreign loans, indirect effects and employment | Economic effects | VIII, XII |
| Global data variations, target IRR/NPV, one-variable parametric charts | Sensitivity | XIII |
| Existing enterprise without project, with project, and project in isolation | Incremental analysis | VII.T, XIV |

## Source-derived calculation rules

### Asset depreciation and disposal

The reference defines four methods: Linear to Zero, Linear to Scrap, Accelerated (declining balance), and Sum of Years Digits. The asset amount is converted to local currency at the current period exchange rate before depreciation.

- Linear to Zero: annual charge is based on initial book value divided by total depreciation length; the first depreciation year is prorated by its number of months. The number of full depreciation years is determined using the salvage value and the first-year fraction. The final depreciation amount is adjusted so the closing book value equals salvage value.
- Linear to Scrap: annual charge is based on initial book value less salvage value, divided by depreciation length; the first year is prorated and the final period leaves salvage value.
- Accelerated: declining-balance depreciation is applied only while it exceeds the straight-line amount over remaining life to salvage; otherwise the method switches to Linear to Scrap. The first year is prorated by months.
- Sum of Years Digits: the manual defines separate formula branches for whole-year life, additional months in useful life, and a partial first depreciation year. The partial-year formulas use the exact variables Y, m, m1, SODL and SODL_adj; a simple ceil(usefulLifeMonths/12) denominator is not equivalent.

On disposal, proceeds up to book value are return of capital; the difference between proceeds and book value is other income or loss. Remaining book value at the end of production is returned as capital in the year after production under the default rule.

### Standard production cost at nominal capacity

For a cost item and production period j:

- SC_j = Q × C_j
- A_j = Q_adj_j × C_adj_j
- FC_j = f × SC_j + f_adj_j × A_j
- VC_j = v × SC_j × (S_j or P_j) / PC + v_adj_j × A_j

Here Q,C are standard quantity and price, PC is product nominal capacity, S_j sales quantity, P_j production quantity, and f,v are fixed/variable shares. The relevant activity basis follows the item and inventory treatment. For a period shorter than one year, the standard fixed-cost component is prorated by months/12. Period adjustments remain separate from standard cost.

### Standard production cost per unit of output

Variable cost is quantity per unit × period price × sales or production volume, plus the variable part of period adjustments. Fixed cost is the standard fixed amount plus the fixed part of adjustments. The standard fixed amount is prorated by months/12 for a period shorter than one year.

### Production and sales / finished-goods inventory

Sales and production are not assumed equal. In the default production interval, required finished-goods stock is sales quantity divided by the turnover coefficient. If sales are less than opening finished-goods inventory, production is zero and inventory is reduced by sales. Otherwise production equals sales plus required closing stock less opening stock. A user-defined production interval has additional cases and must be implemented separately before certification.

### Working capital

The reference uses a 360-day year and period turnover c=(m×30)/Mdc, where m is period months and Mdc is minimum days coverage. Working-capital components do not all use the same basis: finished goods and receivables use cost of products sold (with the relevant operating/marketing cost basis); WIP and materials use cost of products produced and item-specific bases. Material weighted-average unit value uses standard and adjustment quantities/prices. Increases in current assets are cash outflows; decreases are releases. Increases in current liabilities are cash inflows.

### Loan interest, capitalization and fees

Interest periods are segmented whenever the interest rate or loan balance changes. The manual uses 12 months of 30 days per year; the rate fraction for a sub-interval is annual rate × (months + excess days/30)/12. Annuity, constant-principal and profile loans have different repayment rules. Profile repayments are entered as negative movements. Capitalized interest increases loan balance and pre-production expenditure, but is excluded from the investment cash outflow used for total-investment NPV/IRR. The fee bases are not interchangeable:
- Agency: each positive disbursement, paid at each disbursement.
- Guarantee: outstanding loan including current disbursement and excluding current repayment, annualized and paid with interest.
- Commitment: undisbursed balance, annualized and paid with interest.
- Other: total loan, paid at first disbursement.

Fees are paid when due and cannot be capitalized; depreciation can be defined separately for fees and capitalized interest.

### Income tax and loss carry-forward

Tax is computed on taxable profit using progressive brackets. Each bracket rate applies only to the amount above its lower limit and below the next bracket's lower limit. Tax holidays suspend tax during the defined production years. Losses are carried forward for the specified number of years and offset profits at the earliest opportunity. Investment allowances reduce taxable profit; depreciation allowances reduce taxable profit and book value. Depreciation adjustments are algebraically added to asset depreciation and may be positive or negative.

### NPV, MIRR and cash-flow perimeter

NPV sums discounted net flows by period. For discounting to the beginning of the first period, period one is discounted; for discounting to the end of the first project year, first-year flows are not discounted. MIRR compounds surpluses at the reinvestment rate to the year after production ends and discounts deficits at the borrowing rate to the temporal reference point. Total-investment, total-equity and shareholder-class cash flows have different perimeters. Total-investment cash flow excludes equity, loan disbursements/repayments, interest/fees and dividends; starting balances and residual value apply where relevant.

### Dividends

Retained profit is deducted from positive after-tax profit before dividends. No dividends are paid in a loss period. Preferred dividends are paid before ordinary dividends; joint-venture partners have priority over other shareholder classes if distributable profit is insufficient. Ordinary dividends are allocated from the remaining pool. Repatriated dividends are a defined percentage of each class's dividends.

### Sensitivity and incremental analysis

Global sensitivity changes quantity and/or price for fixed investment, production costs and sales programme; indirect effects use a value variation. Desired IRR/NPV searches alter selected variables in 1% steps within user-defined maximum increases/decreases and restore original values after the calculation. Parametric chart analysis varies one parameter at a time and does not recompute working-capital and financing interactions or cash-deficit effects; it is not a substitute for full sensitivity analysis. Incremental analysis compares the existing enterprise without the project, the enterprise with the project, and the project in isolation.

## Implemented formula primitives and test scope

projectModelHelpFormulaRules.ts includes deterministic helpers for nominal-capacity and per-unit cost build-up, 360-day working-capital turnover, NWC movement, the default sales/production inventory bridge, graduated income tax, loss carry-forward, segmented 30/360 loan interest, fee bases, interest capitalization, NPV/MIRR (including date-based discounting), dividend priority, asset disposal, FX debt adjustment, automatic construction equity and operating overdraft, short-term deposit interest, currency inflation and price escalation, fixed-asset revaluation, economic financial values/AMV/AF, calculation support for transport and other costs, SCF-based foreign-exchange adjustments, numeraire conversion, value-added and cost-benefit schedules, employment ratios, sensitivity/target search, parametric series and incremental cash-flow series. Tests are in validate-project-model-help-formulas.mjs. The asset depreciation and standard debt schedule primitives remain in projectModelFormulaRules.ts.

The SYD implementation follows the manual's intermediate-depreciation equations when the useful life includes additional months. For a whole-year useful life with a partial first depreciation year, annual SYD tranches are accrued month by month and intersected with the reporting-year intervals: the first reporting period receives the partial first tranche, later periods combine the unused tail of the preceding tranche with the applicable share of the next tranche, and the final partial period exhausts the remaining depreciable base. Regression tests verify each interval and that cumulative depreciation equals the depreciable base without crossing salvage value. Date-aware NPV/MIRR helpers use the manual's 30/360 discounting basis.

The form catalogue and tests are added to npm run test:financial. All values remain blank by default.

## Explicit implementation boundary

The current change provides a comprehensive reference-mapped input catalogue, persistence through the existing financialForms model, form-level validation and independently tested formula primitives. It does **not** yet constitute a complete reproduction of every COMFAR III Expert calculation or report. In particular, the following remain separate integration work:
1. Connect every new field to a single period-indexed calculation graph.
2. Implement all non-default product production-interval cases, all working-capital sub-item algorithms and their starting-stock interactions.
3. Complete foreign-currency loan revaluation and currency translation across all schedules, opening-balance accounting and full residual-value calculation. The debt adjustment and automatic cash-deficit functions are primitives only.
4. Complete full balance-sheet, net-income and financial-planning cash-flow generation, including every capitalized-interest/fee/depreciation/tax/dividend interaction.
5. Complete the partial-year Sum of Years Digits depreciation schedule (the current depreciation helper deliberately rejects fractional-life/partial-first-year cases rather than emit an unverified schedule), full economic appraisal algorithms, sensitivity target search and parametric chart output.
6. Reconcile period by period against independently supplied COMFAR output files, using tolerances and traceable source pages.

Therefore, the forms now cover the documented input domains, but the entire model must not be described as calculation-equivalent to COMFAR until these integrations and output reconciliations pass. The uploaded project output and spreadsheets remain excluded from the design baseline and are reserved for a later simulation stage.
