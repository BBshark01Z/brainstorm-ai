// Proper Thai combining-sequence validator over translations.ts (codepoint level).
//
// Thai combining marks after a consonant must appear in strictly-increasing
// canonical order, each at most once:
//   vowel(1) < tone(2) < maitaikhu(3) < nikhahit(4)
// A run whose ranks are NOT strictly increasing (tone before vowel, double
// vowel, double tone, nikhahit before tone, ...) is real corruption.
// Also flags mid-word spaces between Thai characters.
import { readFileSync } from "fs";

const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const RANK = {
  "ั": 1, "ิ": 1, "ี": 1, "ึ": 1, "ื": 1, "ุ": 1, "ู": 1, "ฺ": 1, // vowels (incl. mai han akat, phinthu)
  "่": 2, "้": 2, "๊": 2, "๋": 2, // tones
  "็": 3, "็": 3, // maitaikhu (0E32 / 0E47)
  "์": 4, // nikhahit
};

const isThai = (c) => {
  const cp = c.codePointAt(0);
  return cp >= 0x0e00 && cp <= 0x0e7f;
};

const dump = (s) =>
  [...s]
    .map((ch) => {
      const cp = ch.codePointAt(0);
      return cp >= 0xe00 ? "0E" + cp.toString(16).toUpperCase() : ch;
    })
    .join(" ");

const entries = [];
let m;
while ((m = re.exec(src)) !== null) {
  entries.push({ key: m[1], val: (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1") });
}

function validate(chars) {
  const probs = [];
  for (let i = 1; i < chars.length - 1; i++) {
    if (chars[i] === " " && isThai(chars[i - 1]) && isThai(chars[i + 1]))
      probs.push("mid-word space @" + i);
  }
  let i = 0;
  while (i < chars.length) {
    if (RANK[chars[i]] == null) {
      i++;
      continue;
    }
    const run = [];
    while (i < chars.length && RANK[chars[i]] != null) {
      run.push(chars[i]);
      i++;
    }
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

let bad = 0;
for (const { key, val } of entries) {
  const probs = validate([...val]);
  if (probs.length) {
    bad++;
    console.log(`\n${key}: ${probs.join("; ")}`);
    console.log("  " + dump(val));
  }
}
console.log(`\n=== ${bad} keys with real defects, ${entries.length} total ===`);
