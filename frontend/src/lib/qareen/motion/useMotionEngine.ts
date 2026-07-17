'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  initialWorkerState,
  initialSpeakerState,
  workerHome,
  speakerHome,
  type WorkerHandState,
  type SpeakerHandState,
  type StageSize,
} from './handState';
import {
  workerIdleY,
  speakerIdleY,
  workerIdleRot,
  speakerIdleRot,
  velocityBanking,
  altitudeEffect,
  talkScale,
  drumOffset,
  fineDrift,
} from './procedural';
import {
  glideWorker,
  pressWorker,
  homeWorker,
  retreatWorker,
  typeWorkerChar,
  runSpeakerBeat,
  type WorkerMoveCallbacks,
} from './moves';
import { clamp, tween } from './tween';
import type { Beat, HandPose } from '../types';

const WORKER_DRIFT_AMP = 11;
const SPEAKER_DRIFT_AMP = 10;
// The motion state positions the SVG wrapper's top-left, while the visible
// index fingertip sits roughly 43px right / 48px down at guidance scale.
// Compensate so the fingertip, rather than the invisible wrapper corner,
// lands on the real element's center.
const POINTER_OFFSET_X = 43;
const POINTER_OFFSET_Y = 48;

interface HandRenderState {
  /** translate3d only — shared baseline the shadow anchors to. */
  positionTransform: string;
  /** rotate/scale only — applied to the glyph, not the shadow. */
  handTransform: string;
  shadowTransform: string;
  shadowOpacity: number;
}

export interface MotionEngineHandle {
  worker: HandRenderState;
  speaker: HandRenderState;
  workerPose: HandPose;
  speakerPose: HandPose;
  talking: boolean;
  setTalking: (value: boolean) => void;
  drumming: boolean;
  setDrumming: (value: boolean) => void;
  frozen: boolean;
  freeze: () => void;
  unfreeze: () => void;
  glideWorkerTo: (el: HTMLElement) => Promise<void>;
  pressWorkerAt: (el: HTMLElement, onImpact?: () => void) => Promise<void>;
  typeWorkerAt: (el: HTMLElement, text: string, onChar: (char: string, index: number) => void) => Promise<void>;
  homeWorkerHand: () => Promise<void>;
  retreatWorkerHand: () => Promise<void>;
  runBeat: (beat: Beat) => Promise<void>;
}

function workerAnchorForElement(el: HTMLElement, stageEl: HTMLElement): { x: number; y: number } {
  const targetRect = el.getBoundingClientRect();
  const stageRect = stageEl.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2 - stageRect.left;
  const targetY = targetRect.top + targetRect.height / 2 - stageRect.top;
  return {
    // Clamp the visible fingertip, not the 96px transparent SVG wrapper.
    // Edge controls (notably Sign in at the top-right) otherwise stop one
    // glyph-width early and appear to point at their neighbour.
    x: clamp(targetX - POINTER_OFFSET_X, -POINTER_OFFSET_X, stageRect.width - POINTER_OFFSET_X),
    y: clamp(targetY - POINTER_OFFSET_Y, -POINTER_OFFSET_Y, stageRect.height - POINTER_OFFSET_Y),
  };
}

/**
 * Owns both hand state objects and the single rAF render loop, ported from
 * QAREEN_MOTION_SPEC.md. Position state lives in refs (not React state) —
 * 60fps updates go straight to CSS transforms via style refs, bypassing
 * React's render cycle. Only pose (changes a few times/sec) is React state.
 */
export function useMotionEngine(stageRef: React.RefObject<HTMLDivElement | null>) {
  const workerRef = useRef<WorkerHandState>(initialWorkerState({ width: 0, height: 0 }));
  const speakerRef = useRef<SpeakerHandState>(initialSpeakerState({ width: 0, height: 0 }));
  const lastWorkerPos = useRef({ x: 0, y: 0 });
  // useState's lazy initializer is the sanctioned place for an impure call
  // like Math.random() — a plain useRef(Math.random()) would re-evaluate
  // the expression's purity on every render per the purity lint rule.
  const [seeds] = useState(() => ({ worker: Math.random() * 1000, speaker: Math.random() * 1000 }));
  const workerBusyRef = useRef(false);
  const workerPinnedRef = useRef(false);
  const speakerBusyRef = useRef(false);
  const frozenRef = useRef(false);
  const talkingRef = useRef(false);
  const drummingRef = useRef(false);

  const [render, setRender] = useState<{ worker: HandRenderState; speaker: HandRenderState }>({
    worker: { positionTransform: '', handTransform: '', shadowTransform: '', shadowOpacity: 0 },
    speaker: { positionTransform: '', handTransform: '', shadowTransform: '', shadowOpacity: 0 },
  });
  const [workerPose, setWorkerPose] = useState<HandPose>('relax');
  const [speakerPose, setSpeakerPose] = useState<HandPose>('open');
  const [frozen, setFrozenState] = useState(false);
  const [talking, setTalkingState] = useState(false);
  const [drumming, setDrummingState] = useState(false);

  // Init home positions once the stage is measured, and re-home on resize.
  useEffect(() => {
    function place(): void {
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const size: StageSize = { width: stageEl.clientWidth, height: stageEl.clientHeight };
      const wHome = workerHome(size);
      const sHome = speakerHome(size);
      workerRef.current.x = wHome.x;
      workerRef.current.y = wHome.y;
      speakerRef.current.x = sHome.x;
      speakerRef.current.y = sHome.y;
      lastWorkerPos.current = { x: wHome.x, y: wHome.y };
      workerPinnedRef.current = false;
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [stageRef]);

  // Main render loop.
  useEffect(() => {
    const startTime = performance.now();
    let raf = 0;

    function frame(now: number): void {
      const t = (now - startTime) / 1000;
      const w = workerRef.current;
      const sp = speakerRef.current;
      const isFrozen = frozenRef.current;
      const workerIsGuiding = workerBusyRef.current || workerPinnedRef.current;

      const wDrift = isFrozen
        ? { dx: 0, dy: 0 }
        : fineDrift(t, seeds.worker, WORKER_DRIFT_AMP, workerIsGuiding);
      const sDrift = isFrozen
        ? { dx: 0, dy: 0 }
        : fineDrift(t, seeds.speaker, SPEAKER_DRIFT_AMP, speakerBusyRef.current);

      const wIdleY = isFrozen ? 0 : workerIdleY(t, workerIsGuiding);
      const sIdleY = isFrozen ? 0 : speakerIdleY(t, speakerBusyRef.current);
      const wIdleRot = isFrozen ? 0 : workerIdleRot(t, workerIsGuiding);
      const sIdleRot = isFrozen ? 0 : speakerIdleRot(t);

      const vx = w.x - lastWorkerPos.current.x;
      const vy = w.y - lastWorkerPos.current.y;
      const banking = isFrozen ? { bankX: 0, bankY: 0 } : velocityBanking(vx, vy);
      lastWorkerPos.current = { x: w.x, y: w.y };

      const alt = altitudeEffect(w.z);
      const drum = isFrozen ? 0 : drumOffset(t, drummingRef.current);
      const talk = isFrozen ? 1 : talkScale(t, talkingRef.current);

      const workerPosition = `translate3d(${(w.x + wDrift.dx).toFixed(2)}px, ${(w.y + wDrift.dy + wIdleY - w.z).toFixed(2)}px, 0)`;
      const workerHandTransform = `rotateZ(${(w.rz + wIdleRot).toFixed(2)}deg) rotateY(${banking.bankY.toFixed(2)}deg) rotateX(${(banking.bankX + w.rx).toFixed(2)}deg) scale(${(w.s + alt.scaleBonus).toFixed(3)})`;
      const workerShadowTransform = `scale(${alt.shadowScale.toFixed(3)}) translateY(${alt.shadowOffsetY.toFixed(2)}px)`;

      const speakerPosition = `translate3d(${(sp.x + sDrift.dx).toFixed(2)}px, ${(sp.y + sDrift.dy + sIdleY + drum).toFixed(2)}px, 0)`;
      const speakerHandTransform = `rotateZ(${(sp.rz + sIdleRot).toFixed(2)}deg) rotateX(${sp.rx.toFixed(2)}deg) rotateY(${sp.ry.toFixed(2)}deg) scale(${(sp.sc * talk).toFixed(3)})`;

      setRender({
        worker: {
          positionTransform: workerPosition,
          handTransform: workerHandTransform,
          shadowTransform: workerShadowTransform,
          shadowOpacity: alt.shadowOpacity,
        },
        speaker: {
          positionTransform: speakerPosition,
          handTransform: speakerHandTransform,
          shadowTransform: 'scale(1)',
          shadowOpacity: 0.25,
        },
      });

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [seeds]);

  const glideWorkerTo = useCallback(async (el: HTMLElement) => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const target = workerAnchorForElement(el, stageEl);
    workerBusyRef.current = true;
    workerPinnedRef.current = false;
    setWorkerPose('point');
    try {
      await glideWorker(workerRef.current, target.x, target.y);
      workerPinnedRef.current = true;
    } finally {
      workerBusyRef.current = false;
    }
  }, [stageRef]);

  const pressWorkerAt = useCallback(async (el: HTMLElement, onImpact?: () => void) => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const target = workerAnchorForElement(el, stageEl);
    workerBusyRef.current = true;
    workerPinnedRef.current = false;
    try {
      const callbacks: WorkerMoveCallbacks = { setPose: setWorkerPose };
      if (onImpact) callbacks.onImpact = onImpact;
      await pressWorker(workerRef.current, target.x, target.y, callbacks);
      workerPinnedRef.current = true;
    } finally {
      workerBusyRef.current = false;
    }
  }, [stageRef]);

  const typeWorkerAt = useCallback(
    async (el: HTMLElement, text: string, onChar: (char: string, index: number) => void) => {
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const target = workerAnchorForElement(el, stageEl);
      workerBusyRef.current = true;
      workerPinnedRef.current = false;
      try {
        await pressWorker(workerRef.current, target.x, target.y, { setPose: setWorkerPose });
        for (let i = 0; i < text.length; i++) {
          onChar(text[i] as string, i);
          await typeWorkerChar(workerRef.current, i);
        }
        workerPinnedRef.current = true;
      } finally {
        workerBusyRef.current = false;
      }
    },
    [stageRef]
  );

  const homeWorkerHand = useCallback(async () => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const size: StageSize = { width: stageEl.clientWidth, height: stageEl.clientHeight };
    workerBusyRef.current = true;
    workerPinnedRef.current = false;
    try {
      await homeWorker(workerRef.current, workerHome(size));
    } finally {
      workerBusyRef.current = false;
      setWorkerPose('relax');
    }
  }, [stageRef]);

  const retreatWorkerHand = useCallback(async () => {
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const size: StageSize = { width: stageEl.clientWidth, height: stageEl.clientHeight };
    workerBusyRef.current = true;
    workerPinnedRef.current = false;
    try {
      await retreatWorker(workerRef.current, workerHome(size));
    } finally {
      workerBusyRef.current = false;
      setWorkerPose('relax');
    }
  }, [stageRef]);

  const runBeat = useCallback(async (beat: Beat) => {
    speakerBusyRef.current = true;
    try {
      await runSpeakerBeat(speakerRef.current, beat, setSpeakerPose);
    } finally {
      speakerBusyRef.current = false;
    }
  }, []);

  const freeze = useCallback(() => {
    frozenRef.current = true;
    setFrozenState(true);
    setSpeakerPose('grip_wrist');
    void tween(speakerRef.current, { rz: 0, ry: 0, sc: 1 }, 200, 'out');
  }, []);

  const unfreeze = useCallback(() => {
    frozenRef.current = false;
    setFrozenState(false);
  }, []);

  const setTalking = useCallback((value: boolean) => {
    talkingRef.current = value;
    setTalkingState(value);
  }, []);

  const setDrumming = useCallback((value: boolean) => {
    drummingRef.current = value;
    setDrummingState(value);
  }, []);

  const handle: MotionEngineHandle = {
    worker: render.worker,
    speaker: render.speaker,
    workerPose,
    speakerPose,
    talking,
    setTalking,
    drumming,
    setDrumming,
    frozen,
    freeze,
    unfreeze,
    glideWorkerTo,
    pressWorkerAt,
    typeWorkerAt,
    homeWorkerHand,
    retreatWorkerHand,
    runBeat,
  };

  return handle;
}
