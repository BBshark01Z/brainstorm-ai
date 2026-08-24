// 1) Verify the ห+น fix: dump nav.home / dash.home codepoints (should now be
//    ห-ั-น-้-า = 0E2B 0E31 0E19 0E49 0E32 ...).
// 2) Scan the fixed Thai for ALL distinct consonant-consonant (C+C) bigrams with
//    counts + example keys, so I can judge which are valid Thai onsets vs.
//    dropped-vowel errors.
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixed = JSON.parse(readFileSync(join(__dirname, "thai-fixed.json"), "utf8"));

const cp = (s) => [...s].map((c) => { const n = c.codePointAt(0); return n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : (n >= 32 && n < 127 ? c : "·"); }).join(" ");
const isC = (n) => n >= 0xe01 && n <= 0xe2f;

console.log("=== Verify fix ===");
for (const k of ["nav.home", "dash.home", "auth.requirements", "an.chart.spindle"]) {
  console.log(`${k}: ${cp(fixed[k])}`);
}

console.log("\n=== Distinct C+C bigrams (consonant immediately followed by consonant) ===");
const bigrams = {};
for (const [key, th] of Object.entries(fixed)) {
  const cps = [...th].map((c) => c.codePointAt(0));
  for (let i = 0; i < cps.length - 1; i++) {
    if (isC(cps[i]) && isC(cps[i + 1])) {
      const b = "0E" + cps[i].toString(16).toUpperCase() + " 0E" + cps[i + 1].toString(16).toUpperCase();
      if (!bigrams[b]) bigrams[b] = { count: 0, keys: [] };
      bigrams[b].count++;
      if (bigrams[b].keys.length < 3) bigrams[b].keys.push(key);
    }
  }
}
const rows = Object.entries(bigrams).sort((a, b) => b[1].count - a[1].count);
for (const [b, v] of rows) console.log(`  ${b}  x${v.count}  e.g. ${v.keys.join(", ")}`);
console.log(`\n${rows.length} distinct C+C bigrams, ${rows.reduce((s, r) => s + r[1].count, 0)} total`);
