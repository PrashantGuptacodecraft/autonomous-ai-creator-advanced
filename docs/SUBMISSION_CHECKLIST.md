# Submission Checklist

## Code

- [ ] `npm install` succeeds from public npm
- [ ] `npm run verify` passes
- [ ] all three migrations applied to production
- [ ] no secrets committed
- [ ] production model IDs confirmed in AI Gateway
- [ ] GitHub token is read-only

## Deployment

- [ ] `/api/health` returns 200
- [ ] initialization returns one `agentId`
- [ ] agent status becomes `ACTIVE`
- [ ] workflow run ID is attached
- [ ] next cycle timestamp is in the future
- [ ] autonomy ledger is valid

## Evaluator contract

- [ ] feed returns exact public object shape
- [ ] empty feed returns `{ "posts": [] }`
- [ ] timestamps are UTC ISO strings
- [ ] posts are newest first
- [ ] old posts remain
- [ ] feed requests do not trigger generation

## 48-hour observation

- [ ] production cadence is not accelerated beyond rules
- [ ] observation window is at least 48 hours
- [ ] maximum cycle count cannot end the workflow early
- [ ] at least one no-post/rejection cycle is visible
- [ ] at least one publication has rationale and multiple evidence sources when available
- [ ] later feed call shows autonomous progression

## Presentation

- [ ] architecture document included
- [ ] control room URL prepared
- [ ] evaluator cURL commands prepared
- [ ] strongest rejection example identified
- [ ] strongest narrative follow-up identified
- [ ] autonomy ledger demonstration prepared
