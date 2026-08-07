import { XMLParser } from "fast-xml-parser";
import { readBoundedText, safeFetch } from "@/lib/security/url";
import type { DiscoveredSource } from "@/lib/types";
import type { DiscoveryContext, SourceAdapter } from "@/lib/sources/types";
import { asArray, createSource, parseDate } from "@/lib/sources/common";

interface AtomLink {
  "@_href"?: string;
  "@_rel"?: string;
}

export class ArxivAdapter implements SourceAdapter {
  readonly name = "arxiv";

  async discover(context: DiscoveryContext): Promise<DiscoveredSource[]> {
    const query = encodeURIComponent(
      `all:${context.domain.replace(/[^a-zA-Z0-9 ]/g, " ").trim() || "artificial intelligence"}`,
    );
    const response = await safeFetch(
      `https://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=${Math.min(context.maxItemsPerSource, 10)}&sortBy=submittedDate&sortOrder=descending`,
      {},
      12_000,
    );
    const xml = await readBoundedText(response, 1_500_000);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
    const parsed = parser.parse(xml) as { feed?: { entry?: unknown } };
    return asArray(parsed.feed?.entry).flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const entry = raw as Record<string, unknown>;
      const links = asArray(entry.link) as AtomLink[];
      const url =
        links.find((link) => link["@_rel"] === "alternate")?.["@_href"] ??
        String(entry.id ?? "");
      if (!url.startsWith("http")) return [];
      return [
        createSource({
          externalId: String(entry.id ?? url),
          title: String(entry.title ?? "Untitled paper"),
          url,
          summary: String(entry.summary ?? ""),
          content: String(entry.summary ?? ""),
          sourceName: "arXiv",
          sourceKind: "research",
          publishedAt: parseDate(entry.published ?? entry.updated),
          trustScore: 0.78,
          metadata: {
            adapter: this.name,
            updated: entry.updated,
            authors: asArray(entry.author).map((author) =>
              typeof author === "object" && author
                ? String((author as Record<string, unknown>).name ?? "")
                : String(author),
            ),
          },
        }),
      ];
    });
  }
}
