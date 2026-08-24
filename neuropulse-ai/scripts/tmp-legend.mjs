// Build a legend of every distinct codepoint used in the bp/an/ai Thai values,
// so the review can decode strings from ground-truth codepoints, not memory.
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../lib/i18n/translations.ts", import.meta.url), "utf8");
const lines = s.split("\n");
const STR = String.raw`((?:[^"\\]|\\.)*)`;
const seen = new Map(); // cp -> char
for (let i = 0; i < lines.length; i++) {
  let m = lines[i].match(new RegExp(`^  "((?:bp|an|ai)\\.[^"]+)": \\{ th: "${STR}"`));
  if (!m) {
    m = lines[i].match(/^  "((?:bp|an|ai)\.[^"]+)": \{$/);
    if (m && i + 1 < lines.length) {
      const t = lines[i + 1].match(new RegExp(`^    th: "${STR}"`));
      if (t) m = [m[0], m[1], t[1]];
    }
  }
  if (m) {
    const th = m[2].replace(/\\(.)/g, "$1");
    for (const ch of th) {
      const cp = ch.codePointAt(0);
      if (!seen.has(cp)) seen.set(cp, ch);
    }
  }
}
// Sort: Thai block first, then ASCII
const entries = [...seen.entries()].sort((a, b) => a[0] - b[0]);
for (const [cp, ch] of entries) {
  const isThai = cp >= 0x0e00 && cp <= 0x0e7f;
  const cls = isThai ? "THAI" : (cp >= 0x20 && cp < 0x7f ? "ascii" : "other");
  console.log(`U+${cp.toString(16).toUpperCase().padStart(4, "0")}  ${ch}  [${cls}]`);
}
console.log(`\nTOTAL distinct codepoints: ${entries.length}`);
