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

The COMFAR output classifies the 3,309,144.53 production-phase contribution as equity and shows no working-capital loan for that amount. The Excel mechanism sheet labels an equivalent amount as a loan. Keep this source-classification conflict visible; do not silently convert COMFAR equity into debt.

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
- The production-phase working-capital contribution is classified as equity in the COMFAR output.
- The total reported sources include both production-phase equity and the capitalized-interest-adjusted debt balance; their gross shares are therefore not the same as the 70/30 construction principal split.
- Printed p.128 (PDF p.139) states that first-year production working capital is funded by the shareholder and subsequent increases are funded from project revenues. This supports treating the 3,309,144.53 first-year working-capital increase as an investor cash outflow, not as construction fixed-investment equity.

Still not established from the available aggregate schedules:

- Exact dated loan disbursements and their timing within each construction year.
- The exact dated cash-flow timing of all construction drawdowns and capitalized-interest accruals.
- Whether the 5% bond-issuance cost is one-off or recurring, and whether it is embedded in the stated 28% rate or separately charged.
- Exact quarter-end payment dates and whether COMFAR applies a uniform 7% quarterly rate or actual day-count fractions for each repayment interval.
- Whether the amount repaid in COMFAR's loan schedule includes all capitalized interest and the exact timing of its capitalization.
- A period-by-period reconciliation of COMFAR interest, principal, and closing debt.

Do not infer these missing items from annual totals. The original COMFAR project file (.C30), or the detailed COMFAR loan conditions, disbursement, interest, capitalization, and repayment schedule exports/screens, is required to complete that reconstruction.

## Pishran implementation acceptance criteria

The next financing-engine implementation must support dated disbursements, quarterly/monthly/half-yearly/yearly repayment intervals, annuity and constant-principal loans, dated rate changes, fees, capitalization cut-off dates, and COMFAR-compatible interval interest. It must produce a period-level debt schedule and reconcile:

- opening debt + disbursements + capitalized interest - principal repayments = closing debt;
- total principal repayments against COMFAR;
- capitalized interest against COMFAR;
- each period's interest and debt service against COMFAR;
- project cash flow separately from equity cash flow.

The 20% equity / 80% debt sponsor scenario remains a separate sensitivity case and must never overwrite the amount-derived COMFAR 70/30 reference case.
