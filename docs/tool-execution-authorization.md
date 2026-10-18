# Tool execution and owner authorization

Authenticated admin missions now default to standing authorization. Each exact tool request receives an approval receipt naming the owner, request hash, and decision time before the existing database start contract consumes it. Rejections, consumed receipts, tenant checks, lease fencing, and uncertain-run reconciliation remain enforced. Previously paused missions keep their original constraints; create a new mission to use the new default.

Operator and system accounts retain manual approval for protected actions. Client-supplied approval actors cannot elevate these accounts. An admin can request `tool_approval_mode: "manual"` when submitting a mission. Missing tool permissions default to the full registered catalog; an explicit empty array still means reasoning only. Both mission interfaces select all tools initially.

All 19 catalog tools now enter durable execution. Screenshot and click schemas include the page URL required by the worker. Browser origins are derived from explicit HTTPS URLs in admin objectives or exact tool arguments when no nonempty origin scope is supplied. Arbitrary destinations remain disallowed; include the target URL in the mission. Crawls use the same isolated browser and origin filter, with a maximum depth of 2 and 10 pages. Memory tools use a stable tenant namespace and database tenant filter, permitting later missions to recall stored records.

Legacy ToolsApi submissions include an Idempotency-Key; callers can pass a stable key for retries. Capability listing and probes now receive automatic read-only receipts because the database's older read allowlist requires receipts for these names.

This change does not supply missing credentials, implement every descriptive organ, authenticate third-party accounts, or make the local oversight kill flag terminate independent processes. GitHub writes still require GITHUB_TOKEN; memory and all missions require configured durable Supabase storage. Owner access requires the ADMIN_TOKEN or a verified account with the admin role. No database migration is required: the existing approval receipt and tool-start contract are reused.
