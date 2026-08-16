"""
db/database.py

Minimal SQLite persistence for NeuroPulse AI — users, Brainprint profiles,
and chat messages.  Deliberately plain ``sqlite3`` rather than an ORM since
the schema is small and the goal is "writes are queryable by the very next
request" with no extra moving parts (no migration tool, no connection pool
to misconfigure).

Every function opens and closes its own connection — SQLite handles that
cheaply, and it avoids sharing a connection across FastAPI's async request
handlers, which is the usual source of "database is locked" bugs with sqlite3.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/brainprint.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brainprint_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    nickname TEXT NOT NULL,
    embedding TEXT NOT NULL,
    notes TEXT,
    sessions_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    eeg_snapshot TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
"""


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Creates all tables if they don't already exist. Safe to call on every app startup.

    Also handles schema migrations — adds columns that may have been missing
    from older database files (e.g. ``user_id`` on ``brainprint_profiles``).
    """
    with get_connection() as conn:
        conn.executescript(SCHEMA)

        # --- Post-init migrations ---
        # Check whether brainprint_profiles has user_id (added in a later schema revision).
        # If the column is missing, add it and re-insert existing rows (which had no user_id).
        try:
            conn.execute("SELECT user_id FROM brainprint_profiles LIMIT 0")
        except sqlite3.OperationalError:
            # Column doesn't exist — migrate: add user_id INTEGER NOT NULL DEFAULT 1
            logger = logging.getLogger("neuropulse.db")
            logger.info("brainprint_profiles missing user_id column — migrating")
            # 1. Get existing rows
            old_rows = conn.execute(
                "SELECT id, nickname, embedding, notes, sessions_count, created_at "
                "FROM brainprint_profiles"
            ).fetchall()
            # 2. Drop and recreate with user_id
            conn.execute("DROP TABLE brainprint_profiles")
            conn.executescript("""
                CREATE TABLE brainprint_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL DEFAULT 1,
                    nickname TEXT NOT NULL,
                    embedding TEXT NOT NULL,
                    notes TEXT,
                    sessions_count INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );
            """)
            # 3. Re-insert old rows with user_id=1 (single-user prototype)
            for row in old_rows:
                conn.execute(
                    "INSERT INTO brainprint_profiles "
                    "(id, user_id, nickname, embedding, notes, sessions_count, created_at) "
                    "VALUES (?, 1, ?, ?, ?, ?, ?)",
                    (*row,),
                )
            logger.info("brainprint_profiles migration complete — user_id column added")


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def create_user(email: str, password_hash: str, nickname: str) -> Dict:
    """Insert a new user and return the row dict (without the password hash)."""
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO users (email, password_hash, nickname, created_at) VALUES (?, ?, ?, ?)",
            (email, password_hash, nickname, created_at),
        )
        user_id = cursor.lastrowid
    return {"id": user_id, "email": email, "nickname": nickname, "created_at": created_at}


def find_user_by_email(email: str) -> Optional[Dict]:
    """Return the full user row (including password_hash) or None."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, email, password_hash, nickname, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    if row is None:
        return None
    return dict(row)


def find_user_by_id(user_id: int) -> Optional[Dict]:
    """Return the user dict without the password hash, or None."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, email, nickname, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    if row is None:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# Brainprint profiles (per-user)
# ---------------------------------------------------------------------------


def insert_profile(
    user_id: int, nickname: str, embedding: List[float], notes: Optional[str] = None
) -> Dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO brainprint_profiles (user_id, nickname, embedding, notes, sessions_count, created_at) "
            "VALUES (?, ?, ?, ?, 1, ?)",
            (user_id, nickname, json.dumps(embedding), notes, created_at),
        )
        profile_id = cursor.lastrowid
    return {"id": profile_id, "user_id": user_id, "nickname": nickname, "notes": notes, "created_at": created_at}


def get_all_profiles(user_id: int) -> List[Dict]:
    """Return every enrolled profile belonging to *user_id* with embedding decoded."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, nickname, embedding, notes, sessions_count, created_at "
            "FROM brainprint_profiles WHERE user_id = ?",
            (user_id,),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "nickname": row["nickname"],
            "embedding": json.loads(row["embedding"]),
            "notes": row["notes"],
            "sessions_count": row["sessions_count"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def increment_session_count(profile_id: int) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE brainprint_profiles SET sessions_count = sessions_count + 1 WHERE id = ?",
            (profile_id,),
        )


# ---------------------------------------------------------------------------
# Chat messages (per-user)
# ---------------------------------------------------------------------------


def save_chat_message(
    user_id: int,
    role: str,
    content: str,
    eeg_snapshot: Optional[Dict] = None,
) -> Dict:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, eeg_snapshot, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, role, content, json.dumps(eeg_snapshot) if eeg_snapshot else None, created_at),
        )
        msg_id = cursor.lastrowid
    return {"id": msg_id, "user_id": user_id, "role": role, "content": content, "created_at": created_at}


def get_chat_history(user_id: int, limit: int = 50) -> List[Dict]:
    """Return the last *limit* messages for *user_id*, ordered oldest-first."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, user_id, role, content, eeg_snapshot, created_at "
            "FROM chat_messages WHERE user_id = ? "
            "ORDER BY created_at ASC LIMIT ?",
            (user_id, limit),
        ).fetchall()

    return [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "role": row["role"],
            "content": row["content"],
            "eeg_snapshot": json.loads(row["eeg_snapshot"]) if row["eeg_snapshot"] else None,
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def get_recent_messages(user_id: int, limit: int = 50) -> List[Dict]:
    """Return the last *limit* messages for context-building (oldest-first)."""
    return get_chat_history(user_id, limit)
