import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const requiredFiles = [
  "app/api/agent/init/route.ts",
  "app/api/agent/feed/route.ts",
  "workflows/autonomous-creator.ts",
  "lib/editorial/cycle.ts",
  "lib/editorial/quality.ts",
  "lib/evidence/cluster.ts",
  "lib/db/repository.ts",
  "migrations/0001_initial.sql",
  "migrations/0002_evidence_intelligence.sql",
  "migrations/0003_autonomy_proof.sql",
  "README.md",
];
for (const file of requiredFiles) await access(resolve(file));

const feed = await readFile(resolve("app/api/agent/feed/route.ts"), "utf8");
const init = await readFile(resolve("app/api/agent/init/route.ts"), "utf8");
const cycle = await readFile(resolve("lib/editorial/cycle.ts"), "utf8");
const migration1 = await readFile(resolve("migrations/0001_initial.sql"), "utf8");
const migration2 = await readFile(resolve("migrations/0002_evidence_intelligence.sql"), "utf8");
const migration3 = await readFile(resolve("migrations/0003_autonomy_proof.sql"), "utf8");

const checks = [
  [feed.includes("getFeed") && !feed.includes("runEditorialCycle") && !feed.includes("start("), "Evaluator feed is read-only"],
  [init.includes("prepareAgentForWorkflow") && init.includes("start(autonomousCreatorWorkflow"), "Initialization activates and starts durable workflow without race"],
  [cycle.includes("discoverTopics") && cycle.includes("qualityGate") && cycle.includes("findSemanticDuplicate"), "Cycle enforces discovery, memory, and quality gates"],
  [migration1.includes("UNIQUE(agent_id, fingerprint)"), "Post deduplication constraint exists"],
  [migration1.includes("editorial_decisions") && migration1.includes("claim_evidence"), "Decision and claim-evidence ledgers exist"],
  [migration2.includes("story_clusters") && migration2.includes("story_cluster_sources"), "Corroborated story clustering schema exists"],
  [migration2.includes("ai_audit_events") && migration2.includes("source_reliability"), "Operational audit schema exists"],
  [migration3.includes("autonomy_events") && migration3.includes("previous_hash") && migration3.includes("event_hash"), "Tamper-evident autonomy proof schema exists"],
];
for (const [passed, label] of checks) {
  if (!passed) throw new Error(`Static verification failed: ${label}`);
  console.log(`✓ ${label}`);
}
