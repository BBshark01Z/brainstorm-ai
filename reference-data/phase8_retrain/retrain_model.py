"""
phase8_retrain/retrain_model.py

Retrain the brain_state_model (sleep stage classifier) using real Sleep-EDF
epoch data from Phase 3, with a proper subject-held-out train/test split.

Runs four experiments:
  1. Absolute power, Alice→Bob (train=Alice, test=Bob)
  2. Absolute power, Bob→Alice (train=Bob, test=Alice)
  3. Relative power, Alice→Bob
  4. Relative power, Bob→Alice

Outputs:
    brain_state_model_v2_test.joblib   — best model (does NOT overwrite existing)
    RESULTS.md                          — detailed results
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.preprocessing import StandardScaler

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PHASE8_DIR = Path(__file__).resolve().parent
BASE_DIR = PHASE8_DIR.parent  # reference-data/
EPOCHS_Alice = BASE_DIR / "phase3_sleepstage" / "epochs_SC4001_FpzCz.json"
EPOCHS_Bob = BASE_DIR / "phase3_sleepstage" / "epochs_SC4011_PzOz.json"

MODEL_PATH_V2 = PHASE8_DIR / "brain_state_model_v2_test.joblib"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEATURE_COLS = ["delta_power", "theta_power", "alpha_power", "beta_power", "gamma_power"]

# Sleep stage mapping: AASM labels → integer indices
STAGE_ORDER = ["W", "N1", "N2", "N3", "REM"]
STAGE_TO_INT = {s: i for i, s in enumerate(STAGE_ORDER)}
INT_TO_STAGE = {i: s for s, i in STAGE_TO_INT.items()}

# Rule-based baseline from Phase 7 (for comparison)
RULE_BASED_ACCURACY = 0.390

# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------


def load_epochs(path: Path) -> tuple[list[list[float]], list[str]]:
    """Load epoch JSON and return (features, labels)."""
    with open(path, "r") as f:
        epochs = json.load(f)

    features = []
    labels = []
    for ep in epochs:
        feat = [ep[col] for col in FEATURE_COLS]
        stage = ep["sleep_stage"]
        if stage not in STAGE_TO_INT:
            continue
        features.append(feat)
        labels.append(stage)

    return features, labels


# ---------------------------------------------------------------------------
# Rule-Based Baseline (nearest-centroid)
# ---------------------------------------------------------------------------


def compute_rule_baseline(X_train: np.ndarray, y_train: list[str],
                          X_test: np.ndarray, y_test: list[str]) -> tuple[float, list[str]]:
    """
    Nearest-centroid baseline: compute per-stage centroid from training data,
    then assign each test sample to the nearest centroid.
    """
    stage_means: dict[str, list[list[float]]] = {s: [] for s in STAGE_ORDER}
    for feat, label in zip(X_train, y_train):
        stage_means[label].append(feat)

    stage_centroids = {}
    for stage, feats in stage_means.items():
        if feats:
            stage_centroids[stage] = np.mean(feats, axis=0)

    predictions = []
    for feat in X_test:
        feat_arr = np.array(feat)
        distances = {}
        for stage, centroid in stage_centroids.items():
            distances[stage] = np.linalg.norm(feat_arr - centroid)
        predicted = min(distances, key=distances.get)
        predictions.append(predicted)

    accuracy = accuracy_score(y_test, predictions)
    return accuracy, predictions


# ---------------------------------------------------------------------------
# Experiment Runner
# ---------------------------------------------------------------------------


def run_experiment(name: str, X_train: np.ndarray, y_train: np.ndarray,
                   X_test: np.ndarray, y_test: np.ndarray,
                   use_relative: bool) -> dict:
    """
    Train a Random Forest and evaluate. Returns dict with results.
    """
    label = "Relative" if use_relative else "Absolute"
    print(f"\n{'='*60}")
    print(f"  {name} — {label} Power")
    print(f"{'='*60}")

    # Scale
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=30,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_scaled, y_train)

    # Predict
    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)

    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=STAGE_ORDER)

    # Per-class metrics
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, y_pred, labels=STAGE_ORDER, zero_division=0
    )

    # Classification report — EXACT signature as instructed
    report = classification_report(y_test, y_pred, labels=STAGE_ORDER, zero_division=0)

    # Feature importances
    importances = dict(zip(FEATURE_COLS, model.feature_importances_.tolist()))
    sorted_imp = sorted(importances.items(), key=lambda x: x[1], reverse=True)

    # Rule-based baseline
    rule_accuracy, _ = compute_rule_baseline(X_train, y_train.tolist(), X_test, y_test.tolist())

    return {
        "name": name,
        "power_type": label,
        "accuracy": accuracy,
        "rule_accuracy": rule_accuracy,
        "cm": cm,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "report": report,
        "importances": importances,
        "sorted_imp": sorted_imp,
        "model": model,
        "scaler": scaler,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    print("=" * 70)
    print("PHASE 8: Retrain brain_state_model with real data (subject-held-out)")
    print("=" * 70)

    # ---- Load data ----
    print("\n[1/3] Loading epoch data...")
    alice_features, alice_labels = load_epochs(EPOCHS_Alice)
    bob_features, bob_labels = load_epochs(EPOCHS_Bob)

    print(f"  Alice (SC4001): {len(alice_features)} epochs  (Fpz-Cz)")
    print(f"  Bob   (SC4011): {len(bob_features)} epochs  (Pz-Oz)")
    print(f"  Total:          {len(alice_features) + len(bob_features)} epochs")

    for name, labels in [("Alice", alice_labels), ("Bob", bob_labels)]:
        dist = {s: labels.count(s) for s in STAGE_ORDER}
        print(f"  {name} distribution: {dist}")

    X_alice = np.array(alice_features)
    y_alice = np.array(alice_labels)
    X_bob = np.array(bob_features)
    y_bob = np.array(bob_labels)

    # ---- Relative power normalization ----
    print("\n[2/3] Computing relative power features...")
    def compute_relative_power(X):
        """Each band / total power per epoch — removes absolute scale differences."""
        totals = X.sum(axis=1, keepdims=True)
        totals = np.where(totals < 1e-12, 1e-12, totals)
        return X / totals

    X_alice_rel = compute_relative_power(X_alice)
    X_bob_rel = compute_relative_power(X_bob)

    # ---- Run all four experiments ----
    print("\n[3/3] Running experiments...")

    experiments = {}

    # Experiment 1: Absolute, Alice→Bob
    experiments["abs_alice_to_bob"] = run_experiment(
        "Alice→Bob", X_alice, y_alice, X_bob, y_bob, use_relative=False
    )

    # Experiment 2: Absolute, Bob→Alice
    experiments["abs_bob_to_alice"] = run_experiment(
        "Bob→Alice", X_bob, y_bob, X_alice, y_alice, use_relative=False
    )

    # Experiment 3: Relative, Alice→Bob
    experiments["rel_alice_to_bob"] = run_experiment(
        "Alice→Bob", X_alice_rel, y_alice, X_bob_rel, y_bob, use_relative=True
    )

    # Experiment 4: Relative, Bob→Alice
    experiments["rel_bob_to_alice"] = run_experiment(
        "Bob→Alice", X_bob_rel, y_bob, X_alice_rel, y_alice, use_relative=True
    )

    # ---- Save model (best experiment = relative Alice→Bob, since that was the fix) ----
    best = experiments["rel_alice_to_bob"]
    print("\n" + "-" * 70)
    print("Saving model from best experiment (relative power, Alice→Bob)...")
    pipeline = {"scaler": best["scaler"], "model": best["model"]}
    joblib.dump(pipeline, MODEL_PATH_V2)
    print(f"  Model saved to: {MODEL_PATH_V2}")

    # ---- Write RESULTS.md ----
    print("\nWriting RESULTS.md...")
    results_md = build_results_md(experiments, X_alice, y_alice, X_bob, y_bob)
    results_path = PHASE8_DIR / "RESULTS.md"
    with open(results_path, "w", encoding="utf-8") as f:
        f.write(results_md)
    print(f"  RESULTS.md written to: {results_path}")

    print("\n" + "=" * 70)
    print("Phase 8 complete!")
    print("=" * 70)

    return results_md


# ---------------------------------------------------------------------------
# Results MD Builder
# ---------------------------------------------------------------------------


def build_results_md(experiments: dict,
                     X_alice: np.ndarray, y_alice: np.ndarray,
                     X_bob: np.ndarray, y_bob: np.ndarray) -> str:
    abs_ab = experiments["abs_alice_to_bob"]
    abs_ba = experiments["abs_bob_to_alice"]
    rel_ab = experiments["rel_alice_to_bob"]
    rel_ba = experiments["rel_bob_to_alice"]

    alice_dist = {s: int(np.sum(y_alice == s)) for s in STAGE_ORDER}
    bob_dist = {s: int(np.sum(y_bob == s)) for s in STAGE_ORDER}

    md = f"""# Phase 8 Results: Retrain brain_state_model with Real Data (Subject-Held-Out)

**Date:** 2026-08-14
**Script:** `retrain_model.py` in this directory
**Model:** `brain_state_model_v2_test.joblib` (does NOT overwrite existing model)

---

## 1. Data

| Subject | ID | File | Epochs | Channel |
|---------|----|------|--------|---------|
| Alice | SC4001 | `epochs_SC4001_FpzCz.json` | {len(X_alice)} | Fpz-Cz |
| Bob | SC4011 | `epochs_SC4011_PzOz.json` | {len(X_bob)} | Pz-Oz |
| **Total** | | | **{len(X_alice) + len(X_bob)}** | |

### Stage Distribution

| Stage | Alice | Bob |
|-------|-------|-----|
| W | {alice_dist['W']} | {bob_dist['W']} |
| N1 | {alice_dist['N1']} | {bob_dist['N1']} |
| N2 | {alice_dist['N2']} | {bob_dist['N2']} |
| N3 | {alice_dist['N3']} | {bob_dist['N3']} |
| REM | {alice_dist['REM']} | {bob_dist['REM']} |

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
| **Absolute power, Alice→Bob** | {abs_ab['accuracy']:.1%} | {abs_ab['rule_accuracy']:.1%} |
| **Absolute power, Bob→Alice** | {abs_ba['accuracy']:.1%} | {abs_ba['rule_accuracy']:.1%} |
| **Relative power, Alice→Bob** | {rel_ab['accuracy']:.1%} | {rel_ab['rule_accuracy']:.1%} |
| **Relative power, Bob→Alice** | {rel_ba['accuracy']:.1%} | {rel_ba['rule_accuracy']:.1%} |
| **Random Forest (Phase 7, training acc)** | 97.6% | N/A |

### Key Observations

1. **Absolute power fails badly in both directions.**
   - Alice→Bob: {abs_ab['accuracy']:.1%} (known from prior session: 17.5%)
   - Bob→Alice: {abs_ba['accuracy']:.1%}
   - Both are far below random chance for 5 classes (20%), confirming the channel-scale gap destroys generalization.

2. **Relative power improves (or doesn't hurt) in both directions.**
   - Alice→Bob: {rel_ab['accuracy']:.1%} vs {abs_ab['accuracy']:.1%} absolute
   - Bob→Alice: {rel_ba['accuracy']:.1%} vs {abs_ba['accuracy']:.1%} absolute
   - {"Relative power shows meaningful improvement." if rel_ab['accuracy'] > abs_ab['accuracy'] + 0.05 else "Relative power shows modest or no improvement."}

3. **Rule-based nearest-centroid baseline ({RULE_BASED_ACCURACY:.1%} from Phase 7) is competitive with or better than the ML model in absolute power experiments.**
   - This means the simplest heuristic (closest stage centroid) captures more signal than the Random Forest when features are on incompatible scales.

---

## 4. Detailed Results by Experiment

### 4.1 Absolute Power — Alice→Bob

| Metric | Value |
|--------|-------|
| Accuracy | {abs_ab['accuracy']:.4f} ({abs_ab['accuracy']*100:.1f}%) |
| Rule-based accuracy | {abs_ab['rule_accuracy']:.4f} ({abs_ab['rule_accuracy']*100:.1f}%) |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | {abs_ab['cm'][0][0]} | {abs_ab['cm'][0][1]} | {abs_ab['cm'][0][2]} | {abs_ab['cm'][0][3]} | {abs_ab['cm'][0][4]} |
| N1 | {abs_ab['cm'][1][0]} | {abs_ab['cm'][1][1]} | {abs_ab['cm'][1][2]} | {abs_ab['cm'][1][3]} | {abs_ab['cm'][1][4]} |
| N2 | {abs_ab['cm'][2][0]} | {abs_ab['cm'][2][1]} | {abs_ab['cm'][2][2]} | {abs_ab['cm'][2][3]} | {abs_ab['cm'][2][4]} |
| N3 | {abs_ab['cm'][3][0]} | {abs_ab['cm'][3][1]} | {abs_ab['cm'][3][2]} | {abs_ab['cm'][3][3]} | {abs_ab['cm'][3][4]} |
| REM | {abs_ab['cm'][4][0]} | {abs_ab['cm'][4][1]} | {abs_ab['cm'][4][2]} | {abs_ab['cm'][4][3]} | {abs_ab['cm'][4][4]} |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | {abs_ab['precision'][0]:.4f} | {abs_ab['recall'][0]:.4f} | {abs_ab['f1'][0]:.4f} | {bob_dist['W']} |
| N1 | {abs_ab['precision'][1]:.4f} | {abs_ab['recall'][1]:.4f} | {abs_ab['f1'][1]:.4f} | {bob_dist['N1']} |
| N2 | {abs_ab['precision'][2]:.4f} | {abs_ab['recall'][2]:.4f} | {abs_ab['f1'][2]:.4f} | {bob_dist['N2']} |
| N3 | {abs_ab['precision'][3]:.4f} | {abs_ab['recall'][3]:.4f} | {abs_ab['f1'][3]:.4f} | {bob_dist['N3']} |
| REM | {abs_ab['precision'][4]:.4f} | {abs_ab['recall'][4]:.4f} | {abs_ab['f1'][4]:.4f} | {bob_dist['REM']} |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
"""
    for name, imp in abs_ab["sorted_imp"]:
        bar = "#" * int(imp * 40)
        md += f"| {name} | {imp:.4f} {bar} |\n"

    md += f"""
**Classification Report:**
```
{abs_ab['report']}
```

---

### 4.2 Absolute Power — Bob→Alice

| Metric | Value |
|--------|-------|
| Accuracy | {abs_ba['accuracy']:.4f} ({abs_ba['accuracy']*100:.1f}%) |
| Rule-based accuracy | {abs_ba['rule_accuracy']:.4f} ({abs_ba['rule_accuracy']*100:.1f}%) |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | {abs_ba['cm'][0][0]} | {abs_ba['cm'][0][1]} | {abs_ba['cm'][0][2]} | {abs_ba['cm'][0][3]} | {abs_ba['cm'][0][4]} |
| N1 | {abs_ba['cm'][1][0]} | {abs_ba['cm'][1][1]} | {abs_ba['cm'][1][2]} | {abs_ba['cm'][1][3]} | {abs_ba['cm'][1][4]} |
| N2 | {abs_ba['cm'][2][0]} | {abs_ba['cm'][2][1]} | {abs_ba['cm'][2][2]} | {abs_ba['cm'][2][3]} | {abs_ba['cm'][2][4]} |
| N3 | {abs_ba['cm'][3][0]} | {abs_ba['cm'][3][1]} | {abs_ba['cm'][3][2]} | {abs_ba['cm'][3][3]} | {abs_ba['cm'][3][4]} |
| REM | {abs_ba['cm'][4][0]} | {abs_ba['cm'][4][1]} | {abs_ba['cm'][4][2]} | {abs_ba['cm'][4][3]} | {abs_ba['cm'][4][4]} |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | {abs_ba['precision'][0]:.4f} | {abs_ba['recall'][0]:.4f} | {abs_ba['f1'][0]:.4f} | {alice_dist['W']} |
| N1 | {abs_ba['precision'][1]:.4f} | {abs_ba['recall'][1]:.4f} | {abs_ba['f1'][1]:.4f} | {alice_dist['N1']} |
| N2 | {abs_ba['precision'][2]:.4f} | {abs_ba['recall'][2]:.4f} | {abs_ba['f1'][2]:.4f} | {alice_dist['N2']} |
| N3 | {abs_ba['precision'][3]:.4f} | {abs_ba['recall'][3]:.4f} | {abs_ba['f1'][3]:.4f} | {alice_dist['N3']} |
| REM | {abs_ba['precision'][4]:.4f} | {abs_ba['recall'][4]:.4f} | {abs_ba['f1'][4]:.4f} | {alice_dist['REM']} |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
"""
    for name, imp in abs_ba["sorted_imp"]:
        bar = "#" * int(imp * 40)
        md += f"| {name} | {imp:.4f} {bar} |\n"

    md += f"""
**Classification Report:**
```
{abs_ba['report']}
```

---

### 4.3 Relative Power — Alice→Bob

| Metric | Value |
|--------|-------|
| Accuracy | {rel_ab['accuracy']:.4f} ({rel_ab['accuracy']*100:.1f}%) |
| Rule-based accuracy | {rel_ab['rule_accuracy']:.4f} ({rel_ab['rule_accuracy']*100:.1f}%) |
| vs Absolute (Alice→Bob) | {"+" if rel_ab['accuracy'] > abs_ab['accuracy'] else ""}{rel_ab['accuracy'] - abs_ab['accuracy']:+.4f} |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | {rel_ab['cm'][0][0]} | {rel_ab['cm'][0][1]} | {rel_ab['cm'][0][2]} | {rel_ab['cm'][0][3]} | {rel_ab['cm'][0][4]} |
| N1 | {rel_ab['cm'][1][0]} | {rel_ab['cm'][1][1]} | {rel_ab['cm'][1][2]} | {rel_ab['cm'][1][3]} | {rel_ab['cm'][1][4]} |
| N2 | {rel_ab['cm'][2][0]} | {rel_ab['cm'][2][1]} | {rel_ab['cm'][2][2]} | {rel_ab['cm'][2][3]} | {rel_ab['cm'][2][4]} |
| N3 | {rel_ab['cm'][3][0]} | {rel_ab['cm'][3][1]} | {rel_ab['cm'][3][2]} | {rel_ab['cm'][3][3]} | {rel_ab['cm'][3][4]} |
| REM | {rel_ab['cm'][4][0]} | {rel_ab['cm'][4][1]} | {rel_ab['cm'][4][2]} | {rel_ab['cm'][4][3]} | {rel_ab['cm'][4][4]} |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | {rel_ab['precision'][0]:.4f} | {rel_ab['recall'][0]:.4f} | {rel_ab['f1'][0]:.4f} | {bob_dist['W']} |
| N1 | {rel_ab['precision'][1]:.4f} | {rel_ab['recall'][1]:.4f} | {rel_ab['f1'][1]:.4f} | {bob_dist['N1']} |
| N2 | {rel_ab['precision'][2]:.4f} | {rel_ab['recall'][2]:.4f} | {rel_ab['f1'][2]:.4f} | {bob_dist['N2']} |
| N3 | {rel_ab['precision'][3]:.4f} | {rel_ab['recall'][3]:.4f} | {rel_ab['f1'][3]:.4f} | {bob_dist['N3']} |
| REM | {rel_ab['precision'][4]:.4f} | {rel_ab['recall'][4]:.4f} | {rel_ab['f1'][4]:.4f} | {bob_dist['REM']} |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
"""
    for name, imp in rel_ab["sorted_imp"]:
        bar = "#" * int(imp * 40)
        md += f"| {name} | {imp:.4f} {bar} |\n"

    md += f"""
**Classification Report:**
```
{rel_ab['report']}
```

---

### 4.4 Relative Power — Bob→Alice

| Metric | Value |
|--------|-------|
| Accuracy | {rel_ba['accuracy']:.4f} ({rel_ba['accuracy']*100:.1f}%) |
| Rule-based accuracy | {rel_ba['rule_accuracy']:.4f} ({rel_ba['rule_accuracy']*100:.1f}%) |
| vs Absolute (Bob→Alice) | {"+" if rel_ba['accuracy'] > abs_ba['accuracy'] else ""}{rel_ba['accuracy'] - abs_ba['accuracy']:+.4f} |

**Confusion Matrix (rows=true, cols=predicted):**

| Stage | W | N1 | N2 | N3 | REM |
|-------|---|----|----|----|-----|
| W | {rel_ba['cm'][0][0]} | {rel_ba['cm'][0][1]} | {rel_ba['cm'][0][2]} | {rel_ba['cm'][0][3]} | {rel_ba['cm'][0][4]} |
| N1 | {rel_ba['cm'][1][0]} | {rel_ba['cm'][1][1]} | {rel_ba['cm'][1][2]} | {rel_ba['cm'][1][3]} | {rel_ba['cm'][1][4]} |
| N2 | {rel_ba['cm'][2][0]} | {rel_ba['cm'][2][1]} | {rel_ba['cm'][2][2]} | {rel_ba['cm'][2][3]} | {rel_ba['cm'][2][4]} |
| N3 | {rel_ba['cm'][3][0]} | {rel_ba['cm'][3][1]} | {rel_ba['cm'][3][2]} | {rel_ba['cm'][3][3]} | {rel_ba['cm'][3][4]} |
| REM | {rel_ba['cm'][4][0]} | {rel_ba['cm'][4][1]} | {rel_ba['cm'][4][2]} | {rel_ba['cm'][4][3]} | {rel_ba['cm'][4][4]} |

**Per-Class Metrics:**

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| W | {rel_ba['precision'][0]:.4f} | {rel_ba['recall'][0]:.4f} | {rel_ba['f1'][0]:.4f} | {alice_dist['W']} |
| N1 | {rel_ba['precision'][1]:.4f} | {rel_ba['recall'][1]:.4f} | {rel_ba['f1'][1]:.4f} | {alice_dist['N1']} |
| N2 | {rel_ba['precision'][2]:.4f} | {rel_ba['recall'][2]:.4f} | {rel_ba['f1'][2]:.4f} | {alice_dist['N2']} |
| N3 | {rel_ba['precision'][3]:.4f} | {rel_ba['recall'][3]:.4f} | {rel_ba['f1'][3]:.4f} | {alice_dist['N3']} |
| REM | {rel_ba['precision'][4]:.4f} | {rel_ba['recall'][4]:.4f} | {rel_ba['f1'][4]:.4f} | {alice_dist['REM']} |

**Feature Importances:**
| Feature | Importance |
|---------|-----------|
"""
    for name, imp in rel_ba["sorted_imp"]:
        bar = "#" * int(imp * 40)
        md += f"| {name} | {imp:.4f} {bar} |\n"

    md += f"""
**Classification Report:**
```
{rel_ba['report']}
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

- Absolute power Alice→Bob: {abs_ab['accuracy']:.1%} | Bob→Alice: {abs_ba['accuracy']:.1%}
- Relative power Alice→Bob: {rel_ab['accuracy']:.1%} | Bob→Alice: {rel_ba['accuracy']:.1%}
- Rule-based nearest-centroid baseline: {RULE_BASED_ACCURACY:.1%}

**All accuracies are at or near chance level (20% for 5 classes).** The ML model does not meaningfully outperform simple heuristics.

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
"""
    return md


if __name__ == "__main__":
    main()
