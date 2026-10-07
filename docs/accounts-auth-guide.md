# Accounts & authentication guide

This build now has two authentication paths that work side by side:

1. **Shared-secret tokens** (`ADMIN_TOKEN`/`OPERATOR_TOKEN`/`SYSTEM_TOKEN`) —
   the original model. Anyone holding one of these values gets that fixed
   role. No per-person identity, no signup. Still fully supported and is
   the default if you do nothing further.
2. **Real accounts** (new) — email/password sign-in via Supabase Auth, with
   a `profiles` table mapping each account to a role. This is what you
   enable for a product customers can sign up for themselves instead of
   you handing out a shared secret.

Both paths are checked by the same server-side RBAC layer
(`server/security/rbac.ts`): a request's Authorization bearer token is
tried first against the three shared secrets, then — only if that doesn't
match — verified as a Supabase session token
(`server/security/supabaseAuth.ts`). Nothing about path 1 changed; path 2 is
purely additive.

## What this is NOT

This is **account identity**, not **multi-tenant data isolation**. Every
account today shares the same Supabase project, the same organ registry,
the same memory/data tables. Real customer-to-customer data separation is
a bigger piece — see `docs/gap-audit-and-roadmap.md`, item 1 — and the
`tenant_id` column added to `profiles` in this pass is there so that future
work has somewhere to attach, not because tenant isolation is enforced
anywhere yet. Treat this as "customers log in with their own email instead
of a shared password," not "customers are isolated from each other."

## Turning it on

1. In your Supabase project dashboard, confirm **Authentication → Providers
   → Email** is enabled (it is by default). Decide whether to require email
   confirmation (Authentication → Settings) — if you leave it off, a new
   signup is logged in immediately; if you turn it on, they'll see a
   "check your email" message (the login screen already handles both).
2. Run `supabase/accounts_schema.sql` in the Supabase SQL editor (after
   `supabase/schema.sql`, which must already be applied). This creates the
   `profiles` table and a trigger that auto-creates a profile — defaulted
   to the lowest-privilege `observer` role — whenever someone signs up.
3. Set these environment variables (in `.env` or your host's dashboard):
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-side — these
     likely already exist if you've deployed this app at all)
   - `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (browser-side — same)
   - `VITE_AUTH_MODE=accounts` — this is the switch. Leave it unset and
     nothing about this feature activates; the app boots straight into the
     OS shell exactly as it did before this change.
4. Rebuild and redeploy (`npm run build` — `VITE_*` vars are substituted at
   build time).

With `VITE_AUTH_MODE=accounts` set, the app shows a sign-in/sign-up screen
before the boot sequence. A new account can sign in immediately (as
`observer` — read-only) but can't do anything privileged until promoted.

## Promoting your first admin

There is intentionally no in-app "make me admin" button — that would let
any signed-up user grant themselves full access. After your own account
signs up once, promote it by hand in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@yourcompany.com';
```

From then on, pick whichever is more convenient per customer or teammate:
run that same `update` statement for new accounts, or keep using the
original shared-secret tokens for automation/service accounts (the
`system` role is intended for that — scripts, scheduled jobs, MCP tooling —
while real human operators get real accounts).

## Where the token actually goes

- The frontend's existing `api()` helper (`src/lib/serverApi.ts`) already
  sends an `Authorization: Bearer <token>` header on every request. It now
  checks for a manually-entered operator token first (Settings panel,
  unchanged), then falls back to the signed-in Supabase session token
  (`src/lib/auth.ts`) if accounts mode produced one. No call site elsewhere
  in the app had to change.
- The WebSocket handshake (`/ws`) and the standalone `/api/login` endpoint
  still use shared-secret tokens only for now — extending those to accept
  Supabase sessions too is a small follow-up, not done in this pass (call
  it out if you need live WebSocket updates to work for account-based
  logins specifically; today they still work fine with a shared-secret
  token even when accounts mode is on).
