# Gap audit & roadmap (added by Copilot review)

> Integration note (2026-10-07): This document came from an uploaded archive.
> The current repository retained newer Groq, sandbox, tool, and classification
> safeguards. Account UI, branding, and security middleware were integrated;
> Supabase account and tenant SQL are staged in `supabase/` but have not been
> applied or verified against the live database. Tenant isolation is incomplete
> across server organs. The `/api/login` endpoint described below is not
> present; use Supabase Auth. See the deployed service and actual schema before
> treating any item below as production complete.

This file documents what was found incomplete in this build, what was fixed
directly in this pass, and what remains — because it requires a business or
architecture decision only you can make, not something safe to auto-generate.

## Fixed in this pass

1. **Undocumented environment variables.** `.env.example` was missing several
   variables the code actually reads: `ELEVENLABS_API_KEY`,
   `ELEVENLABS_VOICE_ID`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`,
   `AZURE_OPENAI_DEPLOYMENT`, `DEVIN_API_KEY`, `DEVIN_API_ENDPOINT`,
   `GROQ_MODEL`, `VITE_GROQ_API_KEY`, `SUPABASE_SECRET_KEY`, `TEST_URL`.
   Without these documented, each integration (ElevenLabs voice, the Azure
   "copilot" cross-AI provider, the Devin provider) silently reports itself
   "not configured" with no indication anything was missing. All are now
   listed in `.env.example` with inline notes on what breaks if left blank.
2. **`mcp.json` / `mcp-manifest.json` advertised four endpoints that did not
   exist on the server**: `/health`, `/api/login`, `/api/registry` were
   promised but never implemented; `/api/deploy` and `/api/migrations` still
   aren't. Added real, authenticated implementations for the first three
   (`server/index.ts`): a `/health` alias, a real `/api/login` token→role
   exchange using the existing RBAC model, and a read-only `/api/registry`
   that returns the organ registry plus topology/wiring metadata. `deploy`
   and `migrations` were moved to a `plannedPermissions`/`notImplemented`
   section in the manifests rather than left silently broken or faked —
   building real deploy/migration execution endpoints means giving an API
   caller the power to trigger production deploys or schema changes, which
   is a deliberate security decision, not a quick fix.

## Still open — needs a decision, not just code

These are the structural items that matter most for turning this into a
sellable, white-label "business in a box" product. None of them are bugs —
they're the next layer of the product that doesn't exist yet:

1. ~~**Single-tenant identity model.**~~ **Done, with one real caveat** —
   see `docs/accounts-auth-guide.md` and `docs/tenant-isolation-guide.md`.
   Real accounts exist (Supabase Auth), and tenant data isolation is now
   enforced via a `tenants` table, RLS on every customer-data table, and
   the authenticated tenant flowing through to the memory organ (the
   highest-traffic persistence path). The caveat: the service-role key the
   server uses bypasses RLS by design, so isolation for anything *besides*
   the memory organ still depends on retrofitting the same
   tenant-stamping pattern organ-by-organ as you add persistence to them —
   see the tenant isolation guide for the exact list of what's covered and
   what isn't.
2. **Enterprise security posture.** **Partially addressed** — see
   `docs/enterprise-security-assessment.md` for the full, honest list.
   Added this pass: HTTP security headers, per-role rate limiting, and
   durable (not just in-memory) audit logging of access denials. Still
   missing and each a real project of its own: SSO/SAML, a secrets vault,
   dependency/vulnerability scanning in CI, monitoring/alerting/error
   tracking, a documented backup/DR plan, independent penetration testing,
   and a formal incident response plan. The security assessment doc ranks
   these by how often they actually block an enterprise deal.
2. **No billing/licensing layer.** Nothing in the repo meters usage, enforces
   seat/plan limits, or talks to a payment processor. For a lease/license
   model you'll need: a plan table, usage metering per organ call or per
   token spent on LLM providers, and a billing integration (e.g. Stripe
   Billing) gating access when a plan lapses.
3. ~~**No branding/theming layer.**~~ **Done** — see
   `docs/branding-guide.md`. `src/branding/brand.config.ts` +
   `BrandProvider`/`useBrand()` now drive the product name, tagline, boot
   sequence text, top bar badge, version label, and CSS color variables from
   `VITE_BRAND_*` environment variables, with a matching `GET /api/branding`
   backend route (`server/branding.ts`). This is a **single brand per
   deployment** model — true multi-tenant branding (one running instance,
   many customer brands) still depends on item 1 (real tenant accounts),
   and is spelled out as the next step in the branding guide.
4. **Deploy/migrations are manual.** `deploy.sh` only unzips local artifacts
   into a folder — it does not provision a new customer's Supabase project,
   run `supabase/schema.sql` against it, or set its environment variables.
   A real self-serve "spin up a new customer instance" flow needs an
   automated provisioning script (Supabase project creation via their
   management API + schema apply + Render service creation via their API),
   which is the actual blocker to making this "easy for anyone to buy."
5. **`microfixd/` vs `microfyxd/` naming split.** Not dead code —
   `microfyxd/core/...` is the canonical source for shared types/repair
   logic, re-exported into `microfixd/` (e.g.
   `microfixd/core/agents/repair.ts` just does
   `export * from "../../../microfyxd/core/agents/repair"`). It works, but
   two product names living side-by-side in the source tree is a red flag
   the moment you start white-labeling — pick one internal codename and keep
   "Microfixd"/"Microfyxd" purely as the default theme/brand value, not a
   folder name.
6. **Topology vs. reality.** `microfixd/topology.json` declares 44 organs;
   only 9 are marked `executable: true`. The remaining 35 (`paragon`,
   `governance`, `sandbox`, `overwatch`, `federation`, all `core.*` nodes)
   are conceptual graph nodes, not independently callable endpoints. Confirm
   this is intentional before describing all 44 as "live capabilities" in
   any sales/marketing material — right now only the 9 executable organs are
   things a customer can actually invoke via `/api/organs/:id/execute`.

## The largest gap of all — autonomous, business-specific learning

You've described the end goal as a system that plugs into any business,
learns that specific business, maps out its operations, adapts to its
particular traits, finds neglected growth opportunities, and runs
autonomously enough to be trusted as "new management." It's worth being
direct about where this codebase stands against that:

**What exists today is generic AI infrastructure — a chat interface, an
organ/agent framework, a memory store, an evolution/self-correction
scaffold, HITL approval gates, and (after this pass) real accounts and
tenant isolation. None of it has ever been pointed at a specific business's
data to learn that business.** The "evolution engine," "self-scheduler,"
and "overwatch" organs are architectural scaffolding for autonomy
(retry logic, confidence scoring, HITL escalation) — they are not an
engine that ingests a company's financials, operations, customer data,
and workflows and derives where it's underperforming or where money is
being left on the table. That capability — a business-intelligence /
opportunity-discovery engine — does not exist anywhere in this repository
today, under any organ name. Building it is a genuinely large, separate
product effort: it needs real integrations into a business's actual
systems (accounting, CRM, inventory, scheduling — whatever that business
runs on), a defined model of what "underworked" or "neglected" means in a
way that generalizes across industries, and a trust/verification layer
far beyond what HITL approval gates provide today (a system recommending
where to invest a business's money needs a much higher evidentiary bar
than a system approving a code change).

This isn't a reason not to build it — it's the reason to scope it as its
own milestone with its own plan, rather than a feature bolted onto the
existing organs. When you share the more in-depth spec you mentioned,
the most useful next step is turning it into a concrete architecture: which
business systems it connects to first, what "finding neglected wealth" means
in measurable terms for a first target industry, and what level of
autonomy (recommend-only vs. act-with-approval vs. fully autonomous) it
operates at in its first version.

## Not touched

- `supabase/schema.sql` exists and is a real, applyable schema — the
  database layer itself is not a gap, only the *multi-tenant* use of it (see
  item 1 above).
- All server routers under `server/` (crawl, crossai, execution, github,
  hitl, mcp, organs, orchestration, playwright, sandbox, security, skin,
  tools, autonomy-adapter) are imported and mounted in `server/index.ts` —
  no orphaned router directories.
- `tests/` exists with all the files `package.json`'s test scripts expect —
  `npm test` will not fail from missing files.
