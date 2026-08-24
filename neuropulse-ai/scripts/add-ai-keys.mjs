// One-shot: insert AI consultant (ai.*) i18n keys before the closing `};` of
// the translations object. Run with: node scripts/add-ai-keys.mjs
// Idempotency guard: aborts if ai.title already present.
//
// ai.welcomeNoAuth reuses the Thai string already hardcoded in
// AIChatInterface.tsx (extracted at runtime, tone marks stripped) so the
// dictionary copy matches what users currently see.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "lib", "i18n", "translations.ts");
const src = readFileSync(file, "utf8");

if (src.includes('"ai.title"')) {
  console.error("ai.title already present — aborting (idempotency guard).");
  process.exit(1);
}

// Extract the existing Thai no-auth welcome from the component.
const comp = readFileSync(join(here, "..", "components", "ai", "AIChatInterface.tsx"), "utf8");
const m = comp.match(/content:\n\s+"([^"]*)"/);
if (!m) {
  console.error("Could not find the no-auth welcome string — aborting.");
  process.exit(1);
}
const welcomeNoAuthTh = m[1].replace(/[่-๋]/g, "");

const BLOCK = `
  // --- AI Consultant (page 5) ---
  "ai.title": { th: "ที่ปรึกษาประสาท AI", en: "AI Neuro-Consultant" },
  "ai.poweredBy": { th: "ขับเคลื่อนด้วย DeepSeek AI", en: "Powered by DeepSeek AI" },
  "ai.welcomeNoAuth": { th: "${welcomeNoAuthTh}", en: "Welcome. Please sign in to start a conversation with the AI Neuro-Consultant." },
  "ai.welcome": { th: "ผมคือที่ปรึกษาประสาทของคุณ ถามเรื่องสุขภาพสมอง โปรโตคอลการฟื้นตัว หรือการวิเคราะห์ EEG ได้เลย", en: "I'm your Neuro-Consultant. Ask me about your brain health, recovery protocols, or EEG analysis." },
  "ai.histError": { th: "โหลดประวัติการสนทนาล้มเหลว", en: "Failed to load chat history" },
  "ai.notAuth": { th: "ยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบก่อน", en: "Not authenticated. Please log in." },
  "ai.unknownError": { th: "ข้อผิดพลาดที่ไม่ทราบสาเหตุ", en: "Unknown error" },
  "ai.error": { th: "ข้อผิดพลาด", en: "Error" },
  "ai.errorPrefix": { th: "ข้อผิดพลาด: {message}", en: "Error: {message}" },
  "ai.statusLiveTitle": { th: "เชื่อมต่อกับ DeepSeek AI — วิเคราะห์จริง", en: "Connected to DeepSeek AI — real analysis" },
  "ai.live": { th: "สด", en: "Live" },
  "ai.analyzing": { th: "กำลังวิเคราะห์รูปแบบประสาท…", en: "Analyzing neural patterns…" },
  "ai.chip.analyze": { th: "วิเคราะห์สภาวะสมองของฉันตอนนี้", en: "Analyze my current brain state" },
  "ai.chip.stress": { th: "ทำไมความเครียดของฉันถึงสูง?", en: "Why is my stress high?" },
  "ai.chip.recovery": { th: "สร้างโปรโตคอลการฟื้นตัวให้ฉัน", en: "Generate a recovery protocol" },
  "ai.chip.bands": { th: "อธิบายแบนด์ EEG ของฉันให้ฟัง", en: "Explain my EEG bands" },
  "ai.inputPlaceholder": { th: "ถามเกี่ยวกับสุขภาพสมองของคุณ…", en: "Ask about your brain health…" },
  "ai.diag.title": { th: "การวินิจฉัย AI อัตโนมัติรายวัน", en: "Automated Daily AI Diagnostics" },
  "ai.diag.empty": { th: "ยังไม่มีผลวินิจฉัย", en: "No diagnostics yet" },
  "ai.diag.emptyHint": { th: "เชื่อมต่อสตรีม EEG สดและทำสแกน Brainprint เพื่อสร้างอินไซต์รายวันอัตโนมัติที่นี่", en: "Connect a live EEG stream and complete a Brainprint scan to generate automated daily insights here." }
`;

const anchor = 'not a diagnosis)" }\n\n};';
if (!src.includes(anchor)) {
  console.error("Anchor not found — aborting.");
  process.exit(1);
}

// House style: the dictionary is written without Thai tone marks
// (U+0E48–U+0E4B) — strip them so the new keys match the existing ones.
const normalized = BLOCK.replace(/[่-๋]/g, "");

const out = src.replace(anchor, 'not a diagnosis)" },\n' + normalized + "\n};");
writeFileSync(file, out, "utf8");
console.log("Inserted ai.* keys.");
