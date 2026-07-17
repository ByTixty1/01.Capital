# Instructions for Claude Code (and other agentic coding tools)

---

## What this project is

01 Capital is **cap table and equity management software** for Saudi startups, built natively around the 2023 Saudi Companies Law. It is a B2B SaaS product designed for compliance-grade legal correctness, not a consumer or fintech-trading product.

The repository was previously used for a TASI stock analysis platform — fully deprecated. Do not reference, restore, or reimplement anything from that direction.

---

## Current phase

**Build — Sprint 5 active.** Sprints 0–4 complete. Sprint 5 in progress (sophisticated instruments, anti-dilution, waterfall). The implementation plan in `docs/product/implementation-plan.md` is the active plan.

Do not add features outside the current sprint scope without an ADR. If asked to build something not in the current sprint, flag it and ask for explicit override.

---

## Development workflow (Gstack)

This project uses [Gstack](https://github.com/garrytan/gstack) — a structured AI workflow system installed at `~/.claude/skills/gstack`. Follow this loop for every feature or sprint task:

| Phase | Skill | When to use |
|-------|-------|-------------|
| Brainstorm / scope | `/office-hours` | Starting a new sprint feature or unclear requirement |
| Architecture review | `/plan-eng-review` | Before implementing anything non-trivial |
| Code review | `/review` | After every implementation — auto-fixes obvious issues |
| Frontend QA | `/qa http://localhost:3000` | After UI changes — opens real browser, finds bugs |
| Security audit | `/cso` | Before any auth, encryption, or RBAC change |
| Ship | `/ship` | Runs tests, opens PR, pushes — replaces manual git flow |
| Weekly reflection | `/retro` | End of each sprint week |

**Safety tools:**
- `/careful` — warns before destructive commands (DROP TABLE, rm -rf, force-push)
- `/freeze` — locks edits to one directory while debugging a tricky issue

**GBrain** (persistent knowledge base): run `/setup-gbrain` once to connect to Supabase, then `/sync-gbrain` after significant code changes to keep the knowledge graph current.

**Browser daemon** (`browse`): starts automatically on first `/qa` call. Frontend must be running on `localhost:3000` and backend on `localhost:8000`.

---

## How to start any session

Read these in order — do not skip any:

1. `CLAUDE.md` (this file)
2. `CONSULTANT_SPEC.md` — how an AI consultant works with this team
3. `.agents/rules/01-project-rules.md` — the locked project rules
4. `docs/decisions/0001-pivot-to-cap-table.md` — strategic anchor
5. `docs/product/implementation-plan.md` — active sprint plan (Sprint 5 in progress)
6. `docs/STANDARDS.md` — engineering standards (API design, data model rules, Saudi law compliance, definition of done)
7. `graphify-out/GRAPH_REPORT.md` — codebase knowledge graph; run `/graphify --update` after significant code changes

Then check Gstack is ready: `ls ~/.claude/skills/gstack/` should list skill directories.

---

## Hard rules (do not violate)

### 1. Saudi Companies Law is the substrate
- Every cap table feature must be validated against `docs/law/saudi-companies-law-digest.md`
- When in doubt, cite the article number in code comments
- Saudi entity types (LLC, SJSC, JSC) are not interchangeable — the data model must distinguish them
- Do not import US/Delaware mental models — they will be wrong for Saudi corporate law

### 2. Cap table is a legal document
- Every state-changing operation must be event-sourced (immutable event log; current state is materialized)
- The audit log is non-negotiable — never UPDATE or DELETE on the events table
- Generated documents must include the watermark "DRAFT — REVIEW WITH LEGAL COUNSEL" until reviewed
- Never auto-submit to regulators (MoC, ZATCA, CMA) — surface and structure only

### 3. Multi-tenancy from day one
- One company = one tenant. Users may belong to multiple companies.
- Row-level security at the Postgres layer, not just app-layer checks
- Never write a query that doesn't scope by tenant

### 4. Bilingual readiness
- All customer-facing strings must be designed for Arabic translation
- Numbers and IDs render in monospace (`var(--font-mono)`)
- Never hardcode currency symbols — use SAR formatting helpers
- Right-to-left layout must work for any view that will eventually be Arabic

### 5. Sensitive data
- Never log national IDs, IBANs, or other PII
- Saudi data residency: production data must run on Saudi-hosted infrastructure
- Document retention follows Saudi corporate law — typically 10 years for corporate records

### 6. AI is not the core
- The cap table engine is fully deterministic
- AI features are optional, narrow, and replaceable — never core to ownership calculations or legal logic
- Do not introduce LLM dependencies into critical paths

### 7. ADR every non-trivial decision
- Architecture decisions, dependency additions, schema changes, security choices → write an ADR in `docs/decisions/`
- Use `docs/decisions/TEMPLATE.md` — one page, specific, dated

### 8. Security baseline before real customer data
- MFA (TOTP) required for all users before any real cap table data is entered
- RBAC: admin / editor / viewer — never mix permissions
- National IDs, IBANs, and other PII must be encrypted at the field level in the DB
- Audit log of every login, export, and document access — not just cap table state changes
- No real customer data until: MFA live, RBAC live, field encryption live
- External penetration test before first paying customer

### 9. Document generation is core, not optional
- PDF export of cap table (current state + fully diluted) is a Sprint 3 deliverable
- All generated documents carry "DRAFT — REVIEW WITH LEGAL COUNSEL" watermark until a lawyer signs off
- Bilingual output (EN + AR) required from the first document template
- Documents must be legally formatted for Saudi corporate law, not generic PDFs
- Secondary transactions must be supported before document generation ships

---

## Technical stack (locked)

- **Backend:** FastAPI 0.115+, Python 3.12+, SQLAlchemy 2.0 async, Pydantic 2, Alembic
- **Frontend:** Next.js 16, TypeScript strict mode, React 19 (see ADR-0007)
- **Database:** PostgreSQL 16
- **Cache:** Redis (when needed; not on day one)
- **CI:** GitHub Actions — both jobs must be green before merging

Do not introduce new frameworks, libraries, or services without an ADR.

---

## Code style and standards

### Python
- Type hints on all public functions
- No `Any` unless truly unavoidable, and document why
- Async for all I/O
- Pydantic models for all API contracts
- Tests for domain logic at 80%+ coverage

### TypeScript
- `strict: true` always
- No `any`
- Named exports, not default (except for Next.js page components)
- Server components by default; client components only when interaction requires it

### General
- Small, focused PRs with conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Comments explain *why*, not *what*
- No premature abstractions, no speculative features

---

## How to handle ambiguity

1. Check the project rules first — many ambiguities are resolved by `.agents/rules/01-project-rules.md`
2. Check the implementation plan — `docs/product/implementation-plan.md` defines sprint scope
3. Ask the user one specific clarifying question — the one that most determines the path forward
4. Default to the more conservative interpretation — thin slice first, ask before expanding

---

## How to handle disagreement

If the user asks for something that conflicts with the project rules:

1. State the conflict specifically (cite the rule or document)
2. Propose what you'd do instead
3. Wait for the user to confirm: override the rule, or pick the alternative
4. If they override, document the override in an ADR before implementing

Do not silently comply with rule-violating requests. Do not refuse and stop. Surface the conflict, propose a path, defer to the user.

---

## When in doubt

- *Strategic* questions (should we build X, positioning, customer): defer to the user
- *Legal* questions (Saudi law, lawyer review needed): defer to the user and flag for legal review — do not invent legal interpretations
- *Technical* questions (architecture, library choice): propose with clear reasoning, ask the user to confirm, document in an ADR

---

## Health Stack

- typecheck: cd frontend && npx tsc --noEmit
- lint: cd frontend && npx eslint .
- test: cd backend && .venv/bin/python3.13 -m pytest (env: TEST_DATABASE_URL → local 01capital_test DB, RATE_LIMIT_ENABLED=false, DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib; never run overlapping pytest sessions)
- deadcode: skipped (knip not installed)
- shell: skipped (shellcheck not installed)

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
