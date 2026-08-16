"""
services/feature_extractor.py

EEG Feature Extraction Service
- Band power calculation using Welch PSD
- Differential Entropy
- Hjorth Parameters (Activity, Mobility, Complexity)
- Frontal Alpha Asymmetry (FAA)
- Embedding vector generator
"""

from __future__ import annotations

import mne
import numpy as np
from scipy.signal import butter, filtfilt, welch

# กำหนดช่วงความถี่ของ EEGแต่ละย่าน (Hz)
BANDS = {
    "delta": (0.5, 4.0),
    "theta": (4.0, 8.0),
    "alpha": (8.0, 13.0),
    "beta": (13.0, 30.0),
    "gamma": (30.0, 50.0),
}


# ---------------------------------------------------------------------------
# SciPy Butterworth Filters — standalone (no MNE dependency)
# ---------------------------------------------------------------------------


def apply_bandpass_filter(
    data: np.ndarray,
    lowcut: float = 0.5,
    highcut: float = 50.0,
    fs: float = 256.0,
    order: int = 4,
) -> np.ndarray:
    """
    Apply a Butterworth bandpass filter using zero-phase forward-backward filtering.

    Parameters
    ----------
    data : np.ndarray
        Raw EEG signal (1-D or 2-D with shape [n_channels, n_samples]).
    lowcut : float
        Lower cutoff frequency in Hz (default 0.5).
    highcut : float
        Upper cutoff frequency in Hz (default 50.0).
    fs : float
        Sampling frequency in Hz (default 256.0).
    order : int
        Filter order (default 4).

    Returns
    -------
    np.ndarray
        Filtered signal with the same shape as input.
    """
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data_2d = data[np.newaxis, :]
    else:
        data_2d = data

    nyquist = fs / 2.0
    if lowcut >= nyquist or highcut >= nyquist:
        return data  # Cannot filter — return original

    b, a = butter(order, [lowcut / nyquist, highcut / nyquist], btype='band')

    filtered = np.zeros_like(data_2d)
    for ch in range(data_2d.shape[0]):
        filtered[ch] = filtfilt(b, a, data_2d[ch])

    return filtered.squeeze()


def apply_notch_filter(
    data: np.ndarray,
    notch_freq: float = 50.0,
    fs: float = 256.0,
    quality_factor: float = 30.0,
) -> np.ndarray:
    """
    Apply a Butterworth notch filter to remove power-line interference.

    Parameters
    ----------
    data : np.ndarray
        Raw EEG signal (1-D or 2-D).
    notch_freq : float
        Frequency to notch out in Hz (default 50.0 for 50 Hz mains).
    fs : float
        Sampling frequency in Hz (default 256.0).
    quality_factor : float
        Q-factor controls notch width (higher = narrower). Default 30.

    Returns
    -------
    np.ndarray
        Filtered signal with the same shape as input.
    """
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data_2d = data[np.newaxis, :]
    else:
        data_2d = data

    nyquist = fs / 2.0
    if notch_freq >= nyquist or notch_freq <= 0:
        return data

    bandwidth = notch_freq / quality_factor
    b, a = butter(
        2,
        [notch_freq - bandwidth / 2, notch_freq + bandwidth / 2],
        btype='bandstop',
    )

    filtered = np.zeros_like(data_2d)
    for ch in range(data_2d.shape[0]):
        filtered[ch] = filtfilt(b, a, data_2d[ch])

    return filtered.squeeze()


# ---------------------------------------------------------------------------
# Biomarker Calculations
# ---------------------------------------------------------------------------


def compute_focus_index(band_power: dict[str, float]) -> float:
    """
    Focus Index = Beta / (Theta + Alpha)

    Higher values indicate a more focused / alert cognitive state.
    Returns 0.0 if denominator is near-zero.
    """
    theta = band_power.get("theta", 0.0)
    alpha = band_power.get("alpha", 0.0)
    beta = band_power.get("beta", 0.0)
    denom = theta + alpha
    if denom < 1e-12:
        return 0.0
    return float(beta / denom)


def compute_stress_index(band_power: dict[str, float]) -> float:
    """
    Stress Index = High Beta / Alpha

    High Beta (18-30 Hz) relative to Alpha is associated with anxiety / stress.
    Returns 0.0 if Alpha is near-zero.
    """
    alpha = band_power.get("alpha", 0.0)
    # High beta: 18-30 Hz (subset of beta band 13-30 Hz)
    # Since band_power only has the full beta band, approximate high beta as
    # 60% of beta (a common heuristic in EEG literature).
    beta = band_power.get("beta", 0.0)
    high_beta = beta * 0.6
    if alpha < 1e-12:
        return 0.0
    return float(high_beta / alpha)


def compute_relaxation_index(band_power: dict[str, float]) -> float:
    """
    Relaxation Index = Alpha / Total Power

    Alpha dominance relative to total power indicates a relaxed, resting state.
    Returns 0.0 if total power is near-zero.
    """
    alpha = band_power.get("alpha", 0.0)
    total = sum(v for v in band_power.values())
    if total < 1e-12:
        return 0.0
    return float(alpha / total)


def compute_all_biomarkers(band_power: dict[str, float]) -> dict[str, float]:
    """
    Compute all EEG biomarkers from a band_power dict.

    Returns
    -------
    dict with keys: focus_index, stress_index, relaxation_index
    """
    return {
        "focus_index": round(compute_focus_index(band_power), 6),
        "stress_index": round(compute_stress_index(band_power), 6),
        "relaxation_index": round(compute_relaxation_index(band_power), 6),
    }


def _trapz_compat(y: np.ndarray, x: np.ndarray) -> float:
    """
    ฟังก์ชันคำนวณพื้นที่ใต้กราฟที่รองรับทั้ง NumPy >= 2.0 (np.trapezoid) 
    และ NumPy < 2.0 (np.trapz)
    """
    trapz_fn = getattr(np, "trapezoid", getattr(np, "trapz", None))
    return float(trapz_fn(y, x))


def preprocess_signal(
    data: np.ndarray, sfreq: float, notch_freq: float = 50.0
) -> np.ndarray:
    """
    กรองสัญญาณ EEG (Bandpass Filter 0.5-50 Hz และ Notch Filter)
    กำหนดความยาว Filter ให้เหมาะสมกับความยาวสัญญาณเพื่อป้องกัน RuntimeWarning
    """
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data_2d = data[np.newaxis, :]
    else:
        data_2d = data

    n_samples = data_2d.shape[-1]

    # กำหนดความยาวของตัวกรองให้ไม่เกิน 1,000 ms หรือไม่เกินความยาวของสัญญาณที่มีอยู่
    max_filter_ms = min(1000, int((n_samples / sfreq) * 1000)) if sfreq > 0 else 1000
    filter_len = f"{max(100, max_filter_ms)}ms"

    try:
        # Bandpass Filter (0.5 - 50 Hz)
        filtered = mne.filter.filter_data(
            data_2d,
            sfreq=sfreq,
            l_freq=0.5,
            h_freq=50.0,
            l_trans_bandwidth=1.0,
            h_trans_bandwidth=5.0,
            filter_length=filter_len,
            verbose=False,
        )

        # Notch Filter กำจัดสัญญาณรบกวนไฟฟ้าบ้าน (50Hz / 60Hz)
        if notch_freq and notch_freq > 0 and notch_freq < (sfreq / 2):
            filtered = mne.filter.notch_filter(
                filtered,
                Fs=sfreq,
                freqs=[notch_freq],
                filter_length=filter_len,
                verbose=False,
            )
    except Exception:
        # หากเกิดข้อผิดพลาดในการกรอง ให้ใช้สัญญาณเดิมชั่วคราว
        filtered = data_2d

    return filtered.squeeze()


def compute_band_power(data: np.ndarray, sfreq: float) -> dict[str, float]:
    """
    คำนวณ Band Power ด้วยวิธี Welch Power Spectral Density (PSD)
    """
    nperseg = min(len(data), int(sfreq * 2)) if sfreq > 0 else len(data)
    if nperseg < 1:
        nperseg = len(data)

    freqs, psd = welch(data, fs=sfreq, nperseg=nperseg)
    band_power = {}

    for band_name, (fmin, fmax) in BANDS.items():
        mask = (freqs >= fmin) & (freqs <= fmax)
        if np.any(mask):
            power = _trapz_compat(psd[mask], freqs[mask])
        else:
            power = 0.0
        band_power[band_name] = max(0.0, power)

    return band_power


def compute_hjorth(data: np.ndarray) -> dict[str, float]:
    """
    คำนวณค่า Hjorth Parameters (Activity, Mobility, Complexity)
    """
    d1 = np.diff(data)
    d2 = np.diff(d1)

    var_zero = float(np.var(data))
    var_d1 = float(np.var(d1))
    var_d2 = float(np.var(d2))

    activity = var_zero

    if var_zero > 1e-12:
        mobility = float(np.sqrt(var_d1 / var_zero))
    else:
        mobility = 0.0

    if var_d1 > 1e-12 and mobility > 1e-12:
        complexity = float(np.sqrt(var_d2 / var_d1) / mobility)
    else:
        complexity = 0.0

    return {
        "activity": activity,
        "mobility": mobility,
        "complexity": complexity,
    }


def compute_differential_entropy(data: np.ndarray) -> float:
    """
    คำนวณ Differential Entropy (DE) โดยสมมติเป็น Gaussian Distribution
    """
    std = float(np.std(data, ddof=1))
    if std <= 1e-12:
        return 0.0
    return float(0.5 * np.log(2 * np.pi * np.e * (std ** 2)))


def frontal_alpha_asymmetry(alpha_f3: float, alpha_f4: float) -> float | None:
    """
    คำนวณค่า Frontal Alpha Asymmetry (FAA) = ln(Alpha_F4) - ln(Alpha_F3)
    """
    if alpha_f3 <= 0 or alpha_f4 <= 0:
        return None
    return float(np.log(alpha_f4) - np.log(alpha_f3))


def extract_channel_features(
    samples: list[float] | np.ndarray,
    sampling_rate_hz: float,
    notch_freq: float = 50.0,
) -> dict:
    """
    สกัด Feature ทั้งหมดของ EEG จากสัญญาณ Raw Channel เดียว
    """
    data = np.asarray(samples, dtype=np.float64)
    filtered = preprocess_signal(data, sampling_rate_hz, notch_freq=notch_freq)

    band_power = compute_band_power(filtered, sampling_rate_hz)
    de = compute_differential_entropy(filtered)
    hjorth = compute_hjorth(filtered)

    theta = band_power.get("theta", 0.0)
    beta = band_power.get("beta", 0.0)
    tbr = float(theta / beta) if beta > 1e-12 else 0.0

    return {
        "band_power": band_power,
        "differential_entropy": de,
        "hjorth": hjorth,
        "theta_beta_ratio": tbr,
    }


def build_embedding_vector(channel_features_list: list[dict]) -> list[float]:
    """
    แปลง Features จากทุก Channel ให้เป็น Vector เรียงยาวสำหรับส่งต่อไปยัง ML Model
    """
    vector: list[float] = []
    for feat in channel_features_list:
        bp = feat.get("band_power", {})
        hj = feat.get("hjorth", {})
        vector.extend([
            bp.get("delta", 0.0),
            bp.get("theta", 0.0),
            bp.get("alpha", 0.0),
            bp.get("beta", 0.0),
            bp.get("gamma", 0.0),
            feat.get("differential_entropy", 0.0),
            hj.get("activity", 0.0),
            hj.get("mobility", 0.0),
            hj.get("complexity", 0.0),
            feat.get("theta_beta_ratio", 0.0),
        ])
    return vector