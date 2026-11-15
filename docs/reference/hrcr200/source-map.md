# HRCR200 workbook-to-model mapping and reconciliation notes

Project: Hot-rolled coil line, 200,000 tonnes/year  
Source workbook revision date: 1402/07/10  
Base currency: million IRR unless otherwise stated  
Source files: see [README](./README.md). The original files remain in the persistent file library at `/Pishran-References/HRCR200/`.

## 1. CAPEX workbook mapping

| Workbook sheet | Data to capture | Pishran model destination | Notes / validation |
|---|---|---|---|
| فرضیات | FX rates, source date, capacity | Project assumptions / currency conversion | Store source date and FX rates with each imported value |
| خرید زمین | land quantity, unit price, total cost | Fixed assets: land | Land is non-depreciable in the current reference schedule |
| محوطه سازی | site preparation line items and residual value | Fixed assets: site preparation | OPEX depreciation schedule uses 7% rate and 10% scrap |
| ساختمان‌ها | industrial/non-industrial buildings, civil works | Fixed assets by asset class | OPEX depreciation schedule uses 7% and 10% scrap for both classes |
| کل تجهیزات | engineering, machinery, installation, spares, commissioning, local/foreign split | Fixed assets / CAPEX phasing / currency exposure | Keep local and foreign costs separate until FX conversion |
| وسائط نقلیه | vehicle count and unit costs | Fixed assets: vehicles | OPEX depreciation schedule: 20% rate, 10% scrap |
| تاسیسات زیربنایی / تاسیسات زیربنایی-توسعه | utility connections, substations, development infrastructure | Fixed assets: utilities | Reconcile category total with OPEX depreciation base (see unresolved item below) |
| وسایل اداری | office and service equipment | Fixed assets: office equipment | OPEX depreciation schedule: 25% rate, 10% scrap |
| قبل از بهره‌برداری | studies, owner's engineer, site overhead, insurance, bank fees, contingencies | Pre-production expenditures | Net pre-production cost is separate from fixed assets; COMFAR reports capitalised interest separately |
| سرمایه‌گذاری ثابت طرح | asset category totals and construction-year phasing | CAPEX schedule | Fixed investment total = 18,463,008.72 |
| نحوه تامین منابع | construction uses, equity, long-term loan and capitalised interest | Financing scenario / construction drawdowns | Periodised values align with COMFAR's 70/30 construction financing, despite conflicting percentage labels elsewhere |
| مکانیزم تامین سرمایه | year-by-year drawdowns and working-capital funding | Financing scenario | Its total-column values do not reconcile to annual drawdowns; do not use its summary totals without reconciliation |
| برنامه زمانی بازپرداخت اقسا (2) | three loan tranches, 20 quarterly instalments, rate and payment pattern | Periodic loan schedule | Annuity-style equal total instalments; annual engine aggregation is not an exact substitute |

### CAPEX reference amounts

- Fixed investment: **18,463,008.72**
- Pre-production expenditure, net of interest: **239,826.64**
- Capitalised interest reported separately: **3,298,633.06**
- Gross pre-production expenditure including capitalised interest: **3,538,460.06**
- Fixed investment plus net pre-production cost: **18,702,835.36**
- Construction uses including capitalised interest: approximately **22,001,469.06**

Do not add capitalised interest to fixed CAPEX. COMFAR's financial cash-flow rules treat fixed investment and pre-production expenditures net of interest as separate cash outflows; financing costs are reported separately.

## 2. OPEX workbook mapping

| Workbook sheet | Data to capture | Pishran model destination | Notes / validation |
|---|---|---|---|
| مواد خام | specific consumption, units, unit prices, annual quantities/costs | Variable raw-material cost rows | Example: slab 1.02 t/t product; slab price 195.1 million IRR/t |
| انرژی | specific water, electricity and gas consumption, demand and tariffs | Utilities / variable operating costs | Water 0.8 m³/t; electricity 100 kWh/t; gas 47 Nm³/t |
| تعمیر و نگهداری و لوازم یدکی | maintenance rate by asset class, spare parts | Fixed/variable maintenance and spares | Preserve the workbook's asset-specific rate assumptions |
| نیروی انسانی | headcount by role, payroll and benefits | Payroll and labour overhead | Source reports 285 direct employees |
| استهلاک | depreciable basis, rate, scrap value | Asset-by-asset depreciation | Site/buildings 7% / 10% scrap; machinery 10.97955% / 10%; infrastructure 12% / 10%; vehicles 20% / 10%; office 25% / 10% |
| هزینه جاری سالیانه | annual production-cost summary | OPEX and P&L line items | Separate cash operating costs from depreciation and financing charges |
| قیمت فروش | product mix, unit prices, annual quantities, ramp-up | Product sales programme | Coil: 200,000 t at 307 million IRR/t; scrap/by-products: 4,000 t at 214.9 million IRR/t |
| سرمایه در گردش | inventory/receivable/cash/payable days and annual bases by period | Working-capital policy and annual change | 360-day basis; raw 30, energy 15, spares 30, WIP 3, finished goods 5, receivables 0, cash 60, payables 0 |
| سر به سری / تحلیل نقطه سر به سر | variable/fixed cost split and contribution margin | Break-even and sensitivity | Raw materials 100% variable; labour 100% fixed; energy and maintenance 80/20; depreciation 100% fixed; other costs 50/50 |
| مشخصات کلی طرح | planning horizon, capacity, ramp, finance assumptions, target metrics | Project and finance assumptions | 2 construction years, 15 operating years, ramp 70/80/90/100, 23% general loan-rate assumption |
| مالیات و تورم | corporate tax and inflation basis | Tax and escalation assumptions | Workbook narrative states 25% corporate tax; inflation should not be silently inferred |
| IRR حساسیت / حساسیت نرخ انرژی | sensitivity inputs and reference IRRs | Sensitivity test cases | Preserve source sensitivities as validation scenarios, not hardcoded live forecasts |

### OPEX reference amounts

- Full-capacity annual raw materials: **40,844,287**
- Energy: **269,580.17**
- Spare parts: **176,473.79**
- Maintenance: **374,760**
- Labour: **650,053**
- Labour overhead: **130,011**
- Depreciation in OPEX sheet: **1,580,327** (the COMFAR summary schedule displays year-dependent depreciation; do not force one annual figure across all periods)
- Coil sales: **61,400,000**
- Scrap/by-product sales: **859,600**
- Total sales at full capacity: **62,259,600**
- Weighted average sales price: **311.298 million IRR/t**
- Full-capacity working capital: **4,595,370.46**

The Pishran product-level revenue calculation should retain the two separate product prices and quantities. The blended price of 311.298 is a derived cross-check, not a substitute for product-level pricing.

## 3. Marketing workbook mapping

| Workbook sheet | Data to capture | Pishran model destination |
|---|---|---|
| تولید- توسعه-اسلب | current slab producers, installed/marketable capacity, actual output, domestic supply, dimensions, planned expansions | Slab supply / upstream constraints |
| تولید- توسعه-ورق گرم | current hot-rolled coil producers, installed/marketable capacity, actual output, domestic supply, thickness and width | Competitor and market-supply table |
| موازنه اسلب 1401 | actual slab production, domestic consumption, imports, exports, surplus | Slab balance and raw-material market context |

Marketing data refer to historical years 1399 and 1401. Preserve the original data year on each record and mark them stale until updated. Capacity and supply figures in the competitor table are in thousand tonnes/year; the app must not mix these with project capacity in tonnes/year without explicit conversion.

## 4. COMFAR report reconciliation anchors

The 135-page COMFAR output identifies a two-year construction phase (1403–1404) and a 15-year operation phase (1405–1419).

| Indicator | COMFAR reference |
|---|---:|
| Fixed investment | 18,463,009 |
| Net pre-production cost | 239,827 |
| Capitalised interest | 3,298,633.06 |
| Net working capital at full capacity | 4,595,370.36 |
| First-year sales revenue (1405) | 43,581,720 |
| Reference/final sales revenue | 62,259,600 |
| First-year operating costs | 30,130,083.97 |
| Reference/final operating costs | 42,604,224.43 |
| First-year depreciation | 1,432,554.34 |
| Reference-year depreciation | 1,425,537.64 |
| First-year financial costs | 2,399,043.44 |
| Reference-year financial costs | 1,190,771.67 |
| NPV total capital at 25% | 31,399,764.27 |
| IRR total capital | 48.31% |
| MIRR total capital | 28.03% |
| NPV equity at 30% | 23,579,675.01 |
| IRR equity | 57.99% |
| MIRR equity | 30.90% |
| Normal payback | 3.86 years |
| Dynamic payback | 5.02 years |
| Valuation date | 12/1404 |

The summary's tax line implies an effective tax burden of approximately 5% in the first and reference years, and 25% in the final year. This is not enough to infer the configured tax rate or allowance mechanics; read the annual tax conditions and allowances before attempting exact reconciliation.

## 5. Conflicts that must remain visible

1. **Financing ratio:** the user's selected scenario is 20% equity / 80% debt. The OPEX workbook's descriptive labels also say 80% finance / 20% equity, but the amounts entered for construction funding (5,610,850.80 debt and 13,091,985.20 equity) are approximately 30% debt / 70% equity. The COMFAR report matches the periodised 70/30 construction split. The CAPEX workbook's “Financing Mechanism” summary totals conflict with its own annual drawdown amounts.
2. **Working-capital source:** the CAPEX “Financing Mechanism” schedule labels the first-year working-capital amount as a loan; the COMFAR summary records 3,309,144.53 as equity in the first production year.
3. **Tax:** the workbook narrative says 25%; COMFAR summary effective tax is about 5% in first/reference years and 25% in the last year. Verify annual tax conditions and allowances.
4. **Interest:** OPEX general assumptions state 23%; the detailed repayment schedule states 26% nominal, with monthly rate 2.1667%, effective annual rate 29.3334% and quarterly rate 7.33335%. The schedule uses 20 quarterly annuity instalments over five years. Annual-rate approximation is not exact.
5. **Depreciation basis:** the CAPEX fixed-investment summary lists infrastructure at 1,707,981.40, while the OPEX depreciation sheet uses 1,423,564.00. The difference, 284,417.40, requires asset-level reconciliation.
6. **Marketing data age:** the competitor/slab data are historical and must be refreshed before an investment decision.

## 6. COMFAR modelling requirements for Pishran

- Model fixed investment by asset, period, currency/origin, depreciation start, depreciation method, rate/life and scrap value.
- Keep pre-production expenditures net of interest separate from fixed assets and financing costs.
- Build product-specific production and sales programmes with period quantity, price, domestic/export split, ramp-up and inventory adjustments.
- Calculate working capital from raw materials, energy, spares, WIP, finished goods, receivables, cash and payables, with annual changes and terminal recovery.
- Support multiple loan tranches, drawdown periods, grace, interest payment timing, repayment frequency (monthly/quarterly/semi-annual/annual), annuity or equal-principal methods, and capitalised interest.
- Reconcile annual reports by aggregating the actual periodic debt schedule; do not approximate 20 quarterly instalments as five annual instalments.
- Generate linked income statement, cash-flow statement, balance sheet, project/equity discounted cash flows, NPV, IRR, MIRR with explicit finance/reinvestment rates, payback, sensitivity and scenario analysis.
- Keep a visible source trail from each model input to workbook sheet/cell/range or COMFAR schedule.
