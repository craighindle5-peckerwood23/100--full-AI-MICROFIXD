# Enterprise security assessment — honest status

You asked what's actually keeping this system from running online at an
enterprise security level. This is a direct answer: what's in place, what
was added this pass, and what's still missing before an enterprise
customer's security team would sign off. No part of this list is hidden or
softened — treat it as the real blocker list, not a sales pitch.

## What was already in place

- Role-based access control with four real roles (admin/operator/
  observer/system) and a route→permission map
  (`server/security/rbac.ts`).
- CORS is configurable (`CORS_ORIGINS`) and closed by default (no origins
  configured = no cross-origin requests allowed).
- Secrets live in environment variables, never committed to the repo
  (`.env.example` is a template, not real values).
- TLS/HTTPS termination is handled by the hosting platform (Render) in
  front of this app — the app itself doesn't need to implement TLS.
- Supabase Row Level Security exists on the core memory table.

## What this pass added

| Gap | What was added |
|---|---|
| No HTTP security headers at all (no helmet, nothing manual) | `server/security/securityHeaders.ts` — HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and a baseline CSP on every response |
| No rate limiting anywhere on the API | `server/security/rateLimiter.ts` — per-role, per-IP sliding window (20–1000 req/min depending on role), returns real `429`/`Retry-After` |
| RBAC denials only logged in-memory, lost on every restart | `server/security/auditPersistence.ts` — denials are now also written to the durable `system_logs` table, best-effort, never blocking the request |
| Auth was single-tier shared secrets only | Added real per-user accounts (previous pass) |
| No tenant data isolation | Added this pass — see `docs/tenant-isolation-guide.md` |

## What's still missing for a genuine enterprise security posture

Ranked roughly by how often an enterprise security review or vendor
questionnaire asks about it first:

### 1. No SSO / SAML / OIDC
Enterprise buyers expect to connect their own identity provider (Okta,
Azure AD, Google Workspace) so employee access follows their existing
offboarding process. Today, accounts are Supabase email/password only.
This is one of the first things an enterprise security team will ask for
and is usually a hard requirement, not a nice-to-have, for any contract
above a certain size.

### 2. No centralized secret management
All credentials are plain environment variables. That's normal for a
small deployment, but an enterprise review will ask about secret
rotation, access auditing on the secrets themselves, and separation of
duties for who can read production secrets. A real answer needs a vault
(AWS Secrets Manager, HashiCorp Vault, Doppler, etc.), not env vars in a
hosting dashboard.

### 3. No dependency/vulnerability scanning in CI
There is no CI pipeline in this repo at all (no `.github/workflows`), so
there's no automated check for known-vulnerable dependencies (`npm audit`,
Snyk, Dependabot) before a change ships. `npm test` exists but nothing
runs it automatically on push/PR.

### 4. No monitoring, alerting, or error tracking
No APM (Application Performance Monitoring), no error tracking service
(Sentry or similar), no uptime alerting beyond Render's own health check.
If something fails in production at 3am, nobody is notified unless
someone happens to look.

### 5. No documented backup / disaster recovery plan
Supabase has its own backup story, but nothing in this repo documents a
recovery point objective (RPO), recovery time objective (RTO), or a
tested restore procedure. "We use Supabase" is not the same as "we have a
tested DR plan."

### 6. No independent security testing
No evidence of a penetration test, dependency audit, or structured code
security review having been performed. Enterprise procurement almost
always asks for a recent pen test report or a SOC 2 report — neither
exists for this system.

### 7. No formal incident response plan
No documented process for "what do we do and who do we tell if there's a
breach." This is both a security-maturity gap and, depending on what data
is stored, a potential legal/compliance gap (breach notification laws).

### 8. Rate limiting and audit log are single-process
The rate limiter and in-memory audit log added this pass both live in one
Node process's memory. They work correctly for a single server instance.
The moment you run more than one instance behind a load balancer (which
you'll want for real uptime), each instance has its own independent
counters/logs — a determined caller can get around the rate limit by
landing on different instances, and the audit trail is split across
instances. Fixing this means moving both to a shared store (Redis,
or the already-durable `system_logs` table for the audit log, which this
pass added as a *supplement* but not yet the primary read path).

### 9. Shared-secret tokens never expire or rotate
`ADMIN_TOKEN`/`OPERATOR_TOKEN`/`SYSTEM_TOKEN` are static values with no
expiry, no rotation mechanism, and no per-token audit trail (every caller
holding `OPERATOR_TOKEN` is indistinguishable from every other). Fine for
a single operator; a real security review will flag it the moment more
than one person needs operator access.

### 10. CSP is permissive (`'unsafe-inline'`)
The content-security-policy added this pass allows inline scripts/styles
because the current frontend build likely needs it and a stricter policy
risked silently breaking the UI without testing. Tightening this (nonce-
based CSP, no `unsafe-inline`) is real follow-up work, not done here —
flagged rather than guessed at.

## Direct answer: what's keeping this offline at enterprise level today

If "enterprise level" means *technically reachable by any customer and
functionally working*, nothing is stopping you — `render.yaml` deploys it
right now. If "enterprise level" means *what a Fortune 1000 security team
would approve before putting real customer or financial data through it*,
the blockers, in order of how often they actually kill a deal, are:
**no SSO (#1)**, **no SOC 2/pen test evidence (#6)**, **no formal
incident response or DR plan (#5, #7)**, and **shared-secret credentials
with no rotation or per-person audit trail (#9)**. Everything else on this
list matters but is less often a hard contractual blocker.

None of these are quick patches — each is a real, separate project. Tell
me which one to tackle next and I'll scope it the same way this pass
scoped tenant isolation: concretely, with what's genuinely finished vs.
what still needs a decision from you.
