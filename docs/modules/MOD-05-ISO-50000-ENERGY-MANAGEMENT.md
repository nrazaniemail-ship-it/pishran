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

Opportunities are registered with a responsible owner, due date, resource, and expected annual savings. Expected savings are forecasts, not verified savings. Verification must be based on measured post-implementation data and an appropriate M&V boundary.

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

Gas records may optionally include a documented calorific value in kWh/Nm³. Only when supplied and positive is volume converted to kWh and GJ; the module also reports Nm³/t, kWh/t and cost/GJ. No default calorific value or standard-condition correction is assumed. If the source calorific value is reported in MJ/Nm³, it must be converted explicitly before entry (1 kWh = 3.6 MJ).

Water balance is maintained separately from energy totals. The boundary accounts for freshwater withdrawal and external reclaimed-water inflow against discharge, evaporation/losses, water incorporated in product and storage increase. Internal recirculation is shown as a separate circulation indicator and is not double-counted as external supply. The module reports boundary closure, freshwater withdrawal intensity, net consumption intensity, external reuse share and internal recirculation intensity. A 5% closure warning is a screening threshold, not a universal ISO acceptance criterion; define site-specific measurement uncertainty and boundary rules for formal reporting.
