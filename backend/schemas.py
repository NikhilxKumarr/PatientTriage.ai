from pydantic import BaseModel, Field
from typing import Optional


class PatientInput(BaseModel):
    age: int = Field(..., ge=0, le=120)
    heart_rate: int = Field(..., ge=20, le=250)
    spo2: int = Field(..., ge=50, le=100)
    systolic_bp: int = Field(..., ge=50, le=250)

    temperature: float = Field(..., ge=30, le=45)
    respiratory_rate: int = Field(..., ge=5, le=60)
    pain_level: int = Field(..., ge=0, le=10)

    chest_pain: int = 0
    shortness_breath: int = 0
    confusion: int = 0
    weakness: int = 0
    speech_problem: int = 0
    severe_bleeding: int = 0

    cardiac_history: int = 0
    diabetes: int = 0
    hypertension: int = 0
    previous_stroke: int = 0

    chief_complaint: Optional[str] = ""
    patient_words: Optional[str] = ""


class NurseDecision(BaseModel):
    decision: str
    note: Optional[str] = ""


class PatientResponse(BaseModel):
    patient_id: str
    risk_level: str
    risk_probability: float
    risk_score: int

    recommended_action: str
    reassessment_minutes: int

    key_factors: list
    nurse_confirmation_required: bool
