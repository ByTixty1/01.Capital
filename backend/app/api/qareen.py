"""Qareen hackathon prototype router — no auth, no DB. See ADR-0009."""

import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.qareen.brain import stream_brain_response
from app.qareen.demo_seed import DEMO_SEED
from app.qareen.schemas import (
    BrainRequest,
    TtsRequest,
    TtsResponse,
    VisionExtractRequest,
    VisionExtractResponse,
)
from app.qareen.tts import synthesize_line
from app.qareen.vision import extract_from_document

logger = logging.getLogger("01capital.qareen")

router = APIRouter(prefix="/qareen", tags=["qareen"])


@router.get("/health")
async def qareen_health() -> dict:
    return {"status": "ok", "service": "qareen"}


@router.get("/demo-seed")
async def qareen_demo_seed() -> dict:
    """Static company context the frontend renders — same data injected into the brain's prompt."""
    return DEMO_SEED


@router.post("/brain/stream")
async def qareen_brain_stream(request: BrainRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_brain_response(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/tts", response_model=TtsResponse)
async def qareen_tts(request: TtsRequest) -> TtsResponse:
    return await synthesize_line(request.text)


@router.post("/vision/extract", response_model=VisionExtractResponse)
async def qareen_vision_extract(request: VisionExtractRequest) -> VisionExtractResponse:
    return await extract_from_document(request)
