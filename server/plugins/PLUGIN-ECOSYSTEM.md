# Microfixd plugin + asset ecosystem

The gateway separates **connectors** (remote service integrations) from **assets** (things organs can reason over or operate).

Supported domain vocabulary:
- service
- data
- knowledge
- compute
- model
- workflow
- security
- monitoring
- simulation

The registry is intentionally capability-based. An asset declares only capabilities its executor actually implements. No folder name is treated as proof of a working integration.

## Canonical server layout

```
server/plugins/
  pluginRegistry.ts
  pluginRouter.ts
  connectorExecutor.ts
  types.ts
  assetTypes.ts
  assetRouter.ts
  assetApiRouter.ts
  providers/        # provider adapters as implemented
```

Provider folders are added only with real implementations and tests. OAuth tokens/API secrets stay server-side. Consequential/write operations require governance approval.

This avoids hundreds of empty scaffold files falsely advertising capabilities while retaining the drop-in plugin architecture.
