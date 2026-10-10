# Production build contract

This is the project's authoritative workflow for efficient, accurate implementation. It supplements feature specifications; it does not replace their acceptance criteria.

1. Select one bounded subject with observable acceptance criteria. Inspect existing implementation before scaffolding. Reuse working modules and one canonical implementation per capability.
2. Batch independent reads and related edits. Use Bash, rg, structured scripts, and existing libraries. Do not generate unused organs, redundant scaffolds, fabricated outputs, or extra model calls.
3. Complete connected implementation: runtime logic, authorization, persistence where needed, failure behavior, tests, and documentation. Preserve scene graph, topology, wiring, typed classification, Supabase durability, tenant boundaries, and HITL.
4. Run focused tests while developing. Once the subject is complete, run `bash scripts/verify-production.sh`; use `--clean` for a reproducible install. The gate runs type checking, the full regression suite, classification validation, deterministic release evaluation, and the frontend production build exactly once.
5. Commit one coherent release after checks pass. Use the current remote head and a compare-and-set branch update. Never overwrite another contributor's changes or commit generated logs, credentials, or unrelated files.
6. Verify the intended commit is live on Render. Inspect deployment failure evidence and correct failures. Push success and build success do not establish deployment success. Test relevant API behavior; distinguish local tests from live proofs.
7. Report implemented changes, passing checks, deployment commit/status, and concrete remaining gaps. Do not stop merely to offer continuation of authorized work. Ask only for genuinely missing information or required consequential approval.

## Governed release evaluation

`governance/release-policy.json` versions the required deterministic acceptance cases. Missing, duplicate, unexpected, malformed, or failed cases reject the release. Changes to policy and cases are reviewed as code changes; the gate is not independent certification or cryptographic attestation.

Reports hash the policy and results for reproducibility. These hashes are not signatures. The full regression suite remains mandatory; the compact evaluation cases do not replace it.

The evolution organ may generate candidate proposals. Provider failure must be reported, never replaced by invented success. Proposal status must not claim application without a real governed release. This release gate does not implement canary orchestration, automatic rollback, model training, or performance calibration.

## Safe shortcuts

Use deterministic evaluation and assembly, bounded context, reusable fixtures, one build command, and batched independent work. Do not skip security checks, provenance, durable state, failure recovery, or tests to gain speed. Limit work to the selected subject while preserving existing behavior.
