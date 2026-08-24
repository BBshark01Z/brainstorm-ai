// Print codepoint sequences for specific dash.* Thai values (matched by key)
// to verify tone-mark placement at the codepoint level.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib", "i18n", "translations.ts"), "utf8");

const KEYS = [
  "bp.title",
  "bp.scanner.capturing",
  "bp.scanner.holdStill",
  "bp.scanner.scanningAs",
  "bp.verified",
  "bp.unknown.title",
  "bp.unknown.body",
  "bp.enrolledProfiles",
  "bp.band.inRange",
  "bp.stage.N1",
];

for (const key of KEYS) {
  const line = src.split("\n").find((l) => l.includes(`"${key}"`));
  if (!line) { console.log(key, "— line not found"); continue; }
  const m = line.match(/th:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) { console.log(key, "— no th value"); continue; }
  const v = m[1];
  const cps = [...v].map((c) => "U+" + c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" ");
  console.log(key + ":\n  " + cps);
}
