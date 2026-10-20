import { createHash } from "node:crypto";

export type VehicleQuery = { make: string; model: string; modelYear: number };
export type NhtsaKind = "recalls" | "complaints";
export interface IngestionRecord {
  sourceId: string; sourceKey: string; sourceUrl: string;
  payload: Record<string, unknown>; contentSha256: string;
}
export interface RecordStore {
  upsert(record: IngestionRecord): Promise<void>;
}
const ENDPOINTS: Record<NhtsaKind, string> = {
  recalls: "https://api.nhtsa.gov/recalls/recallsByVehicle",
  complaints: "https://api.nhtsa.gov/complaints/complaintsByVehicle",
};
export function buildNhtsaUrl(kind: NhtsaKind, vehicle: VehicleQuery): string {
  if (!Number.isInteger(vehicle.modelYear) || vehicle.modelYear < 1886 || vehicle.modelYear > 2200)
    throw new Error("Invalid model year");
  for (const value of [vehicle.make, vehicle.model]) {
    if (!/^[a-z0-9 .-]{1,70}$/i.test(value)) throw new Error("Invalid make/model");
  }
  const url = new URL(ENDPOINTS[kind]);
  url.searchParams.set("make", vehicle.make);
  url.searchParams.set("model", vehicle.model);
  url.searchParams.set("modelYear", String(vehicle.modelYear));
  return url.toString();
}
export async function fetchNhtsa(
  kind: NhtsaKind, vehicle: VehicleQuery, store: RecordStore,
  fetcher: typeof fetch = fetch,
): Promise<{ stored: number; sourceUrl: string }> {
  const sourceUrl = buildNhtsaUrl(kind, vehicle);
  const response = await fetcher(sourceUrl, {
    headers: { accept: "application/json", "user-agent": "Microfixd-Automotive-Research/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`NHTSA HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("results" in body) ||
      !Array.isArray((body as { results: unknown }).results))
    throw new Error("Unexpected NHTSA response");
  const results = (body as { results: unknown[] }).results;
  if (results.length > 5000) throw new Error("Response exceeds bounded batch");
  const sourceId = `nhtsa-${kind}`;
  let stored = 0;
  for (const item of results) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const payload = item as Record<string, unknown>;
    const canonical = JSON.stringify(payload);
    if (canonical.length > 100_000) continue;
    const hash = createHash("sha256").update(canonical).digest("hex");
    const external = kind === "recalls" ? payload.NHTSACampaignNumber : payload.odiNumber ?? payload.ODINumber;
    const key = typeof external === "string" || typeof external === "number"
      ? String(external) : hash;
    await store.upsert({ sourceId, sourceKey: key, sourceUrl, payload, contentSha256: hash });
    stored++;
  }
  return { stored, sourceUrl };
}
