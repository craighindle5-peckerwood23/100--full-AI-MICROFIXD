/** Durable server memory. Database errors must never be reported as successful writes. */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
let client: SupabaseClient | undefined;
function database(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Durable memory requires SUPABASE_URL and a server-only SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("SUPABASE_URL must be an HTTPS API URL");
  return client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) } });
}
export async function executeMemoryOrgan(action: string, payload: unknown): Promise<any> {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, any>;
  const db = database();
  const session = String(p.session_id || "default");
  const agent = String(p.organ || "brain");
  const limit = Math.max(1, Math.min(100, Number(p.limit) || 10));
  if (action === "ack_output") {
    if (!p.session_id || !p.response_id || !["played", "failed", "cancelled"].includes(p.status)) throw new Error("Valid response_id and playback status required");
    const { data: output, error: readError } = await db.from("microfixd_memory_records")
      .select("id,agent_id,metadata").eq("id", p.response_id).contains("metadata", {session_id:session}).single();
    if (readError || output?.agent_id !== "command" || output.metadata?.output_mode !== "spoken") throw new Error("Spoken response not found in this session");
    const id = p.status === "played" ? `playback:${p.response_id}` : `playback:${p.response_id}:${randomUUID()}`;
    if(p.status === "played") {
      const {data:existing,error:existingError} = await db.from("microfixd_memory_records").select("metadata").eq("id",id).contains("metadata",{session_id:session}).maybeSingle();
      if(existingError)throw new Error(`Playback lookup failed: ${existingError.message}`);
      if(existing)return {success:true,response_id:p.response_id,state:existing.metadata.state,cmdId:output.metadata.cmdId,duplicate:true};
    }
    const row = {id, agent_id:"delivery", kind:"episodic", content:JSON.stringify({response_id:p.response_id,status:p.status,error:String(p.error || "").slice(0,500)}),
      tags:["playback"],importance:0.5,tenant_id:"global",metadata:{session_id:session,response_id:p.response_id,state:p.status === "played" ? "completed" : p.status}};
    // A successful acknowledgment is immutable; retries cannot create duplicate completion records.
    const {error} = await db.from("microfixd_memory_records").upsert(row,{onConflict:"id",ignoreDuplicates:true});
    if(error) throw new Error(`Playback acknowledgment failed: ${error.message}`);
    const {data:ack,error:ackError} = await db.from("microfixd_memory_records").select("metadata").eq("id",id).contains("metadata",{session_id:session}).single();
    if(ackError) throw new Error(`Playback acknowledgment read failed: ${ackError.message}`);
    return {success:true,response_id:p.response_id,state:ack.metadata.state,cmdId:output.metadata.cmdId};
  }
  if (action === "context") {
    const requested = Math.max(1,Math.min(100,Number(p.limit ?? process.env.MEMORY_RETRIEVAL_LIMIT) || 10));
    const max_chars = Math.max(1000,Math.min(100000,Number(p.max_chars ?? process.env.MEMORY_CONTEXT_MAX_CHARS) || 8000));
    const result = await executeMemoryOrgan(p.query ? "search" : "recent",{session_id:session,limit:requested,query:p.query});
    const selected:any[]=[];let used=2;
    for(const memory of result.memories){
      if(memory.agent_id === "delivery")continue;
      const record={id:memory.id,content:memory.content,created_at:memory.created_at};
      const size=JSON.stringify(record).length+1;
      if(used+size>max_chars)break;
      selected.push(record);used+=size;
    }
    return {context:JSON.stringify(selected.reverse()),window:{requested,returned:selected.length,max_chars,used_chars:used,omitted:result.memories.length-selected.length}};
  }
  if (action === "store") {
    if (typeof p.content !== "string" || !p.content.trim()) throw new Error("Memory content required");
    const { data, error } = await db.from("microfixd_memory_records").insert({
      id: randomUUID(), agent_id: agent, kind: "episodic", content: p.content,
      tags: Array.isArray(p.tags) ? p.tags : [], importance: Number(p.importance ?? 0.5),
      metadata: { ...(p.metadata || {}), session_id: session }, tenant_id: "global",
    }).select("id").single();
    if (error) throw new Error(`Memory write failed [${error.code}]: ${error.message}`);
    return { stored: true, id: data.id, source: "supabase", durable: true };
  }
  if (["stats", "status", "health", "health_check"].includes(action)) {
    const { count, error } = await db.from("microfixd_memory_records").select("id", { count: "exact", head: true });
    if (error) throw new Error(`Memory health failed [${error.code}]: ${error.message}`);
    return { total_memories: count, source: "supabase", durable: true, status: "nominal" };
  }
  if (["query", "search", "recall", "recall_keyword", "recent"].includes(action)) {
    let query = db.from("microfixd_memory_records")
      .select("id,content,tags,agent_id,importance,created_at,metadata")
      .contains("metadata", { session_id: session })
      .order("created_at", { ascending: false }).limit(limit);
    if (action !== "recent") {
      const keywords = Array.isArray(p.keywords) ? p.keywords : [p.text || p.query || ""];
      for (const keyword of keywords.slice(0, 3)) {
        if (keyword) query = query.ilike("content", `%${String(keyword).replace(/[%_]/g, "")}%`);
      }
    }
    const { data, error } = await query;
    if (error) throw new Error(`Memory recall failed [${error.code}]: ${error.message}`);
    return { memories: data, count: data.length, source: "supabase", durable: true };
  }
  throw new Error(`Unsupported memory action: ${action}`);
}
