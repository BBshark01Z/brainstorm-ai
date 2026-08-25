// ---------------------------------------------------------------------------
// NeuroPulse AI — local rule-based diagnostic fallback (client-side)
//
// Mirrors the backend's `build_local_diagnostic_fallback` (neuropulse-backend/
// main.py). Used by the AI chat when the SSE stream yields no text before
// [DONE] (or errors before any data arrives), so the assistant bubble is
// never left empty. Deterministic, grounded in the live EEG context snapshot,
// and clearly labeled as a rule-based estimate — never presented as a live AI
// answer.
// ---------------------------------------------------------------------------

import { Language } from "./i18n/translations";

interface DiagnosticCopy {
  offline_note: string;
  no_data: string;
  focus_high: string;
  focus_mid: string;
  focus_low: string;
  stress_high: string;
  stress_mid: string;
  stress_low: string;
  fatigue_high: string;
  fatigue_mid: string;
  fatigue_low: string;
  bands: string;
  tail: string;
  joiner: string;
}

const COPY: Record<Language, DiagnosticCopy> = {
  en: {
    offline_note:
      "The connection to DeepSeek AI failed or returned no reply — here is a rule-based summary from your EEG data:",
    no_data:
      "No live EEG data is available to analyze right now. Please connect a live EEG stream and ask again.",
    focus_high: "Focus score {value} — your brain is in a strong focus state.",
    focus_mid: "Focus score {value} — moderate focus state.",
    focus_low: "Focus score {value} — low focus; your brain would benefit from a short break.",
    stress_high:
      "Stress level {value} — elevated; consider a recovery activity such as slow deep breathing or a short eye rest.",
    stress_mid: "Stress level {value} — within a range worth monitoring.",
    stress_low: "Stress level {value} — within a normal range.",
    fatigue_high: "Mental fatigue {value} — elevated; plan short breaks between tasks.",
    fatigue_mid: "Mental fatigue {value} — moderate.",
    fatigue_low: "Mental fatigue {value} — within a normal range.",
    bands:
      "Relative band power: delta {delta} · theta {theta} · alpha {alpha} · beta {beta} · gamma {gamma}",
    tail:
      "This is preliminary screening, not a clinical diagnosis — reconnect to DeepSeek AI and ask again for a deeper analysis.",
    joiner: " · ",
  },
  th: {
    // Generated via the gateway model (see scripts/gen-thai.mjs convention);
    // verified at codepoint level.
    offline_note:
      "การเชื่่อมตอ่ DeepSeek AI ล้มเหลวหรือไม่ไดส้่งข้้อตอบกลบั — นีเ่ป็นข้้อสรุุปแบบ rule-based จากข้้อมูล EEG ของคณุ :",
    no_data:
      "ยงั ไมม่ ีข้้อมูล EEG สดใหว้ ิเคราะหช์ ว่ งน้ี กรุณาเชื่่อมตอ่ EEG Stream แบบสดแลว้ ถามใหม่",
    focus_high: "คะแนนสมาธ {value} — สภาวะสมองอย่ใู นระดบั โฟกััสทสี่ ุด",
    focus_mid: "คะแนนสมาธ {value} — สภาวะสมาธอ์ ย่ใู นระดบั กลาง",
    focus_low: "คะแนนสมาธ {value} — สภาวะสมาธิต่ำ ควรให้อีกลางสมองพกั ร้อน",
    stress_high:
      "ระดบั ความเครยี ด {value} — สงู ควรทำกจิ กรรมกบั การฟื้้นฟูเช่นการหายใจล้ึกๆ ช้าๆ สั้่นๆ",
    stress_mid: "ระดบั ความเครยี ด {value} — อย่ใู นระดบั ทตี่ ้องตดิ ตาม",
    stress_low: "ระดบั ความเครยี ด {value} — อย่ใู นระดบั ปกติ",
    fatigue_high: "ความล้าทางจติ ใจ {value} — สงู ควรวางแผนพกั สั้่นๆ ระหว่างงาน",
    fatigue_mid: "ความล้าทางจติ ใจ {value} — อย่ใู นระดบั กลาง",
    fatigue_low: "ความล้าทางจติ ใจ {value} — อย่ใู นระดบั ปกติ",
    bands: "อตั ราส่่วนตอ่ ของแถบคลื่่น: delta {delta} · theta {theta} · alpha {alpha} · beta {beta} · gamma {gamma}",
    tail:
      "ข้้อมูลน้ีเป็ นการคดั กรองเบื้ องต้น ไมใ่ ช่การวินิจฉยั ทางคลนิ ิก — เชื่่อมตอ่ DeepSeek AI สำเรจ็ แลว้ ถามใหม่เพื่่อการวเคราะหเ์ ชิงล้ึก",
    joiner: " · ",
  },
};

function pct(value: unknown, fallback = 0): number {
  const v = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, v));
}

function ratio(value: unknown, fallback = 0): number {
  const v = typeof value === "number" && Number.isFinite(value) ? value : Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function fill(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/**
 * Build a deterministic rule-based diagnostic reply from the EEG context
 * snapshot (the same shape `buildEEGContextSnapshot` sends to the backend).
 * `language` selects the reply language ("th" | "en").
 */
export function buildLocalDiagnostic(
  eegContext: Record<string, unknown> = {},
  language: Language = "en"
): string {
  const copy = COPY[language] ?? COPY.en;
  const ctx = eegContext ?? {};

  const parts: string[] = [copy.offline_note];

  const hasMetrics = ["focusScore", "stressLevel", "mentalFatigue"].some((k) => k in ctx);
  const hasBands = ["delta", "theta", "alpha", "beta", "gamma"].some((k) => k in ctx);

  if (!hasMetrics && !hasBands) {
    parts.push(copy.no_data);
  } else {
    if ("focusScore" in ctx) {
      const v = pct(ctx.focusScore);
      const key = v >= 60 ? "focus_high" : v >= 35 ? "focus_mid" : "focus_low";
      parts.push(fill(copy[key], { value: Math.round(v) }));
    }
    if ("stressLevel" in ctx) {
      const v = pct(ctx.stressLevel);
      const key = v >= 60 ? "stress_high" : v >= 35 ? "stress_mid" : "stress_low";
      parts.push(fill(copy[key], { value: Math.round(v) }));
    }
    if ("mentalFatigue" in ctx) {
      const v = pct(ctx.mentalFatigue);
      const key = v >= 60 ? "fatigue_high" : v >= 35 ? "fatigue_mid" : "fatigue_low";
      parts.push(fill(copy[key], { value: Math.round(v) }));
    }
    if (hasBands) {
      const pctFmt = (r: number) => `${Math.round(r * 100)}%`;
      parts.push(
        fill(copy.bands, {
          delta: pctFmt(ratio(ctx.delta)),
          theta: pctFmt(ratio(ctx.theta)),
          alpha: pctFmt(ratio(ctx.alpha)),
          beta: pctFmt(ratio(ctx.beta)),
          gamma: pctFmt(ratio(ctx.gamma)),
        })
      );
    }
  }

  parts.push(copy.tail);
  return parts.join(copy.joiner);
}
