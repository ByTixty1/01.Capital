# ADR-0010: Qareen guide overlay integrates with the real product, not just the isolated /qareen demo

**Status:** Accepted

**Date:** 2026-07-16

**Authors:** Mohammed Alharbi (CDO), implemented with Claude Code

---

## Context

`QAREEN_BRIEF.md` originally scoped Qareen (the voice + hand-gesture AI guide built for
the Amad Hackathon) to an isolated `/qareen` route tree, explicitly forbidding changes
to existing ZeroOne features, in order to stay compliant with `CLAUDE.md` hard rule #6
("AI is not the core... optional, narrow, and replaceable") and the Sprint 5 scope
boundary in `.agents/rules/01-project-rules.md`. That isolated build is complete: a
demo dashboard, cap table, compliance, and add-stakeholder page under `/qareen/*`, with
a persistent hand overlay, streamed Claude brain, TTS, voice input, and an
executor-enforced approval gate — see ADR-0009.

The user has now explicitly and repeatedly directed that Qareen must guide the user
across the **real product** instead of a separate demo page: both the public marketing
site (`/`, `/cap-table`, `/esop`, `/compliance`, `/instruments`, `/contact`) and the
authenticated app (`/companies/[id]/cap-table`, `/stakeholders`, `/filings`, `/esop`,
`/instruments`, `/pro-rata`). This directly overrides the brief's isolation instruction
and touches real production components outside the `qareen/` module boundary — a
conflict with rule #6 and the Sprint 5 scope rule that this ADR documents and resolves,
per `CLAUDE.md`'s own instruction not to silently comply with rule-conflicting requests.

---

## Decision

Proceed with the override. The integration is scoped as follows to keep it defensible
against the underlying rules even though the surface area is now product-wide:

1. **The approval constitution is unchanged and non-negotiable.** Qareen never executes
   a mutating action anywhere — real page or demo — without explicit user approval in
   the current exchange. This is enforced in the executor, not just the prompt (see
   ADR-0009), and that enforcement carries over unmodified.
2. **On real authenticated pages, Qareen's worker-hand "press" triggers the real page's
   own submit handler/button — it scripts the real UI, never a parallel or shadow API
   call.** RBAC, validation, and event-sourcing stay exactly as they are today; Qareen
   adds a pointer and a gate in front of the existing flow, not a new write path.
3. **New integration code stays under qareen-owned files/modules wherever possible.**
   Only the unavoidable minimum — adding `data-ghost` attributes to existing real
   components, and mounting the overlay in the root layout — touches existing files.
4. **This does not make AI core to the cap table engine**, which remains fully
   deterministic per rule #6. Qareen is a guidance layer on top of a product that
   functions identically with it absent.
5. **Spoken explanations and motion share the TTS word timeline.** Model-provided
   `on_word` indexes are resolved against real word-boundary timestamps, so a hand
   gesture lands on the word it explains instead of merely starting near the audio.

---

## Consequences

### Positive
- Matches what the user actually asked for; demonstrates the guide capability in situ
  rather than in a disconnected sandbox.

### Negative
- Larger blast radius: real production files (marketing pages, authenticated dashboard
  components) are touched, not just an isolated module.
- More surface for regressions in existing ZeroOne features.
- Real mutation risk if the approval gate is ever bypassed or has a bug — unlike the
  demo, a real authenticated page's submit is a real event-sourced write.

### Neutral but worth noting
- This ADR is itself the documented override `CLAUDE.md`'s conflict-handling protocol
  requires before implementing a rule-conflicting request.
- Constraint #2 (script the real UI, never a shadow API) is the load-bearing safety
  property of this whole decision — if a future change needs to break it, that needs
  its own ADR and a fresh look at whether the approval constitution still holds.

---

## Alternatives considered

- **Keep it isolated to `/qareen` only** (the original brief's design, ADR-0009).
  Rejected — not what the user wants; the point of this pass is real-site guidance.
- **Marketing site only, defer the authenticated app.** Offered to the user as the
  lower-risk option. Rejected for this pass — user explicitly chose "everything, same
  pass" over the staged alternative.

---

## References

- ADR-0009 (Qareen hackathon prototype dependencies, isolation scope)
- `QAREEN_BRIEF.md`, `QAREEN_SYSTEM_PROMPT.md`, `QAREEN_MOTION_SPEC.md` (session-provided
  hackathon spec)
- `docs/product/qareen-guide.md` (implemented runtime and extension guide)
- `CLAUDE.md` hard rule #6 (AI is not the core), rule #7 (ADR every non-trivial
  decision), "how to handle disagreement" protocol
- `.agents/rules/01-project-rules.md` ("AI is allowed only for narrow optional
  explanation tasks", "Do not touch ESOP... until basic cap table works end to end" —
  precedent for scope discipline in this repo)
