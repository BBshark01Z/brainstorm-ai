"""Phase 2C only - cross-check against MNE Welch PSD."""
import numpy as np
import mne

Fpz_Cz = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001E0-PSG.edf"

EEG_BANDS = {
    "delta":  (0.5, 4),
    "theta":  (4, 8),
    "alpha":  (8, 13),
    "beta":   (13, 30),
    "gamma":  (30, 50),
}

def bandpower_from_psd(freqs, psd, band_name):
    lo, hi = EEG_BANDS[band_name]
    idx = np.where((freqs >= lo) & (freqs <= hi))[0]
    if len(idx) == 0:
        return 0.0
    if hasattr(np, "trapezoid"):
        return float(np.trapezoid(psd[idx], freqs[idx]))
    else:
        return float(np.trapz(psd[idx], freqs[idx]))

def compute_bandpower(raw_signal, sfreq):
    signal_uv = raw_signal * 1e6
    n = len(signal_uv)
    fft_vals = np.fft.rfft(signal_uv)
    psd = (np.abs(fft_vals) ** 2) / (n * sfreq)
    if n > 1:
        psd[1:-1] *= 2
    freqs = np.fft.rfftfreq(n, d=1.0 / sfreq)
    return {band: bandpower_from_psd(freqs, psd, band) for band in EEG_BANDS}

def compute_bandpower_welch(raw_signal, sfreq, seg_len):
    """Compute band power via MNE Welch. seg_len is segment length in samples."""
    signal_uv = raw_signal * 1e6
    psd_arr, freqs = mne.time_frequency.psd_array_welch(
        signal_uv[np.newaxis, :],
        sfreq=sfreq,
        fmin=0.5,
        fmax=50,
        n_per_seg=seg_len,
        average="mean",
    )
    psd = psd_arr[0]
    return {band: bandpower_from_psd(freqs, psd, band) for band in EEG_BANDS}

# Load data
raw = mne.io.read_raw_edf(Fpz_Cz, stim_channel="Event marker", infer_types=True, preload=True, verbose="error")
eeg_indices = [i for i, ch in enumerate(raw.info["chs"]) if ch["kind"] == 2]
fpz_idx = eeg_indices[0]
fpz_data = raw.get_data(picks=[fpz_idx])[0]
sfreq = raw.info["sfreq"]
epoch_samples = int(30.0 * sfreq)
n_epochs = len(fpz_data) // epoch_samples

print("Comparing custom FFT (full-epoch) vs MNE Welch PSD")
print("Two Welch modes compared:")
print("  1) n_per_seg = full epoch (3000 samples)")
print("  2) n_per_seg = 256 samples (standard)\n")

for mode_label, nps in [("Mode 1: Welch n_per_seg=full epoch (3000)", epoch_samples), ("Mode 2: Welch n_per_seg=256", 256)]:
    print(f"--- {mode_label} ---")
    print(f"{'Epoch':>5s}  {'Band':>8s}  {'Custom':>12s}  {'MNE Welch':>12s}  {'% Diff':>10s}")
    print(f"  {'-----':>5s}  {'----':>8s}  {'------':>12s}  {'---------':>12s}  {'------':>10s}")

    all_pcts = {band: [] for band in EEG_BANDS}

    for i in range(min(10, n_epochs)):
        segment = fpz_data[i * epoch_samples : (i + 1) * epoch_samples]
        custom = compute_bandpower(segment, sfreq)
        mne_bp = compute_bandpower_welch(segment, sfreq, nps)

        for band in EEG_BANDS:
            c, m = custom[band], mne_bp[band]
            denom = (c + m) / 2.0
            pct = abs(c - m) / denom * 100.0 if denom > 1e-12 else 0.0
            all_pcts[band].append(pct)
            print(f"  {i+1:5d}  {band:8s}  {c:12.4f}  {m:12.4f}  {pct:9.1f}%")

    print(f"\nMean % difference per band:")
    for band in EEG_BANDS:
        vals = all_pcts[band]
        print(f"  {band:8s}: mean % diff = {np.mean(vals):.1f}%  (n={len(vals)})")
    print()
