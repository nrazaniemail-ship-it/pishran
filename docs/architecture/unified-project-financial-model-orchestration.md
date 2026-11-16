# Unified project financial-model orchestration

`calculateProjectFinancialModelFromDrafts` is the shared form-to-engine entry point for a greenfield feasibility model. It executes the following ordered chain:

1. Product sales and production-cost forms -> sales revenue, fixed/variable costs, production quantity and finished-goods roll-forward.
2. Detailed working-capital component balances -> net working-capital balances and period changes.
3. Fixed-asset acquisition vintages -> period depreciation, annual depreciation, CAPEX and disposal schedule.
4. Loan facility forms -> periodic debt schedules, foreign-currency remeasurement and linked three-statement posting.

The orchestration is fail-fast. An invalid or incomplete upstream schedule prevents a downstream result from being presented as valid. It does not silently fall back to a parallel cash-flow engine.

The greenfield wizard passes the saved project financial forms and project foundation into the periodic calculation panel. Opening finished-goods quantity and opening balances for each working-capital component are visible form inputs. The tax treatment of foreign-exchange losses is selected in the project foundation.

## Current constraints

- The current orchestration is enabled for greenfield projects with zero opening balance sheet. Existing-enterprise opening balances still require a dedicated opening-balance form and reconciliation path.
- Foreign-currency loan fee rows remain blocked until fee payment dates and expense/capitalization treatment are captured.
- Repayment frequency must match project period frequency.
- Foreign exchange uses the period rate for aggregated movements and closing remeasurement.
- Asset acquisition is dated at period-end because the form records acquisition periods rather than exact dates; disposal losses and multi-vintage disposal require additional accounting detail.
- Indirect production costs require an explicit allocation basis before allocation to product cost.
- The external reference fixture currently verifies production, sales, finished-goods inventory and revenue for project periods 5–10. Full financial parity across all statements remains unverified.
