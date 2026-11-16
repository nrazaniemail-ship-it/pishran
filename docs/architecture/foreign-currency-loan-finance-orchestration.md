# Foreign-currency loan finance orchestration

## Integrated path

`buildPeriodicLoanFacilityBinding` converts a saved loan form into the periodic loan schedule, resolves the currency against the project currency directory, translates foreign-currency movements using explicit period exchange rates, and creates a local-currency precomputed schedule.

`bindLoanFacilitiesToPeriodicFinance` inserts those schedules into the existing periodic finance input. `calculatePeriodicFinanceWithForeignCurrencyLoans` then:

1. calculates the project using the existing periodic finance engine;
2. builds the linked three financial statements using transaction-date carrying amounts;
3. aggregates FX gains/losses from all foreign loan facilities by period;
4. posts remeasurement into P&L, tax, cash flow and the balance sheet.

Foreign-currency remeasurement is posted after the base statements are built. The base loan schedule therefore retains transaction-date carrying values; it must not include period-end remeasurement twice.

## Loan-form mapping

- The first dated interest-rate row is the base rate; later rows are effective-dated resets.
- Disbursement dates are preserved as dated loan events.
- The first repayment date identifies the first principal repayment period.
- Annuity and constant-principal forms map to their corresponding schedule methods.
- Profile forms map to dated custom principal repayments.
- Partial interest capitalization and its inclusive end date are supported by the periodic loan engine.

The project calendar must match the selected repayment frequency. The loan form now captures each fee's payment date, currency and expense/capitalization treatment, plus the facility commitment limit needed for commitment fees. The adapter calculates agency, guarantee, commitment and other fees using the help fee-basis function. Agency fees must align with positive disbursement dates; other fees must align with the first positive disbursement date. Fee bases are calculated from the preliminary principal schedule before fee posting, so capitalized fees do not recursively alter their own basis.

## Exchange-rate convention

The currency directory must provide one unique positive period rate for every project period. The period rate translates aggregated period movements and the closing debt remeasurement. This is not a transaction-date spot-rate convention. An opening foreign debt balance requires an explicit opening exchange rate.

## Validation boundary

Regression tests cover loan form mapping, partial capitalization, foreign currency translation, precomputed local-currency schedule validation and linked statement posting. This engine-level orchestration does not yet claim full parity with the external reference output; period-by-period external benchmark reconciliation remains a separate gate.
