# Phase 1 Results — Sleep-EDF Dataset Loaded & Inspected

**Date:** 2026-08-12
**Script:** `load_sleep_edf.py` (top-level, outside neuropulse-backend / neuropulse-ai)

---

## Data Location & Size

- **Cache folder:** `C:\Users\User\mne_data`
- **Actual data path:** `C:\Users\User\mne_data\physionet-sleep-data\`
- **Total size on disk:** 94.8 MB (4 files)

The 4 files:

| Subject | File | Purpose |
|---------|------|---------|
| Alice (0) | `SC4001E0-PSG.edf` | Polysomnography recording (EEG + physiological signals) |
| Alice (0) | `SC4001EC-Hypnogram.edf` | Sleep stage annotations |
| Bob (1) | `SC4011E0-PSG.edf` | Polysomnography recording |
| Bob (1) | `SC4011EH-Hypnogram.edf` | Sleep stage annotations |

---

## Subject 0 (Alice) — Channel Inventory (7 channels)

| # | Name | Type |
|---|------|------|
| 0 | **Fpz-Cz** | EEG (frontopolar-central derivation) |
| 1 | **Pz-Oz** | EEG (parietal-occipital derivation) |
| 2 | horizontal | EOG (horizontal eye movement) |
| 3 | oro-nasal | Resp (respiratory airflow) |
| 4 | submental | EMG (chin muscle tone) |
| 5 | rectal | Temperature (rectal) |
| 6 | Event marker | Stim (annotation trigger channel) |

Two EEG channels — **Fpz-Cz** and **Pz-Oz** — which are the classic sleep-EEG derivations (AASM-standard).

---

## Recording Specs

- **Sampling frequency:** 100 Hz
- **Total duration:** ~22.08 hours (7,950,000 samples)
- **Subjects fetched:** 2 (subjects 0 and 1, recording 1 each)
- **Dataset:** Sleep Physionet (age subset), via `mne.datasets.sleep_physionet.age.fetch_data`

---

## Sleep Stage Annotations (154 segments total)

| Stage | Segments | % of total |
|-------|----------|------------|
| Stage 3 (N3 / deep sleep) | 48 | 31.2% |
| Stage 2 (N2) | 40 | 26.0% |
| Stage 1 (N1) | 24 | 15.6% |
| Stage 4 (N4 / deep sleep) | 23 | 14.9% |
| Wake (W) | 12 | 7.8% |
| REM (R) | 6 | 3.9% |
| Unscored (?) | 1 | 0.6% |

---

## First 10 Raw Signal Values (Fpz-Cz channel)

```
[0]  0.000005  µV
[1] -0.000003  µV
[2]  0.000001  µV
[3] -0.000002  µV
[4] -0.000005  µV
[5] -0.000007  µV
[6] -0.000008  µV
[7] -0.000007  µV
[8] -0.000004  µV
[9] -0.000001  µV
```

Real microvolt-scale signals — values are nanovolt-range in raw EDF (stored internally as volts). Data is clean and readable.

---

## Important: Scoring System Note

**This dataset uses the older Rechtschaffen & Kales (R&K) scoring system** (Stages 1–4 + REM + Wake), **not** the modern American Academy of Sleep Medicine (AASM) system (N1–N3 + REM + Wake).

The key difference:
- **R&K:** Stages 1, 2, 3, 4, REM, Wake (4 distinct non-REM stages)
- **AASM:** N1, N2, N3, REM, Wake (N3 = merged deep sleep)

**Phase 3 will need to merge Stage 3 + Stage 4 into a single "N3" label** to match standard AASM-based baselines for comparison later. This is a straightforward mapping:
- R&K Stage 3 → AASM N3 (when used alone)
- R&K Stage 4 → AASM N3 (when used alone)
- R&K Stage 3 + 4 → AASM N3

---

*Phase 1 complete. Awaiting go-ahead for Phase 2 (band power calculation).*
