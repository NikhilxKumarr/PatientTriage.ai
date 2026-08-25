
# PatientTriage.ai

> **AI-assisted emergency triage decision-support prototype for prioritizing patients with explainable risk assessments, safety checks, nurse decisions, and a live clinical priority queue.**

[![Python](https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![XGBoost](https://img.shields.io/badge/XGBoost-ML-FF6600)](https://xgboost.readthedocs.io/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)

> **Disclaimer:** PatientTriage.ai is an experimental prototype for educational and demonstration purposes. AI recommendations are advisory and require qualified clinical oversight.

---

## Overview

PatientTriage.ai is a human-in-the-loop emergency triage prototype designed to help nurses prioritize patients using structured clinical information and an AI-assisted risk assessment.

The system combines:

- Patient symptoms
- Vital signs
- Medical history
- Demographic information
- Risk classification
- Explainable clinical factors
- Safety and uncertainty checks
- Nurse-controlled decisions
- Reassessment workflows
- A live prioritized patient queue

The AI provides a **second opinion**, while the nurse remains responsible for the final decision.

---

## How It Works

```text
                    PATIENT INTAKE
                         │
                         ▼
                ┌─────────────────┐
                │  AI Assessment  │
                └────────┬────────┘
                         │
                         ▼
             ┌───────────────────────┐
             │ Risk + Explanation    │
             │ Safety + Uncertainty  │
             └───────────┬───────────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Nurse Review  │
                 └───────┬───────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
           ACCEPT      MODIFY    ESCALATE
              │          │          │
              └──────────┼──────────┘
                         ▼
                ┌─────────────────┐
                │ Priority Queue  │
                └────────┬────────┘
                         │
                         ▼
                  REASSESSMENT
                         │
                         ▼
                 Updated Queue
````

---

# Key Features

## 🩺 Patient Intake

Capture the information required for an initial triage assessment:

* Patient demographics
* Vital signs
* Chief complaint
* Symptoms
* Patient-reported information
* Medical history
* Risk-related clinical indicators

---

## 🤖 AI-Assisted Risk Assessment

The backend uses an XGBoost-based prototype model to classify patient risk.

### Risk Levels

| Level         | Meaning                      |
| ------------- | ---------------------------- |
| 🔴 `CRITICAL` | Immediate clinical attention |
| 🟠 `HIGH`     | High-priority assessment     |
| 🟡 `MEDIUM`   | Moderate priority            |
| 🟢 `LOW`      | Lower priority               |

The assessment provides:

* Risk level
* Risk score
* Risk probability
* Recommended action
* Explainable key factors

---

## 🛡️ Safety & Uncertainty Layer

The system does not rely solely on the model prediction.

Additional safety signals include:

* Data completeness
* Missing fields
* Confidence level
* Uncertainty level
* Age-group safety checks
* Pediatric safety considerations
* Geriatric safety considerations
* Clinical safety flags
* Additional-review indicators

This layer is designed to highlight situations where the model output requires additional human attention.

---

# 👩‍⚕️ Human-in-the-Loop Nurse Workflow

The AI does **not** make the final clinical decision.

After reviewing the assessment, the nurse can choose:

```text
ACCEPT
MODIFY
ESCALATE
```

Each decision can include a note and is persisted in the database.

### Decision Audit History

The system records:

* Patient ID
* Nurse decision
* Clinical note
* Timestamp
* Risk level
* Risk score
* Risk probability

This creates an audit trail for the human-in-the-loop workflow.

---

# 🚨 Live Priority Queue

The nurse dashboard provides a live queue of active patients.

Patients are prioritized according to risk:

```text
CRITICAL
    ↓
HIGH
    ↓
MEDIUM
    ↓
LOW
```

High-uncertainty patients receive additional priority within the queue.

### Queue Features

* Live patient queue
* Risk-based ordering
* Risk filters
* Pending-review filter
* High-uncertainty filter
* Reassessment-due filter
* Patient position
* Risk score
* Confidence indicator
* Decision status
* Queue health metrics

---

# 🚑 Surge Mode

PatientTriage.ai includes a synthetic emergency-department surge simulation.

When the active queue reaches the surge threshold, the dashboard switches to:

```text
🚨 SURGE MODE
```

Surge mode provides visibility into:

* Patient volume
* High-risk patient concentration
* Queue prioritization
* Queue health
* Reassessment workload

The prototype can simulate approximately **3× normal emergency-department volume** using synthetic patients.

---

# ⏱️ Reassessment Workflow

Patients receive a reassessment interval based on their triage assessment.

The system tracks:

* Arrival time
* Last reassessment
* Next reassessment deadline
* Queue status
* Reassessment countdown

When a reassessment becomes overdue:

```text
WAITING
   │
   ▼
REASSESSMENT_DUE
```

The dashboard highlights the patient:

```text
⚠ DUE
```

The nurse can then select:

```text
↻ Reassess
```

The reassessment workflow:

1. Records the reassessment timestamp.
2. Generates a new reassessment deadline.
3. Returns the patient to `WAITING`.
4. Updates the live queue.

---

# 📊 Nurse Dashboard

The dashboard provides an operational overview of the emergency queue.

### Risk Summary

```text
CRITICAL     HIGH     MEDIUM     LOW     PENDING REVIEW
```

### Queue Health

```text
HIGH UNCERTAINTY
REASSESSMENT DUE
TOTAL WAITING
```

The dashboard also provides:

* Current queue mode
* Surge alerts
* High-risk percentage
* Pending-review percentage
* Reassessment percentage
* Uncertainty percentage
* Live patient queue
* Nurse actions
* Patient filters
* Reassessment controls

---

# 🧪 Demo & Synthetic Data

The project includes synthetic patients for demonstrating the complete workflow without requiring real patient information.

Demo functionality includes:

* Synthetic patient generation
* Demo patient isolation
* Demo queue population
* Surge simulation
* Queue statistics
* Risk distribution analysis

No real patient data is required to run the prototype.

---

# 🏗️ Architecture

```text
┌───────────────────────────────────────┐
│             React Frontend            │
│               + Vite                  │
│                                       │
│  Patient Intake  │  Nurse Dashboard  │
└───────────────────┬───────────────────┘
                    │
                    │ REST API
                    ▼
┌───────────────────────────────────────┐
│            FastAPI Backend             │
│               + Uvicorn               │
│                                       │
│  Patient API │ Queue │ Reassessment  │
│  Decisions   │ Audit │ Demo / Surge  │
└───────────┬───────────────┬───────────┘
            │               │
            ▼               ▼
   ┌────────────────┐  ┌───────────────┐
   │ XGBoost Model  │  │ SQLite        │
   │                │  │ Database      │
   │ Risk           │  │               │
   │ Classification │  │ Patients      │
   │                │  │ Decisions     │
   └────────────────┘  │ Audit History │
                       └───────────────┘
```

---

# 🛠️ Tech Stack

| Layer            | Technology   |
| ---------------- | ------------ |
| Frontend         | React        |
| Build Tool       | Vite         |
| Styling          | CSS          |
| Backend          | Python       |
| API              | FastAPI      |
| Server           | Uvicorn      |
| Machine Learning | XGBoost      |
| ML Utilities     | scikit-learn |
| Data Processing  | Pandas       |
| Database         | SQLite       |

---

# 📁 Project Structure

```text
PatientTriage.ai/
│
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── train_model.py
│   ├── requirements.txt
│   ├── patients.db
│   └── ...
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   │
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# 🚀 Getting Started

## Prerequisites

Make sure the following are installed:

* Python 3
* Node.js
* npm
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/NikhilxKumarr/PatientTriage.ai.git
cd PatientTriage.ai
```

---

# 2. Run the Backend

Navigate to the backend:

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv venv
```

Activate it.

### macOS / Linux

```bash
source venv/bin/activate
```

### Windows

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Train the prototype model:

```bash
python3 train_model.py
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

---

# 3. Run the Frontend

Open a second terminal.

Navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

# 🔌 API Overview

## Patient Intake

```http
POST /intake
```

Runs an AI-assisted triage assessment for a new patient.

---

## Patient List

```http
GET /patients
```

Returns persisted patient records.

---

## Patient Details

```http
GET /patients/{patient_id}
```

Returns detailed information for a specific patient.

---

## Priority Queue

```http
GET /queue
```

Returns the active prioritized patient queue.

---

## Nurse Decision

```http
POST /patients/{patient_id}/decision
```

Records a nurse decision.

Supported decisions:

```text
ACCEPT
MODIFY
ESCALATE
```

---

## Decision History

```http
GET /patients/{patient_id}/decision-history
```

Returns the audit history for a patient's nurse decisions.

---

## Reassessment

```http
POST /patients/{patient_id}/reassess
```

Reassesses a patient and generates a new reassessment deadline.

---

## Demo Seed

```http
POST /demo/seed
```

Creates the synthetic demonstration dataset.

---

## Demo Summary

```http
GET /demo/summary
```

Returns statistics for the synthetic patient dataset.

---

## Surge Simulation

```http
POST /demo/surge
```

Creates the simulated surge workload.

---

# 🎬 Example Demo Workflow

A typical demonstration can follow this sequence:

```text
1. Open PatientTriage.ai
          │
          ▼
2. Enter patient information
          │
          ▼
3. Run AI assessment
          │
          ▼
4. Review risk score and explanation
          │
          ▼
5. Review safety flags and uncertainty
          │
          ▼
6. Nurse selects ACCEPT / MODIFY / ESCALATE
          │
          ▼
7. Patient appears in priority queue
          │
          ▼
8. Queue prioritizes high-risk patients
          │
          ▼
9. Reassessment deadline is reached
          │
          ▼
10. Patient becomes REASSESSMENT_DUE
          │
          ▼
11. Nurse selects ↻ Reassess
          │
          ▼
12. Patient returns to WAITING
```

---

# 🔐 Safety & Clinical Disclaimer

PatientTriage.ai is an **experimental prototype** intended for educational and software-development purposes.

It uses synthetic data and a prototype machine-learning model.

The system:

* Does not replace a qualified healthcare professional.
* Does not provide a medical diagnosis.
* Does not make autonomous clinical decisions.
* Requires human clinical oversight.
* Should not be used for real-world patient treatment without appropriate clinical validation.
* Has not undergone clinical validation or regulatory approval.
* Requires appropriate security, privacy, regulatory, and clinical safeguards before any real-world deployment.

All AI recommendations should be independently reviewed by qualified clinical personnel.

---

# ✅ Current Status

| Feature                          | Status |
| -------------------------------- | :----: |
| Patient intake                   |    ✅   |
| AI risk classification           |    ✅   |
| Explainable risk factors         |    ✅   |
| Safety & uncertainty layer       |    ✅   |
| Age-group safety checks          |    ✅   |
| Persistent patient records       |    ✅   |
| Nurse Accept / Modify / Escalate |    ✅   |
| Decision audit history           |    ✅   |
| Priority queue                   |    ✅   |
| Queue filtering                  |    ✅   |
| Surge detection                  |    ✅   |
| Surge simulation                 |    ✅   |
| Queue health metrics             |    ✅   |
| Reassessment countdown           |    ✅   |
| Automatic reassessment detection |    ✅   |
| Manual reassessment              |    ✅   |
| Synthetic demo dataset           |    ✅   |

---

# 📌 Project Status

**Prototype / Educational Project**

PatientTriage.ai demonstrates how machine-learning-assisted risk assessment can be integrated into a human-controlled emergency triage workflow.

The focus of the prototype is not autonomous diagnosis, but **prioritization, explainability, safety signaling, reassessment, and clinical decision support**.

---

## License

This project is a prototype developed for educational and demonstration purposes.

```
```
