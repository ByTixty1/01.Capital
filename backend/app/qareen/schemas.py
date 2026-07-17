"""Pydantic models for the Qareen brain/TTS wire contract.

Field names mirror QAREEN_SYSTEM_PROMPT.md's JSON schema exactly
(snake_case) so the LLM's raw output round-trips through these models
without any renaming layer.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

BrainIntent = Literal["explain", "howto", "delegate", "knowledge", "bad_news", "good_news", "approval"]
HandPose = Literal["open", "point", "two", "three", "pinch", "fist", "grab", "tap", "relax", "grip_wrist"]
WorkerMoveType = Literal["glide", "press", "type", "circle", "retreat", "home"]


class Beat(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    pose: HandPose
    tilt: float | None = None
    lean: float | None = None
    emph: bool = False
    # "raise" is a Python keyword — the wire field is aliased to it.
    raise_: bool = Field(default=False, alias="raise")
    drift: tuple[float, float] | None = None
    on_word: int | None = None


class WorkerMove(BaseModel):
    move: WorkerMoveType
    target: str | None = None
    text: str | None = None
    on_word: int | None = None


class BrainLine(BaseModel):
    say: str
    beats: list[Beat] = Field(default_factory=list)
    worker: list[WorkerMove] = Field(default_factory=list)


class BrainResponse(BaseModel):
    intent: BrainIntent
    lines: list[BrainLine]
    needs_approval: bool = False
    prepared_action: str | None = None


class BrainConversationTurn(BaseModel):
    role: Literal["user", "qareen"]
    text: str


class PageElementContext(BaseModel):
    target_id: str = Field(max_length=96)
    role: str = Field(max_length=32)
    label: str = Field(max_length=140)
    tag: str = Field(max_length=24)
    interactive: bool = False
    action: str = Field(max_length=180)
    href: str | None = Field(default=None, max_length=300)
    position: str = Field(max_length=64)
    x_percent: int = Field(ge=-1000, le=1000)
    y_percent: int = Field(ge=-1000, le=1000)
    appearance: str = Field(max_length=160)
    disabled: bool = False
    current: bool = False


class PageContext(BaseModel):
    pathname: str = Field(max_length=300)
    title: str = Field(max_length=200)
    viewport: dict[str, int] = Field(default_factory=dict)
    elements: list[PageElementContext] = Field(default_factory=list, max_length=120)


class BrainRequest(BaseModel):
    message: str
    history: list[BrainConversationTurn] = Field(default_factory=list)
    interrupted: bool = False
    current_pathname: str | None = None
    page_context: PageContext | None = None


class TtsRequest(BaseModel):
    text: str


class WordTiming(BaseModel):
    word: str
    ms: int


class TtsSegment(BaseModel):
    audio_base64: str
    word_timings: list[WordTiming]


class TtsResponse(BaseModel):
    """A say-line split on "..." into segments — the frontend schedules a
    pause_ms silence between segments during Web Audio playback rather than
    the backend splicing raw MP3 bytes together."""

    segments: list[TtsSegment]
    pause_ms: int = 450


class VisionExtractRequest(BaseModel):
    image_base64: str
    media_type: Literal["image/jpeg", "image/png", "image/webp"] = "image/jpeg"


class VisionExtractResponse(BaseModel):
    name: str | None = None
    cr_number: str | None = None
    shares: str | None = None
