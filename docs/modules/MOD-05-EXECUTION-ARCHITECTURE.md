# MOD-05 execution architecture — Energy Intelligence

## Scope and current-state baseline
This increment extends the existing MOD-05 local-first workflow. Existing electricity bill OCR, electricity/gas/water ledgers, meter reconciliation, production-intensity baseline, gas calorific-basis checks, water balance, electricity cost allocation and explicit MOD-02 handoff are retained. This is not a parallel module and does not claim ISO certification.

## Architecture boundaries
- UI: ModuleEnergyPanel and ElectricityBillAnalysis; advanced insights are a read-only projection over saved energy records.
- Domain: energyManagementWorkflow.js remains the canonical validation, persistence and existing electricity bill-allocation layer. energyIntelligenceEngine.js provides deterministic multi-period series, anomaly screening, trend forecasts and gas invoice allocation.
- Persistence: existing localStore keys remain unchanged. No destructive migration or replacement of historical records is introduced.
- Integration: MOD-02 receives only a selected cost-centre allocation with invoice provenance; posting remains explicit. MOD-03 production context is represented by the period/site/SEU/production denominator and can be connected through a future adapter.
- Audit: source bill ID/number/period, allocation basis and duplicate-posting guard are returned with allocation results.

## A — Multi-period analysis
Records are partitioned by resource + site + significant energy use before comparison. Period order is numeric-token based (works with Persian-calendar labels such as 1405/01). Duplicate periods and invalid records are surfaced as warnings. Gas thermal comparison is enabled for an entire series only if every included period has a positive thermal-energy value, the same gross/net basis, and identical non-empty reference conditions; otherwise the entire series uses Nm³ to avoid mixing unlike units. Outputs include period consumption change, production-normalized intensity change, cost per tonne and the comparison basis.

## B — Utility cost allocation
Electricity allocation remains component-aware: kWh, peak kW, reactive kVArh, tax on pre-tax allocations and an explicitly disclosed residual rule. Gas allocation supports volume, thermal energy, transport, fixed, declared other and tax components; declared other charges remain distinct from unclassified invoice residual. Fixed charges use contracted-capacity shares when supplied and otherwise equal shares with a warning. Missing volume or thermal drivers cause rejection rather than invented weights. Every allocation reconciles to the invoice total. MOD-02 handoff is an explicit preparation step and must not post the same bill twice.

## C — Forecast and anomaly screening
Anomaly screening compares the latest period against the median of the previous four periods, using a minimum 20% deviation and a robust median-absolute-deviation threshold. It is a deterministic screening rule, not an AI diagnosis. Forecasting uses ordinary least squares over production-normalized intensity, requires at least three valid periods, supports up to 12 future periods and accepts optional future production assumptions. The RMSE band is an indicative error band, not a calibrated confidence interval or guaranteed savings.

## Validation and acceptance
Automated module tests cover site/SEU isolation in trend and baseline comparisons, gas-basis consistency, trend deltas, minimum forecast history, anomaly thresholds, utility allocation and reconciliation, water-balance boundaries, missing cost drivers, MOD-02 provenance, tariff component handling, M&V uncertainty propagation, encrypted evidence attachments, and authenticated backup/restore. For the current delivery scope, acceptance is web-only: frontend validation, TypeScript checks, production build, deployment and public PWA verification must all complete against the exact same `main` SHA. Android APK and iOS IPA workflows remain intentionally disabled; no mobile validation claim is made.


## D — Extended operational drivers
Energy records may include optional measured product-mix index, ambient temperature, feed-quality index and shutdown hours. The normalization engine uses complete, variable driver series only; it never imputes missing observations and requires sufficient training degrees of freedom before adding a coefficient. Excluded drivers and reasons are returned as warnings. The latest period remains held out for rolling-origin comparison.

## E — Tariff, M&V and protected evidence
The web workflow now supports site-specific contract tariff calculation (including configured gas transmission/distribution, water sewer, time-of-use bands, tiers, meter multipliers and explicit levies), reconciliation against registered utility bills, expanded M&V uncertainty with correlations, sensitivity coefficients, Welch–Satterthwaite degrees of freedom and an AR(1) effective-sample-size adjustment, AES-GCM evidence attachments, and encrypted user-managed MOD-05 backup/restore. Rates and assumptions are never supplied as defaults. The full calculation assumptions, unsupported bill components and security limitations are documented in `MOD-05-ISO-50000-ENERGY-MANAGEMENT.md`.

## Remaining integration boundary
MOD-03 currently persists OEE observations, but its current analysis input contract does not provide a governed site/SEU/period production ledger that can be safely joined to MOD-05. MOD-05 therefore continues to require explicit production denominators and does not silently infer them from OEE counts. A future adapter requires shared site, product, unit, period and source identifiers plus explicit conversion/aggregation rules and provenance. No automatic MOD-02 posting or cloud document storage is implied.
