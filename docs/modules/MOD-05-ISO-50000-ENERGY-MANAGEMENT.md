# MOD-05 — Energy and utility performance management

## Standards alignment

This module is an operational aid informed by the ISO 50000 family. It is not a certification or conformity assessment.

- ISO 50001:2018 and Amendment 1:2024: management-system / PDCA framing, operational control, objectives and continual improvement.
- ISO 50004:2020: implementation and continual improvement guidance.
- ISO 50002-1:2025 and ISO 50002-3:2025: energy-audit planning and process audit context.
- ISO 50006:2023: energy performance indicators (EnPIs) and energy baselines (EnBs).
- ISO 50015:2014: measurement and verification principles.

## Separate utility ledgers

Electricity is stored in kWh, natural gas in Nm³, and water in m³. Water is a resource-performance stream and is never added to electricity/gas energy totals. Each record captures a reporting period, site/process boundary, significant use/source, consumption, production/activity denominator, cost, optional meter readings, data quality and notes. Gas calorific value can be captured as supporting data; no assumed conversion is applied.

## Baseline and performance

The first implementation supports a transparent production-intensity baseline: EnPI = consumption / production. The baseline is normalized to actual production by multiplying baseline EnPI by actual production. The difference between normalized baseline and actual consumption is shown as a calculated variance. This simple ratio method is explicitly disclosed and must not be treated as formal savings verification when other material variables (weather, product mix, operating hours, feedstock quality, etc.) affect consumption. A future model-based normalization and documented M&V plan are required for formal claims.

Meter opening/closing readings are optional but, when supplied, both are mandatory and their difference must reconcile with recorded consumption within a small tolerance. Estimated and metered data are labelled separately.

## Improvement actions

Opportunities are registered with a responsible owner, due date, resource, and expected annual savings. Expected savings are forecasts, not verified savings. Verification now requires a saved verification period, measured savings, verifier identity and a note describing the measurement evidence / M&V method; the action cannot be marked verified without these fields. Verification must be based on measured post-implementation data and an appropriate M&V boundary. Every status transition is retained with timestamp and verifier attribution where applicable. If a verified action is reopened or cancelled, its active verification is cleared from the current state and archived in verification history; a new action cannot be created directly as verified. Status and prior-verification histories are included in the exported workbook and print report.

## Multivariable operational normalization

When at least six measured periods are available for the same resource, site and significant energy use, MOD-05 fits an ordinary-least-squares model using production and operating hours. The latest valid measured period is held out; estimated periods are excluded from model fitting. The model compares actual consumption with the consumption expected at the held-out period's production and operating hours. For gas, thermal energy is used only when all records share a documented gross/net calorific basis and identical reference conditions; otherwise the model remains on volume. Results expose training periods, coefficients, R² and RMSE. A weak fit, collinear drivers, nonphysical coefficients or nonpositive normalized consumption must be treated as a warning, not a savings claim. This two-driver model does not yet adjust for product mix, weather, feed quality, ambient conditions, shutdowns or other relevant variables; site engineering review and an appropriate M&V plan remain necessary.

## Data keys

- `module-intelligence:MOD-05:records:v1`
- `module-intelligence:MOD-05:baselines:v1`
- `module-intelligence:MOD-05:actions:v1`

All records are stored locally through the Pishran localStore.


Implementation scope in this increment: separate electricity, natural-gas and water ledgers; meter-reading reconciliation when readings are provided; data-quality labels; site/SEU boundaries; production-intensity baselines; normalized comparisons; and improvement-action registers. Advanced regression normalization, multi-variable adjustment, audit trails for calibration, and formal M&V evidence packs remain follow-on work.

## Electricity bill OCR and analytical controls

The electricity area includes a local-image OCR workflow. The user selects or captures a bill image; Tesseract.js recognizes Persian and English text in the browser and a deterministic parser proposes values for the editable bill form. OCR confidence is shown as a review signal, not as a field-level guarantee. No bill is committed until the user confirms it. The source image is previewed locally and is not persisted by this workflow; OCR language assets may be fetched by the browser at runtime.

The bill register captures billing period, account and meter identifiers, opening/closing readings, billed kWh, billing days, peak/mid/off-peak quantities, maximum and contracted demand, reactive energy, power factor, meter multiplier, tariff and voltage descriptors, and available bill-charge components. The parser is deliberately conservative and leaves unknown fields blank for manual review.

Analytical controls include:
- opening/closing meter delta multiplied by the meter multiplier against billed consumption (2% review tolerance);
- daily consumption comparison only against the most recent saved bill for the same meter or account, never an unrelated account;
- kWh per tonne when period production is supplied;
- demand-to-contract ratio and power-factor review;
- reconciliation of time-of-use quantities to total kWh (2% review tolerance);
- reconciliation of extracted charge components to payable total (3% review tolerance).

These are screening rules, not a tariff engine or an assertion that a bill is legally correct. Actual tariff calculation requires the applicable tariff schedule, voltage level, billing dates, contract demand, seasonal rules, tax/fee treatment, reactive-energy rules, and any credits or adjustments. A low power factor or demand above contract is a review flag; the module does not assume a penalty amount. OCR output and derived warnings remain subject to human validation.

Pure parsing and analytical logic is covered by frontend/scripts/validate-electricity-bill-analysis.mjs, included in npm run test:modules.

## Advanced gas and water analysis

Gas records may optionally include a documented calorific value in kWh/Nm³. Only when supplied and positive is volume converted to kWh and GJ; the module also reports Nm³/t, kWh/t and cost/GJ. The gas baseline form can retain its own period-specific calorific value. When both baseline and actual records have valid thermal-energy quantities, the EnPI comparison uses kWh/t and reports normalized thermal energy; otherwise it explicitly falls back to Nm³/t and warns that gas-quality variation is not represented. No default calorific value or standard-condition correction is assumed. The input captures whether calorific value is gross or net and the gas reference temperature/pressure conditions. Thermal EnPI comparison is permitted only when both periods have matching bases and identical documented reference conditions; otherwise the workflow falls back to volume intensity and raises a warning. Do not compare unlike bases. If the source value is reported in MJ/Nm³, convert it explicitly before entry (1 kWh = 3.6 MJ).

Water balance is maintained separately from energy totals. Freshwater withdrawal can be disaggregated into municipal supply, groundwater, surface water and other freshwater sources; when this breakdown is supplied, the module sums these categories rather than double-counting a separate aggregate freshwater input. The boundary accounts for freshwater withdrawal and external reclaimed-water inflow against discharge, evaporation/losses, water incorporated in product and storage increase. Each saved balance requires a reporting period, site/process and significant-use or measurement-boundary label so the history can be interpreted against a consistent operational boundary. Internal recirculation is shown as a separate circulation indicator and is not double-counted as external supply. The module reports boundary closure, freshwater withdrawal intensity, net consumption intensity, external reuse share and internal recirculation intensity. A 5% closure warning is a screening threshold, not a universal ISO acceptance criterion; define site-specific measurement uncertainty and boundary rules for formal reporting.

## Multi-period trends and electricity cost allocation

The multi-period trend view groups records by the selected resource and reports period consumption, production-normalized intensity, cost per tonne, and period-over-period changes. Gas thermal-intensity comparisons are used only between adjacent records with matching gross/net calorific basis and identical documented reference conditions; otherwise the trend remains on Nm³/t and does not imply equivalent fuel quality.

Electricity bill allocation is component-aware. Energy charges are distributed by consumer kWh, demand charges by the consumer's demand share (kW), reactive charges by reactive-energy share (kVArh), taxes by the pre-tax allocated components, and any unclassified residual by kWh. Each cost centre receives a reconciled allocated amount and, when production is supplied, cost per tonne. A charge component with no valid allocation driver is rejected rather than silently spread using an unrelated basis. The sum of allocations must reconcile to the payable bill total.

The MOD-02 handoff helper prepares the selected cost-centre allocation as the energy-cost input and retains bill ID, bill number, billing period and allocation amount as source references. It is an explicit preparation step, not an automatic posting. Use the prepared energy value once in MOD-02; do not add the full bill total again or duplicate the allocation in another energy-cost field. Tariff-specific fixed-charge rules and taxes still require verification against the actual bill and tariff contract.

 
The advanced insights panel adds site/SEU-separated series, a robust last-period anomaly screen (median/MAD with a minimum 20% deviation), a three-period-or-longer ordinary-least-squares intensity forecast, and a rolling-origin forecast-deviation check. The latter fits only prior periods and compares the held-out latest actual period with its forecast; a flag requires the deviation to exceed both the configured percentage floor and 1.96 × historical training RMSE. These are transparent operational screening methods, not calibrated prediction intervals, causal models, or verified energy savings. Review operating hours, product mix, weather, shutdowns, meter quality and production plans before acting.

The MOD-05 interface now provides a bill-component allocation workspace. It persists reconciled allocations locally under `module-intelligence:MOD-05:cost-allocations:v1`; MOD-02 can select a saved allocation and cost centre, replace the energy-cost input with that centre's share, and retain bill/allocation provenance in the analysis report. This remains a controlled user action. The system does not automatically post a journal entry or claim ERP ledger integration.


## Multivariable normalization (rolling-origin)

Energy records can optionally include measured operating hours in addition to production/activity. The multivariable screening model uses production and operating hours as separate explanatory variables and estimates consumption with ordinary least squares. For each site and significant energy use, it trains only on earlier measured periods and holds out the latest period for comparison. Estimated-quality records and periods without valid operating hours are excluded. At least six usable periods are required (five training periods plus one held-out period). The output reports coefficients, training R² and RMSE, latest-period normalized consumption and adjusted variance. A low R², singular/collinear predictors or nonphysical prediction is flagged; this screening model is not causal proof, an ISO-compliant M&V plan, or a verified savings claim. Product mix, weather, feedstock quality, operating state and other material drivers may still need explicit modelling.


## Improvement-action audit history

Improvement actions retain a chronological status history (including the actor/verifier identity when a verification transition is made) and preserve superseded verification evidence when an action is reopened or re-verified. New actions cannot be created directly in the verified state. The Excel report exports the status and verification histories so the operational record can be reviewed outside the browser. This is a local application audit trail; it is not a tamper-proof or centrally governed records-management system.


## Extended operational-driver normalization

Measured energy records can additionally capture product-mix index (0–100), ambient temperature (°C), feed-quality index (0–100), and shutdown hours. These drivers are optional and are never imputed. The rolling-origin OLS model includes an optional driver only when it is complete and varies across the entire usable series, and only when the training sample retains at least two residual degrees of freedom after adding the coefficient. Missing or constant drivers are explicitly listed as excluded; collinear or non-identifiable models are rejected. The latest usable period remains held out. Index definitions and measurement methods must be documented consistently by the site; these generic numeric indices do not replace plant-specific engineering definitions or formal M&V review.
