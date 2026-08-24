// Generate fully-correct Thai (WITH tone marks) for every key in translations.ts
// via the gateway model. Does NOT touch translations.ts — writes the result to
// scripts/thai-generated.json (with codepoint dumps) for human audit first.
//
// - Reads the English value (source of truth) for each key.
// - Sends keys to the model in batches; model returns { "<english>": "<thai>" }.
// - Any key the model drops is retried alone; if still missing it is reported.
// - The API key is read from neuropulse-backend/.env and NEVER printed.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "lib", "i18n", "translations.ts");
const ENV = join(__dirname, "..", "..", "neuropulse-backend", ".env");
const OUT = join(__dirname, "thai-generated.json");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = parseEnv(readFileSync(ENV, "utf8"));
const KEY = env.DEEPSEEK_API_KEY || "";
const ENDPOINT = env.DEEPSEEK_API_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = env.DEEPSEEK_MODEL || "qwen3.8-27b-fp8";
if (!KEY) { console.log("NO_KEY"); process.exit(2); }

// --- 1. Parse the current file: ordered list of { key, th, en }
const src = readFileSync(FILE, "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,\s*en:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
const entries = [];
let m;
while ((m = re.exec(src)) !== null) {
  entries.push({ key: m[1], th: (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1"), en: (m[4] ?? m[5] ?? "").replace(/\\(.)/g, "$1") });
}
console.log(`parsed ${entries.length} keys`);

// --- 2. Ask the model for Thai, in batches
// NOTE: no Thai examples are given in the prompt — hand-typed Thai examples
// would be corrupted and would prime the model with the wrong spellings.
const SYS =
  "You are a professional UI localizer for an EEG brain-monitoring web app. " +
  "Translate the given English UI strings into natural, correct Thai with proper tone marks and vowels. " +
  "Keep these technical/brand terms in their standard Latin form, do NOT translate them: " +
  "EEG, AI, Brainprint, Brainstorm, DeepSeek, WebSocket, LIVE, VERIFIED, IMPROVING, REM, N1, N2, N3, FAA, OOD, SD, " +
  "PhysioNet, Sleep Cassette, Sleep-EDF, Uvicorn, backend, JSON, CSV, Python, Neuro, Tech, Stream, Monitor, Heartbeat, " +
  "Endpoint, ON, band power, baseline, burnout, recovery, epoch, spindle, slow-wave sleep, rule-based, model endpoint, " +
  "signal-processing, biometric, identity, longitudinal, prototype, alpha, beta, gamma, delta, theta. " +
  "Use natural, correct Thai transliterations for any other borrowed words. " +
  "Preserve any {placeholder} tokens exactly as-is (e.g. {name}, {count}, {date}, {score}, {status}, {message}, {value}, {unit}, {times}, {file}, {id}, {filter}, {total}, {label}, {format}). " +
  "Preserve numbers and units (150ms, 300ms, 0-100, 3/4, 20, 30, 8765, µV, %, ±). " +
  "Reply with ONLY a JSON object mapping each English string to its Thai translation. No commentary, no markdown fences.";

async function callModel(enToTh) {
  const user = JSON.stringify(enToTh);
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [ { role: "system", content: SYS }, { role: "user", content: user } ] }),
  });
  if (!res.ok) throw new Error("HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  let content = data.choices?.[0]?.message?.content || "";
  content = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("no JSON in model output: " + content.slice(0, 120));
  return JSON.parse(content.slice(start, end + 1));
}

const cps = (s) => [...s].map((c) => { const cp = c.codePointAt(0); return cp >= 0xe00 ? "0E" + cp.toString(16).toUpperCase() : (cp >= 32 && cp < 127 ? c : "?"); }).join(" ");

const BATCH = 15;
const thByEn = {};
for (let i = 0; i < entries.length; i += BATCH) {
  const batch = entries.slice(i, i + BATCH);
  const enToTh = {};
  for (const e of batch) enToTh[e.en] = "";
  let got = null;
  for (let attempt = 0; attempt < 3 && !got; attempt++) {
    try { got = await callModel(enToTh); }
    catch (e) { console.log(`  batch ${i/BATCH} attempt ${attempt+1} failed: ${e.message}`); await new Promise(r => setTimeout(r, 2000)); }
  }
  if (!got) { console.log(`  WARNING: batch ${i/BATCH} failed entirely`); continue; }
  for (const e of batch) {
    if (got[e.en] !== undefined && got[e.en] !== "") thByEn[e.en] = got[e.en];
  }
  console.log(`  batch ${Math.floor(i/BATCH)+1}: got ${batch.filter(e => thByEn[e.en]).length}/${batch.length}`);
}

// --- 3. Per-key fallback for anything still missing
const missing = entries.filter(e => !thByEn[e.en]);
for (const e of missing) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const got = await callModel({ [e.en]: "" });
      if (got[e.en]) { thByEn[e.en] = got[e.en]; break; }
    } catch (err) { /* retry */ }
  }
}

// --- 4. Save for audit (key, en, old th, new th, new-th codepoints)
const out = entries.map(e => ({
  key: e.key,
  en: e.en,
  oldTh: e.th,
  newTh: thByEn[e.en] ?? null,
  newThCps: thByEn[e.en] ? cps(thByEn[e.en]) : null,
}));
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
const stillMissing = entries.filter(e => !thByEn[e.en]).map(e => e.key);
console.log(`\nwrote ${OUT}`);
console.log(`translated ${entries.length - stillMissing.length}/${entries.length} keys`);
if (stillMissing.length) console.log("STILL MISSING: " + stillMissing.join(", "));
