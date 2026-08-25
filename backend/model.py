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

    for feature in FEATURES:
        data[feature] = patient.get(feature, 0)

    df = pd.DataFrame([data])

    probabilities = model.predict_proba(df)[0]

    prediction = int(model.predict(df)[0])

    risk_level = RISK_LEVELS[prediction]

    probability = float(probabilities[prediction])

    risk_score = round(probability * 100)

    return {
        "risk_level": risk_level,
        "risk_probability": round(probability, 3),
        "risk_score": risk_score
    }
