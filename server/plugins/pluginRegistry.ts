import { z } from "zod";
import type { ConnectorManifest, ConnectorTemplate, InstalledConnector } from "./types";

const ToolSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_.:-]+$/),
  description: z.string().optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
  path: z.string().min(1),
  risk: z.enum(["read", "write", "consequential"]).default("read"),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
});

const ManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  name: z.string().min(1),
  version: z.string().min(1).default("1.0.0"),
  transport: z.enum(["http", "rest", "mcp-http", "mcp-sse", "graphql", "webhook"]),
  category: z
    .enum([
      "mcp",
      "productivity",
      "developer",
      "messaging",
      "payments",
      "database",
      "automation",
      "automotive",
      "ai",
      "custom",
    ])
    .optional(),
  baseUrl: z.string().url().refine((v) => v.startsWith("https://"), "HTTPS required"),
  docsUrl: z.string().url().optional(),
  defaultHeaders: z.record(z.string(), z.string()).optional(),
  auth: z.object({
    type: z.enum(["bearer", "api-key", "basic", "oauth2-bearer", "hmac-sha256", "none"]),
    env: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
    header: z.string().optional(),
    prefix: z.string().optional(),
  }),
  tools: z.array(ToolSchema).min(1),
});

export const CONNECTOR_TEMPLATES: ConnectorTemplate[] = [
  {
    templateId: "remote-mcp",
    name: "Remote MCP Server",
    category: "mcp",
    transport: "mcp-http",
    description: "Connect any standard HTTPS Model Context Protocol server and auto-discover its tools.",
    defaultBaseUrl: "https://mcp.example.com/mcp",
    auth: { type: "bearer", env: "MCP_SERVER_TOKEN" },
    tools: [
      { name: "tools_list", description: "List tools exposed by this MCP server", method: "POST", path: "/", risk: "read" },
    ],
  },
  {
    templateId: "github-api",
    name: "GitHub API",
    category: "developer",
    transport: "rest",
    description: "Inspect repositories, issues, pull requests, and workflows via GitHub REST.",
    defaultBaseUrl: "https://api.github.com",
    auth: { type: "bearer", env: "GITHUB_TOKEN" },
    tools: [
      { name: "get_repo", description: "Read repository metadata", method: "GET", path: "/repos/{owner}/{repo}", risk: "read" },
      { name: "list_issues", description: "List open issues", method: "GET", path: "/repos/{owner}/{repo}/issues", risk: "read" },
      { name: "create_issue", description: "Create a GitHub issue", method: "POST", path: "/repos/{owner}/{repo}/issues", risk: "write" },
    ],
  },
  {
    templateId: "slack-api",
    name: "Slack Workspace",
    category: "messaging",
    transport: "rest",
    description: "List channels and post updates to Slack channels via Slack Web API.",
    defaultBaseUrl: "https://slack.com/api",
    auth: { type: "bearer", env: "SLACK_BOT_TOKEN" },
    tools: [
      { name: "list_channels", description: "List public channels", method: "GET", path: "/conversations.list", risk: "read" },
      { name: "post_message", description: "Post a message to a Slack channel", method: "POST", path: "/chat.postMessage", risk: "write" },
    ],
  },
  {
    templateId: "discord-webhook",
    name: "Discord Webhook",
    category: "messaging",
    transport: "webhook",
    description: "Send formatted notifications or alerts to a Discord channel webhook.",
    defaultBaseUrl: "https://discord.com/api/webhooks",
    auth: { type: "none" },
    tools: [
      { name: "send_webhook", description: "Send a Discord webhook payload", method: "POST", path: "/{webhook_id}/{webhook_token}", risk: "write" },
    ],
  },
  {
    templateId: "notion-api",
    name: "Notion Workspace",
    category: "productivity",
    transport: "rest",
    description: "Search pages/databases and append content inside Notion.",
    defaultBaseUrl: "https://api.notion.com/v1",
    auth: { type: "bearer", env: "NOTION_TOKEN" },
    tools: [
      { name: "search", description: "Search Notion pages and databases", method: "POST", path: "/search", risk: "read" },
      { name: "create_page", description: "Create a Notion page", method: "POST", path: "/pages", risk: "write" },
    ],
  },
  {
    templateId: "linear-graphql",
    name: "Linear GraphQL",
    category: "developer",
    transport: "graphql",
    description: "Query and create issues/projects in Linear using GraphQL.",
    defaultBaseUrl: "https://api.linear.app",
    auth: { type: "api-key", header: "Authorization", env: "LINEAR_API_KEY" },
    tools: [
      { name: "graphql", description: "Execute a Linear GraphQL query or mutation", method: "POST", path: "/graphql", risk: "write" },
    ],
  },
  {
    templateId: "stripe-api",
    name: "Stripe Billing",
    category: "payments",
    transport: "rest",
    description: "Inspect customers, invoices, and payment intents via Stripe.",
    defaultBaseUrl: "https://api.stripe.com/v1",
    auth: { type: "bearer", env: "STRIPE_SECRET_KEY" },
    tools: [
      { name: "list_customers", description: "List Stripe customers", method: "GET", path: "/customers", risk: "read" },
      { name: "list_invoices", description: "List Stripe invoices", method: "GET", path: "/invoices", risk: "read" },
    ],
  },
  {
    templateId: "supabase-rest",
    name: "Supabase / PostgREST",
    category: "database",
    transport: "rest",
    description: "Query or invoke Edge Functions on an external Supabase project.",
    defaultBaseUrl: "https://example.supabase.co",
    auth: { type: "bearer", env: "EXTERNAL_SUPABASE_KEY" },
    tools: [
      { name: "query_table", description: "Select rows from a table via PostgREST", method: "GET", path: "/rest/v1/{table}", risk: "read" },
      { name: "invoke_function", description: "Invoke a Supabase Edge Function", method: "POST", path: "/functions/v1/{fn}", risk: "write" },
    ],
  },
  {
    templateId: "webhook-automation",
    name: "Webhook / n8n / Zapier",
    category: "automation",
    transport: "webhook",
    description: "Trigger automated external workflows with optional HMAC-SHA256 payload signing.",
    defaultBaseUrl: "https://hooks.example.com",
    auth: { type: "hmac-sha256", header: "x-microfixd-signature-256", env: "WEBHOOK_SIGNING_SECRET" },
    tools: [
      { name: "trigger_webhook", description: "Send JSON event to external automation webhook", method: "POST", path: "/{hook_path}", risk: "write" },
    ],
  },
  {
    templateId: "generic-graphql",
    name: "Custom GraphQL API",
    category: "custom",
    transport: "graphql",
    description: "Connect any HTTPS GraphQL endpoint with Bearer or API-key auth.",
    defaultBaseUrl: "https://api.example.com",
    auth: { type: "bearer", env: "CUSTOM_GRAPHQL_TOKEN" },
    tools: [
      { name: "query", description: "Execute GraphQL operation", method: "POST", path: "/graphql", risk: "read" },
      { name: "mutate", description: "Execute GraphQL mutation", method: "POST", path: "/graphql", risk: "write" },
    ],
  },
  {
    templateId: "generic-rest",
    name: "Custom REST API",
    category: "custom",
    transport: "rest",
    description: "Connect any external HTTPS REST service.",
    defaultBaseUrl: "https://api.example.com",
    auth: { type: "bearer", env: "CUSTOM_API_TOKEN" },
    tools: [
      { name: "request_get", description: "Execute GET request on configured path", method: "GET", path: "/{resource}", risk: "read" },
      { name: "request_post", description: "Execute POST request on configured path", method: "POST", path: "/{resource}", risk: "write" },
    ],
  },
];

const installed = new Map<string, InstalledConnector>();
// Server-only credential vault keyed by `${tenantId}:${connectorId}`; never serialized back to clients.
const connectorSecrets = new Map<string, string>();

function storageKey(connectorId: string, tenantId = "default"): string {
  return `${tenantId}:${connectorId}`;
}

export function setConnectorSecret(connectorId: string, secret: string, tenantId = "default"): void {
  const cleaned = secret.trim();
  if (!cleaned) {
    connectorSecrets.delete(storageKey(connectorId, tenantId));
    return;
  }
  connectorSecrets.set(storageKey(connectorId, tenantId), cleaned);
}

export function hasConnectorSecret(connector: InstalledConnector, tenantId = "default"): boolean {
  if (connector.manifest.auth.type === "none") return true;
  if (connectorSecrets.has(storageKey(connector.manifest.id, tenantId))) return true;
  if (connector.manifest.auth.env && Boolean(process.env[connector.manifest.auth.env]?.trim())) return true;
  return false;
}

export function getConnectorSecret(connector: InstalledConnector, tenantId = "default"): string | undefined {
  const vaultSecret = connectorSecrets.get(storageKey(connector.manifest.id, tenantId));
  if (vaultSecret) return vaultSecret;
  if (connector.manifest.auth.env) {
    const envVal = process.env[connector.manifest.auth.env]?.trim();
    if (envVal) return envVal;
  }
  return undefined;
}

export function installConnector(
  input: unknown,
  options?: { tenantId?: string; secret?: string; enabled?: boolean },
): InstalledConnector {
  const manifest = ManifestSchema.parse(input) as ConnectorManifest;
  const tenantId = options?.tenantId ?? "default";
  if (manifest.auth.env && !options?.secret) throw new Error("Supply a connector-specific credential");
  delete manifest.auth.env;
  if (manifest.auth.type !== "none" && !manifest.auth.env && !options?.secret) {
    throw new Error("Credential env name or server-stored secret required");
  }
  const key = tenantId === "default" ? manifest.id : storageKey(manifest.id, tenantId);
  const record: InstalledConnector = {
    manifest,
    enabled: Boolean(options?.enabled),
    installedAt: new Date().toISOString(),
    tenantId,
  };
  installed.set(key, record);
  if (options?.secret) {
    setConnectorSecret(manifest.id, options.secret, tenantId);
  }
  return record;
}

export function listConnectors(tenantId = "default"): InstalledConnector[] {
  return [...installed.values()].filter((c) => (c.tenantId ?? "default") === tenantId);
}

export function getConnector(id: string, tenantId = "default"): InstalledConnector | undefined {
  return installed.get(tenantId === "default" ? id : storageKey(id, tenantId)) ?? (tenantId !== "default" ? undefined : installed.get(id));
}

export function setConnectorEnabled(id: string, enabled: boolean, tenantId = "default"): InstalledConnector | null {
  const item = getConnector(id, tenantId);
  if (!item) return null;
  item.enabled = enabled;
  return item;
}

export function removeConnector(id: string, tenantId = "default"): boolean {
  const key = tenantId === "default" ? id : storageKey(id, tenantId);
  connectorSecrets.delete(storageKey(id, tenantId));
  return installed.delete(key);
}
