# Security Model

## Security posture

External sources are untrusted data. They cannot modify system instructions, access credentials, execute tools, or publish directly.

## Controls

### URL and network controls

- HTTP and HTTPS only
- URL credentials rejected
- localhost and local domains rejected
- private, link-local, loopback, multicast, and reserved IP ranges blocked
- hostname resolved before fetch
- each redirect re-normalized and re-validated
- manual redirect limit
- request timeout
- explicit research-bot user agent

### Resource controls

- streaming response byte limits
- article content-type allow-list
- per-adapter item limits
- bounded fetch concurrency
- maximum sanitized evidence length
- model candidate limits
- maximum daily publications

### Content controls

- scripts, styles, comments, and HTML removed
- Unicode normalized
- instruction-shaped phrases redacted
- retrieved text wrapped in an explicit untrusted-evidence boundary
- only persisted source URLs are allowed in claims

### Model controls

- frozen persona constitution
- structured Zod output
- at most one publish selection
- deterministic minimum scores
- independent verifier
- deterministic final quality gate
- one bounded revision
- no arbitrary shell, browser, database, or secret-access tool is exposed to the model

### Database controls

- parameterized SQL
- unique cycle, source, candidate, decision, and post constraints
- semantic duplicate query
- atomic publication transaction
- hash-linked lifecycle events
- immutable evaluator output by application contract

### Operations

- workflow diagnostics disabled when no admin secret is configured
- health route does not return raw database errors
- model audit errors are truncated
- credentials remain environment variables
- security headers disable framing, sniffing, camera, microphone, and geolocation

## Residual risk

DNS validation before a standard fetch does not create a perfect egress allow-list and cannot fully eliminate all DNS-rebinding behavior. A high-security public launch should add network-level egress policy or an outbound proxy. This is documented rather than hidden.

## Large-scale hardening

For a public multi-tenant product, add:

- WAF and rate limiting
- dedicated extraction sandbox
- source-domain allow-list tiers
- outbound proxy with IP pinning
- centralized secret redaction
- dependency and container scanning
- alerting on failed proof-chain verification
- database row-level tenancy controls
