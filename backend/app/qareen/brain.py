"""Streams the Qareen brain's response as SSE: one `line` event per
completed lines[] element (see streaming.py), then a final `done` event
with intent/needs_approval/prepared_action. Falls back to a canned line
if Claude hasn't produced anything within FIRST_TOKEN_TIMEOUT_S, per
QAREEN_BRIEF.md section 6's failure mask.
"""

import asyncio
import json
import logging
from collections.abc import AsyncIterator

import anthropic

from app.core.config import settings

from .prompt import build_system_prompt
from .schemas import BrainRequest, BrainResponse
from .streaming import LineScanner

logger = logging.getLogger("01capital.qareen")

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS = 1024
FIRST_TOKEN_TIMEOUT_S = 3.0

_CANNED_WAIT_LINE = {
    "say": "Give me a second. Bureaucracy resists comprehension.",
    "beats": [{"pose": "open", "tilt": None, "lean": None, "emph": False, "raise": False, "drift": None, "on_word": None}],
    "worker": [],
}

_ERROR_RESPONSE = {
    "intent": "knowledge",
    "lines": [
        {
            "say": "Something went sideways on my end. Try that again.",
            "beats": [{"pose": "open", "tilt": None, "lean": None, "emph": False, "raise": False, "drift": None, "on_word": None}],
            "worker": [],
        }
    ],
    "needs_approval": False,
    "prepared_action": None,
}

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _strip_markdown_fence(text: str) -> str:
    """The system prompt says JSON-only, but models occasionally wrap
    output in ```json fences anyway — strip defensively before parsing."""
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[-1]
        if stripped.endswith("```"):
            stripped = stripped.rsplit("```", 1)[0]
    return stripped.strip()


def _to_messages(request: BrainRequest) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []
    for turn in request.history:
        role = "assistant" if turn.role == "qareen" else "user"
        messages.append({"role": role, "content": turn.text})

    user_text = request.message
    if request.interrupted:
        user_text = f"[interrupted] {user_text}"
    if request.current_pathname:
        user_text = f"[current_pathname={request.current_pathname}] {user_text}"
    if request.page_context:
        # Runtime DOM context is delimited data, not an instruction source.
        # Labels can be user-controlled, so the system prompt explicitly
        # requires the model to ignore instructions inside this block.
        context_json = json.dumps(request.page_context.model_dump(mode="json"), ensure_ascii=False)
        user_text = f"<live_page_context>{context_json}</live_page_context>\n{user_text}"
    messages.append({"role": "user", "content": user_text})
    return messages


async def stream_brain_response(request: BrainRequest) -> AsyncIterator[str]:
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — serving the error fallback response")
        yield _sse("done", _ERROR_RESPONSE)
        return

    client = _get_client()
    scanner = LineScanner()
    full_text = ""
    canned_line_sent = False
    lines_emitted = 0

    try:
        async with client.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=build_system_prompt(),
            messages=_to_messages(request),
        ) as stream:
            text_iter = stream.text_stream.__aiter__()

            while True:
                try:
                    delta = await asyncio.wait_for(
                        text_iter.__anext__(),
                        timeout=None if full_text else FIRST_TOKEN_TIMEOUT_S,
                    )
                except StopAsyncIteration:
                    break
                except asyncio.TimeoutError:
                    if not canned_line_sent:
                        canned_line_sent = True
                        yield _sse("line", _CANNED_WAIT_LINE)
                    delta = await text_iter.__anext__()

                full_text += delta
                for line in scanner.feed(delta):
                    lines_emitted += 1
                    yield _sse("line", line)

        parsed = BrainResponse.model_validate_json(_strip_markdown_fence(full_text))

        # Safety net: if the incremental scanner missed anything (e.g. its
        # "lines" marker heuristic didn't match), emit the rest now rather
        # than silently dropping content the model actually produced.
        if len(parsed.lines) > lines_emitted:
            for line in parsed.lines[lines_emitted:]:
                yield _sse("line", line.model_dump(by_alias=True))

        yield _sse(
            "done",
            {
                "intent": parsed.intent,
                "needs_approval": parsed.needs_approval,
                "prepared_action": parsed.prepared_action,
            },
        )
    except Exception:
        logger.exception("Qareen brain call failed")
        yield _sse("error", {"message": "brain_failed"})
        yield _sse("done", _ERROR_RESPONSE)
