# Workbook financial reconciliation (source audit)

**Scope and separation**

The five supplied workbooks represent two independent financial cases. The DRI/steelmaking files are denominated in EUR. The HRCR200 hot-rolling files are denominated in **million IRR** for project amounts (unit costs are IRR/kg). Do not add, net, or compare their nominal amounts without an explicit currency conversion and valuation date.

## 1. DRI + steelmaking complex

Sources: `CAPEX.xlsx`, `OPEX.xlsx`, and `مدل مالی و جریان نقدی.xlsx`.

### CAPEX and financing bridge (EUR)

| Item | Source value |
|---|---:|
| Fixed investment | 453,858,298.00 |
| Pre-production, net of interest | 6,624,026.85 |
| Capitalized construction interest | 110,500,000.00 |
| Construction uses | 570,982,324.85 |
| Increase in net working capital | 68,155,775.89 |
| **Total investment uses** | **639,138,100.89** |
| Equity | 139,982,325.00 |
| Long-term loans | 431,000,000.00 |
| Short-term working-capital loan | 49,523,442.75 |
| **Total sources** | **620,505,767.75** |
| **Unfunded difference** | **18,632,333.14** |

The construction funding table in the financial model totals EUR 570,982,325 (equity plus EUR 431m long-term loans), matching the construction cost including capitalized interest to rounding. The COMFAR schedule then adds EUR 68.156m of working capital but only EUR 49.523m of short-term finance. The EUR 18.632m difference therefore remains a genuine sources/uses gap in the COMFAR table; operational receipts or the existing rolling line may help the wider group cash position, but they do not change that project-level funding gap.

The long-term debt is EUR 431m: EUR 363m attributed to Bank Melli Hamburg (EUR 200m + EUR 163m) and EUR 68m to Bank Tejarat. The spreadsheet's debt-service schedule also shows construction-period interest/capitalized interest; this must not be counted a second time on top of the EUR 110.5m capitalized-interest use.

### OPEX bridge (EUR/year, reference operating basis)

| Cost item | Detailed OPEX |
|---|---:|
| Raw materials | 537,485,060.00 |
| Labor | 10,272,936.00 |
| Labor overhead | 2,054,587.00 |
| Maintenance | 17,977,288.00 |
| Utilities | 69,530,818.40 |
| Other | 6,642,810.00 |
| **Factory cost excluding depreciation** | **643,963,499.40** |
| Detailed depreciation schedule | 33,020,570.00 |
| **Total including detailed depreciation** | **676,984,069.40** |

The COMFAR report gives reference-year factory costs of EUR 643,963,499, agreeing with detailed OPEX excluding depreciation to EUR 0.40 rounding. Depreciation does **not** reconcile: the detailed OPEX depreciation sheet totals EUR 33,020,570/year, while COMFAR reports EUR 26,727,770.59 in reference year 9 (EUR 38,388,721.26 in first operating year and EUR 25,180,187.80 in last year). The reference-year difference is EUR 6,292,799.41. Keep this as an open reconciliation item; do not overwrite either source value until the asset commissioning/depreciation schedule is rebuilt.

### Tax and time basis

COMFAR defines four construction years and fifteen operating years (19 periods total). The financial cash-flow workbook labels construction 1403–1406 and production from 1407. Its tax cash-flow rows show a 5% effective tax charge for the first four operating years and 25% from the fifth operating year/reference year 9. The workbook's tax notes describe 25% as the general corporate rate and possible regional exemptions; the source files do not identify the legal exemption decision or its term. Treat the 5% ramp as a workbook assumption pending documentary confirmation, not a universal tax rate.

### Scope of the consolidated cash-flow workbook

The sheet `جریان نقدی کل` explicitly includes:
- net profit of an existing rolling line at 700,000 t/y, escalated 5% per year;
- an additional rolling-profit uplift of 35%, 40%, 45%, then 50% after steelmaking starts;
- steelmaking sales, costs, taxes, interest and principal repayment.

This is a **combined corporate cash-flow scenario**, not a stand-alone DRI/steelmaking project cash flow and not the HRCR200 200,000 t/y workbook. The legacy rolling assumptions and uplift percentages are assumptions in this model; do not merge them into the HRCR200 project's operating case.

## 2. HRCR200 hot rolling (200,000 t/y)

Sources: `CAPEX-HRCR200.Kashan.1402.07.10.rev01.xlsx` and `OPEX-HRCR200.Kashan.1402.07.10. rev01.xlsx`. Monetary project totals below are **million IRR**.

### CAPEX and working capital

| Item | Source value (million IRR) |
|---|---:|
| Fixed investment | 18,463,008.7206 |
| Pre-operation, net of interest | 239,826.6380 |
| Construction investment | 18,702,835.3585 |
| Capitalized interest | 3,298,633.0600 |
| Construction uses incl. interest | 22,001,468.4185 |
| Working capital at full capacity | 4,595,370.4572 |
| Total incl. working capital | 26,596,838.8757 |
| Funding sources reported | 22,001,469.0600 |
| Sources less construction uses incl. interest | 0.6415 |

The funding summary difference of 0.6415 million IRR is small relative to project size and may be rounding, but it remains a visible workbook reconciliation difference.

### OPEX (million IRR/year)

| Item | Source value |
|---|---:|
| Raw materials | 40,844,287.000 |
| Utilities | 269,580.000 |
| Spare parts | 176,473.792 |
| Maintenance | 374,760.000 |
| Labor | 650,053.000 |
| Labor overhead | 130,011.000 |
| Depreciation | 1,580,327.000 |
| Factory overhead | 159,060.000 |
| Direct marketing | 62,259.600 |
| **Total including depreciation** | **44,246,811.392** |
| **Total excluding depreciation** | **42,666,484.392** |

The workbook reports unit cost of 221,234.05696 IRR/kg including depreciation and 170,665.937568 IRR/kg excluding depreciation. The stated capacity is 200,000 t/y. FX assumptions dated 1402/07/10 are EUR/IRR 524,000, USD/IRR 495,000 and CNY/IRR 68,000; they are historical assumptions, not current exchange rates.

### Financing conflict requiring sponsor confirmation

The HRCR200 workbook contains inconsistent financing descriptions:
- `مکانیزم تامین سرمایه` gives fixed-capital funding of approximately 80% debt (14,962,268.287 million IRR) and 20% equity (3,740,567.072 million IRR).
- `نحوه تامین منابع` describes 70% equity and 30% debt; its amounts are approximately 13,091,985.2 and 5,610,850.8 million IRR.
- `مشخصات کلی طرح` labels 5,610,850.8 as “80% finance” and 13,091,985.2 as “20% equity”, but the amounts actually correspond to 30% and 70% respectively.

The current app benchmark follows the `مکانیزم تامین سرمایه` tab (80/20) as a provisional choice. Do not silently overwrite it with the alternative 70/30 case; obtain sponsor confirmation and then update the debt/equity structure and repayment schedule together.

The HRCR200 workbook's `IRR-NPV` sheet reports project NPV 18,509,558.82 million IRR at 21%, project IRR 43.3782%, MIRR 33.8651%, equity NPV 6,043,074.78 million IRR at 30%, equity IRR 55.8552%, and equity MIRR 40.3029%. These values belong only to the HRCR200 case.

## 3. Controls added to the application

- Keep DRI/steelmaking and HRCR200 as separate project benchmarks and separate currencies.
- Keep COMFAR reference-year factory cost excluding depreciation separate from depreciation.
- Surface unresolved funding/depreciation/tax/financing conflicts as audit flags rather than silently selecting a value.
- Preserve the combined 700 kt/y legacy rolling cash flow as a distinct corporate-level scenario.
- The PR remains Draft and unmerged pending sponsor decisions and successful CI.
