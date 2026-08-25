# PatientTriage.ai

AI-assisted emergency triage prototype designed to support nurses with
prioritized, explainable risk assessments.

## Overview

PatientTriage.ai takes patient symptoms, vital signs, and medical history,
then generates an AI-assisted triage recommendation.

The system is designed around a human-in-the-loop workflow:

Patient Intake
→ AI Risk Assessment
→ Explainable Report Card
→ Nurse Decision
→ Prioritized Patient Queue

## Architecture

```text
React Frontend
      |
      | REST API
      v
FastAPI Backend
      |
      +---- XGBoost Risk Model
      |
      +---- SQLite Database
Tech Stack
Frontend
React
Vite
JavaScript
CSS
Backend
Python
FastAPI
Uvicorn
Machine Learning
XGBoost
scikit-learn
Pandas
Database
SQLite
Features
Patient intake form
Vital signs capture
Symptom and medical history capture
XGBoost-based prototype risk classification
Explainable risk factors
Risk score and probability
Recommended action
Reassessment interval
Nurse confirmation workflow
Accept / Modify / Escalate decisions
Nurse priority dashboard
Persistent patient records
Running the Backend
cd backend

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

python3 train_model.py

uvicorn main:app --reload

Backend:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs
Running the Frontend

Open another terminal:

cd frontend

npm install
npm run dev

Frontend:

http://localhost:5173
