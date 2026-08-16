import { EEGSample, FileIngestionResult, IngestedFileFormat } from "./types";

// ---------------------------------------------------------------------------
// Data ingestion for the "File Upload / Data Injection" input mode.
//
// Real EDF files are a binary format — parsing one properly needs a real
// EDF/BDF library (e.g. `edfjs` or a Python microservice), which is out of
// scope for a frontend-only build. What's supported here:
//   - .csv   — columns named delta/theta/alpha/beta/gamma (header required)
//   - .json  — an array of objects with the same band keys, OR an array of
//              plain numbers (treated as a single generic channel)
//   - raw    — pasted numbers (comma/whitespace/newline separated)
//   - edf-like — a plain-text EDF-style export (label: value per line) —
//              NOT real binary EDF; flagged with a warning either way.
// Every path funnels into the same EEGSample[] shape the rest of the app uses.
// ---------------------------------------------------------------------------

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Splits one generic amplitude reading into five pseudo-bands. This is a
 * simplified stand-in for real spectral (FFT/wavelet) band decomposition —
 * it exists so single-channel pasted/CSV data still has something to plot
 * on the 5-band waveform chart, not a substitute for real signal processing. */
function deriveBandsFromScalar(value: number, index: number): Omit<EEGSample, "timestamp"> {
  const wobble = Math.sin(index * 0.4);
  const magnitude = Math.abs(value) || 1;

  const delta = magnitude * 0.9 + wobble * 2;
  const theta = magnitude * 0.6 + wobble;
  const alpha = magnitude * 0.5 - wobble * 1.5;
  const beta = magnitude * 0.3 + wobble * 0.5;
  const gamma = magnitude * 0.12;

  return {
    delta: round1(Math.max(0.5, delta)),
    theta: round1(Math.max(0.5, theta)),
    alpha: round1(Math.max(0.5, alpha)),
    beta: round1(Math.max(0.2, beta)),
    gamma: round1(Math.max(0.2, gamma)),
    alphaF3: round1(Math.max(0.5, alpha + 1)),
    alphaF4: round1(Math.max(0.5, alpha - 1)),
  };
}

function sampleFromRecord(record: Record<string, unknown>, index: number): EEGSample {
  const num = (key: string, fallback: number) => {
    const raw = record[key];
    const parsed = typeof raw === "number" ? raw : parseFloat(String(raw));
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const alpha = num("alpha", 20);
  return {
    timestamp: Date.now() + index,
    delta: num("delta", 25),
    theta: num("theta", 15),
    alpha,
    beta: num("beta", 10),
    gamma: num("gamma", 3),
    alphaF3: num("alphaF3", alpha + 1),
    alphaF4: num("alphaF4", alpha - 1),
  };
}

/** Parses a CSV string with a header row into EEGSample[]. */
export function parseCsv(text: string): { samples: EEGSample[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { samples: [], warnings: ["CSV needs a header row plus at least one data row."] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const hasBandColumns = ["delta", "theta", "alpha", "beta", "gamma"].some((b) => headers.includes(b));

  if (!hasBandColumns) {
    warnings.push("No delta/theta/alpha/beta/gamma columns found — treating first numeric column as a raw channel.");
  }

  const samples: EEGSample[] = lines.slice(1).map((line, i) => {
    const cells = line.split(",");
    if (hasBandColumns) {
      const record: Record<string, unknown> = {};
      headers.forEach((h, idx) => (record[h] = cells[idx]));
      return sampleFromRecord(record, i);
    }
    const firstNumeric = parseFloat(cells.find((c) => !Number.isNaN(parseFloat(c))) ?? "0");
    return { timestamp: Date.now() + i, ...deriveBandsFromScalar(firstNumeric, i) };
  });

  return { samples, warnings };
}

/** Parses a JSON string — either an array of band-labeled objects or plain numbers. */
export function parseJson(text: string): { samples: EEGSample[]; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { samples: [], warnings: ["Could not parse JSON — check for a trailing comma or missing bracket."] };
  }

  if (!Array.isArray(parsed)) {
    return { samples: [], warnings: ["Expected a JSON array of samples or numbers."] };
  }

  if (parsed.length > 0 && typeof parsed[0] === "number") {
    warnings.push("Array of plain numbers — treating each as a raw single-channel reading.");
    return {
      samples: (parsed as number[]).map((v, i) => ({ timestamp: Date.now() + i, ...deriveBandsFromScalar(v, i) })),
      warnings,
    };
  }

  const samples = (parsed as Record<string, unknown>[]).map((record, i) => sampleFromRecord(record, i));
  return { samples, warnings };
}

/** Parses freeform pasted numbers — commas, spaces, or newlines as separators. */
export function parseRawArrayText(text: string): { samples: EEGSample[]; warnings: string[] } {
  const numbers = text
    .split(/[\s,]+/)
    .map((token) => parseFloat(token))
    .filter((n) => Number.isFinite(n));

  if (numbers.length === 0) {
    return { samples: [], warnings: ["No numeric values found in the pasted text."] };
  }

  return {
    samples: numbers.map((v, i) => ({ timestamp: Date.now() + i, ...deriveBandsFromScalar(v, i) })),
    warnings: ["Pasted as a raw single-channel array — bands were derived, not measured."],
  };
}

/** Best-effort parser for a plain-text "label: value" EDF-like export. Real binary .edf needs a server-side EDF library. */
export function parseEdfLikeText(text: string): { samples: EEGSample[]; warnings: string[] } {
  const warnings = [
    "Binary .edf files can't be parsed in-browser — this reads a plain-text EDF-like export only.",
  ];
  const values = text
    .split(/\r?\n/)
    .map((line) => line.split(":").pop() ?? "")
    .map((v) => parseFloat(v))
    .filter((n) => Number.isFinite(n));

  if (values.length === 0) return { samples: [], warnings: [...warnings, "No numeric values recognized."] };

  return {
    samples: values.map((v, i) => ({ timestamp: Date.now() + i, ...deriveBandsFromScalar(v, i) })),
    warnings,
  };
}

function detectFormat(fileName: string): IngestedFileFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".edf")) return "edf-like";
  return "raw";
}

/** Entry point used by the File Upload panel's drag-and-drop / file input. */
export async function parseUploadedFile(file: File): Promise<FileIngestionResult> {
  const text = await file.text();
  const format = detectFormat(file.name);

  const { samples, warnings } =
    format === "csv"
      ? parseCsv(text)
      : format === "json"
      ? parseJson(text)
      : format === "edf-like"
      ? parseEdfLikeText(text)
      : parseRawArrayText(text);

  return { format, samples, sourceName: file.name, warnings };
}
