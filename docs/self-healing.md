# Governed self healing

Self healing is a bounded source-repair workflow on the existing mission spine. It does not rewrite Microfixd's protected architecture, authorization, verifier, tests, dependencies or repair controller. It does not repair credentials, billing, infrastructure, physical devices, every exception type, or every bug.

## Detection and execution

Native eligible TypeError, ReferenceError and SyntaxError observations in preauthorized owner missions can enqueue explicit repair missions when `MICROFIXD_AUTOMATIC_SOURCE_REPAIR=1`. The service-only `enqueue_source_repair` function deduplicates and enforces two automatic repairs per hour and six per day. Fingerprints include the source revision so the same failure can be investigated again after a later release. The repair tool's own failures cannot recursively trigger a repair. Turning the detection flag off prevents new incident enqueues; queued work remains subject to its existing mission controls.

The existing controller reads immutable source, requests a minimal patch through the configured model, validates it, and publishes a separate candidate. The Render runner executes the full production, engineering and adapter gates without production secrets or external network during verification. A paired experiment must reproduce the original failure in the baseline, pass it in the candidate, and preserve the other selected cases. A green build alone cannot authorize promotion. A moving main, stale receipt, invalid patch, missing budget, cancellation or lost lease prevents progress.

## Recovery and rollback

Successful repair requires the candidate SHA at `/readyz` with nominal readiness and configured durable storage. The immutable controller ledger records candidate creation, sandbox verification, promotion and live verification. Existing restart recovery observes completed effects and reconciles the original tool without replaying GitHub writes.

For a candidate that actually reaches production but reports its own SHA as degraded on three consecutive observations, automatic rollback is permitted only if the previous baseline was observed healthy before the repair. The controller rechecks ownership of main and creates a new commit containing the baseline tree, parented by the failed candidate. It uses a non-forced fast-forward and then verifies that exact restoration commit. It does not reset main or reverse database migrations and external effects. Timeouts, unreachable health endpoints, a different served SHA or an originally unhealthy baseline cannot establish this rollback condition.

A restored baseline is an unsuccessful repair with recorded restoration, not a healed mission. An interrupted or unproven rollback requires reconciliation; it must not blindly repeat writes. This implementation does not implement Render artifact rollback or a general canary platform.

## Operator workflow

The Self-Healing tab in Continual Learning reads authenticated `GET /api/learning/self-healing/status`. It shows configuration, the detection flag and durable repair stages. Completed recovery requires a succeeded mission and a matching controller live-verification record. Recorded recovery is historical evidence rather than a new health probe. The bounded history window can omit older work.

An owner administrator can submit `POST /api/learning/self-healing/repair` with an `Idempotency-Key` and JSON `{ "objective": "Describe the failure and required behavior\nRegression case: tests/file.test.ts#exact existing test name", "paths": ["server/allowed/existing.ts"] }`. The route constructs one explicit `repair_source_code` mission using existing authorization, lease, budget, idempotency and persistence controls. Other tenants and non-admins cannot submit it. Model instructions and source text never grant permissions.

The older `POST /self-healing` API remains a diagnostic example. Its report is labeled diagnostic-only; static inspection cannot claim a sandbox pass or safe deployment. The UI no longer fabricates a deployed repair when the API fails.

## Verification

Run `node --import tsx --test tests/source-repair.test.ts tests/self-healing.test.ts tests/evaluation-learning-loop.test.ts`, `node tests/self-healing-ui.mjs`, and the required production gate. Source-repair transport fixtures test exact candidate receipts, stale results, rollback, authorization revocation, concurrent releases and read-only restart recovery. The HTTP fixture exercises the real Express routes and Supabase client with controlled persistence responses. The browser fixture exercises real clicks and authenticated requests against controlled API responses. These tests do not establish a production fault was repaired.

An isolated fault-injection experiment can compare a deliberately defective baseline against a corrected candidate without putting the defective baseline on production main. Record the exact SHAs, failed baseline test, passing candidate test, no-regression result and isolated runner receipt. Production proof additionally requires a naturally observed or explicitly authorized fault, a real repair mission and matching durable/live evidence. Never label a synthetic fault as an observed production incident.
