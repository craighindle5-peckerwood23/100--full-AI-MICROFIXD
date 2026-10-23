import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildNhtsaUrl, fetchNhtsa, type NhtsaKind, type VehicleQuery } from "./nhtsa-ingestion";
import {saveNhtsaRecord} from './sourceReferences';
import {CATALOG_SOURCE,importModels} from './vehicleCatalog';

type Job = { id: string; source_id: string; source_key: string; request_url: string; lease_token: string };
function clientFromEnv(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are required");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function parseJob(job: Job): { kind: NhtsaKind; vehicle: VehicleQuery } {
  const kind: NhtsaKind = job.source_id === "nhtsa-recalls" ? "recalls" :
    job.source_id === "nhtsa-complaints" ? "complaints" : (() => { throw new Error("Unsupported source"); })();
  const input = JSON.parse(job.source_key) as VehicleQuery;
  const url = buildNhtsaUrl(kind, input);
  if (url !== job.request_url) throw new Error("Job URL mismatch");
  return { kind, vehicle: input };
}
export async function enqueueNhtsa(db: SupabaseClient, kind: NhtsaKind, vehicle: VehicleQuery): Promise<void> {
  const url = buildNhtsaUrl(kind, vehicle);
  const sourceId = `nhtsa-${kind}`;
  const key = JSON.stringify({ make: vehicle.make, model: vehicle.model, modelYear: vehicle.modelYear });
  const { error } = await db.from("automotive_ingestion_jobs").upsert(
    { source_id: sourceId, source_key: key, request_url: url },
    { onConflict: "source_id,source_key", ignoreDuplicates: true },
  );
  if (error) throw error;
}
export async function runOneIngestionJob(db: SupabaseClient, fetcher: typeof fetch = fetch): Promise<"idle" | "completed" | "failed"> {
  const { data, error } = await db.rpc("automotive_claim_job");
  if (error) throw error;
  const job = (data as Job[] | null)?.[0];
  if (!job) return "idle";
  let success = false;
  let failure: string | null = null;
  try {
    if(job.source_id===CATALOG_SOURCE)await importModels(db,job.source_key,job.request_url,fetcher);
    else {
      const { kind, vehicle } = parseJob(job);
      await fetchNhtsa(kind, vehicle, {upsert: record=>saveNhtsaRecord(db,record)}, fetcher);
    }
    success = true;
  } catch (e) {
    failure = e instanceof Error ? e.message : "unknown error";
  }
  const { data: finished, error: finishError } = await db.rpc("automotive_finish_job", {
    p_id: job.id, p_token: job.lease_token, p_success: success, p_error: failure,
  });
  if (finishError) throw finishError;
  if (finished !== true) throw new Error("Job lease lost before completion");
  return success ? "completed" : "failed";
}
export async function runWorkerBatch(db: SupabaseClient, limit = 10, fetcher: typeof fetch = fetch) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid batch limit");
  const stats = { completed: 0, failed: 0, idle: false };
  for (let i = 0; i < limit; i++) {
    const result = await runOneIngestionJob(db, fetcher);
    if (result === "idle") { stats.idle = true; break; }
    stats[result]++;
  }
  return stats;
}
export async function runConfiguredWorker(limit = 10) { return runWorkerBatch(clientFromEnv(), limit); }

/** One fenced job at a time. Durable queue resumes after restart; free hosts can sleep. */
export function startIngestionWorker() {
  if(process.env.AUTOMOTIVE_INGESTION_ENABLED==='0'||!process.env.SUPABASE_URL||!(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY))return ()=>{};
  let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const tick=async()=>{
    let delay=5000;
    try{const stats=await runConfiguredWorker(1);if(stats.failed)delay=60000;else if(stats.idle)delay=60000;}
    catch{delay=60000;console.error('[automotive-ingestion] worker dependency unavailable; queue retained');}
    finally{if(!stopped)timer=setTimeout(()=>void tick(),delay).unref();}
  };
  timer=setTimeout(()=>void tick(),1000).unref();
  return ()=>{stopped=true;clearTimeout(timer);};
}
