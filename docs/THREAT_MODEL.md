# Threat Model

| Threat | Attack path | Control | Failure behavior |
|---|---|---|---|
| Indirect prompt injection | Article or feed text | Sanitization, untrusted wrapper, no source-controlled tools | Candidate may be rejected; no instruction change |
| SSRF | Malicious URL or redirect | Scheme, credential, DNS, IP, and redirect validation | Fetch fails closed |
| Oversized response | Feed or article | Streaming byte limit and timeout | Adapter/item fails without stopping other sources |
| Unsupported claim | Hallucinated source mapping | Claim URL allow-list plus verifier and quality gate | Draft is revised once or skipped |
| Persona drift | Generic or conflicting draft | Frozen constitution and drift checks | Draft is revised or skipped |
| Duplicate publishing | Retry, same URL, similar topic | Unique constraints, exact/lexical/semantic memory, material-update detector | Decision becomes duplicate or transaction conflicts |
| Partial publication | Database failure | Single transaction | No post becomes visible |
| Workflow duplication | Concurrent cycle invocation | Unique agent/cycle row and stable run ID | Second invocation cannot start the same cycle |
| Model outage | Provider error | Ordered model fallback and deterministic continuity policy | Safe fallback or skipped/failed cycle |
| Source outage | Feed/API error | Adapter isolation and source health memory | Remaining adapters continue |
| Operational data leak | Diagnostics endpoint | Disabled without admin key; protected header | 404/401 |
| History tampering | Database modification | Hash-linked autonomy event chain | Dashboard integrity check fails |
