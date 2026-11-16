# Help-driven project model foundation

## Design boundary

This implementation uses the COMFAR III Expert Reference Manual as a structural and formula reference only. It deliberately excludes every project-specific report, workbook, benchmark amount, financing ratio, tax rate, depreciation assumption, price, cost, capacity and operating schedule. Those sources are reserved for a later, separately controlled simulation and reconciliation phase.

## Reference model structure

The model is organized as a project tree, not as a single long form. Its standard first-level modules are:

1. Project identification and analysis level
2. Planning horizon and period calendar
3. Products and capacity definitions
4. Currencies and period exchange rates
5. Optional cost-centre structure
6. Optional inflation indices
7. Optional joint-venture partners
8. Discounting and valuation conventions
9. Fixed investment and asset register
10. Production costs (direct and indirect)
11. Production and sales programme
12. Working capital
13. Sources of finance
14. Taxes and allowances
15. Conditional starting balances for expansion/rehabilitation
16. Optional economic analysis

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

`frontend/src/features/projects/projectModelSchema.ts` provides the initial typed module tree, conditional module visibility, empty draft factory, common financial-item metadata, and quantity/price/total derivation.

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

The editable form panel currently covers:
- Asset register, dated acquisitions, asset-level depreciation method/life/rate/salvage percentage, and disposal events.
- Direct and indirect cost items, product association, nominal-capacity or per-unit basis, fixed/variable split, standard inputs and period adjustments.
- Product sales by period, net price, sales tax, subsidy and finished-goods closing quantity.
- Working-capital components, days coverage, turnover coefficient, valuation basis and dated balances.
- Loan facilities, repayment type/interval, dated drawdowns, custom profile movements, dated rate resets, capitalization share and fee items.
- Tax system, period tax rates, allowances and loss carry-forward settings.

The common quantity / unit-price / total rule is applied interactively to asset acquisitions, standard cost inputs and period cost adjustments. Only the missing value is derived when exactly two values are present.

`frontend/src/features/projects/projectModelFormulaRules.ts` contains independent, pure calculation primitives for nominal-capacity costs, per-unit costs, 360-day working-capital turnover and movements, asset depreciation methods, annuity repayments and debt roll-forward. The regression suite checks these formulas, including zero-interest loans and the distinction between straight-line-to-zero and straight-line-to-salvage.

**Calculation boundary:** these new forms are persisted and validated, but they are not yet the authoritative inputs to the existing project cash-flow engine or the three financial statements. The formula primitives are separately tested. The next integration phase must map validated form data to the calculation graph and reconcile every period with a genuine COMFAR output file. Until that work is completed, these new form entries must not be presented as recalculated project metrics.
