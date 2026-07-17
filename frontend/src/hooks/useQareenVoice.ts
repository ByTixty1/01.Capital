'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQareenStore } from '@/lib/qareen/store';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/qareen/speechTypes';
import { primeAudioPlayback } from '@/lib/qareen/audio';
import { interruptQareenOutput } from '@/lib/qareen/executor';

const REOPEN_DELAY_MS = 300;
const FATAL_RECOGNITION_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function joinDraft(base: string, spoken: string): string {
  return [base.trim(), spoken.trim()].filter(Boolean).join(' ');
}

/**
 * Voice input is explicit dictation, not automatic endpoint submission.
 * Recognition writes interim and final words into the shared chat composer.
 * Natural recognition endings are reopened while the mic master toggle is on,
 * so a pause neither submits the message nor prevents the next spoken segment.
 * The master mic's stop control submits the completed draft; push-to-talk
 * release keeps its draft for explicit Send.
 */
export function useQareenVoice(): void {
  const micMasterOn = useQareenStore((s) => s.micMasterOn);
  const setMicState = useQareenStore((s) => s.setMicState);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const reopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentBaseRef = useRef('');
  const pushToTalkRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  const clearReopenTimer = useCallback(() => {
    if (reopenTimerRef.current) {
      clearTimeout(reopenTimerRef.current);
      reopenTimerRef.current = null;
    }
  }, []);

  const scheduleReopen = useCallback(() => {
    clearReopenTimer();
    reopenTimerRef.current = setTimeout(() => {
      reopenTimerRef.current = null;
      const state = useQareenStore.getState();
      if (state.micMasterOn || pushToTalkRef.current) {
        startListeningRef.current();
      }
    }, REOPEN_DELAY_MS);
  }, [clearReopenTimer]);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    clearReopenTimer();
    segmentBaseRef.current = useQareenStore.getState().composerDraft.trim();

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      let segment = '';
      // Web Speech keeps earlier final results in this array. Rebuilding the
      // current recognition segment avoids duplicating words as results evolve.
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.[0]?.transcript) segment += `${result[0].transcript} `;
      }
      useQareenStore.getState().setComposerDraft(joinDraft(segmentBaseRef.current, segment));
    };

    recognition.onend = () => {
      // Ignore onend emitted by a recognition instance we deliberately
      // detached before stopping it.
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;

      const state = useQareenStore.getState();
      if (state.micMasterOn || pushToTalkRef.current) {
        setMicState('live');
        scheduleReopen();
      } else {
        setMicState('muted');
      }
    };

    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      recognitionRef.current = null;
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // The browser may already have ended the failed recognition session.
      }

      if (FATAL_RECOGNITION_ERRORS.has(event.error)) {
        useQareenStore.getState().setMicMasterOn(false);
        setMicState('muted');
        return;
      }

      const state = useQareenStore.getState();
      if (state.micMasterOn || pushToTalkRef.current) scheduleReopen();
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setMicState('live');
    } catch {
      recognitionRef.current = null;
      if (useQareenStore.getState().micMasterOn || pushToTalkRef.current) scheduleReopen();
    }
  }, [clearReopenTimer, scheduleReopen, setMicState]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    clearReopenTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.stop();
    }
  }, [clearReopenTimer]);

  useEffect(() => {
    if (micMasterOn) {
      setMicState('live');
      startListening();
    } else if (!pushToTalkRef.current) {
      stopListening();
      setMicState('muted');
    }

    return () => stopListening();
    // Only the master toggle should restart this effect. The callbacks read
    // current store state and remain wired through startListeningRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micMasterOn]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== 'Space' || event.repeat || isTypingTarget(event.target)) return;
      event.preventDefault();
      if (pushToTalkRef.current) return;
      pushToTalkRef.current = true;

      if (!primeAudioPlayback()) {
        useQareenStore.getState().setVoiceOutputState('unavailable');
      }

      if (!getSpeechRecognitionCtor()) {
        pushToTalkRef.current = false;
        return;
      }
      interruptQareenOutput();
      stopListening();
      startListeningRef.current();
      setMicState('live');
    }

    function onKeyUp(event: KeyboardEvent): void {
      if (event.code !== 'Space' || !pushToTalkRef.current) return;
      pushToTalkRef.current = false;
      stopListening();

      if (useQareenStore.getState().micMasterOn) {
        setMicState('live');
        scheduleReopen();
      } else {
        setMicState('muted');
      }
      // Push-to-talk is also dictation: releasing Space leaves the recognized
      // text in the composer. Sending remains a separate user action.
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [scheduleReopen, setMicState, stopListening]);
}
