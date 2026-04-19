from pathlib import Path
from typing import Dict

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


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


def load_bundle():
    global model_bundle, explainer
    if model_bundle is not None:
        return model_bundle
    if not MODEL_PATH.exists():
        raise HTTPException(status_code=503, detail="risk_model.pkl not found. Run train_model.py first.")

    model_bundle = joblib.load(MODEL_PATH)
    pipeline = model_bundle["pipeline"]
    preprocessor = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]
    explainer = shap.TreeExplainer(model)
    model_bundle["preprocessor"] = preprocessor
    model_bundle["model"] = model
    return model_bundle


def to_frame(payload: PredictionRequest) -> pd.DataFrame:
    row = payload.model_dump()
    row["employment_type"] = str(row["employment_type"] or "unknown").lower().replace("-", "_").replace(" ", "_")
    return pd.DataFrame([row])


def shap_contributions(bundle, frame: pd.DataFrame) -> Dict[str, float]:
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
    return {"ok": True, "service": "kredox-ai-ml"}


@app.post("/ml/predict", response_model=PredictionResponse)
def predict(payload: PredictionRequest):
    bundle = load_bundle()
    frame = to_frame(payload)
    probability = float(bundle["pipeline"].predict_proba(frame)[0][1])
    score = int(round((1 - probability) * 100))

    return {
        "default_probability": round(probability, 4),
        "risk_score": score,
        "risk_band": risk_band(score),
        "feature_contributions": shap_contributions(bundle, frame),
    }
