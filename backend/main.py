from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4

from schemas import PatientInput, NurseDecision
from model import predict_risk
from database import (
    init_db,
    save_patient,
    get_patients,
    get_patient,
    update_decision
)


app = FastAPI(
    title="PatientTriage.ai API",
    description="AI-assisted emergency triage prototype",
    version="1.0.0"
)


# Allow React frontend to communicate with FastAPI.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def root():
    return {
        "message": "PatientTriage.ai API is running",
        "status": "online"
    }


@app.post("/intake")
def intake(patient: PatientInput):

    patient_data = patient.model_dump()

    prediction = predict_risk(patient_data)

    risk_level = prediction["risk_level"]

    # Prototype recommendation logic.
    if risk_level == "CRITICAL":
        action = "Immediate clinical assessment"
        reassessment = 5

    elif risk_level == "HIGH":
        action = "Priority clinical assessment"
        reassessment = 15

    elif risk_level == "MEDIUM":
        action = "Clinical assessment recommended"
        reassessment = 30

    else:
        action = "Routine assessment"
        reassessment = 60

    # Identify important factors for the report card.
    factors = []

    if patient.chest_pain:
        factors.append({
            "factor": "Chest pain",
            "impact": "HIGH"
        })

    if patient.shortness_breath:
        factors.append({
            "factor": "Shortness of breath",
            "impact": "HIGH"
        })

    if patient.confusion:
        factors.append({
            "factor": "Confusion",
            "impact": "HIGH"
        })

    if patient.speech_problem:
        factors.append({
            "factor": "Speech difficulty",
            "impact": "HIGH"
        })

    if patient.severe_bleeding:
        factors.append({
            "factor": "Severe bleeding",
            "impact": "HIGH"
        })

    if patient.heart_rate >= 120:
        factors.append({
            "factor": f"Elevated heart rate ({patient.heart_rate} bpm)",
            "impact": "MEDIUM"
        })

    if patient.spo2 < 94:
        factors.append({
            "factor": f"Low SpO₂ ({patient.spo2}%)",
            "impact": "HIGH"
        })

    if patient.pain_level >= 7:
        factors.append({
            "factor": f"Severe pain ({patient.pain_level}/10)",
            "impact": "MEDIUM"
        })

    if patient.cardiac_history:
        factors.append({
            "factor": "Cardiac history",
            "impact": "HIGH"
        })

    if patient.previous_stroke:
        factors.append({
            "factor": "Previous stroke",
            "impact": "HIGH"
        })

    result = {
        "patient_id": f"PT-{str(uuid4())[:8].upper()}",
        "risk_level": risk_level,
        "risk_probability": prediction["risk_probability"],
        "risk_score": prediction["risk_score"],
        "recommended_action": action,
        "reassessment_minutes": reassessment,
        "key_factors": factors,
        "nurse_confirmation_required": True
    }

    save_patient(
        result["patient_id"],
        patient_data,
        result
    )

    return result


@app.get("/patients")
def patients():
    return get_patients()


@app.get("/patients/{patient_id}")
def patient_details(patient_id: str):

    patient = get_patient(patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found"
        )

    return patient


@app.post("/patients/{patient_id}/decision")
def nurse_decision(
    patient_id: str,
    decision: NurseDecision
):

    patient = get_patient(patient_id)

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found"
        )

    allowed = ["ACCEPT", "MODIFY", "ESCALATE"]

    if decision.decision not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Decision must be ACCEPT, MODIFY, or ESCALATE"
        )

    update_decision(
        patient_id,
        decision.decision,
        decision.note
    )

    return {
        "patient_id": patient_id,
        "decision": decision.decision,
        "note": decision.note,
        "status": "recorded"
    }
