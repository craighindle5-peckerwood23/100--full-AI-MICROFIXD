# Render repair runner and vehicle data

Canonical repository: `craighindle5-peckerwood23/100--full-AI-MICROFIXD`.

## Source repair

The protected `repair_source_code` durable tool accepts `objective` and `paths_json`
(a JSON array of up to eight exact existing source files). Only an owner tenant
administrator's preauthorized mission can run it. Other tenants, manual missions,
and the generic organ invocation cannot bypass this boundary. The owner tenant
defaults to `default`; override with `MICROFIXD_REPAIR_OWNER_TENANT`.

Configure `MICROFIXD_REPAIR_RUNNER_URL` on the main Render service. The existing
`GITHUB_TOKEN` must be able to create commits and fast-forward branches in the
canonical repository. Model calls use existing provider fallback and durable
mission token reservations. No additional sandbox API key is needed for this
specialized Render verification path. The separate general-purpose E2B tool
still requires its own credential.

The controller reads specified files at an immutable main SHA, requests one
bounded patch, validates paths and size, and publishes to `repair/candidate`.
Run a separate Render Docker service from that branch with
`infrastructure/repair-runner/Dockerfile`. Enable auto-deploy on commit. Do not
attach env groups, production credentials, secret files or disks to the runner.

Dependency installation has network access. Candidate verification uses BuildKit
`RUN --network=none`, an empty environment, a 20-minute process timeout, the full
production gate, engineering tests and adapter tests. An external-connect probe
must fail. The final image contains only the verification receipt and its small
HTTP server; it cannot execute submitted commands and contains no candidate
application or production keys. `GET /verification` returns the exact Render
commit, gate and isolation observations. This is an engineering receipt, not
independent certification or a cryptographic attestation.

The controller accepts only the candidate's exact receipt, rechecks the mission
lease, cancellation/deadline and unchanged main, then fast-forwards main. It
waits for the same commit at production `/api/health`. Progress receipts persist
in the canonical Supabase memory table, scoped to the mission; the ordinary tool
ledger prevents replay after an uncertain external effect. No local state file
is used by this path. Reconciliation is required after uncertain operations.
There is no automatic rollback. Full source repair can take up to 35 minutes;
use a mission deadline that permits verification and deployment.

Infrastructure, verification scripts, tests, dependencies, security, governance,
the repair controller and tool routing are protected. Source paths must be
specified. Runtime incident detection does not yet create repair missions by
itself: the repair tool must be assigned a concrete bug. Provider limits, missing
credentials and approval waits are operational conditions, not source bugs.

## Vehicle catalog

Authenticated `GET /api/automotive/catalog?query=BMW` searches make names;
`?make=BMW&query=335` searches models for an exact make. Pages contain at most
100 entries; use returned `nextOffset`. The read-only mission tool
`search_vehicle_catalog` provides the same capability.

Administrator `POST /api/automotive/catalog/sync` fetches official vPIC makes,
upserts the existing `vector_makes`, and creates one durable acquisition job per
provider make ID. The existing fenced queue worker now starts with the main
server. One job runs at a time, with five seconds between successful jobs and
one minute after failures or idle reads. Database leases and retries survive
restarts; `AUTOMOTIVE_INGESTION_ENABLED=0` disables processing. Catalog sync can
refresh completed model jobs older than seven days. It is an explicit sync,
not a claimed scheduled refresh. `GET /catalog/status` reports actual queue
counts. Free Render service sleep pauses background work.

Model names have official source payloads and canonical content hashes. They
do not establish years, trim, engine or installed equipment. No synthetic
vehicle applications are inserted. Recall/complaint ingestion remains supported.

## Auto.dev

`GET /api/automotive/oem/build/:vin` is mounted behind the existing automotive
authentication boundary. Configure server-only `AUTO_DEV_API_KEY` with provider
access to OEM build data. The frontend has manual lookup controls for saved
profiles and VINs observed by the OBD bridge. It does not make paid lookups on
every OBD poll or silently rewrite confirmed vehicle records.

The gateway validates VIN format, refuses redirects, bounds response size and
time, disables shared caching, preserves 207, `build:null`, `catalog`, `missing`,
`reason` and `retryable`, passes through 429 and Retry-After, and hides credential
failures. Partial catalog options are displayed as possibilities rather than
installed equipment. Credentials never reach the browser. Results are not
automatically persisted or treated as independent physical verification.

The legacy resource monitor is explicitly labeled as a browser simulation;
its animated repair events are not backend repair evidence.
