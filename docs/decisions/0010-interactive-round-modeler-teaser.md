# ADR-0010: Interactive round-modeler teaser on the marketing landing

**Status:** Accepted

**Date:** 2026-07-03

**Authors:** Ali

---

## Context

The landing page section 02 ("Cap Table") is currently a static, hardcoded fake
dashboard — mock KPIs, ownership bars, an activity feed, and an upcoming-filings
list, all with literal values in JSX. It reads as a *mockup*, not a product, and
it is the weakest part of an otherwise strong, well-liked hero. As part of the
piece-by-piece landing redesign (see the design spec below), we want to replace
it with something that (a) feels real, (b) is on-message ("see dilution before
you sign — never after"), and (c) is memorable.

The product already contains a real, authenticated round modeler
(`companies/[id]/cap-table/round-modeler`) backed by the deterministic,
event-sourced cap-table engine. A *public marketing* widget must not expose real
tenant data, call the backend, or require auth.

Forces at play:

- `CLAUDE.md` rules #2 / #6 — the cap-table engine is deterministic and
  legal-grade; decorative/marketing features must never enter the correctness path.
- `CLAUDE.md` rule #3 — multi-tenancy; never surface real tenant data, and never
  render an unscoped query. A public page has no tenant.
- Bilingual (EN/AR, RTL) readiness and the `prefers-reduced-motion` baseline
  (consistent with ADR-0009).

## Decision

Add an **interactive round-modeler teaser** to the landing, replacing the static
section-02 dashboard, under these constraints:

1. **Client-side only.** A self-contained, deterministic dilution calculation
   over a fixed, clearly *illustrative* sample cap table. No backend calls, no
   auth, no tenant data, no network.
2. **Interaction.** A slider (new round size / pre-money valuation) drives live
   recomputation of ownership — founders diluted, new-investor slice, ESOP —
   rendered as an animated donut (reuse the existing `DonutChart`) plus `CountUp`
   figures.
3. **Illustrative labeling.** Visibly marked as a sample ("illustrative — your
   real numbers live inside"); never presented as legal or financial advice.
4. **Accessible & bilingual.** `prefers-reduced-motion: reduce` renders a static
   final state (no continuous animation); all strings are EN/AR and RTL-safe.
5. **Separate, dependency-light module.** The illustrative calc may mirror the
   *shape* of the real round-modeler logic, but is its own small pure-TS module.
   It does **not** import the authenticated engine, the API client, or any
   tenant-scoped code. No new runtime dependencies (reuses `DonutChart` +
   `CountUp`).

## Consequences

### Positive
- Replaces the weakest landing section with a memorable, on-message interaction.
- No new runtime dependencies; reuses components already in the tree.
- Zero exposure of real/tenant data; stays entirely off the legal-correctness path.
- The deterministic math is unit-testable in isolation.

### Negative
- Duplicates a small slice of dilution math on the client (illustrative only).
  Mitigated: it is intentionally simplified and sample-only; the canonical
  server-side engine remains the single source of truth.
- More landing JS + interaction surface to test (unit tests on the calc, plus a
  reduced-motion path).

### Neutral but worth noting
- Establishes a small "illustrative client-side finance widget" pattern that
  future marketing surfaces could reuse — kept strictly separate from the real engine.

## Alternatives considered

- **A — Living product frame:** polish the existing fake dashboard with `CountUp`
  + real donut, framed like the app. Lower effort, but keeps the "dashboard mock"
  framing. Rejected in favour of a higher-impact interaction.
- **B — Single signature visual:** one animated ownership donut with a headline
  figure. Calm and cheap, but non-interactive. Rejected — the team wants the
  interactive "feel it" moment.
- **Embed the real round modeler:** rejected outright — requires auth and tenant
  data, which is unacceptable on a public page (rule #3).

## References

- Related: ADR-0009 (WebGL decorative backgrounds), ADR-0003 (event-sourced cap table)
- Design spec: `docs/product/milestones/2026-07-03-landing-auth-redesign.md`
- Existing tool: `frontend/src/app/(app)/companies/[id]/cap-table/round-modeler/page.tsx`
- Reusable pieces: `frontend/src/components/DonutChart.tsx`, `frontend/src/components/CountUp.tsx`
- Conversation 2026-07-03 (landing + auth redesign brainstorm)
