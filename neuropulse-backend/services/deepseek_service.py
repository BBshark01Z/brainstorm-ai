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
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "qwen3.8-27b-fp8")

# Language-neutral system prompt. The reply language is NOT baked in here —
# it is appended per-request via build_system_prompt(language) so the model
# always answers in the language the user selected in the UI (th / en).
SYSTEM_PROMPT = """You are the AI Neuro-Consultant for the NeuroPulse AI platform — an EEG monitoring and brain-health analysis system.

You work in a medical/neuroscience context. Your duties:
1. Analyze EEG data (delta, theta, alpha, beta, gamma band power)
2. Explain brain-health indices: Focus Score, Stress Level, Mental Fatigue, FAA (Frontal Alpha Asymmetry)
3. Give advice on brain health and neuroscience
4. Flag signals that warrant a doctor's visit (but do NOT diagnose — state that this is preliminary screening)

Important rules:
- Explain technical terms in plain, easy-to-understand language
- Focus on neuroscience and EEG interpretation
- Always remind the user that this analysis is preliminary screening only, not a medical diagnosis
- If you find severely abnormal values, recommend seeing a doctor promptly
- Always use the EEG data the user sends as the basis for your analysis
- Be concise, structured, and clear
"""

# Per-language reply directives appended to the system prompt.
LANGUAGE_DIRECTIVES = {
    "th": "Language directive: Reply entirely in Thai (ภาษาไทย). Keep technical terms (EEG, band names, indices) in their standard form.",
    "en": "Language directive: Reply entirely in English.",
}


def build_system_prompt(language: Optional[str] = None) -> str:
    """System prompt + the reply-language directive for the active UI language."""
    directive = LANGUAGE_DIRECTIVES.get((language or "en").lower(), LANGUAGE_DIRECTIVES["en"])
    return f"{SYSTEM_PROMPT}\n{directive}"


def _build_system_context(eeg_context: Dict) -> str:
    """Turns whatever metrics/features the caller sends into a short grounding block for the model."""
    lines = ["Latest EEG data context for the user:"]
    for key, value in eeg_context.items():
        lines.append(f"- {key}: {value}")
    return "\n".join(lines) if len(lines) > 1 else "No EEG data available at this time."


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

    async def consult(
        self,
        user_prompt: str,
        eeg_context: Optional[Dict] = None,
        language: Optional[str] = None,
    ) -> Dict:
        """
        Returns {"reply": str, "flagged_markers": list[str], "latency_ms": float}.

        `language` ("th" | "en") selects the reply-language directive; defaults
        to English. Raises HTTPException(500) when the API key is missing or
        the API call fails. No mock/fallback path.
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
                            {"role": "system", "content": build_system_prompt(language)},
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