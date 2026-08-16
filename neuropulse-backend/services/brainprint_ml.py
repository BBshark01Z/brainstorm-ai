"""
services/brainprint_ml.py

Two complementary distance metrics, combined into one verify decision:

1. Cosine similarity to each enrolled profile — "which known person does
   this look most like?" Cheap, scale-invariant, good for per-profile
   matching.

2. Mahalanobis distance to the *overall enrolled population* — "how
   unusual is this sample relative to everything we've ever seen?" This is
   the standard out-of-distribution (OOD) detection technique from
   Lee et al., "A Simple Unified Framework for Detecting Out-of-
   Distribution Samples" (2018): OOD samples tend to sit far from the
   training distribution in Mahalanobis distance even when some individual
   cosine-similarity score looks deceptively close.

A capture is VERIFIED only if it clears *both* checks — a high cosine
match against one profile isn't enough on its own if the sample is
globally unusual relative to the enrolled population.
"""

from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

import numpy as np

from db.database import get_all_profiles, increment_session_count, insert_profile

SIMILARITY_THRESHOLD = float(os.getenv("BRAINPRINT_SIMILARITY_THRESHOLD", "0.82"))
MAHALANOBIS_THRESHOLD = float(os.getenv("BRAINPRINT_MAHALANOBIS_THRESHOLD", "3.0"))

# Mahalanobis distance needs a non-singular covariance matrix, which needs
# at least as many samples as feature dimensions (ideally quite a few more).
# Below this count, novelty detection silently falls back to cosine-only.
MIN_PROFILES_FOR_MAHALANOBIS = 8


def cosine_similarity(vector_a: np.ndarray, vector_b: np.ndarray) -> float:
    denom = np.linalg.norm(vector_a) * np.linalg.norm(vector_b)
    if denom == 0:
        return 0.0
    return float(np.dot(vector_a, vector_b) / denom)


def _population_mean_and_inv_covariance(matrix: np.ndarray) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """
    Returns (mean, inverse covariance) for the enrolled population, or None
    if there aren't enough samples yet to estimate a stable covariance.
    A small ridge term is added to the diagonal for numerical stability —
    standard practice since real covariance matrices are rarely perfectly
    well-conditioned with only a few hundred/thousand samples.
    """
    n_samples, n_features = matrix.shape
    if n_samples < MIN_PROFILES_FOR_MAHALANOBIS:
        return None

    mean = matrix.mean(axis=0)
    covariance = np.cov(matrix, rowvar=False)
    ridge = np.eye(n_features) * 1e-6
    try:
        inv_covariance = np.linalg.inv(covariance + ridge)
    except np.linalg.LinAlgError:
        return None
    return mean, inv_covariance


def mahalanobis_distance(vector: np.ndarray, mean: np.ndarray, inv_covariance: np.ndarray) -> float:
    diff = vector - mean
    return float(np.sqrt(diff @ inv_covariance @ diff.T))


def recognize(embedding: List[float], user_id: int) -> Dict:
    """
    Main entry point for /api/brainprint/verify. Loads every enrolled
    profile fresh from SQLite (see db/database.py) for the given *user_id*
    so a profile registered a moment ago is already visible here — no cache
    to invalidate. Profiles from other users are never exposed.
    """
    profiles = get_all_profiles(user_id)
    vector = np.asarray(embedding, dtype=np.float64)

    if not profiles:
        return {
            "status": "UNKNOWN_SIGNATURE_DETECTED",
            "nickname": None,
            "profile_id": None,
            "confidence_score": 0.0,
            "novelty_score": None,
        }

    # --- 1. Best cosine match among enrolled profiles ---
    best_profile = None
    best_similarity = -1.0
    for profile in profiles:
        similarity = cosine_similarity(vector, np.asarray(profile["embedding"], dtype=np.float64))
        if similarity > best_similarity:
            best_similarity = similarity
            best_profile = profile

    # --- 2. Population-level novelty check (Mahalanobis distance) ---
    population_matrix = np.asarray([p["embedding"] for p in profiles], dtype=np.float64)
    stats = _population_mean_and_inv_covariance(population_matrix)
    novelty_score: Optional[float] = None
    is_in_distribution = True  # default true when Mahalanobis can't be computed yet (too few profiles)

    if stats is not None:
        mean, inv_covariance = stats
        novelty_score = mahalanobis_distance(vector, mean, inv_covariance)
        is_in_distribution = novelty_score <= MAHALANOBIS_THRESHOLD

    is_confident_match = best_similarity >= SIMILARITY_THRESHOLD

    if is_confident_match and is_in_distribution and best_profile is not None:
        increment_session_count(best_profile["id"])
        return {
            "status": "VERIFIED",
            "nickname": best_profile["nickname"],
            "profile_id": best_profile["id"],
            "confidence_score": round(best_similarity * 100, 2),
            "novelty_score": novelty_score,
        }

    return {
        "status": "UNKNOWN_SIGNATURE_DETECTED",
        "nickname": None,
        "profile_id": None,
        "confidence_score": round(max(best_similarity, 0.0) * 100, 2),
        "novelty_score": novelty_score,
    }


def register(user_id: int, nickname: str, embedding: List[float], notes: Optional[str] = None) -> Dict:
    """Persists a new profile for *user_id* — see db.database.insert_profile for the actual write."""
    return insert_profile(user_id=user_id, nickname=nickname, embedding=embedding, notes=notes)
