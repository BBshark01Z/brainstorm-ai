// Diagnostic: census of Thai combining characters in all `th:` values.
// Verifies at codepoint level whether vowels/tone marks are actually present.
import { readFileSync } from "fs";

const src = readFileSync("lib/i18n/translations.ts", "utf8");

const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const CHARS = [
  ["ั", "mai han-akat (ั)"],
  ["ิ", "sara i (ิ)"],
  ["ี", "sara ii (ี)"],
  ["ึ", "sara ue (ึ)"],
  ["ื", "sara uee (ื)"],
  ["ุ", "sara u (ุ)"],
  ["ู", "sara uu (ู)"],
  ["็", "thanthakhat (็)"],
  ["่", "mai ek (่)"],
  ["้", "mai tho (้)"],
  ["๊", "mai tri (๊)"],
  ["๋", "mai chattawa (๋)"],
  ["์", "nikhahit (์)"],
  ["ํ", "thanthakhat (็)"],
];

let total = 0;
const counts = {};
const entries = [];
let m;
while ((m = re.exec(src)) !== null) {
  const key = m[1];
  const val = m[2] ?? m[3] ?? "";
  total++;
  entries.push({ key, val });
  for (const [c] of CHARS) {
    const n = val.split(c).length - 1;
    if (n) counts[c] = (counts[c] || 0) + n;
  }
}

console.log("total th values:", total);
console.log("\ncombining-character census across ALL th values:");
for (const [c, name] of CHARS) {
  console.log(
    "  U+0E" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"),
    name.padEnd(22),
    String(counts[c] || 0).padStart(4)
  );
}

// Codepoint dump for a few representative keys
const dump = (key) => {
  const e = entries.find((x) => x.key === key);
  if (!e) return;
  const cps = [...e.val].map((ch) => {
    const cp = ch.charCodeAt(0);
    return cp < 0x100 ? String(ch) : "0E" + cp.toString(16).toUpperCase();
  });
  console.log("\n" + key + ":");
  console.log("  " + cps.join(" "));
};
for (const k of [
  "nav.home",
  "nav.analytics",
  "nav.aiConsultant",
  "header.brainprintVerified",
  "bp.scanner.capturing",
  "bp.unknown.title",
  "ai.welcome",
  "an.title",
]) dump(k);
