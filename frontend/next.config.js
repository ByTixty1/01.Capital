/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === 'development';

// CSP notes:
// - connect-src 'self': every API call goes through the same-origin
//   /api/backend proxy; the browser never talks to FastAPI directly.
// - style-src 'unsafe-inline': the landing page injects its stylesheet via a
//   <style> element and pages use inline style attributes.
// - script-src 'unsafe-inline': required by Next's bootstrap inline scripts.
//   Upgrading to nonce-based CSP (wired through src/proxy.ts) is logged as a
//   follow-up in REFACTOR_LOG.md.
// - img-src blob:/data:: MFA QR code is rendered from a blob URL.
// - font-src 'self': fonts are self-hosted at build time via next/font.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Qareen's browser speech recognition needs microphone access on our own
  // origin. Camera and geolocation remain disabled everywhere.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  ...(isDev
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
