# Help-driven project model foundation

## Design boundary

This implementation uses the COMFAR III Expert Reference Manual as a structural and formula reference only. It deliberately excludes every project-specific report, workbook, benchmark amount, financing ratio, tax rate, depreciation assumption, price, cost, capacity and operating schedule. Those sources are reserved for a later, separately controlled simulation and reconciliation phase.

## Reference model structure

The model is organized as a project tree, not as a single long form. Its standard first-level modules are:

1. Project identification and analysis level
2. Planning horizon and period calendar
3. Products and capacity definitions
4. Currencies and period exchange rates
5. Optional cost-centre structure and allocation keys
6. Optional inflation indices and currency escalation
7. Optional joint-venture partners and share classes
8. Discounting, short NPV and MIRR conventions
9. Fixed investment and asset register
10. Pre-production expenditure
11. Production costs (direct and indirect)
12. Product-specific sales and production programme
13. Working capital by inventory, receivables, cash and payables
14. Equity, grants, long-term loans and short-term finance
15. Profit distribution and dividend repatriation
16. Taxes, progressive brackets, holidays, losses and allowances
17. Conditional starting balances for expansion/rehabilitation
18. Optional economic global parameters, input/output adjustments and indirect effects
19. Sensitivity analysis and incremental analysis

The optional modules are activated explicitly. Their absence must not be interpreted as a zero-valued assumption or as a completed input.

## Form design principles

- A new project starts with an empty data structure and user-selected project class and analysis depth.
- Opportunity and feasibility levels share the same conceptual modules but can expose different detail requirements.
- Project-specific categories (for example, steel and mining process stages) are extensions of the generic product/process structure, not hard-coded financial assumptions in the foundation.
- Multiple products, assets, cost items, loan facilities, partners and tax periods are collections with stable IDs.
- Common financial-item metadata is separated from item-specific data: description, currency, local/foreign origin, escalation, remarks and optional cost-centre assignment.
- A direct cost belongs to a product; an indirect cost is a separate item and may be allocated only when allocation is activated and a valid allocation key exists.
- Quantity, unit price and total use the two-of-three rule. The third value is calculated only when exactly two values are entered; incomplete and over-specified rows are not silently adjusted.
- Period series use the project's generated calendar. No annual-to-quarterly or quarterly-to-monthly interpolation is permitted unless the user explicitly selects and confirms an allocation method.
- Fixed/variable cost split, depreciation policy, tax rates, exchange rates, escalation and discount rates remain blank until supplied.
- Expansion/rehabilitation opening balances and economic-analysis adjustments appear only when the respective feature is selected.
- Validation distinguishes missing information (warning) from contradictory or invalid input (error).

## Current implementation

`frontend/src/features/projects/projectModelSchema.ts` provides the typed module tree, conditional module visibility, empty draft factory, common financial-item metadata, and quantity/price/total derivation. `projectModelHelpForms.ts` supplies the complete reference-mapped form catalogue and validation, and `ProjectModelHelpCoveragePanel.tsx` renders the catalogue as editable forms.

`frontend/scripts/validate-project-model-schema.mjs` checks that:
- a new draft contains no seeded project data;
- optional modules are hidden until explicitly activated;
- all standard modules are present and IDs are unique;
- common item metadata is blank;
- quantity/price/total derivation works only when exactly two values are supplied.

## Next implementation layers

1. Connect the model tree to project creation and persistence, preserving existing project data through versioned migrations.
2. Render metadata-driven forms for products, fixed assets, direct/indirect costs, sales, working capital, finance and taxes.
3. Add item-level validation and cross-module validation (calendar coverage, currencies, product links, cost allocation, asset lifecycle and loan schedules).
4. Add a calculation graph that consumes only validated, period-aligned inputs and emits traceable schedules.
5. Only after the form foundation is stable, import a genuine COMFAR output project and compare period-by-period schedules.

## Source

UNIDO, *COMFAR III Expert Reference Manual*, especially chapter VI (Data Structures) and chapter VII (Financial Data Input): project identification, planning horizon, products, currencies, cost-centre structure, inflation, joint ventures, discounting, fixed investment, production costs, sales programme, working capital, sources of finance, and taxes/allowances. The manual describes a tree-based input browser, project-class and analysis-level structures, optional modules, common item metadata and period-based data entry.

## Implemented input and formula layer

The wizard now stores a separate `financialForms` draft alongside the legacy feasibility model. The draft is initialized empty for every new project and is backfilled as empty when older saved projects are loaded, so the schema migration does not overwrite prior user-entered project data.

The reference-mapped editable form catalogue covers:
- Project status, class, analysis level and optional modules; construction/start-up/production horizon and period frequency.
- Multiple products and nominal capacities; local/foreign currencies, accounting currency/unit and dated exchange rates.
- Six cost-centre groups, cost-centre hierarchy, standard and user-defined indirect-cost allocation keys.
- Currency-specific inflation, joint-venture partners, equity classes, paid-in/refunded capital, preferred dividends and repatriation.
- Total-investment/equity discount rates, short NPV length, reference point, MIRR borrowing and reinvestment rates.
- Fixed assets, currency/origin, dated acquisitions, all four depreciation methods, depreciation start, life/rate/scrap, asset disposal; separate pre-production expenditure.
- Direct/indirect production costs, nominal-capacity and per-unit standard cost modes, fixed/variable split, sales/production basis, annual adjustments and initial stocks.
- Product-specific sales quantities, prices, taxes/duties, subsidies and finished-goods balances.
- Working-capital units/value modes, materials, supplies, utilities, WIP, finished products, receivables, cash, payables, initial stocks, starting balances and short-term deposits.
- Equity, grants/subsidies, long-/short-term loan conditions, dated drawdowns/profile repayments/rate resets, interest capitalization and depreciation, fee bases/currency/payment/depreciation, and profit distribution.
- Progressive tax brackets by period, tax holidays, loss carry-forward, investment/depreciation allowances and local/foreign depreciation adjustments.
- Expansion/rehabilitation opening assets, inventories, receivables, cash, deposits, payables, debt and equity.
- Economic method, numeraire, official/shadow FX, standard conversion factor, economic discount rate, trade categories, price adjustment factors, taxes/subsidies, foreign loans, indirect effects and employment.
- Global sensitivity, target IRR/NPV searches, parametric chart variables and incremental-analysis perspectives.

The common quantity / unit-price / total rule is applied interactively to asset acquisitions, standard cost inputs and period cost adjustments. Only the missing value is derived when exactly two values are present.

`frontend/src/features/projects/projectModelFormulaRules.ts` retains the original asset depreciation and debt primitives. `projectModelHelpFormulaRules.ts` adds reference-based cost build-up, working-capital turnover/movement, the default sales-production inventory bridge, progressive tax, loss carry-forward, segmented 30/360 loan interest, fee bases, NPV/MIRR timing, dividend priority, asset disposal, foreign-currency debt adjustment, automatic construction equity/operating overdraft and short-term deposit interest. The regression suites exercise these formula primitives. The Linear to Zero method uses the original-book-value annual charge and preserves the terminal scrap value through the final-period adjustment, as specified in XI.H; it is not an instruction to force book value to zero.

Dated loan-interest accrual now validates ISO calendar dates, requires an interest rate effective on or before the start of every calculation interval, rejects duplicate rate-effective dates and out-of-period cash events, and applies drawdowns/repayments at their effective date before accruing interest over the following 30/360 segment. Events on the interval end date affect closing principal but do not accrue interest inside the completed interval. Regression cases cover missing opening rates, duplicate rate dates, invalid calendar dates, out-of-range events, over-repayment and an in-period principal repayment. This closes a previously identified fallback defect in which a rate first effective after the calculation start could incorrectly be applied retroactively.

**Calculation boundary:** these new forms are persisted and validated, but they are not yet the authoritative inputs to the existing project cash-flow engine or the three financial statements. The formula primitives are separately tested. The next integration phase must map validated form data to the calculation graph and reconcile every period with a genuine COMFAR output file. Until that work is completed, these new form entries must not be presented as recalculated project metrics.
