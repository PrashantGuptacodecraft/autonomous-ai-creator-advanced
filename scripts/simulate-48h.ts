import assert from "node:assert/strict";
import { clusterStories } from "@/lib/evidence/cluster";
import { compilePersona } from "@/lib/editorial/persona";
import { fallbackDecisions, fallbackDraft, fallbackVerification } from "@/lib/editorial/fallback";
import { evaluateQualityGate } from "@/lib/editorial/quality";
import { scoreStoryCluster } from "@/lib/editorial/scoring";
import { createSource } from "@/lib/sources/common";
import { deterministicDelaySeconds } from "@/lib/utils/time";

const persona = compilePersona({ name: "Mira Vale", domain: "AI Systems Reliability" });
const now = new Date();
const sources = [
  createSource({
    title: "Durable agent workflows add crash recovery and persisted retries",
    url: "https://official.example/durable-agent-workflows",
    summary: "A production release adds persisted execution, bounded retries, and recovery after deployment.",
    content: "The release notes describe durable sleep, replay-safe steps, retries, and execution recovery.",
    sourceName: "Official engineering blog",
    sourceKind: "official_blog",
    sourceRole: "PRIMARY",
    publishedAt: now,
    trustScore: 0.96,
  }),
  createSource({
    title: "Agent workflow recovery adds durable crash handling",
    url: "https://analysis.example/agent-workflow-recovery",
    summary: "Independent technical analysis examines persisted execution, retries, and crash recovery.",
    content: "The analysis compares recovery semantics and operational failure modes.",
    sourceName: "Independent engineering analysis",
    sourceKind: "news_signal",
    sourceRole: "CORROBORATING",
    publishedAt: now,
    trustScore: 0.82,
  }),
];

const cluster = clusterStories(sources)[0]!;
const scores = scoreStoryCluster(cluster, persona, now);
const candidate = {
  id: "cand_sim",
  clusterId: "story_sim",
  sourceItemId: "src_1",
  evidenceSourceItemIds: ["src_1", "src_2"],
  sourceUrls: sources.map((source) => source.canonicalUrl),
  title: cluster.title,
  summary: cluster.summary,
  canonicalUrl: cluster.primarySource.canonicalUrl,
  sourceName: cluster.primarySource.sourceName,
  sourceKind: cluster.primarySource.sourceKind,
  publishedAt: cluster.publishedAt,
  trustScore: cluster.primarySource.trustScore,
  independentSourceCount: cluster.independentSourceCount,
  corroborationScore: cluster.corroborationScore,
  evidenceSummary: cluster.evidenceSummary,
  fingerprint: cluster.fingerprint,
  scores,
};
const decision = fallbackDecisions([candidate], 65);
assert.equal(decision.selectedCandidateId, candidate.id, "Strong story should clear deterministic editorial policy");

const evidence = sources.map((source, index) => ({
  id: `src_${index + 1}`,
  title: source.title,
  canonical_url: source.canonicalUrl,
  summary: source.summary,
  content: source.content,
  source_name: source.sourceName,
  source_kind: source.sourceKind,
  source_role: source.sourceRole,
  trust_score: source.trustScore,
  published_at: source.publishedAt,
  metadata: source.metadata,
}));
const draft = fallbackDraft(persona, candidate, evidence, 7);
const verification = fallbackVerification({
  draft,
  persona,
  allowedSourceUrls: candidate.sourceUrls,
});
const quality = evaluateQualityGate({
  draft,
  verification,
  persona,
  allowedSourceUrls: candidate.sourceUrls,
  recentPosts: [],
  minimumScore: 75,
});
assert.equal(quality.passed, true, `Fallback draft should pass deterministic quality gates: ${quality.failures.join("; ")}`);

let elapsedSeconds = 45;
let cycles = 0;
while (elapsedSeconds < 50 * 3600 && cycles < 36) {
  elapsedSeconds += deterministicDelaySeconds("agt_sim", cycles, 5_400, 10_800);
  cycles += 1;
}
assert.ok(cycles >= 16, "Cadence should create repeated autonomous opportunities across 48 hours");
assert.ok(elapsedSeconds >= 48 * 3600, "Configured workflow must cover the full evaluation window");

console.log(JSON.stringify({
  result: "passed",
  clusters: 1,
  independentSources: cluster.independentSourceCount,
  editorialScore: scores.total,
  qualityScore: quality.score,
  simulatedCycles: cycles,
  simulatedHours: Number((elapsedSeconds / 3600).toFixed(1)),
}, null, 2));
