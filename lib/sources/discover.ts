import type { PersonaConstitution, DiscoveredSource, StoryCluster } from "@/lib/types";
import type { SourceAdapter } from "@/lib/sources/types";
import { RssAdapter } from "@/lib/sources/rss";
import { GitHubReleaseAdapter } from "@/lib/sources/github";
import { HackerNewsAdapter } from "@/lib/sources/hackernews";
import { ArxivAdapter } from "@/lib/sources/arxiv";
import { clusterStories } from "@/lib/evidence/cluster";
import { getConfig } from "@/lib/config";

const adapters: SourceAdapter[] = [
  new RssAdapter(),
  new GitHubReleaseAdapter(),
  new HackerNewsAdapter(),
  new ArxivAdapter(),
];

export interface DiscoveryReport {
  items: DiscoveredSource[];
  clusters: StoryCluster[];
  sourceHealth: Array<{
    adapter: string;
    status: "ok" | "failed";
    itemCount: number;
    latencyMs: number;
    error?: string;
  }>;
}

export async function discoverTopics(persona: PersonaConstitution): Promise<DiscoveryReport> {
  const context = {
    domain: persona.domain,
    interests: persona.interests,
    maxItemsPerSource: 12,
  };
  const settled = await Promise.allSettled(
    adapters.map(async (adapter) => {
      const startedAt = Date.now();
      const items = await adapter.discover(context);
      return { adapter: adapter.name, items, latencyMs: Date.now() - startedAt };
    }),
  );

  const sourceHealth: DiscoveryReport["sourceHealth"] = [];
  const allItems: DiscoveredSource[] = [];
  settled.forEach((result, index) => {
    const adapterName = adapters[index]?.name ?? `adapter-${index}`;
    if (result.status === "fulfilled") {
      sourceHealth.push({
        adapter: adapterName,
        status: "ok",
        itemCount: result.value.items.length,
        latencyMs: result.value.latencyMs,
      });
      allItems.push(...result.value.items);
    } else {
      sourceHealth.push({
        adapter: adapterName,
        status: "failed",
        itemCount: 0,
        latencyMs: 0,
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  });

  const byUrl = new Map<string, DiscoveredSource>();
  for (const item of allItems) {
    const existing = byUrl.get(item.canonicalUrl);
    if (!existing || item.trustScore > existing.trustScore) byUrl.set(item.canonicalUrl, item);
  }

  const items = [...byUrl.values()]
    .sort((left, right) => {
      const rightTime = right.publishedAt?.getTime() ?? 0;
      const leftTime = left.publishedAt?.getTime() ?? 0;
      return rightTime - leftTime || right.trustScore - left.trustScore;
    })
    .slice(0, getConfig().MAX_DISCOVERED_ITEMS);

  return { items, clusters: clusterStories(items), sourceHealth };
}
