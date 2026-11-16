# HRCR200 — economic evaluation / COMFAR baseline audit

## Source
- User-supplied report: `HRCR200.Kashan.1402.08.01. rev01.pdf`
- Report date: 1402/08/01
- Relevant pages: 130–132 (construction funding and COMFAR summary outputs)
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

The report's narrative label beside the 5,610,851 loan amount says “20%”. That label conflicts with the amount: 20% of 18,702,835 would be 3,740,567, not 5,610,851. Until another underlying source schedule proves otherwise, treat “20%” as a report-text error and use the arithmetic 30% for the COMFAR reference case.

Capitalized interest of 3,298,633 is not an additional principal drawdown. It is shown separately as financing cost and brings the reported total cost/funding to approximately 22,001,468/22,001,469. When representing the debt balance, the capitalized interest may increase the outstanding balance; do not count it again as a fresh cash drawdown.

The report's rounded source percentages (60%, 26%, 15%) are percentages of the total funding including capitalized interest, not the equity/debt split on construction investment. They sum to 101% only because of rounding.

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
