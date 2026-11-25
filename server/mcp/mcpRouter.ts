/**
 * server/mcp/mcpRouter.ts
 * MCP (Model Context Protocol) unified gateway router.
 * Exposes Microfixd tools + connected app/MCP connectors as JSON-RPC 2.0 & REST,
 * and supports discovering & proxying external HTTPS MCP servers.
 */
import { Router } from "express";
import { browserManager } from "../playwright/browserManager";
import { runCode } from "../sandbox/codeRunner";
import { getPending, trigger } from "../hitl/hitlManager";
import { TOOL_REGISTRY } from "../tools/toolRegistry";
import { getExecutor } from "../organs/executors";
import { liveCapabilityLedger } from "../runtime/liveCapabilities";
import { discoverRemoteMcpTools, executeConnectorTool } from "../plugins/connectorExecutor";
import { getConnector, installConnector, listConnectors } from "../plugins/pluginRegistry";

export const mcpRouter = Router();

const CORE_MCP_TOOLS = [
  { name: "playwright_navigate", description: "Navigate browser to URL", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "playwright_scrape", description: "Navigate + return page text", inputSchema: { type: "object", properties: { url: { type: "string" }, selector: { type: "string" } }, required: ["url"] } },
  { name: "playwright_screenshot", description: "Take browser screenshot (base64 JPEG)", inputSchema: { type: "object", properties: {} } },
  { name: "playwright_click", description: "Click element by CSS selector", inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] } },
  { name: "sandbox_run", description: "Execute code in sandbox (TS/JS/Python)", inputSchema: { type: "object", properties: { code: { type: "string" }, lang: { type: "string" } }, required: ["code"] } },
  { name: "hitl_pending", description: "Get list of pending HITL reviews", inputSchema: { type: "object", properties: {} } },
  { name: "system_health", description: "Get system health and live capability posture", inputSchema: { type: "object", properties: {} } },
];

function buildAllMcpTools(tenantId: string) {
  const coreNames = new Set(CORE_MCP_TOOLS.map((t) => t.name));
  const governed = TOOL_REGISTRY
    .filter((t) => !coreNames.has(t.name) && t.organ !== "system_catalog")
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.parameters,
    }));

  const connectorTools = listConnectors(tenantId)
    .filter((c) => c.enabled)
    .flatMap((c) =>
      c.manifest.tools.map((t) => ({
        name: `app.${c.manifest.id}.${t.name}`,
        description: `[${c.manifest.name}] ${t.description ?? t.name}`,
        inputSchema: t.inputSchema ?? { type: "object", properties: {} },
        connectorId: c.manifest.id,
        connectorTool: t.name,
        risk: t.risk ?? "read",
      })),
    );

  return [...CORE_MCP_TOOLS, ...governed, ...connectorTools];
}

async function invokeMcpTool(
  toolName: string,
  args: Record<string, unknown>,
  tenantId: string,
): Promise<{ statusCode: number; result: unknown }> {
  switch (toolName) {
    case "playwright_navigate":
      return { statusCode: 200, result: await browserManager.navigate(String(args.url ?? "")) };
    case "playwright_scrape":
      return { statusCode: 200, result: await browserManager.scrape(String(args.url ?? ""), args.selector ? String(args.selector) : undefined) };
    case "playwright_screenshot":
      return { statusCode: 200, result: { screenshot: await browserManager.screenshot() } };
    case "playwright_click":
      return { statusCode: 200, result: await browserManager.click(String(args.selector ?? "")) };
    case "sandbox_run":
      return {
        statusCode: 200,
        result: await runCode(
          String(args.code ?? ""),
          (args.lang as "typescript" | "javascript" | "python") ?? "typescript",
          String(args.session_id ?? "mcp"),
          args.approval_id ? String(args.approval_id) : undefined,
        ),
      };
    case "hitl_pending":
      return { statusCode: 200, result: { records: getPending().filter(item => item.session_id.startsWith(`${tenantId}:`)) } };
    case "system_health": {
      const snap = liveCapabilityLedger.getSnapshot();
      return {
        statusCode: 200,
        result: {
          status: snap.counts.unavailable > 0 ? "degraded" : "nominal",
          capabilities: snap.counts,
          ts: new Date().toISOString(),
        },
      };
    }
  }

  // Dynamic connector tool invocation: app.<connectorId>.<toolName>
  if (toolName.startsWith("app.")) {
    const rest = toolName.slice(4);
    const dot = rest.indexOf(".");
    if (dot > 0) {
      const connectorId = rest.slice(0, dot);
      const subTool = rest.slice(dot + 1);
      const connector = getConnector(connectorId, tenantId);
      const toolDef = connector?.manifest.tools.find((t) => t.name === subTool);
      if (!connector || !toolDef) {
        return { statusCode: 404, result: { error: `Connector tool '${toolName}' not found.` } };
      }
      if (toolDef.risk && toolDef.risk !== "read") {
        const review = trigger(
          `${tenantId}:mcp`,
          {
            name: `MCP Connector action: ${connector.manifest.name}/${toolDef.name}`,
            type: "connector_action",
            connector_id: connector.manifest.id,
            tool: toolDef.name,
            risk: toolDef.risk,
          },
          "mcp_connector_approval",
        );
        return { statusCode: 202, result: { approval_required: true, approval_id: review.hitl_id } };
      }
      return { statusCode: 200, result: await executeConnectorTool(connectorId, subTool, args, tenantId) };
    }
  }

  // Governed organ-backed tools from TOOL_REGISTRY
  const regTool = TOOL_REGISTRY.find((t) => t.name === toolName);
  if (regTool && regTool.organ !== "system_catalog") {
    return { statusCode: 409, result: { error: "Use the governed mission endpoint", endpoint: "/api/planner/missions" } };
  }

  return { statusCode: 404, result: { error: `Tool '${toolName}' not found.` } };
}

mcpRouter.get("/tools", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  res.json({ tools: buildAllMcpTools(tenantId) });
});

mcpRouter.post("/call", async (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const { tool_name, arguments: args = {} } = req.body ?? {};
  if (!tool_name) return res.status(400).json({ error: "tool_name required" });

  try {
    const { statusCode, result } = await invokeMcpTool(
      String(tool_name),
      args && typeof args === "object" ? (args as Record<string, unknown>) : {},
      tenantId,
    );
    if (statusCode === 404) {
      return res.status(404).json(result);
    }
    return res.status(statusCode === 202 ? 200 : statusCode).json({
      success: !(result && typeof result === "object" && "success" in result && (result as any).success === false) &&
        !(result && typeof result === "object" && (result as any).approval_required === true),
      result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// Standard JSON-RPC 2.0 MCP Server endpoint (initialize, tools/list, tools/call, resources/list, resources/read)
mcpRouter.post("/rpc", async (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
  const id = (body.id as string | number | null) ?? null;
  const method = typeof body.method === "string" ? body.method : "";
  const params = (body.params && typeof body.params === "object"
    ? (body.params as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const ok = (result: unknown) => res.json({ jsonrpc: "2.0", id, result });
  const rpcErr = (code: number, message: string) => res.json({ jsonrpc: "2.0", id, error: { code, message } });

  try {
    switch (method) {
      case "ping":
        return ok({});
      case "initialize":
        return ok({
          protocolVersion: "2024-11-05",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "Microfixd-MCP", version: "1.1.1" },
        });
      case "tools/list":
        return ok({ tools: buildAllMcpTools(tenantId) });
      case "tools/call": {
        const name = typeof params.name === "string" ? params.name : "";
        if (!name) return rpcErr(-32602, "params.name required");
        const toolArgs = params.arguments && typeof params.arguments === "object"
          ? (params.arguments as Record<string, unknown>)
          : {};
        const { statusCode, result } = await invokeMcpTool(name, toolArgs, tenantId);
        if (statusCode === 404) return rpcErr(-32601, `Unknown tool '${name}'`);
        return ok({
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: statusCode >= 400,
        });
      }
      case "resources/list":
        return ok({
          resources: [
            { uri: "microfixd://system/health", name: "System Health", mimeType: "application/json" },
            { uri: "microfixd://system/capabilities", name: "Live Runtime Capabilities", mimeType: "application/json" },
            { uri: "microfixd://hitl/pending", name: "HITL Queue", mimeType: "application/json" },
            { uri: "microfixd://connectors/installed", name: "Installed App & MCP Connectors", mimeType: "application/json" },
          ],
        });
      case "resources/read": {
        const uri = typeof params.uri === "string" ? params.uri : "";
        let payload: unknown;
        if (uri === "microfixd://system/health") {
          payload = { status: "nominal", ts: new Date().toISOString() };
        } else if (uri === "microfixd://system/capabilities") {
          payload = liveCapabilityLedger.getSnapshot();
        } else if (uri === "microfixd://hitl/pending") {
          payload = { records: getPending().filter(item => item.session_id.startsWith(`${tenantId}:`)) };
        } else if (uri === "microfixd://connectors/installed") {
          payload = { connectors: listConnectors(tenantId).map((c) => ({ id: c.manifest.id, name: c.manifest.name, enabled: c.enabled, tools: c.manifest.tools })) };
        } else {
          return rpcErr(-32602, `Unknown resource URI '${uri}'`);
        }
        return ok({ contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload) }] });
      }
      default:
        return rpcErr(-32601, `Method '${method}' not found`);
    }
  } catch (err) {
    return rpcErr(-32603, err instanceof Error ? err.message : String(err));
  }
});

// Discover & optionally register any remote HTTPS MCP server
mcpRouter.post("/servers/discover", async (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  const baseUrl = typeof req.body?.baseUrl === "string" ? req.body.baseUrl.trim() : "";
  if (!baseUrl) return res.status(400).json({ error: "HTTPS baseUrl required" });

  try {
    const auth = req.body?.auth && typeof req.body.auth === "object" ? req.body.auth : { type: "none" };
    const secret = typeof req.body?.secret === "string" && req.body.secret.trim()
      ? req.body.secret.trim()
      : undefined;

    const discovered = await discoverRemoteMcpTools({ baseUrl, auth, secret });

    let installedRecord = null;
    if (req.body?.install) {
      const id = String(req.body?.id || new URL(baseUrl).hostname.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase());
      const name = String(req.body?.name || discovered.serverInfo?.serverInfo?.toString() || id);
      installedRecord = installConnector(
        {
          id,
          name,
          version: "1.0.0",
          transport: "mcp-http",
          category: "mcp",
          baseUrl,
          auth,
          tools: discovered.tools,
        },
        { tenantId, secret, enabled: req.body?.autoEnable !== false },
      );
    }

    return res.json({
      success: true,
      serverInfo: discovered.serverInfo,
      tools: discovered.tools,
      installed: installedRecord ? { id: installedRecord.manifest.id, enabled: installedRecord.enabled } : null,
    });
  } catch (err) {
    return res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

mcpRouter.get("/resources", (req, res) => {
  const tenantId = (req as any).microfixdTenantId ?? "default";
  res.json({
    resources: [
      { uri: "microfixd://system/health", name: "System Health", mimeType: "application/json" },
      { uri: "microfixd://system/capabilities", name: "Live Runtime Capabilities", mimeType: "application/json" },
      { uri: "microfixd://hitl/pending", name: "HITL Queue", mimeType: "application/json" },
      { uri: "microfixd://connectors/installed", name: "Installed App & MCP Connectors", mimeType: "application/json", count: listConnectors(tenantId).length },
    ],
  });
});
