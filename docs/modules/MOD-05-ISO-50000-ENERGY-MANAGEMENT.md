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
