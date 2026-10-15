import { z } from "zod";
import type { ConnectorManifest, InstalledConnector } from "./types";

const ToolSchema = z.object({
  name: z.string().min(1).regex(/^[a-zA-Z0-9_.:-]+$/),
  description: z.string().optional(),
  method: z.enum(["GET","POST","PUT","PATCH","DELETE"]).default("POST"),
  path: z.string().min(1),
  risk: z.enum(["read","write","consequential"]).default("read"),
});
const ManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9][a-z0-9_.-]*$/),
  name: z.string().min(1),
  version: z.string().min(1),
  transport: z.enum(["http","mcp-http"]),
  baseUrl: z.string().url().refine(v => v.startsWith("https://"), "HTTPS required"),
  auth: z.object({
    type: z.enum(["bearer","api-key","none"]),
    env: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
    header: z.string().optional(),
  }),
  tools: z.array(ToolSchema).min(1),
});

const installed = new Map<string, InstalledConnector>();

export function installConnector(input: unknown): InstalledConnector {
  const manifest = ManifestSchema.parse(input) as ConnectorManifest;
  if (manifest.auth.type !== "none" && !manifest.auth.env) throw new Error("Credential env name required");
  const record = { manifest, enabled: false, installedAt: new Date().toISOString() };
  installed.set(manifest.id, record);
  return record;
}
export function listConnectors() { return [...installed.values()]; }
export function getConnector(id: string) { return installed.get(id); }
export function setConnectorEnabled(id: string, enabled: boolean) {
  const item=installed.get(id); if(!item) return null;
  item.enabled=enabled; return item;
}
