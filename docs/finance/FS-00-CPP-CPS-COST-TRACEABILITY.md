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
