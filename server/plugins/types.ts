export type ConnectorTransport = "http" | "mcp-http";

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  transport: ConnectorTransport;
  baseUrl: string;
  auth: { type: "bearer" | "api-key" | "none"; env?: string; header?: string };
  tools: Array<{
    name: string;
    description?: string;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: string;
    risk?: "read" | "write" | "consequential";
  }>;
}

export interface InstalledConnector {
  manifest: ConnectorManifest;
  enabled: boolean;
  installedAt: string;
}
