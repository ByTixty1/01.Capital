/**
 * Transient press-impact feedback on whatever real page element the worker
 * hand just pointed at — 3px cyan outline + a slight scale pop, 120ms per
 * QAREEN_MOTION_SPEC.md. Mutates inline styles directly and restores them;
 * scoped to a single element for a moment, not a persistent visual system.
 */
export function pulseGhostElement(el: HTMLElement): void {
  const prev = {
    outline: el.style.outline,
    outlineOffset: el.style.outlineOffset,
    transform: el.style.transform,
    transition: el.style.transition,
  };

  el.style.transition = 'outline-color 120ms ease, transform 120ms ease';
  el.style.outline = '3px solid #22d3ee';
  el.style.outlineOffset = '2px';
  el.style.transform = 'scale(1.035)';

  window.setTimeout(() => {
    el.style.outline = prev.outline;
    el.style.outlineOffset = prev.outlineOffset;
    el.style.transform = prev.transform;
    window.setTimeout(() => {
      el.style.transition = prev.transition;
    }, 130);
  }, 120);
}
