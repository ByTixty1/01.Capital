# ADR-0009: Dependencies for the Qareen hackathon prototype

**Status:** Accepted

**Date:** 2026-07-16

**Authors:** Mohammed Alharbi (CDO), implemented with Claude Code

---

## Context

For the Amad Hackathon (Alinma Bank x Tuwaiq Academy, "Financial Regulations"
track) we are building Qareen — a voice + animated-hands AI guide that overlays
a small, isolated demo of the dashboard under `/qareen/*`. It is not part of the
Sprint 5 plan and does not touch any real cap-table data, the production DB, or
existing routes. Per CLAUDE.md hard rule #6, AI in this codebase must stay
narrow, optional, and replaceable; Qareen is scoped accordingly — it reads a
static demo seed, never calls the real `/api/backend/*` proxy, and any
"mutating" action it prepares only ever writes to an in-memory/session copy of
that seed.

Building it requires three dependencies not currently in the codebase.

---

## Decision

Add, scoped to the `hackathon/qareen` branch and the `qareen` module tree only:

- **Frontend**: `zustand` — thin global store for conversation history, mic
  state, pending-approval state, and the `guideMode` toggle, persisted to
  `sessionStorage` so the overlay survives page refresh. The codebase has no
  existing state library; local `useState`/hooks are insufficient because this
  state must be shared across the persistent `/qareen` layout and multiple
  sibling pages.
- **Backend**: `anthropic` — official Python SDK for the Claude Haiku
  conversational brain and the Claude Sonnet vision call (CR-photo extraction).
- **Backend**: `edge-tts` — free, keyless Microsoft Edge TTS client for
  per-line speech synthesis with word-boundary timing data, used to drive
  gesture timing.

---

## Consequences

### Positive
- Each dependency is small, widely used, and does exactly one job — no bespoke
  reimplementation of state management, LLM streaming, or TTS.
- All three are additive: no existing file outside `app/qareen/`,
  `frontend/src/{app,lib,components,hooks}/qareen*` is modified beyond router
  registration and config field additions.

### Negative
- `edge-tts` depends on an undocumented Microsoft endpoint; if it changes
  behavior, the TTS endpoint breaks. Acceptable for a 72-hour demo, not a
  production dependency. Confirmed in testing: the brief's specified
  `en-US-DavisNeural` voice has since been retired from Microsoft's
  catalog entirely — using `en-US-GuyNeural` (fallback
  `en-US-ChristopherNeural`) instead, and edge-tts 7.x also changed its
  default `boundary` param from word- to sentence-level, which had to be
  set explicitly to get gesture-sync word timings back.
- `anthropic` API calls have real latency/cost; the brain and vision endpoints
  require `ANTHROPIC_API_KEY` to be set for live testing.

### Neutral but worth noting
- Zustand is the first global state library in this frontend. If a future
  production feature needs shared client state, this ADR is precedent, but the
  decision should be revisited for the production codebase rather than assumed.

---

## Alternatives considered

- **React Context instead of Zustand**: would work but re-render behavior is
  worse for a 60fps animation loop reading frequently-changing state; Zustand's
  selector subscriptions avoid that. Also explicitly the brief's own choice.
- **`sse-starlette` for the brain stream**: unnecessary — Starlette's built-in
  `StreamingResponse` with `media_type="text/event-stream"` is sufficient for a
  one-directional server-to-client stream and avoids one more dependency.
- **Real hand PNG assets** instead of inline SVG glyphs: no art budget in a
  72-hour window; SVG glyphs are swappable for real PNGs later without
  touching the motion engine (see `QAREEN_MOTION_SPEC.md`'s pose contract).

---

## References

- `QAREEN_BRIEF.md`, `QAREEN_MOTION_SPEC.md`, `QAREEN_SYSTEM_PROMPT.md`
  (session-provided hackathon spec, not yet committed as repo files)
- Implementation plan: session plan file
  `gentle-giggling-platypus.md` (architecture decisions #1-11)
- CLAUDE.md hard rule #6 (AI is not the core), hard rule #7 (ADR every
  non-trivial decision)
