import { readBoundedText, safeFetch } from "@/lib/security/url";
import { sanitizeExternalContent } from "@/lib/security/content";

export async function fetchArticleEvidence(url: string): Promise<{
  content: string;
  contentType: string;
}> {
  const response = await safeFetch(url, {}, 10_000);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/(text\/html|text\/plain|application\/xhtml\+xml)/i.test(contentType)) {
    throw new Error(`Unsupported article content type: ${contentType || "unknown"}`);
  }
  const html = await readBoundedText(response, 1_500_000);
  return {
    content: sanitizeExternalContent(html, 12_000),
    contentType,
  };
}
