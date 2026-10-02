import sqlite3
from typing import List, Dict, Any, Optional
from config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db() -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Initialize default LED states if not set
        for color in ["red", "yellow", "green"]:
            cursor.execute("SELECT value FROM settings WHERE key = ?", (f"led_{color}_state",))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO settings (key, value) VALUES (?, 'OFF')", (f"led_{color}_state",))
        conn.commit()

# Run init immediately on import
try:
    init_db()
except Exception as e:
    print("Database init error:", e)

# --- SETTINGS CRUD ---
def get_setting(key: str, default_value: str = "") -> str:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default_value

def set_setting(key: str, value: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = CURRENT_TIMESTAMP
        """, (key, value))
        conn.commit()

# --- LOGS & STATS ---
def add_log(log_type: str, message: str) -> None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO logs (type, message) VALUES (?, ?)", (log_type, message))
        conn.commit()

def get_logs(limit: int = 50) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def get_db_stats() -> Dict[str, Any]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM logs")
        log_count = cursor.fetchone()["cnt"]

        states = {}
        for color in ["red", "yellow", "green"]:
            cursor.execute("SELECT value FROM settings WHERE key = ?", (f"led_{color}_state",))
            row = cursor.fetchone()
            states[color] = row["value"] if row else "OFF"

        return {
            "states": states,
            "logsTotal": log_count,
            "backend": "FastAPI (Python)",
            "status": "Healthy",
        }
