/**
 * Tween core, ported verbatim from QAREEN_MOTION_SPEC.md. Constants are
 * tuned and approved — do not re-tune the easing curves or the exponents.
 */

export type EaseName = 'inOut' | 'spring' | 'out';

export const eases: Record<EaseName, (x: number) => number> = {
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  spring: (x) => 1 - Math.pow(2.718, -6 * x) * Math.cos(9 * x),
  out: (x) => 1 - Math.pow(1 - x, 3),
};

/** Numeric-valued keys of T — works for plain interfaces, not just Record<string, number>. */
type NumericPartial<T> = Partial<{ [K in keyof T]: number }>;

/**
 * Tweens the given numeric keys of `target` toward `to` over `ms`.
 * Curved paths come from calling this twice on the same object with
 * different eases per axis (e.g. x:'inOut', y:'spring') and letting both
 * run concurrently via Promise.all — never move two axes with the same
 * ease, a straight line reads as dead motion.
 */
export function tween<T extends object>(
  target: T,
  to: NumericPartial<T>,
  ms: number,
  ease: EaseName = 'inOut'
): Promise<void> {
  const mutableTarget = target as Record<string, number>;
  const keys = Object.keys(to);
  const from: Record<string, number> = {};
  for (const key of keys) {
    from[key] = mutableTarget[key] as number;
  }

  return new Promise((resolve) => {
    const t0 = performance.now();

    function frame(now: number): void {
      const p = Math.min(1, (now - t0) / ms);
      const v = eases[ease](p);
      for (const key of keys) {
        const fromValue = from[key] as number;
        const toValue = (to as Record<string, number>)[key] as number;
        mutableTarget[key] = fromValue + (toValue - fromValue) * v;
      }
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
