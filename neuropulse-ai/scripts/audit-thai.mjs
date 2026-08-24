// Audit every th: value in translations.ts at codepoint level.
// Prints per-entry Thai-char count and tone-mark count so tone-mark
// omissions are visible without trusting terminal rendering.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib", "i18n", "translations.ts"), "utf8");
const re = /th:\s*"((?:[^"\\]|\\.)*)"/g;
let m, i = 0;
while ((m = re.exec(src))) {
  i++;
  const v = m[1];
  const marks = [...v].filter((c) => { const c2 = c.codePointAt(0); return c2 >= 0x0E48 && c2 <= 0x0E4D; }).length;
  const thai = [...v].filter((c) => { const c2 = c.codePointAt(0); return c2 >= 0x0E00 && c2 <= 0x0E7F; }).length;
  console.log(String(i).padStart(2), "thai=" + String(thai).padStart(3), "marks=" + marks, JSON.stringify(v).slice(0, 70));
}
