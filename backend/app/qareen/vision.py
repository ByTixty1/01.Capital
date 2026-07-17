"""S3 "document possession" — one Claude vision call extracts stakeholder
fields from a commercial register photo. See QAREEN_BRIEF.md section 2.

The brief names "claude-sonnet-4-6" as the vision model; that id doesn't
exist in the current Anthropic catalog (confirmed against this session's
own model listing), so this uses claude-sonnet-5, the real current Sonnet
model — same substitution pattern as the TTS voice fix in tts.py.
"""

import json
import logging

import anthropic

from app.core.config import settings

from .brain import _strip_markdown_fence, _get_client
from .schemas import VisionExtractRequest, VisionExtractResponse

logger = logging.getLogger("01capital.qareen")

MODEL = "claude-sonnet-5"

EXTRACTION_PROMPT = """This is a photo of a Saudi commercial register (CR) \
document. Extract exactly these fields and respond ONLY with JSON, no \
prose, no markdown:

{ "name": "<the registered person or company name, or null>",
  "cr_number": "<the CR number, digits and dashes only, or null>",
  "shares": "<a share/ownership percentage if visibly stated, or null>" }

If a field isn't legible or present, use null for it. Never invent values."""


async def extract_from_document(request: VisionExtractRequest) -> VisionExtractResponse:
    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set — vision extraction returns empty fields")
        return VisionExtractResponse()

    client = _get_client()

    try:
        message = await client.messages.create(
            model=MODEL,
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": request.media_type,
                                "data": request.image_base64,
                            },
                        },
                        {"type": "text", "text": EXTRACTION_PROMPT},
                    ],
                }
            ],
        )
        text_blocks = [block.text for block in message.content if block.type == "text"]
        raw = _strip_markdown_fence("".join(text_blocks))
        data = json.loads(raw)
        return VisionExtractResponse(
            name=data.get("name"),
            cr_number=data.get("cr_number"),
            shares=str(data["shares"]) if data.get("shares") is not None else None,
        )
    except (anthropic.APIError, json.JSONDecodeError, KeyError):
        logger.exception("Qareen vision extraction failed")
        return VisionExtractResponse()
