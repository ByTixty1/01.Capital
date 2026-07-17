import {
  decodeAudioSegment,
  ensureAudioPlaybackReady,
  playAudioBufferAsync,
  playEncodedAudioAsync,
  sleep,
} from './audio';
import type { WordTiming } from './types';

interface TtsSegmentWire {
  audio_base64: string;
  word_timings: WordTiming[];
}

interface TtsResponseWire {
  segments: TtsSegmentWire[];
  pause_ms: number;
}

export interface TtsSegmentResult {
  audioBuffer: AudioBuffer;
  audioBase64: string;
  wordTimings: WordTiming[];
}

export interface TtsResult {
  segments: TtsSegmentResult[];
  pauseMs: number;
}

/** Resolves a response-wide word index to its audio start time. Edge TTS
 * restarts offsets for each ellipsis-split segment, so segment duration and
 * the deliberate pause between segments must be added back here. */
export function wordStartMs(result: TtsResult, wordIndex: number | null): number {
  if (wordIndex === null || wordIndex < 0) return 0;

  let elapsedMs = 0;
  let seenWords = 0;
  for (let segmentIndex = 0; segmentIndex < result.segments.length; segmentIndex++) {
    const segment = result.segments[segmentIndex];
    if (!segment) continue;
    const localIndex = wordIndex - seenWords;
    const timing = segment.wordTimings[localIndex];
    if (timing) return elapsedMs + timing.ms;

    seenWords += segment.wordTimings.length;
    elapsedMs += segment.audioBuffer.duration * 1000;
    if (segmentIndex < result.segments.length - 1) elapsedMs += result.pauseMs;
  }

  return 0;
}

export async function fetchTts(text: string): Promise<TtsResult> {
  const res = await fetch('/api/backend/api/qareen/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    throw new Error(`Qareen TTS failed: ${res.status}`);
  }
  const wire = (await res.json()) as TtsResponseWire;

  const segments = await Promise.all(
    wire.segments.map(async (segment) => ({
      audioBuffer: await decodeAudioSegment(segment.audio_base64),
      audioBase64: segment.audio_base64,
      wordTimings: segment.word_timings,
    }))
  );

  return { segments, pauseMs: wire.pause_ms };
}

/** Plays each segment in order with a pauseMs silence between them. */
export async function playTtsResult(result: TtsResult): Promise<void> {
  for (let i = 0; i < result.segments.length; i++) {
    const segment = result.segments[i];
    if (!segment) continue;
    try {
      await playEncodedAudioAsync(segment.audioBase64);
    } catch {
      await ensureAudioPlaybackReady();
      await playAudioBufferAsync(segment.audioBuffer);
    }
    if (i < result.segments.length - 1 && result.pauseMs > 0) {
      await sleep(result.pauseMs);
    }
  }
}
