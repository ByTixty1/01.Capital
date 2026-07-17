# Changelog

All notable changes to this project are recorded here. We follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) loosely, adapted for an early-stage project where versions don't yet matter.

---

## [Unreleased] — 2026-05-05

### Added
- Initial repository structure (Sprint 0 scaffold)
- README, LICENSE, .gitignore
- Consultant operating spec (`CONSULTANT_SPEC.md`)
- Project rules for AI assistants (`.agents/rules/`)
- Saudi Companies Law digest (bilingual, operational)
- CMA ESOP regulations digest (bilingual)
- ZATCA & MoC filing notes
- Bilingual cap table glossary
- 14-day discovery sprint plan
- Founder interview script (English + Arabic)
- Outreach templates (English + Arabic)
- Competitive teardown framework
- Implementation plan v0.1
- Brand guidelines
- ADR-0001: Pivot from Stock Intelligence Platform to Cap Table Software
- ADR template for future decisions
- Backend scaffold: FastAPI + Postgres + Alembic, auth-only routes
- Frontend scaffold: Next.js 15 + brand tokens
- Docker compose for local dev
- GitHub Actions CI

### Fixed

- Changed Qareen voice input to explicit, pause-safe dictation. Recognition now
  writes into the chat composer, reopens after browser endpointing, and sends
  only when the user presses Send.
- Changed Qareen's chat composer to support multiline messages, with Enter for
  new lines and Ctrl/Cmd+Enter for submission.
- Allowed same-origin microphone access in the frontend Permissions Policy so
  Safari can use Qareen dictation while camera and geolocation remain disabled.
- Made stopping Qareen dictation submit the completed draft exactly once, so a
  manual mic stop reliably starts Claude, TTS, and hand guidance.

### Status
Pre-discovery. No paying customers. No production deployment. The 14-day discovery sprint kicks off when the team is ready.
