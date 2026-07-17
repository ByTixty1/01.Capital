# Qareen Voice and Visual Guide

**Status:** Implemented and browser-tested
**Last verified:** 2026-07-17
**Architecture decisions:** [ADR-0009](../decisions/0009-qareen-hackathon-dependencies.md), [ADR-0010](../decisions/0010-qareen-real-product-integration.md)

## Purpose

Qareen is an optional explanation layer for 01 Capital. A user can ask a
question by typing or speaking; Qareen answers aloud while one animated worker
hand points to the real product interface being described. It does not participate
in ownership calculations, legal rules, or the cap-table event log.

The intended experience is:

1. The user summons Qareen from the public or authenticated navigation.
2. Guided movement starts automatically. The user may switch it off for a
   text-and-voice-only conversation.
3. The user types a question or enables dictation. Speech appears in the chat
   composer, and the user reviews it before pressing Send.
4. The backend streams short spoken lines with hand instructions.
5. Text-to-speech returns audio and per-word timestamps.
6. Qareen speaks each line while the worker hand navigates, scrolls, and points
   at the relevant real element.

## Runtime flow

```text
Typed message / Web Speech transcript
                |
                v
POST /api/qareen/brain/stream  -- SSE lines --> chat transcript
                |                                  |
                |                                  v
                +--> POST /api/qareen/tts --> audio + word timings
                                                   |
                             on_word indexes ------+
                                                   v
                                 synchronized voice + hand motion
                                                   |
                          route lookup -> navigation -> scroll -> target
```

The root layout owns `QareenPresence`, so the overlay survives navigation.
`ghostRegistry.ts` maps model-visible target IDs to public routes or to the
active `/companies/<id>` tenant route. Authenticated navigation always derives
the company ID from the current pathname; it never guesses a tenant.

## Live page awareness

Every turn includes a compact, sanitized `page_context` captured from the DOM
at send time. It inventories rendered interactive controls, tagged product
surfaces, and headings with:

- the exact executable target ID and accessible label;
- semantic role and safe action or link destination;
- viewport position and normalized coordinates;
- actual computed text, background, and border color names;
- disabled and current/active state.

This live inventory is authoritative over the static prompt. It prevents
Qareen from describing a stale label, inventing a color, or overlooking a
control such as the global Sign in link. Untagged controls receive a stable
`page_*` target for the current document, so they can be pointed to without a
code release.

Privacy and prompt-injection boundaries are applied before transmission:

- input values and passwords are never collected;
- authenticated customer rows and holdings are excluded automatically;
- authenticated tagged containers use structural labels rather than record
  contents;
- page labels are delimited as untrusted data and can never override system
  instructions;
- automatically discovered same-origin links may navigate, but buttons,
  inputs, submits, and destructive actions remain visual-only unless their
  stable target is explicitly allowlisted.

Account credentials use a separate browser-local path. On `/login` or
`/register`, a message containing the required identity fields, email, and
password is intercepted before conversation history or
the Claude request is created. Qareen displays only a sanitized placeholder,
fills the controlled React inputs through native input events, and never stores
the values in Zustand/session storage. The submit button is not allowlisted;
the user must review the fields and press **Sign in** themselves. Incomplete
credential-shaped messages are also kept local. Typed entry is recommended,
because browser speech-recognition services may process microphone audio before
Qareen receives a transcript.

All other currently rendered text controls can accept a model-directed `type`
move. The executor supports React-controlled and native `input`/`textarea`
elements of type text, email, search, telephone, URL, and number. It dispatches
native input events for every character, so page state and validation update as
if the user typed. Passwords, file inputs, toggles, selects, disabled/read-only
fields, and every submit/save/create control remain blocked.

## Voice behavior

### Input

- Dictation uses the browser Web Speech API with `en-US` and writes interim and
  final recognition results into the visible chat composer.
- The application's `Permissions-Policy` must allow `microphone=(self)`; using
  `microphone=()` disables Qareen dictation even when the user grants Safari
  microphone permission.
- The composer supports multiple lines. Enter inserts a line break; the Send
  button or Ctrl/Cmd+Enter submits the complete message.
- Pauses and final recognition results never submit a message. If the browser
  ends recognition, Qareen reopens it after 300 ms while dictation remains on.
- The user reviews the live text while dictating. Stopping the microphone sends
  the complete draft once. Pauses and browser endpointing never send it.
- Pressing Send while dictation is active also stops the microphone and uses
  the same duplicate-guarded submission path.
- Holding Space activates temporary dictation unless focus is in an input,
  textarea, or editable element. Releasing Space keeps the text in the composer
  and does not send it.
- Starting dictation during a response stops current audio and stale queued
  motion immediately. The new turn begins only after the user manually stops
  the master microphone or presses Send.
- If speech recognition is unavailable, typed chat remains fully usable.

### Output

- The backend uses `edge-tts` with `en-US-GuyNeural`, a `-12%` speaking rate,
  and `-6Hz` pitch. `en-US-ChristopherNeural` is the fallback. The originally
  specified `en-US-DavisNeural` is no longer present in the live Edge TTS
  catalogue and returns no audio.
- Ellipses create deliberate 450 ms pauses.
- Audible speech uses one reusable, unmuted, full-volume `<audio>` element so
  it follows the browser's normal media-output path. Web Audio decoding and
  playback remain as fallback and provide duration data for synchronization.
- Both media and Web Audio are unlocked synchronously from Send, microphone,
  and push-to-talk gestures before any network request. This prevents autoplay
  policies from blocking delayed TTS playback.
- The chat header exposes `Voice ready`, `Speaking`, or `Voice unavailable`.
  A failed TTS request is therefore visible instead of being swallowed.
- TTS failure is non-fatal: the transcript and visual guidance continue.

## Voice-to-hand synchronization

Every brain line may contain:

- `worker[].on_word`: the zero-based spoken-word index for worker movement.

The TTS service supplies word offsets for every audio segment. The frontend
converts segment-local offsets into one response-wide timeline, including
audio duration and ellipsis pauses. A gesture with `on_word: 2` therefore waits
until the third word begins. Instructions without `on_word` run immediately.

This is enforced by `voice-hand-sync.spec.ts`, which proves the target is not
pressed before its marked word and is pressed afterward.

## Hand assets and movement

The overlay uses a local Tabler-style hand glyph for the visible worker hand,
so pose swaps require no network or runtime icon package. The left speaker
hand is deliberately not rendered because its conversational movement was
distracting. The wire schema still accepts legacy `beats`, but the production
prompt emits an empty list for backward compatibility.

The worker hand can navigate to another registered route, wait for the new DOM,
scroll the target into view, glide to it, and show a cyan impact outline.

Guidance motion follows deterministic rules so identical instructions look and
land consistently:

- Target geometry must remain stable for two animation frames after scrolling.
- Worker travel time is derived from distance and clamped to a fixed range.
- Anticipation, descent, press rebound, typing cadence, home, and retreat use
  fixed timings instead of per-run random values.
- Random waypoint hops are disabled. Subtle idle drift remains, but all worker
  drift, bob, and rotation are gated to zero while a guided move is active or
  the fingertip is pinned to a target. The lock is released by home, retreat,
  resize, or the next target command.
- The engine compensates for the SVG wrist anchor so the visible index
  fingertip lands on the element center. The fingertip—not the transparent
  96 px wrapper—is clamped, allowing exact top/right-edge targets.
- Claude may emit at most one worker move per spoken line, must synchronize a
  targeted move to the relevant `on_word`, and may not duplicate a glide plus
  press on the same target.
- Public sample facts do not trust Claude's target choice. A deterministic cue
  table maps the spoken phrase to the exact KPI card, ownership row, or filing
  row. Missing moves are synthesized; vague/wrong targets are overridden.
- If one spoken line contains two known facts, fixed cues visit both exact rows
  in spoken order. Claude controls the explanation, not this choreography.
- Worker `press` is functional for an explicit code allowlist of safe controls.
  At the impact frame it focuses and calls the real link/button, so Next.js
  navigation, normal anchors, and React `onClick` handlers execute exactly as
  they do for a user click. Explanatory cards and headings remain visual-only.
- Functional controls currently include the landing-page English/Arabic
  language switch, public registration CTAs, and the authenticated Add/New
  controls for stakeholders, ESOP, instruments, and the pro-rata form. The
  language switch updates its accessible pressed state when Qareen activates
  it. Opening a page/form is non-mutating; its submit/save controls are
  deliberately not allowlisted.
- For cross-page guidance, the worker first looks for an existing same-origin
  link whose destination matches the registered ghost route and physically
  presses it. The Next.js router is only a fallback when the current layout has
  no matching navigation control.

Granular landing-page targets include the four KPI cards, all five ownership
rows, and all three filing rows. Broad `captable_kpis`,
`captable_ownership`, and `captable_filings` targets remain available only for
section-level explanations.

`motion-voice-reliability.spec.ts` measures a calibration point transformed
with the rendered fingertip against the real target center. It accepts at most
24 px (one quarter of the 96 px glyph). This HTML geometry check is used
because Safari/WebKit does not include ancestor CSS 3D transforms reliably in
SVG `getScreenCTM()` results. The previous wrapper-corner targeting missed by
more than 60 px.

## Safety boundary

- Qareen is optional and never affects deterministic cap-table calculations.
- It does not receive company records merely because a company pathname is
  active. Unknown values must not be invented.
- Public sample figures must never be described as authenticated company data.
- Authenticated mutation execution is not wired in the current release.
- The executor retains the approval gate from ADR-0009; no future mutating
  press may bypass explicit approval in the current exchange.

## Adding a guided target

1. Add a stable `data-ghost="target_id"` attribute to a real element. Prefer a
   container that exists during loading, empty, and populated states.
2. Add the ID to `GHOST_ELEMENT_IDS` in
   `frontend/src/lib/qareen/ghostRegistry.ts`.
3. Add its fixed route or `/companies/:companyId/...` route to `GHOST_ROUTES`.
4. Add the ID and its meaning to `backend/app/qareen/system_prompt.md`.
5. For a known public fact, add its spoken-pattern rule to
   `SPOKEN_FACT_TARGETS` in `ghostRegistry.ts`.
6. If the target may be clicked by Qareen, add it to
   `SAFE_GHOST_ACTIVATIONS`. Do not add submit or destructive controls without
   implementing and testing the approval boundary first.
7. Add a Playwright assertion proving navigation, scrolling, impact, and—when
   allowlisted—the real control side effect.

Never expose sensitive PII as a target label or place customer values in the
system prompt.

## Configuration

The backend reads:

```text
ANTHROPIC_API_KEY=<key used by the streamed Qareen brain>
```

Without the key, the endpoint returns the safe failure response. TTS is
separate from Claude and uses `edge-tts`.

## Verification

Run the complete browser suite against the local frontend and backend:

```bash
cd frontend
npx playwright test e2e/qareen --project=chromium --reporter=list
npx playwright test e2e/qareen --project=webkit --reporter=list
```

The real Claude + real Edge TTS test is deliberately opt-in because it consumes
the configured external services:

```bash
cd frontend
QAREEN_LIVE=1 npx playwright test e2e/qareen/live-claude.spec.ts --project=chromium --reporter=list
QAREEN_LIVE=1 npx playwright test e2e/qareen/live-claude.spec.ts --project=webkit --reporter=list
```

Run the backend Qareen tests, including real TTS synthesis:

```bash
cd backend
.venv/bin/pytest -q tests/test_qareen.py
```

Current Chromium and Safari/WebKit coverage includes motion, freeze/resume,
guide-mode routing,
public same-page scrolling, authenticated tenant-preserving navigation,
pause-safe dictation, microphone reopen, push-to-talk, text-field protection, and
word-synchronized voice/hand behavior. It also verifies guided-by-default
summoning, the rendered fingertip landing, delayed unmuted full-volume media
playback, visible TTS failure, and a complete opt-in live Claude/TTS website
turn. A second opt-in live test proves Claude can request a safe press and the
worker activates the real registration CTA. The reliability suite also
deliberately supplies a wrong broad Claude
target and proves the exact spoken-fact card overrides it, including a
two-fact line that finishes on the correct second row.

## Known test boundary

Automated tests stub browser speech recognition because CI has no physical
microphone. Real acoustic recognition accuracy still requires a manual test on
the target browser, operating system, microphone, and room conditions. The
Web Speech state machine and the real TTS endpoint are tested independently.
