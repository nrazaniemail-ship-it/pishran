from app.finance.evaluation import npv

def test_npv_zero_discount():
    assert npv(100, [60, 60], 0) == 20

def test_npv_discounted():
    result = npv(100, [110], 0.10)
    assert abs(result) < 1e-9
