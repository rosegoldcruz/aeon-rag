CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS aeon_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  tool_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'success', 'error')),
  input jsonb,
  output_summary text,
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aeon_tool_calls_created_at ON aeon_tool_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aeon_tool_calls_tool_name ON aeon_tool_calls (tool_name);
CREATE INDEX IF NOT EXISTS idx_aeon_tool_calls_status ON aeon_tool_calls (status);

CREATE TABLE IF NOT EXISTS aeon_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  scope text NOT NULL DEFAULT 'global',
  title text NOT NULL,
  content text NOT NULL,
  importance int NOT NULL DEFAULT 3,
  confidence numeric NOT NULL DEFAULT 0.8,
  source text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_aeon_memories_type ON aeon_memories (type);
CREATE INDEX IF NOT EXISTS idx_aeon_memories_scope ON aeon_memories (scope);
CREATE INDEX IF NOT EXISTS idx_aeon_memories_updated_at ON aeon_memories (updated_at DESC);

CREATE TABLE IF NOT EXISTS aeon_memory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid REFERENCES aeon_memories(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aeon_memory_events_memory_id ON aeon_memory_events (memory_id);
CREATE INDEX IF NOT EXISTS idx_aeon_memory_events_created_at ON aeon_memory_events (created_at DESC);
