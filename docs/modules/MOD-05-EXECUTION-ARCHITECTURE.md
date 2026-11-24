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
Automated module tests cover site/SEU isolation in both trend and baseline comparisons, gas-basis consistency, trend deltas, minimum forecast history, anomaly thresholds, gas allocation component reconciliation (including separately declared other charges and unclassified residual), water-balance period/boundary metadata, missing cost drivers and MOD-02 provenance. Web CI must complete on the exact branch SHA. Android APK build and emulator smoke test must complete on that same SHA before mobile validation is claimed.
