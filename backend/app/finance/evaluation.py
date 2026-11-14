def npv(initial_investment: float, cash_flows: list[float], discount_rate: float) -> float:
    if discount_rate <= -1:
        raise ValueError("discount_rate must be greater than -1")
    return -initial_investment + sum(
        cash_flow / ((1 + discount_rate) ** year)
        for year, cash_flow in enumerate(cash_flows, start=1)
    )

def evaluate_project(initial_investment: float, cash_flows: list[float], discount_rate: float) -> dict:
    if not cash_flows:
        raise ValueError("At least one annual cash flow is required")
    value = npv(initial_investment, cash_flows, discount_rate)
    return {
        "currency": "user-defined",
        "npv": round(value, 4),
        "discount_rate": discount_rate,
        "cash_flow_periods": len(cash_flows),
        "decision_hint": "positive_npv" if value > 0 else "non_positive_npv",
        "disclaimer": "Preliminary calculation only. Validate assumptions, timing, tax, inflation and financing before investment use."
    }
