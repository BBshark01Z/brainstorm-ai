"""
ml/train_brain_model.py

Train a Random Forest model to classify brain states (Focus / Stress / Relax)
from EEG biomarkers.

Usage:
    cd neuropulse-backend
    python ml/train_brain_model.py

Output:
    models/brain_state_model.joblib  — serialized sklearn pipeline
    models/model_metrics.json        — training / validation metrics
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent  # neuropulse-backend/
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

MODEL_PATH = MODELS_DIR / "brain_state_model.joblib"
METRICS_PATH = MODELS_DIR / "model_metrics.json"

# ---------------------------------------------------------------------------
# Synthetic EEG Dataset Generator
# ---------------------------------------------------------------------------


def generate_synthetic_dataset(
    n_samples: int = 5000,
    seed: int = 42,
) -> tuple[list[dict], list[str]]:
    """
    Generate synthetic EEG biomarker data with labeled brain states.

    Brain state profiles (mean ± std per band power):
        Focus:    High Beta, Moderate Alpha, Low Theta, Low Gamma
        Stress:   Very High Beta, Very Low Alpha, High Theta, High Gamma
        Relax:    High Alpha, Low Beta, Low Theta, Moderate Gamma

    Returns
    -------
    features : list[dict]
        Each dict has keys: delta, theta, alpha, beta, gamma, focus_index,
        stress_index, relaxation_index
    labels   : list[str]
        One of "focus", "stress", "relax"
    """
    rng = np.random.RandomState(seed)

    # Profile definitions: (delta, theta, alpha, beta, gamma) as (mean, std)
    profiles = {
        "focus": {
            "delta": (0.08, 0.02),
            "theta": (0.15, 0.04),
            "alpha": (0.25, 0.05),
            "beta":  (0.40, 0.08),
            "gamma": (0.12, 0.03),
        },
        "stress": {
            "delta": (0.10, 0.03),
            "theta": (0.30, 0.06),
            "alpha": (0.10, 0.03),
            "beta":  (0.45, 0.10),
            "gamma": (0.20, 0.05),
        },
        "relax": {
            "delta": (0.12, 0.03),
            "theta": (0.18, 0.04),
            "alpha": (0.50, 0.08),
            "beta":  (0.15, 0.04),
            "gamma": (0.08, 0.02),
        },
    }

    samples_per_state = n_samples // len(profiles)
    features: list[dict] = []
    labels: list[str] = []

    for state_name, profile in profiles.items():
        for _ in range(samples_per_state):
            # Sample band powers from Gaussian profiles
            band_power = {}
            for band, (mean, std) in profile.items():
                val = max(0.0, rng.normal(mean, std))
                band_power[band] = round(val, 6)

            # Normalize so they sum to 1.0 (relative power)
            total = sum(band_power.values())
            if total > 1e-12:
                band_power = {k: round(v / total, 6) for k, v in band_power.items()}

            # Compute biomarkers from band powers
            theta = band_power.get("theta", 0.0)
            alpha = band_power.get("alpha", 0.0)
            beta = band_power.get("beta", 0.0)
            gamma = band_power.get("gamma", 0.0)
            delta = band_power.get("delta", 0.0)

            focus_idx = beta / (theta + alpha) if (theta + alpha) > 1e-12 else 0.0
            high_beta = beta * 0.6
            stress_idx = high_beta / alpha if alpha > 1e-12 else 0.0
            total_power = sum(band_power.values())
            relax_idx = alpha / total_power if total_power > 1e-12 else 0.0

            features.append({
                "delta": delta,
                "theta": theta,
                "alpha": alpha,
                "beta": beta,
                "gamma": gamma,
                "focus_index": round(focus_idx, 6),
                "stress_index": round(stress_idx, 6),
                "relaxation_index": round(relax_idx, 6),
            })
            labels.append(state_name)

    # Shuffle deterministically
    indices = list(range(len(features)))
    rng.shuffle(indices)
    features = [features[i] for i in indices]
    labels = [labels[i] for i in indices]

    return features, labels


# ---------------------------------------------------------------------------
# Feature Engineering
# ---------------------------------------------------------------------------

FEATURE_COLUMNS = [
    "delta", "theta", "alpha", "beta", "gamma",
    "focus_index", "stress_index", "relaxation_index",
]


def features_to_array(feature_dicts: list[dict]) -> np.ndarray:
    """Convert list of feature dicts to a 2-D numpy array."""
    return np.array([
        [f.get(col, 0.0) for col in FEATURE_COLUMNS]
        for f in feature_dicts
    ])


# ---------------------------------------------------------------------------
# Training Pipeline
# ---------------------------------------------------------------------------


def train_model(
    n_samples: int = 5000,
    test_size: float = 0.2,
    cv_folds: int = 5,
) -> dict:
    """
    Full training pipeline: generate data → scale → train Random Forest → evaluate.

    Returns
    -------
    metrics : dict
        Training and cross-validation metrics.
    """
    print("=" * 60)
    print("NeuroPulse Brain State Classifier — Training Pipeline")
    print("=" * 60)

    # 1. Generate synthetic data
    print("\n[1/5] Generating synthetic EEG dataset...")
    features, labels = generate_synthetic_dataset(n_samples=n_samples)
    X = features_to_array(features)
    y = np.array(labels)
    print(f"  Total samples: {len(y)}")
    print(f"  Features per sample: {X.shape[1]}")
    for state in ["focus", "stress", "relax"]:
        count = np.sum(y == state)
        print(f"    {state}: {count} ({count / len(y) * 100:.1f}%)")

    # 2. Train / test split
    print(f"\n[2/5] Splitting data (test_size={test_size})...")
    split_idx = int(len(X) * (1 - test_size))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    print(f"  Train: {len(y_train)}, Test: {len(y_test)}")

    # 3. Scale features
    print("\n[3/5] Standardizing features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # 4. Train Random Forest
    print("\n[4/5] Training Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=20,
        min_samples_split=5,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_scaled, y_train)

    # 5. Evaluate
    print("\n[5/5] Evaluating model...")
    y_pred = model.predict(X_test_scaled)

    accuracy = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average="macro")
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=cv_folds, scoring="f1_macro")

    print(f"\n  Test Accuracy:  {accuracy:.4f}")
    print(f"  Test F1 (macro): {f1_macro:.4f}")
    print(f"  CV F1: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")

    print(f"\n  Classification Report:")
    report = classification_report(y_test, y_pred, output_dict=True)
    print(classification_report(y_test, y_pred))

    # Feature importances
    importances = dict(zip(FEATURE_COLUMNS, model.feature_importances_.tolist()))
    sorted_importance = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    print("\n  Feature Importances:")
    for name, imp in sorted_importance:
        bar = "#" * int(imp * 50)
        print(f"    {name:25s} {imp:.4f} {bar}")

    # -----------------------------------------------------------------------
    # Serialize model + scaler
    # -----------------------------------------------------------------------
    pipeline = {
        "scaler": scaler,
        "model": model,
    }
    joblib.dump(pipeline, MODEL_PATH)
    print(f"\n  Model saved to: {MODEL_PATH}")

    # -----------------------------------------------------------------------
    # Save metrics
    # -----------------------------------------------------------------------
    metrics = {
        "n_samples": len(y),
        "n_features": X.shape[1],
        "feature_columns": FEATURE_COLUMNS,
        "train_size": len(y_train),
        "test_size": len(y_test),
        "test_accuracy": round(accuracy, 4),
        "test_f1_macro": round(f1_macro, 4),
        "cv_f1_mean": round(cv_scores.mean(), 4),
        "cv_f1_std": round(cv_scores.std(), 4),
        "cv_folds": cv_folds,
        "classification_report": report,
        "feature_importances": {k: round(v, 6) for k, v in importances.items()},
        "model_params": {
            "n_estimators": 200,
            "max_depth": 20,
            "min_samples_split": 5,
            "min_samples_leaf": 2,
            "class_weight": "balanced",
        },
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2, ensure_ascii=False)
    print(f"  Metrics saved to: {METRICS_PATH}")

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)

    return metrics


# ---------------------------------------------------------------------------
# Inference Helper (for quick testing)
# ---------------------------------------------------------------------------


def predict_brain_state(
    band_power: dict[str, float],
    model_path: str | None = None,
) -> dict:
    """
    Quick inference: given band_power dict, predict brain state.

    Useful for testing the trained model outside of the web server.
    """
    if model_path is None:
        model_path = str(MODEL_PATH)

    pipeline = joblib.load(model_path)
    scaler: StandardScaler = pipeline["scaler"]
    model: RandomForestClassifier = pipeline["model"]

    # Compute biomarkers
    theta = band_power.get("theta", 0.0)
    alpha = band_power.get("alpha", 0.0)
    beta = band_power.get("beta", 0.0)
    gamma = band_power.get("gamma", 0.0)
    delta = band_power.get("delta", 0.0)

    focus_idx = beta / (theta + alpha) if (theta + alpha) > 1e-12 else 0.0
    high_beta = beta * 0.6
    stress_idx = high_beta / alpha if alpha > 1e-12 else 0.0
    total_power = sum(band_power.values())
    relax_idx = alpha / total_power if total_power > 1e-12 else 0.0

    feature_vec = np.array([[
        delta, theta, alpha, beta, gamma,
        focus_idx, stress_idx, relax_idx,
    ]])

    X_scaled = scaler.transform(feature_vec)
    prediction = model.predict(X_scaled)[0]
    probabilities = model.predict_proba(X_scaled)[0]
    classes = model.classes_

    return {
        "brain_state": prediction,
        "confidence": round(float(max(probabilities)), 4),
        "probabilities": {
            cls: round(float(p), 4) for cls, p in zip(classes, probabilities)
        },
        "biomarkers": {
            "focus_index": round(focus_idx, 6),
            "stress_index": round(stress_idx, 6),
            "relaxation_index": round(relax_idx, 6),
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Optional: quick test mode — python train_brain_model.py --test
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        # Train first, then test inference
        train_model()
        print("\n--- Quick Inference Test ---")
        # Simulate a "focus" state
        test_bands = {"delta": 0.05, "theta": 0.10, "alpha": 0.25, "beta": 0.50, "gamma": 0.10}
        result = predict_brain_state(test_bands)
        print(f"Input bands: {test_bands}")
        print(f"Prediction: {result}")
    else:
        train_model()
