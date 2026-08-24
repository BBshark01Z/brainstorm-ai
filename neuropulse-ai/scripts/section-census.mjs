// Per-section census: tone marks vs vowels, to resolve the house-style question.
import { readFileSync } from "fs";
const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

const TONE = "่้๊๋"; // 0E48-0E4B
const VOWEL = "ัิีึืุู"; // 0E31, 0E34-0E39
const section = (key) => key.split(".")[0];

const agg = {};
let m;
while ((m = re.exec(src)) !== null) {
  const sec = section(m[1]);
  const val = (m[2] ?? m[3] ?? "");
  const a = (agg[sec] ||= { keys: 0, tone: 0, vowel: 0, keysWithTone: 0 });
  a.keys++;
  const t = val.split(/(?=[่้๊๋])/).length - 1;
  const v = val.split(/(?=[ัิีึืุู])/).length - 1;
  a.tone += t;
  a.vowel += v;
  if (t > 0) a.keysWithTone++;
}
console.log("section  keys  toneMarks  vowelMarks  keysWithTone");
for (const [sec, a] of Object.entries(agg)) {
  console.log(
    sec.padEnd(8),
    String(a.keys).padStart(4),
    String(a.tone).padStart(9),
    String(a.vowel).padStart(11),
    String(a.keysWithTone).padStart(13)
  );
}
