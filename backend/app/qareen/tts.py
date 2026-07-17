"""edge-tts synthesis. Splits a say-line on "..." into segments — the
frontend schedules a PAUSE_MS silence between them during Web Audio
playback (see schemas.TtsResponse) rather than us splicing raw MP3 bytes,
which is fragile without a real audio-processing library.
"""

import base64
import logging

import edge_tts

from .schemas import TtsResponse, TtsSegment, WordTiming

logger = logging.getLogger("01capital.qareen")

# The brief specifies DavisNeural, but Microsoft has since retired that
# voice from the catalog (confirmed via edge_tts.list_voices() — 0 results
# for "Davis" in en-US). GuyNeural is the closest still-available match
# for "dry, unhurried, weighty" male delivery; Christopher is the fallback.
VOICE_PRIMARY = "en-US-GuyNeural"
VOICE_FALLBACK = "en-US-ChristopherNeural"
RATE = "-12%"
PITCH = "-6Hz"
PAUSE_MS = 450


def _ticks_to_ms(ticks: int) -> int:
    """edge-tts WordBoundary offsets are in 100-nanosecond units."""
    return ticks // 10_000


async def _synthesize_segment(text: str, voice: str) -> TtsSegment:
    # edge-tts >=7 defaults to boundary="SentenceBoundary" — we need
    # per-word timing for gesture sync, so this must be explicit.
    communicate = edge_tts.Communicate(text, voice=voice, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    audio = bytearray()
    timings: list[WordTiming] = []

    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            timings.append(WordTiming(word=chunk["text"], ms=_ticks_to_ms(chunk["offset"])))

    if not audio:
        raise RuntimeError(f"edge-tts returned no audio for voice={voice!r}")

    return TtsSegment(audio_base64=base64.b64encode(bytes(audio)).decode("ascii"), word_timings=timings)


async def synthesize_line(text: str) -> TtsResponse:
    segments_text = [part.strip() for part in text.split("...")]
    segments_text = [part for part in segments_text if part]
    if not segments_text:
        segments_text = [text]

    segments: list[TtsSegment] = []
    for part in segments_text:
        try:
            segments.append(await _synthesize_segment(part, VOICE_PRIMARY))
        except Exception:
            logger.warning("edge-tts primary voice failed, falling back to %s", VOICE_FALLBACK, exc_info=True)
            segments.append(await _synthesize_segment(part, VOICE_FALLBACK))

    return TtsResponse(segments=segments, pause_ms=PAUSE_MS)
