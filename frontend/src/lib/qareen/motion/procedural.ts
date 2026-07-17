import { clamp } from './tween';

/**
 * Per-frame procedural layers, ported verbatim from QAREEN_MOTION_SPEC.md's
 * render loop. All take `t` in seconds (rAF elapsed time / 1000) and are
 * pure — no state mutation, just the formulas from the spec.
 */

export function workerIdleY(t: number, busy: boolean): number {
  return (Math.sin(t * 1.1 + 2.3) * 6 + Math.sin(t * 3.7) * 1.4) * (busy ? 0 : 1);
}

export function speakerIdleY(t: number, busy: boolean): number {
  return (Math.sin(t * 0.9) * 7 + Math.sin(t * 3.1 + 0.5) * 1.5) * (busy ? 0.3 : 1);
}

export function workerIdleRot(t: number, busy = false): number {
  return busy ? 0 : Math.sin(t * 0.8 + 1) * 2.5;
}

export function speakerIdleRot(t: number): number {
  return Math.sin(t * 0.65) * 2.2;
}

export interface Banking {
  bankY: number;
  bankX: number;
}

/** Worker tilts INTO its travel direction based on frame-to-frame velocity. */
export function velocityBanking(vx: number, vy: number): Banking {
  return {
    bankY: clamp(vx * 1.4, -26, 26),
    bankX: clamp(-vy * 1.2, -20, 20),
  };
}

export interface AltitudeEffect {
  scaleBonus: number;
  shadowScale: number;
  shadowOpacity: number;
  shadowOffsetY: number;
}

export function altitudeEffect(alt: number): AltitudeEffect {
  return {
    scaleBonus: alt * 0.003,
    shadowScale: Math.max(0.4, 1 - alt * 0.012),
    shadowOpacity: Math.max(0.1, 0.4 - alt * 0.008),
    shadowOffsetY: alt * 0.7,
  };
}

export function talkScale(t: number, talking: boolean): number {
  return talking ? 1 + Math.sin(t * 6.5) * 0.03 : 1;
}

export function drumOffset(t: number, drumming: boolean): number {
  return drumming ? Math.sin(t * 10) * 3 : 0;
}

export interface FineDrift {
  dx: number;
  dy: number;
}

/** Always-on fine drift, gated to zero while the hand is executing a move. */
export function fineDrift(t: number, seed: number, amp: number, busy: boolean): FineDrift {
  const gate = busy ? 0 : 1;
  return {
    dx: (Math.sin(t * 0.23 + seed) * amp + Math.sin(t * 0.07 + seed * 2) * amp * 0.9) * gate,
    dy: (Math.cos(t * 0.19 + seed * 1.3) * amp * 0.7 + Math.sin(t * 0.11 + seed) * amp * 0.5) * gate,
  };
}
