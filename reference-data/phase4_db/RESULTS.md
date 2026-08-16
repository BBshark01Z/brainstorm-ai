# Phase 4 Results — Reference Data DB Schema Design

**Date:** 2026-08-12
**Scope:** Design only — no migration or data import executed.

---

## 1. Schema Design

### Table: `eeg_reference_data`

Stores validated, processed reference data from Phases 1–3 (dataset loading, band power extraction, sleep staging). This is a completely separate table — no existing tables (`brainprint_profiles`, `chat_messages`, `users`) are touched.

```sql
CREATE TABLE IF NOT EXISTS eeg_reference_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Dataset provenance
    dataset_name    TEXT    NOT NULL DEFAULT 'Sleep-EDF Database Expanded',
    source_url      TEXT,

    -- Subject / recording identity
    subject_id      TEXT    NOT NULL,  -- e.g. 'SC4001', 'SC4011'

    -- Epoch-level fields
    epoch_index     INTEGER NOT NULL,  -- 0-based epoch number within recording
    epoch_start_sec REAL    NOT NULL,  -- seconds from recording start (epoch_index * 30)
    epoch_end_sec   REAL    NOT NULL,  -- epoch_start_sec + 30

    -- Sleep stage (AASM-style, post-R&K-to-AASM merge)
    sleep_stage     TEXT    NOT NULL CHECK(sleep_stage IN ('W', 'N1', 'N2', 'N3', 'REM')),

    -- Band power (µV²) — computed via validated FFT/Welch from Phase 2
    delta_power     REAL,
    theta_power     REAL,
    alpha_power     REAL,
    beta_power      REAL,
    gamma_power     REAL,

    -- Which EEG derivation this epoch came from
    channel_name    TEXT    NOT NULL CHECK(channel_name IN ('Fpz-Cz', 'Pz-Oz')),

    -- Metadata
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Each subject × channel × epoch is unique
    UNIQUE(subject_id, channel_name, epoch_index)
);
```

### Indexes

```sql
-- Fast lookup by subject + channel
CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_channel
    ON eeg_reference_data(subject_id, channel_name);

-- Fast lookup by sleep stage (for stage-stratified analytics)
CREATE INDEX IF NOT EXISTS idx_eeg_ref_stage
    ON eeg_reference_data(sleep_stage);

-- Temporal scan within a recording
CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_time
    ON eeg_reference_data(subject_id, epoch_start_sec);
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `epoch_index` INTEGER (0-based) | Matches how epochs are generated in Phase 2/3 (sequential 30 s windows). Easier to join with raw signal buffers later. |
| `epoch_start_sec` / `epoch_end_sec` REAL | Human-readable; derivable from `epoch_index * 30` but stored for convenience and to handle non-standard epoch lengths if needed. |
| `sleep_stage` TEXT with CHECK constraint | AASM-style labels only (W/N1/N2/N3/REM). Phase 3 R&K-to-AASM merge happens in the import script, not at schema level. |
| Band power columns as `REAL` | Values are in µV² (microvolt-squared). Stored as-is from Phase 2 computation — no normalization at rest time. |
| `channel_name` TEXT with CHECK | Only Fpz-Cz and Pz-Oz are in the current dataset. CHECK keeps the door open to add derivations without silently corrupting data. |
| `UNIQUE(subject_id, channel_name, epoch_index)` | Prevents duplicate imports of the same epoch. Safe to re-run the import script idempotently. |
| No foreign keys | This is a reference-data scratch store, not an application table. No user_id linkage needed at this stage. |

---

## 2. Migration SQL

Copy-paste this into a SQLite shell or run via the import script:

```sql
-- Phase 4 migration: create eeg_reference_data table

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
```

---

## 3. Import Script (Design)

The import script would live at `neuropulse-backend/db/import_reference_data.py`
and perform the following steps:

```python
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

# The migration SQL (must match RESULTS.md exactly)
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
            "sleep_stage_r2k": "3",       -- R&K label
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
        aasm_stage = r2a(str(epoch.get("sleep_stage_r2k", "")))
        if aasm_stage is None:
            skipped += 1
            continue

        try:
            conn.execute(
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
                    float(epoch["epoch_start_sec"]),
                    float(epoch.get("epoch_end_sec", epoch["epoch_start_sec"] + 30)),
                    aasm_stage,
                    float(epoch["delta_power"]),
                    float(epoch["theta_power"]),
                    float(epoch["alpha_power"]),
                    float(epoch["beta_power"]),
                    float(epoch["gamma_power"]),
                    channel_name,
                ),
            )
            if conn.changes > 0:
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


def import_from_phase3_results(
    conn: sqlite3.Connection,
    results_path: str | Path,
    dry_run: bool = False,
) -> int:
    """
    Import from Phase 3's RESULTS.md by parsing the epoch tables.

    This is a fallback for when results are only in markdown.
    Prefer import_from_json when a structured JSON export exists.
    """
    # Parse RESULTS.md for epoch tables...
    # Implementation would extract the per-epoch tables and convert
    # R&K stages to AASM. See Phase 3 for the exact table format.
    raise NotImplementedError(
        "Parse RESULTS.md tables — prefer JSON import when possible."
    )


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
```

### Import Workflow

```
Phase 2/3 output (Python dicts / JSON)
        │
        ▼
  import_reference_data.py
        │
        ├── migrate()  →  CREATE TABLE IF NOT EXISTS + indexes
        │
        ├── import_from_json()  →  INSERT OR IGNORE (idempotent)
        │       │
        │       ├── R&K → AASM conversion (Stage 3+4 → N3)
        │       ├── INSERT OR IGNORE (UNIQUE constraint prevents duplicates)
        │       └── Returns inserted/skipped counts
        │
        ▼
  eeg_reference_data table populated
```

### Example Usage (after Phase 3 completes)

```bash
# Dry run — see what would be imported
python -m neuropulse-backend.db.import_reference_data \
    --json reference-data/phase2_bandpower/epochs_sc4001_fpzc.json \
    --subject SC4001 --channel Fpz-Cz --dry-run

# Actual import
python -m neuropulse-backend.db.import_reference_data \
    --json reference-data/phase2_bandpower/epochs_sc4001_fpzc.json \
    --subject SC4001 --channel Fpz-Cz
```

---

## 4. Data Volume Estimate

| Subject | Channels | Duration | Epochs (30 s) |
|---------|----------|----------|---------------|
| SC4001 (Alice) | 2 (Fpz-Cz, Pz-Oz) | ~22.08 h | ~2,650 × 2 = 5,300 rows |
| SC4011 (Bob) | 2 | ~10 h | ~1,200 × 2 = 2,400 rows |

**Total estimated rows:** ~7,700 (well within SQLite's billions-row capacity; storage ~500 KB).

---

## 5. What This Phase Does NOT Do

- Does NOT modify `brainprint_profiles`, `chat_messages`, or `users` tables
- Does NOT run the migration (no `CREATE TABLE` executed)
- Does NOT import any data
- Does NOT create API endpoints to query this table (that would be Phase 5)

---

*Phase 4 design complete. Awaiting approval to execute migration and import.*
