import topology from "../../microfixd/topology.json";
import wiring from "../../microfixd/wiring.json";

export type ObjectType = "agent" | "organ" | "node" | "runtime" | "server";
type CatalogEntry = { id: string; kind: ObjectType; source: string };
type OrganEntry = { id: string; executable: boolean; source: string; node: string };

const objects = topology.objects as CatalogEntry[];
const organs = topology.organs as OrganEntry[];
const routes = wiring.classificationRoutes as Record<string, string>;
const byKey = new Map(objects.map(entry => [`${entry.kind}:${entry.id}`, entry]));
const byOrgan = new Map(organs.map(entry => [entry.id, entry]));
const types = new Set<ObjectType>(["agent", "organ", "node", "runtime", "server"]);

if (byKey.size !== objects.length || byOrgan.size !== organs.length ||
    organs.some(entry => routes[entry.id] !== entry.source ||
      !wiring.connections.some(edge => edge.source === "classifier" && edge.target === entry.id && edge.node === entry.node))) {
  throw new Error("Classification topology and wiring are inconsistent");
}

export class ClassificationError extends Error {
  constructor(public readonly code: "MISSING_TYPE" | "UNKNOWN_TYPE" | "MISSING_ID" | "UNKNOWN_ID", message: string) {
    super(message);
  }
}

export function resolveTypedObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ClassificationError("MISSING_TYPE", "A typed object is required");
  }
  const input = value as Record<string, unknown>;
  const declared = input.type ?? input.kind;
  if (typeof declared !== "string" || !declared.trim()) {
    throw new ClassificationError("MISSING_TYPE", "Object type is required");
  }
  const kind = declared.startsWith("microfixed.") ? declared.slice("microfixed.".length) : declared;
  if (!types.has(kind as ObjectType)) {
    throw new ClassificationError("UNKNOWN_TYPE", `Unknown object type: ${declared}`);
  }
  if (typeof input.id !== "string" || !input.id.trim()) {
    throw new ClassificationError("MISSING_ID", "Object id is required");
  }
  const entry = byKey.get(`${kind}:${input.id}`);
  if (!entry) {
    throw new ClassificationError("UNKNOWN_ID", `No ${kind} node is registered for: ${input.id}`);
  }
  return { type: kind as ObjectType, id: entry.id, source: entry.source, value: input };
}

export function serializeTypedObject(value: unknown): string {
  return JSON.stringify(resolveTypedObject(value));
}

export function resolveExecutableOrgans(ids: unknown): string[] {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ClassificationError("MISSING_ID", "At least one organ id is required");
  }
  return ids.map(id => {
    const entry = typeof id === "string" ? byOrgan.get(id) : undefined;
    if (!entry || !entry.executable) {
      throw new ClassificationError("UNKNOWN_ID", `No executable organ node is registered for: ${String(id)}`);
    }
    return entry.id;
  });
}

export function getClassificationMap() {
  return { objectTypes: topology.objectTypes, objects, organs, connections: wiring.connections };
}
