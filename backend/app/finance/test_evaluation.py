from app.finance.evaluation import evaluate_project, irr, npv, payback_period


def test_npv_zero_discount():
    assert npv(100, [60, 60], 0) == 20


def test_npv_discounted():
    assert abs(npv(100, [110], 0.10)) < 1e-9


def test_irr_roundtrip():
    assert abs(irr(100, [110]) - 0.10) < 1e-8


def test_irr_negative_for_losing_project():
    assert irr(100, [10, 10]) < 0


def test_irr_none_without_sign_change():
    assert irr(100, [0, 0]) is None


def test_payback_interpolation():
    assert abs(payback_period(100, [60, 60]) - 1 - 2 / 3) < 1e-9
    assert payback_period(100, [10, 10]) is None


def test_discounted_payback_longer_than_simple():
    simple = payback_period(100, [60, 60, 60])
    discounted = payback_period(100, [60, 60, 60], 0.2)
    assert discounted > simple


def test_evaluate_project_shape():
    result = evaluate_project(100, [60, 60, 60], 0.1)
    assert result["decision_hint"] == "positive_npv"
    assert set(result) >= {"npv", "irr", "profitability_index", "payback_years", "discounted_payback_years"}


def test_invalid_rate():
    try:
        npv(100, [10], -1)
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_zero_initial_investment_rejected_for_project_metrics():
    try:
        evaluate_project(0, [10, 20], 0.1)
    except ValueError:
        return
    raise AssertionError("expected ValueError")
