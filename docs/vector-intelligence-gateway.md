# Vector cognitive gateway

POST /api/vector/intelligence is a stateless service-to-service endpoint, independent of the operator/admin tokens and generic organ execution surface.

Configure VECTOR_CONNECTOR_SECRET on Microfixd with at least 32 random characters. Configure the identical value as MICROFIXD_CONNECTOR_SECRET on the separate Vector deployment. Never reuse a database, operator, admin or customer session credential.

Contract version: vector.intelligence.v1. The strict Zod contract lives at server/integrations/vector/contracts.ts and is mirrored in the Vector repository's packages/microfixd-client/contracts.ts. Update and test both copies together.

The gateway accepts bounded normalized automotive context and supplied evidence IDs, calls the existing text-provider fallback, validates the response and its references, and returns provider/model/token/latency provenance. It has no tools, no memory retrieval/writes, no Vector database client and no hardware interface. Customer context is untrusted reference data.

An HTTP 200 is not a claim of factual accuracy, mechanical safety, physical validation or autonomous capability. Vector applies deterministic policy and human review to the advisory result. Malformed, truncated, unsupported-reference and provider-failure responses return a sanitized 503 without invented output.

Identical request IDs and bodies share an in-process result for five minutes; mismatched bodies return 409. This cache is bounded to 100 requests and is neither distributed nor durable idempotency. The provider deadline is 45 seconds. Vector must not retry uncertain inference POSTs automatically.

Tests use a deterministic model transport. Live configuration and a governed end-to-end Vector study remain deployment acceptance gates.
