import { getConfig } from "@/lib/config";
import {
  beginCycle,
  countPostsLastDay,
  findSemanticDuplicate,
  finishCycle,
  getAgentContext,
  getEvidenceSources,
  getNarratives,
  getRecentPosts,
  getRecentRejections,
  getPublishedCanonicalContext,
  publishPost,
  readExistingCycle,
  recordSourceHealth,
  saveAiAudits,
  saveCandidate,
  saveDecision,
  saveReflection,
  saveSourceItem,
  saveStoryCluster,
  setNextCycleAt,
  updatePublishedRunMetrics,
} from "@/lib/db/repository";
import { discoverTopics } from "@/lib/sources/discover";
import { publishToSocialNetworks } from "@/lib/social/publisher";
import { hardRejectReason, scoreStoryCluster } from "@/lib/editorial/scoring";
import {
  fallbackDecisions,
  fallbackDraft,
  fallbackReflection,
  fallbackVerification,
} from "@/lib/editorial/fallback";
import {
  aiAvailable,
  createEmbedding,
  generatePostDraft,
  generateReflection,
  judgeEditorialBatch,
  verifyPostDraft,
} from "@/lib/ai/gateway";
import { editorialPrompt, verificationPrompt, writingPrompt } from "@/lib/editorial/prompts";
import { evaluateQualityGate } from "@/lib/editorial/quality";
import type {
  AiAudit,
  CycleResult,
  DraftPost,
  EditorialCandidate,
  EditorialDecision,
  VerificationResult,
} from "@/lib/types";
import { deterministicDelaySeconds } from "@/lib/utils/time";
import { jaccardSimilarity } from "@/lib/utils/text";

function decisionCounts(decisions: EditorialDecision[]): { rejected: number; held: number } {
  return decisions.reduce(
    (counts, decision) => {
      if (["REJECT", "DUPLICATE"].includes(decision.decision)) counts.rejected += 1;
      if (decision.decision === "HOLD") counts.held += 1;
      return counts;
    },
    { rejected: 0, held: 0 },
  );
}

function nextCycleDate(
  agentId: string,
  cycleNumber: number,
  signal: "PUBLISHED" | "QUIET" | "ACTIVE" | "FAILED",
): Date {
  const config = getConfig();
  const raw = deterministicDelaySeconds(
    agentId,
    cycleNumber + 1,
    config.MIN_CYCLE_DELAY_SECONDS,
    config.MAX_CYCLE_DELAY_SECONDS,
  );
  const multiplier = signal === "PUBLISHED" ? 1.12 : signal === "ACTIVE" ? 0.82 : signal === "FAILED" ? 0.65 : 1;
  const seconds = Math.max(config.MIN_CYCLE_DELAY_SECONDS, Math.min(config.MAX_CYCLE_DELAY_SECONDS, Math.round(raw * multiplier)));
  return new Date(Date.now() + seconds * 1_000);
}

function existingCycleResult(cycleNumber: number, existing: Record<string, unknown> | null): CycleResult {
  return {
    cycleNumber,
    discovered: Number(existing?.discovered_count ?? 0),
    clustered: Number(existing?.clustered_count ?? 0),
    rejected: Number(existing?.rejected_count ?? 0),
    held: Number(existing?.held_count ?? 0),
    publishedPostId: (existing?.published_post_id as string | null) ?? null,
    qualityScore: existing?.quality_score == null ? null : Number(existing.quality_score),
    status: existing?.status === "PUBLISHED" ? "PUBLISHED" : existing?.status === "FAILED" ? "FAILED" : "SKIPPED",
    reason: String(existing?.reason ?? "Cycle was already processed idempotently."),
  };
}

function errorAudits(error: unknown): AiAudit[] {
  if (!error || typeof error !== "object") return [];
  const value = (error as { audits?: unknown }).audits;
  return Array.isArray(value) ? value as AiAudit[] : [];
}

async function persistAudits(agentId: string, runId: string, audits: AiAudit[]): Promise<void> {
  if (audits.length > 0) await saveAiAudits(agentId, runId, audits).catch(() => undefined);
}

function normalizeEditorialBatch(input: {
  candidates: EditorialCandidate[];
  decisions: EditorialDecision[];
  selectedCandidateId: string | null;
}): { decisions: EditorialDecision[]; selectedCandidateId: string | null } {
  const config = getConfig();
  const fallback = fallbackDecisions(input.candidates, config.MIN_PUBLICATION_SCORE);
  const generated = new Map(input.decisions.map((decision) => [decision.candidateId, decision]));
  let selectedCandidateId = input.candidates.some((candidate) =>
    candidate.id === input.selectedCandidateId && candidate.scores.total >= config.MIN_PUBLICATION_SCORE,
  ) ? input.selectedCandidateId : null;
  const decisions = input.candidates.map((candidate) => {
    const decision = generated.get(candidate.id) ?? fallback.decisions.find((item) => item.candidateId === candidate.id)!;
    if (candidate.id === selectedCandidateId) return { ...decision, decision: "PUBLISH" as const };
    if (decision.decision === "PUBLISH") return { ...decision, decision: "REJECT" as const };
    return decision;
  });
  if (!decisions.some((decision) => decision.decision === "PUBLISH")) selectedCandidateId = null;
  return { decisions, selectedCandidateId };
}

export async function runEditorialCycle(agentId: string, cycleNumber: number): Promise<CycleResult> {
  const { runId, started } = await beginCycle(agentId, cycleNumber);
  if (!started) return existingCycleResult(cycleNumber, await readExistingCycle(agentId, cycleNumber));

  let discoveredCount = 0;
  let clusteredCount = 0;
  let rejectedCount = 0;
  let heldCount = 0;
  let sourceHealth: Awaited<ReturnType<typeof discoverTopics>>["sourceHealth"] = [];

  try {
    const context = await getAgentContext(agentId);
    if (!context) throw new Error(`Unknown agent: ${agentId}`);
    if (context.agent.status !== "ACTIVE") throw new Error(`Agent is not active: ${context.agent.status}`);
    if (new Date(context.agent.evaluation_ends_at).getTime() <= Date.now()) {
      const reason = "The autonomous evaluation window has ended.";
      await finishCycle({
        agentId, runId, cycleNumber, status: "SKIPPED", discovered: 0, clustered: 0,
        rejected: 0, held: 0, reason, nextCycleAt: null,
      });
      return {
        cycleNumber, discovered: 0, clustered: 0, rejected: 0, held: 0,
        publishedPostId: null, qualityScore: null, status: "SKIPPED", reason,
      };
    }

    const discovery = await discoverTopics(context.persona);
    sourceHealth = discovery.sourceHealth;
    discoveredCount = discovery.items.length;
    clusteredCount = discovery.clusters.length;
    await recordSourceHealth(agentId, sourceHealth).catch(() => undefined);

    const recentPosts = await getRecentPosts(agentId, 24);
    const recentRejections = await getRecentRejections(agentId, 30);
    const eligible: EditorialCandidate[] = [];
    const allDecisions: EditorialDecision[] = [];

    for (const cluster of discovery.clusters) {
      const sourceItemIds: string[] = [];
      for (const source of cluster.sources) sourceItemIds.push(await saveSourceItem(agentId, source));
      const clusterId = await saveStoryCluster({ agentId, cycleNumber, cluster, sourceItemIds });
      const scores = scoreStoryCluster(cluster, context.persona);
      const maxSimilarity = recentPosts.reduce(
        (maximum, post) => Math.max(maximum, jaccardSimilarity(`${cluster.title} ${cluster.summary}`, post.text)),
        0,
      );
      scores.repetitionPenalty = Math.round(maxSimilarity * 100);
      scores.total = Math.max(0, Math.round(scores.total - scores.repetitionPenalty * 0.2));
      const candidate = await saveCandidate(agentId, cycleNumber, clusterId, sourceItemIds, cluster, scores);

      const priorCanonical = await getPublishedCanonicalContext(agentId, cluster.primarySource.canonicalUrl);
      const priorEvidenceSimilarity = priorCanonical
        ? jaccardSimilarity(
            `${cluster.title} ${cluster.summary}`,
            `${priorCanonical.sourceTitle} ${priorCanonical.sourceSummary}`,
          )
        : 0;
      const newerThanPriorPost = Boolean(
        priorCanonical && cluster.publishedAt && cluster.publishedAt.getTime() > priorCanonical.postCreatedAt.getTime(),
      );
      const materiallyUpdatedCanonical = Boolean(
        priorCanonical &&
        priorCanonical.sourceItemId !== candidate.sourceItemId &&
        newerThanPriorPost &&
        priorEvidenceSimilarity < 0.82,
      );
      const duplicateUrl = Boolean(priorCanonical && !materiallyUpdatedCanonical);
      const rejection = hardRejectReason(cluster, scores);
      if (duplicateUrl || maxSimilarity >= 0.72 || rejection) {
        const decision: EditorialDecision = {
          candidateId: candidate.id,
          decision: duplicateUrl || maxSimilarity >= 0.72 ? "DUPLICATE" : "REJECT",
          reason: duplicateUrl
            ? `The canonical source already supported post ${priorCanonical?.postId}; no materially newer evidence was detected.`
            : maxSimilarity >= 0.72
              ? "The story substantially repeats a recent post and does not add a sufficiently new angle."
              : rejection!,
          whyNow: "No publication is justified from this story in the current cycle.",
          comparison: "Rejected before model review under deterministic editorial safeguards.",
          confidence: 0.96,
          scores,
        };
        await saveDecision(agentId, cycleNumber, decision);
        allDecisions.push(decision);
      } else {
        eligible.push(candidate);
      }
    }

    const topCandidates = eligible
      .sort((left, right) => right.scores.total - left.scores.total)
      .slice(0, getConfig().MAX_EDITORIAL_CANDIDATES);

    let batch = fallbackDecisions(topCandidates, getConfig().MIN_PUBLICATION_SCORE);
    if (topCandidates.length > 0 && aiAvailable()) {
      try {
        const call = await judgeEditorialBatch(editorialPrompt({
          persona: context.persona,
          candidates: topCandidates,
          recentPosts,
          recentRejections: recentRejections.map((row) => ({ title: row.title, reason: row.reason })),
        }));
        batch = call.output;
        await persistAudits(agentId, runId, call.audits);
      } catch (error) {
        await persistAudits(agentId, runId, errorAudits(error));
        if (!getConfig().ALLOW_DEMO_FALLBACK) throw error;
      }
    } else if (topCandidates.length > 0 && !getConfig().ALLOW_DEMO_FALLBACK) {
      throw new Error("AI_GATEWAY_API_KEY is missing and fallback mode is disabled.");
    }

    const normalized = normalizeEditorialBatch({
      candidates: topCandidates,
      decisions: batch.decisions,
      selectedCandidateId: batch.selectedCandidateId,
    });
    for (const decision of normalized.decisions) {
      await saveDecision(agentId, cycleNumber, decision);
      allDecisions.push(decision);
    }

    let selectedDecision = allDecisions.find((decision) =>
      decision.candidateId === normalized.selectedCandidateId && decision.decision === "PUBLISH",
    );
    let selectedCandidate = topCandidates.find((candidate) => candidate.id === selectedDecision?.candidateId);

    const config = getConfig();
    const postsLastDay = await countPostsLastDay(agentId);
    const lastPostAt = context.agent.last_post_at ? new Date(context.agent.last_post_at).getTime() : null;
    const spacingBlocked = lastPostAt != null && Date.now() - lastPostAt < config.MIN_POST_SPACING_MINUTES * 60_000;
    if (selectedDecision && selectedCandidate && (spacingBlocked || postsLastDay >= config.MAX_POSTS_PER_DAY)) {
      selectedDecision = {
        ...selectedDecision,
        decision: "HOLD",
        reason: spacingBlocked
          ? "The story cleared editorial review but was held to preserve the minimum spacing between posts."
          : "The story cleared editorial review but was held by the daily anti-spam limit.",
        comparison: "Held rather than discarded so the editorial ledger remains transparent.",
      };
      await saveDecision(agentId, cycleNumber, selectedDecision);
      selectedCandidate = undefined;
    }

    const effectiveDecisions = allDecisions.map((decision) =>
      selectedDecision?.candidateId === decision.candidateId ? selectedDecision : decision,
    );
    const counts = decisionCounts(effectiveDecisions);
    rejectedCount = counts.rejected;
    heldCount = counts.held;

    if (!selectedDecision || !selectedCandidate || selectedDecision.decision !== "PUBLISH") {
      const nextCycleAt = nextCycleDate(agentId, cycleNumber, topCandidates.length > 0 ? "ACTIVE" : "QUIET");
      let reflection = fallbackReflection(false, discoveredCount, rejectedCount);
      if (aiAvailable()) {
        try {
          const call = await generateReflection(
            `Summarize an autonomous editorial cycle that discovered ${discoveredCount} items, formed ${clusteredCount} story clusters, rejected ${rejectedCount}, held ${heldCount}, and published nothing. Explain why restraint improved quality. Source health: ${JSON.stringify(sourceHealth)}`,
          );
          reflection = call.output;
          await persistAudits(agentId, runId, call.audits);
        } catch (error) {
          await persistAudits(agentId, runId, errorAudits(error));
        }
      }
      await saveReflection({ agentId, runId, summary: reflection.summary, priorities: reflection.priorities, sourceNotes: sourceHealth });
      const reason = batch.cycleSummary || "No story cleared the publication threshold.";
      await finishCycle({
        agentId, runId, cycleNumber, status: "SKIPPED", discovered: discoveredCount,
        clustered: clusteredCount, rejected: rejectedCount, held: heldCount, reason,
        sourceHealth, nextCycleAt,
      });
      return {
        cycleNumber, discovered: discoveredCount, clustered: clusteredCount,
        rejected: rejectedCount, held: heldCount, publishedPostId: null,
        qualityScore: null, status: "SKIPPED", reason,
      };
    }

    const sources = await getEvidenceSources(selectedCandidate.evidenceSourceItemIds);
    if (sources.length === 0) throw new Error("Selected story evidence was not persisted.");

    const embeddingCall = await createEmbedding(`${selectedCandidate.title}\n${selectedCandidate.summary}`);
    await persistAudits(agentId, runId, embeddingCall.audits);
    const semanticDuplicate = await findSemanticDuplicate(
      agentId,
      embeddingCall.embedding,
      config.SEMANTIC_DUPLICATE_THRESHOLD,
    );
    if (semanticDuplicate) {
      const duplicateDecision: EditorialDecision = {
        ...selectedDecision,
        decision: "DUPLICATE",
        reason: `Semantic memory found substantial overlap with ${semanticDuplicate.id} (${semanticDuplicate.similarity.toFixed(2)} similarity).`,
        comparison: "Rejected after semantic-memory review to avoid repeating the same narrative.",
      };
      await saveDecision(agentId, cycleNumber, duplicateDecision);
      rejectedCount += 1;
      const nextCycleAt = nextCycleDate(agentId, cycleNumber, "ACTIVE");
      await finishCycle({
        agentId, runId, cycleNumber, status: "SKIPPED", discovered: discoveredCount,
        clustered: clusteredCount, rejected: rejectedCount, held: heldCount,
        reason: duplicateDecision.reason, sourceHealth, nextCycleAt,
      });
      return {
        cycleNumber, discovered: discoveredCount, clustered: clusteredCount,
        rejected: rejectedCount, held: heldCount, publishedPostId: null,
        qualityScore: null, status: "SKIPPED", reason: duplicateDecision.reason,
      };
    }

    const narratives = await getNarratives(agentId, 12);
    let draft: DraftPost;
    if (aiAvailable()) {
      try {
        const call = await generatePostDraft(writingPrompt({
          persona: context.persona,
          candidate: selectedCandidate,
          sources,
          decision: selectedDecision,
          recentPosts,
          narratives,
          rejectedCount,
        }));
        draft = call.output;
        await persistAudits(agentId, runId, call.audits);
      } catch (error) {
        await persistAudits(agentId, runId, errorAudits(error));
        if (!config.ALLOW_DEMO_FALLBACK) throw error;
        draft = fallbackDraft(context.persona, selectedCandidate, sources, rejectedCount);
      }
    } else {
      draft = fallbackDraft(context.persona, selectedCandidate, sources, rejectedCount);
    }

    const allowedSourceUrls = sources.map((source) => source.canonical_url);
    let verification: VerificationResult;
    if (aiAvailable()) {
      try {
        const call = await verifyPostDraft(verificationPrompt({ persona: context.persona, draft, sources }));
        verification = call.output;
        await persistAudits(agentId, runId, call.audits);
      } catch (error) {
        await persistAudits(agentId, runId, errorAudits(error));
        verification = fallbackVerification({ draft, persona: context.persona, allowedSourceUrls });
      }
    } else {
      verification = fallbackVerification({ draft, persona: context.persona, allowedSourceUrls });
    }

    let qualityGate = evaluateQualityGate({
      draft,
      verification,
      persona: context.persona,
      allowedSourceUrls,
      recentPosts,
      minimumScore: config.MIN_QUALITY_GATE_SCORE,
    });

    if ((!verification.approved || !qualityGate.passed) && aiAvailable()) {
      const revisionNotes = [
        ...verification.revisionNotes,
        ...verification.unsupportedClaims.map((claim) => `Remove or support: ${claim}`),
        ...qualityGate.failures,
      ];
      const call = await generatePostDraft(writingPrompt({
        persona: context.persona,
        candidate: selectedCandidate,
        sources,
        decision: selectedDecision,
        recentPosts,
        narratives,
        rejectedCount,
        revisionNotes,
      }));
      draft = call.output;
      await persistAudits(agentId, runId, call.audits);
      try {
        const verifyCall = await verifyPostDraft(verificationPrompt({ persona: context.persona, draft, sources }));
        verification = verifyCall.output;
        await persistAudits(agentId, runId, verifyCall.audits);
      } catch (error) {
        await persistAudits(agentId, runId, errorAudits(error));
        verification = fallbackVerification({ draft, persona: context.persona, allowedSourceUrls });
      }
      qualityGate = evaluateQualityGate({
        draft,
        verification,
        persona: context.persona,
        allowedSourceUrls,
        recentPosts,
        minimumScore: config.MIN_QUALITY_GATE_SCORE,
      });
    }

    if (!verification.approved || !qualityGate.passed) {
      const reason = `Draft failed publication quality gates (${qualityGate.score}/100): ${qualityGate.failures.join(" ") || "model verification rejected the draft"}`;
      const nextCycleAt = nextCycleDate(agentId, cycleNumber, "ACTIVE");
      await finishCycle({
        agentId, runId, cycleNumber, status: "SKIPPED", discovered: discoveredCount,
        clustered: clusteredCount, rejected: rejectedCount + 1, held: heldCount,
        qualityScore: qualityGate.score, reason, sourceHealth, nextCycleAt,
      });
      return {
        cycleNumber, discovered: discoveredCount, clustered: clusteredCount,
        rejected: rejectedCount + 1, held: heldCount, publishedPostId: null,
        qualityScore: qualityGate.score, status: "SKIPPED", reason,
      };
    }

    const postEmbeddingCall = await createEmbedding(`${draft.text}\n${draft.rationale}`);
    await persistAudits(agentId, runId, postEmbeddingCall.audits);
    const postId = await publishPost({
      agentId,
      cycleNumber,
      runId,
      candidate: selectedCandidate,
      sources,
      draft,
      verification,
      qualityGate,
      embedding: postEmbeddingCall.embedding ?? embeddingCall.embedding,
    });
    await updatePublishedRunMetrics({
      runId,
      discovered: discoveredCount,
      clustered: clusteredCount,
      rejected: rejectedCount,
      held: heldCount,
      qualityScore: qualityGate.score,
      sourceHealth,
    });
    const nextCycleAt = nextCycleDate(agentId, cycleNumber, "PUBLISHED");
    await setNextCycleAt(agentId, nextCycleAt);
    await publishToSocialNetworks(draft.text);

    let reflection = fallbackReflection(true, discoveredCount, rejectedCount);
    if (aiAvailable()) {
      try {
        const call = await generateReflection(
          `Reflect on a cycle that published post ${postId} with quality score ${qualityGate.score} after discovering ${discoveredCount} items, forming ${clusteredCount} clusters, rejecting ${rejectedCount}, and holding ${heldCount}. The narrative was ${draft.narrativeTitle}. Give future editorial priorities without changing the persona constitution.`,
        );
        reflection = call.output;
        await persistAudits(agentId, runId, call.audits);
      } catch (error) {
        await persistAudits(agentId, runId, errorAudits(error));
      }
    }
    await saveReflection({ agentId, runId, summary: reflection.summary, priorities: reflection.priorities, sourceNotes: sourceHealth });

    return {
      cycleNumber,
      discovered: discoveredCount,
      clustered: clusteredCount,
      rejected: rejectedCount,
      held: heldCount,
      publishedPostId: postId,
      qualityScore: qualityGate.score,
      status: "PUBLISHED",
      reason: "A corroborated story passed editorial, memory, evidence, persona, and deterministic quality gates.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown autonomous cycle failure";
    await persistAudits(agentId, runId, errorAudits(error));
    const nextCycleAt = nextCycleDate(agentId, cycleNumber, "FAILED");
    await finishCycle({
      agentId, runId, cycleNumber, status: "FAILED", discovered: discoveredCount,
      clustered: clusteredCount, rejected: rejectedCount, held: heldCount,
      reason: "The cycle failed safely; no partial post was published.", error: message,
      sourceHealth, nextCycleAt,
    }).catch(() => undefined);
    return {
      cycleNumber, discovered: discoveredCount, clustered: clusteredCount,
      rejected: rejectedCount, held: heldCount, publishedPostId: null,
      qualityScore: null, status: "FAILED", reason: message,
    };
  }
}
