# HRCR200 — COMFAR financing reconstruction

## Authority and reconstruction rule

The COMFAR output schedules are the numerical acceptance baseline. The economic evaluation PDF and the Excel workbooks are supporting evidence for assumptions and source labels; a conflicting label is not allowed to override a COMFAR amount or cash-flow schedule.

Do not collapse these distinct quantities into one "loan amount":

1. Construction-period loan principal actually disbursed.
2. Interest and fees capitalized during construction.
3. Debt outstanding at the end of the capitalization/disbursement phase.
4. Principal repayments during production.
5. Working-capital funding, classified separately from fixed-investment finance.

## Amount-derived construction structure

All amounts below are million IRR.

| Item | Amount |
|---|---:|
| Fixed investment plus net pre-operating cost / construction funding base | 18,702,835.36 |
| Construction equity in COMFAR | 13,091,985.20 |
| Construction loan principal in COMFAR | 5,610,850.80 |
| Capitalized construction interest | 3,298,633.06 |
| Debt after adding capitalized interest (before production repayments) | 8,909,483.86 |
| Construction equity share | 70.00% |
| Construction principal share | 30.00% |

The 70/30 split is derived from the actual amounts divided by the construction funding base. A conflicting 20% debt label in the report/workbook is not accepted as the numeric basis.

Capitalized interest is not a second external principal draw. It increases the loan liability and pre-production expenditure under COMFAR rules. It must be represented as capitalized interest, not counted again as fresh cash financing. When reconciling the post-capitalization debt balance, however, it is part of the outstanding debt that may subsequently be repaid.

## Production-phase working capital

| Item | Amount |
|---|---:|
| Full-capacity working-capital requirement | 4,595,370.46 |
| Production-phase equity contribution shown by COMFAR | 3,309,144.53 |
| Unfunded / not evidenced difference | 1,286,225.93 |

The OPEX workbook sheet "جریانات نقدی مالی (کامفار)" provides the strongest transaction-level classification: in period 3 (mapped to 1405), 3,309,144.53 is in the equity column and short-term financing is zero; this amount is therefore the COMFAR baseline equity contribution. However, the supporting documents conflict:
- The PDF, printed p.122 (PDF p.133), says first-year working capital is financed by a short-term rial loan at 28%.
- The PDF, printed p.128 (PDF p.139), says first-year working capital is funded by the shareholder.
- The OPEX COMFAR financial-flow sheet records 3,309,144.53 as equity and zero short-term financing.
- The CAPEX workbook "مکانیزم تامین سرمایه" sheet (G7) and "نرخ تنزیل" sheet classify 3,309,144.53 as a long-term working-capital loan at 26%; retain this as a separate workbook financing alternative, not the COMFAR baseline.
- The CAPEX workbook "برنامه زمانی بازپرداخت اقساط (2)" explicitly models three separate 20-quarter annuity tranches at 7.3333496% effective per quarter: fixed-asset loan 1 of 3,816,495.99 with a 369,636.70 quarterly instalment; fixed-asset loan 2 of 1,794,354.81 with a 173,787.53 quarterly instalment; and working-capital loan 3 of 3,309,144.53 with a 320,498.51 quarterly instalment. Combined instalment is 863,922.73 per quarter (17,278,454.69 over 20 quarters). This is not the PDF's 28%/7% COMFAR reconstruction (840,992.27 per quarter); keep the three-loan workbook case separate and do not use it to overwrite COMFAR's annual funding flows.

There is a second amount discrepancy: the OPEX "سرمایه در گردش" sheet calculates first-year 1405 working capital at 3,216,759.32 (70% of full-capacity working capital), while the OPEX COMFAR financing-flow sheet records 3,309,144.53 equity. The difference is 92,385.21. Do not cap the reported equity funding to the OPEX working-capital requirement or silently discard the excess; show it as a cash funding buffer pending detailed reconciliation. In Pishran's integrated three-statement model, retaining the full 3,309,144.53 equity contribution while recording only 3,216,759.32 as the operating working-capital asset leaves 92,385.21 in closing cash. A regression now verifies that this cash buffer reconciles the balance sheet without a plug.

## Annual COMFAR financing-flow reconciliation

The OPEX workbook sheet "جریانات نقدی مالی (کامفار)" contains 17 periods mapped to fiscal years 1403–1419. The companion "جریانات نقدی دوره ای" sheet confirms each period's total domestic financing flow as equity plus net long-term loan flow. Amounts are million IRR.

| Fiscal year | Equity contribution | Net long-term loan flow | Short-term financing | Total domestic financing flow |
|---|---:|---:|---:|---:|
| 1403 | 8,905,157.30 | 5,002,647.73 | 0 | 13,907,805.03 |
| 1404 | 4,186,827.70 | 3,906,836.33 | 0 | 8,093,664.03 |
| 1405 | 3,309,144.53 | -964,925.63 | 0 | 2,344,218.90 |
| 1406 | 0 | -1,264,820.67 | 0 | -1,264,820.67 |
| 1407 | 0 | -1,657,921.89 | 0 | -1,657,921.89 |
| 1408 | 0 | -2,173,197.39 | 0 | -2,173,197.39 |
| 1409 | 0 | -2,848,618.47 | 0 | -2,848,618.47 |
| 1410–1419 | 0 | 0 | 0 | 0 |

The five annual principal repayments sum to the gross opening repayment balance of 8,909,484.06 million IRR (the unrounded annual sequence totals 8,909,484.057 million IRR). The 20-quarter 7%-per-quarter annuity schedule reproduces the annual principal sequence to rounding: 964,925.63; 1,264,820.67; 1,657,921.89; 2,173,197.39; 2,848,618.47. This is a materially stronger acceptance check than first-year totals alone.

## Repayment and interest reconstruction

The economic evaluation PDF, printed p.129 (PDF p.140), states: 23% loan rate plus 5% bond-issuance cost, 28% total rate, first quarterly payment in Q1 1405, five-year repayment term, no grace period, and 20 quarterly instalments. This is direct evidence for the repayment horizon and stated 28% combined rate. The exact legal/economic treatment of the 5% remains unresolved: it may be an issuance fee or a rate add-on, and must not be charged twice. Other workbook references to 26% remain a separate unresolved source discrepancy.

The COMFAR III Reference Manual specifies, among other rules:

- Interest during disbursement/construction is calculated over sub-intervals when a disbursement, repayment, or interest-rate change occurs.
- For local-currency loans, the applicable interval rate uses the annual rate multiplied by the interval length, with months/12 plus excess days/360.
- For constant-principal loans, each principal repayment equals the debt at the end of the disbursement phase divided by the number of repayments.
- For annuity loans, the periodic payment is calculated using the periodic interest rate and number of repayments; interest is calculated on the opening debt and the residual payment reduces principal.
- Capitalized interest increases both the loan balance and pre-production expenditure; it is not included as an additional investment cash outflow for project NPV/IRR.

Numerical reverse-engineering of the COMFAR first operating-year debt service resolves the repayment method much more strongly than the ambiguous labels: using the gross opening repayment balance 8,909,484.06, 28% / 4 = 7% per quarter, and a 20-payment annuity, the payment is 840,992.27 million IRR. Across the first four quarters this gives interest 2,399,043.44, principal 964,925.63, and debt service 3,363,969.07 million IRR, matching the COMFAR schedule totals to rounding. This is strong numerical evidence for annuity repayment at 7% per quarter; it is not proof that the 5% issuance-cost label is a recurring coupon component. The regression fixture reproduces this check and fully amortizes the balance after 20 quarters. The production UI now displays the periodic engine's actual schedule when valid rather than the annual approximation.

## What is and is not numerically established

Established from COMFAR output and amount reconciliation:

- Construction financing principal is 70% equity / 30% debt.
- Construction equity is 13,091,985.20 million IRR.
- Construction loan principal is 5,610,850.80 million IRR.
- Capitalized interest is 3,298,633.06 million IRR.
- The OPEX COMFAR financial-flow schedule classifies 3,309,144.53 in 1405 as equity and reports zero short-term financing across all 17 years.
- Annual equity and net long-term loan flows for 1403–1419 are now recorded as explicit acceptance data.
- The five annual principal repayments reconcile to the reconstructed 20-quarter annuity schedule to rounding.
- The total reported sources include both production-phase equity and the capitalized-interest-adjusted debt balance; their gross shares are therefore not the same as the 70/30 construction principal split.
- Printed p.128 (PDF p.139) supports shareholder funding; printed p.122 (PDF p.133) contradicts it. The COMFAR-labelled OPEX financial-flow schedule resolves the base-case classification in favour of equity, while the CAPEX mechanism/WACC tabs are retained as a separate loan-funded alternative.

Still not established from the available aggregate schedules:

- Exact dated loan disbursements and their timing within each construction year.
- The exact dated cash-flow timing of all construction drawdowns and capitalized-interest accruals.
- Whether the 5% bond-issuance cost is one-off or recurring, and whether it is embedded in the stated 28% rate or separately charged.
- Exact quarter-end payment dates and whether COMFAR applies a uniform 7% quarterly rate or actual day-count fractions for each repayment interval.
- A period-by-period reconciliation of COMFAR interest and closing debt; annual principal is now reconciled, but quarterly COMFAR interest/closing-balance exports are not available.

Do not infer these missing items from annual totals. The original COMFAR project file (.C30), or the detailed COMFAR loan conditions, disbursement, interest, capitalization, and repayment schedule exports/screens, is required to complete that reconstruction.

## Pishran implementation acceptance criteria

The next financing-engine implementation must support dated disbursements, quarterly/monthly/half-yearly/yearly repayment intervals, annuity and constant-principal loans, dated rate changes, fees, capitalization cut-off dates, and COMFAR-compatible interval interest. It must produce a period-level debt schedule and reconcile:

- opening debt + disbursements + capitalized interest - principal repayments = closing debt;
- total principal repayments against COMFAR;
- capitalized interest against COMFAR;
- each period's interest and debt service against COMFAR;
- project cash flow separately from equity cash flow.

The 20% equity / 80% debt sponsor scenario remains a separate sensitivity case and must never overwrite the amount-derived COMFAR 70/30 reference case.
