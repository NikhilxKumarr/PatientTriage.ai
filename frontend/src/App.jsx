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
  const [decisionHistory, setDecisionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
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

      setResult({
        ...data,
        patient_data: form,
      });

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
      const historyResponse = await fetch(
        `${API_URL}/patients/${result.patient_id}/decision-history`,
      );

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();

        setDecisionHistory(historyData.history || []);
      }

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
      const response = await fetch(`${API_URL}/queue`);

      if (!response.ok) {
        throw new Error("Unable to load patient queue");
      }

      const data = await response.json();

      setPatients(data.patients || []);
    } catch (err) {
      console.error(err);
      setError("Could not load patient queue. Make sure FastAPI is running.");
    } finally {
      setDashboardLoading(false);
    }
  }

 async function handleReassess(patientId) {
  try {
    setError("");

    const response = await fetch(
      `${API_URL}/patients/${patientId}/reassess`,
      {
        method: "POST",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to reassess patient");
    }

    const data = await response.json();

    // Refresh the queue so the new reassessment time
    // and WAITING status appear immediately.
    await loadPatients();

  } catch (error) {
    console.error("Reassessment failed:", error);
    setError("Failed to reassess patient.");
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
    setHistoryLoading(true);
    setDecisionHistory([]);

    try {
      const [patientResponse, historyResponse] = await Promise.all([
        fetch(`${API_URL}/patients/${patientId}`),
        fetch(`${API_URL}/patients/${patientId}/decision-history`),
      ]);

      if (!patientResponse.ok) {
        throw new Error("Unable to load patient");
      }

      if (!historyResponse.ok) {
        throw new Error("Unable to load decision history");
      }

      const data = await patientResponse.json();
      const historyData = await historyResponse.json();

      const patientResult = {
        ...data.result,
        patient_id: data.patient_id,
        patient_data: data.data,
        decision: data.decision,
        note: data.note,
      };

      setResult(patientResult);

      setDecision(
        data.decision && data.decision !== "PENDING" ? data.decision : null,
      );

      setDecisionHistory(historyData.history || []);

      // Existing patients are not given a fake live countdown.
      setRemainingSeconds(null);

      setPage("intake");
    } catch (err) {
      console.error(err);
      setError("Could not load the selected patient.");
      setDecisionHistory([]);
    } finally {
      setHistoryLoading(false);
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
              {/* Score */}
              <div className="score-section">
                <div className="score">
                  {result.risk_score}
                  <span>/100</span>
                </div>

                <div className="score-label">AI TRIAGE RISK SCORE</div>
              </div>

              {/* Probability */}
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

              {/* Confidence */}
              {result.confidence && (
                <div
                  className={`confidence-section ${result.confidence.toLowerCase()}`}
                >
                  <span>MODEL CONFIDENCE</span>

                  <strong>{result.confidence}</strong>

                  <small>
                    {result.uncertainty === "HIGH"
                      ? "High uncertainty — clinical review required"
                      : result.uncertainty === "MEDIUM"
                        ? "Moderate uncertainty — review recommended"
                        : "Low uncertainty"}
                  </small>
                </div>
              )}
            </div>

            {/* Safety panel OUTSIDE score-card */}
            {(result.safety_flags?.length > 0 ||
              result.age_safety?.risk_adjustment === "REVIEW_REQUIRED") && (
              <div className="safety-panel">
                <div className="safety-panel-heading">
                  <div className="safety-icon">!</div>

                  <div>
                    <p className="eyebrow">SAFETY REVIEW</p>
                    <h3>Additional clinical review recommended</h3>
                  </div>
                </div>

                {result.age_safety?.reasons?.length > 0 && (
                  <div className="safety-block">
                    <span className="safety-label">
                      {result.age_group} SAFETY CONSIDERATIONS
                    </span>

                    <ul>
                      {result.age_safety.reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.safety_flags?.length > 0 && (
                  <div className="safety-block">
                    <span className="safety-label">SAFETY FLAGS</span>

                    <ul>
                      {result.safety_flags.map((flag, index) => (
                        <li key={index}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.patient_data && (
              <div className="card patient-detail-card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">PATIENT DETAILS</p>
                    <h2>Clinical snapshot</h2>
                  </div>
                </div>

                <div className="patient-vitals">
                  <div className="vital">
                    <span>AGE</span>
                    <strong>{result.patient_data.age}</strong>
                    <small>years</small>
                  </div>

                  <div className="vital">
                    <span>HEART RATE</span>
                    <strong>{result.patient_data.heart_rate}</strong>
                    <small>bpm</small>
                  </div>

                  <div className="vital">
                    <span>SpO₂</span>
                    <strong>{result.patient_data.spo2}%</strong>
                    <small>oxygen saturation</small>
                  </div>

                  <div className="vital">
                    <span>BLOOD PRESSURE</span>
                    <strong>{result.patient_data.systolic_bp}</strong>
                    <small>mmHg systolic</small>
                  </div>

                  <div className="vital">
                    <span>TEMPERATURE</span>
                    <strong>{result.patient_data.temperature}°</strong>
                    <small>Celsius</small>
                  </div>

                  <div className="vital">
                    <span>RESPIRATORY RATE</span>
                    <strong>{result.patient_data.respiratory_rate}</strong>
                    <small>breaths/min</small>
                  </div>

                  <div className="vital">
                    <span>PAIN LEVEL</span>
                    <strong>{result.patient_data.pain_level}/10</strong>
                    <small>reported pain</small>
                  </div>
                </div>

                <div className="patient-context">
                  <div className="context-block">
                    <p className="context-label">CHIEF COMPLAINT</p>
                    <strong>
                      {result.patient_data.chief_complaint || "Not provided"}
                    </strong>
                  </div>

                  <div className="context-block">
                    <p className="context-label">PATIENT'S OWN WORDS</p>
                    <p className="patient-words">
                      "{result.patient_data.patient_words || "Not provided"}"
                    </p>
                  </div>
                </div>

                <div className="history-section">
                  <p className="context-label">MEDICAL HISTORY</p>

                  <div className="history-list">
                    <span
                      className={
                        result.patient_data.cardiac_history
                          ? "history active"
                          : "history"
                      }
                    >
                      {result.patient_data.cardiac_history ? "✓" : "○"} Cardiac
                      history
                    </span>

                    <span
                      className={
                        result.patient_data.diabetes
                          ? "history active"
                          : "history"
                      }
                    >
                      {result.patient_data.diabetes ? "✓" : "○"} Diabetes
                    </span>

                    <span
                      className={
                        result.patient_data.hypertension
                          ? "history active"
                          : "history"
                      }
                    >
                      {result.patient_data.hypertension ? "✓" : "○"}{" "}
                      Hypertension
                    </span>

                    <span
                      className={
                        result.patient_data.previous_stroke
                          ? "history active"
                          : "history"
                      }
                    >
                      {result.patient_data.previous_stroke ? "✓" : "○"} Previous
                      stroke
                    </span>
                  </div>
                </div>
              </div>
            )}

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

                        <div>
                          <strong>{factor.factor}</strong>

                          {factor.detail && (
                            <p className="factor-detail">{factor.detail}</p>
                          )}
                        </div>
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


            {/* ----------------------------------------- */}
{/* DECISION AUDIT HISTORY */}
{/* ----------------------------------------- */}

<div className="decision-history">
  <div className="decision-history-header">
    <div>
      <p className="eyebrow">CLINICAL AUDIT TRAIL</p>

      <h3>Decision history</h3>

      <p>
        Previous nurse decisions recorded for this patient.
      </p>
    </div>

    <span className="history-count">
      {decisionHistory.length}{" "}
      {decisionHistory.length === 1 ? "decision" : "decisions"}
    </span>
  </div>

  {historyLoading ? (
    <div className="history-empty">
      Loading decision history...
    </div>
  ) : decisionHistory.length === 0 ? (
    <div className="history-empty">
      <strong>No previous decisions</strong>
      <span>
        No nurse decision has been recorded for this patient yet.
      </span>
    </div>
  ) : (
    <div className="history-list">
      {decisionHistory.map((item) => (
        <div
          className="history-item"
          key={item.id}
        >
          <div className="history-item-top">
            <span
              className={`history-decision ${
                item.decision
                  ? item.decision.toLowerCase()
                  : ""
              }`}
            >
              {item.decision}
            </span>

            <span className="history-time">
              {item.timestamp
                ? new Date(item.timestamp).toLocaleString()
                : "Unknown time"}
            </span>
          </div>

          <div className="history-risk">
            <span>
              AI Risk:
              <strong>{item.risk_level}</strong>
            </span>

            <span>
              Score:
              <strong>{item.risk_score}</strong>
            </span>

            <span>
              Probability:
              <strong>
                {item.risk_probability !== undefined
                  ? `${Math.round(
                      item.risk_probability * 100
                    )}%`
                  : "N/A"}
              </strong>
            </span>
          </div>

          {item.note && (
            <div className="history-note">
              <span>NOTE</span>
              <p>{item.note}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>

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
  const [filter, setFilter] = useState("ALL");

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function getRemainingSeconds(patient) {
    if (!patient.reassessment_due_at) {
      return null;
    }

    const dueTime = new Date(patient.reassessment_due_at).getTime();

    return Math.max(0, Math.floor((dueTime - currentTime) / 1000));
  }

  function formatQueueTime(seconds) {
    if (seconds === null) {
      return "--:--";
    }

    if (seconds <= 0) {
      return "DUE";
    }

    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(
      2,
      "0",
    )}`;
  }

  const critical = patients.filter((p) => p.risk_level === "CRITICAL").length;

  const high = patients.filter((p) => p.risk_level === "HIGH").length;

  const medium = patients.filter((p) => p.risk_level === "MEDIUM").length;

  const low = patients.filter((p) => p.risk_level === "LOW").length;

  const pending = patients.filter((p) => p.decision === "PENDING").length;

  const highUncertainty = patients.filter(
    (p) => p.uncertainty === "HIGH",
  ).length;

  const reassessmentDue = patients.filter(
    (p) => p.queue_status === "REASSESSMENT_DUE",
  ).length;

  const isSurge = patients.length >= 40;

  const highRisk = critical + high;

  const highRiskPercent =
    patients.length > 0 ? Math.round((highRisk / patients.length) * 100) : 0;

  const pendingPercent =
    patients.length > 0 ? Math.round((pending / patients.length) * 100) : 0;

  const reassessmentPercent =
    patients.length > 0
      ? Math.round((reassessmentDue / patients.length) * 100)
      : 0;

  const uncertaintyPercent =
    patients.length > 0
      ? Math.round((highUncertainty / patients.length) * 100)
      : 0;

  const filteredPatients = patients.filter((patient) => {
    if (filter === "ALL") {
      return true;
    }

    if (filter === "PENDING") {
      return patient.decision === "PENDING";
    }

    if (filter === "UNCERTAIN") {
      return patient.uncertainty === "HIGH";
    }

    if (filter === "REASSESSMENT") {
      return patient.queue_status === "REASSESSMENT_DUE";
    }

    return patient.risk_level === filter;
  });

 return (
  <section>
    {/* ----------------------------------------- */}
    {/* DASHBOARD HEADER */}
    {/* ----------------------------------------- */}

    <div className="dashboard-heading">
      <div>
        <p className="eyebrow">NURSE WORKSPACE</p>

        <h1>Patient priority queue</h1>

        <p>
          AI-assisted prioritization with nurse-controlled clinical decisions.
        </p>
      </div>

      <div className="dashboard-actions">
        <div className={`queue-mode ${isSurge ? "surge" : "normal"}`}>
          <span className="queue-mode-dot"></span>
          {isSurge ? "SURGE MODE" : "NORMAL LOAD"}
        </div>

        <button
          className="refresh-button"
          onClick={onRefresh}
        >
          ↻ Refresh
        </button>
      </div>
    </div>

    {/* ----------------------------------------- */}
    {/* SURGE ALERT */}
    {/* ----------------------------------------- */}

    {isSurge && (
      <div className="surge-alert">
        <div className="surge-alert-icon">!</div>

        <div>
          <strong>Emergency department surge detected</strong>

          <p>
            Patient volume is approximately 3× normal. Queue prioritization is
            active and high-risk patients remain ahead of lower-risk cases.
          </p>
        </div>
      </div>
    )}

    {/* ----------------------------------------- */}
    {/* QUEUE STATISTICS */}
    {/* ----------------------------------------- */}

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

      <div className="stat pending">
        <span>PENDING REVIEW</span>
        <strong>{pending}</strong>
      </div>
    </div>

    {/* ----------------------------------------- */}
    {/* SAFETY MONITORING */}
    {/* ----------------------------------------- */}

    <div className="queue-safety-summary">
      <div>
        <span>HIGH UNCERTAINTY</span>
        <strong>{highUncertainty}</strong>
      </div>

      <div>
        <span>REASSESSMENT DUE</span>
        <strong>{reassessmentDue}</strong>
      </div>

      <div>
        <span>TOTAL WAITING</span>
        <strong>{patients.length}</strong>
      </div>
    </div>

    {/* ----------------------------------------- */}
    {/* QUEUE HEALTH */}
    {/* ----------------------------------------- */}

    <div className="queue-health">
      <div className="queue-health-header">
        <div>
          <p className="eyebrow">OPERATIONAL OVERVIEW</p>
          <h2>Queue health</h2>
        </div>

        <span
          className={`health-status ${
            isSurge ? "danger" : "stable"
          }`}
        >
          {isSurge ? "HIGH LOAD" : "STABLE"}
        </span>
      </div>

      <div className="queue-health-grid">
        <div className="health-metric">
          <span>HIGH-RISK PATIENTS</span>

          <strong>{highRiskPercent}%</strong>

          <small>
            {highRisk} of {patients.length} patients
          </small>

          <div className="health-bar">
            <div
              style={{
                width: `${highRiskPercent}%`,
              }}
            />
          </div>
        </div>

        <div className="health-metric">
          <span>PENDING REVIEW</span>

          <strong>{pendingPercent}%</strong>

          <small>{pending} patients</small>

          <div className="health-bar">
            <div
              style={{
                width: `${pendingPercent}%`,
              }}
            />
          </div>
        </div>

        <div className="health-metric">
          <span>REASSESSMENT DUE</span>

          <strong>{reassessmentPercent}%</strong>

          <small>{reassessmentDue} patients</small>

          <div className="health-bar">
            <div
              style={{
                width: `${reassessmentPercent}%`,
              }}
            />
          </div>
        </div>

        <div className="health-metric">
          <span>HIGH UNCERTAINTY</span>

          <strong>{uncertaintyPercent}%</strong>

          <small>{highUncertainty} patients</small>

          <div className="health-bar">
            <div
              style={{
                width: `${uncertaintyPercent}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>

    {/* ----------------------------------------- */}
    {/* PRIORITY QUEUE */}
    {/* ----------------------------------------- */}

    <div className="card">
      <div className="queue-header">
        <div>
          <p className="eyebrow">LIVE TRIAGE QUEUE</p>

          <h2>Priority queue</h2>

          <p>
            Highest-risk patients appear first. Uncertain and
            reassessment-due patients require additional clinical attention.
          </p>
        </div>

        <span className="patient-count">
          {filteredPatients.length} patients
        </span>
      </div>

      {/* ----------------------------------------- */}
      {/* FILTERS */}
      {/* ----------------------------------------- */}

      <div className="queue-filters">
        {[
          "ALL",
          "CRITICAL",
          "HIGH",
          "MEDIUM",
          "LOW",
          "PENDING",
          "UNCERTAIN",
          "REASSESSMENT",
        ].map((item) => (
          <button
            key={item}
            className={`filter-button ${
              filter === item ? "active" : ""
            }`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {/* ----------------------------------------- */}
      {/* TABLE */}
      {/* ----------------------------------------- */}

      {loading ? (
        <div className="empty">
          Loading patient queue...
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="empty">
          No patients match this filter.
        </div>
      ) : (
        <div className="patient-table">

          {/* TABLE HEADER */}

          <div className="table-row table-head">
            <span>Patient</span>
            <span>Risk</span>
            <span>Score</span>
            <span>Confidence</span>
            <span>Reassessment</span>
            <span>Decision</span>
            <span>Actions</span>
          </div>

          {/* PATIENT ROWS */}

          {filteredPatients.map((patient) => {
            const remaining = getRemainingSeconds(patient);

            const reassessmentDue =
              patient.queue_status === "REASSESSMENT_DUE" ||
              remaining === 0;

            return (
              <div
                className={`table-row ${
                  patient.decision === "PENDING"
                    ? "pending-row"
                    : ""
                } ${
                  reassessmentDue
                    ? "reassessment-row"
                    : ""
                }`}
                key={patient.patient_id}
              >

                {/* ----------------------------------------- */}
                {/* PATIENT */}
                {/* ----------------------------------------- */}

                <span className="patient-id">

                  <span className="queue-position">
                    #
                    {String(
                      patients.findIndex(
                        (p) =>
                          p.patient_id ===
                          patient.patient_id
                      ) + 1
                    ).padStart(2, "0")}
                  </span>

                  <span className="patient-id-text">
                    {patient.patient_id}
                  </span>

                  {patient.is_demo && (
                    <small className="demo-label">
                      DEMO
                    </small>
                  )}

                </span>

                {/* ----------------------------------------- */}
                {/* RISK */}
                {/* ----------------------------------------- */}

                <span>
                  <span
                    className={`table-risk ${
                      patient.risk_level.toLowerCase()
                    }`}
                  >
                    {patient.risk_level}
                  </span>
                </span>

                {/* ----------------------------------------- */}
                {/* SCORE */}
                {/* ----------------------------------------- */}

                <span className="score-value">
                  {patient.risk_score}
                </span>

                {/* ----------------------------------------- */}
                {/* CONFIDENCE */}
                {/* ----------------------------------------- */}

                <span>
                  <span
                    className={`confidence-mini ${
                      patient.confidence
                        ? patient.confidence.toLowerCase()
                        : ""
                    }`}
                  >
                    {patient.confidence || "N/A"}
                  </span>
                </span>

                {/* ----------------------------------------- */}
                {/* REASSESSMENT */}
                {/* ----------------------------------------- */}

                <span>
                  {reassessmentDue ? (
                    <span className="reassessment-due">
                      ⚠ DUE
                    </span>
                  ) : (
                    <span
                      className={`queue-countdown ${
                        remaining !== null &&
                        remaining <= 60
                          ? "urgent"
                          : ""
                      }`}
                    >
                      {formatQueueTime(remaining)}
                    </span>
                  )}
                </span>

                {/* ----------------------------------------- */}
                {/* DECISION */}
                {/* ----------------------------------------- */}

                <span>
                  <span
                    className={`decision ${
                      patient.decision
                        ? patient.decision.toLowerCase()
                        : ""
                    }`}
                  >
                    {patient.decision === "PENDING"
                      ? "⚠ PENDING REVIEW"
                      : patient.decision}
                  </span>
                </span>

                {/* ----------------------------------------- */}
                {/* ACTIONS */}
                {/* ----------------------------------------- */}

                <div className="queue-actions">

                  {reassessmentDue && (
                    <button
                      className="reassess-button"
                      onClick={() =>
                        handleReassess(
                          patient.patient_id
                        )
                      }
                    >
                      ↻ Reassess
                    </button>
                  )}

                  <button
                    className="view-button"
                    onClick={() =>
                      onSelectPatient(
                        patient.patient_id
                      )
                    }
                  >
                    View
                  </button>

                </div>

              </div>
            );
          })}

        </div>
      )}
    </div>

    {/* ----------------------------------------- */}
    {/* SAFETY NOTE */}
    {/* ----------------------------------------- */}

    <div className="nurse-warning">
      <div className="warning-icon">!</div>

      <div>
        <strong>Clinical oversight required</strong>

        <p>
          AI recommendations are advisory. Nurses can review,
          modify, or escalate every triage recommendation.
        </p>
      </div>
    </div>

    <p className="disclaimer">
      Prototype system using synthetic data. AI output is a
      recommendation only and requires clinical review.
    </p>

  </section>
);
}

export default App;
