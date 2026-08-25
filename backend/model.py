import os
import joblib
import pandas as pd


MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "triage_model.pkl"
)

model_data = joblib.load(MODEL_PATH)

model = model_data["model"]
FEATURES = model_data["features"]


RISK_LEVELS = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
    3: "CRITICAL"
}


def predict_risk(patient):
    data = {}
    missing_features = []

    for feature in FEATURES:

        value = patient.get(feature)

        if value is None:
            missing_features.append(feature)

            # Keep the existing model compatible.
            # The safety layer will separately account
            # for the missing information.
            data[feature] = 0

        else:
            data[feature] = value

    df = pd.DataFrame([data])

    probabilities = model.predict_proba(df)[0]

    prediction = int(model.predict(df)[0])

    risk_level = RISK_LEVELS[prediction]

    probability = float(probabilities[prediction])

    risk_score = round(probability * 100)

    return {
        "risk_level": risk_level,
        "risk_probability": round(probability, 3),
        "risk_score": risk_score,
        "missing_features": missing_features
    }