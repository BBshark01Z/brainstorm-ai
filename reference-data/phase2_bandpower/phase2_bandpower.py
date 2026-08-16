"""
Phase 2: Band power calculation from raw EEG signal.

Steps:
  A — Synthetic signal validation (ground truth with known sine waves)
  B — Apply to real Sleep-EDF data (subject 0, Fpz-Cz, 30s epochs)
  C — Cross-check against MNE's built-in PSD (Welch)

All work is read-only on already-downloaded files.
"""

import numpy as np
import mne

# ── Constants ──────────────────────────────────────────────────────────
Fpz_Cz = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001E0-PSG.edf"

EEG_BANDS = {
    "delta":  (0.5, 4),
    "theta":  (4, 8),
    "alpha":  (8, 13),
    "beta":   (13, 30),
    "gamma":  (30, 50),   # Nyquist for 100 Hz = 50 Hz
}

# ── Helpers ────────────────────────────────────────────────────────────

def bandpower_from_psd(freqs, psd, band_name):
    """Integrate power in a frequency band from PSD values."""
    lo, hi = EEG_BANDS[band_name]
    idx = np.where((freqs >= lo) & (freqs <= hi))[0]
    if len(idx) == 0:
        return 0.0
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(psd[idx], freqs[idx]))
    else:
        return float(np.trapz(psd[idx], freqs[idx]))


def compute_bandpower(raw_signal, sfreq):
    """
    Compute band power for a 1-D raw signal via FFT-based PSD.

    Parameters
    ----------
    raw_signal : 1-D array — values in Volts (will convert to microvolts)
    sfreq : sample rate in Hz

    Returns dict: {band_name: power_in_microvolt_squared}
    """
    # Convert from Volts to microvolts for readable power values
    signal_uv = raw_signal * 1e6  # microvolts

    n = len(signal_uv)
    # FFT
    fft_vals = np.fft.rfft(signal_uv)
    psd = (np.abs(fft_vals) ** 2) / (n * sfreq)  # one-sided PSD (uV^2/Hz)
    # Double non-DC and non-Nyquist components for one-sided
    if n > 1:
        psd[1:-1] *= 2
    freqs = np.fft.rfftfreq(n, d=1.0 / sfreq)

    return {
        band: bandpower_from_psd(freqs, psd, band)
        for band in EEG_BANDS
    }


def compute_bandpower_welch(raw_signal, sfreq, n_per_seg=None):
    """
    Compute band power via MNE's Welch PSD.

    Parameters
    ----------
    raw_signal : 1-D array in Volts
    sfreq : sample rate in Hz
    n_per_seg : segment length in samples. If None, uses full signal length
                (makes Welch equivalent to a single-segment Welch, closer to
                the full-epoch FFT approach).
    """
    signal_uv = raw_signal * 1e6  # convert to microvolts
    n = len(signal_uv)
    if n_per_seg is None:
        n_per_seg = n  # single segment = full signal

    psd_arr, freqs = mne.time_frequency.psd_array_welch(
        signal_uv[np.newaxis, :],  # shape (1, n)
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_per_seg=n_per_seg,
        n_overlap=int(n_per_seg * 0.5),  # 50% overlap
        average="mean",
    )
    psd = psd_arr[0]  # shape (n_freqs,)
    return {
        band: bandpower_from_psd(freqs, psd, band)
        for band in EEG_BANDS
    }


def human_duration(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}h {m}m {s}s"


# ── Phase 2A — Synthetic signal validation ────────────────────────────

print("=" * 70)
print("PHASE 2A — Synthetic signal validation (ground truth)")
print("=" * 70)

sfreq_synthetic = 100.0
duration = 30.0  # seconds
t = np.arange(int(sfreq_synthetic * duration)) / sfreq_synthetic

# 10 Hz sine (alpha band), amplitude 1.0  => power ~ 0.5 (for sine: A^2/2)
# 20 Hz sine (beta band), amplitude 0.5   => power ~ 0.125
synthetic = (
    1.0 * np.sin(2 * np.pi * 10 * t) +   # alpha component
    0.5 * np.sin(2 * np.pi * 20 * t) +   # beta component
    0.01 * np.random.randn(len(t))        # tiny noise
)

synth_bands = compute_bandpower(synthetic, sfreq_synthetic)

print(f"\nSignal: 10 Hz sine (amp=1.0) + 20 Hz sine (amp=0.5) + tiny noise")
print(f"Duration: {duration}s, Sample rate: {sfreq_synthetic} Hz")
print(f"Expected (sine power = A^2/2): alpha~0.5, beta~0.125\n")

for band_name, power in synth_bands.items():
    lo, hi = EEG_BANDS[band_name]
    bar = "#" * int(min(power / 0.5 * 40, 50))
    print(f"  {band_name:8s} ({lo:4.1f}-{hi:3.1f} Hz): {power:.6f}  {bar}")

# Check: alpha should be the dominant band, beta second
alpha_dominant = synth_bands["alpha"] > synth_bands["beta"]
beta_present = synth_bands["beta"] > 0.05
print(f"\n  Alpha dominant (expected): {alpha_dominant}  (alpha={synth_bands['alpha']:.4f}, beta={synth_bands['beta']:.4f})")
print(f"  Beta present (expected):   {beta_present}")

# Also verify relative ratio: alpha/beta should be ~4:1 (since (1.0^2/2)/(0.5^2/2) = 4)
ratio = synth_bands["alpha"] / synth_bands["beta"]
print(f"  Alpha/beta ratio: {ratio:.2f}  (expected ~4.00)")

# ── Phase 2B — Real Sleep-EDF data ────────────────────────────────────

print("\n" + "=" * 70)
print("PHASE 2B — Band power on real Sleep-EDF data (subject 0, Fpz-Cz)")
print("=" * 70)

raw = mne.io.read_raw_edf(
    Fpz_Cz,
    stim_channel="Event marker",
    infer_types=True,
    preload=True,
    verbose="error",
)

# Find EEG channels
eeg_indices = [
    i for i, ch in enumerate(raw.info["chs"]) if ch["kind"] == 2  # FIFFV_EEG_CH
]
eeg_names = [raw.info["chs"][i]["ch_name"] for i in eeg_indices]
sfreq = raw.info["sfreq"]
print(f"\nChannels found: {eeg_names}")
print(f"Sampling frequency: {sfreq} Hz")
n_times = raw.n_times
duration_total = n_times / sfreq
print(f"Total duration: {human_duration(duration_total)} ({n_times:,} samples)")

# Pick Fpz-Cz
fpz_idx = eeg_indices[0]  # Fpz-Cz is first EEG channel
fpz_data = raw.get_data(picks=[fpz_idx])[0]
print(f"Using channel: {raw.info['chs'][fpz_idx]['ch_name']}")

# Data is in Volts — note this
print(f"Data unit: Volts (range: {fpz_data.min()*1e6:.1f} to {fpz_data.max()*1e6:.1f} microvolts)")

# Split into 30-second epochs
epoch_duration = 30.0  # AASM standard
epoch_samples = int(epoch_duration * sfreq)
n_epochs = len(fpz_data) // epoch_samples
print(f"Epoch duration: {epoch_duration}s ({epoch_samples:,} samples)")
print(f"Number of full epochs: {n_epochs}\n")

# Compute band power per epoch
epoch_results = []
for i in range(n_epochs):
    segment = fpz_data[i * epoch_samples : (i + 1) * epoch_samples]
    bands = compute_bandpower(segment, sfreq)
    epoch_results.append(bands)

print("First 10 epochs — band power (microvolt^2/Hz integrated over band):")
print(f"  {'Epoch':>5s}  {'Delta':>12s}  {'Theta':>12s}  {'Alpha':>12s}  {'Beta':>12s}  {'Gamma':>12s}")
print(f"  {'-----':>5s}  {'------':>12s}  {'-----':>12s}  {'-----':>12s}  {'----':>12s}  {'-----':>12s}")
for i in range(min(10, n_epochs)):
    r = epoch_results[i]
    print(f"  {i+1:5d}  {r['delta']:12.4f}  {r['theta']:12.4f}  {r['alpha']:12.4f}  {r['beta']:12.4f}  {r['gamma']:12.4f}")

# Summary stats across all epochs
print(f"\nSummary across all {n_epochs} epochs:")
for band in EEG_BANDS:
    values = [r[band] for r in epoch_results]
    mean_v = np.mean(values)
    std_v = np.std(values)
    print(f"  {band:8s}: mean={mean_v:.4f}, std={std_v:.4f}, min={min(values):.4f}, max={max(values):.4f}")

# ── Phase 2C — Cross-check against MNE Welch PSD ──────────────────────

print("\n" + "=" * 70)
print("PHASE 2C — Cross-check against MNE Welch PSD")
print("=" * 70)

print(f"\nComparing custom FFT (full-epoch) vs MNE Welch PSD")
print(f"Two Welch modes compared:")
print(f"  1) n_per_seg = full epoch (3000 samples) — single-segment Welch, closest to full-epoch FFT")
print(f"  2) n_per_seg = 256 samples (2.56s) — standard Welch with segmentation\n")

print(f"--- Mode 1: Welch n_per_seg = full epoch (3000) ---")
print(f"{'Epoch':>5s}  {'Band':>8s}  {'Custom':>12s}  {'MNE Welch':>12s}  {'% Diff':>10s}")
print(f"  {'-----':>5s}  {'----':>8s}  {'------':>12s}  {'---------':>12s}  {'------':>10s}")

all_pcts_mode1 = {}
for band in EEG_BANDS:
    all_pcts_mode1[band] = []

for i in range(min(10, n_epochs)):
    segment = fpz_data[i * epoch_samples : (i + 1) * epoch_samples]
    custom = compute_bandpower(segment, sfreq)
    mne_bp = compute_bandpower_welch(segment, sfreq, n_per_seg=epoch_samples)

    for band in EEG_BANDS:
        c = custom[band]
        m = mne_bp[band]
        denom = (c + m) / 2.0
        if denom > 1e-12:
            pct = abs(c - m) / denom * 100.0
        else:
            pct = 0.0
        all_pcts_mode1[band].append(pct)
        print(f"  {i+1:5d}  {band:8s}  {c:12.4f}  {m:12.4f}  {pct:9.1f}%")

print(f"\nMean % difference per band (custom vs MNE Welch, full-epoch segments):")
for band in EEG_BANDS:
    vals = all_pcts_mode1[band]
    print(f"  {band:8s}: mean % diff = {np.mean(vals):.1f}%  (n={len(vals)})")

print(f"\n--- Mode 2: Welch n_per_seg = 256 (standard) ---")
print(f"{'Epoch':>5s}  {'Band':>8s}  {'Custom':>12s}  {'MNE Welch':>12s}  {'% Diff':>10s}")
print(f"  {'-----':>5s}  {'----':>8s}  {'------':>12s}  {'---------':>12s}  {'------':>10s}")

all_pcts_mode2 = {}
for band in EEG_BANDS:
    all_pcts_mode2[band] = []

for i in range(min(10, n_epochs)):
    segment = fpz_data[i * epoch_samples : (i + 1) * epoch_samples]
    custom = compute_bandpower(segment, sfreq)
    mne_bp = compute_bandpower_welch(segment, sfreq, n_per_seg=256)

    for band in EEG_BANDS:
        c = custom[band]
        m = mne_bp[band]
        denom = (c + m) / 2.0
        if denom > 1e-12:
            pct = abs(c - m) / denom * 100.0
        else:
            pct = 0.0
        all_pcts_mode2[band].append(pct)
        print(f"  {i+1:5d}  {band:8s}  {c:12.4f}  {m:12.4f}  {pct:9.1f}%")

print(f"\nMean % difference per band (custom vs MNE Welch, 256-sample segments):")
for band in EEG_BANDS:
    vals = all_pcts_mode2[band]
    print(f"  {band:8s}: mean % diff = {np.mean(vals):.1f}%  (n={len(vals)})")

print("\n" + "=" * 70)
print("Phase 2 complete.")
print("=" * 70)
