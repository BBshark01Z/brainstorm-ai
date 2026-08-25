// Splice the 4 model-corrected Thai tooltip strings into translations.ts
// WITHOUT re-typing them (terminal/hand-typing mangles Thai). Reads the exact
// bytes from thai-tooltips-generated.json and inserts new i18n keys after the
// "an.chart.swsSub" line. Also runs a mechanical well-formedness check.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gen = JSON.parse(readFileSync(new URL("./thai-tooltips-generated.json", import.meta.url), "utf8"));
const th = Object.fromEntries(gen.map((o) => [o.key, o.th]));
const TRANS = new URL("../lib/i18n/translations.ts", import.meta.url);
let src = readFileSync(TRANS, "utf8");

// English values (ASCII — safe to hardcode).
const EN = {
  burnout: "Measures accumulated fatigue and stress (0-100%). A lower value means the brain recovers well.",
  faa: "Index measuring emotional state. A positive value indicates a relaxed mood and positive motivation.",
  spindle: "Number of spindles per minute during sleep. Higher values indicate better memory-consolidation efficiency.",
  sws: "Percentage of deep sleep (Deep Sleep) — the period when the body repairs itself and the brain clears toxins.",
};

// --- Mechanical well-formedness check (model-independent) ---
function checkWellFormed(key, s) {
  const problems = [];
  for (const c of s) {
    const cp = c.codePointAt(0);
    const isAscii = cp >= 0x20 && cp <= 0x7e;
    const isThai = cp >= 0x0e00 && cp <= 0x0e7f;
    const isSpace = cp === 0x20;
    if (!isAscii && !isThai && !isSpace) {
      problems.push(`unexpected codepoint U+${cp.toString(16).toUpperCase()}`);
    }
    // Mojibake zone: Latin-1 supplement / control — a sign of encoding corruption.
    if (cp >= 0x80 && cp <= 0x2ff && !isThai) problems.push(`mojibake U+${cp.toString(16).toUpperCase()}`);
  }
  // Basic rank-order: a tone mark (0E49-0E4D) must not lead a Thai run.
  const cpsArr = [...s].map((c) => c.codePointAt(0));
  for (let i = 0; i < cpsArr.length; i++) {
    const cp = cpsArr[i];
    const isTone = cp >= 0x0e49 && cp <= 0x0e4d;
    if (!isTone) continue;
    // find start of the current Thai run
    let j = i;
    while (j > 0 && cpsArr[j - 1] >= 0x0e00 && cpsArr[j - 1] <= 0x0e7f) j--;
    // the run must contain a consonant (0E01-0E5B range consonants) before the tone
    const run = cpsArr.slice(j, i);
    const hasConsonant = run.some((x) => x >= 0x0e01 && x <= 0x0e5b && !(x >= 0x0e30 && x <= 0x0e39) && !(x >= 0x0e40 && x <= 0x0e45) && !(x >= 0x0e46 && x <= 0x0e48));
    if (!hasConsonant) problems.push(`tone mark at pos ${i} has no preceding consonant in run`);
  }
  return problems;
}

// Build the set of Thai codepoints already used by the verified dictionary.
const dictThaiCps = new Set();
for (const c of src) { const cp = c.codePointAt(0); if (cp >= 0x0e00 && cp <= 0x0e7f) dictThaiCps.add(cp); }

let allOk = true;
for (const key of ["burnout", "faa", "spindle", "sws"]) {
  if (!th[key]) { console.log(`MISSING model output for ${key}`); allOk = false; continue; }
  const problems = checkWellFormed(key, th[key]);
  // Every Thai codepoint in the model output should already appear in the
  // verified dictionary — a proxy for "no hallucinated/mojibake codepoints".
  const novel = [...th[key]].map((c) => c.codePointAt(0)).filter((cp) => cp >= 0x0e00 && cp <= 0x0e7f && !dictThaiCps.has(cp));
  if (novel.length) problems.push(`codepoints not in verified dict: ${novel.map((x) => "U+" + x.toString(16).toUpperCase()).join(",")}`);
  if (problems.length) { console.log(`CHECK FAIL ${key}: ${problems.join("; ")}`); allOk = false; }
  else console.log(`OK ${key} (well-formed, all codepoints in verified dict)`);
}
if (!allOk) { console.log("ABORT: check failed, not editing file."); process.exit(1); }

// --- Splice the 4 keys after the "an.chart.swsSub" line ---
const anchor = '"an.chart.swsSub":';
const idx = src.indexOf(anchor);
if (idx < 0) { console.log("ABORT: anchor 'an.chart.swsSub' not found"); process.exit(1); }
// find end of that line
const eol = src.indexOf("\n", idx);
const insertAt = eol + 1;

const jsStr = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const lines = [
  `  "an.chart.burnoutInfo": { th: "${jsStr(th.burnout)}", en: "${jsStr(EN.burnout)}" },`,
  `  "an.chart.faaInfo": { th: "${jsStr(th.faa)}", en: "${jsStr(EN.faa)}" },`,
  `  "an.chart.spindleInfo": { th: "${jsStr(th.spindle)}", en: "${jsStr(EN.spindle)}" },`,
  `  "an.chart.swsInfo": { th: "${jsStr(th.sws)}", en: "${jsStr(EN.sws)}" },`,
].join("\n");

src = src.slice(0, insertAt) + lines + "\n" + src.slice(insertAt);
writeFileSync(TRANS, src, "utf8");
console.log("inserted 4 tooltip keys after an.chart.swsSub");

// Re-read and confirm the keys are present with the exact model bytes.
const after = readFileSync(TRANS, "utf8");
for (const key of ["burnout", "faa", "spindle", "sws"]) {
  const k = `an.chart.${key}Info`;
  const re = new RegExp(`"${k}":\\s*\\{\\s*th:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "m");
  const m = after.match(re);
  const cps = m ? [...m[1]].map((c) => { const cp = c.codePointAt(0); return cp >= 0xe00 ? "0E" + cp.toString(16).toUpperCase() : (cp >= 32 && cp < 127 ? c : "?"); }).join(" ") : "NOT FOUND";
  console.log(`verify ${k}: ${cps}`);
}
