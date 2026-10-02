import os
import sqlite3
from typing import List, Dict, Any, Optional
from config import DB_PATH

def get_connection() -> sqlite3.Connection:
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = WAL;")
        return conn
    except sqlite3.DatabaseError as e:
        if "malformed" in str(e).lower() and os.path.exists(DB_PATH):
            print(f"[Database Warning] Corrupted database detected: {e}. Rebuilding...")
            try:
                os.remove(DB_PATH)
                for ext in ["-wal", "-shm"]:
                    if os.path.exists(f"{DB_PATH}{ext}"):
                        os.remove(f"{DB_PATH}{ext}")
            except Exception:
                pass
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode = WAL;")
            return conn
        raise

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
        for item in ["red", "yellow", "green", "lamp"]:
            cursor.execute("SELECT value FROM settings WHERE key = ?", (f"led_{item}_state",))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO settings (key, value) VALUES (?, 'OFF')", (f"led_{item}_state",))
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

# --- LOGS CRUD ---
def add_log(log_type: str, message: str) -> None:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO logs (type, message) VALUES (?, ?)", (log_type, message))
            conn.commit()
    except Exception as e:
        print(f"Failed to add log: {e}")

def get_logs(limit: int = 50) -> List[Dict[str, Any]]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, type, message, created_at FROM logs ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"Failed to fetch logs: {e}")
        return []

def get_recent_logs(limit: int = 15) -> List[Dict[str, Any]]:
    return get_logs(limit=limit)

def get_db_stats() -> Dict[str, Any]:
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM logs")
            row_logs = cursor.fetchone()
            total_logs = row_logs["count"] if row_logs else 0

            cursor.execute("SELECT COUNT(*) as count FROM settings")
            row_settings = cursor.fetchone()
            total_settings = row_settings["count"] if row_settings else 0

            return {
                "total_logs": total_logs,
                "total_settings": total_settings,
                "status": "healthy",
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}
