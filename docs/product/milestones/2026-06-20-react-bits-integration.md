# Milestone — React Bits integration (Tier 1 + Tier 2 kickoff)

**Date:** 2026-06-20
**Owner:** Ali
**Status:** In progress — paused at a clean checkpoint
**Related:** ADR-0009 (WebGL decorative backgrounds)

---

## Goal

Enhance the 01 Capital frontend with selected React Bits (reactbits.dev)
components — backgrounds, animated text, reveals — **without** abandoning the
existing plain-CSS + CSS-variable design system or harming the legal-grade,
bilingual (EN/AR) product.

## Decisions made this session

1. **Path A — CSS variant, not the shadcn registry.** The official React Bits
   path is a shadcn registry that requires Tailwind + shadcn; this frontend uses
   plain CSS + CSS variables + inline TS styles. Adopting Tailwind/shadcn was
   rejected as too large an architectural change. Instead we **reimplement React
   Bits effects in our own idiom** (TypeScript, named exports, no Tailwind,
   design tokens, RTL + `prefers-reduced-motion` safe).
2. **Tier 2 deps approved via ADR-0009.** Adopted `three` +
   `@react-three/fiber` + `@react-three/drei` for **decorative WebGL backgrounds
   only**, always lazy-loaded (`ssr:false`) and reduced-motion guarded.
3. **Key correction recorded:** React Bits "CSS variant" only means *styling*
   without Tailwind — components can still pull JS deps (`motion`, `ogl`,
   `gsap`, `three`). Each dep is an ADR decision.

## Tiers (target scope)

- **Tier 1 (dep-free, no ADR):** CountUp ✅; marketing hero text
  (GradientText / ShinyText / BlurText); section reveals (ScrollReveal /
  FadeContent / AnimatedContent); feature cards (SpotlightCard / StarBorder).
- **Tier 2 (dep → ADR):** Beams background ✅ (ADR-0009); MagicBento (gsap) —
  not started.
- **Tier 3 (leave alone):** DonutChart, MetaballCanvas/PageBackground, and all
  legal workflow pages / forms / tables / delete modal.

---

## Done this session

| Item | File(s) | Status |
|------|---------|--------|
| React Bits MCP registered | `.mcp.json` (`reactbits` server) | Added; **not yet activated** (needs Claude Code restart/approval) |
| shadcn MCP (from earlier) | `.mcp.json` (`shadcn` server) | Present; **unused under Path A** — keep or remove (open question) |
| `CountUp` component | `frontend/src/components/CountUp.tsx` | ✅ built, type-checks; **not yet wired into any page** |
| Three.js stack installed | `frontend/package.json` | ✅ `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` |
| `Beams` WebGL component | `frontend/src/components/Beams.tsx` | ✅ TS port, type-checks |
| `BeamsBackground` wrapper | `frontend/src/components/BeamsBackground.tsx` | ✅ lazy + reduced-motion + on-brand fallback |
| Beams wired into auth panel | `frontend/src/components/AuthBrandPanel.tsx` | ✅ replaced 3 CSS blob divs |
| ADR for WebGL stack | `docs/decisions/0009-webgl-decorative-backgrounds.md` | ✅ Accepted |

### Verification status
- `npx tsc --noEmit` — **PASS** (clean).
- `npx eslint` on the 4 changed files — **PASS** (clean) after fixes. The first
  run found 3 real errors, now resolved:
  - `BeamsBackground.tsx`: `react-hooks/set-state-in-effect` (×2) → rewrote
    reduced-motion detection with `useSyncExternalStore`, dropped the `mounted`
    flag (Beams is already `dynamic ssr:false`).
  - `CountUp.tsx`: ref mutated during render → moved into a `useEffect`.
  - `Beams.tsx`: removed an unused `eslint-disable` directive.
- **No runtime/browser QA yet.** Beams has not been visually verified in a
  running app (login/register pages). Run `/qa http://localhost:3000` or load
  `/login` to confirm the WebGL background renders and the reduced-motion
  fallback works.

---

## What remains

### Immediate (to close this slice)
- [x] Confirm ESLint passes on the 4 changed components. ✅
- [ ] Visually QA the auth pages (`/login`, `/register`, `/verify`) — Beams
      renders, perf acceptable, reduced-motion shows the gradient fallback.
- [ ] Decide Beams tuning (beamNumber/speed/rotation/lightColor) against the
      real panel.

### Tier 1 build-out (dep-free reimplementations)
- [ ] Wire `CountUp` into dashboard metrics + `AuthBrandPanel` stats.
- [ ] GradientText / ShinyText for marketing heroes (landing, cap-table,
      compliance, esop, instruments) using `--gradient-brand`.
- [ ] ScrollReveal / FadeContent for marketing sections (IntersectionObserver,
      reduced-motion).
- [ ] SpotlightCard / StarBorder for `MarketingFeaturePage` cards.

### Tier 2 (needs its own ADR if pursued)
- [ ] MagicBento (gsap) — write ADR, then implement (or drop).
- [ ] Decide whether Beams should also back the landing hero (currently only
      auth panel; component is reusable).

### Housekeeping / open questions
- [ ] **Root pollution from `shadcn mcp init`:** `package.json`,
      `package-lock.json`, `node_modules/` (~87 MB) at repo root — not needed
      (MCP runs via `npx`). Safe to remove (will trigger `/careful`).
- [ ] **`frontend/.next 2`** — stray symlink → `/tmp/zcbuild/.next`; add to
      `.gitignore` (e.g. `frontend/.next*`) or remove.
- [ ] Decide: keep or remove the `shadcn` MCP server (unused under Path A).
- [ ] Activate the `reactbits` MCP (restart Claude Code / approve via `/mcp`).
      Note: not required for Path A — reference code is fetched from
      `reactbits.dev/r/{name}.json`.
- [ ] `.gitignore` already has an uncommitted `+.gstack/` change.

### Git state at pause
- Branch `main`, ahead of `origin/main` by 1 commit; **nothing from this session
  committed.** New untracked files: `.mcp.json`, the new components, ADR-0009,
  this milestone. Modified: `AuthBrandPanel.tsx`, `frontend/package.json`,
  `frontend/package-lock.json`, `.gitignore`.

---

## How to resume

1. Re-run `npx tsc --noEmit` and `npx eslint src/components/*.tsx` in `frontend/`.
2. Start the app and QA the auth pages for Beams.
3. Pick up Tier 1 build-out (CountUp wiring is the smallest next win).
4. For each new React Bits effect: pull reference from
   `https://reactbits.dev/r/{name}.json`, reimplement in our idiom, type-check,
   and only add a dep behind an ADR.
