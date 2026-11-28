# Mission planning and runtime observation recovery

Model calls now receive timestamped server observations: serving revision, registry
health, failed core IDs and capability-probe freshness/tier. This reads the current
ledger; it does not trigger recursive model probes, grant tool permissions or turn
registration into execution proof. Existing system policy and original prompt data
are preserved. Browser resource-spike injection remains a simulation.

Planning messages use tenant and mission in their deterministic IDs. Diagnosis
can recover an older missing planning-error row from that mission's immutable
insert event. It never borrows another mission's message sharing an old ID.
The planning catalog keeps every permitted tool name and complete argument schema,
while shortening prose and omitting executor-routing metadata. Authorization still
uses the canonical registry and mission permissions.

Each provider dispatch reserves its full prompt (including injected observation),
requested output and overhead. Explicit HTTP request rejections (400, 401, 403,
404, 413, 422, 429) settle that attempt at zero before any fallback. Unknown usage,
timeouts, disconnects, 5xx and malformed successful replies retain reservations.
Successful calls settle at reported usage, or retain the conservative reservation
when usage is absent. Budget denials still stop dispatch and do not raise limits.
This does not retroactively refund historical uncertain attempts.

A paused source repair with no candidate checkpoint has no completed effect to
reconcile. It must not be called healed or blindly replayed. Source healing does
not repair missing budgets, credentials or approval decisions.

Validation includes a real fallback transport fixture with a rejected primary,
mission-budget RPC accounting, observation delivery and conservative ambiguous
failure handling; cross-mission ID discrimination; and legacy error diagnosis.
These fixtures are not production repair evidence. Live proof additionally needs
an identified serving revision and a new mission with persisted final evidence.
