// Calibration: call the gateway model with a few known English words and dump
// the codepoints of its Thai output. This gives a CLEAN view of the model's real
// output (no corruption from hand-typed Thai) so we can (a) judge model quality
// and (b) confirm we can decode codepoint dumps reliably.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "..", "neuropulse-backend", ".env");
function parseEnv(t){const o={};for(const l of t.split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);if(m)o[m[1]]=m[2].replace(/^["']|["']$/g,"");}return o;}
const env = parseEnv(readFileSync(envPath, "utf8"));
const KEY = env.DEEPSEEK_API_KEY, EP = env.DEEPSEEK_API_ENDPOINT, MODEL = env.DEEPSEEK_MODEL;

const words = ["Home","Loading...","Connect","Data","Password","Analytics","Streaming","Verified"];
const sys = "You are a professional UI localizer for an EEG brain-monitoring web app. Translate each English UI string into natural, correct Thai (ภาษาไทย) with proper tone marks (วรรณยุกต์) and vowels. Keep EEG, AI, Brainprint, WebSocket, DeepSeek, LIVE, VERIFIED in standard form. Reply with ONLY a JSON object mapping each English string to its Thai translation. No commentary, no markdown fences.";
const res = await fetch(EP, { method:"POST", headers:{Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"}, body: JSON.stringify({model:MODEL, messages:[{role:"system",content:sys},{role:"user",content:JSON.stringify(Object.fromEntries(words.map(w=>[w,""])))}]}) });
const data = await res.json();
let content = (data.choices?.[0]?.message?.content||"").replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
const s=content.indexOf("{"), e=content.lastIndexOf("}");
const map = JSON.parse(content.slice(s,e+1));
for (const w of words) {
  const th = map[w] ?? "(missing)";
  const cps = [...th].map(c=>{const cp=c.codePointAt(0);return cp>=0xe00?"0E"+cp.toString(16).toUpperCase():cp>=32&&cp<127?c:"?"+cp;});
  console.log(`${w}\t=>\t${cps.join(" ")}`);
}
