from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel, Field

try:
    import shap
except ImportError:  # SHAP is optional for the free/demo runtime.
    shap = None


MODEL_PATH = Path("risk_model.pkl")
FEATURES = [
    "bureau_score",
    "monthly_income",
    "age",
    "employment_type",
    "existing_loans",
    "loan_amount_requested",
    "geo_score",
    "geo_mismatch",
    "liveness_score",
    "llm_confidence_score",
]


class PredictionRequest(BaseModel):
    bureau_score: float = 0
    monthly_income: float = 0
    age: float = 0
    employment_type: str = "unknown"
    existing_loans: float = 0
    loan_amount_requested: float = 0
    geo_score: float = 0
    geo_mismatch: float = 0
    liveness_score: float = 0
    llm_confidence_score: float = 0


class PredictionResponse(BaseModel):
    default_probability: float
    risk_score: int
    risk_band: str
    feature_contributions: Dict[str, float] = Field(default_factory=dict)
    demo_mode: bool = False
    model_version: str = "xgboost"


app = FastAPI(title="Kredox AI ML Risk Model")
model_bundle = None
explainer = None


def risk_band(score: int) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    return "D"


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def fallback_prediction(payload: PredictionRequest) -> PredictionResponse:
    """Demo-safe scoring used when risk_model.pkl is not available.

    This keeps Render/free deployments functional while a real historical
    dataset is not available. The score is deterministic and conservative.
    """
    employment = str(payload.employment_type or "unknown").lower().replace("-", "_").replace(" ", "_")
    bureau = clamp(payload.bureau_score, 300, 900)
    income = max(payload.monthly_income, 0)
    age = payload.age
    existing_loans = max(payload.existing_loans, 0)
    amount = max(payload.loan_amount_requested, 0)
    geo_score = clamp(payload.geo_score)
    liveness = clamp(payload.liveness_score)
    llm_confidence = clamp(payload.llm_confidence_score)

    contributions: Dict[str, float] = {}

    contributions["bureau_score"] = round(((bureau - 300) / 600) * 35, 2)

    if income >= 100000:
        contributions["income"] = 15
    elif income >= 50000:
        contributions["income"] = 12
    elif income >= 25000:
        contributions["income"] = 8
    elif income >= 15000:
        contributions["income"] = 4
    else:
        contributions["income"] = -10

    if 21 <= age <= 60:
        contributions["age"] = 8
    elif 18 <= age <= 65:
        contributions["age"] = 2
    else:
        contributions["age"] = -12

    if employment == "salaried":
        contributions["employment_type"] = 10
    elif employment in {"self_employed", "business"}:
        contributions["employment_type"] = 6
    else:
        contributions["employment_type"] = -3

    if existing_loans == 0:
        contributions["existing_loans"] = 8
    elif existing_loans == 1:
        contributions["existing_loans"] = 5
    elif existing_loans <= 3:
        contributions["existing_loans"] = 1
    else:
        contributions["existing_loans"] = -10

    if income <= 0 or amount <= 0:
        contributions["loan_amount_requested"] = -3
    elif amount <= income * 12 * 0.4:
        contributions["loan_amount_requested"] = 7
    elif amount <= income * 12 * 0.7:
        contributions["loan_amount_requested"] = 2
    else:
        contributions["loan_amount_requested"] = -8

    contributions["geo_score"] = round((geo_score - 50) * 0.16, 2)
    if payload.geo_mismatch:
        contributions["geo_mismatch"] = -12

    if liveness >= 80:
        contributions["liveness_score"] = 8
    elif liveness >= 60:
        contributions["liveness_score"] = 3
    else:
        contributions["liveness_score"] = -12

    if llm_confidence >= 80:
        contributions["llm_confidence_score"] = 5
    elif llm_confidence >= 60:
        contributions["llm_confidence_score"] = 2
    else:
        contributions["llm_confidence_score"] = -4

    score = int(round(clamp(35 + sum(contributions.values()))))
    probability = round(1 - (score / 100), 4)

    return PredictionResponse(
        default_probability=probability,
        risk_score=score,
        risk_band=risk_band(score),
        feature_contributions=dict(
            sorted(contributions.items(), key=lambda item: abs(item[1]), reverse=True)
        ),
        demo_mode=True,
        model_version="fallback-v1",
    )


def load_bundle():
    global model_bundle, explainer
    if model_bundle is not None:
        return model_bundle
    if not MODEL_PATH.exists():
        return None

    try:
        model_bundle = joblib.load(MODEL_PATH)
    except Exception:
        model_bundle = None
        return None
    pipeline = model_bundle["pipeline"]
    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    if shap is not None:
        explainer = shap.TreeExplainer(model)
    model_bundle["preprocessor"] = preprocessor
    model_bundle["model"] = model
    return model_bundle


def to_frame(payload: PredictionRequest) -> pd.DataFrame:
    row = payload.model_dump()
    row["employment_type"] = str(row["employment_type"] or "unknown").lower().replace("-", "_").replace(" ", "_")
    return pd.DataFrame([row])


def shap_contributions(bundle, frame: pd.DataFrame) -> Dict[str, float]:
    if explainer is None:
        return {}

    transformed = bundle["preprocessor"].transform(frame)
    values = explainer.shap_values(transformed)
    if isinstance(values, list):
        values = values[1]
    values = np.asarray(values)[0]
    feature_names = bundle["preprocessor"].get_feature_names_out()
    mapped: Dict[str, float] = {}

    for name, value in zip(feature_names, values):
        clean_name = name
        if clean_name.startswith("employment_type_"):
            clean_name = "employment_type"
        elif clean_name in ("monthly_income", "loan_amount_requested"):
            clean_name = "income" if clean_name == "monthly_income" else clean_name
        elif clean_name == "geo_score":
            clean_name = "geo_mismatch"
        mapped[clean_name] = round(mapped.get(clean_name, 0) + float(value) * 10, 2)

    return dict(sorted(mapped.items(), key=lambda item: abs(item[1]), reverse=True)[:8])


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "kredox-ai-ml",
        "model_loaded": MODEL_PATH.exists(),
        "fallback_enabled": True,
    }


@app.post("/ml/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    bundle = load_bundle()
    if bundle is None:
        return fallback_prediction(payload)

    frame = to_frame(payload)
    probability = float(bundle["pipeline"].predict_proba(frame)[0][1])
    score = int(round((1 - probability) * 100))

    return {
        "default_probability": round(probability, 4),
        "risk_score": score,
        "risk_band": risk_band(score),
        "feature_contributions": shap_contributions(bundle, frame),
    }
