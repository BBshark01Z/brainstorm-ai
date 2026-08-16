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


def build_analytics_tip_fallback(metrics: Dict[str, Any]) -> str:
    """Return a 2-4 sentence Thai tip computed from the metric deltas.

    The payload is the compact current-vs-30-day snapshot the frontend sends
    (``AnalyticsTipRequest.metrics``). It reads each metric's ``improved``
    flag and generates a short narrative grounded in the actual trend data.
    """

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
        return (
            "ยังมีข้อมูลไม่เพียงพอที่จะสรุปแนวโน้มในตอนนี้ กรุณาตรวจข้อมูลการวิเคราะห์ "
            "เชิงยาวของอีกครั้ง หรือรอให้มีข้อมูลมากขึ้น"
        )

    # Pick a headline sentence based on how broad the improvement is.
    if improved == total:
        headline = "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าแนวโน้มสุขภาพสมองของคุณกำลังดีขึ้นในทุกมิติ"
    elif improved >= total // 2:
        headline = "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าสุขภาพสมองส่วนใหญ่กำลังฟื้นตัวและปรับดีขึ้น"
    elif improved == 0:
        headline = "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าแนวโน้มสุขภาพสมองยังคงทรงตัวหรือชะลอลง"
    else:
        headline = "ข้อมูลในช่วง 30 วันที่ผ่านมาชี้ว่าสุขภาพสมองกำลังปรับตัวในทิศทางผสมกัน"

    specifics = []
    if burnout_improved:
        specifics.append("ค่าความเสี่ยงต่อภาวะหมดไฟ (burnout) ลดลง")
    else:
        specifics.append("ค่าความเสี่ยงต่อภาวะหมดไฟ (burnout) ยังอยู่ในระดับที่ต้องติดตาม")
    if sleep_improved:
        specifics.append("ความหนาแน่นของ sleep spindle เพิ่มขึ้น สอดคล้องกับการฟื้นฟูการนอนหลับ")
    else:
        specifics.append("ความหนาแน่นของ sleep spindle ยังไม่ขยับขึ้นอย่างชัดเจน")

    tail = (
        "ลองจับคู่แนวโน้มนี้กับความรู้สึกจริงในแต่ละวัน และหากตัวเลขมีความผันผวนผิดปกติ "
        "ควรปรึกษาผู้เชี่ยวชาญเพื่อการประเมินเชิงลึก (ข้อมูลนี้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย)"
    )

    return f"{headline} · {specifics[0]} และ{specifics[1]} · {tail}"