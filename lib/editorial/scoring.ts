import type { CandidateScores, PersonaConstitution, StoryCluster } from "@/lib/types";
import { ageInHours } from "@/lib/utils/time";
import { tokenize } from "@/lib/utils/text";

const HYPE_TERMS = [
  "revolutionary", "game-changing", "mind-blowing", "breakthrough", "will change everything",
  "agi achieved", "insane", "unprecedented", "world-changing", "disrupt everything",
];

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function overlapScore(source: string, target: string): number {
  const sourceTokens = new Set(tokenize(source));
  const targetTokens = new Set(tokenize(target));
  if (targetTokens.size === 0) return 0;
  return [...targetTokens].filter((token) => sourceTokens.has(token)).length / targetTokens.size;
}

export function scoreStoryCluster(
  cluster: StoryCluster,
  persona: PersonaConstitution,
  now = new Date(),
): CandidateScores {
  const corpus = cluster.sources.map((source) => `${source.title} ${source.summary} ${source.content}`).join(" ");
  const personaCorpus = `${persona.domain} ${persona.interests.join(" ")}`;
  const overlap = overlapScore(corpus, personaCorpus);
  const ageHours = ageInHours(cluster.publishedAt, now);
  const timeliness = cluster.publishedAt
    ? ageHours <= 12 ? 100
      : ageHours <= 48 ? 90
        : ageHours <= 168 ? 66
          : ageHours <= 720 ? 30
            : 5
    : 30;
  const kinds = new Set(cluster.sources.map((source) => source.sourceKind));
  const releaseBonus = kinds.has("security_advisory") ? 20
    : kinds.has("github_release") ? 17
      : kinds.has("official_blog") ? 14
        : kinds.has("research") ? 9
          : 0;
  const practicalTerms = [
    "release", "security", "vulnerability", "latency", "cost", "api", "deployment",
    "evaluation", "agent", "open source", "production", "standard", "migration", "reliability",
    "benchmark", "inference", "memory", "database", "protocol", "availability",
  ];
  const lowerCorpus = corpus.toLowerCase();
  const practicalMatches = practicalTerms.filter((term) => lowerCorpus.includes(term)).length;
  const hypeMatches = HYPE_TERMS.filter((term) => lowerCorpus.includes(term)).length;
  const primarySources = cluster.sources.filter((source) => source.sourceRole !== "DISCOVERY_SIGNAL");
  const primaryTrust = primarySources.length
    ? primarySources.reduce((sum, source) => sum + source.trustScore, 0) / primarySources.length
    : cluster.primarySource.trustScore;

  const scores: CandidateScores = {
    personaRelevance: clamp(40 + overlap * 95),
    practicalImpact: clamp(34 + practicalMatches * 6 + releaseBonus),
    timeliness: clamp(timeliness),
    novelty: clamp(52 + releaseBonus / 2 + Math.min(10, cluster.independentSourceCount * 2)),
    evidenceQuality: clamp(primaryTrust * 72 + cluster.corroborationScore * 0.28),
    audienceUsefulness: clamp(42 + practicalMatches * 6),
    sourceIndependence: clamp(cluster.sourceDiversityScore),
    claimVerifiability: clamp(48 + primarySources.length * 12 + Math.min(18, cluster.sources.length * 4)),
    hypePenalty: clamp(hypeMatches * 18),
    repetitionPenalty: 0,
    total: 0,
  };
  scores.total = clamp(
    scores.personaRelevance * 0.2 +
      scores.practicalImpact * 0.17 +
      scores.timeliness * 0.12 +
      scores.novelty * 0.11 +
      scores.evidenceQuality * 0.16 +
      scores.audienceUsefulness * 0.08 +
      scores.sourceIndependence * 0.08 +
      scores.claimVerifiability * 0.08 -
      scores.hypePenalty * 0.08,
  );
  return scores;
}

export function hardRejectReason(
  cluster: StoryCluster,
  scores: CandidateScores,
  now = new Date(),
): string | null {
  const source = cluster.primarySource;
  const ageHours = ageInHours(cluster.publishedAt, now);
  if (!cluster.title || !source.canonicalUrl) return "Missing a usable title or canonical source URL.";
  if (source.trustScore < 0.5) return "Source credibility is below the publication threshold.";
  if (cluster.publishedAt && ageHours > 24 * 45) return "The event is too old to justify publishing as a current development.";
  if (scores.personaRelevance < 38) return "The story does not align strongly enough with the persona's stable domain.";
  if (scores.evidenceQuality < 58) return "The evidence bundle is too weak for publication.";
  if (cluster.sources.every((item) => item.sourceRole === "DISCOVERY_SIGNAL") && cluster.independentSourceCount < 2) {
    return "The story is supported only by a discovery signal and lacks canonical evidence.";
  }
  if (scores.hypePenalty >= 55 && scores.practicalImpact < 68) {
    return "The story relies on promotional language without enough practical evidence.";
  }
  return null;
}
