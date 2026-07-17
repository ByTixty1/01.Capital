'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQareenStore } from '@/lib/qareen/store';
import { runQareenTurn } from '@/lib/qareen/executor';
import { getSpeechRecognitionCtor, type SpeechRecognitionLike } from '@/lib/qareen/speechTypes';
import { primeAudioPlayback } from '@/lib/qareen/audio';

const ENDPOINT_STABLE_MS = 350;
const NUDGE_SILENCE_MS = 6000;
const REOPEN_DELAY_MS = 300;
const NUDGE_LINE = "Take your time. The deadline won't.";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Voice input: continuous listening with 350ms-stable endpointing while the
 * mic master toggle is on, plus push-to-talk (hold spacebar) that works
 * even mid-response for barge-in. No live microphone testing was possible
 * in this environment — the endpointing/turn-taking state machine is
 * covered by a Playwright test that stubs window.SpeechRecognition.
 */
export function useQareenVoice(): void {
  const micMasterOn = useQareenStore((s) => s.micMasterOn);
  const setMicState = useQareenStore((s) => s.setMicState);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimRef = useRef('');
  const stableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushToTalkRef = useRef(false);
  const turnInFlightRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  const clearStableTimer = useCallback(() => {
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
    }
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      useQareenStore.getState().appendConversationEntry({
        id: `qareen-nudge-${Date.now()}`,
        role: 'qareen',
        text: NUDGE_LINE,
        timestamp: Date.now(),
      });
      // Deliberately no brain call — a local canned line, then wait forever.
    }, NUDGE_SILENCE_MS);
  }, [clearSilenceTimer]);

  const submitTranscript = useCallback(
    (text: string, interrupted: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      clearStableTimer();
      clearSilenceTimer();
      interimRef.current = '';
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setMicState('thinking');
      turnInFlightRef.current = true;

      useQareenStore.getState().appendConversationEntry({
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      });

      void runQareenTurn(trimmed, interrupted).finally(() => {
        turnInFlightRef.current = false;
        if (useQareenStore.getState().micMasterOn) {
          setTimeout(() => setMicState('live'), REOPEN_DELAY_MS);
        } else {
          setMicState('muted');
        }
      });
    },
    [clearStableTimer, clearSilenceTimer, setMicState]
  );

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        if (result.isFinal) final += result[0].transcript;
        else interim += result[0].transcript;
      }

      armSilenceTimer();

      if (final.trim()) {
        submitTranscript(final, false);
        return;
      }

      const text = interim.trim();
      if (!text || text === interimRef.current) return;
      interimRef.current = text;
      clearStableTimer();
      stableTimerRef.current = setTimeout(() => {
        submitTranscript(interimRef.current, false);
      }, ENDPOINT_STABLE_MS);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      const state = useQareenStore.getState();
      if (state.micMasterOn && state.micState === 'live' && !turnInFlightRef.current) {
        startListeningRef.current();
      }
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    armSilenceTimer();
  }, [armSilenceTimer, clearStableTimer, submitTranscript]);

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearStableTimer();
    clearSilenceTimer();
    interimRef.current = '';
  }, [clearStableTimer, clearSilenceTimer]);

  useEffect(() => {
    if (micMasterOn) {
      setMicState('live');
      startListening();
    } else {
      stopListening();
      setMicState('muted');
    }
    return () => stopListening();
    // Only micMasterOn should retrigger this — startListening/stopListening
    // are stable useCallbacks that read fresh store state internally.
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

      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) return;

      stopListening();
      interimRef.current = '';
      const recognition = new Ctor();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (recognitionEvent) => {
        let combined = '';
        for (let i = 0; i < recognitionEvent.results.length; i++) {
          const result = recognitionEvent.results[i];
          if (result) combined += result[0].transcript;
        }
        interimRef.current = combined.trim();
      };
      recognitionRef.current = recognition;
      recognition.start();
      setMicState('live');
    }

    function onKeyUp(event: KeyboardEvent): void {
      if (event.code !== 'Space' || !pushToTalkRef.current) return;
      pushToTalkRef.current = false;

      const wasTalking = turnInFlightRef.current;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      const text = interimRef.current;
      interimRef.current = '';
      if (text) submitTranscript(text, wasTalking);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [submitTranscript, stopListening, setMicState]);
}
