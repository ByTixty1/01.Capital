# ADR-0009: Three.js / React Three Fiber for decorative WebGL backgrounds

**Status:** Superseded (2026-07-04) — the three.js/R3F adoption was rolled back
before merge. The 2026-07-03 landing + auth redesign spec
(`docs/product/milestones/2026-07-03-landing-auth-redesign.md`, ADR-0010) unifies
the auth panel on the landing's existing light-streak background instead of
`Beams`, so no surface needs the 3D dependency tree. The Beams implementation is
parked in git stash ("beams-webgl-auth-panel"). **Constraints 1–5 below remain
the standing rules for all decorative animated backgrounds** (they govern the
shared `SiteBackground` extraction too).

**Date:** 2026-06-20

**Authors:** Ali

---

## Context

The frontend has a mature dark-premium design system (purple accent, glass tokens,
bilingual EN/AR) and already ships hand-rolled animated backgrounds
(`MetaballCanvas`, `PageBackground`, the CSS blob field in `AuthBrandPanel`).

We want to raise the visual quality of brand surfaces (starting with the auth
brand panel) by adopting selected animated backgrounds from
[React Bits](https://reactbits.dev) — specifically the `Beams` component. That
component is a WebGL shader effect built on **Three.js + React Three Fiber (R3F) +
drei**, which are new runtime dependencies not currently in the locked stack
(`CLAUDE.md` rule #7 and the "no new frameworks without an ADR" rule).

These are heavy 3D libraries (~hundreds of KB). 01 Capital is a legal-grade B2B
cap-table product, not a consumer app, so any decorative dependency must be (a)
strictly decorative and replaceable, (b) off the critical path, (c) accessible
(reduced-motion), and (d) cheap enough not to harm core workflows.

## Decision

Adopt **`three`, `@react-three/fiber`, and `@react-three/drei`** in the frontend
**for decorative backgrounds only**, under these constraints:

1. **Decorative-only.** No 3D library may enter cap-table, ownership, or any
   legal/correctness path (`CLAUDE.md` rule #6 — the engine stays deterministic).
2. **Always lazy-loaded** via `next/dynamic` with `{ ssr: false }`, so the 3D
   bundle never blocks first paint or server rendering.
3. **Reduced-motion aware.** When `prefers-reduced-motion: reduce` is set, the
   WebGL canvas is not mounted; a static, on-brand fallback renders instead.
4. **Confined to brand surfaces** (auth panel, marketing hero). Never mounted
   behind dense data tables / legal workflow pages (performance).
5. Components are reimplemented in our idiom: **TypeScript (strict, no `any`
   except documented Three.js shader internals), named exports, no Tailwind**,
   referencing design tokens for colour.

First implementation: `Beams` in `AuthBrandPanel`, with `lightColor` set to the
brand purple.

## Consequences

### Positive
- Higher-end, differentiated brand/auth surfaces.
- Reusable `Beams` (and future R3F backgrounds) component, token-driven.
- No impact on the deterministic cap-table engine or legal logic.

### Negative
- Adds a sizeable 3D dependency tree (`three` + R3F + drei) to the frontend.
  Mitigated by lazy-loading: it is not in the initial/critical bundle.
- WebGL has a runtime cost on low-end devices. Mitigated by reduced-motion
  fallback and confining usage to brand surfaces only.
- One more thing to keep version-aligned with React 19 / Next 16 (R3F v9+).

### Neutral but worth noting
- React Bits ships these as JS+Tailwind; we maintain our own TS, non-Tailwind
  port, so upstream updates are a manual reference, not a dependency.

## Alternatives considered

- **Keep the existing CSS blob / Metaball backgrounds.** Zero new deps, but does
  not achieve the desired premium WebGL look the team asked for.
- **Pure-CSS/Canvas2D reimplementation of Beams.** Avoids the 3D stack but cannot
  faithfully reproduce the shader-based volumetric beams; high effort, lower
  fidelity.
- **Adopt the React Bits shadcn registry directly (Tailwind).** Rejected in
  conversation: would force Tailwind + shadcn into a plain-CSS codebase (a far
  larger architectural change). See the Path A decision.

## References

- Related: ADR-0002 (initial stack), ADR-0007 (Next.js 16 / React 19)
- React Bits — https://reactbits.dev (Beams component)
- `frontend/src/components/Beams.tsx`, `frontend/src/components/AuthBrandPanel.tsx`
- Conversation 2026-06-20 (React Bits integration, Tier 1 + Tier 2)
