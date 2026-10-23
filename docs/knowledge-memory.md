# Structured memory and historical procedures

Microfixd adapts useful Kraken Agent memory patterns into the existing memory
organ and durable planner. The canonical store remains
`public.microfixd_memory_records` in Supabase. No new database, worker, model
provider, npm dependency, or schema migration is required. Kraken's license is
retained at `third_party/kraken/LICENSE`.

## Callable tools

The authenticated `/api/planner/tools` catalog now includes:

| Tool | Behavior |
| --- | --- |
| `remember_knowledge` | Save a fact, preference, goal, constraint or project state. Requires `key` and `content`. |
| `recall_knowledge` | Rank current claims by words, entity names and tags; include one-hop related subjects/objects. |
| `recall_procedures` | Retrieve historical tool sequences from completed missions with linked final artifacts. |

Submit these tools through `/api/planner/missions` or the existing tool execution
gateway. Writes retain the normal mission approval policy. Reads receive the
existing exact-action read-policy receipt. An assertion never becomes an
independently verified fact simply because an LLM assigned it high confidence.

For example, `remember_knowledge` arguments can be:

```json
{
  "key": "bmw-335i.current-dtc",
  "content": "Technician reports P0300 on the BMW 335i.",
  "kind": "project_state",
  "scope": "tenant",
  "subject": "BMW 335i",
  "predicate": "reported_dtc",
  "object": "P0300",
  "tags": "BMW,diagnosis"
}
```

This records a technician's report; it does not claim hardware was read.

## Identity, corrections and retrieval

Tenant identity comes from the authenticated server context. `scope: tenant`
(the default) shares a claim across that tenant's sessions and missions.
`scope: session` stays within the current session/mission. Each read filters by
tenant, and session reads additionally filter by session identity. Brain recall,
response persistence, feedback, failure records and memory-organ dispatch retain
that identity. Legacy internal calls without a tenant continue to use `global`;
HTTP callers cannot select it by supplying a payload field.

Writes are append-only. The newest event for a scoped `kind` and `key` supersedes
older events in the retrieval view. Retries use the durable subtask ID and cannot
make an older value current. A later correction back to an earlier value remains
possible. Superseded IDs/counts link to retained originals. Concurrent claims
with identical database timestamps use record IDs as a deterministic tie-break;
this is not causal ordering or automatic truth adjudication.

Retrieval scans at most 200 recent records per scope and reports when that
candidate window fills. It performs deterministic word ranking and one-hop
relationship expansion, not embedding search or full GraphRAG. Planner memory
is bounded to 4,000 characters; excluded IDs are reported.

## Context compaction

Chat automatically adds relevant structured knowledge to its memory context.
The context packer coalesces exactly equivalent command/brain exchanges and
selects whole records within the configured character budget. Oversized records
do not prevent smaller records from being considered. It reports duplicate and
omitted IDs and retains original database records. This is deterministic,
lossless duplicate compaction, not an LLM-generated conversation summary or an
unlimited context window. Model/provider failures retain Microfixd's explicit
error behavior; no zero embeddings or success-shaped fallbacks are imported.

## Procedure learning and failure recovery

After task verification and completion review, the planner persists a procedure
candidate before committing final mission success. Candidates contain the
objective, tool names, argument *names*, source artifact IDs/hashes and review
method. They do not copy prior argument values, tool outputs or executable code.
Retrieval checks that the source mission succeeded and attached the expected
final artifact. A crash before finalization leaves an inert candidate. A storage
failure leaves the mission recoverable; retry uses existing tool results and the
same procedure ID rather than executing the external action again.

Generated plans can use these records as untrusted historical examples. They
must use current arguments, allowed tools, browser origins and authorization.
There is no automatic replay, skill-code installation, permission expansion or
model-weight training. Explicit caller-authored plans remain unchanged.

## Validation

`tests/knowledge-memory.test.ts` exercises the real Supabase query builder against
a PostgREST transport fixture: tenant/session isolation, cold-session recall,
corrections/reversions, idempotent retries, one-hop links, database failures,
context bounds, procedure provenance and automatic brain recall.
`tests/execution-spine.test.ts` verifies learning failure recovery without repeated
tool execution. Run the full release gate with `bash scripts/verify-production.sh`.
Local test success is not proof of production deployment or live hardware access.
