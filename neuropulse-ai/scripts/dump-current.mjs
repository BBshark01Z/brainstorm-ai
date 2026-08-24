import { readFileSync } from "fs";
const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
let m; const out = [];
while ((m = re.exec(src)) !== null) {
  out.push(m[1] + " = " + (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1"));
}
const start = +(process.argv[2] || 0);
const n = +(process.argv[3] || 40);
console.log(out.slice(start, start + n).join("\n"));
console.log(`\n(${out.length} total keys)`);
