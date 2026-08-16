"""
services/eeg_dataset.py

Generate synthetic EEG training data for mental state classification.

Each mental state has distinct EEG patterns:
- Calm:     High alpha, low beta, low theta — relaxed meditation
- Focused:  High beta & gamma, moderate alpha — deep concentration
- Stressed: Very low alpha, very high beta, shifted FAA — anxiety
- Fatigued: High theta & delta, low beta — drowsiness
- ADHD-like: High theta, moderate beta, high theta/beta ratio (>3)
- Cognitive Concern: High theta & alpha (slow), high delta — early decline

Generates ~200 samples per class using parametric band power models
with realistic Gaussian noise, then extracts features via the same
pipeline used by the live EEG stream so training and inference match.
"""

from __future__ import annotations

import json
import os
import random
import sqlite3
from typing import Dict, List

import numpy as np

# ---------------------------------------------------------------------------
# Mental state definitions — mean ± std for each band power (µV²)
# ---------------------------------------------------------------------------

STATE_SPECS: Dict[str, Dict[str, tuple]] = {
    "calm": {
        "delta": (8.0, 3.0),
        "theta": (5.0, 2.0),
        "alpha": (35.0, 10.0),  # high alpha = relaxed
        "beta": (5.0, 2.0),     # low beta = calm
        "gamma": (2.0, 1.0),
        "faa_range": (-0.1, 0.1),  # symmetric
    },
    "focused": {
        "delta": (4.0, 2.0),
        "theta": (5.0, 2.0),
        "alpha": (15.0, 5.0),
        "beta": (35.0, 10.0),  # high beta = focused
        "gamma": (15.0, 5.0),  # high gamma = cognitive engagement
        "faa_range": (-0.15, 0.15),
    },
    "stressed": {
        "delta": (3.0, 1.5),
        "theta": (4.0, 2.0),
        "alpha": (3.0, 1.5),   # very low alpha = stressed
        "beta": (50.0, 15.0),  # very high beta = stress
        "gamma": (12.0, 4.0),
        "faa_range": (0.3, 0.8),  # asymmetric = stress/anxiety
    },
    "fatigued": {
        "delta": (30.0, 8.0),  # high delta = drowsy
        "theta": (25.0, 7.0),  # high theta = sleepy
        "alpha": (12.0, 5.0),
        "beta": (4.0, 2.0),    # low beta = fatigued
        "gamma": (1.5, 0.8),
        "faa_range": (-0.3, 0.3),  # variable
    },
    "adhd_like": {
        "delta": (10.0, 4.0),
        "theta": (30.0, 8.0),  # high theta
        "alpha": (10.0, 4.0),
        "beta": (10.0, 4.0),   # moderate beta
        "gamma": (3.0, 1.5),
        "faa_range": (-0.4, 0.4),  # variable
    },
    "cognitive_concern": {
        "delta": (25.0, 7.0),  # high delta
        "theta": (28.0, 7.0),  # high theta
        "alpha": (25.0, 7.0),  # high alpha (often slower frequency)
        "beta": (4.0, 2.0),    # low beta
        "gamma": (1.5, 0.8),
        "faa_range": (0.2, 0.6),  # asymmetric
    },
}

SAMPLES_PER_CLASS = 200
TOTAL_CLASSES = len(STATE_SPECS)


def _extract_features(
    delta: float, theta: float, alpha: float, beta: float, gamma: float, faa: float
) -> List[float]:
    """
    Extract the same 13 features used by the live pipeline:
      [delta, theta, alpha, beta, gamma,
       diff_entropy, hjorth_activity, hjorth_mobility, hjorth_complexity,
       theta_beta_ratio,
       faa_index,
       total_power, alpha_ratio]
    """
    total_power = delta + theta + alpha + beta + gamma

    # Differential entropy: H = 0.5 * log(2*pi*e*sigma^2)
    # Approximate sigma^2 from band power (power ≈ variance in band-limited signal)
    std_approx = max(total_power ** 0.5, 1e-6)
    diff_entropy = 0.5 * float(np.log(2 * np.pi * np.e * (std_approx ** 2)))

    # Hjorth parameters approximated from band powers
    activity = float(total_power)
    mobility = float(np.sqrt(1 + (theta + beta) / max(alpha, 1e-6)))
    complexity = float(np.sqrt(1 + (delta + gamma) / max(theta + alpha, 1e-6)))

    theta_beta_ratio = theta / max(beta, 1e-6)

    alpha_ratio = alpha / max(total_power, 1e-6)

    return [
        delta,
        theta,
        alpha,
        beta,
        gamma,
        diff_entropy,
        activity,
        mobility,
        complexity,
        theta_beta_ratio,
        faa,
        total_power,
        alpha_ratio,
    ]


def generate_dataset() -> tuple[List[List[float]], List[int], List[str]]:
    """
    Generate synthetic EEG training data.

    Returns:
        features: list of 13-dim feature vectors
        labels: list of integer class indices
        class_names: list of class name strings
    """
    all_features: List[List[float]] = []
    all_labels: List[int] = []
    rng = np.random.RandomState(42)

    for class_idx, (class_name, spec) in enumerate(STATE_SPECS.items()):
        for _ in range(SAMPLES_PER_CLASS):
            # Sample band powers from Gaussian distributions
            delta = max(0.1, float(rng.normal(*spec["delta"])))
            theta = max(0.1, float(rng.normal(*spec["theta"])))
            alpha = max(0.1, float(rng.normal(*spec["alpha"])))
            beta = max(0.1, float(rng.normal(*spec["beta"])))
            gamma = max(0.1, float(rng.normal(*spec["gamma"])))

            # FAA from uniform range
            faa_min, faa_max = spec["faa_range"]
            faa = float(rng.uniform(faa_min, faa_max))

            features = _extract_features(delta, theta, alpha, beta, gamma, faa)
            all_features.append(features)
            all_labels.append(class_idx)

    class_names = list(STATE_SPECS.keys())
    return all_features, all_labels, class_names


def save_dataset_to_db(
    db_path: str | None = None,
) -> None:
    """
    Save the synthetic dataset to a SQLite database.

    Creates two tables:
    - screening_classes: class index → name mapping
    - screening_samples: feature vector + label per sample
    """
    if db_path is None:
        db_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "..",
            "data",
            "screening_data.db",
        )
    db_path = os.path.normpath(db_path)

    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    features, labels, class_names = generate_dataset()

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("DROP TABLE IF EXISTS screening_samples")
        conn.execute("DROP TABLE IF EXISTS screening_classes")

        conn.execute("""
            CREATE TABLE screening_classes (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            )
        """)
        for idx, name in enumerate(class_names):
            conn.execute(
                "INSERT INTO screening_classes (id, name) VALUES (?, ?)",
                (idx, name),
            )

        conn.execute("""
            CREATE TABLE screening_samples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id INTEGER NOT NULL,
                feature_vector TEXT NOT NULL,
                FOREIGN KEY (class_id) REFERENCES screening_classes(id)
            )
        """)
        for feat, label in zip(features, labels):
            conn.execute(
                "INSERT INTO screening_samples (class_id, feature_vector) VALUES (?, ?)",
                (label, json.dumps(feat)),
            )

        conn.commit()
        total = len(features)
        print(f"✅ Dataset saved: {total} samples × 13 features → {db_path}")
        print(f"   Classes: {', '.join(class_names)}")
        print(f"   Samples per class: {SAMPLES_PER_CLASS}")
    finally:
        conn.close()


if __name__ == "__main__":
    save_dataset_to_db()
