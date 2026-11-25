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

The module supports a transparent production-intensity baseline (EnPI = consumption / production), normalized to actual production, and a rolling-origin multivariable OLS screening model. The latter holds out the latest usable measured period and can include production, operating hours, and complete, varying optional drivers (product mix, ambient temperature, feed quality and shutdown hours). Estimated records are excluded; missing or constant drivers are not imputed. Both methods are operational screening tools, not formal savings verification. Material variables, model fit, meter quality and the M&V boundary must be reviewed before any savings claim.

Meter opening/closing readings are optional but, when supplied, both are mandatory and their difference must reconcile with recorded consumption within a small tolerance. Estimated and metered data are labelled separately.

## Improvement actions

Opportunities are registered with a responsible owner, due date, resource, and expected annual savings. Expected savings are forecasts, not verified savings. Verification now requires a saved verification period, measured savings, verifier identity and a note describing the measurement evidence / M&V method; the action cannot be marked verified without these fields. Verification must be based on measured post-implementation data and an appropriate M&V boundary. Every status transition is retained with timestamp and verifier attribution where applicable. If a verified action is reopened or cancelled, its active verification is cleared from the current state and archived in verification history; a new action cannot be created directly as verified. Status and prior-verification histories are included in the exported workbook and print report.

## Multivariable operational normalization

When at least six measured periods are available for the same resource, site and significant energy use, MOD-05 fits a rolling-origin ordinary-least-squares model using production and operating hours plus optional, complete and varying operating drivers (product mix, ambient temperature, feed quality and shutdown hours). The latest valid measured period is held out; estimated periods are excluded from model fitting and missing drivers are not imputed. Results expose training periods, selected predictors, coefficients, R² and RMSE. A weak fit, collinear drivers, nonphysical coefficients or nonpositive normalized consumption must be treated as a warning, not a savings claim. Site engineering review and a documented M&V method remain necessary.

## Data keys

- `module-intelligence:MOD-05:records:v1`
- `module-intelligence:MOD-05:baselines:v1`
- `module-intelligence:MOD-05:actions:v1`

All operational records are stored locally through the Pishran localStore. Additional MOD-05 stores are `module-intelligence:MOD-05:water-balances:v1`, `module-intelligence:MOD-05:cost-allocations:v1`, `module-intelligence:MOD-05:gas-bills:v1`, `module-intelligence:MOD-05:water-bills:v1`, and `module-intelligence:MOD-05:resource-cost-allocations:v1`, `module-intelligence:MOD-05:meter-calibrations:v1`, and `module-intelligence:MOD-05:mv-evidence:v1`; electricity bills use `ELECTRICITY_BILLS_KEY` from the electricity bill register.


## Implemented module scope and explicit limits

The current web implementation includes separate electricity, gas and water ledgers; meter reconciliation and data-quality labels; production-normalized baselines; gas calorific-basis controls; water boundary balances; electricity/gas/water bill capture and OCR review; bill-component cost allocation; controlled MOD-02 cost handoff with source provenance and duplicate-posting guards; multi-period trends; anomaly and forecast screening; rolling-origin multivariable normalization with optional operating drivers; improvement-action status and verification histories; and Excel / print-to-PDF reporting.

The web module includes a meter calibration register with certificate references, due-date alerts and revision history; saved M&V evidence packs; contract-driven tariff calculation and bill reconciliation; advanced uncertainty propagation; encrypted evidence attachments; and encrypted user-initiated backup/restore. Official rates and site contract terms must be supplied by the user. Centralized immutable audit storage, managed key escrow and independent verification remain out of scope. The module must not represent operational calculations or a prepared evidence pack as ISO certification or independent verification.

## Meter calibration register

The meter register stores the instrument ID, site, measured parameter and unit, calibration interval, last calibration date, calculated next due date, calibration laboratory, certificate / traceability reference, responsible owner, declared accuracy, measurement range and notes. Saving a new calibration for the same instrument and site retains the prior register entry in revision history. Instruments are labelled valid, due within 30 days, or overdue; the alert is a scheduling control and does not independently establish metrological traceability or certificate authenticity. M&V evidence packs capture the calibration status associated with each selected record's meter ID at preparation time. A missing meter ID or calibration record is disclosed as missing rather than inferred.

## Measurement and verification evidence packs

A prepared evidence pack binds one saved baseline to one or more measured actual records for the same resource, site and significant energy use. Estimated records and cross-boundary records are rejected. The pack snapshots the baseline, selected record IDs and periods, per-period production-normalized calculations, aggregate normalized baseline consumption, actual consumption, calculated variance, method label, named preparer / reviewer, measurement boundary confirmation, adjustment notes, evidence references, meter-calibration coverage and warnings. Packs are retained locally and included in Excel and print-to-PDF reports. The workflow requires explicit boundary confirmation and non-empty evidence references and adjustment notes; it does not independently authenticate technical claims, select a site-specific IPMVP / ISO 50015 method, or replace an independent technical review. Uncertainty calculation and attachment encryption are now implemented as described in the later sections. A positive variance is a calculated operational result, not automatically a verified energy saving.

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

These are screening rules, not an assertion that a bill is legally correct. A separate contract-driven tariff engine is now available as described in `Site-specific utility tariff contracts and calculations`. It requires the applicable tariff schedule, voltage level, billing dates, contract demand, seasonal rules, tax/fee treatment, reactive-energy rules, and any credits or adjustments to be entered and reviewed. A low power factor or demand above contract is a review flag; the module does not invent a penalty amount. OCR output and derived warnings remain subject to human validation.

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

Measured energy records can additionally capture product-mix index (0–100), ambient temperature (°C), feed-quality index (0–100), and shutdown hours. These drivers are optional and are never imputed. The rolling-origin OLS model includes an optional driver only when it is complete and varies across the entire usable series, and only when the training sample retains at least two residual degrees of freedom after adding the coefficient. Missing or constant drivers are explicitly listed as excluded; collinear or non-identifiable models are rejected. The latest usable period remains held out. Index definitions and measurement methods must be documented consistently by the site; these generic numeric indices do not replace plant-specific engineering definitions or formal M&V review. The printed PDF report now carries each period's optional-driver values alongside its consumption and production data, and the multivariable model table exposes the included predictors, fitted coefficients and model-specific warnings. Missing optional values remain displayed as unavailable rather than being filled or inferred.


## Site-specific utility tariff contracts and calculations

MOD-05 now provides a configurable contract register for electricity, natural gas and water. Each contract records resource, site, utility supplier, contract number, currency, effective dates, billing unit, flat or progressive consumption rates, fixed charge, optional demand and reactive-energy rates, tax percentage, notes and revision history. Progressive tiers are entered as ascending cumulative upper limits and rates, separated by semicolons, with the final tier expressed as `*:rate` (for example, `1000:1200;5000:1500;*:1800`). The calculation engine applies marginal tier blocks, fixed charges, demand/reactive components and the configured tax rate, and stores the contract reference with each calculation.

A tariff calculation is rejected when the contract does not match the selected resource and site, or when the billing date falls outside the contract validity period. No tariff, currency, tax treatment, demand rate or regulated price is assumed by the application. Contract rates and the tax base must be checked against the executed contract, the official bill and applicable regulatory rules. The tariff calculator is a contract-driven estimate and does not automatically reconcile or post an invoice to an ERP ledger.

## M&V uncertainty budget and attached evidence

The current M&V uncertainty implementation supersedes the original independent three-term root-sum-square model. It supports correlated baseline/actual/model contributions, sampling and resolution terms, sensitivity coefficients, a systematic-bias bound, effective sample size, component degrees of freedom and a Welch–Satterthwaite approximation. The resulting interval and distinguishability interpretation are described in `Expanded M&V uncertainty model`.

The original three-input uncertainty calculation has been superseded by the expanded budget described below. The current model supports correlated baseline/actual/model contributions, sampling and resolution terms, a conservative systematic-bias bound, and configurable sensitivity coefficients. Inputs, assumptions, degrees of freedom and the project-specific M&V plan still require competent technical review.

Evidence documents can be attached to an M&V pack (up to 10 files, 5 MB each and 20 MB total per pack). Files are stored with the local MOD-05 evidence record and can be downloaded from the saved pack. This remains local browser storage, not a centrally governed document repository, digital-signature service or immutable audit vault. Encrypted user-initiated export and restore are now available as described in the Encrypted backup and recovery section; users remain responsible for exporting and safeguarding copies.

Tariff contracts, saved tariff calculations, M&V uncertainty budgets and attachment names are included in the Excel export; the print/PDF report includes tariff calculations, uncertainty intervals and attachment references. A displayed tariff calculation is not a substitute for checking the signed contract and utility bill. A calculated M&V variance, even when outside the entered uncertainty interval, is not independently verified savings or formal ISO 50015 conformity.


## Actual utility-bill reconciliation

MOD-05 can now reconcile a saved tariff calculation against a selected registered electricity, gas or water bill. The report compares the billed consumption, the modeled line items available for that resource, tax/levies where present, and the payable total. A user-configured percentage tolerance is applied to each compared amount; the consumption quantity is compared separately. Every line is classified as within tolerance, discrepancy, not provided, or not modeled. The overall report is marked reconciled only when all comparable lines are present and within tolerance; otherwise it is explicitly incomplete or discrepancy-bearing.

The report retains the contract and calculation identifiers, bill/account identifiers, both periods, currency, line-by-line differences, discrepancy counts and warnings. A mismatch does not automatically mean the utility bill is wrong: it can also arise from an incomplete contract, time-of-use blocks, taxes, regulated adjustments, rounding, meter multipliers, distribution/sewer charges or period alignment. Components not represented by a configured contract or bill schema are never silently treated as zero or as a match; they are flagged not modeled. The user must validate bill period boundaries, meter multipliers, tax basis and omitted contract components before posting or disputing an invoice.

## Expanded M&V uncertainty model

The M&V uncertainty budget now supports standard relative uncertainty contributions for baseline, actual measurement, model/adjustment, sampling and instrument resolution, a residual systematic-bias bound, and pairwise correlation coefficients between baseline, actual and model contributions. The three primary correlated components are combined using the covariance terms; sampling and resolution are combined as independent random components. The residual systematic bound is then added linearly to the expanded random uncertainty as a conservative allowance. The 3×3 correlation matrix is checked for positive semidefiniteness before calculation. The selected coverage factor is applied to the combined standard random uncertainty, and the resulting interval controls the distinguishability warning.

This is a configurable uncertainty budget, not an automatic GUM-compliant uncertainty evaluation. It assumes the user-entered percentages are standard relative uncertainties, sampling and resolution contributions are independent of the three correlated components, and the residual systematic bound is suitable for linear conservative addition. Non-linear propagation, arbitrary time-series dependence, covariance involving sampling/resolution and full metrological traceability are not inferred. The implemented degrees-of-freedom, sensitivity and AR(1) treatments are engineering approximations, not a complete GUM evaluation. Technical ownership must document the inputs and justify correlations and coverage factor.

## Encrypted local evidence vault

New M&V attachments are encrypted in the browser before being persisted. The implementation uses AES-256-GCM with a unique random 96-bit IV per file, a random 128-bit PBKDF2 salt per pack, PBKDF2-HMAC-SHA-256 with 310,000 iterations, and a 256-bit derived key. The passphrase is used in memory only and is not saved in browser storage. Files are decrypted only when the user enters the same passphrase to download them. Authentication failure (wrong passphrase or modified ciphertext) prevents decryption.

The encryption protects newly saved file contents at rest in the browser's local MOD-05 store. It does not protect files while the browser is unlocked, against malware or a compromised device, or against deletion/clearance of browser storage. There is no centrally managed key recovery: if the passphrase is lost, the encrypted files cannot be recovered. Previously saved M&V packs with plaintext Base64 attachments remain legacy plaintext records until the user reattaches them in a new encrypted pack; they are labeled as legacy in the UI. The vault is not a centrally administered document-management system, digital-signature service or immutable audit vault. Encrypted user-initiated backup and recovery are available separately as described below.

## Advanced tariff components and bill reconciliation

The contract model now supports optional user-entered gas transmission and distribution rates, water sewer rates, meter multipliers, time-of-use rate bands, and configurable levies. Time-of-use rates use band:rate entries separated by semicolons; calculation requires the matching consumption quantity for every used band, and the sum of band quantities must reconcile to the unadjusted meter quantity. A meter multiplier is applied to the measured quantity before rate calculation. Levies use label|fixed|value, label|unit|value, or label|percent|value entries separated by semicolons; percentage levies are calculated on the modeled pre-tax charge subtotal. Tax is then applied to the subtotal including configured levies.

Gas transmission/distribution and sewer charges are calculated only when the corresponding contract rate is explicitly entered. The engine exposes each modeled amount and each unconfigured component in the saved calculation. The bill reconciliation compares gas transmission, gas distribution, sewer, time-of-use line items and levy entries when the matching bill fields are present. Missing bill lines remain not-provided; unconfigured contract components remain not-modeled or are surfaced in calculation warnings. The application does not supply official tariff rates, regulatory levies, tax rules or default multipliers. Users must verify the exact tax base and charge ordering against their signed contract and official bill; the implemented percentage levy base is the documented application convention, not an assertion about every utility's legal tariff.

## Advanced uncertainty: degrees of freedom, autocorrelation and sensitivities

The M&V uncertainty budget accepts degrees of freedom for baseline, actual measurement, model and sampling contributions, along with observation count and lag-1 autocorrelation. The AR(1) approximation estimates effective sample size as n × (1 − ρ₁) / (1 + ρ₁) and inflates the sampling standard uncertainty by the square root of the ratio between nominal and effective sample sizes. When component degrees of freedom are supplied, a Welch–Satterthwaite effective degrees-of-freedom estimate is calculated from the individual variance contributions. A two-sided 95% Student-t coverage factor is approximated using a Cornish–Fisher expansion when finite effective degrees of freedom are available; otherwise the user-specified coverage factor is used.

Dimensionless sensitivity coefficients are supported for baseline, actual, model, sampling and resolution contributions. Their absolute values scale standard uncertainty magnitudes; signed coefficients are retained in covariance propagation so the direction of the measurement equation is not discarded. The default sensitivity signs represent baseline minus actual plus model. Correlation-matrix positive-semidefinite validation remains active.

These are explicit engineering approximations, not a complete GUM evaluation. Welch–Satterthwaite is approximate when the primary components are correlated because covariance terms do not have independently allocated degrees of freedom. The AR(1) effective sample size is only a first-order model for approximately stationary equally spaced observations; irregular intervals, higher-order autocorrelation, seasonality, trends and nonstationarity require a time-series model or block bootstrap. The Student-t factor is an approximation, and technical reviewers must retain the underlying observations, calibration evidence, uncertainty distributions, sensitivity derivation and rationale for correlation and degrees of freedom. Missing degrees of freedom are not fabricated.

## Encrypted backup and recovery

MOD-05 now provides a user-initiated encrypted JSON backup covering energy records, baselines, actions, water balances, utility bills, cost allocations, meter calibration records, M&V evidence packs, tariff contracts, calculations and reconciliation reports. The backup payload is encrypted in the browser with AES-256-GCM, a random 96-bit IV and a random salt using the same PBKDF2-HMAC-SHA-256 derivation profile (310,000 iterations). The authenticated manifest contains the schema version, creation time, key count and SHA-256 checksum of the plaintext payload. Restore authenticates/decrypts the ciphertext, verifies the checksum and allowed storage-key set before writing any records. The restore path snapshots existing values and attempts rollback if a storage write fails.

Backups are not uploaded to a server. Users should store the exported encrypted file in an access-controlled location separate from the device and keep the passphrase in a separately protected password manager or recovery process. A lost passphrase makes the backup unrecoverable. The application cannot guarantee atomic rollback if the browser storage engine itself fails during both restore and rollback; users should retain the pre-restore backup and test restoration on a separate browser profile/device before relying on it. This is a local encrypted export/import workflow, not centrally managed retention, remote disaster recovery, immutable audit logging or managed key escrow.


## EnB and SEC calculation workspace

The web interface provides a dedicated EnB/SEC workspace based on the two supplied reference workbooks. It records period, site, significant energy use (SEU), production (tonnes), electricity (kWh), natural gas (Nm³), water (m³), oxygen (Nm³), and the heat-treatment share removed from the reported intensity. Records are locally persisted and a repeated period/site/SEU entry replaces that same period key rather than creating a duplicate.

For each carrier, SEC is period consumption divided by period production. Electricity is reported in kWh/t; gas and oxygen in Nm³/t; water in m³/t. Thermal gas SEC is additionally converted using 1 Nm³ = 0.03768 GJ. Electricity conversion is 1 kWh = 0.0036 GJ. The reference workbook's adjusted column multiplies consumption by 0.85 (15% heat-treatment exclusion); the new form exposes the excluded share per period and keeps raw and adjusted SEC distinct.

A selected reference period defines the EnB intensity for the matching site and SEU. Period-specific EnB consumption is that reference SEC multiplied by the period's production. The interface charts electricity SEC against the configured electricity limit, gas thermal SEC against the configured thermal limit, actual electricity against production-normalized EnB, and water/oxygen SEC trends. The table retains the raw and adjusted values.

The benchmark expressions transcribed from the reference workbook are:
- Electrical SEC limit: (95 × G × H) + I, in kWh/t.
- Thermal SEC limit: 1.1 × A × B × C × D × E × F, in GJ/t.
- The workbook also shows reference values of 146.4 kWh/t and 52 Nm³/t (approximately 1.95936 GJ/t) as example limits. These are not automatically imposed as universal limits.
- Factor descriptions A–I and example coefficients are visible and editable in the UI. Where the workbook refers to an additional relation for factor A below 50% hot charge or factor C for a pit furnace but does not provide that relation, the form does not invent it; the site owner must supply a documented value.
- The source workbook does not define water or oxygen SEC limits. Their intensities are charted without invented compliance thresholds.

The workspace is local-first and independent of the earlier generic monitoring records. It does not import the sample workbook's historic observations automatically; users enter or import their own period values into the dedicated form. This avoids silently treating historical sample data as the user's plant data.
