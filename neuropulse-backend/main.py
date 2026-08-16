"""
main.py

NeuroPulse AI backend — FastAPI application.

Endpoints:
    Auth
        POST /api/auth/register          Register a new user account
        POST /api/auth/login             Login → JWT access token
        GET  /api/auth/me                Current user info (protected)

    Feature extraction
        POST /api/analyze                Full feature extraction for uploaded/streamed raw channels

    Brainprint (all protected — require JWT)
        POST /api/brainprint/verify      Match an embedding against enrolled profiles (+ OOD check)
        POST /api/brainprint/register    Enroll a new nickname + embedding for the authenticated user
        GET  /api/brainprint/profiles    List enrolled profiles for the authenticated user

    AI Consultant (protected — require JWT)
        POST /api/deepseek-chat          AI Neuro-Consultant chat (real DeepSeek call only)
        GET  /api/deepseek-chat/history  Chat history for the authenticated user

    WebSocket — /ws/eeg-stream (disabled by default in production; see DISABLE_DEMO_STREAM)

Run with:
    uvicorn main:app --reload --port 8765
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time

import numpy as np

from dotenv import load_dotenv
from pathlib import Path

# NOTE: .env changes require a FULL backend restart, not just --reload. python-dotenv
# loads once at import (values are cached here), and uvicorn --reload only watches
# `*.py` files by default — it does not watch `.env`. Edits to `.py` files normally
# hot-reload; edits to `.env` need a manual restart (stop uvicorn, start again).
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt as _bcrypt

from db.database import (
    DATABASE_PATH,
    create_user,
    find_user_by_email,
    find_user_by_id,
    get_chat_history,
    get_recent_messages,
    get_all_profiles,
    init_db,
    insert_profile,
    increment_session_count,
    save_chat_message,
)
from schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BrainprintProfileSummary,
    BrainprintRegisterRequest,
    BrainprintRegisterResponse,
    BrainprintVerifyRequest,
    BrainprintVerifyResponse,
    ChannelFeatureSet,
    DeepSeekChatRequest,
    DeepSeekChatResponse,
    HjorthParameters,
    LoginRequest,
    LoginResponse,
    ReferenceAggregate,
    ReferenceBandPower,
    ReferenceCompareRequest,
    ReferenceCompareResponse,
    ReferenceSubjectInfo,
    ReferenceSubjectMeta,
    ReferenceSubjectsResponse,
    RegisterRequest,
    UserResponse,
    AnalyticsTipRequest,
    AnalyticsTipResponse,
)
from services import feature_extractor
from services.analytics_tip import build_analytics_tip_fallback
from services.deepseek_service import SYSTEM_PROMPT, _build_system_context, DeepSeekBrainConsultant

# ---------------------------------------------------------------------------
# Load trained brain-state model at startup
# ---------------------------------------------------------------------------

import joblib
from pathlib import Path

_MODEL_PATH = Path(__file__).parent / "models" / "brain_state_model.joblib"
_brain_state_pipeline = None  # {scaler, model}


def load_brain_state_model() -> dict | None:
    """
    Load the trained model + scaler pipeline.
    Returns None if not found — WebSocket will fallback to biomarker-only mode.
    """
    global _brain_state_pipeline
    if not _MODEL_PATH.exists():
        logger.info("No brain state model found at %s — using biomarker-only mode", _MODEL_PATH)
        return None
    try:
        _brain_state_pipeline = joblib.load(_MODEL_PATH)
        logger.info("Brain state model loaded from %s", _MODEL_PATH)
        return _brain_state_pipeline
    except Exception as exc:
        logger.warning("Failed to load brain state model: %s — using biomarker-only mode", exc)
    return None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("neuropulse.main")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "neurop-production-static-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


# bcrypt helper functions — bcrypt has a 72-byte password limit

def get_password_hash(password: str) -> str:
    """Hash a password for storing. Truncates to 72 bytes to avoid ValueError."""
    password_bytes = password[:72].encode("utf-8")
    salt = _bcrypt.gensalt()
    return _bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash. Truncates to 72 bytes."""
    password_bytes = plain_password[:72].encode("utf-8")
    return _bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ---------------------------------------------------------------------------
# CORS + Global Error Handling Pattern
#
# CRITICAL: FastAPI's CORSMiddleware only adds Access-Control-Allow-Origin
# headers to *successful* responses. When a route handler raises an unhandled
# Exception, Starlette's default 500 handler fires WITHOUT CORS headers,
# which the browser reports as "CORS policy: No Access-Control-Allow-Origin
# header is present" — a misleading error that looks like a CORS misconfig
# but is actually an unhandled server-side crash.
#
# FIX: A global @app.exception_handler(Exception) catches ALL unhandled
# exceptions, logs the full traceback server-side, and returns a JSON 500
# response WITH CORS headers attached. This ensures:
#   1. The browser sees a proper CORS error response (not a blank response)
#   2. The frontend fetch helper can distinguish network failures from HTTP errors
#   3. The actual error message reaches the client for debugging
#
# SEE ALSO: neuorpulse-ai/lib/fetchWithHealth.ts — the frontend counterpart.
# ---------------------------------------------------------------------------

app = FastAPI(title="NeuroPulse AI Backend", version="1.0.0")

_cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001").split(",")
]

# Tunnel-domain regex — matches ANY subdomain of ngrok/cloudflare tunnel.
# This is a single compiled pattern passed to CORSMiddleware's allow_origin_regex
# parameter, which is the ONLY way Starlette supports pattern matching on Origin.
_TUNNEL_ORIGIN_REGEX = re.compile(
    r"https://.*\.(trycloudflare\.com|ngrok-free\.app|ngrok\.io)$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_TUNNEL_ORIGIN_REGEX.pattern,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Global exception handler — ensures CORS headers on ALL responses, including 500s
#
# Without this, any unhandled exception in a route handler produces a raw HTML
# 500 response from Starlette that carries NO Access-Control-Allow-Origin
# header. The browser then reports "CORS policy blocked" — which looks like a
# CORS misconfiguration but is actually a server crash. This handler ensures:
#   1. Every 500 response carries the same CORS headers as successful responses
#   2. The actual Python traceback is logged server-side for debugging
#   3. The client receives a clean JSON error object instead of HTML
# ---------------------------------------------------------------------------

from starlette.requests import Request
from starlette.responses import JSONResponse


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Catch ALL 422 Validation Errors and log the raw request body.

    422 fires at PARAMETER VALIDATION — before the route handler body runs.
    This logs the exact raw bytes the backend received over the wire,
    before Pydantic parsing. Critical for diagnosing whether corruption
    happens in transit (Next.js proxy, etc.) or server-side.
    """
    raw_body = await request.body()
    logger.error(
        "Validation error on %s %s — raw body received: %r",
        request.method, request.url.path, raw_body,
    )

    def _safe_errors(errors):
        out = []
        for e in errors:
            e = dict(e)
            if isinstance(e.get("input"), bytes):
                e["input"] = e["input"].decode("utf-8", errors="replace")
            out.append(e)
        return out

    return JSONResponse(status_code=422, content={"detail": _safe_errors(exc.errors())})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch ALL unhandled exceptions, log traceback, return JSON 500 with CORS headers."""
    logger.exception(
        "Unhandled exception in %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    # Build CORS header value — reuse the same origin list as CORSMiddleware
    origin = request.headers.get("origin", "")
    cors_headers: dict[str, str] = {}
    if origin in _cors_origins or _TUNNEL_ORIGIN_REGEX.match(origin):
        cors_headers["access-control-allow-origin"] = origin

    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
        headers=cors_headers if cors_headers else None,
    )

deepseek_consultant = DeepSeekBrainConsultant()


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------


def _create_access_token(data: dict) -> str:
    """Encode *data* into a signed JWT access token with an expiry."""
    from datetime import datetime, timezone, timedelta

    to_encode = data.copy()
    # python-jose requires 'sub' to be a string; SQLite returns int ids
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    to_encode.update({"exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Decode the JWT token and return the user dict. Raises 401 on failure."""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        # jwt.encode stores sub as string; DB expects int
        user_id = int(user_id)
    except JWTError:
        raise credentials_exception
    except (ValueError, TypeError):
        raise credentials_exception

    user = find_user_by_id(user_id)
    if user is None:
        raise credentials_exception
    return user


# ---------------------------------------------------------------------------
# Startup — verify all required dependencies are available
# ---------------------------------------------------------------------------

_startup_status: dict = {
    "db": "unknown",
    "db_tables": {},
    "model": "not_loaded",
    "deepseek": "unknown",
}


def _verify_db_integrity() -> None:
    """
    Verify that all required tables exist and are writable.
    Updates _startup_status with results.
    """
    import sqlite3

    try:
        conn = sqlite3.connect(DATABASE_PATH)
        conn.row_factory = sqlite3.Row
        required_tables = {"users", "brainprint_profiles", "chat_messages"}
        existing = {
            row["name"]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        conn.close()

        for table in required_tables:
            if table in existing:
                _startup_status["db_tables"][table] = "ok"
            else:
                _startup_status["db_tables"][table] = "missing"

        # Test write to verify DB is actually writable
        try:
            conn = sqlite3.connect(DATABASE_PATH)
            conn.execute("SELECT 1")
            conn.close()
            _startup_status["db"] = "ok"
        except Exception as e:
            _startup_status["db"] = f"error: {e}"
    except Exception as e:
        _startup_status["db"] = f"error: {e}"


@app.on_event("startup")
def _on_startup() -> None:
    init_db()
    _verify_db_integrity()
    load_brain_state_model()
    _startup_status["deepseek"] = "configured" if deepseek_consultant.is_configured() else "not_configured"

    missing = [t for t, s in _startup_status["db_tables"].items() if s != "ok"]
    if missing:
        logger.warning("Missing DB tables on startup: %s", missing)
    else:
        logger.info("Database ready. All required tables present.")

    logger.info("DeepSeek configured: %s", deepseek_consultant.is_configured())
    logger.info("Startup status: %s", _startup_status)
    logger.info("CORS allow_origins: %s", _cors_origins)
    logger.info("CORS allow_origin_regex: %s", _TUNNEL_ORIGIN_REGEX.pattern)
    logger.info("CORS allow_credentials: True, allow_methods: ['*'], allow_headers: ['*']")


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------


@app.post("/api/auth/register", response_model=UserResponse)
def auth_register(payload: RegisterRequest) -> UserResponse:
    """Register a new user account. Returns 400 if email already exists."""
    existing = find_user_by_email(payload.email)
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = get_password_hash(payload.password)
    user = create_user(payload.email, password_hash, payload.nickname)
    return UserResponse(
        user_id=user["id"],
        email=user["email"],
        nickname=user["nickname"],
        created_at=user["created_at"],
    )


@app.post("/api/auth/login", response_model=LoginResponse)
def auth_login(payload: LoginRequest) -> LoginResponse:
    """Authenticate and return a JWT access token."""
    user = find_user_by_email(payload.email)
    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = _create_access_token({"sub": user["id"]})
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user["id"],
        email=user["email"],
        nickname=user["nickname"],
    )


@app.get("/api/auth/me", response_model=UserResponse)
def auth_me(current_user: dict = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user's info (no password hash)."""
    return UserResponse(
        user_id=current_user["id"],
        email=current_user["email"],
        nickname=current_user["nickname"],
        created_at=current_user["created_at"],
    )


# ---------------------------------------------------------------------------
# Root & health
# ---------------------------------------------------------------------------


@app.get("/")
def read_root() -> dict:
    return {
        "status": "online",
        "message": "NeuroPulse AI Backend is running.",
        "docs_url": "/docs",
    }


@app.get("/health")
def health() -> dict:
    """
    Health check endpoint — reports backend status, model load status,
    and DB/file readiness. Frontend should ping this on load to detect
    connection issues before they manifest as mysterious fetch failures.
    """
    return {
        "status": "ok",
        "deepseek_configured": deepseek_consultant.is_configured(),
        "startup": _startup_status,
    }


# ---------------------------------------------------------------------------
# /api/analyze
# ---------------------------------------------------------------------------


def _find_alpha_power(channel_name: str, results_by_channel: dict) -> float | None:
    result = results_by_channel.get(channel_name)
    return result["band_power"]["alpha"] if result else None


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    results_by_channel: dict = {}
    channel_feature_sets: list[ChannelFeatureSet] = []
    channel_features_for_embedding: list[dict] = []

    for channel in payload.channels:
        raw_result = feature_extractor.extract_channel_features(
            channel.samples, payload.sampling_rate_hz, notch_freq=payload.notch_freq_hz
        )
        results_by_channel[channel.channel_name] = raw_result
        channel_features_for_embedding.append(raw_result)

        channel_feature_sets.append(
            ChannelFeatureSet(
                channel_name=channel.channel_name,
                band_power=raw_result["band_power"],
                differential_entropy=raw_result["differential_entropy"],
                hjorth=HjorthParameters(**raw_result["hjorth"]),
                theta_beta_ratio=raw_result["theta_beta_ratio"],
            )
        )

    faa_index = None
    alpha_f3 = _find_alpha_power("F3", results_by_channel)
    alpha_f4 = _find_alpha_power("F4", results_by_channel)
    if alpha_f3 is not None and alpha_f4 is not None:
        faa_index = feature_extractor.frontal_alpha_asymmetry(alpha_f3, alpha_f4)

    embedding = feature_extractor.build_embedding_vector(channel_features_for_embedding)

    return AnalyzeResponse(channels=channel_feature_sets, faa_index=faa_index, embedding=embedding)


# ---------------------------------------------------------------------------
# /api/brainprint/*  (all protected — require JWT)
# ---------------------------------------------------------------------------


@app.post("/api/brainprint/verify", response_model=BrainprintVerifyResponse)
def verify_brainprint(
    payload: BrainprintVerifyRequest,
    current_user: dict = Depends(get_current_user),
) -> BrainprintVerifyResponse:
    """Verify an EEG embedding against the current user's enrolled profiles."""
    try:
        from services import brainprint_ml

        result = brainprint_ml.recognize(payload.eeg_features, current_user["id"])
        return BrainprintVerifyResponse(**result)
    except Exception as e:
        logger.error("Brainprint verify failed for user %d: %s", current_user["id"], exc_info=True)
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")


@app.post("/api/brainprint/register", response_model=BrainprintRegisterResponse)
def register_brainprint(
    payload: BrainprintRegisterRequest,
    current_user: dict = Depends(get_current_user),
) -> BrainprintRegisterResponse:
    """Enroll a new Brainprint profile for the authenticated user."""
    try:
        profile = insert_profile(
            user_id=current_user["id"],
            nickname=payload.nickname,
            embedding=payload.eeg_features,
            notes=payload.notes,
        )
        return BrainprintRegisterResponse(
            profile_id=profile["id"],
            nickname=profile["nickname"],
            created_at=profile["created_at"],
            message=f"'{payload.nickname}' saved — recognizable on the very next verify call.",
        )
    except Exception as e:
        logger.error("Brainprint register failed for user %d: %s", current_user["id"], exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


@app.get("/api/brainprint/profiles", response_model=list[BrainprintProfileSummary])
def list_brainprint_profiles(
    current_user: dict = Depends(get_current_user),
) -> list[BrainprintProfileSummary]:
    """List all enrolled Brainprint profiles for the authenticated user."""
    try:
        profiles = get_all_profiles(current_user["id"])
        return [
            BrainprintProfileSummary(
                profile_id=p["id"],
                nickname=p["nickname"],
                notes=p["notes"],
                created_at=p["created_at"],
                sessions_count=p["sessions_count"],
            )
            for p in profiles
        ]
    except Exception as e:
        logger.error("Brainprint profiles list failed for user %d: %s", current_user["id"], exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list profiles: {str(e)}")


# ---------------------------------------------------------------------------
# /api/deepseek-chat  (protected — require JWT)
# ---------------------------------------------------------------------------


@app.post("/api/deepseek-chat")
async def deepseek_chat(
    payload: DeepSeekChatRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a prompt to the DeepSeek AI Neuro-Consultant with streaming support.
    - Fetches recent chat history for context.
    - Streams the DeepSeek gateway SSE response to the frontend as SSE chunks.
    - Accumulates the full reply, saves to DB after streaming completes.
    """
    logger.info("deepseek-chat handler (streaming): user_prompt=%r eeg_context=%r", payload.user_prompt, payload.eeg_context)

    # 1. Fetch recent chat history for context (limit to last 2 messages to
    # keep payload small and model response fast).
    history = get_recent_messages(current_user["id"], limit=2)
    context_messages = [
        {"role": msg["role"], "content": msg["content"][:2000]}
        for msg in history
    ]

    # 2. Build full conversation for DeepSeek.
    #
    #    a) Fixes mojibake: the system prompt is reused from the service module
    #       (deepseek_service.SYSTEM_PROMPT) instead of being duplicated inline
    #       here — the inline copy had corrupted Thai characters. One source of
    #       truth, always correctly-encoded UTF-8.
    #
    #    b) Wires eeg_context into the model request the same way that
    #       DeepSeekBrainConsultant.consult() does — via _build_system_context.
    #       Previously the field was only persisted to the DB and never reached
    #       the messages sent to the gateway, so the model had no idea what EEG
    #       data it was discussing.
    all_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]
    if payload.eeg_context:
        all_messages.append({"role": "user", "content": _build_system_context(payload.eeg_context)})
    all_messages.extend(context_messages)
    all_messages.append({"role": "user", "content": payload.user_prompt})

    # 3. Stream from DeepSeek gateway as SSE, yield chunks to frontend
    import httpx
    from fastapi import HTTPException

    if not deepseek_consultant.is_configured():
        raise HTTPException(
            status_code=500,
            detail="DeepSeek API key is not configured. Please set the DEEPSEEK_API_KEY environment variable.",
        )

    start = time.perf_counter()

    # Pre-emptively save the user message so it appears even if streaming fails
    eeg_snap = payload.eeg_context if payload.eeg_context else None
    save_chat_message(current_user["id"], "user", payload.user_prompt, eeg_snap)

    async def event_stream():
        """Generator that streams SSE chunks from the DeepSeek gateway to the client."""
        full_reply = []
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Use client.stream for streaming SSE support
                async with client.stream(
                    "POST",
                    deepseek_consultant.endpoint,
                    headers={
                        "Authorization": f"Bearer {deepseek_consultant.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": deepseek_consultant.model,
                        "messages": all_messages,
                        "stream": True,
                    },
                ) as response:
                    if response.status_code >= 400:
                        # Non-streaming error from gateway — read body, yield as SSE error
                        error_body = await response.aread()
                        logger.error(
                            "DeepSeek gateway error %s %s: %s",
                            response.status_code, deepseek_consultant.endpoint,
                            error_body[:2000].decode("utf-8", errors="replace"),
                        )
                        # Try to parse the error as SSE-style event
                        yield f"data: {{\"error\": {json.dumps(error_body[:2000].decode('utf-8', errors='replace'))}}}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    # Parse SSE chunks from the streaming response
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        # SSE format: "data: <json>"
                        if line.startswith("data: "):
                            payload_text = line[6:]  # strip "data: " prefix
                            if payload_text == "[DONE]":
                                continue
                            try:
                                chunk = json.loads(payload_text)
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    full_reply.append(content)
                                    # Forward as SSE event to the frontend
                                    yield f"data: {json.dumps({'token': content})}\n\n"
                            except json.JSONDecodeError:
                                # Non-JSON SSE line — forward as-is
                                yield f"data: {json.dumps({'token': payload_text})}\n\n"

                    # Signal end of stream
                    yield "data: [DONE]\n\n"

        except httpx.TimeoutException:
            logger.error("DeepSeek gateway timed out after 60s")
            yield f"data: {json.dumps({'error': 'The AI service took too long to respond. Please try again.'})}\n\n"
            yield "data: [DONE]\n\n"
        except httpx.HTTPStatusError as exc:
            logger.error(
                "DeepSeek HTTPStatusError %s: %s",
                exc.response.status_code, exc.response.text[:2000],
            )
            yield f"data: {json.dumps({'error': f'DeepSeek API error: {exc.response.text[:500]}'})}\n\n"
            yield "data: [DONE]\n\n"
        except httpx.HTTPError as exc:
            logger.error("DeepSeek streaming error: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'error': f'Streaming error: {str(exc)}'})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            logger.exception("Unexpected error in deepseek-chat streaming: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

        # 4. Save the full assembled reply to chat_messages after streaming completes
        reply_text = "".join(full_reply)
        if reply_text:
            latency_ms = (time.perf_counter() - start) * 1000
            logger.info("deepseek-chat: saved %d chars reply in %.0fms", len(reply_text), latency_ms)
            save_chat_message(current_user["id"], "assistant", reply_text, eeg_snap)
        else:
            # Streaming failed — save the error message
            latency_ms = (time.perf_counter() - start) * 1000
            logger.warning("deepseek-chat: no reply content saved (latency %.0fms)", latency_ms)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering if behind proxy
        },
    )


@app.get("/api/deepseek-chat/history")
def get_chat_history_endpoint(
    current_user: dict = Depends(get_current_user),
) -> list[dict]:
    """Return the full chat history for the authenticated user."""
    messages = get_chat_history(current_user["id"], limit=500)
    return [
        {
            "id": msg["id"],
            "role": msg["role"],
            "content": msg["content"],
            "eeg_snapshot": msg["eeg_snapshot"],
            "created_at": msg["created_at"],
        }
        for msg in messages
    ]


# ---------------------------------------------------------------------------
# /api/analytics/tip  (protected — require JWT)
# ---------------------------------------------------------------------------
# Short AI-generated tip for the Analytics page. Uses the DeepSeek consultant (the
# same established AI path as /api/deepseek-chat) and gracefully degrades to a
# deterministic local tip when DeepSeek is unconfigured or unreachable — returning
# HTTP 200 with `used_fallback: true` so the UI labels it an offline estimate.


@app.post("/api/analytics/tip")
async def analytics_tip(
    payload: AnalyticsTipRequest,
    current_user: dict = Depends(get_current_user),
) -> AnalyticsTipResponse:
    """
    Summarize the supplied longitudinal analytics metrics in 2-4 sentences.

    - Live path: DeepSeekBrainConsultant.consult() grounded in the metrics.
    - Fallback: build_analytics_tip_fallback() when DeepSeek is unreachable
      (no key, timeout, HTTP error) so the feature always returns something.
    """
    metrics = payload.metrics or {}
    logger.info("analytics-tip handler: user_id=%s metrics_keys=%s", current_user["id"], list(metrics.keys()))

    prompt = (
        "จากข้อมูลการวิเคราะห์เชิงยาว (longitudinal) ที่ให้มา "
        "จงเขียนสรุปสั้นๆ 2-4 ประโยคให้ผู้ใช้ทราบว่าข้อมูลนี้กำลังบอกอะไร "
        "เน้นแนวโน้มสำคัญของตัวชี้วัด (เช่น ค่าความเสี่ยง burnout, FAA, sleep spindle density, "
        "slow-wave sleep) เมื่อเทียบกับค่าเฉลี่ย 30 วันที่ผ่านมา "
        "และให้คำแนะนำเชิงปฏิบัติ 1 ข้อ พร้อมเตือนว่าข้อมูลนี้เป็นการคัดกรองเบื้องต้นไม่ใช่การวินิจฉัย"
    )

    try:
        result = await deepseek_consultant.consult(prompt, eeg_context=metrics)
        tip = (result.get("reply") or "").strip()
        if not tip:
            raise ValueError("empty DeepSeek reply")
        return AnalyticsTipResponse(tip=tip, used_fallback=False, latency_ms=result.get("latency_ms", 0.0))
    except Exception as exc:  # noqa: BLE001 — any failure degrades to the local tip
        logger.warning(
            "analytics-tip DeepSeek call failed, using local fallback for user %s: %s",
            current_user["id"], exc,
        )
        return AnalyticsTipResponse(
            tip=build_analytics_tip_fallback(metrics),
            used_fallback=True,
            latency_ms=0.0,
        )


# ---------------------------------------------------------------------------
# WebSocket — /ws/eeg-stream (disabled by default in production)
# ---------------------------------------------------------------------------

DEMO_SAMPLING_RATE_HZ = 256.0
DEMO_WINDOW_DURATION_S = 4.0
DEMO_TICK_INTERVAL_S = 0.3

_DISABLE_DEMO = os.getenv("DISABLE_DEMO_STREAM", "false").lower() in ("1", "true", "yes")

# Heartbeat configuration
HEARTBEAT_INTERVAL_S = 15.0
HEARTBEAT_MAX_MISSED = 3


def _compute_relative_power(band_power: dict[str, float]) -> dict[str, float]:
    """Convert absolute band powers to relative (sum to 1.0)."""
    total = sum(v for v in band_power.values())
    if total <= 1e-12:
        return {k: 0.0 for k in band_power}
    return {k: v / total for k, v in band_power.items()}


def _decompose_raw_to_bands(raw_signal: list[float], sampling_rate_hz: float) -> dict[str, float]:
    """
    Decompose a raw time-domain signal into 5 canonical EEG bands using Welch PSD.
    Returns relative power (summing to 1.0) for delta, theta, alpha, beta, gamma.
    """
    import numpy as np
    from scipy.signal import welch

    data = np.asarray(raw_signal, dtype=np.float64)
    if len(data) < 2:
        return {"delta": 0.0, "theta": 0.0, "alpha": 0.0, "beta": 0.0, "gamma": 0.0}

    # Band frequency ranges (Hz)
    bands = {
        "delta": (0.5, 4.0),
        "theta": (4.0, 8.0),
        "alpha": (8.0, 13.0),
        "beta": (13.0, 30.0),
        "gamma": (30.0, 45.0),
    }

    nperseg = min(len(data), int(sampling_rate_hz * 2))
    if nperseg < 4:
        nperseg = max(4, len(data) // 2)

    try:
        freqs, psd = welch(data, fs=sampling_rate_hz, nperseg=nperseg)
    except Exception:
        return {"delta": 0.0, "theta": 0.0, "alpha": 0.0, "beta": 0.0, "gamma": 0.0}

    absolute_power = {}
    for band_name, (fmin, fmax) in bands.items():
        mask = (freqs >= fmin) & (freqs <= fmax)
        if np.any(mask):
            absolute_power[band_name] = float(np.trapz(psd[mask], freqs[mask]))
        else:
            absolute_power[band_name] = 0.0

    return _compute_relative_power(absolute_power)


if not _DISABLE_DEMO:
    # Only register WebSocket route when demo stream is NOT disabled
    @app.websocket("/ws/eeg-stream")
    async def eeg_stream(websocket: WebSocket) -> None:
        """
        Auto-streams computed EEG metrics.
        - Sends heartbeat ping every HEARTBEAT_INTERVAL_S seconds
        - Expects pong from client within HEARTBEAT_MAX_MISSED intervals or disconnects
        - Accepts 'raw' message with {samples: [...], sampling_rate_hz: N} to compute bands
          from raw time-domain signal using Welch PSD decomposition
        """
        try:
            await websocket.accept()
        except Exception as exc:
            logger.warning("Failed to accept WebSocket connection: %s", exc)
            return

        logger.info("WebSocket client connected from %s", websocket.client.host if websocket.client else "unknown")

        from services import demo_signal_source

        elapsed = DEMO_WINDOW_DURATION_S
        last_heartbeat = time.time()
        missed_heartbeats = 0

        try:
            while True:
                # Check for incoming messages (pings, raw data, etc.)
                try:
                    raw_msg = await asyncio.wait_for(
                        websocket.receive_text(),
                        timeout=0.1,  # Short timeout to allow periodic heartbeat checks
                    )
                    # Handle client pong
                    if raw_msg == "PONG":
                        missed_heartbeats = 0  # Reset on pong
                        continue
                    try:
                        msg_data = json.loads(raw_msg)
                        if isinstance(msg_data, dict) and msg_data.get("type") == "pong":
                            missed_heartbeats = 0
                            continue
                    except (json.JSONDecodeError, ValueError):
                        pass
                    # Handle raw signal decomposition request from client
                    if isinstance(msg_data, dict) and msg_data.get("type") == "decompose":
                        samples = msg_data.get("samples", [])
                        sr = msg_data.get("sampling_rate_hz", DEMO_SAMPLING_RATE_HZ)
                        if isinstance(samples, list) and len(samples) > 0:
                            bands = _decompose_raw_to_bands(samples, sr)
                            await websocket.send_json({
                                "type": "decompose_result",
                                "bands": bands,
                            })
                except asyncio.TimeoutError:
                    pass  # No message received, continue to heartbeat/stream logic

                now = time.time()

                # Send heartbeat ping if interval elapsed
                if now - last_heartbeat >= HEARTBEAT_INTERVAL_S:
                    try:
                        await websocket.send_text("PING")
                        logger.debug("Sent heartbeat PING")
                    except Exception as exc:
                        logger.warning("Failed to send heartbeat PING: %s", exc)
                        break
                    last_heartbeat = now
                    missed_heartbeats += 1
                    if missed_heartbeats > HEARTBEAT_MAX_MISSED:
                        logger.warning("Client unresponsive — disconnecting")
                        break
                    continue

                raw = demo_signal_source.generate_raw_window(
                    elapsed, DEMO_WINDOW_DURATION_S, DEMO_SAMPLING_RATE_HZ
                )
                elapsed += DEMO_TICK_INTERVAL_S

                generic = feature_extractor.extract_channel_features(raw["generic"], DEMO_SAMPLING_RATE_HZ)
                f3 = feature_extractor.extract_channel_features(raw["F3"], DEMO_SAMPLING_RATE_HZ)
                f4 = feature_extractor.extract_channel_features(raw["F4"], DEMO_SAMPLING_RATE_HZ)

                # Use relative power for more stable display values
                rel_power = _compute_relative_power(generic["band_power"])

                # Compute biomarkers from band power
                biomarkers = feature_extractor.compute_all_biomarkers(generic["band_power"])

                # Brain state prediction via trained ML model
                brain_state = None
                brain_confidence = 0.0
                brain_probabilities = {}
                if _brain_state_pipeline is not None:
                    try:
                        # Build feature vector for the model
                        theta = generic["band_power"].get("theta", 0.0)
                        alpha = generic["band_power"].get("alpha", 0.0)
                        beta = generic["band_power"].get("beta", 0.0)
                        gamma = generic["band_power"].get("gamma", 0.0)
                        delta = generic["band_power"].get("delta", 0.0)

                        focus_idx = beta / (theta + alpha) if (theta + alpha) > 1e-12 else 0.0
                        high_beta = beta * 0.6
                        stress_idx = high_beta / alpha if alpha > 1e-12 else 0.0
                        total_power = sum(generic["band_power"].values())
                        relax_idx = alpha / total_power if total_power > 1e-12 else 0.0

                        feature_vec = np.array([[
                            delta, theta, alpha, beta, gamma,
                            focus_idx, stress_idx, relax_idx,
                        ]])

                        scaler = _brain_state_pipeline["scaler"]
                        model = _brain_state_pipeline["model"]
                        X_scaled = scaler.transform(feature_vec)
                        prediction = model.predict(X_scaled)[0]
                        probabilities = model.predict_proba(X_scaled)[0]
                        classes = model.classes_

                        brain_state = prediction
                        brain_confidence = float(max(probabilities))
                        brain_probabilities = {
                            cls: round(float(p), 4)
                            for cls, p in zip(classes, probabilities)
                        }
                    except Exception as exc:
                        logger.warning("Brain state prediction failed: %s", exc)

                payload = {
                    "delta": round(rel_power.get("delta", 0), 6),
                    "theta": round(rel_power.get("theta", 0), 6),
                    "alpha": round(rel_power.get("alpha", 0), 6),
                    "beta": round(rel_power.get("beta", 0), 6),
                    "gamma": round(rel_power.get("gamma", 0), 6),
                    "alphaF3": round(f3["band_power"]["alpha"], 6),
                    "alphaF4": round(f4["band_power"]["alpha"], 6),
                    # Biomarkers
                    "focus_index": biomarkers["focus_index"],
                    "stress_index": biomarkers["stress_index"],
                    "relaxation_index": biomarkers["relaxation_index"],
                    # ML brain state prediction
                    "brain_state": brain_state,
                    "brain_confidence": round(brain_confidence, 4),
                    "brain_probabilities": brain_probabilities,
                }
                try:
                    await websocket.send_json(payload)
                except Exception as exc:
                    logger.warning("Failed to send EEG payload — client likely disconnected: %s", exc)
                    break
                await asyncio.sleep(DEMO_TICK_INTERVAL_S)

        except WebSocketDisconnect:
            logger.info("WebSocket client disconnected")
        except Exception:
            logger.exception("Unexpected error in WebSocket stream — closing connection")


# ---------------------------------------------------------------------------
# /api/decompose — Raw signal → brain wave bands (Welch PSD)
# ---------------------------------------------------------------------------


class RawSignalRequest(BaseModel):
    """Request body for raw signal decomposition."""
    samples: List[float]
    sampling_rate_hz: float = 256.0
    channel_name: str = "generic"


class BandPowerResponse(BaseModel):
    """Response with relative power per band."""
    channel: str
    relative_power: dict[str, float]
    absolute_power: dict[str, float]
    sampling_rate_hz: float


@app.post("/api/decompose", response_model=BandPowerResponse)
def decompose_signal(payload: RawSignalRequest) -> BandPowerResponse:
    """
    Decompose a raw time-domain EEG signal into 5 brain wave bands.
    Uses Welch PSD (scipy.signal.welch) and returns relative power (sum=1.0).

    Band ranges:
      - Delta:  0.5–4.0 Hz
      - Theta:  4.0–8.0 Hz
      - Alpha:  8.0–13.0 Hz
      - Beta:   13.0–30.0 Hz
      - Gamma:  30.0–45.0 Hz
    """
    import numpy as np
    from scipy.signal import welch

    data = np.asarray(payload.samples, dtype=np.float64)
    sfreq = payload.sampling_rate_hz

    bands = {
        "delta": (0.5, 4.0),
        "theta": (4.0, 8.0),
        "alpha": (8.0, 13.0),
        "beta": (13.0, 30.0),
        "gamma": (30.0, 45.0),
    }

    nperseg = min(len(data), int(sfreq * 2))
    if nperseg < 4:
        nperseg = max(4, len(data) // 2)

    freqs, psd = welch(data, fs=sfreq, nperseg=nperseg)

    absolute_power = {}
    for band_name, (fmin, fmax) in bands.items():
        mask = (freqs >= fmin) & (freqs <= fmax)
        if np.any(mask):
            absolute_power[band_name] = float(np.trapz(psd[mask], freqs[mask]))
        else:
            absolute_power[band_name] = 0.0

    relative_power = _compute_relative_power(absolute_power)

    return BandPowerResponse(
        channel=payload.channel_name,
        absolute_power=absolute_power,
        relative_power=relative_power,
        sampling_rate_hz=sfreq,
    )


# ---------------------------------------------------------------------------
# /api/share/* — Shareable report links
# ---------------------------------------------------------------------------

import uuid as _uuid
from datetime import datetime, timezone as _tz

# In-memory store for shared reports (keyed by UUID)
_shared_reports: dict[str, dict] = {}


class ShareReportRequest(BaseModel):
    """Request body for creating a shareable report."""
    report_type: str = Field(..., description="Type of report: 'dashboard' | 'brainprint' | 'analytics'")
    title: str = Field(..., max_length=200, description="Human-readable report title")
    metrics: dict = Field(default_factory=dict, description="EEG metrics snapshot")
    brainprint_result: Optional[dict] = Field(None, description="Brainprint verification result")
    chat_summary: Optional[str] = Field(None, description="AI consultant summary")
    notes: Optional[str] = Field(None, max_length=1000, description="Optional notes")


class ShareReportResponse(BaseModel):
    """Response with shareable link info."""
    report_id: str
    url: str
    expires_at: Optional[str] = None
    message: str


class SharedReportData(BaseModel):
    """Full data for a shared report."""
    report_id: str
    report_type: str
    title: str
    metrics: dict
    brainprint_result: Optional[dict] = None
    chat_summary: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    created_by: Optional[str] = None


@app.post("/api/share/report", response_model=ShareReportResponse)
def create_shareable_report(payload: ShareReportRequest) -> ShareReportResponse:
    """
    Create a shareable report link.
    Returns a report_id that can be used to construct a share URL.

    Reports are stored in-memory and persist until the server restarts.
    """
    report_id = str(_uuid.uuid4())[:8]
    created_at = datetime.now(_tz.utc).isoformat()

    report_data = {
        "report_id": report_id,
        "report_type": payload.report_type,
        "title": payload.title,
        "metrics": payload.metrics,
        "brainprint_result": payload.brainprint_result,
        "chat_summary": payload.chat_summary,
        "notes": payload.notes,
        "created_at": created_at,
        "created_by": None,  # Will be set if auth is available
    }

    _shared_reports[report_id] = report_data

    # Construct the share URL
    # The frontend will replace this base with the actual API URL
    api_base = os.getenv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8765")
    share_url = f"{api_base}/api/share/report/{report_id}"

    return ShareReportResponse(
        report_id=report_id,
        url=share_url,
        message=f"Report '{payload.title}' created. Share URL: {share_url}",
    )


@app.get("/api/share/report/{report_id}", response_model=SharedReportData)
def get_shared_report(report_id: str) -> SharedReportData:
    """
    Retrieve a shared report by ID.
    Public endpoint — no authentication required.
    """
    report = _shared_reports.get(report_id)
    if report is None:
        raise HTTPException(
            status_code=404,
            detail=f"Report '{report_id}' not found. It may have been deleted or expired.",
        )
    return SharedReportData(**report)


@app.delete("/api/share/report/{report_id}")
def delete_shared_report(report_id: str) -> dict:
    """Delete a shared report. Returns 200 if deleted, 404 if not found."""
    if report_id in _shared_reports:
        del _shared_reports[report_id]
        return {"status": "deleted", "report_id": report_id}
    raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found")


@app.get("/api/share/reports")
def list_shared_reports() -> list[SharedReportData]:
    """List all shared reports (admin endpoint — no auth for now)."""
    return [SharedReportData(**r) for r in _shared_reports.values()]


# ---------------------------------------------------------------------------
# /api/reference/*  — Reference comparison data (no auth required)
# ---------------------------------------------------------------------------


@app.get("/api/reference/compare", response_model=ReferenceCompareResponse)
def reference_compare(
    sleep_stage: Optional[str] = None,
    subject_id: Optional[str] = None,
    delta: Optional[float] = None,
    theta: Optional[float] = None,
    alpha: Optional[float] = None,
    beta: Optional[float] = None,
    gamma: Optional[float] = None,
) -> ReferenceCompareResponse:
    """
    Return reference band power data from the Sleep-EDF dataset.

    Use cases:
      - No params: returns aggregate (mean/std) band power for all 5
        sleep stages so the frontend can show "your alpha vs typical
        alpha in each stage."
      - sleep_stage=N3: returns only N3 aggregates + sample epochs.
      - subject_id=SC4001: returns only data from that subject.
      - Band power params (delta, theta, ...): accepted for future
        filtering but currently only used to document the comparison
        context — aggregates are always returned.

    The source_url is hardcoded to the real PhysioNet Sleep-EDF page
    since the database stores source_url as NULL for provenance
    tracking (the import script doesn't populate it).
    """
    from db.reference_data import get_aggregates, get_total_count, table_exists

    if not table_exists():
        raise HTTPException(
            status_code=503,
            detail="Reference data table not yet populated. Run Phase 4 migration first.",
        )

    # Validate sleep_stage if provided
    VALID_STAGES = {"W", "N1", "N2", "N3", "REM"}
    if sleep_stage and sleep_stage not in VALID_STAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sleep_stage '{sleep_stage}'. Must be one of: {sorted(VALID_STAGES)}",
        )

    aggregates, samples = get_aggregates(
        sleep_stage_filter=sleep_stage,
        subject_id_filter=subject_id,
    )
    total = get_total_count(
        sleep_stage_filter=sleep_stage,
        subject_id_filter=subject_id,
    )

    # Build a human-readable filter description
    filter_parts = []
    if sleep_stage:
        filter_parts.append(f"stage={sleep_stage}")
    if subject_id:
        filter_parts.append(f"subject={subject_id}")
    filter_applied = ", ".join(filter_parts) if filter_parts else "none"

    # Format samples for the response
    formatted_samples = [
        ReferenceBandPower(
            epoch_index=s["epoch_index"],
            epoch_start_sec=s["epoch_start_sec"],
            epoch_end_sec=s["epoch_end_sec"],
            sleep_stage=s["sleep_stage"],
            delta_power=s.get("delta_power"),
            theta_power=s.get("theta_power"),
            alpha_power=s.get("alpha_power"),
            beta_power=s.get("beta_power"),
            gamma_power=s.get("gamma_power"),
            subject_id=s["subject_id"],
            channel_name=s["channel_name"],
        )
        for s in samples
    ]

    # Format aggregates
    formatted_aggregates = [
        ReferenceAggregate(
            sleep_stage=a["sleep_stage"],
            count=a["count"],
            subject_id=a.get("subject_id"),
            delta_power_mean=a.get("delta_power_mean"),
            delta_power_std=a.get("delta_power_std"),
            theta_power_mean=a.get("theta_power_mean"),
            theta_power_std=a.get("theta_power_std"),
            alpha_power_mean=a.get("alpha_power_mean"),
            alpha_power_std=a.get("alpha_power_std"),
            beta_power_mean=a.get("beta_power_mean"),
            beta_power_std=a.get("beta_power_std"),
            gamma_power_mean=a.get("gamma_power_mean"),
            gamma_power_std=a.get("gamma_power_std"),
        )
        for a in aggregates
    ]

    return ReferenceCompareResponse(
        source_url="https://physionet.org/content/sleep-edfx/1.0.0/",
        filter_applied=sleep_stage,
        aggregates=formatted_aggregates,
        samples=formatted_samples,
        total_records=total,
    )


@app.get("/api/reference/subjects", response_model=ReferenceSubjectsResponse)
def reference_subjects() -> ReferenceSubjectsResponse:
    """
    Return the distinct subject_id values present in eeg_reference_data,
    each with its epoch row count.

    The frontend uses this to populate the Subject selector dynamically
    instead of hardcoding subject IDs — so newly imported subjects appear
    automatically.
    """
    from db.reference_data import get_subjects, get_total_count, table_exists

    if not table_exists():
        raise HTTPException(
            status_code=503,
            detail="Reference data table not yet populated. Run Phase 4 migration first.",
        )

    subjects = get_subjects()
    total = get_total_count()

    return ReferenceSubjectsResponse(
        subjects=[
            ReferenceSubjectInfo(
                subject_id=s["subject_id"],
                epoch_count=s["epoch_count"],
            )
            for s in subjects
        ],
        total_records=total,
    )


@app.get("/api/reference/subject-meta", response_model=ReferenceSubjectMeta)
def reference_subject_meta(subject_id: str) -> ReferenceSubjectMeta:
    """
    Return per-subject demographic metadata for the reference info box.

    Reads genuine metadata (age, sex, recording nights + lights-off times)
    from MNE's bundled ``age_records.csv`` (Sleep Cassette study), keyed by
    the subject index encoded in the DB subject_id. Returns 404 if the
    subject does not exist or no metadata is available — only genuinely
    available fields are returned, nothing fabricated.
    """
    from services.reference_metadata import get_subject_metadata

    meta = get_subject_metadata(subject_id)
    if meta is None:
        raise HTTPException(
            status_code=404,
            detail=f"No metadata available for subject '{subject_id}'",
        )

    return ReferenceSubjectMeta(**meta)
