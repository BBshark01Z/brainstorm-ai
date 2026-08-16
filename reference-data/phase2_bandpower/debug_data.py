"""Debug: check EDF scaling."""
import mne

Fpz_Cz = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001E0-PSG.edf"

raw = mne.io.read_raw_edf(
    Fpz_Cz,
    stim_channel="Event marker",
    infer_types=True,
    preload=True,
    verbose="error",
)

# Print all channel info
for i, ch in enumerate(raw.info["chs"]):
    print(f"Ch {i:2d}: name={ch['ch_name']:12s} kind={ch['kind']} unit={ch['unit']:4s} range={ch['range']}")

# Check if data is preloaded
print(f"\ndata_as_float: {raw._data is not None}")
print(f"Number of segments: {len(raw._data)}")

# Get first segment
if len(raw._data) > 0:
    seg = raw._data[0]
    print(f"First segment shape: {seg.shape}")
    print(f"First segment dtype: {seg.dtype}")
    print(f"First segment min/max: {seg.min():.10f} / {seg.max():.10f}")

# Try without preload
raw2 = mne.io.read_raw_edf(
    Fpz_Cz,
    stim_channel="Event marker",
    infer_types=True,
    preload=False,
    verbose="error",
)
eeg_idx = [i for i, ch in enumerate(raw2.info["chs"]) if ch["kind"] == 2][0]
print(f"\nWithout preload, channel {eeg_idx}: {raw2.info['chs'][eeg_idx]['ch_name']}")
data_no_preload = raw2.get_data(picks=[eeg_idx])[0]
print(f"Shape: {data_no_preload.shape}, min: {data_no_preload.min():.10f}, max: {data_no_preload.max():.10f}")
print(f"First 10: {data_no_preload[:10]}")
