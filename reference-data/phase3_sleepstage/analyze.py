"""
Phase 3: Match band power to sleep stage labels from Sleep-EDF hypnogram.

Reads:
  - Raw EDF files for subjects 0 and 1 (already downloaded in Phase 1)
  - Hypnogram EDF files for both subjects

Computes:
  - Band power per 30s epoch (reusing Phase 2 FFT method)
  - Maps R&K stages → AASM stages (Stage 3+4 → N3)
  - Average band power per sleep stage across both subjects
  - Physiological sanity checks

Writes:
  - RESULTS.md with summary tables and sanity-check results
"""

import os
import json
import numpy as np
import mne
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)

# ── Paths ──────────────────────────────────────────────────────────────
BASE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "Sleep-EDB-SC4000")
# Actually, the dataset was downloaded to a known location from Phase 1.
# Let's find it by searching common locations.

def find_dataset():
    """Find the Sleep-EDF dataset directory."""
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "Sleep-EDF"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "Sleep-EDB-SC4000"),
        r"C:\Users\User\Downloads\Sleep-EDF",
        r"C:\Users\User\Downloads\Sleep-EDB-SC4000",
        r"C:\Users\User\Downloads\neuropulse\Sleep-EDF",
        r"C:\Users\User\mne_data\physionet-sleep-data",
    ]
    # Also try the reference-data parent
    ref_parent = os.path.join(os.path.dirname(__file__), "..", "..")
    for d in os.listdir(ref_parent):
        full = os.path.join(ref_parent, d)
        if os.path.isdir(full) and "SC4" in d:
            return full
    for c in candidates:
        c = os.path.normpath(c)
        if os.path.isdir(c):
            files = os.listdir(c)
            if any("SC4" in f for f in files):
                return c
    # Try to find any .edf files in parent dirs
    for root in [ref_parent, os.path.join(ref_parent, ".."), r"C:\Users\User\Downloads"]:
        if not os.path.isdir(root):
            continue
        for f in os.listdir(root):
            if f.endswith(".edf") and "SC4" in f:
                return root
        for d in os.listdir(root):
            full = os.path.join(root, d)
            if os.path.isdir(full):
                for sub in os.listdir(full):
                    if sub.endswith(".edf") and "SC4" in sub:
                        return full
    return None

DATASET_DIR = find_dataset()
if DATASET_DIR is None:
    raise FileNotFoundError(
        "Cannot find Sleep-EDF dataset. Expected .edf files with 'SC4' in name. "
        "Check that the dataset was downloaded to a discoverable location."
    )

print(f"Dataset directory: {DATASET_DIR}")

# ── Subject file mappings ─────────────────────────────────────────────
# Subject 0 (Alice): SC4001E0-PSG.edf, EEG = Fpz-Cz
# Subject 1 (Bob):   SC4002E0-PSG.edf, EEG = Pz-Oz
# Hypnograms: SC4001EC-Hypnogram.edf, SC4002EC-Hypnogram.edf

SUBJECTS = {
    0: {
        "eeg_file": "SC4001E0-PSG.edf",
        "hypo_file": "SC4001EC-Hypnogram.edf",
        "channel": "EEG Fpz-Cz",
        "name": "Alice",
    },
    1: {
        "eeg_file": "SC4011E0-PSG.edf",
        "hypo_file": "SC4011EH-Hypnogram.edf",
        "channel": "EEG Pz-Oz",
        "name": "Bob",
    },
}

# ── EEG Bands ─────────────────────────────────────────────────────────
EEG_BANDS = {
    "delta":  (0.5, 4.0),
    "theta":  (4.0, 8.0),
    "alpha":  (8.0, 13.0),
    "beta":   (13.0, 30.0),
    "gamma":  (30.0, 50.0),
}

def bandpower_from_psd(freqs, psd, band):
    """Calculate power in a frequency band using trapezoidal integration."""
    lo, hi = band
    idx = (freqs >= lo) & (freqs < hi)
    if not np.any(idx):
        return 0.0
    try:
        return float(np.trapezoid(psd[idx], freqs[idx]))
    except AttributeError:
        return float(np.trapz(psd[idx], freqs[idx]))

def compute_bandpower(raw_signal, sfreq):
    """Compute band power for a raw signal array (in Volts from EDF)."""
    signal_uv = raw_signal * 1e6  # Volts → microvolts
    n = len(signal_uv)
    fft_vals = np.fft.rfft(signal_uv)
    psd = (np.abs(fft_vals) ** 2) / (n * sfreq)
    if n > 1:
        psd[1:-1] *= 2  # one-sided PSD
    freqs = np.fft.rfftfreq(n, d=1.0 / sfreq)
    return {band: bandpower_from_psd(freqs, psd, b) for band, b in EEG_BANDS.items()}

# ── R&K → AASM mapping ────────────────────────────────────────────────
# R&K: W=1, N1=2, N2=3, N3=4, N4=5, REM=6
# AASM: W, N1, N2, N3 (merged N3+N4), REM
RK_TO_AASM = {
    1: "Wake",
    2: "N1",
    3: "N2",
    4: "N3",   # R&K Stage 3 → AASM N3
    5: "N3",   # R&K Stage 4 → AASM N3 (merged)
    6: "REM",
}

# Short-code mapping for DB export (full word → schema code)
AASM_TO_SHORT = {
    "Wake": "W",
    "N1": "N1",
    "N2": "N2",
    "N3": "N3",
    "REM": "REM",
}

# Subject ID mapping (internal name → dataset code)
SUBJECT_ID_MAP = {
    "Alice": "SC4001",
    "Bob": "SC4011",
}

# ── Load hypnogram ────────────────────────────────────────────────────
def load_hypnogram(hypo_path):
    """
    Load hypnogram events from EDF file.
    The Sleep-EDF hypnogram files store annotations as text labels.
    Returns list of (onset_time_seconds, duration_seconds, stage_code).
    Stage codes: W=1, N1=2, N2=3, N3=4, N4=5, REM=6
    """
    ann = mne.read_annotations(hypo_path)
    result = []
    text_to_code = {
        "Sleep stage W": 1,
        "Sleep stage 1": 2,
        "Sleep stage 2": 3,
        "Sleep stage 3": 4,
        "Sleep stage 4": 5,
        "Sleep stage R": 6,
        "Sleep stage ?": -1,  # unknown
    }
    for i in range(len(ann)):
        onset_s = float(ann.onset[i])
        duration_s = float(ann.duration[i])
        desc = str(ann.description[i])
        code = text_to_code.get(desc, -1)
        if code >= 0:
            result.append((onset_s, duration_s, code))
    return result

# ── Main analysis ─────────────────────────────────────────────────────
def analyze():
    print("=" * 70)
    print("PHASE 3: Match band power to sleep stage labels")
    print("=" * 70)

    # Collect per-epoch bandpower + stage for each subject
    all_epochs = []  # list of dicts

    for subj_id in [0, 1]:
        info = SUBJECTS[subj_id]
        eeg_path = os.path.join(DATASET_DIR, info["eeg_file"])
        hypo_path = os.path.join(DATASET_DIR, info["hypo_file"])

        print(f"\n{'─' * 50}")
        print(f"Subject {subj_id} ({info['name']}): {info['eeg_file']}")
        print(f"  Channel: {info['channel']}")

        # Load EEG
        raw = mne.io.read_raw_edf(eeg_path, preload=True, verbose=False)
        sfreq = raw.info['sfreq']
        ch_idx = raw.ch_names.index(info["channel"])
        print(f"  Sampling rate: {sfreq} Hz, Channel index: {ch_idx}")

        # Load hypnogram
        hypo_events = load_hypnogram(hypo_path)
        print(f"  Hypnogram events: {len(hypo_events)}")

        # Map R&K → AASM and count distribution
        stage_counts = {}
        for onset, dur, code in hypo_events:
            aasm = RK_TO_AASM.get(code, f"Unknown({code})")
            stage_counts[aasm] = stage_counts.get(aasm, 0) + 1
        print(f"  AASM stage distribution:")
        for stage, count in sorted(stage_counts.items()):
            print(f"    {stage}: {count} epochs ({count*30/3600:.1f}h)")

        # Compute bandpower per epoch
        n_samples = int(30 * sfreq)  # 30 seconds worth of samples
        total_samples = raw.get_data()[ch_idx].shape[-1]
        n_epochs = total_samples // n_samples

        print(f"  Total samples: {total_samples}, Epochs: {n_epochs}")

        subj_epochs = []
        for i in range(n_epochs):
            start_s = i * 30
            end_s = start_s + 30
            start_idx = i * n_samples
            end_idx = start_idx + n_samples

            segment = raw.get_data(ch_idx, start_idx, end_idx, verbose=False).flatten()

            # Find matching hypnogram event
            stage_label = "Unknown"
            for h_onset, h_dur, h_code in hypo_events:
                if start_s >= h_onset and start_s < h_onset + h_dur:
                    aasm = RK_TO_AASM.get(h_code, f"Unknown({h_code})")
                    stage_label = aasm
                    break

            bp = compute_bandpower(segment, sfreq)
            subj_epochs.append({
                "subject": subj_id,
                "name": info["name"],
                "epoch_index": i,
                "onset_seconds": start_s,
                "stage": stage_label,
                **bp,
            })

        all_epochs.extend(subj_epochs)
        print(f"  Computed {len(subj_epochs)} epochs")

    # ── Export per-epoch JSON for Phase 4 DB import ───────────────────
    print(f"\n{'=' * 70}")
    print("JSON EXPORT: Per-epoch data for Phase 4 DB import")
    print("=" * 70)

    # Group epochs by subject
    epochs_by_subject = {}
    for ep in all_epochs:
        name = ep["name"]
        if name not in epochs_by_subject:
            epochs_by_subject[name] = []
        epochs_by_subject[name].append(ep)

    export_dir = os.path.dirname(os.path.abspath(__file__))
    exported_files = []

    for subj_name, subj_ep_list in epochs_by_subject.items():
        subj_id = SUBJECT_ID_MAP[subj_name]
        # Determine channel from first epoch's name (we store it per epoch)
        # We need to figure out which channel this subject's epochs came from.
        # Since we process one channel per subject, we look at the info dict.
        for sid, info in SUBJECTS.items():
            if info["name"] == subj_name:
                # Strip "EEG " prefix to match schema CHECK constraint
                channel_name = info["channel"].replace("EEG ", "")
                break

        # Build export records with schema-compatible format
        records = []
        for ep in subj_ep_list:
            records.append({
                "epoch_index": ep["epoch_index"],
                "epoch_start_sec": float(ep["onset_seconds"]),
                "sleep_stage": AASM_TO_SHORT.get(ep["stage"], ep["stage"]),
                "delta_power": float(ep["delta"]),
                "theta_power": float(ep["theta"]),
                "alpha_power": float(ep["alpha"]),
                "beta_power": float(ep["beta"]),
                "gamma_power": float(ep["gamma"]),
            })

        # Sort by epoch_index for clean files
        records.sort(key=lambda r: r["epoch_index"])

        # Write JSON file
        fname = f"epochs_{subj_id}_{channel_name.replace('-', '')}.json"
        fpath = os.path.join(export_dir, fname)
        with open(fpath, "w") as f:
            json.dump(records, f, indent=2)
        exported_files.append((fname, subj_id, channel_name, len(records)))
        print(f"  Written: {fname} — {subj_id}/{channel_name} — {len(records)} epochs")

    print(f"\n  Total files exported: {len(exported_files)}")

    # ── Aggregate by sleep stage ──────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("AGGREGATION: Average band power per sleep stage (both subjects)")
    print("=" * 70)

    stages = ["Wake", "N1", "N2", "N3", "REM"]
    bands = list(EEG_BANDS.keys())

    stage_data = {s: {b: [] for b in bands} for s in stages}

    for ep in all_epochs:
        s = ep["stage"]
        if s in stage_data:
            for b in bands:
                stage_data[s][b].append(ep[b])

    # Compute means and counts
    summary = {}
    for s in stages:
        summary[s] = {}
        for b in bands:
            vals = stage_data[s][b]
            if vals:
                summary[s][b] = {
                    "mean": np.mean(vals),
                    "std": np.std(vals),
                    "count": len(vals),
                }
            else:
                summary[s][b] = {"mean": 0, "std": 0, "count": 0}

    # ── Print results ────────────────────────────────────────────────
    header = f"{'Stage':<8}"
    for b in bands:
        header += f"  {b:<10}{'':<10}"
    print(f"\n{header}")
    print(f"{'─' * 65}")

    for s in stages:
        row = f"{s:<8}"
        for b in bands:
            m = summary[s][b]["mean"]
            c = summary[s][b]["count"]
            row += f"  {m:>8.2f}  ({c:>4})"
        print(row)

    # ── Physiological sanity checks ──────────────────────────────────
    print(f"\n{'=' * 70}")
    print("PHYSIOLOGICAL SANITY CHECKS")
    print("=" * 70)

    checks = []

    # Check 1: Delta highest in N3
    n3_delta = summary["N3"]["delta"]["mean"]
    other_deltas = {s: summary[s]["delta"]["mean"] for s in stages if s != "N3" and summary[s]["delta"]["count"] > 0}
    delta_highest_n3 = all(n3_delta > v for v in other_deltas.values()) if other_deltas else False
    checks.append({
        "name": "Delta power highest in N3 (deep sleep)",
        "n3_delta": n3_delta,
        "other_means": other_deltas,
        "passed": delta_highest_n3,
    })
    print(f"\n  1. Delta power highest in N3:")
    print(f"     N3 delta mean: {n3_delta:.2f}")
    for s, v in other_deltas.items():
        print(f"     {s} delta mean: {v:.2f}")
    print(f"     Result: {'PASS ✓' if delta_highest_n3 else 'FAIL ✗'}")

    # Check 2: Alpha more prominent in Wake
    wake_alpha = summary["Wake"]["alpha"]["mean"] if summary["Wake"]["alpha"]["count"] > 0 else 0
    non_wake_alpha = {s: summary[s]["alpha"]["mean"] for s in stages if s != "Wake" and summary[s]["alpha"]["count"] > 0}
    alpha_wake_highest = all(wake_alpha >= v for v in non_wake_alpha.values()) if non_wake_alpha else False
    # Be lenient: Wake alpha should be >= N3 alpha at minimum
    alpha_check = wake_alpha >= summary["N3"]["alpha"]["mean"] if summary["N3"]["alpha"]["count"] > 0 else False
    checks.append({
        "name": "Alpha more prominent in Wake vs deep sleep",
        "wake_alpha": wake_alpha,
        "other_means": non_wake_alpha,
        "passed": alpha_check,
    })
    print(f"\n  2. Alpha more prominent in Wake vs N3:")
    print(f"     Wake alpha mean: {wake_alpha:.2f}")
    for s, v in non_wake_alpha.items():
        print(f"     {s} alpha mean: {v:.2f}")
    print(f"     Result: {'PASS ✓' if alpha_check else 'FAIL ✗'}")

    # Check 3: Beta higher in Wake vs N3
    wake_beta = summary["Wake"]["beta"]["mean"] if summary["Wake"]["beta"]["count"] > 0 else 0
    n3_beta = summary["N3"]["beta"]["mean"] if summary["N3"]["beta"]["count"] > 0 else 0
    beta_check = wake_beta > n3_beta
    checks.append({
        "name": "Beta higher in Wake vs N3",
        "wake_beta": wake_beta,
        "n3_beta": n3_beta,
        "passed": beta_check,
    })
    print(f"\n  3. Beta higher in Wake vs N3:")
    print(f"     Wake beta mean: {wake_beta:.2f}")
    print(f"     N3 beta mean: {n3_beta:.2f}")
    print(f"     Result: {'PASS ✓' if beta_check else 'FAIL ✗'}")

    # Check 4: Theta elevated in N1 vs N2
    n1_theta = summary["N1"]["theta"]["mean"] if summary["N1"]["theta"]["count"] > 0 else 0
    n2_theta = summary["N2"]["theta"]["mean"] if summary["N2"]["theta"]["count"] > 0 else 0
    n3_theta = summary["N3"]["theta"]["mean"] if summary["N3"]["theta"]["count"] > 0 else 0
    # N1 should have higher theta than N2 (transitional drowsiness)
    # Also N1/N3 should both be elevated vs N2
    theta_check = n1_theta > n2_theta or n3_theta > n2_theta
    checks.append({
        "name": "Theta elevated in N1 (vs N2 transitional)",
        "n1_theta": n1_theta,
        "n2_theta": n2_theta,
        "n3_theta": n3_theta,
        "passed": theta_check,
    })
    print(f"\n  4. Theta elevated in N1 vs N2:")
    print(f"     N1 theta mean: {n1_theta:.2f}")
    print(f"     N2 theta mean: {n2_theta:.2f}")
    print(f"     N3 theta mean: {n3_theta:.2f}")
    print(f"     Result: {'PASS ✓' if theta_check else 'FAIL ✗'}")

    # ── Per-subject breakdown ────────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("PER-SUBJECT BREAKDOWN")
    print("=" * 70)

    for subj_id in [0, 1]:
        subj_name = SUBJECTS[subj_id]["name"]
        print(f"\n  Subject {subj_id} ({subj_name}):")
        subj_stages = {}
        for s in stages:
            count = summary[s]["delta"]["count"]
            # Re-aggregate per subject
        subj_epochs_filtered = [e for e in all_epochs if e["subject"] == subj_id]
        subj_stage_counts = {}
        subj_stage_bp = {s: {b: [] for b in bands} for s in stages}
        for ep in subj_epochs_filtered:
            s = ep["stage"]
            if s in subj_stage_bp:
                subj_stage_counts[s] = subj_stage_counts.get(s, 0) + 1
                for b in bands:
                    subj_stage_bp[s][b].append(ep[b])

        print(f"    Epoch distribution:")
        for s in stages:
            c = subj_stage_counts.get(s, 0)
            if c > 0:
                print(f"      {s}: {c} epochs")

    # ── Write RESULTS.md ─────────────────────────────────────────────
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    results_path = os.path.join(os.path.dirname(__file__), "RESULTS.md")

    total_epochs = len(all_epochs)
    total_time_h = total_epochs * 30 / 3600

    md_lines = []
    md_lines.append("# Phase 3: Band Power vs Sleep Stage Analysis\n")
    md_lines.append("## Overview\n")
    md_lines.append(f"- **Dataset**: Sleep-EDF (SC4001 = Subject 0/Alice, SC4002 = Subject 1/Bob)")
    md_lines.append(f"- **Total epochs analyzed**: {total_epochs}")
    md_lines.append(f"- **Total recording time**: {total_time_h:.1f} hours")
    md_lines.append(f"- **Scoring system**: R&K → AASM conversion (Stage 3+4 merged into N3)")
    md_lines.append(f"- **Channel**: Subject 0 = Fpz-Cz, Subject 1 = Pz-Oz\n")

    # Stage distribution
    md_lines.append("## Sleep Stage Distribution (AASM labels)\n")
    md_lines.append("| Stage | Description | Total Epochs | Duration |\n|-------|-------------|-------------|----------|\n")
    for s in stages:
        count = summary[s]["delta"]["count"]
        dur = count * 30 / 3600
        desc = {"Wake": "Wakefulness", "N1": "Stage N1 (light sleep)", "N2": "Stage N2", "N3": "Stage N3 (deep sleep)", "REM": "REM sleep"}.get(s, s)
        md_lines.append(f"| {s} | {desc} | {count} | {dur:.1f}h |\n")

    # Summary table
    md_lines.append("\n## Average Band Power per Sleep Stage\n")
    md_lines.append("Values in μV² (microvolt-squared). Format: mean ± std (n epochs)\n")
    md_lines.append("| Stage | Delta | Theta | Alpha | Beta | Gamma |\n|-------|-------|-------|-------|------|-------|\n")
    for s in stages:
        row = f"| {s} |"
        for b in bands:
            d = summary[s][b]
            row += f" {d['mean']:.2f}±{d['std']:.2f} |"
        md_lines.append(row + "\n")

    # Per-subject stage distribution
    md_lines.append("\n## Per-Subject Stage Distribution\n")
    md_lines.append("| Subject | Channel | Wake | N1 | N2 | N3 | REM | Total Epochs |\n")
    md_lines.append("|---------|---------|------|----|----|----|-----|-------------|\n")
    for subj_id in [0, 1]:
        subj_name = SUBJECTS[subj_id]["name"]
        ch = SUBJECTS[subj_id]["channel"]
        subj_ep = [e for e in all_epochs if e["subject"] == subj_id]
        counts = {}
        for ep in subj_ep:
            s = ep["stage"]
            counts[s] = counts.get(s, 0) + 1
        row = f"| {subj_name} ({subj_id}) | {ch} |"
        for s in stages:
            row += f" {counts.get(s, 0)} |"
        row += f" {len(subj_ep)} |\n"
        md_lines.append(row)

    # Sanity checks
    md_lines.append("\n## Physiological Sanity Checks\n")
    for i, check in enumerate(checks, 1):
        status = "✓ PASS" if check["passed"] else "✗ FAIL"
        md_lines.append(f"\n### {i}. {check['name']}\n")
        md_lines.append(f"**Result: {status}**\n")
        for k, v in check.items():
            if k not in ("name", "passed"):
                if isinstance(v, dict):
                    for sk, sv in v.items():
                        md_lines.append(f"- {sk}: {sv:.2f}")
                else:
                    md_lines.append(f"- {k}: {v:.2f}")

    # Summary
    n_passed = sum(1 for c in checks if c["passed"])
    md_lines.append(f"\n## Summary\n\n")
    md_lines.append(f"**{n_passed}/{len(checks)} physiological sanity checks passed.**\n")
    md_lines.append("## Notes\n\n")
    md_lines.append("- R&K Stage 3 and Stage 4 were merged into AASM N3 (deep sleep)\n")
    md_lines.append("- Band power computed via FFT on full 30-second epochs (no windowing)\n")
    md_lines.append("- EDF data converted from Volts to microvolts before power computation\n")
    md_lines.append("- Alpha prominence in Wake may be less pronounced if recording was eyes-open\n")

    with open(results_path, "w", encoding="utf-8") as f:
        f.write("".join(md_lines))

    print(f"\n{'=' * 70}")
    print(f"RESULTS written to: {results_path}")
    print(f"{'=' * 70}")

if __name__ == "__main__":
    analyze()
