from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4

from schemas import PatientInput, NurseDecision
from model import predict_risk
from demo import SIMULATED_PATIENTS

from database import (
    init_db,
    save_patient,
    get_patients,
    get_demo_patients,
    get_queue_patients,
    clear_demo_patients,
    get_patient,
    update_decision
)


app = FastAPI(
    title="PatientTriage.ai API",
    description="AI-assisted emergency triage prototype",
    version="1.0.0"
)


def get_age_group(age: int) -> str:
    if age < 18:
        return "PEDIATRIC"

    if age >= 65:
        return "GERIATRIC"

    return "ADULT"


def assess_uncertainty(
    data_completeness: float,
    missing_fields: list,
    patient: PatientInput
) -> dict:

    safety_flags = []

    if data_completeness >= 0.9:
        confidence = "HIGH"
        uncertainty = "LOW"

    elif data_completeness >= 0.6:
        confidence = "MEDIUM"
        uncertainty = "MEDIUM"

    else:
        confidence = "LOW"
        uncertainty = "HIGH"

    if not patient.history_available:
        safety_flags.append(
            "Medical history unavailable"
        )

    if missing_fields:
        safety_flags.append(
            f"{len(missing_fields)} required data fields unavailable"
        )

    complaint = (
        patient.chief_complaint or ""
    ).strip().lower()

    ambiguous_terms = [
        "don't feel right",
        "feel strange",
        "feeling strange",
        "weak",
        "unwell",
        "not sure",
        "unknown"
    ]

    if any(term in complaint for term in ambiguous_terms):
        safety_flags.append(
            "Ambiguous presenting complaint"
        )

        if confidence == "HIGH":
            confidence = "MEDIUM"
            uncertainty = "MEDIUM"

        elif confidence == "MEDIUM":
            confidence = "LOW"
            uncertainty = "HIGH"

    return {
        "confidence": confidence,
        "uncertainty": uncertainty,
        "safety_flags": safety_flags
    }


def assess_age_specific_safety(
    patient: PatientInput,
    age_group: str
) -> dict:

    safety_flags = []
    reasons = []
    risk_adjustment = "NONE"

    # Pediatric safety checks
    if age_group == "PEDIATRIC":

        if (
            patient.temperature is not None
            and patient.temperature >= 38.5
        ):
            safety_flags.append(
                "Pediatric fever requires age-specific review"
            )

            reasons.append(
                f"Temperature {patient.temperature}°C in a pediatric patient"
            )

        if (
            patient.heart_rate is not None
            and patient.heart_rate >= 140
        ):
            safety_flags.append(
                "Elevated pediatric heart rate"
            )

            reasons.append(
                f"Heart rate {patient.heart_rate} bpm"
            )

        if (
            patient.respiratory_rate is not None
            and patient.respiratory_rate >= 30
        ):
            safety_flags.append(
                "Elevated pediatric respiratory rate"
            )

            reasons.append(
                f"Respiratory rate {patient.respiratory_rate} breaths/min"
            )

        if (
            patient.spo2 is not None
            and patient.spo2 < 94
        ):
            safety_flags.append(
                "Low oxygen saturation in pediatric patient"
            )

            reasons.append(
                f"SpO₂ {patient.spo2}%"
            )

        if patient.confusion:
            safety_flags.append(
                "Altered mental status in pediatric patient"
            )

            reasons.append(
                "Confusion reported"
            )

        if patient.shortness_breath:
            safety_flags.append(
                "Breathing difficulty in pediatric patient"
            )

            reasons.append(
                "Shortness of breath reported"
            )

    # Geriatric safety checks
    elif age_group == "GERIATRIC":

        if patient.confusion:
            safety_flags.append(
                "Altered mental status in geriatric patient"
            )

            reasons.append(
                "Confusion reported"
            )

        if patient.weakness:
            safety_flags.append(
                "Weakness in geriatric patient"
            )

            reasons.append(
                "Weakness reported"
            )

        if (
            patient.spo2 is not None
            and patient.spo2 < 94
        ):
            safety_flags.append(
                "Low oxygen saturation in geriatric patient"
            )

            reasons.append(
                f"SpO₂ {patient.spo2}%"
            )

        if (
            patient.heart_rate is not None
            and patient.heart_rate >= 120
        ):
            safety_flags.append(
                "Elevated heart rate in geriatric patient"
            )

            reasons.append(
                f"Heart rate {patient.heart_rate} bpm"
            )

        if not patient.history_available:
            safety_flags.append(
                "Limited medical history in geriatric patient"
            )

            reasons.append(
                "Historical clinical information unavailable"
            )

    if safety_flags:
        risk_adjustment = "REVIEW_REQUIRED"

    return {
        "risk_adjustment": risk_adjustment,
        "safety_flags": safety_flags,
        "reasons": reasons
    }

def process_patient(
    patient: PatientInput,
    is_demo: bool = False
) -> dict:

    patient_data = patient.model_dump()

    # -----------------------------------------
    # AGE GROUP
    # -----------------------------------------

    age_group = get_age_group(patient.age)

    age_safety = assess_age_specific_safety(
        patient,
        age_group
    )

    # -----------------------------------------
    # DATA COMPLETENESS
    # -----------------------------------------

    required_fields = [
        "heart_rate",
        "spo2",
        "systolic_bp",
        "temperature",
        "respiratory_rate",
        "pain_level"
    ]

    missing_fields = [
        field
        for field in required_fields
        if patient_data.get(field) is None
    ]

    available_count = (
        len(required_fields) - len(missing_fields)
    )

    vital_completeness = (
        available_count / len(required_fields)
    )

    history_completeness = (
        1.0 if patient.history_available else 0.0
    )

    data_completeness = round(
        (vital_completeness * 0.70)
        + (history_completeness * 0.30),
        2
    )

    if not patient.history_available:
        missing_fields.append(
            "medical_history"
        )

    # -----------------------------------------
    # MODEL PREDICTION
    # -----------------------------------------

    prediction = predict_risk(patient_data)

    model_missing_fields = prediction.get(
        "missing_features",
        []
    )

    for field in model_missing_fields:
        if field not in missing_fields:
            missing_fields.append(field)

    # -----------------------------------------
    # UNCERTAINTY
    # -----------------------------------------

    uncertainty = assess_uncertainty(
        data_completeness,
        missing_fields,
        patient
    )

    uncertainty["safety_flags"].extend(
        age_safety["safety_flags"]
    )

    risk_level = prediction["risk_level"]

    original_risk_level = risk_level

    # Safety-first escalation.
    if (
        uncertainty["uncertainty"] == "HIGH"
        and risk_level == "LOW"
    ):
        risk_level = "MEDIUM"

    if risk_level != original_risk_level:
        uncertainty["safety_flags"].append(
            "Risk escalated because of high uncertainty"
        )

    # -----------------------------------------
    # RECOMMENDED ACTION
    # -----------------------------------------

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

    # -----------------------------------------
    # QUEUE TIMING
    # -----------------------------------------

    arrival_time = datetime.now(timezone.utc)

    reassessment_due_at = (
        arrival_time
        + timedelta(minutes=reassessment)
    )

    queue_status = "WAITING"

    # -----------------------------------------
    # KEY CLINICAL FACTORS
    # -----------------------------------------

    factors = []

    if patient.chest_pain:
        factors.append({
            "factor": "Chest pain",
            "impact": "HIGH",
            "detail": "Patient reports active chest pain"
        })

    if patient.shortness_breath:
        factors.append({
            "factor": "Shortness of breath",
            "impact": "HIGH",
            "detail": "Patient reports difficulty breathing"
        })

    if patient.confusion:
        factors.append({
            "factor": "Confusion",
            "impact": "HIGH",
            "detail": "Altered mental state reported"
        })

    if patient.speech_problem:
        factors.append({
            "factor": "Speech difficulty",
            "impact": "HIGH",
            "detail": "Speech difficulty reported"
        })

    if patient.severe_bleeding:
        factors.append({
            "factor": "Severe bleeding",
            "impact": "HIGH",
            "detail": "Significant bleeding reported"
        })

    if (
        patient.heart_rate is not None
        and patient.heart_rate >= 120
    ):
        factors.append({
            "factor": "Elevated heart rate",
            "impact": "MEDIUM",
            "detail": f"{patient.heart_rate} bpm"
        })

    if (
        patient.spo2 is not None
        and patient.spo2 < 94
    ):
        factors.append({
            "factor": "Low SpO₂",
            "impact": "HIGH",
            "detail": f"{patient.spo2}% oxygen saturation"
        })

    if (
        patient.pain_level is not None
        and patient.pain_level >= 7
    ):
        factors.append({
            "factor": "Severe pain",
            "impact": "MEDIUM",
            "detail": f"{patient.pain_level}/10 reported pain"
        })

    if patient.cardiac_history:
        factors.append({
            "factor": "Cardiac history",
            "impact": "HIGH",
            "detail": "Previous cardiac condition reported"
        })

    if patient.previous_stroke:
        factors.append({
            "factor": "Previous stroke",
            "impact": "HIGH",
            "detail": "Previous stroke reported"
        })

    # -----------------------------------------
    # FINAL RESULT
    # -----------------------------------------

    result = {
        "patient_id": f"PT-{str(uuid4())[:8].upper()}",
        "risk_level": risk_level,
        "risk_probability": prediction["risk_probability"],
        "risk_score": prediction["risk_score"],
        "recommended_action": action,
        "reassessment_minutes": reassessment,

        # Queue information
        "arrival_time": arrival_time.isoformat(),
        "reassessment_due_at": reassessment_due_at.isoformat(),
        "queue_status": queue_status,
        "last_reassessment": None,

        # Round 2 data-model fields
        "age_group": age_group,
        "history_available": patient.history_available,
        "data_completeness": data_completeness,
        "missing_fields": missing_fields,

        # Uncertainty
        "confidence": uncertainty["confidence"],
        "uncertainty": uncertainty["uncertainty"],
        "safety_flags": uncertainty["safety_flags"],

        # Age-specific safety
        "age_safety": {
            "risk_adjustment": age_safety["risk_adjustment"],
            "reasons": age_safety["reasons"]
        },

        "key_factors": factors,
        "nurse_confirmation_required": True
    }

    # -----------------------------------------
    # SAVE PATIENT
    # -----------------------------------------

    save_patient(
        result["patient_id"],
        patient_data,
        result,
        is_demo=is_demo,
        arrival_time=result["arrival_time"],
        reassessment_due_at=result["reassessment_due_at"],
        queue_status=result["queue_status"]
    )

    return result


# -----------------------------------------
# FASTAPI CONFIGURATION
# -----------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
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


# -----------------------------------------
# NORMAL PATIENT INTAKE
# -----------------------------------------

@app.post("/intake")
def intake(patient: PatientInput):
    return process_patient(patient)


# -----------------------------------------
# PATIENT QUEUE
# -----------------------------------------

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


# -----------------------------------------
# NURSE DECISION
# -----------------------------------------

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

    allowed = [
        "ACCEPT",
        "MODIFY",
        "ESCALATE"
    ]

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

# -----------------------------------------
# SURGE QUEUE
# -----------------------------------------

@app.get("/queue")
def queue():

    patients = get_queue_patients()

    if not patients:
        return {
            "queue_status": "EMPTY",
            "patients": [],
            "total_patients": 0
        }

    # Only active waiting patients belong in the queue.
    waiting = [
        patient
        for patient in patients
        if patient.get("queue_status") == "WAITING"
    ]

    # Priority order:
    # CRITICAL > HIGH > MEDIUM > LOW
    risk_priority = {
        "CRITICAL": 4,
        "HIGH": 3,
        "MEDIUM": 2,
        "LOW": 1
    }

    def queue_priority(patient):
        risk = risk_priority.get(
            patient.get("risk_level"),
            0
        )

        uncertainty = (
            1
            if patient.get("uncertainty") == "HIGH"
            else 0
        )

        return (
            -risk,
            -uncertainty,
            patient.get("arrival_time", "")
        )

    waiting.sort(key=queue_priority)

    return {
        "queue_status": (
            "SURGE"
            if len(waiting) >= 40
            else "NORMAL"
        ),
        "total_patients": len(waiting),
        "patients": waiting
    }




# -----------------------------------------
# ROUND 2 DEMO
# -----------------------------------------

@app.post("/demo/seed")
def seed_demo_patients():

    # Remove previous simulated patients so every demo
    # run starts with exactly the same dataset.
    deleted = clear_demo_patients()

    created = []

    for patient_data in SIMULATED_PATIENTS:

        patient = PatientInput(**patient_data)

        result = process_patient(
            patient,
            is_demo=True
        )

        created.append(result)

    return {
        "status": "demo_seeded",
        "previous_demo_patients_removed": deleted,
        "patients_created": len(created),
        "patients": created
    }

@app.get("/demo/summary")
def demo_summary():

    patients = get_demo_patients()

    if not patients:
        return {
            "patients": 0,
            "message": "No demo patients available"
        }

    summary = {
        "patients": len(patients),
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "pending": 0,
        "high_uncertainty": 0,
        "age_groups": {
            "PEDIATRIC": 0,
            "ADULT": 0,
            "GERIATRIC": 0
        }
    }

    for patient in patients:

        risk = patient.get("risk_level")

        if risk == "CRITICAL":
            summary["critical"] += 1

        elif risk == "HIGH":
            summary["high"] += 1

        elif risk == "MEDIUM":
            summary["medium"] += 1

        elif risk == "LOW":
            summary["low"] += 1

        if patient.get("decision") == "PENDING":
            summary["pending"] += 1

        if patient.get("uncertainty") == "HIGH":
            summary["high_uncertainty"] += 1

        age_group = patient.get("age_group")

        if age_group in summary["age_groups"]:
            summary["age_groups"][age_group] += 1

    return summary


# -----------------------------------------
# ROUND 2 SURGE SIMULATION
# -----------------------------------------

@app.post("/demo/surge")
def simulate_surge():

    # Start with a clean demo queue.
    deleted = clear_demo_patients()

    created = []

    # 3x normal emergency-department volume.
    # Existing demo dataset contains 20 patients.
    surge_patients = (
        SIMULATED_PATIENTS
        + SIMULATED_PATIENTS
        + SIMULATED_PATIENTS
    )

    for patient_data in surge_patients:

        patient = PatientInput(**patient_data)

        result = process_patient(
            patient,
            is_demo=True
        )

        created.append(result)

    return {
        "status": "surge_simulated",
        "previous_demo_patients_removed": deleted,
        "normal_volume": len(SIMULATED_PATIENTS),
        "surge_multiplier": 3,
        "patients_created": len(created),
        "queue_status": "SURGE",
        "patients": created
    }