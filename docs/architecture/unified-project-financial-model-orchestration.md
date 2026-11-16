# Unified project financial-model orchestration

`calculateProjectFinancialModelFromDrafts` is the shared form-to-engine entry point for a greenfield feasibility model and for existing enterprises that enable the detailed opening balance sheet. It executes the following ordered chain:

1. Product sales and production-cost forms -> sales revenue, fixed/variable costs, production quantity and finished-goods roll-forward.
2. Detailed working-capital component balances -> net working-capital balances and period changes.
3. Fixed-asset acquisition vintages -> period depreciation, annual depreciation, CAPEX and disposal schedule.
4. Loan facility forms -> periodic debt schedules, foreign-currency remeasurement and linked three-statement posting.

The orchestration is fail-fast. An invalid or incomplete upstream schedule prevents a downstream result from being presented as valid. It does not silently fall back to a parallel cash-flow engine.

The wizard passes the saved project financial forms and project foundation into the periodic calculation panel. Opening finished-goods quantity and opening balances for each working-capital component are visible form inputs. Existing enterprises can enable the detailed opening balance sheet: cash, current-asset and current-liability components, gross fixed assets and accumulated depreciation, deferred pre-operating assets, short- and long-term debt, paid-in capital and retained earnings. The opening form is rejected unless every required balance is non-negative and the accounting equation reconciles within 0.01 currency units. Net working capital, net fixed assets and total opening debt are derived from the detailed entries and passed to the statement engine. The tax treatment of foreign-exchange losses is selected in the project foundation.

## Current constraints

- Existing-enterprise orchestration is enabled only when the detailed opening balance sheet is explicitly activated and reconciled. A blank or unbalanced opening statement is rejected; it is never silently replaced with zero balances.
- Facility fee amounts use the explicit fee date, fee type, currency, commitment limit and expense/capitalization treatment; fee bases are calculated from the preliminary principal schedule before fee posting.
- Repayment frequency must match project period frequency.
- Foreign exchange uses the period rate for aggregated movements and closing remeasurement.
- Asset acquisition is dated at period-end because the form records acquisition periods rather than exact dates; disposal losses and multi-vintage disposal require additional accounting detail.
- Indirect production costs require an explicit allocation basis before allocation to product cost.
- The external reference fixture currently verifies production, sales, finished-goods inventory and revenue for project periods 5–10. Full financial parity across all statements remains unverified.
