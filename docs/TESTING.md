# Testing and Verification

## Complete command

```bash
npm run verify
```

Equivalent sequence:

```bash
npm run verify:static
npm run typecheck
npm test
npm run test:simulation
npm run build
```

## Static contract verification

Checks that:

- evaluator feed is read-only
- initialization starts the durable workflow after activation
- editorial cycle includes discovery, memory, and quality gates
- post deduplication constraint exists
- decision and claim-evidence tables exist
- story clustering schema exists
- source/model telemetry exists
- autonomy proof hash-chain schema exists

## Unit tests

Current deterministic coverage includes:

- story clustering across independent publishers
- persona constitution determinism
- evidence-backed quality gate approval
- unverified claim URL rejection
- strong canonical story scoring
- low-trust discovery-only rejection
- prompt-injection content sanitization
- lexical repetition detection
- safe HTML decoding
- deterministic cadence bounds
- autonomy event hash stability
- autonomy event tamper detection

## Accelerated 48-hour simulation

```bash
npm run test:simulation
```

The simulation executes the pure editorial components with a corroborated story and advances a deterministic clock until the complete observation window is covered.

Expected properties:

- at least one multi-source cluster
- at least two independent sources
- editorial selection above threshold
- final quality gate passes
- at least sixteen autonomous research opportunities
- elapsed simulated time reaches 48 hours

## Required deployment smoke test

After deployment:

1. Call initialization once.
2. Save `agentId`.
3. Repeatedly call only the feed.
4. Confirm old posts remain.
5. Confirm at least one new post appears after a later workflow cycle.
6. Compare status timestamps to prove feed reads did not trigger work.
7. Confirm autonomy ledger remains valid.

## Failure injection tests recommended before submission

- one RSS endpoint returns 500
- GitHub returns 403 or rate-limit response
- one model route fails and fallback succeeds
- all model routes fail with safe fallback enabled
- article exceeds byte limit
- article redirects to a private host
- article contains prompt-injection instructions
- draft cites an unpersisted URL
- duplicate workflow cycle is attempted
- publication transaction fails before commit
