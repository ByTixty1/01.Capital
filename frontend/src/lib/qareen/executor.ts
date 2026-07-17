import { streamBrainResponse } from './brainClient';
import { fetchTts, playTtsResult, wordStartMs, type TtsResult } from './ttsClient';
import { stopAllAudio } from './audio';
import { getMotionEngine } from './motion/engineRegistry';
import { getQareenRouter } from './routerRegistry';
import {
  activationControlForGhost,
  resolveSpokenGhostCues,
  resolveSpokenGhostTarget,
  routeForGhost,
  waitForGhost,
} from './ghostRegistry';
import { pulseGhostElement } from './motion/impactPulse';
import { useQareenStore, type FormDraft } from './store';
import { classifyApprovalPhrase } from './approvalBus';
import { collectQareenPageContext } from './pageContext';
import type { BrainLine, WorkerMove, Beat } from './types';

/** Bumped on every new turn — lets a barge-in cut off a stale turn's
 * still-queued line dispatches instead of letting them play out after. */
let currentGeneration = 0;

const FORM_FIELD_GHOST_IDS: readonly (keyof FormDraft)[] = ['field_name', 'field_id', 'field_shares'];

function ghostIdToFormField(target: string): keyof FormDraft | null {
  return (FORM_FIELD_GHOST_IDS as readonly string[]).includes(target) ? (target as keyof FormDraft) : null;
}

/** The approval constitution, enforced in code (not just the prompt): a
 * worker press on submit_btn only ever executes if this turn was itself
 * the user's "yes" in response to a pending request. */
function isBlockedMutation(move: WorkerMove, approvalGranted: boolean): boolean {
  return move.move === 'press' && move.target === 'submit_btn' && !approvalGranted;
}

function rectDistance(a: DOMRect, b: DOMRect): number {
  return Math.max(
    Math.abs(a.left - b.left),
    Math.abs(a.top - b.top),
    Math.abs(a.width - b.width),
    Math.abs(a.height - b.height),
  );
}

/** Scrolls to the target, then requires two stable layout frames before the
 * hand reads its geometry. This prevents late-loading page content from moving
 * the target between measurement and impact. */
async function scrollIntoViewAndSettle(el: HTMLElement): Promise<void> {
  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  const startedAt = performance.now();
  let previous = el.getBoundingClientRect();
  let stableFrames = 0;

  while (stableFrames < 2 && performance.now() - startedAt < 500) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const current = el.getBoundingClientRect();
    stableFrames = rectDistance(previous, current) < 0.75 ? stableFrames + 1 : 0;
    previous = current;
  }
}

/** Activates an explicitly allowlisted real control at the hand's impact
 * frame. `HTMLElement.click()` preserves the control's native behavior (Next
 * Link navigation, anchors, React onClick) without synthesizing a second,
 * visually disconnected pointer animation. */
function activateGhostControl(target: string, root: HTMLElement): boolean {
  const control = activationControlForGhost(target, root);
  if (!control) return false;
  if (control instanceof HTMLButtonElement && control.disabled) return false;

  try {
    control.focus({ preventScroll: true });
    control.click();
    return true;
  } catch {
    return false;
  }
}

/** Finds a real, same-origin link already rendered by the current layout for
 * a registered destination route. Cross-page guidance presses this link when
 * possible, making the navigation itself visible and functional. */
function navigationControlForRoute(route: string): HTMLAnchorElement | null {
  if (typeof window === 'undefined') return null;
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const link of links) {
    try {
      const destination = new URL(link.href, window.location.href);
      if (destination.origin === window.location.origin && destination.pathname === route) {
        return link;
      }
    } catch {
      // Ignore malformed/non-navigation hrefs and continue looking.
    }
  }
  return null;
}

async function navigateWithWorker(route: string): Promise<void> {
  const engine = getMotionEngine();
  const navigationControl = navigationControlForRoute(route);
  if (engine && navigationControl) {
    await scrollIntoViewAndSettle(navigationControl);
    await engine.pressWorkerAt(navigationControl, () => {
      pulseGhostElement(navigationControl);
      navigationControl.focus({ preventScroll: true });
      navigationControl.click();
    });
    return;
  }
  getQareenRouter()?.push(route);
}

/**
 * Resolves a worker move's target — navigating to another real route
 * first if the ghost element lives there, then scrolling it into view —
 * then executes the move. This is the mechanism behind "guide the user
 * across pages without breaking": the overlay never unmounts (lives in
 * the root layout), only the page content underneath it changes. Many
 * real ghost targets (e.g. the landing page's ESOP/Compliance bays) sit
 * on the *same* route as an anchor-scrolled section rather than a
 * separate page, so scrolling into view matters even when no navigation
 * happens.
 */
async function dispatchWorkerMove(move: WorkerMove, approvalGranted: boolean): Promise<void> {
  const engine = getMotionEngine();
  if (!engine) return;

  if (move.move === 'home') {
    await engine.homeWorkerHand();
    return;
  }
  if (move.move === 'retreat') {
    await engine.retreatWorkerHand();
    return;
  }
  if (!move.target) return;

  if (isBlockedMutation(move, approvalGranted)) return;

  const route = routeForGhost(
    move.target,
    typeof window !== 'undefined' ? window.location.pathname : undefined,
  );
  if (route && typeof window !== 'undefined' && window.location.pathname !== route) {
    await navigateWithWorker(route);
  }

  const el = await waitForGhost(move.target, 3000);
  if (!el) return; // target never appeared — fail soft, never crash the demo
  // When a tagged panel contains an allowlisted link/button, the visible hand
  // must land on the control it will activate—not the panel's broad center.
  const activationControl = move.move === 'press'
    ? activationControlForGhost(move.target, el)
    : null;
  const motionTarget = activationControl ?? el;
  await scrollIntoViewAndSettle(motionTarget);

  switch (move.move) {
    case 'glide':
    case 'circle':
      await engine.glideWorkerTo(motionTarget);
      break;
    case 'press':
      await engine.pressWorkerAt(motionTarget, () => {
        pulseGhostElement(motionTarget);
        activateGhostControl(move.target!, el);
      });
      if (move.target === 'submit_btn') {
        // Only reached when approval was granted (blocked above otherwise).
        useQareenStore.getState().commitStakeholderFromDraft();
      }
      break;
    case 'type': {
      if (!move.text) break;
      const field = ghostIdToFormField(move.target);
      if (field) useQareenStore.getState().setFormDraftField(field, '');
      await engine.typeWorkerAt(motionTarget, move.text, (char) => {
        if (!field) return;
        const current = useQareenStore.getState().formDraft[field] ?? '';
        useQareenStore.getState().setFormDraftField(field, current + char);
      });
      break;
    }
  }
}

async function dispatchBeat(beat: Beat): Promise<void> {
  const engine = getMotionEngine();
  if (!engine) return;
  await engine.runBeat(beat);
}

async function waitForSpokenWord(result: TtsResult | null, wordIndex: number | null, startedAt: number): Promise<void> {
  if (!result || wordIndex === null) return;
  const remainingMs = wordStartMs(result, wordIndex) - (performance.now() - startedAt);
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
}

/**
 * type moves' real effect is a formDraft write (decision #11) — that
 * happens in both modes. In text mode there's no hand, so the full value
 * is set instantly with no navigation; the target input is store-bound
 * (see add-stakeholder/page.tsx), so it picks up the value immediately if
 * already mounted, or whenever the user navigates there themselves later.
 */
function applyTypeMovesInTextMode(worker: WorkerMove[]): void {
  for (const move of worker) {
    if (move.move !== 'type' || !move.target || !move.text) continue;
    const field = ghostIdToFormField(move.target);
    if (field) useQareenStore.getState().setFormDraftField(field, move.text);
  }
}

const TARGETED_WORKER_MOVES = new Set<WorkerMove['move']>(['glide', 'press', 'circle']);

/** One deliberate worker instruction per line. For known public sample facts,
 * code owns the exact card/row target even when Claude proposes a broad panel.
 * If Claude omits movement entirely, a stable glide is synthesized. */
function deterministicWorkerMoves(line: BrainLine): WorkerMove[] {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : undefined;
  const proposed = line.worker.find((move) => move.move === 'press') ?? line.worker[0] ?? null;
  const fixedCues = resolveSpokenGhostCues(line.say, pathname);

  if (fixedCues.length > 0) {
    const singleMoveType = fixedCues.length === 1 && proposed?.move === 'press' ? 'press' : 'glide';
    return fixedCues.map((cue) => ({
      move: singleMoveType,
      target: cue.target,
      text: null,
      on_word: cue.onWord,
    }));
  }

  if (!proposed) {
    const target = resolveSpokenGhostTarget(line.say, null, pathname);
    return target ? [{ move: 'glide', target, text: null, on_word: null }] : [];
  }
  if (!TARGETED_WORKER_MOVES.has(proposed.move)) return [proposed];

  return [{
    ...proposed,
    target: resolveSpokenGhostTarget(line.say, proposed.target, pathname),
  }];
}

/**
 * Runs one line's TTS + (if guideMode) motion. guideMode is read fresh
 * here — not captured when the line was queued — so toggling "Guide me"
 * mid-conversation changes behavior starting with the very next dispatch.
 */
async function dispatchLine(line: BrainLine, generation: number, approvalGranted: boolean): Promise<void> {
  if (generation !== currentGeneration) return; // superseded by a barge-in

  const guideMode = useQareenStore.getState().guideMode;
  const engine = getMotionEngine();

  let ttsResult: TtsResult | null = null;
  try {
    ttsResult = await fetchTts(line.say);
  } catch {
    useQareenStore.getState().setVoiceOutputState('unavailable');
  }
  if (generation !== currentGeneration) return;

  const startedAt = performance.now();
  if (ttsResult) {
    engine?.setTalking(true);
    useQareenStore.getState().setVoiceOutputState('speaking');
  }
  const ttsPromise = ttsResult
    ? playTtsResult(ttsResult)
        .then(() => true)
        .catch(() => {
          useQareenStore.getState().setVoiceOutputState('unavailable');
          return false;
        })
    : Promise.resolve(false);

  try {
    if (guideMode && engine && generation === currentGeneration) {
      const workerMoves = deterministicWorkerMoves(line);
      const beatsPromise = Promise.all(line.beats.map(async (beat) => {
        await waitForSpokenWord(ttsResult, beat.on_word, startedAt);
        if (generation === currentGeneration) await dispatchBeat(beat);
      }));
      for (const move of workerMoves) {
        if (generation !== currentGeneration) break;
        await waitForSpokenWord(ttsResult, move.on_word, startedAt);
        await dispatchWorkerMove(move, approvalGranted);
      }
      await beatsPromise;
    } else if (!guideMode) {
      applyTypeMovesInTextMode(line.worker);
    }
  } finally {
    const played = await ttsPromise;
    engine?.setTalking(false);
    if (played && generation === currentGeneration) {
      useQareenStore.getState().setVoiceOutputState('idle');
    }
  }
}

let dispatchChain: Promise<void> = Promise.resolve();

function makeEntryId(): string {
  return `qareen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sends a user message to the brain, streams the response into the chat
 * transcript line-by-line, and dispatches each line's TTS/motion in order
 * (queued so lines never overlap, even though they arrive as fast as the
 * backend can flush them).
 */
export async function runQareenTurn(userMessage: string, interrupted = false): Promise<void> {
  currentGeneration += 1;
  const generation = currentGeneration;

  if (interrupted) {
    stopAllAudio();
    const engine = getMotionEngine();
    engine?.setTalking(false);
    void engine?.retreatWorkerHand();
  }
  dispatchChain = Promise.resolve();

  const store = useQareenStore.getState();

  // The approval constitution: this turn may only execute a prepared
  // mutation if it's itself the "yes" answer to a currently pending one.
  const pending = store.pendingApproval;
  const decision = pending ? classifyApprovalPhrase(userMessage) : null;
  const approvalGranted = decision === 'approved';
  if (pending && decision) {
    store.updateConversationEntry(pending.conversationEntryId, {
      approvalState: decision,
    });
    store.setPendingApproval(null);
  }

  const history = store.conversation.map((entry) => ({
    role: entry.role === 'user' ? ('user' as const) : ('qareen' as const),
    text: entry.text,
  }));

  let lastEntryId: string | null = null;

  try {
    for await (const event of streamBrainResponse({
      message: userMessage,
      history,
      interrupted,
      ...(typeof window !== 'undefined' ? {
        current_pathname: window.location.pathname,
        page_context: collectQareenPageContext(),
      } : {}),
    })) {
      if (generation !== currentGeneration) break; // superseded mid-stream by another barge-in
      if (event.type === 'line') {
        const line = event.data as unknown as BrainLine;
        const entryId = makeEntryId();
        lastEntryId = entryId;
        useQareenStore.getState().appendConversationEntry({
          id: entryId,
          role: 'qareen',
          text: line.say,
          timestamp: Date.now(),
        });
        dispatchChain = dispatchChain.then(() => dispatchLine(line, generation, approvalGranted));
      } else if (event.type === 'done') {
        const needsApproval = Boolean(event.data.needs_approval);
        const preparedAction = (event.data.prepared_action as string | null) ?? null;
        if (needsApproval && lastEntryId) {
          const entryId = lastEntryId;
          useQareenStore.getState().updateConversationEntry(entryId, {
            needsApproval: true,
            approvalState: 'pending',
            preparedAction,
          });
          useQareenStore.getState().setPendingApproval({
            preparedAction: preparedAction ?? 'this action',
            conversationEntryId: entryId,
          });
        }
      }
    }
  } catch {
    useQareenStore.getState().appendConversationEntry({
      id: makeEntryId(),
      role: 'qareen',
      text: "Something went sideways on my end. Try that again.",
      timestamp: Date.now(),
    });
  }

  await dispatchChain;
}
