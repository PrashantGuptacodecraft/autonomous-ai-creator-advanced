# SignalFoundry — Autonomous AI Creator

SignalFoundry is an evidence-first autonomous editorial system for the Autonomous AI Creator challenge. One initialization request creates a stable AI/technology persona and starts a durable workflow. The workflow independently discovers live information, clusters corroborating sources into stories, rejects weak candidates, consults memory, writes in a consistent voice, verifies claims, and publishes over time.

The evaluator feed is intentionally read-only. It cannot trigger research, generation, scheduling, or publication.

## Challenge contract

```text
POST /api/agent/init                 called exactly once
GET  /api/agent/feed?agentId=...     called repeatedly afterward
```

```text
Initialization
    ├── validate AI/technology persona
    ├── compile and freeze persona constitution
    ├── initialize tamper-evident autonomy ledger
    ├── activate agent before workflow start
    ├── start durable 50-hour workflow
    └── return agentId

Durable workflow
    ├── sleep until next research window
    ├── discover live source items
    ├── group related items into story clusters
    ├── measure source independence and corroboration
    ├── reject, hold, merge, or select
    ├── retrieve published, rejected, semantic, and narrative memory
    ├── draft from a bounded evidence bundle
    ├── verify claims, rationale, sources, and persona consistency
    ├── publish atomically or intentionally publish nothing
    ├── record reflection and hash-linked lifecycle event
    └── schedule the next cycle

Feed request
    └── SELECT immutable posts ORDER BY created_at DESC, id DESC
```

## Why this version is different

### Story-level evidence, not isolated links

Related items are clustered into a single story. The system identifies a canonical source, labels other sources as corroborating evidence or discovery signals, and measures how many genuinely independent publishers support the story.

### Editorial judgment is persisted

Every candidate receives a decision record:

- `PUBLISH`
- `REJECT`
- `HOLD`
- `MERGE`
- `DUPLICATE`

A cycle that publishes nothing is valid and recorded as editorial restraint.

### Five-layer memory

1. Exact URL and content fingerprints
2. Lexical similarity to recent posts
3. Semantic similarity through pgvector embeddings
4. Negative memory of rejected topics and reasons
5. Narrative and reflective memory for continuity

### Claim-level evidence

Each published claim stores its supporting source URLs. A deterministic quality gate refuses unsupported URLs, incomplete rationales, weak persona alignment, excessive hype, or repeated angles.

### Material-update detection

A canonical URL already used by a post is not automatically republished. The system permits a follow-up only when the persisted source item changed, its timestamp is newer than the prior publication, and the evidence is materially different.

### Tamper-evident autonomy proof

Initialization, workflow attachment, cycle starts, cycle completions, publications, completion, and failure events form a SHA-256 hash chain. The dashboard continuously verifies the chain and exposes its head hash without modifying the evaluator feed contract.

### Crash-safe and replay-safe operation

- Vercel Workflow handles durable sleeps and step persistence.
- Unique `(agent_id, cycle_number)` prevents concurrent duplicate cycles.
- Atomic publication writes the post, sources, claims, memory, narrative update, run state, counters, and proof events in one transaction.
- A failed cycle records failure and schedules another research window without exposing a partial post.

## Technology stack

- Next.js 16 App Router and TypeScript
- Vercel Workflow 4
- Vercel AI SDK 7 and AI Gateway model strings
- Neon PostgreSQL with pgvector
- Zod structured-output validation
- Vitest
- Docker and GitHub Actions

Current default model routing:

```env
EDITORIAL_MODELS=openai/gpt-5.4-mini,google/gemini-3.5-flash
WRITER_MODELS=openai/gpt-5.4-mini,anthropic/claude-sonnet-5
VERIFIER_MODELS=google/gemini-3.5-flash,openai/gpt-5.4-mini
EMBEDDING_MODELS=openai/text-embedding-3-small
```

All model identifiers are environment-controlled.

## Live source adapters

- Official RSS and Atom feeds
- GitHub Releases API
- arXiv Atom API
- Hacker News discovery signals followed to the original article

Source handling includes:

- canonical URL normalization
- independent-publisher keys
- DNS and private-network checks
- manual redirect validation
- timeouts
- streaming byte limits
- HTML and instruction-shaped content sanitization
- bounded concurrent fetching
- adapter-level failure isolation
- source reliability telemetry

## Quick start

### Requirements

- Node.js 22+
- PostgreSQL 16/17 with the `vector` extension, or Neon
- Vercel AI Gateway key for AI-assisted production output

### Install

```bash
npm install
cp .env.example .env.local
```

Add:

```env
DATABASE_URL=postgresql://...
AI_GATEWAY_API_KEY=...
```

Optional:

```env
GITHUB_TOKEN=...
ADMIN_API_KEY=...
```

### Migrate and verify

```bash
npm run db:migrate
npm run verify
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Required API

### Initialize exactly once

```bash
curl -X POST http://localhost:3000/api/agent/init \
  -H 'Content-Type: application/json' \
  -d '{
    "persona": {
      "name": "Ada",
      "domain": "AI Security"
    }
  }'
```

Response:

```json
{
  "agentId": "agt_..."
}
```

### Retrieve feed

```bash
curl 'http://localhost:3000/api/agent/feed?agentId=agt_...'
```

```json
{
  "posts": [
    {
      "id": "p_...",
      "createdAt": "2026-08-07T10:30:00.000Z",
      "text": "...",
      "rationale": "...",
      "sources": ["https://..."]
    }
  ]
}
```

Guarantees:

- newest first
- unique post IDs
- UTC ISO 8601 timestamps
- old posts remain available
- no generation side effects
- `Cache-Control: no-store`
- `{ "posts": [] }` before the first publication

OpenAPI: `public/openapi.json`

## Operational endpoints

These are not required by the evaluator:

```text
GET /api/health
GET /api/agent/status?agentId=...
GET /api/dashboard/{agentId}
GET /api/workflow/{runId}       requires ADMIN_API_KEY; disabled otherwise
```

Dashboard:

```text
/agent/{agentId}
```

The dashboard displays:

- workflow state and next cycle
- immutable feed
- editorial selectivity
- average publication quality
- independent-source depth
- live source reliability
- model fallback audit
- story clusters and corroboration scores
- rejected candidate ledger
- narrative memory
- hash-linked autonomy proof

## Production cadence

Default values cover the full 48-hour evaluation:

```env
FIRST_CYCLE_DELAY_SECONDS=45
MIN_CYCLE_DELAY_SECONDS=5400
MAX_CYCLE_DELAY_SECONDS=10800
MAX_AUTONOMOUS_CYCLES=36
EVALUATION_WINDOW_HOURS=50
MIN_POST_SPACING_MINUTES=135
MAX_POSTS_PER_DAY=6
```

This produces repeated research opportunities throughout the observation period without forcing a post on every cycle.

For a local demo only:

```env
FIRST_CYCLE_DELAY_SECONDS=3
MIN_CYCLE_DELAY_SECONDS=60
MAX_CYCLE_DELAY_SECONDS=90
MAX_AUTONOMOUS_CYCLES=6
MIN_POST_SPACING_MINUTES=1
```

## Database migrations

```text
0001_initial.sql                 core agents, posts, memory, decisions
0002_evidence_intelligence.sql   clusters, quality, model/source telemetry
0003_autonomy_proof.sql          hash-linked lifecycle ledger
```

The migration runner records checksums in `schema_migrations` and refuses a changed migration that was already applied.

## Verification

```bash
npm run verify:static
npm run typecheck
npm test
npm run test:simulation
npm run build
```

The accelerated simulation proves:

- multi-source story clustering
- editorial selection
- deterministic quality gate
- 48-hour lifecycle coverage
- repeated autonomous opportunities without feed-triggered work

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

Production sequence:

1. Create Neon database.
2. Configure environment variables.
3. Run migrations.
4. Run the complete verification suite.
5. Deploy to Vercel.
6. Verify `/api/health`.
7. Call initialization once.
8. Save the `agentId` and evaluator feed URL.
9. Do not call another write endpoint.

## Documentation

- [`docs/Autonomous_AI_Creator_Advanced_Architecture.docx`](docs/Autonomous_AI_Creator_Advanced_Architecture.docx) — polished 16-page architecture and Codex handoff
- [`docs/signal_foundry_architecture.png`](docs/signal_foundry_architecture.png) — system architecture diagram
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/ADVANCED_FEATURES.md`](docs/ADVANCED_FEATURES.md)
- [`docs/API.md`](docs/API.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/TESTING.md`](docs/TESTING.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
- [`docs/JUDGE_DEMO.md`](docs/JUDGE_DEMO.md)
- [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md)

## Continue in Codex

Read these in order:

1. `AGENTS.md`
2. `CODEX_START_HERE.md`
3. `BUILD_STATUS.md`
4. `docs/ARCHITECTURE.md`

The evaluator API contract, read-only feed, durable workflow separation, immutable publication model, and database migration history are locked constraints.
