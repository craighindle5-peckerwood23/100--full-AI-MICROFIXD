# Cognitive boundaries and crash recovery

The npm build and start lifecycles verify the SHA-256 digests in `governance/boundaries.json`. An unexpected change to a pinned file stops that invocation and names the file. During an intentional upgrade, review the implementation and the digest change together. This is a version-controlled drift check. A maintainer able to change the verifier and manifest remains a trust dependency.

Text-only brain responses are checked for common first-person completed-action claims before they enter brain memory. The command pipeline repeats the check before final delivery and persistence. A match returns an error and directs the operator to the mission record. This narrow filter can flag a quoted historical claim or miss a paraphrase. Mission evidence, tool permissions and approvals continue to govern execution. General factual accuracy requires independent evidence.

The cockpit ring reflects recent readiness observations. A successful readiness response must report durable storage to show ready. Readings expire after 45 seconds. Command errors display a review state. Reduced-motion mode keeps the ring still.

The final fallback is the standalone public recovery page at `/recovery.html`. A production cockpit visit on HTTPS or localhost installs a service worker that retains only this public file. On later cockpit navigations, a network failure, ten-second timeout or server 5xx opens recovery. An uncaught React rendering failure also opens it. Recovery has no execution controls, cached tenant records or automatic mission replay. Clear browser data, first visit during an outage, a disabled service worker or device loss can remove offline availability. Recovery instructions can also be opened directly from the pinned Git revision. Restore service and inspect the durable mission ledger before retrying an uncertain effect.

Run `npm run build` and `node tests/recovery-browser.mjs` to exercise the gate and the built application using a disposable local server.
