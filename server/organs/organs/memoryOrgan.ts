/**
 * Memory Organ — Supabase vector memory operations
 * Actions: store, recall, recall_keyword, stats, clear
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseClient: SupabaseClient | null = null;

function isValidHttpUrl(str?: string): boolean {
  return typeof str === "string" && (str.startsWith("http://") || str.startsWith("https://"));
}

function getSupabase(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const url = isValidHttpUrl(rawUrl) ? rawUrl! : "https://caiiajbxslllrgeexbaw.supabase.co";
  
  const rawKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const key = (typeof rawKey === "string" && (rawKey.startsWith("sb_") || rawKey.startsWith("eyJ")))
    ? rawKey
    : "sb_publishable_IAqedYdeAhdsX475RhxUMg_EUE2Merq";

  try {
    _supabaseClient = createClient(url, key);
    return _supabaseClient;
  } catch (err) {
    console.warn("[memoryOrgan] Failed to create Supabase client:", err);
    return null;
  }
}

// In-memory fallback when Supabase is not yet configured
interface InMemoryMemory {
  id: string;
  content: string;
  tags: string[];
  organ: string;
  session_id: string | null;
  importance: number;
  created_at: string;
}
const localMemoryStore: InMemoryMemory[] = [];

export async function executeMemoryOrgan(action: string, payload: unknown): Promise<unknown> {
  const p = payload as Record<string, unknown>;
  const supabase = getSupabase();

  switch (action) {
    case "store": {
      const entry: InMemoryMemory = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}`),
        content: String(p.content ?? ""),
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
        organ: String(p.organ ?? "system"),
        session_id: (p.session_id as string) ?? null,
        importance: Number(p.importance ?? 0.5),
        created_at: new Date().toISOString(),
      };
      if (supabase) {
        const { data, error } = await supabase.from("microfixd_memory").insert({
          content: entry.content,
          tags: entry.tags,
          organ: entry.organ,
          session_id: entry.session_id,
          importance: entry.importance,
        }).select("id").single();
        if (!error && data) {
          return { stored: true, id: (data as { id: string }).id, source: "supabase" };
        }
      }
      localMemoryStore.unshift(entry);
      return { stored: true, id: entry.id, source: "in-memory" };
    }
    case "query":
    case "search":
    case "recall":
    case "recall_keyword": {
      const keywords = Array.isArray(p.keywords) ? (p.keywords as string[]) : [String(p.text ?? p.query ?? "")];
      const limit = Number(p.limit ?? 5);
      if (supabase) {
        try {
          let query = supabase.from("microfixd_memory").select("id,content,tags,organ,importance").limit(limit);
          for (const kw of keywords.slice(0, 3)) {
            if (kw) query = query.ilike("content", `%${kw}%`);
          }
          const { data, error } = await query;
          if (!error && data) {
            return { memories: data, count: data.length, source: "supabase" };
          }
        } catch {
          // fallback to local
        }
      }
      const filtered = localMemoryStore.filter(m =>
        keywords.some(kw => kw && m.content.toLowerCase().includes(kw.toLowerCase()))
      ).slice(0, limit);
      return { memories: filtered, count: filtered.length, source: "in-memory" };
    }
    case "stats":
    case "status":
    case "health": {
      if (supabase) {
        try {
          const { count, error } = await supabase.from("microfixd_memory").select("*", { count: "exact", head: true });
          if (!error && count != null) {
            return { total_memories: count, source: "supabase", status: "nominal" };
          }
        } catch {
          // fallback
        }
      }
      return { total_memories: localMemoryStore.length, source: "in-memory", status: "nominal" };
    }
    case "recent": {
      const limit = Number(p.limit ?? 10);
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from("microfixd_memory")
            .select("id,content,tags,organ,created_at")
            .order("created_at", { ascending: false })
            .limit(limit);
          if (!error && data) {
            return { memories: data, source: "supabase" };
          }
        } catch {
          // fallback
        }
      }
      return { memories: localMemoryStore.slice(0, limit), source: "in-memory" };
    }
    default:
      return { action, status: "nominal", total_memories: localMemoryStore.length, source: "in-memory" };
  }
}
