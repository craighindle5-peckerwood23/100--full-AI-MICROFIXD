# One mission control plane

Production task authority is `server/planner/`: authenticated intake, tenant-derived identity, idempotent submission, Supabase state, worker leases, exact-action approvals, tool ledger, verified artifacts, and recovery. `src/` renders its state. Questions may use the response-only command path; that path cannot run a tool loop or arbitrary declared organ actions.

## Consolidated paths

| Entry point | Current behavior |
| --- | --- |
| POST `/api/planner/missions` | Canonical intake |
| POST `/api/execution/run` | Canonical intake; `task` becomes objective |
| POST `/api/command/run` | Canonical intake unless explicit `mode: chat`; chat is response-only |
| POST `/api/tools/run` | Canonical intake; `message` becomes objective |
| POST `/api/tools/execute` | Explicit tool request becomes a durable plan; changes still need approval |
| POST `/api/autonomy/chat`, `/goals` | Canonical intake, plus a legacy run projection |
| GET `/api/autonomy/runs/:id` | Reads the tenant's durable mission/tasks/artifacts; no RAM run map |
| POST `/api/skin/receive` | Canonical intake; no unauthenticated localhost execution request |
| POST `/api/agents/dispatch`, `/dispatch-all`, `/pipeline-build` | Existing governance/admin checks, then canonical intake |

Submission aliases return HTTP 202 and a persisted `mission_id`/`status_url`. They require `Idempotency-Key`; callers must retain the same key when retrying the same request. They no longer pretend that queue acceptance means completed work. Scope, tools and browser origins remain explicit. Poll mission detail for actual results.

Legacy autonomy stream tokens/SSE return 410 with `USE_DURABLE_MISSION_POLLING`; old global execution traces return 410 pointing to the tenant-scoped durable audit. Clients relying on those endpoints must use authenticated mission polling. No external frontend repository was changed by this patch.

## Removed competing state and fabricated results

- Opening the frontend no longer starts per-tab scheduler, repair, mission, watchdog or federation workers. The Autonomy room uses Mission Control; the browser autonomy singleton has no timer, seeded success history or simulated deployment. The old local DAG executor rejects execution instead of storing fabricated results. Hologram rendering and the speech utility are unchanged.
- The legacy mission-state class is a transport-backed projection, not an execution loop. It adds a mission only after server persistence succeeds. The core library entry point starts no example missions or localhost federation nodes on import.
- Backend agent paths re-export the canonical `microfixd/core/agents` instances. The alternate spelling remains as compatibility re-exports for repair and interpretation types.
- The fixed 92% example mission is gone. Legacy mutation fails explicitly instead of creating independent mission state.
- Legacy agents no longer claim fixed optimization savings, repairs, audits, test counts or synchronization. Unsupported repair tools fail explicitly; configured legacy API keys cannot turn fake repair tools into real file edits.
- The descriptor-only scheduler no longer claims to run jobs or marks a trigger timestamp as executed work. Durable recurring jobs remain unimplemented.
- Cockpit counts use actual durable states: queued/running/waiting are active; succeeded is completed.

## Verified remaining concerns

These are not closed by reorganizing imports:

1. Native organ and connector APIs still have their own action contracts. This patch consolidates mission/task submission; it does not claim every low-level connector operation is migrated to the planner.
2. `microfixd/core/autonomy/selfRepair.ts` still contains a legacy repair routine that catches routing failures. It is no longer started by the frontend; it must not be promoted to a real repair executor without provider/file/test evidence.
3. `microfixd/backend/core/memory/state.ts` is process-local legacy agent context, not durable mission storage. Remaining diagnostic/legacy consumers need separate review before removal.
4. The capability inventory describes concrete executors, not proof of live credentials or successful actions. Communications/calendar/follow-up integrations and durable recurring scheduling remain separate implementation work.
5. GitHub Actions previously failed before job startup with an account-billing annotation. Local and Render build evidence do not repair that account issue.

## Validation

HTTP integration tests exercise compatibility routes against a PostgREST contract fixture: the same tenant/key/objective creates one stored mission across entry points; changed requests conflict; tenant identities remain separate; new routers recover the same persisted run. Additional tests reject legacy direct execution and fabricated repair/scheduler results, verify canonical agent identity, and require server persistence before updating the client mission projection. These fixture tests are not a live Supabase or provider proof. Live verification must use an authenticated task after deployment.
