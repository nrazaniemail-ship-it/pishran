"""Preliminary project evaluation.

Convention: the initial investment occurs at t=0 and annual_cash_flows[0] is the cash flow of year 1
(discounted one full period). This differs from COMFAR-style tables where year 1 may sit at period 0;
the frontend engine documents and tests that convention separately.
"""
from typing import Optional


def _check_rate(discount_rate: float) -> None:
    if discount_rate <= -1:
        raise ValueError("discount_rate must be greater than -1")


def npv(initial_investment: float, cash_flows: list[float], discount_rate: float) -> float:
    _check_rate(discount_rate)
    return -initial_investment + sum(
        cash_flow / ((1 + discount_rate) ** year)
        for year, cash_flow in enumerate(cash_flows, start=1)
    )


def irr(initial_investment: float, cash_flows: list[float],
        lo: float = -0.99, hi: float = 10.0, tol: float = 1e-10, max_iter: int = 500) -> Optional[float]:
    """IRR by bisection; None when NPV does not change sign on [lo, hi]."""
    f_lo, f_hi = npv(initial_investment, cash_flows, lo), npv(initial_investment, cash_flows, hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(max_iter):
        mid = (lo + hi) / 2
        f_mid = npv(initial_investment, cash_flows, mid)
        if abs(f_mid) < tol or (hi - lo) / 2 < tol:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def payback_period(initial_investment: float, cash_flows: list[float], discount_rate: float = 0.0) -> Optional[float]:
    """Payback in years (linear interpolation); discount_rate > 0 gives discounted payback."""
    _check_rate(discount_rate)
    cumulative = -initial_investment
    for year, cash_flow in enumerate(cash_flows, start=1):
        step = cash_flow / ((1 + discount_rate) ** year)
        if cumulative < 0 <= cumulative + step:
            return (year - 1) + (-cumulative) / step
        cumulative += step
    return None


def evaluate_project(initial_investment: float, cash_flows: list[float], discount_rate: float) -> dict:
    if initial_investment <= 0:
        raise ValueError("initial_investment must be greater than zero")
    if not cash_flows:
        raise ValueError("At least one annual cash flow is required")
    value = npv(initial_investment, cash_flows, discount_rate)
    pv_inflows = value + initial_investment
    project_irr = irr(initial_investment, cash_flows)
    simple_payback = payback_period(initial_investment, cash_flows)
    discounted_payback = payback_period(initial_investment, cash_flows, discount_rate)
    return {
        "currency": "user-defined",
        "npv": round(value, 4),
        "irr": None if project_irr is None else round(project_irr, 6),
        "profitability_index": round(pv_inflows / initial_investment, 6),
        "payback_years": None if simple_payback is None else round(simple_payback, 4),
        "discounted_payback_years": None if discounted_payback is None else round(discounted_payback, 4),
        "discount_rate": discount_rate,
        "cash_flow_periods": len(cash_flows),
        "decision_hint": "positive_npv" if value > 0 else "non_positive_npv",
        "disclaimer": "Preliminary calculation only. Validate assumptions, timing, tax, inflation and financing before investment use.",
    }
