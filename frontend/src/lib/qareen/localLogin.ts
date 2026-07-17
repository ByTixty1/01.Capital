'use client';

export type LocalCredentialRequest =
  | { kind: 'complete'; route: 'login'; email: string; password: string }
  | { kind: 'complete'; route: 'register'; fullName: string; email: string; password: string }
  | { kind: 'incomplete'; route: 'login' | 'register' };

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PASSWORD_PATTERN = /\b(?:password|pass)\s*(?:is\s+|[:=]\s*)?(?:"([^"]+)"|'([^']+)'|(\S+))/i;
const FULL_NAME_PATTERN = /\b(?:full\s+name|name)\s*(?:is\s+|[:=]\s*)?(?:"([^"]+)"|'([^']+)'|(.+?))(?=\s*[,;]?\s+(?:and\s+)?(?:my\s+)?(?:email|password|pass)\b|$)/i;

/**
 * Recognises credentials only on the real login route. The returned values
 * are consumed in browser memory and must never be added to Qareen history,
 * persisted state, page context, analytics, or a backend request.
 */
export function parseLocalCredentialRequest(message: string, pathname: string): LocalCredentialRequest | null {
  if (pathname !== '/login' && pathname !== '/register') return null;
  const route = pathname === '/login' ? 'login' : 'register';

  const email = message.match(EMAIL_PATTERN)?.[0] ?? null;
  const passwordMatch = message.match(PASSWORD_PATTERN);
  const password = passwordMatch
    ? (passwordMatch[1] ?? passwordMatch[2] ?? passwordMatch[3] ?? '').trim()
    : null;
  const nameMatch = message.match(FULL_NAME_PATTERN);
  const fullName = nameMatch
    ? (nameMatch[1] ?? nameMatch[2] ?? nameMatch[3] ?? '').trim().replace(/[,;]\s*$/, '')
    : null;

  // Any credential-shaped fragment is intercepted locally. This prevents an
  // incomplete email/password message from falling through to Claude.
  if (!email && !password) return null;
  if (!email || !password || (route === 'register' && !fullName)) return { kind: 'incomplete', route };
  if (route === 'register') return { kind: 'complete', route, fullName: fullName!, email, password };
  return { kind: 'complete', route, email, password };
}

/** Applies a value through the native setter and input event so React's
 * controlled login fields update their component state exactly as user input
 * would. The value is deliberately never returned or stored elsewhere. */
export function setControlledTextValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
