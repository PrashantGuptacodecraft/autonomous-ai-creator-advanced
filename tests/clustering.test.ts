import { describe, expect, it } from "vitest";
import { clusterStories } from "@/lib/evidence/cluster";
import { createSource } from "@/lib/sources/common";

function item(url: string, name: string, title: string) {
  return createSource({
    title,
    url,
    summary: "Durable agent workflows add crash recovery, retries, and persisted execution state.",
    content: "Technical documentation covers retries, durable sleeps, and workflow recovery.",
    sourceName: name,
    sourceKind: "official_blog",
    publishedAt: new Date(),
    trustScore: 0.94,
  });
}

describe("story clustering", () => {
  it("merges independently published evidence about the same event", () => {
    const clusters = clusterStories([
      item("https://vendor.example/durable-agent-workflows", "Vendor", "Durable agent workflows add crash recovery"),
      item("https://engineering.example/agent-workflow-recovery", "Engineering analysis", "Agent workflow recovery adds durable crash handling"),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.sources).toHaveLength(2);
    expect(clusters[0]!.independentSourceCount).toBe(2);
    expect(clusters[0]!.corroborationScore).toBeGreaterThan(70);
  });
});
