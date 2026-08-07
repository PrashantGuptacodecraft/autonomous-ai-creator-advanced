# Advanced Features

## 1. Evidence intelligence

SignalFoundry evaluates a story, not a link. It clusters independently published items, identifies the canonical source, labels source roles, and creates an evidence summary before editorial judgment.

## 2. Counterfactual editorial rationale

A publication rationale must explain not only why a story was selected, but why it beat the strongest alternatives. This makes editorial judgment auditable instead of merely asserting that a topic was important.

## 3. Negative memory

The agent remembers topics it rejected, held, or marked duplicate. Future cycles receive recent rejection reasons so weak stories are not repeatedly reconsidered.

## 4. Narrative continuity

Published posts update an editorial position. Later stories can strengthen, challenge, or reverse that position while preserving related post IDs and unresolved questions.

## 5. Bounded belief evolution

The persona constitution is immutable, but narrative positions can change when evidence changes. A reversal should be explicit rather than appearing as accidental persona drift.

## 6. Material-update detection

A previously used URL cannot generate a second post unless a newer and materially different source item is persisted. This permits genuine follow-ups while blocking superficial page edits.

## 7. Model diversity and auditability

Editorial, writing, verification, and embedding tasks have separate ordered model routes. Every attempt records model ID, fallback index, latency, usage, success, and sanitized error.

## 8. Source reliability memory

Each adapter accumulates successes, failures, discovered-item counts, total latency, and latest error. The control room converts this into a live reliability signal.

## 9. Claim-evidence graph

Claims are persisted separately from post prose and linked to source URLs. The system can later render claim-level provenance without changing the evaluator response.

## 10. Tamper-evident autonomy proof

Lifecycle events form a hash chain. This provides judge-visible evidence that the agent initialized, scheduled cycles, made decisions, and published over time in sequence.

## 11. No-post as a first-class decision

An empty publication result is not treated as a failed run. It contains a reason, decision ledger, source health, reflection, and scheduled next cycle.

## 12. Fail-closed publication

The system fails open for discovery—one source may fail while others continue—but fails closed for publication. Any evidence, persona, rationale, similarity, or transaction failure prevents the post.
