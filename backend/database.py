import sqlite3
import json
import os


DB_PATH = os.path.join(
    os.path.dirname(__file__),
    "patients.db"
)


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            result TEXT NOT NULL,
            decision TEXT DEFAULT 'PENDING',
            note TEXT DEFAULT ''
        )
    """)

    conn.commit()
    conn.close()


def save_patient(patient_id, data, result):
    conn = get_connection()

    conn.execute(
        """
        INSERT INTO patients
        (id, data, result)
        VALUES (?, ?, ?)
        """,
        (
            patient_id,
            json.dumps(data),
            json.dumps(result)
        )
    )

    conn.commit()
    conn.close()


def get_patients():
    conn = get_connection()

    rows = conn.execute(
        "SELECT * FROM patients"
    ).fetchall()

    conn.close()

    patients = []

    for row in rows:
        result = json.loads(row["result"])

        patients.append({
            "patient_id": row["id"],
            **result,
            "decision": row["decision"],
            "note": row["note"]
        })

    return patients


def get_patient(patient_id):
    conn = get_connection()

    row = conn.execute(
        "SELECT * FROM patients WHERE id = ?",
        (patient_id,)
    ).fetchone()

    conn.close()

    if row is None:
        return None

    return {
        "patient_id": row["id"],
        "data": json.loads(row["data"]),
        "result": json.loads(row["result"]),
        "decision": row["decision"],
        "note": row["note"]
    }


def update_decision(patient_id, decision, note):
    conn = get_connection()

    conn.execute(
        """
        UPDATE patients
        SET decision = ?, note = ?
        WHERE id = ?
        """,
        (decision, note, patient_id)
    )

    conn.commit()
    conn.close()
