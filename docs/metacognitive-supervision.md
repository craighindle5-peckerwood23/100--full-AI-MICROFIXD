# Metacognitive supervision v1

The supervisor is mandatory at the authenticated HTTP execution boundary and the durable planner. An unavailable control store or audit store prevents new supervised dispatch. This is a bounded engineering control plane, not exhaustive prediction, calibrated intelligence, or proof of enterprise readiness.

## Execution and authority

- Authentication and RBAC run first. No request body or header can disable supervision.
- Tenant stop controls persist in Supabase. A new supervisor instance reads the same stop state. The existing process-local emergency switch is also enforced.
- The planner, text generators, tool executors, native organ dispatch through `getExecutor`, adapters under a request scope, completion reviews, recovered candidates, and the configured public automotive ingestion worker are supervised.
- Observational GET endpoints remain available during a stop. HTTPS source reads through browser links, VIN and OEM endpoints are treated as operations. Bootstrap health, stop/recovery controls and the metacognition status router remain accessible.
- Standalone test/probe calls without an authenticated scope are not presented as live supervised capabilities. Other processes and external edge functions require their own integration.
- A stop prevents subsequent dispatch and candidate release. It cannot undo an already committed external effect or guarantee instant cancellation of third-party work already in flight. Existing exact-action approvals, leases, budget reservations and reconciliation remain authoritative.

## Telemetry and decisions

`metacognitive_events` is append-only for the application role. Entries include schema/policy versions, event and trace IDs, tenant/mission/subtask/agent identity, phase, timestamp, elapsed time, input/output hashes, reported provider/token metadata where available, confidence provenance, alternatives and assessment. Raw prompts, exception bodies and connector credentials are not copied into this telemetry table. Existing mission artifacts and approvals retain their existing data model.

Decisions are `allow`, `quarantine`, `escalate`, and `halt`. Invalid output/evidence is quarantined; reported confidence below 0.6 escalates. Unknown confidence remains `null`; a score is never a calibrated probability. The planner parks interventions in a waiting state. There is no automatic permission expansion or policy rewrite. Escalations are durable records/waiting missions, not an external notification service.

## Comparing alternatives and perspectives

Generated plans must provide two to four alternatives, including defer/no action, with success/failure expectations, human and analytical perspectives and missing evidence. They use the existing planning model call, then pass the existing plan/tool validators. These are model proposals, not measured outcomes.

`overwatch` is now a concrete organ:

- `analyze`: bounded model critique of two to six alternatives and their assumptions. Improvements are returned as proposals only.
- `compare`: weighted criteria with evidence coverage and quality bounds. Caller-supplied claims cannot become trusted test evidence. Without independent server evidence, a measured quality percentage is unavailable.
- `quantum_simulate`: classical ideal state-vector simulation for at most 10 qubits/256 gates (`h`, `x`, `z`, `rz`, `cx`), including equivalent Python code. No physical quantum execution, noise model, hardware speedup or general quantum-to-classical efficiency claim.

Human and analytical viewpoints both carry assumptions. Neither is inherently unbiased. No component claims to enumerate every possible outcome.

## Watchdog, isolation and failover

Reasoning calls receive independent watchdog timers and cancellation signals. The `watchdog_timer` organ exposes only the current tenant's active timers in the current process. Existing planner worker liveness remains in place.

Reasoning failover selects at most one peer whose capabilities include the task's permitted tools and whose existing specialist turn budget is available. It checks the mission state, lease and supervisor before handoff. The peer receives its own inbox, the delegated input and mission evidence; it does not inherit another agent's private inbox. Tenant/mission identity, tool permissions and the shared token budget are unchanged.

Failover is restricted to provider exhaustion, transient provider errors, or a reasoning watchdog timeout before candidate commit. A persistence error or possibly completed tool effect is not eligible. Tool effects continue to use the existing idempotency/reconciliation contract. This is process-level agent isolation, not separate operating-system containers or independent model training.

## Optional majority review

Submit a mission with `peer_review_mode: "required"` for three distinct peer ballots. A majority is two of the fixed three-member electorate, including unavailable/abstaining reviewers in the denominator. Ballots bind tenant, mission and exact candidate hash. No repeated or foreign voter can count.

For non-read tools, review occurs before tool start; for reasoning outputs, before candidate commit. Exact-action approval and deterministic policies remain separate requirements. A majority cannot waive a permission, tenant boundary, deadline or stop. Quorum failure parks the mission for evidence/operator resolution. Voting is not enabled on every mission by default; it uses additional bounded model calls and the mission token budget. Distinct roles may still share a model/provider and have correlated errors.

## Authorized public and private research

Existing public readers and bounded browser tools remain available. New `read_authorized_source` supports explicit tenant-bound HTTPS endpoints with server-side bearer credentials. Administrators provision:

```json
[{"id":"manuals","origin":"https://manuals.example.com","paths":["/document"],"tenants":["tenant-id"],"token_env":"MICROFIXD_SOURCE_MANUALS_TOKEN"}]
```

Store this configuration as `MICROFIXD_AUTHORIZED_SOURCES_JSON`; keep the named token in the server environment. Provision endpoints that omit credentials, including encoded credentials, from their response bodies. The reader rejects responses containing the configured bearer token. Only exact GET paths are accepted. DNS addresses are validated and pinned for the connection, redirects are rejected, and content is limited to 256 KB/15 seconds. Results include source URL, retrieval time and a content hash, labeled as untrusted reference data.

This connector does not bypass site permissions, CAPTCHAs, MFA, subscriptions or account restrictions. It does not create a cross-call authenticated browser session. Existing explicit browser login and isolated workflow limitations still apply. No private sources are configured by this code change.

## Operations and rollout

1. Apply `supabase/migrations/20261118221030_metacognitive_supervision.sql` to the database actually configured as the service's `SUPABASE_URL`.
2. Confirm the application's service role can append events/read controls, and browser roles cannot read or modify these tables. The migration grants no browser access and creates an atomic audited control RPC.
3. Run `bash scripts/verify-production.sh`, plus adapter/engineering tests when those paths change.
4. Deploy the verified commit. Confirm the live commit through `/api/health`, then exercise authenticated status, a no-effect mission, tenant stop/reset, and cross-tenant denial. Until these pass, do not claim live supervision.

Endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/metacognition/status` | Current tenant's control, recent assessments and policy limits |
| `GET /api/metacognition/events?after=0` | Tenant-scoped, ordered events with a 100-row cursor; optional `mission_id` |
| `POST /api/metacognition/control` | Administrator-only tenant stop/reset; body `{"halted":true}` |

Stopping or resuming a tenant never changes another tenant's control row. Autonomous source repair cannot modify `server/metacognition/`.
