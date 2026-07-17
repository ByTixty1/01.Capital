/**
 * Minimal Web Speech API surface we actually use — not in the default DOM
 * lib typings, and we'd rather declare exactly what we touch than pull in
 * `any` or a third-party @types package for a few members.
 */

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface WindowWithSpeechRecognition {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as WindowWithSpeechRecognition;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
