# Durable post mission procedural learning

The durable planner already calls `rememberProcedure` after its completion review and structural evaluation, before final mission commit. A storage failure leaves completion retryable; completed tool effects are reused. This release strengthens that path and adds recovery for completed missions whose procedure is missing.

## What is learned

Only successful tool steps cited by the completion review are consolidated. Stored records contain the mission objective, tool names, argument names, source artifact identifiers and hashes, and a deterministic reflection stating how many tool steps were retained or excluded. Tool argument values, output bodies and executable code are not copied. The reflection records no measured quality gain: preserving an executed sequence does not establish an improvement in intelligence or factual accuracy.

`explicit_plan` review certifies its requested actions only. `model_review` remains an objective assessment, not independent factual certification. Both remain historical references requiring current permissions, fresh arguments and verification on a later mission. The existing planner automatically recalls relevant procedures; ranking uses objectives, tool names and argument names instead of JSON boilerplate.

## Automatic recovery

Every planner-worker tick scans at most five succeeded missions after its cursor. Each mission's tenant, final artifact, completion review, cited source hashes and tool request hashes are validated before storage. Source retrieval is bounded to 128 rows and rejects a full window rather than treating truncated evidence as complete. A deterministic tenant, mission and final-artifact key makes concurrent workers, retries and restarts idempotent. An existing row is reused.

The cursor wraps to zero after a sweep. Failed writes and corrupt evidence are reported and revisited without blocking later missions or ordinary mission processing. A restart needs no process-local job list: the succeeded mission and immutable source records are the recovery source. No SQL migration, additional model call, external action replay or autonomous code mutation is introduced. A large history takes multiple ticks to sweep; this is a bounded recovery scan, not a bulk-data ingestion engine.

## Inspect a mission

Authenticated `GET /api/planner/missions/<mission_id>/learning` returns a same-tenant durable receipt and one of `consolidated`, `not_consolidated`, or `not_eligible`. Unknown or other-tenant missions return 404, missing authentication returns 403, and database failure returns 503. A mission success label alone never becomes a positive learning receipt. A reasoning-only or legacy mission can be succeeded without an eligible procedure.

## Verification

Run `node --import tsx --test tests/knowledge-memory.test.ts tests/execution-spine.test.ts`, then the required `bash scripts/verify-production.sh`. The knowledge tests use the real Supabase query builder with a controlled PostgREST transport fixture. They exercise missed-write recovery, fresh clients, session recall, duplicate delivery, failed writes, corruption, bounded scan progress, review-selected steps and tenant isolation. They are not live Supabase or provider tests. Execution-spine tests also verify that a failed completion-memory write retries without repeating the tool.

For production proof, complete a bounded authenticated tool mission, inspect its learning endpoint, then start a new session and ask for the procedure using its objective or tool name. Check its persisted source references. A staging restart and a staging write-failure test establish the real deployment's recovery behavior. Do not inject failures into production merely to reproduce the fixture. Full self-healing, autonomous code evolution, model-weight training and large-data ingestion remain separate goals.
