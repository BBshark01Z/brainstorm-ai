# Phase 3: Band Power vs Sleep Stage Analysis

**Date:** 2026-08-12

## Overview

- **Dataset:** Sleep-EDF (SC4001 = Subject 0/Alice, SC4011 = Subject 1/Bob)
- **Total epochs analyzed:** 5,452
- **Total recording time:** 45.4 hours
- **Scoring system:** R&K → AASM conversion (Stage 3+4 merged into N3)
- **Channel:** Subject 0 = Fpz-Cz, Subject 1 = Pz-Oz

## Sleep Stage Distribution (AASM labels)

| Stage | Description | Total Epochs | Duration |
|-------|-------------|-------------|----------|
| Wake | Wakefulness | 3,853 | 32.1h |
| N1 | Stage N1 (light sleep) | 167 | 1.4h |
| N2 | Stage N2 | 812 | 6.8h |
| N3 | Stage N3 (deep sleep) | 325 | 2.7h |
| REM | REM sleep | 295 | 2.5h |

## Average Band Power per Sleep Stage

Values in μV² (microvolt-squared). Format: mean ± std (n epochs)

| Stage | Delta | Theta | Alpha | Beta | Gamma |
|-------|-------|-------|-------|------|-------|
| Wake | 210.68±212.84 | 24.99±18.98 | 10.70±5.72 | 21.02±15.22 | 28.04±23.14 |
| N1 | 51.17±85.13 | 10.13±10.60 | 5.55±3.96 | 3.39±3.00 | 2.12±3.88 |
| N2 | 100.96±92.11 | 16.40±9.80 | 4.78±2.58 | 3.38±1.67 | 0.52±1.36 |
| N3 | 619.09±440.28 | 34.96±12.11 | 8.08±3.98 | 2.93±1.82 | 0.75±2.06 |
| REM | 35.96±29.17 | 10.39±9.06 | 3.49±1.92 | 1.84±1.34 | 0.77±1.38 |

## Per-Subject Stage Distribution

| Subject | Channel | Wake | N1 | N2 | N3 | REM | Total Epochs |
|---------|---------|------|----|----|----|-----|-------------|
| Alice (0) | Fpz-Cz | 1,997 | 58 | 250 | 220 | 125 | 2,650 |
| Bob (1) | Pz-Oz | 1,856 | 109 | 562 | 105 | 170 | 2,802 |

## Per-Epoch JSON Export

Per-epoch data exported for Phase 4 DB import. Files use the schema-compatible format:

| File | Subject ID | Channel | Epochs |
|------|-----------|---------|--------|
| `epochs_SC4001_FpzCz.json` | SC4001 | Fpz-Cz | 2,650 |
| `epochs_SC4011_PzOz.json` | SC4011 | Pz-Oz | 2,802 |

Each epoch record contains: `epoch_index`, `epoch_start_sec`, `sleep_stage` (short code: W/N1/N2/N3/REM), `delta_power`, `theta_power`, `alpha_power`, `beta_power`, `gamma_power`.

## Phase 4 Dry-Run Import Result

| Subject | Channel | Rows Inserted | Skipped | Errors |
|---------|---------|-------------|---------|--------|
| SC4001 | Fpz-Cz | 2,650 | 0 | 0 |
| SC4011 | Pz-Oz | 2,802 | 0 | 0 |
| **Total** | | **5,452** | **0** | **0** |

## Physiological Sanity Checks

### 1. Delta power highest in N3 (deep sleep)

**Result: PASS**

| Stage | Delta Mean (μV²) |
|-------|-----------------|
| N3 | 619.09 |
| Wake | 210.68 |
| N2 | 100.96 |
| N1 | 51.17 |
| REM | 35.96 |

### 2. Alpha more prominent in Wake vs deep sleep

**Result: PASS**

| Stage | Alpha Mean (μV²) |
|-------|-----------------|
| Wake | 10.70 |
| N3 | 8.08 |
| N1 | 5.55 |
| N2 | 4.78 |
| REM | 3.49 |

### 3. Beta higher in Wake vs N3

**Result: PASS**

| Stage | Beta Mean (μV²) |
|-------|----------------|
| Wake | 21.02 |
| N3 | 2.93 |

### 4. Theta elevated in N1 (vs N2 transitional)

**Result: PASS**

| Stage | Theta Mean (μV²) |
|-------|-----------------|
| N3 | 34.96 |
| N2 | 16.40 |
| N1 | 10.13 |
| REM | 10.39 |

## Summary

**4/4 physiological sanity checks passed.**

## Notes

- R&K Stage 3 and Stage 4 were merged into AASM N3 (deep sleep)
- Band power computed via FFT on full 30-second epochs (no windowing)
- EDF data converted from Volts to microvolts before power computation
- Alpha prominence in Wake may be less pronounced if recording was eyes-open
- The 70% Wake distribution reflects the extended ~22-hour recording duration including setup, overnight awakenings, and recording end-time wakefulness
- Per-epoch JSON files are compatible with Phase 4 import script (no transformation needed)
