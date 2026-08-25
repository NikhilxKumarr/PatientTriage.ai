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
            note TEXT DEFAULT '',
            is_demo INTEGER DEFAULT 0,
            arrival_time TEXT,
            reassessment_due_at TEXT,
            queue_status TEXT DEFAULT 'WAITING',
            last_reassessment TEXT
        )
    """)

    columns = [
        row["name"]
        for row in conn.execute(
            "PRAGMA table_info(patients)"
        ).fetchall()
    ]

    migrations = {
        "is_demo": "ALTER TABLE patients ADD COLUMN is_demo INTEGER DEFAULT 0",
        "arrival_time": "ALTER TABLE patients ADD COLUMN arrival_time TEXT",
        "reassessment_due_at": (
            "ALTER TABLE patients ADD COLUMN reassessment_due_at TEXT"
        ),
        "queue_status": (
            "ALTER TABLE patients ADD COLUMN queue_status TEXT DEFAULT 'WAITING'"
        ),
        "last_reassessment": (
            "ALTER TABLE patients ADD COLUMN last_reassessment TEXT"
        ),
    }

    for column, sql in migrations.items():
        if column not in columns:
            conn.execute(sql)

    conn.commit()
    conn.close()

def save_patient(
    patient_id,
    data,
    result,
    is_demo=False,
    arrival_time=None,
    reassessment_due_at=None,
    queue_status="WAITING"
):
    conn = get_connection()

    conn.execute(
        """
        INSERT INTO patients
        (
            id,
            data,
            result,
            is_demo,
            arrival_time,
            reassessment_due_at,
            queue_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            json.dumps(data),
            json.dumps(result),
            1 if is_demo else 0,
            arrival_time,
            reassessment_due_at,
            queue_status
        )
    )

    conn.commit()
    conn.close()


def get_patients():
    conn = get_connection()

    rows = conn.execute(
        "SELECT * FROM patients ORDER BY rowid DESC"
    ).fetchall()

    conn.close()

    patients = []

    for row in rows:
        result = json.loads(row["result"])

        patients.append({
            "patient_id": row["id"],
            **result,
            "decision": row["decision"],
            "note": row["note"],
            "is_demo": bool(row["is_demo"])
        })

    return patients


def get_demo_patients():
    conn = get_connection()

    rows = conn.execute(
        """
        SELECT * FROM patients
        WHERE is_demo = 1
        ORDER BY rowid DESC
        """
    ).fetchall()

    conn.close()

    patients = []

    for row in rows:
        result = json.loads(row["result"])

        patients.append({
            "patient_id": row["id"],
            **result,
            "decision": row["decision"],
            "note": row["note"],
            "is_demo": True
        })

    return patients

def get_queue_patients():
    conn = get_connection()

    rows = conn.execute(
        """
        SELECT * FROM patients
        ORDER BY rowid ASC
        """
    ).fetchall()

    conn.close()

    patients = []

    for row in rows:
        result = json.loads(row["result"])

        patients.append({
            "patient_id": row["id"],
            **result,
            "decision": row["decision"],
            "note": row["note"],
            "is_demo": bool(row["is_demo"])
        })

    return patients




def clear_demo_patients():
    conn = get_connection()

    cursor = conn.execute(
        "DELETE FROM patients WHERE is_demo = 1"
    )

    deleted = cursor.rowcount

    conn.commit()
    conn.close()

    return deleted


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
        "note": row["note"],
        "is_demo": bool(row["is_demo"])
    }


def update_decision(patient_id, decision, note):
    conn = get_connection()

    conn.execute(
        """
        UPDATE patients
        SET decision = ?, note = ?
        WHERE id = ?
        """,
        (
            decision,
            note,
            patient_id
        )
    )

    conn.commit()
    conn.close()