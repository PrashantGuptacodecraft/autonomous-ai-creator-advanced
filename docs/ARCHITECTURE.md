# Architecture

## Product definition

SignalFoundry is a single autonomous editorial persona backed by a durable, evidence-first pipeline. It is deliberately not a multi-agent system because the challenge does not require one and additional agents would increase coordination risk without strengthening the evaluator contract.

## System boundaries

```text
Evaluator
  ├── POST /api/agent/init  ───────────────┐
  └── GET  /api/agent/feed  ← PostgreSQL  │
                                             │
Next.js API                                  │ starts once
  ├── validation                             ▼
  ├── persona compiler                Vercel Workflow
  └── feed serializer                 ├── durable sleep
                                      ├── research cycle step
Live sources ── safe fetch ──────────► ├── next-cycle planning
                                      └── lifecycle completion
                                               │
                                               ▼
                                       Neon PostgreSQL
                                       ├── sources and clusters
                                       ├── decisions and posts
                                       ├── layered memory
                                       ├── model/source telemetry
                                       └── autonomy hash chain
```

## Initialization transaction

1. Validate exact request structure.
2. Reject non-AI/non-technology domains.
3. Compile a deterministic persona constitution.
4. Insert `agents` and `persona_versions`.
5. Insert the genesis autonomy event in the same transaction.
6. Mark the agent active before starting the workflow, eliminating the original activation race.
7. Start the durable workflow.
8. Attach the workflow run ID and append a proof event in one transaction.
9. Return only the required `agentId`.

If workflow start fails, the agent becomes `FAILED`, the failure is persisted, and the endpoint returns HTTP 503.

## Durable workflow

The workflow function contains only orchestration. Node.js, database, source, and AI work run in step functions.

```text
plan cycle
   ├── check ACTIVE state
   ├── check evaluation deadline
   └── derive next delay
        ↓
durable sleep
        ↓
execute editorial cycle
        ↓
repeat until deadline or cycle limit
```

The evaluation window is the authoritative stopping condition. The default maximum cycle count is intentionally higher than the number expected inside 50 hours.

## Discovery pipeline

Each source adapter returns a normalized `DiscoveredSource`:

- title
- original and canonical URL
- hostname and independent publisher key
- summary and sanitized content
- source kind and evidence role
- publication and discovery times
- trust score
- metadata

Adapters are independently timed and failure-isolated. One broken feed cannot stop the research cycle.

## Story clustering

Individual source items are not editorial candidates. They are first grouped into story clusters using title/summary similarity and shared significant entities.

A cluster contains:

- canonical primary source
- corroborating sources
- discovery signals
- independent publisher count
- source diversity score
- corroboration score
- stable story fingerprint
- evidence summary

This prevents three articles about one release from competing as three separate stories and makes source diversity visible.

## Editorial engine

### Deterministic gate

Reject before model review when any of the following applies:

- unsafe or low-credibility evidence
- discovery signal with no canonical evidence
- stale item with no current development
- weak persona relevance
- promotional language without technical substance
- canonical duplicate without a material update
- high lexical repetition with a recent post

### Comparative model judgment

The model receives only the best eligible candidates and must compare them. It may select at most one. The structured response contains decision, reason, why-now explanation, comparison with alternatives, confidence, and scores.

The application normalizes the response so a model cannot publish more than one candidate or select a candidate below deterministic minimums.

### Cadence gate

A selected story can still be held because of minimum post spacing or the rolling 24-hour limit.

## Material-update detector

When a canonical URL already appears in a published post, the new source item is compared with the prior persisted source. It is considered a potential follow-up only when:

- the persisted source item ID changed
- the source timestamp is newer than the prior publication
- title and evidence similarity fall below the material-update ceiling

Otherwise it becomes `DUPLICATE` memory.

## Memory architecture

### Exact memory

Canonical URLs, content hashes, candidate fingerprints, and post fingerprints.

### Lexical memory

Jaccard similarity between candidate text and recent posts.

### Semantic memory

Embeddings stored in pgvector and queried before publication.

### Negative memory

Rejected, held, and duplicate decisions plus reasons and scores.

### Narrative memory

Current editorial position, unresolved questions, and related post IDs.

### Reflective memory

A cycle summary and future source/editorial priorities.

## Evidence-bound writing

The writer receives:

- immutable persona constitution
- selected story
- persisted sanitized evidence sources
- editorial decision
- recent posts
- narrative threads
- number of rejected alternatives

Every factual claim must cite one or more URLs from the allowed evidence bundle.

## Verification and quality gate

The model verifier scores:

- persona consistency
- evidence coverage
- rationale completeness
- source integrity

It also returns unsupported claims, drift flags, and revision notes.

The deterministic gate independently checks:

- all claim URLs belong to the evidence bundle
- every claim is mapped
- rationale states selection, relevance now, source basis, and comparison
- no unsupported claims remain
- minimum persona and evidence scores
- no excessive hype
- no high similarity with recent posts
- final minimum score

One bounded revision is allowed.

## Atomic publication

One transaction writes:

- `posts`
- `post_sources`
- `claim_evidence`
- published semantic memory
- narrative thread update
- run completion
- agent counters
- `POST_PUBLISHED` autonomy event
- `CYCLE_COMPLETED` autonomy event

Any failure rolls back the entire publication.

## Autonomy proof chain

Every event stores:

```text
previous_hash
SHA256(previous_hash | event_type | occurred_at | canonical_payload)
event_hash
```

The chain begins with `GENESIS`. Payload keys are canonicalized before hashing. A dashboard verification function recomputes the complete chain in order.

## Feed isolation

The feed route imports only `getFeed`. It does not import the workflow, editorial cycle, AI gateway, or source adapters. The query orders by `created_at DESC, id DESC` and emits the exact required public shape.

## Reliability boundaries

- source adapters fail independently
- model calls use ordered model fallbacks
- AI and source calls record success, failure, latency, and usage
- cycles have stable IDs and a unique database constraint
- publications use unique candidate and post fingerprints
- failed cycles publish nothing and schedule another window
- operational diagnostics are disabled unless `ADMIN_API_KEY` exists

## Repository map

```text
app/api/agent/init       evaluator initialization
app/api/agent/feed       evaluator read-only feed
app/agent/[agentId]      premium read-only control room
workflows/               durable orchestration
lib/sources/             live discovery adapters
lib/evidence/            story clustering
lib/editorial/           persona, scoring, judgment, quality, cycle
lib/ai/                  structured output and model fallbacks
lib/security/            URL, SSRF, size, and content controls
lib/db/                  persistence and atomic publication
lib/audit/               deterministic autonomy event hashing
migrations/              versioned PostgreSQL schema
scripts/                 migration, verification, simulation
