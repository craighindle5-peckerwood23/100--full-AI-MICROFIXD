# VECTOR automotive knowledge integration — phase 1

Status: PR #30 supplies the canonical 16-table catalog. This PR adds only sensor specifications and structured diagnostic test specifications referencing the canonical tables. The addendum migration is not confirmed applied; no new runtime APIs or validated predictions are claimed.

## Relationship to Microfixd
Use the existing Supabase database, mission/task spine, governed tool execution and MAID-Pro gateway. Do not create a parallel AI runtime or alternate database. Vehicle catalogs and sourced DTC definitions are shared reference data; repair cases are tenant-scoped and must be accessed only through authenticated service endpoints enforcing tenant ownership. RLS is enabled with no permissive policies as a fail-closed starting point. Before deployment, add narrowly scoped read policies for licensed reference data and tenant isolation for repair cases and their child records.

## Source pipeline
Ingest manufacturer-licensed service data, public recalls and bulletins, OBD standards where licensed, approved technical publications, repair outcome reports and permissioned forum material. Store attribution, license, publication date, retrieval date, revision and content hash. Do not copy entire copyrighted publications without rights. Separate anecdote from validated repair data. Never treat a forum shortcut as an approved safety procedure.

## DTC intelligence
DTC -> vehicle variant + module + symptoms + freeze frame + operating conditions + diagnostic test outcomes -> ranked hypotheses. Codes do not establish a failed part. Every recommendation must cite evidence and display missing tests.

A percentage is permitted only with a documented denominator, source population, sampling method, recency, and sufficient verified cases. 'Common failures' statistics are not posterior probabilities for a particular vehicle. Until a calibrated predictive model with held-out validation exists, display counts and evidence grades, not '93% certain' or similar fabricated certainty. Report model calibration, uncertainty intervals, and out-of-distribution cases.

## Monitoring scope
Enumerate actual supported modules by vehicle and gateway; include ECM, TCM, BCM, ABS/ESC/TCS, ADAS/lane departure, SRS, EPS, HVAC, infotainment, gateway and EV/hybrid controllers where present. Module support depends on hardware, OEM authorization, protocol and signal availability. Prefer passive observation and approved diagnostics; do not imply universal access.

## Tool geometry
Record OEM diagrams/CAD only when licensed; link geometry to component, variant, clearance envelope, fastener access, loads and safe work constraints. Tool concepts are proposals for engineering review, not fabrication instructions or safety certifications. For manufacturer submissions use a verified official specialty-tool suggestion channel, never an invented link.

## Next bounded slices
1. Apply and verify the additive sensor/test migration after the canonical foundation, then add tenant-safe read-only catalog endpoints.
2. Implement source ingest, deduplication, provenance and searchable retrieval with license checks.
3. Add diagnostic case workflow, DTC test checklist and evidence-linked hypotheses.
4. Add statistics from verified repair outcomes with proper denominators and calibration.
5. Connect live MAID-Pro read-only telemetry after simulated tests and module capability discovery.
6. Add geometry and tool concept review workflow.

Release requires schema migration tests, RLS cross-tenant tests, ingestion provenance tests, and `bash scripts/verify-production.sh`, then deployed-commit verification. No production readiness claim from this spec.
