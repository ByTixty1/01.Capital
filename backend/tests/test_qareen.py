"""Qareen hackathon prototype smoke tests. DB-free — uses the plain `client`
fixture from conftest.py, same pattern as test_health.py.
"""

import json
from collections.abc import AsyncIterator

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.qareen import brain as brain_module
from app.qareen import vision as vision_module
from app.qareen.schemas import BrainRequest
from app.qareen.streaming import LineScanner

# ── LineScanner (pure logic, no network) ────────────────────────────────────


def test_line_scanner_finds_a_single_complete_line() -> None:
    scanner = LineScanner()
    payload = (
        '{"intent":"explain","lines":[{"say":"Hi.","beats":[],"worker":[]}]'
        ',"needs_approval":false,"prepared_action":null}'
    )
    found = scanner.feed(payload)
    assert len(found) == 1
    assert found[0]["say"] == "Hi."


def test_line_scanner_handles_incremental_chunks_and_nested_arrays() -> None:
    scanner = LineScanner()
    payload = (
        '{"intent":"howto","lines":['
        '{"say":"First.","beats":[{"pose":"point","tilt":10.5,"lean":null,'
        '"emph":true,"raise":false,"drift":[1.0,2.0],"on_word":0}],"worker":[]},'
        '{"say":"Second.","beats":[],"worker":[{"move":"press","target":"risk_badge",'
        '"text":null,"on_word":null}]}'
        '],"needs_approval":true,"prepared_action":"file VAT"}'
    )
    found: list[dict] = []
    for i in range(0, len(payload), 7):
        found.extend(scanner.feed(payload[i : i + 7]))

    assert [line["say"] for line in found] == ["First.", "Second."]
    assert found[0]["beats"][0]["pose"] == "point"
    assert found[0]["beats"][0]["drift"] == [1.0, 2.0]
    assert found[1]["worker"][0]["target"] == "risk_badge"


def test_line_scanner_ignores_braces_inside_strings() -> None:
    scanner = LineScanner()
    payload = '{"intent":"knowledge","lines":[{"say":"Use {curly} braces.","beats":[],"worker":[]}],"needs_approval":false,"prepared_action":null}'
    found = scanner.feed(payload)
    assert len(found) == 1
    assert found[0]["say"] == "Use {curly} braces."


def test_live_page_context_is_delimited_as_untrusted_runtime_data() -> None:
    request = BrainRequest.model_validate(
        {
            "message": "Where is sign in?",
            "current_pathname": "/",
            "page_context": {
                "pathname": "/",
                "title": "01 Capital",
                "viewport": {"width": 1280, "height": 720, "scroll_y": 0},
                "elements": [
                    {
                        "target_id": "nav_sign_in",
                        "role": "link",
                        "label": "Sign in",
                        "tag": "a",
                        "interactive": True,
                        "action": "navigate:/login",
                        "href": "/login",
                        "position": "top right",
                        "x_percent": 96,
                        "y_percent": 7,
                        "appearance": "gray text, transparent background, gray border",
                        "disabled": False,
                        "current": False,
                    }
                ],
            },
        }
    )

    content = brain_module._to_messages(request)[-1]["content"]
    assert content.startswith("<live_page_context>")
    assert "</live_page_context>" in content
    assert '"target_id": "nav_sign_in"' in content
    assert content.endswith("[current_pathname=/] Where is sign in?")


# ── HTTP endpoints ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_qareen_health(client: AsyncClient) -> None:
    res = await client.get("/api/qareen/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "service": "qareen"}


@pytest.mark.asyncio
async def test_qareen_demo_seed_shape(client: AsyncClient) -> None:
    res = await client.get("/api/qareen/demo-seed")
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["name"] == "Ali"
    assert len(data["stakeholders"]) == 3
    assert data["risk"]["score"] == 68


@pytest.mark.asyncio
async def test_qareen_tts_returns_audio_and_word_timings(client: AsyncClient) -> None:
    """Real edge-tts call — free, keyless, but needs outbound network."""
    res = await client.post("/api/qareen/tts", json={"text": "Twelve days."})
    assert res.status_code == 200
    data = res.json()
    assert len(data["segments"]) == 1
    assert len(data["segments"][0]["audio_base64"]) > 100
    assert len(data["segments"][0]["word_timings"]) >= 1


@pytest.mark.asyncio
async def test_qareen_tts_splits_ellipsis_into_segments(client: AsyncClient) -> None:
    res = await client.post("/api/qareen/tts", json={"text": "Wait... forty thousand riyals."})
    assert res.status_code == 200
    data = res.json()
    assert len(data["segments"]) == 2
    assert data["pause_ms"] == 450


@pytest.mark.asyncio
async def test_qareen_brain_stream_without_api_key_falls_back_cleanly(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """No ANTHROPIC_API_KEY configured — must degrade, not crash, per the
    brief's failure-mask requirement. Forced via monkeypatch rather than
    asserting on the ambient environment, since a real dev key may be
    configured locally (see backend/.env)."""
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    res = await client.post("/api/qareen/brain/stream", json={"message": "hello", "history": []})
    assert res.status_code == 200
    assert "event: done" in res.text
    assert "brain_failed" not in res.text  # no-key path is a clean fallback, not an error


class _FakeTextStream:
    def __init__(self, chunks: list[str]) -> None:
        self._chunks = chunks

    def __aiter__(self) -> AsyncIterator[str]:
        return self._gen()

    async def _gen(self) -> AsyncIterator[str]:
        for chunk in self._chunks:
            yield chunk


class _FakeMessageStream:
    def __init__(self, chunks: list[str]) -> None:
        self.text_stream = _FakeTextStream(chunks)

    async def __aenter__(self) -> "_FakeMessageStream":
        return self

    async def __aexit__(self, *exc: object) -> bool:
        return False


class _FakeMessages:
    def __init__(self, chunks: list[str]) -> None:
        self._chunks = chunks

    def stream(self, **kwargs: object) -> _FakeMessageStream:
        return _FakeMessageStream(self._chunks)


class _FakeAnthropicClient:
    def __init__(self, chunks: list[str]) -> None:
        self.messages = _FakeMessages(chunks)


@pytest.mark.asyncio
async def test_qareen_brain_stream_emits_lines_incrementally_and_a_done_event(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    payload = {
        "intent": "explain",
        "lines": [
            {"say": "Ali. One tax filing due in twelve days.", "beats": [], "worker": []},
        ],
        "needs_approval": False,
        "prepared_action": None,
    }
    full_text = json.dumps(payload)
    chunks = [full_text[i : i + 9] for i in range(0, len(full_text), 9)]

    monkeypatch.setattr(settings, "anthropic_api_key", "fake-key-for-test")
    monkeypatch.setattr(brain_module, "_get_client", lambda: _FakeAnthropicClient(chunks))

    res = await client.post("/api/qareen/brain/stream", json={"message": "explain my situation", "history": []})
    assert res.status_code == 200

    line_events = [
        json.loads(block.split("data: ", 1)[1])
        for block in res.text.split("\n\n")
        if block.startswith("event: line")
    ]
    done_events = [
        json.loads(block.split("data: ", 1)[1])
        for block in res.text.split("\n\n")
        if block.startswith("event: done")
    ]

    assert len(line_events) == 1
    assert line_events[0]["say"] == "Ali. One tax filing due in twelve days."
    assert len(done_events) == 1
    assert done_events[0]["intent"] == "explain"
    assert done_events[0]["needs_approval"] is False


# ── Vision extraction (S3) ───────────────────────────────────────────────────


class _FakeTextBlock:
    def __init__(self, text: str) -> None:
        self.type = "text"
        self.text = text


class _FakeVisionMessage:
    def __init__(self, text: str) -> None:
        self.content = [_FakeTextBlock(text)]


class _FakeVisionMessages:
    def __init__(self, response_text: str) -> None:
        self._response_text = response_text

    async def create(self, **kwargs: object) -> _FakeVisionMessage:
        return _FakeVisionMessage(self._response_text)


class _FakeVisionClient:
    def __init__(self, response_text: str) -> None:
        self.messages = _FakeVisionMessages(response_text)


@pytest.mark.asyncio
async def test_qareen_vision_extract_without_api_key_returns_empty_fields(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Forced via monkeypatch rather than asserting on the ambient
    # environment — a real dev key may be configured locally.
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    res = await client.post("/api/qareen/vision/extract", json={"image_base64": "Zm9v", "media_type": "image/jpeg"})
    assert res.status_code == 200
    assert res.json() == {"name": None, "cr_number": None, "shares": None}


@pytest.mark.asyncio
async def test_qareen_vision_extract_parses_the_model_response(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "fake-key-for-test")
    response_json = json.dumps({"name": "Sarah Alotaibi", "cr_number": "4030-999888", "shares": 12})
    monkeypatch.setattr(vision_module, "_get_client", lambda: _FakeVisionClient(response_json))

    res = await client.post("/api/qareen/vision/extract", json={"image_base64": "Zm9v", "media_type": "image/jpeg"})
    assert res.status_code == 200
    assert res.json() == {"name": "Sarah Alotaibi", "cr_number": "4030-999888", "shares": "12"}
