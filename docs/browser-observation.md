# Browser observation

UI-TARS desktop was reviewed for browser navigation, strategy validation, DOM/visual control, and paginated content extraction. Microfixd adopts the observation-before-action pattern through `inspect_browser_page`, using its existing Playwright runtime rather than adding Electron, native input automation, or another agent framework. This is an independent implementation, not copied UI-TARS source.

The governed tool opens an authorized HTTPS URL and returns Playwright’s accessibility tree with roles and accessible names, final URL, title, Unicode character count and explicit truncation at 16000 characters. Empty pages return an empty observation. Page text is untrusted data, never an instruction or authorization. No image-grounding model is implied.

The existing browser origin allowlist applies to navigation and subresources. The tool uses the existing exact-action approval receipt and durable result ledger; successful retries reuse the recorded result. A fresh browser context is always closed after each call, isolating tenants and credentials. The observation describes that call only: there is no persistent signed-in browser, stable element reference, desktop connector, or guaranteed later match. Existing click operations reopen the URL. Failures retain existing reconciliation behavior rather than inventing a successful observation.

Verification includes real Chromium accessibility extraction, Unicode truncation, registry discovery and governed permission classification. Production health proves the deployed revision, not an authenticated customer browser workflow.
