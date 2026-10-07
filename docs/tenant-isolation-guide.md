# Tenant data isolation guide

This is the milestone that makes "lease this to multiple customers off one
deployment" actually safe. Read this fully before onboarding a second paying
customer onto a shared instance — it's honest about what's covered and
what isn't yet.

## What's real after this pass

1. **`tenants` table + enforced `profiles.tenant_id` foreign key**
   (`supabase/tenant_isolation_schema.sql`). Every account belongs to
   exactly one tenant. Existing accounts/data are backfilled into a
   `'default'` tenant so nothing breaks on upgrade.
2. **Row Level Security on every customer-data table** — `system_logs`,
   `omni_router_requests`, `cognitive_requests`, `missions`, `agents`,
   `memory_nodes`, `automation_rules`, `microfixd_memory`,
   `microfixd_memory_records`, `microfixd_episodes`, `microfixd_hitl`,
   `microfixd_overwatch` — scoped by a `current_tenant_id()` SQL helper that
   resolves the logged-in Supabase user's tenant. This protects against
   anything querying Supabase directly with a browser/anon session.
3. **Tenant-scoped vector search** — `match_memories()` now takes a
   `filter_tenant_id` argument and only searches within it, instead of
   silently returning the nearest match across every tenant's memories.
4. **The authenticated tenant now flows end-to-end for the memory organ** —
   `server/security/rbac.ts` resolves the caller's tenant (from their
   Supabase profile, or `"default"` for shared-secret tokens) and stamps it
   onto the request. `server/organs/organRouter.ts`'s `withTenant()` helper
   injects that resolved tenant into every organ call's payload — and
   **ignores any `tenant_id` the caller tries to put in the request body
   themselves**, so a customer cannot simply ask for another tenant's data
   by naming it. `server/organs/organs/memoryOrgan.ts` uses that tenant for
   every read and write instead of the previous hardcoded `"global"`.

## The one honest, important limitation

**The service-role key (used server-side, everywhere) bypasses Postgres RLS
by design.** Supabase does not apply row-level security to service-role
connections — that's what makes it an "admin" key. This means:

- Database-level RLS (item 2 above) protects you from anything calling
  Supabase directly with the anon/browser key.
- It does **not** protect you from a bug in server code that forgets to
  filter by tenant — the service role can read/write any tenant's rows.
  **The server code stamping the correct tenant_id on every call (item 4)
  is therefore the actual isolation boundary for everything that goes
  through this Express server, not the database alone.**

This pass wired that stamping through for the **memory organ** — the
highest-traffic, most customer-data-bearing path (chat context, episodic
memory, playback acknowledgments). It did **not** retrofit every other
organ and table. Concretely still unscoped / still using whatever
process-wide default existed before:

- **Internal autonomy engines with no per-request context** —
  `microfixd/core/autonomy/evolutionEngine.ts`,
  `microfixd/core/autonomy/selfScheduler.ts`,
  `microfixd/core/metacognition/overwatchEngine.ts` call
  `microfixd/core/memory/supabaseMemory.ts`'s `storeMemory`/`recallMemories`
  directly, as background processes, not from an HTTP request — there is no
  "which customer is this for" to resolve, because these engines run as
  one process-wide singleton today. Making these genuinely multi-tenant
  (e.g. running one evolution/scheduler loop per tenant, or threading a
  tenant argument through every scheduled job) is a real scheduler
  redesign, not a one-line fix — call it out explicitly as the next
  structural piece if per-tenant autonomy/self-evolution is a requirement.
- **Every other organ** besides memory (playwright, sandbox, github,
  crawl, tools, crossai, execution, skin, security, evolution, etc.) now
  *receives* `tenant_id` in its payload (via the same `withTenant()` change
  in organRouter.ts) but most of their executor implementations don't read
  it or persist anything tenant-scoped yet — check each one before trusting
  it to keep a customer's data separate if you add per-organ persistence
  later.
- **`server/autonomy-adapter/autonomyRouter.ts`'s existing `tenantOf(req)`**
  reads a client-supplied `x-microfixd-tenant` header. This is NOT a
  security boundary — a caller can put any value there. It's used today
  only as a free-text session/run label for the compatibility layer with
  the separate "TV" frontend, not as an isolation mechanism. Don't rely on
  it for anything resembling access control.

## How to apply this migration

1. Run `supabase/schema.sql` (if not already applied).
2. Run `supabase/accounts_schema.sql` (if not already applied — see
   `docs/accounts-auth-guide.md`).
3. Run `supabase/tenant_isolation_schema.sql`.
4. Onboard a second real customer only by creating a new row in `tenants`
   and setting new accounts' `profiles.tenant_id` to that row's id (by hand
   in the SQL editor today — there's no self-serve "create a tenant" API
   yet; that's a natural next piece alongside billing/provisioning, see
   `docs/gap-audit-and-roadmap.md`).

## What "done" would actually look like

A fully isolated multi-tenant system would additionally need:

- Tenant resolved and enforced on every organ that persists data, not just
  memory (apply the same `withTenant()` pattern per-organ as you build out
  persistence in each).
- A real per-tenant provisioning flow (see the roadmap doc, item 4) instead
  of hand-editing the `tenants` table in SQL.
- Either a redesigned autonomy/scheduler layer that's tenant-aware, or a
  deliberate, documented decision that autonomous background
  engines (evolution, scheduling, overwatch) are intentionally
  process-wide/shared infrastructure and never touch tenant-specific data
  directly.
