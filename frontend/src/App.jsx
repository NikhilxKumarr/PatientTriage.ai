import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [form, setForm] = useState({
    age: 30,
    heart_rate: 80,
    spo2: 98,
    systolic_bp: 120,
    temperature: 37.0,
    respiratory_rate: 16,
    pain_level: 0,

    chest_pain: 0,
    shortness_breath: 0,
    confusion: 0,
    weakness: 0,
    speech_problem: 0,
    severe_bleeding: 0,

    cardiac_history: 0,
    diabetes: 0,
    hypertension: 0,
    previous_stroke: 0,

    chief_complaint: "",
    patient_words: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [page, setPage] = useState("intake");
  const [patients, setPatients] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(null);

  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous <= 1) {
          clearInterval(timer);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds]);

  function formatTime(seconds) {
    if (seconds === null) {
      return "--:--";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(
      2,
      "0",
    )}`;
  }

  function updateField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function toggleField(field) {
    setForm((previous) => ({
      ...previous,
      [field]: previous[field] ? 0 : 1,
    }));
  }

  async function assessPatient(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_URL}/intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Unable to assess patient");
      }

      const data = await response.json();

      setResult(data);
      setRemainingSeconds(data.reassessment_minutes * 60);
    } catch (err) {
      setError(
        "Could not connect to PatientTriage.ai backend. Make sure FastAPI is running on port 8000.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitDecision(type) {
    if (!result) return;

    setDecisionLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/patients/${result.patient_id}/decision`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision: type,
            note: `Nurse selected ${type}`,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("Unable to save nurse decision");
      }

      const data = await response.json();

      setDecision(data.decision);
    } catch (err) {
      setError("Could not save the nurse decision.");
    } finally {
      setDecisionLoading(false);
    }
  }

  async function loadPatients() {
    setDashboardLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/patients`);

      if (!response.ok) {
        throw new Error("Unable to load patients");
      }

      const data = await response.json();

      const order = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };

      data.sort((a, b) => {
        if (order[b.risk_level] !== order[a.risk_level]) {
          return order[b.risk_level] - order[a.risk_level];
        }

        return b.risk_score - a.risk_score;
      });

      setPatients(data);
    } catch (err) {
      setError("Could not load patients. Make sure FastAPI is running.");
    } finally {
      setDashboardLoading(false);
    }
  }

  function openDashboard() {
    setPage("dashboard");
    setResult(null);
    setDecision(null);
    loadPatients();
  }
async function openPatient(patientId) {
  setError("");

  try {
    const response = await fetch(
      `${API_URL}/patients/${patientId}`
    );

    if (!response.ok) {
      throw new Error("Unable to load patient");
    }

    const data = await response.json();

    // The detail endpoint returns:
    // {
    //   patient_id,
    //   data,
    //   result,
    //   decision,
    //   note
    // }
    //
    // Normalize it into the same structure
    // used by the intake endpoint.

    const patientResult = {
      ...data.result,
      patient_id: data.patient_id,
      patient_data: data.data,
      decision: data.decision,
      note: data.note,
    };

    setResult(patientResult);

    setDecision(
      data.decision && data.decision !== "PENDING"
        ? data.decision
        : null
    );

    // Existing patients are not given a fake
    // live countdown.
    setRemainingSeconds(null);

    setPage("intake");

  } catch (err) {
    console.error(err);
    setError("Could not load the selected patient.");
  }
}



  function openIntake() {
    setPage("intake");
    setResult(null);
    setDecision(null);
    setError("");
    setRemainingSeconds(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <div className="logo">
            PatientTriage<span>.ai</span>
          </div>

          <div className="subtitle">AI-assisted emergency triage</div>
        </div>

        <div className="nav">
          <button
            className={page === "intake" ? "nav-button active" : "nav-button"}
            onClick={openIntake}
          >
            New Patient
          </button>

          <button
            className={
              page === "dashboard" ? "nav-button active" : "nav-button"
            }
            onClick={openDashboard}
          >
            Nurse Dashboard
          </button>

          <div className="status">
            <span className="status-dot"></span>
            SYSTEM ONLINE
          </div>
        </div>
      </header>

      <main className="container">
        {page === "dashboard" ? (
          <Dashboard
              patients={patients}
              loading={dashboardLoading}
              onRefresh={loadPatients}
              onSelectPatient={openPatient}
            />
        ) : !result ? (
          <form onSubmit={assessPatient}>
            <section className="hero">
              <div>
                <p className="eyebrow">PATIENT INTAKE</p>
                <h1>Assess a new patient</h1>
                <p>
                  Enter presenting symptoms and vital signs to generate an
                  explainable AI-assisted triage recommendation.
                </p>
              </div>
            </section>

            <section className="card">
              <h2>Patient information</h2>

              <div className="grid-3">
                <div className="field">
                  <label>Age</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={form.age}
                    onChange={(e) => updateField("age", Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <label>Chief complaint</label>
                  <input
                    type="text"
                    placeholder="e.g. Severe chest pain"
                    value={form.chief_complaint}
                    onChange={(e) =>
                      updateField("chief_complaint", e.target.value)
                    }
                  />
                </div>

                <div className="field">
                  <label>Pain level</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={form.pain_level}
                    onChange={(e) =>
                      updateField("pain_level", Number(e.target.value))
                    }
                  />
                  <small>0 = none · 10 = severe</small>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Vital signs</h2>

              <div className="grid-5">
                <div className="field">
                  <label>Heart rate</label>
                  <div className="input-unit">
                    <input
                      type="number"
                      value={form.heart_rate}
                      onChange={(e) =>
                        updateField("heart_rate", Number(e.target.value))
                      }
                    />
                    <span>bpm</span>
                  </div>
                </div>

                <div className="field">
                  <label>SpO₂</label>
                  <div className="input-unit">
                    <input
                      type="number"
                      value={form.spo2}
                      onChange={(e) =>
                        updateField("spo2", Number(e.target.value))
                      }
                    />
                    <span>%</span>
                  </div>
                </div>

                <div className="field">
                  <label>Systolic BP</label>
                  <div className="input-unit">
                    <input
                      type="number"
                      value={form.systolic_bp}
                      onChange={(e) =>
                        updateField("systolic_bp", Number(e.target.value))
                      }
                    />
                    <span>mmHg</span>
                  </div>
                </div>

                <div className="field">
                  <label>Temperature</label>
                  <div className="input-unit">
                    <input
                      type="number"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) =>
                        updateField("temperature", Number(e.target.value))
                      }
                    />
                    <span>°C</span>
                  </div>
                </div>

                <div className="field">
                  <label>Respiratory rate</label>
                  <div className="input-unit">
                    <input
                      type="number"
                      value={form.respiratory_rate}
                      onChange={(e) =>
                        updateField("respiratory_rate", Number(e.target.value))
                      }
                    />
                    <span>/min</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2>Presenting symptoms</h2>

              <div className="symptoms">
                <button
                  type="button"
                  className={form.chest_pain ? "symptom active" : "symptom"}
                  onClick={() => toggleField("chest_pain")}
                >
                  <span>Chest pain</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={
                    form.shortness_breath ? "symptom active" : "symptom"
                  }
                  onClick={() => toggleField("shortness_breath")}
                >
                  <span>Shortness of breath</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={form.confusion ? "symptom active" : "symptom"}
                  onClick={() => toggleField("confusion")}
                >
                  <span>Confusion</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={form.weakness ? "symptom active" : "symptom"}
                  onClick={() => toggleField("weakness")}
                >
                  <span>Weakness</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={form.speech_problem ? "symptom active" : "symptom"}
                  onClick={() => toggleField("speech_problem")}
                >
                  <span>Speech difficulty</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={
                    form.severe_bleeding ? "symptom active" : "symptom"
                  }
                  onClick={() => toggleField("severe_bleeding")}
                >
                  <span>Severe bleeding</span>
                  <span>+</span>
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Medical history</h2>

              <div className="symptoms">
                <button
                  type="button"
                  className={
                    form.cardiac_history ? "symptom active" : "symptom"
                  }
                  onClick={() => toggleField("cardiac_history")}
                >
                  <span>Cardiac history</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={form.diabetes ? "symptom active" : "symptom"}
                  onClick={() => toggleField("diabetes")}
                >
                  <span>Diabetes</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={form.hypertension ? "symptom active" : "symptom"}
                  onClick={() => toggleField("hypertension")}
                >
                  <span>Hypertension</span>
                  <span>+</span>
                </button>

                <button
                  type="button"
                  className={
                    form.previous_stroke ? "symptom active" : "symptom"
                  }
                  onClick={() => toggleField("previous_stroke")}
                >
                  <span>Previous stroke</span>
                  <span>+</span>
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Patient's own words</h2>

              <textarea
                rows="4"
                placeholder="Describe what the patient is experiencing in their own words..."
                value={form.patient_words}
                onChange={(e) => updateField("patient_words", e.target.value)}
              />
            </section>

            {error && <div className="error">{error}</div>}

            <button className="assess-button" type="submit" disabled={loading}>
              {loading ? "ANALYZING PATIENT..." : "ASSESS PATIENT →"}
            </button>

            <p className="disclaimer">
              Prototype system using synthetic data. AI output is a
              recommendation only and requires clinical review.
            </p>
          </form>
        ) : (
          <section className="result-page">
            <div className="result-header">
              <div>
                <p className="eyebrow">AI TRIAGE RESULT</p>
                <h1>{result.patient_id}</h1>
              </div>

              <div className={`risk-badge ${result.risk_level.toLowerCase()}`}>
                {result.risk_level}
              </div>
            </div>

            <div className="score-card">
              <div className="score-section">
                <div className="score">
                  {result.risk_score}
                  <span>/100</span>
                </div>

                <div className="score-label">AI TRIAGE RISK SCORE</div>
              </div>

              <div className="probability-section">
                <span>MODEL PROBABILITY</span>

                <strong>{(result.risk_probability * 100).toFixed(1)}%</strong>

                <div className="probability-bar">
                  <div
                    style={{
                      width: `${result.risk_probability * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">EXPLAINABLE AI</p>
                  <h2>Why was this patient flagged?</h2>
                </div>

                <span className="factor-count">
                  {result.key_factors.length} factors
                </span>
              </div>

              {result.key_factors.length > 0 ? (
                <div className="factor-list">
                  {result.key_factors.map((factor, index) => (
                    <div className="factor" key={index}>
                      <div className="factor-main">
                        <div
                          className={`factor-indicator ${factor.impact.toLowerCase()}`}
                        />

                        <strong>{factor.factor}</strong>
                      </div>

                      <span className={`impact ${factor.impact.toLowerCase()}`}>
                        {factor.impact} IMPACT
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-factors">
                  No major contributing factors identified.
                </div>
              )}
            </div>

            <div className="recommendation">
              <div className="recommendation-main">
                <p className="eyebrow">RECOMMENDED ACTION</p>

                <h2>{result.recommended_action}</h2>

                <p>
                  AI recommendation based on the patient's presenting symptoms,
                  vital signs and medical history.
                </p>
              </div>

              <div
                className={`reassessment ${
                  remainingSeconds !== null && remainingSeconds <= 60
                    ? "urgent"
                    : ""
                }`}
              >
                <span>REASSESSMENT</span>

              <strong>
                  {remainingSeconds !== null
                    ? formatTime(remainingSeconds)
                    : `${result.reassessment_minutes} min`}
                </strong>

                <small>
                  {remainingSeconds !== null
                    ? "remaining"
                    : "assigned interval"}
                </small>
              </div>
            </div>

            <div className="nurse-warning">
              <div className="warning-icon">!</div>

              <div>
                <strong>Nurse confirmation required</strong>

                <p>
                  AI provides a recommendation. Final clinical prioritization
                  remains with the nurse.
                </p>
              </div>
            </div>

            <div className="actions">
              <button
                className="accept"
                onClick={() => submitDecision("ACCEPT")}
                disabled={decisionLoading || decision}
              >
                {decision === "ACCEPT" ? "✓ ACCEPTED" : "ACCEPT"}
              </button>

              <button
                className="modify"
                onClick={() => submitDecision("MODIFY")}
                disabled={decisionLoading || decision}
              >
                {decision === "MODIFY" ? "✓ MODIFIED" : "MODIFY"}
              </button>

              <button
                className="escalate"
                onClick={() => submitDecision("ESCALATE")}
                disabled={decisionLoading || decision}
              >
                {decision === "ESCALATE" ? "✓ ESCALATED" : "ESCALATE"}
              </button>
            </div>

            {decision && (
              <div className="decision-status">
                Nurse decision recorded:
                <strong>{decision}</strong>
              </div>
            )}

            <button
              className="new-patient"
              onClick={() => {
                setResult(null);
                setDecision(null);
                setError("");
                setRemainingSeconds(null);
              }}
            >
              ← Assess another patient
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Dashboard({ patients, loading, onRefresh, onSelectPatient }) {
  const critical = patients.filter((p) => p.risk_level === "CRITICAL").length;

  const high = patients.filter((p) => p.risk_level === "HIGH").length;

  const medium = patients.filter((p) => p.risk_level === "MEDIUM").length;

  const low = patients.filter((p) => p.risk_level === "LOW").length;

  return (
    <section>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">NURSE WORKSPACE</p>

          <h1>Patient priority queue</h1>

          <p>
            AI-assisted prioritization with nurse-controlled clinical decisions.
          </p>
        </div>

        <button className="refresh-button" onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>

      <div className="stats">
        <div className="stat critical">
          <span>CRITICAL</span>
          <strong>{critical}</strong>
        </div>

        <div className="stat high">
          <span>HIGH</span>
          <strong>{high}</strong>
        </div>

        <div className="stat medium">
          <span>MEDIUM</span>
          <strong>{medium}</strong>
        </div>

        <div className="stat low">
          <span>LOW</span>
          <strong>{low}</strong>
        </div>
      </div>

      <div className="card">
        <div className="queue-header">
          <div>
            <h2>Priority queue</h2>

            <p>Patients are ordered by AI-assessed risk.</p>
          </div>

          <span className="patient-count">{patients.length} patients</span>
        </div>

        {loading ? (
          <div className="empty">Loading patient queue...</div>
        ) : patients.length === 0 ? (
          <div className="empty">No patients in the queue.</div>
        ) : (
          <div className="patient-table">
            <div className="table-row table-head">
              <span>Patient</span>
              <span>Risk</span>
              <span>Score</span>
              <span>Reassessment</span>
              <span>Decision</span>
              <span></span>
            </div>

            {patients.map((patient) => (
              <div className="table-row" key={patient.patient_id}>
                <span className="patient-id">{patient.patient_id}</span>

                <span>
                  <span
                    className={`table-risk ${patient.risk_level.toLowerCase()}`}
                  >
                    {patient.risk_level}
                  </span>
                </span>

                <span className="score-value">{patient.risk_score}</span>

                <span>{patient.reassessment_minutes} min</span>

                <span>
                  <span
                    className={`decision ${patient.decision.toLowerCase()}`}
                  >
                    {patient.decision}
                  </span>
                </span>

                <button
                    className="view-button"
                    onClick={() => onSelectPatient(patient.patient_id)}
                  >
                    View
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="disclaimer">
        Prototype system using synthetic data. AI output is a recommendation
        only and requires clinical review.
      </p>
    </section>
  );
}

export default App;
