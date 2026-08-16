"""
add_reference_subjects.py

Fetch additional Sleep-EDF Expanded subjects via MNE,
compute band power (Phase 2) + AASM stage mapping (Phase 3),
export per-epoch JSON, and import into eeg_reference_data.

Usage:
    cd neuropulse-backend
    python add_reference_subjects.py --count 20

This handles:
  1. Downloading subjects via mne.datasets.sleep_physionet.age.fetch_data()
  2. Computing band power per 30s epoch (Welch PSD)
  3. Mapping R&K hypnogram -> AASM stages
  4. Exporting per-epoch JSON files to reference-data/phase3_sleepstage/
  5. Importing into SQLite via the existing import_reference_data.py script
  6. Reporting final subject count

Batch processing: downloads and processes subjects sequentially to avoid
MNE download conflicts. Failed subjects are logged and skipped.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import mne

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("neuropulse.add_subjects")

# Project root is parent of neuropulse-backend/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
JSON_EXPORT_DIR = PROJECT_ROOT / "reference-data" / "phase3_sleepstage"
DB_PATH = Path(__file__).resolve().parent / "data" / "brainprint.db"

# EEG band definitions (Hz) — must match feature_extractor.py
EEG_BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 50.0),
}

# R&K -> AASM mapping (matches import_reference_data.py)
RK_TO_AASM = {
    "Sleep stage W": "W",
    "Sleep stage 1": "N1",
    "Sleep stage 2": "N2",
    "Sleep stage 3": "N3",
    "Sleep stage 4": "N3",
    "Sleep stage R": "REM",
    "Sleep stage ?": None,
}

# Channels we want per subject (Sleep-EDF Expanded uses consistent naming)
# Most subjects have: EEG Fpz-Cz, EEG Pz-Oz, EOG horizontal, EMG sub-mental
TARGET_CHANNELS = ["EEG Fpz-Cz", "EEG Pz-Oz"]

# Subject ID mapping: MNE returns numeric indices, we need SC codes
# The Sleep-EDF Expanded has subjects SC4001-SC4015 (age dataset) and SC4021-SC4051 (temazepam)
# MNE's age.fetch_data returns subjects in order: 0=SC4001, 1=SC4011, 2=SC4021, etc.
# But we already have SC4001 and SC4011, so we skip those.


# ---------------------------------------------------------------------------
# Band power computation (matches Phase 2/3 logic)
# ---------------------------------------------------------------------------

def compute_bandpower_welch(raw_signal: np.ndarray, sfreq: float) -> Dict[str, float]:
    """
    Compute band power via Welch PSD (matches feature_extractor.py).
    Input signal is in Volts (from EDF), converts to microvolts internally.
    """
    signal_uv = raw_signal * 1e6  # Volts -> microvolts
    n = len(signal_uv)

    # Use full epoch as single segment (matches Phase 2B approach)
    nperseg = min(n, int(sfreq * 2))
    if nperseg < 4:
        nperseg = max(4, n // 2)

    psd_arr, freqs = mne.time_frequency.psd_array_welch(
        signal_uv[np.newaxis, :],
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_per_seg=nperseg,
        n_overlap=int(nperseg * 0.5),
        average="mean",
    )
    psd = psd_arr[0]

    band_power = {}
    for band_name, (fmin, fmax) in EEG_BANDS.items():
        idx = (freqs >= fmin) & (freqs <= fmax)
        if np.any(idx):
            try:
                band_power[band_name] = float(np.trapezoid(psd[idx], freqs[idx]))
            except AttributeError:
                band_power[band_name] = float(np.trapz(psd[idx], freqs[idx]))
        else:
            band_power[band_name] = 0.0

    return band_power


# ---------------------------------------------------------------------------
# Hypnogram loading
# ---------------------------------------------------------------------------

def load_hypnogram(ann: mne.Annotations) -> List[Tuple[float, float, Optional[str]]]:
    """
    Load hypnogram events from Annotations object.
    Returns list of (onset_seconds, duration_seconds, aasm_stage_code).
    """
    result = []
    for i in range(len(ann)):
        onset_s = float(ann.onset[i])
        duration_s = float(ann.duration[i])
        desc = str(ann.description[i])
        aasm = RK_TO_AASM.get(desc)
        if aasm is not None:
            result.append((onset_s, duration_s, aasm))
    return result


# ---------------------------------------------------------------------------
# Subject processing
# ---------------------------------------------------------------------------

def process_subject(
    edf_path: str,
    hypo_path: Optional[str],
    subject_id: str,
    channel_name: str,
    sfreq: float,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """
    Process a single subject's EEG + hypnogram data.

    Returns (epochs_list, inserted_count, skipped_count).
    """
    raw = mne.io.read_raw_edf(edf_path, preload=True, verbose=False)

    # Find channel index
    if channel_name not in raw.ch_names:
        # Try partial match
        matches = [i for i, ch in enumerate(raw.ch_names) if channel_name in ch]
        if not matches:
            raise ValueError(
                f"Channel '{channel_name}' not found in {edf_path}. "
                f"Available: {raw.ch_names}"
            )
        ch_idx = matches[0]
        actual_name = raw.ch_names[ch_idx]
    else:
        ch_idx = raw.ch_names.index(channel_name)
        actual_name = channel_name

    sfreq = raw.info["sfreq"]
    n_samples = int(30 * sfreq)  # 30s epochs
    total_samples = raw.get_data()[ch_idx].shape[-1]
    n_epochs = total_samples // n_samples

    # Load hypnogram
    stage_map = {}  # onset -> (duration, stage)
    if hypo_path and os.path.exists(hypo_path):
        hypo_ann = mne.read_annotations(hypo_path, verbose=False)
        hypo_events = load_hypnogram(hypo_ann)
        for onset, dur, stage in hypo_events:
            stage_map[int(onset)] = (dur, stage)

    # Compute band power per epoch
    epochs_list = []
    skipped = 0
    inserted = 0

    for i in range(n_epochs):
        start_s = i * 30
        start_idx = i * n_samples
        end_idx = start_idx + n_samples
        if end_idx > total_samples:
            break

        segment = raw.get_data(ch_idx, start_idx, end_idx, verbose=False).flatten()
        bp = compute_bandpower_welch(segment, sfreq)

        # Find matching sleep stage
        aasm_stage = stage_map.get(start_s, (30, "W"))[1]  # default to Wake

        epochs_list.append({
            "epoch_index": i,
            "epoch_start_sec": float(start_s),
            "sleep_stage": aasm_stage,
            "delta_power": float(bp["delta"]),
            "theta_power": float(bp["theta"]),
            "alpha_power": float(bp["alpha"]),
            "beta_power": float(bp["beta"]),
            "gamma_power": float(bp["gamma"]),
        })

    # Validate stages
    valid_stages = {"W", "N1", "N2", "N3", "REM"}
    valid_epochs = [e for e in epochs_list if e["sleep_stage"] in valid_stages]
    skipped = len(epochs_list) - len(valid_epochs)
    epochs_list = valid_epochs
    inserted = len(epochs_list)

    logger.info(
        "  Processed %s: %d epochs (%d valid, %d skipped), channel=%s",
        subject_id, len(epochs_list) + skipped, inserted, skipped, actual_name,
    )

    return epochs_list, inserted, skipped


# ---------------------------------------------------------------------------
# Subject ID mapping for MNE Sleep-EDF Expanded
# ---------------------------------------------------------------------------

def get_subject_id_for_index(index: int) -> Optional[str]:
    """
    Map MNE age.fetch_data subject index to Sleep-EDF Expanded subject code.

    Sleep-EDF Expanded (age dataset): SC4001, SC4011, SC4021, SC4031, SC4041, SC4051
    Sleep-EDF Expanded (temazepam): SC4001-SC4015, SC4021-SC4051

    MNE's age.fetch_data returns:
      subjects 0-5 correspond to SC4001, SC4011, SC4021, SC4031, SC4041, SC4051

    For the temazepam dataset (not used here), subjects are SC4001-SC4015.

    We want subjects SC4021, SC4031, SC4041, SC4051, SC4061, etc.
    But MNE's age dataset only has 6 subjects (0-5).

    For more subjects, we need the full Sleep-EDF Expanded (not just age subset).
    The full expanded dataset has SC4001-SC4015, SC4021-SC4051, SC4061-SC4091.

    Since MNE's age.fetch_data is limited, we'll use a direct download approach
    for additional subjects.
    """
    # MNE age dataset mapping
    age_mapping = {
        0: "SC4001",
        1: "SC4011",
        2: "SC4021",
        3: "SC4031",
        4: "SC4041",
        5: "SC4051",
    }
    return age_mapping.get(index)


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def fetch_and_process(count: int = 20) -> Dict[str, Any]:
    """
    Fetch additional Sleep-EDF subjects and process them.

    Strategy:
    - MNE's age.fetch_data is limited to 6 subjects (0-5).
    - For more subjects, we use PhysioNet API to discover available subjects
      and download them directly.

    Returns summary dict with counts and timing.
    """
    start_time = time.time()

    # Step 1: Try MNE age.fetch_data first
    logger.info("=" * 60)
    logger.info("Step 1: Attempting MNE age.fetch_data")
    logger.info("=" * 60)

    already_processed = {"SC4001", "SC4011"}  # Already in DB
    all_subjects_data = {}  # subject_id -> (edf_path, hypo_path)

    try:
        # Fetch all available subjects from MNE's age dataset
        subjects_info = mne.datasets.sleep_physionet.age.fetch_data(
            subjects=None,  # All available
            recording=1,
            data_dir=None,
            verbose=False,
        )

        logger.info(f"MNE returned {len(subjects_info)} subjects from age dataset")

        for info in subjects_info:
            subj_idx = info["subject"]  # Numeric index
            subj_id = get_subject_id_for_index(subj_idx)
            if subj_id is None:
                logger.warning(f"Unknown subject index {subj_idx}, skipping")
                continue

            edf_path = info["data"][0]  # First element is the EDF path
            hypo_path = None

            # Look for corresponding hypnogram
            base_name = Path(edf_path).stem  # e.g., "SC4001E0-PSG"
            hypo_candidates = [
                Path(edf_path).parent / f"{base_name.replace('PSG', 'Hypnogram')}.edf",
                Path(edf_path).parent / f"{subj_id}EC-Hypnogram.edf",
                Path(edf_path).parent / f"{subj_id}EH-Hypnogram.edf",
            ]
            for candidate in hypo_candidates:
                if candidate.exists():
                    hypo_path = str(candidate)
                    break

            all_subjects_data[subj_id] = (edf_path, hypo_path)
            logger.info(f"  Found: {subj_id} -> {edf_path}")

    except Exception as e:
        logger.warning(f"MNE age.fetch_data failed: {e}")
        logger.info("Will try alternative download methods...")

    logger.info(f"Subjects from MNE: {list(all_subjects_data.keys())}")

    # Step 2: If we need more subjects beyond what MNE provides,
    # download directly from PhysioNet
    if len(all_subjects_data) < count:
        need_more = count - len(all_subjects_data)
        logger.info(f"\nNeed {need_more} more subjects. Downloading from PhysioNet...")

        # Sleep-EDF Expanded subject list (available on PhysioNet)
        # Full expanded: SC4001-SC4015, SC4021-SC4051, SC4061-SC4091
        # We skip already-processed ones
        all_possible_ids = [
            f"SC40{i:02d}" for i in list(range(1, 16)) + list(range(21, 52)) + list(range(61, 92))
        ]
        available_ids = [s for s in all_possible_ids if s not in all_subjects_data and s not in already_processed]

        logger.info(f"Available additional IDs: {len(available_ids)}")

        import urllib.request
        import json as _json

        # Use PhysioNet API to verify subjects exist
        # Or just try downloading directly
        downloaded = 0
        mne_data_dir = Path.home() / "mne_data" / "physionet-sleep-data"
        mne_data_dir.mkdir(parents=True, exist_ok=True)

        for subj_id in available_ids[:need_more]:
            if downloaded >= need_more:
                break

            # Construct expected file names
            # Format: SC4XXXE0-PSG.edf and SC4XXXEC-Hypnogram.edf / SC4XXXEH-Hypnogram.edf
            e0_num = subj_id[2:]  # e.g., "4021"
            hypo_ec = f"{subj_id}EC-Hypnogram.edf"
            hypo_eh = f"{subj_id}EH-Hypnogram.edf"
            eeg_file = f"{subj_id}E0-PSG.edf"

            edf_path = mne_data_dir / eeg_file
            hypo_path = None
            for hcand in [mne_data_dir / hypo_ec, mne_data_dir / hypo_eh]:
                if hcand.exists():
                    hypo_path = str(hcand)
                    break

            if edf_path.exists():
                all_subjects_data[subj_id] = (str(edf_path), hypo_path)
                downloaded += 1
                logger.info(f"  Local: {subj_id}")
                continue

            # Download from PhysioNet
            url = f"https://physionet.org/content/sleep-edfx/1.0.0/rec/{subj_id}/{eeg_file}"
            logger.info(f"  Downloading: {subj_id} from {url}")

            try:
                urllib.request.urlretrieve(url, str(edf_path))
                all_subjects_data[subj_id] = (str(edf_path), hypo_path)
                downloaded += 1
                logger.info(f"  Downloaded: {subj_id} ({edf_path.stat().st_size / 1e6:.1f} MB)")
            except Exception as e:
                logger.warning(f"  Failed to download {subj_id}: {e}")

            # Try to download hypnogram too
            if hypo_path is None:
                for hcand_name in [hypo_ec, hypo_eh]:
                    hypo_url = f"https://physionet.org/content/sleep-edfx/1.0.0/rec/{subj_id}/{hcand_name}"
                    hypo_local = mne_data_dir / hcand_name
                    try:
                        urllib.request.urlretrieve(hypo_url, str(hypo_local))
                        hypo_path = str(hypo_local)
                        # Update the entry
                        if subj_id in all_subjects_data:
                            all_subjects_data[subj_id] = (all_subjects_data[subj_id][0], hypo_path)
                        break
                    except Exception:
                        continue

        logger.info(f"Downloaded {downloaded} additional subjects")

    # Step 3: Filter out already-processed subjects
    new_subjects = {
        sid: (edf, hypo)
        for sid, (edf, hypo) in all_subjects_data.items()
        if sid not in already_processed
    }

    logger.info(f"\n{'=' * 60}")
    logger.info(f"Processing {len(new_subjects)} new subjects")
    logger.info(f"{'=' * 60}")

    # Step 4: Process each subject
    total_epochs = 0
    total_inserted = 0
    total_skipped = 0
    failed_subjects = []
    processed_subjects = []

    for subj_id, (edf_path, hypo_path) in new_subjects.items():
        logger.info(f"\n{'─' * 50}")
        logger.info(f"Processing subject: {subj_id}")
        logger.info(f"  EDF: {edf_path}")
        logger.info(f"  Hypnogram: {hypo_path or 'None'}")

        subj_start = time.time()
        subj_epochs = 0
        subj_inserted = 0
        subj_skipped = 0

        for channel in TARGET_CHANNELS:
            try:
                epochs_list, inserted, skipped = process_subject(
                    edf_path=edf_path,
                    hypo_path=hypo_path,
                    subject_id=subj_id,
                    channel_name=channel,
                    sfreq=256.0,  # Will be overridden by actual sfreq
                )

                if epochs_list:
                    # Export JSON
                    channel_short = channel.replace("EEG ", "").replace("-", "")
                    fname = f"epochs_{subj_id}_{channel_short}.json"
                    fpath = JSON_EXPORT_DIR / fname

                    with open(fpath, "w") as f:
                        json.dump(epochs_list, f, indent=2)

                    subj_epochs += len(epochs_list)
                    subj_inserted += inserted
                    subj_skipped += skipped
                    total_epochs += len(epochs_list)
                    total_inserted += inserted
                    total_skipped += skipped

                    logger.info(f"  Exported: {fname} ({len(epochs_list)} epochs)")
                else:
                    logger.warning(f"  No valid epochs for channel {channel}")
                    subj_skipped += skipped
                    total_skipped += skipped

            except Exception as e:
                logger.error(f"  Channel {channel} failed: {e}", exc_info=True)

        elapsed = time.time() - subj_start
        logger.info(
            f"Subject {subj_id} complete: {subj_epochs} epochs, "
            f"{subj_inserted} inserted, {subj_skipped} skipped, "
            f"{elapsed:.1f}s"
        )

        if subj_epochs > 0:
            processed_subjects.append(subj_id)
        else:
            failed_subjects.append(subj_id)

    # Step 5: Import JSON files into DB
    logger.info(f"\n{'=' * 60}")
    logger.info(f"Step 5: Importing {len(processed_subjects)} subjects into DB")
    logger.info(f"{'=' * 60}")

    import subprocess
    total_db_rows = 0

    for subj_id in processed_subjects:
        # Find JSON files for this subject
        json_files = list(JSON_EXPORT_DIR.glob(f"epochs_{subj_id}_*.json"))
        for jf in json_files:
            # Extract channel name from filename: epochs_SC4021_FpzCz.json -> Fpz-Cz
            channel_short = jf.stem.replace(f"epochs_{subj_id}_", "")
            channel_name = channel_short.replace("Fpz", "Fpz-Cz").replace("PzOz", "Pz-Oz")

            try:
                result = subprocess.run(
                    [
                        sys.executable,
                        str(Path(__file__).parent / "db" / "import_reference_data.py"),
                        "--json", str(jf),
                        "--subject", subj_id,
                        "--channel", channel_name,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    cwd=str(Path(__file__).parent),
                )
                if result.returncode == 0:
                    # Parse "Rows inserted: N"
                    for line in result.stdout.splitlines():
                        if "Rows inserted" in line:
                            rows = int(line.split(":")[1].strip())
                            total_db_rows += rows
                            logger.info(f"  Imported {rows} rows from {jf.name}")
                else:
                    logger.error(f"  Import failed for {jf.name}: {result.stderr[:200]}")
            except Exception as e:
                logger.error(f"  Import error for {jf.name}: {e}")

    # Step 6: Verify with DB query
    logger.info(f"\n{'=' * 60}")
    logger.info(f"Verification")
    logger.info(f"{'=' * 60}")

    import sqlite3
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT COUNT(DISTINCT subject_id) as cnt FROM eeg_reference_data"
    ).fetchone()
    subject_count = row["cnt"]
    row2 = conn.execute(
        "SELECT COUNT(*) as cnt FROM eeg_reference_data"
    ).fetchone()
    total_rows = row2["cnt"]

    # List all subject IDs
    subjects = conn.execute(
        "SELECT DISTINCT subject_id FROM eeg_reference_data ORDER BY subject_id"
    ).fetchall()
    subject_ids = [s["subject_id"] for s in subjects]

    conn.close()

    elapsed_total = time.time() - start_time

    summary = {
        "subjects_from_mne": len(all_subjects_data),
        "new_subjects_processed": len(processed_subjects),
        "failed_subjects": failed_subjects,
        "total_epochs_computed": total_epochs,
        "total_db_rows_imported": total_db_rows,
        "final_subject_count": subject_count,
        "total_db_rows": total_rows,
        "subject_ids": subject_ids,
        "elapsed_seconds": elapsed_total,
    }

    logger.info(f"\n{'=' * 60}")
    logger.info(f"SUMMARY")
    logger.info(f"{'=' * 60}")
    logger.info(f"  Subjects from MNE age dataset: {summary['subjects_from_mne']}")
    logger.info(f"  New subjects processed: {summary['new_subjects_processed']}")
    logger.info(f"  Failed subjects: {summary['failed_subjects'] or 'None'}")
    logger.info(f"  Total epochs computed: {summary['total_epochs_computed']}")
    logger.info(f"  Total DB rows imported: {summary['total_db_rows_imported']}")
    logger.info(f"  Final subject count: {summary['final_subject_count']}")
    logger.info(f"  Total DB rows: {summary['total_db_rows']}")
    logger.info(f"  Subject IDs: {summary['subject_ids']}")
    logger.info(f"  Total time: {elapsed_total:.1f}s ({elapsed_total/60:.1f}m)")
    logger.info(f"{'=' * 60}")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Add Sleep-EDF reference subjects to the DB"
    )
    parser.add_argument(
        "--count", type=int, default=20,
        help="Number of additional subjects to fetch (default: 20)",
    )
    args = parser.parse_args()

    summary = fetch_and_process(count=args.count)

    # Print final report
    print("\n" + "=" * 60)
    print("TASK 1 REPORT")
    print("=" * 60)
    print(f"  Target subjects: {args.count}")
    print(f"  Subjects from MNE: {summary['subjects_from_mne']}")
    print(f"  New subjects processed: {summary['new_subjects_processed']}")
    print(f"  Failed subjects: {summary['failed_subjects'] or 'None'}")
    print(f"  Total epochs computed: {summary['total_epochs_computed']}")
    print(f"  Total DB rows imported: {summary['total_db_rows_imported']}")
    print(f"  Final subject count (SELECT COUNT DISTINCT): {summary['final_subject_count']}")
    print(f"  Total DB rows: {summary['total_db_rows']}")
    print(f"  Subject IDs: {summary['subject_ids']}")
    print(f"  Time taken: {summary['elapsed_seconds']:.1f}s ({summary['elapsed_seconds']/60:.1f}m)")
    print("=" * 60)


if __name__ == "__main__":
    main()
