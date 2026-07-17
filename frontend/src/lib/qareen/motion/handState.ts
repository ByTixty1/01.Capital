import type { HandPose } from '../types';

export interface WorkerHandState {
  x: number;
  y: number;
  z: number;
  rz: number;
  s: number;
  /** Press-squash rotateX, additive with velocity banking's bankX at render time. */
  rx: number;
}

export interface SpeakerHandState {
  x: number;
  y: number;
  rz: number;
  rx: number;
  ry: number;
  sc: number;
}

export interface StageSize {
  width: number;
  height: number;
}

/** Fractions of stage size — worker lives right/center, speaker left. */
export const WORKER_HOME_FRACTION = { x: 0.66, y: 0.42 };
export const SPEAKER_HOME_FRACTION = { x: 0.1, y: 0.52 };

export function workerHome(stage: StageSize): { x: number; y: number } {
  return { x: stage.width * WORKER_HOME_FRACTION.x, y: stage.height * WORKER_HOME_FRACTION.y };
}

export function speakerHome(stage: StageSize): { x: number; y: number } {
  return { x: stage.width * SPEAKER_HOME_FRACTION.x, y: stage.height * SPEAKER_HOME_FRACTION.y };
}

export function initialWorkerState(stage: StageSize): WorkerHandState {
  const home = workerHome(stage);
  return { x: home.x, y: home.y, z: 0, rz: 0, s: 1, rx: 0 };
}

export function initialSpeakerState(stage: StageSize): SpeakerHandState {
  const home = speakerHome(stage);
  return { x: home.x, y: home.y, rz: 0, rx: 0, ry: 0, sc: 1 };
}

export interface HandVisualState {
  pose: HandPose;
  transform: string;
  shadowTransform: string;
  shadowOpacity: number;
}
