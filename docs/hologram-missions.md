# Hologram mission execution

The hologram defaults to durable task mode. Select the authorized tools and HTTPS browser origins under **Authorized tool scope**, then submit an objective. The existing authenticated planner endpoint derives the user and tenant server-side. Its idempotency key remains stable for a retry of the same failed submission during the mounted session.

The hologram polls persisted mission progress and displays pending approvals, final artifacts, and recorded failure codes. **Open mission** selects that exact mission in Mission Control, where existing exact-action approval, rejection, renewal, and reconciliation controls remain authoritative. **Ask a question** preserves the existing command response path.

Both command surfaces obtain the supported durable catalog from `/api/planner/tools`, which projects the planner allowlist through the existing registry. Tools outside that list are not advertised as durable capabilities. The public-page reader now resolves to the concrete crawl adapter rather than the generic organ fallback. GitHub credentials use server-side `GITHUB_TOKEN`; missing credentials block writes before starting the external-action ledger.

## Verification and limits

The production gate covers TypeScript, regression tests, classification, release evaluation, and bundling. `npm run test:hio-ui` covers the actual rendered hologram submission, authenticated request and idempotency header, approval display and decision, exact mission navigation, and final result display against HTTP fixtures. Adapter coverage verifies that every supported tool resolves to a concrete executor and that the real public reader rejects a forbidden URL.

HTTP fixtures do not prove a live Supabase worker, browser service, or provider account. Verify those in the intended deployment with authorized credentials. This patch does not install new integrations, add provider discovery, refresh public API catalogs, or configure a runtime model. Existing adapters and exact-action approvals determine actual execution authority. The chat tool loop remains separate; use durable task mode for external actions.


## System-wide discovery and SaaS

`GET /api/planner/capabilities` lists every registered organ with its concrete executor status and endpoints, and every registered tool with durable support and credential readiness. The chat mission tool `list_system_capabilities` returns the same catalog. `probe_system_organ` probes any registered non-isolated organ without claiming task capability. `invoke_system_organ` runs a native organ action through the durable exact-action approval and recovery ledger. Tenant/session payload fields are pinned server-side. Browser, crawling, GitHub, and sandbox paths require dedicated governed tools; the generic tool cannot bypass those paths. Descriptive organs without native adapters return `UNSUPPORTED_ORGAN_CAPABILITY`.

`/saas` is the public branded landing page, with console links and a local white-label preview using the existing build-time brand configuration. `/robots.txt` and `/sitemap.xml` advertise the landing page; `PUBLIC_SITE_URL` supplies its canonical origin. Search-engine discovery is supported; actual Google indexing is not guaranteed or submitted by this patch. No Google Search API or arbitrary SSH/MCP/server connector is provisioned. A server integration needs its specific protocol, endpoint, permissions and credentials. Existing public-page and scoped browser adapters remain available.
