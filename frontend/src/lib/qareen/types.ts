/**
 * Wire-format types for the Qareen brain, matching QAREEN_SYSTEM_PROMPT.md's
 * JSON schema exactly (snake_case), the same way api.ts mirrors backend
 * Pydantic field names verbatim rather than re-casing them.
 */

export type BrainIntent =
  | 'explain'
  | 'howto'
  | 'delegate'
  | 'knowledge'
  | 'bad_news'
  | 'good_news'
  | 'approval';

export type HandPose =
  | 'open'
  | 'point'
  | 'two'
  | 'three'
  | 'pinch'
  | 'fist'
  | 'grab'
  | 'tap'
  | 'relax'
  | 'grip_wrist';

export type WorkerMoveType = 'glide' | 'press' | 'type' | 'circle' | 'retreat' | 'home';

export interface Beat {
  pose: HandPose;
  tilt: number | null;
  lean: number | null;
  emph: boolean;
  raise: boolean;
  drift: [number, number] | null;
  on_word: number | null;
}

export interface WorkerMove {
  move: WorkerMoveType;
  target: string | null;
  text: string | null;
  on_word: number | null;
}

export interface BrainLine {
  say: string;
  beats: Beat[];
  worker: WorkerMove[];
}

export interface BrainResponse {
  intent: BrainIntent;
  lines: BrainLine[];
  needs_approval: boolean;
  prepared_action: string | null;
}

export interface BrainConversationTurn {
  role: 'user' | 'qareen';
  text: string;
}

export type MicState = 'live' | 'muted' | 'thinking';

export type ConversationRole = 'user' | 'qareen';

export interface ConversationEntry {
  id: string;
  role: ConversationRole;
  text: string;
  timestamp: number;
  intent?: BrainIntent;
  needsApproval?: boolean;
  preparedAction?: string | null;
  approvalState?: 'pending' | 'approved' | 'cancelled';
}

export interface WordTiming {
  word: string;
  ms: number;
}
