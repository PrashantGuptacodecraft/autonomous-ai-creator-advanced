import { getConfig } from "@/lib/config";
import { safeFetch } from "@/lib/security/url";
import type { DiscoveredSource } from "@/lib/types";
import type { DiscoveryContext, SourceAdapter } from "@/lib/sources/types";
import { createSource } from "@/lib/sources/common";
import { fetchArticleEvidence } from "@/lib/sources/article";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

interface HackerNewsItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  deleted?: boolean;
  dead?: boolean;
}

const KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "llm", "model", "agent",
  "robot", "open source", "developer", "database", "compiler", "security",
  "inference", "vector", "rag", "mcp", "gpu", "vulnerability", "cve", "zero-day",
  "breach", "cryptography", "privacy", "patch", "cybersecurity", "malware",
  "exploit", "phishing", "ransomware", "hacker", "authentication",
];

export class HackerNewsAdapter implements SourceAdapter {
  readonly name = "hacker-news";

  async discover(context: DiscoveryContext): Promise<DiscoveredSource[]> {
    const indexResponse = await safeFetch("https://hacker-news.firebaseio.com/v0/newstories.json", {}, 8_000);
    const ids = ((await indexResponse.json()) as number[]).slice(0, 150);
    const settled = await mapWithConcurrency(
      ids,
      getConfig().SOURCE_FETCH_CONCURRENCY,
      async (id) => {
        const response = await safeFetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {}, 8_000);
        return (await response.json()) as HackerNewsItem;
      },
    );

    const selected = settled
      .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
      .filter((item) => {
        const title = item.title?.toLowerCase() ?? "";
        const domainTokens = context.domain.toLowerCase().split(/\s+/).filter((token) => token.length > 3);
        return !item.deleted && !item.dead && item.type === "story" && Boolean(item.url) &&
          (KEYWORDS.some((keyword) => title.includes(keyword)) || domainTokens.some((token) => title.includes(token)));
      })
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, context.maxItemsPerSource);

    const evidence = await mapWithConcurrency(
      selected,
      Math.max(2, Math.floor(getConfig().SOURCE_FETCH_CONCURRENCY / 2)),
      async (item) => {
        const article = await fetchArticleEvidence(item.url!);
        const hostname = new URL(item.url!).hostname.replace(/^www\./, "");
        return createSource({
          externalId: String(item.id),
          title: item.title ?? "Untitled technology story",
          url: item.url!,
          summary: article.content.slice(0, 1_500),
          content: article.content,
          sourceName: hostname,
          sourceKind: "news_signal",
          sourceRole: "DISCOVERY_SIGNAL",
          publishedAt: item.time ? new Date(item.time * 1000) : null,
          trustScore: Math.min(0.78, 0.58 + Math.log10(Math.max(1, item.score ?? 1)) * 0.08),
          metadata: {
            adapter: this.name,
            discoverySignal: "Hacker News",
            hackerNewsId: item.id,
            score: item.score ?? 0,
            comments: item.descendants ?? 0,
            submittedBy: item.by,
            contentType: article.contentType,
          },
        });
      },
    );

    return evidence.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  }
}
