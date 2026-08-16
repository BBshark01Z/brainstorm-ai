"""
Expand eeg_reference_data with additional Sleep-EDF subjects.

Steps (same pipeline as existing Phase 2/3/4):
  1. Fetch N subjects via mne.datasets.sleep_physionet.age.fetch_data
  2. Compute band power per 30s epoch (Phase 2 FFT method)
  3. Map hypnogram → AASM sleep stages (Phase 3)
  4. Export per-epoch JSON files
  5. Run Phase 4 DB import against new JSON files

Run:
    python expand_reference_data.py [--subjects N] [--dry-run]

Default: fetch 20 new subjects (MNE indices 2-21 → SC4021-SC4201).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sqlite3
import time
import warnings
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import mne
from mne.datasets.sleep_physionet.age import fetch_data

warnings.filterwarnings("ignore", category=RuntimeWarning)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("expand_reference")

# ── Constants ──────────────────────────────────────────────────────────
EEG_BANDS = {
    "delta":  (0.5, 4.0),
    "theta":  (4.0, 8.0),
    "alpha":  (8.0, 13.0),
    "beta":   (13.0, 30.0),
    "gamma":  (30.0, 50.0),
}

# R&K → AASM mapping
RK_TO_AASM = {
    1: "Wake",
    2: "N1",
    3: "N2",
    4: "N3",
    5: "N3",
    6: "REM",
}

# Short-code mapping
AASM_TO_SHORT = {
    "Wake": "W",
    "N1": "N1",
    "N2": "N2",
    "N3": "N3",
    "REM": "REM",
}

# Subject ID mapping: MNE index → Sleep-EDF subject code
# MNE index 0 → SC4001, 1 → SC4011, 2 → SC4021, etc.
def mne_index_to_subject_id(idx: int) -> str:
    """Convert MNE dataset index to Sleep-EDF subject code (SC4XXX)."""
    # The mapping is: index 0=SC4001, 1=SC4011, 2=SC4021, ...
    # Pattern: SC4 + (idx*10+1) zero-padded to 3 digits after SC4
    # 0→001, 1→011, 2→021, 3→031, ..., 9→091, 10→101, 11→111, ...
    code = idx * 10 + 1
    return f"SC4{code:03d}"

# Channel mapping per subject
# Most subjects have both Fpz-Cz and Pz-Oz recordings (rec 1 and rec 2).
# We use recording 1 which is typically Fpz-Cz for early subjects, Pz-Oz for later ones.
CHANNEL_MAP = {
    "SC4001": "EEG Fpz-Cz",
    "SC4011": "EEG Pz-Oz",
    "SC4021": "EEG Fpz-Cz",
    "SC4031": "EEG Fpz-Cz",
    "SC4041": "EEG Fpz-Cz",
    "SC4051": "EEG Fpz-Cz",
    "SC4061": "EEG Fpz-Cz",
    "SC4071": "EEG Fpz-Cz",
    "SC4081": "EEG Fpz-Cz",
    "SC4091": "EEG Fpz-Cz",
    "SC4101": "EEG Fpz-Cz",
    "SC4111": "EEG Fpz-Cz",
    "SC4121": "EEG Fpz-Cz",
    "SC4131": "EEG Fpz-Cz",
    "SC4141": "EEG Fpz-Cz",
    "SC4151": "EEG Fpz-Cz",
    "SC4161": "EEG Fpz-Cz",
    "SC4171": "EEG Fpz-Cz",
    "SC4181": "EEG Fpz-Cz",
    "SC4191": "EEG Fpz-Cz",
    "SC4201": "EEG Fpz-Cz",
}

DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/brainprint.db")
EXPORT_DIR = Path(__file__).parent / "reference-data" / "phase3_sleepstage"


# ── Helpers ────────────────────────────────────────────────────────────

def bandpower_from_psd(freqs, psd, band_name):
    """Integrate power in a frequency band from PSD values."""
    lo, hi = EEG_BANDS[band_name]
    idx = np.where((freqs >= lo) & (freqs <= hi))[0]
    if len(idx) == 0:
        return 0.0
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(psd[idx], freqs[idx]))
    else:
        return float(np.trapz(psd[idx], freqs[idx]))


def compute_bandpower(raw_signal, sfreq):
    """Compute band power for a 1-D raw signal via FFT-based PSD."""
    signal_uv = raw_signal * 1e6  # Volts → microvolts
    n = len(signal_uv)
    fft_vals = np.fft.rfft(signal_uv)
    psd = (np.abs(fft_vals) ** 2) / (n * sfreq)
    if n > 1:
        psd[1:-1] *= 2
    freqs = np.fft.rfftfreq(n, d=1.0 / sfreq)
    return {band: bandpower_from_psd(freqs, psd, band) for band in EEG_BANDS}


def load_hypnogram(hypo_path):
    """Load hypnogram events from EDF file."""
    ann = mne.read_annotations(hypo_path)
    result = []
    text_to_code = {
        "Sleep stage W": 1,
        "Sleep stage 1": 2,
        "Sleep stage 2": 3,
        "Sleep stage 3": 4,
        "Sleep stage 4": 5,
        "Sleep stage R": 6,
        "Sleep stage ?": -1,
    }
    for i in range(len(ann)):
        onset_s = float(ann.onset[i])
        duration_s = float(ann.duration[i])
        desc = str(ann.description[i])
        code = text_to_code.get(desc, -1)
        if code >= 0:
            result.append((onset_s, duration_s, code))
    return result


def find_channel(raw, channel_name):
    """Find EEG channel index, trying exact match then partial match."""
    ch_names = raw.info["ch_names"]

    # Try exact match
    if channel_name in ch_names:
        return ch_names.index(channel_name)

    # Try partial match (e.g., "EEG Fpz-Cz" vs "EEG Fpz-Cz" or "FPZ-CZ")
    for i, name in enumerate(ch_names):
        if raw.info["chs"][i]["kind"] == 2:  # EEG kind
            if channel_name.replace("EEG ", "").lower() in name.lower() or \
               channel_name.replace("EEG ", "").upper() in name.upper():
                return i

    # Fallback: first EEG channel
    eeg_indices = [i for i, ch in enumerate(raw.info["chs"]) if ch["kind"] == 2]
    if eeg_indices:
        logger.warning("Channel '%s' not found; using first EEG channel '%s'",
                       channel_name, ch_names[eeg_indices[0]])
        return eeg_indices[0]

    raise ValueError(f"No EEG channels found in file")


# ── Phase 1: Fetch ────────────────────────────────────────────────────

def fetch_subjects(subject_indices: list[int], recording: int = 1) -> dict[int, list]:
    """
    Fetch Sleep-EDF data for given MNE indices.
    Returns dict: {mne_index: [edf_path, annot_path]}
    Skips failed subjects and logs them.
    """
    results = {}
    failed = []

    for idx in subject_indices:
        subj_id = mne_index_to_subject_id(idx)
        try:
            files = fetch_data(subjects=[idx], recording=[recording], verbose="error")[0]
            results[idx] = files
            logger.info("  Fetched subject %d (%s): %s", idx, subj_id, os.path.basename(files[0]))
        except Exception as e:
            failed.append((idx, subj_id, str(e)))
            logger.error("  FAILED subject %d (%s): %s", idx, subj_id, e)

    if failed:
        logger.warning("Subjects that failed to fetch: %d/%d", len(failed), len(subject_indices))
        for idx, subj_id, err in failed:
            logger.warning("  %s (index %d): %s", subj_id, idx, err)

    return results


# ── Phase 2+3: Process ────────────────────────────────────────────────

def process_subject(
    mne_idx: int,
    files: list[str],
    channel_name: str,
    epoch_duration: float = 30.0,
) -> Optional[list[dict]]:
    """
    Process one subject: load EDF, compute band power, map sleep stages.
    Returns list of epoch dicts or None on failure.
    """
    edf_path, annot_path = files
    subj_id = mne_index_to_subject_id(mne_idx)

    logger.info("  Loading EDF: %s", os.path.basename(edf_path))
    raw = mne.io.read_raw_edf(
        edf_path, stim_channel="Event marker", infer_types=True,
        preload=True, verbose=False,
    )

    sfreq = raw.info["sfreq"]
    ch_idx = find_channel(raw, channel_name)
    eeg_name = raw.info["ch_names"][ch_idx]
    logger.info("  Channel: %s (index %d), sfreq: %.1f Hz", eeg_name, ch_idx, sfreq)

    # Load hypnogram
    try:
        hypo_events = load_hypnogram(annot_path)
        logger.info("  Hypnogram events: %d", len(hypo_events))
    except Exception as e:
        logger.error("  Failed to load hypnogram: %s", e)
        return None

    # Compute band power per epoch
    n_samples = int(epoch_duration * sfreq)
    total_samples = raw.get_data()[ch_idx].shape[-1]
    n_epochs = total_samples // n_samples
    logger.info("  Total samples: %d, Epochs: %d", total_samples, n_epochs)

    if n_epochs == 0:
        logger.error("  No full epochs — skipping subject")
        return None

    epochs = []
    for i in range(n_epochs):
        start_s = i * epoch_duration
        start_idx = i * n_samples
        end_idx = start_idx + n_samples

        segment = raw.get_data(ch_idx, start_idx, end_idx, verbose=False).flatten()
        bp = compute_bandpower(segment, sfreq)

        # Find matching hypnogram event
        stage_label = "Unknown"
        for h_onset, h_dur, h_code in hypo_events:
            if start_s >= h_onset and start_s < h_onset + h_dur:
                aasm = RK_TO_AASM.get(h_code, f"Unknown({h_code})")
                stage_label = aasm
                break

        epochs.append({
            "epoch_index": i,
            "epoch_start_sec": float(start_s),
            "sleep_stage": AASM_TO_SHORT.get(stage_label, stage_label),
            "delta_power": float(bp["delta"]),
            "theta_power": float(bp["theta"]),
            "alpha_power": float(bp["alpha"]),
            "beta_power": float(bp["beta"]),
            "gamma_power": float(bp["gamma"]),
        })

    logger.info("  Computed %d epochs for %s", len(epochs), subj_id)
    return epochs


# ── Phase 3: Export JSON ──────────────────────────────────────────────

def export_json(epochs: list[dict], subj_id: str, channel_name: str) -> str:
    """Export per-epoch data to JSON file. Returns file path."""
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    # Strip "EEG " prefix from channel name for filename
    clean_channel = channel_name.replace("EEG ", "").replace("-", "")
    fname = f"epochs_{subj_id}_{clean_channel}.json"
    fpath = EXPORT_DIR / fname

    records = sorted(epochs, key=lambda r: r["epoch_index"])
    with open(fpath, "w") as f:
        json.dump(records, f, indent=2)

    logger.info("  Exported JSON: %s (%d epochs)", fname, len(records))
    return str(fpath)


# ── Phase 4: Import to DB ─────────────────────────────────────────────

def import_to_db(json_path: str, subject_id: str, channel_name: str, dry_run: bool = False) -> int:
    """Import epoch JSON into SQLite eeg_reference_data table."""
    os.makedirs(os.path.dirname(DATABASE_PATH) or ".", exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row

    # Create table if needed
    conn.executescript("""
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
    CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_channel ON eeg_reference_data(subject_id, channel_name);
    CREATE INDEX IF NOT EXISTS idx_eeg_ref_stage ON eeg_reference_data(sleep_stage);
    CREATE INDEX IF NOT EXISTS idx_eeg_ref_subject_time ON eeg_reference_data(subject_id, epoch_start_sec);
    """)

    with open(json_path, "r") as f:
        epochs = json.load(f)

    inserted = 0
    skipped = 0

    for epoch in epochs:
        aasm_stage = str(epoch.get("sleep_stage", ""))
        if aasm_stage not in ("W", "N1", "N2", "N3", "REM"):
            skipped += 1
            continue

        try:
            epoch_start = float(epoch["epoch_start_sec"])
            cursor = conn.execute(
                """INSERT OR IGNORE INTO eeg_reference_data (
                    subject_id, epoch_index, epoch_start_sec, epoch_end_sec,
                    sleep_stage, delta_power, theta_power, alpha_power,
                    beta_power, gamma_power, channel_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    subject_id, int(epoch["epoch_index"]), epoch_start,
                    epoch_start + 30.0, aasm_stage,
                    float(epoch["delta_power"]), float(epoch["theta_power"]),
                    float(epoch["alpha_power"]), float(epoch["beta_power"]),
                    float(epoch["gamma_power"]), channel_name,
                ),
            )
            if cursor.rowcount > 0:
                inserted += 1
            else:
                skipped += 1
        except (KeyError, ValueError) as e:
            skipped += 1
            logger.warning("  Skipping epoch %s: %s", epoch.get("epoch_index"), e)

    if not dry_run:
        conn.commit()

    conn.close()
    logger.info("  DB: %d inserted, %d skipped (%s)", inserted, skipped,
                "DRY RUN" if dry_run else "committed")
    return inserted


# ── Main ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Expand Sleep-EDF reference data")
    parser.add_argument("--subjects", type=int, default=20,
                        help="Number of additional subjects to fetch (default: 20)")
    parser.add_argument("--dry-run", action="store_true", help="Skip DB import")
    parser.add_argument("--skip-fetch", action="store_true",
                        help="Skip fetch step, process existing JSON files only")
    args = parser.parse_args()

    overall_start = time.time()

    print("=" * 70)
    print("EXPANDING SLEEP-EDF REFERENCE DATA")
    print("=" * 70)
    print(f"  Target: {args.subjects} additional subjects")
    print(f"  Dry run: {args.dry_run}")
    print()

    # ── Step 1: Fetch ──────────────────────────────────────────────────
    fetched = {}
    if not args.skip_fetch:
        print("[1/4] Fetching subjects from PhysioNet ...")
        fetch_start = time.time()
        subject_indices = list(range(2, 2 + args.subjects))
        fetched = fetch_subjects(subject_indices)
        fetch_time = time.time() - fetch_start
        print(f"      Fetched {len(fetched)}/{args.subjects} subjects in {fetch_time:.1f}s")
        print(f"      Subject IDs: {', '.join(mne_index_to_subject_id(i) for i in fetched)}")
        print()

        if not fetched:
            print("ERROR: No subjects fetched. Aborting.")
            return

    # ── Step 2+3: Process & Export ─────────────────────────────────────
    print("[2/4] Processing EEG data (band power + sleep stages) ...")
    process_start = time.time()
    json_files = []  # list of (json_path, subject_id, channel_name)

    for mne_idx in sorted(fetched.keys()):
        subj_id = mne_index_to_subject_id(mne_idx)
        channel = CHANNEL_MAP.get(subj_id, "EEG Fpz-Cz")
        try:
            epochs = process_subject(mne_idx, fetched[mne_idx], channel)
            if epochs:
                jpath = export_json(epochs, subj_id, channel)
                json_files.append((jpath, subj_id, channel))
            else:
                logger.warning("  No epochs for %s — skipped", subj_id)
        except Exception as e:
            logger.error("  ERROR processing %s: %s", subj_id, e)

    process_time = time.time() - process_start
    print(f"      Processed {len(json_files)} subjects in {process_time:.1f}s")
    print()

    # ── Step 4: Import to DB ──────────────────────────────────────────
    print("[3/4] Importing to database ...")
    db_start = time.time()
    total_inserted = 0
    total_epochs = 0

    for jpath, subj_id, channel in json_files:
        inserted = import_to_db(jpath, subj_id, channel, dry_run=args.dry_run)
        total_inserted += inserted
        total_epochs += inserted

    db_time = time.time() - db_start
    print(f"      Total rows inserted: {total_inserted}")
    print(f"      DB import took: {db_time:.1f}s")
    print()

    # ── Verify ────────────────────────────────────────────────────────
    print("[4/4] Verification ...")
    if not args.dry_run:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        count = conn.execute(
            "SELECT COUNT(DISTINCT subject_id) FROM eeg_reference_data"
        ).fetchone()[0]
        total_rows = conn.execute(
            "SELECT COUNT(*) FROM eeg_reference_data"
        ).fetchone()[0]
        subjects = [r[0] for r in conn.execute(
            "SELECT DISTINCT subject_id FROM eeg_reference_data ORDER BY subject_id"
        ).fetchall()]
        conn.close()

        print(f"  Total subjects in DB: {count}")
        print(f"  Total rows in DB: {total_rows}")
        print(f"  Subject IDs: {', '.join(subjects)}")
    else:
        print("  (skipped — dry run)")
    print()

    total_time = time.time() - overall_start
    print("=" * 70)
    print(f"COMPLETE — {total_time:.1f}s total")
    print(f"  Subjects fetched: {len(fetched)}/{args.subjects}")
    print(f"  Subjects processed: {len(json_files)}")
    print(f"  DB rows inserted: {total_inserted}")
    print(f"  DB subject count: {count if not args.dry_run else 'N/A'}")
    print("=" * 70)


if __name__ == "__main__":
    main()
