import { Router } from "express";
import { discoverRemoteMcpTools, executeConnectorTool } from "./connectorExecutor";
import {
  CONNECTOR_TEMPLATES,
  getConnector,
  hasConnectorSecret,
  installConnector,
  listConnectors,
  removeConnector,
  setConnectorEnabled,
  setConnectorSecret,
} from "./pluginRegistry";
import { trigger } from "../hitl/hitlManager";

export const pluginRouter = Router();

pluginRouter.get("/", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  res.json({
    connectors: listConnectors(tenantId).map((c) => ({
      id: c.manifest.id,
      name: c.manifest.name,
      version: c.manifest.version,
      transport: c.manifest.transport,
      category: c.manifest.category ?? "custom",
      baseUrl: c.manifest.baseUrl,
      enabled: c.enabled,
      authType: c.manifest.auth.type,
      credentialConfigured: hasConnectorSecret(c, tenantId),
      tools: c.manifest.tools.map((t) => ({
        name: t.name,
        description: t.description,
        method: t.method ?? "POST",
        path: t.path,
        risk: t.risk ?? "read",
        inputSchema: t.inputSchema,
      })),
    })),
  });
});

pluginRouter.get("/templates", (_req, res) => {
  res.json({ templates: CONNECTOR_TEMPLATES });
});

pluginRouter.post("/discover-mcp", async (req, res) => {
  const baseUrl = typeof req.body?.baseUrl === "string" ? req.body.baseUrl.trim() : "";
  if (!baseUrl) {
    return res.status(400).json({ code: "INVALID_MCP_URL", error: "HTTPS baseUrl is required" });
  }
  try {
    const auth = req.body?.auth && typeof req.body.auth === "object" ? req.body.auth : { type: "none" };
    const envSecret = undefined;
    const secret = typeof req.body?.secret === "string" && req.body.secret.trim() ? req.body.secret.trim() : envSecret;
    const discovered = await discoverRemoteMcpTools({ baseUrl, auth, secret });
    return res.json({ success: true, ...discovered });
  } catch (error) {
    return res.status(502).json({
      success: false,
      code: "MCP_DISCOVERY_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

pluginRouter.post("/install", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  try {
    const { secret, autoEnable, ...manifestPayload } = (req.body ?? {}) as Record<string, unknown>;
    const record = installConnector(manifestPayload, {
      tenantId,
      secret: typeof secret === "string" ? secret : undefined,
      enabled: Boolean(autoEnable),
    });
    res.status(201).json({
      id: record.manifest.id,
      name: record.manifest.name,
      transport: record.manifest.transport,
      enabled: record.enabled,
      credentialConfigured: hasConnectorSecret(record, tenantId),
      tools: record.manifest.tools,
      installedAt: record.installedAt,
    });
  } catch (error) {
    res.status(400).json({ code: "INVALID_CONNECTOR_MANIFEST", error: String(error) });
  }
});

pluginRouter.post("/:id/secret", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const connector = getConnector(req.params.id, tenantId);
  if (!connector) return res.status(404).json({ code: "CONNECTOR_NOT_FOUND" });
  const secret = typeof req.body?.secret === "string" ? req.body.secret : "";
  if (!secret.trim()) return res.status(400).json({ code: "INVALID_SECRET" });
  setConnectorSecret(req.params.id, secret, tenantId);
  return res.json({ success: true, id: req.params.id, credentialConfigured: hasConnectorSecret(connector, tenantId) });
});

pluginRouter.post("/:id/enable", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const item = setConnectorEnabled(req.params.id, Boolean(req.body?.enabled), tenantId);
  if (!item) return res.status(404).json({ code: "CONNECTOR_NOT_FOUND" });
  res.json({ id: item.manifest.id, enabled: item.enabled });
});

pluginRouter.delete("/:id", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const deleted = removeConnector(req.params.id, tenantId);
  if (!deleted) return res.status(404).json({ code: "CONNECTOR_NOT_FOUND" });
  return res.json({ success: true, id: req.params.id });
});

pluginRouter.post("/:id/call/:tool", async (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const connector = getConnector(req.params.id, tenantId);
  const tool = connector?.manifest.tools.find((t) => t.name === req.params.tool);
  if (!connector || !tool) return res.status(404).json({ code: "CONNECTOR_TOOL_NOT_FOUND" });

  if (tool.risk && tool.risk !== "read") {
    const review = trigger(
      `${tenantId}:plugin-gateway`,
      {
        name: `Connector action: ${connector.manifest.name}/${tool.name}`,
        type: "connector_action",
        connector_id: connector.manifest.id,
        tool: tool.name,
        risk: tool.risk,
      },
      "connector_approval",
    );
    return res.status(202).json({ code: "HITL_REQUIRED", approval_id: review.hitl_id });
  }

  try {
    res.json({
      success: true,
      result: await executeConnectorTool(req.params.id, req.params.tool, req.body?.arguments, tenantId),
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      code: "CONNECTOR_EXECUTION_FAILED",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
