import mne
import os
from collections import Counter

# Get the data directory the way Phase 1 did
data_dir = mne.datasets.sleep_physionet.data_path()
print(f"Data dir: {data_dir}")

# List files
files = os.listdir(data_dir)
edf_files = sorted([f for f in files if f.endswith('.edf')])
print(f"EDF files: {edf_files}")

# Find hypnogram files
hypo_files = [f for f in edf_files if 'Hypnogram' in f or 'hypnogram' in f.lower()]
print(f"Hypno files: {hypo_files}")

# Find PSG files
psg_files = [f for f in edf_files if 'PSG' in f]
print(f"PSG files: {psg_files}")

# Load first hypnogram
if hypo_files:
    hypo_path = os.path.join(data_dir, hypo_files[0])
    print(f"\nLoading: {hypo_files[0]}")
    annot = mne.read_annotations(hypo_path, verbose=False)
    print(f"Annotations: {len(annot)}")
    if len(annot) > 0:
        print("First 10:")
        for a, d, desc in zip(annot.onset[:10], annot.duration[:10], annot.description[:10]):
            print(f"  onset={a} dur={d} desc={repr(desc)}")
        c = Counter(annot.description)
        print("Counts:", c)
        # Print unique descriptions
        print("Unique:", set(annot.description))
