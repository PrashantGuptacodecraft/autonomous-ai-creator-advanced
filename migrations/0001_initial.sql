CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('INITIALIZING', 'ACTIVE', 'COMPLETED', 'FAILED', 'PAUSED')),
  workflow_run_id TEXT,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluation_ends_at TIMESTAMPTZ NOT NULL,
  last_cycle_at TIMESTAMPTZ,
  next_cycle_at TIMESTAMPTZ,
  last_post_at TIMESTAMPTZ,
  completed_cycles INTEGER NOT NULL DEFAULT 0,
  published_count INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS persona_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  constitution JSONB NOT NULL,
  constitution_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, version),
  UNIQUE(agent_id, constitution_hash)
);

CREATE TABLE IF NOT EXISTS source_items (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  trust_score DOUBLE PRECISION NOT NULL,
  published_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, canonical_url, content_hash)
);

CREATE TABLE IF NOT EXISTS topic_candidates (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  source_item_id TEXT NOT NULL REFERENCES source_items(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  deterministic_scores JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'DISCOVERED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, fingerprint, cycle_number)
);

CREATE TABLE IF NOT EXISTS editorial_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES topic_candidates(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('PUBLISH', 'REJECT', 'HOLD', 'MERGE', 'DUPLICATE')),
  reason TEXT NOT NULL,
  why_now TEXT NOT NULL DEFAULT '',
  comparison TEXT NOT NULL DEFAULT '',
  confidence DOUBLE PRECISION NOT NULL,
  scores JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(candidate_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES topic_candidates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  text TEXT NOT NULL,
  rationale TEXT NOT NULL,
  persona_version INTEGER NOT NULL,
  narrative_title TEXT NOT NULL DEFAULT '',
  narrative_position TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  fingerprint TEXT NOT NULL,
  verification JSONB NOT NULL,
  immutable BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(agent_id, candidate_id),
  UNIQUE(agent_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS post_sources (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  source_item_id TEXT NOT NULL REFERENCES source_items(id),
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY(post_id, source_item_id)
);

CREATE TABLE IF NOT EXISTS claim_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  source_urls TEXT[] NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('PUBLISHED', 'REJECTED', 'NARRATIVE', 'REFLECTION', 'SOURCE')),
  reference_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  embedding VECTOR,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, memory_type, reference_id)
);

CREATE TABLE IF NOT EXISTS narrative_threads (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  current_position TEXT NOT NULL,
  open_questions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  related_post_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, title)
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RUNNING', 'PUBLISHED', 'SKIPPED', 'FAILED')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  held_count INTEGER NOT NULL DEFAULT 0,
  published_post_id TEXT REFERENCES posts(id),
  reason TEXT NOT NULL DEFAULT '',
  error TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(agent_id, cycle_number)
);

CREATE TABLE IF NOT EXISTS reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  priorities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  source_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(run_id)
);

CREATE INDEX IF NOT EXISTS idx_posts_agent_created ON posts(agent_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_runs_agent_cycle ON agent_runs(agent_id, cycle_number DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_agent_created ON editorial_decisions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_agent_fingerprint ON topic_candidates(agent_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_sources_agent_published ON source_items(agent_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_agent_type ON memories(agent_id, memory_type, created_at DESC);
