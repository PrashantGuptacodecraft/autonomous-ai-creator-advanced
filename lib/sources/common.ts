import type { DiscoveredSource, SourceKind, SourceRole } from "@/lib/types";
import { sanitizeExternalContent } from "@/lib/security/content";
import { normalizeUrl } from "@/lib/security/url";
import { sha256 } from "@/lib/utils/ids";

export function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function publisherKey(url: URL, sourceKind: SourceKind, metadata: Record<string, unknown>): string {
  if (sourceKind === "github_release" && typeof metadata.repository === "string") {
    return `github:${metadata.repository.toLowerCase()}`;
  }
  if (sourceKind === "research" && url.hostname.endsWith("arxiv.org")) {
    return `arxiv:${String(metadata.paperId ?? url.pathname).toLowerCase()}`;
  }
  return url.hostname.replace(/^www\./, "").toLowerCase();
}

export function createSource(input: {
  externalId?: string;
  title: string;
  url: string;
  summary?: string;
  content?: string;
  sourceName: string;
  sourceKind: SourceKind;
  sourceRole?: SourceRole;
  publishedAt?: Date | null;
  trustScore: number;
  metadata?: Record<string, unknown>;
}): DiscoveredSource {
  const canonicalUrl = normalizeUrl(input.url);
  const parsed = new URL(canonicalUrl);
  const metadata = input.metadata ?? {};
  const title = sanitizeExternalContent(input.title, 500);
  const summary = sanitizeExternalContent(input.summary ?? "", 2_500);
  const content = sanitizeExternalContent(input.content ?? summary, 12_000);
  return {
    externalId: input.externalId ?? sha256(`${canonicalUrl}:${title}`).slice(0, 32),
    title,
    url: input.url,
    canonicalUrl,
    hostname: parsed.hostname.replace(/^www\./, "").toLowerCase(),
    publisherKey: publisherKey(parsed, input.sourceKind, metadata),
    summary,
    content,
    sourceName: input.sourceName,
    sourceKind: input.sourceKind,
    sourceRole: input.sourceRole ?? (input.sourceKind === "news_signal" || input.sourceKind === "community_signal" ? "DISCOVERY_SIGNAL" : "PRIMARY"),
    publishedAt: input.publishedAt ?? null,
    discoveredAt: new Date(),
    trustScore: Math.max(0, Math.min(1, input.trustScore)),
    metadata,
  };
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
