// Dump codepoints of each non-empty line on stdin (Thai shown as 0E codes).
import { readFileSync } from "fs";
const lines = readFileSync(0, "utf8").split(/\r?\n/);
for (const line of lines) {
  if (!line.trim()) continue;
  const cps = [...line].map((c) => {
    const cp = c.codePointAt(0);
    return cp >= 0xe00 ? "0E" + cp.toString(16).toUpperCase() : c;
  });
  console.log(cps.join(" "));
}
