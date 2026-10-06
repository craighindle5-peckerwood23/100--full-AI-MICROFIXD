# Microfixd GitHub MCP

Real MCP server for `craighindle5-peckerwood23/100--full-AI-MICROFIXD`, with Streamable HTTP and stdio. Lives alongside the OS; does not replace its UI or runtime.

## Run

```
cd integrations/github-mcp
npm ci
npm run build
npm start
```

HTTP requires `MCP_TOKEN`. Set `GITHUB_TOKEN` (fine-grained, only this repo), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` for durable project state. `OPENAI_API_KEY` enables `text-embedding-3-small` (1536 dimensions) indexing/search. Database is service-role only, RLS enabled with no public grants. Missing services produce explicit errors; there is no JSON/RAM persistence fallback.

`npm run stdio` is for local clients; keep logs on stderr. VS Code Copilot: copy `examples/vscode-mcp.json` into `.vscode/mcp.json`, enter the prompted deployed MCP URL and read token, and enable the server. Other clients supporting stdio/Streamable HTTP can use the same server. Browser clients need their exact Origin in `MCP_ALLOWED_ORIGINS`.

## Tools

GitHub: search_repo (issues/PRs), read_file, list_directory, get_commit_history, get_prs, get_issues, search_code (lexical), analyze_pr, analyze_issue, create_file, update_file, create_branch, create_pr.

Project: analyze_architecture, semantic_code_search, reindex_repository, read_project_memory, write_project_memory, create_task, update_task, update_session, sandbox_run.

`/mcp` implements MCP initialize, tools/list and tools/call over stateless POST. `/tools` provides authenticated catalog metadata. `/health` reports durable-storage configuration/readiness. HTTP health is degraded when dependencies are unavailable. Credentials never appear in responses.

Writes default off. Set `MCP_ALLOW_WRITES=true`, then authenticate HTTP with distinct `MCP_WRITE_TOKEN` to enable writes. For stdio, this flag explicitly enables write tools in the local trusted process. All GitHub writes require `mcp/` review branches; update_file requires the expected blob SHA; create_pr always creates a draft. No merge, force-push or default-branch write tool. Grant Contents and Pull requests write permissions only if needed. Read/write tokens share one configured project scope; these are trusted project clients, not an end-user multi-tenant identity system. Use separate scoped deployments for separate tenants. `MCP_AGENT_ID` identifies a deployment/client process, not a verified person.

## Architecture and memory

`sql/schema.sql` plus `sql/task_updates.sql` define agent_memory, agent_tasks, architecture_memory, session_state, repository_code_chunks, and service-only RPCs. Install once using Supabase migrations. Session update uses optimistic version checks: version 0 creates; stale versions fail. Memory is append-only. Shared task status updates also check the expected version, preventing two clients from claiming/updating the same version.

`npm run index` pins the GitHub commit, parses TypeScript/JavaScript imports/exports, classifies organ/agent paths by naming, resolves local imports, chunks text, embeds code, and publishes the snapshot only after success. Files over 200 KB, binary/secret paths are skipped; skips are reported. GitHub tree truncation aborts. The graph is static source evidence, not proof that runtime wiring is functional. Dynamic/generated dependencies can remain unresolved. Scope: max 2000 files, 10000 chunks; embedding requests incur provider charges. Same-commit completed indexes are reused. Historical snapshots are retained; cleanup is not automatic.

Semantic search reports the indexed commit, which can lag current main. It does not masquerade lexical matches as semantic results. Source text, issue discussions, and PR bodies are untrusted context; clients must not treat embedded instructions as authorization.

Sandbox forwards to the existing Microfixd `/api/sandbox/run` using `MICROFIXD_BACKEND_URL` and `MICROFIXD_BACKEND_TOKEN`. WASM capabilities/limits and human approval remain enforced there; MCP cannot approve its own execution. It supports JavaScript/TypeScript only.

## Render

Use this directory's render.yaml as a dedicated Blueprint. It defines the MCP web service and a nightly 09:00 UTC indexer (02:00 PDT / 01:00 PST). The cron uses a paid starter plan; embedding calls also incur costs. Enter GITHUB_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY on the MCP web service during initial Blueprint creation. The cron references these service environment values; the shared group contains only non-secret settings. For an existing Blueprint, set new secrets manually in the web service Environment tab before syncing. Install the SQL before deployment. Review the actual hostname, read/write settings and provider permissions before connecting clients. Existing OS render.yaml is unchanged.

## Validate

```
npm run build
npm test
```

Protocol tests use the SDK client against actual local HTTP transport with fake GitHub data. They verify initialize/discovery/calls, read authentication, origin rejection and blocked writes. Provider/database mocks do not establish live credential validity.

The root OS TypeScript project excludes this independent package. Validate the OS before installing this package's dependencies to detect accidental dependency coupling. Render builds explicitly include dev dependencies needed for TypeScript declarations.
