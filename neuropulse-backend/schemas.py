"""
NeuroPulse AI — API schemas.

Every request/response shape the FastAPI app exposes lives here, so
`main.py` and the `services/` modules share one source of truth for the
data contracts — mirrors how the Next.js frontend centralizes its types in
`lib/types.ts`.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    nickname: str = Field(..., min_length=1, max_length=120, description="Display nickname")


class LoginRequest(BaseModel):
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    nickname: str


class UserResponse(BaseModel):
    user_id: int
    email: str
    nickname: str
    created_at: str


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

BandName = Literal["delta", "theta", "alpha", "beta", "gamma"]


class RawChannelSignal(BaseModel):
    """One EEG channel's raw time-series samples."""

    channel_name: str = Field(..., description='e.g. "Fp1", "F3", "F4", "Cz"')
    samples: List[float] = Field(..., description="Raw amplitude samples (µV) in time order")


class AnalyzeRequest(BaseModel):
    """Input to /api/analyze — one or more raw channels plus the sampling rate."""

    channels: List[RawChannelSignal]
    sampling_rate_hz: float = Field(..., gt=0, description="e.g. 256.0")
    notch_freq_hz: float = Field(50.0, description="Mains hum frequency — 50 for most of the world, 60 for the US")


class HjorthParameters(BaseModel):
    activity: float
    mobility: float
    complexity: float


class ChannelFeatureSet(BaseModel):
    """Full extracted feature set for a single channel."""

    channel_name: str
    band_power: Dict[BandName, float]
    differential_entropy: Dict[BandName, float]
    hjorth: HjorthParameters
    theta_beta_ratio: Optional[float] = None


class AnalyzeResponse(BaseModel):
    channels: List[ChannelFeatureSet]
    faa_index: Optional[float] = Field(
        None, description="ln(F4 alpha power) − ln(F3 alpha power); requires both F3 and F4 in the request"
    )
    embedding: List[float] = Field(
        ..., description="Flattened feature vector — the same shape used for Brainprint enrollment/verification"
    )


# ---------------------------------------------------------------------------
# Brainprint — verify / register
# ---------------------------------------------------------------------------

class BrainprintVerifyRequest(BaseModel):
    eeg_features: List[float] = Field(..., description="Embedding vector, e.g. from AnalyzeResponse.embedding")


class BrainprintVerifyResponse(BaseModel):
    status: Literal["VERIFIED", "UNKNOWN_SIGNATURE_DETECTED"]
    nickname: Optional[str] = None
    profile_id: Optional[int] = None
    confidence_score: float = Field(..., description="0-100, cosine similarity to the best-matching profile")
    novelty_score: Optional[float] = Field(
        None, description="Mahalanobis distance to the enrolled population — higher means more 'out of distribution'"
    )


class BrainprintRegisterRequest(BaseModel):
    nickname: str = Field(..., min_length=1, max_length=120)
    eeg_features: List[float]
    notes: Optional[str] = Field(None, max_length=500)


class BrainprintRegisterResponse(BaseModel):
    profile_id: int
    nickname: str
    created_at: str
    message: str


class BrainprintProfileSummary(BaseModel):
    profile_id: int
    nickname: str
    notes: Optional[str]
    created_at: str
    sessions_count: int


# ---------------------------------------------------------------------------
# DeepSeek AI consultant
# ---------------------------------------------------------------------------

class DeepSeekChatRequest(BaseModel):
    user_prompt: str = Field(..., min_length=1)
    eeg_context: Dict = Field(default_factory=dict, description="Latest metrics/features to ground the reply")


class DeepSeekChatResponse(BaseModel):
    reply: str
    flagged_markers: List[str] = Field(default_factory=list)
    latency_ms: float


# ---------------------------------------------------------------------------
# Analytics tip — /api/analytics/tip
# ---------------------------------------------------------------------------
# A short AI-generated summary of the longitudinal Analytics page. Reuses the
# DeepSeek consultant for the live path and degrades to a deterministic local tip
# when DeepSeek is unreachable — `used_fallback` lets the UI mark it as an
# "offline estimate" instead of a live AI answer.


class AnalyticsTipRequest(BaseModel):
    """Compact current-vs-30-day metrics snapshot the frontend computes from
    the longitudinal data. Each key is a human-readable top-level metric name
    (e.g. ``burnout_risk``) whose value is a dict of numbers. The same payload
    grounds the DeepSeek call and drives the deterministic fallback."""

    metrics: Dict = Field(
        default_factory=dict,
        description="Analytics metrics: current value, 30-day average, delta, improved flag per metric",
    )


class AnalyticsTipResponse(BaseModel):
    tip: str = Field(..., description="2-4 sentence short summary/tip about the analytics data")
    used_fallback: bool = Field(
        default=False,
        description="True when this tip is a local rule-based estimate, not a live DeepSeek answer",
    )
    latency_ms: float = Field(default=0.0, description="Time taken to produce the tip, in ms")


# ---------------------------------------------------------------------------
# Reference data — /api/reference/compare
# ---------------------------------------------------------------------------


class ReferenceBandPower(BaseModel):
    """Band power values for a single epoch record."""
    epoch_index: int
    epoch_start_sec: float
    sleep_stage: str
    delta_power: Optional[float] = None
    theta_power: Optional[float] = None
    alpha_power: Optional[float] = None
    beta_power: Optional[float] = None
    gamma_power: Optional[float] = None
    subject_id: str
    channel_name: str
    epoch_end_sec: float


class ReferenceAggregate(BaseModel):
    """Aggregate (mean / std) band power for a sleep stage."""
    sleep_stage: str
    count: int
    subject_id: Optional[str] = None
    delta_power_mean: Optional[float] = None
    delta_power_std: Optional[float] = None
    theta_power_mean: Optional[float] = None
    theta_power_std: Optional[float] = None
    alpha_power_mean: Optional[float] = None
    alpha_power_std: Optional[float] = None
    beta_power_mean: Optional[float] = None
    beta_power_std: Optional[float] = None
    gamma_power_mean: Optional[float] = None
    gamma_power_std: Optional[float] = None


class ReferenceCompareRequest(BaseModel):
    """Optional band power values the user wants to compare against reference."""
    delta: Optional[float] = None
    theta: Optional[float] = None
    alpha: Optional[float] = None
    beta: Optional[float] = None
    gamma: Optional[float] = None
    sleep_stage: Optional[str] = None


class ReferenceCompareResponse(BaseModel):
    """Response with reference aggregates and optional per-epoch samples."""
    dataset_name: str = "Sleep-EDF Database Expanded"
    source_url: str = "https://physionet.org/content/sleep-edfx/1.0.0/"
    filter_applied: Optional[str] = None  # sleep_stage filter if provided
    aggregates: List[ReferenceAggregate]
    samples: List[ReferenceBandPower] = Field(default_factory=list)
    total_records: int


class ReferenceSubjectInfo(BaseModel):
    """A single subject available in the reference dataset."""
    subject_id: str
    epoch_count: int


class ReferenceSubjectsResponse(BaseModel):
    """List of distinct subjects in eeg_reference_data, for the frontend selector."""
    subjects: List[ReferenceSubjectInfo]
    total_records: int


class ReferenceSubjectNight(BaseModel):
    """A single recorded night for a reference subject (from MNE Sleep Cassette metadata)."""
    night: int
    lights_off: str


class ReferenceSubjectMeta(BaseModel):
    """
    Per-subject demographic metadata for the reference dataset info box.

    sSourced from the MNE ``sleep_physionet.age`` ``age_records.csv`` (the
    Sleep Cassette study), keyed by the subject index encoded in the DB
    subject_id. Only genuinely-available fields are populated.
    """
    subject_id: str
    age: int
    sex: str
    nights: List[ReferenceSubjectNight]
    dataset_name: str = "Sleep-EDF Database Expanded"
    source_url: str = "https://physionet.org/content/sleep-edfx/1.0.0/"
    cohort_note: str = (
        "Recordings from healthy volunteers participating in the Sleep "
        "Cassette study (Mourtazaev et al., 1995). Participants were NOT "
        "selected for any sleep disorder or health condition."
    )
    # Per-subject source file identification: the exact raw PSG recording
    # (recording 1) of this subject, and the matching hypnogram file when known.
    # `source_url` above is the direct URL to source_file on PhysioNet.
    source_file: Optional[str] = None
    hypnogram_file: Optional[str] = None
