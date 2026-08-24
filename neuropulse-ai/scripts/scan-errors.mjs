// Scan the generated Thai for systematic codepoint errors.
// The confirmed error: model writes ห+น (0E2B 0E19) where หน = ห+ั (0E2B 0E31) belongs.
// Count that, plus scan for any consonant (0E01-0E2F) immediately following ห (0E2B)
// (a valid Thai syllable never has ห followed by another consonant).
import { readFileSync } from "fs";
const data = JSON.parse(readFileSync("scripts/thai-generated.json", "utf8"));

const HO = 0xe2b;      // ห
const MAI_HAN_AKAT = 0xe31; // ั
const NO_NU = 0xe19;   // น

let hoNu = 0, hoMaiHan = 0;
const hoNuKeys = [];
for (const { key, newTh: th } of data) {
  const cps = [...th].map((c) => c.codePointAt(0));
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] === HO) {
      const nxt = cps[i + 1];
      if (nxt === NO_NU) { hoNu++; if (!hoNuKeys.includes(key)) hoNuKeys.push(key); }
      else if (nxt === MAI_HAN_AKAT) hoMaiHan++;
    }
  }
}
console.log(`ห+น (0E2B 0E19, WRONG): ${hoNu} occurrences across ${hoNuKeys.length} keys`);
console.log(`ห+ั (0E2B 0E31, correct หน): ${hoMaiHan} occurrences`);
console.log("\nKeys with ห+น:");
for (const k of hoNuKeys) console.log("  " + k);

// Also: any consonant directly after ห (always wrong in Thai)
console.log("\n--- Any consonant after ห (0E01-0E2F) ---");
for (const { key, newTh: th } of data) {
  const cps = [...th].map((c) => c.codePointAt(0));
  for (let i = 0; i < cps.length; i++) {
    if (cps[i] === HO && i + 1 < cps.length && cps[i+1] >= 0xe01 && cps[i+1] <= 0xe2f) {
      console.log(`  ${key}: ห + 0E${cps[i+1].toString(16).toUpperCase()} (consonant)`);
    }
  }
}
