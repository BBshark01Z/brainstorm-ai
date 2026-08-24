// Fix the one reliably-detectable systematic error in the generated Thai:
// the model drops the mai han-akat (0E31, ั) after ห (0E2B) when the syllable
// is ห+น (0E19). "hn" is not a valid Thai onset, so every ห+น sequence is a
// dropped vowel — insert 0E31 between them to form หน (h-n with the vowel).
//
// This is the ONLY such fix: ห+ล (หล), ห+ร (หร), ห+ม (หม), ห+ต (หต), ห+ว (หว),
// ห+ย (หย) are all legitimate Thai onsets and must NOT be touched.
//
// Reads scripts/thai-generated.json, writes scripts/thai-fixed.json
// (a flat { key: thai } map) for write-back.mjs to consume.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = join(__dirname, "thai-generated.json");
const OUT = join(__dirname, "thai-fixed.json");

const data = JSON.parse(readFileSync(IN, "utf8"));
const HO = 0xe2b, NO_NU = 0xe19, MAI_HAN_AKAT = 0xe31;

const fixedByKey = {};
let total = 0;
for (const { key, newTh } of data) {
  if (!newTh) { fixedByKey[key] = newTh ?? ""; continue; }
  const cps = [...newTh].map((c) => c.codePointAt(0));
  let count = 0;
  for (let i = 0; i < cps.length - 1; i++) {
    if (cps[i] === HO && cps[i + 1] === NO_NU) {
      cps.splice(i + 1, 0, MAI_HAN_AKAT);
      i++; // skip past the inserted mark
      count++;
    }
  }
  total += count;
  fixedByKey[key] = String.fromCodePoint(...cps);
  if (count) console.log(`  ${key}: +${count} mai han-akat`);
}
writeFileSync(OUT, JSON.stringify(fixedByKey, null, 2), "utf8");
console.log(`\nfixed ${total} ห+น occurrences across ${data.filter(e => fixedByKey[e.key] && [...e.newTh].some((c, i, a) => c.codePointAt(0) === HO && a[i+1]?.codePointAt(0) === NO_NU)).length} keys`);
console.log(`wrote ${OUT}`);
