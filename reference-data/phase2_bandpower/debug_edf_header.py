"""Debug: read EDF header manually to understand scaling."""
import struct

edf_path = r"C:\Users\User\mne_data\physionet-sleep-data\SC4001E0-PSG.edf"

with open(edf_path, "r") as f:
    # Header 0: bytes 0-255 (80 bytes)
    header0 = f.read(80)
    version = header0[0:8].strip()
    local = header0[8:80].strip()
    print(f"Version: {version}")
    print(f"Local patient: {local}")

    # Record header 1: bytes 80-184 (105 bytes)
    header1 = f.read(105)
    reserved = header1[0:8].strip()
    date = header1[8:20].strip()
    n_channels = int(header1[20:24].strip())
    duration = int(header1[24:28].strip())  # seconds
    print(f"Reserved: {reserved}")
    print(f"Date: {date}")
    print(f"Number of channels: {n_channels}")
    print(f"Duration (seconds): {duration}")

    # Per-channel info: 8 bytes each
    print(f"\n{'Channel':>10s} {'Label':>12s} {'Transducer':>20s} {'Range':>8s} {'Physical min':>14s} {'Physical max':>14s} {'Digital min':>13s} {'Digital max':>13s} {'Reserv':>8s} {'N samples':>11s} {'Reserved2':>12s}")
    print("-" * 145)

    for i in range(n_channels):
        ch = f.read(8 * 16)  # 8 bytes per field
        if len(ch) < 128:
            break
        label = ch[0:16].decode("ascii", errors="ignore").strip()
        transducer = ch[16:48].decode("ascii", errors="ignore").strip()
        physical_min = float(ch[48:64].strip())
        physical_max = float(ch[64:80].strip())
        digital_min = int(ch[80:96].strip())
        digital_max = int(ch[96:112].strip())
        n_samples = int(ch[112:120].strip())
        print(f"Ch {i:2d}: {label:>12s} {transducer:>20s} {physical_min:>10.2f}/{physical_max:>10.2f}  {digital_min:>10d}/{digital_max:>10d}  {n_samples:>8d}")
