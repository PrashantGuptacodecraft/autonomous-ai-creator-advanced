import { db, withTransaction } from "@/lib/db/client";
import type {
  AiAudit,
  CandidateScores,
  DiscoveredSource,
  DraftPost,
  EditorialCandidate,
  EditorialDecision,
  EvidenceSourceRecord,
  FeedPost,
  PersonaConstitution,
  PersonaInput,
  QualityGateResult,
  StoryCluster,
  VerificationResult,
} from "@/lib/types";
import { createId, sha256, stableShortId } from "@/lib/utils/ids";
import { computeAutonomyEventHash } from "@/lib/audit/ledger";
import { safeJsonParse, stableJsonStringify } from "@/lib/utils/json";

interface AgentRow {
  id: string;
  name: string;
  domain: string;
  status: string;
  workflow_run_id: string | null;
  initialized_at: string | Date;
  evaluation_ends_at: string | Date;
  last_cycle_at: string | Date | null;
  next_cycle_at: string | Date | null;
  last_post_at: string | Date | null;
  completed_cycles: number;
  published_count: number;
  failure_reason: string | null;
}

interface PersonaRow {
  constitution: PersonaConstitution | string;
  version: number;
}

export interface AgentContext {
  agent: AgentRow;
  persona: PersonaConstitution;
}

export interface RecentPostMemory {
  id: string;
  text: string;
  rationale: string;
  createdAt: Date;
  narrativeTitle: string;
}

type AutonomyEventType =
  | "AGENT_INITIALIZED"
  | "WORKFLOW_ATTACHED"
  | "CYCLE_STARTED"
  | "CYCLE_COMPLETED"
  | "POST_PUBLISHED"
  | "AGENT_COMPLETED"
  | "AGENT_FAILED";

type TransactionClient = {
  query: (text: string, params?: unknown[]) => Promise<{
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }>;
};

async function appendAutonomyEventWithClient(
  client: TransactionClient,
  agentId: string,
  eventType: AutonomyEventType,
  eventKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query("SELECT id FROM agents WHERE id = $1 FOR UPDATE", [agentId]);
  const previous = await client.query(
    `SELECT event_hash FROM autonomy_events
     WHERE agent_id = $1 ORDER BY sequence DESC LIMIT 1`,
    [agentId],
  );
  const previousHash = String(previous.rows[0]?.event_hash ?? "GENESIS");
  const occurredAt = new Date().toISOString();
  const normalizedPayload = stableJsonStringify(payload);
  const eventHash = computeAutonomyEventHash({
    previousHash,
    eventType,
    occurredAt,
    payload,
  });
  const eventId = stableShortId("evt", `${agentId}:${eventKey}`);
  await client.query(
    `INSERT INTO autonomy_events
     (id, agent_id, event_type, occurred_at, payload, previous_hash, event_hash)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     ON CONFLICT (id) DO NOTHING`,
    [eventId, agentId, eventType, occurredAt, normalizedPayload, previousHash, eventHash],
  );
}


export async function createAgent(
  input: PersonaInput,
  persona: PersonaConstitution,
  evaluationWindowHours: number,
): Promise<string> {
  const agentId = createId("agt");
  const evaluationEndsAt = new Date(Date.now() + evaluationWindowHours * 3_600_000);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO agents
       (id, name, domain, status, evaluation_ends_at)
       VALUES ($1, $2, $3, 'INITIALIZING', $4)`,
      [agentId, input.name.trim(), input.domain.trim(), evaluationEndsAt.toISOString()],
    );
    await client.query(
      `INSERT INTO persona_versions
       (agent_id, version, constitution, constitution_hash, active)
       VALUES ($1, $2, $3::jsonb, $4, TRUE)`,
      [agentId, persona.version, JSON.stringify(persona), persona.hash],
    );
    await appendAutonomyEventWithClient(client, agentId, "AGENT_INITIALIZED", "initialized", {
      name: input.name.trim(),
      domain: input.domain.trim(),
      personaHash: persona.hash,
      evaluationEndsAt: evaluationEndsAt.toISOString(),
    });
  });
  return agentId;
}

export async function prepareAgentForWorkflow(agentId: string): Promise<void> {
  await db()`
    UPDATE agents
    SET status = 'ACTIVE', failure_reason = NULL, updated_at = NOW()
    WHERE id = ${agentId} AND status = 'INITIALIZING'
  `;
}

export async function attachWorkflowRun(agentId: string, workflowRunId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE agents SET workflow_run_id = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'ACTIVE'`,
      [workflowRunId, agentId],
    );
    await appendAutonomyEventWithClient(client, agentId, "WORKFLOW_ATTACHED", `workflow:${workflowRunId}`, {
      workflowRunId,
    });
  });
}

export async function markAgentFailed(agentId: string, reason: string): Promise<void> {
  const safeReason = reason.slice(0, 2_000);
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE agents SET status = 'FAILED', failure_reason = $1, next_cycle_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [safeReason, agentId],
    );
    await appendAutonomyEventWithClient(client, agentId, "AGENT_FAILED", `failed:${sha256(safeReason).slice(0, 12)}`, {
      reason: safeReason,
    });
  });
}

export async function getAgentContext(agentId: string): Promise<AgentContext | null> {
  const agents = (await db()`
    SELECT id, name, domain, status, workflow_run_id, initialized_at,
           evaluation_ends_at, last_cycle_at, next_cycle_at, last_post_at,
           completed_cycles, published_count, failure_reason
    FROM agents WHERE id = ${agentId}
  `) as unknown as AgentRow[];
  const agent = agents[0];
  if (!agent) return null;
  const personas = (await db()`
    SELECT constitution, version
    FROM persona_versions
    WHERE agent_id = ${agentId} AND active = TRUE
    ORDER BY version DESC LIMIT 1
  `) as unknown as PersonaRow[];
  const personaRow = personas[0];
  if (!personaRow) throw new Error(`Agent ${agentId} has no active persona`);
  return { agent, persona: safeJsonParse(personaRow.constitution, {} as PersonaConstitution) };
}

export async function beginCycle(agentId: string, cycleNumber: number): Promise<{
  runId: string;
  started: boolean;
}> {
  const runId = stableShortId("run", `${agentId}:${cycleNumber}`);
  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO agent_runs (id, agent_id, cycle_number, status)
       VALUES ($1,$2,$3,'RUNNING')
       ON CONFLICT (agent_id, cycle_number) DO NOTHING
       RETURNING id`,
      [runId, agentId, cycleNumber],
    );
    const started = inserted.rows.length > 0;
    if (started) {
      await appendAutonomyEventWithClient(client, agentId, "CYCLE_STARTED", `cycle:${cycleNumber}:started`, {
        cycleNumber,
        runId,
      });
    }
    return { runId, started };
  });
}

export async function readExistingCycle(agentId: string, cycleNumber: number) {
  const rows = (await db()`
    SELECT id, status, discovered_count, clustered_count, rejected_count, held_count,
           published_post_id, quality_score, reason
    FROM agent_runs
    WHERE agent_id = ${agentId} AND cycle_number = ${cycleNumber}
  `) as unknown as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export async function saveSourceItem(agentId: string, source: DiscoveredSource): Promise<string> {
  const contentHash = sha256(`${source.title}\n${source.content}`);
  const id = stableShortId("src", `${agentId}:${source.canonicalUrl}:${contentHash}`);
  await db()`
    INSERT INTO source_items
      (id, agent_id, external_id, title, url, canonical_url, hostname, publisher_key,
       summary, content, source_name, source_kind, source_role, trust_score,
       published_at, discovered_at, content_hash, metadata)
    VALUES
      (${id}, ${agentId}, ${source.externalId}, ${source.title}, ${source.url},
       ${source.canonicalUrl}, ${source.hostname}, ${source.publisherKey}, ${source.summary},
       ${source.content}, ${source.sourceName}, ${source.sourceKind}, ${source.sourceRole},
       ${source.trustScore}, ${source.publishedAt?.toISOString() ?? null},
       ${source.discoveredAt.toISOString()}, ${contentHash}, ${JSON.stringify(source.metadata)}::jsonb)
    ON CONFLICT (agent_id, canonical_url, content_hash) DO UPDATE SET
      discovered_at = EXCLUDED.discovered_at,
      trust_score = GREATEST(source_items.trust_score, EXCLUDED.trust_score),
      source_role = EXCLUDED.source_role,
      metadata = source_items.metadata || EXCLUDED.metadata
  `;
  return id;
}

export async function saveStoryCluster(input: {
  agentId: string;
  cycleNumber: number;
  cluster: StoryCluster;
  sourceItemIds: string[];
}): Promise<string> {
  const clusterId = stableShortId("story", `${input.agentId}:${input.cycleNumber}:${input.cluster.fingerprint}`);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO story_clusters
       (id, agent_id, cycle_number, fingerprint, title, summary, primary_source_item_id,
        published_at, source_count, independent_source_count, corroboration_score,
        source_diversity_score, evidence_summary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (agent_id, fingerprint, cycle_number) DO UPDATE SET
         source_count = EXCLUDED.source_count,
         independent_source_count = EXCLUDED.independent_source_count,
         corroboration_score = EXCLUDED.corroboration_score,
         source_diversity_score = EXCLUDED.source_diversity_score,
         evidence_summary = EXCLUDED.evidence_summary`,
      [
        clusterId,
        input.agentId,
        input.cycleNumber,
        input.cluster.fingerprint,
        input.cluster.title,
        input.cluster.summary,
        input.sourceItemIds[0],
        input.cluster.publishedAt?.toISOString() ?? null,
        input.sourceItemIds.length,
        input.cluster.independentSourceCount,
        input.cluster.corroborationScore,
        input.cluster.sourceDiversityScore,
        input.cluster.evidenceSummary,
      ],
    );
    for (let index = 0; index < input.sourceItemIds.length; index += 1) {
      const source = input.cluster.sources[index]!;
      await client.query(
        `INSERT INTO story_cluster_sources (cluster_id, source_item_id, source_role, source_rank)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (cluster_id, source_item_id) DO UPDATE SET
           source_role = EXCLUDED.source_role, source_rank = EXCLUDED.source_rank`,
        [clusterId, input.sourceItemIds[index], source.sourceRole, index],
      );
    }
  });
  return clusterId;
}

export async function saveCandidate(
  agentId: string,
  cycleNumber: number,
  clusterId: string,
  sourceItemIds: string[],
  cluster: StoryCluster,
  scores: CandidateScores,
): Promise<EditorialCandidate> {
  const fingerprint = cluster.fingerprint;
  const id = stableShortId("cand", `${agentId}:${cycleNumber}:${fingerprint}`);
  const sourceUrls = cluster.sources.map((source) => source.canonicalUrl);
  await db()`
    INSERT INTO topic_candidates
      (id, agent_id, source_item_id, cluster_id, evidence_source_item_ids, source_urls,
       cycle_number, title, summary, canonical_url, fingerprint, deterministic_scores,
       independent_source_count, corroboration_score, evidence_summary, status)
    VALUES
      (${id}, ${agentId}, ${sourceItemIds[0]}, ${clusterId}, ${sourceItemIds}, ${sourceUrls},
       ${cycleNumber}, ${cluster.title}, ${cluster.summary}, ${cluster.primarySource.canonicalUrl},
       ${fingerprint}, ${JSON.stringify(scores)}::jsonb, ${cluster.independentSourceCount},
       ${cluster.corroborationScore}, ${cluster.evidenceSummary}, 'DISCOVERED')
    ON CONFLICT (agent_id, fingerprint, cycle_number) DO UPDATE SET
      evidence_source_item_ids = EXCLUDED.evidence_source_item_ids,
      source_urls = EXCLUDED.source_urls,
      deterministic_scores = EXCLUDED.deterministic_scores,
      independent_source_count = EXCLUDED.independent_source_count,
      corroboration_score = EXCLUDED.corroboration_score,
      evidence_summary = EXCLUDED.evidence_summary
  `;
  return {
    id,
    clusterId,
    sourceItemId: sourceItemIds[0]!,
    evidenceSourceItemIds: sourceItemIds,
    sourceUrls,
    title: cluster.title,
    summary: cluster.summary,
    canonicalUrl: cluster.primarySource.canonicalUrl,
    sourceName: cluster.primarySource.sourceName,
    sourceKind: cluster.primarySource.sourceKind,
    publishedAt: cluster.publishedAt,
    trustScore: cluster.primarySource.trustScore,
    independentSourceCount: cluster.independentSourceCount,
    corroborationScore: cluster.corroborationScore,
    evidenceSummary: cluster.evidenceSummary,
    fingerprint,
    scores,
  };
}

export interface PublishedCanonicalContext {
  postId: string;
  postText: string;
  postCreatedAt: Date;
  sourceItemId: string;
  sourceTitle: string;
  sourceSummary: string;
  contentHash: string;
}

export async function getPublishedCanonicalContext(
  agentId: string,
  canonicalUrl: string,
): Promise<PublishedCanonicalContext | null> {
  const rows = (await db()`
    SELECT p.id AS post_id, p.text AS post_text, p.created_at AS post_created_at,
           s.id AS source_item_id, s.title AS source_title, s.summary AS source_summary,
           s.content_hash
    FROM post_sources ps
    JOIN posts p ON p.id = ps.post_id
    JOIN source_items s ON s.id = ps.source_item_id
    WHERE p.agent_id = ${agentId} AND ps.source_url = ${canonicalUrl}
    ORDER BY p.created_at DESC LIMIT 1
  `) as unknown as Array<{
    post_id: string;
    post_text: string;
    post_created_at: string | Date;
    source_item_id: string;
    source_title: string;
    source_summary: string;
    content_hash: string;
  }>;
  const row = rows[0];
  return row ? {
    postId: row.post_id,
    postText: row.post_text,
    postCreatedAt: new Date(row.post_created_at),
    sourceItemId: row.source_item_id,
    sourceTitle: row.source_title,
    sourceSummary: row.source_summary,
    contentHash: row.content_hash,
  } : null;
}

export async function getRecentPosts(agentId: string, limit = 20): Promise<RecentPostMemory[]> {
  const rows = (await db()`
    SELECT id, text, rationale, created_at, narrative_title
    FROM posts WHERE agent_id = ${agentId}
    ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `) as unknown as Array<{
    id: string; text: string; rationale: string; created_at: string | Date; narrative_title: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    rationale: row.rationale,
    createdAt: new Date(row.created_at),
    narrativeTitle: row.narrative_title,
  }));
}

export async function getRecentRejections(agentId: string, limit = 20) {
  return (await db()`
    SELECT c.title, d.reason, d.created_at
    FROM editorial_decisions d
    JOIN topic_candidates c ON c.id = d.candidate_id
    WHERE d.agent_id = ${agentId} AND d.decision IN ('REJECT', 'DUPLICATE')
    ORDER BY d.created_at DESC LIMIT ${limit}
  `) as unknown as Array<{ title: string; reason: string; created_at: string | Date }>;
}

export async function getNarratives(agentId: string, limit = 10) {
  return (await db()`
    SELECT id, title, current_position, open_questions, related_post_ids, last_updated_at
    FROM narrative_threads WHERE agent_id = ${agentId}
    ORDER BY last_updated_at DESC LIMIT ${limit}
  `) as unknown as Array<Record<string, unknown>>;
}

export async function saveDecision(
  agentId: string,
  cycleNumber: number,
  decision: EditorialDecision,
): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO editorial_decisions
       (agent_id, candidate_id, cycle_number, decision, reason, why_now,
        comparison, confidence, scores)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (candidate_id) DO UPDATE SET
         decision = EXCLUDED.decision,
         reason = EXCLUDED.reason,
         why_now = EXCLUDED.why_now,
         comparison = EXCLUDED.comparison,
         confidence = EXCLUDED.confidence,
         scores = EXCLUDED.scores`,
      [agentId, decision.candidateId, cycleNumber, decision.decision, decision.reason,
        decision.whyNow, decision.comparison, decision.confidence, JSON.stringify(decision.scores)],
    );
    await client.query(`UPDATE topic_candidates SET status = $1 WHERE id = $2`, [decision.decision, decision.candidateId]);
    if (["REJECT", "DUPLICATE", "HOLD"].includes(decision.decision)) {
      await client.query(
        `INSERT INTO memories
         (agent_id, memory_type, reference_id, summary, fingerprint, metadata)
         VALUES ($1,'REJECTED',$2,$3,$4,$5::jsonb)
         ON CONFLICT (agent_id, memory_type, reference_id) DO UPDATE SET
           summary = EXCLUDED.summary, fingerprint = EXCLUDED.fingerprint, metadata = EXCLUDED.metadata`,
        [agentId, decision.candidateId, decision.reason,
          sha256(`${decision.candidateId}:${decision.reason}`),
          JSON.stringify({ decision: decision.decision, scores: decision.scores })],
      );
    }
  });
}

export async function getEvidenceSources(sourceItemIds: string[]): Promise<EvidenceSourceRecord[]> {
  if (sourceItemIds.length === 0) return [];
  return (await db()`
    SELECT id, title, canonical_url, summary, content, source_name, source_kind,
           source_role, trust_score, published_at, metadata
    FROM source_items
    WHERE id = ANY(${sourceItemIds}::text[])
    ORDER BY CASE source_role WHEN 'PRIMARY' THEN 0 WHEN 'CORROBORATING' THEN 1 ELSE 2 END,
             trust_score DESC
  `) as unknown as EvidenceSourceRecord[];
}

export async function countPostsLastDay(agentId: string): Promise<number> {
  const rows = (await db()`
    SELECT COUNT(*)::int AS count FROM posts
    WHERE agent_id = ${agentId} AND created_at >= NOW() - INTERVAL '24 hours'
  `) as unknown as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

export async function findSemanticDuplicate(
  agentId: string,
  embedding: number[] | null,
  threshold = 0.86,
): Promise<{ id: string; similarity: number } | null> {
  if (!embedding?.length) return null;
  const vector = `[${embedding.join(",")}]`;
  const rows = (await db()`
    SELECT reference_id AS id, 1 - (embedding <=> ${vector}::vector) AS similarity
    FROM memories
    WHERE agent_id = ${agentId} AND memory_type = 'PUBLISHED' AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vector}::vector LIMIT 1
  `) as unknown as Array<{ id: string; similarity: number }>;
  const row = rows[0];
  return row && Number(row.similarity) >= threshold
    ? { id: row.id, similarity: Number(row.similarity) }
    : null;
}

export async function saveAiAudits(agentId: string, runId: string, audits: AiAudit[]): Promise<void> {
  if (audits.length === 0) return;
  await withTransaction(async (client) => {
    for (const audit of audits) {
      await client.query(
        `INSERT INTO ai_audit_events
         (agent_id, run_id, purpose, model, fallback_index, latency_ms, usage, success, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
        [agentId, runId, audit.purpose, audit.model, audit.fallbackIndex, audit.latencyMs,
          JSON.stringify(audit.usage), audit.success, audit.error ?? null],
      );
    }
  });
}

export async function recordSourceHealth(agentId: string, sourceHealth: Array<{
  adapter: string; status: "ok" | "failed"; itemCount: number; latencyMs: number; error?: string;
}>): Promise<void> {
  await withTransaction(async (client) => {
    for (const item of sourceHealth) {
      await client.query(
        `INSERT INTO source_reliability
         (agent_id, source_key, successes, failures, items_discovered, total_latency_ms, last_error)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (agent_id, source_key) DO UPDATE SET
           successes = source_reliability.successes + EXCLUDED.successes,
           failures = source_reliability.failures + EXCLUDED.failures,
           items_discovered = source_reliability.items_discovered + EXCLUDED.items_discovered,
           total_latency_ms = source_reliability.total_latency_ms + EXCLUDED.total_latency_ms,
           last_error = EXCLUDED.last_error,
           last_checked_at = NOW()`,
        [agentId, item.adapter, item.status === "ok" ? 1 : 0, item.status === "failed" ? 1 : 0,
          item.itemCount, item.latencyMs, item.error ?? null],
      );
    }
  });
}

export async function publishPost(input: {
  agentId: string;
  cycleNumber: number;
  runId: string;
  candidate: EditorialCandidate;
  sources: EvidenceSourceRecord[];
  draft: DraftPost;
  verification: VerificationResult;
  qualityGate: QualityGateResult;
  embedding: number[] | null;
}): Promise<string> {
  const postId = createId("p");
  const fingerprint = sha256(input.draft.text.toLowerCase().replace(/\s+/g, " "));
  const narrativeId = stableShortId("narr", `${input.agentId}:${input.draft.narrativeTitle.toLowerCase()}`);
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO posts
       (id, agent_id, candidate_id, story_cluster_id, text, rationale, persona_version,
        narrative_title, narrative_position, tags, fingerprint, verification, quality_score,
        source_independence, editorial_angle, uncertainties, quality_gate)
       VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8,$9::text[],$10,$11::jsonb,$12,$13,$14,$15::text[],$16::jsonb)`,
      [postId, input.agentId, input.candidate.id, input.candidate.clusterId, input.draft.text,
        input.draft.rationale, input.draft.narrativeTitle, input.draft.narrativePosition,
        input.draft.tags, fingerprint, JSON.stringify(input.verification), input.qualityGate.score,
        input.candidate.independentSourceCount, input.draft.editorialAngle, input.draft.uncertainties,
        JSON.stringify(input.qualityGate)],
    );
    for (const source of input.sources) {
      await client.query(
        `INSERT INTO post_sources (post_id, source_item_id, source_url, source_name, is_primary)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (post_id, source_item_id) DO NOTHING`,
        [postId, source.id, source.canonical_url, source.source_name, source.source_role === "PRIMARY"],
      );
    }
    for (const claim of input.draft.claims) {
      await client.query(
        `INSERT INTO claim_evidence (post_id, claim_text, source_urls, confidence)
         VALUES ($1,$2,$3::text[],$4)`,
        [postId, claim.claim, claim.sourceUrls, claim.confidence],
      );
    }
    await client.query(
      `INSERT INTO memories
       (agent_id, memory_type, reference_id, summary, fingerprint, embedding, metadata)
       VALUES ($1,'PUBLISHED',$2,$3,$4,$5::vector,$6::jsonb)`,
      [input.agentId, postId, `${input.draft.narrativeTitle}: ${input.draft.narrativePosition}`,
        fingerprint, input.embedding?.length ? `[${input.embedding.join(",")}]` : null,
        JSON.stringify({ tags: input.draft.tags, candidateId: input.candidate.id, qualityScore: input.qualityGate.score })],
    );
    await client.query(
      `INSERT INTO narrative_threads
       (id, agent_id, title, current_position, open_questions, related_post_ids)
       VALUES ($1,$2,$3,$4,$5::text[],ARRAY[$6]::text[])
       ON CONFLICT (agent_id, title) DO UPDATE SET
         current_position = EXCLUDED.current_position,
         open_questions = EXCLUDED.open_questions,
         related_post_ids = CASE WHEN $6 = ANY(narrative_threads.related_post_ids)
           THEN narrative_threads.related_post_ids ELSE array_append(narrative_threads.related_post_ids, $6) END,
         last_updated_at = NOW()`,
      [narrativeId, input.agentId, input.draft.narrativeTitle, input.draft.narrativePosition,
        input.draft.uncertainties, postId],
    );
    await client.query(
      `UPDATE agent_runs
       SET status = 'PUBLISHED', completed_at = NOW(), published_post_id = $1,
           quality_score = $2,
           reason = 'A corroborated story passed editorial, memory, evidence, persona, and deterministic quality gates.'
       WHERE id = $3`,
      [postId, input.qualityGate.score, input.runId],
    );
    await client.query(
      `UPDATE agents
       SET last_post_at = NOW(), last_cycle_at = NOW(), published_count = published_count + 1,
           completed_cycles = GREATEST(completed_cycles, $1 + 1), updated_at = NOW()
       WHERE id = $2`,
      [input.cycleNumber, input.agentId],
    );
    await appendAutonomyEventWithClient(client, input.agentId, "POST_PUBLISHED", `post:${postId}`, {
      postId,
      cycleNumber: input.cycleNumber,
      candidateId: input.candidate.id,
      storyClusterId: input.candidate.clusterId,
      qualityScore: input.qualityGate.score,
      independentSources: input.candidate.independentSourceCount,
      sourceUrls: input.sources.map((source) => source.canonical_url),
    });
    await appendAutonomyEventWithClient(
      client,
      input.agentId,
      "CYCLE_COMPLETED",
      `cycle:${input.cycleNumber}:completed`,
      {
        cycleNumber: input.cycleNumber,
        status: "PUBLISHED",
        postId,
        qualityScore: input.qualityGate.score,
      },
    );
  });
  return postId;
}

export async function finishCycle(input: {
  agentId: string;
  runId: string;
  cycleNumber: number;
  status: "SKIPPED" | "FAILED";
  discovered: number;
  clustered: number;
  rejected: number;
  held: number;
  reason: string;
  qualityScore?: number | null;
  error?: string;
  sourceHealth?: unknown;
  nextCycleAt?: Date | null;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE agent_runs
       SET status = $1, completed_at = NOW(), discovered_count = $2, clustered_count = $3,
           rejected_count = $4, held_count = $5, reason = $6, quality_score = $7,
           error = $8, metrics = $9::jsonb
       WHERE id = $10`,
      [input.status, input.discovered, input.clustered, input.rejected, input.held, input.reason,
        input.qualityScore ?? null, input.error ?? null,
        JSON.stringify({ sourceHealth: input.sourceHealth ?? [] }), input.runId],
    );
    await client.query(
      `UPDATE agents
       SET last_cycle_at = NOW(), next_cycle_at = $1,
           completed_cycles = GREATEST(completed_cycles, $2 + 1), updated_at = NOW()
       WHERE id = $3`,
      [input.nextCycleAt?.toISOString() ?? null, input.cycleNumber, input.agentId],
    );
    await appendAutonomyEventWithClient(
      client,
      input.agentId,
      "CYCLE_COMPLETED",
      `cycle:${input.cycleNumber}:completed`,
      {
        cycleNumber: input.cycleNumber,
        status: input.status,
        discovered: input.discovered,
        clustered: input.clustered,
        rejected: input.rejected,
        held: input.held,
        qualityScore: input.qualityScore ?? null,
        nextCycleAt: input.nextCycleAt?.toISOString() ?? null,
      },
    );
  });
}

export async function saveReflection(input: {
  agentId: string;
  runId: string;
  summary: string;
  priorities: string[];
  sourceNotes: unknown;
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO reflections (agent_id, run_id, summary, priorities, source_notes)
       VALUES ($1,$2,$3,$4::text[],$5::jsonb)
       ON CONFLICT (run_id) DO UPDATE SET
         summary = EXCLUDED.summary, priorities = EXCLUDED.priorities, source_notes = EXCLUDED.source_notes`,
      [input.agentId, input.runId, input.summary, input.priorities, JSON.stringify(input.sourceNotes)],
    );
    await client.query(
      `INSERT INTO memories
       (agent_id, memory_type, reference_id, summary, fingerprint, metadata)
       VALUES ($1,'REFLECTION',$2,$3,$4,$5::jsonb)
       ON CONFLICT (agent_id, memory_type, reference_id) DO UPDATE SET
         summary = EXCLUDED.summary, fingerprint = EXCLUDED.fingerprint, metadata = EXCLUDED.metadata`,
      [input.agentId, input.runId, input.summary, sha256(`${input.runId}:${input.summary}`),
        JSON.stringify({ priorities: input.priorities })],
    );
  });
}

export async function setNextCycleAt(agentId: string, nextCycleAt: Date | null): Promise<void> {
  await db()`UPDATE agents SET next_cycle_at = ${nextCycleAt?.toISOString() ?? null}, updated_at = NOW() WHERE id = ${agentId}`;
}

export async function markAgentCompleted(agentId: string): Promise<void> {
  await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE agents SET status = 'COMPLETED', next_cycle_at = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'ACTIVE' RETURNING id`,
      [agentId],
    );
    if (result.rows.length > 0) {
      await appendAutonomyEventWithClient(client, agentId, "AGENT_COMPLETED", "completed", {});
    }
  });
}

export async function getFeed(agentId: string): Promise<FeedPost[] | null> {
  const agents = (await db()`SELECT 1 FROM agents WHERE id = ${agentId}`) as unknown as unknown[];
  if (agents.length === 0) return null;
  const rows = (await db()`
    SELECT p.id, p.created_at, p.text, p.rationale,
           COALESCE(array_agg(DISTINCT ps.source_url ORDER BY ps.source_url)
                    FILTER (WHERE ps.source_url IS NOT NULL), ARRAY[]::text[]) AS sources
    FROM posts p
    LEFT JOIN post_sources ps ON ps.post_id = p.id
    WHERE p.agent_id = ${agentId}
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
  `) as unknown as Array<{
    id: string; created_at: string | Date; text: string; rationale: string; sources: string[];
  }>;
  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    text: row.text,
    rationale: row.rationale,
    sources: row.sources,
  }));
}

export async function verifyAutonomyLedger(agentId: string): Promise<{
  valid: boolean;
  eventCount: number;
  headHash: string | null;
  latestEventType: string | null;
}> {
  const rows = (await db()`
    SELECT event_type, occurred_at, payload, previous_hash, event_hash
    FROM autonomy_events WHERE agent_id = ${agentId}
    ORDER BY sequence ASC
  `) as unknown as Array<{
    event_type: string;
    occurred_at: string | Date;
    payload: Record<string, unknown> | string;
    previous_hash: string;
    event_hash: string;
  }>;
  let previousHash = "GENESIS";
  let valid = true;
  for (const row of rows) {
    const payload = safeJsonParse(row.payload, {} as Record<string, unknown>);
    const occurredAt = new Date(row.occurred_at).toISOString();
    const expected = computeAutonomyEventHash({
      previousHash,
      eventType: row.event_type,
      occurredAt,
      payload,
    });
    if (row.previous_hash !== previousHash || row.event_hash !== expected) valid = false;
    previousHash = row.event_hash;
  }
  return {
    valid,
    eventCount: rows.length,
    headHash: rows.at(-1)?.event_hash ?? null,
    latestEventType: rows.at(-1)?.event_type ?? null,
  };
}

export async function getDashboard(agentId: string) {
  const context = await getAgentContext(agentId);
  if (!context) return null;
  const [feed, posts, runs, decisions, narratives, clusters, audits, sourceReliability, totals, ledger, autonomyEvents] = await Promise.all([
    getFeed(agentId),
    db()`
      SELECT p.id, p.created_at, p.quality_score, p.source_independence, p.editorial_angle,
             p.uncertainties, p.tags, p.narrative_title
      FROM posts p WHERE p.agent_id = ${agentId}
      ORDER BY p.created_at DESC LIMIT 20
    `,
    db()`
      SELECT id, cycle_number, status, started_at, completed_at, discovered_count,
             clustered_count, rejected_count, held_count, published_post_id,
             quality_score, reason, error, metrics
      FROM agent_runs WHERE agent_id = ${agentId}
      ORDER BY cycle_number DESC LIMIT 30
    `,
    db()`
      SELECT d.decision, d.reason, d.why_now, d.comparison, d.confidence,
             d.scores, d.created_at, c.title, c.canonical_url,
             c.independent_source_count, c.corroboration_score, c.evidence_summary
      FROM editorial_decisions d
      JOIN topic_candidates c ON c.id = d.candidate_id
      WHERE d.agent_id = ${agentId}
      ORDER BY d.created_at DESC LIMIT 40
    `,
    getNarratives(agentId, 12),
    db()`
      SELECT id, title, source_count, independent_source_count, corroboration_score,
             source_diversity_score, evidence_summary, published_at, created_at
      FROM story_clusters WHERE agent_id = ${agentId}
      ORDER BY cycle_number DESC, corroboration_score DESC LIMIT 24
    `,
    db()`
      SELECT purpose, model, fallback_index, latency_ms, usage, success, error, created_at
      FROM ai_audit_events WHERE agent_id = ${agentId}
      ORDER BY created_at DESC LIMIT 30
    `,
    db()`
      SELECT source_key, successes, failures, items_discovered, total_latency_ms,
             last_error, last_checked_at
      FROM source_reliability WHERE agent_id = ${agentId}
      ORDER BY source_key
    `,
    db()`
      SELECT
        COUNT(*)::int AS decisions,
        COUNT(*) FILTER (WHERE decision IN ('REJECT','DUPLICATE'))::int AS rejected,
        COUNT(*) FILTER (WHERE decision = 'HOLD')::int AS held,
        COUNT(*) FILTER (WHERE decision = 'PUBLISH')::int AS publish_decisions
      FROM editorial_decisions WHERE agent_id = ${agentId}
    `,
    verifyAutonomyLedger(agentId),
    db()`
      SELECT sequence, event_type, occurred_at, payload, event_hash
      FROM autonomy_events WHERE agent_id = ${agentId}
      ORDER BY sequence DESC LIMIT 20
    `,
  ]);
  return {
    agent: context.agent,
    persona: context.persona,
    posts: feed ?? [],
    postInsights: posts,
    runs,
    decisions,
    narratives,
    clusters,
    audits,
    sourceReliability,
    totals: (totals as unknown as Array<Record<string, unknown>>)[0] ?? {},
    ledger,
    autonomyEvents,
  };
}

export async function updatePublishedRunMetrics(input: {
  runId: string;
  discovered: number;
  clustered: number;
  rejected: number;
  held: number;
  qualityScore: number;
  sourceHealth: unknown;
}): Promise<void> {
  await db()`
    UPDATE agent_runs
    SET discovered_count = ${input.discovered}, clustered_count = ${input.clustered},
        rejected_count = ${input.rejected}, held_count = ${input.held},
        quality_score = ${input.qualityScore},
        metrics = ${JSON.stringify({ sourceHealth: input.sourceHealth })}::jsonb
    WHERE id = ${input.runId}
  `;
}
