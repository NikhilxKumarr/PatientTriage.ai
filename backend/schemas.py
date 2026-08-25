from pydantic import BaseModel, Field
from typing import Optional


class PatientInput(BaseModel):
    age: int = Field(..., ge=0, le=120)

    heart_rate: Optional[int] = Field(None, ge=20, le=250)
    spo2: Optional[int] = Field(None, ge=50, le=100)
    systolic_bp: Optional[int] = Field(None, ge=50, le=250)

    temperature: Optional[float] = Field(None, ge=30, le=45)
    respiratory_rate: Optional[int] = Field(None, ge=5, le=60)
    pain_level: Optional[int] = Field(None, ge=0, le=10)

    chest_pain: Optional[int] = None
    shortness_breath: Optional[int] = None
    confusion: Optional[int] = None
    weakness: Optional[int] = None
    speech_problem: Optional[int] = None
    severe_bleeding: Optional[int] = None

    cardiac_history: Optional[int] = None
    diabetes: Optional[int] = None
    hypertension: Optional[int] = None
    previous_stroke: Optional[int] = None

    history_available: bool = False

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