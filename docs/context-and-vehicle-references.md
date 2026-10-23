# Stored context and vehicle reference integration

The actual pinned `@langchain/langgraph` and `@langchain/core` packages now run
the read-only context pipeline used by chat and generated mission planning:
stored-history retrieval, structured knowledge, public vehicle references, and
bounded context assembly. A LangChain retriever returns document objects from
Supabase. This is the first framework integration; it does not replace the
durable mission controller or claim graph checkpointer persistence. Supabase
rows, the existing mission leases and the tool-effect ledger remain canonical.

History search includes older matches in the current session and explicitly
tenant-shared records. Other sessions' private records and other tenants stay
isolated. Legacy `global` rows are not silently reassigned to the `default`
tenant. Retrieval is lexical and relationship based; this release does not
backfill embeddings, train model weights, or claim semantic vector search for
all existing memory. Retrieved content remains untrusted reference material.

Authenticated APIs:

- `GET /api/automotive/references?query=BMW%20335I`
- Admin-only `POST /api/automotive/references/import` with
  `{ "kind": "recalls", "make": "BMW", "model": "335I", "modelYear": 2010 }`.
  `kind` also supports `complaints`.
- Durable missions can call `search_vehicle_references` with `query`.

Imports reuse the existing NHTSA acquisition code and source tables. Records
are upserted by source and external record ID with source URL, fetch time and
content hash. Successful counts follow successful writes. An import can be
partially persisted if its provider/storage fails; retries upsert the same IDs.
No recurring ingestion schedule is created. The API and existing ingestion
worker share one writer.

Recall records do not prove a particular VIN is affected. Consumer complaints
remain unverified reports. Neither becomes a tested repair, a licensed OEM
manual, a new vehicle owner record, or a diagnostic hypothesis automatically.

## Runtime findings

The legacy runtime table is separate from the current durable mission ledger.
Old `running` rows without terminal updates must not be counted as current
executions or silently marked repaired. Current errors include provider
exhaustion, invalid plan JSON, output truncation, budgets, browser scope and
approval/reconciliation pauses. The registered self-healer has no native
executor. Existing core repair and auto-deploy entrypoints explicitly require
a verified governed pipeline; proposal generation is not applied repair.

The subsequent Render repair runner and protected `repair_source_code` tool are documented in
`repair-runner-and-vehicle-catalog.md`. Incident-triggered repair remains incomplete.
Uncertain effects still require reconciliation; historical status rows are not rewritten.
