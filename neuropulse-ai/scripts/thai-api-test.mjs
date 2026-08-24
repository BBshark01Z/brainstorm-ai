// Connectivity test for the Thai-translation gateway.
// Reads .env directly so the API key NEVER enters the transcript/context.
// Prints only status + the returned Thai (never the key).
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "..", "neuropulse-backend", ".env");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const key = env.DEEPSEEK_API_KEY || "";
const endpoint = env.DEEPSEEK_API_ENDPOINT || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const model = env.DEEPSEEK_MODEL || "qwen3.8-27b-fp8";

if (!key) {
  console.log("NO_KEY: DEEPSEEK_API_KEY not found in .env");
  process.exit(2);
}
console.log(`endpoint: ${endpoint}`);
console.log(`model:    ${model}`);
console.log(`key:      present (${key.length} chars)`);

const samples = ["Home", "Streaming", "Connect to start streaming", "Loading..."];
const sys =
  "You are a professional UI localizer. Translate the given English UI strings into natural, correct Thai (ภาษาไทย) with proper tone marks and vowels. Keep technical terms (EEG, AI, Brainprint, WebSocket, DeepSeek, LIVE, VERIFIED) in their standard form. Reply with ONLY a JSON object mapping each English string to its Thai translation. No commentary.";

const body = {
  model,
  messages: [
    { role: "system", content: sys },
    { role: "user", content: JSON.stringify(Object.fromEntries(samples.map((s) => [s, ""])), null, 0) },
  ],
};

try {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const status = res.status;
  const text = await res.text();
  if (!res.ok) {
    console.log(`HTTP ${status}: ${text.slice(0, 300)}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  const content = data.choices?.[0]?.message?.content || "";
  console.log("--- raw model output ---");
  console.log(content);
} catch (e) {
  console.log("ERROR: " + e.message);
  process.exit(1);
}
