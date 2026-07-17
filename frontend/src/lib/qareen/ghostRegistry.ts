/**
 * Maps each data-ghost element id to the real product route it lives on,
 * and resolves live DOM nodes for the motion executor. This is what lets
 * the worker hand "know" it needs to navigate before it can point at
 * something (see ADR-0010 — Qareen now guides across the real site, not
 * an isolated demo).
 *
 * Two kinds of entries:
 * - Landing page (`/`) ids are anchor-scrolled sections on the SAME
 *   route — no navigation fires for these, only a scroll-into-view (see
 *   executor.ts's scrollIntoViewAndSettle).
 * - `*_page` ids live on their own dedicated marketing route
 *   (`/cap-table`, `/esop`, `/compliance`, `/instruments`) via the
 *   shared MarketingFeaturePage template's `ghostPrefix` prop — these
 *   are real cross-page navigations.
 *
 * Authenticated app routes use a `:companyId` segment. It is resolved
 * from the current pathname so guidance stays inside the tenant the user
 * is already viewing; Qareen never guesses or hard-codes a tenant id.
 */

export const GHOST_ELEMENT_IDS = [
  // Landing page (/) — anchor-scrolled sections, same route
  'hero_headline',
  'captable_kpis',
  'captable_authorized',
  'captable_issued',
  'captable_diluted',
  'captable_last_round',
  'captable_ownership',
  'ownership_founders',
  'ownership_series_a',
  'ownership_seed',
  'ownership_esop',
  'ownership_sukuk',
  'captable_filings',
  'filing_moc',
  'filing_zatca',
  'filing_cma',
  'esop_section',
  'compliance_section',
  'instruments_section',
  'cta_button',
  'nav_language_toggle',
  'nav_sign_in',
  'nav_get_started',
  // /cap-table
  'captable_page_headline',
  'captable_page_features',
  'captable_page_cta',
  // /esop
  'esop_page_headline',
  'esop_page_features',
  'esop_page_cta',
  // /compliance
  'compliance_page_headline',
  'compliance_page_features',
  'compliance_page_notice',
  // /instruments
  'instruments_page_headline',
  'instruments_page_features',
  'instruments_page_cta',
  // Authenticated company app
  'app_captable_headline',
  'app_captable_summary',
  'app_captable_holdings',
  'app_stakeholders_headline',
  'app_stakeholders_add',
  'app_stakeholders_list',
  'app_filings_headline',
  'app_filings_list',
  'app_esop_headline',
  'app_esop_new',
  'app_esop_list',
  'app_instruments_headline',
  'app_instruments_new',
  'app_instruments_list',
  'app_prorata_headline',
  'app_prorata_add',
  'app_prorata_list',
] as const;

export type GhostElementId = (typeof GHOST_ELEMENT_IDS)[number];

export const GHOST_ROUTES: Partial<Record<GhostElementId, string>> = {
  hero_headline: '/',
  captable_kpis: '/',
  captable_authorized: '/',
  captable_issued: '/',
  captable_diluted: '/',
  captable_last_round: '/',
  captable_ownership: '/',
  ownership_founders: '/',
  ownership_series_a: '/',
  ownership_seed: '/',
  ownership_esop: '/',
  ownership_sukuk: '/',
  captable_filings: '/',
  filing_moc: '/',
  filing_zatca: '/',
  filing_cma: '/',
  esop_section: '/',
  compliance_section: '/',
  instruments_section: '/',
  cta_button: '/',
  nav_language_toggle: '/',
  captable_page_headline: '/cap-table',
  captable_page_features: '/cap-table',
  captable_page_cta: '/cap-table',
  esop_page_headline: '/esop',
  esop_page_features: '/esop',
  esop_page_cta: '/esop',
  compliance_page_headline: '/compliance',
  compliance_page_features: '/compliance',
  compliance_page_notice: '/compliance',
  instruments_page_headline: '/instruments',
  instruments_page_features: '/instruments',
  instruments_page_cta: '/instruments',
  app_captable_headline: '/companies/:companyId',
  app_captable_summary: '/companies/:companyId',
  app_captable_holdings: '/companies/:companyId',
  app_stakeholders_headline: '/companies/:companyId/stakeholders',
  app_stakeholders_add: '/companies/:companyId/stakeholders',
  app_stakeholders_list: '/companies/:companyId/stakeholders',
  app_filings_headline: '/companies/:companyId/filings',
  app_filings_list: '/companies/:companyId/filings',
  app_esop_headline: '/companies/:companyId/esop',
  app_esop_new: '/companies/:companyId/esop',
  app_esop_list: '/companies/:companyId/esop',
  app_instruments_headline: '/companies/:companyId/instruments',
  app_instruments_new: '/companies/:companyId/instruments',
  app_instruments_list: '/companies/:companyId/instruments',
  app_prorata_headline: '/companies/:companyId/pro-rata',
  app_prorata_add: '/companies/:companyId/pro-rata',
  app_prorata_list: '/companies/:companyId/pro-rata',
};

export function isGhostElementId(value: string): value is GhostElementId {
  return (GHOST_ELEMENT_IDS as readonly string[]).includes(value);
}

export function routeForGhost(elementId: string, currentPathname?: string): string | null {
  if (!isGhostElementId(elementId)) return null;
  const route = GHOST_ROUTES[elementId];
  if (!route) return null;
  if (!route.includes(':companyId')) return route;

  const companyId = currentPathname?.match(/^\/companies\/([^/]+)/)?.[1];
  return companyId ? route.replace(':companyId', companyId) : null;
}

export function queryGhost(elementId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(elementId) : elementId.replace(/[^a-zA-Z0-9_-]/g, '');
  return document.querySelector<HTMLElement>(`[data-ghost="${escaped}"], [data-qareen-target="${escaped}"]`);
}

/**
 * A press is allowed to activate only controls listed here. Most ghost targets
 * are explanatory cards/headings and must remain visual-only. Keeping this
 * allowlist in code prevents a model-generated press from submitting a form or
 * triggering an unrelated destructive button merely because it is tagged.
 *
 * `self` means the tagged node is the real control. A selector means the
 * tagged explanatory panel contains the safe control to activate.
 */
const SAFE_GHOST_ACTIVATIONS: Partial<Record<GhostElementId, 'self' | string>> = {
  cta_button: 'self',
  nav_language_toggle: 'self',
  nav_sign_in: 'self',
  nav_get_started: 'self',
  captable_page_cta: 'a[href]',
  esop_page_cta: 'a[href]',
  instruments_page_cta: 'a[href]',
  app_stakeholders_add: 'self',
  app_esop_new: 'self',
  app_instruments_new: 'self',
  app_prorata_add: 'self',
};

/** Returns the real, allowlisted control a worker-hand press may activate. */
export function activationControlForGhost(elementId: string, root: HTMLElement): HTMLElement | null {
  if (root.dataset.qareenSafeActivation === 'navigate' && root instanceof HTMLAnchorElement) return root;
  if (!isGhostElementId(elementId)) return null;
  const activation = SAFE_GHOST_ACTIVATIONS[elementId];
  if (!activation) return null;
  if (activation === 'self') return root;
  return root.querySelector<HTMLElement>(activation);
}

const SPOKEN_FACT_TARGETS: readonly { target: GhostElementId; pattern: RegExp }[] = [
  { target: 'captable_authorized', pattern: /\bauthori[sz]ed\b|\bten million\b/i },
  { target: 'captable_issued', pattern: /issued|outstanding|seven million|7[,.]842[,.]500/i },
  { target: 'captable_diluted', pattern: /fully diluted|eight million|8[,.]612[,.]500/i },
  { target: 'captable_last_round', pattern: /last priced|priced round|sar per share|forty-two|42[.]10|march 2026/i },
  { target: 'ownership_founders', pattern: /founder/i },
  { target: 'ownership_series_a', pattern: /series a investor|series a (?:hold|own|take|took)|twenty-two percent/i },
  { target: 'ownership_seed', pattern: /\bseed\b|fourteen percent/i },
  { target: 'ownership_esop', pattern: /esop pool|ten percent/i },
  { target: 'ownership_sukuk', pattern: /sukuk convertible|eight percent/i },
  { target: 'filing_moc', pattern: /annual return|art(?:icle)?[.]? 218|twenty-four days/i },
  { target: 'filing_zatca', pattern: /zakat|corporate tax|thirty-nine days/i },
  { target: 'filing_cma', pattern: /beneficial ownership|fifty-six days/i },
];

/**
 * Known sample facts use deterministic targets. Claude may still choose the
 * wording and broad section, but it cannot point "Founders" at the center of
 * the five-row ownership panel. Authenticated routes are deliberately excluded
 * so public sample phrases can never redirect a real company workspace.
 */
export function resolveSpokenGhostTarget(
  spokenText: string,
  proposedTarget: string | null,
  currentPathname?: string,
): string | null {
  if (currentPathname?.startsWith('/companies/')) return proposedTarget;

  return resolveSpokenGhostCues(spokenText, currentPathname)[0]?.target ?? proposedTarget;
}

export interface SpokenGhostCue {
  target: GhostElementId;
  onWord: number;
}

/** Returns every known fact in spoken order so a line containing two fixed
 * facts can visit both exact rows without asking Claude to choreograph it. */
export function resolveSpokenGhostCues(
  spokenText: string,
  currentPathname?: string,
): SpokenGhostCue[] {
  if (currentPathname?.startsWith('/companies/')) return [];

  const matches = SPOKEN_FACT_TARGETS.flatMap((rule) => {
    const match = rule.pattern.exec(spokenText);
    if (!match) return [];
    const before = spokenText.slice(0, match.index).trim();
    const onWord = before ? before.split(/\s+/).length : 0;
    return [{ target: rule.target, index: match.index, onWord }];
  });
  matches.sort((a, b) => a.index - b.index);
  return matches.map(({ target, onWord }) => ({ target, onWord }));
}

/**
 * Resolves an element once it's actually painted. A route change unmounts
 * the previous page's DOM before the new one mounts, so callers must wait
 * rather than query immediately after router.push().
 */
export function waitForGhost(elementId: string, timeoutMs = 2000): Promise<HTMLElement | null> {
  const existing = queryGhost(elementId);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const start = performance.now();

    function poll(): void {
      const el = queryGhost(elementId);
      if (el) {
        resolve(el);
        return;
      }
      if (performance.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(poll);
    }

    requestAnimationFrame(poll);
  });
}
