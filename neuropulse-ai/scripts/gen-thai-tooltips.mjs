// One-off: generate fully-correct Thai (WITH tone marks) for the 4 analytics
// chart-tooltip strings via the gateway model. The user-supplied drafts have
// tone-mark errors; the model corrects them. Writes the result with codepoint
// dumps to scripts/thai-tooltips-generated.json for human audit.
// Does NOT edit source files.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV = join(__dirname, "..", "..", "neuropulse-backend", ".env");
const OUT = join(__dirname, "thai-tooltips-generated.json");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const env = parseEnv(readFileSync(ENV, "utf8"));
const KEY = env.DEEPSEEK_API_KEY || "";
const ENDPOINT = env.DEEPSEEK_API_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL = env.DEEPSEEK_MODEL || "qwen3.8-27b-fp8";
if (!KEY) { console.log("NO_KEY"); process.exit(2); }

// Drafts as supplied (tone marks wrong) — keyed by chart.
const DRAFTS = {
  burnout: "วัดระดับความล้าและความเครียดสะสม (0-100%) ยิ่่งค่าน้อยแสดงว่าสมองฟื้่นตัวได้ดี",
  faa: "ดัชนีวัดสภาวะอารมณ์ ค่าเป็็นบวกบ่งบอกถึึงอารมณ์ผ่อ่นคลายและแรงจูงใจเชิงบวก",
  spindle: "จำนวน Spindle ต่อนาทีขณะหลัับ ยิ่่งสูงยิ่่งแสดงถึึงประสิทธิภาพการฟื้่นฟูความจำ",
  sws: "เปอร์เซ็นต์การหลัับสนิท (Deep Sleep) ช่ว่ งเวลาซ่อ่ มแซมร่่างกายและล่้างสารพิษในสมอง",
};

const EN = {
  burnout: "Measures accumulated fatigue and stress (0-100%). A lower value means the brain recovers well.",
  faa: "Index measuring emotional state. A positive value indicates a relaxed mood and positive motivation.",
  spindle: "Number of spindles per minute during sleep. Higher values indicate better memory-consolidation efficiency.",
  sws: "Percentage of deep sleep (Deep Sleep) — the period when the body repairs itself and the brain clears toxins.",
};

const SYS =
  "You are a professional UI localizer for an EEG brain-monitoring web app. " +
  "The user drafted 4 short Thai tooltip strings for chart titles, but the drafts contain tone-mark and vowel errors. " +
  "Rewrite each draft into natural, correct Thai with proper tone marks and vowels, keeping the same meaning and brevity. " +
  "Keep these technical/brand terms in their standard Latin form, do NOT translate them: Spindle, Deep Sleep, FAA. " +
  "Keep the '(0-100%)' and '(Deep Sleep)' parentheticals exactly as given. " +
  "Reply with ONLY a JSON object mapping each key (burnout, faa, spindle, sws) to the corrected Thai string. No commentary, no markdown fences.";

async function callModel() {
  const user = "Drafts (keyed):\n" + JSON.stringify(DRAFTS, null, 2) + "\n\nEnglish reference meaning (for accuracy only):\n" + JSON.stringify(EN, null, 2);
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

let got = null;
for (let attempt = 0; attempt < 3 && !got; attempt++) {
  try { got = await callModel(); }
  catch (e) { console.log(`attempt ${attempt + 1} failed: ${e.message}`); await new Promise(r => setTimeout(r, 2000)); }
}
if (!got) { console.log("MODEL_FAILED"); process.exit(3); }

const out = Object.keys(DRAFTS).map((k) => ({
  key: k,
  en: EN[k],
  draft: DRAFTS[k],
  th: got[k] ?? null,
  thCps: got[k] ? cps(got[k]) : null,
}));
writeFileSync(OUT, JSON.stringify(out, null, 2), "utf8");
const missing = out.filter((o) => !o.th).map((o) => o.key);
console.log(`wrote ${OUT}`);
console.log(`corrected ${out.length - missing.length}/${out.length} strings`);
if (missing.length) console.log("STILL MISSING: " + missing.join(" | "));
