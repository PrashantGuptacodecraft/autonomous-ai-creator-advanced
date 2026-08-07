# AGENTS.md — Locked Engineering Contract

## Mission

Deliver an autonomous AI/technology editorial persona that continues researching and publishing after exactly one initialization request.

## Locked evaluator contract

### Initialization

```text
POST /api/agent/init
```

Request:

```json
{"persona":{"name":"Ada","domain":"AI Security"}}
```

Response body must remain:

```json
{"agentId":"..."}
```

### Feed

```text
GET /api/agent/feed?agentId=...
```

Response must remain:

```json
{
  "posts": [
    {
      "id": "...",
      "createdAt": "UTC ISO 8601",
      "text": "...",
      "rationale": "...",
      "sources": ["https://..."]
    }
  ]
}
```

The feed must remain read-only and newest first. Never generate, schedule, retry, repair, initialize, or mutate from the feed route.

## Locked autonomy contract

- Initialization starts the durable workflow once.
- The workflow controls research timing.
- Publication happens across time, never all at initialization.
- A no-post cycle is valid.
- The evaluation deadline is at least 48 hours.
- The maximum cycle count must not end normal production execution before the deadline.
- Failed cycles publish no partial content.

## Locked editorial contract

- Evaluate story clusters rather than isolated links.
- Persist rejected, held, duplicate, and published decisions.
- At most one story may publish per cycle.
- Do not force a publication.
- All factual claims must map to persisted evidence URLs.
- Every rationale must explain selection, relevance now, source basis, and comparison with alternatives.
- Persona constitution remains versioned and stable.

## Locked memory contract

Preserve:

- exact URL/content fingerprints
- lexical repetition checks
- semantic pgvector memory
- negative/rejection memory
- narrative memory
- reflective memory
- material-update detection

## Locked persistence contract

- Do not edit an already applied migration. Add a new migration.
- Keep unique cycle, candidate, decision, and post constraints.
- Publication remains one transaction.
- Autonomy events remain hash-linked.
- Do not expose database errors or secrets in public responses.

## Verification gate

Before claiming completion:

```bash
npm run verify:static
npm run typecheck
npm test
npm run test:simulation
npm run build
```

Also perform a deployed initialization/feed smoke test.

## Allowed improvements

- better source adapters
- stronger clustering and contradiction detection
- improved prompts and evaluation rubrics
- better observability
- accessibility and UI improvements
- deployment and test hardening
- performance optimizations that preserve correctness

## Forbidden shortcuts

- generating future posts during initialization
- generating on feed reads
- random fake sources
- silently changing prior posts
- accepting model-provided URLs outside the evidence bundle
- disabling rejection or similarity gates to make the feed look active
- hiding failed cycles
- claiming a production build passed when it was not run
