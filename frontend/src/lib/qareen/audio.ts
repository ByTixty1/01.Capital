'use client';

/**
 * Web Audio playback — per brief section 5, AudioBufferSourceNode not
 * <audio> tags, for sample-accurate queuing between per-line TTS segments.
 */

let audioCtx: AudioContext | null = null;
let mediaElement: HTMLAudioElement | null = null;
let cancelActiveMedia: (() => void) | null = null;
let primeHoldSource: AudioBufferSourceNode | null = null;
let primeHoldTimer: ReturnType<typeof setTimeout> | null = null;
const UNLOCK_SILENCE = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';
const PRIME_HOLD_MS = 30_000;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function getMediaElement(): HTMLAudioElement {
  if (!mediaElement) {
    // Reclaim the singleton after a Next.js hot reload. This also repairs an
    // element left looping by an older Qareen bundle without requiring the
    // user to close the tab.
    mediaElement = document.querySelector<HTMLAudioElement>('audio[data-qareen-audio="true"]') ?? new Audio();
    mediaElement.preload = 'auto';
    mediaElement.volume = 1;
    mediaElement.loop = false;
    delete mediaElement.dataset.qareenPrimeHold;
    mediaElement.setAttribute('playsinline', '');
    mediaElement.dataset.qareenAudio = 'true';
    mediaElement.style.display = 'none';
    if (!mediaElement.isConnected) document.body.appendChild(mediaElement);
  }
  return mediaElement;
}

function releasePrimeHold(): void {
  if (primeHoldTimer) {
    clearTimeout(primeHoldTimer);
    primeHoldTimer = null;
  }

  if (primeHoldSource) {
    try {
      primeHoldSource.stop();
    } catch {
      // The hold may already have been stopped by the browser.
    }
    primeHoldSource = null;
  }

  if (mediaElement) {
    mediaElement.loop = false;
    delete mediaElement.dataset.qareenPrimeHold;
  }

}

/**
 * Browser autoplay policies only reliably unlock audio while a click/key
 * gesture is still on the stack. Call this synchronously from every Qareen
 * input surface, before the brain/TTS network round trips begin.
 */
export function primeAudioPlayback(): boolean {
  releasePrimeHold();
  let primed = false;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') void ctx.resume();

    // Keep a zero-volume source running across the brain/TTS network delay.
    // Safari can suspend a context again after a one-sample unlock finishes.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22_050);
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    primeHoldSource = source;
    primed = true;
  } catch {
    // The native media path below may still be available.
  }

  try {
    const audio = getMediaElement();
    // Do not loop the silent media element. Safari can keep the old silent
    // decoder attached when a looping data URL is replaced, reporting
    // `play()` success while producing no audible speech.
    audio.loop = false;
    audio.src = UNLOCK_SILENCE;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
    primed = true;
  } catch {
    // Typed chat must still work on a browser/device without audio output.
  }

  if (primed) {
    primeHoldTimer = setTimeout(releasePrimeHold, PRIME_HOLD_MS);
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
    // Stop only the zero-gain Web Audio hold. The media element's one-shot
    // prime has already ended and is safe to replace with real speech.
    releasePrimeHold();
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
  releasePrimeHold();
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
