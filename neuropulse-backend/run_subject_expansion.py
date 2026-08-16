"""
run_subject_expansion.py

Task B driver: expand eeg_reference_data from 5 subjects toward ~20 total
by fetching Sleep-EDF Expanded subjects via MNE.

Index scheme (matches expand_reference_data.mne_index_to_subject_id):
    index  ->  SC4{(idx*10+1):03d}
    0      ->  SC4001
    1      ->  SC4011
    ...
    82     ->  SC4821

Rules:
  - Valid MNE index range: 0..82 inclusive.
  - Excluded indices (known-bad / failed on PhysioNet): 39, 68, 69, 78, 79.
  - Reuses the tested band-power / hypnogram / import functions from
    expand_reference_data.py so behavior matches the existing pipeline.

Run from the neuropulse-backend directory so the relative DATABASE_PATH
("./data/brainprint.db") resolves to the same DB the backend serves:

    cd neuropulse-backend
    <venv_new python> run_subject_expansion.py [--target 20]
"""

from __future__ import annotations

import argparse
import logging
import os
import sqlite3
import sys
import time
from pathlib import Path

# Fix module resolution + DB path regardless of cwd.
# The script lives in neuropulse-backend/; the pipeline module it reuses
# (expand_reference_data.py) lives in the repo root (parent).
_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# Default DB path = neuropulse-backend/data/brainprint.db (same file the
# backend serves), overridable via DATABASE_PATH.
os.environ.setdefault("DATABASE_PATH", str(_BACKEND_DIR / "data" / "brainprint.db"))

# Import the tested pipeline pieces from the existing expansion script.
import expand_reference_data as X

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("run_subject_expansion")

# MNE index range and exclusions per Task B.
VALID_INDEX_MIN = 0
VALID_INDEX_MAX = 82
EXCLUDED_INDICES = {39, 68, 69, 78, 79}


def db_connection():
    os.makedirs(os.path.dirname(X.DATABASE_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(X.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def distinct_subjects() -> set[str]:
    conn = db_connection()
    try:
        rows = conn.execute("SELECT DISTINCT subject_id FROM eeg_reference_data")
        return {r["subject_id"] for r in rows}
    finally:
        conn.close()


def valid_candidate_indices() -> list[int]:
    """Indices in 0..82, excluding the bad set."""
    return [
        i for i in range(VALID_INDEX_MIN, VALID_INDEX_MAX + 1)
        if i not in EXCLUDED_INDICES
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Expand Sleep-EDF reference data to ~N subjects")
    parser.add_argument("--target", type=int, default=20,
                        help="Target distinct subject count in DB (default: 20)")
    args = parser.parse_args()

    target = args.target
    overall_start = time.time()

    # Indices already represented in the DB (map subject code back to index).
    existing = distinct_subjects()
    # subject_code -> index (reverse of mne_index_to_subject_id)
    def code_to_index(code: str) -> int | None:
        for i in valid_candidate_indices():
            if X.mne_index_to_subject_id(i) == code:
                return i
        return None

    candidates = [
        i for i in valid_candidate_indices()
        if X.mne_index_to_subject_id(i) not in existing
    ]

    print("=== TASK B — SUBJECT EXPANSION ===")
    print(f"  Current distinct subjects in DB: {len(existing)}")
    print(f"  Target distinct subjects:        {target}")
    print(f"  Candidate MNE indices to try:    {len(candidates)}")
    print(f"  (range 0-{VALID_INDEX_MAX}, excluding {sorted(EXCLUDED_INDICES)})")
    if existing:
        print(f"  Already present: {', '.join(sorted(existing))}")
    print()

    fetched_ok = []
    failed = []
    processed_json = []

    for idx in candidates:
        # Stop once we reach target.
        if len(distinct_subjects()) >= target:
            logger.info("Reached target (%d subjects) — stopping before index %d.", target, idx)
            break

        subj_id = X.mne_index_to_subject_id(idx)
        channel = X.CHANNEL_MAP.get(subj_id, "EEG Fpz-Cz")
        logger.info("--- [%d] %s (channel %s) ---", idx, subj_id, channel)
        try:
            files = X.fetch_data(subjects=[idx], recording=[1], verbose="error")[0]
        except Exception as e:
            failed.append((idx, subj_id, str(e)))
            logger.error("  FAILED fetch %s (index %d): %s", subj_id, idx, e)
            continue

        try:
            epochs = X.process_subject(idx, files, channel)
            if not epochs:
                failed.append((idx, subj_id, "no valid epochs"))
                logger.warning("  No epochs for %s — skipped", subj_id)
                continue
            jpath = X.export_json(epochs, subj_id, channel)
            # The DB stores clean channel codes ("Fpz-Cz"/"Pz-Oz") with a
            # CHECK constraint on exactly those values — strip the "EEG "
            # prefix before importing, else every row is silently ignored
            # by INSERT OR IGNORE (0 inserted / N skipped).
            db_channel = channel.replace("EEG ", "")
            n = X.import_to_db(jpath, subj_id, db_channel, dry_run=False)
            processed_json.append((subj_id, n))
            # Recheck distinct count to honor stop condition even mid-list.
            logger.info("  IMPORTED %d rows for %s (distinct now: %d)",
                        n, subj_id, len(distinct_subjects()))
        except Exception as e:
            failed.append((idx, subj_id, str(e)))
            logger.error("  FAILED processing %s: %s", subj_id, e)

    # Final verification.
    conn = db_connection()
    try:
        final_ids = sorted(r["subject_id"] for r in
                           conn.execute("SELECT DISTINCT subject_id FROM eeg_reference_data"))
        total_rows = conn.execute("SELECT COUNT(*) FROM eeg_reference_data").fetchone()[0]
    finally:
        conn.close()

    elapsed = time.time() - overall_start
    print("\n" + "=" * 70)
    print("TASK B REPORT")
    print("=" * 70)
    print(f"  Target: {target} subjects")
    print(f"  New subjects successfully imported: {len(processed_json)}")
    print(f"  Failed/skipped: {len(failed)}")
    print(f"  Final distinct subject count: {len(final_ids)}")
    print(f"  Total DB rows: {total_rows}")
    print(f"  Subject IDs: {', '.join(final_ids)}")
    print(f"  Time: {elapsed:.1f}s ({elapsed/60:.1f}m)")
    if failed:
        print("  Failures:")
        for idx, sid, err in failed:
            print(f"    - {sid} (index {idx}): {err}")
    print("=" * 70)


if __name__ == "__main__":
    main()