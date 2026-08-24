// For each occurrence of ห+น (0E2B 0E19) in the generated Thai, print the key,
// the rendered word, and the codepoints of the syllable containing it, so I can
// classify the correct vowel (หน = ห+ั+น vs หนา = ห+า+น) for each.
import { readFileSync } from "fs";
const data = JSON.parse(readFileSync("scripts/thai-generated.json", "utf8"));
const HO = 0xe2b, NO_NU = 0xe19;
const cp = (s) => [...s].map((c) => { const n = c.codePointAt(0); return n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : (n >= 32 && n < 127 ? c : "·"); }).join(" ");
for (const { key, newTh: th } of data) {
  const cps = [...th].map((c) => c.codePointAt(0));
  for (let i = 0; i < cps.length - 1; i++) {
    if (cps[i] === HO && cps[i + 1] === NO_NU) {
      // show a window: 3 chars before ห through 4 chars after น
      const a = Math.max(0, i - 2), b = Math.min(cps.length, i + 5);
      const win = cps.slice(a, b);
      console.log(`\n${key}`);
      console.log(`  full : ${cp(th)}`);
      console.log(`  win  : ${win.map((n) => (n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : (n >= 32 && n < 127 ? String.fromCharCode(n) : "·"))).join(" ")}`);
    }
  }
}
