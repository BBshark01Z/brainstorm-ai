# TASK Q — Q1: Design system foundation + pre-login splash page

## Decisions locked in
- **Copy (Option B):** Headline "Where Neural Signals Meet Identity" / subhead "An experimental
  platform for EEG monitoring, brain-print verification, and AI-driven analysis — built on simulated
  reference data for research, not clinical use."
- **Approach:** Refine the existing `/` landing page + `NeuralWaveBackground` canvas (do not rebuild from scratch).

## Verified real numbers (stats footer — do not fabricate)
- 5 frequency bands (delta/theta/alpha/beta/gamma) — from `EEGSample` / WebSocket payload
- 20 reference subjects — `SELECT count(DISTINCT subject_id) FROM eeg_reference_data`
- 54,587 reference samples in DB — `SELECT count(*) FROM eeg_reference_data`
- 300 ms stream refresh — `DEMO_TICK_INTERVAL_S = 0.3` in `main.py`

## Design-system foundation (Q1 part 1)
Extend the existing dark Midnight palette already in `tailwind.config.ts` + `globals.css`
(vital cyan #06B6D4, neural violet #8B5CF6, midnight #0A0F1D, teal #14B8A6). Add as CSS variables
in `globals.css` a small set of **tokens** reused across all Q2–Q6 pages + the splash:
- `--dur-fast` (150ms), `--dur-base` (300ms), `--dur-smooth` (500ms)
- Easing `--ease-out-expo` = `cubic-bezier(0.16, 1, 0.3, 1)` (reference 1's entrance feel)
- Focus-ring + interactive state tokens keyed to `neural` (purple) + `vital` (cyan)
- A reusable `.glass-pill` (glass pill surface) and `.hairline` (1px border) utility, mindful of existing `.glass` / `.panel`
These live in `globals.css` so all pages share one source of truth.

## Architectural fix (prerequisite for a pre-login splash)
`components/layout/DashboardShell.tsx` wraps every route (via root layout) and redirects
unauthenticated users away from everything except `/login`, `/register`, and always renders
Sidebar + Header + MobileTabBar.
- Add `"/"` to `PUBLIC_PAGES` so `/` no longer bounces to `/login`.
- When `pathname === "/"`, render children in a **bare full-screen container** (no Sidebar /
  Header / MobileTabBar / in-shell grid) so the splash is truly full-bleed. Login/register keep
  their current shell behavior — nothing else changes. (Style-only structural change; no auth logic touched.)

## Splash page work (Q1 part 2) — refine existing `app/page.tsx` + add new pieces
Keep: `NeuralWaveBackground` canvas, brand header, gradient title usage, bento cards, footer.
Add / change:
1. **Typewriter subhead hook** — new `hooks/useTypewriter.ts` (types out the chosen subhead,
   respects `prefers-reduced-motion`). New `components/splash/TypewriterSubhead.tsx`.
2. **Interactive feature-preview pills** (Live Monitor, Brainprint, Analytics, AI Consultant) —
   hover/select reveals a one-line description of each. Reuse pill visual from existing page
   style. New `components/splash/FeaturePills.tsx`.
3. **Stats footer** — `components/splash/StatsFooter.tsx`, count-up entrance, hard-coded to the
   4 verified numbers above (they are stable app facts; note source under each).
4. **Primary CTA** → "Continue to Login" → `router.push("/login")`. Secondary → "Create account"
   → `/register`. Replace the current marketing copy ("Start Free Trial", "Decode Neural Signals
   with Precision AI") that overclaims.
5. Application of Q1 tokens (colors/typography/easing) across the existing page for consistency.
6. Honest **experimental/not-a-medical-device** note stays in footer.

Fonts/animations all local or standard Tailwind `motion` — no third-party hosted video/URLs, no
other brand's wordmark or CDN fonts.

## What I will NOT change
- No routes or features removed. Login/register/dashboard/brainprint/analytics/AI remain.
- No auth logic, validation, or API calls touched.
- No fabricating stats.

## Test after Q1
- Browser: `/` renders full-bleed for a logged-out visitor (no bounce to /login).
- Typewriter completes; feature pills reveal descriptions; stats count up; "Continue to Login"
  navigates to `/login`; "Create account" navigates to `/register`.
- Reduced-motion: no typewriter/count-up loops.
- Then STOP and report for Q2 sign-off (task requires per-page approval; do not chain silently).