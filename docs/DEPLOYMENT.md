# Production Deployment

## 1. Create Neon PostgreSQL

Create a Neon project with a pooled TLS connection string.

```env
DATABASE_URL=postgresql://...
```

Run all migrations from a trusted machine:

```bash
npm install
npm run db:migrate
```

The runner applies files in sorted order, records SHA-256 checksums, and refuses modified applied migrations.

## 2. Configure AI Gateway

```env
AI_GATEWAY_API_KEY=...
EDITORIAL_MODELS=openai/gpt-5.4-mini,google/gemini-3.5-flash
WRITER_MODELS=openai/gpt-5.4-mini,anthropic/claude-sonnet-5
VERIFIER_MODELS=google/gemini-3.5-flash,openai/gpt-5.4-mini
EMBEDDING_MODELS=openai/text-embedding-3-small
```

Model routes are ordered. The next model is attempted only after the previous model fails.

## 3. Configure sources

Optional read-only GitHub token:

```env
GITHUB_TOKEN=...
```

Optional public sources:

```env
EXTRA_RSS_FEEDS=https://example.com/feed.xml
EXTRA_GITHUB_REPOS=owner/repository
```

Do not grant repository write permissions.

## 4. Production policy

Recommended:

```env
ALLOW_DEMO_FALLBACK=true
ADMIN_API_KEY=<strong-random-secret>
FIRST_CYCLE_DELAY_SECONDS=45
MIN_CYCLE_DELAY_SECONDS=5400
MAX_CYCLE_DELAY_SECONDS=10800
MAX_AUTONOMOUS_CYCLES=36
EVALUATION_WINDOW_HOURS=50
```

Safe fallback preserves continuity during a temporary model outage, but production-quality writing still requires `AI_GATEWAY_API_KEY`.

## 5. Verify locally or in CI

```bash
npm run verify
```

This runs contract checks, TypeScript, unit tests, accelerated lifecycle simulation, and production build.

## 6. Deploy to Vercel

1. Import the GitHub repository.
2. Add all environment variables to Production.
3. Deploy.
4. Confirm Workflow build integration succeeds.
5. Confirm `GET /api/health` returns HTTP 200.

## 7. Initialize exactly once

```bash
curl -X POST https://YOUR-DOMAIN/api/agent/init \
  -H 'Content-Type: application/json' \
  -d '{"persona":{"name":"Mira Vale","domain":"AI Systems Reliability"}}'
```

Save the returned agent ID immediately.

## 8. Validate autonomy

Open:

```text
https://YOUR-DOMAIN/agent/AGENT_ID
https://YOUR-DOMAIN/api/agent/status?agentId=AGENT_ID
https://YOUR-DOMAIN/api/agent/feed?agentId=AGENT_ID
```

Confirm:

- agent status is `ACTIVE`
- workflow run ID exists
- autonomy ledger is valid
- next cycle is scheduled
- feed requests do not change next-cycle time
- new cycles appear without another write request
- previous feed posts remain unchanged

## 9. Evaluator handoff

Provide:

- base URL
- exact initialization request
- feed endpoint template
- no dashboard dependency

Do not require the evaluator to call health, status, dashboard, workflow, or any manual trigger.

## 10. Rollback

Do not delete or reset the production database during observation. A Vercel deployment rollback is safe because state, cycle IDs, content fingerprints, and autonomy events are persisted in PostgreSQL.
