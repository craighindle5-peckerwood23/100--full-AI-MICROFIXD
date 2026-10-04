# Response and playback completion

`BRAIN_MAX_TOKENS=10000` and `RESPONSE_MAX_TOKENS=10000` are the default maximum output budgets. Both accept 1–16384 tokens. This permits longer explanations without requiring every answer to use the entire budget. Provider rate limits and the configured model's capabilities still apply. A length-limited answer is reported incomplete.

Command requests use complete JSON responses, not SSE token streams. The client waits for the full HTTP body before dispatching speech. Browser/ElevenLabs playback is sequential in chunks of at most 700 characters. Each chunk requires its actual playback end event; errors, Stop, unavailable audio and a 120-second per-chunk timeout reject playback. The two UI voice entry points now use the same queue. Microphone echo during generation/playback does not interrupt the active explanation; explicit Stop still cancels it.

For spoken requests (`source: "voice"` or `context.output_mode: "spoken"`), the backend persists the answer and emits `response_complete` with `response_id`, returning `delivery_state: "awaiting_playback"`. It does not emit successful command/mission completion until the authenticated client posts `/api/command/output/ack` with `{response_id, session_id, status: "played"}` after all chunks end. `failed` and `cancelled` remain incomplete. Acknowledgments are stored in Supabase and successful retries reuse a deterministic record ID. Event consumers should deduplicate by `event_id`/`response_id`. Client playback acknowledgment is a report from the authenticated browser; it cannot prove that a person heard the speaker.

A closed browser leaves the persisted response awaiting playback. A caller can retry speech from the retained answer and acknowledge the same response ID. Text-only commands finish after verification and persistence; they do not require audio. These delivery events describe command response completion, not proof of arbitrary task success.

# Callable memory window

`MemoryOrgan.context(limit, max_chars, query?, session_id?)` calls the authenticated memory executor. Direct API:

```json
POST /api/organs/memory/execute
{"action":"context","payload":{"session_id":"your-session","limit":30,"max_chars":60000}}
```

For command-specific retrieval:

```json
POST /api/command/run
{"task":"Explain the previous repair","session_id":"your-session","context":{"retrieval":{"limit":50,"max_chars":80000},"output_mode":"spoken"}}
```

Defaults are `MEMORY_RETRIEVAL_LIMIT=30` and `MEMORY_CONTEXT_MAX_CHARS=60000`. Supported bounds are 1–100 records and 1000–100000 characters. The window preserves whole records rather than cutting each record at 4000 characters. It reports requested/returned counts, used character budget and omitted records. Session scoping is enforced in retrieval, and playback audit records do not enter reasoning context. Retrieved evidence is used in inference but is not recursively persisted inside brain messages. There is no local memory fallback.

Automated tests cover delayed/broken HTTP bodies, ordered speech chunks, cancellation/errors, durable completion acknowledgment, session mismatches, acknowledgment retries, retrieval exclusions and repeated requests. Speech end/error events are controlled in tests; audible playback on the deployed device remains a manual check. Live Groq/Supabase application calls remain deployment checks; integration tests mock these services.
