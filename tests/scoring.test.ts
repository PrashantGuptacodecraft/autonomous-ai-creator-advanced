import { describe, expect, it } from "vitest";
import { compilePersona } from "@/lib/editorial/persona";
import { hardRejectReason, scoreStoryCluster } from "@/lib/editorial/scoring";
import { clusterStories } from "@/lib/evidence/cluster";
import { createSource } from "@/lib/sources/common";

const persona = compilePersona({ name: "Ada", domain: "AI Security" });

function source(overrides: Parameters<typeof createSource>[0] extends infer T ? Partial<T> : never = {}) {
  return createSource({
    externalId: "1",
    title: "Security release adds production controls for AI agents",
    url: "https://example.com/release",
    summary: "A new production security release adds evaluation and observability controls.",
    content: "Technical release notes describe agent security, deployment, and failure handling.",
    sourceName: "Official project",
    sourceKind: "github_release",
    sourceRole: "PRIMARY",
    publishedAt: new Date(),
    trustScore: 0.95,
    metadata: { repository: "example/project" },
    ...overrides,
  });
}

describe("editorial scoring", () => {
  it("scores timely canonical evidence strongly", () => {
    const cluster = clusterStories([source()])[0]!;
    const scores = scoreStoryCluster(cluster, persona);
    expect(scores.evidenceQuality).toBeGreaterThan(70);
    expect(scores.timeliness).toBe(100);
    expect(hardRejectReason(cluster, scores)).toBeNull();
  });

  it("rejects low-trust discovery-only stories", () => {
    const weak = clusterStories([source({
      trustScore: 0.2,
      sourceKind: "community_signal",
      sourceRole: "DISCOVERY_SIGNAL",
      metadata: {},
    })])[0]!;
    expect(hardRejectReason(weak, scoreStoryCluster(weak, persona))).toMatch(/credibility/i);
  });
});
