// Dump the flagged keys (order defects) with rendered Thai + codepoint seq,
// so I can decode and judge each against the authoritative table.
import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("scripts/thai-generated.json", "utf8"));

const RANK = {};
for (const cp of [0xe30, 0xe31, 0xe34, 0xe35, 0xe36, 0xe37, 0xe38, 0xe39, 0xe3a, 0xe40, 0xe41, 0xe42, 0xe43, 0xe44])
  RANK[String.fromCodePoint(cp)] = 1;
RANK[String.fromCodePoint(0xe47)] = 2;
for (const cp of [0xe48, 0xe49, 0xe4a, 0xe4b]) RANK[String.fromCodePoint(cp)] = 3;
RANK[String.fromCodePoint(0xe32)] = 4;
RANK[String.fromCodePoint(0xe33)] = 4;
RANK[String.fromCodePoint(0xe4d)] = 5;
RANK[String.fromCodePoint(0xe4c)] = 5;

function hasOrderProblem(val) {
  const chars = [...val];
  let i = 0;
  while (i < chars.length) {
    if (RANK[chars[i]] == null) { i++; continue; }
    const run = [];
    while (i < chars.length && RANK[chars[i]] != null) { run.push(chars[i]); i++; }
    const ranks = run.map((c) => RANK[c]);
    for (let j = 1; j < ranks.length; j++) if (ranks[j] <= ranks[j - 1]) return true;
  }
  return false;
}

const cp = (s) => [...s].map((c) => {
  const n = c.codePointAt(0);
  return n >= 0xe00 ? "0E" + n.toString(16).toUpperCase() : (n >= 32 && n < 127 ? c : "·");
}).join(" ");

for (const { key, newTh: th, en } of data) {
  if (!hasOrderProblem(th)) continue;
  console.log(`\n## ${key}\n   en: ${en}\n   th: ${th}\n   cp: ${cp(th)}`);
}
