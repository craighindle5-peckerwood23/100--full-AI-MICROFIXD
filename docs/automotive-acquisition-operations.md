# Automotive acquisition operational runbook

## Deployment status
- Migration files: `supabase/automotive_ingestion_schema.sql`, `supabase/automotive_ingestion_worker.sql`.
- Edge Function: `supabase/functions/automotive-acquire/index.ts`.
- Source adapter and Node worker: `server/automotive/`.
- Source records are not a validated repair library; NHTSA complaints are unverified reports, and recalls are not DTC repair probabilities.

## Security
Edge Function JWT verification is enabled. The handler also requires the service-role bearer token; do not expose it in browser JavaScript, logs or client apps. Invoke only from a trusted backend. Tables use fail-closed RLS; source acquisition does not write to tenant repair cases.

## Calling the worker from a trusted server
POST `https://<project-ref>.supabase.co/functions/v1/automotive-acquire`
Headers: `Authorization: Bearer <service-role-token>`, `Content-Type: application/json`.
Body: `{"action":"enqueue","kind":"recalls","vehicle":{"make":"BMW","model":"335i","modelYear":2010}}`
Body: `{"action":"run","limit":5}`
Never publish the token or invoke directly from the public UI.

## Queue semantics
- Atomic claim via `automotive_claim_job()` and one-time lease token.
- Bounded request timeout, max 5000 source items, per-record SHA-256.
- Completion guarded by lease token; failed jobs retry with backoff, max five attempts.
- Long batches may outlast the 90-second lease. Keep job batches small and add lease renewal before using large result sets.
- Idempotent source records keyed by source ID and external record ID or hash.

## Next verification gates
1. Invoke deployed function with a trusted service token, confirm one job completes.
2. Verify source record count, hash, source URL and payload; repeat ingestion to verify deduplication.
3. Test 429, malformed JSON, network timeout, duplicate workers and expired lease.
4. Verify authenticated/anonymous roles cannot read acquisition tables or execute RPCs.
5. Wire a real scheduler (Supabase Cron or an authorized server-side job); do not claim continuous ingestion until scheduled.
6. Run `node --import tsx --test tests/automotive-ingestion.test.ts` and `bash scripts/verify-production.sh`.
7. Connect records to the vehicle/DTC ontology only after provenance and quality checks.

## Licensing
Do not indiscriminately mirror books, paid manuals or forums. Store permitted source metadata and links; ingest full text only when the license allows. Track source-specific restrictions and deletion requests.
