# Build and Validation Status

## Advanced delivery

This repository is the upgraded SignalFoundry 2.1 implementation. It includes:

- required evaluator endpoints
- durable 50-hour autonomous workflow
- activation-race fix
- live multi-source discovery
- independent-source story clustering
- deterministic and model-assisted editorial judgment
- material-update detection
- exact, lexical, semantic, negative, narrative, and reflective memory
- claim-level source evidence
- persona drift and deterministic publication quality gates
- model fallback and source reliability telemetry
- tamper-evident autonomy lifecycle ledger
- premium read-only control room
- SSRF, prompt-injection, timeout, redirect, and streaming byte-limit controls
- versioned checksum-protected migrations
- Docker, CI, OpenAPI, tests, simulation, and deployment documentation

## Validation completed in this workspace

- static evaluator-contract verification: passed
- TypeScript strict audit with temporary external dependency declarations: passed
- deterministic unit suite: 12 passed, 0 failed
- accelerated 48-hour simulation: passed
- simulation produced 26 research opportunities over 50.1 simulated hours
- multi-source story corroboration: passed
- final simulation quality gate: 97/100
- autonomy hash stability and tamper detection: passed
- JSON configuration parsing: passed
- dependency version existence checked against the public npm package registry pages: passed
- architecture DOCX visual QA: 16 pages inspected; no clipping, overlap, blank pages, or broken tables
- architecture DOCX high-severity accessibility findings: 0

## Environment limitation

The execution workspace uses an internal npm proxy that does not contain the required public packages. Therefore a real `npm install`, full package-resolved TypeScript run, Vitest process, Next.js production build, and deployed Vercel Workflow execution could not be completed here.

The temporary declarations were used only for static auditing and are not included in the repository.

Before production initialization, use public npm access and run:

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run verify
```

Resolve any verified package-API compatibility issue without changing the locked evaluator or autonomy contracts.

## Credentials intentionally excluded

A live deployment requires the project owner's:

- Neon `DATABASE_URL`
- Vercel `AI_GATEWAY_API_KEY`
- Vercel project connection
- optional read-only `GITHUB_TOKEN`
- optional `ADMIN_API_KEY`

No production secret is included.
