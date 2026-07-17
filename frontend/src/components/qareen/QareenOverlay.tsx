'use client';

import { useEffect, useRef, useState } from 'react';
import { useMotionEngine } from '@/lib/qareen/motion/useMotionEngine';
import { setMotionEngine } from '@/lib/qareen/motion/engineRegistry';
import { HandGlyph } from './HandGlyph';
import type { HandPose } from '@/lib/qareen/types';

const POSE_FADE_MS = 110;

/** Fades a hand to 0.3 opacity for POSE_FADE_MS whenever its pose changes. */
function usePoseFadeOpacity(pose: HandPose): number {
  const [opacity, setOpacity] = useState(1);
  const prevPose = useRef(pose);

  useEffect(() => {
    if (prevPose.current === pose) return;
    prevPose.current = pose;
    setOpacity(0.3);
    const timer = setTimeout(() => setOpacity(1), POSE_FADE_MS);
    return () => clearTimeout(timer);
  }, [pose]);

  return opacity;
}

export function QareenOverlay() {
  const stageRef = useRef<HTMLDivElement>(null);
  const engine = useMotionEngine(stageRef);

  useEffect(() => {
    setMotionEngine(engine);
    return () => setMotionEngine(null);
    // Intentionally empty deps: every function on `engine` is a stable
    // useCallback that reads fresh refs — see engineRegistry.ts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const workerOpacity = usePoseFadeOpacity(engine.workerPose);
  const speakerOpacity = usePoseFadeOpacity(engine.speakerPose);

  return (
    <div
      ref={stageRef}
      data-testid="qareen-stage"
      style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', perspective: 900 }}
    >
      <div
        data-testid="worker-hand-anchor"
        style={{ position: 'absolute', left: 0, top: 0, transform: engine.worker.positionTransform, transformStyle: 'preserve-3d' }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -30,
            top: 44,
            width: 60,
            height: 16,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
            opacity: engine.worker.shadowOpacity,
            transform: engine.worker.shadowTransform,
          }}
        />
        <div
          data-testid="worker-hand"
          style={{
            transform: engine.worker.handTransform,
            transformStyle: 'preserve-3d',
            opacity: workerOpacity,
            transition: 'opacity 110ms ease',
            transformOrigin: '48px 90px',
          }}
        >
          {/* A zero-visual calibration point at the point-pose fingertip.
              Unlike SVG getScreenCTM(), getBoundingClientRect() on this HTML
              point includes the parent CSS transforms consistently in Safari. */}
          <span
            data-testid="worker-fingertip"
            style={{
              position: 'absolute',
              left: 38,
              top: 12,
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
            }}
          />
          <HandGlyph pose={engine.workerPose} />
        </div>
      </div>

      <div
        data-testid="speaker-hand-anchor"
        style={{ position: 'absolute', left: 0, top: 0, transform: engine.speaker.positionTransform, transformStyle: 'preserve-3d' }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: -30,
            top: 44,
            width: 60,
            height: 16,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.4), transparent 70%)',
            opacity: engine.speaker.shadowOpacity,
            transform: engine.speaker.shadowTransform,
          }}
        />
        <div
          data-testid="speaker-hand"
          style={{
            transform: engine.speaker.handTransform,
            transformStyle: 'preserve-3d',
            opacity: speakerOpacity,
            transition: 'opacity 110ms ease',
            transformOrigin: '48px 90px',
          }}
        >
          <HandGlyph pose={engine.speakerPose} mirrored />
        </div>
      </div>
    </div>
  );
}
