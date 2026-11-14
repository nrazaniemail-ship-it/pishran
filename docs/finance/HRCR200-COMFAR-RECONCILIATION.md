# HRCR200 hot-rolling line — CAPEX/OPEX and COMFAR reconciliation

**Source files**
- `CAPEX-HRCR200.Kashan.1402.07.10.rev01.xlsx`
- `OPEX-HRCR200.Kashan.1402.07.10. rev01.xlsx`
- `COMFAR III - 001 - نتایج تحلیل مالی و اقتصادی طرح.pdf` (135 pages)

All monetary figures below are in **million Rial** unless otherwise stated. This is an audit of the attached reference case, not a fresh vendor quotation or a bankable feasibility opinion.

## 1. Project definition loaded from the spreadsheets

| Item | Source value |
|---|---:|
| Project | Hot-rolled steel coil line, Kashan |
| Capacity | 200,000 t/y |
| Construction | 2 years (1403–1404 in COMFAR) |
| Operation | 15 years (1405–1419) |
| Slab consumption | 1.02 t per tonne of saleable product |
| Full-capacity coil revenue | 61,400,000 |
| By-product/scrap revenue | 859,600 |
| Total full-capacity sales | 62,259,600 |
| Annual raw materials and process consumables | 40,844,287 |
| Utilities | 269,580.166 |
| Spare parts | 176,473.792 |
| Maintenance | 374,760 |
| Payroll | 650,052.864 |
| Payroll overhead | 130,010.573 |
| Factory overhead | 159,060 |
| Direct marketing | 62,259.6 |
| Annual OPEX excluding depreciation | 42,666,484.392 |
| Annual OPEX including source-sheet depreciation | 44,246,811.392 |
| Fixed CAPEX | 18,463,009 |
| Pre-operation cost excluding capitalized interest | 239,826.638 |
| Capitalized construction interest in COMFAR | 3,298,633.06 |
| Construction investment incl. capitalized interest | 22,001,469.06 |
| Full-capacity net working capital | 4,595,370.36 |

The annual operating cost bridge is consistent: COMFAR's full-capacity operating costs of 42,604,224.43 plus marketing of 62,260 equal 42,666,484.43, essentially the OPEX workbook's 42,666,484.392. This means the annual OPEX totals are not the main source of the large cash-flow gap.

## 2. Audited COMFAR results

The COMFAR PDF's total-investment cash-flow report (pages 66–70) states:
- NPV: **31,399,764.27 million Rial**, at **25%**, valuation date **12/1404**
- IRR: **48.31%**
- MIRR: **28.03%** (COMFAR reports the result, but the extracted report pages do not disclose the finance/reinvestment rates used to calculate it; do not infer those rates from the result).
- Simple payback: **3.86 years**
- Discounted payback: **5.02 years**

The project cash-flow vector has 17 periods: two construction years and 15 operating years. The scrap inflow of 13,735,466.82 is a terminal inflow at the same terminal valuation point as operating year 1419; it is not an eighteenth operating year.

The COMFAR PDF's cash-flow NPV uses the valuation date 12/1404. Thus 1403 is at offset -1, 1404 at offset 0, and 1405 onward at positive offsets. A conventional NPV routine that always discounts the first array element at exponent zero will not reproduce this reported NPV unless the valuation date is made explicit.

## 3. Material design and source-data defects

### A. Financing assumptions conflict across the attached workbooks

- CAPEX sheet `نحوه تامین منابع` allocates about **70% equity / 30% long-term debt** to construction investment (equity 13,091,985.2; debt 5,610,850.8), with 3,298,633.06 of capitalized interest.
- CAPEX sheet `نرخ تنزیل` instead uses 3,740,567.07 equity, 14,962,268.29 fixed-investment debt, and 3,309,144.53 working-capital debt. This implies about **16.99% equity / 83.01% debt**.
- OPEX sheet `مشخصات کلی طرح` labels the finance amount as 80% and the equity amount as 20%, but the displayed values (5,610,850.8 debt and 13,091,985.2 equity) mathematically correspond to 30% debt and 70% equity.

These are not rounding differences. They are mutually inconsistent capital structures. The model must preserve them as separate scenarios and must not silently combine the funding-source sheet with the discount-rate sheet.

### B. The 5% and 25% tax assumptions are not the same assumption

- OPEX `قیمت فروش` computes net profit using 5%.
- The COMFAR PDF's operating cash-flow report shows full-capacity income tax around 4.57–4.88 billion million Rial, consistent with a 25% corporate tax treatment, not 5%.
- The CAPEX WACC sheet separately uses 25% as the tax shield for debt cost.

The application currently uses 5% as operating tax and 25% as the WACC tax shield. That reproduces the Excel sales-sheet assumption but not the tax cash flows in the COMFAR PDF. Both cases must be selectable and clearly labeled; one must not overwrite the other.

### C. Capitalized construction interest is omitted from Pishran's unlevered project-CF comparison

Pishran's current generated construction outflows are 12,721,653.30 and 5,981,182.06. COMFAR reports 13,907,805.03 and 8,093,664.03. The differences are 1,186,151.73 and 2,112,481.97 respectively, matching the capitalized interest shown in the COMFAR pre-production-cost schedule (page 8).

This is a definition mismatch: the current Pishran project cash flow excludes financing costs, while the COMFAR reported total-investment cash flow includes capitalized construction interest. The application should show an unlevered project case and a COMFAR-reported investment-cost case separately.

### D. Operating tax causes the largest recurring operating-period difference

At full capacity, the current Pishran model uses the OPEX sheet's 5% operating tax. COMFAR's report reflects 25% income tax. This produces a recurring annual cash-flow difference of roughly 3,422,000–3,727,000 million Rial (about 3.4–3.7 trillion Rial) in later full-capacity periods. The tax rate must be a scenario input sourced to a specific workbook/report, not a single global constant.

### E. Depreciation is modeled as a flat override, but the source is asset-specific

The OPEX depreciation worksheet lists asset classes with different straight-line rates and salvage rates: site 7%, buildings 7%, machinery 10.97955%, utilities 12%, vehicles 20%, office equipment 25%, etc. It also explains that total depreciation declines as asset classes finish their useful lives. Pishran currently uses a single annual override of 1,580,327 for all 15 operating years. COMFAR reports depreciation declining over time (for example 1,432,554.34 in 1405, 1,425,537.64 in 1408, and 52,751.46 in 1419). A single flat override cannot reproduce this schedule.

The fix is an asset-level depreciation schedule with acquisition year, depreciable basis, useful life/rate, method, and residual value. The new source-backed schedule transcribes the nine depreciating classes in the OPEX sheet plus land (non-depreciable): it reproduces first-year depreciation of approximately **1,580,327.70** million Rial (the sheet displays 1,580,327 after rounding) and produces a declining aggregate schedule as short-life classes finish. It does not overwrite the separate COMFAR-reported depreciation series; COMFAR's 1405 value is 1,432,554.34, so a remaining basis/timing difference still needs explanation.

### F. Terminal value is not reconciled

The source OPEX depreciation sheet implies a residual value of approximately **3,567,422.70** million Rial when the non-depreciable land basis (2,015,000) and the 10% residual assumptions for the listed asset classes are applied. COMFAR reports **13,735,466.82** million Rial under the separate «ارزش قراضه» / other-income line. The unexplained difference is therefore about **10,168,044.12** million Rial—not the earlier comparison against Pishran's hard-coded override. This is a material unresolved source-data mismatch. The UI now displays the source-derived asset residual beside the COMFAR scrap value rather than treating either as a reconciled figure. Working-capital recovery remains a separate cash-flow movement and must not be silently folded into asset scrap.

### G. The existing Excel helper row was mislabeled as the COMFAR cash-flow vector

The OPEX `IRR-NPV` helper sheet's row used by the previous fixture produces NPV 18,509,558.82 and IRR 43.3782%. Those values do not match the COMFAR PDF's NPV 31,399,764.27 and IRR 48.31%. The helper row is now retained under a distinct `excelWorksheetCashFlows` name; the PDF vector is separately represented as `COMFAR_PDF_REFERENCE`.

## 4. Pishran vs COMFAR — like-for-like comparison

The earlier Pishran figures (IRR 54.01%, NPV 38,355,528.19) were generated by the legacy Excel-seeded model using 5% operating tax, no capitalized construction interest, a flat depreciation override, and an unexplained terminal override. They are retained as a historical diagnostic only and are **not** the current COMFAR-led project result.

The new one-click project seed now selects a distinct COMFAR-led case: 25% operating tax, 25% manual discount rate with the 12/1404 valuation convention, capitalized construction interest split as 1,186,151.73 and 2,112,481.97 million Rial, source-derived asset depreciation, and COMFAR's reported scrap amount. It is unlevered for total-investment cash-flow comparison; the Excel financing structure and 5% tax remain in the original Excel fixture and are not mixed into this case.

The UI compares this newly generated series to the audited 17-period COMFAR PDF vector and continues to show the annual variances. This COMFAR-led model is still **not reconciled**: the asset depreciation schedule and the asset-derived residual value do not yet reproduce the COMFAR depreciation and scrap lines.

## 5. Remediation plan

1. Keep the source-sheet, COMFAR-PDF, and Pishran-generated datasets separate with explicit provenance.
2. Add a valuation-date/period-offset parameter to NPV reporting so COMFAR's 12/1404 basis can be reproduced without changing the general NPV convention.
3. Add separate financing scenarios for the 70/30 funding-source case and the 20/80-plus-working-capital-loan discount-rate case.
4. Add separate operating-tax scenarios (5% workbook assumption and 25% COMFAR treatment).
5. Replace the single depreciation override with asset-level straight-line schedules (now implemented as a source-backed schedule for the HRCR200 asset classes; COMFAR's different annual schedule remains separately flagged).
6. Separate capitalized interest from unlevered CAPEX and show both unlevered and COMFAR-reported project cash flows.
7. Resolve the 10,168,044.12 million Rial gap between workbook-derived asset residual and COMFAR scrap; keep asset scrap and working-capital recovery as separate terminal cash-flow lines.
8. Make reconciliation status and annual variances visible in the UI and CI; do not mark the model as reconciled until all material annual differences are within a declared tolerance.

**Project creation UX:** the Projects screen now has a one-click action, **«ساخت پروژه مرجع نورد گرم از Excel»**. It creates the HRCR200 200,000 t/y Kashan project as a local draft, seeds the workbook-derived model data, and opens the hot-rolling workspace. The results screen displays the audited COMFAR PDF NPV/IRR beside Pishran's result and explicitly flags the case as unreconciled. Project data remains in the user's local storage; this code must be merged/deployed before it appears in their running app.\n\n**Status:** source data and COMFAR PDF have been audited; the benchmark/test labeling has been corrected. The operating model is deliberately not auto-calibrated to the COMFAR output because the attached source files contain contradictory tax and financing assumptions. The COMFAR-led scenario is now the default project seed; the Excel 5% tax and financing case remains separate. Remaining reconciliation work is to explain COMFAR's depreciation and terminal scrap differences, verify all annual cash-flow rows, and obtain a clean CI run for the latest commit.
