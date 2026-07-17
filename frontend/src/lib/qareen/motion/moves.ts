import { clamp, tween } from './tween';
import type { WorkerHandState, SpeakerHandState } from './handState';
import type { Beat, HandPose } from '../types';

export interface WorkerMoveCallbacks {
  setPose?: (pose: HandPose) => void;
  onImpact?: () => void;
}

/** glide(target): lift with anticipation -> curved cruise -> descend. */
export async function glideWorker(w: WorkerHandState, targetX: number, targetY: number): Promise<void> {
  const dirX = targetX - w.x;
  const dirY = targetY - w.y;
  const mag = Math.hypot(dirX, dirY) || 1;
  const anticipation = -12;
  const antX = w.x + (dirX / mag) * anticipation;
  const antY = w.y + (dirY / mag) * anticipation;

  await tween(w, { z: 26, x: antX, y: antY }, 140, 'out');

  // Distance-based, bounded travel keeps the hand's apparent speed stable
  // without introducing random timing variance between identical commands.
  const cruiseMs = clamp(420 + mag * 0.45, 520, 780);
  await Promise.all([
    tween(w, { x: targetX }, cruiseMs, 'inOut'),
    tween(w, { y: targetY }, cruiseMs, 'spring'),
    tween(w, { s: 0.58 }, 700, 'inOut'),
  ]);

  await tween(w, { z: 6 }, 140, 'out');
}

/** press(target): glide + wind-up + slam + impact pulse + rebound. */
export async function pressWorker(
  w: WorkerHandState,
  targetX: number,
  targetY: number,
  callbacks: WorkerMoveCallbacks = {}
): Promise<void> {
  await glideWorker(w, targetX, targetY);

  callbacks.setPose?.('tap');
  await tween(w, { z: 34 }, 120, 'out');
  await tween(w, { z: -6, s: 0.52, rx: 14 }, 90, 'out');
  callbacks.onImpact?.();
  await tween(w, { z: 10, s: 0.6, rx: 0 }, 220, 'spring');
  callbacks.setPose?.('point');
}

/**
 * Per-character typing bob for hand liveliness. Value application is the
 * caller's job (writes into the Zustand formDraft store per character) —
 * this only drives the hand's z-dip/recover motion and delay timing.
 */
export async function typeWorkerChar(w: WorkerHandState, charIndex: number): Promise<void> {
  if (charIndex % 3 === 2) {
    await tween(w, { z: w.z - 3 }, 40, 'out');
    await tween(w, { z: w.z + 8 }, 60, 'out');
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 64));
}

/** home(): lift -> curved return -> settle. */
export async function homeWorker(
  w: WorkerHandState,
  home: { x: number; y: number },
  restRz = 0
): Promise<void> {
  await tween(w, { z: 26 }, 150, 'out');
  const ms = 700;
  await Promise.all([
    tween(w, { x: home.x }, ms, 'inOut'),
    tween(w, { y: home.y }, ms, 'spring'),
    tween(w, { s: 1 }, ms, 'inOut'),
  ]);
  await tween(w, { z: 0, rz: restRz }, 220, 'out');
}

/** retreat(): fast home at 60% duration — a reaction move (barge-in). */
export async function retreatWorker(
  w: WorkerHandState,
  home: { x: number; y: number },
  restRz = 0
): Promise<void> {
  await tween(w, { z: 26 }, 90, 'out');
  const ms = 420;
  await Promise.all([
    tween(w, { x: home.x }, ms, 'inOut'),
    tween(w, { y: home.y }, ms, 'spring'),
    tween(w, { s: 1 }, ms, 'inOut'),
  ]);
  await tween(w, { z: 0, rz: restRz }, 132, 'out');
}

/**
 * Gesticulation beat for the speaker hand — 2-4 fire per line, spread
 * across the line's audio (or evenly if no word timings exist).
 */
export async function runSpeakerBeat(
  sp: SpeakerHandState,
  beat: Beat,
  setPose?: (pose: HandPose) => void
): Promise<void> {
  setPose?.(beat.pose);

  const tasks: Promise<void>[] = [];

  if (beat.tilt !== null) {
    tasks.push(tween(sp, { rz: beat.tilt }, 260, 'out'));
  }
  if (beat.lean !== null) {
    tasks.push(tween(sp, { ry: beat.lean }, 260, 'out'));
  }
  if (beat.emph) {
    tasks.push(
      (async () => {
        await tween(sp, { sc: 1.12 }, 110, 'out');
        await tween(sp, { sc: 1 }, 170, 'spring');
      })()
    );
  }
  if (beat.raise) {
    const baseY = sp.y;
    tasks.push(
      (async () => {
        await tween(sp, { y: baseY - 16 }, 150, 'out');
        await tween(sp, { y: baseY }, 300, 'spring');
      })()
    );
  }
  if (beat.drift) {
    const [dx, dy] = beat.drift;
    tasks.push(tween(sp, { x: sp.x + dx, y: sp.y + dy }, 600, 'inOut'));
  }

  await Promise.all(tasks);
}
