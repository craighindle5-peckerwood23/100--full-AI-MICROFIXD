// Supabase Edge Function: automotive-acquire. Only trusted service-role callers.
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
type Vehicle = { make: string; model: string; modelYear: number };
function validVehicle(v: Vehicle) {
  return v && Number.isInteger(v.modelYear) && v.modelYear >= 1886 && v.modelYear <= 2200 &&
    [v.make, v.model].every(s => typeof s === "string" && /^[a-z0-9 .-]{1,70}$/i.test(s));
}
function endpoint(kind: string, v: Vehicle) {
  if (!["recalls", "complaints"].includes(kind) || !validVehicle(v)) throw Error("Invalid request");
  const url = new URL(`https://api.nhtsa.gov/${kind}/${kind}ByVehicle`);
  url.searchParams.set("make", v.make);
  url.searchParams.set("model", v.model);
  url.searchParams.set("modelYear", String(v.modelYear));
  return url.toString();
}
async function digest(data: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,"0")).join("");
}
async function run() {
  const { data: rows, error: claimError } = await db.rpc("automotive_claim_job");
  if (claimError) throw claimError;
  const job = rows?.[0];
  if (!job) return { state: "idle" };
  let success = false, reason = "";
  let stored = 0;
  try {
    const kind = job.source_id === "nhtsa-recalls" ? "recalls" :
      job.source_id === "nhtsa-complaints" ? "complaints" : "";
    const v = JSON.parse(job.source_key) as Vehicle;
    const url = endpoint(kind, v);
    if (url !== job.request_url) throw Error("Job source mismatch");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try { response = await fetch(url, { signal: controller.signal }); }
    finally { clearTimeout(timeout); }
    if (!response.ok) throw Error(`NHTSA returned ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.results) || body.results.length > 5000) throw Error("Invalid source response");
    for (const item of body.results) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const raw = JSON.stringify(item);
      if (raw.length > 100000) continue;
      const hash = await digest(raw);
      const ext = kind === "recalls" ? item.NHTSACampaignNumber : item.odiNumber ?? item.ODINumber;
      const key = typeof ext === "string" || typeof ext === "number" ? String(ext) : hash;
      const { error } = await db.from("automotive_source_records").upsert({
        source_id: job.source_id, source_key: key, source_url: url,
        content_sha256: hash, payload: item, fetched_at: new Date().toISOString(),
      }, { onConflict: "source_id,source_key" });
      if (error) throw error;
      stored++;
    }
    success = true;
  } catch (e) { reason = e instanceof Error ? e.message : "Unknown failure"; }
  const { data: finished, error } = await db.rpc("automotive_finish_job", {
    p_id: job.id, p_token: job.lease_token, p_success: success, p_error: reason,
  });
  if (error || finished !== true) throw Error("Could not finalize leased job");
  return { state: success ? "completed" : "retry", stored };
}
Deno.serve(async req => {
  // JWT verification at gateway plus exact service key equality.
  if (req.headers.get("authorization") !== `Bearer ${serviceKey}`)
    return Response.json({ error: "Forbidden" }, { status: 403 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    const body = await req.json();
    if (body?.action === "enqueue") {
      const kind = body.kind as string, vehicle = body.vehicle as Vehicle;
      const url = endpoint(kind, vehicle);
      const { error } = await db.from("automotive_ingestion_jobs").upsert({
        source_id: `nhtsa-${kind}`, source_key: JSON.stringify(vehicle), request_url: url,
      }, { onConflict: "source_id,source_key", ignoreDuplicates: true });
      if (error) throw error;
      return Response.json({ state: "queued" });
    }
    if (body?.action === "run") {
      const limit = body.limit === undefined ? 5 : body.limit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw Error("Invalid batch limit");
      const results = [];
      for (let i=0;i<limit;i++) {
        const result = await run();
        results.push(result);
        if (result.state === "idle") break;
      }
      return Response.json({ results });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failure" }, { status: 422 });
  }
});
