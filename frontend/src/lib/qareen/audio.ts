'use client';

/**
 * Web Audio playback — per brief section 5, AudioBufferSourceNode not
 * <audio> tags, for sample-accurate queuing between per-line TTS segments.
 */

let audioCtx: AudioContext | null = null;
let mediaElement: HTMLAudioElement | null = null;
let cancelActiveMedia: (() => void) | null = null;
const UNLOCK_SILENCE = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function getMediaElement(): HTMLAudioElement {
  if (!mediaElement) {
    mediaElement = new Audio();
    mediaElement.preload = 'auto';
    mediaElement.volume = 1;
    mediaElement.setAttribute('playsinline', '');
    mediaElement.dataset.qareenAudio = 'true';
    mediaElement.style.display = 'none';
    document.body.appendChild(mediaElement);
  }
  return mediaElement;
}

/**
 * Browser autoplay policies only reliably unlock audio while a click/key
 * gesture is still on the stack. Call this synchronously from every Qareen
 * input surface, before the brain/TTS network round trips begin.
 */
export function primeAudioPlayback(): boolean {
  let primed = false;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    // A one-sample silent source completes the unlock on browsers that require
    // an actual start() call during the user gesture (not merely resume()).
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22_050);
    source.connect(ctx.destination);
    source.start();
    primed = true;
  } catch {
    // The native media path below may still be available.
  }

  try {
    const audio = getMediaElement();
    audio.src = UNLOCK_SILENCE;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
    primed = true;
  } catch {
    // Typed chat must still work on a browser/device without audio output.
  }

  return primed;
}

export async function ensureAudioPlaybackReady(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
  if (ctx.state !== 'running') {
    throw new Error(`Qareen audio context is ${ctx.state}`);
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function decodeAudioSegment(base64: string): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  return ctx.decodeAudioData(base64ToArrayBuffer(base64));
}

const activeSources = new Set<AudioBufferSourceNode>();

/** Primary speech output. A real media element uses the browser's normal
 * audible playback pipeline; Web Audio remains the fallback below. */
export function playEncodedAudioAsync(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = getMediaElement();
    cancelActiveMedia?.();

    let settled = false;
    const cleanup = (): void => {
      audio.onended = null;
      audio.onerror = null;
      if (cancelActiveMedia === cancel) cancelActiveMedia = null;
    };
    const finish = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Qareen media playback failed'));
    };
    const cancel = (): void => {
      audio.pause();
      finish();
    };

    cancelActiveMedia = cancel;
    audio.onended = finish;
    audio.onerror = fail;
    audio.src = `data:audio/mpeg;base64,${base64}`;
    audio.currentTime = 0;
    audio.load();
    void audio.play().catch(fail);
  });
}

export function playAudioBuffer(buffer: AudioBuffer, onEnded?: () => void): AudioBufferSourceNode {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  activeSources.add(source);
  source.onended = () => {
    activeSources.delete(source);
    onEnded?.();
  };
  source.start();
  return source;
}

/** Barge-in support: stop whatever Qareen is currently saying, right now. */
export function stopAllAudio(): void {
  cancelActiveMedia?.();
  for (const source of activeSources) {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }
  activeSources.clear();
}

export function playAudioBufferAsync(buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    playAudioBuffer(buffer, resolve);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
