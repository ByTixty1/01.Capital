# Design Spec — Landing + Auth redesign (Piece 1)

**Date:** 2026-07-03
**Owner:** Ali
**Status:** Design approved — ready for implementation plan
**Related:** ADR-0010 (interactive round-modeler teaser), ADR-0009 (WebGL decorative backgrounds), ADR-0003 (event-sourced cap table)

---

## Goal

Redesign the 01 Capital frontend **piece by piece**, elevating polish, usability,
and consistency without a ground-up rebuild. The design system, bilingual
readiness, and legal-grade product are already strong; this is refinement, not
replacement.

This spec covers **Piece 1 only: the marketing landing (`/`) and the auth screens
(`/login`, `/register`, `/verify`)** — the first-impression surface. Later pieces
get their own spec + plan.

## The redesign sequence (context, not this spec's scope)

1. **Landing + auth** ← this spec
2. Design-system pass — reconcile `globals.css` tokens + shared components
3. Dashboard
4. One reference workflow (e.g. cap-table view)
5. Roll the pattern to remaining workflows
6. Marketing sub-pages (`/cap-table`, `/compliance`, `/instruments`, `/esop`)

## Decisions locked (from the 2026-07-03 brainstorm)

- The landing's **light-streak background** (`MetaballCanvas` + grain + vignette),
  the **hero** (serif "A ledger written *in the language of law*", sub-copy,
  foot-cells), the **cursor lens**, the **world clocks**, the **dot-rail**, and
  the **bilingual EN/AR** treatment are all **keepers — untouched**. They are what
  makes the page good.
- The genuinely weak part is **section 02 ("Cap Table")** — a static fake
  dashboard. It gets **replaced** with an interactive teaser (ADR-0010).
- **Consistency win:** the auth brand panel drops `Beams` and adopts the same
  light-streak background as the landing, so auth feels like the same product.
- Silk (and other React Bits backgrounds explored) are **not** used on the
  landing — the existing background already achieves the calm-premium look.

---

## Piece 1 — detailed design

### 1a · Shared background (consistency foundation)

Extract the light-streak background (`MetaballCanvas` + `.lp-grain` +
`.lp-vignette`, currently inside `PageBackground`) into **one reusable component**
that is the single source of truth for "the ZeroOne background."

- Support two placement modes:
  - **Fixed / full-page** (landing) — `position: fixed; inset: 0` (current behaviour).
  - **Contained** (auth panel) — `position: absolute; inset: 0` within the panel,
    so it fills only that half without escaping the panel bounds.
- Preserve the existing lazy load (`next/dynamic`, `ssr: false`) and keep it
  `prefers-reduced-motion` aware (static fallback when reduced motion is set),
  consistent with ADR-0009.
- The landing's rendered look must not change — this is a pure extraction/refactor
  on the landing side.

### 1b · Landing — untouched keepers

No changes to: background, hero, cursor lens + chromatic aberration, world clocks,
dot-rail, nav structure, bilingual toggle. Explicitly out of scope for edits.

### 1c · Centerpiece rebuild — interactive round-modeler teaser (flagship)

Replace the static section-02 dashboard with the teaser specified in **ADR-0010**:

- **Interaction:** a slider for new round size / pre-money valuation drives a live,
  **client-side deterministic** recomputation over a fixed illustrative sample cap
  table (founders / Series A / seed / ESOP / sukuk). Founder dilution, the new
  investor slice, and headline figures update as the slider moves.
- **Rendering:** reuse the existing `DonutChart` for ownership; `CountUp` for the
  figures (fully-diluted shares, founder %, price/share).
- **Constraints (from ADR-0010):** no backend, no auth, no tenant data; its own
  small pure-TS calc module (no import of the real engine/API client); clearly
  labeled illustrative; the real tool lives inside the product.
- **Accessibility:** `prefers-reduced-motion` renders a static final state;
  EN/AR strings; RTL-safe; keyboard-operable slider.

### 1d · Polish pass (consistency)

Sections 03/04/05 (ESOP, Compliance, Instruments) law-cards, the CTA row, and the
footer: tighten spacing, type rhythm, and hover/interaction states up to the
hero's quality bar. **No structural change** — visual refinement only.

### 1e · Auth panel

`AuthBrandPanel`: swap `Beams` (`BeamsBackground`) for the shared light-streak
background (1a, contained mode). Keep the logo, tagline, and three stat chips;
tighten spacing so the panel matches the new quality bar. Grain overlay may be
folded into the shared component.

---

## Testing / Definition of Done

- **Unit tests** on the illustrative dilution calc (deterministic; table of
  slider input → expected ownership split). Target the project's 80% domain
  coverage bar for the new calc module.
- **Reduced-motion:** verify the teaser and shared background both render a static
  state under `prefers-reduced-motion: reduce`.
- **Existing auth E2E must stay green** after the `AuthBrandPanel` background swap.
- **Type-check + lint clean** (`tsc --noEmit`, eslint) on all changed/added files;
  TypeScript strict, no `any`, named exports (per `CLAUDE.md`).
- **Bilingual + RTL** spot-check of any new strings.
- Browser QA (`/qa http://localhost:3000`) of `/`, `/login`, `/register`, `/verify`.

## Out of scope (this piece)

- Any authenticated app surface (dashboard, workflows) — later pieces.
- The design-system token reconciliation — Piece 2.
- Marketing sub-pages — Piece 6.
- Removing/altering the lens, clocks, or hero.

## Open questions

- ~~Exact slider parameter(s): round size only, or round size **and** pre-money?~~
  **Decided 2026-07-03: round size only** (single slider) for this piece.
- Sample cap-table values: reuse the current section-02 illustrative numbers
  (Najm Logistics SJSC) for continuity, or a fresh set.

## Next step

Invoke the writing-plans skill to turn this spec into a step-by-step
implementation plan (thin slices: 1a shared background → 1e auth swap → 1c teaser
math → 1c teaser UI → 1d polish).
