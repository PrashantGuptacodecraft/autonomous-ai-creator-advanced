import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { getDashboard } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

function dateLabel(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function safeHost(value: string): string {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

function percent(value: number): string {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function numberFrom(row: Record<string, unknown>, key: string): number {
  const value = Number(row[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export default async function AgentDashboardPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}): Promise<React.ReactElement> {
  const { agentId } = await params;
  const dashboard = await getDashboard(agentId);
  if (!dashboard) return notFound();

  const {
    agent,
    persona,
    posts,
    postInsights,
    runs,
    decisions,
    narratives,
    clusters,
    audits,
    sourceReliability,
    totals,
    ledger,
    autonomyEvents,
  } = dashboard;
  const decisionRows = decisions as Array<Record<string, unknown>>;
  const runRows = runs as Array<Record<string, unknown>>;
  const insightRows = postInsights as Array<Record<string, unknown>>;
  const clusterRows = clusters as Array<Record<string, unknown>>;
  const auditRows = audits as Array<Record<string, unknown>>;
  const sourceRows = sourceReliability as Array<Record<string, unknown>>;
  const eventRows = autonomyEvents as Array<Record<string, unknown>>;
  const totalRow = totals as Record<string, unknown>;

  const decisionCount = numberFrom(totalRow, "decisions");
  const rejected = numberFrom(totalRow, "rejected");
  const selectivity = decisionCount > 0 ? rejected / decisionCount * 100 : 0;
  const averageQuality = insightRows.length
    ? insightRows.reduce((sum, item) => sum + numberFrom(item, "quality_score"), 0) / insightRows.length
    : 0;
  const averageIndependence = insightRows.length
    ? insightRows.reduce((sum, item) => sum + numberFrom(item, "source_independence"), 0) / insightRows.length
    : 0;
  const successfulAiCalls = auditRows.filter((item) => Boolean(item.success)).length;
  const aiReliability = auditRows.length ? successfulAiCalls / auditRows.length * 100 : 100;
  const sourceChecks = sourceRows.reduce((sum, item) => sum + numberFrom(item, "successes") + numberFrom(item, "failures"), 0);
  const sourceSuccesses = sourceRows.reduce((sum, item) => sum + numberFrom(item, "successes"), 0);
  const sourceReliabilityRate = sourceChecks ? sourceSuccesses / sourceChecks * 100 : 100;

  return (
    <main className="dashboard-shell shell">
      <AutoRefresh intervalMs={15_000} />
      <header className="dashboard-header">
        <a className="brand" href="/"><span className="brand-mark">SF</span><span>SignalFoundry</span></a>
        <div className="header-actions">
          <a className="ghost-link" href={`/api/agent/status?agentId=${encodeURIComponent(agentId)}`}>Status API</a>
          <a className="primary-link" href={`/api/agent/feed?agentId=${encodeURIComponent(agentId)}`}>Evaluator feed ↗</a>
          <span className={`status status-${String(agent.status).toLowerCase()}`}><i /> {String(agent.status)}</span>
        </div>
      </header>

      <section className="persona-banner premium-banner">
        <div className="persona-copy">
          <p className="eyebrow">AUTONOMOUS PERSONA / LIVE CONTROL ROOM</p>
          <h1>{String(agent.name)}</h1>
          <p>{persona.identity}</p>
          <div className="interest-row">
            {persona.interests.slice(0, 4).map((interest) => <span key={interest}>{interest}</span>)}
          </div>
        </div>
        <div className="agent-orbit" aria-label="Autonomous workflow active">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="orbit-core"><span>LIVE</span><strong>{Number(agent.completed_cycles)}</strong><small>cycles</small></div>
        </div>
        <div className="persona-meta">
          <span>Domain<strong>{String(agent.domain)}</strong></span>
          <span>Workflow run<strong>{String(agent.workflow_run_id ?? "Registering")}</strong></span>
          <span>Observation window<strong>Ends {dateLabel(agent.evaluation_ends_at)}</strong></span>
        </div>
      </section>

      <section className="metric-grid metric-grid-six">
        <article><span>Published</span><strong>{Number(agent.published_count)}</strong><small>Immutable feed entries</small></article>
        <article><span>Editorial restraint</span><strong>{percent(selectivity)}</strong><small>{rejected} rejected of {decisionCount}</small></article>
        <article><span>Average quality</span><strong>{averageQuality ? averageQuality.toFixed(0) : "—"}</strong><small>Deterministic gate / 100</small></article>
        <article><span>Evidence depth</span><strong>{averageIndependence ? averageIndependence.toFixed(1) : "—"}</strong><small>Independent sources / post</small></article>
        <article><span>Model reliability</span><strong>{percent(aiReliability)}</strong><small>Fallback-audited calls</small></article>
        <article><span>Next research</span><strong className="metric-date">{dateLabel(agent.next_cycle_at)}</strong><small>Independent of feed reads</small></article>
      </section>

      <section className="dashboard-grid dashboard-grid-premium">
        <div className="panel feed-panel">
          <div className="panel-title">
            <div><p className="eyebrow">PUBLIC OUTPUT</p><h2>Autonomous editorial feed</h2></div>
            <span>{posts.length} published · newest first</span>
          </div>
          {posts.length === 0 ? (
            <div className="empty-state">
              <div className="pulse-orbit"><i /></div>
              <h3>The agent is gathering evidence.</h3>
              <p>The first post is not pre-generated. A new entry appears only after a live story clears discovery, editorial, memory, evidence, persona, and quality gates.</p>
              <div className="empty-pipeline"><span>Sources</span><b>→</b><span>Clusters</span><b>→</b><span>Decision</span><b>→</b><span>Post</span></div>
            </div>
          ) : (
            <div className="post-list">
              {posts.map((post, index) => {
                const insight = insightRows.find((item) => String(item.id) === post.id);
                return (
                  <article className="post-card premium-post" key={post.id}>
                    <div className="post-meta"><span>POST {String(posts.length - index).padStart(2, "0")} · {post.id}</span><time>{dateLabel(post.createdAt)}</time></div>
                    <p className="post-text">{post.text}</p>
                    <div className="post-proof-row">
                      <span>Quality <strong>{insight ? numberFrom(insight, "quality_score").toFixed(0) : "—"}/100</strong></span>
                      <span>Independent sources <strong>{insight ? numberFrom(insight, "source_independence") : post.sources.length}</strong></span>
                      <span>Thread <strong>{String(insight?.narrative_title ?? "New narrative")}</strong></span>
                    </div>
                    <details>
                      <summary>Open publication rationale and evidence</summary>
                      <p>{post.rationale}</p>
                      {insight?.editorial_angle ? <blockquote>{String(insight.editorial_angle)}</blockquote> : null}
                      <div className="source-links">
                        {post.sources.map((source, sourceIndex) => (
                          <a href={source} key={source} rel="noreferrer" target="_blank">
                            <span>{sourceIndex === 0 ? "Primary" : "Evidence"}</span>{safeHost(source)} ↗
                          </a>
                        ))}
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="side-stack">
          <section className="panel pulse-panel">
            <div className="panel-title"><div><p className="eyebrow">SYSTEM PULSE</p><h2>Trust signals</h2></div><span>Auto-refresh 15s</span></div>
            <div className="trust-meter"><div><span style={{ width: `${sourceReliabilityRate}%` }} /></div><p><strong>{percent(sourceReliabilityRate)}</strong> live-source reliability</p></div>
            <div className="trust-meter"><div><span style={{ width: `${aiReliability}%` }} /></div><p><strong>{percent(aiReliability)}</strong> model-call reliability</p></div>
            <div className="trust-list">
              <span><i className={ledger.valid ? "ok" : "fail"} />Autonomy ledger {ledger.valid ? `verified · ${ledger.eventCount} events` : "integrity check failed"}</span>
              <span><i className="ok" />Feed endpoint has no generation side effects</span>
              <span><i className="ok" />Publications commit atomically</span>
              <span><i className="ok" />External content treated as untrusted evidence</span>
              <span><i className="ok" />Duplicate and persona-drift gates enabled</span>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><div><p className="eyebrow">DURABLE EXECUTION</p><h2>Cycle timeline</h2></div></div>
            <div className="timeline">
              {runRows.slice(0, 8).map((run) => (
                <div className="timeline-row" key={String(run.id)}>
                  <i className={`dot dot-${String(run.status).toLowerCase()}`} />
                  <div>
                    <strong>Cycle {Number(run.cycle_number) + 1} · {String(run.status)}</strong>
                    <p>{Number(run.discovered_count ?? 0)} discovered · {Number(run.clustered_count ?? 0)} stories · {Number(run.rejected_count ?? 0)} rejected</p>
                    <small>{String(run.reason || "Research in progress")}</small>
                  </div>
                  <time>{dateLabel(run.completed_at ?? run.started_at)}</time>
                </div>
              ))}
              {runRows.length === 0 ? <p className="muted">Workflow registered. The first durable research window is scheduled.</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title"><div><p className="eyebrow">MODEL ROUTING</p><h2>Fallback audit</h2></div></div>
            <div className="audit-list">
              {auditRows.slice(0, 7).map((audit, index) => (
                <div key={`${String(audit.created_at)}-${index}`}>
                  <i className={audit.success ? "ok" : "fail"} />
                  <span><strong>{String(audit.purpose)}</strong><small>{String(audit.model)} · {Number(audit.latency_ms)}ms</small></span>
                  <em>{Number(audit.fallback_index) === 0 ? "primary" : `fallback ${Number(audit.fallback_index)}`}</em>
                </div>
              ))}
              {auditRows.length === 0 ? <p className="muted">Model audit events appear after the first AI-assisted cycle.</p> : null}
            </div>
          </section>

          <section className="panel ledger-panel">
            <div className="panel-title"><div><p className="eyebrow">AUTONOMY PROOF</p><h2>Tamper-evident ledger</h2></div><span>{ledger.valid ? "Verified" : "Warning"}</span></div>
            <div className="ledger-head">
              <span>Chain head</span>
              <code>{ledger.headHash ? `${ledger.headHash.slice(0, 14)}…${ledger.headHash.slice(-8)}` : "Awaiting first event"}</code>
            </div>
            <div className="event-list">
              {eventRows.slice(0, 6).map((event) => (
                <div key={String(event.sequence)}>
                  <span>{String(event.sequence).padStart(3, "0")}</span>
                  <div><strong>{String(event.event_type).replaceAll("_", " ")}</strong><small>{dateLabel(event.occurred_at)}</small></div>
                </div>
              ))}
              {eventRows.length === 0 ? <p className="muted">Lifecycle events will form a hash-linked proof chain.</p> : null}
            </div>
          </section>
        </aside>
      </section>

      <section className="section-pair">
        <section className="panel">
          <div className="panel-title"><div><p className="eyebrow">EVIDENCE INTELLIGENCE</p><h2>Latest story clusters</h2></div><span>{clusterRows.length} inspected</span></div>
          <div className="cluster-grid">
            {clusterRows.slice(0, 8).map((cluster) => (
              <article key={String(cluster.id)}>
                <div className="cluster-score"><strong>{Math.round(numberFrom(cluster, "corroboration_score"))}</strong><span>corroboration</span></div>
                <div><h3>{String(cluster.title)}</h3><p>{String(cluster.evidence_summary)}</p>
                  <div className="cluster-meta"><span>{Number(cluster.source_count)} sources</span><span>{Number(cluster.independent_source_count)} independent</span><span>{dateLabel(cluster.published_at)}</span></div>
                </div>
              </article>
            ))}
            {clusterRows.length === 0 ? <p className="muted">Related live sources will be grouped into auditable story clusters.</p> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title"><div><p className="eyebrow">LONG-TERM MEMORY</p><h2>Narrative positions</h2></div></div>
          <div className="narratives expanded-narratives">
            {(narratives as Array<Record<string, unknown>>).map((thread) => (
              <article key={String(thread.id)}><span>{Array.isArray(thread.related_post_ids) ? thread.related_post_ids.length : 0} posts</span><h3>{String(thread.title)}</h3><p>{String(thread.current_position)}</p></article>
            ))}
            {narratives.length === 0 ? <p className="muted">Narrative memory forms after the first publication and evolves only when evidence changes.</p> : null}
          </div>
        </section>
      </section>

      <section className="panel decision-panel">
        <div className="panel-title"><div><p className="eyebrow">TRANSPARENT JUDGMENT</p><h2>Editorial decision ledger</h2></div><span>Why one story beat another</span></div>
        <div className="decision-table">
          {decisionRows.map((decision, index) => {
            const scores = (decision.scores && typeof decision.scores === "object" ? decision.scores : {}) as Record<string, unknown>;
            return (
              <article key={`${String(decision.canonical_url)}-${index}`}>
                <span className={`decision decision-${String(decision.decision).toLowerCase()}`}>{String(decision.decision)}</span>
                <div><h3>{String(decision.title)}</h3><p>{String(decision.reason)}</p><small>{String(decision.comparison || decision.why_now || "")}</small></div>
                <div className="decision-score"><strong>{Math.round(Number(scores.total ?? 0))}</strong><span>score</span></div>
                <div className="decision-evidence"><strong>{Number(decision.independent_source_count ?? 1)}</strong><span>sources</span></div>
                <div style={{ flexBasis: "100%", fontSize: "0.8rem", color: "var(--muted)", marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <span title="Persona Relevance">PR: {Math.round(Number(scores.personaRelevance ?? 0))}</span>
                  <span title="Evidence Quality">EQ: {Math.round(Number(scores.evidenceQuality ?? 0))}</span>
                  <span title="Practical Impact">PI: {Math.round(Number(scores.practicalImpact ?? 0))}</span>
                  <span title="Novelty">NV: {Math.round(Number(scores.novelty ?? 0))}</span>
                  <span title="Usefulness">AU: {Math.round(Number(scores.audienceUsefulness ?? 0))}</span>
                  <span title="Verifiability">CV: {Math.round(Number(scores.claimVerifiability ?? 0))}</span>
                  {Number(scores.hypePenalty) > 0 && <span title="Hype Penalty" style={{ color: "var(--red)" }}>HYPE: -{Math.round(Number(scores.hypePenalty ?? 0))}</span>}
                </div>
              </article>
            );
          })}
          {decisionRows.length === 0 ? <p className="muted">Candidate decisions appear after the first discovery cycle.</p> : null}
        </div>
      </section>
    </main>
  );
}
