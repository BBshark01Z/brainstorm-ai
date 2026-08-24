// Write the final corrected Thai (from a JSON file of {key: thai}) back into
// translations.ts, replacing only the `th:` value for each key. Everything else
// (comments, formatting, English values, key order) is preserved.
//
// Usage: node scripts/write-back.mjs <json-file> [--dry-run]
// The JSON file is a flat object { "<key>": "<thai>" }.
//
// The Thai is read from the JSON file (never hand-typed), so no corruption.
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "..", "lib", "i18n", "translations.ts");
const jsonPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!jsonPath) { console.log("usage: node write-back.mjs <json-file> [--dry-run]"); process.exit(1); }

const thByKey = JSON.parse(readFileSync(jsonPath, "utf8"));
const src = readFileSync(FILE, "utf8");
const lines = src.split("\n");

let replaced = 0, skipped = 0;
for (let i = 0; i < lines.length; i++) {
  const km = lines[i].match(/^(\s*)"([\w.]+)"\s*:\s*\{\s*th:\s*/);
  if (!km) continue;
  const key = km[2];
  if (!(key in thByKey)) { skipped++; continue; }
  const thai = thByKey[key];
  const prefix = km[0]; // up to and including "th: "
  const rest = lines[i].slice(prefix.length); // starts at the th value
  // Find the end of the th string literal (respecting backslash escapes).
  let j = 0;
  if (rest[0] === '"' || rest[0] === "'") {
    const q = rest[0];
    j = 1;
    while (j < rest.length) {
      if (rest[j] === "\\") { j += 2; continue; }
      if (rest[j] === q) { j++; break; }
      j++;
    }
  }
  const after = rest.slice(j); // e.g. `, en: "..." },`
  const esc = thai.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  lines[i] = prefix + '"' + esc + '"' + after;
  replaced++;
}

const out = lines.join("\n");
if (dryRun) {
  console.log(`[dry-run] would replace ${replaced} keys, skip ${skipped} (not in JSON)`);
} else {
  writeFileSync(FILE, out, "utf8");
  console.log(`replaced ${replaced} keys, skipped ${skipped}`);
}
// Report any JSON keys that did not match a line (possible key-name drift).
const fileKeys = new Set();
for (const l of lines) { const m = l.match(/^\s*"([\w.]+)"\s*:\s*\{\s*th:/); if (m) fileKeys.add(m[1]); }
const orphan = Object.keys(thByKey).filter((k) => !fileKeys.has(k));
if (orphan.length) console.log("WARNING: JSON keys not found in file: " + orphan.join(", "));
