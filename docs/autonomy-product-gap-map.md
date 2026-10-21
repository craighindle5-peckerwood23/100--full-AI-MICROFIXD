# Microfixd: finished-product requirements mapped to the current build

Audit date: 2026-10-21. Source baseline: `baf0c478434b3e19fe0be76b04aea73d141dd741`, confirmed live on Render before this change. Canonical repository: `craighindle5-peckerwood23/100--full-AI-MICROFIXD`.

## Product acceptance target

A customer submits a permitted goal in a supported domain. The system identifies prerequisites, uses authorized tools and evidence, adapts its plan as results arrive, persists progress, recovers without duplicating effects, and returns a useful deliverable with an honest completion assessment. Rebranding must not change these guarantees. A new domain or device is supported only after its actual workflow passes acceptance tests.

This is an engineering audit of the principal runtime boundaries and their code/tests, with deployment and database observations. It is not a penetration test, physical hardware certification, or exhaustive validation of every registered organ. A registration record and a successful routing probe do not establish executable business capability.

## Findings and closure order

| Priority / ID | Finished-product requirement | Current evidence and gap | Acceptance test / next action |
| --- | --- | --- | --- |
| P0 / AUT-01 | Entire objective determines success | Baseline `executionSpine.ts` finalized after generated tasks succeeded; a real refinement objective ended after one capability listing. This release adds separate completion assessment and bounded continuations. | Discovery followed by required work; denied or malformed review cannot finalize; restart reuses completed effects and assessment. |
| P0 / AUT-02 | Adaptive work stays bounded and durable | This release commits review plus appended tasks together, retains permission/budget/lease/deadline boundaries, and stops repeated work. | Two continuation rounds maximum; sixteen total subtasks; reject forged evidence IDs and expanded permissions. |
| P0 / AUT-03 | Provider reliability and useful diagnostics | Prior release fixed the one-attempt Groq mission path. Planning errors are durably recorded as codes, while provider detail is mainly in runtime logs. Reservations conservatively charge failed attempts. | Add redacted structured provider failures, observed quota/cooldown state, provider health and runnable retry schedule. Never manufacture successful output on provider failure. |
| P0 / AUT-04 | Inputs and outputs flow between dependent actions | Review can now plan concrete follow-up arguments from observed results. Evidence is supplied as bounded previews; no general typed artifact-reference binding exists. | Add typed artifact selectors and immutable request binding before approval; test discovered resource ID -> actual action. Prevent truncated/missing fields from becoming invented arguments. |
| P1 / AUT-05 | Durable unattended scheduling and recovery | `schedulerOrgan.ts` explicitly reports `DURABLE_SCHEDULER_NOT_CONFIGURED`. Existing mission worker polls queued/running rows; waiting requires explicit recovery. | Durable schedules, due times, leases, missed-run policy and bounded retry cooldowns. Never replay uncertain external writes or override rejection. |
| P1 / AUT-06 | Useful memory across domains | Server memory persists to Supabase; governed memory uses a fixed tenant tool session. Planner does not automatically retrieve long-term context for every mission. | Add tenant/domain/project-scoped retrieval, provenance, expiry and relevance limits; show degraded recall and test cross-tenant exclusion. |
| P1 / AUT-07 | Self-repair means an actual verified release | Core repair/deployment executors reject unsupported actions; evolution proposals are not applied changes. Repository has engineering-loop scripts but these are not a demonstrated autonomous production repair service. | Reproduce -> isolated patch -> regression/security gates -> candidate release -> governed promotion -> live canary and measured rollback test. |
| P1 / WHT-01 | Per-customer domain/product configuration | Build-time `VITE_BRAND_*` and account tenant identity exist. They are not a tenant-specific runtime product catalog. | Persist versioned tenant brand/domain profiles, enabled capabilities, knowledge scope, allowed adapters, budgets and release version. Prove two customers get different products without data leakage. |
| P1 / WHT-02 | Per-customer integrations and onboarding | Accounts resolve tenant/role from trusted profiles. Shared ops tokens resolve to default tenant. Casework Gmail is browser-authorized and hard-coded to `craighindle5@gmail.com`. | Customer-specific OAuth connections, server-side encrypted refresh lifecycle, revocation, credential ownership, consent and tenant-scoped execution. Preserve the existing casework account requirement. |
| P1 / WHT-03 | Seat-based subscriptions and limits | No Stripe/billing/subscription implementation was found in the inspected tracked files. Branding does not provide entitlements. | Subscription/webhook truth, seat assignment, employee roles, usage accounting, feature enforcement and cancellation tests. Provision no paid service silently. |
| P1 / HW-01 | Supported hardware is discoverable and usable | Current OBD setup/bridge supports specific ELM327/J2534 paths, session freshness, interpreter and governed reads. Recent tests are simulated; physical compatibility is unverified. | Publish tested device/OS/driver/transport/protocol/firmware/application combinations, evidence of physical tests and unsupported-operation behavior. |
| P1 / HW-02 | Hardware writes are recoverable and authorized | Generic OBD access is not universal OEM ECM/TCM/BCM programming, tuning, immobilizer, ADAS or all-module access. Those require distinct adapters, specifications and validation. | Add each operation separately with identity binding, power/connection checks, backup/restore, exact authorization and real device bench tests. |
| P1 / DAT-01 | Domain data is available, current and licensed | Automotive knowledge algorithms and provenance checks exist; no licensed OEM corpus is bundled. Frequencies are not calibrated repair probabilities. | Acquire permitted sources, ingestion/fitment/version/freshness policies, retrieval evaluations and source-linked diagnostic validation. |
| P2 / OPS-01 | Measured service reliability | Render serves the current commit. A free web-service plan is configured; it is not evidence of continuous worker availability. CI billing had blocked hosted jobs in prior release evidence. | Verify uptime/worker lifecycle against requirements, durable alerts, production SLOs, backup/restore drill, queue age and provider exhaustion monitoring. Plan changes require an explicit cost decision. |
| P2 / UX-01 | Customer receives an actionable result | Existing final assembly returns persisted artifact outputs; large discovery payloads can overwhelm presentation. This release shows completion reasons. | Domain-specific final deliverables, summaries linked to original evidence, download/export, and delivery acknowledgment without exposing private credentials. |

## White-label product contract

A domain has no arbitrary numeric slot limit. Real constraints are model context/output limits, provider quota, storage/retrieval, licensed data, adapter coverage, compute/concurrency, cost, and operational validation. Adding another domain expands what must be maintained and tested.

Each versioned customer profile should bind:

1. Tenant, product identity, logo, theme, domain and support information.
2. Domain resources: licensed datasets, schemas, retrieval scope, freshness and provenance requirements.
3. Callable capabilities: exact tool/action schemas, dependencies and tested adapter versions.
4. Connection ownership: service/device identity, credentials, consent, revocation and secret references.
5. Execution policy: roles, permitted actions, allowed origins, token/time budgets and recovery rules.
6. Acceptance criteria: required deliverables, verifiers, evidence IDs and explicit unsupported behavior.
7. Commercial limits: subscription, named employee seats, usage and support commitments.

A logo change is a branded deployment. A true white-label platform adds onboarding, lifecycle management, tenant-specific policies/connections, entitlements and independently tested customer workflows. Do not advertise every domain or every device based on an organ count.

## Hardware contract and compatibility matrix

Every adapter needs `discover`, `identify`, `capabilities`, `read`, `health`, `disconnect`, and operation-specific recovery behavior. `write`/`flash` are optional capabilities and must never be inferred from connector presence. A common envelope can share request ID, tenant, adapter/device identity, transport/protocol, command, timeout, sequence, timestamp, result/error and evidence. Device-specific protocols remain inside adapters.

The matrix must record device/vendor/model, firmware, OS/architecture, driver, transport (USB/Bluetooth/Wi-Fi/Ethernet/serial), application protocol, supported reads/writes, security requirements, test environment, physical test evidence and known limitations. A sixteen-pin connector alone does not prove a vehicle protocol or operation is supported. Network reachability alone does not prove safe hardware control.

## Current verification boundaries

Live database snapshot during audit: sixteen missions, with eight `succeeded`, six `waiting`, and two `failed`. These are historical execution states, not a verified objective-completion rate. Recorded planning error categories included `INVALID_PLAN_JSON` and `PROVIDERS_EXHAUSTED`. This release does not relabel historical success or restart unrelated missions.

Existing strengths retained: tenant-derived identity, durable Supabase mission state, worker fencing, exact-action receipts, uncertain-effect reconciliation, artifact hashes/provenance, schema checks, bounded retries and production release gates. The new completion assessment improves objective coverage but a model verdict is fallible. High-stakes domains still need explicit deterministic checks and physical/domain validation where appropriate.
