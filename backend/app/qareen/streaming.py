"""Incremental scanner that finds each completed `lines[]` element inside a
growing JSON text buffer, so the SSE endpoint can flush a line to the
frontend the instant Claude finishes generating it — instead of waiting
for the whole response and losing the "voice starts on line 1 while line
2 is still generating" latency win described in QAREEN_BRIEF.md section 6.

Only tracks object depth (`{`/`}`), string state, and backslash escapes —
sufficient for this schema (a "lines" array of flat-ish objects) without
needing a full JSON parser.
"""

import json
from typing import Any


class LineScanner:
    def __init__(self) -> None:
        self._buffer = ""
        self._array_started = False
        self._array_closed = False
        self._scan_pos = 0

    def feed(self, chunk: str) -> list[dict[str, Any]]:
        self._buffer += chunk
        completed: list[dict[str, Any]] = []

        if self._array_closed:
            return completed

        if not self._array_started:
            marker_idx = self._buffer.find('"lines"')
            if marker_idx == -1:
                return completed
            bracket_idx = self._buffer.find("[", marker_idx)
            if bracket_idx == -1:
                return completed
            self._array_started = True
            self._scan_pos = bracket_idx + 1

        depth = 0
        in_string = False
        escaped = False
        obj_start: int | None = None
        buf = self._buffer
        i = self._scan_pos

        while i < len(buf):
            ch = buf[i]
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
            else:
                if ch == '"':
                    in_string = True
                elif ch == "{":
                    if depth == 0:
                        obj_start = i
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0 and obj_start is not None:
                        raw = buf[obj_start : i + 1]
                        try:
                            completed.append(json.loads(raw))
                        except json.JSONDecodeError:
                            pass
                        obj_start = None
                        self._scan_pos = i + 1
                elif ch == "]" and depth == 0:
                    self._array_closed = True
                    self._scan_pos = i + 1
                    return completed
            i += 1

        return completed
