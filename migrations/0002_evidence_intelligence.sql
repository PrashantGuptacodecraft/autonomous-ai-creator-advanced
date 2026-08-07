ALTER TABLE source_items ADD COLUMN IF NOT EXISTS hostname TEXT NOT NULL DEFAULT '';
ALTER TABLE source_items ADD COLUMN IF NOT EXISTS publisher_key TEXT NOT NULL DEFAULT '';
ALTER TABLE source_items ADD COLUMN IF NOT EXISTS source_role TEXT NOT NULL DEFAULT 'PRIMARY';

CREATE TABLE IF NOT EXISTS story_clusters (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  primary_source_item_id TEXT NOT NULL REFERENCES source_items(id),
  published_at TIMESTAMPTZ,
  source_count INTEGER NOT NULL,
  independent_source_count INTEGER NOT NULL,
  corroboration_score DOUBLE PRECISION NOT NULL,
  source_diversity_score DOUBLE PRECISION NOT NULL,
  evidence_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, fingerprint, cycle_number)
);

CREATE TABLE IF NOT EXISTS story_cluster_sources (
  cluster_id TEXT NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
  source_item_id TEXT NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  source_role TEXT NOT NULL,
  source_rank INTEGER NOT NULL,
  PRIMARY KEY(cluster_id, source_item_id)
);

ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS cluster_id TEXT REFERENCES story_clusters(id);
ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS evidence_source_item_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS independent_source_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS corroboration_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE topic_candidates ADD COLUMN IF NOT EXISTS evidence_summary TEXT NOT NULL DEFAULT '';

ALTER TABLE posts ADD COLUMN IF NOT EXISTS story_cluster_id TEXT REFERENCES story_clusters(id);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_independence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS editorial_angle TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS uncertainties TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE posts ADD COLUMN IF NOT EXISTS quality_gate JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS clustered_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS quality_score DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS ai_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  fallback_index INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  usage JSONB NOT NULL DEFAULT '{}'::JSONB,
  success BOOLEAN NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS source_reliability (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  successes INTEGER NOT NULL DEFAULT 0,
  failures INTEGER NOT NULL DEFAULT 0,
  items_discovered INTEGER NOT NULL DEFAULT 0,
  total_latency_ms BIGINT NOT NULL DEFAULT 0,
  last_error TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(agent_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_story_clusters_agent_cycle ON story_clusters(agent_id, cycle_number DESC);
CREATE INDEX IF NOT EXISTS idx_story_cluster_sources_source ON story_cluster_sources(source_item_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_agent_created ON ai_audit_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_source_reliability_agent ON source_reliability(agent_id, last_checked_at DESC);
