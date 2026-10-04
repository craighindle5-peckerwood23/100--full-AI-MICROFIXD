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
