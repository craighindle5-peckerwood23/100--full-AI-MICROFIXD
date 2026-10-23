# DeerFlow task continuity adaptation

The DeerFlow archive contributes task-local notes, historical-source lookup,
explicitly paged evidence and content-sensitive repeated-action detection.
Microfixd implements these patterns in its existing TypeScript planner and
Supabase spine. It does not import DeerFlow's Python/LangGraph runtime, sandbox
providers, local archive database, subagent stack or deployment configuration.
The upstream license is retained in `third_party/deerflow/LICENSE`.

## Callable capabilities

| Tool | Behavior |
| --- | --- |
| `search_mission_history` | Search current-mission artifacts and return source IDs, hashes and excerpts. |
| `read_mission_artifact` | Read the complete original in pages of up to 4,000 Unicode code points. |
| `write_mission_note` | Save/replace/delete a durable working note, optionally citing existing artifact IDs. |

These tools appear in `/api/planner/tools` and execute through the same governed
mission runtime as other tools. History and evidence reads use the exact-action
read policy. Note writes retain the mission's authorization policy and use
`spine_commit` under its active database lease. A stable message ID makes a
retry of the same subtask idempotent. No new schema or database is required.

Authenticated clients can also read:

- `GET /api/planner/missions/:id/artifacts/:artifact?offset=0&limit=4000`
- `GET /api/planner/missions/:id/notes`

Every lookup filters tenant and mission. Artifact reads recompute the stored
content hash and fail on corruption. Pages expose `offset`, `total_chars`,
`next_offset`, and incomplete-page status. Offsets count Unicode code points,
including emoji, rather than bytes or UTF-16 code units. The returned hash is
the canonical JSON content hash used by the spine, not a hash of one page.

Search returns at most eight excerpts from the latest 64 artifacts and reports
when that candidate window fills. Its offsets can be passed directly to the
read tool. An excerpt is not complete evidence and cannot establish absence of
a fact outside the scanned window. Reads never delete or rewrite originals.

## Working notes and context

At most eight note keys are active per mission. Keys contain 1–40 ASCII letters,
digits, underscores or hyphens; notes contain up to 750 characters and cite up
to four artifact IDs. Every cited source must exist in the same tenant and
mission with a valid hash. Empty content deletes the active note by appending a
tombstone; previous revisions remain in the message log.

Notes carry `authority: model_report` and confidence zero. Citations establish
source availability, not that the model's interpretation is correct. Notes do
not become long-term user facts or authorization. A fresh worker reloads notes
for reasoning and completion review, including notes older than the latest four
agent messages. Malformed or over-capacity persisted note state fails closed.

Reasoning previews now include artifact IDs, hashes, explicit incompleteness and
read-tool references. Earlier artifacts excluded from the immediate context are
listed by ID. The completion reviewer can request further paged reads through
its existing bounded continuation plan. Capability inventories retain their
explicit inventory-only projection. No extra model call is introduced.

## Repeated actions

Continuation guards fingerprint a tool's name and complete arguments, regardless
of changed explanatory input. Reordering JSON keys cannot evade detection.
Distinct page offsets, search cursors or content changes remain distinct actions.
Duplicate actions within one continuation batch are also rejected before side
effects. Reasoning-only steps retain their input-sensitive identity. The
existing continuation/task/token budgets and approval rules remain in force;
this is not an unrestricted autonomous loop or automatic tool replay.

## Verification

`tests/task-continuity.test.ts` checks full Unicode reconstruction, excerpt/read
offset agreement, scoped retrieval, tamper detection, cold note retrieval,
source validation, capacity limits, idempotency, lease loss and action identity.
Execution-spine regression checks cover narration-only loop evasion and distinct
paged continuations. The production verification gate remains mandatory before
commit. Hosted deployment and authenticated production behavior are verified
separately from local transport fixtures.
