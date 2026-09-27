-- Microfixd Supabase Schema
-- Run this in your Supabase SQL editor before starting the app

-- Enable pgvector for semantic memory
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Memory store ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microfixd_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content      TEXT NOT NULL,
  embedding    VECTOR(768),
  tags         TEXT[] DEFAULT '{}',
  organ        TEXT DEFAULT 'system',
  session_id   TEXT,
  importance   FLOAT DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS memory_embedding_idx
  ON microfixd_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS memory_tags_idx
  ON microfixd_memory USING GIN (tags);

-- ── Episode store ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microfixd_episodes (
  episode_id        TEXT PRIMARY KEY,
  task              TEXT NOT NULL,
  success           BOOLEAN NOT NULL,
  cognitive_intent  TEXT,
  complexity        TEXT,
  elapsed_s         FLOAT,
  critic_score      FLOAT,
  eval_passed       BOOLEAN,
  steps             JSONB DEFAULT '{}',
  memory_hits       TEXT[] DEFAULT '{}',
  doctrine_warnings TEXT[] DEFAULT '{}',
  tags              TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS episodes_success_idx ON microfixd_episodes (success);
CREATE INDEX IF NOT EXISTS episodes_created_idx ON microfixd_episodes (created_at DESC);
CREATE INDEX IF NOT EXISTS episodes_intent_idx  ON microfixd_episodes (cognitive_intent);

-- ── HITL records ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microfixd_hitl (
  hitl_id     TEXT PRIMARY KEY,
  session_id  TEXT,
  trigger     TEXT,
  artifact    JSONB NOT NULL,
  status      TEXT DEFAULT 'pending',
  notes       TEXT,
  decided_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Overwatch alerts ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microfixd_overwatch (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT NOT NULL,
  category   TEXT NOT NULL,
  message    TEXT NOT NULL,
  organ      TEXT,
  step       TEXT,
  resolved   BOOLEAN DEFAULT FALSE,
  episode_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Identity store (immutable) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS microfixd_identity (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  locked     BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed identity lock
INSERT INTO microfixd_identity (key, value, locked) VALUES
  ('name',        'Microfixd',                          TRUE),
  ('level',       '7',                                  TRUE),
  ('model',       'gemini-2.0-flash-exp',               TRUE),
  ('constitution','active',                             TRUE),
  ('version',     '7.0.0',                              TRUE)
ON CONFLICT (key) DO NOTHING;

-- ── Semantic search function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT   DEFAULT 5
)
RETURNS TABLE (
  id UUID, content TEXT, tags TEXT[], organ TEXT,
  importance FLOAT, similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.content, m.tags, m.organ, m.importance,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM microfixd_memory m
  WHERE 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
