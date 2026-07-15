'use client';

// Animated number counter — modeled on React Bits' CountUp, reimplemented in the
// 01 Capital idiom: no Framer Motion / runtime deps, mono + tabular figures, and
// it reuses the shared `formatNumber` helper so SAR/locale behaviour stays
// consistent (CLAUDE.md rule 4 + 5). Respects prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatNumber } from '@/lib/format';

export interface CountUpProps {
  /** Target value to count to. */
  to: number;
  /** Starting value. Defaults to 0. */
  from?: number;
  /** Animation duration in milliseconds. Defaults to 1200. */
  duration?: number;
  /** Delay before counting starts, in milliseconds. Defaults to 0. */
  delay?: number;
  /** Fixed fraction digits. Ignored when `format` is supplied. */
  decimals?: number;
  /**
   * Custom formatter for the displayed value. Defaults to the shared
   * `formatNumber` helper. Pass `formatSAR` / a percent formatter for those.
   */
  format?: (value: number) => string;
  /** Start the count when the element scrolls into view. Defaults to true. */
  startOnView?: boolean;
  /** Fired once when the animation begins. */
  onStart?: () => void;
  /** Fired once when the animation completes. */
  onEnd?: () => void;
  className?: string;
  style?: CSSProperties;
}

// ease-out cubic — quick start, gentle settle; matches the product's calm motion.
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function CountUp({
  to,
  from = 0,
  duration = 1200,
  delay = 0,
  decimals,
  format,
  startOnView = true,
  onStart,
  onEnd,
  className,
  style,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);

  // Keep callbacks current without re-running the animation effect.
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
  });

  useEffect(() => {
    const node = ref.current;
    if (node == null) return;

    let frame = 0;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = () => {
      onStartRef.current?.();
      if (reduceMotion) {
        setValue(to);
        onEndRef.current?.();
        return;
      }
      const begin = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const t = Math.min((now - begin) / duration, 1);
        setValue(from + (to - from) * easeOutCubic(t));
        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          onEndRef.current?.();
        }
      };
      frame = requestAnimationFrame(tick);
    };

    const begin = () => {
      startTimer = setTimeout(animate, delay);
    };

    if (!startOnView) {
      begin();
      return () => {
        cancelled = true;
        if (startTimer) clearTimeout(startTimer);
        cancelAnimationFrame(frame);
      };
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          obs.disconnect();
          begin();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      if (startTimer) clearTimeout(startTimer);
      cancelAnimationFrame(frame);
    };
  }, [to, from, duration, delay, startOnView]);

  const display =
    format != null
      ? format(value)
      : formatNumber(
          value,
          decimals != null
            ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
            : undefined,
        );

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {display}
    </span>
  );
}
