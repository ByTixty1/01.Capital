# ADR-0011: Host the backend on Render (replacing Railway config)

**Status:** Proposed

**Date:** 2026-07-17

**Authors:** Ali

---

## Context

The frontend is deployed on Vercel and reaches FastAPI exclusively through the
server-side `/api/backend` proxy (`frontend/src/app/api/backend/[...path]/route.ts`),
so the backend can live on any host reachable by Vercel's servers. The repo
carried Railway deployment config (`railway.json`, `backend/railway.toml`), but
no active Railway deployment is in use. The database is Supabase (managed
Postgres), so the backend host only needs to run the existing Docker image and
reach Supabase over the network.

ADR-0006 requires Saudi-hosted infrastructure for real customer data. No real
customer data exists yet; this deployment serves demo/staging use.

---

## Decision

Deploy the backend to Render as a Docker web service, defined in `render.yaml`
at the repo root (Blueprint, infra-as-code):

- Region **Frankfurt** (Render's closest region to Saudi Arabia)
- Health check on `/ping` (DB-independent, avoids restart loops when the DB is briefly unreachable)
- `ENVIRONMENT=production` with real secrets — the entrypoint and Pydantic
  validators refuse dev-default `JWT_SECRET_KEY` / `FIELD_ENCRYPTION_KEY`
- Database via the Supabase **session pooler** (IPv4, port 5432), because
  Supabase direct connections are IPv6-only and the transaction pooler breaks
  asyncpg prepared statements

The Railway config files are superseded and can be removed once Render is
confirmed working.

---

## Consequences

### Positive
- Single-file, reviewable deployment definition (`render.yaml`) rather than dashboard-only state
- Auto-deploy from `main`; migrations run automatically via `entrypoint.sh`
- Free tier available for the demo phase

### Negative
- Free tier spins down after idle — first request after sleep is slow and re-runs migrations; upgrade to `starter` to keep warm
- Render has no Middle East region; Frankfurt does not satisfy ADR-0006 for real customer data
- Rotating `FIELD_ENCRYPTION_KEY` orphans ciphertexts created with the old key (existing dev-encrypted MFA secrets / national IDs in Supabase will not decrypt)

### Neutral but worth noting
- The browser never calls Render directly; CORS is belt-and-braces via `CORS_ORIGINS`
- `entrypoint.sh` runs `alembic upgrade head` on every boot — acceptable at 1 instance, must move to a release job before scaling out

---

## Alternatives considered

- **Railway** — config existed in-repo but was never the active deployment; team preference is Render
- **Fly.io** — no clear advantage for a single Docker service; another CLI to learn
- **AWS Bahrain (me-south-1)** — required for production customer data per ADR-0006, but heavier setup than the demo phase warrants; revisit before onboarding real customers

---

## References

- ADR-0002 (initial stack), ADR-0006 (data residency)
- `render.yaml`, `backend/Dockerfile`, `backend/entrypoint.sh`
- Supabase connection pooling docs (session vs transaction mode with asyncpg)
