"""Debug: inspect hypnogram annotation format."""
import mne

# Subject 0
hypo0 = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001EC-Hypnogram.edf"
# Subject 1
hypo1 = r"C:\Users\User\mne_data\physionet-sleep-data\SC4011EH-Hypnogram.edf"

for label, path in [("Subject 0 (Alice)", hypo0), ("Subject 1 (Bob)", hypo1)]:
    print(f"\n{'='*60}")
    print(f"{label}: {path}")
    print(f"{'='*60}")

    raw = mne.io.read_raw_edf(path, preload=False, verbose=False)
    sfreq = raw.info['sfreq']

    # Try reading annotations
    annot = mne.read_annotations(path, verbose=False)
    print(f"Annotations: {len(annot)} events")
    print(f"Sample rate: {sfreq}")

    if len(annot) > 0:
        print("\nFirst 20 annotations:")
        for i, (a, d, desc) in enumerate(zip(annot.onset, annot.duration, annot.description)):
            print(f"  [{i}] onset={a:.1f}s duration={d:.1f}s description={repr(desc)}")

        # Unique descriptions
        unique_descs = set(annot.description)
        print(f"\nUnique descriptions: {unique_descs}")

        # Count each
        from collections import Counter
        desc_counts = Counter(annot.description)
        print("\nDescription counts:")
        for d, c in sorted(desc_counts.items(), key=lambda x: -x[1]):
            print(f"  {repr(d)}: {c}")
    else:
        # Maybe no annotations — check event channel
        print("No annotations found. Checking for event channel...")
        ch_names = raw.get_channel_names()
        print(f"Channels: {ch_names}")

        # Check all channels for non-signal content
        data = raw.get_data()
        for i, ch in enumerate(ch_names):
            ch_data = data[i]
            unique_vals = set(round(float(x), 6) for x in ch_data[:1000])
            print(f"  Channel '{ch}': first 1000 unique values = {unique_vals}")
