import mne
import os

hypo0 = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001EC-Hypnogram.edf"
hypo1 = r"C:\Users\User\mne_data\physionet-sleep-data\SC4011EH-Hypnogram.edf"

for label, path in [("Subject 0", hypo0), ("Subject 1", hypo1)]:
    print(f"\n{'='*60}")
    print(f"{label}: {path}")
    print(f"{'='*60}")
    raw = mne.io.read_raw_edf(path, preload=False, verbose=False)
    annot = mne.read_annotations(path, verbose=False)
    print(f"Annotations count: {len(annot)}")
    if len(annot) > 0:
        print("First 10:")
        for a, d, desc in zip(annot.onset[:10], annot.duration[:10], annot.description[:10]):
            print(f"  onset={a} dur={d} desc={repr(desc)}")
        from collections import Counter
        c = Counter(annot.description)
        print("Counts:", c)
    else:
        names = raw.get_channel_names()
        print("Channels:", names)
        data = raw.get_data()
        for i, ch in enumerate(names):
            vals = set(round(float(x), 6) for x in data[i][:200])
            print(f"  {ch}: {vals}")
