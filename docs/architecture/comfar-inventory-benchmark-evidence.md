# COMFAR inventory benchmark evidence — steel tank project

## Controlling source

- File: `COMFAR III - 001 - جدول خلاصه عملکرد پروژه.pdf`
- Project: `طرح توسعه مخازن فولادی`, 12 thousand tonnes/year
- Engine/report label: COMFAR III Expert SARZAMIN
- Accounting unit: million IRR
- Source schedule: `سرمایه در گردش خالص مورد نیاز - کل`
- Pages: printed pages 32–35 (PDF pages 32–35)

## Extracted evidence

The COMFAR output exposes the **aggregate total inventory** line only in this schedule extract. It does not separately publish raw materials, WIP and finished goods on these pages. Values below are therefore valid only for `totalInventory`; the three component fields must remain blank. The comparison form must also record the currency code (`IRR`) and an explicit amount-scale factor (e.g. `1` if the model also uses million IRR, or `1,000,000` if the model uses whole rials).

| Project year | Project period* | Total inventory (million IRR) | Source |
|---|---:|---:|---|
| 1405 | 3 | 236,787.88 | p.32 |
| 1406 | 4 | 264,340.10 | p.32 |
| 1407 | 5 | 292,726.11 | p.33 |
| 1408 | 6 | 321,112.12 | p.33 |
| 1409 | 7 | 320,973.15 | p.33 |
| 1410 | 8 | 320,973.15 | p.33 |
| 1411 | 9 | 320,973.15 | p.33 |
| 1412 | 10 | 320,973.15 | p.34 |
| 1413 | 11 | 320,973.15 | p.34 |
| 1414 | 12 | 320,973.15 | p.34 |
| 1415 | 13 | 320,973.15 | p.34 |
| 1416 | 14 | 320,973.15 | p.34 |
| 1417 | 15 | 320,973.15 | p.35 |
| 1418 | 16 | 320,973.15 | p.35 |
| 1419 | 17 | 320,973.15 | p.35 |

*Period mapping follows the report's two construction periods (1403–1404) followed by production years 1405–1419. Use only when the target model has the same calendar alignment.

## Other source schedules and limits

- Projected balance sheet, printed pages 280–284: publishes total current assets, fixed assets, liabilities and equity, but not separate inventory components.
- Annual cost-of-products schedule, printed pages 58–61: publishes material, factory cost, total production cost and cost-of-products lines. These are not a direct substitute for a separately defined CPP/CPS pair without matching the model's included cost scope (depreciation, financing, marketing and stock adjustments).
- Summary sheet, printed pages 1–2: reports first/reference/last-year operational totals; it is a summary, not a component subledger.
- Accordingly, do not infer raw-material/WIP/finished-goods split from total inventory, and do not label total production costs as CPP or cost of products as CPS unless the cost scope and stock adjustment basis are reconciled.

## Regression use

The aggregate values above are suitable for regression-testing the source-evidence comparison for `totalInventory` only. Component inventory and CPP/CPS comparisons remain `incomplete` until the exact corresponding reference lines are independently available.
