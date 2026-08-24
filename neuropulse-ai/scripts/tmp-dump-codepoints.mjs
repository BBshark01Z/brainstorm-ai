// Dump codepoints for all th values in the bp.*/an.*/ai.* sections for manual review.
import { readFileSync } from "node:fs";
const s = readFileSync(new URL("../lib/i18n/translations.ts", import.meta.url), "utf8");
const lines = s.split("\n");
const STR = String.raw`((?:[^"\\]|\\.)*)`;
const out = [];
for (let i = 0; i < lines.length; i++) {
  // single-line entries: "key": { th: "...", en: "..." },
  let m = lines[i].match(new RegExp(`^  "((?:bp|an|ai)\\.[^"]+)": \\{ th: "${STR}"`));
  // multi-line entries: "key": {  then next line th: "...",
  if (!m) {
    m = lines[i].match(/^  "((?:bp|an|ai)\.[^"]+)": \{$/);
    if (m && i + 1 < lines.length) {
      const t = lines[i + 1].match(new RegExp(`^    th: "${STR}"`));
      if (t) {
        m = [m[0], m[1], t[1]];
      }
    }
  }
  if (m) {
    const [key, thRaw] = [m[1], m[2]];
    const th = thRaw.replace(/\\(.)/g, "$1");
    const cps = [...th].map((c) => c.codePointAt(0).toString(16)).join(" ");
    out.push(`${key}\n  th: ${th}\n  cps: ${cps}`);
  }
}
console.log(out.join("\n"));
console.log(`\nTOTAL: ${out.length} keys`);
