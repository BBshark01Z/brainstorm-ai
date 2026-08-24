// One-off: dump codepoints for selected keys + count tone marks file-wide.
import { readFileSync } from "fs";
const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
let m; const out = [];
while ((m = re.exec(src)) !== null) {
  out.push({ k: m[1], v: (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1") });
}
const want = new Set(process.argv.slice(2));
for (const e of out) {
  if (!want.has(e.k)) continue;
  const cps = [...e.v].map((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xe00 ? "0E" + cp.toString(16).toUpperCase() : c;
  });
  console.log(e.k, "=>", cps.join(" "));
}
let tone = 0, nik = 0;
for (const e of out) {
  for (const c of e.v) {
    const cp = c.codePointAt(0);
    if (cp >= 0xe48 && cp <= 0xe4b) tone++;
    if (cp === 0xe4c) nik++;
  }
}
console.log(`TOTAL keys: ${out.length} | tone marks: ${tone} | nikhahit: ${nik}`);
