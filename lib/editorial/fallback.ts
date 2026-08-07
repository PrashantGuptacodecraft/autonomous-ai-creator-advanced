import type {
  DraftPost,
  EditorialCandidate,
  EditorialDecision,
  EvidenceSourceRecord,
  PersonaConstitution,
  VerificationResult,
} from "@/lib/types";
import { deterministicVerification } from "@/lib/editorial/quality";

export function fallbackDecisions(
  candidates: EditorialCandidate[],
  publicationThreshold = 72,
): { decisions: EditorialDecision[]; selectedCandidateId: string | null; cycleSummary: string } {
  const sorted = [...candidates].sort((a, b) => b.scores.total - a.scores.total);
  const selected = sorted.find((candidate) =>
    candidate.scores.total >= publicationThreshold &&
    candidate.scores.evidenceQuality >= 70 &&
    candidate.scores.timeliness >= 45 &&
    candidate.scores.claimVerifiability >= 60,
  );
  return {
    selectedCandidateId: selected?.id ?? null,
    cycleSummary: selected
      ? `Selected one evidence-backed story from ${candidates.length} candidates using the deterministic continuity policy.`
      : `No story met the deterministic publication threshold; all ${candidates.length} candidates were intentionally skipped or rejected.`,
    decisions: sorted.map((candidate) => ({
      candidateId: candidate.id,
      decision: candidate.id === selected?.id ? "PUBLISH" : candidate.corroborationScore < 55 ? "HOLD" : "REJECT",
      reason: candidate.id === selected?.id
        ? "The story combines current evidence, persona relevance, claim verifiability, and a concrete engineering consequence."
        : candidate.corroborationScore < 55
          ? "The story may be relevant but needs stronger canonical or independent evidence before publication."
          : "The story did not outperform the strongest candidate on evidence, novelty, timeliness, and practical impact.",
      whyNow: candidate.id === selected?.id
        ? "The underlying event is recent enough to affect current engineering or product decisions."
        : "Its present significance is not strong enough to justify publication in this cycle.",
      comparison: candidate.id === selected?.id
        ? "Chosen over alternatives with weaker evidence, lower practical impact, or more repetition."
        : "Rejected or held in favour of a stronger story, or because editorial restraint was preferable to filler.",
      confidence: candidate.id === selected?.id ? 0.78 : 0.73,
      scores: candidate.scores,
    })),
  };
}

export function fallbackDraft(
  persona: PersonaConstitution,
  candidate: EditorialCandidate,
  sources: EvidenceSourceRecord[],
  rejectedCount: number,
): DraftPost {
  const primary = sources.find((source) => source.source_role === "PRIMARY") ?? sources[0]!;
  const consequence = candidate.sourceKind === "github_release"
    ? "The meaningful signal is not the version number; it is whether the release changes how reliably teams can operate the system."
    : candidate.sourceKind === "research"
      ? "The result matters only if its assumptions survive outside the paper's evaluation setting."
      : "The important question is what this changes for teams building and operating AI systems now.";
  const evidenceLimit = candidate.independentSourceCount <= 1
    ? "This is currently a single-publisher evidence picture, so the conclusion should remain provisional."
    : `The story is supported across ${candidate.independentSourceCount} independent publishers.`;
  return {
    text: `${consequence}\n\n${candidate.title} is worth watching because the available evidence points to a concrete development in ${persona.domain}. ${primary.summary.slice(0, 420)}\n\n${evidenceLimit} My view: treat the announcement as an engineering input, not a conclusion. Examine implementation details, failure modes, migration cost, and operational trade-offs before changing production plans.`,
    rationale: `Selected because the story cleared the evidence, relevance, timeliness, and practical-impact threshold for ${persona.domain}. It is relevant now because the underlying source was recently published. The conclusion is based on ${sources.length} verified source${sources.length === 1 ? "" : "s"}, led by ${primary.source_name}. It was chosen over ${rejectedCount} alternatives that had weaker evidence, less novelty, more repetition, or lower engineering impact.`,
    claims: [{
      claim: `${candidate.title} was published by ${primary.source_name} and is relevant to ${persona.domain}.`,
      sourceUrls: [primary.canonical_url],
      confidence: 0.82,
    }],
    editorialAngle: consequence,
    uncertainties: candidate.independentSourceCount <= 1 ? ["Independent corroboration is limited at publication time."] : [],
    narrativeTitle: candidate.title.slice(0, 100),
    narrativePosition: `This development may matter to ${persona.domain}, but production value depends on implementation details and observed reliability.`,
    tags: [persona.domain, candidate.sourceKind.replaceAll("_", " ")],
  };
}

export function fallbackVerification(input: {
  draft: DraftPost;
  persona: PersonaConstitution;
  allowedSourceUrls: string[];
}): VerificationResult {
  return deterministicVerification(input);
}

export function fallbackReflection(
  published: boolean,
  discovered: number,
  rejected: number,
): { summary: string; priorities: string[] } {
  return {
    summary: published
      ? `The cycle published one evidence-backed story after reviewing ${discovered} discoveries and rejecting or holding ${rejected}. Future cycles should look for material updates rather than repeat the same angle.`
      : `The cycle reviewed ${discovered} discoveries but deliberately published nothing because no story cleared all quality gates.`,
    priorities: [
      "Prefer canonical evidence and independent corroboration.",
      "Look for material updates to existing narrative threads.",
      "Avoid repeating recently covered themes or release-summary language.",
    ],
  };
}
