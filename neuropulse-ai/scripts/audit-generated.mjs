// Audit the model-generated Thai (scripts/thai-generated.json) objectively.
//
// Canonical combining order after a Thai consonant (per Unicode + Thai
// orthography). SARA AA (0E32) and SARA AM (0E33) are the "after" vowels —
// they come AFTER the tone mark, not with the leading vowels. A run whose
// ranks are not strictly increasing is real corruption.
//
// Authoritative codepoints (Python unicodedata, verified 2026-08-23):
//   0E30 SARA A, 0E31 MAI HAN-AKAT, 0E32 SARA AA, 0E33 SARA AM,
//   0E34 SARA I, 0E35 SARA II, 0E36 SARA UE, 0E37 SARA UEE, 0E38 SARA U,
//   0E39 SARA UU, 0E3A PHINTHU, 0E40 SARA E, 0E41 SARA AE, 0E42 SARA O,
//   0E43 SARA AI MAIMUAN, 0E44 SARA AI MAIMALAI, 0E47 MAITAIKHU,
//   0E48 MAI EK, 0E49 MAI THO, 0E4A MAI TRI, 0E4B MAI CHATTAWA,
//   0E4C THANTHAKHAT, 0E4D NIKHAHIT.
import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("scripts/thai-generated.json", "utf8"));

const RANK = {};
// rank 1: leading / main vowels
for (const cp of [0xe30, 0xe31, 0xe34, 0xe35, 0xe36, 0xe37, 0xe38, 0xe39, 0xe3a, 0xe40, 0xe41, 0xe42, 0xe43, 0xe44])
  RANK[String.fromCodePoint(cp)] = 1;
// rank 2: maitaikhu
RANK[String.fromCodePoint(0xe47)] = 2;
// rank 3: tone marks
for (const cp of [0xe48, 0xe49, 0xe4a, 0xe4b]) RANK[String.fromCodePoint(cp)] = 3;
// rank 4: after-vowels (sara aa, sara am)
RANK[String.fromCodePoint(0xe32)] = 4;
RANK[String.fromCodePoint(0xe33)] = 4;
// rank 5: nikhahit / thanthakhat
RANK[String.fromCodePoint(0xe4d)] = 5;
RANK[String.fromCodePoint(0xe4c)] = 5;

function orderProblems(val) {
  const probs = [];
  const chars = [...val];
  let i = 0;
  while (i < chars.length) {
    if (RANK[chars[i]] == null) { i++; continue; }
    const run = [];
    while (i < chars.length && RANK[chars[i]] != null) { run.push(chars[i]); i++; }
    const ranks = run.map((c) => RANK[c]);
    for (let j = 1; j < ranks.length; j++) {
      if (ranks[j] <= ranks[j - 1]) { probs.push("bad order ranks " + ranks.join(",")); break; }
    }
  }
  return probs;
}
const placeholders = (s) => { const set = new Set(); let mm; const r = /\{(\w+)\}/g; while ((mm = r.exec(s)) !== null) set.add(mm[1]); return set; };

let orderBad = 0, phBad = 0, tone = 0, nik = 0;
for (const { key, newTh: th, en } of data) {
  for (const c of th) { const cp = c.codePointAt(0); if (cp >= 0xe48 && cp <= 0xe4b) tone++; if (cp === 0xe4d) nik++; }
  const op = orderProblems(th);
  if (op.length) { orderBad++; console.log(`ORDER  ${key}: ${op.join("; ")}`); }
  const pt = placeholders(th), pe = placeholders(en);
  const missing = [...pe].filter((x) => !pt.has(x));
  const extra = [...pt].filter((x) => !pe.has(x));
  if (missing.length || extra.length) { phBad++; console.log(`PLACE  ${key}: missing=[${missing}] extra=[${extra}]`); }
}
console.log(`\n=== ${data.length} keys | order defects: ${orderBad} | placeholder mismatches: ${phBad} | tone marks: ${tone} | nikhahit: ${nik} ===`);
