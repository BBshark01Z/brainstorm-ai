"""
services/demo_signal_source.py

Generates synthetic RAW (time-domain) multi-channel EEG — not pre-computed
band powers — so the WebSocket demo stream still exercises the real
filtering + Welch PSD pipeline in `feature_extractor.py` end-to-end. This
is the piece to delete once a real hardware bridge is pushing actual ADC
samples; everything downstream of it (filtering, PSD, FAA) stays the same.

Generates a fixed-duration window ending at `elapsed_seconds` on every call
rather than incrementally appending to a buffer — since the signal is fully
synthetic anyway, evaluating continuous sine functions over a shifted time
range looks just as continuous as real buffering would, without needing
stateful rolling-array bookkeeping.
"""

from __future__ import annotations

from typing import Dict

import numpy as np


def generate_raw_window(
    elapsed_seconds: float, window_duration_s: float, sfreq: float
) -> Dict[str, np.ndarray]:
    """
    Returns {"generic": ..., "F3": ..., "F4": ...} raw sample arrays for the
    `window_duration_s` seconds ending at `elapsed_seconds`. "generic" feeds
    the 5-band waveform display; F3/F4 carry a deliberate slight amplitude
    asymmetry so the FAA calculation has something to compute from.
    """
    n_samples = int(sfreq * window_duration_s)
    t = np.linspace(elapsed_seconds - window_duration_s, elapsed_seconds, n_samples, endpoint=False)

    def synth_channel(alpha_amp: float, phase: float = 0.0, noise_uv: float = 3.0) -> np.ndarray:
        # A mix of a dominant ~10 Hz alpha-band rhythm plus a slower delta
        # drift and broadband noise — enough spectral content for Welch's
        # method to produce plausible, non-degenerate band powers.
        signal = (
            alpha_amp * np.sin(2 * np.pi * 10.0 * t + phase)
            + 6.0 * np.sin(2 * np.pi * 2.0 * t)
            + np.random.normal(0, noise_uv, n_samples)
        )
        return signal

    return {
        "generic": synth_channel(alpha_amp=20.0, phase=0.0),
        "F3": synth_channel(alpha_amp=18.0, phase=0.15),  # left frontal
        "F4": synth_channel(alpha_amp=22.0, phase=-0.15),  # right frontal — slightly higher alpha
    }
