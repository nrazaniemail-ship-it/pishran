# HRCR200 reference package

Project: Hot-rolled sheet — coil production (HRCR200)
Reference date on source workbooks: 1402/07/10

## Source files retained in the ChatGPT project file library

The original binary files are retained under `/Pishran-References/HRCR200/` in the persistent file library. They are not copied into this Git repository because the available GitHub write integration accepts UTF-8 text files, not binary uploads. This index is committed here so the project has a stable, version-controlled inventory of the source material.

| File | Purpose |
|---|---|
| `CAPEX-HRCR200.Kashan.1402.07.10.rev01(3).xlsx` | Fixed investment, pre-operating costs, asset categories |
| `OPEX-HRCR200.Kashan.1402.07.10. rev01(3).xlsx` | Operating costs, working capital and financing assumptions |
| `Marketing-HRCR200.Kashan.1402.07.10.rev01.xlsx` | Market, competitors, capacity additions and slab balance |
| `COMFAR III - 001 - ‎نتایج تحلیل مالی و اقتصادی طرح‏‎(1).pdf` | Reference output for financial/economic reconciliation |
| `Technical_Eng.pdf` | COMFAR III technical help |
| `Reference_Eng.pdf` | COMFAR III reference help |
| `Tutorial_Eng.pdf` | COMFAR III tutorial help |

## Reconciliation cautions

Do not silently combine conflicting source assumptions:
- Financing: user's requested case is 20% equity / 80% debt. The workbook's descriptive labels mention 80/20, but the periodised amounts and COMFAR report indicate about 70% equity / 30% debt during construction; the workbook's annual funding summary and working-capital funding labels also conflict.
- Tax: workbook baseline is 25%; COMFAR summary shows an effective burden around 5% in the first/reference years and 25% in the last year. Annual tax conditions/allowances need inspection.
- Interest: general OPEX assumptions show 23%; detailed repayment schedule shows 26% nominal with quarterly instalments. Its periodic effective rates must be modelled rather than approximated as a simple annual 26%.
- Debt service: source schedule has 20 quarterly annuity instalments over five years; annual model aggregation is not an exact quarterly reconciliation.
- Capitalised interest is reported separately and must not be added again to fixed CAPEX.
- CAPEX infrastructure total (1,707,981.40) differs from the OPEX depreciation base (1,423,564.00) by 284,417.40 and needs asset-level reconciliation.
- Marketing inputs refer to historical years 1399 and 1401 and require updating before an investment decision.

See [the workbook-to-model mapping and reconciliation notes](./source-map.md) for sheet-level mappings, COMFAR output anchors, and unresolved source conflicts.

## Reference values currently encoded in the app

All monetary values below are in million IRR:
- Fixed investment: 18,463,008.72
- Pre-operating costs, net of interest: 239,826.64
- Capitalised interest shown separately in COMFAR output: 3,298,633.06
- Full-capacity working capital: 4,595,370.46
- Nominal capacity: 200,000 tonnes/year

These values are a navigation/reconciliation aid, not a substitute for re-reading the source workbooks and checking the workbook formulas and COMFAR report.
