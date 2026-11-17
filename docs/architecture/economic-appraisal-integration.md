# Economic appraisal integration

## Scope

The raw project model now has a separate economic-appraisal boundary. Financial statements and financial cash flows remain unchanged by economic appraisal inputs. The economic result is attached to the unified orchestration result as `economicAppraisal`.

## Supported calculation path

The supported calculation is **cost-benefit analysis with explicit period values already converted to the selected numeraire**:

- Enable economic analysis in project identification.
- Complete the global economic configuration: method, numeraire basis, currency, reporting unit, official and shadow exchange rates, standard and foreign-currency conversion factors, economic discount rate, and reference date.
- Assign economic items to the economic browser.
- For each assigned item, provide a financial-item reference, direction (`input` or `output`), project-calendar period, final period economic value, and currency.
- The final period economic value must already be expressed in the selected numeraire currency and reporting unit. The integration does not infer shadow prices or apply the price-adjustment fields to this value.

For each project period:

```text
Benefits_t = sum(period values for output items)
Costs_t    = sum(period values for input items)
Net_t      = Benefits_t - Costs_t
```

The integration calculates ENPV using the periodic financial engine's actual-date discounting convention and the economic reference date. It calculates EIRR with the same period dates and cash-flow timing, and BCR as present value of benefits divided by present value of costs. If no conventional single IRR root exists, EIRR is returned as null with an explicit status; ENPV and BCR remain available where calculable.

## Fail-closed boundaries

- The value-added method is not implemented and is rejected.
- The item-level CIF/FOB, border-price, tax/duty, value-added, tradeability, FX-exposure, transport and other adjustment fields are not automatically applied. If these are populated on an assigned item, the current explicit-numeraire pathway blocks rather than silently ignoring them.
- Foreign-loan transfers, indirect effects, employment and environmental effects are not yet assigned distinct shadow-price schedules. Populated economic-effects rows therefore block economic appraisal.
- Economic results are not claimed to be COMFAR-equivalent. A period-matched independent COMFAR benchmark is still required.

## Financial-model independence

If economic analysis is disabled and no items/effects are explicitly assigned or populated, the financial model proceeds without an economic result. If economic data is explicitly assigned while the feature is disabled, the run is blocked to prevent silent omission.
