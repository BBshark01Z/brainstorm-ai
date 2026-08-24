// Objective structural verifier for translations.ts (no Thai knowledge needed).
// Checks, per key:
//   1. Combining order — after a consonant, Thai marks must be strictly
//      increasing in canonical order (vowel < phinthu < maitaikhu < tone <
//      nikhahit), each at most once. A non-increasing run is real corruption.
//   2. Placeholder preservation — the set of {token} placeholders in `th` must
//      equal the set in `en` (nothing dropped/renamed).
//   3. Tone-mark census — counts tone marks (0E48-0E4B) file-wide; a correct
//      tone-marked dictionary has many, the old no-tone-marks style had ~1.
// The old "mid-word space" heuristic is dropped: legitimate Thai has spaces
// between words, so it was a false-positive generator.
import { readFileSync } from "fs";

const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,\s*en:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

// Complete canonical rank for Thai combining marks (after-consonant).
const RANK = {};
// vowels (after consonant)
for (const cp of [0xe30, 0xe31, 0xe32, 0xe33, 0xe34, 0xe37, 0xe38, 0xe39, 0xe3a]) RANK[String.fromCodePoint(cp)] = 1;
// phinthu
RANK[String.fromCodePoint(0xe35)] = 2;
// maitaikhu (below + above)
RANK[String.fromCodePoint(0xe36)] = 3;
RANK[String.fromCodePoint(0xe47)] = 3;
// tones
for (const cp of [0xe48, 0xe49, 0xe4a, 0xe4b]) RANK[String.fromCodePoint(cp)] = 4;
// nikhahit
RANK[String.fromCodePoint(0xe4c)] = 5;

const entries = [];
let m;
while ((m = re.exec(src)) !== null) {
  entries.push({
    key: m[1],
    th: (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1"),
    en: (m[4] ?? m[5] ?? "").replace(/\\(.)/g, "$1"),
  });
}

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
      if (ranks[j] <= ranks[j - 1]) {
        probs.push("bad order [" + run.join("") + "] ranks " + ranks.join(","));
        break;
      }
    }
  }
  return probs;
}

const placeholders = (s) => {
  const set = new Set();
  const re2 = /\{(\w+)\}/g;
  let mm;
  while ((mm = re2.exec(s)) !== null) set.add(mm[1]);
  return set;
};

let orderBad = 0, phBad = 0, tone = 0, nik = 0;
for (const { key, th, en } of entries) {
  for (const c of th) {
    const cp = c.codePointAt(0);
    if (cp >= 0xe48 && cp <= 0xe4b) tone++;
    if (cp === 0xe4c) nik++;
  }
  const op = orderProblems(th);
  if (op.length) {
    orderBad++;
    console.log(`ORDER  ${key}: ${op.join("; ")}`);
  }
  const pt = placeholders(th), pe = placeholders(en);
  const missing = [...pe].filter((x) => !pt.has(x));
  const extra = [...pt].filter((x) => !pe.has(x));
  if (missing.length || extra.length) {
    phBad++;
    console.log(`PLACEHOLDER ${key}: missing=[${missing}] extra=[${extra}]`);
  }
}
console.log(`\n=== ${entries.length} keys | order defects: ${orderBad} | placeholder mismatches: ${phBad} | tone marks: ${tone} | nikhahit: ${nik} ===`);
