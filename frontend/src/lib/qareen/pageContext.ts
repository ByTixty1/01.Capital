'use client';

export interface PageElementContext {
  target_id: string;
  role: string;
  label: string;
  tag: string;
  interactive: boolean;
  action: string;
  href: string | null;
  position: string;
  x_percent: number;
  y_percent: number;
  appearance: string;
  disabled: boolean;
  current: boolean;
}

export interface QareenPageContext {
  pathname: string;
  title: string;
  viewport: { width: number; height: number; scroll_y: number };
  elements: PageElementContext[];
}

const CANDIDATE_SELECTOR = [
  '[data-ghost]',
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  'h1',
  'h2',
  'h3',
].join(',');

const MAX_ELEMENTS = 120;
const MAX_LABEL_LENGTH = 140;

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL_LENGTH);
}

function labelFor(element: HTMLElement): string {
  const ariaLabel = cleanText(element.getAttribute('aria-label'));
  if (ariaLabel) return ariaLabel;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    const labels = Array.from(element.labels ?? []).map((label) => cleanText(label.textContent)).filter(Boolean);
    if (labels.length) return labels.join(' / ').slice(0, MAX_LABEL_LENGTH);
    const placeholder = cleanText(element.getAttribute('placeholder'));
    if (placeholder) return placeholder;
  }

  // textContent preserves the semantic label; innerText applies CSS
  // text-transform and would report e.g. "SIGN IN" instead of "Sign in".
  return cleanText(element.textContent || element.innerText || element.getAttribute('title'));
}

function structuralLabel(targetId: string): string {
  return targetId.replace(/^app_/, '').replace(/_/g, ' ');
}

function roleFor(element: HTMLElement): string {
  const explicit = element.getAttribute('role');
  if (explicit) return explicit;
  if (element instanceof HTMLAnchorElement) return 'link';
  if (element instanceof HTMLButtonElement) return 'button';
  if (element instanceof HTMLInputElement) return element.type === 'checkbox' || element.type === 'radio' ? element.type : 'textbox';
  if (element instanceof HTMLTextAreaElement) return 'textbox';
  if (element instanceof HTMLSelectElement) return 'combobox';
  if (/^H[1-6]$/.test(element.tagName)) return 'heading';
  return 'region';
}

function isRendered(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42) || 'unnamed';
}

function targetIdFor(element: HTMLElement, role: string, label: string, used: Map<string, number>): string {
  const tagged = element.dataset.ghost;
  if (tagged) return tagged;

  const base = `page_${slug(role)}_${slug(label)}`;
  const count = (used.get(base) ?? 0) + 1;
  used.set(base, count);
  return count === 1 ? base : `${base}_${count}`;
}

function parseRgb(value: string): [number, number, number, number] | null {
  const match = value.match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])];
}

const COLOR_PALETTE: readonly [string, number, number, number][] = [
  ['black', 10, 10, 12], ['white', 245, 245, 245], ['gray', 135, 135, 145],
  ['red', 220, 55, 65], ['orange', 230, 130, 45], ['yellow', 225, 195, 55],
  ['green', 45, 175, 95], ['cyan', 35, 195, 205], ['blue', 55, 115, 220],
  ['purple', 139, 92, 246], ['pink', 220, 85, 160],
];

function colorName(value: string): string {
  const rgba = parseRgb(value);
  if (!rgba || rgba[3] < 0.08) return 'transparent';
  const [r, g, b] = rgba;
  let nearest = COLOR_PALETTE[0]!;
  let distance = Number.POSITIVE_INFINITY;
  for (const candidate of COLOR_PALETTE) {
    const next = (r - candidate[1]) ** 2 + (g - candidate[2]) ** 2 + (b - candidate[3]) ** 2;
    if (next < distance) {
      distance = next;
      nearest = candidate;
    }
  }
  return nearest[0];
}

function actionFor(element: HTMLElement): string {
  if (element instanceof HTMLAnchorElement) {
    try {
      const url = new URL(element.href, window.location.href);
      return url.origin === window.location.origin ? `navigate:${url.pathname}${url.search}` : 'external-link';
    } catch {
      return 'link';
    }
  }
  if (element instanceof HTMLButtonElement) {
    return element.type === 'submit' && element.form ? 'submit' : 'button';
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return 'input';
  }
  return 'explain';
}

function positionFor(rect: DOMRect): string {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const horizontal = x < window.innerWidth / 3 ? 'left' : x > window.innerWidth * 2 / 3 ? 'right' : 'center';
  if (y < 0) return `above viewport, ${horizontal}`;
  if (y > window.innerHeight) return `below viewport, ${horizontal}`;
  const vertical = y < window.innerHeight / 3 ? 'top' : y > window.innerHeight * 2 / 3 ? 'bottom' : 'middle';
  return `${vertical} ${horizontal}`;
}

function mayAutoNavigate(element: HTMLElement, action: string): boolean {
  if (!(element instanceof HTMLAnchorElement) || !action.startsWith('navigate:')) return false;
  const path = action.slice('navigate:'.length).split('?')[0];
  return Boolean(path && path !== '/logout' && element.getAttribute('download') === null);
}

/**
 * Builds a compact, sanitized accessibility-style snapshot for Claude.
 * Values typed into fields and untagged customer table/body text are never
 * included. Auto targets live only for the current rendered document.
 */
export function collectQareenPageContext(): QareenPageContext {
  document.querySelectorAll<HTMLElement>('[data-qareen-auto-target="true"]').forEach((element) => {
    delete element.dataset.qareenTarget;
    delete element.dataset.qareenAutoTarget;
    delete element.dataset.qareenSafeActivation;
  });

  const used = new Map<string, number>();
  const elements: PageElementContext[] = [];
  const candidates = document.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR);

  for (const element of candidates) {
    if (elements.length >= MAX_ELEMENTS) break;
    if (element.closest('[data-testid="qareen-presence"]') || !isRendered(element)) continue;

    // Do not sweep customer rows/holdings into a third-party model merely
    // because their parent list is rendered. The structural container itself
    // remains available below with an ID-derived label.
    const privateList = element.closest<HTMLElement>(
      '[data-ghost^="app_"][data-ghost$="_list"], [data-ghost="app_captable_holdings"]',
    );
    if (privateList && privateList !== element) continue;

    const taggedId = element.dataset.ghost;
    const role = roleFor(element);
    const isInteractive = ['link', 'button', 'textbox', 'combobox', 'tab', 'menuitem', 'checkbox', 'radio'].includes(role);
    const label = taggedId?.startsWith('app_') && !isInteractive
      ? structuralLabel(taggedId)
      : labelFor(element);
    if (!label) continue;

    const targetId = targetIdFor(element, role, label, used);
    if (!element.dataset.ghost) {
      element.dataset.qareenTarget = targetId;
      element.dataset.qareenAutoTarget = 'true';
    }

    const action = actionFor(element);
    if (mayAutoNavigate(element, action)) element.dataset.qareenSafeActivation = 'navigate';

    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const interactive = isInteractive;
    let href: string | null = null;
    if (element instanceof HTMLAnchorElement) {
      try {
        const url = new URL(element.href, window.location.href);
        href = url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : url.href;
      } catch {
        href = element.getAttribute('href');
      }
    }
    const ariaCurrent = element.getAttribute('aria-current');
    const disabled = (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
      ? element.disabled
      : element.getAttribute('aria-disabled') === 'true';

    elements.push({
      target_id: targetId,
      role,
      label,
      tag: element.tagName.toLowerCase(),
      interactive,
      action,
      href,
      position: positionFor(rect),
      x_percent: Math.round(((rect.left + rect.width / 2) / window.innerWidth) * 100),
      y_percent: Math.round(((rect.top + rect.height / 2) / window.innerHeight) * 100),
      appearance: `${colorName(style.color)} text, ${colorName(style.backgroundColor)} background, ${colorName(style.borderColor)} border`,
      disabled,
      current: ariaCurrent === 'page' || element.dataset.active === '1',
    });
  }

  return {
    pathname: window.location.pathname,
    title: document.title,
    viewport: { width: window.innerWidth, height: window.innerHeight, scroll_y: Math.round(window.scrollY) },
    elements,
  };
}
