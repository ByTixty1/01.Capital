'use client';

export type LocalLoginRequest =
  | { kind: 'complete'; email: string; password: string }
  | { kind: 'incomplete' };

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PASSWORD_PATTERN = /\b(?:password|pass)\s*(?:is\s+|[:=]\s*)?(?:"([^"]+)"|'([^']+)'|(\S+))/i;

/**
 * Recognises credentials only on the real login route. The returned values
 * are consumed in browser memory and must never be added to Qareen history,
 * persisted state, page context, analytics, or a backend request.
 */
export function parseLocalLoginRequest(message: string, pathname: string): LocalLoginRequest | null {
  if (pathname !== '/login') return null;

  const email = message.match(EMAIL_PATTERN)?.[0] ?? null;
  const passwordMatch = message.match(PASSWORD_PATTERN);
  const password = passwordMatch
    ? (passwordMatch[1] ?? passwordMatch[2] ?? passwordMatch[3] ?? '').trim()
    : null;

  // Any credential-shaped fragment is intercepted locally. This prevents an
  // incomplete email/password message from falling through to Claude.
  if (!email && !password) return null;
  if (!email || !password) return { kind: 'incomplete' };
  return { kind: 'complete', email, password };
}

/** Applies a value through the native setter and input event so React's
 * controlled login fields update their component state exactly as user input
 * would. The value is deliberately never returned or stored elsewhere. */
export function setControlledInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
