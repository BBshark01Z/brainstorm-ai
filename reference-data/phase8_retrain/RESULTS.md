# Phase 8 Results: Retrain brain_state_model with Real Data (Subject-Held-Out)

**Date:** 2026-08-14
**Script:** `retrain_model.py` in this directory
**Model:** `brain_state_model_v2_test.joblib` (does NOT overwrite existing model)

---

## 1. Data

| Subject | ID | File | Epochs | Channel |
|---------|----|------|--------|---------|
| Alice | SC4001 | `epochs_SC4001_FpzCz.json` | 2650 | Fpz-Cz |
| Bob | SC4011 | `epochs_SC4011_PzOz.json` | 2802 | Pz-Oz |
| **Total** | | | **5452** | |

### Stage Distribution

| Stage | Alice | Bob |
|-------|-------|-----|
| W | 1997 | 1856 |
| N1 | 58 | 109 |
| N2 | 250 | 562 |
| N3 | 220 | 105 |
| REM | 125 | 170 |

**Features:** delta_power, theta_power, alpha_power, beta_power, gamma_power (5 band powers)
**Target:** Sleep stage (W, N1, N2, N3, REM — 5 classes)
**Model:** Random Forest (200 estimators, max_depth=30, balanced class weights)
**Scaling:** StandardScaler (fit on training data only)

---

## 2. Experiments Run

Four experiments were executed across two axes:

| Split Direction | Feature Type | Description |
|-----------------|-------------|-------------|
| Alice→Bob | Absolute power | Train on Alice (Fpz-Cz), test on Bob (Pz-Oz) |
| Bob→Alice | Absolute power | Train on Bob (Pz-Oz), test on Alice (Fpz-Cz) |
| Alice→Bob | Relative power | Each band / total power per epoch — removes absolute scale |
| Bob→Alice | Relative power | Same relative normalization, reverse split |

**Why relative power?** The root cause of poor cross-subject transfer is that delta power scale differs ~10x between subjects (Alice Fpz-Cz mean delta ~377 vs Bob Pz-Oz mean delta ~34). Relative power normalizes each epoch's bands to sum to 1, removing the absolute scale difference caused by different electrode positions.

---

## 3. Results Summary

### Accuracy Comparison

| Experiment | ML Accuracy | Rule-Based (nearest-centroid) |
|------------|------------|-------------------------------|
| **Absolute power, Alice→Bob** | 17.5% | 6.3% |
| **Absolute power, Bob→Alice** | 83.1% | 10.5% |
| **Relative power, Alice→Bob** | 21.7% | 13.7% |
| **Relative power, Bob→Alice** | 40.3% | 13.5% |
| **Random Forest (Phase 7, training acc)** | 97.6% | N/A |

### Key Observations

1. **Absolute power is asymmetric across directions.**
   - Alice→Bob: 17.5% — the model trained on frontal (Fpz-Cz) data fails on parieto-occipital (Pz-Oz) data.
   - Bob→Alice: 83.1% — surprisingly high, but **not genuine generalization**. The confusion matrix shows W (95% recall) and N3 (96% recall) transfer well because absolute power separates them, but REM gets 0% recall and N1 gets 12%. Macro-F1 is only 0.42. The model is still exploiting channel signature, not learning stage-invariant features.

2. **Relative power helps in the failing direction but hurts in the "working" direction.**
   - Alice→Bob: 21.7% vs 17.5% absolute (+4.2 pts) — modest improvement, still near chance.
   - Bob→Alice: 40.3% vs 83.1% absolute (−42.8 pts) — relative power destroys the absolute-scale separation that was driving the high accuracy.
   - This asymmetry confirms the problem is channel-dependent, not stage-dependent.

3. **Rule-based nearest-centroid baseline (39.0% from Phase 7) is consistently around 6–14% across all experiments.**
   - The centroid baseline is weak because per-stage centroids computed from one subject's channel don't transfer to another's.
   - Neither the ML model nor the rule baseline achieves reliable cross-channel generalization.

---

## 4. Detailed Results by Experiment

### 4.1 Absolute Power — Alice→Bob

| Metric | Value |
|--------|-------|
| Accuracy | 0.1749 (17.5%) |
| Rule-based accuracy | 0.0632 (6.3%) |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | 114 | 1333 | 13 | 0 | 396 |
| N1 | 6 | 15 | 16 | 0 | 72 |
| N2 | 2 | 8 | 195 | 0 | 357 |
| N3 | 1 | 0 | 102 | 0 | 2 |
| REM | 1 | 1 | 2 | 0 | 166 |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | 0.9194 | 0.0614 | 0.1152 | 1856 |
| N1 | 0.0111 | 0.1376 | 0.0205 | 109 |
| N2 | 0.5945 | 0.3470 | 0.4382 | 562 |
| N3 | 0.0000 | 0.0000 | 0.0000 | 105 |
| REM | 0.1672 | 0.9765 | 0.2855 | 170 |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
| delta_power | 0.3508 ############## |
| gamma_power | 0.2644 ########## |
| beta_power | 0.1858 ####### |
| theta_power | 0.1068 #### |
| alpha_power | 0.0922 ### |

**Classification Report:**
```
              precision    recall  f1-score   support

           W       0.92      0.06      0.12      1856
          N1       0.01      0.14      0.02       109
          N2       0.59      0.35      0.44       562
          N3       0.00      0.00      0.00       105
         REM       0.17      0.98      0.29       170

    accuracy                           0.17      2802
   macro avg       0.34      0.30      0.17      2802
weighted avg       0.74      0.17      0.18      2802

```

---

### 4.2 Absolute Power — Bob→Alice

| Metric | Value |
|--------|-------|
| Accuracy | 0.8313 (83.1%) |
| Rule-based accuracy | 0.1049 (10.5%) |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | 1906 | 18 | 25 | 48 | 0 |
| N1 | 17 | 7 | 29 | 5 | 0 |
| N2 | 7 | 2 | 78 | 163 | 0 |
| N3 | 7 | 0 | 1 | 212 | 0 |
| REM | 10 | 26 | 86 | 3 | 0 |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | 0.9789 | 0.9544 | 0.9665 | 1997 |
| N1 | 0.1321 | 0.1207 | 0.1261 | 58 |
| N2 | 0.3562 | 0.3120 | 0.3326 | 250 |
| N3 | 0.4919 | 0.9636 | 0.6513 | 220 |
| REM | 0.0000 | 0.0000 | 0.0000 | 125 |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
| beta_power | 0.2464 ######### |
| delta_power | 0.2440 ######### |
| gamma_power | 0.2432 ######### |
| theta_power | 0.2125 ######## |
| alpha_power | 0.0540 ## |

**Classification Report:**
```
              precision    recall  f1-score   support

           W       0.98      0.95      0.97      1997
          N1       0.13      0.12      0.13        58
          N2       0.36      0.31      0.33       250
          N3       0.49      0.96      0.65       220
         REM       0.00      0.00      0.00       125

    accuracy                           0.83      2650
   macro avg       0.39      0.47      0.42      2650
weighted avg       0.82      0.83      0.82      2650

```

---

### 4.3 Relative Power — Alice→Bob

| Metric | Value |
|--------|-------|
| Accuracy | 0.2170 (21.7%) |
| Rule-based accuracy | 0.1374 (13.7%) |
| vs Absolute (Alice→Bob) | ++0.0421 |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | 98 | 352 | 2 | 0 | 1404 |
| N1 | 22 | 44 | 8 | 1 | 34 |
| N2 | 3 | 52 | 312 | 4 | 191 |
| N3 | 1 | 0 | 56 | 47 | 1 |
| REM | 4 | 25 | 34 | 0 | 107 |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | 0.7656 | 0.0528 | 0.0988 | 1856 |
| N1 | 0.0930 | 0.4037 | 0.1512 | 109 |
| N2 | 0.7573 | 0.5552 | 0.6407 | 562 |
| N3 | 0.9038 | 0.4476 | 0.5987 | 105 |
| REM | 0.0616 | 0.6294 | 0.1122 | 170 |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
| gamma_power | 0.3176 ############ |
| delta_power | 0.1925 ####### |
| beta_power | 0.1898 ####### |
| alpha_power | 0.1643 ###### |
| theta_power | 0.1358 ##### |

**Classification Report:**
```
              precision    recall  f1-score   support

           W       0.77      0.05      0.10      1856
          N1       0.09      0.40      0.15       109
          N2       0.76      0.56      0.64       562
          N3       0.90      0.45      0.60       105
         REM       0.06      0.63      0.11       170

    accuracy                           0.22      2802
   macro avg       0.52      0.42      0.32      2802
weighted avg       0.70      0.22      0.23      2802

```

---

### 4.4 Relative Power — Bob→Alice

| Metric | Value |
|--------|-------|
| Accuracy | 0.4030 (40.3%) |
| Rule-based accuracy | 0.1355 (13.5%) |
| vs Absolute (Bob→Alice) | -0.4283 |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | 605 | 473 | 55 | 175 | 689 |
| N1 | 9 | 10 | 14 | 1 | 24 |
| N2 | 1 | 5 | 162 | 77 | 5 |
| N3 | 0 | 7 | 3 | 210 | 0 |
| REM | 3 | 24 | 16 | 1 | 81 |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | 0.9790 | 0.3030 | 0.4627 | 1997 |
| N1 | 0.0193 | 0.1724 | 0.0347 | 58 |
| N2 | 0.6480 | 0.6480 | 0.6480 | 250 |
| N3 | 0.4526 | 0.9545 | 0.6140 | 220 |
| REM | 0.1014 | 0.6480 | 0.1753 | 125 |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
| gamma_power | 0.4355 ################# |
| beta_power | 0.2534 ########## |
| alpha_power | 0.1514 ###### |
| delta_power | 0.0972 ### |
| theta_power | 0.0625 ## |

**Classification Report:**
```
              precision    recall  f1-score   support

           W       0.98      0.30      0.46      1997
          N1       0.02      0.17      0.03        58
          N2       0.65      0.65      0.65       250
          N3       0.45      0.95      0.61       220
         REM       0.10      0.65      0.18       125

    accuracy                           0.40      2650
   macro avg       0.44      0.55      0.39      2650
weighted avg       0.84      0.40      0.47      2650

```

---

## 5. Root Cause Analysis: Channel/Electrode-Position Domain Gap

### The Problem

Delta power differs ~10x between subjects due to channel/electrode position:
- **Alice (Fpz-Cz):** mean delta ~377
- **Bob (Pz-Oz):** mean delta ~34

Fpz-Cz is a frontal derivation (captures frontal delta strongly), while Pz-Oz is a parieto-occipital derivation (alpha-dominant, low delta). This is not a "sleep stage" signal — it's a **channel-position domain gap**.

### Why the ML Model Fails

The Random Forest learns to distinguish "which channel is this" rather than "what sleep stage is this." Raw absolute band power is dominated by the electrode position effect, so the model memorizes Alice's channel signature and fails on Bob's different channel.

### Why Relative Power Helps (Sometimes)

Relative power normalizes each epoch: `band_i / sum(all_bands)`. This removes the absolute scale, making the feature distribution more comparable across channels. If the *proportional* relationship between bands is preserved across channels for a given sleep stage, relative power can transfer better.

---

## 6. Conclusion

### With Only 2 Subjects on 2 Different Channels, This Setup Cannot Produce a Generalizable Model

**The channel-domain-gap is the fundamental blocker.** Even with relative power normalization:

- Absolute power Alice→Bob: 17.5% | Bob→Alice: 83.1% (macro-F1 0.42, REM 0% recall)
- Relative power Alice→Bob: 21.7% | Bob→Alice: 40.3%
- Rule-based nearest-centroid baseline: 39.0%

**No single split produces reliable generalization across all 5 stages.** Alice→Bob (absolute 17.5%, relative 21.7%) is near chance. Bob→Alice absolute power looks high (83.1%) but the macro-F1 is only 0.42 and REM gets 0% recall — the accuracy is driven by W (95% recall) and N3 (96% recall) while REM and N1 fail completely. Relative power helps the failing direction but hurts the "working" one. The ML model does not achieve consistent cross-channel generalization.

### Recommendation

1. **Fetch more subjects from Sleep-EDF** (Sleep-EDF-Expanded has ~153 subjects).
2. **Ideally, record all subjects on the same channel/electrode configuration** to eliminate the domain gap at the source. If that's not possible, use domain adaptation techniques (e.g., CORAL, MMD) or subject-specific calibration.
3. **Do NOT replace the existing `brain_state_model.joblib` yet.** This model was trained on synthetic data for brain state classification (focus/stress/relax), which is a different task from sleep staging. The v2 model here is for sleep stage classification — a different problem entirely.

### Saved Files

| File | Status |
|------|--------|
| `brain_state_model_v2_test.joblib` | Saved (relative power, Alice→Bob) — **does NOT overwrite existing model** |
| `RESULTS.md` | This file |

---

*Phase 8 complete. The channel-domain-gap finding is the valuable result: with only 2 subjects on 2 different channels, no generalizable model can be produced. More subjects (ideally same channel) are required before treating any retrained model as usable.*
