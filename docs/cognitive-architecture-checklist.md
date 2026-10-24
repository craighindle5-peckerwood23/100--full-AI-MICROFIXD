# Cognitive architecture implementation checklist

## Current release: evidence evaluation

- [x] Versioned deterministic mission evaluator (`mission-evaluation-v1`).
- [x] Reuse canonical evidence audit: tenant scope, content hashes, schemas, output lineage and completion review.
- [x] Evaluate the proposed final mission before marking success; integrity or execution failures wait for intervention.
- [x] Persist evaluation, snapshot hash and bounded corrective observations in existing Supabase mission messages under the mission lease.
- [x] Authenticated tenant-scoped `GET /api/planner/missions/:id/evaluation` recomputes current evidence; audit endpoint remains compatible.
- [x] No additional model calls, arbitrary confidence estimates, or automatic permission expansion.

`passed` requires complete execution, valid provenance and a recorded objective review. `incomplete` means required evidence is missing; `failed` means integrity checks failed. Historical missions without objective review remain incomplete. The report is structural assurance, not factual truth verification. The snapshot includes the proposed final artifact; it is content addressing, not a signature. Evaluations are not independent certification.

## Existing systems to extend rather than duplicate

- [x] Durable mission/task/subtask state and audit ledger.
- [x] Provider abstraction and bounded fallback.
- [x] Governed source repair, isolated candidate verification and exact-commit production checks.
- [x] Tenant-scoped persistent retrieval and completion memory.
- [x] Bounded planning and objective-review continuation.

## Subsequent connected increments (not implemented by this release)

- [ ] Unified state projection across mission, provider, memory and health systems.
- [ ] Cognitive health monitoring with measured failure categories and source provenance.
- [ ] Persistent reflection consolidation with deduplication and retention rules.
- [ ] Fixed representative benchmark corpus and version comparisons with denominators and regression gates.
- [ ] Independent evaluator checks against labeled cases, including false pass/false failure rates.
- [ ] Contradiction detection with conflicting evidence preserved for resolution.
- [ ] Typed world relationships with source, scope, validity period and causal uncertainty.
- [ ] Explicit goal hierarchy beyond existing mission/task/subtask decomposition.
- [ ] Protected versioned architecture constitution and governed change policy.

Store concise decision explanations and observable evidence; do not store private reasoning traces. Do not label missing telemetry as healthy, provider success as factual accuracy, or structural test results as intelligence scores. No arbitrary autonomous architecture rewrite is authorized by the evaluator.
