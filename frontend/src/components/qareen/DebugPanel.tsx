'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getMotionEngine } from '@/lib/qareen/motion/engineRegistry';
import { GHOST_ELEMENT_IDS, queryGhost } from '@/lib/qareen/ghostRegistry';
import { pulseGhostElement } from '@/lib/qareen/motion/impactPulse';

/**
 * ?debug=1 panel with manual buttons + key bindings to trigger motion
 * primitives directly, isolated from the brain/TTS round trip. Exists for
 * real engineering reasons (isolating motion bugs) and doubles as the
 * Playwright test surface for Phase 2 verification.
 */
export function DebugPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [presentGhosts, setPresentGhosts] = useState<string[]>([]);

  useEffect(() => {
    // Deferred one frame: the new route's DOM commits after this effect
    // fires, so read it from a rAF callback rather than synchronously here.
    const raf = requestAnimationFrame(() => {
      setPresentGhosts(GHOST_ELEMENT_IDS.filter((id) => queryGhost(id) !== null));
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const engine = getMotionEngine();
      if (!engine) return;
      const firstTarget = presentGhosts[0] ? queryGhost(presentGhosts[0]) : null;

      if (e.key === 'g' && firstTarget) void engine.glideWorkerTo(firstTarget);
      if (e.key === 'p' && firstTarget) void engine.pressWorkerAt(firstTarget, () => pulseGhostElement(firstTarget));
      if (e.key === 'h') void engine.homeWorkerHand();
      if (e.key === 'r') void engine.retreatWorkerHand();
      if (e.key === 'f') engine.freeze();
      if (e.key === 'u') engine.unfreeze();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentGhosts]);

  if (searchParams.get('debug') !== '1') return null;

  function trigger(action: 'glide' | 'press' | 'type', ghostId: string): void {
    const engine = getMotionEngine();
    const el = queryGhost(ghostId);
    if (!engine || !el) return;
    if (action === 'glide') void engine.glideWorkerTo(el);
    if (action === 'press') void engine.pressWorkerAt(el, () => pulseGhostElement(el));
    if (action === 'type' && el instanceof HTMLInputElement) {
      void engine.typeWorkerAt(el, 'Ali Alharbi', () => {});
    }
  }

  return (
    <div
      data-testid="debug-panel"
      className="glass-panel"
      style={{ position: 'fixed', top: 72, left: 24, zIndex: 70, padding: 16, width: 260, maxHeight: 'calc(100vh - 96px)', overflowY: 'auto', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Motion debug (keys: g p h r f u)</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {presentGhosts.map((id) => (
          <div key={id} style={{ display: 'flex', gap: 4 }}>
            <button type="button" data-testid={`debug-glide-${id}`} className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => trigger('glide', id)}>
              glide:{id}
            </button>
            <button type="button" data-testid={`debug-press-${id}`} className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => trigger('press', id)}>
              press
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" data-testid="debug-home" className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => void getMotionEngine()?.homeWorkerHand()}>
          home
        </button>
        <button type="button" data-testid="debug-retreat" className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => void getMotionEngine()?.retreatWorkerHand()}>
          retreat
        </button>
        <button type="button" data-testid="debug-freeze" className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => getMotionEngine()?.freeze()}>
          freeze
        </button>
        <button type="button" data-testid="debug-unfreeze" className="btn-primary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => getMotionEngine()?.unfreeze()}>
          unfreeze
        </button>
      </div>

    </div>
  );
}
