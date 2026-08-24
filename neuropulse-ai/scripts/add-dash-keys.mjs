// One-shot: insert dashboard (dash.*) i18n keys before the closing `};` of the
// translations object. Run with: node scripts/add-dash-keys.mjs
// Idempotency guard: aborts if dash.home already present.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "lib", "i18n", "translations.ts");
const src = readFileSync(file, "utf8");

if (src.includes('"dash.home"')) {
  console.error("dash.home already present — aborting to avoid duplicates.");
  process.exit(1);
}

const block = `
  // --- Dashboard / Live Monitor ---
  "dash.home": { th: "หน้าหลัก", en: "Home" },
  "dash.shareTitle": { th: "EEG Monitor — {date}", en: "EEG Monitor — {date}" },
  "dash.deviceName": { th: "EEG Stream", en: "EEG Stream" },
  "dash.about": { th: "เกี่ยวกับโปรเจกต์นี้", en: "About this project" },
  "dash.aboutBody": { th: "Brainstorm เป็นแพลตฟอร์ม NeuroTech ทดลองที่สำรวจว่า pipeline การติดตาม + วิเคราะห์ EEG แบบ end-to-end เป็นอย่างไร โดยค่าเริ่มต้นทุกอย่างทำงานบนข้อมูลจำลอง — ตัวสร้างสัญญาณสังเคราะห์หรือไฟล์ที่อัปโหลดทำหน้าที่แทนอุปกรณ์ EEG จริง และ AI consultant จะถอยกลับเป็นคำตอบแบบ rule-based ในเครื่องเมื่อ model endpoint ใช้ไม่ได้ เป็นโปรเจกต์เพื่อเรียนรู้ที่สร้างมาเพื่อ prototype เส้นทาง signal-processing จริง, การระบุตัวตนทางชีวภาพ, การวิเคราะห์ตามเวลา และชั้น AI interpretation — ไม่ใช่เครื่องมือทางคลินิกที่ผ่านการตรวจสอบ", en: "Brainstorm is an experimental NeuroTech platform exploring what an end-to-end EEG monitoring + analytics pipeline looks like. By default everything runs on simulated data — a synthetic signal generator or uploaded files stand in for a real EEG device, and the AI consultant falls back to local rule-based responses when the model endpoint is unavailable. It's a learning project built to prototype the real signal-processing path, biometric identity, longitudinal analysis, and an AI interpretation layer — not a validated clinical tool." },
  "dash.step1Title": { th: "EEG สดหรือข้อมูลอัปโหลด", en: "Live EEG or uploaded data" },
  "dash.step1Body": { th: "เชื่อมต่อ WebSocket stream เพื่อดู band power ที่คำนวณแบบสด หรืออัปโหลด/วางไฟล์ EEG (CSV, JSON หรือ raw samples) เพื่อเล่นซ้ำบน waveform chart", en: "Connect to a WebSocket stream to see computed band powers live, or upload / paste an EEG file (CSV, JSON, or raw samples) to replay it on the waveform chart." },
  "dash.step2Title": { th: "Brainprint ระบุตัวตน", en: "Brainprint identity" },
  "dash.step2Body": { th: "จับภาพ EEG เพื่อสร้าง brainprint ส่วนตัว — ลายเซ็นชีวภาพ — แล้วตรวจสอบเทียบใน session ถัดไป", en: "Capture an EEG reading to build a personal brainprint — a biometric signature — then verify against it on later sessions." },
  "dash.step3Title": { th: "การวิเคราะห์ตามเวลา", en: "Longitudinal analytics" },
  "dash.step3Body": { th: "ดูว่าตัวบ่งชี้หลัก (ความเสี่ยง burnout, FAA, sleep spindle density, slow-wave sleep) เปลี่ยนแปลงอย่างไรตามเวลา และเปรียบเทียบกับ baseline 30 วันล่าสุดของคุณ", en: "Review how key markers (burnout risk, FAA, sleep spindle density, slow-wave sleep) trend over time and compare against your recent 30-day baseline." },
  "dash.step4Title": { th: "AI neuro-consultant", en: "AI neuro-consultant" },
  "dash.step4Body": { th: "ถาม AI assistant ให้ตีความ EEG context ของคุณและชี้สิ่งที่น่าจับตา — พร้อม fallback แบบ rule-based ในเครื่องเมื่อ model endpoint ติดต่อไม่ได้", en: "Ask an AI assistant to interpret your EEG context and surface what's worth watching — with a local rule-based fallback whenever the model endpoint is unreachable." },
  "dash.dataInput": { th: "อินพุตข้อมูลแบบเรียลไทม์", en: "Real-Time Data Input" },
  "dash.modeFile": { th: "อัปโหลดไฟล์", en: "File Upload" },
  "dash.modeWebSocket": { th: "WebSocket", en: "WebSocket" },
  "dash.dropPrefix": { th: "ลากไฟล์", en: "Drop a" },
  "dash.dropMid": { th: "หรือ", en: "or" },
  "dash.dropSuffix": { th: "มาวาง หรือคลิกเพื่อเลือก", en: "file, or click to browse" },
  "dash.pasteLabel": { th: "หรือวางข้อมูลดิบ", en: "Or paste raw data" },
  "dash.pastePlaceholder": { th: "e.g. 12.4, 15.1, 9.8, 22.3 ...", en: "e.g. 12.4, 15.1, 9.8, 22.3 ..." },
  "dash.playPasted": { th: "เล่นอาร์เรย์ที่วาง", en: "Play Pasted Array" },
  "dash.pause": { th: "หยุด", en: "Pause" },
  "dash.play": { th: "เล่น", en: "Play" },
  "dash.samplesCount": { th: "{count} samples · {format}", en: "{count} samples · {format}" },
  "dash.ws.disconnected": { th: "ตัดการเชื่อมต่อ", en: "Disconnected" },
  "dash.ws.disconnectedSub": { th: "เชื่อมต่อเพื่อเริ่มสตรีม", en: "Connect to start streaming" },
  "dash.ws.connecting": { th: "กำลังเชื่อมต่อ…", en: "Connecting…" },
  "dash.ws.connectingSub": { th: "กำลังสร้าง WebSocket link", en: "Establishing WebSocket link" },
  "dash.ws.connected": { th: "สตรีมมิง", en: "Streaming" },
  "dash.ws.connectedSub": { th: "ข้อมูล EEG สดไหลเข้ามา", en: "Live EEG data flowing" },
  "dash.ws.error": { th: "เชื่อมต่อล้มเหลว", en: "Connection Failed" },
  "dash.ws.errorSub": { th: "ตรวจสอบ backend หรือลองใหม่อีกครั้ง", en: "Check backend or try again" },
  "dash.copyShareLink": { th: "คัดลอกลิงก์แชร์", en: "Copy share link" },
  "dash.copied": { th: "คัดลอกแล้ว!", en: "Copied!" },
  "dash.share": { th: "แชร์", en: "Share" },
  "dash.disconnect": { th: "ตัดการเชื่อมต่อ", en: "Disconnect" },
  "dash.connect": { th: "เชื่อมต่อ", en: "Connect" },
  "dash.wsEndpoint": { th: "WebSocket Endpoint", en: "WebSocket Endpoint" },
  "dash.live": { th: "สด", en: "Live" },
  "dash.intervals": { th: "ทุก ~300ms", en: "~300ms intervals" },
  "dash.heartbeat": { th: "Heartbeat", en: "Heartbeat" },
  "dash.on": { th: "ON", en: "ON" },
  "dash.autoReconnect": { th: "เปิด auto-reconnect · สูงสุด 50 ครั้ง", en: "Auto-reconnect enabled · Max 50 attempts" },
  "dash.wsInfoPrefix": { th: "คาดหวังเฟรม JSON แยกด้วยบรรทัดในรูป", en: "Expects newline-delimited JSON frames shaped like" },
  "dash.wsInfoSuffix": { th: "จาก Python EEG bridge ของคุณ", en: "from your Python EEG bridge." },
  "dash.waveformTitle": { th: "EEG Waveform หลายช่อง", en: "Multi-Channel EEG Waveform" },
  "dash.waveformSub": { th: "band power แบบสด · µV", en: "Live band power · µV" },
  "dash.headsetLink": { th: "ลิงก์เฮดเซต", en: "Headset Link" },
  "dash.noConnection": { th: "ยังไม่มีเชื่อมต่อ", en: "No Connection" },
  "dash.noConnectionHint": { th: "เชื่อมต่อ backend เพื่อเริ่มติดตาม", en: "Connect to a backend to start monitoring" },
  "dash.signal": { th: "สัญญาณ", en: "Signal" },
  "dash.battery": { th: "แบตเตอรี่", en: "Battery" },
  "dash.impedance": { th: "ความต้านทานอิเล็กโทรด", en: "Electrode Impedance" },
  "dash.channelsNominal": { th: "ทุกช่องทางปกติ · {count} อิเล็กโทรด", en: "All channels nominal · {count} electrodes" },
  "dash.createShareTitle": { th: "สร้างลิงก์รายงานที่แชร์ได้", en: "Create shareable report link" },
  "dash.creating": { th: "กำลังสร้าง...", en: "Creating..." },
  "dash.shareReport": { th: "แชร์รายงาน", en: "Share Report" },
  "dash.copyLink": { th: "คัดลอกลิงก์", en: "Copy Link" }
`;

const idx = src.indexOf("\n};");
if (idx === -1) {
  console.error("Could not find closing \\n}; of translations object.");
  process.exit(1);
}

const out = src.slice(0, idx) + block + src.slice(idx);
writeFileSync(file, out, "utf8");
console.log("Inserted dash.* keys before line", src.slice(0, idx).split("\n").length);
