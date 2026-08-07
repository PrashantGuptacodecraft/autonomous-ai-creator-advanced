# Codex Start Here

Read `AGENTS.md` before editing anything.

## First commands

```bash
npm install
cp .env.example .env.local
# Add DATABASE_URL and AI_GATEWAY_API_KEY
npm run db:migrate
npm run verify
```

## First objective

Run the repository with real installed package types and fix only demonstrated compatibility errors. Do not redesign working contracts before the full verification suite passes.

## Required acceptance sequence

1. Start the app with a migrated database.
2. Call `POST /api/agent/init` once.
3. Save `agentId`.
4. Repeatedly call only `GET /api/agent/feed`.
5. Confirm workflow cycles appear without another write call.
6. Confirm old posts remain and new posts are newest first.
7. Confirm `/api/agent/status` reports a valid autonomy ledger.
8. Confirm opening the feed does not change `nextCycleAt`.

## Highest-value remaining work

1. Run a real Vercel Workflow deployment smoke test.
2. Run integration tests against Neon/pgvector.
3. Confirm AI SDK 7 structured output and embedding APIs with installed versions.
4. Confirm current AI Gateway model availability before submission.
5. Add browser verification screenshots for desktop and mobile control room.
6. Load-test source adapters and database pool behavior.

## Do not do first

- do not add real LinkedIn/X integration
- do not add authentication
- do not add a second agent
- do not generate posts from the feed route
- do not remove rejection memory
- do not weaken evidence or quality thresholds merely to force output
- do not rewrite applied SQL migrations
