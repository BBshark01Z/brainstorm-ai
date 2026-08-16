"""
import_reference_data.py

Populate eeg_reference_data from Phase 2/3 computed results.

Run:
    python -m neuropulse-backend.db.import_reference_data [--dry-run]

This script is intentionally separate from database.py to keep the
core DB module untouched. It opens its own connection (per the
project's pattern of one-connection-per-function to avoid SQLite
"database is locked" errors).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("neuropulse.import_reference")

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/brainprint.db")

# The migration SQL (must match Phase 4 RESULTS.md exactly)
MIGRATION_SQL = """
CREATE TABLE IF NOT EXISTS eeg_reference_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_name    TEXT    NOT NULL DEFAULT 'Sleep-EDF Database Expanded',
    source_url      TEXT,
    subject_id      TEXT    NOT NULL,
    epoch_index     INTEGER NOT NULL,
    epoch_start_sec REAL    NOT NULL,
    epoch_end_sec   REAL    NOT NULL,
    sleep_stage     TEXT    NOT NULL CHECK(sleep_stage IN ('W', 'N1', 'N2', 'N3', 'REM')),
    delta_power     REAL,
    theta_power     REAL,
    alpha_power     REAL,
    beta_power      REAL,
    gamma_power     REAL,
    channel_name    TEXT    NOT NULL CHECK(channel_name IN ('Fpz-Cz', 'Pz-Oz')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(subject_id, channel_name, epoch_index)
);

CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_channel
    ON eeg_reference_data(subject_id, channel_name);

CREATE INDEX IF NOT EXISTS idx_eeg_ref_stage
    ON eeg_reference_data(sleep_stage);

CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_time
    ON eeg_reference_data(subject_id, epoch_start_sec);
"""

# R&K-to-AASM sleep stage mapping (Phase 3)
R2A_STAGE_MAP: Dict[str, str] = {
    "1": "N1",
    "2": "N2",
    "3": "N3",   # R&K Stage 3 → AASM N3
    "4": "N3",   # R&K Stage 4 → AASM N3 (merged)
    "R": "REM",
    "W": "W",
    "?": None,   # Unscores → skip
}

# Source URLs for provenance tracking
DATASET_URLS = {
    "SC4001": "https://physionet.org/content/sleep-edfx/1.0.0/",
    "SC4011": "https://physionet.org/content/sleep-edfx/1.0.0/",
}


def _get_connection() -> sqlite3.Connection:
    """Open a connection with row_factory, following project pattern."""
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def migrate(conn: sqlite3.Connection) -> None:
    """Create the table and indexes if they don't exist."""
    logger.info("Running eeg_reference_data migration...")
    conn.executescript(MIGRATION_SQL)
    logger.info("Migration complete.")


def r2a(stage: str) -> Optional[str]:
    """Convert R&K stage label to AASM label. Returns None for unscored."""
    return R2A_STAGE_MAP.get(stage)


def import_from_json(
    conn: sqlite3.Connection,
    json_path: str | Path,
    subject_id: str,
    channel_name: str,
    dry_run: bool = False,
) -> int:
    """
    Import band power + sleep stage data from a JSON file.

    Expected JSON format (list of epoch dicts):
    [
        {
            "epoch_index": 0,
            "epoch_start_sec": 0.0,
            "sleep_stage": "W",          -- AASM short code
            "delta_power": 412.3,
            "theta_power": 85.1,
            "alpha_power": 10.2,
            "beta_power": 5.8,
            "gamma_power": 2.1,
        },
        ...
    ]

    Returns the number of rows inserted (or skipped in dry-run).
    """
    with open(json_path, "r") as f:
        epochs: List[Dict[str, Any]] = json.load(f)

    # Check if table exists
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='eeg_reference_data'"
    )
    if not cursor.fetchone():
        migrate(conn)

    inserted = 0
    skipped = 0

    for epoch in epochs:
        # sleep_stage is already in AASM short format from Phase 3 export
        aasm_stage = str(epoch.get("sleep_stage", ""))

        # Validate stage against CHECK constraint
        if aasm_stage not in ("W", "N1", "N2", "N3", "REM"):
            skipped += 1
            logger.warning(
                "Skipping epoch %s: invalid stage '%s'",
                epoch.get("epoch_index"), aasm_stage,
            )
            continue

        try:
            epoch_start = float(epoch["epoch_start_sec"])
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO eeg_reference_data (
                    subject_id, epoch_index, epoch_start_sec, epoch_end_sec,
                    sleep_stage, delta_power, theta_power, alpha_power,
                    beta_power, gamma_power, channel_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subject_id,
                    int(epoch["epoch_index"]),
                    epoch_start,
                    epoch_start + 30.0,
                    aasm_stage,
                    float(epoch["delta_power"]),
                    float(epoch["theta_power"]),
                    float(epoch["alpha_power"]),
                    float(epoch["beta_power"]),
                    float(epoch["gamma_power"]),
                    channel_name,
                ),
            )
            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1  # IGNOREd duplicate
        except (KeyError, ValueError) as e:
            logger.warning("Skipping epoch %s: %s", epoch.get("epoch_index"), e)
            skipped += 1

    if not dry_run:
        conn.commit()

    logger.info(
        "Imported %d rows, skipped %d (%s).",
        inserted, skipped, "DRY RUN" if dry_run else "committed",
    )
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Import EEG reference data into SQLite")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be imported")
    parser.add_argument("--json", dest="json_path", help="Path to epoch JSON file")
    parser.add_argument("--subject", required=True, help="Subject ID (e.g. SC4001)")
    parser.add_argument("--channel", required=True, help="Channel name (Fpz-Cz or Pz-Oz)")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)

    conn = _get_connection()
    try:
        migrate(conn)
        if args.json_path:
            count = import_from_json(
                conn, args.json_path, args.subject, args.channel, args.dry_run
            )
            print(f"Rows inserted: {count}")
        else:
            print("Usage: --json <path> --subject <id> --channel <name>")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
