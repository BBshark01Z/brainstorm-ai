// One-shot: insert brainprint (bp.*) i18n keys before the closing `};` of the
// translations object. Run with: node scripts/add-bp-keys.mjs
// Idempotency guard: aborts if bp.title already present.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "lib", "i18n", "translations.ts");
const src = readFileSync(file, "utf8");

if (src.includes('"bp.title"')) {
  console.error("bp.title already present — aborting (idempotency guard).");
  process.exit(1);
}

const BLOCK = `
  // --- Brainprint (page 3) ---
  "bp.title": { th: "ยืนยันตัวตนด้วย Brainprint", en: "Brainprint Biometric Authentication" },
  "bp.shareTitle": { th: "รายงาน Brainprint — {date}", en: "Brainprint Report — {date}" },
  "bp.loadingProfiles": { th: "กำลังโหลดโปรไฟล Brainprint...", en: "Loading Brainprint profiles..." },
  "bp.noVerified": { th: "ยังไมมีโปรไฟลที่ยืนยน", en: "No verified profile yet" },
  "bp.noVerifiedHint": { th: "สแกนเพือตรวจสอบกบฐานขอมูล Brainprint", en: "Run a scan to check it against the Brainprint database." },
  "bp.enrolledProfiles": { th: "โปรไฟลท่ไดลงทะเบยนแลว ({count})", en: "Enrolled profiles ({count})" },
  "bp.scanner.capturing": { th: "กำลั่่งจับสญั ญาณประสาท...", en: "Capturing Neural Signature..." },
  "bp.scanner.matching": { th: "กำลั่่งจับคู่กบฐานขอมูล Brainprint...", en: "Matching against Brainprint database..." },
  "bp.scanner.captured": { th: "จับสญั ญาณแลว", en: "Signature Captured" },
  "bp.scanner.ready": { th: "พรอมสแกน", en: "Ready to Scan" },
  "bp.scanner.holdStill": { th: "นงิ ๆ — กำลั่่งอ่านกจิ กรรมอิเลกโทรดหนาผากและขมับ", en: "Hold still — reading frontal & temporal electrode activity" },
  "bp.scanner.seeResult": { th: "ดูแผงผลลัพท์ดานขวา", en: "See the result panel to the right" },
  "bp.scanner.placeHeadset": { th: "สวมเฮดเซตแลวเริ่่มสแกนยืนยนตัวตน", en: "Place the headset and start a verification scan" },
  "bp.scanner.start": { th: "เริ่่มสแกนยืนยนตัวตน", en: "Start Verification Scan" },
  "bp.scanner.again": { th: "สแกนอกครัง", en: "Scan Again" },
  "bp.scanner.simSubject": { th: "ผุ้ถูกทดลองจลุม", en: "Simulated subject" },
  "bp.scanner.scanningAs": { th: "กำลั่่งสแกนในฐานะ {label}", en: "Scanning as {label}" },
  "bp.verified": { th: "ยืนยนโปรไฟลแลว · อนญารตเข้าใช้งาน", en: "Profile Verified · Access Granted" },
  "bp.matchScore": { th: "คะแนนการจับคู่", en: "Match score" },
  "bp.novelty": { th: "ความแปลกใหม (ระยะ OOD)", en: "Novelty (OOD dist.)" },
  "bp.enrolledOn": { th: "ลงทะเบยนเมือ {date}", en: "Enrolled {date}" },
  "bp.sessions": { th: "บคุ ลก {count} เซสชั่่น", en: "{count} sessions on record" },
  "bp.scanAgain": { th: "สแกนอกครัง", en: "Scan Again" },
  "bp.viewAnalytics": { th: "ดูใน Analytics", en: "View in Analytics" },
  "bp.unknown.title": { th: "ลายเซ็นคลืนสมองใหม / ไมรจู้ ัก", en: "New / Unknown Brainwave Signature" },
  "bp.unknown.body": { th: "การจับครังนไี้ มตรงกบโปรไฟลท่ลงทะเบยน (คะแนนสูงสุด {score}% ต่ำกวากร้ท ยืนยน) ตังชอใหรูปแบบนเพิ่่มเข้าฐานขอมูล Brainprint", en: "This capture didn't match any enrolled profile (best match: {score}%, below the verification threshold). Give this pattern a nickname to add it to the Brainprint database." },
  "bp.unknown.nicknameLabel": { th: "ตังชอใหรูปแบบ / บุคคลน", en: "Set Nickname for this Pattern / Person" },
  "bp.unknown.nicknamePlaceholder": { th: 'เชน "แม - นังสมาธิ", "ผใ้ ช B"', en: 'e.g. "Mom - Meditating", "User B"' },
  "bp.unknown.dismiss": { th: "ปด", en: "Dismiss" },
  "bp.unknown.save": { th: "บคุ ลกและเทรนเข้าฐานขอมูล Brainprint", en: "Save & Train into Brainprint Database" },
  "bp.ref.filter": { th: "ตวั กรองขอมูลอางอิง", en: "Reference Data Filter" },
  "bp.ref.sleepStage": { th: "ระยะการนอน", en: "Sleep Stage" },
  "bp.ref.subject": { th: "ผุ้ถูกทดลอง", en: "Subject" },
  "bp.ref.both": { th: "รวมทังสอง", en: "Both combined" },
  "bp.ref.epochs": { th: "{count} อีป็อก", en: "{count} epochs" },
  "bp.ref.compare": { th: "เปรียบเทีย", en: "Compare" },
  "bp.ref.loading": { th: "กำลั่่งโหลด...", en: "Loading..." },
  "bp.ref.boxTitle": { th: "ผุ้ถูกทดลองอางอิง", en: "Reference Subject" },
  "bp.ref.epochsRow": { th: "อีป็อก", en: "Epochs" },
  "bp.ref.age": { th: "อายุ", en: "Age" },
  "bp.ref.yrs": { th: "{count} ปี", en: "{count} yrs" },
  "bp.ref.sex": { th: "เพศ", en: "Sex" },
  "bp.ref.recordings": { th: "การบคุ ลก", en: "Recordings" },
  "bp.ref.night": { th: "คืน", en: "night" },
  "bp.ref.nights": { th: "คืน", en: "nights" },
  "bp.ref.lightsOff": { th: "ปดไฟ {times}", en: "lights off {times}" },
  "bp.ref.datasetSuffix": { th: "(งานวชิ ญา Sleep Cassette), PhysioNet", en: "(Sleep Cassette study), PhysioNet" },
  "bp.ref.viewPhysionet": { th: "ดูบน PhysioNet", en: "View on PhysioNet" },
  "bp.ref.fileOnPhysionet": { th: "{file} บน PhysioNet", en: "{file} on PhysioNet" },
  "bp.band.title": { th: "กำลังไฟฟาของแบนด์เทียบบนชุดขอมูลอางอิง", en: "Band Power vs. Reference Dataset" },
  "bp.band.connectHint": { th: "เชือมตอกับแหล่งขอมูล EEG เพือเปรียบเทียบกำลังไฟฟาของแบนด์กบค่าอางอิง", en: "Connect to an EEG data source to compare band power against reference values." },
  "bp.band.loading": { th: "กำลั่่งโหลดขอมูลอางอิง...", en: "Loading reference data..." },
  "bp.band.noMatch": { th: "ไมมขี อมูลอางอิงท่ตรงกบทวั กรองท่เลือก", en: "No reference data matches the selected filters." },
  "bp.band.filter": { th: "ตวั กรอง: ", en: "Filter: " },
  "bp.band.colBand": { th: "แบนด์", en: "Band" },
  "bp.band.colYour": { th: "ค่าของคุน", en: "Your Value" },
  "bp.band.colRef": { th: "ค่าเฉลี่ยอางอิง ± SD", en: "Reference Mean ± SD" },
  "bp.band.colMatch": { th: "การจับคู่", en: "Match" },
  "bp.band.inRange": { th: "อยใู่ นชวง", en: "In Range" },
  "bp.band.outside": { th: "ออกนอกชวง", en: "Outside" },
  "bp.band.reference": { th: "อางอิง: Sleep-EDF Database Expanded", en: "Reference: Sleep-EDF Database Expanded" },
  "bp.band.selectSubject": { th: "เลือกผุ้ถูกทดลองเพือดูจำนวนอีป็อก", en: "Select a subject to view its epoch count" },
  "bp.band.epochCount": { th: "{id}: {count} อีป็อก{filter}", en: "{id}: {count} epochs{filter}" },
  "bp.error.network": { th: "ขอมูลอางอิงไมพรอมใช — เบคเอนดอาจออฟไลน", en: "Reference data unavailable — backend may be offline" },
  "bp.error.generic": { th: "โหลดขอมูลอางอิงลมเหลว", en: "Failed to load reference data" },
  "bp.error.unknown": { th: "ขอผดิ พลาดท่ไมทราบสาเหตุ", en: "Unknown error" },
  "bp.stage.W": { th: "ตืน", en: "Wake" },
  "bp.stage.N1": { th: "N1 (หลับตื้น 1)", en: "N1 (Light 1)" },
  "bp.stage.N2": { th: "N2 (หลับตื้น 2)", en: "N2 (Light 2)" },
  "bp.stage.N3": { th: "N3 (หลับลึก)", en: "N3 (Deep)" },
  "bp.stage.REM": { th: "REM", en: "REM" },
  "bp.stage.all": { th: "ทุกระยะ", en: "All stages" }
`;

const anchor = 'en: "Copy Link" }\n\n};';
if (!src.includes(anchor)) {
  console.error("Anchor not found — aborting.");
  process.exit(1);
}

const out = src.replace(anchor, "en: \"Copy Link\" },\n" + BLOCK + "\n};");
writeFileSync(file, out, "utf8");
console.log("Inserted bp.* keys.");
