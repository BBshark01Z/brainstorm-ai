// Calibrate a PROOFREADING pass: feed the model its own generated Thai (read
// from file, not hand-typed) + the English, ask it to fix missing/incorrect
// Thai vowel marks and tone marks. Dump codepoints of the corrected output so
// we can verify at codepoint level (the only reliable check).
//
// Known-bad calibration key:
//   nav.home "Home" -> correct is หน้าแรก = 0E2B 0E31 0E19 0E49 0E32 0E41 0E23 0E49 0E01
//   (model produced 0E2B 0E19 0E49 0E32 0E41 0E23 0E01 — dropped 0E31 after ห and 0E49 after ร)
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV = join(__dirname, "..", "..", "neuropulse-backend", ".env");
function parseEnv(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(m)o[m[1]]=m[2].replace(/^["']|["']$/g,"");}return o;}
const env = parseEnv(readFileSync(ENV, "utf8"));
const KEY = env.DEEPSEEK_API_KEY, ENDPOINT = env.DEEPSEEK_API_ENDPOINT, MODEL = env.DEEPSEEK_MODEL;
if (!KEY) { console.log("NO_KEY"); process.exit(2); }

const data = JSON.parse(readFileSync(join(__dirname, "thai-generated.json"), "utf8"));
const want = ["nav.home", "dash.home", "bp.scanner.holdStill", "an.chart.spindle", "ai.welcome"];
const picks = data.filter(e => want.includes(e.key));

const SYS =
  "You are a Thai proofreader. You are given English UI strings and a Thai " +
  "translation for each. The Thai translations may be MISSING vowel marks or " +
  "tone marks, or have incorrect consonants. Your job is to return a corrected " +
  "Thai translation for each, with ALL required vowel marks and tone marks " +
  "present and in the correct positions, and correct consonants. " +
  "Keep technical/brand terms in Latin (EEG, AI, Brainprint, DeepSeek, etc.). " +
  "Preserve {placeholder} tokens and numbers/units exactly. " +
  "Reply with ONLY a JSON object mapping each English string to its corrected Thai. " +
  "No commentary, no markdown fences.";

async function callModel(map) {
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: [ { role: "system", content: SYS }, { role: "user", content: JSON.stringify(map) } ] }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const d = await res.json();
      let c = (d.choices?.[0]?.message?.content || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      const s = c.indexOf("{"), e = c.lastIndexOf("}");
      if (s < 0 || e < 0) throw new Error("no JSON: " + c.slice(0, 100));
      return JSON.parse(c.slice(s, e + 1));
    } catch (err) {
      lastErr = err;
      console.log(`  attempt ${attempt + 1} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const cps = (s) => [...s].map((c) => { const n = c.codePointAt(0); return n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : (n >= 32 && n < 127 ? c : "·"); }).join(" ");

const enToTh = {};
for (const p of picks) enToTh[p.en] = p.newTh;
const fixed = await callModel(enToTh);
for (const p of picks) {
  const corrected = fixed[p.en];
  console.log(`\n## ${p.key}  (en: ${p.en})`);
  console.log(`   before: ${cps(p.newTh)}`);
  console.log(`   after : ${corrected ? cps(corrected) : "(missing)"}`);
}
