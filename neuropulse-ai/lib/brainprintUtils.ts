import { KnownBrainprintProfile, BrainprintRecognitionResult } from "./types";

// ---------------------------------------------------------------------------
// NeuroPulse AI — Brainprint biometric utilities
//
// A real implementation would compare live-captured spectral/coherence
// features against an enrolled template using a vetted biometric matching
// algorithm (and almost certainly run that comparison server-side, never
// trusting a client-computed score for access control). Everything below is
// a stand-in so the enrollment/verification UI has real numbers to render.
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two equal-length feature vectors, expressed as a
 * 0–100 match score. 100 = identical direction, 0 = orthogonal.
 */
export function calculateSimilarityScore(
  liveVector: number[],
  enrolledVector: number[]
): number {
  if (liveVector.length !== enrolledVector.length) {
    throw new Error("Signature vectors must be the same length to compare.");
  }

  let dotProduct = 0;
  let liveMagnitude = 0;
  let enrolledMagnitude = 0;

  for (let i = 0; i < liveVector.length; i++) {
    dotProduct += liveVector[i] * enrolledVector[i];
    liveMagnitude += liveVector[i] ** 2;
    enrolledMagnitude += enrolledVector[i] ** 2;
  }

  const magnitudeProduct = Math.sqrt(liveMagnitude) * Math.sqrt(enrolledMagnitude);
  if (magnitudeProduct === 0) return 0;

  const cosineSimilarity = dotProduct / magnitudeProduct;
  const score = clamp(cosineSimilarity * 100, 0, 100);

  return Math.round(score * 100) / 100;
}

/**
 * Simulates a fresh EEG capture during a verification scan by perturbing the
 * enrolled template with small per-feature noise — approximating natural
 * session-to-session variation from a genuine match.
 *
 * `noiseMagnitude` defaults to a "same person, different session" level of
 * variation. Pass a larger value to simulate an impostor / poor-fit capture.
 */
export function simulateLiveCapture(
  enrolledVector: number[],
  noiseMagnitude: number = 0.05
): number[] {
  return enrolledVector.map((value) => {
    const noise = (Math.random() - 0.5) * 2 * noiseMagnitude;
    return Math.max(0, value + noise);
  });
}

// ---------------------------------------------------------------------------
// Simulated subject captures — make the Brainprint simulation discriminative
//
// The backend verifies an embedding by cosine similarity against enrolled
// profiles. For the simulation to behave realistically, a capture must look
// like a real person's signature: reproducible for the same subject (re-scan
// → similar vector → verifies as that subject) but distinct across subjects
// (different person → near-orthogonal vector → rejected as "Unknown"). We
// model each simulated subject as a stable, deterministic 64-D base template,
// and a scan of that subject is its template plus small session noise — the
// same "same person, different session" semantics as `simulateLiveCapture`.
//
// LEGACY BUG this replaces (task H): the scanner used to build the capture as
// 64 i.i.d. Uniform(0.05, 0.15) draws. Those all sit in a tiny positive band,
// so every capture pointed in nearly the same all-positive direction and
// scored ~0.9 cosine against ANY enrolled profile — meaning a scan always
// verified as the single enrolled name regardless of which subject actually
// was being scanned.
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32) so a subject's template is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimulatedSubject {
  id: number;
  label: string;
}

/** Human-readable roster of simulated "people who might wear the headset." */
export const SIMULATED_SUBJECTS: SimulatedSubject[] = [
  { id: 0, label: "Subject A" },
  { id: 1, label: "Subject B" },
  { id: 2, label: "Subject C" },
  { id: 3, label: "Subject D" },
];

/** Deterministic mean-zero 64-D base signature direction for a subject index. */
export function buildSubjectTemplate(subjectIndex: number): number[] {
  const rand = mulberry32(9000 + subjectIndex * 1319);
  return Array.from({ length: 64 }, () => rand() * 2 - 1);
}

/** Session-to-session variation for "same person" captures (cosine stays ~0.99). */
const SESSION_NOISE_MAGNITUDE = 0.05;

/**
 * A realistic simulated capture for *subjectIndex*: that subject's reproducible
 * template perturbed by small session noise. Same subject re-scan → high cosine
 * match (VERIFIED); a different subject → near-orthogonal → rejected as Unknown.
 */
export function simulateSubjectCapture(subjectIndex: number): number[] {
  const template = buildSubjectTemplate(subjectIndex);
  return template.map(
    (value) => value + (Math.random() - 0.5) * 2 * SESSION_NOISE_MAGNITUDE
  );
}

/**
 * Produces a display-friendly mock hash representing the enrolled neural
 * signature template (e.g. a hash of the extracted feature set, not the raw
 * EEG itself). Cosmetic only — not a real cryptographic digest.
 */
export function generateSignatureHash(): string {
  const segment = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .toUpperCase()
      .padStart(4, "0");

  return `0x${segment()}\u2011${segment()}\u2011${segment()}\u2011${segment()}\u2011${segment()}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Dynamic multi-profile recognition ("Unknown Wave" detection)
// ---------------------------------------------------------------------------

/**
 * Compares a freshly captured signature against every known profile and
 * returns the best match, or an "unknown" result if nothing clears the
 * threshold. A real backend would run this server-side against a proper
 * biometric database rather than an in-memory array.
 */
export function recognizeBrainprint(
  capturedVector: number[],
  knownProfiles: KnownBrainprintProfile[],
  threshold: number = 90
): BrainprintRecognitionResult {
  let best: { profile: KnownBrainprintProfile; score: number } | null = null;

  for (const profile of knownProfiles) {
    const score = calculateSimilarityScore(capturedVector, profile.signatureVector);
    if (!best || score > best.score) {
      best = { profile, score };
    }
  }

  if (best && best.score >= threshold) {
    return {
      status: "recognized",
      profile: best.profile,
      similarityScore: best.score,
      // This client-side helper has no backend novelty score — leave it null.
      noveltyScore: null,
    };
  }

  return { status: "unknown", capturedVector, similarityScore: best?.score ?? 0 };
}

/**
 * Builds a new profile record from an unknown capture + user-provided
 * nickname. In production this is where you'd POST to your backend to
 * persist the profile — see the "Save & Train" button in UnknownWaveModal.
 */
export function registerNewProfile(
  nickname: string,
  capturedVector: number[]
): KnownBrainprintProfile {
  return {
    id: `profile-${Date.now()}`,
    nickname,
    signatureVector: capturedVector,
    enrolledAt: new Date().toISOString(),
    sessionsCount: 1,
    historicalMetrics: [
      { label: "Focus", value: 50 },
      { label: "Calm", value: 50 },
      { label: "Stress Ctrl", value: 50 },
      { label: "Sleep Quality", value: 50 },
      { label: "Recovery", value: 50 },
    ],
  };
}
