# MAID-Pro ECU Snapshot & Recovery — Microfixd integration contract

Status: specification only; no live ECU programming capability claimed.

## Boundaries
- Microfixd is an analysis and governed mission client. The local MAID-Pro gateway owns physical I/O and programming safety.
- Both custom USB-C/TCP and Windows J2534 sessions connect through one arbiter; concurrent monitoring is allowed when safe, ECU writes require exclusive ownership.
- OEM access and programming remain subject to OEM authorization, ECU capability, and compatible hardware. No security bypass or cloning of protected immobilizer credentials.
- No regression to UI, existing organs, mission spine, voice, or tool approval flows.

## Required integration ports
```ts
type CaptureClass = "diagnostic" | "calibration" | "full-readable-image";
type RecoveryStatus = "not-supported" | "unverified" | "validated";
interface EcuIdentity { vin: string; ecuHardwareId: string; softwareId: string; manufacturer: string }
interface SnapshotManifest {
  id: string; tenantId: string; ecu: EcuIdentity;
  captureClass: CaptureClass; recoveryStatus: RecoveryStatus;
  artifactDigests: readonly string[]; createdAt: string;
}
interface MaidProVaultPort {
  inspect(tenantId: string, ecu: EcuIdentity): Promise<readonly SnapshotManifest[]>;
  requestCapture(tenantId: string, ecu: EcuIdentity, actorId: string): Promise<string>;
  requestRestore(tenantId: string, snapshotId: string, actorId: string): Promise<string>;
  getOperation(tenantId: string, operationId: string): Promise<{ state: string; reason?: string }>;
}
```

## Storage and trust
- Supabase PostgreSQL is the canonical durable metadata store, with tenant RLS and service authorization; private encrypted object storage holds binary artifacts.
- Tables: maid_ecus, maid_snapshots, maid_snapshot_artifacts, maid_versions, maid_operations, maid_approvals, maid_operation_events, maid_compatibility_rules.
- Store original baselines immutably; SHA-256 per artifact; signed manifest with trusted signer key and verification; version edges refer to immutable snapshot IDs.
- Enforce append-only audit events, immutable baseline/version references, and least-privilege tenant access in database policies, not only application code.
- A locally durable append-only operation journal must survive disconnection; reconcile idempotently to Supabase. Never treat local cache as the canonical database.

## Mission and organ integration
- Vehicle Discovery Organ: identify module and capability profile.
- Diagnostic Organ: inspect codes and read-only state.
- Telemetry Organ: subscribe with bounded bus budget and backpressure.
- Snapshot Organ: request and validate captures.
- Programming Governance Organ: preflight and obtain exact-image, exact-ECU human approval.
- Validation Organ: compare before/after states and collect verification evidence.
- Audit Organ: link mission/task/run IDs to all operation events.
- Route through existing mission/task spine and Paragon HITL; do not introduce an alternate approval mechanism.

## Restore state machine
requested -> preflight -> awaiting_approval -> approved -> executing -> verifying -> completed.
Any preflight failure -> blocked; ambiguous execution failure -> recovery_required.
Approval binds tenant, operator, ECU identity, artifact digest, operation, expiration, and a one-use nonce.
Preflight: verified hash/signature, OEM-supported compatibility, programming power, transport health, exclusive lease, recoverability classification, and recovery plan.
During executing, no competing writers, no mid-flash cloud dependency, no arbitrary cancellation, and no AI-initiated retries.
On recovery_required, permit status and OEM-authorized recovery only. Never promise universal rollback.

## API surface (proposed; not implemented)
- GET /api/maid-pro/ecus/:id/snapshots
- POST /api/maid-pro/ecus/:id/snapshots
- POST /api/maid-pro/operations/:id/approve
- POST /api/maid-pro/snapshots/:id/restore-requests
- GET /api/maid-pro/operations/:id

All endpoints require authenticated tenant-scoped authorization and audit logging. Requests must be idempotent.

## Acceptance gates
1. Tenant A cannot read or restore Tenant B snapshots.
2. Duplicate capture requests do not create duplicate programming jobs.
3. Tampered artifact, mismatched ECU, expired approval, and unsupported recovery block execution.
4. Custom protocol and J2534 sessions cannot both acquire a write lease.
5. Gateway restart and cloud outage preserve local journal and recovery state.
6. Snapshot metadata never claims full binary recovery when only diagnostics are captured.
7. Tests use a simulated ECU before any bench/OEM validation.
8. Run `bash scripts/verify-production.sh` and verify Render commit before claiming production availability.

## Next implementation slice
Wire a read-only vault listing and capture manifest validation into existing Supabase auth, mission spine and audit events. Then add a simulated MAID-Pro gateway and concurrency tests. Enable physical programming only after device and OEM qualification.
