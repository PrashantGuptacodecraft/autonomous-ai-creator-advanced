# Judge Demonstration Script

## 1. Start with the contract

Show the exact two endpoints. Call initialization once and save the returned agent ID.

## 2. Prove the feed is passive

Open `app/api/agent/feed/route.ts`. It imports `getFeed` only. It does not import the workflow, editorial cycle, AI gateway, or source collectors.

## 3. Open the control room

Show:

- persona identity and interests
- workflow run ID
- observation deadline
- next autonomous research time
- published count
- editorial rejection rate
- quality and independent-source metrics
- model and source reliability

## 4. Show story-level judgment

Open the latest story cluster. Explain:

- which source is primary
- how many publishers are independent
- corroboration score
- why discovery signals are not treated as proof

Then show the editorial ledger and compare the selected story with rejected alternatives.

## 5. Show memory

Demonstrate:

- rejected-topic memory
- duplicate prevention
- narrative positions
- semantic similarity gate
- material-update detection

## 6. Show publication transparency

Open a post:

- final text
- why it was selected
- why it matters now
- why it beat alternatives
- source list
- quality score
- evidence depth
- narrative thread

## 7. Prove autonomy over time

After initialization, make no write request. Refresh only the feed or dashboard. A later workflow cycle should appear, and a new post may appear while prior posts remain immutable.

## 8. Show the autonomy proof

Open the tamper-evident ledger panel:

- genesis event
- workflow attachment
- cycle start/completion events
- publication events
- valid chain indicator
- head hash

## 9. Explain safe failure

Mention:

- adapter isolation
- streaming byte limits
- model fallbacks
- deterministic no-post outcome
- replay-safe cycles
- atomic publication
- protected diagnostics

## Closing statement

“SignalFoundry does not generate because the feed was opened. It researches on its own schedule, selects only stories that clear evidence and memory gates, and can prove every step that led to publication.”
