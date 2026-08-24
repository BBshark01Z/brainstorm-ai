"""
services/analytics_tip.py

Deterministic fallback tip builder for the Analytics page's AI tip panel.

The live path calls ``DeepSeekBrainConsultant.consult()``; when DeepSeek is
unconfigured or unreachable, ``/api/analytics/tip`` falls back to
``build_analytics_tip_fallback`` so the UI still shows something useful
(a short rule-based summary), flagged via ``used_fallback=True``.

This mirrors the platform's "simulated / always degrades to something usable"
convention, but WITHOUT pretending it's a live AI answer.
"""

from __future__ import annotations

from typing import Any, Dict


def _metric_value(
    metrics: Dict[str, Any], key: str, field: str, default: float = 0.0
) -> float:
    """Safely pull a numeric field out of a single metric's dict."""
    entry = metrics.get(key)
    if isinstance(entry, dict) and isinstance(entry.get(field), (int, float)):
        return float(entry[field])
    return default


# Fallback copy per language. The deterministic fallback is rule-based text, so
# it ships both languages here instead of asking the model.
_FALLBACK_COPY = {
    "th": {
        "no_data": (
            "ยังมีข้อมูลไม่เพียงพอที่จะสรุปแนวโน้มในตอนนี้ กรุณาตรวจข้อมูลการวิเคราะห์ "
            "เชิงยาวของอีกครั้ง หรือรอให้มีข้อมูลมากขึ้น"
        ),
        "headline_all": "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าแนวโน้มสุขภาพสมองของคุณกำลังดีขึ้นในทุกมิติ",
        "headline_most": "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าสุขภาพสมองส่วนใหญ่กำลังฟื้นตัวและปรับดีขึ้น",
        "headline_none": "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าแนวโน้มสุขภาพสมองยังคงทรงตัวหรือชะลอลง",
        "headline_mixed": "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าสุขภาพสมองกำลังปรับตัวในทิศทางผสมกัน",
        "burnout_down": "ค่าความเสี่ยงต่อภาวะหมดไฟ (burnout) ลดลง",
        "burnout_watch": "ค่าความเสี่ยงต่อภาวะหมดไฟ (burnout) ยังอยู่ในระดับที่ต้องติดตาม",
        "sleep_up": "ความหนาแน่นของ sleep spindle เพิ่มขึ้น สอดคล้องกับการฟื้นฟูการนอนหลับ",
        "sleep_flat": "ความหนาแน่นของ sleep spindle ยังไม่ขยับขึ้นอย่างชัดเจน",
        "tail": (
            "ลองจับคู่แนวโน้มนี้กับความรู้สึกจริงในแต่ละวัน และหากตัวเลขมีความผันผวนผิดปกติ "
            "ควรปรึกษาผู้เชี่ยวชาญเพื่อการประเมินเชิงลึก (ข้อมูลนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย)"
        ),
        "joiner": " และ ",
    },
    "en": {
        "no_data": (
            "There is not enough data yet to summarize trends right now. Please check your "
            "longitudinal analytics again or wait for more data to accumulate."
        ),
        "headline_all": "Your data over the past 30 days shows brain health improving across every dimension.",
        "headline_most": "Your data over the past 30 days shows most of your brain health recovering and improving.",
        "headline_none": "Your data over the past 30 days shows brain-health trends holding steady or slowing down.",
        "headline_mixed": "Your data over the past 30 days shows brain health adjusting in mixed directions.",
        "burnout_down": "Burnout risk is trending down.",
        "burnout_watch": "Burnout risk remains at a level worth monitoring.",
        "sleep_up": "Sleep spindle density is increasing, consistent with sleep recovery.",
        "sleep_flat": "Sleep spindle density has not clearly increased yet.",
        "tail": (
            "Compare this trend with how you actually feel day to day, and if the numbers fluctuate "
            "abnormally, consult a specialist for a deeper assessment (this is preliminary screening, "
            "not a diagnosis)."
        ),
        "joiner": " and ",
    },
}


def build_analytics_tip_fallback(metrics: Dict[str, Any], language: str = "en") -> str:
    """Return a 2-4 sentence tip (Thai or English) computed from the metric deltas.

    The payload is the compact current-vs-30-day snapshot the frontend sends
    (``AnalyticsTipRequest.metrics``). It reads each metric's ``improved``
    flag and generates a short narrative grounded in the actual trend data.
    """
    copy = _FALLBACK_COPY.get((language or "en").lower(), _FALLBACK_COPY["en"])

    # How many of the four tracked metrics improved vs. their 30-day average.
    improved = sum(
        1
        for key in ("burnout_risk", "faa_index", "sleep_spindle_density", "slow_wave_sleep")
        if bool(_metric_value(metrics, key, "improved", 0))
    )
    total = 4

    burnout_improved = bool(_metric_value(metrics, "burnout_risk", "improved", 0))
    sleep_improved = bool(_metric_value(metrics, "sleep_spindle_density", "improved", 0))

    if total == 0 or not metrics:
        return copy["no_data"]

    # Pick a headline sentence based on how broad the improvement is.
    if improved == total:
        headline = copy["headline_all"]
    elif improved >= total // 2:
        headline = copy["headline_most"]
    elif improved == 0:
        headline = copy["headline_none"]
    else:
        headline = copy["headline_mixed"]

    specifics = []
    if burnout_improved:
        specifics.append(copy["burnout_down"])
    else:
        specifics.append(copy["burnout_watch"])
    if sleep_improved:
        specifics.append(copy["sleep_up"])
    else:
        specifics.append(copy["sleep_flat"])

    return f"{headline} · {specifics[0]}{copy['joiner']}{specifics[1]} · {copy['tail']}"
