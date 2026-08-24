// CORRECTED Thai structural verifier for translations.ts.
//
// The earlier verify-thai.mjs had a buggy rank table: it lumped SARA AA (0E32)
// and SARA AM (0E33) into the leading-vowel rank and ranked tone marks above
// them, so it flagged correct Thai (tone mark BEFORE sara aa/am) as defects.
//
// Correct canonical combining order after a Thai consonant (strictly
// increasing), per Unicode + Thai orthography:
//   rank 1: leading/main vowels  0E30,0E31,0E34,0E35,0E36,0E37,0E38,0E39,
//                                0E3A,0E40,0E41,0E42,0E43,0E44
//   rank 2: maitaikhu            0E47
//   rank 3: tone marks           0E48,0E49,0E4A,0E4B
//   rank 4: after-vowels         0E32 (sara aa), 0E33 (sara am)
//   rank 5: nikhahit/thanthakhat 0E4C, 0E4D
// A run whose ranks are not strictly increasing is real corruption (e.g. two
// leading vowels in a row, a double tone, tone after sara aa, ...).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib", "i18n", "translations.ts"), "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,\s*en:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const RANK = {};
for (const cp of [0xe30, 0xe31, 0xe34, 0xe35, 0xe36, 0xe37, 0xe38, 0xe39, 0xe3a, 0xe40, 0xe41, 0xe42, 0xe43, 0xe44])
  RANK[String.fromCodePoint(cp)] = 1;
RANK[String.fromCodePoint(0xe47)] = 2;
for (const cp of [0xe48, 0xe49, 0xe4a, 0xe4b]) RANK[String.fromCodePoint(cp)] = 3;
RANK[String.fromCodePoint(0xe32)] = 4;
RANK[String.fromCodePoint(0xe33)] = 4;
RANK[String.fromCodePoint(0xe4d)] = 5;
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
const placeholders = (s) => { const set = new Set(); let mm; const r = /\{(\w+)\}/g; while ((mm = r.exec(s)) !== null) set.add(mm[1]); return set; };
const dump = (s) => [...s].map((c) => { const n = c.codePointAt(0); return n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : c; }).join(" ");

let orderBad = 0, phBad = 0, tone = 0, nik = 0;
for (const { key, th, en } of entries) {
  for (const c of th) { const cp = c.codePointAt(0); if (cp >= 0xe48 && cp <= 0xe4b) tone++; if (cp === 0xe4c || cp === 0xe4d) nik++; }
  const op = orderProblems(th);
  if (op.length) {
    orderBad++;
    console.log(`ORDER  ${key}: ${op.join("; ")}`);
    console.log(`        ${dump(th)}`);
  }
  const pt = placeholders(th), pe = placeholders(en);
  const missing = [...pe].filter((x) => !pt.has(x));
  const extra = [...pt].filter((x) => !pe.has(x));
  if (missing.length || extra.length) {
    phBad++;
    console.log(`PLACE  ${key}: missing=[${missing}] extra=[${extra}]`);
  }
}
console.log(`\n=== ${entries.length} keys | order defects: ${orderBad} | placeholder mismatches: ${phBad} | tone marks: ${tone} | nikhahit: ${nik} ===`);
