"""
db/reference_data.py

Query helpers for the eeg_reference_data table.

Follows the project pattern: every function opens its own connection
to avoid "database is locked" errors with FastAPI's async handlers.
"""

from __future__ import annotations

import math
import os
import sqlite3
from typing import Any, Dict, List, Optional

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/brainprint.db")

TABLE_EXISTS_SQL = (
    "SELECT name FROM sqlite_master WHERE type='table' AND name='eeg_reference_data'"
)


def table_exists() -> bool:
    """Return True if the eeg_reference_data table exists."""
    conn = sqlite3.connect(DATABASE_PATH)
    try:
        cursor = conn.execute(TABLE_EXISTS_SQL)
        return cursor.fetchone() is not None
    finally:
        conn.close()


def get_aggregates(
    sleep_stage_filter: Optional[str] = None,
    subject_id_filter: Optional[str] = None,
    limit: int = 100,
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Compute aggregate (mean / std) band power per sleep stage.

    Optionally filter by a single sleep_stage value and/or a subject_id.

    Returns (aggregates, samples) where aggregates is a list of dicts
    keyed by (sleep_stage, band_name, stat) and samples is a list of
    epoch records (up to `limit` per stage).

    Output keys use the ``_power_mean`` / ``_power_std`` naming convention
    to match the Pydantic ReferenceAggregate schema and the API route handler.
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        # Build WHERE clause dynamically
        where_clauses: list[str] = []
        params: list[Any] = []
        if sleep_stage_filter:
            where_clauses.append("sleep_stage = ?")
            params.append(sleep_stage_filter)
        if subject_id_filter:
            where_clauses.append("subject_id = ?")
            params.append(subject_id_filter)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        # Single query: aggregates + samples in one pass
        agg_sql = f"""
            SELECT
                sleep_stage,
                subject_id,
                COUNT(*) as cnt,
                AVG(delta_power) as delta_power_mean,
                AVG(theta_power) as theta_power_mean,
                AVG(alpha_power) as alpha_power_mean,
                AVG(beta_power) as beta_power_mean,
                AVG(gamma_power) as gamma_power_mean,
                AVG(epoch_start_sec) as avg_start
            FROM eeg_reference_data
            {where_sql}
            GROUP BY sleep_stage, subject_id
            ORDER BY sleep_stage, subject_id
        """
        agg_rows = conn.execute(agg_sql, params).fetchall()

        # Samples: up to `limit` per stage
        sample_where_clauses = list(where_clauses)
        sample_params = list(params)
        sample_where_sql = ""
        if sample_where_clauses:
            sample_where_sql = "WHERE " + " AND ".join(sample_where_clauses)

        sample_sql = f"""
            SELECT subject_id, channel_name, epoch_index, epoch_start_sec,
                   epoch_end_sec, sleep_stage,
                   delta_power, theta_power, alpha_power,
                   beta_power, gamma_power
            FROM eeg_reference_data
            {sample_where_sql}
            ORDER BY sleep_stage, subject_id, epoch_index
            LIMIT ?
        """
        sample_params.append(limit * 50)
        sample_rows = conn.execute(sample_sql, sample_params).fetchall()

        # Compute per-stage (and per-subject) std dev (two-pass: mean from AVG, std from raw)
        # Key is (stage, subject_id) to support subject-level aggregation
        key_map: Dict[tuple, Dict[str, List[float]]] = {}
        for row in sample_rows:
            stage = row["sleep_stage"]
            sid = row["subject_id"]
            key = (stage, sid)
            if key not in key_map:
                key_map[key] = {"delta": [], "theta": [], "alpha": [], "beta": [], "gamma": []}
            bands = key_map[key]
            for band in ("delta", "theta", "alpha", "beta", "gamma"):
                val = row[f"{band}_power"]
                if val is not None:
                    bands[band].append(val)

        aggregates = []
        for row in agg_rows:
            stage = row["sleep_stage"]
            sid = row["subject_id"]
            cnt = row["cnt"]
            agg: Dict[str, Any] = {
                "sleep_stage": stage,
                "subject_id": sid,
                "count": cnt,
            }
            bands = key_map.get((stage, sid), {})
            for band in ("delta", "theta", "alpha", "beta", "gamma"):
                mean_val = row[f"{band}_power_mean"]
                values = bands.get(band, [])
                if values and mean_val is not None:
                    variance = sum((v - mean_val) ** 2 for v in values) / max(len(values), 1)
                    std_val = math.sqrt(variance)
                else:
                    std_val = None
                agg[f"{band}_power_mean"] = round(mean_val, 4) if mean_val is not None else None
                agg[f"{band}_power_std"] = round(std_val, 4) if std_val is not None else None
            aggregates.append(agg)

        samples = [dict(r) for r in sample_rows]

        return aggregates, samples
    finally:
        conn.close()


def get_subjects() -> List[Dict[str, Any]]:
    """Return distinct subject_id values with their epoch row counts.

    Used by GET /api/reference/subjects to populate the frontend
    subject selector dynamically instead of hardcoding IDs.
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT subject_id, COUNT(*) as epoch_count
            FROM eeg_reference_data
            GROUP BY subject_id
            ORDER BY subject_id
            """
        ).fetchall()
        return [
            {"subject_id": r["subject_id"], "epoch_count": r["epoch_count"]}
            for r in rows
        ]
    finally:
        conn.close()


def get_total_count(
    sleep_stage_filter: Optional[str] = None,
    subject_id_filter: Optional[str] = None,
) -> int:
    """Return total row count, optionally filtered by sleep_stage and/or subject_id."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        where_clauses: list[str] = []
        params: list[Any] = []
        if sleep_stage_filter:
            where_clauses.append("sleep_stage = ?")
            params.append(sleep_stage_filter)
        if subject_id_filter:
            where_clauses.append("subject_id = ?")
            params.append(subject_id_filter)

        where_sql = ""
        if where_clauses:
            where_sql = "WHERE " + " AND ".join(where_clauses)

        sql = f"SELECT COUNT(*) as cnt FROM eeg_reference_data {where_sql}"
        row = conn.execute(sql, params).fetchone()
        return row["cnt"] if row else 0
    finally:
        conn.close()
