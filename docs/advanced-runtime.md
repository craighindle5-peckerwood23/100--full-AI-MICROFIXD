# Advanced runtime additions

These independently implemented additions reuse the existing mission executor, Supabase tenant filters, lease fencing, exact-action approvals and result ledger. Existing UI, automotive tools, native organs, local JavaScript/TypeScript WASM execution and memory APIs remain available.

## Versioned workflows

`save_workflow_skill` stores an append-only tenant definition with a SHA-256 revision. `list_workflow_skills` and authenticated `GET /api/planner/skills` discover definitions. The listing exposes a bounded history-window flag; direct revision lookup does not depend on that window. Old revisions remain executable by exact reference. A definition is never authorization.

Example definition:

```json
{"id":"inspect-page","description":"Inspect an authorized page","inputs":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"],"additionalProperties":false},"steps":[{"tool":"inspect_browser_page","arguments":{"url":{"$input":"url"}}}]}
```

Submit a mission with `objective`, `skill_id`, `skill_revision` (the complete hash returned by save), `skill_inputs`, `tool_permissions` and `browser_origins`. Do not also send `plan`. The server loads the tenant-owned pinned definition, binds whole typed values, validates tool schemas and compiles at most eight ordinary governed tasks. No textual code interpolation occurs. Each action still needs current permissions and its normal approval; retries and recovery use the existing ledger. The compiled plan and revision are retained in mission constraints for reproducibility.

## Specialists

Researcher, engineer and reviewer profiles have stable agent IDs, distinct instructions, restricted tool allowlists, four turns per profile per mission and 60/90-second reasoning-call deadlines. Generated plans select them with `input.specialist`; explicit plans can use IDs from capabilities. Their results use the existing durable agent result cache and artifact validation. Delegation is sequential within the mission, not an unbounded recursive swarm or parallel worker pool. Specialist output remains a model report. Reviewers cannot authorize actions.

Optional `MICROFIXD_RESEARCHER_PROVIDER`, `MICROFIXD_ENGINEER_PROVIDER` and `MICROFIXD_REVIEWER_PROVIDER` select an already configured `groq`, `gemini`, `openrouter` or `cloudflare` provider. Existing executor/supervisor settings retain their behavior. Cancellation propagates through provider requests; failed/aborted calls cannot fabricate success. Existing token reservations remain conservative on failure. Provider/model details are stored with actual result evidence.

## Browser workflows

`run_browser_workflow` takes an authorized HTTPS `url`, optional `mode: "dom"` and `workflow_json`, a JSON array of one to eight actions. Supported actions are `fill`, `click`, `press`, `select`, `wait` and `scroll`. Selectors are Playwright locators. Keys are a small explicit allowlist. Example:

```json
[{"action":"fill","selector":"#query","value":"repair case"},{"action":"click","selector":"button[type=submit]"},{"action":"wait","selector":"#results"}]
```

The entire action list is approval-bound. It runs in one browser context so form state survives between actions, then returns completion observations and a bounded accessibility tree. All requests retain the mission origin allowlist. Errors/uncertain effects require reconciliation; retries never blindly replay an uncertain workflow. Browser cleanup occurs in the existing governed `finally` block; action timeouts and a workflow timer bound work.

There are no cross-call browser sessions, pixel-coordinate actions, visual grounding, native desktop or ADB operators. Capability metadata reports those limits explicitly. Importing UI-TARS' Electron/native operator stack would not make a Render process able to control a user's desktop.

## Isolated coding and files

`run_isolated_code` uses the pinned official `@e2b/code-interpreter` SDK. It requires server-side `E2B_API_KEY`; missing configuration fails before claiming a tool run or creating an approval. It does not fall back to host execution. This provider can incur charges when configured and invoked.

Python, JavaScript, TypeScript and bash execute in a new sandbox per approved action, with a 120-second lifetime, 60-second code limit, no public inbound traffic and outbound Internet disabled unless `allow_network: true` is explicitly part of the approved request. No Microfixd environment variables or provider keys are forwarded to the code. Two simultaneous creations per server instance are allowed; this is not a global billing quota.

Optional `files_json` maps up to eight relative workspace paths to text. Optional `outputs_json` names up to eight output files. Workspace is `/home/user/microfixd` (Python/bash enter it; JS/TS can use the absolute path). Paths reject traversal. Inputs, logs and streamed outputs have bounded sizes. Output bytes, hashes and base64 contents become durable ordinary tool artifacts, retrievable with the existing artifact paging API. Package installation is possible through approved code when Internet is explicitly enabled. Execution errors are reported as observations, never replaced with synthetic success. Cleanup is awaited; uncertain teardown requires reconciliation and the provider TTL remains the backstop. There is no persistent sandbox reuse or automatic replay after an uncertain effect.

Provider-boundary tests verify configuration failure, network options, file paths, outputs and cleanup with a transport fixture. Actual paid cloud execution is unverified until a credential is configured and an approved production run is observed.

## Recovery and scheduling

Existing abandoned missions resume through expiring leases, durable task/artifact state and recorded tool results. Running tool effects without a completed result remain reconciliation-required. The worker now rotates its sequence cursor across queued/running missions so a fixed first batch of busy or repeatedly deferred missions cannot indefinitely exclude later missions. Database leases still enforce exclusive ownership across instances; the cursor is a fairness hint, not durable ownership state. This does not reconnect terminated browser or coding environments.

## Verification boundaries

Run `bash scripts/verify-production.sh` before committing. Real Chromium tests exercise accessible observation and a form workflow; fixture tests exercise skills, specialist limits and isolated-provider lifecycle. Deployment health verifies the exact released commit. Authenticated live skill/specialist/browser missions and an E2B execution need separate observed production results before claiming end-to-end live capability.
