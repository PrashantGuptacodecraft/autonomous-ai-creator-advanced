# AI Usage Log — SignalFoundry

This document records the AI-assisted development of SignalFoundry, including the major prompts used during development, the resulting changes, and the parts of the project that were completed manually.

The AI tools were used primarily as engineering assistants for implementation, debugging, architecture review, testing, and iteration. Final decisions, configuration, validation, and deployment were performed and reviewed manually.

---

## Tools Used

| Tool                                     | Purpose                                                                             | Sessions   |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| **OpenAI Codex**                         | Initial architecture, scaffolding, implementation, tests, contract verification     | Aug 7      |
| **Google Antigravity (Gemini 3.1 Pro)**  | Local execution, debugging, code analysis, deployment troubleshooting               | Aug 7–9    |
| **Anthropic Claude Opus 4.6 (Thinking)** | Architecture review, editorial pipeline, scoring, reliability and feature iteration | Aug 8–9    |
| **GitHub Copilot**                       | Small inline completions and boilerplate during manual development                  | Throughout |

---

# Session 1 — Initial Architecture and Scaffolding

**Date:** August 7, 2026
**Time:** 10:00 PM – 11:00 PM IST
**Tool:** OpenAI Codex
**Model:** codex

### Prompt used

> Build the initial production-oriented implementation of the Autonomous AI Creator challenge.
>
> Treat the hackathon API contract as fixed. `POST /api/agent/init` must create and activate an agent, while `GET /api/agent/feed` must remain strictly read-only. The feed endpoint must never be responsible for starting research, generating content, advancing a workflow, or modifying agent state.
>
> The important part of this project is genuine autonomy after initialization. Use a durable workflow so the agent can continue researching and publishing over the observation period without another request from the evaluator.
>
> I want the implementation to be evidence-first rather than simply asking a model to find an article and write a post. Build the pipeline around source discovery, story clustering, editorial evaluation, evidence verification, persona consistency, memory, and a final publication gate.
>
> The agent should remember both published and rejected topics. Use fingerprint/lexical/semantic memory where appropriate and maintain narrative continuity so that it can recognize when a new story is related to something it has already covered.
>
> Add claim-level evidence verification before publication. Keep the evaluator contract simple even if the internal architecture is more sophisticated.
>
> Use PostgreSQL with pgvector for persistence and semantic memory. Add a tamper-evident autonomy ledger so the system can retain an auditable record of initialization, workflow execution, editorial decisions, and publication.
>
> Security is important because the agent will consume untrusted external content. Include SSRF protection, safe fetching, prompt-injection handling, and appropriate validation around external sources.
>
> Include tests for the evaluator contract, memory, security, workflow behaviour, and an accelerated simulation representing the 48-hour evaluation period.
>
> Keep the implementation modular. Research adapters, editorial logic, memory, AI providers, workflow orchestration, persistence, and API routes should not be tightly coupled.

### Result

Codex generated the initial application structure, API routes, workflow, database layer, research adapters, editorial pipeline, memory modules, security layer, dashboard, migrations, tests, and documentation.

I manually reviewed the generated architecture against the challenge requirements and wrote `AGENTS.md` as the locked engineering contract.

### Initial verification

```text
Static evaluator-contract verification: passed
TypeScript strict audit: passed
Deterministic tests: 12 passed
Accelerated autonomy simulation: passed
Simulation: 26 cycles / 50.1 hours
Final simulation quality gate: 97/100
Autonomy ledger verification: passed
```

---

# Session 2 — First Local Run

**Date:** August 7, 2026
**Time:** 10:14 PM – 10:39 PM IST
**Tool:** Google Antigravity
**Model:** Gemini 3.1 Pro

### Prompt used

> Start by inspecting the repository rather than changing anything immediately. Check the package configuration, environment requirements, database setup, workflow configuration, and API routes.
>
> Then install the required dependencies and run the application locally.
>
> I want to verify the actual runtime behaviour of the current implementation, especially the initialization endpoint, feed endpoint, database connection, and main UI.
>
> If something fails, identify the root cause before changing the code and keep any fixes limited to what is actually required.

### Result

The project was analyzed and started locally.

The required environment configuration was identified, the database migrations were run, and the application/API routes were tested.

I manually supplied the real Neon database URL and Vercel AI Gateway credentials.

---

# Session 3 — Editorial Pipeline Review

**Date:** August 8, 2026
**Time:** 12:37 AM – 1:14 AM IST
**Tools:** Google Antigravity and Claude Opus 4.6

### Prompt used

> Review the editorial pipeline end to end.
>
> I don't just want to know whether the code works. Trace one candidate from source discovery through clustering, scoring, memory checks, drafting, verification, and the final publication gate.
>
> The current problem is that the agent is discovering potentially useful stories but rejecting too many of them. Determine whether that is because the source quality is actually poor or because the scoring model is too restrictive.
>
> Inspect the scoring implementation and identify which signals are causing otherwise reasonable stories to fall below the publication threshold.
>
> Do not solve this by simply removing the evidence requirements. I want higher publication coverage while keeping the security and evidence-integrity checks intact.
>
> After the analysis, propose the smallest set of scoring/source changes that improves the balance between selectivity and useful output.

### Result

The scoring pipeline was analyzed.

The main causes identified were:

* Low corroboration scores
* Limited source diversity
* Repetition penalties
* Conservative publication thresholds

The scoring weights and thresholds were adjusted while retaining the evidence-verification requirements.

---

# Session 4 — Workflow Execution Debugging

**Date:** August 9, 2026
**Time:** 12:53 AM – 1:14 AM IST
**Tool:** Google Antigravity
**Model:** Gemini 3.1 Pro

### Prompt used

> The application is running, but the autonomous agent is not progressing through cycles as expected.
>
> Trace the workflow execution rather than just increasing the number of posts. Check the initial delay, cycle scheduling, workflow sleep/resume behaviour, and publication gate.
>
> I want to know exactly where the execution stops.
>
> For local development, make the cycle interval short enough that I can observe multiple cycles, but keep the production behaviour separate from the development timing.
>
> Do not bypass the publication gate just to make the demo produce posts.

### Result

The workflow timing configuration was identified as the main issue.

Local development timing was changed to:

```text
FIRST_CYCLE_DELAY_SECONDS=10
MIN_CYCLE_DELAY_SECONDS=60
MAX_CYCLE_DELAY_SECONDS=120
```

The production timing remained independent.

---

# Session 5 — Research Coverage and Editorial Throughput

**Date:** August 9, 2026
**Time:** 1:06 PM – 2:30 PM IST
**Tool:** Claude Opus 4.6 (Thinking)

### Prompt used

> Review the research side of the system with one specific goal: improve the number of genuinely publishable stories without lowering the evidence standard.
>
> At the moment, many candidates are being rejected because the system cannot build enough corroborating evidence. Determine whether this is primarily a scoring problem or a source-discovery problem.
>
> Expand the research surface across different areas of AI and technology rather than repeatedly searching the same type of source.
>
> Prioritize domains where we can realistically obtain both primary and independent supporting sources, such as AI security, open-source AI, model releases, developer tooling, infrastructure, research, and regulation.
>
> Also improve the control room so I can see the complete editorial funnel:
>
> discovered → evaluated → rejected/held → selected → published
>
> For every rejected candidate, show the reason and score. For selected candidates, show the evidence and final quality score.
>
> Do not weaken the security or evidence-verification requirements simply to increase posting frequency.

### Result

Research coverage was expanded and the control room was improved to expose the editorial decision process.

The system now provides better visibility into:

* Discovered candidates
* Rejected candidates
* Rejection reasons
* Selected stories
* Quality scores
* Source reliability
* Cycle-level decisions

---

# Session 6 — Social Distribution

**Date:** August 9, 2026
**Time:** 2:28 PM – 3:00 PM IST
**Tool:** Claude Opus 4.6 (Thinking)

### Prompt used

> Review the current publication architecture and add optional external distribution without changing the hackathon evaluator contract.
>
> The internal database/feed must remain the source of truth. Social publishing should happen only after the normal editorial and quality gates have passed.
>
> Add a provider abstraction so Bluesky and Mastodon are separate adapters rather than being hardcoded into the editorial pipeline.
>
> A failed social-media request must not invalidate an internally published post or stop the autonomous workflow.
>
> Add appropriate environment variables, error handling, and distribution records so we can see whether a post was successfully delivered to each provider.
>
> Keep the feature optional: the core challenge must continue working even when social credentials are not configured.

### Follow-up

> Use a quality score of 75 as the current publication threshold for the external distribution path, but do not remove claim verification, source validation, security checks, or the internal publication gate.

### Result

Bluesky and Mastodon adapters were implemented behind a unified publishing layer.

Credentials were configured and tested manually.

---

# Session 7 — Reset to Stable Baseline

**Date:** August 9, 2026
**Time:** 1:21 PM – 1:54 PM IST
**Tools:** Google Antigravity and Claude Opus 4.6

### Prompt used

> Before adding more features, return the repository to the last known stable commit and verify that baseline independently.
>
> I don't want to continue layering changes on top of an uncertain state.
>
> Once the baseline is confirmed, re-apply the required editorial improvements and social distribution changes cleanly on top of it.
>
> Preserve the evaluator contract, database integrity, security checks, and autonomous workflow behaviour during the rework.
>
> After applying the changes, run the relevant tests again instead of assuming the previous validation still applies.

### Result

The repository was reset to the stable commit:

```text
869f1e4
```

The scoring improvements and social distribution features were then re-applied and validated against the clean baseline.

---

# Session 8 — Publication and Cycle Failure Investigation

**Date:** August 9, 2026
**Time:** 3:00 PM – 3:45 PM IST
**Tool:** Claude Opus 4.6 (Thinking)

### Prompt 1

> A candidate is reaching the required quality score, but the post is still not appearing in the feed and the next cycle is not progressing.
>
> Trace the complete path after the quality gate:
>
> quality gate → publication transaction → database write → workflow completion → next-cycle scheduling.
>
> Check the runtime logs and database errors rather than changing the score threshold.
>
> I want the actual failure point identified and fixed. Also make sure a publication failure is surfaced clearly instead of being swallowed by the workflow.

### Result

A database publication issue was found.

The atomic publication transaction was corrected and additional error logging was added around the publication stage.

### Prompt 2

> Now inspect why the next cycle is not starting after a successful cycle.
>
> Focus specifically on the calculation of the next cycle timestamp and the workflow sleep/resume state.
>
> Verify that the scheduled time is calculated relative to the correct execution time and that the workflow can resume normally after sleeping.
>
> Fix the underlying scheduling issue rather than adding another manual trigger.

### Result

The cycle scheduling calculation was corrected and the workflow resumed normally.

---

# Session 9 — Production Deployment Review

**Date:** August 9, 2026
**Time:** 3:43 PM – 4:41 PM IST
**Tool:** Claude Opus 4.6 (Thinking)

### Prompt used

> Prepare this application for a real Vercel deployment.
>
> Review the production requirements first: environment variables, database migrations, workflow configuration, AI provider configuration, runtime settings, and health checks.
>
> Give me a deployment sequence that avoids starting the autonomous workflow before the production database and required environment variables are ready.
>
> After deployment, the verification should cover:
>
> 1. Application health
> 2. Database connectivity
> 3. Required API contract
> 4. Agent initialization
> 5. Workflow startup
> 6. First autonomous cycle
> 7. Feed persistence
>
> Keep secrets out of the repository and clearly separate local development values from production configuration.

### Result

A production deployment procedure was established for Vercel and Neon.

---

# Session 10 — Final Hackathon Compliance Review

**Date:** August 9, 2026
**Time:** 6:09 PM – present
**Tool:** Claude Opus 4.6 (Thinking)

### Prompt used

> Perform a final review of the repository against the official Autonomous AI Creator challenge rather than reviewing it only as a normal web application.
>
> Treat the evaluator behaviour as fixed:
>
> * initialization happens exactly once
> * the evaluator subsequently calls only the feed endpoint
> * the evaluator may observe the system for approximately 48 hours
> * new posts must appear without additional prompts
>
> Verify that the feed endpoint is genuinely read-only and cannot accidentally trigger generation.
>
> Check the autonomous workflow, persistence, editorial decision-making, persona consistency, memory, source/rationale requirements, timestamps, ordering, duplicate prevention, and failure recovery.
>
> Also review whether any additional features accidentally weaken or obscure the core hackathon requirement.
>
> Produce a final list of anything that could fail evaluation, anything that needs manual verification before submission, and anything that should remain unchanged because it is part of the evaluator contract.

### Result

The final review identified the remaining submission requirements and verification points, including:

* AI Usage Log
* Git history
* Live deployment verification
* Evaluator API verification
* Final codebase review

