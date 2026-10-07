-- Microfixd / Microfyxd OS — Tenant Data Isolation
-- Run this AFTER schema.sql and accounts_schema.sql, in the Supabase SQL
-- Editor: Dashboard -> SQL Editor -> New query -> Paste & Run
--
-- What this does:
--   1. Creates a real `tenants` table (one row per customer).
--   2. Makes `profiles.tenant_id` a real foreign key instead of a free-text
--      column, and backfills every existing account into a 'default' tenant
--      so nothing currently working breaks.
--   3. Adds `tenant_id` to every table that stores customer-generated data,
--      backfills existing rows to 'default', and adds Row Level Security
--      policies so the ANON/browser key can only ever see rows belonging
--      to the caller's own tenant.
--
-- What this does NOT do:
--   The service-role key (used server-side, e.g. server/organs/organs/
--   memoryOrgan.ts) bypasses RLS by design — Supabase does not apply RLS
--   to the service role. That means true isolation for server-side writes
--   depends on the SERVER CODE always stamping the correct tenant_id before
--   writing, not on the database alone. See docs/tenant-isolation-guide.md
--   for exactly which code paths this pass updated to do that (the memory
--   organ) and which ones still write unscoped and need the same fix.

-- ── TENANTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Every pre-existing account/record becomes part of this tenant. Rename it
-- (and create real per-customer rows) once you're ready to onboard more
-- than one paying customer on this instance.
INSERT INTO public.tenants (id, name, plan, status)
VALUES ('default', 'Default Tenant', 'internal', 'active')
ON CONFLICT (id) DO NOTHING;

-- ── PROFILES: make tenant_id a real, enforced foreign key ─────────────────
ALTER TABLE public.profiles
  ALTER COLUMN tenant_id SET DEFAULT 'default';
UPDATE public.profiles SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE public.profiles
  ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);

-- Update the signup trigger (accounts_schema.sql) so every new account is
-- assigned to a tenant from the start, not left null.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, tenant_id)
  VALUES (NEW.id, NEW.email, 'observer', 'default')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ── HELPER: resolve the calling (authenticated) user's tenant ────────────
-- Used in RLS policies below. Returns NULL for the service-role / anon key
-- (no auth.uid()), which intentionally matches nothing in a `= current_tenant_id()`
-- comparison — those callers are expected to go through the service role,
-- which bypasses RLS entirely, not through these policies.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;

-- ── Add tenant_id to every customer-data table + backfill + RLS ──────────
-- Pattern repeated per table: add column (default 'default' so existing
-- rows aren't orphaned), enable RLS, add a tenant-scoped policy for the
-- `authenticated` role. The service role already bypasses RLS and is the
-- only role the Express server itself uses — these policies protect
-- against anything calling Supabase directly with a user's browser session
-- token (the anon/authenticated key), not against the server backend.

ALTER TABLE public.system_logs            ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.omni_router_requests   ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.cognitive_requests     ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.missions               ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.agents                 ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.memory_nodes           ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.automation_rules       ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.microfixd_memory       ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.microfixd_episodes     ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.microfixd_hitl         ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE public.microfixd_overwatch    ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
-- microfixd_memory_records already has tenant_id (schema.sql) — just add RLS below.

ALTER TABLE public.system_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.omni_router_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cognitive_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_nodes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_episodes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_hitl         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_overwatch    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microfixd_memory_records ENABLE ROW LEVEL SECURITY; -- already enabled in schema.sql; idempotent

DROP POLICY IF EXISTS tenant_isolation ON public.system_logs;
CREATE POLICY tenant_isolation ON public.system_logs
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.omni_router_requests;
CREATE POLICY tenant_isolation ON public.omni_router_requests
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.cognitive_requests;
CREATE POLICY tenant_isolation ON public.cognitive_requests
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.missions;
CREATE POLICY tenant_isolation ON public.missions
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.agents;
CREATE POLICY tenant_isolation ON public.agents
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.memory_nodes;
CREATE POLICY tenant_isolation ON public.memory_nodes
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.automation_rules;
CREATE POLICY tenant_isolation ON public.automation_rules
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.microfixd_memory;
CREATE POLICY tenant_isolation ON public.microfixd_memory
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.microfixd_episodes;
CREATE POLICY tenant_isolation ON public.microfixd_episodes
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.microfixd_hitl;
CREATE POLICY tenant_isolation ON public.microfixd_hitl
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.microfixd_overwatch;
CREATE POLICY tenant_isolation ON public.microfixd_overwatch
  FOR ALL USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation ON public.microfixd_memory_records;
CREATE POLICY tenant_isolation ON public.microfixd_memory_records
  FOR ALL USING (tenant_id = public.current_tenant_id());

-- ── Tenant-scoped vector search ───────────────────────────────────────────
-- The existing match_memories() function (schema.sql) searches across ALL
-- rows regardless of tenant. Replace it with a tenant-scoped version so a
-- vector similarity search can never surface another tenant's memories.
-- Server code calling this function must pass the caller's tenant_id
-- explicitly (service-role calls bypass RLS, so the function itself must
-- filter — RLS alone does not protect a SECURITY DEFINER function call
-- made with the service-role key).
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT   DEFAULT 5,
  filter_tenant_id TEXT DEFAULT 'default'
)
RETURNS TABLE (
  id UUID, content TEXT, tags TEXT[], organ TEXT,
  importance FLOAT, similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    microfixd_memory.id, microfixd_memory.content, microfixd_memory.tags, microfixd_memory.organ,
    microfixd_memory.importance,
    1 - (microfixd_memory.embedding <=> query_embedding) AS similarity
  FROM public.microfixd_memory
  WHERE microfixd_memory.tenant_id = filter_tenant_id
    AND 1 - (microfixd_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY microfixd_memory.embedding <=> query_embedding
  LIMIT match_count;
$$;
