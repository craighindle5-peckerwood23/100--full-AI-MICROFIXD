export type ConnectorTransport =
  | "http"
  | "rest"
  | "mcp-http"
  | "mcp-sse"
  | "graphql"
  | "webhook";

export type ConnectorCategory =
  | "mcp"
  | "productivity"
  | "developer"
  | "messaging"
  | "payments"
  | "database"
  | "automation"
  | "automotive"
  | "ai"
  | "custom";

export interface ConnectorTool {
  name: string;
  description?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  risk?: "read" | "write" | "consequential";
  inputSchema?: Record<string, unknown>;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  transport: ConnectorTransport;
  category?: ConnectorCategory;
  baseUrl: string;
  docsUrl?: string;
  defaultHeaders?: Record<string, string>;
  auth: {
    type: "bearer" | "api-key" | "basic" | "oauth2-bearer" | "hmac-sha256" | "none";
    env?: string;
    header?: string;
    prefix?: string;
  };
  tools: ConnectorTool[];
}

export interface InstalledConnector {
  manifest: ConnectorManifest;
  enabled: boolean;
  installedAt: string;
  tenantId?: string;
}

export interface ConnectorTemplate {
  templateId: string;
  name: string;
  category: ConnectorCategory;
  transport: ConnectorTransport;
  description: string;
  defaultBaseUrl: string;
  auth: ConnectorManifest["auth"];
  docsUrl?: string;
  tools: ConnectorTool[];
}
