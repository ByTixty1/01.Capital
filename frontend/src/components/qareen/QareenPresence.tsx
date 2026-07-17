'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQareenHydration, useQareenStore } from '@/lib/qareen/store';
import { setQareenRouter } from '@/lib/qareen/routerRegistry';

// ssr:false matches the existing MetaballCanvas/PageBackground convention —
// avoids SSR/hydration mismatch for anything reading sessionStorage or
// running a requestAnimationFrame loop.
const ChatPanel = dynamic(
  () => import('./ChatPanel').then((m) => m.ChatPanel),
  { ssr: false }
);
const QareenOverlay = dynamic(
  () => import('./QareenOverlay').then((m) => m.QareenOverlay),
  { ssr: false }
);
const FloatingControls = dynamic(
  () => import('./FloatingControls').then((m) => m.FloatingControls),
  { ssr: false }
);
const DebugPanel = dynamic(
  () => import('./DebugPanel').then((m) => m.DebugPanel),
  { ssr: false }
);

/**
 * Mounted once in the root layout (see ADR-0010) so Qareen is available
 * across the real product, not just an isolated demo route. Starts
 * dismissed — a nav icon (see page.tsx) brings it up in place, on
 * whatever page the user is already on.
 *
 * Fully unmounted (not just hidden) while dismissed: the motion engine
 * runs a persistent rAF loop and FloatingControls attaches global
 * spacebar push-to-talk listeners — those must not run site-wide on
 * every real page for a user who never opened Qareen.
 */
export function QareenPresence() {
  const hasHydrated = useQareenHydration();
  const summoned = useQareenStore((s) => s.summoned);
  const router = useRouter();

  useEffect(() => {
    setQareenRouter(router);
    return () => setQareenRouter(null);
  }, [router]);

  if (!hasHydrated || !summoned) return null;

  return (
    <div data-testid="qareen-presence">
      <QareenOverlay />
      <ChatPanel />
      <FloatingControls />
      <DebugPanel />
    </div>
  );
}
