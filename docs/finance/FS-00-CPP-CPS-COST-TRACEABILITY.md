# FS-00 — CPP/CPS component traceability and posting controls

## Purpose and status

This register defines the evidence and posting contract for the five production-cost families used by FS-00: materials, direct labour, energy, maintenance, and overhead. It is source-first: a missing source amount is **unknown**, never zero. The CRC200 example is not a source of numeric defaults. Until an identifiable primary document, audited report, or other accepted evidence is attached and verified, its amount, base-cost coverage, and uncovered portion remain blank/null.

The implementation is on the FS-00 feature branch. This document describes the implemented data contract and calculation path; it does not claim independent parity with a COMFAR report unless a period-by-period reference schedule and matching units/currency are available.

## Component register

| Component | CPP/CPS treatment | Required calculation basis | Fixed/variable classification | Base-cost coverage test | Source evidence | Posting destination |
|---|---|---|---|---|---|---|
| Raw and auxiliary materials | Material component of CPP; material value follows stock issues and WIP | Per-unit output, nominal capacity, period total, or period adjustments — explicitly selected per item | Fixed, variable, or mixed; mixed split must total 100% | Compare gross evidenced material cost with the portion already included in the product's base CPP; only the evidenced uncovered balance is incremental | Purchase/invoice records, consumption norms, stock records, approved cost sheets, or audited schedules | Raw-material inventory → WIP → finished goods → CPS on sale; raw-material and WIP balances enter working capital |
| Direct labour | Conversion component of CPP | Explicit selected basis; payroll period and production period must align | Fixed, variable, or mixed with explicit percentages | Reconcile payroll amount against labour already included in base CPP; do not add fully covered payroll again | Payroll register, approved staffing/pay-rate schedule, time sheets, audited cost-centre report | Production cost/WIP → finished goods → CPS on sale → gross profit; unpaid payroll may be a working-capital liability only when separately evidenced |
| Energy | Conversion component of CPP | Explicit selected basis (e.g. metered consumption × tariff, nominal capacity, or period total) | Fixed, variable, or mixed | Compare the evidenced energy charge with energy embedded in base CPP; add only the uncovered part | Meter readings, utility invoices, tariff schedule, or audited energy-cost report | Production cost/WIP → finished goods → CPS on sale; accrued unpaid utility amounts affect working capital only through a separately sourced payable |
| Maintenance | Production conversion cost when attributable to manufacturing | Explicit selected basis; period adjustments require a documented amount and allocation | Fixed, variable, or mixed | Distinguish maintenance already included in base CPP from separately evidenced incremental maintenance; capital expenditure is not an operating maintenance charge | Work orders, maintenance ledger, service invoices, approved maintenance budget, asset register for capitalization decision | Expense portion → production cost/WIP → finished goods → CPS; capitalized replacement/improvement is routed to fixed assets, not CPP |
| Production overhead | Indirect production cost; allocation requires an explicit cost-centre driver | Explicit selected basis and cost-centre allocation driver | Fixed, variable, or mixed | Compare the source overhead pool with overhead embedded in base CPP; only the verified uncovered pool can be allocated | Cost-centre ledger, audited overhead schedule, allocation policy, driver quantities/revenue, or approved period records | Cost centre → product allocation → production cost/WIP → finished goods → CPS; only separately evidenced accrued balances enter working capital |

## Required fields for every item

Each item must have a stable unique ID and label, one of the five categories, a calculation basis, fixed/variable behaviour, a fixed and variable percentage, cost-centre ID, allocation method, base-cost coverage status, period amounts, base-covered period amounts, and source metadata.

Accepted allocation methods are:

- **Direct product:** requires a product ID.
- **Production quantity:** allocates across products by period production quantity.
- **Revenue:** allocates across products by period net sales revenue.
- **Cost-centre driver:** requires a cost centre with a configured production-quantity, sales-revenue, or complete manual period driver.
- **Not allocated:** may remain descriptive/zero-incremental; a positive uncovered amount cannot be posted using this method.

A fixed item must be 100% fixed; a variable item must be 100% variable. A mixed item must have non-negative fixed and variable percentages summing to exactly 100% (within the engine's numeric tolerance). This classification describes cost behaviour; it does not replace the allocation driver.

## Calculation and anti-double-counting rule

For each verified item and period:

`Incremental CPP = Gross evidenced cost - Base-covered amount`

Coverage treatment:

- **Fully included:** base-covered amount equals gross cost; incremental CPP is zero.
- **Excluded:** base-covered amount is zero; the evidenced gross amount is incremental.
- **Partially included:** the user must provide an evidenced base-covered amount between zero and gross cost.
- **Unverified:** period gross and covered amounts must both remain null; the item cannot be posted.

The engine retains known incremental subtotals separately from complete totals. If any item is unverified, the complete period total is null and the posting gate remains closed. An unverified cost-centre item also makes that centre's complete total unavailable; an unallocated unverified item prevents complete centre totals from being represented as complete. No missing value is silently replaced with zero.

## CPP → CPS → profit and loss

1. Verified incremental material cost is allocated to products and follows raw-material stock issue into WIP.
2. Verified incremental labour, energy, maintenance, and overhead are conversion cost. Where inventory-flow data exist, conversion cost is assigned between completed units and closing WIP using equivalent units.
3. Completed production cost is transferred to finished goods. Opening/closing finished-goods quantity and value are rolled forward by product and period.
4. Cost of sales is recognized when the corresponding finished goods are sold. Unsold production remains in finished-goods inventory; it is not expensed prematurely.
5. CPS is deducted from net sales revenue to derive gross profit. The base CPP remains in the product schedule; the adapter posts only the uncovered incremental amount, preventing a second charge for costs already included in the base.
6. Normal waste is absorbed once at weighted-average raw-material cost. Abnormal waste is separately expensed and must not be reintroduced as normal material consumption.

## Working-capital connection

Raw-material closing stock, WIP, and finished-goods stock are current-asset components. They must be connected to the working-capital schedule once, with matching inventory subledgers and balance-sheet controls. Cost of sales is not itself an additional working-capital asset. Trade payables, accrued payroll, utility creditors, and other operating liabilities are included only when a distinct balance and source are provided; do not infer a payable merely because an expense exists.

Inventory control compares, by period, the project model, balance sheet, and CPP/CPS inventory totals. The raw-material, WIP, and finished-goods detail must reconcile to the reported total inventory. Transfer-ledger quantity and value deltas are keyed by period, product, and cost centre (`period:product@costCentre`), so opposite movements in different periods cannot cancel each other in the audit totals. Transfers between products/cost centres preserve total group cost and must balance at source and destination. The current transfer ledger is a movement register, not a full cost-centre stock subledger: source-centre availability against its own opening stock, receipts, issues, and closing balance remains unverified until those centre-level stock movements are entered and reconciled separately.

The calculation layer now exposes a cost-centre inventory roll-forward validator. For each explicit period/product/cost-centre row it requires opening quantity/value, receipts, production, consumption, waste, and closing quantity/value. It applies the signed transfer register to the location balance and tests:

- Closing quantity = opening quantity + receipts + production + transfer-in − transfer-out − consumption − waste.
- Closing value = opening value + receipts value + production value + transfer-in value − transfer-out value − consumption value − waste value.
- Each next-period opening quantity/value must equal the prior period's closing quantity/value when consecutive rows are supplied.
- Every transfer endpoint must have a matching centre movement row; transfer-only or incomplete rows cannot silently pass.

This validator is an explicit calculation contract with regression coverage; it is not yet a user-facing input form or an automatic feed from the production/CPP-CPS schedules. Raw-material, WIP, and finished-goods stage-specific centre subledgers and their UI bindings remain separate follow-on work.

## Evidence and completion gates

A source is verified only when its reference, description, and reliability classification are populated and the item is explicitly marked verified. A source change that removes verification resets its amount/coverage evidence. The final CPP/CPS posting gate requires a valid and complete source ledger, aligned project periods, a valid product operating schedule, and a valid allocation driver wherever allocation is needed.

The following CRC200 entries are intentionally **not populated** until supporting source evidence is available:

- Gross period amounts for all five cost families.
- Amounts already included in the base CPP.
- Incremental uncovered amounts.
- Fixed/variable splits where no reliable cost-behaviour evidence exists.
- Allocation drivers and any working-capital payable/creditor balances not explicitly documented.

## Verification scope and known limits

The automated regression scripts cover ledger validation, null preservation, base-coverage arithmetic, allocation, CPP/CPS schedule integration, inventory flow and reconciliation, and sales-tax working-capital binding. A green build/test run proves those code paths pass their internal tests on the tested commit. It does not establish that CRC200 inputs are factually correct or that all reported periods match COMFAR. External parity still requires source-backed, same-currency, same-period reference values; aggregate COMFAR inventory cannot validate a detailed raw-material/WIP/finished-goods split when the reference does not publish that split.

## Cost-centre inventory movement form (FS-00 implementation boundary)

The project financial-form draft now persists a separate `costCentreInventoryMovements` collection. Each row is stage-specific (`raw-materials`, `work-in-progress`, or `finished-goods`) and identifies period, product and cost centre. It captures opening quantity/value, receipts, production/completion, consumption/issues, waste and closing quantity/value, plus a source reference and explicit verification flag.

- New rows initialize all quantities and values as `null`; the form never converts unknown amounts into zero.
- A row with entered data must contain all twelve finite non-negative amount fields, a valid period, product and cost-centre identifiers, a stage, and a verified source reference before the form validator accepts it.
- Duplicate period/stage/product/cost-centre keys are rejected.
- Partially entered rows and completed rows remain listed as unintegrated report blockers. This is deliberate: the current stage adds persistence, bilingual data entry and input validation only; it does **not** yet post the three inventory stages into the raw-material/WIP/finished-goods accounting engine or the balance sheet / working-capital schedules.
- The existing cost-centre roll-forward calculation contract still handles product/cost-centre movements and transfers, but it must not be reused indiscriminately for raw materials and WIP. The next integration step must define stage-specific posting semantics and reconcile inter-stage transfers without duplicating inventory value or CPP/CPS.

This boundary prevents an entered register from being mistaken for an integrated and tested financial calculation.

## Stage inventory cross-check (raw materials / WIP / finished goods)

The saved cost-centre movement rows are now passed into the financial panel. When at least one stage is entered, the panel runs a separate reconciliation for each populated stage:

- Each populated stage must have at least one row in every model period.
- Every row must have an explicit verified source reference and complete non-negative quantity/value fields.
- Product/cost-centre roll-forward is checked independently inside each stage, including period opening-to-closing carry-forward. Internal transfer-in and transfer-out quantities and values are captured separately and must balance within each stage and period; these transfers relocate inventory and do not increase total stage value.
- The sum of stage closing values by period is compared with the corresponding periodic finance-engine inventory balance (raw materials, work in progress, or finished goods).
- A mismatch, missing stage-period, invalid movement, or unverified source makes this cross-check fail visibly.

A stage with no subledger rows is accepted only when the finance engine reports zero closing inventory for that stage in every period. A non-zero engine balance with no stage/cost-centre movement rows is a visible reconciliation failure; it is never silently omitted.

Inter-stage transfer drafts are now also sent through the reconciliation gate even when no cost-centre movement rows have yet been entered. A completely untouched blank transfer row is ignored, but any partially or fully entered transfer must resolve to both a source-stage and destination-stage movement row; otherwise the reconciliation fails visibly. This is a **cross-check only**. It does not add the ledger closing value to inventory, CPP/CPS, or working capital a second time. The entered rows remain unintegrated report blockers until stage-specific receipts, issues, WIP conversion, finished-goods completion and inter-stage transfer posting are connected to the underlying accounting schedules. In particular, production quantity/value is not treated as a raw-material receipt without an explicit stage transition record.

## Inter-stage inventory transfers

A separate persisted transfer register now records movement between raw materials, work in progress and finished goods. Each transfer requires period, distinct source/destination stages, product and cost-centre endpoints, source quantity/unit, destination unit and conversion factor, transferred value, and a verified document reference.

- Both source-stage and destination-stage movement rows must exist for the same period and matching product/cost-centre endpoints.
- The source stage is relieved by the source quantity and transferred value; the destination stage receives the converted quantity and the same transferred value.
- Conversion or processing costs added at the destination remain separate production costs; the transfer itself does not create a second inventory value.
- Same-stage centre movements remain in the separate internal transfer-in/out fields and must balance by stage and period.
- Invalid, incomplete or unverified transfers fail reconciliation and remain report blockers.

The current bridge validates these movements against the existing engine balances. It does not yet create or post the underlying production conversion entries, nor does it automatically infer transfers from CPP/CPS source lines.
