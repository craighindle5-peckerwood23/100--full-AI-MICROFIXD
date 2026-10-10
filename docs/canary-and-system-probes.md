# Canary and concurrent system probes

Implemented scope: read-only organ routing probes. This is runtime canary selection and fallback for that path; it is not a second Render deployment or whole-platform traffic splitting.

`MICROFIXD_PROBE_CANARY_PERCENT` sets 0–100% candidate exposure. Default 0 keeps production stable. Cohorts include tenant, request, and organ identifiers. Candidate output validation, a one-second deadline, and a failure-rate circuit breaker fall back to stable probe execution. The circuit is process-local; default-off startup is the safe baseline. Configured nonzero exposure resets its counters after restart. No mutations are retried. Candidate timeouts do not terminate JavaScript; candidates must remain side-effect-free.

`POST /api/organs/batch` and `/broadcast` accept at most 256 calls. Each result carries its organ and request correlation identifiers. Calls use a shared dispatcher that preserves busy state until overlapping operations finish. Aggregate success is false when any call fails. Errors returned to clients are sanitized.

`POST /api/organs/load-all` now probes registration and routing without starting model calls, background loops, deployment actions, or vehicle operations. A positive probe does not verify organ capability. `native_executor` identifies an explicit handler; absence may indicate a generic dispatcher or alias requiring separate capability evaluation.

`npm run test:system-probes` starts an isolated local HTTP server, sends three simultaneous all-organ batches, a broadcast, and a load-all sweep. External integrations are disabled. It checks every response's organ/request/tenant association, result coverage, and final busy-state cleanup. It writes docs/system-probe-report.json. Unit tests separately inject candidate exceptions, invalid output, timeouts, concurrent faults, and stable-path failures.

For a live integration/load test use verified credentials, explicit read-only operations, and deployment metrics. Local probe results must not be presented as Supabase, inference, browser navigation, vehicle, or whole-system production capability verification.

`MICROFIXD_STARTUP_PROBES=1` runs three concurrent read-only all-organ dispatch sweeps in the deployed process and logs a commit-bound `[system-probe]` summary. It does not test public HTTP authorization or external integrations. Local HTTP tests cover routing/authorization separately. Production probe canary rollout is configured at 10% for this release.
