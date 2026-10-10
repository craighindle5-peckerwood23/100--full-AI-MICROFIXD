# Durable execution spine v1

Mission Control submits tenant-scoped missions to `/api/planner/missions` using an `Idempotency-Key`. The server worker owns execution; UI state cannot advance tasks. Storage is Supabase only.

## Execution guarantees

- A database lease fences all state commits, model reservations and tool starts. Workers renew leases every ten seconds.
- Planning is committed with tasks and subtasks in one transaction. Completed steps are retained across restarts.
- Tool effects have a durable run ledger. Completed results are reused. Uncertain effects wait for administrator reconciliation and are never automatically replayed.
- Agent results are checkpointed before task finalization. Messages link assignments, candidates and supervisor decisions to the mission.
- Schema, evidence and content hashes determine eligible artifacts. Arbitration is deterministic; confidence is an ordering signal, not proof of factual correctness.
- Final assembly preserves verified artifacts without another model call.
- Each provider attempt reserves a conservative token allowance. Reported usage settles that allowance; unknown usage and failed attempts remain charged conservatively. The budget limits future dispatch, not provider billing guarantees.
- All protected tools require a single-use approval bound to the exact request. Browser requests also require explicitly allowed public HTTPS origins.
- Supabase tables have RLS and no browser-role grants. Server queries carry tenant and mission predicates. Shared ops credentials address the default tenant; account credentials resolve tenant membership from profiles.

## Operator controls

`GET /api/planner/missions/:id` returns persisted tasks, subtasks, artifacts, messages, approvals, tool runs and budget accounting.

Admin-only operations:

- `POST /missions/:id/approvals/:subtask/decide`: approve or reject the exact request hash.
- `POST /missions/:id/approvals/:subtask/renew`: renew an expired pending request.
- `POST /missions/:id/reconcile/:subtask`: record a verified result for an uncertain action.
- `POST /missions/:id/resume`: explicitly authorize another bounded attempt and set `max_tokens` (1–100000). Pending approvals or uncertain effects must be resolved first.

## Installation and checks

Apply SQL files in order: `execution_spine_schema.sql`, `execution_spine_governance.sql`, `execution_spine_hardening.sql`, `execution_spine_approval_renewal.sql`, `execution_spine_tool_contract.sql`, `execution_spine_result_invariants.sql`.

`npm run test:spine` checks replay prevention, crash-boundary recovery, approvals, budget pauses, output rejection and tenant-scoped messaging. `supabase/tests/execution_spine.sql` exercises real database functions in a rolled-back transaction. `npm run build` gates deployment on regression tests and topology validation.

External browser/vehicle/device capabilities remain separate adapters. Browser v1 isolates each action and navigates its explicit URL; authenticated browser sessions and arbitrary multi-step login workflows are not represented as verified capabilities.

## Production verification controls

Execution API writes require `execute`; observer monitoring does not grant mission submission.
An optional ISO timestamp `deadline_at` prevents planning or new subtask attempts after expiration.
This is a boundary deadline, not forced termination of an in-flight external action. Existing adapter timeouts remain in force.
Expired missions wait for operator intervention; automatic resume does not extend their deadline.
`GET /api/planner/missions/:id/audit` checks tenant/parent links, content hashes, required subtask artifacts, success completeness, policy fingerprints, and final evidence hashes.
Historical artifacts without provenance are reported as unverifiable rather than silently upgraded.
Hashes detect inconsistency; they are not signatures or proof against a privileged database attacker.
