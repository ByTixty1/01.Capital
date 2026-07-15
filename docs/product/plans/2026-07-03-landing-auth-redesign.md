# Landing + Auth Redesign (Piece 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the landing's fake-dashboard centerpiece as an interactive (illustrative, client-side) round-modeler teaser, and unify the auth panel background with the landing — keeping everything already loved (background, hero, lens, clocks).

**Architecture:** A pure, deterministic dilution-math module (unit-tested with Vitest) drives a client `RoundTeaser` React island that reuses the existing `DonutChart`. The landing's light-streak background (`MetaballCanvas` + grain + vignette) is extracted into one reusable `SiteBackground` component with `fixed`/`contained` modes and a `prefers-reduced-motion` fallback; the auth panel adopts it in place of `Beams`. A polish pass tightens the remaining marketing sections.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, plain CSS + CSS variables (no Tailwind), Vitest (new devDependency — ADR-0011), Playwright (existing E2E).

## Global Constraints

- TypeScript `strict: true`; **no `any`** (except documented WebGL/shader internals). — `CLAUDE.md`
- **Named exports** only (exception: Next.js page/layout default exports). — `CLAUDE.md`
- **Plain CSS + CSS variables; no Tailwind, no shadcn.** — ADR-0009 / react-bits milestone (Path A)
- **Server components by default; client components only when interaction requires** (`'use client'`). — `CLAUDE.md`
- **Reduced-motion safe:** honor `prefers-reduced-motion: reduce` on all animation/WebGL. — ADR-0009
- **Bilingual EN/AR + RTL-safe:** customer-facing strings translation-ready; use the landing's `data-ar` + `.lp-en`/`.lp-ar` span pattern; use CSS logical properties (`margin-inline-*`) not `left`/`right`. — `CLAUDE.md` rule #4
- **Never hardcode currency;** use `formatSAR` / `formatSARWhole` from `@/lib/format`; numbers render mono + `tabular-nums`. — `CLAUDE.md` rule #4
- **Teaser is client-side only, illustrative, deterministic; no backend, no auth, no tenant data;** its math module must not import the real engine or API client. — ADR-0010
- **No new runtime dependencies** (Vitest is a devDependency). — `CLAUDE.md` rule #7
- Small PRs, **conventional commits** (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`). — `CLAUDE.md`
- All commands below run from the `frontend/` directory unless noted.

---

## File Structure

- `docs/decisions/0011-vitest-frontend-unit-tests.md` — **create** (ADR for the test runner)
- `frontend/vitest.config.ts` — **create** (Vitest config, node env)
- `frontend/package.json` — **modify** (add `vitest` devDep + `test:unit` script)
- `frontend/src/lib/landing/roundTeaser.ts` — **create** (pure dilution math + constants)
- `frontend/src/lib/landing/roundTeaser.test.ts` — **create** (Vitest unit tests)
- `frontend/src/components/MetaballCanvas.tsx` — **modify** (accept `position` prop)
- `frontend/src/components/SiteBackground.tsx` — **create** (shared bg: fixed/contained + reduced-motion + grain + vignette)
- `frontend/src/components/PageBackground.tsx` — **modify** (delegate to `SiteBackground mode="fixed"`)
- `frontend/src/components/AuthBrandPanel.tsx` — **modify** (swap `Beams` → `SiteBackground mode="contained"`)
- `frontend/src/components/RoundTeaser.tsx` — **create** (the interactive teaser island)
- `frontend/src/app/page.tsx` — **modify** (replace `.lp-dash` block with `<RoundTeaser />`)
- `frontend/src/app/landing-styles.ts` — **modify** (remove section-02 dashboard CSS; add teaser + background-fallback CSS; polish rules)

---

## Task 1: Vitest setup + ADR-0011

**Files:**
- Create: `docs/decisions/0011-vitest-frontend-unit-tests.md`
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: an `npm run test:unit` script (runs `vitest run`) that Task 2 uses for TDD.

- [ ] **Step 1: Write ADR-0011**

Create `docs/decisions/0011-vitest-frontend-unit-tests.md`:

```markdown
# ADR-0011: Vitest for frontend unit tests

**Status:** Accepted

**Date:** 2026-07-03

**Authors:** Ali

---

## Context

The frontend has no unit-test runner — only Playwright E2E (`test:e2e`). The
landing round-modeler teaser (ADR-0010) introduces a pure, deterministic
dilution-math module that must be tested as a table of input → output, which E2E
covers poorly. The project values TDD and an 80% domain-coverage bar; the piece-
by-piece redesign will keep producing testable frontend logic. Adding a test
runner is a dependency decision (`CLAUDE.md` rule #7).

## Decision

Adopt **Vitest** as a frontend **devDependency** for unit tests, minimal config
(`environment: 'node'`, `include: ['src/**/*.test.ts']`), exposed as
`npm run test:unit` (`vitest run`). Vitest is dev-only — it adds **no runtime
dependency** and never ships in the app bundle. It coexists with Playwright:
Vitest owns `src/**/*.test.ts` (pure logic), Playwright owns E2E.

## Consequences

### Positive
- Fast, granular TDD for pure frontend logic (starting with the teaser math).
- Unblocks unit testing for every later redesign piece.
- No runtime dependency; dev-only.

### Negative
- One more dev tool + config to maintain and keep aligned with the toolchain.

### Neutral but worth noting
- Two test runners in the frontend (Vitest unit, Playwright E2E) with a clear
  file-pattern split.

## Alternatives considered

- **Playwright E2E only:** no new dep, but testing a math table through the UI is
  slow and coarse; poor TDD ergonomics. Rejected.
- **Node built-in test runner (`node --test`):** needs a TS loader (tsx/ts-node)
  anyway, and lacks Vitest's ergonomics/aliasing. Rejected.

## References

- Related: ADR-0010 (interactive round-modeler teaser)
- Design spec: `docs/product/milestones/2026-07-03-landing-auth-redesign.md`
- Conversation 2026-07-03 (landing + auth redesign planning)
```

- [ ] **Step 2: Install Vitest**

Run (from `frontend/`): `npm install -D vitest`
Expected: `vitest` added under `devDependencies`; lockfile updated.

- [ ] **Step 3: Create the Vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add the `test:unit` script**

In `frontend/package.json`, add to `"scripts"` (after `"type-check"`):

```json
    "test:unit": "vitest run",
```

- [ ] **Step 5: Verify the runner works with no tests yet**

Run: `npx vitest run --passWithNoTests`
Expected: exits 0, prints "No test files found" (config valid, runner installed).

- [ ] **Step 6: Commit**

```bash
git add docs/decisions/0011-vitest-frontend-unit-tests.md frontend/vitest.config.ts frontend/package.json frontend/package-lock.json
git commit -m "chore(frontend): add Vitest for unit tests (ADR-0011)"
```

---

## Task 2: Round-modeler dilution math (pure module, TDD)

**Files:**
- Create: `frontend/src/lib/landing/roundTeaser.ts`
- Test: `frontend/src/lib/landing/roundTeaser.test.ts`

**Interfaces:**
- Consumes: `npm run test:unit` (Task 1).
- Produces:
  - `interface OwnershipSlice { key: string; label: string; labelAr: string; pct: number; color: string }`
  - `interface RoundTeaserResult { slices: OwnershipSlice[]; newInvestorPct: number; founderPct: number; postMoneySar: number; pricePerShareSar: number }`
  - `function computeRoundTeaser(roundSar: number): RoundTeaserResult`
  - constants `ROUND_MIN_SAR = 0`, `ROUND_MAX_SAR = 60_000_000`, `ROUND_DEFAULT_SAR = 20_000_000`, `ROUND_STEP_SAR = 1_000_000`
  - Model: fixed pre-money `200_000_000`; existing fully-diluted shares `8_612_500`; existing holders diluted by `PRE/(PRE+round)`; new investor pct `round/(PRE+round)`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/landing/roundTeaser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  computeRoundTeaser,
  ROUND_MAX_SAR,
  ROUND_MIN_SAR,
} from './roundTeaser';

describe('computeRoundTeaser', () => {
  it('at round=0: no new investor, founders undiluted, 5 slices, sum 100', () => {
    const r = computeRoundTeaser(0);
    expect(r.newInvestorPct).toBe(0);
    expect(r.founderPct).toBe(46);
    expect(r.slices).toHaveLength(5);
    expect(r.postMoneySar).toBe(200_000_000);
    const sum = r.slices.reduce((a, s) => a + s.pct, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('at round=20M: dilutes proportionally and adds a new-investor slice', () => {
    const r = computeRoundTeaser(20_000_000);
    expect(r.newInvestorPct).toBeCloseTo(9.0909, 3);
    expect(r.founderPct).toBeCloseTo(41.8182, 3);
    expect(r.slices).toHaveLength(6);
    const sum = r.slices.reduce((a, s) => a + s.pct, 0);
    expect(sum).toBeCloseTo(100, 6);
  });

  it('at round=60M (max): new investor ~23.08%', () => {
    const r = computeRoundTeaser(60_000_000);
    expect(r.newInvestorPct).toBeCloseTo(23.0769, 3);
  });

  it('clamps above max and below min', () => {
    expect(computeRoundTeaser(999_000_000).newInvestorPct).toBeCloseTo(
      computeRoundTeaser(ROUND_MAX_SAR).newInvestorPct,
      6,
    );
    expect(computeRoundTeaser(-1).newInvestorPct).toBe(ROUND_MIN_SAR);
  });

  it('price per share reflects fixed pre-money over existing shares', () => {
    expect(computeRoundTeaser(0).pricePerShareSar).toBeCloseTo(23.2198, 3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/landing/roundTeaser.test.ts`
Expected: FAIL — cannot resolve `./roundTeaser` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/landing/roundTeaser.ts`:

```ts
// Illustrative, client-side round-modeler math for the landing teaser (ADR-0010).
// Deterministic and dependency-free. Does NOT import the real cap-table engine
// or API client — the sample cap table and pre-money are fixed and illustrative.

export interface OwnershipSlice {
  key: string;
  label: string;
  labelAr: string;
  pct: number;
  color: string;
}

export interface RoundTeaserResult {
  /** Existing holders (diluted) plus the new-investor slice when round > 0. Sums ~100. */
  slices: OwnershipSlice[];
  newInvestorPct: number;
  founderPct: number;
  postMoneySar: number;
  pricePerShareSar: number;
}

export const ROUND_MIN_SAR = 0;
export const ROUND_MAX_SAR = 60_000_000;
export const ROUND_DEFAULT_SAR = 20_000_000;
export const ROUND_STEP_SAR = 1_000_000;

const PRE_MONEY_SAR = 200_000_000;
const EXISTING_FULLY_DILUTED_SHARES = 8_612_500;
const NEW_INVESTOR_COLOR = '#d946ef';

const BASE_OWNERSHIP: readonly OwnershipSlice[] = [
  { key: 'founders', label: 'Founders', labelAr: 'المؤسسون', pct: 46, color: '#a78bfa' },
  { key: 'seriesA', label: 'Series A', labelAr: 'الجولة أ', pct: 22, color: '#8b5cf6' },
  { key: 'seed', label: 'Seed', labelAr: 'الجولة التأسيسية', pct: 14, color: '#6d4cc6' },
  { key: 'esop', label: 'ESOP pool', labelAr: 'مجمع الموظفين', pct: 10, color: '#4d3692' },
  { key: 'sukuk', label: 'Sukuk convertibles', labelAr: 'صكوك قابلة للتحويل', pct: 8, color: '#332661' },
];

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export function computeRoundTeaser(roundSar: number): RoundTeaserResult {
  const round = clamp(roundSar, ROUND_MIN_SAR, ROUND_MAX_SAR);
  const postMoneySar = PRE_MONEY_SAR + round;
  const dilutionFactor = PRE_MONEY_SAR / postMoneySar;
  const newInvestorPct = (round / postMoneySar) * 100;

  const existing = BASE_OWNERSHIP.map((s) => ({ ...s, pct: s.pct * dilutionFactor }));
  const slices: OwnershipSlice[] =
    round > 0
      ? [
          ...existing,
          { key: 'newRound', label: 'New round', labelAr: 'جولة جديدة', pct: newInvestorPct, color: NEW_INVESTOR_COLOR },
        ]
      : existing;

  return {
    slices,
    newInvestorPct,
    founderPct: existing[0].pct,
    postMoneySar,
    pricePerShareSar: PRE_MONEY_SAR / EXISTING_FULLY_DILUTED_SHARES,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/landing/roundTeaser.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Type-check + lint**

Run: `npm run type-check && npx eslint src/lib/landing/roundTeaser.ts src/lib/landing/roundTeaser.test.ts`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/landing/roundTeaser.ts frontend/src/lib/landing/roundTeaser.test.ts
git commit -m "feat(landing): deterministic round-modeler dilution math (ADR-0010)"
```

---

## Task 3: Shared `SiteBackground` component + `PageBackground` refactor

**Files:**
- Modify: `frontend/src/components/MetaballCanvas.tsx`
- Create: `frontend/src/components/SiteBackground.tsx`
- Modify: `frontend/src/components/PageBackground.tsx`
- Modify: `frontend/src/app/landing-styles.ts` (add `.lp-bg-fallback` rule)

**Interfaces:**
- Consumes: `MetaballCanvas` default export.
- Produces:
  - `MetaballCanvas` accepts `{ position?: 'fixed' | 'absolute' }` (default `'fixed'`).
  - `export function SiteBackground({ mode }: { mode?: 'fixed' | 'contained' })` — renders the WebGL fluid bg (or a static fallback under reduced motion) + grain + vignette, wrapped in an `overflow:hidden` positioned container with `data-testid="site-background"`.

This task is a visual refactor: the landing's rendered look must not change. Verified by type-check + lint + manual dev-server QA.

- [ ] **Step 1: Add a `position` prop to `MetaballCanvas`**

In `frontend/src/components/MetaballCanvas.tsx`, change the component signature and the canvas `style.position`:

```tsx
export default function MetaballCanvas({
  position = 'fixed',
}: { position?: 'fixed' | 'absolute' } = {}) {
```

And in the returned `<canvas>` style, replace `position: 'fixed',` with `position,`. Leave everything else (WebGL setup, resize, RAF, `filter: 'blur(2px)'`) unchanged.

- [ ] **Step 2: Create `SiteBackground`**

Create `frontend/src/components/SiteBackground.tsx`:

```tsx
'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';

const FluidBg = dynamic(() => import('@/components/MetaballCanvas'), { ssr: false });

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(REDUCE_QUERY);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
function getSnapshot(): boolean {
  return window.matchMedia(REDUCE_QUERY).matches;
}
function getServerSnapshot(): boolean {
  return false;
}

/**
 * The single ZeroOne "light-streak" background: WebGL fluid ribbons + grain +
 * vignette. `fixed` = full-page (landing). `contained` = fills its positioned
 * parent (auth panel). Under prefers-reduced-motion, the WebGL canvas is not
 * mounted; a static on-brand gradient renders instead (ADR-0009).
 */
export function SiteBackground({ mode = 'fixed' }: { mode?: 'fixed' | 'contained' }) {
  const reduceMotion = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      data-testid="site-background"
      aria-hidden="true"
      style={{
        position: mode === 'fixed' ? 'fixed' : 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {reduceMotion ? <div className="lp-bg-fallback" /> : <FluidBg position="absolute" />}
      <div className="lp-grain" />
      {mode === 'fixed' && <div className="lp-vignette" />}
      <style jsx global>{`
        .lp-grain {
          position: absolute; inset: -50%; z-index: 1; pointer-events: none; opacity: .07; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.92' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          background-size: 240px 240px; animation: lp-grain 1.4s steps(6) infinite;
        }
        @keyframes lp-grain {
          0%{transform:translate(0,0)} 20%{transform:translate(-4%,2%)} 40%{transform:translate(3%,-3%)} 60%{transform:translate(-2%,4%)} 80%{transform:translate(4%,-2%)} 100%{transform:translate(0,0)}
        }
        .lp-vignette {
          position: absolute; inset: 0; z-index: 2; pointer-events: none; background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.65) 100%);
        }
        @media (prefers-reduced-motion: reduce) { .lp-grain { animation: none; } }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Add the `.lp-bg-fallback` style**

In `frontend/src/app/landing-styles.ts`, add this rule inside the `LANDING_CSS` template (near the other `.lp-` background rules):

```css
.lp-bg-fallback {
  position: absolute; inset: 0; z-index: 0;
  background:
    radial-gradient(120% 90% at 20% 12%, rgba(139,92,246,0.14), transparent 60%),
    radial-gradient(120% 120% at 82% 85%, rgba(217,70,239,0.08), transparent 58%),
    var(--bg-base);
}
```

- [ ] **Step 4: Refactor `PageBackground` to delegate**

Replace the entire body of `frontend/src/components/PageBackground.tsx` with:

```tsx
'use client';

import { SiteBackground } from '@/components/SiteBackground';

// Landing full-page background. Thin wrapper over the shared SiteBackground so
// the landing keeps a stable import while auth reuses the same component.
export function PageBackground() {
  return <SiteBackground mode="fixed" />;
}
```

(The grain/vignette `<style jsx global>` that lived here now lives in `SiteBackground` — do not leave a duplicate.)

- [ ] **Step 5: Type-check + lint**

Run: `npm run type-check && npx eslint src/components/SiteBackground.tsx src/components/PageBackground.tsx src/components/MetaballCanvas.tsx`
Expected: clean. (If eslint flags `react-hooks` on `useSyncExternalStore`, confirm the three store functions are module-level, not inline — they are above.)

- [ ] **Step 6: Manual QA — landing look unchanged**

Run: `npm run dev`, open `http://localhost:3000/`.
Expected: hero light-streak background looks identical to before; no console errors. Then toggle OS "Reduce Motion" on and reload — the static gradient fallback shows instead of the canvas.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SiteBackground.tsx frontend/src/components/PageBackground.tsx frontend/src/components/MetaballCanvas.tsx frontend/src/app/landing-styles.ts
git commit -m "refactor(frontend): extract shared SiteBackground (fixed/contained + reduced-motion)"
```

---

## Task 4: Unify the auth panel with the landing background

**Files:**
- Modify: `frontend/src/components/AuthBrandPanel.tsx`

**Interfaces:**
- Consumes: `SiteBackground` (Task 3).
- Produces: `AuthBrandPanel` renders `<SiteBackground mode="contained" />` behind its content; no `Beams`/`BeamsBackground` and no inline grain div.

- [ ] **Step 1: Swap the background**

In `frontend/src/components/AuthBrandPanel.tsx`:
- Replace the import `import { BeamsBackground } from './BeamsBackground';` with `import { SiteBackground } from './SiteBackground';`
- Replace the `<BeamsBackground ... />` element with `<SiteBackground mode="contained" />`
- **Delete** the inline "Grain overlay" `<div>` block (the `SiteBackground` provides grain now).
- Keep the wrapper (`position: relative`, `overflow: hidden`, `background: '#06060a'`, border), the content `<div>` (`zIndex: 2`), the `Logo`, tagline, and the three stat chips exactly as-is.

Resulting structure (for reference):

```tsx
import { Logo } from './Logo';
import { SiteBackground } from './SiteBackground';

export function AuthBrandPanel({ tagline = 'Saudi-native cap table for founders' }: { tagline?: string }) {
  return (
    <div
      data-auth-brand-panel="true"
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#06060a',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 48px',
      }}
    >
      <SiteBackground mode="contained" />

      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        {/* ...unchanged: Logo, tagline, stat chips... */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npx eslint src/components/AuthBrandPanel.tsx`
Expected: clean, and no remaining reference to `BeamsBackground` in this file.

- [ ] **Step 3: Manual QA — auth pages**

Run `npm run dev`, open `http://localhost:3000/login`, `/register`, `/verify`.
Expected: the brand panel shows the same light-streak background as the landing (contained within the panel), logo + tagline + stat chips intact, no overflow outside the panel, no console errors.

- [ ] **Step 4: Run the existing auth E2E suite (must stay green)**

Per the local E2E setup (production build + `RATE_LIMIT_ENABLED=false`, unique CR numbers): build and run the existing Playwright suite.

Run: `npm run build && RATE_LIMIT_ENABLED=false npm run test:e2e`
Expected: the auth/login/register specs pass (the background swap must not break auth flows). If the harness needs the documented env/build steps, follow the project's E2E local-setup notes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AuthBrandPanel.tsx
git commit -m "feat(auth): unify auth brand panel with the landing background"
```

---

## Task 5: `RoundTeaser` component + replace section 02

**Files:**
- Create: `frontend/src/components/RoundTeaser.tsx`
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/landing-styles.ts` (remove dashboard CSS; add teaser CSS)

**Interfaces:**
- Consumes: `computeRoundTeaser` + constants (Task 2); `DonutChart` (`slices: {pct,color,label?}[]`, `size`); `formatSARWhole` (`@/lib/format`).
- Produces: `export function RoundTeaser()` — the interactive island rendered inside `<section id="cap-table">`.

- [ ] **Step 1: Create the `RoundTeaser` component**

Create `frontend/src/components/RoundTeaser.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { DonutChart } from './DonutChart';
import { formatSARWhole } from '@/lib/format';
import {
  computeRoundTeaser,
  ROUND_MIN_SAR,
  ROUND_MAX_SAR,
  ROUND_DEFAULT_SAR,
  ROUND_STEP_SAR,
} from '@/lib/landing/roundTeaser';

const pct1 = (v: number): string => `${v.toFixed(1)}%`;

// Numbers follow the slider live (no re-animate-from-zero), which is the right
// feel for a draggable control; the donut animates its arcs via DonutChart's CSS
// transitions. See ADR-0010.
export function RoundTeaser() {
  const [roundSar, setRoundSar] = useState(ROUND_DEFAULT_SAR);
  const result = computeRoundTeaser(roundSar);

  return (
    <div className="lp-teaser" data-testid="round-teaser">
      <div className="lp-teaser-tag" data-ar="توضيحي — أرقامك الحقيقية بالداخل">
        <span className="lp-en">Illustrative — your real numbers live inside</span>
        <span className="lp-ar" />
      </div>

      <div className="lp-teaser-controls">
        <div className="lp-teaser-round">
          {formatSARWhole(roundSar)}<small>SAR raised</small>
        </div>
        <input
          type="range"
          className="lp-teaser-slider"
          min={ROUND_MIN_SAR}
          max={ROUND_MAX_SAR}
          step={ROUND_STEP_SAR}
          value={roundSar}
          onChange={(e) => setRoundSar(Number(e.target.value))}
          aria-label="New round size in Saudi riyals"
        />
        <div className="lp-teaser-figures">
          <div className="lp-teaser-fig">
            <b>{pct1(result.founderPct)}</b>
            <span data-ar="المؤسسون بعد الجولة"><span className="lp-en">Founders after</span><span className="lp-ar" /></span>
          </div>
          <div className="lp-teaser-fig">
            <b>{pct1(result.newInvestorPct)}</b>
            <span data-ar="المستثمر الجديد"><span className="lp-en">New investor</span><span className="lp-ar" /></span>
          </div>
          <div className="lp-teaser-fig">
            <b>{formatSARWhole(result.postMoneySar)}</b>
            <span data-ar="التقييم بعد الجولة"><span className="lp-en">Post-money</span><span className="lp-ar" /></span>
          </div>
        </div>
      </div>

      <div className="lp-teaser-viz">
        <DonutChart slices={result.slices} size={180} />
        <div className="lp-teaser-legend">
          {result.slices.map((s) => (
            <div key={s.key}>
              <span className="sw" style={{ background: s.color }} />
              <span data-ar={s.labelAr}><span className="lp-en">{s.label}</span><span className="lp-ar" /></span>
              {' · '}{pct1(s.pct)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add teaser CSS + remove the dashboard CSS**

In `frontend/src/app/landing-styles.ts`:

**(a)** Delete the CSS rules for the old section-02 dashboard — every rule whose selector starts with any of: `.lp-dash`, `.lp-dash-side`, `.lp-dash-main`, `.lp-dash-row`, `.lp-kpis`, `.lp-kpi`, `.lp-kpi-label`, `.lp-kpi-value`, `.lp-kpi-delta`, `.lp-panel`, `.lp-panel-head`, `.lp-panel-body`, `.lp-panel-meta`, `.lp-stack`, `.lp-stack-bar`, `.lp-feed`, `.lp-feed-item`, `.lp-feed-time`, `.lp-feed-what`, `.lp-filings`, `.lp-filing`, `.lp-filing-date`, `.lp-filing-title`, `.lp-filing-due`. (These are only used by the block being replaced in Step 3. Keep `.lp-bay`, `.lp-bay-head`, `.lp-bay-num`, `.lp-bay-title`, `.lp-pill`, `.lp-swatch`, `.lp-up` etc. if they're shared elsewhere — grep before deleting: `grep -n "lp-pill\|lp-swatch\|lp-up" src/app/page.tsx`.)

**(b)** Add this block inside `LANDING_CSS`:

```css
/* ── Section 02 · Round-modeler teaser (ADR-0010) ───────────────────────── */
.lp-teaser { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-12); align-items:center; max-width:1000px; margin:0 auto; padding:var(--space-8) 0; }
.lp-teaser-tag { grid-column:1 / -1; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--text-tertiary); }
.lp-teaser-controls { display:flex; flex-direction:column; gap:var(--space-4); }
.lp-teaser-round { font-family:var(--font-mono); font-size:34px; font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums; }
.lp-teaser-round small { font-size:14px; color:var(--text-tertiary); margin-inline-start:8px; font-family:var(--font-sans); font-weight:400; }
.lp-teaser-slider { -webkit-appearance:none; appearance:none; width:100%; height:5px; border-radius:3px; background:var(--border-default); outline:none; }
.lp-teaser-slider::-webkit-slider-thumb { -webkit-appearance:none; width:20px; height:20px; border-radius:50%; background:var(--brand-purple); box-shadow:0 0 0 5px var(--brand-purple-subtle); cursor:pointer; }
.lp-teaser-slider::-moz-range-thumb { width:20px; height:20px; border:none; border-radius:50%; background:var(--brand-purple); box-shadow:0 0 0 5px var(--brand-purple-subtle); cursor:pointer; }
.lp-teaser-slider:focus-visible { box-shadow:0 0 0 2px var(--brand-purple); }
.lp-teaser-figures { display:flex; gap:var(--space-8); margin-top:var(--space-4); }
.lp-teaser-fig b { display:block; font-family:var(--font-mono); font-size:22px; color:var(--text-primary); font-variant-numeric:tabular-nums; }
.lp-teaser-fig span { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-tertiary); }
.lp-teaser-viz { display:flex; align-items:center; gap:var(--space-6); }
.lp-teaser-legend { display:flex; flex-direction:column; gap:6px; font-size:12px; color:var(--text-secondary); }
.lp-teaser-legend .sw { display:inline-block; width:9px; height:9px; border-radius:2px; margin-inline-end:8px; }
@media (max-width:860px){ .lp-teaser{ grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce){ .lp-teaser *{ transition:none !important; } }
```

- [ ] **Step 3: Replace section 02's dashboard with the teaser**

In `frontend/src/app/page.tsx`:
- Add the import near the top (with the other component imports): `import { RoundTeaser } from '@/components/RoundTeaser';`
- Inside `<section className="lp-bay" id="cap-table">`, **keep** the `<div className="lp-bay-head lp-fade">…</div>` (the "02 / Cap Table" heading), and **replace the entire `<div className="lp-dash"> … </div>` block** (the sidebar + KPIs + panels + filings) with a single line:

```tsx
          <RoundTeaser />
```

- [ ] **Step 4: Type-check + lint**

Run: `npm run type-check && npx eslint src/components/RoundTeaser.tsx src/app/page.tsx`
Expected: clean. (No unused-import warnings from the removed dashboard JSX — remove any now-unused imports in `page.tsx` if flagged.)

- [ ] **Step 5: Re-run unit tests (math still green)**

Run: `npx vitest run src/lib/landing/roundTeaser.test.ts`
Expected: PASS.

- [ ] **Step 6: Manual QA — the teaser**

Run `npm run dev`, open `http://localhost:3000/#cap-table`.
Expected: dragging the slider updates the SAR-raised figure, the donut redraws (founders slice shrinks, magenta new-investor slice grows), and Founders/New-investor/Post-money figures update live. Keyboard: focus the slider, arrow keys move it. Toggle the page's EN/AR switch — teaser labels swap to Arabic. Toggle OS Reduce Motion — no jarring transitions.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/RoundTeaser.tsx frontend/src/app/page.tsx frontend/src/app/landing-styles.ts
git commit -m "feat(landing): interactive round-modeler teaser replaces fake dashboard (ADR-0010)"
```

---

## Task 6: Polish pass — law-cards, CTA, footer

**Files:**
- Modify: `frontend/src/app/landing-styles.ts` (append enhancement rules)

**Interfaces:**
- Consumes: existing `.lp-lawcard`, `.lp-cta-btn`, `.lp-nav-cta`, `.lp-footer` classes.
- Produces: nothing new; purely visual refinement. Appended rules win by source order.

- [ ] **Step 1: Append polish rules**

At the end of `LANDING_CSS` (before the closing backtick) in `frontend/src/app/landing-styles.ts`, append:

```css
/* ── Polish pass (Piece 1) ──────────────────────────────────────────────── */
.lp-lawcard { transition: transform var(--transition-default), border-color var(--transition-default), box-shadow var(--transition-default); }
.lp-lawcard:hover { transform: translateY(-4px); border-color: var(--brand-purple-subtle); box-shadow: var(--shadow-md); }
.lp-cta-btn:focus-visible, .lp-nav-cta:focus-visible, .lp-nav-signin:focus-visible { outline: 2px solid var(--brand-purple); outline-offset: 3px; border-radius: var(--radius-sm); }
.lp-footer { padding-block: var(--space-16); }
.lp-footer a { transition: color var(--transition-fast); }
.lp-footer a:hover { color: var(--text-primary); }
@media (prefers-reduced-motion: reduce) { .lp-lawcard { transition: none; } .lp-lawcard:hover { transform: none; } }
```

- [ ] **Step 2: Type-check + lint**

Run: `npm run type-check && npx eslint src/app/landing-styles.ts`
Expected: clean.

- [ ] **Step 3: Manual QA — polish**

Run `npm run dev`, open `http://localhost:3000/`. Scroll to ESOP/Compliance/Instruments.
Expected: law-cards lift on hover with a soft border/shadow; keyboard-tabbing shows visible focus rings on nav CTAs; footer links brighten on hover; nothing shifts layout.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/landing-styles.ts
git commit -m "feat(landing): polish law-cards, CTA focus states, footer"
```

---

## Self-Review (completed at plan-writing time)

**Spec coverage:**
- 1a shared background → Task 3. ✅
- 1b keepers untouched → no task edits hero/lens/clocks (only the `.lp-dash` block in `#cap-table` and appended CSS). ✅
- 1c interactive teaser (ADR-0010, round-size only, client-side/illustrative/deterministic, reduced-motion, bilingual) → Tasks 2 + 5. ✅
- 1d polish → Task 6. ✅
- 1e auth unify → Task 4. ✅
- Testing/DoD: unit tests on math (Task 2), reduced-motion fallback (Task 3 Step 6 + Task 5 Step 6), auth E2E green (Task 4 Step 4), type-check/lint every task, bilingual spot-check (Task 5 Step 6). ✅

**Placeholder scan:** none — every code/CSS step ships complete content.

**Type consistency:** `OwnershipSlice`/`RoundTeaserResult`/`computeRoundTeaser` + constants defined in Task 2 are consumed with matching names/types in Task 5; `SiteBackground({ mode })` and `MetaballCanvas({ position })` defined in Task 3 are consumed with matching props in Tasks 3–4; `DonutChart` `slices` accepts `OwnershipSlice[]` (superset of `DonutSlice`). ✅

**Deviation noted:** ADR-0010 mentioned `CountUp` on the figures; the plan renders slider-driven figures directly (Task 5 Step 1 comment) to avoid re-animating from zero on every drag — the donut carries the animation. Behavior-equivalent, better feel.
