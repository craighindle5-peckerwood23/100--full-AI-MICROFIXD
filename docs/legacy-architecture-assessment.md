# Microfyxd architecture assessment

The account inventory contains 14 earlier repositories under the Microfyxd and Microfixd spellings. The strongest primary sources for this transfer were Microfixd-OS, Microfyxd-monorepo, microfyxd, MICROFIXD-ALL-ORGANS-CLAUDE and the immutable-core archive in microfixd-clean.

| Original subsystem | Current implementation and finding |
|---|---|
| Paragon, constitutional lock and master wiring | The OS catalog describes 200 organs across 21 families and eight layers. The current build has a separate registry, topology, wiring, RBAC, HITL and digest gate. A catalog entry alone cannot establish a working adapter. |
| Cognition and reflection | The command center and brain route language tasks. Live mission status now reads the tenant’s planner records. |
| Mission control and agents | The durable mission spine records tasks, approvals, runs and artifacts. The cockpit now exposes explicit tool requests through the same dispatcher. |
| Memory and learning | Supabase holds scoped historical knowledge and artifact-backed procedures. Prior cases support diagnosis. Online weight learning remains unverified. |
| Watchdog and recovery | The monorepo watchdog bounds operations. The current worker now rotates through waiting repair missions so the first four cannot monopolize recovery checks. |
| Source repair | The old selfHeal node randomly simulated build and test results. We transferred its three-attempt limit and the monorepo’s validator-feedback concept. Only malformed, truncated or ambiguous edit proposals receive another attempt before repository writes. |
| Sandbox and evolution | Current repair promotion requires a matching isolated verification receipt. Evolution proposals and a successful repair of a real incident are distinct outcomes. |
| Provider routing, federation and infrastructure | The current provider fallback, MCP and infrastructure surfaces exist. Universal provider coverage and the old exclusive OmniRouter policy have not been established across every call site. |
| Holographic interface and bring-up | The cockpit, boot sequence and readiness endpoint remain the operator entry points. External phone, form and email actions described by the old site require separate working adapters. |
| Final audit | Mission audit, release evaluation and deployment identity serve different purposes. A live commit verifies rollout. Resolving the original symptom requires an incident-specific check. |

Source comparisons include Microfyxd-monorepo at 080d73f (watchdog and metaRepair), microfyxd at d1ece5c (selfHeal), MICROFIXD-ALL-ORGANS-CLAUDE at 73b6fd4 (self-healing control plane), and microfixd-clean at 27c4f91 (immutable core). Microfixd-OS documents the original operating model in COMPLETE_SYSTEM_SUMMARY.md. This assessment maps subsystem responsibilities and does not certify every legacy organ or deployment.
