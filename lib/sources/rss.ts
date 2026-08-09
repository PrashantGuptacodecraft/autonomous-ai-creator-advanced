import { XMLParser } from "fast-xml-parser";
import { getConfig } from "@/lib/config";
import { readBoundedText, safeFetch } from "@/lib/security/url";
import type { DiscoveredSource } from "@/lib/types";
import type { DiscoveryContext, SourceAdapter } from "@/lib/sources/types";
import { asArray, createSource, parseDate } from "@/lib/sources/common";

const DEFAULT_FEEDS = [
  { name: "Schneier on Security", url: "https://www.schneier.com/feed/atom/", trust: 0.95 },
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", trust: 0.90 },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", trust: 0.92 },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", trust: 0.96 },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", trust: 0.90 },
  { name: "The Daily Swig", url: "https://portswigger.net/daily-swig/rss", trust: 0.91 },
  { name: "CSO Online", url: "https://www.csoonline.com/feed/", trust: 0.85 },
  { name: "Naked Security", url: "https://nakedsecurity.sophos.com/feed/", trust: 0.90 },
  { name: "SecurityWeek", url: "https://www.securityweek.com/feed/", trust: 0.88 },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/", trust: 0.94 },
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", trust: 0.95 },
  { name: "Google TAG", url: "https://blog.google/threat-analysis-group/rss/", trust: 0.97 },
  { name: "MSRC", url: "https://msrc.microsoft.com/blog/feed", trust: 0.98 },
  { name: "Google AI", url: "https://blog.google/technology/ai/rss/", trust: 0.96 },
  { name: "GitHub AI & ML", url: "https://github.blog/ai-and-ml/feed/", trust: 0.94 },
  { name: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", trust: 0.93 },
];

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record["#text"] ?? record.__cdata ?? "");
  }
  return "";
}

function linkOf(value: unknown): string {
  for (const candidate of asArray(value)) {
    if (typeof candidate === "string") return candidate;
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>;
      const href = record["@_href"] ?? record.href ?? record["#text"];
      if (href) return String(href);
    }
  }
  return "";
}

export class RssAdapter implements SourceAdapter {
  readonly name = "rss";

  async discover(context: DiscoveryContext): Promise<DiscoveredSource[]> {
    const extra = (getConfig().EXTRA_RSS_FEEDS ?? "")
      .split(",")
      .map((url: string) => url.trim())
      .filter(Boolean)
      .map((url: string) => ({ name: new URL(url).hostname, url, trust: 0.72 }));
    const feeds = [...DEFAULT_FEEDS, ...extra];
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      cdataPropName: "__cdata",
    });

    const settled = await Promise.allSettled(
      feeds.map(async (feed) => {
        const response = await safeFetch(feed.url, {}, 10_000);
        const xml = await readBoundedText(response, 2_000_000);
        const parsed = parser.parse(xml) as Record<string, unknown>;
        const rssChannel = (parsed.rss as Record<string, unknown> | undefined)?.channel as
          | Record<string, unknown>
          | undefined;
        const atomFeed = parsed.feed as Record<string, unknown> | undefined;
        const entries = rssChannel
          ? asArray(rssChannel.item)
          : asArray(atomFeed?.entry);

        return entries.slice(0, context.maxItemsPerSource).flatMap((raw) => {
          if (!raw || typeof raw !== "object") return [];
          const item = raw as Record<string, unknown>;
          const title = textOf(item.title);
          const url = linkOf(item.link) || textOf(item.guid) || textOf(item.id);
          if (!title || !url.startsWith("http")) return [];
          const summary = textOf(
            item.description ?? item.summary ?? item.content ?? item["content:encoded"],
          );
          return [
            createSource({
              externalId: textOf(item.guid ?? item.id) || undefined,
              title,
              url,
              summary,
              content: summary,
              sourceName: feed.name,
              sourceKind: "official_blog",
              publishedAt: parseDate(item.pubDate ?? item.published ?? item.updated),
              trustScore: feed.trust,
              metadata: { adapter: this.name, feedUrl: feed.url },
            }),
          ];
        });
      }),
    );

    return settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
  }
}
