# Holographic Interface Organ

HIO lives in `cognitive-shell/src/hio` and is hosted by the existing cognitive shell. It is a presentation organ: it cannot authorize or execute tools. Existing command authorization, tenant boundaries, durable memory, mission spine and speech playback remain the host's responsibility.

The bundled anatomical scan is Lee Perry-Smith / Infinite Realities, CC BY 3.0 (license and attribution beside the asset). Its original geometry has no facial rig. The renderer derives bounded jaw, smile and brow morph targets. These are limited deformations, not a full production facial capture rig.

`HIO` exposes `start`, `stop`, `dispose`, `ingest`, typed cognition/emotion/telemetry/audio ingestion, `setProfile`, `getStatus` and `onEvent`. One animation loop is owned by each HIO instance. Disposal cancels the loop, unsubscribes visibility and resize handlers and disposes graphics resources. Hidden documents pause rendering. WebGL/model failure leaves commands and speech available.

Audio frames identify the utterance and include playback time in milliseconds plus viseme cues (`atMs`, `durationMs`, `value`). Supported cues are sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O and U. Without timed cues, the current host supplies only a speaking-state indicator. The cockpit labels this `speaking-state`; it must not claim phoneme synchronization. Audio dropout closes the jaw.

Telemetry rates and packet loss use fractions [0,1], latency uses milliseconds or explicit `latencyNorm` against a 1000 ms reference. Values are bounded before rendering. Unknown confidence/policy remains unknown. Confidence only expresses a reported signal and never proves correctness. Reduced motion suppresses flicker, distortion, blinks and micro-motion. Visual error states never substitute for the textual runtime state.

The six visual boot stages run alongside bounded live `/api/health` and `/readyz` probes. Visual completion does not assert backend readiness. Degraded probes remain visible and the interface remains accessible.

Mission cards read the existing authenticated `/api/planner/missions` endpoint. No parallel mission registry or local persistence is introduced. Displayed counts are mission counts from at most the 50 most recent records, not estimated task counts or an invented on-track score.

The root Vite build deduplicates React/ReactDOM across the app and standalone shell. The shell library externalizes React entrypoints including JSX runtime and ReactDOM client. The production-browser test specifically verifies that the bundled head mounts, rather than accepting development rendering alone.

Verification for this change: the repository production gate passes 72 tests, typed classification/wiring validation, deterministic release evaluation and both production builds. `node tests/hio-ui.mjs` exercises the actual built bundle with controlled local API fixtures; these browser checks do not establish live backend capability. The fixture command verifies the unchanged authenticated command path. Graphics are rendered in software in the verification environment, so its FPS is not a target-device benchmark.
