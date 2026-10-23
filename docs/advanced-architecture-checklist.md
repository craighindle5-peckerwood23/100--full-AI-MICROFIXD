# Advanced architecture integration checklist

Preserve Microfixd's UI scene graph, automotive/OBD tools, memory, tenant isolation, durable mission executor and exact-action approvals. This checklist is an implementation record, not evidence that unchecked capabilities work.

## Already released

- [x] Structured knowledge and historical procedure recall (Kraken patterns).
- [x] Bounded context with explicit omissions and retained originals.
- [x] Durable mission notes, artifact paging and mission history search (DeerFlow patterns).
- [x] Continuation loop detection based on actual tool arguments.
- [x] Governed DOM accessibility observation (UI-TARS pattern): local real Chromium test passed; published revision `a07a75387c4c5538cf0fc2c2310ef3a3eeefbffb`.
- [x] Confirm browser-observation revision's Render deployment.

## Current integration

- [x] Versioned tenant-scoped workflow skill catalog and deterministic compilation into existing governed tasks.
- [x] Specialist research, engineering and review profiles with restricted tools, turn budgets and provider selection.
- [x] Bounded same-context browser workflows with typed DOM actions, post-action observations and failure reporting.
- [x] Browser strategy capability validation; unsupported visual/desktop control fails explicitly.
- [x] Isolated Python/JavaScript and shell execution with bounded file artifacts through an external sandbox provider.
- [x] Recoverability and worker scheduling improvements; preserve lease fencing and prevent uncertain-effect replay.
- [x] Focused regressions for permissions, tenant scope, failures, budgets and retry behavior.
- [x] Full production gate before committing: 145 tests, type checks, 60 typed objects/46 organ routes, release evaluation and both production builds passed. Another 27 engineering/adapter tests passed.
- [ ] Publish exact tested tree using a compare-and-set branch update.
- [ ] Verify final Render commit, HTTP health and applicable API behavior.

## External dependencies and scope

- External coding sandboxes require a configured provider credential and may incur provider charges. Do not create a paid resource or claim live execution without configuration and verification.
- Native desktop/ADB/nut-js control needs an explicitly connected local operator. Do not install Electron into the web service or claim cloud access to a user's desktop.
- Vision grounding needs a compatible configured model and observed screenshot evidence. Do not silently substitute coordinates or pretend unsupported vision is available.
- Existing deployment domain `microfixd.com` has a separate DNS issue; the working service URL is https://microfixd-full-ai.onrender.com.
- GitHub Actions has an account billing lock; local required gates and Render deployment must be reported separately.

## Advanced feature boundaries

- [ ] Configure an E2B credential and verify an approved live isolated run (adapter implemented; local provider-fixture tests passed).
- [ ] Persistent cross-call browser/sandbox sessions (deferred; workflows retain state only within one approved call).
- [ ] Vision-model grounding and native desktop connector (external operator/model required; explicitly unavailable).
- [ ] Observe authenticated live workflows and specialist missions; health alone is not this proof.

See [advanced-runtime.md](advanced-runtime.md) for APIs, formats, limits and verification boundaries.
