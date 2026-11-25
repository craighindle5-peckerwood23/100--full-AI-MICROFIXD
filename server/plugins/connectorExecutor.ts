import { createHmac } from "node:crypto";
import { getConnector, getConnectorSecret } from "./pluginRegistry";
import type { ConnectorManifest, ConnectorTool } from "./types";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "169.254.169.254"]);

function isPrivateIpOrHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    return true;
  }
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return true;
  }
  if (host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) {
    return true;
  }
  return false;
}

export function safeConnectorUrl(baseUrl: string, toolPath = "/"): URL {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:") throw new Error("HTTPS required for connectors");
  if (base.username || base.password) throw new Error("Embedded URL credentials are not permitted");
  if (isPrivateIpOrHost(base.hostname)) throw new Error("Private/local connector hosts are blocked");
  const normalizedPath = toolPath.startsWith("/") ? toolPath : `/${toolPath}`;
  const url = new URL(normalizedPath, base);
  if (url.origin !== base.origin) throw new Error("Connector tool path cannot change origin");
  if (url.protocol !== "https:") throw new Error("HTTPS required");
  return url;
}

function interpolatePath(pathTemplate: string, argsObj: Record<string, unknown>): {
  resolvedPath: string;
  remainingArgs: Record<string, unknown>;
} {
  const consumed = new Set<string>();
  const resolvedPath = pathTemplate.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    if (argsObj[key] === undefined || argsObj[key] === null) {
      throw new Error(`Missing required path parameter '${key}'`);
    }
    consumed.add(key);
    return encodeURIComponent(String(argsObj[key]));
  });
  const remainingArgs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(argsObj)) {
    if (!consumed.has(k)) remainingArgs[k] = v;
  }
  return { resolvedPath, remainingArgs };
}

function buildAuthHeaders(
  manifest: ConnectorManifest,
  secret: string | undefined,
  rawBody: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: manifest.transport === "mcp-http" || manifest.transport === "mcp-sse"
      ? "application/json, text/event-stream"
      : "application/json",
    ...(manifest.defaultHeaders ?? {}),
  };

  if (manifest.auth.type === "none") return headers;
  if (!secret) {
    throw new Error(`Credential ${manifest.auth.env ?? "for connector"} is not configured`);
  }

  switch (manifest.auth.type) {
    case "bearer":
    case "oauth2-bearer":
      headers.authorization = `Bearer ${secret}`;
      break;
    case "basic": {
      const encoded = secret.includes(":") ? Buffer.from(secret).toString("base64") : secret;
      headers.authorization = `Basic ${encoded}`;
      break;
    }
    case "api-key": {
      const hdr = manifest.auth.header || "x-api-key";
      headers[hdr] = manifest.auth.prefix ? `${manifest.auth.prefix} ${secret}` : secret;
      break;
    }
    case "hmac-sha256": {
      const hdr = manifest.auth.header || "x-microfixd-signature-256";
      const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
      headers[hdr] = `sha256=${digest}`;
      break;
    }
  }
  return headers;
}

function parseMaybeSseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("event:") || trimmed.includes("\ndata:")) {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    const last = dataLines.at(-1);
    if (last) {
      try {
        return JSON.parse(last);
      } catch {
        return last;
      }
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export async function discoverRemoteMcpTools(params: {
  baseUrl: string;
  auth?: ConnectorManifest["auth"];
  secret?: string;
}): Promise<{ serverInfo?: Record<string, unknown>; tools: ConnectorTool[] }> {
  const endpoint = safeConnectorUrl(params.baseUrl, "/");
  const authCfg: ConnectorManifest["auth"] = params.auth ?? { type: "none" };
  const tempManifest: ConnectorManifest = {
    id: "discovery",
    name: "discovery",
    version: "1.0.0",
    transport: "mcp-http",
    baseUrl: params.baseUrl,
    auth: authCfg,
    tools: [{ name: "discover", path: "/" }],
  };

  const callRpc = async (method: string, rpcParams: Record<string, unknown>, id: number) => {
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params: rpcParams });
    const headers = buildAuthHeaders(tempManifest, params.secret, body);
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const parsed = parseMaybeSseJson(text) as Record<string, any> | string | null;
    if (!res.ok) {
      throw new Error(`Remote MCP HTTP ${res.status}: ${typeof parsed === "string" ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200)}`);
    }
    if (parsed && typeof parsed === "object" && parsed.error) {
      throw new Error(`MCP JSON-RPC error: ${String(parsed.error.message || JSON.stringify(parsed.error))}`);
    }
    return parsed && typeof parsed === "object" && "result" in parsed ? parsed.result : parsed;
  };

  const initResult = await callRpc(
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "Microfixd", version: "1.1.1" },
    },
    1,
  ).catch(() => ({}));

  const listResult = (await callRpc("tools/list", {}, 2)) as { tools?: Array<Record<string, any>> };
  const rawTools = Array.isArray(listResult?.tools) ? listResult.tools : [];
  if (rawTools.length === 0) {
    throw new Error("Remote MCP server returned zero tools from tools/list");
  }

  const tools: ConnectorTool[] = rawTools.slice(0, 64).map((t) => {
    const name = String(t.name || "unnamed_tool").replace(/[^a-zA-Z0-9_.:-]/g, "_");
    const isReadOnly = /^(get|list|read|search|query|fetch|find|describe|inspect|status)/i.test(name);
    return {
      name,
      description: typeof t.description === "string" ? t.description : undefined,
      method: "POST",
      path: "/",
      risk: isReadOnly ? "read" : "write",
      inputSchema: t.inputSchema && typeof t.inputSchema === "object" ? (t.inputSchema as Record<string, unknown>) : undefined,
    };
  });

  return {
    serverInfo: initResult && typeof initResult === "object" ? (initResult as Record<string, unknown>) : undefined,
    tools,
  };
}

export async function executeConnectorTool(
  connectorId: string,
  toolName: string,
  args: unknown,
  tenantId = "default",
) {
  const connector = getConnector(connectorId, tenantId);
  if (!connector || !connector.enabled) throw new Error("Connector not installed or disabled");
  const tool = connector.manifest.tools.find((t) => t.name === toolName);
  if (!tool) throw new Error("Tool not found");

  const argsObj = args && typeof args === "object" && !Array.isArray(args)
    ? ({ ...(args as Record<string, unknown>) })
    : {};

  const secret = getConnectorSecret(connector, tenantId);
  const { resolvedPath, remainingArgs } = interpolatePath(tool.path, argsObj);
  const url = safeConnectorUrl(connector.manifest.baseUrl, resolvedPath);
  const transport = connector.manifest.transport;

  let method = tool.method || "POST";
  let rawBody = "";

  if (transport === "mcp-http" || transport === "mcp-sse") {
    method = "POST";
    rawBody = JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: toolName === "tools_list" ? "tools/list" : "tools/call",
      params: toolName === "tools_list" ? {} : { name: toolName, arguments: remainingArgs },
    });
  } else if (transport === "graphql") {
    method = "POST";
    const query = typeof remainingArgs.query === "string" ? remainingArgs.query : "";
    if (!query.trim()) throw new Error("GraphQL connector calls require a 'query' string");
    rawBody = JSON.stringify({
      query,
      variables: remainingArgs.variables ?? {},
      ...(typeof remainingArgs.operationName === "string" ? { operationName: remainingArgs.operationName } : {}),
    });
  } else if (method === "GET" || method === "DELETE") {
    for (const [k, v] of Object.entries(remainingArgs)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
      }
    }
  } else {
    rawBody = JSON.stringify(remainingArgs);
  }

  const headers = buildAuthHeaders(connector.manifest, secret, rawBody);
  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30_000),
    ...(method !== "GET" && method !== "DELETE" ? { body: rawBody } : {}),
  };

  const response = await fetch(url, init);
  const text = await response.text();
  const data = parseMaybeSseJson(text);

  if (!response.ok) {
    throw new Error(
      `Connector HTTP ${response.status}: ${typeof data === "string" ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`,
    );
  }

  if (
    transport === "graphql" &&
    data &&
    typeof data === "object" &&
    Array.isArray((data as Record<string, unknown>).errors) &&
    ((data as Record<string, unknown>).errors as unknown[]).length > 0
  ) {
    throw new Error(`GraphQL error: ${JSON.stringify((data as Record<string, unknown>).errors).slice(0, 300)}`);
  }

  if (
    (transport === "mcp-http" || transport === "mcp-sse") &&
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).error
  ) {
    throw new Error(`MCP error: ${JSON.stringify((data as Record<string, unknown>).error).slice(0, 300)}`);
  }

  return {
    connector: connectorId,
    transport,
    tool: toolName,
    status: response.status,
    data:
      (transport === "mcp-http" || transport === "mcp-sse") &&
      data &&
      typeof data === "object" &&
      "result" in (data as Record<string, unknown>)
        ? (data as Record<string, unknown>).result
        : data,
  };
}
