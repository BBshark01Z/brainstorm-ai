// One-off: generate Thai translations for the new credits.* i18n keys via
// the gateway model, print as a JSON object {key: thai}.
import fs from "node:fs";

const envPath = "../neuropulse-backend/.env";
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);

const KEYS = [
  ["credits.title", "About the Developers"],
  ["credits.close", "Close"],
  ["credits.devLabel", "Developer & Lead Creator"],
  [
    "credits.smteNotice",
    "This project was created exclusively for competing in the SMTE (Science, Mathematics, Technology, and Environment) Project Competition from Ayutthayawitthalai School Team<3.",
  ],
  ["credits.techStack", "Tech Stack"],
  ["credits.backendTitle", "Backend & Core Engineering"],
  ["credits.frontendTitle", "Frontend & UI/UX Engineering"],
  ["credits.backend.backend1", "FastAPI REST API architecture"],
  [
    "credits.backend.backend2",
    "EEG signal processing (Band Power: Delta, Theta, Alpha, Beta, Gamma) & sleep staging algorithms",
  ],
  ["credits.backend.backend3", "SQLite schema design with Phase 4 automated seed migration"],
  [
    "credits.backend.backend4",
    "DeepSeek/Qwen LLM integration with latency/thinking-mode optimizations",
  ],
  ["credits.backend.backend5", "Render Cloud deployment"],
  ["credits.frontend.frontend1", "Next.js (App Router) dark-mode cyber-health UI design"],
  ["credits.frontend.frontend2", "Real-time Brain Monitor & Longitudinal Analytics charts"],
  [
    "credits.frontend.frontend3",
    "API state management with resilient offline fallback handling",
  ],
  ["credits.frontend.frontend4", "Multi-language support (TH/EN)"],
  ["credits.frontend.frontend5", "Vercel Edge Deployment"],
];

const prompt = `You are a professional Thai translator for a dark-mode cyber-health brain app UI. Translate the given English UI strings into natural, correct Thai — fully correct Thai spelling WITH proper tone marks and vowels, concise UI style.

Rules:
- Output ONLY a JSON object, no markdown fences, no extra text.
- Keys exactly as given; values in Thai.
- Keep technical/brand tokens in their original form: FastAPI, REST API, EEG, Band Power, Delta, Theta, Alpha, Beta, Gamma, SQLite, Phase 4, DeepSeek, Qwen, LLM, Render Cloud, Next.js, App Router, Brain Monitor, Longitudinal Analytics, API, TH/EN, Vercel Edge Deployment, SMTE, Ayutthayawitthalai School.
- Keep "Team<3" exactly as in the source.

Strings:
${JSON.stringify(Object.fromEntries(KEYS), null, 2)}`;

const res = await fetch(env.DEEPSEEK_API_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
  },
  body: JSON.stringify({
    model: env.DEEPSEEK_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  }),
});

if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}

const data = await res.json();
const text = data.choices?.[0]?.message?.content ?? "";
console.log("=== RAW ===");
console.log(text);
const start = text.indexOf("{");
const end = text.lastIndexOf("}");
const parsed = JSON.parse(text.slice(start, end + 1));
fs.writeFileSync("credits-thai.json", JSON.stringify(parsed, null, 2));
console.log("=== PARSED OK, saved to credits-thai.json ===");
