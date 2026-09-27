/**
 * Memory Organ — Supabase vector memory operations
 * Actions: store, recall, recall_keyword, stats, clear
 */
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ""
);

export async function executeMemoryOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  switch (action) {
    case "store": {
      const { data, error } = await supabase.from("microfixd_memory").insert({
        content:    String(p.content ?? ""),
        tags:       Array.isArray(p.tags) ? p.tags : [],
        organ:      String(p.organ ?? "system"),
        session_id: p.session_id ?? null,
        importance: Number(p.importance ?? 0.5),
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { stored: true, id: (data as { id: string }).id };
    }
    case "recall_keyword": {
      const keywords = Array.isArray(p.keywords) ? p.keywords : [String(p.query ?? "")];
      let query = supabase.from("microfixd_memory").select("id,content,tags,organ,importance").limit(Number(p.limit ?? 5));
      for (const kw of keywords.slice(0, 3)) {
        query = query.ilike("content", `%${kw}%`);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return { memories: data ?? [], count: (data ?? []).length };
    }
    case "stats": {
      const { count } = await supabase.from("microfixd_memory").select("*", { count: "exact", head: true });
      return { total_memories: count ?? 0 };
    }
    case "recent": {
      const { data, error } = await supabase
        .from("microfixd_memory")
        .select("id,content,tags,organ,created_at")
        .order("created_at", { ascending: false })
        .limit(Number(p.limit ?? 10));
      if (error) throw new Error(error.message);
      return { memories: data ?? [] };
    }
    default:
      throw new Error(`Memory organ: unknown action '${action}'`);
  }
}
