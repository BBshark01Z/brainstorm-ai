"""
services/deepseek_service.py

`DeepSeekBrainConsultant` is the single class the rest of the backend talks to
for AI-generated insights. When `DEEPSEEK_API_KEY` is unset, or when the API
call fails, it raises an ``HTTPException(500)`` — there is NO mock/fallback
path.  The caller must handle the error.
"""

from __future__ import annotations

import os
import time
from typing import Dict, Optional

import httpx
from fastapi import HTTPException

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_ENDPOINT = os.getenv(
    "DEEPSEEK_API_ENDPOINT", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
)
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash-0731")

SYSTEM_PROMPT = """คุณคือ AI Neuro-Consultant สำหรับแพลตฟอร์ม NeuroPulse AI — ระบบตรวจสอบคลื่นสมอง (EEG) และการวิเคราะห์สุขภาพสมอง

คุณทำงานในบริบทการแพทย์และประสาทวิทยา คุณมีหน้าที่:
1. วิเคราะห์ข้อมูล EEG (delta, theta, alpha, beta, gamma band power)
2. อธิบายดัชนีสุขภาพสมอง: Focus Score, Stress Level, Mental Fatigue, FAA (Frontal Alpha Asymmetry)
3. ให้คำแนะนำด้านสุขภาพสมองและประสาทวิทยาศาสตร์
4. ชี้บ่งสัญญาณที่ควรปรึกษาแพทย์ (แต่อย่าวินิจฉัย — แจ้งว่าเป็นการคัดกรองเบื้องต้น)

กฎสำคัญ:
- ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้ขอเป็นภาษาอังกฤษ
- อธิบายศัพท์เทคนิคให้อ่านเข้าใจง่าย
- เน้นประสาทวิทยาศาสตร์และ EEG interpretation
- เตือนเสมอว่าการวิเคราะห์นี้เป็นเพียงการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์
- หากพบค่าผิดปกติรุนแรง ให้แนะนำพบแพทย์โดยเร็ว
- ใช้ข้อมูล EEG ที่ผู้ใช้ส่งมาประกอบการวิเคราะห์เสมอ
- ตอบกระชับ มีโครงสร้าง ชัดเจน
"""


def _build_system_context(eeg_context: Dict) -> str:
    """Turns whatever metrics/features the caller sends into a short grounding block for the model."""
    lines = ["บริบทข้อมูล EEG ล่าสุดของผู้ใช้:"]
    for key, value in eeg_context.items():
        lines.append(f"- {key}: {value}")
    return "\n".join(lines) if len(lines) > 1 else "ไม่มีข้อมูล EEG ประกอบในขณะนี้"


class DeepSeekBrainConsultant:
    """Thin async client wrapping the DeepSeek (OpenAI-compatible) chat completion API."""

    def __init__(
        self,
        api_key: str = DEEPSEEK_API_KEY,
        endpoint: str = DEEPSEEK_API_ENDPOINT,
        model: str = DEEPSEEK_MODEL,
    ) -> None:
        self.api_key = api_key
        self.endpoint = endpoint
        self.model = model

    def is_configured(self) -> bool:
        return bool(self.api_key.strip())

    async def consult(self, user_prompt: str, eeg_context: Optional[Dict] = None) -> Dict:
        """
        Returns {"reply": str, "flagged_markers": list[str], "latency_ms": float}.

        Raises HTTPException(500) when the API key is missing or the API call fails.
        No mock/fallback path.
        """
        eeg_context = eeg_context or {}
        start = time.perf_counter()

        if not self.is_configured():
            raise HTTPException(
                status_code=500,
                detail="DeepSeek API key is not configured. Please set the DEEPSEEK_API_KEY environment variable.",
            )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": _build_system_context(eeg_context)},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                )
                response.raise_for_status()
                data = response.json()
                reply = data["choices"][0]["message"]["content"]

            return {
                "reply": reply,
                "flagged_markers": [],
                "latency_ms": (time.perf_counter() - start) * 1000,
            }
        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="The AI service took too long to respond. Please try again.",
            )
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=exc.response.status_code,
                detail=f"DeepSeek API error: {exc.response.text}",
            )
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get response from DeepSeek API: {str(exc)}",
            )