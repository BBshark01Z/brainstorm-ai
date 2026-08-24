// Dump every key as: key  |  THAI  |  EN   (Thai rendered so it can be read).
import { readFileSync } from "fs";
const src = readFileSync("lib/i18n/translations.ts", "utf8");
const re = /"([\w.]+)"\s*:\s*\{\s*th:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')\s*,\s*en:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = re.exec(src)) !== null) {
  const th = (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1");
  const en = m[4].replace(/\\(.)/g, "$1");
  console.log(`${m[1]}\t${th}\t${en}`);
}
