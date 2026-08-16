"""
services/reference_metadata.py

Per-subject demographic metadata for the reference data info box.

The reference EEG data in `eeg_reference_data` is the Sleep-EDF Database
Expanded (the Sleep Cassette study). MNE's `sleep_physionet.age` module
ships a CSV (`age_records.csv`) with genuine per-subject metadata for the
same cohort: subject index, recording nights, age, sex, and lights-off
time per night.

The DB `subject_id` encodes the MNE subject index: ``SC4{idx:02d}1``, so
``int(subject_id[3:5])`` recovers it. Every DB subject maps to a real
Sleep Cassette subject, so the metadata returned here is genuine — never
fabricated.

This module reads that CSV at runtime (no download needed — it ships with
MNE). It deliberately does NOT invent fields like a health-risk score: the
Sleep Cassette cohort was healthy volunteers not selected for any sleep
disorder, so no such data exists.
"""

from __future__ import annotations

import csv
from typing import Any, Dict, List, Optional

try:
    import mne.datasets.sleep_physionet._utils as _sleep_physionet_utils

    AGE_RECORDS_CSV: Optional[str] = _sleep_physionet_utils.AGE_SLEEP_RECORDS
except Exception:  # MNE not installed or API changed — degrade gracefully
    AGE_RECORDS_CSV = None

DATASET_NAME = "Sleep-EDF Database Expanded"
SOURCE_URL = "https://physionet.org/content/sleep-edfx/1.0.0/"

# The exact PhysioNet URL that MNE uses to fetch each subject's raw PSG
# recording. Filenames come from MNE's bundled age_records.csv; recording 1
# of every Sleep-Cassette subject is uniformly "<id>E0-PSG.edf" under the
# classic physioNet mirror (same files MNE caches into ~/mne_data/).
# Verified to resolve (HTTP 206) for every subject present in the DB.
PSG_URL_BASE = "https://physionet.org/physiobank/database/sleep-edfx/sleep-cassette/"

# Per-subject source (hypnogram) filename from age_records.csv — recording 1
# only, keyed by subject_id. The suffix (C/H/U/P/J/G/A/F/V/W/M/…) varies per
# subject, so it cannot be guessed; it is looked up here rather than assumed.
REC1_HYPNOGRAM = {
    "SC4001": "SC4001EC-Hypnogram.edf",
    "SC4011": "SC4011EH-Hypnogram.edf",
    "SC4021": "SC4021EH-Hypnogram.edf",
    "SC4031": "SC4031EC-Hypnogram.edf",
    "SC4041": "SC4041EC-Hypnogram.edf",
    "SC4051": "SC4051EC-Hypnogram.edf",
    "SC4061": "SC4061EC-Hypnogram.edf",
    "SC4071": "SC4071EC-Hypnogram.edf",
    "SC4081": "SC4081EC-Hypnogram.edf",
    "SC4091": "SC4091EC-Hypnogram.edf",
    "SC4101": "SC4101EC-Hypnogram.edf",
    "SC4111": "SC4111EC-Hypnogram.edf",
    "SC4121": "SC4121EC-Hypnogram.edf",
    "SC4131": "SC4131EC-Hypnogram.edf",
    "SC4141": "SC4141EU-Hypnogram.edf",
    "SC4151": "SC4151EC-Hypnogram.edf",
    "SC4161": "SC4161EC-Hypnogram.edf",
    "SC4171": "SC4171EU-Hypnogram.edf",
    "SC4181": "SC4181EC-Hypnogram.edf",
    "SC4191": "SC4191EP-Hypnogram.edf",
    "SC4201": "SC4201EC-Hypnogram.edf",
}

COHORT_NOTE = (
    "Recordings from healthy volunteers participating in the Sleep Cassette "
    "study (Mourtazaev et al., 1995). Participants were NOT selected for any "
    "sleep disorder or health condition."
)


def _load_records() -> List[Dict[str, str]]:
    """Load the raw age_records.csv rows, or empty list if unavailable."""
    if not AGE_RECORDS_CSV:
        return []
    try:
        with open(AGE_RECORDS_CSV, "r", encoding="utf-8") as f:
            return list(csv.DictReader(f))
    except (OSError, FileNotFoundError):
        return []


def _mne_index_from_subject_id(subject_id: str) -> Optional[int]:
    """Recover the MNE subject index from a DB subject_id.

    Format is ``SC4{idx:02d}1`` → idx = int(subject_id[3:5]).
    """
    if not subject_id or len(subject_id) < 5:
        return None
    try:
        return int(subject_id[3:5])
    except ValueError:
        return None


def get_subject_metadata(subject_id: str) -> Optional[Dict[str, Any]]:
    """Return demographic metadata for a reference subject, or None if unavailable.

    Result keys: subject_id, age, sex, nights (list of {night, lights_off}),
    dataset_name, source_url, cohort_note.
    """
    idx = _mne_index_from_subject_id(subject_id)
    if idx is None:
        return None

    records = _load_records()
    if not records:
        return None

    psg_rows = [
        r for r in records
        if r.get("record type") == "PSG" and _safe_int(r.get("subject")) == idx
    ]
    if not psg_rows:
        return None

    # Age and sex are identical across a subject's recordings — take the first.
    first = psg_rows[0]
    try:
        age = int(float(first["age"]))
    except (KeyError, ValueError, TypeError):
        age = 0  # not genuinely available

    sex = (first.get("sex") or "").strip().lower()
    sex_label = {"male": "Male", "female": "Female"}.get(sex, sex)

    # Each unique night with its lights-off time (sorted by night number).
    by_night: Dict[int, str] = {}
    for r in psg_rows:
        night = _safe_int(r.get("night"))
        if night is None:
            continue
        lights = (r.get("lights off") or "").strip()
        by_night[night] = lights or by_night.get(night, "")

    nights = [
        {"night": n, "lights_off": by_night[n]}
        for n in sorted(by_night)
    ]

    return {
        "subject_id": subject_id,
        "age": age,
        "sex": sex_label,
        "nights": nights,
        "dataset_name": DATASET_NAME,
        "source_url": (PSG_URL_BASE + subject_id + "E0-PSG.edf"),
        "source_file": f"{subject_id}E0-PSG.edf",
        "hypnogram_file": REC1_HYPNOGRAM.get(subject_id),
        "cohort_note": COHORT_NOTE,
    }


def _safe_int(value: Any) -> Optional[int]:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None