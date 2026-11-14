from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.finance.evaluation import evaluate_project

router = APIRouter()

class FinancialEvaluationInput(BaseModel):
    initial_investment: float = Field(gt=0, description="Initial investment, in a consistent currency unit")
    annual_cash_flows: list[float] = Field(min_length=1, max_length=50)
    discount_rate: float = Field(ge=0, le=1, description="Discount rate as decimal, e.g. 0.12")

@router.post("/finance/evaluate")
def finance_evaluate(payload: FinancialEvaluationInput):
    try:
        return evaluate_project(
            payload.initial_investment,
            payload.annual_cash_flows,
            payload.discount_rate,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

@router.get("/meta")
def meta():
    return {
        "product": "Pishran",
        "market": ["Iran", "International"],
        "modules": ["engineering", "market", "finance", "risk", "scenarios", "ai"],
        "status": "foundation"
    }
