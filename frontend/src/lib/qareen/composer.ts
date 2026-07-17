'use client';

import { submitQareenUserInput } from './executor';
import { useQareenStore } from './store';

/** One guarded submission path for typed text, approval chips, and completed
 * voice dictation. The shared in-flight flag prevents duplicate turns. */
export function submitQareenMessage(text: string, clearComposer = false): boolean {
  const trimmed = text.trim();
  const store = useQareenStore.getState();
  if (!trimmed || store.composerSubmitting) return false;

  if (clearComposer) store.setComposerDraft('');
  store.setComposerSubmitting(true);
  void submitQareenUserInput(trimmed).finally(() => {
    useQareenStore.getState().setComposerSubmitting(false);
  });
  return true;
}

export function submitQareenComposerDraft(): boolean {
  return submitQareenMessage(useQareenStore.getState().composerDraft, true);
}
