import type { MotionEngineHandle } from './useMotionEngine';

/**
 * Bridges the single QareenOverlay's motion engine (a hook, lives inside a
 * component) to plain-module callers like the executor and debug panel.
 * Safe as a singleton: only one overlay is ever mounted, and every function
 * on the handle is a stable useCallback that reads fresh refs internally —
 * holding the object past a re-render never serves stale behavior.
 */
let engine: MotionEngineHandle | null = null;

export function setMotionEngine(handle: MotionEngineHandle | null): void {
  engine = handle;
}

export function getMotionEngine(): MotionEngineHandle | null {
  return engine;
}
