"""Minimal debug: inspect hypnogram annotations."""
import mne
import os
from collections import Counter

data_dir = r"C:\Users\User\mne_data\physionet-sleep-data"
print("Data dir:", data_dir)

for fname in sorted(os.listdir(data_dir)):
    if "Hypnogram" in fname:
        path = os.path.join(data_dir, fname)
        print(f"\n=== {fname} ===")
        annot = mne.read_annotations(path, verbose=False)
        print(f"Annotations: {len(annot)}")
        if len(annot) > 0:
            print("First 10:")
            for a, d, desc in zip(annot.onset[:10], annot.duration[:10], annot.description[:10]):
                print(f"  onset={a:.0f} dur={d:.0f} desc={repr(desc)}")
            print("Counts:", Counter(annot.description))
            print("Unique:", sorted(set(annot.description)))
        else:
            raw = mne.io.read_raw_edf(path, preload=False, verbose=False)
            print("Channels:", raw.get_channel_names())
