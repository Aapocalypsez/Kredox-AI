import argparse
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier


FEATURES = [
    "bureau_score",
    "monthly_income",
    "age",
    "employment_type",
    "existing_loans",
    "loan_amount_requested",
    "geo_score",
    "liveness_score",
    "llm_confidence_score",
]
TARGET = "loan_defaulted"


def build_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            ("employment", OneHotEncoder(handle_unknown="ignore"), ["employment_type"]),
        ],
        remainder="passthrough",
        verbose_feature_names_out=False,
    )

    classifier = XGBClassifier(
        n_estimators=240,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
    )

    return Pipeline([
        ("preprocess", preprocessor),
        ("model", classifier),
    ])


def plot_feature_importance(pipeline: Pipeline, output_path: Path) -> None:
    model = pipeline.named_steps["model"]
    feature_names = pipeline.named_steps["preprocess"].get_feature_names_out()
    importance = pd.Series(model.feature_importances_, index=feature_names).sort_values()

    plt.figure(figsize=(9, 6))
    importance.tail(12).plot(kind="barh", color="#00a870")
    plt.title("XGBoost feature importance")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Kredox AI risk propensity model")
    parser.add_argument("--data", default="historical_loan_data.csv", help="CSV with historical loan data")
    parser.add_argument("--model-out", default="risk_model.pkl", help="Output model path")
    parser.add_argument("--importance-out", default="feature_importance.png", help="Feature importance chart path")
    args = parser.parse_args()

    data = pd.read_csv(args.data)
    missing = [column for column in FEATURES + [TARGET] if column not in data.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    frame = data[FEATURES + [TARGET]].copy()
    frame["employment_type"] = frame["employment_type"].fillna("unknown").astype(str).str.lower()
    for column in [feature for feature in FEATURES if feature != "employment_type"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0)

    x = frame[FEATURES]
    y = frame[TARGET].astype(int)

    pipeline = build_pipeline()
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    probabilities = cross_val_predict(pipeline, x, y, cv=cv, method="predict_proba")[:, 1]
    predictions = (probabilities >= 0.5).astype(int)

    print(f"accuracy={accuracy_score(y, predictions):.4f}")
    print(f"auc_roc={roc_auc_score(y, probabilities):.4f}")

    x_train, _x_test, y_train, _y_test = train_test_split(
        x,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )
    pipeline.fit(x_train, y_train)

    joblib.dump(
        {
            "pipeline": pipeline,
            "features": FEATURES,
            "target": TARGET,
        },
        args.model_out,
    )
    plot_feature_importance(pipeline, Path(args.importance_out))
    print(f"saved_model={args.model_out}")
    print(f"feature_importance_chart={args.importance_out}")


if __name__ == "__main__":
    main()

