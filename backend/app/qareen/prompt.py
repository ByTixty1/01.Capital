"""Loads system_prompt.md verbatim.

No placeholder injection anymore (see ADR-0010) — the real marketing
site's sample data is grounded directly in the prompt text itself,
since it's the same for every visitor rather than per-user/per-company
data pulled from a backend.
"""

from functools import lru_cache
from pathlib import Path

_PROMPT_PATH = Path(__file__).parent / "system_prompt.md"


@lru_cache(maxsize=1)
def build_system_prompt() -> str:
    return _PROMPT_PATH.read_text(encoding="utf-8")
