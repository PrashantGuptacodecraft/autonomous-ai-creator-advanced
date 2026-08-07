CREATE TABLE IF NOT EXISTS autonomy_events (
  sequence BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'AGENT_INITIALIZED', 'WORKFLOW_ATTACHED', 'CYCLE_STARTED', 'CYCLE_COMPLETED',
    'POST_PUBLISHED', 'AGENT_COMPLETED', 'AGENT_FAILED'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  previous_hash TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  UNIQUE(agent_id, event_hash)
);

CREATE INDEX IF NOT EXISTS idx_autonomy_events_agent_sequence
  ON autonomy_events(agent_id, sequence ASC);
