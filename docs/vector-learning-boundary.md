# Vector compounded-learning boundary

The Vector DiagnosticCase gateway accepts optional tenant-scoped `learning_context` references from Vector's authenticated private service. Each unit identifies its approved case, verification, version, parent units and lineage generation. The gateway has no database, memory-promotion, account-admin or vehicle-write capability.

Historical experience only breaks ties between tests with equal current-evidence/time scores. A prior case cannot add a source procedure, invent an observation, establish an OEM or mechanical limit, verify a new repair, bypass applicability/safety checks or promote itself. Cross-tenant and self-case learning references are rejected. With no learning context, existing caller behavior is retained.

Vector owns qualified learning promotion, durable lineage and invalidation. A new case must pass its own evidence, repair, validation and human approval before producing another learning generation. Withdrawn units and their descendants are excluded by Vector's storage gateway. No model-weight training or measured accuracy gain is claimed.

The gateway validates optional invocation-correlation headers, rejects a mismatching run ID, and echoes trace/workflow identities. It reports `X-Vector-Model-Version: microfixd-case-ranking-1.1.0` and refuses requests explicitly requiring a different model version. Existing `microfixd-automotive-1` structured wire output remains compatible; the new Vector client also checks the implementation-version header before acceptance.

Verified locally: 169 production-gate tests, classification validation, five release evaluation cases and frontend builds; paired PostgreSQL/HTTP DiagnosticCase fixtures cover human continuation and two generations of approved learning. Test cases are synthetic; database and HTTP execution are real. Production deployment, real-case accuracy evaluation and physical adapter/write verification are outstanding. Execution tiers and future hardware safety requirements are defined by Vector's governed architecture; model output never becomes a bus command.
