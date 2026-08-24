// Mechanical cleanup of translations.ts — SAFE, unambiguous fixes only.
// All Thai is built from explicit codepoints so this does NOT depend on my
// own Thai emission being correct.
//
// 1. Strip Thai tone marks U+0E48-U+0E4B -> restore the no-tone-marks house
//    style (the original 229 keys had zero tone marks; the user writes Thai
//    without tone marks too).
// 2. Fix ai.histError, whose value is mangled at the codepoint level:
//    - "สนทนา" was emitted as ส ใ ท น + ASCII "nal" (006E 0061 006C)
//    - "ล้มเหลว" had its consonants reordered (0E49 0E21 0E40 0E2B 0E25 0E27)
//    Rebuild the whole value from codepoints.
import { readFileSync, writeFileSync } from "fs";

const p = "lib/i18n/translations.ts";
let src = readFileSync(p, "utf8");
const CP = (n) => String.fromCodePoint(n);

// --- 1. Strip tone marks
const TONE = [0x0e48, 0x0e49, 0x0e4a, 0x0e4b];
const toneRe = new RegExp("[" + TONE.map((c) => CP(c)).join("") + "]", "g");
const toneCount = (src.match(toneRe) || []).length;
src = src.replace(toneRe, "");

// --- 2. Rebuild ai.histError value from codepoints.
//    Target: โหลดประวัติการสนทนาล้มเหลว
//    โหลด      = 0E42 0E2B 0E25 0E14
//    ประวัติ    = 0E1B 0E23 0E30 0E27 0E31 0E15 0E34 0E01 0E32
//    การ        = 0E01 0E32 0E23 0E2A 0E19
//    สนทนา     = 0E23 0E2A 0E19 0E17 0E19 0E32
//    ล้มเหลว    = 0E25 0E49 0E21 0E40 0E2B 0E27
const histCorrect =
  [0x0e42,0x0e2b,0x0e25,0x0e14,
   0x0e1b,0x0e23,0x0e30,0x0e27,0x0e31,0x0e15,0x0e34,0x0e01,0x0e32,
   0x0e01,0x0e32,0x0e23,0x0e2a,0x0e19,
   0x0e23,0x0e2a,0x0e19,0x0e17,0x0e19,0x0e32,
   0x0e25,0x0e49,0x0e21,0x0e40,0x0e2b,0x0e27].map(CP).join("");

// Find the line and replace its th value.
const lines = src.split("\n");
let fixedHist = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('"ai.histError"')) {
    lines[i] = '  "ai.histError": { th: "' + histCorrect + '", en: "Failed to load chat history" },';
    fixedHist = true;
    break;
  }
}
src = lines.join("\n");

writeFileSync(p, src, "utf8");
console.log(`tone marks removed: ${toneCount}`);
console.log(`ai.histError rebuilt: ${fixedHist}`);
