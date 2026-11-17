# HRCR200 — economic evaluation / COMFAR baseline audit

## Source
- User-supplied report: `HRCR200.Kashan.1402.08.01. rev01.pdf`
- Report date: 1402/08/01
- Relevant printed pages: 129–132 (loan conditions, funding sources and COMFAR summary outputs)
- The original PDF is retained as the user-supplied Library attachment; this note records the extracted benchmark pending a binary repository upload.

## Funding-ratio reconciliation

All amounts below are in million IRR.

| Report line | Amount | Recomputed share / ratio |
|---|---:|---:|
| Construction-phase investment cost | 18,702,835 | 100.00% |
| Shareholder equity | 13,091,985 | 70.00% of construction cost |
| Long-term loan principal | 5,610,851 | 30.00% of construction cost |
| Capitalized loan interest | 3,298,633 | Separate financing-cost line |
| Total investment cost incl. capitalized interest | 22,001,468 | — |
| Total funding shown | 22,001,469 | 1 million IRR rounding difference |

### Interpretation

The numeric amounts establish a **70% equity / 30% loan-principal** funding structure against the stated construction investment:

- 13,091,985 / 18,702,835 = approximately 70%.
- 5,610,851 / 18,702,835 = approximately 30%.

The report labels beside the 5,610,851 loan amount conflict: page 130 says “20%” and page 131 says “80%”. Neither matches the amount against the stated construction cost: 5,610,851 / 18,702,835 is approximately 30%. The corresponding 13,091,985 equity amount is approximately 70%. The numerical source amounts therefore define the 70/30 construction-funding case; retain the printed percentage labels as source inconsistencies.

Capitalized interest of 3,298,633 is not an additional principal drawdown. It is shown separately as financing cost and brings the reported total cost/funding to approximately 22,001,468/22,001,469. When representing the debt balance, the capitalized interest may increase the outstanding balance; do not count it again as a fresh cash drawdown.

The report contains further percentage-label conflicts:
- Page 131 summary labels the 5,610,851 financing amount as 80% of fixed investment and the 13,091,985 equity amount as 20%; these labels are reversed/inconsistent with the amounts.
- Page 130 funding table labels equity as 70% and the loan principal as 20%; the loan amount is actually approximately 30% of construction-phase cost.
- Page 129 detailed text says the loan is 30% of fixed investment, but its parenthetical amount is 13,091,985 (the equity amount); the principal amount used in the total is 5,610,851.
- The rounded source percentages (60%, 26%, 15%) are shares of total funding including capitalized interest, not the equity/debt split on construction investment. They sum to 101% only because of rounding.

## Loan conditions stated in the report (page 129 and page 131)

| Condition | Reported value |
|---|---:|
| Loan principal | 5,610,851 million IRR |
| Contractual annual interest rate | 23% |
| Bond issuance / financing cost | 5% |
| Total loan rate described by the report | 28% |
| Grace period | 0 months |
| Repayment tenor | 5 years |
| Repayment frequency | Quarterly; 20 instalments |
| First repayment | First quarter of 1405 |

### Reconstructed repayment method — independently reconciled

The first-year debt-service figures in the COMFAR reconciliation workbook exactly identify an **annuity (constant total instalment)** schedule when the report's combined 28% annual rate is applied as 7% per quarter to the gross repayment balance:

| Reconstructed control | Value, million IRR |
|---|---:|
| Gross balance entering repayment | 8,909,484.06 |
| Quarterly rate | 7.00% |
| Number of quarterly instalments | 20 |
| Constant quarterly instalment | 840,992.27 |
| First-year interest (four quarters) | 2,399,043.44 |
| First-year principal (four quarters) | 964,925.63 |
| First-year total debt service | 3,363,969.07 |

Annuity formula:

`A = P × r / (1 − (1 + r)^−n)`

where `P = 8,909,484.06`, `r = 0.07`, and `n = 20`. The calculated first-year interest, principal and debt service match the reported COMFAR values to rounding precision. The COMFAR III Reference Manual also documents the annuity repayment formula and the balance-based interest calculation (Financial calculation rules, pp. 344–345).

This is strong numerical evidence that the repayment method used in the reference output is annuity, not equal-principal. Pishran now stores the gross balance as an opening loan balance (not a new cash drawdown) and tests all four first-year controls plus full amortization after 20 instalments.

**Remaining fee classification caveat:** the report states 23% interest plus 5% bond issuance cost and says 28% total. The output proves that 28%/4 = 7% is the rate that reproduces the annuity interest line. The report pages do not separately show whether the 5% is configured in COMFAR as a recurring service/financing fee or incorporated into the loan's effective annual rate. Keep the 23% coupon and 5% issuance fee as separately traceable source fields; do not count the 5% twice.

### Repayment schedule reconstruction

The report gives a 5-year repayment term with 20 quarterly instalments starting in the first quarter of 1405. The COMFAR output benchmark used by the project workbook reports first-year interest of 2,399,043.44, principal repayment of 964,925.63 and total debt service of 3,363,969.07 million IRR.

Using the gross debt balance of 8,909,484.06 million IRR (principal plus construction-capitalized interest), a 28% annual rate divided into 7% per quarter, and the standard COMFAR annuity formula yields a quarterly payment of 840,992.27. Aggregating the first four payments reproduces the reported first-year interest, principal and debt service to rounding precision. This identifies the reference repayment type as **annuity**, rather than equal principal.

The implementation models the gross debt as an opening balance, not as a new drawdown, so construction-capitalized interest is not double-counted as a fresh financing inflow. The 23% coupon and 5% issuance cost remain separate source fields for audit traceability; the repayment-rate calculation uses the report's explicitly stated 28% combined rate. The original COMFAR loan-fee configuration is still needed to split the 5% between recurring service charge and one-time issuance fee in detailed fee reporting.

## COMFAR output benchmark (report page 132)

| Indicator | Reported value |
|---|---:|
| NPV at 25% | 31,399,764 million IRR |
| Project IRR | 48.31% |
| MIRR | 28.03% |
| Equity IRR at 30% | 57.99% |
| Equity MIRR | 30.90% |
| Dynamic payback incl. construction | 5.02 years |
| Production break-even at full capacity | 12.15% |

Use NPV and project IRR above as the principal project-level regression targets only when the valuation date, project cash-flow perimeter, tax schedule, depreciation, working capital, salvage, construction timing, and discount convention match the report. Do not infer that changing financing mix alone should change unlevered project IRR.

## Separate Pishran scenario

The user's requested current hot-rolling scenario of **20% investor equity / 80% loan** remains a separate financing scenario. Do not overwrite it with the COMFAR reference case (70% / 30%). Both scenarios should be available for side-by-side comparison.

## Related engine rule

COMFAR III Expert Manual, Financial Calculation Rules, pp. 342–343, describes interest sub-intervals by completed months plus excess days, with residual days converted on a 30-day-month / 360-day-year basis. The engine regression cases should cover both the manual's example interval (15 January to 20 April = 3 months + 5 days) and month-end edge cases.
