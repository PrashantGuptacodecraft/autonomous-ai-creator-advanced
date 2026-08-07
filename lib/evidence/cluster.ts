import type { DiscoveredSource, StoryCluster } from "@/lib/types";
import { stableShortId, sha256 } from "@/lib/utils/ids";
import { jaccardSimilarity, normalizeForFingerprint, tokenize, truncate } from "@/lib/utils/text";

const STOPWORDS = new Set([
  "about", "after", "again", "against", "announces", "available", "from", "into", "more", "new", "release", "released", "their", "this", "that", "the", "with", "using", "version", "update", "launches", "introduces",
]);

function significantTokens(value: string): string[] {
  return tokenize(value).filter((token) => token.length > 3 && !STOPWORDS.has(token));
}

function clusterSimilarity(source: DiscoveredSource, cluster: StoryCluster): number {
  const titleSimilarity = jaccardSimilarity(source.title, cluster.title);
  const summarySimilarity = jaccardSimilarity(source.summary, cluster.summary);
  const sourceTokens = new Set(significantTokens(`${source.title} ${source.summary}`));
  const clusterTokens = new Set(significantTokens(`${cluster.title} ${cluster.summary}`));
  const shared = [...sourceTokens].filter((token) => clusterTokens.has(token)).length;
  const entityBoost = shared >= 3 ? 0.2 : shared >= 2 ? 0.1 : 0;
  return Math.min(1, titleSimilarity * 0.65 + summarySimilarity * 0.2 + entityBoost);
}

function sourceRank(source: DiscoveredSource): number {
  const role = source.sourceKind === "security_advisory" ? 16
    : source.sourceKind === "official_blog" ? 14
      : source.sourceKind === "github_release" ? 13
        : source.sourceKind === "research" ? 10
          : 0;
  const recency = source.publishedAt ? Math.max(0, 8 - (Date.now() - source.publishedAt.getTime()) / 86_400_000) : 0;
  return source.trustScore * 100 + role + recency;
}

function finalize(sources: DiscoveredSource[]): StoryCluster {
  const ordered = [...sources].sort((a, b) => sourceRank(b) - sourceRank(a));
  const primarySource = ordered[0]!;
  const publishers = new Set(ordered.map((source) => source.publisherKey));
  const independentSourceCount = publishers.size;
  const meanTrust = ordered.reduce((sum, source) => sum + source.trustScore, 0) / ordered.length;
  const primaryEvidence = ordered.filter((source) => source.sourceRole !== "DISCOVERY_SIGNAL").length;
  const corroborationScore = Math.round(Math.min(100,
    meanTrust * 62 + Math.min(24, (independentSourceCount - 1) * 12) + Math.min(14, primaryEvidence * 5),
  ));
  const sourceDiversityScore = Math.round(Math.min(100, independentSourceCount * 28 + Math.min(16, ordered.length * 4)));
  const newest = ordered
    .map((source) => source.publishedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const title = primarySource.title;
  const combinedSummary = ordered
    .slice(0, 4)
    .map((source) => source.summary)
    .filter(Boolean)
    .join(" ");
  const fingerprint = sha256(normalizeForFingerprint(`${title} ${significantTokens(combinedSummary).slice(0, 24).join(" ")}`));
  return {
    id: stableShortId("story", fingerprint),
    fingerprint,
    title,
    summary: truncate(primarySource.summary || combinedSummary, 2_000),
    primarySource,
    sources: ordered.map((source, index) => ({
      ...source,
      sourceRole: index === 0 ? "PRIMARY" : source.sourceRole === "DISCOVERY_SIGNAL" ? "DISCOVERY_SIGNAL" : "CORROBORATING",
    })),
    publishedAt: newest,
    independentSourceCount,
    corroborationScore,
    sourceDiversityScore,
    evidenceSummary: `${ordered.length} source${ordered.length === 1 ? "" : "s"} across ${independentSourceCount} independent publisher${independentSourceCount === 1 ? "" : "s"}; corroboration ${corroborationScore}/100.`,
  };
}

export function clusterStories(items: DiscoveredSource[]): StoryCluster[] {
  const exact = new Map<string, DiscoveredSource>();
  for (const item of items) {
    const existing = exact.get(item.canonicalUrl);
    if (!existing || sourceRank(item) > sourceRank(existing)) exact.set(item.canonicalUrl, item);
  }

  const clusters: StoryCluster[] = [];
  for (const source of [...exact.values()].sort((a, b) => sourceRank(b) - sourceRank(a))) {
    let bestIndex = -1;
    let bestScore = 0;
    for (let index = 0; index < clusters.length; index += 1) {
      const score = clusterSimilarity(source, clusters[index]!);
      if (score > bestScore) {
        bestIndex = index;
        bestScore = score;
      }
    }
    if (bestIndex >= 0 && bestScore >= 0.46) {
      clusters[bestIndex] = finalize([...clusters[bestIndex]!.sources, source]);
    } else {
      clusters.push(finalize([source]));
    }
  }
  return clusters.sort((a, b) => {
    const time = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
    return time || b.corroborationScore - a.corroborationScore;
  });
}
