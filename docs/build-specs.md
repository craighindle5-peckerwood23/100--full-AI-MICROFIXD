# Microfixd build specification

Updated: 2026-10-06. Canonical repository: `craighindle5-peckerwood23/100--full-AI-MICROFIXD`.

This document adds the requirements from `microfixd_project-upgraded-specs.zip` to the existing Microfixd build scope. It is a specification update, not a declaration that the uploaded implementation is integrated or production verified. Preserve the deployed OS, standalone frontend, GitHub MCP integration, and previously merged fixes.

## Source and precedence

- Uploaded archive: `microfixd_project-upgraded-specs.zip`.
- SHA-256: `84cc4ca996903dc6ad41b57c565db09986763eb3a67004f9f4ab06c332477e49`.
- Archive root: `100--full-AI-MICROFIXD-main/`.
- Integration baseline: main commit `aa385fdca8481860d4b0b390d787ccba5e16d5c1` (includes PRs #10, #11, #12).
- The archive contains source code rather than a standalone requirements document. Requirements below are derived from its changes; the source inventory is [specs/upgraded-source-manifest.json](specs/upgraded-source-manifest.json).
- Existing constraints prevail: one canonical repository and Supabase database; no local JSON/JSONL persistence or silent memory fallback; human approval for governed actions; strict typed-object classification; preserve the scene graph and UI lanes; preserve recent build and Groq recovery fixes.

## Added requirements and acceptance gates

All rows are requirements to implement or verify. No row is marked complete by this document.

| ID | Requirement | Acceptance gate |
|---|---|---|
| UPG-01 | Persist governance decisions, pending/decided approvals, audit events, and dual-key state in Supabase. | Restart and redeploy retain exact decisions and pending approvals. Database failure is surfaced and governed execution remains blocked. No file-backed state or seeded mock success in production. |
| UPG-02 | Add mission `awaiting_approval` state and `pendingApprovalId`; distinguish policy blocking from human review. | Pending approval pauses the exact step; approval resumes that step once; rejection terminates it. Decisions are bound to tenant, mission, action and payload and cannot authorize another action. |
| UPG-03 | Persist mission state, steps, current step, tenant, error and approval linkage in Supabase. Start the mission scheduler at server boot. | Restart while awaiting approval restores the same mission and approval link. Concurrent scheduler ticks/workers cannot execute a step twice; terminal missions do not restart. Completion requires real validation of the execution result. |
| UPG-04 | Expose authenticated tenant-scoped mission APIs: `GET /api/missions`, `GET /api/missions/:id`, `POST /api/missions` with `{name, steps}`. | Reject malformed/empty missions. Unauthorized requests cannot list, create or operate missions. Cross-tenant lookup returns no data. Creation and scheduler progress are durably observable. |
| UPG-05 | Resolve tenant identity from authenticated server-controlled credentials and carry it through missions, governance, HITL, organ execution, memory and playback acknowledgments. | Request bodies/headers cannot override the resolved tenant. Unknown credentials fail authentication. A second tenant cannot read, decide, resume or acknowledge the first tenant's records. Cross-tenant administration requires explicit permission and audit. |
| UPG-06 | Add real embedding-based semantic memory recall backed by Supabase pgvector, alongside explicitly labeled keyword retrieval. | Successful recall uses real provider embeddings and reports its retrieval mode. Missing configuration/provider/database failure is explicit; zero vectors and keyword results cannot be reported as semantic success. Tenant/session filters apply inside the database query before ranking/limit. |
| UPG-07 | Use server-side environment configuration and lazy initialization for semantic memory. | Importing Node modules does not depend on `import.meta.env`; service-role/secret keys never reach frontend bundles, logs or API responses. Configuration checks include database and embedding credentials. |
| UPG-08 | Support configured email notifications for approval requests/decisions, HITL review, and mission outcomes. Add authenticated `GET /api/email/status` and admin-only `POST /api/email/test`. | Notifications use authorized configured recipients; no live test mail is sent as part of the spec update. Disabled/unconfigured delivery reports that state. Delivery failures are observable and never grant approval, block the decision transaction, or falsely report successful mail. Durable event IDs prevent duplicate notifications after restart. |
| UPG-09 | Add a deployment verification command, proposed as `npm run verify:deploy`, targeting `/readyz`, `/api/health`, `/api/health/deep`. | Exit nonzero on timeout/degraded dependencies. Supply required authentication for protected endpoints. Check response schema and dependency status, not HTTP 200 alone. Provider/database checks are bounded and identify the failing dependency. |
| UPG-10 | Extend automated verification for approval recovery, tenant isolation, semantic retrieval, notifications and deployment readiness. | Tests include restart recovery, rejection, exact-payload binding, concurrent-step protection, forged tenant payloads, cross-tenant acknowledgments, vector provider failure, and readiness false positives. Separate mocked tests from authenticated live inference/database checks. |

## Proposed implementation locations

| Area | Archive sources / target integration points |
|---|---|
| Governance | `microfixd/backend/core/governance/engine.ts` |
| Mission lifecycle | `microfixd/core/autonomy/missionStateMachine.ts`, proposed `server/missions/missionRouter.ts`, server boot wiring |
| HITL | `server/hitl/hitlManager.ts`, `server/hitl/hitlRouter.ts`; integrate with existing sandbox and Paragon approval gates |
| Tenant authorization | `server/security/rbac.ts`, `server/organs/organRouter.ts`; propagate through command and autonomy routes too |
| Durable/semantic memory | `server/organs/organs/memoryOrgan.ts`, `microfixd/core/memory/supabaseMemory.ts`, versioned Supabase migrations |
| Notifications | Proposed `server/email/emailService.ts`, `server/email/emailRouter.ts` |
| Deployment verification | Proposed `scripts/verify-deploy.mjs`, `package.json`, deployment workflow |

## Configuration contract

Configuration names proposed by the archive include `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`, `TENANT_TOKENS`, `DEPLOY_URL`, `VERIFY_TIMEOUT_MS`, and `VERIFY_INTERVAL_MS`. These are specification inputs, not credentials installed by this change.

`TENANT_TOKENS` is an archive proposal for credential-to-tenant mapping; mapping a token to a tenant must not itself grant an unspecified role. Production authorization must resolve role and tenant consistently. Existing single-tenant deployments may retain an explicitly configured default tenant without accepting forged tenant IDs.

Use server-only Supabase credentials. The archive proposes Gemini 768-dimensional embeddings, whereas the GitHub MCP semantic index uses OpenAI 1536-dimensional embeddings. Keep these vector spaces separate with declared model and dimension, or select one documented canonical provider and migrate/re-embed existing data. Never put incompatible vectors in the same indexed column. Verify the selected model's current availability before implementation.

## Archive implementation gaps to resolve

1. Governance/mission JSON snapshots and HITL JSONL reloads conflict with Supabase-only durability and ephemeral Render storage. Preserve the restart-recovery requirement while implementing it in Supabase.
2. The archive overwrites `tsconfig.json` without the independent MCP package exclusion from PR #11. Preserve that exclusion and separate package dependency/build boundaries. Preserve PR #12's Groq quota failover and output clamping.
3. Organ payload spreading permits client-supplied `tenant_id` to replace the server tenant. Resolve tenant identity after payload validation and never accept a caller override.
4. Filtering vector results in JavaScript after a global top-k query is insufficient. Filter tenant/session before ranking and enforce the access model in database permissions/RLS. Review every keyword, semantic, stats and acknowledgment path.
5. The uploaded SQL creates a public vector table/function without complete access policies. Review grants, RLS, RPC permissions and tenant predicates before applying migrations. Do not install the archive migration unchanged.
6. Embedding failure returns a zero vector; RPC errors can return an empty successful-looking result. Replace these with explicit failure/degraded states and distinguish keyword retrieval from semantic retrieval.
7. Approval matching/deduplication must include tenant and exact action context. Retaining only a fixed small in-memory approval queue cannot be the authoritative store.
8. The email test route comment promises admin-only access, but routing uses the broader `monitor` permission. Add explicit admin enforcement; notification links must target actual deployed approval routes. Do not expose tenant-specific recipient information across tenants.
9. The deployment script checks only HTTP status and does not authenticate `/api/health/deep`. Require dependency-aware payload validation and proper auth; a shallow healthy process is not proof of working Groq/Supabase.
10. The mission validation phase retains simulated validation. Replace it with actual result verification before marking autonomous work complete.
11. Added `nodemailer` packages appear in `package.json` without corresponding lockfile changes. Select and verify supported versions and regenerate the lockfile when implementing notifications.
12. The archive has no new tests for these upgrades and no matching topology/wiring additions. Classify new components using existing allowed types and validate nodes/routes before runtime integration.

## Build invariants and release evidence

The allowed object types remain `microfixed.organ`, `microfixed.subsystem`, `microfixed.pill`, and `microfixed.channel`. Update `microfixd/topology.json` and `microfixd/wiring.json` for implemented components; run `npm run validate:classification`. Preserve AVATAR, PARTICLE, ORBIT, COMMAND_SURFACE, TELEMETRY and MISSION_CARD lanes.

Retain the GitHub MCP server requirements: repository/file/code search, commit/PR/issue analysis, architecture indexing, remote vector search, shared memory/tasks/session state and governed sandbox access. This archive is additive; it does not replace that integration.

A release implementing these additions requires the OS production build, independent MCP build/tests where affected, appropriate regression tests, schema/access verification, restart recovery and authenticated live Groq/Supabase readiness evidence. Report features as implemented only when their acceptance gates pass. Documentation-only integration does not require a new database migration or provider configuration.
