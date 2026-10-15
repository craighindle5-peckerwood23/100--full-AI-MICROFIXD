# Microfixd Enterprise Plugin Gateway

Connectors are installed from a small manifest and credentials remain server-side in environment variables.

## Manifest

```json
{
  "id": "example",
  "name": "Example",
  "version": "1.0.0",
  "transport": "http",
  "baseUrl": "https://api.example.com",
  "auth": { "type": "bearer", "env": "EXAMPLE_API_KEY" },
  "tools": [
    { "name": "search", "method": "POST", "path": "/v1/search", "risk": "read" },
    { "name": "update", "method": "POST", "path": "/v1/update", "risk": "write" }
  ]
}
```

Install through `POST /api/plugins/install`, enable through `POST /api/plugins/:id/enable`, and call through `POST /api/plugins/:id/call/:tool`.

Security controls: authenticated Microfixd RBAC, HTTPS-only remote origins, local/private target blocking, server-side environment credentials, 30-second request timeout, disabled-by-default connectors, and HITL gates for write/consequential tools.

Provider OAuth flows and provider-specific schemas remain separate adapters; this gateway is the common execution surface.
