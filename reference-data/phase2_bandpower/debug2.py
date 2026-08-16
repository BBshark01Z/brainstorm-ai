import mne
import os

# Get the data directory from env or hardcode
data_dir = os.path.expanduser("~/mne_data/physionet-sleep-data")
edf_path = os.path.join(data_dir, "SC4001E0-PSG.edf")

print(f"EDF path: {edf_path}")
print(f"File exists: {os.path.exists(edf_path)}")
print(f"File size: {os.path.getsize(edf_path)} bytes")

# Read without preload
raw = mne.io.read_raw_edf(
    edf_path,
    stim_channel="Event marker",
    infer_types=True,
    preload=False,
    verbose="error",
)

# Print all channel info
print("\nChannel info:")
for i, ch in enumerate(raw.info["chs"]):
    ch_name = ch["ch_name"]
    ch_kind = ch["kind"]
    ch_unit = ch["unit"]
    ch_range = ch["range"]
    print(f"  Ch {i:2d}: name={ch_name}, kind={ch_kind}, unit={ch_unit}, range={ch_range}")

# Get EEG data
eeg_indices = [i for i, ch in enumerate(raw.info["chs"]) if ch["kind"] == 2]
print(f"\nEEG channel indices: {eeg_indices}")

if eeg_indices:
    idx = eeg_indices[0]
    data = raw.get_data(picks=[idx])[0]
    print(f"Shape: {data.shape}")
    print(f"dtype: {data.dtype}")
    print(f"min: {data.min():.15e}")
    print(f"max: {data.max():.15e}")
    print(f"mean: {data.mean():.15e}")
    print(f"std: {data.std():.15e}")
    print(f"First 20 values: {data[:20]}")

    # Check first epoch (30 seconds)
    sfreq = raw.info["sfreq"]
    epoch_samples = int(30 * sfreq)
    first_epoch = data[:epoch_samples]
    print(f"\nFirst epoch (30s, {epoch_samples} samples):")
    print(f"  min: {first_epoch.min():.15e}")
    print(f"  max: {first_epoch.max():.15e}")
    print(f"  std: {first_epoch.std():.15e}")

    # Try with preload
    raw2 = mne.io.read_raw_edf(
        edf_path,
        stim_channel="Event marker",
        infer_types=True,
        preload=True,
        verbose="error",
    )
    data2 = raw2.get_data(picks=[idx])[0]
    print(f"\nWith preload:")
    print(f"  min: {data2.min():.15e}")
    print(f"  max: {data2.max():.15e}")
    print(f"  First 20: {data2[:20]}")
