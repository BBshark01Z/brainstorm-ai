// One-off: generate fully-correct Thai (WITH tone marks) for the new
// local-diagnostic fallback strings (lib/localDiagnostic.ts + the
// "ai.fallbackNote" i18n key) via the gateway model. Writes the result with
// codepoint dumps to scripts/thai-fallback-generated.json for human audit.
// Does NOT edit source files.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV = join(__dirname, "..", "..", "neuropulse-backend", ".env");
const OUT = join(__dirname, "thai-fallback-generated.json");

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

const EN_STRINGS = [
  "The connection to DeepSeek AI failed or returned no reply — here is a rule-based summary from your EEG data:",
  "No live EEG data is available to analyze right now. Please connect a live EEG stream and ask again.",
  "Focus score {value} — your brain is in a strong focus state.",
  "Focus score {value} — moderate focus state.",
  "Focus score {value} — low focus; your brain would benefit from a short break.",
  "Stress level {value} — elevated; consider a recovery activity such as slow deep breathing or a short eye rest.",
  "Stress level {value} — within a range worth monitoring.",
  "Stress level {value} — within a normal range.",
  "Mental fatigue {value} — elevated; plan short breaks between tasks.",
  "Mental fatigue {value} — moderate.",
  "Mental fatigue {value} — within a normal range.",
  "Relative band power: delta {delta} · theta {theta} · alpha {alpha} · beta {beta} · gamma {gamma}",
  "This is preliminary screening, not a clinical diagnosis — reconnect to DeepSeek AI and ask again for a deeper analysis.",
  "Local rule-based estimate (DeepSeek returned no reply)",
];

const SYS =
  "You are a professional UI localizer for an EEG brain-monitoring web app. " +
  "Translate the given English UI strings into natural, correct Thai with proper tone marks and vowels. " +
  "Keep these technical/brand terms in their standard Latin form, do NOT translate them: " +
  "EEG, AI, Brainprint, Brainstorm, DeepSeek, rule-based, delta, theta, alpha, beta, gamma, " +
  "band power, clinical diagnosis, stream. " +
  "Use natural, correct Thai transliterations for any other borrowed words. " +
  "Preserve any {placeholder} tokens exactly as-is ({value}, {delta}, {theta}, {alpha}, {beta}, {gamma}). " +
  "Preserve numbers, units and the ' · ' separator exactly. " +
  "Reply with ONLY a JSON object mapping each English string to its Thai translation. No commentary, no markdown fences.";

async function callModel(enToTh) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [ { role: "system", content: SYS }, { role: "user", content: JSON.stringify(enToTh) } ] }),
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

const enToTh = {};
for (const s of EN_STRINGS) enToTh[s] = "";
let got = null;
for (let attempt = 0; attempt < 3 && !got; attempt++) {
  try { got = await callModel(enToTh); }
  catch (e) { console.log(`attempt ${attempt + 1} failed: ${e.message}`); await new Promise(r => setTimeout(r, 2000)); }
}
if (!got) { console.log("MODEL_FAILED"); process.exit(3); }

const out = EN_STRINGS.map((en) => ({
  en,
  th: got[en] ?? null,
  thCps: got[en] ? cps(got[en]) : null,
}));
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
const missing = out.filter((o) => !o.th).map((o) => o.en);
console.log(`wrote ${OUT}`);
console.log(`translated ${out.length - missing.length}/${out.length} strings`);
if (missing.length) console.log("STILL MISSING: " + missing.join(" | "));
