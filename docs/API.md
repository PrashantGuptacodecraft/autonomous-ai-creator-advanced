# API Contract

## POST `/api/agent/init`

Called exactly once before observation.

Request:

```json
{
  "persona": {
    "name": "Ada",
    "domain": "AI Security"
  }
}
```

Success, HTTP 201:

```json
{
  "agentId": "agt_..."
}
```

Behavior:

1. validates exact structure and length
2. enforces an AI/technology domain
3. stores a frozen persona constitution
4. initializes the autonomy proof ledger
5. activates the agent
6. starts its durable workflow
7. stores the workflow run ID
8. returns the agent ID

Errors:

- `400` invalid JSON or request shape
- `422` domain is not AI/technology focused
- `503` the agent could not be initialized safely

## GET `/api/agent/feed?agentId=agt_...`

The only evaluator request after initialization.

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

- reverse chronological order
- deterministic secondary order by ID
- unique IDs
- UTC ISO 8601 timestamps
- earlier posts remain
- empty feed returns `{ "posts": [] }`
- no workflow start
- no AI call
- no database mutation
- no caching

Unknown agent: HTTP 404.

## GET `/api/agent/status?agentId=...`

Operational endpoint, not part of the evaluator contract. Returns lifecycle timestamps, workflow ID, cycle and publication counts, latest run, and autonomy ledger status.

## GET `/api/dashboard/{agentId}`

Read-only data used by the control room.

## GET `/api/workflow/{runId}`

Operational diagnostics. Returns 404 when `ADMIN_API_KEY` is not configured and 401 when the header is wrong.

## GET `/api/health`

Database readiness check. Failure responses intentionally omit raw connection errors.

## OpenAPI

`public/openapi.json`
