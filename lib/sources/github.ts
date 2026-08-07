import { getConfig } from "@/lib/config";
import { safeFetch } from "@/lib/security/url";
import type { DiscoveredSource } from "@/lib/types";
import type { DiscoveryContext, SourceAdapter } from "@/lib/sources/types";
import { createSource, parseDate } from "@/lib/sources/common";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const DEFAULT_REPOSITORIES = [
  "vercel/ai",
  "vercel/workflow",
  "modelcontextprotocol/specification",
  "huggingface/transformers",
  "langchain-ai/langchain",
  "openai/openai-python",
  "ollama/ollama",
  "vllm-project/vllm",
];

interface GitHubRelease {
  id: number;
  html_url: string;
  name: string | null;
  tag_name: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  created_at: string;
  author?: { login?: string };
}

export class GitHubReleaseAdapter implements SourceAdapter {
  readonly name = "github-releases";

  async discover(context: DiscoveryContext): Promise<DiscoveredSource[]> {
    const config = getConfig();
    const extra = (config.EXTRA_GITHUB_REPOS ?? "").split(",").map((repo: string) => repo.trim()).filter(Boolean);
    const repositories = [...new Set([...DEFAULT_REPOSITORIES, ...extra])];
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (config.GITHUB_TOKEN) headers.Authorization = `Bearer ${config.GITHUB_TOKEN}`;

    const settled = await mapWithConcurrency(
      repositories,
      Math.min(4, config.SOURCE_FETCH_CONCURRENCY),
      async (repository) => {
        const response = await safeFetch(
          `https://api.github.com/repos/${repository}/releases?per_page=${Math.min(context.maxItemsPerSource, 8)}`,
          { headers },
          12_000,
        );
        const releases = (await response.json()) as GitHubRelease[];
        return releases.filter((release) => !release.draft).map((release) => createSource({
          externalId: String(release.id),
          title: `${repository} ${release.name ?? release.tag_name}`,
          url: release.html_url,
          summary: release.body ?? "",
          content: release.body ?? "",
          sourceName: `GitHub · ${repository}`,
          sourceKind: "github_release",
          sourceRole: "PRIMARY",
          publishedAt: parseDate(release.published_at ?? release.created_at),
          trustScore: release.prerelease ? 0.82 : 0.95,
          metadata: {
            adapter: this.name,
            repository,
            tag: release.tag_name,
            prerelease: release.prerelease,
            author: release.author?.login,
          },
        }));
      },
    );

    return settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  }
}
