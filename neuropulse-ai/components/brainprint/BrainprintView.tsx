"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useBrainprintScan } from "@/hooks/useBrainprintScan";
import { useBrainprintContext } from "@/hooks/useBrainprintContext";
import { useAppStatus } from "@/components/layout/DashboardShell";
import { KnownBrainprintProfile, BrainprintRecognitionResult } from "@/lib/types";
import { apiFetch, FetchErrorType, FetchError } from "@/lib/fetchWithHealth";
import { BrainprintScanner } from "./BrainprintScanner";
import { ProfileVerifiedPanel } from "./ProfileVerifiedPanel";
import { UnknownWaveModal } from "./UnknownWaveModal";
import { BandPowerComparison, ReferenceSelector } from "./BandPowerComparison";
import { ShareReportButton } from "@/components/share/ShareReportButton";
import { useLanguage } from "@/hooks/useLanguageContext";

interface ProfileSummary {
  profile_id: number;
  nickname: string;
  notes: string | null;
  created_at: string;
  sessions_count: number;
}

/**
 * Fetch enrolled brainprint profiles with proper error handling.
 * Network failures are surfaced as readable messages instead of unhandled rejections.
 */
async function fetchProfiles(token: string): Promise<ProfileSummary[]> {
  const result = await apiFetch<ProfileSummary[]>("/api/brainprint/profiles", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!result.ok) {
    const err = result.error;
    if (err.type === FetchErrorType.NETWORK) {
      console.warn("Brainprint profiles: backend unreachable", err.message);
    } else if (err.type === FetchErrorType.HTTP) {
      console.warn("Brainprint profiles: HTTP error", err.status, err.detail);
    } else {
      console.warn("Brainprint profiles: fetch failed", err.message);
    }
    return [];
  }
  return result.data;
}

/**
 * Verify a brainprint scan against enrolled profiles.
 * Returns parsed JSON on success, throws FetchError on failure.
 */
async function verifyBrainprint(token: string, eegFeatures: number[]): Promise<any> {
  const result = await apiFetch("/api/brainprint/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ eeg_features: eegFeatures }),
  });

  if (!result.ok) {
    const err = result.error;
    if (err.type === FetchErrorType.NETWORK) {
      throw new Error(`Backend unreachable: ${err.message}`);
    }
    throw new Error(err.detail || "Verification failed");
  }
  return result.data;
}

/**
 * Register a new brainprint profile.
 * Returns parsed JSON on success, throws FetchError on failure.
 */
async function registerProfile(token: string, nickname: string, eegFeatures: number[], notes?: string): Promise<any> {
  const result = await apiFetch("/api/brainprint/register", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nickname, eeg_features: eegFeatures, notes }),
  });

  if (!result.ok) {
    const err = result.error;
    if (err.type === FetchErrorType.NETWORK) {
      throw new Error(`Backend unreachable: ${err.message}`);
    }
    throw new Error(err.detail || "Registration failed");
  }
  return result.data;
}

function mapProfile(p: ProfileSummary): KnownBrainprintProfile {
  return {
    id: String(p.profile_id),
    nickname: p.nickname,
    // The backend verify response carries the real match score and novelty
    // score, but no per-metric (Focus/Calm/...) breakdown for this profile.
    // We intentionally leave historicalMetrics EMPTY rather than fabricate
    // placeholder values. The radar chart that previously rendered fabricated
    // 50s has been removed (Task K).
    signatureVector: [],
    enrolledAt: p.created_at,
    sessionsCount: p.sessions_count,
    historicalMetrics: [],
  };
}

export function BrainprintView() {
  const {
    status,
    progress,
    capturedVector,
    startScan,
    subjectIndex,
    setSubjectIndex,
    subjects,
  } = useBrainprintScan();
  const { setBrainprintStatus } = useAppStatus();
  const { verifiedProfile, setVerifiedProfile, clearVerifiedProfile, refSelector } =
    useBrainprintContext();
  const { t } = useLanguage();

  const [knownProfiles, setKnownProfiles] = useState<KnownBrainprintProfile[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Transient unrecognized scan result. Unlike a VERIFIED result, this is NOT
  // persisted across navigation (see useBrainprintContext): an unknown wave is
  // either registered or walked away from, so leaving the page mid-flow resets
  // it rather than showing a stale modal on return.
  const [unknownResult, setUnknownResult] = useState<{
    capturedVector: number[];
    similarityScore: number;
  } | null>(null);
  const [showUnknownModal, setShowUnknownModal] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("auth_token");
    if (t) {
      try {
        const parsed = JSON.parse(t);
        setToken(parsed.access_token || t);
      } catch {
        setToken(t);
      }
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfiles(token)
        .then((profiles) => {
          setKnownProfiles(profiles.map(mapProfile));
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (status !== "captured" || !capturedVector || !token) return;

    verifyBrainprint(token, capturedVector)
      .then((result) => {
        const isVerified = result.status === "VERIFIED";
        // Real values straight from the backend verify response:
        // confidence_score (cosine, 0-100) and novelty_score (Mahalanobis
        // out-of-distribution distance). No fabricated metric breakdowns.
        const similarityScore = Number(result.confidence_score) || 0;
        const noveltyScore =
          result.novelty_score != null ? Number(result.novelty_score) : null;

        if (isVerified) {
          const profile: KnownBrainprintProfile = {
            id: String(result.profile_id),
            nickname: result.nickname || "Unknown",
            signatureVector: [],
            enrolledAt: "",
            sessionsCount: 0,
            historicalMetrics: [],
          };
          const resultRecognition: BrainprintRecognitionResult = {
            status: "recognized",
            profile,
            similarityScore,
            noveltyScore,
          };
          const verifiedAt = new Date().toISOString();
          // Persist the verified result in the session-level context so it
          // survives navigating away and back to /brainprint.
          setVerifiedProfile(
            resultRecognition as Extract<BrainprintRecognitionResult, { status: "recognized" }>,
            verifiedAt
          );
          setUnknownResult(null);
          setShowUnknownModal(false);
          setBrainprintStatus("verified");
        } else {
          // Defensively clear any prior verified result; show the transient
          // unknown-wave result + enrollment modal in-session only.
          clearVerifiedProfile();
          setUnknownResult({ capturedVector, similarityScore });
          setShowUnknownModal(true);
          setBrainprintStatus("denied");
        }
      })
      .catch((err) => {
        console.error("Verification error:", err);
        setBrainprintStatus("idle");
      });
  }, [status, capturedVector, token, setBrainprintStatus, setVerifiedProfile, clearVerifiedProfile]);

  const handleSaveNewProfile = async (nickname: string) => {
    if (!unknownResult || !token) return;

    try {
      await registerProfile(token, nickname, unknownResult.capturedVector);
      const profiles = await fetchProfiles(token);
      setKnownProfiles(profiles.map(mapProfile));
      setShowUnknownModal(false);
      setUnknownResult(null);
    } catch (err) {
      console.error("Registration error:", err);
    }
  };

  // Clear the previous result and immediately start a fresh verification scan.
  // No page refresh needed — startScan() resets the scanner's status/progress
  // and re-captures a vector, and clearing the persisted verified profile (plus
  // any transient unknown result) returns the panel to its pre-scan state so the
  // old result isn't shown during the new scan.
  const handleScanAgain = useCallback(() => {
    clearVerifiedProfile();
    setUnknownResult(null);
    setShowUnknownModal(false);
    startScan();
  }, [clearVerifiedProfile, startScan]);

  // Build share data for brainprint report
  const shareMetrics = useMemo(() => {
    const result = verifiedProfile?.result;
    return {
      status: status,
      recognitionResult: result
        ? {
            type: result.status,
            profile: result.status === "recognized" ? result.profile.nickname : null,
            similarityScore: result.similarityScore,
          }
        : null,
      enrolledProfiles: knownProfiles.map(p => ({
        nickname: p.nickname,
        sessions: p.sessionsCount,
        enrolledAt: p.enrolledAt,
      })),
      capturedAt: new Date().toISOString(),
    };
  }, [status, verifiedProfile, knownProfiles]);

  if (loading) {
    return (
      <div className="panel flex flex-col items-center justify-center gap-2 p-10 text-center text-ink-faint">
        <p className="text-sm">{t("bp.loadingProfiles")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with share button */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold text-ink">{t("bp.title")}</h1>
        <ShareReportButton
          reportType="brainprint"
          title={t("bp.shareTitle", { date: new Date().toLocaleDateString() })}
          metrics={shareMetrics}
          className="!m-0"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BrainprintScanner
          status={status}
          progress={progress}
          onStart={handleScanAgain}
          subjectIndex={subjectIndex}
          setSubjectIndex={setSubjectIndex}
          subjects={subjects}
        />

        {verifiedProfile ? (
          <ProfileVerifiedPanel
            profile={verifiedProfile.result.profile}
            similarityScore={verifiedProfile.result.similarityScore}
            noveltyScore={verifiedProfile.result.noveltyScore}
            verifiedAt={verifiedProfile.verifiedAt}
            onScanAgain={handleScanAgain}
          />
        ) : (
          <div className="panel flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-ink-faint">
              <p className="text-sm">{t("bp.noVerified")}</p>
              <p className="text-xs">{t("bp.noVerifiedHint")}</p>
            </div>
            <ReferenceSelector
              sleepStage={refSelector.sleepStage}
              setSleepStage={refSelector.setSleepStage}
              subjectId={refSelector.subjectId}
              setSubjectId={refSelector.setSubjectId}
              subjects={refSelector.subjects}
              loading={refSelector.loading}
              fetchReference={refSelector.fetchReference}
            />
          </div>
        )}

        <div className="lg:col-span-2">
          <p className="mb-2 text-xs text-ink-faint">{t("bp.enrolledProfiles", { count: knownProfiles.length })}</p>
          <div className="flex flex-wrap gap-2">
            {knownProfiles.map((p) => (
              <span key={p.id} className="glass-pill rounded-full px-3 py-1 text-xs text-ink-muted">
                {p.nickname}
              </span>
            ))}
          </div>
        </div>

        {/* EEG Band Power vs. Reference Dataset */}
        <div className="lg:col-span-2">
          <BandPowerComparison
            aggregates={refSelector.aggregates}
            loading={refSelector.loading}
            error={refSelector.error}
            filterApplied={refSelector.filterApplied}
            selectedSubject={refSelector.selectedSubject}
            subjectMeta={refSelector.subjectMeta}
          />
        </div>

        {showUnknownModal && unknownResult && (
          <UnknownWaveModal
            capturedVector={unknownResult.capturedVector}
            similarityScore={unknownResult.similarityScore}
            onSave={handleSaveNewProfile}
            onDismiss={() => setShowUnknownModal(false)}
          />
        )}
      </div>
    </div>
  );
}