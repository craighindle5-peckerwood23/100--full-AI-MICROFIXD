-- Microfixd / Microfyxd OS — Accounts & Roles
-- Run this AFTER schema.sql, in Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New query -> Paste & Run
--
-- This adds real user accounts on top of Supabase Auth (email/password,
-- magic link, OAuth — whatever you enable in Authentication -> Providers).
-- It does NOT replace the existing ADMIN_TOKEN/OPERATOR_TOKEN/SYSTEM_TOKEN
-- shared secrets — both work side by side. See docs/accounts-auth-guide.md.

-- ── PROFILES ────────────────────────────────────────────────────────────
-- One row per Supabase Auth user. role drives what the RBAC layer allows
-- (server/security/rbac.ts); tenant_id is reserved for the future
-- multi-tenant split (nullable today — every account is tenant-less /
-- single-tenant until that layer is built; see docs/gap-audit-and-roadmap.md).
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'observer'
              CHECK (role IN ('admin', 'operator', 'observer', 'system')),
  tenant_id   TEXT,
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- New accounts default to the lowest-privilege role ('observer' = read-only)
-- — promote the first real admin by hand (see docs/accounts-auth-guide.md,
-- "Promoting your first admin"). There is no self-serve way to grant admin;
-- that is a deliberate safety choice, not an oversight.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'observer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
-- The Express server talks to Supabase with the service-role key (bypasses
-- RLS) to resolve a logged-in user's role — see server/security/supabaseAuth.ts.
-- RLS here protects the table from the ANON/browser key, in case anything
-- client-side ever queries profiles directly.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- No INSERT/UPDATE/DELETE policy is granted to anon/authenticated roles:
-- profile rows are only written by the trigger above (as the signup owner)
-- or by an operator running SQL directly in the Supabase dashboard to
-- change a role. This is intentional — there is no in-app "change my role
-- to admin" button, by design.
